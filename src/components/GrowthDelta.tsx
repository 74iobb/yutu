import { CHOICE_LABEL, DIMS } from '@/lib/model';
import { useYutu } from '@/store/YutuContext';

/**
 * 「成长 → 处境」回写条。
 * 把最近一次归档的选择与七维增量摊开，让用户看到成长不是一条记录，
 * 而是真实改写了第 1 步的处境；没有归档记录时不渲染。
 */
export default function GrowthDelta() {
  const { state, setStep } = useYutu();
  const last = state.lastArchive;
  const latest = state.victories[state.victories.length - 1];
  const before = last?.before ?? latest?.snap ?? null;
  const after = last?.after ?? (before ? state.profile.s : null);
  if (!before || !after) return null;

  const changes = DIMS.map((d) => ({
    k: d.k,
    n: d.n,
    unit: d.unit ?? '',
    delta: after[d.k] - before[d.k],
  })).filter((c) => c.delta !== 0);

  const no = last?.no ?? latest?.no;
  const choice = last?.choice ?? latest?.choice;

  return (
    <section
      className='y-growth-delta'
      aria-label='上次成长带来的处境变化'
    >
      <div className='y-gd-head'>
        <span className='y-gd-badge'>成长 → 处境</span>
        <strong>
          {last
            ? `第 ${no} 次成长改写了你的处境`
            : '自上次归档以来，你的处境有变化'}
        </strong>
        {choice ? <em>{CHOICE_LABEL[choice]}</em> : null}
      </div>
      <ul className='y-gd-dims'>
        {changes.length ? (
          changes.map((c) => (
            <li key={c.k} className={c.delta > 0 ? 'is-up' : 'is-down'}>
              <span>{c.n}</span>
              <b>
                {c.delta > 0 ? '+' : ''}
                {c.delta}
                {c.unit}
              </b>
            </li>
          ))
        ) : (
          <li className='is-flat'>
            <span>七维暂未变化</span>
            <b>回到闭环完成一次归档</b>
          </li>
        )}
      </ul>
      <div className='y-gd-foot'>
        <button
          type='button'
          className='y-btn y-btn-s'
          onClick={() => setStep(4)}
        >
          回到成长闭环
        </button>
      </div>
    </section>
  );
}
