import { useMemo, useState } from 'react';
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

export default function TrendChart({ victories, current }: Props) {
  const [dim, setDim] = useState<DimensionKey>('history');
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
  const line = points.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const area = `M${xFor(0).toFixed(1)},${Y1} L${line.replace(/ /g, ' L')} L${xFor(
    points.length - 1
  ).toFixed(1)},${Y1} Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last - first;

  return (
    <div className="y-trend">
      <div className="y-trend-head">
        <div className="y-trend-pick">
          <label htmlFor="y-trend-dim">看哪一维</label>
          <select
            id="y-trend-dim"
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
        <div className="y-trend-now">
          <b>
            {last}
            {meta.unit || ''}
          </b>
          <span>{meta.n} · 现在</span>
        </div>
        <span className={`y-chip ${delta > 0 ? 'y-chip-c' : delta < 0 ? 'y-chip-w' : ''}`}>
          较第一次 {delta > 0 ? '+' : ''}
          {delta}
          {meta.unit || ''}
        </span>
      </div>

      <svg viewBox="0 0 740 236" role="img" aria-label={`${meta.n}随归档次数变化的折线图`}>
        <defs>
          <linearGradient id="y-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e5b4c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0e5b4c" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} rx={5} fill="#fbfaf6" stroke="#e5e1d8" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={X0} y1={yFor(t)} x2={X1} y2={yFor(t)} stroke="#e9e5db" strokeWidth={0.9} strokeDasharray="3 4" />
            <text x={X0 - 8} y={yFor(t) + 3.5} textAnchor="end" fontSize={9.5} fill="#8d887e">
              {t}
            </text>
          </g>
        ))}
        {points.length > 1 ? (
          <>
            <path
              key={`area-${dim}`}
              className="y-trend-area"
              d={area}
              fill="url(#y-trend-area)"
            />
            <polyline
              key={`line-${dim}`}
              className="y-trend-line"
              points={line}
              pathLength={1}
              fill="none"
              stroke="#0e5b4c"
              strokeWidth={2.3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}
        {points.map((v, i) => (
          <g key={`${labels[i]}-${i}`}>
            {i === points.length - 1 ? (
              <circle
                className="y-trend-pulse"
                cx={xFor(i)}
                cy={yFor(v)}
                r={12}
                fill="#0e5b4c"
                opacity={0.12}
              />
            ) : null}
            <circle cx={xFor(i)} cy={yFor(v)} r={i === points.length - 1 ? 5 : 3.8} fill={i === points.length - 1 ? '#0e5b4c' : '#fffefb'} stroke="#0e5b4c" strokeWidth={1.8} />
            <text x={xFor(i)} y={yFor(v) - 9} textAnchor="middle" fontSize={10} fill={i === points.length - 1 ? '#0e5b4c' : '#6f6a61'} fontWeight={i === points.length - 1 ? 650 : 400}>
              {v}
            </text>
            {points.length <= 8 || i % 2 === 0 || i === points.length - 1 ? (
              <text x={xFor(i)} y={Y1 + 18} textAnchor="middle" fontSize={9.5} fill="#8d887e">
                {labels[i]}
              </text>
            ) : null}
          </g>
        ))}
        <text x={X1} y={16} textAnchor="end" fontSize={9.5} fill="#b3ada3">
          {meta.n} · 不含目标线
        </text>
      </svg>
    </div>
  );
}
