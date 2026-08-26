#!/usr/bin/env node
/* ===========================================================
   Lifetime Truegreen — set the client dashboard URL
   -----------------------------------------------------------
   Encrypts the Claude artifact URL under the shared client
   password and writes data/dashboard.json. Commit and push
   that file to publish it.

     node scripts/set-dashboard-url.mjs --url "https://claude.ai/public/artifacts/..."

   You will be prompted for the password (it is not echoed and
   does not land in your shell history). Requires Node 19+.
   =========================================================== */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import readline from 'node:readline';

// The shared crypto module targets the browser's global `crypto`.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const here = dirname(fileURLToPath(import.meta.url));
const { encryptUrl } = await import('../assets/js/dashboard-crypto.mjs');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > -1) out[arg.slice(2, eq)] = arg.slice(eq + 1);
    else out[arg.slice(2)] = argv[++i];
  }
  return out;
}

function promptHidden(question) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput.bind(rl);
    let shown = false;
    rl._writeToOutput = (s) => { if (!shown) { write(s); shown = true; } };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); res(answer); });
  });
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(`
Usage: node scripts/set-dashboard-url.mjs --url "<claude artifact url>" [options]

  --url       <url>    Claude public artifact URL to embed (required)
  --password  <text>   Shared client password (omit to be prompted — preferred)
  --date      <ISO>    "Updated" date shown to clients (default: today)
  --label     <text>   Optional plaintext label stored alongside the blob
`.trim());
  process.exit(0);
}

const url = args.url;
if (!url) {
  console.error('Error: --url is required. Run with --help for usage.');
  process.exit(1);
}
if (!/^https?:\/\//i.test(url)) {
  console.error('Error: --url must start with http:// or https://');
  process.exit(1);
}

const password = args.password || await promptHidden('Shared client password: ');
if (!password) {
  console.error('Error: a password is required.');
  process.exit(1);
}

const updatedAt = args.date || new Date().toISOString().slice(0, 10);

const payload = await encryptUrl(url, password, {
  updatedAt,
  ...(args.label ? { label: args.label } : {})
});

const target = resolve(here, '..', 'data', 'dashboard.json');
await writeFile(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(`\nWrote ${target}`);
console.log(`  updatedAt : ${updatedAt}`);
console.log(`  url       : encrypted (${payload.ciphertext.length} base64 chars, not stored in plaintext)`);
console.log('\nNext:  git add data/dashboard.json && git commit -m "Update client dashboard" && git push');
