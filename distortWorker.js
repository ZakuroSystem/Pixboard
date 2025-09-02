self.onmessage = function(e) {
  const { imageData, amount } = e.data;
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);
      angle += amount * dist / maxDist;
      const sx = Math.round(cx + dist * Math.cos(angle));
      const sy = Math.round(cy + dist * Math.sin(angle));
      const dstIdx = (y * width + x) * 4;
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        const srcIdx = (sy * width + sx) * 4;
        output.data[dstIdx] = data[srcIdx];
        output.data[dstIdx + 1] = data[srcIdx + 1];
        output.data[dstIdx + 2] = data[srcIdx + 2];
        output.data[dstIdx + 3] = data[srcIdx + 3];
      }
    }
  }
  self.postMessage(output);
};
