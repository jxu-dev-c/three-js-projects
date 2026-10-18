import * as React from "react";

export interface BootStep {
  step: string;
  progress: number;
}

export interface BootLoaderProps {
  steps: BootStep[];
  current?: BootStep;
}

// progress reads as a row of discrete cells, like an old segment display
const CELLS = 32;

// fake memory address for each log line, derived from its progress mark
const addr = (progress: number) => `0x${(progress * 37).toString(16).padStart(4, "0").toUpperCase()}`;

// Terminal boot readout: system header, step log and a segmented progress bar
export default function BootLoader({ steps, current }: BootLoaderProps) {
  const progress = current?.progress ?? 0;
  const done = steps.filter((s) => s.progress <= progress);
  const lit = Math.round((progress / 100) * CELLS);

  return (
    <div className="boot-loader">
      <ol className="boot-loader__log">
        <li className="hud-data boot-loader__head">COSMODYN // TACTICAL BRIEFING SYSTEM</li>
        <li className="hud-data boot-loader__sub">ROM REV 2.17 — MEM CHECK 640K OK</li>
        {done.map((s, i) => {
          const isLast = i === done.length - 1;
          return (
            <li key={i} className="hud-data">
              <span className="boot-loader__addr">{addr(s.progress)}</span>
              {s.step.toUpperCase()}
              <span className="boot-loader__dots" />
              {isLast ? <span className="boot-loader__busy">█</span> : <span className="hud-data--ok">[ OK ]</span>}
            </li>
          );
        })}
      </ol>

      <div className="boot-loader__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span className="hud-data boot-loader__status">SYS.INIT</span>
        <span className="boot-loader__cells" aria-hidden="true">
          {Array.from({ length: CELLS }, (_, i) => (
            <span key={i} className={i < lit ? "is-lit" : ""} />
          ))}
        </span>
        <span className="hud-data boot-loader__percent">{String(progress).padStart(3, "0")}%</span>
      </div>
    </div>
  );
}
