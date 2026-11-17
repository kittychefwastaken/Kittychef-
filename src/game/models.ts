import * as THREE from 'three';
import {
  CABIN_FLOOR_Y,
  CABIN_HALF_D,
  CABIN_HALF_W,
  DOOR_WIDTH,
} from './forestMap';
import { ForestTextureSet } from './textures';

export interface OpeningSlot {
  id: 'door' | 'west' | 'east' | 'north';
  label: string;
  interactPos: THREE.Vector3; // World position player stands near to board up
  outsideApproachPos: THREE.Vector3; // World position Stalker approaches outside
  planks: number; // 0..3
  maxPlanks: number;
  plankMeshes: THREE.Mesh[];
  siegeProgress: number; // 0..1 while stalker pries open
}

export interface CabinBuild {
  group: THREE.Group;
  doorPivot: THREE.Group;
  openings: OpeningSlot[];
  stoveLight: THREE.PointLight;
  stoveEmberMat: THREE.MeshStandardMaterial;
  porchLight: THREE.PointLight;
  porchBulbMat: THREE.MeshStandardMaterial;
  stovePos: THREE.Vector3;
  bunkPos: THREE.Vector3;
  doorInteractPos: THREE.Vector3;
}

export interface ForestStalkerRig {
  group: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  eyeMaterial: THREE.MeshStandardMaterial;
}

/**
 * Multi-part Wooden Forest Cabin with interactive door, 3 windows + barricade planks,
 * porch overhang, chimney, cast-iron stove, bunk, and supply table.
 */
export function createCabinModel(textures: ForestTextureSet): CabinBuild {
  const group = new THREE.Group();

  const logMat = new THREE.MeshStandardMaterial({
    map: textures.logWallMap,
    roughness: 0.88,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x241a12,
    roughness: 0.82,
    metalness: 0.06,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.plankFloorMap,
    roughness: 0.78,
    metalness: 0.05,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofShingleMap,
    roughness: 0.9,
    metalness: 0.04,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.metalMap,
    color: 0x26292e,
    roughness: 0.45,
    metalness: 0.8,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8ea4b8,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
  });
  const plankBoardMat = new THREE.MeshStandardMaterial({
    map: textures.plankFloorMap,
    color: 0x876747,
    roughness: 0.85,
    metalness: 0.02,
  });

  const hw = CABIN_HALF_W; // 4.2
  const hd = CABIN_HALF_D; // 4.2
  const wallH = 3.15;
  const wallThick = 0.36;

  // 1. Stone/timber foundation plinth & wooden floor deck (slightly above terrain y=0)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 0.5, CABIN_FLOOR_Y, hd * 2 + 0.5),
    trimMat,
  );
  plinth.position.y = CABIN_FLOOR_Y / 2;
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 0.1, 0.06, hd * 2 + 0.1),
    floorMat,
  );
  floorDeck.position.y = CABIN_FLOOR_Y + 0.02;
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Interior timber ceiling beam deck
  const ceilingDeck = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2, 0.12, hd * 2),
    trimMat,
  );
  ceilingDeck.position.y = CABIN_FLOOR_Y + wallH;
  group.add(ceilingDeck);

  // 2. Front South Porch Deck + Steps + Roof Overhang + Lantern
  const porchDeck = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 0.4, CABIN_FLOOR_Y - 0.04, 2.2),
    floorMat,
  );
  porchDeck.position.set(0, (CABIN_FLOOR_Y - 0.04) / 2, hd + 1.1);
  porchDeck.receiveShadow = true;
  group.add(porchDeck);

  const porchStep = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.13, 0.6),
    trimMat,
  );
  porchStep.position.set(0, 0.065, hd + 2.35);
  group.add(porchStep);

  [-3.8, -1.35, 1.35, 3.8].forEach((px) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 2.8, 8),
      trimMat,
    );
    post.position.set(px, CABIN_FLOOR_Y + 1.38, hd + 1.95);
    post.castShadow = true;
    group.add(post);
  });

  const porchAwning = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 0.8, 0.14, 2.55),
    roofMat,
  );
  porchAwning.position.set(0, CABIN_FLOOR_Y + 2.95, hd + 1.25);
  porchAwning.rotation.x = 0.18;
  porchAwning.castShadow = true;
  group.add(porchAwning);

  const porchBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd28a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const lanternCage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.24, 8),
    porchBulbMat,
  );
  lanternCage.position.set(1.35, CABIN_FLOOR_Y + 2.55, hd + 1.9);
  group.add(lanternCage);

  const porchLight = new THREE.PointLight(0xf59e0b, 2.1, 14, 2);
  porchLight.position.set(1.35, CABIN_FLOOR_Y + 2.4, hd + 2.1);
  group.add(porchLight);

  // 3. Helper to build a wall segment with a central window cutout
  const buildWindowWall = (
    axis: 'north' | 'west' | 'east',
  ): { plankMeshes: THREE.Mesh[] } => {
    const wallGroup = new THREE.Group();
    const totalLen = hw * 2 + wallThick;
    const winW = 1.9;
    const winH = 1.25;
    const sillH = 1.05;
    const headerH = wallH - sillH - winH;
    const sideW = (totalLen - winW) / 2;

    // Bottom sill wall
    const bot = new THREE.Mesh(
      new THREE.BoxGeometry(totalLen, sillH, wallThick),
      logMat,
    );
    bot.position.y = CABIN_FLOOR_Y + sillH / 2;
    bot.castShadow = true;
    bot.receiveShadow = true;
    wallGroup.add(bot);

    // Top lintel wall
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(totalLen, headerH, wallThick),
      logMat,
    );
    top.position.y = CABIN_FLOOR_Y + sillH + winH + headerH / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    wallGroup.add(top);

    // Left & Right flanks
    const left = new THREE.Mesh(
      new THREE.BoxGeometry(sideW, winH, wallThick),
      logMat,
    );
    left.position.set(-(winW / 2 + sideW / 2), CABIN_FLOOR_Y + sillH + winH / 2, 0);
    left.castShadow = true;
    left.receiveShadow = true;

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(sideW, winH, wallThick),
      logMat,
    );
    right.position.set(winW / 2 + sideW / 2, CABIN_FLOOR_Y + sillH + winH / 2, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    wallGroup.add(left, right);

    // Window frame & glass pane
    const sillTrim = new THREE.Mesh(
      new THREE.BoxGeometry(winW + 0.14, 0.08, wallThick + 0.12),
      trimMat,
    );
    sillTrim.position.y = CABIN_FLOOR_Y + sillH;
    const headTrim = new THREE.Mesh(
      new THREE.BoxGeometry(winW + 0.14, 0.08, wallThick + 0.12),
      trimMat,
    );
    headTrim.position.y = CABIN_FLOOR_Y + sillH + winH;
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, winH, 0.08),
      trimMat,
    );
    mullion.position.y = CABIN_FLOOR_Y + sillH + winH / 2;
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(winW - 0.04, winH - 0.04),
      glassMat,
    );
    glass.position.y = CABIN_FLOOR_Y + sillH + winH / 2;
    wallGroup.add(sillTrim, headTrim, mullion, glass);

    // 3 Barricade plank meshes placed inside the window frame
    const plankMeshes: THREE.Mesh[] = [];
    for (let p = 0; p < 3; p++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(winW + 0.28, 0.2, 0.06),
        plankBoardMat,
      );
      plank.position.set(
        0,
        CABIN_FLOOR_Y + sillH + 0.26 + p * 0.36,
        0.19,
      );
      plank.rotation.z = p === 1 ? -0.06 : 0.05;
      plank.castShadow = true;
      wallGroup.add(plank);
      plankMeshes.push(plank);
    }

    if (axis === 'north') {
      wallGroup.position.set(0, 0, -hd);
    } else if (axis === 'west') {
      wallGroup.position.set(-hw, 0, 0);
      wallGroup.rotation.y = Math.PI / 2;
    } else if (axis === 'east') {
      wallGroup.position.set(hw, 0, 0);
      wallGroup.rotation.y = -Math.PI / 2;
    }

    group.add(wallGroup);
    return { plankMeshes };
  };

  const northWin = buildWindowWall('north');
  const westWin = buildWindowWall('west');
  const eastWin = buildWindowWall('east');

  // 4. South Front Wall with Doorway & Hinged Wooden Door
  const southTotal = hw * 2 + wallThick;
  const sideSouthW = (southTotal - DOOR_WIDTH) / 2;
  const doorH = 2.28;

  const sLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sideSouthW, wallH, wallThick),
    logMat,
  );
  sLeft.position.set(-(DOOR_WIDTH / 2 + sideSouthW / 2), CABIN_FLOOR_Y + wallH / 2, hd);
  sLeft.castShadow = true;
  sLeft.receiveShadow = true;

  const sRight = new THREE.Mesh(
    new THREE.BoxGeometry(sideSouthW, wallH, wallThick),
    logMat,
  );
  sRight.position.set(DOOR_WIDTH / 2 + sideSouthW / 2, CABIN_FLOOR_Y + wallH / 2, hd);
  sRight.castShadow = true;
  sRight.receiveShadow = true;

  const sHeader = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH, wallH - doorH, wallThick),
    logMat,
  );
  sHeader.position.set(0, CABIN_FLOOR_Y + doorH + (wallH - doorH) / 2, hd);
  sHeader.castShadow = true;
  group.add(sLeft, sRight, sHeader);

  // Hinged door pivot at left jamb
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-DOOR_WIDTH / 2, CABIN_FLOOR_Y, hd);
  group.add(doorPivot);

  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH - 0.04, doorH - 0.03, 0.09),
    trimMat,
  );
  doorPanel.position.set(DOOR_WIDTH / 2, doorH / 2, 0);
  doorPanel.castShadow = true;
  doorPanel.receiveShadow = true;
  doorPivot.add(doorPanel);

  const doorHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    ironMat,
  );
  doorHandle.position.set(DOOR_WIDTH - 0.16, 1.05, -0.07);
  doorPivot.add(doorHandle);

  // Door Barricade Planks (spanning across doorway inside face)
  const doorPlanks: THREE.Mesh[] = [];
  for (let p = 0; p < 3; p++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH + 0.34, 0.2, 0.06),
      plankBoardMat,
    );
    plank.position.set(0, CABIN_FLOOR_Y + 0.65 + p * 0.55, hd - 0.22);
    plank.rotation.z = p === 1 ? 0.07 : -0.04;
    group.add(plank);
    doorPlanks.push(plank);
  }

  // 5. Pitched Gable Roof + Chimney
  const roofPitch = 0.52;
  const roofSlopeW = 5.4;
  const roofLen = hd * 2 + 1.2;

  const roofL = new THREE.Mesh(
    new THREE.BoxGeometry(roofSlopeW, 0.18, roofLen),
    roofMat,
  );
  roofL.position.set(-2.15, CABIN_FLOOR_Y + wallH + 1.15, 0);
  roofL.rotation.z = roofPitch;
  roofL.castShadow = true;

  const roofR = new THREE.Mesh(
    new THREE.BoxGeometry(roofSlopeW, 0.18, roofLen),
    roofMat,
  );
  roofR.position.set(2.15, CABIN_FLOOR_Y + wallH + 1.15, 0);
  roofR.rotation.z = -roofPitch;
  roofR.castShadow = true;
  group.add(roofL, roofR);

  // Gable triangle fillers
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-hw, 0);
  gableShape.lineTo(hw, 0);
  gableShape.lineTo(0, 2.35);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: 0.24,
    bevelEnabled: false,
  });
  const gableN = new THREE.Mesh(gableGeo, logMat);
  gableN.position.set(0, CABIN_FLOOR_Y + wallH, -hd - 0.12);
  const gableS = new THREE.Mesh(gableGeo, logMat);
  gableS.position.set(0, CABIN_FLOOR_Y + wallH, hd - 0.12);
  group.add(gableN, gableS);

  // Exterior Chimney pipe
  const extChimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 2.6, 10),
    ironMat,
  );
  extChimney.position.set(-2.95, CABIN_FLOOR_Y + wallH + 1.2, -2.95);
  group.add(extChimney);

  // 6. Interior Cast-Iron Wood Stove (NW corner)
  const stovePos = new THREE.Vector3(-2.95, CABIN_FLOOR_Y, -2.95);
  const stoveGroup = new THREE.Group();
  stoveGroup.position.copy(stovePos);

  const stoveBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95), ironMat);
  stoveBase.position.y = 0.08;
  const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.85, 0.76), ironMat);
  stoveBody.position.y = 0.58;
  stoveBody.castShadow = true;
  const stovePipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 2.15, 10),
    ironMat,
  );
  stovePipe.position.y = 2.05;

  const stoveEmberMat = new THREE.MeshStandardMaterial({
    color: 0xff6b2b,
    emissive: 0xff5500,
    emissiveIntensity: 2.6,
    roughness: 0.3,
  });
  const emberGrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.26, 0.06),
    stoveEmberMat,
  );
  emberGrate.position.set(0, 0.55, 0.38);
  emberGrate.rotation.y = Math.PI / 4;
  stoveGroup.add(stoveBase, stoveBody, stovePipe, emberGrate);

  const stoveLight = new THREE.PointLight(0xff7b29, 3.0, 11.5, 2);
  stoveLight.position.set(0.35, 0.85, 0.35);
  stoveGroup.add(stoveLight);
  group.add(stoveGroup);

  // 7. Interior Wooden Bunk (NE corner)
  const bunkPos = new THREE.Vector3(2.9, CABIN_FLOOR_Y, -3.0);
  const bunkGroup = new THREE.Group();
  bunkGroup.position.copy(bunkPos);
  const bunkFrame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 1.05), trimMat);
  bunkFrame.position.y = 0.21;
  const blanketMat = new THREE.MeshStandardMaterial({
    color: 0x3b443c,
    roughness: 0.92,
  });
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.16, 0.94), blanketMat);
  mattress.position.y = 0.48;
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xb0aaa0, roughness: 0.9 }),
  );
  pillow.position.set(0.58, 0.6, 0);
  bunkGroup.add(bunkFrame, mattress, pillow);
  group.add(bunkGroup);

  // 8. Interior Supply Table (SW corner)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-2.9, CABIN_FLOOR_Y, 2.2);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.1), trimMat);
  tableTop.position.y = 0.78;
  tableGroup.add(tableTop);
  [
    [-0.55, -0.45],
    [0.55, -0.45],
    [-0.55, 0.45],
    [0.55, 0.45],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.08), trimMat);
    leg.position.set(lx, 0.38, lz);
    tableGroup.add(leg);
  });
  group.add(tableGroup);

  const openings: OpeningSlot[] = [
    {
      id: 'door',
      label: 'Front Door',
      interactPos: new THREE.Vector3(0, CABIN_FLOOR_Y, hd - 0.45),
      outsideApproachPos: new THREE.Vector3(0, 0, hd + 1.05),
      planks: 2,
      maxPlanks: 3,
      plankMeshes: doorPlanks,
      siegeProgress: 0,
    },
    {
      id: 'west',
      label: 'West Window',
      interactPos: new THREE.Vector3(-hw + 0.5, CABIN_FLOOR_Y, 0),
      outsideApproachPos: new THREE.Vector3(-hw - 1.1, 0, 0),
      planks: 2,
      maxPlanks: 3,
      plankMeshes: westWin.plankMeshes,
      siegeProgress: 0,
    },
    {
      id: 'east',
      label: 'East Window',
      interactPos: new THREE.Vector3(hw - 0.5, CABIN_FLOOR_Y, 0),
      outsideApproachPos: new THREE.Vector3(hw + 1.1, 0, 0),
      planks: 2,
      maxPlanks: 3,
      plankMeshes: eastWin.plankMeshes,
      siegeProgress: 0,
    },
    {
      id: 'north',
      label: 'North Window',
      interactPos: new THREE.Vector3(0, CABIN_FLOOR_Y, -hd + 0.5),
      outsideApproachPos: new THREE.Vector3(0, 0, -hd - 1.1),
      planks: 2,
      maxPlanks: 3,
      plankMeshes: northWin.plankMeshes,
      siegeProgress: 0,
    },
  ];

  return {
    group,
    doorPivot,
    openings,
    stoveLight,
    stoveEmberMat,
    porchLight,
    porchBulbMat,
    stovePos,
    bunkPos,
    doorInteractPos: new THREE.Vector3(0, CABIN_FLOOR_Y, hd),
  };
}

/**
 * Exterior timber Woodshed prop grounded on clearing edge.
 */
export function createWoodshedModel(textures: ForestTextureSet): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.logWallMap,
    roughness: 0.9,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofShingleMap,
    roughness: 0.92,
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 0.16), woodMat);
  back.position.set(0, 1.0, -0.75);
  back.castShadow = true;

  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 1.6), woodMat);
  sideL.position.set(-1.18, 1.0, 0);
  sideL.castShadow = true;

  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 1.6), woodMat);
  sideR.position.set(1.18, 1.0, 0);
  sideR.castShadow = true;

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 2.0), roofMat);
  roof.position.set(0, 2.08, 0.05);
  roof.rotation.x = 0.16;
  roof.castShadow = true;

  group.add(back, sideL, sideR, roof);
  return group;
}

export interface CampfireBuild {
  group: THREE.Group;
  light: THREE.PointLight;
  flameGroup: THREE.Group;
  emberMat: THREE.MeshStandardMaterial;
}

/**
 * Multi-part Lit Clearing Campfire grounded at y=0 (stone ring, charred logs, glowing embers & flames).
 */
export function createCampfireModel(textures: ForestTextureSet): CampfireBuild {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x454947,
    roughness: 0.92,
    metalness: 0.05,
  });
  const logMat = new THREE.MeshStandardMaterial({
    map: textures.barkMap,
    color: 0x3b281c,
    roughness: 0.9,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff4500,
    emissiveIntensity: 3.0,
    roughness: 0.35,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffc145,
    emissive: 0xff7b1c,
    emissiveIntensity: 3.5,
    roughness: 0.25,
    transparent: true,
    opacity: 0.88,
  });

  // Ring of 9 river stones
  const stoneGeo = new THREE.DodecahedronGeometry(0.16, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(Math.cos(a) * 0.56, 0.09, Math.sin(a) * 0.56);
    stone.scale.set(1.1, 0.72, 1.0);
    stone.rotation.set(i * 0.4, a, 0.2);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Glowing ash & coal bed
  const coals = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.06, 10),
    emberMat,
  );
  coals.position.y = 0.03;
  group.add(coals);

  // Stacked crossed logs
  const logGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.84, 7);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(logGeo, logMat);
    const angle = (i * Math.PI) / 2 + 0.35;
    log.position.set(Math.cos(angle) * 0.14, 0.15, Math.sin(angle) * 0.14);
    log.rotation.z = Math.PI / 2 - 0.32;
    log.rotation.y = angle;
    log.castShadow = true;
    group.add(log);
  }

  // Flickering flame tongues
  const flameGroup = new THREE.Group();
  const mainFlame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 7), flameMat);
  mainFlame.position.y = 0.32;
  const sideFlameA = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 6), flameMat);
  sideFlameA.position.set(0.1, 0.24, 0.07);
  sideFlameA.rotation.z = -0.18;
  const sideFlameB = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), flameMat);
  sideFlameB.position.set(-0.09, 0.22, -0.06);
  sideFlameB.rotation.z = 0.16;
  flameGroup.add(mainFlame, sideFlameA, sideFlameB);
  group.add(flameGroup);

  const light = new THREE.PointLight(0xff842b, 3.6, 13.5, 2);
  light.position.set(0, 0.72, 0);
  group.add(light);

  return { group, light, flameGroup, emberMat };
}

/**
 * Composite 11-part Antlered Forest Stalker grounded at y=0.
 */
export function createForestStalkerModel(): ForestStalkerRig {
  const group = new THREE.Group();

  const barkFleshMat = new THREE.MeshStandardMaterial({
    color: 0x1d1b18,
    roughness: 0.92,
    metalness: 0.04,
  });
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xa39a8c,
    roughness: 0.48,
    metalness: 0.08,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff0c2,
    emissive: 0xff8c1a,
    emissiveIntensity: 3.8,
    roughness: 0.2,
  });

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.2, 1.18, 0);
  const legGeo = new THREE.CylinderGeometry(0.07, 0.042, 1.18, 7);
  const lLeg = new THREE.Mesh(legGeo, barkFleshMat);
  lLeg.position.y = -0.59;
  lLeg.castShadow = true;
  leftLegPivot.add(lLeg);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.2, 1.18, 0);
  const rLeg = new THREE.Mesh(legGeo, barkFleshMat);
  rLeg.position.y = -0.59;
  rLeg.castShadow = true;
  rightLegPivot.add(rLeg);
  group.add(rightLegPivot);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 1.18, 0);
  group.add(torsoPivot);

  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.16, 0.92, 8),
    barkFleshMat,
  );
  chest.position.y = 0.52;
  chest.rotation.x = 0.18;
  chest.castShadow = true;
  torsoPivot.add(chest);

  const ribGeo = new THREE.TorusGeometry(0.22, 0.025, 5, 10, Math.PI * 1.2);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(ribGeo, boneMat);
    rib.position.set(0, 0.36 + i * 0.18, 0.05);
    rib.rotation.x = Math.PI / 2 + 0.16;
    rib.rotation.z = Math.PI * 0.9;
    torsoPivot.add(rib);
  }

  const buildArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, 0.94, 0.1);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.72, 6),
      barkFleshMat,
    );
    upper.position.y = -0.35;
    upper.castShadow = true;
    const fore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.024, 0.78, 6),
      barkFleshMat,
    );
    fore.position.set(side * 0.04, -0.96, 0.16);
    fore.rotation.x = -0.35;
    fore.castShadow = true;
    pivot.add(upper, fore);

    const clawGeo = new THREE.ConeGeometry(0.02, 0.22, 5);
    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(clawGeo, boneMat);
      claw.position.set(side * 0.04 + c * 0.036, -1.36, 0.32);
      claw.rotation.x = Math.PI - 0.35;
      pivot.add(claw);
    }
    return pivot;
  };

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  torsoPivot.add(leftArmPivot, rightArmPivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.04, 0.18);
  torsoPivot.add(headPivot);

  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 7), boneMat);
  skull.rotation.x = Math.PI / 2 + 0.2;
  skull.position.set(0, 0.24, 0.14);
  skull.castShadow = true;
  headPivot.add(skull);

  // Branching antlers
  const antlerBeamGeo = new THREE.CylinderGeometry(0.022, 0.035, 0.78, 6);
  const antlerTineGeo = new THREE.CylinderGeometry(0.012, 0.02, 0.36, 5);
  [-1, 1].forEach((side) => {
    const beam = new THREE.Mesh(antlerBeamGeo, boneMat);
    beam.position.set(side * 0.24, 0.58, -0.02);
    beam.rotation.z = -side * 0.52;
    beam.rotation.x = -0.25;
    headPivot.add(beam);

    const tine = new THREE.Mesh(antlerTineGeo, boneMat);
    tine.position.set(side * 0.38, 0.68, 0.1);
    tine.rotation.z = -side * 0.15;
    tine.rotation.x = 0.55;
    headPivot.add(tine);
  });

  // Glowing pale-amber eyes
  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const lEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  lEye.position.set(-0.07, 0.26, 0.26);
  const rEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  rEye.position.set(0.07, 0.26, 0.26);
  headPivot.add(lEye, rEye);

  return {
    group,
    torsoPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    eyeMaterial,
  };
}

/**
 * 4-part Stacked Firewood Log Bundle pickup grounded at y=0.
 */
export function createFirewoodPickup(barkMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    color: 0x6e4f35,
    roughness: 0.88,
  });
  const cutEndMat = new THREE.MeshStandardMaterial({
    color: 0xb89668,
    roughness: 0.72,
  });

  const logGeo = new THREE.CylinderGeometry(0.095, 0.1, 0.65, 8);
  const positions = [
    [-0.12, 0.1, 0],
    [0.12, 0.1, 0],
    [0, 0.26, 0],
  ];
  positions.forEach(([x, y, z]) => {
    const log = new THREE.Mesh(logGeo, [logMat, cutEndMat, cutEndMat]);
    log.rotation.x = Math.PI / 2;
    log.position.set(x, y, z);
    log.castShadow = true;
    group.add(log);
  });

  // Subtle warm beacon ring so firewood is spottable in dusk/flashlight
  const tag = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.015, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.4,
    }),
  );
  tag.rotation.x = Math.PI / 2;
  tag.position.y = 0.04;
  group.add(tag);

  return group;
}

/**
 * 3-part Scrap Timber Plank Bundle pickup grounded at y=0.
 */
export function createPlankPickup(plankMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: plankMap,
    color: 0x9b7955,
    roughness: 0.84,
  });

  for (let i = 0; i < 3; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.24), mat);
    board.position.set(0, 0.04 + i * 0.07, (i - 1) * 0.04);
    board.rotation.y = (i - 1) * 0.14;
    board.castShadow = true;
    group.add(board);
  }

  return group;
}

/**
 * 4-part Industrial Battery Pack pickup grounded at y=0.
 */
export function createBatteryPickup(metalMap: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const casingMat = new THREE.MeshStandardMaterial({
    map: metalMap,
    color: 0xb45309,
    roughness: 0.42,
    metalness: 0.25,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.55,
    metalness: 0.5,
  });
  const termMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.19), casingMat);
  body.position.y = 0.13;
  body.castShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.05, 0.2), capMat);
  lid.position.y = 0.27;
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 8), termMat);
  t1.position.set(-0.07, 0.32, 0);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 8), termMat);
  t2.position.set(0.07, 0.32, 0);

  group.add(body, lid, t1, t2);
  return group;
}
