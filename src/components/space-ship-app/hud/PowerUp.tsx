import * as React from "react";
import { useMemo } from "react";

const COLS = 16;
const ROWS = 9;
// modules start switching on once the CRT line has opened up
const START = 300;
const ROW_STEP = 80;
const COL_STEP = 22;
const JITTER = 90;

// deterministic hash so the scan pattern is stable across renders
const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// One-shot display power-up after boot: a CRT line warms the tube, then the
// view comes up module by module like an LED wall. The HUD staggers itself in
// via `.is-booting` on the section; this only covers the scene.
export default function PowerUp() {
  const cells = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        return START + row * ROW_STEP + col * COL_STEP + Math.round(jitter(i) * JITTER);
      }),
    []
  );

  return (
    <div className="power-up" aria-hidden="true">
      <div className="power-up__grid" style={{ "--cols": COLS, "--rows": ROWS } as React.CSSProperties}>
        {cells.map((delay, i) => (
          <span key={i} style={{ "--d": `${delay}ms` } as React.CSSProperties} />
        ))}
      </div>
      <div className="power-up__line" />
    </div>
  );
}
