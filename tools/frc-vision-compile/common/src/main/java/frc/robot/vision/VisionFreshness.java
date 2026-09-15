package frc.robot.vision;

import java.util.Optional;

/** Timestamp / pose-buffer checks applied by Drive after VisionSubsystem quality checks. */
public final class VisionFreshness {
  public static final double MAX_FUTURE_SLACK_S = 0.02;
  public static final double MAX_AGE_S = 0.5;
  public static final double POSE_HISTORY_S = 1.5;

  private double lastAcceptedTimestamp = Double.NEGATIVE_INFINITY;
  private double resetTimestamp = Double.NEGATIVE_INFINITY;
  private Double odometryReadyTimestamp = null;
  private boolean connected = true;

  public void markOdometryReady(double nowSeconds) {
    if (odometryReadyTimestamp == null) {
      odometryReadyTimestamp = nowSeconds;
    }
  }

  public void markPoseReset(double nowSeconds) {
    resetTimestamp = nowSeconds;
    lastAcceptedTimestamp = Double.NEGATIVE_INFINITY;
  }

  public void markDisconnect() {
    connected = false;
  }

  public void markReconnect() {
    connected = true;
    lastAcceptedTimestamp = Double.NEGATIVE_INFINITY;
  }

  public boolean isConnected() {
    return connected;
  }

  public Optional<String> reject(double timestampSeconds, double nowSeconds) {
    if (!Double.isFinite(timestampSeconds) || !Double.isFinite(nowSeconds)) {
      return Optional.of("stale");
    }
    if (odometryReadyTimestamp == null) {
      return Optional.of("outside_history");
    }
    if (timestampSeconds < resetTimestamp) {
      return Optional.of("pre_reset");
    }
    if (timestampSeconds > nowSeconds + MAX_FUTURE_SLACK_S) {
      return Optional.of("future");
    }
    double age = nowSeconds - timestampSeconds;
    if (age > MAX_AGE_S) {
      return Optional.of("stale");
    }
    if (age > POSE_HISTORY_S) {
      return Optional.of("outside_history");
    }
    if (timestampSeconds < lastAcceptedTimestamp) {
      return Optional.of("out_of_order");
    }
    if (timestampSeconds == lastAcceptedTimestamp) {
      return Optional.of("duplicate_timestamp");
    }
    return Optional.empty();
  }

  public void accept(double timestampSeconds) {
    lastAcceptedTimestamp = timestampSeconds;
  }
}
