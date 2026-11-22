# 域途 · 交接说明（给下一个智能体）

> 交接时间：2026-11-22　交接版本：V8.13（四步版）
> 请按顺序读：**本文件 → `.project.md` → `docs/MODEL.md` / `docs/DATA-SOURCES.md` / `docs/VERIFICATION.md`**，再动代码。
> `.project.md` 是数据表、工作流 token、前端调用约定的**唯一事实来源**；本文件只补充「怎么跑、怎么验、别踩什么坑」。

---

## 0. 30 秒认识项目

- **项目**：域途 · 多维沃罗诺伊体验式生涯陪伴系统（知乎黑客松 S3）。
- **技术栈**：Vite 5 + React 18 + TypeScript + Tailwind + Leaflet/OSM + d3-delaunay。
- **模板**：`react-vite`（系统预设，**不可改成 Vue / 其他模板**）。
- **路由**：`HashRouter`，`/#/` 直接进入四步主流程。
- **四步**：填写信息 → 了解环境 → 方向与推演（方向清单 / 作战图 / 归属摘要）→ 成长闭环。
- **当前视觉**：V8 系列暗色玻璃 + 叶面水珠背景；最近一次改动为 V8.13（作战图公里标识与两处空状态去曝光）。

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

- 包内附带 **`dist/` 预构建快照**（2026-11-22 构建），可直接 `pnpm preview`；**改源码后请重新 `pnpm build`**，不要直接改 `dist/`。
- 本地 `vite dev` 没有平台的页面代理时，前端会**自动降级为 `localStorage`**（键 `yutu.state.v2`），页头显示「本地存储模式」。这是正常行为，不是 bug。
- 平台内打开时自动使用数据表工作流；`POST /api/page/w/{token}` 为同源请求，浏览器自带登录态，**不要在请求头里加密钥**。
- 依赖安装若遇到 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`：本项目 `.npmrc` 与 `pnpm-workspace.yaml` 已固定 `confirmModulesPurge: false`，再执行一次 `pnpm install --prefer-offline` 即可。

---

## 2. 平台数据与接口

- 启用中的 **12 个 SQL 操作 API（实为工作流）**：`profile_get/save`、`tasks_list/add/update_status/delete`、`archive_list/add`、`reviews_list/add`、`marks_add/list`。
- **端点 token、绑定表、入参、SQL 要点**：见 `.project.md` 第 2、3 节；前端映射在 `src/lib/yutuApi.ts` 的 `API_ENDPOINTS`。
- 已停用、**不要再接入**：`peer_samples_*`（5269613–5269616）、`archive_choice_stats`（5269617）。
- 请求路径：`POST /api/page/w/{token}`；查询数据在 `data.outputList`，写操作只回 `success`。
- 用户隔离：`ownerKey` 由前端生成并保存在 `localStorage: yutu.ownerKey`，所有个人表按此过滤。
- 新增接口的固定顺序：**建表 → 建 SQL 操作 API → 登记 `.project.md`（表 ID / 物理表名 / token / SQL / 入出参）→ `yutuApi.ts` → `YutuContext` → 组件**。
- 组件**禁止**直接 `fetch` 或消费后端列名；列名映射集中在 `yutuApi.ts`。
- 平台没有工作流删除接口，**禁止创建测试 SQL 工作流**（如 `SELECT 1`）来探测连通性，会永久残留。
- 数据表位于项目空间 `DEV_SPACE_ID`；建表/查表必须带 `spaceId`（由平台环境变量注入，不要改用个人空间）。

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

**包含**：全部源码、配置、锁文件（`pnpm-lock.yaml`）、`.npmrc`、`docs/`、`legacy/`、`scripts/`、`.project.md`、`README.md`、本文件、`AGENTS.md`、`.claude/.agents/.codex/.opencode` 的 skills、预构建 `dist/`。

**排除**：`node_modules/`、`.git/`、`.attachments/`（用户截图）、`dist-packages/`、`*.zip`、临时日志与 `vite.config.ts.timestamp-*`。

> 需要完整 git 历史时，请在平台仓库侧获取；本 zip 以「可运行 + 可继续开发」为目标。

---

## 9. 最近变更

完整变更记录见 `.project.md` 第 5 节。最新一条：**V8.13 方向与推演去曝光**（圈层公里 pill、Leaflet 比例尺、`y-empty` 空状态、暗色滚动条）。仅前端样式，无新增表 / 工作流；`type-check`、`lint`、`build` 均通过。
