import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VISION_PATH,
  frcVisionAdjacentOverride,
  parseVisionPath,
  readVisionPathFromStorage,
  resolveVisionPath,
  writeVisionPathToStorage,
} from './path';

describe('vision path storage', () => {
  it('accepts only photonvision and limelight', () => {
    expect(parseVisionPath('photonvision')).toBe('photonvision');
    expect(parseVisionPath('limelight')).toBe('limelight');
    expect(parseVisionPath('PhotonVision')).toBeNull();
    expect(parseVisionPath('')).toBeNull();
    expect(parseVisionPath(null)).toBeNull();
  });

  it('prefers an explicit choice over storage', () => {
    expect(resolveVisionPath({ explicit: 'limelight', stored: 'photonvision' })).toBe('limelight');
    expect(resolveVisionPath({ stored: 'limelight' })).toBe('limelight');
    expect(resolveVisionPath({})).toBe(DEFAULT_VISION_PATH);
  });

  it('branches Previous/Next around the vision setup fork', () => {
    expect(frcVisionAdjacentOverride('vision-system-choice')).toEqual({
      prevId: 'odometry',
      nextId: null,
    });
    expect(frcVisionAdjacentOverride('photonvision')?.nextId).toBe('vision-subsystem');
    expect(frcVisionAdjacentOverride('limelight')?.prevId).toBe('vision-system-choice');
    expect(frcVisionAdjacentOverride('vision-subsystem')).toEqual({
      prevId: 'vision-system-choice',
      nextId: 'vision-pose-estimation-fusion',
    });
    expect(frcVisionAdjacentOverride('odometry')).toBeNull();
  });

  it('treats blocked storage as missing, not a crash', () => {
    const throwing = {
      getItem(): string {
        throw new Error('blocked');
      },
      setItem(): void {
        throw new Error('blocked');
      },
    };
    expect(readVisionPathFromStorage(throwing)).toBeNull();
    expect(writeVisionPathToStorage(throwing, 'limelight')).toBe(false);
  });
});
