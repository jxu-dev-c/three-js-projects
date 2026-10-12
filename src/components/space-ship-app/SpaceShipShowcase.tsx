import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { initThree } from "../initThree";
import * as THREE from "three";
import "./index.css";
import skyboxRight from "../../asset/skybox/skybox-right.png";
import skyboxLeft from "../../asset/skybox/skybox-left.png";
import skyboxTop from "../../asset/skybox/skybox-top.png";
import skyboxBottom from "../../asset/skybox/skybox-bottom.png";
import skyboxFront from "../../asset/skybox/skybox-front.png";
import skyboxBack from "../../asset/skybox/skybox-back.png";
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
  formatDistance,
  SECTOR_PREVIEW_EVENT,
  SECTOR_SELECT_EVENT,
  transitDuration,
} from "./util/tactical/systemMap";
import { createLazyPlanet, PLANET_LOADED_EVENT } from "./util/tactical/lazyPlanet";

// share decoded images between loaders (Europa reuses the Moon's base map)
THREE.Cache.enabled = true;

// loader
import { loadTexture } from "./util/texture/loadTexture";

// HUD
import HudHeader from "./hud/HudHeader";
import HudFrame from "./hud/HudFrame";
import BriefingPanel from "./hud/BriefingPanel";
import OpWindow from "./hud/OpWindow";
import BootLoader from "./hud/BootLoader";
import TransitBanner from "./hud/TransitBanner";

interface Transit {
  id: number;
  from: Body;
  to: Body;
  distance: string;
  duration: number;
  // flight finished but the destination's textures are still streaming in
  acquiring?: boolean;
}

export interface IAppProps {}

export default function SpaceShipShowcase(props: IAppProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isInited, setIsInited] = useState(false);
  const [mouseMoveCoordinate, setMouseMoveCoordinate] = useState({
    x: 0,
    y: 0,
  });
  const [loadingProgress, setLoadingProgress] = useState<any>({});
  const [activeMesh, setActiveMesh] = useState<number>(0);
  const [renderInstance, setRenderInstance] = useState<any>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [transit, setTransit] = useState<Transit | null>(null);
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

  // Free screen regions for camera framing. Panel geometry mirrors index.css:
  // desktop side panel (right 40px, width min(520px, 100vw - 80px), bottom
  // 76px) and mobile bottom sheet (52vh tall, 16px from the bottom).
  const MOBILE_BREAKPOINT = 992;
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
      rig.setInsets({
        overview: { top: header, right: 0, bottom: 60, left: 0 },
        focus: { top: header, right: Math.min(520, w - 80) + 60, bottom: 76, left: 0 },
      });
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
        const texture = await loadTexture(
          [
            skyboxRight,
            skyboxLeft,
            skyboxTop,
            skyboxBottom,
            skyboxFront,
            skyboxBack,
          ],
          "cube"
        );
        scene.background = texture;
        // dim the starfield so the line work reads first
        scene.backgroundIntensity = 0.55;
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
        // only when a sector is visited (or hovered), never all up front.
        const ORIGIN = { Px: 0, Py: 0, Pz: 0 };
        const meshList = [
          createLazyPlanet({
            body: layout[0],
            tint: new THREE.Color(0x3d4a52),
            load: () => HomePlanet(ORIGIN, HomePlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
            body: layout[1],
            tint: new THREE.Color(0x2e4a6b),
            load: () => Earth(ORIGIN, EarthPlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
            body: layout[2],
            tint: new THREE.Color(0x5a5f66),
            load: () => Moon(ORIGIN, MoonPlanetObject?.stations as StationData[]),
          }),
          createLazyPlanet({
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
          mesh: meshList,
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
    // Prevent the hook from running on page load
    if (!isInited) {
      return;
    }

    const mouseAreaRef = canvasRef.current;
    const currentMesh = renderInstance.mesh[activeMesh as number];
    const layout = layoutRef.current;
    renderInstance.mesh.forEach((mesh: THREE.Object3D, num: number) =>
      mesh.userData.setDetail(num === activeMesh)
    );
    markersRef.current?.setActive(activeMesh);

    // fly from the previous sector to this one across the system map, streaming
    // the destination's textures in while the camera is in flight
    let transitTimer: number | undefined;
    let cancelled = false;
    const previous = previousSectorRef.current;
    previousSectorRef.current = activeMesh;
    if (previous !== null && previous !== activeMesh && rigRef.current) {
      const from = layout[previous];
      const to = layout[activeMesh];
      const duration = transitDuration(from, to);
      starsRef.current = { from: from.star, to: to.star };
      rigRef.current.travelTo(to.position, to.cameraPosition, duration);
      const id = Date.now();
      setTransit({ id, from, to, distance: formatDistance(from, to), duration });
      const arrival = new Promise<void>((resolve) => {
        transitTimer = window.setTimeout(resolve, duration * 1000);
      });
      const loaded = currentMesh.userData.ensureLoaded();
      arrival.then(() => {
        if (!cancelled && !currentMesh.userData.isLoaded) {
          setTransit((t) => (t && t.id === id ? { ...t, acquiring: true } : t));
        }
      });
      Promise.all([arrival, loaded]).then(() => {
        if (!cancelled) setTransit((t) => (t && t.id === id ? null : t));
      });
    } else {
      currentMesh.userData.ensureLoaded();
    }

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
    mouseAreaRef?.addEventListener("mousedown", onPointerDown);
    mouseAreaRef?.addEventListener("click", onClick);

    return () => {
      cancelled = true;
      window.clearTimeout(transitTimer);
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
    // transit is a dependency so mobile insets re-measure once the op window returns
  }, [focusedId, activeMesh, isInited, transit]);

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
    <section className="three-section">
      <div
        className={`loader-overlay ${isInited ? "first-load-animation" : ""}`}
      ></div>
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
            {!transit && (
              <OpWindow
                key={activeMesh}
                title={overviewTitle}
                years={activePlanet?.copies?.years}
                callToAction={activePlanet?.copies?.call_to_action}
                code={activePlanet?.hud?.code}
                siteCount={stationEntries.length}
                hidden={!!focusedEntry}
              />
            )}
            {transit && (
              <TransitBanner
                key={transit.id}
                from={transit.from}
                to={transit.to}
                distance={transit.distance}
                duration={transit.duration}
                acquiring={transit.acquiring}
              />
            )}
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
