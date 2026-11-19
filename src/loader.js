'use strict';
// Precarga las texturas fotográficas incrustadas (assets-data.js) antes de construir la ciudad.
window.PHOTO = {};
window.whenAssetsReady = function (cb) {
  const data = window.ASSET_DATA || {}, keys = Object.keys(data).filter(k => k !== 'sky');
  let n = keys.length, done = false;
  const finish = () => { if (!done) { done = true; cb(); } };
  if (!n) return finish();
  keys.forEach(k => { const im = new Image(); im.onload = im.onerror = () => { if (--n === 0) finish(); }; im.src = data[k]; PHOTO[k] = im; });
  setTimeout(finish, 15000);
};
