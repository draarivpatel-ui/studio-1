import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check} from './autofix-policy.mjs';

const diff = (path, added = ['const a = 1;'], removed = []) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n` + removed.map((l) => '-' + l).join('\n') + (removed.length ? '\n' : '') + added.map((l) => '+' + l).join('\n') + '\n';

test('a small fix in src with a test is allowed', () => assert.deepEqual(check(diff('src/engine.js') + diff('tests/studio.spec.js')), []));
test('no test, no merge', () => assert.match(check(diff('src/engine.js')).join(), /no test/));
test('workflows, deps, html and config are never changed automatically', () => {
  for (const p of ['.github/workflows/ci.yml', 'package.json', 'bun.lock', 'index.html', 'wrangler.toml', 'scripts/x.mjs', 'mcp/server.js', 'public/icon.svg'])
    assert.match(check(diff(p) + diff('tests/a.spec.js')).join(), /never changed automatically/, p);
});
test('files outside src and tests are refused', () => assert.match(check(diff('README.md') + diff('tests/a.spec.js')).join(), /outside src/));
test('code that talks to a network is refused', () => {
  for (const l of ["await fetch('/x')", "navigator.sendBeacon('/x')", "new WebSocket('wss://a')", "eval('1')", "const u = 'https://evil.example/x'", '<script src=x>'])
    assert.match(check(diff('src/App.jsx', [l]) + diff('tests/a.spec.js')).join(), /privacy rule/, l);
});
test('flisk.si links are fine', () => assert.deepEqual(check(diff('src/App.jsx', ["const h = 'https://flisk.si/';"]) + diff('tests/a.spec.js')), []));
test('big changes wait for a human', () => assert.match(check(diff('src/engine.js', Array(130).fill('x();')) + diff('tests/a.spec.js')).join(), /more than the 120/));
test('an empty diff is refused', () => assert.match(check('').join(), /changes nothing/));
