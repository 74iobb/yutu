import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataSourceBadge from '@/components/DataSourceBadge';
import PortalSlab from '@/components/PortalSlab';
import SandboxBoard from '@/components/SandboxBoard';
import {
  bandOf,
  CITY_MAP,
  currentStage,
  DIM_MAP,
  DIMS,
  ranked,
  simBand,
  simBandTone,
  stabilityOf,
  stageDirections,
} from '@/lib/model';
import { DOC_COUNT, searchByField } from '@/lib/search';
import {
  CUSTOM_INTENSITY,
  SANDBOX_ACTION_MAP,
  SANDBOX_ACTIONS,
  SANDBOX_ROUNDS,
  canAfford,
  effectText,
  formatCost,
  pickLabel,
  recommendAction,
  simulateBaseline,
  simulateSandbox,
  type CustomEvidence,
  type CustomIntensity,
  type CustomPlan,
  type SandboxActionId,
  type SandboxPick,
} from '@/lib/sandbox';
import { useYutu } from '@/store/YutuContext';
import { SIX_BODY_TYPES, URBAN_LABEL } from '@/data/catalog';
import type { Scores } from '@/types';

const LS_KEY = 'yutu.sandbox.v2';
const LEGACY_KEYS = ['yutu.sandbox.v1'];
const APP_TITLE = '域途 · 体验式生涯陪伴';
const VALID = new Set<string>(SANDBOX_ACTIONS.map((a) => a.id));
const TASK_TYPES = new Set<string>(SIX_BODY_TYPES);

function asIntensity(v: unknown): CustomIntensity {
  return v === 'low' || v === 'high' ? v : 'mid';
}

function readEvidence(v: unknown): CustomEvidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const r = raw as Record<string, unknown>;
      if (typeof r.title !== 'string' || typeof r.url !== 'string') return [];
      return [
        {
          title: r.title.slice(0, 200),
          url: r.url,
          excerpt: typeof r.excerpt === 'string' ? r.excerpt.slice(0, 320) : '',
          source: typeof r.source === 'string' ? r.source : '',
        },
      ];
    })
    .slice(0, 4);
}

function loadPicks(): SandboxPick[] {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SandboxPick[] = [];
    parsed.forEach((x) => {
      if (typeof x === 'string' && VALID.has(x)) {
        out.push({ kind: 'preset', action: x as SandboxActionId });
        return;
      }
      if (!x || typeof x !== 'object') return;
      const rec = x as { kind?: unknown; action?: unknown; plan?: unknown };
      if (
        rec.kind === 'preset' &&
        typeof rec.action === 'string' &&
        VALID.has(rec.action)
      ) {
        out.push({ kind: 'preset', action: rec.action as SandboxActionId });
        return;
      }
      if (rec.kind === 'custom' && rec.plan && typeof rec.plan === 'object') {
        const p = rec.plan as Partial<CustomPlan>;
        if (typeof p.title !== 'string' || p.title.trim().length < 4) return;
        const evidence = readEvidence(p.evidence);
        out.push({
          kind: 'custom',
          plan: {
            title: p.title.slice(0, 80),
            intensity: asIntensity(p.intensity),
            taskType: TASK_TYPES.has(String(p.taskType))
              ? (p.taskType as (typeof SIX_BODY_TYPES)[number])
              : '创新创业体验',
            evidence,
            matched: Number(p.matched) || evidence.length,
            corpusSize: Number(p.corpusSize) || DOC_COUNT,
            searchedAt: Number(p.searchedAt) || 0,
          },
        });
      }
    });
    return out.slice(0, SANDBOX_ROUNDS);
  } catch {
    return [];
  }
}

function shortName(name: string): string {
  return name.split(' · ')[0];
}

function pctOf(k: keyof Scores, v: number): number {
  const d = DIM_MAP[k];
  return Math.max(0, Math.min(100, ((v - d.min) / Math.max(1, d.max - d.min)) * 100));
}

function signed(v: number): string {
  return `${v > 0 ? '+' : ''}${v}`;
}

/** 资源条：只表达余量，不换算成金额 */
function Meter({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className='y-sb-meter'>
      <div className='y-sb-meter-head'>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className='y-sb-meter-track'>
        <i style={{ width: `${value}%` }} />
      </div>
      <em>{hint}</em>
    </div>
  );
}

function DimRow({ k, from, to }: { k: keyof Scores; from: number; to: number }) {
  const d = DIM_MAP[k];
  const a = pctOf(k, from);
  const b = pctOf(k, to);
  const left = Math.min(a, b);
  const delta = to - from;
  return (
    <div className='y-sb-drow'>
      <span className='y-sb-drow-name'>{d.n}</span>
      <div className='y-sb-drow-track'>
        <i className='y-sb-drow-from' style={{ left: `${a}%` }} />
        <i
          className={`y-sb-drow-fill ${delta < 0 ? 'is-down' : ''}`}
          style={{ left: `${left}%`, width: `${Math.abs(b - a)}%` }}
        />
        <i className='y-sb-drow-to' style={{ left: `${b}%` }} />
      </div>
      <span className='y-sb-drow-val'>
        {from} → {to}
        <em className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>
          {delta ? signed(delta) : '±0'}
        </em>
      </span>
    </div>
  );
}

export default function Sandbox() {
  const { state, nodes, setStep, addCustomTask, flash } = useYutu();
  const navigate = useNavigate();
  const [picks, setPicks] = useState<SandboxPick[]>(() => loadPicks());
  const [focus, setFocus] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] =
    useState<(typeof SIX_BODY_TYPES)[number]>('创新创业体验');
  const [customIntensity, setCustomIntensity] =
    useState<CustomIntensity>('mid');
  const [customErr, setCustomErr] = useState('');
  const [preview, setPreview] =
    useState<ReturnType<typeof searchByField> | null>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = '沙盘推演 · 域途';
    return () => {
      document.title = APP_TITLE;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(picks));
    } catch {
      /* 本地存储不可用时只影响本次会话 */
    }
  }, [picks]);

  const identity = state.profile.identity;
  const stage = currentStage(state.profile);
  const city = CITY_MAP[state.profile.city] ?? CITY_MAP.chengdu;

  const run = useMemo(
    () => simulateSandbox(state.profile.s, picks, identity),
    [state.profile.s, picks, identity]
  );
  const baseRun = useMemo(
    () => simulateBaseline(state.profile.s, identity, picks.length),
    [state.profile.s, identity, picks.length]
  );
  const rankNow = useMemo(() => ranked(state.profile.s, nodes), [state.profile.s, nodes]);
  const rankPlan = useMemo(() => ranked(run.final, nodes), [run.final, nodes]);
  const rankBase = useMemo(
    () => ranked(baseRun.final, nodes),
    [baseRun.final, nodes]
  );
  const stability = useMemo(
    () => stabilityOf(run.final, nodes),
    [run.final, nodes]
  );

  const viewing =
    focus !== null && focus >= 0 && focus < picks.length ? focus : null;
  const nextIdx = picks.length;
  const full = picks.length >= SANDBOX_ROUNDS;
  const canAdopt = picks.length >= 2;
  const customCount = picks.filter((p) => p.kind === 'custom').length;

  const direction =
    state.pick ||
    state.shortlist[0] ||
    stageDirections(stage.id)[0]?.name ||
    '当前方向';

  const customCost = CUSTOM_INTENSITY[customIntensity];
  const customAfford = canAfford(customCost, {
    cash: run.cash,
    energy: run.energy,
  });
  /** 还没进入第 2 步：当前档案可能还是初始值，必须明确提示 */
  const needsProfile = state.maxStep < 2;

  function choose(id: SandboxActionId) {
    if (full) return;
    const act = SANDBOX_ACTION_MAP[id];
    const afford = canAfford(act.cost, { cash: run.cash, energy: run.energy });
    if (!afford.ok) {
      flash(`${afford.reason}。这一格无法落子；你可以换一个动作，或撤回已有的一格。`);
      return;
    }
    setPicks([...picks, { kind: 'preset', action: id }]);
    setFocus(null);
    closeCustom();
  }

  function openCustom() {
    setCustomOpen(true);
    setPreview(null);
    setCustomErr('');
  }

  function closeCustom() {
    setCustomOpen(false);
    setPreview(null);
    setCustomErr('');
  }

  function runCustomSearch() {
    const title = customTitle.trim();
    if (title.length < 4) {
      setCustomErr('至少写 4 个字，说清你想做什么。');
      setPreview(null);
      return;
    }
    setCustomErr('');
    setPreview(searchByField(title, stage.id, 6));
  }

  function addCustom() {
    const title = customTitle.trim();
    if (title.length < 4) {
      setCustomErr('至少写 4 个字，说清你想做什么。');
      return;
    }
    if (!customAfford.ok) {
      setCustomErr(customAfford.reason ?? '当前资源不足');
      return;
    }
    if (!preview) {
      runCustomSearch();
      return;
    }
    const plan: CustomPlan = {
      title,
      intensity: customIntensity,
      taskType: customType,
      evidence: preview.hits.slice(0, 4).map((h) => ({
        title: h.title,
        url: h.url,
        excerpt: h.excerpt,
        source: h.source,
      })),
      matched: preview.hits.length,
      corpusSize: DOC_COUNT,
      searchedAt: Date.now(),
    };
    setPicks([...picks, { kind: 'custom', plan }]);
    setFocus(null);
    closeCustom();
    setCustomTitle('');
    flash(
      '已加入你自定义的一步；系统只记录投入与检索原文，不推断它的七维变化。'
    );
  }

  function undo() {
    setPicks((p) => p.slice(0, -1));
    setFocus(null);
    closeCustom();
  }

  function reset() {
    setPicks([]);
    setFocus(null);
    closeCustom();
    flash('沙盘已清空；你的真实处境与档案没有变化。');
  }

  /** 用公开规则把剩余格补满，只用于快速看到一条路径，不是推荐 */
  function autoFill() {
    let p: SandboxPick[] = [...picks];
    while (p.length < SANDBOX_ROUNDS) {
      const sim = simulateSandbox(state.profile.s, p, identity);
      const id = recommendAction(sim.final, {
        cash: sim.cash,
        energy: sim.energy,
      });
      const act = SANDBOX_ACTION_MAP[id];
      const afford = canAfford(act.cost, {
        cash: sim.cash,
        energy: sim.energy,
      });
      p = [...p, { kind: 'preset', action: afford.ok ? id : 'rest' }];
    }
    setPicks(p);
    setFocus(null);
    closeCustom();
    flash('已用公开规则填满六格；这是一条示例路径，不是推荐。');
  }

  function adopt() {
    if (!canAdopt) return;
    const seen = new Set<string>();
    const tasks: { title: string; type: string }[] = [];
    picks.forEach((p) => {
      const key = p.kind === 'preset' ? `p:${p.action}` : `c:${p.plan.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (p.kind === 'preset') {
        const a = SANDBOX_ACTION_MAP[p.action];
        tasks.push({
          title: a.taskTitle.replace('{dir}', direction),
          type: a.taskType,
        });
      } else {
        tasks.push({ title: p.plan.title, type: p.plan.taskType });
      }
    });
    const list = tasks.slice(0, 4);
    list.forEach((t) => addCustomTask(t.title, t.type));
    flash(
      `已把 ${list.length} 条沙盘任务写进体验工作台；沙盘不修改你的真实处境与档案。`
    );
    setStep(4);
    navigate('/');
  }

  const verdicts = useMemo(() => {
    if (!picks.length) return [];
    const nowTop = rankNow[0];
    const planTop = rankPlan[0];
    const baseTop = rankBase[0];
    const moved = nowTop && planTop && nowTop.node.name !== planTop.node.name;
    const histDelta = run.final.history - state.profile.s.history;
    const items: { t: string; body: string }[] = [
      {
        t: '归属',
        body: `现在偏向「${shortName(nowTop?.node.name ?? '未定')}」。走完 ${picks.length} 格后偏向「${shortName(planTop?.node.name ?? '未定')}」${
          moved ? '，发生了移动' : '，没有移动'
        }；同样格数下什么都不做，会偏向「${shortName(baseTop?.node.name ?? '未定')}」。`,
      },
      {
        t: '体验',
        body: `体验历史 ${state.profile.s.history} → ${run.final.history}（${signed(
          histDelta
        )}）；维持现状为 ${baseRun.final.history}。`,
      },
      {
        t: '资源',
        body: `现金缓冲 ${run.base.cash} → ${run.cash}，精力 ${run.base.energy} → ${
          run.energy
        }。${
          run.blockedAt >= 0
            ? `第 ${run.blockedAt + 1} 格按规则会透支，这条路线与可用资源不匹配。`
            : '每一步都在可承受范围内。'
        }`,
      },
      {
        t: '边界',
        body: `这是固定规则的推演，不给概率、不判定成败；它只回答“按这套规则走，代价和落点是什么”。${
          customCount
            ? `其中 ${customCount} 个自定义步骤只记录投入与时间成本，系统没有推断它们的七维变化。`
            : ''
        }`,
      },
    ];
    return items;
  }, [
    picks.length,
    customCount,
    rankNow,
    rankPlan,
    rankBase,
    run,
    baseRun,
    state.profile.s.history,
  ]);

  const planTop = rankPlan[0];
  const baseTop = rankBase[0];
  const nowTop = rankNow[0];
  const viewPick = viewing !== null ? picks[viewing] : null;
  const viewStep = viewing !== null ? run.steps[viewing] : null;

  return (
    <div className='y-page'>
      <div className='y-ambient' aria-hidden='true'>
        <i />
        <i />
        <i />
        <span className='y-ambient-grid' />
        <span className='y-ambient-aura' />
        <span className='y-ambient-noise' />
      </div>

      <div id='yutu2' className='y-sb-shell' data-step='sandbox'>
        <header className='y-sb-top'>
          <Link className='y-sb-back' to='/'>
            <span aria-hidden='true'>←</span> 回到域途
          </Link>
          <div className='y-sb-brand'>
            <b>沙盘</b>
            <em>显影 · 不是预测</em>
          </div>
          <div className='y-sb-top-meta'>
            <span className='y-chip y-chip-b'>
              第 {picks.length} / {SANDBOX_ROUNDS} 格
            </span>
            <button
              type='button'
              className='y-btn y-btn-s'
              onClick={reset}
              disabled={!picks.length}
            >
              重新摆放
            </button>
          </div>
        </header>

        <main className='y-sb-main'>
          <section className='y-sb-lead'>
            <div>
              <p className='y-eyebrow'>决策沙盘 · 不提供解法</p>
              <h2>把未来 18 个月摆上桌面</h2>
              <p className='y-sb-lead-p'>
                每一格是一个季度，每格只做一个动作。预设动作与你自己写下的路都可以放上沙盘；
                系统只列已知条件、资源消耗与检索到的真实原文，不判断哪条更值得走。
              </p>
              <div className='y-sb-facts'>
                <span>6 格 · 18 个月</span>
                <span>每格 1 个动作</span>
                <span>支持自定义的路</span>
                <span>0 个随机数</span>
                <span>不改真实处境</span>
              </div>
            </div>
            <div className='y-sb-lead-badge'>
              <DataSourceBadge source='sandbox' />
            </div>
            <PortalSlab />
          </section>

          {needsProfile ? (
            <section className='y-sb-notice' role='status'>
              <div>
                <b>你还没有进入第 2 步</b>
                <p>
                  沙盘现在使用第 1 步表单里的处境；如果还没有填写，看到的是初始值（
                  {city.name} · {state.profile.s.age} 岁 ·{' '}
                  {state.profile.field || '方向未填'}）。先填写，沙盘才会按你的真实处境推演。
                </p>
              </div>
              <Link className='y-btn y-btn-s' to='/' onClick={() => setStep(1)}>
                去填写 →
              </Link>
            </section>
          ) : null}

          <section className='y-sb-now' aria-label='当前处境'>
            <div className='y-sb-now-card'>
              <span>位置</span>
              <b>
                {city.name} · {URBAN_LABEL[state.profile.urban]?.n ?? '城区'}
              </b>
              <em>{state.profile.field || '方向尚未填写'}</em>
            </div>
            <div className='y-sb-now-card'>
              <span>阶段</span>
              <b>{stage.name}</b>
              <em>{state.profile.identity === 'work' ? '已工作' : '在校 / 待业'}</em>
            </div>
            <div className='y-sb-now-card'>
              <span>当前归属</span>
              <b className='is-ellipsis' title={nowTop?.node.name}>
                {shortName(nowTop?.node.name ?? '未定')}
              </b>
              <em>
                <i className={`y-chip y-chip-${simBandTone(nowTop?.sim ?? 0)}`}>
                  {simBand(nowTop?.sim ?? 0)}
                </i>
              </em>
            </div>
            <div className='y-sb-now-card is-res'>
              <span>可动用资源</span>
              <Meter label='现金缓冲' value={run.base.cash} hint='由经济压力与家庭负担推算' />
              <Meter label='精力余量' value={run.base.energy} hint='由负担、年龄与工作状态推算' />
            </div>
          </section>

          <div className='y-sb-grid'>
            <section className='y-sb-card y-sb-board-card'>
              <div className='y-sb-card-head'>
                <div>
                  <p className='y-eyebrow'>01 / 沙盘</p>
                  <h3>六格推演</h3>
                  <p className='y-sb-sub'>
                    点亮的一格可以落子；已落的格可以回看，只能撤回最后一格。
                  </p>
                </div>
                <span className='y-sb-live'>
                  <i className={full ? 'is-done' : ''} />
                  {full ? '六格已走完' : `下一步：第 ${nextIdx + 1} 格`}
                </span>
              </div>

              <div className='y-sb-board-wrap'>
                <SandboxBoard
                  picks={picks}
                  focus={viewing}
                  startHue={nowTop?.node.hue ?? '#7fb6ff'}
                  baseEndLabel={`维持现状 → ${shortName(
                    baseTop?.node.name ?? '未定'
                  )}`}
                  onTile={(i) => {
                    if (i < picks.length) setFocus(i);
                    else setFocus(null);
                  }}
                />
              </div>

              <ol className='y-sb-strip' aria-label='回合轴'>
                {Array.from({ length: SANDBOX_ROUNDS }, (_, i) => {
                  const pick = picks[i];
                  const isNext = i === nextIdx;
                  return (
                    <li
                      key={i}
                      className={`${pick ? 'is-done' : ''}${
                        isNext ? ' is-next' : ''
                      }${pick?.kind === 'custom' ? ' is-custom' : ''}`}
                    >
                      <button
                        type='button'
                        onClick={() => {
                          if (pick) setFocus(i);
                          else if (isNext) setFocus(null);
                        }}
                        disabled={!pick && !isNext}
                        title={pick ? pickLabel(pick) : undefined}
                      >
                        <span>Q{i + 1}</span>
                        <b>
                          {pick ? pickLabel(pick) : isNext ? '待落子' : '未解锁'}
                        </b>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className='y-sb-legend'>
                <span>
                  <i className='is-plan' /> 你的路线
                </span>
                <span>
                  <i className='is-base' /> 维持现状对照
                </span>
                <span>
                  <i className='is-custom' /> 你自定义的路（不计七维变化）
                </span>
                <span>
                  <i className='is-cost' /> 每格另有时间成本：经济压力 +1
                </span>
              </div>
              <p className='y-sb-board-hint'>小屏可左右滑动棋盘</p>
            </section>

            <aside className='y-sb-side'>
              <section className='y-sb-card'>
                {viewing !== null && viewPick && viewStep ? (
                  <>
                    <p className='y-eyebrow'>
                      02 / 第 {viewing + 1} 格 ·{' '}
                      {viewPick.kind === 'custom' ? '你定义的' : '已落子'}
                    </p>
                    <h3>{viewStep.label}</h3>
                    <p className='y-sb-sub'>
                      {viewPick.kind === 'custom'
                        ? `${CUSTOM_INTENSITY[viewPick.plan.intensity].label} · ${CUSTOM_INTENSITY[viewPick.plan.intensity].hint}`
                        : SANDBOX_ACTION_MAP[viewPick.action]?.brief}
                    </p>
                    <div className='y-sb-stepres'>
                      <span>
                        现金 {viewStep.cashBefore} → {viewStep.cashAfter}
                      </span>
                      <span>
                        精力 {viewStep.energyBefore} → {viewStep.energyAfter}
                      </span>
                    </div>
                    {viewPick.kind === 'custom' ? (
                      <p className='y-sb-note'>
                        系统没有推断这一步的七维变化；下表只显示时间成本带来的变化。
                      </p>
                    ) : null}
                    <ul className='y-sb-deltas'>
                      {DIMS.filter(
                        (d) => viewStep.before[d.k] !== viewStep.after[d.k]
                      ).map((d) => (
                        <li key={d.k}>
                          <span>{d.n}</span>
                          <b>
                            {viewStep.before[d.k]} → {viewStep.after[d.k]}
                          </b>
                          <em
                            className={
                              viewStep.after[d.k] < viewStep.before[d.k]
                                ? 'is-down'
                                : ''
                            }
                          >
                            {signed(viewStep.after[d.k] - viewStep.before[d.k])}
                          </em>
                        </li>
                      ))}
                    </ul>
                    {viewPick.kind === 'custom' &&
                    viewPick.plan.evidence.length ? (
                      <div className='y-sb-evidence-block'>
                        <h4>加入时检索到的原文</h4>
                        <ul className='y-sb-evidence'>
                          {viewPick.plan.evidence.map((e) => (
                            <li key={e.url}>
                              <a href={e.url} target='_blank' rel='noreferrer'>
                                {e.title}
                              </a>
                              {e.source ? <span>{e.source}</span> : null}
                              {e.excerpt ? <p>{e.excerpt}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className='y-sb-picker-foot'>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={() => setFocus(null)}
                      >
                        返回选择
                      </button>
                      {viewing === picks.length - 1 ? (
                        <button
                          type='button'
                          className='y-btn y-btn-s'
                          onClick={undo}
                        >
                          撤回这一步
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : full ? (
                  <>
                    <p className='y-eyebrow'>02 / 六格已走完</p>
                    <h3>路线定型</h3>
                    <p className='y-sb-sub'>
                      落点「{shortName(planTop?.node.name ?? '未定')}」 ·
                      相似度 {simBand(planTop?.sim ?? 0)} · 稳定度{' '}
                      {stability.label}。
                    </p>
                    <div className='y-sb-picker-foot'>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={() =>
                          outcomeRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                      >
                        看结果对照
                      </button>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={undo}
                      >
                        撤回最后一格
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className='y-eyebrow'>02 / 第 {nextIdx + 1} 格</p>
                    <h3>这一步做什么</h3>
                    {picks.length && picks[picks.length - 1].kind === 'custom' ? (
                      <p className='y-sb-prompt'>
                        这是你的决定。下一步还要加什么？
                      </p>
                    ) : null}
                    <p className='y-sb-sub'>
                      可动用：现金 {run.cash} · 精力 {run.energy}。现金或精力不足时不能落子。
                    </p>
                    <div className='y-sb-actions'>
                      {SANDBOX_ACTIONS.map((a) => {
                        const afford = canAfford(a.cost, {
                          cash: run.cash,
                          energy: run.energy,
                        });
                        return (
                          <button
                            key={a.id}
                            type='button'
                            className='y-sb-act'
                            style={{ '--sb-hue': a.hue } as CSSProperties}
                            disabled={!afford.ok}
                            title={
                              afford.reason ?? `${a.brief}｜${effectText(a.drift)}`
                            }
                            onClick={() => choose(a.id)}
                          >
                            <span className='y-sb-act-code'>{a.code}</span>
                            <span className='y-sb-act-name'>
                              <b>{a.name}</b>
                              <em>{a.brief}</em>
                              <i>{effectText(a.drift)}</i>
                            </span>
                            <span className='y-sb-act-cost'>
                              <b>现金 {formatCost(a.cost.cash)}</b>
                              <b>精力 {formatCost(a.cost.energy)}</b>
                              {!afford.ok ? <em>不足</em> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className='y-sb-custom'>
                      {!customOpen ? (
                        <button
                          type='button'
                          className='y-sb-custom-open'
                          onClick={openCustom}
                        >
                          <span aria-hidden='true'>+</span>
                          <b>系统没有提到的路</b>
                          <em>写下你真正想做的，由你定义这一步</em>
                        </button>
                      ) : (
                        <div className='y-sb-custom-form'>
                          <label htmlFor='y-sb-custom-title'>
                            你想做什么
                            <span>至少 4 个字；系统会按这段文字检索真实原文</span>
                          </label>
                          <textarea
                            id='y-sb-custom-title'
                            rows={2}
                            maxLength={60}
                            placeholder='例如：去大理做数字游民'
                            value={customTitle}
                            onChange={(e) => {
                              setCustomTitle(e.target.value);
                              setPreview(null);
                              setCustomErr('');
                            }}
                          />
                          <div className='y-sb-custom-row'>
                            <label htmlFor='y-sb-custom-type'>任务分类</label>
                            <select
                              id='y-sb-custom-type'
                              value={customType}
                              onChange={(e) =>
                                setCustomType(
                                  e.target
                                    .value as (typeof SIX_BODY_TYPES)[number]
                                )
                              }
                            >
                              {SIX_BODY_TYPES.map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div className='y-sb-custom-int'>
                            <span>你打算投入多少</span>
                            <div role='group' aria-label='投入强度'>
                              {(
                                Object.keys(CUSTOM_INTENSITY) as CustomIntensity[]
                              ).map((k) => {
                                const c = CUSTOM_INTENSITY[k];
                                return (
                                  <button
                                    key={k}
                                    type='button'
                                    className={
                                      customIntensity === k ? 'is-on' : ''
                                    }
                                    aria-pressed={customIntensity === k}
                                    onClick={() => setCustomIntensity(k)}
                                  >
                                    <b>{c.label}</b>
                                    <em>
                                      现金 -{c.cash} · 精力 -{c.energy}
                                    </em>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <p className='y-sb-custom-hint'>
                            投入由你决定；系统不判断多少合适，也不推断这一步的七维变化。
                          </p>
                          {customErr ? (
                            <p className='y-sb-custom-err' role='alert'>
                              {customErr}
                            </p>
                          ) : null}

                          {!preview ? (
                            <>
                              <div className='y-sb-facts-list'>
                                <div>
                                  <span>城市</span>
                                  <b>
                                    {city.name} · 岗位密度 {bandOf(city.jobs)} ·
                                    生活成本 {bandOf(city.cost)}
                                  </b>
                                </div>
                                <div>
                                  <span>当前资源</span>
                                  <b>
                                    现金 {run.cash} · 精力 {run.energy}
                                  </b>
                                </div>
                                <div>
                                  <span>这一步投入</span>
                                  <b>
                                    {customCost.label} · 现金 -{customCost.cash} ·
                                    精力 -{customCost.energy}
                                  </b>
                                </div>
                                <div>
                                  <span>阶段</span>
                                  <b>
                                    {stage.name} · 年龄{' '}
                                    {state.profile.s.age} 岁
                                  </b>
                                </div>
                              </div>
                              <div className='y-sb-custom-actions'>
                                <button
                                  type='button'
                                  className='y-btn y-btn-main'
                                  onClick={runCustomSearch}
                                >
                                  检索真实原文 →
                                </button>
                                <button
                                  type='button'
                                  className='y-btn y-btn-s'
                                  onClick={closeCustom}
                                >
                                  取消
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className='y-sb-evidence-head'>
                                <b>
                                  {preview.hits.length
                                    ? `命中 ${preview.hits.length} 条真实原文`
                                    : '没有检索到直接相关的原文'}
                                </b>
                                <span>检索范围 {DOC_COUNT} 条语料</span>
                              </div>
                              {preview.hits.length ? (
                                <ul className='y-sb-evidence'>
                                  {preview.hits.slice(0, 4).map((h) => (
                                    <li key={h.url}>
                                      <a
                                        href={h.url}
                                        target='_blank'
                                        rel='noreferrer'
                                      >
                                        {h.title}
                                      </a>
                                      <span>
                                        {h.source}
                                        {h.author ? ` · ${h.author}` : ''}
                                      </span>
                                      <p>{h.excerpt}</p>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className='y-sb-custom-hint'>
                                  没有命中就不补结论；你仍然可以加入这一步，但系统不会编造阻力。
                                </p>
                              )}

                              <div className='y-sb-facts-list'>
                                <div>
                                  <span>城市结构</span>
                                  <b>
                                    {city.name} · 岗位密度 {bandOf(city.jobs)} ·
                                    生活成本 {bandOf(city.cost)}
                                  </b>
                                </div>
                                <div>
                                  <span>当前资源</span>
                                  <b>
                                    现金 {run.cash} · 精力 {run.energy}
                                  </b>
                                </div>
                                <div>
                                  <span>这一步投入</span>
                                  <b>
                                    {customCost.label} · 现金 -{customCost.cash} ·
                                    精力 -{customCost.energy}
                                  </b>
                                </div>
                                <div>
                                  <span>阶段</span>
                                  <b>
                                    {stage.name} · 年龄{' '}
                                    {state.profile.s.age} 岁
                                  </b>
                                </div>
                                {preview.category ? (
                                  <div>
                                    <span>检索命中</span>
                                    <b>{preview.category.label}</b>
                                  </div>
                                ) : null}
                              </div>

                              <div className='y-sb-custom-actions'>
                                <button
                                  type='button'
                                  className='y-btn y-btn-main'
                                  onClick={addCustom}
                                  disabled={!customAfford.ok}
                                  title={
                                    customAfford.ok
                                      ? undefined
                                      : customAfford.reason
                                  }
                                >
                                  加入这一步
                                </button>
                                <button
                                  type='button'
                                  className='y-btn y-btn-s'
                                  onClick={() => setPreview(null)}
                                >
                                  换个说法
                                </button>
                                <button
                                  type='button'
                                  className='y-btn y-btn-s'
                                  onClick={closeCustom}
                                >
                                  取消
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className='y-sb-picker-foot'>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={autoFill}
                      >
                        用规则填满（示例）
                      </button>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={undo}
                        disabled={!picks.length}
                      >
                        撤回
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section className='y-sb-card y-sb-tips'>
                <h4>怎么读这个沙盘</h4>
                <ul>
                  <li>每格是一个季度，6 格共 18 个月。</li>
                  <li>现金缓冲与精力是余量，不是金额；不足时不能落子。</li>
                  <li>自定义的路同样可以落子：系统只记录投入与原文，不判断值不值得。</li>
                  <li>预设动作的七维效果是规则假设，不是样本均值或实验结果。</li>
                  <li>结果只由固定规则算出，不含概率，也不回写真实处境与档案。</li>
                  <li>「维持现状」同样消耗时间与现金，用于对照，不是推荐。</li>
                  <li>「用规则填满」只演示一条路径，不是推荐。</li>
                </ul>
              </section>
            </aside>
          </div>

          <section className='y-sb-card y-sb-outcome' ref={outcomeRef}>
            <div className='y-sb-card-head'>
              <div>
                <p className='y-eyebrow'>03 / 结果对照</p>
                <h3>这条路线走到哪里</h3>
                <p className='y-sb-sub'>
                  与「现在」「维持现状」放在一起看；数字来自同一套七维模型。
                </p>
              </div>
              <DataSourceBadge source='sandbox' />
            </div>

            {!picks.length ? (
              <div className='y-sb-empty'>
                <b>沙盘还是空的</b>
                <p>先在上面落下第一子；至少走两格才能采纳为计划。</p>
              </div>
            ) : (
              <>
                <div className='y-sb-lanes'>
                  <article className='y-sb-lane'>
                    <span className='y-sb-lane-k'>现在</span>
                    <b className='is-ellipsis' title={nowTop?.node.name}>
                      {shortName(nowTop?.node.name ?? '未定')}
                    </b>
                    <em>{simBand(nowTop?.sim ?? 0)}</em>
                    <div className='y-sb-lane-meta'>
                      <span>体验 {state.profile.s.history}</span>
                      <span>现金 {run.base.cash}</span>
                      <span>精力 {run.base.energy}</span>
                    </div>
                  </article>

                  <article className='y-sb-lane is-plan'>
                    <span className='y-sb-lane-k'>这条路线 · {picks.length} 格</span>
                    <b className='is-ellipsis' title={planTop?.node.name}>
                      {shortName(planTop?.node.name ?? '未定')}
                    </b>
                    <em>
                      {simBand(planTop?.sim ?? 0)} · 稳定度 {stability.label}
                    </em>
                    <div className='y-sb-lane-meta'>
                      <span>体验 {run.final.history}</span>
                      <span>现金 {run.cash}</span>
                      <span>精力 {run.energy}</span>
                      {customCount ? <span>自定义 {customCount} 步</span> : null}
                    </div>
                  </article>

                  <article className='y-sb-lane is-base'>
                    <span className='y-sb-lane-k'>维持现状 · 同样 {picks.length} 格</span>
                    <b className='is-ellipsis' title={baseTop?.node.name}>
                      {shortName(baseTop?.node.name ?? '未定')}
                    </b>
                    <em>{simBand(baseTop?.sim ?? 0)}</em>
                    <div className='y-sb-lane-meta'>
                      <span>体验 {baseRun.final.history}</span>
                      <span>现金 {baseRun.cash}</span>
                      <span>精力 {baseRun.energy}</span>
                    </div>
                  </article>
                </div>

                <div className='y-sb-deltas-wrap'>
                  <h4>七维变化（现在 → 推演结束）</h4>
                  <div className='y-sb-drows'>
                    {DIMS.map((d) => (
                      <DimRow
                        key={d.k}
                        k={d.k}
                        from={state.profile.s[d.k]}
                        to={run.final[d.k]}
                      />
                    ))}
                  </div>
                </div>

                <ul className='y-sb-verdict'>
                  {verdicts.map((v) => (
                    <li key={v.t}>
                      <span>{v.t}</span>
                      <p>{v.body}</p>
                    </li>
                  ))}
                </ul>

                <div className='y-sb-adopt'>
                  <div>
                    <b>把这条路线变成可以做的任务</b>
                    <em>
                      按动作与自定义的路生成最多 4 条体验任务，写进第 4 步的体验工作台；
                      不修改你的处境与档案。当前方向：{direction}
                    </em>
                  </div>
                  <button
                    type='button'
                    className='y-btn y-btn-main'
                    onClick={adopt}
                    disabled={!canAdopt}
                    title={canAdopt ? undefined : '至少走两格再采纳'}
                  >
                    采纳为计划 →
                  </button>
                </div>

                <p className='y-sb-note'>
                  {canAdopt
                    ? '采纳后会写入体验任务表，可在成长闭环里继续标记完成与归档。'
                    : '至少走两格，才足以形成一条可执行路线。'}
                </p>
              </>
            )}
          </section>

          <footer className='y-sb-foot'>
            <span>沙盘位于 #/sandbox · 与四步主流程分开保存</span>
            <span>规则版本 v1 · 无随机 · 不构成预测</span>
          </footer>
        </main>
      </div>

      <p className='y-page-foot'>
        域途 · 体验式生涯陪伴系统 ｜ 沙盘是固定规则的启发式推演，不是预测。
        <br />
        背景：用户提供的叶面水珠照片。
      </p>
    </div>
  );
}
