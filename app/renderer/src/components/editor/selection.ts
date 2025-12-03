export type SelectionChangeOptions = {
    append?: boolean;
    toggle?: boolean;
};

export type MarqueeSelectionOptions = {
    append?: boolean;
};

export function selectionOptionsFromPointerEvent(evt: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): SelectionChangeOptions | undefined {
    const toggle = !!((evt.metaKey || evt.ctrlKey) && !evt.shiftKey);
    const append = !!(evt.shiftKey || toggle);
    if (!append && !toggle) return undefined;
    return { append, toggle };
}

export function hasAppendModifier(evt: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): boolean {
    return !!(evt.shiftKey || evt.metaKey || evt.ctrlKey);
}
