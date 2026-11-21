import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/**
 * 页面级滚动状态：用于顶部阅读进度与吸顶导航的收缩形态。
 * 进度条直接写 DOM 宽度，避免滚动时每帧重渲染整棵树；
 * 只有跨越吸顶阈值时才更新一次 React 状态。
 */
export function useScrollChrome() {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastScrolled = false;

    const read = () => {
      raf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const rest =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = rest > 40 ? Math.min(100, Math.max(0, (y / rest) * 100)) : 0;
      if (progressRef.current) progressRef.current.style.width = `${p}%`;
      const next = y > 10;
      if (next !== lastScrolled) {
        lastScrolled = next;
        setScrolled(next);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { scrolled, progressRef };
}

const REVEAL_SELECTOR = [
  '#yutu2 .y-lead',
  '#yutu2 .y-zone',
  '#yutu2 .y-insight',
  '#yutu2 .y-card',
  '#yutu2 .y-loop-done',
  '#yutu2 .y-loop-current',
  '#yutu2 .y-growth-delta',
].join(',');

/**
 * 全局「高级感」交互层，全部是可关闭的渐进增强：
 * 1. 滚动显现（IntersectionObserver）
 * 2. 卡片指针聚光（rAF 节流）
 * 3. 按钮指针涟漪
 *
 * 遵循 prefers-reduced-motion；不支持 IntersectionObserver 时直接不启用，
 * 不会让任何内容因动效而不可见。
 */
export function usePremiumMotion() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      root.classList.remove('y-motion-ready');
      return;
    }
    root.classList.add('y-motion-ready');

    /* ---------------- 滚动显现 ---------------- */
    const seen = new WeakSet<Element>();
    const reveal = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        visible.forEach((entry, i) => {
          const el = entry.target as HTMLElement;
          /* 同批出现的内容错开 60ms，最多延后 240ms；之后统一进入 */
          el.style.setProperty(
            '--reveal-delay',
            `${Math.min(i, 4) * 60}ms`
          );
          el.classList.add('y-in');
          reveal.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.06 }
    );

    const scan = () => {
      document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        reveal.observe(el);
      });
    };
    scan();

    // 步骤懒加载、列表增删都会产生新节点，做一次防抖重扫
    let scanTimer = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(scan, 130);
    });
    const shell = document.getElementById('yutu2');
    if (shell) mo.observe(shell, { childList: true, subtree: true });

    // 兜底：1.5s 后把首屏内仍未显现的内容直接显示（观察器异常时也不至于空白）
    const fallback = window.setTimeout(() => {
      document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('y-in');
      });
    }, 1500);

    /* ---------------- 按钮涟漪 ---------------- */
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const btn = target?.closest?.('#yutu2 .y-btn');
      if (!(btn instanceof HTMLElement)) return;
      if (btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') {
        return;
      }
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.7;
      const span = document.createElement('span');
      span.className = 'y-ripple';
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${e.clientX - r.left - size / 2}px`;
      span.style.top = `${e.clientY - r.top - size / 2}px`;
      btn.appendChild(span);
      window.setTimeout(() => span.remove(), 640);
    };

    document.addEventListener('pointerdown', onDown, { passive: true });

    return () => {
      root.classList.remove('y-motion-ready');
      reveal.disconnect();
      mo.disconnect();
      window.clearTimeout(scanTimer);
      window.clearTimeout(fallback);
      document.removeEventListener('pointerdown', onDown);
    };
  }, []);
}

/**
 * 全屏聚焦模式：锁定页面滚动、支持 Esc 退出，退出时恢复原滚动状态。
 * 传稳定的 state setter，避免 effect 每次渲染都重挂载。
 */
export function useImmersive(
  active: boolean,
  setActive: Dispatch<SetStateAction<boolean>>
) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const savedY = window.scrollY || 0;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener('keydown', onKey);
      /* 聚焦时面板脱离文档流会让页面高度变化，退出后恢复原滚动位置；
         若组件是直接卸载（例如点了「看代价」切视图），则交给新视图自己定位。 */
      if (alive.current) {
        requestAnimationFrame(() =>
          window.scrollTo({ top: savedY, behavior: 'auto' })
        );
      }
    };
  }, [active, setActive]);
}

/**
 * 「灵动场」：桌面精细指针下的环境光跟随、卡片聚光与整页滚动视差。
 *
 * 只写 CSS 变量，不触发 React 重渲染；触屏、无指针设备与
 * prefers-reduced-motion 下完全跳过，保证不增加移动端开销。
 */
export function useKineticField() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const page = document.querySelector('.y-page');
    const shell = document.getElementById('yutu2');
    if (!(page instanceof HTMLElement) || !shell) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;
    if (reduce) return;

    /* ---------------- 滚动视差：环境网格随页面缓慢下沉 ---------------- */
    let lastX = -1;
    let lastY = -1;
    const writeAura = () => {
      if (lastX < 0) return;
      const r = shell.getBoundingClientRect();
      page.style.setProperty('--y-cur-vx', `${lastX}px`);
      page.style.setProperty('--y-cur-vy', `${lastY}px`);
      page.style.setProperty('--y-cur-sx', `${lastX - r.left}px`);
      page.style.setProperty('--y-cur-sy', `${lastY - r.top}px`);
    };

    let scrollRaf = 0;
    const readScroll = () => {
      scrollRaf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      page.style.setProperty('--y-scroll', String(Math.min(y, 1600)));
      writeAura();
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(readScroll);
    };
    readScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!fine) {
      return () => {
        window.removeEventListener('scroll', onScroll);
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
      };
    }

    page.classList.add('y-fine-pointer');

    /* ---------------- 环境光跟随指针 ---------------- */
    let auraRaf = 0;
    const onPointerMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (auraRaf) return;
      auraRaf = requestAnimationFrame(() => {
        auraRaf = 0;
        writeAura();
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    /* ---------------- 卡片聚光 / 3D 轻倾斜 / 主按钮磁吸 ---------------- */
    let cardRaf = 0;
    let hoverCard: HTMLElement | null = null;
    let hoverTilt: HTMLElement | null = null;
    let hoverBtn: HTMLElement | null = null;
    let tiltCard: HTMLElement | null = null;
    let magBtn: HTMLElement | null = null;

    const applyHoverTargets = () => {
      cardRaf = 0;

      if (hoverCard) {
        const r = hoverCard.getBoundingClientRect();
        hoverCard.style.setProperty(
          '--mx',
          `${((lastX - r.left) / Math.max(1, r.width)) * 100}%`
        );
        hoverCard.style.setProperty(
          '--my',
          `${((lastY - r.top) / Math.max(1, r.height)) * 100}%`
        );
      }

      if (tiltCard && tiltCard !== hoverTilt) {
        tiltCard.style.setProperty('--tilt-y', '0deg');
        tiltCard = null;
      }
      if (hoverTilt) {
        const r = hoverTilt.getBoundingClientRect();
        const dx = ((lastX - r.left) / Math.max(1, r.width) - 0.5) * 2;
        hoverTilt.style.setProperty(
          '--tilt-y',
          `${(dx * 1.4).toFixed(2)}deg`
        );
        tiltCard = hoverTilt;
      }

      if (magBtn && magBtn !== hoverBtn) {
        magBtn.style.setProperty('--mag-x', '0px');
        magBtn.style.setProperty('--mag-y', '0px');
        magBtn = null;
      }
      if (hoverBtn) {
        const r = hoverBtn.getBoundingClientRect();
        const dx =
          (lastX - (r.left + r.width / 2)) / Math.max(1, r.width / 2);
        const dy =
          (lastY - (r.top + r.height / 2)) / Math.max(1, r.height / 2);
        hoverBtn.style.setProperty('--mag-x', `${(dx * 3.2).toFixed(1)}px`);
        hoverBtn.style.setProperty('--mag-y', `${(dy * 2.2).toFixed(1)}px`);
        magBtn = hoverBtn;
      }
    };

    const onShellMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      const target = e.target as Element | null;

      const cardEl = target?.closest?.(
        '#yutu2 .y-card, #yutu2 .y-insight, #yutu2 .y-loop-current'
      );
      hoverCard = cardEl instanceof HTMLElement ? cardEl : null;

      const focusEl = target?.closest?.('#yutu2 .y-focus-card');
      hoverTilt =
        focusEl instanceof HTMLElement &&
        !focusEl.classList.contains('y-campaign-card') &&
        !focusEl.classList.contains('y-globe-panel')
          ? focusEl
          : null;

      const btnEl = target?.closest?.('#yutu2 .y-btn-main');
      hoverBtn =
        btnEl instanceof HTMLElement &&
        !btnEl.hasAttribute('disabled') &&
        btnEl.getAttribute('aria-disabled') !== 'true'
          ? btnEl
          : null;

      if (!cardRaf) cardRaf = requestAnimationFrame(applyHoverTargets);
    };

    const onShellLeave = () => {
      hoverCard = null;
      hoverTilt = null;
      hoverBtn = null;
      if (!cardRaf) cardRaf = requestAnimationFrame(applyHoverTargets);
    };

    shell.addEventListener('pointermove', onShellMove, { passive: true });
    shell.addEventListener('pointerleave', onShellLeave);

    return () => {
      page.classList.remove('y-fine-pointer');
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      shell.removeEventListener('pointermove', onShellMove);
      shell.removeEventListener('pointerleave', onShellLeave);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      if (auraRaf) cancelAnimationFrame(auraRaf);
      if (cardRaf) cancelAnimationFrame(cardRaf);
    };
  }, []);
}
