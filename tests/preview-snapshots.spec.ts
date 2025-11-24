import { test, expect, type Page } from '@playwright/test';
import { addWidgetFromPalette, bootstrapEditor, normalizeMarkup } from './helpers/editor';

async function ensureInlinePreview(page: Page) {
    const toggle = page.getByRole('button', { name: /Editing|Displaying/i });
    await toggle.click();
    await expect(page.locator('iframe[title="Page preview"]')).toBeVisible();
}

test('snapshot coverage for inline preview and popup preview', async ({ page }) => {
    await bootstrapEditor(page, 'Preview snapshot project');

    await addWidgetFromPalette(page, 'text');
    await addWidgetFromPalette(page, 'image');

    await ensureInlinePreview(page);
    const inlineMarkup = await page.getByTestId('viewport-surface').innerHTML();
    expect(normalizeMarkup(inlineMarkup)).toMatchSnapshot('inline-preview.html');

    const [popup] = await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('button', { name: 'Preview Page' }).click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForSelector('#__preview_root > *');
    const popupMarkup = await popup.locator('#__preview_root').innerHTML();
    expect(normalizeMarkup(popupMarkup)).toMatchSnapshot('popup-preview.html');
    await popup.close();
});
