import { expect, test, type Locator } from '@playwright/test';

const BANNED_AI_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'api.deepgram.com',
  'openrouter.ai',
]);

async function expectWithinViewport(locator: Locator) {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
}

test('catalogue lists live games through Demolition Dive, not Test Chamber', async ({ page }) => {
  await page.goto('/');
  const logo = page.getByAltText('Stickworld Tournament logo');
  const wordmark = page.getByAltText('Stickworld Tournament wordmark');
  await expect(logo).toBeVisible();
  await expect(wordmark).toBeVisible();
  await expectWithinViewport(logo);
  await expectWithinViewport(wordmark);
  await expect(page.getByRole('heading', { name: 'Hookline Sprint' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pickaxe Ascent' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Launch Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ragdoll Archery Rush' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hammer Throw Havoc' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pogo Tower' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rooftop Relay' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balance Bike Blitz' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cargo Chaos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demolition Dive' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice' }).first()).toBeVisible();
  await expect(page.getByText('Test Chamber')).toHaveCount(0);
});

test('auth offers Google and email, not GitHub', async ({ page }) => {
  await page.goto('/auth/sign-in');
  const logo = page.getByAltText('Stickworld Tournament logo');
  const wordmark = page.getByAltText('Stickworld Tournament wordmark');
  await expect(logo).toBeVisible();
  await expect(wordmark).toBeVisible();
  await expectWithinViewport(logo);
  await expectWithinViewport(wordmark);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  const ageConfirmation = page.getByRole('checkbox', { name: 'I am 13 or older' });
  await expect(ageConfirmation).toBeVisible();
  await expect(ageConfirmation).toHaveAttribute('required', '');
  await expect(page.getByText(/continue with Google.*13 or older/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /GitHub/i })).toHaveCount(0);
  await expect(page.getByText(/Continue with GitHub/i)).toHaveCount(0);
});

test('legal page publishes age, UGC, privacy, prize, and operator terms', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal and community terms' })).toBeVisible();
  await expect(page.getByText(/13 or older/i)).toBeVisible();
  await expect(page.getByText(/user-generated content/i)).toBeVisible();
  await expect(page.getByText(/export.*delete/i)).toBeVisible();
  await expect(page.getByText(/no prizes/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /operator@/i })).toBeVisible();
});

test('security headers allow Hookline practice while denying framing and device access', async ({
  page,
}) => {
  const response = await page.goto('/play/hookline-sprint');
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response?.headers()['permissions-policy']).toContain('camera=()');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).toContain('accounts.google.com');
  expect(csp).not.toMatch(/generativelanguage|deepgram|openrouter/i);
  await expect(page.getByTestId('hookline-stage')).toBeVisible();
});

test('moderation routes are non-leaky without a moderator session', async ({ request }) => {
  const list = await request.get('/v1/moderation/reports?status=open');
  expect(list.status()).toBe(404);
  const action = await request.post(
    '/v1/moderation/reports/00000000-0000-0000-0000-000000000000/action',
    {
      data: { action: 'dismiss', reason_code: 'test', reason_text: 'test' },
    },
  );
  expect(action.status()).toBe(404);
});

test('guest report requests do not require a session', async ({ request }) => {
  test.skip(
    !process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED,
    'report request shape requires the integration database',
  );
  const res = await request.post('/v1/reports', {
    data: {
      targetUserId: '00000000-0000-0000-0000-000000000000',
      reason_code: 'other',
      details: 'request-shape check',
    },
  });
  expect(res.status()).toBe(404);
  expect(res.status()).not.toBe(401);
});

test('ranked issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/hookline-sprint/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
  const body = (await res.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe('UNAUTHENTICATED');
});

test('ranked Launch Lab issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/launch-lab/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('practice play shows instructions and does not fetch Pickaxe', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/hookline-sprint');
  await expect(page.getByTestId('instructions')).toContainText('Hold to attach');
  await expect(page.getByTestId('instructions')).toContainText('chevron');
  await expect(page.getByTestId('hookline-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /pickaxe/i.test(url))).toBe(false);
  expect(requested.some((url) => /launch-lab/i.test(url))).toBe(false);
  expect(requested.filter((url) => BANNED_AI_HOSTS.has(new URL(url).hostname))).toEqual([]);
});

test('Pickaxe practice does not fetch Hookline client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/pickaxe-ascent');
  await expect(page.getByTestId('instructions')).toContainText('Hold to bite');
  await expect(page.getByTestId('pickaxe-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /hookline/i.test(url))).toBe(false);
});

test('Launch Lab practice does not fetch Hookline or Pickaxe clients', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/launch-lab');
  await expect(page.getByTestId('instructions')).toContainText('Drag to set aim');
  await expect(page.getByTestId('launch-lab-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /hookline/i.test(url))).toBe(false);
  expect(requested.some((url) => /pickaxe/i.test(url))).toBe(false);
});

test('Archery practice does not fetch Launch Lab client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/ragdoll-archery-rush');
  await expect(page.getByTestId('instructions')).toContainText('Aim from the torso');
  await expect(page.getByTestId('archery-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /launch-lab/i.test(url))).toBe(false);
});

test('ranked Hammer issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/hammer-throw-havoc/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('Hammer practice does not fetch Archery client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/hammer-throw-havoc');
  await expect(page.getByTestId('instructions')).toContainText('Hold D or Right to spin');
  await expect(page.getByTestId('hammer-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /ragdoll-archery/i.test(url))).toBe(false);
});

test('ranked Pogo issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/pogo-tower/attempts', {
    data: { seedPolicy: 'weekly-seed' },
  });
  expect(res.status()).toBe(401);
});

test('Pogo practice does not fetch Hammer client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/pogo-tower');
  await expect(page.getByTestId('instructions')).toContainText('Auto-bounce on ledges');
  await expect(page.getByTestId('pogo-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /hammer-throw/i.test(url))).toBe(false);
});

test('ranked Rooftop issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/rooftop-relay/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('Rooftop practice does not fetch Pogo client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/rooftop-relay');
  await expect(page.getByTestId('instructions')).toContainText('Hold Right to run');
  await expect(page.getByTestId('rooftop-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /pogo-tower/i.test(url))).toBe(false);
});

test('Bike practice does not fetch Rooftop client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/balance-bike-blitz');
  await expect(page.getByTestId('instructions')).toContainText('Hold Right to throttle');
  await expect(page.getByTestId('bike-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /rooftop-relay/i.test(url))).toBe(false);
});

test('Cargo practice does not fetch Bike client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/cargo-chaos');
  await expect(page.getByTestId('instructions')).toContainText('Aim with the pointer');
  await expect(page.getByTestId('cargo-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /balance-bike/i.test(url))).toBe(false);
});

test('ranked Demolition issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/demolition-dive/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('Demolition practice does not fetch Cargo client', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (req) => {
    requested.push(req.url());
  });
  await page.goto('/play/demolition-dive');
  await expect(page.getByTestId('instructions')).toContainText('Drag to aim from the gantry');
  await expect(page.getByTestId('demolition-stage')).toBeVisible();
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });
  expect(requested.some((url) => /cargo-chaos/i.test(url))).toBe(false);
});
