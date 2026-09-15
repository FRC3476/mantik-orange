import {
  DEFAULT_VISION_PATH,
  parseVisionPath,
  readVisionPathFromStorage,
  VISION_CHANGE_EVENT,
  VISION_STORAGE_KEY,
  type VisionPath,
  writeVisionPathToStorage,
} from './path';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredVisionPath(): VisionPath | null {
  return readVisionPathFromStorage(storage());
}

export function persistVisionPath(value: VisionPath): boolean {
  return writeVisionPathToStorage(storage(), value);
}

export function emitVisionPathChange(value: VisionPath, source: EventTarget | null): void {
  const event = new CustomEvent(VISION_CHANGE_EVENT, {
    detail: { value, source },
  });
  document.dispatchEvent(event);
}

export function applyExplicitVisionPath(value: string, source: EventTarget | null): VisionPath | null {
  const parsed = parseVisionPath(value);
  if (!parsed) return null;
  persistVisionPath(parsed);
  emitVisionPathChange(parsed, source);
  return parsed;
}

export function initialVisionPath(): VisionPath {
  return loadStoredVisionPath() ?? DEFAULT_VISION_PATH;
}

export { DEFAULT_VISION_PATH, VISION_CHANGE_EVENT, VISION_STORAGE_KEY };
export type { VisionPath };
