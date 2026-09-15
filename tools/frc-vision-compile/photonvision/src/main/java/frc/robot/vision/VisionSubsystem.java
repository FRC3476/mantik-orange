package frc.robot.vision;

import edu.wpi.first.apriltag.AprilTagFieldLayout;
import edu.wpi.first.apriltag.AprilTagFields;
import edu.wpi.first.math.geometry.Pose3d;
import edu.wpi.first.math.geometry.Rotation3d;
import edu.wpi.first.math.geometry.Transform3d;
import edu.wpi.first.math.geometry.Translation3d;
import edu.wpi.first.math.util.Units;
import edu.wpi.first.wpilibj.Timer;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.photonvision.EstimatedRobotPose;
import org.photonvision.PhotonCamera;
import org.photonvision.PhotonPoseEstimator;
import org.photonvision.PhotonPoseEstimator.PoseStrategy;
import org.photonvision.targeting.PhotonPipelineResult;
import org.photonvision.targeting.PhotonTrackedTarget;

/**
 * PhotonVision camera reader. Call pollEstimates() once from VisionFusion.periodic().
 * Do not schedule this class as a SubsystemBase — CommandScheduler would otherwise
 * compete with VisionFusion for camera reads.
 */
public class VisionSubsystem {
  public static final String kCameraName = "AprilTagCam";
  public static final Transform3d kRobotToCamera =
      new Transform3d(
          new Translation3d(0.32, 0.0, 0.27),
          new Rotation3d(0.0, Units.degreesToRadians(-15.0), 0.0));

  private final PhotonCamera m_camera;
  private final PhotonPoseEstimator m_estimator;
  private final VisionDiagnostics m_diagnostics = new VisionDiagnostics();
  private double m_resetTimestamp = Double.NEGATIVE_INFINITY;

  public VisionSubsystem() {
    this(
        new PhotonCamera(kCameraName),
        AprilTagFieldLayout.loadField(AprilTagFields.k2026RebuiltWelded),
        kRobotToCamera);
  }

  public VisionSubsystem(
      PhotonCamera camera, AprilTagFieldLayout tagLayout, Transform3d robotToCamera) {
    m_camera = camera;
    m_estimator = new PhotonPoseEstimator(tagLayout, robotToCamera);
  }

  public boolean isCameraConnected() {
    return m_camera.isConnected();
  }

  public List<VisionEstimate> pollEstimates() {
    List<VisionEstimate> accepted = new ArrayList<>();
    if (!m_camera.isConnected()) {
      markDisconnected(Timer.getFPGATimestamp());
      return accepted;
    }

    List<PhotonPipelineResult> results = m_camera.getAllUnreadResults();
    results.sort((a, b) -> Double.compare(a.getTimestampSeconds(), b.getTimestampSeconds()));

    for (PhotonPipelineResult result : results) {
      Optional<VisionEstimate> estimate = estimateFromResult(result);
      if (estimate.isEmpty()) {
        continue;
      }
      accepted.add(estimate.get());
    }

    if (results.isEmpty()) {
      m_diagnostics.currentValid = false;
    }
    return accepted;
  }

  private Optional<VisionEstimate> estimateFromResult(PhotonPipelineResult result) {
    Optional<EstimatedRobotPose> multi = m_estimator.estimateCoprocMultiTagPose(result);
    Optional<EstimatedRobotPose> solved = multi;
    boolean multiTag = multi.isPresent();
    if (solved.isEmpty()) {
      solved = m_estimator.estimateLowestAmbiguityPose(result);
      multiTag = false;
    }
    if (solved.isEmpty()) {
      reject("no_tags");
      return Optional.empty();
    }

    EstimatedRobotPose estimate = solved.get();
    Optional<String> reject = VisionQuality.rejectNonFinitePose(
        estimate.estimatedPose.toPose2d(), estimate.timestampSeconds);
    if (reject.isEmpty()) {
      reject = VisionQuality.rejectPhotonOrientation(estimate.estimatedPose);
    }
    if (reject.isEmpty()) {
      reject = VisionQuality.rejectField(estimate.estimatedPose.toPose2d());
    }
    if (reject.isPresent()) {
      reject(reject.get());
      return Optional.empty();
    }

    int tagsUsed;
    PhotonTrackedTarget selected = null;
    if (multiTag
        && estimate.strategy == PoseStrategy.MULTI_TAG_PNP_ON_COPROCESSOR
        && result.getMultiTagResult().isPresent()) {
      tagsUsed = result.getMultiTagResult().get().fiducialIDsUsed.size();
      if (tagsUsed < 2) {
        reject("malformed_metadata");
        return Optional.empty();
      }
    } else {
      selected = lowestAmbiguityTarget(result.getTargets());
      if (selected == null) {
        reject("malformed_metadata");
        return Optional.empty();
      }
      double distance = selected.getBestCameraToTarget().getTranslation().getNorm();
      Optional<String> singleReject =
          VisionQuality.rejectSingleTag(selected.getPoseAmbiguity(), distance);
      if (singleReject.isPresent()) {
        reject(singleReject.get());
        return Optional.empty();
      }
      tagsUsed = 1;
      multiTag = false;
    }

    cacheSolve(multiTag, tagsUsed);
    return Optional.of(
        new VisionEstimate(
            estimate.estimatedPose.toPose2d(),
            estimate.timestampSeconds,
            multiTag ? VisionEstimate.multiTagStdDevs() : VisionEstimate.singleTagStdDevs(),
            multiTag,
            tagsUsed,
            multiTag ? "multi_tag" : "single_tag"));
  }

  private static PhotonTrackedTarget lowestAmbiguityTarget(List<PhotonTrackedTarget> targets) {
    PhotonTrackedTarget best = null;
    double bestAmbiguity = Double.POSITIVE_INFINITY;
    for (PhotonTrackedTarget target : targets) {
      if (target.getFiducialId() < 0) {
        continue;
      }
      double ambiguity = target.getPoseAmbiguity();
      if (ambiguity < 0) {
        continue;
      }
      if (ambiguity < bestAmbiguity) {
        bestAmbiguity = ambiguity;
        best = target;
      }
    }
    return best;
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

  public Pose3d robotToCameraExample() {
    return new Pose3d().plus(kRobotToCamera);
  }
}
