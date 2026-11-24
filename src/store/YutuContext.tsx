import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { STAGES, type StageId } from '@/data/catalog';
import { desensitize } from '@/lib/desensitize';
import { BASE_NODES } from '@/data/nodes';
import {
  applyDrift,
  applyInactivityDecay,
  CHOICE_LABEL,
  clampDim,
  currentStage,
  DRIFT,
  DROP_DRIFT,
  fmtTime,
  mag,
  placeFrom,
  ranked,
  TOTAL_STEPS,
} from '@/lib/model';
import {
  apiAddArchive,
  apiAddMark,
  apiAddReview,
  apiAddTask,
  apiDeleteTask,
  apiLoadArchive,
  apiLoadMarkCounts,
  apiLoadProfile,
  apiLoadReviews,
  apiLoadTasks,
  apiSaveProfile,
  apiUpdateTaskStatus,
  getOwnerKey,
  mapReviewRow,
  mapTaskRow,
  mapVictoryRow,
  apiLoadPeerStats,
  apiLoadPeerMine,
  apiAddPeerSample,
  apiUpdatePeerSample,
  apiLoadChoiceStats,
  apiLoadDiscussions,
  apiAddDiscussion,
  apiDeleteDiscussion,
  apiLoadDiscussionStats,
  apiLoadMedia,
  apiAddMedia,
  apiDeleteMedia,
  type ApiEndpointKey,
  type ApiProbe,
} from '@/lib/yutuApi';
import type {
  Choice,
  ChoiceStat,
  DimensionKey,
  Discussion,
  DiscussionStat,
  LoopArchive,
  PeerSample,
  PeerStat,
  Profile,
  PrototypeNode,
  Review,
  ReviewMedia,
  Scores,
  TaskItem,
  TaskStatus,
  TaskTemplate,
  Victory,
} from '@/types';

export const DEFAULT_PROFILE: Profile = {
  city: 'nanchong',
  urban: 'core',
  identity: 'study',
  field: '土木',
  s: { place: 34, econ: 68, family: 55, age: 22, cycle: 25, inertia: 55, history: 18 },
};

/**
 * V9.4：平台已切到新的 `_1_1` 表（8766–8771）与工作流 5269644–5269660。
 * 本地缓存随之换到 v3，旧 v2 里的任务 / 胜利档案 / 校验池不再参与渲染，
 * 避免「平台已经是新表空数据、界面还挂着旧历史」。
 */
const LS_KEY = 'yutu.state.v3';
const LEGACY_LS_KEYS = ['yutu.state.v2'];
const LS_LAST = 'yutu.lastActive';
const LS_MARKED = 'yutu.marked';
const LS_DROP = 'yutu.dropApplied';

export type Filter = 'all' | TaskStatus;
export type SubTab = 1 | 2 | 3 | 4;

interface PoolItem {
  vid: string;
  reviewId: string;
  no: number;
  choice: Choice;
  domain: string;
  own: boolean;
}

interface PersistShape {
  profile: Profile;
  tasks: TaskItem[];
  victories: Victory[];
  pool: PoolItem[];
  reviews: Review[];
  markCounts: Record<string, number>;
  /** 本机用户按阶段提交的去向样本（离线时也保留） */
  peerMine: PeerSample[];
  /** 复盘讨论（本机缓存 + 平台回读） */
  discussions: Discussion[];
  /** 复盘素材（公开图片/语音链接） */
  media: ReviewMedia[];
  /** 方向候选短名单（最多 4 条） */
  shortlist: string[];
  /** 方向与推演（作战图）当前点选的方向 */
  pick: string | null;
  /** 用户对方向的想法（自由文本，参与检索） */
  intent: string;
  /** 方向清单「只看当前可做」 */
  onlyFeasible: boolean;
  /** 当前步骤与已解锁步骤，刷新后继续 */
  step: number;
  maxStep: number;
  /** 最近一次归档结果（闭环完成卡与漂移动画） */
  lastArchive: LoopArchive | null;
  /** 起点快照：首次进入第 2 步时的七维，用于「起点 → 现在」对比 */
  snapshot0: Scores | null;
}

export interface YutuState extends PersistShape {
  step: number;
  maxStep: number;
  onlyFeasible: boolean;
  pick: string | null;
  filter: Filter;
  sub: SubTab;
  loadedNode: string | null;
  backendOnline: boolean;
  hydrated: boolean;
  notice: string;
  inactive: { days: number; applied: boolean } | null;
  /** 5 个读接口的最近一次探测结果 */
  apiProbes: ApiProbe[];
  /** 最近一次从平台拉取数据的时间戳 */
  lastSyncAt: number;
  /** 是否正在执行「重新同步」 */
  syncing: boolean;
  /** 平台按阶段聚合的自填去向样本 */
  peerStats: PeerStat[];
  /** 平台按阶段聚合的归档去向（真实归档记录） */
  choiceStats: ChoiceStat[];
  /** 已尝试加载过讨论的复盘 id */
  discussionLoaded: string[];
  /** 按复盘聚合的讨论热度 */
  discussionStats: DiscussionStat[];
  /** 已尝试加载过素材的复盘 id */
  mediaLoaded: string[];
}

const INITIAL: YutuState = {
  profile: DEFAULT_PROFILE,
  step: 1,
  maxStep: 1,
  onlyFeasible: false,
  pick: null,
  intent: '',
  filter: 'all',
  sub: 1,
  loadedNode: null,
  tasks: [],
  victories: [],
  lastArchive: null,
  snapshot0: null,
  pool: [],
  reviews: [],
  markCounts: {},
  peerMine: [],
  peerStats: [],
  choiceStats: [],
  discussions: [],
  discussionLoaded: [],
  discussionStats: [],
  media: [],
  mediaLoaded: [],
  shortlist: [],
  backendOnline: false,
  hydrated: false,
  notice: '',
  inactive: null,
  apiProbes: [],
  lastSyncAt: 0,
  syncing: false,
};

/** 旧快照迁移：v>=4 的步骤前移一位（六步 / 五步快照都收敛到当前四步） */
function migrateStep(n: unknown): number {
  const v = Number(n) || 1;
  const mapped = v >= 4 ? v - 1 : v;
  return Math.min(TOTAL_STEPS, Math.max(1, mapped));
}

function readLocal(): Partial<PersistShape> | null {
  try {
    /* 一次性丢弃旧版本缓存，保证界面与新的平台表一致 */
    LEGACY_LS_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistShape>;
  } catch {
    return null;
  }
}

function writeLocal(s: PersistShape) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* 忽略配额错误 */
  }
}

function readMarked(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_MARKED) || '[]') as string[];
  } catch {
    return [];
  }
}

function writeMarked(ids: string[]) {
  try {
    localStorage.setItem(LS_MARKED, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * 放弃任务只回写一次处境：同一条任务被反复「放弃 / 重新打开」时，
 * 仍然只记得第一次的判断成本，避免把操作次数误当成成长。
 */
function readDropApplied(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_DROP) || '[]') as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function recordDropApplied(id: string) {
  const ids = readDropApplied();
  if (ids.includes(id)) return;
  try {
    localStorage.setItem(LS_DROP, JSON.stringify([...ids, id].slice(-400)));
  } catch {
    /* ignore */
  }
}

function markLocalActive() {
  try {
    localStorage.setItem(LS_LAST, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function readLocalActive(): number {
  try {
    return Number(localStorage.getItem(LS_LAST) || 0);
  } catch {
    return 0;
  }
}

function archivedIdsFromVictories(vs: Victory[]): Set<string> {
  const set = new Set<string>();
  vs.forEach((v) =>
    v.tasks.forEach((t) => {
      set.add(t.id);
      /* 自定义任务的 sourceId 是全局唯一的一次性标识；参考任务模板的
         sourceId 会被下一轮复用，不能拿来判重，否则新一轮会被误标为已归档。 */
      if (t.sourceId?.startsWith('custom-')) set.add(t.sourceId);
    })
  );
  return set;
}

/**
 * 服务端回读可能比写入慢一拍。把「本机有、服务端还没返回」的归档记录补回去，
 * 避免刚完成一次闭环、档案却短暂消失。按任务 id 判断是否已存在。
 */
function mergeVictories(server: Victory[], local: Victory[]): Victory[] {
  const seen = new Set<string>();
  server.forEach((v) => v.tasks.forEach((t) => seen.add(t.id)));
  const extra = local.filter(
    (v) => v.tasks.length === 0 || !v.tasks.some((t) => seen.has(t.id))
  );
  if (!extra.length) return server;
  return [...server, ...extra]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((v, i) => ({ ...v, no: i + 1 }));
}

function rowsToTasks(rows: Record<string, unknown>[], archived: Set<string>): TaskItem[] {
  return rows.map((row) => {
    const r = mapTaskRow(row);
    const sourceId = r.source_id ?? '';
    return {
      id: r.id,
      backendId: r.id,
      title: r.title ?? '',
      type: r.type ?? '营利组织体验',
      status: (r.status as TaskStatus) ?? 'doing',
      origin: r.source ?? '',
      sourceId,
      nodeName: r.node_name ?? '',
      pre: r.pre ?? '',
      risk: r.risk ?? '',
      std: r.std ?? '',
      custom: Number(r.custom_flag) === 1,
      archived:
        archived.has(r.id) ||
        (sourceId.startsWith('custom-') && archived.has(sourceId)),
    };
  });
}

function templateToTask(node: PrototypeNode, t: TaskTemplate): TaskItem {
  return {
    id: `tmp-${node.id}-${t.id}-${Math.random().toString(36).slice(2, 7)}`,
    title: t.title,
    type: t.type,
    status: 'doing',
    origin: t.src,
    sourceId: t.id,
    nodeName: node.id,
    pre: t.pre,
    risk: t.risk,
    std: t.std,
    custom: false,
    archived: false,
  };
}

/** 已通过 3 个有效标记的公共复盘升级为可参与归属的节点 */
function reviewsToNodes(reviews: Review[], counts: Record<string, number>, ownerKey: string) {
  return reviews
    .filter((r) => (counts[r.id] ?? 0) >= 3 && r.vector)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, 8)
    .map<PrototypeNode>((r) => ({
      id: `review-${r.id}`,
      name: `用户贡献 · ${r.authorName} 的复盘`,
      hue: '#4f7a58',
      s: r.vector as Scores,
      pains: [r.content.slice(0, 80) + (r.content.length > 80 ? '…' : '')],
      tasks: [
        {
          id: `review-${r.id}-t1`,
          type: '团队体验',
          title: '读完这条复盘后，用自己的方式做一次最小验证',
          src: `用户贡献复盘 · 已通过 3 位同处境用户校验`,
          pre: '与贡献者处境相近',
          risk: '前置条件可能不同，需自行核对',
          std: '由你自行设定',
        },
      ],
      own: r.authorKey === ownerKey,
    }));
}

interface RemoteRead {
  probes: ApiProbe[];
  profile: Profile | null;
  taskRows: Record<string, unknown>[];
  archiveRows: Record<string, unknown>[];
  reviewRows: Record<string, unknown>[];
  markCounts: Record<string, number>;
  peerStats: PeerStat[];
  peerMine: PeerSample[];
  choiceStats: ChoiceStat[];
  discussionStats: DiscussionStat[];
  online: boolean;
  okCount: number;
}

/**
 * 一次读取 5 个查询接口，并逐项记录成功/失败。
 * 使用 allSettled：单个接口失败不影响其它数据，同时把结果交给状态面板展示。
 */
async function readRemote(ownerKey: string): Promise<RemoteRead> {
  const defs: { key: ApiEndpointKey; label: string; run: () => Promise<unknown> }[] = [
    { key: 'profileGet', label: '个人档案', run: () => apiLoadProfile(ownerKey) },
    { key: 'tasksList', label: '体验任务', run: () => apiLoadTasks(ownerKey) },
    { key: 'archiveList', label: '胜利档案', run: () => apiLoadArchive(ownerKey) },
    { key: 'reviewsList', label: '同伴复盘', run: () => apiLoadReviews() },
    { key: 'marksList', label: '有效标记', run: () => apiLoadMarkCounts() },
    { key: 'peerSamplesStats', label: '同阶段去向', run: () => apiLoadPeerStats() },
    {
      key: 'peerSamplesMine',
      label: '我的去向',
      run: () => apiLoadPeerMine(ownerKey),
    },
    {
      key: 'archiveChoiceStats',
      label: '归档去向',
      run: () => apiLoadChoiceStats(),
    },
    {
      key: 'discussionsStats',
      label: '讨论热度',
      run: () => apiLoadDiscussionStats(),
    },
  ];
  const settled = await Promise.allSettled(defs.map((d) => d.run()));
  const probes: ApiProbe[] = defs.map((d, i) => {
    const r = settled[i];
    return {
      key: d.key,
      label: d.label,
      ok: r.status === 'fulfilled',
      message:
        r.status === 'rejected'
          ? r.reason instanceof Error
            ? r.reason.message
            : '调用失败'
          : '',
    };
  });
  const val = <T,>(i: number, fallback: T): T =>
    settled[i].status === 'fulfilled' ? (settled[i].value as T) : fallback;
  return {
    probes,
    profile: val<Profile | null>(0, null),
    taskRows: val<Record<string, unknown>[]>(1, []),
    archiveRows: val<Record<string, unknown>[]>(2, []),
    reviewRows: val<Record<string, unknown>[]>(3, []),
    markCounts: val<Record<string, number>>(4, {}),
    peerStats: val<PeerStat[]>(5, []),
    peerMine: val<PeerSample[]>(6, []),
    choiceStats: val<ChoiceStat[]>(7, []),
    discussionStats: val<DiscussionStat[]>(8, []),
    online: probes.some((p) => p.ok),
    okCount: probes.filter((p) => p.ok).length,
  };
}

interface YutuContextValue {
  state: YutuState;
  ownerKey: string;
  nodes: PrototypeNode[];
  markedIds: string[];
  setStep: (n: number) => void;
  setSub: (n: SubTab) => void;
  setFilter: (f: Filter) => void;
  setOnlyFeasible: (v: boolean) => void;
  setPick: (v: string | null) => void;
  setIntent: (v: string) => void;
  toggleShortlist: (name: string) => void;
  clearShortlist: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  applyScores: (scores: Partial<Scores>) => void;
  updateScore: (k: DimensionKey, v: number) => void;
  applyCity: (city: string, urban?: Profile['urban']) => void;
  loadNodeTasks: (node: PrototypeNode) => number;
  addCustomTask: (title: string, type: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  removeTask: (id: string) => void;
  archive: (choice: Choice, answers: Victory['answers']) => Victory | null;
  submitVictoryReview: (v: Victory) => void;
  submitExperienceCard: (text: string) => void;
  submitPeerSample: (choice: Choice, note: string) => void;
  loadDiscussions: (reviewId: string) => Promise<void>;
  submitDiscussion: (
    reviewId: string,
    parentId: string,
    content: string
  ) => void;
  removeDiscussion: (id: string) => void;
  loadMedia: (reviewId: string) => Promise<void>;
  submitMedia: (
    reviewId: string,
    kind: 'image' | 'audio',
    url: string,
    caption: string
  ) => void;
  removeMedia: (id: string) => void;
  markReview: (reviewId: string) => void;
  refreshReviews: () => void;
  resync: () => void;
  restart: () => void;
  flash: (msg: string) => void;
  setNotice: (msg: string) => void;
  currentStageObj: () => (typeof STAGES)[number];
  currentRank: () => ReturnType<typeof ranked>;
}

/**
 * Vite 热更新本模块时会重新执行 createContext：已挂载的 Provider 仍持有旧对象，
 * 新加载的 useYutu 却读新对象，于是报 "useYutu must be used inside YutuProvider"。
 * 把 Context 挂到 globalThis 复用，保证热更新前后始终是同一个实例。
 */
const CONTEXT_GLOBAL_KEY = '__yutu_context_v1__';
const globalContextStore = globalThis as unknown as Record<
  string,
  Context<YutuContextValue | null> | undefined
>;
const YutuContext: Context<YutuContextValue | null> =
  globalContextStore[CONTEXT_GLOBAL_KEY] ??
  createContext<YutuContextValue | null>(null);
globalContextStore[CONTEXT_GLOBAL_KEY] = YutuContext;

export function YutuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<YutuState>(INITIAL);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const ownerKey = useMemo(() => getOwnerKey(), []);
  const noticeTimer = useRef<number | null>(null);

  const flash = useCallback((msg: string) => {
    setState((s) => ({ ...s, notice: msg }));
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => {
      setState((s) => (s.notice === msg ? { ...s, notice: '' } : s));
    }, 4600);
  }, []);

  /* ------------------------------- 初始化 ------------------------------- */

  useEffect(() => {
    let alive = true;
    const local = readLocal();
    const marked = readMarked();
    setMarkedIds(marked);

    if (local) {
      const step = migrateStep(local.step);
      const maxStep = Math.max(step, migrateStep(local.maxStep));
      setState((s) => ({
        ...s,
        ...local,
        step,
        maxStep,
        profile: local.profile ?? s.profile,
        tasks: local.tasks ?? [],
        victories: local.victories ?? [],
        lastArchive: local.lastArchive ?? null,
        /* 老快照没有起点字段：已经走到第 2 步的，用当前处境补一个基准 */
        snapshot0:
          local.snapshot0 ??
          (step >= 2 ? { ...(local.profile ?? s.profile).s } : null),
        pool: local.pool ?? [],
        reviews: local.reviews ?? [],
        markCounts: local.markCounts ?? {},
        peerMine: local.peerMine ?? [],
        discussions: local.discussions ?? [],
        media: local.media ?? [],
      }));
    }

    (async () => {
      let remote: RemoteRead;
      try {
        remote = await readRemote(ownerKey);
      } catch {
        if (!alive) return;
        setState((s) => ({
          ...s,
          backendOnline: false,
          hydrated: true,
          lastSyncAt: Date.now(),
          apiProbes: [
            { key: 'profileGet', label: '个人档案', ok: false, message: '读取失败' },
            { key: 'tasksList', label: '体验任务', ok: false, message: '读取失败' },
            { key: 'archiveList', label: '胜利档案', ok: false, message: '读取失败' },
            { key: 'reviewsList', label: '同伴复盘', ok: false, message: '读取失败' },
            { key: 'marksList', label: '有效标记', ok: false, message: '读取失败' },
            { key: 'peerSamplesStats', label: '同阶段去向', ok: false, message: '读取失败' },
            { key: 'peerSamplesMine', label: '我的去向', ok: false, message: '读取失败' },
            { key: 'archiveChoiceStats', label: '归档去向', ok: false, message: '读取失败' },
            { key: 'discussionsStats', label: '讨论热度', ok: false, message: '读取失败' },
          ],
        }));
        return;
      }
      if (!alive) return;
      const victories = remote.archiveRows
        .map((r) => mapVictoryRow(r))
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((v, i) => ({ ...v, no: i + 1 }));
      const reviews = remote.reviewRows.map((r) => mapReviewRow(r));

      // 所有读接口都失败：保持本地缓存，并记录每项失败原因
      if (!remote.online) {
        setState((s) => ({
          ...s,
          backendOnline: false,
          hydrated: true,
          apiProbes: remote.probes,
          lastSyncAt: Date.now(),
        }));
        return;
      }

      const peerMineOk =
        remote.probes.find((p) => p.key === 'peerSamplesMine')?.ok ?? false;
      setState((s) => {
        let profile = remote.profile ?? s.profile;
        let inactive: YutuState['inactive'] = s.inactive;
        const last = readLocalActive();
        const decay = applyInactivityDecay(profile.s, last);
        if (decay.applied) {
          profile = { ...profile, s: decay.s };
          inactive = { days: decay.days, applied: true };
        }
        const mergedVictories = mergeVictories(victories, s.victories);
        const tasks = rowsToTasks(
          remote.taskRows,
          archivedIdsFromVictories(mergedVictories)
        );
        /* 平台还没回读到、但本机已经填过的去向样本，保留下来等下次同步 */
        const localOnlyPeer = s.peerMine.filter(
          (p) =>
            p.id.startsWith('local-peer-') &&
            !remote.peerMine.some((r) => r.stage === p.stage)
        );
        return {
          ...s,
          profile,
          tasks: tasks.length ? tasks : s.tasks,
          victories: mergedVictories,
          /* 老用户没有本地起点快照时，用最早一次归档前的向量兜底 */
          snapshot0: s.snapshot0 ?? mergedVictories[0]?.snap ?? null,
          reviews,
          markCounts: remote.markCounts,
          peerMine: peerMineOk
            ? [...remote.peerMine, ...localOnlyPeer]
            : s.peerMine,
          peerStats: remote.peerStats,
          choiceStats: remote.choiceStats,
          discussionStats: remote.discussionStats,
          backendOnline: true,
          hydrated: true,
          inactive,
          apiProbes: remote.probes,
          lastSyncAt: Date.now(),
        };
      });
    })();

    return () => {
      alive = false;
    };
  }, [ownerKey]);

  /* --------------------------- 本地缓存与档案保存 --------------------------- */

  useEffect(() => {
    if (!state.hydrated) return;
    const t = window.setTimeout(() => {
      writeLocal({
        profile: state.profile,
        tasks: state.tasks,
        victories: state.victories,
        lastArchive: state.lastArchive,
        snapshot0: state.snapshot0,
        pool: state.pool,
        reviews: state.reviews,
        markCounts: state.markCounts,
        peerMine: state.peerMine,
        discussions: state.discussions,
        media: state.media,
        shortlist: state.shortlist,
        pick: state.pick,
        intent: state.intent,
        onlyFeasible: state.onlyFeasible,
        step: state.step,
        maxStep: state.maxStep,
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    state.hydrated,
    state.profile,
    state.tasks,
    state.victories,
    state.lastArchive,
    state.pool,
    state.reviews,
    state.markCounts,
    state.peerMine,
    state.discussions,
    state.media,
    state.shortlist,
    state.pick,
    state.intent,
    state.onlyFeasible,
    state.step,
    state.maxStep,
    state.snapshot0,
  ]);

  // 档案变化后合并保存（仅在线时）
  const profileRef = useRef(state.profile);
  profileRef.current = state.profile;
  useEffect(() => {
    if (!state.hydrated || !state.backendOnline) return;
    const t = window.setTimeout(() => {
      void apiSaveProfile(ownerKey, profileRef.current, currentStage(profileRef.current).id).catch(() => {
        setState((s) => ({ ...s, backendOnline: false }));
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [
    state.hydrated,
    state.backendOnline,
    ownerKey,
    state.profile.city,
    state.profile.urban,
    state.profile.identity,
    state.profile.field,
    state.profile.s.age,
    state.profile.s.econ,
    state.profile.s.family,
    state.profile.s.cycle,
    state.profile.s.inertia,
    state.profile.s.history,
    state.profile.s.place,
  ]);

  /* -------------------------------- 节点 -------------------------------- */

  const publicNodes = useMemo(
    () => reviewsToNodes(state.reviews, state.markCounts, ownerKey),
    [state.reviews, state.markCounts, ownerKey]
  );

  // 有新的公共节点时，旧任务仍可读；节点列表只用于归属与载入
  const nodes = useMemo(() => [...BASE_NODES, ...publicNodes], [publicNodes]);

  /* -------------------------------- 动作 -------------------------------- */

  const setStep = useCallback((n: number) => {
    const next = Math.min(TOTAL_STEPS, Math.max(1, n));
    setState((s) => ({
      ...s,
      step: next,
      maxStep: Math.max(s.maxStep, next),
      /* 首次离开「填写信息」时固定起点快照；之后处境怎么漂移，都拿它作基准 */
      snapshot0: s.snapshot0 ?? (next >= 2 ? { ...s.profile.s } : null),
    }));
  }, []);

  const setSub = useCallback((n: SubTab) => {
    setState((s) => ({ ...s, sub: n }));
  }, []);

  const setFilter = useCallback((filter: Filter) => {
    setState((s) => ({ ...s, filter }));
  }, []);

  const setOnlyFeasible = useCallback((onlyFeasible: boolean) => {
    setState((s) => ({ ...s, onlyFeasible }));
  }, []);

  const setPick = useCallback((pick: string | null) => {
    setState((s) => ({ ...s, pick }));
  }, []);

  const setIntent = useCallback((intent: string) => {
    setState((s) => ({ ...s, intent }));
  }, []);

  const toggleShortlist = useCallback(
    (name: string) => {
      setState((s) => {
        if (s.shortlist.includes(name)) {
          return { ...s, shortlist: s.shortlist.filter((x) => x !== name) };
        }
        if (s.shortlist.length >= 4) {
          flash('候选最多 4 条，先移除一条再加。');
          return s;
        }
        return { ...s, shortlist: [...s.shortlist, name] };
      });
    },
    [flash]
  );

  const clearShortlist = useCallback(() => {
    setState((s) => ({ ...s, shortlist: [] }));
    flash('候选已清空。');
  }, [flash]);

  const applyScores = useCallback((scores: Partial<Scores>) => {
    setState((s) => ({
      ...s,
      profile: { ...s.profile, s: { ...s.profile.s, ...scores } },
    }));
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  }, []);

  const updateScore = useCallback((k: DimensionKey, v: number) => {
    setState((s) => ({
      ...s,
      profile: {
        ...s.profile,
        s: { ...s.profile.s, [k]: k === 'age' ? v : clampDim(k, v) },
      },
    }));
  }, []);

  const applyCity = useCallback((city: string, urban?: Profile['urban']) => {
    setState((s) => {
      const u = urban ?? s.profile.urban;
      return {
        ...s,
        profile: {
          ...s.profile,
          city,
          urban: u,
          s: { ...s.profile.s, place: placeFrom(city, u) },
        },
      };
    });
  }, []);

  const loadNodeTasks = useCallback(
    (node: PrototypeNode): number => {
      /* 已归档的任务不再占用模板位：归档后可以再次载入同一域，
         否则「完成任务 → 归档 → 再领任务」的闭环会被卡住。 */
      const active = state.tasks.filter((t) => !t.archived);
      const existing = new Set(active.map((t) => t.sourceId));
      const fresh = node.tasks.filter((t) => !existing.has(t.id));
      const short = node.name.split(' · ')[0];
      if (!fresh.length) {
        /* 不再是死胡同：说清「手上还有几条」，并告诉用户可以换域领取，
           用户不会被一句「已经全部在工作台里」挡在闭环之外。 */
        const here = active.filter((t) => t.nodeName === node.id).length;
        flash(
          here
            ? `「${short}」本轮还有 ${here} 条在手。先完成并归档，或换一个域领取新一轮。`
            : `「${short}」的参考任务都在工作台里了。可以换一个域，或自己新增一条。`
        );
        return 0;
      }
      const newTasks = fresh.map((t) => templateToTask(node, t));
      setState((s) => ({
        ...s,
        tasks: [...s.tasks, ...newTasks],
        loadedNode: node.id,
      }));
      flash(
        `已把「${short}」的 ${newTasks.length} 条参考任务载入工作台。这是草稿，增删改都在你手上。`
      );
      if (state.backendOnline) {
        // 逐条落库后再以服务端为准刷新，避免临时 id 留在本地
        void Promise.all(newTasks.map((t) => apiAddTask(ownerKey, t)))
          .then(() => apiLoadTasks(ownerKey))
          .then((rows) => {
            const archived = archivedIdsFromVictories(state.victories);
            const tasks = rowsToTasks(rows, archived);
            setState((s) => ({ ...s, tasks: tasks.length ? tasks : s.tasks }));
          })
          .catch(() =>
            flash('参考任务已加入本机清单，但写平台失败；稍后再试或在顶部重新同步。')
          );
      }
      return newTasks.length;
    },
    [flash, ownerKey, state.backendOnline, state.tasks, state.victories]
  );

  const syncTasks = useCallback(() => {
    void apiLoadTasks(ownerKey)
      .then((rows) => {
        const archived = archivedIdsFromVictories(state.victories);
        const tasks = rowsToTasks(rows, archived);
        setState((s) => ({ ...s, tasks: tasks.length ? tasks : s.tasks }));
      })
      .catch(() => undefined);
  }, [ownerKey, state.victories]);

  const addCustomTask = useCallback(
    (title: string, type: string) => {
      const t = title.trim();
      if (t.length < 4) {
        flash('请把任务写清楚一些（至少 4 个字），已输入的内容不会丢失。');
        return;
      }
      const temp: TaskItem = {
        id: `tmp-custom-${Date.now()}`,
        title: t,
        type,
        status: 'doing',
        origin: '由你自己添加',
        sourceId: `custom-${Date.now()}`,
        nodeName: 'custom',
        pre: '由你自行设定',
        risk: '—',
        std: '由你自行设定',
        custom: true,
        archived: false,
      };
      setState((s) => ({ ...s, tasks: [...s.tasks, temp] }));
      if (state.backendOnline) {
        void apiAddTask(ownerKey, temp)
          .then(syncTasks)
          .catch(() =>
            flash('已加入本机清单，但写平台失败；这条任务暂时只在本机可见。')
          );
      }
      flash('已加入清单。自定义任务与系统草稿在系统里权重相同。');
    },
    [flash, ownerKey, state.backendOnline, syncTasks]
  );

  const updateTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      const task = state.tasks.find((t) => t.id === id);
      const penalize =
        status === 'drop' &&
        !!task &&
        task.status !== 'drop' &&
        !readDropApplied().includes(id);
      const nextScores = penalize
        ? applyDrift(state.profile.s, DROP_DRIFT)
        : state.profile.s;

      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
        profile: penalize ? { ...s.profile, s: nextScores } : s.profile,
      }));

      if (penalize) {
        recordDropApplied(id);
        flash('已把这次放弃记进处境：体验历史 +2、认知惯性 −1。');
        if (state.backendOnline) {
          const nextProfile = { ...state.profile, s: nextScores };
          void apiSaveProfile(
            ownerKey,
            nextProfile,
            currentStage(nextProfile).id
          ).catch(() => undefined);
        }
      }

      if (state.backendOnline && !id.startsWith('tmp-')) {
        void apiUpdateTaskStatus(ownerKey, id, status).catch(() =>
          flash(
            penalize
              ? '放弃已记入本机处境，但任务状态写平台失败；稍后可再试一次。'
              : '状态已在本机更新，但写平台失败；刷新后可能回滚，稍后可再试一次。'
          )
        );
      }
    },
    [flash, ownerKey, state.backendOnline, state.profile, state.tasks]
  );

  const removeTask = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      if (state.backendOnline && !id.startsWith('tmp-')) {
        void apiDeleteTask(ownerKey, id).catch(() =>
          flash('已从本机清单移除，但平台删除失败，刷新后可能再次出现。')
        );
      }
    },
    [flash, ownerKey, state.backendOnline]
  );

  const archive = useCallback(
    (choice: Choice, answers: Victory['answers']): Victory | null => {
      const arr = state.tasks.filter((t) => t.status === 'done' && !t.archived);
      if (!arr.length) {
        flash('还没有已完成的体验可以归档。');
        return null;
      }
      const snap: Scores = { ...state.profile.s };
      const rank = ranked(snap, nodes);
      const cur = rank[0];
      const no = state.victories.length + 1;
      const victory: Victory = {
        id: `local-v-${Date.now()}`,
        no,
        at: fmtTime(new Date()),
        snap,
        domain: cur?.node.name ?? '未定域',
        sim: cur?.sim ?? 0,
        tasks: arr.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          sourceId: t.sourceId,
        })),
        choice,
        answers,
      };
      const nextScores: Scores = applyDrift(state.profile.s, DRIFT[choice]);
      if (no % 3 === 0) nextScores.age = clampDim('age', nextScores.age + 1);
      const nextRank = ranked(nextScores, nodes);
      markLocalActive();

      setState((s) => ({
        ...s,
        victories: [...s.victories, victory],
        tasks: s.tasks.map((t) =>
          arr.some((a) => a.id === t.id) ? { ...t, archived: true } : t
        ),
        profile: { ...s.profile, s: nextScores },
        lastArchive: {
          no,
          choice,
          before: snap,
          after: nextScores,
          domain: nextRank[0]?.node.name ?? '',
          sim: nextRank[0]?.sim ?? 0,
          at: Date.now(),
        },
      }));

      if (state.backendOnline) {
        const payload = {
          title: `第 ${no} 次阶段性胜利 · ${CHOICE_LABEL[choice]}`,
          choice,
          q1: answers.feel,
          q2: answers.ctx,
          q3: answers.vision,
          vectorJson: JSON.stringify(snap),
          tasksJson: JSON.stringify(victory.tasks),
          domain: victory.domain,
          simPct: Math.round(victory.sim * 100),
          stage: currentStage(state.profile).id,
          city: state.profile.city,
        };
        void apiAddArchive(ownerKey, payload)
          .then(() => apiLoadArchive(ownerKey))
          .then((rows) => {
            const vs = rows
              .map((r) => mapVictoryRow(r))
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((v, i) => ({ ...v, no: i + 1 }));
            setState((s) => ({
              ...s,
              victories: mergeVictories(vs, [victory]),
            }));
          })
          .catch(() =>
            flash('本轮已在本机归档，但写平台失败；档案暂时只在本机可见。')
          );
        void apiSaveProfile(
          ownerKey,
          { ...state.profile, s: nextScores },
          currentStage({ ...state.profile, s: nextScores }).id
        ).catch(() => undefined);
      }

      if (choice === 'rest') {
        flash('已归档。选择了暂时休整，系统不推送新任务，只确认记录已存档。');
      } else if (choice === 'switch') {
        flash('已归档。排除一条路线同样是胜利——它以可控成本换来了清晰结论。');
      } else {
        flash('第 ' + no + ' 次阶段性胜利已归档。位置已小幅漂移，回到第 3 步可以看到新的落点。');
      }
      return victory;
    },
    [flash, nodes, ownerKey, state.backendOnline, state.profile, state.tasks, state.victories]
  );

  const submitReviewCommon = useCallback(
    async (params: {
      content: string;
      choice: Choice;
      vector: Scores;
      victory?: Victory;
    }) => {
      const stage = currentStage(state.profile);
      const authorName = `同处境者 · ${stage.name}`;
      /* 进入公共池前统一脱敏：金额 / 公司 / 联系方式；本地归档原文不受影响 */
      const masked = desensitize(params.content);
      const content = masked.text;
      const payload = {
        authorKey: ownerKey,
        authorName,
        stage: stage.id,
        city: state.profile.city,
        choice: params.choice,
        content,
        vectorJson: JSON.stringify(params.vector),
        status: 'pool',
      };
      const localReview: Review = {
        id: `local-review-${Date.now()}`,
        authorKey: ownerKey,
        authorName,
        stage: stage.id as StageId,
        city: state.profile.city,
        choice: params.choice,
        content,
        vector: params.vector,
        createdAt: fmtTime(new Date()),
      };
      setState((s) => ({ ...s, reviews: [localReview, ...s.reviews] }));

      if (params.victory) {
        setState((s) => ({
          ...s,
          pool: [
            ...s.pool,
            {
              vid: params.victory!.id,
              reviewId: localReview.id,
              no: params.victory!.no,
              choice: params.choice,
              domain: params.victory!.domain,
              own: true,
            },
          ],
        }));
      }
      markLocalActive();

      if (state.backendOnline) {
        try {
          await apiAddReview(payload);
          const rows = await apiLoadReviews();
          const reviews = rows.map((r) => mapReviewRow(r));
          const mine = reviews.find(
            (r) => r.authorKey === ownerKey && r.content === content
          );
          setState((s) => ({
            ...s,
            reviews,
            pool: params.victory && mine
              ? s.pool.map((p) =>
                  p.reviewId === localReview.id ? { ...p, reviewId: mine.id } : p
                )
              : s.pool,
          }));
        } catch {
          setState((s) => ({ ...s, backendOnline: false }));
        }
      }
    },
    [ownerKey, state.backendOnline, state.profile]
  );

  const submitVictoryReview = useCallback(
    (v: Victory) => {
      const filled = [v.answers.feel, v.answers.ctx, v.answers.vision].filter(
        (x) => x && x.trim().length >= 8
      );
      if (!filled.length) {
        flash('这次停靠没有留下有效自省，无有效内容的记录不进入校验池。');
        return;
      }
      const content = [
        v.answers.feel && `真实感受：${v.answers.feel}`,
        v.answers.ctx && `处境变化：${v.answers.ctx}`,
        v.answers.vision && `愿景：${v.answers.vision}`,
      ]
        .filter(Boolean)
        .join(' ／ ');
      void submitReviewCommon({ content, choice: v.choice, vector: v.snap, victory: v });
      flash(
        '已提交。公共文本已自动脱敏（金额 / 公司 / 联系方式），当前仅本人可见；需 3 位同处境用户标记有效后升级为公共节点。'
      );
    },
    [flash, submitReviewCommon]
  );

  const submitExperienceCard = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const content = `[经验卡] ${trimmed}`;
      if (trimmed.length < 10) {
        flash('经验卡至少要写清楚一句可复用的话（约 10 个字以上）。');
        return;
      }
      void submitReviewCommon({
        content,
        choice: 'keep',
        vector: state.profile.s,
      });
      flash(
        '经验卡已提交到校验池（金额 / 公司 / 联系方式会自动脱敏）。它比整条复盘更轻，也可以被同处境者标记有效。'
      );
    },
    [flash, state.profile.s, submitReviewCommon]
  );

  /** 提交 / 更新「同阶段去向样本」；公共文本先脱敏 */
  const submitPeerSample = useCallback(
    (choice: Choice, note: string) => {
      const stage = currentStage(state.profile);
      const city = state.profile.city;
      const masked = desensitize(note).text.trim();
      if (masked.length < 4) {
        flash('用一句话写清你下一步去了哪里（至少 4 个字）。');
        return;
      }
      const existing = state.peerMine.find((p) => p.stage === stage.id);
      const temp: PeerSample = {
        id: existing?.id ?? `local-peer-${Date.now()}`,
        stage: stage.id,
        city,
        choice,
        note: masked,
        createdAt: fmtTime(new Date()),
      };
      setState((s) => ({
        ...s,
        peerMine: [...s.peerMine.filter((p) => p.stage !== stage.id), temp],
      }));

      if (!state.backendOnline) {
        flash('去向样本已保存在本机。平台恢复后可在顶部「重新同步」。');
        return;
      }
      const req =
        existing && !existing.id.startsWith('local-peer-')
          ? apiUpdatePeerSample({
              id: existing.id,
              ownerKey,
              city,
              choice,
              note: masked,
            })
          : apiAddPeerSample({
              ownerKey,
              stage: stage.id,
              city,
              choice,
              note: masked,
            });
      void req
        .then(() => apiLoadPeerStats())
        .then((rows) => setState((s) => ({ ...s, peerStats: rows })))
        .catch(() =>
          flash('去向样本已保存在本机，但写平台失败；稍后再试或在顶部重新同步。')
        );
    },
    [flash, ownerKey, state.backendOnline, state.peerMine, state.profile]
  );

  /** 拉取某条复盘下的讨论；离线时只标记已加载，使用本机缓存 */
  const loadDiscussions = useCallback(
    async (reviewId: string) => {
      if (!reviewId) return;
      const markLoaded = () =>
        setState((s) => ({
          ...s,
          discussionLoaded: (s.discussionLoaded ?? []).includes(reviewId) ? (s.discussionLoaded ?? []) : [...(s.discussionLoaded ?? []), reviewId],
        }));
      if (!state.backendOnline) {
        markLoaded();
        return;
      }
      try {
        const items = await apiLoadDiscussions(reviewId);
        setState((s) => {
          /* 平台还没同步到的本机讨论保留下来，避免刷新即丢 */
          const localOnly = s.discussions.filter(
            (d) =>
              d.reviewId === reviewId &&
              d.id.startsWith('local-d-') &&
              !items.some(
                (it) => it.content === d.content && it.parentId === d.parentId
              )
          );
          return {
            ...s,
            discussions: [
              ...s.discussions.filter((d) => d.reviewId !== reviewId),
              ...items,
              ...localOnly,
            ],
            discussionLoaded: (s.discussionLoaded ?? []).includes(reviewId) ? (s.discussionLoaded ?? []) : [...(s.discussionLoaded ?? []), reviewId],
          };
        });
      } catch {
        flash('讨论加载失败；先显示本机记录。');
        markLoaded();
      }
    },
    [flash, state.backendOnline]
  );

  /** 提交讨论 / 回复；公共文本先脱敏 */
  const submitDiscussion = useCallback(
    (reviewId: string, parentId: string, content: string) => {
      const masked = desensitize(content).text.trim().slice(0, 480);
      if (masked.length < 2) {
        flash('写一句能看懂的话再发。');
        return;
      }
      const stage = currentStage(state.profile);
      const authorName = `同处境者 · ${stage.name}`;
      const isLocalReview = reviewId.startsWith('local-');
      const temp: Discussion = {
        id: `local-d-${Date.now()}`,
        reviewId,
        parentId: parentId || '0',
        authorKey: ownerKey,
        authorName,
        content: masked,
        createdAt: fmtTime(new Date()),
      };
      setState((s) => ({ ...s, discussions: [...s.discussions, temp] }));

      if (!state.backendOnline || isLocalReview) {
        flash(
          isLocalReview
            ? '这条复盘还没同步到平台，讨论先保存在本机。'
            : '讨论已保存在本机。平台恢复后再同步。'
        );
        return;
      }
      void apiAddDiscussion({
        reviewId,
        parentId: parentId || '0',
        authorKey: ownerKey,
        authorName,
        content: masked,
        status: 'public',
      })
        .then(() => loadDiscussions(reviewId))
        .catch(() =>
          flash('讨论已保存在本机，但写平台失败；稍后可在顶部重新同步。')
        );
    },
    [flash, ownerKey, state.backendOnline, state.profile, loadDiscussions]
  );

  /** 删除自己的一条讨论 */
  const removeDiscussion = useCallback(
    (id: string) => {
      const item = state.discussions.find((d) => d.id === id);
      if (!item || item.authorKey !== ownerKey) return;
      setState((s) => ({
        ...s,
        discussions: s.discussions.filter((d) => d.id !== id),
      }));
      if (state.backendOnline && !id.startsWith('local-d-')) {
        void apiDeleteDiscussion({ id, authorKey: ownerKey }).catch(() => {
          flash('删除失败；刷新后会恢复。');
          void loadDiscussions(item.reviewId);
        });
      }
    },
    [
      flash,
      ownerKey,
      state.backendOnline,
      state.discussions,
      loadDiscussions,
    ]
  );

  /** 拉取某条复盘下的素材；离线时使用本机缓存 */
  const loadMedia = useCallback(
    async (reviewId: string) => {
      if (!reviewId) return;
      const markLoaded = () =>
        setState((s) => ({
          ...s,
          mediaLoaded: (s.mediaLoaded ?? []).includes(reviewId) ? (s.mediaLoaded ?? []) : [...(s.mediaLoaded ?? []), reviewId],
        }));
      if (!state.backendOnline) {
        markLoaded();
        return;
      }
      try {
        const items = await apiLoadMedia(reviewId);
        setState((s) => {
          const localOnly = s.media.filter(
            (m) =>
              m.reviewId === reviewId &&
              m.id.startsWith('local-m-') &&
              !items.some(
                (it) => it.url === m.url && it.caption === m.caption
              )
          );
          return {
            ...s,
            media: [
              ...s.media.filter((m) => m.reviewId !== reviewId),
              ...items,
              ...localOnly,
            ],
            mediaLoaded: (s.mediaLoaded ?? []).includes(reviewId) ? (s.mediaLoaded ?? []) : [...(s.mediaLoaded ?? []), reviewId],
          };
        });
      } catch {
        flash('素材加载失败；先显示本机记录。');
        markLoaded();
      }
    },
    [flash, state.backendOnline]
  );

  /** 提交素材：只接受 http(s) 公开链接，说明文字先脱敏 */
  const submitMedia = useCallback(
    (reviewId: string, kind: 'image' | 'audio', url: string, caption: string) => {
      const clean = url.trim();
      if (!/^https?:\/\//i.test(clean)) {
        flash('只支持 http(s) 公开图片 / 语音链接。');
        return;
      }
      if (clean.length > 500) {
        flash('链接太长，请使用更短的公开地址。');
        return;
      }
      const masked = desensitize(caption).text.trim().slice(0, 280);
      const isLocalReview = reviewId.startsWith('local-');
      const temp: ReviewMedia = {
        id: `local-m-${Date.now()}`,
        reviewId,
        ownerKey,
        kind,
        url: clean,
        caption: masked,
        createdAt: fmtTime(new Date()),
      };
      setState((s) => ({ ...s, media: [...s.media, temp] }));

      if (!state.backendOnline || isLocalReview) {
        flash(
          isLocalReview
            ? '这条复盘还没同步到平台，素材先保存在本机。'
            : '素材已保存在本机。平台恢复后再同步。'
        );
        return;
      }
      void apiAddMedia({
        reviewId,
        ownerKey,
        kind,
        url: clean,
        caption: masked,
        status: 'public',
      })
        .then(() => loadMedia(reviewId))
        .catch(() => flash('素材已保存在本机，但写平台失败。'));
    },
    [flash, ownerKey, state.backendOnline, loadMedia]
  );

  /** 删除自己的一条素材 */
  const removeMedia = useCallback(
    (id: string) => {
      const item = state.media.find((m) => m.id === id);
      if (!item || item.ownerKey !== ownerKey) return;
      setState((s) => ({
        ...s,
        media: s.media.filter((m) => m.id !== id),
      }));
      if (state.backendOnline && !id.startsWith('local-m-')) {
        void apiDeleteMedia({ id, ownerKey }).catch(() => {
          flash('删除失败；刷新后会恢复。');
          void loadMedia(item.reviewId);
        });
      }
    },
    [flash, ownerKey, state.backendOnline, state.media, loadMedia]
  );

  const markReview = useCallback(
    (reviewId: string) => {
      if (markedIds.includes(reviewId)) return;
      const next = [...markedIds, reviewId];
      setMarkedIds(next);
      writeMarked(next);
      setState((s) => ({
        ...s,
        markCounts: { ...s.markCounts, [reviewId]: (s.markCounts[reviewId] ?? 0) + 1 },
      }));
      if (state.backendOnline && !reviewId.startsWith('local-')) {
        void apiAddMark(reviewId, ownerKey).catch(() => undefined);
      }
      flash('已记录 1 个有效标记。单条反馈不直接改变公共知识。');
    },
    [flash, markedIds, ownerKey, state.backendOnline]
  );

  const refreshReviews = useCallback(() => {
    if (!state.backendOnline) {
      flash('当前是本地存储模式，校验池没有远端更新可拉取。');
      return;
    }
    void Promise.all([apiLoadReviews(), apiLoadMarkCounts()])
      .then(([rows, counts]) => {
        setState((s) => ({
          ...s,
          reviews: rows.map((r) => mapReviewRow(r)),
          markCounts: counts,
        }));
        flash('校验池已刷新。满 3 个有效标记的复盘会进入公共知识网络。');
      })
      .catch(() => {
        setState((s) => ({ ...s, backendOnline: false }));
        flash('刷新失败，已切到本地缓存。');
      });
  }, [flash, state.backendOnline]);

  /** 手动重新拉取 5 个读接口；逐项保留成功结果，失败项维持本机缓存 */
  const resync = useCallback(() => {
    if (state.syncing) return;
    setState((s) => ({ ...s, syncing: true }));
    void (async () => {
      const remote = await readRemote(ownerKey);
      const victories = remote.archiveRows
        .map((r) => mapVictoryRow(r))
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((v, i) => ({ ...v, no: i + 1 }));
      const reviews = remote.reviewRows.map((r) => mapReviewRow(r));
      setState((s) => {
        const mergedVictories = remote.probes[2].ok
          ? mergeVictories(victories, s.victories)
          : s.victories;
        const tasks = rowsToTasks(
          remote.taskRows,
          archivedIdsFromVictories(mergedVictories)
        );
        return {
          ...s,
          profile:
            remote.probes[0].ok && remote.profile
              ? remote.profile
              : s.profile,
          tasks: remote.probes[1].ok && tasks.length ? tasks : s.tasks,
          victories: mergedVictories,
          reviews: remote.probes[3].ok ? reviews : s.reviews,
          markCounts: remote.probes[4].ok ? remote.markCounts : s.markCounts,
          backendOnline: remote.online,
          apiProbes: remote.probes,
          lastSyncAt: Date.now(),
          syncing: false,
        };
      });
      flash(
        remote.online
          ? `已重新同步：${remote.okCount}/5 个读接口可用。`
          : '平台接口暂不可用，继续使用本机缓存。'
      );
    })().catch(() => {
      setState((s) => ({ ...s, syncing: false, backendOnline: false }));
      flash('同步失败，已保留本机缓存。');
    });
  }, [flash, ownerKey, state.syncing]);

  const restart = useCallback(() => {
    setState((s) => ({
      ...s,
      profile: { ...DEFAULT_PROFILE, s: { ...DEFAULT_PROFILE.s } },
      tasks: [],
      victories: [],
      lastArchive: null,
      snapshot0: null,
      discussions: [],
      discussionLoaded: [],
      discussionStats: [],
      media: [],
      mediaLoaded: [],
      pool: [],
      step: 1,
      maxStep: 1,
      pick: null,
      intent: '',
      onlyFeasible: false,
      shortlist: [],
      filter: 'all',
      sub: 1,
      loadedNode: null,
      inactive: null,
    }));
    markLocalActive();
    flash('已复位。本次会话的任务、档案与漂移全部清空。');
  }, [flash]);

  const setNotice = useCallback((notice: string) => {
    setState((s) => ({ ...s, notice }));
  }, []);

  const currentStageObj = useCallback(() => currentStage(state.profile), [state.profile]);
  const currentRank = useCallback(() => ranked(state.profile.s, nodes), [nodes, state.profile.s]);

  const value = useMemo<YutuContextValue>(
    () => ({
      state,
      ownerKey,
      nodes,
      markedIds,
      setStep,
      setSub,
      setFilter,
      setOnlyFeasible,
      setPick,
      setIntent,
      toggleShortlist,
      clearShortlist,
      updateProfile,
      applyScores,
      updateScore,
      applyCity,
      loadNodeTasks,
      addCustomTask,
      updateTaskStatus,
      removeTask,
      archive,
      submitVictoryReview,
      submitExperienceCard,
      submitPeerSample,
      loadDiscussions,
      submitDiscussion,
      removeDiscussion,
      loadMedia,
      submitMedia,
      removeMedia,
      markReview,
      refreshReviews,
      resync,
      restart,
      flash,
      setNotice,
      currentStageObj,
      currentRank,
    }),
    [
      state,
      ownerKey,
      nodes,
      markedIds,
      setStep,
      setSub,
      setFilter,
      setOnlyFeasible,
      setPick,
      setIntent,
      toggleShortlist,
      clearShortlist,
      updateProfile,
      applyScores,
      updateScore,
      applyCity,
      loadNodeTasks,
      addCustomTask,
      updateTaskStatus,
      removeTask,
      archive,
      submitVictoryReview,
      submitExperienceCard,
      submitPeerSample,
      loadDiscussions,
      submitDiscussion,
      removeDiscussion,
      loadMedia,
      submitMedia,
      removeMedia,
      markReview,
      refreshReviews,
      resync,
      restart,
      flash,
      setNotice,
      currentStageObj,
      currentRank,
    ]
  );

  return <YutuContext.Provider value={value}>{children}</YutuContext.Provider>;
}

export function useYutu(): YutuContextValue {
  const ctx = useContext(YutuContext);
  if (!ctx) throw new Error('useYutu must be used inside YutuProvider');
  return ctx;
}

/** 供模型边界提示使用的模长 */
export function magnitudeOf(s: Scores) {
  return mag(s);
}
