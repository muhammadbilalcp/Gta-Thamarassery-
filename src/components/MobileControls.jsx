import React, { useState, useEffect, useRef } from 'react';

export function MobileControls({ game }) {
  const [isDriving, setIsDriving] = useState(false);
  const [sprintActive, setSprintActive] = useState(false);
  const [canEnterVehicle, setCanEnterVehicle] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Joystick refs
  const joystickBaseRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const joystickPointerIdRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0 });

  // Camera look state
  const lookPointerIdRef = useRef(null);
  const lastLookPosRef = useRef({ x: 0, y: 0 });

  // Monitor fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Poll vehicle & prompt status
  useEffect(() => {
    if (!game) return;
    const interval = setInterval(() => {
      const player = game.player;
      if (!player) return;
      const driving = !!player.vehicle;
      setIsDriving(driving);
      if (!driving) {
        const promptShown = game.hud?.promptShown;
        setCanEnterVehicle(!!promptShown);
      } else {
        setCanEnterVehicle(false);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [game]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }
  };

  // ------------------------------------------------------------- Virtual Joystick
  const handleJoystickPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    joystickPointerIdRef.current = e.pointerId;
    if (joystickBaseRef.current) {
      joystickBaseRef.current.setPointerCapture(e.pointerId);
      const rect = joystickBaseRef.current.getBoundingClientRect();
      originRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    updateJoystickPos(e.clientX, e.clientY);
  };

  const updateJoystickPos = (clientX, clientY) => {
    const maxRadius = 46;
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    const normX = knobX / maxRadius;
    const normY = -knobY / maxRadius; // Up is forward (+1)

    if (game?.input) {
      game.input.setVirtualMove(normX, normY);
    }
  };

  const handleJoystickPointerMove = (e) => {
    if (joystickPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateJoystickPos(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e) => {
    if (joystickPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    joystickPointerIdRef.current = null;
    if (joystickBaseRef.current) {
      try {
        joystickBaseRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
    if (game?.input) {
      game.input.setVirtualMove(0, 0);
    }
  };

  // ------------------------------------------------------------- Swipe Look Surface
  const handleLookPointerDown = (e) => {
    lookPointerIdRef.current = e.pointerId;
    lastLookPosRef.current = { x: clientPos(e).x, y: clientPos(e).y };
  };

  const clientPos = (e) => ({
    x: e.clientX,
    y: e.clientY,
  });

  const handleLookPointerMove = (e) => {
    if (lookPointerIdRef.current !== e.pointerId) return;
    const current = clientPos(e);
    const dx = current.x - lastLookPosRef.current.x;
    const dy = current.y - lastLookPosRef.current.y;
    lastLookPosRef.current = current;

    if (game?.input) {
      game.input.addLook(dx * 1.7, dy * 1.7);
    }
  };

  const handleLookPointerUp = (e) => {
    if (lookPointerIdRef.current === e.pointerId) {
      lookPointerIdRef.current = null;
    }
  };

  // Button helpers
  const handleButtonDown = (code) => {
    if (game?.input) {
      game.input.setVirtualKey(code, true);
    }
  };

  const handleButtonUp = (code) => {
    if (game?.input) {
      game.input.setVirtualKey(code, false);
    }
  };

  const handleTap = (code) => {
    if (game?.input) {
      game.input.tapVirtualKey(code);
    }
  };

  const toggleSprint = () => {
    const next = !sprintActive;
    setSprintActive(next);
    if (game?.input) {
      game.input.setVirtualKey('VirtualSprint', next);
    }
  };

  return (
    <div id="mobile-controls-root" style={{ pointerEvents: 'none' }}>
      {/* Top Header Buttons: Fullscreen & Controls Toggle */}
      <div
        style={{
          position: 'fixed',
          top: '12px',
          right: '16px',
          zIndex: 50,
          display: 'flex',
          gap: '8px',
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          style={{
            background: 'rgba(15, 20, 24, 0.85)',
            border: '1.5px solid rgba(255, 211, 77, 0.7)',
            color: '#ffd34d',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          }}
        >
          {isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}
        </button>

        <button
          type="button"
          onClick={() => setControlsVisible((v) => !v)}
          style={{
            background: controlsVisible ? 'rgba(255, 211, 77, 0.22)' : 'rgba(15, 20, 24, 0.85)',
            border: '1.5px solid ' + (controlsVisible ? '#ffd34d' : 'rgba(255, 255, 255, 0.25)'),
            color: controlsVisible ? '#ffd34d' : '#fff',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          {controlsVisible ? 'CONTROLS ON' : 'CONTROLS OFF'}
        </button>
      </div>

      {controlsVisible && (
        <>
          {/* Swipe Look Surface (Right half of the screen) */}
          <div
            id="mobile-look-surface"
            onPointerDown={handleLookPointerDown}
            onPointerMove={handleLookPointerMove}
            onPointerUp={handleLookPointerUp}
            onPointerCancel={handleLookPointerUp}
            style={{
              position: 'fixed',
              right: 0,
              top: '60px',
              width: '52vw',
              height: 'calc(100vh - 190px)',
              zIndex: 20,
              pointerEvents: 'auto',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />

          {/* Virtual Joystick (Bottom Left) */}
          <div
            ref={joystickBaseRef}
            id="virtual-joystick-base"
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            style={{
              position: 'fixed',
              left: '26px',
              bottom: '30px',
              width: '130px',
              height: '130px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,211,77,0.06) 0%, rgba(12,16,20,0.72) 75%)',
              border: '2px solid rgba(255, 211, 77, 0.45)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.65), inset 0 0 20px rgba(255,211,77,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 35,
              pointerEvents: 'auto',
              touchAction: 'none',
              backdropFilter: 'blur(8px)',
              userSelect: 'none',
            }}
          >
            {/* Cardinal direction guides */}
            <div style={{ position: 'absolute', top: '7px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>W</div>
            <div style={{ position: 'absolute', bottom: '7px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>S</div>
            <div style={{ position: 'absolute', left: '8px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>A</div>
            <div style={{ position: 'absolute', right: '8px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>D</div>

            <div
              ref={joystickKnobRef}
              id="virtual-joystick-knob"
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #fff1a8 0%, #ffd34d 55%, #c99818 100%)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.6), 0 0 14px rgba(255,211,77,0.45)',
                pointerEvents: 'none',
                transition: joystickPointerIdRef.current === null ? 'transform 0.14s ease-out' : 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-22px',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'uppercase',
                textShadow: '0 1px 3px #000',
                pointerEvents: 'none',
              }}
            >
              {isDriving ? 'STEER / GAS' : 'MOVE'}
            </div>
          </div>

          {/* Action Buttons (Bottom Right) */}
          <div
            id="mobile-action-buttons"
            style={{
              position: 'fixed',
              right: '20px',
              bottom: '22px',
              zIndex: 35,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '10px',
              userSelect: 'none',
            }}
          >
            {/* Top row of utility buttons: Map & Fast Travel */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
              <button
                type="button"
                className="mobile-action-btn"
                onPointerDown={() => handleTap('KeyT')}
                style={{
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '20px',
                  background: 'rgba(15,22,26,0.85)',
                  border: '1.5px solid rgba(255,211,77,0.7)',
                  color: '#ffd34d',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                TRAVEL
              </button>
              <button
                type="button"
                className="mobile-action-btn"
                onPointerDown={() => handleTap('KeyM')}
                style={{
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '20px',
                  background: 'rgba(15,22,26,0.85)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                MAP
              </button>
            </div>

            {/* Vehicle Mode Controls */}
            {isDriving ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 64px)',
                  gridTemplateRows: 'repeat(2, 64px)',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                {/* Horn */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonDown('KeyH');
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyH');
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyH');
                  }}
                  style={{
                    gridColumn: '1',
                    gridRow: '1',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(255, 180, 50, 0.25)',
                    border: '2px solid rgba(255, 180, 50, 0.75)',
                    color: '#ffd34d',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  HORN
                </button>

                {/* Reset Vehicle */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={() => handleTap('KeyR')}
                  style={{
                    gridColumn: '2',
                    gridRow: '1',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(60, 100, 140, 0.35)',
                    border: '2px solid rgba(120, 180, 240, 0.6)',
                    color: '#8ec5fc',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  RESET
                </button>

                {/* Exit Vehicle */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={() => handleTap('KeyE')}
                  style={{
                    gridColumn: '3',
                    gridRow: '1',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(210, 40, 40, 0.35)',
                    border: '2px solid rgba(255, 80, 80, 0.85)',
                    color: '#ff8a8a',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  EXIT
                </button>

                {/* Handbrake / Drift */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonDown('Space');
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handleButtonUp('Space');
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault();
                    handleButtonUp('Space');
                  }}
                  style={{
                    gridColumn: '1',
                    gridRow: '2',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(160, 40, 40, 0.4)',
                    border: '2px solid #ff4444',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  DRIFT
                </button>

                {/* Brake / Reverse Pedal */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonDown('KeyS');
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyS');
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyS');
                  }}
                  style={{
                    gridColumn: '2',
                    gridRow: '2',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'rgba(230, 80, 30, 0.4)',
                    border: '2px solid #ff6633',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  BRAKE
                </button>

                {/* Gas Pedal */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonDown('KeyW');
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyW');
                  }}
                  onPointerCancel={(e) => {
                    e.preventDefault();
                    handleButtonUp('KeyW');
                  }}
                  style={{
                    gridColumn: '3',
                    gridRow: '2',
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: 'radial-gradient(circle, rgba(50, 205, 75, 0.55) 0%, rgba(15, 120, 40, 0.65) 100%)',
                    border: '2px solid #44ee77',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 16px rgba(68,238,119,0.45)',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  GAS
                </button>
              </div>
            ) : (
              /* On-Foot Mode Controls */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Sprint Toggle */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={toggleSprint}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: sprintActive ? 'rgba(255, 211, 77, 0.45)' : 'rgba(20, 25, 30, 0.75)',
                    border: '2px solid ' + (sprintActive ? '#ffd34d' : 'rgba(255,255,255,0.3)'),
                    color: sprintActive ? '#ffd34d' : '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                    boxShadow: sprintActive ? '0 0 16px rgba(255,211,77,0.55)' : 'none',
                  }}
                >
                  SPRINT
                </button>

                {/* Fight / Punch Button */}
                <button
                  type="button"
                  className="mobile-action-btn fight"
                  onPointerDown={() => handleTap('KeyF')}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(230, 45, 45, 0.85) 0%, rgba(140, 15, 15, 0.95) 100%)',
                    border: '2px solid #ff4d4d',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 20px rgba(230, 45, 45, 0.65), 0 4px 14px rgba(0,0,0,0.5)',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  FIGHT
                </button>

                {/* Jump Button */}
                <button
                  type="button"
                  className="mobile-action-btn"
                  onPointerDown={() => handleTap('Space')}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'rgba(40, 90, 160, 0.45)',
                    border: '2px solid #55aaff',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.55)',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  JUMP
                </button>

                {/* Enter / Ride Vehicle (Large Action Button) */}
                <button
                  type="button"
                  className="mobile-action-btn enter"
                  onPointerDown={() => handleTap('KeyE')}
                  style={{
                    width: '78px',
                    height: '78px',
                    borderRadius: '50%',
                    background: canEnterVehicle
                      ? 'radial-gradient(circle, rgba(255,211,77,0.9) 0%, rgba(200,140,20,0.95) 100%)'
                      : 'rgba(22, 28, 34, 0.8)',
                    border: canEnterVehicle ? '3px solid #fff' : '2px solid rgba(255,255,255,0.4)',
                    color: canEnterVehicle ? '#111' : '#fff',
                    fontSize: '13px',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: canEnterVehicle
                      ? '0 0 24px rgba(255,211,77,0.85), 0 6px 18px rgba(0,0,0,0.6)'
                      : '0 4px 14px rgba(0,0,0,0.4)',
                    transform: canEnterVehicle ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.18s ease',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                  }}
                >
                  ENTER
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MobileControls;
