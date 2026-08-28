import { describe, expect, it } from 'vitest';
import {
  exampleNeedsStdin,
  looksLikeRunnableJava,
  wrapExampleSource,
} from './exampleSource';

describe('looksLikeRunnableJava', () => {
  it('accepts print snippets', () => {
    expect(
      looksLikeRunnableJava('System.out.println("Hello world!");'),
    ).toBe(true);
  });

  it('rejects comment-only blocks', () => {
    expect(
      looksLikeRunnableJava('// This is where your Java journey begins!\n// Next lesson'),
    ).toBe(false);
  });

  it('rejects exercise placeholders', () => {
    expect(looksLikeRunnableJava('Practice with these printing exercises:')).toBe(false);
  });

  it('rejects git snippets tagged as java', () => {
    expect(looksLikeRunnableJava('git branch feature-name\ngit checkout -b new-branch')).toBe(false);
  });
});

describe('wrapExampleSource', () => {
  it('wraps statements in Main.main', () => {
    const wrapped = wrapExampleSource('System.out.println("Hello world!");\n');
    expect(wrapped.entryClass).toBe('Main');
    expect(wrapped.hasMain).toBe(true);
    expect(wrapped.wrapped).toBe(true);
    expect(wrapped.source).toContain('public class Main');
    expect(wrapped.source).toContain('System.out.println("Hello world!");');
  });

  it('keeps a complete program class name', () => {
    const src = `public class MyProgram {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.entryClass).toBe('MyProgram');
    expect(wrapped.hasMain).toBe(true);
    expect(wrapped.wrapped).toBe(false);
    expect(wrapped.source).toContain('public class MyProgram');
  });

  it('does not invent a main for a class-only example', () => {
    const src = `public class TeamMember {
    private String name;
    public TeamMember(String memberName) {
        this.name = memberName;
    }
}`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.entryClass).toBe('TeamMember');
    expect(wrapped.hasMain).toBe(false);
    expect(wrapped.source).not.toContain('void main');
  });

  it('wraps top-level methods in Main', () => {
    const src = `public static void greet(String name) {
    System.out.println("Hello, " + name + "!");
}

public static void main(String[] args) {
    greet("Robot");
}`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.entryClass).toBe('Main');
    expect(wrapped.hasMain).toBe(true);
    expect(wrapped.source).toContain('public class Main');
    expect(wrapped.source).toContain('greet("Robot");');
  });

  it('runs the complete class when a dump also has leading methods', () => {
    const src = `public static void greet(String name) {
    System.out.println("Hello, " + name + "!");
}

public class RobotProgram {
    public static void main(String[] args) {
        System.out.println("ready");
    }
}`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.entryClass).toBe('RobotProgram');
    expect(wrapped.hasMain).toBe(true);
    expect(wrapped.source).toContain('public class RobotProgram');
    expect(wrapped.source).not.toContain('public static void greet');
  });

  it('adds java.util imports for collection snippets', () => {
    const src = `ArrayList<Integer> integers = new ArrayList<>();
integers.add(15);
System.out.println(integers.size());`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.source).toContain('import java.util.*;');
    expect(wrapped.source).toContain('ArrayList<Integer>');
  });

  it('keeps existing imports at the top', () => {
    const src = `import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        System.out.println(2);
    }
}`;
    const wrapped = wrapExampleSource(src);
    expect(wrapped.entryClass).toBe('Main');
    expect(wrapped.source.startsWith('import java.io.*;')).toBe(true);
  });
});

describe('exampleNeedsStdin', () => {
  it('detects Scanner and System.in', () => {
    expect(exampleNeedsStdin('Scanner scanner = new Scanner(System.in);')).toBe(true);
    expect(exampleNeedsStdin('System.out.println(1);')).toBe(false);
  });
});
