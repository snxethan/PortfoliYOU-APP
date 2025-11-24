import { test, expect } from '@playwright/test';
import { addWidgetFromPalette, bootstrapEditor, closeWidgetModal, openWidgetSettingsModal, setWidgetName } from './helpers/editor';

const WIDGET_TYPES = [
    { type: 'text', label: 'Text Block' },
    { type: 'image', label: 'Image' },
    { type: 'video', label: 'Video' },
    { type: 'project', label: 'Project Card' },
    { type: 'contact', label: 'Email Contact' },
    { type: 'link', label: 'Link' },
    { type: 'nav-link', label: 'Page Navigation' },
    { type: 'carousel', label: 'Carousel' },
    { type: 'github-repos', label: 'GitHub Repos' },
];

test.describe('Widget add/edit/undo/redo flows', () => {
    for (const widget of WIDGET_TYPES) {
        test(`Add → Edit → Undo → Redo ${widget.label}`, async ({ page }) => {
            await bootstrapEditor(page, `Widget flow – ${widget.type}`);

            const gridWidget = await addWidgetFromPalette(page, widget.type);
            const modal = await openWidgetSettingsModal(page, gridWidget);
            const editedName = `${widget.label} – Edited`;
            await setWidgetName(modal, editedName);
            await closeWidgetModal(modal);

            const undoButton = page.getByTestId('undo-btn');
            await expect(undoButton).toBeEnabled();
            await undoButton.click();

            const modalAfterUndo = await openWidgetSettingsModal(page, gridWidget);
            await expect(modalAfterUndo.getByTestId('widget-name-input')).toHaveValue(widget.label);
            await closeWidgetModal(modalAfterUndo);

            const redoButton = page.getByTestId('redo-btn');
            await expect(redoButton).toBeEnabled();
            await redoButton.click();

            const modalAfterRedo = await openWidgetSettingsModal(page, gridWidget);
            await expect(modalAfterRedo.getByTestId('widget-name-input')).toHaveValue(editedName);
            await closeWidgetModal(modalAfterRedo);
        });
    }
});
