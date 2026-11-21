import {
  KIND_LABEL,
  PROVENANCE,
  type ProvenanceEntry,
  type ProvenanceKey,
} from '@/data/provenance';

/**
 * 数据来源小标签：真实 / 自填 / 规则 / 近似 / 启发式 / 示例。
 * 标题里带完整口径；详细说明集中在「数据来源与口径」面板。
 */
export default function DataSourceBadge({
  source,
  showLabel = true,
  className = '',
}: {
  source: ProvenanceKey;
  showLabel?: boolean;
  className?: string;
}) {
  const entry: ProvenanceEntry = PROVENANCE[source];
  const title = `${entry.label} · ${entry.detail}${
    entry.meta ? `（${entry.meta}）` : ''
  }`;
  return (
    <span
      className={`y-prov y-prov-${entry.kind}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
    >
      <b>{KIND_LABEL[entry.kind]}</b>
      {showLabel ? <span>{entry.label}</span> : null}
    </span>
  );
}
