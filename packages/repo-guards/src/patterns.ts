/** Paths that must never be tracked by git. */

const ENV_EXAMPLE = /(^|\/)\.env(\.[^/]+)?\.example$/;
const DOTENV = /(^|\/)\.env($|\.)/;
const CREDENTIALS_DIR = /(^|\/)[Cc]redentials\//;
const SERVICE_ACCOUNT =
  /(service-account|serviceaccount|gcp-.*\.json|application_default_credentials|gha-creds-)/i;
const PROJECT_UUID_JSON =
  /(^|\/)project-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*\.json$/i;

export function isCredentialPath(posixPath: string): boolean {
  const path = posixPath.replaceAll('\\', '/');
  if (ENV_EXAMPLE.test(path)) return false;
  if (CREDENTIALS_DIR.test(path)) return true;
  if (DOTENV.test(path)) return true;
  if (SERVICE_ACCOUNT.test(path) && path.endsWith('.json')) return true;
  if (PROJECT_UUID_JSON.test(path)) return true;
  return false;
}

export const RAPIER_PACKAGE = '@dimforge/rapier2d-compat';
export const RAPIER_VERSION = '0.20.0';

export function isForbiddenRapierName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('rapier') && (lower.includes('simd') || name === '@dimforge/rapier2d');
}

export function isRangedVersion(version: string): boolean {
  return /^\s*[\^~><=]|workspace:|catalog:/.test(version) || version.includes(' || ');
}

export function rapierPinError(
  name: string,
  version: string,
): string | undefined {
  if (isForbiddenRapierName(name)) {
    return `${name} is forbidden; use ${RAPIER_PACKAGE}@${RAPIER_VERSION} (non-SIMD -compat)`;
  }
  if (!/rapier/i.test(name)) return undefined;
  if (name !== RAPIER_PACKAGE) {
    return `unexpected Rapier package ${name}; pin ${RAPIER_PACKAGE}@${RAPIER_VERSION}`;
  }
  if (version !== RAPIER_VERSION || isRangedVersion(version)) {
    return `${name} must be an exact pin of ${RAPIER_VERSION}, got ${version}`;
  }
  return undefined;
}
