import type { Identity, StageId, Urban } from '@/data/catalog';

/** 七维向量（age 为原始岁数，其余 0–100） */
export interface Scores {
  place: number;
  econ: number;
  family: number;
  age: number;
  cycle: number;
  inertia: number;
  history: number;
}

export type DimensionKey = keyof Scores;

export interface Profile {
  city: string;
  urban: Urban;
  identity: Identity;
  field: string;
  s: Scores;
}

export type TaskStatus = 'doing' | 'done' | 'hold' | 'drop';

export interface TaskItem {
  /** 本地稳定 id；来自后端时使用 backend id */
  id: string;
  backendId?: string;
  title: string;
  type: string;
  status: TaskStatus;
  /** 经验出处原文 */
  origin: string;
  /** 节点任务 id / custom-xxx */
  sourceId: string;
  /** 来源节点 id 或 custom */
  nodeName: string;
  pre: string;
  risk: string;
  std: string;
  custom: boolean;
  archived: boolean;
}

export type Choice = 'keep' | 'revise' | 'rest' | 'switch';

export interface Victory {
  id: string;
  backendId?: string;
  no: number;
  at: string;
  snap: Scores;
  domain: string;
  sim: number;
  tasks: { id: string; title: string; type: string; sourceId?: string }[];
  choice: Choice;
  answers: { feel: string; ctx: string; vision: string };
}

/** 最近一次归档的结果，用于闭环动画与「本轮已完成」面板 */
export interface LoopArchive {
  /** 第几次阶段性胜利 */
  no: number;
  choice: Choice;
  /** 归档前向量 */
  before: Scores;
  /** 漂移后向量 */
  after: Scores;
  /** 漂移后最接近的域（归档完成卡直接展示） */
  domain?: string;
  /** 漂移后的综合相似度 */
  sim?: number;
  /** 归档时间戳（用于触发一次性动画） */
  at: number;
}

export interface Review {
  id: string;
  authorKey: string;
  authorName: string;
  stage: StageId;
  city: string;
  choice: Choice;
  content: string;
  vector: Scores | null;
  createdAt: string;
}

export interface PoolItem {
  /** 对应 victory id */
  vid: string;
  reviewId: string;
  no: number;
  choice: Choice;
  domain: string;
  own: boolean;
}

export interface TaskTemplate {
  id: string;
  type: string;
  title: string;
  src: string;
  pre: string;
  risk: string;
  std: string;
}

export interface PrototypeNode {
  id: string;
  name: string;
  hue: string;
  s: Scores;
  pains: string[];
  tasks: TaskTemplate[];
  /** 来自用户复盘升级的公共节点：对他人可见，不参与自己的归属计算 */
  own?: boolean;
}

export interface FeasibilityResult {
  level: 'high' | 'mid' | 'low';
  reasons: string[];
}

export interface AssetLevel {
  pct: number;
  label: string;
  tone: 'full' | 'part' | 'none';
  why: string;
}

/** 去向样本：用户按阶段自填「下一步去哪」，可按阶段做匿名聚合 */
export interface PeerSample {
  id: string;
  stage: StageId;
  city: string;
  choice: Choice;
  note: string;
  createdAt?: string;
}

/** 同阶段去向样本的匿名计数 */
export interface PeerStat {
  stage: string;
  choice: Choice;
  count: number;
}

/** 同阶段「阶段性胜利归档」的去向计数（来自真实归档记录） */
export interface ChoiceStat {
  stage: string;
  choice: Choice;
  count: number;
  latest?: string;
}

/** 复盘下的树状讨论；parentId 为 '0' 表示顶层 */
export interface Discussion {
  id: string;
  reviewId: string;
  parentId: string;
  authorKey: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/** 按复盘聚合的讨论热度 */
export interface DiscussionStat {
  reviewId: string;
  count: number;
  people: number;
}

/** 复盘素材：平台无文件存储，只保存公开图片/语音链接 */
export interface ReviewMedia {
  id: string;
  reviewId: string;
  ownerKey: string;
  kind: 'image' | 'audio';
  url: string;
  caption: string;
  createdAt: string;
}
