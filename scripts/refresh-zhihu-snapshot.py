#!/usr/bin/env python3
"""用知乎官方 CLI 刷新页面内使用的知乎内容快照。

用法：
    export ZHIHU_ACCESS_SECRET=...
    python3 scripts/refresh-zhihu-snapshot.py

默认读取 ~/.local/share/zhihu-cli/current/zhihu-cli，可用 ZHIHU_CLI 覆盖。
输出 src/data/zhihu-snapshot.json；不把 Access Secret 写入任何文件。
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "zhihu-snapshot.json"
META = ROOT / "src" / "data" / "snapshot-meta.ts"
FIELD_CASES_OUT = ROOT / "src" / "data" / "field-cases-live.ts"
CLI = os.environ.get(
    "ZHIHU_CLI",
    str(Path.home() / ".local/share/zhihu-cli/current/zhihu-cli"),
)

FIELD_QUERIES = [
    ("civil", "土木 / 建筑 / 工程", "土木 造价 施工 就业 转行"),
    ("nursing", "护理 / 医学相关", "护理 大专 就业 出路"),
    ("it", "计算机 / IT / 数据", "计算机 大专 就业 出路"),
    ("edu", "学前教育 / 师范", "学前教育 大专 就业 出路"),
    ("finance", "会计 / 财务 / 经管", "会计 大专 就业 出路"),
    ("craft", "机电 / 数控 / 技能型", "机电 数控 大专 就业 出路"),
    ("law", "法学 / 法律", "法学 就业 出路 大专 本科"),
    ("media", "新闻 / 传媒 / 新媒体", "新闻传播 新媒体 就业 出路"),
    ("logistics", "物流 / 供应链 / 电商运营", "物流管理 供应链 就业 出路"),
    ("tourism", "旅游 / 酒店 / 会展", "旅游管理 酒店管理 就业 出路"),
    ("foreign", "外语 / 翻译 / 外贸", "英语 翻译 外贸 就业 出路"),
    ("design", "设计 / 艺术 / 视觉", "视觉传达 设计 就业 出路 大专"),
    ("psych", "心理 / 社会工作", "心理学 社会工作 就业 出路"),
    ("agri", "农学 / 畜牧 / 园林", "农学 畜牧 园林 就业 出路"),
]

def city_queries():
    """从 catalog.ts 读取全部城市，保证与页面选择器一致。"""
    text = (ROOT / "src" / "data" / "catalog.ts").read_text(encoding="utf-8")
    rows = re.findall(
        r'\{ id: "([a-z]+)", name: "([^"]+)", province:',
        text,
    )
    out = []
    for cid, name in rows:
        query = "县域 青年 就业 出路" if cid == "county" else f"{name} 应届生 就业 去向"
        out.append((cid, name, query))
    return out


CITY_QUERIES = city_queries()

NEW_FIELD_SPECS = [
    ("law", "法学 / 法律", r"法学|法律|律师|法务|司法|检察", r"法"),
    ("media", "新闻 / 传媒 / 新媒体", r"新闻|传媒|传播|新媒体|编辑|记者|广告", r"媒体"),
    ("logistics", "物流 / 供应链 / 电商运营", r"物流|供应链|采购|仓储|电商|运营|跨境", None),
    ("tourism", "旅游 / 酒店 / 会展", r"旅游|酒店|会展|民宿|导游|航空服务", None),
    ("foreign", "外语 / 翻译 / 外贸", r"外语|英语|翻译|外贸|商务英语|日语|小语种", r"语"),
    ("design", "设计 / 艺术 / 视觉", r"设计|艺术|视觉|美术|动画|摄影|工业设计", r"美"),
    ("psych", "心理 / 社会工作", r"心理|社会工作|社工|咨询", None),
    ("agri", "农学 / 畜牧 / 园林", r"农学|农业|畜牧|兽医|园林|园艺|种植|养殖", None),
]

STAGE_QUERIES = [
    ("explore", "在校探索期", "大专 应届生 求职 经历 2026"),
    ("entry", "初入职场期", "工作一年 想转行 经验"),
    ("pivot", "转向抉择期", "工作五年 转行 可迁移能力"),
    ("anchor", "稳态深耕期", "三十五岁 转行 家庭 负担"),
]


def clean_url(url: str) -> str:
    if not url:
        return ""
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def clean_title(title: str) -> str:
    return re.sub(r"\s*-\s*知乎\s*$", "", (title or "").strip())


def excerpt(text: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    pos = max(cut.rfind("。"), cut.rfind("！"), cut.rfind("？"), cut.rfind("；"))
    if pos >= 60:
        return cut[: pos + 1]
    return cut.rstrip() + "…"


def run_query(query: str, count: int = 5):
    cmd = [CLI, "search", "zhihu", "--query", query, "--count", str(count)]
    for attempt in range(3):
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=90,
            env={**os.environ, "NO_COLOR": "1"},
        )
        raw = (proc.stdout or "").strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = None
        if proc.returncode == 0 and data and data.get("Code") == 0:
            return data.get("Data", {}).get("Items", [])
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))
        else:
            sys.stderr.write(f"[warn] query failed: {query} :: {raw[:200]}\n")
            return []
    return []


def collect(entries, kind: str):
    out = {}
    for key, label, query in entries:
        sys.stderr.write(f"[fetch] {kind}:{key} ← {query}\n")
        items = run_query(query)
        seen = set()
        picked = []
        for item in items:
            url = clean_url(item.get("Url", ""))
            if not url or url in seen:
                continue
            seen.add(url)
            ctype = item.get("ContentType", "")
            picked.append(
                {
                    "title": clean_title(item.get("Title", "")),
                    "url": url,
                    "author": item.get("AuthorName", ""),
                    "type": "回答" if ctype == "Answer" else ("文章" if ctype == "Article" else "内容"),
                    "excerpt": excerpt(item.get("ContentText", "")),
                    "votes": int(item.get("VoteUpCount") or 0),
                }
            )
            if len(picked) >= 4:
                break
        out[key] = {"label": label, "query": query, "items": picked}
        time.sleep(0.45)
    return out


def write_field_cases(snapshot: dict) -> None:
    def j(value):
        return json.dumps(value, ensure_ascii=False)

    lines = [
        "import type { FieldCase } from './catalog';",
        "",
        "/** 由 scripts/refresh-zhihu-snapshot.py 自动生成：由快照扩展的 8 个专业大类。 */",
        "export const LIVE_FIELD_CASES: FieldCase[] = [",
    ]
    for key, label, kw, loose in NEW_FIELD_SPECS:
        group = snapshot["fields"].get(key, {})
        seen = set()
        items = []
        for item in group.get("items", []):
            title = (item.get("title") or "").strip()
            if not title or title in seen:
                continue
            seen.add(title)
            items.append(item)
        lines.append("  {")
        lines.append(f"    key: {j(key)},")
        lines.append(f"    label: {j(label)},")
        lines.append(f"    kw: /{kw}/,")
        if loose:
            lines.append(f"    loose: /{loose}/,")
        lines.append("    items: [")
        for item in items:
            lines.append("      {")
            lines.append(
                f"        title: {j(item.get('title', ''))}, url: {j(item.get('url', ''))},"
            )
            lines.append(
                f"        kind: {j(item.get('type') or '知乎内容')}, gist: {j(item.get('excerpt', ''))},"
            )
            lines.append("      },")
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    FIELD_CASES_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if not Path(CLI).exists():
        sys.stderr.write(f"zhihu-cli not found: {CLI}\n")
        return 1
    if not os.environ.get("ZHIHU_ACCESS_SECRET") and not Path(
        str(Path.home() / ".config/zhihu-cli/secret.env")
    ).exists():
        sys.stderr.write("ZHIHU_ACCESS_SECRET is not set\n")
        return 1

    fields = collect(FIELD_QUERIES, "field")
    cities = collect(CITY_QUERIES, "city")
    stages = collect(STAGE_QUERIES, "stage")

    tz = timezone(timedelta(hours=8))
    snapshot = {
        "source": "zhihu-cli",
        "fetchedAt": datetime.now(tz).strftime("%Y-%m-%d %H:%M"),
        "fields": fields,
        "cities": cities,
        "stages": stages,
    }
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    META.write_text(
        "/** 由 scripts/refresh-zhihu-snapshot.py 自动写入，避免首屏引入完整快照 JSON。 */\n"
        f"export const SNAPSHOT_AT = {json.dumps(snapshot['fetchedAt'], ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    write_field_cases(snapshot)
    total = sum(len(v["items"]) for group in (fields, cities, stages) for v in group.values())
    sys.stderr.write(f"[ok] wrote {OUT} ({total} items)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
