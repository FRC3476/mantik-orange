package frc.robot;

import static edu.wpi.first.units.Units.MetersPerSecond;
import static edu.wpi.first.units.Units.RadiansPerSecond;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.smartdashboard.SendableChooser;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.button.CommandXboxController;
import edu.wpi.first.wpilibj2.command.button.RobotModeTriggers;
import frc.robot.autos.BLineAutos;
import frc.robot.commands.AimAtGoalCommand;
import frc.robot.generated.TunerConstants;
import frc.robot.subsystems.CommandSwerveDrivetrain;
import frc.robot.subsystems.VisionFusion;
import frc.robot.vision.VisionSubsystem;

/**
 * Integrated compile fixture: Tuner X drivetrain, vision fusion, BLine, and aim.
 * Left bumper seeds heading. Right bumper holds aim. Joystick default is Idle outside teleop.
 */
public class RobotContainer {
  private static final double kAimMaxSpeed = 1.5;

  private final double MaxSpeed = TunerConstants.kSpeedAt12Volts.in(MetersPerSecond);
  private final double MaxAngularRate = RotationsPerSecond.of(0.75).in(RadiansPerSecond);

  private final SwerveRequest.FieldCentric m_drive =
      new SwerveRequest.FieldCentric()
          .withDeadband(MaxSpeed * 0.1)
          .withRotationalDeadband(MaxAngularRate * 0.1)
          .withDriveRequestType(DriveRequestType.OpenLoopVoltage);
  private final SwerveRequest.Idle m_idle = new SwerveRequest.Idle();

  public final CommandSwerveDrivetrain drivetrain = TunerConstants.createDrivetrain();
  private final VisionFusion m_fusion = new VisionFusion(drivetrain, new VisionSubsystem());
  private final BLineAutos m_autos = new BLineAutos(drivetrain, m_fusion::resetPose);
  private final Telemetry m_logger = new Telemetry();
  private final CommandXboxController m_joystick = new CommandXboxController(0);
  private final SendableChooser<Command> m_autoChooser = new SendableChooser<>();

  public RobotContainer() {
    BLineAutos.registerLogging();
    drivetrain.registerTelemetry(m_logger::telemeterize);
    configureDefaultDrive();
    configureBindings();
    configureAutos();
  }

  private void configureDefaultDrive() {
    drivetrain.setDefaultCommand(
        Commands.either(
            drivetrain.applyRequest(
                () ->
                    m_drive
                        .withVelocityX(-m_joystick.getLeftY() * MaxSpeed)
                        .withVelocityY(-m_joystick.getLeftX() * MaxSpeed)
                        .withRotationalRate(-m_joystick.getRightX() * MaxAngularRate)),
            drivetrain.applyRequest(() -> m_idle),
            DriverStation::isTeleopEnabled));

    RobotModeTriggers.disabled()
        .whileTrue(drivetrain.applyRequest(() -> m_idle).ignoringDisable(true));
  }

  private void configureBindings() {
    m_joystick.leftBumper().onTrue(drivetrain.runOnce(m_fusion::seedFieldCentric));

    AimAtGoalCommand aim = new AimAtGoalCommand(drivetrain, this::teleopFieldSpeeds);
    m_joystick.rightBumper().and(RobotModeTriggers.teleop()).whileTrue(aim);
  }

  private void configureAutos() {
    m_autoChooser.setDefaultOption("Do nothing", Commands.none());
    m_autoChooser.addOption("Score left", m_autos.followFirstPath("score-left"));
    SmartDashboard.putData("Auto Chooser", m_autoChooser);
  }

  public Command getAutonomousCommand() {
    Command selected = m_autoChooser.getSelected();
    SmartDashboard.putString(
        "Auto/Selected", selected == null ? "none" : m_autoChooser.getSelected().getName());
    return selected;
  }

  private Translation2d teleopFieldSpeeds() {
    double x = MathUtil.applyDeadband(-m_joystick.getLeftY(), 0.1) * kAimMaxSpeed;
    double y = MathUtil.applyDeadband(-m_joystick.getLeftX(), 0.1) * kAimMaxSpeed;
    return new Translation2d(x, y).rotateBy(drivetrain.getOperatorForwardDirection());
  }
}
