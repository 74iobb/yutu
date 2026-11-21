/* 域途 · 四步流程数据层
   来源分两类：
   - verified：本次由 zhihu-cli 真实检索取得，保留原文链接
   - demo：演示用示意数据，界面明确标注 */
window.YUTU_DATA = {
  /* ---------- 阶段定义：年龄 + 处境共同决定 ---------- */
  stages: [
    {id:"explore", name:"在校探索期", ageMin:16, ageMax:23,
     desc:"身份尚未定型，试错成本最低，核心任务是把下游岗位摊开看清。"},
    {id:"entry",   name:"初入职场期", ageMin:22, ageMax:27,
     desc:"第一份工作定调，核心任务是积累可迁移能力而非薪资最大化。"},
    {id:"pivot",   name:"转向抉择期", ageMin:26, ageMax:33,
     desc:"已有存量经验，核心任务是判断哪些能力可迁移、迁移窗口还剩多久。"},
    {id:"anchor",  name:"稳态深耕期", ageMin:32, ageMax:45,
     desc:"家庭与现金流约束变硬，核心任务是在可承受范围内做增量而非归零重来。"}
  ],

  /* ---------- 同阶段同地区的人在做什么（演示用分布，标注为示意） ---------- */
  peerActivity: {
    explore: [
      {label:"摊开本专业下游岗位做调研", share:31},
      {label:"准备专升本 / 考研",        share:24},
      {label:"找第一份实习",             share:22},
      {label:"自学一门可验证的技能",      share:15},
      {label:"还没想清楚，先观望",        share:8}
    ],
    entry: [
      {label:"在第一家单位积累经验",      share:34},
      {label:"边做边准备换方向",          share:23},
      {label:"考证补学历",               share:18},
      {label:"做副业试水",               share:14},
      {label:"已在准备离职",             share:11}
    ],
    pivot: [
      {label:"盘点可迁移能力找交叉地带",   share:29},
      {label:"不离职做小规模验证",        share:26},
      {label:"考证 / 进修换门槛",         share:19},
      {label:"直接跳同行业更好的坑",      share:16},
      {label:"暂缓决定，先稳住现金流",     share:10}
    ],
    anchor: [
      {label:"在现有岗位做纵深",          share:33},
      {label:"用业余时间做第二曲线",       share:25},
      {label:"转管理 / 带团队",           span:0, share:18},
      {label:"回流本地求稳定",            share:15},
      {label:"准备创业或接私活",          share:9}
    ]
  },

  /* ---------- 阶段 × 方向：所有可选方向 ---------- */
  directions: {
    explore: [
      {name:"本专业对口就业", feasible:"high",
       note:"路径最短，但需先确认对口岗位的真实日常是否可接受。",
       prereq:"能拿到实习或访谈渠道"},
      {name:"本专业横向岗位（如施工转造价）", feasible:"high",
       note:"同一行业内换岗位，已有大量可查的真实转向记录。",
       prereq:"在校期间把软件或算量练到能独立出活"},
      {name:"专升本 / 考研提升学历", feasible:"mid",
       note:"打开部分学历门槛，但会占用 1–3 年试错窗口。",
       prereq:"家庭现金流能支撑非收入期"},
      {name:"跨行业转技术岗", feasible:"mid",
       note:"门槛对学历相对友好，但需要完整的自学闭环与作品。",
       prereq:"每周可稳定投入 10 小时以上"},
      {name:"考公 / 体制内", feasible:"mid",
       note:"稳定性高，但岗位数量受本地编制规模限制。",
       prereq:"能承受较长备考期"}
    ],
    entry: [
      {name:"在现单位积累可迁移能力", feasible:"high",
       note:"成本最低的一条，关键是区分哪些经验出了这家公司还算数。",
       prereq:"能拿到核心业务的参与机会"},
      {name:"同行业换更好的平台", feasible:"high",
       note:"保留行业积累，只换平台，折价最小。",
       prereq:"已有 1 年以上可讲清的业绩"},
      {name:"行业内换职能方向", feasible:"mid",
       note:"经验部分可迁移，需补齐新职能的硬技能。",
       prereq:"目标职能的技能缺口已盘点清楚"},
      {name:"跨行业重启", feasible:"low",
       note:"需要接受起点归零，窗口期随年龄收窄。",
       prereq:"有 6 个月以上的现金流缓冲"}
    ],
    pivot: [
      {name:"可迁移能力盘点后渐进迁移", feasible:"high",
       note:"在交叉地带落脚，不必归零，是这一阶段最稳的路径。",
       prereq:"能列出 3 个交叉岗位与各自缺口"},
      {name:"不离职做小规模验证", feasible:"high",
       note:"用 8 周业余投入换一个明确结论，成本可控。",
       prereq:"每周 8 小时且不影响本职"},
      {name:"考证换门槛", feasible:"mid",
       note:"证书能开门但不能替代经验，需与实做并行。",
       prereq:"目标岗位确实把证书作为硬门槛"},
      {name:"彻底转行", feasible:"low",
       note:"房贷与家庭责任会放大失败代价，社区成功案例常未披露家庭支持条件。",
       prereq:"算清最低现金流底线并与家人对齐"}
    ],
    anchor: [
      {name:"现岗位纵深 + 内部转岗", feasible:"high",
       note:"存量经验利用率最高，风险最低。",
       prereq:"单位内部有可见的通道"},
      {name:"业余第二曲线", feasible:"mid",
       note:"只选能在碎片时间闭环的最小单元，先记录两周真实可用时间。",
       prereq:"家庭已知情并同意"},
      {name:"转管理或带团队", feasible:"mid",
       note:"从做事转为带人，所需能力与原岗位不同。",
       prereq:"有带人或跨部门协作的实际经历"},
      {name:"创业 / 接私活", feasible:"low",
       note:"收入波动大，需以现金流底线倒推可承受周期。",
       prereq:"有可自带的客户或渠道"}
    ]
  },

  /* ---------- 真实检索来源：由 zhihu-cli search zhihu 取得 ---------- */
  cases: {
    explore: [
      {title:"25届大专生毕业生求职经历",
       url:"https://zhuanlan.zhihu.com/p/1963253025431877608",
       kind:"亲历记述",
       gist:"记录了专科应届从投递到入职的完整过程，含被拒与调整方向的节点。"},
      {title:"专科的你毕业后怎么样了？",
       url:"https://www.zhihu.com/question/268689633",
       kind:"亲历记述",
       gist:"大量专科毕业生的长期跟踪自述，可用于对照不同起点的实际走向。"},
      {title:"专科生找工作是一种什么体验？",
       url:"https://www.zhihu.com/question/56125105",
       kind:"亲历记述",
       gist:"集中描述学历门槛在投递环节的具体表现，适合提前校准预期。"},
      {title:"大专毕业后2年的工作记录",
       url:"https://zhuanlan.zhihu.com/p/2099129468950410411",
       kind:"亲历记述",
       gist:"按时间线记录毕业两年内的岗位变化，可见早期选择的连带影响。"}
    ],
    entry: [
      {title:"施工转造价的自述",
       url:"https://zhuanlan.zhihu.com/p/29546968296",
       kind:"亲历记述",
       gist:"硕士毕业入职省城国企施工单位做技术，一年多后因常驻工地流动而转造价，已三年。"},
      {title:"施工转造价，结果是好的吗？",
       url:"https://www.zhihu.com/question/365873976",
       kind:"亲历记述",
       gist:"顶岗实习进入施工单位，遇到愿意带人的师傅，记录了工地初期的真实观感与转向过程。"},
      {title:"献给造价新人：一位转行做造价朋友的自述",
       url:"https://zhuanlan.zhihu.com/p/346888014",
       kind:"亲历记述",
       gist:"海投阶段面试销售、资料员、实习造价生，描述了入行难这一环的具体卡点。"}
    ],
    pivot: [
      {title:"土木工程转工程造价，有什么利弊呢？",
       url:"https://www.zhihu.com/question/454344508",
       kind:"亲历记述",
       gist:"本科土木工民建方向，签约中字头央企后因商务缺人被挑去做商务，意外完成转向。"},
      {title:"那些从土木工程转行出去的前辈，现在怎么样了？",
       url:"https://www.zhihu.com/question/312801231",
       kind:"亲历记述",
       gist:"第一学历大专、非全专升本，工作 12 年从测量放线做到即将再次跳槽的长期轨迹。"},
      {title:"我的造价师之路——一个外行转造价的心路历程",
       url:"https://zhuanlan.zhihu.com/p/300156637",
       kind:"亲历记述",
       gist:"外行转造价，详述以教材为基础、视频辅助理解的备考方法与四门课的投入分配。"},
      {title:"土木往届生：网络安全赛道还向你敞开吗",
       url:"https://zhuanlan.zhihu.com/p/-259860870334945436",
       kind:"个人推测",
       gist:"主张土木转网络安全可行，并区分大专与本科可解锁的方向数量。含明显招生推广立场，仅作线索。"}
    ],
    anchor: [
      {title:"那些从土木工程转行出去的前辈，现在怎么样了？",
       url:"https://www.zhihu.com/question/312801231",
       kind:"亲历记述",
       gist:"含多位工作十年以上者的转向记录，可见家庭与年限对可选方案的压缩。"},
      {title:"offer 帮选 各位大佬？",
       url:"https://www.zhihu.com/question/2042229719014397593",
       kind:"行业共识",
       gist:"讨论在川居住多年者是否必须去一线，涉及本地深耕与异地迁移的权衡。"}
    ]
  },

  /* ---------- 地域机会：真实检索取得 ---------- */
  regional: {
    chengdu: [
      {title:"2026成都找工作靠谱平台推荐｜如何规避虚假岗位",
       url:"https://zhuanlan.zhihu.com/p/2078963039903209221",
       fact:"该文称 2026 年成都本地高校应届毕业生规模突破 25 万人，叠加往届回流，线上招聘平均虚假岗位投诉率 3.7%。"},
      {title:"成都AI就业指南，薪资岗位全解析",
       url:"https://zhuanlan.zhihu.com/p/2083949721668810707",
       fact:"汇总 48 条成都在招岗位明细与投递链接，含网易雷火等用人单位。"},
      {title:"成都，工位大拆迁！",
       url:"https://zhuanlan.zhihu.com/p/2017305233936635767",
       fact:"记述外包团队收缩过程，提出本轮岗位变动与 AI 替代相关，不同于此前地产、教培的行业下行。"}
    ],
    generic: [
      {title:"2026.4.1｜成都最新急招大全",
       url:"https://zhuanlan.zhihu.com/p/2022703912889644809",
       fact:"汇总全职、兼职、日结岗位，文内自带免责声明，信息来自外部提供。"}
    ]
  },

  /* ---------- 城市属性（公开统计的近似示意值） ---------- */
  cities: [
    {id:"beijing", name:"北京",   tier:"一线",   jobs:98, cost:95, x:398, y:150},
    {id:"shanghai",name:"上海",   tier:"一线",   jobs:97, cost:97, x:458, y:226},
    {id:"guangzhou",name:"广州",  tier:"一线",   jobs:93, cost:86, x:376, y:328},
    {id:"shenzhen",name:"深圳",   tier:"一线",   jobs:95, cost:93, x:396, y:352},
    {id:"hangzhou",name:"杭州",   tier:"新一线", jobs:88, cost:84, x:444, y:250},
    {id:"chengdu", name:"成都",   tier:"新一线", jobs:82, cost:62, x:280, y:254},
    {id:"wuhan",   name:"武汉",   tier:"新一线", jobs:81, cost:64, x:380, y:243},
    {id:"xian",    name:"西安",   tier:"新一线", jobs:76, cost:58, x:318, y:196},
    {id:"chongqing",name:"重庆",  tier:"新一线", jobs:78, cost:60, x:306, y:272},
    {id:"nanjing", name:"南京",   tier:"新一线", jobs:84, cost:76, x:430, y:222},
    {id:"qingdao", name:"青岛",   tier:"二线",   jobs:70, cost:63, x:424, y:181},
    {id:"changsha",name:"长沙",   tier:"二线",   jobs:72, cost:57, x:372, y:268},
    {id:"hefei",   name:"合肥",   tier:"二线",   jobs:66, cost:56, x:414, y:246},
    {id:"kunming", name:"昆明",   tier:"二线",   jobs:58, cost:52, x:272, y:306},
    {id:"shenyang",name:"沈阳",   tier:"二线",   jobs:60, cost:50, x:452, y:120},
    {id:"lanzhou", name:"兰州",   tier:"三线",   jobs:44, cost:42, x:268, y:182},
    {id:"mianyang",name:"绵阳",   tier:"三线",   jobs:40, cost:38, x:268, y:226},
    {id:"nanchong",name:"南充",   tier:"三线",   jobs:34, cost:34, x:300, y:232},
    {id:"ganzhou", name:"赣州",   tier:"三线",   jobs:36, cost:38, x:402, y:290},
    {id:"zunyi",   name:"遵义",   tier:"四线",   jobs:28, cost:32, x:302, y:294},
    {id:"yulin",   name:"榆林",   tier:"四线",   jobs:26, cost:33, x:324, y:170},
    {id:"county",  name:"县域乡镇",tier:"县域",  jobs:12, cost:22, x:340, y:308}
  ]
};
