import { describe, expect, it } from 'vitest';
import {
  lowestAmbiguityTag,
  rejectVisionCapture,
  stdDevsForCapture,
  VISION_QUALITY,
  type VisionCapture,
} from './quality';

const photonBase: VisionCapture = {
  vendor: 'photonvision',
  solveType: 'multi_tag',
  x: 4,
  y: 4,
  z: 0.2,
  rollRad: 0,
  pitchRad: 0,
  yawRad: 0.1,
  timestampSeconds: 10,
  visibleTags: [
    { id: 1, ambiguity: 0.1, cameraToTagMeters: 1.5 },
    { id: 2, ambiguity: 0.2, cameraToTagMeters: 1.8 },
  ],
  usedTagIds: [1, 2],
};

describe('vision quality policy', () => {
  it('accepts a coprocessor MultiTag solve with used IDs', () => {
    expect(rejectVisionCapture(photonBase)).toBeNull();
    expect(stdDevsForCapture(photonBase)).toEqual(VISION_QUALITY.multiTagStdDevs);
  });

  it('does not treat a full visible-target list as MultiTag', () => {
    const fallback: VisionCapture = {
      ...photonBase,
      solveType: 'single_tag',
      usedTagIds: undefined,
      selectedTag: { id: 1, ambiguity: 0.1, cameraToTagMeters: 1.5 },
    };
    expect(rejectVisionCapture(fallback)).toBeNull();
    expect(stdDevsForCapture(fallback)).toEqual(VISION_QUALITY.singleTagStdDevs);
  });

  it('rejects fallback when several tags are visible but ambiguity is invalid', () => {
    const fallback: VisionCapture = {
      ...photonBase,
      solveType: 'single_tag',
      selectedTag: { id: 3, ambiguity: -1, cameraToTagMeters: 1.2 },
    };
    expect(rejectVisionCapture(fallback)).toBe('invalid_ambiguity');
  });

  it('rejects high single-tag ambiguity and far tags', () => {
    expect(
      rejectVisionCapture({
        ...photonBase,
        solveType: 'single_tag',
        selectedTag: { id: 1, ambiguity: 0.8, cameraToTagMeters: 1 },
      }),
    ).toBe('high_ambiguity');
    expect(
      rejectVisionCapture({
        ...photonBase,
        solveType: 'single_tag',
        selectedTag: { id: 1, ambiguity: 0.1, cameraToTagMeters: 4 },
      }),
    ).toBe('too_far');
  });

  it('rejects PhotonVision poses with unreasonable Z/tilt', () => {
    expect(rejectVisionCapture({ ...photonBase, z: 2.5 })).toBe('bad_3d_orientation');
    expect(rejectVisionCapture({ ...photonBase, pitchRad: 1.2 })).toBe('bad_3d_orientation');
  });

  it('rejects Limelight estimates with missing fiducial metadata', () => {
    const limelight: VisionCapture = {
      vendor: 'limelight',
      solveType: 'single_tag',
      x: 3,
      y: 3,
      yawRad: 0,
      timestampSeconds: 1,
      visibleTags: [],
      tagCount: 1,
      rawFiducials: undefined,
    };
    expect(rejectVisionCapture(limelight)).toBe('malformed_metadata');
    expect(
      rejectVisionCapture({
        ...limelight,
        rawFiducials: [{ id: 1, ambiguity: 0.2, cameraToTagMeters: 1.4 }],
      }),
    ).toBeNull();
  });

  it('selects the lowest valid ambiguity tag', () => {
    const tags = [
      { id: 1, ambiguity: 0.4, cameraToTagMeters: 1 },
      { id: 2, ambiguity: -1, cameraToTagMeters: 1 },
      { id: 3, ambiguity: 0.15, cameraToTagMeters: 2 },
    ];
    expect(lowestAmbiguityTag(tags)?.id).toBe(3);
  });
});
