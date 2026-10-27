import React from 'react';

export function BigMap() {
  return (
    <div id="bigmap" className="hidden">
      <canvas id="bigmap-canvas"></canvas>
      <div id="bigmap-hint">
        Click a landmark to fast travel · <kbd>M</kbd> / <kbd>Esc</kbd> to close
      </div>
    </div>
  );
}
