import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';

const def: WidgetDefinition<{ email?: string }> = {
    type: 'contact',
    label: 'Email Contact',
    defaultProps: { email: '' },
    grid: { w: 6, h: 6 },
    render: (props) => (
        <form className="space-y-2 text-xs">
            <input className="input w-full" placeholder="Your email" defaultValue={props.email} />
            <textarea className="input w-full h-24" placeholder="Message" />
            <button type="button" className="btn btn-primary btn-sm">Send</button>
        </form>
    ),
    zodSchema: z.object({
        email: z.string().email('Please enter a valid email').or(z.literal('')).optional(),
    }),
};

export default def;
