import { pairSimilarity } from '@/lib/model';
import type { Review, Scores, Victory } from '@/types';

/**
 * 本地长期记忆检索。
 *
 * 完全体里应由向量数据库 + LLM 完成；这里用**已经存在的**
 * 归档向量 / 复盘向量做本地相似度排序，不新增后端、不上传数据。
 * 只回答一个问题：在你过去的记录里，哪一条和「现在」最接近？
 */

export interface MemoryItem {
  id: string;
  kind: 'victory' | 'review';
  /** 原始时间字符串 */
  at: string;
  /** 第几次阶段性胜利（仅归档） */
  no?: number;
  /** 人话时间：3 个月前 / 2 周前 / 较早 */
  when: string;
  /** 截断后的正文，用于引用 */
  text: string;
  /** 完整正文 */
  full: string;
  vector: Scores | null;
  /** 与当前处境的七维相似度，0–1 */
  sim: number;
}

function parseAt(at: string): number {
  const t = Date.parse(at.replace(' ', 'T'));
  return Number.isFinite(t) ? t : 0;
}

function whenLabel(at: string): string {
  const t = parseAt(at);
  if (!t) return '较早';
  const days = Math.max(0, (Date.now() - t) / 86400000);
  if (days < 1) return '今天';
  if (days < 7) return `${Math.round(days)} 天前`;
  if (days < 45) return `${Math.round(days / 7)} 周前`;
  if (days < 365) return `${Math.round(days / 30)} 个月前`;
  const years = Math.max(1, Math.round(days / 365));
  return `${years} 年前`;
}

function clip(text: string, max = 90): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function victoryText(v: Victory): string {
  return [v.answers.feel, v.answers.ctx, v.answers.vision]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ／ ');
}

function reviewText(r: Review): string {
  return r.content.replace(/^\[经验卡\]\s*/, '').trim();
}

/** 用正文前 48 个字做去重键，避免同一条复盘的归档与复读重复出现 */
function dedupeKey(text: string): string {
  return text.replace(/\s+/g, '').slice(0, 48);
}

/**
 * 从归档与自己的复盘中检索最接近当前处境的记忆。
 * 有向量用七维综合相似度；没有向量（极少）时按时间排序，相似度给一个保守值。
 */
export function retrieveMemories(
  current: Scores,
  victories: Victory[],
  reviews: Review[],
  ownerKey: string,
  limit = 4
): MemoryItem[] {
  const out: MemoryItem[] = [];
  const seen = new Set<string>();

  victories.forEach((v) => {
    const full = victoryText(v);
    if (full.length < 6) return;
    const key = dedupeKey(full);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `v-${v.id}`,
      kind: 'victory',
      at: v.at,
      no: v.no,
      when: whenLabel(v.at),
      text: clip(full),
      full,
      vector: v.snap,
      sim: pairSimilarity(current, v.snap),
    });
  });

  reviews
    .filter((r) => r.authorKey === ownerKey)
    .forEach((r) => {
      const full = reviewText(r);
      if (full.length < 6) return;
      const key = dedupeKey(full);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        id: `r-${r.id}`,
        kind: 'review',
        at: r.createdAt,
        when: whenLabel(r.createdAt),
        text: clip(full),
        full,
        vector: r.vector,
        sim: r.vector ? pairSimilarity(current, r.vector) : 0.35,
      });
    });

  return out
    .sort((a, b) => {
      /* 相似度优先；差距很小时，新一点的排前面 */
      if (Math.abs(a.sim - b.sim) > 0.04) return b.sim - a.sim;
      return parseAt(b.at) - parseAt(a.at);
    })
    .slice(0, limit);
}
