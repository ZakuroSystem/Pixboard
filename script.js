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
let batchFiles = [];
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

document.getElementById('fileInput').addEventListener('change', event => {
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

async function batchProcess() {
  if (batchFiles.length <= 1) return;
  for (const file of batchFiles) {
    const dataURL = await processFile(file);
    const blob = await (await fetch(dataURL)).blob();
    saveBlob(blob, `${file.name.replace(/\.[^/.]+$/, '')}_processed.png`);
  }
}

function processFile(file) {
  return new Promise(resolve => {
    const image = new Image();
  
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const off = document.createElement('canvas');
      const w = parseInt(document.getElementById('width').value, 10) || image.width;
      const h = parseInt(document.getElementById('height').value, 10) || image.height;
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(image, 0, 0, w, h);
      if (brightness !== 0 || filter !== 'none') {
        const data = offCtx.getImageData(0, 0, w, h);
        applyFiltersToContext(offCtx, data, w, h);
      }
      resolve(off.toDataURL('image/png'));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function applyFiltersToContext(ctx, imageData, w, h) {
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
      let [hue, sat, lit] = rgbToHsl(r, g, b);
      if (saturationAdj !== 0) {
        sat *= 1 + saturationAdj / 100;
        sat = Math.min(1, Math.max(0, sat));
      }
      if (hueRotate !== 0) {
        hue = (hue + hueRotate / 360) % 1;
        if (hue < 0) hue += 1;
      }
      [r, g, b] = hslToRgb(hue, sat, lit);
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
  if (blurAmount > 0) applyBlur(data, w, h, blurAmount);
  if (sharpnessAmount > 0) applySharpen(data, w, h, sharpnessAmount);
  ctx.putImageData(imageData, 0, 0);
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