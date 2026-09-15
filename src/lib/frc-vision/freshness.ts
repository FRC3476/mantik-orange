export type FreshnessRejection =
  | 'duplicate_timestamp'
  | 'out_of_order'
  | 'stale'
  | 'future'
  | 'outside_history'
  | 'pre_reset';

export const VISION_FRESHNESS = {
  /** Allow small coprocessor/FPGA clock skew. */
  maxFutureSlackS: 0.02,
  /** Reject captures older than this even if the pose buffer still holds them. */
  maxAgeS: 0.5,
} as const;

export interface FreshnessState {
  lastAcceptedTimestamp: number;
  resetTimestamp: number;
  /** FPGA time when odometry first ran. Vision is rejected until this is set. */
  odometryReadyTimestamp: number | null;
  connected: boolean;
}

export function createFreshnessState(): FreshnessState {
  return {
    lastAcceptedTimestamp: Number.NEGATIVE_INFINITY,
    resetTimestamp: Number.NEGATIVE_INFINITY,
    odometryReadyTimestamp: null,
    connected: true,
  };
}

export function markOdometryReady(state: FreshnessState, nowSeconds: number): void {
  if (state.odometryReadyTimestamp == null) {
    state.odometryReadyTimestamp = nowSeconds;
  }
}

export function markPoseReset(state: FreshnessState, nowSeconds: number): void {
  state.resetTimestamp = nowSeconds;
  state.lastAcceptedTimestamp = Number.NEGATIVE_INFINITY;
}

export function markDisconnect(state: FreshnessState): void {
  state.connected = false;
}

export function markReconnect(state: FreshnessState): void {
  state.connected = true;
  state.lastAcceptedTimestamp = Number.NEGATIVE_INFINITY;
}

export function rejectFreshness(
  state: FreshnessState,
  timestampSeconds: number,
  nowSeconds: number,
): FreshnessRejection | null {
  if (!Number.isFinite(timestampSeconds) || !Number.isFinite(nowSeconds)) {
    return 'stale';
  }
  if (state.odometryReadyTimestamp == null) {
    return 'outside_history';
  }
  if (timestampSeconds < state.resetTimestamp) {
    return 'pre_reset';
  }
  if (timestampSeconds > nowSeconds + VISION_FRESHNESS.maxFutureSlackS) {
    return 'future';
  }
  const age = nowSeconds - timestampSeconds;
  if (age > VISION_FRESHNESS.maxAgeS) {
    return 'stale';
  }
  if (timestampSeconds <= state.lastAcceptedTimestamp) {
    return timestampSeconds === state.lastAcceptedTimestamp ? 'duplicate_timestamp' : 'out_of_order';
  }
  return null;
}

export function acceptTimestamp(state: FreshnessState, timestampSeconds: number): void {
  state.lastAcceptedTimestamp = timestampSeconds;
}
