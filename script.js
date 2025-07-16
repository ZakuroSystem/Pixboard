const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = new Image();
let scaleX = 1;
let scaleY = 1;
let rotation = 0;

document.getElementById('fileInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
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
    draw();
  };
  img.src = url;
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scaleX, scaleY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

function rotate(deg) {
  rotation = (rotation + deg) % 360;
  draw();
}

function flipX() {
  scaleX *= -1;
  draw();
}

function flipY() {
  scaleY *= -1;
  draw();
}

function resizeCanvas() {
  const w = parseInt(document.getElementById('width').value, 10);
  const h = parseInt(document.getElementById('height').value, 10);
  if (w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
    draw();
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