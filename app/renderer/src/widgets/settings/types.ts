import type React from 'react';
import type { z } from 'zod';

export type WidgetSettingsComponentProps<EventTarget = HTMLInputElement | HTMLTextAreaElement> = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    locked: boolean;
    setFieldValue: (key: string, value: unknown) => void;
    schemaFields: Map<string, z.ZodTypeAny>;
    onCommitKeyDown: (event: React.KeyboardEvent<EventTarget>) => void;
    widgetDefaults: Record<string, unknown> | null;
};

export type WidgetSettingsComponent<P extends WidgetSettingsComponentProps = WidgetSettingsComponentProps> = (props: P) => React.ReactElement | null;

export type WidgetSettingsModule<P extends WidgetSettingsComponentProps = WidgetSettingsComponentProps> = {
    type: string;
    component: WidgetSettingsComponent<P>;
};

export type WidgetSettingsRegistry = Record<string, WidgetSettingsModule>;
