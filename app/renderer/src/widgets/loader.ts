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
      version: 1,
      grid: { w: 3, h: 1 },
      category: 'Content',
      tags: ['content', 'copy', 'text', 'paragraph'],
      keywords: ['body', 'description', 'typography', 'heading'],
      description: 'Add headings and paragraphs of copy.',
    },
    loader: () => import('./defs/Text').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'image',
      label: 'Image',
      version: 1,
      grid: { w: 2, h: 2 },
      category: 'Media',
      tags: ['media', 'image', 'photo', 'gallery'],
      keywords: ['hero', 'banner', 'picture', 'thumbnail'],
      description: 'Showcase a single responsive image.',
    },
    loader: () => import('./defs/Image').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'video',
      label: 'Video',
      version: 1,
      grid: { w: 6, h: 4 },
      category: 'Media',
      tags: ['media', 'video', 'youtube', 'embed'],
      keywords: ['player', 'mp4', 'iframe', 'autoplay'],
      description: 'Embed a hosted video player with controls.',
    },
    loader: () => import('./defs/Video').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'project',
      label: 'Project Card',
      version: 1,
      grid: { w: 3, h: 2 },
      category: 'Projects',
      tags: ['portfolio', 'project', 'card', 'case-study'],
      keywords: ['work', 'feature', 'grid', 'spotlight'],
      description: 'Highlight a portfolio project with title and details.',
    },
    loader: () => import('./defs/Project').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'contact',
      label: 'Email Contact',
      version: 1,
      grid: { w: 6, h: 4 },
      category: 'Contact',
      tags: ['contact', 'form', 'email', 'cta'],
      keywords: ['support', 'reach out', 'inquiry', 'message'],
      description: 'Collect inquiries through a simple email form.',
    },
    loader: () => import('./defs/Contact').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'link',
      label: 'Link',
      version: 1,
      grid: { w: 3, h: 2 },
      category: 'Content',
      tags: ['content', 'link', 'cta', 'button'],
      keywords: ['external', 'url', 'anchor', 'action'],
      description: 'Add a prominent button-style link.',
    },
    loader: () => import('./defs/Link').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'nav-link',
      label: 'Page Navigation',
      version: 1,
      grid: { w: 3, h: 2 },
      category: 'Content',
      tags: ['navigation', 'menu', 'section', 'page'],
      keywords: ['anchor', 'jump', 'toc', 'internal link'],
      description: 'List internal jumps to quickly navigate the page.',
    },
    loader: () => import('./defs/NavLink').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'carousel',
      label: 'Carousel',
      version: 1,
      grid: { w: 6, h: 4 },
      category: 'Media',
      tags: ['media', 'gallery', 'slider', 'carousel', 'image', 'video'],
      keywords: ['slideshow', 'showcase', 'image', 'video', 'highlight'],
      description: 'Cycle through multiple images or videos in a slider.',
    },
    loader: () => import('./defs/Carousel').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
  {
    meta: {
      type: 'github-repos',
      label: 'GitHub Repos',
      version: 1,
      grid: { w: 6, h: 6 },
      category: 'Projects',
      tags: ['api', 'integration', 'github', 'feed', 'portfolio'],
      keywords: ['repositories', 'oss', 'projects', 'open-source'],
      description: 'Showcase repositories pulled directly from GitHub.',
    },
    loader: () => import('./defs/GitHubRepos').then(m => m.default as import('./types').WidgetDefinition<unknown>),
  },
];

widgetEntries.forEach(({ meta, loader }) => {
  WidgetsRegistry.register(meta, loader);
});
