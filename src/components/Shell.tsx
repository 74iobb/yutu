import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { SNAPSHOT_AT } from '@/data/snapshot-meta';
import { CITY_MAP, currentStage, DIMS, norm } from '@/lib/model';
import { useImmersive, useScrollChrome } from '@/lib/uiMotion';
import { useYutu } from '@/store/YutuContext';
import { AnimatedNumber, BrandLogo } from './bits';
import Companion from './Companion';
import MascotVisual from './MascotVisual';
import DataSourcesPanel from './DataSourcesPanel';

const STEP_META = [
  { t: '填写信息', d: '城市、年龄与处境' },
  { t: '了解你所处的环境', d: '城市、区域与真实讨论' },
  { t: '方向与推演', d: '方向清单 · 作战图 · 归属摘要' },
  { t: '成长闭环', d: '体验 · 自省 · 档案 · 共建' },
];

/** 手势灵敏度：阈值越小越容易触发；轻扫按速度兜底 */
const SWIPE_TOUCH_PX = 20;
const SWIPE_MOUSE_PX = 28;
const SWIPE_WHEEL_PX = 12;
const SWIPE_RATIO = 1.0;
const DRAG_START_PX = 3;
const WHEEL_LOCK_MS = 240;
const FLICK_MIN_PX = 12;
const FLICK_VELOCITY = 0.55; // px/ms

export function Shell({ children }: { children: ReactNode }) {
  const { state, setStep, currentRank, resync, flash } = useYutu();
  const [syncOpen, setSyncOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  useImmersive(dataOpen, setDataOpen);
  /** 头部「更多」：把知乎快照 / 数据口径 / 电气实训收口 */
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  /** 长页面回到顶部 */
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setShowTop(window.scrollY > 520);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);
  /** 手动动效开关：跟随系统之外的第二层降级，适合低性能设备 */
  const [motionOff, setMotionOff] = useState(() => {
    try {
      return document.documentElement.classList.contains('y-motion-off');
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('y-motion-off', motionOff);
    try {
      window.localStorage.setItem('yutu.motionOff', motionOff ? '1' : '0');
    } catch {
      /* 本地存储不可用时只影响本次会话 */
    }
    window.dispatchEvent(
      new CustomEvent('yutu:motion', { detail: { off: motionOff } })
    );
  }, [motionOff]);
  const okCount = state.apiProbes.filter(p => p.ok).length;
  const syncTime = state.lastSyncAt
    ? new Date(state.lastSyncAt).toLocaleTimeString('zh-CN', { hour12: false })
    : '尚未同步';
  const stage = currentStage(state.profile);
  const city = CITY_MAP[state.profile.city];
  const top = currentRank()[0];
  const visibleCount = Math.min(STEP_META.length, Math.max(1, state.maxStep));
  const nextLocked = state.maxStep < STEP_META.length;
  const loopActive = state.tasks.filter((t) => !t.archived);
  const loopReady = loopActive.filter((t) => t.status === 'done').length;
  const loopRound = state.victories.length + 1;
  /** 数据上只有两段：真实处境（1–3 步）与成长（第 4 步） */
  const realm = state.step === 4 ? 'growth' : 'state';
  const growthUnlocked = state.maxStep >= 4;
  const lastStateStep = Math.min(3, Math.max(1, state.maxStep));
  const { scrolled, progressRef } = useScrollChrome();
  const [wipe, setWipe] = useState(0);
  /** 手势切步时的进入方向：左滑进入下一步、右滑回上一步 */
  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null);
  const slideRef = useRef(false);
  const slideTimer = useRef(0);
  const pageTurnId = useRef(0);

  /* 切步后回到顶部：吸顶导航会一直留在视口，内容从第一屏开始读 */
  const lastStep = useRef(state.step);
  useEffect(() => {
    if (lastStep.current === state.step) return;
    lastStep.current = state.step;
    const viaSlide = slideRef.current;
    /* 手势切步先回到顶部，让方向滑入完整可见；点击步骤条仍用平滑滚动 */
    window.scrollTo({ top: 0, behavior: viaSlide ? 'auto' : 'smooth' });
    /* 手势切步用方向滑入，不再叠加整页扫光 */
    if (!viaSlide) {
      setWipe(n => n + 1);
      setSlideDir(null);
    }
    slideRef.current = false;
  }, [state.step]);

  const navRef = useRef({ step: state.step, maxStep: state.maxStep });
  navRef.current = { step: state.step, maxStep: state.maxStep };

  const goRef = useRef<(delta: 1 | -1) => void>(() => {});
  goRef.current = (delta: 1 | -1) => {
    const target = Math.max(1, Math.min(state.maxStep, state.step + delta));
    if (target === state.step) {
      if (delta > 0 && state.step >= state.maxStep) {
        flash(
          state.step >= STEP_META.length
            ? '已经是最后一步。'
            : '完成本步后即可继续；也可以用顶部步骤条或方向键跳转。'
        );
      }
      return;
    }

    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const motionOff =
      document.documentElement.classList.contains('y-motion-off');
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => {
        finished: Promise<void>;
      };
    };

    /* 支持 View Transitions 时：整页像翻书一样翻转，新页在下面揭开 */
    if (!reduce && !motionOff && typeof doc.startViewTransition === 'function') {
      const root = document.documentElement;
      const cls = delta > 0 ? 'y-page-next' : 'y-page-prev';
      const turnId = ++pageTurnId.current;
      slideRef.current = true; // 交给翻页动画，不再叠加扫光 / 滑入
      root.classList.remove('y-page-next', 'y-page-prev');
      root.classList.add(cls);
      const cleanup = () => {
        if (pageTurnId.current !== turnId) return;
        root.classList.remove('y-page-next', 'y-page-prev');
      };
      try {
        const vt = doc.startViewTransition(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
          flushSync(() => setStep(target));
        });
        vt.finished.finally(cleanup);
        window.setTimeout(cleanup, 1600);
      } catch {
        cleanup();
        slideRef.current = false;
        setStep(target);
      }
      return;
    }

    /* 不支持 View Transitions：用方向滑入作为降级 */
    slideRef.current = true;
    setSlideDir(delta > 0 ? 'next' : 'prev');
    window.clearTimeout(slideTimer.current);
    slideTimer.current = window.setTimeout(() => setSlideDir(null), 680);
    setStep(target);
  };

  useEffect(() => {
    const shell = document.getElementById('yutu2');
    if (!shell) return;

    const SKIP = [
      'input',
      'textarea',
      'select',
      'button',
      'a',
      '[contenteditable="true"]',
      '.leaflet-container',
      '.leaflet-control',
      '.y-globe',
      '.y-globe-panel',
      '.y-campaign-card',
      '.y-steps',
      '.y-sub-rail',
      '.y-side-tabs',
      '.y-side',
      '.y-cands',
      '.y-cand-dock',
      '.y-measure-rail',
      '.y-neb-canvas',
      '.y-campaign-picks',
      '.y-loop-map',
      '.y-stage.is-focus',
      '.y-campaign-card.is-focus',
      '.y-loop-board-card.is-focus',
      '.y-wall-tab.is-focus',
      '.y-sky',
      '.y-neb',
    ].join(',');

    const hasOverlay = () =>
      Boolean(
        document.querySelector(
          '.y-sky, .y-neb, .y-focus-backdrop, [role="dialog"], [role="alertdialog"]'
        )
      );
    const shouldSkip = (target: Element | null) => {
      if (!target) return false;
      if (hasOverlay()) return true;
      return Boolean(target.closest(SKIP));
    };

    /* 拖动预览：页面跟随手指轻微抬起；松手后再交给翻页 / 回弹 */
    const dragAllowed = () =>
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      !document.documentElement.classList.contains('y-motion-off');
    const stageEl = () => shell.querySelector<HTMLElement>('.y-step-stage');
    const canGo = (delta: 1 | -1) => {
      const { step, maxStep } = navRef.current;
      const target = Math.max(1, Math.min(maxStep, step + delta));
      return target !== step;
    };
    const applyDrag = (dx: number) => {
      if (!dragAllowed()) return;
      const delta = dx < 0 ? 1 : -1;
      if (!canGo(delta)) return;
      const stage = stageEl();
      if (!stage) return;
      /* 1:1 跟手到 220px 后逐渐加阻力，最高约 300px；旋转同步放大 */
      const abs = Math.abs(dx);
      const eased = abs <= 220 ? abs : 220 + (abs - 220) * 0.35;
      const clamped = Math.sign(dx) * Math.min(300, eased);
      stage.classList.remove('is-page-rebound');
      stage.classList.add('is-page-dragging');
      stage.classList.toggle('is-drag-next', delta > 0);
      stage.classList.toggle('is-drag-prev', delta < 0);
      stage.style.setProperty('--drag-x', `${clamped.toFixed(1)}px`);
      stage.style.setProperty('--drag-r', `${(clamped * 0.07).toFixed(2)}deg`);
      /* 让旋转支点落在当前视口的书脊位置，而不是整页内容的几何中心 */
      const rect = stage.getBoundingClientRect();
      const originY = Math.max(
        0,
        Math.min(rect.height, window.innerHeight * 0.45 - rect.top)
      );
      stage.style.transformOrigin = `${
        delta > 0 ? 'left' : 'right'
      } ${originY.toFixed(0)}px`;
    };
    const clearDrag = (rebound: boolean) => {
      const stage = stageEl();
      if (!stage || !stage.classList.contains('is-page-dragging')) return;
      if (rebound) {
        stage.classList.add('is-page-rebound');
        requestAnimationFrame(() => {
          stage.classList.remove('is-page-dragging');
          stage.classList.remove('is-drag-next', 'is-drag-prev');
          stage.style.removeProperty('--drag-x');
          stage.style.removeProperty('--drag-r');
          stage.style.removeProperty('transform-origin');
        });
        window.setTimeout(
          () => stage.classList.remove('is-page-rebound'),
          640
        );
      } else {
        stage.classList.remove('is-page-dragging');
        stage.classList.remove('is-drag-next', 'is-drag-prev');
        stage.style.removeProperty('--drag-x');
        stage.style.removeProperty('--drag-r');
        stage.style.removeProperty('transform-origin');
        void stage.offsetWidth;
      }
    };

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;
    let touchTarget: Element | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = performance.now();
      touchTarget = e.target as Element | null;
      tracking = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
      if (shouldSkip(touchTarget)) return;
      applyDrag(dx);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking || !e.changedTouches.length) {
        tracking = false;
        clearDrag(true);
        return;
      }
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Math.max(1, performance.now() - startT);
      tracking = false;
      const horizontal =
        Math.abs(dx) >= Math.abs(dy) * SWIPE_RATIO;
      const longEnough = Math.abs(dx) >= SWIPE_TOUCH_PX;
      const flick =
        horizontal &&
        Math.abs(dx) >= FLICK_MIN_PX &&
        Math.abs(dx) / dt >= FLICK_VELOCITY;
      if (!horizontal || (!longEnough && !flick)) {
        clearDrag(true);
        return;
      }
      if (shouldSkip(touchTarget)) {
        clearDrag(true);
        return;
      }
      const delta = dx < 0 ? 1 : -1;
      if (!canGo(delta)) {
        clearDrag(true);
        goRef.current(delta);
        return;
      }
      /* 保留拖动姿态交给翻页，避免松手瞬间先弹回再翻 */
      goRef.current(delta);
    };
    const onTouchCancel = () => {
      tracking = false;
      clearDrag(true);
    };

    /* 桌面鼠标拖拽：只从非交互区域开始，避免抢走地图/输入框/按钮 */
    let mouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseStartT = 0;
    let mouseTarget: Element | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (shouldSkip(e.target as Element | null)) return;
      mouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseStartT = performance.now();
      mouseTarget = e.target as Element | null;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!mouseDown || e.pointerType !== 'mouse') return;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
      if (shouldSkip(mouseTarget)) return;
      applyDrag(dx);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!mouseDown || e.pointerType !== 'mouse') return;
      mouseDown = false;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      const dt = Math.max(1, performance.now() - mouseStartT);
      const horizontal = Math.abs(dx) >= Math.abs(dy) * SWIPE_RATIO;
      const longEnough = Math.abs(dx) >= SWIPE_MOUSE_PX;
      const flick =
        horizontal &&
        Math.abs(dx) >= FLICK_MIN_PX &&
        Math.abs(dx) / dt >= FLICK_VELOCITY;
      if (!horizontal || (!longEnough && !flick)) {
        clearDrag(true);
        return;
      }
      const selected = window.getSelection?.()?.toString();
      if (selected && selected.trim()) {
        clearDrag(true);
        return;
      }
      if (shouldSkip(mouseTarget)) {
        clearDrag(true);
        return;
      }
      const delta = dx < 0 ? 1 : -1;
      if (!canGo(delta)) {
        clearDrag(true);
        goRef.current(delta);
        return;
      }
      /* 保留拖动姿态交给翻页，避免松手瞬间先弹回再翻 */
      goRef.current(delta);
    };
    const onPointerCancel = () => {
      mouseDown = false;
      clearDrag(true);
    };

    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) < SWIPE_WHEEL_PX) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (shouldSkip(e.target as Element | null)) return;
      const now = Date.now();
      if (now < wheelLock) return;
      wheelLock = now + WHEEL_LOCK_MS;
      goRef.current(e.deltaX > 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (hasOverlay()) return;
      const t = e.target as Element | null;
      if (
        t?.closest?.(
          'input, textarea, select, button, a, [contenteditable="true"], [role="tablist"], [role="group"], .leaflet-container, .y-globe, .y-campaign-card, .y-loop-map'
        )
      ) {
        return;
      }
      e.preventDefault();
      goRef.current(e.key === 'ArrowRight' ? 1 : -1);
    };

    shell.addEventListener('touchstart', onTouchStart, { passive: true });
    shell.addEventListener('touchmove', onTouchMove, { passive: true });
    shell.addEventListener('touchend', onTouchEnd, { passive: true });
    shell.addEventListener('touchcancel', onTouchCancel, { passive: true });
    shell.addEventListener('pointerdown', onPointerDown);
    shell.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    shell.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      shell.removeEventListener('touchstart', onTouchStart);
      shell.removeEventListener('touchmove', onTouchMove);
      shell.removeEventListener('touchend', onTouchEnd);
      shell.removeEventListener('touchcancel', onTouchCancel);
      shell.removeEventListener('pointerdown', onPointerDown);
      shell.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      shell.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(slideTimer.current);
    };
  }, []);

  return (
    <div id='yutu2'>
      <div className='y-app-aura' aria-hidden='true'>
        <i />
        <span className='y-mote y-mote-a' />
        <span className='y-mote y-mote-b' />
        <span className='y-mote y-mote-c' />
        <span className='y-mote y-mote-d' />
        <span className='y-mote y-mote-e' />
      </div>
      {wipe > 0 ? (
        <span className='y-step-wipe' key={wipe} aria-hidden='true' />
      ) : null}
      <div className={`y-chrome${scrolled ? ' is-scrolled' : ''}`}>
        <div className='y-read-progress' aria-hidden='true'>
          <i ref={progressRef} />
        </div>
      <div className='y-head'>
        <div className='y-brand'>
          <button
            type='button'
            className='y-brand-mark y-brand-mascot-btn'
            aria-label='与刘看山聊一聊'
            title='与刘看山聊一聊'
            onClick={() =>
              window.dispatchEvent(new CustomEvent('yutu:companion'))
            }
          >
            <BrandLogo />
            <span className='y-brand-mascot' aria-hidden='true'>
              <MascotVisual />
            </span>
            <i className='y-orbit y-orbit-a' aria-hidden='true' />
            <i className='y-orbit y-orbit-b' aria-hidden='true' />
          </button>
          <div>
            <h1 className='y-title'>域途</h1>
            <p className='y-slogan'>
              远方是方向，不是终点；计划是草稿，由你改写
            </p>
            <p className='y-sub'>
              <i>我的处境</i> 填写 → 了解环境 → 方向推演 → 归属
              <span className='y-sub-sep'>｜</span>
              <i>我的成长</i> 体验 → 自省 → 归档
            </p>
          </div>
        </div>
        <div className='y-head-side'>
          <div className='y-chip-row'>
            <span className='y-sync-wrap'>
              <button
                type='button'
                className={`y-chip y-sync-trigger ${state.backendOnline ? 'y-chip-c' : 'y-chip-w'}`}
                aria-expanded={syncOpen}
                aria-controls='y-sync-panel'
                onClick={() => setSyncOpen(v => !v)}
              >
                <i
                  className={`y-sync-dot${state.backendOnline ? ' is-on' : ''}`}
                />
                {state.backendOnline
                  ? `平台数据表 ${okCount}/${state.apiProbes.length || 8}`
                  : '本地存储模式'}
                <em className='y-sync-caret'>{syncOpen ? '▴' : '▾'}</em>
              </button>

              {syncOpen ? (
                <div
                  className='y-sync-panel'
                  id='y-sync-panel'
                  role='dialog'
                  aria-label='数据接入状态'
                >
                  <div className='y-sync-head'>
                    <strong>数据接入状态</strong>
                    <button
                      type='button'
                      className='y-sync-close'
                      aria-label='关闭'
                      onClick={() => setSyncOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                  <p className='y-sync-sub'>
                    每个读接口独立探测；写接口失败时，界面会自动退回本机缓存，不会丢内容。
                  </p>
                  <ul>
                    {state.apiProbes.length ? (
                      state.apiProbes.map(p => (
                        <li key={p.key}>
                          <i className={p.ok ? 'is-ok' : 'is-bad'} />
                          <span>{p.label}</span>
                          <em title={p.message || undefined}>
                            {p.ok ? '已连接' : p.message || '不可用'}
                          </em>
                        </li>
                      ))
                    ) : (
                      <li>
                        <i className='is-wait' />
                        <span>正在检查接口…</span>
                        <em>—</em>
                      </li>
                    )}
                  </ul>
                  <div className='y-sync-foot'>
                    <span>{syncTime}</span>
                    <button
                      type='button'
                      className='y-btn y-btn-s'
                      disabled={state.syncing}
                      onClick={resync}
                    >
                      {state.syncing ? '同步中…' : '重新同步'}
                    </button>
                  </div>
                  <p className='y-sync-note'>
                    记录按本机标识隔离；未连上平台时仍可继续填写，内容保存在浏览器本机。
                  </p>
                </div>
              ) : null}
            </span>

            {state.maxStep >= 4 || state.tasks.length || state.victories.length ? (
              <button
                type='button'
                className='y-chip y-chip-loop'
                onClick={() => setStep(4)}
                title='回到成长闭环，查看本轮进度'
              >
                闭环 第 {loopRound} 轮
                {loopReady
                  ? ` · 待归档 ${loopReady}`
                  : loopActive.length
                    ? ` · 进行中 ${loopActive.length}`
                    : ''}
              </button>
            ) : null}
            <button
              type='button'
              className={`y-chip y-motion-chip${motionOff ? ' is-off' : ''}`}
              aria-pressed={motionOff}
              onClick={() => setMotionOff(v => !v)}
              title={
                motionOff
                  ? '动效已关闭；点此恢复'
                  : '关闭全部过渡与动画，适合低性能设备'
              }
            >
              <i className='y-motion-dot' />
              动效 {motionOff ? '关' : '开'}
            </button>
            <span className='y-more-wrap' ref={moreRef}>
              <button
                type='button'
                className='y-chip y-more-trigger'
                aria-expanded={moreOpen}
                aria-controls='y-more-panel'
                onClick={() => setMoreOpen((v) => !v)}
                title='更多入口'
              >
                更多 <em className='y-more-caret'>{moreOpen ? '▴' : '▾'}</em>
              </button>
              {moreOpen ? (
                <div
                  className='y-more-panel'
                  id='y-more-panel'
                  role='dialog'
                  aria-label='更多入口'
                >
                  <button
                    type='button'
                    className='y-more-item'
                    onClick={() => {
                      setDataOpen(true);
                      setMoreOpen(false);
                    }}
                  >
                    <span>数据来源与口径</span>
                    <span aria-hidden='true'>↗</span>
                  </button>
                  <div className='y-more-info'>
                    <span>知乎快照</span>
                    <b>{SNAPSHOT_AT}</b>
                  </div>
                  <a
                    className='y-more-item'
                    href='#/electrical'
                    onClick={() => setMoreOpen(false)}
                  >
                    <span>电气实训</span>
                    <span aria-hidden='true'>→</span>
                  </a>
                </div>
              ) : null}
            </span>
            {state.inactive?.applied ? (
              <span className='y-chip y-chip-w'>
                已按 {state.inactive.days} 天未活跃小幅衰减
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className='y-realms' role='tablist' aria-label='两大板块'>
        <button
          type='button'
          role='tab'
          aria-selected={realm === 'state'}
          className={`y-realm${realm === 'state' ? ' is-on' : ''}`}
          onClick={() => {
            if (realm === 'state') return;
            setStep(lastStateStep);
          }}
        >
          <span className='y-realm-i'>01</span>
          <span className='y-realm-t'>
            <strong>我的处境</strong>
            <em>填写 · 环境 · 方向 · 归属摘要</em>
          </span>
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={realm === 'growth'}
          className={`y-realm${realm === 'growth' ? ' is-on' : ''}${
            growthUnlocked ? '' : ' is-locked'
          }`}
          onClick={() => {
            if (!growthUnlocked) {
              flash('先完成前面的处境步骤，成长闭环才会出现。');
              return;
            }
            setStep(4);
          }}
        >
          <span className='y-realm-i'>02</span>
          <span className='y-realm-t'>
            <strong>我的成长</strong>
            <em>体验 · 自省 · 档案 · 共建</em>
          </span>
          {state.victories.length ? (
            <span className='y-realm-badge'>{state.victories.length} 次胜利</span>
          ) : null}
        </button>
      </div>

      <div className='y-steps' role='tablist' aria-label='域途四步流程'>
        {STEP_META.slice(0, visibleCount).map((s, i) => {
          const n = i + 1;
          const on = state.step === n;
          const done = n < state.maxStep && !on;
          const disabled = n > state.maxStep;
          return (
            <button
              key={s.t}
              type='button'
              className={`y-step${done ? ' is-done' : ''}${
                n === STEP_META.length ? ' is-growth' : ''
              }`}
              role='tab'
              aria-current={on ? 'step' : undefined}
              aria-selected={on}
              aria-controls={`y-p${n}`}
              disabled={disabled}
              onClick={() => !disabled && setStep(n)}
            >
              <span className='y-step-t'>
                <i className='y-step-n'>{n}</i>
                {s.t}
                {n === STEP_META.length ? (
                  <span className='y-flag'>{state.victories.length}</span>
                ) : null}
              </span>
              <span className='y-step-d'>{s.d}</span>
            </button>
          );
        })}
      </div>

      <div className='y-step-progress' aria-label='步骤解锁进度'>
        <span>
          第 {state.step} / {STEP_META.length} 步
        </span>
        <i>
          <em
            style={{ width: `${(state.maxStep / STEP_META.length) * 100}%` }}
          />
        </i>
        <b>
          {state.step < state.maxStep
            ? `已解锁 ${state.maxStep} / ${STEP_META.length} · 可随时跳到已解锁步骤`
            : nextLocked
              ? `已解锁 ${state.maxStep} / ${STEP_META.length} · 完成本步后出现下一步`
              : '全部步骤已解锁 · 可随时前后跳转'}
        </b>
        <span className='y-swipe-hint y-swipe-hint-touch' aria-hidden='true'>
          ← 左右滑动切换 →
        </span>
        <span className='y-swipe-hint y-swipe-hint-fine' aria-hidden='true'>
          ← → 可切换
        </span>
      </div>

      </div>{/* /y-chrome */}

      <div className='y-glance' aria-label='当前进度概览'>
        <div className='y-glance-item'>
          <span>阶段</span>
          <b>{stage.name}</b>
        </div>
        <div className='y-glance-item'>
          <span>城市</span>
          <b>{city?.name ?? '—'}</b>
        </div>
        <div className='y-glance-item y-glance-field'>
          <span>方向</span>
          <b title={state.profile.field}>{state.profile.field || '未填写'}</b>
        </div>
        <div className='y-glance-item'>
          <span>归属域</span>
          <b>{top ? top.node.name.split(' · ')[0] : '—'}</b>
        </div>
        <div className='y-glance-item'>
          <span>阶段性胜利</span>
          <b>
            <AnimatedNumber value={state.victories.length} />
          </b>
        </div>
        <div className='y-glance-item'>
          <span>方向候选</span>
          <b>
            <AnimatedNumber value={state.shortlist.length} /> / 4
          </b>
        </div>
        <div className='y-fingerprint' aria-label='七维向量指纹'>
          {DIMS.map(d => {
            const ratio = Math.max(
              0.06,
              Math.min(1, norm(d.k, state.profile.s[d.k]) / 100)
            );
            return (
              <i
                key={d.k}
                style={{ height: `${Math.round(8 + ratio * 24)}px` }}
                title={`${d.n} ${state.profile.s[d.k]}${d.unit || ''}`}
              />
            );
          })}
        </div>
      </div>

      <div className='y-main'>
        <div
          className={`y-step-stage${
            slideDir ? ` y-slide-${slideDir}` : ''
          }`}
          key={state.step}
        >
          {children}
        </div>
      </div>
      {state.notice ? (
        <div className='y-toast' role='status' aria-live='polite'>
          {state.notice}
        </div>
      ) : null}
      {dataOpen ? (
        <>
          <button
            type='button'
            className='y-data-backdrop'
            aria-label='关闭数据来源面板'
            onClick={() => setDataOpen(false)}
          />
          <DataSourcesPanel onClose={() => setDataOpen(false)} />
        </>
      ) : null}
      <button
        type='button'
        className={`y-top-btn${showTop ? ' is-on' : ''}`}
        aria-label='回到顶部'
        title='回到顶部'
        onClick={() => {
          const reduce = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
          ).matches;
          window.scrollTo({
            top: 0,
            behavior: reduce ? 'auto' : 'smooth',
          });
        }}
      >
        ↑
      </button>
      <Companion />
    </div>
  );
}
