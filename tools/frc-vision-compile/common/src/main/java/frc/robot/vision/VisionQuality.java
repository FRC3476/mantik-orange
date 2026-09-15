package frc.robot.vision;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Pose3d;
import java.util.Optional;

/**
 * Illustrative quality policy used by both vendor VisionSubsystem implementations.
 * Measure better thresholds on your robot.
 */
public final class VisionQuality {
  public static final double MAX_SINGLE_TAG_AMBIGUITY = 0.7;
  public static final double MAX_SINGLE_TAG_CAMERA_DISTANCE_M = 3.0;
  public static final double MAX_ABS_Z_M = 1.0;
  public static final double MAX_TILT_RAD = Math.toRadians(30.0);
  public static final double FIELD_LENGTH_M = 16.54175;
  public static final double FIELD_WIDTH_M = 8.211;
  public static final double FIELD_MARGIN_M = 0.5;

  private VisionQuality() {}

  public static boolean isFinite(double value) {
    return Double.isFinite(value);
  }

  public static Optional<String> rejectNonFinitePose(Pose2d pose, double timestampSeconds) {
    if (pose == null
        || !isFinite(pose.getX())
        || !isFinite(pose.getY())
        || !isFinite(pose.getRotation().getRadians())
        || !isFinite(timestampSeconds)) {
      return Optional.of("non_finite");
    }
    return Optional.empty();
  }

  public static Optional<String> rejectField(Pose2d pose) {
    double x = pose.getX();
    double y = pose.getY();
    if (x < -FIELD_MARGIN_M
        || x > FIELD_LENGTH_M + FIELD_MARGIN_M
        || y < -FIELD_MARGIN_M
        || y > FIELD_WIDTH_M + FIELD_MARGIN_M) {
      return Optional.of("out_of_field");
    }
    return Optional.empty();
  }

  public static Optional<String> rejectPhotonOrientation(Pose3d pose) {
    if (pose == null
        || !isFinite(pose.getZ())
        || !isFinite(pose.getRotation().getX())
        || !isFinite(pose.getRotation().getY())) {
      return Optional.of("malformed_metadata");
    }
    if (Math.abs(pose.getZ()) > MAX_ABS_Z_M) {
      return Optional.of("bad_3d_orientation");
    }
    if (Math.abs(pose.getRotation().getX()) > MAX_TILT_RAD
        || Math.abs(pose.getRotation().getY()) > MAX_TILT_RAD) {
      return Optional.of("bad_3d_orientation");
    }
    return Optional.empty();
  }

  public static Optional<String> rejectSingleTag(double ambiguity, double cameraToTagMeters) {
    if (!isFinite(ambiguity) || !isFinite(cameraToTagMeters)) {
      return Optional.of("malformed_metadata");
    }
    if (ambiguity < 0.0) {
      return Optional.of("invalid_ambiguity");
    }
    if (ambiguity > MAX_SINGLE_TAG_AMBIGUITY) {
      return Optional.of("high_ambiguity");
    }
    if (cameraToTagMeters > MAX_SINGLE_TAG_CAMERA_DISTANCE_M) {
      return Optional.of("too_far");
    }
    return Optional.empty();
  }
}
