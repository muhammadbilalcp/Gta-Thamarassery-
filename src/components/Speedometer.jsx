import React from 'react';

export function Speedometer() {
  return (
    <div id="speedo" className="hidden">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path id="speedo-track" d="M 36 150 A 80 80 0 1 1 164 150" />
        <path id="speedo-fill" d="M 36 150 A 80 80 0 1 1 164 150" />
      </svg>
      <div id="speed-value">0</div>
      <div id="speed-unit">km/h</div>
      <div id="gear">D</div>
      <div id="vehicle-name"></div>
    </div>
  );
}
