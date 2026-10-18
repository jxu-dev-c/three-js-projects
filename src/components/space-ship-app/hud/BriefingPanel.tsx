import * as React from "react";
import UI_DATA from "../UI_DATA.json";
import AssetRoster from "./AssetRoster";
import CommandKey from "./CommandKey";
import DecodeText from "./DecodeText";
import { StationEntry } from "../util/tactical/stations";

export interface BriefingPanelProps {
  activePlanet: number;
  entries: StationEntry[];
  focused: StationEntry | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const HOME_COMMANDS = [
  { text: "Investor Relations", icon: "ph:chart-line-up-duotone" },
  { text: "Career", icon: "ph:briefcase-duotone" },
  { text: "Our Mission", icon: "ph:rocket-launch-duotone" },
];

const PLANET_COMMANDS = [
  { text: "Planet News", icon: "ph:newspaper-duotone" },
  { text: "Planet Career", icon: "ph:briefcase-duotone" },
  { text: "Contact Us", icon: "ph:phone-duotone" },
];

export default function BriefingPanel({
  activePlanet,
  entries,
  focused,
  onSelect,
  onClose,
}: BriefingPanelProps) {
  const planet: any = UI_DATA["3D"].find((item) => item.objectNum === activePlanet);
  const copies = planet?.copies ?? {};
  const hud = planet?.hud ?? {};
  const isHome = activePlanet === 0;

  const objectiveTitle = isHome ? copies.home_page_headline : copies.subtitle;
  const objectiveBody = isHome ? copies.home_page_intro : copies.overall_introduction_location;
  const commands = isHome ? HOME_COMMANDS : PLANET_COMMANDS;
  const site = focused?.data;

  return (
    <aside className={`briefing hud-panel ${focused ? "is-open" : ""}`} aria-hidden={!focused}>
      <header className="briefing__strip">
        <div className="hud-readout">
          <span className="hud-label">Site · {hud.operation}</span>
          {site && <DecodeText key={site.id} className="briefing__op" text={site.id} duration={400} />}
        </div>
        <button type="button" className="briefing__close" onClick={onClose}>
          <span className="hud-data">ESC</span> Close ✕
        </button>
      </header>

      {site && (
        <div className="briefing__body" key={site.id}>
          <p className="hud-data briefing__coords power-on">
            SECTOR {hud.sector} // {hud.code} · {site.readout.alt}
          </p>
          <DecodeText as="h1" className="briefing__title dot-matrix" text={site.name} />

          <section className="briefing-section">
            <header className="briefing-section__head">
              <span className="hud-label">Site Profile</span>
            </header>
            <p className="briefing__copy">{site.description}</p>
            <dl className="site-readout power-on" style={{ "--d": "450ms" } as React.CSSProperties}>
              <div>
                <dt className="hud-label">Designation</dt>
                <dd>{site.id}</dd>
              </div>
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
          </section>

          {entries.length > 1 && (
            <AssetRoster entries={entries} selectedId={site.id} onSelect={onSelect} />
          )}

          <section className="briefing-section">
            <header className="briefing-section__head">
              <span className="hud-label">Sector Briefing</span>
            </header>
            {objectiveTitle && (
              <h2 className="briefing__objective power-on" style={{ "--d": "600ms" } as React.CSSProperties}>
                {objectiveTitle}
              </h2>
            )}
            <div className="briefing__copy dd-html" dangerouslySetInnerHTML={{ __html: objectiveBody }} />
          </section>

          <div className="briefing__commands">
            {commands.map((command, index) => (
              <CommandKey
                key={command.text}
                icon={command.icon}
                text={command.text}
                code={`CMD-${String(index + 1).padStart(2, "0")}`}
              />
            ))}
          </div>

          <section className="briefing-section">
            <header className="briefing-section__head">
              <span className="hud-label">Intel</span>
            </header>
            <div
              className="briefing__copy briefing__copy--intel dd-html"
              dangerouslySetInnerHTML={{ __html: copies.stations_detail_description }}
            />
            {isHome && (
              <p className="briefing__outro dd-html" dangerouslySetInnerHTML={{ __html: copies.home_page_outtro }} />
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
