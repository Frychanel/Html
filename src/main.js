'use strict';
// Bahía Dorada — lógica principal.

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const lerpA = (a, b, t) => a + wrapA(b - a) * Math.min(1, t);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const R = a => a[Math.floor(Math.random() * a.length)];
if (isTouch) document.body.classList.add('touch');

// ---------- ajustes ----------
const SET_KEY = 'bahia-dorada-settings';
const settings = { gfx: isTouch ? 'media' : 'alta', intro: 'cine' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { }
if (settings.gfx === 'real') settings.gfx = isTouch ? 'media' : 'alta';
const GFX = {
  ultra: { label: 'Ultra', pr: 2, shadow: 4096, post: true, levels: 4, msaa: 4, lights: 8, fog: [200, 650], env: true },
  alta: { label: 'Alta', pr: 1.5, shadow: 2048, post: true, levels: 3, msaa: 4, lights: 4, fog: [170, 580], env: true },
  media: { label: 'Media', pr: 1.2, shadow: 1024, post: false, levels: 0, msaa: 0, lights: 0, fog: [150, 520], env: true },
  retro: { label: 'Clásico 2005', pr: 0.7, shadow: 1024, post: false, levels: 0, msaa: 0, lights: 0, fog: [70, 300], env: false },
};
const GFX_ORDER = ['ultra', 'alta', 'media', 'retro'];
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { } };

// ---------- render ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
Post.init(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
scene.fog = new THREE.Fog(0xbfdcf2, 160, 560);
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a6a52, 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
sun.castShadow = true; sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 520 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06; scene.add(sun); scene.add(sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); Post.setSize(innerWidth, innerHeight); checkOrient(); });

buildWorld(scene);
scene.traverse(o => { if (o.material && !Array.isArray(o.material) && o.material.isMeshStandardMaterial) o.material.envMapIntensity = o.material.metalness > 0.3 ? 1 : 0.4; });
PERSON_MAT.envMapIntensity = 0.35;
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(World.sky.geometry, World.skyMat); envScene.add(envSky);
let envRT = null, envT = -999, hdriReady = false;
if (window.THREE_EXTRA && window.ASSET_DATA && ASSET_DATA.sky) {
  new THREE_EXTRA.RGBELoader().load(ASSET_DATA.sky, tex => {
    World.skyMat.uniforms.hdri.value = tex; hdriReady = true; envT = -999;
  }, undefined, () => {});
}
function updateEnv(force) {
  if (!force && Math.abs(G.time - envT) < 15) return;
  envT = G.time;
  const rt = pmrem.fromScene(envScene, 0, 1, 1000);
  if (envRT) envRT.dispose(); envRT = rt;
  scene.environment = settings.gfx !== 'retro' ? rt.texture : null;
}
// luces dinámicas: farolas cercanas + faros del coche
const lampLights = [];
const headL = new THREE.SpotLight(0xfff1d6, 0, 70, 0.5, 0.55, 1.4); headL.position.set(0, -100, 0); scene.add(headL); scene.add(headL.target);
const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const coneGeo = new THREE.ConeGeometry(3.2, 16, 20, 1, true).translate(0, -8, 0).rotateX(-Math.PI / 2);
const cones = [new THREE.Mesh(coneGeo, coneMat), new THREE.Mesh(coneGeo, coneMat)]; cones.forEach(c => { c.visible = false; scene.add(c); });
function setLampCount(n) {
  while (lampLights.length > n) scene.remove(lampLights.pop());
  while (lampLights.length < n) { const l = new THREE.PointLight(0xffc98a, 0, 30, 1.6); scene.add(l); lampLights.push(l); }
}
let lampT = 0;
function updateDynLights(dt) {
  lampT -= dt;
  const nightK = clamp((night - 0.25) / 0.5, 0, 1);
  if (lampT <= 0 && lampLights.length) {
    lampT = 0.4;
    const cx = camera.position.x, cz = camera.position.z, list = [];
    for (const p of World.lights) { const d = (p.x - cx) ** 2 + (p.z - cz) ** 2; if (d < 140 * 140) list.push([d, p]); }
    list.sort((a, b) => a[0] - b[0]);
    lampLights.forEach((l, i) => { const e = list[i]; if (e) { l.position.set(e[1].x - 1.63, 7.2, e[1].z - 1.63); l.userData.on = true; } else l.userData.on = false; });
  }
  for (const l of lampLights) l.intensity = l.userData.on ? 2.2 * nightK : 0;
  const c = player.car, on = !!c && nightK > 0 && GFX[settings.gfx].lights > 0;
  headL.intensity = on ? 3.5 * nightK : 0;
  cones.forEach(m => m.visible = on); coneMat.opacity = 0.05 * nightK;
  if (c) {
    const fx = Math.sin(c.h), fz = Math.cos(c.h), hl = c.t.len / 2;
    headL.position.set(c.x + fx * hl, c.y + 0.8, c.z + fz * hl); headL.target.position.set(c.x + fx * 25, 0, c.z + fz * 25);
    cones.forEach((m, i) => { const s = i ? 1 : -1, ox = Math.cos(c.h) * s * (c.t.wid / 2 - 0.3), oz = -Math.sin(c.h) * s * (c.t.wid / 2 - 0.3);
      m.position.set(c.x + fx * (hl + 0.05) + ox, c.y + (c.t.base + c.t.hf) / 2 + 0.08, c.z + fz * (hl + 0.05) + oz); m.rotation.set(0.12, c.h, 0, 'YXZ'); });
  }
}
function applyGfx() {
  const q = GFX[settings.gfx] || GFX.alta, real = settings.gfx !== 'retro';
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? Math.min(q.pr, 1.3) : q.pr) * (real ? 1 : 1));
  if (!real) renderer.setPixelRatio(isTouch ? 0.6 : 0.7);
  renderer.setSize(innerWidth, innerHeight);
  if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  const ext = q.shadow >= 4096 ? 110 : 80; Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  Post.configure(q.post, q.levels, q.msaa); Post.setSize(innerWidth, innerHeight);
  setLampCount(q.lights);
  canvas.classList.toggle('retro', !real);
  scene.environment = q.env && envRT ? envRT.texture : null;
  scene.fog.near = q.fog[0]; scene.fog.far = q.fog[1];
  for (const c of World.clouds) c.visible = real;
  document.querySelectorAll('.gfxlabel').forEach(e => e.textContent = q.label);
  document.querySelectorAll('.introlabel').forEach(e => e.textContent = settings.intro === 'cine' ? 'Cinemática' : 'Clásica (viñetas)');
}

// ---------- estado ----------
const SAVE_KEY = 'bahia-dorada-save-v1';
const G = { time: 9 * 60, money: 250, shownMoney: 250, health: 100, mode: 'intro', paused: false, clock: 0,
  missionsDone: {}, records: {}, outfit: 0, deadT: 0, bigmap: false, camFar: false, portrait: false };
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { G.money = s.money | 0; G.shownMoney = G.money; G.missionsDone = s.missionsDone || {}; G.records = s.records || {}; G.time = s.time || G.time; G.outfit = s.outfit | 0; } } catch (e) { }
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money: G.money, missionsDone: G.missionsDone, records: G.records, time: G.time, outfit: G.outfit })); } catch (e) { } }
loadSave();

// ---------- jugador ----------
const OUTFITS = [
  { name: 'Clásico', top: 0xf4f4f0, topType: 'tank', bottom: 0x3b5998, bottomType: 'jeans', shoes: 0xf2f2f2, cap: 0x1f6f2a },
  { name: 'Deportivo', top: 0x1f6f2a, topType: 'tshirt', bottom: 0x1a1a1a, bottomType: 'shorts', shoes: 0xf2f2f2, cap: null },
  { name: 'Elegante', top: 0x222222, topType: 'jacket', bottom: 0x1a1a1a, bottomType: 'jeans', shoes: 0x6b4428, cap: null, glasses: true },
  { name: 'Playero', top: 0xf08a24, topType: 'tshirt', bottom: 0xd8c8a8, bottomType: 'shorts', shoes: 0x6b4428, cap: 0xf2f2f2 },
  { name: 'Invierno', top: 0x7a1e1e, topType: 'long', bottom: 0x223355, bottomType: 'jeans', shoes: 0x111111, cap: 0x111111 },
];
const player = { x: 0, z: 0, y: 0.3, vy: 0, h: 0, car: null, phase: 0, onGround: true, knock: 0, punchT: 0 };
function buildPlayer() {
  if (player.p) { scene.remove(player.p.group); disposePerson(player.p); }
  player.p = makePerson(Object.assign({ female: false, skin: 0x8d5524, hair: 0x111111, hairStyle: 'buzz', beard: false, glasses: false, height: 1.0 }, OUTFITS[G.outfit % OUTFITS.length]));
  scene.add(player.p.group); player.p.group.visible = !player.car;
}
buildPlayer();
const H = World.specials.hideout;
player.x = H.x; player.z = H.z; player.h = H.h;

// ---------- coches ----------
const cars = [];
function createCar(type, x, z, h, color) {
  const parts = makeCarMesh(type, color ?? R(CAR_COLORS));
  scene.add(parts.group);
  const c = { type, t: CAR_TYPES[type], parts, mesh: parts.group, x, z, h, y: groundAt(x, z), speed: 0, steer: 0, driver: null, hp: 100, wreck: false, ai: null, thr: 0 };
  cars.push(c); syncCar(c, 0); return c;
}
function removeCar(c) {
  scene.remove(c.mesh);
  c.parts.body.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  if (c.ped) disposePerson(c.ped);
  c.parts.paint.dispose();
  const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1);
}
function syncCar(c, dt) {
  c.y += (groundAt(c.x, c.z) - c.y) * Math.min(1, dt * 8);
  c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.y = c.h;
  c.mesh.rotation.z = clamp(-c.steer * c.speed * 0.0035, -0.05, 0.05);
  c.mesh.rotation.x = clamp(-c.thr * 0.015 * (c.speed > 0 ? 1 : 0), -0.025, 0.025);
  for (const w of c.parts.wheels) { w.spin.rotation.x += c.speed * dt / c.t.r; if (w.front) w.steer.rotation.y = c.steer * 0.5; }
  if (c.parts.bar) {
    const on = c.ai && c.ai.police && c.ai.chasing, f = Math.floor(G.clock * 6) % 2;
    c.parts.bar[0].material = on && f ? SH.red : on ? SH.off : SH.red;
    c.parts.bar[1].material = on && !f ? SH.blue : on ? SH.off : SH.blue;
  }
}
function damageCar(c, amt) {
  if (c.wreck) return;
  c.hp -= amt;
  if (c.hp <= 0) { c.wreck = true; c.hp = 0; c.parts.paint.color.set(0x1c1c1c); c.parts.paint.clearcoat = 0;
    if (c === player.car) showSub('<span class="r">¡El motor se ha roto!</span> Sal del coche.', 4); }
}
function driveCar(c, thr, str, hb, dt) {
  const t = c.t, max = c.wreck ? 0 : t.max;
  if (c.wreck) thr = 0;
  c.thr = thr;
  if (thr > 0) c.speed += (c.speed < -0.5 ? 32 : t.acc * (1 - Math.max(0, c.speed) / max * 0.75)) * thr * dt;
  else if (thr < 0) c.speed += (c.speed > 0.5 ? -32 : -t.acc * 0.6) * -thr * dt;
  else { c.speed *= Math.max(0, 1 - 0.45 * dt); if (Math.abs(c.speed) < 0.15) c.speed = 0; }
  if (hb) c.speed *= Math.max(0, 1 - 1.5 * dt);
  c.speed = clamp(c.speed, -13, max);
  c.steer += (str - c.steer) * Math.min(1, dt * 7);
  const ang = c.steer * 0.62 / (1 + Math.abs(c.speed) * 0.032) * (hb ? 1.6 : 1);
  c.h += c.speed / 2.7 * Math.tan(ang) * dt;
  c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), off = t.len / 2 - t.wid / 2;
  let impact = 0;
  for (const s of [off, -off]) {
    const p = { x: c.x + fx * s, z: c.z + fz * s }, ox = p.x, oz = p.z;
    const n = pushOut(p, t.wid / 2 + 0.05);
    if (n) {
      c.x += p.x - ox; c.z += p.z - oz;
      const vn = (fx * n.x + fz * n.z) * c.speed;
      if (vn < -0.5) { impact = Math.max(impact, -vn); if (Math.abs(fx * n.x + fz * n.z) > 0.65) c.speed = -c.speed * 0.15; else c.speed *= 0.85; }
    }
  }
  if (impact > 6) { damageCar(c, impact * 0.9); if (c === player.car || dist(c, player) < 60) Sound.crash(impact / 30); if (c === player.car) shake = Math.min(1, impact / 25); }
}

// ---------- tráfico ----------
function lanePoint(i, j, d) { const n = nodePos(i, j), f = DIRS[d]; return { x: n.x - f[1] * 4, z: n.z + f[0] * 4 }; }
const TRAFFIC_TYPES = ['brisa', 'brisa', 'pelicano', 'furgo', 'bajito', 'toro', 'monte', 'taxi', 'monte', 'pelicano'];
function spawnTraffic(nearX, nearZ, minD, maxD) {
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1));
    const d = Math.floor(Math.random() * 4), ni = i + DIRS[d][0], nj = j + DIRS[d][1];
    if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
    const a = lanePoint(i, j, d), b = lanePoint(ni, nj, d), u = 0.15 + Math.random() * 0.5;
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
    const dd = Math.hypot(x - nearX, z - nearZ);
    if (dd < minD || dd > maxD) continue;
    if (cars.some(c => Math.hypot(c.x - x, c.z - z) < 10)) continue;
    const c = createCar(R(TRAFFIC_TYPES), x, z, Math.atan2(DIRS[d][0], DIRS[d][1]));
    c.driver = 'ai'; c.speed = 8;
    c.ai = { ni, nj, d, cruise: 10 + Math.random() * 5, waitT: 0, ignoreT: 0, panic: 0 };
    c.ped = makePerson(); seatPerson(c, c.ped);
    return c;
  }
  return null;
}
function obstacleAhead(c, range) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  const check = (x, z, w) => { const dx = x - c.x, dz = z - c.z, fwd = dx * fx + dz * fz; return fwd > 0.5 && fwd < range && Math.abs(dx * fz - dz * fx) < w; };
  for (const o of cars) if (o !== c && check(o.x, o.z, 2.3)) return true;
  if (!player.car && check(player.x, player.z, 1.8)) return true;
  for (const p of peds) if (p.state !== 'down' && !inBlock(p.x, p.z) && check(p.x, p.z, 1.6)) return true;
  return false;
}
function updateTraffic(c, dt) {
  const ai = c.ai;
  let tg = lanePoint(ai.ni, ai.nj, ai.d), dTg = Math.hypot(tg.x - c.x, tg.z - c.z);
  if (dTg < 5) {
    const valid = [];
    for (const nd of [ai.d, ai.d, (ai.d + 1) % 4, (ai.d + 3) % 4]) {
      const ni = ai.ni + DIRS[nd][0], nj = ai.nj + DIRS[nd][1];
      if (ni >= 0 && nj >= 0 && ni <= N && nj <= N) valid.push(nd);
    }
    const nd = valid.length ? R(valid) : (ai.d + 2) % 4;
    ai.d = nd; ai.ni += DIRS[nd][0]; ai.nj += DIRS[nd][1];
    tg = lanePoint(ai.ni, ai.nj, ai.d); dTg = Math.hypot(tg.x - c.x, tg.z - c.z);
  }
  const desired = Math.atan2(tg.x - c.x, tg.z - c.z), diff = wrapA(desired - c.h);
  let target = Math.abs(diff) > 0.35 ? 6 : ai.cruise;
  if (World.tlNodes.has(ai.ni + ',' + ai.nj) && dTg > 11.5 && dTg < 21) {
    const st = tlState(ai.d % 2, G.clock);
    if (st === 'r' || (st === 'y' && dTg > 15)) target = 0;
  }
  ai.ignoreT -= dt;
  if (ai.ignoreT <= 0 && obstacleAhead(c, 11)) { target = 0; ai.waitT += dt; if (ai.waitT > 6) { ai.ignoreT = 1.5; ai.waitT = 0; } }
  else if (target > 0) ai.waitT = 0;
  if (ai.panic > 0) { ai.panic -= dt; target = 20; }
  c.speed += clamp(target - c.speed, -18 * dt, 6 * dt);
  const turn = Math.max(0.6, Math.abs(c.speed) * 0.16) * dt;
  c.steer = clamp(diff * 2, -1, 1);
  c.h += clamp(diff, -turn, turn);
  c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt;
}

// ---------- policía ----------
const Wanted = { level: 0, lastCrime: -999, cool: 0, spawnT: 0 };
function addWanted(n) {
  const before = Wanted.level;
  Wanted.level = Math.min(5, Wanted.level + n); Wanted.lastCrime = G.clock; Wanted.cool = 0;
  if (Wanted.level > before) $('stars').classList.add('flash');
}
function copNear(r) { return cars.some(c => c.ai && c.ai.police && dist(c, player) < r); }
function spawnCop() {
  for (let tries = 0; tries < 30; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1)), n = nodePos(i, j);
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d < 90 || d > 200) continue;
    const c = createCar('patrulla', n.x + 3, n.z + 3, Math.atan2(player.x - n.x, player.z - n.z));
    c.driver = 'ai'; c.ai = { police: true, chasing: true, stuck: 0, rev: 0, ni: i, nj: j };
    c.ped = makePerson({ top: 0x1b3a8a, topType: 'tshirt', bottom: 0x111a33, bottomType: 'jeans', cap: 0x111a33 }); seatPerson(c, c.ped);
    return c;
  }
}
function updateCop(c, dt) {
  const ai = c.ai, tx = player.x, tz = player.z, d = Math.hypot(tx - c.x, tz - c.z);
  let gx = tx, gz = tz;
  if (!ai.chasing) { driveCar(c, 0.6, 0, false, dt); return; }
  if (d > 45) {
    let n = nodePos(ai.ni, ai.nj);
    if (Math.hypot(n.x - c.x, n.z - c.z) < 9) {
      let best = null, bd = 1e9;
      for (const [dx, dz] of DIRS) {
        const ni = ai.ni + dx, nj = ai.nj + dz; if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const m = nodePos(ni, nj), md = Math.hypot(m.x - tx, m.z - tz);
        if (md < bd) { bd = md; best = [ni, nj]; }
      }
      if (best) { ai.ni = best[0]; ai.nj = best[1]; n = nodePos(ai.ni, ai.nj); }
    }
    gx = n.x; gz = n.z;
  } else { ai.ni = clamp(Math.round((c.x + HALF) / CELL), 0, N); ai.nj = clamp(Math.round((c.z + HALF) / CELL), 0, N); }
  const diff = wrapA(Math.atan2(gx - c.x, gz - c.z) - c.h);
  let thr = Math.abs(diff) > 1.4 ? 0.35 : 1, str = clamp(diff * 2.2, -1, 1), hb = false;
  if (d < 12) { thr = d < 7 ? -0.6 : 0.2; if (c.speed < 0) thr = 0; hb = d < 7; }
  if (Wanted.level <= 1 && d > 20) thr *= 0.75;
  if (ai.rev > 0) { ai.rev -= dt; thr = -1; str = -str; }
  else if (Math.abs(c.speed) < 1.5 && d > 14) { ai.stuck += dt; if (ai.stuck > 1.6) { ai.rev = 1.1; ai.stuck = 0; } } else ai.stuck = 0;
  driveCar(c, thr, str, hb, dt);
}

// ---------- peatones ----------
const NAMES_F = ['Marta', 'Carmen', 'Lucía', 'Rosa', 'Elena', 'Sofía', 'Paula', 'Inés', 'Nora', 'Alba', 'Julia', 'Vera', 'Lola', 'Pilar'];
const NAMES_M = ['Luis', 'Diego', 'Jorge', 'Pablo', 'Andrés', 'Raúl', 'Hugo', 'Tomás', 'Iván', 'Bruno', 'Félix', 'Mario', 'Óscar', 'Beto'];
const LINES = {
  hello: ['¿Sí?', '¿Qué pasa?', 'Dime.', '¿Te conozco?', '¿Necesitas algo?'],
  greet: ['¡Hola! ¿Qué tal?', '¡Ey, qué onda!', 'Buenas, buenas.', '¡Saludos, vecino!', 'Hola... ¿eres el de la tele?', '¡Qué gusto!'],
  chat: ['Dicen que en el muelle pasan cosas raras de noche.', 'El tráfico en el Centro está imposible.', '¿Has probado los tacos de la plaza? Una maravilla.',
    'Mi primo vio un disco de oro tirado por ahí. ¡Un disco!', 'Ten cuidado, la policía anda nerviosa.', 'Escucha Palmera FM, ponen buena música.',
    'Este barrio era más tranquilo hace cinco años.', 'Hace un calor que derrite el asfalto.', 'Chispa organiza carreras cerca del taller.',
    'Mi gato se llama Turbo. No sé por qué te cuento esto.', 'Dicen que Tía Lupe cocina los mejores tamales del mundo.', 'En la playa se ve el mejor atardecer de la costa.'],
  weak: ['¡Déjame en paz!', '¡Qué grosero!', '¡Voy a llamar a la policía!', '¡Socorro!', '¡Estás loco!'],
  tough: ['¿Qué dijiste? ¡Ven acá!', 'Te vas a arrepentir.', '¿Buscas pelea? La encontraste.', 'Repítelo si te atreves.'],
  thanks: ['¡Gracias, eres un sol!', 'Que te lo devuelvan doble.', '¡Uy, para unos tacos!', '¡Qué generoso!'],
  ambient: ['¡Qué día tan bonito!', 'Llego tarde otra vez...', '¿Dónde dejé las llaves?', 'Mmm, huele a tacos.', '¡Taxi!', 'Mañana empiezo la dieta.', '¿Viste el partido?', 'Necesito vacaciones.'],
  car: ['¡Cuidado, loco!', '¡Aprende a manejar!', '¡Casi me matas!', '¡Por la acera no!'],
  hurt: ['¡Ay!', '¡Auch!', '¡Socorro!', '¡Bruto!'],
  horn: ['¡Ya voy, ya voy!', '¿Qué pitas?', '¡Tranquilo!'],
  wave: ['¡Hola, Rafa!', '¡Buenas!', '¿Qué tal?'],
};
const peds = [];
const WALKERS = isTouch ? 44 : 92, IDLERS = isTouch ? 20 : 42;
function newLook(ped) {
  if (ped.p) { scene.remove(ped.p.group); disposePerson(ped.p); }
  ped.p = makePerson(); scene.add(ped.p.group);
  ped.name = R(ped.p.look.female ? NAMES_F : NAMES_M);
  ped.tough = Math.random() < 0.22; ped.hp = 100;
}
function spawnWalker(ped, near) {
  const bi = cellIdx(player.x), bj = cellIdx(player.z);
  for (let tries = 0; tries < 25; tries++) {
    const i = clamp(bi + Math.floor(Math.random() * 7) - 3, 0, N - 1), j = clamp(bj + Math.floor(Math.random() * 7) - 3, 0, N - 1);
    const c = blockCenter(i, j), t = Math.random() * SIDE * 8, p = perimeterPoint(c, t), d = Math.hypot(p.x - player.x, p.z - player.z);
    if (!near && d < 60) continue;
    Object.assign(ped, { c, t, x: p.x, z: p.z, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.6, state: 'walk', timer: 0, hp: 100, say: null });
    return true;
  }
  return false;
}
function spawnIdler(ped, near) {
  for (let tries = 0; tries < 30; tries++) {
    const s = R(World.idleSpots), d = dist(s, player);
    if (d > 220 || (!near && d < 50)) continue;
    const x = s.x + (Math.random() - 0.5) * 2.2, z = s.z + (Math.random() - 0.5) * 2.2;
    Object.assign(ped, { spot: s, x, z, hx: x, hz: z, h: s.pair ? Math.atan2(s.x - x, s.z - z) : s.h + (Math.random() - 0.5) * 0.6, state: 'idle', timer: 0, hp: 100, say: null });
    ped.c = blockCenter(clamp(cellIdx(x), 0, N - 1), clamp(cellIdx(z), 0, N - 1)); ped.t = 0;
    return true;
  }
  return false;
}
for (let k = 0; k < WALKERS + IDLERS; k++) {
  const ped = { kind: k < WALKERS ? 'walk' : 'idle', phase: Math.random() * 6, active: true };
  newLook(ped); peds.push(ped);
  if (!(ped.kind === 'walk' ? spawnWalker(ped, true) : spawnIdler(ped, true))) { ped.kind = 'walk'; spawnWalker(ped, true); }
}
function respawnPed(ped, near) {
  if (Talk.ped === ped) closeTalk();
  if (Math.random() < 0.35) newLook(ped);
  ped.p.group.rotation.set(0, 0, 0); ped.say = null;
  const ok = ped.kind === 'walk' ? spawnWalker(ped, near) : spawnIdler(ped, near);
  if (!ok && ped.kind === 'idle') spawnWalker(ped, near);
}
function say(ped, text, dur = 3, delay = 0) { ped.say = { text, t: dur, d: delay }; }
function knockDown(ped, h) {
  if (ped.state === 'down') return;
  if (Talk.ped === ped) closeTalk();
  ped.state = 'down'; ped.timer = 7; ped.hp = 0; ped.downH = h; ped.say = null;
  ped.x += Math.sin(h) * 1.5; ped.z += Math.cos(h) * 1.5;
  Sound.thud();
  for (const o of peds) if (o !== ped && (o.state === 'walk' || o.state === 'idle') && dist(o, ped) < 25) { o.state = 'flee'; o.timer = 6; o.from = { x: ped.x, z: ped.z }; if (Math.random() < 0.3) say(o, R(LINES.weak), 2); }
}
function moveFree(ped, tx, tz, sp, dt) {
  const dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  const step = Math.min(d, sp * dt);
  ped.x += dx / d * step; ped.z += dz / d * step; ped.h = Math.atan2(dx, dz);
  const p = { x: ped.x, z: ped.z }; pushOut(p, 0.35); ped.x = p.x; ped.z = p.z;
  return d;
}
function updatePed(ped, dt) {
  const dP = dist(ped, player), vis = dP < 150;
  ped.p.group.visible = vis;
  let anim = 0, sp = 0;
  switch (ped.state) {
    case 'walk': {
      sp = ped.speed; ped.t += ped.dir * sp * dt;
      const p = perimeterPoint(ped.c, ped.t), dx = p.x - ped.x, dz = p.z - ped.z;
      if (dx * dx + dz * dz > 1e-6) ped.h = Math.atan2(dx, dz);
      ped.x = p.x; ped.z = p.z; anim = 0.55; break;
    }
    case 'idle': break;
    case 'talk': ped.h = lerpA(ped.h, Math.atan2(player.x - ped.x, player.z - ped.z), dt * 6); if (dP > 4.5) closeTalk(); break;
    case 'flee': {
      ped.timer -= dt; const from = ped.from || player, ax = ped.x - from.x, az = ped.z - from.z, al = Math.hypot(ax, az) || 1;
      moveFree(ped, ped.x + ax / al * 5, ped.z + az / al * 5, 4.6, dt); sp = 4.6; anim = 0.95;
      if (ped.timer <= 0) ped.state = 'return'; break;
    }
    case 'fight': {
      if (player.car || dP > 30 || G.mode !== 'play') { ped.state = 'return'; break; }
      ped.timer -= dt;
      if (dP > 1.2) { moveFree(ped, player.x, player.z, 3.8, dt); sp = 3.8; anim = 0.9; }
      else {
        ped.h = Math.atan2(player.x - ped.x, player.z - ped.z);
        if (ped.timer <= 0) { ped.timer = 1.1; ped.punchT = 0.35; Sound.punch(); G.health -= 7; shake = 0.35; if (Math.random() < 0.25) say(ped, R(LINES.tough), 1.5); }
      }
      break;
    }
    case 'down': {
      ped.timer -= dt; ped.p.group.position.set(ped.x, groundAt(ped.x, ped.z) + 0.2, ped.z);
      ped.p.group.rotation.set(-Math.PI / 2, ped.downH, 0, 'YXZ');
      if (ped.timer <= 0) { ped.p.group.rotation.set(0, 0, 0, 'XYZ'); ped.hp = 60; ped.state = 'flee'; ped.timer = 5; ped.from = player; say(ped, R(LINES.hurt), 2); }
      if (dP > 240) respawnPed(ped, false);
      return;
    }
    case 'return': {
      let tx, tz;
      if (ped.kind === 'walk') { const p = perimeterPoint(ped.c, ped.t); tx = p.x; tz = p.z; } else { tx = ped.hx; tz = ped.hz; }
      const d = moveFree(ped, tx, tz, 1.8, dt); sp = 1.8; anim = 0.6;
      if (d < 0.3) { ped.state = ped.kind === 'walk' ? 'walk' : 'idle'; if (ped.kind === 'idle' && ped.spot) ped.h = ped.spot.pair ? Math.atan2(ped.spot.x - ped.x, ped.spot.z - ped.z) : ped.spot.h; }
      break;
    }
  }
  if (ped.say) { if (ped.say.d > 0) ped.say.d -= dt; else { ped.say.t -= dt; if (ped.say.t <= 0) ped.say = null; } }
  if (vis) {
    ped.phase += sp * dt * 2.6;
    if (anim > 0) animatePerson(ped.p, ped.phase, anim);
    else poseIdle(ped.p, G.clock + ped.phase, (ped.say && ped.say.d <= 0) || (ped.state === 'idle' && ped.spot && ped.spot.pair && Math.sin(G.clock * 0.7 + ped.phase) > 0.2));
    if (ped.waveT > 0) { ped.waveT -= dt; ped.p.armR.rotation.x = -2.8; ped.p.armR.rotation.z = 0.3 + Math.sin(G.clock * 12) * 0.3; }
    if (ped.punchT > 0) { ped.punchT -= dt; ped.p.armR.rotation.x = -1.5 * Math.sin((1 - ped.punchT / 0.35) * Math.PI); }
    if (ped.hurtT > 0) { ped.hurtT -= dt; ped.p.body.rotation.x = -0.3; } else ped.p.body.rotation.x = 0;
    ped.p.group.position.set(ped.x, groundAt(ped.x, ped.z), ped.z);
    ped.p.group.rotation.y = ped.h;
  }
  if (dP > 240 && ped.state !== 'talk') respawnPed(ped, false);
}
function ejectDriver(c) {
  let ped = null, bd = -1;
  for (const p of peds) if (p.kind === 'walk' && p.state !== 'talk') { const d = dist(p, player); if (d > bd) { bd = d; ped = p; } }
  const lx = c.x + Math.cos(c.h) * 2.5, lz = c.z - Math.sin(c.h) * 2.5;
  if (ped && c.ped) {
    scene.remove(ped.p.group); disposePerson(ped.p);
    c.mesh.remove(c.ped.group); ped.p = c.ped; c.ped = null;
    const g = ped.p.group; poseIdle(ped.p, 0, false); g.position.set(lx, 0, lz); g.rotation.set(0, 0, 0); g.scale.setScalar(ped.p.look.height); scene.add(g);
    ped.name = R(ped.p.look.female ? NAMES_F : NAMES_M); ped.hp = 100;
    ped.c = blockCenter(clamp(cellIdx(lx), 0, N - 1), clamp(cellIdx(lz), 0, N - 1));
    let best = 0, bdd = 1e9; for (let t = 0; t < SIDE * 8; t += 2) { const p = perimeterPoint(ped.c, t), d = Math.hypot(p.x - lx, p.z - lz); if (d < bdd) { bdd = d; best = t; } }
    Object.assign(ped, { kind: 'walk', x: lx, z: lz, t: best, dir: 1, speed: 1.3, state: 'flee', timer: 4, from: player });
    say(ped, R(['¡Mi coche!', '¡Ladrón!', '¡Policía!', '¡Oye, eso es mío!']), 2.5);
  } else if (c.ped) { c.mesh.remove(c.ped.group); disposePerson(c.ped); c.ped = null; }
}

// ---------- burbujas de diálogo ----------
const bubbleEls = [];
const _pv = new THREE.Vector3();
function updateBubbles() {
  let n = 0;
  const list = [];
  for (const p of peds) if (p.say && p.say.d <= 0 && p.p.group.visible && dist(p, player) < 40) list.push(p);
  for (const c of carts) if (c.say) list.push(c);
  for (const p of list) {
    _pv.set(p.x, p.p.look.height * 1.9 + 0.45, p.z).project(camera);
    if (_pv.z > 1) continue;
    let el = bubbleEls[n]; if (!el) { el = document.createElement('div'); el.className = 'bubble'; $('bubbles').appendChild(el); bubbleEls[n] = el; }
    if (el.textContent !== p.say.text) el.textContent = p.say.text;
    el.style.display = 'block';
    el.style.transform = `translate(${(_pv.x * 0.5 + 0.5) * innerWidth}px,${(-_pv.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
    n++;
  }
  for (let i = n; i < bubbleEls.length; i++) bubbleEls[i].style.display = 'none';
}

// ---------- puestos de comida ----------
const carts = World.carts.map(cd => {
  const g = new THREE.Group(); g.position.set(cd.x, 0.3, cd.z); g.rotation.y = cd.h;
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.25, metalness: 0.8 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.1), steel); b.position.y = 0.75; b.castShadow = true; g.add(b);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.5), new THREE.MeshStandardMaterial({ map: textTexture('TACOS · $10', 256, 61, '#c4302b', '#fff') }));
  sign.position.set(0, 0.95, 0.56); g.add(sign);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2), steel); pole.position.y = 2.1; g.add(pole);
  const umb = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 12), new THREE.MeshStandardMaterial({ color: R([0xc4302b, 0xf4d64e, 0x2e7d32]) })); umb.position.y = 3.2; umb.castShadow = true; g.add(umb);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12).rotateZ(Math.PI / 2), SH.tire); w.position.set(s * 0.8, 0.25, 0); g.add(w); }
  scene.add(g);
  const v = makePerson({ topType: 'tshirt', top: 0xffffff, cap: 0xffffff });
  const vx = cd.x - Math.sin(cd.h) * 1.1, vz = cd.z - Math.cos(cd.h) * 1.1;
  v.group.position.set(vx, 0.3, vz); v.group.rotation.y = cd.h; scene.add(v.group);
  addCollider(cd.x - 1.2, cd.z - 1.2, cd.x + 1.2, cd.z + 1.2, 1.5);
  return { x: cd.x, z: cd.z, h: cd.h, vendor: v, say: null, p: v };
});

// ---------- coleccionables, marcadores ----------
const recordMeshes = [];
const recGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.06, 28).rotateX(Math.PI / 2);
const recMat = new THREE.MeshStandardMaterial({ color: 0xf4c430, emissive: 0x4a3200, roughness: 0.15, metalness: 1 });
World.recordSpots.forEach((s, k) => {
  if (G.records[k]) return;
  const m = new THREE.Mesh(recGeo, recMat); m.position.set(s.x, 1.3, s.z); m.castShadow = true; scene.add(m);
  recordMeshes.push({ k, m, s });
});
function markerMesh(color, letter) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  cyl.position.y = 0.8; g.add(cyl);
  if (letter) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(letter, 128, 128, 'rgba(0,0,0,0)', '#f4d64e', 'bold 100px Impact, Arial Black') }));
    sp.scale.set(1.4, 1.4, 1); sp.position.y = 3.0; g.add(sp); g.sprite = sp;
  }
  scene.add(g); return g;
}
const givers = World.specials.givers.map(gv => {
  const m = markerMesh(0xf4d64e, gv.letter); m.position.set(gv.x, 0.3, gv.z);
  const looks = { paquete: { female: true, top: 0xc2185b, topType: 'long', bottomType: 'skirt', bottom: 0x3a2a4a, hair: 0x9a9a9a, hairStyle: 'bun', skin: 0xa86b3c },
    carrera: { female: false, top: 0xf08a24, topType: 'jacket', bottom: 0x1a1a1a, bottomType: 'jeans', cap: 0x111111, skin: 0xd9a066 },
    calor: { female: false, top: 0x5d4037, topType: 'long', bottom: 0x6d5d4b, bottomType: 'jeans', glasses: true, beard: true, hair: 0x9a9a9a, hairStyle: 'short', skin: 0xe0ac69 } };
  const npc = makePerson(looks[gv.id]);
  npc.group.position.set(gv.x + 2.4, 0.3, gv.z + 0.8); npc.group.rotation.y = Math.PI; scene.add(npc.group);
  return Object.assign({ m, npc }, gv);
});
const saveMarker = markerMesh(0x3fdf6f, '$'); saveMarker.position.set(H.x + 3, 0.3, H.z + 2);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 80, 20, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false }));
beam.visible = false; scene.add(beam);
let hint = null;
World.parkSpots.forEach(s => createCar(R(['brisa', 'pelicano', 'furgo', 'bajito', 'toro', 'monte', 'brisa']), s.x, s.z, s.h));
const HC = World.specials.homeCar;
for (let k = cars.length - 1; k >= 0; k--) if (dist(cars[k], HC) < 9) removeCar(cars[k]);
createCar('toro', HC.x, HC.z, HC.h, 0x1f6b35);

// ---------- input ----------
const keys = {};
const TB = {};
let camYaw = player.h, camPitch = 0.26, camManualT = -99, shake = 0;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (G.mode === 'intro') { skipIntro(); return; }
  if (G.mode === 'menu' || e.repeat) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' || e.code === 'Escape') { if (Talk.open) closeTalk(); else setPaused(!G.paused); return; }
  if (G.paused) return;
  if (Talk.open && /^Digit[1-5]$/.test(e.code)) { talkOption(+e.code.slice(5)); return; }
  if (e.code === 'KeyF' || e.code === 'Enter') toggleCar();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ') punch();
  if (e.code === 'KeyR') cycleRadio();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyI') $('help').classList.toggle('hidden');
  if (e.code === 'KeyC') G.camFar = !G.camFar;
  if (e.code === 'KeyH' && player.car) honk(true);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyH') honk(false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; honk(false); });
canvas.addEventListener('mousedown', e => {
  if (G.mode !== 'play' || G.paused || isTouch) return;
  if (document.pointerLockElement !== canvas) { if (!Talk.open && canvas.requestPointerLock) canvas.requestPointerLock(); return; }
  if (e.button === 0) punch();
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  camYaw -= e.movementX * 0.0026; camPitch = clamp(camPitch + e.movementY * 0.002, -0.15, 1.1); camManualT = G.clock;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && G.mode === 'play' && !G.paused && !G.bigmap && !Talk.open && !isTouch) setPaused(true);
});
const joy = { ax: 0, ay: 0, id: null, ox: 0, oy: 0 };
function axes() {
  let ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.ax;
  let ay = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.ay;
  if (player.car) { ax += (TB.right ? 1 : 0) - (TB.left ? 1 : 0); ay += (TB.gas ? 1 : 0) - (TB.brake ? 1 : 0); }
  return [clamp(ax, -1, 1), clamp(ay, -1, 1)];
}
function honk(on) {
  Sound.horn(on);
  if (on && player.car) for (const p of peds) if ((p.state === 'walk' || p.state === 'idle') && dist(p, player) < 16 && Math.random() < 0.5) { say(p, R(LINES.horn), 2); if (Math.random() < 0.4) { p.state = 'flee'; p.timer = 2.5; p.from = player; } }
}

// controles táctiles (horizontal)
let camTouch = null;
if (isTouch) {
  const jz = $('joyzone'), jb = $('joy'), kn = $('knob');
  const R0 = () => jb.offsetWidth / 2;
  jz.addEventListener('touchstart', e => {
    e.preventDefault(); Sound.init();
    const t = e.changedTouches[0]; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY;
    jb.style.left = (t.clientX - R0()) + 'px'; jb.style.top = (t.clientY - R0()) + 'px'; jb.style.bottom = 'auto'; jb.classList.add('on');
  }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = (t.clientX - joy.ox) / R0(), dy = (t.clientY - joy.oy) / R0(); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        joy.ax = dx; joy.ay = -dy; kn.style.transform = `translate(${dx * R0() * 0.6}px,${dy * R0() * 0.6}px)`;
      } else if (camTouch && t.identifier === camTouch.id) {
        camYaw -= (t.clientX - camTouch.x) * 0.006; camPitch = clamp(camPitch + (t.clientY - camTouch.y) * 0.004, -0.15, 1.1);
        camTouch.x = t.clientX; camTouch.y = t.clientY; camManualT = G.clock;
      }
    }
    if (G.mode === 'play') e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; camTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.ax = joy.ay = 0; kn.style.transform = ''; jb.classList.remove('on'); jb.style.left = ''; jb.style.top = ''; jb.style.bottom = ''; }
      if (camTouch && t.identifier === camTouch.id) camTouch = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  document.querySelectorAll('#touch [data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation(); Sound.init(); TB[k] = true; b.classList.add('on');
      if (k === 'enter') toggleCar(); else if (k === 'punch') punch(); else if (k === 'talk') interact();
      else if (k === 'radio') cycleRadio(); else if (k === 'map') toggleMap(); else if (k === 'pause') setPaused(!G.paused);
      else if (k === 'horn') honk(true); else if (k === 'cam') G.camFar = !G.camFar;
    }, { passive: false });
    const up = e => { e.preventDefault(); TB[k] = false; b.classList.remove('on'); if (k === 'horn') honk(false); };
    b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
  });
  $('bigmap').addEventListener('touchstart', e => { e.preventDefault(); toggleMap(); }, { passive: false });
}
function checkOrient() {
  G.portrait = isTouch && innerHeight > innerWidth;
  $('rotate').classList.toggle('hidden', !G.portrait);
}
checkOrient();
async function goLandscape() {
  if (!isTouch) return;
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { }
}

// ---------- acciones ----------
function toggleCar() {
  if (G.mode !== 'play' || G.paused) return;
  if (Talk.open) closeTalk();
  if (player.car) {
    const c = player.car;
    if (Math.abs(c.speed) > 8) return;
    const p = { x: c.x + Math.cos(c.h) * 2.4, z: c.z - Math.sin(c.h) * 2.4 };
    pushOut(p, 0.5);
    player.x = p.x; player.z = p.z; player.y = groundAt(p.x, p.z); player.h = c.h;
    c.driver = null; c.thr = 0; player.car = null; player.p.group.visible = true;
    Sound.setInCar(false); honk(false); $('touch').classList.remove('incar');
    return;
  }
  let best = null, bd = 4.8;
  for (const c of cars) { const d = dist(c, player); if (d < bd && !c.wreck) { bd = d; best = c; } }
  if (!best) return;
  if (best.driver === 'ai') { addWanted(best.ai && best.ai.police ? 2 : 1); ejectDriver(best); best.ai = null; }
  best.driver = 'player'; player.car = best; player.p.group.visible = false;
  showVeh(best.t.name); Sound.setInCar(true);
  if (Sound.station) flashRadio(STATIONS[Sound.station].name);
  $('touch').classList.add('incar');
}
function punch() {
  if (player.car || G.mode !== 'play' || G.paused || player.punchT > 0 || player.knock > 0) return;
  if (Talk.open) closeTalk();
  player.punchT = 0.38; Sound.whoosh();
  let target = null, bd = 2.4;
  for (const p of peds) {
    if (p.state === 'down') continue;
    const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz);
    if (d < bd && (dx * Math.sin(player.h) + dz * Math.cos(player.h)) / (d || 1) > 0.2) { bd = d; target = p; }
  }
  if (!target) return;
  player.h = Math.atan2(target.x - player.x, target.z - player.z);
  if (bd > 1.8) return;
  setTimeout(() => {
    if (target.state === 'down') return;
    Sound.punch(); target.hp -= 30 + Math.random() * 20; target.hurtT = 0.3;
    if (Talk.ped === target) closeTalk();
    if (target.hp <= 0) { knockDown(target, player.h); if (copNear(90) || Math.random() < 0.5) addWanted(1); }
    else if (target.tough) { target.state = 'fight'; target.timer = 0.6; say(target, R(LINES.tough), 2); }
    else { target.state = 'flee'; target.timer = 6; target.from = player; say(target, R(LINES.hurt), 2); }
  }, 140);
}
const Talk = { ped: null, open: false };
function nearestTalkable(r) {
  let best = null, bd = r;
  for (const p of peds) { if (!['walk', 'idle', 'talk'].includes(p.state)) continue; const d = dist(p, player); if (d < bd) { bd = d; best = p; } }
  return best;
}
function interact() {
  if (player.car || G.mode !== 'play' || G.paused) return;
  const cart = carts.find(c => dist(c, player) < 3.4);
  if (cart) { buyFood(cart); return; }
  if (dist(saveMarker.position, player) < 3.5) { changeOutfit(); return; }
  if (Talk.open) { closeTalk(); return; }
  const p = nearestTalkable(3.4); if (p) openTalk(p);
}
function openTalk(p) {
  Talk.ped = p; Talk.open = true; p.prev = p.state; p.state = 'talk';
  $('talkname').textContent = p.name; $('talk').classList.remove('hidden');
  player.h = Math.atan2(p.x - player.x, p.z - player.z);
  say(p, R(LINES.hello), 2.5);
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeTalk() {
  const p = Talk.ped;
  if (p && p.state === 'talk') p.state = p.prev === 'idle' ? 'idle' : 'walk';
  Talk.ped = null; Talk.open = false; $('talk').classList.add('hidden');
}
function rafa(t) { showSub(`<span class="y">Rafa:</span> ${t}`, 2.6); }
function talkOption(k) {
  const p = Talk.ped; if (!p) return;
  if (k === 1) { rafa(R(['¡Hola! ¿Qué tal?', '¿Qué hay?', 'Buenas.', '¡Saludos!'])); p.waveT = 1.6; say(p, R(LINES.greet), 3, 0.8); }
  else if (k === 2) { rafa(R(['¿Qué se cuenta por aquí?', '¿Alguna novedad?', '¿Qué tal el barrio?'])); say(p, R(LINES.chat), 4.5, 0.8); }
  else if (k === 3) {
    rafa(R(['¿Qué miras?', 'Bonita camisa... para un payaso.', 'Apártate de mi camino.', 'Hueles a pescado.']));
    const target = p; closeTalk();
    setTimeout(() => {
      if (target.state === 'down') return;
      if (target.tough) { target.state = 'fight'; target.timer = 0.8; say(target, R(LINES.tough), 2.5); }
      else { target.state = 'flee'; target.timer = 5; target.from = player; say(target, R(LINES.weak), 2.5); }
    }, 700);
  } else if (k === 4) {
    if (G.money < 20) { rafa('Uy... no llevo dinero.'); return; }
    G.money -= 20; Sound.cash(); rafa('Toma, para un café.'); say(p, R(LINES.thanks), 3, 0.7);
    if (Math.random() < 0.6 && recordMeshes.length) {
      let best = null, bd = 1e9; for (const r of recordMeshes) { const d = dist(r.s, player); if (d < bd) { bd = d; best = r; } }
      hint = { x: best.s.x, z: best.s.z, t: 120 };
      setTimeout(() => { say(p, 'Vi algo dorado brillando cerca. Te lo marco.', 4); showSub('<span class="b">Pista:</span> disco de oro marcado en el radar (azul).', 4); }, 3500);
    }
  } else closeTalk();
}
function buyFood(c) {
  if (G.money < 10) { rafa('No me alcanza ni para un taco...'); return; }
  G.money -= 10; G.health = Math.min(100, G.health + 30); Sound.cash();
  c.say = { text: R(['¡Buen provecho!', '¡Con todo, joven!', '¡Gracias, vuelva pronto!']), t: 2.5, d: 0 };
  rafa(R(['Mmm, ¡qué rico!', 'Esto es gloria.', 'Como los de antes.']));
}
function changeOutfit() {
  G.outfit = (G.outfit + 1) % OUTFITS.length; buildPlayer(); save(); Sound.pickup();
  showSub(`Ropa: <span class="y">${OUTFITS[G.outfit].name}</span> (pulsa ${isTouch ? '👕' : 'E'} otra vez para cambiar)`, 3);
}
function cycleRadio() { if (!player.car) return; flashRadio(Sound.nextStation()); }
let radioT = 0, vehT = 0, zoneT = 0, lastZone = '';
function flashRadio(t) { $('radio').textContent = t; $('radio').style.opacity = 1; radioT = 3; }
function showVeh(t) { $('vehname').textContent = t; $('vehname').style.opacity = 1; vehT = 3; }
function setPaused(p) {
  if (G.mode !== 'play' && G.mode !== 'dead') return;
  G.paused = p; $('pause').classList.toggle('hidden', !p);
  if (p) { if (document.pointerLockElement) document.exitPointerLock(); Sound.setInCar(false); honk(false); }
  else { Sound.setInCar(!!player.car); last = performance.now(); }
}
function toggleMap() { G.bigmap = !G.bigmap; $('bigmap').classList.toggle('hidden', !G.bigmap); }

// ---------- mensajes ----------
let bigT = 0; const subQ = []; let subT = 0;
function showBig(text, color, t = 3.5) { const b = $('big'); b.textContent = text; b.style.color = color || '#f4d64e'; b.style.opacity = 1; bigT = t; }
function showSub(html, t = 4, queue) {
  if (queue) { subQ.push([html, t]); if (subT <= 0) nextSub(); return; }
  subQ.length = 0; $('sub').innerHTML = html; subT = t;
}
function nextSub() { const s = subQ.shift(); if (s) { $('sub').innerHTML = s[0]; subT = s[1]; } else $('sub').innerHTML = ''; }

// ---------- misiones ----------
function randomNodeAway(from, minD, maxD) {
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1)), p = nodePos(i, j), d = dist(p, from);
    if (d >= minD && d <= maxD) return Object.assign(p, { i, j });
  }
  return Object.assign(nodePos(6, 6), { i: 6, j: 6 });
}
const MISSIONS = {
  paquete() {
    const a = randomNodeAway(player, 180, 380), b = randomNodeAway(a, 380, 700);
    return { title: 'EL PAQUETE', reward: 600 + (G.missionsDone.paquete || 0) * 150,
      intro: [['<span class="y">Tía Lupe:</span> ¡Rafita! Qué flaco estás. Mira, necesito un favor.', 3.5],
        ['<span class="y">Tía Lupe:</span> Recoge una caja de tamales en el mercado y llévala a la fiesta de tu primo. ¡Calientitos!', 4.5]],
      steps: [{ type: 'car', text: 'Consigue un <span class="b">vehículo</span>.' },
        { type: 'goto', at: a, car: true, text: 'Ve a recoger la <span class="y">caja de tamales</span>.' },
        { type: 'goto', at: b, car: true, time: 100, text: 'Lleva los tamales a la <span class="y">fiesta</span> antes de que se enfríen.' }] };
  },
  carrera() {
    const pts = []; let cur = { i: clamp(cellIdx(player.x), 0, N), j: clamp(cellIdx(player.z), 0, N) }, prevD = -1;
    for (let k = 0; k < 9; k++) {
      let d, ni, nj, steps = 2 + Math.floor(Math.random() * 2), tries = 0;
      do { d = Math.floor(Math.random() * 4); ni = cur.i + DIRS[d][0] * steps; nj = cur.j + DIRS[d][1] * steps; tries++; }
      while ((ni < 0 || nj < 0 || ni > N || nj > N || (prevD >= 0 && d === (prevD + 2) % 4)) && tries < 50);
      ni = clamp(ni, 0, N); nj = clamp(nj, 0, N);
      prevD = d; cur = { i: ni, j: nj }; pts.push(Object.assign(nodePos(ni, nj), cur));
    }
    const steps = [{ type: 'car', text: 'Súbete a un <span class="b">coche</span> para la carrera.' }];
    pts.forEach((p, k) => steps.push({ type: 'goto', at: p, car: true, r: 9, time: k === 0 ? 30 + pts.length * 13 : null, text: `Punto de control <span class="y">${k + 1}/${pts.length}</span>` }));
    return { title: 'VUELTA RÁPIDA', reward: 1000 + (G.missionsDone.carrera || 0) * 250,
      intro: [['<span class="y">Chispa:</span> ¿Tú eres el famoso Rafa? Dicen que manejas como abuela.', 3.5],
        ['<span class="y">Chispa:</span> Demuéstralo. Pasa por todos los puntos antes de que se acabe el tiempo.', 4]], steps };
  },
  calor() {
    const D = World.specials.dock;
    return { title: 'CALOR POLICIAL', reward: 1500 + (G.missionsDone.calor || 0) * 300,
      intro: [['<span class="y">El Profe:</span> Rafa, alguien dejó un maletín en el muelle. Tráemelo.', 3.5],
        ['<span class="y">El Profe:</span> Y ojo: esa zona está muy vigilada últimamente.', 3.5]],
      steps: [{ type: 'car', text: 'Consigue un <span class="b">vehículo</span>.' },
        { type: 'goto', at: D, car: false, r: 5, text: 'Recoge el <span class="y">maletín</span> en el muelle de Playa Coral.' },
        { type: 'wanted', level: 3, text: '<span class="r">¡Era una trampa!</span> Escapa de la policía.' },
        { type: 'goto', at: { x: H.x, z: H.z }, car: false, r: 5, text: 'Vuelve a la <span class="y">casa de Rafa</span>.' }] };
  },
};
let MS = null;
function startMission(gv) {
  const def = MISSIONS[gv.id]();
  MS = { id: gv.id, def, idx: -1, timer: null };
  showBig(def.title, '#f4d64e', 3); Sound.checkpoint();
  def.intro.forEach(([t, d]) => showSub(t, d, true));
  setTimeout(() => { if (MS && MS.def === def) nextStep(); }, def.intro.reduce((s, x) => s + x[1], 0) * 1000);
}
function nextStep() {
  MS.idx++;
  const s = MS.def.steps[MS.idx];
  if (!s) return passMission();
  if (s.type === 'car' && player.car) return nextStep();
  if (s.time) MS.timer = s.time;
  if (s.type === 'wanted') { Wanted.level = 0; addWanted(s.level); }
  showSub(s.text, 6);
  beam.visible = !!s.at; if (s.at) beam.position.set(s.at.x, 40, s.at.z);
}
function updateMission(dt) {
  if (!MS || MS.idx < 0) return;
  const s = MS.def.steps[MS.idx];
  if (MS.timer !== null) { MS.timer -= dt; if (MS.timer <= 0) return failMission('Se acabó el tiempo.'); }
  if (s.type === 'car' && player.car) { Sound.checkpoint(); nextStep(); }
  else if (s.type === 'goto') {
    const r = s.r || (player.car ? 7 : 3.5);
    if (dist(player, s.at) < r) {
      if (s.car && !player.car) { if (subT <= 0) showSub('Necesitas un <span class="b">vehículo</span>.', 2); }
      else { Sound.checkpoint(); nextStep(); }
    }
  } else if (s.type === 'wanted' && Wanted.level === 0) { Sound.checkpoint(); nextStep(); }
}
function passMission() {
  G.money += MS.def.reward; G.missionsDone[MS.id] = (G.missionsDone[MS.id] || 0) + 1;
  showBig('¡MISIÓN SUPERADA!\n+$' + MS.def.reward, '#f4d64e', 4.5); Sound.pass();
  MS = null; beam.visible = false; $('timer').textContent = '';
  if (Object.keys(MISSIONS).every(k => G.missionsDone[k]) && !G.missionsDone._all) { G.missionsDone._all = 1; showSub('<span class="y">¡Has completado todos los trabajos!</span> Las misiones se pueden repetir por más dinero.', 7, true); }
  save();
}
function failMission(why) {
  if (!MS) return;
  showBig('MISIÓN FALLIDA', '#ff5b5b', 3.5); showSub(why, 4); Sound.fail();
  MS = null; beam.visible = false; $('timer').textContent = '';
}

// ---------- muerte / arresto ----------
function knockout(kind) {
  if (G.mode !== 'play') return;
  G.mode = 'dead'; G.deadT = 0; if (Talk.open) closeTalk();
  failMission(kind === 'busted' ? 'Te arrestaron.' : 'Acabaste en el hospital.');
  showBig(kind === 'busted' ? '¡ARRESTADO!' : '¡K.O.!', kind === 'busted' ? '#7ab8ff' : '#ff5b5b', 4);
  Sound.fail(); G.deadKind = kind;
  if (player.car) { player.car.driver = null; player.car = null; Sound.setInCar(false); $('touch').classList.remove('incar'); }
  player.p.group.visible = true; player.p.group.rotation.x = kind === 'busted' ? 0 : -Math.PI / 2;
  for (const p of peds) if (p.state === 'fight') p.state = 'return';
}
function respawn() {
  const sp = G.deadKind === 'busted' ? World.specials.police : World.specials.hospital;
  const fee = G.deadKind === 'busted' ? Math.min(G.money, Math.max(100, Math.floor(G.money * 0.1))) : Math.min(G.money, 100);
  G.money -= fee;
  player.x = sp.x; player.z = sp.z; player.h = sp.h; player.y = 0.3; player.p.group.rotation.x = 0;
  G.health = 100; Wanted.level = 0; for (const c of cars) if (c.ai && c.ai.police) c.ai.chasing = false;
  camYaw = sp.h; G.mode = 'play';
  showSub(G.deadKind === 'busted' ? `La fianza te costó <span class="r">$${fee}</span>.` : `La factura del hospital: <span class="r">$${fee}</span>.`, 4);
  save();
}

// ---------- día / noche ----------
const C = (h) => new THREE.Color(h);
const SKY = { dayTop: C(0x2f6fc0), dayHor: C(0xbcd9ef), setTop: C(0x34437a), setHor: C(0xf09a5a), nightTop: C(0x07102a), nightHor: C(0x22335e) };
const tmpA = new THREE.Color(), tmpB = new THREE.Color(), WHITE = C(0xffffff), _sd = new THREE.Vector3();
const TLON = [0xff2a1a, 0xffb000, 0x2aff6a], TLOFF = [0x3a0a08, 0x3a2a00, 0x0a3a18];
let night = 0;
function updateDayNight(dt) {
  const ang = (G.time / 1440 - 0.25) * Math.PI * 2, elev = Math.sin(ang);
  const day = clamp((elev + 0.1) / 0.38, 0, 1); night = 1 - day;
  const set = Math.max(0, 1 - Math.abs(elev) / 0.25);
  tmpA.copy(SKY.nightTop).lerp(SKY.dayTop, day).lerp(SKY.setTop, set * 0.5);
  tmpB.copy(SKY.nightHor).lerp(SKY.dayHor, day).lerp(SKY.setHor, set * 0.85);
  const u = World.skyMat.uniforms; u.top.value.copy(tmpA); u.horizon.value.copy(tmpB);
  u.ground.value.copy(tmpB).multiplyScalar(0.55);
  const hm = hdriReady && settings.gfx !== 'retro' ? clamp((day - 0.35) / 0.4, 0, 1) * (1 - set * 0.8) : 0;
  if (Math.abs(u.hdriMix.value - hm) > 0.04) envT = -999;
  u.hdriMix.value = hm; u.hdriMul.value = 0.9;
  World.cloudMat.opacity = 0.85 * (1 - hm);
  _sd.set(Math.cos(ang) * 0.85, elev, 0.45).normalize();
  if (elev < -0.05) _sd.set(-_sd.x, Math.abs(_sd.y) + 0.2, -_sd.z).normalize();
  u.sunDir.value.copy(_sd);
  u.sunColor.value.setRGB(1, 0.75 + 0.25 * day, 0.5 + 0.5 * day).multiplyScalar(elev > -0.05 ? 1 : 0.12);
  scene.fog.color.copy(tmpB);
  sun.intensity = 0.45 * night + 1.6 * day * (1 - set * 0.4); hemi.intensity = 0.32 + 0.15 * day;
  if (day > 0.05) sun.color.setRGB(1, 0.78 + 0.2 * day, 0.6 + 0.35 * day); else sun.color.setRGB(0.55, 0.68, 1);
  hemi.color.copy(tmpA).lerp(WHITE, 0.5);
  const tx = player.x, tz = player.z;
  sun.position.set(tx + _sd.x * 220, Math.max(60, _sd.y * 230), tz + _sd.z * 220); sun.target.position.set(tx, 0, tz);
  for (const m of World.windowMats) m.emissiveIntensity = night * 1.2;
  for (const m of World.glowMats) m.emissiveIntensity = 0.25 + night * 1.6;
  World.signMat.emissiveIntensity = 0.12 + night * 0.7;
  World.sky.position.copy(camera.position);
  World.cloudMat.color.copy(tmpB).lerp(WHITE, day * 0.7).multiplyScalar(0.35 + 0.65 * day);
  for (const c of World.clouds) { c.userData.x += dt * 2; if (c.userData.x > 520) c.userData.x -= 1040; c.position.set(camera.position.x + c.userData.x, c.userData.y, camera.position.z + c.userData.z); }
  World.seaTex.offset.x += dt * 0.004; World.seaTex.offset.y += dt * 0.002;
  World.foam.material.opacity = 0.5 + Math.sin(G.clock * 0.8) * 0.25;
  for (let a = 0; a < 2; a++) {
    const on = { r: 0, y: 1, g: 2 }[tlState(a, G.clock)];
    World.tlMats[a].forEach((m, i) => m.color.setHex(i === on ? TLON[i] : TLOFF[i]));
  }
  updateEnv(false);
}

// ---------- jugador: actualización ----------
function updatePlayerFoot(dt) {
  const [ax, ay] = axes();
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = fx * ay + rx * ax, mz = fz * ay + rz * ax; const ml = Math.hypot(mx, mz);
  const sprint = keys.ShiftLeft || keys.ShiftRight || TB.sprint;
  let spd = 0;
  if (player.knock > 0) player.knock -= dt;
  else if (ml > 0.1 && !Talk.open) {
    spd = (sprint ? 8.5 : 4.2) * Math.min(1, ml); mx /= ml; mz /= ml;
    player.h = lerpA(player.h, Math.atan2(mx, mz), dt * 12);
    player.x += mx * spd * dt; player.z += mz * spd * dt;
  }
  if ((keys.Space || TB.jump) && player.onGround && !Talk.open) { player.vy = 6.5; player.onGround = false; }
  player.vy -= 20 * dt; player.y += player.vy * dt;
  const g = groundAt(player.x, player.z);
  if (player.y <= g) { player.y = g; player.vy = 0; player.onGround = true; }
  const p = { x: player.x, z: player.z };
  pushOut(p, 0.4);
  for (const c of cars) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), r = c.t.len / 2 * 0.72 + 0.3;
    if (d < r && d > 0.01) {
      p.x = c.x + dx / d * r; p.z = c.z + dz / d * r;
      const v = Math.sin(c.h) * c.speed * (-dx / d) + Math.cos(c.h) * c.speed * (-dz / d);
      if (v > 6 && player.knock <= 0) { G.health -= v * 2.2; player.knock = 1.2; player.vy = 5; Sound.thud(); shake = 0.6; }
    }
  }
  for (const o of peds) { if (o.state === 'down' || !o.p.group.visible) continue; const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 0.01) { p.x = o.x + dx / d * 0.6; p.z = o.z + dz / d * 0.6; } }
  player.x = p.x; player.z = p.z;
  player.phase += spd * dt * 2.4;
  if (spd === 0 && player.onGround) poseIdle(player.p, G.clock, false);
  else animatePerson(player.p, player.phase, player.onGround ? Math.min(1, spd / 5) * 0.8 : 0.3);
  if (player.punchT > 0) { player.punchT -= dt; const k = 1 - player.punchT / 0.38; player.p.armR.rotation.x = -1.6 * Math.sin(k * Math.PI); player.p.body.rotation.y = -0.25 * Math.sin(k * Math.PI); } else player.p.body.rotation.y = 0;
  player.p.group.position.set(player.x, player.y, player.z); player.p.group.rotation.y = player.h;
  player.p.group.rotation.x = player.knock > 0 ? -1.2 * Math.min(1, player.knock) : 0;
  let prompt = '', ctx = null;
  const K = (k, icon) => isTouch ? icon : k;
  const near = cars.find(c => dist(c, player) < 4.8 && !c.wreck);
  if (near) prompt = `<b>${K('F', '🚗')}</b> entrar al ${near.t.name}${near.driver === 'ai' ? ' <span class="r">(robar)</span>' : ''}`;
  const tp = nearestTalkable(3.4);
  if (tp && !Talk.open) { prompt = `<b>${K('E', '💬')}</b> hablar con ${tp.name} · <b>${K('Clic/Q', '👊')}</b> golpear`; ctx = '💬'; }
  const cart = carts.find(c => dist(c, player) < 3.4);
  if (cart) { prompt = `<b>${K('E', '🌮')}</b> comprar tacos ($10, +30 salud)`; ctx = '🌮'; }
  if (dist(saveMarker.position, player) < 3.5) { prompt = `<b>${K('E', '👕')}</b> cambiar de ropa`; ctx = '👕'; }
  if (!MS) for (const gv of givers) if (dist(gv, player) < 2) { startMission(gv); break; }
  if (!MS) for (const gv of givers) { const d = dist(gv, player); if (d < 10 && d >= 2) prompt = `Misión de <b>${gv.name}</b>: entra en el círculo amarillo.`; }
  if (dist(saveMarker.position, player) < 1.8) {
    if (!G.savedHere) { G.savedHere = true; G.health = 100; save(); showSub('<span class="g">Partida guardada.</span> Salud restaurada.', 3); Sound.pickup(); }
  } else G.savedHere = false;
  setPrompt(prompt); setCtx(ctx);
}
let lastPrompt = null, lastCtx;
function setPrompt(p) { if (p !== lastPrompt) { $('prompt').innerHTML = p; lastPrompt = p; } }
function setCtx(c) { if (c !== lastCtx) { lastCtx = c; const b = $('btnTalk'); b.classList.toggle('hidden', !c); if (c) b.textContent = c; } }
function updatePlayerCar(dt) {
  const c = player.car, [ax, ay] = axes();
  driveCar(c, ay, -ax, keys.Space || TB.hb, dt);
  player.x = c.x; player.z = c.z; player.y = c.y;
  Sound.engine(c.speed, c.t.max, ay > 0);
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = dist(p, c);
    if (Math.abs(c.speed) > 4 && d < c.t.len / 2 + 0.2) { knockDown(p, c.h); addWanted(1); c.speed *= 0.85; continue; }
    if (Math.abs(c.speed) > 7 && d < 9 && (p.state === 'walk' || p.state === 'idle')) {
      const dx = p.x - c.x, dz = p.z - c.z;
      if ((dx * Math.sin(c.h) + dz * Math.cos(c.h)) > 0) { p.state = 'flee'; p.timer = 2; p.from = c; if (Math.random() < 0.5) say(p, R(LINES.car), 2); }
    }
  }
  setPrompt(''); setCtx(null);
}
function carCollisions() {
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b], dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz;
    if (d2 > 25 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), r = 2.3;
    if (d >= r) continue;
    const nx = dx / d, nz = dz / d, push = (r - d) / 2;
    A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
    const va = (Math.sin(A.h) * nx + Math.cos(A.h) * nz) * A.speed, vb = (Math.sin(B.h) * nx + Math.cos(B.h) * nz) * B.speed, rel = va - vb;
    if (rel > 0.5) {
      A.speed *= 0.55; B.speed *= 0.55;
      if (rel > 7) {
        damageCar(A, rel * 0.7); damageCar(B, rel * 0.7);
        if (A === player.car || B === player.car) {
          Sound.crash(rel / 25); shake = Math.min(1, rel / 20);
          const other = A === player.car ? B : A;
          if (other.ai && other.ai.police) addWanted(1); else if (other.ai) other.ai.panic = 3;
        }
      }
    }
  }
}
function updateWanted(dt) {
  const cops = cars.filter(c => c.ai && c.ai.police);
  let nearest = 1e9; for (const c of cops) if (c.ai.chasing) nearest = Math.min(nearest, dist(c, player));
  if (Wanted.level > 0) {
    if (G.clock - Wanted.lastCrime > 10 && nearest > 70) { Wanted.cool += dt; if (Wanted.cool > 9) { Wanted.level--; Wanted.cool = 0; } } else Wanted.cool = 0;
    if (G.clock - Wanted.lastCrime > 2) $('stars').classList.remove('flash');
  } else $('stars').classList.remove('flash');
  const want = Wanted.level === 0 ? 0 : Math.min(7, 1 + Math.floor(Wanted.level * 1.4));
  Wanted.spawnT -= dt;
  if (cops.filter(c => c.ai.chasing).length < want && Wanted.spawnT <= 0) { spawnCop(); Wanted.spawnT = 2.5; }
  for (const c of cops) { if (Wanted.level === 0) c.ai.chasing = false; if (!c.ai.chasing && dist(c, player) > 110) removeCar(c); }
  Sound.siren(Wanted.level > 0 && nearest < 200 ? 1 - nearest / 200 : 0);
  if (Wanted.level > 0 && G.mode === 'play') {
    const slow = player.car ? Math.abs(player.car.speed) < 2.5 : true;
    const close = cops.some(c => c.ai.chasing && dist(c, player) < (player.car ? 7 : 6) && Math.abs(c.speed) < 4);
    G.bust = close && slow ? (G.bust || 0) + dt : 0;
    if (G.bust > 2.6) { G.bust = 0; knockout('busted'); }
  }
}
function manageTraffic() {
  const traffic = cars.filter(c => c.ai && !c.ai.police);
  for (const c of traffic) if (dist(c, player) > 300) removeCar(c);
  if (traffic.length < (isTouch ? 16 : 26)) spawnTraffic(player.x, player.z, 90, 260);
}
let chatT = 2;
function ambientChatter(dt) {
  chatT -= dt; if (chatT > 0) return; chatT = 2.5 + Math.random() * 3;
  const near = peds.filter(p => (p.state === 'walk' || p.state === 'idle') && !p.say && dist(p, player) < 22);
  if (!near.length) return;
  const p = R(near);
  if (!player.car && dist(p, player) < 6 && Math.random() < 0.5) { say(p, R(LINES.wave), 2.5); p.waveT = 1.2; }
  else say(p, R(LINES.ambient), 3);
}
function updateCamera(dt) {
  let tx, ty, tz, dd;
  if (player.car) {
    const c = player.car; tx = c.x; ty = c.y + 1.9; tz = c.z; dd = (c.type === 'furgo' || c.type === 'monte' ? 11 : 9.5) * (G.camFar ? 1.6 : 1);
    if (G.clock - camManualT > 1.4 && Math.abs(c.speed) > 1) { camYaw = lerpA(camYaw, c.speed < -2 ? c.h + Math.PI : c.h, dt * 2.6); camPitch += (0.2 - camPitch) * dt * 1.5; }
    camera.fov += (62 + Math.abs(c.speed) * 0.35 - camera.fov) * dt * 3;
  } else {
    tx = player.x; ty = player.y + 1.65; tz = player.z; dd = (Talk.open ? 3.6 : 5.2) * (G.camFar ? 1.7 : 1);
    if (G.clock - camManualT > (isTouch ? 1.2 : 3) && Math.hypot(...axes()) > 0.2) camYaw = lerpA(camYaw, player.h, dt * 1.2);
    camera.fov += (62 - camera.fov) * dt * 3;
  }
  camera.updateProjectionMatrix();
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  let k = 1;
  for (let s = 1; s <= 10; s++) {
    const f = s / 10, x = tx - Math.sin(camYaw) * cp * dd * f, y = ty + sp * dd * f, z = tz - Math.cos(camYaw) * cp * dd * f;
    if (pointBlocked(x, y, z)) { k = Math.max(0.15, (s - 1.5) / 10); break; }
  }
  const side = Talk.open ? 0.9 : 0;
  camera.position.set(tx - Math.sin(camYaw) * cp * dd * k - Math.cos(camYaw) * side, Math.max(0.6, ty + sp * dd * k), tz - Math.cos(camYaw) * cp * dd * k + Math.sin(camYaw) * side);
  if (shake > 0) { shake -= dt * 1.8; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(tx, ty + 0.2, tz);
}

// ---------- HUD ----------
const mm = $('minimap'), mctx = mm.getContext('2d');
function blip(ctx, x, y, color, size, shape) {
  ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath();
  if (shape === 'sq') ctx.rect(x - size, y - size, size * 2, size * 2); else ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}
function drawMinimap() {
  const S = 200, Rr = 96, cx = S / 2, cy = S / 2, view = player.car ? 0.75 + 0.3 * (1 - Math.min(1, Math.abs(player.car.speed) / 40)) : 1.1;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(camYaw), Math.sin(camYaw)), MSc = World.mapScale;
  mctx.save(); mctx.clearRect(0, 0, S, S);
  mctx.beginPath(); mctx.arc(cx, cy, Rr, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#2f6797'; mctx.fillRect(0, 0, S, S);
  mctx.translate(cx, cy); mctx.rotate(rot); mctx.scale(view / MSc, view / MSc);
  mctx.drawImage(World.mapImg, -(player.x + 700) * MSc, -(player.z + 700) * MSc);
  mctx.restore();
  const toMap = (x, z, ce) => {
    const dx = (x - player.x) * view, dz = (z - player.z) * view, c = Math.cos(rot), s = Math.sin(rot);
    let px = dx * c - dz * s, py = dx * s + dz * c; const l = Math.hypot(px, py);
    if (ce && l > Rr - 8) { px *= (Rr - 8) / l; py *= (Rr - 8) / l; }
    return [cx + px, cy + py, l <= Rr - 8];
  };
  if (!MS) for (const gv of givers) { const [x, y] = toMap(gv.x, gv.z, true); blip(mctx, x, y, '#f4d64e', 6, 'sq'); mctx.fillStyle = '#000'; mctx.font = 'bold 9px Arial'; mctx.textAlign = 'center'; mctx.fillText(gv.letter, x, y + 3); }
  { const [x, y] = toMap(H.x, H.z, true); blip(mctx, x, y, '#3fdf6f', 5, 'sq'); }
  for (const c of carts) { const [x, y, ins] = toMap(c.x, c.z, false); if (ins) blip(mctx, x, y, '#ff9a3c', 3.5, 'sq'); }
  if (hint) { const [x, y] = toMap(hint.x, hint.z, true); blip(mctx, x, y, '#4aa8ff', 5.5); }
  for (const c of cars) if (c.ai && c.ai.police && c.ai.chasing) { const [x, y, ins] = toMap(c.x, c.z, false); if (ins) blip(mctx, x, y, Math.floor(G.clock * 4) % 2 ? '#ff3030' : '#3060ff', 3.5); }
  for (const p of peds) if (p.state === 'fight') { const [x, y, ins] = toMap(p.x, p.z, false); if (ins) blip(mctx, x, y, '#ff3030', 2.5); }
  if (MS && beam.visible) { const [x, y] = toMap(beam.position.x, beam.position.z, true); blip(mctx, x, y, '#ff3b3b', 6); }
  const hh = player.car ? player.car.h : player.h;
  mctx.save(); mctx.translate(cx, cy); mctx.rotate(rot + Math.PI - hh);
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  const [nx, ny] = toMap(player.x, player.z - 1000, true);
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 3; mctx.font = 'bold 14px Arial'; mctx.textAlign = 'center';
  mctx.strokeText('N', nx, ny + 5); mctx.fillText('N', nx, ny + 5);
}
function drawBigMap() {
  const c = $('bigmap'), g = c.getContext('2d'), S = c.width, k = S / World.mapImg.width, W = x => (x + 700) * World.mapScale * k;
  g.drawImage(World.mapImg, 0, 0, S, S);
  g.font = 'bold 22px Impact, Arial'; g.textAlign = 'center';
  const lab = (t, x, z) => { g.lineWidth = 4; g.strokeStyle = '#000'; g.fillStyle = '#fff'; g.strokeText(t, W(x), W(z)); g.fillText(t, W(x), W(z)); };
  lab('PLAYA CORAL', -560, -330); lab('CENTRO', 50, 50); lab('LAS LOMAS', 100, -480); lab('PUERTO VIEJO', -380, 420); lab('VILLA PALMERAS', 430, 300); lab('BARRIO MANGLE', -380, -200);
  const b = (x, z, col, s, t) => { g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 2; g.fillRect(W(x) - s, W(z) - s, s * 2, s * 2); g.strokeRect(W(x) - s, W(z) - s, s * 2, s * 2); if (t) { g.fillStyle = '#000'; g.font = 'bold 13px Arial'; g.fillText(t, W(x), W(z) + 5); } };
  for (const gv of givers) b(gv.x, gv.z, '#f4d64e', 9, gv.letter);
  b(H.x, H.z, '#3fdf6f', 9, '$'); b(World.specials.hospital.x, World.specials.hospital.z, '#fff', 8, '+'); b(World.specials.police.x, World.specials.police.z, '#3060ff', 8, 'P');
  for (const ct of carts) b(ct.x, ct.z, '#ff9a3c', 6, '');
  if (hint) { g.fillStyle = '#4aa8ff'; g.beginPath(); g.arc(W(hint.x), W(hint.z), 8, 0, 7); g.fill(); g.stroke(); }
  if (MS && beam.visible) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(W(beam.position.x), W(beam.position.z), 9, 0, 7); g.fill(); g.stroke(); }
  const hh = player.car ? player.car.h : player.h;
  g.save(); g.translate(W(player.x), W(player.z)); g.rotate(-hh + Math.PI);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, S - 34, S, 34); g.fillStyle = '#fff'; g.font = '16px Arial';
  g.fillText('Amarillo: misiones · Verde: casa · Naranja: tacos · +: hospital · P: policía', S / 2, S - 12);
}
function updateHUD(dt) {
  const hh = Math.floor(G.time / 60), mi = Math.floor(G.time % 60);
  $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  G.shownMoney += (G.money - G.shownMoney) * Math.min(1, dt * 6); if (Math.abs(G.money - G.shownMoney) < 1) G.shownMoney = G.money;
  $('money').textContent = '$' + String(Math.round(G.shownMoney)).padStart(8, '0');
  $('healthfill').style.width = clamp(G.health, 0, 100) + '%';
  const st = $('stars').children; for (let i = 0; i < 5; i++) st[i].classList.toggle('on', i < Wanted.level);
  const nRec = Object.keys(G.records).length; $('records').textContent = nRec ? `DISCOS ${nRec}/25` : '';
  $('speedo').textContent = player.car ? Math.round(Math.abs(player.car.speed) * 3.6) + ' KM/H' : '';
  $('timer').textContent = MS && MS.timer !== null ? Math.floor(MS.timer / 60) + ':' + String(Math.floor(MS.timer % 60)).padStart(2, '0') : '';
  if (bigT > 0) { bigT -= dt; if (bigT <= 0) $('big').style.opacity = 0; }
  if (subT > 0) { subT -= dt; if (subT <= 0) nextSub(); }
  if (radioT > 0) { radioT -= dt; if (radioT <= 0) $('radio').style.opacity = 0; }
  if (vehT > 0) { vehT -= dt; if (vehT <= 0) $('vehname').style.opacity = 0; }
  const z = zoneName(player.x, player.z);
  if (z !== lastZone) { lastZone = z; $('zone').textContent = z; $('zone').style.opacity = 1; zoneT = 3.5; }
  if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) $('zone').style.opacity = 0; }
  if (hint) { hint.t -= dt; if (hint.t <= 0 || !recordMeshes.some(r => r.s.x === hint.x && r.s.z === hint.z)) hint = null; }
}

// ---------- presentaciones ----------
function shots() {
  const P = World.specials.plaza, roadX = nodePos(5, 0).x + 4;
  return [
    { t: 19.2, from: [-780, 10, 260], to: [-720, 7, 90], look: [-640, 5, 140], lookTo: [-620, 6, 60], dur: 5, cap: 'PALMERA SOFT presenta', sub: 'Playa Coral' },
    { t: 12.5, from: [roadX, 2.8, 230], to: [roadX, 3.2, 20], look: [roadX, 3, 130], lookTo: [roadX, 4, -80], dur: 5, cap: 'una historia original', sub: 'El Centro' },
    { t: 17.6, from: [H.x + 34, 9, H.z - 34], to: [H.x - 34, 7, H.z - 30], look: [H.x, 2, H.z + 14], lookTo: [H.x, 2, H.z + 14], dur: 5, cap: 'el barrio de siempre', sub: 'Villa Palmeras' },
    { t: 21.2, from: [P.x + 32, 7, P.z - 18], to: [P.x - 30, 6, P.z - 24], look: [P.x, 3, P.z], lookTo: [P.x, 4, P.z], dur: 5, cap: 'y su gente', sub: 'La Plaza' },
    { t: 20.0, from: [P.x + 170, 25, P.z + 230], to: [P.x + 150, 140, P.z + 200], look: [P.x, 30, P.z], lookTo: [P.x, 40, P.z], dur: 5.5, cap: 'BAHÍA DORADA', sub: 'Crónicas de la Costa' },
  ];
}
const Intro = { list: null, i: 0, t: 0 };
function focusOn(x, z) {
  player.x = x; player.z = z;
  for (const p of peds) respawnPed(p, true);
  for (const c of [...cars]) if (c.ai && !c.ai.police) removeCar(c);
  for (let k = 0; k < 12; k++) spawnTraffic(x, z, 10, 160);
}
function setShotCam(s, k) {
  const e = k * k * (3 - 2 * k), L = (a, b) => a + (b - a) * e;
  camera.position.set(L(s.from[0], s.to[0]), L(s.from[1], s.to[1]), L(s.from[2], s.to[2]));
  camera.lookAt(L(s.look[0], s.lookTo[0]), L(s.look[1], s.lookTo[1]), L(s.look[2], s.lookTo[2]));
  camera.fov = 55; camera.updateProjectionMatrix();
}
function simWorld(dt) {
  for (const c of cars) if (c.ai && !c.ai.police) { updateTraffic(c, dt); syncCar(c, dt); }
  for (const p of peds) updatePed(p, dt);
}
function startCine() {
  G.mode = 'intro'; Intro.list = shots(); Intro.i = -1; Intro.t = 0;
  $('title').classList.add('hidden'); $('cine').classList.remove('hidden'); $('collage').classList.add('hidden');
  player.p.group.visible = false;
  nextShot();
}
function nextShot() {
  Intro.i++; Intro.t = 0;
  const s = Intro.list && Intro.list[Intro.i];
  if (!s) return endIntro();
  G.time = s.t * 60; focusOn(s.look[0], s.look[2]); updateEnv(true);
  const ct = $('cinetext'); ct.innerHTML = `<div class="cap">${s.cap}</div><div class="csub">${s.sub}</div>`; ct.classList.remove('show'); void ct.offsetWidth; ct.classList.add('show');
}
function updateCine(dt) {
  Intro.t += dt; const s = Intro.list && Intro.list[Intro.i]; if (!s) return;
  setShotCam(s, Math.min(1, Intro.t / s.dur));
  simWorld(dt); G.clock += dt;
  if (Intro.t >= s.dur) nextShot();
}
function skipIntro() { if (G.mode === 'intro' && Intro.list) endIntro(); }
function endIntro() { Intro.list = null; $('cine').classList.add('hidden'); showMenu(); }
async function startClassic() {
  G.mode = 'introClassic'; $('title').classList.add('hidden'); $('cine').classList.add('hidden');
  const col = $('collage'); col.innerHTML = '<div class="loadtxt">Preparando viñetas…</div>'; col.classList.remove('hidden');
  player.p.group.visible = false;
  const list = shots().slice(0, 4), imgs = [];
  for (const s of list) {
    G.time = s.t * 60; focusOn(s.look[0], s.look[2]);
    for (let k = 0; k < 4; k++) simWorld(0.05);
    setShotCam(s, 0.5); updateDayNight(0); updateEnv(true);
    draw();
    imgs.push(canvas.toDataURL('image/jpeg', 0.82));
    await new Promise(r => requestAnimationFrame(r));
  }
  col.innerHTML = '';
  const caps = ['La playa nunca duerme.', 'El Centro, siempre con prisa.', 'Volver a casa.', 'Todos se conocen en la plaza.'];
  imgs.forEach((src, i) => {
    const d = document.createElement('div'); d.className = 'panel p' + i; d.style.animationDelay = (i * 0.45) + 's';
    d.innerHTML = `<img src="${src}" alt=""><span>${caps[i]}</span>`; col.appendChild(d);
  });
  showMenu();
}
function startPresentation() { if (settings.intro === 'cine') startCine(); else startClassic(); }
function showMenu() {
  G.mode = 'menu';
  const t = $('title'); t.classList.remove('hidden'); t.classList.toggle('classic', settings.intro !== 'cine');
  if (settings.intro === 'cine') $('collage').classList.add('hidden');
  G.time = 19 * 60; focusOn(World.specials.plaza.x, World.specials.plaza.z); updateEnv(true);
}
let menuA = 0;
function updateMenuCam(dt) {
  menuA += dt * 0.05; const c = World.specials.plaza;
  camera.position.set(c.x + Math.sin(menuA) * 160, 65, c.z + Math.cos(menuA) * 160); camera.lookAt(c.x, 18, c.z);
  camera.fov = 60; camera.updateProjectionMatrix();
  simWorld(dt); G.clock += dt;
}

// ---------- bucle ----------
function draw() { if (Post.on) Post.render(scene, camera, G.clock, night); else { renderer.setRenderTarget(null); renderer.render(scene, camera); } }
let last = performance.now(), hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === 'intro') { updateCine(dt); updateDayNight(dt); updateDynLights(dt); draw(); return; }
  if (G.mode === 'introClassic') return;
  if (G.mode === 'menu') { updateMenuCam(dt); updateDayNight(dt); updateDynLights(dt); draw(); return; }
  if (G.paused || G.portrait) { draw(); return; }
  G.clock += dt; G.time = (G.time + dt) % 1440;
  if (G.mode === 'play') {
    if (player.car) updatePlayerCar(dt); else updatePlayerFoot(dt);
    if (G.health <= 0) knockout('ko');
  } else if (G.mode === 'dead') {
    G.deadT += dt; $('fade').style.opacity = G.deadT > 2.5 ? 1 : 0;
    if (G.deadT > 3.6) { respawn(); $('fade').style.opacity = 0; }
  }
  for (const c of cars) {
    if (c.ai && c.ai.police) updateCop(c, dt);
    else if (c.ai) updateTraffic(c, dt);
    else if (c !== player.car) driveCar(c, 0, 0, true, dt);
  }
  carCollisions();
  for (const c of cars) syncCar(c, dt);
  for (const p of peds) updatePed(p, dt);
  for (const c of cars) if (c.ai && c.ai.police && Math.abs(c.speed) > 6) for (const p of peds) if (p.state !== 'down' && dist(p, c) < 2.4) knockDown(p, c.h);
  for (const c of carts) { if (c.say) { c.say.t -= dt; if (c.say.t <= 0) c.say = null; } poseIdle(c.vendor, G.clock, !!c.say); }
  for (const gv of givers) { gv.m.visible = !MS; gv.m.sprite.position.y = 3.0 + Math.sin(G.clock * 2) * 0.2; poseIdle(gv.npc, G.clock, false); }
  manageTraffic(); ambientChatter(dt); updateWanted(dt); updateMission(dt);
  for (let i = recordMeshes.length - 1; i >= 0; i--) {
    const r = recordMeshes[i]; r.m.rotation.y += dt * 2.5; r.m.position.y = 1.3 + Math.sin(G.clock * 3 + i) * 0.2;
    if (dist(r.s, player) < (player.car ? 2.8 : 1.4) && G.mode === 'play') {
      scene.remove(r.m); recordMeshes.splice(i, 1); G.records[r.k] = 1; G.money += 100; Sound.pickup();
      const n = Object.keys(G.records).length;
      showSub(`<span class="y">Disco de oro ${n}/25</span> +$100`, 2.5);
      if (n === 25) { G.money += 5000; showBig('¡TODOS LOS DISCOS!\n+$5000', '#f4d64e', 5); }
      save();
    }
  }
  beam.material.opacity = 0.25 + Math.sin(G.clock * 4) * 0.08;
  updateCamera(dt); updateDayNight(dt); updateHUD(dt); updateBubbles();
  hudT -= dt; if (hudT <= 0) { drawMinimap(); hudT = 1 / 30; }
  if (G.bigmap) drawBigMap();
  if (Math.floor(G.clock) % 30 === 0 && Math.floor(G.clock - dt) % 30 !== 0) save();
  updateDynLights(dt); draw();
}

function startGame() {
  Sound.init(); goLandscape();
  $('title').classList.add('hidden'); $('collage').classList.add('hidden'); $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  G.mode = 'play'; G.time = 9 * 60; loadSave(); if (G.time > 20 * 60 || G.time < 6 * 60) G.time = 9 * 60;
  buildPlayer(); player.p.group.visible = true;
  focusOn(H.x, H.z); player.x = H.x; player.z = H.z; player.h = H.h;
  camYaw = player.h; last = performance.now(); updateEnv(true);
  if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock();
  if (!Object.keys(G.missionsDone).length) {
    showSub('<span class="y">Rafa:</span> Cinco años fuera y Bahía Dorada huele igual... a mar y gasolina.', 4, true);
    showSub(`Tu coche, el <span class="g">Toro GT</span> verde, está frente a casa. Pulsa <b>${isTouch ? '🚗' : 'F'}</b> para subir.`, 5, true);
    showSub(`Acércate a la gente y pulsa <b>${isTouch ? '💬' : 'E'}</b> para hablar. Las letras <span class="y">amarillas</span> del radar son misiones.`, 5.5, true);
  } else showSub('Bienvenido de vuelta a <span class="y">Bahía Dorada</span>.', 3);
}
$('play').addEventListener('click', startGame);
$('optIntro').addEventListener('click', () => { settings.intro = settings.intro === 'cine' ? 'classic' : 'cine'; saveSettings(); applyGfx(); });
document.querySelectorAll('.optGfx').forEach(b => b.addEventListener('click', () => { settings.gfx = GFX_ORDER[(GFX_ORDER.indexOf(settings.gfx) + 1) % GFX_ORDER.length]; saveSettings(); applyGfx(); }));
$('optReplay').addEventListener('click', () => { $('title').classList.add('hidden'); startPresentation(); });
$('resume').addEventListener('click', () => { setPaused(false); if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock(); });
$('reset').addEventListener('click', () => { if (confirm('¿Borrar la partida guardada?')) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); } });
$('cine').addEventListener('click', skipIntro);
$('cine').addEventListener('touchstart', e => { e.preventDefault(); skipIntro(); }, { passive: false });
document.querySelectorAll('#talk [data-o]').forEach(b => {
  const go = e => { e.preventDefault(); e.stopPropagation(); talkOption(+b.dataset.o); };
  b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false });
});

applyGfx(); updateEnv(true);
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
startPresentation();
window.__game = { G, player, cars, peds, Wanted, startGame, settings, interact, talkOption, punch, toggleCar, camera, renderer, scene };
