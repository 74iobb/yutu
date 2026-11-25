import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { STAGES, type StageId } from '@/data/catalog';
import { CHOICE_LABEL, NEED } from '@/lib/model';
import type { Choice, Review } from '@/types';
import { LinkedText } from './bits';

interface Node {
  id: string;
  author: string;
  stage: StageId;
  stageName: string;
  city: string;
  choice: Choice;
  content: string;
  marks: number;
  marked: boolean;
}

interface Props {
  reviews: Review[];
  markCounts: Record<string, number>;
  markedIds: string[];
  currentStageId: StageId;
  onMark: (reviewId: string) => void;
  onExit: () => void;
}

const W = 1200;
const H = 640;
const COL_X = [170, 450, 730, 1010];

const CHOICE_TONE: Record<Choice, string> = {
  keep: '#4fd3a0',
  revise: '#f5c15a',
  rest: '#b7a6e8',
  switch: '#7fc8ff',
};

function short(text: string, n = 12) {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

export default function PeerNebula({
  reviews,
  markCounts,
  markedIds,
  currentStageId,
  onMark,
  onExit,
}: Props) {
  const [filter, setFilter] = useState<StageId | 'all'>('all');
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const nodes = useMemo<Node[]>(
    () =>
      reviews.map(r => ({
        id: r.id,
        author: r.authorName || '同处境者',
        stage: r.stage,
        stageName: STAGES.find(s => s.id === r.stage)?.name ?? r.stage,
        city: r.city || '城市未填',
        choice: r.choice,
        content: r.content.replace('[经验卡] ', ''),
        marks: markCounts[r.id] ?? 0,
        marked: markedIds.includes(r.id),
      })),
    [reviews, markCounts, markedIds]
  );

  const columns = useMemo(
    () =>
      STAGES.map((s, i) => ({
        key: s.id as StageId,
        title: s.name,
        sub: i === STAGES.findIndex(x => x.id === currentStageId) ? '你的阶段' : '',
        x: COL_X[i],
        list: nodes
          .filter(n => n.stage === s.id)
          .sort((a, b) => b.marks - a.marks),
      })),
    [nodes, currentStageId]
  );

  const placed = useMemo(
    () =>
      columns.flatMap(col =>
        col.list.map((n, i) => {
          const count = Math.max(1, col.list.length);
          const y = 148 + ((i + 0.5) / count) * 404;
          const x = col.x + (((i * 53) % 58) - 29);
          const r = 7 + Math.min(n.marks, 10) * 0.85;
          return { ...n, x, y, r };
        })
      ),
    [columns]
  );

  const defaultId =
    [...placed].sort((a, b) => b.marks - a.marks)[0]?.id ?? null;
  const activeId = hover ?? picked ?? defaultId;
  const active = placed.find(n => n.id === activeId) ?? null;
  const totalReal = reviews.length;
  const publicCount = reviews.filter(r => (markCounts[r.id] ?? 0) >= NEED)
    .length;

  const matches = (n: { stage: StageId }) =>
    filter === 'all' || n.stage === filter;
  const dim = (n: { stage: StageId }) => !matches(n);

  /* 切换筛选时把右侧详情定位到该阶段的第一条；空列则显示空状态 */
  useEffect(() => {
    if (filter === 'all') return;
    const first = placed.find(matches);
    setPicked(first ? first.id : '__none__');
  }, [filter]);

  function onKey(e: KeyboardEvent<SVGGElement>, id: string) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      setPicked(id);
    }
  }

  return (
    <div
      className='y-neb'
      role='dialog'
      aria-modal='true'
      aria-label='同伴经验星云：按阶段和去向浏览公开复盘'
    >
      <div className='y-neb-head'>
        <div>
          <p className='y-neb-eyebrow'>STEP 04 · 同伴经验域 · 经验星云</p>
          <h3>把处境相近的人写下的经验摊开看</h3>
          <p className='y-neb-sub'>
            按阶段分列，节点大小表示有效标记数；共 3 个有效标记进入公共节点。自己的复盘不计入自己的归属。
          </p>
        </div>
        <div className='y-neb-head-actions'>
          <span className='y-neb-counts'>
            公开复盘 {totalReal} · 公共节点 {publicCount}
          </span>
          <button
            type='button'
            className='y-neb-exit'
            onClick={onExit}
            title='Esc 也可退出'
          >
            退出星云 ×
          </button>
        </div>
      </div>

      <div className='y-neb-filters' role='group' aria-label='按阶段筛选'>
        <button
          type='button'
          className={filter === 'all' ? 'is-on' : ''}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        {STAGES.map(s => (
          <button
            key={s.id}
            type='button'
            className={filter === s.id ? 'is-on' : ''}
            aria-pressed={filter === s.id}
            onClick={() => setFilter(s.id)}
          >
            {s.name}
            {s.id === currentStageId ? <i>你</i> : null}
          </button>
        ))}
      </div>

      <div className='y-neb-body'>
        <div className='y-neb-stage'>
          <div className='y-neb-canvas'>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role='group'
              aria-label='经验星云图'
            >
              <title>同伴经验星云</title>
              <desc>
                四个阶段列；节点颜色表示归档时的下一步选择，大小表示有效标记数。
              </desc>
              <defs>
                <radialGradient id='nebGlow' cx='50%' cy='50%' r='50%'>
                  <stop offset='0%' stopColor='#7fc8ff' stopOpacity='0.35' />
                  <stop offset='100%' stopColor='#7fc8ff' stopOpacity='0' />
                </radialGradient>
                <filter id='nebSoft' x='-40%' y='-40%' width='180%' height='180%'>
                  <feDropShadow
                    dx='0'
                    dy='0'
                    stdDeviation='7'
                    floodColor='#7fc8ff'
                    floodOpacity='0.45'
                  />
                </filter>
              </defs>

              {Array.from({ length: 54 }, (_, i) => (
                <circle
                  key={`s-${i}`}
                  className='y-neb-star'
                  cx={(i * 211 + 47) % W}
                  cy={(i * 137 + 31) % H}
                  r={i % 6 === 0 ? 1.6 : 0.9}
                  style={{ animationDelay: `${((i * 29) % 90) / 10}s` }}
                />
              ))}

              {columns.map(col => {
                const isDim = filter !== 'all' && col.key !== filter;
                return (
                  <g
                    key={col.key}
                    className={`y-neb-col${isDim ? ' is-dim' : ''}${
                      col.key === currentStageId ? ' is-mine' : ''
                    }`}
                  >
                    <ellipse
                      cx={col.x}
                      cy={330}
                      rx={140}
                      ry={300}
                      fill='url(#nebGlow)'
                      className='y-neb-col-glow'
                    />
                    <line
                      x1={col.x}
                      y1={100}
                      x2={col.x}
                      y2={600}
                      className='y-neb-guide'
                    />
                    <text
                      x={col.x}
                      y={58}
                      textAnchor='middle'
                      className='y-neb-col-title'
                    >
                      {col.title}
                    </text>
                    <text
                      x={col.x}
                      y={76}
                      textAnchor='middle'
                      className='y-neb-col-sub'
                    >
                      {col.sub
                        ? `${col.sub} · ${col.list.length} 条`
                        : `${col.list.length} 条`}
                    </text>
                    {!col.list.length ? (
                      <text
                        x={col.x}
                        y={330}
                        textAnchor='middle'
                        className='y-neb-empty-col'
                      >
                        暂无公开复盘
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {placed.map(n => {
                const isActive = n.id === activeId;
                const isPicked = n.id === picked;
                const faded = dim(n) && !isActive;
                const isPublic = n.marks >= NEED;
                const showLabel = isPublic || isActive;
                return (
                  <g
                    key={n.id}
                    className={`y-neb-node${faded ? ' is-dim' : ''}${
                      isActive ? ' is-active' : ''
                    }${isPicked ? ' is-picked' : ''}${
                      isPublic ? ' is-public' : ''
                    }`}
                    role='button'
                    tabIndex={0}
                    aria-label={`${n.author}，${n.stageName}，有效标记 ${n.marks}`}
                    onClick={() => setPicked(n.id)}
                    onKeyDown={e => onKey(e, n.id)}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() =>
                      setHover(h => (h === n.id ? null : h))
                    }
                  >
                    <title>
                      {`${n.author} · ${n.stageName} · ${n.marks} 个有效标记`}
                    </title>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.r + 9}
                      className='y-neb-hit'
                    />
                    {isActive ? (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={n.r + 13}
                        className='y-neb-halo'
                      />
                    ) : null}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.r}
                      className='y-neb-dot'
                      style={{
                        fill: CHOICE_TONE[n.choice] ?? '#c4bdb0',
                      }}
                      filter={isPublic ? 'url(#nebSoft)' : undefined}
                    />
                    {showLabel ? (
                      <text
                        x={n.x}
                        y={n.y + n.r + 13}
                        textAnchor='middle'
                        className='y-neb-label'
                      >
                        {short(n.author.replace('同处境者 · ', ''), 10)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className='y-neb-legend'>
            {Object.entries(CHOICE_LABEL).map(([k, label]) => (
              <span key={k}>
                <i style={{ background: CHOICE_TONE[k as Choice] }} />
                {label}
              </span>
            ))}
            <span className='y-neb-hint'>节点越大 = 有效标记越多 · 点击查看全文</span>
          </div>
        </div>

        <aside className='y-neb-side' aria-live='polite'>
          {active ? (
            <>
              <div className='y-neb-side-head'>
                <span className='y-neb-side-eyebrow'>
                  '公开复盘'
                </span>
                <span className='y-neb-side-stage'>{active.stageName}</span>
              </div>
              <h3>{active.author}</h3>
              <div className='y-neb-tags'>
                <span
                  className='is-choice'
                  style={{ color: CHOICE_TONE[active.choice] }}
                >
                  {CHOICE_LABEL[active.choice]}
                </span>
                <span>{active.city}</span>
                <span className='is-marks'>
                  {active.marks} 个有效标记
                  {active.marks < NEED ? ` / ${NEED}` : ''}
                </span>
                {active.marks >= NEED ? (
                  <span className='is-public'>公共节点</span>
                ) : null}
                {active.marked ? <span>已标记</span> : null}
              </div>

              <div className='y-neb-meter' aria-hidden='true'>
                <i
                  style={{
                    width: `${Math.min(100, (active.marks / NEED) * 100)}%`,
                  }}
                />
              </div>

              <p className='y-neb-content'>
                <LinkedText text={active.content} />
              </p>

              <div className='y-neb-side-actions'>
                <button
                  type='button'
                  className='y-neb-btn is-main'
                  disabled={active.marked}
                  onClick={() => onMark(active.id)}
                >
                  {active.marked ? '已标记为有效' : '标记为有效'}
                </button>
                <button
                  type='button'
                  className='y-neb-btn'
                  onClick={onExit}
                >
                  退出星云
                </button>
              </div>

              <p className='y-neb-foot'>
                有效标记来自不同用户；自己的复盘不参与自己的归属计算。
              </p>
            </>
          ) : (
            <p className='y-neb-empty'>
              {filter === 'all'
                ? '还没有可展示的复盘。完成一次归档并将其提交到校验池后，这里会出现你的节点。'
                : '这个筛选下还没有可展示的复盘。可以切回「全部」，或先提交一条自己的复盘。'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
