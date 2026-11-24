import { SNAPSHOT_AT } from './snapshot-meta';

/**
 * 数据来源登记表：界面与文档共用。
 * 任何展示给用户的数字/结论都必须能在这里找到口径；
 * 真实、自填、规则、近似、启发式分开登记，不混用。
 */
export type ProvenanceKind =
  | 'real'
  | 'self'
  | 'curated'
  | 'approx'
  | 'heuristic';

export interface ProvenanceEntry {
  label: string;
  kind: ProvenanceKind;
  detail: string;
  meta?: string;
}

export const KIND_LABEL: Record<ProvenanceKind, string> = {
  real: 'REAL',
  self: 'SELF',
  curated: 'CURATED',
  approx: 'APPROX',
  heuristic: 'HEURISTIC',
};

export const KIND_DESC: Record<ProvenanceKind, string> = {
  real: '有外部来源，可核对',
  self: '由你自己产生/填写',
  curated: '工程规则整理，不是外部样本',
  approx: '近似示意值，不是权威统计',
  heuristic: '启发式模型，尚未校准',
};

export const PROVENANCE = {
  zhihu: {
    label: '知乎内容快照',
    kind: 'real',
    detail:
      '由官方 zhihu-cli 一次性检索取得，保留原文链接；不是运行时实时检索。',
    meta: `快照时间 ${SNAPSHOT_AT}`,
  },
  nebula: {
    label: '背景：NGC 7023 鸢尾花星云',
    kind: 'real',
    detail:
      'NOIRLab 公开图像 noao-ngc7023；T.A. Rector/University of Alaska Anchorage、H. Schweiker/WIYN、NOIRLab/NSF/AURA。',
    meta: 'https://noirlab.edu/public/images/noao-ngc7023/',
  },
  zhihuCases: {
    label: '知乎案例/讨论',
    kind: 'real',
    detail: '案例、城市讨论与区域证据均来自同一份知乎快照，正文链接可自行核对。',
  },
  city: {
    label: '城市属性',
    kind: 'approx',
    detail:
      '岗位密度、生活成本、城市分级与经纬度为近似示意值，不是权威统计，也不用于地理测量。',
  },
  directions: {
    label: '方向与前置条件',
    kind: 'curated',
    detail:
      '方向清单、前置条件、代价与张力来自工程规则整理，不来自外部样本；可行性只表示条件是否就位。',
  },
  resources: {
    label: '一次性资源',
    kind: 'curated',
    detail:
      '“什么消耗什么 / 何时失效”来自检索规则的整理；存量只按高/中/低档位展示，按处境推导，属于近似。',
  },
  assessment: {
    label: '结构化测量',
    kind: 'self',
    detail:
      '由你填写的事实与行为频率计算，属于自评；不是临床量表，不做诊断或预测。',
  },
  similarity: {
    label: '归属相似度/稳定度',
    kind: 'heuristic',
    detail:
      '七维带权相似度与稳定度是启发式模型；参数尚未用外部样本校准，1 分变化可能切换归属。',
  },
  stage: {
    label: '阶段判定',
    kind: 'heuristic',
    detail: '由自评测量与年龄区间推导，是起点不是标签，不用于预测结果。',
  },
  nodes: {
    label: '环境原型与归属域',
    kind: 'curated',
    detail:
      '环境原型、域名称与参考任务为工程整理的示意结构，不是真实岗位样本；归属只表示七维方向接近，不预测结果。',
  },
  referenceTasks: {
    label: '参考体验任务',
    kind: 'curated',
    detail:
      '每个域下的参考任务用于提供体验起点，来自工程整理，不代表真实岗位的完整工作内容；可以改写、搁置或放弃。',
  },
  profile: {
    label: '个人档案',
    kind: 'self',
    detail: '你在本页填写的城市、年龄与七维处境，写入平台数据表或本机缓存。',
  },
  tasks: {
    label: '体验任务',
    kind: 'self',
    detail: '你领取或自定义的体验任务，写入平台数据表或本机缓存。',
  },
  archive: {
    label: '阶段性胜利',
    kind: 'self',
    detail: '你完成的体验、自省与归档记录；成长河与档案墙都只基于这些记录。',
  },
  reviews: {
    label: '同伴复盘',
    kind: 'real',
    detail:
      '其他用户提交到平台的公开复盘；满 3 个有效标记进入公共节点，自己的复盘不参与自己的归属。',
  },
  marks: {
    label: '有效标记',
    kind: 'real',
    detail: '不同用户对复盘的“有用”标记，按 review_id 聚合计数。',
  },
  geo: {
    label: '地图与轮廓',
    kind: 'approx',
    detail:
      'OSM 底图 + Natural Earth 陆地 + 近似城市坐标/山系示意；城市坐标经过人工微调，不用于地理测量。',
  },
} as const;

export type ProvenanceKey = keyof typeof PROVENANCE;

export const PROVENANCE_ORDER: ProvenanceKind[] = [
  'real',
  'self',
  'curated',
  'approx',
  'heuristic',
];
