'use strict';
// Bahía Dorada — lógica principal: jugador, coches, tráfico, peatones, policía, misiones, HUD.

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const lerpA = (a, b, t) => a + wrapA(b - a) * Math.min(1, t);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------- render ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1200);
scene.fog = new THREE.Fog(0x9cc8e8, 170, 520);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x55663a, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 0.9);
sun.castShadow = true; sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 500 });
sun.shadow.bias = -0.0006; scene.add(sun); scene.add(sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

buildWorld(scene);

// ---------- estado ----------
const SAVE_KEY = 'bahia-dorada-save-v1';
const G = { time: 8 * 60, money: 250, shownMoney: 250, health: 100, mode: 'title', paused: false, clock: 0,
  missionsDone: {}, records: {}, deadT: 0, bigmap: false, camFar: false };
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { G.money = s.money | 0; G.shownMoney = G.money; G.missionsDone = s.missionsDone || {}; G.records = s.records || {}; G.time = s.time || G.time; } } catch (e) { }
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money: G.money, missionsDone: G.missionsDone, records: G.records, time: G.time })); } catch (e) { } }
loadSave();

// ---------- jugador ----------
const player = { x: 0, z: 0, y: 0.3, vy: 0, h: 0, car: null, phase: 0, onGround: true, knock: 0 };
player.p = makePerson({ skin: 0x8d5524, shirt: 0xffffff, pants: 0x3b5998, cap: 0x1f6f2a, hair: 0x111111, vest: null });
scene.add(player.p.group);
const H = World.specials.hideout;
player.x = H.x; player.z = H.z; player.h = H.h;

// ---------- coches ----------
const cars = [];
function createCar(type, x, z, h, color) {
  const parts = makeCarMesh(type, color ?? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
  scene.add(parts.group);
  const c = { type, t: CAR_TYPES[type], parts, mesh: parts.group, x, z, h, y: groundAt(x, z), speed: 0, steer: 0, driver: null,
    hp: 100, wreck: false, ai: null, thr: 0, smoke: 0 };
  cars.push(c); syncCar(c, 0); return c;
}
function removeCar(c) { scene.remove(c.mesh); const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); }
function syncCar(c, dt) {
  c.y += (groundAt(c.x, c.z) - c.y) * Math.min(1, dt * 8);
  c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.y = c.h;
  c.mesh.rotation.z = clamp(-c.steer * c.speed * 0.004, -0.06, 0.06);
  c.mesh.rotation.x = clamp(-c.thr * 0.02 * (c.speed > 0 ? 1 : 0), -0.03, 0.03);
  for (const w of c.parts.wheels) { w.spin.rotation.x += c.speed * dt / 0.42; if (w.front) w.steer.rotation.y = c.steer * 0.5; }
  if (c.parts.bar) {
    const on = c.ai && c.ai.police && c.ai.chasing, f = Math.floor(G.clock * 6) % 2;
    c.parts.bar[0].material = on && f ? SH.red : on ? SH.off : SH.red;
    c.parts.bar[1].material = on && !f ? SH.blue : on ? SH.off : SH.blue;
  }
}
function damageCar(c, amt) {
  if (c.wreck) return;
  c.hp -= amt;
  if (c.hp <= 0) {
    c.wreck = true; c.hp = 0; c.parts.paint.color.set(0x1c1c1c);
    if (c === player.car) { showSub('<span class="r">¡El motor se ha roto!</span> Sal del coche (F).', 4); }
  }
}

// Física arcade de conducción con colisiones contra edificios.
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
      if (vn < -0.5) {
        impact = Math.max(impact, -vn);
        if (Math.abs(fx * n.x + fz * n.z) > 0.65) c.speed = -c.speed * 0.15; else c.speed *= 0.85;
      }
    }
  }
  if (impact > 6) { damageCar(c, impact * 0.9); if (c === player.car || dist(c, player) < 60) Sound.crash(impact / 30); if (c === player.car) shake = Math.min(1, impact / 25); }
}

// ---------- tráfico ----------
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function lanePoint(i, j, d) { const n = nodePos(i, j), f = DIRS[d]; return { x: n.x - f[1] * 4, z: n.z + f[0] * 4 }; }
function spawnTraffic(nearX, nearZ, minD, maxD) {
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1));
    const d = Math.floor(Math.random() * 4), ni = i + DIRS[d][0], nj = j + DIRS[d][1];
    if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
    const a = lanePoint(i, j, d), b = lanePoint(ni, nj, d), u = Math.random();
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
    const dd = Math.hypot(x - nearX, z - nearZ);
    if (dd < minD || dd > maxD) continue;
    if (cars.some(c => Math.hypot(c.x - x, c.z - z) < 10)) continue;
    const type = ['brisa', 'brisa', 'pelicano', 'furgo', 'bajito', 'toro'][Math.floor(Math.random() * 6)];
    const c = createCar(type, x, z, Math.atan2(DIRS[d][0], DIRS[d][1]));
    c.driver = 'ai'; c.speed = 8;
    c.ai = { ni, nj, d, cruise: 10 + Math.random() * 5, waitT: 0, ignoreT: 0 };
    c.ped = makePerson(); c.ped.group.scale.setScalar(0.9); // conductor visible
    c.ped.group.position.set(-0.45, CAR_TYPES[type].low ? 0.0 : 0.15, CAR_TYPES[type].cab[3]); c.ped.group.rotation.y = 0;
    c.ped.legL.rotation.x = c.ped.legR.rotation.x = -1.4; c.mesh.add(c.ped.group);
    return c;
  }
  return null;
}
function obstacleAhead(c, range) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  const check = (x, z, w) => {
    const dx = x - c.x, dz = z - c.z, fwd = dx * fx + dz * fz;
    if (fwd < 0.5 || fwd > range) return false;
    return Math.abs(dx * fz - dz * fx) < w;
  };
  for (const o of cars) if (o !== c && check(o.x, o.z, 2.4)) return true;
  if (!player.car && check(player.x, player.z, 1.8)) return true;
  for (const p of peds) if (p.state !== 'down' && check(p.x, p.z, 1.6)) return true;
  return false;
}
function updateTraffic(c, dt) {
  const ai = c.ai;
  let tg = lanePoint(ai.ni, ai.nj, ai.d);
  if (Math.hypot(tg.x - c.x, tg.z - c.z) < 5) {
    const opts = [];
    for (const nd of [ai.d, (ai.d + 1) % 4, (ai.d + 3) % 4]) {
      const ni = ai.ni + DIRS[nd][0], nj = ai.nj + DIRS[nd][1];
      if (ni >= 0 && nj >= 0 && ni <= N && nj <= N) opts.push(nd, nd === ai.d ? nd : -1);
    }
    const valid = opts.filter(v => v >= 0);
    const nd = valid.length ? valid[Math.floor(Math.random() * valid.length)] : (ai.d + 2) % 4;
    ai.d = nd; ai.ni += DIRS[nd][0]; ai.nj += DIRS[nd][1];
    tg = lanePoint(ai.ni, ai.nj, ai.d);
  }
  // apuntar a un punto en el carril, algo adelantado
  const desired = Math.atan2(tg.x - c.x, tg.z - c.z), diff = wrapA(desired - c.h);
  let target = Math.abs(diff) > 0.35 ? 6 : ai.cruise;
  ai.ignoreT -= dt;
  if (ai.ignoreT <= 0 && obstacleAhead(c, 11)) { target = 0; ai.waitT += dt; if (ai.waitT > 5) { ai.ignoreT = 1.5; ai.waitT = 0; } }
  else ai.waitT = 0;
  if (ai.panic > 0) { ai.panic -= dt; target = 20; }
  c.speed += clamp(target - c.speed, -18 * dt, 6 * dt);
  const turn = Math.max(0.6, Math.abs(c.speed) * 0.16) * dt;
  c.steer = clamp(diff * 2, -1, 1);
  c.h += clamp(diff, -turn, turn);
  c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt;
}

// ---------- policía ----------
const Wanted = { level: 0, lastCrime: -999, cool: 0, spawnT: 0 };
function addWanted(n, why) {
  const before = Wanted.level;
  Wanted.level = Math.min(5, Wanted.level + n); Wanted.lastCrime = G.clock; Wanted.cool = 0;
  if (Wanted.level > before) $('stars').classList.add('flash');
}
function spawnCop() {
  for (let tries = 0; tries < 30; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1)), n = nodePos(i, j);
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d < 90 || d > 200) continue;
    const c = createCar('patrulla', n.x + 3, n.z + 3, Math.atan2(player.x - n.x, player.z - n.z));
    c.driver = 'ai'; c.ai = { police: true, chasing: true, stuck: 0, rev: 0, ni: i, nj: j };
    c.ped = makePerson({ shirt: 0x1b3a8a, pants: 0x111a33, cap: 0x111a33 }); c.ped.group.scale.setScalar(0.9);
    c.ped.group.position.set(-0.45, 0.15, -0.2); c.ped.legL.rotation.x = c.ped.legR.rotation.x = -1.4; c.mesh.add(c.ped.group);
    return c;
  }
}
function updateCop(c, dt) {
  const ai = c.ai;
  const tx = player.x, tz = player.z, d = Math.hypot(tx - c.x, tz - c.z);
  let gx = tx, gz = tz;
  if (!ai.chasing) { // retirada
    driveCar(c, 0.6, 0, false, dt); return;
  }
  if (d > 45) { // navegar por la red de calles hacia el jugador
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
const peds = [];
const PED_MAX = isTouch ? 30 : 46;
function spawnPed(ped, near) {
  const bi = cellIdx(player.x), bj = cellIdx(player.z);
  for (let tries = 0; tries < 20; tries++) {
    const i = clamp(bi + Math.floor(Math.random() * 7) - 3, 0, N - 1), j = clamp(bj + Math.floor(Math.random() * 7) - 3, 0, N - 1);
    const c = blockCenter(i, j), t = Math.random() * SIDE * 8, p = perimeterPoint(c, t);
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (!near && d < 50) continue;
    Object.assign(ped, { c, t, x: p.x, z: p.z, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.6, state: 'walk', timer: 0 });
    ped.p.group.visible = true; ped.p.group.rotation.set(0, 0, 0);
    return;
  }
}
for (let k = 0; k < PED_MAX; k++) {
  const ped = { p: makePerson(), phase: Math.random() * 6 };
  scene.add(ped.p.group); peds.push(ped); spawnPed(ped, true);
}
function updatePed(ped, dt) {
  if (ped.state === 'down') {
    ped.timer -= dt;
    if (ped.timer <= 0) { ped.state = 'flee'; ped.timer = 5; ped.p.group.rotation.x = 0; }
    ped.p.group.position.set(ped.x, 0.55, ped.z);
    return;
  }
  const sp = ped.state === 'flee' ? 4.5 : ped.speed;
  if (ped.state === 'flee') { ped.timer -= dt; if (ped.timer <= 0) ped.state = 'walk'; }
  if (ped.state === 'off') { // recién expulsado del coche: corre hasta la acera
    const p = perimeterPoint(ped.c, ped.t); const dx = p.x - ped.x, dz = p.z - ped.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { ped.state = 'flee'; ped.timer = 6; }
    else { ped.x += dx / d * 4.5 * dt; ped.z += dz / d * 4.5 * dt; ped.h = Math.atan2(dx, dz); }
  } else {
    ped.t += ped.dir * sp * dt;
    const p = perimeterPoint(ped.c, ped.t);
    const dx = p.x - ped.x, dz = p.z - ped.z;
    if (dx * dx + dz * dz > 1e-6) ped.h = Math.atan2(dx, dz);
    ped.x = p.x; ped.z = p.z;
  }
  ped.phase += sp * dt * 2.6;
  animatePerson(ped.p, ped.phase, ped.state === 'flee' || ped.state === 'off' ? 0.9 : 0.55);
  ped.p.group.position.set(ped.x, groundAt(ped.x, ped.z), ped.z);
  ped.p.group.rotation.y = ped.h;
  if (Math.hypot(ped.x - player.x, ped.z - player.z) > 240) spawnPed(ped, false);
}
function knockPed(ped, c) {
  if (ped.state === 'down') return;
  ped.state = 'down'; ped.timer = 6;
  ped.p.group.rotation.x = -Math.PI / 2; ped.p.group.rotation.y = c.h;
  ped.x += Math.sin(c.h) * 3; ped.z += Math.cos(c.h) * 3;
  Sound.thud();
  if (c === player.car) { addWanted(1); c.speed *= 0.85; }
  for (const o of peds) if (o !== ped && o.state === 'walk' && dist(o, ped) < 25) { o.state = 'flee'; o.timer = 6; o.dir = -o.dir; }
}
function ejectDriver(c) {
  const ped = peds.find(p => p.state !== 'off' && Math.hypot(p.x - player.x, p.z - player.z) > 40) || peds[0];
  const lx = c.x + Math.cos(c.h) * 2.5, lz = c.z - Math.sin(c.h) * 2.5;
  const i = clamp(cellIdx(lx), 0, N - 1), j = clamp(cellIdx(lz), 0, N - 1);
  Object.assign(ped, { x: lx, z: lz, c: blockCenter(i, j), state: 'off', dir: 1 });
  let best = 0, bd = 1e9; for (let t = 0; t < SIDE * 8; t += 2) { const p = perimeterPoint(ped.c, t), d = Math.hypot(p.x - lx, p.z - lz); if (d < bd) { bd = d; best = t; } }
  ped.t = best; ped.p.group.rotation.set(0, 0, 0); ped.p.group.visible = true;
  if (c.ped) { c.mesh.remove(c.ped.group); c.ped = null; }
}

// ---------- coleccionables y marcadores ----------
const recordMeshes = [];
const recGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, 20).rotateX(Math.PI / 2);
const recMat = new THREE.MeshPhongMaterial({ color: 0xf4c430, emissive: 0x6a4a00, shininess: 120, specular: 0xffffff });
World.recordSpots.forEach((s, k) => {
  if (G.records[k]) return;
  const m = new THREE.Mesh(recGeo, recMat); m.position.set(s.x, 1.3, s.z); scene.add(m);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10).rotateX(Math.PI / 2), mat(0x222222)); m.add(hole);
  recordMeshes.push({ k, m, s });
});
function markerMesh(color, letter) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  cyl.position.y = 0.8; g.add(cyl);
  if (letter) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(letter, 128, 128, 'rgba(0,0,0,0)', '#f4d64e', 'bold 100px Impact, Arial Black'), depthTest: true }));
    sp.scale.set(1.5, 1.5, 1); sp.position.y = 3.2; g.add(sp); g.sprite = sp;
  }
  scene.add(g); return g;
}
const givers = World.specials.givers.map(gv => {
  const m = markerMesh(0xf4d64e, gv.letter); m.position.set(gv.x, 0.3, gv.z);
  const npc = makePerson({ shirt: gv.id === 'paquete' ? 0xc2185b : gv.id === 'carrera' ? 0xf08a24 : 0x5d4037, skin: gv.id === 'calor' ? 0xe0ac69 : 0x8d5524 });
  npc.group.position.set(gv.x + 2.4, 0.3, gv.z + 0.8); npc.group.rotation.y = Math.PI; scene.add(npc.group);
  return Object.assign({ m, npc }, gv);
});
const saveMarker = markerMesh(0x3fdf6f, '$'); saveMarker.position.set(H.x + 3, 0.3, H.z + 2);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 80, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false }));
beam.visible = false; scene.add(beam);

// coches aparcados y el coche de Rafa
World.parkSpots.forEach(s => createCar(['brisa', 'pelicano', 'furgo', 'bajito', 'toro', 'brisa'][Math.floor(Math.random() * 6)], s.x, s.z, s.h));
const HC = World.specials.homeCar;
for (let k = cars.length - 1; k >= 0; k--) if (dist(cars[k], HC) < 9) removeCar(cars[k]);
const homeCar = createCar('toro', HC.x, HC.z, HC.h, 0x2e7d32);

// ---------- input ----------
const keys = {};
const touch = { ax: 0, ay: 0, jump: false, sprint: false };
let camYaw = player.h, camPitch = 0.28, camManualT = -99, shake = 0;
addEventListener('keydown', e => {
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (G.mode === 'title') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' || e.code === 'Escape') { setPaused(!G.paused); return; }
  if (G.paused) return;
  if (e.code === 'KeyF' || e.code === 'Enter') toggleCar();
  if (e.code === 'KeyR') cycleRadio();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyI') $('help').classList.toggle('hidden');
  if (e.code === 'KeyC') G.camFar = !G.camFar;
  if (e.code === 'KeyH' && player.car) Sound.horn(true);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyH') Sound.horn(false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; Sound.horn(false); });
canvas.addEventListener('click', () => { if (G.mode !== 'title' && !G.paused && !isTouch && canvas.requestPointerLock) canvas.requestPointerLock(); });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  camYaw -= e.movementX * 0.0026; camPitch = clamp(camPitch + e.movementY * 0.002, -0.15, 1.1); camManualT = G.clock;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && G.mode === 'play' && !G.paused && !G.bigmap && !isTouch) setPaused(true);
});
function axes() {
  let ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.ax;
  let ay = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touch.ay;
  return [clamp(ax, -1, 1), clamp(ay, -1, 1)];
}

// controles táctiles
if (isTouch) {
  $('touch').classList.remove('hidden');
  const joy = $('joy'), knob = $('knob'); let jid = null, jr;
  joy.addEventListener('touchstart', e => { const t = e.changedTouches[0]; jid = t.identifier; jr = joy.getBoundingClientRect(); moveJoy(t); e.preventDefault(); }, { passive: false });
  const moveJoy = t => {
    let dx = (t.clientX - jr.left - jr.width / 2) / (jr.width / 2), dy = (t.clientY - jr.top - jr.height / 2) / (jr.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    touch.ax = dx; touch.ay = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
  };
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) moveJoy(t);
      else if (camTouch && t.identifier === camTouch.id) {
        camYaw -= (t.clientX - camTouch.x) * 0.006; camPitch = clamp(camPitch + (t.clientY - camTouch.y) * 0.004, -0.15, 1.1);
        camTouch.x = t.clientX; camTouch.y = t.clientY; camManualT = G.clock;
      }
    }
  }, { passive: false });
  let camTouch = null;
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t.clientX > innerWidth * 0.35) camTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
  addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) { jid = null; touch.ax = touch.ay = 0; knob.style.transform = ''; }
      if (camTouch && t.identifier === camTouch.id) camTouch = null;
    }
  });
  document.querySelectorAll('#tbtns button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); Sound.init();
      if (k === 'enter') toggleCar(); else if (k === 'radio') cycleRadio(); else if (k === 'map') toggleMap(); else touch[k] = true;
    }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); if (k === 'jump' || k === 'sprint') touch[k] = false; }, { passive: false });
  });
}

// ---------- acciones ----------
function toggleCar() {
  if (G.mode !== 'play') return;
  if (player.car) {
    const c = player.car;
    if (Math.abs(c.speed) > 8) return;
    const p = { x: c.x + Math.cos(c.h) * 2.4, z: c.z - Math.sin(c.h) * 2.4 };
    pushOut(p, 0.5);
    player.x = p.x; player.z = p.z; player.y = groundAt(p.x, p.z); player.h = c.h;
    c.driver = null; c.thr = 0; player.car = null; player.p.group.visible = true;
    Sound.setInCar(false); Sound.horn(false);
    return;
  }
  let best = null, bd = 4.8;
  for (const c of cars) { const d = dist(c, player); if (d < bd && !c.wreck) { bd = d; best = c; } }
  if (!best) return;
  if (best.driver === 'ai') {
    if (best.ai && best.ai.police) { addWanted(2); best.ai = null; }
    else addWanted(1);
    ejectDriver(best);
    best.ai = null;
  }
  best.driver = 'player'; player.car = best; player.p.group.visible = false;
  showVeh(best.t.name);
  Sound.setInCar(true);
  if (Sound.station) flashRadio(STATIONS[Sound.station].name);
}
function cycleRadio() { if (!player.car) return; flashRadio(Sound.nextStation()); }
let radioT = 0, vehT = 0, zoneT = 0, lastZone = '';
function flashRadio(t) { $('radio').textContent = t; $('radio').style.opacity = 1; radioT = 3; }
function showVeh(t) { $('vehname').textContent = t; $('vehname').style.opacity = 1; vehT = 3; }
function setPaused(p) {
  if (G.mode === 'title') return;
  G.paused = p; $('pause').classList.toggle('hidden', !p);
  if (p) { if (document.pointerLockElement) document.exitPointerLock(); Sound.setInCar(false); }
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
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1));
    const p = nodePos(i, j), d = dist(p, from);
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
      if (tries >= 50) { ni = clamp(ni, 0, N); nj = clamp(nj, 0, N); }
      prevD = d; cur = { i: ni, j: nj }; pts.push(Object.assign(nodePos(ni, nj), cur));
    }
    const steps = [{ type: 'car', text: 'Súbete a un <span class="b">coche</span> para la carrera.' }];
    pts.forEach((p, k) => steps.push({ type: 'goto', at: p, car: true, r: 9, time: k === 0 ? 30 + pts.length * 13 : null,
      text: `Punto de control <span class="y">${k + 1}/${pts.length}</span>` }));
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
let M = null;
function startMission(gv) {
  const def = MISSIONS[gv.id]();
  M = { id: gv.id, def, idx: -1, timer: null };
  showBig(def.title, '#f4d64e', 3);
  Sound.checkpoint();
  def.intro.forEach(([t, d]) => showSub(t, d, true));
  setTimeout(() => { if (M && M.def === def) nextStep(); }, def.intro.reduce((s, x) => s + x[1], 0) * 1000);
}
function nextStep() {
  M.idx++;
  const s = M.def.steps[M.idx];
  if (!s) return passMission();
  if (s.type === 'car' && player.car) return nextStep();
  if (s.time) M.timer = s.time;
  if (s.type === 'wanted') { Wanted.level = 0; addWanted(s.level); }
  showSub(s.text, 6);
  beam.visible = !!s.at;
  if (s.at) beam.position.set(s.at.x, 40, s.at.z);
}
function updateMission(dt) {
  if (!M || M.idx < 0) return;
  const s = M.def.steps[M.idx];
  if (M.timer !== null) { M.timer -= dt; if (M.timer <= 0) return failMission('Se acabó el tiempo.'); }
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
  G.money += M.def.reward; G.missionsDone[M.id] = (G.missionsDone[M.id] || 0) + 1;
  showBig('¡MISIÓN SUPERADA!\n+$' + M.def.reward, '#f4d64e', 4.5); Sound.pass();
  M = null; beam.visible = false; $('timer').textContent = '';
  const done = Object.keys(MISSIONS).every(k => G.missionsDone[k]);
  if (done && !G.missionsDone._all) { G.missionsDone._all = 1; showSub('<span class="y">¡Has completado todos los trabajos!</span> Bahía Dorada ya conoce tu nombre. Las misiones se pueden repetir por más dinero.', 7, true); }
  save();
}
function failMission(why) {
  if (!M) return;
  showBig('MISIÓN FALLIDA', '#ff5b5b', 3.5); showSub(why, 4); Sound.fail();
  M = null; beam.visible = false; $('timer').textContent = '';
}

// ---------- muerte / arresto ----------
function knockout(kind) {
  if (G.mode !== 'play') return;
  G.mode = 'dead'; G.deadT = 0;
  failMission(kind === 'busted' ? 'Te arrestaron.' : 'Acabaste en el hospital.');
  showBig(kind === 'busted' ? '¡ARRESTADO!' : '¡K.O.!', kind === 'busted' ? '#7ab8ff' : '#ff5b5b', 4);
  Sound.fail(); G.deadKind = kind;
  if (player.car) { player.car.driver = null; player.car = null; Sound.setInCar(false); }
  player.p.group.visible = true; player.p.group.rotation.x = kind === 'busted' ? 0 : -Math.PI / 2;
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

// ---------- ciclo de día ----------
const skyDay = new THREE.Color(0x8fc6ef), skyNight = new THREE.Color(0x0a1028), skySet = new THREE.Color(0xf08a4b), tmpC = new THREE.Color();
let night = 0;
function updateDayNight() {
  const ang = (G.time / 1440 - 0.25) * Math.PI * 2, elev = Math.sin(ang);
  const day = clamp((elev + 0.12) / 0.4, 0, 1); night = 1 - day;
  tmpC.copy(skyNight).lerp(skyDay, day);
  const set = Math.max(0, 1 - Math.abs(elev) / 0.22) * 0.6; tmpC.lerp(skySet, set);
  scene.background = tmpC; scene.fog.color.copy(tmpC);
  sun.intensity = 0.12 + 0.85 * day; hemi.intensity = 0.22 + 0.45 * day;
  sun.color.setHSL(0.1, 0.7, 0.6 + 0.3 * day);
  const sx = Math.cos(ang), sy = Math.max(0.25, Math.abs(elev));
  const tx = player.x, tz = player.z;
  sun.position.set(tx + sx * 160, sy * 220, tz + 90); sun.target.position.set(tx, 0, tz);
  for (const m of World.windowMats) m.emissiveIntensity = night * 0.95;
  for (const m of World.glowMats) m.emissiveIntensity = 0.3 + night * 0.9;
  World.sea.material.color.setHSL(0.57, 0.6, 0.12 + 0.3 * day);
}

// ---------- actualizaciones ----------
function updatePlayerFoot(dt) {
  const [ax, ay] = axes();
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = fx * ay + rx * ax, mz = fz * ay + rz * ax; const ml = Math.hypot(mx, mz);
  const sprint = keys.ShiftLeft || keys.ShiftRight || touch.sprint;
  let spd = 0;
  if (player.knock > 0) player.knock -= dt;
  else if (ml > 0.1) {
    spd = (sprint ? 8.5 : 4.2) * Math.min(1, ml); mx /= ml; mz /= ml;
    player.h = lerpA(player.h, Math.atan2(mx, mz), dt * 12);
    player.x += mx * spd * dt; player.z += mz * spd * dt;
  }
  if ((keys.Space || touch.jump) && player.onGround) { player.vy = 6.5; player.onGround = false; }
  player.vy -= 20 * dt; player.y += player.vy * dt;
  const g = groundAt(player.x, player.z);
  if (player.y <= g) { player.y = g; player.vy = 0; player.onGround = true; }
  const p = { x: player.x, z: player.z };
  pushOut(p, 0.45);
  for (const c of cars) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), r = c.t.len / 2 * 0.75 + 0.3;
    if (d < r && d > 0.01) {
      p.x = c.x + dx / d * r; p.z = c.z + dz / d * r;
      const v = Math.sin(c.h) * c.speed * (-dx / d) + Math.cos(c.h) * c.speed * (-dz / d);
      if (v > 6 && player.knock <= 0) { G.health -= v * 2.2; player.knock = 1.2; player.vy = 5; Sound.thud(); shake = 0.6; }
    }
  }
  player.x = p.x; player.z = p.z;
  player.phase += spd * dt * 2.4;
  animatePerson(player.p, player.phase, player.onGround ? Math.min(1, spd / 5) * 0.8 : 0.3);
  player.p.group.position.set(player.x, player.y, player.z); player.p.group.rotation.y = player.h;
  player.p.group.rotation.x = player.knock > 0 ? -1.2 * Math.min(1, player.knock) : 0;
  // prompts
  let prompt = '';
  const near = cars.find(c => dist(c, player) < 4.8 && !c.wreck);
  if (near) prompt = `<b>${isTouch ? '🚗' : 'F'}</b> — entrar al ${near.t.name}${near.driver === 'ai' ? ' <span style="color:#ff6b6b">(robar)</span>' : ''}`;
  if (!M) for (const gv of givers) if (dist(gv, player) < 2) { startMission(gv); break; }
  if (!M) for (const gv of givers) if (dist(gv, player) < 10) prompt = `Misión de <b>${gv.name}</b>: entra en el círculo amarillo.`;
  if (dist(saveMarker.position, player) < 1.8) {
    if (!G.savedHere) { G.savedHere = true; G.health = 100; save(); showSub('<span class="g">Partida guardada.</span> Salud restaurada.', 3); Sound.pickup(); }
  } else G.savedHere = false;
  $('prompt').innerHTML = prompt;
}
function updatePlayerCar(dt) {
  const c = player.car, [ax, ay] = axes();
  driveCar(c, ay, -ax, keys.Space || touch.jump, dt);
  player.x = c.x; player.z = c.z; player.y = c.y;
  Sound.engine(c.speed, c.t.max, ay > 0);
  for (const p of peds) if (p.state !== 'down' && Math.abs(c.speed) > 4 && dist(p, c) < c.t.len / 2 + 0.3) knockPed(p, c);
  $('prompt').innerHTML = '';
}
function carCollisions() {
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b], dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz;
    if (d2 > 25 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), r = 2.3;
    if (d >= r) continue;
    const nx = dx / d, nz = dz / d, push = (r - d) / 2;
    A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
    const va = (Math.sin(A.h) * nx + Math.cos(A.h) * nz) * A.speed, vb = (Math.sin(B.h) * nx + Math.cos(B.h) * nz) * B.speed;
    const rel = va - vb;
    if (rel > 0.5) {
      A.speed *= 0.55; B.speed *= 0.55;
      if (rel > 7) {
        damageCar(A, rel * 0.7); damageCar(B, rel * 0.7);
        if (A === player.car || B === player.car) {
          Sound.crash(rel / 25); shake = Math.min(1, rel / 20);
          const other = A === player.car ? B : A;
          if (other.ai && other.ai.police) addWanted(1);
          else if (other.ai && !other.ai.police) other.ai.panic = 3;
        }
      }
    }
  }
}
function updateWanted(dt) {
  const cops = cars.filter(c => c.ai && c.ai.police);
  let nearest = 1e9; for (const c of cops) if (c.ai.chasing) nearest = Math.min(nearest, dist(c, player));
  if (Wanted.level > 0) {
    if (G.clock - Wanted.lastCrime > 10 && nearest > 70) { Wanted.cool += dt; if (Wanted.cool > 9) { Wanted.level--; Wanted.cool = 0; } }
    else Wanted.cool = 0;
    if (G.clock - Wanted.lastCrime > 2) $('stars').classList.remove('flash');
  } else $('stars').classList.remove('flash');
  const want = Wanted.level === 0 ? 0 : Math.min(7, 1 + Math.floor(Wanted.level * 1.4));
  const active = cops.filter(c => c.ai.chasing).length;
  Wanted.spawnT -= dt;
  if (active < want && Wanted.spawnT <= 0) { spawnCop(); Wanted.spawnT = 2.5; }
  for (const c of cops) {
    if (Wanted.level === 0) c.ai.chasing = false;
    if (!c.ai.chasing && dist(c, player) > 110) removeCar(c);
  }
  Sound.siren(Wanted.level > 0 && nearest < 200 ? 1 - nearest / 200 : 0);
  // arresto
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
  const want = isTouch ? 18 : 28;
  if (traffic.length < want) spawnTraffic(player.x, player.z, 90, 260);
  // coches abandonados lejanos (no aparcados originales) se quitan
  for (const c of cars) if (!c.ai && c.driver === null && c.abandoned && dist(c, player) > 350) removeCar(c);
}

let camShakeV = new THREE.Vector3();
function updateCamera(dt) {
  let tx, ty, tz, dd;
  if (player.car) {
    const c = player.car; tx = c.x; ty = c.y + 1.9; tz = c.z; dd = (c.type === 'furgo' ? 11 : 9.5) * (G.camFar ? 1.6 : 1);
    if (G.clock - camManualT > 1.4 && Math.abs(c.speed) > 1) {
      camYaw = lerpA(camYaw, c.speed < -2 ? c.h + Math.PI : c.h, dt * 2.6);
      camPitch += (0.2 - camPitch) * dt * 1.5;
    }
    camera.fov += (65 + Math.abs(c.speed) * 0.35 - camera.fov) * dt * 3;
  } else {
    tx = player.x; ty = player.y + 1.7; tz = player.z; dd = 5.5 * (G.camFar ? 1.7 : 1);
    if ((isTouch || G.clock - camManualT > 3) && Math.hypot(...axes()) > 0.2 && G.clock - camManualT > 1.5) camYaw = lerpA(camYaw, player.h, dt * 1.2);
    camera.fov += (65 - camera.fov) * dt * 3;
  }
  camera.updateProjectionMatrix();
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  let k = 1;
  for (let s = 1; s <= 10; s++) {
    const f = s / 10, x = tx - Math.sin(camYaw) * cp * dd * f, y = ty + sp * dd * f, z = tz - Math.cos(camYaw) * cp * dd * f;
    if (pointBlocked(x, y, z)) { k = Math.max(0.15, (s - 1.5) / 10); break; }
  }
  camera.position.set(tx - Math.sin(camYaw) * cp * dd * k, Math.max(0.6, ty + sp * dd * k), tz - Math.cos(camYaw) * cp * dd * k);
  if (shake > 0) { shake -= dt * 1.8; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(tx, ty + 0.2, tz);
}

// ---------- HUD ----------
const mm = $('minimap'), mctx = mm.getContext('2d');
function blip(ctx, x, y, color, size, shape) {
  ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (shape === 'sq') ctx.rect(x - size, y - size, size * 2, size * 2); else ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}
function drawMinimap() {
  const S = 200, R = 96, cx = S / 2, cy = S / 2, view = player.car ? 0.75 + 0.3 * (1 - Math.min(1, Math.abs(player.car.speed) / 40)) : 1.1;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(camYaw), Math.sin(camYaw));
  const MS = World.mapScale;
  mctx.save(); mctx.clearRect(0, 0, S, S);
  mctx.beginPath(); mctx.arc(cx, cy, R, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#2f6797'; mctx.fillRect(0, 0, S, S);
  mctx.translate(cx, cy); mctx.rotate(rot); mctx.scale(view / MS, view / MS);
  mctx.drawImage(World.mapImg, -(player.x + 700) * MS, -(player.z + 700) * MS);
  mctx.restore();
  const toMap = (x, z, clampEdge) => {
    let dx = (x - player.x) * view, dz = (z - player.z) * view;
    const c = Math.cos(rot), s = Math.sin(rot); let px = dx * c - dz * s, py = dx * s + dz * c;
    const l = Math.hypot(px, py);
    if (clampEdge && l > R - 8) { px *= (R - 8) / l; py *= (R - 8) / l; }
    return [cx + px, cy + py, l <= R - 8];
  };
  if (!M) for (const gv of givers) { const [x, y] = toMap(gv.x, gv.z, true); blip(mctx, x, y, '#f4d64e', 6, 'sq'); mctx.fillStyle = '#000'; mctx.font = 'bold 9px Arial'; mctx.textAlign = 'center'; mctx.fillText(gv.letter, x, y + 3); }
  { const [x, y] = toMap(H.x, H.z, true); blip(mctx, x, y, '#3fdf6f', 5, 'sq'); }
  for (const c of cars) if (c.ai && c.ai.police && c.ai.chasing) { const [x, y, inside] = toMap(c.x, c.z, false); if (inside) blip(mctx, x, y, Math.floor(G.clock * 4) % 2 ? '#ff3030' : '#3060ff', 3.5); }
  if (M && beam.visible) { const [x, y] = toMap(beam.position.x, beam.position.z, true); blip(mctx, x, y, '#ff3b3b', 6); }
  // jugador
  const hh = (player.car ? player.car.h : player.h);
  mctx.save(); mctx.translate(cx, cy); mctx.rotate(rot + Math.PI - hh);
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  // norte
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
  b(H.x, H.z, '#3fdf6f', 9, '$');
  b(World.specials.hospital.x, World.specials.hospital.z, '#fff', 8, '+');
  b(World.specials.police.x, World.specials.police.z, '#3060ff', 8, 'P');
  if (M && beam.visible) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(W(beam.position.x), W(beam.position.z), 9, 0, 7); g.fill(); g.stroke(); }
  const hh = player.car ? player.car.h : player.h;
  g.save(); g.translate(W(player.x), W(player.z)); g.rotate(-hh + Math.PI);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, S - 34, S, 34); g.fillStyle = '#fff'; g.font = '16px Arial';
  g.fillText('Amarillo: misiones · Verde: casa (guardar) · +: hospital · P: policía · M para cerrar', S / 2, S - 12);
}
function updateHUD(dt) {
  const hh = Math.floor(G.time / 60), mi = Math.floor(G.time % 60);
  $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  G.shownMoney += (G.money - G.shownMoney) * Math.min(1, dt * 6);
  if (Math.abs(G.money - G.shownMoney) < 1) G.shownMoney = G.money;
  $('money').textContent = '$' + String(Math.round(G.shownMoney)).padStart(8, '0');
  $('healthfill').style.width = clamp(G.health, 0, 100) + '%';
  const st = $('stars').children; for (let i = 0; i < 5; i++) st[i].classList.toggle('on', i < Wanted.level);
  const nRec = Object.keys(G.records).length; $('records').textContent = nRec ? `DISCOS ${nRec}/25` : '';
  $('speedo').textContent = player.car ? Math.round(Math.abs(player.car.speed) * 3.6) + ' KM/H' : '';
  $('timer').textContent = M && M.timer !== null ? Math.floor(M.timer / 60) + ':' + String(Math.floor(M.timer % 60)).padStart(2, '0') : '';
  if (bigT > 0) { bigT -= dt; if (bigT <= 0) $('big').style.opacity = 0; }
  if (subT > 0) { subT -= dt; if (subT <= 0) nextSub(); }
  if (radioT > 0) { radioT -= dt; if (radioT <= 0) $('radio').style.opacity = 0; }
  if (vehT > 0) { vehT -= dt; if (vehT <= 0) $('vehname').style.opacity = 0; }
  const z = zoneName(player.x, player.z);
  if (z !== lastZone) { lastZone = z; $('zone').textContent = z; $('zone').style.opacity = 1; zoneT = 3.5; }
  if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) $('zone').style.opacity = 0; }
}

// ---------- bucle ----------
let last = performance.now(), titleA = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === 'title') {
    titleA += dt * 0.05;
    G.time = 18.6 * 60;
    updateDayNight();
    const c = World.specials.plaza;
    camera.position.set(c.x + Math.sin(titleA) * 170, 70, c.z + Math.cos(titleA) * 170); camera.lookAt(c.x, 20, c.z);
    for (const car of cars) if (car.ai) { updateTraffic(car, dt); syncCar(car, dt); }
    manageTraffic();
    renderer.render(scene, camera); return;
  }
  if (G.paused) return;
  G.clock += dt; G.time = (G.time + dt) % 1440;
  updateDayNight();
  if (G.mode === 'play') {
    if (player.car) updatePlayerCar(dt); else updatePlayerFoot(dt);
    if (G.health <= 0) knockout('ko');
  } else if (G.mode === 'dead') {
    G.deadT += dt;
    $('fade').style.opacity = G.deadT > 2.5 ? 1 : 0;
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
  for (const c of cars) if (c.ai && c.ai.police) for (const p of peds) if (p.state !== 'down' && Math.abs(c.speed) > 6 && dist(p, c) < 2.4) knockPed(p, c);
  manageTraffic();
  updateWanted(dt);
  updateMission(dt);
  // coleccionables
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
  for (const gv of givers) { gv.m.visible = !M; gv.m.sprite.position.y = 3.2 + Math.sin(G.clock * 2) * 0.25; }
  beam.material.opacity = 0.25 + Math.sin(G.clock * 4) * 0.08;
  updateCamera(dt);
  updateHUD(dt);
  hudT -= dt; if (hudT <= 0) { drawMinimap(); hudT = 1 / 30; }
  if (G.bigmap) drawBigMap();
  if (Math.floor(G.clock) % 30 === 0 && Math.floor(G.clock - dt) % 30 !== 0) save();
  renderer.render(scene, camera);
}
for (let k = 0; k < (isTouch ? 14 : 22); k++) spawnTraffic(0, 0, 0, 900);
requestAnimationFrame(frame);

function startGame() {
  Sound.init();
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  G.mode = 'play'; G.time = 9 * 60; loadSave(); if (G.time > 20 * 60 || G.time < 6 * 60) G.time = 9 * 60;
  for (const c of [...cars]) if (c.ai && !c.ai.police) removeCar(c);
  for (let k = 0; k < (isTouch ? 14 : 22); k++) spawnTraffic(player.x, player.z, 30, 280);
  camYaw = player.h; last = performance.now();
  if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock();
  const first = !Object.keys(G.missionsDone).length;
  if (first) {
    showSub('<span class="y">Rafa:</span> Cinco años fuera y Bahía Dorada huele igual... a mar y gasolina.', 4, true);
    showSub('Tu coche, el <span class="g">Toro GT</span> verde, está aparcado frente a casa. Pulsa <b>F</b> para subir.', 5, true);
    showSub('Las letras <span class="y">amarillas</span> del radar son contactos con trabajo. El <span class="g">$</span> verde guarda la partida.', 5.5, true);
  } else showSub('Bienvenido de vuelta a <span class="y">Bahía Dorada</span>.', 3);
}
$('play').addEventListener('click', startGame);
$('resume').addEventListener('click', () => { setPaused(false); if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock(); });
$('reset').addEventListener('click', () => { if (confirm('¿Borrar la partida guardada?')) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); } });
window.__game = { G, player, cars, peds, Wanted, startGame };
