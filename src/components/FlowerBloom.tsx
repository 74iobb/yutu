import { useEffect, useId, useRef } from 'react';

/**
 * 彩虹花背景：三圈花瓣（7 / 5 / 9）绕中心开合、旋转，
 * 每片花瓣带「瓣根深、瓣尖亮」的独立渐变，叠加柔光、中心压暗、
 * 玻璃高光与彩绘玻璃颗粒。七维雷达与闭环图共用同一套效果。
 *
 * 纯装饰：aria-hidden，不参与命中。花瓣逐帧用 rAF 直接改 `d`，
 * 不触发 React 重渲染；reduced-motion 下保持静态。
 */
const COLORS = [
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

const TIP = COLORS.map((c) => tint(c, 0.48));

/** 彩绘玻璃颗粒：预栅格化的噪点图，用 pattern 平铺，避免逐帧跑滤镜 */
const GRAIN_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E";

const RAD = Math.PI / 180;

interface Ring {
  count: number;
  k: number;
  spread: number;
  phase: number;
  spin: number;
  tone: number;
  wave: number;
}

/** 三圈花瓣：外 7 / 中 5 / 内 9，颜色与旋向错开 */
const ALL_RINGS: ReadonlyArray<Ring> = [
  { count: 7, k: 0.96, spread: 30, phase: 0, spin: 4.5, tone: 0, wave: 0.16 },
  { count: 5, k: 0.64, spread: 38, phase: 36, spin: -6, tone: 3, wave: 0.2 },
  { count: 9, k: 0.44, spread: 20, phase: 20, spin: 7, tone: 5, wave: 0.14 },
];

/** 手机 / 低配设备去掉最内圈，减少逐帧重算 */
const LIGHT_DEVICE =
  (typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(max-width: 640px)').matches)) ||
  (typeof navigator !== 'undefined' &&
    ((navigator.hardwareConcurrency ?? 8) <= 4 ||
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <=
        4));

const RINGS = LIGHT_DEVICE ? ALL_RINGS.slice(0, 2) : ALL_RINGS;

const OFFSETS: number[] = [];
{
  let acc = 0;
  RINGS.forEach((ring) => {
    OFFSETS.push(acc);
    acc += ring.count;
  });
}

/** 单片花瓣：从花心到瓣尖的两段二次曲线 */
function petalPath(
  cx: number,
  cy: number,
  angleDeg: number,
  len: number,
  spreadDeg: number,
  sway: number
) {
  const at = (deg: number, r: number) => ({
    x: cx + Math.cos(deg * RAD) * r,
    y: cy + Math.sin(deg * RAD) * r,
  });
  const tip = at(angleDeg + sway, len);
  const c1 = at(angleDeg - spreadDeg + sway * 0.4, len * 0.58);
  const c2 = at(angleDeg + spreadDeg + sway * 0.4, len * 0.58);
  return (
    `M${cx},${cy} ` +
    `Q${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)} ` +
    `Q${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${cx},${cy} Z`
  );
}

function petalLen(ring: Ring, r: number, i: number, ri: number, t: number) {
  return (
    r *
    ring.k *
    (1 - ring.wave + ring.wave * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7 + ri)))
  );
}

function petalSway(i: number, ri: number, t: number) {
  return Math.sin(t * 0.8 + i * 1.3 + ri) * 5;
}

interface Props {
  /** 花心坐标（当前 SVG 的用户坐标） */
  cx: number;
  cy: number;
  /** 花半径 */
  r: number;
}

export default function FlowerBloom({ cx, cy, r }: Props) {
  const uid = useId().replace(/:/g, '');
  const petalRefs = useRef<(SVGPathElement | null)[]>([]);
  const gradRefs = useRef<(SVGLinearGradientElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let alive = true;
    let last = 0;
    const tick = (now: number) => {
      if (!alive) return;
      if (now - last >= 33) {
        last = now;
        if (!document.documentElement.classList.contains('y-motion-off')) {
          const t = now / 1000;
          RINGS.forEach((ring, ri) => {
            for (let i = 0; i < ring.count; i += 1) {
              const idx = OFFSETS[ri] + i;
              const angle =
                (360 / ring.count) * i + ring.phase + t * ring.spin;
              const len = petalLen(ring, r, i, ri, t);
              const sway = petalSway(i, ri, t);
              petalRefs.current[idx]?.setAttribute(
                'd',
                petalPath(cx, cy, angle, len, ring.spread, sway)
              );
              const tipX = cx + Math.cos((angle + sway) * RAD) * len;
              const tipY = cy + Math.sin((angle + sway) * RAD) * len;
              const grad = gradRefs.current[idx];
              grad?.setAttribute('x2', tipX.toFixed(1));
              grad?.setAttribute('y2', tipY.toFixed(1));
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
  }, [cx, cy, r]);

  const at = (deg: number, rad: number) => ({
    x: cx + Math.cos(deg * RAD) * rad,
    y: cy + Math.sin(deg * RAD) * rad,
  });

  return (
    <g className='y-radar-bloom' aria-hidden='true'>
      <defs>
        <radialGradient id={`${uid}-glow`} cx='50%' cy='50%' r='50%'>
          <stop offset='0%' stopColor='#a96bff' stopOpacity='0.3' />
          <stop offset='55%' stopColor='#35cfff' stopOpacity='0.14' />
          <stop offset='100%' stopColor='#35cfff' stopOpacity='0' />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} cx='50%' cy='50%' r='50%'>
          <stop offset='0%' stopColor='#071426' stopOpacity='0.72' />
          <stop offset='52%' stopColor='#071426' stopOpacity='0.24' />
          <stop offset='100%' stopColor='#071426' stopOpacity='0' />
        </radialGradient>
        <linearGradient id={`${uid}-sheen`} x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#ffffff' stopOpacity='0' />
          <stop offset='44%' stopColor='#ffffff' stopOpacity='0.2' />
          <stop offset='56%' stopColor='#ffffff' stopOpacity='0.2' />
          <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
        </linearGradient>
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
        <radialGradient id={`${uid}-core`} cx='50%' cy='50%' r='50%'>
          <stop offset='0%' stopColor='#fff8e6' stopOpacity='0.95' />
          <stop offset='42%' stopColor='#ffd93d' stopOpacity='0.55' />
          <stop offset='100%' stopColor='#ff8a3d' stopOpacity='0' />
        </radialGradient>
        {RINGS.map((ring, ri) =>
          Array.from({ length: ring.count }, (_, i) => {
            const idx = OFFSETS[ri] + i;
            const angle = (360 / ring.count) * i + ring.phase;
            const len = petalLen(ring, r, i, ri, 0);
            const tip = at(angle + petalSway(i, ri, 0), len);
            const color = COLORS[(i + ring.tone) % COLORS.length];
            const tipColor = TIP[(i + ring.tone) % TIP.length];
            return (
              <linearGradient
                key={`pg-${ri}-${i}`}
                id={`${uid}-pg-${ri}-${i}`}
                gradientUnits='userSpaceOnUse'
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                ref={(el) => {
                  gradRefs.current[idx] = el;
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
      </defs>

      <circle
        className='y-radar-bloom-glow'
        cx={cx}
        cy={cy}
        r={r * 1.08}
        fill={`url(#${uid}-glow)`}
      />
      {RINGS.map((ring, ri) =>
        Array.from({ length: ring.count }, (_, i) => {
          const idx = OFFSETS[ri] + i;
          const angle = (360 / ring.count) * i + ring.phase;
          const len = petalLen(ring, r, i, ri, 0);
          return (
            <path
              key={`${ri}-${i}`}
              ref={(el) => {
                petalRefs.current[idx] = el;
              }}
              className={`y-radar-petal is-${ri}`}
              d={petalPath(cx, cy, angle, len, ring.spread, petalSway(i, ri, 0))}
              fill={`url(#${uid}-pg-${ri}-${i})`}
            />
          );
        })
      )}
      <circle
        className='y-radar-flower-core'
        cx={cx}
        cy={cy}
        r={r * 0.14}
        fill={`url(#${uid}-core)`}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const p = at(i * 30, r * 0.18);
        return (
          <circle
            key={`st-${i}`}
            className='y-radar-stamen'
            cx={p.x}
            cy={p.y}
            r={1.5}
            fill={COLORS[i % COLORS.length]}
          />
        );
      })}
      <circle
        className='y-radar-bloom-shade'
        cx={cx}
        cy={cy}
        r={r * 1.02}
        fill={`url(#${uid}-shade)`}
      />
      <ellipse
        className='y-radar-bloom-sheen'
        cx={cx}
        cy={cy}
        rx={r * 0.92}
        ry={r * 0.42}
        fill={`url(#${uid}-sheen)`}
      />
      <circle
        className='y-radar-bloom-grain'
        cx={cx}
        cy={cy}
        r={r}
        fill={`url(#${uid}-grain)`}
      />
      <circle
        className='y-radar-bloom-ring'
        cx={cx}
        cy={cy}
        r={r}
        fill='none'
      />
    </g>
  );
}
