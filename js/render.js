/**
 * render.js — 场景渲染（Canvas 2D 伪 3D 小屋）
 * 负责：小屋（后墙/地板/窗户/挂画/地毯）、水碗粮碗、宠物与墓碑、
 *       顶部状态卡、底部操作栏、设置/领养界面、弹窗与气泡。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'), require('./avatar.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Render = factory(root.PG.Utils, root.PG.Avatar);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils, Avatar) {
  'use strict';

  var W = 750, H = 1334;

  var LAYOUT = {
    W: W, H: H,
    chipY: 44, chipH: 154, chipW: 216, chipGap: 12, chipX0: 20, chipScrollMax: 0,
    wallTop: 200,
    backWall: { x: 50, y: 200, w: 650, h: 360 },
    floorTop: 560, floorBottom: 1172,
    food: { fx: 0.30, fz: 0.60 },
    water: { fx: 0.70, fz: 0.68 },
    litter: { fx: 0.86, fz: 0.28 },
    barTop: 1202, barH: 132,
    buttons: [
      { id: 'feed', x: 16, y: 1218, w: 118, h: 96, label: '喂食' },
      { id: 'water', x: 138, y: 1218, w: 118, h: 96, label: '喝水' },
      { id: 'rest', x: 260, y: 1218, w: 118, h: 96, label: '休息' },
      { id: 'add', x: 382, y: 1218, w: 118, h: 96, label: '添加' },
      { id: 'shop', x: 504, y: 1218, w: 118, h: 96, label: '商店' },
      { id: 'help', x: 626, y: 1218, w: 108, h: 96, label: '帮助' }
    ]
  };

  // 地板坐标 -> 屏幕坐标
  function project(fx, fz) {
    var x = 50 + fx * 650;
    var y = 560 + fz * 612;
    var sc = 0.45 + fz * 0.55;
    return { x: x, y: y, sc: sc };
  }

  // ---------- 小屋 ----------
  function drawRoom(ctx, t) {
    // 整体背景
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff6e6');
    bg.addColorStop(1, '#ffe9cf');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 后墙
    ctx.fillStyle = '#f6e3c2';
    ctx.fillRect(LAYOUT.backWall.x, LAYOUT.backWall.y, LAYOUT.backWall.w, LAYOUT.backWall.h);
    // 墙纸顶部腰线（浅色圆点装饰带）
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(LAYOUT.backWall.x, LAYOUT.backWall.y, LAYOUT.backWall.w, 16);
    ctx.fillStyle = 'rgba(180,120,70,0.18)';
    for (var wxx = LAYOUT.backWall.x + 12; wxx < LAYOUT.backWall.x + LAYOUT.backWall.w - 8; wxx += 30) {
      Utils.ell(ctx, wxx, LAYOUT.backWall.y + 8, 4, 4);
    }
    // 墙纸条纹
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (var x = LAYOUT.backWall.x + 40; x < LAYOUT.backWall.x + LAYOUT.backWall.w; x += 80) {
      ctx.fillRect(x, LAYOUT.backWall.y, 26, LAYOUT.backWall.h);
    }
    // 踢脚线
    ctx.fillStyle = '#d9b98c';
    ctx.fillRect(LAYOUT.backWall.x, LAYOUT.backWall.y + LAYOUT.backWall.h - 14, LAYOUT.backWall.w, 14);

    // 窗户
    var wx = 150, wy = 250, ww = 190, wh = 180;
    Utils.roundRect(ctx, wx - 10, wy - 10, ww + 20, wh + 20, 10, '#ffffff', '#c9a86a');
    var sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#a8dcf5');
    sky.addColorStop(1, '#e3f4fd');
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);
    // 太阳
    ctx.fillStyle = '#ffd76a';
    Utils.ell(ctx, wx + ww - 34, wy + 34, 20, 20);
    // 云
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    Utils.ell(ctx, wx + 50, wy + 52, 30, 14);
    Utils.ell(ctx, wx + 80, wy + 46, 22, 12);
    // 窗框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

    // 挂画
    var px = 505, py = 265, pw = 130, ph = 110;
    Utils.roundRect(ctx, px - 8, py - 8, pw + 16, ph + 16, 8, '#8a5a33');
    ctx.fillStyle = '#fdf6e8';
    ctx.fillRect(px, py, pw, ph);
    // 画里的风景
    ctx.fillStyle = '#a8dcf5';
    ctx.fillRect(px, py, pw, 40);
    ctx.fillStyle = '#7cc576';
    ctx.beginPath();
    ctx.moveTo(px, py + 70); ctx.quadraticCurveTo(px + pw / 2, py + 30, px + pw, py + 70);
    ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    Utils.ell(ctx, px + 100, py + 24, 12, 12);
    // 相框玻璃斜反光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 12);
    ctx.lineTo(px + 44, py + 12);
    ctx.lineTo(px + 22, py + ph - 12);
    ctx.lineTo(px + 9, py + ph - 12);
    ctx.closePath();
    ctx.fill();

    // 院子门（窗户与挂画之间，点击可进入院子）
    var dx = 360, dy = 245, dw = 100, dh = 225;
    // 门框
    Utils.roundRect(ctx, dx - 8, dy - 8, dw + 16, dh + 16, 8, '#8a5a33');
    // 门板
    var doorG = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    doorG.addColorStop(0, '#a06a3a');
    doorG.addColorStop(1, '#c68a52');
    ctx.fillStyle = doorG;
    Utils.roundRect(ctx, dx, dy, dw, dh, 5);
    // 门板木纹
    ctx.strokeStyle = 'rgba(90,50,10,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx + dw / 2, dy); ctx.lineTo(dx + dw / 2, dy + dh);
    ctx.stroke();
    // 门把手
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(dx + dw - 22, dy + dh / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    // 门上方小牌
    Utils.roundRect(ctx, dx + 8, dy - 30, dw - 16, 26, 6, '#f6e3c2', '#c9a86a');
    Utils.drawText(ctx, '院子', dx + dw / 2, dy - 13, { size: 16, weight: 'bold', color: '#8a5a33' });

    // 地板（梯形透视）
    var floorG = ctx.createLinearGradient(0, LAYOUT.floorTop, 0, LAYOUT.floorBottom);
    floorG.addColorStop(0, '#eec98f');
    floorG.addColorStop(1, '#d9a75f');
    ctx.fillStyle = floorG;
    ctx.beginPath();
    ctx.moveTo(LAYOUT.backWall.x, LAYOUT.floorTop);
    ctx.lineTo(LAYOUT.backWall.x + LAYOUT.backWall.w, LAYOUT.floorTop);
    ctx.lineTo(792, LAYOUT.floorBottom);
    ctx.lineTo(-42, LAYOUT.floorBottom);
    ctx.closePath();
    ctx.fill();
    // 木纹线
    ctx.strokeStyle = 'rgba(120,70,20,0.14)';
    ctx.lineWidth = 2;
    for (var i = 1; i <= 6; i++) {
      var fy = LAYOUT.floorTop + (LAYOUT.floorBottom - LAYOUT.floorTop) * Math.pow(i / 7, 1.4);
      ctx.beginPath();
      ctx.moveTo(50 + (fy - LAYOUT.floorTop) * 0.12, fy);
      ctx.lineTo(700 - (fy - LAYOUT.floorTop) * 0.12, fy);
      ctx.stroke();
    }
    // 纵向木纹
    ctx.strokeStyle = 'rgba(120,70,20,0.10)';
    for (var j = 0; j < 9; j++) {
      var fx = 50 + j * 81;
      ctx.beginPath();
      ctx.moveTo(fx, LAYOUT.floorTop + 10);
      ctx.lineTo(fx + (LAYOUT.floorBottom - LAYOUT.floorTop) * 0.16, LAYOUT.floorBottom);
      ctx.stroke();
    }

    // 地毯
    ctx.fillStyle = 'rgba(224,154,114,0.85)';
    Utils.ell(ctx, 375, 760, 270, 150);
    ctx.fillStyle = 'rgba(201,127,90,0.9)';
    Utils.ell(ctx, 375, 760, 226, 122);
    ctx.fillStyle = 'rgba(240,196,162,0.8)';
    Utils.ell(ctx, 375, 760, 120, 62);
    // 地毯花边（一圈小圆点）
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var da = 0; da < 26; da++) {
      var an2 = da / 26 * Math.PI * 2;
      Utils.ell(ctx, 375 + Math.cos(an2) * 240, 760 + Math.sin(an2) * 128, 5, 5);
    }

    // 角落绿植（左）
    ctx.fillStyle = '#b0703a';
    ctx.beginPath();
    ctx.moveTo(76, 540); ctx.lineTo(106, 540); ctx.lineTo(98, 506); ctx.lineTo(84, 506);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7cc576';
    Utils.ell(ctx, 82, 498, 16, 22);
    Utils.ell(ctx, 102, 494, 16, 26);
    Utils.ell(ctx, 92, 484, 14, 22);
    // 角落绿植（右）
    ctx.fillStyle = '#b0703a';
    ctx.beginPath();
    ctx.moveTo(648, 540); ctx.lineTo(678, 540); ctx.lineTo(670, 506); ctx.lineTo(656, 506);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5cb86b';
    Utils.ell(ctx, 654, 498, 16, 22);
    Utils.ell(ctx, 674, 494, 16, 26);
    Utils.ell(ctx, 664, 484, 14, 22);
    ctx.fillStyle = '#7cc576';
    Utils.ell(ctx, 658, 486, 12, 18);
    Utils.ell(ctx, 670, 484, 12, 18);

    // 窗户阳光光斑（叠加在墙与地板上，随窗位置投下）
    ctx.fillStyle = 'rgba(255,224,130,0.14)';
    ctx.beginPath();
    ctx.moveTo(wx + 8, wy + wh);
    ctx.lineTo(wx + ww - 8, wy + wh);
    ctx.lineTo(wx + ww + 70, wy + wh + 165);
    ctx.lineTo(wx + 8, wy + wh + 165);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- 碗（level: 0 空碗 ~ 100 满碗） ----------
  function drawBowl(ctx, sx, sy, sc, kind, level) {
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    Utils.ell(ctx, sx + 5 * sc, sy + 6 * sc, 66 * sc, 15 * sc);
    // 碗底垫
    ctx.fillStyle = 'rgba(217,185,140,0.5)';
    Utils.ell(ctx, sx, sy + 3 * sc, 70 * sc, 18 * sc);

    var tr = 52 * sc, br = 26 * sc, topY = sy - 42 * sc;
    var side = ctx.createLinearGradient(0, topY, 0, sy);
    if (kind === 'food') {
      side.addColorStop(0, '#e3a265');
      side.addColorStop(1, '#b97a3c');
    } else {
      side.addColorStop(0, '#5aa4d8');
      side.addColorStop(1, '#3671ab');
    }
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(sx - tr, topY);
    ctx.lineTo(sx + tr, topY);
    ctx.lineTo(sx + br, sy);
    ctx.lineTo(sx - br, sy);
    ctx.closePath();
    ctx.fill();

    // 碗口
    var rim = kind === 'food' ? '#e8b47c' : '#6db3e2';
    ctx.fillStyle = rim;
    Utils.ell(ctx, sx, topY, tr, 20 * sc);
    // 碗内（空碗显示深色碗底；有存量按比例显示）
    var lvl = (level == null ? 100 : Math.max(0, Math.min(100, level))) / 100;
    ctx.fillStyle = kind === 'food' ? '#a9743f' : '#7ec8e3';
    Utils.ell(ctx, sx, topY + 2 * sc, tr - 8 * sc, 16 * sc);
    if (lvl > 0 && kind === 'food') {
      // 粮粒数量随存量变化
      var grains = Math.ceil(7 * lvl);
      ctx.fillStyle = '#7a4f26';
      for (var i = 0; i < grains; i++) {
        var a = i * 0.9 + 0.4;
        var r = (i % 3) * 7 * sc;
        Utils.ell(ctx, sx + Math.cos(a) * r - 8 * sc, topY + 3 * sc + Math.sin(a) * 5 * sc, 5 * sc, 3.4 * sc);
        Utils.ell(ctx, sx + Math.cos(a + 0.6) * r + 6 * sc, topY + 4 * sc + Math.sin(a + 0.6) * 4 * sc, 4.4 * sc, 3 * sc);
      }
    } else if (lvl > 0 && kind === 'water') {
      // 水面高度随存量
      var waterY = topY + 2 * sc + (1 - lvl) * 12 * sc;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      Utils.ell(ctx, sx - 12 * sc, waterY - 3 * sc, 12 * sc, 4.5 * sc);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, waterY, (tr - 8 * sc) * (0.4 + lvl * 0.6), 6 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 碗口描边
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, topY, tr, 20 * sc, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // 标签（空碗时提示可点击添粮/水）
    var label = kind === 'food' ? '粮碗' : '水碗';
    if (lvl <= 0) label += '（点我添' + (kind === 'food' ? '粮' : '水') + '）';
    Utils.drawText(ctx, label, sx, sy + 34 * sc, { size: 20 * Math.max(0.8, sc), color: lvl > 0 ? '#8a6a45' : '#d0806a' });
  }

  // ---------- 宠物窝（六种物种，圆顶/三角顶 + 物种配色） ----------
  var NEST_STYLE = {
    cat:   { top: '#efa6b3', base: '#f6c3c9', mouth: '#fbd9dd', inner: '#d97f8c', roof: 'round', tag: -42 },
    dog:   { top: '#a06f3e', base: '#cfa776', mouth: '#e8c9a4', inner: '#8a5a33', roof: 'tri', tag: -66 },
    pig:   { top: '#f5a3b8', base: '#f7c2cd', mouth: '#fde0e6', inner: '#e07f97', roof: 'round', tag: -42 },
    cow:   { top: '#e8e2d8', base: '#d5ccc0', mouth: '#f4eee4', inner: '#8a7a68', roof: 'round', tag: -42 },
    sheep: { top: '#efe9df', base: '#e2d9ca', mouth: '#f7f2ea', inner: '#b5a891', roof: 'round', tag: -42 },
    chick: { top: '#ffd94d', base: '#ffe9a0', mouth: '#fff3c4', inner: '#e0a62e', roof: 'round', tag: -42 }
  };
  function drawNest(ctx, nest, t) {
    var p = project(nest.fx, nest.fz);
    var sx = p.x, sy = p.y, sc = p.sc;
    var st = NEST_STYLE[nest.species] || NEST_STYLE.cat;
    // 单侧可用宽度约 0.16*650 = 104px，窝宽按宠物数均分、最多 168
    var sideN = Math.max(1, nest.sideN || 1);
    var w = Math.max(50, Math.min(168, 232 / sideN * 0.9)) * sc;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    Utils.ell(ctx, sx, sy, w * 0.68, 9 * sc);
    // 底座垫
    ctx.fillStyle = st.base;
    Utils.roundRect(ctx, sx - w / 2, sy - 12 * sc, w, 16 * sc, 7 * sc);
    ctx.fillStyle = Utils.lighten(st.base, 0.18);
    Utils.roundRect(ctx, sx - w / 2, sy - 10 * sc, w, 8 * sc, 5 * sc);
    if (st.roof === 'tri') {
      // 三角顶狗窝
      ctx.fillStyle = st.top;
      ctx.fillRect(sx - w / 2, sy - 18 * sc, w, 18 * sc);
      ctx.fillStyle = Utils.lighten(st.top, 0.12);
      ctx.beginPath();
      ctx.moveTo(sx - w / 2 - 6 * sc, sy - 18 * sc);
      ctx.lineTo(sx, sy - 56 * sc);
      ctx.lineTo(sx + w / 2 + 6 * sc, sy - 18 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.22, sy - 18 * sc);
      ctx.lineTo(sx - w * 0.06, sy - 38 * sc);
      ctx.lineTo(sx + w * 0.06, sy - 38 * sc);
      ctx.lineTo(sx + w * 0.08, sy - 18 * sc);
      ctx.closePath();
      ctx.fill();
    } else {
      // 圆顶窝
      ctx.fillStyle = st.top;
      ctx.beginPath();
      ctx.moveTo(sx - w / 2, sy - 16 * sc);
      ctx.arc(sx, sy - 16 * sc, w / 2, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      Utils.ell(ctx, sx - w * 0.22, sy - 26 * sc, w * 0.18, 8 * sc);
    }
    // 窝口
    ctx.fillStyle = st.mouth;
    ctx.beginPath();
    ctx.arc(sx, sy - 6 * sc, w * 0.30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = st.inner;
    Utils.ell(ctx, sx, sy - 4 * sc, w * 0.15, 6 * sc);
    // 名牌（宠物名）
    var tagTop = sy + st.tag * sc;
    var nw = Utils.measure(ctx, nest.name, 12 * sc) + 18 * sc;
    Utils.roundRect(ctx, sx - nw / 2, tagTop - 10 * sc, nw, 16 * sc, 5 * sc, 'rgba(255,255,255,0.92)');
    Utils.drawText(ctx, nest.name, sx, tagTop, { size: 12 * sc, weight: 'bold', color: '#7a4f26' });
  }

  // ---------- 猫砂盆（第四轮 + 第六轮美化与脏度） ----------
  function drawLitter(ctx, t, dirt) {
    var L = LAYOUT.litter;
    var p = project(L.fx, L.fz);
    var sx = p.x, sy = p.y, sc = p.sc;
    var d = (dirt == null) ? 0 : Math.max(0, Math.min(100, dirt));
    // 地面投影
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    Utils.ell(ctx, sx + 5 * sc, sy + 4 * sc, 98 * sc, 16 * sc);
    // 盆体后壁（更深的蓝色，立体纵深）
    ctx.fillStyle = '#4f86a8';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 24 * sc, 98 * sc, 22 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    // 盆体外壁（前低后高的梯形盆）
    ctx.fillStyle = '#7db8d9';
    ctx.beginPath();
    ctx.moveTo(sx - 96 * sc, sy - 36 * sc);
    ctx.lineTo(sx + 96 * sc, sy - 36 * sc);
    ctx.lineTo(sx + 102 * sc, sy);
    ctx.lineTo(sx - 102 * sc, sy);
    ctx.closePath();
    ctx.fill();
    // 外壁高光（左上方受光）
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.moveTo(sx - 96 * sc, sy - 36 * sc);
    ctx.lineTo(sx + 20 * sc, sy - 36 * sc);
    ctx.lineTo(sx + 24 * sc, sy - 8 * sc);
    ctx.lineTo(sx - 96 * sc, sy - 8 * sc);
    ctx.closePath();
    ctx.fill();
    // 盆沿（厚边 + 上沿高光）
    ctx.fillStyle = '#5d93b5';
    Utils.roundRect(ctx, sx - 103 * sc, sy - 44 * sc, 206 * sc, 13 * sc, 8 * sc);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    Utils.roundRect(ctx, sx - 103 * sc, sy - 44 * sc, 206 * sc, 5 * sc, 8 * sc);
    // 猫砂（颜色随脏度变深）
    var sandBase = d < 50 ? '#e9e2cf' : '#d9cba6';
    var sandDark = d < 50 ? '#d2c8ac' : '#c4ad7d';
    ctx.fillStyle = sandBase;
    Utils.roundRect(ctx, sx - 90 * sc, sy - 34 * sc, 180 * sc, 26 * sc, 10 * sc);
    // 猫砂颗粒
    ctx.fillStyle = sandDark;
    for (var i = 0; i < 22; i++) {
      var gx = sx - 80 * sc + ((i * 37 + 13) % 160) * sc;
      var gy = sy - 30 * sc + ((i * 53) % 22) * sc;
      Utils.ell(ctx, gx, gy, 2.6 * sc, 1.8 * sc);
    }
    // 污渍结块（随脏度增多）
    ctx.fillStyle = '#a98a55';
    for (var j = 0; j < Math.floor(d / 8); j++) {
      var bx = sx - 70 * sc + ((j * 41 + 7) % 140) * sc;
      var by = sy - 24 * sc + ((j * 29) % 14) * sc;
      Utils.ell(ctx, bx, by, 6 * sc, 4 * sc);
    }
    if (d >= 60) {
      ctx.fillStyle = 'rgba(139,105,58,0.65)';
      for (var k = 0; k < Math.floor((d - 60) / 5); k++) {
        var bx2 = sx - 60 * sc + ((k * 53 + 11) % 120) * sc;
        var by2 = sy - 22 * sc + ((k * 37) % 12) * sc;
        Utils.ell(ctx, bx2, by2, 4 * sc, 3 * sc);
      }
    }
    // 脏度进度条（盆上方）
    var bw = 64 * sc, bh = 5 * sc, bx0 = sx - bw / 2, by0 = sy - 62 * sc;
    Utils.roundRect(ctx, bx0 - 2 * sc, by0 - 2 * sc, bw + 4 * sc, bh + 4 * sc, 3 * sc, 'rgba(255,255,255,0.9)');
    if (d > 0) {
      var barColor = d < 60 ? '#8bc34a' : (d < 90 ? '#ffb300' : '#e53935');
      ctx.fillStyle = barColor;
      Utils.roundRect(ctx, bx0, by0, Math.max(3 * sc, bw * d / 100), bh, 2 * sc);
    }
    Utils.drawText(ctx, '脏度', bx0 - 22 * sc, by0 + 4 * sc, { size: 10 * sc, color: '#8a6a45' });
    // 铲屎提示（快满时）
    if (d >= 80) {
      Utils.drawText(ctx, '该铲屎啦！', sx, sy - 72 * sc, { size: 13 * sc, weight: 'bold', color: '#e53935' });
    }
    // 臭气（脏满时飘动）
    if (d >= 100) {
      for (var q = 0; q < 3; q++) {
        var qt = ((t * 0.5 + q * 0.33) % 1);
        var qy = sy - 50 * sc - qt * 28 * sc;
        var qx = sx - 30 * sc + q * 30 * sc + Math.sin((t + q * 2) * 2) * 5 * sc;
        ctx.fillStyle = 'rgba(120,120,120,' + (0.45 * (1 - qt)) + ')';
        ctx.beginPath();
        ctx.arc(qx, qy, 5 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 标签
    Utils.drawText(ctx, '猫砂盆', sx, sy + 28 * sc, { size: 20 * Math.max(0.8, sc), color: '#8a6a45' });
    // 铲屎快捷按钮（攒够 10 脏度才出现，悬浮在盆上方，点击即铲——避免被宠物挡住）
    if (d >= 10) {
      var bW = 96 * sc, bH = 32 * sc;
      var bX = sx - bW / 2, bY = sy - 104 * sc;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      Utils.roundRect(ctx, bX - 2 * sc, bY - 2 * sc, bW + 4 * sc, bH + 4 * sc, 9 * sc);
      ctx.fill();
      var bGrad = ctx.createLinearGradient(bX, bY, bX, bY + bH);
      bGrad.addColorStop(0, d >= 80 ? '#ff8a65' : '#8bc34a');
      bGrad.addColorStop(1, d >= 80 ? '#e53935' : '#689f38');
      ctx.fillStyle = bGrad;
      Utils.roundRect(ctx, bX, bY, bW, bH, 8 * sc);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(15 * sc) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧹 铲屎', sx, bY + bH / 2 + 1 * sc);
      // 按钮轻微呼吸动画，提示可点击
      if (d >= 80) {
        var pulse = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.4 * pulse) + ')';
        ctx.lineWidth = 2 * sc;
        Utils.roundRect(ctx, bX - 4 * sc, bY - 4 * sc, bW + 8 * sc, bH + 8 * sc, 11 * sc, null, true);
      }
    }
  }

  // ---------- 足球 ----------
  function drawBall(ctx, ball, t) {
    var p = project(ball.x, ball.z);
    var sx = p.x, sy = p.y, sc = p.sc;
    var r = 17 * sc;
    var spin = ball.spin || 0;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    Utils.ell(ctx, sx, sy, r * 1.25, r * 0.45);
    // 白球
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.6 * sc;
    ctx.beginPath();
    ctx.arc(sx, sy - r, r, 0, Math.PI * 2);
    ctx.stroke();
    // 中心黑块
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(sx, sy - r, r * 0.40, 0, Math.PI * 2);
    ctx.fill();
    // 边缘黑块（随滚动旋转）
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + 0.5 + spin;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * r * 0.80, sy - r + Math.sin(a) * r * 0.80, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- 墓碑 ----------
  function drawTombstone(ctx, pet, t) {
    var p = project(pet.x, pet.z);
    var sc = p.sc;
    var sx = p.x, sy = p.y;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    Utils.ell(ctx, sx + 4 * sc, sy + 2 * sc, 56 * sc, 13 * sc);
    // 草
    ctx.strokeStyle = '#6fae62';
    ctx.lineWidth = 3 * sc;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var gx = sx - 46 * sc + i * 23 * sc;
      ctx.moveTo(gx, sy - 2 * sc);
      ctx.lineTo(gx + (i % 2 ? 4 : -4) * sc, sy - 14 * sc - (i % 3) * 4 * sc);
    }
    ctx.stroke();
    // 石头
    var gw = 96 * sc, gh = 118 * sc;
    var gx = sx - gw / 2, gy = sy - gh;
    var g = ctx.createLinearGradient(gx, gy, gx, gy + gh);
    g.addColorStop(0, '#d8dbe0');
    g.addColorStop(1, '#9aa0a8');
    ctx.fillStyle = g;
    Utils.roundRectPath(ctx, gx, gy, gw, gh, 22 * sc);
    ctx.fill();
    ctx.strokeStyle = '#7d838c';
    ctx.lineWidth = 2 * sc;
    Utils.roundRectPath(ctx, gx, gy, gw, gh, 22 * sc);
    ctx.stroke();
    // 顶部小圆
    ctx.fillStyle = '#c3c7cd';
    Utils.ell(ctx, sx, gy + 6 * sc, gw * 0.42, 12 * sc);
    // R.I.P.
    Utils.drawText(ctx, 'R.I.P.', sx, gy + 34 * sc, { size: 22 * sc, weight: 'bold', color: '#6b7078' });
    // 名牌（宠物名）
    var pw = Math.max(70 * sc, Utils.measure(ctx, pet.name, 24 * sc) + 24 * sc);
    Utils.roundRect(ctx, sx - pw / 2, gy + 62 * sc, pw, 40 * sc, 10 * sc, '#f4ecd9', '#c9b98f');
    Utils.drawText(ctx, pet.name, sx, gy + 82 * sc, { size: 24 * sc, weight: 'bold', color: '#7a5f3d' });
    // 小花
    ctx.fillStyle = '#f28ba0';
    for (var f = 0; f < 3; f++) {
      var fx = sx - 58 * sc + f * 12 * sc, fy = sy - 8 * sc - f * 4 * sc;
      Utils.ell(ctx, fx, fy, 5 * sc, 5 * sc);
    }
    ctx.fillStyle = '#ffd76a';
    Utils.ell(ctx, sx - 58 * sc + 12 * sc, sy - 16 * sc, 4 * sc, 4 * sc);
  }

  // ---------- 宠物 ----------
  function petPose(pet) {
    var st = pet.beh.state;
    if (st === 'walk' || st === 'walk_food' || st === 'walk_water' || st === 'zoomies' || st === 'chase' || st === 'flee' || st === 'playBall') return 'walk';
    if (st === 'eat') return 'eat';
    if (st === 'drink') return 'drink';
    if (st === 'sleep' || st === 'rest' || st === 'litter') return 'sleep';
    if (st === 'happy') return 'happy';
    if (st === 'sad') return 'sad';
    return 'idle';
  }

  function drawPet(ctx, pet, t, selected, time, lifted) {
    var p = project(pet.x, pet.z);
    var sc = p.sc;
    var sx = p.x, sy = p.y;
    // 体重影响体型（越重越大）
    var wf = Pets_weightFactor(pet);
    var s = 200 * sc * wf;
    var eatOffset = (pet.beh.state === 'eat' || pet.beh.state === 'drink') ? pet.eatSide * 40 * sc : 0;
    sx += eatOffset;
    // 拎起状态：上浮 + 飘动
    if (lifted) {
      sy -= 62 * sc * wf;
      sx += Math.sin(time / 180) * 6;
    }

    // 选中光环（外层柔光 + 内层描边，更醒目）
    if (selected) {
      ctx.strokeStyle = 'rgba(255,143,63,0.22)';
      ctx.lineWidth = 9;
      Utils.ell(ctx, sx, sy + 3 * sc, 90 * sc * wf, 27 * sc * wf);
      ctx.strokeStyle = 'rgba(255,143,63,0.85)';
      ctx.lineWidth = 4;
      Utils.ell(ctx, sx, sy + 3 * sc, 74 * sc * wf, 20 * sc * wf);
    }
    // 阴影（拎起时变淡变小，悬空感）
    ctx.fillStyle = lifted ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.22)';
    Utils.ell(ctx, sx, sy, lifted ? 34 * sc * wf : 56 * sc * wf, lifted ? 8 * sc * wf : 15 * sc * wf);

    // 身体
    Avatar.draw(ctx, pet, {
      x: sx, y: sy, s: s, t: t, pose: petPose(pet), facing: pet.facing
    });

    // 名字牌（随体型上移）
    var nameW = Utils.measure(ctx, pet.name, 23 * sc) + 30 * sc;
    var ny = sy - (s * 1.2 + 10 * sc);
    Utils.roundRect(ctx, sx - nameW / 2, ny, nameW, 34 * sc, 14 * sc, 'rgba(255,255,255,0.92)', 'rgba(255,143,63,0.6)');
    Utils.drawText(ctx, pet.name, sx, ny + 17 * sc, { size: 22 * sc, weight: 'bold', color: '#7a4f26' });

    // 需求气泡
    var needs = Pets_needs(pet);
    var bubbleY = ny - 40 * sc;
    if (needs.indexOf('food') >= 0 && needs.indexOf('water') >= 0) {
      drawBubble(ctx, sx, bubbleY, 40 * sc, '饿&渴', '#ff7d5c');
    } else if (needs.indexOf('food') >= 0) {
      drawBubble(ctx, sx, bubbleY, 36 * sc, '饿', '#ff9d4d');
    } else if (needs.indexOf('water') >= 0) {
      drawBubble(ctx, sx, bubbleY, 36 * sc, '渴', '#4aa8e0');
    }
  }

  // 需要引用 Pets（在 game 中通过 setPetsAPI 注入）
  var Pets_needs = function () { return []; };
  var Pets_mood = function () { return 'neutral'; };
  var Pets_weightFactor = function () { return 1; };
  var Pets_weightKg = function () { return 3; };
  var Pets_speciesOrder = ['cat', 'dog', 'pig', 'cow', 'sheep', 'chick'];
  var Pets_speciesInfo = {};
  Pets_speciesOrder.forEach(function (sp) { Pets_speciesInfo[sp] = { label: sp }; });
  var Pets_plantInfo = {};
  var Pets_plantGrowth = function () { return 0; };
  var Pets_plantLabel = function (k) { return k; };
  var Pets_PLANT_ORDER = ['orchid', 'corn', 'peach', 'peanut', 'watermelon', 'banana'];
  var Pets_pondInfo = {};
  var Pets_pondWeight = function () { return 100; };
  var Pets_pondScale = function () { return 1; };
  var Pets_POND_ORDER = ['fish', 'shrimp', 'turtle'];

  function drawBubble(ctx, x, y, r, text, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 小尾巴
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y + r * 0.85);
    ctx.lineTo(x + r * 0.1, y + r * 1.5);
    ctx.lineTo(x + r * 0.35, y + r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    Utils.drawText(ctx, text, x, y + 2, { size: r * 0.7, weight: 'bold', color: color });
  }

  // 气泡 / 爱心 / Zzz 粒子（game.time 为毫秒动画时间）
  function drawParticles(ctx, game) {
    // 爱心
    for (var i = 0; i < game.hearts.length; i++) {
      var h = game.hearts[i];
      var life = 1 - (game.time - h.t0) / 1000;
      if (life <= 0) continue;
      ctx.globalAlpha = Math.min(1, life * 2);
      ctx.fillStyle = h.color || '#ff6b81';
      Utils.heart(ctx, h.x, h.y - h.vy * (game.time - h.t0) / 1000, h.s * (0.7 + life * 0.3));
    }
    ctx.globalAlpha = 1;
    // Zzz
    for (var z = 0; z < game.zzzs.length; z++) {
      var zz = game.zzzs[z];
      var zl = 1 - (game.time - zz.t0) / 1200;
      if (zl <= 0) continue;
      ctx.globalAlpha = Math.min(1, zl * 2);
      Utils.drawText(ctx, 'Z', zz.x + Math.sin((game.time - zz.t0) / 300) * 6,
        zz.y - (game.time - zz.t0) / 1200 * 30, { size: 26, weight: 'bold', color: '#7aa0c9' });
    }
    ctx.globalAlpha = 1;
    // 如厕泡泡（💧 / 💩）
    for (var bb = 0; bb < game.bubbles.length; bb++) {
      var b = game.bubbles[bb];
      var bl = 1 - (game.time - b.t0) / 1400;
      if (bl <= 0) continue;
      ctx.globalAlpha = Math.min(1, bl * 2);
      Utils.drawText(ctx, b.text, b.x + Math.sin((game.time - b.t0) / 260) * 5,
        b.y - (game.time - b.t0) / 1400 * 34, { size: 34, weight: 'bold' });
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 顶部状态卡 ----------
  // 单行完整卡（h=154）与两行紧凑卡（h=74）共用；紧凑卡内容按高度压缩
  function drawChip(ctx, pet, x, y, w, h, selected, t) {
    var dead = !pet.alive;
    var compact = h < 100;
    // 柔和投影（增强卡片层次）
    Utils.roundRect(ctx, x, y + 5, w, h, 18, 'rgba(140,90,50,0.16)');
    Utils.roundRect(ctx, x, y, w, h, 18,
      selected ? '#fff2e2' : 'rgba(255,255,255,0.9)',
      selected ? '#ff8f3f' : 'rgba(200,170,130,0.5)');
    if (selected) {
      ctx.strokeStyle = '#ff8f3f';
      ctx.lineWidth = 3;
      Utils.roundRectPath(ctx, x, y, w, h, 18);
      ctx.stroke();
    }
    var nameColor = dead ? '#999' : '#6b4a35';
    if (compact) {
      // ===== 两行模式：紧凑卡 =====
      // 左侧小头像
      var icX = x + w * 0.12, icY = y + h / 2;
      if (dead) {
        ctx.fillStyle = '#c3c7cd';
        Utils.roundRect(ctx, icX - 12, y + 18, 24, 26, 6, '#c3c7cd');
        Utils.drawText(ctx, 'RIP', icX, y + 33, { size: 9, color: '#777' });
      } else {
        Avatar.drawIcon(ctx, pet, icX, icY, Math.min(30, w * 0.12));
      }
      // 名字（右上区域）
      var nX = x + w * 0.26;
      var nMax = w * 0.7 - 6;
      var shown = pet.name;
      while (shown.length > 1 && Utils.measure(ctx, shown, 17, 'bold') > nMax) { shown = shown.slice(0, -1); }
      if (shown !== pet.name) shown += '…';
      Utils.drawText(ctx, shown, nX, y + 20, { size: 17, weight: 'bold', align: 'left', color: nameColor });
      if (dead) {
        Utils.drawText(ctx, '已离开', nX, y + 44, { size: 14, align: 'left', color: '#b99' });
        return;
      }
      // 性别 + 体重
      drawGender(ctx, nX, y + 38, pet.gender);
      Utils.drawText(ctx, Pets_weightKg(pet).toFixed(1) + ' 斤', nX + 14, y + 42, { size: 13, align: 'left', color: '#a0805a' });
      // 情绪脸（右上）
      drawMiniFace(ctx, x + w - 16, y + 22, Pets_mood(pet));
      // 三条状态条横排底部（条内显示百分比）
      var barW = (w - 16) / 3;
      var by = y + h - 14;
      drawStatusRow(ctx, x + 4, by, barW - 6, pet.hunger, 'feed', '#ff9d4d', true);
      drawStatusRow(ctx, x + 4 + barW, by, barW - 6, pet.thirst, 'water', '#4aa8e0', true);
      drawStatusRow(ctx, x + 4 + barW * 2, by, barW - 6, pet.energy, 'rest', '#ffd34d', true);
      return;
    }
    // ===== 单行模式：完整卡 =====
    var iconR = Math.min(76, Math.max(44, w * 0.32));
    var iconX = x + w * 0.22, iconY = y + 66;
    var txtX = x + w * 0.5;
    // 小头像
    if (dead) {
      ctx.fillStyle = '#c3c7cd';
      Utils.roundRect(ctx, iconX - 22, y + 34, 44, 52, 10, '#c3c7cd');
      Utils.drawText(ctx, 'R.I.P.', iconX, y + 62, { size: 12, color: '#777' });
    } else {
      Avatar.drawIcon(ctx, pet, iconX, iconY, iconR);
    }
    // 名字（窄卡时自动截断，避免超出卡片）
    var nameMax = w * 0.48 - 10;
    var shown2 = pet.name;
    while (shown2.length > 1 && Utils.measure(ctx, shown2, 26, 'bold') > nameMax) { shown2 = shown2.slice(0, -1); }
    if (shown2 !== pet.name) shown2 += '…';
    Utils.drawText(ctx, shown2, txtX, y + 30, { size: 26, weight: 'bold', align: 'left', color: nameColor });
    if (dead) {
      Utils.drawText(ctx, '已离开', txtX, y + 104, { size: 20, align: 'left', color: '#b99' });
      return;
    }
    // 性别 + 体重
    drawGender(ctx, txtX, y + 55, pet.gender);
    Utils.drawText(ctx, Pets_weightKg(pet).toFixed(1) + ' 斤', txtX + 16, y + 59, { size: 17, align: 'left', color: '#a0805a' });
    // 情绪脸
    drawMiniFace(ctx, x + w * 0.88, y + 30, Pets_mood(pet));
    // 三条状态行：图标 + 条 + 百分比
    var barW2 = Math.max(20, w * 0.44);
    var barX = x + w * 0.5 - 2;
    drawStatusRow(ctx, barX, y + 84, barW2, pet.hunger, 'feed', '#ff9d4d');
    drawStatusRow(ctx, barX, y + 110, barW2, pet.thirst, 'water', '#4aa8e0');
    drawStatusRow(ctx, barX, y + 136, barW2, pet.energy, 'rest', '#ffd34d');
  }

  // 性别符号（♂ 蓝 / ♀ 粉）
  function drawGender(ctx, cx, cy, gender) {
    var color = gender === 'female' ? '#e76a9a' : '#5a8fd0';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (gender === 'female') {
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1);
      ctx.lineTo(cx, cy + 10);
      ctx.moveTo(cx - 5.5, cy + 4.5);
      ctx.lineTo(cx + 5.5, cy + 4.5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy - 5, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 3.8, cy - 1.2);
      ctx.lineTo(cx + 11.5, cy - 8.5);
      ctx.moveTo(cx + 11.5, cy - 8.5);
      ctx.lineTo(cx + 6.5, cy - 9);
      ctx.moveTo(cx + 11.5, cy - 8.5);
      ctx.lineTo(cx + 11.5, cy - 3.5);
      ctx.stroke();
    }
  }

  function drawStatusRow(ctx, x, cy, barW, val, icon, color, mini) {
    if (mini) {
      // 紧凑模式：细条 + 条内白色百分比（加大字号 + 深色描边，任何底色都清晰）
      var mbx = x, mbw = barW;
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      Utils.roundRect(ctx, mbx, cy - 4, mbw, 8, 4);
      if (val > 0) {
        ctx.fillStyle = color;
        Utils.roundRect(ctx, mbx, cy - 4, Math.max(3, mbw * val / 100), 8, 4);
      }
      var pct = Math.round(val) + '%';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(40,25,10,0.85)';
      ctx.strokeText(pct, mbx + mbw / 2, cy + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(pct, mbx + mbw / 2, cy + 1);
      return;
    }
    drawIcon(ctx, icon, x + 9, cy, color);
    var bx = x + 24, bw = barW;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    Utils.roundRect(ctx, bx, cy - 4, bw, 9, 4);
    if (val > 0) {
      ctx.fillStyle = color;
      Utils.roundRect(ctx, bx, cy - 4, Math.max(5, bw * val / 100), 9, 4);
    }
    Utils.drawText(ctx, Math.round(val) + '%', x + 24 + bw + 48, cy + 1, { size: 16, weight: 'bold', align: 'right', color: '#5a4030' });
  }

  function drawMiniFace(ctx, x, y, mood) {
    ctx.strokeStyle = mood === 'happy' ? '#e8883f' : (mood === 'sad' ? '#5a8fd0' : '#9a9a9a');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'happy') ctx.arc(x, y, 12, Math.PI * 0.15, Math.PI * 0.85);
    else if (mood === 'sad') ctx.arc(x, y + 10, 12, Math.PI * 1.2, Math.PI * 1.8);
    else ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.stroke();
  }

  // 状态卡滚动导航（左右箭头 + 进度条）
  function drawChipNav(ctx, game) {
    if (game.chipMax() <= 0) return;
    var ay = LAYOUT.chipY + LAYOUT.chipH / 2;
    var arrows = [{ dir: 'left', cx: 28 }, { dir: 'right', cx: W - 28 }];
    for (var i = 0; i < arrows.length; i++) {
      var a = arrows[i];
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.strokeStyle = 'rgba(200,170,130,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.cx, ay, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b98a5a';
      ctx.beginPath();
      if (a.dir === 'left') {
        ctx.moveTo(a.cx + 6, ay - 8); ctx.lineTo(a.cx - 6, ay); ctx.lineTo(a.cx + 6, ay + 8);
      } else {
        ctx.moveTo(a.cx - 6, ay - 8); ctx.lineTo(a.cx + 6, ay); ctx.lineTo(a.cx - 6, ay + 8);
      }
      ctx.closePath();
      ctx.fill();
    }
    // 进度指示条（两行布局时 chipMax=0，不会走到这里）
    var total = game.pets.length * (game.chipLayout().cw + LAYOUT.chipGap);
    var view = W - LAYOUT.chipX0 * 2;
    var trackX = 90, trackW = W - 180;
    ctx.fillStyle = 'rgba(140,90,50,0.12)';
    Utils.roundRect(ctx, trackX, LAYOUT.chipY + LAYOUT.chipH + 12, trackW, 4, 2);
    var thumbW = Math.max(24, trackW * view / total);
    var ratio = game.chipMax() > 0 ? game.chipScroll / game.chipMax() : 0;
    ctx.fillStyle = 'rgba(255,143,63,0.85)';
    Utils.roundRect(ctx, trackX + ratio * (trackW - thumbW), LAYOUT.chipY + LAYOUT.chipH + 12, thumbW, 4, 2);
  }

  // ---------- 底部操作栏 ----------
  function drawActionBar(ctx, game) {
    // 提示（浅色底条更醒目）+ 金币
    var tipText = '🪙 ' + game.coins + ' · 点碗添粮添水 · 点按/滑动宠物抚摸 · 记得每天照料';
    var tw = Utils.measure(ctx, tipText, 20) + 44;
    Utils.roundRect(ctx, (W - tw) / 2, LAYOUT.barTop - 36, tw, 36, 18, 'rgba(255,255,255,0.6)');
    Utils.drawText(ctx, tipText, 375, LAYOUT.barTop - 13, { size: 20, color: '#a0805a' });
    // 底栏底色
    var g = ctx.createLinearGradient(0, LAYOUT.barTop, 0, H);
    g.addColorStop(0, 'rgba(255,244,230,0)');
    g.addColorStop(1, '#fff3e2');
    ctx.fillStyle = g;
    ctx.fillRect(0, LAYOUT.barTop, W, H - LAYOUT.barTop);

    var btns = LAYOUT.buttons;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var pressed = game.pressedId === b.id;
      var enabled = !(b.id === 'feed' || b.id === 'water' || b.id === 'rest') || game.hasAlivePet();
      var fill = b.id === 'add' ? '#ffffff' : (b.id === 'help' ? '#ffffff' : '#ff8f3f');
      var textColor = (b.id === 'add' || b.id === 'help') ? '#8a5a33' : '#ffffff';
      if (!enabled) { fill = '#d8cbb8'; textColor = '#fff'; }
      ctx.fillStyle = fill;
      if (pressed) ctx.fillStyle = Utils.darken(fill, 0.12);
      // 阴影
      ctx.fillStyle = 'rgba(140,90,50,0.18)';
      Utils.roundRect(ctx, b.x + 2, b.y + 4, b.w, b.h, 18);
      ctx.fillStyle = pressed ? Utils.darken(fill, 0.1) : fill;
      Utils.roundRect(ctx, b.x, b.y, b.w, b.h, 18, pressed ? Utils.darken(fill, 0.1) : fill);
      if (!pressed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        Utils.roundRectPath(ctx, b.x + 2, b.y + 2, b.w - 4, (b.h - 4) / 2, 16);
        ctx.stroke();
      }
      // 图标
      drawIcon(ctx, b.id, b.x + b.w / 2, b.y + 30, textColor);
      Utils.drawText(ctx, b.label, b.x + b.w / 2, b.y + 68, { size: 26, weight: 'bold', color: textColor });
    }
  }

  function drawIcon(ctx, id, cx, cy, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (id) {
      case 'feed': // 骨头
        Utils.ell(ctx, cx - 9, cy, 6, 6);
        Utils.ell(ctx, cx + 9, cy, 6, 6);
        ctx.fillRect(cx - 4, cy - 2.5, 8, 5);
        break;
      case 'water': { // 水滴
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.quadraticCurveTo(cx + 11, cy + 2, cx + 7, cy + 8);
        ctx.quadraticCurveTo(cx, cy + 13, cx - 7, cy + 8);
        ctx.quadraticCurveTo(cx - 11, cy + 2, cx, cy - 12);
        ctx.fill();
        break;
      }
      case 'rest': // 月亮
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff8f3f';
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 3, 8.5, 0, Math.PI * 2);
        ctx.fill();
        Utils.drawText(ctx, 'Z', cx + 12, cy - 12, { size: 18, weight: 'bold', color: '#8a5a33' });
        break;
      case 'add':
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        break;
      case 'shop': { // 购物袋
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy + 2);
        ctx.lineTo(cx + 12, cy + 2);
        ctx.lineTo(cx + 9, cy + 13);
        ctx.lineTo(cx - 9, cy + 13);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 1, 7, Math.PI, 0);
        ctx.stroke();
        break;
      }
      case 'help':
        Utils.drawText(ctx, '?', cx, cy + 1, { size: 30, weight: 'bold', color: color });
        break;
    }
  }

  // ---------- 设置界面 ----------
  function drawSetup(ctx, game) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff7ea');
    bg.addColorStop(1, '#ffe9d0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // 装饰爪印
    ctx.fillStyle = 'rgba(180,120,70,0.12)';
    drawPaw(ctx, 90, 160, 24);
    drawPaw(ctx, 660, 170, 22);
    drawPaw(ctx, 80, 620, 22);
    drawPaw(ctx, 672, 640, 20);

    Utils.drawText(ctx, '宠物小屋', 375, 118, { size: 50, weight: 'bold', color: '#8a5a33' });
    Utils.drawText(ctx, '选一只小宠物，和它度过每一天吧', 375, 168, { size: 22, color: '#a0805a' });
    drawSetupHearts(ctx, game);
    // 多房间模式下可返回房间面板
    if (game.rooms) {
      Utils.roundRect(ctx, 20, 40, 130, 62, 14, 'rgba(255,255,255,0.9)', '#d9b98c');
      Utils.drawText(ctx, '← 房间', 85, 72, { size: 24, color: '#8a5a33' });
    }

    // 六张宠物卡（2 行 × 3 列）
    var order = Pets_speciesOrder;
    for (var i = 0; i < order.length; i++) {
      drawSetupCard(ctx, game, order[i], i);
    }

    // 规则
    Utils.roundRect(ctx, 50, 840, 650, 150, 18, 'rgba(255,255,255,0.85)');
    Utils.drawText(ctx, '玩法规则', 375, 868, { size: 24, weight: 'bold', color: '#8a5a33' });
    var rules = [
      '· 粮 / 水 / 精力都会按 3 天从 100% 衰减到 0%',
      '· 任意一项降到 0%，宠物就会离开，只剩一座墓碑',
      '· 每天记得喂食、喂水、让它休息，多抚摸会更开心'
    ];
    for (var i = 0; i < rules.length; i++) {
      Utils.drawText(ctx, rules[i], 74, 905 + i * 33, { size: 20, align: 'left', color: '#8a6a45' });
    }

    // 已选提示
    var chosen = [];
    for (var k = 0; k < order.length; k++) {
      if (game.setup.picked[order[k]]) chosen.push(Pets_speciesInfo[order[k]].label);
    }
    Utils.drawText(ctx, '将收养：' + (chosen.length ? chosen.join('、') : '（请至少选一只）'),
      375, 1030, { size: 22, weight: 'bold', color: chosen.length ? '#8a5a33' : '#d0806a' });

    // 开始按钮
    var sb = game.setup.startBtn;
    Utils.roundRect(ctx, sb.x + 3, sb.y + 5, sb.w, sb.h, 24, 'rgba(140,90,50,0.2)');
    var pressed = game.pressedId === 'setup_start';
    Utils.roundRect(ctx, sb.x, sb.y, sb.w, sb.h, 24, pressed ? '#e87f2f' : '#ff8f3f');
    Utils.drawText(ctx, '开始游戏', sb.x + sb.w / 2, sb.y + sb.h / 2, { size: 34, weight: 'bold', color: '#fff' });
  }

  // 六卡布局：2 行 3 列（绘制与命中共用）
  function setupCardRect(idx) {
    var col = idx % 3, row = Math.floor(idx / 3);
    return { x: 30 + col * 240, y: 200 + row * 300, w: 210, h: 280 };
  }
  function setupNameBoxRect(idx) {
    var c = setupCardRect(idx);
    return { x: c.x + 20, y: c.y + 222, w: 170, h: 46 };
  }

  function drawSetupCard(ctx, game, species, idx) {
    var c = setupCardRect(idx);
    var spInfo = Pets_speciesInfo[species] || { label: species, desc: '' };
    var picked = game.setup.picked[species];
    Utils.roundRect(ctx, c.x, c.y, c.w, c.h, 18,
      picked ? 'rgba(255,255,255,0.94)' : 'rgba(238,234,226,0.9)',
      picked ? '#ff8f3f' : '#d9cfbe');
    if (picked) {
      // 右上角选中 ✓
      ctx.fillStyle = '#ff8f3f';
      ctx.beginPath();
      ctx.arc(c.x + c.w - 24, c.y + 26, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x + c.w - 31, c.y + 26); ctx.lineTo(c.x + c.w - 25, c.y + 32); ctx.lineTo(c.x + c.w - 17, c.y + 19);
      ctx.stroke();
    } else {
      Utils.drawText(ctx, '点卡片选择它', c.x + c.w / 2, c.y + 24, { size: 14, color: '#b8a88f' });
    }
    // 形象（上半部居中）
    var demo = { species: species, avatar: { colors: spInfo.colors } };
    ctx.save();
    if (!picked) ctx.globalAlpha = 0.35;
    Avatar.draw(ctx, demo, { x: c.x + c.w / 2, y: c.y + 160, s: 105, t: game.time / 1000, pose: 'happy', facing: 1 });
    ctx.restore();
    // 名字（下半部）
    var titleColor = picked ? '#6b4a35' : '#b3a68f';
    Utils.drawText(ctx, spInfo.label, c.x + c.w / 2, c.y + 192, { size: 26, weight: 'bold', color: titleColor });
    Utils.drawText(ctx, spInfo.desc, c.x + c.w / 2, c.y + 214, { size: 13, color: picked ? '#a0805a' : '#c8bca6' });
    // 输入框
    var box = setupNameBoxRect(idx);
    var name = game.setup.names[species];
    Utils.roundRect(ctx, box.x, box.y, box.w, box.h, 12, picked ? '#f6eee2' : '#eae4d8', picked ? '#d9b98c' : '#d5cbb8');
    Utils.drawText(ctx, name || '点击输入名字',
      box.x + box.w / 2, box.y + box.h / 2, { size: 22, color: name ? titleColor : '#c9b28f' });
    Utils.drawText(ctx, '✎', box.x + box.w - 22, box.y + box.h / 2, { size: 20, color: picked ? '#d9a05f' : '#c8bca6' });
  }

  function drawPaw(ctx, x, y, r) {
    Utils.ell(ctx, x, y, r * 0.9, r * 0.75);
    Utils.ell(ctx, x - r * 0.8, y - r * 1.1, r * 0.32, r * 0.4);
    Utils.ell(ctx, x - r * 0.3, y - r * 1.3, r * 0.32, r * 0.42);
    Utils.ell(ctx, x + r * 0.3, y - r * 1.3, r * 0.32, r * 0.42);
    Utils.ell(ctx, x + r * 0.8, y - r * 1.1, r * 0.32, r * 0.4);
  }

  // 设置页浮动爱心（让画面动起来）
  function drawSetupHearts(ctx, game) {
    var t = game.time / 1000;
    var spots = [
      { x: 112, y: 432, phase: 0 },
      { x: 288, y: 398, phase: 2.1 },
      { x: 102, y: 750, phase: 1.1 },
      { x: 288, y: 716, phase: 3.2 }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var a = (Math.sin(t * 2 + s.phase) + 1) / 2;
      ctx.globalAlpha = 0.3 + a * 0.55;
      ctx.fillStyle = '#ff8fa3';
      Utils.heart(ctx, s.x, s.y + Math.sin(t * 2.4 + s.phase) * 10, 10 + a * 6);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 领养界面 ----------
  function drawAddPet(ctx, game) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff7ea');
    bg.addColorStop(1, '#ffe9d0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    Utils.drawText(ctx, '领养新伙伴', 375, 92, { size: 42, weight: 'bold', color: '#8a5a33' });
    Utils.drawText(ctx, '上传一张照片，渲染成专属 3D 形象', 375, 136, { size: 22, color: '#a0805a' });
    // 金币提示（首次领养免费，之后 10 金币/只）
    Utils.roundRect(ctx, 250, 152, 250, 34, 17, 'rgba(255,214,102,0.95)', '#d9a520');
    Utils.drawText(ctx, '🪙 ' + game.coins + (game.adoptedOnce ? ' · 领养需 8 金币' : ' · 首次领养免费'), 375, 175, { size: 16, weight: 'bold', color: '#8a5a00' });

    // 返回
    var back = game.addpet.backBtn;
    Utils.roundRect(ctx, back.x, back.y, back.w, back.h, 14, 'rgba(255,255,255,0.9)', '#d9b98c');
    Utils.drawText(ctx, '← 返回', back.x + back.w / 2, back.y + back.h / 2, { size: 24, color: '#8a5a33' });

    // 照片区
    var ph = game.addpet.photo;
    var px = 125, py = 170, pw = 500, phh = 320;
    if (!ph) {
      ctx.setLineDash([12, 10]);
      Utils.roundRect(ctx, px, py, pw, phh, 22, 'rgba(255,255,255,0.55)', '#d9b98c');
      ctx.setLineDash([]);
      Utils.drawText(ctx, '＋ 点击选择照片', 375, py + 135, { size: 30, weight: 'bold', color: '#c9a86a' });
      Utils.drawText(ctx, '从相册选择或拍照，将生成你的 3D 伙伴', 375, py + 178, { size: 20, color: '#b99c74' });
      Utils.drawText(ctx, '（仅保存在本地，不会上传）', 375, py + 208, { size: 18, color: '#c9b28f' });
    } else {
      Utils.roundRect(ctx, px, py, pw, phh, 22, '#ffffff', '#d9b98c');
      ctx.save();
      Utils.roundRectPath(ctx, px + 8, py + 8, pw - 16, phh - 16, 16);
      ctx.clip();
      ctx.drawImage(ph.texture, px + 8, py + 8, pw - 16, phh - 16);
      ctx.restore();
      var reselect = game.addpet.reselectBtn;
      Utils.roundRect(ctx, reselect.x, reselect.y, reselect.w, reselect.h, 12, 'rgba(255,255,255,0.92)', '#d9b98c');
      Utils.drawText(ctx, '重新选择', reselect.x + reselect.w / 2, reselect.y + reselect.h / 2, { size: 20, color: '#8a5a33' });
    }

    // 3D 形象预览
    Utils.drawText(ctx, '3D 形象预览', 375, 520, { size: 22, color: '#a0805a' });
    if (ph) {
      var previewPet = {
        species: game.addpet.species || 'custom',
        avatar: { type: 'photo', colors: ph.colors, ears: game.addpet.species || 'round', texture: ph.texture }
      };
      Avatar.draw(ctx, previewPet, { x: 375, y: 665, s: 150, t: game.time / 1000, pose: 'happy', facing: 1 });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      Utils.roundRect(ctx, 290, 545, 170, 115, 16);
      Utils.drawText(ctx, '选择照片后', 375, 595, { size: 20, color: '#c9b28f' });
      Utils.drawText(ctx, '这里会显示形象', 375, 625, { size: 20, color: '#c9b28f' });
    }

    // 名字
    Utils.drawText(ctx, '名字', 300, 706, { size: 22, color: '#a0805a' });
    var nb = game.addpet.nameBox;
    Utils.roundRect(ctx, nb.x, nb.y, nb.w, nb.h, 14, '#f6eee2', '#d9b98c');
    Utils.drawText(ctx, game.addpet.name || '点击输入名字', nb.x + 20, nb.y + nb.h / 2,
      { size: 27, align: 'left', color: game.addpet.name ? '#6b4a35' : '#c9b28f' });
    Utils.drawText(ctx, '✎', nb.x + nb.w - 30, nb.y + nb.h / 2, { size: 22, color: '#d9a05f' });

    // 性别（领养时手动选；不选则随机）
    Utils.drawText(ctx, '性别（不选就随机）', 300, 792, { size: 22, color: '#a0805a' });
    var gbs = game.addpet.genderBtns;
    for (var gi = 0; gi < gbs.length; gi++) {
      var gb = gbs[gi];
      var gsel = game.addpet.gender === gb.value;
      Utils.roundRect(ctx, gb.x, gb.y, gb.w, gb.h, 14, gsel ? (gb.value === 'male' ? '#5a8fd0' : '#e76a9a') : 'rgba(255,255,255,0.9)',
        gsel ? (gb.value === 'male' ? '#5a8fd0' : '#e76a9a') : '#d9b98c');
      Utils.drawText(ctx, gb.label, gb.x + gb.w / 2, gb.y + gb.h / 2, { size: 24, weight: 'bold', color: gsel ? '#fff' : '#8a5a33' });
    }

    // 物种（有照片=必选照片伙伴物种；没照片=直接领养）
    Utils.drawText(ctx, ph ? '选择照片伙伴的物种（必选）' : '想直接领养？点下面物种即可', 375, 836,
      { size: 21, weight: 'bold', color: ph ? '#d0806a' : '#a0805a' });
    var sps = game.addpet.speciesBtns;
    for (var i = 0; i < sps.length; i++) {
      var sp = sps[i];
      var sel = ph && game.addpet.species === sp.value;
      Utils.roundRect(ctx, sp.x, sp.y, sp.w, sp.h, 14, sel ? '#ff8f3f' : 'rgba(255,255,255,0.9)',
        sel ? '#ff8f3f' : '#d9b98c');
      Utils.drawText(ctx, sp.label, sp.x + sp.w / 2, sp.y + sp.h / 2, { size: 24, weight: 'bold', color: sel ? '#fff' : '#8a5a33' });
    }

    // 确认
    var ok = game.addpet.confirmBtn;
    Utils.roundRect(ctx, ok.x + 3, ok.y + 5, ok.w, ok.h, 22, 'rgba(140,90,50,0.2)');
    Utils.roundRect(ctx, ok.x, ok.y, ok.w, ok.h, 22, game.pressedId === 'addpet_ok' ? '#e87f2f' : '#ff8f3f');
    Utils.drawText(ctx, '确认领养', ok.x + ok.w / 2, ok.y + ok.h / 2, { size: 30, weight: 'bold', color: '#fff' });
  }

  // 弹窗按钮位置（绘制与命中检测共用）
  function modalButtonRects(modal) {
    var rows = modal.rows ? (modal.buttons ? modal.rows.concat([modal.buttons]) : modal.rows) : [modal.buttons];
    var nRows = rows.length;
    var cw = 560, ch = 120 + modal.lines.length * 44 + nRows * 86 + 10;
    var cx = (W - cw) / 2, cy = (H - ch) / 2;
    var gap = 16;
    var rects = [];
    for (var r = 0; r < nRows; r++) {
      var btns = rows[r];
      var n = btns.length;
      var bw = (cw - 48 - (n - 1) * gap) / n;
      var by = cy + ch - 14 - (nRows - r) * 86;
      for (var b = 0; b < n; b++) {
        rects.push({ x: cx + 24 + b * (bw + gap), y: by, w: bw, h: 70, btn: btns[b] });
      }
    }
    return rects;
  }

  // ---------- 弹窗 ----------
  function drawModal(ctx, modal) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    var rows = modal.rows ? (modal.buttons ? modal.rows.concat([modal.buttons]) : modal.rows) : [modal.buttons];
    var nRows = rows.length;
    var cw = 560, ch = 120 + modal.lines.length * 44 + nRows * 86 + 10;
    var cx = (W - cw) / 2, cy = (H - ch) / 2;
    // 弹窗投影（增强层次）
    Utils.roundRect(ctx, cx + 3, cy + 7, cw, ch, 24, 'rgba(80,50,20,0.28)');
    Utils.roundRect(ctx, cx, cy, cw, ch, 24, '#fffdf7');
    // 顶部装饰条
    Utils.roundRect(ctx, cx + cw / 2 - 42, cy + 24, 84, 9, 4.5, '#ffb36b');
    Utils.drawText(ctx, modal.title, W / 2, cy + 62, { size: 32, weight: 'bold', color: '#6b4a35' });
    for (var i = 0; i < modal.lines.length; i++) {
      Utils.drawText(ctx, modal.lines[i], W / 2, cy + 118 + i * 44, { size: 24, color: '#8a6a45' });
    }
    var rects = modalButtonRects(modal);
    for (var r = 0; r < rects.length; r++) {
      var btn = rects[r].btn;
      var bx = rects[r].x, by = rects[r].y, bw = rects[r].w, bh = rects[r].h;
      var primary = btn.style !== 'ghost';
      var fillC = btn.style === 'danger' ? '#e05555' : (primary ? '#ff8f3f' : '#f0e4d2');
      var strokeC = btn.style === 'danger' ? '#d03f3f' : (primary ? '#ff8f3f' : '#d9b98c');
      Utils.roundRect(ctx, bx + 2, by + 3, bw, bh, 16, 'rgba(140,90,50,0.18)');
      Utils.roundRect(ctx, bx, by, bw, bh, 16, fillC, strokeC);
      Utils.drawText(ctx, btn.label, bx + bw / 2, by + bh / 2, { size: 25, weight: 'bold', color: primary ? '#fff' : '#8a5a33' });
    }
  }

  // ---------- 提示 ----------
  function drawToast(ctx, toast) {
    if (!toast) return;
    var life = 1 - (Date.now() - toast.t0) / toast.dur;
    if (life <= 0) return;
    ctx.globalAlpha = Math.min(1, life * 2.5);
    var w = Utils.measure(ctx, toast.text, 26) + 60;
    Utils.roundRect(ctx, (W - w) / 2, 330, w, 56, 28, 'rgba(60,40,25,0.85)');
    // 气泡小尾巴
    ctx.beginPath();
    ctx.moveTo(W / 2 - 9, 386);
    ctx.lineTo(W / 2, 404);
    ctx.lineTo(W / 2 + 9, 386);
    ctx.closePath();
    ctx.fill();
    Utils.drawText(ctx, toast.text, W / 2, 358, { size: 26, color: '#fff' });
    ctx.globalAlpha = 1;
  }

  // ---------- 后台齿轮（右上角入口） ----------
  function drawAdminGear(ctx) {
    // 房间入口（🏠，⚙ 左边）——缩小上移，避免与状态卡重叠
    var rx = 628, ry = 32, rr = 20;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = '#d9b98c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    Utils.drawText(ctx, '🏠', rx, ry + 1, { size: 20, color: '#8a5a33' });
    // 后台齿轮
    var gx = 702, gy = 32, gr = 20;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = '#d9b98c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 齿轮符号
    Utils.drawText(ctx, '⚙', gx, gy + 1, { size: 24, color: '#8a5a33' });
  }

  // ---------- 房间面板（最多 3 个房间） ----------
  // info: { index, exists, isCurrent, summary }
  function roomsRects(info) {
    var c = { x: 60, y: 220 + info.index * 230, w: 630, h: 200 };
    var buttons;
    if (info.exists) {
      buttons = [
        { id: 'enter', x: 130, y: c.y + 142, w: 230, h: 54 },
        { id: 'reset', x: 390, y: c.y + 142, w: 230, h: 54 }
      ];
    } else {
      buttons = [{ id: 'new', x: 250, y: c.y + 142, w: 250, h: 54 }];
    }
    return { card: c, buttons: buttons };
  }

  function drawRooms(ctx, game) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff7ea');
    bg.addColorStop(1, '#ffe9d0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(180,120,70,0.12)';
    drawPaw(ctx, 90, 640, 22);
    drawPaw(ctx, 660, 900, 22);

    Utils.drawText(ctx, '房间', 375, 120, { size: 44, weight: 'bold', color: '#8a5a33' });
    Utils.drawText(ctx, '最多 3 个房间，每个房间的宠物各自独立、互不影响', 375, 165, { size: 21, color: '#a0805a' });

    // 返回
    var back = { x: 20, y: 40, w: 130, h: 62 };
    Utils.roundRect(ctx, back.x, back.y, back.w, back.h, 14, 'rgba(255,255,255,0.9)', '#d9b98c');
    Utils.drawText(ctx, '← 返回', back.x + back.w / 2, back.y + back.h / 2, { size: 24, color: '#8a5a33' });

    for (var i = 0; i < 3; i++) {
      var info = game.rooms ? game.rooms.roomInfo(i) : { index: i, exists: false, isCurrent: false, summary: '' };
      var r = roomsRects(info);
      var c = r.card;
      Utils.roundRect(ctx, c.x, c.y, c.w, c.h, 20,
        info.isCurrent ? 'rgba(255,255,255,0.95)' : 'rgba(238,234,226,0.9)',
        info.isCurrent ? '#ff8f3f' : '#d9cfbe');
      Utils.drawText(ctx, '房间 ' + (i + 1), c.x + 26, c.y + 44, { size: 28, weight: 'bold', align: 'left', color: '#6b4a35' });
      if (info.isCurrent) {
        Utils.drawText(ctx, '当前', c.x + c.w - 88, c.y + 46, { size: 20, weight: 'bold', color: '#ff8f3f' });
      }
      Utils.drawText(ctx, info.summary || (info.exists ? '已有一个存档' : '空房间，可以开新档'),
        c.x + 26, c.y + 92, { size: 20, align: 'left', color: '#a0805a' });
      for (var b = 0; b < r.buttons.length; b++) {
        var btn = r.buttons[b];
        var pressed = game.pressedId === ('rooms_' + info.index + '_' + btn.id);
        var label = btn.id === 'enter' ? '进入' : (btn.id === 'reset' ? '重置重养' : '＋ 新房间（不重置）');
        var accent = btn.id === 'reset';
        Utils.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14,
          pressed ? (accent ? '#e76a6a' : '#e87f2f') : (accent ? '#f08080' : '#ff8f3f'),
          accent ? '#f08080' : '#ff8f3f');
        Utils.drawText(ctx, label, btn.x + btn.w / 2, btn.y + btn.h / 2, { size: 22, weight: 'bold', color: '#fff' });
      }
    }
  }

  // ---------- 院子（六块地 + 六种植物） ----------
  function drawPlant(ctx, type, g, x, y, w) {
    var def = Pets_plantInfo[type];
    var leaf = (def && def.leaf) || '#4fae6b';
    var flower = (def && def.flower) || '#c77bff';
    var emoji = (def && def.emoji) || '🌱';
    if (g < 0.25) {
      // 幼苗：两片小芽
      Utils.drawText(ctx, '🌱', x, y - 10, { size: Math.max(16, w * 0.16), color: '#4fae6b' });
      return;
    }
    // 生长/成熟：茎 + 叶 + 花/果
    var sc = 0.55 + g * 0.45;
    var stemH = w * 0.55 * sc;
    ctx.strokeStyle = '#4a8a3f';
    ctx.lineWidth = Math.max(3, w * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.08, y - stemH * 0.6, x + w * 0.02, y - stemH);
    ctx.stroke();
    // 叶子
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(x - w * 0.10, y - stemH * 0.5, w * 0.16, w * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.13, y - stemH * 0.72, w * 0.15, w * 0.055, 0.6, 0, Math.PI * 2);
    ctx.fill();
    if (g >= 1) {
      // 成熟：果实 + 光晕
      ctx.fillStyle = 'rgba(255,220,120,0.35)';
      Utils.ell(ctx, x + w * 0.02, y - stemH - w * 0.05, w * 0.42, w * 0.42);
      Utils.drawText(ctx, emoji, x + w * 0.02, y - stemH, { size: Math.max(24, w * 0.3) });
      // 成熟标记
      Utils.drawText(ctx, '🎉 可收获', x + w * 0.02, y - stemH - w * 0.28, { size: Math.max(12, w * 0.09), color: '#e8883f' });
    } else {
      // 未成熟：小花苞 / 果雏形
      ctx.fillStyle = flower;
      Utils.ell(ctx, x + w * 0.02, y - stemH, w * 0.14, w * 0.14);
    }
  }

  function drawYard(ctx, game) {
    var W2 = W, H2 = H;
    // 天空
    var sky = ctx.createLinearGradient(0, 0, 0, H2);
    sky.addColorStop(0, '#a8dcf5');
    sky.addColorStop(0.55, '#d8f0fb');
    sky.addColorStop(1, '#e8f7e0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W2, H2);
    // 太阳 + 云
    ctx.fillStyle = '#ffd76a';
    Utils.ell(ctx, 630, 130, 44, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    Utils.ell(ctx, 120, 120, 44, 20);
    Utils.ell(ctx, 160, 112, 30, 16);
    Utils.ell(ctx, 250, 170, 36, 16);
    Utils.ell(ctx, 285, 163, 26, 14);
    // 草地
    var grass = ctx.createLinearGradient(0, 300, 0, H2);
    grass.addColorStop(0, '#8fcf6f');
    grass.addColorStop(1, '#6bb84f');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 300, W2, H2 - 300);
    // 远景小树（栅栏后，地平线处）
    function drawTree(tx, ty, ts) {
      ctx.fillStyle = '#8a5a33';
      ctx.fillRect(tx - 3 * ts, ty, 6 * ts, 30 * ts);
      ctx.fillStyle = '#5cb86b';
      Utils.ell(ctx, tx - 14 * ts, ty - 8 * ts, 20 * ts, 22 * ts);
      Utils.ell(ctx, tx + 14 * ts, ty - 10 * ts, 20 * ts, 22 * ts);
      Utils.ell(ctx, tx, ty - 22 * ts, 24 * ts, 26 * ts);
      ctx.fillStyle = '#7cc576';
      Utils.ell(ctx, tx - 4 * ts, ty - 16 * ts, 12 * ts, 12 * ts);
    }
    drawTree(560, 312, 1.15);
    drawTree(668, 316, 0.85);
    // 栅栏
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 300); ctx.lineTo(W2, 300);
    ctx.moveTo(0, 340); ctx.lineTo(W2, 340);
    ctx.stroke();
    for (var fx = 30; fx < W2; fx += 55) {
      ctx.fillStyle = '#d9b98c';
      Utils.roundRect(ctx, fx, 280, 26, 70, 5);
    }
    // 返回按钮
    Utils.roundRect(ctx, 20, 40, 130, 62, 14, '#fff', '#c9a86a');
    Utils.drawText(ctx, '← 房间', 85, 76, { size: 26, weight: 'bold', color: '#6b4a35' });
    // 右上角池塘按钮
    Utils.roundRect(ctx, 620, 40, 110, 62, 14, 'rgba(160,210,255,0.95)', '#4aa3df');
    Utils.drawText(ctx, '🐟 池塘', 675, 76, { size: 24, weight: 'bold', color: '#2a5a8a' });
    // 标题
    Utils.drawText(ctx, '小院子 🌻', 375, 80, { size: 34, weight: 'bold', color: '#5a7a3f' });
    Utils.drawText(ctx, '种子初始每种 1 颗 · 收获可得新种子 · 成熟 30 天', 375, 116, { size: 17, color: '#8a5a33' });
    Utils.drawText(ctx, '💩 肥料 ×' + game.fertilizer + ' · 铲屎可得 · 1 坨加速植物 1 天', 375, 142, { size: 16, color: '#8a5a33' });
    // 金币（池塘按钮旁）
    Utils.roundRect(ctx, 618, 108, 114, 40, 20, 'rgba(255,214,102,0.95)', '#d9a520');
    Utils.drawText(ctx, '🪙 ' + game.coins, 675, 134, { size: 20, weight: 'bold', color: '#8a5a00' });

    // 左侧粮仓小屋（点击进仓库：加工粮 / 存粮）
    var gx = 25, gy = 720, gw = 160, gh = 100;
    Utils.roundRect(ctx, gx, gy + 22, gw, gh - 22, 10, '#e8d8b8', '#c9a86a');
    ctx.fillStyle = '#a06a3a';
    ctx.beginPath();
    ctx.moveTo(gx - 6, gy + 26);
    ctx.lineTo(gx + gw / 2, gy - 6);
    ctx.lineTo(gx + gw + 6, gy + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c98a52';
    Utils.roundRect(ctx, gx + gw / 2 - 22, gy + 52, 44, 48, 4);
    Utils.drawText(ctx, '🏚 仓库', gx + gw / 2, gy + 118, { size: 20, weight: 'bold', color: '#6b4a35' });
    Utils.drawText(ctx, '加工粮 · 存粮', gx + gw / 2, gy + 148, { size: 15, color: '#a0805a' });

    // 六块地
    var L = game.yardLayout();
    var now = Date.now();
    for (var i = 0; i < L.plots.length; i++) {
      var plot = L.plots[i];
      var pl = game.yard[i];
      // 地块投影 + 棕色土地（白描边）
      Utils.roundRect(ctx, plot.x, plot.y + 5, plot.w, plot.h, 14, 'rgba(80,50,20,0.18)');
      Utils.roundRect(ctx, plot.x, plot.y, plot.w, plot.h, 14, '#b97a3f', '#f6e3c2');
      ctx.strokeStyle = 'rgba(120,70,20,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(plot.x + 12, plot.y + plot.h / 2); ctx.lineTo(plot.x + plot.w - 12, plot.y + plot.h / 2);
      ctx.moveTo(plot.x + plot.w / 2, plot.y + 12); ctx.lineTo(plot.x + plot.w / 2, plot.y + plot.h - 12);
      ctx.stroke();
      if (pl) {
        // 种了植物
        var g = Pets_plantGrowth(pl, now);
        drawPlant(ctx, pl.type, g, plot.x + plot.w / 2, plot.y + plot.h - 22, plot.w);
        // 地块序号角标 + 植物名
        Utils.drawText(ctx, '第' + (i + 1) + '块地', plot.x + 14, plot.y + 26, { size: 15, color: '#fff' });
        Utils.drawText(ctx, Pets_plantLabel(pl.type) + (g >= 1 ? '（成熟）' : ''),
          plot.x + plot.w / 2, plot.y + 24, { size: 17, weight: 'bold', color: '#fff' });
      } else {
        // 空地
        Utils.drawText(ctx, '第' + (i + 1) + '块地 · 空地', plot.x + plot.w / 2, plot.y + plot.h / 2, { size: 18, color: '#fff' });
        Utils.drawText(ctx, '点一下播种', plot.x + plot.w / 2, plot.y + plot.h / 2 + 28, { size: 15, color: 'rgba(255,255,255,0.9)' });
      }
    }

    // 底部种子栏
    Utils.roundRect(ctx, 10, 970, W2 - 20, 180, 20, 'rgba(255,255,255,0.92)', '#c9a86a');
    Utils.drawText(ctx, '种子栏（点选种子 → 点空地播种）· 左边铲子可铲除未长好的植物', 375, 1000, { size: 16, weight: 'bold', color: '#6b4a35' });
    // 铲子工具格
    var shovelSel = game.selectedTool === 'shovel';
    Utils.roundRect(ctx, L.tool.x, L.tool.y, L.tool.w, L.tool.h, 12,
      shovelSel ? '#fff2d6' : 'rgba(246,227,194,0.7)',
      shovelSel ? '#e05555' : '#d9b98c');
    // 自绘铲子：木柄 + 铲头
    var shx = L.tool.x + L.tool.w / 2;
    ctx.strokeStyle = '#b07a3f';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shx, L.tool.y + 30);
    ctx.lineTo(shx, L.tool.y + 62);
    ctx.stroke();
    ctx.fillStyle = '#8d939b';
    ctx.beginPath();
    ctx.moveTo(shx - 14, L.tool.y + 64);
    ctx.lineTo(shx + 14, L.tool.y + 64);
    ctx.lineTo(shx + 9, L.tool.y + 84);
    ctx.lineTo(shx - 9, L.tool.y + 84);
    ctx.closePath();
    ctx.fill();
    Utils.drawText(ctx, '铲子', shx, L.tool.y + 96, { size: 15, color: '#6b4a35' });
    for (var s = 0; s < L.seeds.length; s++) {
      var sb = L.seeds[s];
      var def2 = Pets_plantInfo[L.seeds[s].key] || { emoji: '🌱', label: L.seeds[s].key };
      var cnt = game.seeds[L.seeds[s].key] || 0;
      var sel = game.selectedSeed === L.seeds[s].key;
      Utils.roundRect(ctx, sb.x, sb.y, sb.w, sb.h, 12,
        sel ? '#fff2d6' : 'rgba(246,227,194,0.7)',
        sel ? '#ff8f3f' : '#d9b98c');
      Utils.drawText(ctx, def2.emoji, sb.x + sb.w / 2, sb.y + 34, { size: 32 });
      Utils.drawText(ctx, def2.label, sb.x + sb.w / 2, sb.y + 60, { size: 15, color: '#6b4a35' });
      Utils.drawText(ctx, '× ' + cnt, sb.x + sb.w / 2, sb.y + 84, { size: 18, weight: 'bold', color: cnt > 0 ? '#e8883f' : '#bbb' });
    }
  }

  // ---------- 池塘（鱼 / 虾 / 乌龟） ----------
  function drawPond(ctx, game) {
    // 水面背景
    var water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, '#bfe6f8');
    water.addColorStop(0.15, '#7cc4ec');
    water.addColorStop(1, '#1f6f9e');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);
    // 水面右上太阳光晕
    var halo = ctx.createRadialGradient(650, 60, 10, 650, 60, 220);
    halo.addColorStop(0, 'rgba(255,255,255,0.30)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, 420);
    // 斜向高光带（波光粼粼）
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(120, 0); ctx.lineTo(420, 0); ctx.lineTo(300, H); ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // 波纹
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (var wv = 0; wv < 8; wv++) {
      var wy = 180 + wv * 95;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      for (var wx2 = 0; wx2 <= W; wx2 += 40) {
        ctx.quadraticCurveTo(wx2 + 20, wy + (wv % 2 ? -7 : 7), wx2 + 40, wy);
      }
      ctx.stroke();
    }
    // 底部沙石
    ctx.fillStyle = '#d9b98c';
    ctx.fillRect(0, 1150, W, H - 1150);
    ctx.fillStyle = 'rgba(120,80,40,0.35)';
    for (var st = 0; st < 14; st++) {
      Utils.ell(ctx, (st * 137 + 40) % W, 1140 + (st % 3) * 26, 14 + (st % 4) * 5, 9 + (st % 3) * 4);
    }
    // 水草（两侧）
    ctx.strokeStyle = '#3f9e4f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (var g2 = 0; g2 < 3; g2++) {
      var gx = 40 + g2 * 26, gy = 1160;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx - 14, gy - 60, gx, gy - 110);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx + 8, gy);
      ctx.quadraticCurveTo(gx + 22, gy - 45, gx + 10, gy - 85);
      ctx.stroke();
    }
    for (var g3 = 0; g3 < 3; g3++) {
      var gx2 = W - 60 - g3 * 26;
      ctx.beginPath();
      ctx.moveTo(gx2, 1160);
      ctx.quadraticCurveTo(gx2 + 14, gy - 60, gx2, gy - 105);
      ctx.stroke();
    }
    // 睡莲叶（点缀水面，避开水族网格）
    var lily = [
      { x: 185, y: 505, r: 26 }, { x: 520, y: 720, r: 22 }, { x: 300, y: 830, r: 18 }
    ];
    for (var li = 0; li < lily.length; li++) {
      var lf = lily[li];
      ctx.fillStyle = '#4a9e4f';
      ctx.beginPath();
      ctx.ellipse(lf.x, lf.y, lf.r, lf.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f8f4a';
      ctx.beginPath();
      ctx.moveTo(lf.x, lf.y);
      ctx.lineTo(lf.x + lf.r * 0.9, lf.y - lf.r * 0.4);
      ctx.lineTo(lf.x + lf.r * 1.1, lf.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lf.x, lf.y);
      ctx.lineTo(lf.x + lf.r * 0.6, lf.y + lf.r * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#ffb3d1';
      Utils.ell(ctx, lf.x + lf.r * 0.5, lf.y - lf.r * 0.25, 7, 5);
    }
    // 小气泡（上升感）
    var bubbles = [
      { x: 140, y: 640, r: 7 }, { x: 620, y: 480, r: 5 }, { x: 420, y: 620, r: 9 }, { x: 250, y: 900, r: 6 }
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (var bu = 0; bu < bubbles.length; bu++) {
      var bp = bubbles[bu];
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(bp.x - bp.r * 0.3, bp.y - bp.r * 0.3, bp.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
    }

    // 返回按钮
    Utils.roundRect(ctx, 20, 40, 130, 62, 14, '#fff', '#4aa3df');
    Utils.drawText(ctx, '← 院子', 85, 76, { size: 26, weight: 'bold', color: '#2a5a8a' });
    // 捞网按钮（右上角）
    var netSel = !!game.selectedNet;
    Utils.roundRect(ctx, 620, 40, 110, 62, 14, netSel ? '#fff2d6' : 'rgba(160,210,255,0.95)', netSel ? '#e05555' : '#4aa3df');
    // 自绘捞网图标（不依赖 emoji 字体，老系统也正常）
    var nc = netSel ? '#d03f3f' : '#2a5a8a';
    ctx.strokeStyle = nc;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(646, 72, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(634, 72); ctx.lineTo(658, 72);
    ctx.moveTo(646, 60); ctx.lineTo(646, 84);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(646 + 10, 82);
    ctx.lineTo(646 + 24, 96);
    ctx.stroke();
    Utils.drawText(ctx, netSel ? '捞网中' : '捞网', 690, 76, { size: 22, weight: 'bold', color: nc });
    // 标题
    Utils.drawText(ctx, '小池塘 🐟', 375, 80, { size: 34, weight: 'bold', color: '#fff' });
    Utils.drawText(ctx, '初始 100 克 · 每年涨 100 克 · 最多 8 只', 375, 116, { size: 17, color: 'rgba(255,255,255,0.95)' });
    // 金币显示
    Utils.roundRect(ctx, 300, 130, 150, 40, 20, 'rgba(255,214,102,0.95)', '#d9a520');
    Utils.drawText(ctx, '🪙 ' + game.coins, 375, 156, { size: 20, weight: 'bold', color: '#8a5a00' });

    // 水族（网格分布 + 游动动画，位置与点击命中共用 game.pondPos）
    var now = Date.now();
    var t = game.time / 1000;
    for (var i = 0; i < game.pond.length && i < 8; i++) {
      var p = game.pond[i];
      var pos = game.pondPos(i, t);
      var bx = pos.ax, by = pos.ay;
      var def = Pets_pondInfo[p.species] || { emoji: '🐟', label: '鱼' };
      var sc = Pets_pondScale(p, now);
      var fs = Math.max(30, 44 * sc);
      // 重量标签
      var wg = Math.round(Pets_pondWeight(p, now));
      var tag = def.label + ' ' + wg + 'g';
      var tw = Utils.measure(ctx, tag, 17) + 18;
      Utils.roundRect(ctx, bx - tw / 2, by - fs - 46, tw, 26, 13, 'rgba(255,255,255,0.92)', netSel ? '#e05555' : '#4aa3df');
      Utils.drawText(ctx, tag, bx, by - fs - 27, { size: 17, weight: 'bold', color: netSel ? '#d03f3f' : '#2a5a8a' });
      // 动物
      Utils.drawText(ctx, def.emoji, bx, by, { size: fs });
      // 年龄
      var days = Math.max(0, Math.floor((now - (p.createdAt || now)) / 86400000));
      Utils.drawText(ctx, days + ' 天', bx, by + fs / 2 + 14, { size: 14, color: 'rgba(255,255,255,0.9)' });
    }
    if (game.pond.length === 0) {
      Utils.drawText(ctx, '池塘空空的，去下面领养一只吧～', 375, 560, { size: 24, color: 'rgba(255,255,255,0.95)' });
    }

    // 底部领养栏
    Utils.roundRect(ctx, 10, 960, W - 20, 220, 20, 'rgba(255,255,255,0.92)', '#4aa3df');
    Utils.drawText(ctx, '领养（点卡片添加一只）· 已有 ' + game.pond.length + '/8 只', 375, 992, { size: 18, weight: 'bold', color: '#2a5a8a' });
    Pets_POND_ORDER.forEach(function (k, i) {
      var card = { x: 25 + i * 250, y: 1000, w: 220, h: 150 };
      var d3 = Pets_pondInfo[k] || { emoji: '🐟', label: k };
      Utils.roundRect(ctx, card.x, card.y + 5, card.w, card.h, 14, 'rgba(20,60,90,0.22)');
      Utils.roundRect(ctx, card.x, card.y, card.w, card.h, 14, 'rgba(230,244,255,0.92)', '#4aa3df');
      Utils.drawText(ctx, d3.emoji, card.x + card.w / 2, card.y + 52, { size: 44 });
      Utils.drawText(ctx, '领养' + d3.label, card.x + card.w / 2, card.y + 92, { size: 22, weight: 'bold', color: '#2a5a8a' });
      Utils.drawText(ctx, '1 金币 · 初始 100g', card.x + card.w / 2, card.y + 124, { size: 16, color: '#5a8ab0' });
    });
  }

  // ---------- 仓库（农产品 → 加工成粮 → 存粮） ----------
  function drawStore(ctx, game) {
    // 背景（木屋仓库风）
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fdf3dd');
    bg.addColorStop(1, '#ecd9b0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // 木地板条纹
    ctx.strokeStyle = 'rgba(140,90,40,0.18)';
    ctx.lineWidth = 3;
    for (var f = 0; f < 12; f++) {
      ctx.beginPath();
      ctx.moveTo(0, 240 + f * 90);
      ctx.lineTo(W, 240 + f * 90);
      ctx.stroke();
    }
    // 返回按钮
    Utils.roundRect(ctx, 20, 40, 130, 62, 14, '#fff', '#c9a86a');
    Utils.drawText(ctx, '← 院子', 85, 76, { size: 26, weight: 'bold', color: '#6b4a35' });
    // 标题
    Utils.drawText(ctx, '粮仓 🏚', 375, 80, { size: 34, weight: 'bold', color: '#6b4a35' });
    Utils.drawText(ctx, '农产品加工成粮 · 粮可以添到粮碗喂宠物', 375, 116, { size: 17, color: '#8a5a33' });

    // 粮（大字显示）
    Utils.roundRect(ctx, 25, 160, 700, 110, 16, 'rgba(255,255,255,0.9)', '#c9a86a');
    Utils.drawText(ctx, '🍚 粮 ×' + game.store.food, 100, 218, { size: 34, weight: 'bold', color: '#6b4a35' });
    Utils.drawText(ctx, '💩 肥料 ×' + game.fertilizer, 640, 218, { size: 26, weight: 'bold', color: '#8a5a33' });

    // 农产品 2 行 × 3 列
    Utils.drawText(ctx, '农产品（收获植物获得）', 375, 330, { size: 22, weight: 'bold', color: '#6b4a35' });
    var order = Pets_PLANT_ORDER || ['orchid', 'corn', 'peach', 'peanut', 'watermelon', 'banana'];
    for (var i = 0; i < 6; i++) {
      var k = order[i];
      var def = Pets_plantInfo[k] || { emoji: '🌱', label: k };
      var cx = 25 + (i % 3) * 240, cy = 360 + Math.floor(i / 3) * 150;
      Utils.roundRect(ctx, cx, cy, 220, 130, 14, 'rgba(255,255,255,0.92)', '#d9c69a');
      Utils.drawText(ctx, def.emoji, cx + 60, cy + 52, { size: 40 });
      Utils.drawText(ctx, def.label, cx + 105, cy + 40, { size: 22, color: '#6b4a35' });
      Utils.drawText(ctx, '× ' + (game.store.crops[k] || 0), cx + 105, cy + 82, { size: 24, weight: 'bold', color: '#e8883f' });
    }

    // 底部操作按钮
    Utils.roundRect(ctx, 25, 1050, 340, 90, 16, '#ffb347', '#ff8f3f');
    Utils.drawText(ctx, '🍳 全部加工成粮', 195, 1100, { size: 26, weight: 'bold', color: '#fff' });
    Utils.roundRect(ctx, 385, 1050, 340, 90, 16, '#6fc1e8', '#4aa3df');
    Utils.drawText(ctx, '🍚 添粮到粮碗', 555, 1100, { size: 26, weight: 'bold', color: '#fff' });
  }

  // ---------- 商店（种子购买 1 金币/颗） ----------
  function drawShop(ctx, game) {
    // 背景（木屋商店风）
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff6e0');
    bg.addColorStop(1, '#f3ddb8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // 木地板条纹
    ctx.strokeStyle = 'rgba(140,90,40,0.18)';
    ctx.lineWidth = 3;
    for (var f = 0; f < 12; f++) {
      ctx.beginPath();
      ctx.moveTo(0, 240 + f * 90);
      ctx.lineTo(W, 240 + f * 90);
      ctx.stroke();
    }
    // 返回按钮
    Utils.roundRect(ctx, 20, 40, 130, 62, 14, '#fff', '#c9a86a');
    Utils.drawText(ctx, '← 院子', 85, 76, { size: 26, weight: 'bold', color: '#6b4a35' });
    // 标题 + 金币
    Utils.drawText(ctx, '🛒 商店', 360, 80, { size: 34, weight: 'bold', color: '#6b4a35' });
    Utils.roundRect(ctx, 510, 44, 190, 54, 27, 'rgba(255,214,102,0.95)', '#d9a520');
    Utils.drawText(ctx, '🪙 ' + game.coins, 605, 78, { size: 26, weight: 'bold', color: '#8a5a00' });
    Utils.drawText(ctx, '种子 1 金币/颗 · 点击卡片购买', 375, 135, { size: 18, color: '#8a5a33' });
    // 卖出说明
    Utils.roundRect(ctx, 25, 160, 700, 66, 14, 'rgba(255,255,255,0.85)', '#e0c89a');
    Utils.drawText(ctx, '💡 卖出：成熟植物 3 金币 · 出生宠物 12 金币 · 池塘动物每 100 克 1 金币', 375, 196, { size: 17, color: '#8a5a33' });

    // 六种种子卡
    var order = Pets_PLANT_ORDER || ['orchid', 'corn', 'peach', 'peanut', 'watermelon', 'banana'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var def = Pets_plantInfo[k] || { emoji: '🌱', label: k };
      var cx = 30 + i * 120;
      Utils.roundRect(ctx, cx, 260, 108, 190, 14, 'rgba(255,255,255,0.92)', '#d9b98c');
      Utils.drawText(ctx, def.emoji, cx + 54, 340, { size: 46 });
      Utils.drawText(ctx, def.label, cx + 54, 385, { size: 21, color: '#6b4a35' });
      Utils.roundRect(ctx, cx + 14, 395, 80, 34, 17, '#ffb347', '#ff8f3f');
      Utils.drawText(ctx, '1 金币', cx + 54, 418, { size: 18, weight: 'bold', color: '#fff' });
      Utils.drawText(ctx, '已有 ×' + (game.seeds[k] || 0), cx + 54, 442, { size: 15, color: '#a0805a' });
    }
  }

  // 供 game 使用
  var Render = {
    LAYOUT: LAYOUT,
    W: W, H: H,
    project: project,
    drawRoom: drawRoom,
    drawBowl: drawBowl,
    drawNest: drawNest,
    drawBall: drawBall,
    drawLitter: drawLitter,
    drawAdminGear: drawAdminGear,
    drawRooms: drawRooms,
    roomsRects: roomsRects,
    drawYard: drawYard,
    drawPond: drawPond,
    drawStore: drawStore,
    drawShop: drawShop,
    drawTombstone: drawTombstone,
    drawPet: drawPet,
    drawParticles: drawParticles,
    drawChip: drawChip,
    drawChipNav: drawChipNav,
    drawActionBar: drawActionBar,
    drawSetup: drawSetup,
    drawAddPet: drawAddPet,
    drawModal: drawModal,
    drawToast: drawToast,
    modalButtonRects: modalButtonRects,
    setupCardRect: setupCardRect,
    setupNameBoxRect: setupNameBoxRect,
    setPetsAPI: function (api) {
      Pets_needs = api.needs; Pets_mood = api.mood;
      if (api.weightFactor) Pets_weightFactor = api.weightFactor;
      if (api.weightKg) Pets_weightKg = api.weightKg;
      if (api.speciesOrder) Pets_speciesOrder = api.speciesOrder;
      if (api.speciesInfo) Pets_speciesInfo = api.speciesInfo;
      if (api.plantInfo) Pets_plantInfo = api.plantInfo;
      if (api.plantGrowth) Pets_plantGrowth = api.plantGrowth;
      if (api.plantLabel) Pets_plantLabel = api.plantLabel;
      if (api.plantOrder) Pets_PLANT_ORDER = api.plantOrder;
      if (api.pondInfo) Pets_pondInfo = api.pondInfo;
      if (api.pondWeight) Pets_pondWeight = api.pondWeight;
      if (api.pondScale) Pets_pondScale = api.pondScale;
      if (api.pondOrder) Pets_POND_ORDER = api.pondOrder;
    }
  };

  return Render;
});

