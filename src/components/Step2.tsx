import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { CITIES, URBAN_LABEL } from '@/data/catalog';
import {
  AREA_SPAN,
  bandOf,
  CITY_MAP,
  currentStage,
  GEO,
  CHOICE_LABEL,
  nearestCityByLonLat,
} from '@/lib/model';
import { liveCityItemsDirect, type LiveItem } from '@/data/live';
import { rankByField } from '@/lib/search';
import { apiLoadArchiveChoiceStats } from '@/lib/yutuApi';
import {
  collectCityMaterials,
  type CityMaterial,
  type MaterialItem,
} from '@/lib/materials';
import { SNAPSHOT_AT } from '@/data/snapshot-meta';
import { useImmersive } from '@/lib/uiMotion';
import { useYutu } from '@/store/YutuContext';
import GisMap from './GisMap';
import { Empty, Kv, LiveCard } from './bits';
import DataSourceBadge from './DataSourceBadge';

type GeoState = 'idle' | 'pending' | 'granted' | 'denied';

type GeoPermission = 'granted' | 'denied' | 'prompt' | null;

/** 浏览器定位失败原因：不同错误码的成因完全不同，分别给出可执行的建议 */
function geoErrorText(err: { code: number; message?: string }, inFrame: boolean) {
  if (err.code === 1) {
    return inFrame
      ? '浏览器拒绝了定位：当前页面在嵌入式 iframe 中，父页面没有授予 geolocation 权限。'
      : '浏览器或平台权限策略拒绝了定位。可在地址栏的站点设置里检查，或直接在地图上点选位置。';
  }
  if (err.code === 2) {
    return '设备暂时无法获取位置：可能没有 GPS、网络定位被关闭，或所在环境无法定位。';
  }
  if (err.code === 3) {
    return '定位超时：浏览器在 8 秒内没有返回结果，可重试或直接在地图上点选位置。';
  }
  return err.message || `错误码 ${err.code}`;
}

type SideTab = 'city' | 'talk' | 'peer' | 'geo';

const SIDE_TABS: SideTab[] = ['city', 'talk', 'peer', 'geo'];
const SIDE_TAB_LABEL: Record<SideTab, string> = {
  city: '城市',
  talk: '讨论',
  peer: '同阶段',
  geo: '定位',
};
const AUTO_ROTATE_MS = 3000;
const AUTO_HOLD_MS = 8000;

/** 侧栏内滑灵敏度 */
const SIDE_SWIPE_TOUCH_PX = 20;
const SIDE_SWIPE_MOUSE_PX = 28;
const SIDE_SWIPE_RATIO = 1.0;
const SIDE_WHEEL_PX = 10;
const SIDE_WHEEL_LOCK_MS = 160;
const SIDE_FLICK_MIN_PX = 12;
const SIDE_FLICK_VELOCITY = 0.5;

export default function Step2() {
  const { state, setStep, applyCity } = useYutu();
  const p = state.profile;
  const stage = currentStage(p);
  const city = CITY_MAP[p.city] ?? CITIES[0];
  const [mode, setMode] = useState<'geo' | 'net'>('geo');
  const [sideTab, setSideTab] = useState<SideTab>('city');
  const [focusMaterial, setFocusMaterial] = useState<{
    mat: CityMaterial;
    item: MaterialItem;
  } | null>(null);
  const [coords, setCoords] = useState<{
    lon: number;
    lat: number;
    acc: number;
    manual?: boolean;
  } | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [showMaterials, setShowMaterials] = useState(true);
  const [pickMode, setPickMode] = useState(false);
  const [permState, setPermState] = useState<GeoPermission>(null);
  /** 聚焦模式：地图铺满视口，侧栏变成右侧玻璃抽屉 */
  const [focus, setFocus] = useState(false);
  useImmersive(focus, setFocus);

  /* 侧栏四页签自动轮播：桌面精细指针下生效，鼠标在面板上时暂停 */
  const sideRef = useRef<HTMLElement>(null);
  const holdRef = useRef(0);
  const [autoOn, setAutoOn] = useState(false);
  const [sideVisible, setSideVisible] = useState(true);
  const [sideHovered, setSideHovered] = useState(false);
  const [manualHold, setManualHold] = useState(false);
  /** 侧栏内部左右滑时的进入方向；不触发整页翻页 */
  const [sideDir, setSideDir] = useState<'next' | 'prev' | null>(null);
  const sideSwipe = useRef({
    active: false,
    x: 0,
    y: 0,
    t: 0,
    target: null as Element | null,
    pointer: false,
  });
  const sideWheelLock = useRef(0);

  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!fine) return;
    const sync = () => {
      setAutoOn(
        fine.matches &&
          !reduce?.matches &&
          !document.documentElement.classList.contains('y-motion-off')
      );
    };
    sync();
    fine.addEventListener?.('change', sync);
    reduce?.addEventListener?.('change', sync);
    window.addEventListener('yutu:motion', sync);
    return () => {
      fine.removeEventListener?.('change', sync);
      reduce?.removeEventListener?.('change', sync);
      window.removeEventListener('yutu:motion', sync);
    };
  }, []);

  useEffect(() => {
    const el = sideRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const ob = new IntersectionObserver(
      entries => setSideVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0.15 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  useEffect(
    () => () => window.clearTimeout(holdRef.current),
    []
  );

  const holdManual = () => {
    setManualHold(true);
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(
      () => setManualHold(false),
      AUTO_HOLD_MS
    );
  };

  const sideSkipTarget = (target: Element | null) =>
    Boolean(
      target?.closest(
        'button, a, input, select, textarea, summary, [role="tab"], [contenteditable="true"]'
      )
    );

  /** 侧栏内部左右滑：只在「城市 / 讨论 / 同阶段 / 定位」之间切换 */
  const switchSide = (delta: 1 | -1) => {
    setSideDir(delta > 0 ? 'next' : 'prev');
    setSideTab(prev => {
      const i = SIDE_TABS.indexOf(prev);
      return SIDE_TABS[(i + delta + SIDE_TABS.length) % SIDE_TABS.length];
    });
    holdManual();
  };

  const onSideTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) {
      sideSwipe.current.active = false;
      return;
    }
    const target = e.target as Element;
    if (sideSkipTarget(target)) {
      sideSwipe.current.active = false;
      return;
    }
    sideSwipe.current = {
      active: true,
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: performance.now(),
      target,
      pointer: false,
    };
  };
  const onSideTouchEnd = (e: ReactTouchEvent<HTMLElement>) => {
    const s = sideSwipe.current;
    if (!s.active || !e.changedTouches.length) {
      s.active = false;
      return;
    }
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    const dt = Math.max(1, performance.now() - s.t);
    s.active = false;
    const horizontal = Math.abs(dx) >= Math.abs(dy) * SIDE_SWIPE_RATIO;
    const longEnough = Math.abs(dx) >= SIDE_SWIPE_TOUCH_PX;
    const flick =
      horizontal &&
      Math.abs(dx) >= SIDE_FLICK_MIN_PX &&
      Math.abs(dx) / dt >= SIDE_FLICK_VELOCITY;
    if (!horizontal || (!longEnough && !flick)) return;
    if (sideSkipTarget(s.target)) return;
    switchSide(dx < 0 ? 1 : -1);
  };
  const onSidePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as Element;
    if (sideSkipTarget(target)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    sideSwipe.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      target,
      pointer: true,
    };
  };
  const onSidePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const s = sideSwipe.current;
    if (!s.active || !s.pointer || e.pointerType !== 'mouse') return;
    s.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = Math.max(1, performance.now() - s.t);
    const horizontal = Math.abs(dx) >= Math.abs(dy) * SIDE_SWIPE_RATIO;
    const longEnough = Math.abs(dx) >= SIDE_SWIPE_MOUSE_PX;
    const flick =
      horizontal &&
      Math.abs(dx) >= SIDE_FLICK_MIN_PX &&
      Math.abs(dx) / dt >= SIDE_FLICK_VELOCITY;
    if (!horizontal || (!longEnough && !flick)) return;
    if (sideSkipTarget(s.target)) return;
    switchSide(dx < 0 ? 1 : -1);
  };
  const onSidePointerCancel = () => {
    sideSwipe.current.active = false;
  };
  const onSideWheel = (e: ReactWheelEvent<HTMLElement>) => {
    if (e.ctrlKey) return;
    if (Math.abs(e.deltaX) < SIDE_WHEEL_PX) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (sideSkipTarget(e.target as Element)) return;
    const now = Date.now();
    if (now < sideWheelLock.current) return;
    sideWheelLock.current = now + SIDE_WHEEL_LOCK_MS;
    switchSide(e.deltaX < 0 ? 1 : -1);
  };

  const autoPaused =
    !autoOn ||
    !sideVisible ||
    sideHovered ||
    manualHold ||
    Boolean(focusMaterial) ||
    pickMode ||
    geoState === 'pending';

  useEffect(() => {
    if (autoPaused) return;
    const id = window.setInterval(() => {
      if (document.documentElement.classList.contains('y-motion-off')) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      if (document.visibilityState === 'hidden') return;
      setSideDir('next');
      setSideTab(prev => {
        const i = SIDE_TABS.indexOf(prev);
        return SIDE_TABS[(i + 1) % SIDE_TABS.length];
      });
    }, AUTO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [autoPaused]);

  /* 预览页常被平台嵌在 iframe 里，父页面没开 geolocation 时浏览器会直接拒绝，
     这不是应用代码能绕过的；提前识别，给出“在地图上点选”的替代路径。 */
  const inIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let alive = true;
    let status: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then(s => {
        if (!alive) return;
        status = s;
        setPermState(s.state);
        s.onchange = () => setPermState(s.state);
      })
      .catch(() => {
        /* 部分浏览器不支持查询 geolocation 权限，忽略即可 */
      });
    return () => {
      alive = false;
      if (status) status.onchange = null;
    };
  }, []);
  const cityMaterials = useMemo(() => collectCityMaterials(), []);
  const materialCount = cityMaterials.reduce((n, m) => n + m.count, 0);

  const ll = GEO[p.city] ?? GEO.chengdu;
  const nearby = useMemo(
    () =>
      CITIES.filter(x => {
        if (x.id === p.city) return false;
        const g = GEO[x.id];
        if (!g) return false;
        const dLon = (g[0] - ll[0]) * Math.cos((ll[1] * Math.PI) / 180);
        const dLat = g[1] - ll[1];
        return Math.sqrt(dLon * dLon + dLat * dLat) <= AREA_SPAN;
      }),
    [ll, p.city]
  );
  const pool = [city, ...nearby];
  const avgJobs = Math.round(
    pool.reduce((a, b) => a + b.jobs, 0) / pool.length
  );
  const avgCost = Math.round(
    pool.reduce((a, b) => a + b.cost, 0) / pool.length
  );

  /* 只读当前城市自己的快照，不再用成都样例替代其他城市 */
  const cityLive = useMemo(() => liveCityItemsDirect(p.city), [p.city]);
  const liveRanked = useMemo(
    () => rankByField(cityLive, p.field),
    [cityLive, p.field]
  );
  const liveItems = liveRanked.items;

  /* 区域证据：当前城市 + 蓝圈内邻近城市，去掉已在“近期讨论”展示的条目 */
  const regionalPool = useMemo(() => {
    const seen = new Set<string>();
    const out: LiveItem[] = [];
    [p.city, ...nearby.map(n => n.id)].forEach(id => {
      liveCityItemsDirect(id).forEach(it => {
        if (seen.has(it.url)) return;
        seen.add(it.url);
        out.push(it);
      });
    });
    return out;
  }, [p.city, nearby]);
  const shownKey = liveItems
    .slice(0, 3)
    .map(it => it.url)
    .join('|');
  const regionalRanked = useMemo(() => {
    const shown = new Set(shownKey ? shownKey.split('|') : []);
    return rankByField(
      regionalPool.filter(it => !shown.has(it.url)),
      p.field
    );
  }, [regionalPool, p.field, shownKey]);
  const regionalItems = regionalRanked.items.slice(0, 4);

  const [choiceRows, setChoiceRows] = useState<
    { choice: string; count: number }[]
  >([]);
  const [choiceTotal, setChoiceTotal] = useState(0);
  const [choiceLatest, setChoiceLatest] = useState('');
  const [choiceLoading, setChoiceLoading] = useState(true);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [choiceTick, setChoiceTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setChoiceLoading(true);
    setChoiceError(null);
    apiLoadArchiveChoiceStats()
      .then(rows => {
        if (!alive) return;
        const map = new Map<string, number>();
        let sum = 0;
        let latest = '';
        rows
          .filter(r => r.stage === stage.id && r.choice)
          .forEach(r => {
            map.set(r.choice, (map.get(r.choice) ?? 0) + r.count);
            sum += r.count;
            if (r.latest > latest) latest = r.latest;
          });
        setChoiceRows(
          [...map]
            .map(([choice, count]) => ({ choice, count }))
            .sort((a, b) => b.count - a.count)
        );
        setChoiceTotal(sum);
        setChoiceLatest(latest);
      })
      .catch(() => {
        if (!alive) return;
        setChoiceRows([]);
        setChoiceTotal(0);
        setChoiceLatest('');
        setChoiceError('同阶段归档统计接口暂时不可用。');
      })
      .finally(() => {
        if (alive) setChoiceLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [stage.id, choiceTick]);

  const choiceSlices = choiceRows.map(r => ({
    ...r,
    pct: choiceTotal ? Math.round((r.count / choiceTotal) * 100) : 0,
    label:
      CHOICE_LABEL[r.choice as keyof typeof CHOICE_LABEL] ?? r.choice,
  }));
  const topChoice = choiceSlices[0];
  const choiceReady = choiceTotal >= 5 && Boolean(topChoice);

  useEffect(() => {
    if (!focusMaterial) return;
    document
      .getElementById('y-map-focus')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusMaterial]);

  const near = coords ? nearestCityByLonLat(coords.lon, coords.lat) : null;
  const displayLon = coords ? coords.lon : ll[0];
  const displayLat = coords ? coords.lat : ll[1];

  const geoStateText = coords
    ? coords.manual
      ? '已在地图上点选实际位置，落点按选中坐标显示。'
      : '已授权，落点已细化到实际坐标。'
    : geoState === 'pending'
      ? '正在等待浏览器返回定位结果…'
      : geoState === 'denied'
        ? `定位被拒绝或不可用，已继续使用城市级落点。原因：${geoError || '未提供'}`
        : '当前使用城市级落点。需要精确到实际地点时，再授权定位。';

  const geoEnvNote = inIframe
    ? '当前页面嵌在预览 iframe 中：浏览器通常不允许 iframe 申请定位，父页面未授权时会直接被拒绝。可在地图上点选位置，或在浏览器新窗口打开本页后再授权。'
    : !secureContext
      ? '当前页面不是 HTTPS 安全上下文，浏览器不会开放定位；请在地图上点选位置。'
      : permState === 'denied'
        ? '本站点的定位权限处于拒绝状态（可能来自浏览器站点设置，或平台预览的权限策略）。可在地图上点选位置。'
        : permState === 'granted'
          ? '本站点已允许定位，点击下方按钮即可获取位置。'
          : '点击下方按钮时，浏览器会弹出定位权限询问。';

  function requestGeo() {
    if (!window.isSecureContext) {
      setGeoState('denied');
      setGeoError('当前页面不是 HTTPS 安全上下文，浏览器禁止定位。');
      return;
    }
    if (!navigator.geolocation) {
      setGeoState('denied');
      setGeoError('该浏览器未提供 Geolocation 接口。');
      return;
    }
    setGeoState('pending');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          acc: pos.coords.accuracy || 0,
          manual: false,
        });
        setGeoState('granted');
        setRecenterSignal(n => n + 1);
      },
      err => {
        setGeoState('denied');
        setGeoError(geoErrorText(err, inIframe));
        setCoords(null);
        setRecenterSignal(n => n + 1);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  /** 定位被浏览器拒绝时，用户可以直接在地图上点选实际位置 */
  function applyPickedPoint(lat: number, lon: number) {
    setCoords({ lon, lat, acc: 0, manual: true });
    setGeoState('granted');
    setGeoError(null);
    setPickMode(false);
    setRecenterSignal(n => n + 1);
  }

  function revokeGeo() {
    setCoords(null);
    setGeoState('idle');
    setGeoError(null);
    setPickMode(false);
    setRecenterSignal(n => n + 1);
  }

  const baseLegend: [string, string][] =
    mode === 'net'
      ? [
          ['#78d6d0', '你的城市'],
          ['#7ed4c4', '目标岗位更密'],
          ['#c4a678', '目标岗位更稀'],
          ['#7ed4c4', '迁移弧线'],
        ]
      : [
          ['#1f6fb2', '你的城市'],
          ['#a9762f', '蓝圈内城市'],
          ['#7ed4c4', '同区域飞线'],
          ['#8a979f', '其他城市'],
        ];
  const legend: [string, string][] = [
    ...baseLegend,
    ...(showMaterials
      ? ([
          ['#7a5a86', `检索资料 ${materialCount} 条（飞线连回城市）`],
        ] as [string, string][])
      : []),
    ...(coords
      ? ([['#e8764a', '实际位置 → 城市飞线']] as [string, string][])
      : []),
  ];

  const modeNote =
    mode === 'net'
      ? '网络模式：在离线矢量陆地上，从你的城市连向可迁移城市。同区域城市全部连上，另补四个岗位密度更高的跨区域城市；弧线粗细表示岗位密度差，青色为目标更密，棕色为目标更稀。紫色资料点同样用飞线连回所属城市。'
      : '地理模式：交互式 GIS 底图，可拖动平移、滚轮/双指缩放。城市点大小表示岗位密度；紫色小点是按城市检索归位的资料，位置表示检索城市，不表示作者所在地（悬停看标题、点击看原文），每个资料点有一条紫色飞线连回所属城市；青色飞线连接蓝圈内的邻近城市；底图加载失败时自动回落到离线矢量陆地。';

  return (
    <section id='y-p2' role='tabpanel' aria-labelledby='y-s2'>
      <div className='y-lead y-lead-wide'>
        <div>
          <p className='y-eyebrow'>02 / 了解环境</p>
          <h2>了解你所处的环境</h2>
        </div>
        <div className='y-lead-facts'>
          <div>
            <b>{city.name}</b>
            <span>{city.province}</span>
          </div>
          <div>
            <b>{stage.name}</b>
            <span>当前阶段</span>
          </div>
          <div>
            <b>{nearby.length}</b>
            <span>邻近城市</span>
          </div>
        </div>
      </div>

      <div className='y-insight'>
        <span className='y-insight-tag'>本步结论</span>
        <p>
          你在 <b>{city.name}</b>，处于 <b>{stage.name}</b>；
          {nearby.length
            ? `蓝圈内还有 ${nearby.length} 个城市。`
            : '蓝圈内暂无其他样本城市。'}
          {choiceReady && topChoice ? (
            <>
              同阶段已归档用户中，选择最多的是{' '}
              <b>「{topChoice.label}」</b>（{topChoice.pct}%，n={choiceTotal}）。
            </>
          ) : choiceLoading ? (
            '正在读取同阶段归档统计。'
          ) : (
            <>
              同阶段归档记录
              {choiceTotal ? `已有 ${choiceTotal} 条` : '还没有'}
              ，暂时不足以给出占比。
            </>
          )}
        </p>
      </div>

      <div className={`y-stage${focus ? ' is-focus' : ''}`}>
        {focus ? (
          <button
            type='button'
            className='y-focus-backdrop'
            aria-label='退出聚焦，返回页面'
            onClick={() => setFocus(false)}
          />
        ) : null}
        <div className='y-globe-panel y-focus-card'>
          <div className='y-globe-head'>
            <div>
              <p className='y-eyebrow'>01 / 定位 <DataSourceBadge source='geo' showLabel={false} /></p>
              <h3>
                {city.name}
                <span className='y-mini'>
                  {city.province} · {city.tier}
                </span>
              </h3>
            </div>
            <div className='y-globe-actions'>
              <div className='y-mode' role='group' aria-label='地球显示模式'>
                <button
                  type='button'
                  className={mode === 'geo' ? 'is-on' : ''}
                  aria-pressed={mode === 'geo'}
                  onClick={() => setMode('geo')}
                >
                  地理模式
                </button>
                <button
                  type='button'
                  className={mode === 'net' ? 'is-on' : ''}
                  aria-pressed={mode === 'net'}
                  onClick={() => setMode('net')}
                >
                  网络模式
                </button>
              </div>
              <button
                type='button'
                className='y-btn y-btn-s y-focus-toggle'
                aria-pressed={focus}
                onClick={() => setFocus(v => !v)}
                title={focus ? 'Esc 也可退出' : '地图铺满视口，侧栏变成抽屉'}
              >
                {focus ? '退出聚焦' : '聚焦地图'}
              </button>
            </div>
          </div>

          <div className='y-globe'>
            <GisMap
              city={p.city}
              coords={coords}
              mode={mode}
              recenterSignal={recenterSignal}
              onSelectCity={id => {
                if (!pickMode) {
                  applyCity(id);
                  setSideDir(null);
                  setSideTab('city');
                  setFocusMaterial(null);
                  /* 选完城市先停住轮播，避免 3s 后城市内容被切走 */
                  holdManual();
                }
              }}
              materials={cityMaterials}
              showMaterials={showMaterials}
              onSelectMaterial={(mat, item) => {
                setSideDir(null);
                setSideTab('talk');
                setFocusMaterial({ mat, item });
              }}
              onPickPoint={pickMode ? applyPickedPoint : undefined}
              picking={pickMode}
            />
            <div className='y-globe-hud y-hud-tl'>
              <b>
                {coords
                  ? coords.manual
                    ? '点选坐标'
                    : '实际坐标'
                  : pickMode
                    ? '点选位置中'
                    : '城市级落点'}
              </b>
              <span>
                {Math.abs(displayLat).toFixed(1)}°{displayLat >= 0 ? 'N' : 'S'}{' '}
                · {Math.abs(displayLon).toFixed(1)}°
                {displayLon >= 0 ? 'E' : 'W'}
              </span>
            </div>
            <div className='y-globe-hud y-hud-bl'>
              {legend.map(([color, label]) => (
                <span key={label}>
                  <i className='y-dot' style={{ background: color }} />
                  {label}
                </span>
              ))}
              <span>
                <i
                  className='y-dot'
                  style={{
                    background: 'transparent',
                    border: '1px dashed #8fc7ea',
                  }}
                />
                区域半径 2.5°
              </span>
            </div>
          </div>

          <div className='y-globe-toolbar'>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => setRecenterSignal(n => n + 1)}
            >
              回到我的位置
            </button>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => {
                setGeoState('idle');
                setCoords(null);
                setGeoError(null);
              }}
            >
              重置定位
            </button>
            <label className='y-toggle'>
              <input
                type='checkbox'
                checked={showMaterials}
                onChange={e => setShowMaterials(e.target.checked)}
              />
              资料点与飞线 {materialCount}
            </label>
            <span className='y-globe-hint'>拖动/滚轮缩放 · 点击城市可切换</span>
          </div>

          <details className='y-disclosure'>
            <summary>地图说明与坐标精度</summary>
            <p>{modeNote}</p>
            <p>
              地球为等距方位投影的示意渲染，城市坐标为近似经纬度，山脉为主要山系的脊线示意，均不用于地理测量。
            </p>
          </details>
        </div>

              <aside
        className={`y-side${sideDir ? ` is-slide-${sideDir}` : ''}`}
        ref={sideRef}
        onTouchStart={onSideTouchStart}
        onTouchEnd={onSideTouchEnd}
        onPointerDown={onSidePointerDown}
        onPointerUp={onSidePointerUp}
        onPointerCancel={onSidePointerCancel}
        onWheel={onSideWheel}
        onPointerEnter={() => setSideHovered(true)}
        onPointerLeave={() => setSideHovered(false)}
        onFocusCapture={() => setSideHovered(true)}
        onBlurCapture={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setSideHovered(false);
          }
        }}
      >
        <div className='y-side-tabs' role='tablist' aria-label='地图信息'>
          {SIDE_TABS.map(k => (
            <button
              key={k}
              type='button'
              role='tab'
              aria-selected={sideTab === k}
              className={sideTab === k ? 'is-on' : ''}
              onClick={() => {
                setSideDir(null);
                setSideTab(k);
                holdManual();
              }}
            >
              {SIDE_TAB_LABEL[k]}
            </button>
          ))}
          {autoOn ? (
            <span
              className={`y-side-auto${autoPaused ? ' is-paused' : ''}`}
              aria-hidden='true'
            >
              <i />
              {autoPaused ? '已暂停' : '自动轮播'}
            </span>
          ) : null}
        </div>

        {sideTab === 'city' ? (
          <div className='y-side-body'>
            <div className='y-card y-city-card'>
              <p className='y-eyebrow'>城市速览 <DataSourceBadge source='city' showLabel={false} /></p>
              <h3>{city.name}</h3>
              <div className='y-stat-grid'>
                <div>
                  <b>{bandOf(city.jobs)}</b>
                  <span>岗位密度</span>
                </div>
                <div>
                  <b>{bandOf(city.cost)}</b>
                  <span>生活成本</span>
                </div>
                <div>
                  <b>{bandOf(avgJobs)}</b>
                  <span>区域均值</span>
                </div>
                <div>
                  <b>{p.s.place}</b>
                  <span>地理维度</span>
                </div>
              </div>
              <p className='y-note'>
                {city.province} · {city.tier} ·{' '}
                {URBAN_LABEL[p.urban]?.n ?? '主城区'}
              </p>
            </div>

            <div className='y-card'>
              <h3>这片区域的构成</h3>
              <Kv
                rows={[
                  ['覆盖城市', pool.map(x => x.name).join('、')],
                  ['岗位密度', `${bandOf(city.jobs)}（区域均值 ${bandOf(avgJobs)}）`],
                  ['生活成本', `${bandOf(city.cost)}（区域均值 ${bandOf(avgCost)}）`],
                  ['你的阶段', stage.name],
                  [
                    '说明',
                    nearby.length
                      ? `该区域内还有 ${nearby.length} 个可选城市，迁移成本通常低于跨区域。`
                      : '蓝圈内暂无其他样本城市，跨城意味着跨区域迁移。',
                  ],
                ]}
              />
              <div className='y-near-list'>
                <div className='y-near-item is-me'>
                  <b>{city.name}</b>
                  <span>
                    当前城市 · 岗位 {bandOf(city.jobs)} · 成本 {bandOf(city.cost)}
                  </span>
                </div>
                {nearby.slice(0, 6).map(x => (
                  <div className='y-near-item' key={x.id}>
                    <b>{x.name}</b>
                    <span>
                      岗位 {bandOf(x.jobs)} · 成本 {bandOf(x.cost)}
                    </span>
                  </div>
                ))}
              </div>
              {nearby.length > 6 ? (
                <p className='y-note' style={{ paddingTop: 5 }}>
                  另有 {nearby.length - 6} 个蓝圈内城市未展开。
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {sideTab === 'talk' ? (
          <div className='y-side-body'>
            {focusMaterial ? (
              <div className='y-card y-focus-material' id='y-map-focus'>
                <div className='y-card-head'>
                  <h3>
                    地图选中 · {focusMaterial.mat.cityName}
                    <span className='y-mini'>点标题打开原文</span>
                  </h3>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    onClick={() => setFocusMaterial(null)}
                  >
                    清除
                  </button>
                </div>
                <LiveCard
                  title={focusMaterial.item.title}
                  type={focusMaterial.item.kind ?? '资料'}
                  author={focusMaterial.item.meta?.split(' · ')[0]}
                  excerpt={focusMaterial.item.quote}
                  url={focusMaterial.item.url}
                />
              </div>
            ) : null}

            <div className='y-card'>
              <h3>
                这座城市的近期讨论
                <DataSourceBadge source='zhihu' showLabel={false} />
                <span className='y-mini'>知乎 CLI · {SNAPSHOT_AT}</span>
              </h3>
              {cityLive.length ? (
                p.field.trim() && !liveRanked.matched ? (
                  <p className='y-note'>
                    未直接提到「{p.field}」，可作本地背景。
                  </p>
                ) : null
              ) : (
                <p className='y-note'>暂无{city.name}的单独检索结果。</p>
              )}
              {liveItems.length ? (
                liveItems.slice(0, 3).map(it => (
                  <LiveCard
                    key={it.url}
                    title={it.title}
                    type={it.type}
                    author={it.author}
                    excerpt={it.excerpt}
                    votes={it.votes}
                    url={it.url}
                  />
                ))
              ) : (
                <Empty>这座城市的近期讨论暂时为空。</Empty>
              )}
            </div>

            <div className='y-card'>
              <h3>
                这片区域的检索情况
                <DataSourceBadge source='zhihu' showLabel={false} />
                <span className='y-mini'>
                  知乎检索 · {city.name}
                  {nearby.length ? ` + 周边 ${nearby.length} 城` : ''}
                </span>
              </h3>
              <p className='y-note'>
                {regionalItems.length
                  ? `${city.name}${
                      nearby.length ? `及蓝圈内 ${nearby.length} 个城市` : ''
                    }的检索结果，已排除上方条目，并按「${
                      p.field || '方向'
                    }」相关度排序。`
                  : '当前城市及周边暂无更多检索结果；不会用固定样例替代。'}
              </p>
              {regionalItems.length ? (
                regionalItems.map(it => (
                  <LiveCard
                    key={it.url}
                    title={it.title}
                    type={it.type}
                    author={it.author}
                    excerpt={it.excerpt}
                    votes={it.votes}
                    url={it.url}
                  />
                ))
              ) : (
                <Empty>这片区域暂无更多可展示的检索结果。</Empty>
              )}
            </div>
          </div>
        ) : null}

        {sideTab === 'peer' ? (
          <div className='y-side-body'>
            <div className='y-card'>
              <h3>
                同阶段的下一步选择
                <DataSourceBadge source='archiveChoice' showLabel={false} />
                <span className='y-mini'>平台归档 · 匿名聚合</span>
              </h3>
              <p className='y-note'>统计归档时的决定，不代表日常行为。</p>
              {choiceLoading ? (
                <p className='y-note'>正在读取同阶段归档统计…</p>
              ) : choiceError ? (
                <>
                  <p className='y-warn'>{choiceError}</p>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    onClick={() => setChoiceTick(t => t + 1)}
                  >
                    重试
                  </button>
                </>
              ) : choiceReady ? (
                <>
                  {choiceSlices.map(s => (
                    <div className='y-peer' key={s.choice}>
                      <div className='y-peer-top'>
                        <b>{s.label}</b>
                        <span>{s.pct}%</span>
                      </div>
                      <div className='y-bar'>
                        <i style={{ width: `${Math.max(2, s.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className='y-note'>
                    样本 n={choiceTotal}
                    {choiceLatest
                      ? ` · 最近更新 ${choiceLatest.slice(0, 10)}`
                      : ''}
                    {' · '}来自平台胜利档案，非人群抽样；同一用户多次归档会多次计入。
                  </p>
                </>
              ) : (
                <p className='y-note'>
                  {choiceTotal
                    ? `已有 ${choiceTotal} 条同阶段归档，少于 5 条，暂不展示占比。`
                    : '当前阶段还没有归档记录。完成一次体验并归档后，这里会出现同阶段的选择分布。'}
                </p>
              )}
              <p className='y-note'>
                仅统计带阶段的归档记录；本次更新前的历史归档未记录阶段，暂不计入。
              </p>
              <button
                type='button'
                className='y-btn y-btn-s'
                style={{ marginTop: 7 }}
                onClick={() => setChoiceTick(t => t + 1)}
              >
                刷新
              </button>
            </div>
          </div>
        ) : null}

        {sideTab === 'geo' ? (
          <div className='y-side-body'>
            <div className='y-card y-geo-card'>
              <p className='y-eyebrow'>精确定位</p>
              <p className='y-note'>{geoStateText}</p>
              {coords && near ? (
                <Kv
                  rows={[
                    [
                      '经纬度',
                      `${coords.lon.toFixed(4)}°E, ${coords.lat.toFixed(4)}°N`,
                    ],
                    [
                      '定位精度',
                      coords.manual
                        ? '手动点选（未校核）'
                        : `±${Math.round(coords.acc)} 米`,
                    ],
                    [
                      '最近样本城市',
                      `${near.city.name}（约 ${Math.round(near.km)} 公里）`,
                    ],
                    [
                      '对模型的影响',
                      near.city.id === p.city
                        ? '与你填写的城市一致，地理维度不变。'
                        : `与填写的「${city.name}」不同；是否改用${near.city.name}由你决定。`,
                    ],
                  ]}
                />
              ) : geoState === 'denied' ? (
                <Kv
                  rows={[
                    ['当前精度', '城市级（由城市与城乡属性导出）'],
                    [
                      '恢复方式',
                      '在浏览器站点权限中允许定位后，再点一次「授权定位」；若页面嵌在预览 iframe 中，父页面未授权时浏览器仍会拒绝，可改用地图点选。',
                    ],
                  ]}
                />
              ) : null}
              <div className='y-row' style={{ marginTop: 7 }}>
                <button
                  type='button'
                  className='y-btn y-btn-s'
                  onClick={requestGeo}
                  disabled={geoState === 'pending'}
                >
                  {geoState === 'pending'
                    ? '定位中…'
                    : coords && !coords.manual
                      ? '重新定位'
                      : '授权定位'}
                </button>
                <button
                  type='button'
                  className='y-btn y-btn-s'
                  onClick={() => setPickMode(v => !v)}
                  aria-pressed={pickMode}
                >
                  {pickMode ? '取消点选' : '在地图上点选'}
                </button>
                {coords ? (
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    onClick={revokeGeo}
                  >
                    撤销
                  </button>
                ) : null}
              </div>
              {pickMode ? (
                <p className='y-note y-pick-hint'>
                  在地图上点击你的实际位置，点选后会自动缩放过去；点选结果只保存在本次会话。
                </p>
              ) : (
                <p className='y-note'>{geoEnvNote}</p>
              )}
              <p className='y-note'>
                坐标仅保存在本次会话内存，不上传、不写入档案。
              </p>
            </div>
          </div>
        ) : null}
      </aside>
      </div>

      <div className='y-nav'>
        <button type='button' className='y-btn' onClick={() => setStep(1)}>
          ← 返回修改信息
        </button>
        <button
          type='button'
          className='y-btn y-btn-main'
          onClick={() => setStep(3)}
        >
          看这一阶段有哪些方向 →
        </button>
      </div>
    </section>
  );
}
