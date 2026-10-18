import * as React from "react";
import { useEffect, useRef } from "react";
import UI_DATA from "../UI_DATA.json";
import AssetRoster from "./AssetRoster";
import DecodeText from "./DecodeText";
import { StationEntry } from "../util/tactical/stations";

export interface BriefingPanelProps {
  activePlanet: number;
  entries: StationEntry[];
  focused: StationEntry | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

// the projection sways with the pointer so it reads as a plane in the scene, not a sticker on the glass
function useParallax(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const rig = ref.current;
    if (!rig || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    const tick = () => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      rig.style.setProperty("--px", current.x.toFixed(4));
      rig.style.setProperty("--py", current.y.toFixed(4));
      const settled = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export default function BriefingPanel({
  activePlanet,
  entries,
  focused,
  onSelect,
  onClose,
}: BriefingPanelProps) {
  const planet: any = UI_DATA["3D"].find((item) => item.objectNum === activePlanet);
  const hud = planet?.hud ?? {};
  const site = focused?.data;
  const rigRef = useRef<HTMLDivElement>(null);
  useParallax(rigRef);

  return (
    <>
      <div className={`briefing-scrim ${focused ? "is-open" : ""}`} aria-hidden="true" />
      <aside className={`briefing ${focused ? "is-open" : ""}`} aria-hidden={!focused}>
        <div className="briefing__rig" ref={rigRef}>
          <div className="briefing__plane">
            <button type="button" className="briefing__close hud-data" onClick={onClose}>
              ESC ✕
            </button>

            <div className="briefing__scroll">
              {site && (
                <div className="briefing__body" key={site.id}>
                  <p className="hud-data briefing__coords power-on">
                    {site.id} · SECTOR {hud.sector} // {hud.code}
                  </p>
                  <DecodeText as="h1" className="briefing__title dot-matrix" text={site.name} />

                  <dl className="site-readout power-on" style={{ "--d": "450ms" } as React.CSSProperties}>
                    <div>
                      <dt className="hud-label">Class</dt>
                      <dd>{site.readout.class}</dd>
                    </div>
                    <div>
                      <dt className="hud-label">Location</dt>
                      <dd>{site.readout.alt}</dd>
                    </div>
                    <div>
                      <dt className="hud-label">Status</dt>
                      <dd className="site-readout__status">
                        <span className="status-dot" />
                        {site.readout.status}
                      </dd>
                    </div>
                    {(site.count ?? 1) > 1 && (
                      <div>
                        <dt className="hud-label">Units</dt>
                        <dd>{String(site.count).padStart(2, "0")}</dd>
                      </div>
                    )}
                  </dl>

                  {site.description && <p className="briefing__copy">{site.description}</p>}

                  {entries.length > 1 && (
                    <AssetRoster entries={entries} selectedId={site.id} onSelect={onSelect} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
