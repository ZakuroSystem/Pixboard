// inout.js - 入出力・ZIP生成・ファイル命名
import { Editor } from './ebp-editor.js';
import { Draw } from './ebp-draw.js';

export const IO = (()=>{
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

// 自動起動は draw.js 側でまとめて行う
