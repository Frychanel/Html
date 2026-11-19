// Genera src/assets-data.js con las texturas de assets/textures incrustadas en base64,
// para que el juego funcione abriendo el HTML directamente (sin servidor).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'textures'), out = {};
for (const f of fs.readdirSync(dir).filter(f => /\.(jpg|hdr)$/.test(f)).sort())
  out[f.replace(/\.(jpg|hdr)$/, '')] = (f.endsWith('.hdr') ? 'data:application/octet-stream;base64,' : 'data:image/jpeg;base64,') + fs.readFileSync(path.join(dir, f)).toString('base64');
fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets-data.js'), '// Generado por tools/build-assets.js — no editar a mano.\nwindow.ASSET_DATA = ' + JSON.stringify(out) + ';\n');
console.log(Object.keys(out).length, 'archivos');
