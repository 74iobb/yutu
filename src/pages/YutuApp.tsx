import { lazy, Suspense } from 'react';
import { Shell } from '@/components/Shell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useKineticField, usePremiumMotion } from '@/lib/uiMotion';
import Step1 from '@/components/Step1';
const Step2 = lazy(() => import('@/components/Step2'));
const Step34 = lazy(() => import('@/components/Step34'));
const Step6 = lazy(() => import('@/components/Step6'));
import { useYutu, YutuProvider } from '@/store/YutuContext';

function Flow() {
  const { state } = useYutu();
  return (
    <Shell>
      <Suspense fallback={<div className="y-loading">正在加载内容…</div>}>
        {state.step === 1 ? <Step1 /> : null}
        {state.step === 2 ? <Step2 /> : null}
        {state.step === 3 ? <Step34 /> : null}
        {state.step === 4 ? <Step6 /> : null}
      </Suspense>
    </Shell>
  );
}

export default function YutuApp() {
  usePremiumMotion();
  useKineticField();

  return (
    <div className="y-page">
      <div className="y-ambient" aria-hidden="true">
        <i />
        <i />
        <i />
        <span className="y-ambient-grid" />
        <span className="y-ambient-aura" />
        <span className="y-ambient-noise" />
      </div>
      <ErrorBoundary>
        <YutuProvider>
          <Flow />
        </YutuProvider>
      </ErrorBoundary>
      <p className="y-page-foot">
        域途 · 体验式生涯陪伴系统 ｜ 数据来自知乎开放平台检索快照与平台数据表；示意数据已在界面标注。
      </p>
    </div>
  );
}
