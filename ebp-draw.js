// draw.js - 画面描画・選択・モード・単品編集プレビュー
import { Editor } from './ebp-editor.js';
import { IO } from './ebp-inout.js';

export const Draw = (()=>{
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
    // 単品モードでは per-item params、タイルではグローバル
    if (App.mode === 'single' && item.params){
      return {...App.params, ...item.params};
    }
    return App.params;
  }

  // ===== 単品編集モード =====
  function setMode(mode){
    App.mode = mode;
    const modeTile = document.getElementById('modeTile');
    const modeSingle = document.getElementById('modeSingle');
    [modeTile, modeSingle].forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    if (mode === 'tile'){
      modeTile.classList.add('active'); modeTile.setAttribute('aria-selected','true');
      grid.style.display = 'grid';
      split.classList.remove('show');
    } else {
      modeSingle.classList.add('active'); modeSingle.setAttribute('aria-selected','true');
      grid.style.display = 'none';
      split.classList.add('show');
      if (App.currentIndex < 0 && App.items.length){
        setCurrentIndex(0);
      } else {
        // 再描画
        redrawThumbs();
        redrawDetail();
      }
    }
    refreshAll();
  }

  function mountThumb(item){
    const cell = document.createElement('div');
    cell.className = 'thumb';
    const cv = document.createElement('canvas');
    cell.appendChild(cv);
    item._thumb = cell;
    item._thumbCanvas = cv;
    thumbGrid.appendChild(cell);

    const idx = ()=> App.items.indexOf(item);
    cell.addEventListener('click', ()=>{
      setCurrentIndex(idx());
    });
    redrawThumb(item);
    refreshThumbSelection(item);
  }

  function redrawThumb(item){
    const params = paramsForItem(item);
    // サムネは高速・小サイズ（左パネルの幅から算出）
    const gridWidth = thumbGrid.clientWidth || 500;
    const cols = 4;
    const gap = 8;
    const w = Math.max(64, Math.floor((gridWidth - gap*(cols-1)) / cols));
    const data = Editor.toImageDataFromImage(item.img, w, w);
    const mean = Editor.imageMeanLuma(data);
    // 更新（平均はここでは再計算しない）
    const autoCtx = params.autoEnable ? {
      enabled: true,
      imageMean: item.mean,
      datasetMean: App.datasetMean,
      pivotOffset: params.autoPivot || 0,
      strength: params.autoStrength || 1,
    } : null;
    const out = Editor.applyPipeline(data, params, autoCtx);
    const ctx = item._thumbCanvas.getContext('2d', {willReadFrequently:true});
    item._thumbCanvas.width = out.width; item._thumbCanvas.height = out.height;
    ctx.putImageData(out, 0, 0);
  }

  function refreshThumbSelection(item){
    if (!item._thumb) return;
    item._thumb.classList.toggle('selected', App.items.indexOf(item) === App.currentIndex);
  }

  function buildThumbsIfNeeded(){
    if (thumbGrid.childElementCount !== App.items.length){
      thumbGrid.innerHTML = '';
      for (const it of App.items) mountThumb(it);
    }
  }

  function setCurrentIndex(i){
    App.currentIndex = i;
    buildThumbsIfNeeded();
    for (const it of App.items) refreshThumbSelection(it);
    redrawDetail();
  }

  function redrawDetail(){
    if (App.currentIndex < 0 || App.currentIndex >= App.items.length) return;
    const it = App.items[App.currentIndex];
    detailName.textContent = it.name;
    // 右プレビュー：元サイズの1/4で高速編集
    const w = Math.max(1, Math.floor(it.img.naturalWidth/4));
    const h = Math.max(1, Math.floor(it.img.naturalHeight/4));
    const data = Editor.toImageDataFromImage(it.img, w, h);
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
