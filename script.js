const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const layers = [];
let selectedLayer = -1;
let brightness = 0;
let filter = 'none';
let saturationThreshold = 50;
let draggingLayer = false;
let cropping = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let cropRect = null;
let startX = 0;
let startY = 0;
let isTextMode = false;
let batchFiles = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 20;
const stickerPaths = [
  'assets/stickers/circle.png',
  'assets/stickers/heart.png',
  'assets/stickers/square.png',
  'assets/stickers/star.png',
  'assets/stickers/triangle.png'
];

window.addEventListener('load', () => {
  initStickers();
  const saved = localStorage.getItem('pixboard-autosave');
  if (saved && confirm('Restore previous session?')) {
    loadState(saved);
  }
  setInterval(() => {
    if (canvas.width && canvas.height) {
      localStorage.setItem('pixboard-autosave', canvas.toDataURL());
    }
  }, 5000);
});

document.getElementById('fileInput').addEventListener('change', event => {
  batchFiles = Array.from(event.target.files);
  if (batchFiles.length === 0) return;
  for (const file of batchFiles) addImageFromFile(file);
});

function addImageFromFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = image.width;
      canvas.height = image.height;
      document.getElementById('width').value = image.width;
      document.getElementById('height').value = image.height;
    }
    layers.push({type:'image', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true});
    selectedLayer = layers.length - 1;
    resetHistory();
    redraw();
  };
  image.src = url;
}

canvas.addEventListener('mousedown', e => {
  const x = e.offsetX;
  const y = e.offsetY;
  if (isTextMode) {
    addTextLayer(x, y);
    isTextMode = false;
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
  const x = e.offsetX;
  const y = e.offsetY;
  if (draggingLayer && selectedLayer !== -1) {
    layers[selectedLayer].x = x - dragOffsetX;
    layers[selectedLayer].y = y - dragOffsetY;
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
});

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLayers(ctx);
  applyFilters();
  if (cropRect) {
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.restore();
  }
}

function drawLayers(targetCtx) {
  layers.forEach((layer, i) => {
    if (!layer.visible) return;
    targetCtx.save();
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
      targetCtx.restore();
    }
  });
}

function applyFilters() {
  if (brightness === 0 && filter === 'none') return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const adj = (brightness / 100) * 255;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 0) {
      r += adj;
      g += adj;
      b += adj;
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
      const sat = maxVal - minVal;
      if (sat <= saturationThreshold) {
        const avg = (r + g + b) / 3;
        r = g = b = avg;
      }
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

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
    redraw();
  }
}

function savePNG() {
  canvas.toBlob(blob => saveBlob(blob, 'image.png'), 'image/png');
}

function saveJPG() {
  canvas.toBlob(blob => saveBlob(blob, 'image.jpg'), 'image/jpeg');
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
  filter = 'none';
  saturationThreshold = 50;
  layers.length = 0;
  selectedLayer = -1;
  cropRect = null;
  document.getElementById('brightness').value = 0;
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
    canvas.width = cropRect.w;␊
    canvas.height = cropRect.h;␊
    document.getElementById('width').value = cropRect.w;␊
    document.getElementById('height').value = cropRect.h;␊
    layers.length = 0;
    layers.push({type:'image', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true});
    selectedLayer = 0;
    cropRect = null;␊
    redraw();␊
  };␊
  image.src = url;
}␊

function setBrightness(value) {
  saveState();
  brightness = parseInt(value, 10) || 0;
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

function enableTextMode() {
  isTextMode = true;
}

function addTextLayer(x, y) {
  const text = document.getElementById('textInput').value;
  if (!text) return;
  const color = document.getElementById('textColor').value;
  const size = parseInt(document.getElementById('textSize').value, 10) || 20;
  const width = ctx.measureText(text).width;
  layers.push({type:'text', text, color, size, x, y, width, height:size, rotation:0, scaleX:1, scaleY:1, visible:true});
  selectedLayer = layers.length - 1;
  saveState();
  redraw();
}

function addSticker(src) {
  const image = new Image();
  image.onload = () => {
    layers.push({type:'sticker', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true});
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
  undoStack.push(canvas.toDataURL());
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
    document.getElementById('width').value = image.width;
    document.getElementById('height').value = image.height;
    layers.length = 0;
    layers.push({type:'image', img:image, x:0, y:0, width:image.width, height:image.height, rotation:0, scaleX:1, scaleY:1, visible:true});
    selectedLayer = 0;
    brightness = 0;
    filter = 'none';
    cropRect = null;
    redraw();
  };
  image.src = dataURL;
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(canvas.toDataURL());
  const data = undoStack.pop();
  loadState(data);
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(canvas.toDataURL());
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
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (brightness !== 0) {
      r += adj;
      g += adj;
      b += adj;
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
      const sat = maxVal - minVal;
      if (sat <= saturationThreshold) {
        const avg = (r + g + b) / 3;
        r = g = b = avg;
      }
    }
    imageData.data[i] = Math.min(255, Math.max(0, r));
    imageData.data[i + 1] = Math.min(255, Math.max(0, g));
    imageData.data[i + 2] = Math.min(255, Math.max(0, b));
  }
  ctx.putImageData(imageData, 0, 0);
}