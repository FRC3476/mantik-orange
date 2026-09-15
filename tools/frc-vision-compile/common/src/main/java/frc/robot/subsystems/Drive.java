package frc.robot.subsystems;

import edu.wpi.first.math.estimator.SwerveDrivePoseEstimator;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.kinematics.SwerveModulePosition;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.drive.DriveHardware;
import frc.robot.vision.VisionDiagnostics;
import frc.robot.vision.VisionEstimate;
import frc.robot.vision.VisionFreshness;
import frc.robot.vision.VisionSubsystem;
import java.util.List;

/**
 * Existing Drive subsystem extended with vision fusion.
 * This class owns kinematics, odometry, and the pose estimator. Do not construct a second gyro
 * or a second estimator for vision.
 */
public class Drive extends SubsystemBase {
  private final DriveHardware m_hardware;
  private final VisionSubsystem m_vision;
  private final SwerveDrivePoseEstimator m_poseEstimator;
  private final VisionFreshness m_freshness = new VisionFreshness();

  public Drive(DriveHardware hardware, VisionSubsystem vision) {
    m_hardware = hardware;
    m_vision = vision;
    SwerveModulePosition[] modulePositions = m_hardware.getModulePositions();
    m_poseEstimator =
        new SwerveDrivePoseEstimator(
            m_hardware.getKinematics(),
            m_hardware.getGyroRotation(),
            modulePositions,
            new Pose2d());
  }

  @Override
  public void periodic() {
    updateOdometry();
    updateVision();
    Pose2d pose = getPose();
    SmartDashboard.putNumber("Fused X", pose.getX());
    SmartDashboard.putNumber("Fused Y", pose.getY());
    SmartDashboard.putNumber("Fused Heading", pose.getRotation().getDegrees());
    publishDiagnostics();
  }

  public void updateOdometry() {
    double now = Timer.getFPGATimestamp();
    m_freshness.markOdometryReady(now);
    m_poseEstimator.update(m_hardware.getGyroRotation(), m_hardware.getModulePositions());
  }

  public void updateVision() {
    double now = Timer.getFPGATimestamp();
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
      m_poseEstimator.addVisionMeasurement(
          estimate.pose, estimate.timestampSeconds, estimate.stdDevs);
      m_vision.recordFusionAccept(estimate, now);
    }
  }

  public Pose2d getPose() {
    return m_poseEstimator.getEstimatedPosition();
  }

  public void resetPose(Pose2d newPose) {
    double now = Timer.getFPGATimestamp();
    m_freshness.markPoseReset(now);
    m_vision.notifyPoseReset(now);
    m_poseEstimator.resetPosition(
        m_hardware.getGyroRotation(), m_hardware.getModulePositions(), newPose);
  }

  private void publishDiagnostics() {
    VisionDiagnostics diagnostics = m_vision.getDiagnostics(Timer.getFPGATimestamp());
    SmartDashboard.putBoolean("Vision Connected", diagnostics.connected);
    SmartDashboard.putBoolean("Vision Current Valid", diagnostics.currentValid);
    SmartDashboard.putString("Vision Solve", diagnostics.solveLabel);
    SmartDashboard.putNumber("Vision Tags Used", diagnostics.tagsUsed);
    SmartDashboard.putString("Vision Reject", diagnostics.lastRejectReason);
    SmartDashboard.putNumber("Vision Accepted", diagnostics.acceptedCount);
    SmartDashboard.putNumber("Vision Rejected", diagnostics.rejectedCount);
    if (diagnostics.ageSeconds != null) {
      SmartDashboard.putNumber("Vision Age (s)", diagnostics.ageSeconds);
    }
  }
}
