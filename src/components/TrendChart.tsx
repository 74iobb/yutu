import { useMemo, useState } from 'react';
import { DIMS, DIM_MAP } from '@/lib/model';
import type { DimensionKey, Scores, Victory } from '@/types';

const X0 = 58;
const X1 = 700;
const Y0 = 24;
const Y1 = 202;

interface Props {
  victories: Victory[];
  current: Scores;
}

type Pt = [number, number];

/** 科研图风格的工具提示/折线：直连线，不做平滑插值，避免读出“并不存在”的拐点 */
function straightLine(pts: Pt[]) {
  return pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

export default function TrendChart({ victories, current }: Props) {
  const [dim, setDim] = useState<DimensionKey>('history');
  const [hover, setHover] = useState<number | null>(null);
  const meta = DIM_MAP[dim];
  const points = useMemo(
    () => [...victories.map((v) => v.snap[dim]), current[dim]],
    [victories, current, dim]
  );
  const labels = useMemo(
    () => [...victories.map((v) => `第${v.no}次`), '现在'],
    [victories]
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
  const line = straightLine(coords);
  const area = `${line} L${xFor(points.length - 1).toFixed(1)},${Y1} L${X0},${Y1} Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last - first;
  const active = hover ?? points.length - 1;
  const activeX = xFor(active);
  const unit = meta.unit || '';

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
            {unit}
          </b>
          <span>
            {meta.n} · 现在
          </span>
        </div>
        <span
          className={`y-chip ${delta > 0 ? 'y-chip-c' : delta < 0 ? 'y-chip-w' : ''}`}
        >
          较第一次 {delta > 0 ? '+' : ''}
          {delta}
          {unit}
        </span>
      </div>

      <svg
        viewBox='0 0 740 262'
        role='img'
        aria-label={`${meta.n}随归档次数变化的折线图`}
      >
        {/* 绘图区 */}
        <rect
          x={X0}
          y={Y0}
          width={X1 - X0}
          height={Y1 - Y0}
          className='y-trend-bg'
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

        {/* 起点参考线 */}
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
              {unit}
            </text>
          </g>
        ) : null}

        {points.length > 1 ? (
          <>
            <path
              key={`area-${dim}`}
              className='y-trend-area'
              d={area}
            />
            <path
              key={`line-${dim}`}
              className='y-trend-line'
              d={line}
              pathLength={1}
              fill='none'
            />
          </>
        ) : null}

        {/* 悬停竖线 */}
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
              <circle
                cx={xFor(i)}
                cy={yFor(v)}
                r={isActive ? 3.8 : 2.8}
                className={isLast ? 'y-trend-dot is-now' : 'y-trend-dot'}
              />
              {isActive ? (
                (() => {
                  const above = yFor(v) - 26 >= Y0;
                  const tipY = above ? yFor(v) - 26 : yFor(v) + 10;
                  return (
                    <>
                      <rect
                        x={xFor(i) - 21}
                        y={tipY}
                        width={42}
                        height={17}
                        rx={2}
                        className='y-trend-tip'
                      />
                      <text
                        x={xFor(i)}
                        y={tipY + 12}
                        textAnchor='middle'
                        className='y-trend-tip-text'
                      >
                        {v}
                        {unit}
                      </text>
                    </>
                  );
                })()
              ) : null}
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

        {/* 坐标轴标题 */}
        <text
          x={(X0 + X1) / 2}
          y={Y1 + 44}
          textAnchor='middle'
          className='y-trend-axis-title'
        >
          归档次数
        </text>
        <text
          x={16}
          y={(Y0 + Y1) / 2}
          textAnchor='middle'
          transform={`rotate(-90 16 ${(Y0 + Y1) / 2})`}
          className='y-trend-axis-title'
        >
          {meta.n}
          {unit ? `（${unit}）` : ''}
        </text>

        <text x={X1} y={16} textAnchor='end' className='y-trend-caption'>
          n = {victories.length} 次归档 + 现在 · 不含目标线
        </text>
      </svg>
    </div>
  );
}
