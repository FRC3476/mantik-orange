# FRC vision / swerve compile fixture

Recorded **2026-09-15**.

| Piece | Version |
| --- | --- |
| Java | 17 (compiled with WPILib Temurin 17.0.16) |
| Gradle | 8.11 (`compileJava`, not a full GradleRIO deploy) |
| WPILib | 2026.2.2 (maven `edu.wpi.first.*-java`) |
| PhotonLib / coprocessor image | 2026.3.4 |
| AprilTag layout constants | `k2026RebuiltWelded`, `k2026RebuiltAndymark` |
| LimelightHelpers | v1.14 pinned to commit `7a3f813935f0db89e99dbaebd4b075a5946cc1cd` |
| Limelight OS | 2026.0 or later |
| Phoenix 6 | 26.3.0 (`com.ctre.phoenix6:wpiapi-java`) |
| BLine-Lib | v0.9.1 |

PhotonPoseEstimator API reference used while writing examples: https://docs.photonvision.org/en/v2026.3.4/docs/programming/photonlib/robot-pose-estimator.html

The common tree is the course CommandSwerveDrivetrain integration (Tuner X-shaped constants, VisionFusion, BLineAutos, AimAtGoalCommand). `compileJava` does not run native Phoenix simulation or a physical robot.

Compile:

```
node tools/frc-vision-compile/compile.mjs
```
