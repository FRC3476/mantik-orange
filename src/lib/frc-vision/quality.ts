export type VisionSolveType = 'multi_tag' | 'single_tag';
export type VisionVendor = 'photonvision' | 'limelight';

export type VisionRejectionReason =
  | 'non_finite'
  | 'no_tags'
  | 'malformed_metadata'
  | 'invalid_ambiguity'
  | 'high_ambiguity'
  | 'too_far'
  | 'out_of_field'
  | 'bad_3d_orientation';

export interface VisionTagObservation {
  id: number;
  /** Pose ambiguity in [0, 1]. Use -1 when the solver did not report a value. */
  ambiguity: number;
  /** Camera-to-tag distance in meters. */
  cameraToTagMeters: number;
}

export interface VisionCapture {
  vendor: VisionVendor;
  solveType: VisionSolveType;
  x: number;
  y: number;
  yawRad: number;
  timestampSeconds: number;
  /** PhotonVision Pose3d only. Limelight PoseEstimate.pose is 2D. */
  z?: number;
  rollRad?: number;
  pitchRad?: number;
  visibleTags: VisionTagObservation[];
  /** MultiTag fiducial IDs actually used in the solve, if the vendor reports them. */
  usedTagIds?: number[];
  /** Lowest-ambiguity fiducial for a single-tag solve. */
  selectedTag?: VisionTagObservation;
  /** Limelight PoseEstimate.tagCount. */
  tagCount?: number;
  rawFiducials?: VisionTagObservation[];
}

export interface VisionStdDevs {
  xMeters: number;
  yMeters: number;
  headingRad: number;
}

/** Illustrative thresholds — measure better values on your robot. */
export const VISION_QUALITY = {
  maxSingleTagAmbiguity: 0.7,
  maxSingleTagCameraDistanceM: 3.0,
  maxAbsZMeters: 1.0,
  maxTiltRad: (30 * Math.PI) / 180,
  fieldLengthM: 16.54175,
  fieldWidthM: 8.211,
  fieldMarginM: 0.5,
  multiTagStdDevs: { xMeters: 0.3, yMeters: 0.3, headingRad: 0.9 } satisfies VisionStdDevs,
  singleTagStdDevs: { xMeters: 0.5, yMeters: 0.5, headingRad: 2.0 } satisfies VisionStdDevs,
} as const;

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inField(x: number, y: number): boolean {
  const m = VISION_QUALITY.fieldMarginM;
  return (
    x >= -m &&
    x <= VISION_QUALITY.fieldLengthM + m &&
    y >= -m &&
    y <= VISION_QUALITY.fieldWidthM + m
  );
}

function checkSingleTag(tag: VisionTagObservation | undefined): VisionRejectionReason | null {
  if (!tag) return 'malformed_metadata';
  if (!isFiniteNumber(tag.ambiguity) || !isFiniteNumber(tag.cameraToTagMeters)) {
    return 'malformed_metadata';
  }
  if (tag.ambiguity < 0) return 'invalid_ambiguity';
  if (tag.ambiguity > VISION_QUALITY.maxSingleTagAmbiguity) return 'high_ambiguity';
  if (tag.cameraToTagMeters > VISION_QUALITY.maxSingleTagCameraDistanceM) return 'too_far';
  return null;
}

function checkPhotonOrientation(capture: VisionCapture): VisionRejectionReason | null {
  if (
    !isFiniteNumber(capture.z) ||
    !isFiniteNumber(capture.rollRad) ||
    !isFiniteNumber(capture.pitchRad)
  ) {
    return 'malformed_metadata';
  }
  if (Math.abs(capture.z) > VISION_QUALITY.maxAbsZMeters) return 'bad_3d_orientation';
  if (
    Math.abs(capture.rollRad) > VISION_QUALITY.maxTiltRad ||
    Math.abs(capture.pitchRad) > VISION_QUALITY.maxTiltRad
  ) {
    return 'bad_3d_orientation';
  }
  return null;
}

export function rejectVisionCapture(capture: VisionCapture): VisionRejectionReason | null {
  if (
    !isFiniteNumber(capture.x) ||
    !isFiniteNumber(capture.y) ||
    !isFiniteNumber(capture.yawRad) ||
    !isFiniteNumber(capture.timestampSeconds)
  ) {
    return 'non_finite';
  }

  if (!inField(capture.x, capture.y)) return 'out_of_field';

  if (capture.vendor === 'photonvision') {
    const orientation = checkPhotonOrientation(capture);
    if (orientation) return orientation;

    if (capture.solveType === 'multi_tag') {
      const used = capture.usedTagIds ?? [];
      if (used.length < 2) return 'malformed_metadata';
      return null;
    }

    return checkSingleTag(capture.selectedTag);
  }

  const tagCount = capture.tagCount;
  const fiducials = capture.rawFiducials;
  if (!isFiniteNumber(tagCount) || tagCount <= 0) return 'no_tags';
  if (!fiducials || fiducials.length !== tagCount) return 'malformed_metadata';

  if (tagCount === 1) {
    return checkSingleTag(fiducials[0]);
  }

  return null;
}

export function stdDevsForCapture(capture: VisionCapture): VisionStdDevs {
  return capture.solveType === 'multi_tag'
    ? VISION_QUALITY.multiTagStdDevs
    : VISION_QUALITY.singleTagStdDevs;
}

export function lowestAmbiguityTag(
  tags: VisionTagObservation[],
): VisionTagObservation | undefined {
  let best: VisionTagObservation | undefined;
  for (const tag of tags) {
    if (tag.id < 0) continue;
    if (tag.ambiguity < 0) continue;
    if (!best || tag.ambiguity < best.ambiguity) best = tag;
  }
  return best;
}
