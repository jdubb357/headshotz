// Full-map zoom and the directional sound ring. Pure math so the phone HUD
// can reuse one pool and one canvas. No third-party art.
export const MAP_ZOOM = { min: 1, max: 4 };
export const STEP_R = 28;
export const STEP_MIN = 2.4;
// Ring diameter is about 40% of a square canvas. The canvas itself is sized near 72% of the short screen edge.
export const RING = 0.28;

export function clampZoom(z) {
  const n = +z;
  if (!(n > 0)) return 1;
  return n < MAP_ZOOM.min ? MAP_ZOOM.min : n > MAP_ZOOM.max ? MAP_ZOOM.max : n;
}
export function mapSpan(base, zoom) { return base / clampZoom(zoom); }
export function clampCenter(cx, cz, spanX, spanZ, half) {
  const lim = span => Math.max(0, half + 10 - span / 2);
  const c = (v, edge) => v < -edge ? -edge : v > edge ? edge : v;
  return [c(+cx || 0, lim(spanX)), c(+cz || 0, lim(spanZ == null ? spanX : spanZ))];
}
// Keep the world point under (px, py) fixed while the zoom changes.
export function zoomAbout(cam, next, px, py, W, H, base, half) {
  const z0 = clampZoom(cam.z), z1 = clampZoom(next);
  const v0 = base / z0, sc0 = W / v0;
  const wx = cam.cx + (px - W / 2) / sc0, wz = cam.cz + (py - H / 2) / sc0;
  const v1 = base / z1, sc1 = W / v1;
  const [cx, cz] = clampCenter(wx - (px - W / 2) / sc1, wz - (py - H / 2) / sc1, v1, v1 * H / W, half);
  return { z: z1, cx, cz };
}
// Pinch: scale from the gesture start and keep the original midpoint's world point under the new midpoint.
export function pinchMap(start, dist, mx, my, W, H, base, half) {
  const z = clampZoom(start.z * (dist / (start.d || 1)));
  const v0 = base / clampZoom(start.z), sc0 = W / v0;
  const wx = start.cx + (start.mx - W / 2) / sc0, wz = start.cz + (start.my - H / 2) / sc0;
  const v1 = base / z, sc1 = W / v1;
  const [cx, cz] = clampCenter(wx - (mx - W / 2) / sc1, wz - (my - H / 2) / sc1, v1, v1 * H / W, half);
  return { z, cx, cz };
}
export function panBy(cam, dx, dy, W, H, base, half) {
  const span = mapSpan(base, cam.z), sc = W / span;
  const [cx, cz] = clampCenter(cam.cx - dx / sc, cam.cz - dy / sc, span, span * H / W, half);
  return { z: clampZoom(cam.z), cx, cz };
}
export function mapPoint(wx, wz, cam, W, H, base) {
  const span = mapSpan(base, cam.z), sc = W / span;
  return [(wx - cam.cx) * sc + W / 2, (wz - cam.cz) * sc + H / 2];
}

// 0 when the walker should stay quiet. Closer walkers are more opaque.
export function stepOpacity(dist, spd, o) {
  if (!o || !o.enemy || o.cloaked || o.crouch || o.air || spd < STEP_MIN) return 0;
  if (dist < 1.5 || dist > STEP_R) return 0;
  return Math.max(0.55, Math.min(1, 1 - (dist - 1.5) / (STEP_R - 1.5)));
}
// Hearing distance in metres. Louder guns sit nearer 80, quiet ones nearer 60.
export function gunHear(vol, cls) {
  const v = vol == null ? 0.55 : vol;
  const loud = cls === 'sniper' || cls === 'shotgun' || cls === 'lmg' ? 4 : 0;
  return Math.min(80, Math.max(60, 56 + v * 26 + loud));
}
export function shotOpacity(dist, range, aimed) {
  if (dist > range || dist < 0.4) return 0;
  const b = Math.max(0.55, 1 - dist / range);
  return Math.min(1, aimed ? Math.max(0.55, b * 1.35) : b);
}
// Ground yaw in the camera's horizontal frame. 0 is forward, positive is right.
// fwd is the look direction flattened onto the ground (Three.js looks down local -Z).
export function groundAngle(dx, dz, fwdX, fwdZ) {
  const right = dx * -fwdZ + dz * fwdX;
  const fwd = dx * fwdX + dz * fwdZ;
  return Math.atan2(right, fwd);
}
export function relBearing(yaw, dx, dz) {
  return groundAngle(dx, dz, -Math.sin(yaw), -Math.cos(yaw));
}
// Screen ray matching Vector3.project. right/up/fwd are camera-space offsets
// (fwd > 0 is in front of the camera plane). tanX/tanY are the half-angles.
// 0 is screen-up, positive is screen-right. Null when the point is not in front.
export function markerAngle(right, up, fwd, tanX, tanY) {
  if (!(fwd > 1e-4) || !(tanX > 0) || !(tanY > 0)) return null;
  return Math.atan2((right / fwd) / tanX, (up / fwd) / tanY);
}
function mixAng(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}
function smooth01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
// Inside the picture the icon sits on the ray from the crosshair through the
// projected point. Past the screen edge it eases onto the flat yaw so a target
// sliding off-screen or behind the camera does not pop to the other side.
const EDGE_IN = 0.96;
const EDGE_OUT = 1.45;
export function senseAngle(right, up, fwd, flatRight, flatFwd, tanX, tanY) {
  const flat = Math.atan2(flatRight, flatFwd);
  const screen = markerAngle(right, up, fwd, tanX, tanY);
  if (screen == null) return flat;
  const nx = (right / fwd) / tanX, ny = (up / fwd) / tanY;
  const edge = Math.max(Math.abs(nx), Math.abs(ny));
  return mixAng(screen, flat, smooth01((edge - EDGE_IN) / (EDGE_OUT - EDGE_IN)));
}
export function cameraMarkerAngle(camera, x, y, z) {
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
  const right = dx * e[0] + dy * e[1] + dz * e[2];
  const up = dx * e[4] + dy * e[5] + dz * e[6];
  const fwd = dx * -e[8] + dy * -e[9] + dz * -e[10];
  const fx = -e[8], fz = -e[10], fl = Math.hypot(fx, fz) || 1;
  const flatFwd = dx * (fx / fl) + dz * (fz / fl);
  const flatRight = dx * (-fz / fl) + dz * (fx / fl);
  const tanY = Math.tan(camera.fov * Math.PI / 360);
  const tanX = tanY * camera.aspect;
  return senseAngle(right, up, fwd, flatRight, flatFwd, tanX, tanY);
}
export function iconPoint(ang, size) {
  const c = size / 2, R = size * RING;
  return [c + Math.sin(ang) * R, c - Math.cos(ang) * R];
}
export function segDist(ax, az, bx, bz, px, pz) {
  const abx = bx - ax, abz = bz - az, L2 = abx * abx + abz * abz || 1;
  let t = ((px - ax) * abx + (pz - az) * abz) / L2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

export function makeRing(n = 12) {
  const slots = [];
  for (let i = 0; i < n; i++) slots.push({ on: 0, kind: 0, ang: 0, op: 0, life: 0, age: 0, id: '' });
  return { slots, n };
}
// kind 1 footprint, 2 gunshot, 3 explosion. One slot per source, so a burst does not scatter.
export function ringPush(ring, kind, ang, op, life, id, wx, wz, wy) {
  let slot = null, oldest = ring.slots[0];
  for (let i = 0; i < ring.n; i++) {
    const s = ring.slots[i];
    if (id && s.on && s.id === id) { slot = s; break; }
    if (!s.on && !slot) slot = s;
    if (s.age >= oldest.age) oldest = s;
  }
  if (slot && slot.on && slot.id === id && kind === 1 && slot.kind !== 1) return slot;
  if (!slot) slot = oldest;
  const same = !!(slot.on && id && slot.id === id);
  slot.on = 1;
  if (!(same && slot.kind > kind)) slot.kind = kind;
  slot.ang = ang; slot.op = same ? Math.max(slot.op, op) : op; slot.life = life; slot.id = id || '';
  if (wx != null) { slot.wx = wx; slot.wz = wz; if (wy != null) slot.wy = wy; }
  if (!same) slot.age = 0; else if (slot.age > life * 0.45) slot.age = life * 0.2;
  return slot;
}
export function ringStep(ring, dt) {
  for (let i = 0; i < ring.n; i++) {
    const s = ring.slots[i];
    if (!s.on) continue;
    s.age += dt;
    if (s.age >= s.life) s.on = 0;
  }
}
function foot(ctx, w) {
  const u = w * 0.34;
  ctx.lineWidth = Math.max(1.25, w * 0.06);
  ctx.strokeStyle = '#16110e';
  ctx.fillStyle = '#ffffff';
  const blob = (x, y, rot) => { ctx.beginPath(); ctx.ellipse(x, y, u * 0.42, u * 0.62, rot, 0, 6.3); ctx.fill(); ctx.stroke(); };
  blob(-w * 0.24, 0, -0.35);
  blob(w * 0.24, w * 0.02, 0.35);
}
function gun(ctx, d) {
  ctx.shadowColor = 'rgba(255,60,20,.85)';
  ctx.shadowBlur = d * 0.35;
  ctx.fillStyle = '#ff3a18';
  ctx.strokeStyle = '#fff3ea';
  ctx.lineWidth = Math.max(1.25, d * 0.1);
  ctx.beginPath(); ctx.arc(0, 0, d * 0.34, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -d * 0.42); ctx.lineTo(0, -d * 0.5);
  ctx.moveTo(-d * 0.3, -d * 0.3); ctx.lineTo(-d * 0.42, -d * 0.42);
  ctx.moveTo(d * 0.3, -d * 0.3); ctx.lineTo(d * 0.42, -d * 0.42);
  ctx.stroke();
}
function boom(ctx, d) {
  ctx.fillStyle = '#ff6a18';
  ctx.strokeStyle = '#fff1d8';
  ctx.lineWidth = Math.max(1.2, d * 0.08);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 - Math.PI / 2, r = i % 2 ? d * 0.22 : d * 0.46; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
export function paintRing(ctx, ring, size) {
  const c = size / 2, R = size * RING;
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < ring.n; i++) {
    const s = ring.slots[i];
    if (!s.on) continue;
    const fade = Math.max(0, 1 - s.age / (s.life || 1));
    const a = Math.max(0, Math.min(1, s.op)) * (0.78 + 0.22 * fade);
    if (a < 0.05) continue;
    ctx.save();
    ctx.translate(c + Math.sin(s.ang) * R, c - Math.cos(s.ang) * R);
    ctx.rotate(s.ang);
    ctx.globalAlpha = a;
    if (s.kind === 1) foot(ctx, size * 0.092); else if (s.kind === 3) boom(ctx, size * 0.09); else gun(ctx, size * 0.107);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
