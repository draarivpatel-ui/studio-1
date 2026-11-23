// The rules an automatic fix must pass before it may merge. No model is involved here: this is plain code.
// Usage: node scripts/autofix-policy.mjs <diff-file>   (a unified diff from `git diff`)
// Exit 0 = allowed, 1 = not allowed (a human looks at it).
import {readFileSync} from 'node:fs';

export const MAX_CHANGED_LINES = 120;
const ALLOWED = [/^src\//, /^tests\//];
// Never changed automatically: how the site loads, builds, deploys, or what runs in CI.
const BLOCKED = [/^index\.html$/, /^public\//, /^package\.json$/, /^bun\.lock$/, /^wrangler\.toml$/, /^vite\.config\./, /^playwright\.config\./, /^\.github\//, /^scripts\//, /^mcp\//, /^LICENSE$/];
// The product promise is that files never leave the computer. Added code may not talk to a network or run strings as code.
const FORBIDDEN = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /\beval\s*\(/, /new Function\s*\(/, /<script/i, /https?:\/\/(?!flisk\.si|github\.com\/flisk-sh)/];

export function parseDiff(text) {
  const files = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (m) { cur = {path: m[2], added: [], removed: 0}; files.push(cur); continue; }
    if (!cur) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) cur.added.push(line.slice(1));
    else if (line.startsWith('-') && !line.startsWith('---')) cur.removed++;
  }
  return files;
}

export function check(diffText) {
  const files = parseDiff(diffText); const problems = [];
  if (!files.length) return ['The fix changes nothing.'];
  for (const f of files) {
    if (BLOCKED.some((r) => r.test(f.path))) problems.push(`${f.path}: this file is never changed automatically`);
    else if (!ALLOWED.some((r) => r.test(f.path))) problems.push(`${f.path}: outside src/ and tests/`);
    if (f.path.startsWith('src/')) for (const l of f.added) { const hit = FORBIDDEN.find((r) => r.test(l)); if (hit) problems.push(`${f.path}: added line breaks the privacy rule (${hit}): ${l.trim().slice(0, 80)}`); }
  }
  const total = files.reduce((n, f) => n + f.added.length + f.removed, 0);
  if (total > MAX_CHANGED_LINES) problems.push(`${total} changed lines is more than the ${MAX_CHANGED_LINES} allowed`);
  if (!files.some((f) => f.path.startsWith('tests/') && f.added.length)) problems.push('no test was added for the fix');
  return problems;
}

if (process.argv[1] && process.argv[1].endsWith('autofix-policy.mjs') && process.argv[2]) {
  const problems = check(readFileSync(process.argv[2], 'utf8'));
  if (problems.length) { console.log('NOT AUTO-MERGEABLE:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('Allowed to auto-merge.');
}
