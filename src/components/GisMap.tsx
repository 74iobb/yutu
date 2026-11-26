import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CITIES, CITY_MAP } from '@/data/catalog';
import { AREA_SPAN, GEO, bandOf } from '@/lib/model';
import { addLandBase, addOsmBase, removeLandAttribution } from '@/lib/osm';
import { curvedLatLng } from '@/lib/geo';
import {
  escapeHtml,
  openMaterial,
  type CityMaterial,
  type MaterialItem,
} from '@/lib/materials';

interface Props {
  city: string;
  coords: { lon: number; lat: number; acc: number } | null;
  recenterSignal: number;
  onSelectCity: (id: string) => void;
  /** 城市级检索资料：每条内容按所属城市落到地图上 */
  materials?: CityMaterial[];
  showMaterials?: boolean;
  /** 点击资料点：交给页面联动侧栏；不传则直接打开原文 */
  onSelectMaterial?: (mat: CityMaterial, item: MaterialItem) => void;
  /** 在地图上点选实际位置（定位不可用时的替代方式） */
  onPickPoint?: (lat: number, lon: number) => void;
  picking?: boolean;
}

type Point = [number, number]; // [lon, lat]

function distanceDeg(a: Point, b: Point) {
  const dLon = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dLat = b[1] - a[1];
  return Math.sqrt(dLon * dLon + dLat * dLat);
}

/** 城市 id 可能来自旧数据 / 中文名；统一解析到一个有效城市，避免地图整块空白 */
function resolveCity(idOrName: string) {
  return (
    CITY_MAP[idOrName] ??
    CITIES.find((c) => c.id === idOrName || c.name === idOrName) ??
    CITY_MAP.chengdu
  );
}

export default function GisMap({
  city,
  coords,
  recenterSignal,
  onSelectCity,
  materials = [],
  showMaterials = true,
  onSelectMaterial,
  onPickPoint,
  picking = false,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPickPoint);
  const materialPickRef = useRef(onSelectMaterial);
  const selectCityRef = useRef(onSelectCity);
  /** 记住「上次真正需要重置视野」的键，避免父组件重渲染时把用户的缩放/平移拽回去 */
  const viewKeyRef = useRef('');
  useEffect(() => {
    pickRef.current = onPickPoint;
  }, [onPickPoint]);
  useEffect(() => {
    materialPickRef.current = onSelectMaterial;
  }, [onSelectMaterial]);
  useEffect(() => {
    selectCityRef.current = onSelectCity;
  }, [onSelectCity]);
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);
  const activeCity = resolveCity(city);
  const cityFallback = activeCity.id !== city;

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
        maxZoom: 10,
        worldCopyJump: true,
        attributionControl: true,
      });
    } catch (error) {
      console.error('[GisMap] init failed', error);
      setFailed(true);
      return;
    }
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control
      .scale({ position: 'bottomright', imperial: false, maxWidth: 90 })
      .addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      pickRef.current?.(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
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
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const me = resolveCity(city);
    const ll = GEO[me.id];
    if (!map || !ll) return;

    /* 只有城市 / 外部重定位信号 / 实际坐标变化时才重置视野；
       资料层开关、底图重试、父组件重渲染都不应打断用户正在看的区域 */
    const viewKey = `${city}|${recenterSignal}|${
      coords ? `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}` : 'none'
    }`;
    const resetView = viewKeyRef.current !== viewKey;
    viewKeyRef.current = viewKey;

    try {
      layersRef.current?.remove();
      const group = L.layerGroup().addTo(map);
      layersRef.current = group;
      setOffline(false);
      removeLandAttribution(map);

      // 先放离线矢量陆地作为即时底图，避免瓦片尚未加载时出现空白；
      // 瓦片加载后会覆盖它，瓦片失败时它就是回退底图。
      /* 底图统一走暗色：OSM 瓦片由 CSS 反相处理，失败时回落的矢量陆地也保持深色 */
      addLandBase(map, group, true);
      addOsmBase(map, group, setOffline, true);

      /* 区域圈：用真实公里半径近似原来的 2.5° 区域 */
      L.circle([ll[1], ll[0]], {
        radius: AREA_SPAN * 111000,
        color: '#1f6fb2',
        weight: 1.2,
        dashArray: '4 5',
        fillColor: '#1f6fb2',
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(group);

      /* 实际定位点：与城市级落点之间用飞线相连，说明“你被就近归到哪座城市” */
      if (coords) {
        const actual: [number, number] = [coords.lon, coords.lat];
        if (distanceDeg(actual, [ll[0], ll[1]]) > 0.02) {
          L.polyline(curvedLatLng([coords.lat, coords.lon], [ll[1], ll[0]], 0.26, 22), {
            color: '#e8764a',
            weight: 1.5,
            opacity: 0.82,
            interactive: false,
            className: 'gis-real-flight',
          }).addTo(group);
        }
        L.circleMarker([coords.lat, coords.lon], {
          radius: 5,
          color: '#fffefb',
          weight: 2,
          fillColor: '#e8764a',
          fillOpacity: 1,
        })
          .addTo(group)
          .bindTooltip('你的实际位置', {
            direction: 'top',
            className: 'gis-tip gis-tip-me',
          });
      }

      /* 用细虚线连接蓝圈内的邻近城市，强化区域感 */
      CITIES.forEach(c => {
        if (c.id === me.id) return;
        const g = GEO[c.id];
        if (!g || distanceDeg(ll, g) > AREA_SPAN) return;
        L.polyline(curvedLatLng([ll[1], ll[0]], [g[1], g[0]], 0.16), {
          color: '#7ed4c4',
          weight: 1.5,
          opacity: 0.72,
          interactive: false,
          className: 'gis-flight',
        }).addTo(group);
      });

      /* 当前城市光晕 + 主标记 */
      L.circleMarker([ll[1], ll[0]], {
        radius: 16,
        color: 'transparent',
        fillColor: '#1f6fb2',
        fillOpacity: 0.18,
        interactive: false,
        className: 'gis-me-halo',
      }).addTo(group);
      const meMarker = L.circleMarker([ll[1], ll[0]], {
        radius: 8,
        color: '#fffefb',
        weight: 2.4,
        fillColor: '#1f6fb2',
        fillOpacity: 1,
      })
        .addTo(group)
        .bindTooltip(`${me.name} · 岗位 ${bandOf(me.jobs)} · 成本 ${bandOf(me.cost)}`, {
          permanent: true,
          direction: 'top',
          className: 'gis-tip gis-tip-me',
          offset: [0, -9],
        });
      meMarker.on('click', () => selectCityRef.current(me.id));

      CITIES.forEach(c => {
        if (c.id === me.id) return;
        const g = GEO[c.id];
        if (!g) return;
        const near = distanceDeg(ll, g) <= AREA_SPAN;
        const fill = near ? '#a9762f' : '#8a979f';
        const radius = 2.4 + (c.jobs / 100) * 3.6;
        const marker = L.circleMarker([g[1], g[0]], {
          radius,
          color: '#fffefb',
          weight: 1.2,
          fillColor: fill,
          fillOpacity: 0.96,
        })
          .addTo(group)
          .bindTooltip(
            `${c.name} · 岗位 ${bandOf(c.jobs)} · 成本 ${bandOf(c.cost)}`,
            {
              direction: 'top',
              className: 'gis-tip',
            }
          );
        marker.on('click', () => selectCityRef.current(c.id));
      });

      /* 资料层：每条检索内容落在其所属城市坐标附近，点开可看原文；
         每个资料点用一条动画飞线连回所属城市，表达“这条资料属于哪座城市” */
      if (showMaterials && materials.length) {
        materials.forEach(mat => {
          const g = GEO[mat.cityId];
          if (!g) return;
          const isMe = mat.cityId === me.id;
          mat.items.forEach((item, index) => {
            const angle =
              ((index * 137.508 + mat.cityId.length * 19) * Math.PI) / 180;
            const radius = 0.52 + (index % 3) * 0.2;
            const pos: [number, number] = [
              g[1] + Math.sin(angle) * radius * 0.78,
              g[0] + Math.cos(angle) * radius,
            ];
            L.polyline(curvedLatLng([g[1], g[0]], pos, 0.32, 16), {
              color: isMe ? '#8d6a9e' : '#b79cc4',
              weight: isMe ? 1.2 : 1,
              opacity: isMe ? 0.72 : 0.46,
              interactive: false,
              className: 'gis-mat-flight',
            }).addTo(group);
            L.circleMarker(pos, {
              radius: 2.9,
              color: '#fffefb',
              weight: 1,
              fillColor: '#7a5a86',
              fillOpacity: 0.96,
              bubblingMouseEvents: false,
            })
              .addTo(group)
              .bindTooltip(
                `<b>${escapeHtml(item.title)}</b><br>${escapeHtml(mat.cityName)}${
                  item.meta ? ` · ${escapeHtml(item.meta)}` : ''
                }`,
                { direction: 'top', className: 'gis-tip' }
              )
              .on('click', () => {
                if (materialPickRef.current) {
                  materialPickRef.current(mat, item);
                } else {
                  openMaterial(item.url);
                }
              });
          });
        });
      }

      if (resetView) {
        const center: [number, number] = coords
          ? [coords.lat, coords.lon]
          : [ll[1], ll[0]];
        const zoom = coords ? 8 : 6;
        map.setView(center, zoom, { animate: true });
        window.setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            /* map already removed */
          }
        }, 30);
      }
    } catch (error) {
      console.error('[GisMap] render layers failed', error);
      setFailed(true);
    }
  }, [
    city,
    coords,
    recenterSignal,
    materials,
    showMaterials,
    tileRetry,
  ]);

  return (
    <div
      className={`y-gis${picking ? ' is-picking' : ''}`}
      ref={boxRef}
    >
      {cityFallback && !failed ? (
        <div className='y-gis-fallback' role='status'>
          未识别城市「{city}」，已回落到 {activeCity.name}
        </div>
      ) : null}
      {failed ? (
        <div className='y-map-fallback' role='alert'>
          <b>地图初始化失败</b>
          <span>其余内容仍可使用；可刷新后重试。</span>
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
