/* 瀹犵墿灏忓眿 Service Worker锛氱紦瀛樺叏閮ㄦ父鎴忔枃浠讹紝鏀寔绂荤嚎涓?娣诲姞鍒颁富灞忓箷"浣撻獙 */
'use strict';
var CACHE = 'pet-house-v26';
var ASSETS = [
  './preview.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/utils.js',
  './js/platform.js',
  './js/pets.js',
  './js/photo.js',
  './js/avatar.js',
  './js/render.js',
  './js/game.js',
  './js/rooms.js',
  './js/main.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  var path = url.pathname;
  // 缃戠粶浼樺厛锛氭案杩滄嬁绾夸笂鏈€鏂版枃浠讹紝绂荤嚎鏃跺洖钀藉埌缂撳瓨
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(path, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(path).then(function (hit) {
        if (hit) return hit;
        return caches.match('./preview.html');
      });
    })
  );
});
