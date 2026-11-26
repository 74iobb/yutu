import { ASSETS, TENSIONS, type CaseItem } from '@/data/catalog';
import { SNAPSHOT } from '@/data/live';

/**
 * 资料图层的数据适配层。
 * 目标：把项目里已经收集到的检索内容，转成两张地图都能直接渲染的“点位”。
 * 不绑定任何专业：城市资料来自快照城市组，方向资料来自资源/关系证据，
 * 阶段资料来自当前专业匹配到的案例。
 */

/** 地图 tooltip 使用 HTML 字符串，标题来自外部内容，统一转义 */
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    ch =>
      (
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }) as Record<string, string>
      )[ch] ?? ch
  );
}

/** 打开资料原文；资料点位本身不携带登录态与额外数据 */
export function openMaterial(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface MaterialItem {
  title: string;
  url: string;
  meta?: string;
  quote?: string;
  kind?: string;
}

export interface CityMaterial {
  cityId: string;
  cityName: string;
  count: number;
  items: MaterialItem[];
}

/** 城市级资料：按快照里的城市分组，每条内容都落在该城市坐标附近 */
export function collectCityMaterials(): CityMaterial[] {
  return Object.entries(SNAPSHOT.cities)
    .map(([cityId, group]) => ({
      cityId,
      cityName: group.label,
      count: group.items.length,
      items: group.items.map(it => ({
        title: it.title,
        url: it.url,
        meta: [it.author, it.type].filter(Boolean).join(' · '),
        kind: it.type,
      })),
    }))
    .filter(g => g.count > 0);
}

export interface DirectionMaterial {
  direction: string;
  items: MaterialItem[];
}

/**
 * 方向资料：把资源证据与方向关系证据挂到具体方向上。
 * consumedBy / 张力两端都是数据里已有的通用字段，因此对任何阶段的任何方向都成立。
 */
export function collectDirectionMaterials(
  directionNames: string[]
): Record<string, DirectionMaterial> {
  const out: Record<string, DirectionMaterial> = {};
  directionNames.forEach(name => {
    const items: MaterialItem[] = [];
    const seen = new Set<string>();

    ASSETS.forEach(asset => {
      if (!asset.consumedBy.includes(name)) return;
      asset.evidence.forEach(ev => {
        if (seen.has(ev.url)) return;
        seen.add(ev.url);
        items.push({
          title: ev.title,
          url: ev.url,
          quote: ev.quote,
          kind: asset.name,
        });
      });
    });

    TENSIONS.forEach(t => {
      if (t.a !== name && t.b !== name) return;
      if (seen.has(t.url)) return;
      seen.add(t.url);
      const other = t.a === name ? t.b : t.a;
      items.push({
        title: `方向关系：与「${other}」`,
        url: t.url,
        quote: t.basis,
        kind: '方向张力',
      });
    });

    if (items.length) out[name] = { direction: name, items };
  });
  return out;
}

/** 阶段资料：当前专业 / 阶段匹配到的案例，放在作战图中心“你的位置”附近 */
export function collectStageMaterials(items: CaseItem[]): MaterialItem[] {
  return items.map(it => ({
    title: it.title,
    url: it.url,
    quote: it.gist,
    kind: it.kind,
  }));
}
