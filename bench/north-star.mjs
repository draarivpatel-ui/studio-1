// North star: how much smaller Studio makes a batch of photos. 25 photos (3000x2000 JPEG, quality .92) resized to
// "Web 1200" in the browser; value is bytes before / bytes after (the shrink factor), the baseline is 1 (no change).
// Run: bun bench/north-star.mjs  (builds, measures in Chromium, writes bench/north-star.json)
import {chromium} from '@playwright/test';
import {spawn, execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {give, process as processBtn, done, setSize} from '../tests/helpers.js';

const PORT = 4174, N = 25;
execFileSync('bunx', ['vite', 'build'], {stdio: 'ignore'});
const server = spawn('bunx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {stdio: 'ignore'});
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/flisk\.(si|sh)\//, (r) => r.abort());
  await page.goto(`http://localhost:${PORT}/`);
  await give(page, Array.from({length: N}, (_, i) => ({name: `m${i}.jpg`, type: 'image/jpeg', w: 3000, h: 2000})));
  await setSize(page, 'Web 1200');
  await processBtn(page); await done(page).waitFor({timeout: 120000});
  const msg = await done(page).innerText();
  const m = msg.match(/(\d+) photo\(s\), (\d+) KB.+?(\d+) KB/);
  await browser.close();
  if (!m || +m[1] !== N) throw new Error('unexpected result message: ' + msg);
  const before = +m[2], after = +m[3];
  const out = {value: +(before / after).toFixed(2), baseline: 1, unit: 'x smaller', before_kb: before, after_kb: after, measuredAt: new Date().toISOString(), run: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : 'local'};
  writeFileSync(new URL('./north-star.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
} finally { server.kill(); }
