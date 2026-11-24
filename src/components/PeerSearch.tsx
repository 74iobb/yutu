import { useEffect, useMemo, useState } from 'react';
import { CHOICE_LABEL } from '@/lib/model';
import { useYutu } from '@/store/YutuContext';
import type { Discussion } from '@/types';
import { Empty } from './bits';
import DiscussionThread, { ReviewDiscussion } from './DiscussionThread';
import { ReviewMediaPanel } from './MediaGallery';

/**
 * 复盘 / 讨论搜索。
 *
 * - 复盘：在已加载的 reviews 里做文字包含匹配
 * - 讨论：在线走 discussions_search（LIKE），离线只搜本机已加载的讨论
 * - 不做语义检索；结果只覆盖公开复盘与当前可见讨论
 */
export default function PeerSearch() {
  const { state, searchDiscussions } = useYutu();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const term = q.trim();
  const active = term.length >= 2;

  useEffect(() => {
    if (!active) {
      setHits([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = window.setTimeout(() => {
      void searchDiscussions(term)
        .then((rows) => {
          if (alive) setHits(rows.slice(0, 10));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 320);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [active, term, searchDiscussions]);

  const reviewHits = useMemo(() => {
    if (!active) return [];
    const t = term.toLowerCase();
    return state.reviews
      .filter(
        (r) =>
          r.content.toLowerCase().includes(t) ||
          r.authorName.toLowerCase().includes(t) ||
          (r.city || '').toLowerCase().includes(t) ||
          (CHOICE_LABEL[r.choice] || '').toLowerCase().includes(t)
      )
      .slice(0, 6);
  }, [active, state.reviews, term]);

  return (
    <div className='y-card y-peer-search'>
      <h3>
        搜索复盘与讨论
        <span className='y-mini'>按文字包含匹配 · 不是语义搜索</span>
      </h3>
      <div className='y-peer-search-bar'>
        <input
          type='search'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='输入至少 2 个字，搜索复盘正文、作者、城市或讨论内容'
          aria-label='搜索复盘与讨论'
        />
        {q ? (
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => setQ('')}
          >
            清除
          </button>
        ) : null}
      </div>

      {!active ? (
        <p className='y-note'>
          示例：现金流、造价、专升本、成都。离线时只搜索本机已加载的讨论。
        </p>
      ) : (
        <div className='y-peer-search-results'>
          <div className='y-search-head'>
            <b>「{term}」</b>
            <span>
              {reviewHits.length} 条复盘 · {hits.length} 条讨论
            </span>
            {loading ? <em>搜索中…</em> : null}
          </div>

          {reviewHits.length ? (
            <section>
              <h4>复盘</h4>
              {reviewHits.map((r) => (
                <div className='y-search-item' key={r.id}>
                  <div className='y-search-meta'>
                    <b>{r.authorName}</b>
                    <span>{r.city || '城市未填'}</span>
                    <span>{CHOICE_LABEL[r.choice]}</span>
                    <span>有效标记 {state.markCounts[r.id] ?? 0}</span>
                  </div>
                  <p>{r.content.replace('[经验卡] ', '').slice(0, 180)}</p>
                  <ReviewDiscussion reviewId={r.id} />
                  <ReviewMediaPanel reviewId={r.id} />
                </div>
              ))}
            </section>
          ) : null}

          {hits.length ? (
            <section>
              <h4>讨论</h4>
              {hits.map((d) => (
                <DiscussionHit key={d.id} d={d} />
              ))}
            </section>
          ) : null}

          {!reviewHits.length && !hits.length && !loading ? (
            <Empty>
              没有找到包含「{term}」的复盘或讨论。换一个更短的关键词试试。
            </Empty>
          ) : null}

          <p className='y-note'>
            复盘搜索覆盖已加载的公开复盘；讨论搜索在线走 LIKE 接口，离线只覆盖本机已加载的讨论。
          </p>
        </div>
      )}
    </div>
  );
}

function DiscussionHit({ d }: { d: Discussion }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='y-search-item'>
      <div className='y-search-meta'>
        <b>{d.authorName}</b>
        <span>{d.createdAt}</span>
      </div>
      <p>{d.content}</p>
      <button
        type='button'
        className='y-btn y-btn-s'
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '收起所属讨论' : '查看所属复盘讨论'}
      </button>
      {open ? <DiscussionThread reviewId={d.reviewId} /> : null}
    </div>
  );
}
