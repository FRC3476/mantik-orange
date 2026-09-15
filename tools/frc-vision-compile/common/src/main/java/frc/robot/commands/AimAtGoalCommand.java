package frc.robot.commands;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.ctre.phoenix6.swerve.SwerveRequest.ForwardPerspectiveValue;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.subsystems.CommandSwerveDrivetrain;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;

/**
 * Points drivetrain +X at a field Translation2d using fused getState().Pose. Heading PID lives in
 * FieldCentricFacingAngle and runs with the request on the odometry thread.
 */
public class AimAtGoalCommand extends Command {
  public static final double kDefaultHeadingP = 3.0;
  public static final double kDefaultHeadingTolRad = 0.05;
  public static final double kDefaultMaxOmegaRadPerSec = 4.0;
  public static final double kDefaultMaxTranslationMps = 1.5;
  public static final double kDefaultMinAimDistanceM = 0.30;

  private final CommandSwerveDrivetrain m_drivetrain;
  private final Supplier<Optional<Translation2d>> m_goalSupplier;
  private final BooleanSupplier m_poseTrusted;
  private final DoubleSupplier m_fieldVxMps;
  private final DoubleSupplier m_fieldVyMps;
  private final double m_headingTolRad;
  private final double m_maxOmegaRadPerSec;
  private final double m_maxTranslationMps;
  private final double m_minAimDistanceM;

  private final SwerveRequest.FieldCentricFacingAngle m_facing =
      new SwerveRequest.FieldCentricFacingAngle()
          .withDriveRequestType(DriveRequestType.OpenLoopVoltage)
          .withForwardPerspective(ForwardPerspectiveValue.BlueAlliance)
          .withRotationalDeadband(0.0);
  private final SwerveRequest.ApplyRobotSpeeds m_zero =
      new SwerveRequest.ApplyRobotSpeeds().withSpeeds(new ChassisSpeeds());

  private boolean m_active;
  private boolean m_ranValidExecute;
  private boolean m_validThisCycle;
  private Optional<Translation2d> m_lastGoal = Optional.empty();
  private String m_rejectReason = "inactive";
  private double m_loggedVxMps;
  private double m_loggedVyMps;
  private double m_loggedMeasuredOmegaRadPerSec;

  public static AimAtGoalCommand aimAtTargetCommand(
      CommandSwerveDrivetrain drivetrain,
      Supplier<Optional<Translation2d>> goalSupplier,
      BooleanSupplier poseTrusted,
      DoubleSupplier fieldVxMps,
      DoubleSupplier fieldVyMps) {
    return new AimAtGoalCommand(drivetrain, goalSupplier, poseTrusted, fieldVxMps, fieldVyMps);
  }

  public AimAtGoalCommand(
      CommandSwerveDrivetrain drivetrain,
      Supplier<Optional<Translation2d>> goalSupplier,
      BooleanSupplier poseTrusted,
      DoubleSupplier fieldVxMps,
      DoubleSupplier fieldVyMps) {
    this(
        drivetrain,
        goalSupplier,
        poseTrusted,
        fieldVxMps,
        fieldVyMps,
        kDefaultHeadingP,
        kDefaultHeadingTolRad,
        kDefaultMaxOmegaRadPerSec,
        kDefaultMaxTranslationMps,
        kDefaultMinAimDistanceM);
  }

  public AimAtGoalCommand(
      CommandSwerveDrivetrain drivetrain,
      Supplier<Optional<Translation2d>> goalSupplier,
      BooleanSupplier poseTrusted,
      DoubleSupplier fieldVxMps,
      DoubleSupplier fieldVyMps,
      double headingP,
      double headingTolRad,
      double maxOmegaRadPerSec,
      double maxTranslationMps,
      double minAimDistanceM) {
    m_drivetrain = Objects.requireNonNull(drivetrain, "drivetrain");
    m_goalSupplier = Objects.requireNonNull(goalSupplier, "goalSupplier");
    m_poseTrusted = Objects.requireNonNull(poseTrusted, "poseTrusted");
    m_fieldVxMps = Objects.requireNonNull(fieldVxMps, "fieldVxMps");
    m_fieldVyMps = Objects.requireNonNull(fieldVyMps, "fieldVyMps");
    validateTuning(headingP, headingTolRad, maxOmegaRadPerSec, maxTranslationMps, minAimDistanceM);
    m_headingTolRad = headingTolRad;
    m_maxOmegaRadPerSec = maxOmegaRadPerSec;
    m_maxTranslationMps = maxTranslationMps;
    m_minAimDistanceM = minAimDistanceM;
    m_facing.withHeadingPID(headingP, 0.0, 0.0).withMaxAbsRotationalRate(maxOmegaRadPerSec);
    m_facing.TargetRateFeedforward = 0.0;
    addRequirements(drivetrain);
  }

  @Override
  public void initialize() {
    m_active = true;
    m_ranValidExecute = false;
    m_validThisCycle = false;
    m_lastGoal = Optional.empty();
    m_rejectReason = "initializing";
    m_facing.HeadingController.reset();
    writeZero();
    publishLogs(currentPose(), AimSample.invalid("initializing"), 0.0, 0.0);
  }

  @Override
  public void execute() {
    Pose2d pose = currentPose();
    Optional<Translation2d> goal = readGoal();
    boolean trusted = m_poseTrusted.getAsBoolean();
    double vx = m_fieldVxMps.getAsDouble();
    double vy = m_fieldVyMps.getAsDouble();

    if (!Double.isFinite(vx) || !Double.isFinite(vy)) {
      applyInvalid(pose, "nonfinite-translation");
      return;
    }

    AimSample sample = evaluateAim(pose, goal, trusted);
    if (!sample.valid) {
      applyInvalid(pose, sample.reason);
      return;
    }

    if (!m_validThisCycle || goalChanged(goal)) {
      m_facing.HeadingController.reset();
    }
    m_lastGoal = Optional.of(new Translation2d(goal.get().getX(), goal.get().getY()));
    m_validThisCycle = true;
    m_ranValidExecute = true;
    m_rejectReason = "";

    double mag = Math.hypot(vx, vy);
    if (mag > m_maxTranslationMps && mag > 1e-9) {
      double scale = m_maxTranslationMps / mag;
      vx *= scale;
      vy *= scale;
    }

    m_drivetrain.setControl(
        m_facing
            .withVelocityX(vx)
            .withVelocityY(vy)
            .withTargetDirection(sample.desiredHeading));
    publishLogs(pose, sample, vx, vy);
  }

  @Override
  public void end(boolean interrupted) {
    m_active = false;
    m_ranValidExecute = false;
    m_validThisCycle = false;
    m_lastGoal = Optional.empty();
    m_rejectReason = interrupted ? "interrupted" : "ended";
    m_facing.HeadingController.reset();
    writeZero();
    publishLogs(currentPose(), AimSample.invalid(m_rejectReason), 0.0, 0.0);
  }

  @Override
  public boolean isFinished() {
    return false;
  }

  public double getHeadingErrorRad() {
    if (!m_active || !m_ranValidExecute) {
      return Double.NaN;
    }
    AimSample sample = evaluateAim(currentPose(), readGoal(), m_poseTrusted.getAsBoolean());
    if (!sample.valid) {
      return Double.NaN;
    }
    return sample.headingErrorRad;
  }

  public boolean isAligned() {
    double error = getHeadingErrorRad();
    return Double.isFinite(error) && Math.abs(error) <= m_headingTolRad;
  }

  private Pose2d currentPose() {
    return m_drivetrain.getStateCopy().Pose;
  }

  private Optional<Translation2d> readGoal() {
    Optional<Translation2d> goal = m_goalSupplier.get();
    return goal == null ? Optional.empty() : goal;
  }

  private void applyInvalid(Pose2d pose, String reason) {
    m_validThisCycle = false;
    m_lastGoal = Optional.empty();
    m_rejectReason = reason;
    m_facing.HeadingController.reset();
    writeZero();
    publishLogs(pose, AimSample.invalid(reason), 0.0, 0.0);
  }

  private void writeZero() {
    m_drivetrain.setControl(m_zero.withSpeeds(new ChassisSpeeds()));
    m_loggedVxMps = 0.0;
    m_loggedVyMps = 0.0;
    m_loggedMeasuredOmegaRadPerSec = 0.0;
  }

  AimSample evaluateAim(Pose2d pose, Optional<Translation2d> goal, boolean poseTrusted) {
    if (!poseTrusted) {
      return AimSample.invalid("untrusted-pose");
    }
    if (!isFinitePose(pose)) {
      return AimSample.invalid("nonfinite-pose");
    }
    if (goal == null || goal.isEmpty()) {
      return AimSample.invalid("no-goal");
    }
    Translation2d target = goal.get();
    if (!isFiniteTranslation(target)) {
      return AimSample.invalid("nonfinite-goal");
    }
    Translation2d robotXy = pose.getTranslation();
    double distanceM = robotXy.getDistance(target);
    if (!Double.isFinite(distanceM) || distanceM <= m_minAimDistanceM) {
      return AimSample.invalid("distance");
    }
    Rotation2d desired = target.minus(robotXy).getAngle();
    double headingErrorRad = desired.minus(pose.getRotation()).getRadians();
    return new AimSample(true, "", distanceM, desired, headingErrorRad);
  }

  private boolean goalChanged(Optional<Translation2d> goal) {
    if (goal.isEmpty() || m_lastGoal.isEmpty()) {
      return goal.isPresent() != m_lastGoal.isPresent();
    }
    return !goal.get().equals(m_lastGoal.get());
  }

  private static boolean isFinitePose(Pose2d pose) {
    return pose != null
        && isFiniteTranslation(pose.getTranslation())
        && Double.isFinite(pose.getRotation().getRadians());
  }

  private static boolean isFiniteTranslation(Translation2d t) {
    return t != null && Double.isFinite(t.getX()) && Double.isFinite(t.getY());
  }

  private static void validateTuning(
      double headingP,
      double headingTolRad,
      double maxOmegaRadPerSec,
      double maxTranslationMps,
      double minAimDistanceM) {
    requireFinitePositive("headingP", headingP);
    requireFiniteNonNegative("headingTolRad", headingTolRad);
    requireFinitePositive("maxOmegaRadPerSec", maxOmegaRadPerSec);
    requireFiniteNonNegative("maxTranslationMps", maxTranslationMps);
    requireFinitePositive("minAimDistanceM", minAimDistanceM);
  }

  private static void requireFinitePositive(String name, double value) {
    if (!Double.isFinite(value) || value <= 0.0) {
      throw new IllegalArgumentException(name + " must be finite and positive");
    }
  }

  private static void requireFiniteNonNegative(String name, double value) {
    if (!Double.isFinite(value) || value < 0.0) {
      throw new IllegalArgumentException(name + " must be finite and nonnegative");
    }
  }

  private void publishLogs(Pose2d pose, AimSample sample, double vxMps, double vyMps) {
    m_loggedVxMps = vxMps;
    m_loggedVyMps = vyMps;
    ChassisSpeeds speeds = m_drivetrain.getStateCopy().Speeds;
    m_loggedMeasuredOmegaRadPerSec = speeds.omegaRadiansPerSecond;
    double currentDeg = isFinitePose(pose) ? pose.getRotation().getDegrees() : Double.NaN;
    double desiredDeg =
        sample.desiredHeading != null ? sample.desiredHeading.getDegrees() : Double.NaN;
    double errorRad = sample.valid ? sample.headingErrorRad : Double.NaN;
    double errorDeg = sample.valid ? Math.toDegrees(sample.headingErrorRad) : Double.NaN;

    SmartDashboard.putBoolean("AimAtGoal/active", m_active);
    SmartDashboard.putBoolean("AimAtGoal/valid", sample.valid);
    SmartDashboard.putBoolean("AimAtGoal/aligned", isAligned());
    SmartDashboard.putString("AimAtGoal/rejectReason", m_rejectReason);
    SmartDashboard.putNumber("AimAtGoal/currentHeadingDeg", currentDeg);
    SmartDashboard.putNumber("AimAtGoal/desiredHeadingDeg", desiredDeg);
    SmartDashboard.putNumber("AimAtGoal/headingErrorRad", errorRad);
    SmartDashboard.putNumber("AimAtGoal/headingErrorDeg", errorDeg);
    SmartDashboard.putNumber("AimAtGoal/measuredOmegaRadPerSec", m_loggedMeasuredOmegaRadPerSec);
    SmartDashboard.putNumber("AimAtGoal/fieldVxMps", vxMps);
    SmartDashboard.putNumber("AimAtGoal/fieldVyMps", vyMps);
    SmartDashboard.putNumber("AimAtGoal/distanceM", sample.distanceM);
  }

  static final class AimSample {
    final boolean valid;
    final String reason;
    final double distanceM;
    final Rotation2d desiredHeading;
    final double headingErrorRad;

    AimSample(
        boolean valid,
        String reason,
        double distanceM,
        Rotation2d desiredHeading,
        double headingErrorRad) {
      this.valid = valid;
      this.reason = reason;
      this.distanceM = distanceM;
      this.desiredHeading = desiredHeading;
      this.headingErrorRad = headingErrorRad;
    }

    static AimSample invalid(String reason) {
      return new AimSample(false, reason, Double.NaN, null, Double.NaN);
    }
  }
}
