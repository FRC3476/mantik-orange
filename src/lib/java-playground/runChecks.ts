import { compileAndRunCases } from './cheerpjRunner';
import { outputsMatch } from './compareOutput';
import type { CheckResult, HiddenTest, StatusFn } from './types';

export async function runHiddenTests(
  source: string,
  tests: HiddenTest[],
  onStatus?: StatusFn,
): Promise<CheckResult> {
  const results = await compileAndRunCases(
    source,
    tests.map((test) => test.stdin ?? ''),
    onStatus,
  );

  const cases = tests.map((test, i) => {
    const result = results[i] ?? results[0];
    const actual = result.compileFailed ? result.compileOutput : result.stdout;
    const passed =
      !result.compileFailed && !result.stderr.trim() && outputsMatch(result.stdout, test.stdout);
    return {
      name: test.name,
      passed,
      expected: test.stdout,
      actual,
      compileFailed: result.compileFailed,
      stderr: result.stderr,
    };
  });

  return {
    passed: cases.filter((c) => c.passed).length,
    total: cases.length,
    cases,
  };
}
