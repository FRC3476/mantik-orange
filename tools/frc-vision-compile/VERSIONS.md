# FRC vision compile fixture

Recorded **2026-09-15**.

| Piece | Version |
| --- | --- |
| Java | 17 (compiled with WPILib Temurin 17.0.16) |
| Gradle | 8.11 (`compileJava`, not a full GradleRIO deploy) |
| WPILib | 2026.2.2 (maven `edu.wpi.first.*-java`) |
| PhotonLib / coprocessor image | 2026.3.4 |
| AprilTag layout constants | `k2026RebuiltWelded`, `k2026RebuiltAndymark` |
| LimelightHelpers | v1.14 (`src/main/java/frc/robot/LimelightHelpers.java`) |
| Limelight OS | 2026.0 or later |

PhotonPoseEstimator API reference used while writing examples: https://docs.photonvision.org/en/v2026.3.4/docs/programming/photonlib/robot-pose-estimator.html

`ExampleDriveHardware` is a compile-only adapter. It does not stub WPILib, PhotonLib, or LimelightHelpers.

Compile:

```
node tools/frc-vision-compile/compile.mjs
```
