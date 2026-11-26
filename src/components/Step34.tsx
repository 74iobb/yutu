import { useEffect, useMemo, useRef, useState } from 'react';
import { currentStage, stageDirections } from '@/lib/model';
import { consumeStep34View, type Step34View } from '@/lib/stepNav';
import { useYutu } from '@/store/YutuContext';
import Step3 from './Step3';
import Step4 from './Step4';
import StepSummary from './StepSummary';

/**
 * 第三步「方向与推演」。三个视图共享同一批方向、候选（shortlist）与选定方向（state.pick）：
 * - 方向清单：浏览全部方向、可行性、候选与案例
 * - 资源作战图：选中的方向重高亮，候选方向带描边标记，看代价、资源与张力
 * - 归属与摘要：收拢前两步的处境、本步方向、归属结论与一页纸摘要，直接对接成长闭环
 * 顶部候选条在三个视图都常驻，点候选会直接选中并切到作战图。
 */
export default function Step34() {
  const { state, setPick, toggleShortlist, clearShortlist } = useYutu();
  /* 进入本步永远先看方向清单；只有「回看落点」这类跨步跳转会一次性指定目标视图。 */
  const [view, setViewState] = useState<Step34View>(() => consumeStep34View());
  const setView = (v: Step34View) => {
    setViewState(v);
  };
  const topRef = useRef<HTMLDivElement>(null);

  const stage = currentStage(state.profile);
  const stageNames = useMemo(
    () => new Set(stageDirections(stage.id).map(d => d.name)),
    [stage.id]
  );
  /* 阶段切换后，旧候选可能已不属于当前阶段：仍然列出，但标记为不可定位 */
  const candidates = state.shortlist.filter(name => stageNames.has(name));
  const pickInStage = state.pick && stageNames.has(state.pick);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [view]);

  function openMap(dirName?: string) {
    if (dirName) setPick(dirName);
    setView('map');
  }

  return (
    <>
      <div className='y-subview' ref={topRef}>
        <div>
          <p className='y-eyebrow'>STEP 03 · 方向与推演</p>
        </div>
        <div className='y-mode' role='group' aria-label='方向与推演视图'>
          <button
            type='button'
            className={view === 'list' ? 'is-on' : ''}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            方向清单
          </button>
          <button
            type='button'
            className={view === 'map' ? 'is-on' : ''}
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
          >
            资源作战图
          </button>
          <button
            type='button'
            className={view === 'summary' ? 'is-on' : ''}
            aria-pressed={view === 'summary'}
            onClick={() => setView('summary')}
          >
            归属与摘要
          </button>
        </div>
      </div>

      <div
        className={`y-cand-dock${candidates.length ? ' has-items' : ''}`}
        aria-label='我的方向候选'
      >
        <div className='y-cand-dock-head'>
          <span className='y-eyebrow'>我的候选</span>
          <b>{candidates.length} / 4</b>
          {state.shortlist.length ? (
            <button
              type='button'
              className='y-cand-clear'
              onClick={clearShortlist}
            >
              清空候选
            </button>
          ) : null}
        </div>
        <div className='y-cand-dock-list'>
          {state.shortlist.map((name, i) => {
            const active = state.pick === name;
            const inStage = stageNames.has(name);
            return (
              <span
                className={`y-cand-chip${active ? ' is-picked' : ''}${
                  inStage ? '' : ' is-stale'
                }`}
                key={name}
              >
                <button
                  type='button'
                  className='y-cand-pick'
                  aria-pressed={active}
                  disabled={!inStage}
                  onClick={() => openMap(name)}
                  title={
                    !inStage
                      ? `「${name}」不属于当前阶段「${stage.name}」，无法在作战图定位`
                      : active
                        ? '已在作战图上选中'
                        : '在作战图上定位并选中'
                  }
                >
                  <i>{i + 1}</i>
                  <span>{name}</span>
                  <em>
                    {!inStage ? '不在本阶段' : active ? '已选定' : '定位'}
                  </em>
                </button>
                <button
                  type='button'
                  className='y-cand-remove'
                  aria-label={`把「${name}」移出候选`}
                  onClick={() => toggleShortlist(name)}
                >
                  ×
                </button>
              </span>
            );
          })}
          {pickInStage ? (
            <span className='y-cand-current' aria-live='polite'>
              当前已选定：<b>{state.pick}</b>
            </span>
          ) : null}
        </div>
      </div>

      {view === 'list' ? (
        <Step3
          onOpenMap={openMap}
          onOpenSummary={() => setView('summary')}
        />
      ) : view === 'map' ? (
        <Step4
          onOpenList={() => setView('list')}
          onOpenSummary={() => setView('summary')}
        />
      ) : (
        <StepSummary onOpenList={() => setView('list')} />
      )}
    </>
  );
}
