# 密钥与凭证交接

> 本目录只放**模板与说明**，**不放真实密钥**。
> 真实值一律通过运行环境注入，或在本地创建 `secrets/*.env`（已被 `.gitignore` 忽略）。

## 1. 当前状态（2026-11-22 打包时）

- **`ZHIHU_ACCESS_SECRET`：未包含。** 打包运行时该环境变量未设置，`~/.config/zhihu-cli/secret.env` 不存在，`zhihu-cli` 也未安装。
- 因此本交接包**无法内置可用的知乎 Access Secret**；应用运行本身不依赖它——知乎内容快照已内置在 `src/data/zhihu-snapshot.json`（256 条，`fetchedAt 2026-11-19 21:46`）。只有「刷新快照」才需要该密钥。
- 平台数据表的 **12 个工作流端点 token 不是密钥**，已登记在 `.project.md` 第 3 节与 `src/lib/yutuApi.ts`，交接包内已包含。
- `DEV_PROJECT_ID` / `DEV_SPACE_ID` 由平台运行时注入，用于建表 / 建 SQL API；**不要硬编码进前端**。

## 2. 知乎 Access Secret 的正确注入方式

```bash
# 方式 A：仅当前 shell（不要写进脚本/仓库）
export ZHIHU_ACCESS_SECRET='<由已授权账号签发的 Access Secret>'
python3 scripts/refresh-zhihu-snapshot.py

# 方式 B：本地文件（推荐，避免进入 shell 历史）
cp secrets/zhihu.env.example secrets/zhihu.env
chmod 600 secrets/zhihu.env
# 编辑 secrets/zhihu.env，填入真实值
set -a; . secrets/zhihu.env; set +a
python3 scripts/refresh-zhihu-snapshot.py
```

前置条件：本机需有官方 `zhihu-cli`（默认 `~/.local/share/zhihu-cli/current/zhihu-cli`，可用 `ZHIHU_CLI` 覆盖），且密钥对应账号拥有知乎开放平台的查询权限与配额。

## 3. 使用条件（必须遵守）

- 密钥与**已授权账号**绑定，权限范围、配额、有效期以该账号的实际授权为准；**不会**随 zip 转移给其他人。
- 只用于 `zhihu-cli search/hot` 刷新一次性快照；**禁止**放进前端、`import.meta.env`、提交记录、公开制品或截图。
- 不在浏览器端做运行时检索；浏览器只读取已生成的快照。
- 一旦怀疑泄露：立即在知乎开放平台 / 客户端撤销并重新签发；检查 git 历史、构建产物与 zip 分发记录。

## 4. 对外发布前的授权检查

知乎内容的使用边界（可展示什么、是否需要再分发许可、如何署名与回链）见 **`docs/ZHIHU-RIGHTS.md`**。
简言之：**访问密钥只证明「能查」，不等于获得「可对外转载/商用」的授权**；公开发布前请按该文档的清单逐项确认。
