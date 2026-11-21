/**
 * 域途 · 内容数据层
 * 来源标注：
 * - REAL：知乎开放平台一次性检索取得的快照，保留原文链接
 * - APPROX：按公开统计/常识填写的近似示意值
 * - DEMO：演示用示意数据，界面已明确标注
 */

export type StageId = 'explore' | 'entry' | 'pivot' | 'anchor';
export type Urban = 'core' | 'suburb' | 'county';
export type Identity = 'study' | 'work';
export type Feasibility = 'high' | 'mid' | 'low';

export interface Stage {
  id: StageId;
  name: string;
  ageMin: number;
  ageMax: number;
  desc: string;
}

/**
 * 可行性判定使用的显式条件标签。
 * 以前按方向名称做正则匹配，改文案就会改变判定；现在条件写在数据上。
 */
export type DirectionTrait = 'job' | 'cash' | 'time' | 'reset';

export interface Direction {
  name: string;
  feasible: Feasibility;
  note: string;
  prereq: string;
  /** job=依赖本地岗位供给，cash=需承受非收入/投入期，time=需大块时间，reset=归零类路径 */
  traits: DirectionTrait[];
}

export interface CaseItem {
  title: string;
  url: string;
  kind: string;
  gist: string;
}

export interface City {
  id: string;
  name: string;
  /** 省级行政区（含直辖市、自治区、特别行政区） */
  province: string;
  tier: string;
  jobs: number;
  cost: number;
  x: number;
  y: number;
}

export interface Evidence {
  quote: string;
  title: string;
  url: string;
}

export interface Asset {
  id: 'fresh' | 'upgrade' | 'window';
  name: string;
  desc: string;
  rule: string;
  expiry: string;
  consumedBy: string[];
  evidence: Evidence[];
}

export interface Tension {
  a: string;
  b: string;
  kind: 'exclusive' | 'conditional' | 'shared';
  note: string;
  basis: string;
  url: string;
}

export interface FieldCase {
  key: string;
  label: string;
  kw: RegExp;
  loose?: RegExp;
  items: CaseItem[];
}

export const STAGES: Stage[] = [
  {
    id: 'explore',
    name: '在校探索期',
    ageMin: 16,
    ageMax: 23,
    desc: '身份尚未定型，试错成本最低，核心任务是把下游岗位摊开看清。',
  },
  {
    id: 'entry',
    name: '初入职场期',
    ageMin: 22,
    ageMax: 27,
    desc: '第一份工作定调，核心任务是积累可迁移能力而非薪资最大化。',
  },
  {
    id: 'pivot',
    name: '转向抉择期',
    ageMin: 26,
    ageMax: 33,
    desc: '已有存量经验，核心任务是判断哪些能力可迁移、迁移窗口还剩多久。',
  },
  {
    id: 'anchor',
    name: '稳态深耕期',
    ageMin: 32,
    ageMax: 45,
    desc: '家庭与现金流约束变硬，核心任务是在可承受范围内做增量而非归零重来。',
  },
];

export const DIRECTIONS: Record<StageId, Direction[]> = {
  explore: [
    {
      name: '本专业对口就业',
      feasible: 'high',
      note: '路径最短，但需先确认对口岗位的真实日常是否可接受。',
      prereq: '能拿到实习或访谈渠道',
      traits: ['job'],
    },
    {
      name: '本专业横向岗位（如施工转造价）',
      feasible: 'high',
      note: '同一行业内换岗位，已有大量可查的真实转向记录。',
      prereq: '在校期间把软件或算量练到能独立出活',
      traits: ['job'],
    },
    {
      name: '专升本 / 考研提升学历',
      feasible: 'mid',
      note: '打开部分学历门槛，但会占用 1–3 年试错窗口。',
      prereq: '家庭现金流能支撑非收入期',
      traits: ['cash', 'time', 'reset'],
    },
    {
      name: '跨行业转技术岗',
      feasible: 'mid',
      note: '门槛对学历相对友好，但需要完整的自学闭环与作品。',
      prereq: '每周可稳定投入 10 小时以上',
      traits: ['job'],
    },
    {
      name: '考公 / 体制内',
      feasible: 'mid',
      note: '稳定性高，但岗位数量受本地编制规模限制。',
      prereq: '能承受较长备考期',
      traits: [],
    },
  ],
  entry: [
    {
      name: '在现单位积累可迁移能力',
      feasible: 'high',
      note: '成本最低的一条，关键是区分哪些经验出了这家公司还算数。',
      prereq: '能拿到核心业务的参与机会',
      traits: [],
    },
    {
      name: '同行业换更好的平台',
      feasible: 'high',
      note: '保留行业积累，只换平台，折价最小。',
      prereq: '已有 1 年以上可讲清的业绩',
      traits: ['job'],
    },
    {
      name: '行业内换职能方向',
      feasible: 'mid',
      note: '经验部分可迁移，需补齐新职能的硬技能。',
      prereq: '目标职能的技能缺口已盘点清楚',
      traits: [],
    },
    {
      name: '跨行业重启',
      feasible: 'low',
      note: '需要接受起点归零，窗口期随年龄收窄。',
      prereq: '有 6 个月以上的现金流缓冲',
      traits: ['cash', 'time', 'reset'],
    },
  ],
  pivot: [
    {
      name: '可迁移能力盘点后渐进迁移',
      feasible: 'high',
      note: '在交叉地带落脚，不必归零，是这一阶段最稳的路径。',
      prereq: '能列出 3 个交叉岗位与各自缺口',
      traits: [],
    },
    {
      name: '不离职做小规模验证',
      feasible: 'high',
      note: '用 8 周业余投入换一个明确结论，成本可控。',
      prereq: '每周 8 小时且不影响本职',
      traits: [],
    },
    {
      name: '考证换门槛',
      feasible: 'mid',
      note: '证书能开门但不能替代经验，需与实做并行。',
      prereq: '目标岗位确实把证书作为硬门槛',
      traits: ['cash'],
    },
    {
      name: '彻底转行',
      feasible: 'low',
      note: '房贷与家庭责任会放大失败代价，社区成功案例常未披露家庭支持条件。',
      prereq: '算清最低现金流底线并与家人对齐',
      traits: ['cash', 'time', 'reset'],
    },
  ],
  anchor: [
    {
      name: '现岗位纵深 + 内部转岗',
      feasible: 'high',
      note: '存量经验利用率最高，风险最低。',
      prereq: '单位内部有可见的通道',
      traits: ['job'],
    },
    {
      name: '业余第二曲线',
      feasible: 'mid',
      note: '只选能在碎片时间闭环的最小单元，先记录两周真实可用时间。',
      prereq: '家庭已知情并同意',
      traits: [],
    },
    {
      name: '转管理或带团队',
      feasible: 'mid',
      note: '从做事转为带人，所需能力与原岗位不同。',
      prereq: '有带人或跨部门协作的实际经历',
      traits: ['job'],
    },
    {
      name: '创业 / 接私活',
      feasible: 'low',
      note: '收入波动大，需以现金流底线倒推可承受周期。',
      prereq: '有可自带的客户或渠道',
      traits: ['job', 'cash', 'time'],
    },
  ],
};

/** REAL：知乎开放平台检索快照 */
export const CASES: Record<StageId, CaseItem[]> = {
  explore: [
    {
      title: '25届大专生毕业生求职经历',
      url: 'https://zhuanlan.zhihu.com/p/1963253025431877608',
      kind: '亲历记述',
      gist: '记录了专科应届从投递到入职的完整过程，含被拒与调整方向的节点。',
    },
    {
      title: '专科的你毕业后怎么样了？',
      url: 'https://www.zhihu.com/question/268689633',
      kind: '亲历记述',
      gist: '大量专科毕业生的长期跟踪自述，可用于对照不同起点的实际走向。',
    },
    {
      title: '专科生找工作是一种什么体验？',
      url: 'https://www.zhihu.com/question/56125105',
      kind: '亲历记述',
      gist: '集中描述学历门槛在投递环节的具体表现，适合提前校准预期。',
    },
    {
      title: '大专毕业后2年的工作记录',
      url: 'https://zhuanlan.zhihu.com/p/2099129468950410411',
      kind: '亲历记述',
      gist: '按时间线记录毕业两年内的岗位变化，可见早期选择的连带影响。',
    },
  ],
  entry: [
    {
      title: '施工转造价的自述',
      url: 'https://zhuanlan.zhihu.com/p/29546968296',
      kind: '亲历记述',
      gist: '硕士毕业入职省城国企施工单位做技术，一年多后因常驻工地流动而转造价，已三年。',
    },
    {
      title: '施工转造价，结果是好的吗？',
      url: 'https://www.zhihu.com/question/365873976',
      kind: '亲历记述',
      gist: '顶岗实习进入施工单位，遇到愿意带人的师傅，记录了工地初期的真实观感与转向过程。',
    },
    {
      title: '献给造价新人：一位转行做造价朋友的自述',
      url: 'https://zhuanlan.zhihu.com/p/346888014',
      kind: '亲历记述',
      gist: '海投阶段面试销售、资料员、实习造价生，描述了入行难这一环的具体卡点。',
    },
  ],
  pivot: [
    {
      title: '土木工程转工程造价，有什么利弊呢？',
      url: 'https://www.zhihu.com/question/454344508',
      kind: '亲历记述',
      gist: '本科土木工民建方向，签约中字头央企后因商务缺人被挑去做商务，意外完成转向。',
    },
    {
      title: '那些从土木工程转行出去的前辈，现在怎么样了？',
      url: 'https://www.zhihu.com/question/312801231',
      kind: '亲历记述',
      gist: '第一学历大专、非全专升本，工作 12 年从测量放线做到即将再次跳槽的长期轨迹。',
    },
    {
      title: '我的造价师之路——一个外行转造价的心路历程',
      url: 'https://zhuanlan.zhihu.com/p/300156637',
      kind: '亲历记述',
      gist: '外行转造价，详述以教材为基础、视频辅助理解的备考方法与四门课的投入分配。',
    },
    {
      title: '土木往届生：网络安全赛道还向你敞开吗',
      url: 'https://zhuanlan.zhihu.com/p/-259860870334945436',
      kind: '个人推测',
      gist: '主张土木转网络安全可行，并区分大专与本科可解锁的方向数量。含明显招生推广立场，仅作线索。',
    },
  ],
  anchor: [
    {
      title: '那些从土木工程转行出去的前辈，现在怎么样了？',
      url: 'https://www.zhihu.com/question/312801231',
      kind: '亲历记述',
      gist: '含多位工作十年以上者的转向记录，可见家庭与年限对可选方案的压缩。',
    },
    {
      title: 'offer 帮选 各位大佬？',
      url: 'https://www.zhihu.com/question/2042229719014397593',
      kind: '行业观察',
      gist: '讨论在川居住多年者是否必须去一线，涉及本地深耕与异地迁移的权衡。',
    },
  ],
};

/** APPROX：城市属性为近似示意值；覆盖全部 34 个省级行政区 */
export const PROVINCES = [
  "北京市",
  "天津市",
  "上海市",
  "重庆市",
  "河北省",
  "山西省",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "海南省",
  "四川省",
  "贵州省",
  "云南省",
  "陕西省",
  "甘肃省",
  "青海省",
  "台湾省",
  "内蒙古自治区",
  "广西壮族自治区",
  "西藏自治区",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "香港特别行政区",
  "澳门特别行政区",
  "其他",
] as const;

export const CITIES: City[] = [
  { id: "beijing", name: "北京", province: "北京市", tier: "一线", jobs: 98, cost: 95, x: 398, y: 150 },
  { id: "tianjin", name: "天津", province: "天津市", tier: "新一线", jobs: 85, cost: 78, x: 412, y: 149 },
  { id: "shanghai", name: "上海", province: "上海市", tier: "一线", jobs: 97, cost: 97, x: 458, y: 226 },
  { id: "chongqing", name: "重庆", province: "重庆市", tier: "新一线", jobs: 78, cost: 60, x: 306, y: 272 },
  { id: "shijiazhuang", name: "石家庄", province: "河北省", tier: "二线", jobs: 68, cost: 58, x: 385, y: 160 },
  { id: "taiyuan", name: "太原", province: "山西省", tier: "二线", jobs: 64, cost: 55, x: 365, y: 161 },
  { id: "shenyang", name: "沈阳", province: "辽宁省", tier: "二线", jobs: 60, cost: 50, x: 452, y: 120 },
  { id: "dalian", name: "大连", province: "辽宁省", tier: "二线", jobs: 66, cost: 62, x: 456, y: 151 },
  { id: "changchun", name: "长春", province: "吉林省", tier: "二线", jobs: 62, cost: 52, x: 493, y: 101 },
  { id: "harbin", name: "哈尔滨", province: "黑龙江省", tier: "二线", jobs: 62, cost: 52, x: 506, y: 82 },
  { id: "nanjing", name: "南京", province: "江苏省", tier: "新一线", jobs: 84, cost: 76, x: 430, y: 222 },
  { id: "suzhou", name: "苏州", province: "江苏省", tier: "新一线", jobs: 85, cost: 72, x: 446, y: 227 },
  { id: "hangzhou", name: "杭州", province: "浙江省", tier: "新一线", jobs: 88, cost: 84, x: 444, y: 250 },
  { id: "ningbo", name: "宁波", province: "浙江省", tier: "新一线", jobs: 80, cost: 70, x: 455, y: 241 },
  { id: "hefei", name: "合肥", province: "安徽省", tier: "二线", jobs: 66, cost: 56, x: 414, y: 246 },
  { id: "fuzhou", name: "福州", province: "福建省", tier: "二线", jobs: 70, cost: 66, x: 433, y: 279 },
  { id: "xiamen", name: "厦门", province: "福建省", tier: "二线", jobs: 72, cost: 72, x: 421, y: 295 },
  { id: "nanchang", name: "南昌", province: "江西省", tier: "二线", jobs: 66, cost: 58, x: 399, y: 253 },
  { id: "ganzhou", name: "赣州", province: "江西省", tier: "三线", jobs: 36, cost: 38, x: 402, y: 290 },
  { id: "jinan", name: "济南", province: "山东省", tier: "二线", jobs: 74, cost: 66, x: 410, y: 173 },
  { id: "qingdao", name: "青岛", province: "山东省", tier: "二线", jobs: 70, cost: 63, x: 424, y: 181 },
  { id: "zhengzhou", name: "郑州", province: "河南省", tier: "新一线", jobs: 80, cost: 64, x: 376, y: 193 },
  { id: "wuhan", name: "武汉", province: "湖北省", tier: "新一线", jobs: 81, cost: 64, x: 380, y: 243 },
  { id: "changsha", name: "长沙", province: "湖南省", tier: "二线", jobs: 72, cost: 57, x: 372, y: 268 },
  { id: "guangzhou", name: "广州", province: "广东省", tier: "一线", jobs: 93, cost: 86, x: 376, y: 328 },
  { id: "shenzhen", name: "深圳", province: "广东省", tier: "一线", jobs: 95, cost: 93, x: 396, y: 352 },
  { id: "haikou", name: "海口", province: "海南省", tier: "三线", jobs: 56, cost: 60, x: 342, y: 340 },
  { id: "chengdu", name: "成都", province: "四川省", tier: "新一线", jobs: 82, cost: 62, x: 280, y: 254 },
  { id: "mianyang", name: "绵阳", province: "四川省", tier: "三线", jobs: 40, cost: 38, x: 268, y: 226 },
  { id: "nanchong", name: "南充", province: "四川省", tier: "三线", jobs: 34, cost: 34, x: 300, y: 232 },
  { id: "guiyang", name: "贵阳", province: "贵州省", tier: "二线", jobs: 64, cost: 56, x: 306, y: 274 },
  { id: "zunyi", name: "遵义", province: "贵州省", tier: "四线", jobs: 28, cost: 32, x: 302, y: 294 },
  { id: "kunming", name: "昆明", province: "云南省", tier: "二线", jobs: 58, cost: 52, x: 272, y: 306 },
  { id: "xian", name: "西安", province: "陕西省", tier: "新一线", jobs: 76, cost: 58, x: 318, y: 196 },
  { id: "yulin", name: "榆林", province: "陕西省", tier: "四线", jobs: 26, cost: 33, x: 324, y: 170 },
  { id: "lanzhou", name: "兰州", province: "甘肃省", tier: "三线", jobs: 44, cost: 42, x: 268, y: 182 },
  { id: "xining", name: "西宁", province: "青海省", tier: "三线", jobs: 46, cost: 50, x: 258, y: 174 },
  { id: "taipei", name: "台北", province: "台湾省", tier: "新一线", jobs: 82, cost: 85, x: 455, y: 290 },
  { id: "hohhot", name: "呼和浩特", province: "内蒙古自治区", tier: "三线", jobs: 54, cost: 50, x: 357, y: 132 },
  { id: "nanning", name: "南宁", province: "广西壮族自治区", tier: "二线", jobs: 64, cost: 56, x: 324, y: 312 },
  { id: "lhasa", name: "拉萨", province: "西藏自治区", tier: "三线", jobs: 42, cost: 55, x: 151, y: 243 },
  { id: "yinchuan", name: "银川", province: "宁夏回族自治区", tier: "三线", jobs: 48, cost: 50, x: 302, y: 155 },
  { id: "urumqi", name: "乌鲁木齐", province: "新疆维吾尔自治区", tier: "三线", jobs: 52, cost: 55, x: 116, y: 102 },
  { id: "hongkong", name: "香港", province: "香港特别行政区", tier: "一线", jobs: 90, cost: 98, x: 382, y: 317 },
  { id: "macau", name: "澳门", province: "澳门特别行政区", tier: "二线", jobs: 62, cost: 85, x: 375, y: 318 },
  { id: "county", name: "县域乡镇", province: "其他", tier: "县域", jobs: 12, cost: 22, x: 340, y: 308 },
];

export const CITY_MAP: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.id, c])
);

/** REAL：一次性资源规则均来自检索；存量百分比为 APPROX 推导 */
export const ASSETS: Asset[] = [
  {
    id: 'fresh',
    name: '应届生身份',
    desc: '校招、考公考编、国企央企专项通道的入场券。',
    rule: '毕业当年为当年应届；毕业后未落实工作单位的，择业期两年内仍按应届认定。',
    expiry: '择业期 2 年',
    consumedBy: ['国企 / 央企校招', '本专业对口就业', '先就业再定方向（过渡性岗位）'],
    evidence: [
      {
        quote: '国家规定的择业期是两年。',
        title: '应届生身份，进央国企最值钱的一张“入场券”',
        url: 'https://zhuanlan.zhihu.com/p/2095907609199097409',
      },
      {
        quote:
          '应届生从去年秋天拿到 offer 开始，就自动放弃了考公、考编、春招、其他国企央企的校招通道……这个身份在就业市场上只认一次，错过了就是错过了。',
        title: '星宇股份董事长就集体劝退应届生再次道歉',
        url: 'https://www.zhihu.com/question/2078469348969146079',
      },
    ],
  },
  {
    id: 'upgrade',
    name: '统招专升本报考资格',
    desc: '取得全日制本科文凭的唯一通道，直接决定能否报考卡本科门槛的岗位。',
    rule: '在校期间可报考；一旦毕业即失去报考机会，之后只能走非全日制。',
    expiry: '毕业即失效',
    consumedBy: [
      '本专业对口就业',
      '国企 / 央企校招',
      '先就业再定方向（过渡性岗位）',
      '技能型硬手艺（数控 / 机电 / 维修）',
    ],
    evidence: [
      {
        quote: '全日制学历含金量更高，一旦毕业就失去报考机会，权衡清楚再决定。',
        title: '专升本还是选择上班？',
        url: 'https://www.zhihu.com/question/2091372681946052079',
      },
      {
        quote: '很多岗位的报考门槛直接卡在“本科及以上”，专科连报名入口都没有。',
        title: '专科到底是专升本还是直接就业啊？',
        url: 'https://www.zhihu.com/question/2100884786210461201',
      },
    ],
  },
  {
    id: 'window',
    name: '低成本试错窗口',
    desc: '可承受非收入期的时间长度，由经济压力与家庭负担共同决定。',
    rule: '经济压力与家庭负担越高，窗口越短；年龄增长会进一步压缩归零类路径的可行性。',
    expiry: '随处境变化',
    consumedBy: [
      '专升本 / 考研提升学历',
      '升学留学（含高职单招专升硕）',
      '考公 / 事业单位 / 编制',
      '创业 / 家里生意接手',
    ],
    evidence: [
      {
        quote:
          '若家庭尚可、想进考公/国企/更好岗位，选专升本，全日制本科是硬门槛。如果急需收入、专业偏向实操岗位，可先上班，后续读非全日制。',
        title: '专升本还是选择上班？',
        url: 'https://www.zhihu.com/question/2091372681946052079',
      },
      {
        quote: '统招专升本考上再读两年，学费加生活费少说三四万。',
        title: '专科到底是专升本还是直接就业啊？',
        url: 'https://www.zhihu.com/question/2100884786210461201',
      },
    ],
  },
];

export const TENSIONS: Tension[] = [
  {
    a: '专升本 / 考研提升学历',
    b: '本专业对口就业',
    kind: 'exclusive',
    note: '二选一，且专升本资格毕业即失效，选就业等于关闭该通道。',
    basis: '能稳定、体面、有发展的工作，优先工作；工作一般、没前景、没编制，优先专升本。',
    url: 'https://www.zhihu.com/question/1582218641',
  },
  {
    a: '考证换准入资格',
    b: '本专业对口就业',
    kind: 'conditional',
    note: '先后顺序取决于目标岗位是否持证准入，没有适用所有人的统一顺序。',
    basis:
      '岗位有持证准入要求，优先备考对应资格证书；没有强制持证要求，优先补齐实习里刚需的实用技能，再挑选证书。',
    url: 'https://zhuanlan.zhihu.com/p/2101632384890422322',
  },
  {
    a: '国企 / 央企校招',
    b: '考公 / 事业单位 / 编制',
    kind: 'shared',
    note: '共用应届身份这一份资源，接受其中一方的 offer 会影响另一方的通道。',
    basis: '拿到 offer 就自动放弃了考公、考编、春招、其他国企央企的校招通道。',
    url: 'https://www.zhihu.com/question/2078469348969146079',
  },
  {
    a: '技能型硬手艺（数控 / 机电 / 维修）',
    b: '专升本 / 考研提升学历',
    kind: 'conditional',
    note: '实操型专业的学历边际收益较低，文科类则相反。',
    basis:
      '如果你的专业是技术型（如计算机、护理、机电），实操能力比文凭更重要；如果是文科类（如管理、营销），学历提升的边际收益可能更高。',
    url: 'https://www.zhihu.com/question/659698324',
  },
];

export const FIELD_CASES: FieldCase[] = [
  {
    key: 'civil',
    label: '土木 / 建筑 / 工程',
    kw: /土木|建筑|施工|造价|监理|测绘|市政|路桥|工地/,
    loose: /工程/,
    items: [
      {
        title: '施工转造价的自述',
        url: 'https://zhuanlan.zhihu.com/p/29546968296',
        kind: '亲历记述',
        gist: '毕业入职省城国企施工单位做技术，一年多后因常驻工地流动而转造价，已三年。',
      },
      {
        title: '土木工程转工程造价，有什么利弊呢？',
        url: 'https://www.zhihu.com/question/454344508',
        kind: '亲历记述',
        gist: '本科土木工民建方向，签约中字头央企后因商务缺人被挑去做商务，意外完成转向。',
      },
      {
        title: '那些从土木工程转行出去的前辈，现在怎么样了？',
        url: 'https://www.zhihu.com/question/312801231',
        kind: '亲历记述',
        gist: '第一学历大专、非全专升本，工作 12 年从测量放线做到即将再次跳槽的长期轨迹。',
      },
      {
        title: '献给造价新人：一位转行做造价朋友的自述',
        url: 'https://zhuanlan.zhihu.com/p/346888014',
        kind: '亲历记述',
        gist: '海投阶段面试销售、资料员、实习造价生，描述了入行难这一环的具体卡点。',
      },
      {
        title: '土木往届生：网络安全赛道还向你敞开吗',
        url: 'https://zhuanlan.zhihu.com/p/-259860870334945436',
        kind: '个人推测',
        gist: '主张土木转网络安全可行，并区分大专与本科可解锁的方向。含明显招生推广立场，仅作线索。',
      },
    ],
  },
  {
    key: 'nursing',
    label: '护理 / 医学相关',
    kw: /护理|护士|医学|临床|药学|检验|康复|口腔|助产/,
    items: [
      {
        title: '今年毕业，大专护理专业的女生出路在那里？',
        url: 'https://www.zhihu.com/question/2008730331705017443',
        kind: '亲历记述',
        gist: '大专护理毕业、现在三甲手术室工作者的自述，按亲身踩坑给出真实路线，明确不画大饼。',
      },
      {
        title: '大专护理最后都做了什么？山东真实出路盘点',
        url: 'https://zhuanlan.zhihu.com/p/2097264834807181723',
        kind: '行业观察',
        gist: '盘点体检中心、健康管理机构等转型方向：工作强度相对较低、基本无夜班，主要负责采血、心电图、导诊与流程质控。',
      },
      {
        title: '大专护理生毕业后适合做什么？',
        url: 'https://www.zhihu.com/question/1888549697825767721',
        kind: '亲历记述',
        gist: '带教老师记录一位实习生想改做健身教练或销售的对话，逐条分析销售真实情况、健身教练门槛与护理的护城河。',
      },
      {
        title: '专科一战上岸211护理学硕，毕业后彻底转行',
        url: 'https://zhuanlan.zhihu.com/p/399857063',
        kind: '亲历记述',
        gist: '护理专科毕业、一战考上 211 护理学硕，毕业后进入制药企业再转金融行业的完整路径。',
      },
    ],
  },
  {
    key: 'it',
    label: '计算机 / IT / 数据',
    kw: /计算机|软件|编程|程序|代码|IT|互联网|算法|数据|前端|后端|运维|网络|通信|人工智能|大模型|信息技术/,
    items: [
      {
        title: '大专计算机何去何从？',
        url: 'https://www.zhihu.com/question/2089876120854344147',
        kind: '亲历记述',
        gist: '针对“大专学计算机找不到工作”的焦虑论调逐条回应，指出制造焦虑者并不解决专业选择问题。',
      },
      {
        title: '专科毕业，计算机专业不转行，怎么找工作？',
        url: 'https://zhuanlan.zhihu.com/p/1976952241370965144',
        kind: '亲历记述',
        gist: '22 年专科通信专业毕业被派往上海换故障服务器硬盘，后决定转大模型应用开发的完整过程。',
      },
      {
        title: '工作8年的普通专科程序员的一些感悟',
        url: 'https://zhuanlan.zhihu.com/p/449049027',
        kind: '亲历记述',
        gist: '以具体薪资结构测算高薪门槛，说明年薪百万对应的月薪量级与所需平台层级。',
      },
      {
        title: '大专学历23岁，想自学或者报培训班转IT行业，可行吗？',
        url: 'https://www.zhihu.com/question/484058160',
        kind: '亲历记述',
        gist: '大专毕业后月薪不足四千、在校所学只是皮毛、实际工作上不了手的真实处境描述。',
      },
    ],
  },
  {
    key: 'edu',
    label: '学前教育 / 师范',
    kw: /学前|幼师|幼儿|教育|师范|教师|小学|中学/,
    items: [
      {
        title: '学前教育的出路在哪里？',
        url: 'https://www.zhihu.com/question/658306149',
        kind: '亲历记述',
        gist: '同宿舍 6 位学前教育女生毕业后的真实去向跟踪，含最早准备考编者的时间线。',
      },
      {
        title: '大专学前教育专业找不到工作怎么办？',
        url: 'https://www.zhihu.com/question/2101133816987502268',
        kind: '亲历记述',
        gist: '描述上班辛苦、钱少甚至倒贴，想换成长型岗位却被本科门槛卡住的具体困境。',
      },
      {
        title: '专科幼师在江西真实就业出路怎么样？',
        url: 'https://zhuanlan.zhihu.com/p/2062108601028702721',
        kind: '行业观察',
        gist: '以一所幼儿师范高等专科学校为样本，回应“工资两三千”“只能去私立园”“编制有希望吗”等疑问。',
      },
    ],
  },
  {
    key: 'finance',
    label: '会计 / 财务 / 经管',
    kw: /会计|财务|审计|税务|金融|出纳|经管|电商|营销|工商/,
    loose: /经济|管理/,
    items: [
      {
        title: '大专会计有什么出路？',
        url: 'https://www.zhihu.com/question/663252252',
        kind: '亲历记述',
        gist: '作者第一学历大专、所学移动通信与会计无关，从工厂出纳兼人事行政起步的转入过程。',
      },
      {
        title: '会计专业大专读了三年，找工作前我先把真账和专升本都安排上了',
        url: 'https://zhuanlan.zhihu.com/p/2096559720756790995',
        kind: '亲历记述',
        gist: '记录以商贸企业真账练习为主的学习路径：期初建账到月底出报表，小规模与一般纳税人两套账套都拆过。',
      },
      {
        title: '一个来自逛完校招的会计大专生的自述',
        url: 'https://zhuanlan.zhihu.com/p/2023176032463648153',
        kind: '亲历记述',
        gist: '五年一贯制会计专业在校生的校招观察记录，含学制与课程结构说明。',
      },
    ],
  },
  {
    key: 'craft',
    label: '机电 / 数控 / 技能型',
    kw: /机电|数控|机械|制造|汽修|汽车|电气|自动化|焊接|模具|轨道|烹饪|维修|电工/,
    items: [
      {
        title: '专科生最好就业的十个专业？',
        url: 'https://www.zhihu.com/question/647105842',
        kind: '行业观察',
        gist: '列举纯手艺技术路线专业，并给出机电一体化的典型晋升节奏：新手设备维修工，约 3 年成设备技术员负责调试排故。',
      },
      {
        title: '“毕业即上岗”的中职专业清单+就业方式',
        url: 'https://zhuanlan.zhihu.com/p/2076726536535857082',
        kind: '行业观察',
        gist: '随地铁线路扩张，城市轨道交通成为就业稳定、国企比例最高的专业之一，并列出所学课程范围。',
      },
      {
        title: '大专毕业不等于稳就业！不想毕业即失业，这门硬核技术值得考虑',
        url: 'https://zhuanlan.zhihu.com/p/2099502570884560425',
        kind: '个人推测',
        gist: '指出大专生缺少可直接上岗的硬技能、易落入低薪高替代岗位。含培训推广立场，仅作线索。',
      },
    ],
  },
];

export const URBAN_LABEL: Record<Urban, { n: string; adj: number }> = {
  core: { n: '主城区', adj: 0 },
  suburb: { n: '近郊/新区', adj: -6 },
  county: { n: '下辖县镇', adj: -14 },
};

export const SIX_BODY_TYPES = [
  '亲情体验',
  '团队体验',
  '非营利组织体验',
  '营利组织体验',
  '创新创业体验',
  '全球事务体验',
] as const;
