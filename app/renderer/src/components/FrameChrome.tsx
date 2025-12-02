import React from 'react';

export default function FrameChrome() {
    return (
        <div className="frame-chrome">
            <div className="frame-bars frame-bars--horizontal" aria-hidden="true" />
            <div className="frame-bars frame-bars--vertical" aria-hidden="true" />
            <div className="frame-corner frame-corner--tl" aria-hidden="true" />
            <div className="frame-corner frame-corner--tr" aria-hidden="true" />
        </div>
    );
}
