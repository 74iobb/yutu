import { SIX_BODY_TYPES, type Identity } from '@/data/catalog';
import { applyDrift, norm } from '@/lib/model';
import type { DimensionKey, Scores } from '@/types';

/**
 * 沙盘推演：确定性规则，不含随机数。
 * 每一格代表一个季度；动作效果写在数据里，界面必须原样展示。
 * ⚠️ 这是启发式推演，不是预测，也不回写真实处境 / 档案。
 */

export const SANDBOX_ROUNDS = 6;
export const SANDBOX_QUARTER_MONTHS = 3;

export type SandboxActionId =
  | 'trial'
  | 'drill'
  | 'expand'
  | 'leverage'
  | 'rest'
  | 'settle';

export interface SandboxAction {
  id: SandboxActionId;
  name: string;
  /** 棋子上的单字 */
  code: string;
  brief: string;
  /** 正数=消耗，负数=回补 */
  cost: { cash: number; energy: number };
  drift: Partial<Record<DimensionKey, number>>;
  /** 棋盘 / 卡片强调色 */
  hue: string;
  /** 采纳为任务时的六体分类 */
  taskType: (typeof SIX_BODY_TYPES)[number];
  /** 采纳为任务时的标题模板，{dir} 会被替换成当前选定方向 */
  taskTitle: string;
}

export const SANDBOX_ACTIONS: SandboxAction[] = [
  {
    id: 'trial',
    name: '小步试水',
    code: '试',
    brief: '用一次最小验证换真实反馈',
    cost: { cash: 6, energy: 8 },
    drift: { history: 6, inertia: 2 },
    hue: '#6fd3e8',
    taskType: '团队体验',
    taskTitle: '在「{dir}」上做一次 4 周内可完成的最小验证',
  },
  {
    id: 'drill',
    name: '集中深练',
    code: '练',
    brief: '把一块能力练到能独立出活',
    cost: { cash: 12, energy: 14 },
    drift: { history: 10, cycle: 2, inertia: 1 },
    hue: '#7fb6ff',
    taskType: '营利组织体验',
    taskTitle: '为「{dir}」连续 6 周补一块能独立出活的硬技能',
  },
  {
    id: 'expand',
    name: '向外拓展',
    code: '拓',
    brief: '换城或扩到更大的圈层',
    cost: { cash: 16, energy: 10 },
    drift: { place: 8, history: 5, inertia: 3 },
    hue: '#b79cff',
    taskType: '全球事务体验',
    taskTitle: '把「{dir}」的触达范围扩到邻近城市或更大的圈层',
  },
  {
    id: 'leverage',
    name: '借力加速',
    code: '借',
    brief: '用兼职、跳槽或预算换时间',
    cost: { cash: -9, energy: 16 },
    drift: { econ: 7, history: 3, inertia: 4 },
    hue: '#f5c15a',
    taskType: '创新创业体验',
    taskTitle: '为「{dir}」准备一笔可承受的试错预算并设定止损线',
  },
  {
    id: 'rest',
    name: '停靠休整',
    code: '息',
    brief: '恢复精力，把这一段写下来',
    cost: { cash: -6, energy: -16 },
    drift: { econ: -4, family: -2, history: 2 },
    hue: '#8fd6c0',
    taskType: '亲情体验',
    taskTitle: '留出一段恢复期，把这一轮的体验写成复盘',
  },
  {
    id: 'settle',
    name: '收束定盘',
    code: '定',
    brief: '停止摇摆，把方向拆成小目标',
    cost: { cash: 8, energy: 9 },
    drift: { history: 8, inertia: -4, cycle: 1 },
    hue: '#ffd6a5',
    taskType: '非营利组织体验',
    taskTitle: '把「{dir}」拆成 3 个可验证的小目标并排期',
  },
];

export const SANDBOX_ACTION_MAP = Object.fromEntries(
  SANDBOX_ACTIONS.map((a) => [a.id, a])
) as Record<SandboxActionId, SandboxAction>;

/** 时间成本：每一格经济压力 +1，不论是否行动 */
export const ROUND_TICK: Partial<Record<DimensionKey, number>> = { econ: 1 };

/** 「维持现状」对照：体验历史回落、探索惯性下降、现金缓慢消耗、精力略有恢复 */
export const BASELINE_TICK: Partial<Record<DimensionKey, number>> = {
  history: -2,
  inertia: -1,
  econ: 1,
};
const BASELINE_CASH = -4;
const BASELINE_ENERGY = 3;

export interface SandboxResources {
  cash: number;
  energy: number;
}

export function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 由真实处境推导两条会枯竭的资源（0–100 的余量，不是金额） */
export function initialResources(s: Scores, identity: Identity): SandboxResources {
  const ageN = norm('age', s.age);
  const work = identity === 'work' ? 1 : 0;
  return {
    cash: clampPct(100 - s.econ * 0.52 - s.family * 0.22 - work * 6),
    energy: clampPct(
      100 - s.family * 0.3 - s.econ * 0.18 - ageN * 0.12 - work * 10
    ),
  };
}

export interface SandboxStep {
  idx: number;
  action: SandboxActionId;
  before: Scores;
  after: Scores;
  cashBefore: number;
  energyBefore: number;
  cashAfter: number;
  energyAfter: number;
  /** 规则允许但会透支：界面需提示，不允许这样落子 */
  blocked: boolean;
}

export interface SandboxRun {
  start: Scores;
  steps: SandboxStep[];
  final: Scores;
  cash: number;
  energy: number;
  base: SandboxResources;
  /** 第一个会透支的格序号（0 基），没有则为 -1 */
  blockedAt: number;
}

export function simulateSandbox(
  start: Scores,
  picks: SandboxActionId[],
  identity: Identity
): SandboxRun {
  const base = initialResources(start, identity);
  let s: Scores = { ...start };
  let cash = base.cash;
  let energy = base.energy;
  const steps: SandboxStep[] = [];
  let blockedAt = -1;

  picks.slice(0, SANDBOX_ROUNDS).forEach((actionId, idx) => {
    const act = SANDBOX_ACTION_MAP[actionId];
    if (!act) return;
    const cashDelta = -act.cost.cash;
    const energyDelta = -act.cost.energy;
    const blocked =
      cash + cashDelta < 0 || energy + energyDelta < 0;
    if (blocked && blockedAt < 0) blockedAt = idx;

    const cashBefore = cash;
    const energyBefore = energy;
    cash = clampPct(cash + cashDelta);
    energy = clampPct(energy + energyDelta);

    const before = s;
    const after = applyDrift(applyDrift(before, act.drift), ROUND_TICK);
    s = after;

    steps.push({
      idx,
      action: actionId,
      before,
      after,
      cashBefore,
      energyBefore,
      cashAfter: cash,
      energyAfter: energy,
      blocked,
    });
  });

  return { start, steps, final: s, cash, energy, base, blockedAt };
}

export interface SandboxBaselineRun {
  final: Scores;
  cash: number;
  energy: number;
}

/** 什么都不做：同样的格数，只让时间发生 */
export function simulateBaseline(
  start: Scores,
  identity: Identity,
  rounds: number
): SandboxBaselineRun {
  const base = initialResources(start, identity);
  let s: Scores = { ...start };
  let cash = base.cash;
  let energy = base.energy;
  const n = Math.max(0, Math.min(SANDBOX_ROUNDS, rounds));
  for (let i = 0; i < n; i++) {
    s = applyDrift(s, BASELINE_TICK);
    cash = clampPct(cash + BASELINE_CASH);
    energy = clampPct(energy + BASELINE_ENERGY);
  }
  return { final: s, cash, energy };
}

/** 行动在当前资源下是否可落子 */
export function canAfford(
  act: SandboxAction,
  res: SandboxResources
): { ok: boolean; reason?: string } {
  if (res.cash - act.cost.cash < 0) {
    return { ok: false, reason: `现金缓冲不足（需 ${act.cost.cash}）` };
  }
  if (res.energy - act.cost.energy < 0) {
    return { ok: false, reason: `精力不足（需 ${act.cost.energy}）` };
  }
  return { ok: true };
}

/** 规则补满：只解决「现金 / 精力 / 体验积累」三个显性缺口，不做最优解 */
export function recommendAction(
  s: Scores,
  res: SandboxResources
): SandboxActionId {
  if (res.cash < 22 || res.energy < 26) return 'rest';
  if (s.history < 40) return 'trial';
  if (s.history < 55) return 'drill';
  if (s.inertia > 65) return 'settle';
  if (s.place < 45) return 'expand';
  return 'drill';
}

export function formatCost(v: number): string {
  if (!v) return '±0';
  return v > 0 ? `-${v}` : `+${Math.abs(v)}`;
}

/** 动作对七维的净效果文案（含时间成本） */
export function effectText(
  drift: Partial<Record<DimensionKey, number>>
): string {
  const names: Record<DimensionKey, string> = {
    place: '地理',
    econ: '经济压力',
    family: '家庭负担',
    age: '年龄',
    cycle: '行业周期',
    inertia: '探索惯性',
    history: '体验历史',
  };
  return (Object.keys(drift) as DimensionKey[])
    .filter((k) => drift[k])
    .map((k) => `${names[k]} ${drift[k]! > 0 ? '+' : ''}${drift[k]}`)
    .join(' · ');
}
