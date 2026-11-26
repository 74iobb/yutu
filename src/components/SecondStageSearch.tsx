import { useMemo } from 'react';
import type { Direction, StageId } from '@/data/catalog';
import { searchByField, liveByField } from '@/lib/search';
import { Empty, LiveCard, SourceCard } from './bits';

interface Props {
  /** 当前选定（state.pick）的方向；为空时展示引导 */
  direction: Direction | null;
  /** 第一步填写的专业 / 行业 */
  field: string;
  /** 「你的想法」自由文本，作为二阶的个性化条件 */
  intent: string;
  stageId: StageId;
  /** 一阶已经展示过的 URL，二阶去重，避免同一张卡出现两次 */
  excludeUrls?: string[];
  onOpenMap?: () => void;
}

/**
 * 二阶检索：一阶给出阶段方向后，把「选定方向 + 你的想法 + 专业」组合成更窄的查询，
 * 在同一份真实语料里做第二次筛选。
 *
 * 不调用运行时网络：仍只在已收集的知乎快照 / 精编案例 / 资源证据里排序。
 */
export default function SecondStageSearch({
  direction,
  field,
  intent,
  stageId,
  excludeUrls = [],
  onOpenMap,
}: Props) {
  const query = direction
    ? [direction.name, intent, field].filter(Boolean).join(' ').trim()
    : '';
  const excludeKey = excludeUrls.join('|');

  const pack = useMemo(() => {
    if (!direction) return null;
    const excluded = new Set(excludeKey ? excludeKey.split('|') : []);
    const res = searchByField(query, stageId);
    const hits = res.hits.filter((h) => !excluded.has(h.url));
    const live = liveByField(query, stageId, [
      ...excluded,
      ...hits.map((h) => h.url),
    ]).items;
    return { res, hits, live };
  }, [direction, query, stageId, excludeKey]);

  return (
    <section className='y-second' aria-label='二阶检索'>
      <div className='y-second-head'>
        <span className='y-second-badge'>二阶</span>
        <div>
          <h3>
            {direction
              ? `针对「${direction.name}」的深挖`
              : '二阶检索 · 选定方向后深挖'}
          </h3>
          <p className='y-second-sub'>
            一阶给你阶段内的方向；二阶把你选的方向、想法和专业组合起来，再筛一次。
          </p>
        </div>
      </div>

      {!direction ? (
        <Empty>
          <p>
            先在左侧方向清单里选定一条（点「看代价」或「加入候选」后选定），这里会自动组合
            <b> 方向 + 你的想法 + 专业 </b>
            做第二次检索。
          </p>
        </Empty>
      ) : (
        <>
          <div className='y-second-query'>
            <span>
              方向 <b>{direction.name}</b>
            </span>
            <span>
              想法 <b>{intent.trim() || '未填写（可在上方「你的想法」补充）'}</b>
            </span>
            <span>
              专业 <b>{field || '未填写'}</b>
            </span>
          </div>

          <div className='y-second-meta'>
            <b>{pack ? pack.hits.length + pack.live.length : 0}</b> 条新结果
            {pack?.res.tokens.length ? (
              <span className='y-second-tokens'>
                命中词：{pack.res.tokens.slice(0, 6).join(' / ')}
              </span>
            ) : null}
          </div>

          {!pack?.hits.length && !pack?.live.length ? (
            <Empty>
              <p>
                二阶没有检索到新的内容。可以把「你的想法」写具体一点（城市 + 岗位 +
                你最担心的点），或换一个更窄的方向再试。
              </p>
            </Empty>
          ) : (
            <div className='y-second-list'>
              {pack.hits.slice(0, 6).map((h) => (
                <SourceCard
                  key={h.url}
                  title={h.title}
                  kind={h.kind}
                  gist={h.excerpt.slice(0, 160)}
                  url={h.url}
                />
              ))}
              {pack.live.slice(0, 3).map((it) => (
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
          )}

          <div className='y-second-foot'>
            <p className='y-note'>
              二阶仍只在这批真实语料里检索，不发起运行时网络请求；摘要来自原文，不代表平台结论。
            </p>
            {onOpenMap ? (
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={onOpenMap}
              >
                去作战图看执行清单 →
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
