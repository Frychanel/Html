// Crea un único HTML autocontenido (para abrir en el móvil sin servidor).
// Uso: node tools/build-single.js salida.html
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="src/style.css">', '<style>\n' + rd('src/style.css') + '\n</style>');
for (const f of ['vendor/three.min.js', 'src/audio.js', 'src/post.js', 'vendor/three-extras.js', 'src/assets-data.js', 'src/loader.js'])
  html = html.replace(`<script src="${f}"></script>`, () => '<script>\n' + rd(f) + '\n</script>');
html = html.replace(/<script>\n\/\/ Carga la ciudad[\s\S]*?<\/script>/, () => '<script>\nwhenAssetsReady(function () {\n' + rd('src/world.js') + '\n' + rd('src/entities.js') + '\n' + rd('src/main.js') + '\n});\n</script>');
if (/src="(src|vendor)\//.test(html)) throw new Error('quedan scripts externos');
fs.writeFileSync(process.argv[2] || path.join(root, 'bahia-dorada.html'), html);
console.log('OK', (html.length / 1048576).toFixed(1), 'MB');
