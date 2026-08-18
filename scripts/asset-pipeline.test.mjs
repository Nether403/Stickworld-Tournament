import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stickworld-assets-'));
  return {
    root,
    write(path, contents) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.GEMINI_API_KEY;
  delete env.DEEPGRAM_API_KEY;
  return env;
}

function runScript(script, root, extraEnv = {}) {
  return spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', script), '--root', root], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...cleanEnv(), ...extraEnv },
  });
}

function runScriptAsync(script, root, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(REPO_ROOT, 'scripts', script), '--root', root], {
      cwd: REPO_ROOT,
      env: { ...cleanEnv(), ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function ledgerFor(path, contents, hash = createHash('sha256').update(contents).digest('hex')) {
  return [
    '# Asset provenance ledger',
    '',
    '| path | sha256 | class | prompt_id | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ${path} | ${hash} | human |  | Test asset |`,
    '',
  ].join('\n');
}

test('asset ledger accepts a complete matching public asset list', () => {
  const fx = fixture();
  try {
    const contents = '<svg></svg>\n';
    const path = 'apps/web/public/assets/brand/logo.svg';
    fx.write(path, contents);
    fx.write('docs/assets/ledger.md', ledgerFor(path, contents));

    const result = runScript('check-asset-ledger.mjs', fx.root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: verified 1 asset/);
  } finally {
    fx.cleanup();
  }
});

test('asset ledger rejects unlisted files and hash mismatches', () => {
  const fx = fixture();
  try {
    const path = 'apps/web/public/assets/brand/logo.svg';
    fx.write(path, '<svg></svg>\n');
    fx.write('apps/web/public/assets/brand/unlisted.svg', '<svg></svg>\n');
    fx.write('docs/assets/ledger.md', ledgerFor(path, '<different />\n'));

    const result = runScript('check-asset-ledger.mjs', fx.root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /hash mismatch/);
    assert.match(result.stderr, /unlisted asset/);
  } finally {
    fx.cleanup();
  }
});

test('asset ledger requires prompt provenance for generated assets', () => {
  const fx = fixture();
  try {
    const contents = 'generated';
    const path = 'apps/web/public/assets/badge.png';
    fx.write(path, contents);
    fx.write(
      'docs/assets/ledger.md',
      ledgerFor(path, contents).replace('| human |  |', '| generated |  |'),
    );

    const result = runScript('check-asset-ledger.mjs', fx.root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /generated asset must have a prompt_id/);
  } finally {
    fx.cleanup();
  }
});

test('asset build skips without provider keys and writes nothing', () => {
  const fx = fixture();
  try {
    fx.write(
      'docs/assets/prompts/ui-badges.yaml',
      'id: champion-badge\nprovider: gemini\nmodel: gemini-test\nclass_default: generated\nprompt: Original badge\n',
    );

    const result = runScript('assets-build.mjs', fx.root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skipped/i);
    assert.throws(() => readFileSync(join(fx.root, 'assets/generated/champion-badge.png')));
  } finally {
    fx.cleanup();
  }
});

test('asset build calls Gemini and writes only the generated output path', async () => {
  const fx = fixture();
  const requests = [];
  const image = Buffer.from('fake-png');
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push({ url: request.url, body });
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ inlineData: { data: image.toString('base64') } }] } },
          ],
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    fx.write(
      'docs/assets/prompts/ui-badges.yaml',
      [
        'id: champion-badge',
        'provider: gemini',
        'model: gemini-test',
        'class_default: generated',
        'prompt: |',
        '  Original geometric champion badge.',
        '',
      ].join('\n'),
    );
    const address = server.address();
    const result = await runScriptAsync('assets-build.mjs', fx.root, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_API_BASE_URL: `http://127.0.0.1:${address.port}/v1beta`,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(join(fx.root, 'assets/generated/champion-badge.png')), image);
    assert.match(result.stdout, /assets\/generated\/champion-badge\.png/);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /models\/gemini-test:generateContent\?key=test-key$/);
    assert.match(requests[0].body, /Original geometric champion badge/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fx.cleanup();
  }
});

test('asset build exits non-zero when a keyed Gemini request fails', async () => {
  const fx = fixture();
  const server = createServer((_request, response) => {
    response.statusCode = 503;
    response.end('unavailable');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    fx.write(
      'docs/assets/prompts/ui-badges.yaml',
      'id: champion-badge\nprovider: gemini\nmodel: gemini-test\nclass_default: generated\nprompt: Badge\n',
    );
    const address = server.address();
    const result = await runScriptAsync('assets-build.mjs', fx.root, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_API_BASE_URL: `http://127.0.0.1:${address.port}/v1beta`,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Gemini request failed \(503\)/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fx.cleanup();
  }
});

test('runtime AI guard detects exact banned hosts in built output', () => {
  const fx = fixture();
  try {
    fx.write('apps/web/.next/static/chunks/clean.js', 'accounts.google.com');
    fx.write('apps/web/.next/static/chunks/subdomain.js', 'notgenerativelanguage.googleapis.com');
    let result = runScript('check-no-runtime-ai.mjs', fx.root);
    assert.equal(result.status, 0, result.stderr);

    fx.write(
      'apps/web/.next/static/chunks/banned.js',
      'fetch("https://generativelanguage.googleapis.com/v1beta/models")',
    );
    result = runScript('check-no-runtime-ai.mjs', fx.root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /generativelanguage\.googleapis\.com/);
    assert.match(result.stderr, /banned\.js/);
  } finally {
    fx.cleanup();
  }
});
