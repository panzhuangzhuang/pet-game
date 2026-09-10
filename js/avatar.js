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
    if (pet.species === 'cat') Avatar.drawCat(ctx, pet, pose, opts);
    else if (pet.species === 'dog') Avatar.drawDog(ctx, pet, pose, opts);
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
    } else {
      ctx.fillStyle = col.dark;
      Utils.ell(ctx, hx - hr * 0.8, hy - hr * 0.35, hr * 0.14, hr * 0.14);
      Utils.ell(ctx, hx + hr * 0.8, hy - hr * 0.35, hr * 0.14, hr * 0.14);
    }
  }

  return Avatar;
});
