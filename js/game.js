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
  var ROOM_KEYS = ['pet_house_save_v1', 'pet_house_save_r2', 'pet_house_save_r3'];
  var MAX_PETS = 10;

  function inRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function Game(platform, canvas, roomIndex) {
    this.P = platform;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.roomIndex = roomIndex || 0;
    this.saveKey = ROOM_KEYS[this.roomIndex] || ROOM_KEYS[0];
    this.rooms = null;          // 房间管理器（由 Rooms 注入）

    var sys = platform.system();
    this.sys = sys;
    this.dpr = sys.dpr || 1;
    this.resize();

    // 演示 / 调试模式（浏览器 query: ?demo=1&day=73；仅房间 1 生效）
    var q = platform.getQuery();
    this.demo = null;
    if (q && q.demo !== undefined && this.roomIndex === 0) {
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
        bowlHr: q.bowlHr ? parseFloat(q.bowlHr) : 0,    // 碗消耗时长（小时，默认 24 一天耗完）
        dirt: q.dirt ? parseFloat(q.dirt) : 0,          // 猫砂盆初始脏度 0~100（演示）
        admin: q.admin !== undefined                    // 打开后台面板（演示）
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
    // 拎起拖拽：按住宠物拖动可放到其他位置
    this.petLiftId = null;
    this.petLiftStart = null;
    this.petLiftActive = false;
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
    // 第六轮：猫砂盆脏度（0~100，一天不铲约满；脏满影响精力）与铲屎
    this.litterDirt = 0;
    this.litterWarnAt = 0;  // 臭气警告时间戳（每天最多提示一次）
    // 院子：六块地 + 种子（初始每种 1 颗）
    this.yard = [null, null, null, null, null, null];
    this.seeds = { orchid: 1, corn: 1, peach: 1, peanut: 1, watermelon: 1, banana: 1 };
    this.selectedSeed = null;
    // 池塘：鱼/虾/乌龟（初始 100g，每年涨 100g）
    this.pond = [];
    // 肥料（铲屎获得，1 坨加速植物 1 天）与仓库（农产品/粮）
    this.fertilizer = 0;
    this.store = {
      crops: { orchid: 0, corn: 0, peach: 0, peanut: 0, watermelon: 0, banana: 0 },
      food: 0
    };

    this.setup = {
      names: { cat: '咪咪', dog: '旺财', pig: '哼哼', cow: '哞哞', sheep: '咩咩', chick: '叽叽' },
      picked: { cat: true, dog: true, pig: false, cow: false, sheep: false, chick: false },
      startBtn: { x: 125, y: 1055, w: 500, h: 100 }
    };
    this.resetAddPet();
  }

  Game.prototype.resetAddPet = function () {
    this.addpet = {
      photo: null,
      name: '',
      species: null,                                 // 照片宠物必选物种；null = 未选
      gender: null,                                  // 领养时手动选公母；null = 随机
      backBtn: { x: 20, y: 40, w: 130, h: 62 },
      photoArea: { x: 125, y: 170, w: 500, h: 320 },
      reselectBtn: { x: 480, y: 430, w: 130, h: 50 },
      nameBox: { x: 330, y: 675, w: 320, h: 60 },
      genderBtns: [
        { value: 'male', label: '♂ 公', x: 165, y: 762, w: 205, h: 50 },
        { value: 'female', label: '♀ 母', x: 390, y: 762, w: 205, h: 50 }
      ],
      speciesBtns: [
        { value: 'cat', label: '小猫', x: 50, y: 850, w: 206, h: 46 },
        { value: 'dog', label: '小狗', x: 272, y: 850, w: 206, h: 46 },
        { value: 'pig', label: '小猪', x: 494, y: 850, w: 206, h: 46 },
        { value: 'cow', label: '小牛', x: 50, y: 904, w: 206, h: 46 },
        { value: 'sheep', label: '小羊', x: 272, y: 904, w: 206, h: 46 },
        { value: 'chick', label: '小鸡', x: 494, y: 904, w: 206, h: 46 }
      ],
      confirmBtn: { x: 150, y: 975, w: 450, h: 92 }
    };
  };

  // 窗口尺寸变化（F11 全屏 / 拖拽窗口 / 移动端旋转）时重算画布适配；所有房间共享同一 canvas
  Game.prototype.resize = function () {
    var sys = this.P.system();
    this.sys = sys;
    this.dpr = sys.dpr || 1;
    this.fitScale = Math.min(sys.width / W, sys.height / H);
    this.offX = (sys.width - W * this.fitScale) / 2;
    this.offY = (sys.height - H * this.fitScale) / 2;
    var canvas = this.canvas;
    canvas.width = Math.round(sys.width * this.dpr);
    canvas.height = Math.round(sys.height * this.dpr);
    if (this.P.isBrowser) {
      canvas.style.width = sys.width + 'px';
      canvas.style.height = sys.height + 'px';
    }
  };

  // ---------------- 存档 ----------------
  Game.prototype.save = function () {
    var save = {
      v: 1,
      setupDone: this.setupDone,
      lastSavedAt: Date.now(),
      pets: this.pets.map(Pets.toJSON),
      bowls: this.bowls,
      litterDirt: this.litterDirt,
      yard: this.yard,
      seeds: this.seeds,
      pond: this.pond,
      fertilizer: this.fertilizer,
      store: this.store
    };
    this.P.setStorage(this.saveKey, save);
  };

  Game.prototype.load = function () {
    var self = this;
    var save = this.P.getStorage(this.saveKey, null);
    var now = Date.now();

    if (this.demo && this.demo.skipSetup) {
      this.setupDone = true;
      this.pets = [
        Pets.createBuiltIn('cat', this.demo.name1 || '咪咪'),
        Pets.createBuiltIn('dog', this.demo.name2 || '旺财')
      ];
      // 第四轮演示：碗初始为空；可指定性别 / 年龄 / 立即如厕 / 初始脏度
      this.bowls = { food: 0, water: 0 };
      this.litterDirt = this.demo.dirt ? Math.min(100, this.demo.dirt) : 0;
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
      if (this.demo.admin) this.openAdmin();
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
      // 猫砂盆脏度（旧存档无 → 干净 0）
      this.litterDirt = save.litterDirt != null ? Math.max(0, Math.min(100, save.litterDirt)) : 0;
      // 院子：六块地 + 种子（旧存档无 → 空院子 + 初始每种 1 颗）
      this.yard = (save.yard && save.yard.length === 6) ? save.yard.map(function (pl) {
        return (pl && pl.type) ? { type: pl.type, plantedAt: pl.plantedAt || 0 } : null;
      }) : [null, null, null, null, null, null];
      this.seeds = { orchid: 1, corn: 1, peach: 1, peanut: 1, watermelon: 1, banana: 1 };
      if (save.seeds) {
        Pets.PLANT_ORDER.forEach(function (k) { if (save.seeds[k] != null) self.seeds[k] = save.seeds[k]; });
      }
      this.selectedSeed = null;
      // 池塘（旧存档无 → 空池塘）
      this.pond = (save.pond && Array.isArray(save.pond)) ? save.pond.map(function (p) {
        return p && p.species ? { species: p.species, createdAt: p.createdAt || 0 } : null;
      }).filter(function (p) { return p !== null; }) : [];
      // 肥料与仓库（旧存档无 → 0）
      this.fertilizer = save.fertilizer != null ? Math.max(0, save.fertilizer) : 0;
      this.store = {
        crops: { orchid: 0, corn: 0, peach: 0, peanut: 0, watermelon: 0, banana: 0 },
        food: 0
      };
      if (save.store) {
        if (save.store.crops) Pets.PLANT_ORDER.forEach(function (k) {
          if (save.store.crops[k] != null) self.store.crops[k] = save.store.crops[k];
        });
        if (save.store.food != null) self.store.food = save.store.food;
      }
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
    if (this._running) return;
    Render.setPetsAPI({ needs: Pets.needs, mood: Pets.mood, weightKg: Pets.weightKg, weightFactor: Pets.weightFactor, speciesOrder: Pets.SPECIES_ORDER, speciesInfo: Pets.SPECIES, plantInfo: Pets.PLANTS, plantGrowth: Pets.plantGrowth, plantLabel: Pets.plantLabel, plantOrder: Pets.PLANT_ORDER, pondInfo: Pets.POND, pondWeight: Pets.pondWeight, pondScale: Pets.pondScale, pondOrder: Pets.POND_ORDER });
    if (!this._bound) {
      this._bound = true;
      this.P.onHide(function () { self.save(); });
    }
    this._running = true;
    this.load();
    this.lastT = Date.now();
    var loop = function () {
      if (!self._running) return;
      var now = Date.now();
      var dt = Math.min(Math.max(now - self.lastT, 0), 100);
      self.lastT = now;
      self.update(dt);
      self.render();
      self.P.raf(loop);
    };
    this.P.raf(loop);
  };

  // 停止当前实例的渲染循环（切房间时由 Rooms 调用；数据已由调用方存档）
  Game.prototype.stop = function () {
    this._running = false;
  };

  // 重置本房间：清存档、回到选宠界面（不重置其它房间）
  Game.prototype.resetRoom = function () {
    this.P.removeStorage(this.saveKey);
    this.pets = [];
    this.selectedId = null;
    this.setupDone = false;
    this.bowls = { food: 0, water: 0 };
    this.litterDirt = 0;
    this.nests = [];
    this.lastBreedAt = 0;
    this.lastBreedCheck = 0;
    this.chipScroll = 0;
    this.toast = null;
    this.modal = null;
    this.pendingDeathModal = null;
    this.hearts = [];
    this.zzzs = [];
    this.bubbles = [];
    this.ball = { x: 0.62, z: 0.30, vx: 0, vz: 0, spin: 0 };
    this.lastSavedAt = Date.now();
    this.screen = 'setup';
    this.resetAddPet();
  };

  // 房间概览文字（房间面板显示用）
  Game.prototype.roomSummary = function () {
    var cnt = {};
    this.pets.forEach(function (p) {
      if (!p.alive) return;
      var l = Pets.speciesLabel(p.species);
      cnt[l] = (cnt[l] || 0) + 1;
    });
    var keys = Object.keys(cnt);
    return keys.length ? keys.map(function (k) { return k + '×' + cnt[k]; }).join(' · ') : '空房间';
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
      // 猫砂盆脏度：一天自然累积约 70，加上如厕每次 +10（约一天满），需每天手动铲屎
      if (this.litterDirt < 100) {
        this.litterDirt = Math.min(100, this.litterDirt + dt * (70 / 86400000));
      }
      if (this.litterDirt >= 100 && Date.now() - this.litterWarnAt > 86400000) {
        this.litterWarnAt = Date.now();
        this.toastMsg('猫砂盆满啦！宠物们睡不好觉，精力消耗加速，快铲屎！');
      }
      // 繁殖检查（约 30 秒一次；仅演示模式自动生，正常模式改为后台手动配对）
      var now2 = Date.now();
      if (now2 - this.lastBreedCheck > 30000) {
        this.lastBreedCheck = now2;
        if (this.demo) {
          var pair = this.checkBreeding(now2);
          if (pair) this.doBreed(pair, now2);
        }
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
      // 被拎起的宠物：不更新行为（位置由拖拽控制）
      if (self.petLiftActive && pet.id === self.petLiftId) return;
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

      // 睡觉恢复精力（手动休息 / 精力低自动入睡都恢复；猫砂盆脏满时睡不好，恢复失效）
      if (beh.state === 'sleep') {
        if (self.litterDirt < 100) {
          pet.energy = Math.min(100, pet.energy + dt / 1000 * 15);
        }
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
            // 如厕让猫砂盆变脏（+10 脏度）
            self.litterDirt = Math.min(100, (self.litterDirt || 0) + 10);
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

    // 宠物互相避让：防止叠在一起（在所有行为状态后统一推开）
    // 休息/睡觉中的宠物原地不动（当障碍物），只推开走动的宠物
    var list = this.pets.filter(function (p) { return p.alive; });
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var aFixed = a.beh.state === 'rest' || a.beh.state === 'sleep';
        var bFixed = b.beh.state === 'rest' || b.beh.state === 'sleep';
        if (aFixed && bFixed) continue;
        var ddx = b.x - a.x, ddz = b.z - a.z;
        var d = Math.sqrt(ddx * ddx + ddz * ddz);
        var minD = 0.15;
        if (d > 0.0001 && d < minD) {
          var push = (minD - d) / 2;
          var nx = ddx / d, nz = ddz / d;
          if (!aFixed) { a.x -= nx * push; a.z -= nz * push; }
          if (!bFixed) { b.x += nx * push; b.z += nz * push; }
        }
      }
    }
    // 边界限制（防止被推/走出界）
    list.forEach(function (p) {
      p.x = Utils.clamp(p.x, 0.08, 0.92);
      p.z = Utils.clamp(p.z, 0.08, 0.90);
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
    var order = Pets.SPECIES_ORDER;
    var nSp = order.length;
    order.forEach(function (sp, i) {
      var list = [];
      self.pets.forEach(function (p) {
        if (!p.alive || p.species !== sp) return;
        list.push(p);
      });
      var n = list.length;
      if (!n) return;
      var x0 = 0.03 + i * (0.94 / nSp), x1 = 0.03 + (i + 1) * (0.94 / nSp);
      var slot = (x1 - x0) / n;
      for (var j = 0; j < n; j++) {
        self.nests.push({
          species: sp,
          fx: x0 + slot * (j + 0.5),
          fz: 0.045,
          name: list[j].name,
          petId: list[j].id,
          sideN: n
        });
      }
    });
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
    var groups = {};
    Pets.SPECIES_ORDER.forEach(function (sp) { groups[sp] = []; });
    this.pets.forEach(function (p) {
      if (!p.alive) return;
      if (groups[p.species]) groups[p.species].push(p);
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
    for (var sp in groups) {
      var pair = find(groups[sp], sp);
      if (pair) return pair;
    }
    return null;
  };

  Game.prototype.doBreed = function (pair, now) {
    var n = Utils.randInt(1, 4);
    if (this.pets.length + n > MAX_PETS) {
      this.toastMsg('小屋住不下新生的小宝宝啦');
      return;
    }
    var spInfo = Pets.SPECIES[pair.sp] || Pets.SPECIES.cat;
    var self = this;
    for (var i = 0; i < n; i++) {
      var baby = Pets.createBuiltIn(pair.sp, spInfo.label + (i + 1));
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
        pair.m.name + ' 和 ' + pair.f.name + ' 生了一窝 ' + n + ' 只小' + spInfo.baby + '！',
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
      np = Pets.createFromPhoto(oldPet.name, oldPet.species, oldPet.avatar.dataURL, oldPet.avatar.colors);
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
        '种类：' + Pets.speciesLabel(pet.species),
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
        '· 同种一公一母养满一年，可到后台点"配对生育"手动配对',
        '· 照片领养的伙伴是独一无二的定制宠物，不参与繁殖',
        '· 抚摸：点按或滑动宠物，它会很开心',
        '· 铲屎：点一下猫砂盆清理，不铲的话宠物睡不好觉，三天精力就会耗尽',
        '· 版本 v10 · 更新缓存后请重开页面'
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
    if (this.screen === 'rooms') { this.roomsHit(x, y); return; }
    if (this.screen === 'yard') { this.yardHit(x, y); return; }
    if (this.screen === 'pond') { this.pondHit(x, y); return; }
    if (this.screen === 'store') { this.storeHit(x, y); return; }

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
    // 房间入口（右上角，⚙ 齿轮旁，小圆钮避免与状态卡重叠）
    if (x >= 608 && x <= 648 && y >= 12 && y <= 52) {
      this.openRooms();
      return;
    }
    // 后台齿轮（右上角，优先于状态卡箭头）
    if (x >= 682 && x <= 722 && y >= 12 && y <= 52) {
      this.openAdmin();
      return;
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
    // 宠物（抚摸 / 选中 / 按住可拎起拖拽）
    var pet = this.petAt(x, y);
    if (pet) {
      this.selectedId = pet.id;
      this.dragPetId = pet.id;
      this.petCareAcc[pet.id] = 0;
      this.pet(pet);
      // 记录拎起拖拽起点（按住后拖动超过阈值即拎起，松手放下）
      this.petLiftId = pet.id;
      this.petLiftStart = { sx: sx, sy: sy };
      this.petLiftActive = false;
      return;
    }
    // 猫砂盆：点击铲屎
    if (this.litterAt(x, y)) {
      this.scoopLitter();
      return;
    }
    // 碗：点击添粮 / 添水（添粮优先消耗仓库粮）
    var bowlKind = this.bowlAt(x, y);
    if (bowlKind) {
      this.bowls[bowlKind] = 100;
      if (bowlKind === 'food' && this.store.food > 0) {
        this.store.food--;
        this.toastMsg('用了 1 份仓库粮，粮碗装满啦！');
      } else if (bowlKind === 'food') {
        this.toastMsg('粮碗装满啦！（仓库没粮了，收获植物加工一些吧）');
      } else {
        this.toastMsg('水碗装满啦！');
      }
      this.save();
      return;
    }
    // 墓碑
    var tomb = this.tombAt(x, y);
    if (tomb) { this.openTombModal(tomb); return; }
    // 门：进入院子（放在宠物/碗/墓碑之后，避免挡住场景交互）
    if (this.doorAt(x, y)) {
      this.screen = 'yard';
      return;
    }
    // 顶部区域可拖动状态卡
    if (y < 210) this.dragChip = true;
  };

  Game.prototype.onMove = function (sx, sy, id) {
    var v = this.toVirtual(sx, sy);
    var x = v.x, y = v.y;
    if (this.screen !== 'main') return;
    // 拎起拖拽：按住宠物拖动 → 拎起跟随手指
    if (this.dragPetId && this.petLiftId) {
      var liftPet = this.petById(this.petLiftId);
      if (liftPet && liftPet.alive) {
        if (!this.petLiftActive) {
          var dsx = sx - this.petLiftStart.sx, dsy = sy - this.petLiftStart.sy;
          if (dsx * dsx + dsy * dsy > 18 * 18) this.petLiftActive = true;
        }
        if (this.petLiftActive) {
          var fx = (x - 50) / 650, fz = (y - 560) / 612;
          liftPet.x = Utils.clamp(fx, 0.08, 0.92);
          liftPet.z = Utils.clamp(fz, 0.08, 0.90);
          return; // 拎起时不做抚摸
        }
      }
    }
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
    // 松手放下（拎起状态清理，宠物停留在当前位置）
    this.petLiftId = null;
    this.petLiftStart = null;
    this.petLiftActive = false;
  };

  Game.prototype.doAction = function (id) {
    if (id === 'feed') this.feed();
    else if (id === 'water') this.water();
    else if (id === 'rest') this.rest();
    else if (id === 'add') { this.resetAddPet(); this.screen = 'addpet'; }
    else if (id === 'help') this.openHelp();
  };

  // 命中检测
  // 状态卡布局：≤5 只单行整屏显示；6~10 只自动两行（每行最多 5 张），
  // 所有卡片始终完整落在游戏区域内，不超框、不需要滑动
  Game.prototype.chipLayout = function () {
    var n = Math.max(1, this.pets.length);
    var single = n <= 5;
    var perRow = single ? n : Math.ceil(n / 2);
    var cw = Utils.clamp(Math.floor((W - LAYOUT.chipX0 * 2 - (perRow - 1) * LAYOUT.chipGap) / perRow), 132, LAYOUT.chipW);
    var ch = single ? LAYOUT.chipH : 74;
    var rowGap = 8;
    return { single: single, rows: single ? 1 : 2, perRow: perRow, cw: cw, ch: ch, rowGap: rowGap, y2: LAYOUT.chipY + ch + rowGap };
  };

  Game.prototype.chipMax = function () {
    return 0; // 两行全部显示，永不溢出，无需滑动
  };

  Game.prototype.chipScrollBy = function (dir) {
    var L = this.chipLayout();
    var page = L.cw + LAYOUT.chipGap;
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
    var L = this.chipLayout();
    var rowY = [LAYOUT.chipY, L.y2];
    for (var r = 0; r < L.rows; r++) {
      if (y >= rowY[r] && y <= rowY[r] + L.ch) {
        for (var c = 0; c < L.perRow; c++) {
          var idx = r * L.perRow + c;
          if (idx >= this.pets.length) return null;
          var cx = LAYOUT.chipX0 + c * (L.cw + LAYOUT.chipGap) - this.chipScroll;
          if (x >= cx && x <= cx + L.cw) return this.pets[idx];
        }
      }
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

  // 院子门命中（后墙中央，窗户与挂画之间）
  Game.prototype.doorAt = function (x, y) {
    return x >= 350 && x <= 470 && y >= 235 && y <= 475;
  };

  // 院子布局（六块地 2×3 + 底部种子栏）
  Game.prototype.yardLayout = function () {
    return {
      backBtn: { x: 20, y: 40, w: 130, h: 62 },
      plots: [
        { x: 25, y: 330, w: 210, h: 165 },
        { x: 270, y: 330, w: 210, h: 165 },
        { x: 515, y: 330, w: 210, h: 165 },
        { x: 25, y: 525, w: 210, h: 165 },
        { x: 270, y: 525, w: 210, h: 165 },
        { x: 515, y: 525, w: 210, h: 165 }
      ],
      seeds: Pets.PLANT_ORDER.map(function (k, i) {
        return { key: k, x: 25 + i * 122, y: 1015, w: 110, h: 100 };
      })
    };
  };

  // 院子里点击：返回 / 池塘 / 选种子 / 播种 / 收获
  Game.prototype.yardHit = function (x, y) {
    var L = this.yardLayout();
    if (inRect(x, y, L.backBtn)) {
      this.screen = 'main';
      return;
    }
    // 右上角池塘按钮 → 进入池塘
    if (x >= 620 && x <= 730 && y >= 40 && y <= 102) {
      this.screen = 'pond';
      return;
    }
    // 左侧粮仓小屋 → 进入仓库（加工粮 / 存粮）
    if (x >= 25 && x <= 185 && y >= 720 && y <= 820) {
      this.screen = 'store';
      return;
    }
    // 种子栏（先于地块，底部）
    for (var i = 0; i < L.seeds.length; i++) {
      var s = L.seeds[i];
      if (inRect(x, y, s)) {
        if (this.seeds[s.key] > 0) {
          this.selectedSeed = this.selectedSeed === s.key ? null : s.key;
          this.toastMsg(this.selectedSeed ? '选中了' + Pets.plantLabel(s.key) + '种子，点空地播种' : '取消选择');
        } else {
          this.toastMsg('没有' + Pets.plantLabel(s.key) + '种子了，收获后可获得');
        }
        return;
      }
    }
    // 地块
    for (var j = 0; j < L.plots.length; j++) {
      if (!inRect(x, y, L.plots[j])) continue;
      var pl = this.yard[j];
      var now = Date.now();
      if (pl) {
        if (Pets.plantMature(pl, now)) {
          // 收获：种子 +1、农产品 +2（可去仓库加工成粮）
          this.seeds[pl.type] = (this.seeds[pl.type] || 0) + 1;
          this.store.crops[pl.type] = (this.store.crops[pl.type] || 0) + 2;
          this.yard[j] = null;
          this.save();
          this.toastMsg('收获了' + Pets.plantLabel(pl.type) + '！种子+1，农产品×2（可去仓库加工成粮）');
        } else {
          var left = Pets.plantRemainDays(pl, now);
          if (this.fertilizer > 0) {
            // 施肥：消耗 1 坨肥料，加速 1 天
            this.fertilizer--;
            pl.plantedAt -= 86400000;
            var left2 = Pets.plantRemainDays(pl, now);
            this.save();
            this.toastMsg('💩 施肥成功！' + Pets.plantLabel(pl.type) + ' 加速 1 天，还剩 ' + left2 + ' 天');
          } else {
            this.toastMsg(Pets.plantLabel(pl.type) + ' 还要 ' + left + ' 天成熟（铲屎得肥料可加速）');
          }
        }
        return;
      }
      if (!this.selectedSeed) {
        this.toastMsg('先点下面选一颗种子，再点空地播种');
        return;
      }
      if (this.seeds[this.selectedSeed] <= 0) {
        this.toastMsg('没有' + Pets.plantLabel(this.selectedSeed) + '种子了');
        return;
      }
      this.seeds[this.selectedSeed]--;
      this.yard[j] = { type: this.selectedSeed, plantedAt: now };
      this.save();
      this.toastMsg('种下了' + Pets.plantLabel(this.selectedSeed) + '！30 天后成熟');
      return;
    }
  };

  // 池塘点击：返回院子 / 领养鱼虾龟
  Game.prototype.pondHit = function (x, y) {
    if (x >= 20 && x <= 150 && y >= 40 && y <= 102) {
      this.screen = 'yard';
      return;
    }
    Pets.POND_ORDER.forEach(function (k, i) {
      var card = { x: 25 + i * 250, y: 1000, w: 220, h: 150 };
      if (inRect(x, y, card)) {
        if (this.pond.length >= 8) {
          this.toastMsg('池塘最多养 8 只');
          return;
        }
        this.pond.push({ species: k, createdAt: Date.now() });
        this.save();
        this.toastMsg('领养了一只' + Pets.pondLabel(k) + '！初始 100 克，每年涨 100 克');
      }
    }, this);
  };

  // 仓库点击：返回院子 / 加工成粮 / 添粮到碗
  Game.prototype.storeHit = function (x, y) {
    if (x >= 20 && x <= 150 && y >= 40 && y <= 102) {
      this.screen = 'yard';
      return;
    }
    // 全部加工成粮
    if (x >= 25 && x <= 365 && y >= 1050 && y <= 1140) {
      var total = 0, self = this;
      Pets.PLANT_ORDER.forEach(function (k) { total += self.store.crops[k] || 0; });
      if (total <= 0) { this.toastMsg('没有农产品，先去院子收获植物吧'); return; }
      Pets.PLANT_ORDER.forEach(function (k) { self.store.crops[k] = 0; });
      this.store.food += total;
      this.save();
      this.toastMsg('加工完成！' + total + ' 份农产品变成了 ' + total + ' 份粮');
      return;
    }
    // 粮碗添粮
    if (x >= 385 && x <= 725 && y >= 1050 && y <= 1140) {
      if (this.store.food <= 0) { this.toastMsg('仓库没粮了，先收获植物加工一些吧'); return; }
      if (this.bowls.food >= 100) { this.toastMsg('粮碗还是满的，让宠物先吃掉一些吧'); return; }
      this.store.food--;
      this.bowls.food = 100;
      this.save();
      this.toastMsg('用 1 份粮把粮碗添满啦');
      return;
    }
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

  // 猫砂盆命中：点击铲屎
  Game.prototype.litterAt = function (x, y) {
    var p = Render.project(LAYOUT.litter.fx, LAYOUT.litter.fz);
    var dx = x - p.x, dy = y - p.y;
    var r = 125 * p.sc;
    return dx * dx + dy * dy < r * r;
  };

  // 铲屎：清理干净并收集肥料（屎尿可加速植物生长）
  Game.prototype.scoopLitter = function () {
    if (this.litterDirt <= 0) {
      this.toastMsg('猫砂盆很干净，暂时不用铲');
      return;
    }
    var gain = Math.max(1, Math.floor(this.litterDirt / 20));
    this.litterDirt = 0;
    this.fertilizer += gain;
    this.save();
    this.toastMsg('铲屎完成！收获 ' + gain + ' 坨肥料（可在院子里施肥，1 坨加速 1 天）');
  };

  // ---------------- 后台：时间快进 ----------------
  Game.prototype.maxAgeDays = function () {
    var now = Date.now(), mx = 0;
    this.pets.forEach(function (p) {
      var d = Math.max(0, Math.floor((now - p.createdAt) / 86400000));
      if (d > mx) mx = d;
    });
    return mx;
  };

  // 快进时间（视为正常照料：宠物不饿死、体重随年龄涨、满一年公母自动生小猫）
  Game.prototype.advanceTime = function (ms) {
    var now = Date.now();
    var self = this;
    this.pets.forEach(function (p) { p.createdAt -= ms; });
    // 院子植物同步生长（快进后按成熟度推进）
    this.yard.forEach(function (pl) { if (pl) pl.plantedAt -= ms; });
    // 池塘水族同步生长（快进后重量同步增加）
    this.pond.forEach(function (p) { if (p) p.createdAt -= ms; });
    // 时间流逝一年，上次生产的冷却时间也同步过一年
    this.lastBreedAt = Math.max(0, this.lastBreedAt - ms);
    this.pets.forEach(function (p) {
      if (p.alive) p.nextLitterAt = now + Utils.rand(2, 8) * 3600 * 1000;
    });
    var cands = this.breedCandidates(now);
    var dayN = Math.round(ms / 86400000);
    if (cands.length) {
      this.toastMsg('快进 ' + dayN + ' 天！可去后台手动配对生小猫啦');
    } else {
      var st = this.breedStatus();
      this.toastMsg(st.length ? '没生小猫：' + st[0] : '时间快进 ' + dayN + ' 天，宠物们长大啦');
    }
    this.lastBreedCheck = now;
    this.rebuildNests();
    this.save();
    return cands.length > 0;
  };

  // 繁殖状态诊断：告诉玩家当前为什么能生 / 为什么还不能生
  Game.prototype.breedStatus = function () {
    var now = Date.now(), out = [];
    var groups = {};
    Pets.SPECIES_ORDER.forEach(function (sp) {
      groups[sp] = { m: 0, f: 0, mYoung: 0, fYoung: 0 };
    });
    this.pets.forEach(function (p) {
      if (!p.alive) return;
      var g = groups[p.species];
      if (!g) return;
      var age = now - p.createdAt;
      if (p.gender === 'male') { g.m++; if (!g.mYoung || age < g.mYoung) g.mYoung = age; }
      else if (p.gender === 'female') { g.f++; if (!g.fYoung || age < g.fYoung) g.fYoung = age; }
    });
    var coolDays = Math.floor((now - this.lastBreedAt) / 86400000);
    Pets.SPECIES_ORDER.forEach(function (sp) {
      var g = groups[sp], name = Pets.SPECIES[sp].short;
      if (!g.m && !g.f) return;
      if (!g.m || !g.f) { out.push(name + '：' + g.m + '公 ' + g.f + '母，需要一公一母'); return; }
      var bornAge = Math.min(g.mYoung, g.fYoung);
      var ageDays = Math.floor(bornAge / 86400000);
      var need = 365 - ageDays, coolNeed = 365 - coolDays;
      if (need > 0) out.push(name + '：年龄还差 ' + need + ' 天才满一年');
      else if (coolNeed > 0) out.push(name + '：上次生产后冷却还剩 ' + coolNeed + ' 天');
      else out.push(name + '：已满一年，可点"配对生育"手动配对');
    });
    return out;
  };

  // 手动配对的候选：满一年、同种一公一母、冷却已满的全部组合
  Game.prototype.breedCandidates = function (now) {
    var out = [], self = this;
    Pets.SPECIES_ORDER.forEach(function (sp) {
      var ms = [], fs = [];
      self.pets.forEach(function (p) {
        if (!p.alive || p.species !== sp) return;
        if (p.gender === 'male') ms.push(p);
        else if (p.gender === 'female') fs.push(p);
      });
      ms.forEach(function (m) {
        fs.forEach(function (f) {
          var born = Math.min(m.createdAt, f.createdAt);
          if (now - born < 365 * 86400000) return;
          if (now - self.lastBreedAt < 365 * 86400000) return;
          out.push({ m: m, f: f, sp: sp });
        });
      });
    });
    return out;
  };

  // 手动配对弹窗：列出所有可用配对，点一组生一窝
  Game.prototype.openBreed = function () {
    var self = this;
    var cands = this.breedCandidates(Date.now());
    var many = cands.length > 8;
    if (many) cands = cands.slice(0, 8);
    var lines = ['满一年的公母可以手动配对，点一组就生一窝'];
    if (!cands.length) lines.push('暂无可用配对（原因请看上方诊断）');
    else if (many) lines.push('配对较多，已显示前 8 组');
    var rows = [];
    for (var i = 0; i < cands.length; i++) {
      (function (pair) {
        rows.push([
          {
            label: pair.m.name.slice(0, 4) + '♂ × ' + pair.f.name.slice(0, 4) + '♀',
            onTap: function () {
              self.doBreed(pair, Date.now());
              self.lastBreedCheck = Date.now();
              self.save();
            }
          }
        ]);
      })(cands[i]);
    }
    this.modal = {
      title: '配对生育',
      lines: lines,
      rows: rows,
      buttons: [
        { label: '返回', style: 'ghost', onTap: function () { self.openAdmin(); } }
      ]
    };
  };

  Game.prototype.openAdmin = function () {
    var self = this;
    var days = this.maxAgeDays();
    var st = this.breedStatus();
    var lines = [
      '年龄最大的宠物：' + days + ' 天',
      '快进=正常照料，体重会涨，满一年公母生小猫'
    ];
    for (var i = 0; i < st.length; i++) lines.push(st[i]);
    if (!st.length) lines.push('还没有宠物，先领养一只吧');
    this.modal = {
      title: '后台 · 时间快进',
      lines: lines,
      rows: [
        [
          { label: '+1 天', onTap: function () { self.advanceTime(86400000); self.openAdmin(); } },
          { label: '+7 天', onTap: function () { self.advanceTime(7 * 86400000); self.openAdmin(); } }
        ],
        [
          { label: '+30 天', onTap: function () { self.advanceTime(30 * 86400000); self.openAdmin(); } },
          { label: '+365 天', onTap: function () { self.advanceTime(365 * 86400000); self.openAdmin(); } }
        ],
        [
          { label: '配对生育', onTap: function () { self.openBreed(); } },
          { label: '关闭', style: 'ghost', onTap: function () { self.closeModal(); } }
        ]
      ]
    };
  };

  // ---------------- 房间面板（最多 3 个房间） ----------------
  Game.prototype.openRooms = function () {
    if (!this.rooms) { this.toastMsg('当前是单房间模式'); return; }
    this.modal = null;
    this.screen = 'rooms';
  };

  Game.prototype.roomsHit = function (x, y) {
    var self = this;
    var back = { x: 20, y: 40, w: 130, h: 62 };
    if (inRect(x, y, back)) { this.screen = 'main'; return; }
    for (var i = 0; i < 3; i++) {
      var info = this.rooms.roomInfo(i);
      var r = Render.roomsRects(info);
      for (var b = 0; b < r.buttons.length; b++) {
        var btn = r.buttons[b];
        if (!inRect(x, y, btn)) continue;
        if (btn.id === 'enter') {
          // 进入已有房间
          this.rooms.enter(i);
          var g1 = this.rooms.currentGame();
          g1.screen = 'main';
          g1.toastMsg('已进入房间 ' + (i + 1));
        } else if (btn.id === 'reset') {
          this.confirmResetRoom(i);
        } else if (btn.id === 'new') {
          // 开新房间 = 不重置重养：进新房间的选宠界面，其它房间保留
          this.rooms.enter(i);
          var g2 = this.rooms.currentGame();
          g2.screen = 'setup';
          g2.toastMsg('房间 ' + (i + 1) + ' 开好了，选一只宠物开始养吧');
        }
        return;
      }
    }
  };

  Game.prototype.confirmResetRoom = function (i) {
    var self = this;
    this.modal = {
      title: '重置房间 ' + (i + 1) + '？',
      lines: ['该房间的宠物会被清空，回到选宠界面', '其它房间不受影响，可以放心重置'],
      rows: [[
        { label: '取消', style: 'ghost', onTap: function () { self.closeModal(); } },
        { label: '确认重置', style: 'primary', onTap: function () { self.doResetRoom(i); } }
      ]]
    };
  };

  Game.prototype.doResetRoom = function (i) {
    var g = this.rooms && this.rooms.games ? this.rooms.games[i] : null;
    if (g) g.resetRoom();
    else this.P.removeStorage(ROOM_KEYS[i] || ROOM_KEYS[0]);
    this.closeModal();
    this.screen = 'rooms';
    this.toastMsg('房间 ' + (i + 1) + ' 已重置，可以重新养啦');
  };

  // 设置界面
  Game.prototype.setupHit = function (x, y) {
    var s = this.setup;
    var self = this;
    var order = Pets.SPECIES_ORDER;
    // 多房间模式下可返回房间面板
    if (this.rooms && x <= 160 && y <= 110) { this.screen = 'rooms'; return; }
    for (var i = 0; i < order.length; i++) {
      var sp = order[i];
      var spInfo = Pets.SPECIES[sp];
      var card = Render.setupCardRect(i);
      var box = Render.setupNameBoxRect(i);
      if (inRect(x, y, box)) {
        if (!s.picked[sp]) { this.toastMsg('先点卡片选择养' + spInfo.label + '吧'); return; }
        (function (sp2) {
          self.P.textInput({ title: '给' + Pets.SPECIES[sp2].label + '起个名字', defaultValue: s.names[sp2], maxLength: 8 }, function (val) {
            if (val) s.names[sp2] = val;
          });
        })(sp);
        return;
      }
      if (inRect(x, y, card)) {
        var aliveCount = 0;
        for (var k = 0; k < order.length; k++) if (s.picked[order[k]]) aliveCount++;
        if (s.picked[sp] && aliveCount === 1) { this.toastMsg('至少养一只宠物哦'); return; }
        s.picked[sp] = !s.picked[sp];
        return;
      }
    }
    if (inRect(x, y, s.startBtn)) {
      this.pressedId = 'setup_start';
      this.startGame();
    }
  };

  Game.prototype.startGame = function () {
    var s = this.setup;
    this.pets = [];
    var order = Pets.SPECIES_ORDER;
    for (var i = 0; i < order.length; i++) {
      var sp = order[i];
      if (s.picked[sp]) {
        this.pets.push(Pets.createBuiltIn(sp, (s.names[sp] || '').trim() || Pets.SPECIES[sp].label));
      }
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
    for (var i = 0; i < a.genderBtns.length; i++) {
      if (inRect(x, y, a.genderBtns[i])) { a.gender = a.genderBtns[i].value; return; }
    }
    for (var i = 0; i < a.speciesBtns.length; i++) {
      if (inRect(x, y, a.speciesBtns[i])) {
        var sp = a.speciesBtns[i].value;
        if (a.photo) { a.species = sp; return; }      // 有照片：选择照片伙伴的物种
        this.adoptBuiltIn(sp); return;                // 没照片：直接领养一只内置宠物
      }
    }
    if (inRect(x, y, a.confirmBtn)) {
      this.pressedId = 'addpet_ok';
      this.confirmAdd();
      return;
    }
  };

  // 快捷领养一只内置宠物（六种物种）
  Game.prototype.adoptBuiltIn = function (species) {
    var self = this;
    if (this.pets.length >= MAX_PETS) { this.toastMsg('小屋已经住满啦'); return; }
    var spInfo = Pets.SPECIES[species] || Pets.SPECIES.cat;
    var def = '新' + spInfo.label;
    this.P.textInput({ title: '给' + spInfo.label + '起个名字', defaultValue: def, maxLength: 8 }, function (val) {
      var name = (val || '').trim() || def;
      var pet = Pets.createBuiltIn(species, name);
      if (self.addpet.gender) pet.gender = self.addpet.gender;   // 领养时手动选的性别
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
    if (!a.species) { this.toastMsg('请选择照片伙伴的物种（必选）'); return; }
    if (this.pets.length >= MAX_PETS) { this.toastMsg('小屋已经住满啦'); return; }
    var name = (a.name || '').trim() || '我的宠物';
    var pet = Pets.createFromPhoto(name, a.species, a.photo.dataURL, a.photo.colors);
    pet.avatar.texture = a.photo.texture;
    if (a.gender) pet.gender = a.gender;              // 领养时手动选的性别
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
    } else if (this.screen === 'rooms') {
      Render.drawRooms(ctx, this);
    } else if (this.screen === 'yard') {
      Render.drawYard(ctx, this);
    } else if (this.screen === 'pond') {
      Render.drawPond(ctx, this);
    } else if (this.screen === 'store') {
      Render.drawStore(ctx, this);
    } else {
      this.renderMain(ctx);
    }
    if (this.modal) Render.drawModal(ctx, this.modal);
    Render.drawToast(ctx, this.toast);
    if (this.screen === 'main') Render.drawAdminGear(ctx);
  };

  Game.prototype.renderMain = function (ctx) {
    var t = this.time / 1000;
    Render.drawRoom(ctx, t);

    // 碗（存量：0 空碗 ~ 100 满碗）
    var f = Render.project(LAYOUT.food.fx, LAYOUT.food.fz);
    Render.drawBowl(ctx, f.x, f.y, f.sc, 'food', this.bowls.food);
    var w = Render.project(LAYOUT.water.fx, LAYOUT.water.fz);
    Render.drawBowl(ctx, w.x, w.y, w.sc, 'water', this.bowls.water);
    // 猫砂盆（带脏度：铲屎玩法）
    Render.drawLitter(ctx, t, this.litterDirt);

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
        Render.drawPet(ctx, pet, t, pet.id === this.selectedId, this.time, this.petLiftActive && pet.id === this.petLiftId);
      }
    }

    Render.drawParticles(ctx, this);

    // 顶部状态卡（≤5 单行 / >5 两行，始终完整显示在游戏区域内）
    this.chipScroll = Utils.clamp(this.chipScroll, 0, this.chipMax());
    var L = this.chipLayout();
    for (var c = 0; c < this.pets.length; c++) {
      var rr = L.single ? 0 : Math.floor(c / L.perRow);
      var col = c - rr * L.perRow;
      var cy = rr === 0 ? LAYOUT.chipY : L.y2;
      var cx = LAYOUT.chipX0 + col * (L.cw + LAYOUT.chipGap);
      Render.drawChip(ctx, this.pets[c], cx, cy, L.cw, L.ch, this.pets[c].id === this.selectedId, t);
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

  Game.roomKeys = ROOM_KEYS;

  return Game;
});
