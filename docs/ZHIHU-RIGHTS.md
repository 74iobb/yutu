# 知乎内容使用与授权说明

> 适用范围：`src/data/zhihu-snapshot.json`、`scripts/refresh-zhihu-snapshot.py`、第 2/3 步展示的「近期讨论 / 社区讨论 / 同类处境者记述」。
> 本文是工程侧的**使用边界与待确认事项**，不构成法律意见；对外发布前请按第 5 节清单逐项确认。

---

## 1. 内容是怎么来的

- **来源**：知乎开放平台官方命令行 `zhihu-cli`（`search zhihu` / `search global` / `hot`），由**已授权账号**的 Access Secret 调用。
- **形态**：一次性检索**快照**，不是运行时实时抓取，也不会在页面打开时更新。
- **当前快照**：`fetchedAt = 2026-11-19 21:46`，共 **256 条**，覆盖 **14 个专业大类 / 46 个城市 / 4 个阶段**。
- **生成脚本**：`scripts/refresh-zhihu-snapshot.py`（26 组查询，写入 `src/data/zhihu-snapshot.json` 与 `snapshot-meta.ts`）。
- **访问密钥**：仅通过 `ZHIHU_ACCESS_SECRET` 注入，仓库与前端均不保存；交接包的密钥说明见 `secrets/README.md`。

## 2. 快照里到底存了什么

每个条目只保存以下字段：

| 字段 | 内容 |
|---|---|
| `title` | 原题 / 原文章标题 |
| `url` | 知乎原文链接（可回跳核对） |
| `author` | 原作者名 |
| `type` | 回答 / 文章 / 亲历记述等类型标注 |
| `excerpt` | 检索结果提供的**摘要**，不是全文 |
| `votes` | 抓取时的公开赞数 |

**不保存**：正文全文、用户隐私数据、登录态 / Cookie、联系方式、付费内容、密钥或任何凭证。

## 3. 界面如何展示

- 每条内容都保留**作者、原文链接与类型标注**，点击「原文」跳转知乎。
- 页头标注快照时间 `2026-11-19 21:46`，避免被误读为实时数据。
- 摘要用于「同类处境者的记述」与「近期讨论」，不做改写后冒充平台结论；所有模型结论均与内容展示分开标注（`REAL / SELF / CURATED / APPROX / HEURISTIC`）。
- 页面不批量搬运全文，也不做站内镜像；仅展示检索结果摘要。

## 4. 权利状态（关键）

1. **访问密钥 ≠ 内容授权。**
   Access Secret 只证明持有者账号具备查询权限，**不代表**获得知乎内容的复制、转载、再分发或商用许可。
2. **账号授权范围随账号走。**
   权限、配额、有效期以该知乎账号在开放平台的实际授权为准；把 zip 交给下一个智能体/开发者，**不会**转移该授权。
3. **当前快照的定位。**
   仅用于本项目内部演示、研究与产品验证。对外公开发布（含演示视频、公网部署、宣传物料）前，需确认是否符合知乎开放平台条款、用户协议与内容版权要求。
4. **可替代方案。**
   若无法确认再分发许可，发布前可：仅保留标题 + 原文链接；改为项目自写的观察摘要；或替换为已获授权的自有内容。
5. **其他素材不在此授权内。**
   页面背景（用户提供）、Unsplash 照片、拟用截图等各有独立授权状态，见 `docs/IMAGE-SOURCES.md` 与 `src/assets/photos/README.md`。`src/assets/photos/` 中 5 张裁切图**没有授权且未接入页面**。

## 5. 对外发布前检查清单

- [ ] 已确认知乎开放平台账号的**授权范围 / 配额 / 有效期**。
- [ ] 未缓存或展示正文全文，未绕过登录、付费墙或反爬限制。
- [ ] 每条内容保留**作者 + 原文链接**，摘要未篡改、未伪造为平台结论。
- [ ] 已确认公开展示 / 再分发是否符合知乎条款；不确定时已改为「标题 + 链接」或自写摘要。
- [ ] 页面显著标注**快照时间**与「不代表实时检索」。
- [ ] Access Secret 未进入前端、构建产物、Git 历史、公开 zip 或截图。
- [ ] 用户提供的背景图 / 截图 / 其他素材的授权状态已单独确认。

## 6. 刷新、撤销与轮换

```bash
# 刷新（需要已授权的 Key 与本机 zhihu-cli）
export ZHIHU_ACCESS_SECRET='...'
python3 scripts/refresh-zhihu-snapshot.py
# 然后重新构建
pnpm build
```

- **撤销 / 轮换**：在知乎开放平台或桌面客户端撤销旧 Secret，重新签发；更新本地 `secrets/zhihu.env`（已 gitignore），不要改代码。
- 若怀疑泄露：先撤销，再排查 git 历史、构建产物、日志与已分发的 zip；不要在公开渠道贴出 Secret 片段。
- 重新生成快照后，`snapshot-meta.ts` 的 `SNAPSHOT_AT` 会自动更新，页头时间随之变化。

## 7. 与代码的对应关系

| 位置 | 作用 |
|---|---|
| `src/data/zhihu-snapshot.json` | 只读快照（title/url/author/type/excerpt/votes） |
| `src/data/snapshot-meta.ts` | `SNAPSHOT_AT` 快照时间 |
| `src/data/live.ts` | 读取快照、按城市/阶段/专业检索与去重 |
| `scripts/refresh-zhihu-snapshot.py` | 用 `zhihu-cli` 生成快照；只读 `ZHIHU_ACCESS_SECRET` |
| `secrets/README.md` | 密钥注入、使用条件与轮换 |
| `docs/DATA-SOURCES.md` | 每条数据来源与 `REAL/APPROX/...` 标注 |
