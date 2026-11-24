import { useId } from 'react';
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
