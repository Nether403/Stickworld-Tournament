#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROMPTS = 'docs/assets/prompts';
const GENERATED = 'assets/generated';
const CLASSES = new Set(['generated', 'generated-then-human-edited']);

function rootFromArgs(args) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1) return DEFAULT_ROOT;
  if (!args[rootIndex + 1]) throw new Error('--root requires a directory');
  return args[rootIndex + 1];
}

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parsePromptYaml(contents, path) {
  const result = {};
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([a-z_]+):(?:\s*(.*))?$/.exec(line);
    if (!match) throw new Error(`${path}:${index + 1}: unsupported YAML syntax`);
    const [, key, rawValue = ''] = match;
    if (rawValue === '|' || rawValue === '|-' || rawValue === '>' || rawValue === '>-') {
      const block = [];
      while (index + 1 < lines.length && (/^\s+/.test(lines[index + 1]) || !lines[index + 1])) {
        index += 1;
        block.push(lines[index].replace(/^ {2}/, ''));
      }
      result[key] = block.join(rawValue.startsWith('>') ? ' ' : '\n').trim();
    } else {
      result[key] = unquote(rawValue.trim());
    }
  }

  for (const key of ['id', 'provider', 'model', 'class_default', 'prompt']) {
    if (!result[key]) throw new Error(`${path}: missing ${key}`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(result.id)) {
    throw new Error(`${path}: id must contain lowercase letters, numbers, and hyphens`);
  }
  if (!CLASSES.has(result.class_default)) {
    throw new Error(`${path}: class_default must be generated or generated-then-human-edited`);
  }
  if (result.provider !== 'gemini' && result.provider !== 'deepgram') {
    throw new Error(`${path}: unsupported provider ${result.provider}`);
  }
  return result;
}

async function responseFailure(provider, response) {
  const details = (await response.text()).slice(0, 500);
  throw new Error(
    `${provider} request failed (${response.status})${details ? `: ${details}` : ''}`,
  );
}

async function generateGemini(prompt) {
  const base = (
    process.env.GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/$/, '');
  const url = `${base}/models/${encodeURIComponent(prompt.model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!response.ok) await responseFailure('Gemini', response);
  const payload = await response.json();
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const image = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const data = image?.inlineData?.data ?? image?.inline_data?.data;
  if (!data) throw new Error(`Gemini returned no image for ${prompt.id}`);
  return { bytes: Buffer.from(data, 'base64'), extension: 'png' };
}

async function generateDeepgram(prompt) {
  const base = (process.env.DEEPGRAM_API_BASE_URL ?? 'https://api.deepgram.com/v1').replace(
    /\/$/,
    '',
  );
  const url = `${base}/speak?model=${encodeURIComponent(prompt.model)}&encoding=opus&container=ogg`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: prompt.prompt }),
  });
  if (!response.ok) await responseFailure('Deepgram', response);
  return { bytes: Buffer.from(await response.arrayBuffer()), extension: 'ogg' };
}

async function main() {
  if (!process.env.GEMINI_API_KEY && !process.env.DEEPGRAM_API_KEY) {
    console.log('skipped: GEMINI_API_KEY and DEEPGRAM_API_KEY are not set');
    return;
  }

  const root = rootFromArgs(process.argv.slice(2));
  const promptRoot = join(root, PROMPTS);
  const files = readdirSync(promptRoot)
    .filter((file) => file.endsWith('.yaml'))
    .sort();
  if (!files.length) throw new Error(`${PROMPTS} contains no YAML prompts`);

  for (const file of files) {
    const prompt = parsePromptYaml(
      readFileSync(join(promptRoot, file), 'utf8'),
      `${PROMPTS}/${file}`,
    );
    const key =
      prompt.provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.DEEPGRAM_API_KEY;
    if (!key) {
      console.log(
        `skipped ${prompt.id}: ${prompt.provider === 'gemini' ? 'GEMINI_API_KEY' : 'DEEPGRAM_API_KEY'} is not set`,
      );
      continue;
    }
    const generated =
      prompt.provider === 'gemini' ? await generateGemini(prompt) : await generateDeepgram(prompt);
    const output = join(root, GENERATED, `${prompt.id}.${generated.extension}`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, generated.bytes);
    console.log(relative(root, output).replaceAll('\\', '/'));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
