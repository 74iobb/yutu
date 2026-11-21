/**
 * 「按你填写的内容检索」的确定性检索层。
 *
 * 数据范围全部是项目里已经收集到的真实内容：
 * - `zhihu-snapshot.json`：14 个专业大类 / 46 城 / 4 阶段的知乎检索快照
 * - `FIELD_CASES`：按专业大类整理的精编案例
 * - `CASES`：按阶段整理的精编案例
 * - `ASSETS` / `TENSIONS`：资源与方向关系的原文证据
 *
 * 不调用运行时网络检索：输入什么词，就在上述真实语料里按关键词打分排序；
 * 没有命中时返回空结果，由调用方明确标注“未检索到直接相关内容”，
 * 不允许把阶段通用内容伪装成“按你的方向检索”。
 */
import {
  ASSETS,
  CASES,
  STAGES,
  TENSIONS,
  type CaseItem,
  type FieldCase,
  type StageId,
} from '@/data/catalog';
import { ALL_FIELD_CASES } from '@/data/field-cases';
import { SNAPSHOT, type LiveItem } from '@/data/live';
import {
  fieldTokens,
  matchFieldCategory,
  MIN_SCORE,
  normalize,
  scoreDocText,
  scoreText,
} from '@/lib/searchCore';

export { fieldTokens, matchFieldCategory, MIN_SCORE } from '@/lib/searchCore';

/* ------------------------------ 语料 ------------------------------ */

interface Doc {
  title: string;
  url: string;
  text: string;
  source: string;
  kind: string;
  author?: string;
  type?: string;
  votes?: number;
  stage?: string;
  fromSnapshot: boolean;
}

export interface SearchHit {
  title: string;
  url: string;
  excerpt: string;
  source: string;
  kind: string;
  author?: string;
  type?: string;
  votes?: number;
  fromSnapshot: boolean;
  score: number;
}

const DOCS: Doc[] = [];
const seenUrl = new Set<string>();

function addDoc(doc: Doc) {
  if (!doc.url || seenUrl.has(doc.url)) return;
  seenUrl.add(doc.url);
  DOCS.push(doc);
}

function snapshotDoc(
  group: { label: string; items: LiveItem[] },
  source: string,
  stage?: string
) {
  group.items.forEach((it) => {
    addDoc({
      title: it.title,
      url: it.url,
      text: `${it.title} ${it.excerpt}`,
      source,
      kind: it.type || '知乎内容',
      author: it.author,
      type: it.type,
      votes: it.votes,
      stage,
      fromSnapshot: true,
    });
  });
}

Object.values(SNAPSHOT.fields).forEach((g) =>
  snapshotDoc(g, `专业 · ${g.label}`)
);
Object.values(SNAPSHOT.cities).forEach((g) =>
  snapshotDoc(g, `城市 · ${g.label}`)
);
Object.entries(SNAPSHOT.stages).forEach(([sid, g]) =>
  snapshotDoc(g, `阶段 · ${g.label}`, sid)
);

ALL_FIELD_CASES.forEach((f) => {
  f.items.forEach((it) => {
    addDoc({
      title: it.title,
      url: it.url,
      text: `${it.title} ${it.gist} ${f.label}`,
      source: `精编案例 · ${f.label}`,
      kind: it.kind,
      fromSnapshot: false,
    });
  });
});

Object.entries(CASES).forEach(([sid, items]) => {
  const label = STAGES.find((s) => s.id === sid)?.name ?? sid;
  items.forEach((it) => {
    addDoc({
      title: it.title,
      url: it.url,
      text: `${it.title} ${it.gist}`,
      source: `阶段案例 · ${label}`,
      kind: it.kind,
      stage: sid,
      fromSnapshot: false,
    });
  });
});

ASSETS.forEach((a) => {
  a.evidence.forEach((ev) => {
    addDoc({
      title: ev.title,
      url: ev.url,
      text: `${ev.title} ${ev.quote} ${a.name}`,
      source: `资源证据 · ${a.name}`,
      kind: '资源证据',
      fromSnapshot: false,
    });
  });
});

TENSIONS.forEach((t) => {
  addDoc({
    title: `方向关系：${t.a} ↔ ${t.b}`,
    url: t.url,
    text: `${t.note} ${t.basis} ${t.a} ${t.b}`,
    source: '方向关系证据',
    kind: '方向张力',
    fromSnapshot: false,
  });
});

/* ------------------------------ 打分 ------------------------------ */

/** 可检索的真实语料条数（用于界面如实说明检索范围） */
export const DOC_COUNT = DOCS.length;

export interface FieldSearchResult {
  query: string;
  tokens: string[];
  category: FieldCase | null;
  hits: SearchHit[];
}

export function searchByField(
  field: string,
  stageId: StageId,
  limit = 12
): FieldSearchResult {
  const query = (field || '').trim();
  const category = matchFieldCategory(query);
  const tokens = fieldTokens(query);
  const phrase = normalize(query).replace(/\s+/g, '');
  if (!query) return { query, tokens, category: null, hits: [] };

  const hasLongToken = tokens.some((t) => t.length >= 3);
  const threshold = hasLongToken ? MIN_SCORE + 2 : MIN_SCORE;

  const hits = DOCS.map((doc) => {
    const body = doc.text.toLowerCase();
    let maxMatchedLen = 0;
    for (const token of tokens) {
      if (token.length > maxMatchedLen && body.includes(token)) {
        maxMatchedLen = token.length;
      }
    }
    let score = scoreDocText(doc.title, doc.text, tokens, phrase);
    if (score > 0 && category && doc.source.includes(category.label)) {
      score += 3;
    }
    if (score > 0 && doc.stage === stageId) score += 1.5;
    return { doc, score, maxMatchedLen };
  })
    .filter(
      (x) =>
        x.score >= threshold &&
        /* 输入里有 3 字以上的具体词时，必须匹配到至少一个具体词；
           防止长句只靠“工程”“管理”这类两字词命中一堆无关内容 */
        (!hasLongToken || x.maxMatchedLen >= 3)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      title: doc.title,
      url: doc.url,
      excerpt: doc.text.replace(doc.title, '').trim().slice(0, 220),
      source: doc.source,
      kind: doc.kind,
      author: doc.author,
      type: doc.type,
      votes: doc.votes,
      fromSnapshot: doc.fromSnapshot,
      score,
    }));

  return { query, tokens, category, hits };
}

/* --------------------------- 展示层辅助 --------------------------- */

/** 把任意（城市/阶段）列表按你填写的方向重新排序；没有任何命中时保持原顺序 */
export function rankByField<T extends { title: string; excerpt?: string }>(
  items: T[],
  field: string
): { items: T[]; matched: boolean } {
  const tokens = fieldTokens(field);
  const phrase = normalize(field).replace(/\s+/g, '');
  if (!tokens.length) return { items, matched: false };
  const scored = items.map((item, index) => ({
    item,
    index,
    score: scoreText(
      `${item.title} ${item.excerpt ?? ''}`.toLowerCase(),
      tokens,
      phrase
    ),
  }));
  const matched = scored.some((x) => x.score >= MIN_SCORE);
  return {
    items: scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.item),
    matched,
  };
}

function toLiveItem(hit: SearchHit): LiveItem {
  return {
    title: hit.title,
    url: hit.url,
    author: hit.author ?? '',
    type: hit.type ?? hit.kind,
    excerpt: hit.excerpt,
    votes: hit.votes ?? 0,
  };
}

/**
 * 按你填写的方向取“近期讨论”：
 * 1. 关键词在快照里命中 → 用命中的快照内容
 * 2. 没命中关键词但命中了专业大类 → 用该大类的快照分组
 * 3. 都没有 → 返回空数组（调用方必须如实提示，不得偷换成通用内容）
 */
export function liveByField(
  field: string,
  stageId: StageId,
  excludeUrls: string[] = []
): { items: LiveItem[]; matched: boolean; category: FieldCase | null } {
  const exclude = new Set(excludeUrls);
  const result = searchByField(field, stageId);
  const hits = result.hits
    .filter((h) => h.fromSnapshot && !exclude.has(h.url))
    .map(toLiveItem);
  if (hits.length) {
    return { items: dedupeLive(hits), matched: true, category: result.category };
  }
  if (result.category) {
    const group = SNAPSHOT.fields[result.category.key]?.items ?? [];
    const items = group
      .filter((it) => !exclude.has(it.url))
      .map((it) => ({ ...it }));
    return {
      items: dedupeLive(items),
      matched: items.length > 0,
      category: result.category,
    };
  }
  return { items: [], matched: false, category: null };
}

function dedupeLive(items: LiveItem[]): LiveItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (!it.title.trim() || seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
}

/** 供 Step4 把检索命中转成案例卡 */
export function hitsToCases(hits: SearchHit[]): CaseItem[] {
  return hits.map((h) => ({
    title: h.title,
    url: h.url,
    kind: h.kind || '检索结果',
    gist: h.excerpt,
  }));
}

/* --------------------------- 案例选择 --------------------------- */

export type CaseMatchKind = 'category' | 'keyword' | 'fallback';

export interface FieldCasesResult {
  items: CaseItem[];
  note: string;
  /** 是否落到了阶段通用内容（不是按你填写方向检索到的） */
  fallback: boolean;
  matchKind: CaseMatchKind;
  matchedLabel?: string;
}

function dedupeCases(items: CaseItem[]): CaseItem[] {
  const seen = new Set<string>();
  const out: CaseItem[] = [];
  items.forEach((it) => {
    if (!it.url || seen.has(it.url)) return;
    seen.add(it.url);
    out.push(it);
  });
  return out;
}

/**
 * 按第一步填写的方向取案例。
 * 优先级：专业大类匹配 → 关键词在真实语料中命中 → 阶段通用（并明确标注 fallback）。
 * 不会再出现“没命中却假装是按你的方向检索”的情况。
 */
export function getCases(field: string, stage: StageId): FieldCasesResult {
  const query = (field || '').trim();
  if (!query) {
    return {
      items: CASES[stage] ?? [],
      note: '你还没有填写所学或所从事的方向，以下为该阶段的通用检索结果。',
      fallback: true,
      matchKind: 'fallback',
    };
  }

  const result = searchByField(query, stage);
  const keywordItems = hitsToCases(result.hits);

  if (result.category) {
    const items = dedupeCases([...result.category.items, ...keywordItems]).slice(
      0,
      10
    );
    return {
      items,
      note: `已按你填写的「${query}」匹配到「${result.category.label}」大类，并在真实检索语料中叠加 ${keywordItems.length} 条相关内容（共 ${items.length} 条）。`,
      fallback: false,
      matchKind: 'category',
      matchedLabel: result.category.label,
    };
  }

  if (keywordItems.length) {
    return {
      items: keywordItems.slice(0, 8),
      note: `未命中内置专业大类，但已按「${query}」在 ${DOC_COUNT} 条真实语料中命中 ${keywordItems.length} 条相关内容。`,
      fallback: false,
      matchKind: 'keyword',
    };
  }

  return {
    items: CASES[stage] ?? [],
    note: `没有检索到与「${query}」直接相关的内容。以下为该阶段的通用检索结果，不代表你的方向；可在第一步把方向写得更具体（例如加上行业、岗位或证书）。`,
    fallback: true,
    matchKind: 'fallback',
  };
}
