/**
 * Recorded 2026-09-15 against published WPILib / PhotonVision / Limelight docs.
 * Examples in the pose-estimation lessons target these versions.
 */
export const FRC_VISION_VERSIONS = {
  recordedOn: '2026-09-15',
  java: '17',
  wpilib: '2026.2.2',
  gradleRio: '2026.2.2',
  photonLib: '2026.3.4',
  photonVisionCoprocessor: '2026.3.4',
  photonPoseGuide:
    'https://docs.photonvision.org/en/v2026.3.4/docs/programming/photonlib/robot-pose-estimator.html',
  aprilTagField: 'AprilTagFields.k2026RebuiltWelded',
  aprilTagFieldAlt: 'AprilTagFields.k2026RebuiltAndymark',
  limelightHelpers: '1.14',
  limelightOs: '2026.0 or later',
  limelightHelpersSource:
    'https://raw.githubusercontent.com/LimelightVision/limelightlib-wpijava/master/LimelightHelpers.java',
  limelightHelpersPackage: 'src/main/java/frc/robot/LimelightHelpers.java',
} as const;
