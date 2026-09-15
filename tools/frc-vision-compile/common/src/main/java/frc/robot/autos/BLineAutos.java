package frc.robot.autos;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import edu.wpi.first.math.Pair;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.lib.BLine.FollowPath;
import frc.robot.lib.BLine.Path;
import frc.robot.subsystems.CommandSwerveDrivetrain;
import java.util.function.Consumer;

/**
 * Course BLine adapter. The builder requires the drivetrain, not this helper. Drive request type
 * is Velocity; discretize once at the follower period (20 ms).
 */
public final class BLineAutos {
  public static final double kFollowerPeriodSeconds = 0.020;

  private final CommandSwerveDrivetrain m_drivetrain;
  private final Consumer<Pose2d> m_poseReset;
  private final SwerveRequest.ApplyRobotSpeeds m_applyRobotSpeeds =
      new SwerveRequest.ApplyRobotSpeeds()
          .withDriveRequestType(DriveRequestType.Velocity)
          .withDesaturateWheelSpeeds(true);
  private final FollowPath.Builder m_builder;

  public BLineAutos(CommandSwerveDrivetrain drivetrain, Consumer<Pose2d> poseReset) {
    m_drivetrain = drivetrain;
    m_poseReset = poseReset;
    m_builder =
        new FollowPath.Builder(
                drivetrain,
                () -> drivetrain.getStateCopy().Pose,
                () -> drivetrain.getStateCopy().Speeds,
                this::applyRobotRelative,
                new PIDController(5.0, 0.0, 0.0),
                new PIDController(3.0, 0.0, 0.0),
                new PIDController(2.0, 0.0, 0.0))
            .withTRatioBasedTranslationHandoffs(true)
            .withDefaultShouldFlip();
  }

  public FollowPath.Builder builder() {
    return m_builder;
  }

  public FollowPath.Builder runtimeTargetBuilder() {
    return new FollowPath.Builder(
            m_drivetrain,
            () -> m_drivetrain.getStateCopy().Pose,
            () -> m_drivetrain.getStateCopy().Speeds,
            this::applyRobotRelative,
            new PIDController(5.0, 0.0, 0.0),
            new PIDController(3.0, 0.0, 0.0),
            new PIDController(2.0, 0.0, 0.0))
        .withTRatioBasedTranslationHandoffs(true);
  }

  public Command followFirstPath(String name) {
    m_builder.withPoseReset(m_poseReset);
    return wrap(m_builder.build(new Path(name)));
  }

  public Command followLaterPath(String name) {
    m_builder.withPoseReset(pose -> {});
    return wrap(m_builder.build(new Path(name)));
  }

  public static void registerLogging() {
    FollowPath.setDoubleLoggingConsumer(
        value -> SmartDashboard.putNumber(value.getFirst(), value.getSecond()));
    FollowPath.setBooleanLoggingConsumer(
        value -> SmartDashboard.putBoolean(value.getFirst(), value.getSecond()));
    FollowPath.setPoseLoggingConsumer(BLineAutos::putPose);
    FollowPath.setTranslationListLoggingConsumer(BLineAutos::putTranslations);
  }

  private Command wrap(Command follow) {
    return follow.finallyDo(interrupted -> applyRobotRelative(new ChassisSpeeds()));
  }

  private void applyRobotRelative(ChassisSpeeds speeds) {
    m_drivetrain.setControl(
        m_applyRobotSpeeds.withSpeeds(ChassisSpeeds.discretize(speeds, kFollowerPeriodSeconds)));
  }

  private static void putPose(Pair<String, Pose2d> value) {
    Pose2d pose = value.getSecond();
    SmartDashboard.putNumberArray(
        value.getFirst(),
        new double[] {pose.getX(), pose.getY(), pose.getRotation().getDegrees()});
  }

  private static void putTranslations(Pair<String, Translation2d[]> value) {
    Translation2d[] translations = value.getSecond();
    double[] xy = new double[translations.length * 2];
    for (int i = 0; i < translations.length; i++) {
      xy[i * 2] = translations[i].getX();
      xy[i * 2 + 1] = translations[i].getY();
    }
    SmartDashboard.putNumberArray(value.getFirst(), xy);
  }
}
