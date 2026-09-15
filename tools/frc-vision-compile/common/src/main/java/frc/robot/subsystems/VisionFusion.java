package frc.robot.subsystems;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.vision.VisionDiagnostics;
import frc.robot.vision.VisionEstimate;
import frc.robot.vision.VisionFreshness;
import frc.robot.vision.VisionSubsystem;
import java.util.List;

/**
 * Sole camera poller and fusion insertion point. Phoenix updates odometry on its own thread.
 * Pass raw FPGA capture timestamps into CommandSwerveDrivetrain.addVisionMeasurement — the
 * generated override converts them once.
 */
public class VisionFusion extends SubsystemBase {
  private final CommandSwerveDrivetrain m_drivetrain;
  private final VisionSubsystem m_vision;
  private final VisionFreshness m_freshness = new VisionFreshness();

  public VisionFusion(CommandSwerveDrivetrain drivetrain, VisionSubsystem vision) {
    m_drivetrain = drivetrain;
    m_vision = vision;
  }

  @Override
  public void periodic() {
    double now = Timer.getFPGATimestamp();
    if (m_drivetrain.isOdometryValid()) {
      m_freshness.markOdometryReady(now);
    }
    updateVision(now);
    publishDiagnostics(now);
  }

  public void updateVision(double now) {
    if (!m_vision.isCameraConnected()) {
      m_freshness.markDisconnect();
      m_vision.markDisconnected(now);
      return;
    }
    if (!m_freshness.isConnected()) {
      m_freshness.markReconnect();
    }

    List<VisionEstimate> estimates = m_vision.pollEstimates();
    for (VisionEstimate estimate : estimates) {
      var freshnessReject = m_freshness.reject(estimate.timestampSeconds, now);
      if (freshnessReject.isPresent()) {
        m_vision.recordFusionReject(freshnessReject.get(), now);
        continue;
      }
      m_freshness.accept(estimate.timestampSeconds);
      m_drivetrain.addVisionMeasurement(
          estimate.pose, estimate.timestampSeconds, estimate.stdDevs);
      m_vision.recordFusionAccept(estimate, now);
    }
  }

  /**
   * Application trust for aim/shot. Odometry must be valid and the camera connected.
   * Last-accepted vision age is a separate diagnostic — do not treat a non-null Pose as trust.
   */
  public boolean isPoseTrusted() {
    return m_drivetrain.isOdometryValid() && m_freshness.isConnected();
  }

  public Double getVisionAgeSeconds() {
    return m_vision.getDiagnostics(Timer.getFPGATimestamp()).ageSeconds;
  }

  public void resetPose(Pose2d newPose) {
    invalidateAcceptedHistory();
    m_drivetrain.resetPose(newPose);
  }

  public void resetRotation(Rotation2d rotation) {
    invalidateAcceptedHistory();
    m_drivetrain.resetRotation(rotation);
  }

  public void seedFieldCentric() {
    invalidateAcceptedHistory();
    m_drivetrain.seedFieldCentric();
  }

  private void invalidateAcceptedHistory() {
    double now = Timer.getFPGATimestamp();
    m_freshness.markPoseReset(now);
    m_vision.notifyPoseReset(now);
  }

  private void publishDiagnostics(double now) {
    VisionDiagnostics diagnostics = m_vision.getDiagnostics(now);
    SmartDashboard.putBoolean("Vision/Connected", diagnostics.connected);
    SmartDashboard.putBoolean("Vision/CurrentValid", diagnostics.currentValid);
    SmartDashboard.putBoolean("Vision/OdometryValid", m_drivetrain.isOdometryValid());
    SmartDashboard.putBoolean("Vision/PoseTrusted", isPoseTrusted());
    SmartDashboard.putString("Vision/Solve", diagnostics.solveLabel);
    SmartDashboard.putNumber("Vision/TagsUsed", diagnostics.tagsUsed);
    SmartDashboard.putString("Vision/Reject", diagnostics.lastRejectReason);
    SmartDashboard.putNumber("Vision/Accepted", diagnostics.acceptedCount);
    SmartDashboard.putNumber("Vision/Rejected", diagnostics.rejectedCount);
    if (diagnostics.ageSeconds != null) {
      SmartDashboard.putNumber("Vision/AgeSeconds", diagnostics.ageSeconds);
    }
  }
}
