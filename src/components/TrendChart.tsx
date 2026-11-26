import { useId, useMemo, useState } from 'react';
import { DIMS, DIM_MAP } from '@/lib/model';
import type { DimensionKey, Scores, Victory } from '@/types';

const X0 = 46;
const X1 = 700;
const Y0 = 24;
const Y1 = 202;

interface Props {
  victories: Victory[];
  current: Scores;
}

type Pt = [number, number];

/** Catmull-Rom → 三次贝塞尔，得到平滑曲线；控制点夹在绘图区内避免过冲 */
function smoothPath(pts: Pt[]) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const clampY = (y: number) => Math.max(Y0 - 4, Math.min(Y1 + 4, y));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(
      1
    )} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export default function TrendChart({ victories, current }: Props) {
  const uid = useId().replace(/:/g, '');
  const [dim, setDim] = useState<DimensionKey>('history');
  const [hover, setHover] = useState<number | null>(null);
  const meta = DIM_MAP[dim];
  const points = useMemo(
    () => [...victories.map((v) => v.snap[dim]), current[dim]],
    [victories, current, dim]
  );
  const labels = useMemo(
    () => [...victories.map((v) => `第${v.no}次`), '现在'],
    [victories, dim]
  );
  const min = meta.min;
  const max = meta.max;
  const span = Math.max(1, max - min);
  const xFor = (i: number) => X0 + (i / Math.max(1, points.length - 1)) * (X1 - X0);
  const yFor = (v: number) => Y1 - ((v - min) / span) * (Y1 - Y0);

  const ticks =
    dim === 'age'
      ? [min, Math.round(min + span / 2), max]
      : [0, 25, 50, 75, 100];
  const coords = points.map((v, i) => [xFor(i), yFor(v)] as Pt);
  const line = smoothPath(coords);
  const area = `${line} L${xFor(points.length - 1).toFixed(1)},${Y1} L${X0},${Y1} Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last - first;
  const active = hover ?? points.length - 1;
  const activeX = xFor(active);

  return (
    <div className='y-trend'>
      <div className='y-trend-head'>
        <div className='y-trend-pick'>
          <label htmlFor='y-trend-dim'>看哪一维</label>
          <select
            id='y-trend-dim'
            value={dim}
            onChange={(e) => setDim(e.target.value as DimensionKey)}
          >
            {DIMS.map((d) => (
              <option key={d.k} value={d.k}>
                {d.n}
              </option>
            ))}
          </select>
        </div>
        <div className='y-trend-now'>
          <b>
            {last}
            {meta.unit || ''}
          </b>
          <span>{meta.n} · 现在</span>
        </div>
        <span
          className={`y-chip ${delta > 0 ? 'y-chip-c' : delta < 0 ? 'y-chip-w' : ''}`}
        >
          较第一次 {delta > 0 ? '+' : ''}
          {delta}
          {meta.unit || ''}
        </span>
      </div>

      <svg
        viewBox='0 0 740 236'
        role='img'
        aria-label={`${meta.n}随归档次数变化的折线图`}
      >
        <defs>
          <linearGradient id={`${uid}-area`} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#7ee8c8' stopOpacity='0.34' />
            <stop offset='52%' stopColor='#7ec8ff' stopOpacity='0.16' />
            <stop offset='100%' stopColor='#7ec8ff' stopOpacity='0' />
          </linearGradient>
          <linearGradient id={`${uid}-line`} x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stopColor='#7ee8c8' />
            <stop offset='55%' stopColor='#7ec8ff' />
            <stop offset='100%' stopColor='#b9a8ff' />
          </linearGradient>
          <radialGradient id={`${uid}-halo`} cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#9fd8ff' stopOpacity='0.5' />
            <stop offset='100%' stopColor='#9fd8ff' stopOpacity='0' />
          </radialGradient>
          <filter id={`${uid}-glow`} x='-30%' y='-60%' width='160%' height='220%'>
            <feGaussianBlur stdDeviation='3.2' result='blur' />
            <feMerge>
              <feMergeNode in='blur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>

        {/* 背板：极淡的径向光，给折线一个“浮起来”的底 */}
        <rect
          x={X0}
          y={Y0}
          width={X1 - X0}
          height={Y1 - Y0}
          rx={10}
          className='y-trend-bg'
        />
        <ellipse
          cx={(X0 + X1) / 2}
          cy={Y0 + 34}
          rx={(X1 - X0) / 2.4}
          ry={46}
          fill={`url(#${uid}-halo)`}
          opacity={0.35}
        />

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={X0}
              y1={yFor(t)}
              x2={X1}
              y2={yFor(t)}
              className='y-trend-grid'
            />
            <text
              x={X0 - 9}
              y={yFor(t) + 3.5}
              textAnchor='end'
              className='y-trend-tick'
            >
              {t}
            </text>
          </g>
        ))}

        {/* 起点参考线：让“涨了多少”一眼可读 */}
        {points.length > 1 ? (
          <g>
            <line
              x1={X0}
              y1={yFor(first)}
              x2={X1}
              y2={yFor(first)}
              className='y-trend-base'
            />
            <text
              x={X1 - 4}
              y={yFor(first) - 6}
              textAnchor='end'
              className='y-trend-base-label'
            >
              起点 {first}
              {meta.unit || ''}
            </text>
          </g>
        ) : null}

        {points.length > 1 ? (
          <>
            <path
              key={`area-${dim}`}
              className='y-trend-area'
              d={area}
              fill={`url(#${uid}-area)`}
            />
            <path
              key={`line-${dim}`}
              className='y-trend-line'
              d={line}
              pathLength={1}
              fill='none'
              stroke={`url(#${uid}-line)`}
              strokeWidth={2.6}
              strokeLinecap='round'
              strokeLinejoin='round'
              filter={`url(#${uid}-glow)`}
            />
            {/* 沿线流动的细光点，表达“数据在往后走” */}
            <path
              key={`flow-${dim}`}
              className='y-trend-flow'
              d={line}
              fill='none'
              stroke='#dff2ff'
              strokeWidth={1.2}
              strokeLinecap='round'
            />
          </>
        ) : null}

        {/* 悬停竖线：只在指针进入时出现，避免“现在”那一列常驻一条线 */}
        {points.length > 1 && hover !== null ? (
          <line
            x1={activeX}
            y1={Y0}
            x2={activeX}
            y2={Y1}
            className='y-trend-cursor'
          />
        ) : null}

        {points.map((v, i) => {
          const isLast = i === points.length - 1;
          const isActive = i === active;
          return (
            <g
              key={`${labels[i]}-${i}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <rect
                x={xFor(i) - 14}
                y={Y0}
                width={28}
                height={Y1 - Y0}
                fill='transparent'
              />
              {isActive ? (
                <circle
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={16}
                  fill={`url(#${uid}-halo)`}
                />
              ) : null}
              {isLast ? (
                <circle
                  className='y-trend-pulse'
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={11}
                  fill='#7ec8ff'
                  opacity={0.16}
                />
              ) : null}
              <circle
                cx={xFor(i)}
                cy={yFor(v)}
                r={isActive ? 5.2 : 3.6}
                className={isLast ? 'y-trend-dot is-now' : 'y-trend-dot'}
              />
              {isActive
                ? (() => {
                    /* 接近顶部时把数值气泡翻到点下方，避免被画布裁掉 */
                    const above = yFor(v) - 26 >= Y0;
                    const tipY = above ? yFor(v) - 26 : yFor(v) + 10;
                    return (
                      <>
                        <rect
                          x={xFor(i) - 21}
                          y={tipY}
                          width={42}
                          height={17}
                          rx={8}
                          className='y-trend-tip'
                        />
                        <text
                          x={xFor(i)}
                          y={tipY + 12}
                          textAnchor='middle'
                          className='y-trend-tip-text'
                        >
                          {v}
                          {meta.unit || ''}
                        </text>
                      </>
                    );
                  })()
                : null}
              {points.length <= 8 || i % 2 === 0 || isLast ? (
                <text
                  x={xFor(i)}
                  y={Y1 + 18}
                  textAnchor='middle'
                  className={`y-trend-x${isActive ? ' is-on' : ''}`}
                >
                  {labels[i]}
                </text>
              ) : null}
            </g>
          );
        })}

        <text x={X1} y={16} textAnchor='end' className='y-trend-caption'>
          {meta.n} · 不含目标线
        </text>
      </svg>
    </div>
  );
}
