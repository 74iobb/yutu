import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useYutu } from '@/store/YutuContext';
import type { Discussion } from '@/types';
import { Empty } from './bits';

function buildTree(items: Discussion[]) {
  const byParent = new Map<string, Discussion[]>();
  items.forEach((d) => {
    const p = d.parentId || '0';
    const list = byParent.get(p) ?? [];
    list.push(d);
    byParent.set(p, list);
  });
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return byParent;
}

interface Props {
  reviewId: string;
}

/**
 * 复盘下的树状讨论。
 * - 顶层 parentId = '0'，回复挂在对应父节点下
 * - 只展示公开讨论；发布前自动脱敏
 * - 离线时保存在本机，平台恢复后再同步
 */
export default function DiscussionThread({ reviewId }: Props) {
  const {
    state,
    ownerKey,
    loadDiscussions,
    submitDiscussion,
    removeDiscussion,
  } = useYutu();
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState('');

  const items = useMemo(
    () => (state.discussions ?? []).filter((d) => d.reviewId === reviewId),
    [state.discussions, reviewId]
  );
  const tree = useMemo(() => buildTree(items), [items]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadDiscussions(reviewId).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reviewId, loadDiscussions]);

  function render(parentId: string, depth: number): ReactNode {
    const list = tree.get(parentId) ?? [];
    if (!list.length) return null;
    return list.map((d) => (
      <li
        key={d.id}
        className={depth > 0 ? 'is-reply' : undefined}
        style={{ marginLeft: Math.min(depth, 3) * 14 }}
      >
        <div className='y-disc-meta'>
          <b>{d.authorName}</b>
          <span>{d.createdAt}</span>
        </div>
        <p className='y-disc-content'>{d.content}</p>
        <div className='y-disc-actions'>
          <button
            type='button'
            onClick={() => {
              setReplyTo(d.id);
              setText('');
            }}
          >
            回复
          </button>
          {d.authorKey === ownerKey ? (
            <button type='button' onClick={() => removeDiscussion(d.id)}>
              删除
            </button>
          ) : null}
        </div>
        <ul className='y-disc-children'>{render(d.id, depth + 1)}</ul>
      </li>
    ));
  }

  function submit() {
    if (!text.trim()) return;
    submitDiscussion(reviewId, replyTo ?? '0', text);
    setText('');
    setReplyTo(null);
  }

  return (
    <div className='y-disc-thread'>
      {loading && !items.length ? (
        <p className='y-note'>正在加载讨论…</p>
      ) : null}
      {items.length ? (
        <ul className='y-disc-list'>{render('0', 0)}</ul>
      ) : !loading ? (
        <Empty>还没有人讨论。你可以先留下一个判断。</Empty>
      ) : null}

      <div className='y-disc-form'>
        {replyTo ? (
          <span className='y-disc-reply-to'>
            回复中 ·{' '}
            <button type='button' onClick={() => setReplyTo(null)}>
              取消
            </button>
          </span>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='写下你的判断、经验或反问。发布前会自动脱敏。'
          rows={2}
          maxLength={500}
        />
        <div className='y-row' style={{ marginTop: 6 }}>
          <button type='button' className='y-btn y-btn-s' onClick={submit}>
            发布讨论
          </button>
          {!state.backendOnline ? (
            <span className='y-chip'>离线时仅保存在本机</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 折叠入口：展开时才挂载讨论线程，避免一次性请求所有复盘 */
export function ReviewDiscussion({ reviewId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className='y-disc'
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>讨论</summary>
      {open ? <DiscussionThread reviewId={reviewId} /> : null}
    </details>
  );
}
