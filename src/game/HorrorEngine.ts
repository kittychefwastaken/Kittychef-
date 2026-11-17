import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ForestAudioEngine } from './audio';
import {
  BATTERY_SPOTS,
  BoxCollider,
  buildStaticColliders,
  CABIN_FLOOR_Y,
  CABIN_HALF_D,
  CABIN_HALF_W,
  DOOR_CLOSED_COLLIDER,
  FIREWOOD_SPOTS,
  FOREST_PLAY_RADIUS,
  generateForestProps,
  getLocationLabel,
  groundHeightAt,
  isInsideCabin,
  PLANK_SPOTS,
} from './forestMap';
import {
  CabinBuild,
  CampfireBuild,
  createBatteryPickup,
  createCabinModel,
  createCampfireModel,
  createFirewoodPickup,
  createForestStalkerModel,
  createPlankPickup,
  createWoodshedModel,
  ForestStalkerRig,
  OpeningSlot,
} from './models';
import { createForestTextures, ForestTextureSet } from './textures';
import {
  DeathReason,
  DifficultyMode,
  GamePhase,
  HudSnapshot,
  StalkerBehavior,
  TimeOfDay,
} from './types';

interface PickupNode {
  kind: 'wood' | 'plank' | 'battery';
  x: number;
  z: number;
  active: boolean;
  mesh: THREE.Group;
}

interface StalkerAgent {
  rig: ForestStalkerRig;
  pos: THREE.Vector3;
  yaw: number;
  behavior: StalkerBehavior;
  targetOpeningIdx: number;
  lurkAngle: number;
  timer: number;
  flashExpose: number;
  walkPhase: number;
  active: boolean;
}

// Pre-allocated math helpers outside the render loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _colorA = new THREE.Color();

const PLAYER_EYE_OFFSET = 1.66;
const PLAYER_RADIUS = 0.42;
const MAX_NIGHTS = 50;
const BEST_NIGHT_KEY = 'hollow_ward_best_night';

export class HorrorEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onWebGLUnavailable: () => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private textures!: ForestTextureSet;
  private audio = new ForestAudioEngine();

  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private hudThrottleAcc = 0;

  // Game & 50-Night Progression State
  private phase: GamePhase = 'title';
  private deathReason: DeathReason = null;
  private difficulty: DifficultyMode = 'standard';
  private night = 1;
  private timeOfDay: TimeOfDay = 'dawn';
  private phaseTimer = 300;
  private phaseDuration = 300;
  private bestNight = 0;
  private totalNightsSurvived = 0;
  private planksPlaced = 0;
  private closeCalls = 0;
  private inCloseCall = false;

  // Survival Resources
  private warmth = 100;
  private frost = 0;
  private frostWarned = false;
  private sanity = 100;
  private sanityWarned = false;
  private nearestWatcherDist = 999;
  private inSafeZone = false;
  private safeZoneSource: string | null = null;
  private hallucinationCooldown = 14;
  private phantomTimer = 0;
  private hallucinationFlash = 0;
  private flashlightDipTimer = 0;
  private battery = 100;
  private stamina = 100;
  private staminaExhausted = false;
  private flashlightOn = true;
  private firewoodCount = 2;
  private planksCount = 3;
  private doorOpen = false;
  private doorAngle = 0;

  private statusMessage: string | null = null;
  private statusTimer = 0;
  private threatLevel = 0;
  private jumpscareTimer = 0;
  private killerPos = new THREE.Vector3();
  private killerYaw = 0;

  // Player Kinematics
  private playerPos = new THREE.Vector3(0, CABIN_FLOOR_Y + PLAYER_EYE_OFFSET, 1.4);
  private yaw = 0;
  private pitch = 0;
  private bobTime = 0;
  private pointerLocked = false;
  private draggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private keys: Record<string, boolean> = {};
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualSprint = false;
  private touchMode = false;

  // World & Lights
  private cabin!: CabinBuild;
  private campfire!: CampfireBuild;
  private campfirePos = new THREE.Vector3(5.6, 0, 8.4);
  private staticColliders: BoxCollider[] = [];
  private treeColliders: { x: number; z: number; r: number }[] = [];
  private pickups: PickupNode[] = [];
  private stalkers: StalkerAgent[] = [];
  private phantomRig!: ForestStalkerRig;

  private moonLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget = new THREE.Object3D();
  private handSpillLight!: THREE.PointLight;

  // Bound event listeners
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundContextMenu: (e: MouseEvent) => void;
  private boundPointerLockChange: () => void;
  private boundResize: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onWebGLUnavailable: () => void,
    initialTouchMode = false,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onWebGLUnavailable = onWebGLUnavailable;
    this.touchMode = initialTouchMode;
    this.bestNight = this.loadBestNight();

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundContextMenu = (e: MouseEvent) => e.preventDefault();
    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);
    this.boundResize = this.handleResize.bind(this);

    try {
      if (!this.initThree()) {
        this.onWebGLUnavailable();
        return;
      }

      this.buildWorld();
      this.resetRound('title');
      this.attachEvents();
      this.lastTimestamp = performance.now();
      this.loop(this.lastTimestamp);
    } catch {
      this.dispose();
      this.onWebGLUnavailable();
    }
  }

  private loadBestNight(): number {
    try {
      const val = Number(localStorage.getItem(BEST_NIGHT_KEY) || '0');
      return Number.isFinite(val) ? Math.max(0, Math.min(MAX_NIGHTS, val)) : 0;
    } catch {
      return 0;
    }
  }

  private saveBestNight(n: number): void {
    if (n <= this.bestNight) return;
    this.bestNight = n;
    try {
      localStorage.setItem(BEST_NIGHT_KEY, String(n));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  private isContextSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private initThree(): boolean {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.touchMode,
        powerPreference: 'high-performance',
      });
    } catch {
      return false;
    }

    const gl = this.renderer.getContext();
    if (!gl) {
      this.renderer.dispose();
      return false;
    }

    this.isSoftwareGl = this.isContextSoftwareGl(gl);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const maxDpr = this.touchMode ? 1.75 : 2;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr),
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth || 1,
      this.container.clientHeight || window.innerHeight || 1,
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.cancelFrame();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lastTimestamp = performance.now();
      this.loop(this.lastTimestamp);
    });

    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x091018);
    this.scene.fog = new THREE.FogExp2(0x091018, 0.048);

    const w = this.container.clientWidth || window.innerWidth || 1;
    const h = this.container.clientHeight || window.innerHeight || 1;
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.08, 120);

    // Optional RoomEnvironment PMREM for PBR highlights (guarded for older mobile GPUs)
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
      this.scene.environmentIntensity = 0.16;
      roomEnv.dispose();
      pmrem.dispose();
    } catch {
      // Proceed cleanly without PMREM environment map
    }

    // Warm/Cool sky-ground fill + moonlight key
    this.hemiLight = new THREE.HemisphereLight(0x526982, 0x161a14, 0.55);
    this.scene.add(this.hemiLight);

    const dirShadowRes = this.touchMode ? 1024 : 2048;
    const spotShadowRes = this.touchMode ? 512 : 1024;

    this.moonLight = new THREE.DirectionalLight(0xa3c2e0, 0.85);
    this.moonLight.position.set(22, 34, 18);
    this.moonLight.castShadow = !this.isSoftwareGl;
    this.moonLight.shadow.mapSize.set(dirShadowRes, dirShadowRes);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 90;
    const d = 28;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.moonLight.shadow.normalBias = 0.02;
    this.scene.add(this.moonLight);

    // Player handheld flashlight
    this.flashlight = new THREE.SpotLight(
      0xffe9c4,
      10.5,
      34,
      Math.PI / 5.0,
      0.56,
      1.5,
    );
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.set(spotShadowRes, spotShadowRes);
    this.flashlight.shadow.camera.near = 0.25;
    this.flashlight.shadow.camera.far = 34;
    this.flashlight.shadow.bias = -0.0005;
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    this.handSpillLight = new THREE.PointLight(0x8fa3b8, 0.48, 4.5, 2);
    this.scene.add(this.handSpillLight);

    return true;
  }

  private buildWorld(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createForestTextures(maxAniso);
    this.staticColliders = buildStaticColliders();

    // 1. Continuous 160x160 Forest Terrain with heightmap & natural outer ridge barrier
    const terrainGeo = new THREE.PlaneGeometry(160, 160, 80, 80);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.textures.terrainMap,
      roughnessMap: this.textures.terrainRoughness,
      roughness: 0.88,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // 2. Central Wooden Cabin & Woodshed
    this.cabin = createCabinModel(this.textures);
    this.scene.add(this.cabin.group);

    const woodshed = createWoodshedModel(this.textures);
    woodshed.position.set(-11.5, groundHeightAt(-11.5, -2.3), -2.3);
    woodshed.rotation.y = 0.14;
    this.scene.add(woodshed);

    // Outdoor Lit Clearing Campfire (Safe Zone light source)
    this.campfire = createCampfireModel(this.textures);
    this.campfirePos.y = groundHeightAt(this.campfirePos.x, this.campfirePos.z);
    this.campfire.group.position.copy(this.campfirePos);
    this.scene.add(this.campfire.group);
    this.treeColliders.push({ x: this.campfirePos.x, z: this.campfirePos.z, r: 0.72 });

    // 3. Instanced Pine Forest (Trunks + 3 Pine Cone Foliage Tiers + Rocks)
    const { trees, rocks } = generateForestProps();
    const treeCount = trees.length;

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.2, 7);
    trunkGeo.translate(0, 2.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkMap,
      roughness: 0.92,
      metalness: 0.02,
    });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    });

    const tier1Geo = new THREE.ConeGeometry(1.95, 3.8, 7);
    tier1Geo.translate(0, 4.4, 0);
    const tier2Geo = new THREE.ConeGeometry(1.5, 3.4, 7);
    tier2Geo.translate(0, 6.2, 0);
    const tier3Geo = new THREE.ConeGeometry(1.0, 2.9, 7);
    tier3Geo.translate(0, 7.9, 0);

    const tier1Inst = new THREE.InstancedMesh(tier1Geo, foliageMat, treeCount);
    const tier2Inst = new THREE.InstancedMesh(tier2Geo, foliageMat, treeCount);
    const tier3Inst = new THREE.InstancedMesh(tier3Geo, foliageMat, treeCount);
    tier1Inst.castShadow = true;
    tier2Inst.castShadow = true;

    const dummy = new THREE.Object3D();
    const foliageColor = new THREE.Color();

    trees.forEach((t, i) => {
      const gy = groundHeightAt(t.x, t.z);
      dummy.position.set(t.x, gy - 0.15, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.set(t.scale, t.scale * (0.95 + (i % 5) * 0.04), t.scale);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(i, dummy.matrix);
      tier1Inst.setMatrixAt(i, dummy.matrix);
      tier2Inst.setMatrixAt(i, dummy.matrix);
      tier3Inst.setMatrixAt(i, dummy.matrix);

      foliageColor.setRGB(0.08 * t.tint, 0.17 * t.tint, 0.1 * t.tint);
      tier1Inst.setColorAt(i, foliageColor);
      tier2Inst.setColorAt(i, foliageColor);
      tier3Inst.setColorAt(i, foliageColor);

      if (Math.hypot(t.x, t.z) < FOREST_PLAY_RADIUS + 2) {
        this.treeColliders.push({ x: t.x, z: t.z, r: 0.44 * t.scale });
      }
    });

    [trunkInst, tier1Inst, tier2Inst, tier3Inst].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      this.scene.add(inst);
    });

    // Instanced Mossy Boulders
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3b403c,
      roughness: 0.9,
      metalness: 0.06,
    });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;
    rocks.forEach((r, i) => {
      const gy = groundHeightAt(r.x, r.z);
      dummy.position.set(r.x, gy + r.scaleY * 0.35, r.z);
      dummy.rotation.set(0, r.rotY, 0);
      dummy.scale.set(r.scaleX, r.scaleY, r.scaleZ);
      dummy.updateMatrix();
      rockInst.setMatrixAt(i, dummy.matrix);
      if (Math.hypot(r.x, r.z) < FOREST_PLAY_RADIUS) {
        this.treeColliders.push({
          x: r.x,
          z: r.z,
          r: Math.max(r.scaleX, r.scaleZ) * 0.78,
        });
      }
    });
    rockInst.instanceMatrix.needsUpdate = true;
    rockInst.computeBoundingSphere();
    this.scene.add(rockInst);

    // 4. Foraging Pickups (Firewood, Planks, Batteries)
    FIREWOOD_SPOTS.forEach((spot) => {
      const mesh = createFirewoodPickup(this.textures.barkMap);
      mesh.position.set(spot.x, groundHeightAt(spot.x, spot.z), spot.z);
      this.scene.add(mesh);
      this.pickups.push({ kind: 'wood', x: spot.x, z: spot.z, active: true, mesh });
    });

    PLANK_SPOTS.forEach((spot) => {
      const mesh = createPlankPickup(this.textures.plankFloorMap);
      mesh.position.set(spot.x, groundHeightAt(spot.x, spot.z), spot.z);
      this.scene.add(mesh);
      this.pickups.push({ kind: 'plank', x: spot.x, z: spot.z, active: true, mesh });
    });

    BATTERY_SPOTS.forEach((spot, idx) => {
      const mesh = createBatteryPickup(this.textures.metalMap);
      const y =
        idx === 0
          ? CABIN_FLOOR_Y + 0.82 // On interior supply table
          : groundHeightAt(spot.x, spot.z);
      mesh.position.set(spot.x, y, spot.z);
      this.scene.add(mesh);
      this.pickups.push({
        kind: 'battery',
        x: spot.x,
        z: spot.z,
        active: true,
        mesh,
      });
    });

    // 5. Two Stalker Agents (1st active from Night 1, 2nd joins Night 16+)
    for (let i = 0; i < 2; i++) {
      const rig = createForestStalkerModel();
      this.scene.add(rig.group);
      this.stalkers.push({
        rig,
        pos: new THREE.Vector3(i === 0 ? -24 : 24, 0, -24),
        yaw: 0,
        behavior: 'lurk',
        targetOpeningIdx: i % 4,
        lurkAngle: i * Math.PI,
        timer: 4 + i * 3,
        flashExpose: 0,
        walkPhase: 0,
        active: i === 0,
      });
    }

    // Phantom hallucination rig for low-sanity Watcher appearances (non-lethal)
    this.phantomRig = createForestStalkerModel();
    this.phantomRig.group.visible = false;
    this.scene.add(this.phantomRig.group);

    if (!this.isSoftwareGl) {
      try {
        this.renderer.compile(this.scene, this.camera);
      } catch {
        // Shaders will compile lazily on first render if precompile fails
      }
    }
  }

  public setTouchMode(enabled: boolean): void {
    this.touchMode = enabled;
    if (enabled && document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock();
    }
  }

  public startNewGame(difficulty: DifficultyMode): void {
    this.audio.initAndResume();
    this.resetRound('playing', difficulty);
    if (!this.touchMode) {
      this.requestPointerLock();
    }
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.audio.initAndResume();
    this.phase = 'playing';
    if (!this.touchMode) {
      this.requestPointerLock();
    }
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  public returnToTitle(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.resetRound('title');
  }

  public toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitHud();
    return m;
  }

  public setVirtualMove(strafe: number, forward: number): void {
    this.virtualMoveX = THREE.MathUtils.clamp(strafe, -1, 1);
    this.virtualMoveY = THREE.MathUtils.clamp(forward, -1, 1);
  }

  public setVirtualSprint(active: boolean): void {
    this.virtualSprint = active;
  }

  public applyLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    const sensitivity = 0.0044;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sensitivity,
      -Math.PI * 0.42,
      Math.PI * 0.42,
    );
  }

  public triggerFlashlight(): void {
    if (this.phase !== 'playing') return;
    this.audio.initAndResume();
    this.toggleFlashlight();
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing') return;
    this.audio.initAndResume();
    this.tryInteract();
  }

  public requestPointerLock(): void {
    try {
      const canvas = this.renderer?.domElement;
      if (canvas && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        const res = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Drag-look and Q/R turning remain active if pointer lock is blocked
          });
        }
      }
    } catch {
      // Safe fallback
    }
  }

  private refreshOpeningPlankMeshes(): void {
    for (const op of this.cabin.openings) {
      for (let i = 0; i < op.plankMeshes.length; i++) {
        op.plankMeshes[i].visible = i < op.planks;
      }
    }
  }

  private respawnPickups(fullReset: boolean): void {
    this.pickups.forEach((p, idx) => {
      if (fullReset || !p.active) {
        // Always ensure wood/planks/batteries replenish at Dawn
        if (fullReset || idx % 2 === (this.night % 2) || p.kind !== 'battery') {
          p.active = true;
          p.mesh.visible = true;
        }
      }
    });
  }

  private resetRound(nextPhase: GamePhase, difficulty = this.difficulty): void {
    this.phase = nextPhase;
    this.deathReason = null;
    this.difficulty = difficulty;
    this.night = 1;
    this.timeOfDay = 'dawn';
    this.phaseDuration = 300;
    this.phaseTimer = 300;
    this.totalNightsSurvived = 0;
    this.planksPlaced = 0;
    this.closeCalls = 0;
    this.inCloseCall = false;

    this.warmth = 100;
    this.frost = 0;
    this.frostWarned = false;
    this.sanity = 100;
    this.sanityWarned = false;
    this.nearestWatcherDist = 999;
    this.inSafeZone = false;
    this.safeZoneSource = null;
    this.hallucinationCooldown = 12 + Math.random() * 8;
    this.phantomTimer = 0;
    this.hallucinationFlash = 0;
    this.flashlightDipTimer = 0;
    if (this.phantomRig) {
      this.phantomRig.group.visible = false;
    }
    this.battery = 100;
    this.stamina = 100;
    this.staminaExhausted = false;
    this.flashlightOn = true;
    this.firewoodCount = 2;
    this.planksCount = 3;
    this.doorOpen = false;
    this.doorAngle = 0;
    this.cabin.doorPivot.rotation.y = 0;
    this.threatLevel = 0;
    this.jumpscareTimer = 0;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualSprint = false;

    // Start player inside cabin near center facing south door
    this.playerPos.set(0, CABIN_FLOOR_Y + PLAYER_EYE_OFFSET, 1.1);
    this.yaw = Math.PI; // Look south toward front door & clearing
    this.pitch = 0;
    this.bobTime = 0;

    // Reset cabin openings to 2 planks each
    this.cabin.openings.forEach((op) => {
      op.planks = 2;
      op.siegeProgress = 0;
    });
    this.refreshOpeningPlankMeshes();
    this.respawnPickups(true);

    // Reset Stalkers deep in perimeter pines
    this.stalkers.forEach((s, idx) => {
      const ang = idx === 0 ? -Math.PI * 0.75 : Math.PI * 0.25;
      s.active = idx === 0;
      s.behavior = 'lurk';
      s.lurkAngle = ang;
      s.pos.set(Math.cos(ang) * 32, groundHeightAt(Math.cos(ang) * 32, Math.sin(ang) * 32), Math.sin(ang) * 32);
      s.timer = 5 + idx * 3;
      s.flashExpose = 0;
      s.rig.group.visible = s.active;
      s.rig.group.position.copy(s.pos);
    });

    if (nextPhase === 'playing') {
      this.showStatus(
        'Day 1 (5:00) — Forage firewood & planks outside, or rest at your bunk to begin Night.',
        5.5,
      );
    } else {
      this.statusMessage = null;
    }

    this.updateAtmosphere(0);
    this.syncCameraAndFlashlight(0);
    this.emitHud();
  }

  private beginNightPhase(): void {
    this.timeOfDay = 'night';
    const baseNightSec = this.night <= 15 ? 90 : this.night <= 35 ? 110 : 135;
    this.phaseDuration = baseNightSec;
    this.phaseTimer = baseNightSec;

    const isBloodMoon = this.night % 10 === 0;
    this.audio.playNightHorn(isBloodMoon);

    // Activate 2nd Stalker from Night 16 onwards
    this.stalkers[0].active = true;
    this.stalkers[0].rig.group.visible = true;
    this.stalkers[1].active = this.night >= 16;
    this.stalkers[1].rig.group.visible = this.stalkers[1].active;

    this.stalkers.forEach((s, idx) => {
      if (!s.active) return;
      s.behavior = 'lurk';
      s.timer = Math.max(1.8, 5.5 - this.night * 0.08) + idx * 2.2;
      s.targetOpeningIdx = (this.night + idx * 2) % 4;
    });

    if (isBloodMoon) {
      this.showStatus(
        `Night ${this.night} — BLOOD MOON. Hold the cabin against relentless siege.`,
        5.0,
      );
    } else if (this.night === 16) {
      this.showStatus(
        `Night 16 — A second Watcher has entered the woods.`,
        5.0,
      );
    } else {
      this.showStatus(`Night ${this.night} of ${MAX_NIGHTS} has fallen.`, 3.5);
    }
  }

  private beginDawnPhase(): void {
    this.totalNightsSurvived = this.night;
    this.saveBestNight(this.night);

    if (this.night >= MAX_NIGHTS) {
      this.phase = 'survived';
      this.audio.playDawnChime();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.emitHud();
      return;
    }

    this.night++;
    this.timeOfDay = 'dawn';
    this.phaseDuration = 300;
    this.phaseTimer = 300;
    this.audio.playDawnChime();
    this.respawnPickups(false);

    // Stalkers retreat back into the fog
    this.stalkers.forEach((s, idx) => {
      s.behavior = 'lurk';
      s.flashExpose = 0;
      const ang = idx === 0 ? -Math.PI * 0.65 : Math.PI * 0.35;
      s.lurkAngle = ang;
    });

    this.showStatus(
      `Dawn breaks. Supplies replenished outside — Night ${this.night} approaches.`,
      4.5,
    );
  }

  private showStatus(msg: string, duration = 3.5): void {
    this.statusMessage = msg;
    this.statusTimer = duration;
  }

  private attachEvents(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', this.boundContextMenu);
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    window.addEventListener('resize', this.boundResize);
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    this.audio.initAndResume();

    const compat = e as MouseEvent & {
      sourceCapabilities?: { firesTouchEvents?: boolean };
    };
    if (this.touchMode || compat.sourceCapabilities?.firesTouchEvents) {
      return;
    }

    if (e.button === 2) {
      this.toggleFlashlight();
      return;
    }

    if (!this.pointerLocked) {
      this.requestPointerLock();
      this.draggingLook = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    } else {
      this.tryInteract();
    }
  }

  private handleMouseUp(): void {
    this.draggingLook = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.phase !== 'playing') return;

    const sensitivity = 0.0022;
    if (this.pointerLocked) {
      this.yaw -= e.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * sensitivity,
        -Math.PI * 0.42,
        Math.PI * 0.42,
      );
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.yaw -= dx * sensitivity * 1.4;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - dy * sensitivity * 1.4,
        -Math.PI * 0.42,
        Math.PI * 0.42,
      );
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keys[e.code] = true;

    if (this.phase === 'playing') {
      if (e.code === 'KeyF') {
        this.toggleFlashlight();
      } else if (e.code === 'KeyE') {
        this.tryInteract();
      } else if (e.code === 'KeyM') {
        this.toggleMute();
      } else if (e.code === 'KeyP') {
        this.pauseGame();
      }
    } else if (this.phase === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
      this.resumeGame();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private toggleFlashlight(): void {
    if (this.battery <= 0.5 && !this.flashlightOn) {
      this.showStatus('Flashlight battery dead. Find spare batteries outside or on the table.', 3.0);
      this.audio.playFlashlightClick(false);
      return;
    }
    this.flashlightOn = !this.flashlightOn;
    this.audio.playFlashlightClick(this.flashlightOn);
    this.emitHud();
  }

  private findNearestInteractable(): {
    label: string;
    action: () => void;
  } | null {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    // 1. Pickups (Firewood, Planks, Batteries)
    for (const p of this.pickups) {
      if (!p.active) continue;
      if (Math.hypot(px - p.x, pz - p.z) < 2.2) {
        const label =
          p.kind === 'wood'
            ? '[E] Collect Firewood'
            : p.kind === 'plank'
              ? '[E] Collect Scrap Planks'
              : '[E] Collect Battery Pack';
        return {
          label,
          action: () => {
            p.active = false;
            p.mesh.visible = false;
            this.audio.playPickup(p.kind);
            if (p.kind === 'wood') {
              this.firewoodCount++;
              this.showStatus('+1 Firewood Bundle collected.', 2.2);
            } else if (p.kind === 'plank') {
              this.planksCount += 2;
              this.showStatus('+2 Scrap Planks collected.', 2.2);
            } else {
              this.battery = Math.min(100, this.battery + 45);
              this.showStatus('Flashlight recharged (+45%).', 2.2);
            }
          },
        };
      }
    }

    // 2. Inside Cabin Interactions
    if (isInsideCabin(px, pz)) {
      // Wood Stove
      if (
        Math.hypot(px - this.cabin.stovePos.x, pz - this.cabin.stovePos.z) < 2.1
      ) {
        if (this.firewoodCount > 0 && (this.warmth < 96 || this.frost > 8 || this.sanity < 92)) {
          return {
            label: '[E] Stoke Wood Stove (+40% Warmth, Thaw Frost)',
            action: () => {
              this.firewoodCount--;
              this.warmth = Math.min(100, this.warmth + 40);
              this.frost = Math.max(0, this.frost - 28);
              this.sanity = Math.min(100, this.sanity + 12);
              this.audio.playStokeFire();
              this.showStatus('Wood stove stoked. Warmth restored & frost thawed.', 2.4);
            },
          };
        }
        return {
          label:
            this.firewoodCount === 0
              ? 'Wood Stove (Need Firewood)'
              : 'Wood Stove (Full Heat)',
          action: () => {
            if (this.firewoodCount === 0) {
              this.showStatus('No firewood left. Search the clearing or woodshed.', 2.6);
            }
          },
        };
      }

      // Bunk (Skip remaining Dawn)
      if (
        this.timeOfDay === 'dawn' &&
        Math.hypot(px - this.cabin.bunkPos.x, pz - this.cabin.bunkPos.z) < 2.2
      ) {
        return {
          label: `[E] Rest at Bunk (Begin Night ${this.night})`,
          action: () => {
            this.beginNightPhase();
          },
        };
      }

      // Windows & Door Barricades (inside)
      for (const op of this.cabin.openings) {
        if (Math.hypot(px - op.interactPos.x, pz - op.interactPos.z) < 1.85) {
          // Door can toggle open/close if unboarded or if looking at door
          if (op.id === 'door') {
            if (op.planks === 0 || this.doorOpen) {
              // Offer barricade if closed & has planks, or open/close door
              if (!this.doorOpen && this.planksCount > 0 && op.planks < op.maxPlanks) {
                return {
                  label: `[E] Board Up Front Door (${op.planks}/${op.maxPlanks} Planks)`,
                  action: () => this.boardOpening(op),
                };
              }
              return {
                label: this.doorOpen ? '[E] Close Front Door' : '[E] Open Front Door',
                action: () => this.toggleDoor(),
              };
            }
            if (op.planks < op.maxPlanks && this.planksCount > 0) {
              return {
                label: `[E] Reinforce Door (${op.planks}/${op.maxPlanks} Planks)`,
                action: () => this.boardOpening(op),
              };
            }
            return {
              label: `Front Door Barricaded (${op.planks}/${op.maxPlanks})`,
              action: () => this.toggleDoor(),
            };
          }

          // Windows
          if (op.planks < op.maxPlanks) {
            if (this.planksCount > 0) {
              return {
                label: `[E] Board Up ${op.label} (${op.planks}/${op.maxPlanks})`,
                action: () => this.boardOpening(op),
              };
            }
            return {
              label: `${op.label} (${op.planks}/${op.maxPlanks} — Need Planks)`,
              action: () => {
                this.showStatus('No scrap planks. Forage outside near the woodshed.', 2.6);
              },
            };
          }
        }
      }
    }

    // 3. Front Door Open/Close from Porch Outside
    if (
      Math.hypot(px - this.cabin.doorInteractPos.x, pz - (this.cabin.doorInteractPos.z + 0.9)) < 1.9
    ) {
      const doorSlot = this.cabin.openings[0];
      if (doorSlot.planks > 0 && !this.doorOpen) {
        return {
          label: '[E] Remove Door Boards & Open',
          action: () => {
            doorSlot.planks = 0;
            this.refreshOpeningPlankMeshes();
            this.toggleDoor();
          },
        };
      }
      return {
        label: this.doorOpen ? '[E] Close Front Door' : '[E] Open Front Door',
        action: () => this.toggleDoor(),
      };
    }

    // 4. Clearing Campfire Interact (add firewood for instant calm & warmth)
    if (Math.hypot(px - this.campfirePos.x, pz - this.campfirePos.z) < 2.3) {
      if (this.firewoodCount > 0 && (this.sanity < 95 || this.frost > 8)) {
        return {
          label: '[E] Feed Campfire (+15% Sanity, Thaw Frost)',
          action: () => {
            this.firewoodCount--;
            this.sanity = Math.min(100, this.sanity + 15);
            this.frost = Math.max(0, this.frost - 25);
            this.audio.playStokeFire();
            this.showStatus('Campfire stoked. Safe Zone steadies your nerves.', 2.4);
          },
        };
      }
    }

    return null;
  }

  private boardOpening(op: OpeningSlot): void {
    if (this.planksCount <= 0 || op.planks >= op.maxPlanks) return;
    if (op.id === 'door' && this.doorOpen) {
      this.doorOpen = false;
    }
    this.planksCount--;
    op.planks++;
    op.siegeProgress = 0;
    this.planksPlaced++;
    this.refreshOpeningPlankMeshes();
    this.audio.playHammerPlank();
    this.showStatus(`${op.label} reinforced (${op.planks}/${op.maxPlanks} planks).`, 2.2);
  }

  private toggleDoor(): void {
    const doorSlot = this.cabin.openings[0];
    if (!this.doorOpen && doorSlot.planks > 0) {
      doorSlot.planks = 0;
      this.refreshOpeningPlankMeshes();
    }
    this.doorOpen = !this.doorOpen;
    this.audio.playDoorCreak(this.doorOpen);
  }

  private tryInteract(): void {
    const target = this.findNearestInteractable();
    if (!target) return;
    target.action();
    this.emitHud();
  }

  private resolvePlayerCollision(nx: number, nz: number): { x: number; z: number } {
    let rx = nx;
    let rz = nz;

    // 1. Static cabin & furniture AABBs
    const resolveAABB = (box: BoxCollider) => {
      const cx = THREE.MathUtils.clamp(rx, box.minX, box.maxX);
      const cz = THREE.MathUtils.clamp(rz, box.minZ, box.maxZ);
      const dx = rx - cx;
      const dz = rz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = PLAYER_RADIUS - dist;
          rx += (dx / dist) * overlap;
          rz += (dz / dist) * overlap;
        } else {
          rz += PLAYER_RADIUS;
        }
      }
    };

    for (let i = 0; i < this.staticColliders.length; i++) {
      resolveAABB(this.staticColliders[i]);
    }
    if (!this.doorOpen) {
      resolveAABB(DOOR_CLOSED_COLLIDER);
    }

    // 2. Pine tree trunks & boulders
    for (let i = 0; i < this.treeColliders.length; i++) {
      const tc = this.treeColliders[i];
      const dx = rx - tc.x;
      const dz = rz - tc.z;
      const minDist = PLAYER_RADIUS + tc.r;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const push = minDist - d;
        rx += (dx / d) * push;
        rz += (dz / d) * push;
      }
    }

    // 3. Natural forest perimeter soft clamp
    const distOrigin = Math.hypot(rx, rz);
    if (distOrigin > FOREST_PLAY_RADIUS) {
      const scale = FOREST_PLAY_RADIUS / distOrigin;
      rx *= scale;
      rz *= scale;
    }

    return { x: rx, z: rz };
  }

  private updatePlayer(dt: number): { moving: boolean; sprinting: boolean; indoors: boolean } {
    if (this.keys['KeyQ']) this.yaw += 1.9 * dt;
    if (this.keys['KeyR']) this.yaw -= 1.9 * dt;

    let forwardInput = this.virtualMoveY;
    let strafeInput = this.virtualMoveX;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafeInput += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafeInput -= 1;

    const inputMag = Math.hypot(forwardInput, strafeInput);
    const moving = inputMag > 0.12;
    const wantsSprint =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.virtualSprint) &&
      moving &&
      !this.staminaExhausted &&
      this.stamina > 4;

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - 22 * dt);
      if (this.stamina <= 0.5) this.staminaExhausted = true;
    } else {
      const regenBase = this.warmth > 15 && this.frost < 65 ? 20 : 10;
      this.stamina = Math.min(100, this.stamina + (moving ? regenBase * 0.55 : regenBase) * dt);
      if (this.staminaExhausted && this.stamina >= 26) {
        this.staminaExhausted = false;
      }
    }

    const chillFactor = this.frost >= 60 ? 0.86 : 1.0;
    const speed = (wantsSprint ? 5.9 : 3.55) * chillFactor;
    if (moving) {
      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      _v1
        .set(0, 0, 0)
        .addScaledVector(_forward, forwardInput)
        .addScaledVector(_right, strafeInput)
        .normalize()
        .multiplyScalar(speed * Math.min(1, inputMag) * dt);

      const resolved = this.resolvePlayerCollision(
        this.playerPos.x + _v1.x,
        this.playerPos.z + _v1.z,
      );
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;
      this.bobTime += dt * (wantsSprint ? 13.5 : 8.2);
    } else {
      this.bobTime += dt * 1.4;
    }

    // Ground height smooth follow (cabin porch/interior vs forest terrain)
    const onPorchOrCabin =
      Math.abs(this.playerPos.x) <= CABIN_HALF_W + 0.3 &&
      this.playerPos.z >= -CABIN_HALF_D - 0.3 &&
      this.playerPos.z <= CABIN_HALF_D + 2.25;
    const targetGroundY = onPorchOrCabin
      ? CABIN_FLOOR_Y
      : groundHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerPos.y = THREE.MathUtils.damp(
      this.playerPos.y,
      targetGroundY + PLAYER_EYE_OFFSET,
      14,
      dt,
    );

    // Flashlight battery drain (gentle during 5-minute Day, full rate at Night)
    if (this.flashlightOn) {
      const drainRate =
        (this.difficulty === 'nightmare' ? 0.42 : 0.28) *
        (this.timeOfDay === 'dawn' ? 0.25 : 1.0);
      this.battery = Math.max(0, this.battery - drainRate * dt);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.audio.playFlashlightClick(false);
        this.showStatus('Flashlight depleted! Find spare batteries.', 3.6);
      }
    }

    const indoors = isInsideCabin(this.playerPos.x, this.playerPos.z);
    const brokenCount = this.cabin.openings.filter((o) => o.planks === 0).length;

    // Warmth drain during Night
    if (this.timeOfDay === 'night') {
      const drain =
        (this.difficulty === 'nightmare' ? 0.52 : 0.36) + brokenCount * 0.15;
      this.warmth = Math.max(0, this.warmth - drain * dt);
    } else {
      // Slight gentle recovery during day if stove has ember
      this.warmth = Math.min(100, this.warmth + 1.2 * dt);
    }

    // Frost buildup & thawing (always increases outside away from fire; thaws in warm cabin or by campfire)
    const distStove = Math.hypot(
      this.playerPos.x - this.cabin.stovePos.x,
      this.playerPos.z - this.cabin.stovePos.z,
    );
    const distCampfire = Math.hypot(
      this.playerPos.x - this.campfirePos.x,
      this.playerPos.z - this.campfirePos.z,
    );
    let frostDelta = 0;
    if (!indoors) {
      if (distCampfire < 4.5) {
        frostDelta = this.timeOfDay === 'night' ? -1.6 : -2.6;
      } else if (this.timeOfDay === 'night') {
        frostDelta = this.difficulty === 'nightmare' ? 3.6 : 2.6;
      } else {
        frostDelta = this.difficulty === 'nightmare' ? 1.65 : 1.15;
      }
    } else if (this.timeOfDay === 'night') {
      if (this.warmth >= 30 && brokenCount === 0) {
        frostDelta = distStove < 3.4 ? -5.5 : -2.2;
      } else if (this.warmth >= 30) {
        frostDelta = brokenCount * 0.45 - (distStove < 3.4 ? 3.5 : 0.8);
      } else {
        frostDelta =
          (this.difficulty === 'nightmare' ? 1.5 : 1.0) +
          brokenCount * 0.45 -
          (distStove < 3.4 && this.warmth > 5 ? 1.0 : 0);
      }
    } else {
      frostDelta =
        this.warmth > 20 ? (distStove < 3.4 ? -6.5 : -4.0) : -1.5;
    }

    this.frost = THREE.MathUtils.clamp(this.frost + frostDelta * dt, 0, 100);
    if (this.frost >= 80 && !this.frostWarned) {
      this.frostWarned = true;
      this.showStatus('Frostbite critical — get inside and stoke the wood stove!', 3.6);
    } else if (this.frost < 60) {
      this.frostWarned = false;
    }

    if (this.frost >= 100) {
      this.phase = 'caught';
      this.deathReason = 'frost';
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.emitHud();
    }

    this.audio.updateFootsteps(moving, wantsSprint, indoors);
    return { moving, sprinting: wantsSprint, indoors };
  }

  private updateStalkers(dt: number, playerSprinting: boolean): void {
    const playerIndoors = isInsideCabin(this.playerPos.x, this.playerPos.z);
    const nightScale = 1 + Math.min(0.65, this.night * 0.013);
    const diffScale = this.difficulty === 'nightmare' ? 1.18 : 1.0;

    let minDist = 999;
    let anyHunting = false;
    let anyMoving = false;
    let dominantBehavior: StalkerBehavior = 'lurk';

    // Camera forward vector for flashlight blind check
    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

    for (let i = 0; i < this.stalkers.length; i++) {
      const s = this.stalkers[i];
      if (!s.active) continue;

      const distPlayer = Math.hypot(
        this.playerPos.x - s.pos.x,
        this.playerPos.z - s.pos.z,
      );
      minDist = Math.min(minDist, distPlayer);

      // Dawn: lurk far back in the misty pine line
      if (this.timeOfDay === 'dawn') {
        s.behavior = 'lurk';
        s.lurkAngle += dt * 0.12 * (i === 0 ? 1 : -1);
        const targetX = Math.cos(s.lurkAngle) * 33;
        const targetZ = Math.sin(s.lurkAngle) * 33;
        this.moveStalkerToward(s, targetX, targetZ, 2.2, dt);
        continue;
      }

      // Check if player's active flashlight beam is blinding this Stalker
      if (this.flashlightOn && distPlayer < 10.5 && s.behavior !== 'recoil') {
        _v1.set(s.pos.x - this.playerPos.x, 0, s.pos.z - this.playerPos.z).normalize();
        const aimDot = _v1.x * _forward.x + _v1.z * _forward.z;
        if (aimDot > 0.78) {
          s.flashExpose += dt;
          if (s.flashExpose >= 1.05) {
            s.behavior = 'recoil';
            s.timer = 7.5;
            s.flashExpose = 0;
            this.showStatus('Flashlight beam drove The Watcher back!', 2.2);
          }
        } else {
          s.flashExpose = Math.max(0, s.flashExpose - dt * 0.6);
        }
      } else {
        s.flashExpose = Math.max(0, s.flashExpose - dt * 0.6);
      }

      if (s.behavior === 'recoil') {
        s.timer -= dt;
        const awayX = s.pos.x + (s.pos.x === 0 ? 1 : s.pos.x) * 2;
        const awayZ = s.pos.z + (s.pos.z === 0 ? 1 : s.pos.z) * 2;
        const awayLen = Math.hypot(awayX, awayZ) || 1;
        this.moveStalkerToward(
          s,
          (awayX / awayLen) * 28,
          (awayZ / awayLen) * 28,
          5.8,
          dt,
        );
        anyMoving = true;
        if (s.timer <= 0) {
          s.behavior = 'lurk';
          s.timer = 3.2;
        }
        continue;
      }

      // If player is outside in the forest at night, The Watcher hunts them!
      const panicBonus = this.sanity < 25 ? 5 : 0;
      const detectOutsideRange =
        (this.flashlightOn ? 23 : playerSprinting ? 18 : 11.5) + panicBonus;
      if (!playerIndoors && distPlayer <= detectOutsideRange) {
        if (s.behavior !== 'hunt') {
          s.behavior = 'hunt';
          this.audio.playSpotSting();
        }
      }

      // Check if any cabin opening is fully breached (0 planks + door open or pried)
      const breachedSlot = this.cabin.openings.find(
        (op) =>
          (op.id === 'door' && this.doorOpen) ||
          (op.planks === 0 && op.siegeProgress >= 1),
      );

      if (s.behavior === 'hunt') {
        anyHunting = true;
        dominantBehavior = 'hunt';
        if (playerIndoors && !breachedSlot) {
          // Player escaped back inside and shut the door! Switch to besieging the door.
          s.behavior = 'siege';
          s.targetOpeningIdx = 0;
          s.timer = 1.6;
        } else {
          const huntSpeed = 4.15 * nightScale * diffScale;
          this.moveStalkerToward(s, this.playerPos.x, this.playerPos.z, huntSpeed, dt);
          anyMoving = true;
        }
      } else if (s.behavior === 'siege') {
        if (dominantBehavior !== 'hunt') dominantBehavior = 'siege';
        const op = this.cabin.openings[s.targetOpeningIdx];
        const distSlot = Math.hypot(
          s.pos.x - op.outsideApproachPos.x,
          s.pos.z - op.outsideApproachPos.z,
        );

        if (distSlot > 0.55) {
          this.moveStalkerToward(
            s,
            op.outsideApproachPos.x,
            op.outsideApproachPos.z,
            3.35 * nightScale * diffScale,
            dt,
          );
          anyMoving = true;
        } else {
          // Face inside the cabin opening
          const lookYaw = Math.atan2(-op.outsideApproachPos.x, -op.outsideApproachPos.z);
          s.yaw = lookYaw;
          s.rig.group.rotation.y = lookYaw;

          // Attack opening at a balanced cadence for 90-135s nights
          s.timer -= dt;
          if (s.timer <= 0) {
            s.timer = Math.max(2.2, 4.0 - this.night * 0.035);
            if (op.id === 'door' && this.doorOpen) {
              s.behavior = 'hunt';
              this.audio.playSpotSting();
            } else if (op.planks > 0) {
              op.planks--;
              this.refreshOpeningPlankMeshes();
              this.audio.playWindowPound(true);
              this.showStatus(`${op.label} plank torn away! (${op.planks} left)`, 2.5);
            } else {
              op.siegeProgress += 0.55;
              this.audio.playWindowPound(false);
              if (op.siegeProgress >= 1) {
                s.behavior = 'hunt';
                this.audio.playSpotSting();
                this.showStatus(`${op.label} BREACHED! Run or blind it!`, 3.4);
              }
            }
          }
        }
      } else {
        // Lurk at clearing edge, then commit to besieging a cabin window/door
        s.lurkAngle += dt * 0.35 * (i === 0 ? 1 : -1);
        const radius = 12.5;
        this.moveStalkerToward(
          s,
          Math.cos(s.lurkAngle) * radius,
          Math.sin(s.lurkAngle) * radius,
          2.6 * nightScale,
          dt,
        );
        anyMoving = true;
        s.timer -= dt;
        if (s.timer <= 0) {
          s.behavior = 'siege';
          // Prefer unboarded openings
          const weakIdx = this.cabin.openings.findIndex((o) => o.planks === 0);
          s.targetOpeningIdx =
            weakIdx >= 0 ? weakIdx : Math.floor(Math.random() * this.cabin.openings.length);
          s.timer = 1.2;
        }
      }

      // Catch check
      if (distPlayer < 1.2) {
        this.phase = 'caught';
        this.deathReason = 'stalker';
        this.jumpscareTimer = 0.95;
        this.killerPos.copy(s.pos);
        this.killerYaw = s.yaw;
        this.audio.playJumpscare();
        if (document.pointerLockElement === this.renderer.domElement) {
          document.exitPointerLock();
        }
        this.emitHud();
        return;
      }
    }

    this.nearestWatcherDist = minDist;
    this.threatLevel =
      this.timeOfDay === 'dawn'
        ? 0
        : THREE.MathUtils.clamp(1 - (minDist - 2.0) / 15.0, 0, 1);

    if (minDist < 4.8 && this.timeOfDay === 'night' && !this.inCloseCall) {
      this.inCloseCall = true;
      this.closeCalls++;
    } else if (minDist > 8.0) {
      this.inCloseCall = false;
    }

    this.audio.updateStalkerAudio(minDist, anyMoving, anyHunting);
    this.audio.updateThreatHeartbeat(this.threatLevel);
    // Track dominant behavior
    void dominantBehavior;
  }

  private updateSanity(dt: number, indoors: boolean): void {
    const diffScale = this.difficulty === 'nightmare' ? 1.32 : 1.0;
    const distStove = Math.hypot(
      this.playerPos.x - this.cabin.stovePos.x,
      this.playerPos.z - this.cabin.stovePos.z,
    );
    const distCampfire = Math.hypot(
      this.playerPos.x - this.campfirePos.x,
      this.playerPos.z - this.campfirePos.z,
    );
    const distPorchLantern = Math.hypot(
      this.playerPos.x - 1.35,
      this.playerPos.z - (CABIN_HALF_D + 2.0),
    );

    const nearStove = indoors && this.warmth >= 20 && distStove < 4.5;
    const nearCampfire = !indoors && distCampfire < 4.5;
    const nearPorch = !indoors && distPorchLantern < 3.8;

    this.inSafeZone = nearStove || nearCampfire || nearPorch;
    this.safeZoneSource = nearStove
      ? 'Wood Stove'
      : nearCampfire
        ? 'Campfire'
        : nearPorch
          ? 'Porch Lantern'
          : null;

    const nearWatcher = this.nearestWatcherDist < 14;

    let sanityDelta = 0;

    // 1. Drain near The Watcher (dampened inside a lit Safe Zone)
    if (nearWatcher) {
      const proximity = THREE.MathUtils.clamp(
        1 - (this.nearestWatcherDist - 2.0) / 12.0,
        0.1,
        1,
      );
      const safeShield = this.inSafeZone && this.nearestWatcherDist > 6 ? 0.35 : 1.0;
      sanityDelta -= (1.35 + proximity * 3.6) * diffScale * safeShield;
    }

    // 2. Drain in darkness (night without flashlight and outside a Safe Zone light source)
    if (this.timeOfDay === 'night' && !this.flashlightOn && !this.inSafeZone) {
      if (!indoors) {
        sanityDelta -= 2.35 * diffScale;
      } else {
        sanityDelta -= (this.warmth < 25 ? 1.85 : 0.75) * diffScale;
      }
    }

    // 3. Safe Zone slow sanity regeneration (lit campfire, wood stove, or porch lantern) + daylight calm
    if (this.inSafeZone && this.nearestWatcherDist > 7.5) {
      sanityDelta += nearStove ? 2.2 : nearCampfire ? 1.9 : 1.35;
    } else if (!nearWatcher) {
      if (this.timeOfDay === 'dawn') {
        sanityDelta += indoors && this.warmth > 20 ? 2.8 : 1.5;
      } else if (this.flashlightOn && indoors) {
        sanityDelta += 0.55;
      }
    }

    this.sanity = THREE.MathUtils.clamp(this.sanity + sanityDelta * dt, 0, 100);
    if (this.sanity <= 32 && !this.sanityWarned) {
      this.sanityWarned = true;
      this.showStatus(
        'Your sanity is slipping — turn on your light and stay clear of The Watcher!',
        3.8,
      );
    } else if (this.sanity >= 55) {
      this.sanityWarned = false;
    }

    // Decay subtle hallucination flash, flashlight dip, and active phantom
    this.hallucinationFlash = Math.max(0, this.hallucinationFlash - dt * 3.4);
    this.flashlightDipTimer = Math.max(0, this.flashlightDipTimer - dt);

    if (this.phantomTimer > 0) {
      this.phantomTimer -= dt;
      this.phantomRig.headPivot.rotation.z = Math.sin(performance.now() * 0.03) * 0.32;
      if (this.phantomTimer <= 0) {
        this.phantomRig.group.visible = false;
      }
    }

    // Occasional unexpected low-sanity visual or auditory Watcher jumpscare
    if (this.sanity < 55) {
      const rateScale = 1 + (55 - this.sanity) / 38;
      this.hallucinationCooldown -= dt * rateScale;
      if (this.hallucinationCooldown <= 0) {
        this.hallucinationCooldown = 11 + Math.random() * 14;
        this.triggerLowSanityScare(indoors);
      }
    }
  }

  private triggerLowSanityScare(indoors: boolean): void {
    const roll = Math.random();
    if (roll < 0.48) {
      // Visual phantom Watcher briefly manifests in peripheral/forward sight + subtle sound
      const sideOffset = (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.34);
      const angle = this.yaw + sideOffset;
      const dist = indoors ? 2.6 + Math.random() * 1.1 : 3.8 + Math.random() * 1.8;
      const px = this.playerPos.x - Math.sin(angle) * dist;
      const pz = this.playerPos.z - Math.cos(angle) * dist;
      const py = isInsideCabin(px, pz) ? CABIN_FLOOR_Y : groundHeightAt(px, pz);

      this.phantomRig.group.position.set(px, py, pz);
      this.phantomRig.group.rotation.y = Math.atan2(
        this.playerPos.x - px,
        this.playerPos.z - pz,
      );
      this.phantomRig.eyeMaterial.emissiveIntensity = 6.8;
      this.phantomRig.leftArmPivot.rotation.x = -0.85;
      this.phantomRig.rightArmPivot.rotation.x = -0.85;
      this.phantomRig.group.visible = true;
      this.phantomTimer = 0.34 + Math.random() * 0.22;

      this.hallucinationFlash = 0.85;
      this.flashlightDipTimer = 0.24;
      this.audio.playSubtleWatcherScare(Math.random() < 0.5 ? 'whisper' : 'sting');
    } else {
      // Pure auditory phantom scare (knocks at door/window, whisper behind you, or brief sting)
      const audioKind =
        indoors && Math.random() < 0.45
          ? 'knock'
          : Math.random() < 0.6
            ? 'whisper'
            : 'sting';
      this.hallucinationFlash = 0.42;
      this.flashlightDipTimer = 0.16;
      this.audio.playSubtleWatcherScare(audioKind);
    }
  }

  private moveStalkerToward(
    s: StalkerAgent,
    tx: number,
    tz: number,
    speed: number,
    dt: number,
  ): void {
    const dx = tx - s.pos.x;
    const dz = tz - s.pos.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.08) {
      s.pos.x += (dx / len) * speed * dt;
      s.pos.z += (dz / len) * speed * dt;
      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - s.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.yaw += diff * Math.min(1, 7 * dt);
    }

    const gy = isInsideCabin(s.pos.x, s.pos.z)
      ? CABIN_FLOOR_Y
      : groundHeightAt(s.pos.x, s.pos.z);

    s.walkPhase += dt * (speed * 2.1);
    const swing = Math.sin(s.walkPhase) * 0.48;
    s.rig.leftLegPivot.rotation.x = swing;
    s.rig.rightLegPivot.rotation.x = -swing;
    s.rig.leftArmPivot.rotation.x =
      s.behavior === 'hunt' ? -0.95 + swing * 0.3 : -swing * 0.45;
    s.rig.rightArmPivot.rotation.x =
      s.behavior === 'hunt' ? -0.95 - swing * 0.3 : swing * 0.45;
    s.rig.headPivot.rotation.z =
      Math.sin(performance.now() * 0.002 + s.lurkAngle) * 0.18;
    s.rig.eyeMaterial.emissiveIntensity =
      s.behavior === 'hunt' ? 5.5 : s.behavior === 'siege' ? 4.2 : 2.5;

    s.rig.group.position.set(
      s.pos.x,
      gy + Math.abs(Math.sin(s.walkPhase)) * 0.05,
      s.pos.z,
    );
    s.rig.group.rotation.y = s.yaw;
  }

  private updateAtmosphere(dt: number): void {
    const t = performance.now() * 0.001;
    const isBloodMoon = this.timeOfDay === 'night' && this.night % 10 === 0;

    // Sky & fog color blend between Misty Dawn and Deep Night / Blood Moon
    if (this.phase === 'title') {
      _colorA.setHex(0x070b10);
      (this.scene.background as THREE.Color).copy(_colorA);
      (this.scene.fog as THREE.FogExp2).color.copy(_colorA);
      (this.scene.fog as THREE.FogExp2).density = 0.048;
      this.moonLight.intensity = 0.7;
      this.hemiLight.intensity = 0.48;
    } else if (this.timeOfDay === 'dawn') {
      _colorA.setHex(0x1f2b36);
      (this.scene.background as THREE.Color).lerp(_colorA, Math.min(1, 2.5 * dt));
      (this.scene.fog as THREE.FogExp2).color.copy(this.scene.background as THREE.Color);
      (this.scene.fog as THREE.FogExp2).density = THREE.MathUtils.damp(
        (this.scene.fog as THREE.FogExp2).density,
        0.032,
        2.5,
        dt,
      );
      this.moonLight.color.setHex(0xc7dcf0);
      this.moonLight.intensity = THREE.MathUtils.damp(this.moonLight.intensity, 1.45, 2.5, dt);
      this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 0.85, 2.5, dt);
    } else {
      _colorA.setHex(isBloodMoon ? 0x1a0608 : 0x040609);
      (this.scene.background as THREE.Color).lerp(_colorA, Math.min(1, 2.5 * dt));
      (this.scene.fog as THREE.FogExp2).color.copy(this.scene.background as THREE.Color);
      const targetDensity = isBloodMoon ? 0.058 : 0.05 + Math.min(0.014, this.night * 0.0003);
      (this.scene.fog as THREE.FogExp2).density = THREE.MathUtils.damp(
        (this.scene.fog as THREE.FogExp2).density,
        targetDensity,
        2.5,
        dt,
      );
      this.moonLight.color.setHex(isBloodMoon ? 0xdc4444 : 0x7ea6cf);
      this.moonLight.intensity = THREE.MathUtils.damp(
        this.moonLight.intensity,
        isBloodMoon ? 0.95 : 0.55,
        2.5,
        dt,
      );
      this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 0.34, 2.5, dt);
    }

    // Smooth door hinge animation
    const targetDoorAngle = this.doorOpen ? -Math.PI * 0.48 : 0;
    this.doorAngle = THREE.MathUtils.damp(this.doorAngle, targetDoorAngle, 10, dt);
    this.cabin.doorPivot.rotation.y = this.doorAngle;

    // Wood stove fire flicker scaled by warmth
    const fireStrength = Math.max(0.08, this.warmth / 100);
    const flicker = 0.88 + Math.sin(t * 9.5) * 0.08 + Math.cos(t * 17.3) * 0.04;
    this.cabin.stoveLight.intensity = 3.2 * fireStrength * flicker;
    this.cabin.stoveEmberMat.emissiveIntensity = 2.6 * fireStrength * flicker;

    // Porch lantern subtle wind sway & flicker
    const porchFlicker = 0.9 + Math.sin(t * 6.2) * 0.1;
    this.cabin.porchLight.intensity = 2.1 * porchFlicker;
    this.cabin.porchBulbMat.emissiveIntensity = 2.1 * porchFlicker;

    // Clearing campfire flame & light flicker
    const campFlicker = 0.86 + Math.sin(t * 11.2) * 0.1 + Math.cos(t * 19.4) * 0.05;
    this.campfire.light.intensity = 3.6 * campFlicker;
    this.campfire.emberMat.emissiveIntensity = 2.8 * campFlicker;
    this.campfire.flameGroup.scale.set(
      0.95 + Math.sin(t * 8.5) * 0.08,
      0.88 + Math.cos(t * 13.1) * 0.16,
      0.95 + Math.cos(t * 9.2) * 0.08,
    );
    this.campfire.flameGroup.rotation.y = Math.sin(t * 3.4) * 0.22;
  }

  private syncCameraAndFlashlight(dt: number): void {
    if (this.phase === 'title') {
      // Orbit slowly through the misty clearing looking at the glowing cabin porch
      if (Math.abs(this.camera.fov - 72) > 0.1) {
        this.camera.fov = 72;
        this.camera.updateProjectionMatrix();
      }
      const t = performance.now() * 0.00022;
      const px = Math.sin(t) * 14.5;
      const pz = 14.5 + Math.cos(t * 0.8) * 3.5;
      this.camera.position.set(px, groundHeightAt(px, pz) + 2.1, pz);
      this.camera.lookAt(0, 1.85, 1.5);
      this.flashlight.intensity = 0;
      this.handSpillLight.position.copy(this.camera.position);
      return;
    }

    if (this.phase === 'caught') {
      if (Math.abs(this.camera.fov - 72) > 0.1) {
        this.camera.fov = 72;
        this.camera.updateProjectionMatrix();
      }
      if (this.deathReason === 'frost') {
        this.pitch = THREE.MathUtils.damp(this.pitch, -0.52, 2.5, dt);
        this.camera.position.y = THREE.MathUtils.damp(
          this.camera.position.y,
          groundHeightAt(this.playerPos.x, this.playerPos.z) + 0.55,
          2.5,
          dt,
        );
        _euler.set(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
        this.flashlight.intensity = 1.5;
        this.handSpillLight.position.copy(this.camera.position);
        return;
      }

      this.jumpscareTimer = Math.max(0, this.jumpscareTimer - dt);
      const shake = this.jumpscareTimer * 0.14;
      _v2.set(this.killerPos.x, this.killerPos.y + 2.35, this.killerPos.z);
      _v1.set(
        this.killerPos.x + Math.sin(this.killerYaw) * 1.15 + (Math.random() - 0.5) * shake,
        this.killerPos.y + 1.88 + (Math.random() - 0.5) * shake,
        this.killerPos.z + Math.cos(this.killerYaw) * 1.15 + (Math.random() - 0.5) * shake,
      );
      this.camera.position.lerp(_v1, Math.min(1, 18 * dt));
      this.camera.lookAt(_v2);
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.copy(_v2);
      this.flashlight.intensity = 15;
      this.handSpillLight.position.copy(this.camera.position);
      return;
    }

    const t = performance.now() * 0.001;
    const madness = THREE.MathUtils.clamp((65 - this.sanity) / 65, 0, 1);

    // 3D FOV breathing & spatial warp at low sanity
    const targetFov =
      72 + Math.sin(t * 2.1) * (madness * 9.5) + madness * 6.5;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    const bobY = Math.sin(this.bobTime) * 0.04;
    const bobX = Math.cos(this.bobTime * 0.5) * 0.022;
    this.camera.position.set(
      this.playerPos.x + bobX,
      this.playerPos.y + bobY,
      this.playerPos.z,
    );

    // Subtle dutch-roll tilt & dread tremor as sanity drops
    const roll =
      madness > 0.02
        ? Math.sin(t * 1.65) * (madness * 0.085) +
          Math.sin(t * 11.7) * (madness * madness * 0.018)
        : 0;
    const yawJitter = madness > 0.35 ? Math.sin(t * 7.3) * (madness * 0.012) : 0;
    const pitchJitter = madness > 0.35 ? Math.cos(t * 6.1) * (madness * 0.01) : 0;
    _euler.set(this.pitch + pitchJitter, this.yaw + yawJitter, roll, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    _right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

    this.flashlight.position
      .copy(this.camera.position)
      .addScaledVector(_right, 0.16);
    this.flashlight.position.y -= 0.14;
    this.flashlightTarget.position
      .copy(this.flashlight.position)
      .addScaledVector(_forward, 12);

    let intensity = this.flashlightOn ? 10.5 : 0;
    if (this.flashlightOn && this.flashlightDipTimer > 0) {
      intensity *= 0.15;
    } else if (this.flashlightOn && this.battery < 22) {
      const sputter =
        Math.sin(performance.now() * 0.045) * Math.cos(performance.now() * 0.019);
      if (sputter > 0.52) intensity *= 0.18;
    }
    this.flashlight.intensity = intensity;
    this.handSpillLight.position.copy(this.camera.position);
  }

  private emitHud(): void {
    const interactable =
      this.phase === 'playing' ? this.findNearestInteractable() : null;
    const intactBarricades = this.cabin.openings.reduce((acc, o) => acc + o.planks, 0);
    const totalBarricadeSlots = this.cabin.openings.length * 3;
    const activeBehavior =
      this.stalkers.find((s) => s.active && s.behavior === 'hunt')?.behavior ||
      this.stalkers.find((s) => s.active && s.behavior === 'siege')?.behavior ||
      this.stalkers[0]?.behavior ||
      'lurk';

    this.onHudUpdate({
      phase: this.phase,
      deathReason: this.deathReason,
      difficulty: this.difficulty,
      night: this.night,
      maxNights: MAX_NIGHTS,
      timeOfDay: this.timeOfDay,
      isBloodMoon: this.timeOfDay === 'night' && this.night % 10 === 0,
      phaseSecondsLeft: Math.ceil(Math.max(0, this.phaseTimer)),
      phaseProgress: 1 - Math.max(0, this.phaseTimer / Math.max(1, this.phaseDuration)),
      warmth: Math.round(this.warmth),
      frost: Math.round(this.frost),
      sanity: Math.round(this.sanity),
      hallucinationFlash: this.hallucinationFlash,
      battery: Math.round(this.battery),
      stamina: Math.round(this.stamina),
      flashlightOn: this.flashlightOn,
      firewoodCount: this.firewoodCount,
      planksCount: this.planksCount,
      doorOpen: this.doorOpen,
      intactBarricades,
      totalBarricadeSlots,
      threatLevel: this.threatLevel,
      stalkerState: activeBehavior,
      locationLabel: getLocationLabel(this.playerPos.x, this.playerPos.z),
      interactPrompt: interactable ? interactable.label : null,
      statusMessage: this.statusMessage,
      inSafeZone: this.inSafeZone,
      safeZoneSource: this.safeZoneSource,
      pointerLocked: this.pointerLocked,
      muted: this.audio.isMuted(),
      bestNight: this.bestNight,
      planksPlaced: this.planksPlaced,
      totalNightsSurvived: this.totalNightsSurvived,
      closeCalls: this.closeCalls,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private cancelFrame(): void {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(rawDt, 0.08);

    if (this.phase === 'playing') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.timeOfDay === 'dawn') {
          this.beginNightPhase();
        } else {
          this.beginDawnPhase();
        }
      }

      if (this.statusTimer > 0) {
        this.statusTimer -= dt;
        if (this.statusTimer <= 0) this.statusMessage = null;
      }

      if (this.phase === 'playing') {
        const { sprinting, indoors } = this.updatePlayer(dt);
        this.updateStalkers(dt, sprinting);
        this.updateSanity(dt, indoors);
      }
    }

    this.updateAtmosphere(dt);
    this.syncCameraAndFlashlight(dt);
    this.renderer.render(this.scene, this.camera);

    this.hudThrottleAcc += dt;
    if (this.hudThrottleAcc >= 0.08) {
      this.hudThrottleAcc = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.loop(performance.now()));
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  public dispose(): void {
    this.disposed = true;
    this.cancelFrame();

    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    window.removeEventListener('resize', this.boundResize);

    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('mousedown', this.boundMouseDown);
      this.renderer.domElement.removeEventListener('contextmenu', this.boundContextMenu);
      this.renderer.domElement.remove();
    }

    this.audio.dispose();
    this.textures?.dispose();

    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.renderer?.dispose();
  }
}
