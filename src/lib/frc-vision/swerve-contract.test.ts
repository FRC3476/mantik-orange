import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFreshnessState, markOdometryReady, markPoseReset, rejectFreshness } from './freshness';
import { FRC_VISION_VERSIONS } from './versions';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixtureRoot = path.join(repoRoot, 'tools/frc-vision-compile/common/src/main/java');

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

function readFixture(rel: string): string {
  return readFileSync(path.join(fixtureRoot, rel), 'utf8');
}

function wrapRad(errorRad: number): number {
  return Math.atan2(Math.sin(errorRad), Math.cos(errorRad));
}

function rotate(x: number, y: number, radians: number): { x: number; y: number } {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: x * c - y * s, y: x * s + y * c };
}

function clampTranslation(x: number, y: number, maxMps: number): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag > maxMps && mag > 1e-9) {
    return { x: (x * maxMps) / mag, y: (y * maxMps) / mag };
  }
  return { x, y };
}

describe('CommandSwerve course contract', () => {
  const aimJava = readFixture('frc/robot/commands/AimAtGoalCommand.java');
  const speedsJava = readFixture('frc/robot/commands/DriverFieldSpeeds.java');
  const blineJava = readFixture('frc/robot/autos/BLineAutos.java');
  const fusionJava = readFixture('frc/robot/subsystems/VisionFusion.java');
  const drivetrainJava = readFixture('frc/robot/subsystems/CommandSwerveDrivetrain.java');
  const containerJava = readFixture('frc/robot/RobotContainer.java');
  const telemetryJava = readFixture('frc/robot/Telemetry.java');
  const commandsMdx = read('src/content/frc/frc-command-based/commands.mdx');
  const aimMdx = read('src/content/frc/frc-examples/swerve-aim-at-goal.mdx');
  const blineMdx = read('src/content/frc/frc-external-tools/bline.mdx');
  const fusionMdx = read('src/content/frc/frc-pose-estimation/vision-pose-estimation-fusion.mdx');
  const bindingsMdx = read('src/content/frc/frc-command-based/robot-container-and-bindings.mdx');
  const swerveMdx = read('src/content/frc/frc-examples/swerve-drive-example.mdx');

  it('pins Phoenix 26.3.0 and BLine v0.9.1', () => {
    expect(FRC_VISION_VERSIONS.phoenix6).toBe('26.3.0');
    expect(FRC_VISION_VERSIONS.blineLib).toBe('v0.9.1');
    expect(FRC_VISION_VERSIONS.wpilib).toBe('2026.2.2');
  });

  it('keeps blue/red stick direction in the blue field frame', () => {
    const max = 1.5;
    const blue = rotate(max, 0, 0);
    const red = rotate(max, 0, Math.PI);
    expect(blue.x).toBeCloseTo(max);
    expect(blue.y).toBeCloseTo(0);
    expect(red.x).toBeCloseTo(-max);
    expect(red.y).toBeCloseTo(0);
    expect(speedsJava).toContain('rotateBy(operatorForward)');
    expect(aimJava).toContain('ForwardPerspectiveValue.BlueAlliance');
  });

  it('wraps heading error at ±π and caps translation magnitude', () => {
    const poseRad = (179 * Math.PI) / 180;
    const desiredRad = (-179 * Math.PI) / 180;
    expect(Math.abs(wrapRad(desiredRad - poseRad))).toBeCloseTo((2 * Math.PI) / 180, 6);
    const capped = clampTranslation(3, 4, 1.5);
    expect(Math.hypot(capped.x, capped.y)).toBeCloseTo(1.5);
    expect(aimJava).toContain('desired.minus(pose.getRotation()).getRadians()');
    expect(aimJava).toContain('withHeadingPID');
    expect(aimJava).toContain('withMaxAbsRotationalRate');
    expect(aimJava).toContain('withRotationalDeadband(0.0)');
  });

  it('zeros chassis output and clears alignment on invalid pose/goal and end', () => {
    expect(aimJava).toMatch(/applyInvalid[\s\S]*writeZero/);
    expect(aimJava).toContain('untrusted-pose');
    expect(aimJava).toContain('nonfinite-pose');
    expect(aimJava).toContain('no-goal');
    expect(aimJava).toContain('public void end(boolean interrupted)');
    expect(aimJava).toMatch(/end\([\s\S]*writeZero/);
    expect(aimJava).toContain('addRequirements(drivetrain)');
    expect(commandsMdx).toContain('addRequirements(shooter, transfer, conveyor)');
    expect(commandsMdx).not.toMatch(/addRequirements\([^)]*drivetrain/);
  });

  it('does not collide heading seed and aim on the same bumper', () => {
    expect(containerJava).toContain('m_joystick.leftBumper().onTrue(drivetrain.runOnce(m_fusion::seedFieldCentric))');
    expect(containerJava).toContain('m_joystick.rightBumper().and(RobotModeTriggers.teleop()).whileTrue(aim)');
    expect(containerJava).toContain('DriverStation::isTeleopEnabled');
    expect(containerJava).toContain('applyRequest(() -> m_idle)');
    expect(bindingsMdx).toContain('leftBumper');
    expect(bindingsMdx).toContain('rightBumper');
    expect(swerveMdx).toContain('left bumper');
  });

  it('converts FPGA capture time once in CommandSwerveDrivetrain overrides', () => {
    const conversions = drivetrainJava.match(/Utils\.fpgaToCurrentTime/g) ?? [];
    expect(conversions).toHaveLength(3);
    expect(fusionJava).not.toContain('fpgaToCurrentTime');
    expect(fusionJava).toContain('addVisionMeasurement');
    expect(fusionJava).toContain('invalidateAcceptedHistory');
    expect(fusionJava).toContain('public void resetRotation');
    expect(fusionJava).toContain('public void seedFieldCentric');
    expect(fusionMdx).toContain('Utils.fpgaToCurrentTime');
  });

  it('treats heading reset like pose reset for vision history', () => {
    const state = createFreshnessState();
    markOdometryReady(state, 5);
    expect(rejectFreshness(state, 5.1, 5.2)).toBeNull();
    markPoseReset(state, 5.3);
    expect(rejectFreshness(state, 5.25, 5.4)).toBe('pre_reset');
  });

  it('discretizes BLine output once at 20 ms with Velocity ApplyRobotSpeeds', () => {
    expect(blineJava).toContain('kFollowerPeriodSeconds = 0.020');
    expect(blineJava).toContain('DriveRequestType.Velocity');
    expect(blineJava).toContain('ChassisSpeeds.discretize(speeds, kFollowerPeriodSeconds)');
    expect(blineJava).toContain('withDefaultShouldFlip()');
    expect(blineJava).toContain('followLaterPath');
    expect(blineJava).toContain('runtimeTargetBuilder');
    expect(blineJava).toContain('applyRobotRelative(new ChassisSpeeds())');
    expect(blineMdx).toContain('ChassisSpeeds.discretize');
    expect(aimJava).not.toContain('ChassisSpeeds.discretize');
    expect(containerJava).not.toContain('ChassisSpeeds.discretize');
  });

  it('keeps telemetry on the odometry thread and uses DriveState keys', () => {
    expect(telemetryJava).toContain('DriveState/Pose');
    expect(telemetryJava).toContain('DriveState/Speeds');
    expect(telemetryJava).toContain('DriveState/ModuleStates');
    expect(telemetryJava).not.toContain('pollEstimates');
    expect(telemetryJava).not.toContain('CommandScheduler');
    expect(containerJava).toContain('registerTelemetry(m_logger::telemeterize)');
  });

  it('keeps MDX complete classes aligned with fixture method names', () => {
    expect(aimMdx).toContain('withTargetDirection(sample.desiredHeading)');
    expect(aimMdx).toContain('ForwardPerspectiveValue.BlueAlliance');
    expect(blineMdx).toContain('followFirstPath');
    expect(blineMdx).toContain('DriveRequestType.Velocity');
    expect(fusionMdx).toContain('isPoseTrusted');
    expect(fusionMdx).toContain('addVisionMeasurement');
  });
});

describe('primary CTRE path has no unexplained old-stack Drive', () => {
  const primaryPages = [
    'src/content/frc/frc-examples/swerve-drive-example.mdx',
    'src/content/frc/frc-examples/swerve-aim-at-goal.mdx',
    'src/content/frc/frc-examples/shooter-shot-table.mdx',
    'src/content/frc/frc-command-based/robot-container-and-bindings.mdx',
    'src/content/frc/frc-command-based/commands.mdx',
    'src/content/frc/frc-pose-estimation/odometry.mdx',
    'src/content/frc/frc-pose-estimation/vision-pose-estimation-fusion.mdx',
    'src/content/frc/frc-external-tools/bline.mdx',
  ];

  it('does not teach DriveCommands.joystickDrive or driveRobotRelative in the primary path', () => {
    for (const page of primaryPages) {
      const text = read(page);
      expect(text, page).not.toContain('DriveCommands.joystickDrive');
      expect(text, page).not.toContain('driveRobotRelative');
      expect(text, page).not.toContain('new PhoenixOdometryThread');
      expect(text, page).not.toMatch(/drive = new Drive\(/);
    }
  });

  it('labels remaining ModuleIO / AutoBuilder / Logger.recordOutput as optional AdvantageKit', () => {
    const io = read('src/content/frc/frc-command-based/io-layer.mdx');
    expect(io).toContain('optional');
    expect(io).toContain('CommandSwerveDrivetrain');
    const org = read('src/content/frc/frc-command-based/frc-code-organization.mdx');
    expect(org).toContain('LoggedDashboardChooser');
    expect(org).toContain('optional');
    const resources = read('src/content/frc/frc-environment-setup/frc-programming-resources.mdx');
    expect(resources).toContain('CTRE Swerve Overview');
    expect(resources).toContain('Phoenix 6 SwerveWithChoreo');
    const autonomousGrid = resources.match(
      /<LinkGrid links=\{(\[[\s\S]*?\])\} title="Autonomous"/,
    );
    expect(autonomousGrid?.[1]).toBeTruthy();
    expect(autonomousGrid?.[1]).not.toContain('AdvantageKit');
  });

  it('does not ship the old Drive fixture', () => {
    const names = readdirSync(path.join(fixtureRoot, 'frc/robot/subsystems'));
    expect(names).not.toContain('Drive.java');
    expect(names).toContain('CommandSwerveDrivetrain.java');
    expect(names).toContain('VisionFusion.java');
  });

  it('does not use a 1.5 s pose-history window as an application constant', () => {
    const freshnessTs = read('src/lib/frc-vision/freshness.ts');
    const freshnessJava = read(
      'tools/frc-vision-compile/common/src/main/java/frc/robot/vision/VisionFreshness.java',
    );
    expect(freshnessTs).toContain('maxAgeS: 0.5');
    expect(freshnessTs).not.toMatch(/maxAgeS:\s*1\.5/);
    expect(freshnessJava).not.toMatch(/1\.5/);
  });
});
