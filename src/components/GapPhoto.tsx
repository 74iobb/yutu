import { useEffect, useRef, useState } from 'react';
import city from '@/assets/scenery-city.jpg';
import cityMotion from '@/assets/scenery-city-motion.webp';
import field from '@/assets/scenery-field.jpg';
import fieldMotion from '@/assets/scenery-field-motion.webp';
import hills from '@/assets/scenery-hills.jpg';
import hillsMotion from '@/assets/scenery-hills-motion.webp';
import pack from '@/assets/scenery-pack.jpg';
import packMotion from '@/assets/scenery-pack-motion.webp';
import path from '@/assets/scenery-path.jpg';
import pathMotion from '@/assets/scenery-path-motion.webp';
import people from '@/assets/scenery-people.jpg';
import peopleMotion from '@/assets/scenery-people-motion.webp';
import plan from '@/assets/scenery-plan.jpg';
import planMotion from '@/assets/scenery-plan-motion.webp';
import ridge from '@/assets/scenery-ridge.jpg';
import ridgeMotion from '@/assets/scenery-ridge-motion.webp';
import sunrise from '@/assets/scenery-sunrise.jpg';
import sunriseMotion from '@/assets/scenery-sunrise-motion.webp';
import writing from '@/assets/scenery-writing.jpg';
import writingMotion from '@/assets/scenery-writing-motion.webp';

export type PhotoVariant =
  | 'hills'
  | 'sunrise'
  | 'city'
  | 'people'
  | 'path'
  | 'ridge'
  | 'pack'
  | 'plan'
  | 'field'
  | 'writing';

const SOURCES: Record<PhotoVariant, { poster: string; motion: string }> = {
  hills: { poster: hills, motion: hillsMotion },
  sunrise: { poster: sunrise, motion: sunriseMotion },
  city: { poster: city, motion: cityMotion },
  people: { poster: people, motion: peopleMotion },
  path: { poster: path, motion: pathMotion },
  ridge: { poster: ridge, motion: ridgeMotion },
  pack: { poster: pack, motion: packMotion },
  plan: { poster: plan, motion: planMotion },
  field: { poster: field, motion: fieldMotion },
  writing: { poster: writing, motion: writingMotion },
};

interface Props {
  variant?: PhotoVariant;
  quote?: string;
  /** 进入视口后自动播放动图；不传则保持「悬停 180ms 后播放」 */
  autoMotion?: boolean;
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return match;
}

/** 低于这个高度就不放图，避免只剩一条细边 */
const MIN_FILL = 64;

/**
 * 只填“真实剩余空隙”的照片：
 * 组件本身是 flex 列里的弹性占位（flex:1），用 ResizeObserver 测量自己拿到的
 * 剩余高度；不足 MIN_FILL 时完全不渲染图片，也就不会制造新的空隙。
 *
 * 动态图接入：桌面端（hover + 精细指针）进入视口约 600ms 后自动加载同源
 * 循环动图（WebP），离开视口即卸载；移动端与 prefers-reduced-motion 下
 * 保持静态图，避免无谓流量与晃动。替换 `src/assets/scenery-*` 即可换素材。
 */
export default function GapPhoto({
  variant = 'hills',
  quote,
  autoMotion = false,
}: Props) {
  const sources = SOURCES[variant];
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [height, setHeight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const filled = height >= MIN_FILL;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.height ?? 0;
      setHeight(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* 自动模式：进入视口才加载动图，离开视口卸载，避免多张图同时常驻播放 */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !autoMotion || !canHover || reduced) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: '120px', threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoMotion, canHover, reduced]);

  useEffect(() => {
    if (!filled || !canHover || reduced) {
      setActive(false);
      return;
    }
    const shouldPlay = autoMotion ? inView : hovered;
    if (!shouldPlay) {
      setActive(false);
      return;
    }
    const t = window.setTimeout(() => setActive(true), autoMotion ? 600 : 180);
    return () => window.clearTimeout(t);
  }, [filled, canHover, reduced, autoMotion, inView, hovered]);

  const hoverable = filled && !autoMotion;

  return (
    <div
      ref={boxRef}
      className={`y-gap-photo y-gap-photo--${variant}${filled ? ' is-on' : ''}`}
      aria-hidden={filled ? 'false' : 'true'}
      onPointerEnter={hoverable ? () => setHovered(true) : undefined}
      onPointerLeave={hoverable ? () => setHovered(false) : undefined}
    >
      {filled ? (
        <>
          <img
            className='y-gap-photo-poster'
            src={sources.poster}
            alt=''
            loading='lazy'
            decoding='async'
          />
          {active ? (
            <>
              <img
                className='y-gap-photo-motion'
                src={sources.motion}
                alt=''
                aria-hidden='true'
                decoding='async'
                onError={() => setActive(false)}
              />
              <span className='y-gap-photo-badge' aria-hidden='true'>
                动态
              </span>
            </>
          ) : null}
          <div className='y-gap-photo-copy'>
            {quote ? <span>{quote}</span> : null}
            <em>
              Photo ·{' '}
              <a
                href='https://unsplash.com'
                target='_blank'
                rel='noopener noreferrer'
              >
                Unsplash
              </a>
            </em>
          </div>
        </>
      ) : null}
    </div>
  );
}
