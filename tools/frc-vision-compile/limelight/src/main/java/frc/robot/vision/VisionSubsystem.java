package frc.robot.vision;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.wpilibj.Timer;
import frc.robot.LimelightHelpers;
import frc.robot.LimelightHelpers.PoseEstimate;
import frc.robot.LimelightHelpers.RawFiducial;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Limelight camera reader. Call pollEstimates() once from VisionFusion.periodic().
 * Do not schedule this class as a SubsystemBase — CommandScheduler would otherwise
 * compete with VisionFusion for camera reads.
 *
 * LimelightHelpers v1.14 requires Limelight OS 2026.0 or later. Place the helper at
 * src/main/java/frc/robot/LimelightHelpers.java.
 */
public class VisionSubsystem {
  public static final String kCameraName = "limelight";

  private final String m_cameraName;
  private final VisionDiagnostics m_diagnostics = new VisionDiagnostics();
  private Double m_lastSeenTimestamp = null;
  private double m_resetTimestamp = Double.NEGATIVE_INFINITY;

  public VisionSubsystem() {
    this(kCameraName);
  }

  public VisionSubsystem(String cameraName) {
    m_cameraName = cameraName;
  }

  public boolean isCameraConnected() {
    return true;
  }

  public List<VisionEstimate> pollEstimates() {
    List<VisionEstimate> accepted = new ArrayList<>();
    PoseEstimate estimate = LimelightHelpers.getBotPoseEstimate_wpiBlue(m_cameraName);
    if (estimate == null) {
      m_diagnostics.currentValid = false;
      return accepted;
    }

    Optional<VisionEstimate> converted = fromLimelight(estimate);
    converted.ifPresent(accepted::add);
    if (accepted.isEmpty() && m_diagnostics.lastRejectReason.isEmpty()) {
      m_diagnostics.currentValid = false;
    }
    return accepted;
  }

  private Optional<VisionEstimate> fromLimelight(PoseEstimate estimate) {
    Pose2d pose = estimate.pose;
    Optional<String> reject = VisionQuality.rejectNonFinitePose(pose, estimate.timestampSeconds);
    if (reject.isPresent()) {
      reject(reject.get());
      return Optional.empty();
    }
    reject = VisionQuality.rejectField(pose);
    if (reject.isPresent()) {
      reject(reject.get());
      return Optional.empty();
    }

    if (estimate.tagCount <= 0) {
      reject("no_tags");
      return Optional.empty();
    }
    RawFiducial[] fiducials = estimate.rawFiducials;
    if (fiducials == null || fiducials.length != estimate.tagCount) {
      reject("malformed_metadata");
      return Optional.empty();
    }

    boolean multiTag = estimate.tagCount >= 2;
    if (!multiTag) {
      RawFiducial tag = fiducials[0];
      Optional<String> singleReject =
          VisionQuality.rejectSingleTag(tag.ambiguity, tag.distToCamera);
      if (singleReject.isPresent()) {
        reject(singleReject.get());
        return Optional.empty();
      }
    }

    cacheSolve(multiTag, estimate.tagCount);
    return Optional.of(
        new VisionEstimate(
            pose,
            estimate.timestampSeconds,
            multiTag ? VisionEstimate.multiTagStdDevs() : VisionEstimate.singleTagStdDevs(),
            multiTag,
            estimate.tagCount,
            multiTag ? "multi_tag" : "single_tag"));
  }

  public VisionDiagnostics getDiagnostics(double nowSeconds) {
    if (m_diagnostics.lastTimestampSeconds != null) {
      m_diagnostics.ageSeconds = nowSeconds - m_diagnostics.lastTimestampSeconds;
      if (m_diagnostics.ageSeconds > VisionFreshness.MAX_AGE_S) {
        m_diagnostics.currentValid = false;
      }
    }
    return m_diagnostics;
  }

  public void notifyPoseReset(double nowSeconds) {
    m_resetTimestamp = nowSeconds;
  }

  public void markDisconnected(double nowSeconds) {
    m_diagnostics.connected = false;
    m_diagnostics.currentValid = false;
    m_diagnostics.lastRejectReason = "disconnected";
    m_diagnostics.ageSeconds =
        m_diagnostics.lastTimestampSeconds == null
            ? null
            : nowSeconds - m_diagnostics.lastTimestampSeconds;
  }

  public void recordFusionReject(String reason, double nowSeconds) {
    reject(reason);
    m_diagnostics.ageSeconds =
        m_diagnostics.lastTimestampSeconds == null
            ? null
            : nowSeconds - m_diagnostics.lastTimestampSeconds;
  }

  public void recordFusionAccept(VisionEstimate estimate, double nowSeconds) {
    m_diagnostics.acceptedCount += 1;
    m_diagnostics.currentValid = true;
    m_diagnostics.lastTimestampSeconds = estimate.timestampSeconds;
    m_diagnostics.ageSeconds = nowSeconds - estimate.timestampSeconds;
    m_diagnostics.lastRejectReason = "";
    m_diagnostics.solveLabel = estimate.solveLabel;
    m_diagnostics.tagsUsed = estimate.tagsUsed;
    m_diagnostics.connected = true;
    m_lastSeenTimestamp = estimate.timestampSeconds;
  }

  private void cacheSolve(boolean multiTag, int tagsUsed) {
    m_diagnostics.solveLabel = multiTag ? "multi_tag" : "single_tag";
    m_diagnostics.tagsUsed = tagsUsed;
  }

  private void reject(String reason) {
    m_diagnostics.rejectedCount += 1;
    m_diagnostics.currentValid = false;
    m_diagnostics.lastRejectReason = reason;
  }

  public double getResetTimestamp() {
    return m_resetTimestamp;
  }

  public Double getLastSeenTimestamp() {
    return m_lastSeenTimestamp;
  }

  public static void applyMeasuredCameraPoseIfUsingCodeAsSourceOfTruth() {
    // Same numbers as the Limelight UI mount, in meters and degrees.
    // If the UI already holds the measured mount, do not also call this with placeholders.
    LimelightHelpers.setCameraPose_RobotSpace(kCameraName, 0.32, 0.0, 0.27, 0.0, -15.0, 0.0);
  }

  public static double now() {
    return Timer.getFPGATimestamp();
  }
}
