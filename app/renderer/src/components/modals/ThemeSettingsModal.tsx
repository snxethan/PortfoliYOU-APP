import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';
import { X, Copy, Palette, Trash2 } from "lucide-react";

import { useProjects } from "../../providers/ProjectsProvider";
import { THEME_PRESETS } from "../../themes/presets";
import type { Theme } from "../../themes/types";

type ThemeSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

type ColorKey = keyof Theme['colors'];

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="w-10 h-10 rounded border border-[color:var(--border)] bg-[color:var(--surface)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color`}
        />
        <input
          className="input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </label>
  );
}

export default function ThemeSettingsModal({ open, onClose }: ThemeSettingsModalProps) {
  const {
    selectedProject,
    activeTheme,
    setActiveTheme,
    duplicateTheme,
    deleteTheme,
    updateTheme,
    createThemeFromPreset,
  } = useProjects();
  const [nameDraft, setNameDraft] = useState<string>(activeTheme?.name || '');

  useEffect(() => {
    setNameDraft(activeTheme?.name || '');
  }, [activeTheme?.themeId]);

  if (!open) return null;

  const hasTheme = Boolean(selectedProject && activeTheme);
  const themeEntries = useMemo(() => hasTheme ? Object.values(selectedProject!.themes || {}) : [], [hasTheme, selectedProject?.themes]);
  const canDelete = hasTheme && themeEntries.length > 1;

  const handleColorChange = (key: ColorKey, next: string) => {
    if (!next || !selectedProject || !activeTheme) return;
    updateTheme(selectedProject.id, activeTheme.themeId, { colors: { [key]: next } as Partial<Theme['colors']> });
  };

  const handleFontChange = (field: 'heading' | 'body', next: string) => {
    if (!selectedProject || !activeTheme) return;
    updateTheme(selectedProject.id, activeTheme.themeId, { typography: { [field]: next } });
  };

  const handleScaleChange = (value: number) => {
    if (!selectedProject || !activeTheme) return;
    updateTheme(selectedProject.id, activeTheme.themeId, { typography: { scale: value } });
  };

  const commitThemeName = () => {
    if (!selectedProject || !activeTheme) return;
    const trimmed = (nameDraft || '').trim();
    if (!trimmed) { setNameDraft(activeTheme.name); return; }
    if (trimmed === activeTheme.name) return;
    updateTheme(selectedProject.id, activeTheme.themeId, { name: trimmed });
  };

  const body = (
    <div
      className="surface w-full max-w-5xl max-h-[90vh] p-6 border border-[color:var(--border)] rounded-xl shadow-xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] pb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Theme engine</p>
          {hasTheme ? (
            <div className="mt-2">
              <label className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Theme name</label>
              <input
                className="input mt-1"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitThemeName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitThemeName(); }
                  if (e.key === 'Escape') { e.preventDefault(); setNameDraft(activeTheme!.name); }
                }}
              />
              <p className="text-[11px] text-[color:var(--fg-muted)] mt-1">Press Enter to save.</p>
            </div>
          ) : (
            <h2 className="text-xl font-semibold mt-2">Customize portfolio theme</h2>
          )}
        </div>
        <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close theme settings">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 py-4">
        {hasTheme ? (
          <div className="space-y-6 pr-1">
            <section className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold tracking-wide text-sm">Saved themes</h3>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => duplicateTheme(selectedProject!.id, activeTheme!.themeId, { activate: true })}
                  >
                    <Copy size={12} className="mr-1" /> Duplicate
                  </button>
                  <button
                    className="btn btn-outline btn-xs"
                    disabled={!canDelete}
                    onClick={() => canDelete && deleteTheme(selectedProject!.id, activeTheme!.themeId)}
                  >
                    <Trash2 size={12} className="mr-1" /> Delete
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {themeEntries.map((theme) => (
                  <button
                    key={theme.themeId}
                    className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${theme.themeId === activeTheme!.themeId ? 'border-[color:var(--accent)] bg-[color:var(--muted)]/40' : 'border-[color:var(--border)] bg-[color:var(--surface)]'}`}
                    onClick={() => setActiveTheme(selectedProject!.id, theme.themeId)}
                  >
                    <span className="inline-flex h-3 w-3 rounded-full" style={{ background: theme.colors.primary }} />
                    {theme.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorField label="Background" value={activeTheme!.colors.background} onChange={(v) => handleColorChange('background', v)} />
                  <ColorField label="Surface" value={activeTheme!.colors.surface} onChange={(v) => handleColorChange('surface', v)} />
                  <ColorField label="Primary" value={activeTheme!.colors.primary} onChange={(v) => handleColorChange('primary', v)} />
                  <ColorField label="Secondary" value={activeTheme!.colors.secondary} onChange={(v) => handleColorChange('secondary', v)} />
                  <ColorField label="Accent" value={activeTheme!.colors.accent} onChange={(v) => handleColorChange('accent', v)} />
                  <ColorField label="Text" value={activeTheme!.colors.text} onChange={(v) => handleColorChange('text', v)} />
                  <ColorField label="Muted text" value={activeTheme!.colors.muted} onChange={(v) => handleColorChange('muted', v)} />
                  <ColorField label="Widget bg" value={activeTheme!.colors.widgetBackground} onChange={(v) => handleColorChange('widgetBackground', v)} />
                  <ColorField label="Widget text" value={activeTheme!.colors.widgetText} onChange={(v) => handleColorChange('widgetText', v)} />
                  <ColorField label="Border" value={activeTheme!.colors.border} onChange={(v) => handleColorChange('border', v)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
                    Heading font
                    <input className="input" value={activeTheme!.typography.heading} onChange={(e) => handleFontChange('heading', e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
                    Body font
                    <input className="input" value={activeTheme!.typography.body} onChange={(e) => handleFontChange('body', e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
                    Scale
                    <input
                      type="range"
                      min={0.8}
                      max={1.4}
                      step={0.02}
                      value={activeTheme!.typography.scale}
                      onChange={(e) => handleScaleChange(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-[color:var(--fg-muted)]">{activeTheme!.typography.scale.toFixed(2)}×</span>
                  </label>
                </div>
              </div>

              <div className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--surface)]">
                <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)] mb-2">Live preview</p>
                <div
                  className="rounded-xl p-4 space-y-3 shadow-inner"
                  style={{
                    background: activeTheme!.colors.background,
                    color: activeTheme!.colors.text,
                    fontFamily: activeTheme!.typography.body,
                  }}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: activeTheme!.colors.muted }}>Portfolio</p>
                    <h4 className="text-xl font-semibold" style={{ fontFamily: activeTheme!.typography.heading }}>
                      {activeTheme!.name}
                    </h4>
                  </div>
                  <p style={{ color: activeTheme!.colors.widgetText }}>
                    Widgets inherit these colors automatically. Adjust the palette to instantly restyle your canvas.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-2 rounded-md text-sm font-semibold"
                      style={{ background: activeTheme!.colors.primary, color: '#020617' }}
                    >
                      Primary CTA
                    </button>
                    <button
                      className="flex-1 py-2 rounded-md text-sm font-semibold border"
                      style={{
                        background: 'transparent',
                        color: activeTheme!.colors.accent,
                        borderColor: activeTheme!.colors.accent,
                      }}
                    >
                      Accent
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette size={16} />
                <h3 className="font-semibold tracking-wide text-sm">Preset themes</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className="border border-[color:var(--border)] rounded-lg p-3 text-left hover:border-[color:var(--accent)] transition-colors"
                    onClick={() => createThemeFromPreset(selectedProject!.id, preset.id, { activate: true, name: preset.name })}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-3 w-3 rounded-full" style={{ background: preset.colors.primary }} />
                      <span className="font-semibold text-sm">{preset.name}</span>
                    </div>
                    <p className="text-xs text-[color:var(--fg-muted)]">{preset.description}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--fg-muted)]">Open or create a portfolio to edit its theme.</p>
        )}
      </div>
    </div>
  );

  const overlay = (
    <div
      className="fixed inset-0 z-[20000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      {body}
    </div>
  );

  try {
    return createPortal(overlay, document.body);
  } catch {
    return overlay;
  }
}
