package frc.robot.commands;

import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import frc.robot.subsystems.CommandSwerveDrivetrain;

/** Converts alliance-relative stick axes into blue-frame m/s. */
public final class DriverFieldSpeeds {
  public static final double kDefaultDeadband = 0.08;

  private DriverFieldSpeeds() {}

  public static Translation2d fromAllianceRelativeAxes(
      CommandSwerveDrivetrain drivetrain, double forwardAxis, double leftAxis, double maxMps) {
    return fromAllianceRelativeAxes(
        drivetrain.getOperatorForwardDirection(),
        forwardAxis,
        leftAxis,
        maxMps,
        kDefaultDeadband);
  }

  public static Translation2d fromAllianceRelativeAxes(
      Rotation2d operatorForward,
      double forwardAxis,
      double leftAxis,
      double maxMps,
      double deadband) {
    if (operatorForward == null
        || !Double.isFinite(forwardAxis)
        || !Double.isFinite(leftAxis)
        || !Double.isFinite(maxMps)
        || maxMps < 0.0
        || !Double.isFinite(deadband)
        || deadband < 0.0
        || deadband >= 1.0
        || !Double.isFinite(operatorForward.getRadians())) {
      return new Translation2d();
    }
    double x = MathUtil.applyDeadband(forwardAxis, deadband) * maxMps;
    double y = MathUtil.applyDeadband(leftAxis, deadband) * maxMps;
    double mag = Math.hypot(x, y);
    if (mag > maxMps && mag > 1e-9) {
      x *= maxMps / mag;
      y *= maxMps / mag;
    }
    return new Translation2d(x, y).rotateBy(operatorForward);
  }
}
