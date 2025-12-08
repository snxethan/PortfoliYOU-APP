import { ContactWidgetSettings } from './ContactWidgetSettings';
import { ImageWidgetSettings } from './ImageWidgetSettings';
import { LinkWidgetSettings } from './LinkWidgetSettings';
import { NavLinkWidgetSettings } from './NavLinkWidgetSettings';
import { TextWidgetSettings } from './TextWidgetSettings';
import { VideoWidgetSettings } from './VideoWidgetSettings';
import { ProjectWidgetSettings } from './ProjectWidgetSettings';
import type { WidgetSettingsRegistry } from './types';

export const widgetSettingsRegistry: WidgetSettingsRegistry = {
    video: { type: 'video', component: VideoWidgetSettings },
    image: { type: 'image', component: ImageWidgetSettings },
    text: { type: 'text', component: TextWidgetSettings },
    link: { type: 'link', component: LinkWidgetSettings },
    'nav-link': { type: 'nav-link', component: NavLinkWidgetSettings },
    contact: { type: 'contact', component: ContactWidgetSettings },
    project: { type: 'project', component: ProjectWidgetSettings },
};

export function getWidgetSettingsModule(widgetType: string) {
    return widgetSettingsRegistry[widgetType] ?? null;
}
