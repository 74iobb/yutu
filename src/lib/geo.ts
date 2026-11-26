/**
 * 大圆弧插值：用于跨区域/全国尺度的飞线。
 * 入参 [lon, lat] 与 Leaflet 一致，返回 [lat, lon] 供 L.polyline 使用。
 */
export function greatCircle(
  a: [number, number],
  b: [number, number],
  steps = 48
): [number, number][] {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const v1 = [
    Math.cos(a[1] * rad) * Math.cos(a[0] * rad),
    Math.cos(a[1] * rad) * Math.sin(a[0] * rad),
    Math.sin(a[1] * rad),
  ];
  const v2 = [
    Math.cos(b[1] * rad) * Math.cos(b[0] * rad),
    Math.cos(b[1] * rad) * Math.sin(b[0] * rad),
    Math.sin(b[1] * rad),
  ];
  const dot = Math.max(
    -1,
    Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])
  );
  const omega = Math.acos(dot);
  if (omega < 1e-6) {
    return [
      [a[1], a[0]],
      [b[1], b[0]],
    ];
  }
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const x = v1[0] * s1 + v2[0] * s2;
    const y = v1[1] * s1 + v2[1] * s2;
    const z = v1[2] * s1 + v2[2] * s2;
    out.push([
      Math.atan2(z, Math.sqrt(x * x + y * y)) * deg,
      Math.atan2(y, x) * deg,
    ]);
  }
  return out;
}

/** 地理辅助：短距离的二次贝塞尔曲线，用于 GIS 上的飞线。坐标均为 [lat, lon]。 */
export function curvedLatLng(
  a: [number, number],
  b: [number, number],
  lift = 0.16,
  steps = 28
): [number, number][] {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dx = lat2 - lat1;
  const dy = lon2 - lon1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const control: [number, number] = [
    (lat1 + lat2) / 2 + nx * len * lift,
    (lon1 + lon2) / 2 + ny * len * lift,
  ];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * lat1 + 2 * u * t * control[0] + t * t * lat2,
      u * u * lon1 + 2 * u * t * control[1] + t * t * lon2,
    ]);
  }
  return points;
}
