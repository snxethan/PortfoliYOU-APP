import { WidgetsRegistry } from './registry';

WidgetsRegistry.register(
  { type: 'text', label: 'Text Block', grid: { w: 4, h: 3 }, category: 'Content' },
  () => import('./defs/Text').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'image', label: 'Image', grid: { w: 4, h: 4 }, category: 'Media' },
  () => import('./defs/Image').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'project', label: 'Project Card', grid: { w: 6, h: 4 }, category: 'Portfolio' },
  () => import('./defs/Project').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'contact', label: 'Contact Form', grid: { w: 6, h: 6 }, category: 'Contact' },
  () => import('./defs/Contact').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);
