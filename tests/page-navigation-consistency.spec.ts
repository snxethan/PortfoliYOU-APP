import { test, expect } from '@playwright/test';
import { bootstrapEditor, addWidgetFromPalette, openWidgetSettingsModal, ensureWidgetPropertiesOpen, setWidgetName } from './helpers/editor';

// This E2E test creates several pages with unique Text widget content, flips through them
// in different orders, deletes and re-creates pages, and asserts that the correct content
// remains visible on the currently selected page.
test('pages retain correct widget content when navigating, creating, deleting pages', async ({ page }) => {
    await bootstrapEditor(page);
    // Ensure we're on the editor
    await expect(page.getByTestId('grid-canvas')).toBeVisible();

    // Helper to rename current page using inline editor
    async function renameCurrentPage(name: string) {
        const pageSettings = page.locator('div:has-text("Page Settings")');
        await pageSettings.getByRole('button', { name: 'Rename page' }).click();
        const input = pageSettings.getByPlaceholder('Page name');
        await expect(input).toBeVisible();
        await input.fill(name);
        await pageSettings.locator('button.btn.btn-accent').first().click();
        // We don't explicitly assert the select here — subsequent steps will check
        // that selecting the page yields the expected widget content.
    }

    // Ensure Widgets palette is visible (toggle if needed)
    try {
        if (!(await page.getByTestId('palette-tile-text').isVisible())) {
            const expandBtn = page.getByLabel('Expand widget sidebar');
            if (await expandBtn.isVisible()) {
                await expandBtn.click();
            }
            const widgetsToggle = page.locator('button:has-text("Widgets")');
            if (await widgetsToggle.isVisible()) await widgetsToggle.click();
            await page.waitForTimeout(200);
        }
    } catch (err) { /* ignore if not found */ }

    // Create Page A (rename the default page)
    await renameCurrentPage('Page A');
    // Add a Text widget and set the content
    // Add text widget (try UI palette first, else dispatch event to force-add)
    async function addTextWidget() {
        try {
            return await addWidgetFromPalette(page, 'text');
        } catch (err) {
            // Fallback: dispatch a global add event - this is what palette does on Enter
            const before = await page.locator('[data-widget-id]').count();
            await page.evaluate(() => {
                try {
                    window.dispatchEvent(new CustomEvent('py:addWidget', { detail: { type: 'text', label: 'Text', w: 4, h: 3 } }));
                } catch { /* ignore */ }
            });
            // Wait until a new widget appears (in case it gets added off-screen)
            await page.waitForFunction((b) => {
                return document.querySelectorAll('[data-widget-id]').length >= (b + 1);
            }, before, { polling: 200, timeout: 10000 });
            const widget = page.locator('[data-widget-id]').last();
            return widget;
        }
    }

    await addTextWidget();
    const widgetAId = await page.locator('[data-widget-id]').last().getAttribute('data-widget-id');
    const widgetA = page.locator(`[data-widget-id="${widgetAId}"]`);
    await widgetA.waitFor({ state: 'visible' });
    await widgetA.scrollIntoViewIfNeeded();
    const boxA = await widgetA.boundingBox();
    if (boxA) {
        await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
        await page.mouse.dblclick();
    } else {
        await widgetA.dblclick();
    }
    const modalA = page.getByTestId('modify-widget-modal');
    await expect(modalA).toBeVisible();
    await ensureWidgetPropertiesOpen(modalA);
    // Set the text prop via JSON to be robust
    const jsonAreaA = modalA.locator('label:has-text("Advanced: Raw JSON settings")').locator('..').locator('textarea');
    await jsonAreaA.fill('{"text":"Page A - hello"}');
    await modalA.locator('button:has-text("Apply JSON")').click();
    await expect(modalA).toBeHidden();
    await expect(page.locator('text=Page A - hello')).toBeVisible();

    // Create Page B and Page C
    await page.getByRole('button', { name: 'New page' }).click();
    await renameCurrentPage('Page B');
    await addTextWidget();
    const widgetBId = await page.locator('[data-widget-id]').last().getAttribute('data-widget-id');
    const widgetB = page.locator(`[data-widget-id="${widgetBId}"]`);
    await widgetB.waitFor({ state: 'visible' });
    await widgetB.scrollIntoViewIfNeeded();
    const boxB = await widgetB.boundingBox();
    if (boxB) {
        await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
        await page.mouse.dblclick();
    } else {
        await widgetB.dblclick();
    }
    const modalB = page.getByTestId('modify-widget-modal');
    await expect(modalB).toBeVisible();
    await ensureWidgetPropertiesOpen(modalB);
    const jsonAreaB = modalB.locator('label:has-text("Advanced: Raw JSON settings")').locator('..').locator('textarea');
    await jsonAreaB.fill('{"text":"Page B - hola"}');
    await modalB.locator('button:has-text("Apply JSON")').click();
    await expect(modalB).toBeHidden();
    await expect(page.locator('text=Page B - hola')).toBeVisible();

    await page.getByRole('button', { name: 'New page' }).click();
    await renameCurrentPage('Page C');
    await addTextWidget();
    const widgetCId = await page.locator('[data-widget-id]').last().getAttribute('data-widget-id');
    const widgetC = page.locator(`[data-widget-id="${widgetCId}"]`);
    await widgetC.waitFor({ state: 'visible' });
    await widgetC.scrollIntoViewIfNeeded();
    const boxC = await widgetC.boundingBox();
    if (boxC) {
        await page.mouse.move(boxC.x + boxC.width / 2, boxC.y + boxC.height / 2);
        await page.mouse.dblclick();
    } else {
        await widgetC.dblclick();
    }
    const modalC = page.getByTestId('modify-widget-modal');
    await expect(modalC).toBeVisible();
    await ensureWidgetPropertiesOpen(modalC);
    const jsonAreaC = modalC.locator('label:has-text("Advanced: Raw JSON settings")').locator('..').locator('textarea');
    await jsonAreaC.fill('{"text":"Page C - hey"}');
    await modalC.locator('button:has-text("Apply JSON")').click();
    await expect(modalC).toBeHidden();
    await expect(page.locator('text=Page C - hey')).toBeVisible();

    // Flip through pages in a few orders and assert the correct content is visible
    const sequence = ['Page A', 'Page B', 'Page C', 'Page B', 'Page A', 'Page C', 'Page A'];
    for (const name of sequence) {
        // Select page by label using Page Settings combobox
        const pageSettings = page.locator('div:has-text("Page Settings")');
        const select = pageSettings.locator('select');
        await select.selectOption({ label: name });
        // Wait for content to be visible for that page
        const expectedText = name === 'Page A' ? 'Page A - hello' : (name === 'Page B' ? 'Page B - hola' : 'Page C - hey');
        await expect(page.locator(`text=${expectedText}`)).toBeVisible();
        // Also assert that any other page texts are NOT visible in the canvas
        if (name !== 'Page A') await expect(page.locator('text=Page A - hello')).toBeHidden();
        if (name !== 'Page B') await expect(page.locator('text=Page B - hola')).toBeHidden();
        if (name !== 'Page C') await expect(page.locator('text=Page C - hey')).toBeHidden();
    }

    // Delete Page B and ensure its content is gone
    const pageSettings = page.locator('div:has-text("Page Settings")');
    const select = pageSettings.locator('select');
    await select.selectOption({ label: 'Page B' });
    // Confirm deletion dialog
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete page' }).click();
    // Page B content should not exist
    await expect(page.locator('text=Page B - hola')).toBeHidden();

    // Create new page with a name that might collide if IDs aren't unique
    await page.getByRole('button', { name: 'New page' }).click();
    await renameCurrentPage('Page D');
    await addTextWidget();
    const widgetDId = await page.locator('[data-widget-id]').last().getAttribute('data-widget-id');
    const widgetD = page.locator(`[data-widget-id="${widgetDId}"]`);
    await widgetD.waitFor({ state: 'visible' });
    await widgetD.scrollIntoViewIfNeeded();
    const boxD = await widgetD.boundingBox();
    if (boxD) {
        await page.mouse.move(boxD.x + boxD.width / 2, boxD.y + boxD.height / 2);
        await page.mouse.dblclick();
    } else {
        await widgetD.dblclick();
    }
    const modalD = page.getByTestId('modify-widget-modal');
    await expect(modalD).toBeVisible();
    await ensureWidgetPropertiesOpen(modalD);
    const jsonAreaD = modalD.locator('label:has-text("Advanced: Raw JSON settings")').locator('..').locator('textarea');
    await jsonAreaD.fill('{"text":"Page D - heyoo"}');
    await modalD.locator('button:has-text("Apply JSON")').click();
    await expect(modalD).toBeHidden();
    await expect(page.locator('text=Page D - heyoo')).toBeVisible();

    // Randomize navigation order and verify each shows the right text again
    const seq2 = ['Page A', 'Page C', 'Page D', 'Page A', 'Page C'];
    for (const name of seq2) {
        await select.selectOption({ label: name });
        const expectedText = name === 'Page A' ? 'Page A - hello' : (name === 'Page C' ? 'Page C - hey' : (name === 'Page D' ? 'Page D - heyoo' : ''));
        await expect(page.locator(`text=${expectedText}`)).toBeVisible();
    }
});
