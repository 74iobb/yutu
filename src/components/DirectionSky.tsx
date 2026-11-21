import { useMemo, useState, type KeyboardEvent } from 'react';
import { FEAS_LABEL } from '@/lib/model';
import type {
  Direction,
  DirectionTrait,
  Feasibility,
} from '@/data/catalog';
import type { FeasibilityResult } from '@/types';

const CX = 480;
const CY = 328;

const RINGS = [
  { key: 'high' as const, r: 116, label: '当前可做', offset: 0.3 },
  { key: 'mid' as const, r: 214, label: '需补条件', offset: 0.14 },
  { key: 'low' as const, r: 312, label: '条件不足', offset: 0.24 },
];

const TRAIT_LABEL: Record<DirectionTrait, string> = {
  job: '依赖本地岗位',
  cash: '需投入期',
  time: '需大块时间',
  reset: '归零类路径',
};

function shortName(name: string) {
  const base = name.replace(/（[^）]*）/g, '').trim();
  return base.length > 9 ? base.slice(0, 9) + '…' : base;
}

interface SkyItem {
  dir: Direction;
  f: FeasibilityResult;
}

interface Props {
  items: SkyItem[];
  picked: string | null;
  shortlist: string[];
  stageName: string;
  field: string;
  onPick: (name: string) => void;
  onToggle: (name: string) => void;
  onOpenMap?: (name: string) => void;
  onExit: () => void;
}

/** 固定的星点，避免每次渲染跳位 */
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 137 + 41) % 960,
  y: (i * 89 + 23) % 700,
  r: i % 7 === 0 ? 1.7 : i % 3 === 0 ? 1.2 : 0.8,
  delay: ((i * 37) % 100) / 10,
}));

export default function DirectionSky({
  items,
  picked,
  shortlist,
  stageName,
  field,
  onPick,
  onToggle,
  onOpenMap,
  onExit,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const fallback =
    items.find(x => x.f.level === 'high')?.dir.name ?? items[0]?.dir.name ?? null;
  const activeName = hover ?? picked ?? fallback;

  const groups = useMemo(
    () =>
      RINGS.map(ring => {
        const level = ring.key as Feasibility;
        const list = items.filter(x => x.f.level === level);
        const step = (Math.PI * 2) / Math.max(1, list.length);
        return {
          ...ring,
          nodes: list.map((item, i) => {
            const a = -Math.PI / 2 + ring.offset + i * step;
            return {
              ...item,
              a,
              x: CX + ring.r * Math.cos(a),
              y: CY + ring.r * Math.sin(a),
              radius: level === 'high' ? 13 : level === 'mid' ? 11 : 9.5,
            };
          }),
        };
      }),
    [items]
  );

  const flat = useMemo(
    () => groups.flatMap(g => g.nodes.map(n => ({ ...n, level: g.key }))),
    [groups]
  );

  const flights = useMemo(
    () =>
      [...flat].sort((a, b) => {
        const score = (n: (typeof flat)[number]) =>
          n.dir.name === picked
            ? 2
            : shortlist.includes(n.dir.name)
              ? 1
              : 0;
        return score(a) - score(b);
      }),
    [flat, picked, shortlist]
  );

  const nodes = useMemo(
    () =>
      [...flat].sort((a, b) => {
        const score = (n: (typeof flat)[number]) =>
          n.dir.name === picked
            ? 2
            : shortlist.includes(n.dir.name)
              ? 1
              : 0;
        return score(a) - score(b);
      }),
    [flat, picked, shortlist]
  );

  const active = flat.find(n => n.dir.name === activeName) ?? null;
  const counts = {
    high: items.filter(x => x.f.level === 'high').length,
    mid: items.filter(x => x.f.level === 'mid').length,
    low: items.filter(x => x.f.level === 'low').length,
  };

  function activate(name: string) {
    onPick(name);
  }

  function onKey(e: KeyboardEvent<SVGGElement>, name: string) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      activate(name);
    }
  }

  return (
    <div
      className='y-sky'
      role='dialog'
      aria-modal='true'
      aria-label='方向星图：按可行性分层的全部方向'
    >
      <div className='y-sky-head'>
        <div>
          <p className='y-sky-eyebrow'>
            03 / 方向星图 · {stageName}
            {field ? ` · ${field}` : ''}
          </p>
          <h3>中心是你，越靠内圈越接近「现在就能走」</h3>
          <p className='y-sky-sub'>
            点的位置只表示可行性层次，不代表方向高低；点选一个方向，在右侧看条件与代价。
          </p>
        </div>
        <div className='y-sky-head-actions'>
          <span className='y-sky-counts'>
            <i className='is-high' /> {counts.high} 可做
            <i className='is-mid' /> {counts.mid} 需补
            <i className='is-low' /> {counts.low} 不足
          </span>
          <button
            type='button'
            className='y-sky-exit'
            onClick={onExit}
            title='Esc 也可退出'
          >
            退出星图 ×
          </button>
        </div>
      </div>

      <div className='y-sky-body'>
        <div className='y-sky-stage'>
          <svg
            viewBox='0 0 960 700'
            role='group'
            aria-label={`方向星图，共 ${items.length} 个方向`}
          >
            <title>方向星图</title>
            <desc>
              三层同心环分别表示当前可做、需补条件与条件不足；中心表示你的当前处境。点选方向可在右侧查看详情。
            </desc>
            <defs>
              <radialGradient id='skyCore' cx='50%' cy='45%' r='65%'>
                <stop offset='0%' stopColor='#d9f5e8' />
                <stop offset='45%' stopColor='#4fb78d' />
                <stop offset='100%' stopColor='#0e5b4c' />
              </radialGradient>
              <radialGradient id='skyGlow' cx='50%' cy='50%' r='50%'>
                <stop offset='0%' stopColor='#7fe0b7' stopOpacity='0.34' />
                <stop offset='100%' stopColor='#7fe0b7' stopOpacity='0' />
              </radialGradient>
            </defs>

            {STARS.map((s, i) => (
              <circle
                key={i}
                className='y-sky-star'
                cx={s.x}
                cy={s.y}
                r={s.r}
                style={{ animationDelay: `${s.delay}s` }}
              />
            ))}

            <circle cx={CX} cy={CY} r={352} className='y-sky-vignette' />

            {RINGS.map(ring => (
              <g key={ring.key} className={`y-sky-ring-group is-${ring.key}`}>
                <circle cx={CX} cy={CY} r={ring.r} className='y-sky-ring' />
                <text
                  x={CX}
                  y={CY - ring.r - 11}
                  textAnchor='middle'
                  className='y-sky-ring-label'
                >
                  {ring.label}
                </text>
              </g>
            ))}

            {flights.map(n => (
              <path
                key={`f-${n.dir.name}`}
                className={`y-sky-flight is-${n.level}${
                  shortlist.includes(n.dir.name) ? ' is-cand' : ''
                }${n.dir.name === picked ? ' is-picked' : ''}`}
                d={`M${CX},${CY} Q${(CX + n.x) / 2 + (n.y - CY) * 0.07},${
                  (CY + n.y) / 2 - (n.x - CX) * 0.07
                } ${n.x},${n.y}`}
              />
            ))}

            <circle cx={CX} cy={CY} r={94} fill='url(#skyGlow)' />
            <circle cx={CX} cy={CY} r={30} className='y-sky-core-pulse' />
            <circle
              cx={CX}
              cy={CY}
              r={30}
              className='y-sky-core-pulse is-late'
            />
            <circle cx={CX} cy={CY} r={26} fill='url(#skyCore)' />
            <text x={CX} y={CY - 2} textAnchor='middle' className='y-sky-core-t'>
              你
            </text>
            <text x={CX} y={CY + 14} textAnchor='middle' className='y-sky-core-s'>
              当前处境
            </text>

            {nodes.map(n => {
              const cand = shortlist.includes(n.dir.name);
              const isPicked = n.dir.name === picked;
              const isActive = n.dir.name === activeName;
              const lr = (RINGS.find(r => r.key === n.level)?.r ?? 0) + 25;
              const lx = CX + lr * Math.cos(n.a);
              const ly = CY + lr * Math.sin(n.a);
              const cos = Math.cos(n.a);
              const sin = Math.sin(n.a);
              const anchor = cos > 0.28 ? 'start' : cos < -0.28 ? 'end' : 'middle';
              const dy = Math.abs(cos) <= 0.28 ? (sin < 0 ? -9 : 17) : 4;
              const candIndex = shortlist.indexOf(n.dir.name) + 1;
              return (
                <g
                  key={n.dir.name}
                  className={`y-sky-node is-${n.level}${
                    cand ? ' is-cand' : ''
                  }${isPicked ? ' is-picked' : ''}${
                    isActive ? ' is-active' : ''
                  }`}
                  role='button'
                  tabIndex={0}
                  aria-label={`${n.dir.name}，${FEAS_LABEL[n.f.level].t}`}
                  aria-current={isPicked ? 'true' : undefined}
                  onClick={() => activate(n.dir.name)}
                  onKeyDown={e => onKey(e, n.dir.name)}
                  onPointerEnter={() => setHover(n.dir.name)}
                  onPointerLeave={() =>
                    setHover(h => (h === n.dir.name ? null : h))
                  }
                >
                  {isPicked ? (
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.radius + 15}
                      className='y-sky-halo'
                    />
                  ) : null}
                  {cand ? (
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.radius + 6}
                      className='y-sky-cand-ring'
                    />
                  ) : null}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.radius + 10}
                    className='y-sky-hit'
                  />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.radius}
                    className='y-sky-dot'
                  />
                  {isPicked ? (
                    <text
                      x={n.x}
                      y={n.y + 4}
                      textAnchor='middle'
                      className='y-sky-picked-mark'
                    >
                      ✓
                    </text>
                  ) : null}
                  <text
                    x={lx}
                    y={ly + dy}
                    textAnchor={anchor}
                    className='y-sky-node-label'
                  >
                    {shortName(n.dir.name)}
                  </text>
                  {cand ? (
                    <g className='y-sky-cand-badge'>
                      <circle
                        cx={n.x + n.radius + 3}
                        cy={n.y - n.radius - 3}
                        r={7}
                      />
                      <text
                        x={n.x + n.radius + 3}
                        y={n.y - n.radius}
                        textAnchor='middle'
                      >
                        {candIndex}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <div className='y-sky-legend'>
            <span>
              <i className='is-high' /> 当前可做
            </span>
            <span>
              <i className='is-mid' /> 需补条件
            </span>
            <span>
              <i className='is-low' /> 条件不足
            </span>
            <span className='y-sky-hint'>点击方向选中 · Esc 退出</span>
          </div>
        </div>

        <aside className='y-sky-side' aria-live='polite'>
          {active ? (
            <>
              <div className='y-sky-side-head'>
                <span className='y-sky-side-eyebrow'>当前方向</span>
                <span className={`y-sky-feas is-${active.f.level}`}>
                  {FEAS_LABEL[active.f.level].t}
                </span>
              </div>
              <h3>{active.dir.name}</h3>
              <p className='y-sky-note'>{active.dir.note}</p>

              <div className='y-sky-tags'>
                {active.dir.traits.map(t => (
                  <span key={t}>{TRAIT_LABEL[t]}</span>
                ))}
                {shortlist.includes(active.dir.name) ? (
                  <span className='is-cand'>
                    候选 {shortlist.indexOf(active.dir.name) + 1}
                  </span>
                ) : null}
                {active.dir.name === picked ? (
                  <span className='is-picked'>已选定</span>
                ) : null}
              </div>

              <div className='y-sky-block'>
                <b>前置条件</b>
                <p>{active.dir.prereq}</p>
              </div>
              {active.f.reasons.length ? (
                <div className='y-sky-block'>
                  <b>为什么是这个层次</b>
                  <p>{active.f.reasons.join('；')}</p>
                </div>
              ) : null}

              <div className='y-sky-side-actions'>
                <button
                  type='button'
                  className='y-sky-btn is-main'
                  onClick={() => {
                    onOpenMap?.(active.dir.name);
                    onExit();
                  }}
                >
                  看代价与资源 →
                </button>
                <button
                  type='button'
                  className='y-sky-btn'
                  disabled={
                    shortlist.length >= 4 &&
                    !shortlist.includes(active.dir.name)
                  }
                  onClick={() => onToggle(active.dir.name)}
                >
                  {shortlist.includes(active.dir.name)
                    ? '移出候选'
                    : shortlist.length >= 4
                      ? '候选已满（4）'
                      : '＋ 加入候选'}
                </button>
              </div>

              <p className='y-sky-foot'>
                方向数量 {items.length} 个 · 当前位置只表示可行性层次，排序不代表价值判断。
              </p>
            </>
          ) : (
            <p className='y-sky-empty'>
              当前阶段还没有方向数据。可以回第 1 步检查处境与阶段。
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
