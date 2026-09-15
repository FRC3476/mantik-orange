package frc.robot;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.swerve.SwerveDrivetrain.SwerveDriveState;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.kinematics.SwerveModulePosition;
import edu.wpi.first.math.kinematics.SwerveModuleState;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StructArrayPublisher;
import edu.wpi.first.networktables.StructPublisher;

/**
 * Odometry-thread telemetry. Keep this callback short: no camera polling and no command
 * scheduling. Keys match Phoenix SignalLogger / NT DriveState.
 */
public class Telemetry {
  private final NetworkTable m_driveState =
      NetworkTableInstance.getDefault().getTable("DriveState");
  private final StructPublisher<Pose2d> m_pose =
      m_driveState.getStructTopic("Pose", Pose2d.struct).publish();
  private final StructPublisher<ChassisSpeeds> m_speeds =
      m_driveState.getStructTopic("Speeds", ChassisSpeeds.struct).publish();
  private final StructArrayPublisher<SwerveModuleState> m_moduleStates =
      m_driveState.getStructArrayTopic("ModuleStates", SwerveModuleState.struct).publish();
  private final StructArrayPublisher<SwerveModuleState> m_moduleTargets =
      m_driveState.getStructArrayTopic("ModuleTargets", SwerveModuleState.struct).publish();
  private final StructArrayPublisher<SwerveModulePosition> m_modulePositions =
      m_driveState.getStructArrayTopic("ModulePositions", SwerveModulePosition.struct).publish();

  public Telemetry() {
    SignalLogger.start();
  }

  public void telemeterize(SwerveDriveState state) {
    m_pose.set(state.Pose);
    m_speeds.set(state.Speeds);
    m_moduleStates.set(state.ModuleStates);
    m_moduleTargets.set(state.ModuleTargets);
    m_modulePositions.set(state.ModulePositions);

    SignalLogger.writeStruct("DriveState/Pose", Pose2d.struct, state.Pose);
    SignalLogger.writeStruct("DriveState/Speeds", ChassisSpeeds.struct, state.Speeds);
    SignalLogger.writeStructArray(
        "DriveState/ModuleStates", SwerveModuleState.struct, state.ModuleStates);
    SignalLogger.writeStructArray(
        "DriveState/ModuleTargets", SwerveModuleState.struct, state.ModuleTargets);
    SignalLogger.writeStructArray(
        "DriveState/ModulePositions", SwerveModulePosition.struct, state.ModulePositions);
    SignalLogger.writeDouble("DriveState/OdometryPeriod", state.OdometryPeriod, "seconds");
    SignalLogger.writeInteger("DriveState/FailedDaqs", state.FailedDaqs);
  }
}
