import React from 'react';
import { ZoneBanner } from './ZoneBanner.jsx';
import { Minimap } from './Minimap.jsx';
import { Speedometer } from './Speedometer.jsx';
import { InteractionPrompt } from './InteractionPrompt.jsx';
import { Toast } from './Toast.jsx';
import { ControlsOverlay } from './ControlsOverlay.jsx';
import { FPSCounter } from './FPSCounter.jsx';

export function HUDContainer() {
  return (
    <div id="hud" className="hidden">
      <div id="hit-flash"></div>

      {/* Wanted Stars (Kerala Police Alert) */}
      <div id="wanted-wrap" className="hidden">
        <div id="wanted-label">WANTED</div>
        <div id="wanted-stars">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} viewBox="0 0 24 24" className="star-svg" aria-hidden="true">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          ))}
        </div>
      </div>

      {/* Player Health Bar */}
      <div id="health-wrap">
        <div id="health-bar-bg">
          <div id="health-bar-fill" style={{ width: '100%' }}></div>
        </div>
        <div id="health-label">HP 100</div>
      </div>

      <ZoneBanner />
      <Minimap />
      <Speedometer />
      <InteractionPrompt />
      <Toast />
      <ControlsOverlay />
      <FPSCounter />

      {/* Busted / Wasted Cinematic Overlay */}
      <div id="busted-overlay" className="hidden">
        <div id="busted-inner">
          <div id="busted-title">BUSTED</div>
          <div id="busted-sub">ARRESTED BY KERALA POLICE · THAMARASSERY</div>
        </div>
      </div>
    </div>
  );
}
