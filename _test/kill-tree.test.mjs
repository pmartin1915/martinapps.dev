import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { killTree } from './site-check.mjs';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// A parent that starts a grandchild, like Chrome's browser process starting its renderers.
test('killTree ends the whole process tree, not only the child', async () => {
  const grand = "setInterval(() => {}, 1000)";
  const parentSrc = `const { spawn } = require('node:child_process'); const g = spawn(process.execPath, ['-e', ${JSON.stringify(grand)}], { stdio: 'ignore' }); console.log(g.pid); setInterval(() => {}, 1000);`;
  const parent = spawn(process.execPath, ['-e', parentSrc], { stdio: ['ignore', 'pipe', 'ignore'] });
  const gpid = await new Promise((res) => parent.stdout.once('data', (b) => res(Number(String(b).trim()))));
  assert.ok(alive(parent.pid) && alive(gpid));
  killTree(parent);
  for (let i = 0; i < 30 && (alive(parent.pid) || alive(gpid)); i++) await sleep(100);
  assert.equal(alive(parent.pid), false, 'parent still running');
  assert.equal(alive(gpid), false, 'grandchild leaked');
});

test('killTree on an already-exited or missing child is a no-op', async () => {
  killTree(undefined);
  const c = spawn(process.execPath, ['-e', '0'], { stdio: 'ignore' });
  await new Promise((r) => c.on('exit', r));
  killTree(c);
});
