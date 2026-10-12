import * as React from "react";
import { useEffect } from "react";
import { InlineIcon } from "@iconify/react";

export interface SectorTab {
  icon: string;
  title: string;
}

export interface SectorTabsProps {
  data: SectorTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPreview?: (index: number) => void;
}

export default function SectorTabs({ data, activeIndex, onSelect, onPreview }: SectorTabsProps) {
  // arrow keys cycle sectors
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const step = event.key === "ArrowRight" ? 1 : -1;
      onSelect((activeIndex + step + data.length) % data.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, data.length, onSelect]);

  return (
    <nav className="sector-tabs" aria-label="Sectors">
      {data.map((item, index) => (
        <button
          key={item.title}
          type="button"
          className={`sector-tab ${activeIndex === index ? "is-active" : ""}`}
          aria-current={activeIndex === index ? "page" : undefined}
          onClick={() => onSelect(index)}
          onMouseEnter={() => onPreview?.(index)}
          onFocus={() => onPreview?.(index)}
        >
          <span className="sector-tab__index">{String(index + 1).padStart(2, "0")}</span>
          <InlineIcon icon={item.icon} className="sector-tab__icon" />
          <span className="sector-tab__title">{item.title}</span>
        </button>
      ))}
    </nav>
  );
}
