package frc.robot.vision;

import edu.wpi.first.math.Matrix;
import edu.wpi.first.math.VecBuilder;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.numbers.N1;
import edu.wpi.first.math.numbers.N3;

/** One accepted vision measurement after vendor quality checks. */
public final class VisionEstimate {
  public final Pose2d pose;
  public final double timestampSeconds;
  public final Matrix<N3, N1> stdDevs;
  public final boolean multiTag;
  public final int tagsUsed;
  public final String solveLabel;

  public VisionEstimate(
      Pose2d pose,
      double timestampSeconds,
      Matrix<N3, N1> stdDevs,
      boolean multiTag,
      int tagsUsed,
      String solveLabel) {
    this.pose = pose;
    this.timestampSeconds = timestampSeconds;
    this.stdDevs = stdDevs;
    this.multiTag = multiTag;
    this.tagsUsed = tagsUsed;
    this.solveLabel = solveLabel;
  }

  public static Matrix<N3, N1> multiTagStdDevs() {
    return VecBuilder.fill(0.3, 0.3, 0.9);
  }

  public static Matrix<N3, N1> singleTagStdDevs() {
    return VecBuilder.fill(0.5, 0.5, 2.0);
  }
}
