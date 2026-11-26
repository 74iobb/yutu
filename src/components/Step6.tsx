import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { SIX_BODY_TYPES } from '@/data/catalog';
import {
  CHOICE_LABEL,
  clampDim,
  currentStage,
  DIM_MAP,
  DRIFT,
  DIMS,
  NEED,
  nearestNode,
  proj,
  STATUS_LABEL,
  STATUS_LABEL as STATUS,
  simBand,
} from '@/lib/model';
import { openStep34 } from '@/lib/stepNav';
import { buildBackupJson, copyText, downloadText } from '@/lib/summary';
import { useImmersive } from '@/lib/uiMotion';
import { useYutu } from '@/store/YutuContext';
import { Chip, Empty, LinkedText, Say } from './bits';
import DataSourceBadge from './DataSourceBadge';
import FlowerBloom from './FlowerBloom';
import GapPhoto from './GapPhoto';
import LoopMap, {
  LOOP_STATIONS,
  loopStationIndex,
  type LoopStationKey,
} from './LoopMap';
import TrendChart from './TrendChart';
import ChartFrame from './ChartFrame';
import GrowthRiver from './GrowthRiver';
import GrowthRadar from './GrowthRadar';
import MemoryPanel from './MemoryPanel';
import { ReviewDiscussion } from './DiscussionThread';
import { ReviewMediaPanel } from './MediaGallery';
import PeerNebula from './PeerNebula';
import PeerSamples from './PeerSamples';
import PeerSearch from './PeerSearch';
import SoulCard from './SoulCard';
import type {
  Choice,
  DimensionKey,
  LoopArchive,
  PrototypeNode,
  Scores,
} from '@/types';

/** 「回看落点」统一回到第 3 步的「归属与摘要」视图 */
function goLanding(setStep: (n: number) => void) {
  openStep34('summary');
  setStep(3);
}

/** 指标数字缓动，让状态变化看得见 */
function useCountUp(value: number, ms = 420) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('y-motion-off'))
    ) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return shown;
}

/** 进度条：挂载后再长到目标宽度，产生「推进」的动效 */
function GrowBar({ pct }: { pct: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setW(Math.max(0, Math.min(100, pct))), 40);
    return () => window.clearTimeout(t);
  }, [pct]);
  return <i style={{ width: `${w}%` }} />;
}

/** 归档前后的向量漂移对比 */
function DriftPanel({
  before,
  after,
  choice,
  moved = true,
}: {
  before: Scores;
  after: Scores;
  choice: Choice;
  moved?: boolean;
}) {
  if (!moved) {
    return (
      <p className='y-note'>
        这一轮没有改变你的处境——成长会留下来，但不一定立刻移动位置。
      </p>
    );
  }
  const keys = Object.keys(DRIFT[choice]) as DimensionKey[];
  if (!keys.length) {
    return (
      <p className='y-note'>该选项不改变向量，只记录这一次判断。</p>
    );
  }
  return (
    <div className='y-drift'>
      {keys.map((k) => {
        const d = DIM_MAP[k];
        const from = before[k];
        const to = after[k];
        const delta = to - from;
        const pct =
          ((to - d.min) / Math.max(1, d.max - d.min)) * 100;
        return (
          <div className='y-drift-row' key={k}>
            <span className='y-drift-n'>{d.n}</span>
            <div className='y-drift-bar'>
              <GrowBar pct={pct} />
            </div>
            <b className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>
              {from}
              <i>→</i>
              {to}
              <em>{delta > 0 ? `+${delta}` : delta}</em>
            </b>
          </div>
        );
      })}
    </div>
  );
}

/** 归档完成卡：本轮闭合 + 漂移 + 方向是否变化 */
function LoopDone({
  data,
  remaining,
  onDirectionChoice,
  onMap,
  onWall,
  onContinue,
  onClose,
}: {
  data: LoopArchive;
  remaining: number;
  onDirectionChoice: (changed: boolean, resting: boolean) => void;
  onMap: () => void;
  onWall: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const { state } = useYutu();
  const resting = data.choice === 'rest';
  /* 旧记录没有 moved 字段：当时确实应用了漂移，按 true 处理 */
  const moved = data.moved !== false;
  return (
    <div className='y-loop-done' role='status'>
      <span className='y-loop-glass-flare' aria-hidden='true' />
      <div className='y-loop-done-head'>
        <span className='y-loop-check-big' aria-hidden='true'>
          ✓
        </span>
        <div>
          <b>第 {data.no} 次阶段性胜利已归档，本轮闭环完成</b>
          <p>
            下一步：{CHOICE_LABEL[data.choice]}。
            {resting
              ? '这次以休整收尾，系统不推送新任务，等你准备好再回来。'
              : remaining
                ? `还有 ${remaining} 条体验在本轮清单里，可以继续做完，也可以先做方向判断。`
                : moved
                  ? '位置已小幅漂移，回第 3 步可以看到新的落点。'
                  : '这一轮没有改变你的处境——成长会留下来，位置不一定马上移动。'}
          </p>
        </div>
        <button
          type='button'
          className='y-loop-done-x'
          aria-label='收起本轮结果'
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <DriftPanel
        before={data.before}
        after={data.after}
        choice={data.choice}
        moved={data.moved !== false}
      />
      {state.snapshot0 ? (
        <div className='y-loop-radar'>
          <GrowthRadar
            before={state.snapshot0}
            after={data.after}
            beforeLabel='起点'
            afterLabel={`第 ${data.no} 次归档后`}
            compact
          />
        </div>
      ) : null}
      {data.domain ? (
        <p className='y-loop-new'>
          {moved ? '新落点：' : '本轮落点：'}
          <b>{data.domain.split(' · ')[0]}</b> · 接近度{' '}
          {simBand(data.sim ?? 0)}
        </p>
      ) : null}

      <div className='y-loop-direction'>
        <p className='y-loop-direction-q'>
          完成这次闭环后，你要走的方向是否发生变化？
        </p>
        <div className='y-row'>
          <button
            type='button'
            className='y-btn y-btn-main y-btn-s'
            onClick={() => onDirectionChoice(false, resting)}
          >
            {resting
              ? '方向没变 · 保持休整，回工作台'
              : remaining
                ? `方向没变 · 继续本轮（还剩 ${remaining} 条）→`
                : `方向没变 · 开启第 ${data.no + 1} 轮 →`}
          </button>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => onDirectionChoice(true, false)}
          >
            方向变了 · 回第 1 步重新填写 →
          </button>
        </div>
        <p className='y-note'>
          「方向没变」会沿用当前处境与归属；「方向变了」会回到第 1
          步重新确认处境与方向，已归档的胜利与历史任务保留。
        </p>
      </div>

      <div className='y-row' style={{ marginTop: 10 }}>
        {remaining ? (
          <button type='button' className='y-btn y-btn-s' onClick={onContinue}>
            回工作台继续本轮（还剩 {remaining} 条）
          </button>
        ) : null}
        <button type='button' className='y-btn y-btn-s' onClick={onMap}>
          回第 3 步看新落点
        </button>
        <button type='button' className='y-btn y-btn-s' onClick={onWall}>
          去档案墙
        </button>
      </div>
    </div>
  );
}

function MiniMap({
  snap,
  nodes,
  title,
}: {
  snap: Scores;
  nodes: PrototypeNode[];
  title: string;
}) {
  const best = nearestNode(snap, nodes);
  const sc = (p: { x: number; y: number }) => ({
    x: 26 + ((p.x - 30) / 460) * 220,
    y: 12 + ((p.y - 32) / 316) * 164,
  });
  const uid = useId().replace(/:/g, '');
  const bgId = `miniBg-${uid}`;
  const glowId = `miniGlow-${uid}`;
  const m = sc(proj(snap));
  const bp = sc(proj(best.node.s));
  const flightD = (() => {
    const dx = bp.x - m.x;
    const dy = bp.y - m.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 5) return '';
    const cx = (m.x + bp.x) / 2 - (dy / len) * len * 0.16;
    const cy = (m.y + bp.y) / 2 + (dx / len) * len * 0.16;
    return `M${m.x.toFixed(1)},${m.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bp.x.toFixed(1)},${bp.y.toFixed(1)}`;
  })();
  return (
    <svg viewBox='0 0 260 190' role='img' aria-label={title}>
      <defs>
        <linearGradient id={bgId} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#fffefb' />
          <stop offset='100%' stopColor='#f1eee7' />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset='0%' stopColor='#0e5b4c' stopOpacity='0.22' />
          <stop offset='100%' stopColor='#0e5b4c' stopOpacity='0' />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={260} height={190} fill={`url(#${bgId})`} />
      {Array.from({ length: 9 }, (_, i) => 26 + i * 27.5).map(x => (
        <line
          key={`x${x}`}
          x1={x}
          y1={12}
          x2={x}
          y2={176}
          stroke='#f1eee7'
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: 7 }, (_, i) => 12 + i * 27.3).map(y => (
        <line
          key={`y${y}`}
          x1={26}
          y1={y}
          x2={246}
          y2={y}
          stroke='#f1eee7'
          strokeWidth={1}
        />
      ))}
      {nodes
        .filter(n => !n.own)
        .map(n => {
          const p = sc(proj(n.s));
          return (
            <circle
              key={n.id}
              cx={p.x}
              cy={p.y}
              r={n.id === best.node.id ? 5 : 3.2}
              fill={n.id === best.node.id ? '#0e5b4c' : '#c4bdb0'}
            />
          );
        })}
      {flightD ? (
        <path
          d={flightD}
          className='y-mini-flight'
          fill='none'
          stroke='#7fb59a'
          strokeWidth={1.1}
          pointerEvents='none'
        />
      ) : null}
      <circle
        cx={m.x}
        cy={m.y}
        r={16}
        fill={`url(#${glowId})`}
        className='y-mini-pulse'
      />
      <circle cx={m.x} cy={m.y} r={4.5} fill='#0e5b4c' stroke='#fffefb' strokeWidth={1.5} />
      <text
        x={bp.x + 7}
        y={bp.y - 7}
        fontSize={8.5}
        fill='#0e5b4c'
        fontWeight={600}
      >
        {best.node.name.split(' · ')[0]}
      </text>
      {[0, 50, 100].map(v => {
        const px = 26 + (v / 100) * 220;
        const py = 176 - (v / 100) * 164;
        return (
          <g key={v}>
            <text
              x={px}
              y={186}
              textAnchor={v === 0 ? 'start' : v === 100 ? 'end' : 'middle'}
              fontSize={8.5}
              fill='#aba79e'
            >
              {v}
            </text>
            <text
              x={23}
              y={py + 3}
              textAnchor='end'
              fontSize={8.5}
              fill='#aba79e'
            >
              {v}
            </text>
          </g>
        );
      })}
      <text x={246} y={9} textAnchor='end' fontSize={9.5} fill='#8d887e'>
        横轴 资源余量 ／ 纵轴 探索倾向
      </text>
    </svg>
  );
}

function BenchTab() {
  const {
    state,
    nodes,
    setFilter,
    loadNodeTasks,
    addCustomTask,
    updateTaskStatus,
    removeTask,
    currentRank,
    setSub,
    flash,
  } = useYutu();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('营利组织体验');
  const [err, setErr] = useState('');
  const rank = currentRank();
  const cur = rank[0];
  const [domainId, setDomainId] = useState<string>(cur?.node.id ?? '');
  const node = nodes.find((n) => n.id === domainId) ?? cur?.node;

  const activeTasks = state.tasks.filter((t) => !t.archived);
  const archivedTasks = state.tasks.filter((t) => t.archived);
  const visible = activeTasks.filter(
    (t) => state.filter === 'all' || t.status === state.filter
  );
  const doing = activeTasks.filter((t) => t.status === 'doing').length;
  const done = activeTasks.filter((t) => t.status === 'done').length;
  const pct = activeTasks.length
    ? Math.round((done / activeTasks.length) * 100)
    : 0;
  const round = state.victories.length + 1;

  function submit() {
    if (title.trim().length < 4) {
      setErr('请把任务写清楚一些（至少 4 个字），已输入的内容不会丢失。');
      return;
    }
    addCustomTask(title, type);
    setTitle('');
    setErr('');
    setOpen(false);
    if (state.filter !== 'all' && state.filter !== 'doing') {
      flash('已加入清单（进行中），但当前筛选条件下不显示。');
    }
  }

  function claim() {
    if (!node) return;
    loadNodeTasks(node);
  }

  function complete(id: string) {
    updateTaskStatus(id, 'done');
    flash('已标记完成。完成任意一条，就可以去「停靠驿站」闭合本轮。');
  }

  return (
    <>
      <div className='y-card'>
        <h3>
          体验工作台<span className='y-mini'>系统只给草稿，编辑权完全归你</span>
        </h3>
        <p className='y-note' style={{ paddingBottom: 8 }}>
          状态只有四种中性标签，没有逾期提醒，也没有红色警示。暂停、修改、放弃都是被接纳的合法选择。
        </p>

        <div className='y-round'>
          <div className='y-round-head'>
            <b>第 {round} 轮</b>
            <span>
              {activeTasks.length
                ? `本轮 ${done} / ${activeTasks.length} 条已完成 · ${doing} 条进行中`
                : '本轮清单是空的'}
            </span>
            {archivedTasks.length ? (
              <em>历史归档 {archivedTasks.length} 条</em>
            ) : null}
          </div>
          <div className='y-round-bar'>
            <GrowBar pct={pct} />
          </div>
        </div>

        <div className='y-row y-round-actions'>
          <div className='y-row'>
            <label htmlFor='y-domain' style={{ margin: '0 2px 0 0' }}>
              本轮方向
            </label>
            <select
              id='y-domain'
              style={{ width: 'auto', minWidth: 132 }}
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
            >
              {rank.slice(0, 6).map((r) => (
                <option key={r.node.id} value={r.node.id}>
                  {r.node.name.split(' · ')[0]} · {simBand(r.sim)}
                </option>
              ))}
            </select>
            <button type='button' className='y-btn y-btn-s' onClick={claim}>
              领取参考任务
            </button>
            <DataSourceBadge source='referenceTasks' showLabel={false} />
          </div>
          <div className='y-row'>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => {
                setOpen((o) => !o);
              }}
            >
              ＋ 新增自定义任务
            </button>
          </div>
        </div>

        {done ? (
          <div className='y-loop-hint'>
            <b>{done} 条已完成待归档</b>
            <span>去「停靠驿站」完成一次闭环，再开始下一轮。</span>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => setSub(2)}
            >
              去停靠驿站 →
            </button>
          </div>
        ) : null}

        {open ? (
          <div
            style={{
              marginTop: 10,
              borderTop: '1px dashed var(--y-line)',
              paddingTop: 11,
            }}
          >
            <div className='y-gs'>
              <div>
                <label htmlFor='y-add-title'>任务内容</label>
                <input
                  type='text'
                  id='y-add-title'
                  placeholder='例：找两位在施工单位做过一年的师兄做访谈'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              </div>
              <div>
                <label htmlFor='y-add-type'>六体分类</label>
                <select
                  id='y-add-type'
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {SIX_BODY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            {err ? (
              <p
                className='y-flash'
                style={{ color: 'var(--y-warm)' }}
                role='alert'
              >
                {err}
              </p>
            ) : null}
            <div className='y-row' style={{ marginTop: 8 }}>
              <button
                type='button'
                className='y-btn y-btn-main y-btn-s'
                onClick={submit}
              >
                加入清单
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => {
                  setOpen(false);
                  setTitle('');
                  setErr('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className='y-card'>
        <div className='y-card-head'>
          <h3>
            本轮任务
            <span className='y-mini'>
              标记完成后，闭环会亮起「停靠驿站」
            </span>
          </h3>
          <div className='y-tools'>
            <label htmlFor='y-filter'>状态</label>
            <select
              id='y-filter'
              value={state.filter}
              onChange={(e) => setFilter(e.target.value as typeof state.filter)}
            >
              <option value='all'>全部</option>
              <option value='doing'>进行中</option>
              <option value='done'>已完成</option>
              <option value='hold'>暂时搁置</option>
              <option value='drop'>选择放弃</option>
            </select>
          </div>
        </div>

        {!activeTasks.length ? (
          <Empty>
            <p>
              {state.victories.length
                ? `上一轮已闭合，现在是第 ${round} 轮。领一批新任务，或自己写一条。`
                : '清单还是空的。点「领取参考任务」，或直接新增一条自定义任务。'}
            </p>
            <div className='y-row' style={{ marginTop: 9 }}>
              <button type='button' className='y-btn y-btn-s' onClick={claim}>
                领取第 {round} 轮参考任务
              </button>
            </div>
          </Empty>
        ) : !visible.length ? (
          <Empty>
            <p>
              当前筛选条件下没有任务，本轮共有 {activeTasks.length} 项被隐藏。
            </p>
            <button
              type='button'
              className='y-btn y-btn-s'
              style={{ marginTop: 9 }}
              onClick={() => setFilter('all')}
            >
              清除筛选
            </button>
          </Empty>
        ) : (
          visible.map((t) => (
            <div
              key={t.id}
              className={`y-task${t.status === 'hold' ? ' is-hold' : ''}${
                t.status === 'drop' ? ' is-drop' : ''
              }${t.status === 'done' ? ' is-done' : ''}`}
            >
              <div className='y-task-top'>
                <div style={{ minWidth: 0 }}>
                  <p className='y-task-ttl'>{t.title}</p>
                  <div style={{ marginTop: 4 }}>
                    <Chip tone='b'>{t.type}</Chip>
                    <Chip>{STATUS[t.status]}</Chip>
                    {t.custom ? <Chip tone='c'>自定义</Chip> : null}
                    {t.status === 'done' ? (
                      <Chip tone='w'>待归档</Chip>
                    ) : null}
                  </div>
                  <p className='y-task-meta'>
                    {[
                      ['经验出处', t.origin],
                      ['前置条件', t.pre],
                      ['风险提示', t.risk],
                      ['完成标准', t.std],
                    ]
                      .filter(([, v]) => v && v !== '—')
                      .map(([k, v], i) => (
                        <span key={k}>
                          {i ? <br /> : null}
                          <b>{k}：</b>
                          {v}
                        </span>
                      ))}
                  </p>
                </div>
                <div className='y-task-act'>
                  {t.status === 'done' ? (
                    <>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={() => setSub(2)}
                      >
                        去归档 →
                      </button>
                      <details className='y-task-more'>
                        <summary>更多</summary>
                        <button
                          type='button'
                          className='y-btn y-btn-s'
                          onClick={() => updateTaskStatus(t.id, 'doing')}
                        >
                          重新打开
                        </button>
                      </details>
                    </>
                  ) : (
                    <button
                      type='button'
                      className='y-btn y-btn-s'
                      onClick={() => complete(t.id)}
                    >
                      标记完成
                    </button>
                  )}
                  <select
                    aria-label={`任务状态：${t.title}`}
                    value={t.status}
                    onChange={(e) => {
                      updateTaskStatus(
                        t.id,
                        e.target.value as typeof t.status
                      );
                      flash(
                        `已更新为「${STATUS_LABEL[e.target.value as typeof t.status]}」。`
                      );
                    }}
                  >
                    {(
                      Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    onClick={() => {
                      removeTask(t.id);
                      flash('已移除。不适用的任务可以直接删掉。');
                    }}
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {archivedTasks.length ? (
          <details className='y-archive-fold'>
            <summary>
              历史归档 {archivedTasks.length} 条
              <span>已并入胜利档案，展开可回看</span>
            </summary>
            <div className='y-archive-list'>
              {archivedTasks.map((t) => (
                <div className='y-archive-item' key={t.id}>
                  <Chip tone='w'>已归档</Chip>
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </>
  );
}

function StationTab({
  reviewedAt,
  onDirectionChoice,
  onContinue,
}: {
  reviewedAt: number | null;
  onDirectionChoice: (changed: boolean, resting: boolean) => void;
  onContinue: () => void;
}) {
  const { state, ownerKey, archive, submitExperienceCard, setStep, setSub } =
    useYutu();
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [choice, setChoice] = useState<Choice>('keep');
  /**
   * 这一轮是否真的改变了处境。默认「没有变化」——
   * 成长会留下，但处境不一定跟着移动；要漂移需要用户显式选择。
   */
  const [moved, setMoved] = useState(false);
  const [card, setCard] = useState('');
  const [busy, setBusy] = useState(false);
  /** 停靠三步：拷问 → 回答三问 → 归档 */
  const [stationStep, setStationStep] = useState<1 | 2 | 3>(1);
  /** 仅仅收起这张结果卡；“方向是否变化”仍留在总览里，直到真正回答 */
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

  const archivable = state.tasks.filter(
    (t) => t.status === 'done' && !t.archived
  );
  const active = state.tasks.filter((t) => !t.archived);
  const round = state.victories.length + 1;
  const last = state.lastArchive;
  const drift = DRIFT[choice];

  const preview = useMemo(() => {
    const out: Scores = { ...state.profile.s };
    if (!moved) return out;
    (Object.keys(drift) as DimensionKey[]).forEach((k) => {
      const delta = drift[k];
      if (delta) out[k] = clampDim(k, out[k] + delta);
    });
    return out;
  }, [drift, moved, state.profile.s]);

  function doArchive() {
    if (!archivable.length || busy) return;
    setBusy(true);
    const v = archive(
      choice,
      {
        feel: q1.trim(),
        ctx: q2.trim(),
        vision: q3.trim(),
      },
      moved
    );
    if (v) {
      setQ1('');
      setQ2('');
      setQ3('');
      setMoved(false);
      setStationStep(1);
    }
    window.setTimeout(() => setBusy(false), 800);
  }

  return (
    <>
      {last && reviewedAt !== last.at && hiddenAt !== last.at ? (
        <LoopDone
          key={last.at}
          data={last}
          remaining={active.length}
          onDirectionChoice={onDirectionChoice}
          onMap={() => goLanding(setStep)}
          onWall={() => setSub(3)}
          onContinue={onContinue}
          onClose={() => setHiddenAt(last.at)}
        />
      ) : null}

      <div className='y-g2 y-g2-stretch'>
        <div className='y-card y-gap-card' data-station-step={stationStep}>
          <h3>
            停靠驿站
            <span className='y-mini'>
              第 {round} 轮 · 不推送新任务，不做成败判定
            </span>
          </h3>

          <div className='y-dock-stats'>
            <div>
              <b>{archivable.length}</b>
              <span>本轮可归档</span>
            </div>
            <div>
              <b>{active.length}</b>
              <span>本轮在手</span>
            </div>
            <div>
              <b>{state.victories.length}</b>
              <span>已完成闭环</span>
            </div>
          </div>

          <div className='y-station-steps' role='tablist' aria-label='停靠步骤'>
            {[
              { n: 1 as const, label: '拷问' },
              { n: 2 as const, label: '回答三问' },
              { n: 3 as const, label: '归档' },
            ].map((s) => (
              <button
                key={s.n}
                type='button'
                role='tab'
                aria-selected={stationStep === s.n}
                className={stationStep === s.n ? 'is-on' : undefined}
                onClick={() => setStationStep(s.n)}
              >
                <em>0{s.n}</em> {s.label}
              </button>
            ))}
          </div>

          <div className='y-station-pane is-ask'>
          <div style={{ marginBottom: 12 }}>
            <Say>
              先回到你出发时的处境：经济压力 {state.profile.s.econ}，家庭负担{' '}
              {state.profile.s.family}，年龄 {state.profile.s.age}{' '}
              岁。现在变了没有？
            </Say>
          </div>

          {active.length || state.victories.length ? (
            <SoulCard
              snapshot0={state.snapshot0}
              current={state.profile.s}
              tasks={state.tasks}
              victories={state.victories}
              reviews={state.reviews}
              discussions={state.discussions ?? []}
              ownerKey={ownerKey}
              compact
            />
          ) : null}
          <div className='y-row' style={{ marginTop: 12 }}>
            <button
              type='button'
              className='y-btn y-btn-main'
              onClick={() => setStationStep(2)}
            >
              去回答三问 →
            </button>
            {!archivable.length ? (
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(1)}
              >
                去工作台标记完成
              </button>
            ) : null}
          </div>
          <p className='y-note' style={{ paddingTop: 6 }}>
            {archivable.length
              ? '三问可以留空；但无有效内容的记录不会进入校验池。'
              : '本轮还没有标记完成的体验。可以先去工作台标记完成，或先记一张经验卡。'}
          </p>
          </div>

          <div className='y-station-pane is-answer'>
          <div style={{ marginBottom: 11 }}>
            <label htmlFor='y-q1'>这段体验带给我的真实感受是什么</label>
            <textarea
              id='y-q1'
              placeholder='不必写得完整，想到什么写什么。'
              value={q1}
              onChange={(e) => setQ1(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 11 }}>
            <label htmlFor='y-q2'>出发时的处境参数现在变了没有</label>
            <textarea
              id='y-q2'
              placeholder='经济压力、家庭责任、时间余量——哪一项和出发时不一样了。'
              value={q2}
              onChange={(e) => setQ2(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 11 }}>
            <label htmlFor='y-q3'>原来的远方愿景对我还重要吗</label>
            <textarea
              id='y-q3'
              placeholder='愿景是方向，可以长期保留，也可以修改。'
              value={q3}
              onChange={(e) => setQ3(e.target.value)}
            />
          </div>
          <div>
            <label>
              下一步打算怎么走
              <span style={{ color: 'var(--y-muted)' }}>
                （四者权重相同，没有哪一个更高级）
              </span>
            </label>
            <div className='y-opts'>
              {(Object.keys(CHOICE_LABEL) as Choice[]).map((c) => (
                <label
                  className={`y-opt-card${choice === c ? ' is-on' : ''}`}
                  key={c}
                >
                  <input
                    type='radio'
                    name='y-next'
                    value={c}
                    checked={choice === c}
                    onChange={() => setChoice(c)}
                  />
                  <span>
                    {CHOICE_LABEL[c]}
                    <em>
                      {c === 'keep'
                        ? '继续当前路线'
                        : c === 'revise'
                          ? '方向不变，换做法'
                          : c === 'rest'
                            ? '不推送新任务'
                            : '排除也是胜利'}
                    </em>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 11 }}>
            <label>
              这一轮之后，我的处境有变化吗
              <span style={{ color: 'var(--y-muted)' }}>
                （成长不一定立刻改变处境）
              </span>
            </label>
            <div className='y-opts'>
              <label
                className={`y-opt-card${!moved ? ' is-on' : ''}`}
              >
                <input
                  type='radio'
                  name='y-moved'
                  checked={!moved}
                  onChange={() => setMoved(false)}
                />
                <span>
                  没有变化
                  <em>只记录成长，向量不动</em>
                </span>
              </label>
              <label
                className={`y-opt-card${moved ? ' is-on' : ''}`}
              >
                <input
                  type='radio'
                  name='y-moved'
                  checked={moved}
                  onChange={() => setMoved(true)}
                />
                <span>
                  有一点变化
                  <em>按所选方向小幅漂移</em>
                </span>
              </label>
            </div>
          </div>

          <div className='y-row' style={{ marginTop: 13 }}>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => setStationStep(1)}
            >
              ← 回到拷问
            </button>
            <button
              type='button'
              className='y-btn y-btn-main'
              onClick={() => setStationStep(3)}
            >
              去归档 →
            </button>
          </div>
          <p className='y-note'>
            三问可以留空；但无有效内容的记录不会进入校验池。
          </p>
          </div>

          <div className='y-station-pane is-archive'>
          <div className='y-station-summary'>
            <div>
              <span>可归档</span>
              <b>{archivable.length} 条</b>
            </div>
            <div>
              <span>下一步</span>
              <b>{CHOICE_LABEL[choice]}</b>
            </div>
            <div>
              <span>自省</span>
              <b>{[q1, q2, q3].filter((x) => x.trim()).length} / 3</b>
            </div>
          </div>

          <p className='y-note' style={{ marginTop: 8 }}>
            {moved
              ? '这一轮会按所选方向小幅调整处境向量。'
              : '这一轮不改变处境向量——成长会留下，位置不一定马上移动。'}
          </p>

          <div className='y-row' style={{ marginTop: 13 }}>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => setStationStep(2)}
            >
              ← 回到三问
            </button>
            <button
              type='button'
              className='y-btn y-btn-main'
              disabled={!archivable.length || busy}
              onClick={doArchive}
            >
              {busy
                ? '正在归档…'
                : `归档并闭合第 ${round} 轮 →`}
            </button>
            {!archivable.length ? (
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(1)}
              >
                去工作台标记完成
              </button>
            ) : null}
          </div>
          <p className='y-note' style={{ paddingTop: 6 }}>
            {archivable.length
              ? '归档只针对已标记完成的体验；本轮没做完的任务会留在工作台，进入下一轮。'
              : '驿站不催促——先在任务上标记「已完成」，这里就会亮起。'}
          </p>

          <div
            style={{
              marginTop: 12,
              borderTop: '1px dashed var(--y-line)',
              paddingTop: 10,
            }}
          >
            <label htmlFor='y-card'>先记一张经验卡（比整条复盘更轻）</label>
            <textarea
              id='y-card'
              placeholder='一句话写清这段体验里可被他人复用的那条经验。'
              value={card}
              onChange={(e) => setCard(e.target.value)}
              style={{ minHeight: 48 }}
            />
            <div className='y-row' style={{ marginTop: 7 }}>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => {
                  submitExperienceCard(card);
                  if (card.trim().length >= 10) setCard('');
                }}
              >
                提交经验卡到校验池
              </button>
              {!state.backendOnline ? (
                <span className='y-chip'>离线时仅保存在本机</span>
              ) : null}
            </div>
            <p className='y-note' style={{ paddingTop: 5 }}>
              经验卡不改变向量，也不要求先完成整段体验；它和完整复盘一样进入同一个校验池。
            </p>
          </div>
          </div>
          {state.notice ? <p className='y-flash'>{state.notice}</p> : null}
          {!archivable.length ? (
            <p className='y-flash' style={{ color: 'var(--y-muted)' }}>
              驿站不催促——等真的完成一段再回来。
            </p>
          ) : null}
          <GapPhoto
            variant='sunrise'
            quote='休息也是路线的一部分。'
            still
          />
        </div>

        <div className='y-card y-gap-card'>
          <h3>可归档的已完成体验</h3>
          <p className='y-note' style={{ paddingBottom: 6 }}>
            阶段性胜利指在当前处境下完整走通一轮体验学习循环：完成体验、做出反思、形成一个对下一步有效的判断。
          </p>
          {!archivable.length ? (
            <Empty>
              还没有标记为「已完成」的体验。驿站不催促——等真的完成一段再回来。
            </Empty>
          ) : (
            archivable.map((t) => (
              <div className='y-pool' key={t.id}>
                <strong style={{ fontSize: 13 }}>{t.title}</strong>
                <p className='y-vic-body'>
                  {t.type} ｜ 完成标准：{t.std}
                </p>
              </div>
            ))
          )}
          <h4 style={{ fontSize: 12.5, fontWeight: 620, margin: '12px 0 5px' }}>
            {moved
              ? `选择「${CHOICE_LABEL[choice]}」后的向量漂移`
              : '本轮处境：不做改动'}
          </h4>
          <DriftPanel
            before={state.profile.s}
            after={preview}
            choice={choice}
            moved={moved}
          />
          {state.snapshot0 ? (
            <div style={{ marginTop: 10 }}>
              <GrowthRadar
                before={state.snapshot0}
                after={preview}
                beforeLabel='起点'
                afterLabel='本轮归档后（预估）'
                compact
              />
            </div>
          ) : null}
          <p className='y-note' style={{ paddingTop: 5 }}>
            {moved
              ? '所有更新都是小幅调整，不做跳变；地图上的移动呈现为缓慢漂移而非瞬间跳转。'
              : '这一轮只记录成长与判断，处境向量保持不变。'}
          </p>
          <GapPhoto variant='hills' quote='慢一点，也是在走。' />
        </div>
      </div>
    </>
  );
}

/** 七维前后对比条：比表格更直观地看到哪几维移动了 */
function DiffBars({ before, after }: { before: Scores; after: Scores }) {
  const changed = DIMS.filter(d => before[d.k] !== after[d.k]);
  return (
    <>
      <div className='y-diff-summary'>
        {changed.length ? (
          changed.map(d => {
            const delta = after[d.k] - before[d.k];
            return (
              <span
                key={d.k}
                className={delta > 0 ? 'is-up' : 'is-down'}
              >
                {d.n} {delta > 0 ? '+' : ''}
                {delta}
                {d.unit || ''}
              </span>
            );
          })
        ) : (
          <span className='is-flat'>两个时间点完全一致</span>
        )}
      </div>
      <div className='y-diff-list'>
      {DIMS.map((d, i) => {
        const a = before[d.k];
        const b = after[d.k];
        const delta = b - a;
        const span = Math.max(1, d.max - d.min);
        const aPct = Math.max(0, Math.min(100, ((a - d.min) / span) * 100));
        const bPct = Math.max(0, Math.min(100, ((b - d.min) / span) * 100));
        return (
          <div
            className='y-diff-row'
            key={d.k}
            title={`${d.n}：${a} → ${b}`}
          >
            <span>{d.n}</span>
            <div className='y-diff-track'>
              <i
                className='y-diff-before'
                style={{ width: `${aPct}%`, animationDelay: `${i * 50}ms` }}
              />
              <i
                className='y-diff-after'
                style={{ width: `${bPct}%`, animationDelay: `${i * 50}ms` }}
              />
            </div>
            <b>
              {a} → {b}
              <em className={delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}>
                {delta > 0 ? '+' : ''}
                {delta}
                {d.unit || ''}
              </em>
            </b>
          </div>
        );
      })}
      </div>
    </>
  );
}

function WallTab({ nodes }: { nodes: PrototypeNode[] }) {
  const { state } = useYutu();
  /** 成长画廊：把对比、成长曲线与时间轴铺成一屏，便于回看 */
  const [focus, setFocus] = useState(false);
  const [chartView, setChartView] = useState<'river' | 'line'>('river');
  /** 档案墙内部视图：记忆 / 曲线 / 档案 */
  const [wallView, setWallView] = useState<'memory' | 'curve' | 'archive'>(
    'memory'
  );
  useImmersive(focus, setFocus);
  const options = useMemo(
    () => [
      ...state.victories.map(v => ({
        id: v.id,
        label: `第 ${v.no} 次胜利（${v.at.slice(0, 10)}）`,
        snap: v.snap,
      })),
      { id: 'now', label: '当前位置', snap: state.profile.s },
    ],
    [state.victories, state.profile.s]
  );
  const [a, setA] = useState(options[0]?.id ?? 'now');
  const [b, setB] = useState(options[options.length - 1]?.id ?? 'now');
  const oa = options.find(o => o.id === a) ?? options[0];
  const ob = options.find(o => o.id === b) ?? options[options.length - 1];

  return (
    <>
      {focus ? (
        <button
          type='button'
          className='y-focus-backdrop'
          aria-label='退出成长画廊，返回页面'
          onClick={() => setFocus(false)}
        />
      ) : null}
      <div className={`y-wall-tab${focus ? ' is-focus' : ''}`}>
        {focus ? (
          <div className='y-wall-focus-head'>
            <div>
              <p className='y-eyebrow'>成长画廊 · 全屏</p>
              <h3>
                第 {state.victories.length} 次阶段性胜利 ·{' '}
                {state.victories.length
                  ? `${simBand(
                      state.victories[state.victories.length - 1]?.sim ?? 0
                    )} 接近度`
                  : '还没有归档'}
              </h3>
            </div>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={() => setFocus(false)}
              title='Esc 也可退出'
            >
              退出画廊 ×
            </button>
          </div>
        ) : null}
        <div className='y-wall-viewbar' role='tablist' aria-label='胜利档案墙视图'>
          <button
            type='button'
            role='tab'
            aria-selected={wallView === 'memory'}
            className={wallView === 'memory' ? 'is-on' : undefined}
            onClick={() => setWallView('memory')}
          >
            记忆
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={wallView === 'curve'}
            className={wallView === 'curve' ? 'is-on' : undefined}
            onClick={() => setWallView('curve')}
          >
            曲线
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={wallView === 'archive'}
            className={wallView === 'archive' ? 'is-on' : undefined}
            onClick={() => setWallView('archive')}
          >
            档案 <em>{state.victories.length}</em>
          </button>
        </div>
        <div className='y-wall-grid' data-view={wallView}>
      <MemoryPanel />
      <div className='y-card y-card--data y-wall-curve'>
        <h3>两点对比</h3>
        <div className='y-cmp-pick'>
          <div className='y-cmp-f'>
            <label htmlFor='y-cmp-a'>起点</label>
            <select id='y-cmp-a' value={a} onChange={e => setA(e.target.value)}>
              {options.map(o => (
                <option value={o.id} key={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className='y-cmp-f'>
            <label htmlFor='y-cmp-b'>终点</label>
            <select id='y-cmp-b' value={b} onChange={e => setB(e.target.value)}>
              {options.map(o => (
                <option value={o.id} key={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className='y-cmp'>
          {oa ? (
            <figure>
              <MiniMap
                snap={oa.snap}
                nodes={nodes}
                title={`起点小地图：${oa.label}`}
              />
              <figcaption>
                <b>起点：{oa.label}</b>
                归属 {nearestNode(oa.snap, nodes).node.name.split(' · ')[0]}
              </figcaption>
            </figure>
          ) : null}
          {ob ? (
            <figure>
              <MiniMap
                snap={ob.snap}
                nodes={nodes}
                title={`终点小地图：${ob.label}`}
              />
              <figcaption>
                <b>终点：{ob.label}</b>
                归属 {nearestNode(ob.snap, nodes).node.name.split(' · ')[0]}
              </figcaption>
            </figure>
          ) : null}
        </div>
        {oa && ob ? <DiffBars before={oa.snap} after={ob.snap} /> : null}
      </div>
      <ChartFrame
        className='y-wall-curve'
        eyebrow='成长图表'
        title={chartView === 'river' ? '成长河' : '成长曲线'}
        subtitle={
          chartView === 'river'
            ? '七维随归档次数流动；悬停横切查看当时的数值。'
            : '单维精确对比；切换维度看一维的变化。'
        }
        actions={
          <>
            <button
              type='button'
              className={`y-chart-tab${chartView === 'river' ? ' is-on' : ''}`}
              aria-pressed={chartView === 'river'}
              onClick={() => setChartView('river')}
            >
              成长河
            </button>
            <button
              type='button'
              className={`y-chart-tab${chartView === 'line' ? ' is-on' : ''}`}
              aria-pressed={chartView === 'line'}
              onClick={() => setChartView('line')}
            >
              单维曲线
            </button>
          </>
        }
        empty={
          !state.victories.length
            ? '完成一次驿站归档后，这里会出现你第一次的成长河。'
            : undefined
        }
        foot={<><DataSourceBadge source='archive' /> <span>只反映你自己的变化，不设排名与目标线。</span></>}
      >
        {chartView === 'river' ? (
          <GrowthRiver
            victories={state.victories}
            current={state.profile.s}
          />
        ) : (
          <TrendChart victories={state.victories} current={state.profile.s} />
        )}
      </ChartFrame>

      <div className='y-card y-card--evidence y-wall-archive'>
        <h3>
          阶段性胜利时间轴 <DataSourceBadge source='archive' showLabel={false} />
          {state.victories.length && !focus ? (
            <button
              type='button'
              className='y-btn y-btn-s y-wall-focus-btn'
              onClick={() => setFocus(true)}
              title='铺满视口查看对比、曲线与完整时间轴'
            >
              沉浸查看
            </button>
          ) : null}
        </h3>
        {!state.victories.length ? (
          <Empty>
            档案墙还是空的。完成一段体验、在驿站做完反思之后，第一次阶段性胜利就会出现在这里。
          </Empty>
        ) : (
          <>
            <div className='y-wall-summary'>
              <div>
                <b>{state.victories.length}</b>
                <span>次阶段性胜利</span>
              </div>
              <div>
                <b>
                  {state.victories.reduce((sum, v) => sum + v.tasks.length, 0)}
                </b>
                <span>段完成体验</span>
              </div>
              <div>
                <b>
                  {simBand(
                    state.victories[state.victories.length - 1]?.sim ?? 0
                  )}
                </b>
                <span>最近归档接近度</span>
              </div>
            </div>

            <div className='y-wall'>
              {[...state.victories].reverse().map(v => (
                <article
                  className={`y-wall-item choice-${v.choice}`}
                  key={v.id}
                >
                  <div className='y-wall-rail' aria-hidden='true'>
                    <i />
                  </div>
                  <div className='y-wall-card'>
                    <div className='y-vic-top'>
                      <strong style={{ fontSize: 13.5 }}>
                        第 {v.no} 次阶段性胜利
                      </strong>
                      <span className='y-vic-ts'>{v.at}</span>
                    </div>
                    <div className='y-wall-meta'>
                      <Chip tone='c'>{CHOICE_LABEL[v.choice]}</Chip>
                      <Chip>{v.domain.split(' · ')[0]}</Chip>
                      <span>接近度 {simBand(v.sim)}</span>
                      <span>完成 {v.tasks.length} 段体验</span>
                    </div>
                    <p className='y-wall-basis'>
                      依据：完成 {v.tasks.length} 段体验 · 自省{' '}
                      <span className='y-basis-dots' aria-hidden='true'>
                        <i className={v.answers.feel ? 'is-on' : ''} />
                        <i className={v.answers.ctx ? 'is-on' : ''} />
                        <i className={v.answers.vision ? 'is-on' : ''} />
                      </span>
                      {[v.answers.feel, v.answers.ctx, v.answers.vision].filter(
                        x => x && x.trim().length > 0
                      ).length}
                      /3 问 · 归属 {v.domain.split(' · ')[0]}
                    </p>
                    <p className='y-vic-body'>
                      完成体验：{v.tasks.map(x => x.title).join('；')}
                    </p>
                    <details className='y-wall-more'>
                      <summary className='y-wall-more-btn'>
                        查看依据与自省原文
                      </summary>
                      <p className='y-vic-body'>
                        {v.answers.feel || v.answers.ctx || v.answers.vision
                          ? [
                              v.answers.feel && `真实感受：${v.answers.feel}`,
                              v.answers.ctx && `处境变化：${v.answers.ctx}`,
                              v.answers.vision && `愿景：${v.answers.vision}`,
                            ]
                              .filter(Boolean)
                              .join(' ／ ')
                          : '本次未填写文字，仅记录了下一步选择。'}
                      </p>
                      <p
                        className='y-vic-body'
                        style={{ color: 'var(--y-muted)' }}
                      >
                        向量快照 —{' '}
                        {DIMS.map(d => `${d.n} ${v.snap[d.k]}`).join('，')}
                      </p>
                      <p
                        className='y-vic-body'
                        style={{ color: 'var(--y-muted)' }}
                      >
                        归档时归属 — {v.domain}
                      </p>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
        </div>
      </div>
    </>
  );
}

/** 清空本机历史数据：删掉所有 yutu.* 本地键与一次性视图记忆，并换一个新的本机标识。 */
function clearLocalHistory(): void {
  try {
    [
      'yutu.state.v3',
      'yutu.state.v2',
      'yutu.sandbox.v2',
      'yutu.sandbox.v1',
      'yutu.assessment.v1',
      'yutu.marked',
      'yutu.dropApplied',
      'yutu.lastActive',
      'yutu.ownerKey',
    ].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('yutu.view34');
  } catch {
    /* 本地存储不可用时直接刷新 */
  }
  window.location.reload();
}

function PeersTab() {
  const {
    state,
    submitVictoryReview,
    markReview,
    refreshReviews,
    markedIds,
    ownerKey,
    flash,
  } = useYutu();
  const submitted = new Set(state.pool.map(p => p.vid));
  const unsubmitted = state.victories.filter(v => !submitted.has(v.id));
  const poolReviewIds = new Set(state.pool.map(p => p.reviewId));
  const ownReviews = state.reviews.filter(
    r => r.authorKey === ownerKey && !poolReviewIds.has(r.id)
  );
  const publicReviews = state.reviews.filter(r => r.authorKey !== ownerKey);
  /** 经验星云：把公开复盘按阶段排成星云，便于发现与标记 */
  const [nebula, setNebula] = useState(false);
  /** 清空本机历史数据的二次确认 */
  const [confirmClear, setConfirmClear] = useState(false);
  useImmersive(nebula, setNebula);
  /** 同伴经验域内部视图：共建 / 我的 / 数据 */
  const [peerView, setPeerView] = useState<'build' | 'mine' | 'data'>(
    'build'
  );

  // 贡献者影响力：只统计自己的复盘被同处境用户标记有效的次数，不排名
  const myReviews = state.reviews.filter(r => r.authorKey === ownerKey);
  const myPublic = myReviews.filter(r => (state.markCounts[r.id] ?? 0) >= NEED);
  const myMarks = myReviews.reduce(
    (sum, r) => sum + (state.markCounts[r.id] ?? 0),
    0
  );
  const avgProgress = myReviews.length
    ? Math.min(100, Math.round((myMarks / (myReviews.length * NEED)) * 100))
    : 0;
  const bestMarks = myReviews.reduce(
    (m, r) => Math.max(m, state.markCounts[r.id] ?? 0),
    0
  );
  const nextGap = Math.max(0, NEED - bestMarks);
  /* 讨论贡献：自己参与的讨论数，以及别人对自己讨论的回复数 */
  const allDiscussions = state.discussions ?? [];
  const myDiscussions = allDiscussions.filter(
    d => d.authorKey === ownerKey
  );
  const myDiscussionIds = new Set(myDiscussions.map(d => d.id));
  const repliesToMe = allDiscussions.filter(
    d => myDiscussionIds.has(d.parentId) && d.authorKey !== ownerKey
  ).length;
  /* 讨论热度：平台聚合优先，离线时用本机讨论兜底 */
  const [reviewSort, setReviewSort] = useState<'recent' | 'hot'>('recent');
  const statsMap = useMemo(() => {
    const map = new Map<string, { count: number; people: number }>();
    (state.discussionStats ?? []).forEach(s =>
      map.set(s.reviewId, { count: s.count, people: s.people })
    );
    const local = new Map<string, { count: number; authors: Set<string> }>();
    allDiscussions.forEach(d => {
      const cur = local.get(d.reviewId) ?? {
        count: 0,
        authors: new Set<string>(),
      };
      cur.count += 1;
      cur.authors.add(d.authorKey);
      local.set(d.reviewId, cur);
    });
    local.forEach((g, id) => {
      const remote = map.get(id);
      map.set(id, {
        count: Math.max(remote?.count ?? 0, g.count),
        people: Math.max(remote?.people ?? 0, g.authors.size),
      });
    });
    return map;
  }, [state.discussionStats, allDiscussions]);
  const statFor = (reviewId: string) =>
    statsMap.get(reviewId) ?? { count: 0, people: 0 };
  const hotCount = publicReviews.filter(
    r => statFor(r.id).people >= 3
  ).length;
  const sortedPublic = useMemo(() => {
    const list = [...publicReviews];
    if (reviewSort === 'hot') {
      list.sort((a, b) => {
        const sa = statsMap.get(a.id) ?? { count: 0, people: 0 };
        const sb = statsMap.get(b.id) ?? { count: 0, people: 0 };
        const ha = (state.markCounts[a.id] ?? 0) + sa.people;
        const hb = (state.markCounts[b.id] ?? 0) + sb.people;
        return (
          hb - ha ||
          sb.count - sa.count ||
          b.createdAt.localeCompare(a.createdAt)
        );
      });
    } else {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [publicReviews, reviewSort, state.markCounts, statsMap]);

  return (
    <>
    <div className='y-g2 y-g2-stretch y-peers' data-view={peerView}>
      <div className='y-peer-viewbar' role='tablist' aria-label='同伴经验域视图'>
        <button
          type='button'
          role='tab'
          aria-selected={peerView === 'build'}
          className={peerView === 'build' ? 'is-on' : undefined}
          onClick={() => setPeerView('build')}
        >
          共建 <em>{publicReviews.length}</em>
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={peerView === 'mine'}
          className={peerView === 'mine' ? 'is-on' : undefined}
          onClick={() => setPeerView('mine')}
        >
          我的 <em>{myReviews.length}</em>
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={peerView === 'data'}
          className={peerView === 'data' ? 'is-on' : undefined}
          onClick={() => setPeerView('data')}
        >
          数据
        </button>
      </div>

      <div className='y-card y-peer-mine' style={{ gridColumn: '1 / -1' }}>
        <h3>我的贡献</h3>
        <div className='y-contrib-grid'>
          <div>
            <b>{myReviews.length}</b>
            <span>已提交复盘</span>
          </div>
          <div>
            <b>{myPublic.length}</b>
            <span>公共节点</span>
          </div>
          <div>
            <b>{myMarks}</b>
            <span>累计有效标记</span>
          </div>
          <div>
            <b>{avgProgress}%</b>
            <span>平均校验进度</span>
          </div>
        </div>
        <p className='y-note' style={{ paddingTop: 7 }}>
          {!myReviews.length
            ? '提交第一条复盘后，这里会显示它被多少位同处境用户标记有效。'
            : myPublic.length
              ? `已有 ${myPublic.length} 条复盘进入知识网络，供处境相近的人参考。`
              : `距离最近一条升级为公共节点还差 ${nextGap} 个有效标记。`}
        </p>
        <p className='y-note' style={{ paddingTop: 4 }}>
          你参与了 {myDiscussions.length} 条讨论，收到 {repliesToMe} 条回复。
        </p>
      </div>

      <PeerSearch />

      <PeerSamples />

      <div className='y-card y-gap-card y-peer-mine y-peer-full'>
        <h3>
          我的校验池
          <button
            type='button'
            className='y-btn y-btn-s'
            style={{ marginLeft: 8 }}
            onClick={refreshReviews}
          >
            刷新
          </button>
        </h3>
        <p className='y-note' style={{ paddingBottom: 8 }}>
          满 3 个不同用户标记有效后升级为公共节点。
        </p>

        {!unsubmitted.length ? (
          <Empty>还没有可提交的复盘。先在驿站归档一次阶段性胜利。</Empty>
        ) : (
          unsubmitted.map(v => {
            const filled = [
              v.answers.feel,
              v.answers.ctx,
              v.answers.vision,
            ].filter(x => x && x.length >= 8).length;
            const ok = filled > 0;
            return (
              <div className='y-pool' key={v.id}>
                <div className='y-vic-top'>
                  <strong style={{ fontSize: 13 }}>
                    第 {v.no} 次胜利 · {CHOICE_LABEL[v.choice]}
                  </strong>
                  <Chip tone={ok ? undefined : 'w'}>
                    {ok ? '尚未提交' : '内容不足，不可提交'}
                  </Chip>
                </div>
                <p className='y-vic-body'>
                  {ok
                    ? '提交后以处境区间呈现，不包含精确个人数据；初始仅本人可见。'
                    : '这次停靠没有留下自省文字。无有效内容的记录不进入校验池——回驿站补写后即可提交。'}
                </p>
                <div className='y-row' style={{ marginTop: 7 }}>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    disabled={!ok}
                    onClick={() => submitVictoryReview(v)}
                  >
                    提交到校验池
                  </button>
                </div>
              </div>
            );
          })
        )}

        {state.pool.map(p => {
          const marks = state.markCounts[p.reviewId] ?? 0;
          const isPublic = marks >= NEED;
          return (
            <div className='y-pool' key={p.vid}>
              <div className='y-vic-top'>
                <strong style={{ fontSize: 13 }}>
                  第 {p.no} 次胜利 · {CHOICE_LABEL[p.choice]}
                </strong>
                <Chip tone={isPublic ? 'c' : 'b'}>
                  {isPublic ? '已升级为公共节点' : '仅本人可见'}
                </Chip>
              </div>
              <div className='y-meter'>
                <i
                  style={{ width: `${Math.min(100, (marks / NEED) * 100)}%` }}
                />
              </div>
              <p className='y-vic-body'>
                {isPublic
                  ? `有效标记 ${marks} 个，已进入知识网络。该节点对他人可见，不参与你自己的归属计算。`
                  : `有效标记 ${marks} / ${NEED}。无有效内容的记录不进入校验池。`}
              </p>
            </div>
          );
        })}

        {ownReviews.map(r => {
          const marks = state.markCounts[r.id] ?? 0;
          const ds = statFor(r.id);
          return (
            <div className='y-pool' key={r.id}>
              <div className='y-vic-top'>
                <strong style={{ fontSize: 13 }}>
                  {r.content.startsWith('[经验卡]') ? '经验卡' : '已提交的复盘'}
                </strong>
                <Chip tone={marks >= NEED ? 'c' : 'b'}>
                  {marks >= NEED ? '公共节点' : '校验池中'}
                </Chip>
              </div>
              <p className='y-vic-body'>{r.content.replace('[经验卡] ', '')}</p>
              <div className='y-meter'>
                <i
                  style={{ width: `${Math.min(100, (marks / NEED) * 100)}%` }}
                />
              </div>
              <p className='y-vic-ts'>
                有效标记 {marks} / {NEED}
              </p>
              <div className='y-disc-heat'>
                <span>讨论 {ds.count}</span>
                <span>{ds.people} 人参与</span>
                <b className='y-heat-score'>热度 {marks + ds.people}</b>
                {ds.people >= 3 ? <em>热议</em> : null}
              </div>
              <ReviewDiscussion reviewId={r.id} />
              <ReviewMediaPanel reviewId={r.id} />
            </div>
          );
        })}
        {state.notice ? <p className='y-flash'>{state.notice}</p> : null}
        <GapPhoto variant='ridge' quote='每个人都在自己的路上。' />
      </div>

      <div className='y-card y-gap-card y-peer-build y-peer-full'>
        <h3>
          同处境者的复盘
          <DataSourceBadge source='reviews' showLabel={false} />
          <button
            type='button'
            className='y-btn y-btn-s y-neb-open'
            onClick={() => setNebula(true)}
            title='全屏按阶段浏览公开复盘与有效标记'
          >
            经验星云
          </button>
          {publicReviews.length ? (
            <div className='y-review-sort' role='group' aria-label='复盘排序'>
              <button
                type='button'
                className={reviewSort === 'recent' ? 'is-on' : undefined}
                aria-pressed={reviewSort === 'recent'}
                onClick={() => setReviewSort('recent')}
              >
                最新
              </button>
              <button
                type='button'
                className={reviewSort === 'hot' ? 'is-on' : undefined}
                aria-pressed={reviewSort === 'hot'}
                onClick={() => setReviewSort('hot')}
              >
                热议
              </button>
            </div>
          ) : null}
        </h3>

        {publicReviews.length ? (
          <>
            <p className='y-note' style={{ paddingBottom: 6 }}>
              {reviewSort === 'hot'
                ? '按热度排序：有效标记 + 参与讨论人数（1 人 1 分）；同分按讨论数与时间。排序不改变公共节点判定。'
                : '按提交时间倒序；满 3 个有效标记才参与归属计算。'}
            </p>
            {hotCount ? (
              <p className='y-note' style={{ paddingBottom: 6 }}>
                有 {hotCount} 条复盘进入热议（≥3 人参与讨论）。
              </p>
            ) : null}
            {sortedPublic.slice(0, 8).map(r => {
              const marks = state.markCounts[r.id] ?? 0;
              const marked = markedIds.includes(r.id);
              const ds = statFor(r.id);
              const text = r.content.replace('[经验卡] ', '');
              const short =
                text.length > 72 ? `${text.slice(0, 72)}…` : text;
              return (
                <div className='y-pool' key={r.id}>
                  <div className='y-vic-top'>
                    <strong style={{ fontSize: 12.5 }}>{r.authorName}</strong>
                    <Chip tone={marks >= NEED ? 'c' : 'w'}>
                      {marks >= NEED ? '公共节点' : '校验中'}
                    </Chip>
                  </div>
                  <p className='y-vic-ts'>
                    {r.city || '城市未填'} · {CHOICE_LABEL[r.choice]}
                  </p>
                  {text.length > 72 ? (
                    <details className='y-peer-more'>
                      <summary>查看全文：{short}</summary>
                      <p className='y-vic-body'>
                        <LinkedText text={text} />
                      </p>
                    </details>
                  ) : (
                    <p className='y-vic-body'>
                      <LinkedText text={text} />
                    </p>
                  )}
                  <div className='y-row' style={{ marginTop: 6 }}>
                    <span className='y-vic-ts'>
                      {marks} 位处境相近的用户标记有用
                    </span>
                    <button
                      type='button'
                      className='y-btn y-btn-s'
                      disabled={marked}
                      onClick={() => markReview(r.id)}
                    >
                      {marked ? '已标记' : '标记为有效'}
                    </button>
                  </div>
                  <div className='y-disc-heat'>
                    <span>讨论 {ds.count}</span>
                    <span>{ds.people} 人参与</span>
                    <b className='y-heat-score'>热度 {marks + ds.people}</b>
                    {ds.people >= 3 ? <em>热议</em> : null}
                  </div>
                  <ReviewDiscussion reviewId={r.id} />
                  <ReviewMediaPanel reviewId={r.id} />
                </div>
              );
            })}
          </>
        ) : (
          <p className='y-note' style={{ paddingBottom: 6 }}>
            平台上还没有其他用户的复盘。完成一次归档并提交后，这里会出现你的复盘。
          </p>
        )}

        <p className='y-note' style={{ paddingTop: 6 }}>
          自己的复盘不参与自己的归属计算，只对他人可见。
        </p>
        <GapPhoto
          variant='people'
          quote='被别人照亮，也照亮别人。'
          autoMotion
        />
      </div>

      <div className='y-card y-peer-data' style={{ gridColumn: '1 / -1' }}>
        <h3>
          我的数据<span className='y-mini'>备份在浏览器本地生成，不上传</span>
        </h3>
        <div className='y-data-line'>
          <span>本机标识</span>
          <code>
            {ownerKey.length > 16 ? `${ownerKey.slice(0, 12)}…` : ownerKey}
          </code>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={async () => {
              const ok = await copyText(ownerKey);
              flash(ok ? '本机标识已复制。' : '复制失败，请手动选择。');
            }}
          >
            复制
          </button>
        </div>
        <p className='y-note'>
          数据来源：
          {state.backendOnline
            ? '平台数据表（写失败回退本机缓存）'
            : '浏览器本机缓存'}
          ；本机标识不含账号或密码。
        </p>
        <div className='y-row' style={{ marginTop: 8 }}>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => {
              downloadText(
                '域途-个人备份.json',
                buildBackupJson(state, ownerKey, markedIds),
                'application/json;charset=utf-8'
              );
              flash('个人备份已开始下载（JSON）。');
            }}
          >
            下载完整备份 JSON
          </button>
          <button
            type='button'
            className='y-btn y-btn-s y-btn-danger'
            onClick={() => setConfirmClear(true)}
          >
            清空本机历史数据
          </button>
        </div>
        {confirmClear ? (
          <div
            className='y-confirm'
            role='alertdialog'
            aria-label='确认清空本机历史数据'
          >
            <p>
              会清空本机的档案、任务、档案墙、沙盘与视图记忆，并生成新的本机标识。
              <b>
                平台数据表里的旧记录不会被删除，但不会再加载到这台设备。
              </b>
            </p>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setConfirmClear(false)}
              >
                取消
              </button>
              <button
                type='button'
                className='y-btn y-btn-s y-btn-danger'
                onClick={clearLocalHistory}
              >
                确认清空
              </button>
            </div>
          </div>
        ) : null}
        <p className='y-note' style={{ paddingTop: 6 }}>
          备份包含：个人档案与起点快照、体验任务、阶段性胜利、自己提交的复盘、自己参与的讨论、素材链接、去向样本、有效标记记录与方向候选。
          云端记录不会因下载或清理本机缓存而改变。
        </p>
      </div>
    </div>
    {nebula ? (
      <PeerNebula
        reviews={publicReviews}
        markCounts={state.markCounts}
        markedIds={markedIds}
        currentStageId={currentStage(state.profile).id}
        onMark={markReview}
        onExit={() => setNebula(false)}
      />
    ) : null}
    </>
  );
}

export default function Step6() {
  const {
    state,
    setSub,
    setStep,
    setPick,
    restart,
    currentRank,
    loadNodeTasks,
    nodes,
    flash,
  } = useYutu();
  const [confirmReset, setConfirmReset] = useState(false);
  /** 聚焦模式：闭环图放大铺满视口，指标与主操作留在右侧 */
  const [focus, setFocus] = useState(false);
  useImmersive(focus, setFocus);
  /**
   * 进入第 4 步时，以「进入时已有的最近一次归档」为基线：
   * 历史归档不再作为“本轮刚完成”弹出，只有本次进入后新产生的归档才追问方向。
   */
  const [reviewedAt, setReviewedAt] = useState<number | null>(
    () => state.lastArchive?.at ?? null
  );
  const cur = currentRank()[0];

  const activeTasks = state.tasks.filter((t) => !t.archived);
  const active = activeTasks.length;
  const doing = activeTasks.filter((t) => t.status === 'doing').length;
  const ready = activeTasks.filter((t) => t.status === 'done').length;
  const n = state.victories.length;
  const round = n + 1;
  const domainName = cur?.node.name.split(' · ')[0] ?? '当前域';

  const cActive = useCountUp(active);
  const cDoing = useCountUp(doing);
  const cReady = useCountUp(ready);
  const cVictories = useCountUp(n);

  let headline = '';
  let detail = '';
  if (ready > 0) {
    headline = `${ready} 段体验已完成，只差一次停靠`;
    detail =
      '到驿站回答三个问题、选择下一步。归档后本轮闭合；处境是否改变由你判断，不是每次成长都会移动位置。';
  } else if (active === 0 && n === 0) {
    headline = '闭环还没有开始';
    detail = `当前处于「${domainName}」域。领一条参考任务，在真实生活里做一遍；回来标记完成，闭环就会亮起下一步。`;
  } else if (active === 0) {
    headline = n ? `第 ${round} 轮待启动` : '闭环还没有开始';
    detail = n
      ? `上一轮已归档。领取一条任务，按闭环顺序开始第 ${round} 轮；也可以回第 3 步看新的落点。`
      : '从「领取任务」开始，按闭环顺序走完一轮。';
  } else if (doing > 0) {
    headline = `第 ${round} 轮正在进行`;
    detail = `有 ${doing} 条体验在手上。做完一条就标记完成——闭环不要求全部做完才能停靠。`;
  } else {
    headline = '本轮暂时没有进行中的体验';
    detail = `有 ${active} 条被搁置或放弃。可以重新打开，或领一条新的。`;
  }

  let primary: { label: string; run: () => void };
  if (ready > 0) {
    primary = { label: `去驿站归档（${ready}）`, run: () => setSub(2) };
  } else if (active === 0) {
    primary = {
      label: n ? `开启第 ${round} 轮任务` : '领取第一轮任务',
      run: () => {
        setSub(1);
        if (cur?.node) loadNodeTasks(cur.node);
      },
    };
  } else if (doing > 0) {
    primary = {
      label: `去工作台标记完成（${doing}）`,
      run: () => setSub(1),
    };
  } else {
    primary = { label: '去工作台继续本轮', run: () => setSub(1) };
  }

  /** 唯一主操作：执行后把下方「本轮工作区」滚入视口 */
  function runPrimary() {
    primary.run();
    window.setTimeout(() => {
      document
        .getElementById('y-loop-work')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function go(k: LoopStationKey) {
    if (k === 'map') {
      goLanding(setStep);
      return;
    }
    if (k === 'dock' || k === 'archive') {
      setSub(2);
      return;
    }
    if (k === 'claim') {
      setSub(1);
      if (active === 0) {
        if (cur?.node) loadNodeTasks(cur.node);
        else flash('暂时没有可领取的参考任务，请先在工作台新增一条。');
      }
      return;
    }
    setSub(1);
  }

  /** 跳到对应操作，并把下方工作区滚入视口（回看落点会离开本页，不滚动） */
  function goAndFocus(k: LoopStationKey) {
    go(k);
    if (k === 'map') return;
    window.setTimeout(() => {
      document
        .getElementById('y-loop-work')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  const subs = [
    { n: 1 as const, label: '体验工作台', flag: doing },
    { n: 2 as const, label: '停靠驿站', flag: ready },
    { n: 3 as const, label: '胜利档案墙', flag: n },
    { n: 4 as const, label: '同伴经验域', flag: 0 },
  ];

  const idx = loopStationIndex(active, doing, ready);
  const lastArchive = state.lastArchive;
  const pendingDirectionReview = Boolean(
    lastArchive && reviewedAt !== lastArchive.at
  );

  function markDirectionReviewed(at: number) {
    setReviewedAt(at);
  }

  /** 闭环完成后的唯一分岔：方向没变 → 下一轮；方向变了 → 回第 1 步重填 */
  function handleDirectionChoice(changed: boolean, resting: boolean) {
    if (lastArchive) markDirectionReviewed(lastArchive.at);
    if (changed) {
      setPick(null);
      setStep(1);
      flash(
        '方向变了：请在第 1 步重新确认处境与方向。已归档的胜利与历史任务会保留。'
      );
      return;
    }
    if (resting) {
      setSub(1);
      flash('保持休整，等你准备好再开启下一轮。');
      return;
    }
    if (active > 0) {
      setSub(1);
      flash(`方向没变：沿用工作台里剩余的 ${active} 条体验继续本轮。`);
      return;
    }
    const node = currentRank()[0]?.node;
    setSub(1);
    if (node) loadNodeTasks(node);
    else flash('暂时没有可领取的参考任务，请先在工作台新增一条。');
  }

  /** 把结果卡收进「继续本轮」：保留剩余任务，不推送新一轮 */
  function continueCurrentRound() {
    if (lastArchive) markDirectionReviewed(lastArchive.at);
    setSub(1);
  }

  /** 六站点各自的状态文案：按闭环顺序读下来，就知道下一步做什么 */
  function stationStatus(k: LoopStationKey) {
    switch (k) {
      case 'claim':
        return active === 0
          ? n
            ? `第 ${round} 轮待启动：先领取一条任务`
            : '还没有领取任务'
          : `${active} 条任务在手`;
      case 'act':
        return doing
          ? `${doing} 条进行中：在真实生活里做一遍`
          : '先在任务里挑一条去做';
      case 'mark':
        return doing
          ? `做完 ${doing} 条中的任意一条后，回来标记完成`
          : '没有进行中的体验';
      case 'dock':
        return ready ? `${ready} 条已标记完成，等你停靠自省` : '标记完成后驿站才会亮起';
      case 'archive':
        return ready ? '回答三问、选择下一步，归档并闭合本轮' : '完成自省后即可归档';
      case 'map':
        return n ? `已完成 ${n} 次闭环，回看新的落点` : '完成一次闭环后回看落点';
    }
  }

  function stationAction(k: LoopStationKey) {
    if (k === 'map') return '回第 3 步';
    if (k === 'dock' || k === 'archive') return '去驿站';
    return '去工作台';
  }

  /** 该站点现在是否有可执行的内容；未来步骤在条件未就位前不展开 */
  function stationReady(k: LoopStationKey) {
    switch (k) {
      case 'claim':
        return true;
      case 'act':
        return active > 0;
      case 'mark':
        return doing > 0;
      case 'dock':
      case 'archive':
        return ready > 0;
      case 'map':
        return n > 0;
    }
  }

  const currentStation = LOOP_STATIONS[idx];

  /* 进入第 4 步时只自动定位一次：
     领取 / 体验 / 标记 → 工作台；自省 / 归档 → 驿站。
     之后由用户点站点或按钮切换，避免“继续本轮”被自动切回驿站。
     归档后的方向确认优先展示，不被自动切换打断。 */
  const enteredOnce = useRef(false);
  useEffect(() => {
    if (enteredOnce.current) return;
    enteredOnce.current = true;
    if (!pendingDirectionReview) setSub(idx <= 2 ? 1 : 2);
  }, [idx, pendingDirectionReview, setSub]);

  return (
    <section id='y-p4' role='tabpanel' aria-labelledby='y-s4'>
      <header className='y-lead'>
        <p className='y-eyebrow'>STEP 04 · 闭环</p>
        <h2>成长闭环</h2>
      </header>

      <div className='y-zone'>
        <div className='y-zone-head'>
          <span className='y-zone-n'>01 / 闭环顺序</span>
          <h3>从第 1 步开始，一轮一轮走</h3>
          <p>
            当前步骤会展开操作入口；走完 6 步、归档之后，才会出现方向确认与下一轮
          </p>
        </div>

        <div className='y-loop-current'>
          <div className='y-loop-current-body'>
            <p className='y-loop-current-badge'>
              第 {round} 轮 · 第 {idx + 1} / {LOOP_STATIONS.length} 步
            </p>
            {state.pick ? (
              <p className='y-loop-direction-chip'>
                <span>当前方向</span>
                <b
                  className='y-vt-chip'
                  style={
                    {
                      viewTransitionName: 'y-direction',
                    } as CSSProperties
                  }
                >
                  {state.pick}
                </b>
              </p>
            ) : null}
            <h4>
              {currentStation.name}
              <em>{currentStation.hint}</em>
            </h4>
            <p className='y-loop-current-status'>
              {stationStatus(currentStation.k)}
            </p>
            <a className='y-loop-sandbox-link' href='#/sandbox'>
              先在沙盘里试走一轮 →
            </a>
          </div>
          <button
            type='button'
            className='y-btn y-btn-main'
            onClick={runPrimary}
          >
            {primary.label} →
          </button>
        </div>

        <details className='y-loop-steps-fold'>
          <summary>
            <span>完整六步</span>
            <b>{currentStation.name}</b>
            <em>
              第 {idx + 1} / {LOOP_STATIONS.length} 步 · 展开查看顺序与入口
            </em>
            <i aria-hidden='true'>▾</i>
          </summary>
          <div className='y-loop-steps'>
            {LOOP_STATIONS.map((s, i) => {
              const on = i === idx;
              const passed = i < idx;
              const locked = i > idx && !stationReady(s.k);
              return (
                <div
                  className={`y-loop-step${on ? ' is-active' : ''}${
                    passed ? ' is-passed' : ''
                  }${locked ? ' is-locked' : ''}`}
                  key={s.k}
                  aria-current={on ? 'step' : undefined}
                >
                  <span className='y-loop-step-n' aria-hidden='true'>
                    {passed ? '✓' : i + 1}
                  </span>
                  <div className='y-loop-step-body'>
                    <b>
                      {s.name}
                      <em>{s.hint}</em>
                      {on ? <span className='y-loop-step-now'>当前</span> : null}
                    </b>
                    <p>{stationStatus(s.k)}</p>
                  </div>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    disabled={locked}
                    onClick={() => goAndFocus(s.k)}
                  >
                    {locked ? '完成上一步后开放' : stationAction(s.k)}
                  </button>
                </div>
              );
            })}
          </div>
        </details>

        <div className='y-zone-head y-zone-subhead'>
          <span className='y-zone-n'>02 / 闭环全貌</span>
          <h3>螺旋、当前判定与累计进度</h3>
          <p>闭环图高亮与上方「当前步骤」始终是同一站</p>
        </div>

        {focus ? (
          <button
            type='button'
            className='y-focus-backdrop'
            aria-label='退出聚焦，返回页面'
            onClick={() => setFocus(false)}
          />
        ) : null}
        <div
          className={`y-card y-loop-board-card${focus ? ' is-focus' : ''}`}
        >
          {/* 闭环卡片的氛围底花：比地图里的花更淡，只做区域母题 */}
          <svg
            className='y-loop-ambient'
            viewBox='0 0 400 400'
            aria-hidden='true'
          >
            <FlowerBloom cx={200} cy={200} r={190} />
          </svg>
          <div className='y-loop-board'>
            <LoopMap
              round={round}
              active={active}
              doing={doing}
              ready={ready}
              victories={n}
              onGo={goAndFocus}
            />
            <div className='y-loop-side'>
              <p className='y-loop-eyebrow'>
                第 {round} 轮 · {active ? '循环中' : '待启动'}
              </p>
              <h4 className='y-loop-headline'>{headline}</h4>
              <p className='y-loop-detail'>{detail}</p>
              {pendingDirectionReview ? (
                <p className='y-note y-loop-pending-hint'>
                  先确认下方「方向是否发生变化」，再决定继续本轮还是开启下一轮。
                </p>
              ) : (
                <div className='y-row' style={{ marginTop: 10 }}>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    onClick={runPrimary}
                  >
                    {primary.label}
                  </button>
                  {n ? (
                    <button
                      type='button'
                      className='y-btn y-btn-s'
                      onClick={() => goLanding(setStep)}
                    >
                      回第 3 步看落点
                    </button>
                  ) : null}
                  <button
                    type='button'
                    className='y-btn y-btn-s y-focus-toggle'
                    aria-pressed={focus}
                    onClick={() => setFocus(v => !v)}
                    title={focus ? 'Esc 也可退出' : '闭环图放大铺满视口'}
                  >
                    {focus ? '退出聚焦' : '聚焦闭环图'}
                  </button>
                </div>
              )}
              {!state.backendOnline ? (
                <p className='y-note' style={{ paddingTop: 6 }}>
                  当前为本地存储模式：任务、档案与复盘保存在本机浏览器；在平台页面内打开时会自动接入数据表。
                </p>
              ) : null}

              <div className='y-loop-metrics'>
                <div>
                  <b>{cActive}</b>
                  <span>本轮任务</span>
                </div>
                <div>
                  <b>{cDoing}</b>
                  <span>进行中</span>
                </div>
                <div>
                  <b>{cReady}</b>
                  <span>待归档</span>
                </div>
                <div>
                  <b>{cVictories}</b>
                  <span>已闭环</span>
                </div>
              </div>

              <div className='y-loop-extra'>
                <span>校验池复盘 {state.pool.length}</span>
                <span>方向候选 {state.shortlist.length} / 4</span>
              </div>
              {state.lastArchive ? (
                <p className='y-loop-last'>
                  上一轮：第 {state.lastArchive.no} 次 ·{' '}
                  {CHOICE_LABEL[state.lastArchive.choice]} ·{' '}
                  {state.lastArchive.moved === false
                    ? '本轮处境未变'
                    : '向量已小幅漂移'}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {pendingDirectionReview && lastArchive ? (
          <div
            className='y-loop-review-card'
            role='region'
            aria-label='闭环后的方向确认'
          >
            <div className='y-loop-review-copy'>
              <p className='y-eyebrow'>闭环之后 · 方向确认</p>
              <h4>
                第 {lastArchive.no} 次闭环已完成：你要走的方向是否发生变化？
              </h4>
              <p className='y-note'>
                {lastArchive.choice === 'rest'
                  ? '这次以休整收尾。选「没变」会保留休整状态，等你准备好再开下一轮。'
                  : `选「没变」会沿用当前处境与归属，直接开启第 ${lastArchive.no + 1} 轮；选「变了」会回到第 1 步重新填写。`}
                已归档的胜利与历史任务不会因此丢失。
              </p>
            </div>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-main y-btn-s'
                onClick={() =>
                  handleDirectionChoice(
                    false,
                    lastArchive.choice === 'rest'
                  )
                }
              >
                {lastArchive.choice === 'rest'
                  ? '方向没变 · 保持休整'
                  : active
                    ? `方向没变 · 继续本轮（还剩 ${active} 条）→`
                    : `方向没变 · 开启第 ${lastArchive.no + 1} 轮 →`}
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => handleDirectionChoice(true, false)}
              >
                方向变了 · 回第 1 步重新填写 →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className='y-zone y-loop-work' id='y-loop-work'>
        <div className='y-zone-head'>
          <span className='y-zone-n'>03 / 本轮工作区</span>
          <h3>先把闭环内的事做完</h3>
          <p>工作台负责领取 / 体验 / 标记完成；驿站负责自省 / 归档 / 回看</p>
        </div>
        <div className='y-sub-rail-row'>
          <div className='y-sub-rail' role='tablist' aria-label='本轮工作区'>
            {subs
              .filter((s) => s.n <= 2)
              .map((s) => (
                <button
                  type='button'
                  key={s.n}
                  className='y-sub-tab'
                  role='tab'
                  aria-selected={state.sub === s.n}
                  onClick={() => setSub(s.n)}
                >
                  {s.n === 1 ? '① ' : '② '}
                  {s.label}
                  {s.flag ? <span className='y-flag'>{s.flag}</span> : null}
                </button>
              ))}
          </div>
          <button
            type='button'
            className='y-btn y-btn-s y-sub-rail-extra'
            onClick={() => goLanding(setStep)}
          >
            ③ 回看落点 · 第 3 步
          </button>
        </div>

        {state.sub <= 2 ? (
          <>
            {state.sub === 1 ? <BenchTab /> : null}
            {state.sub === 2 ? (
              <StationTab
                reviewedAt={reviewedAt}
                onDirectionChoice={handleDirectionChoice}
                onContinue={continueCurrentRound}
              />
            ) : null}
          </>
        ) : (
          <div className='y-card y-sub-hint'>
            <p>
              你现在在「
              {subs.find((s) => s.n === state.sub)?.label}
              」。本轮闭环的操作在「体验工作台」与「停靠驿站」。
            </p>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(1)}
              >
                回工作台
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(2)}
              >
                去停靠驿站
              </button>
            </div>
          </div>
        )}
      </div>

      <div className='y-zone'>
        <div className='y-zone-head'>
          <span className='y-zone-n'>04 / 档案与同伴</span>
          <h3>闭环之外的回顾与共建</h3>
          <p>胜利档案墙回看每次闭环；同伴经验域共享复盘与有效标记</p>
        </div>
        <div className='y-sub-rail' role='tablist' aria-label='档案与同伴'>
          {subs
            .filter((s) => s.n >= 3)
            .map((s) => (
              <button
                type='button'
                key={s.n}
                className='y-sub-tab'
                role='tab'
                aria-selected={state.sub === s.n}
                onClick={() => setSub(s.n)}
              >
                {s.label}
                {s.flag ? <span className='y-flag'>{s.flag}</span> : null}
              </button>
            ))}
        </div>

        {state.sub >= 3 ? (
          <>
            {state.sub === 3 ? <WallTab nodes={nodes} /> : null}
            {state.sub === 4 ? <PeersTab /> : null}
          </>
        ) : (
          <div className='y-card y-sub-hint'>
            <p>
              闭环内的事务先走「工作台 → 驿站」。完成归档后，可以在这里回看胜利档案与同伴复盘。
            </p>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(3)}
              >
                打开胜利档案墙
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setSub(4)}
              >
                打开同伴经验域
              </button>
            </div>
          </div>
        )}
      </div>

      <div className='y-nav'>
        <button type='button' className='y-btn' onClick={() => setStep(3)}>
          ← 返回方向与推演
        </button>
        <button type='button' className='y-btn' onClick={() => setStep(2)}>
          回第 2 步了解你所处的环境 →
        </button>
        {confirmReset ? (
          <div
            className='y-confirm'
            role='alertdialog'
            aria-label='确认重新填写'
          >
            <p>
              重新填写会回到第 1
              步，并重置本次浏览中的任务、档案与校验池视图；本机快照也会被重置（本机标识保留）。
              <b>
                已写入平台数据表的记录不会被删除，重新打开页面时仍会同步回来。
              </b>
            </p>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setConfirmReset(false)}
              >
                取消
              </button>
              <button
                type='button'
                className='y-btn y-btn-s y-btn-danger'
                onClick={() => {
                  setConfirmReset(false);
                  restart();
                }}
              >
                确认重新填写
              </button>
            </div>
          </div>
        ) : (
          <button
            type='button'
            className='y-btn'
            onClick={() => setConfirmReset(true)}
          >
            重新填写
          </button>
        )}
      </div>
    </section>
  );
}
