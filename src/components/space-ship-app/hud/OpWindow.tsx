import * as React from "react";
import DecodeText from "./DecodeText";

export interface OpWindowProps {
  title: string;
  years: string;
  callToAction: string;
  code?: string;
  hidden?: boolean;
  // ms to hold back while the display powers up on first load
  bootDelay?: number;
}

export default function OpWindow({ title, years, callToAction, code, hidden, bootDelay = 0 }: OpWindowProps) {
  return (
    <aside
      className={`op-window hud-brackets ${hidden ? "is-hidden" : ""}`}
      style={{ "--boot": `${bootDelay}ms` } as React.CSSProperties}
    >
      <div className="op-window__head">
        <span className="hud-label">Op Window</span>
        {code && <span className="hud-data">{code}</span>}
      </div>
      <DecodeText as="h1" className="op-window__title dot-matrix" text={title} idleDecode delay={bootDelay} />
      <div className="op-window__years dd-html power-on" style={{ "--d": "500ms" } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: years }} />
      <div className="op-window__cta dd-html power-on" style={{ "--d": "650ms" } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: callToAction }} />
    </aside>
  );
}
