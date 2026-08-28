export type JavaPlaygroundId = string;

export interface HiddenTest {
  name: string;
  stdin?: string;
  stdout: string;
}

export interface JavaPlaygroundExercise {
  id: JavaPlaygroundId;
  title: string;
  prompt: string;
  starter: string;
  showStdin: boolean;
  tests: HiddenTest[];
}

export interface RunResult {
  ok: boolean;
  compileFailed: boolean;
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Example compiled but has no main method, so nothing ran. */
  noMain?: boolean;
}

export interface CheckCaseResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  compileFailed: boolean;
  stderr: string;
}

export interface CheckResult {
  passed: number;
  total: number;
  cases: CheckCaseResult[];
}

export type StatusFn = (message: string) => void;
