import React, { useEffect, useMemo, useState } from "react";
import { Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, ChevronRight, X, Trash2 } from "lucide-react";
import { z } from "zod";

import { useAssets } from "../../../providers/AssetsProvider";
import type { AssetsCtx } from "../../../providers/AssetsProvider";
import { useNotifications } from "../../../providers/NotificationsProvider";
import { useProjects } from "../../../providers/ProjectsProvider";
import { WidgetsRegistry } from "../../../widgets/registry";
import type { CarouselItem } from "../../../widgets/defs/Carousel";
import { ALLOWED_HTTP_SCHEME_LABEL } from "../../../widgets/utils/linkUrl";
import type { GridItem } from "../canvas/DraggableItem";

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

type AssetKind = 'image' | 'video' | 'media';

function hasUrlValidation(field: z.ZodTypeAny) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onApplyProps: (props: any) => void;
}) {
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
    const [defType, setDefType] = useState<string | null>(null);
    const [imageFileName, setImageFileName] = useState<string>("");
    const [videoFileName, setVideoFileName] = useState<string>("");
    const [posterFileName, setPosterFileName] = useState<string>("");
    const [carouselItems, setCarouselItems] = useState<CarouselEditorItem[]>([]);
    const [carouselError, setCarouselError] = useState<string | null>(null);
    const assets = useAssets();
    const imageAssetOptions = useMemo(() => assets.list.filter(asset => asset.type?.startsWith('image/')), [assets.list]);
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
                const schema = (def as unknown as { zodSchema?: z.ZodObject<z.ZodRawShape> }).zodSchema;
                setZodSchema(schema ?? null);
                if (schema) {
                    // Initialize form values from current props with defaults for missing keys
                    const shape = schema.shape;
                    const initial: Record<string, unknown> = {};
                    for (const key of Object.keys(shape)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const current = (item.props as any)?.[key];
                        initial[key] = current !== undefined ? current : undefined;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setFormValues({ ...initial, ...(item.props as any) });
                    // Validate once to populate errors
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const res = schema.safeParse({ ...initial, ...(item.props as any) });
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
                    setFormValues({});
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

    const schemaFieldBuckets = {
        default: [] as Array<[string, z.ZodTypeAny]>,
        appearance: [] as Array<[string, z.ZodTypeAny]>,
    };
    if (zodSchema) {
        for (const [key, schema] of Object.entries(zodSchema.shape)) {
            if (isVideo && (key === 'src' || key === 'poster' || VIDEO_APPEARANCE_FIELDS.has(key))) {
                continue;
            }
            const bucket = isAppearanceField(defType, key) ? schemaFieldBuckets.appearance : schemaFieldBuckets.default;
            bucket.push([key, schema as z.ZodTypeAny]);
        }
    }

    const renderSchemaField = (key: string, schema: z.ZodTypeAny): React.ReactElement | null => {
        if (!zodSchema) return null;
        const field = schema as z.ZodTypeAny;
        const isOptional = field instanceof z.ZodOptional;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let baseField: z.ZodTypeAny = isOptional ? (field._def as any).innerType as z.ZodTypeAny : field;
        if (baseField instanceof z.ZodDefault) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            baseField = (baseField._def as any).innerType as z.ZodTypeAny;
        }
        if (baseField instanceof z.ZodNullable) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    return (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            data-testid="modify-widget-modal"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
        >
            <div
                className="surface w-full max-w-4xl border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-auto scrollable scrollable-container"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleEnterSubmitAnywhere}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] modal-header-sticky">
                    <div>
                        <h2 className="text-lg font-semibold">Modify Widget</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Edit properties, layout and behavior for the selected widget</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4 space-y-5 text-sm">
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
                                                        const assetOptions = assets.list.filter((asset) => {
                                                            if (slide.mediaType === 'video') return asset.type?.startsWith('video/');
                                                            return asset.type?.startsWith('image/');
                                                        });
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
                                                                {assetOptions.length > 0 && (
                                                                    <div>
                                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Pick from assets</label>
                                                                        <select
                                                                            className="input w-full"
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                const hash = e.target.value;
                                                                                if (!hash) return;
                                                                                updateCarouselItem(slide.id, { source: `asset://${hash}` });
                                                                            }}
                                                                            disabled={locked}
                                                                        >
                                                                            <option value="">Select asset…</option>
                                                                            {assetOptions.map((asset) => (
                                                                                <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                                {slide.mediaType === 'image' && (
                                                                    <div>
                                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Alt text</label>
                                                                        <input className="input w-full" value={slide.alt} onChange={(e) => updateCarouselItem(slide.id, { alt: e.target.value })} disabled={locked} />
                                                                    </div>
                                                                )}
                                                                {slide.mediaType === 'video' && (
                                                                    <div>
                                                                        <label className="block text-[color:var(--fg-muted)] text-xs mb-1">Poster image (optional)</label>
                                                                        <input className="input w-full" value={slide.poster || ''} onChange={(e) => updateCarouselItem(slide.id, { poster: e.target.value })} placeholder="asset://hash or URL" disabled={locked} />
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
                                                {carouselError && (
                                                    <div className="text-red-500 text-xs">{carouselError}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Zod-backed properties */}
                                {zodSchema && (
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
                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <button className="btn btn-outline btn-xs" onClick={() => { applyForm(); }} disabled={locked}>Apply</button>
                                        </div>
                                        {defType === 'link' && (
                                            <LinkPreviewPanel rawUrl={linkRawUrl} fieldError={linkFieldError} disabled={locked} />
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
                            <div className="p-4 bg-[color:var(--surface)]/90 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-[color:var(--fg-muted)] mb-1">Name</label>
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
                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80">
                                    <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--fg-muted)]" onClick={() => persistedToggle('py_widget_protection_open', setProtectionOpen)}>
                                        <div className="flex items-center gap-2">
                                            {protectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <span>Protection</span>
                                        </div>
                                        <div />
                                    </button>
                                    {protectionOpen && (
                                        <div className="p-3 bg-[color:var(--surface)]/90">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className={`btn btn-ghost flex items-center gap-2 ${pinDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => { if (!pinDisabled) onTogglePin(); }}
                                                    title={pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
                                                    disabled={pinDisabled}
                                                >
                                                    {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                                                    <span>{pinned ? 'Pinned' : 'Pin'}</span>
                                                </button>
                                                <button
                                                    className="btn btn-ghost flex items-center gap-2"
                                                    onClick={onToggleLock}
                                                    title={locked ? 'Unlock (allow modify)' : 'Lock (prevent modify)'}
                                                >
                                                    {locked ? <Lock size={16} /> : <Unlock size={16} />}
                                                    <span>{locked ? 'Locked' : 'Lock'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Layer order */}
                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/80">
                                    <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--fg-muted)]" onClick={() => persistedToggle('py_widget_layers_open', setLayerOpen)}>
                                        <div className="flex items-center gap-2">
                                            {layerOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <span>Layer order</span>
                                        </div>
                                        <div />
                                    </button>
                                    {layerOpen && (
                                        <div className="p-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <button className="btn btn-ghost flex items-center gap-2" onClick={onBringToFront} disabled={locked} title="Bring to front">
                                                    <ChevronsUp size={16} /> Bring to front
                                                </button>
                                                <button className="btn btn-ghost flex items-center gap-2" onClick={onSendToBack} disabled={locked} title="Send to back">
                                                    <ChevronsDown size={16} /> Send to back
                                                </button>
                                                <button className="btn btn-ghost flex items-center gap-2" onClick={onBringForward} disabled={locked} title="Move up one layer">
                                                    <ChevronUp size={16} /> Move up
                                                </button>
                                                <button className="btn btn-ghost flex items-center gap-2" onClick={onSendBackward} disabled={locked} title="Move down one layer">
                                                    <ChevronDown size={16} /> Move down
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Widget info */}
                                <div>
                                    <div className="text-[color:var(--fg-muted)] mb-1">Type</div>
                                    <div className="font-mono text-xs px-2 py-1 rounded bg-[color:var(--muted)]/40 border border-[color:var(--border)] inline-block">
                                        {item.type ?? 'unknown'}
                                    </div>
                                </div>

                                {/* JSON settings */}
                                <div className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--muted)]/40">
                                    <label className="block text-[color:var(--fg-muted)] mb-1">Advanced: Raw JSON settings</label>
                                    <textarea
                                        className="input w-full font-mono min-h-[10rem]"
                                        value={propsText}
                                        disabled={locked}
                                        onChange={(e) => setPropsText(e.target.value)}
                                        onKeyDown={handleCtrlEnterApplyJson}
                                    />
                                    {propsError && <div className="mt-1 text-xs text-red-500">{propsError}</div>}
                                    <div className="mt-2 flex items-center justify-end gap-2">
                                        <button className="btn btn-outline btn-xs" onClick={() => { applyProps(); }} disabled={locked}>Apply JSON</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Footer actions: bottom-right delete icon to match page modal placement */}
                {onDelete && !locked && (
                    <div className="mt-4 flex items-center justify-end">
                        <button
                            className="inline-flex items-center justify-center p-2 rounded bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
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
                        </button>
                    </div>
                )}
            </div>
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
            if (assetKind === 'image') return asset.type?.startsWith('image/');
            if (assetKind === 'video') return asset.type?.startsWith('video/');
            return true;
        });
    }, [assets.list, assetKind]);
    const assetHash = value.startsWith('asset://') ? value.slice('asset://'.length) : '';
    const currentAsset = assetHash ? assets.list.find((a) => a.hash === assetHash) : null;
    const accept = assetKind === 'image' ? 'image/*' : assetKind === 'video' ? 'video/*' : '*/*';
    return (
        <div className="space-y-2">
            <div className={`flex flex-wrap items-center gap-2 text-xs`}>
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
                        <option key={asset.hash} value={asset.hash}>{asset.name}</option>
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
