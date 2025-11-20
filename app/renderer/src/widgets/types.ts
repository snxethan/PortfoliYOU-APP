import { ReactNode } from 'react';
import type { z } from 'zod';

// A concrete instance placed on the canvas
export interface WidgetInstance<P = unknown> {
  id: string;
  type: string;
  props: P;
}

// A reusable widget definition, registered once per widget type
export interface WidgetDefinition<P = unknown> {
  type: string;           // unique type key, e.g. 'text'
  label: string;          // human label, e.g. 'Text Block'
  defaultProps: P;        // default props for new instances
  grid?: {                // default grid footprint for new instances
    w: number;
    h: number;
  };
  render: (props: P) => ReactNode;  // pure render function
  schema?: PropSchema;   // legacy optional prop schema for validation tools
  zodSchema?: z.ZodObject<z.ZodRawShape>; // preferred: zod schema for properties UI/validation
}

export interface WidgetsRegistryAPI {
  // Register a widget type with minimal metadata and a lazy loader for the full definition
  register: (meta: WidgetMeta, loader: WidgetLoader) => void;
  // Return a loaded definition if already available (won't trigger load)
  get: (type: string) => WidgetDefinition<unknown> | undefined;
  // Ensure a definition is loaded, resolves to the definition
  ensure: (type: string) => Promise<WidgetDefinition<unknown>>;
  // List lightweight metadata for palette display without loading components
  list: () => WidgetMeta[];
}

export type WidgetMeta = {
  type: string;
  label: string;
  grid?: { w: number; h: number };
  category?: string; // optional primary grouping for palette UI
  tags?: string[]; // additional category tags to improve filtering
  keywords?: string[]; // search keywords surfaced by the palette search
};

export type WidgetLoader = () => Promise<WidgetDefinition<unknown> | { default: WidgetDefinition<unknown> }>;

// ---- SDK helper types ----

export type PropPrimitive = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type PropSpec = {
  type: PropPrimitive;
  required?: boolean;
  default?: unknown;
  // If provided, should return true for valid values, or a string error message
  validate?: (value: unknown) => boolean | string;
};

export type PropSchema = Record<string, PropSpec>;
