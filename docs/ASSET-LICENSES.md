# 素材授权核查表

> 用途：参赛「提交前检查」要求「第三方素材已注明来源并符合授权要求」。本表逐项列出项目内所有外部素材的来源、许可证与处置状态。
> 核查日期：2026-11-26 ｜ 对应版本：V12.4
> 相关文档：[`IMAGE-SOURCES.md`](IMAGE-SOURCES.md)（图片细节）、[`ZHIHU-RIGHTS.md`](ZHIHU-RIGHTS.md)（知乎内容边界）、[`DATA-SOURCES.md`](DATA-SOURCES.md)（数据口径）。

---

## 1. 总览

| 风险等级 | 数量 | 说明 |
|---|---|---|
| ✅ 可安全使用 | 22 个文件 | Unsplash License，免费商用 |
| ⚠️ 需确认授权 | 7 个文件 | 用户提供，仅限本项目；对外发布前需确认 |
| ⛔ 不应用途 | 10 个文件 | 带第三方水印，无授权，**已从页面与仓库移除** |
| 📄 内容引用 | 1 份 | 知乎快照，只存摘要与链接 |

---

## 2. ✅ Unsplash 图片（可安全使用）

许可证：[Unsplash License](https://unsplash.com/license) —— 免费用于商业与非商业用途，无需许可、无需署名（署名受赞赏）。**注意**：Unsplash+ 付费内容不在此列，本项目的图片均来自 unsplash.com 免费图库。

| 文件 | 用途 | 原始地址 |
|---|---|---|
| `scenery-hills.jpg/webp` | 驿站「慢一点」 | photo-1470071459604-3b5ec3a7fe05 |
| `scenery-city.jpg/webp` | 第 2 步区域构成 | photo-1477959858617-67f85cf4f1df |
| `scenery-people.jpg/webp` | 第 2 步讨论 / 第 6 步经验域 | photo-1529156069898-49953e39b3ac |
| `scenery-path.jpg/webp` | 第 3 步方向列表 | photo-1441974231531-c6227db76b6e |
| `scenery-ridge.jpg/webp` | 第 3 步真实记述 / 档案墙 | photo-1500534314209-a25ddb2bd429 |
| `scenery-pack.jpg/webp` | 第 4 步一次性资源 | photo-1501555088652-021faa106b9b |
| `scenery-plan.jpg/webp` | 第 4 步代价侧栏 | photo-1484480974693-6ca0a78fb36b |
| `scenery-field.jpg/webp` | 驿站金色田野（静态） | photo-1500382017468-9049fed747ef |
| `scenery-writing.jpg/webp` | 第 1 步判定结果下方 | photo-1455390582262-044cdead277a |
| `y-radar-city.jpg/webp` | 七维雷达底图（由 scenery-city 裁切） | 同上（city） |
| `scenery-morning.jpg/webp` | 备选（当前未使用） | photo-1493809842364-78817add7ffb |
| `scenery-sunrise.jpg/webp` | 备选（当前未使用） | photo-1500534623283-312aade485b7 |

**结论**：可直接用于参赛与公开展示；界面已注明来源。

---

## 3. ⚠️ 用户提供的素材（对外发布前需确认授权）

这些文件由团队/用户上传，文档标注「仅限本项目使用」。**参赛提交属于公开展示，需确认上传者拥有使用权。**

| 文件 | 用途 | 来源 | 授权状态 |
|---|---|---|---|
| `y-head-sea.jpg/webp` | 页面头部主视觉（海边清晨） | 用户上传 `.attachments/无日程的海边清晨 (1).png` | 待确认 |
| `yutu-bg-leaves.jpg/webp` | 全屏页面背景（叶面水珠） | 用户上传 | 待确认 |
| `yutu-button-glass.jpg/webp` | 主按钮 / 当前步骤彩玻璃底图 | 用户上传 | 待确认 |
| `loop-marble.webp` | 成长闭环弹珠 | 用户上传彩玻璃照片裁切 | 待确认 |
| `y-radar-glass.jpg/webp` | 七维雷达备选底图（未使用） | 同上 | 待确认 |
| `yutu-iris-nebula.jpg/webp` | 备选背景（未使用） | 用户上传 | 待确认 |
| `yutu-bg-ocean.jpg/webp` | 备选背景（未使用） | 用户上传 | 待确认 |

**处置**：
- 若为团队自摄 / 自绘 → 在计划书附录注明「本团队原创素材」即可。
- 若来自网络 → 替换为 Unsplash 同类图，或取得书面授权。
- **比赛前必须给出一句话结论**，否则评委按「未注明来源」扣分。

---

## 4. ⛔ 已移除的未授权素材（重要）

以下 10 个文件原图带抖音 / POISON / VKAH 水印，**无授权**，且从未接入页面（`grep` 确认 0 处引用）。2026-11-26 已从仓库移除，本地 `.attachments/` 仍保留原图。

| 文件 | 原图 | 处理 |
|---|---|---|
| `src/assets/photos/step1-road.jpg/webp` | 抖音水印 | 已删除（裁水印 ≠ 合规） |
| `src/assets/photos/step2-sea-bottle.jpg/webp` | VKAH | 已删除 |
| `src/assets/photos/step3-sea-hand.jpg/webp` | VKAH | 已删除 |
| `src/assets/photos/step4-salt-flat.jpg/webp` | POISON | 已删除 |
| `src/assets/photos/step5-birds.jpg/webp` | POISON | 已删除 |

> 如需恢复使用，必须先取得原作者授权。

---

## 5. 📄 知乎内容（见 ZHIHU-RIGHTS.md）

| 项 | 内容 | 边界 |
|---|---|---|
| `src/data/zhihu-snapshot.json` | 256 条问答摘要 + 原文链接，14 大类 / 46 城 / 4 阶段 | 只存摘要与链接，不转载全文；页头展示快照时间；刷新需 `ZHIHU_ACCESS_SECRET`（不随包提供） |
| 刘看山 SVG（内置） | `MascotVisual.tsx` 的回退图形 | 知乎官方 IP，仅用于本赛事作品展示，不作商标性使用 |

**结论**：符合「注明来源、可回溯原文」的要求；对外发布前建议保留 `ZHIHU-RIGHTS.md` 一并提交。

---

## 6. 远程素材（不随仓库分发）

| 项 | 地址 | 说明 |
|---|---|---|
| 吉祥物视频 | `/api/f/s3/app-dev/20261122/41b7cc64...mp4` | 用户提供，平台托管，需登录态；加载失败回退内置 SVG |
| 开篇朗诵录音 | 已从代码移除 | 仅留档，当前使用 Web Audio 合成音景 |

---

## 7. 开源依赖

- 全部依赖在 `package.json` 中列明，许可证以各自仓库为准（React / Vite / Radix UI / Leaflet 等均为 MIT / ISC / BSD）。
- `d3-delaunay` 为 ISC；`leaflet` 为 BSD-2-Clause。
- 本项目自身以 MIT 发布（见 `LICENSE`），不影响第三方许可证条款。

---

## 8. 提交前检查清单

- [x] 未授权水印图片已从仓库移除（2026-11-26）
- [x] Unsplash 图片已注明来源与许可证
- [x] 知乎内容只存摘要 + 原文链接
- [ ] **用户提供的 7 个素材：确认原创或取得授权**（当前唯一未闭环项）
- [ ] 计划书附录写明素材声明（可直接引用本文件第 3 节）

## 9. 核查命令（可复现）

```bash
# 确认 photos/ 已无引用
grep -rn "photos/step" src/ --include=*.tsx --include=*.ts --include=*.css

# 确认素材文件是否还在仓库
git ls-files src/assets/photos

# 查找代码中的外链
grep -rn "https://" src/ --include=*.tsx --include=*.ts | grep -v "github\|nuwax\|zhihu.com/question"
```
