#!/usr/bin/env node
/**
 * Compile the PhotonVision and Limelight example trees against published 2026 artifacts.
 * Does not stub WPILib, PhotonLib, or LimelightHelpers.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const helpersUrl =
  'https://raw.githubusercontent.com/LimelightVision/limelightlib-wpijava/master/LimelightHelpers.java';
const helpersPath = path.join(root, 'limelight/src/main/java/frc/robot/LimelightHelpers.java');
const isWin = process.platform === 'win32';

function withJdk(env) {
  const next = { ...env };
  const homes = [env.JAVA_HOME, path.join(os.homedir(), 'wpilib/2026/jdk')].filter(Boolean);
  for (const home of homes) {
    const java = path.join(home, 'bin', isWin ? 'java.exe' : 'java');
    if (fs.existsSync(java)) {
      next.JAVA_HOME = home;
      next.PATH = `${path.join(home, 'bin')}${path.delimiter}${next.PATH ?? ''}`;
      return next;
    }
  }
  return next;
}

function findNamed(dir, filename, depth = 0, hits = []) {
  if (depth > 6 || !fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === filename) hits.push(full);
    else if (entry.isDirectory()) findNamed(full, filename, depth + 1, hits);
  }
  return hits;
}

function resolveGradle(env) {
  const filename = isWin ? 'gradle.bat' : 'gradle';
  const which = spawnSync(isWin ? 'where' : 'which', [filename], {
    encoding: 'utf8',
    env,
  });
  if (which.status === 0) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }
  const hits = findNamed(path.join(os.homedir(), '.gradle', 'permwrapper', 'dists'), filename);
  hits.sort((a, b) => {
    const rank = (value) => (value.includes('gradle-8.') ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return hits[0] ?? null;
}

async function downloadHelpers() {
  fs.mkdirSync(path.dirname(helpersPath), { recursive: true });
  const response = await fetch(helpersUrl);
  if (!response.ok) {
    throw new Error(`Failed to download LimelightHelpers: ${response.status}`);
  }
  const text = await response.text();
  fs.writeFileSync(helpersPath, text);
  const versionLine = text.split('\n').find((line) => line.includes('LimelightHelpers v'));
  console.log(versionLine?.trim() || 'Downloaded LimelightHelpers (version line not found)');
}

function runGradle(projectDir, gradle, env) {
  const result = spawnSync(gradle, ['compileJava', '--no-daemon'], {
    cwd: projectDir,
    stdio: 'inherit',
    env,
  });
  if (result.error && result.error.code === 'ENOENT') {
    console.error('gradle not found; skipping compileJava');
    return 127;
  }
  return result.status ?? 1;
}

const env = withJdk(process.env);
const gradle = resolveGradle(env);
if (!gradle) {
  console.error('gradle not found on PATH or in ~/.gradle/permwrapper; skipping compileJava');
  process.exit(127);
}

const javaHome = env.JAVA_HOME ?? '(unset)';
console.log(`Using JAVA_HOME=${javaHome}`);
console.log(`Using gradle=${gradle}`);

await downloadHelpers();
const pv = runGradle(path.join(root, 'photonvision'), gradle, env);
if (pv !== 0 && pv !== 127) process.exit(pv);
const ll = runGradle(path.join(root, 'limelight'), gradle, env);
if (ll !== 0 && ll !== 127) process.exit(ll);
if (pv === 127 || ll === 127) process.exit(127);
console.log('compileJava succeeded for photonvision and limelight');
