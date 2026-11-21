/**
 * 检索的轻量核心：分词、专业大类匹配、文本打分。
 * 故意不引入知乎快照等大数据，方便第一步等首屏组件只做“将按什么检索”的预览，
 * 避免把 256 条快照打进首屏包。
 */
import { ALL_FIELD_CASES } from '@/data/field-cases';
import type { FieldCase } from '@/data/catalog';

const STOP = new Set([
  '专业', '方向', '从事', '所学', '所从事', '工作', '行业', '相关', '就业',
  '毕业', '学生', '现在', '目前', '一名', '一个', '我们', '你们', '他们',
  '什么', '怎么', '如何', '可以', '是否', '以后', '未来', '的是', '我的',
  '我在', '想在', '想做', '做过', '学的', '干的', '专科', '本科', '大专',
  '确定', '不知道', '随便', '暂时', '还没', '想好', '考虑', '选择', '需要',
]);

export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[，,、/／|;；:：()（）[\]【】"'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 含这些虚词/代词的片段不作为关键词，避免“科学与工程”被拆出“学与”“与工”之类的噪声 */
const FUNC_CHAR = /[与及的和或为在是有不我你他其]/;

export function fieldTokens(field: string): string[] {
  const text = normalize(field);
  if (!text) return [];
  const out = new Set<string>();
  const phrase = text.replace(/\s+/g, '');
  if (phrase.length >= 2) out.add(phrase);

  text.split(' ').forEach((seg) => {
    if (!seg) return;
    if (/^[a-z0-9+#.]{2,}$/.test(seg)) {
      out.add(seg);
      return;
    }
    const runs = seg.match(/[一-龥]+/g) ?? [];
    runs.forEach((run) => {
      for (let n = 2; n <= Math.min(4, run.length); n++) {
        for (let i = 0; i + n <= run.length; i++) {
          const token = run.slice(i, i + n);
          if (STOP.has(token) || FUNC_CHAR.test(token)) continue;
          out.add(token);
        }
      }
    });
  });

  return [...out].sort((a, b) => b.length - a.length).slice(0, 24);
}

/** 专业大类正则匹配：命中多个时取匹配片段最长的；并列时保留靠前的大类 */
export function matchFieldCategory(field: string): FieldCase | null {
  const txt = (field || '').trim();
  if (!txt) return null;
  let best: FieldCase | null = null;
  let bestLen = 0;
  for (const f of ALL_FIELD_CASES) {
    const m = txt.match(f.kw);
    if (m && m[0].length > bestLen) {
      best = f;
      bestLen = m[0].length;
    }
  }
  if (best) return best;
  /* 宽泛词（如“工程”“管理”）只在输入基本就是该词时兜底，
     避免“新能源科学与工程”被“工程”误判为土木。 */
  for (const f of ALL_FIELD_CASES) {
    if (!f.loose) continue;
    const m = txt.match(f.loose);
    if (m && m[0].length / txt.length >= 0.5 && m[0].length > bestLen) {
      best = f;
      bestLen = m[0].length;
    }
  }
  return best;
}

/** 2 字词权重低、3 字中等、4 字以上更高，避免“工程”“管理”这类短词主导排序 */
function tokenWeight(length: number): number {
  if (length >= 4) return 3;
  if (length === 3) return 2;
  return 1;
}

export function scoreText(text: string, tokens: string[], phrase: string): number {
  let score = 0;
  if (phrase.length >= 3 && text.includes(phrase)) score += 10;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (text.includes(token)) score += 2 * tokenWeight(token.length);
  }
  return score;
}

export function scoreDocText(
  title: string,
  body: string,
  tokens: string[],
  phrase: string
): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  if (phrase.length >= 3) {
    if (t.includes(phrase)) score += 24;
    else if (b.includes(phrase)) score += 12;
  }
  for (const token of tokens) {
    if (token.length < 2) continue;
    const weight = tokenWeight(token.length);
    if (t.includes(token)) score += 4 * weight;
    else if (b.includes(token)) score += 2 * weight;
  }
  return score;
}

/** 低于该分数视为“没有实质命中”，不得展示为按方向检索到的内容 */
export const MIN_SCORE = 4;
