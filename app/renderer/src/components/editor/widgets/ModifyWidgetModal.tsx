import React, { useEffect, useMemo, useState } from "react";
import { Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, ChevronRight, X, Trash2, AlignLeft, AlignCenter, AlignRight, Bold as BoldIcon, Italic as ItalicIcon, Type, Link as LinkIcon, Palette, Sparkles } from "lucide-react";
import { z } from "zod";

import { useAssets } from "../../../providers/AssetsProvider";
import type { AssetsCtx } from "../../../providers/AssetsProvider";
import { useNotifications } from "../../../providers/NotificationsProvider";
import { useProjects } from "../../../providers/ProjectsProvider";
import { WidgetsRegistry } from "../../../widgets/registry";
import type { CarouselItem } from "../../../widgets/defs/Carousel";
import { ALLOWED_HTTP_SCHEME_LABEL } from "../../../../../shared/widgets/linkUrl";
import type { GridItem } from "../canvas/DraggableItem";
import { useScrollLock } from "../../../hooks/useScrollLock";

import LinkPreviewPanel from "./LinkPreviewPanel";

type CarouselEditorItem = {
    id: string;
    mediaType: 'image' | 'video';
    source: string;
    alt: string;
    caption: string;
    poster?: string;
};

function makeCarouselId(seed?: number) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const base = Math.random().toString(36).slice(2, 9);
    return seed !== undefined ? `slide-${seed}-${base}` : base;
}

function normalizeCarouselEditorItems(raw: unknown): CarouselEditorItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry, idx) => {
        const data = (entry || {}) as CarouselItem;
        const mediaType: 'image' | 'video' = data.mediaType === 'video' ? 'video' : 'image';
        const source = typeof data.src === 'string' && data.src
            ? data.src
            : (typeof data.assetId === 'string' ? data.assetId : '');
        return {
            id: data.id || makeCarouselId(idx),
            mediaType,
            source: source || '',
            alt: typeof data.alt === 'string' ? data.alt : '',
            caption: typeof data.caption === 'string' ? data.caption : '',
            poster: typeof data.poster === 'string' ? data.poster : '',
        } satisfies CarouselEditorItem;
    });
}

function createBlankCarouselItem(): CarouselEditorItem {
    return {
        id: makeCarouselId(),
        mediaType: 'image',
        source: '',
        alt: '',
        caption: '',
        poster: '',
    };
}

function serializeCarouselEditorItems(items: CarouselEditorItem[]): CarouselItem[] {
    return items
        .map((item) => ({
            id: item.id,
            mediaType: item.mediaType,
            src: item.source.trim(),
            alt: item.alt.trim() || undefined,
            caption: item.caption.trim() || undefined,
            poster: item.poster?.trim() || undefined,
        }))
        .filter((item) => !!item.src);
}

const ENTER_SUBMIT_BLOCKED_TYPES = new Set(['checkbox', 'radio', 'range', 'color', 'date', 'datetime-local', 'month', 'week', 'time', 'file']);
const VIDEO_APPEARANCE_FIELDS = new Set(['shape', 'borderWidth', 'borderRadius', 'borderColor', 'borderStyle', 'backgroundColor']);
const APPEARANCE_FIELDS_BY_WIDGET: Record<string, ReadonlySet<string>> = {
    image: new Set(['fit', 'radius', 'scale', 'shape', 'borderWidth', 'borderColor', 'borderStyle']),
    text: new Set(['variant', 'align', 'font', 'color', 'fontSize', 'weight', 'italic']),
    link: new Set(['variant', 'font', 'fontSize', 'weight', 'italic']),
    'nav-link': new Set(['style', 'align', 'color', 'textColor', 'underline', 'font', 'fontSize']),
    project: new Set(['headingLevel', 'font', 'fontSize']),
    contact: new Set(['font', 'fontSize']),
    carousel: new Set(['backgroundColor', 'shape', 'radius', 'borderWidth', 'borderColor', 'borderStyle']),
    'github-repos': new Set(['layout']),
};
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hasAppearanceKeyword(key: string) {
    const normalized = key.toLowerCase();
    if (normalized.includes('color') || normalized.includes('background')) return true;
    if (normalized.includes('border') || normalized.includes('radius')) return true;
    if (normalized.includes('shape')) return true;
    if (normalized.includes('font')) return true;
    if (normalized === 'align' || normalized === 'layout' || normalized === 'weight' || normalized === 'italic') return true;
    if (normalized === 'style' || normalized === 'variant' || normalized === 'underline') return true;
    if (normalized === 'headinglevel' || normalized === 'fit') return true;
    return false;
}

function isAppearanceField(defType: string | null, key: string) {
    if (!key) return false;
    const overrides = defType ? APPEARANCE_FIELDS_BY_WIDGET[defType] : undefined;
    if (overrides?.has(key)) return true;
    return hasAppearanceKeyword(key);
}
const URL_FIELD_HINTS = ['url', 'link', 'href', 'website'];
const TEXTAREA_FIELD_HINTS = ['description', 'content', 'body', 'text', 'bio', 'summary'];
const IMAGE_FIELD_HINTS = ['image', 'img', 'photo', 'poster', 'thumb', 'thumbnail', 'cover', 'logo', 'avatar'];
const VIDEO_FIELD_HINTS = ['video', 'clip', 'movie', 'reel', 'media'];
const GENERIC_ASSET_HINTS = ['asset', 'src', 'source', 'file'];
const URL_PROTOCOL_SUGGESTIONS = ['https://', 'http://', 'mailto:', 'tel:'] as const;

const TEXT_VARIANTS = ['paragraph', 'h2', 'h3'] as const;
const TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;
const TEXT_FONTS = ['system', 'serif', 'mono'] as const;
const TEXT_FORMATS = ['plain', 'markdown'] as const;
const TEXT_WEIGHTS = ['normal', 'bold'] as const;
const TEXT_WIDGET_FIELD_KEYS = new Set(['text', 'variant', 'align', 'font', 'color', 'fontSize', 'weight', 'italic', 'ariaLabel', 'ariaDescription', 'format']);

type TextVariantOption = typeof TEXT_VARIANTS[number];
type TextAlignOption = typeof TEXT_ALIGNMENTS[number];
type TextFontOption = typeof TEXT_FONTS[number];
type TextFormatOption = typeof TEXT_FORMATS[number];
type TextWeightOption = typeof TEXT_WEIGHTS[number];

function createStringGuard<T extends readonly string[]>(options: T) {
    return (value: unknown): value is T[number] => typeof value === 'string' && (options as readonly string[]).includes(value as string);
}

const isTextVariantValue = createStringGuard(TEXT_VARIANTS);
const isTextAlignValue = createStringGuard(TEXT_ALIGNMENTS);
const isTextFontValue = createStringGuard(TEXT_FONTS);
const isTextFormatValue = createStringGuard(TEXT_FORMATS);
const isTextWeightValue = createStringGuard(TEXT_WEIGHTS);

const LINK_VARIANTS = ['button', 'text', 'card'] as const;
const LINK_WIDGET_FIELD_KEYS = new Set(['url', 'label', 'variant', 'iconLeft', 'iconRight', 'font', 'fontSize', 'weight', 'italic', 'ariaLabel', 'ariaDescription']);

type LinkVariantOption = typeof LINK_VARIANTS[number];
type LinkFontOption = TextFontOption;
type LinkWeightOption = TextWeightOption;

const isLinkVariantValue = createStringGuard(LINK_VARIANTS);
const isLinkFontValue = isTextFontValue;
const isLinkWeightValue = isTextWeightValue;

const NAV_LINK_STYLES = ['link', 'button'] as const;
const NAV_LINK_WIDGET_FIELD_KEYS = new Set(['label', 'targetPageId', 'style', 'align', 'color', 'textColor', 'underline', 'font', 'fontSize', 'ariaLabel']);

type NavLinkStyleOption = typeof NAV_LINK_STYLES[number];

const isNavLinkStyleValue = createStringGuard(NAV_LINK_STYLES);

type AssetKind = 'image' | 'video' | 'media';

function hasUrlValidation(field: z.ZodTypeAny) {
    const def: any = (field as unknown as { _def?: unknown })._def;
    const checks: Array<{ kind?: string }> = def?.checks ?? [];
    return checks.some(check => check.kind === 'url');
}

function isLikelyUrlField(key: string, field: z.ZodTypeAny) {
    const lower = key.toLowerCase();
    if (!(field instanceof z.ZodString)) return false;
    if (hasUrlValidation(field)) return true;
    return URL_FIELD_HINTS.some(hint => lower.includes(hint));
}

function inferAssetKind(defType: string | null, key: string): AssetKind | null {
    const lower = key.toLowerCase();
    const matches = (hint: string) => lower === hint || lower.endsWith(hint) || lower.includes(`${hint}url`) || lower.includes(`${hint}src`);
    if (IMAGE_FIELD_HINTS.some(matches)) return 'image';
    if (VIDEO_FIELD_HINTS.some(matches)) return 'video';
    if (GENERIC_ASSET_HINTS.some(matches)) return 'media';
    if (lower === 'poster' || lower.endsWith('poster')) return 'image';
    if (lower === 'thumbnail' || lower.endsWith('thumbnail')) return 'image';
    if (lower === 'src') {
        if (defType === 'image' || defType === 'project' || defType === 'carousel') return 'image';
        if (defType === 'video') return 'video';
    }
    return null;
}

function deriveNumberBounds(field: z.ZodNumber) {
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
}

function shouldUseTextareaField(defType: string | null, key: string) {
    const lower = key.toLowerCase();
    // If the key looks like a color (e.g. textColor) don't treat it as a textarea.
    if (lower.includes('color')) return false;
    // Match textarea hints as whole words or separated by non-alphanumerics to avoid
    // matching 'textColor' (which contains 'text' but is not a multiline field).
    for (const hint of TEXTAREA_FIELD_HINTS) {
        const re = new RegExp(`(^|[^a-z0-9])${hint}($|[^a-z0-9])`);
        if (re.test(lower)) return true;
    }
    if (defType === 'text' && lower === 'text') return true;
    return false;
}

function inferStringInputType(field: z.ZodTypeAny): 'text' | 'email' | 'url' {
    if (!(field instanceof z.ZodString)) return 'text';
    const def: any = (field as unknown as { _def?: unknown })._def;
    const checks: Array<{ kind?: string }> = def?.checks ?? [];
    if (checks.some(check => check.kind === 'email')) return 'email';
    if (checks.some(check => check.kind === 'url')) return 'url';
    return 'text';
}

export default function ModifyWidgetModal({
    item,
    onClose,
    onDelete,
    onRename,
    onBringToFront,
    onSendToBack,
    onBringForward,
    onSendBackward,
    onTogglePin,
    onToggleLock,
    onApplyProps,
}: {
    item: GridItem;
    onClose: () => void;
    onDelete?: () => void;
    onRename: (title: string) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onTogglePin: () => void;
    onToggleLock: () => void;
    onApplyProps: (props: any) => void;
}) {
    useScrollLock(true);
    const { selectedProject } = useProjects();
    const { add: notify } = useNotifications();
    const widgetName = item.title || item.type || 'Widget';
    const [title, setTitle] = useState(item.title);
    const [propsText, setPropsText] = useState<string>(() => {
        try { return JSON.stringify(item.props ?? {}, null, 2); } catch { return "{}"; }
    });
    const [propsError, setPropsError] = useState<string | null>(null);
    const [zodSchema, setZodSchema] = useState<z.ZodObject<z.ZodRawShape> | null>(null);
    const [formValues, setFormValues] = useState<Record<string, unknown>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [widgetDefaults, setWidgetDefaults] = useState<Record<string, unknown> | null>(null);
    const [defType, setDefType] = useState<string | null>(null);
    const [imageFileName, setImageFileName] = useState<string>("");
    const [videoFileName, setVideoFileName] = useState<string>("");
    const [posterFileName, setPosterFileName] = useState<string>("");
    const [carouselItems, setCarouselItems] = useState<CarouselEditorItem[]>([]);
    const [carouselError, setCarouselError] = useState<string | null>(null);
    const assets = useAssets();
    const imageAssetOptions = useMemo(() => assets.list.filter(asset => {
        if (asset.type?.startsWith('image/')) return true;
        const hasDimensions = typeof asset.width === 'number' && asset.width > 0 && typeof asset.height === 'number' && asset.height > 0;
        return hasDimensions;
    }), [assets.list]);
    React.useEffect(() => { console.info('ModifyWidgetModal: imageAssetOptionsCount=', imageAssetOptions.length, 'assetsListCount=', assets.list.length); }, [imageAssetOptions.length, assets.list.length]);
    const videoAssetOptions = useMemo(() => assets.list.filter(asset => asset.type?.startsWith('video/')), [assets.list]);
    const resolvedDefType = defType || item.type || null;
    const isCarousel = resolvedDefType === 'carousel';
    const isVideo = resolvedDefType === 'video';
    const videoShapeValue = ((typeof formValues.shape === 'string' ? formValues.shape : null) || 'rectangle') as 'rectangle' | 'rounded' | 'circle';
    const rawBorderWidth = formValues.borderWidth;
    const rawBorderRadius = formValues.borderRadius;
    const videoBorderWidthValue = typeof rawBorderWidth === 'number' && Number.isFinite(rawBorderWidth) ? rawBorderWidth : '';
    const videoBorderRadiusValue = typeof rawBorderRadius === 'number' && Number.isFinite(rawBorderRadius) ? rawBorderRadius : '';
    const videoBorderColorValue = (typeof formValues.borderColor === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(formValues.borderColor)) ? formValues.borderColor : '#e5e7eb';
    const videoBorderStyleValue = (typeof formValues.borderStyle === 'string' ? formValues.borderStyle : 'solid') as 'solid' | 'dashed' | 'dotted';
    // Carousel uses `radius` instead of `borderRadius` in its schema
    const carouselShapeValue = videoShapeValue;
    const rawCarouselRadius = formValues.radius;
    const carouselRadiusValue = typeof rawCarouselRadius === 'number' && Number.isFinite(rawCarouselRadius) ? rawCarouselRadius : '';
    // Derive navStyle from the current form values first, then fall back to the
    // original item props (in case the form hasn't been populated yet). This
    // ensures the UI shows the proper controls (e.g. textColor color picker)
    // when editing nav-link widgets.
    const navStyle = (defType === 'nav-link')
        ? String((formValues['style'] as string) ?? ((item.props as unknown as Record<string, unknown>)?.style as string) ?? 'link')
        : undefined;
    const videoBackgroundColorValue = typeof formValues.backgroundColor === 'string' ? formValues.backgroundColor : '';
    const videoBackgroundColorSwatch = HEX_COLOR_RE.test(videoBackgroundColorValue) ? videoBackgroundColorValue : '#ffffff';
    // Collapsible sections (persist across openings)
    const [compOpen, setCompOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_comp_props_open') === '1'; } catch { return false; }
    });
    const [widgetOpen, setWidgetOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_props_open') === '1'; } catch { return false; }
    });
    function toggleCompOpen() {
        setCompOpen(prev => { const n = !prev; try { localStorage.setItem('py_comp_props_open', n ? '1' : '0'); } catch { /* noop */ } return n; });
    }
    function toggleWidgetOpen() {
        setWidgetOpen(prev => { const n = !prev; try { localStorage.setItem('py_widget_props_open', n ? '1' : '0'); } catch { /* noop */ } return n; });
    }
    function persistedToggle(key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) {
        setter(prev => {
            const next = !prev;
            try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* noop */ }
            return next;
        });
    }
    const [imageToolsOpen, setImageToolsOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_image_tools_open') !== '0'; } catch { return true; }
    });
    const [videoToolsOpen, setVideoToolsOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_video_tools_open') !== '0'; } catch { return true; }
    });
    const [carouselToolsOpen, setCarouselToolsOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_carousel_tools_open') !== '0'; } catch { return true; }
    });
    const [protectionOpen, setProtectionOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_protection_open') !== '0'; } catch { return true; }
    });
    const [layerOpen, setLayerOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_layers_open') !== '0'; } catch { return true; }
    });

    // Keyboard helpers
    function handleEnterSubmitComp(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !locked) {
            e.preventDefault();
            applyForm();
        }
    }
    function handleEnterSubmitAnywhere(e: React.KeyboardEvent) {
        if (locked || e.defaultPrevented) return;
        if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target instanceof HTMLTextAreaElement) return;
        if (target instanceof HTMLInputElement) {
            const type = target.type?.toLowerCase();
            if (!type || !ENTER_SUBMIT_BLOCKED_TYPES.has(type)) {
                e.preventDefault();
                applyForm();
            }
        }
    }
    function handleCtrlEnterApplyJson(e: React.KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !locked) {
            e.preventDefault();
            applyProps();
        }
    }

    function updateCarouselItem(id: string, patch: Partial<CarouselEditorItem>) {
        setCarouselError(null);
        setCarouselItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    }

    function moveCarouselItem(id: string, direction: -1 | 1) {
        setCarouselError(null);
        setCarouselItems(prev => {
            const idx = prev.findIndex(item => item.id === id);
            if (idx === -1) return prev;
            const target = idx + direction;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            const [entry] = next.splice(idx, 1);
            next.splice(target, 0, entry);
            return next;
        });
    }

    function removeCarouselItem(id: string) {
        setCarouselError(null);
        setCarouselItems(prev => {
            if (prev.length <= 1) {
                return prev.map((item, idx) => idx === 0 ? { ...item, source: '', alt: '', caption: '', poster: '' } : item);
            }
            return prev.filter(item => item.id !== id);
        });
    }

    function addCarouselItem() {
        setCarouselError(null);
        setCarouselItems(prev => [...prev, createBlankCarouselItem()]);
    }

    useEffect(() => {
        setTitle(item.title);
        try { setPropsText(JSON.stringify(item.props ?? {}, null, 2)); } catch { setPropsText("{}"); }
        setPropsError(null);
        if (item.type === 'carousel') {
            const rawItems = (item.props as { items?: CarouselItem[] })?.items;
            const normalized = normalizeCarouselEditorItems(rawItems);
            setCarouselItems(normalized.length > 0 ? normalized : [createBlankCarouselItem()]);
            setCarouselError(null);
        } else {
            setCarouselItems([]);
            setCarouselError(null);
        }
        // Load widget definition to check for zod schema
        let mounted = true;
        if (!item.type) { setZodSchema(null); return () => { }; }
        WidgetsRegistry.ensure(item.type as string)
            .then((def) => {
                if (!mounted) return;
                try { setDefType((def as unknown as { type?: string }).type || item.type || null); } catch { setDefType(item.type || null); }
                const defaults = (def as unknown as { defaultProps?: Record<string, unknown> }).defaultProps;
                setWidgetDefaults(defaults ? { ...defaults } : null);
                const schema = (def as unknown as { zodSchema?: z.ZodObject<z.ZodRawShape> }).zodSchema;
                setZodSchema(schema ?? null);
                const currentProps = (item.props as Record<string, unknown>) ?? {};
                if (schema) {
                    // Initialize form values from current props with defaults for missing keys
                    const shape = schema.shape;
                    const defaultsObj = (defaults && typeof defaults === 'object') ? defaults : undefined;
                    const initial: Record<string, unknown> = {};
                    for (const key of Object.keys(shape)) {
                        if (currentProps[key] !== undefined) {
                            initial[key] = currentProps[key];
                        } else if (defaultsObj && defaultsObj[key] !== undefined) {
                            initial[key] = defaultsObj[key];
                        } else {
                            initial[key] = undefined;
                        }
                    }
                    const merged = {
                        ...(defaultsObj ?? {}),
                        ...initial,
                        ...currentProps,
                    };
                    setFormValues(merged);
                    // Validate once to populate errors
                    const res = schema.safeParse(merged);
                    if (!res.success) {
                        const errs: Record<string, string> = {};
                        for (const issue of res.error.issues) {
                            if (issue.path && issue.path.length > 0) {
                                errs[String(issue.path[0])] = issue.message;
                            }
                        }
                        setFormErrors(errs);
                    } else {
                        setFormErrors({});
                    }
                } else {
                    const withDefaults = defaults && typeof defaults === 'object'
                        ? { ...defaults, ...currentProps }
                        : currentProps;
                    setFormValues(withDefaults);
                    setFormErrors({});
                }
            })
            .finally(() => { });
        return () => { mounted = false; };
    }, [item]);

    // Initialize/refresh chosen file label from current src when editing an image widget
    useEffect(() => {
        let alive = true;
        async function go() {
            if (defType !== 'image') return;
            const src = formValues.src;
            if (typeof src === 'string' && src.startsWith('asset://')) {
                const hash = src.slice('asset://'.length);
                try { const meta = await assets.get(hash); if (alive) setImageFileName(meta?.name || ''); } catch { /* ignore */ }
            } else {
                if (alive) setImageFileName('');
            }
        }
        void go();
        return () => { alive = false; };
    }, [defType, formValues, assets]);

    useEffect(() => {
        let alive = true;
        async function go() {
            if (defType !== 'video') return;
            const src = formValues.src;
            if (typeof src === 'string' && src.startsWith('asset://')) {
                const hash = src.slice('asset://'.length);
                try { const meta = await assets.get(hash); if (alive) setVideoFileName(meta?.name || ''); } catch { /* ignore */ }
            } else {
                if (alive) setVideoFileName('');
            }
            const poster = formValues.poster;
            if (typeof poster === 'string' && poster.startsWith('asset://')) {
                const hash = poster.slice('asset://'.length);
                try { const meta = await assets.get(hash); if (alive) setPosterFileName(meta?.name || ''); } catch { /* ignore */ }
            } else {
                if (alive) setPosterFileName('');
            }
        }
        void go();
        return () => { alive = false; };
    }, [defType, formValues, assets]);

    const locked = !!item.locked;
    const pinned = !!item.pinned;
    const linkRawUrl = defType === 'link' ? (typeof formValues.url === 'string' ? formValues.url : '') : '';
    const linkFieldError = defType === 'link' ? (formErrors.url || null) : null;

    function validateField(key: string, value: unknown) {
        if (!zodSchema) {
            setFormErrors(prev => ({ ...prev, [key]: '' }));
            return;
        }
        const shape = zodSchema.shape as Record<string, z.ZodTypeAny>;
        const field = shape?.[key];
        if (!field) {
            setFormErrors(prev => ({ ...prev, [key]: '' }));
            return;
        }
        const single = z.object({ [key]: field });
        const res = single.safeParse({ [key]: value });
        setFormErrors(prev => ({ ...prev, [key]: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') }));
    }

    function setFieldValue(key: string, value: unknown) {
        const next = { ...formValues, [key]: value };
        setFormValues(next);
        validateField(key, value);
    }

    const isTextWidget = resolvedDefType === 'text';
    const isLinkWidget = resolvedDefType === 'link';
    const isNavLinkWidget = resolvedDefType === 'nav-link';
    const textSchemaFields = new Map<string, z.ZodTypeAny>();
    const linkSchemaFields = new Map<string, z.ZodTypeAny>();
    const navLinkSchemaFields = new Map<string, z.ZodTypeAny>();
    const schemaFieldBuckets = {
        default: [] as Array<[string, z.ZodTypeAny]>,
        appearance: [] as Array<[string, z.ZodTypeAny]>,
    };
    if (zodSchema) {
        for (const [key, schema] of Object.entries(zodSchema.shape)) {
            if (isTextWidget && TEXT_WIDGET_FIELD_KEYS.has(key)) {
                textSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isLinkWidget && LINK_WIDGET_FIELD_KEYS.has(key)) {
                linkSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isNavLinkWidget && NAV_LINK_WIDGET_FIELD_KEYS.has(key)) {
                navLinkSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isVideo && (key === 'src' || key === 'poster' || VIDEO_APPEARANCE_FIELDS.has(key))) {
                continue;
            }
            const bucket = isAppearanceField(defType, key) ? schemaFieldBuckets.appearance : schemaFieldBuckets.default;
            bucket.push([key, schema as z.ZodTypeAny]);
        }
    }

    const navPages = useMemo(() => {
        const project = selectedProject;
        if (!project) return [] as Array<{ id: string; title: string }>;
        const order = project.pageOrder || [];
        return order.map((id) => ({ id, title: project.pages?.[id]?.title || id }));
    }, [selectedProject]);

    const renderSchemaField = (key: string, schema: z.ZodTypeAny): React.ReactElement | null => {
        if (!zodSchema) return null;
        const field = schema as z.ZodTypeAny;
        const isOptional = field instanceof z.ZodOptional;
        let baseField: z.ZodTypeAny = isOptional ? (field._def as any).innerType as z.ZodTypeAny : field;
        if (baseField instanceof z.ZodDefault) {
            baseField = (baseField._def as any).innerType as z.ZodTypeAny;
        }
        if (baseField instanceof z.ZodNullable) {
            baseField = (baseField._def as any).innerType as z.ZodTypeAny;
        }
        const rawValue = formValues[key];
        const stringValue = typeof rawValue === 'string' ? rawValue : '';
        const error = formErrors[key];
        const hideForNavLink = (
            (defType === 'nav-link' && key === 'textColor' && navStyle === 'link') ||
            (defType === 'nav-link' && key === 'underline' && navStyle === 'button')
        );
        if (hideForNavLink) return null;
        let label = key.charAt(0).toUpperCase() + key.slice(1);
        let helperText: string | null = null;
        if (defType === 'nav-link') {
            if (key === 'color') label = navStyle === 'button' ? 'Background color' : 'Text color';
            if (key === 'textColor') label = 'Text color';
        }
        if (defType === 'link') {
            if (key === 'url') {
                helperText = `Supports ${ALLOWED_HTTP_SCHEME_LABEL} links. Missing protocol defaults to https://.`;
            } else if (key === 'iconLeft') {
                label = 'Prefix icon/text';
                helperText = 'Optional emoji or short text shown before the link label.';
            } else if (key === 'iconRight') {
                label = 'Suffix icon/text';
                helperText = 'Optional emoji or short text shown after the link label.';
            }
        } else if (defType === 'project') {
            if (key === 'link') {
                label = 'Project link';
                helperText = 'Optional external URL opened when the card is clicked.';
            } else if (key === 'image') {
                label = 'Image URL or asset://';
                helperText = 'Paste a hosted image URL or asset:// identifier to show a cover.';
            }
        }
        const disabled = locked;
        const isTargetPage = (defType === 'nav-link') && key === 'targetPageId' && (baseField instanceof z.ZodString);
        const isCarouselIntervalField = isCarousel && key === 'interval';
        const anyZ: any = z;
        const isEnum = baseField instanceof anyZ.ZodEnum;
        const isNativeEnum = baseField instanceof anyZ.ZodNativeEnum;
        const assetKind = (baseField instanceof z.ZodString) ? inferAssetKind(defType, key) : null;
        const isUrlField = (baseField instanceof z.ZodString) && !assetKind && isLikelyUrlField(key, baseField);
        const isColorField = key.toLowerCase().includes('color');
        const isNavButtonColorField = defType === 'nav-link' && navStyle === 'button' && (key === 'color' || key === 'textColor');
        const stringInputType = inferStringInputType(baseField);
        const numberMeta = baseField instanceof z.ZodNumber ? deriveNumberBounds(baseField) : undefined;
        const assetPlaceholder = assetKind === 'image'
            ? 'asset://hash or https://example.com/image.jpg'
            : assetKind === 'video'
                ? 'asset://hash or https://example.com/video.mp4'
                : 'asset://hash or https://example.com/resource';
        if (isCarouselIntervalField) {
            const secondsValue = typeof rawValue === 'number' && Number.isFinite(rawValue) ? (rawValue / 1000) : '';
            const adjustSeconds = (delta: number) => {
                const current = typeof secondsValue === 'number' ? secondsValue : 0;
                const next = Math.min(60, Math.max(0.5, Number((current + delta).toFixed(2))));
                const ms = Math.round(next * 1000);
                setFieldValue(key, ms);
            };
            return (
                <div key={key}>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Slide interval (seconds)</label>
                    <div className="flex gap-2">
                        <input
                            className="input w-full"
                            type="number"
                            min={0.5}
                            max={60}
                            step={0.5}
                            value={secondsValue === '' ? '' : secondsValue}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const num = raw === '' ? undefined : Number(raw);
                                const ms = typeof num === 'number' && !Number.isNaN(num) ? Math.round(num * 1000) : undefined;
                                setFieldValue(key, ms);
                            }}
                            onKeyDown={handleEnterSubmitComp}
                            disabled={disabled}
                        />
                        <div className="flex flex-col gap-1">
                            <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjustSeconds(0.5)} disabled={disabled}>+0.5s</button>
                            <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjustSeconds(-0.5)} disabled={disabled}>-0.5s</button>
                        </div>
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">0.5s – 60s, half-second steps.</div>
                    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                </div>
            );
        }
        return (
            <div key={key}>
                <label className="block text-[color:var(--fg-muted)] mb-1">{label}{!isOptional ? ' *' : ''}</label>
                {isTargetPage ? (
                    <select
                        className="input w-full"
                        value={String(stringValue || '')}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select page…</option>
                        {(() => {
                            const p = selectedProject;
                            const order = p?.pageOrder || [];
                            const pages = order.map(id => ({ id, title: p?.pages?.[id]?.title || id }));
                            return pages.map(pg => (
                                <option key={pg.id} value={pg.id}>{pg.title}</option>
                            ));
                        })()}
                    </select>
                ) : ((defType === 'text' && key === 'text' && (baseField instanceof z.ZodString)) || shouldUseTextareaField(defType, key)) ? (
                    <div>
                        <textarea
                            className="input w-full min-h-[6rem]"
                            value={stringValue}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            disabled={disabled}
                        />
                        <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{stringValue.length} characters</div>
                    </div>
                ) : assetKind && baseField instanceof z.ZodString ? (
                    <SchemaAssetField
                        value={stringValue}
                        placeholder={assetPlaceholder}
                        disabled={disabled}
                        assets={assets}
                        assetKind={assetKind}
                        onChange={(next) => setFieldValue(key, next && next.length ? next : undefined)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : isUrlField ? (
                    <SchemaUrlField
                        value={stringValue}
                        disabled={disabled}
                        onChange={(next) => setFieldValue(key, next && next.length ? next : undefined)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : baseField instanceof z.ZodBoolean ? (
                    <div className="flex items-center gap-2">
                        <input type="checkbox" className="checkbox" checked={!!formValues[key]} onChange={(e) => setFieldValue(key, e.target.checked)} disabled={disabled} />
                        <span className="text-xs">{label}</span>
                    </div>
                ) : baseField instanceof z.ZodNumber ? (
                    <SchemaNumberField
                        value={typeof rawValue === 'number' ? rawValue : undefined}
                        min={numberMeta?.min}
                        max={numberMeta?.max}
                        step={numberMeta?.step}
                        disabled={disabled}
                        onChange={(next) => setFieldValue(key, next)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : (isEnum || isNativeEnum) ? (
                    <select
                        className="input w-full"
                        value={String(stringValue || '')}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select…</option>
                        {(() => {
                            // derive options for enum types
                            const def: any = (baseField as any)._def;
                            let opts: string[] = [];
                            if (isEnum && Array.isArray(def?.values)) opts = def.values as string[];
                            else if (isNativeEnum && def?.values) opts = Object.values(def.values).filter((v: unknown) => typeof v === 'string') as string[];
                            return opts.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ));
                        })()}
                    </select>
                ) : isColorField || isNavButtonColorField ? (
                    <div className="flex items-center gap-2">
                        <input
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
                            type="color"
                            value={stringValue || '#2563eb'}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            disabled={disabled}
                            style={{ width: 36, height: 24, padding: 0, minWidth: 36 }}
                            aria-label={`${label} color`}
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={stringValue || ''}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            onKeyDown={handleEnterSubmitComp}
                            placeholder={"#ffffff or named color"}
                            disabled={disabled}
                        />
                        {defType === 'nav-link' && key === 'textColor' && (
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold"
                                onClick={() => {
                                    const bg = typeof formValues.color === 'string' ? formValues.color : '';
                                    if (bg) setFieldValue('textColor', bg);
                                }}
                                disabled={disabled}
                                title="Use background color"
                            >
                                Use background
                            </button>
                        )}
                    </div>
                ) : (
                    <input
                        className="input w-full"
                        type={stringInputType}
                        value={stringValue}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        onKeyDown={handleEnterSubmitComp}
                        disabled={disabled}
                    />
                )}
                {!!helperText && <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{helperText}</div>}
                {!!error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            </div>
        );
    };

    const defaultFieldNodes = schemaFieldBuckets.default.map(([key, schema]) => renderSchemaField(key, schema)).filter((node): node is React.ReactElement => Boolean(node));
    const appearanceFieldNodes = schemaFieldBuckets.appearance.map(([key, schema]) => renderSchemaField(key, schema)).filter((node): node is React.ReactElement => Boolean(node));
    const textWidgetSettingsNode = isTextWidget ? (
        <TextWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={textSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const linkWidgetSettingsNode = isLinkWidget ? (
        <LinkWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={linkSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
            rawUrl={linkRawUrl}
            fieldError={linkFieldError}
        />
    ) : null;
    const navWidgetSettingsNode = isNavLinkWidget ? (
        <NavLinkWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={navLinkSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
            pages={navPages}
        />
    ) : null;

    function applyProps() {
        if (locked) return;
        try {
            const parsed = JSON.parse(propsText);
            setPropsError(null);
            setCarouselError(null);
            try {
                onApplyProps(parsed);
                notify({ type: 'success', message: `${widgetName} JSON settings applied successfully`, title: selectedProject?.name || 'Editor', persistent: false });
                onClose();
            } catch (err) {
                console.error('applyProps: onApplyProps threw', err);
                setPropsError('Failed to apply settings');
                try { notify({ type: 'error', message: 'Failed to apply JSON settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
            }
        } catch (err) {
            console.error('applyProps: invalid JSON', err);
            setPropsError("Invalid JSON");
            try { notify({ type: 'error', message: 'Invalid JSON settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
        }
    }

    function applyForm() {
        if (locked || !zodSchema) return;
        const parsed = zodSchema.safeParse(formValues);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path && issue.path.length > 0) {
                    errs[String(issue.path[0])] = issue.message;
                }
            }
            setFormErrors(errs);
            try { notify({ type: 'error', message: 'Fix form errors before applying', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
            console.warn('applyForm: validation failed', parsed.error);
            return;
        }
        setFormErrors({});
        let payload: Record<string, unknown> = parsed.data;
        if (isCarousel) {
            const serialized = serializeCarouselEditorItems(carouselItems);
            if (serialized.length === 0) {
                setCarouselError('Add at least one slide with a source.');
                return;
            }
            setCarouselError(null);
            payload = { ...payload, items: serialized };
        }
        try {
            onApplyProps(payload);
            notify({ type: 'success', message: `${widgetName} settings applied successfully`, title: selectedProject?.name || 'Editor', persistent: false });
            onClose();
        } catch (err) {
            console.error('applyForm: onApplyProps threw', err);
            setFormErrors({ _global: 'Failed to apply settings' });
            try { notify({ type: 'error', message: 'Failed to apply settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
        }
    }

    const pinDisabled = locked;

    const handlePrimaryApply = () => {
        if (zodSchema) {
            applyForm();
            return;
        }
        applyProps();
    };

    return (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            data-testid="modify-widget-modal"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
        >
            <div
                className="surface w-full max-w-4xl border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
                style={{ animation: 'py-pop 0.25s ease-out' }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleEnterSubmitAnywhere}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                    <div>
                        <h2 className="text-lg font-semibold">Modify Widget</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Edit properties, layout and behavior for the selected widget</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm scrollable scrollable-container">
                    {/* Component Properties */}
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 overflow-hidden">
                        <button className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left" onClick={toggleCompOpen} title={compOpen ? 'Collapse' : 'Expand'} aria-expanded={compOpen}>
                            <div className="flex items-center gap-2">
                                {compOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Component Properties</p>
                            </div>
                            <div className="text-[color:var(--fg-muted)]" />
                        </button>
                        {compOpen && (
                            <div className="p-4 space-y-4">
                                {/* Image quick upload (when editing Image widget) */}
                                {defType === 'image' && (
                                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80">
                                        <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--fg-muted)]" onClick={() => persistedToggle('py_image_tools_open', setImageToolsOpen)}>
                                            <div className="flex items-center gap-2">
                                                {imageToolsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                <span>Image</span>
                                            </div>
                                            <div />
                                        </button>
                                        {imageToolsOpen && (
                                            <div className="p-3 pt-0 space-y-3">
                                                <div className="flex items-center gap-3 text-xs">
                                                    <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                        <span className="font-medium">Choose image</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="sr-only"
                                                            disabled={locked}
                                                            onChange={async (e) => {
                                                                const f = e.target.files?.[0];
                                                                if (!f) { setImageFileName(""); return; }
                                                                setImageFileName(f.name);
                                                                try {
                                                                    const metas = await assets.addFiles([f]);
                                                                    const m = metas[0];
                                                                    if (m?.hash) {
                                                                        setFieldValue('src', `asset://${m.hash}`);
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Image upload failed', err);
                                                                    try { notify({ type: 'error', message: `Failed to upload ${f.name}`, title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
                                                                    setImageFileName('');
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${imageFileName ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                                                        {imageFileName || 'No file chosen'}
                                                    </span>
                                                </div>
                                                <div className="mt-3 text-xs flex items-center gap-2">
                                                    <span className="text-[color:var(--fg-muted)]">Or pick from assets:</span>
                                                    <select
                                                        className="input"
                                                        disabled={locked}
                                                        value={(() => {
                                                            const src = formValues.src;
                                                            if (typeof src === 'string' && src.startsWith('asset://')) return src.slice('asset://'.length);
                                                            return '';
                                                        })()}
                                                        onChange={async (e) => {
                                                            const hash = e.target.value;
                                                            if (!hash) return;
                                                            setFieldValue('src', `asset://${hash}`);
                                                            try { const meta = await assets.get(hash); setImageFileName(meta?.name || ''); } catch { /* noop */ }
                                                        }}
                                                    >
                                                        <option value="">Select an asset…</option>
                                                        {imageAssetOptions.map((a) => (
                                                            <option key={a.hash} value={a.hash}>{a.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="pt-3 border-t border-[color:var(--border)] space-y-2">
                                                    <div className="text-[color:var(--fg-muted)] font-medium">Appearance</div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Shape</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(['rectangle', 'rounded', 'circle'] as const).map((shape) => (
                                                                <button
                                                                    key={shape}
                                                                    type="button"
                                                                    className={`px-3 py-1.5 rounded border text-xs font-semibold transition ${videoShapeValue === shape ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)]' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]'}`}
                                                                    onClick={() => setFieldValue('shape', shape)}
                                                                    disabled={locked}
                                                                >
                                                                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {formErrors.shape && <div className="text-red-500 text-xs mt-1">{formErrors.shape}</div>}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border width (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={48}
                                                                step={1}
                                                                value={videoBorderWidthValue === '' ? '' : videoBorderWidthValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('borderWidth', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.borderWidth && <div className="text-red-500 text-xs mt-1">{formErrors.borderWidth}</div>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border radius (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={240}
                                                                step={1}
                                                                value={videoBorderRadiusValue === '' ? '' : videoBorderRadiusValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('borderRadius', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.borderRadius && <div className="text-red-500 text-xs mt-1">{formErrors.borderRadius}</div>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border style</label>
                                                        <select
                                                            className="input w-full"
                                                            value={videoBorderStyleValue}
                                                            onChange={(e) => setFieldValue('borderStyle', e.target.value)}
                                                            disabled={locked}
                                                        >
                                                            <option value="solid">Solid</option>
                                                            <option value="dashed">Dashed</option>
                                                            <option value="dotted">Dotted</option>
                                                        </select>
                                                        {formErrors.borderStyle && <div className="text-red-500 text-xs mt-1">{formErrors.borderStyle}</div>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                                                value={videoBorderColorValue}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                disabled={locked}
                                                                aria-label="Border color"
                                                            />
                                                            <input
                                                                className="input flex-1 font-mono text-xs"
                                                                value={typeof formValues.borderColor === 'string' ? formValues.borderColor : ''}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                placeholder="#e5e7eb"
                                                                disabled={locked}
                                                            />
                                                        </div>
                                                        {formErrors.borderColor && <div className="text-red-500 text-xs mt-1">{formErrors.borderColor}</div>}
                                                    </div>
                                                </div>
                                            </div>

                                        )}
                                    </div>
                                )}

                                {isVideo && (
                                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80">
                                        <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--fg-muted)]" onClick={() => persistedToggle('py_video_tools_open', setVideoToolsOpen)}>
                                            <div className="flex items-center gap-2">
                                                {videoToolsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                <span>Video settings</span>
                                            </div>
                                            <div />
                                        </button>
                                        {videoToolsOpen && (
                                            <div className="p-3 space-y-3">
                                                <div>
                                                    <div className="text-[color:var(--fg-muted)] font-medium mb-1">Video source</div>
                                                    <p className="text-xs text-[color:var(--fg-muted)]/90">Upload a file, pick an uploaded asset, or paste a link (YouTube, MP4, etc.).</p>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                        <span className="font-medium">Choose video</span>
                                                        <input
                                                            type="file"
                                                            accept="video/*"
                                                            className="sr-only"
                                                            disabled={locked}
                                                            onChange={async (e) => {
                                                                const f = e.target.files?.[0];
                                                                if (!f) { setVideoFileName(''); return; }
                                                                setVideoFileName(f.name);
                                                                try {
                                                                    const metas = await assets.addFiles([f]);
                                                                    const m = metas[0];
                                                                    if (m?.hash) {
                                                                        setFieldValue('src', `asset://${m.hash}`);
                                                                    }
                                                                } catch { /* ignore */ }
                                                            }}
                                                        />
                                                    </label>
                                                    <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${videoFileName ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                                                        {videoFileName || 'No file chosen'}
                                                    </span>
                                                </div>
                                                {videoAssetOptions.length > 0 && (
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from assets</label>
                                                        <select
                                                            className="input"
                                                            disabled={locked}
                                                            value={(() => {
                                                                const src = formValues.src;
                                                                if (typeof src === 'string' && src.startsWith('asset://')) return src.slice('asset://'.length);
                                                                return '';
                                                            })()}
                                                            onChange={async (e) => {
                                                                const hash = e.target.value;
                                                                if (!hash) return;
                                                                setFieldValue('src', `asset://${hash}`);
                                                                try { const meta = await assets.get(hash); setVideoFileName(meta?.name || ''); } catch { /* noop */ }
                                                            }}
                                                        >
                                                            <option value="">Select a video asset…</option>
                                                            {videoAssetOptions.map((asset) => (
                                                                <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Paste video link</label>
                                                    <input
                                                        className="input w-full"
                                                        type="url"
                                                        placeholder="https://www.youtube.com/watch?v=..."
                                                        value={typeof formValues.src === 'string' ? formValues.src : ''}
                                                        onChange={(e) => setFieldValue('src', e.target.value)}
                                                        onKeyDown={handleEnterSubmitComp}
                                                        disabled={locked}
                                                    />
                                                    {formErrors.src && <div className="text-red-500 text-xs mt-1">{formErrors.src}</div>}
                                                </div>
                                                <div className="pt-3 border-t border-[color:var(--border)] space-y-2">
                                                    <div className="text-[color:var(--fg-muted)] font-medium">Poster image (optional)</div>
                                                    <div className="flex items-center gap-3 text-xs">
                                                        <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            <span className="font-medium">Choose image</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="sr-only"
                                                                disabled={locked}
                                                                onChange={async (e) => {
                                                                    const f = e.target.files?.[0];
                                                                    if (!f) { setPosterFileName(''); return; }
                                                                    setPosterFileName(f.name);
                                                                    try {
                                                                        const metas = await assets.addFiles([f]);
                                                                        const m = metas[0];
                                                                        if (m?.hash) {
                                                                            setFieldValue('poster', `asset://${m.hash}`);
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Poster upload failed', err);
                                                                        try { notify({ type: 'error', message: `Failed to upload ${f.name}`, title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
                                                                        setPosterFileName('');
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                        <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${posterFileName ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                                                            {posterFileName || 'No file chosen'}
                                                        </span>
                                                    </div>
                                                    {imageAssetOptions.length > 0 && (
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from assets</label>
                                                            <select
                                                                className="input"
                                                                disabled={locked}
                                                                value={(() => {
                                                                    const poster = formValues.poster;
                                                                    if (typeof poster === 'string' && poster.startsWith('asset://')) return poster.slice('asset://'.length);
                                                                    return '';
                                                                })()}
                                                                onChange={async (e) => {
                                                                    const hash = e.target.value;
                                                                    if (!hash) return;
                                                                    setFieldValue('poster', `asset://${hash}`);
                                                                    try { const meta = await assets.get(hash); setPosterFileName(meta?.name || ''); } catch { /* noop */ }
                                                                }}
                                                            >
                                                                <option value="">Select an image asset…</option>
                                                                {imageAssetOptions.map((asset) => (
                                                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Paste poster link</label>
                                                        <input
                                                            className="input w-full"
                                                            type="url"
                                                            placeholder="https://example.com/poster.jpg"
                                                            value={typeof formValues.poster === 'string' ? formValues.poster : ''}
                                                            onChange={(e) => setFieldValue('poster', e.target.value)}
                                                            onKeyDown={handleEnterSubmitComp}
                                                            disabled={locked}
                                                        />
                                                    </div>
                                                    {formErrors.poster && <div className="text-red-500 text-xs">{formErrors.poster}</div>}
                                                    <div className="text-[10px] text-[color:var(--fg-muted)]">Shown while the player loads.</div>
                                                </div>
                                                <div className="pt-3 border-t border-[color:var(--border)] space-y-3">
                                                    <div className="text-[color:var(--fg-muted)] font-medium">Appearance</div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Background color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                                                value={videoBackgroundColorSwatch}
                                                                onChange={(e) => setFieldValue('backgroundColor', e.target.value)}
                                                                disabled={locked}
                                                                aria-label="Background color"
                                                            />
                                                            <input
                                                                className="input flex-1 font-mono text-xs"
                                                                value={videoBackgroundColorValue}
                                                                onChange={(e) => setFieldValue('backgroundColor', e.target.value)}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                placeholder="var(--surface)"
                                                                disabled={locked}
                                                            />
                                                        </div>
                                                        {formErrors.backgroundColor && <div className="text-red-500 text-xs mt-1">{formErrors.backgroundColor}</div>}
                                                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Use hex colors or CSS vars like var(--surface).</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Shape</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(['rectangle', 'rounded', 'circle'] as const).map((shape) => (
                                                                <button
                                                                    key={shape}
                                                                    type="button"
                                                                    className={`px-3 py-1.5 rounded border text-xs font-semibold transition ${videoShapeValue === shape ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)]' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]'}`}
                                                                    onClick={() => setFieldValue('shape', shape)}
                                                                    disabled={locked}
                                                                >
                                                                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {formErrors.shape && <div className="text-red-500 text-xs mt-1">{formErrors.shape}</div>}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border width (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={48}
                                                                step={1}
                                                                value={videoBorderWidthValue === '' ? '' : videoBorderWidthValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('borderWidth', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.borderWidth && <div className="text-red-500 text-xs mt-1">{formErrors.borderWidth}</div>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border radius (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={240}
                                                                step={1}
                                                                value={videoBorderRadiusValue === '' ? '' : videoBorderRadiusValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('borderRadius', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.borderRadius && <div className="text-red-500 text-xs mt-1">{formErrors.borderRadius}</div>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border style</label>
                                                        <select
                                                            className="input w-full"
                                                            value={videoBorderStyleValue}
                                                            onChange={(e) => setFieldValue('borderStyle', e.target.value)}
                                                            disabled={locked}
                                                        >
                                                            <option value="solid">Solid</option>
                                                            <option value="dashed">Dashed</option>
                                                            <option value="dotted">Dotted</option>
                                                        </select>
                                                        {formErrors.borderStyle && <div className="text-red-500 text-xs mt-1">{formErrors.borderStyle}</div>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                                                value={videoBorderColorValue}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                disabled={locked}
                                                                aria-label="Border color"
                                                            />
                                                            <input
                                                                className="input flex-1 font-mono text-xs"
                                                                value={typeof formValues.borderColor === 'string' ? formValues.borderColor : ''}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                placeholder="#e5e7eb"
                                                                disabled={locked}
                                                            />
                                                        </div>
                                                        {formErrors.borderColor && <div className="text-red-500 text-xs mt-1">{formErrors.borderColor}</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isCarousel && (
                                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80">
                                        <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--fg-muted)]" onClick={() => persistedToggle('py_carousel_tools_open', setCarouselToolsOpen)}>
                                            <div className="flex items-center gap-2">
                                                {carouselToolsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                <span>Carousel slides</span>
                                            </div>
                                            <div />
                                        </button>
                                        {carouselToolsOpen && (
                                            <div className="p-3 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[color:var(--fg-muted)] font-medium">Slides</div>
                                                    <button className="btn btn-ghost btn-xs" type="button" onClick={addCarouselItem} disabled={locked}>Add slide</button>
                                                </div>
                                                <div className="space-y-3">
                                                    {carouselItems.map((slide, idx) => {
                                                        const assetHashForSlide = (typeof slide.source === 'string' && slide.source.startsWith('asset://')) ? slide.source.slice('asset://'.length) : '';
                                                        const currentAsset = assetHashForSlide ? assets.list.find(a => a.hash === assetHashForSlide) : null;
                                                        return (
                                                            <div key={slide.id} className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--surface)] shadow-sm space-y-2">
                                                                <div className="flex items-center justify-between text-xs font-medium">
                                                                    <span>Slide {idx + 1}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button className="btn btn-ghost btn-xs text-[color:var(--fg)] bg-[color:var(--muted)]/40 border border-[color:var(--border)] hover:bg-[color:var(--muted)]/60" type="button" onClick={() => moveCarouselItem(slide.id, -1)} disabled={locked || idx === 0} title="Move up">
                                                                            <ChevronUp size={12} />
                                                                        </button>
                                                                        <button className="btn btn-ghost btn-xs text-[color:var(--fg)] bg-[color:var(--muted)]/40 border border-[color:var(--border)] hover:bg-[color:var(--muted)]/60" type="button" onClick={() => moveCarouselItem(slide.id, 1)} disabled={locked || idx === carouselItems.length - 1} title="Move down">
                                                                            <ChevronDown size={12} />
                                                                        </button>
                                                                        <button className="btn btn-ghost btn-xs text-red-500 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20" type="button" onClick={() => removeCarouselItem(slide.id)} disabled={locked} title="Remove slide">
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Media type</label>
                                                                    <select className="input w-full" value={slide.mediaType} onChange={(e) => updateCarouselItem(slide.id, { mediaType: e.target.value as 'image' | 'video' })} disabled={locked}>
                                                                        <option value="image">Image</option>
                                                                        <option value="video">Video</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Source (asset:// or URL)</label>
                                                                    <input
                                                                        className="input w-full"
                                                                        value={slide.source}
                                                                        onChange={(e) => updateCarouselItem(slide.id, { source: e.target.value })}
                                                                        placeholder="asset://hash or https://example.com/media"
                                                                        disabled={locked}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    {/** always allow uploading a file for a slide (image or video) */}
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                            <span className="font-semibold">Upload</span>
                                                                            <input
                                                                                type="file"
                                                                                accept={slide.mediaType === 'video' ? 'video/*' : 'image/*'}
                                                                                className="sr-only"
                                                                                disabled={locked}
                                                                                onChange={async (e) => {
                                                                                    const file = e.target.files?.[0];
                                                                                    e.currentTarget.value = '';
                                                                                    if (!file) return;
                                                                                    try {
                                                                                        const metas = await assets.addFiles([file]);
                                                                                        const meta = metas[0];
                                                                                        if (meta?.hash) updateCarouselItem(slide.id, { source: `asset://${meta.hash}` });
                                                                                    } catch (err) {
                                                                                        console.error('Slide upload failed', err);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </label>
                                                                        <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]">{currentAsset?.name ?? ((typeof slide.source === 'string' && slide.source.startsWith('asset://')) ? `asset://${assetHashForSlide}` : (slide.source || 'No file chosen'))}</span>
                                                                    </div>
                                                                    {slide.mediaType === 'image' && imageAssetOptions.length > 0 && (
                                                                        <div>
                                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from image assets</label>
                                                                            <select
                                                                                className="input w-full"
                                                                                value={assetHashForSlide}
                                                                                onChange={(e) => {
                                                                                    const hash = e.target.value;
                                                                                    if (!hash) return;
                                                                                    updateCarouselItem(slide.id, { source: `asset://${hash}` });
                                                                                }}
                                                                                disabled={locked}
                                                                            >
                                                                                <option value="">Select an image asset…</option>
                                                                                {imageAssetOptions.map((asset) => (
                                                                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                    {slide.mediaType === 'image' && (
                                                                        <div className="mt-2">
                                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Paste image link</label>
                                                                            <input
                                                                                className="input w-full"
                                                                                type="url"
                                                                                placeholder="https://example.com/image.jpg"
                                                                                value={typeof slide.source === 'string' && !slide.source.startsWith('asset://') ? slide.source : ''}
                                                                                onChange={(e) => updateCarouselItem(slide.id, { source: e.target.value })}
                                                                                disabled={locked}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {slide.mediaType === 'video' && videoAssetOptions.length > 0 && (
                                                                        <div className="mt-2">
                                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from video assets</label>
                                                                            <select
                                                                                className="input w-full"
                                                                                value={assetHashForSlide}
                                                                                onChange={(e) => {
                                                                                    const hash = e.target.value;
                                                                                    if (!hash) return;
                                                                                    updateCarouselItem(slide.id, { source: `asset://${hash}` });
                                                                                }}
                                                                                disabled={locked}
                                                                            >
                                                                                <option value="">Select a video asset…</option>
                                                                                {videoAssetOptions.map((asset) => (
                                                                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                    {slide.mediaType === 'video' && (
                                                                        <div className="mt-2">
                                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Paste video link</label>
                                                                            <input
                                                                                className="input w-full"
                                                                                type="url"
                                                                                placeholder="https://example.com/video.mp4"
                                                                                value={(typeof slide.source === 'string' && !slide.source.startsWith('asset://')) ? slide.source : ''}
                                                                                onChange={(e) => updateCarouselItem(slide.id, { source: e.target.value })}
                                                                                disabled={locked}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {slide.mediaType === 'image' && (
                                                                    <div>
                                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Alt text</label>
                                                                        <input className="input w-full" value={slide.alt} onChange={(e) => updateCarouselItem(slide.id, { alt: e.target.value })} disabled={locked} />
                                                                    </div>
                                                                )}
                                                                {slide.mediaType === 'video' && (
                                                                    <div>
                                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Poster image (optional)</label>
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                                <span className="font-semibold">Upload</span>
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    className="sr-only"
                                                                                    disabled={locked}
                                                                                    onChange={async (e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        e.currentTarget.value = '';
                                                                                        if (!file) return;
                                                                                        try {
                                                                                            const metas = await assets.addFiles([file]);
                                                                                            const meta = metas[0];
                                                                                            if (meta?.hash) updateCarouselItem(slide.id, { poster: `asset://${meta.hash}` });
                                                                                        } catch (err) {
                                                                                            console.error('Poster upload failed', err);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                            <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]">{(typeof slide.poster === 'string' && slide.poster.startsWith('asset://')) ? slide.poster.slice('asset://'.length) : (slide.poster || 'No poster')}</span>
                                                                        </div>
                                                                        {imageAssetOptions.length > 0 && (
                                                                            <div>
                                                                                <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from assets</label>
                                                                                <select
                                                                                    className="input w-full"
                                                                                    value={(() => {
                                                                                        const p = slide.poster;
                                                                                        if (typeof p === 'string' && p.startsWith('asset://')) return p.slice('asset://'.length);
                                                                                        return '';
                                                                                    })()}
                                                                                    disabled={locked}
                                                                                    onChange={(e) => {
                                                                                        const hash = e.target.value;
                                                                                        if (!hash) return;
                                                                                        updateCarouselItem(slide.id, { poster: `asset://${hash}` });
                                                                                    }}
                                                                                >
                                                                                    <option value="">Select an image asset…</option>
                                                                                    {imageAssetOptions.map((asset) => (
                                                                                        <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                        <input className="input w-full mt-2" value={slide.poster || ''} onChange={(e) => updateCarouselItem(slide.id, { poster: e.target.value })} placeholder="asset://hash or URL" disabled={locked} />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Caption</label>
                                                                    <input className="input w-full" value={slide.caption} onChange={(e) => updateCarouselItem(slide.id, { caption: e.target.value })} disabled={locked} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="pt-3 border-t border-[color:var(--border)] space-y-2">
                                                    <div className="text-[color:var(--fg-muted)] font-medium">Appearance</div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Background color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                                                value={videoBackgroundColorSwatch}
                                                                onChange={(e) => setFieldValue('backgroundColor', e.target.value)}
                                                                disabled={locked}
                                                                aria-label="Background color"
                                                            />
                                                            <input
                                                                className="input flex-1 font-mono text-xs"
                                                                value={videoBackgroundColorValue}
                                                                onChange={(e) => setFieldValue('backgroundColor', e.target.value)}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                placeholder="var(--surface)"
                                                                disabled={locked}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Shape</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(['rectangle', 'rounded', 'circle'] as const).map((shape) => (
                                                                <button
                                                                    key={shape}
                                                                    type="button"
                                                                    className={`px-3 py-1.5 rounded border text-xs font-semibold transition ${carouselShapeValue === shape ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)]' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]'}`}
                                                                    onClick={() => setFieldValue('shape', shape)}
                                                                    disabled={locked}
                                                                >
                                                                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {formErrors.shape && <div className="text-red-500 text-xs mt-1">{formErrors.shape}</div>}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border width (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={48}
                                                                step={1}
                                                                value={videoBorderWidthValue === '' ? '' : videoBorderWidthValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('borderWidth', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.borderWidth && <div className="text-red-500 text-xs mt-1">{formErrors.borderWidth}</div>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Radius (px)</label>
                                                            <input
                                                                className="input w-full"
                                                                type="number"
                                                                min={0}
                                                                max={240}
                                                                step={1}
                                                                value={carouselRadiusValue === '' ? '' : carouselRadiusValue}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    setFieldValue('radius', raw === '' ? undefined : Number(raw));
                                                                }}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                disabled={locked}
                                                            />
                                                            {formErrors.radius && <div className="text-red-500 text-xs mt-1">{formErrors.radius}</div>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border style</label>
                                                        <select
                                                            className="input w-full"
                                                            value={videoBorderStyleValue}
                                                            onChange={(e) => setFieldValue('borderStyle', e.target.value)}
                                                            disabled={locked}
                                                        >
                                                            <option value="solid">Solid</option>
                                                            <option value="dashed">Dashed</option>
                                                            <option value="dotted">Dotted</option>
                                                        </select>
                                                        {formErrors.borderStyle && <div className="text-red-500 text-xs mt-1">{formErrors.borderStyle}</div>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Border color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                                                value={videoBorderColorValue}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                disabled={locked}
                                                                aria-label="Border color"
                                                            />
                                                            <input
                                                                className="input flex-1 font-mono text-xs"
                                                                value={typeof formValues.borderColor === 'string' ? formValues.borderColor : ''}
                                                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                                                onKeyDown={handleEnterSubmitComp}
                                                                placeholder="#e5e7eb"
                                                                disabled={locked}
                                                            />
                                                        </div>
                                                        {formErrors.borderColor && <div className="text-red-500 text-xs mt-1">{formErrors.borderColor}</div>}
                                                    </div>
                                                </div>
                                                {carouselError && (
                                                    <div className="text-red-500 text-xs">{carouselError}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {textWidgetSettingsNode}
                                {linkWidgetSettingsNode}
                                {navWidgetSettingsNode}

                                {/* Zod-backed properties */}
                                {zodSchema && (!!defaultFieldNodes.length || !!appearanceFieldNodes.length || defType === 'link') && (
                                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
                                        <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Component Properties</div>
                                        {!!defaultFieldNodes.length && (
                                            <div className="space-y-2">
                                                {defaultFieldNodes}
                                            </div>
                                        )}
                                        {!!appearanceFieldNodes.length && (
                                            <div className={`${defaultFieldNodes.length ? 'pt-3 mt-3 border-t border-[color:var(--border)]' : ''} space-y-2`}>
                                                <div className="text-[color:var(--fg-muted)] font-medium">Appearance</div>
                                                {appearanceFieldNodes}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Widget Properties */}
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 overflow-hidden">
                        <button className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left" onClick={toggleWidgetOpen} title={widgetOpen ? 'Collapse' : 'Expand'} aria-expanded={widgetOpen}>
                            <div className="flex items-center gap-2">
                                {widgetOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Widget Properties</p>
                            </div>
                            <div className="text-[color:var(--fg-muted)]" />
                        </button>
                        {widgetOpen && (
                            <div className="p-4 bg-[color:var(--surface)]/95 space-y-5">
                                {/* Name */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-2">
                                    <label className="block text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Name</label>
                                    <input
                                        className="input w-full"
                                        value={title}
                                        disabled={locked}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onBlur={() => {
                                            const v = title.trim();
                                            if (!locked && v && v !== item.title) {
                                                onRename(v);
                                                notify({ type: 'update', message: `${widgetName} renamed to "${v}"`, title: selectedProject?.name || 'Editor', persistent: false });
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                                e.preventDefault();
                                                const v = title.trim();
                                                if (!locked && v && v !== item.title) {
                                                    onRename(v);
                                                    notify({ type: 'update', message: `${widgetName} renamed to "${v}"`, title: selectedProject?.name || 'Editor', persistent: false });
                                                }
                                            }
                                        }}
                                        data-testid="widget-name-input"
                                    />
                                </div>

                                {/* Protection */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95">
                                    <button className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]" onClick={() => persistedToggle('py_widget_protection_open', setProtectionOpen)}>
                                        <span className="flex items-center gap-2">
                                            {protectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Protection
                                        </span>
                                        <span className="text-[11px] text-[color:var(--fg-muted)]">{protectionOpen ? 'Hide' : 'Show'}</span>
                                    </button>
                                    {protectionOpen && (
                                        <div className="p-4 border-t border-[color:var(--border)] space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors duration-150 ${pinned ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'} ${pinDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => { if (!pinDisabled) onTogglePin(); }}
                                                    title={pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
                                                    disabled={pinDisabled}
                                                >
                                                    {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                                                    <span>{pinned ? 'Pinned' : 'Pin'}</span>
                                                </button>
                                                <button
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors duration-150 ${locked ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                                    onClick={onToggleLock}
                                                    title={locked ? 'Unlock (allow modify)' : 'Lock (prevent modify)'}
                                                >
                                                    {locked ? <Lock size={16} /> : <Unlock size={16} />}
                                                    <span>{locked ? 'Locked' : 'Lock'}</span>
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-[color:var(--fg-muted)]">Pinning keeps the widget anchored while locking prevents accidental edits.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Layer order */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95">
                                    <button className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]" onClick={() => persistedToggle('py_widget_layers_open', setLayerOpen)}>
                                        <span className="flex items-center gap-2">
                                            {layerOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Layer order
                                        </span>
                                        <span className="text-[11px] text-[color:var(--fg-muted)]">{layerOpen ? 'Hide' : 'Show'}</span>
                                    </button>
                                    {layerOpen && (
                                        <div className="p-4 border-t border-[color:var(--border)]">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onBringToFront} disabled={locked} title="Bring to front">
                                                    <span className="flex items-center gap-2"><ChevronsUp size={16} /> Bring to front</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onSendToBack} disabled={locked} title="Send to back">
                                                    <span className="flex items-center gap-2"><ChevronsDown size={16} /> Send to back</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onBringForward} disabled={locked} title="Move up one layer">
                                                    <span className="flex items-center gap-2"><ChevronUp size={16} /> Move up</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onSendBackward} disabled={locked} title="Move down one layer">
                                                    <span className="flex items-center gap-2"><ChevronDown size={16} /> Move down</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Widget info */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-1">
                                    <div className="text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Type</div>
                                    <div className="font-mono text-xs px-3 py-2 rounded-lg bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                                        {item.type ?? 'unknown'}
                                    </div>
                                </div>

                                {/* JSON settings */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-2">
                                    <label className="block text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Advanced: Raw JSON settings</label>
                                    <textarea
                                        className="input w-full font-mono min-h-[10rem]"
                                        value={propsText}
                                        disabled={locked}
                                        onChange={(e) => setPropsText(e.target.value)}
                                        onKeyDown={handleCtrlEnterApplyJson}
                                    />
                                    {propsError && <div className="mt-1 text-xs text-red-500">{propsError}</div>}
                                    <div className="text-[10px] text-[color:var(--fg-muted)]">Use this area for bulk edits or to paste props from another widget.</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[color:var(--border)] bg-[color:var(--surface)]/80">
                    <div>
                        {onDelete && !locked && (
                            <button
                                className="btn btn-error btn-xs inline-flex items-center gap-2"
                                title="Delete widget"
                                aria-label="Delete widget"
                                onClick={() => {
                                    if (confirm('Delete this widget? This cannot be undone.')) {
                                        onDelete();
                                        notify({ type: 'warning', message: `${widgetName} deleted from the editor`, title: selectedProject?.name || 'Editor', persistent: false });
                                    }
                                }}
                            >
                                <Trash2 size={14} />
                                <span>Delete widget</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {zodSchema && (
                            <button className="btn btn-outline btn-xs" onClick={() => { applyProps(); }} disabled={locked} title="Apply raw JSON settings">
                                Apply JSON
                            </button>
                        )}
                        <button className="btn btn-outline btn-xs" onClick={handlePrimaryApply} disabled={locked}>
                            Save changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type TextWidgetSettingsProps = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    locked: boolean;
    setFieldValue: (key: string, value: unknown) => void;
    schemaFields: Map<string, z.ZodTypeAny>;
    onCommitKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    widgetDefaults: Record<string, unknown> | null;
};

function TextWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: TextWidgetSettingsProps) {
    type SectionKey = 'content' | 'typography' | 'accessibility';
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ content: true, typography: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => {
        if (!widgetDefaults) return undefined;
        return widgetDefaults[key];
    };
    const textValue = typeof values.text === 'string'
        ? values.text
        : (typeof getDefault('text') === 'string' ? String(getDefault('text')) : '');
    const formatValue = isTextFormatValue(values.format)
        ? values.format
        : (isTextFormatValue(getDefault('format')) ? getDefault('format') as TextFormatOption : 'plain');
    const variantValue = isTextVariantValue(values.variant)
        ? values.variant
        : (isTextVariantValue(getDefault('variant')) ? getDefault('variant') as TextVariantOption : 'paragraph');
    const alignValue = isTextAlignValue(values.align)
        ? values.align
        : (isTextAlignValue(getDefault('align')) ? getDefault('align') as TextAlignOption : 'left');
    const fontValue = isTextFontValue(values.font)
        ? values.font
        : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');
    const weightValue = isTextWeightValue(values.weight)
        ? values.weight
        : (isTextWeightValue(getDefault('weight')) ? getDefault('weight') as TextWeightOption : 'normal');
    const italicDefault = typeof getDefault('italic') === 'boolean' ? Boolean(getDefault('italic')) : false;
    const italicValue = typeof values.italic === 'boolean' ? values.italic : italicDefault;
    const colorValue = typeof values.color === 'string' ? values.color : (typeof getDefault('color') === 'string' ? String(getDefault('color')) : '');
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 8;
    const maxFontSize = fontSizeMeta?.max ?? 128;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = getDefault('fontSize');
    const fallbackFontSize = typeof defaultFontSize === 'number' && Number.isFinite(defaultFontSize)
        ? Number(defaultFontSize)
        : Math.min(Math.max(16, minFontSize), maxFontSize);
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : fallbackFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const colorSwatch = HEX_COLOR_RE.test(colorValue) ? colorValue : '#1f2937';
    const SectionCard = ({ sectionKey, title, icon, children }: { sectionKey: SectionKey; title: string; icon: React.ReactNode; children: React.ReactNode; }) => {
        const open = sectionsOpen[sectionKey];
        return (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 shadow-sm">
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]"
                    onClick={() => toggleSection(sectionKey)}
                    aria-expanded={open}
                >
                    <span className="flex items-center gap-2">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="flex items-center gap-2 text-[color:var(--fg)]">
                            {icon}
                            {title}
                        </span>
                    </span>
                    <span className="text-[11px] text-[color:var(--fg-muted)]">{open ? 'Hide' : 'Show'}</span>
                </button>
                {open && (
                    <div className="p-4 space-y-4 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
                        {children}
                    </div>
                )}
            </div>
        );
    };
    const variantOptions: Array<{ value: TextVariantOption; label: string; description: string }> = [
        { value: 'paragraph', label: 'Paragraph', description: 'Standard body copy with inline formatting.' },
        { value: 'h2', label: 'Heading 2', description: 'Large section heading.' },
        { value: 'h3', label: 'Heading 3', description: 'Smaller heading for sub-sections.' },
    ];
    const alignmentOptions: Array<{ value: TextAlignOption; label: string; icon: React.ReactNode }> = [
        { value: 'left', label: 'Left align', icon: <AlignLeft size={14} /> },
        { value: 'center', label: 'Center align', icon: <AlignCenter size={14} /> },
        { value: 'right', label: 'Right align', icon: <AlignRight size={14} /> },
    ];
    const fontOptions: Array<{ value: TextFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const formatHelper = formatValue === 'markdown'
        ? 'Use **bold**, _italic_, lists, links, and more with GitHub-flavored Markdown.'
        : 'Best for simple paragraphs. Switch to Markdown for rich formatting.';

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="content" title="Text content" icon={<Type size={14} />}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Text *</label>
                    <textarea
                        className="input w-full min-h-[6rem]"
                        value={textValue}
                        onChange={(e) => setFieldValue('text', e.target.value)}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1 flex items-center justify-between">
                        <span>{textValue.length} characters</span>
                        <span>{formatValue === 'markdown' ? 'Markdown enabled' : 'Plain text'}</span>
                    </div>
                    {errors.text && <div className="text-xs text-red-500 mt-1">{errors.text}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Format</label>
                    <div className="flex flex-wrap gap-2">
                        {TEXT_FORMATS.map((fmt) => (
                            <button
                                key={fmt}
                                type="button"
                                className={`flex-1 min-w-[8rem] px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${formatValue === fmt ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)]' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]/70 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('format', fmt)}
                                disabled={locked}
                            >
                                {fmt === 'plain' ? 'Plain text' : 'Markdown'}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">{formatHelper}</div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<AlignLeft size={14} />}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Variant</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {variantOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${variantValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('variant', option.value)}
                                disabled={locked}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                    {errors.variant && <div className="text-xs text-red-500">{errors.variant}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Alignment</label>
                    <div className="flex flex-wrap gap-2">
                        {alignmentOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`flex-1 min-w-[5rem] px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${alignValue === option.value ? 'bg-[color:var(--accent)]/25 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]/70 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('align', option.value)}
                                disabled={locked}
                                title={option.label}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-[11px]">{option.label.split(' ')[0]}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {errors.align && <div className="text-xs text-red-500 mt-1">{errors.align}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font family</label>
                    <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-white">
                            {fontOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${fontValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                    onClick={() => setFieldValue('font', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{option.label}</span>
                                        <span className="text-lg font-semibold">{option.sample}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    {errors.font && <div className="text-xs text-red-500 mt-1">{errors.font}</div>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Weight</label>
                        <div className="flex gap-2">
                            {TEXT_WEIGHTS.map((weight) => (
                                <button
                                    key={weight}
                                    type="button"
                                    className={`flex-1 px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${weightValue === weight ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('weight', weight)}
                                    disabled={locked}
                                >
                                    <span className="flex items-center gap-1">
                                        <BoldIcon size={14} />
                                        {weight === 'bold' ? 'Bold' : 'Normal'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {errors.weight && <div className="text-xs text-red-500 mt-1">{errors.weight}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Italic</label>
                        <button
                            type="button"
                            className={`w-full px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${italicValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue('italic', !italicValue)}
                            disabled={locked}
                        >
                            <span className="flex items-center gap-2 justify-center">
                                <ItalicIcon size={14} />
                                {italicValue ? 'Enabled' : 'Disabled'}
                            </span>
                        </button>
                        {errors.italic && <div className="text-xs text-red-500 mt-1">{errors.italic}</div>}
                    </div>
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font size</label>
                    <input
                        type="range"
                        className="w-full accent-[color:var(--accent)]"
                        min={minFontSize}
                        max={maxFontSize}
                        step={fontSizeStep}
                        value={sliderFontSize}
                        onChange={(e) => setFieldValue('fontSize', Number(e.target.value))}
                        disabled={locked}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <input
                            className="input w-24"
                            type="number"
                            min={minFontSize}
                            max={maxFontSize}
                            step={fontSizeStep}
                            value={fontSizeInputValue}
                            placeholder={`${minFontSize}-${maxFontSize}`}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setFieldValue('fontSize', raw === '' ? undefined : Number(raw));
                            }}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('fontSize', undefined)}
                            disabled={locked || !customFontSize}
                        >
                            Auto
                        </button>
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : 'Inherit theme size'}</div>
                    </div>
                    {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Text color</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={colorSwatch}
                            onChange={(e) => setFieldValue('color', e.target.value)}
                            disabled={locked}
                            aria-label="Pick text color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={colorValue}
                            placeholder="Inherit"
                            onChange={(e) => setFieldValue('color', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('color', undefined)}
                            disabled={locked || !colorValue}
                        >
                            Reset
                        </button>
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to inherit the theme color or use CSS variables like var(--fg).</div>
                    {errors.color && <div className="text-xs text-red-500 mt-1">{errors.color}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Unlock size={14} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                        <input
                            className="input w-full"
                            value={ariaLabelValue}
                            onChange={(e) => setFieldValue('ariaLabel', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Optional short label"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Helps screen readers describe the block when text is decorative.</div>
                        {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                        <textarea
                            className="input w-full min-h-[4rem]"
                            value={ariaDescriptionValue}
                            onChange={(e) => setFieldValue('ariaDescription', e.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Add extra context that is not visible on screen.</div>
                        {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}

type LinkWidgetSettingsProps = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    locked: boolean;
    setFieldValue: (key: string, value: unknown) => void;
    schemaFields: Map<string, z.ZodTypeAny>;
    onCommitKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    widgetDefaults: Record<string, unknown> | null;
    rawUrl: string;
    fieldError: string | null;
};

function LinkWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults, rawUrl, fieldError }: LinkWidgetSettingsProps) {
    type SectionKey = 'destination' | 'appearance' | 'icons';
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ destination: true, appearance: true, icons: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);
    const urlValue = typeof values.url === 'string'
        ? values.url
        : (typeof getDefault('url') === 'string' ? String(getDefault('url')) : '');
    const labelValue = typeof values.label === 'string'
        ? values.label
        : (typeof getDefault('label') === 'string' ? String(getDefault('label')) : '');
    const variantValue = isLinkVariantValue(values.variant)
        ? values.variant
        : (isLinkVariantValue(getDefault('variant')) ? getDefault('variant') as LinkVariantOption : 'button');
    const fontValue = isLinkFontValue(values.font)
        ? values.font as LinkFontOption
        : (isLinkFontValue(getDefault('font')) ? getDefault('font') as LinkFontOption : 'system');
    const weightValue = isLinkWeightValue(values.weight)
        ? values.weight as LinkWeightOption
        : (isLinkWeightValue(getDefault('weight')) ? getDefault('weight') as LinkWeightOption : 'bold');
    const italicDefault = typeof getDefault('italic') === 'boolean' ? Boolean(getDefault('italic')) : false;
    const italicValue = typeof values.italic === 'boolean' ? values.italic : italicDefault;
    const iconLeftValue = typeof values.iconLeft === 'string' ? values.iconLeft : '';
    const iconRightValue = typeof values.iconRight === 'string' ? values.iconRight : '';
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 8;
    const maxFontSize = fontSizeMeta?.max ?? 128;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = widgetDefaults && typeof widgetDefaults.fontSize === 'number' ? widgetDefaults.fontSize : 16;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const SectionCard = ({ sectionKey, title, icon, children }: { sectionKey: SectionKey; title: string; icon: React.ReactNode; children: React.ReactNode; }) => {
        const open = sectionsOpen[sectionKey];
        return (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 shadow-sm">
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
                    onClick={() => toggleSection(sectionKey)}
                    aria-expanded={open}
                >
                    <span className="flex items-center gap-2 text-[color:var(--fg)]">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="flex items-center gap-2 text-[color:var(--fg)]">
                            {icon}
                            {title}
                        </span>
                    </span>
                    <span className="text-[11px] text-[color:var(--fg-muted)]">{open ? 'Hide' : 'Show'}</span>
                </button>
                {open && (
                    <div className="p-4 space-y-4 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
                        {children}
                    </div>
                )}
            </div>
        );
    };
    const variantOptions: Array<{ value: LinkVariantOption; label: string; description: string }> = [
        { value: 'button', label: 'Button', description: 'Rounded pill-style button with accent fill.' },
        { value: 'text', label: 'Text link', description: 'Inline link that inherits theme accent.' },
        { value: 'card', label: 'Card', description: 'Full-width card with border and metadata.' },
    ];
    const fontOptions: Array<{ value: LinkFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const iconCharLimit = 24;
    return (
        <div className="space-y-4">
            <SectionCard sectionKey="destination" title="Destination & label" icon={<LinkIcon size={14} />}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">URL *</label>
                    <SchemaUrlField
                        value={urlValue}
                        disabled={locked}
                        onChange={(next) => setFieldValue('url', next ?? '')}
                        onKeyDown={onCommitKeyDown}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)]">Supports {ALLOWED_HTTP_SCHEME_LABEL} links. Missing protocol defaults to https://.</div>
                    {errors.url && <div className="text-xs text-red-500">{errors.url}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Label *</label>
                    <input
                        className="input w-full"
                        value={labelValue}
                        maxLength={80}
                        onChange={(e) => setFieldValue('label', e.target.value)}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                        <span>{labelValue.length}/80 characters</span>
                        <span>Shown to visitors</span>
                    </div>
                    {errors.label && <div className="text-xs text-red-500 mt-1">{errors.label}</div>}
                </div>
                <LinkPreviewPanel rawUrl={rawUrl} fieldError={fieldError} disabled={locked} />
            </SectionCard>

            <SectionCard sectionKey="appearance" title="Appearance" icon={<Palette size={14} />}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Variant</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {variantOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${variantValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('variant', option.value)}
                                disabled={locked}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                    {errors.variant && <div className="text-xs text-red-500">{errors.variant}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font</label>
                    <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-white">
                            {fontOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${fontValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                    onClick={() => setFieldValue('font', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{option.label}</span>
                                        <span className="text-lg font-semibold">{option.sample}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    {errors.font && <div className="text-xs text-red-500 mt-1">{errors.font}</div>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Weight</label>
                        <div className="flex gap-2">
                            {TEXT_WEIGHTS.map((weight) => (
                                <button
                                    key={weight}
                                    type="button"
                                    className={`flex-1 px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${weightValue === weight ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('weight', weight)}
                                    disabled={locked}
                                >
                                    <span className="flex items-center gap-1">
                                        <BoldIcon size={14} />
                                        {weight === 'bold' ? 'Bold' : 'Normal'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {errors.weight && <div className="text-xs text-red-500 mt-1">{errors.weight}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Italic</label>
                        <button
                            type="button"
                            className={`w-full px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${italicValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue('italic', !italicValue)}
                            disabled={locked}
                        >
                            <span className="flex items-center gap-2 justify-center">
                                <ItalicIcon size={14} />
                                {italicValue ? 'Enabled' : 'Disabled'}
                            </span>
                        </button>
                        {errors.italic && <div className="text-xs text-red-500 mt-1">{errors.italic}</div>}
                    </div>
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font size</label>
                    <input
                        type="range"
                        className="w-full accent-[color:var(--accent)]"
                        min={minFontSize}
                        max={maxFontSize}
                        step={fontSizeStep}
                        value={sliderFontSize}
                        onChange={(e) => setFieldValue('fontSize', Number(e.target.value))}
                        disabled={locked}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <input
                            className="input w-24"
                            type="number"
                            min={minFontSize}
                            max={maxFontSize}
                            step={fontSizeStep}
                            value={fontSizeInputValue}
                            placeholder={`${minFontSize}-${maxFontSize}`}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setFieldValue('fontSize', raw === '' ? undefined : Number(raw));
                            }}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('fontSize', undefined)}
                            disabled={locked || !customFontSize}
                        >
                            Auto
                        </button>
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : `Defaults to ${defaultFontSize}px`}</div>
                    </div>
                    {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="icons" title="Icons & accessibility" icon={<Sparkles size={14} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Icon left</label>
                        <input
                            className="input w-full"
                            value={iconLeftValue}
                            maxLength={iconCharLimit}
                            onChange={(e) => setFieldValue('iconLeft', e.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                            <span>{iconLeftValue.length}/{iconCharLimit}</span>
                            <span>Emoji or short text</span>
                        </div>
                        {errors.iconLeft && <div className="text-xs text-red-500 mt-1">{errors.iconLeft}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Icon right</label>
                        <input
                            className="input w-full"
                            value={iconRightValue}
                            maxLength={iconCharLimit}
                            onChange={(e) => setFieldValue('iconRight', e.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                            <span>{iconRightValue.length}/{iconCharLimit}</span>
                            <span>Optional suffix</span>
                        </div>
                        {errors.iconRight && <div className="text-xs text-red-500 mt-1">{errors.iconRight}</div>}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                        <input
                            className="input w-full"
                            value={ariaLabelValue}
                            onChange={(e) => setFieldValue('ariaLabel', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Optional short label"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Overrides the spoken label for screen readers.</div>
                        {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                        <textarea
                            className="input w-full min-h-[4rem]"
                            value={ariaDescriptionValue}
                            onChange={(e) => setFieldValue('ariaDescription', e.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Add longer context without cluttering the UI.</div>
                        {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}

type NavLinkPageOption = { id: string; title: string };

type NavLinkWidgetSettingsProps = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    locked: boolean;
    setFieldValue: (key: string, value: unknown) => void;
    schemaFields: Map<string, z.ZodTypeAny>;
    onCommitKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    widgetDefaults: Record<string, unknown> | null;
    pages: NavLinkPageOption[];
};

function NavLinkWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults, pages }: NavLinkWidgetSettingsProps) {
    type SectionKey = 'destination' | 'style' | 'colors' | 'accessibility';
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ destination: true, style: true, colors: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);
    const labelValue = typeof values.label === 'string'
        ? values.label
        : (typeof getDefault('label') === 'string' ? String(getDefault('label')) : '');
    const targetPageValue = typeof values.targetPageId === 'string'
        ? values.targetPageId
        : (typeof getDefault('targetPageId') === 'string' ? String(getDefault('targetPageId')) : '');
    const styleValue = isNavLinkStyleValue(values.style)
        ? values.style as NavLinkStyleOption
        : (isNavLinkStyleValue(getDefault('style')) ? getDefault('style') as NavLinkStyleOption : 'link');
    const alignValue = isTextAlignValue(values.align)
        ? values.align as TextAlignOption
        : (isTextAlignValue(getDefault('align')) ? getDefault('align') as TextAlignOption : 'left');
    const fontValue = isTextFontValue(values.font)
        ? values.font as TextFontOption
        : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');
    const underlineDefault = typeof getDefault('underline') === 'boolean' ? Boolean(getDefault('underline')) : false;
    const underlineValue = typeof values.underline === 'boolean' ? values.underline : underlineDefault;
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const colorDefault = typeof getDefault('color') === 'string' ? String(getDefault('color')) : '';
    const colorValue = typeof values.color === 'string' ? values.color : colorDefault;
    const textColorDefault = typeof getDefault('textColor') === 'string' ? String(getDefault('textColor')) : '';
    const textColorValue = typeof values.textColor === 'string' ? values.textColor : textColorDefault;
    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 10;
    const maxFontSize = fontSizeMeta?.max ?? 64;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = typeof getDefault('fontSize') === 'number' ? Number(getDefault('fontSize')) : 14;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const labelCharLimit = 60;
    const SectionCard = ({ sectionKey, title, icon, children }: { sectionKey: SectionKey; title: string; icon: React.ReactNode; children: React.ReactNode; }) => {
        const open = sectionsOpen[sectionKey];
        return (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 shadow-sm">
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
                    onClick={() => toggleSection(sectionKey)}
                    aria-expanded={open}
                >
                    <span className="flex items-center gap-2 text-[color:var(--fg)]">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="flex items-center gap-2 text-[color:var(--fg)]">
                            {icon}
                            {title}
                        </span>
                    </span>
                    <span className="text-[11px] text-[color:var(--fg-muted)]">{open ? 'Hide' : 'Show'}</span>
                </button>
                {open && (
                    <div className="p-4 space-y-4 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
                        {children}
                    </div>
                )}
            </div>
        );
    };
    const styleOptions: Array<{ value: NavLinkStyleOption; label: string; description: string }> = [
        { value: 'link', label: 'Text link', description: 'Inline link that matches your theme.' },
        { value: 'button', label: 'Button', description: 'Solid button with accent background.' },
    ];
    const fontOptions: Array<{ value: TextFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const alignmentOptions: Array<{ value: TextAlignOption; label: string; icon: React.ReactNode }> = [
        { value: 'left', label: 'Left', icon: <AlignLeft size={14} /> },
        { value: 'center', label: 'Center', icon: <AlignCenter size={14} /> },
        { value: 'right', label: 'Right', icon: <AlignRight size={14} /> },
    ];
    const toColorInput = (value: string, fallback: string) => (HEX_COLOR_RE.test(value) ? value : fallback);
    const linkColorSwatch = toColorInput(colorValue, '#2563eb');
    const buttonTextColorSwatch = toColorInput(textColorValue || colorValue, '#ffffff');
    const hasPages = pages.length > 0;
    return (
        <div className="space-y-4">
            <SectionCard sectionKey="destination" title="Destination & label" icon={<LinkIcon size={14} />}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Target page *</label>
                    {hasPages ? (
                        <select
                            className="input w-full"
                            value={targetPageValue}
                            onChange={(e) => setFieldValue('targetPageId', e.target.value)}
                            disabled={locked}
                        >
                            <option value="">Select page…</option>
                            {pages.map((page) => (
                                <option key={page.id} value={page.id}>{page.title}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="px-3 py-2 rounded-lg border border-dashed border-[color:var(--border)] text-xs text-[color:var(--fg-muted)] bg-[color:var(--muted)]/30">
                            No pages available. Create a page in the canvas sidebar first.
                        </div>
                    )}
                    {errors.targetPageId && <div className="text-xs text-red-500 mt-1">{errors.targetPageId}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Label *</label>
                    <input
                        className="input w-full"
                        value={labelValue}
                        maxLength={labelCharLimit}
                        onChange={(e) => setFieldValue('label', e.target.value)}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                        <span>{labelValue.length}/{labelCharLimit}</span>
                        <span>Shown on the button/link</span>
                    </div>
                    {errors.label && <div className="text-xs text-red-500 mt-1">{errors.label}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="style" title="Style & typography" icon={<Type size={14} />}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Style</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {styleOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${styleValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('style', option.value)}
                                disabled={locked}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                    {errors.style && <div className="text-xs text-red-500">{errors.style}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Alignment</label>
                    <div className="flex flex-wrap gap-2">
                        {alignmentOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`flex-1 min-w-[5rem] px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${alignValue === option.value ? 'bg-[color:var(--accent)]/25 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]/70 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('align', option.value)}
                                disabled={locked}
                                title={`${option.label} align`}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-[11px]">{option.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {errors.align && <div className="text-xs text-red-500 mt-1">{errors.align}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font</label>
                    <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-white">
                            {fontOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${fontValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                    onClick={() => setFieldValue('font', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{option.label}</span>
                                        <span className="text-lg font-semibold">{option.sample}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    {errors.font && <div className="text-xs text-red-500 mt-1">{errors.font}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font size</label>
                    <input
                        type="range"
                        className="w-full accent-[color:var(--accent)]"
                        min={minFontSize}
                        max={maxFontSize}
                        step={fontSizeStep}
                        value={sliderFontSize}
                        onChange={(e) => setFieldValue('fontSize', Number(e.target.value))}
                        disabled={locked}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <input
                            className="input w-24"
                            type="number"
                            min={minFontSize}
                            max={maxFontSize}
                            step={fontSizeStep}
                            value={fontSizeInputValue}
                            placeholder={`${minFontSize}-${maxFontSize}`}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setFieldValue('fontSize', raw === '' ? undefined : Number(raw));
                            }}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('fontSize', undefined)}
                            disabled={locked || !customFontSize}
                        >
                            Auto
                        </button>
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : `Defaults to ${defaultFontSize}px`}</div>
                    </div>
                    {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                </div>

                {styleValue === 'link' && (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Underline</label>
                        <button
                            type="button"
                            className={`w-full px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${underlineValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue('underline', !underlineValue)}
                            disabled={locked}
                        >
                            {underlineValue ? 'Underline enabled' : 'Underline disabled'}
                        </button>
                        {errors.underline && <div className="text-xs text-red-500 mt-1">{errors.underline}</div>}
                    </div>
                )}
            </SectionCard>

            <SectionCard sectionKey="colors" title="Colors" icon={<Palette size={14} />}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">{styleValue === 'button' ? 'Background color' : 'Link color'}</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={linkColorSwatch}
                            onChange={(e) => setFieldValue('color', e.target.value)}
                            disabled={locked}
                            aria-label="Primary color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={colorValue}
                            placeholder={styleValue === 'button' ? '#2563eb' : 'currentColor'}
                            onChange={(e) => setFieldValue('color', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('color', undefined)}
                            disabled={locked || !colorValue}
                        >
                            Reset
                        </button>
                    </div>
                    {errors.color && <div className="text-xs text-red-500 mt-1">{errors.color}</div>}
                </div>

                {styleValue === 'button' && (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Text color</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="color"
                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                value={buttonTextColorSwatch}
                                onChange={(e) => setFieldValue('textColor', e.target.value)}
                                disabled={locked}
                                aria-label="Button text color"
                            />
                            <input
                                className="input flex-1 font-mono text-xs"
                                value={textColorValue}
                                placeholder="#ffffff"
                                onChange={(e) => setFieldValue('textColor', e.target.value)}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                onClick={() => setFieldValue('textColor', undefined)}
                                disabled={locked || !textColorValue}
                            >
                                Reset
                            </button>
                        </div>
                        {errors.textColor && <div className="text-xs text-red-500 mt-1">{errors.textColor}</div>}
                    </div>
                )}
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Sparkles size={14} />}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                    <input
                        className="input w-full"
                        value={ariaLabelValue}
                        onChange={(e) => setFieldValue('ariaLabel', e.target.value || undefined)}
                        onKeyDown={onCommitKeyDown}
                        placeholder="Optional label for screen readers"
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Overrides the spoken label when the visible text is ambiguous.</div>
                    {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                </div>
            </SectionCard>
        </div>
    );
}

type SchemaAssetFieldProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    assets: AssetsCtx;
    assetKind: AssetKind;
    onChange: (value?: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function SchemaAssetField({ value, placeholder, disabled, assets, assetKind, onChange, onKeyDown }: SchemaAssetFieldProps) {
    const filteredAssets = useMemo(() => {
        return assets.list.filter((asset) => {
            if (!asset.type) return true;
            if (assetKind === 'video') return asset.type.startsWith('video/');
            if (assetKind === 'image') return asset.type.startsWith('image/');
            return true;
        });
    }, [assets.list, assetKind]);
    const assetHash = value.startsWith('asset://') ? value.slice('asset://'.length) : '';
    const currentAsset = assetHash ? assets.list.find((asset) => asset.hash === assetHash) : null;
    const accept = assetKind === 'image' ? 'image/*' : assetKind === 'video' ? 'video/*' : '*/*';
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className="font-semibold">Upload</span>
                    <input
                        type="file"
                        accept={accept}
                        className="sr-only"
                        disabled={disabled}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                                const metas = await assets.addFiles([file]);
                                const meta = metas[0];
                                if (meta?.hash) onChange(`asset://${meta.hash}`);
                            } catch (err) {
                                console.error('Asset upload failed', err);
                            }
                        }}
                    />
                </label>
                <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]">
                    {currentAsset?.name ?? (assetHash ? `asset://${assetHash}` : 'No asset selected')}
                </span>
            </div>
            {filteredAssets.length > 0 && (
                <select
                    className="input w-full"
                    value={assetHash}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value ? `asset://${e.target.value}` : undefined)}
                >
                    <option value="">Select asset…</option>
                    {filteredAssets.map((asset) => (
                        <option key={asset.hash} value={asset.hash}>
                            {asset.name}
                        </option>
                    ))}
                </select>
            )}
            <input
                className="input w-full font-mono text-xs"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
        </div>
    );
}

type SchemaUrlFieldProps = {
    value: string;
    disabled: boolean;
    onChange: (value?: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function SchemaUrlField({ value, disabled, onChange, onKeyDown }: SchemaUrlFieldProps) {
    return (
        <div className="space-y-1">
            <input
                className="input w-full"
                type="url"
                placeholder="https://example.com"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
            <div className="flex flex-wrap gap-1">
                {URL_PROTOCOL_SUGGESTIONS.map((proto) => (
                    <button
                        key={proto}
                        type="button"
                        className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                        onClick={() => onChange(proto)}
                        disabled={disabled}
                    >
                        {proto}
                    </button>
                ))}
                {value && (
                    <button
                        type="button"
                        className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                        onClick={() => onChange(undefined)}
                        disabled={disabled}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}

type SchemaNumberFieldProps = {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled: boolean;
    onChange: (value: number | undefined) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function SchemaNumberField({ value, min, max, step, disabled, onChange, onKeyDown }: SchemaNumberFieldProps) {
    const stepValue = step ?? 1;
    const formattedStep = Number.isInteger(stepValue) ? stepValue.toFixed(0) : stepValue.toString();
    const handleChange = (raw: string) => {
        if (raw === '') { onChange(undefined); return; }
        const num = Number(raw);
        if (Number.isNaN(num)) { onChange(undefined); return; }
        onChange(num);
    };
    const adjust = (delta: number) => {
        const current = typeof value === 'number' ? value : (typeof min === 'number' ? min : 0);
        let next = current + delta;
        if (typeof min === 'number') next = Math.max(min, next);
        if (typeof max === 'number') next = Math.min(max, next);
        onChange(Number(next.toFixed(4)));
    };
    return (
        <div className="flex items-stretch gap-2">
            <input
                className="input w-full"
                type="number"
                value={value === undefined ? '' : value}
                min={min}
                max={max}
                step={stepValue}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
            <div className="flex flex-col gap-1">
                <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjust(stepValue)} disabled={disabled}>+{formattedStep}</button>
                <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjust(-stepValue)} disabled={disabled}>-{formattedStep}</button>
            </div>
        </div>
    );
}
