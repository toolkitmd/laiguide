import { test, expect } from '@playwright/test';

test.describe('deployed site smoke checks', () => {
    test('custom CSS is applied', async ({ page }) => {
        await page.goto('/');

        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bodyBg).toBe('rgb(174, 207, 204)');

        await expect(page.locator('.app-container')).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
        );
    });

    test('protocol PDF is downloadable', async ({ page }) => {
        await page.goto('/');

        const href = await page.locator('.protocol-link a').getAttribute('href');
        const res = await page.request.get(new URL(href!, page.url()).toString());
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('application/pdf');
    });

    test('medication dropdown is populated', async ({ page }) => {
        await page.goto('/');

        const options = page.locator('#medication option');
        await expect(options).toHaveCount(12);

        const values = await page
            .locator('#medication option')
            .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
        expect(values).toContain('invega_sustenna');
        expect(values).toContain('aristada');
    });
});
