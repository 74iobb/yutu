# 域途 · 交接说明（给下一个智能体）

> 交接时间：2026-11-24　交接版本：V10.7（四步版 + 完全体补全）
> 请按顺序读：**本文件 → `.project.md` → `docs/MODEL.md` / `docs/DATA-SOURCES.md` / `docs/VERIFICATION.md`**，再动代码；交付前用 `.claude/skills/taste/SKILL.md` 做六维审查。
> `.project.md` 是数据表、工作流 token、前端调用约定的**唯一事实来源**；本文件只补充「怎么跑、怎么验、别踩什么坑」。

---

## 0. 30 秒认识项目

- **项目**：域途 · 多维沃罗诺伊体验式生涯陪伴系统（知乎黑客松 S3）。
- **技术栈**：Vite 5 + React 18 + TypeScript + Tailwind + Leaflet/OSM + d3-delaunay。
- **模板**：`react-vite`（系统预设，**不可改成 Vue / 其他模板**）。
- **路由**：`HashRouter`，`/#/` 直接进入四步主流程。
- **四步**：填写信息 → 了解环境 → 方向与推演（方向清单 / 作战图 / 归属摘要）→ 成长闭环。
- **当前视觉**：V10 暗色玻璃 + 叶面水珠背景（已回退到最初）；新增起点雷达、规则版灵魂拷问、二阶检索、方向执行清单、同伴去向样本、本地长期记忆、复盘树状讨论与讨论热度、多模态素材（公开链接）、3D 弹珠与图表动效；最近一次改动为 V10.13（多模态素材）。

---

## 1. 安装与运行

环境：Node ≥ 18（本包在 **Node 22.23.2 / pnpm 10.34.8** 下验证）。

```bash
# 1) 安装依赖（项目根目录）
pnpm install --prefer-offline

# 2) 本地开发
pnpm dev
# 默认 http://localhost:5173/  （端口以 Vite 输出为准）

# 3) 质量检查与生产构建
pnpm type-check
pnpm lint
pnpm build

# 4) 预览已构建产物
pnpm preview
```

说明：

- 包内附带 **`dist/` 预构建快照**（2026-11-24 构建），可直接 `pnpm preview`；**改源码后请重新 `pnpm build`**，不要直接改 `dist/`。
- 本地 `vite dev` 没有平台的页面代理时，前端会**自动降级为 `localStorage`**（键 `yutu.state.v3`），页头显示「本地存储模式」。这是正常行为，不是 bug。
- 平台内打开时自动使用数据表工作流；`POST /api/page/w/{token}` 为同源请求，浏览器自带登录态，**不要在请求头里加密钥**。
- 依赖安装若遇到 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`：本项目 `.npmrc` 与 `pnpm-workspace.yaml` 已固定 `confirmModulesPurge: false`，再执行一次 `pnpm install --prefer-offline` 即可。

---

## 2. 平台数据与接口

- 启用中的 **25 个 SQL 操作 API（实为工作流）**：`profile_get/save`、`tasks_list/add/update_status/delete`、`archive_list/add`、`reviews_list/add`、`marks_add/list`，V9.6 接入的 `peer_samples_stats/mine/add/update`、`archive_choice_stats`，V10.9 新增的 `discussions_list/add/delete`，V10.12 的 `discussions_stats`、V10.15 的 `discussions_search`（绑定表 8778），以及 V10.13 的 `media_list/add/delete`（绑定表 8779）。
- **端点 token、绑定表、入参、SQL 要点**：见 `.project.md` 第 2、3 节；前端映射在 `src/lib/yutuApi.ts` 的 `API_ENDPOINTS`。
- `peer_samples_*` 与 `archive_choice_stats` 已在「同伴经验域」的「同阶段的人后来去哪了」卡片中使用；写样本前会脱敏，离线只存本机。
- 请求路径：`POST /api/page/w/{token}`；查询数据在 `data.outputList`，写操作只回 `success`。
- 用户隔离：`ownerKey` 由前端生成并保存在 `localStorage: yutu.ownerKey`，所有个人表按此过滤。
- 新增接口的固定顺序：**建表 → 建 SQL 操作 API → 登记 `.project.md`（表 ID / 物理表名 / token / SQL / 入出参）→ `yutuApi.ts` → `YutuContext` → 组件**。
- 组件**禁止**直接 `fetch` 或消费后端列名；列名映射集中在 `yutuApi.ts`。
- 平台没有工作流删除接口，**禁止创建测试 SQL 工作流**（如 `SELECT 1`）来探测连通性，会永久残留。
- 数据表位于项目空间 `DEV_SPACE_ID`；建表/查表必须带 `spaceId`（由平台环境变量注入，不要改用个人空间）。

### 2.5 密钥与知乎内容授权

- **知乎 Access Secret 未随包提供**：打包环境未注入 `ZHIHU_ACCESS_SECRET`，也没有 `~/.config/zhihu-cli/secret.env` / `zhihu-cli`。应用运行**不需要**它——256 条快照已内置；只有「刷新快照」才需要。
- 需要刷新时按 **`secrets/README.md`** 注入：可参考 `secrets/zhihu.env.example` 创建本地 `secrets/zhihu.env`（已被 `.gitignore` 忽略），或临时 `export ZHIHU_ACCESS_SECRET=...`。**不要把真实密钥写进代码、前端、提交记录或公开 zip。**
- 知乎内容的展示/再分发边界与发布前检查清单：**`docs/ZHIHU-RIGHTS.md`**。核心口径：访问密钥只证明「能查」，不等于获得「可对外转载/商用」的授权。
- 平台 25 个工作流端点 token 不是密钥，已在 `.project.md` 第 3 节与 `src/lib/yutuApi.ts` 中随包提供。

---

## 3. 目录与关键文件

```
.
├── AGENTS.md                 给智能体的精简约束（本文件同级）
├── HANDOFF.md                本文件
├── .project.md               【唯一事实来源】表 / 工作流 / token / 调用约定 / 变更记录
├── README.md                 历史说明（含 V2 五步旧口径，以 HANDOFF/.project.md 为准）
├── index.html                title 不得含框架名
├── vite.config.ts            含 DEV-INJECT 注入块，禁止删除/修改
├── src/
│   ├── pages/YutuApp.tsx     应用装配（四步）
│   ├── components/           Shell / Step1 / Step2 / Step34 / Step3 / Step4 / Step6 / StepSummary
│   │                           GIS：GisMap（第 2 步）、CampaignMap（作战图）、BoardSvg、PeerNebula
│   │                           视觉：DirectionSky、GrowthRiver、LoopMap、GapPhoto、MascotVisual
│   ├── store/YutuContext.tsx 唯一状态源 + localStorage 持久化 + 平台/本地降级
│   ├── lib/yutuApi.ts        工作流 token 映射 + 统一外壳解析 + 行→模型映射
│   ├── lib/model.ts          七维 / 阶段 / 可行性 / 资源 / 投影 / TOTAL_STEPS=4
│   ├── lib/search*.ts        专业大类匹配与快照检索
│   ├── data/                 catalog.ts、nodes.ts、land.ts、live.ts、zhihu-snapshot.json
│   ├── yutu.css              全部原型样式（作用域 #yutu2；V8 暗色覆盖在文件后段）
│   └── assets/               照片、动图、按钮玻璃底图、背景（来源见 docs/IMAGE-SOURCES.md）
├── docs/                     需求、模型、数据来源、验证、设计系统、动效、图片授权
├── legacy/                   原始 HTML/JS 原型，**勿删**
├── scripts/                  refresh-zhihu-snapshot.py、build_plan_docx.py
├── .claude / .agents / .codex / .opencode
│                             随包附带 datatable-for-page-api、nuwax-pay 技能
└── dist/                     预构建快照（可 `pnpm preview`）
```

关键状态键：`yutu.state.v2`（档案/步骤/候选/点选等）、`yutu.ownerKey`、`yutu.lastActive`、`yutu.marked`、`yutu.dropApplied`、`yutu.motionOff`、`yutu.view34`（sessionStorage）。

---

## 4. 当前功能状态（已实现）

1. **第 1 步 填写信息**：城市/年龄/身份/方向 + 结构化量表 + 可校准滑块 + 填写质量与矛盾提示；方向必填后才解锁下一步。
2. **第 2 步 了解环境**：Leaflet GIS 城市图（地理/网络双模式）、区域构成、城市近期讨论（知乎快照，按填写方向重排）。
3. **第 3 步 方向与推演**：内部三视图——方向清单 / 资源作战图 / 归属与摘要；共享候选（最多 4 条）与选定方向；作战图 55/105/155 km 三圈 + 全国网络双尺度；方向星图沉浸视图。
4. **第 4 步 成长闭环**：体验工作台 → 停靠驿站三问 → 归档漂移 → 胜利档案墙 / 同伴经验域；内层「任务→归档→向量漂移」，外层「复盘→校验池→3 个有效标记升级公共节点」。

数据边界：城市属性 APPROX；去向样本 DEMO；知乎内容为 **2026-11-19 21:46 快照**，不在运行时检索；浏览器端不持有任何 Secret。

---

## 5. 不能碰的东西

- **模板/框架**：不得把 `react-vite` 改成 Vue，不得把 `.tsx` 整批换成 `.vue`，不得替换 `package.json` 里的 react/vue 依赖。
- **`DEV-INJECT-START` / `DEV-INJECT-END`**：`vite.config.ts` 中的注入块必须原样保留。
- **`legacy/`**：原始原型，勿删。
- **`.project.md`**：改数据层后必须同步更新；不要写临时调试信息。
- **`cpage_config.json`**：平台导出的页面配置快照（本包未包含），不要手工重建/编辑。
- **安全**：不要硬编码内网 IP、localhost 服务探测、密钥或 Access Secret；不要新建测试 SQL 工作流。

---

## 6. 已知坑（都已验证过原因）

- **pnpm 无 TTY 安装中止**：见 §1，重跑 `pnpm install --prefer-offline`。
- **Leaflet 白屏 / `_initContainer`**：`CampaignMap` / `GisMap` 已做容器校验 + try/catch + `ErrorBoundary`；不要恢复 `StrictMode` 双挂载。
- **地图瓦片被网络策略拦截**：自动回落到离线矢量陆地（`src/data/land.ts`），属于预期降级。
- **README 的「五步」口径**：README 顶部 V2 段落是历史版本；现状以 `HANDOFF.md` + `.project.md` + `Shell.tsx` 的 `STEP_META`（4 步）为准。
- **暗色主题「曝光」**：V8.2–V8.13 已逐块处理；新增浅色组件时请检查是否在暗色纸上形成亮块（重点：空状态、地图控件、滚动条、Leaflet 比例尺）。
- **`dist/` 是快照**：与源码不一致时以源码为准，重新构建。
- **大素材**：`src/assets/` 约 6 MB（多组 JPG + WebP 动图），新增图片请同时提供 WebP/JPEG fallback 并登记 `docs/IMAGE-SOURCES.md`。

---

## 7. 验收清单（接手后先跑一遍）

```bash
pnpm install --prefer-offline
pnpm type-check     # 期望无输出错误
pnpm lint           # 期望 0 warnings
pnpm build          # 期望 ✓ built
```

手工冒烟（平台或 `pnpm dev`）：

1. 打开 `/#/`，应直接进入第 1 步，不是模板占位页。
2. 填城市/年龄/身份/方向 → 进入第 2 步，地图能显示城市点与比例尺。
3. 第 3 步：方向清单可加入候选（≤4）→ 切「资源作战图」→ 点方向节点，右侧出现代价明细；地图上 `55/105/155 km` 与比例尺为深色，不应有白块。
4. 第 3 步「归属与摘要」→ 底部进入第 4 步闭环。
5. 第 4 步：领取任务 → 标记完成 → 停靠自省 → 归档，胜利档案增加一条；刷新后状态仍在（平台模式下来自数据表，本地模式来自 localStorage）。
6. 页头「数据来源与口径」可展开，5 项读接口状态可见；断网时显示本地存储模式而非白屏。

---

## 8. 包内包含 / 排除

**包含**：全部源码、配置、锁文件（`pnpm-lock.yaml`）、`.npmrc`、`docs/`（含 `docs/ZHIHU-RIGHTS.md`）、`legacy/`、`scripts/`、`secrets/README.md` 与 `secrets/zhihu.env.example`（**不含真实密钥**）、`.project.md`、`README.md`、本文件、`AGENTS.md`、`.claude/.agents/.codex/.opencode` 的 skills、预构建 `dist/`。

**排除**：`node_modules/`、`.git/`、`.attachments/`（用户截图）、`dist-packages/`、`*.zip`、临时日志与 `vite.config.ts.timestamp-*`。

> 需要完整 git 历史时，请在平台仓库侧获取；本 zip 以「可运行 + 可继续开发」为目标。

---

## 9. 最近变更

完整变更记录见 `.project.md` 第 5 节。最新一条：**2026-11-24 V9.1 起点快照 + 雷达对比 + 灵魂拷问 + 脱敏**。
- `YutuState` 新增 `snapshot0`（首次进入第 2 步固定，随 `yutu.state.v2` 持久化；老快照与平台回读都有兜底）。
- 新增 `GrowthRadar`（七维 SVG 雷达）：接入 `GrowthDelta`、停靠驿站右卡、归档完成卡。
- 新增 `soul.ts` + `SoulCard`：按真实数据（经济压力变化、任务完成率、体验历史、上一轮自省原文）生成 2–3 条「灵魂拷问」，标注依据，不调用大模型。
- 新增 `desensitize.ts`：公共复盘 / 经验卡提交前统一脱敏（证件号 / 手机号 / 邮箱 / 金额 / 公司），本地原文不变。
- 无新增表 / 工作流；`type-check`、`lint`、`build` 均通过。下一步可做：结构化方向执行清单（学什么 / 预算 / 坑）、二阶检索、5 个去向接口接入。

> 2026-11-24 V9.2 数据图升级：`TrendChart` 改为暗色渐变平滑曲线 + 辉光 + 悬停气泡；`GrowthRiver` 提亮色板、加网格与柔光；`GrowthRadar` 加渐变填充与描边生长动画。样式集中在 `src/yutu.css` 末尾「V9.2」段，仍无新增表 / 工作流。
>
> 2026-11-24 V9.3 第 2 步地理模式修复：`GisMap` 用 `selectCityRef` 稳定回调、用 `viewKeyRef` 只在城市/模式/重定位变化时 `setView`，解决「放大后被父组件重渲染拽回」；地理模式 OSM 瓦片反相为暗色、离线陆地同步深色，并加四周渐晕。仍无新增表 / 工作流。
>
> 2026-11-24 V9.4 对齐平台新表：当前生效表为 8766–8771、工作流 5269644–5269660，端点 token 未变。`LS_KEY` 升到 `yutu.state.v3` 并删除旧 `v2`，旧本地历史不再参与合并；`.project.md` 已同步新表/工作流 ID。
>
> 2026-11-24 V9.6 接完 5 个去向接口：`peer_samples_*` + `archive_choice_stats` 已接入「同伴经验域」的「同阶段的人后来去哪了」卡片；自填样本提交前脱敏，离线存本机。另修复预览 `useYutu must be used inside YutuProvider`：Context 挂 `globalThis` 复用，避免 Vite 热更新重建实例。`readRemote()` 现为 8 个查询。
>
> 2026-11-24 V9.7 第 2 步网络模式可见性：`GisMap` 增加城市兜底（无效 id → 中文名 → 成都），暗色陆地提亮，飞线目标常驻标签 + 模式徽标，减弱四周渐晕；地理/网络来回切换实测稳定。仍无新增表 / 工作流。
>
> 2026-11-24 V10 动图升级：`GapPhoto` 加 Ken Burns + 扫光，Step1/Step6 三张主图自动播放 WebP；雷达加 10s 扫描线、趋势图加 3.4s 沿线流光、成长河加 9s 横扫柔光；全部尊重 `prefers-reduced-motion` 与「动效 关」。仍无新增表 / 工作流。
>
> 2026-11-24 V10.1 接入「高级阳光早晨」照片：`scenery-morning.jpg`（Unsplash License，1100×700）+ 16 帧 `scenery-morning-motion.webp`；`GapPhoto` 新增 `morning` 变体，第一步右侧「判定结果」下方的图位替换为它并自动播放；来源与授权已登记 `docs/IMAGE-SOURCES.md`。
>
> 2026-11-24 V10.2 新增 `taste` skill（审美与体验门禁）：`.claude/skills/taste/SKILL.md`，并镜像到四个技能目录。交付前用它做六维审查（层级 / 一致性 / 数据诚实 / 动效 / 状态 / 响应式），P0 必须为 0。
>
> 2026-11-24 V10.3 成长闭环弹珠：用用户上传的彩绘玻璃图生成 `loop-marble.webp`（256×256 圆形透明），`LoopMap` 把主环绕光点替换为弹珠（阴影 + 白边 + 高光，16s 绕环，画在站点之上、不挡点击）。来源已登记 `docs/IMAGE-SOURCES.md`。
>
> 2026-11-24 V10.4 弹珠 3D 化：球面明暗 / 右下环境反光 / 镜面高光 / 弧形边缘反光 / 柔化投影；轨道收到环内沿（R-24），不再盖住站点编号。光影层用 ellipse 绕开旧 circle 橙色规则。
>
> 2026-11-24 V10.5 全屏背景切回 NGC 7023 鸢尾花星云：恢复 NOIRLab 公开版素材，默认星云、页头「背景」可切换（`yutu.bg`），恢复 NOIRLab credit；叶面水珠保留为备选。
>
> 2026-11-24 V10.6 第三种背景「海」：Unsplash 水下照片 1600×900 + 水下装饰层（光束 18s / 焦散 28s / 气泡 16–28s / 96s 漂移）；页头「背景」三态循环 星云 → 海 → 叶面。减动效/动效关保留静态海面。
>
> 2026-11-24 V10.7 背景回退：按「改回最初的时候」恢复叶面水珠为唯一全屏背景，移除星云/水下/背景切换；`theme-color` 与页脚也恢复原状。星云/水下素材保留在 `src/assets` 但未引用。其他功能不变。
>
> 2026-11-24 V10.8 本地长期记忆：`memory.ts` 用归档/复盘向量做相似度检索，灵魂拷问引用最接近当前处境的旧记录；胜利档案墙新增「系统记得你」面板（最多 4 条、接近度条）。纯本机计算，无新增表 / 工作流。
>
> 2026-11-24 V10.9 复盘树状讨论：新增表 8778（`custom_table_8778`）与 `discussions_list/add/delete` 三个工作流（token 已登记 `.project.md`）。复盘卡片下可展开讨论，支持逐级回复、删除自己的；发布前脱敏，离线写本机。注意：新增 3 个工作流会永久保留。
>
> 2026-11-24 V10.10 讨论进入长期记忆：`retrieveMemories` 接收 discussions，自己参与的讨论以所属复盘向量参与相似度排序；记忆面板与灵魂拷问会显示「你的讨论」。「我的贡献」新增参与讨论/收到回复计数；本地备份新增起点快照、讨论与去向样本。
>
> 2026-11-24 V10.11 记忆时间线：`MemoryPanel` 升级为「时间 × 相似度」SVG 时间线（最多 24 条），点击/键盘选择记忆，右侧显示原文与「当时 vs 现在」七维雷达；现在标记在 100%。纯本机计算。
>
> 2026-11-24 V10.12 社区讨论热度：新增 `discussions_stats`（5269688 / token `17955298285269688`），复盘卡片显示「讨论 N · M 人参与」，≥3 人显示「热议」；`readRemote()` 扩到 9 项；离线用本机讨论兜底。另修复旧 HMR 状态缺少 `discussionStats` 导致的 PeersTab 崩溃。
>
> 2026-11-24 V10.13 多模态降级复盘：新增表 8779 与 `media_list/add/delete` 三个工作流（token 已登记 `.project.md`）。复盘卡片下可展开「素材」，支持公开图片预览、语音播放、说明、打开原链接、删除自己的；只接受 http(s) 链接，说明文字脱敏，平台不存文件、不做转写。新增 3 个工作流会永久保留。
>
> 2026-11-24 V10.14 复盘热议排序：「同处境者的复盘」可切「最新 / 热议」，热度 = 有效标记 + 参与讨论人数；卡片显示「热度 N」，排序不改变公共节点判定。无新增表 / 工作流。
>
> 2026-11-24 V10.15 复盘/讨论搜索：新增 `discussions_search`（5269692 / token `17955304695269692`，LIKE 包含匹配）；同伴经验域顶部新增搜索卡，复盘本地匹配 + 讨论在线/离线搜索，结果可直接展开所属讨论与素材。新增 1 个工作流（会永久保留）。
>
> 2026-11-24 V10.16 搜索高亮：结果摘要以命中词为中心截取，命中词包 `<mark>`（安全转义、不用 innerHTML），复盘与讨论结果都高亮。无新增表 / 工作流。
>
> 2026-11-24 V11.0 同伴经验域分组：「共建 / 我的 / 数据」三个内部视图，默认共建；共建=搜索+去向+同处境复盘，我的=贡献+校验池，数据=备份/本机标识。CSS 切换不卸载组件，保留搜索/排序状态。无新增表 / 工作流。
>
> 2026-11-24 V11.1 档案墙分组：「记忆 / 曲线 / 档案」三个内部视图，默认记忆；曲线=两点对比+成长河/单维，档案=阶段性胜利时间轴。沉浸查看时隐藏分段并显示全部；修正聚焦模式下档案卡的全宽规则。无新增表 / 工作流。
>
> 2026-11-24 V11.2 停靠驿站三步：拷问 → 回答三问 → 归档；归档成功回到拷问，右卡的可归档清单/漂移预览常驻。无新增表 / 工作流。
>
> 2026-11-24 V11.3 头部收口：保留数据状态/闭环/动效，新增「更多」菜单收纳数据口径、知乎快照时间与电气实训；外点/Esc 关闭。无新增表 / 工作流。
>
> 2026-11-24 V11.4 第 1 步快速定位：顶部新增基本事实/结构化测量/校准/判定结果锚点按钮，`scrollIntoView` + `scroll-margin-top` 避免被头部遮挡。无新增表 / 工作流。
>
> 2026-11-24 V11.5 二阶检索侧边抽屉：移除第 3 步底部区块，「选它·二阶深挖」直接开右侧抽屉（移动端底部 sheet）；「去作战图看执行清单」关闭抽屉并切视图。无新增表 / 工作流。
>
> 2026-11-24 V11.6 第 3 步三段式：顶部 `01 方向清单 → 02 二阶深挖 → 03 代价与清单`；02 开抽屉，03 切作战图，未选方向时提示。无新增表 / 工作流。
>
> 2026-11-24 V11.7 回到顶部：右下角固定按钮，滚动 >520px 出现，点击平滑回顶；与左下角陪伴浮层错开。无新增表 / 工作流。
>
> 2026-11-24 V11.8 板块滚动效果：`.y-zone` 滚动显现加强（上浮 + 轻微缩放），内部视图/驿站步骤切换时当前板块 `yPaneIn` 上浮淡入；减动效/动效关下关闭。无新增表 / 工作流。
