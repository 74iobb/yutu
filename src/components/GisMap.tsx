import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CITIES, CITY_MAP } from '@/data/catalog';
import { AREA_SPAN, GEO, bandOf } from '@/lib/model';
import { addLandBase, addOsmBase, removeLandAttribution } from '@/lib/osm';
import { curvedLatLng, greatCircle } from '@/lib/geo';
import {
  escapeHtml,
  openMaterial,
  type CityMaterial,
  type MaterialItem,
} from '@/lib/materials';

interface Props {
  city: string;
  coords: { lon: number; lat: number; acc: number } | null;
  mode: 'geo' | 'net';
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

function flightTargets(meId: string) {
  const me = CITY_MAP[meId];
  const ll = GEO[meId];
  if (!me || !ll)
    return [] as { city: typeof me; diff: number; dist: number }[];
  const near: { city: typeof me; diff: number; dist: number }[] = [];
  const far: { city: typeof me; diff: number; dist: number }[] = [];
  CITIES.forEach(c => {
    const g = GEO[c.id];
    if (!g || c.id === me.id) return;
    const d = distanceDeg(ll, g);
    const item = { city: c, diff: c.jobs - me.jobs, dist: d };
    if (d <= AREA_SPAN) near.push(item);
    else far.push(item);
  });
  far.sort((a, b) => b.city.jobs - a.city.jobs);
  return near.concat(far.slice(0, 4));
}

export default function GisMap({
  city,
  coords,
  mode,
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
  useEffect(() => {
    pickRef.current = onPickPoint;
  }, [onPickPoint]);
  useEffect(() => {
    materialPickRef.current = onSelectMaterial;
  }, [onSelectMaterial]);
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
    const me = CITY_MAP[city];
    const ll = GEO[city];
    if (!map || !me || !ll) return;

    try {
      layersRef.current?.remove();
      const group = L.layerGroup().addTo(map);
      layersRef.current = group;
      setOffline(false);
      removeLandAttribution(map);

      if (mode === 'geo') {
        // 先放离线矢量陆地作为即时底图，避免切回地理模式时瓦片尚未加载出现空白；
        // 瓦片加载后会覆盖它，瓦片失败时它就是回退底图。
        addLandBase(map, group, false);
        addOsmBase(map, group, setOffline, true);
      } else {
        addLandBase(map, group, true);
      }

      /* 区域圈：用真实公里半径近似原来的 2.5° 区域 */
      L.circle([ll[1], ll[0]], {
        radius: AREA_SPAN * 111000,
        color: mode === 'net' ? '#4aa3a0' : '#1f6fb2',
        weight: 1.2,
        dashArray: '4 5',
        fillColor: mode === 'net' ? '#2f8b86' : '#1f6fb2',
        fillOpacity: mode === 'net' ? 0.08 : 0.05,
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

      /* 地理模式：用细虚线连接蓝圈内的邻近城市，强化区域感 */
      if (mode === 'geo') {
        CITIES.forEach(c => {
          if (c.id === city) return;
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
      }

      /* 当前城市光晕 + 主标记 */
      L.circleMarker([ll[1], ll[0]], {
        radius: 16,
        color: 'transparent',
        fillColor: mode === 'net' ? '#78d6d0' : '#1f6fb2',
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(group);
      const meMarker = L.circleMarker([ll[1], ll[0]], {
        radius: 8,
        color: '#fffefb',
        weight: 2.4,
        fillColor: mode === 'net' ? '#78d6d0' : '#1f6fb2',
        fillOpacity: 1,
      })
        .addTo(group)
        .bindTooltip(`${me.name} · 岗位 ${bandOf(me.jobs)} · 成本 ${bandOf(me.cost)}`, {
          permanent: true,
          direction: 'top',
          className: 'gis-tip gis-tip-me',
          offset: [0, -9],
        });
      meMarker.on('click', () => onSelectCity(me.id));

      const targets = mode === 'net' ? flightTargets(city) : [];

      CITIES.forEach(c => {
        if (c.id === city) return;
        const g = GEO[c.id];
        if (!g) return;
        const near = distanceDeg(ll, g) <= AREA_SPAN;
        const target = targets.find(t => t.city.id === c.id);
        let fill = mode === 'net' ? '#426d7a' : '#8a979f';
        if (target) fill = target.diff > 0 ? '#7ed4c4' : '#c4a678';
        else if (near) fill = mode === 'net' ? '#4aa3a0' : '#a9762f';
        const radius = 2.4 + (c.jobs / 100) * 3.6;
        const marker = L.circleMarker([g[1], g[0]], {
          radius,
          color: mode === 'net' ? '#0b1c22' : '#fffefb',
          weight: 1.2,
          fillColor: fill,
          fillOpacity: 0.96,
        })
          .addTo(group)
          .bindTooltip(`${c.name} · 岗位 ${bandOf(c.jobs)} · 成本 ${bandOf(c.cost)}`, {
            direction: 'top',
            className: 'gis-tip',
          });
        marker.on('click', () => onSelectCity(c.id));
      });

      /* 资料层：每条检索内容落在其所属城市坐标附近，点开可看原文；
         每个资料点用一条动画飞线连回所属城市，表达“这条资料属于哪座城市” */
      if (showMaterials && materials.length) {
        materials.forEach(mat => {
          const g = GEO[mat.cityId];
          if (!g) return;
          const isMe = mat.cityId === city;
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

      if (mode === 'net') {
        targets.forEach(t => {
          const g = GEO[t.city.id];
          if (!g) return;
          const points = greatCircle([ll[0], ll[1]], g);
          const color = t.diff > 0 ? '#7ed4c4' : '#c4a678';
          L.polyline(points, {
            color,
            weight: 1.3 + Math.min(2.2, (Math.abs(t.diff) / 100) * 3.2),
            opacity: 0.8,
            className: 'gis-arc',
          }).addTo(group);
        });
      }

      const center: [number, number] = coords
        ? [coords.lat, coords.lon]
        : [ll[1], ll[0]];
      const zoom = coords ? 8 : mode === 'net' ? 4 : 6;
      map.setView(center, zoom, { animate: true });
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* map already removed */
        }
      }, 30);
    } catch (error) {
      console.error('[GisMap] render layers failed', error);
      setFailed(true);
    }
  }, [
    city,
    coords,
    mode,
    recenterSignal,
    onSelectCity,
    materials,
    showMaterials,
    tileRetry,
  ]);

  return (
    <div
      className={`y-gis${mode === 'net' ? ' is-net' : ''}${
        picking ? ' is-picking' : ''
      }`}
      ref={boxRef}
    >
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
