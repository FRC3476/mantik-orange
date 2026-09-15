package frc.robot.drive;

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.SwerveDriveKinematics;
import edu.wpi.first.math.kinematics.SwerveModulePosition;

/** Compile-only drivetrain adapter. Replace with your existing Drive hardware access. */
public final class ExampleDriveHardware implements DriveHardware {
  private static final double kTrackWidth = 0.5;
  private static final double kWheelBase = 0.5;

  private final SwerveDriveKinematics m_kinematics =
      new SwerveDriveKinematics(
          new Translation2d(kWheelBase / 2.0, kTrackWidth / 2.0),
          new Translation2d(kWheelBase / 2.0, -kTrackWidth / 2.0),
          new Translation2d(-kWheelBase / 2.0, kTrackWidth / 2.0),
          new Translation2d(-kWheelBase / 2.0, -kTrackWidth / 2.0));

  @Override
  public Rotation2d getGyroRotation() {
    return Rotation2d.kZero;
  }

  @Override
  public SwerveModulePosition[] getModulePositions() {
    return new SwerveModulePosition[] {
      new SwerveModulePosition(),
      new SwerveModulePosition(),
      new SwerveModulePosition(),
      new SwerveModulePosition()
    };
  }

  @Override
  public SwerveDriveKinematics getKinematics() {
    return m_kinematics;
  }
}
