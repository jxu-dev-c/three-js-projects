import * as React from "react";

export interface OpWindowProps {
  title: string;
  years: string;
  callToAction: string;
  code?: string;
  siteCount: number;
  hidden?: boolean;
}

export default function OpWindow({ title, years, callToAction, code, siteCount, hidden }: OpWindowProps) {
  return (
    <aside className={`op-window hud-brackets ${hidden ? "is-hidden" : ""}`}>
      <div className="op-window__head">
        <span className="hud-label">Op Window</span>
        {code && <span className="hud-data">{code}</span>}
      </div>
      <h1 className="op-window__title dot-matrix">{title}</h1>
      <div className="op-window__years dd-html" dangerouslySetInnerHTML={{ __html: years }} />
      <div className="op-window__cta dd-html" dangerouslySetInnerHTML={{ __html: callToAction }} />
      <p className="op-window__hint hud-data">
        <span className="op-window__pulse" /> Select a site to inspect · {String(siteCount).padStart(2, "0")} tracked
      </p>
    </aside>
  );
}
