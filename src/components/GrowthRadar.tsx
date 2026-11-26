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

/**
 * 飘带的中轴：主波沿带长传播，叠一层反向的二次波与阵风式振幅变化，
 * 让形状随时间自然起伏，而不是整条刚性旋转。
 */
function centerAt(baseR: number, amp: number, u: number, t: number) {
  const gust = 0.82 + 0.18 * Math.sin(t * 0.7 + u * 0.6);
  return (
    baseR +
    (Math.sin(u + t * 1.5) * amp +
      Math.sin(u * 2.25 - t * 2.2) * amp * 0.32) *
      gust
  );
}

/** 跟在扫描线后面的波浪线：半径随角度与时间起伏，配合虚线流动 */
function waveTrailPath(
  radius: number,
  amp: number,
  phase: number,
  t = 0
) {
  let d = '';
  for (let deg = -96; deg >= -168; deg -= 4) {
    const u = (deg + phase) * 0.11;
    const r = centerAt(radius, amp, u, t);
    const p = polar(deg, r);
    d += `${d ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return d;
}

/**
 * 3D 波形缎带：内缘与外缘各自起伏、带宽随角度与时间变化，闭合后像一条
 * 有厚度的飘带；配合渐变与高光脊线制造体积感。
 */
function ribbonPath(
  baseR: number,
  amp: number,
  phase: number,
  halfW: number,
  t = 0
) {
  const outer: { x: number; y: number }[] = [];
  const inner: { x: number; y: number }[] = [];
  for (let deg = -94; deg >= -172; deg -= 3) {
    const u = (deg + phase) * 0.11;
    const rc = centerAt(baseR, amp, u, t);
    const w =
      halfW * (0.64 + 0.36 * Math.sin(u * 1.3 + t * 1.1 + 0.9));
    outer.push(polar(deg, rc + w));
    inner.push(polar(deg, rc - w));
  }
  inner.reverse();
  const pts = [...outer, ...inner];
  return (
    pts
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

/** 缎带的高光脊线 */
function ridgePath(baseR: number, amp: number, phase: number, t = 0) {
  let d = '';
  for (let deg = -94; deg >= -172; deg -= 4) {
    const u = (deg + phase) * 0.11;
    const r = centerAt(baseR, amp, u, t);
    const p = polar(deg, r);
    d += `${d ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return d;
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
  /* 飘带形状逐帧重算（不触发 React 重渲染），让波沿带长自然传播 */
  const waveBackRef = useRef<SVGPathElement>(null);
  const waveMainRef = useRef<SVGPathElement>(null);
  const waveCoreRef = useRef<SVGPathElement>(null);
  const waveRidgeRef = useRef<SVGPathElement>(null);
  const waveFlowARef = useRef<SVGPathElement>(null);
  const waveFlowBRef = useRef<SVGPathElement>(null);

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
          waveBackRef.current?.setAttribute(
            'd',
            ribbonPath(R * 0.62, 5, 84, 5, t)
          );
          waveMainRef.current?.setAttribute(
            'd',
            ribbonPath(R * 0.82, 7, 0, 9, t)
          );
          waveCoreRef.current?.setAttribute(
            'd',
            ribbonPath(R * 0.82, 7, 0, 3.4, t)
          );
          waveRidgeRef.current?.setAttribute(
            'd',
            ridgePath(R * 0.87, 7, 0, t)
          );
          waveFlowARef.current?.setAttribute(
            'd',
            waveTrailPath(R * 0.95, 4, 30, t)
          );
          waveFlowBRef.current?.setAttribute(
            'd',
            waveTrailPath(R * 0.7, 3, 150, t)
          );
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
        </defs>

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
          {/* 波尾：柔光扇形 + 3D 缎带（暗背带 / 主带 / 亮芯 / 高光脊），随扫描线一起转 */}
          <path
            className='y-radar-wave-glass'
            d={sweepTailPath(62)}
            fill={`url(#${uid}-trail)`}
          />
          <path
            className='y-radar-wave y-radar-wave-back'
            ref={waveBackRef}
            d={ribbonPath(R * 0.62, 5, 84, 5)}
            fill={`url(#${uid}-ribbon-dark)`}
          />
          <path
            className='y-radar-wave y-radar-wave-3d'
            ref={waveMainRef}
            d={ribbonPath(R * 0.82, 7, 0, 9)}
            fill={`url(#${uid}-ribbon)`}
          />
          <path
            className='y-radar-wave-core'
            ref={waveCoreRef}
            d={ribbonPath(R * 0.82, 7, 0, 3.4)}
            fill={`url(#${uid}-ribbon-core)`}
          />
          <path
            className='y-radar-wave-ridge'
            ref={waveRidgeRef}
            d={ridgePath(R * 0.87, 7, 0)}
            stroke={`url(#${uid}-ribbon)`}
          />
          <path
            className='y-radar-wave-line'
            ref={waveFlowARef}
            d={waveTrailPath(R * 0.95, 4, 30)}
            stroke={`url(#${uid}-trail)`}
          />
          <path
            className='y-radar-wave-line'
            ref={waveFlowBRef}
            d={waveTrailPath(R * 0.7, 3, 150)}
            stroke={`url(#${uid}-trail)`}
            style={{ animationDelay: '-1.1s' }}
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
