import {
  acceptTimestamp,
  type FreshnessState,
  rejectFreshness,
} from './freshness';
import {
  rejectVisionCapture,
  stdDevsForCapture,
  type VisionCapture,
  type VisionRejectionReason,
  type VisionStdDevs,
} from './quality';
import type { FreshnessRejection } from './freshness';

export interface AcceptedVisionMeasurement {
  capture: VisionCapture;
  stdDevs: VisionStdDevs;
}

export type PollRejection = VisionRejectionReason | FreshnessRejection;

export interface PollResult {
  accepted: AcceptedVisionMeasurement[];
  rejected: { capture: VisionCapture; reason: PollRejection }[];
}

export interface VisionDiagnostics {
  connected: boolean;
  lastTimestampSeconds: number | null;
  ageSeconds: number | null;
  currentValid: boolean;
  solveType: VisionCapture['solveType'] | null;
  tagsUsed: number;
  lastRejectReason: PollRejection | null;
  acceptedCount: number;
  rejectedCount: number;
}

export function emptyDiagnostics(connected = true): VisionDiagnostics {
  return {
    connected,
    lastTimestampSeconds: null,
    ageSeconds: null,
    currentValid: false,
    solveType: null,
    tagsUsed: 0,
    lastRejectReason: null,
    acceptedCount: 0,
    rejectedCount: 0,
  };
}

/**
 * Consume a PhotonVision unread batch exactly once, in timestamp order.
 * Diagnostics must be updated from this pass — never by reading the camera again.
 */
export function pollPhotonBatch(
  captures: VisionCapture[],
  freshness: FreshnessState,
  nowSeconds: number,
  diagnostics: VisionDiagnostics,
): PollResult {
  const ordered = [...captures].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  return pollCaptures(ordered, freshness, nowSeconds, diagnostics);
}

/** Limelight reports at most one fresh PoseEstimate per poll. */
export function pollLimelightEstimate(
  capture: VisionCapture | null,
  freshness: FreshnessState,
  nowSeconds: number,
  diagnostics: VisionDiagnostics,
): PollResult {
  if (!capture) {
    diagnostics.currentValid = false;
    diagnostics.ageSeconds =
      diagnostics.lastTimestampSeconds == null
        ? null
        : nowSeconds - diagnostics.lastTimestampSeconds;
    return { accepted: [], rejected: [] };
  }
  return pollCaptures([capture], freshness, nowSeconds, diagnostics);
}

function pollCaptures(
  captures: VisionCapture[],
  freshness: FreshnessState,
  nowSeconds: number,
  diagnostics: VisionDiagnostics,
): PollResult {
  const accepted: AcceptedVisionMeasurement[] = [];
  const rejected: PollResult['rejected'] = [];

  if (!freshness.connected) {
    diagnostics.connected = false;
    diagnostics.currentValid = false;
    diagnostics.lastRejectReason = null;
    return { accepted, rejected };
  }

  diagnostics.connected = true;

  for (const capture of captures) {
    const qualityReason = rejectVisionCapture(capture);
    if (qualityReason) {
      rejected.push({ capture, reason: qualityReason });
      diagnostics.rejectedCount += 1;
      diagnostics.lastRejectReason = qualityReason;
      diagnostics.currentValid = false;
      continue;
    }

    const freshnessReason = rejectFreshness(freshness, capture.timestampSeconds, nowSeconds);
    if (freshnessReason) {
      rejected.push({ capture, reason: freshnessReason });
      diagnostics.rejectedCount += 1;
      diagnostics.lastRejectReason = freshnessReason;
      diagnostics.currentValid = false;
      continue;
    }

    acceptTimestamp(freshness, capture.timestampSeconds);
    accepted.push({ capture, stdDevs: stdDevsForCapture(capture) });
    diagnostics.acceptedCount += 1;
    diagnostics.lastTimestampSeconds = capture.timestampSeconds;
    diagnostics.ageSeconds = nowSeconds - capture.timestampSeconds;
    diagnostics.currentValid = true;
    diagnostics.solveType = capture.solveType;
    diagnostics.tagsUsed =
      capture.solveType === 'multi_tag'
        ? (capture.usedTagIds?.length ?? 0)
        : 1;
    diagnostics.lastRejectReason = null;
  }

  if (captures.length === 0) {
    diagnostics.currentValid = false;
    diagnostics.ageSeconds =
      diagnostics.lastTimestampSeconds == null
        ? null
        : nowSeconds - diagnostics.lastTimestampSeconds;
  }

  return { accepted, rejected };
}

/** Diagnostic getters never drain a camera queue; they only read this cache. */
export function readDiagnostics(
  diagnostics: VisionDiagnostics,
  nowSeconds: number,
): VisionDiagnostics {
  return {
    ...diagnostics,
    ageSeconds:
      diagnostics.lastTimestampSeconds == null
        ? null
        : nowSeconds - diagnostics.lastTimestampSeconds,
    currentValid:
      diagnostics.currentValid &&
      diagnostics.lastTimestampSeconds != null &&
      nowSeconds - diagnostics.lastTimestampSeconds <= 0.5,
  };
}
