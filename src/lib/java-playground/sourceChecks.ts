/** Strip block and line comments; lengths are not preserved. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

/** Public class name from source, ignoring comments. */
export function publicClassName(source: string): string | null {
  const match = withoutComments(source).match(/\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  return match ? match[1] : null;
}

export function hasMainMethod(source: string): boolean {
  return /\bstatic\s+void\s+main\s*\(\s*String/.test(withoutComments(source));
}

/**
 * Playground compiles Main.java, matching the local `javac Main.java` / `java Main` flow.
 * Returns an error message, or null when the source is usable.
 */
export function assertPublicMain(source: string): string | null {
  const stripped = withoutComments(source);
  const name = stripped.match(/\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/)?.[1] ?? null;
  if (name !== 'Main') {
    if (!name) {
      return 'This playground expects a public class named Main, with a main method. Add: public class Main';
    }
    return `This playground expects public class Main (found ${name}). Rename the class to Main so it matches Main.java.`;
  }
  if (!hasMainMethod(source)) {
    return 'Add a main method: public static void main(String[] args)';
  }
  return null;
}
