import { useState } from 'react';
import {
  KIND_DESC,
  KIND_LABEL,
  PROVENANCE,
  PROVENANCE_ORDER,
  type ProvenanceEntry,
  type ProvenanceKey,
} from '@/data/provenance';
import {
  AUDIT_COUNTS,
  AUDIT_ITEMS,
  AUDIT_STATUS,
  type AuditPage,
  type AuditStatus,
} from '@/data/evidence-audit';

const PAGE_ORDER: AuditPage[] = ['全局', '第 1 步', '第 2 步', '第 3 步', '第 4 步', '沙盘'];
const STATUS_ORDER: AuditStatus[] = ['unfounded', 'partial', 'grounded'];

/**
 * 数据来源与口径面板：
 * - 「按来源」：把数据按 REAL / SELF / CURATED / APPROX / HEURISTIC 分组；
 * - 「按图表」：逐个说明界面上的图表/数字从哪来、够不够硬、缺什么。
 */
export default function DataSourcesPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const entries = Object.entries(PROVENANCE) as [ProvenanceKey, ProvenanceEntry][];
  const [tab, setTab] = useState<'source' | 'chart'>('source');
  const [onlyGaps, setOnlyGaps] = useState(false);

  const auditItems = onlyGaps
    ? AUDIT_ITEMS.filter((i) => i.status !== 'grounded')
    : AUDIT_ITEMS;

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

      <div className='y-audit-tabs' role='tablist' aria-label='查看方式'>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'source'}
          className={tab === 'source' ? 'is-on' : ''}
          onClick={() => setTab('source')}
        >
          按来源
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'chart'}
          className={tab === 'chart' ? 'is-on' : ''}
          onClick={() => setTab('chart')}
        >
          按图表看依据
          {AUDIT_COUNTS.unfounded + AUDIT_COUNTS.partial ? (
            <em>{AUDIT_COUNTS.unfounded + AUDIT_COUNTS.partial}</em>
          ) : null}
        </button>
      </div>

      {tab === 'source' ? (
        <>
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
            成长河、档案墙与经验星云只基于平台归档与复盘记录。
          </p>
        </>
      ) : (
        <>
          <div className='y-audit-summary'>
            {STATUS_ORDER.map((s) => {
              const meta = AUDIT_STATUS[s];
              return (
                <span key={s} className={`is-${meta.tone}`}>
                  <b>{AUDIT_COUNTS[s]}</b>
                  {meta.label}
                </span>
              );
            })}
            <button
              type='button'
              className={`y-audit-filter${onlyGaps ? ' is-on' : ''}`}
              aria-pressed={onlyGaps}
              onClick={() => setOnlyGaps((v) => !v)}
            >
              {onlyGaps ? '显示全部' : '只看不足'}
            </button>
          </div>

          <p className='y-audit-note'>
            「有依据」= 可核对或来自你的真实记录；「部分依据」= 近似 / 规则 / 自评映射；
            「无外部依据」= 规则假设或未校准模型，不能当调研结论。
          </p>

          {PAGE_ORDER.map((page) => {
            const group = auditItems.filter((i) => i.page === page);
            if (!group.length) return null;
            return (
              <section key={page} className='y-audit-group'>
                <h4>{page}</h4>
                <div className='y-audit-list'>
                  {group.map((item) => {
                    const meta = AUDIT_STATUS[item.status];
                    return (
                      <article
                        key={item.id}
                        className={`y-audit-item is-${item.status}`}
                      >
                        <div className='y-audit-head'>
                          <b>{item.name}</b>
                          <span className={`y-chip y-chip-${meta.tone}`}>
                            {meta.label}
                          </span>
                          <em>{KIND_LABEL[item.kind]}</em>
                          {item.intake ? (
                            <span className='y-audit-intake'>可在第 1 步补</span>
                          ) : null}
                        </div>
                        <p className='y-audit-where'>{item.where}</p>
                        <p className='y-audit-detail'>{item.detail}</p>
                        {item.gap ? (
                          <p className='y-audit-gap'>
                            <span>缺口</span>
                            {item.gap}
                          </p>
                        ) : null}
                        {item.fix ? (
                          <p className='y-audit-fix'>
                            <span>怎么补</span>
                            {item.fix}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <p className='y-data-foot'>
            「无外部依据」不是实现错误，而是必须如实标注的规则假设。
            路演或 PRD 中请把它称为“规则推演 / 启发式”，不要称为调研结论。
          </p>
        </>
      )}
    </div>
  );
}
