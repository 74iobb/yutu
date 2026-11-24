import { useMemo } from 'react';
import { retrieveMemories } from '@/lib/memory';
import { useYutu } from '@/store/YutuContext';
import { Empty } from './bits';

/**
 * 「系统记得你」：本地长期记忆面板。
 *
 * 只读取已有的归档向量与复盘向量，按七维相似度排序；
 * 不调用后端、不上传文字，也不做语义理解。
 */
export default function MemoryPanel() {
  const { state, ownerKey } = useYutu();
  const memories = useMemo(
    () =>
      retrieveMemories(
        state.profile.s,
        state.victories,
        state.reviews,
        ownerKey,
        4
      ),
    [state.profile.s, state.victories, state.reviews, ownerKey]
  );

  return (
    <section className='y-card y-memory-panel' aria-label='系统记得你'>
      <h3>
        系统记得你
        <span className='y-mini'>本机向量检索 · 不上传</span>
      </h3>
      <p className='y-note' style={{ paddingBottom: 8 }}>
        按七维相似度，从你的归档与复盘中找出最接近「现在」的记忆。越靠前，越像你此刻的处境。
      </p>

      {memories.length ? (
        <ul className='y-memory-list'>
          {memories.map((m) => {
            const pct = Math.round(m.sim * 100);
            return (
              <li key={m.id}>
                <div className='y-memory-meta'>
                  <span>
                    {m.kind === 'victory' ? `第 ${m.no} 次归档` : '你的复盘'}
                  </span>
                  <span>{m.when}</span>
                  <b>接近度 {pct}%</b>
                </div>
                <p>
                  {m.full.length > 120 ? `${m.full.slice(0, 120)}…` : m.full}
                </p>
                <div className='y-memory-bar' aria-hidden='true'>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>
          完成第一次归档、并写下几句自省后，这里会开始积累你的记忆。
        </Empty>
      )}

      <p className='y-note' style={{ paddingTop: 7 }}>
        相似度来自七维向量，不是语义模型；它只说明「当时的处境与现在有多接近」，不评价你选得对不对。
      </p>
    </section>
  );
}
