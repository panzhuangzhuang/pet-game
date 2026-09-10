/**
 * platform.js — 平台抽象层
 * 统一微信小游戏 (wx.*) 与浏览器 / Node 的差异：
 * 画布、图片、存储、触摸、文本输入、选图、帧循环、系统信息。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PG = root.PG || {};
    root.PG.Platform = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var isWX = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
  var isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined' && !isWX;

  var Platform = { isWX: isWX, isBrowser: isBrowser };

  // ---- 系统尺寸 ----
  Platform.system = function () {
    if (isWX) {
      var info = wx.getSystemInfoSync();
      return { width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio || 1 };
    }
    return {
      width: (window.innerWidth || 750),
      height: (window.innerHeight || 1334),
      dpr: (window.devicePixelRatio || 1)
    };
  };

  // ---- 画布 ----
  Platform.createCanvas = function () {
    if (isWX) return wx.createCanvas();
    var cv = document.getElementById('game') || document.createElement('canvas');
    if (!cv.parentNode) {
      cv.id = 'game';
      document.body.appendChild(cv);
    }
    return cv;
  };
  Platform.createOffscreenCanvas = function (w, h) {
    if (isWX) {
      var c = wx.createCanvas();
      c.width = w; c.height = h;
      return c;
    }
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  // 画布导出 dataURL（微信低版本 canvas 无 toDataURL 时走 canvasToTempFilePath）
  Platform.toDataURL = function (canvas, x, y, w, h, type, quality, cb) {
    type = type || 'image/jpeg';
    quality = quality == null ? 0.85 : quality;
    try {
      if (typeof canvas.toDataURL === 'function') {
        var url = canvas.toDataURL(type, quality);
        if (url && url.indexOf('data:') === 0) { cb(null, url); return; }
      }
    } catch (e) { /* fall through */ }
    if (isWX) {
      var cw = w || canvas.width, ch = h || canvas.height;
      wx.canvasToTempFilePath({
        canvas: canvas, x: x || 0, y: y || 0, width: cw, height: ch,
        destWidth: cw, destHeight: ch,
        fileType: type.indexOf('png') >= 0 ? 'png' : 'jpg',
        quality: quality * 100,
        success: function (res) {
          try {
            var fs = wx.getFileSystemManager();
            var base64 = fs.readFileSync(res.tempFilePath, 'base64');
            var mime = type.indexOf('png') >= 0 ? 'image/png' : 'image/jpeg';
            cb(null, 'data:' + mime + ';base64,' + base64);
          } catch (e2) { cb(e2); }
        },
        fail: function (err) { cb(err); }
      });
    } else {
      cb(new Error('toDataURL not available'));
    }
  };

  // ---- 图片 ----
  Platform.createImage = function (src, onload, onerror) {
    var img = isWX ? wx.createImage() : new Image();
    if (onload) img.onload = onload;
    if (onerror) img.onerror = onerror;
    img.src = src;
    return img;
  };

  // ---- 选择图片 ----
  Platform.chooseImage = function (cb) {
    if (isWX) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: function (res) {
          if (res && res.tempFiles && res.tempFiles.length) {
            cb(null, res.tempFiles[0].tempFilePath);
          } else {
            cb(new Error('未选择图片'));
          }
        },
        fail: function (err) { cb(err && err.errMsg ? new Error(err.errMsg) : err); }
      });
      return;
    }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(input);
    input.onchange = function () {
      var file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) { cb(new Error('未选择文件')); return; }
      var reader = new FileReader();
      reader.onload = function () { cb(null, reader.result); };
      reader.onerror = function () { cb(new Error('读取图片失败')); };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ---- 文本输入（起名等）----
  Platform.textInput = function (opts, cb) {
    opts = opts || {};
    var title = opts.title || '';
    var placeholder = opts.placeholder || '';
    var defaultValue = opts.defaultValue == null ? '' : String(opts.defaultValue);
    var maxLength = opts.maxLength || 10;

    if (isWX) {
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        try { wx.hideKeyboard(); } catch (e) {}
        try { wx.offKeyboardConfirm(confirmFn); wx.offKeyboardComplete(completeFn); } catch (e) {}
        cb(val);
      }
      var confirmFn = function (res) { finish(res.value); };
      var completeFn = function () { finish(defaultValue); };
      wx.onKeyboardConfirm(confirmFn);
      wx.onKeyboardComplete(completeFn);
      wx.showKeyboard({
        defaultValue: defaultValue,
        maxLength: maxLength,
        multiple: false,
        confirmHold: true,
        confirmType: 'done'
      });
      return;
    }

    // 浏览器：DOM 输入框浮层
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:999;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;';
    var inner = document.createElement('div');
    inner.style.cssText = 'background:#fff;border-radius:16px;padding:22px 24px;width:300px;box-shadow:0 8px 30px rgba(0,0,0,.25);';
    var t = document.createElement('div');
    t.style.cssText = 'font-size:16px;color:#333;margin-bottom:10px;text-align:center;';
    t.textContent = title || '输入名字';
    var inp = document.createElement('input');
    inp.style.cssText = 'width:100%;box-sizing:border-box;font-size:16px;padding:8px 10px;border:1px solid #ccc;border-radius:8px;outline:none;';
    inp.placeholder = placeholder;
    inp.value = defaultValue;
    inp.maxLength = maxLength;
    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px;margin-top:14px;';
    var ok = document.createElement('button');
    ok.textContent = '确定';
    ok.style.cssText = 'flex:1;padding:8px 0;font-size:15px;border:none;border-radius:8px;background:#ff8f3f;color:#fff;cursor:pointer;';
    var cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.style.cssText = 'flex:1;padding:8px 0;font-size:15px;border:none;border-radius:8px;background:#eee;color:#666;cursor:pointer;';
    btns.appendChild(cancel);
    btns.appendChild(ok);
    inner.appendChild(t);
    inner.appendChild(inp);
    inner.appendChild(btns);
    box.appendChild(inner);
    document.body.appendChild(box);
    var finished = false;
    function finish(val) {
      if (finished) return;
      finished = true;
      document.body.removeChild(box);
      cb(val);
    }
    ok.onclick = function () { finish(inp.value.trim()); };
    cancel.onclick = function () { finish(defaultValue); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') finish(inp.value.trim()); };
    setTimeout(function () { inp.focus(); }, 60);
  };

  // ---- 存储 ----
  var memStore = {};
  Platform.getStorage = function (key, def) {
    try {
      if (isWX) {
        var v = wx.getStorageSync(key);
        return (v === '' || v === null || v === undefined) ? def : v;
      }
      if (isBrowser) {
        var s = window.localStorage.getItem(key);
        return s == null ? def : JSON.parse(s);
      }
      return (key in memStore) ? memStore[key] : def;
    } catch (e) { return def; }
  };
  Platform.setStorage = function (key, val) {
    try {
      if (isWX) { wx.setStorageSync(key, val); return; }
      if (isBrowser) { window.localStorage.setItem(key, JSON.stringify(val)); return; }
      memStore[key] = val;
    } catch (e) { /* ignore */ }
  };
  Platform.removeStorage = function (key) {
    try {
      if (isWX) { wx.removeStorageSync(key); return; }
      if (isBrowser) { window.localStorage.removeItem(key); return; }
      delete memStore[key];
    } catch (e) { /* ignore */ }
  };

  // ---- 帧循环 ----
  Platform.raf = function (cb) {
    if (isWX) {
      if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(cb); return; }
      if (Platform._canvas && typeof Platform._canvas.requestAnimationFrame === 'function') {
        Platform._canvas.requestAnimationFrame(cb);
        return;
      }
      setTimeout(function () { cb(Date.now()); }, 16);
      return;
    }
    window.requestAnimationFrame(cb);
  };

  // ---- 触摸 / 鼠标事件 ----
  Platform.bindTouch = function (canvas, handlers) {
    function getXY(e) {
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY, id: e.touches[0].identifier };
      }
      if (e.changedTouches && e.changedTouches.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, id: e.changedTouches[0].identifier };
      }
      return { x: e.clientX, y: e.clientY, id: 0 };
    }
    function pipe(e, name) {
      if (e.cancelable !== false && e.preventDefault) e.preventDefault();
      if (!handlers[name]) return;
      var p = getXY(e);
      handlers[name](p.x, p.y, p.id);
    }
    if (isWX) {
      canvas.onTouchStart(function (e) { pipe(e, 'start'); });
      canvas.onTouchMove(function (e) { pipe(e, 'move'); });
      canvas.onTouchEnd(function (e) { pipe(e, 'end'); });
      canvas.onTouchCancel(function (e) { pipe(e, 'end'); });
      return;
    }
    canvas.addEventListener('touchstart', function (e) { pipe(e, 'start'); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { pipe(e, 'move'); }, { passive: false });
    canvas.addEventListener('touchend', function (e) { pipe(e, 'end'); }, { passive: false });
    canvas.addEventListener('mousedown', function (e) { pipe(e, 'start'); handlers._mouseDown = true; });
    canvas.addEventListener('mousemove', function (e) { if (handlers._mouseDown) pipe(e, 'move'); });
    window.addEventListener('mouseup', function (e) { if (handlers._mouseDown) { handlers._mouseDown = false; pipe(e, 'end'); } });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  // ---- 浏览器 query 参数（调试 / 演示用）----
  Platform.getQuery = function () {
    var q = {};
    if (!isBrowser) return q;
    var s = window.location.search.replace(/^\?/, '');
    s.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      else if (kv) q[kv] = '1';
    });
    return q;
  };

  // ---- 退到后台回调（用于自动存档）----
  Platform.onHide = function (cb) {
    if (isWX) { wx.onHide(cb); return; }
    document.addEventListener('visibilitychange', function () { if (document.hidden) cb(); });
    window.addEventListener('pagehide', cb);
  };

  return Platform;
});
