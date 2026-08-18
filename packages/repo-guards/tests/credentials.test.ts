import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { isCredentialPath } from '../src/patterns.js';

function gitLsFiles(): string[] {
  const raw = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return raw
    .toString('utf8')
    .split('\0')
    .filter((line) => line.length > 0);
}

describe('credential-leak guard', () => {
  it('treats Credentials/, dotenv, and service-account JSON as leaks', () => {
    expect(isCredentialPath('Credentials/.env')).toBe(true);
    expect(isCredentialPath('Credentials/project-af3a95dd-1234-1234-1234-1234567890ab.json')).toBe(
      true,
    );
    expect(isCredentialPath('.env')).toBe(true);
    expect(isCredentialPath('.env.local')).toBe(true);
    expect(isCredentialPath('apps/web/.env.production')).toBe(true);
    expect(isCredentialPath('gcp-service-account.json')).toBe(true);
  });

  it('allows committed examples', () => {
    expect(isCredentialPath('.env.example')).toBe(false);
    expect(isCredentialPath('apps/web/.env.local.example')).toBe(false);
  });

  it('asserts git tracks no credential files', () => {
    const leaked = gitLsFiles().filter((file) => isCredentialPath(file));
    expect(leaked).toEqual([]);
  });
});
