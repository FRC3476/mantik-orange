package frc.robot.drive;

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.SwerveDriveKinematics;
import edu.wpi.first.math.kinematics.SwerveModulePosition;

/**
 * Existing drivetrain access used by the pose-estimation examples.
 * Module positions must be in the same order as the kinematics constructor: FL, FR, BL, BR.
 */
public interface DriveHardware {
  Rotation2d getGyroRotation();

  SwerveModulePosition[] getModulePositions();

  SwerveDriveKinematics getKinematics();
}
