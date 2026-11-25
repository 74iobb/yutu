# AGENTS.md · 域途项目给智能体的硬约束

本仓库是系统预设的 **`react-vite`** 项目（Vite 5 + React 18 + TypeScript），**不可改为 Vue 或其他模板**。

## 必读顺序

1. `docs/PHILOSOPHY.md` —— **产品圣经**：不教人怎么活、不给建议、真实显影、决策沙盘。改文案 / 模型 / 数据前先过这一页。
2. `HANDOFF.md` —— 怎么安装、怎么跑、验收清单、已知坑。
3. `.project.md` —— **唯一事实来源**：数据表、工作流 ID、端点 token、SQL、前端调用约定、变更记录。
4. `docs/` —— 模型、数据来源、验证、设计系统、动效、图片授权。
5. `.claude/skills/taste/SKILL.md` —— 审美与体验门禁（交付前必过）。

## 常用命令

```bash
pnpm install --prefer-offline   # 安装（无 TTY 中止时再跑一次）
pnpm dev                        # 本地开发（无平台代理时自动降级 localStorage）
pnpm type-check                 # TypeScript
pnpm lint                       # ESLint（0 warnings）
pnpm build                      # 生产构建
pnpm preview                    # 预览 dist/
```

## 硬约束

- 路由必须保持 **HashRouter**，`/#/` 必须是真实业务首页。
- 前端只通过 `src/lib/yutuApi.ts` 调用平台工作流：`POST /api/page/w/{token}`；**组件禁止直接 fetch**，禁止消费后端列名。
- token / 表结构一律从 `.project.md` 取；改数据层后必须同步更新 `.project.md`。
- **不要创建测试 SQL 工作流**（平台无删除接口，会永久残留）；不要用假数据探测连通性。
- 不硬编码密钥、Access Secret、内网 IP；不访问 localhost / 内网服务。
- 知乎 Access Secret 只通过环境变量或本地 `secrets/*.env`（已 gitignore）注入；真实值绝不入库 / 进前端 / 进公开制品。知乎内容的对外展示与再分发边界见 `docs/ZHIHU-RIGHTS.md`，密钥说明见 `secrets/README.md`。
- 保留 `vite.config.ts` 中 `DEV-INJECT-START` / `DEV-INJECT-END` 之间的全部内容。
- `legacy/` 原始原型勿删；不要手工编辑 `cpage_config.json`。
- 新数据表/接口顺序：建表 → 建 SQL API → 登记 `.project.md` → `yutuApi.ts` → `YutuContext` → 组件。
- 新增浅色 UI 时检查暗色主题是否形成「曝光」亮块（空状态、地图控件、比例尺、滚动条是历史高发区）。
- **不给建议**：界面不得出现「推荐 / 建议 / 应该 / 最好 / 优先选」；只陈述条件、代价与事实；可行性只用「当前可做 / 需补条件 / 条件不足」。
- **不编造数据**：检索不到就说检索不到；没有「同路人去向城市」数据就不画「去向」飞线；一切数字必须能在 `provenance.ts` 找到口径。
- 沙盘的自定义步骤只记录用户决定、投入与检索原文，**不得推断七维变化**。
- 改完代码至少跑通：`pnpm type-check && pnpm lint && pnpm build`。
- 交付前用 `taste` skill 做一次六维审查（层级 / 一致性 / 数据诚实 / 动效 / 状态 / 响应式），P0 必须为 0。

## 入口速查

- 步骤定义：`src/components/Shell.tsx` 的 `STEP_META`（4 步）、`src/lib/model.ts` 的 `TOTAL_STEPS = 4`。
- 第 3 步三视图：`src/components/Step34.tsx`（清单 / 作战图 `Step4.tsx` / 归属摘要 `StepSummary.tsx`）。
- 第 4 步闭环：`src/components/Step6.tsx`、`LoopMap.tsx`。
- 沙盘：`#/sandbox`，`src/pages/Sandbox.tsx` + `src/lib/sandbox.ts` + `src/components/SandboxBoard.tsx` + `src/sandbox.css`；本机键 `yutu.sandbox.v2`。
- 状态与持久化：`src/store/YutuContext.tsx`（`yutu.state.v3`、`yutu.ownerKey`；旧 v2 会被自动清理）。
- 样式总入口：`src/yutu.css`（作用域 `#yutu2`，V8 暗色覆盖在文件后段）。
