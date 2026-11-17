import * as THREE from 'three';

export interface ForestTextureSet {
  terrainMap: THREE.CanvasTexture;
  terrainRoughness: THREE.CanvasTexture;
  logWallMap: THREE.CanvasTexture;
  plankFloorMap: THREE.CanvasTexture;
  roofShingleMap: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  metalMap: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createForestTextures(maxAnisotropy: number): ForestTextureSet {
  const rand = seededRandom(501978);

  // 1. Forest floor (pine needles, damp soil, moss patches)
  const [tCanvas, tCtx] = makeCanvas(512);
  tCtx.fillStyle = '#23281d';
  tCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 650; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 6 + rand() * 26;
    const pick = rand();
    tCtx.fillStyle =
      pick < 0.45
        ? `rgba(28, 36, 22, ${0.14 + rand() * 0.16})`
        : pick < 0.8
          ? `rgba(44, 34, 24, ${0.12 + rand() * 0.16})`
          : `rgba(18, 22, 16, ${0.15 + rand() * 0.18})`;
    tCtx.beginPath();
    tCtx.arc(x, y, r, 0, Math.PI * 2);
    tCtx.fill();
  }

  // Scattered pine needles
  tCtx.lineWidth = 1.2;
  for (let i = 0; i < 900; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const a = rand() * Math.PI * 2;
    tCtx.strokeStyle =
      rand() > 0.5 ? 'rgba(66, 52, 34, 0.48)' : 'rgba(34, 46, 26, 0.45)';
    tCtx.beginPath();
    tCtx.moveTo(x, y);
    tCtx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    tCtx.stroke();
  }

  const terrainMap = new THREE.CanvasTexture(tCanvas);
  terrainMap.colorSpace = THREE.SRGBColorSpace;
  terrainMap.wrapS = THREE.RepeatWrapping;
  terrainMap.wrapT = THREE.RepeatWrapping;
  terrainMap.repeat.set(28, 28);
  terrainMap.anisotropy = maxAnisotropy;

  const [trCanvas, trCtx] = makeCanvas(256);
  trCtx.fillStyle = '#d8d8d8';
  trCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 10 + rand() * 34;
    const g = trCtx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(65, 65, 65, 0.8)');
    g.addColorStop(1, 'rgba(216, 216, 216, 0)');
    trCtx.fillStyle = g;
    trCtx.beginPath();
    trCtx.arc(x, y, r, 0, Math.PI * 2);
    trCtx.fill();
  }
  const terrainRoughness = new THREE.CanvasTexture(trCanvas);
  terrainRoughness.wrapS = THREE.RepeatWrapping;
  terrainRoughness.wrapT = THREE.RepeatWrapping;
  terrainRoughness.repeat.set(28, 28);
  terrainRoughness.anisotropy = maxAnisotropy;

  // 2. Weathered Cabin Timber Log Wall
  const [lCanvas, lCtx] = makeCanvas(512);
  lCtx.fillStyle = '#3f2e21';
  lCtx.fillRect(0, 0, 512, 512);
  const logBands = 8;
  const bandH = 512 / logBands;
  for (let i = 0; i < logBands; i++) {
    const y = i * bandH;
    const grad = lCtx.createLinearGradient(0, y, 0, y + bandH);
    grad.addColorStop(0, '#1d140e');
    grad.addColorStop(0.22, '#4a3525');
    grad.addColorStop(0.55, '#59412e');
    grad.addColorStop(0.88, '#36261a');
    grad.addColorStop(1, '#18110b');
    lCtx.fillStyle = grad;
    lCtx.fillRect(0, y, 512, bandH);

    // Wood grain lines
    lCtx.strokeStyle = 'rgba(22, 14, 9, 0.35)';
    lCtx.lineWidth = 1.3;
    for (let g = 0; g < 9; g++) {
      const gy = y + 8 + rand() * (bandH - 16);
      lCtx.beginPath();
      lCtx.moveTo(0, gy);
      lCtx.bezierCurveTo(170, gy + (rand() - 0.5) * 8, 340, gy + (rand() - 0.5) * 8, 512, gy);
      lCtx.stroke();
    }
  }
  const logWallMap = new THREE.CanvasTexture(lCanvas);
  logWallMap.colorSpace = THREE.SRGBColorSpace;
  logWallMap.wrapS = THREE.RepeatWrapping;
  logWallMap.wrapT = THREE.RepeatWrapping;
  logWallMap.repeat.set(2, 1);
  logWallMap.anisotropy = maxAnisotropy;

  // 3. Cabin Plank Floor
  const [pCanvas, pCtx] = makeCanvas(512);
  pCtx.fillStyle = '#3a2b1e';
  pCtx.fillRect(0, 0, 512, 512);
  const planks = 6;
  const plankW = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * plankW;
    const shade = 48 + Math.floor((rand() - 0.5) * 18);
    pCtx.fillStyle = `rgb(${shade + 12}, ${shade - 4}, ${shade - 16})`;
    pCtx.fillRect(x, 0, plankW - 2, 512);
    pCtx.fillStyle = 'rgba(14, 10, 7, 0.85)';
    pCtx.fillRect(x + plankW - 3, 0, 3, 512);
    for (let s = 0; s < 14; s++) {
      pCtx.strokeStyle = 'rgba(20, 14, 9, 0.32)';
      pCtx.beginPath();
      const gx = x + 6 + rand() * (plankW - 14);
      pCtx.moveTo(gx, 0);
      pCtx.lineTo(gx + (rand() - 0.5) * 6, 512);
      pCtx.stroke();
    }
  }
  const plankFloorMap = new THREE.CanvasTexture(pCanvas);
  plankFloorMap.colorSpace = THREE.SRGBColorSpace;
  plankFloorMap.wrapS = THREE.RepeatWrapping;
  plankFloorMap.wrapT = THREE.RepeatWrapping;
  plankFloorMap.repeat.set(3, 3);
  plankFloorMap.anisotropy = maxAnisotropy;

  // 4. Mossy Cedar Roof Shingles
  const [rCanvas, rCtx] = makeCanvas(256);
  rCtx.fillStyle = '#242624';
  rCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const offset = (row % 2) * 16;
    for (let col = -1; col < 9; col++) {
      const x = col * 32 + offset;
      const v = 30 + Math.floor(rand() * 22);
      rCtx.fillStyle = `rgb(${v}, ${v + 3}, ${v - 2})`;
      rCtx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  const roofShingleMap = new THREE.CanvasTexture(rCanvas);
  roofShingleMap.colorSpace = THREE.SRGBColorSpace;
  roofShingleMap.wrapS = THREE.RepeatWrapping;
  roofShingleMap.wrapT = THREE.RepeatWrapping;
  roofShingleMap.repeat.set(4, 3);
  roofShingleMap.anisotropy = maxAnisotropy;

  // 5. Pine Tree Bark
  const [bCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#2d2119';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    bCtx.fillStyle =
      rand() > 0.5 ? 'rgba(18, 12, 9, 0.5)' : 'rgba(68, 52, 38, 0.35)';
    bCtx.fillRect(x, y, 3 + rand() * 7, 18 + rand() * 44);
  }
  const barkMap = new THREE.CanvasTexture(bCanvas);
  barkMap.colorSpace = THREE.SRGBColorSpace;
  barkMap.wrapS = THREE.RepeatWrapping;
  barkMap.wrapT = THREE.RepeatWrapping;
  barkMap.anisotropy = maxAnisotropy;

  // 6. Cast Iron / Weathered Metal
  const [mCanvas, mCtx] = makeCanvas(256);
  mCtx.fillStyle = '#2a2d32';
  mCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 110; i++) {
    mCtx.fillStyle =
      rand() > 0.4
        ? `rgba(82, 42, 24, ${0.1 + rand() * 0.2})`
        : `rgba(16, 18, 22, ${0.15 + rand() * 0.25})`;
    mCtx.fillRect(rand() * 256, rand() * 256, 6 + rand() * 22, 4 + rand() * 14);
  }
  const metalMap = new THREE.CanvasTexture(mCanvas);
  metalMap.colorSpace = THREE.SRGBColorSpace;
  metalMap.anisotropy = maxAnisotropy;

  return {
    terrainMap,
    terrainRoughness,
    logWallMap,
    plankFloorMap,
    roofShingleMap,
    barkMap,
    metalMap,
    dispose: () => {
      terrainMap.dispose();
      terrainRoughness.dispose();
      logWallMap.dispose();
      plankFloorMap.dispose();
      roofShingleMap.dispose();
      barkMap.dispose();
      metalMap.dispose();
    },
  };
}
