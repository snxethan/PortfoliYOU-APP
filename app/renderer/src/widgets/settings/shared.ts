import { z } from 'zod';

export const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const TEXT_VARIANTS = ['paragraph', 'h2', 'h3'] as const;
export const TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const TEXT_FONTS = ['system', 'serif', 'mono'] as const;
export const TEXT_FORMATS = ['plain', 'markdown'] as const;
export const TEXT_WEIGHTS = ['normal', 'bold'] as const;
export const TEXT_WIDGET_FIELD_KEYS = new Set(['text', 'variant', 'align', 'font', 'color', 'fontSize', 'weight', 'italic', 'ariaLabel', 'ariaDescription', 'format']);

export type TextVariantOption = typeof TEXT_VARIANTS[number];
export type TextAlignOption = typeof TEXT_ALIGNMENTS[number];
export type TextFontOption = typeof TEXT_FONTS[number];
export type TextFormatOption = typeof TEXT_FORMATS[number];
export type TextWeightOption = typeof TEXT_WEIGHTS[number];

const createStringGuard = <T extends readonly string[]>(options: T) => (value: unknown): value is T[number] => typeof value === 'string' && (options as readonly string[]).includes(value as string);

export const isTextVariantValue = createStringGuard(TEXT_VARIANTS);
export const isTextAlignValue = createStringGuard(TEXT_ALIGNMENTS);
export const isTextFontValue = createStringGuard(TEXT_FONTS);
export const isTextFormatValue = createStringGuard(TEXT_FORMATS);
export const isTextWeightValue = createStringGuard(TEXT_WEIGHTS);

export const LINK_VARIANTS = ['button', 'text', 'card'] as const;
export type LinkVariantOption = typeof LINK_VARIANTS[number];
export type LinkFontOption = TextFontOption;
export type LinkWeightOption = TextWeightOption;
export const LINK_WIDGET_FIELD_KEYS = new Set(['url', 'label', 'variant', 'iconLeft', 'iconRight', 'font', 'fontSize', 'weight', 'italic', 'ariaLabel', 'ariaDescription']);

export const isLinkVariantValue = createStringGuard(LINK_VARIANTS);
export const isLinkFontValue = isTextFontValue;
export const isLinkWeightValue = isTextWeightValue;

export const NAV_LINK_STYLES = ['link', 'button'] as const;
export type NavLinkStyleOption = typeof NAV_LINK_STYLES[number];
export const NAV_LINK_WIDGET_FIELD_KEYS = new Set(['label', 'targetPageId', 'style', 'align', 'color', 'textColor', 'underline', 'font', 'fontSize', 'ariaLabel', 'ariaDescription']);

export const isNavLinkStyleValue = createStringGuard(NAV_LINK_STYLES);

export const IMAGE_FITS = ['contain', 'cover', 'fill', 'none', 'scale-down'] as const;
export const IMAGE_SHAPES = ['rectangle', 'rounded', 'circle'] as const;
export const IMAGE_BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type ImageFitOption = typeof IMAGE_FITS[number];
export type ImageShapeOption = typeof IMAGE_SHAPES[number];
export type ImageBorderStyleOption = typeof IMAGE_BORDER_STYLES[number];
export const IMAGE_WIDGET_FIELD_KEYS = new Set(['src', 'alt', 'ariaLabel', 'ariaDescription', 'fit', 'scale', 'shape', 'radius', 'borderWidth', 'borderColor', 'borderStyle']);

export const isImageFitValue = createStringGuard(IMAGE_FITS);
export const isImageShapeValue = createStringGuard(IMAGE_SHAPES);
export const isImageBorderStyleValue = createStringGuard(IMAGE_BORDER_STYLES);

export const VIDEO_SHAPES = IMAGE_SHAPES;
export const VIDEO_BORDER_STYLES = IMAGE_BORDER_STYLES;
export type VideoShapeOption = ImageShapeOption;
export type VideoBorderStyleOption = ImageBorderStyleOption;
export const VIDEO_WIDGET_FIELD_KEYS = new Set([
    'src',
    'poster',
    'title',
    'ariaLabel',
    'ariaDescription',
    'autoplay',
    'muted',
    'loop',
    'controls',
    'playsInline',
    'allowFullscreen',
    'fallbackText',
    'backgroundColor',
    'borderWidth',
    'borderRadius',
    'borderColor',
    'borderStyle',
    'shape',
]);

export const isVideoShapeValue = isImageShapeValue;
export const isVideoBorderStyleValue = isImageBorderStyleValue;

export const CAROUSEL_WIDGET_FIELD_KEYS = new Set([
    'autoPlay',
    'interval',
    'backgroundColor',
    'shape',
    'radius',
    'borderWidth',
    'borderColor',
    'borderStyle',
    'ariaLabel',
    'ariaDescription',
    'announceSlides',
    'previousLabel',
    'nextLabel',
    'statusLabel',
]);

export const PROJECT_WIDGET_FIELD_KEYS = new Set([
    'title',
    'description',
    'headingLevel',
    'font',
    'fontSize',
    'link',
    'linkLabel',
    'image',
    'imageAlt',
    'backgroundColor',
    'ariaLabel',
    'ariaDescription',
]);

export const CONTACT_WIDGET_FIELD_KEYS = new Set([
    'heading',
    'description',
    'ariaLabel',
    'nameLabel',
    'emailLabel',
    'messageLabel',
    'submitLabel',
    'requireName',
    'requireEmail',
    'requireMessage',
    'ariaDescription',
    'liveMode',
    'submitAction',
    'mailtoTo',
    'successText',
    'errorText',
    'font',
    'fontSize',
    'cardBackgroundColor',
]);

export const GITHUB_WIDGET_FIELD_KEYS = new Set([
    'username',
    'maxItems',
    'layout',
    'ariaLabel',
    'ariaDescription',
    'announceMode',
    'refreshLabel',
    'containerBackgroundColor',
    'cardBackgroundColor',
    'cardBorderColor',
    'cardTextColor',
    'cardMutedColor',
]);

export const deriveNumberBounds = (field: z.ZodNumber) => {
    const def: any = (field as unknown as { _def?: unknown })._def;
    const checks: Array<{ kind: string; value?: number }> = def?.checks ?? [];
    let min: number | undefined;
    let max: number | undefined;
    let step: number | undefined;
    let isInt = false;
    for (const check of checks) {
        if (check.kind === 'min' && typeof check.value === 'number') min = check.value;
        if (check.kind === 'max' && typeof check.value === 'number') max = check.value;
        if (check.kind === 'int') isInt = true;
    }
    if (isInt) step = 1;
    return { min, max, step };
};
