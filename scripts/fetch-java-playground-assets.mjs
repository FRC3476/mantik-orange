#!/usr/bin/env node
/**
 * Downloads Eclipse Compiler for Java (ECJ) into public/ so CheerpJ can
 * compile student code in the browser. Skips the download when a large
 * enough jar is already present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.resolve(__dirname, '../public/java-playground');
const dest = path.join(destDir, 'ecj.jar');
// 3.16.0 is Java 8 bytecode and does not need jrt-fs (CheerpJ has no Java 11 modules).
const ECJ_URL = 'https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.16.0/ecj-3.16.0.jar';
const MIN_BYTES = 500_000;
const force = process.argv.includes('--force');

if (!force && fs.existsSync(dest) && fs.statSync(dest).size >= MIN_BYTES) {
  console.log(`java-playground: using existing ${path.relative(process.cwd(), dest)}`);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
console.log('java-playground: downloading ECJ from Maven Central…');

const res = await fetch(ECJ_URL);
if (!res.ok) {
  throw new Error(`Failed to download ECJ: ${res.status} ${res.statusText} (${ECJ_URL})`);
}

const buf = Buffer.from(await res.arrayBuffer());
if (buf.byteLength < MIN_BYTES) {
  throw new Error(`ECJ download too small (${buf.byteLength} bytes)`);
}

fs.writeFileSync(dest, buf);
console.log(`java-playground: wrote ${path.relative(process.cwd(), dest)} (${buf.byteLength} bytes)`);
