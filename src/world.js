'use strict';
// Bahía Dorada — generación de la ciudad (geometría agrupada por material para rendimiento).
THREE.ColorManagement.legacyMode = false;

const CELL = 96, ROAD = 16, N = 12, HALF = N * CELL / 2, BLOCK = CELL - ROAD, BOUND = 690, SIDE = 37;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(2005);
const rr = (a, b) => a + (b - a) * rand();
const pick = a => a[Math.floor(rand() * a.length)];

const World = {
  colliders: [], grid: new Map(), blockType: [], specials: {}, trees: [], palms: [], lights: [],
  parkSpots: [], recordSpots: [], windowMats: [], glowMats: [], idleSpots: [], carts: [], tlNodes: new Set(), mapImg: null,
};

function nodePos(i, j) { return { x: -HALF + i * CELL, z: -HALF + j * CELL }; }
function blockCenter(i, j) { return { x: -HALF + i * CELL + CELL / 2, z: -HALF + j * CELL + CELL / 2 }; }
function cellIdx(v) { return Math.floor((v + HALF) / CELL); }
function inBlock(x, z) {
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
  const i = cellIdx(x), j = cellIdx(z), d = Math.max(Math.abs(i - 5.5), Math.abs(j - 5.5));
  if (d < 1.6) return 'Centro';
  if (x < -200 && z > 100) return 'Puerto Viejo';
  if (x < -200) return 'Barrio Mangle';
  if (z < -200) return 'Las Lomas';
  if (x > 200 && z > 0) return 'Villa Palmeras';
  if (z > 200) return 'San Telmo';
  return 'El Mercado';
}
function perimeterPoint(c, t) {
  const P = SIDE, s = ((t % (8 * P)) + 8 * P) % (8 * P), side = Math.floor(s / (2 * P)), u = s % (2 * P) - P;
  if (side === 0) return { x: c.x + u, z: c.z - P };
  if (side === 1) return { x: c.x + P, z: c.z + u };
  if (side === 2) return { x: c.x - u, z: c.z + P };
  return { x: c.x - P, z: c.z - u };
}
function edgePoint(i, j, dx) { const c = blockCenter(i, j); return { x: c.x + (dx || 6), z: c.z - SIDE }; }

// ---------- texturas ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
function noiseFill(g, w, h, base, amt, n, sz = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amt;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(Math.random() * w, Math.random() * h, sz, sz);
  }
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
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));

function facadeMaterial(kind, wall) {
  const lit = [], curt = [];
  for (let i = 0; i < 16; i++) { lit.push(Math.random() < 0.42); curt.push(Math.random() < 0.35 ? ['#c9b28a', '#8a6f5a', '#e2dccc', '#6b7f99', '#a05a5a', '#5a7a5a'][Math.floor(Math.random() * 6)] : null); }
  const S = 256;
  const draw = (g, em) => {
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); }
    else {
      noiseFill(g, S, S, wall, 0.09, 4000);
      if (kind === 'brick') {
        g.strokeStyle = 'rgba(50,20,10,0.35)'; g.lineWidth = 1;
        for (let y = 0; y < S; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 6 % 2) * 7; x < S; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 6); g.stroke(); } }
      }
      const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const k = r * 4 + c, x = c * 64, y = r * 64;
      if (kind === 'glass') {
        if (em) {
          if (lit[k]) { g.fillStyle = Math.random() < 0.5 ? '#ffe6b0' : '#d8e8ff'; g.globalAlpha = 0.55 + Math.random() * 0.45; g.fillRect(x + 2, y + 2, 60, 46); g.globalAlpha = 1; }
        } else {
          const gr = g.createLinearGradient(x, y, x + 30, y + 50);
          gr.addColorStop(0, '#b9d4e8'); gr.addColorStop(0.5, '#6f8fab'); gr.addColorStop(1, '#3d566e');
          g.fillStyle = gr; g.fillRect(x + 2, y + 2, 60, 46);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 48, 64, 16);
          g.fillStyle = '#2c3640'; g.fillRect(x + 31, y + 2, 2, 46);
        }
      } else {
        const wx = x + 13, wy = y + 12, ww = 38, wh = 36;
        if (em) {
          if (lit[k]) { g.fillStyle = Math.random() < 0.3 ? '#fff0c8' : '#ffc86a'; g.fillRect(wx, wy, ww, wh); if (curt[k]) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(wx, wy, 12, wh); g.fillRect(wx + ww - 12, wy, 12, wh); } }
        } else {
          g.fillStyle = kind === 'brick' ? '#e9e2d4' : 'rgba(0,0,0,0.35)'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          const gr = g.createLinearGradient(wx, wy, wx, wy + wh); gr.addColorStop(0, '#7f97ab'); gr.addColorStop(1, '#25313d');
          g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
          if (curt[k]) { g.fillStyle = curt[k]; g.fillRect(wx, wy, 11, wh); g.fillRect(wx + ww - 11, wy, 11, wh); }
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(wx + 2, wy + 2, 10, wh - 4);
          g.fillStyle = '#3a3a3a'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
          g.fillStyle = '#d8d4c8'; g.fillRect(wx - 4, wy + wh + 3, ww + 8, 4);
        }
      }
    }
  };
  const map = canvasTex(S, S, g => draw(g, false));
  const em = canvasTex(S, S, g => draw(g, true));
  const m = std({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: kind === 'glass' ? 0.12 : 0.88, metalness: kind === 'glass' ? 0.55 : 0 });
  World.windowMats.push(m);
  return m;
}
function shopMaterial(frame) {
  const items = []; for (let i = 0; i < 30; i++) items.push([Math.random() * 150 + 12, Math.random() * 60 + 70, Math.random() * 14 + 4, Math.random() * 16 + 6, `hsl(${Math.random() * 360},55%,55%)`]);
  const W = 256, H = 144;
  const draw = (g, em) => {
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffdca0'; g.fillRect(10, 36, 158, 102); g.fillStyle = '#8a7a60'; g.fillRect(184, 52, 54, 90); return; }
    noiseFill(g, W, H, frame, 0.08, 800);
    g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, W, 30);
    const gr = g.createLinearGradient(0, 36, 0, 140); gr.addColorStop(0, '#8aa6bc'); gr.addColorStop(0.45, '#45586a'); gr.addColorStop(1, '#2a2f36');
    g.fillStyle = gr; g.fillRect(10, 36, 158, 102);
    g.globalAlpha = 0.65; for (const [x, y, w, h, c] of items) { g.fillStyle = c; g.fillRect(x, y, w, h); } g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(10, 112, 158, 3); g.fillRect(10, 88, 158, 3);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(20, 36); g.lineTo(60, 36); g.lineTo(20, 110); g.fill();
    g.fillStyle = '#222a33'; g.fillRect(184, 52, 54, 92);
    g.fillStyle = 'rgba(160,190,210,0.5)'; g.fillRect(190, 58, 42, 50);
    g.fillStyle = '#c9c9c9'; g.fillRect(224, 96, 4, 10);
  };
  const m = std({ map: canvasTex(W, H, g => draw(g, false)), emissiveMap: canvasTex(W, H, g => draw(g, true)), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.1 });
  World.windowMats.push(m);
  return m;
}
function scaleBoxUV(g, w, h, d, tw, th) {
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    let su, sv;
    if (f < 2) { su = d / tw; sv = h / th; } else if (f < 4) { su = w / tw; sv = d / tw; } else { su = w / tw; sv = h / th; }
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  }
  uv.needsUpdate = true;
}

// ---------- agrupación de geometría ----------
const Batches = new Map();
function addToBatch(material, geo, matrix, filter, noShadow) {
  let b = Batches.get(material.uuid);
  if (!b) Batches.set(material.uuid, b = { material, pos: [], nor: [], uv: [], noShadow });
  const g = (geo.index ? geo.toNonIndexed() : geo.clone());
  if (matrix) g.applyMatrix4(matrix);
  const P = g.attributes.position.array, Nn = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null, n = g.attributes.position.count;
  for (let i = 0; i < n; i++) {
    if (filter && !filter(i)) continue;
    b.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); b.nor.push(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]);
    b.uv.push(U ? U[i * 2] : 0, U ? U[i * 2 + 1] : 0);
  }
  g.dispose();
}
function flushBatches(scene) {
  for (const b of Batches.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, b.material); m.castShadow = !b.noShadow; m.receiveShadow = true; scene.add(m);
  }
  Batches.clear();
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function mtx(x, y, z, ry = 0, rx = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, 0, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// ---------- construcción ----------
const SIGNS = [['FARMACIA SOL', '#0f7a3c', '#fff'], ['CAFÉ LUNA', '#3b2416', '#f4d9a8'], ['TIENDA 24H', '#c4302b', '#fff'], ['BAR EL FARO', '#12324f', '#f4d64e'],
  ['PANADERÍA ROSITA', '#f2d7a0', '#7a3a10'], ['LAVANDERÍA', '#e8f4ff', '#1f63b5'], ['ZAPATERÍA VELOZ', '#111', '#f4d64e'], ['BARBERÍA TITO', '#fff', '#c4302b'],
  ['MARISCOS LA OLA', '#1f7fb5', '#fff'], ['FERRETERÍA', '#f08a24', '#111'], ['PIZZA NONNA', '#1a6b2a', '#fff'], ['ÓPTICA CLARA', '#fff', '#222'],
  ['POLLO FELIZ', '#d4231c', '#fff5d0'], ['LIBRERÍA', '#5b2a6e', '#fff'], ['TACOS DON PEPE', '#f4d64e', '#a01010'], ['BANCO SOLAR', '#0f4b3a', '#fff']];

function buildWorld(scene) {
  // ---- materiales base
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#557f37', 0.22, 9000);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,140,60' : '50,80,30'},0.25)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 18 + 6, 0, 7); g.fill(); }
  });
  grassTex.repeat.set(160, 160);
  const grassMat = std({ map: grassTex, roughness: 1 });
  const sandTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#e0cb93', 0.16, 9000)); sandTex.repeat.set(14, 180);
  const asphaltDraw = (g, w, h) => {
    noiseFill(g, w, h, '#3a3b3e', 0.16, 9000);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, Math.random() * 30 + 8, Math.random() * 10 + 4, Math.random() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(15,15,15,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
  };
  const roadTex = canvasTex(512, 128, (g, w, h) => {
    asphaltDraw(g, w, h);
    g.fillStyle = '#d8b83e'; g.fillRect(0, 59, w, 3); g.fillRect(0, 66, w, 3);
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 6, w, 3); g.fillRect(0, h - 9, w, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 22, w, 12); g.fillRect(0, 94, w, 12);
  });
  const L = N * CELL + ROAD; roadTex.repeat.set(L / 64, 1);
  const roadMat = std({ map: roadTex, roughness: 0.85 });
  const interMat = std({ map: canvasTex(128, 128, asphaltDraw), roughness: 0.85 });
  const paveTex = canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#a19e95', 0.1, 4000);
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(60,50,40,${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 14 + 4, 0, 7); g.fill(); }
  });
  const paveMat = std({ map: paveTex, roughness: 0.95 });
  const curbMat = std({ color: 0x9c9a92 });
  const roofTex = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#3c3d40', 0.2, 4000));
  const roofMat = std({ map: roofTex });
  const darkMat = std({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.4 });
  const metalMat = std({ color: 0x8e9196, roughness: 0.45, metalness: 0.7 });
  const woodMat = std({ color: 0x6b4428, roughness: 0.8 });
  const hedgeMat = std({ color: 0x35662a, roughness: 1 });
  const whiteMat = std({ color: 0xeeeeea, roughness: 0.7 });

  const FM = {
    glassA: facadeMaterial('glass', '#55697d'), glassB: facadeMaterial('glass', '#3e4a55'), glassC: facadeMaterial('glass', '#6a7a6a'),
    brick: facadeMaterial('brick', '#8f4a36'), brick2: facadeMaterial('brick', '#6e3b30'),
    stucco: facadeMaterial('plain', '#d9c79c'), pink: facadeMaterial('plain', '#dfa3a7'), mint: facadeMaterial('plain', '#a6d3bf'),
    white: facadeMaterial('plain', '#e6e3d8'), sky: facadeMaterial('plain', '#9fbfd8'), sand: facadeMaterial('plain', '#c9a77a'),
  };
  const SHOPS = [shopMaterial('#6d6d70'), shopMaterial('#3c4a5a'), shopMaterial('#7a5a3a'), shopMaterial('#9a9a92')];
  const awnTex = (a, b) => canvasTex(64, 64, (g) => { for (let x = 0; x < 64; x += 16) { g.fillStyle = a; g.fillRect(x, 0, 8, 64); g.fillStyle = b; g.fillRect(x + 8, 0, 8, 64); } });
  const AWN = [['#c4302b', '#f2efe6'], ['#1f5fa8', '#f2efe6'], ['#2e7d32', '#f2efe6'], ['#f0a020', '#6a3410'], ['#333', '#777']].map(([a, b]) => std({ map: awnTex(a, b), roughness: 0.9, side: THREE.DoubleSide }));
  // atlas de letreros
  const signTex = canvasTex(512, 1024, (g) => {
    SIGNS.forEach(([t, bg, fg], k) => {
      g.fillStyle = bg; g.fillRect(0, k * 64, 512, 64);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 4; g.strokeRect(2, k * 64 + 2, 508, 60);
      g.fillStyle = fg; g.font = 'bold 40px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, 256, k * 64 + 33, 490);
    });
  }, false);
  const signMat = std({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
  World.signMat = signMat;
  const signGeo = (k, w, h) => {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (k + 1 - uv.getY(i)) / 16);
    return g;
  };

  // ---- suelo, arena, mar
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1460, 1700).rotateX(-Math.PI / 2), grassMat);
  grass.position.set(30, 0, 0); grass.receiveShadow = true; scene.add(grass);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(126, 1700).rotateX(-Math.PI / 2), std({ map: sandTex, roughness: 1 }));
  sand.position.set(-645, 0.012, 0); sand.receiveShadow = true; scene.add(sand);
  const seaTex = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, '#1d6a96', 0.12, 3000, 3); g.strokeStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 22, y); g.stroke(); } });
  seaTex.repeat.set(60, 60);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), std({ map: seaTex, roughness: 0.08, metalness: 0.35, color: 0xbfd8e8 }));
  sea.position.set(-2200, -0.3, 0); scene.add(sea); World.sea = sea; World.seaTex = seaTex;
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(5, 1700).rotateX(-Math.PI / 2), std({ color: 0xf2f6f8, transparent: true, opacity: 0.7 }));
  foam.position.set(-706, -0.02, 0); scene.add(foam); World.foam = foam;
  const hillMat = std({ color: 0x5e6b40, flatShading: true });
  for (let k = 0; k < 44; k++) {
    const a = rand() * Math.PI * 2; if (Math.cos(a) < -0.5) continue;
    const r = rr(560, 640) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) * 1.05, h = rr(70, 200);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rr(110, 200), h, 8), hillMat);
    m.position.set(Math.cos(a) * Math.max(r, 820), h / 2 - 5, Math.sin(a) * Math.max(r, 820)); scene.add(m);
  }

  // ---- calles
  const hGeo = new THREE.PlaneGeometry(L, ROAD).rotateX(-Math.PI / 2), vGeo = hGeo.clone().rotateY(Math.PI / 2);
  for (let k = 0; k <= N; k++) {
    const p = -HALF + k * CELL;
    const h = new THREE.Mesh(hGeo, roadMat); h.position.set(0, 0.02, p); h.receiveShadow = true; scene.add(h);
    const v = new THREE.Mesh(vGeo, roadMat); v.position.set(p, 0.025, 0); v.receiveShadow = true; scene.add(v);
  }
  const interGeo = new THREE.PlaneGeometry(ROAD, ROAD).rotateX(-Math.PI / 2);
  const crossTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 4; x < w; x += 12) g.fillRect(x, 0, 6, h); }, true);
  crossTex.encoding = THREE.LinearEncoding;
  const crossMat = std({ color: 0xe8e8e8, alphaMap: crossTex, transparent: true, roughness: 0.7 });
  const crossGeo = new THREE.PlaneGeometry(ROAD - 2, 3).rotateX(-Math.PI / 2);
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const n = nodePos(i, j);
    addToBatch(interMat, interGeo, mtx(n.x, 0.03, n.z), null, true);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2;
      addToBatch(crossMat, crossGeo, mtx(n.x + Math.sin(a) * (ROAD / 2 + 1.8), 0.035, n.z + Math.cos(a) * (ROAD / 2 + 1.8), a), null, true);
    }
  }

  // ---- utilidades de construcción
  function box(w, h, d, x, y, z, wall, roof, tile = [8, 12], ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d); scaleBoxUV(g, w, h, d, tile[0], tile[1]);
    const ng = g.toNonIndexed(); g.dispose(); const m = mtx(x, y, z, ry);
    if (roof === wall) addToBatch(wall, ng, m);
    else { addToBatch(wall, ng, m, i => i < 12 || i >= 24); addToBatch(roof, ng, m, i => i >= 12 && i < 24); }
    ng.dispose();
  }
  function rooftop(x, z, w, d, top) {
    if (top > 10 && rand() < 0.7) box(rr(3, 6), rr(1.5, 2.5), rr(3, 6), x + rr(-w / 4, w / 4), top + 1, z + rr(-d / 4, d / 4), metalMat, metalMat, [4, 4]);
    if (top > 8 && top < 40 && rand() < 0.3) {
      const tx = x + rr(-w / 4, w / 4), tz = z + rr(-d / 4, d / 4);
      addToBatch(woodMat, new THREE.CylinderGeometry(1.6, 1.6, 3, 10), mtx(tx, top + 3.5, tz));
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.2, 2, 0.2, tx + a, top + 1, tz + b, darkMat, darkMat);
    }
  }
  function shopDecor(x, z, w, d, yaw) {
    const side = Math.abs(Math.sin(yaw)) > 0.5, along = side ? d : w, off = side ? w / 2 : d / 2, sx = Math.sin(yaw), sz = Math.cos(yaw);
    const ag = new THREE.BoxGeometry(along * 0.86, 0.08, 1.7); const uv = ag.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * along / 2);
    addToBatch(pick(AWN), ag, mtx(x + sx * (off + 0.95), 0.3 + 3.55, z + sz * (off + 0.95), yaw, 0.3)); ag.dispose();
    addToBatch(signMat, signGeo(Math.floor(rand() * 16), Math.min(along * 0.7, 7.5), 0.85), mtx(x + sx * (off + 0.18), 0.3 + 4.05, z + sz * (off + 0.18), yaw), null, true);
  }
  function building(x, z, w, d, H, facade, shop, faces) {
    const base = 4.5;
    if (shop) box(w + 0.3, base, d + 0.3, x, 0.3 + base / 2, z, shop, roofMat, [8, 4.5]);
    const up = H - (shop ? base : 0);
    if (up > 0.5) box(w, up, d, x, 0.3 + H - up / 2, z, facade, roofMat);
    // cornisa
    box(w + 0.5, 0.4, d + 0.5, x, 0.3 + H, z, curbMat, curbMat, [4, 4]);
    addCollider(x - w / 2 - 0.2, z - d / 2 - 0.2, x + w / 2 + 0.2, z + d / 2 + 0.2, H + 0.5);
    if (shop && faces) for (const yaw of faces) shopDecor(x, z, w, d, yaw);
    rooftop(x, z, w, d, 0.3 + H + 0.2);
  }
  const roofGeo = new THREE.ConeGeometry(1, 1, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 0.5, 0);
  const ROOFS = [0x8f3a28, 0x5e4436, 0x3a4f6b, 0x726555, 0xa0522d, 0x404040].map(c => std({ color: c, roughness: 0.8, flatShading: true }));
  function house(x, z, w, d, h, wall, yaw, roofM) {
    box(w, h, d, x, 0.3 + h / 2, z, wall, roofMat);
    addToBatch(roofM || pick(ROOFS), roofGeo, mtx(x, 0.3 + h, z, 0, 0, (w / 2 + 0.7) / 0.707, rr(2.2, 3.6), (d / 2 + 0.7) / 0.707));
    const sx = Math.sin(yaw), sz = Math.cos(yaw), off = Math.abs(sx) > 0.5 ? w / 2 : d / 2;
    box(1.3, 2.3, 0.15, x + sx * (off + 0.05), 0.3 + 1.15, z + sz * (off + 0.05), woodMat, woodMat, [2, 2], yaw);
    box(2.2, 0.2, 1.4, x + sx * (off + 0.7), 0.3 + 2.6, z + sz * (off + 0.7), whiteMat, whiteMat, [2, 2], yaw);
    if (rand() < 0.6) box(0.8, 2, 0.8, x + rr(-w / 4, w / 4), 0.3 + h + 1.5, z + rr(-d / 4, d / 4), FM.brick, FM.brick, [8, 12]);
    addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h + 3);
  }
  const slabGeo = new THREE.BoxGeometry(BLOCK, 0.3, BLOCK); scaleBoxUV(slabGeo, BLOCK, 0.3, BLOCK, 8, 8);
  const slabNI = slabGeo.toNonIndexed();
  const parkGrassMat = std({ map: grassTex.clone(), roughness: 1 }); parkGrassMat.map.repeat.set(1, 1); parkGrassMat.map.needsUpdate = true;
  const parkGeo = new THREE.PlaneGeometry(BLOCK - 8, BLOCK - 8, 1, 1).rotateX(-Math.PI / 2);
  { const uv = parkGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 9); }
  const pathMat = std({ color: 0xc9bfa6, roughness: 1 });
  const benches = [], bins = [], hydrants = [];

  const HOUSE = [FM.stucco, FM.pink, FM.mint, FM.white, FM.sky, FM.sand];
  const MID = [FM.brick, FM.brick2, FM.stucco, FM.white, FM.pink, FM.sand, FM.glassC];
  const special = { '10,9': 'hideout', '3,6': 'hospital', '7,2': 'police', '5,6': 'plaza', '8,10': 'garage' };

  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const { x, z } = blockCenter(i, j);
    const d = Math.max(Math.abs(i - 5.5), Math.abs(j - 5.5));
    let type = d < 1.6 ? 'downtown' : d < 3.6 ? 'commercial' : 'residential';
    if (type !== 'downtown' && rand() < 0.08) type = 'park';
    type = special[i + ',' + j] || type;
    World.blockType[i * N + j] = type;
    addToBatch(paveMat, slabNI, mtx(x, 0.15, z), k => k >= 12 && k < 24);
    addToBatch(curbMat, slabNI, mtx(x, 0.15, z), k => k < 12 || k >= 24);
    // mobiliario urbano
    for (let k = 0; k < 3; k++) { const p = perimeterPoint({ x, z }, rand() * SIDE * 8); const o = { x: x + (p.x - x) * 1.045, z: z + (p.z - z) * 1.045 }; if (k === 0) hydrants.push(o); else bins.push(o); addCollider(o.x - 0.3, o.z - 0.3, o.x + 0.3, o.z + 0.3, 1); }

    if (type === 'park' || type === 'plaza') {
      addToBatch(type === 'plaza' ? paveMat : parkGrassMat, parkGeo, mtx(x, 0.305, z), null, true);
      if (type === 'park') { box(BLOCK - 10, 0.02, 3, x, 0.32, z, pathMat, pathMat, [4, 4]); box(3, 0.02, BLOCK - 10, x, 0.32, z, pathMat, pathMat, [4, 4]); }
      for (let k = 0; k < (type === 'plaza' ? 10 : 16); k++) {
        const tx = x + rr(-32, 32), tz = z + rr(-32, 32);
        if (Math.abs(tx - x) < 3 || Math.abs(tz - z) < 3) continue;
        if (type === 'plaza' && Math.hypot(tx - x, tz - z) < 18) continue;
        World.trees.push({ x: tx, z: tz, s: rr(0.8, 1.4) }); addCollider(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 5);
      }
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2 + 0.3, r = type === 'plaza' ? 15 : 9;
        benches.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, h: -a + Math.PI / 2 });
        World.idleSpots.push({ x: x + Math.cos(a) * (r - 1.2), z: z + Math.sin(a) * (r - 1.2), h: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'chat' });
      }
      if (type === 'plaza') {
        const stone = std({ color: 0xd8cfb8, roughness: 0.7 });
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 1, 32), stone); basin.position.set(x, 0.8, z); basin.castShadow = basin.receiveShadow = true; scene.add(basin);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.1, 32), std({ color: 0x3f8fc0, roughness: 0.05, metalness: 0.3 })); water.position.set(x, 1.25, z); scene.add(water);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 5, 12), stone); col.position.set(x, 3.5, z); col.castShadow = true; scene.add(col);
        const statue = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 64, 8), std({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 })); statue.position.set(x, 7.2, z); statue.castShadow = true; scene.add(statue);
        addCollider(x - 7.5, z - 7.5, x + 7.5, z + 7.5, 2);
        World.specials.plaza = { x, z };
        World.carts.push({ x: x + 13, z: z + 9, h: Math.PI });
        for (let k = 0; k < 10; k++) { const a = rand() * 6.28, r = rr(20, 30); World.idleSpots.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, h: rand() * 6.28, kind: 'chat', pair: true }); }
      }
    } else if (type === 'downtown') {
      const faces = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      if (rand() < 0.55) {
        const w = rr(44, 56), dd = rr(44, 56), H = rr(55, 130) * (1.35 - d * 0.22), fac = pick([FM.glassA, FM.glassB, FM.glassC]);
        building(x, z, w + 6, dd + 6, 9, FM.white, pick(SHOPS), faces);
        box(w, H - 9, dd, x, 0.3 + 9 + (H - 9) / 2, z, fac, roofMat);
        if (rand() < 0.6) { const ch = rr(6, 14); box(w * 0.6, ch, dd * 0.6, x, 0.3 + H + ch / 2, z, fac, roofMat); rooftop(x, z, w * 0.6, dd * 0.6, 0.3 + H + ch); }
        else rooftop(x, z, w, dd, 0.3 + H);
        addCollider(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, H + 20);
        if (H > 90) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 16, 6), metalMat); ant.position.set(x, H + 8, z); scene.add(ant); }
      } else {
        building(x - 16, z, 28, rr(48, 60), rr(40, 105), pick([FM.glassA, FM.glassB]), pick(SHOPS), [Math.PI / 2 * -1, 0, Math.PI]);
        building(x + 17, z + rr(-5, 5), 26, rr(32, 50), rr(25, 80), pick([FM.glassA, FM.white, FM.brick]), pick(SHOPS), [Math.PI / 2, 0, Math.PI]);
      }
    } else if (type === 'commercial') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const bx = x + sx * 17.5, bz = z + sz * 17.5;
        if (rand() < 0.12) { // aparcamiento
          for (let k = 0; k < 3; k++) box(0.15, 0.02, 5, bx - 6 + k * 6, 0.32, bz, whiteMat, whiteMat, [4, 4]);
          continue;
        }
        const w = rr(22, 31), dd = rr(22, 31), H = rr(9, 34);
        building(bx, bz, w, dd, H, pick(MID), pick(SHOPS), [sz > 0 ? 0 : Math.PI, sx > 0 ? Math.PI / 2 : -Math.PI / 2]);
        World.idleSpots.push({ x: bx + sx * 2, z: bz + sz * (dd / 2 + 3), h: sz > 0 ? Math.PI : 0, kind: 'chat', pair: rand() < 0.5 });
        if (H < 18 && rand() < 0.25) {
          const ad = SIGNS[Math.floor(rand() * 16)];
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), metalMat); pole.position.set(bx, 0.3 + H + 3, bz); scene.add(pole);
          const b = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), std({ map: textTexture(ad[0], 512, 192, ad[1], ad[2]), side: THREE.DoubleSide, roughness: 0.6 }));
          b.position.set(bx, 0.3 + H + 9, bz); b.rotation.y = sz > 0 ? 0 : Math.PI; b.castShadow = true; scene.add(b);
        }
      }
    } else if (type === 'residential' || type === 'hideout') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const bx = x + sx * 17 + rr(-2, 2), bz = z + sz * 16 + rr(-1, 1), yaw = sz > 0 ? 0 : Math.PI;
        const isHome = type === 'hideout' && sx === -1 && sz === -1;
        if (!isHome && rand() < 0.2) { const H = rr(10, 15); building(bx, bz, rr(20, 26), rr(18, 22), H, pick(MID), null); continue; }
        const w = rr(12, 17), dd = rr(10, 13), h = rr(4, 6.8);
        house(bx, bz, w, dd, h, isHome ? FM.mint : pick(HOUSE), yaw, isHome ? ROOFS[2] : null);
        // seto delantero con hueco
        const hz = bz + sz * (dd / 2 + 6);
        box((w + 4) / 2 - 1.5, 1, 0.8, bx - (w + 4) / 4 - 0.75, 0.8, hz, hedgeMat, hedgeMat, [2, 2]);
        box((w + 4) / 2 - 1.5, 1, 0.8, bx + (w + 4) / 4 + 0.75, 0.8, hz, hedgeMat, hedgeMat, [2, 2]);
        addCollider(bx - (w + 4) / 2, hz - 0.4, bx - 1.5, hz + 0.4, 1.3); addCollider(bx + 1.5, hz - 0.4, bx + (w + 4) / 2, hz + 0.4, 1.3);
        for (let k = 0; k < 2; k++) {
          const tx = bx + sx * rr(5, 8) * (k ? -1 : 1), tz = bz + sz * (dd / 2 + 3);
          if (Math.abs(tx - x) < 33 && Math.abs(tz - z) < 33) { World.trees.push({ x: tx, z: tz, s: rr(0.7, 1.1) }); addCollider(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 5); }
        }
      }
      if (type === 'hideout') {
        World.specials.hideout = { x: x - 17, z: z - 37, h: Math.PI };
        const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), std({ map: textTexture('CASA DE RAFA', 512, 123, '#2e7d32', '#fff'), roughness: 0.6 }));
        s.position.set(x - 17, 1.4, z - 37 + 1.2); s.rotation.y = Math.PI; scene.add(s);
      }
    } else if (type === 'hospital') {
      building(x, z + 4, 54, 36, 20, FM.white, null);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), std({ map: textTexture('HOSPITAL\nSANTA BRISA', 512, 128, '#ffffff', '#c41e1e'), emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.5 }));
      s.material.emissiveMap = s.material.map; s.position.set(x, 14, z - 14.25); s.rotation.y = Math.PI; scene.add(s);
      World.specials.hospital = { x, z: z - 37, h: Math.PI };
    } else if (type === 'police') {
      building(x, z + 6, 46, 30, 14, FM.glassB, null);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), std({ map: textTexture('POLICÍA', 512, 102, '#1b3a8a', '#fff'), roughness: 0.5 }));
      s.position.set(x, 11, z - 9.25); s.rotation.y = Math.PI; scene.add(s);
      World.specials.police = { x, z: z - 37, h: Math.PI };
    } else if (type === 'garage') {
      building(x + 14, z + 10, 36, 30, 9, FM.brick, null);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), std({ map: textTexture('TALLER CHISPA', 512, 102, '#111', '#f08a24'), roughness: 0.5 }));
      s.position.set(x + 14, 7, z - 5.25); s.rotation.y = Math.PI; scene.add(s);
    }
  }
  // puestos de comida extra
  for (const [i, j] of [[5, 5], [6, 4], [4, 7]]) { const c = blockCenter(i, j); World.carts.push({ x: c.x + 8, z: c.z - 38.2, h: 0 }); }
  World.carts.push({ x: -630, z: -40, h: Math.PI / 2 }, { x: -625, z: 260, h: Math.PI / 2 });

  // palmeras de avenida
  for (let k = 0; k <= N; k += 3) for (let t = 0; t < N; t++) {
    const n = nodePos(k, t);
    for (let s = 0; s < 3; s++) {
      const z = n.z + 20 + s * 28;
      for (const side of [-1, 1]) {
        const px = n.x + side * (ROAD / 2 + 2.2);
        if (inBlock(px, z) && !pointBlocked(px, 1, z)) { World.palms.push({ x: px, z, s: rr(0.85, 1.15) }); addCollider(px - 0.35, z - 0.35, px + 0.35, z + 0.35, 8); }
      }
    }
  }
  // playa
  for (let k = 0; k < 80; k++) { const px = rr(-695, -592), pz = rr(-680, 680); World.palms.push({ x: px, z: pz, s: rr(0.8, 1.3) }); addCollider(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 8); }
  const umb = [0xe33b3b, 0x3b7de3, 0xf4d64e, 0xffffff, 0x2bb673].map(c => std({ color: c, roughness: 0.8 }));
  const towelGeo = new THREE.PlaneGeometry(1, 2).rotateX(-Math.PI / 2);
  for (let k = 0; k < 30; k++) {
    const ux = rr(-690, -610), uz = rr(-620, 620);
    addToBatch(metalMat, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), mtx(ux, 1.3, uz));
    addToBatch(pick(umb), new THREE.ConeGeometry(1.9, 0.7, 10), mtx(ux, 2.7, uz));
    addToBatch(pick(umb), towelGeo, mtx(ux + 1.5, 0.03, uz, rand()), null, true);
    World.idleSpots.push({ x: ux + 1.5, z: uz + 1.5, h: rand() * 6.28, kind: 'beach', pair: rand() < 0.5 });
  }
  // torre de socorrista y muelle
  box(3, 2, 3, -660, 3.5, 0, whiteMat, std({ color: 0xc4302b }), [4, 4]);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.2, 2.5, 0.2, -660 + a * 1.3, 1.25, b * 1.3, woodMat, woodMat, [2, 2]);
  const plank = std({ map: canvasTex(64, 64, (g, w, h) => { noiseFill(g, w, h, '#7a5a3a', 0.15, 600); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1); }), roughness: 0.9 });
  box(70, 1, 8, -735, 0.3, 120, plank, plank, [4, 4]);
  for (let k = 0; k < 8; k++) addToBatch(woodMat, new THREE.CylinderGeometry(0.4, 0.4, 3, 8), mtx(-705 - k * 9, -0.7, 124));
  World.specials.dock = { x: -650, z: 120 };
  // anillo exterior
  for (let k = 0; k < 180; k++) {
    const x = rr(-580, 690), z = rr(-690, 690);
    if (Math.abs(x) < HALF + 12 && Math.abs(z) < HALF + 12) continue;
    World.trees.push({ x, z, s: rr(0.9, 1.7) }); addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 5);
  }
  // farolas
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const n = nodePos(i, j), lx = n.x + ROAD / 2 + 1.2, lz = n.z + ROAD / 2 + 1.2;
    if (!inBlock(lx, lz)) continue;
    World.lights.push({ x: lx, z: lz }); addCollider(lx - 0.2, lz - 0.2, lx + 0.2, lz + 0.2, 7);
  }
  // semáforos (zona céntrica)
  const tl = [];
  for (let i = 2; i <= N - 2; i++) for (let j = 2; j <= N - 2; j++) {
    World.tlNodes.add(i + ',' + j);
    const n = nodePos(i, j);
    for (let d = 0; d < 4; d++) {
      const f = DIRS[d], p = [-f[1], f[0]];
      const x = n.x - f[0] * (ROAD / 2 + 1.6) + p[0] * (ROAD / 2 + 1.3), z = n.z - f[1] * (ROAD / 2 + 1.6) + p[1] * (ROAD / 2 + 1.3);
      tl.push({ x, z, yaw: Math.atan2(-f[0], -f[1]), axis: d % 2 });
      addCollider(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 4);
    }
  }
  World.tl = tl;

  // paradas de bus
  const glassPanel = std({ color: 0xaaccdd, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
  for (let k = 0; k < 14; k++) {
    const i = 1 + Math.floor(rand() * (N - 2)), j = 1 + Math.floor(rand() * (N - 2)), c = blockCenter(i, j);
    const t = World.blockType[i * N + j]; if (t === 'park' || t === 'plaza') continue;
    const x = c.x + rr(-20, 20), z = c.z - 38.3;
    if (pointBlocked(x, 1, z) || pointBlocked(x + 2, 1, z) || pointBlocked(x - 2, 1, z)) continue;
    box(4, 0.12, 1.8, x, 0.3 + 2.6, z + 0.2, metalMat, metalMat, [4, 4]);
    for (const a of [-1.9, 1.9]) box(0.1, 2.6, 0.1, x + a, 0.3 + 1.3, z + 0.9, metalMat, metalMat, [2, 2]);
    addToBatch(glassPanel, new THREE.PlaneGeometry(4, 2.2), mtx(x, 0.3 + 1.5, z + 1.05), null, true);
    box(3, 0.1, 0.5, x, 0.3 + 0.5, z + 0.7, woodMat, woodMat, [2, 2]);
    addToBatch(signMat, signGeo(Math.floor(rand() * 16), 1.4, 2.2), mtx(x + 2.05, 0.3 + 1.5, z + 0.4, Math.PI / 2), null, true);
    addCollider(x - 2, z + 0.8, x + 2, z + 1.2, 2.8);
    World.idleSpots.push({ x: x - 1, z: z + 0.2, h: Math.PI, kind: 'wait' }, { x: x + 1, z: z + 0.2, h: Math.PI, kind: 'wait' });
  }

  flushBatches(scene);
  buildInstancedProps(scene, { benches, bins, hydrants, metalMat, woodMat, darkMat });

  // coches aparcados
  for (let k = 0; k < 80 && World.parkSpots.length < 40; k++) {
    const a = Math.floor(rand() * N), b = Math.floor(rand() * (N + 1)), side = rand() < 0.5 ? -1 : 1;
    let x, z, h;
    if (rand() < 0.5) { x = nodePos(a, 0).x + rr(24, 72); z = nodePos(0, b).z + side * 6.1; h = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { x = nodePos(b, 0).x + side * 6.1; z = nodePos(0, a).z + rr(24, 72); h = side > 0 ? Math.PI : 0; }
    if (World.parkSpots.some(p => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    World.parkSpots.push({ x, z, h });
  }
  // discos de oro
  for (let k = 0; World.recordSpots.length < 25 && k < 600; k++) {
    let x, z;
    if (k % 6 === 0) { x = rr(-690, -600); z = rr(-650, 650); }
    else {
      const i = Math.floor(rand() * N), j = Math.floor(rand() * N), c = blockCenter(i, j), p = perimeterPoint(c, rand() * SIDE * 8);
      x = p.x; z = p.z; if (rand() < 0.4) { x = c.x + rr(-34, 34); z = c.z + rr(-34, 34); }
    }
    if (pointBlocked(x, 1, z) || World.recordSpots.some(p => Math.hypot(p.x - x, p.z - z) < 60)) continue;
    World.recordSpots.push({ x, z });
  }
  const hb = blockCenter(10, 9);
  World.specials.homeCar = { x: hb.x - 6, z: hb.z - CELL / 2 + 6.1, h: Math.PI / 2 };
  World.specials.givers = [
    { id: 'paquete', letter: 'L', name: 'Tía Lupe', ...edgePoint(2, 9) },
    { id: 'carrera', letter: 'C', name: 'Chispa', ...edgePoint(8, 10, -10) },
    { id: 'calor', letter: 'P', name: 'El Profe', ...edgePoint(1, 3) },
  ];
  buildSky(scene);
  buildMapImage();
}

// ---------- props instanciados ----------
function frondGeometry(bend) {
  const pos = [];
  for (let l = 0; l < 9; l++) {
    const a = l / 9 * Math.PI * 2 + (l % 2) * 0.25, ca = Math.cos(a), sa = Math.sin(a), len = 3.4 + (l % 3) * 0.4;
    let prev = null;
    for (let s = 0; s <= 6; s++) {
      const t = s / 6, r = t * len, y = 7.9 + 0.7 * t - 2.4 * t * t, ww = 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08));
      const cx = bend + ca * r, cz = sa * r, px = -sa * ww, pz = ca * ww;
      const Lp = [cx + px, y + 0.06, cz + pz], Rp = [cx - px, y + 0.06, cz - pz], C = [cx, y, cz];
      if (prev) pos.push(...prev[0], ...prev[2], ...Lp, ...prev[2], ...C, ...Lp, ...prev[2], ...prev[1], ...C, ...prev[1], ...Rp, ...C);
      prev = [Lp, Rp, C];
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function buildInstancedProps(scene, o) {
  const dm = new THREE.Object3D(), col = new THREE.Color();
  const inst = (geo, mat, list, fn, colorFn, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, k) => { dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); fn(dm, p, k); dm.updateMatrix(); m.setMatrixAt(k, dm.matrix); if (colorFn) m.setColorAt(k, col.set(colorFn(p, k))); });
    m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
  };
  const place = (d, p, y) => { d.position.set(p.x, y ?? 0.3, p.z); d.rotation.set(0, (p.x * 13.1 + p.z * 7.7) % 6.28, 0); d.scale.setScalar(p.s || 1); };
  const T = World.trees, leafCols = [0x3f7a2e, 0x4c8a34, 0x356b28, 0x5a8f3a, 0x2f5f24];
  inst(new THREE.CylinderGeometry(0.22, 0.38, 3.2, 7).translate(0, 1.6, 0), std({ color: 0x5e4029 }), T, (d, p) => place(d, p));
  const leaf = std({ color: 0xffffff, flatShading: true, roughness: 0.9 });
  inst(new THREE.IcosahedronGeometry(2.2, 1).translate(0, 4.4, 0), leaf, T, (d, p) => place(d, p), (p, k) => leafCols[k % 5]);
  inst(new THREE.IcosahedronGeometry(1.5, 1).translate(1.1, 5.6, 0.4), leaf, T, (d, p) => place(d, p), (p, k) => leafCols[(k + 2) % 5]);
  inst(new THREE.IcosahedronGeometry(1.4, 1).translate(-1, 5.1, -0.7), leaf, T, (d, p) => place(d, p), (p, k) => leafCols[(k + 4) % 5]);
  const P = World.palms, trunk = new THREE.CylinderGeometry(0.15, 0.28, 8, 7, 8).translate(0, 4, 0), tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + 0.6 * (y / 8) * (y / 8)); }
  trunk.computeVertexNormals();
  inst(trunk, std({ color: 0x8a6c48 }), P, (d, p) => place(d, p, 0.05));
  inst(frondGeometry(0.6), std({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.85 }), P, (d, p) => place(d, p, 0.05), (p, k) => [0x4f8a2a, 0x5f9a32, 0x3f7a26][k % 3]);
  // farolas
  const Lt = World.lights, ry = Math.atan2(-1, -1);
  inst(new THREE.CylinderGeometry(0.09, 0.14, 7.5, 8).translate(0, 3.75, 0), o.darkMat, Lt, (d, p) => d.position.set(p.x, 0.3, p.z));
  inst(new THREE.BoxGeometry(0.1, 0.1, 2.4).translate(0, 7.4, 1.2), o.darkMat, Lt, (d, p) => { d.position.set(p.x, 0.3, p.z); d.rotation.y = ry; });
  const bulbMat = std({ color: 0xdddddd, emissive: 0xffd9a0, emissiveIntensity: 0 }); World.glowMats.push(bulbMat);
  inst(new THREE.BoxGeometry(0.5, 0.18, 0.9).translate(0, 7.3, 2.3), bulbMat, Lt, (d, p) => { d.position.set(p.x, 0.3, p.z); d.rotation.y = ry; }, null, false);
  // bancos, papeleras, hidrantes
  inst(new THREE.BoxGeometry(2.4, 0.12, 0.7).translate(0, 0.75, 0), o.woodMat, o.benches, (d, p) => { d.position.set(p.x, 0, p.z); d.rotation.y = p.h; });
  inst(new THREE.BoxGeometry(2.4, 0.6, 0.1).translate(0, 1.1, -0.35), o.woodMat, o.benches, (d, p) => { d.position.set(p.x, 0, p.z); d.rotation.y = p.h; });
  inst(new THREE.BoxGeometry(2.2, 0.7, 0.5).translate(0, 0.35, 0), o.darkMat, o.benches, (d, p) => { d.position.set(p.x, 0, p.z); d.rotation.y = p.h; d.scale.set(1, 1, 0.3); });
  inst(new THREE.CylinderGeometry(0.3, 0.26, 0.9, 10).translate(0, 0.75, 0), std({ color: 0x2f5a3a, roughness: 0.6, metalness: 0.3 }), o.bins, (d, p) => d.position.set(p.x, 0, p.z));
  inst(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8).translate(0, 0.65, 0), std({ color: 0xc8231c, roughness: 0.5 }), o.hydrants, (d, p) => d.position.set(p.x, 0, p.z));
  // semáforos
  const TL = World.tl;
  inst(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 6).translate(0, 2.3, 0), o.darkMat, TL, (d, p) => d.position.set(p.x, 0.3, p.z));
  inst(new THREE.BoxGeometry(0.42, 1.25, 0.32).translate(0, 4.3, 0.12), std({ color: 0x1d2b1f, roughness: 0.6 }), TL, (d, p) => { d.position.set(p.x, 0.3, p.z); d.rotation.y = p.yaw; });
  World.tlMats = [[], []];
  const lampGeo = new THREE.CircleGeometry(0.13, 10);
  const colors = [0xff2a1a, 0xffb000, 0x2aff6a];
  for (let axis = 0; axis < 2; axis++) for (let c = 0; c < 3; c++) {
    const list = TL.filter(t => t.axis === axis);
    const mat = new THREE.MeshBasicMaterial({ color: colors[c] });
    World.tlMats[axis].push(mat);
    inst(lampGeo, mat, list, (d, p) => { d.position.set(p.x + Math.sin(p.yaw) * 0.29, 0.3 + 4.7 - c * 0.38, p.z + Math.cos(p.yaw) * 0.29); d.rotation.y = p.yaw; }, null, false);
  }
}
// ciclo de semáforos: devuelve 'g','y','r' para el eje (0 = este-oeste, 1 = norte-sur)
function tlState(axis, t) {
  const c = t % 26, ns = c < 11 ? 'g' : c < 13 ? 'y' : 'r', ew = c < 13 ? 'r' : c < 24 ? 'g' : 'y';
  return axis === 0 ? ew : ns;
}

// ---------- cielo ----------
function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3b7fd0) }, horizon: { value: new THREE.Color(0xbfdcf2) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(0xffffff) }, ground: { value: new THREE.Color(0x6a7a5a) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir, sunColor, ground; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, ground, min(1.0, -h * 6.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat);
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  World.sky = sky; World.skyMat = mat;
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 18 + Math.random() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, false);
  World.clouds = [];
  const cm = new THREE.SpriteMaterial({ map: cloudTex, fog: false, transparent: true, depthWrite: false, opacity: 0.85 });
  World.cloudMat = cm;
  for (let k = 0; k < 34; k++) {
    const s = new THREE.Sprite(cm); const a = rand() * 6.28, r = rr(150, 520);
    s.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: rr(150, 230) }; s.scale.set(rr(120, 220), rr(45, 70), 1); s.renderOrder = -1;
    scene.add(s); World.clouds.push(s);
  }
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
