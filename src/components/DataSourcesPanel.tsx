import {
  KIND_DESC,
  KIND_LABEL,
  PROVENANCE,
  PROVENANCE_ORDER,
  type ProvenanceEntry,
  type ProvenanceKey,
} from '@/data/provenance';

/**
 * 数据来源与口径面板：把分散在各页的说明集中到一处。
 * 每组内部只列同一种数据性质，避免把真实/近似/示例混读。
 */
export default function DataSourcesPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const entries = Object.entries(PROVENANCE) as [ProvenanceKey, ProvenanceEntry][];

  return (
    <div
      className='y-data-panel'
      role='dialog'
      aria-modal='true'
      aria-label='数据来源与口径'
    >
      <div className='y-data-head'>
        <div>
          <p className='y-eyebrow'>数据来源与口径</p>
          <h3>真实、近似、规则与示例分开标注</h3>
        </div>
        <button
          type='button'
          className='y-data-close'
          aria-label='关闭数据来源面板'
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <p className='y-data-note'>
        本页只展示有明确来源的数据；示例不参与统计，近似值不用于对外陈述，
        模型参数尚未校准。界面中的小标签与此处一一对应。
      </p>

      {PROVENANCE_ORDER.map(kind => {
        const group = entries.filter(([, entry]) => entry.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className={`y-data-group is-${kind}`}>
            <h4>
              <span>{KIND_LABEL[kind]}</span>
              {KIND_DESC[kind]}
            </h4>
            <ul>
              {group.map(([key, entry]) => (
                <li key={key}>
                  <div className='y-data-item-head'>
                    <b>{entry.label}</b>
                    {entry.meta ? <em>{entry.meta}</em> : null}
                  </div>
                  <p>{entry.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className='y-data-foot'>
        需要更新知乎内容时，请运行 `scripts/refresh-zhihu-snapshot.py` 重新生成快照；
        同阶段归档选择由平台胜利档案实时聚合；成长河、档案墙只基于你自己的归档记录。
      </p>
    </div>
  );
}
