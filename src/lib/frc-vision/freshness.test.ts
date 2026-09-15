import { describe, expect, it } from 'vitest';
import {
  acceptTimestamp,
  createFreshnessState,
  markDisconnect,
  markOdometryReady,
  markPoseReset,
  markReconnect,
  rejectFreshness,
} from './freshness';
import { emptyDiagnostics, pollLimelightEstimate, pollPhotonBatch, readDiagnostics } from './poll';
import type { VisionCapture } from './quality';

function photon(timestampSeconds: number, extra: Partial<VisionCapture> = {}): VisionCapture {
  return {
    vendor: 'photonvision',
    solveType: 'multi_tag',
    x: 4,
    y: 4,
    z: 0.2,
    rollRad: 0,
    pitchRad: 0,
    yawRad: 0,
    timestampSeconds,
    visibleTags: [
      { id: 1, ambiguity: 0.1, cameraToTagMeters: 1 },
      { id: 2, ambiguity: 0.1, cameraToTagMeters: 1.2 },
    ],
    usedTagIds: [1, 2],
    ...extra,
  };
}

describe('vision freshness and polling', () => {
  it('rejects vision before odometry history exists', () => {
    const state = createFreshnessState();
    expect(rejectFreshness(state, 1, 1)).toBe('outside_history');
  });

  it('empty photon unread batch does not insert a measurement', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 1);
    const diagnostics = emptyDiagnostics();
    const empty = pollPhotonBatch([], state, 1.1, diagnostics);
    expect(empty.accepted).toHaveLength(0);
    expect(diagnostics.currentValid).toBe(false);
    expect(diagnostics.acceptedCount).toBe(0);
  });

  it('fuses every accepted unread frame once, in timestamp order', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 10);
    const diagnostics = emptyDiagnostics();
    const result = pollPhotonBatch(
      [photon(10.04), photon(10.02), photon(10.03)],
      state,
      10.05,
      diagnostics,
    );
    expect(result.accepted.map((item) => item.capture.timestampSeconds)).toEqual([
      10.02, 10.03, 10.04,
    ]);
    expect(diagnostics.acceptedCount).toBe(3);
  });

  it('rejects duplicate, stale, future, and pre-reset timestamps', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 5);
    acceptTimestamp(state, 10);
    expect(rejectFreshness(state, 10, 10.1)).toBe('duplicate_timestamp');
    expect(rejectFreshness(state, 9.9, 10.1)).toBe('out_of_order');
    expect(rejectFreshness(state, 9.2, 10.1)).toBe('stale');
    expect(rejectFreshness(state, 10.5, 10.1)).toBe('future');
    markPoseReset(state, 10.2);
    expect(rejectFreshness(state, 10.15, 10.25)).toBe('pre_reset');
  });

  it('does not replay stale frames after reconnect', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 1);
    acceptTimestamp(state, 8);
    markDisconnect(state);
    markReconnect(state);
    const diagnostics = emptyDiagnostics();
    const stale = pollPhotonBatch([photon(8.01)], state, 10, diagnostics);
    expect(stale.accepted).toHaveLength(0);
    const fresh = pollPhotonBatch([photon(9.9)], state, 10, diagnostics);
    expect(fresh.accepted).toHaveLength(1);
  });

  it('diagnostic reads cannot consume a queued capture', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 1);
    const diagnostics = emptyDiagnostics();
    const queued = [photon(2)];
    const before = readDiagnostics(diagnostics, 2.1);
    expect(before.currentValid).toBe(false);
    expect(queued).toHaveLength(1);
    const polled = pollPhotonBatch(queued, state, 2.1, diagnostics);
    expect(polled.accepted).toHaveLength(1);
    const after = readDiagnostics(diagnostics, 2.2);
    expect(after.currentValid).toBe(true);
    const second = readDiagnostics(diagnostics, 2.2);
    expect(second.acceptedCount).toBe(1);
  });

  it('Limelight empty polls clear current-valid without inserting a measurement', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 1);
    const diagnostics = emptyDiagnostics();
    pollLimelightEstimate(photon(1.2, { vendor: 'limelight', tagCount: 2, rawFiducials: [
      { id: 1, ambiguity: 0.1, cameraToTagMeters: 1 },
      { id: 2, ambiguity: 0.1, cameraToTagMeters: 1.1 },
    ], solveType: 'multi_tag' }), state, 1.3, diagnostics);
    expect(diagnostics.acceptedCount).toBe(1);
    const empty = pollLimelightEstimate(null, state, 1.4, diagnostics);
    expect(empty.accepted).toHaveLength(0);
    expect(diagnostics.currentValid).toBe(false);
  });
});
