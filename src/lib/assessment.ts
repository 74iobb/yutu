import type { Scores } from '@/types';

/** 结构化处境测量：用可观察事实与行为频率替代单项 0–100 自评。 */
export interface AssessmentAnswers {
  income: number; // 月收入（元）
  expense: number; // 月支出（元）
  savingsMonths: number; // 现有储蓄可支撑月数
  debtPct: number; // 每月债务还款占收入 %
  dependents: number; // 需赡养/抚养人数
  careHours: number; // 每周照护小时
  primaryEarner: boolean; // 是否主要经济支柱
  familyBurden: number; // 主观家庭负担 1–5
  industryTrend: number; // 招聘趋势 1–5（1 收缩，5 扩张）
  jobSecurity: number; // 工作稳定性 1–5
  explore: [number, number, number, number]; // 探索行为 4 题，1–5
  loops: number; // 完整走通的体验学习循环次数 0–3+
  projects: number; // 完成的小型验证项目数 0–10
}

export const DEFAULT_ASSESSMENT: AssessmentAnswers = {
  income: 4000,
  expense: 3500,
  savingsMonths: 3,
  debtPct: 20,
  dependents: 1,
  careHours: 16,
  primaryEarner: true,
  familyBurden: 4,
  industryTrend: 2,
  jobSecurity: 2,
  explore: [3, 3, 3, 4],
  loops: 0,
  projects: 3,
};

export interface AssessmentBreakdown {
  k: 'econ' | 'family' | 'cycle' | 'inertia' | 'history';
  label: string;
  text: string;
  value: number;
}

export interface AssessmentResult {
  scores: Pick<Scores, 'econ' | 'family' | 'cycle' | 'inertia' | 'history'>;
  breakdown: AssessmentBreakdown[];
  confidence: number;
  label: '高' | '中' | '低';
  notes: string[];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 量表权重集中管理。
 * ⚠️ 这些权重是按常识设定的启发式缺省，尚未用外部样本校准；
 * 调整后需要重跑 docs/MODEL.md 中的样例，观察各维分布是否仍可解释。
 */
export const SCALE_WEIGHTS = {
  econ: { expense: 0.4, runway: 0.35, debt: 0.25 },
  family: { dependents: 0.35, care: 0.3, earner: 0.15, subjective: 0.2 },
  cycle: { trend: 0.45, security: 0.35, city: 0.2 },
  history: { perLoop: 22, perProject: 6 },
} as const;

export function computeAssessment(
  a: AssessmentAnswers,
  cityJobs: number
): AssessmentResult {
  const income = Math.max(0, Number(a.income) || 0);
  const expense = Math.max(0, Number(a.expense) || 0);
  const savings = clamp(Number(a.savingsMonths) || 0, 0, 36);
  const debt = clamp(Number(a.debtPct) || 0);

  const ratio = income > 0 ? expense / income : expense > 0 ? 2 : 1;
  const expensePressure =
    income === 0 && expense === 0 ? 50 : clamp(((ratio - 0.5) / 0.5) * 100);
  const runwayRisk = clamp(((12 - savings) / 12) * 100);
  const wEcon = SCALE_WEIGHTS.econ;
  const econ = Math.round(
    wEcon.expense * expensePressure +
      wEcon.runway * runwayRisk +
      wEcon.debt * debt
  );

  const depScore = clamp((Number(a.dependents) || 0) / 4 * 100);
  const careScore = clamp((Number(a.careHours) || 0) / 40 * 100);
  const earnerScore = a.primaryEarner ? 100 : 35;
  const subjective = clamp(((Number(a.familyBurden) || 3) - 1) / 4 * 100);
  const wFamily = SCALE_WEIGHTS.family;
  const family = Math.round(
    wFamily.dependents * depScore +
      wFamily.care * careScore +
      wFamily.earner * earnerScore +
      wFamily.subjective * subjective
  );

  const trend = clamp(((Number(a.industryTrend) || 3) - 1) / 4 * 100);
  const security = clamp(((Number(a.jobSecurity) || 3) - 1) / 4 * 100);
  const wCycle = SCALE_WEIGHTS.cycle;
  const cycle = Math.round(
    wCycle.trend * trend + wCycle.security * security + wCycle.city * clamp(cityJobs)
  );

  const exploreScores = a.explore.map((v) => clamp((Number(v) - 1) / 4 * 100));
  const inertia = Math.round(
    exploreScores.reduce((x, y) => x + y, 0) / exploreScores.length
  );

  const loops = clamp(Number(a.loops) || 0, 0, 3);
  const projects = clamp(Number(a.projects) || 0, 0, 10);
  const history = Math.round(
    clamp(
      loops * SCALE_WEIGHTS.history.perLoop +
        projects * SCALE_WEIGHTS.history.perProject
    )
  );

  const notes: string[] = [];
  let confidence = 100;
  if (expense > income * 1.1 && savings >= 6) {
    confidence -= 20;
    notes.push('支出高于收入但储蓄可支撑半年以上，可能有一项填写不准确。');
  }
  if (new Set(a.explore).size === 1) {
    confidence -= 15;
    notes.push('探索行为的四项回答完全相同，可能没有区分不同场景。');
  }
  if ((Number(a.dependents) || 0) > 0 && (Number(a.careHours) || 0) === 0) {
    confidence -= 10;
    notes.push('有需照护成员但每周照护为 0，请核对。');
  }
  if (a.primaryEarner && income === 0) {
    confidence -= 10;
    notes.push('已选为主要经济支柱，但月收入为 0，请核对。');
  }
  if (a.industryTrend === 3 && a.jobSecurity === 3) {
    confidence -= 5;
    notes.push('行业趋势与工作稳定性都选了“持平/一般”，区分度较低。');
  }
  confidence = clamp(confidence);
  const label: AssessmentResult['label'] =
    confidence >= 80 ? '高' : confidence >= 55 ? '中' : '低';

  return {
    scores: {
      econ: clamp(Math.round(econ)),
      family: clamp(Math.round(family)),
      cycle: clamp(Math.round(cycle)),
      inertia: clamp(Math.round(inertia)),
      history,
    },
    breakdown: [
      {
        k: 'econ',
        label: '经济压力',
        value: econ,
        text: `支出压力 ${expensePressure.toFixed(0)} · 储备风险 ${runwayRisk.toFixed(
          0
        )} · 债务压力 ${debt.toFixed(0)} → ${econ}`,
      },
      {
        k: 'family',
        label: '家庭负担',
        value: family,
        text: `赡养/抚养 ${depScore.toFixed(0)} · 照护时长 ${careScore.toFixed(
          0
        )} · 经济支柱 ${earnerScore} · 主观负担 ${subjective.toFixed(0)} → ${family}`,
      },
      {
        k: 'cycle',
        label: '行业周期',
        value: cycle,
        text: `招聘趋势 ${trend.toFixed(0)} · 工作稳定 ${security.toFixed(
          0
        )} · 本地岗位密度 ${cityJobs} → ${cycle}`,
      },
      {
        k: 'inertia',
        label: '认知惯性',
        value: inertia,
        text: `四项探索行为平均 ${inertia} / 100（越高越偏探索型）`,
      },
      {
        k: 'history',
        label: '体验历史',
        value: history,
        text: `完整循环 ${loops} 次 ×22 + 小型验证 ${projects} 项 ×6 → ${history}`,
      },
    ],
    confidence,
    label,
    notes,
  };
}
