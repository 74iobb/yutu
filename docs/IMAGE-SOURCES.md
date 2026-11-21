# 图片来源

页面「两栏布局空隙」中使用的照片来自 Unsplash，遵循 [Unsplash License](https://unsplash.com/license)（免费使用，无需署名；界面中已注明来源）。图片已下载并随项目打包，避免运行时依赖外部图床。主按钮底图由用户提供，见下文「主按钮彩绘玻璃底图」。

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

下载参数统一为 `fm=jpg&fit=crop&w=1100&h=700&q=72`；下载日期：2026-11-20。

## 悬停动效

每张静态图另有一份同名 `-motion.webp`：

- 规格：640×400、16 帧、循环、约 5% 的缓慢推进再回位；
- 生成方式：由同名静态图用 ImageMagick 逐帧缩放裁切，`-delay 7 -quality 55` 合成；
- 使用规则：默认只加载静态图；仅在支持悬停的设备上、指针停留 180ms 后才按需加载并播放，移开即卸载；`prefers-reduced-motion: reduce` 时始终只显示静态图。
- 出现条件：`GapPhoto` 是两栏布局里的弹性占位，只有测量到 ≥64px 的真实剩余高度才显示；没有空隙时高度为 0，不会额外撑高页面或留下空白。

图片与板块的对应关系由 `src/components/GapPhoto.tsx` 中的 `PhotoVariant` 统一管理。  
如后续换成正式商业图库，请同步替换本文件与界面中的来源标注。

## 主按钮彩绘玻璃底图（2026-11-22）

来自用户提供的彩绘玻璃图片（`.attachments/微信图片_20261122050644_394_2.jpg`）。已顺时针旋转 90° 并裁成横向色带，输出到 `src/assets/`：

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/assets/yutu-button-glass.webp` | `.y-btn-main` 主按钮 / 当前步骤背景（优先） | 1600×403，q78 |
| `src/assets/yutu-button-glass.jpg` | 同上，JPEG fallback | 1600×403，q84 |
| `src/assets/yutu-glass-bg.webp` | 全屏彩玻璃底色 / `#yutu2` 纸面彩光（优先） | 1600×900，深度模糊，q80 |
| `src/assets/yutu-glass-bg.jpg` | 同上，JPEG fallback | 1600×900，q82 |

按钮上叠加深色渐变层保证白字可读；底图缓慢横向流动（`yBtnFlow`），暗部叠层做 `yBtnDeepen` 明暗呼吸，悬停时加快并进一步加深。顶部步骤条中的「当前步骤」使用同一张底图与暗层，扫光与横向流动合并到 `yStepSheen`。页面底色使用 `yutu-glass-bg`：固定光场缓慢漂移 + 明暗呼吸，`#yutu2` 纸面再用 `color` 混合模式叠一层同源彩光，卡片保持暖白可读。`prefers-reduced-motion` / 「动效 关」下只保留静态底图与静态暗层。**图片由用户提供，仅限本项目使用；如需对外发布请确认授权。**

## 步骤背景候选图（2026-11-22）

来自用户提供的 5 张截图，已裁掉水印并输出 JPEG/WebP 到 `src/assets/photos/`，详见该目录 `README.md`。已按反馈回退，当前**未接入页面**；素材保留在资源目录但未被引用。**没有授权**，如需使用请先取得授权。

| 文件 | 去水印 | 计划用途 |
|---|---|---|
| `src/assets/photos/step1-road.jpg` | 裁右侧/底部（抖音 Logo） | 第 1 / 4 步封面候选 |
| `src/assets/photos/step2-sea-bottle.jpg` | 裁底部（VKAH） | 第 2 步区域/探索 |
| `src/assets/photos/step3-sea-hand.jpg` | 裁底部（VKAH） | 第 2 / 3 步探索 |
| `src/assets/photos/step4-salt-flat.jpg` | 裁底部（POISON） | 第 3 / 4 步方向与归属（试点） |
| `src/assets/photos/step5-birds.jpg` | 裁底部（POISON） | 第 5 步成长/休整（试点） |
