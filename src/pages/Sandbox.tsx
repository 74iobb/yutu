import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataSourceBadge from '@/components/DataSourceBadge';
import SandboxBoard from '@/components/SandboxBoard';
import {
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
import {
  SANDBOX_ACTION_MAP,
  SANDBOX_ACTIONS,
  SANDBOX_ROUNDS,
  canAfford,
  effectText,
  formatCost,
  recommendAction,
  simulateBaseline,
  simulateSandbox,
  type SandboxActionId,
} from '@/lib/sandbox';
import { useYutu } from '@/store/YutuContext';
import { URBAN_LABEL } from '@/data/catalog';
import type { Scores } from '@/types';

const LS_KEY = 'yutu.sandbox.v1';
const APP_TITLE = '域途 · 体验式生涯陪伴';
const VALID = new Set<string>(SANDBOX_ACTIONS.map((a) => a.id));

function loadPicks(): SandboxActionId[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is SandboxActionId => typeof x === 'string' && VALID.has(x))
      .slice(0, SANDBOX_ROUNDS);
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
  const [picks, setPicks] = useState<SandboxActionId[]>(() => loadPicks());
  const [focus, setFocus] = useState<number | null>(null);
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

  const direction =
    state.pick ||
    state.shortlist[0] ||
    stageDirections(stage.id)[0]?.name ||
    '当前方向';

  function choose(id: SandboxActionId) {
    if (full) return;
    const act = SANDBOX_ACTION_MAP[id];
    const afford = canAfford(act, { cash: run.cash, energy: run.energy });
    if (!afford.ok) {
      flash(`${afford.reason ?? '资源不足'}，先休整一格再走这条路线。`);
      return;
    }
    setPicks([...picks, id]);
    setFocus(null);
  }

  function undo() {
    setPicks((p) => p.slice(0, -1));
    setFocus(null);
  }

  function reset() {
    setPicks([]);
    setFocus(null);
    flash('沙盘已清空；你的真实处境与档案没有变化。');
  }

  /** 按公开规则把剩余格补满：先补资源，再补体验，最后收束 */
  function autoFill() {
    let p: SandboxActionId[] = [...picks];
    while (p.length < SANDBOX_ROUNDS) {
      const sim = simulateSandbox(state.profile.s, p, identity);
      const id = recommendAction(sim.final, {
        cash: sim.cash,
        energy: sim.energy,
      });
      const afford = canAfford(SANDBOX_ACTION_MAP[id], {
        cash: sim.cash,
        energy: sim.energy,
      });
      p = [...p, afford.ok ? id : 'rest'];
    }
    setPicks(p);
    setFocus(null);
    flash('已按公开规则补满六格：先补资源，再补体验，最后收束。');
  }

  function adopt() {
    if (!canAdopt) return;
    const unique = picks
      .filter((id, i) => picks.indexOf(id) === i)
      .slice(0, 4);
    unique.forEach((id) => {
      const a = SANDBOX_ACTION_MAP[id];
      addCustomTask(a.taskTitle.replace('{dir}', direction), a.taskType);
    });
    flash(
      `已把 ${unique.length} 条沙盘任务写进体验工作台；沙盘不修改你的真实处境与档案。`
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
            ? `第 ${run.blockedAt + 1} 格按规则会透支，这条路线需要调整。`
            : '每一步都在可承受范围内。'
        }`,
      },
      {
        t: '边界',
        body: `这是固定规则的推演，不给概率、不判定成败；它只回答“按这套规则走，代价和落点是什么”。`,
      },
    ];
    return items;
  }, [picks.length, rankNow, rankPlan, rankBase, run, baseRun, state.profile.s.history]);

  const planTop = rankPlan[0];
  const baseTop = rankBase[0];
  const nowTop = rankNow[0];

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

      <div id='yutu2' className='y-sb-shell'>
        <header className='y-sb-top'>
          <Link className='y-sb-back' to='/'>
            <span aria-hidden='true'>←</span> 回到域途
          </Link>
          <div className='y-sb-brand'>
            <b>沙盘</b>
            <em>推演 · 不是预测</em>
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
              <p className='y-eyebrow'>推演 · 不是预测</p>
              <h2>把未来 18 个月摆上桌面</h2>
              <p className='y-sb-lead-p'>
                每一格是一个季度，每格只做一个动作。规则固定、公开、无随机：
                它不回答“会不会成功”，只让你看见每一步要付出什么、最后更接近哪个域。
              </p>
              <div className='y-sb-facts'>
                <span>6 格 · 18 个月</span>
                <span>每格 1 个动作</span>
                <span>0 个随机数</span>
                <span>不改真实处境</span>
              </div>
            </div>
            <div className='y-sb-lead-badge'>
              <DataSourceBadge source='sandbox' />
            </div>
          </section>

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
                  const id = picks[i];
                  const act = id ? SANDBOX_ACTION_MAP[id] : null;
                  const isNext = i === nextIdx;
                  return (
                    <li
                      key={i}
                      className={`${act ? 'is-done' : ''}${isNext ? ' is-next' : ''}`}
                    >
                      <button
                        type='button'
                        onClick={() => {
                          if (act) setFocus(i);
                          else if (isNext) setFocus(null);
                        }}
                        disabled={!act && !isNext}
                      >
                        <span>Q{i + 1}</span>
                        <b>{act ? act.name : isNext ? '待落子' : '未解锁'}</b>
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
                  <i className='is-cost' /> 每格另有时间成本：经济压力 +1
                </span>
              </div>
            </section>

            <aside className='y-sb-side'>
              <section className='y-sb-card'>
                {viewing !== null ? (
                  <>
                    <p className='y-eyebrow'>02 / 第 {viewing + 1} 格 · 已落子</p>
                    <h3>{SANDBOX_ACTION_MAP[picks[viewing]].name}</h3>
                    <p className='y-sb-sub'>
                      {SANDBOX_ACTION_MAP[picks[viewing]].brief}
                    </p>
                    <div className='y-sb-stepres'>
                      <span>
                        现金 {run.steps[viewing].cashBefore} →{' '}
                        {run.steps[viewing].cashAfter}
                      </span>
                      <span>
                        精力 {run.steps[viewing].energyBefore} →{' '}
                        {run.steps[viewing].energyAfter}
                      </span>
                    </div>
                    <ul className='y-sb-deltas'>
                      {DIMS.filter(
                        (d) =>
                          run.steps[viewing].before[d.k] !==
                          run.steps[viewing].after[d.k]
                      ).map((d) => (
                        <li key={d.k}>
                          <span>{d.n}</span>
                          <b>
                            {run.steps[viewing].before[d.k]} →{' '}
                            {run.steps[viewing].after[d.k]}
                          </b>
                          <em
                            className={
                              run.steps[viewing].after[d.k] <
                              run.steps[viewing].before[d.k]
                                ? 'is-down'
                                : ''
                            }
                          >
                            {signed(
                              run.steps[viewing].after[d.k] -
                                run.steps[viewing].before[d.k]
                            )}
                          </em>
                        </li>
                      ))}
                    </ul>
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
                    <p className='y-sb-sub'>
                      可动用：现金 {run.cash} · 精力 {run.energy}。现金或精力不足时不能落子。
                    </p>
                    <div className='y-sb-actions'>
                      {SANDBOX_ACTIONS.map((a) => {
                        const afford = canAfford(a, {
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
                            title={afford.reason ?? `${a.brief}｜${effectText(a.drift)}`}
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
                    <div className='y-sb-picker-foot'>
                      <button type='button' className='y-btn y-btn-s' onClick={autoFill}>
                        按规则补满
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
                  <li>结果只由固定规则算出，不含概率，也不回写真实处境与档案。</li>
                  <li>「维持现状」同样消耗时间与现金，用于对照，不是推荐。</li>
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
                      按动作生成最多 4 条体验任务，写进第 4 步的体验工作台；
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
