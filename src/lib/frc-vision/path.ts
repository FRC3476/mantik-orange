export const VISION_STORAGE_KEY = 'mantik-frc-vision';
export const VISION_TAB_GROUP = 'frc-vision';
export const VISION_CHANGE_EVENT = 'mantik-frc-vision-change';

export const VISION_PATHS = ['photonvision', 'limelight'] as const;
export type VisionPath = (typeof VISION_PATHS)[number];

export const DEFAULT_VISION_PATH: VisionPath = 'photonvision';

export const VISION_LESSON_IDS = {
  intro: 'pose-estimation-intro',
  odometry: 'odometry',
  choice: 'vision-system-choice',
  photonvision: 'photonvision',
  limelight: 'limelight',
  subsystem: 'vision-subsystem',
  fusion: 'vision-pose-estimation-fusion',
  calibration: 'pose-estimation-calibration',
} as const;

export function isVisionPath(value: unknown): value is VisionPath {
  return value === 'photonvision' || value === 'limelight';
}

export function parseVisionPath(value: unknown): VisionPath | null {
  return isVisionPath(value) ? value : null;
}

export function readVisionPathFromStorage(storage: Pick<Storage, 'getItem'> | null): VisionPath | null {
  if (!storage) return null;
  try {
    return parseVisionPath(storage.getItem(VISION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeVisionPathToStorage(
  storage: Pick<Storage, 'setItem'> | null,
  value: VisionPath,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(VISION_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function resolveVisionPath(options: {
  explicit?: unknown;
  stored?: unknown;
}): VisionPath {
  return parseVisionPath(options.explicit) ?? parseVisionPath(options.stored) ?? DEFAULT_VISION_PATH;
}

export interface VisionAdjacentOverride {
  prevId?: string;
  /** `null` hides Next. `undefined` keeps the default Next. */
  nextId?: string | null;
}

export function frcVisionAdjacentOverride(lessonId: string): VisionAdjacentOverride | null {
  if (lessonId === VISION_LESSON_IDS.choice) {
    return { prevId: VISION_LESSON_IDS.odometry, nextId: null };
  }
  if (lessonId === VISION_LESSON_IDS.photonvision || lessonId === VISION_LESSON_IDS.limelight) {
    return { prevId: VISION_LESSON_IDS.choice, nextId: VISION_LESSON_IDS.subsystem };
  }
  if (lessonId === VISION_LESSON_IDS.subsystem) {
    return { prevId: VISION_LESSON_IDS.choice, nextId: VISION_LESSON_IDS.fusion };
  }
  return null;
}
