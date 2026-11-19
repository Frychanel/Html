'use strict';
// Modelos low-poly originales: personas y vehículos.

const MAT = {};
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  return MAT[k] || (MAT[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})));
}
const SKINS = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x6b3e1f, 0xffdbac];
const SHIRTS = [0xd94040, 0x3a7bd5, 0xf2c14e, 0x58a55c, 0xffffff, 0x222222, 0x8e44ad, 0xe67e22, 0x16a085, 0xf06292];
const PANTS = [0x2c3e50, 0x34495e, 0x1a1a1a, 0x6d5d4b, 0x3b5998, 0x7f8c8d];

function makePerson(o = {}) {
  const g = new THREE.Group();
  const skin = mat(o.skin ?? SKINS[Math.floor(Math.random() * SKINS.length)]);
  const shirt = mat(o.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)]);
  const pants = mat(o.pants ?? PANTS[Math.floor(Math.random() * PANTS.length)]);
  const box = (w, h, d, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; return b; };
  const body = new THREE.Group(); g.add(body);
  const torso = box(0.62, 0.72, 0.34, shirt); torso.position.y = 1.27; body.add(torso);
  const head = box(0.36, 0.38, 0.36, skin); head.position.y = 1.85; body.add(head);
  const hair = box(0.38, 0.12, 0.38, mat(o.hair ?? 0x1b1209)); hair.position.y = 2.06; body.add(hair);
  if (o.cap) { const cap = box(0.4, 0.1, 0.5, mat(o.cap)); cap.position.set(0, 2.1, 0.06); body.add(cap); }
  if (o.vest) { const v = box(0.64, 0.4, 0.36, mat(o.vest)); v.position.y = 1.4; body.add(v); }
  const limb = (x, y, w, h, m, m2) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    const l = box(w, h, w, m); l.position.y = -h / 2; p.add(l);
    if (m2) { const e = box(w + 0.02, 0.18, w + 0.02, m2); e.position.y = -h + 0.06; p.add(e); }
    body.add(p); return p;
  };
  const legL = limb(-0.16, 0.92, 0.26, 0.92, pants, mat(0x222222));
  const legR = limb(0.16, 0.92, 0.26, 0.92, pants, mat(0x222222));
  const armL = limb(-0.42, 1.58, 0.2, 0.7, shirt, skin);
  const armR = limb(0.42, 1.58, 0.2, 0.7, shirt, skin);
  return { group: g, body, legL, legR, armL, armR };
}
function animatePerson(p, phase, amt) {
  const s = Math.sin(phase) * amt;
  p.legL.rotation.x = s; p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
  p.body.position.y = Math.abs(Math.cos(phase)) * amt * 0.06;
}

const CAR_TYPES = {
  brisa:    { name: 'Brisa',     len: 4.4, wid: 2.0, h: 0.75, cab: [1.8, 0.62, 2.2, -0.2], max: 36, acc: 13 },
  toro:     { name: 'Toro GT',   len: 4.8, wid: 2.1, h: 0.72, cab: [1.8, 0.52, 1.8, -0.6], max: 46, acc: 19, stripe: true },
  furgo:    { name: 'Furgo',     len: 5.2, wid: 2.2, h: 1.3,  cab: [2.1, 0.8, 3.7, -0.5], max: 29, acc: 10 },
  pelicano: { name: 'Pelícano',  len: 4.0, wid: 1.9, h: 0.7,  cab: [1.7, 0.6, 2.0, -0.1], max: 40, acc: 16 },
  bajito:   { name: 'Bajito',    len: 5.0, wid: 2.1, h: 0.6,  cab: [1.9, 0.55, 2.4, -0.4], max: 38, acc: 13, low: true },
  patrulla: { name: 'Patrulla',  len: 4.6, wid: 2.0, h: 0.78, cab: [1.8, 0.62, 2.2, -0.2], max: 44, acc: 18, police: true },
};
const CAR_COLORS = [0xb22222, 0x1e5aa8, 0xf0f0f0, 0x222222, 0x2e8b57, 0xd4a017, 0x8b4513, 0x6a5acd, 0x20b2aa, 0xc0c0c0, 0xff7f50, 0x7b1e3a];
const SH = {
  glass: new THREE.MeshPhongMaterial({ color: 0x1a2533, shininess: 120, specular: 0x99aabb }),
  tire: new THREE.MeshLambertMaterial({ color: 0x151515 }),
  hub: new THREE.MeshLambertMaterial({ color: 0xbbbbbb }),
  head: new THREE.MeshLambertMaterial({ color: 0xffffee, emissive: 0xfff2b0, emissiveIntensity: 0.3 }),
  tail: new THREE.MeshLambertMaterial({ color: 0x880000, emissive: 0xff1010, emissiveIntensity: 0.3 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff2020 }), blue: new THREE.MeshBasicMaterial({ color: 0x2050ff }),
  off: new THREE.MeshLambertMaterial({ color: 0x333333 }), chrome: new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 150 }),
  wreck: new THREE.MeshLambertMaterial({ color: 0x1c1c1c }),
};
World.glowMats.push(SH.head);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8).rotateZ(Math.PI / 2);

function makeCarMesh(typeKey, color) {
  const t = CAR_TYPES[typeKey], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  g.rotation.order = 'YXZ';
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x444444 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; body.add(o); return o; };
  const base = t.low ? 0.32 : 0.45;
  add(new THREE.BoxGeometry(t.wid, t.h, t.len), paint, 0, base + t.h / 2, 0);
  const [cw, ch, cl, cz] = t.cab;
  add(new THREE.BoxGeometry(cw, ch, cl), SH.glass, 0, base + t.h + ch / 2, cz);
  add(new THREE.BoxGeometry(cw + 0.04, 0.08, cl * 0.82), paint, 0, base + t.h + ch, cz);
  add(new THREE.BoxGeometry(t.wid + 0.06, 0.2, 0.25), SH.chrome, 0, base + 0.15, t.len / 2);
  add(new THREE.BoxGeometry(t.wid + 0.06, 0.2, 0.25), SH.chrome, 0, base + 0.15, -t.len / 2);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.45, 0.2, 0.06), SH.head, sx * (t.wid / 2 - 0.35), base + t.h * 0.62, t.len / 2 + 0.01);
    add(new THREE.BoxGeometry(0.45, 0.18, 0.06), SH.tail, sx * (t.wid / 2 - 0.35), base + t.h * 0.62, -t.len / 2 - 0.01);
  }
  if (t.stripe) for (const sx of [-0.25, 0.25]) add(new THREE.BoxGeometry(0.22, 0.02, t.len + 0.01), mat(0xffffff), sx, base + t.h + 0.005, 0);
  const parts = { group: g, body, paint, wheels: [], bar: null };
  if (t.police) {
    paint.color.set(0x111111);
    add(new THREE.BoxGeometry(t.wid + 0.02, t.h * 0.5, 2.0), mat(0xf5f5f5), 0, base + t.h * 0.6, -0.2);
    const r = add(new THREE.BoxGeometry(0.6, 0.18, 0.35), SH.red, -0.35, base + t.h + ch + 0.12, cz);
    const b = add(new THREE.BoxGeometry(0.6, 0.18, 0.35), SH.blue, 0.35, base + t.h + ch + 0.12, cz);
    parts.bar = [r, b];
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const steer = new THREE.Group(); steer.position.set(sx * (t.wid / 2 - 0.12), 0.42, sz * (t.len / 2 - 0.9));
    const spin = new THREE.Group(); steer.add(spin);
    const w = new THREE.Mesh(wheelGeo, SH.tire); w.castShadow = true; spin.add(w);
    spin.add(new THREE.Mesh(hubGeo, t.low ? SH.chrome : SH.hub));
    g.add(steer); parts.wheels.push({ steer, spin, front: sz > 0 });
  }
  return parts;
}
