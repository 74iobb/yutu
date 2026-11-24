/**
 * 域途数据表 API 封装
 * 后端：平台「数据表 SQL 操作 API」，本质是工作流，前端调用路径
 * `POST /api/page/w/{token}`（同源，浏览器自带登录态）。
 *
 * token 一律从 .project.md 取，更新 SQL 后 token 可能变化，需同步此处。
 */
import type { StageId } from '@/data/catalog';
import type {
  Choice,
  ChoiceStat,
  Discussion,
  DiscussionStat,
  PeerSample,
  PeerStat,
  Profile,
  Review,
  Scores,
  TaskStatus,
  Victory,
} from '@/types';

const API_PATH_PREFIX = '/api/page/w';

const API_ENDPOINTS = {
  profileGet: '17950923415269587',
  profileSave: '17950923415269588',
  tasksList: '17950924105269589',
  tasksAdd: '17950924115269590',
  tasksUpdateStatus: '17950923425269591',
  tasksDelete: '17950923425269592',
  archiveList: '17950924115269593',
  archiveAdd: '17950924125269594',
  reviewsList: '17950923435269595',
  reviewsAdd: '17950923435269596',
  marksAdd: '17950923435269597',
  marksList: '17950923435269598',
  peerSamplesStats: '17951749605269613',
  peerSamplesMine: '17951749625269614',
  peerSamplesAdd: '17951749645269615',
  peerSamplesUpdate: '17951749655269616',
  archiveChoiceStats: '17951789565269617',
  discussionsList: '17955291545269685',
  discussionsAdd: '17955291545269686',
  discussionsDelete: '17955291545269687',
  discussionsStats: '17955298285269688',
} as const;

export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

/** 单个读接口的探测结果，供「数据接入状态」面板展示 */
export interface ApiProbe {
  key: ApiEndpointKey;
  label: string;
  ok: boolean;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T & { outputList?: unknown[]; rowNum?: number };
}

async function callAPI<T = Record<string, unknown>>(
  token: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${API_PATH_PREFIX}/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = (await res.json()) as ApiEnvelope<T>;
  if (!result.success) throw new Error(result.message || 'API 调用失败');
  return (result.data ?? ({} as T)) as T;
}

async function queryRows(token: string, params: Record<string, unknown> = {}) {
  const data = await callAPI<{ outputList: Record<string, unknown>[] }>(token, params);
  return Array.isArray(data.outputList) ? data.outputList : [];
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------- 本机用户标识 ------------------------------- */

const OWNER_KEY = 'yutu.ownerKey';

export function getOwnerKey(): string {
  try {
    const existing = localStorage.getItem(OWNER_KEY);
    if (existing) return existing;
    const key =
      'u-' +
      (globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(OWNER_KEY, key);
    return key;
  } catch {
    return 'u-anonymous';
  }
}

/* ---------------------------------- 档案 ---------------------------------- */

interface RawProfile {
  city?: string;
  age?: number | string;
  urban?: string;
  ident?: string;
  field?: string;
  place?: number | string;
  econ?: number | string;
  family?: number | string;
  cycle?: number | string;
  inertia?: number | string;
  history?: number | string;
  stage?: string;
}

export async function apiLoadProfile(ownerKey: string): Promise<Profile | null> {
  const rows = await queryRows(API_ENDPOINTS.profileGet, { ownerKey });
  const r = rows[0] as RawProfile | undefined;
  if (!r) return null;
  return {
    city: str(r.city, 'nanchong'),
    urban: (str(r.urban, 'core') as Profile['urban']) ?? 'core',
    identity: (str(r.ident, 'study') as Profile['identity']) ?? 'study',
    field: str(r.field, '土木'),
    s: {
      place: num(r.place, 34),
      econ: num(r.econ, 55),
      family: num(r.family, 45),
      age: num(r.age, 22),
      cycle: num(r.cycle, 45),
      inertia: num(r.inertia, 55),
      history: num(r.history, 18),
    },
  };
}

export async function apiSaveProfile(ownerKey: string, p: Profile, stage = ''): Promise<void> {
  await callAPI(API_ENDPOINTS.profileSave, {
    ownerKey,
    city: p.city,
    age: p.s.age,
    urban: p.urban,
    ident: p.identity,
    field: p.field,
    place: p.s.place,
    econ: p.s.econ,
    family: p.s.family,
    cycle: p.s.cycle,
    inertia: p.s.inertia,
    history: p.s.history,
    stage,
  });
}

/* ---------------------------------- 任务 ---------------------------------- */

export interface RawTask {
  title?: string;
  type?: string;
  status?: string;
  source?: string;
  source_id?: string;
  node_name?: string;
  pre?: string;
  risk?: string;
  std?: string;
  custom_flag?: number | string;
}

export interface TaskPayload {
  title: string;
  type: string;
  status: TaskStatus;
  origin: string;
  sourceId: string;
  nodeName: string;
  pre: string;
  risk: string;
  std: string;
  custom: boolean;
}

export function mapTaskRow(r: Record<string, unknown>): RawTask & { id: string } {
  return {
    id: str(r.id),
    title: str(r.title),
    type: str(r.type, '营利组织体验'),
    status: str(r.status, 'doing'),
    source: str(r.source, '由你自己添加'),
    source_id: str(r.source_id, ''),
    node_name: str(r.node_name, ''),
    pre: str(r.pre, '由你自行设定'),
    risk: str(r.risk, '—'),
    std: str(r.std, '由你自行设定'),
    custom_flag: num(r.custom_flag, 0),
  };
}

export async function apiLoadTasks(ownerKey: string) {
  return queryRows(API_ENDPOINTS.tasksList, { ownerKey });
}

export async function apiAddTask(ownerKey: string, t: TaskPayload): Promise<void> {
  await callAPI(API_ENDPOINTS.tasksAdd, {
    ownerKey,
    title: t.title,
    type: t.type,
    status: t.status,
    source: t.origin,
    stage: '',
    city: '',
    sourceId: t.sourceId,
    nodeName: t.nodeName,
    pre: t.pre,
    risk: t.risk,
    std: t.std,
    customFlag: t.custom ? 1 : 0,
  });
}

export async function apiUpdateTaskStatus(
  ownerKey: string,
  id: string,
  status: TaskStatus
): Promise<void> {
  await callAPI(API_ENDPOINTS.tasksUpdateStatus, { ownerKey, id, status });
}

export async function apiDeleteTask(ownerKey: string, id: string): Promise<void> {
  await callAPI(API_ENDPOINTS.tasksDelete, { ownerKey, id });
}

/* ---------------------------------- 档案 ---------------------------------- */

export interface VictoryPayload {
  title: string;
  choice: Choice;
  q1: string;
  q2: string;
  q3: string;
  vectorJson: string;
  tasksJson: string;
  domain: string;
  simPct: number;
  /** 归档时的阶段：用于按阶段聚合真实去向选择 */
  stage: string;
  /** 归档时所在城市 */
  city: string;
}

export async function apiLoadArchive(ownerKey: string) {
  return queryRows(API_ENDPOINTS.archiveList, { ownerKey });
}

export async function apiAddArchive(ownerKey: string, v: VictoryPayload): Promise<void> {
  await callAPI(API_ENDPOINTS.archiveAdd, {
    ownerKey,
    title: v.title,
    choice: v.choice,
    q1: v.q1,
    q2: v.q2,
    q3: v.q3,
    vectorJson: v.vectorJson,
    stage: v.stage,
    city: v.city,
    tasksJson: v.tasksJson,
    domain: v.domain,
    simPct: v.simPct,
  });
}

export function mapVictoryRow(r: Record<string, unknown>): Omit<Victory, 'no'> {
  const snap = parseJson<Scores | null>(r.vector_json, null);
  const tasks = parseJson<
    { id: string; title: string; type: string; sourceId?: string }[]
  >(r.tasks_json, []);
  return {
    id: str(r.id),
    backendId: str(r.id),
    at: str(r.created).replace('T', ' ').slice(0, 16),
    snap:
      snap ??
      ({ place: 50, econ: 50, family: 50, age: 24, cycle: 50, inertia: 50, history: 50 } as Scores),
    domain: str(r.domain, '未记录归属域'),
    sim: num(r.sim_pct, 0) / 100,
    tasks: Array.isArray(tasks) ? tasks : [],
    choice: (str(r.choice, 'keep') as Choice) ?? 'keep',
    answers: {
      feel: str(r.q1),
      ctx: str(r.q2),
      vision: str(r.q3),
    },
  };
}

/* ---------------------------------- 复盘 ---------------------------------- */

export async function apiLoadReviews() {
  return queryRows(API_ENDPOINTS.reviewsList);
}

export function mapReviewRow(r: Record<string, unknown>): Review {
  return {
    id: str(r.id),
    authorKey: str(r.author_key),
    authorName: str(r.author_name, '同处境者'),
    stage: (str(r.stage, 'explore') as StageId) ?? 'explore',
    city: str(r.city),
    choice: (str(r.choice, 'keep') as Choice) ?? 'keep',
    content: str(r.content),
    vector: parseJson<Scores | null>(r.vector_json, null),
    createdAt: str(r.created).replace('T', ' ').slice(0, 16),
  };
}

export async function apiAddReview(params: {
  authorKey: string;
  authorName: string;
  stage: string;
  city: string;
  choice: string;
  content: string;
  vectorJson: string;
  status: string;
}): Promise<void> {
  await callAPI(API_ENDPOINTS.reviewsAdd, params);
}

export async function apiLoadMarkCounts(): Promise<Record<string, number>> {
  const rows = await queryRows(API_ENDPOINTS.marksList);
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    const id = str(r.review_id);
    if (id) out[id] = num(r.cnt, 0);
  });
  return out;
}

export async function apiAddMark(reviewId: string, markerKey: string): Promise<void> {
  await callAPI(API_ENDPOINTS.marksAdd, { reviewId, markerKey });
}

/* -------------------------------- 去向样本 -------------------------------- */

const CHOICES: Choice[] = ['keep', 'revise', 'rest', 'switch'];

function toChoice(v: unknown): Choice {
  const s = str(v, 'keep');
  return (CHOICES.includes(s as Choice) ? s : 'keep') as Choice;
}

export function mapPeerSampleRow(r: Record<string, unknown>): PeerSample {
  return {
    id: str(r.id),
    stage: str(r.stage, 'explore') as StageId,
    city: str(r.city),
    choice: toChoice(r.choice),
    note: str(r.note),
    createdAt: str(r.created ?? r.created_at ?? r.modified)
      .replace('T', ' ')
      .slice(0, 16),
  };
}

export function mapPeerStatRow(r: Record<string, unknown>): PeerStat {
  return {
    stage: str(r.stage),
    choice: toChoice(r.choice),
    count: num(r.cnt ?? r.count ?? r.num, 0),
  };
}

export function mapChoiceStatRow(r: Record<string, unknown>): ChoiceStat {
  return {
    stage: str(r.stage),
    choice: toChoice(r.choice),
    count: num(r.cnt ?? r.count ?? r.num, 0),
    latest: str(r.latest ?? r.created),
  };
}

export async function apiLoadPeerStats(): Promise<PeerStat[]> {
  const rows = await queryRows(API_ENDPOINTS.peerSamplesStats);
  return rows.map(mapPeerStatRow);
}

export async function apiLoadPeerMine(ownerKey: string): Promise<PeerSample[]> {
  const rows = await queryRows(API_ENDPOINTS.peerSamplesMine, { ownerKey });
  return rows.map(mapPeerSampleRow);
}

export async function apiAddPeerSample(p: {
  ownerKey: string;
  stage: string;
  city: string;
  choice: Choice;
  note: string;
}): Promise<void> {
  await callAPI(API_ENDPOINTS.peerSamplesAdd, p);
}

export async function apiUpdatePeerSample(p: {
  id: string;
  ownerKey: string;
  city: string;
  choice: Choice;
  note: string;
}): Promise<void> {
  await callAPI(API_ENDPOINTS.peerSamplesUpdate, p);
}

export async function apiLoadChoiceStats(): Promise<ChoiceStat[]> {
  const rows = await queryRows(API_ENDPOINTS.archiveChoiceStats);
  return rows.map(mapChoiceStatRow);
}

/* -------------------------------- 复盘讨论 -------------------------------- */

export function mapDiscussionRow(r: Record<string, unknown>): Discussion {
  return {
    id: str(r.id),
    reviewId: str(r.review_id),
    parentId: str(r.parent_id, '0') || '0',
    authorKey: str(r.author_key),
    authorName: str(r.author_name, '同处境者'),
    content: str(r.content),
    createdAt: str(r.created ?? r.created_at)
      .replace('T', ' ')
      .slice(0, 16),
  };
}

export async function apiLoadDiscussions(
  reviewId: string
): Promise<Discussion[]> {
  const rows = await queryRows(API_ENDPOINTS.discussionsList, { reviewId });
  return rows.map(mapDiscussionRow);
}

export async function apiAddDiscussion(p: {
  reviewId: string;
  parentId: string;
  authorKey: string;
  authorName: string;
  content: string;
  status: string;
}): Promise<void> {
  await callAPI(API_ENDPOINTS.discussionsAdd, p);
}

export async function apiDeleteDiscussion(p: {
  id: string;
  authorKey: string;
}): Promise<void> {
  await callAPI(API_ENDPOINTS.discussionsDelete, p);
}

export function mapDiscussionStatRow(
  r: Record<string, unknown>
): DiscussionStat {
  return {
    reviewId: str(r.review_id),
    count: num(r.cnt ?? r.count, 0),
    people: num(r.people ?? r.users, 0),
  };
}

export async function apiLoadDiscussionStats(): Promise<DiscussionStat[]> {
  const rows = await queryRows(API_ENDPOINTS.discussionsStats);
  return rows.map(mapDiscussionStatRow);
}
