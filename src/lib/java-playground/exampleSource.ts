import { hasMainMethod, publicClassName, withoutComments } from './sourceChecks';

export interface WrappedExample {
  source: string;
  entryClass: string;
  hasMain: boolean;
  wrapped: boolean;
}

const UTIL_TYPES = [
  'ArrayList',
  'LinkedList',
  'HashMap',
  'HashSet',
  'TreeMap',
  'TreeSet',
  'Scanner',
  'Queue',
  'Deque',
  'ArrayDeque',
  'PriorityQueue',
  'Collections',
  'Arrays',
  'Optional',
  'Objects',
  'Iterator',
  'List',
  'Map',
  'Set',
];

const FUNCTION_TYPES = [
  'Function',
  'Consumer',
  'Supplier',
  'Predicate',
  'BiFunction',
  'UnaryOperator',
  'BinaryOperator',
];

const CONCURRENT_TYPES = [
  'ExecutorService',
  'Executors',
  'Future',
  'CountDownLatch',
  'ConcurrentHashMap',
  'CopyOnWriteArrayList',
  'Semaphore',
  'ThreadPoolExecutor',
];

const ATOMIC_TYPES = ['AtomicInteger', 'AtomicBoolean', 'AtomicLong'];

/** Replace comments with spaces so regex indexes still match the original source. */
export function maskComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => ' '.repeat(block.length))
    .replace(/\/\/.*$/gm, (line) => ' '.repeat(line.length));
}

export function exampleNeedsStdin(source: string): boolean {
  const masked = maskComments(source);
  return /\bScanner\b/.test(masked) || /\bSystem\.in\b/.test(masked);
}

const READ_CALL = /\.(?:nextLine|nextInt|nextDouble|next|readLine)\s*\(/g;

function countReads(text: string): number {
  return (maskComments(text).match(READ_CALL) || []).length;
}

interface BraceBlock {
  start: number;
  end: number;
  body: string;
}

function extractBraceBlocks(source: string, headerRe: RegExp): BraceBlock[] {
  const masked = maskComments(source);
  const blocks: BraceBlock[] = [];
  const re = new RegExp(headerRe.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked))) {
    let i = match.index + match[0].length;
    while (i < masked.length && /\s/.test(masked[i] ?? '')) i += 1;
    if (masked[i] !== '{') continue;
    i += 1;
    const bodyStart = i;
    let depth = 1;
    while (i < masked.length && depth > 0) {
      if (masked[i] === '{') depth += 1;
      else if (masked[i] === '}') depth -= 1;
      if (depth === 0) break;
      i += 1;
    }
    blocks.push({ start: bodyStart, end: i, body: source.slice(bodyStart, i) });
    re.lastIndex = i + 1;
  }
  return blocks;
}

/** True when a while(true) would never exit (freezes the tab). */
export function exampleLooksNonterminating(source: string): boolean {
  if (/runs forever/i.test(source)) return true;
  for (const block of extractBraceBlocks(source, /while\s*\(\s*true\s*\)/g)) {
    const body = maskComments(block.body);
    const canStop =
      /\bbreak\b/.test(body) || /\breturn\b/.test(body) || countReads(block.body) > 0;
    if (!canStop) return true;
  }
  return false;
}

function stdinForLoopBody(body: string): string[] {
  const masked = maskComments(body);
  if (/\.equals(?:IgnoreCase)?\s*\(\s*"y"/i.test(masked)) {
    return ['n', 'y'];
  }
  if (/\.equals(?:IgnoreCase)?\s*\(\s*"(quit|exit)"/i.test(masked)) {
    return ['5', 'quit'];
  }
  const counted = masked.match(/\b(?:numbersRead|count|readCount)\s*==\s*(\d+)/);
  if (counted && /\bbreak\b/.test(masked)) {
    const n = Number(counted[1]);
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }
  if (/(?<![!=])==\s*999\b/.test(masked) && /\bbreak\b/.test(masked)) {
    const lines: string[] = [];
    if (/\bcontinue\b/.test(masked)) lines.push('-2');
    lines.push('15', '999');
    return lines;
  }
  if (/(?<![!=])==\s*-1\b/.test(masked) && /\bbreak\b/.test(masked)) {
    const lines = ['42'];
    if (/\bcontinue\b/.test(masked)) lines.push('150');
    lines.push('-1');
    return lines;
  }
  if (/(?<![!=])==\s*0\b/.test(masked) && /\bbreak\b/.test(masked)) {
    return ['4', '1', '0'];
  }
  if (/\bInteger\.(?:valueOf|parseInt)|parseInt\s*\(|\.nextInt\s*\(/.test(masked)) {
    return ['3', '0'];
  }
  return ['y'];
}

function sequentialStdinLines(source: string, count: number): string[] {
  const masked = maskComments(source);
  if (count <= 0) return [];
  if (/sensor index|0-3/.test(masked)) return ['1'];
  if (/How many robots|teamSize/.test(masked) && count >= 3) {
    return ['1', 'Spark', '3476'];
  }
  if (/\bInteger\.(?:valueOf|parseInt)|parseInt\s*\(|parseDouble|nextInt|nextDouble/.test(masked)) {
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }
  return Array.from({ length: count }, () => 'hello');
}

/**
 * Sample stdin so Scanner / System.in examples finish instead of throwing or hanging.
 */
export function suggestExampleStdin(source: string): string {
  if (!exampleNeedsStdin(source)) return '';
  const lines: string[] = [];
  const inputLoops = extractBraceBlocks(source, /while\s*\(\s*true\s*\)/g).filter(
    (block) => countReads(block.body) > 0,
  );

  if (inputLoops.length > 0) {
    const first = inputLoops[0];
    const before = source.slice(0, first.start);
    lines.push(...sequentialStdinLines(before, countReads(before)));
    for (const block of inputLoops) {
      lines.push(...stdinForLoopBody(block.body));
    }
  } else {
    lines.push(...sequentialStdinLines(source, countReads(source)));
  }

  if (lines.length === 0) return '';
  return `${lines.join('\n')}\n`;
}

/**
 * True when a fenced Java example is worth compiling in the browser.
 * Skips placeholders, comment-only blocks, and Git snippets tagged as java.
 */
export function looksLikeRunnableJava(source: string): boolean {
  if (/<code>|&lt;code/.test(source)) return false;
  if (exampleLooksNonterminating(source)) return false;
  const body = withoutComments(source).trim();
  if (!body) return false;
  if (/^\s*git\b/m.test(body) && !/\b(class|interface|enum)\s+[A-Za-z_]/.test(body)) {
    return false;
  }
  if (/\b(class|interface|enum)\s+[A-Za-z_]/.test(body)) return true;
  if (/\bSystem\.out\b/.test(body)) return true;
  if (hasTopLevelMember(body)) return true;
  if (!/;/.test(body)) return false;
  if (/\b(int|long|short|byte|double|float|boolean|char|void|String|var|if|for|while|do|switch|new|return|try|throw)\b/.test(body)) {
    return true;
  }
  return /\w+\s*\(.*\)\s*;/.test(body);
}

interface TypeDecl {
  kind: 'class' | 'interface' | 'enum';
  name: string;
  isPublic: boolean;
  index: number;
}

function findTypeDeclaration(source: string): TypeDecl | null {
  const masked = maskComments(source);
  const re =
    /(?:^|\n)[ \t]*(public\s+)?(?:(?:abstract|final|strictfp)\s+)*(class|interface|enum)\s+([A-Za-z_]\w*)/g;
  const match = re.exec(masked);
  if (!match) return null;
  const newline = match[0].startsWith('\n') ? 1 : 0;
  return {
    isPublic: Boolean(match[1]),
    kind: match[2] as TypeDecl['kind'],
    name: match[3],
    index: match.index + newline,
  };
}

function splitPreamble(source: string): { preamble: string; body: string } {
  const lines = source.split('\n');
  const maskedLines = maskComments(source).split('\n');
  let i = 0;
  while (i < lines.length) {
    const trimmed = maskedLines[i]?.trim() ?? '';
    if (
      trimmed === '' ||
      trimmed.startsWith('package ') ||
      trimmed.startsWith('import ')
    ) {
      i += 1;
      continue;
    }
    break;
  }
  return {
    preamble: lines.slice(0, i).join('\n'),
    body: lines.slice(i).join('\n'),
  };
}

function hasTopLevelMember(code: string): boolean {
  const stripped = withoutComments(code);
  let depth = 0;
  for (const line of stripped.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0 && trimmed && !isControlOrBlockStart(trimmed) && looksLikeMember(trimmed)) {
      return true;
    }
    for (const ch of line) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
  }
  return false;
}

function isControlOrBlockStart(trimmed: string): boolean {
  return /^(if|for|while|switch|catch|try|else|do|synchronized)\b/.test(trimmed);
}

function looksLikeMember(trimmed: string): boolean {
  if (
    /^(?:public|private|protected|static|final|native|synchronized|abstract|strictfp|default)\b/.test(
      trimmed,
    ) &&
    /\(.*\)\s*\{/.test(trimmed)
  ) {
    return true;
  }
  if (
    /^(?:public|private|protected|static|final)\b/.test(trimmed) &&
    /;\s*$/.test(trimmed) &&
    !trimmed.includes('(')
  ) {
    return true;
  }
  return false;
}

function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.replace(/^(?!\s*$)/gm, pad);
}

function joinParts(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n\n');
}

function usesType(masked: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(masked);
}

function ensureCommonImports(source: string): string {
  const masked = maskComments(source);
  const extras: string[] = [];
  if (!/import\s+java\.util\./.test(masked) && UTIL_TYPES.some((name) => usesType(masked, name))) {
    extras.push('import java.util.*;');
  }
  if (
    !/import\s+java\.util\.function\./.test(masked) &&
    FUNCTION_TYPES.some((name) => usesType(masked, name))
  ) {
    extras.push('import java.util.function.*;');
  }
  if (
    !/import\s+java\.util\.concurrent\./.test(masked) &&
    CONCURRENT_TYPES.some((name) => usesType(masked, name))
  ) {
    extras.push('import java.util.concurrent.*;');
  }
  if (
    !/import\s+java\.util\.concurrent\.atomic\./.test(masked) &&
    ATOMIC_TYPES.some((name) => usesType(masked, name))
  ) {
    extras.push('import java.util.concurrent.atomic.*;');
  }
  if (extras.length === 0) return source;
  const { preamble, body } = splitPreamble(source);
  return joinParts(preamble, extras.join('\n'), body) + '\n';
}

function wrapAsClassBody(preamble: string, body: string): WrappedExample {
  const innerHasMain = hasMainMethod(body);
  const source = ensureCommonImports(
    joinParts(preamble, `public class Main {\n${body.replace(/\s+$/, '')}\n}`) + '\n',
  );
  return {
    source,
    entryClass: 'Main',
    hasMain: innerHasMain,
    wrapped: true,
  };
}

function wrapAsStatements(preamble: string, body: string): WrappedExample {
  const source = ensureCommonImports(
    joinParts(
      preamble,
      [
        'public class Main {',
        '    public static void main(String[] args) {',
        indentBlock(body.replace(/\s+$/, ''), 8),
        '    }',
        '}',
      ].join('\n'),
    ) + '\n',
  );
  return {
    source,
    entryClass: 'Main',
    hasMain: true,
    wrapped: true,
  };
}

/**
 * Turn a lesson snippet into a compilation unit CheerpJ can run.
 * Full programs keep their class name; fragments are wrapped in Main.
 */
export function wrapExampleSource(raw: string): WrappedExample {
  const source = raw.replace(/\r\n/g, '\n');
  const { preamble, body } = splitPreamble(source);
  const type = findTypeDeclaration(body);

  if (type) {
    const leading = maskComments(body.slice(0, type.index)).trim();
    const unitBody = leading ? body.slice(type.index) : body;
    const unit = joinParts(preamble, unitBody) + (source.endsWith('\n') ? '\n' : '');
    const withImports = ensureCommonImports(unit.endsWith('\n') ? unit : `${unit}\n`);
    const publicName = publicClassName(withImports);
    const entryClass = publicName ?? type.name;
    const kind = findTypeDeclaration(withImports)?.kind ?? type.kind;
    return {
      source: withImports,
      entryClass,
      hasMain: kind === 'class' && hasMainMethod(withImports),
      wrapped: Boolean(leading),
    };
  }

  if (hasTopLevelMember(body)) {
    return wrapAsClassBody(preamble, body);
  }

  return wrapAsStatements(preamble, body);
}
