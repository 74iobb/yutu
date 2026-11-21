import { useEffect, useMemo, useRef, useState } from 'react';
import { currentStage, stageDirections } from '@/lib/model';
import { useYutu } from '@/store/YutuContext';
import Step3 from './Step3';
import Step4 from './Step4';

type View = 'list' | 'map';

/**
 * 第三步与第四步合并后的页面。
 * 两个视图共享同一批方向、候选（shortlist）与选定方向（state.pick）：
 * - 方向清单：浏览全部方向、可行性、候选与案例
 * - 资源作战图：选中的方向重高亮，候选方向带描边标记，看代价、资源与张力
 * 顶部的候选条在两个视图都常驻，点候选会直接选中并切到作战图。
 */
export default function Step34() {
  const { state, setPick, toggleShortlist, clearShortlist } = useYutu();
  const [view, setView] = useState<View>('list');
  const topRef = useRef<HTMLDivElement>(null);

  const stage = currentStage(state.profile);
  const stageNames = useMemo(
    () => new Set(stageDirections(stage.id).map(d => d.name)),
    [stage.id]
  );
  /* 阶段切换后，旧候选可能已不属于当前阶段：仍然列出，但标记为不可定位 */
  const candidates = state.shortlist.filter(name => stageNames.has(name));
  const staleCount = state.shortlist.length - candidates.length;
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
          <p className='y-eyebrow'>03 / 方向与推演</p>
          <p className='y-subview-note'>
            方向清单与资源作战图属于同一步：在清单里点「看代价」或顶部候选标签，都会选中该方向并切到图上重高亮；
            图内含本地近 / 中 / 外圈与全国网络两种视图。
          </p>
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
        </div>
      </div>

      <div
        className={`y-cand-dock${candidates.length ? ' has-items' : ''}`}
        aria-label='我的方向候选'
      >
        <div className='y-cand-dock-head'>
          <span className='y-eyebrow'>我的候选</span>
          <b>{candidates.length} / 4</b>
          <span className='y-cand-dock-note'>
            {candidates.length
              ? '点候选 → 在作战图上定位并选中；× 移出候选。'
              : '在方向清单点「＋ 加入候选」，最多 4 条；加入后会在作战图上带描边标记。'}
          </span>
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
          {!state.shortlist.length ? (
            <span className='y-cand-empty'>
              候选条会一直留在这里，切到作战图也不会消失。
            </span>
          ) : null}
          {staleCount ? (
            <span className='y-cand-empty'>
              {`其中 ${staleCount} 条不属于「${stage.name}」，保留序号但不参与定位；可点 × 移除或清空后重选。`}
            </span>
          ) : null}
          {pickInStage ? (
            <span className='y-cand-current' aria-live='polite'>
              当前已选定：<b>{state.pick}</b>
            </span>
          ) : null}
        </div>
      </div>

      {view === 'list' ? (
        <Step3 onOpenMap={openMap} />
      ) : (
        <Step4 onOpenList={() => setView('list')} />
      )}
    </>
  );
}
