/**
 * game.js — 主控制
 * 真实时间同步、宠物行为、喂食/喝水/休息/抚摸、死亡与墓碑、
 * 照片领养、自动存档、界面流转与触摸交互。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./utils.js'), require('./platform.js'), require('./pets.js'),
      require('./photo.js'), require('./render.js')
    );
  } else {
    root.PG = root.PG || {};
    root.PG.Game = factory(root.PG.Utils, root.PG.Platform, root.PG.Pets, root.PG.Photo, root.PG.Render);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils, Platform, Pets, Photo, Render) {
  'use strict';

  var W = Render.W, H = Render.H;
  var LAYOUT = Render.LAYOUT;
  var KEY = 'pet_house_save_v1';
  var MAX_PETS = 8;

  function inRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function Game(platform, canvas) {
    this.P = platform;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    var sys = platform.system();
    this.sys = sys;
    this.dpr = sys.dpr || 1;
    this.fitScale = Math.min(sys.width / W, sys.height / H);
    this.offX = (sys.width - W * this.fitScale) / 2;
    this.offY = (sys.height - H * this.fitScale) / 2;
    canvas.width = Math.round(sys.width * this.dpr);
    canvas.height = Math.round(sys.height * this.dpr);
    if (platform.isBrowser) {
      canvas.style.width = sys.width + 'px';
      canvas.style.height = sys.height + 'px';
    }

    // 演示 / 调试模式（浏览器 query: ?demo=1&day=73）
    var q = platform.getQuery();
    this.demo = null;
    if (q && q.demo !== undefined) {
      this.demo = {
        skipSetup: true,
        deadHours: q.day ? parseFloat(q.day) : 0,
        name1: q.name1 || '',
        name2: q.name2 || '',
        addpet: q.addpet !== undefined,
        petsN: q.pets ? parseInt(q.pets, 10) : 0,
        ageDays: q.age ? parseFloat(q.age) : 0,        // 模拟已养天数（体重/繁殖验证）
        g1: q.g1 || '',                                 // 第 1 只性别 m/f
        g2: q.g2 || '',                                 // 第 2 只性别 m/f
        g3: q.g3 || '',                                 // 第 3 只性别 m/f
        g4: q.g4 || '',                                 // 第 4 只性别 m/f
        litter: q.litter !== undefined,                 // 立即安排如厕（演示）
        bowlHr: q.bowlHr ? parseFloat(q.bowlHr) : 0     // 碗消耗时长（小时，默认 24 一天耗完）
      };
    }

    this.screen = 'setup';
    this.pets = [];
    this.selectedId = null;
    this.setupDone = false;
    this.lastSavedAt = Date.now();
    this.time = 0;          // 动画时间(ms)
    this.lastT = 0;
    this.hearts = [];
    this.zzzs = [];
    this.toast = null;
    this.modal = null;
    this.pendingDeathModal = null;
    this.pressedId = null;
    this.pressButton = null;
    this.pressX = 0;
    this.pressY = 0;
    this.dragPetId = null;
    this.dragChip = false;
    this.lastChipTap = null;
    this.chipScroll = 0;
    this.autoSaveAcc = 0;
    this.ball = { x: 0.62, z: 0.30, vx: 0, vz: 0, spin: 0 };
    this.nests = [];
    this.petCareAcc = {};   // id -> 上次抚摸时间(ms, this.time)
    this.zzAcc = {};        // id -> 睡眠 Z 字计时
    // 第四轮：碗存量（0=空，100=满）、猫砂盆、繁殖
    this.bowls = { food: 0, water: 0 };
    this.bubbles = [];      // 如厕泡泡（💧/💩）
    this.lastBreedCheck = 0;
    this.lastBreedAt = 0;   // 上次生仔时间戳（一年冷却）

    this.setup = {
      catName: '咪咪',
      dogName: '旺财',
      picked: { cat: true, dog: true },
      catBox: { x: 330, y: 395, w: 300, h: 64 },
      dogBox: { x: 330, y: 720, w: 300, h: 64 },
      startBtn: { x: 125, y: 1100, w: 500, h: 110 }
    };
    this.resetAddPet();
  }

  Game.prototype.resetAddPet = function () {
    this.addpet = {
      photo: null,
      name: '',
      species: 'cat',
      backBtn: { x: 20, y: 40, w: 130, h: 62 },
      photoArea: { x: 125, y: 175, w: 500, h: 400 },
      reselectBtn: { x: 480, y: 505, w: 130, h: 50 },
      nameBox: { x: 330, y: 820, w: 320, h: 64 },
      speciesBtns: [
        { value: 'cat', label: '小猫', x: 175, y: 990, w: 120, h: 62 },
        { value: 'dog', label: '小狗', x: 315, y: 990, w: 120, h: 62 },
        { value: 'custom', label: '其他', x: 455, y: 990, w: 120, h: 62 }
      ],
      confirmBtn: { x: 150, y: 1100, w: 450, h: 100 },
      quickCatBtn: { x: 150, y: 1218, w: 205, h: 58 },
      quickDogBtn: { x: 375, y: 1218, w: 205, h: 58 }
    };
  };

  // ---------------- 存档 ----------------
  Game.prototype.save = function () {
    var save = {
      v: 1,
      setupDone: this.setupDone,
      lastSavedAt: Date.now(),
      pets: this.pets.map(Pets.toJSON),
      bowls: this.bowls
    };
    this.P.setStorage(KEY, save);
  };

  Game.prototype.load = function () {
    var self = this;
    var save = this.P.getStorage(KEY, null);
    var now = Date.now();

    if (this.demo && this.demo.skipSetup) {
      this.setupDone = true;
      this.pets = [
        Pets.createBuiltIn('cat', this.demo.name1 || '咪咪'),
        Pets.createBuiltIn('dog', this.demo.name2 || '旺财')
      ];
      // 第四轮演示：碗初始为空；可指定性别 / 年龄 / 立即如厕
      this.bowls = { food: 0, water: 0 };
      if (this.demo.g1) this.pets[0].gender = this.demo.g1 === 'f' ? 'female' : 'male';
      if (this.demo.g2 && this.pets[1]) this.pets[1].gender = this.demo.g2 === 'f' ? 'female' : 'male';
      if (this.demo.ageDays > 0) {
        var ageMs = this.demo.ageDays * 86400000;
        this.pets.forEach(function (p) { p.createdAt = now - ageMs; });
      }      if (this.demo.deadHours > 0) {
        var h = this.demo.deadHours * 3600 * 1000;
        this.pets.forEach(function (p) {
          p.lastFedAt = now - h;
          p.lastWateredAt = now - h;
          p.hunger = Math.max(0, 100 - this.demo.deadHours / Pets.HUNGER_FULL_H * 100);
          p.thirst = Math.max(0, 100 - this.demo.deadHours / Pets.THIRST_FULL_H * 100);
          p.energy = Math.max(0, 100 - this.demo.deadHours / Pets.ENERGY_FULL_H * 100);
          Pets.checkDeath(p, now);
        }, this);
      }
      // 演示：额外宠物（验证状态卡滑动）
      if (this.demo.petsN > 2) {
        for (var k = 2; k < this.demo.petsN; k++) {
          var extra = Pets.createBuiltIn(k % 2 ? 'cat' : 'dog', (k % 2 ? '喵喵' : '汪汪') + (k + 1));
          if (this.demo.ageDays > 0) extra.createdAt = now - this.demo.ageDays * 86400000;
          var gk = k === 2 ? this.demo.g3 : (k === 3 ? this.demo.g4 : '');
          if (gk) extra.gender = gk === 'f' ? 'female' : 'male';
          this.pets.push(extra);
        }
      }
      // 演示：立即安排第一只宠物如厕（2 秒后）
      if (this.demo.litter) {
        this.pets.forEach(function (p, idx) { p.nextLitterAt = now + 2000 + idx * 6000; });
      }
      this.selectedId = this.pets[0] ? this.pets[0].id : null;
      this.screen = 'main';
      this.rebuildNests();
      if (this.demo.addpet) {
        // 演示：直接展示领养界面（合成一张示例照片）
        var cv = this.P.createOffscreenCanvas(160, 160);
        var cctx = cv.getContext('2d');
        var grd = cctx.createLinearGradient(0, 0, 160, 160);
        grd.addColorStop(0, '#ffb36b');
        grd.addColorStop(1, '#8a5fa8');
        cctx.fillStyle = grd;
        cctx.fillRect(0, 0, 160, 160);
        cctx.fillStyle = '#ffffff';
        cctx.beginPath();
        cctx.arc(80, 80, 42, 0, Math.PI * 2);
        cctx.fill();
        this.addpet.photo = {
          texture: cv,
          colors: { main: '#b98a5a', light: '#e2c49a', dark: '#8a6238', head: '#c9a06e' }
        };
        this.addpet.name = '照片伙伴';
        this.screen = 'addpet';
      }
      this.lastSavedAt = now;
      this.loadPhotoTextures();
      this.rebuildNests();
      return;
    }

    if (save && save.setupDone && save.pets) {
      this.setupDone = true;
      this.pets = save.pets.map(Pets.fromJSON);
      // 碗存量（旧存档无 bowls 字段 → 过渡给满碗）
      this.bowls = {
        food: (save.bowls && save.bowls.food != null) ? save.bowls.food : 100,
        water: (save.bowls && save.bowls.water != null) ? save.bowls.water : 100
      };
      // 离线时间流逝（游戏时间 = 真实时间；碗也会随离线时间消耗）
      var delta = Math.max(0, now - (save.lastSavedAt || now));
      var br = this.bowlRate();
      this.bowls.food = Math.max(0, this.bowls.food - delta * br);
      this.bowls.water = Math.max(0, this.bowls.water - delta * br);
      this.pets.forEach(function (p) {
        if (!p.alive) return;
        Pets.update(p, delta);
        if (Pets.checkDeath(p, now)) self.onPetDied(p);
      });
      this.lastSavedAt = now;
      this.screen = 'main';
      if (delta > 3600 * 1000) {
        this.toastMsg('你离开了 ' + Utils.fmtDuration(delta) + '，宠物们很想你');
      }
      this.loadPhotoTextures();
      this.rebuildNests();
    } else {
      this.setupDone = false;
      this.screen = 'setup';
      this.lastSavedAt = now;
    }
  };

  Game.prototype.loadPhotoTextures = function () {
    var self = this;
    this.pets.forEach(function (p) {
      if (p.avatar && p.avatar.type === 'photo' && !p.avatar.texture && p.avatar.dataURL) {
        (function (pet) {
          Photo.loadTexture(pet.avatar.dataURL, function (err, cv) {
            if (!err && cv) pet.avatar.texture = cv;
          });
        })(p);
      }
    });
  };

  // ---------------- 生命周期 ----------------
  Game.prototype.start = function () {
    var self = this;
    Render.setPetsAPI({ needs: Pets.needs, mood: Pets.mood, weightKg: Pets.weightKg, weightFactor: Pets.weightFactor });
    this.P.bindTouch(this.canvas, {
      start: function (x, y, id) { self.onStart(x, y, id); },
      move: function (x, y, id) { self.onMove(x, y, id); },
      end: function (x, y, id) { self.onEnd(x, y, id); }
    });
    this.P.onHide(function () { self.save(); });
    this.load();
    this.lastT = Date.now();
    var loop = function () {
      var now = Date.now();
      var dt = Math.min(Math.max(now - self.lastT, 0), 100);
      self.lastT = now;
      self.update(dt);
      self.render();
      self.P.raf(loop);
    };
    this.P.raf(loop);
  };

  // ---------------- 更新 ----------------
  Game.prototype.update = function (dt) {
    this.time += dt;
    this.flushPending();
    if (this.toast && Date.now() - this.toast.t0 > this.toast.dur) this.toast = null;
    this.hearts = this.hearts.filter(function (h) { return this.time - h.t0 < 1000; }.bind(this));
    this.zzzs = this.zzzs.filter(function (z) { return this.time - z.t0 < 1200; }.bind(this));
    this.bubbles = this.bubbles.filter(function (b) { return this.time - b.t0 < 1400; }.bind(this));

    if (this.screen === 'main') {
      this.updatePets(dt);
      // 碗存量随时间消耗：一天（24 小时）从满到空，第二天需再点碗添
      var br = this.bowlRate();
      if (this.bowls.food > 0) {
        var f0 = this.bowls.food;
        this.bowls.food = Math.max(0, f0 - dt * br);
        if (f0 > 0 && this.bowls.food <= 0) this.toastMsg('粮碗见底了，点一下粮碗添粮');
      }
      if (this.bowls.water > 0) {
        var w0 = this.bowls.water;
        this.bowls.water = Math.max(0, w0 - dt * br);
        if (w0 > 0 && this.bowls.water <= 0) this.toastMsg('水碗见底了，点一下水碗添水');
      }
      // 繁殖检查（约 30 秒一次；一年冷却）
      var now2 = Date.now();
      if (now2 - this.lastBreedCheck > 30000) {
        this.lastBreedCheck = now2;
        var pair = this.checkBreeding(now2);
        if (pair) this.doBreed(pair, now2);
      }
      // 足球滚动物理
      var b = this.ball;
      if (b) {
        b.x += b.vx * dt / 1000;
        b.z += b.vz * dt / 1000;
        var damp = Math.pow(0.35, dt / 1000);
        b.vx *= damp;
        b.vz *= damp;
        b.spin = (b.spin || 0) + (Math.abs(b.vx) + Math.abs(b.vz)) * dt / 1000 * 6;
        if (Math.abs(b.vx) < 0.002) b.vx = 0;
        if (Math.abs(b.vz) < 0.002) b.vz = 0;
        if (b.x < 0.12) { b.x = 0.12; b.vx = -b.vx * 0.5; }
        if (b.x > 0.88) { b.x = 0.88; b.vx = -b.vx * 0.5; }
        if (b.z < 0.12) { b.z = 0.12; b.vz = -b.vz * 0.5; }
        if (b.z > 0.82) { b.z = 0.82; b.vz = -b.vz * 0.5; }
      }
      this.autoSaveAcc += dt;
      if (this.autoSaveAcc > 10000) { this.autoSaveAcc = 0; this.save(); }
    }
  };

  // 碗存量消耗速率：默认一天（24 小时）从满到空；演示可用 bowlHr 加速
  Game.prototype.bowlRate = function () {
    var hrs = (this.demo && this.demo.bowlHr) ? this.demo.bowlHr : 24;
    return 100 / (hrs * 3600 * 1000);
  };

  Game.prototype.updatePets = function (dt) {
    var self = this;
    var now = Date.now();
    this.pets.forEach(function (pet) {
      if (!pet.alive) return;
      Pets.update(pet, dt);
      var beh = pet.beh;

      // 如厕（一天约 3 次）：到点就放下手头的事去猫砂盆
      if (now >= (pet.nextLitterAt || 0) && beh.pending !== 'litter' &&
          beh.state !== 'litter' && beh.state !== 'eat' && beh.state !== 'drink' && beh.state !== 'dead') {
        beh.state = 'walk';
        beh.tx = LAYOUT.litter.fx;
        beh.tz = LAYOUT.litter.fz;
        beh.pending = 'litter';
        beh.wander = false;
        beh.chaseId = null;
        beh.fleeFrom = null;
        beh.manual = false;
      }

      // 睡觉恢复精力（手动休息 / 精力低自动入睡都恢复）
      if (beh.state === 'sleep') {
        pet.energy = Math.min(100, pet.energy + dt / 1000 * 15);
        self.zzAcc[pet.id] = (self.zzAcc[pet.id] || 0) + dt;
        if (self.zzAcc[pet.id] > 1100) {
          self.zzAcc[pet.id] = 0;
          self.spawnZzz(pet);
        }
      }

      switch (beh.state) {
        case 'walk': {
          if (beh.wander) beh.t -= dt / 1000;
          var dx = beh.tx - pet.x, dz = beh.tz - pet.z;
          var dist = Math.sqrt(dx * dx + dz * dz);
          var step = 0.12 * dt / 1000;
          if (dist <= step || dist === 0) {
            pet.x = beh.tx;
            pet.z = beh.tz;
            if (beh.pending === 'eat') { beh.state = 'eat'; beh.t = 2.4; beh.pending = null; }
            else if (beh.pending === 'drink') { beh.state = 'drink'; beh.t = 1.9; beh.pending = null; }
            else if (beh.pending === 'litter') { beh.state = 'litter'; beh.t = Utils.rand(4, 6); beh.pending = null; }
            else if (beh.pending === 'restNest' || beh.pending === 'restFloor') {
              beh.state = 'rest';
              beh.restMode = beh.pending === 'restNest' ? 'nest' : 'floor';
              beh.t = Utils.rand(40, 60);
              beh.pending = null;
            }
            else if (beh.wander && beh.t > 0) {
              // 继续散步到下一个随机点
              beh.tx = Utils.rand(0.12, 0.88);
              beh.tz = Utils.rand(0.12, 0.85);
            }
            else { beh.state = 'idle'; beh.t = Utils.rand(1.5, 4); }
          } else {
            pet.x += dx / dist * step;
            pet.z += dz / dist * step;
            if (Math.abs(dx) > 0.01) pet.facing = dx > 0 ? 1 : -1;
          }
          break;
        }
        case 'eat': {
          beh.t -= dt / 1000;
          if (beh.t <= 0) {
            Pets.feed(pet, now);
            self.bowls.food = Math.max(0, self.bowls.food - 15);
            if (self.bowls.food <= 0) self.toastMsg('粮碗见底了，点一下粮碗添粮');
            beh.state = 'idle'; beh.t = Utils.rand(1, 2);
            self.burstHearts(pet, 3, '#ff9d4d');
            self.toastMsg(pet.name + ' 吃饱啦，真开心！');
          }
          break;
        }
        case 'drink': {
          beh.t -= dt / 1000;
          if (beh.t <= 0) {
            Pets.water(pet, now);
            self.bowls.water = Math.max(0, self.bowls.water - 12);
            if (self.bowls.water <= 0) self.toastMsg('水碗见底了，点一下水碗添水');
            beh.state = 'idle'; beh.t = Utils.rand(1, 2);
            self.burstHearts(pet, 3, '#4aa8e0');
            self.toastMsg(pet.name + ' 喝饱啦！');
          }
          break;
        }
        case 'sleep': {
          beh.t -= dt / 1000;
          if (beh.t <= 0) {
            beh.state = 'idle'; beh.t = Utils.rand(1, 3);
            if (beh.manual) self.toastMsg(pet.name + ' 睡醒了，精神满满');
            beh.manual = false;
          }
          break;
        }
        case 'rest': {
          // 趴着休息：缓慢恢复精力
          beh.t -= dt / 1000;
          pet.energy = Math.min(100, pet.energy + dt / 1000 * 3);
          if (beh.t <= 0) { beh.state = 'idle'; beh.t = Utils.rand(1, 3); }
          break;
        }
        case 'litter': {
          // 猫砂盆如厕：尿尿扣渴度、拉屎扣饱食度，各 -10%
          beh.t -= dt / 1000;
          if (beh.t <= 0) {
            if (Math.random() < 0.5) {
              Pets.pee(pet);
              self.spawnBubble(pet, '💧');
              self.toastMsg(pet.name + ' 去猫砂盆尿尿啦（渴度 -10%）', 1600);
            } else {
              Pets.poop(pet);
              self.spawnBubble(pet, '💩');
              self.toastMsg(pet.name + ' 去猫砂盆拉臭臭啦（饱食度 -10%）', 1600);
            }
            pet.nextLitterAt = now + Utils.rand(6, 10) * 3600 * 1000;
            beh.state = 'idle'; beh.t = Utils.rand(1, 3);
          }
          break;
        }
        case 'playBall': {
          // 追着足球踢
          beh.t -= dt / 1000;
          if (beh.t <= 0) { beh.state = 'idle'; beh.t = Utils.rand(1, 3); break; }
          var bdx = self.ball.x - pet.x, bdz = self.ball.z - pet.z;
          var bd = Math.sqrt(bdx * bdx + bdz * bdz);
          var bstep = 0.24 * dt / 1000;
          if (bd <= bstep || bd === 0) {
            pet.x = self.ball.x; pet.z = self.ball.z;
            self.kickBall(Utils.rand(0, Math.PI * 2), Utils.rand(0.22, 0.4));
            if (Math.random() < 0.5) self.burstHearts(pet, 1, '#8bc34a');
          } else {
            pet.x += bdx / bd * bstep;
            pet.z += bdz / bd * bstep;
            if (Math.abs(bdx) > 0.01) pet.facing = bdx > 0 ? 1 : -1;
          }
          break;
        }
        case 'zoomies': {
          // 跑酷：快速随机折返
          beh.t -= dt / 1000;
          if (beh.t <= 0) { beh.state = 'idle'; beh.t = Utils.rand(1, 3); break; }
          var zdx = beh.tx - pet.x, zdz = beh.tz - pet.z;
          var zd = Math.sqrt(zdx * zdx + zdz * zdz);
          var zstep = 0.34 * dt / 1000;
          if (zd <= zstep) {
            pet.x = beh.tx; pet.z = beh.tz;
            beh.tx = Utils.rand(0.12, 0.88);
            beh.tz = Utils.rand(0.12, 0.85);
            if (Math.random() < 0.3) self.burstHearts(pet, 1, '#ffd34d');
          } else {
            pet.x += zdx / zd * zstep;
            pet.z += zdz / zd * zstep;
            if (Math.abs(zdx) > 0.01) pet.facing = zdx > 0 ? 1 : -1;
          }
          break;
        }
        case 'chase': {
          // 追逐打闹：追另一只宠物，对方会逃跑
          beh.t -= dt / 1000;
          var ct = self.petById(beh.chaseId);
          if (!ct || !ct.alive || beh.t <= 0) {
            beh.state = 'idle'; beh.t = Utils.rand(1, 3);
            beh.chaseId = null; beh.pending = null; beh.wander = false;
            break;
          }
          var cdx = ct.x - pet.x, cdz = ct.z - pet.z;
          var cd = Math.sqrt(cdx * cdx + cdz * cdz);
          var cstep = 0.30 * dt / 1000;
          if (cd < 0.16) {
            // 追上了：打闹一下，并让空闲的对方逃跑
            if (Math.random() < 0.12 * dt / 100) {
              if (ct.beh.state === 'idle' || ct.beh.state === 'rest') {
                ct.beh.state = 'flee';
                ct.beh.fleeFrom = pet.id;
                ct.beh.t = Utils.rand(5, 10);
                ct.beh.pending = null;
                ct.beh.wander = false;
              }
              self.burstHearts(pet, 2, '#ffb35c');
            }
            // 稍微绕开，避免叠在一起
            var away = cd === 0 ? Utils.rand(0, Math.PI * 2) : Math.atan2(cdz, cdx);
            pet.x += Math.cos(away + 1.2) * cstep;
            pet.z += Math.sin(away + 1.2) * cstep;
          } else {
            pet.x += cdx / cd * cstep;
            pet.z += cdz / cd * cstep;
            if (Math.abs(cdx) > 0.01) pet.facing = cdx > 0 ? 1 : -1;
          }
          break;
        }
        case 'flee': {
          // 被追着跑：远离追来的宠物
          beh.t -= dt / 1000;
          var fa = self.petById(beh.fleeFrom);
          if (!fa || !fa.alive || beh.t <= 0) {
            beh.state = 'idle'; beh.t = Utils.rand(1, 3);
            beh.fleeFrom = null; beh.pending = null;
            break;
          }
          var fdx = pet.x - fa.x, fdz = pet.z - fa.z;
          var fd = Math.sqrt(fdx * fdx + fdz * fdz);
          var fstep = 0.30 * dt / 1000;
          if (fd < 0.02) { beh.tx = Utils.rand(0.12, 0.88); beh.tz = Utils.rand(0.12, 0.85); }
          else {
            beh.tx = Utils.clamp(pet.x + fdx / fd * 0.5, 0.12, 0.88);
            beh.tz = Utils.clamp(pet.z + fdz / fd * 0.5, 0.12, 0.85);
          }
          var fx2 = beh.tx - pet.x, fz2 = beh.tz - pet.z;
          var fd2 = Math.sqrt(fx2 * fx2 + fz2 * fz2);
          if (fd2 <= fstep) {
            pet.x = beh.tx; pet.z = beh.tz;
            if (Math.random() < 0.2) { beh.tx = Utils.rand(0.12, 0.88); beh.tz = Utils.rand(0.12, 0.85); }
          } else {
            pet.x += fx2 / fd2 * fstep;
            pet.z += fz2 / fd2 * fstep;
            if (Math.abs(fx2) > 0.01) pet.facing = fx2 > 0 ? 1 : -1;
          }
          break;
        }
        case 'happy': {
          beh.t -= dt / 1000;
          if (beh.t <= 0) { beh.state = 'idle'; beh.t = Utils.rand(1, 3); }
          break;
        }
        case 'sad': {
          beh.t -= dt / 1000;
          if (beh.t <= 0) { beh.state = 'idle'; beh.t = Utils.rand(1, 3); }
          break;
        }
        default: {
          beh.t -= dt / 1000;
          if (beh.t <= 0) self.chooseBehavior(pet);
        }
      }

      // 死亡判定
      if (Pets.checkDeath(pet, now)) {
        self.onPetDied(pet);
        return;
      }

      // 又饿又渴时偶尔难过地坐下
      if (beh.state === 'idle' && (pet.hunger < 20 || pet.thirst < 20) && Math.random() < dt / 90000) {
        beh.state = 'sad';
        beh.t = 1.6;
      }
    });
  };

  Game.prototype.chooseBehavior = function (pet) {
    var beh = pet.beh;
    if (pet.energy < 12) {
      beh.state = 'sleep';
      beh.t = Utils.rand(4, 6);
      beh.manual = false;
      return;
    }
    var alive = 0, i;
    for (i = 0; i < this.pets.length; i++) if (this.pets[i].alive) alive++;
    var r = Math.random();
    if (r < 0.10) {
      // 玩足球（一天约 10%）
      this.startPlayBall(pet);
    } else if (r < 0.20) {
      // 跑酷（约 10%）
      this.startZoomies(pet);
    } else if (r < 0.30 && alive >= 2) {
      // 多只宠物追逐打闹（约 10%）
      this.startChase(pet);
    } else if (r < 0.50) {
      // 漫无目的地散步（约 20%）：连续走多个随机点
      beh.state = 'walk';
      beh.tx = Utils.rand(0.12, 0.88);
      beh.tz = Utils.rand(0.12, 0.85);
      beh.pending = null;
      beh.wander = true;
      beh.t = Utils.rand(40, 60);
    } else {
      // 休息（约 50%）：回窝里或随处趴着
      this.startRest(pet);
    }
  };

  // ---------------- 动作 ----------------
  Game.prototype.selectedPet = function () {
    var i;
    for (i = 0; i < this.pets.length; i++) {
      if (this.pets[i].alive && this.pets[i].id === this.selectedId) return this.pets[i];
    }
    for (i = 0; i < this.pets.length; i++) {
      if (this.pets[i].alive) return this.pets[i];
    }
    return null;
  };

  Game.prototype.petById = function (id) {
    for (var i = 0; i < this.pets.length; i++) {
      if (this.pets[i].id === id) return this.pets[i];
    }
    return null;
  };

  Game.prototype.hasAlivePet = function () {
    for (var i = 0; i < this.pets.length; i++) {
      if (this.pets[i].alive) return true;
    }
    return false;
  };

  // ---------------- 窝 ----------------
  // 猫窝在左半、狗窝在右半，数量与对应宠物一致
  Game.prototype.rebuildNests = function () {
    var self = this;
    this.nests = [];
    var cats = [], dogs = [];
    this.pets.forEach(function (p) {
      if (!p.alive) return;
      if (p.species === 'cat') cats.push(p); else dogs.push(p);
    });
    var place = function (list, species, x0, x1) {
      var n = list.length;
      if (!n) return;
      var slot = (x1 - x0) / n;
      for (var i = 0; i < n; i++) {
        self.nests.push({
          species: species,
          fx: x0 + slot * (i + 0.5),
          fz: 0.045,
          name: list[i].name,
          petId: list[i].id,
          sideN: n
        });
      }
    };
    place(cats, 'cat', 0.08, 0.50);
    place(dogs, 'dog', 0.50, 0.92);
  };

  Game.prototype.petNest = function (pet) {
    for (var i = 0; i < this.nests.length; i++) {
      if (this.nests[i].petId === pet.id) return this.nests[i];
    }
    return null;
  };

  // ---------------- 繁殖（第四轮） ----------------
  // 条件：同种 1 公 1 母都活着、两只都已养满 365 天、距上次生育满一年冷却
  Game.prototype.checkBreeding = function (now) {
    if (now - this.lastBreedAt < 365 * 86400000) return null;
    var cats = [], dogs = [];
    this.pets.forEach(function (p) {
      if (!p.alive) return;
      if (p.species === 'cat') cats.push(p);
      else if (p.species === 'dog') dogs.push(p);
    });
    var find = function (list, sp) {
      if (list.length < 2) return null;
      var m = null, f = null, i;
      for (i = 0; i < list.length; i++) {
        if (list[i].gender === 'male' && !m) m = list[i];
        else if (list[i].gender === 'female' && !f) f = list[i];
      }
      if (!m || !f) return null;
      var born = Math.min(m.createdAt, f.createdAt);
      if ((now - born) < 365 * 86400000) return null;
      return { m: m, f: f, sp: sp };
    };
    return find(cats, 'cat') || find(dogs, 'dog');
  };

  Game.prototype.doBreed = function (pair, now) {
    var n = Utils.randInt(1, 4);
    if (this.pets.length + n > MAX_PETS) {
      this.toastMsg('小屋住不下新生的小宝宝啦');
      return;
    }
    var self = this;
    for (var i = 0; i < n; i++) {
      var baby = Pets.createBuiltIn(pair.sp, (pair.sp === 'cat' ? '小猫' : '小狗') + (i + 1));
      baby.baseWeight = 1;                       // 新生 1 斤，之后按每年 3 斤的节奏长
      baby.gender = Math.random() < 0.5 ? 'male' : 'female';
      baby.createdAt = now;
      this.pets.push(baby);
    }
    this.lastBreedAt = now;
    this.rebuildNests();
    this.save();
    this.modal = {
      title: '🎉 新生命诞生啦！',
      lines: [
        pair.m.name + ' 和 ' + pair.f.name + ' 生了一窝 ' + n + ' 只小' + (pair.sp === 'cat' ? '猫' : '狗') + '！',
        '新生宝宝 ' + Pets.weightKg(this.pets[this.pets.length - 1], now).toFixed(1) + ' 斤，快去看看它们吧'
      ],
      buttons: [
        { label: '太棒了', onTap: function () { self.closeModal(); } }
      ]
    };
  };

  // ---------------- 足球 ----------------
  Game.prototype.kickBall = function (angle, speed) {
    var b = this.ball;
    b.vx = Math.cos(angle) * speed;
    b.vz = Math.sin(angle) * speed;
  };

  Game.prototype.startPlayBall = function (pet) {
    pet.beh.state = 'playBall';
    pet.beh.t = Utils.rand(40, 50);
    pet.beh.wander = false;
    pet.beh.pending = null;
    this.kickBall(Utils.rand(0, Math.PI * 2), Utils.rand(0.2, 0.35));
  };

  Game.prototype.startZoomies = function (pet) {
    pet.beh.state = 'zoomies';
    pet.beh.t = Utils.rand(35, 50);
    pet.beh.tx = Utils.rand(0.12, 0.88);
    pet.beh.tz = Utils.rand(0.12, 0.85);
    pet.beh.wander = false;
    pet.beh.pending = null;
  };

  Game.prototype.startChase = function (pet) {
    var others = [];
    this.pets.forEach(function (p) {
      if (p.alive && p.id !== pet.id) others.push(p);
    });
    if (!others.length) { this.startZoomies(pet); return; }
    var tgt = others[Math.floor(Math.random() * others.length)];
    pet.beh.state = 'chase';
    pet.beh.chaseId = tgt.id;
    pet.beh.t = Utils.rand(35, 50);
    pet.beh.pending = null;
  };

  Game.prototype.startRest = function (pet) {
    var beh = pet.beh;
    beh.wander = false;
    var nest = this.petNest(pet);
    if (nest && Math.random() < 0.6) {
      // 回自己的窝趴着
      beh.state = 'walk';
      beh.tx = Utils.clamp(nest.fx + Utils.rand(-0.03, 0.03), 0.1, 0.9);
      beh.tz = nest.fz + 0.05;
      beh.pending = 'restNest';
    } else if (Math.random() < 0.5) {
      // 就地趴下
      beh.state = 'rest';
      beh.restMode = 'floor';
      beh.t = Utils.rand(40, 60);
    } else {
      // 走到房间某处趴下
      beh.state = 'walk';
      beh.tx = Utils.rand(0.12, 0.88);
      beh.tz = Utils.rand(0.12, 0.85);
      beh.pending = 'restFloor';
    }
  };

  Game.prototype.feed = function () {
    var pet = this.selectedPet();
    if (!pet) { this.toastMsg('没有可以喂食的宠物了'); return; }
    if (this.bowls.food <= 0) { this.toastMsg('粮碗空空的，点一下粮碗添粮吧'); return; }
    var beh = pet.beh;
    if (beh.state === 'eat') return;
    if (beh.state === 'sleep') this.wake(pet);
    beh.state = 'walk';
    beh.tx = LAYOUT.food.fx;
    beh.tz = LAYOUT.food.fz;
    beh.pending = 'eat';
    beh.wander = false;
    this.toastMsg(pet.name + ' 走向粮碗…');
  };

  Game.prototype.water = function () {
    var pet = this.selectedPet();
    if (!pet) { this.toastMsg('没有可以喂水的宠物了'); return; }
    if (this.bowls.water <= 0) { this.toastMsg('水碗空空的，点一下水碗添水吧'); return; }
    var beh = pet.beh;
    if (beh.state === 'drink') return;
    if (beh.state === 'sleep') this.wake(pet);
    beh.state = 'walk';
    beh.tx = LAYOUT.water.fx;
    beh.tz = LAYOUT.water.fz;
    beh.pending = 'drink';
    beh.wander = false;
    this.toastMsg(pet.name + ' 走向水碗…');
  };

  Game.prototype.rest = function () {
    var pet = this.selectedPet();
    if (!pet) { this.toastMsg('没有可以休息的宠物了'); return; }
    if (pet.energy >= 92) { this.toastMsg(pet.name + ' 精力满满，不需要休息'); return; }
    if (pet.beh.state === 'sleep') return;
    pet.beh.state = 'sleep';
    pet.beh.t = 4;
    pet.beh.manual = true;
    pet.beh.wander = false;
    pet.beh.pending = null;
    this.toastMsg(pet.name + ' 开始打盹了…');
  };

  Game.prototype.wake = function (pet) {
    if (pet.beh.state === 'sleep') {
      pet.beh.state = 'idle';
      pet.beh.t = 1;
      pet.beh.manual = false;
    }
  };

  Game.prototype.pet = function (pet) {
    if (pet.beh.state === 'sleep') this.wake(pet);
    if (pet.beh.state === 'eat' || pet.beh.state === 'drink') return;
    var now = Date.now();
    Pets.petCare(pet, now);
    this.burstHearts(pet, 2, '#ff6b81');
    if (pet.beh.state !== 'happy') {
      pet.beh.state = 'happy';
      pet.beh.t = 1.0;
    }
  };

  // ---------------- 粒子 ----------------
  Game.prototype.burstHearts = function (pet, n, color) {
    var p = Render.project(pet.x, pet.z);
    for (var i = 0; i < n; i++) {
      if (this.hearts.length > 60) break;
      this.hearts.push({
        x: p.x + Utils.rand(-30, 30),
        y: p.y - 250 * p.sc + Utils.rand(-12, 12),
        vy: Utils.rand(34, 64),
        s: Utils.rand(10, 17),
        t0: this.time,
        color: color || '#ff6b81'
      });
    }
  };

  Game.prototype.spawnZzz = function (pet) {
    var p = Render.project(pet.x, pet.z);
    this.zzzs.push({ x: p.x + 30 * p.sc, y: p.y - 235 * p.sc, t0: this.time });
  };

  // 头顶泡泡（如厕 💧 / 💩）
  Game.prototype.spawnBubble = function (pet, text) {
    var p = Render.project(pet.x, pet.z);
    if (this.bubbles.length > 30) this.bubbles.shift();
    this.bubbles.push({ x: p.x, y: p.y - 260 * p.sc, t0: this.time, text: text });
  };

  // ---------------- 死亡 ----------------
  Game.prototype.onPetDied = function (pet) {
    pet.beh.state = 'dead';
    if (this.selectedId === pet.id) this.selectedId = null;
    this.rebuildNests();
    this.save();
    this.pendingDeathModal = pet;
  };

  Game.prototype.flushPending = function () {
    if (this.pendingDeathModal && !this.modal) {
      var pet = this.pendingDeathModal;
      this.pendingDeathModal = null;
      this.showDeathModal(pet);
    }
  };

  Game.prototype.showDeathModal = function (pet) {
    var self = this;
    var reason = Pets.deathReason(pet) || '被遗忘了';
    this.modal = {
      title: pet.name + ' 离开了',
      lines: [
        '它因' + reason + '而离开了小屋',
        pet.name + ' 在小屋里永远地睡着了……',
        '如今只剩下一座刻着名字的墓碑'
      ],
      buttons: [
        { label: '去看看墓碑', onTap: function () { self.closeModal(); } }
      ]
    };
  };

  Game.prototype.openTombModal = function (pet) {
    var self = this;
    this.modal = {
      title: '墓碑 · ' + pet.name,
      lines: [
        '墓碑上刻着它的名字',
        '它曾是小屋里快乐的一员',
        '想再领养一只新的吗？'
      ],
      buttons: [
        { label: '领养新的', onTap: function () { self.closeModal(); self.adopt(pet); } },
        { label: '关闭', style: 'ghost', onTap: function () { self.closeModal(); } }
      ]
    };
  };

  Game.prototype.adopt = function (oldPet) {
    if (this.pets.length >= MAX_PETS) { this.toastMsg('小屋已经住满啦'); return; }
    var np;
    if (oldPet.avatar && oldPet.avatar.type === 'photo') {
      var sp = oldPet.avatar.ears === 'cat' ? 'cat' : (oldPet.avatar.ears === 'dog' ? 'dog' : 'custom');
      np = Pets.createFromPhoto(oldPet.name, sp, oldPet.avatar.dataURL, oldPet.avatar.colors);
      Photo.loadTexture(np.avatar.dataURL, function (err, cv) {
        if (!err && cv) np.avatar.texture = cv;
      });
    } else {
      np = Pets.createBuiltIn(oldPet.species, oldPet.name);
    }
    this.pets.push(np);
    this.selectedId = np.id;
    this.rebuildNests();
    this.save();
    this.toastMsg('欢迎回来，' + np.name + '！');
  };

  // ---------------- 弹窗 ----------------
  Game.prototype.closeModal = function () {
    this.modal = null;
  };

  Game.prototype.modalHit = function (x, y) {
    var m = this.modal;
    if (!m) return;
    var rects = Render.modalButtonRects(m);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (inRect(x, y, r)) {
        if (r.btn.onTap) r.btn.onTap();
        return;
      }
    }
  };

  Game.prototype.openPetModal = function (pet) {
    var self = this;
    this.modal = {
      title: pet.name,
      lines: [
        '种类：' + (pet.species === 'cat' ? '小猫' : pet.species === 'dog' ? '小狗' : '照片伙伴'),
        '性别：' + Pets.genderLabel(pet) + ' · 体重：' + Pets.weightKg(pet).toFixed(1) + ' 斤（每年约长 3 斤）',
        '心情值：' + Math.round(Pets.happiness(pet)),
        pet.alive ? '每天记得照料它哦' : '它已经离开了……'
      ],
      buttons: [
        {
          label: pet.gender === 'male' ? '♂ 改母' : '♀ 改公', onTap: function () {
            pet.gender = pet.gender === 'male' ? 'female' : 'male';
            self.closeModal();
            self.save();
            self.toastMsg(pet.name + ' 现在是' + (pet.gender === 'male' ? '公' : '母') + '的啦');
          }
        },
        {
          label: '改名', onTap: function () {
            self.closeModal();
            self.P.textInput({ title: '给它改个名字', defaultValue: pet.name, maxLength: 8 }, function (val) {
              if (val) { pet.name = val; self.rebuildNests(); self.save(); }
            });
          }
        },
        {
          label: '抚摸它', onTap: function () {
            self.closeModal();
            if (pet.alive) self.pet(pet);
          }
        },
        { label: '关闭', style: 'ghost', onTap: function () { self.closeModal(); } }
      ]
    };
  };

  Game.prototype.openHelp = function () {
    var self = this;
    this.modal = {
      title: '帮助 · 玩法',
      lines: [
        '· 粮 / 水 / 精力：都会按 3 天从 100% 衰减到 0%',
        '· 粮碗水碗初始是空的，点一下碗就能添粮 / 添水',
        '· 宠物每天约去 3 次猫砂盆：尿尿渴度 -10%，拉臭饱食度 -10%',
        '· 体重每年约涨 3 斤，体型会跟着变大',
        '· 同种一公一母养满一年，会生一窝 1~4 只小宝宝',
        '· 抚摸：点按或滑动宠物，它会很开心'
      ],
      buttons: [
        { label: '知道了', onTap: function () { self.closeModal(); } }
      ]
    };
  };

  // ---------------- 交互 ----------------
  Game.prototype.toVirtual = function (sx, sy) {
    return { x: (sx - this.offX) / this.fitScale, y: (sy - this.offY) / this.fitScale };
  };

  Game.prototype.onStart = function (sx, sy, id) {
    var v = this.toVirtual(sx, sy);
    var x = v.x, y = v.y;
    this.pressX = x;
    this.pressY = y;
    this.dragPetId = null;
    this.dragChip = false;

    if (this.modal) {
      this.modalHit(x, y);
      return;
    }
    if (this.screen === 'setup') { this.setupHit(x, y); return; }
    if (this.screen === 'addpet') { this.addpetHit(x, y); return; }

    // 主界面：底部按钮
    var btns = LAYOUT.buttons;
    for (var i = btns.length - 1; i >= 0; i--) {
      var b = btns[i];
      if (inRect(x, y, b)) {
        this.pressedId = b.id;
        this.pressButton = b;
        return;
      }
    }
    // 状态卡滚动箭头
    var nav = this.chipNavAt(x, y);
    if (nav) {
      this.chipScrollBy(nav === 'left' ? -1 : 1);
      return;
    }
    // 状态卡
    var chip = this.chipAt(x, y);
    if (chip) {
      var now = Date.now();
      if (this.lastChipTap && this.lastChipTap.id === chip.id && now - this.lastChipTap.t < 450) {
        this.lastChipTap = null;
        if (chip.alive) this.openPetModal(chip);
      } else {
        this.lastChipTap = { id: chip.id, t: now };
        if (chip.alive) this.selectedId = chip.id;
        else this.openTombModal(chip);
      }
      this.dragChip = true;
      return;
    }
    // 宠物（抚摸 / 选中）
    var pet = this.petAt(x, y);
    if (pet) {
      this.selectedId = pet.id;
      this.dragPetId = pet.id;
      this.petCareAcc[pet.id] = 0;
      this.pet(pet);
      return;
    }
    // 碗：点击添粮 / 添水
    var bowlKind = this.bowlAt(x, y);
    if (bowlKind) {
      this.bowls[bowlKind] = 100;
      this.save();
      this.toastMsg(bowlKind === 'food' ? '粮碗装满啦！' : '水碗装满啦！');
      return;
    }
    // 墓碑
    var tomb = this.tombAt(x, y);
    if (tomb) { this.openTombModal(tomb); return; }
    // 顶部区域可拖动状态卡
    if (y < 210) this.dragChip = true;
  };

  Game.prototype.onMove = function (sx, sy, id) {
    var v = this.toVirtual(sx, sy);
    var x = v.x, y = v.y;
    if (this.screen !== 'main') return;
    if (this.dragChip) {
      this.chipScroll = Utils.clamp(this.chipScroll + (this.pressX - x), 0, this.chipMax());
      this.pressX = x;
      return;
    }
    if (this.dragPetId) {
      var pet = this.petById(this.dragPetId);
      if (pet && pet.alive) {
        var acc = (this.petCareAcc[pet.id] || 0) + 16;
        this.petCareAcc[pet.id] = acc;
        if (acc >= 280) {
          this.petCareAcc[pet.id] = 0;
          var now = Date.now();
          Pets.petCare(pet, now);
          this.burstHearts(pet, 1, '#ff6b81');
          if (pet.beh.state !== 'eat' && pet.beh.state !== 'drink') {
            pet.beh.state = 'happy';
            pet.beh.t = Math.max(pet.beh.t, 1.0);
          }
        }
      }
    }
  };

  Game.prototype.onEnd = function (sx, sy, id) {
    var v = this.toVirtual(sx, sy);
    if (this.pressButton) {
      var b = this.pressButton;
      if (inRect(v.x, v.y, b)) {
        this.doAction(b.id);
      }
      this.pressButton = null;
    }
    this.pressedId = null;
    this.dragPetId = null;
    this.dragChip = false;
  };

  Game.prototype.doAction = function (id) {
    if (id === 'feed') this.feed();
    else if (id === 'water') this.water();
    else if (id === 'rest') this.rest();
    else if (id === 'add') { this.resetAddPet(); this.screen = 'addpet'; }
    else if (id === 'help') this.openHelp();
  };

  // 命中检测
  Game.prototype.chipMax = function () {
    return Math.max(0, this.pets.length * (LAYOUT.chipW + LAYOUT.chipGap) - (W - LAYOUT.chipX0 * 2));
  };

  Game.prototype.chipScrollBy = function (dir) {
    var page = LAYOUT.chipW + LAYOUT.chipGap;
    this.chipScroll = Utils.clamp(this.chipScroll + dir * page * 2, 0, this.chipMax());
  };

  Game.prototype.chipNavAt = function (x, y) {
    if (this.chipMax() <= 0) return null;
    if (y >= LAYOUT.chipY && y <= LAYOUT.chipY + LAYOUT.chipH) {
      if (x >= 6 && x <= 50) return 'left';
      if (x >= W - 50 && x <= W - 6) return 'right';
    }
    return null;
  };

  Game.prototype.chipAt = function (x, y) {
    if (y < LAYOUT.chipY || y > LAYOUT.chipY + LAYOUT.chipH) return null;
    for (var i = 0; i < this.pets.length; i++) {
      var cx = LAYOUT.chipX0 + i * (LAYOUT.chipW + LAYOUT.chipGap) - this.chipScroll;
      if (x >= cx && x <= cx + LAYOUT.chipW) return this.pets[i];
    }
    return null;
  };

  Game.prototype.petAt = function (x, y) {
    var best = null, bestDist = 1e9;
    for (var i = 0; i < this.pets.length; i++) {
      var pet = this.pets[i];
      if (!pet.alive) continue;
      var p = Render.project(pet.x, pet.z);
      var wf = Pets.weightFactor(pet);
      var dx = x - p.x, dy = y - (p.y - 105 * p.sc * wf);
      var r = 125 * p.sc * wf;
      var d = dx * dx + dy * dy;
      if (d < r * r && d < bestDist) { bestDist = d; best = pet; }
    }
    return best;
  };

  Game.prototype.tombAt = function (x, y) {
    for (var i = 0; i < this.pets.length; i++) {
      var pet = this.pets[i];
      if (pet.alive) continue;
      var p = Render.project(pet.x, pet.z);
      if (x >= p.x - 70 * p.sc && x <= p.x + 70 * p.sc &&
          y >= p.y - 130 * p.sc && y <= p.y + 10 * p.sc) {
        return pet;
      }
    }
    return null;
  };

  // 碗命中：返回 'food' / 'water'，用于点击添粮添水
  Game.prototype.bowlAt = function (x, y) {
    var spots = [
      { kind: 'food', fx: LAYOUT.food.fx, fz: LAYOUT.food.fz },
      { kind: 'water', fx: LAYOUT.water.fx, fz: LAYOUT.water.fz }
    ];
    for (var i = 0; i < spots.length; i++) {
      var p = Render.project(spots[i].fx, spots[i].fz);
      var dx = x - p.x, dy = y - p.y;
      var r = 95 * p.sc;
      if (dx * dx + dy * dy < r * r) return spots[i].kind;
    }
    return null;
  };

  // 设置界面
  Game.prototype.setupHit = function (x, y) {
    var s = this.setup;
    var self = this;
    // 卡片（点击切换是否养这只）
    var catCard = { x: 50, y: 230, w: 650, h: 300 };
    var dogCard = { x: 50, y: 555, w: 650, h: 300 };
    if (inRect(x, y, s.catBox)) {
      if (!s.picked.cat) { this.toastMsg('先点卡片选择养小猫吧'); return; }
      this.P.textInput({ title: '给小猫起个名字', defaultValue: s.catName, maxLength: 8 }, function (val) {
        if (val) s.catName = val;
      });
      return;
    }
    if (inRect(x, y, s.dogBox)) {
      if (!s.picked.dog) { this.toastMsg('先点卡片选择养小狗吧'); return; }
      this.P.textInput({ title: '给小狗起个名字', defaultValue: s.dogName, maxLength: 8 }, function (val) {
        if (val) s.dogName = val;
      });
      return;
    }
    if (inRect(x, y, catCard)) {
      if (s.picked.cat && !s.picked.dog) { this.toastMsg('至少养一只宠物哦'); return; }
      s.picked.cat = !s.picked.cat;
      return;
    }
    if (inRect(x, y, dogCard)) {
      if (s.picked.dog && !s.picked.cat) { this.toastMsg('至少养一只宠物哦'); return; }
      s.picked.dog = !s.picked.dog;
      return;
    }
    if (inRect(x, y, s.startBtn)) {
      this.pressedId = 'setup_start';
      this.startGame();
    }
  };

  Game.prototype.startGame = function () {
    var s = this.setup;
    this.pets = [];
    if (s.picked.cat) {
      this.pets.push(Pets.createBuiltIn('cat', (s.catName || '').trim() || '咪咪'));
    }
    if (s.picked.dog) {
      this.pets.push(Pets.createBuiltIn('dog', (s.dogName || '').trim() || '旺财'));
    }
    if (!this.pets.length) { this.toastMsg('请至少选择一只宠物'); return; }
    this.selectedId = this.pets[0].id;
    this.setupDone = true;
    this.screen = 'main';
    this.rebuildNests();
    this.save();
    this.toastMsg('欢迎来到宠物小屋！');
  };

  // 领养界面
  Game.prototype.addpetHit = function (x, y) {
    var a = this.addpet;
    var self = this;
    if (inRect(x, y, a.backBtn)) { this.screen = 'main'; return; }
    if (inRect(x, y, a.photoArea) || inRect(x, y, a.reselectBtn)) { this.choosePhoto(); return; }
    if (inRect(x, y, a.nameBox)) {
      this.P.textInput({ title: '给它起个名字', defaultValue: a.name, maxLength: 8 }, function (val) {
        if (val) a.name = val;
      });
      return;
    }
    for (var i = 0; i < a.speciesBtns.length; i++) {
      if (inRect(x, y, a.speciesBtns[i])) { a.species = a.speciesBtns[i].value; return; }
    }
    if (inRect(x, y, a.confirmBtn)) {
      this.pressedId = 'addpet_ok';
      this.confirmAdd();
      return;
    }
    if (inRect(x, y, a.quickCatBtn)) { this.adoptBuiltIn('cat'); return; }
    if (inRect(x, y, a.quickDogBtn)) { this.adoptBuiltIn('dog'); return; }
  };

  // 快捷领养一只内置小猫 / 小狗
  Game.prototype.adoptBuiltIn = function (species) {
    var self = this;
    if (this.pets.length >= MAX_PETS) { this.toastMsg('小屋已经住满啦'); return; }
    var def = species === 'cat' ? '新小猫' : '新小狗';
    this.P.textInput({ title: species === 'cat' ? '给小猫起个名字' : '给小狗起个名字', defaultValue: def, maxLength: 8 }, function (val) {
      var name = (val || '').trim() || def;
      var pet = Pets.createBuiltIn(species, name);
      self.pets.push(pet);
      self.selectedId = pet.id;
      self.screen = 'main';
      self.rebuildNests();
      self.save();
      self.toastMsg('欢迎 ' + name + ' 加入小屋！');
    });
  };

  Game.prototype.choosePhoto = function () {
    var self = this;
    this.P.chooseImage(function (err, src) {
      if (err) { self.toastMsg(err.message || '选择图片失败'); return; }
      self.toastMsg('正在生成 3D 形象…', 3000);
      Photo.process(src, function (err2, res) {
        if (err2) { self.toastMsg(err2.message || '图片处理失败，请换一张'); return; }
        self.addpet.photo = res;
        self.toastMsg('3D 形象生成好啦！');
      });
    });
  };

  Game.prototype.confirmAdd = function () {
    var a = this.addpet;
    if (!a.photo) { this.toastMsg('请先选择一张照片'); return; }
    if (this.pets.length >= MAX_PETS) { this.toastMsg('小屋已经住满啦'); return; }
    var name = (a.name || '').trim() || '我的宠物';
    var pet = Pets.createFromPhoto(name, a.species, a.photo.dataURL, a.photo.colors);
    pet.avatar.texture = a.photo.texture;
    this.pets.push(pet);
    this.selectedId = pet.id;
    this.resetAddPet();
    this.screen = 'main';
    this.rebuildNests();
    this.save();
    this.toastMsg('欢迎 ' + name + ' 加入小屋！');
  };

  // ---------------- 渲染 ----------------
  Game.prototype.render = function () {
    var ctx = this.ctx;
    var dpr = this.dpr;
    ctx.setTransform(dpr * this.fitScale, 0, 0, dpr * this.fitScale, this.offX * dpr, this.offY * dpr);
    if (this.screen === 'setup') {
      Render.drawSetup(ctx, this);
    } else if (this.screen === 'addpet') {
      Render.drawAddPet(ctx, this);
    } else {
      this.renderMain(ctx);
    }
    if (this.modal) Render.drawModal(ctx, this.modal);
    Render.drawToast(ctx, this.toast);
  };

  Game.prototype.renderMain = function (ctx) {
    var t = this.time / 1000;
    Render.drawRoom(ctx, t);

    // 碗（存量：0 空碗 ~ 100 满碗）
    var f = Render.project(LAYOUT.food.fx, LAYOUT.food.fz);
    Render.drawBowl(ctx, f.x, f.y, f.sc, 'food', this.bowls.food);
    var w = Render.project(LAYOUT.water.fx, LAYOUT.water.fz);
    Render.drawBowl(ctx, w.x, w.y, w.sc, 'water', this.bowls.water);
    // 猫砂盆
    Render.drawLitter(ctx, t);

    // 窝（数量 = 对应宠物数量）与足球
    for (var ni = 0; ni < this.nests.length; ni++) {
      Render.drawNest(ctx, this.nests[ni], t);
    }
    Render.drawBall(ctx, this.ball, t);

    // 宠物与墓碑（按深度排序）
    var objs = this.pets.slice();
    objs.sort(function (a, b) { return a.z - b.z; });
    var aliveCount = 0;
    for (var i = 0; i < objs.length; i++) {
      var pet = objs[i];
      if (!pet.alive) {
        Render.drawTombstone(ctx, pet, t);
      } else {
        aliveCount++;
        Render.drawPet(ctx, pet, t, pet.id === this.selectedId, this.time);
      }
    }

    Render.drawParticles(ctx, this);

    // 顶部状态卡
    this.chipScroll = Utils.clamp(this.chipScroll, 0, this.chipMax());
    for (var c = 0; c < this.pets.length; c++) {
      var cx = LAYOUT.chipX0 + c * (LAYOUT.chipW + LAYOUT.chipGap) - this.chipScroll;
      if (cx + LAYOUT.chipW < 0 || cx > W) continue;
      Render.drawChip(ctx, this.pets[c], cx, this.pets[c].id === this.selectedId, t);
    }
    Render.drawChipNav(ctx, this);

    Render.drawActionBar(ctx, this);

    if (aliveCount === 0) {
      Utils.drawText(ctx, '小屋空空的…… 点「添加」上传照片，或点墓碑领养新伙伴', 375, 1080,
        { size: 22, color: '#a0805a' });
    }
  };

  Game.prototype.toastMsg = function (text, dur) {
    this.toast = { text: text, t0: Date.now(), dur: dur || 2200 };
  };

  return Game;
});
