import {
  ASSETS,
  CITIES,
  CITY_MAP,
  DIRECTIONS,
  STAGES,
  URBAN_LABEL,
  type Asset,
  type City,
  type Direction,
  type Stage,
  type StageId,
} from '@/data/catalog';
import type {
  AssetLevel,
  DimensionKey,
  FeasibilityResult,
  Profile,
  PrototypeNode,
  Scores,
} from '@/types';

/** 当前流程总步数：方向与推演并入归属摘要，闭环收紧为第 4 步 */
export const TOTAL_STEPS = 4;

export interface Dim {
  k: DimensionKey;
  n: string;
  lo: string;
  hi: string;
  min: number;
  max: number;
  w: number;
  derived?: boolean;
  unit?: string;
}

/** 七维：年龄为原始岁数，其余 0–100 */
export const DIMS: Dim[] = [
  { k: 'place', n: '地理位置', lo: '县域乡镇', hi: '一线城市', min: 0, max: 100, w: 1.0, derived: true },
  { k: 'econ', n: '经济压力', lo: '完全没有负担', hi: '必须立刻赚钱', min: 0, max: 100, w: 1.25 },
  { k: 'family', n: '家庭负担', lo: '无赡养抚养', hi: '责任很重', min: 0, max: 100, w: 1.15 },
  { k: 'age', n: '年龄', lo: '18 岁', hi: '45 岁', min: 18, max: 45, w: 0.85, derived: true, unit: '岁' },
  { k: 'cycle', n: '行业周期', lo: '收缩期', hi: '扩张期', min: 0, max: 100, w: 0.9 },
  { k: 'inertia', n: '认知惯性', lo: '稳健型', hi: '探索型', min: 0, max: 100, w: 1.05 },
  { k: 'history', n: '体验历史', lo: '尚未开始', hi: '大量积累', min: 0, max: 100, w: 0.8 },
];

export { CITY_MAP };

export const DIM_MAP = Object.fromEntries(DIMS.map((d) => [d.k, d])) as Record<
  DimensionKey,
  Dim
>;

/**
 * 模型参数集中管理，便于回归对照与后续校准。
 * ⚠️ 以下阈值均为启发式缺省，尚未用外部样本校准；改动会直接影响归属与可行性结果。
 */
export const MODEL_PARAMS = {
  /** 地理维度：岗位密度与生活成本的加权（原 0.7 / 0.3） */
  placeJobs: 0.7,
  placeCost: 0.3,
  /** 综合相似度：方向余弦 vs 强度接近度 */
  simDirWeight: 0.75,
  simStrengthWeight: 0.25,
  /** 向量模长低于此值时收缩相似度，表达“信息不足、尚未落定” */
  simMagRef: 0.5,
  /** 过渡带：与第一名综合相似度的绝对差 */
  bandEps: 0.06,
  /** 稳定度：与第二名的相对差距阈值 */
  stableHigh: 0.15,
  stableMid: 0.06,
  /** 中性区：模长低于此值视为归属未定 */
  neutralMag: 0.35,
  /** 可行性判定的条件阈值 */
  feasCityJobsLow: 40,
  feasEconHigh: 65,
  feasFamilyHigh: 70,
  feasAgeReset: 30,
  feasReliefEcon: 35,
  feasReliefFamily: 35,
} as const;

export function norm(k: DimensionKey, v: number): number {
  return k === 'age' ? ((v - 18) / 27) * 100 : v;
}

export function vec(s: Scores): number[] {
  return DIMS.map((d) => norm(d.k, s[d.k]));
}

/** 带权余弦：各维以 50 为中心、按权重缩放后比较方向 */
export function cosSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const w = DIMS[i].w;
    const x = ((a[i] - 50) / 50) * w;
    const y = ((b[i] - 50) / 50) * w;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na < 1e-9 || nb < 1e-9) return 0;
  return dot / Math.sqrt(na * nb);
}

export function mag(s: Scores): number {
  const v = vec(s);
  let t = 0;
  for (let i = 0; i < v.length; i++) {
    const x = ((v[i] - 50) / 50) * DIMS[i].w;
    t += x * x;
  }
  return Math.sqrt(t);
}

/**
 * 综合相似度 = 方向余弦 + 强度接近度，并按自身向量模长收缩。
 * - 方向：原有带权余弦（只看各维相对 50 的偏向）
 * - 强度：两边模长的接近程度，缓解“方向相同但处境严峻度差异大”
 * - 收缩：自身接近中性（信息不足）时整体变小，表达“尚未落定”
 */
export function pairSimilarity(a: Scores, b: Scores): number {
  const cos = cosSim(vec(a), vec(b));
  const ma = mag(a);
  const mb = mag(b);
  const maxM = Math.max(ma, mb);
  const strength =
    maxM < 1e-9 ? 0 : Math.max(0, 1 - Math.abs(ma - mb) / maxM);
  const blended =
    MODEL_PARAMS.simDirWeight * Math.max(0, cos) +
    MODEL_PARAMS.simStrengthWeight * strength;
  /* 收缩用平方根，避免中性用户直接被压到“看起来毫无相似”的极低值 */
  const shrink = Math.min(1, Math.sqrt(ma / MODEL_PARAMS.simMagRef));
  return blended * shrink;
}

export function similarityOf(s: Scores, node: PrototypeNode): number {
  return pairSimilarity(s, node.s);
}

export function cityById(id: string): City {
  return CITY_MAP[id] ?? CITY_MAP.chengdu;
}

/** 城市近似属性的展示档位：界面不展示精确数字，避免被当成统计值 */
export function bandOf(v: number): '高' | '中' | '低' {
  return v >= 80 ? '高' : v >= 55 ? '中' : '低';
}

/** 启发式相似度的展示档位：不把未校准分数当概率 */
export function simBand(v: number): '相近' | '过渡' | '较远' {
  return v >= 0.62 ? '相近' : v >= 0.38 ? '过渡' : '较远';
}

export function simBandTone(v: number): 'c' | 'w' | 'r' {
  return v >= 0.62 ? 'c' : v >= 0.38 ? 'w' : 'r';
}

export function placeFrom(cityId: string, urban: Profile['urban']): number {
  const c = cityById(cityId);
  const adj = (URBAN_LABEL[urban] ?? URBAN_LABEL.core).adj;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        c.jobs * MODEL_PARAMS.placeJobs + c.cost * MODEL_PARAMS.placeCost + adj
      )
    )
  );
}

/** 阶段判定：身份优先，再由年龄与体验积累细分 */
export function currentStage(p: Profile): Stage {
  const age = p.s.age;
  const work = p.identity === 'work';
  const hist = p.s.history;
  if (!work) return STAGES[0];
  const cands = STAGES.filter(
    (st) => st.id !== 'explore' && age >= st.ageMin && age <= st.ageMax
  );
  if (!cands.length) {
    return age < STAGES[1].ageMin ? STAGES[1] : STAGES[STAGES.length - 1];
  }
  let pick = cands[cands.length - 1];
  if (hist >= 65 && pick.id === 'entry') pick = STAGES[2];
  if (hist <= 25 && pick.id === 'pivot' && age <= 28) pick = STAGES[1];
  return pick;
}

export function stageReason(p: Profile): string {
  const work = p.identity === 'work';
  return `年龄 ${p.s.age} 岁 ｜ ${work ? '已工作' : '在校/待业'} ｜ 体验积累 ${p.s.history}/100`;
}

export interface FeasibleOption {
  dir: Direction;
  f: FeasibilityResult;
}

/** 可行性：只做条件判定，不做结果预测 */
export function feasibility(dir: Direction, p: Profile): FeasibilityResult {
  const c = cityById(p.city);
  const { econ, family, age } = p.s;
  const reasons: string[] = [];
  let score = dir.feasible === 'high' ? 2 : dir.feasible === 'mid' ? 1 : 0;
  const has = (t: (typeof dir.traits)[number]) => dir.traits.includes(t);
  if (c.jobs < MODEL_PARAMS.feasCityJobsLow && has('job')) {
    score -= 1;
    reasons.push(`本地岗位密度仅 ${c.jobs}，供给有限`);
  }
  if (econ >= MODEL_PARAMS.feasEconHigh && has('cash')) {
    score -= 1;
    reasons.push(`经济压力 ${econ}，难以承受非收入期`);
  }
  if (family >= MODEL_PARAMS.feasFamilyHigh && has('time')) {
    score -= 1;
    reasons.push(`家庭负担 ${family}，大块时间难以挤出`);
  }
  if (age >= MODEL_PARAMS.feasAgeReset && has('reset')) {
    score -= 1;
    reasons.push(`年龄 ${age}，归零类路径代价上升`);
  }
  if (
    econ <= MODEL_PARAMS.feasReliefEcon &&
    family <= MODEL_PARAMS.feasReliefFamily &&
    score < 2
  ) {
    score += 1;
    reasons.push('经济与家庭约束较轻，可承受试错');
  }
  score = Math.max(0, Math.min(2, score));
  return { level: score === 2 ? 'high' : score === 1 ? 'mid' : 'low', reasons };
}

export const FEAS_LABEL = {
  high: { t: '当前可做', cls: 'y-chip-c' },
  mid: { t: '需补条件', cls: 'y-chip-w' },
  low: { t: '条件不足', cls: 'y-chip-r' },
} as const;

/** 一次性资源存量：由当前处境推导，不做预测 */
export function assetLevel(a: Asset, p: Profile): AssetLevel {
  if (a.id === 'fresh') {
    const work = p.identity === 'work';
    const { age, history } = p.s;
    if (!work) {
      return {
        pct: 100,
        label: '完整保留',
        tone: 'full',
        why: '在校/待业，尚未落实工作单位，校招与考编通道都还开着。',
      };
    }
    if (history <= 30 && age <= 25) {
      return {
        pct: 45,
        label: '部分保留',
        tone: 'part',
        why: '已工作但年限尚浅，若仍在择业期两年内可能按应届认定，需按岗位口径核实。',
      };
    }
    return {
      pct: 0,
      label: '已消耗',
      tone: 'none',
      why: '已落实工作单位且超出择业期，校招专项通道通常不再适用。',
    };
  }
  if (a.id === 'upgrade') {
    if (p.identity !== 'work') {
      return { pct: 100, label: '完整保留', tone: 'full', why: '在校期间仍可报考统招专升本。' };
    }
    return {
      pct: 0,
      label: '已失效',
      tone: 'none',
      why: '已毕业，统招专升本报考资格不可恢复，后续只能走非全日制。',
    };
  }
  const load = p.s.econ * 0.5 + p.s.family * 0.3 + norm('age', p.s.age) * 0.2;
  const pct = Math.max(0, Math.min(100, Math.round(100 - load)));
  const tone: AssetLevel['tone'] = pct >= 55 ? 'full' : pct >= 28 ? 'part' : 'none';
  return {
    pct,
    label: pct >= 55 ? '较充裕' : pct >= 28 ? '偏紧' : '几乎没有',
    tone,
    why: `按经济压力 ${p.s.econ}、家庭负担 ${p.s.family}、年龄 ${p.s.age} 岁综合估算，仅反映当前条件。`,
  };
}

export interface RankedNode {
  node: PrototypeNode;
  sim: number;
}

/** 归属排序：自己的贡献节点不参与自己的计算 */
export function ranked(s: Scores, nodes: PrototypeNode[]): RankedNode[] {
  return nodes
    .filter((n) => !n.own)
    .map((node) => ({ node, sim: similarityOf(s, node) }))
    .sort((a, b) => b.sim - a.sim);
}

export function inBand(r: RankedNode[]): RankedNode[] {
  if (!r.length) return [];
  return r.slice(1).filter((x) => r[0].sim - x.sim < MODEL_PARAMS.bandEps);
}

/** 沃罗诺伊二维投影：横轴资源余量，纵轴探索倾向 */
export function proj(s: Scores): { x: number; y: number } {
  const res =
    (100 - s.econ) * 0.55 + (100 - norm('age', s.age)) * 0.2 + (100 - s.family) * 0.25;
  const exp = s.inertia * 0.6 + s.cycle * 0.25 + s.history * 0.15;
  return { x: 30 + (res / 100) * 460, y: 348 - (exp / 100) * 316 };
}

export interface SimContribution {
  k: DimensionKey;
  n: string;
  value: number;
}

/**
 * 把带权余弦拆到每一维，用于解释「为什么是这个域」。
 * 注意：这里只拆方向部分，不含强度项与低信息收缩，
 * 各项之和不等同于 similarityOf 的综合相似度。
 */
export function similarityBreakdown(s: Scores, node: PrototypeNode): SimContribution[] {
  const a = vec(s);
  const b = vec(node.s);
  let na = 0;
  let nb = 0;
  const parts = DIMS.map((d, i) => {
    const w = d.w;
    const x = ((a[i] - 50) / 50) * w;
    const y = ((b[i] - 50) / 50) * w;
    na += x * x;
    nb += y * y;
    return { k: d.k, n: d.n, value: x * y };
  });
  const denom = Math.sqrt(na * nb) || 1;
  return parts
    .map((p) => ({ ...p, value: p.value / denom }))
    .sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
}

export interface Stability {
  margin: number;
  mag: number;
  label: '高' | '中' | '低';
  tone: 'c' | 'w' | 'r';
  note: string;
}

/** 归属稳定度：绝对差用于展示，相对差用于判断是否只是边界摆动 */
export function stabilityOf(s: Scores, nodes: PrototypeNode[]): Stability {
  const r = ranked(s, nodes);
  const margin = r.length > 1 ? Math.max(0, r[0].sim - r[1].sim) : 1;
  const rel = r.length > 1 && r[0].sim > 1e-9 ? margin / r[0].sim : 1;
  const runnerUp = r[1]?.node.name.split(' · ')[0];
  const m = mag(s);
  let label: Stability['label'];
  if (m < MODEL_PARAMS.neutralMag) label = '低';
  else if (rel >= MODEL_PARAMS.stableHigh) label = '高';
  else if (rel >= MODEL_PARAMS.stableMid) label = '中';
  else label = '低';
  const tone: Stability['tone'] = label === '高' ? 'c' : label === '中' ? 'w' : 'r';
  const note =
    m < MODEL_PARAMS.neutralMag
      ? '各维接近中性，向量模长偏小；此时归属对 1 分变化敏感，请把它当作“尚未落定”，而不是确定标签。'
      : label === '高'
        ? '与第二名的相对差距明显，归属相对稳定。'
        : `与「${runnerUp ?? '邻近域'}」的差距较小，1 分变化就可能切换；它是一个过渡带，不是确定归属。`;
  return { margin, mag: m, label, tone, note };
}

export function clampDim(k: DimensionKey, v: number): number {
  const d = DIM_MAP[k];
  if (!d) return v;
  return Math.max(d.min, Math.min(d.max, Math.round(v)));
}

/** 把一组维度增量应用到向量上，返回新对象（不改原值） */
export function applyDrift(
  s: Scores,
  drift: Partial<Record<DimensionKey, number>>
): Scores {
  const next: Scores = { ...s };
  (Object.keys(drift) as DimensionKey[]).forEach((k) => {
    const delta = drift[k];
    if (delta) next[k] = clampDim(k, next[k] + delta);
  });
  return next;
}

export function nearestNode(snap: Scores, nodes: PrototypeNode[]): RankedNode {
  let best: RankedNode | null = null;
  nodes.forEach((node) => {
    if (node.own) return;
    const sim = similarityOf(snap, node);
    if (!best || sim > best.sim) best = { node, sim };
  });
  return best ?? { node: nodes[0], sim: 0 };
}

export function stageDirections(stage: StageId): Direction[] {
  return DIRECTIONS[stage] ?? [];
}

export function assets(): Asset[] {
  return ASSETS;
}

/** 闭环漂移表 */
export const DRIFT: Record<
  'keep' | 'revise' | 'rest' | 'switch',
  Partial<Record<DimensionKey, number>>
> = {
  keep: { history: 4, inertia: 1 },
  revise: { history: 4, inertia: 3 },
  rest: { history: 2, econ: -2 },
  switch: { history: 5, inertia: 6, cycle: 2 },
};

/**
 * 放弃一条体验任务同样是成长信息：它证明这条路你至少试过了。
 * 与归档相比增量更轻，且会略微降低探索惯性，避免「只加不减」让向量失真。
 */
export const DROP_DRIFT: Partial<Record<DimensionKey, number>> = {
  history: 2,
  inertia: -1,
};

export const CHOICE_LABEL = {
  keep: '维持方向',
  revise: '修改计划',
  rest: '暂时休整',
  switch: '更换方向',
} as const;

export const STATUS_LABEL = {
  doing: '进行中',
  done: '已完成',
  hold: '暂时搁置',
  drop: '选择放弃',
} as const;

/**
 * 长期不活跃衰减（脑图中「随时间自身滑落」的实现）：
 * 超过 30 天没有新的体验归档，体验历史小幅回落，认知惯性向稳健一端漂移。
 * 只在进入闭环时应用一次，界面上明确说明原因。
 */
export function applyInactivityDecay(
  s: Scores,
  lastActiveAt: number,
  now = Date.now()
): { s: Scores; days: number; applied: boolean } {
  const days = Math.floor((now - lastActiveAt) / 86400000);
  if (!lastActiveAt || days < 30) return { s, days, applied: false };
  const steps = Math.min(3, Math.floor(days / 30));
  return {
    days,
    applied: true,
    s: {
      ...s,
      history: clampDim('history', s.history - steps * 3),
      inertia: clampDim('inertia', s.inertia - steps * 2),
    },
  };
}

export function nearestCityByLonLat(lon: number, lat: number): { city: City; km: number } {
  let best = CITIES[0];
  let bestD = Infinity;
  CITIES.forEach((c) => {
    const g = GEO[c.id];
    if (!g) return;
    const dLon = (g[0] - lon) * Math.cos((lat * Math.PI) / 180) * 111;
    const dLat = (g[1] - lat) * 111;
    const d = Math.sqrt(dLon * dLon + dLat * dLat);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  });
  return { city: best, km: bestD };
}

/** 城市近似经纬度，仅用于定位示意 */
export const GEO: Record<string, [number, number]> = {
  beijing: [116.4, 39.9],
  shanghai: [121.5, 31.2],
  guangzhou: [113.3, 23.1],
  shenzhen: [114.1, 22.5],
  hangzhou: [120.2, 30.3],
  chengdu: [104.1, 30.7],
  wuhan: [114.3, 30.6],
  xian: [108.9, 34.3],
  chongqing: [106.6, 29.6],
  nanjing: [118.8, 32.1],
  qingdao: [120.4, 36.1],
  changsha: [113.0, 28.2],
  hefei: [117.3, 31.8],
  kunming: [102.7, 25.0],
  shenyang: [123.4, 41.8],
  lanzhou: [103.8, 36.1],
  mianyang: [104.7, 31.5],
  nanchong: [106.1, 30.8],
  ganzhou: [114.9, 25.8],
  zunyi: [106.9, 27.7],
  yulin: [109.7, 38.3],
  county: [107.5, 29.5],
  tianjin: [117.2, 39.1],
  shijiazhuang: [114.5, 38.0],
  taiyuan: [112.5, 37.9],
  dalian: [121.6, 38.9],
  changchun: [125.3, 43.9],
  harbin: [126.6, 45.8],
  suzhou: [120.6, 31.3],
  ningbo: [121.5, 29.9],
  fuzhou: [119.3, 26.1],
  xiamen: [118.1, 24.5],
  nanchang: [115.9, 28.7],
  jinan: [117.0, 36.7],
  zhengzhou: [113.6, 34.7],
  haikou: [110.2, 20.0],
  guiyang: [106.6, 26.6],
  lhasa: [91.1, 29.7],
  xining: [101.8, 36.6],
  yinchuan: [106.2, 38.5],
  urumqi: [87.6, 43.8],
  hohhot: [111.7, 40.8],
  nanning: [108.4, 22.8],
  taipei: [121.5, 25.0],
  hongkong: [114.2, 22.3],
  macau: [113.5, 22.2],
};

export const AREA_SPAN = 2.5;

export function fmtTime(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** 公共节点阈值：满 3 个不同用户标记有效 */
export const NEED = 3;
