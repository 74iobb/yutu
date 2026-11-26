/**
 * 公共复盘提交前的轻量脱敏。
 *
 * 目标：把「可识别到具体个人/具体金额」的信息替换为标签，
 * 而不是把整段文字洗成无信息量的空话。
 *
 * 只作用于**进入公共校验池的文本**；本地归档与个人复盘原文不变。
 * 规则是启发式的，宁可少替换，也不要把「国企」「互联网」这类普通词误伤。
 */

export interface DesensitizeResult {
  text: string;
  /** 每类命中的次数，供界面提示「已脱敏 N 处」 */
  hits: Record<string, number>;
  total: number;
}

interface Rule {
  name: string;
  re: RegExp;
  to: string;
}

/*
 * 顺序有讲究：先处理「月薪 5000」这类带语境词的金额，
 * 再处理裸金额，避免语境词被通用规则吞掉。
 */
const RULES: Rule[] = [
  /* 证件号必须在手机号之前：18 位身份证里包含一段像手机号的数字 */
  { name: '证件号', re: /(?<!\d)\d{17}[\dXx](?!\d)/g, to: '[证件号]' },
  { name: '联系方式', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, to: '[联系方式]' },
  { name: '邮箱', re: /[\w.+-]+@[\w-]+\.[\w.]+/g, to: '[邮箱]' },
  {
    name: '金额',
    re: /(月薪|年薪|工资|收入|存款|积蓄|房租|房贷|学费|生活费|预算|花费|花了|赚了|省下|到手)\s*[:：]?\s*[¥￥]?\s*\d+(?:\.\d+)?\s*(?:万|千|w|W|k|K|元|块)?/g,
    to: '$1 [金额]',
  },
  { name: '金额', re: /[¥￥]\s*\d+(?:\.\d+)?\s*(?:万|千|w|W|k|K)?/g, to: '[金额]' },
  { name: '金额', re: /\d+(?:\.\d+)?\s*(?:万|千)\s*(?:元|块)/g, to: '[金额]' },
  { name: '金额', re: /\d+\s*(?:元|块钱|块)/g, to: '[金额]' },
  {
    name: '公司',
    /* 名称部分不允许出现「的」，避免把「我在成都的一家……」整句吞掉 */
    re: /(?:(?![的])[一-龥A-Za-z0-9]){2,10}(?:股份有限公司|有限责任公司|有限公司|集团|控股|事务所)/g,
    to: '[公司]',
  },
];

/** 对一段文本做脱敏，返回替换后的文本与命中统计 */
export function desensitize(input: string): DesensitizeResult {
  let text = input;
  const hits: Record<string, number> = {};

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches = text.match(rule.re);
    if (!matches || !matches.length) continue;
    hits[rule.name] = (hits[rule.name] ?? 0) + matches.length;
    text = text.replace(rule.re, rule.to);
  }

  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  return { text, hits, total };
}

/** 给人看的一句话：已脱敏 3 处（金额 2、公司 1） */
export function describeHits(hits: Record<string, number>): string {
  const parts = Object.entries(hits).map(([k, v]) => `${k} ${v}`);
  return parts.length ? `已脱敏 ${parts.join('、')}` : '';
}
