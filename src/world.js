'use strict';
// Generación de la ciudad original "Bahía Dorada": cuadrícula de calles, barrios, playa, parques.

const CELL = 96, ROAD = 16, N = 12, HALF = N * CELL / 2, BLOCK = CELL - ROAD, BOUND = 690, SIDE = 37;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(2005);
const rr = (a, b) => a + (b - a) * rand();
const pick = a => a[Math.floor(rand() * a.length)];

const World = {
  colliders: [], grid: new Map(), blockType: [], specials: {}, trees: [], palms: [], lights: [],
  parkSpots: [], recordSpots: [], windowMats: [], glowMats: [], mapImg: null,
};

function nodePos(i, j) { return { x: -HALF + i * CELL, z: -HALF + j * CELL }; }
function blockCenter(i, j) { return { x: -HALF + i * CELL + CELL / 2, z: -HALF + j * CELL + CELL / 2 }; }
function cellIdx(v) { return Math.floor((v + HALF) / CELL); }
function inBlock(x, z) { // ¿está sobre una acera/manzana?
  const i = cellIdx(x), j = cellIdx(z);
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const c = blockCenter(i, j);
  return Math.abs(x - c.x) < BLOCK / 2 && Math.abs(z - c.z) < BLOCK / 2;
}
function groundAt(x, z) { return inBlock(x, z) ? 0.3 : 0; }

function addCollider(minX, minZ, maxX, maxZ, h = 10) {
  const c = { minX, minZ, maxX, maxZ, h };
  World.colliders.push(c);
  for (let i = cellIdx(minX); i <= cellIdx(maxX); i++)
    for (let j = cellIdx(minZ); j <= cellIdx(maxZ); j++) {
      const k = i * 1000 + j; let a = World.grid.get(k);
      if (!a) World.grid.set(k, a = []); a.push(c);
    }
  return c;
}
function collidersNear(x, z) {
  const i = cellIdx(x), j = cellIdx(z), out = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const a = World.grid.get((i + di) * 1000 + j + dj); if (a) for (const c of a) out.push(c);
  }
  return out;
}
function pointBlocked(x, y, z) {
  for (const c of collidersNear(x, z)) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y < c.h) return true;
  return false;
}
// Empuja un círculo fuera de los edificios. Devuelve la normal del choque o null.
function pushOut(p, r) {
  let hit = null;
  for (const c of collidersNear(p.x, p.z)) {
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX)), cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; hit = { x: dx / d, z: dz / d }; }
    else {
      const l = p.x - c.minX, rt = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rt, t, b);
      if (m === l) { p.x = c.minX - r; hit = { x: -1, z: 0 }; } else if (m === rt) { p.x = c.maxX + r; hit = { x: 1, z: 0 }; }
      else if (m === t) { p.z = c.minZ - r; hit = { x: 0, z: -1 }; } else { p.z = c.maxZ + r; hit = { x: 0, z: 1 }; }
    }
  }
  if (p.x < -BOUND) { p.x = -BOUND; hit = { x: 1, z: 0 }; } if (p.x > BOUND) { p.x = BOUND; hit = { x: -1, z: 0 }; }
  if (p.z < -BOUND) { p.z = -BOUND; hit = { x: 0, z: 1 }; } if (p.z > BOUND) { p.z = BOUND; hit = { x: 0, z: -1 }; }
  return hit;
}

function zoneName(x, z) {
  if (x < -584) return 'Playa Coral';
  const i = cellIdx(x), j = cellIdx(z);
  const d = Math.max(Math.abs(i - 5.5), Math.abs(j - 5.5));
  if (d < 1.6) return 'Centro';
  if (x < -200 && z > 100) return 'Puerto Viejo';
  if (x < -200) return 'Barrio Mangle';
  if (z < -200) return 'Las Lomas';
  if (x > 200 && z > 0) return 'Villa Palmeras';
  if (z > 200) return 'San Telmo';
  return 'El Mercado';
}

// ---------- texturas ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function noiseFill(g, w, h, base, amt, n) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amt;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}
function windowMaterial(wall, glass, opts = {}) {
  const lit = []; for (let i = 0; i < 16; i++) lit.push(Math.random() < 0.45);
  const [x0, y0, x1, y1] = opts.big ? [2, 3, 30, 29] : [7, 8, 25, 27];
  const draw = (g, w, h, emissive) => {
    if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    else noiseFill(g, w, h, wall, 0.12, 900);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const L = lit[r * 4 + c];
      if (emissive) g.fillStyle = L ? (Math.random() < 0.3 ? '#ffe7b0' : '#ffcf6e') : '#000';
      else g.fillStyle = glass;
      g.fillRect(c * 32 + x0, r * 32 + y0, x1 - x0, y1 - y0);
      if (!emissive) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(c * 32 + x0, r * 32 + y0, (x1 - x0) * 0.35, y1 - y0); }
    }
    if (opts.bands && !emissive) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 32, w, 3); }
  };
  const map = canvasTex(128, 128, (g, w, h) => draw(g, w, h, false));
  const em = canvasTex(128, 128, (g, w, h) => draw(g, w, h, true));
  const m = new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0 });
  World.windowMats.push(m);
  return m;
}
function scaleBoxUV(g, w, h, d) {
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    let su, sv;
    if (f < 2) { su = d / 8; sv = h / 12; } else if (f < 4) { su = w / 8; sv = d / 8; } else { su = w / 8; sv = h / 12; }
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  }
  uv.needsUpdate = true;
}
function textTexture(text, w, h, bg, fg, font) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font || `bold ${Math.floor(h * 0.55)}px Impact, Arial Black, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h * 0.42, w * 0.94));
  }, false);
}

// ---------- construcción ----------
function buildWorld(scene) {
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
  const shadow = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

  // suelo
  const grassTex = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#5f8a3e', 0.25, 2500)); grassTex.repeat.set(120, 120);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1460, 1700).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: grassTex }));
  grass.position.set(30, 0, 0); grass.receiveShadow = true; scene.add(grass);
  const sandTex = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#e3cf94', 0.18, 2500)); sandTex.repeat.set(10, 130);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(126, 1700).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.position.set(-645, 0.012, 0); sand.receiveShadow = true; scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: 0x2a74b0, shininess: 90, specular: 0x88bbee }));
  sea.position.set(-2200, -0.3, 0); scene.add(sea);
  World.sea = sea;
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(6, 1700).rotateX(-Math.PI / 2), lam(0xe8f2f8));
  foam.position.set(-708, 0.0, 0); scene.add(foam);

  // montañas de fondo
  const hillMat = lam(0x5b6b3a, { flatShading: true });
  for (let k = 0; k < 40; k++) {
    const a = rand() * Math.PI * 2;
    if (Math.cos(a) < -0.5) continue; // hacia el mar no
    const r = rr(820, 1000), h = rr(90, 230);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rr(120, 220), h, 7), hillMat);
    m.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r); scene.add(m);
  }

  // carreteras
  const L = N * CELL + ROAD;
  const roadTex = canvasTex(256, 64, (g, w, h) => {
    noiseFill(g, w, h, '#3b3b3f', 0.18, 1800);
    g.fillStyle = '#d9c24a'; for (let x = 0; x < w; x += 64) g.fillRect(x + 10, 30, 34, 4);
    g.fillStyle = '#bdbdbd'; g.fillRect(0, 4, w, 2); g.fillRect(0, h - 6, w, 2);
  });
  roadTex.repeat.set(L / 32, 1);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const hGeo = new THREE.PlaneGeometry(L, ROAD).rotateX(-Math.PI / 2);
  const vGeo = hGeo.clone().rotateY(Math.PI / 2);
  for (let k = 0; k <= N; k++) {
    const p = -HALF + k * CELL;
    const h = new THREE.Mesh(hGeo, roadMat); h.position.set(0, 0.02, p); h.receiveShadow = true; scene.add(h);
    const v = new THREE.Mesh(vGeo, roadMat); v.position.set(p, 0.025, 0); v.receiveShadow = true; scene.add(v);
  }
  const interGeo = new THREE.PlaneGeometry(ROAD, ROAD).rotateX(-Math.PI / 2);
  const inter = new THREE.InstancedMesh(interGeo, lam(0x3d3d41), (N + 1) * (N + 1));
  const crossTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 4; x < w; x += 12) g.fillRect(x, 0, 6, h); });
  const crossMat = new THREE.MeshLambertMaterial({ color: 0xdddddd, alphaMap: crossTex, transparent: true });
  const crossGeo = new THREE.PlaneGeometry(ROAD - 2, 3).rotateX(-Math.PI / 2);
  const crossH = new THREE.InstancedMesh(crossGeo, crossMat, (N + 1) * (N + 1) * 4);
  const dm = new THREE.Object3D(); let ci = 0, ii = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const n = nodePos(i, j);
    dm.position.set(n.x, 0.03, n.z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); inter.setMatrixAt(ii++, dm.matrix);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2, ox = Math.sin(a) * (ROAD / 2 + 1.8), oz = Math.cos(a) * (ROAD / 2 + 1.8);
      dm.position.set(n.x + ox, 0.035, n.z + oz); dm.rotation.set(0, a, 0); dm.updateMatrix(); crossH.setMatrixAt(ci++, dm.matrix);
    }
  }
  inter.receiveShadow = true; scene.add(inter); scene.add(crossH);

  // materiales de edificios
  const WM = {
    office: windowMaterial('#56708c', '#9cc6e8', { big: true, bands: true }),
    office2: windowMaterial('#3e4b5a', '#7fb1d8', { big: true }),
    brick: windowMaterial('#8c4b38', '#2a3440'),
    stucco: windowMaterial('#d9c79c', '#3a4a5a'),
    pink: windowMaterial('#e3a3ac', '#33465a'),
    mint: windowMaterial('#9fd4bf', '#2f4252'),
    white: windowMaterial('#e6e4da', '#3a4d63', { bands: true }),
  };
  const roofMat = lam(0x55565a);
  const sideMat = canvasTex(64, 64, (g, w, h) => {
    noiseFill(g, w, h, '#a9a9a3', 0.12, 300); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  sideMat.repeat.set(20, 20);
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: sideMat });
  const curbMat = lam(0x9a9a94);
  const slabGeo = new THREE.BoxGeometry(BLOCK, 0.3, BLOCK);
  const parkGrass = new THREE.MeshLambertMaterial({ map: grassTex.clone() }); parkGrass.map.repeat.set(8, 8); parkGrass.map.needsUpdate = true;
  const parkGeo = new THREE.PlaneGeometry(BLOCK - 10, BLOCK - 10).rotateX(-Math.PI / 2);

  function building(x, z, w, d, h, mat, y0 = 0.3) {
    const g = new THREE.BoxGeometry(w, h, d); scaleBoxUV(g, w, h, d);
    const m = shadow(new THREE.Mesh(g, [mat, mat, roofMat, roofMat, mat, mat]));
    m.position.set(x, y0 + h / 2, z); scene.add(m);
    addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h + y0);
    // detalles del techo
    if (h > 14 && rand() < 0.7) {
      const ac = shadow(new THREE.Mesh(new THREE.BoxGeometry(rr(3, 6), rr(1.5, 3), rr(3, 6)), lam(0x8a8a8a)));
      ac.position.set(x + rr(-w / 4, w / 4), y0 + h + 1, z + rr(-d / 4, d / 4)); scene.add(ac);
    }
    if (h > 70) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 5), lam(0xcccccc));
      ant.position.set(x, y0 + h + 7, z); scene.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      tip.position.set(x, y0 + h + 14.3, z); scene.add(tip);
    }
    return m;
  }
  const roofGeo = new THREE.ConeGeometry(1, 1, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 0.5, 0);
  function house(x, z, w, d, h, wallMat, roofColor) {
    building(x, z, w, d, h, wallMat);
    const r = shadow(new THREE.Mesh(roofGeo, lam(roofColor, { flatShading: true })));
    r.scale.set((w / 2 + 0.6) / 0.707, rr(2.5, 4), (d / 2 + 0.6) / 0.707); r.position.set(x, 0.3 + h, z); scene.add(r);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), lam(0x5a3a22));
    door.position.set(x, 1.5, z + d / 2 + 0.05); scene.add(door);
  }
  function sign(text, x, y, z, w, h, rotY, bg, fg) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, 512, Math.round(512 * h / w), bg, fg), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = rotY || 0; scene.add(m); return m;
  }
  function billboard(x, z, y0, text, bg, fg) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6), lam(0x666666));
    pole.position.set(x, y0 + 3, z); scene.add(pole);
    const b = sign(text, x, y0 + 9, z, 16, 6, rand() < 0.5 ? 0 : Math.PI / 2, bg, fg);
    b.material.color.set(0xdddddd);
  }
  const ADS = [['POLLO FELIZ\nsabor de barrio', '#c4302b', '#fff5d0'], ['GASEOSA BURBU', '#1f63b5', '#fff'], ['ZAPATOS VELOZ', '#111', '#f4d64e'],
    ['PALMERA FM 104.5', '#f08a24', '#fff'], ['BANCO SOLAR', '#0f6b3a', '#fff'], ['TACOS DON PEPE', '#f4d64e', '#a01010'], ['HELADOS NIEVE', '#f2a6c8', '#3a1060']];

  const houseMats = [WM.stucco, WM.pink, WM.mint, WM.white];
  const roofColors = [0x9a3b2a, 0x6b4a3a, 0x3a4f6b, 0x7a6a5a, 0xa0522d];

  // asignación de barrios
  const special = { '10,9': 'hideout', '3,6': 'hospital', '7,2': 'police', '5,6': 'plaza', '8,10': 'garage' };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const { x, z } = blockCenter(i, j);
    const d = Math.max(Math.abs(i - 5.5), Math.abs(j - 5.5));
    let type = d < 1.6 ? 'downtown' : d < 3.6 ? 'commercial' : 'residential';
    if (type !== 'downtown' && rand() < 0.09) type = 'park';
    type = special[i + ',' + j] || type;
    World.blockType[i * N + j] = type;

    const slab = new THREE.Mesh(slabGeo, [curbMat, curbMat, sidewalkMat, curbMat, curbMat, curbMat]);
    slab.position.set(x, 0.15, z); slab.receiveShadow = true; scene.add(slab);

    if (type === 'park' || type === 'plaza') {
      const pg = new THREE.Mesh(parkGeo, parkGrass); pg.position.set(x, 0.31, z); pg.receiveShadow = true; scene.add(pg);
      for (let k = 0; k < (type === 'plaza' ? 8 : 14); k++) {
        const tx = x + rr(-30, 30), tz = z + rr(-30, 30);
        if (type === 'plaza' && Math.hypot(tx - x, tz - z) < 14) continue;
        World.trees.push({ x: tx, z: tz, s: rr(0.8, 1.4) }); addCollider(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 5);
      }
      if (type === 'plaza') {
        const basin = shadow(new THREE.Mesh(new THREE.CylinderGeometry(8, 8.5, 1, 20), lam(0xcfc6b0))); basin.position.set(x, 0.8, z); scene.add(basin);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 0.1, 20), new THREE.MeshPhongMaterial({ color: 0x4aa3d8, shininess: 100 }));
        water.position.set(x, 1.3, z); scene.add(water);
        const col = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 8), lam(0xe0d8c0))); col.position.set(x, 3.5, z); scene.add(col);
        const statue = shadow(new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), lam(0xd4a73a, { flatShading: true }))); statue.position.set(x, 7.2, z); scene.add(statue);
        addCollider(x - 7, z - 7, x + 7, z + 7, 2);
        World.specials.plaza = { x, z };
      } else {
        for (let k = 0; k < 3; k++) {
          const bx = x + rr(-25, 25), bz = z + rr(-25, 25);
          const bench = shadow(new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), lam(0x7a5230))); bench.position.set(bx, 0.6, bz); scene.add(bench);
        }
      }
    } else if (type === 'downtown') {
      if (rand() < 0.5) {
        const h = rr(55, 135) * (1.4 - d * 0.25);
        building(x, z, rr(44, 60), rr(44, 60), h, pick([WM.office, WM.office2, WM.white]));
      } else {
        building(x - 15, z, 28, rr(46, 60), rr(40, 110), pick([WM.office, WM.office2]));
        building(x + 16, z + rr(-6, 6), 26, rr(30, 50), rr(25, 80), pick([WM.office, WM.white, WM.brick]));
      }
    } else if (type === 'commercial') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (rand() < 0.15) continue; // solar / estacionamiento
        const w = rr(20, 30), dd = rr(20, 30), h = rr(8, 32);
        const bx = x + sx * 17.5, bz = z + sz * 17.5;
        building(bx, bz, w, dd, h, pick([WM.brick, WM.stucco, WM.white, WM.pink, WM.office2]));
        if (h < 18 && rand() < 0.3) { const ad = pick(ADS); billboard(bx, bz, 0.3 + h, ad[0], ad[1], ad[2]); }
      }
    } else if (type === 'residential' || type === 'hideout') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const w = rr(12, 17), dd = rr(10, 13), h = rr(4, 6.5);
        const bx = x + sx * 17 + rr(-2, 2), bz = z + sz * 17 + rr(-2, 2);
        const isHome = type === 'hideout' && sx === -1 && sz === -1;
        house(bx, bz, w, dd, h, isHome ? WM.mint : pick(houseMats), isHome ? 0x2e7d32 : pick(roofColors));
        for (let k = 0; k < 2; k++) {
          const tx = bx + rr(-6, 6), tz = bz + sz * (dd / 2 + 3.5);
          if (Math.abs(tx - x) < 33 && Math.abs(tz - z) < 33) { World.trees.push({ x: tx, z: tz, s: rr(0.7, 1.1) }); addCollider(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 5); }
        }
      }
      if (type === 'hideout') {
        World.specials.hideout = { x: x - 17, z: z - 37, h: Math.PI };
        sign('CASA DE RAFA', x - 17, 7, z - 37 + 1.5, 6, 1.4, 0, '#2e7d32', '#fff');
      }
    } else if (type === 'hospital') {
      building(x, z + 4, 54, 36, 20, WM.white);
      sign('HOSPITAL\nSANTA BRISA', x, 14, z - 14.2, 24, 6, 0, '#ffffff', '#c41e1e');
      const cross = sign('+', x, 23, z - 14.2, 6, 6, 0, '#c41e1e', '#fff');
      World.specials.hospital = { x, z: z - 37, h: Math.PI };
    } else if (type === 'police') {
      building(x, z + 6, 46, 30, 14, WM.office2);
      sign('POLICÍA', x, 11, z - 9.2, 20, 4, 0, '#1b3a8a', '#fff');
      World.specials.police = { x, z: z - 37, h: Math.PI };
    } else if (type === 'garage') {
      building(x + 14, z + 10, 36, 30, 9, WM.brick);
      sign('TALLER CHISPA', x + 14, 7, z - 5.2, 16, 3.2, 0, '#111', '#f08a24');
    }
  }

  // carteles en lotes vacíos y palmeras en avenidas
  for (let k = 0; k <= N; k += 3) for (let t = 0; t < N; t++) {
    const n = nodePos(k, t);
    for (let s = 0; s < 3; s++) {
      const z = n.z + 20 + s * 28;
      for (const side of [-1, 1]) {
        const px = n.x + side * (ROAD / 2 + 2.2);
        if (inBlock(px, z) && !pointBlocked(px, 1, z)) { World.palms.push({ x: px, z, s: rr(0.8, 1.15) }); addCollider(px - 0.35, z - 0.35, px + 0.35, z + 0.35, 8); }
      }
    }
  }
  // playa
  for (let k = 0; k < 70; k++) {
    const px = rr(-695, -592), pz = rr(-680, 680);
    World.palms.push({ x: px, z: pz, s: rr(0.8, 1.3) }); addCollider(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 8);
  }
  const umbMat = [lam(0xe33b3b), lam(0x3b7de3), lam(0xf4d64e), lam(0xffffff)];
  for (let k = 0; k < 24; k++) {
    const ux = rr(-690, -610), uz = rr(-600, 600);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), lam(0xdddddd)); pole.position.set(ux, 1.3, uz); scene.add(pole);
    const top = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 8), pick(umbMat))); top.position.set(ux, 2.7, uz); scene.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1, 2).rotateX(-Math.PI / 2), pick(umbMat)); towel.position.set(ux + 1.5, 0.03, uz); scene.add(towel);
  }
  // muelle
  const pier = shadow(new THREE.Mesh(new THREE.BoxGeometry(70, 1, 8), lam(0x7a5a3a)));
  pier.position.set(-735, 0.3, 120); scene.add(pier);
  for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), lam(0x5a4028)); p.position.set(-705 - k * 9, -0.7, 124); scene.add(p); }
  World.specials.dock = { x: -650, z: 120 };
  // anillo exterior: árboles
  for (let k = 0; k < 160; k++) {
    const x = rr(-580, 690), z = rr(-690, 690);
    if (Math.abs(x) < HALF + 12 && Math.abs(z) < HALF + 12) continue;
    World.trees.push({ x, z, s: rr(0.9, 1.6) }); addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 5);
  }

  // farolas
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const n = nodePos(i, j);
    const lx = n.x + ROAD / 2 + 1.2, lz = n.z + ROAD / 2 + 1.2;
    if (!inBlock(lx, lz)) continue;
    World.lights.push({ x: lx, z: lz }); addCollider(lx - 0.2, lz - 0.2, lx + 0.2, lz + 0.2, 7);
  }

  buildInstancedProps(scene);

  // coches aparcados
  for (let k = 0; k < 70 && World.parkSpots.length < 34; k++) {
    const a = Math.floor(rand() * N), b = Math.floor(rand() * (N + 1)), side = rand() < 0.5 ? -1 : 1;
    let x, z, h;
    if (rand() < 0.5) { x = nodePos(a, 0).x + rr(24, 72); z = nodePos(0, b).z + side * 6.1; h = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { x = nodePos(b, 0).x + side * 6.1; z = nodePos(0, a).z + rr(24, 72); h = side > 0 ? Math.PI : 0; }
    if (World.parkSpots.some(p => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    World.parkSpots.push({ x, z, h });
  }
  // discos de oro (coleccionables)
  for (let k = 0; World.recordSpots.length < 25 && k < 500; k++) {
    let x, z;
    if (k % 6 === 0) { x = rr(-690, -600); z = rr(-650, 650); }
    else {
      const i = Math.floor(rand() * N), j = Math.floor(rand() * N), c = blockCenter(i, j);
      const t = rand() * SIDE * 8; const p = perimeterPoint(c, t);
      x = p.x; z = p.z;
      if (rand() < 0.4) { x = c.x + rr(-34, 34); z = c.z + rr(-34, 34); }
    }
    if (pointBlocked(x, 1, z)) continue;
    if (World.recordSpots.some(p => Math.hypot(p.x - x, p.z - z) < 60)) continue;
    World.recordSpots.push({ x, z });
  }

  const hb = blockCenter(10, 9);
  World.specials.homeCar = { x: hb.x - 6, z: hb.z - CELL / 2 + 6.1, h: Math.PI / 2 };
  World.specials.givers = [
    { id: 'paquete', letter: 'L', name: 'Tía Lupe', ...edgePoint(2, 9) },
    { id: 'carrera', letter: 'C', name: 'Chispa', ...edgePoint(8, 10, 1) },
    { id: 'calor', letter: 'P', name: 'El Profe', ...edgePoint(1, 3) },
  ];
  buildMapImage();
}
function edgePoint(i, j, side) { const c = blockCenter(i, j); return side ? { x: c.x - 10, z: c.z - SIDE } : { x: c.x + 6, z: c.z - SIDE }; }
function perimeterPoint(c, t) {
  const P = SIDE, s = ((t % (8 * P)) + 8 * P) % (8 * P), side = Math.floor(s / (2 * P)), u = s % (2 * P) - P;
  if (side === 0) return { x: c.x + u, z: c.z - P };
  if (side === 1) return { x: c.x + P, z: c.z + u };
  if (side === 2) return { x: c.x - u, z: c.z + P };
  return { x: c.x - P, z: c.z - u };
}

function buildInstancedProps(scene) {
  const dm = new THREE.Object3D();
  const inst = (geo, mat, list, fn) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, k) => { fn(dm, p); dm.updateMatrix(); m.setMatrixAt(k, dm.matrix); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  const place = (o, p, y) => { o.position.set(p.x, y || 0.3, p.z); o.rotation.set(0, (p.x * 13.1 + p.z * 7.7) % 6.28, 0); o.scale.setScalar(p.s || 1); };
  const T = World.trees;
  inst(new THREE.CylinderGeometry(0.25, 0.4, 3, 6).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), T, (o, p) => place(o, p));
  inst(new THREE.IcosahedronGeometry(2.3, 0).translate(0, 4.3, 0), new THREE.MeshLambertMaterial({ color: 0x3f7a2e, flatShading: true }), T, (o, p) => place(o, p));
  const P = World.palms;
  inst(new THREE.CylinderGeometry(0.16, 0.3, 8, 6).translate(0, 4, 0), new THREE.MeshLambertMaterial({ color: 0x8a6a45 }), P, (o, p) => place(o, p, 0.05));
  const frond = new THREE.ConeGeometry(3.6, 1.6, 7, 1, true).translate(0, 7.6, 0);
  inst(frond, new THREE.MeshLambertMaterial({ color: 0x4f8a2a, flatShading: true, side: THREE.DoubleSide }), P, (o, p) => place(o, p, 0.05));
  const Lt = World.lights;
  inst(new THREE.CylinderGeometry(0.1, 0.15, 7, 5).translate(0, 3.5, 0), new THREE.MeshLambertMaterial({ color: 0x4a4a4a }), Lt, (o, p) => { o.position.set(p.x, 0.3, p.z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xffd27a, emissiveIntensity: 0 });
  World.glowMats.push(bulbMat);
  const bulbs = inst(new THREE.BoxGeometry(0.9, 0.3, 0.5).translate(0, 7.2, 0), bulbMat, Lt, (o, p) => { o.position.set(p.x, 0.3, p.z); });
  bulbs.castShadow = false;
}

function buildMapImage() {
  const MS = 0.5, S = 1400 * MS, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), X = x => (x + 700) * MS;
  g.fillStyle = '#2f6797'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#4b7b35'; g.fillRect(X(-700), 0, S, S);
  g.fillStyle = '#d9c48a'; g.fillRect(X(-700), 0, 116 * MS, S);
  g.fillStyle = '#7a7a7a';
  for (let k = 0; k <= N; k++) {
    const p = -HALF + k * CELL;
    g.fillRect(X(-HALF - 8), X(p - 8), (N * CELL + 16) * MS, 16 * MS);
    g.fillRect(X(p - 8), X(-HALF - 8), 16 * MS, (N * CELL + 16) * MS);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = blockCenter(i, j), t = World.blockType[i * N + j];
    g.fillStyle = (t === 'park' || t === 'plaza') ? '#5d9a45' : '#a3a39b';
    g.fillRect(X(b.x - 40), X(b.z - 40), 80 * MS, 80 * MS);
  }
  g.fillStyle = '#3c3f48';
  for (const c2 of World.colliders) if (c2.h > 3 && (c2.maxX - c2.minX) > 2)
    g.fillRect(X(c2.minX), X(c2.minZ), (c2.maxX - c2.minX) * MS, (c2.maxZ - c2.minZ) * MS);
  World.mapImg = c; World.mapScale = MS;
}
