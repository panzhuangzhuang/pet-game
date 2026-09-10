/**
 * avatar.js — 宠物形象绘制（Canvas 2D 伪 3D）
 * 内置：小猫 / 小狗（程序化绘制，多种姿态）
 * 照片宠物：照片贴图方块身体 + 小脑袋的"3D 形象"
 * pose: idle | walk | eat | drink | sleep | happy | sad
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Avatar = factory(root.PG.Utils);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils) {
  'use strict';

  var Avatar = {};

  // 统一入口
  // opts: { x, y(脚底), s(整体高度px), t(时间s), pose, facing(1|-1) }
  Avatar.draw = function (ctx, pet, opts) {
    var pose = opts.pose || 'idle';
    if (pet.avatar && pet.avatar.type === 'photo') Avatar.drawPhoto(ctx, pet, pose, opts);
    else if (pet.species === 'cat') Avatar.drawCat(ctx, pet, pose, opts);
    else if (pet.species === 'dog') Avatar.drawDog(ctx, pet, pose, opts);
    else if (pet.species === 'pig') Avatar.drawPig(ctx, pet, pose, opts);
    else if (pet.species === 'cow') Avatar.drawCow(ctx, pet, pose, opts);
    else if (pet.species === 'sheep') Avatar.drawSheep(ctx, pet, pose, opts);
    else if (pet.species === 'chick') Avatar.drawChick(ctx, pet, pose, opts);
    else Avatar.drawPhoto(ctx, pet, pose, opts);
  };

  // 状态条 / 选卡小头像
  Avatar.drawIcon = function (ctx, pet, cx, cy, s) {
    var opts = { x: cx, y: cy + s * 0.42, s: s, t: 0, pose: 'idle', facing: 1 };
    Avatar.draw(ctx, pet, opts);
  };

  // ---------- 通用脸部 ----------
  function drawEyes(ctx, hx, hy, hr, pose, t, sc) {
    var eyeR = hr * 0.16;
    var off = hr * 0.42;
    ctx.fillStyle = '#3a2a1e';
    if (pose === 'happy') {
      // 弯弯的笑眼
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = hr * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hx - off, hy - hr * 0.05, eyeR * 0.9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + off, hy - hr * 0.05, eyeR * 0.9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (pose === 'sleep') {
      // 闭眼弧线
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = hr * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hx - off, hy, eyeR, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + off, hy, eyeR, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (pose === 'sad') {
      // 低垂眼睛 + 眼泪
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = hr * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hx - off, hy + hr * 0.12, eyeR * 0.8, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + off, hy + hr * 0.12, eyeR * 0.8, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      // 眼泪
      ctx.fillStyle = '#8ec9f0';
      ctx.beginPath();
      ctx.arc(hx - off - hr * 0.12, hy + hr * 0.5, hr * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 正常圆眼（带高光），眨眼
      var blink = (Math.sin(t * 1.7 + hx) > 0.985);
      ctx.beginPath();
      ctx.ellipse(hx - off, hy, eyeR * (blink ? 0.1 : 1), eyeR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx + off, hy, eyeR * (blink ? 0.1 : 1), eyeR, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx - off - eyeR * 0.3, hy - eyeR * 0.3, eyeR * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx + off - eyeR * 0.3, hy - eyeR * 0.3, eyeR * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawNoseMouth(ctx, hx, hy, hr, sc, catLike, pose) {
    var ny = hy + hr * 0.28;
    ctx.fillStyle = '#6b4a35';
    if (catLike) {
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.09, ny);
      ctx.lineTo(hx + hr * 0.09, ny);
      ctx.lineTo(hx, ny + hr * 0.11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b4a35';
      ctx.lineWidth = hr * 0.05;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, ny + hr * 0.11);
      ctx.quadraticCurveTo(hx - hr * 0.09, ny + hr * 0.22, hx - hr * 0.16, ny + hr * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx, ny + hr * 0.11);
      ctx.quadraticCurveTo(hx + hr * 0.09, ny + hr * 0.22, hx + hr * 0.16, ny + hr * 0.12);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(hx, ny, hr * 0.09, hr * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a35';
      ctx.lineWidth = hr * 0.05;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (pose === 'happy') {
        ctx.arc(hx, ny + hr * 0.05, hr * 0.13, Math.PI * 0.15, Math.PI * 0.85);
      } else {
        ctx.moveTo(hx - hr * 0.1, ny + hr * 0.08);
        ctx.quadraticCurveTo(hx, ny + hr * 0.2, hx + hr * 0.1, ny + hr * 0.08);
      }
      ctx.stroke();
    }
  }

  // ---------- 小猫 ----------
  function catEars(ctx, col, hx, hy, hr, droop, sc) {
    ctx.fillStyle = col.body;
    var droopX = droop ? hr * 0.22 : 0;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.82, hy - hr * 0.35);
    ctx.lineTo(hx - hr * 0.55, hy - hr * 1.05);
    ctx.lineTo(hx - hr * 0.05, hy - hr * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.82 + droopX, hy - hr * 0.35);
    ctx.lineTo(hx + hr * 0.55 + droopX, hy - hr * 1.05);
    ctx.lineTo(hx + hr * 0.05 + droopX, hy - hr * 0.62);
    ctx.closePath();
    ctx.fill();
    // 内耳
    ctx.fillStyle = col.earIn;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.72, hy - hr * 0.44);
    ctx.lineTo(hx - hr * 0.58, hy - hr * 0.86);
    ctx.lineTo(hx - hr * 0.28, hy - hr * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.72 + droopX, hy - hr * 0.44);
    ctx.lineTo(hx + hr * 0.58 + droopX, hy - hr * 0.86);
    ctx.lineTo(hx + hr * 0.28 + droopX, hy - hr * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  Avatar.drawCat = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 13) * 4 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 28 * sc : 0;
    var bodyY = cy - 26 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    // 尾巴
    var wag = (pose === 'happy' || pose === 'walk') ? Math.sin(t * 10) * 0.55
      : pose === 'sad' ? 0.35 : Math.sin(t * 2) * 0.12;
    var tailDrop = pose === 'sad' ? 16 * sc : (sleeping ? 14 * sc : 0);
    ctx.strokeStyle = col.body;
    ctx.lineWidth = 9 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30 * sc, 6 * sc);
    ctx.quadraticCurveTo(
      -52 * sc, -12 * sc + tailDrop,
      -44 * sc - wag * 16 * sc, -36 * sc + tailDrop
    );
    ctx.stroke();

    if (sleeping) {
      // 趴着睡：压扁的身体 + 脑袋贴地
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 0, 4 * sc, 62 * sc, 24 * sc);
      ctx.fillStyle = col.belly;
      Utils.ell(ctx, 0, 6 * sc, 40 * sc, 16 * sc);
      // 脑袋
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 34 * sc, 2 * sc, 36 * sc, 30 * sc);
      catEars(ctx, col, 34 * sc, 2 * sc, 30 * sc, false, sc);
      drawEyes(ctx, 34 * sc, 0, 30 * sc, 'sleep', t, sc);
      drawNoseMouth(ctx, 34 * sc, 0, 30 * sc, sc, true, pose);
      ctx.restore();
      return;
    }

    // 身体
    var eating = pose === 'eat' || pose === 'drink';
    var bodyRx = 48 * sc, bodyRy = 40 * sc;
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 10 * sc, bodyRx, bodyRy);
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, 13 * sc, bodyRx * 0.6, bodyRy * 0.72);
    // 花纹
    ctx.fillStyle = col.stripe;
    for (var i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.45;
      Utils.ell(ctx, -22 * sc + i * 22 * sc, 2 * sc, 4.5 * sc, 11 * sc);
    }
    ctx.globalAlpha = 1;
    // 前爪
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, -14 * sc, 40 * sc, 9 * sc, 7 * sc);
    Utils.ell(ctx, 14 * sc, 40 * sc, 9 * sc, 7 * sc);

    // 头
    var headY = eating ? -22 * sc : -46 * sc;
    var headR = 34 * sc;
    var headBob = pose === 'walk' ? Math.sin(t * 13) * 2 * sc : 0;
    headY += headBob;
    var droop = pose === 'sad';
    catEars(ctx, col, 0, headY, headR, droop, sc);
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, headY, headR, headR);
    // 脸颊
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, -headR * 0.72, headY + headR * 0.25, headR * 0.22, headR * 0.16);
    Utils.ell(ctx, headR * 0.72, headY + headR * 0.25, headR * 0.22, headR * 0.16);
    drawEyes(ctx, 0, headY, headR, pose, t, sc);
    drawNoseMouth(ctx, 0, headY, headR, sc, true, pose);
    // 胡须
    if (pose !== 'sleep') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.6 * sc;
      ctx.lineCap = 'round';
      for (var w = 0; w < 2; w++) {
        var dir = w === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(dir * headR * 0.95, headY + headR * 0.1);
        ctx.quadraticCurveTo(dir * headR * 1.45, headY + headR * 0.16, dir * headR * 1.5, headY + headR * 0.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dir * headR * 0.95, headY + headR * 0.3);
        ctx.quadraticCurveTo(dir * headR * 1.5, headY + headR * 0.4, dir * headR * 1.42, headY + headR * 0.62);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // ---------- 小狗 ----------
  Avatar.drawDog = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 12) * 4 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 26 * sc : 0;
    var bodyY = cy - 30 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    // 尾巴（小短尾，欢快地摇）
    var wag = pose === 'happy' || pose === 'walk' ? Math.sin(t * 12) : Math.sin(t * 2.5) * 0.3;
    ctx.fillStyle = col.body;
    ctx.save();
    ctx.translate(-40 * sc, -10 * sc);
    ctx.rotate(wag * 0.6);
    Utils.ell(ctx, 0, 0, 10 * sc, 16 * sc);
    ctx.restore();

    if (sleeping) {
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 0, 6 * sc, 66 * sc, 26 * sc);
      ctx.fillStyle = col.belly;
      Utils.ell(ctx, 0, 8 * sc, 42 * sc, 17 * sc);
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 40 * sc, 4 * sc, 38 * sc, 32 * sc);
      // 垂耳
      ctx.fillStyle = col.ear;
      Utils.ell(ctx, 22 * sc, -2 * sc, 12 * sc, 26 * sc);
      Utils.ell(ctx, 58 * sc, -2 * sc, 12 * sc, 26 * sc);
      drawEyes(ctx, 40 * sc, 0, 32 * sc, 'sleep', t, sc);
      drawNoseMouth(ctx, 40 * sc, 0, 32 * sc, sc, false, pose);
      ctx.restore();
      return;
    }

    // 身体
    var eating = pose === 'eat' || pose === 'drink';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 12 * sc, 56 * sc, 44 * sc);
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, 16 * sc, 34 * sc, 30 * sc);
    // 背部斑点
    ctx.fillStyle = col.stripe;
    ctx.globalAlpha = 0.5;
    Utils.ell(ctx, -16 * sc, 2 * sc, 9 * sc, 8 * sc);
    Utils.ell(ctx, 14 * sc, 0, 7 * sc, 7 * sc);
    ctx.globalAlpha = 1;
    // 前爪
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, -18 * sc, 46 * sc, 10 * sc, 8 * sc);
    Utils.ell(ctx, 18 * sc, 46 * sc, 10 * sc, 8 * sc);

    // 头
    var headY = eating ? -26 * sc : -56 * sc;
    var headR = 40 * sc;
    headY += pose === 'walk' ? Math.sin(t * 12) * 2 * sc : 0;
    var droop = pose === 'sad';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, headY, headR, headR * 0.94);
    // 垂耳
    ctx.fillStyle = col.ear;
    var earDrop = droop ? 10 * sc : 0;
    Utils.ell(ctx, -headR * 0.78, headY + headR * 0.28 + earDrop * 0.6, headR * 0.26, headR * 0.55 + earDrop);
    Utils.ell(ctx, headR * 0.78, headY + headR * 0.28 + earDrop * 0.6, headR * 0.26, headR * 0.55 + earDrop);
    // 嘴部浅色
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, headY + headR * 0.45, headR * 0.52, headR * 0.36);
    drawEyes(ctx, 0, headY - headR * 0.05, headR * 0.9, pose, t, sc);
    drawNoseMouth(ctx, 0, headY - headR * 0.05, headR * 0.9, sc, false, pose);
    // 开心吐舌头
    if (pose === 'happy') {
      ctx.fillStyle = '#f28ba0';
      ctx.beginPath();
      ctx.moveTo(0, headY + headR * 0.5);
      ctx.quadraticCurveTo(0, headY + headR * 0.72, 8 * sc, headY + headR * 0.7);
      ctx.quadraticCurveTo(2 * sc, headY + headR * 0.55, 0, headY + headR * 0.5);
      ctx.fill();
    }
    ctx.restore();
  };

  // ---------- 小猪 ----------
  function pigEars(ctx, col, hx, hy, hr, sc) {
    ctx.fillStyle = col.body;
    Utils.ell(ctx, hx - hr * 0.72, hy - hr * 0.6, hr * 0.2, hr * 0.17);
    Utils.ell(ctx, hx + hr * 0.72, hy - hr * 0.6, hr * 0.2, hr * 0.17);
    ctx.fillStyle = col.earIn;
    Utils.ell(ctx, hx - hr * 0.72, hy - hr * 0.6, hr * 0.1, hr * 0.08);
    Utils.ell(ctx, hx + hr * 0.72, hy - hr * 0.6, hr * 0.1, hr * 0.08);
  }
  function pigSnout(ctx, col, hx, hy, hr, sc) {
    // 大圆鼻子 + 两个鼻孔
    ctx.fillStyle = col.ear;
    Utils.ell(ctx, hx, hy + hr * 0.42, hr * 0.3, hr * 0.22);
    ctx.fillStyle = '#b96a7e';
    Utils.ell(ctx, hx - hr * 0.1, hy + hr * 0.42, hr * 0.05, hr * 0.06);
    Utils.ell(ctx, hx + hr * 0.1, hy + hr * 0.42, hr * 0.05, hr * 0.06);
  }
  Avatar.drawPig = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 12) * 4 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 28 * sc : 0;
    var bodyY = cy - 26 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    // 卷卷的小尾巴
    var tw = pose === 'happy' || pose === 'walk' ? Math.sin(t * 8) * 0.3 : 0;
    ctx.strokeStyle = col.body;
    ctx.lineWidth = 5 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-32 * sc, 0);
    ctx.quadraticCurveTo(-46 * sc, -10 * sc, -40 * sc, -20 * sc + tw * 6 * sc);
    ctx.quadraticCurveTo(-34 * sc, -26 * sc, -28 * sc, -20 * sc + tw * 8 * sc);
    ctx.stroke();

    if (sleeping) {
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 0, 6 * sc, 64 * sc, 26 * sc);
      ctx.fillStyle = col.belly;
      Utils.ell(ctx, 0, 8 * sc, 42 * sc, 17 * sc);
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 38 * sc, 4 * sc, 36 * sc, 30 * sc);
      pigEars(ctx, col, 38 * sc, 2 * sc, 30 * sc, sc);
      drawEyes(ctx, 38 * sc, 0, 30 * sc, 'sleep', t, sc);
      pigSnout(ctx, col, 38 * sc, -2 * sc, 30 * sc, sc);
      ctx.restore();
      return;
    }

    // 身体
    var eating = pose === 'eat' || pose === 'drink';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 12 * sc, 52 * sc, 42 * sc);
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, 16 * sc, 34 * sc, 28 * sc);
    // 前爪
    ctx.fillStyle = col.ear;
    Utils.ell(ctx, -15 * sc, 42 * sc, 9 * sc, 7 * sc);
    Utils.ell(ctx, 15 * sc, 42 * sc, 9 * sc, 7 * sc);

    // 头
    var headY = eating ? -22 * sc : -48 * sc;
    var headR = 34 * sc;
    headY += pose === 'walk' ? Math.sin(t * 12) * 2 * sc : 0;
    pigEars(ctx, col, 0, headY, headR, sc);
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, headY, headR, headR * 0.98);
    drawEyes(ctx, 0, headY - headR * 0.06, headR * 0.94, pose, t, sc);
    pigSnout(ctx, col, 0, headY, headR, sc);
    // 嘴
    ctx.strokeStyle = '#b96a7e';
    ctx.lineWidth = 2.4 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.12, headY + headR * 0.64);
    ctx.quadraticCurveTo(0, headY + headR * 0.76, headR * 0.12, headY + headR * 0.64);
    ctx.stroke();
    ctx.restore();
  };

  // ---------- 小牛 ----------
  function cowHorns(ctx, col, hx, hy, hr, sc) {
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.78, hy - hr * 0.28);
    ctx.lineTo(hx - hr * 0.62, hy - hr * 0.95);
    ctx.lineTo(hx - hr * 0.42, hy - hr * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.78, hy - hr * 0.28);
    ctx.lineTo(hx + hr * 0.62, hy - hr * 0.95);
    ctx.lineTo(hx + hr * 0.42, hy - hr * 0.45);
    ctx.closePath();
    ctx.fill();
    // 圆耳
    ctx.fillStyle = col.ear;
    Utils.ell(ctx, hx - hr * 0.68, hy + hr * 0.02, hr * 0.16, hr * 0.12);
    Utils.ell(ctx, hx + hr * 0.68, hy + hr * 0.02, hr * 0.16, hr * 0.12);
  }
  Avatar.drawCow = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 11) * 4 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 26 * sc : 0;
    var bodyY = cy - 28 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    // 细尾巴 + 毛簇
    var sw = pose === 'happy' || pose === 'walk' ? Math.sin(t * 9) * 0.4 : 0;
    ctx.strokeStyle = col.body;
    ctx.lineWidth = 4 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-34 * sc, 2 * sc);
    ctx.quadraticCurveTo(-48 * sc, -6 * sc, -46 * sc, -20 * sc);
    ctx.stroke();
    ctx.fillStyle = col.stripe;
    Utils.ell(ctx, -46 * sc + sw * 6 * sc, -24 * sc, 5 * sc, 8 * sc);

    if (sleeping) {
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 0, 6 * sc, 66 * sc, 27 * sc);
      ctx.fillStyle = col.belly;
      Utils.ell(ctx, 0, 8 * sc, 44 * sc, 18 * sc);
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 40 * sc, 4 * sc, 38 * sc, 31 * sc);
      cowHorns(ctx, col, 40 * sc, 2 * sc, 31 * sc, sc);
      drawEyes(ctx, 40 * sc, 0, 31 * sc, 'sleep', t, sc);
      ctx.fillStyle = col.ear;
      Utils.ell(ctx, 40 * sc, 12 * sc, 9 * sc, 6 * sc);
      ctx.restore();
      return;
    }

    // 身体（白底黑斑）
    var eating = pose === 'eat' || pose === 'drink';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 13 * sc, 56 * sc, 44 * sc);
    ctx.fillStyle = col.stripe;
    ctx.globalAlpha = 0.85;
    Utils.ell(ctx, -18 * sc, 4 * sc, 11 * sc, 10 * sc);
    Utils.ell(ctx, 14 * sc, 0, 8 * sc, 8 * sc);
    Utils.ell(ctx, 2 * sc, 22 * sc, 10 * sc, 8 * sc);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, 18 * sc, 30 * sc, 24 * sc);
    // 前爪
    ctx.fillStyle = '#d8c6ae';
    Utils.ell(ctx, -18 * sc, 46 * sc, 10 * sc, 8 * sc);
    Utils.ell(ctx, 18 * sc, 46 * sc, 10 * sc, 8 * sc);

    // 头
    var headY = eating ? -26 * sc : -56 * sc;
    var headR = 38 * sc;
    headY += pose === 'walk' ? Math.sin(t * 11) * 2 * sc : 0;
    cowHorns(ctx, col, 0, headY, headR, sc);
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, headY, headR, headR * 0.95);
    // 额前花纹
    ctx.fillStyle = col.stripe;
    ctx.globalAlpha = 0.7;
    Utils.ell(ctx, 0, headY - headR * 0.12, headR * 0.22, headR * 0.18);
    ctx.globalAlpha = 1;
    // 嘴部浅色
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, headY + headR * 0.42, headR * 0.5, headR * 0.34);
    drawEyes(ctx, 0, headY - headR * 0.05, headR * 0.92, pose, t, sc);
    // 圆鼻
    ctx.fillStyle = '#b98a96';
    Utils.ell(ctx, 0, headY + headR * 0.34, headR * 0.13, headR * 0.1);
    ctx.strokeStyle = '#b98a96';
    ctx.lineWidth = 2.2 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.14, headY + headR * 0.55);
    ctx.quadraticCurveTo(0, headY + headR * 0.68, headR * 0.14, headY + headR * 0.55);
    ctx.stroke();
    ctx.restore();
  };

  // ---------- 小羊 ----------
  function sheepWool(ctx, col, x, y, r, n, sc) {
    ctx.fillStyle = col.stripe;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      Utils.ell(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.8, r * 0.5, r * 0.42);
    }
  }
  Avatar.drawSheep = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 12) * 3 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 24 * sc : 0;
    var bodyY = cy - 24 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    if (sleeping) {
      // 一坨卷毛球
      ctx.fillStyle = col.stripe;
      Utils.ell(ctx, 0, 6 * sc, 70 * sc, 30 * sc);
      sheepWool(ctx, col, 0, 6 * sc, 26 * sc, 8, sc);
      ctx.fillStyle = '#7a6a5a';
      Utils.ell(ctx, 40 * sc, 4 * sc, 32 * sc, 26 * sc);
      ctx.fillStyle = col.ear;
      Utils.ell(ctx, 30 * sc, 0, 6 * sc, 12 * sc);
      Utils.ell(ctx, 50 * sc, 0, 6 * sc, 12 * sc);
      drawEyes(ctx, 40 * sc, 0, 28 * sc, 'sleep', t, sc);
      ctx.restore();
      return;
    }

    // 卷毛身体
    var eating = pose === 'eat' || pose === 'drink';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 12 * sc, 54 * sc, 40 * sc);
    sheepWool(ctx, col, 0, 10 * sc, 24 * sc, 9, sc);
    // 四条小腿
    ctx.fillStyle = '#6a5c4e';
    Utils.ell(ctx, -20 * sc, 42 * sc, 6 * sc, 10 * sc);
    Utils.ell(ctx, -8 * sc, 42 * sc, 6 * sc, 10 * sc);
    Utils.ell(ctx, 8 * sc, 42 * sc, 6 * sc, 10 * sc);
    Utils.ell(ctx, 20 * sc, 42 * sc, 6 * sc, 10 * sc);

    // 头（深色脸）
    var headY = eating ? -20 * sc : -46 * sc;
    var headR = 30 * sc;
    headY += pose === 'walk' ? Math.sin(t * 12) * 2 * sc : 0;
    // 头上一团卷毛
    ctx.fillStyle = col.stripe;
    Utils.ell(ctx, 0, headY - headR * 0.75, headR * 0.5, headR * 0.4);
    Utils.ell(ctx, -headR * 0.4, headY - headR * 0.55, headR * 0.32, headR * 0.26);
    Utils.ell(ctx, headR * 0.4, headY - headR * 0.55, headR * 0.32, headR * 0.26);
    // 垂耳
    ctx.fillStyle = col.ear;
    Utils.ell(ctx, -headR * 0.8, headY + headR * 0.1, headR * 0.18, headR * 0.34);
    Utils.ell(ctx, headR * 0.8, headY + headR * 0.1, headR * 0.18, headR * 0.34);
    // 脸
    ctx.fillStyle = '#7a6a5a';
    Utils.ell(ctx, 0, headY, headR, headR * 0.96);
    drawEyes(ctx, 0, headY - headR * 0.05, headR * 0.9, pose, t, sc);
    // 圆鼻
    ctx.fillStyle = '#c9a0b0';
    Utils.ell(ctx, 0, headY + headR * 0.36, headR * 0.1, headR * 0.08);
    ctx.strokeStyle = '#c9a0b0';
    ctx.lineWidth = 2.2 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.12, headY + headR * 0.52);
    ctx.quadraticCurveTo(0, headY + headR * 0.64, headR * 0.12, headY + headR * 0.52);
    ctx.stroke();
    ctx.restore();
  };

  // ---------- 小鸡 ----------
  function chickComb(ctx, hx, hy, hr, sc) {
    ctx.fillStyle = '#ef4f5f';
    ctx.beginPath();
    var teeth = 3;
    var w = hr * 0.4;
    var step = w / teeth;
    ctx.moveTo(hx - w / 2, hy - hr * 0.15);
    for (var i = 0; i <= teeth; i++) {
      var x = hx - w / 2 + i * step;
      ctx.quadraticCurveTo(x - step * 0.18, hy - hr * 0.52, x, hy - hr * 0.15);
    }
    ctx.closePath();
    ctx.fill();
  }
  Avatar.drawChick = function (ctx, pet, pose, opts) {
    var col = pet.avatar.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 14) * 5 * sc
      : pose === 'idle' ? Math.sin(t * 2.4) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 9)) * 26 * sc : 0;
    var bodyY = cy - 30 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    // 尾羽
    ctx.fillStyle = col.stripe;
    ctx.beginPath();
    ctx.moveTo(-30 * sc, -4 * sc);
    ctx.lineTo(-48 * sc, -18 * sc);
    ctx.lineTo(-36 * sc, 2 * sc);
    ctx.closePath();
    ctx.fill();

    if (sleeping) {
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 0, 8 * sc, 56 * sc, 26 * sc);
      ctx.fillStyle = col.body;
      Utils.ell(ctx, 40 * sc, 4 * sc, 34 * sc, 28 * sc);
      chickComb(ctx, 40 * sc, 2 * sc, 28 * sc, sc);
      drawEyes(ctx, 40 * sc, 0, 28 * sc, 'sleep', t, sc);
      ctx.fillStyle = '#ef4f5f';
      ctx.beginPath();
      ctx.moveTo(52 * sc, 8 * sc);
      ctx.lineTo(62 * sc, 14 * sc);
      ctx.lineTo(50 * sc, 16 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    // 身体（蛋形）
    var eating = pose === 'eat' || pose === 'drink';
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, 10 * sc, 46 * sc, 40 * sc);
    ctx.fillStyle = col.belly;
    Utils.ell(ctx, 0, 16 * sc, 30 * sc, 24 * sc);
    // 翅膀
    var flap = pose === 'happy' || pose === 'walk' ? Math.sin(t * 10) * 5 * sc : 0;
    ctx.fillStyle = col.stripe;
    Utils.ell(ctx, -30 * sc, 4 * sc, 14 * sc, 10 * sc + flap * 0.4);
    Utils.ell(ctx, 30 * sc, 4 * sc, 14 * sc, 10 * sc - flap * 0.4);
    // 脚
    ctx.strokeStyle = '#e8932e';
    ctx.lineWidth = 4 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10 * sc, 48 * sc);
    ctx.lineTo(-10 * sc, 58 * sc);
    ctx.moveTo(-16 * sc, 62 * sc);
    ctx.lineTo(-10 * sc, 58 * sc);
    ctx.lineTo(-4 * sc, 62 * sc);
    ctx.moveTo(10 * sc, 48 * sc);
    ctx.lineTo(10 * sc, 58 * sc);
    ctx.moveTo(4 * sc, 62 * sc);
    ctx.lineTo(10 * sc, 58 * sc);
    ctx.lineTo(16 * sc, 62 * sc);
    ctx.stroke();

    // 头
    var headY = eating ? -16 * sc : -42 * sc;
    var headR = 30 * sc;
    headY += pose === 'walk' ? Math.sin(t * 14) * 2 * sc : 0;
    ctx.fillStyle = col.body;
    Utils.ell(ctx, 0, headY, headR, headR * 0.96);
    chickComb(ctx, 0, headY, headR, sc);
    // 脸颊红
    ctx.fillStyle = 'rgba(239,79,95,0.4)';
    Utils.ell(ctx, -headR * 0.62, headY + headR * 0.22, headR * 0.14, headR * 0.1);
    Utils.ell(ctx, headR * 0.62, headY + headR * 0.22, headR * 0.14, headR * 0.1);
    drawEyes(ctx, 0, headY - headR * 0.05, headR * 0.92, pose, t, sc);
    // 尖嘴
    ctx.fillStyle = '#ef4f5f';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.16, headY + headR * 0.28);
    ctx.lineTo(headR * 0.16, headY + headR * 0.28);
    ctx.lineTo(0, headY + headR * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // ---------- 照片 3D 方块伙伴 ----------
  Avatar.drawPhoto = function (ctx, pet, pose, opts) {
    var cfg = pet.avatar;
    var col = cfg.colors;
    var s = opts.s;
    var sc = s / 190;
    var cx = opts.x;
    var cy = opts.y;
    var t = opts.t || 0;
    var facing = opts.facing || 1;

    var bob = pose === 'walk' ? Math.sin(t * 13) * 4 * sc
      : pose === 'idle' ? Math.sin(t * 2.2) * 2 * sc : 0;
    var jump = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * 26 * sc : 0;
    var bodyY = cy - 20 * sc - bob + jump;
    var sleeping = pose === 'sleep';

    ctx.save();
    ctx.translate(cx, bodyY);
    if (facing < 0) ctx.scale(-1, 1);

    var bw = 88 * sc, bh = 76 * sc;
    var baseY = 0;

    if (sleeping) {
      // 睡着：方块放倒 + 闭眼脑袋
      ctx.save();
      ctx.rotate(-0.18);
      // 放倒的身体
      ctx.fillStyle = col.dark;
      Utils.roundRect(ctx, -bw * 0.55, -20 * sc, bw, 34 * sc, 8 * sc, col.main);
      ctx.fillStyle = col.main;
      Utils.roundRect(ctx, -bw * 0.55, -20 * sc, bw, 34 * sc, 8 * sc, col.main);
      ctx.restore();
      ctx.fillStyle = col.head;
      Utils.ell(ctx, 52 * sc, -14 * sc, 34 * sc, 28 * sc);
      drawEars(ctx, cfg, 52 * sc, -14 * sc, 30 * sc, sc);
      drawEyes(ctx, 52 * sc, -16 * sc, 30 * sc, 'sleep', t, sc);
      ctx.restore();
      return;
    }

    // ---- 3D 方块身体 ----
    var l = -bw / 2, top = baseY - bh;
    // 顶面
    ctx.fillStyle = col.light;
    ctx.beginPath();
    ctx.moveTo(l, top);
    ctx.lineTo(l + bw, top);
    ctx.lineTo(l + bw + bw * 0.2, top - bw * 0.2);
    ctx.lineTo(l + bw * 0.2, top - bw * 0.2);
    ctx.closePath();
    ctx.fill();
    // 右侧面
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.moveTo(l + bw, top);
    ctx.lineTo(l + bw + bw * 0.2, top - bw * 0.2);
    ctx.lineTo(l + bw + bw * 0.2, baseY - bw * 0.2);
    ctx.lineTo(l + bw, baseY);
    ctx.closePath();
    ctx.fill();
    // 正面（照片贴图）
    ctx.save();
    Utils.roundRectPath(ctx, l, top, bw, bh, 10 * sc);
    ctx.clip();
    if (cfg.texture) {
      ctx.drawImage(cfg.texture, l, top, bw, bh);
      // 轻微高光
      var grd = ctx.createLinearGradient(0, top, 0, baseY);
      grd.addColorStop(0, 'rgba(255,255,255,0.22)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = grd;
      ctx.fillRect(l, top, bw, bh);
    } else {
      ctx.fillStyle = col.main;
      ctx.fillRect(l, top, bw, bh);
      // 加载中纹理
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (var i = 0; i < 3; i++) {
        ctx.fillRect(l + 12 * sc + i * 26 * sc, top + bh * 0.4, 12 * sc, 12 * sc);
      }
    }
    ctx.restore();
    ctx.strokeStyle = Utils.darken(col.main, 0.25);
    ctx.lineWidth = 2.5 * sc;
    Utils.roundRectPath(ctx, l, top, bw, bh, 10 * sc);
    ctx.stroke();

    // 小短腿
    var step = pose === 'walk' ? Math.sin(t * 13) * 6 * sc : 0;
    ctx.fillStyle = col.dark;
    Utils.roundRect(ctx, -bw * 0.42, baseY - 12 * sc + step, 14 * sc, 12 * sc, 3 * sc, col.dark);
    Utils.roundRect(ctx, bw * 0.42 - 14 * sc, baseY - 12 * sc - step, 14 * sc, 12 * sc, 3 * sc, col.dark);

    // ---- 脑袋 ----
    var headR = 36 * sc;
    var headY = top - headR * 0.55;
    var eating = pose === 'eat' || pose === 'drink';
    if (eating) headY += 22 * sc;
    drawEars(ctx, cfg, 0, headY, headR, sc);
    ctx.fillStyle = col.head;
    Utils.ell(ctx, 0, headY, headR, headR * 0.96);
    drawEyes(ctx, 0, headY - headR * 0.05, headR * 0.92, pose, t, sc);
    drawNoseMouth(ctx, 0, headY - headR * 0.05, headR * 0.92, sc, false, pose);

    ctx.restore();
  };

  function drawEars(ctx, cfg, hx, hy, hr, sc) {
    var col = cfg.colors;
    if (cfg.ears === 'cat') {
      ctx.fillStyle = col.head;
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.8, hy - hr * 0.3);
      ctx.lineTo(hx - hr * 0.5, hy - hr * 1.0);
      ctx.lineTo(hx - hr * 0.02, hy - hr * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.8, hy - hr * 0.3);
      ctx.lineTo(hx + hr * 0.5, hy - hr * 1.0);
      ctx.lineTo(hx + hr * 0.02, hy - hr * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = Utils.lighten(col.head, 0.25);
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.7, hy - hr * 0.38);
      ctx.lineTo(hx - hr * 0.53, hy - hr * 0.8);
      ctx.lineTo(hx - hr * 0.26, hy - hr * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.7, hy - hr * 0.38);
      ctx.lineTo(hx + hr * 0.53, hy - hr * 0.8);
      ctx.lineTo(hx + hr * 0.26, hy - hr * 0.52);
      ctx.closePath();
      ctx.fill();
    } else if (cfg.ears === 'dog') {
      ctx.fillStyle = col.dark;
      Utils.ell(ctx, hx - hr * 0.78, hy + hr * 0.3, hr * 0.26, hr * 0.55);
      Utils.ell(ctx, hx + hr * 0.78, hy + hr * 0.3, hr * 0.26, hr * 0.55);
    } else if (cfg.ears === 'pig') {
      ctx.fillStyle = col.head;
      Utils.ell(ctx, hx - hr * 0.72, hy - hr * 0.55, hr * 0.2, hr * 0.16);
      Utils.ell(ctx, hx + hr * 0.72, hy - hr * 0.55, hr * 0.2, hr * 0.16);
      ctx.fillStyle = Utils.lighten(col.head, 0.25);
      Utils.ell(ctx, hx - hr * 0.72, hy - hr * 0.55, hr * 0.1, hr * 0.07);
      Utils.ell(ctx, hx + hr * 0.72, hy - hr * 0.55, hr * 0.1, hr * 0.07);
    } else if (cfg.ears === 'cow') {
      ctx.fillStyle = '#e8dcc8';
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.78, hy - hr * 0.25);
      ctx.lineTo(hx - hr * 0.62, hy - hr * 0.92);
      ctx.lineTo(hx - hr * 0.42, hy - hr * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.78, hy - hr * 0.25);
      ctx.lineTo(hx + hr * 0.62, hy - hr * 0.92);
      ctx.lineTo(hx + hr * 0.42, hy - hr * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col.dark;
      Utils.ell(ctx, hx - hr * 0.68, hy + hr * 0.05, hr * 0.15, hr * 0.11);
      Utils.ell(ctx, hx + hr * 0.68, hy + hr * 0.05, hr * 0.15, hr * 0.11);
    } else if (cfg.ears === 'sheep') {
      ctx.fillStyle = col.dark;
      Utils.ell(ctx, hx - hr * 0.78, hy + hr * 0.12, hr * 0.18, hr * 0.32);
      Utils.ell(ctx, hx + hr * 0.78, hy + hr * 0.12, hr * 0.18, hr * 0.32);
      ctx.fillStyle = col.light;
      Utils.ell(ctx, hx - hr * 0.78, hy + hr * 0.12, hr * 0.09, hr * 0.16);
      Utils.ell(ctx, hx + hr * 0.78, hy + hr * 0.12, hr * 0.09, hr * 0.16);
    } else if (cfg.ears === 'chick') {
      ctx.fillStyle = '#ef4f5f';
      ctx.beginPath();
      var teeth = 3, w2 = hr * 0.42, step = w2 / teeth;
      ctx.moveTo(hx - w2 / 2, hy - hr * 0.1);
      for (var k = 0; k <= teeth; k++) {
        var x2 = hx - w2 / 2 + k * step;
        ctx.quadraticCurveTo(x2 - step * 0.18, hy - hr * 0.5, x2, hy - hr * 0.1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(239,79,95,0.4)';
      Utils.ell(ctx, hx - hr * 0.6, hy + hr * 0.25, hr * 0.14, hr * 0.1);
      Utils.ell(ctx, hx + hr * 0.6, hy + hr * 0.25, hr * 0.14, hr * 0.1);
    } else {
      ctx.fillStyle = col.dark;
      Utils.ell(ctx, hx - hr * 0.8, hy - hr * 0.35, hr * 0.14, hr * 0.14);
      Utils.ell(ctx, hx + hr * 0.8, hy - hr * 0.35, hr * 0.14, hr * 0.14);
    }
  }

  return Avatar;
});
