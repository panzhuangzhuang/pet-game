/**
 * main.js — 启动器（微信小游戏与浏览器共用）
 * 通过房间管理器最多同时管理 3 个房间（每个房间独立存档、独立宠物）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./platform.js'), require('./rooms.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Main = factory(root.PG.Platform, root.PG.Rooms);
  }
})(typeof self !== 'undefined' ? self : this, function (Platform, Rooms) {
  'use strict';

  return function start() {
    var canvas = Platform.createCanvas();
    Platform._canvas = canvas;
    var rooms = new Rooms(Platform, canvas);
    // 浏览器环境暴露句柄，便于调试
    if (Platform.isBrowser && typeof window !== 'undefined') {
      window.__game = rooms.currentGame();
      window.__rooms = rooms;
    }
    return rooms;
  };
});
