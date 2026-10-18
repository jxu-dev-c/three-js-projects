import * as React from "react";

export interface HudFrameProps {
  coordinate: { x: number; y: number };
  sector?: string;
  assetCount?: number;
}

const fmt = (n: number) => `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(3)}`;

export default function HudFrame({ coordinate, sector, assetCount = 0 }: HudFrameProps) {
  return (
    <div className="hud-frame" aria-hidden="true">
      <div className="hud-frame__scanlines" />
      <span className="hud-frame__corner hud-frame__corner--tl" />
      <span className="hud-frame__corner hud-frame__corner--tr" />
      <span className="hud-frame__corner hud-frame__corner--bl" />
      <span className="hud-frame__corner hud-frame__corner--br" />
      <div className="hud-frame__ruler hud-frame__ruler--right" />
      <div className="hud-frame__ruler hud-frame__ruler--bottom" />
      <div className="hud-frame__bar">
        <span className="hud-data">◀ ▶ SWITCH SECTOR</span>
        <span className="hud-data">DRAG · ROTATE</span>
        <span className="hud-data">CLICK SITE · INSPECT</span>
        <span className="hud-data">ESC · OVERVIEW</span>
        <span className="hud-frame__spacer" />
        <span className="hud-data">SECTOR {sector}</span>
        <span className="hud-data">
          X {fmt(coordinate.x)} Y {fmt(-coordinate.y)}
        </span>
        <span className="hud-data">ASSETS {String(assetCount).padStart(2, "0")}</span>
        <span className="hud-data hud-data--ok">■ LINK ESTABLISHED</span>
      </div>
    </div>
  );
}
