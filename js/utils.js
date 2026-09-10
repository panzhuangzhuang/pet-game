/**
 * utils.js — 通用工具函数（无任何平台依赖，浏览器 / 微信小游戏 / Node 通用）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PG = root.PG || {};
    root.PG.Utils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Utils = {};

  Utils.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  Utils.lerp = function (a, b, t) { return a + (b - a) * t; };
  Utils.rand = function (a, b) { return a + Math.random() * (b - a); };
  Utils.randInt = function (a, b) { return Math.floor(Utils.rand(a, b + 1)); };
  Utils.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  Utils.now = function () { return Date.now(); };

  // 毫秒 -> "x天x小时" / "x小时x分" / "x分钟" / "x秒"
  Utils.fmtDuration = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + '天' + (h > 0 ? h + '小时' : '');
    if (h > 0) return h + '小时' + (m > 0 ? m + '分' : '');
    if (m > 0) return m + '分钟';
    return s + '秒';
  };

  Utils.hexToRgb = function (hex) {
    var s = String(hex || '#888888').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (isNaN(n)) return [136, 136, 136];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  Utils.rgbToHex = function (r, g, b) {
    function h(x) {
      x = Utils.clamp(Math.round(x), 0, 255);
      return (x < 16 ? '0' : '') + x.toString(16);
    }
    return '#' + h(r) + h(g) + h(b);
  };
  // 变亮（混合白色） / 变暗（混合黑色）
  Utils.lighten = function (hex, amt) {
    var c = Utils.hexToRgb(hex);
    return Utils.rgbToHex(c[0] + (255 - c[0]) * amt, c[1] + (255 - c[1]) * amt, c[2] + (255 - c[2]) * amt);
  };
  Utils.darken = function (hex, amt) {
    var c = Utils.hexToRgb(hex);
    return Utils.rgbToHex(c[0] * (1 - amt), c[1] * (1 - amt), c[2] * (1 - amt));
  };
  Utils.withAlpha = function (hex, a) {
    var c = Utils.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  // 圆角矩形路径（兼容无 roundRect 的环境）
  Utils.roundRectPath = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };
  Utils.roundRect = function (ctx, x, y, w, h, r, fill, stroke) {
    Utils.roundRectPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };

  // 椭圆（兼容无 ellipse 的环境）
  Utils.ell = function (ctx, cx, cy, rx, ry) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  };

  // 心形
  Utils.heart = function (ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.45, cy - s, cx, cy - s * 0.32);
    ctx.bezierCurveTo(cx + s * 0.45, cy - s, cx + s, cy - s * 0.4, cx, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
  };

  Utils.drawText = function (ctx, text, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = (opts.weight || '') + ' ' + (opts.size || 26) + 'px ' + (opts.family || 'sans-serif');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.lineWidth || 6;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = opts.color || '#333';
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  Utils.measure = function (ctx, text, size, weight) {
    ctx.save();
    ctx.font = (weight || '') + ' ' + (size || 26) + 'px sans-serif';
    var w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  };

  Utils.makeId = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  };

  return Utils;
});
