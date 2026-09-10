/**
 * main.js — 启动器（微信小游戏与浏览器共用）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./platform.js'), require('./game.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Main = factory(root.PG.Platform, root.PG.Game);
  }
})(typeof self !== 'undefined' ? self : this, function (Platform, Game) {
  'use strict';

  return function start() {
    var canvas = Platform.createCanvas();
    Platform._canvas = canvas;
    var game = new Game(Platform, canvas);
    game.start();
    // 浏览器环境暴露句柄，便于调试
    if (Platform.isBrowser && typeof window !== 'undefined') {
      window.__game = game;
    }
    return game;
  };
});
