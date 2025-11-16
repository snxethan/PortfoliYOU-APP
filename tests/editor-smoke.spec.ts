import { test, expect } from '@playwright/test';

// Smoke: Add → Move → Rename → Undo → Redo → Persist
// Assumes renderer dev server only (no Electron APIs needed).

test('Editor widget workflow persists across reload', async ({ page }) => {
    await page.goto('/');

    // Create portfolio
    await page.getByTestId('create-portfolio-btn').click();
    await page.getByTestId('portfolio-name-input').fill('Test Portfolio');
    await page.getByTestId('confirm-create-btn').click();

    // Navigate to editor
    await page.getByTestId('nav-editor').click();
    await expect(page.getByTestId('grid-canvas')).toBeVisible();

    // Add Text widget from palette using keyboard (palette dispatches add event)
    const tile = page.getByTestId('palette-tile-text');
    await expect(tile).toBeVisible();
    await tile.press('Enter');

    // Verify widget appeared
    const widget = page.locator('[data-widget-id]');
    await expect(widget.first()).toBeVisible();

    // Move widget by offset (simulate drag) to test reorder
    const box = await widget.first().boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2);
        await page.mouse.up();
    }

    // Open settings modal
    await widget.first().hover();
    await widget.first().locator('[data-testid="widget-settings-btn"]').click();
    const modal = page.getByTestId('modify-widget-modal');
    await expect(modal).toBeVisible();

    const nameInput = modal.getByTestId('widget-name-input');
    await expect(nameInput).toBeVisible();
    // Original title should be Text Block
    await expect(nameInput).toHaveValue(/Text Block/);
    await nameInput.fill('Renamed Widget');
    await nameInput.blur();

    // Close modal
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();

    // Undo rename
    await page.getByTestId('undo-btn').click();
    await widget.first().locator('[data-testid="widget-settings-btn"]').click();
    await expect(modal).toBeVisible();
    await expect(nameInput).toHaveValue(/Text Block/);
    // Close again
    await modal.getByRole('button', { name: 'Close' }).click();

    // Redo rename
    await page.getByTestId('redo-btn').click();
    await widget.first().hover();
    await widget.first().locator('[data-testid="widget-settings-btn"]').click();
    await expect(modal).toBeVisible();
    await expect(nameInput).toHaveValue('Renamed Widget');
    await modal.getByRole('button', { name: 'Close' }).click();

    // Reload page and verify persistence
    await page.reload();
    await page.getByTestId('nav-editor').click();
    const widgetAfter = page.locator('[data-widget-id]').first();
    await widgetAfter.hover();
    await widgetAfter.locator('[data-testid="widget-settings-btn"]').click();
    await expect(page.getByTestId('widget-name-input')).toHaveValue('Renamed Widget');
});
