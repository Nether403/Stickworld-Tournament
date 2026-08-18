import { expect, test, type Locator } from '@playwright/test';

const BANNED_AI_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'api.deepgram.com',
  'openrouter.ai',
]);

const PLAY_GAMES = [
  {
    slug: 'hookline-sprint',
    stageTestId: 'hookline-stage',
    instruction: 'Hold to attach',
  },
  {
    slug: 'pickaxe-ascent',
    stageTestId: 'pickaxe-stage',
    instruction: 'Hold to bite',
  },
  {
    slug: 'launch-lab',
    stageTestId: 'launch-lab-stage',
    instruction: 'Drag to set aim',
  },
  {
    slug: 'ragdoll-archery-rush',
    stageTestId: 'archery-stage',
    instruction: 'Aim from the torso',
  },
  {
    slug: 'hammer-throw-havoc',
    stageTestId: 'hammer-stage',
    instruction: 'Hold D or Right to spin',
  },
  {
    slug: 'pogo-tower',
    stageTestId: 'pogo-stage',
    instruction: 'Auto-bounce on ledges',
  },
  {
    slug: 'rooftop-relay',
    stageTestId: 'rooftop-stage',
    instruction: 'Hold Right to run',
  },
  {
    slug: 'balance-bike-blitz',
    stageTestId: 'bike-stage',
    instruction: 'Hold Right to throttle',
  },
  {
    slug: 'cargo-chaos',
    stageTestId: 'cargo-stage',
    instruction: 'Aim with the pointer',
  },
  {
    slug: 'demolition-dive',
    stageTestId: 'demolition-stage',
    instruction: 'Drag to aim from the gantry',
  },
] as const;

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

test(
  'catalogue lists live games through Demolition Dive, not Test Chamber',
  { tag: '@cross-browser' },
  async ({ page }) => {
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
  },
);

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

test(
  'practice play shows instructions and does not fetch Pickaxe',
  { tag: '@cross-browser' },
  async ({ page }) => {
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
  },
);

test('every play route excludes the other nine game client fragments', async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') throw new Error('Playwright baseURL is required');

  for (const game of PLAY_GAMES) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const requested: string[] = [];
    page.on('request', (request) => {
      requested.push(request.url());
    });

    try {
      await page.goto(`/play/${game.slug}`);
      await expect(page.getByTestId('instructions')).toContainText(game.instruction);
      await expect(page.getByTestId(game.stageTestId)).toBeVisible();
      await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 60_000 });

      for (const other of PLAY_GAMES) {
        if (other.slug === game.slug) continue;
        expect(
          requested.some((url) => url.toLowerCase().includes(other.slug)),
          `/play/${game.slug} requested @stickworld/game-${other.slug}`,
        ).toBe(false);
      }
    } finally {
      await context.close();
    }
  }
});

test('ranked Hammer issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/hammer-throw-havoc/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('ranked Pogo issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/pogo-tower/attempts', {
    data: { seedPolicy: 'weekly-seed' },
  });
  expect(res.status()).toBe(401);
});

test('ranked Rooftop issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/rooftop-relay/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});

test('ranked Demolition issue without a session is 401', async ({ request }) => {
  const res = await request.post('/v1/games/demolition-dive/attempts', {
    data: { seedPolicy: 'fixed-course' },
  });
  expect(res.status()).toBe(401);
});
