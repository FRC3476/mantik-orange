import { compileAndRun } from './cheerpjRunner';
import { outputsMatch } from './compareOutput';
import type { CheckResult, HiddenTest, StatusFn } from './types';

export async function runHiddenTests(
  source: string,
  tests: HiddenTest[],
  onStatus?: StatusFn,
): Promise<CheckResult> {
  const cases = [];
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    onStatus?.(tests.length > 1 ? `Checking ${i + 1} of ${tests.length}…` : 'Checking…');
    const result = await compileAndRun(source, test.stdin ?? '', onStatus);
    const actual = result.compileFailed ? result.compileOutput : result.stdout;
    const passed =
      !result.compileFailed && !result.stderr.trim() && outputsMatch(result.stdout, test.stdout);
    cases.push({
      name: test.name,
      passed,
      expected: test.stdout,
      actual,
      compileFailed: result.compileFailed,
      stderr: result.stderr,
    });
  }
  return {
    passed: cases.filter((c) => c.passed).length,
    total: cases.length,
    cases,
  };
}
