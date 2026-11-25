import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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

/**
 * 应用级记录：页面加载后第一次进入主流程时自动播一次。
 * 用模块变量而不是 sessionStorage —— 刷新会重置、重新开场；
 * 在 SPA 内从沙盘返回首页则不会重复打扰。
 */
let autoPlayed = false;
/** 名句逐字读完、小字落定后再退潮（落水与铺开占前 3.3s） */
const PLAY_MS = 7500;
/** 退潮 + 系统显影的总时长 */
const LEAVE_MS = 1150;
/** 朗诵与低频轰鸣的起点，略早于名句浮现 */
const NARRATE_AT = 4420;

/** 名句逐字出现：`start` 为这一行的起始秒数，字与字之间间隔 0.11s */
const VERSE_LINES = [
  { text: '泻水置平地', start: 4.5 },
  { text: '各自东西南北流', start: 5.55 },
] as const;

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

/** 离场时四个板块「各自东西南北流」的方向，与各自所在象限一致 */
const PLATES = PLATE_CENTERS.map(([cx, cy, label], i) => ({
  label,
  cx,
  cy,
  d: cellPath(i),
  dx: [-190, 190, -190, 190][i],
  dy: [-128, -128, 128, 128][i],
  fill: [
    'rgba(96, 196, 255, 0.17)',
    'rgba(245, 186, 96, 0.14)',
    'rgba(162, 150, 255, 0.15)',
    'rgba(110, 220, 190, 0.13)',
  ][i],
}));

/**
 * 确定性伪随机（固定公式，不调用 Math.random）：
 * 同一序号每次得到同一个值，保证每次开场的水粒分布完全一致。
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** 下落粒子：每 5 颗里 1 条速度线，其余是水珠；错峰持续约 1.3s */
const FALL_PARTICLES = Array.from({ length: 56 }, (_, i) => {
  const a = noise(i * 3 + 1);
  const b = noise(i * 3 + 2);
  const c = noise(i * 3 + 3);
  return {
    x: 500 + (a - 0.5) * 86,
    r: 0.55 + b * 1.9,
    lift: 470 + c * 300,
    drift: (a - 0.5) * 30,
    delay: Math.round(b * 1800),
    duration: Math.round(720 + c * 600),
    line: i % 5 === 0,
  };
});

/** 落点溅水：从水面向两侧上方抛起的水星 */
const SPLASH_PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const a = noise(i * 5 + 100);
  const b = noise(i * 5 + 101);
  const dir = i % 2 === 0 ? -1 : 1;
  return {
    sx: dir * (22 + a * 96),
    sy: -(16 + b * 62),
    r: 0.6 + a * 1.3,
    delay: Math.round(1350 + b * 1050),
    duration: Math.round(720 + a * 380),
  };
});

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

/** 读取 URL 上的布尔开关（普通查询串或 hash 查询串均可） */
function readFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = `${window.location.search}${window.location.hash}`;
    return new RegExp(`(?:^|[?&#])${name}=1(?:&|$)`).test(raw);
  } catch {
    return false;
  }
}

/**
 * 演示开关：`?overture=1` 每次刷新都播；`?demo=1` 同时进入路演模式。
 * 例如 `/#/?demo=1`。
 */
function forcedByUrl(): boolean {
  return readFlag('overture') || readFlag('demo');
}

/** `?narrate=0` 可静音；默认朗读 */
function narrationAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !/[?&]narrate=0(?:&|$)/.test(
      `${window.location.search}${window.location.hash}`
    );
  } catch {
    return true;
  }
}

/**
 * 用浏览器自带的语音合成朗诵两句。
 * 优先低音的中文男声；不支持、没有中文嗓音或被自动播放策略拦截时静默降级，
 * 画面本身不受影响。
 */
function speakVerse(): void {
  try {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices();
    const zh = voices.filter((v) => /^zh/i.test(v.lang));
    const cn = zh.filter((v) => /CN|Hans/i.test(v.lang));
    const pool = cn.length ? cn : zh;
    const preferred =
      pool.find((v) => /Yunjian|Yunxi|Kangkang|Male|男/i.test(v.name)) ??
      pool[0];
    const u = new SpeechSynthesisUtterance(
      '泻水置平地。各自东西南北流。'
    );
    u.lang = 'zh-CN';
    if (preferred) u.voice = preferred;
    u.rate = 0.84;
    u.pitch = 0.82;
    u.volume = 1;
    synth.speak(u);
  } catch {
    /* 静默：保留纯视觉版本 */
  }
}

function stopVerse(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** 名句落定前的一次低频轰鸣，给「落地」一点重量；被拦截时静默 */
function playImpact(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(56, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 2.6);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.9);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    /* 静默 */
  }
}

export default function Overture() {
  const [seq, setSeq] = useState<{ id: number; phase: Phase }>(() => {
    let auto = false;
    if (motionAllowed()) {
      if (forcedByUrl()) {
        auto = true;
      } else if (!autoPlayed) {
        autoPlayed = true;
        auto = true;
      }
    }
    return { id: auto ? 1 : 0, phase: auto ? 'playing' : 'idle' };
  });

  /** 声音开关：默认开；浏览器拦截自动播放时，点一下即可补上朗诵 */
  const [soundOn, setSoundOn] = useState(() => {
    try {
      if (!narrationAllowed()) return false;
      return window.localStorage.getItem('yutu.overture.sound') !== '0';
    } catch {
      return narrationAllowed();
    }
  });
  const soundRef = useRef(soundOn);
  /** 路演模式：强制有声、并显示一枚小标签；由「更多 → 路演模式」或 `?demo=1` 触发 */
  const [demo, setDemo] = useState(() => readFlag('demo'));
  const demoRef = useRef(demo);

  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    try {
      window.localStorage.setItem('yutu.overture.sound', next ? '1' : '0');
    } catch {
      /* 存储不可用时只影响下次打开 */
    }
    if (next) {
      playImpact();
      speakVerse();
    } else {
      stopVerse();
      /* 手动静音即退出「强制有声」，但路演标记保留 */
      demoRef.current = false;
    }
  }, []);

  const skip = useCallback(() => {
    stopVerse();
    setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
  }, []);

  /** 「更多 → 重看开篇」：手动重播绕过会话记录，但仍尊重减弱动效 */
  useEffect(() => {
    const onReplay = (e: Event) => {
      if (!motionAllowed()) return;
      const nextDemo = Boolean(
        (e as CustomEvent<{ demo?: boolean }>).detail?.demo
      );
      demoRef.current = nextDemo;
      setDemo(nextDemo);
      setSeq((s) => ({ id: s.id + 1, phase: 'playing' }));
    };
    window.addEventListener('yutu:overture', onReplay);
    return () => {
      window.removeEventListener('yutu:overture', onReplay);
      stopVerse();
    };
  }, []);

  /** 播放中：写会话记录、锁住页面滚动，到点收场 */
  useEffect(() => {
    if (seq.phase !== 'playing') return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
    }, PLAY_MS);
    /* 名句浮现前读诗；自然退潮不打断，留一点余音 */
    const voiceTimer = window.setTimeout(() => {
      if (!narrationAllowed()) return;
      if (!soundRef.current && !demoRef.current) return;
      playImpact();
      speakVerse();
    }, NARRATE_AT);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(voiceTimer);
      body.style.overflow = prevOverflow;
    };
  }, [seq.id, seq.phase]);

  /**
   * 退潮：水向四周散开、背景褪去，系统从下面显形。
   * 给 #yutu2 加一次性显影动画；卸载时移除，避免影响之后的切步。
   */
  useEffect(() => {
    if (seq.phase !== 'leaving') return;
    const shell = document.getElementById('yutu2');
    shell?.classList.add('y-ov-reveal');
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'leaving' ? { ...s, phase: 'idle' } : s));
    }, LEAVE_MS);
    return () => {
      window.clearTimeout(timer);
      shell?.classList.remove('y-ov-reveal');
    };
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
              className='y-ov-ripple y-ov-ripple-c'
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
                style={{ animationDelay: `${3000 + i * 140}ms` }}
              />
            ))}
          </g>

          {/* 水束与粒子：从画面外持续落到水面，覆盖在板块表面 */}
          <g className='y-ov-stream'>
            <path
              className='y-ov-fall'
              d='M 500 -140 C 518 120, 482 340, 500 600'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            <path
              className='y-ov-fall y-ov-fall-b'
              d='M 486 -100 C 504 140, 468 340, 492 588'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            <path
              className='y-ov-fall y-ov-fall-c'
              d='M 514 -160 C 524 160, 486 360, 506 604'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            {FALL_PARTICLES.map((p, i) => {
              const style = {
                animationDelay: `${p.delay}ms`,
                '--ov-lift': `${p.lift}px`,
                '--ov-drift': `${p.drift}px`,
                '--ov-dur': `${p.duration}ms`,
              } as CSSProperties;
              return p.line ? (
                <ellipse
                  key={i}
                  className='y-ov-particle y-ov-particle-line'
                  cx={p.x}
                  cy={DISC.cy}
                  rx={0.65}
                  ry={p.r * 2.6}
                  style={style}
                />
              ) : (
                <circle
                  key={i}
                  className='y-ov-particle'
                  cx={p.x}
                  cy={DISC.cy}
                  r={p.r}
                  style={style}
                />
              );
            })}
            {SPLASH_PARTICLES.map((p, i) => (
              <circle
                key={i}
                className='y-ov-splash'
                cx={DISC.cx}
                cy={DISC.cy}
                r={p.r}
                style={
                  {
                    animationDelay: `${p.delay}ms`,
                    '--ov-sx': `${p.sx}px`,
                    '--ov-sy': `${p.sy}px`,
                    '--ov-sdur': `${p.duration}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </g>

          {/* 板块名：与四步一一对应，不随板块旋转 */}
          <g className='y-ov-labels'>
            {PLATES.map((plate, i) => (
              <g
                key={plate.label}
                className='y-ov-label'
                style={
                  {
                    '--ov-delay': `${3750 + i * 95}ms`,
                    '--ov-dx': `${plate.dx}px`,
                    '--ov-dy': `${plate.dy}px`,
                  } as CSSProperties
                }
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
          {VERSE_LINES.map((line) => (
            <p className='y-ov-line' key={line.text}>
              {Array.from(line.text).map((ch, i) => (
                <span
                  key={i}
                  className='y-ov-char'
                  style={
                    {
                      '--i': i,
                      '--start': line.start,
                    } as CSSProperties
                  }
                >
                  {ch}
                </span>
              ))}
            </p>
          ))}
          <p className='y-ov-sub'>流向不同，不等于走错</p>
        </section>
      </div>

      {demo ? (
        <span className='y-ov-demo' aria-hidden='true'>
          路演模式
        </span>
      ) : null}

      <div className='y-ov-controls'>
        <button
          type='button'
          className='y-ov-sound'
          aria-pressed={soundOn}
          title={soundOn ? '关闭朗诵与低频' : '开启朗诵与低频'}
          onClick={(e) => {
            e.stopPropagation();
            toggleSound();
          }}
        >
          <i
            className={`y-ov-sound-dot${soundOn ? ' is-on' : ''}`}
            aria-hidden='true'
          />
          声音 {soundOn ? '开' : '关'}
        </button>
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
    </div>
  );
}
