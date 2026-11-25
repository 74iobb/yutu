import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Delaunay } from 'd3-delaunay';

/**
 * 开篇序列：泻水置平地的意象。
 *
 * 水束落下 → 涟漪铺开 → 水面凝成 Voronoi 板块（与四步一一对应）→ 名句浮现。
 * 约 4.7 秒，任意时刻可跳过；每次会话只自动播一次，可从「更多 → 重看开篇」重播。
 *
 * 只用形状与光，不承载数据；种子点全部写死，不引入随机，
 * 保证每次显影的板块几何完全一致。
 */

/** 会话级记录：开播即写入，刷新与切步都不会重复播放 */
const SEEN_KEY = 'yutu.overture.v1';
const PLAY_MS = 4650;
const LEAVE_MS = 350;

type Phase = 'idle' | 'playing' | 'leaving';

/** 圆形水面的圆心与半径；下缘贴住 viewBox 底边，避免被裁出直线 */
const DISC = { cx: 500, cy: 600, r: 300 } as const;

/** 四个板块中心：与四步流程一一对应 */
const PLATE_CENTERS: ReadonlyArray<readonly [number, number, string]> = [
  [350, 470, '处境'],
  [662, 462, '环境'],
  [368, 730, '方向'],
  [668, 722, '闭环'],
];

/** 外围锚点：把中心格推出圆形水面，避免边缘出现细碎三角形 */
const RING: ReadonlyArray<readonly [number, number]> = [
  [110, 380],
  [300, 270],
  [520, 220],
  [760, 250],
  [900, 360],
  [930, 620],
  [860, 860],
  [640, 930],
  [360, 930],
  [140, 860],
  [70, 640],
  [170, 520],
];

const POINTS: [number, number][] = [
  ...PLATE_CENTERS.map(([x, y]) => [x, y] as [number, number]),
  ...RING.map(([x, y]) => [x, y] as [number, number]),
];

/** 模块顶层算一次：确定性、纯函数，不参与渲染 */
const VORONOI = Delaunay.from(POINTS).voronoi([40, 260, 960, 940]);

function cellPath(index: number): string {
  const poly = VORONOI.cellPolygon(index);
  if (!poly) return '';
  return (
    poly
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

const PLATES = PLATE_CENTERS.map(([cx, cy, label], i) => ({
  label,
  cx,
  cy,
  d: cellPath(i),
  fill: [
    'rgba(96, 196, 255, 0.17)',
    'rgba(245, 186, 96, 0.14)',
    'rgba(162, 150, 255, 0.15)',
    'rgba(110, 220, 190, 0.13)',
  ][i],
}));

/** 五颗水珠：错峰下落，比主水束更像真实的倾泻 */
const DROPS = [
  { x: 492, r: 2.3, lift: 360, delay: 0 },
  { x: 509, r: 1.7, lift: 420, delay: 70 },
  { x: 482, r: 1.5, lift: 320, delay: 150 },
  { x: 519, r: 1.6, lift: 470, delay: 235 },
  { x: 500, r: 2, lift: 390, delay: 320 },
];

function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    // index.html 的首帧脚本会把 localStorage 的开关恢复成这个 class
    if (document.documentElement.classList.contains('y-motion-off')) return false;
    return true;
  } catch {
    return false;
  }
}

function seenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * 演示开关：URL 上带 `?overture=1`（普通查询串或 hash 查询串均可）时，
 * 每次刷新都播放，忽略会话记录。例如 `/#/?overture=1`。
 */
function forcedByUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = `${window.location.search}${window.location.hash}`;
    return /(?:^|[?&#])overture=1(?:&|$)/.test(raw);
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 存储不可用时只影响重复播放，不影响本次开篇 */
  }
}

export default function Overture() {
  const [seq, setSeq] = useState<{ id: number; phase: Phase }>(() => {
    const auto = motionAllowed() && (forcedByUrl() || !seenThisSession());
    return { id: auto ? 1 : 0, phase: auto ? 'playing' : 'idle' };
  });

  const skip = useCallback(() => {
    setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
  }, []);

  /** 「更多 → 重看开篇」：手动重播绕过会话记录，但仍尊重减弱动效 */
  useEffect(() => {
    const onReplay = () => {
      if (!motionAllowed()) return;
      setSeq((s) => ({ id: s.id + 1, phase: 'playing' }));
    };
    window.addEventListener('yutu:overture', onReplay);
    return () => window.removeEventListener('yutu:overture', onReplay);
  }, []);

  /** 播放中：写会话记录、锁住页面滚动，到点收场 */
  useEffect(() => {
    if (seq.phase !== 'playing') return;
    markSeen();
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
    }, PLAY_MS);
    return () => {
      window.clearTimeout(timer);
      body.style.overflow = prevOverflow;
    };
  }, [seq.id, seq.phase]);

  /** 淡出结束，整体卸载 */
  useEffect(() => {
    if (seq.phase !== 'leaving') return;
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'leaving' ? { ...s, phase: 'idle' } : s));
    }, LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [seq.id, seq.phase]);

  /** 任意键跳过；Tab 留给键盘导航 */
  useEffect(() => {
    if (seq.phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Tab' ||
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta'
      ) {
        return;
      }
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seq.phase, skip]);

  if (seq.phase === 'idle') return null;

  return (
    <div
      key={seq.id}
      className={`y-overture${seq.phase === 'leaving' ? ' is-leaving' : ''}`}
      onClick={skip}
    >
      <div className='y-ov-scene'>
        <svg
          className='y-ov-art'
          viewBox='0 0 1000 900'
          preserveAspectRatio='xMidYMid meet'
          aria-hidden='true'
          focusable='false'
        >
          <defs>
            <linearGradient id='y-ov-stream' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#8fd4ff' stopOpacity='0' />
              <stop offset='28%' stopColor='#d5efff' stopOpacity='0.9' />
              <stop offset='100%' stopColor='#7cc3ff' stopOpacity='0.35' />
            </linearGradient>
            <radialGradient id='y-ov-pool' cx='50%' cy='50%' r='50%'>
              <stop offset='0%' stopColor='#6fc4ff' stopOpacity='0.2' />
              <stop offset='58%' stopColor='#3d78b8' stopOpacity='0.09' />
              <stop offset='100%' stopColor='#24446f' stopOpacity='0' />
            </radialGradient>
            <radialGradient id='y-ov-flash' cx='50%' cy='50%' r='50%'>
              <stop offset='0%' stopColor='#f2fbff' stopOpacity='0.95' />
              <stop offset='45%' stopColor='#a8e0ff' stopOpacity='0.35' />
              <stop offset='100%' stopColor='#7cc3ff' stopOpacity='0' />
            </radialGradient>
            <clipPath id='y-ov-disc'>
              <circle cx={DISC.cx} cy={DISC.cy} r={DISC.r} />
            </clipPath>
          </defs>

          {/* 水束与水滴：从画面外落到水面中心 */}
          <g className='y-ov-stream'>
            <path
              className='y-ov-fall'
              d='M 500 -80 C 516 120, 484 330, 500 600'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            <path
              className='y-ov-fall y-ov-fall-b'
              d='M 486 -60 C 502 140, 470 330, 492 588'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            {DROPS.map((drop, i) => (
              <circle
                key={i}
                className='y-ov-drop'
                cx={drop.x}
                cy={DISC.cy}
                r={drop.r}
                style={
                  {
                    animationDelay: `${drop.delay}ms`,
                    '--ov-lift': `${drop.lift}px`,
                  } as CSSProperties
                }
              />
            ))}
          </g>

          {/* 水面：圆盘、等高线、涟漪、落点 */}
          <g className='y-ov-pool' clipPath='url(#y-ov-disc)'>
            <circle
              className='y-ov-disc'
              cx={DISC.cx}
              cy={DISC.cy}
              r={DISC.r}
              fill='url(#y-ov-pool)'
            />
            <ellipse
              className='y-ov-contour'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='246'
              ry='214'
            />
            <ellipse
              className='y-ov-contour y-ov-contour-b'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='182'
              ry='156'
            />
            <ellipse
              className='y-ov-contour y-ov-contour-c'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='116'
              ry='98'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-a'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-b'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-flash'
              cx={DISC.cx}
              cy={DISC.cy}
              r='86'
              fill='url(#y-ov-flash)'
            />
            <circle className='y-ov-core' cx={DISC.cx} cy={DISC.cy} r='2.6' />
          </g>

          {/* 板块：真实的 Voronoi 单元，整组缓慢回正 */}
          <g className='y-ov-crust' clipPath='url(#y-ov-disc)'>
            {PLATES.map((plate, i) => (
              <path
                key={plate.label}
                className='y-ov-cell'
                d={plate.d}
                fill={plate.fill}
                style={{ animationDelay: `${1700 + i * 130}ms` }}
              />
            ))}
          </g>

          {/* 板块名：与四步一一对应，不随板块旋转 */}
          <g className='y-ov-labels'>
            {PLATES.map((plate, i) => (
              <g
                key={plate.label}
                className='y-ov-label'
                style={{ animationDelay: `${2600 + i * 95}ms` }}
              >
                <circle cx={plate.cx} cy={plate.cy - 34} r='2.2' />
                <text
                  x={plate.cx}
                  y={plate.cy}
                  textAnchor='middle'
                  dominantBaseline='middle'
                >
                  {plate.label}
                </text>
              </g>
            ))}
          </g>
        </svg>

        <section
          className='y-ov-verse'
          aria-label='开篇引言：泻水置平地，各自东西南北流'
        >
          <p className='y-ov-line y-ov-line-a'>泻水置平地</p>
          <p className='y-ov-line y-ov-line-b'>各自东西南北流</p>
          <p className='y-ov-sub'>流向不同，不等于走错</p>
        </section>
      </div>

      <button
        type='button'
        className='y-ov-skip'
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        跳过 <span aria-hidden='true'>›</span>
      </button>
    </div>
  );
}
