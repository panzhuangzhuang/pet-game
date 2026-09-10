/* 宠物小屋 Service Worker：缓存全部游戏文件，支持离线与"添加到主屏幕"体验 */
'use strict';
var CACHE = 'pet-house-v3';
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
  // 网络优先：永远拿线上最新文件，离线时回落到缓存
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
