import type { ProvenanceKind } from './provenance';

/**
 * 按图表看依据：逐个登记界面里的数据展示块。
 *
 * 与 provenance.ts 的区别：
 * - provenance 按「数据性质」分组（REAL / SELF / CURATED / APPROX / HEURISTIC）；
 * - 本文件按「界面上的图表 / 数字」逐条说明它从哪来、够不够硬、缺什么。
 *
 * status 口径：
 * - grounded：有可核对来源，或来自用户的真实记录/行为；
 * - partial：有出处，但为近似值、工程规则、自评映射，或样本不足；
 * - unfounded：规则假设 / 未校准模型，**不能当事实对外陈述**。
 */

export type AuditPage =
  | '全局'
  | '第 1 步'
  | '第 2 步'
  | '第 3 步'
  | '第 4 步'
  | '沙盘';

export type AuditStatus = 'grounded' | 'partial' | 'unfounded';

export interface EvidenceAuditItem {
  id: string;
  name: string;
  page: AuditPage;
  kind: ProvenanceKind;
  status: AuditStatus;
  /** 界面位置或组件 */
  where: string;
  /** 它到底是什么、从哪来 */
  detail: string;
  /** 缺口是什么 */
  gap?: string;
  /** 怎么补：填表 / 接外部数据 / 校准 / 只能标注 */
  fix?: string;
  /** 可以在第 1 步「填写信息」里补到的数据 */
  intake?: boolean;
}

export const AUDIT_STATUS: Record<
  AuditStatus,
  { label: string; tone: 'c' | 'w' | 'r'; desc: string }
> = {
  grounded: {
    label: '有依据',
    tone: 'c',
    desc: '可核对，或来自你的真实记录 / 行为',
  },
  partial: {
    label: '部分依据',
    tone: 'w',
    desc: '有出处，但为近似值、工程规则、自评映射，或样本不足',
  },
  unfounded: {
    label: '无外部依据',
    tone: 'r',
    desc: '规则假设 / 未校准模型，不能当事实对外陈述',
  },
};

export const AUDIT_ITEMS: EvidenceAuditItem[] = [
  /* ------------------------------ 全局 ------------------------------ */
  {
    id: 'zhihu',
    name: '知乎原文与讨论',
    page: '全局',
    kind: 'real',
    status: 'grounded',
    where: '第 2 步讨论 / 第 3 步案例 / 沙盘检索',
    detail:
      '256 条一次性检索快照，保留标题、作者、摘要与可点击原文链接；不是运行时检索。',
    gap: '快照时间固定在 2026-11-19，不会随打开时间更新。',
    fix: '重跑 `scripts/refresh-zhihu-snapshot.py`；正式版改为运行时检索并处理失败与配额。',
  },
  {
    id: 'city',
    name: '城市岗位密度 / 生活成本',
    page: '全局',
    kind: 'approx',
    status: 'partial',
    where: '第 1 步城市选择 / 第 2 步地图 / 第 3 步作战图',
    detail:
      '46 城各有一个 0–100 的近似值，按常识填写；界面只展示高/中/低档位。',
    gap: '不是统计年鉴或招聘岗位数，无法用于对外陈述。',
    fix: '接公开统计（城镇就业、招聘岗位数、房租/生活成本指数），或保留档位并明确标 APPROX。',
  },
  {
    id: 'geo',
    name: '城市坐标与邻近城市',
    page: '全局',
    kind: 'approx',
    status: 'partial',
    where: '第 2 步 GIS / 第 3 步作战图',
    detail: '经纬度为近似值，部分为避免标记重叠做过人工微调；区域圈按公里近似绘制。',
    gap: '不能用于地理测量或距离结论。',
    fix: '改用权威经纬度与真实行政区边界；当前明确标注“近似示意”。',
  },
  {
    id: 'nodes',
    name: '环境原型与归属域',
    page: '全局',
    kind: 'curated',
    status: 'partial',
    where: '第 3 步归属 / 第 4 步闭环',
    detail: '7 个原型的七维与困扰清单是工程整理，不是真实人群样本；措辞参考了真实检索内容。',
    gap: '原型数量少，覆盖不到所有处境。',
    fix: '随着真实复盘与归档增多，把达到“3 个不同用户标记有效”的复盘升级为公共节点（已实现）。',
  },

  /* ------------------------------ 第 1 步 ------------------------------ */
  {
    id: 'profile7',
    name: '七维处境（城市/经济/家庭/年龄/周期/惯性/体验）',
    page: '第 1 步',
    kind: 'self',
    status: 'partial',
    where: '第 1 步右侧判定 / 各步雷达与摘要',
    detail:
      '由你填写的事实与行为频率计算；年龄与城市是硬值，其余是自评量表的加权映射。',
    gap: '经济压力、家庭负担、行业周期仍是自评映射，不是可核对的事实。',
    fix: '在第 1 步直接采集可核对事实：可动用现金能撑几个月、每周可投入小时、需赡养/抚养人数、行业招聘景气。',
    intake: true,
  },
  {
    id: 'stage',
    name: '阶段判定',
    page: '第 1 步',
    kind: 'heuristic',
    status: 'partial',
    where: '第 1 步判定卡 / 全站阶段标签',
    detail: '由年龄、身份、体验积累按固定区间推导；是起点，不是标签。',
    gap: '区间阈值未用外部样本校准。',
    fix: '需要真实人群的年龄—阶段分布校准；当前只作为导航，不作为结论。',
  },
  {
    id: 'scale',
    name: '结构化测量与填写质量',
    page: '第 1 步',
    kind: 'self',
    status: 'partial',
    where: '第 1 步「结构化测量」',
    detail: '5 组事实/行为指标，按公开权重换算；会提示矛盾与填写质量。',
    gap: '权重是工程缺省值，不是心理测量学量表。',
    fix: '保留自评定位，不入诊断；如要严谨，需要专家标注与信效度检验。',
  },

  /* ------------------------------ 第 2 步 ------------------------------ */
  {
    id: 'region',
    name: '城市近期讨论 / 区域证据',
    page: '第 2 步',
    kind: 'real',
    status: 'grounded',
    where: '第 2 步「讨论」页签 / 地图资料点',
    detail: '当前城市自己的知乎快照条目 + 蓝圈内邻近城市条目，按填写方向排序。',
    gap: '部分城市条目少；快照不实时。',
    fix: '扩充快照或运行时检索；无数据时保持如实空态，不回落成都。',
  },
  {
    id: 'flight',
    name: '地图飞线',
    page: '第 2 步',
    kind: 'approx',
    status: 'partial',
    where: '第 2 步 GIS / 第 3 步作战图',
    detail:
      '网络模式飞线表示岗位密度差；资料飞线表示“这条内容属于哪座城市”；不是“同路人去了哪里”。',
    gap: '没有“去向城市”数据，不能声称是同路人的真实下场。',
    fix: '新增去向城市字段 + 用户授权后再画“同路人去向”飞线；当前不使用假数据。',
  },

  /* ------------------------------ 第 3 步 ------------------------------ */
  {
    id: 'directions',
    name: '方向清单 / 前置条件 / 代价',
    page: '第 3 步',
    kind: 'curated',
    status: 'partial',
    where: '第 3 步方向卡 / 作战图',
    detail: '17 条方向的名称、前置条件、代价与张力是工程整理，不是外部样本。',
    gap: '没有真实成功率、薪资中位数等结果数据。',
    fix: '保持“条件是否就位”的判定；结果类数据需要真实跟踪，当前不展示。',
  },
  {
    id: 'feasibility',
    name: '可行性判定',
    page: '第 3 步',
    kind: 'curated',
    status: 'partial',
    where: '方向卡 / 作战图 / 摘要',
    detail: '按城市岗位密度、经济压力、家庭负担、年龄与方向特质做 ±1 评分，只判条件。',
    gap: '阈值是工程缺省，不是回归结果。',
    fix: '用真实归档结果校准阈值；当前明确“不代表对你的评价”。',
  },
  {
    id: 'assets',
    name: '一次性资源与窗口',
    page: '第 3 步',
    kind: 'curated',
    status: 'partial',
    where: '第 3 步作战图 / 摘要',
    detail: '“什么会消耗什么 / 何时失效”有知乎原文引用；存量百分比按处境推导。',
    gap: '存量公式未校准；界面只展示档位。',
    fix: '第 1 步补充可动用现金与时间，替代推导；规则原文继续保留。',
    intake: true,
  },
  {
    id: 'checklist',
    name: '执行清单（预算 / 风险 / 完成标准）',
    page: '第 3 步',
    kind: 'curated',
    status: 'partial',
    where: '第 3 步二阶检索 / 作战图',
    detail: '按方向特质拼接的预算、风险与最小验证建议，规则公开。',
    gap: '金额区间与周期是工程估计，不是当地实时价格。',
    fix: '接生活成本数据或让用户填预算；当前只给结构与量级。',
    intake: true,
  },

  /* ------------------------------ 第 4 步 ------------------------------ */
  {
    id: 'growth',
    name: '成长趋势 / 成长河 / 七维雷达',
    page: '第 4 步',
    kind: 'self',
    status: 'grounded',
    where: '档案墙「曲线」',
    detail: '只使用你自己每次归档的真实七维快照，时间与增量可回查。',
    gap: '归档次数少时曲线意义有限。',
    fix: '继续积累归档；空态明确提示至少一次归档。',
  },
  {
    id: 'similarity',
    name: '归属相似度 / 稳定度',
    page: '第 4 步',
    kind: 'heuristic',
    status: 'unfounded',
    where: '归属摘要 / 闭环 / 记忆时间线',
    detail: '方向余弦 0.75 + 强度接近度 0.25，并按模长收缩；阈值 0.62/0.38、稳定度 0.15/0.06/0.35。',
    gap: '参数未用外部样本校准；1 分变化就可能切换归属，不是概率。',
    fix: '需要真实样本 + 专家标注做校准；在此之前只显示“相近/过渡/较远”，不显示百分比。',
  },
  {
    id: 'peers',
    name: '同阶段去向 / 自填样本',
    page: '第 4 步',
    kind: 'self',
    status: 'partial',
    where: '同伴经验域',
    detail: '来自平台用户自愿填写的去向与归档选择，跨用户匿名计数；少于 5 条不显示比例。',
    gap: '自填、非随机、可能重复计入；不能代表总体。',
    fix: '继续积累并标注样本量；不要外推为“成功率”。',
  },
  {
    id: 'reviews',
    name: '公共复盘 / 讨论 / 素材',
    page: '第 4 步',
    kind: 'self',
    status: 'partial',
    where: '同伴经验域 + 校验池',
    detail: '用户提交的真实记录，提交前脱敏；有效标记满 3 个才作为公共节点。',
    gap: '内容未经事实核验；标记来自同伴主观判断。',
    fix: '保留“自填/未核验”标注；需要时增加来源与时间信息。',
  },
  {
    id: 'memory',
    name: '长期记忆接近度',
    page: '第 4 步',
    kind: 'heuristic',
    status: 'unfounded',
    where: '档案墙「记忆」/ 灵魂拷问',
    detail: '用同一套未校准的七维相似度，把历史归档、复盘、讨论按接近度排序。',
    gap: '排序依赖未校准模型；只能用于“回看”，不能当匹配结论。',
    fix: '随相似度模型一起校准；界面只用“相近 / 过渡 / 较远”档位，不显示百分比（2026-11-25 已统一到 `simBand`）。',
  },

  /* ------------------------------ 沙盘 ------------------------------ */
  {
    id: 'sandboxPreset',
    name: '沙盘预设动作效果',
    page: '沙盘',
    kind: 'curated',
    status: 'unfounded',
    where: '`#/sandbox` 动作面板 / 棋盘',
    detail: '6 个动作对七维的增量（如试水 体验+6/探索+2）是写死的规则假设。',
    gap: '没有样本均值、没有实验依据；数值不能当预测。',
    fix: '若要更硬，需要让用户记录动作与真实结果，再用归档数据校准；在此之前只作为“规则假设”。',
  },
  {
    id: 'sandboxResources',
    name: '沙盘现金缓冲 / 精力余量',
    page: '沙盘',
    kind: 'heuristic',
    status: 'unfounded',
    where: '`#/sandbox` 当前处境 / 每一步',
    detail: '按经济压力、家庭负担、年龄与身份用固定系数推导，0–100 的余量，不是金额。',
    gap: '系数是工程缺省，不能代表真实可支配现金或精力。',
    fix: '在第 1 步直接采集“可动用现金能撑几个月”“每周可投入小时”，用真实值替代推导。',
    intake: true,
  },
  {
    id: 'sandboxBaseline',
    name: '沙盘「维持现状」对照',
    page: '沙盘',
    kind: 'heuristic',
    status: 'unfounded',
    where: '`#/sandbox` 结果对照',
    detail: '每格体验历史 -2、探索惯性 -1、现金 -4、精力 +3，是固定假设。',
    gap: '没有真实“不行动”轨迹数据。',
    fix: '用未行动用户的回访数据校准；当前只作为对照，不是预测。',
  },
  {
    id: 'sandboxOutcome',
    name: '沙盘落点 / 七维变化 / 归属',
    page: '沙盘',
    kind: 'heuristic',
    status: 'unfounded',
    where: '`#/sandbox` 结果对照',
    detail: '终点由预设规则累加后套用同一套未校准相似度；自定义步骤只计时间成本。',
    gap: '不代表现实结果；自定义步骤的七维变化系统不推断。',
    fix: '保持“规则推演”定位；不展示概率/成功率；需要校准时与相似度模型一起做。',
  },
  {
    id: 'sandboxEvidence',
    name: '自定义路径的真实原文',
    page: '沙盘',
    kind: 'real',
    status: 'grounded',
    where: '`#/sandbox` 自定义一步',
    detail: '按你写的文字在 256 条语料中做关键词检索，展示标题、来源、摘要与原文链接。',
    gap: '命中是文字包含匹配，不是语义检索；没命中时不给结论。',
    fix: '扩充语料或接语义检索；当前保持“没命中就如实说”。',
  },
  {
    id: 'defaultProfile',
    name: '新用户初始档案',
    page: '第 1 步',
    kind: 'curated',
    status: 'unfounded',
    where: '第 1 步顶部 / 沙盘页头（maxStep < 2）',
    detail: '默认值（南充 · 22 岁 · 土木 · 经济 68 等）是模板，不是用户数据。',
    gap: '不提示会被误当成真实处境。',
    fix: '第 1 步在档案仍等于模板时显示“当前是初始示例”，改动后自动消失；沙盘在 maxStep < 2 时同样提示。',
  },
];

export const AUDIT_COUNTS = AUDIT_ITEMS.reduce(
  (acc, item) => {
    acc[item.status] += 1;
    return acc;
  },
  { grounded: 0, partial: 0, unfounded: 0 } as Record<AuditStatus, number>
);

export const AUDIT_INTAKE_ITEMS = AUDIT_ITEMS.filter((i) => i.intake);
