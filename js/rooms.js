/**
 * rooms.js — 房间管理器（最多 3 个房间）
 * 每个房间 = 一个独立的 Game 实例 + 独立存档：
 *   - 房间 1：pet_house_save_v1（兼容老存档）
 *   - 房间 2：pet_house_save_r2
 *   - 房间 3：pet_house_save_r3
 * 切换房间时自动保存旧房间、停止其渲染循环，再启动新房间。
 * 触摸事件统一在这里分发到当前房间，避免多实例重复绑定。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./platform.js'), require('./game.js'), require('./pets.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Rooms = factory(root.PG.Platform, root.PG.Game, root.PG.Pets);
  }
})(typeof self !== 'undefined' ? self : this, function (Platform, Game, Pets) {
  'use strict';

  var MAX_ROOMS = 3;

  function roomKey(i) {
    return (Game.roomKeys && Game.roomKeys[i]) || 'pet_house_save_v1';
  }

  function Rooms(platform, canvas) {
    this.P = platform;
    this.canvas = canvas;
    this.games = [null, null, null];
    this.current = -1;

    var q = platform.getQuery ? platform.getQuery() : null;
    this.demoOnly = !!(q && q.demo !== undefined);

    // 触摸统一分发到当前房间
    var self = this;
    platform.bindTouch(canvas, {
      start: function (x, y, id) { var g = self.currentGame(); if (g) g.onStart(x, y, id); },
      move: function (x, y, id) { var g = self.currentGame(); if (g) g.onMove(x, y, id); },
      end: function (x, y, id) { var g = self.currentGame(); if (g) g.onEnd(x, y, id); }
    });

    var first = this.demoOnly ? 0 : this.firstExisting();
    this.enter(first < 0 ? 0 : first);
  }

  Rooms.prototype.firstExisting = function () {
    for (var i = 0; i < MAX_ROOMS; i++) {
      if (this.P.getStorage(roomKey(i), null)) return i;
    }
    return -1;
  };

  Rooms.prototype.currentGame = function () {
    return this.games[this.current] || null;
  };

  // 进入指定房间：保存并停止旧房间，启动新房间（新房间首次进入会读存档，无存档则走选宠）
  Rooms.prototype.enter = function (i) {
    if (i < 0 || i >= MAX_ROOMS) i = 0;
    var old = this.currentGame();
    if (old) { old.save(); old.stop(); }
    var g = this.games[i];
    if (!g) {
      g = new Game(this.P, this.canvas, i);
      g.rooms = this;
      this.games[i] = g;
    }
    g.start();
    this.current = i;
    // 浏览器调试句柄跟随当前房间
    if (typeof window !== 'undefined' && window.__rooms === this) {
      window.__game = g;
    }
    return g;
  };

  // 房间面板信息：是否有存档、是否当前、宠物概览
  Rooms.prototype.roomInfo = function (i) {
    var g = this.games[i];
    var save = this.P.getStorage(roomKey(i), null);
    var summary = '';
    if (g) {
      summary = g.roomSummary();
    } else if (save && save.pets) {
      var cnt = {};
      save.pets.forEach(function (p) {
        if (p && p.alive !== false) {
          var l = Pets.speciesLabel(p.species);
          cnt[l] = (cnt[l] || 0) + 1;
        }
      });
      var keys = Object.keys(cnt);
      summary = keys.length ? keys.map(function (k) { return k + '×' + cnt[k]; }).join(' · ') : '空房间';
    }
    return {
      index: i,
      // 有可玩内容才算"已有房间"（重置后实例还在但 setupDone=false → 视为空）
      exists: !!save || !!(g && g.setupDone),
      isCurrent: this.current === i,
      summary: summary
    };
  };

  Rooms.roomKey = roomKey;
  Rooms.MAX_ROOMS = MAX_ROOMS;

  return Rooms;
});
