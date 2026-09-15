package frc.robot.commands;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.ctre.phoenix6.swerve.SwerveRequest.ForwardPerspectiveValue;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.constants.FieldConstants;
import frc.robot.subsystems.CommandSwerveDrivetrain;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Points drivetrain +X at the alliance goal using fused getState().Pose. Heading PID lives in
 * FieldCentricFacingAngle and runs with the request on the odometry thread.
 */
public class AimAtGoalCommand extends Command {
  public static final double kHeadingP = 3.0;
  public static final double kMaxOmegaRadPerSec = 4.0;
  public static final double kAlignedTolRad = Math.toRadians(3.0);

  private final CommandSwerveDrivetrain m_drivetrain;
  private final Supplier<Translation2d> m_fieldSpeedsMps;

  private final SwerveRequest.FieldCentricFacingAngle m_facing =
      new SwerveRequest.FieldCentricFacingAngle()
          .withDriveRequestType(DriveRequestType.OpenLoopVoltage)
          .withForwardPerspective(ForwardPerspectiveValue.BlueAlliance)
          .withRotationalDeadband(0.0)
          .withHeadingPID(kHeadingP, 0.0, 0.0)
          .withMaxAbsRotationalRate(kMaxOmegaRadPerSec);
  private final SwerveRequest.Idle m_idle = new SwerveRequest.Idle();

  /** Rotate in place. */
  public AimAtGoalCommand(CommandSwerveDrivetrain drivetrain) {
    this(drivetrain, Translation2d::new);
  }

  /** Aim while the driver translates. Speeds must already be blue-frame m/s. */
  public AimAtGoalCommand(
      CommandSwerveDrivetrain drivetrain, Supplier<Translation2d> fieldSpeedsMps) {
    m_drivetrain = drivetrain;
    m_fieldSpeedsMps = fieldSpeedsMps;
    addRequirements(drivetrain);
  }

  @Override
  public void initialize() {
    m_facing.HeadingController.reset();
  }

  @Override
  public void execute() {
    Optional<Rotation2d> heading = headingToGoal();
    if (heading.isEmpty()) {
      m_drivetrain.setControl(m_idle);
      SmartDashboard.putBoolean("AimAtGoal/aligned", false);
      SmartDashboard.putNumber("AimAtGoal/headingErrorDeg", Double.NaN);
      return;
    }

    Translation2d v = m_fieldSpeedsMps.get();
    m_drivetrain.setControl(
        m_facing
            .withVelocityX(v.getX())
            .withVelocityY(v.getY())
            .withTargetDirection(heading.get()));
    SmartDashboard.putNumber("AimAtGoal/headingErrorDeg", Math.toDegrees(headingErrorRad()));
    SmartDashboard.putBoolean("AimAtGoal/aligned", isAligned());
  }

  @Override
  public void end(boolean interrupted) {
    m_drivetrain.setControl(m_idle);
  }

  @Override
  public boolean isFinished() {
    return false;
  }

  public boolean isAligned() {
    if (!isScheduled()) {
      return false;
    }
    double error = headingErrorRad();
    return Double.isFinite(error) && Math.abs(error) <= kAlignedTolRad;
  }

  private Optional<Rotation2d> headingToGoal() {
    Pose2d pose = m_drivetrain.getStateCopy().Pose;
    return FieldConstants.getGoal().map(goal -> goal.minus(pose.getTranslation()).getAngle());
  }

  private double headingErrorRad() {
    Pose2d pose = m_drivetrain.getStateCopy().Pose;
    return headingToGoal()
        .map(desired -> desired.minus(pose.getRotation()).getRadians())
        .orElse(Double.NaN);
  }
}
