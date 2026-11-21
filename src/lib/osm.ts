import L from 'leaflet';
import { LAND_POLYGONS } from '@/data/land';

const NATURAL_EARTH = 'Natural Earth 1:110m';

const LAND_GEO = {
  type: 'FeatureCollection',
  features: LAND_POLYGONS.map((ring) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  })),
};

const OSM_PROVIDERS = [
  {
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
  },
  {
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, HOT',
  },
];

export function removeLandAttribution(map: L.Map) {
  map.attributionControl.removeAttribution(NATURAL_EARTH);
}

/** 离线/网络模式使用的矢量陆地底图 */
export function addLandBase(map: L.Map, group: L.LayerGroup, dark: boolean) {
  if (!map.getPane('landBasePane')) {
    const pane = map.createPane('landBasePane');
    pane.style.zIndex = '180';
  }
  L.geoJSON(LAND_GEO as never, {
    pane: 'landBasePane',
    style: {
      color: dark ? '#2f6f63' : '#5b876f',
      weight: dark ? 0.6 : 0.8,
      fillColor: dark ? '#0f2a27' : '#8fb79b',
      fillOpacity: dark ? 0.92 : 0.38,
      interactive: false,
    },
  }).addTo(group);
  map.attributionControl.addAttribution(NATURAL_EARTH);
}

/** OSM 栅格底图；连续失败时自动切换到备用源，最终回落矢量陆地 */
export function addOsmBase(
  map: L.Map,
  group: L.LayerGroup,
  onOffline: (value: boolean) => void,
  landAlreadyAdded = false
) {
  let index = 0;
  let errors = 0;
  const addTiles = () => {
    if (index >= OSM_PROVIDERS.length) {
      if (!landAlreadyAdded) addLandBase(map, group, false);
      onOffline(true);
      return;
    }
    const provider = OSM_PROVIDERS[index];
    const layer = L.tileLayer(provider.url, {
      maxZoom: 11,
      attribution: provider.attribution,
    });
    layer.on('tileerror', () => {
      errors += 1;
      if (errors >= 3) {
        errors = 0;
        index += 1;
        layer.remove();
        addTiles();
      }
    });
    layer.addTo(group);
  };
  addTiles();
}
