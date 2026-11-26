import { useEffect, useId, useRef } from 'react';
import { DIMS } from '@/lib/model';
import type { Scores } from '@/types';

interface GrowthRadarProps {
  /** 起点快照（第一次离开「填写信息」时的七维） */
  before: Scores;
  /** 当前处境 */
  after: Scores;
  beforeLabel?: string;
  afterLabel?: string;
  /** 紧凑模式：缩小图幅、隐藏右下角说明 */
  compact?: boolean;
}

const CX = 170;
const CY = 150;
const R = 104;
const LEVELS = [0.25, 0.5, 0.75, 1];

/** 把某一维映射到 0–1（年龄按 18–45 归一，其余 0–100） */
function norm(v: number, min: number, max: number) {
  const span = Math.max(1, max - min);
  return Math.max(0, Math.min(1, (v - min) / span));
}

function pointAt(index: number, ratio: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMS.length;
  return {
    x: CX + Math.cos(angle) * R * ratio,
    y: CY + Math.sin(angle) * R * ratio,
  };
}

function polygonPath(s: Scores) {
  return (
    DIMS.map((d, i) => {
      const p = pointAt(i, norm(s[d.k], d.min, d.max));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + ' Z'
  );
}

function labelAnchor(x: number) {
  if (Math.abs(x - CX) < 6) return 'middle';
  return x > CX ? 'start' : 'end';
}

const RAD = Math.PI / 180;

function polar(deg: number, r: number) {
  return {
    x: CX + Math.cos(deg * RAD) * r,
    y: CY + Math.sin(deg * RAD) * r,
  };
}

/** 扫描线后面的彩色波尾：一个随扫描线旋转的柔光扇形 */
function sweepTailPath(spanDeg: number) {
  const rr = R * 0.96;
  const tip = polar(-90, rr);
  const tail = polar(-90 - spanDeg, rr);
  return (
    `M${CX},${CY} L${tip.x.toFixed(1)},${tip.y.toFixed(1)} ` +
    `A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 0 ${tail.x.toFixed(1)},${tail.y.toFixed(1)} Z`
  );
}

/** 七彩：高饱和彩虹色（正常混合下更艳，不被屏幕混合冲淡） */
const RAINBOW = [
  '#ff3b6b',
  '#ff7a45',
  '#ffcf4d',
  '#3fe8a0',
  '#35cfff',
  '#4f7dff',
  '#a96bff',
] as const;

/** 把颜色往白色里调，用作瓣尖高光 */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return (
    '#' +
    [mix(r), mix(g), mix(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

const RAINBOW_TIP = RAINBOW.map((c) => tint(c, 0.48));

/** 彩绘玻璃颗粒：预先栅格化的噪点图，用 pattern 平铺，避免逐帧跑 SVG 滤镜 */
const GRAIN_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E";

/** 单片花瓣：从花心到瓣尖的两段二次曲线，spread 控制宽窄、sway 控制摆动 */
function petalPath(
  angleDeg: number,
  len: number,
  spreadDeg: number,
  sway: number
) {
  const tip = polar(angleDeg + sway, len);
  const c1 = polar(angleDeg - spreadDeg + sway * 0.4, len * 0.58);
  const c2 = polar(angleDeg + spreadDeg + sway * 0.4, len * 0.58);
  return (
    `M${CX},${CY} ` +
    `Q${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)} ` +
    `Q${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${CX},${CY} Z`
  );
}

/** 三圈花瓣：外 7 / 中 5 / 内 9，颜色与旋向错开 */
const ALL_PETAL_RINGS = [
  { count: 7, k: 0.96, spread: 30, phase: 0, spin: 4.5, tone: 0, wave: 0.16 },
  { count: 5, k: 0.64, spread: 38, phase: 36, spin: -6, tone: 3, wave: 0.2 },
  { count: 9, k: 0.44, spread: 20, phase: 20, spin: 7, tone: 5, wave: 0.14 },
] as const;

/** 手机 / 低配设备去掉最内圈，减少逐帧重算 */
const LIGHT_DEVICE =
  (typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(max-width: 640px)').matches)) ||
  (typeof navigator !== 'undefined' &&
    ((navigator.hardwareConcurrency ?? 8) <= 4 ||
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <=
        4));

const PETAL_RINGS: ReadonlyArray<(typeof ALL_PETAL_RINGS)[number]> =
  LIGHT_DEVICE ? ALL_PETAL_RINGS.slice(0, 2) : ALL_PETAL_RINGS;

const PETAL_OFFSETS: number[] = [];
{
  let acc = 0;
  PETAL_RINGS.forEach((ring) => {
    PETAL_OFFSETS.push(acc);
    acc += ring.count;
  });
}

/**
 * 「起点 → 现在」七维雷达对比。
 * 越靠外表示该维数值越高；颜色不表示好坏，只区分两个时间点。
 */
export default function GrowthRadar({
  before,
  after,
  beforeLabel = '起点',
  afterLabel = '现在',
  compact = false,
}: GrowthRadarProps) {
  const uid = useId().replace(/:/g, '');
  /* 花瓣与每瓣的渐变向量逐帧重算，让花边开合边旋转、瓣尖始终亮 */
  const petalRefs = useRef<(SVGPathElement | null)[]>([]);
  const petalGradRefs = useRef<(SVGLinearGradientElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let alive = true;
    let last = 0;
    const tick = (now: number) => {
      if (!alive) return;
      /* 30fps 足够顺滑，也避免多个雷达同时动画时吃满 CPU */
      if (now - last >= 33) {
        last = now;
        if (!document.documentElement.classList.contains('y-motion-off')) {
          const t = now / 1000;
          PETAL_RINGS.forEach((ring, ri) => {
            for (let i = 0; i < ring.count; i += 1) {
              const idx = PETAL_OFFSETS[ri] + i;
              const angle =
                (360 / ring.count) * i + ring.phase + t * ring.spin;
              const len =
                R *
                ring.k *
                (1 -
                  ring.wave +
                  ring.wave *
                    (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7 + ri)));
              const sway = Math.sin(t * 0.8 + i * 1.3 + ri) * 5;
              petalRefs.current[idx]?.setAttribute(
                'd',
                petalPath(angle, len, ring.spread, sway)
              );
              const tip = polar(angle + sway, len);
              const grad = petalGradRefs.current[idx];
              grad?.setAttribute('x2', tip.x.toFixed(1));
              grad?.setAttribute('y2', tip.y.toFixed(1));
            }
          });
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const changed = DIMS.filter((d) => before[d.k] !== after[d.k]);
  const deltaText = DIMS.map((d) => ({
    ...d,
    delta: after[d.k] - before[d.k],
  })).filter((d) => d.delta !== 0);
  /* 变化最大的一维：轴线和标签加亮，让视线先落在它上面 */
  let shiftIndex = -1;
  let shiftAbs = 0;
  DIMS.forEach((d, i) => {
    const abs = Math.abs(after[d.k] - before[d.k]);
    if (abs > shiftAbs) {
      shiftAbs = abs;
      shiftIndex = i;
    }
  });

  return (
    <figure className={`y-radar${compact ? ' is-compact' : ''}`}>
      <svg
        viewBox='0 0 340 300'
        role='img'
        aria-label={`${beforeLabel}与${afterLabel}的七维雷达对比，${changed.length} 个维度发生变化`}
      >
        <defs>
          <radialGradient id={`${uid}-after`} cx='50%' cy='50%' r='62%'>
            <stop offset='0%' stopColor='#7ec8ff' stopOpacity='0.34' />
            <stop offset='70%' stopColor='#7ec8ff' stopOpacity='0.12' />
            <stop offset='100%' stopColor='#b9a8ff' stopOpacity='0.05' />
          </radialGradient>
          <linearGradient id={`${uid}-before`} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#f0b25a' stopOpacity='0.16' />
            <stop offset='100%' stopColor='#f0b25a' stopOpacity='0.02' />
          </linearGradient>
          <filter id={`${uid}-glow`} x='-40%' y='-40%' width='180%' height='180%'>
            <feGaussianBlur stdDeviation='2.6' result='blur' />
            <feMerge>
              <feMergeNode in='blur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
          <radialGradient id={`${uid}-core`} cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#bfe3ff' stopOpacity='0.85' />
            <stop offset='100%' stopColor='#7ec8ff' stopOpacity='0' />
          </radialGradient>
          {/* 扫描线背后的彩色波尾：青 → 蓝 → 紫 → 金 */}
          <linearGradient id={`${uid}-trail`} x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='#7ee8c8' stopOpacity='0.6' />
            <stop offset='38%' stopColor='#7ec8ff' stopOpacity='0.45' />
            <stop offset='70%' stopColor='#b9a8ff' stopOpacity='0.34' />
            <stop offset='100%' stopColor='#f0b25a' stopOpacity='0' />
          </linearGradient>
          {/* 3D 缎带：暗边 → 亮面 → 冷色 → 暖色，制造体积与反光 */}
          <linearGradient id={`${uid}-ribbon`} x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='#10404f' stopOpacity='0.2' />
            <stop offset='16%' stopColor='#7ee8c8' stopOpacity='0.6' />
            <stop offset='36%' stopColor='#e8fbff' stopOpacity='0.95' />
            <stop offset='54%' stopColor='#7ec8ff' stopOpacity='0.85' />
            <stop offset='74%' stopColor='#b9a8ff' stopOpacity='0.62' />
            <stop offset='90%' stopColor='#f0b25a' stopOpacity='0.4' />
            <stop offset='100%' stopColor='#f0b25a' stopOpacity='0.06' />
          </linearGradient>
          <linearGradient id={`${uid}-ribbon-dark`} x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='#082a36' stopOpacity='0.3' />
            <stop offset='40%' stopColor='#2c6f8a' stopOpacity='0.5' />
            <stop offset='78%' stopColor='#5b4f8a' stopOpacity='0.38' />
            <stop offset='100%' stopColor='#7a5a2a' stopOpacity='0.18' />
          </linearGradient>
          {/* 缎带亮芯：让中轴像被灯打亮，强化圆柱感 */}
          <linearGradient id={`${uid}-ribbon-core`} x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='#ffffff' stopOpacity='0.12' />
            <stop offset='42%' stopColor='#f2ffff' stopOpacity='0.8' />
            <stop offset='72%' stopColor='#e6f2ff' stopOpacity='0.5' />
            <stop offset='100%' stopColor='#ffffff' stopOpacity='0.05' />
          </linearGradient>
          {/* 背景柔光、中心压暗与玻璃高光 */}
          <radialGradient id={`${uid}-bloom-glow`} cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#a96bff' stopOpacity='0.3' />
            <stop offset='55%' stopColor='#35cfff' stopOpacity='0.14' />
            <stop offset='100%' stopColor='#35cfff' stopOpacity='0' />
          </radialGradient>
          <radialGradient id={`${uid}-bloom-shade`} cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#071426' stopOpacity='0.72' />
            <stop offset='52%' stopColor='#071426' stopOpacity='0.24' />
            <stop offset='100%' stopColor='#071426' stopOpacity='0' />
          </radialGradient>
          <linearGradient id={`${uid}-bloom-sheen`} x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='#ffffff' stopOpacity='0' />
            <stop offset='44%' stopColor='#ffffff' stopOpacity='0.2' />
            <stop offset='56%' stopColor='#ffffff' stopOpacity='0.2' />
            <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
          </linearGradient>
          {/* 彩绘玻璃颗粒：平铺的静态噪点，只覆盖花瓣区域 */}
          <pattern
            id={`${uid}-grain`}
            width='120'
            height='120'
            patternUnits='userSpaceOnUse'
          >
            <image
              href={GRAIN_URI}
              xlinkHref={GRAIN_URI}
              width='120'
              height='120'
            />
          </pattern>
          {/* 每片花瓣各自的「瓣根深、瓣尖亮」渐变 */}
          {PETAL_RINGS.map((ring, ri) =>
            Array.from({ length: ring.count }, (_, i) => {
              const idx = PETAL_OFFSETS[ri] + i;
              const angle = (360 / ring.count) * i + ring.phase;
              const len =
                R *
                ring.k *
                (1 -
                  ring.wave +
                  ring.wave * (0.5 + 0.5 * Math.sin(i * 1.7 + ri)));
              const tip = polar(angle + Math.sin(i * 1.3) * 5, len);
              const color = RAINBOW[(i + ring.tone) % RAINBOW.length];
              const tipColor =
                RAINBOW_TIP[(i + ring.tone) % RAINBOW_TIP.length];
              return (
                <linearGradient
                  key={`pg-${ri}-${i}`}
                  id={`${uid}-pg-${ri}-${i}`}
                  gradientUnits='userSpaceOnUse'
                  x1={CX}
                  y1={CY}
                  x2={tip.x}
                  y2={tip.y}
                  ref={(el) => {
                    petalGradRefs.current[idx] = el;
                  }}
                >
                  <stop offset='0%' stopColor={color} stopOpacity='0.88' />
                  <stop offset='62%' stopColor={color} stopOpacity='0.82' />
                  <stop offset='92%' stopColor={tipColor} stopOpacity='0.96' />
                  <stop offset='100%' stopColor='#ffffff' stopOpacity='0.45' />
                </linearGradient>
              );
            })
          )}
          {/* 花蕊：暖白金到透明 */}
          <radialGradient id={`${uid}-flower-core`} cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#fff8e6' stopOpacity='0.95' />
            <stop offset='42%' stopColor='#ffd93d' stopOpacity='0.55' />
            <stop offset='100%' stopColor='#ff8a3d' stopOpacity='0' />
          </radialGradient>
        </defs>

        {/* 背景：三圈七彩花瓣，边走边开合、边旋转 */}
        <g className='y-radar-bloom' aria-hidden='true'>
          <circle
            className='y-radar-bloom-glow'
            cx={CX}
            cy={CY}
            r={R * 1.08}
            fill={`url(#${uid}-bloom-glow)`}
          />
          {PETAL_RINGS.map((ring, ri) =>
            Array.from({ length: ring.count }, (_, i) => {
              const idx = PETAL_OFFSETS[ri] + i;
              const angle = (360 / ring.count) * i + ring.phase;
              const len =
                R *
                ring.k *
                (1 -
                  ring.wave +
                  ring.wave * (0.5 + 0.5 * Math.sin(i * 1.7 + ri)));
              return (
                <path
                  key={`${ri}-${i}`}
                  ref={(el) => {
                    petalRefs.current[idx] = el;
                  }}
                  className={`y-radar-petal is-${ri}`}
                  d={petalPath(angle, len, ring.spread, Math.sin(i * 1.3) * 5)}
                  fill={`url(#${uid}-pg-${ri}-${i})`}
                />
              );
            })
          )}
          <circle
            className='y-radar-flower-core'
            cx={CX}
            cy={CY}
            r={R * 0.14}
            fill={`url(#${uid}-flower-core)`}
          />
          {Array.from({ length: 12 }, (_, i) => {
            const p = polar(i * 30, R * 0.18);
            return (
              <circle
                key={`st-${i}`}
                className='y-radar-stamen'
                cx={p.x}
                cy={p.y}
                r={1.5}
                fill={RAINBOW[i % RAINBOW.length]}
              />
            );
          })}
          <circle
            className='y-radar-bloom-shade'
            cx={CX}
            cy={CY}
            r={R * 1.02}
            fill={`url(#${uid}-bloom-shade)`}
          />
          <ellipse
            className='y-radar-bloom-sheen'
            cx={CX}
            cy={CY}
            rx={R * 0.92}
            ry={R * 0.42}
            fill={`url(#${uid}-bloom-sheen)`}
          />
          <circle
            className='y-radar-bloom-grain'
            cx={CX}
            cy={CY}
            r={R}
            fill={`url(#${uid}-grain)`}
          />
          <circle
            className='y-radar-bloom-ring'
            cx={CX}
            cy={CY}
            r={R}
            fill='none'
          />
        </g>

        {/* 网格 */}
        {LEVELS.map((lv) => (
          <path
            key={lv}
            d={DIMS.map((_, i) => {
              const p = pointAt(i, lv);
              return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ') + ' Z'}
            className='y-radar-grid'
          />
        ))}
        {/* 轴线 */}
        {DIMS.map((d, i) => {
          const p = pointAt(i, 1);
          return (
            <line
              key={d.k}
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              className={`y-radar-axis${i === shiftIndex ? ' is-shift' : ''}`}
            />
          );
        })}

        {/* 扫描线：一圈 10s，纯装饰，关闭动效后隐藏 */}
        <g
          className='y-radar-sweep'
          aria-hidden='true'
          filter={`url(#${uid}-glow)`}
        >
          {/* 扫描线尾部只留一层柔光扇形，缎带已经移到背景 */}
          <path
            className='y-radar-wave-glass'
            d={sweepTailPath(62)}
            fill={`url(#${uid}-trail)`}
          />
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - R}
            className='y-radar-sweep-line'
          />
          <circle
            cx={CX}
            cy={CY - R}
            r={2.6}
            className='y-radar-sweep-dot'
          />
        </g>

        <circle cx={CX} cy={CY} r={26} fill={`url(#${uid}-core)`} opacity={0.5} />
        <circle cx={CX} cy={CY} r={2.4} className='y-radar-core' />

        {/* 起点 */}
        <path
          d={polygonPath(before)}
          className='y-radar-area is-before'
          style={{ fill: `url(#${uid}-before)` }}
        />
        {/* 现在 */}
        <path
          d={polygonPath(after)}
          pathLength={1}
          className='y-radar-area is-after y-radar-draw'
          style={{ fill: `url(#${uid}-after)` }}
          filter={`url(#${uid}-glow)`}
        />

        {/* 顶点 */}
        {DIMS.map((d, i) => {
          const a = pointAt(i, norm(after[d.k], d.min, d.max));
          const b = pointAt(i, norm(before[d.k], d.min, d.max));
          return (
            <g key={d.k}>
              <circle cx={b.x} cy={b.y} r={2.6} className='y-radar-dot is-before' />
              <circle
                cx={a.x}
                cy={a.y}
                r={i === shiftIndex ? 3.6 : 2.8}
                className={`y-radar-dot is-after${i === shiftIndex ? ' is-shift' : ''}`}
              />
            </g>
          );
        })}

        {/* 维度标签 */}
        {DIMS.map((d, i) => {
          const p = pointAt(i, 1.22);
          const value = after[d.k];
          return (
            <g key={d.k}>
              <text
                x={p.x}
                y={p.y}
                textAnchor={labelAnchor(p.x)}
                className={`y-radar-label${i === shiftIndex ? ' is-shift' : ''}`}
              >
                {d.n}
              </text>
              <text
                x={p.x}
                y={p.y + 13}
                textAnchor={labelAnchor(p.x)}
                className='y-radar-value'
              >
                {value}
                {d.unit || ''}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption>
        <div className='y-radar-legend'>
          <span>
            <i className='is-before' /> {beforeLabel}
          </span>
          <span>
            <i className='is-after' /> {afterLabel}
          </span>
        </div>
        {deltaText.length ? (
          <div className='y-radar-deltas'>
            {deltaText.map((d) => (
              <span
                key={d.k}
                className={d.delta > 0 ? 'is-up' : 'is-down'}
                title={`${d.n}：${before[d.k]} → ${after[d.k]}`}
              >
                {d.n}
                {d.delta > 0 ? '+' : ''}
                {d.delta}
                {d.unit || ''}
              </span>
            ))}
          </div>
        ) : (
          <p className='y-radar-flat'>两个时间点的七维完全一致</p>
        )}
        {!compact ? (
          <p className='y-radar-note'>
            越靠外表示该维数值越高；颜色只区分时间点，不代表好坏。起点在首次进入第 2
            步时固定，之后不随修改回填。
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
