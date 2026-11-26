# 图片来源

页面「两栏布局空隙」中使用的照片来自 Unsplash，遵循 [Unsplash License](https://unsplash.com/license)（免费使用，无需署名；界面中已注明来源）。图片已下载并随项目打包，避免运行时依赖外部图床。主按钮底图与页面背景由用户提供，见下文「主按钮彩玻璃与页面背景」。

| 文件 | 用途 | 原始地址 |
|---|---|---|
| `src/assets/scenery-hills.jpg` | 第六步「慢一点」空隙 | https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05 |
| `src/assets/scenery-sunrise.jpg` | 第六步「驿站 · 休息」空隙 | https://images.unsplash.com/photo-1500534623283-312aade485b7 |
| `src/assets/scenery-city.jpg` | 第二步「区域构成」空隙（城市俯瞰） | https://images.unsplash.com/photo-1477959858617-67f85cf4f1df |
| `src/assets/scenery-people.jpg` | 第二步「近期讨论」/ 第六步「经验域」空隙（同伴） | https://images.unsplash.com/photo-1529156069898-49953e39b3ac |
| `src/assets/scenery-path.jpg` | 第三步「方向列表」空隙（岔路） | https://images.unsplash.com/photo-1441974231531-c6227db76b6e |
| `src/assets/scenery-ridge.jpg` | 第三步「真实记述」/ 第五步「参考域」/ 第六步「档案墙」空隙（层叠山脊） | https://images.unsplash.com/photo-1500534314209-a25ddb2bd429 |
| `src/assets/scenery-pack.jpg` | 第四步「一次性资源」空隙（行囊） | https://images.unsplash.com/photo-1501555088652-021faa106b9b |
| `src/assets/scenery-plan.jpg` | 第四步「点选方向代价」侧栏空隙（手账计划） | https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b |
| `src/assets/scenery-field.jpg` | 第五步「归属与周边域」空隙（田野） | https://images.unsplash.com/photo-1500382017468-9049fed747ef |
| `src/assets/scenery-writing.jpg` | 第一步右侧「判定结果」下方（钢笔书写近景；2026-11-26 由 morning 换回，保持静止） | https://images.unsplash.com/photo-1455390582262-044cdead277a |
| `src/assets/scenery-morning.jpg` | 备选素材，当前未使用（晨光极简客厅为单点透视构图，2026-11-26 因「不要透视」撤下） | https://images.unsplash.com/photo-1493809842364-78817add7ffb |

下载参数统一为 `fm=jpg&fit=crop&w=1100&h=700&q=72`；下载日期：2026-11-20；`scenery-writing` 于 2026-11-22 追加，`scenery-morning` 于 2026-11-24 追加（q=80）。`scenery-sunrise` 仍用于第六步驿站休息，第一步不再使用。

> `scenery-morning` 的命名对应「高级阳光早晨」：极简客厅、落地窗、木地板、柔和晨光。它不是 Midjourney 生成图，而是 Unsplash 的真实照片（Unsplash License，免费使用）。同名 `-motion.webp` 由静态图按现有规格生成：640×400、16 帧、5% 缓慢推进再回位、`-delay 7 -quality 55`。

## 悬停动效

每张静态图另有一份同名 `-motion.webp`：

- 规格：640×400、16 帧、循环、约 5% 的缓慢推进再回位；
- 生成方式：由同名静态图用 ImageMagick 逐帧缩放裁切，`-delay 7 -quality 55` 合成；
- 使用规则：默认只加载静态图；仅在支持悬停的设备上、指针停留 180ms 后才按需加载并播放，移开即卸载；`prefers-reduced-motion: reduce` 时始终只显示静态图。
- 出现条件：`GapPhoto` 是两栏布局里的弹性占位，只有测量到 ≥64px 的真实剩余高度才显示；没有空隙时高度为 0，不会额外撑高页面或留下空白。

图片与板块的对应关系由 `src/components/GapPhoto.tsx` 中的 `PhotoVariant` 统一管理。  
暗色主题（V8）下照片统一压暗：`.y-gap-photo img` 使用 `brightness(.62)` 并叠底部暗层；`sunrise` 变体额外压到 `brightness(.48)` 并对太阳位置叠一层径向暗层，避免驿站出现刺眼的过曝区域。  
如后续换成正式商业图库，请同步替换本文件与界面中的来源标注。

## 主按钮彩玻璃与页面背景（2026-11-22）

### 主按钮 / 当前步骤

来自用户提供的彩绘玻璃图片（`.attachments/微信图片_20261122050644_394_2.jpg`）。已顺时针旋转 90° 并裁成横向色带，输出到 `src/assets/`：

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/assets/yutu-button-glass.webp` | `.y-btn-main` 主按钮 / 当前步骤 / 选中子页签（优先） | 1600×403，q78 |
| `src/assets/yutu-button-glass.jpg` | 同上，JPEG fallback | 1600×403，q84 |

按钮上叠加深色渐变层保证白字可读；底图缓慢横向流动（`yBtnFlow`），暗部叠层做 `yBtnDeepen` 明暗呼吸，悬停时加快并进一步加深。顶部步骤条中的「当前步骤」和闭环选中的子页签使用同一张底图；`prefers-reduced-motion` / 「动效 关」下只保留静态底图。

### 全屏页面背景

来自用户提供的叶面水珠照片（`.attachments/微信图片_20261122064702_400_2.jpg`），输出到 `src/assets/`：

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/assets/yutu-bg-leaves.webp` | **全屏页面背景（优先）** | 用户提供，1600×1200，约 327 KB |
| `src/assets/yutu-bg-leaves.jpg` | 同上，JPEG fallback | 1600×1200，约 470 KB |

背景图以 72s 缓慢平移、缩放与旋转，叠加一层淡蓝/淡紫呼吸光晕；`#yutu2` 保持半透明磨砂玻璃，卡片可读。`prefers-reduced-motion` / 「动效 关」下只保留静态背景。**背景照片由用户提供，仅限本项目使用；如需对外发布请确认授权。**

> 2026-11-24 V10.7 回退：全屏背景恢复为上述叶面水珠，移除星云/水下/背景切换。`yutu-iris-nebula.*` 与 `yutu-bg-ocean.*` 仍保留在 `src/assets/` 作为备选素材，但当前未被引用。

## 成长闭环弹珠（2026-11-24）

来自用户上传的彩绘玻璃照片 `.attachments/微信图片_20261122050644_394_2_1795527595034_915647.jpg`（1279×2782），裁成方形、做成圆形透明弹珠后输出：

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/assets/loop-marble.webp` | 成长闭环轮盘上滚动的弹珠 | 256×256，圆形透明底，叠加高光与白边；约 24 KB |

生成方式：ImageMagick 从原图裁 `1279×1279+0+200` → 缩放 256×256 → 圆形 alpha 遮罩 → 左上高光 → 白色描边。**图片由用户提供，仅限本项目使用；如需对外发布请确认授权。**

## 步骤背景候选图（2026-11-22）

来自用户提供的 5 张截图，已裁掉水印并输出 JPEG/WebP 到 `src/assets/photos/`，详见该目录 `README.md`。已按反馈回退，当前**未接入页面**；素材保留在资源目录但未被引用。**没有授权**，如需使用请先取得授权。

| 文件 | 去水印 | 计划用途 |
|---|---|---|
| `src/assets/photos/step1-road.jpg` | 裁右侧/底部（抖音 Logo） | 第 1 / 4 步封面候选 |
| `src/assets/photos/step2-sea-bottle.jpg` | 裁底部（VKAH） | 第 2 步区域/探索 |
| `src/assets/photos/step3-sea-hand.jpg` | 裁底部（VKAH） | 第 2 / 3 步探索 |
| `src/assets/photos/step4-salt-flat.jpg` | 裁底部（POISON） | 第 3 / 4 步方向与归属（试点） |
| `src/assets/photos/step5-birds.jpg` | 裁底部（POISON） | 第 5 步成长/休整（试点） |

## 开篇朗诵录音（2026-11-25）

- 来源：用户提供的一段朗诵录音（m4a / AAC），用于 `/#/` 开篇名句「泻水置平地，各自东西南北流」。
- 地址：`https://agent.nuwax.com/api/f/s3/app-dev/20261125/32d36e5a83aa4526bf7dcad9e50b738a.m4a`（当前使用，原声播放）
  - 另有若干候选素材（`e432e071…`、`64465fff…`、`077b86a5…`、`bc03df95…`、`2fb213bb…`），未使用；切换只需改 `Overture.tsx` 的 `VOICE_URL`。
  - 当前完全原样播放：不降调、不做 EQ / 滤波 / 音量归一化，只保留静音开关。
  - 该地址需要平台登录态，服务端直接下载返回 401；前端在平台预览域内同源加载，浏览器自带登录 cookie。
  - 加载失败或自动播放被拦截时，`Overture` 自动回退为 Web Audio 合成的逐字磬音，不会静音或报错。
- 版权：录音由用户提供，仅用于本项目开篇演示；对外发布前请先确认所有权与使用范围。
- **当前状态（2026-11-25）**：真人录音的播放链路已从 `Overture` 中移除，代码不再引用该地址；开篇只使用 Web Audio 合成音景。本条仅作素材留档。
