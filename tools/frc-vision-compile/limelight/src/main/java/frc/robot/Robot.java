package frc.robot;

import edu.wpi.first.wpilibj.TimedRobot;
import frc.robot.drive.ExampleDriveHardware;
import frc.robot.subsystems.Drive;
import frc.robot.vision.VisionSubsystem;

/** Compile fixture entry point. Not a lesson example. */
public class Robot extends TimedRobot {
  private final Drive m_drive = new Drive(new ExampleDriveHardware(), new VisionSubsystem());

  @Override
  public void robotPeriodic() {
    m_drive.periodic();
  }
}
