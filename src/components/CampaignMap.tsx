import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ASSETS, CITIES, TENSIONS } from '@/data/catalog';
import { assetLevel, CITY_MAP, GEO, type FeasibleOption, bandOf } from '@/lib/model';
import { addLandBase, addOsmBase, removeLandAttribution } from '@/lib/osm';
import { curvedLatLng, greatCircle } from '@/lib/geo';
import {
  escapeHtml,
  openMaterial,
  type CityMaterial,
  type DirectionMaterial,
  type MaterialItem,
} from '@/lib/materials';
import type { Profile } from '@/types';

interface Props {
  profile: Profile;
  options: FeasibleOption[];
  pick: string | null;
  /** 已加入候选的方向（按加入顺序），在图上以金色虚线圈 + 序号标记 */
  shortlist?: string[];
  onPick: (name: string | null) => void;
  showLinks: boolean;
  showTensions: boolean;
  showFlights: boolean;
  showMaterials: boolean;
  recenterSignal: number;
  /** 方向 → 已收集资料 */
  materials?: Record<string, DirectionMaterial>;
  /** 当前专业 / 阶段匹配到的案例 */
  stageMaterials?: MaterialItem[];
  /** local=本地圈层（近/中/外圈）；nation=全国网络（你 → 全国城市） */
  scope: 'local' | 'nation';
  /** 全国视图使用的城市级检索资料 */
  cityMaterials?: CityMaterial[];
}

const TIER = {
  high: { color: '#4f7a58', km: 55, label: '当前可做', ring: '近圈' },
  mid: { color: '#a9762f', km: 105, label: '需补条件', ring: '中圈' },
  low: { color: '#9c4a3c', km: 155, label: '条件不足', ring: '外圈' },
} as const;

const DIRECTION_LABELS: Record<string, string> = {
  本专业对口就业: '对口就业',
  '本专业横向岗位（如施工转造价）': '横向岗位',
  '专升本 / 考研提升学历': '专升本/考研',
  跨行业转技术岗: '跨技术岗',
  '考公 / 体制内': '考公/体制',
  在现单位积累可迁移能力: '现单位积累',
  同行业换更好的平台: '换平台',
  行业内换职能方向: '换职能',
  跨行业重启: '跨行重启',
  可迁移能力盘点后渐进迁移: '渐进迁移',
  不离职做小规模验证: '副业验证',
  考证换门槛: '考证换门槛',
  彻底转行: '彻底转行',
  '现岗位纵深 + 内部转岗': '纵深/转岗',
  业余第二曲线: '第二曲线',
  转管理或带团队: '转管理',
  '创业 / 接私活': '创业/私活',
};

const DEPOT_BEARINGS = [205, 270, 335];

function destination(
  lat: number,
  lon: number,
  bearing: number,
  km: number
): [number, number] {
  const rad = Math.PI / 180;
  const lat1 = lat * rad;
  const lon1 = lon * rad;
  const br = bearing * rad;
  const d = km / 6371;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [lat2 / rad, (((lon2 / rad + 540) % 360) - 180) as number];
}

function bearingAt(index: number, count: number) {
  if (count <= 1) return 0;
  const span = count >= 5 ? 260 : count === 4 ? 240 : 200;
  return -span / 2 + (span / (count - 1)) * index;
}

function tooltipDir(bearing: number): 'top' | 'right' | 'bottom' | 'left' {
  if (bearing > -45 && bearing <= 45) return 'top';
  if (bearing > 45 && bearing <= 135) return 'right';
  if (bearing < -45 && bearing >= -135) return 'left';
  return 'bottom';
}

function shortName(name: string) {
  const base = name.replace(/（[^）]*）/g, '').trim();
  return base.length > 9 ? base.slice(0, 9) + '…' : base;
}

function toneColor(tone: string) {
  if (tone === 'full') return '#4f7a58';
  if (tone === 'part') return '#a9762f';
  return '#9c4a3c';
}

function sectorPoints(
  lat: number,
  lon: number,
  bearing: number,
  km: number,
  half: number
) {
  const points: [number, number][] = [[lat, lon]];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    points.push(
      destination(lat, lon, bearing - half + (2 * half * i) / steps, km)
    );
  }
  return points;
}

export default function CampaignMap({
  profile,
  options,
  pick,
  shortlist = [],
  onPick,
  showLinks,
  showTensions,
  showFlights,
  showMaterials,
  recenterSignal,
  materials = {},
  stageMaterials = [],
  scope,
  cityMaterials = [],
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const viewKey = useRef('');
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof (el as HTMLElement).appendChild !== 'function') {
      setFailed(true);
      return;
    }
    if ((el as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
      setFailed(true);
      return;
    }
    let map: L.Map;
    try {
      map = L.map(el, {
        zoomControl: false,
        minZoom: 3,
        maxZoom: 11,
        zoomSnap: 0.5,
        worldCopyJump: true,
        attributionControl: true,
      });
    } catch (error) {
      console.error('[CampaignMap] init failed', error);
      setFailed(true);
      return;
    }
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control
      .scale({ position: 'bottomright', imperial: false, maxWidth: 90 })
      .addTo(map);
    map.on('click', () => onPick(null));
    viewKey.current = '';
    setMap(map);
    const observer = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch {
        /* map already removed */
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      map.remove();
      layersRef.current = null;
    };
  }, [onPick]);

  useEffect(() => {
    const me = CITY_MAP[profile.city];
    const ll = GEO[profile.city];
    if (!map || !me || !ll) return;

    try {
      layersRef.current?.remove();
      const group = L.layerGroup().addTo(map);
      layersRef.current = group;
      setOffline(false);
      removeLandAttribution(map);
      if (scope === 'nation') {
        addLandBase(map, group, false);
        addOsmBase(map, group, setOffline, true);
      } else {
        addOsmBase(map, group, setOffline);
      }

      const center: [number, number] = [ll[1], ll[0]];

      /* 全国网络：你所在城市 → 全国样本城市。
         跨区域用大圆弧飞线，岗位更密的城市用青色、更稀的用棕色；
         资料用城市级聚合点表示，点开可看原文列表。 */
      if (scope === 'nation') {
        const cityPoints: [number, number][] = [];
        const matByCity = new Map(cityMaterials.map(m => [m.cityId, m]));

        CITIES.forEach(c => {
          const g = GEO[c.id];
          if (!g) return;
          cityPoints.push([g[1], g[0]]);
          const isMe = c.id === profile.city;
          const diff = c.jobs - me.jobs;
          const mat = matByCity.get(c.id);

          if (!isMe) {
            const color =
              diff > 0 ? '#7ed4c4' : diff < 0 ? '#c4a678' : '#9fb4c4';
            L.polyline(greatCircle([ll[0], ll[1]], g), {
              color,
              weight: 1 + Math.min(1.6, (Math.abs(diff) / 80) * 1.6),
              opacity: 0.55,
              interactive: false,
              className: 'camp-nation-flight',
            }).addTo(group);
          }

          const marker = L.circleMarker([g[1], g[0]], {
            radius: isMe ? 8 : 2.8 + (c.jobs / 100) * 3.6,
            color: '#fffefb',
            weight: isMe ? 2.6 : 1.2,
            fillColor: isMe
              ? '#1f6fb2'
              : diff > 0
                ? '#7ed4c4'
                : diff < 0
                  ? '#c4a678'
                  : '#8a979f',
            fillOpacity: 1,
            bubblingMouseEvents: false,
          })
            .addTo(group)
            .bindTooltip(
              isMe
                ? `${c.name} · 你的当前位置`
                : `${c.name} · 岗位 ${bandOf(c.jobs)} · 成本 ${bandOf(c.cost)}${
                    mat ? ` · 资料 ${mat.count} 条` : ''
                  }`,
              {
                direction: isMe ? 'bottom' : 'top',
                permanent: isMe,
                className: `gis-tip${isMe ? ' gis-tip-me' : ''}`,
                offset: isMe ? [0, 9] : [0, 0],
              }
            );
          if (isMe) marker.openTooltip();

          if (showMaterials && mat && mat.items.length) {
            const badgePos: [number, number] = [g[1] + 0.55, g[0] + 0.55];
            L.polyline(curvedLatLng([g[1], g[0]], badgePos, 0.32, 12), {
              color: '#b79cc4',
              weight: 1,
              opacity: 0.6,
              interactive: false,
              className: 'camp-mat-flight',
            }).addTo(group);
            const listHtml = mat.items
              .slice(0, 5)
              .map(
                it =>
                  `<li><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a></li>`
              )
              .join('');
            L.circleMarker(badgePos, {
              radius: 4.2,
              color: '#fffefb',
              weight: 1.2,
              fillColor: '#7a5a86',
              fillOpacity: 1,
              bubblingMouseEvents: false,
            })
              .addTo(group)
              .bindTooltip(
                `<b>${escapeHtml(mat.cityName)}</b> · 检索资料 ${mat.count} 条`,
                { direction: 'top', className: 'gis-tip' }
              )
              .bindPopup(
                `<b>${escapeHtml(mat.cityName)} · 检索资料 ${mat.count} 条</b>` +
                  `<ul class="camp-mat-list">${listHtml}</ul>` +
                  (mat.count > 5
                    ? `<p class="camp-mat-more">另有 ${mat.count - 5} 条，见第二步原文列表</p>`
                    : ''),
                { maxWidth: 280, className: 'gis-pop' }
              );
          }
        });

        const key = `nation|${profile.city}|${recenterSignal}`;
        if (viewKey.current !== key) {
          viewKey.current = key;
          map.fitBounds(L.latLngBounds(cityPoints), {
            padding: [24, 24],
            maxZoom: 6,
          });
        }
        window.setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            /* map already removed */
          }
        }, 30);
        return;
      }

      const nodes = options.map((item, index) => {
        const bearing = bearingAt(index, options.length);
        const tier = TIER[item.f.level];
        const point = destination(ll[1], ll[0], bearing, tier.km);
        return { ...item, index, bearing, tier, point };
      });
      const deps = ASSETS.map((asset, index) => {
        const lv = assetLevel(asset, profile);
        const bearing = DEPOT_BEARINGS[index] ?? 270;
        return {
          asset,
          lv,
          bearing,
          point: destination(ll[1], ll[0], bearing, 160),
        };
      });
      const byName = new Map(nodes.map(n => [n.dir.name, n]));
      const names = new Set(options.map(o => o.dir.name));
      /* 候选序号：与方向清单、顶部候选条保持一致（1 起） */
      const candidateRank = new Map(shortlist.map((name, i) => [name, i + 1]));

      /* 方向扇区：让每个方向的推进范围在图上可见 */
      const half = options.length >= 5 ? 22 : options.length === 4 ? 28 : 34;
      nodes.forEach(node => {
        const selected = pick === node.dir.name;
        const candidate = candidateRank.has(node.dir.name);
        L.polygon(
          sectorPoints(ll[1], ll[0], node.bearing, node.tier.km, half),
          {
            stroke: false,
            fillColor: node.tier.color,
            fillOpacity: selected ? 0.24 : candidate ? 0.15 : 0.09,
            interactive: false,
          }
        ).addTo(group);
      });

      /* 三层推进圈：近圈当前可做，中圈需补条件，外圈条件不足。
         每个圈在南侧带一个常驻标签，避免只有颜色、看不出半径与含义。 */
      (['high', 'mid', 'low'] as const).forEach(key => {
        const tier = TIER[key];
        L.circle(center, {
          radius: tier.km * 1000,
          color: tier.color,
          weight: 1.4,
          opacity: 0.8,
          dashArray: '5 7',
          fillColor: tier.color,
          fillOpacity: 0.045,
          interactive: false,
        }).addTo(group);
        const labelPoint = destination(ll[1], ll[0], 180, tier.km * 0.94);
        L.marker(labelPoint, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'camp-ring-label',
            html: `<b style="color:${tier.color}">${tier.ring} · ${tier.label}</b><span>${tier.km} km</span>`,
            iconSize: [124, 30],
            iconAnchor: [62, 15],
          }),
        }).addTo(group);
      });

      /* 中心：你的位置 */
      L.circleMarker(center, {
        radius: 11,
        color: '#fffefb',
        weight: 2.6,
        fillColor: '#1f6fb2',
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .addTo(group)
        .bindTooltip(`${me.name} · 你的当前位置`, {
          permanent: true,
          direction: 'bottom',
          className: 'camp-label camp-label-me',
          offset: [0, 9],
        });

      /* 补给线：方向 → 一次性资源 */
      if (showLinks) {
        nodes.forEach(node => {
          deps.forEach(dep => {
            if (!dep.asset.consumedBy.includes(node.dir.name)) return;
            const selected = pick === node.dir.name;
            const candidate = candidateRank.has(node.dir.name);
            L.polyline(curvedLatLng(node.point, dep.point, 0.14), {
              color: selected ? '#e0b15c' : candidate ? '#c2a05e' : '#9b9183',
              weight: selected ? 2 : candidate ? 1.5 : 1.1,
              opacity: selected ? 0.9 : candidate ? 0.62 : 0.34,
              interactive: false,
              className: 'camp-supply',
            }).addTo(group);
          });
        });
      }

      /* 张力层：方向之间的互斥 / 共用资源 / 条件关系 */
      if (showTensions) {
        TENSIONS.filter(t => names.has(t.a) && names.has(t.b)).forEach(t => {
          const a = byName.get(t.a);
          const b = byName.get(t.b);
          if (!a || !b) return;
          L.polyline(curvedLatLng(a.point, b.point, 0.12), {
            color: '#d06b5a',
            weight: 1.7,
            opacity: 0.78,
            interactive: false,
            className: 'camp-tension',
          })
            .addTo(group)
            .bindTooltip(t.note, { sticky: true, className: 'gis-tip' });
        });
      }

      /* 方向节点：先画普通/候选节点，最后画已选定节点，保证选中的在最上层 */
      const ordered = [
        ...nodes.filter(n => pick !== n.dir.name),
        ...nodes.filter(n => pick === n.dir.name),
      ];
      ordered.forEach(node => {
        const selected = pick === node.dir.name;
        const rank = candidateRank.get(node.dir.name);
        const candidate = Boolean(rank);

        /* 候选：金色虚线圈 + 序号，和顶部候选条一一对应 */
        if (candidate && !selected) {
          L.circleMarker(node.point, {
            radius: 15.5,
            color: '#d9a24a',
            weight: 1.7,
            opacity: 0.9,
            dashArray: '3 4',
            fillColor: '#d9a24a',
            fillOpacity: 0.06,
            interactive: false,
            className: 'camp-cand-ring',
          }).addTo(group);
        }

        /* 已选定：外圈脉冲光环 + 内圈实描边，视觉上压过候选与普通节点 */
        if (selected) {
          L.circleMarker(node.point, {
            radius: 30,
            color: '#1f6fb2',
            weight: 2,
            opacity: 0.55,
            fillColor: '#1f6fb2',
            fillOpacity: 0.03,
            interactive: false,
            className: 'camp-pick-halo',
          }).addTo(group);
          L.circleMarker(node.point, {
            radius: 19,
            color: node.tier.color,
            weight: 1.4,
            opacity: 0.55,
            fillColor: node.tier.color,
            fillOpacity: 0.16,
            interactive: false,
            className: 'camp-pick-ring',
          }).addTo(group);
        }

        const flight = curvedLatLng(center, node.point, 0.2);
        /* 选定方向：先铺一条亮色底线，让加粗后的飞线在底图上依旧清楚 */
        if (selected) {
          L.polyline(flight, {
            color: '#fffefb',
            weight: 9,
            opacity: 0.55,
            interactive: false,
            className: 'camp-flight-halo',
          }).addTo(group);
        }
        /* 基础轨线：飞线开启时流动，关闭时退回静态虚线 */
        L.polyline(flight, {
          color: node.tier.color,
          weight: selected ? 3.2 : candidate ? 1.4 : 1,
          opacity: selected ? 0.7 : candidate ? 0.42 : 0.3,
          interactive: false,
          ...(showFlights ? { className: 'camp-track' } : { dashArray: '2 6' }),
        }).addTo(group);
        if (showFlights) {
          L.polyline(flight, {
            color: node.tier.color,
            weight: selected ? 13 : candidate ? 6 : 5,
            opacity: selected ? 0.34 : candidate ? 0.18 : 0.12,
            interactive: false,
            className: 'camp-flight-glow',
          }).addTo(group);
          L.polyline(flight, {
            color: node.tier.color,
            weight: selected ? 5 : candidate ? 2.1 : 1.8,
            opacity: selected ? 1 : 0.92,
            interactive: false,
            className: `camp-flight${selected ? ' camp-flight-selected' : ''}`,
          }).addTo(group);
        }
        L.circleMarker(node.point, {
          radius: selected ? 13 : candidate ? 9.5 : 8,
          color: selected ? '#1f6fb2' : '#fffefb',
          weight: selected ? 4 : 2,
          fillColor: node.tier.color,
          fillOpacity: 1,
          bubblingMouseEvents: false,
        })
          .addTo(group)
          .bindTooltip(
            selected
              ? `✓ 已选定 · ${DIRECTION_LABELS[node.dir.name] ?? shortName(node.dir.name)}`
              : candidate
                ? `${rank} 候选 · ${DIRECTION_LABELS[node.dir.name] ?? shortName(node.dir.name)}`
                : (DIRECTION_LABELS[node.dir.name] ?? shortName(node.dir.name)),
            {
              permanent: true,
              direction: tooltipDir(node.bearing),
              className: `camp-label${selected ? ' is-selected is-picked' : ''}${
                candidate ? ' is-candidate' : ''
              }`,
              offset: [0, 0],
            }
          )
          .on('click', () => onPick(node.dir.name));
      });

      /* 资料层：方向资料挂在对应节点外侧；阶段资料落在中心附近 */
      if (showMaterials) {
        nodes.forEach(node => {
          const selected = pick === node.dir.name;
          const candidate = candidateRank.has(node.dir.name);
          const list = materials[node.dir.name]?.items ?? [];
          const shown = list.slice(0, 5);
          shown.forEach((item, i) => {
            const angle = node.bearing + (i - (shown.length - 1) / 2) * 8;
            const km = Math.max(18, node.tier.km - 12 - (i % 2) * 6);
            const point = destination(ll[1], ll[0], angle, km);
            /* 资料飞线：方向节点 → 该方向的资料点 */
            L.polyline(curvedLatLng(node.point, point, 0.36, 16), {
              color: selected ? '#a98bb6' : candidate ? '#c1a468' : '#b79cc4',
              weight: 1,
              opacity: selected ? 0.85 : candidate ? 0.72 : 0.5,
              interactive: false,
              className: 'camp-mat-flight',
            }).addTo(group);
            L.circleMarker(point, {
              radius: 3,
              color: '#fffefb',
              weight: 1.2,
              fillColor: '#7a5a86',
              fillOpacity: 1,
              bubblingMouseEvents: false,
            })
              .addTo(group)
              .bindTooltip(
                `<b>${escapeHtml(item.title)}</b>${
                  item.kind ? `<br>${escapeHtml(item.kind)}` : ''
                }`,
                { direction: 'top', className: 'gis-tip' }
              )
              .on('click', () => openMaterial(item.url));
          });
        });

        const shownStage = stageMaterials.slice(0, 6);
        shownStage.forEach((item, i) => {
          const angle = 240 + (i - (shownStage.length - 1) / 2) * 9;
          const point = destination(ll[1], ll[0], angle, 16 + (i % 2) * 5);
          /* 资料飞线：你的位置 → 本阶段资料点 */
          L.polyline(curvedLatLng(center, point, 0.42, 16), {
            color: '#8d6a9e',
            weight: 1.1,
            opacity: 0.62,
            interactive: false,
            className: 'camp-mat-flight',
          }).addTo(group);
          L.circleMarker(point, {
            radius: 3.2,
            color: '#fffefb',
            weight: 1.2,
            fillColor: '#7a5a86',
            fillOpacity: 1,
            bubblingMouseEvents: false,
          })
            .addTo(group)
            .bindTooltip(
              `<b>${escapeHtml(item.title)}</b><br>本阶段资料${
                item.kind ? ` · ${escapeHtml(item.kind)}` : ''
              }`,
              { direction: 'top', className: 'gis-tip' }
            )
            .on('click', () => openMaterial(item.url));
        });
      }

      /* 一次性资源仓：带存量条 */
      deps.forEach(dep => {
        const color = toneColor(dep.lv.tone);
        const gauge =
          dep.lv.tone === 'full' ? 100 : dep.lv.tone === 'part' ? 55 : 8;
        const html = `<div class="camp-depot tone-${dep.lv.tone}">
        <b>${shortName(dep.asset.name)}</b>
        <span>${dep.lv.label}</span>
        <i><em style="width:${gauge}%"></em></i>
      </div>`;
        const icon = L.divIcon({
          className: 'camp-depot-icon',
          html,
          iconSize: [128, 48],
          iconAnchor: [64, 24],
        });
        L.marker(dep.point, {
          icon,
          interactive: false,
          keyboard: false,
        })
          .addTo(group)
          .bindTooltip(
            `${dep.asset.name}：${dep.lv.label}<br>${dep.asset.expiry} ｜ ${dep.lv.why}`,
            { direction: 'top', className: 'gis-tip', opacity: 1 }
          );
        L.circleMarker(dep.point, {
          radius: 3,
          color,
          fillColor: color,
          fillOpacity: 1,
          interactive: false,
        }).addTo(group);
      });

      const key = `local|${profile.city}|${recenterSignal}`;
      if (viewKey.current !== key) {
        viewKey.current = key;
        const north = destination(ll[1], ll[0], 0, 165);
        const south = destination(ll[1], ll[0], 180, 165);
        const east = destination(ll[1], ll[0], 90, 165);
        const west = destination(ll[1], ll[0], 270, 165);
        const bounds = L.latLngBounds(
          [Math.min(north[0], south[0]), Math.min(east[1], west[1])],
          [Math.max(north[0], south[0]), Math.max(east[1], west[1])]
        );
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 9 });
      }
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* map already removed */
        }
      }, 30);
    } catch (error) {
      console.error('[CampaignMap] render layers failed', error);
      setFailed(true);
    }
  }, [
    map,
    profile,
    options,
    pick,
    shortlist,
    showLinks,
    showTensions,
    showFlights,
    showMaterials,
    materials,
    stageMaterials,
    scope,
    cityMaterials,
    recenterSignal,
    onPick,
    tileRetry,
  ]);

  return (
    <div className='y-campaign-leaflet' ref={boxRef}>
      {failed ? (
        <div className='y-map-fallback' role='alert'>
          <b>作战图初始化失败</b>
          <span>下方资源与方向明细仍可使用；可刷新后重试。</span>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      ) : null}
      {offline ? (
        <div className='y-gis-offline' role='status'>
          <span>底图加载失败，已切换为离线矢量底图</span>
          <button
            type='button'
            className='y-btn y-btn-s'
            onClick={() => setTileRetry(n => n + 1)}
          >
            重试底图
          </button>
        </div>
      ) : null}
    </div>
  );
}
