import { useMemo } from 'react';
import {
  CHOICE_LABEL,
  cosSim,
  currentStage,
  DIMS,
  feasibility,
  FEAS_LABEL,
  inBand,
  mag,
  norm,
  ranked,
  similarityBreakdown,
  simBand,
  stabilityOf,
  stageDirections,
  vec,
} from '@/lib/model';
import { buildSummaryMarkdown, copyText, downloadText } from '@/lib/summary';
import { useYutu } from '@/store/YutuContext';
import GrowthDelta from './GrowthDelta';
import { Chip, Kv } from './bits';
import DataSourceBadge from './DataSourceBadge';

function shortName(name: string) {
  return name.split(' · ')[0];
}

/**
 * 第 3 步「方向与推演」的第三个视图：把前两步的处境、本步的方向，
 * 以及归属结论与一页纸摘要收在一起，作为进入闭环前的最后一次确认。
 * SET 顺序保持不变：S 处境 → C 约束 → R 相近经验 → T 迁移。
 */
export default function StepSummary({ onOpenList }: { onOpenList: () => void }) {
  const { state, setStep, setSub, nodes, ownerKey, flash } = useYutu();
  const s = state.profile.s;
  const stage = currentStage(state.profile);
  const rank = useMemo(() => ranked(s, nodes), [s, nodes]);
  const top = rank[0];
  const stab = stabilityOf(s, nodes);
  const m = mag(s);
  const band = inBand(rank);
  const whyTop = top ? similarityBreakdown(s, top.node).slice(0, 5) : [];
  const dirs = useMemo(
    () =>
      stageDirections(stage.id).map(d => ({
        dir: d,
        f: feasibility(d, state.profile),
      })),
    [stage.id, state.profile]
  );
  const picked = dirs.find(x => x.dir.name === state.pick);
  const candidates = state.shortlist
    .map(name => dirs.find(x => x.dir.name === name))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const peerReviews = useMemo(() => {
    const mine = vec(s);
    return state.reviews
      .filter(r => r.authorKey !== ownerKey)
      .map(r => ({
        review: r,
        sim: r.vector ? cosSim(mine, vec(r.vector)) : 0,
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 4);
  }, [state.reviews, ownerKey, s]);
  const victoryHistory = [...state.victories].reverse();
  const recentVictories = victoryHistory.slice(0, 5);

  const warnings: string[] = [];
  if (m < 0.35) {
    warnings.push('各维接近中性，归属尚未落定；接近度只作参考。');
  }
  if (top && top.sim > 0.75) {
    const mn = mag(top.node.s);
    const dm = Math.abs(m - mn);
    if (dm > 0.3) {
      warnings.push(
        `与「${shortName(top.node.name)}」的强度接近度偏低；这只是模型提示，需要结合逐维差异阅读。`
      );
    }
  }

  if (!top) {
    return (
      <section id='y-p3' role='tabpanel' aria-labelledby='y-s3'>
        <div className='y-card'>暂无可比较的环境域。</div>
      </section>
    );
  }

  const focused = picked ? [picked] : candidates.slice(0, 2);

  return (
    <section id='y-p4' role='tabpanel' aria-labelledby='y-s4'>
      <header className='y-lead'>
        <p className='y-eyebrow'>STEP 03 · 归属与摘要</p>
        <h2>你的处境、约束与归属</h2>
        <p className='y-note' style={{ paddingTop: 6 }}>
          这一步收拢前两步的处境与本步选定的方向；确认后直接进入成长闭环。
        </p>
      </header>

      <div className='y-vor-metrics'>
        <div>
          <span>系统归属域</span>
          <b>{shortName(top.node.name)}</b>
        </div>
        <div>
          <span>接近度</span>
          <b>{simBand(top.sim)}</b>
        </div>
        <div>
          <span>稳定度</span>
          <b>{stab.label}</b>
        </div>
        <div>
          <span>过渡带</span>
          <b>{band.length ? `${band.length} 个邻近域` : '无'}</b>
        </div>
      </div>

      <div className='y-insight'>
        <span className='y-insight-tag'>SET · 处境 → 试验 → 迁移</span>
        <DataSourceBadge source='similarity' showLabel={false} />
        <DataSourceBadge source='nodes' showLabel={false} />
        <p>
          系统归属 <b>{shortName(top.node.name)}</b>，稳定度 {stab.label}。
          {band.length
            ? `过渡带内还有 ${band.length} 个邻近域：${band
                .map(b => shortName(b.node.name))
                .join('、')}。`
            : '与第二名的差距较大，归属相对清晰。'}
        </p>
      </div>

      {warnings.length ? (
        <div style={{ marginBottom: 10 }}>
          {warnings.map(t => (
            <p className='y-warn' style={{ marginBottom: 7 }} key={t}>
              {t}
            </p>
          ))}
        </div>
      ) : null}

      <div className='y-next-grid'>
        <div className='y-next-main'>
          <div className='y-card'>
            <h3>
              处境 S
              <span className='y-mini'>模型的状态输入</span>
            </h3>
            <div className='y-state-list'>
              {DIMS.map((d, i) => (
                <div
                  className='y-state-row'
                  key={d.k}
                  title={`${d.n}：${s[d.k]}${d.unit || ''}（权重 ${d.w}）`}
                >
                  <span>{d.n}</span>
                  <i>
                    <em
                      style={{
                        width: `${Math.max(3, norm(d.k, s[d.k]))}%`,
                        animationDelay: `${i * 45}ms`,
                      }}
                    />
                  </i>
                  <b>
                    {s[d.k]}
                    {d.unit || ''}
                  </b>
                </div>
              ))}
            </div>
            <p className='y-note' style={{ paddingTop: 5 }}>
              阶段 {stage.name}；各维权重与校准状态见侧栏「模型边界」。
            </p>
          </div>

          <div className='y-card'>
            <h3>
              迁移 T
              <span className='y-mini'>归档选择决定漂移，不是打分</span>
            </h3>
            {state.lastArchive ? (
              <GrowthDelta />
            ) : (
              <p className='y-note'>
                完成一次闭环归档后，这里会显示处境迁移。
              </p>
            )}
          </div>

          <div className='y-card'>
            <h3>
              为什么是这个归属
              <span className='y-mini'>带权余弦的逐维方向贡献</span>
            </h3>
            <div className='y-why-list'>
              {whyTop.map(x => {
                const max = Math.max(
                  ...whyTop.map(y => Math.abs(y.value)),
                  1e-9
                );
                return (
                  <div className='y-why-row' key={x.k}>
                    <span>{x.n}</span>
                    <div className='y-why-track'>
                      <i
                        className={x.value >= 0 ? 'pos' : 'neg'}
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round((Math.abs(x.value) / max) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <b>{x.value >= 0 ? '同向' : '反向'}</b>
                  </div>
                );
              })}
            </div>
            <p className='y-note' style={{ paddingTop: 7 }}>
              只显示方向贡献最大的五项；综合相似度还包含强度接近度与低信息收缩。
            </p>
          </div>
        </div>

        <aside className='y-next-side'>
          <div className='y-card'>
            <h3>
              方向约束 C
              <span className='y-mini'>只看已选 / 候选</span>
            </h3>
            {focused.length ? (
              <>
                {focused.map(({ dir, f }) => (
                  <div className='y-constraint' key={dir.name}>
                    <div className='y-constraint-top'>
                      <span>{dir.name}</span>
                      <Chip
                        tone={
                          FEAS_LABEL[f.level].cls.replace('y-chip-', '') as
                            | 'c'
                            | 'w'
                            | 'r'
                        }
                      >
                        {FEAS_LABEL[f.level].t}
                      </Chip>
                    </div>
                    <p className='y-note'>{f.reasons[0] || dir.prereq}</p>
                  </div>
                ))}
                <button
                  type='button'
                  className='y-btn y-btn-s'
                  style={{ marginTop: 7 }}
                  onClick={onOpenList}
                >
                  回方向清单看全部方向
                </button>
              </>
            ) : (
              <>
                <p className='y-note'>
                  还没有选方向。回方向清单挑一条，或直接开始一轮体验。
                </p>
                <button
                  type='button'
                  className='y-btn y-btn-s'
                  onClick={onOpenList}
                >
                  回方向清单选方向
                </button>
              </>
            )}
          </div>

          <div className='y-card'>
            <h3>
              相近经验 R
              <span className='y-mini'>按处境相似度排序</span>
            </h3>
            {peerReviews.length ? (
              peerReviews.map(({ review: r, sim }) => {
                const text = r.content.replace('[经验卡] ', '');
                return (
                  <div className='y-exp-row' key={r.id}>
                    <div className='y-exp-top'>
                      <b>{r.authorName}</b>
                      <span>
                        {r.vector
                          ? `接近度 ${simBand(Math.max(0, sim))}`
                          : r.city || '城市未填'}
                      </span>
                    </div>
                    <p className='y-vic-body'>
                      {text.length > 64 ? `${text.slice(0, 64)}…` : text}
                    </p>
                    <span className='y-vic-ts'>
                      {r.city || '城市未填'} · {CHOICE_LABEL[r.choice]} ·{' '}
                      {state.markCounts[r.id] ?? 0} 个有效标记
                    </span>
                  </div>
                );
              })
            ) : (
              <p className='y-note'>还没有公共复盘。</p>
            )}
          </div>

          <details className='y-card y-fold-card' open>
            <summary className='y-fold-card-summary'>
              <h3>
                你的历史档案
                <span className='y-mini'>{victoryHistory.length} 次</span>
              </h3>
              <span>展开</span>
            </summary>
            {recentVictories.length ? (
              <>
                {recentVictories.map(v => {
                  const filled = [
                    v.answers.feel,
                    v.answers.ctx,
                    v.answers.vision,
                  ].filter(x => x && x.trim().length > 0).length;
                  return (
                    <div className='y-exp-row' key={v.id}>
                      <div className='y-exp-top'>
                        <b>
                          第 {v.no} 次 · {CHOICE_LABEL[v.choice]}
                        </b>
                        <span>{v.at.slice(0, 10)}</span>
                      </div>
                      <p className='y-vic-body'>
                        归属 {shortName(v.domain)} · 接近度 {simBand(v.sim)}
                      </p>
                      <span className='y-vic-ts'>
                        依据：完成 {v.tasks.length} 段体验 · 自省 {filled}/3 问
                      </span>
                    </div>
                  );
                })}
                {victoryHistory.length > recentVictories.length ? (
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    style={{ marginTop: 7 }}
                    onClick={() => {
                      setStep(4);
                      setSub(3);
                    }}
                  >
                    查看全部 {victoryHistory.length} 次
                  </button>
                ) : null}
              </>
            ) : (
              <p className='y-note'>还没有归档记录。</p>
            )}
          </details>

          <details className='y-card y-fold-card'>
            <summary className='y-fold-card-summary'>
              <h3>
                模型边界<span className='y-mini'>必须明示</span>
              </h3>
              <span>展开</span>
            </summary>
            <Kv
              rows={[
                [
                  '方向 + 强度',
                  '综合相似度 = 方向余弦 + 强度接近度；权重是启发式缺省，尚未外部校准。',
                ],
                [
                  '中性不稳',
                  '各维接近 50 时向量模长极小，相似度会被收缩并标记“尚未落定”。',
                ],
                [
                  '归属口径',
                  '归属是七维相似度路由，不是分类标签；不预测结果，也不保证成功率。',
                ],
                [
                  '校准状态',
                  'ΔS 漂移、可行性阈值与相似度权重均待真实样本/专家标注校准。',
                ],
              ]}
            />
          </details>

          <div className='y-card'>
            <h3>
              一页纸摘要
              <span className='y-mini'>把处境、归属、候选与资源带走</span>
            </h3>
            <p className='y-note' style={{ paddingBottom: 8 }}>
              生成一份可离线保存的 Markdown。
            </p>
            <div className='y-row'>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={async () => {
                  const md = buildSummaryMarkdown(state, nodes);
                  const ok = await copyText(md);
                  flash(ok ? '一页纸已复制到剪贴板。' : '复制失败，请改用下载。');
                }}
              >
                复制 Markdown
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => {
                  downloadText(
                    '域途-一页纸.md',
                    buildSummaryMarkdown(state, nodes)
                  );
                  flash('已生成 Markdown 摘要。');
                }}
              >
                下载 .md
              </button>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => {
                  downloadText(
                    '域途-我的数据.json',
                    JSON.stringify(
                      {
                        generatedAt: new Date().toISOString(),
                        stage: stage.name,
                        profile: state.profile,
                        domain: top.node.name,
                        similarityBand: simBand(top.sim),
                        stabilityBand: stab.label,
                        shortlist: state.shortlist,
                        victories: state.victories.length,
                      },
                      null,
                      2
                    ),
                    'application/json;charset=utf-8'
                  );
                  flash('已生成 JSON 数据。');
                }}
              >
                下载 .json
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className='y-nav'>
        <button type='button' className='y-btn' onClick={onOpenList}>
          ← 返回方向清单
        </button>
        <button
          type='button'
          className='y-btn y-btn-main'
          onClick={() => setStep(4)}
        >
          进入成长闭环 →
        </button>
      </div>
    </section>
  );
}
