import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated WCAG 2.1 AA regression scan.
 *
 * Iterates over the main public and authenticated routes, runs axe-core,
 * and fails the suite if any serious or critical violation is detected.
 *
 * The test admin used for authenticated routes is created by
 * `scripts/create-test-admin.ts` (run once before this suite).
 */

const TEST_ADMIN_EMAIL = process.env.A11Y_TEST_EMAIL ?? "testadmin@e2e.test";
const TEST_ADMIN_PASSWORD = process.env.A11Y_TEST_PASSWORD ?? "TestAdmin123!";

const PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: "Landing", path: "/" },
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
  { name: "Forgot password", path: "/forgot-password" },
];

// NOTE: `/admin/migrations` intentionally omitted — its APIs require
// `global_admin`, while the seeded test user is a `company_admin`. Scanning it
// here would only exercise an unauthorized fallback state. If/when a global
// admin seed is added, include it here (and document in replit.md).
const AUTHED_ROUTES: Array<{ name: string; path: string }> = [
  { name: "Admin panel", path: "/admin" },
  { name: "Facilitator dashboard", path: "/dashboard" },
  { name: "My projects", path: "/projects" },
];

const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
];

const SEVERITIES_TO_FAIL = new Set(["serious", "critical"]);

async function scan(page: Page, routeName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .analyze();

  const blocking = results.violations.filter((v) =>
    SEVERITIES_TO_FAIL.has(v.impact ?? ""),
  );

  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 3)
          .map((n) => `      - ${n.target.join(" ")}`)
          .join("\n");
        return `  • [${v.impact}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
      })
      .join("\n");
    throw new Error(
      `Accessibility violations on ${routeName}:\n${summary}`,
    );
  }
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('[data-testid="input-email"]').fill(TEST_ADMIN_EMAIL);
  await page.locator('[data-testid="input-password"]').fill(TEST_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
    ),
    page.locator('button[type="submit"]').first().click(),
  ]);
  // Wait until we land on an authenticated route
  await page.waitForURL(/\/(dashboard|projects|o\/|admin)/, { timeout: 15_000 });
}

test.describe("Accessibility (axe-core) — public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) has no serious/critical a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await scan(page, `${route.name} (${route.path})`);
    });
  }
});

test.describe("Accessibility (axe-core) — authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of AUTHED_ROUTES) {
    test(`${route.name} (${route.path}) has no serious/critical a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await scan(page, `${route.name} (${route.path})`);
    });
  }
});

// Sanity check: verify axe is wired up correctly by ensuring at least one route
// runs and reports a violation count we can introspect.
test("axe-core is wired up", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(Array.isArray(results.violations)).toBe(true);
});
