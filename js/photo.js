/**
 * photo.js — 照片 → 3D 形象素材处理
 * 居中裁剪为正方形、采样主色、生成可序列化的 dataURL 贴图。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'), require('./platform.js'));
  } else {
    root.PG = root.PG || {};
    root.PG.Photo = factory(root.PG.Utils, root.PG.Platform);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils, Platform) {
  'use strict';

  var Photo = {};
  var SIZE = 160;

  // 把图片源（dataURL / 本地临时路径）处理成宠物贴图
  // cb(err, { dataURL, colors:{main,light,dark,head}, texture(画布) })
  Photo.process = function (src, cb) {
    var img = Platform.createImage(src, function () {
      try {
        var cv = Platform.createOffscreenCanvas(SIZE, SIZE);
        var ctx = cv.getContext('2d');
        var iw = img.width || img.naturalWidth || SIZE;
        var ih = img.height || img.naturalHeight || SIZE;
        var side = Math.min(iw, ih);
        ctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, SIZE, SIZE);

        // 采样主色
        var sc = Platform.createOffscreenCanvas(8, 8);
        var sctx = sc.getContext('2d');
        sctx.drawImage(cv, 0, 0, 8, 8);
        var data = sctx.getImageData(0, 0, 8, 8).data;
        var r = 0, g = 0, b = 0, n = 0;
        for (var i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 40) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) { r = 150; g = 150; b = 150; n = 1; }
        var main = Utils.rgbToHex(r / n, g / n, b / n);
        var colors = {
          main: main,
          light: Utils.lighten(main, 0.35),
          dark: Utils.darken(main, 0.35),
          head: Utils.lighten(main, 0.18)
        };

        Platform.toDataURL(cv, 0, 0, SIZE, SIZE, 'image/jpeg', 0.85, function (err, url) {
          if (err) { cb(err); return; }
          cb(null, { dataURL: url, colors: colors, texture: cv, w: SIZE, h: SIZE });
        });
      } catch (e) { cb(e); }
    }, function () { cb(new Error('图片加载失败，请换一张试试')); });
  };

  // 从存档里的 dataURL 重建贴图画布
  Photo.loadTexture = function (dataURL, cb) {
    var img = Platform.createImage(dataURL, function () {
      try {
        var cv = Platform.createOffscreenCanvas(SIZE, SIZE);
        var ctx = cv.getContext('2d');
        var iw = img.width || img.naturalWidth || SIZE;
        var ih = img.height || img.naturalHeight || SIZE;
        var side = Math.min(iw, ih);
        ctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, SIZE, SIZE);
        cb(null, cv);
      } catch (e) { cb(e); }
    }, function () { cb(new Error('贴图加载失败')); });
  };

  return Photo;
});
