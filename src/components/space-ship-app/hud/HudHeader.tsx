import * as React from "react";
import { useEffect, useState } from "react";
import SectorTabs, { SectorTab } from "./SectorTabs";

export interface HudHeaderProps {
  tabs: SectorTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPreview?: (index: number) => void;
  showTabs?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return {
    date: `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
    time: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`,
  };
}

export default function HudHeader({
  tabs,
  activeIndex,
  onSelect,
  onPreview,
  showTabs = true,
}: HudHeaderProps) {
  const { date, time } = useUtcClock();
  return (
    <header className="hud-header">
      <a className="hud-wordmark" href="#">
        <span className="hud-label">Origin</span>
        <span className="hud-wordmark__name">Cosmodyn</span>
      </a>
      {showTabs && <SectorTabs data={tabs} activeIndex={activeIndex} onSelect={onSelect} onPreview={onPreview} />}
      <div className="hud-header__status">
        <div className="hud-readout">
          <span className="hud-label">V-Mode</span>
          <span className="hud-readout__value hud-readout__value--accent">TAC</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">UTC {date}</span>
          <span className="hud-readout__value">{time}</span>
        </div>
      </div>
    </header>
  );
}
