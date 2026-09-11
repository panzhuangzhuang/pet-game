/**
 * pets.js — 宠物数据模型与核心逻辑（纯逻辑，不依赖画布）
 * 真实时间机制：饱食度/渴度/精力按现实时间流逝衰减；
 * 连续 3 天（72 小时）不喂食且不喝水 → 宠物死亡，只剩墓碑。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Pets = factory(root.PG.Utils);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils) {
  'use strict';

  var H = 3600 * 1000;                 // 1 小时毫秒数
  // 三项状态均按 3 天（72 小时）从 100% 衰减到 0%
  var HUNGER_FULL_H = 72;              // 饱食度 3 天耗尽
  var THIRST_FULL_H = 72;              // 渴度 3 天耗尽
  var ENERGY_FULL_H = 72;              // 精力 3 天耗尽
  var CARE_DECAY_PER_H = 5;            // 抚摸加成每小时衰减
  var CARE_MAX = 60;
  var CARE_PER_PET = 8;                // 每抚摸一次 +8

  var Pets = {
    H: H,
    HUNGER_FULL_H: HUNGER_FULL_H,
    THIRST_FULL_H: THIRST_FULL_H,
    ENERGY_FULL_H: ENERGY_FULL_H
  };

  Pets.SPECIES = {
    cat: {
      label: '小猫', short: '猫', baby: '小猫', desc: '一只黏人的小猫咪',
      colors: { body: '#f2a03d', stripe: '#cf7f26', belly: '#ffe8c9', ear: '#f7b35c', earIn: '#f5b9c4' }
    },
    dog: {
      label: '小狗', short: '狗', baby: '小狗', desc: '一只活泼的小狗狗',
      colors: { body: '#c9935f', stripe: '#a06f3e', belly: '#f4e2c8', ear: '#a06f3e', earIn: '#e8b49c' }
    },
    pig: {
      label: '小猪', short: '猪', baby: '猪崽', desc: '一只粉嫩的小猪猪',
      colors: { body: '#f7a8b8', stripe: '#ef8ba0', belly: '#fde6ec', ear: '#f493a7', earIn: '#f9c6d2' }
    },
    cow: {
      label: '小牛', short: '牛', baby: '牛犊', desc: '一只哞哞的小奶牛',
      colors: { body: '#f2ece2', stripe: '#6e5a4a', belly: '#fbf5ec', ear: '#c79a6b', earIn: '#ecd9c2' }
    },
    sheep: {
      label: '小羊', short: '羊', baby: '羊羔', desc: '一只软软的小绵羊',
      colors: { body: '#efe9df', stripe: '#d9d0c0', belly: '#faf6ef', ear: '#e0d6c6', earIn: '#f0e8dc' }
    },
    chick: {
      label: '小鸡', short: '鸡', baby: '鸡仔', desc: '一只叽叽的小鸡仔',
      colors: { body: '#ffd94d', stripe: '#f0b72e', belly: '#fff2bd', ear: '#ffcf3f', earIn: '#ffe89a' }
    }
  };
  Pets.SPECIES_ORDER = ['cat', 'dog', 'pig', 'cow', 'sheep', 'chick'];
  Pets.speciesLabel = function (sp) {
    return (Pets.SPECIES[sp] && Pets.SPECIES[sp].label) || '照片伙伴';
  };

  // ---------- 院子植物（六种，成熟 30 天） ----------
  Pets.PLANTS = {
    orchid:      { label: '蝴蝶兰', emoji: '🌸', leaf: '#4fae6b', flower: '#c77bff', days: 30 },
    corn:        { label: '玉米',   emoji: '🌽', leaf: '#5caf4f', flower: '#ffc93c', days: 30 },
    peach:       { label: '桃子',   emoji: '🍑', leaf: '#4fae6b', flower: '#ff8f6b', days: 30 },
    peanut:      { label: '花生',   emoji: '🥜', leaf: '#5caf4f', flower: '#d9a066', days: 30 },
    watermelon:  { label: '西瓜',   emoji: '🍉', leaf: '#3f9e4f', flower: '#5ecf6a', days: 30 },
    banana:      { label: '香蕉',   emoji: '🍌', leaf: '#4a9e3f', flower: '#ffe14d', days: 30 }
  };
  Pets.PLANT_ORDER = ['orchid', 'corn', 'peach', 'peanut', 'watermelon', 'banana'];
  Pets.plantLabel = function (key) {
    return (Pets.PLANTS[key] && Pets.PLANTS[key].label) || '植物';
  };
  // 植物成熟度 0~1（按真实时间/快进时间计算）
  Pets.plantGrowth = function (pl, now) {
    if (!pl || !pl.plantedAt) return 0;
    var def = Pets.PLANTS[pl.type];
    var days = (def && def.days) || 30;
    return Math.max(0, Math.min(1, (now - pl.plantedAt) / (days * 86400000)));
  };
  Pets.plantMature = function (pl, now) {
    return Pets.plantGrowth(pl, now) >= 1;
  };
  Pets.plantRemainDays = function (pl, now) {
    if (!pl) return 0;
    var def = Pets.PLANTS[pl.type];
    var days = (def && def.days) || 30;
    var remain = days - (now - pl.plantedAt) / 86400000;
    return Math.max(0, Math.ceil(remain));
  };

  // ---------- 池塘（鱼 / 虾 / 乌龟，初始 100g，每年涨 100g） ----------
  Pets.POND = {
    fish:   { label: '鱼',   emoji: '🐟', color: '#4aa3df' },
    shrimp: { label: '虾',   emoji: '🦐', color: '#e8845a' },
    turtle: { label: '乌龟', emoji: '🐢', color: '#5ea052' }
  };
  Pets.POND_ORDER = ['fish', 'shrimp', 'turtle'];
  Pets.pondLabel = function (key) {
    return (Pets.POND[key] && Pets.POND[key].label) || '水族';
  };
  // 重量（克）：初始 100g，每年涨 100g，按天均摊
  Pets.pondWeight = function (p, now) {
    now = now || Utils.now();
    var days = Math.max(0, (now - (p.createdAt || now)) / 86400000);
    return 100 + days / 365 * 100;
  };
  // 体型因子：100g → 1.0，越重越大
  Pets.pondScale = function (p, now) {
    var w = Pets.pondWeight(p, now);
    return Utils.clamp(0.6 + w / 100 * 0.4, 0.6, 2.4);
  };

  function freshBeh() {
    return { state: 'idle', t: 0, tx: 0, tz: 0, pending: null, manual: false };
  }

  function freshBody(x, z) {
    var now = Utils.now();
    return {
      createdAt: now,
      lastFedAt: now,
      lastWateredAt: now,
      lastPettedAt: 0,
      hunger: 100, thirst: 100, energy: 100, careBoost: 0,
      alive: true, diedAt: 0,
      x: x, z: z, facing: 1, eatSide: Math.random() < 0.5 ? 1 : -1,
      beh: freshBeh(),
      // 第四轮：性别（随机）、基础体重（斤）、下次如厕时间（真实时间戳）
      gender: Math.random() < 0.5 ? 'male' : 'female',
      baseWeight: 3,
      nextLitterAt: now + Utils.rand(2, 8) * H
    };
  }

  Pets.createBuiltIn = function (species, name) {
    var sp = Pets.SPECIES[species] || Pets.SPECIES.cat;
    var pet = freshBody(Utils.rand(0.25, 0.75), Utils.rand(0.35, 0.75));
    pet.id = Utils.makeId('pet');
    pet.name = (name && String(name).trim()) || sp.label;
    pet.species = species;
    pet.avatar = { type: 'builtin', style: species, colors: sp.colors, texture: null };
    return pet;
  };

  Pets.createFromPhoto = function (name, species, dataURL, colors) {
    var now = Utils.now();
    var pet = freshBody(Utils.rand(0.25, 0.75), Utils.rand(0.35, 0.75));
    pet.id = Utils.makeId('pet');
    pet.name = (name && String(name).trim()) || '我的宠物';
    pet.species = Pets.SPECIES[species] ? species : 'custom';
    pet.avatar = {
      type: 'photo',
      dataURL: dataURL,
      colors: colors,
      ears: Pets.SPECIES[species] ? species : 'round',
      texture: null
    };
    return pet;
  };

  // 按真实时间衰减（dtMs 可以是离线时长）
  Pets.update = function (pet, dtMs) {
    if (!pet.alive) return;
    var h = dtMs / H;
    pet.hunger = Math.max(0, pet.hunger - h * (100 / HUNGER_FULL_H));
    pet.thirst = Math.max(0, pet.thirst - h * (100 / THIRST_FULL_H));
    pet.energy = Math.max(0, pet.energy - h * (100 / ENERGY_FULL_H));
    pet.careBoost = Math.max(0, pet.careBoost - h * CARE_DECAY_PER_H);
  };

  // 死亡判定：粮 / 水 / 精力 任意一项降到 0% 即死亡
  Pets.checkDeath = function (pet, now) {
    if (!pet.alive) return false;
    if (pet.hunger <= 0 || pet.thirst <= 0 || pet.energy <= 0) {
      pet.alive = false;
      pet.diedAt = now;
      pet.hunger = Math.max(0, pet.hunger);
      pet.thirst = Math.max(0, pet.thirst);
      pet.energy = Math.max(0, pet.energy);
      return true;
    }
    return false;
  };

  // 死亡原因（用于墓碑 / 弹窗文案）
  Pets.deathReason = function (pet) {
    if (!pet.alive) {
      if (pet.hunger <= 0) return '饥饿';
      if (pet.thirst <= 0) return '干渴';
      if (pet.energy <= 0) return '过度疲惫';
    }
    return '';
  };

  Pets.feed = function (pet, now) { pet.lastFedAt = now; pet.hunger = 100; };
  Pets.water = function (pet, now) { pet.lastWateredAt = now; pet.thirst = 100; };
  Pets.petCare = function (pet, now) {
    pet.lastPettedAt = now;
    pet.careBoost = Math.min(CARE_MAX, pet.careBoost + CARE_PER_PET);
  };

  // 综合心情 0-100
  Pets.happiness = function (pet) {
    if (!pet.alive) return 0;
    return Utils.clamp(30 + pet.hunger * 0.25 + pet.thirst * 0.25 + pet.energy * 0.15 + pet.careBoost, 0, 100);
  };

  // ---- 性别与体重（第四轮）----
  // 初始 3 斤（新生 1 斤），每年涨 3 斤，按天均摊；体重随真实年龄增长
  Pets.weightKg = function (pet, now) {
    now = now || Utils.now();
    var days = Math.max(0, (now - (pet.createdAt || now)) / 86400000);
    var base = (pet.baseWeight == null) ? 3 : pet.baseWeight;
    return base + days / 365 * 3;
  };

  // 体型因子：3 斤 → 1.0（基准），越重越大
  Pets.weightFactor = function (pet, now) {
    var w = Pets.weightKg(pet, now);
    return Utils.clamp(0.75 + w / 12, 0.72, 1.6);
  };

  Pets.genderLabel = function (pet) {
    return pet.gender === 'female' ? '♀ 母' : '♂ 公';
  };

  Pets.pee = function (pet) { pet.thirst = Math.max(0, pet.thirst - 10); };
  Pets.poop = function (pet) { pet.hunger = Math.max(0, pet.hunger - 10); };

  // 情绪标签：happy / neutral / sad / sleepy / dead
  Pets.mood = function (pet) {
    if (!pet.alive) return 'dead';
    if (pet.hunger < 20 || pet.thirst < 20) return 'sad';
    if (pet.energy < 15) return 'sleepy';
    var h = Pets.happiness(pet);
    if (h >= 70) return 'happy';
    if (h >= 40) return 'neutral';
    return 'sad';
  };

  // 当前缺少的东西
  Pets.needs = function (pet) {
    var n = [];
    if (!pet.alive) return n;
    if (pet.hunger < 35) n.push('food');
    if (pet.thirst < 35) n.push('water');
    if (pet.energy < 25) n.push('rest');
    return n;
  };

  Pets.toJSON = function (pet) {
    return {
      id: pet.id, name: pet.name, species: pet.species, avatar: pet.avatar,
      createdAt: pet.createdAt, lastFedAt: pet.lastFedAt, lastWateredAt: pet.lastWateredAt,
      lastPettedAt: pet.lastPettedAt,
      hunger: pet.hunger, thirst: pet.thirst, energy: pet.energy, careBoost: pet.careBoost,
      alive: pet.alive, diedAt: pet.diedAt,
      x: pet.x, z: pet.z, facing: pet.facing, eatSide: pet.eatSide,
      beh: pet.beh,
      gender: pet.gender, baseWeight: pet.baseWeight, nextLitterAt: pet.nextLitterAt,
      born: pet.born
    };
  };

  Pets.fromJSON = function (obj) {
    var p = obj;
    if (!p.beh) p.beh = freshBeh();
    // 头像防御：缺失/损坏时回退为内置外观（避免渲染中断）
    if (!p.avatar || !p.avatar.type) {
      var sp = Pets.SPECIES[p.species] || Pets.SPECIES.cat;
      p.avatar = { type: 'builtin', style: p.species, colors: sp.colors, texture: null };
    }
    if (p.avatar && p.avatar.type === 'photo') p.avatar.texture = null;
    // 旧存档兼容
    if (!p.gender) p.gender = Math.random() < 0.5 ? 'male' : 'female';
    if (p.baseWeight == null) p.baseWeight = 3;
    if (!p.nextLitterAt) p.nextLitterAt = Utils.now() + Utils.rand(2, 8) * H;
    if (p.born == null) p.born = false;   // 是否繁殖出生（出生宠物可卖 10 金币）
    return p;
  };

  return Pets;
});
