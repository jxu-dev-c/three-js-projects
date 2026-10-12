import * as React from "react";
import { useEffect, useState } from "react";
import { StationEntry, STATION_HOVER_EVENT } from "../util/tactical/stations";

export interface AssetRosterProps {
  entries: StationEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export default function AssetRoster({ entries, selectedId, onSelect }: AssetRosterProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // labels in the 3D scene report hovers back to the roster
  useEffect(() => {
    const onHover = (event: Event) => {
      const { id, on } = (event as CustomEvent).detail;
      setActiveId(on ? id : null);
    };
    window.addEventListener(STATION_HOVER_EVENT, onHover);
    return () => window.removeEventListener(STATION_HOVER_EVENT, onHover);
  }, []);

  // a focused pin hides before its mouseleave fires, so reset hover on focus change
  useEffect(() => setActiveId(null), [selectedId]);

  // clear any lingering highlight when the roster changes sector
  useEffect(() => {
    return () => entries.forEach((entry) => entry.highlight(false));
  }, [entries]);

  const units = entries.reduce((sum, entry) => sum + (entry.data.count ?? 1), 0);

  return (
    <section className="asset-roster">
      <header className="briefing-section__head">
        <span className="hud-label">Sector Assets</span>
        <span className="hud-data">
          {String(entries.length).padStart(2, "0")} SITES · {String(units).padStart(2, "0")} UNITS
        </span>
      </header>
      <table className="asset-roster__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Designation</th>
            <th>Class</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const { id, name, readout } = entry.data;
            return (
              <tr
                key={id}
                className={`${activeId === id ? "is-active" : ""} ${selectedId === id ? "is-selected" : ""}`}
                onClick={() => onSelect?.(id)}
                onMouseEnter={() => {
                  setActiveId(id);
                  entry.highlight(true);
                }}
                onMouseLeave={() => {
                  setActiveId(null);
                  entry.highlight(false);
                }}
              >
                <td className="hud-data">{id}</td>
                <td className="asset-roster__name">{name}</td>
                <td className="hud-data">{readout.class}</td>
                <td className="hud-data asset-roster__status">
                  <span className="status-dot" />
                  {readout.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
