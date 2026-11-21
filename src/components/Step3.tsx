import { useDeferredValue, useMemo, useState } from 'react';
import {
  bandOf,
  CITY_MAP,
  currentStage,
  FEAS_LABEL,
  feasibility,
  stageDirections,
} from '@/lib/model';
import {
  DOC_COUNT,
  getCases,
  liveByField,
  searchByField,
} from '@/lib/search';
import { SNAPSHOT_AT } from '@/data/snapshot-meta';
import { useImmersive } from '@/lib/uiMotion';
import { useYutu } from '@/store/YutuContext';
import DirectionSky from './DirectionSky';
import { Chip, Empty, Kv, LiveCard, SourceCard } from './bits';
import DataSourceBadge from './DataSourceBadge';

interface Props {
  /** 切到同一步内的「资源作战图」视图；传入方向则会同时选中 */
  onOpenMap?: (dirName?: string) => void;
}

export default function Step3({ onOpenMap }: Props = {}) {
  const {
    state,
    setStep,
    setOnlyFeasible,
    toggleShortlist,
    setPick,
    setIntent,
  } = useYutu();
  const p = state.profile;
  const stage = currentStage(p);
  const city = CITY_MAP[p.city];
  /** 沉浸式方向星图：铺满视口，中心是你，三层环按可行性排列 */
  const [sky, setSky] = useState(false);
  useImmersive(sky, setSky);
  const deferredIntent = useDeferredValue(state.intent);
  const query = [p.field, deferredIntent].filter(Boolean).join(' ').trim();
  const all = useMemo(
    () =>
      stageDirections(stage.id).map(d => ({ dir: d, f: feasibility(d, p) })),
    [p, stage.id]
  );
  const shown = state.onlyFeasible
    ? all.filter(x => x.f.level === 'high')
    : all;
  const canCount = all.filter(x => x.f.level === 'high').length;
  const midCount = all.filter(x => x.f.level === 'mid').length;
  const cases = useMemo(
    () => getCases(query || p.field, stage.id),
    [query, p.field, stage.id]
  );
  const search = useMemo(
    () => searchByField(query || p.field, stage.id),
    [query, p.field, stage.id]
  );
  const livePack = useMemo(
    () => liveByField(query || p.field, stage.id, cases.items.map((c) => c.url)),
    [query, p.field, stage.id, cases.items]
  );
  const live = livePack.items;
  const liveLabel = livePack.category
    ? `${livePack.category.label}（按「${p.field}」匹配）`
    : `「${query || p.field || '未填写'}」关键词检索`;

  return (
    <section id='y-p3' role='tabpanel' aria-labelledby='y-s3'>
      <header className='y-lead'>
        <p className='y-eyebrow'>03 / 方向清单</p>
        <h2>这一阶段的所有方向，以及你当下能走的那些</h2>
        <p>可行性看条件是否就位，不代表对你的评价。</p>
      </header>

      <div className='y-insight'>
        <span className='y-insight-tag'>本步结论</span>
        <p>
          「{stage.name}」共有 <b>{all.length}</b> 个方向，其中当前可做{' '}
          <b>{canCount}</b> 个{midCount ? `、需补条件 ${midCount} 个` : ''}。
          先按可行性浏览主列，需要核对判定口径时再展开右侧「可行性判定依据」。
        </p>
      </div>

      <div className='y-card y-intent'>
        <p className='y-eyebrow'>你的想法</p>
        <textarea
          value={state.intent}
          onChange={e => setIntent(e.target.value)}
          placeholder='例如：想做数控编程，但担心学历不够；每周能投入 6 小时，希望半年内看到结果。'
          rows={2}
        />
      </div>

      <details className='y-card y-search-basis'>
        <summary className='y-search-summary'>
          <span className='y-eyebrow'>检索依据</span>
          <b>「{p.field || '未填写'}」</b>
          <span>
            {p.identity === 'study' ? '所学' : '所从事'} · {city.name} ·{' '}
            {stage.name}
          </span>
        </summary>
        <p className='y-note'>
          {!p.field.trim()
            ? '第一步还没有填写方向，当前只能使用阶段通用内容。'
            : cases.matchKind === 'category'
              ? `命中专业大类「${search.category?.label}」，并叠加关键词命中 ${search.hits.length} 条。`
              : cases.matchKind === 'keyword'
                ? `未命中内置大类，已按你填写的关键词在检索语料中命中 ${search.hits.length} 条。`
                : `没有检索到与「${p.field}」直接相关的内容，下方通用内容已标注。`}
          {' '}检索范围：{DOC_COUNT} 条检索语料（知乎快照 / 精编案例 / 资源与方向证据）。
        </p>
      </details>

      <div className='y-layout-main'>
        <div className='y-layout-col'>
          <div className='y-card y-focus-card'>
            <div className='y-card-head'>
              <h3>
                「{stage.name}」的全部方向（{all.length} 条
                {state.onlyFeasible ? `，当前可做 ${shown.length} 条` : ''}）
              </h3>
              <div className='y-tools'>
                <span className='y-chip y-chip-c'>当前可做</span>
                <span className='y-chip y-chip-w'>需补条件</span>
                <span className='y-chip y-chip-r'>条件不足</span>
                <DataSourceBadge source='directions' showLabel={false} />
                <button
                  type='button'
                  className='y-btn y-btn-s y-sky-open'
                  onClick={() => setSky(true)}
                  title='全屏查看方向与可行性层次'
                >
                  方向星图
                </button>
                <label
                  htmlFor='y-only-feasible'
                  style={{
                    margin: '0 0 0 4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <input
                    type='checkbox'
                    id='y-only-feasible'
                    style={{ width: 'auto', accentColor: 'var(--y-accent)' }}
                    checked={state.onlyFeasible}
                    onChange={e => setOnlyFeasible(e.target.checked)}
                  />
                  只看当前可做的
                </label>
              </div>
            </div>
            <div>
              {!shown.length ? (
                <Empty>
                  <p>
                    当前筛选下没有「当前可做」的方向，共 {all.length}{' '}
                    条被隐藏。这通常说明约束较紧，可先从「需补条件」里挑成本最低的一条。
                  </p>
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    style={{ marginTop: 9 }}
                    onClick={() => setOnlyFeasible(false)}
                  >
                    显示全部方向
                  </button>
                </Empty>
              ) : (
                shown.map(({ dir, f }) => (
                  <div
                    className={`y-dir f-${f.level}${
                      state.shortlist.includes(dir.name) ? ' is-short' : ''
                    }${state.pick === dir.name ? ' is-picked' : ''}`}
                    key={dir.name}
                  >
                    <div className='y-dir-top'>
                      <span className='y-dir-n'>
                        {dir.name}
                        {state.shortlist.includes(dir.name) ? (
                          <em className='y-dir-cand'>
                            候选 {state.shortlist.indexOf(dir.name) + 1}
                          </em>
                        ) : null}
                        {state.pick === dir.name ? (
                          <em className='y-dir-picked'>已选定</em>
                        ) : null}
                      </span>
                      <Chip
                        tone={
                          FEAS_LABEL[f.level].cls.replace('y-chip-', '') as
                            'c' | 'w' | 'r'
                        }
                      >
                        {FEAS_LABEL[f.level].t}
                      </Chip>
                    </div>
                    <p className='y-dir-b'>{dir.note}</p>
                    <details className='y-dir-more'>
                      <summary>前置条件与判定依据</summary>
                      <p className='y-dir-b'>
                        <b>前置条件：</b>
                        {dir.prereq}
                      </p>
                      {f.reasons.length ? (
                        <p className='y-dir-b'>
                          <b>判定依据：</b>
                          {f.reasons.join('；')}
                        </p>
                      ) : null}
                    </details>
                    <div className='y-dir-short'>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={() => toggleShortlist(dir.name)}
                      >
                        {state.shortlist.includes(dir.name)
                          ? '已加入候选'
                          : '＋ 加入候选'}
                      </button>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        onClick={() => {
                          setPick(dir.name);
                          onOpenMap?.(dir.name);
                        }}
                      >
                        看代价 →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className='y-aside y-aside-sticky'>
          <details className='y-detail'>
            <summary>可行性判定依据</summary>
            <div className='y-detail-body'>
              <Kv
                rows={[
                  [
                    '所在城市',
                    `${city.name}（${city.tier}）· 岗位密度 ${bandOf(city.jobs)} · 生活成本 ${bandOf(city.cost)}`,
                  ],
                  ['经济压力', `${p.s.econ} / 100`],
                  ['家庭负担', `${p.s.family} / 100`],
                  ['年龄', `${p.s.age} 岁`],
                  ['所在阶段', stage.name],
                ]}
              />
            </div>
          </details>

          <div className='y-card'>
            <h3>
              同类处境者的记述
              <DataSourceBadge source='zhihuCases' showLabel={false} />
              <span className='y-mini'>知乎检索，保留原文链接</span>
            </h3>
            <p className='y-note' style={{ paddingBottom: 6 }}>
              以下为知乎开放平台检索取得的真实内容，摘要来自原文；标注类型以便区分亲历记述、社区回答与文章。
            </p>
            {cases.fallback ? (
              <p className='y-warn' style={{ marginBottom: 7 }}>
                {cases.note}
              </p>
            ) : (
              <p className='y-note' style={{ paddingBottom: 7 }}>
                {cases.note}
              </p>
            )}
            {!cases.items.length ? (
              <Empty>这一阶段暂未检索到可引用的记述。</Empty>
            ) : (
              cases.items.map(it => (
                <SourceCard
                  key={`${it.url}-${it.title}`}
                  title={it.title}
                  kind={it.kind}
                  gist={it.gist}
                  url={it.url}
                />
              ))
            )}
            {live.length ? (
              <div
                style={{
                  marginTop: 12,
                  borderTop: '1px dashed var(--y-line)',
                  paddingTop: 10,
                }}
              >
                <h4
                  style={{ fontSize: 12.5, fontWeight: 620, marginBottom: 4 }}
                >
                  近期社区讨论
                  <span
                    className='y-mini'
                    style={{
                      fontWeight: 400,
                      color: 'var(--y-muted)',
                      marginLeft: 7,
                    }}
                  >
                    知乎 CLI · {SNAPSHOT_AT} 快照
                  </span>
                </h4>
                <p className='y-note' style={{ paddingBottom: 6 }}>
                  以下为按「{liveLabel}
                  」检索到的近期回答与文章摘要，保留原文链接；摘要不代表平台结论。
                </p>
                {live.slice(0, 3).map(it => (
                  <LiveCard
                    key={it.url}
                    title={it.title}
                    type={it.type}
                    author={it.author}
                    excerpt={it.excerpt}
                    votes={it.votes}
                    url={it.url}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <div className='y-nav'>
        <button type='button' className='y-btn' onClick={() => setStep(2)}>
          ← 返回了解环境
        </button>
        <button
          type='button'
          className='y-btn y-btn-main'
          onClick={() => onOpenMap?.()}
        >
          看资源与作战图 →
        </button>
        <button
          type='button'
          className='y-btn'
          onClick={() => setStep(4)}
        >
          直接进入归属 →
        </button>
      </div>

      {sky ? (
        <DirectionSky
          items={all}
          picked={state.pick}
          shortlist={state.shortlist}
          stageName={stage.name}
          field={p.field}
          onPick={setPick}
          onToggle={toggleShortlist}
          onOpenMap={name => {
            setSky(false);
            onOpenMap?.(name);
          }}
          onExit={() => setSky(false)}
        />
      ) : null}
    </section>
  );
}
