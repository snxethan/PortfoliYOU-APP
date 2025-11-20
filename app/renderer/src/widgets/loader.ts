import { WidgetsRegistry } from './registry';
import type { WidgetLoader, WidgetMeta } from './types';

type WidgetEntry = {
  meta: WidgetMeta;
  loader: WidgetLoader;
};

const widgetEntries: WidgetEntry[] = [
  {
    meta: {
      type: 'text',
      label: 'Text Block',
      grid: { w: 4, h: 3 },
      category: 'Content',
      tags: ['content', 'copy', 'text', 'paragraph'],
      keywords: ['body', 'description', 'typography', 'heading'],
    },
    loader: () => import('./defs/Text').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'image',
      label: 'Image',
      grid: { w: 2, h: 2 },
      category: 'Media',
      tags: ['media', 'image', 'photo', 'gallery'],
      keywords: ['hero', 'banner', 'picture', 'thumbnail'],
    },
    loader: () => import('./defs/Image').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'video',
      label: 'Video',
      grid: { w: 6, h: 4 },
      category: 'Media',
      tags: ['media', 'video', 'youtube', 'embed'],
      keywords: ['player', 'mp4', 'iframe', 'autoplay'],
    },
    loader: () => import('./defs/Video').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'project',
      label: 'Project Card',
      grid: { w: 6, h: 4 },
      category: 'Projects',
      tags: ['portfolio', 'project', 'card', 'case-study'],
      keywords: ['work', 'feature', 'grid', 'spotlight'],
    },
    loader: () => import('./defs/Project').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'contact',
      label: 'Email Contact',
      grid: { w: 6, h: 4 },
      category: 'Contact',
      tags: ['contact', 'form', 'email', 'cta'],
      keywords: ['support', 'reach out', 'inquiry', 'message'],
    },
    loader: () => import('./defs/Contact').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'link',
      label: 'Link',
      grid: { w: 3, h: 2 },
      category: 'Content',
      tags: ['content', 'link', 'cta', 'button'],
      keywords: ['external', 'url', 'anchor', 'action'],
    },
    loader: () => import('./defs/Link').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'nav-link',
      label: 'Page Navigation',
      grid: { w: 3, h: 2 },
      category: 'Content',
      tags: ['navigation', 'menu', 'section', 'page'],
      keywords: ['anchor', 'jump', 'toc', 'internal link'],
    },
    loader: () => import('./defs/NavLink').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'carousel',
      label: 'Carousel',
      grid: { w: 6, h: 4 },
      category: 'Media',
      tags: ['media', 'gallery', 'slider', 'carousel', 'image', 'video'],
      keywords: ['slideshow', 'showcase', 'image', 'video', 'highlight'],
    },
    loader: () => import('./defs/Carousel').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'github-repos',
      label: 'GitHub Repos',
      grid: { w: 6, h: 6 },
      category: 'Projects',
      tags: ['api', 'integration', 'github', 'feed', 'portfolio'],
      keywords: ['repositories', 'oss', 'projects', 'open-source'],
    },
    loader: () => import('./defs/GitHubRepos').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
];

widgetEntries.forEach(({ meta, loader }) => {
  WidgetsRegistry.register(meta, loader);
});
