export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tag?: 'cabin-wall' | 'door' | 'prop';
}

export interface SpawnSpot {
  x: number;
  z: number;
}

export const CABIN_HALF_W = 4.2; // X: -4.2 .. +4.2
export const CABIN_HALF_D = 4.2; // Z: -4.2 .. +4.2
export const CABIN_FLOOR_Y = 0.28;
export const DOOR_WIDTH = 1.35;
export const FOREST_PLAY_RADIUS = 44;

/**
 * Continuous procedural terrain height.
 * Keeps a flat clearing around the cabin (r < 11) and rises gently into outer pine ridges.
 */
export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  if (dist <= 11.5) return 0;

  const t = Math.min(1, (dist - 11.5) / 28);
  const smooth = t * t * (3 - 2 * t);
  const undulation =
    Math.sin(x * 0.14) * Math.cos(z * 0.13) * 0.65 +
    Math.sin(x * 0.07 - z * 0.09) * 0.85;
  const ridge = Math.max(0, (dist - 42) * 0.24);
  return smooth * undulation + ridge;
}

export function isInsideCabin(x: number, z: number): boolean {
  return (
    x > -CABIN_HALF_W + 0.15 &&
    x < CABIN_HALF_W - 0.15 &&
    z > -CABIN_HALF_D + 0.15 &&
    z < CABIN_HALF_D - 0.15
  );
}

export function getLocationLabel(x: number, z: number): string {
  if (isInsideCabin(x, z)) return 'Inside Cabin';
  if (Math.abs(x) < 5.5 && z >= CABIN_HALF_D - 0.2 && z <= CABIN_HALF_D + 2.4) {
    return 'Cabin Porch';
  }
  const dist = Math.hypot(x, z);
  if (dist < 15) return 'Cabin Clearing';
  if (z < -12) return 'North Pine Ridge';
  if (x < -12) return 'West Creek Trail';
  if (x > 12) return 'East Logging Path';
  return 'South Woods';
}

/**
 * Static AABB colliders for cabin walls (leaving a 1.35m South doorway gap),
 * interior furniture, and exterior woodshed.
 */
export function buildStaticColliders(): BoxCollider[] {
  const t = 0.28; // wall half-thickness
  const hw = CABIN_HALF_W;
  const hd = CABIN_HALF_D;
  const doorHalf = DOOR_WIDTH / 2;

  return [
    // North wall
    { minX: -hw - t, maxX: hw + t, minZ: -hd - t, maxZ: -hd + t, tag: 'cabin-wall' },
    // West wall
    { minX: -hw - t, maxX: -hw + t, minZ: -hd - t, maxZ: hd + t, tag: 'cabin-wall' },
    // East wall
    { minX: hw - t, maxX: hw + t, minZ: -hd - t, maxZ: hd + t, tag: 'cabin-wall' },
    // South wall left of doorway
    { minX: -hw - t, maxX: -doorHalf, minZ: hd - t, maxZ: hd + t, tag: 'cabin-wall' },
    // South wall right of doorway
    { minX: doorHalf, maxX: hw + t, minZ: hd - t, maxZ: hd + t, tag: 'cabin-wall' },
    // Interior wood stove (NW corner)
    { minX: -3.6, maxX: -2.35, minZ: -3.6, maxZ: -2.4, tag: 'prop' },
    // Interior bunk (NE corner)
    { minX: 2.0, maxX: 3.85, minZ: -3.75, maxZ: -2.35, tag: 'prop' },
    // Interior supply table (SW corner)
    { minX: -3.65, maxX: -2.2, minZ: 1.5, maxZ: 2.9, tag: 'prop' },
    // Exterior woodshed (west clearing)
    { minX: -12.8, maxX: -10.2, minZ: -3.2, maxZ: -1.4, tag: 'prop' },
  ];
}

export const DOOR_CLOSED_COLLIDER: BoxCollider = {
  minX: -DOOR_WIDTH / 2,
  maxX: DOOR_WIDTH / 2,
  minZ: CABIN_HALF_D - 0.22,
  maxZ: CABIN_HALF_D + 0.22,
  tag: 'door',
};

/**
 * Curated clearing & forest trail foraging coordinates for Firewood, Planks, and Batteries.
 */
export const FIREWOOD_SPOTS: SpawnSpot[] = [
  { x: -11.4, z: -0.6 }, // Beside woodshed
  { x: -9.8, z: 7.5 },
  { x: 9.4, z: 6.2 },
  { x: 11.2, z: -7.8 },
  { x: -7.2, z: -12.4 },
  { x: 2.8, z: -15.6 },
  { x: 16.5, z: 1.2 },
  { x: -17.2, z: -6.4 },
  { x: 6.2, z: 16.4 },
  { x: -14.0, z: 14.5 },
];

export const PLANK_SPOTS: SpawnSpot[] = [
  { x: -9.5, z: -2.5 }, // Woodshed front
  { x: 8.6, z: -2.8 },
  { x: -6.4, z: 11.5 },
  { x: 12.8, z: 11.2 },
  { x: -15.4, z: 4.5 },
  { x: 14.2, z: -12.0 },
  { x: 0.5, z: -13.2 },
  { x: 18.4, z: -4.2 },
];

export const BATTERY_SPOTS: SpawnSpot[] = [
  { x: -2.8, z: 2.2 }, // Cabin supply table (guaranteed close start)
  { x: 7.8, z: 3.8 },
  { x: -11.2, z: -4.4 },
  { x: -12.6, z: 10.8 },
  { x: 14.8, z: 5.5 },
  { x: 4.5, z: -11.2 },
  { x: -16.8, z: -11.5 },
];

export interface TreePlacement {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  tint: number;
}

export interface RockPlacement {
  x: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
}

/**
 * Deterministic natural pine forest & boulder distribution outside the cabin clearing.
 */
export function generateForestProps(): {
  trees: TreePlacement[];
  rocks: RockPlacement[];
} {
  let seed = 884217;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const trees: TreePlacement[] = [];
  const rocks: RockPlacement[] = [];

  // Ring of dense perimeter pines + mid-ground scattered pines
  let attempts = 0;
  while (trees.length < 245 && attempts < 2200) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const minR = trees.length < 130 ? 11.2 : 34.0;
    const maxR = trees.length < 130 ? 38.0 : 62.0;
    const radius = minR + rand() * (maxR - minR);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Keep south trail approach slightly clearer and avoid woodshed footprint
    if (Math.abs(x) < 2.2 && z > 4 && z < 20) continue;
    if (x > -14 && x < -9 && z > -5 && z < 1) continue;

    // Minimum spacing between trees
    let tooClose = false;
    for (let i = 0; i < trees.length; i++) {
      const dx = trees[i].x - x;
      const dz = trees[i].z - z;
      if (dx * dx + dz * dz < 8.5) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    trees.push({
      x,
      z,
      scale: 0.85 + rand() * 0.42,
      rotY: rand() * Math.PI * 2,
      tint: 0.82 + rand() * 0.34,
    });
  }

  for (let i = 0; i < 48; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 12.5 + rand() * 34;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 2.5 && z > 4 && z < 16) continue;
    rocks.push({
      x,
      z,
      scaleX: 0.55 + rand() * 0.9,
      scaleY: 0.4 + rand() * 0.65,
      scaleZ: 0.55 + rand() * 0.9,
      rotY: rand() * Math.PI * 2,
    });
  }

  return { trees, rocks };
}
