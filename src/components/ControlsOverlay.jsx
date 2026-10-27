import React from 'react';

export function ControlsOverlay() {
  return (
    <div id="controls">
      <div className="controls-title">
        Controls <span>· <kbd>F1</kbd> hide</span>
      </div>
      <div id="controls-foot" className="controls-grid">
        <kbd>W A S D</kbd><span>Move</span>
        <kbd>Shift</kbd><span>Run</span>
        <kbd>Space</kbd><span>Jump</span>
        <kbd>Mouse</kbd><span>Look</span>
        <kbd>E</kbd><span>Enter vehicle</span>
      </div>
      <div id="controls-drive" className="controls-grid hidden">
        <kbd>W</kbd><span>Accelerate</span>
        <kbd>S</kbd><span>Brake / reverse</span>
        <kbd>A D</kbd><span>Steer</span>
        <kbd>Space</kbd><span>Handbrake</span>
        <kbd>H</kbd><span>Horn</span>
        <kbd>R</kbd><span>Reset vehicle</span>
        <kbd>E</kbd><span>Exit vehicle</span>
      </div>
      <div className="controls-grid controls-extra">
        <kbd>M</kbd><span>Big map</span>
        <kbd>T</kbd><span>Fast travel</span>
      </div>
    </div>
  );
}
