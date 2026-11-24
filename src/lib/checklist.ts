import type { City, Direction, StageId } from '@/data/catalog';
import { bandOf } from '@/lib/model';
import type { Profile } from '@/types';

/**
 * 方向执行清单（规则版）。
 *
 * 完全体里这里应由 LLM + 二阶检索生成；当前平台没有 LLM，
 * 所以只从**已有数据**推导：方向名、前置条件、traits、城市岗位/成本、阶段。
 * 不编具体薪资、不承诺结果，只把「要补什么 / 成本在哪 / 坑在哪」摊开。
 */

export interface DirectionChecklist {
  skills: string[];
  budget: string;
  risks: string[];
  firstMoves: string[];
}

function has(dir: Direction, t: Direction['traits'][number]) {
  return dir.traits.includes(t);
}

function nameHas(dir: Direction, ...words: string[]) {
  return words.some((w) => dir.name.includes(w));
}

export function buildChecklist(
  dir: Direction,
  profile: Profile,
  city: City,
  stage: StageId
): DirectionChecklist {
  const skills: string[] = [];

  if (nameHas(dir, '学历', '考研', '升本', '升学', '留学', '读博')) {
    skills.push(
      '目标院校/专业的考试科目、分数线与报录比',
      '英语与专业课基础（先做一套真题定位）',
      '报名、初试、复试的完整时间线'
    );
  } else if (nameHas(dir, '考证', '证书', '执照', '资格')) {
    skills.push(
      '目标证书的报考条件与考试科目',
      '证书对应的岗位实操能力（只有证不够）'
    );
  } else if (
    nameHas(dir, '转行', '转岗', '换行', '跨行', '第二曲线', '副业')
  ) {
    skills.push(
      '目标岗位的 2–3 项硬技能',
      '一个能拿出手的作品或可验证项目',
      '目标行业的招聘口径与常见面试题'
    );
  } else if (nameHas(dir, '创业', '私活', '接单', '自由职业', '数字游民')) {
    skills.push(
      '一项可对外交付的服务或产品',
      '获客渠道与定价方式',
      '最小可运行的成本结构'
    );
  } else if (nameHas(dir, '现岗位', '纵深', '内部', '管理', '带团队')) {
    skills.push(
      '当前岗位的核心产出指标',
      '内部转岗/晋升的显性规则与决策人',
      '跨部门协作或带人的实际经历'
    );
  } else {
    skills.push(
      '这条路径每天真实在做什么',
      '一项可验证的入门技能',
      '入行的最低门槛与常见筛选方式'
    );
  }

  let budget: string;
  if (has(dir, 'cash')) {
    budget = `按${city.name}生活成本（${bandOf(
      city.cost
    )}）+ 3–6 个月非收入期估算。先算清每月最低现金流与可动用存款，再决定能承受几轮试错。`;
  } else if (has(dir, 'time')) {
    budget = `主要是时间成本：每周可投入小时数 × 预计周期。建议先按 8 周做一次最小验证，再决定是否加码。`;
  } else {
    budget = `以业余投入为主，现金成本相对低。仍需预留课程、材料、考试或差旅费用，避免一次性大额支出。`;
  }

  const risks: string[] = [];
  if (has(dir, 'job')) {
    risks.push(
      `本地岗位密度 ${bandOf(
        city.jobs
      )}：投递前先核实真实在招数量，别只看行业新闻`
    );
  }
  if (has(dir, 'cash')) {
    risks.push('现金流断档：非收入期往往比计划更长');
  }
  if (has(dir, 'time')) {
    risks.push('家庭与工作时间挤占，计划容易在第三个月停摆');
  }
  if (has(dir, 'reset')) {
    risks.push('归零类路径会折价既有经验，年龄越大越明显');
  }
  if (nameHas(dir, '学历', '考研', '升本', '升学')) {
    risks.push('学历提升周期长，毕业时的岗位窗口可能已经变化');
  }
  if (nameHas(dir, '考证', '证书')) {
    risks.push('证书不等于岗位：缺少实操时，加成有限');
  }
  if (nameHas(dir, '创业', '私活', '自由职业')) {
    risks.push('收入波动大，需先设现金流底线与止损点');
  }
  risks.push(`前置条件未满足时，整条路径会卡住：${dir.prereq}`);

  const firstMoves = [
    `用 1 周核实前置条件：${dir.prereq}`,
    '找 2 位已经走过这条路的人各聊 30 分钟，问清真实代价',
    '做一个 8 周内能验证的最小动作，并写清验证标准',
  ];
  if (profile.s.econ >= 60) {
    firstMoves.push('先算最低现金流，确认能承受几个月的非收入期');
  }
  if (stage === 'anchor') {
    firstMoves.push('把家庭责任与时间余量摊开，和家人对齐最低共识');
  }

  return { skills, budget, risks, firstMoves };
}
