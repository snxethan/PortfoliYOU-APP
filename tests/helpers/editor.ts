import { expect, type Locator, type Page } from '@playwright/test';

const DEFAULT_PROJECT_PREFIX = 'Playwright Project';

export async function enableDeterministicIds(page: Page) {
    await page.addInitScript(() => {
        if ((window as unknown as { __pyDeterministicIds?: boolean }).__pyDeterministicIds) {
            return;
        }
        (window as unknown as { __pyDeterministicIds?: boolean }).__pyDeterministicIds = true;
        let counter = 0;
        const fakeId = () => {
            counter += 1;
            return `widget-${counter.toString().padStart(4, '0')}`;
        };
        try {
            Object.defineProperty(window.crypto, 'randomUUID', {
                configurable: true,
                value: fakeId,
            });
        } catch {
            const cryptoRef = window.crypto || ({} as Crypto);
            (window as unknown as { crypto: Crypto }).crypto = { ...cryptoRef, randomUUID: fakeId } as Crypto;
        }
    });
}

export async function bootstrapEditor(page: Page, projectName?: string) {
    await enableDeterministicIds(page);
    await page.goto('/');

    const name = projectName ?? `${DEFAULT_PROJECT_PREFIX} ${Date.now()}`;
    await page.getByTestId('create-portfolio-btn').click();
    await page.getByTestId('portfolio-name-input').fill(name);
    await page.getByTestId('confirm-create-btn').click();

    await page.getByTestId('nav-editor').click();
    await expect(page.getByTestId('grid-canvas')).toBeVisible();
}

export async function addWidgetFromPalette(page: Page, type: string) {
    const tile = page.getByTestId(`palette-tile-${type}`);
    await tile.scrollIntoViewIfNeeded();
    await expect(tile).toBeVisible();
    await tile.press('Enter');
    const widget = page.locator('[data-widget-id]').last();
    await expect(widget).toBeVisible();
    return widget;
}

export async function openWidgetSettingsModal(page: Page, widget: Locator) {
    await widget.hover();
    await widget.locator('[data-testid="widget-settings-btn"]').click();
    const modal = page.getByTestId('modify-widget-modal');
    await expect(modal).toBeVisible();
    return modal;
}

async function ensureWidgetPropertiesOpen(modal: Locator) {
    const toggle = modal.getByRole('button', { name: /Widget Properties/i });
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
        await toggle.click();
    }
}

export async function setWidgetName(modal: Locator, value: string) {
    await ensureWidgetPropertiesOpen(modal);
    const nameInput = modal.getByTestId('widget-name-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(value);
    await nameInput.blur();
    return nameInput;
}

export async function closeWidgetModal(modal: Locator) {
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();
}

export function normalizeMarkup(markup: string) {
    return markup
        .replace(/widget-[0-9a-z-]+/gi, 'widget-__ID__')
        .replace(/py_widget_[0-9]+/gi, 'py_widget__')
        .trim();
}
