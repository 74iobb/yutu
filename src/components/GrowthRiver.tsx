import { useId, useMemo, useState } from 'react';
import { DIMS, norm } from '@/lib/model';
import type { DimensionKey, Scores, Victory } from '@/types';

const W = 720;
const H = 270;
const M = { l: 26, r: 26, t: 28, b: 34 };
const INNER_W = W - M.l - M.r;
const INNER_H = H - M.t - M.b;

const COLOR: Record<DimensionKey, string> = {
  place: 'var(--data-teal)',
  econ: 'var(--accent)',
  family: 'var(--danger)',
  age: 'var(--data-violet)',
  cycle: 'var(--data-blue)',
  inertia: '#6faf8e',
  history: '#c08b2e',
};

/** SVG gradient stop 用实际色值，避免 presentation attribute 对 CSS 变量的兼容问题 */
const COLOR_HEX: Record<DimensionKey, string> = {
  place: '#3c9a86',
  econ: '#e29a37',
  family: '#a14c3d',
  age: '#8b7bb8',
  cycle: '#2e6fa3',
  inertia: '#6faf8e',
  history: '#c08b2e',
};

const SHORT: Record<DimensionKey, string> = {
  place: '地理',
  econ: '经济',
  family: '家庭',
  age: '年龄',
  cycle: '行业',
  inertia: '探索',
  history: '体验',
};

type Pt = [number, number];

/** Catmull-Rom 采样，得到平滑折线；不引入 d3-shape，保持包体 */
function catmull(points: Pt[], samples = 16): Pt[] {
  if (points.length < 2) return points;
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s += 1) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function poly(points: Pt[]) {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

interface Props {
  victories: Victory[];
  current: Scores;
}

/**
 * 成长河：七维在每次归档前后的流式堆叠。
 * 用归一化后的七维画 streamgraph，悬停横切查看当时的原始值。
 */
export default function GrowthRiver({ victories, current }: Props) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const snapshots = useMemo(
    () => [
      ...victories.map(v => ({ label: `第 ${v.no} 次`, snap: v.snap })),
      { label: '现在', snap: current },
    ],
    [victories, current]
  );
  const n = snapshots.length;
  const active = Math.min(Math.max(hover ?? n - 1, 0), n - 1);

  const xAt = (i: number) =>
    M.l + (n <= 1 ? INNER_W / 2 : (i / (n - 1)) * INNER_W);

  const values = useMemo(
    () =>
      DIMS.map(d =>
        snapshots.map(s =>
          Math.max(0.06, Math.min(1, norm(d.k, s.snap[d.k]) / 100))
        )
      ),
    [snapshots]
  );

  const totals = useMemo(
    () =>
      Array.from({ length: n }, (_, i) =>
        values.reduce((sum, row) => sum + row[i], 0)
      ),
    [values, n]
  );

  const bands = useMemo(() => {
    const maxTotal = Math.max(1, ...totals);
    const scale = INNER_H / (maxTotal * 1.08);
    const centerY = M.t + INNER_H / 2;
    return DIMS.map((d, di) => {
      const edgeA: Pt[] = [];
      const edgeB: Pt[] = [];
      for (let i = 0; i < n; i += 1) {
        const total = totals[i];
        const base = -total / 2;
        const prefix = values
          .slice(0, di)
          .reduce((sum, row) => sum + row[i], 0);
        const y0 = centerY + (base + prefix) * scale;
        const y1 = y0 + values[di][i] * scale;
        edgeA.push([xAt(i), y0]);
        edgeB.push([xAt(i), y1]);
      }
      const top = catmull(edgeA);
      const bottom = catmull([...edgeB].reverse());
      return {
        d: `M${poly(top)} L${poly(bottom)} Z`,
        color: COLOR[d.k],
        dim: d,
        values: values[di],
      };
    });
  }, [totals, values, n]);

  if (n < 2) {
    return (
      <p className='y-chart-empty'>
        完成第一次归档后，这里会出现你的七维成长河。
      </p>
    );
  }

  const activeSnap = snapshots[active];
  const guideX = xAt(active);
  const nowX = xAt(n - 1);

  return (
    <div className='y-river'>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role='img'
        aria-label={`成长河：${activeSnap.label}的七维处境`}
      >
        <title>成长河</title>
        <desc>
          七维处境随归档次数变化的流式堆叠；悬停横切可查看当时的原始数值。
        </desc>

        <defs>
          {DIMS.map(d => (
            <linearGradient
              key={d.k}
              id={`${uid}-${d.k}`}
              x1='0'
              y1='0'
              x2='0'
              y2='1'
            >
              <stop offset='0%' stopColor={COLOR_HEX[d.k]} stopOpacity='0.82' />
              <stop offset='100%' stopColor={COLOR_HEX[d.k]} stopOpacity='0.48' />
            </linearGradient>
          ))}
        </defs>

        <line
          x1={guideX}
          y1={M.t}
          x2={guideX}
          y2={M.t + INNER_H}
          className='y-river-guide'
        />
        <line
          x1={nowX}
          y1={M.t}
          x2={nowX}
          y2={M.t + INNER_H}
          className='y-river-now-line'
        />

        {bands.map((band, i) => (
          <path
            key={band.dim.k}
            className='y-river-band'
            d={band.d}
            fill={`url(#${uid}-${band.dim.k})`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <title>
              {band.dim.n}：
              {Math.round(activeSnap.snap[band.dim.k])}
              {band.dim.unit || ''}
            </title>
          </path>
        ))}

        {Array.from({ length: n }, (_, i) => {
          const left = i === 0 ? M.l : (xAt(i - 1) + xAt(i)) / 2;
          const right =
            i === n - 1 ? M.l + INNER_W : (xAt(i) + xAt(i + 1)) / 2;
          return (
            <rect
              key={`slice-${i}`}
              className='y-river-slice'
              x={left}
              y={M.t}
              width={Math.max(0, right - left)}
              height={INNER_H}
              tabIndex={0}
              role='button'
              aria-label={`${snapshots[i].label}的七维处境`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          );
        })}

        <text
          x={nowX}
          y={M.t + 12}
          textAnchor='end'
          className='y-river-now'
        >
          现在
        </text>

        {snapshots.map((s, i) =>
          n <= 8 || i % 2 === 0 || i === n - 1 ? (
            <text
              key={`x-${s.label}`}
              x={xAt(i)}
              y={H - 12}
              textAnchor='middle'
              className={`y-river-x${i === active ? ' is-on' : ''}`}
            >
              {s.label}
            </text>
          ) : null
        )}
      </svg>

      <div
        className='y-river-values'
        aria-live='polite'
        aria-label={`${activeSnap.label}的七维数值`}
      >
        <span className='y-river-when'>{activeSnap.label}</span>
        {DIMS.map(d => (
          <span key={d.k} className='y-river-val'>
            <i style={{ background: COLOR[d.k] }} />
            {SHORT[d.k]} <b>{Math.round(activeSnap.snap[d.k])}{d.unit || ''}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
