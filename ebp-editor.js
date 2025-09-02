// editor.js - 画像編集パイプライン & 自動明るさ
export const Editor = (()=>{
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
