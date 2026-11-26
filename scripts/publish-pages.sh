#!/usr/bin/env bash
# 构建并把 dist 推送到 GitHub Pages 的 gh-pages 分支。
# 用法：pnpm run publish:pages
# 前置：仓库 Settings → Pages → Source = Deploy from a branch / gh-pages / (root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="$(git remote get-url origin)"

echo "==> 构建"
pnpm build

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -r dist/. "$TMP/"
cd "$TMP"
git init -q
git config user.name "$(cd "$ROOT" && git config user.name || echo 'Nuwax File Server')"
git config user.email "$(cd "$ROOT" && git config user.email || echo 'git@nuwax.com')"
git add -A
git commit -q -m "chore: publish site $(date '+%Y-%m-%d %H:%M')"
git remote add origin "$REMOTE"
git push -f origin HEAD:gh-pages

echo "==> 已推送到 gh-pages：https://74iobb.github.io/yutu/"
