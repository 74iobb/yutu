/**
 * 知乎内容快照（由 scripts/refresh-zhihu-snapshot.py 通过官方 zhihu-cli 生成）
 * 只包含公开内容标题、作者、摘要与原文链接；不包含任何用户私密数据。
 */
import raw from './zhihu-snapshot.json';

export interface LiveItem {
  title: string;
  url: string;
  author: string;
  type: string;
  excerpt: string;
  votes: number;
}

interface Group {
  label: string;
  query: string;
  items: LiveItem[];
}

interface Snapshot {
  source: string;
  fetchedAt: string;
  fields: Record<string, Group>;
  cities: Record<string, Group>;
  stages: Record<string, Group>;
}

export const SNAPSHOT = raw as unknown as Snapshot;

function uniqueByTitle(items: LiveItem[]): LiveItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = it.title.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 只返回该城市自己的检索结果，不回落成都。
 * 第二步展示城市/区域内容时使用，避免“选了别的城市却一直显示成都样例”。
 */
export function liveCityItemsDirect(cityId: string): LiveItem[] {
  return uniqueByTitle(SNAPSHOT.cities[cityId]?.items ?? []);
}
