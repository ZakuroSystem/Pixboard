const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = new Image();
let scaleX = 1;
let scaleY = 1;
let rotation = 0;
let brightness = 0;
let filter = 'none';
let saturationThreshold = 50;
let isDragging = false;
let cropRect = null;
let startX = 0;
let startY = 0;
let isTextMode = false;
let batchFiles = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

document.getElementById('fileInput').addEventListener('change', event => {
  batchFiles = Array.from(event.target.files);
  if (batchFiles.length === 0) return;
  loadFile(batchFiles[0]);
});

function loadFile(file) {
  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    document.getElementById('width').value = img.width;
    document.getElementById('height').value = img.height;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    resetHistory();
    redraw();
  };
  img.src = url;
}

canvas.addEventListener('mousedown', e => {
  if (isTextMode) {
    drawText(e.offsetX, e.offsetY);
    isTextMode = false;
    return;
  }
  isDragging = true;
  startX = e.offsetX;
  startY = e.offsetY;
  cropRect = null;
});

canvas.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const x = e.offsetX;
  const y = e.offsetY;
  cropRect = {
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    w: Math.abs(x - startX),
    h: Math.abs(y - startY)
  };
  redraw();
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scaleX, scaleY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  applyFilters();

  if (cropRect) {
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.restore();
  }
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
  saveState();
  rotation = (rotation + deg) % 360;
  redraw();
}

function flipX() {
  saveState();
  scaleX *= -1;
  redraw();
}

function flipY() {
  saveState();
  scaleY *= -1;
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
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
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
  offCtx.save();
  offCtx.translate(canvas.width / 2, canvas.height / 2);
  offCtx.scale(scaleX, scaleY);
  offCtx.rotate(rotation * Math.PI / 180);
  offCtx.drawImage(img, -img.width / 2, -img.height / 2);
  offCtx.restore();

  const data = offCtx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  const temp = document.createElement('canvas');
  temp.width = cropRect.w;
  temp.height = cropRect.h;
  temp.getContext('2d').putImageData(data, 0, 0);
  const url = temp.toDataURL();

  img = new Image();
  img.onload = () => {
    canvas.width = cropRect.w;
    canvas.height = cropRect.h;
    document.getElementById('width').value = cropRect.w;
    document.getElementById('height').value = cropRect.h;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    cropRect = null;
    redraw();
  };
  img.src = url;
}

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

function drawText(x, y) {
  const text = document.getElementById('textInput').value;
  if (!text) return;
  const color = document.getElementById('textColor').value;
  const size = parseInt(document.getElementById('textSize').value, 10) || 20;
  saveState();
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
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
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    brightness = 0;
    filter = 'none';
    cropRect = null;
    img = image;
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