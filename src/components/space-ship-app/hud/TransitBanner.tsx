import * as React from "react";
import { Body } from "../util/tactical/systemMap";

export interface TransitBannerProps {
  from: Body;
  to: Body;
  distance: string;
  duration: number;
  acquiring?: boolean;
}

export default function TransitBanner({ from, to, distance, duration, acquiring }: TransitBannerProps) {
  return (
    <div
      className="transit-banner hud-panel"
      role="status"
      style={{ "--transit-duration": `${duration}s` } as React.CSSProperties}
    >
      <div className="transit-banner__head">
        <span className="hud-label">{acquiring ? "Acquiring Telemetry" : "In Transit"}</span>
        <span className="hud-data">RANGE {distance}</span>
      </div>
      <div className="transit-banner__route">
        <span className="transit-banner__from">{from.name}</span>
        <span className="transit-banner__arrow" aria-hidden="true" />
        <span className="transit-banner__to">{to.name}</span>
      </div>
      <div className={`transit-banner__bar ${acquiring ? "is-acquiring" : ""}`}>
        <span />
      </div>
      <div className="transit-banner__codes hud-data">
        <span>{from.code}</span>
        <span>{to.code}</span>
      </div>
    </div>
  );
}
