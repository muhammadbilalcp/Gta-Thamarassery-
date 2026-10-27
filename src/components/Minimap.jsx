import React from 'react';

export function Minimap() {
  return (
    <div id="minimap-wrap">
      <canvas id="minimap" width="220" height="220"></canvas>
      <div id="compass">N</div>
    </div>
  );
}
