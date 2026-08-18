import { expect, test } from '@playwright/test';

test('catalogue lists Hookline, Pickaxe, Launch Lab, and Archery live, not Test Chamber', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hookline Sprint' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pickaxe Ascent' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Launch Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ragdoll Archery Rush' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice' }).first()).toBeVisible();
  await expect(page.getByText('Test Chamber')).toHaveCount(0);
});

test('auth offers Google and email, not GitHub', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByRole('button', { name: /GitHub/i })).toHaveCount(0);
  await expect(page.getByText(/Continue with GitHub/i)).toHaveCount(0);
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
