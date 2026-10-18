import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { initThree } from "../initThree";
import * as THREE from "three";
import "./index.css";
import UI_DATA from "./UI_DATA.json";
import { HomePlanet } from "./util/model/PlanetHome";
import { Moon } from "./util/model/Moon";
import { Earth } from "./util/model/Earth";
import { JupiterPlanet } from "./util/model/Jupiter";
import { convertMouseCoordinate } from "./util/camera/camera";
import { CameraRig } from "./util/camera/cameraRig";
import {
  pickStation,
  StationData,
  StationEntry,
  StationRegistry,
  STATION_SELECT_EVENT,
} from "./util/tactical/stations";
import { COLOR } from "./util/tactical/palette";
import {
  Body,
  buildSystemLayout,
  createSystemMarkers,
  SECTOR_PREVIEW_EVENT,
  SECTOR_SELECT_EVENT,
  transitDuration,
} from "./util/tactical/systemMap";
import { preparePlanet } from "./util/tactical/preparation";
import { createLazyPlanet, PLANET_LOADED_EVENT } from "./util/tactical/lazyPlanet";
import { createStarChart } from "./util/tactical/starChart";

// share decoded images between loaders (Europa reuses the Moon's base map)
THREE.Cache.enabled = true;

// HUD
import HudHeader from "./hud/HudHeader";
import HudFrame from "./hud/HudFrame";
import BriefingPanel from "./hud/BriefingPanel";
import OpWindow from "./hud/OpWindow";
import PowerUp from "./hud/PowerUp";
import BootLoader from "./hud/BootLoader";

export interface IAppProps {}

// first-load power-up: total length, and when the op window lights (see .is-booting in index.css)
const BOOT_SEQUENCE_MS = 2200;
const OP_WINDOW_BOOT_MS = 1300;

export default function SpaceShipShowcase(props: IAppProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isInited, setIsInited] = useState(false);
  // display power-up sequence that runs once, right after the boot loader
  const [isBooting, setIsBooting] = useState(true);
  const [mouseMoveCoordinate, setMouseMoveCoordinate] = useState({
    x: 0,
    y: 0,
  });
  const [loadingProgress, setLoadingProgress] = useState<any>({});
  const [activeMesh, setActiveMesh] = useState<number>(0);
  const [renderInstance, setRenderInstance] = useState<any>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // bumps when a planet finishes streaming in, so its site registry re-renders
  const [loadedTick, setLoadedTick] = useState(0);
  const planetsRef = useRef<THREE.Group[]>([]);
  const rigRef = useRef<CameraRig | null>(null);
  const layoutRef = useRef<Record<number, Body>>(buildSystemLayout());
  const markersRef = useRef<ReturnType<typeof createSystemMarkers> | null>(null);
  const previousSectorRef = useRef<number | null>(null);
  // light comes from the departure star until mid-flight, then the destination's
  const starsRef = useRef({ from: layoutRef.current[0].star, to: layoutRef.current[0].star });

  const fetchPlanetObject = (activeNum: number): any =>
    UI_DATA["3D"].find((item) => item.objectNum === activeNum);

  const calculateMeshRotation = (event: MouseEvent) => {
    if ((window as any).lastMouseX) {
      const diff = (window as any).lastMouseX - event.clientX;
      return diff / 1000;
    }
  };

  const NAV_DATA = UI_DATA["2D"].Navigation;

  // Get Data
  const HomePlanetObject: any = UI_DATA["3D"].find(
    (item) => item.objectName === "HomePlanet"
  );
  const MoonPlanetObject: any = UI_DATA["3D"].find(
    (item) => item.objectName === "Moon"
  );
  const EarthPlanetObject: any = UI_DATA["3D"].find(
    (item) => item.objectName === "Earth"
  );
  const JupiterPlanetObject: any = UI_DATA["3D"].find(
    (item) => item.objectName === "Jupiter"
  );
  const LightingObject = UI_DATA["3D"].find(
    (item) => item.objectName === "Sunlight"
  );

  const LoadingObject = UI_DATA["2D"].Loader;

  // Free screen regions for camera framing. On desktop the focused site and the
  // briefing panel are composed as one group: subject left, panel beside it at
  // the same height, the group biased left so the right of the screen stays
  // open. The panel reads its position from the CSS variables set here; the
  // mobile bottom sheet (52vh tall, 16px from the bottom) is laid out in CSS.
  const MOBILE_BREAKPOINT = 992;
  const FOCUS_BOTTOM = 76;
  function updateFramingInsets() {
    const rig = rigRef.current;
    if (!rig) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const header = document.querySelector(".hud-header")?.getBoundingClientRect().bottom ?? 100;
    if (w < MOBILE_BREAKPOINT) {
      const opWindow = document.querySelector(".op-window")?.getBoundingClientRect().height ?? 0;
      rig.setInsets({
        overview: { top: header, right: 0, bottom: opWindow ? opWindow + 24 : 0, left: 0 },
        focus: { top: header + 8, right: 0, bottom: h * 0.52 + 24, left: 0 },
      });
    } else {
      const regionHeight = h - header - FOCUS_BOTTOM;
      const panelWidth = Math.min(460, w - 80);
      // the rig sizes the subject's bounding radius to 0.4 of the region's short
      // side; sprawling models (arms, panels) reach ~70% of that sphere
      const subjectReach = regionHeight * 0.4 * 0.72;
      const gap = 80;
      const groupWidth = subjectReach * 2 + gap + panelWidth;
      const subjectX = Math.max((w - groupWidth) * 0.42, 24) + subjectReach;
      const centerY = header + regionHeight / 2;
      rig.setInsets({
        overview: { top: header, right: 0, bottom: 60, left: 0 },
        // a region centred on subjectX puts the lens-shifted subject there
        focus: { top: header, right: Math.max(w - subjectX * 2, 0), bottom: FOCUS_BOTTOM, left: 0 },
      });
      const root = document.documentElement.style;
      root.setProperty("--briefing-left", `${subjectX + subjectReach + gap}px`);
      root.setProperty("--briefing-cy", `${centerY}px`);
      root.setProperty("--briefing-max-h", `${regionHeight}px`);
      root.setProperty("--briefing-cx", `${subjectX + subjectReach + gap + panelWidth / 2}px`);
    }
  }

  useEffect(() => {
    if (canvasRef.current && !isInited) {
      // prevent scroll restoration
      // eslint-disable-next-line
      if ("scrollRestoration" in history) {
        // eslint-disable-next-line
        history.scrollRestoration = "manual";
      }
      const canvas = canvasRef.current;

      const scene = new THREE.Scene();
      (async function () {
        setLoadingProgress(LoadingObject[0]);
        // the sky is plotted, not photographed: see starChart.ts
        scene.background = COLOR.bg;
        const starChart = createStarChart();
        setLoadingProgress(LoadingObject[1]);
        const width = window.innerWidth;
        const height = window.innerHeight;
        // far plane spans the whole system map (Proxima b sits ~4,500 units out)
        const camera = new THREE.PerspectiveCamera(
          50,
          width / height,
          0.5,
          20000
        );
        const layout = layoutRef.current;
        const start = layout[activeMesh];
        const rig = new CameraRig(camera, start.cameraPosition, start.position);
        rigRef.current = rig;
        updateFramingInsets();
        setLoadingProgress(LoadingObject[2]);

        // Bodies start as procedural stand-ins; full textures and sites stream in
        // on demand, with Terra prepared in the background after Home is interactive.
        let prepare: ((group: THREE.Group) => Promise<void>) | undefined;
        const prepareLoaded = (group: THREE.Group) => prepare?.(group) ?? Promise.resolve();
        const ORIGIN = { Px: 0, Py: 0, Pz: 0 };
        const meshList = [
          createLazyPlanet({
            prepare: prepareLoaded,
            body: layout[0],
            tint: new THREE.Color(0x3d4a52),
            load: () => HomePlanet(ORIGIN, HomePlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
            prepare: prepareLoaded,
            body: layout[1],
            tint: new THREE.Color(0x2e4a6b),
            load: () => Earth(ORIGIN, EarthPlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
            prepare: prepareLoaded,
            body: layout[2],
            tint: new THREE.Color(0x5a5f66),
            load: () => Moon(ORIGIN, MoonPlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
            prepare: prepareLoaded,
            body: layout[3],
            tint: new THREE.Color(0x6b5a4c),
            load: () => JupiterPlanet(ORIGIN, JupiterPlanetObject?.stations as StationData[]),
          }),
        ];
        planetsRef.current = meshList;
        meshList.forEach((mesh, num) => mesh.userData.setDetail(num === activeMesh));

        // only the starting sector is fetched during boot
        await meshList[activeMesh].userData.ensureLoaded();
        setLoadingProgress(LoadingObject[3]);
        setLoadingProgress(LoadingObject[4]);

        markersRef.current = createSystemMarkers(scene, layout);
        markersRef.current.setActive(activeMesh);

        // sunlight aims from the current star at whatever the camera is looking at
        const light = new THREE.DirectionalLight(
          0xffffff,
          LightingObject?.objectIntensity || 0
        );
        scene.add(light, light.target);
        const updateLight = () => {
          const { from, to } = starsRef.current;
          light.position.copy(rig.progress < 0.5 ? from : to);
          light.target.position.copy(rig.lookTarget);
        };
        // faint steel fill so the night side keeps its silhouette
        scene.add(new THREE.AmbientLight(COLOR.steel, 0.12));
        setLoadingProgress(LoadingObject[5]);
        const renderInstance = await initThree({
          scene,
          camera,
          canvas,
          width,
          height,
          // the chart rides last so planet indices still match sectors
          mesh: [...meshList, starChart],
          showPerformance: false,
          RotateControls: false,
          axisHelper: false,
          bloom: true,
          labels: true,
          animation: () => {
            rig.update();
            updateLight();
          },
        });
        prepare = (group) => preparePlanet(group, renderInstance.renderer, camera, scene);
        setLoadingProgress(LoadingObject[6]);

        window.addEventListener("resize", () => {
          renderInstance.resize(window.innerWidth, window.innerHeight);
          updateFramingInsets();
        });

        document.addEventListener("mousemove", (event) => {
          if (event.buttons === 1) {
            // reject mouse move if mouse is hold down
            return;
          }
          const { x, y } = convertMouseCoordinate(event);
          rig.mouse = { x, y };
          setMouseMoveCoordinate({ x, y });
        });

        canvas.addEventListener("mousedown", () => {
          canvas.classList.add("cursor-none");
        });

        document.addEventListener("mouseup", () => {
          canvas.classList.remove("cursor-none");
        });
        setRenderInstance(renderInstance);
        setLoadingProgress(LoadingObject[7]);
        setIsInited(true);
      })();
    }
  }, [isInited]);

  useEffect(() => {
    if (!isInited) return;
    // Let Home paint and become interactive before preparing the next destination.
    const timer = window.setTimeout(() => {
      void planetsRef.current[1]?.userData.ensureLoaded();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isInited]);

  useEffect(() => {
    // Prevent the hook from running on page load
    if (!isInited) {
      return;
    }

    const mouseAreaRef = canvasRef.current;
    const currentMesh = renderInstance.mesh[activeMesh as number];
    const layout = layoutRef.current;
    planetsRef.current.forEach((mesh: THREE.Object3D, num: number) =>
      mesh.userData.setDetail(num === activeMesh)
    );
    markersRef.current?.setActive(activeMesh);

    // fly from the previous sector to this one across the system map, streaming
    // the destination's textures in while the camera is in flight
    const previous = previousSectorRef.current;
    previousSectorRef.current = activeMesh;
    if (previous !== null && previous !== activeMesh && rigRef.current) {
      const from = layout[previous];
      const to = layout[activeMesh];
      const duration = transitDuration(from, to);
      starsRef.current = { from: from.star, to: to.star };
      rigRef.current.travelTo(to.position, to.cameraPosition, duration);
    }
    void currentMesh.userData.ensureLoaded();

    const mouseDragEventHandler = async (event: MouseEvent) => {
      if (event.buttons === 1) {
        (window as any).lastMouseX = event.clientX;
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 100);
        });
        const diff = calculateMeshRotation(event);
        if (diff) {
          currentMesh.rotation.y += diff;
        }
      }
    };

    mouseAreaRef?.addEventListener("mousemove", mouseDragEventHandler);

    // a click (not a drag) on or near a site focuses it; empty space clears focus
    let downAt = { x: 0, y: 0 };
    const onPointerDown = (event: MouseEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const onClick = (event: MouseEvent) => {
      if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      setFocusedId(
        pickStation(currentMesh.userData.stations, renderInstance.camera, event.clientX, event.clientY)
      );
    };
    const surface = renderInstance.renderer.domElement as HTMLCanvasElement;
    let hovered: string | null = null;
    let pointer: { x: number; y: number } | null = null;
    let hoverFrame = 0;
    const clearHover = () => {
      if (hovered) currentMesh.userData.stations.get(hovered)?.hover(false);
      hovered = null;
      surface.style.cursor = "";
    };
    const updateHover = () => {
      if (!pointer) return;
      const id = pickStation(currentMesh.userData.stations, renderInstance.camera, pointer.x, pointer.y);
      if (id !== hovered) {
        clearHover();
        hovered = id;
        surface.style.cursor = id ? "pointer" : "";
      }
      // Idempotent: focus changes may clear station hover while the pointer stays put.
      if (id) currentMesh.userData.stations.get(id)?.hover(true);
      // Also track sites moving underneath a stationary pointer.
      hoverFrame = requestAnimationFrame(updateHover);
    };
    const stopHover = () => {
      pointer = null;
      cancelAnimationFrame(hoverFrame);
      clearHover();
    };
    const onHoverMove = (event: PointerEvent) => {
      if (event.buttons || event.pointerType === "touch") { stopHover(); return; }
      const wasTracking = pointer !== null;
      pointer = { x: event.clientX, y: event.clientY };
      if (!wasTracking) hoverFrame = requestAnimationFrame(updateHover);
    };
    surface.addEventListener("pointermove", onHoverMove);
    surface.addEventListener("pointerleave", stopHover);
    surface.addEventListener("pointerdown", stopHover);
    window.addEventListener("blur", stopHover);
    mouseAreaRef?.addEventListener("mousedown", onPointerDown);
    mouseAreaRef?.addEventListener("click", onClick);

    return () => {
      stopHover();
      surface.removeEventListener("pointermove", onHoverMove);
      surface.removeEventListener("pointerleave", stopHover);
      surface.removeEventListener("pointerdown", stopHover);
      window.removeEventListener("blur", stopHover);
      mouseAreaRef?.removeEventListener("mousedown", onPointerDown);
      mouseAreaRef?.removeEventListener("click", onClick);
      mouseAreaRef?.removeEventListener("mousemove", mouseDragEventHandler);
      (window as any).lastMouseX = null;
    };
  }, [activeMesh, isInited]);

  // site focus: camera framing, turntable spin, label dimming
  useEffect(() => {
    if (!isInited) return;
    updateFramingInsets();
    const group = renderInstance.mesh[activeMesh];
    if (rigRef.current) rigRef.current.overviewRadius = group.userData.radius * 1.15;
    const entry: StationEntry | undefined = focusedId
      ? group.userData.stations.get(focusedId)
      : undefined;
    group.userData.setFocus(entry ? focusedId : null);
    rigRef.current?.setFocus(
      entry ? { object: entry.objects[0], radius: entry.radius, planet: group } : null
    );
    document.querySelector(".label-layer")?.classList.toggle("is-focusing", !!entry);
    return () => group.userData.setFocus(null);
  }, [focusedId, activeMesh, isInited]);

  useEffect(() => {
    const onSelect = (event: Event) => setFocusedId((event as CustomEvent).detail.id);
    // long-range beacons on other planets jump to that sector
    const onSector = (event: Event) => {
      setFocusedId(null);
      setActiveMesh((event as CustomEvent).detail.num);
    };
    window.addEventListener(SECTOR_SELECT_EVENT, onSector);
    // hovering a tab or beacon starts streaming that planet early
    const onPreview = (event: Event) =>
      planetsRef.current[(event as CustomEvent).detail.num]?.userData.ensureLoaded();
    const onLoaded = () => setLoadedTick((n) => n + 1);
    window.addEventListener(SECTOR_PREVIEW_EVENT, onPreview);
    window.addEventListener(PLANET_LOADED_EVENT, onLoaded);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusedId(null);
    };
    window.addEventListener(STATION_SELECT_EVENT, onSelect);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(STATION_SELECT_EVENT, onSelect);
      window.removeEventListener(SECTOR_SELECT_EVENT, onSector);
      window.removeEventListener(SECTOR_PREVIEW_EVENT, onPreview);
      window.removeEventListener(PLANET_LOADED_EVENT, onLoaded);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const previewSector = useCallback((index: number) => {
    planetsRef.current[index]?.userData.ensureLoaded();
  }, []);

  const selectSector = useCallback((index: number) => {
    setFocusedId(null);
    setActiveMesh(index);
  }, []);

  useEffect(() => {
    if (!isInited) return;
    const id = window.setTimeout(() => setIsBooting(false), BOOT_SEQUENCE_MS);
    return () => window.clearTimeout(id);
  }, [isInited]);

  const activePlanet = fetchPlanetObject(activeMesh);
  const registry: StationRegistry | undefined =
    renderInstance?.mesh[activeMesh]?.userData.stations;
  const stationEntries: StationEntry[] = React.useMemo(
    () => (registry ? Array.from(registry.values()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, loadedTick]
  );
  const focusedEntry = (focusedId && registry?.get(focusedId)) || null;
  const overviewTitle =
    activeMesh === 0 ? "Pioneer Human Expansion in Space" : activePlanet?.copies?.tagline;

  return (
    <section className={`three-section ${isInited && isBooting ? "is-booting" : ""}`}>
      {isInited && isBooting && <PowerUp />}
      {isInited && (
        <HudFrame
          coordinate={mouseMoveCoordinate}
          sector={`${activePlanet?.hud?.sector} · ${activePlanet?.hud?.code}`}
          assetCount={stationEntries.length}
        />
      )}
      <div className="ui-overlay">
        <HudHeader
          tabs={NAV_DATA}
          activeIndex={activeMesh}
          onSelect={selectSector}
          onPreview={previewSector}
          showTabs={isInited}
        />
        {!isInited && (
          <div className="hud-boot">
            <BootLoader steps={LoadingObject} current={loadingProgress} />
          </div>
        )}
        {isInited && (
          <>
            <OpWindow
              key={activeMesh}
              title={overviewTitle}
              years={activePlanet?.copies?.years}
              callToAction={activePlanet?.copies?.call_to_action}
              code={activePlanet?.hud?.code}
              hidden={!!focusedEntry}
              bootDelay={isBooting ? OP_WINDOW_BOOT_MS : 0}
            />
            <BriefingPanel
              activePlanet={activeMesh}
              entries={stationEntries}
              focused={focusedEntry}
              onSelect={setFocusedId}
              onClose={() => setFocusedId(null)}
            />
          </>
        )}
      </div>
      <div
        className={`canvas position-fixed ${isInited ? "cursor-hand" : ""}`}
        ref={canvasRef}
      ></div>
    </section>
  );
}
