import * as React from "react";

export interface BootStep {
  step: string;
  progress: number;
}

export interface BootLoaderProps {
  steps: BootStep[];
  current?: BootStep;
}

const C = 100;
const ARC_R = 78;
const ARC_LENGTH = 2 * Math.PI * ARC_R;

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

// 72 bearing ticks, every sixth one long
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const major = i % 6 === 0;
  const a = polar(96, i * 5);
  const b = polar(major ? 88 : 92, i * 5);
  return { ...a, x2: b.x, y2: b.y, major };
});

const sweepEnd = polar(64, 50);
const SWEEP_PATH = `M${C} ${C} L${C} ${C - 64} A64 64 0 0 1 ${sweepEnd.x.toFixed(2)} ${sweepEnd.y.toFixed(2)} Z`;

// Tactical boot reticle: bearing ring, progress arc, radar sweep and a boot log
export default function BootLoader({ steps, current }: BootLoaderProps) {
  const progress = current?.progress ?? 0;
  const done = steps.filter((s) => s.progress <= progress);

  return (
    <div className="boot-loader">
      <div className="boot-loader__reticle">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="boot-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          <g className="boot-loader__ticks">
            {TICKS.map((t, i) => (
              <line key={i} x1={t.x} y1={t.y} x2={t.x2} y2={t.y2} className={t.major ? "is-major" : ""} />
            ))}
          </g>

          {[0, 90, 180, 270].map((deg) => {
            const tip = polar(84, deg);
            const left = polar(80.5, deg - 2.4);
            const right = polar(80.5, deg + 2.4);
            return (
              <path
                key={deg}
                className="boot-loader__marker"
                d={`M${tip.x} ${tip.y} L${left.x} ${left.y} L${right.x} ${right.y} Z`}
              />
            );
          })}

          <circle className="boot-loader__track" cx={C} cy={C} r={ARC_R} />
          <circle
            className="boot-loader__arc"
            cx={C}
            cy={C}
            r={ARC_R}
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={ARC_LENGTH * (1 - progress / 100)}
          />

          <circle className="boot-loader__segments" cx={C} cy={C} r={68} />
          <path className="boot-loader__sweep" d={SWEEP_PATH} fill="url(#boot-sweep)" />
          <circle className="boot-loader__inner" cx={C} cy={C} r={44} />

          {[0, 90, 180, 270].map((deg) => {
            const a = polar(48, deg);
            const b = polar(60, deg);
            return <line key={deg} className="boot-loader__cross" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </svg>

        <div className="boot-loader__readout">
          <span className="boot-loader__percent dot-matrix">
            {String(progress).padStart(2, "0")}
            <small>%</small>
          </span>
          <span className="hud-label">Initialising</span>
        </div>
      </div>

      <ol className="boot-loader__log">
        <li className="hud-data">&gt; COSMODYN TACTICAL BRIEFING SYSTEM</li>
        {done.map((s, i) => {
          const isLast = i === done.length - 1;
          return (
            <li key={i} className="hud-data">
              &gt; {s.step.toUpperCase()}
              <span className="boot-loader__dots" />
              <span className={isLast ? "boot-loader__busy" : "hud-data--ok"}>{isLast ? "...." : "OK"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
