import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const original = fileURLToPath(new URL('./cards.mjs', import.meta.url));
for (const scenario of ['offline', 'retry', 'invalid-response', 'missing-token']) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-cards-test-'));
  try {
    fs.mkdirSync(path.join(temp, '.build'));
    fs.copyFileSync(original, path.join(temp, '.build/cards.mjs'));
    fs.writeFileSync(path.join(temp, 'index.html'), '<h1>Reel</h1>');
    const mock = scenario === 'offline'
      ? `globalThis.fetch = async () => { throw new Error('network down'); };`
      : scenario === 'invalid-response'
        ? `globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: 'bad response' }) });`
      : scenario === 'retry'
        ? `let calls = 0; globalThis.fetch = async () => ++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => [{username:'tester',name:'Test User',films:2,fav:[]}] };`
        : `globalThis.fetch = () => { throw new Error('Must not fetch without token'); };`;
    execFileSync(process.execPath, ['--input-type=module', '-e', `${mock} await import(${JSON.stringify(pathToFileURL(path.join(temp, '.build/cards.mjs')).href)});`], {
      env: { ...process.env, REEL_CARDS_TOKEN: scenario === 'missing-token' ? '' : 'fixture-token' }, stdio: 'pipe'
    });
    assert.equal(fs.readFileSync(path.join(temp, '_site/index.html'), 'utf8'), '<h1>Reel</h1>');
    if (scenario === 'retry') assert(fs.readFileSync(path.join(temp, '_site/@tester/index.html'), 'utf8').includes('Test User on Reel'));
    console.log('PASS profile preview build:', scenario);
  } finally {
    if (path.dirname(temp) === os.tmpdir() && path.basename(temp).startsWith('reel-cards-test-')) fs.rmSync(temp, { recursive: true, force: true });
  }
}
