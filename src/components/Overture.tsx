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
/** 名句落定后开始退潮（落水与粒子占前 2.4s） */
const PLAY_MS = 4950;
/** 退潮 + 系统显影的总时长 */
const LEAVE_MS = 1150;

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
    delay: Math.round(b * 1250),
    duration: Math.round(620 + c * 520),
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
    delay: Math.round(1180 + b * 780),
    duration: Math.round(680 + a * 360),
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
                style={{ animationDelay: `${2150 + i * 130}ms` }}
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
                    '--ov-delay': `${2950 + i * 95}ms`,
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
