package frc.robot.constants;

import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import java.util.Optional;

/** Placeholder field landmarks. Replace from the season field. */
public final class FieldConstants {
  public static final Translation2d kBlueGoal = new Translation2d(16.54, 4.11);
  public static final Translation2d kRedGoal = new Translation2d(0.0, 4.11);

  private FieldConstants() {}

  public static Optional<Translation2d> getGoal() {
    Optional<Alliance> alliance = DriverStation.getAlliance();
    if (alliance.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(alliance.get() == Alliance.Red ? kRedGoal : kBlueGoal);
  }
}
