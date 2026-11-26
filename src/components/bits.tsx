import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 数字缓动：页面进入或值变化时从当前值滚到目标值 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('y-motion-off'));
    const from = currentRef.current;
    const to = Number.isFinite(value) ? value : 0;
    if (reduce) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const duration = 480;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <>
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}

/** 把正文里的 http(s) 链接保留为可点击链接 */
export function LinkedText({ text }: { text: string }) {
  const parts = text.split(
    /(https?:\/\/[^\s，。；、！？）】》」』]+)/g
  );
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target='_blank' rel='noopener noreferrer'>
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <ul className="y-kv">
      {rows.map(([k, v], i) => (
        <li key={`${k}-${i}`}>
          <b>{k}</b>
          <span>{v}</span>
        </li>
      ))}
    </ul>
  );
}

export function Chip({
  tone = '',
  children,
}: {
  tone?: 'c' | 'w' | 'r' | 'b' | 'plain' | '';
  children: ReactNode;
}) {
  const cls = tone && tone !== 'plain' ? `y-chip y-chip-${tone}` : 'y-chip';
  return <span className={cls}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="y-empty">{children}</div>;
}

export function Say({ children }: { children: ReactNode }) {
  return (
    <p className="y-say">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#fff" stroke="#1f6fb2" />
        <ellipse cx="9" cy="11" rx="1.7" ry="2" fill="#1f6fb2" />
        <ellipse cx="15" cy="11" rx="1.7" ry="2" fill="#1f6fb2" />
        <ellipse cx="12" cy="16" rx="2.2" ry="1.6" fill="none" stroke="#1f6fb2" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** 域途品牌标识：墨绿 G + 橙色内弧 + 金色四角星 */
export function BrandLogo() {
  return (
    <svg className="y-logo" viewBox="6 4 54 54" role="img" aria-label="域途标识">
      <rect
        x="29"
        y="24"
        width="19"
        height="20"
        rx="7"
        fill="none"
        stroke="#e6dcc4"
        strokeWidth="2.2"
      />
      <path
        d="M46 17.5A20 20 0 1 0 51.5 36"
        fill="none"
        stroke="#0e5b4c"
        strokeWidth="8.6"
        strokeLinecap="round"
      />
      <path
        d="M25.5 24c-5 7-4 16 3.5 19.5 6 2.5 12-.5 12-7.5h9.5l-5 7.5"
        fill="none"
        stroke="#f5a03b"
        strokeWidth="6.4"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
      <path
        d="M51 5c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8Z"
        fill="#f7c34c"
      />
    </svg>
  );
}

export function Mascot() {
  return (
    <svg className="y-mascot" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#e7f0f8" stroke="#c6dcee" />
      <path
        d="M11 19c0-6 6-10 13-10s13 4 13 10c0 3-1 5-2 7 1 3 1 7-1 10-3 4-17 4-20 0-2-3-2-7-1-10-1-2-2-4-2-7z"
        fill="#fffefb"
        stroke="#8d887e"
        strokeWidth="1.2"
      />
      <path
        d="M11.5 16.5 8 10.5l7 1.8zM36.5 16.5 40 10.5l-7 1.8z"
        fill="#cfc8bb"
        stroke="#8d887e"
        strokeWidth="1.1"
      />
      <ellipse cx="18.5" cy="23" rx="3.5" ry="3.9" fill="#23221f" />
      <ellipse cx="29.5" cy="23" rx="3.5" ry="3.9" fill="#23221f" />
      <circle cx="19.6" cy="21.8" r="1.2" fill="#fffefb" />
      <circle cx="30.6" cy="21.8" r="1.2" fill="#fffefb" />
      <ellipse cx="24" cy="30.5" rx="3.6" ry="2.6" fill="#f1eee7" stroke="#8d887e" strokeWidth="1" />
    </svg>
  );
}

export function SourceCard({
  title,
  kind,
  gist,
  url,
}: {
  title: string;
  kind?: string;
  gist?: string;
  url: string;
}) {
  const tone =
    kind === '亲历记述' || kind === '文章'
      ? 'c'
      : kind === '行业观察' || kind === '回答'
        ? 'b'
        : kind
          ? 'w'
          : 'plain';
  return (
    <div className="y-src y-src-compact">
      <a
        className="y-src-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
      >
        <span className="y-src-t">{title}</span>
        <span className="y-src-open">
          原文 <i aria-hidden="true">↗</i>
        </span>
      </a>
      {kind ? (
        <div className="y-src-meta">
          <Chip tone={tone as 'c' | 'b' | 'w'}>{kind}</Chip>
        </div>
      ) : null}
      {gist ? (
        <details className="y-src-more">
          <summary>摘要</summary>
          <p>{gist}</p>
        </details>
      ) : null}
    </div>
  );
}

export function LiveCard({
  title,
  type,
  author,
  excerpt,
  votes,
  url,
}: {
  title: string;
  type: string;
  author?: string;
  excerpt?: string;
  votes?: number;
  url: string;
}) {
  return (
    <div className="y-src y-live y-src-compact">
      <a
        className="y-src-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
      >
        <span className="y-src-t">{title}</span>
        <span className="y-src-open">
          原文 <i aria-hidden="true">↗</i>
        </span>
      </a>
      <div className="y-src-meta">
        <Chip tone={type === '文章' ? 'c' : 'b'}>{type}</Chip>
        {author ? <span className="y-live-author">{author}</span> : null}
        {typeof votes === 'number' && votes > 0 ? (
          <span className="y-live-votes">{votes} 赞</span>
        ) : null}
      </div>
      {excerpt ? (
        <details className="y-src-more">
          <summary>摘要</summary>
          <p>{excerpt}</p>
        </details>
      ) : null}
    </div>
  );
}
