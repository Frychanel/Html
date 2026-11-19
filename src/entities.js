'use strict';
// Modelos originales: personas (geometría fusionada con colores por vértice) y vehículos con carrocería perfilada.

const PERSON_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const _col = new THREE.Color();
function mergeParts(list) {
  let total = 0;
  const gs = list.map(([geo, color, m]) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (m) g.applyMatrix4(m); total += g.attributes.position.count; return [g, color]; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const [g, c] of gs) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    _col.set(c); for (let i = 0; i < n; i++) { col[(o + i) * 3] = _col.r; col[(o + i) * 3 + 1] = _col.g; col[(o + i) * 3 + 2] = _col.b; }
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0) => mtx(x, y, z, ry, rx, sx, sy, sz);
const G_BOX = new THREE.BoxGeometry(1, 1, 1), G_SPH = new THREE.SphereGeometry(1, 10, 8), G_CAP = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 10), G_TORSO = new THREE.CylinderGeometry(0.5, 0.42, 1, 8);

const SKINS = [0x5a3a22, 0x7a4e2d, 0x8d5524, 0xa86b3c, 0xc68642, 0xd9a066, 0xe0ac69, 0xf1c27d, 0xffdbac];
const HAIRS = [0x111111, 0x2a1a10, 0x4a2c16, 0x7a5230, 0xb08850, 0x9a9a9a, 0x1a1a1a];
const TOPS = [0xd94040, 0x3a7bd5, 0xf2c14e, 0x58a55c, 0xf4f4f0, 0x222222, 0x8e44ad, 0xe67e22, 0x16a085, 0xf06292, 0x6d7b8a, 0x9c2a2a, 0x2a4a7a, 0xd8c8a8];
const BOTTOMS = [0x2c3e50, 0x34495e, 0x1a1a1a, 0x6d5d4b, 0x3b5998, 0x7f8c8d, 0x4a5a7a, 0xc8b89a, 0x223355];
const SHOES = [0x111111, 0xf2f2f2, 0x6b4428, 0x333344, 0xb22222];
const rnd = a => a[Math.floor(Math.random() * a.length)];

// o: {skin, hair, hairStyle, top, topType, bottom, bottomType, shoes, cap, female, height, beard, glasses}
function personLook(o = {}) {
  const female = o.female ?? Math.random() < 0.5;
  return Object.assign({
    female, skin: rnd(SKINS), hair: rnd(HAIRS),
    hairStyle: female ? rnd(['long', 'long', 'bun', 'short']) : rnd(['short', 'short', 'buzz', 'bald', 'short']),
    top: rnd(TOPS), topType: rnd(female ? ['tshirt', 'tank', 'long', 'jacket'] : ['tshirt', 'tshirt', 'tank', 'long', 'jacket']),
    bottom: rnd(BOTTOMS), bottomType: female ? rnd(['jeans', 'skirt', 'shorts', 'jeans']) : rnd(['jeans', 'jeans', 'shorts']),
    shoes: rnd(SHOES), cap: !female && Math.random() < 0.2 ? rnd(TOPS) : null,
    height: (female ? 0.94 : 1) * (0.94 + Math.random() * 0.12), beard: !female && Math.random() < 0.25, glasses: Math.random() < 0.15,
  }, o);
}
function makePerson(opts) {
  const L = personLook(opts), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const sk = L.skin, w = L.female ? 0.9 : 1;
  const torsoCol = L.top, sleeveCol = L.topType === 'tank' ? sk : L.top;
  const parts = [
    [G_TORSO, torsoCol, M(0, 1.24, 0, 0.44 * w, 0.56, 0.26)],
    [G_BOX, L.bottom, M(0, 0.97, 0, 0.36 * w, 0.18, 0.23)],
    [G_CYL, sk, M(0, 1.55, 0, 0.065, 0.1, 0.065)],
    [G_SPH, sk, M(0, 1.71, 0, 0.12, 0.14, 0.13)],
    [G_BOX, 0x1a1a1a, M(-0.045, 1.73, 0.118, 0.03, 0.02, 0.01)], [G_BOX, 0x1a1a1a, M(0.045, 1.73, 0.118, 0.03, 0.02, 0.01)],
    [G_BOX, 0x7a3a2a, M(0, 1.645, 0.115, 0.05, 0.012, 0.01)],
    [G_BOX, sk, M(0, 1.69, 0.13, 0.025, 0.04, 0.03)],
  ];
  if (L.topType === 'jacket') parts.push([G_BOX, 0x1d1d1d, M(0, 1.24, 0.11, 0.06, 0.5, 0.06)]);
  if (L.topType === 'tank') parts.push([G_BOX, sk, M(0, 1.47, 0.02, 0.24 * w, 0.06, 0.2)]);
  if (L.hairStyle !== 'bald') parts.push([G_CAP, L.hair, M(0, 1.73, -0.005, 0.128, L.hairStyle === 'buzz' ? 0.09 : 0.13, 0.138)]);
  if (L.hairStyle === 'long') parts.push([G_BOX, L.hair, M(0, 1.6, -0.08, 0.25, 0.32, 0.08)]);
  if (L.hairStyle === 'bun') parts.push([G_SPH, L.hair, M(0, 1.83, -0.1, 0.07, 0.07, 0.07)]);
  if (L.beard) parts.push([G_BOX, L.hair, M(0, 1.63, 0.08, 0.2, 0.08, 0.1)]);
  if (L.glasses) parts.push([G_BOX, 0x111111, M(0, 1.735, 0.125, 0.2, 0.035, 0.02)]);
  if (L.cap) { parts.push([G_CAP, L.cap, M(0, 1.76, 0, 0.135, 0.11, 0.142)]); parts.push([G_BOX, L.cap, M(0, 1.775, 0.15, 0.2, 0.025, 0.14)]); }
  if (L.bottomType === 'skirt') parts.push([new THREE.CylinderGeometry(0.17, 0.27, 0.42, 10), L.bottom, M(0, 0.78, 0)]);
  const bodyMesh = new THREE.Mesh(mergeParts(parts), PERSON_MAT); bodyMesh.castShadow = true; body.add(bodyMesh);
  const legLow = L.bottomType === 'jeans' ? L.bottom : sk, legUp = L.bottomType === 'skirt' ? sk : L.bottom;
  const limb = (x, y, list) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = new THREE.Mesh(mergeParts(list), PERSON_MAT); m.castShadow = true; p.add(m); body.add(p); return p; };
  const leg = x => limb(x, 0.92, [
    [G_BOX, legUp, M(0, -0.22, 0, 0.16, 0.46, 0.18)], [G_BOX, legLow, M(0, -0.63, 0, 0.14, 0.4, 0.15)],
    [G_BOX, L.shoes, M(0, -0.87, 0.05, 0.15, 0.1, 0.28)]]);
  const arm = x => limb(x, 1.47, [
    [G_BOX, sleeveCol, M(0, -0.15, 0, 0.12, 0.3, 0.13)], [G_BOX, L.topType === 'long' || L.topType === 'jacket' ? L.top : sk, M(0, -0.43, 0, 0.1, 0.28, 0.11)],
    [G_BOX, sk, M(0, -0.62, 0.01, 0.09, 0.12, 0.07)]]);
  const legL = leg(-0.1 * w), legR = leg(0.1 * w), armL = arm(-0.27 * w), armR = arm(0.27 * w);
  g.scale.setScalar(L.height);
  return { group: g, body, legL, legR, armL, armR, look: L };
}
function disposePerson(p) { p.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
function animatePerson(p, phase, amt) {
  const s = Math.sin(phase) * amt;
  p.legL.rotation.x = s; p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
  p.armL.rotation.z = 0; p.armR.rotation.z = 0;
  p.body.position.y = Math.abs(Math.cos(phase)) * amt * 0.05;
}
function poseIdle(p, t, talk) {
  p.legL.rotation.x = p.legR.rotation.x = 0; p.body.position.y = 0;
  p.armL.rotation.x = Math.sin(t * 1.3) * 0.04; p.armR.rotation.x = -Math.sin(t * 1.3) * 0.04;
  p.armL.rotation.z = -0.06; p.armR.rotation.z = 0.06;
  if (talk) { p.armR.rotation.x = -0.6 - Math.sin(t * 5) * 0.35; p.armR.rotation.z = 0.2; }
}
function poseSit(p) { p.legL.rotation.x = p.legR.rotation.x = -1.45; p.armL.rotation.x = p.armR.rotation.x = -0.3; }

// ---------------- vehículos ----------------
const CAR_TYPES = {
  brisa:    { name: 'Brisa',    len: 4.5, wid: 1.86, base: 0.3,  hb: 0.95, roof: 1.44, hf: 0.82, ht: 0.93, cf: 0.85, rf: 0.12, rr: -0.95, cr: -1.45, r: 0.34, max: 36, acc: 13 },
  toro:     { name: 'Toro GT',  len: 4.8, wid: 1.96, base: 0.27, hb: 0.9,  roof: 1.3,  hf: 0.86, ht: 0.9,  cf: 0.5,  rf: -0.2, rr: -0.85, cr: -1.4, r: 0.36, max: 46, acc: 19, stripe: true },
  furgo:    { name: 'Furgo',    len: 5.2, wid: 2.05, base: 0.36, hb: 1.15, roof: 2.35, hf: 1.0,  ht: 1.15, cf: 1.8,  rf: 1.2,  rr: -2.5, cr: -2.6, r: 0.38, max: 29, acc: 10, van: true },
  pelicano: { name: 'Pelícano', len: 3.9, wid: 1.76, base: 0.3,  hb: 0.92, roof: 1.48, hf: 0.8,  ht: 0.98, cf: 0.85, rf: 0.25, rr: -1.45, cr: -1.85, r: 0.32, max: 40, acc: 16 },
  bajito:   { name: 'Bajito',   len: 5.3, wid: 1.96, base: 0.2,  hb: 0.76, roof: 1.2,  hf: 0.7,  ht: 0.76, cf: 0.75, rf: 0.1,  rr: -1.0, cr: -1.55, r: 0.33, max: 38, acc: 13, chrome: true },
  monte:    { name: 'Monte 4x4', len: 4.8, wid: 2.0, base: 0.48, hb: 1.28, roof: 1.98, hf: 1.18, ht: 1.28, cf: 1.0,  rf: 0.45, rr: -2.1, cr: -2.25, r: 0.44, max: 37, acc: 14 },
  taxi:     { name: 'Taxi',     len: 4.6, wid: 1.86, base: 0.3,  hb: 0.95, roof: 1.44, hf: 0.82, ht: 0.93, cf: 0.85, rf: 0.12, rr: -0.95, cr: -1.45, r: 0.34, max: 37, acc: 13, taxi: true },
  patrulla: { name: 'Patrulla', len: 4.7, wid: 1.9,  base: 0.3,  hb: 0.96, roof: 1.45, hf: 0.84, ht: 0.95, cf: 0.85, rf: 0.12, rr: -0.95, cr: -1.5, r: 0.35, max: 44, acc: 18, police: true },
};
const CAR_COLORS = [0x9e1b1b, 0x1e4f96, 0xe8e8e6, 0x161616, 0x2e6b4a, 0xc9a227, 0x6b3a1a, 0x4b3f8a, 0x2a8a8a, 0xb8b8bc, 0xd8653a, 0x6b1530, 0x4a4f55, 0x7a8a96];
const SH = {
  glass: new THREE.MeshStandardMaterial({ color: 0x0d1620, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide }),
  trim: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.2 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.12, metalness: 1 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 0.25, roughness: 0.1 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x700000, emissive: 0xff1010, emissiveIntensity: 0.25, roughness: 0.2 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff2020 }), blue: new THREE.MeshBasicMaterial({ color: 0x2050ff }),
  off: new THREE.MeshStandardMaterial({ color: 0x333333 }), white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xb0b4b8, roughness: 0.25, metalness: 0.9 }),
};
World.glowMats.push(SH.head);
const wheelCache = {};
function wheelGeos(r, chrome) {
  const k = r + '' + chrome; if (wheelCache[k]) return wheelCache[k];
  const tire = new THREE.CylinderGeometry(r, r, 0.26, 16).rotateZ(Math.PI / 2);
  const parts = [[new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.28, 14).rotateZ(Math.PI / 2), 0xffffff, null]];
  for (let s = 0; s < 5; s++) parts.push([G_BOX, 0xffffff, mtx(0.145, 0, 0, 0, s / 5 * Math.PI * 2, 0.02, r * 1.2, 0.07)]);
  const rim = mergeParts(parts); rim.deleteAttribute('color');
  return wheelCache[k] = { tire, rim };
}
function shapeFrom(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function extrudeSide(pts, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); return g;
}
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals(); return g;
}
function makeCarMesh(typeKey, color) {
  const t = CAR_TYPES[typeKey], g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ';
  const L = t.len, W = t.wid, hl = L / 2;
  if (t.police) color = 0x141414; if (t.taxi) color = 0xf2c418;
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
  const bodyPts = [[-hl, t.base + 0.12], [-hl + 0.15, t.base], [hl - 0.15, t.base], [hl, t.base + 0.12], [hl, t.hf], [hl - 0.4, t.hb], [t.cf, t.hb + 0.03], [t.cr, t.hb + 0.03], [-hl + 0.3, t.ht], [-hl, t.ht - 0.1]];
  add(extrudeSide(bodyPts, W, 0.06), paint);
  const cab = [[t.cf, t.hb], [t.rf, t.roof], [t.rr, t.roof], [t.cr, t.hb]];
  add(extrudeSide(cab, W - 0.22, 0.04), paint);
  // ventanas laterales (forma reducida de la cabina)
  const cx = (t.cf + t.rf + t.rr + t.cr) / 4, cy = (t.hb + t.roof) / 2;
  const inset = cab.map(([x, y]) => [cx + (x - cx) * 0.86, cy + (y - cy) * 0.78 + 0.02]);
  const sideGeo = new THREE.ShapeGeometry(shapeFrom(inset)); sideGeo.rotateY(-Math.PI / 2);
  for (const s of [-1, 1]) { const m = add(sideGeo, SH.glass, s * ((W - 0.22) / 2 + 0.05)); m.castShadow = false; }
  const ww = (W - 0.4) / 2;
  const nf = new THREE.Vector2(t.roof - t.hb, t.cf - t.rf).normalize(), nr = new THREE.Vector2(t.roof - t.hb, t.rr - t.cr).normalize();
  const fo = 0.05, ro = 0.05, lerpP = (a, b, k) => a + (b - a) * k;
  add(quad([-ww, t.hb + 0.05 + nf.y * fo * 0 + 0.02, t.cf - 0.03 + nf.x * 0], [ww, t.hb + 0.07, t.cf - 0.03], [ww, t.roof - 0.06, lerpP(t.cf, t.rf, 0.92)], [-ww, t.roof - 0.06, lerpP(t.cf, t.rf, 0.92)])
    .translate(0, nf.y ? fo * 0.6 : 0, fo * 0.6), SH.glass).castShadow = false;
  add(quad([ww, t.hb + 0.07, t.cr + 0.03], [-ww, t.hb + 0.07, t.cr + 0.03], [-ww, t.roof - 0.06, lerpP(t.cr, t.rr, 0.92)], [ww, t.roof - 0.06, lerpP(t.cr, t.rr, 0.92)])
    .translate(0, ro * 0.6, -ro * 0.6), SH.glass).castShadow = false;
  // parachoques, rejilla, luces, molduras
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  add(bx(W + 0.04, 0.22, 0.2), t.chrome ? SH.chrome : SH.trim, 0, t.base + 0.16, hl + 0.02);
  add(bx(W + 0.04, 0.22, 0.2), t.chrome ? SH.chrome : SH.trim, 0, t.base + 0.16, -hl - 0.02);
  add(bx(W * 0.42, 0.18, 0.05), SH.trim, 0, (t.base + t.hf) / 2 + 0.06, hl + 0.01);
  add(bx(W + 0.02, 0.1, L - 1.2), SH.trim, 0, t.base + 0.06, 0);
  for (const s of [-1, 1]) {
    add(bx(0.42, 0.14, 0.06), SH.head, s * (W / 2 - 0.3), (t.base + t.hf) / 2 + 0.08, hl + 0.005);
    add(bx(0.38, 0.13, 0.06), SH.tail, s * (W / 2 - 0.28), (t.base + t.ht) / 2 + 0.1, -hl - 0.005);
    add(bx(0.06, 0.1, 0.18), paint, s * (W / 2 + 0.06), t.hb + 0.12, t.cf - 0.1);
    add(bx(0.01, 0.03, 0.4), SH.chrome, s * (W / 2 + 0.005), (t.base + t.hb) / 2 + 0.12, 0.2);
  }
  add(bx(0.5, 0.14, 0.02), SH.white, 0, t.base + 0.38, -hl - 0.04);
  if (t.stripe) for (const sx of [-0.22, 0.22]) {
    const s = add(extrudeSide(bodyPts, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }), sx); s.scale.set(1, 1.003, 1.002); s.position.y = 0.002;
  }
  const parts = { group: g, body, paint, wheels: [], bar: null };
  if (t.police) {
    add(bx(W + 0.03, (t.hb - t.base) * 0.55, 2.2), SH.white, 0, (t.base + t.hb) / 2 + 0.02, -0.15);
    add(bx(1.2, 0.08, 0.32), SH.trim, 0, t.roof + 0.04, (t.rf + t.rr) / 2);
    const r = add(bx(0.5, 0.13, 0.28), SH.red, -0.3, t.roof + 0.14, (t.rf + t.rr) / 2), b = add(bx(0.5, 0.13, 0.28), SH.blue, 0.3, t.roof + 0.14, (t.rf + t.rr) / 2);
    parts.bar = [r, b];
  }
  if (t.taxi) add(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe08a, emissiveIntensity: 0.4 }), 0, t.roof + 0.11, (t.rf + t.rr) / 2);
  if (t.van) for (const s of [-1, 1]) add(bx(0.02, 0.6, 2.4), SH.glass, s * (W / 2 + 0.01), t.hb + 0.55, -0.9);
  const wg = wheelGeos(t.r, !!t.chrome), wb = L / 2 - 0.85;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const steer = new THREE.Group(); steer.position.set(sx * (W / 2 - 0.16), t.r, sz * wb);
    const spin = new THREE.Group(); steer.add(spin);
    const tire = new THREE.Mesh(wg.tire, SH.tire); tire.castShadow = true; spin.add(tire);
    spin.add(new THREE.Mesh(wg.rim, t.chrome ? SH.chrome : SH.rim));
    g.add(steer); parts.wheels.push({ steer, spin, front: sz > 0 });
  }
  return parts;
}
function seatPerson(car, person) {
  const t = car.t, s = 0.92;
  person.group.scale.setScalar(s * person.look.height);
  person.group.position.set(-0.38, t.roof - 0.14 - 1.86 * s * person.look.height, (t.rf + t.rr) / 2 + 0.1);
  poseSit(person); car.mesh.add(person.group);
}
