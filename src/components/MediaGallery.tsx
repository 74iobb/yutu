import { useEffect, useMemo, useState } from 'react';
import { useYutu } from '@/store/YutuContext';
import type { ReviewMedia } from '@/types';
import { Empty } from './bits';

function safeUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * 多模态降级素材层。
 *
 * 平台没有文件存储，所以这里只接受**公开可访问的图片 / 语音链接**，
 * 不接收文件上传、不做转写；图片与音频直接由浏览器加载。
 * 说明文字写入前会脱敏。
 */
export default function MediaGallery({ reviewId }: { reviewId: string }) {
  const { state, ownerKey, loadMedia, submitMedia, removeMedia } = useYutu();
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'image' | 'audio'>('image');
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const items = useMemo(
    () =>
      (state.media ?? []).filter(
        (m) => m.reviewId === reviewId && safeUrl(m.url)
      ),
    [state.media, reviewId]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadMedia(reviewId).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reviewId, loadMedia]);

  function submit() {
    if (!url.trim()) return;
    submitMedia(reviewId, kind, url, caption);
    setUrl('');
    setCaption('');
  }

  return (
    <div className='y-media-gallery'>
      {loading && !items.length ? (
        <p className='y-note'>正在加载素材…</p>
      ) : null}

      {items.length ? (
        <div className='y-media-grid'>
          {items.map((m: ReviewMedia) => (
            <figure className='y-media-item' key={m.id}>
              {m.kind === 'image' ? (
                broken[m.id] ? (
                  <a
                    className='y-media-fallback'
                    href={m.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    图片无法加载，打开原链接 ↗
                  </a>
                ) : (
                  <a
                    className='y-media-img-link'
                    href={m.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <img
                      src={m.url}
                      alt={m.caption || '复盘素材'}
                      loading='lazy'
                      decoding='async'
                      referrerPolicy='no-referrer'
                      onError={() =>
                        setBroken((b) => ({ ...b, [m.id]: true }))
                      }
                    />
                  </a>
                )
              ) : (
                <audio
                  className='y-media-audio'
                  controls
                  preload='none'
                  src={m.url}
                />
              )}
              <figcaption>
                <span>{m.caption || (m.kind === 'image' ? '图片素材' : '语音素材')}</span>
                <span className='y-media-actions'>
                  <a
                    href={m.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    打开 ↗
                  </a>
                  {m.ownerKey === ownerKey ? (
                    <button type='button' onClick={() => removeMedia(m.id)}>
                      删除
                    </button>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : !loading ? (
        <Empty>
          还没有素材。可以贴一张公开图片或一段语音链接，补一句说明。
        </Empty>
      ) : null}

      <div className='y-media-form'>
        <div className='y-row'>
          <label>
            类型
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value === 'audio' ? 'audio' : 'image')
              }
            >
              <option value='image'>图片</option>
              <option value='audio'>语音</option>
            </select>
          </label>
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder='https://...（公开图片或语音地址）'
          maxLength={500}
          inputMode='url'
        />
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder='一句说明：这张图 / 这段语音记录了什么'
          maxLength={300}
        />
        <div className='y-row'>
          <button
            type='button'
            className='y-btn y-btn-s'
            disabled={!url.trim()}
            onClick={submit}
          >
            添加素材
          </button>
          <span className='y-chip'>平台不存文件 · 仅公开链接</span>
        </div>
        <p className='y-note'>
          只接受 http(s) 链接；不保证链接长期有效。含个人信息的地址请不要贴上来。
        </p>
      </div>
    </div>
  );
}

/** 折叠入口：展开时才挂载素材层 */
export function ReviewMediaPanel({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className='y-media'
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>素材</summary>
      {open ? <MediaGallery reviewId={reviewId} /> : null}
    </details>
  );
}
