import { WidgetsRegistry } from './registry';

WidgetsRegistry.register(
  { type: 'text', label: 'Text Block', grid: { w: 4, h: 3 }, category: 'Content' },
  () => import('./defs/Text').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'image', label: 'Image', grid: { w: 2, h: 2 }, category: 'Media' },
  () => import('./defs/Image').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'video', label: 'Video', grid: { w: 6, h: 4 }, category: 'Media' },
  () => import('./defs/Video').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'project', label: 'Project Card', grid: { w: 6, h: 4 }, category: 'Portfolio' },
  () => import('./defs/Project').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'contact', label: 'Email Contact', grid: { w: 6, h: 4 }, category: 'Contact' },
  () => import('./defs/Contact').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

// Navigation
WidgetsRegistry.register(
  { type: 'link', label: 'Link', grid: { w: 3, h: 2 }, category: 'Navigation' },
  () => import('./defs/Link').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

WidgetsRegistry.register(
  { type: 'nav-link', label: 'Nav Link', grid: { w: 3, h: 2 }, category: 'Navigation' },
  () => import('./defs/NavLink').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);

// Media - Carousel
WidgetsRegistry.register(
  { type: 'carousel', label: 'Carousel', grid: { w: 6, h: 4 }, category: 'Media' },
  () => import('./defs/Carousel').then(m => m.default as import('./types').WidgetDefinition<unknown>)
);
