const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const layers = [];
let selectedLayer = -1;
let brightness = 0;
let contrast = 0;
let filter = 'none';
let saturationThreshold = 50;
let draggingLayer = false;
let saturationAdj = 0;
let hueRotate = 0;
let blurAmount = 0;
let sharpnessAmount = 0;
let invertColors = false;
let cropping = false;
let maskMode = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let cropRect = null;
let maskRect = null;
let startX = 0;
let startY = 0;
let draggingHandle = null;
let rotatingLayer = false;
let rotateStartAngle = 0;
let rotateStartRotation = 0;
const HANDLE_SIZE = 6;
let isTextMode = false;
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

let currentLang = 'en';
const i18n = {
  en: {
    title: 'Pixboard',
    rotateLeft: 'Rotate -90°',
    rotateRight: 'Rotate +90°',
    flipH: 'Flip Horizontal',
    flipV: 'Flip Vertical',
    undoBtn: 'Undo',
    redoBtn: 'Redo',
    widthLabel: 'Width:',
    heightLabel: 'Height:',
    resizeBtn: 'Resize',
    adjustHeading: 'Adjustments',
    brightnessLabel: 'Brightness:',
    saturationLabel: 'Saturation Threshold:',
    contrastLabel: 'Contrast:',
    saturationAdjLabel: "Saturation:",
    hueLabel: "Hue:",
    sharpnessLabel: "Sharpness:",
    blurLabel: "Blur:",
    invertLabel: "Invert:",
    zoomLabel: 'Zoom:',
    filterHeading: 'Filters',
    filterNormal: 'Normal',
    filterGray: 'Grayscale',
    filterSepia: 'Sepia',
    filterPartial: 'Partial Grayscale',
    textPlaceholder: 'Text',
    addTextBtn: 'Add Text',
    maskModeBtn: 'Mask Mode',
    batchBtn: 'Batch Process',
    stickerHeading: 'Stickers',
    bringForwardBtn: 'Bring Forward',
    sendBackwardBtn: 'Send Backward',
    deleteBtn: 'Delete',
    wLabel: 'W:',
    hLabel: 'H:',
    rotLabel: 'Rot:',
    cropBtn: 'Crop',
    savePngBtn: 'Save PNG',
    saveJpgBtn: 'Save JPG',
    resetBtn: 'Reset',
    restoreConfirm: 'Restore previous session?'
  },
  ja: {
    title: 'ピックスボード',
    rotateLeft: '左90°回転',
    rotateRight: '右90°回転',
    flipH: '左右反転',
    flipV: '上下反転',
    undoBtn: '元に戻す',
    redoBtn: 'やり直す',
    widthLabel: '幅:',
    heightLabel: '高さ:',
    resizeBtn: 'サイズ変更',
    adjustHeading: '画像調整',
    brightnessLabel: '明るさ:',
    saturationLabel: '彩度しきい値:',
    contrastLabel: 'コントラスト:',
    saturationAdjLabel: "彩度:",
    hueLabel: "色相:",
    sharpnessLabel: "シャープネス:",
    blurLabel: "ぼかし:",
    invertLabel: "反転:",
    zoomLabel: 'ズーム:',
    filterHeading: 'フィルター',
    filterNormal: 'ノーマル',
    filterGray: 'グレースケール',
    filterSepia: 'セピア',
    filterPartial: '部分グレー',
    textPlaceholder: 'テキスト',
    addTextBtn: 'テキスト追加',
    maskModeBtn: 'マスクモード',
    batchBtn: '一括処理',
    stickerHeading: 'スタンプ',
    bringForwardBtn: '前面へ',
    sendBackwardBtn: '背面へ',
    deleteBtn: '削除',
    wLabel: '幅:',
    hLabel: '高さ:',
    rotLabel: '回転:',
    cropBtn: 'トリミング',
    savePngBtn: 'PNG保存',
    saveJpgBtn: 'JPG保存',
    resetBtn: '全てリセット',
    restoreConfirm: '前回の編集を復元しますか?'
  }
};

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[currentLang] && i18n[currentLang][key]) {
      el.textContent = i18n[currentLang][key];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (i18n[currentLang] && i18n[currentLang][key]) {
      el.placeholder = i18n[currentLang][key];
    }
  });
}

let viewScale = 1;
let pinchDist = null;

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / viewScale;
  const y = (e.clientY - rect.top) / viewScale;
  return { x, y };
}
const stickerPaths = [
  'assets/stickers/circle.png',
  'assets/stickers/heart.png',
  'assets/stickers/square.png',
  'assets/stickers/star.png',
  'assets/stickers/triangle.png'
];

window.addEventListener('load', () => {
  initStickers();
  adjustCanvas();
  applyTranslations();
  const saved = localStorage.getItem('pixboard-autosave');
  if (saved && confirm(i18n[currentLang].restoreConfirm)) {
    loadState(saved);
  }
  setInterval(() => {
    if (canvas.width && canvas.height) {
      try {
        localStorage.setItem('pixboard-autosave', canvas.toDataURL());
      } catch (e) {
        console.error('Autosave failed', e);
      }
    }
  }, 5000);
});

window.addEventListener('resize', adjustCanvas);
document.getElementById('langSelect').addEventListener('change', e => {
  currentLang = e.target.value;
  document.documentElement.lang = currentLang;
  applyTranslations();
});

window.addEventListener('keydown', e => {
  if (selectedLayer === -1) return;
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowUp':
      layers[selectedLayer].y -= step;
      break;
    case 'ArrowDown':
      layers[selectedLayer].y += step;
      break;
    case 'ArrowLeft':
      layers[selectedLayer].x -= step;
      break;
    case 'ArrowRight':
      layers[selectedLayer].x += step;
      break;
    case 'Delete':
      deleteLayer();
      return;
    default:
      return;
  }
  redraw();
});

function adjustCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  document.getElementById('width').value = canvas.width;
  document.getElementById('height').value = canvas.height;
  redraw();
}

document.getElementById('singleFileInput').addEventListener('change', event => {
  batchFiles = Array.from(event.target.files);
  if (batchFiles.length === 0) return;
  for (const file of batchFiles) addImageFromFile(file);
});

function addImageFromFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    layers.push({type:'image', img:image, x, y, width:w, height:h, rotation:0, scaleX:1, scaleY:1, visible:true, mask:null});
    selectedLayer = layers.length - 1;
    resetHistory();
    redraw();
  };
  image.src = url;
}

canvas.addEventListener('mousedown', e => {
  const {x, y} = getCanvasCoords(e);
  if (isTextMode) {
    addTextLayer(x, y);
    isTextMode = false;
    return;
  }
  if (maskMode && selectedLayer !== -1) {
    startX = x;
    startY = y;
    maskRect = null;
    return;
  }
  const handle = getHandleAt(x, y);
  if (handle) {
    if (handle === 'rotate') {
      rotatingLayer = true;
      const layer = layers[selectedLayer];
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      rotateStartAngle = Math.atan2(y - cy, x - cx);
      rotateStartRotation = layer.rotation || 0;
    } else {
      draggingHandle = handle;
      startX = x;
      startY = y;
    }
    return;
  }
  const idx = getLayerAt(x, y);
  if (idx !== -1) {
    selectedLayer = idx;
    updateLayerControls();
    draggingLayer = true;
    dragOffsetX = x - layers[idx].x;
    dragOffsetY = y - layers[idx].y;
  } else {
    cropping = true;
    startX = x;
    startY = y;
    cropRect = null;
  }
});

canvas.addEventListener('mousemove', e => {
  const {x, y} = getCanvasCoords(e);
  if (draggingHandle && selectedLayer !== -1) {
    const layer = layers[selectedLayer];
    const dx = x - startX;
    const dy = y - startY;
    if (draggingHandle === 'nw') {
      layer.x += dx;
      layer.y += dy;
      layer.width -= dx;
      layer.height -= dy;
    } else if (draggingHandle === 'ne') {
      layer.y += dy;
      layer.width += dx;
      layer.height -= dy;
    } else if (draggingHandle === 'sw') {
      layer.x += dx;
      layer.width -= dx;
      layer.height += dy;
    } else if (draggingHandle === 'se') {
      layer.width += dx;
      layer.height += dy;
    }
    startX = x;
    startY = y;
    document.getElementById('layerWidth').value = Math.abs(layer.width);
    document.getElementById('layerHeight').value = Math.abs(layer.height);
    redraw();
  } else if (rotatingLayer && selectedLayer !== -1) {
    const layer = layers[selectedLayer];
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const ang = Math.atan2(y - cy, x - cx);
    const deg = (ang - rotateStartAngle) * 180 / Math.PI;
    layer.rotation = rotateStartRotation + deg;
    document.getElementById('layerRotation').value = layer.rotation;
    redraw();
  } else if (draggingLayer && selectedLayer !== -1) {
    layers[selectedLayer].x = x - dragOffsetX;
    layers[selectedLayer].y = y - dragOffsetY;
    redraw();
  } else if (maskMode && maskRect !== null) {
    maskRect = {
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY)
    };
    redraw();
  } else if (cropping) {
    cropRect = {
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY)
    };
    redraw();
  }
});

canvas.addEventListener('mouseup', () => {
  draggingLayer = false;
  cropping = false;
  draggingHandle = null;
  rotatingLayer = false;
  if (maskMode && selectedLayer !== -1 && maskRect) {
    layers[selectedLayer].mask = maskRect;
    maskRect = null;
    maskMode = false;
    redraw();
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.05 : 0.95;
  viewScale *= factor;
  document.getElementById('zoom').value = Math.round(viewScale * 100);
  redraw();
}, { passive: false });

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && pinchDist) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = dist / pinchDist;
    pinchDist = dist;
    viewScale *= factor;
    document.getElementById('zoom').value = Math.round(viewScale * 100);
    redraw();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) pinchDist = null;
});

function redraw() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(viewScale, viewScale);
  drawLayers(ctx);
  applyFilters();
  if (cropRect) {
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.restore();
  }
  if (maskRect) {
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(maskRect.x, maskRect.y, maskRect.w, maskRect.h);
    ctx.restore();
  }
  ctx.restore();
}

function drawLayers(targetCtx) {
  layers.forEach((layer, i) => {
    if (!layer.visible) return;
    targetCtx.save();
    if (layer.mask) {
      targetCtx.beginPath();
      targetCtx.rect(layer.mask.x, layer.mask.y, layer.mask.w, layer.mask.h);
      targetCtx.clip();
    }
    targetCtx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
    targetCtx.rotate((layer.rotation || 0) * Math.PI / 180);
    if (layer.type === 'image' || layer.type === 'sticker') {
      targetCtx.drawImage(layer.img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
    } else if (layer.type === 'text') {
      targetCtx.fillStyle = layer.color;
      targetCtx.font = `${layer.size}px sans-serif`;
      targetCtx.textBaseline = 'top';
      targetCtx.fillText(layer.text, -layer.width / 2, -layer.height / 2);
    }
    targetCtx.restore();
    if (i === selectedLayer) {
      targetCtx.save();
      targetCtx.strokeStyle = 'blue';
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      const hs = HANDLE_SIZE;
      const handles = [
        [layer.x, layer.y],
        [layer.x + layer.width, layer.y],
        [layer.x, layer.y + layer.height],
        [layer.x + layer.width, layer.y + layer.height]
      ];
      targetCtx.fillStyle = 'white';
      handles.forEach(pt => {
        targetCtx.fillRect(pt[0] - hs, pt[1] - hs, hs * 2, hs * 2);
        targetCtx.strokeRect(pt[0] - hs, pt[1] - hs, hs * 2, hs * 2);
      });
      // rotation handle
      const cx = layer.x + layer.width / 2;
      const cy = layer.y - 20;
      targetCtx.beginPath();
      targetCtx.moveTo(cx, layer.y);
      targetCtx.lineTo(cx, cy);
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, hs * 1.5, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.restore();
    }
  });
}

function applyFilters() {
  if (brightness === 0 &&
      contrast === 0 &&
      saturationAdj === 0 &&
      hueRotate === 0 &&
      blurAmount === 0 &&
      sharpnessAmount === 0 &&
      !invertColors &&
      filter === 'none') return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const adj = (brightness / 100) * 255;
  const cAdj = contrast * 2.55;
  const factor = (259 * (cAdj + 255)) / (255 * (259 - cAdj));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 0) {
      r += adj;
      g += adj;
      b += adj;
    }
    if (contrast !== 0) {
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;
    }

    if (saturationAdj !== 0 || hueRotate !== 0) {
      let [h, s, l] = rgbToHsl(r, g, b);
      if (saturationAdj !== 0) {
        s *= 1 + saturationAdj / 100;
        s = Math.min(1, Math.max(0, s));
      }
      if (hueRotate !== 0) {
        h = (h + hueRotate / 360) % 1;
        if (h < 0) h += 1;
      }
      [r, g, b] = hslToRgb(h, s, l);
    }

    if (invertColors) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    if (filter === 'grayscale') {
      const avg = (r + g + b) / 3;
      r = g = b = avg;
    } else if (filter === 'sepia') {
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = tr;
      g = tg;
      b = tb;
    } else if (filter === 'saturation-gray') {
      const maxVal = Math.max(r, g, b);
      const minVal = Math.min(r, g, b);
      const sat = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal * 100;
      if (sat <= saturationThreshold) {
        const avg = (r + g + b) / 3;
        r = g = b = avg;
      }
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  if (blurAmount > 0) applyBlur(data, canvas.width, canvas.height, blurAmount);
  if (sharpnessAmount > 0) applySharpen(data, canvas.width, canvas.height, sharpnessAmount);

  ctx.putImageData(imageData, 0, 0);
}

function rotate(deg) {
  if (selectedLayer === -1) return;
  saveState();
  layers[selectedLayer].rotation = ((layers[selectedLayer].rotation || 0) + deg) % 360;
  document.getElementById('layerRotation').value = layers[selectedLayer].rotation;
  redraw();
}

function flipX() {
  if (selectedLayer === -1) return;
  saveState();
  layers[selectedLayer].width *= -1;
  redraw();
}

function flipY() {
  if (selectedLayer === -1) return;
  saveState();
  layers[selectedLayer].height *= -1;
  redraw();
}

function resizeCanvas() {
  saveState();
  const w = parseInt(document.getElementById('width').value, 10);
  const h = parseInt(document.getElementById('height').value, 10);
  if (w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    redraw();
  }
}

function savePNG() {
  try {
    canvas.toBlob(blob => saveBlob(blob, 'image.png'), 'image/png');
  } catch (e) {
    console.error('Failed to save PNG', e);
  }
}

function saveJPG() {
  try {
    canvas.toBlob(blob => saveBlob(blob, 'image.jpg'), 'image/jpeg');
  } catch (e) {
    console.error('Failed to save JPG', e);
  }
}

function saveBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetEditor() {
  saveState();
  brightness = 0;
  contrast = 0;
  filter = 'none';
  saturationThreshold = 50;
  layers.length = 0;
  selectedLayer = -1;
  cropRect = null;
  document.getElementById('brightness').value = 0;
  document.getElementById('contrast').value = 0;
  document.getElementById('saturationThreshold').value = 50;
  document.querySelectorAll('#filter-buttons button').forEach(btn => btn.classList.remove('active'));
  const normalBtn = document.querySelector('#filter-buttons button[data-filter="none"]');
  if (normalBtn) normalBtn.classList.add('active');
  redraw();
  resetHistory();
}

function cropCanvas() {
  if (!cropRect || cropRect.w === 0 || cropRect.h === 0) return;
  saveState();
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext('2d');
  drawLayers(offCtx);

  const data = offCtx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  const temp = document.createElement('canvas');
  temp.width = cropRect.w;
  temp.height = cropRect.h;
  temp.getContext('2d').putImageData(data, 0, 0);
  const url = temp.toDataURL();

  const image = new Image();

  image.onload = () => {
    canvas.width = cropRect.w;
    canvas.height = cropRect.h;
    canvas.style.width = cropRect.w + 'px';
    canvas.style.height = cropRect.h + 'px';
    document.getElementById('width').value = cropRect.w;
    document.getElementById('height').value = cropRect.h;
    layers.length = 0;
    layers.push({type:'image', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true, mask:null});
    selectedLayer = 0;
    cropRect = null;
    redraw();
  };
  image.src = url;
}

function setBrightness(value) {
  saveState();
  brightness = parseInt(value, 10) || 0;
  redraw();
}
function setContrast(value) {
  saveState();
  contrast = parseInt(value, 10) || 0;
  redraw();
}
function setFilter(value) {
  saveState();
  filter = value || 'none';
  document.querySelectorAll('#filter-buttons button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  redraw();
}

function setSaturationThreshold(value) {
  saveState();
  saturationThreshold = parseInt(value, 10) || 0;
  redraw();
}

function setZoom(value) {
  viewScale = parseFloat(value) / 100 || 1;
  redraw();
}

function setSaturation(value) {
  saveState();
  saturationAdj = parseInt(value, 10) || 0;
  redraw();
}

function setHue(value) {
  saveState();
  hueRotate = parseInt(value, 10) || 0;
  redraw();
}

function setSharpness(value) {
  saveState();
  sharpnessAmount = parseFloat(value) || 0;
  redraw();
}

function setBlur(value) {
  saveState();
  blurAmount = parseFloat(value) || 0;
  redraw();
}

function setInvert(value) {
  saveState();
  invertColors = value;
  redraw();
}

function enableTextMode() {
  isTextMode = true;
}

function enableMaskMode() {
  if (selectedLayer !== -1) {
    maskMode = true;
  }
}

function addTextLayer(x, y) {
  const text = document.getElementById('textInput').value;
  if (!text) return;
  const color = document.getElementById('textColor').value;
  const size = parseInt(document.getElementById('textSize').value, 10) || 20;
  const width = ctx.measureText(text).width;
  layers.push({type:'text', text, color, size, x, y, width, height:size, rotation:0, scaleX:1, scaleY:1, visible:true, mask:null});
  selectedLayer = layers.length - 1;
  saveState();
  redraw();
}

function addSticker(src) {
  const image = new Image();

  image.onload = () => {
    layers.push({type:'sticker', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true, mask:null});
    selectedLayer = layers.length - 1;
    updateLayerControls();
    saveState();
    redraw();
  };
  image.src = src;
}

function initStickers() {
  const container = document.getElementById('sticker-container');
  stickerPaths.forEach(path => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = path;
    img.className = 'w-12 h-12 cursor-pointer';
    img.addEventListener('click', () => addSticker(path));
    container.appendChild(img);
  });
}

function getLayerAt(x, y) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const w = Math.abs(layer.width);
    const h = Math.abs(layer.height);
    if (x >= layer.x && x <= layer.x + w && y >= layer.y && y <= layer.y + h) {
      return i;
    }
  }
  return -1;
}

function getHandleAt(x, y) {
  if (selectedLayer === -1) return null;
  const layer = layers[selectedLayer];
  const hs = HANDLE_SIZE;
  const handles = {
    nw: {x: layer.x, y: layer.y},
    ne: {x: layer.x + layer.width, y: layer.y},
    sw: {x: layer.x, y: layer.y + layer.height},
    se: {x: layer.x + layer.width, y: layer.y + layer.height}
  };
  for (const key in handles) {
    const hx = handles[key].x;
    const hy = handles[key].y;
    if (x >= hx - hs && x <= hx + hs && y >= hy - hs && y <= hy + hs) {
      return key;
    }
  }
  const cx = layer.x + layer.width / 2;
  const cy = layer.y - 20;
  if (Math.hypot(x - cx, y - cy) <= hs * 1.5) {
    return 'rotate';
  }
  return null;
}

function updateLayerControls() {
  const box = document.getElementById('layer-controls');
  if (selectedLayer === -1) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  const layer = layers[selectedLayer];
  document.getElementById('layerWidth').value = Math.abs(layer.width);
  document.getElementById('layerHeight').value = Math.abs(layer.height);
  document.getElementById('layerRotation').value = layer.rotation || 0;
}

function updateLayerSize() {
  if (selectedLayer === -1) return;
  const w = parseInt(document.getElementById('layerWidth').value, 10);
  const h = parseInt(document.getElementById('layerHeight').value, 10);
  if (!isNaN(w)) layers[selectedLayer].width = Math.sign(layers[selectedLayer].width || 1) * w;
  if (!isNaN(h)) layers[selectedLayer].height = Math.sign(layers[selectedLayer].height || 1) * h;
  redraw();
}

function updateLayerRotation() {
  if (selectedLayer === -1) return;
  const r = parseFloat(document.getElementById('layerRotation').value) || 0;
  layers[selectedLayer].rotation = r;
  redraw();
}

function deleteLayer() {
  if (selectedLayer === -1) return;
  layers.splice(selectedLayer, 1);
  selectedLayer = -1;
  updateLayerControls();
  redraw();
}

function bringForward() {
  if (selectedLayer === -1 || selectedLayer === layers.length - 1) return;
  const layer = layers.splice(selectedLayer, 1)[0];
  layers.push(layer);
  selectedLayer = layers.length - 1;
  redraw();
}

function sendBackward() {
  if (selectedLayer <= 0) return;
  const layer = layers.splice(selectedLayer, 1)[0];
  layers.unshift(layer);
  selectedLayer = 0;
  redraw();
}

function saveState() {
  if (undoStack.length >= MAX_HISTORY) undoStack.shift();
  try {
    undoStack.push(canvas.toDataURL());
  } catch (e) {
    console.error('Failed to save state', e);
  }
  redoStack = [];
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  saveState();
}

function loadState(dataURL) {
  const image = new Image();

  image.onload = () => {
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.style.width = image.width + 'px';
    canvas.style.height = image.height + 'px';
    document.getElementById('width').value = image.width;
    document.getElementById('height').value = image.height;
    layers.length = 0;
    layers.push({type:'image', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true, mask:null});
    selectedLayer = 0;
    brightness = 0;
    contrast = 0;
    filter = 'none';
    cropRect = null;
    document.getElementById('brightness').value = 0;
    document.getElementById('contrast').value = 0;
    redraw();
  };
  image.src = dataURL;
}

function undo() {
  if (undoStack.length === 0) return;
  try {
    redoStack.push(canvas.toDataURL());
  } catch (e) {
    console.error('Failed to capture redo state', e);
  }
  const data = undoStack.pop();
  loadState(data);
}

function redo() {
  if (redoStack.length === 0) return;
  try {
    undoStack.push(canvas.toDataURL());
  } catch (e) {
    console.error('Failed to capture undo state', e);
  }
  const data = redoStack.pop();
  loadState(data);
}

function openBatchEditor() {
  document.getElementById('singleEditor').style.display = 'none';
  document.getElementById('batchContainer').classList.remove('hidden');
}

function closeBatchEditor() {
  document.getElementById('batchContainer').classList.add('hidden');
  document.getElementById('singleEditor').style.display = 'flex';
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

function applyBlur(data, w, h, radius) {
  const r = Math.round(radius);
  if (r <= 0) return;
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let tr = 0, tg = 0, tb = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const idx = (ny * w + nx) * 4;
            tr += copy[idx];
            tg += copy[idx+1];
            tb += copy[idx+2];
            count++;
          }
        }
      }
      const i = (y * w + x) * 4;
      data[i] = tr / count;
      data[i+1] = tg / count;
      data[i+2] = tb / count;
    }
  }
}

function applySharpen(data, w, h, amount) {
  if (amount <= 0) return;
  const copy = new Uint8ClampedArray(data);
  const center = 5 + parseFloat(amount);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let r = center * copy[i];
      let g = center * copy[i+1];
      let b = center * copy[i+2];
      const idxN = ((y-1)*w + x) * 4;
      const idxS = ((y+1)*w + x) * 4;
      const idxW = (y*w + (x-1)) * 4;
      const idxE = (y*w + (x+1)) * 4;
      r -= copy[idxN] + copy[idxS] + copy[idxW] + copy[idxE];
      g -= copy[idxN+1] + copy[idxS+1] + copy[idxW+1] + copy[idxE+1];
      b -= copy[idxN+2] + copy[idxS+2] + copy[idxW+2] + copy[idxE+2];
      data[i] = Math.min(255, Math.max(0, r));
      data[i+1] = Math.min(255, Math.max(0, g));
      data[i+2] = Math.min(255, Math.max(0, b));
    }
  }
}

// === EdiBatPlus integration ===

// editor.js - 画像編集パイプライン & 自動明るさ
const Editor = (()=>{
  // sRGB <-> Linear
  const srgbToLinear = (c)=> (c<=0.04045) ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  const linearToSrgb = (c)=> (c<=0.0031308) ? c*12.92 : (1.055*Math.pow(c,1/2.4)-0.055);
  const clamp01 = (v)=> v<0?0:(v>1?1:v);
  const clamp255 = (v)=> v<0?0:(v>255?255:v|0);

  function imageMeanLuma(imageData){
    const d = imageData.data;
    let sum = 0, n = 0;
    for (let i=0;i<d.length;i+=4){
      const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
      const y = 0.2126*r + 0.7152*g + 0.0722*b;
      sum += y; n++;
    }
    return n ? sum / n : 0;
  }

  function applyPipeline(imageData, params, autoCtx){
    const {brightnessPct, temp, ev, contrastPct, gamma, saturationPct} = params;
    const bf = Math.max(0, brightnessPct)/100;
    const t  = Math.max(-100, Math.min(100, temp))/100;
    const rGain = 1 + 0.40*t, gGain = 1 + 0.10*t, bGain = 1 - 0.40*t;
    const cf = Math.max(0, contrastPct)/100;
    const sf = Math.max(0, saturationPct)/100;
    const invGamma = 1/Math.max(0.01, gamma);

    // 自動明るさ（EV加算）
    let evTotal = ev;
    if (autoCtx && autoCtx.enabled){
      const {imageMean, datasetMean, pivotOffset, strength} = autoCtx;
      const pivot = Math.max(0, Math.min(1, datasetMean + pivotOffset));
      const delta = pivot - imageMean; // +なら明るく、-なら暗く
      // 強さ：|delta|に比例させる。係数0.75で実用的な範囲に。
      evTotal += 0.75 * strength * delta;
    }
    const ef = Math.pow(2, evTotal);

    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    for (let i=0;i<src.length;i+=4){
      let r = src[i]   /255;
      let g = src[i+1] /255;
      let b = src[i+2] /255;
      const a = src[i+3];

      // 明るさ + 色温度（sRGBゲイン）
      r = r * bf * rGain;
      g = g * bf * gGain;
      b = b * bf * bGain;

      // 露光（線形）
      let rl = srgbToLinear(clamp01(r)) * ef;
      let gl = srgbToLinear(clamp01(g)) * ef;
      let bl = srgbToLinear(clamp01(b)) * ef;
      r = linearToSrgb(rl); g = linearToSrgb(gl); b = linearToSrgb(bl);

      // コントラスト（中心0.5）
      r = (r - 0.5) * cf + 0.5;
      g = (g - 0.5) * cf + 0.5;
      b = (b - 0.5) * cf + 0.5;

      // ガンマ
      r = Math.pow(clamp01(r), invGamma);
      g = Math.pow(clamp01(g), invGamma);
      b = Math.pow(clamp01(b), invGamma);

      // 彩度（輝度距離スケール）
      const y = 0.2126*r + 0.7152*g + 0.0722*b;
      r = y + (r - y) * sf;
      g = y + (g - y) * sf;
      b = y + (b - y) * sf;

      out[i]   = clamp255(r*255);
      out[i+1] = clamp255(g*255);
      out[i+2] = clamp255(b*255);
      out[i+3] = a;
    }
    return new ImageData(out, imageData.width, imageData.height);
  }

  function toImageDataFromImage(img, w, h){
    const can = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w,h) : (()=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; })();
    const ctx = can.getContext('2d', {willReadFrequently:true});
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0,0, img.naturalWidth,img.naturalHeight, 0,0, w,h);
    return ctx.getImageData(0,0,w,h);
  }

  function drawImageDataToCanvas(imageData, canvas){
    canvas.width = imageData.width; canvas.height = imageData.height;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.putImageData(imageData, 0, 0);
  }

  return { applyPipeline, imageMeanLuma, toImageDataFromImage, drawImageDataToCanvas };
})();

let IO;
let Draw;

// inout.js - 入出力・ZIP生成・ファイル命名
IO = (()=>{
  const isImageName = (name)=> /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name);

  const App = window.App = window.App || {
    items: [],   // {id, name, img, tileCanvas, previewData, mean, selected}
    params: {
      temp: 0, brightnessPct: 100, ev: 0, contrastPct: 100, gamma: 1.0, saturationPct: 100,
      autoEnable: false, autoPivot: 0, autoStrength: 1,
    },
    scope: 'auto', // auto|sel|all|exceptSel
    nameMode: 'simple', // simple|detail
    mode: 'tile', // tile|single
    currentIndex: -1, // single mode selection index
    tightTiles: true,
    datasetMean: 0,
  };

  let nextId = 1;

  async function addFile(file){
    if (!isImageName(file.name) || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=url; }).catch(()=> URL.revokeObjectURL(url));

    // プレビューは高速モード：ブラウザ幅に対する 1/5（9枚以上） or 1/4（8枚以下）の正方形
    const tileSize = Draw.computeTileRenderSize();
    const previewData = Editor.toImageDataFromImage(img, tileSize, tileSize);
    const mean = Editor.imageMeanLuma(previewData);

    const item = {
      id: nextId++, name: file.name, file, img,
      previewData, mean,
      tileCanvas: document.createElement('canvas'),
      selected: false,
    };
    App.items.push(item);
    Draw.mountTile(item);
    URL.revokeObjectURL(url);
    Draw.updateCounts();
    recomputeDatasetMean();
    Draw.refreshAll();
  }

  async function addFilesFromList(files){
    for (const f of files){ await addFile(f); }
  }

  function recomputeDatasetMean(){
    const arr = App.items;
    if (!arr.length) { App.datasetMean = 0; return; }
    let s=0; for (const it of arr) s += it.mean;
    App.datasetMean = s/arr.length;
    const el = document.getElementById('autoVal');
    const on = App.params.autoEnable;
    el.textContent = on ? `ON（平均 ${(App.datasetMean*100).toFixed(1)}%）` : 'OFF';
  }

  // ===== ZIP（無圧縮）実装 =====
  // 参考: ZIP local file header + central directory + EOCD を手動生成（STORED/無圧縮）
  function crc32(buf){
    let table = crc32.table;
    if(!table){
      table = new Uint32Array(256);
      for(let i=0;i<256;i++){
        let c=i;
        for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
        table[i]=c>>>0;
      }
      crc32.table = table;
    }
    let crc = 0 ^ (-1);
    for (let i=0;i<buf.length;i++){
      crc = (crc>>>8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function textEncoder(){ return new TextEncoder(); }
  function writeUint16(view, offset, v){ view.setUint16(offset, v, true); }
  function writeUint32(view, offset, v){ view.setUint32(offset, v, true); }

  async function blobFromCanvasPNG(canvas){
    return await new Promise(res=> canvas.toBlob(res, 'image/png'));
  }

  function buildFileName(baseName, params, nameMode){
    const bn = baseName.replace(/\.[^.]+$/, '');
    if (nameMode === 'simple') return bn + '_edited.png';
    const t = params.temp|0, b=params.brightnessPct|0, ev=params.ev.toFixed(1),
          c=params.contrastPct|0, g=params.gamma.toFixed(2), s=params.saturationPct|0;
    const auto = params.autoEnable ? `_auto(p${params.autoPivot.toFixed(2)}-k${params.autoStrength.toFixed(2)})` : '';
    return `${bn}_temp${t}_b${b}_ev${ev}_c${c}_g${g}_s${s}${auto}.png`;
  }

  async function exportAll(){
    const { items, nameMode } = App;
    if (!items.length) return;
    const scopeItems = Draw.targetsForApply(); // 実際の対象（非選択含む）だがエクスポートは全/選択にしたい？要件：8枚以上はZIP
    const selected = items.filter(x=>x.selected);
    const exportItems = (App.scope === 'sel') ? (selected.length? selected : []) :
                         (App.scope === 'exceptSel') ? items.filter(x=>!x.selected) :
                         (App.scope === 'all') ? items :
                         (selected.length? selected : items);

    if (items.length >= 8){
      // ZIP エクスポート
      const files = [];
      for (const it of exportItems){
        const full = await Draw.renderEditedFullsize(it); // フル解像度Canvas
        const blob = await blobFromCanvasPNG(full);
        const arr = new Uint8Array(await blob.arrayBuffer());
        const name = buildFileName(it.name, (it.params? {...App.params, ...it.params} : App.params), nameMode);
        files.push({name, data: arr});
      }
      const zipBlob = buildZip(files);
      const a = document.createElement('a');
      a.download = 'export.zip';
      a.href = URL.createObjectURL(zipBlob);
      a.click();
      setTimeout(()=> URL.revokeObjectURL(a.href), 1500);
    } else {
      // 少数：個別ダウンロード
      for (const it of exportItems){
        const full = await Draw.renderEditedFullsize(it);
        const blob = await blobFromCanvasPNG(full);
        const a = document.createElement('a');
        a.download = buildFileName(it.name, (it.params? {...App.params, ...it.params} : App.params), nameMode);
        a.href = URL.createObjectURL(blob);
        a.click();
        setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
      }
    }
  }

  function buildZip(files){
    const enc = textEncoder();
    let fileParts = [];
    let centralParts = [];
    let offset = 0;

    for (const f of files){
      const nameBytes = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const compSize = data.length;
      const uncompSize = data.length;

      // Local file header
      const lh = new DataView(new ArrayBuffer(30));
      writeUint32(lh, 0, 0x04034b50);
      writeUint16(lh, 4, 20); // version
      writeUint16(lh, 6, 0);  // flags
      writeUint16(lh, 8, 0);  // method 0=store
      writeUint16(lh, 10, 0); // time
      writeUint16(lh, 12, 0); // date
      writeUint32(lh, 14, crc);
      writeUint32(lh, 18, compSize);
      writeUint32(lh, 22, uncompSize);
      writeUint16(lh, 26, nameBytes.length);
      writeUint16(lh, 28, 0); // extra len

      fileParts.push(new Uint8Array(lh.buffer));
      fileParts.push(nameBytes);
      fileParts.push(data);

      // Central directory header
      const ch = new DataView(new ArrayBuffer(46));
      writeUint32(ch, 0, 0x02014b50);
      writeUint16(ch, 4, 20); // version made by
      writeUint16(ch, 6, 20); // version needed
      writeUint16(ch, 8, 0);  // flags
      writeUint16(ch, 10, 0); // method
      writeUint16(ch, 12, 0); // time
      writeUint16(ch, 14, 0); // date
      writeUint32(ch, 16, crc);
      writeUint32(ch, 20, compSize);
      writeUint32(ch, 24, uncompSize);
      writeUint16(ch, 28, nameBytes.length);
      writeUint16(ch, 30, 0); // extra
      writeUint16(ch, 32, 0); // comment
      writeUint16(ch, 34, 0); // disk number
      writeUint16(ch, 36, 0); // internal attrs
      writeUint32(ch, 38, 0); // external attrs
      writeUint32(ch, 42, offset);
      centralParts.push(new Uint8Array(ch.buffer));
      centralParts.push(nameBytes);

      offset += 30 + nameBytes.length + data.length;
    }

    const fileBlob = new Blob(fileParts, {type:'application/octet-stream'});
    const centralBlob = new Blob(centralParts, {type:'application/octet-stream'});
    const fileSize = fileBlob.size;
    const centralSize = centralBlob.size;
    const eocd = new DataView(new ArrayBuffer(22));
    writeUint32(eocd, 0, 0x06054b50);
    writeUint16(eocd, 4, 0); // disk
    writeUint16(eocd, 6, 0); // cd start disk
    writeUint16(eocd, 8, files.length);
    writeUint16(eocd, 10, files.length);
    writeUint32(eocd, 12, centralSize);
    writeUint32(eocd, 16, fileSize);
    writeUint16(eocd, 20, 0); // comment length

    return new Blob([fileBlob, centralBlob, new Uint8Array(eocd.buffer)], {type:'application/zip'});
  }

  // ===== 初期化：イベント登録 =====
  function initIO(){
    const openDirBtn = document.getElementById('openDir');
    const openDirFallbackBtn = document.getElementById('openDirFallback');
    const dirInput = document.getElementById('dirInput');
    const addFilesBtn = document.getElementById('addFiles');
    const fileInput = document.getElementById('fileInput');
    const exportBtn = document.getElementById('exportAll');

    openDirBtn.addEventListener('click', async ()=>{
      if ('showDirectoryPicker' in window){
        try{
          const dirHandle = await window.showDirectoryPicker({id:'pictures', mode:'read'});
          for await (const [name, handle] of dirHandle.entries()){
            if (handle.kind === 'file' && isImageName(name)){
              const file = await handle.getFile();
              await addFile(file);
            }
          }
        }catch(e){ /* cancel */ }
      } else {
        dirInput.click();
      }
    });
    openDirFallbackBtn.addEventListener('click', ()=> dirInput.click());
    dirInput.addEventListener('change', async (e)=>{
      await addFilesFromList(Array.from(e.target.files || []));
    });

    addFilesBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', async (e)=>{
      await addFilesFromList(Array.from(e.target.files || []));
    });

    exportBtn.addEventListener('click', exportAll);
  }

  return { initIO, addFile, addFilesFromList, exportAll, buildFileName, recomputeDatasetMean, App };
})();

// draw.js - 画面描画・選択・モード・単品編集プレビュー
Draw = (()=>{
  const App = IO.App;
  const grid = document.getElementById('grid');
  const countChip = document.getElementById('countChip');
  const selChip = document.getElementById('selChip');

  // single-edit elements
  const split = document.getElementById('split');
  const thumbGrid = document.getElementById('thumbGrid');
  const detailCanvas = document.getElementById('detailCanvas');
  const detailName = document.getElementById('detailName');

  // ===== レイアウト =====
  function columnsForCount(cnt){
    return (cnt >= 9) ? 5 : 4; // 9枚以上→5列, それ以下→4列
  }
  function computeTileRenderSize(){
    const vw = Math.max(320, window.innerWidth);
    const cols = columnsForCount(App.items.length || 1);
    const gap = grid.classList.contains('tight') ? 3 : 12;
    const padding = grid.classList.contains('tight') ? 6 : 24;
    const w = Math.floor((vw - padding - gap*(cols-1)) / cols);
    return Math.max(64, w);
  }

  function applyGridClass(){
    const cols = columnsForCount(App.items.length);
    grid.classList.toggle('cols5', cols === 5);
  }

  // ===== 対象決定（適用範囲） =====
  function targetsForApply(){
    const selected = App.items.filter(x=>x.selected);
    if (App.scope === 'all') return App.items;
    if (App.scope === 'sel') return selected;
    if (App.scope === 'exceptSel') return App.items.filter(x=>!x.selected);
    // auto
    return selected.length ? selected : App.items;
  }

  // ===== タイル構築 =====
  function mountTile(item){
    const tile = document.createElement('div');
    tile.className = 'tile';
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = '未選択';

    const canvas = item.tileCanvas;
    canvas.className = 'canvas';
    redrawPreview(item);

    tile.append(badge, canvas);
    grid.appendChild(tile);

    const indexOf = ()=> App.items.indexOf(item);
    tile.addEventListener('click', (e)=>{
      const idx = indexOf();
      clickSelect(idx, e.shiftKey);
      // 単品編集モードならクリックで右側に表示
      if (App.mode === 'single'){
        setCurrentIndex(idx);
      }
    });

    item._tile = tile;
    item._badge = badge;
    refreshTileSelection(item);
    refreshLayout();
  }

  function refreshTileSelection(item){
    item._tile.classList.toggle('selected', item.selected);
    item._badge.textContent = item.selected ? '選択中' : '未選択';
  }

  function clickSelect(index, shiftKey){
    if (index<0 || index>=App.items.length) return;
    const it = App.items[index];
    if (shiftKey && typeof clickSelect._last === 'number'){
      const [a,b] = [Math.min(clickSelect._last,index), Math.max(clickSelect._last,index)];
      for(let i=a;i<=b;i++){
        App.items[i].selected = true;
        refreshTileSelection(App.items[i]);
      }
    } else {
      it.selected = !it.selected;
      refreshTileSelection(it);
      clickSelect._last = index;
    }
    updateCounts();
  }

  function updateCounts(){
    countChip.textContent = `${App.items.length} 枚`;
    const n = App.items.filter(x=>x.selected).length;
    selChip.textContent = `選択 ${n}`;
  }

  // ===== 描画（タイル） =====
  function redrawPreview(item){
    const params = paramsForItem(item);
    const tileSize = computeTileRenderSize();
    if (item.previewData.width !== tileSize){
      item.previewData = Editor.toImageDataFromImage(item.img, tileSize, tileSize);
      item.mean = Editor.imageMeanLuma(item.previewData);
    }
    const autoCtx = params.autoEnable ? {
      enabled: true,
      imageMean: item.mean,
      datasetMean: App.datasetMean,
      pivotOffset: params.autoPivot || 0,
      strength: params.autoStrength || 1,
    } : null;

    const out = Editor.applyPipeline(item.previewData, params, autoCtx);
    const ctx = item.tileCanvas.getContext('2d', {willReadFrequently:true});
    item.tileCanvas.width = out.width; item.tileCanvas.height = out.height;
    ctx.putImageData(out, 0, 0);
  }

  function refreshAll(){
    applyGridClass();
    if (App.mode === 'tile'){
      for (const it of App.items){ redrawPreview(it); }
    } else {
      redrawThumbs();
      redrawDetail();
    }
  }

  function refreshLayout(){
    applyGridClass();
  }

  // ===== フルサイズ描画（保存用） =====
  async function renderEditedFullsize(item){
    const w = item.img.naturalWidth, h = item.img.naturalHeight;
    const can = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w,h) : (()=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; })();
    const ctx = can.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(item.img, 0,0);
    let data = ctx.getImageData(0,0,w,h);
    const params = paramsForItem(item);
    const autoCtx = params.autoEnable ? {
      enabled: true,
      imageMean: item.mean, // 近似：プレビュー平均
      datasetMean: App.datasetMean,
      pivotOffset: params.autoPivot || 0,
      strength: params.autoStrength || 1,
    } : null;
    data = Editor.applyPipeline(data, params, autoCtx);
    ctx.putImageData(data, 0, 0);
    return can;
  }

  function paramsForItem(item){
    return item.params ? {...App.params, ...item.params} : App.params;
  }

  function buildThumbsIfNeeded(){
    if (thumbGrid.children.length === App.items.length) return;
    thumbGrid.innerHTML = '';
    for (const it of App.items){ mountThumb(it); }
  }

  function mountThumb(item){
    const canvas = document.createElement('canvas');
    canvas.className = 'thumb';
    item._thumb = canvas;
    thumbGrid.appendChild(canvas);
    canvas.addEventListener('click', ()=>{
      setCurrentIndex(App.items.indexOf(item));
    });
    redrawThumb(item);
  }

  function redrawThumb(item){
    const params = paramsForItem(item);
    const size = 96;
    const ctx = item._thumb.getContext('2d', {willReadFrequently:true});
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(item.img, 0,0, item.img.naturalWidth, item.img.naturalHeight, 0,0, size, size);
    let data = ctx.getImageData(0,0,size,size);
    const autoCtx = params.autoEnable ? {
      enabled: true,
      imageMean: item.mean,
      datasetMean: App.datasetMean,
      pivotOffset: params.autoPivot || 0,
      strength: params.autoStrength || 1,
    } : null;
    data = Editor.applyPipeline(data, params, autoCtx);
    ctx.putImageData(data, 0, 0);
  }

  function setMode(m){
    if (m === 'tile'){
      App.mode = 'tile';
      split.classList.add('hidden');
      grid.classList.remove('hidden');
    } else {
      App.mode = 'single';
      split.classList.remove('hidden');
      grid.classList.add('hidden');
      buildThumbsIfNeeded();
      if (App.currentIndex < 0 && App.items.length) setCurrentIndex(0);
    }
  }

  function setCurrentIndex(idx){
    if (idx<0 || idx>=App.items.length) return;
    App.currentIndex = idx;
    const it = App.items[idx];
    detailName.textContent = it.name;
    redrawDetail();
    redrawThumbs();
  }

  function redrawDetail(){
    if (App.currentIndex<0) return;
    const it = App.items[App.currentIndex];
    let data = Editor.toImageDataFromImage(it.img, it.img.naturalWidth, it.img.naturalHeight);
    const params = paramsForItem(it);
    const autoCtx = params.autoEnable ? {
      enabled: true,
      imageMean: it.mean,
      datasetMean: App.datasetMean,
      pivotOffset: params.autoPivot || 0,
      strength: params.autoStrength || 1,
    } : null;
    const out = Editor.applyPipeline(data, params, autoCtx);
    const ctx = detailCanvas.getContext('2d', {willReadFrequently:true});
    detailCanvas.width = out.width; detailCanvas.height = out.height;
    ctx.putImageData(out, 0, 0);
  }

  function redrawThumbs(){
    buildThumbsIfNeeded();
    for (const it of App.items) redrawThumb(it);
  }

  // ===== UI バインド =====
  function initUI(){
    const modeTile = document.getElementById('modeTile');
    const modeSingle = document.getElementById('modeSingle');
    modeTile.addEventListener('click', ()=> setMode('tile'));
    modeSingle.addEventListener('click', ()=> setMode('single'));

    // 既存のバインドは draw.js 初回起動時に inout.js 側で行われる
  }

  // 公開
  return {
    mountTile, redrawPreview, refreshAll, refreshLayout, updateCounts,
    computeTileRenderSize, targetsForApply, renderEditedFullsize,
    setMode, initUI, setCurrentIndex, redrawDetail, redrawThumbs, mountThumb
  };
})();

// 初期化
(function(){
  IO.initIO();
  Draw.initUI();
  Draw.refreshLayout();
})();
// --- 追加：コントロール連動（単品モードでは per-item params を使用） ---
(function(){
  const App = IO.App;
  function attach(key, rangeId, valId, fmt){
    const ctrl = document.querySelector(`.ctrl[data-key="${key}"]`);
    if(!ctrl) return;
    const step = parseFloat(ctrl.dataset.step || '1');
    const resetVal = parseFloat(ctrl.dataset.reset);
    const range = document.getElementById(rangeId);
    const val = document.getElementById(valId);
    const minus = ctrl.querySelector('.minus');
    const plus = ctrl.querySelector('.plus');
    const reset = ctrl.querySelector('.reset');

    function apply(v){
      let nv = parseFloat(v);
      if (key === 'gamma') nv = Math.max(0.1, Math.min(3.0, nv));
      if (key === 'ev') nv = Math.max(-4, Math.min(4, nv));
      if (key === 'temp') nv = Math.max(-100, Math.min(100, nv));

      if (App.mode === 'single' && App.currentIndex >= 0){
        const it = App.items[App.currentIndex];
        if (!it.params) it.params = {...App.params}; // 初回はグローバルの値で初期化
        it.params[key] = nv;
        range.value = nv; val.textContent = fmt(nv);
        // 右プレビュー更新 & 左サムネも反映
        Draw.redrawDetail();
        Draw.redrawThumbs();
      } else {
        App.params[key] = nv;
        range.value = nv; val.textContent = fmt(nv);
        Draw.refreshAll();
      }
    }

    // 初期表示
    range.value = App.params[key];
    val.textContent = fmt(App.params[key]);

    range.addEventListener('input', ()=> apply(range.value));
    minus.addEventListener('click', ()=> apply(parseFloat(range.value) - step));
    plus.addEventListener('click', ()=> apply(parseFloat(range.value) + step));
    reset.addEventListener('click', ()=> apply(resetVal));
  }

  attach('temp','tempRange','tempVal', (v)=> `${v}`);
  attach('brightnessPct','brightRange','brightVal', (v)=> `${v}%`);
  attach('ev','expoRange','expoVal', (v)=> Number(v).toFixed(1));
  attach('contrastPct','contRange','contVal', (v)=> `${v}%`);
  attach('gamma','gammaRange','gammaVal', (v)=> Number(v).toFixed(2));
  attach('saturationPct','satRange','satVal', (v)=> `${v}%`);

  // 自動明るさ
  const autoEnable = document.getElementById('autoEnable');
  const autoPivot = document.getElementById('autoPivot');
  const autoStrength = document.getElementById('autoStrength');
  const autoRecalc = document.getElementById('autoRecalc');
  const autoVal = document.getElementById('autoVal');
  autoEnable.addEventListener('change', ()=>{
    if (App.mode==='single' && App.currentIndex>=0){
      const it = App.items[App.currentIndex];
      if (!it.params) it.params = {...App.params};
      it.params.autoEnable = autoEnable.checked;
      autoVal.textContent = it.params.autoEnable ? `ON（平均 ${(App.datasetMean*100).toFixed(1)}%）` : 'OFF';
      Draw.redrawDetail(); Draw.redrawThumbs();
    } else {
      App.params.autoEnable = autoEnable.checked;
      autoVal.textContent = App.params.autoEnable ? `ON（平均 ${(App.datasetMean*100).toFixed(1)}%）` : 'OFF';
      Draw.refreshAll();
    }
  });
  autoPivot.addEventListener('input', ()=>{
    if (App.mode==='single' && App.currentIndex>=0){
      const it = App.items[App.currentIndex]; if (!it.params) it.params = {...App.params};
      it.params.autoPivot = parseFloat(autoPivot.value);
      Draw.redrawDetail(); Draw.redrawThumbs();
    } else { App.params.autoPivot = parseFloat(autoPivot.value); Draw.refreshAll(); }
  });
  autoStrength.addEventListener('input', ()=>{
    if (App.mode==='single' && App.currentIndex>=0){
      const it = App.items[App.currentIndex]; if (!it.params) it.params = {...App.params};
      it.params.autoStrength = parseFloat(autoStrength.value);
      Draw.redrawDetail(); Draw.redrawThumbs();
    } else { App.params.autoStrength = parseFloat(autoStrength.value); Draw.refreshAll(); }
  });
  autoRecalc.addEventListener('click', ()=>{ IO.recomputeDatasetMean(); Draw.refreshAll(); });
})();
