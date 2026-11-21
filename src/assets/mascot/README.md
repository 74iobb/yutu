# 吉祥物素材接入位

把吉祥物文件放到本目录，构建时会自动接入：

- 优先：透明背景 `mascot.webm`（VP9 + alpha）或 `mascot.mov`（HEVC + alpha）
- 也可以：`mascot.mp4`（会按圆形裁切显示）
- 静态动图：`mascot.gif` / `mascot.webp`

文件名建议从 `mascot` 开头。`MascotVisual` 会自动选择本地视频 / 动图 / 远程视频 / 内置刘看山 SVG。
不需要改代码。

当前远程视频（用户提供）：
`/api/f/s3/app-dev/20261122/41b7cc64bc7d438989c06024b9115d74.mp4`

本地文件优先级高于远程视频；如果远程视频加载失败，会自动回退到内置 SVG。
