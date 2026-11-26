import { useEffect, useMemo, useState } from 'react';
import { CHOICE_LABEL, currentStage } from '@/lib/model';
import { useYutu } from '@/store/YutuContext';
import type { Choice } from '@/types';
import { Empty } from './bits';

const CHOICES = Object.keys(CHOICE_LABEL) as Choice[];

function shortChoice(c: Choice) {
  return CHOICE_LABEL[c];
}

/**
 * 同阶段去向：
 * - 「自填样本」来自 peer_samples_*（用户主动填写下一步去向）
 * - 「已归档去向」来自 archive_choice_stats（真实归档记录）
 *
 * 两者都是匿名计数，不展示姓名、金额或具体公司。
 * 样本不足时只显示条数，不显示百分比，避免把 1 条样本说成“趋势”。
 */
export default function PeerSamples() {
  const { state, submitPeerSample } = useYutu();
  const stage = currentStage(state.profile);
  const my = state.peerMine.find((p) => p.stage === stage.id) ?? null;
  const [choice, setChoice] = useState<Choice>(my?.choice ?? 'keep');
  const [note, setNote] = useState(my?.note ?? '');

  useEffect(() => {
    setChoice(my?.choice ?? 'keep');
    setNote(my?.note ?? '');
  }, [my?.id, my?.choice, my?.note]);

  const peerStats = useMemo(
    () => state.peerStats.filter((s) => s.stage === stage.id),
    [state.peerStats, stage.id]
  );
  const choiceStats = useMemo(
    () => state.choiceStats.filter((s) => s.stage === stage.id),
    [state.choiceStats, stage.id]
  );

  /* 离线或平台无样本时，至少把本机这一条显示出来，并明确标注来源 */
  const offlineStats = useMemo(() => {
    if (peerStats.length) return [];
    if (!my) return [];
    return [{ stage: my.stage, choice: my.choice, count: 1 }];
  }, [peerStats, my]);

  const sampleRows = peerStats.length ? peerStats : offlineStats;
  const sampleTotal = sampleRows.reduce((n, r) => n + r.count, 0);
  const archiveTotal = choiceStats.reduce((n, r) => n + r.count, 0);

  const renderRows = (
    rows: { choice: Choice; count: number }[],
    total: number
  ) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <ul className='y-peer-bars'>
        {rows
          .slice()
          .sort((a, b) => b.count - a.count)
          .map((r) => (
            <li key={r.choice}>
              <span className='y-peer-bar-label'>{shortChoice(r.choice)}</span>
              <span className='y-peer-bar-track'>
                <i style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <b>
                {r.count}
                {total >= 5 ? (
                  <em>{Math.round((r.count / total) * 100)}%</em>
                ) : null}
              </b>
            </li>
          ))}
      </ul>
    );
  };

  return (
    <div className='y-card y-peer-samples'>
      <h3>
        同阶段的人后来去哪了
        <span className='y-mini'>匿名计数 · 不含姓名与金额</span>
      </h3>
      <p className='y-note' style={{ paddingBottom: 8 }}>
        当前阶段「{stage.name}」。自填样本来自用户主动填写；已归档去向来自真实归档记录。
        样本少于 5 条时只显示条数，不显示比例。
      </p>

      <div className='y-peer-samples-grid'>
        <div>
          <h4>
            自填去向样本
            <span className='y-mini'>
              {state.backendOnline ? '平台数据表' : '本机样本'}
            </span>
          </h4>
          {sampleRows.length ? (
            <>
              {renderRows(sampleRows, sampleTotal)}
              <p className='y-note'>{sampleTotal} 条样本</p>
            </>
          ) : (
            <Empty>
              这个阶段还没有人去向样本。你填第一条后，会和后来的人一起构成参照。
            </Empty>
          )}
        </div>

        <div>
          <h4>
            已归档去向
            <span className='y-mini'>来自阶段性胜利档案</span>
          </h4>
          {choiceStats.length ? (
            <>
              {renderRows(choiceStats, archiveTotal)}
              <p className='y-note'>{archiveTotal} 次归档</p>
            </>
          ) : (
            <Empty>
              这个阶段还没有已归档的去向记录。完成一次归档后，这里会出现真实选择。
            </Empty>
          )}
        </div>
      </div>

      <div className='y-peer-form'>
        <h4>{my ? '更新我的去向' : '填写我的去向'}</h4>
        <div className='y-opts'>
          {CHOICES.map((c) => (
            <label
              className={`y-opt-card${choice === c ? ' is-on' : ''}`}
              key={c}
            >
              <input
                type='radio'
                name='y-peer-choice'
                value={c}
                checked={choice === c}
                onChange={() => setChoice(c)}
              />
              <span>{CHOICE_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='一句话写清你下一步去了哪里，例如：留在南充做施工，边工作边准备造价证。'
          rows={2}
        />
        <div className='y-row' style={{ marginTop: 7 }}>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => submitPeerSample(choice, note)}
          >
            {my ? '更新去向样本' : '提交去向样本'}
          </button>
          {!state.backendOnline ? (
            <span className='y-chip'>离线时仅保存在本机</span>
          ) : null}
        </div>
        <p className='y-note' style={{ paddingTop: 5 }}>
          提交前会自动脱敏（金额 / 公司 / 联系方式）。这条样本只做匿名计数，不参与你自己的归属计算。
        </p>
      </div>
      {state.notice ? <p className='y-flash'>{state.notice}</p> : null}
    </div>
  );
}
