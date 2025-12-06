import { test, expect } from '@playwright/test';
import { bootstrapEditor, addWidgetFromPalette } from './helpers/editor';

test('quick page switch does not lose newly added widget', async ({ page }) => {
    await bootstrapEditor(page);
    // Add a widget to current page and immediately switch to a new page
    await addWidgetFromPalette(page, 'text');
    // Immediately click new page (without additional waits)
    await page.getByRole('button', { name: 'New page' }).click();
    // Switch back to the previous page via page settings
    const pageSettings = page.locator('div:has-text("Page Settings")');
    const select = pageSettings.locator('select');
    // Select the first page (index 0)
    await select.selectOption({ index: 0 });
    // Verify that the widget added earlier is visible (we expect at least one widget on the page)
    const widgetCount = await page.locator('[data-widget-id]').count();
    expect(widgetCount).toBeGreaterThan(0);
});
