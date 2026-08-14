import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SECTOR_ORDER } from "../data/mockCompanies.js";
import { CompanySearch } from "./CompanySearch.js";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumberCompact,
  formatPercent
} from "../utils/formatters.js";
import { getFocusPositionForX, shouldClearTerrainSelection } from "../utils/terrainFocus.js";

const h = React.createElement;

const metricOptions = [
  { value: "marketCapChange", label: "$ repricing" },
  { value: "percentChange", label: "% change" },
  { value: "volume", label: "Volume" }
];

export function TerrainMap3DImproved({
  companies,
  timeSpan,
  timeSpans = [],
  onTimeSpanChange = () => {},
  highlightedTicker = "",
  title = "3D market cap terrain field (improved)",
  description = "Sector strips, ticker-labeled company blocks, weighted footprints, mode switching, hover/click sector focus, zoom, reset view, and transparent Y-axis measurement guides.",
  showTimeControls = true,
  showCompanyFinder = true,
  children = null
}) {
  const mountRef = useRef(null);
  const tooltipRef = useRef(null);
  const resetViewRef = useRef(null);
  const overviewRef = useRef(null);
  const focusRef = useRef(0);
  const activeHighlightedTickerRef = useRef("");
  const [metric, setMetric] = useState("marketCapChange");
  const [resetVersion, setResetVersion] = useState(0);
  const [focusPosition, setFocusPosition] = useState(0);
  const [isOverviewActive, setIsOverviewActive] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [selectedCompanyTicker, setSelectedCompanyTicker] = useState("");

  const sectorSummaries = useMemo(() => buildSectorSummaries(companies), [companies]);
  const companySuggestions = useMemo(
    () => buildCompanySuggestions(companies, companySearchQuery),
    [companies, companySearchQuery]
  );
  const activeHighlightedTicker =
    selectedCompanyTicker || (companySearchQuery.trim() ? companySuggestions[0]?.ticker || "" : highlightedTicker);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.ticker === selectedCompanyTicker),
    [companies, selectedCompanyTicker]
  );

  useEffect(() => {
    activeHighlightedTickerRef.current = activeHighlightedTicker;
  }, [activeHighlightedTicker]);

  useEffect(() => {
    if (!selectedCompanyTicker) return;
    if (!companies.some((company) => company.ticker === selectedCompanyTicker)) {
      setSelectedCompanyTicker("");
    }
  }, [companies, selectedCompanyTicker]);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b11);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 1200);
    const defaultCameraDistance = 58;
    const defaultCameraHeight = 31;
    let cameraDistance = defaultCameraDistance;
    let cameraHeight = defaultCameraHeight;
    camera.position.set(0, cameraHeight, cameraDistance);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x9db5d6, 0.82));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(22, 42, 22);
    scene.add(keyLight);

    const terrain = new THREE.Group();
    const defaultRotation = { x: -0.1, y: 0 };
    terrain.rotation.set(defaultRotation.x, defaultRotation.y, 0);
    scene.add(terrain);

    const rowsPerSector = 8;
    const spacing = 0.9;
    const sectorGap = 1.2;
    const maxTerrainHeight = 11;
    const metricValues = companies.map((company) => getMetricValue(company, metric));
    const metricScale = buildMetricScale(metricValues, metric, maxTerrainHeight);
    const sectorLayouts = buildSectorLayouts(companies, rowsPerSector, spacing, sectorGap);
    const fieldWidth = sectorLayouts.totalWidth;
    const fieldDepth = sectorLayouts.maxDepth;
    const labelSprites = [];
    const tickerLabels = [];
    const disposableMaterials = [];
    const disposableGeometries = [];
    const sectorFloors = new Map();
    const pickables = [];
    const companyBars = [];

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x33465f,
      transparent: true,
      opacity: 0.38
    });
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xf2f7ff });
    const zeroMaterial = new THREE.LineBasicMaterial({ color: 0xdce8ff, transparent: true, opacity: 0.92 });
    const guideMaterial = new THREE.LineBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.23 });
    disposableMaterials.push(lineMaterial, axisMaterial, zeroMaterial, guideMaterial);

    addMeasurementGrid(terrain, {
      fieldWidth,
      fieldDepth,
      metricScale,
      guideMaterial,
      axisMaterial,
      labelSprites,
      metric
    });

    sectorLayouts.layouts.forEach((layout, index) => {
      const summary = sectorSummaries.find((item) => item.sector === layout.sector);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: summary.netMarketCapChange >= 0 ? 0x0e2a23 : 0x2b1219,
        roughness: 0.84,
        metalness: 0.08,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      });
      const floorGeometry = new THREE.BoxGeometry(layout.width + 0.54, 0.06, layout.depth + 0.54);
      disposableMaterials.push(floorMaterial);
      disposableGeometries.push(floorGeometry);
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.set(layout.centerX, 0, 0);
      floor.receiveShadow = true;
      floor.userData.sector = layout.sector;
      floor.userData.isSectorFloor = true;
      terrain.add(floor);
      sectorFloors.set(layout.sector, floor);
      pickables.push(floor);

      addRectGrid(terrain, layout, rowsPerSector, spacing, lineMaterial);
      addLine(
        terrain,
        [layout.xStart - 0.32, 0.11, -fieldDepth / 2 - 0.28],
        [layout.xStart - 0.32, 0.11, fieldDepth / 2 + 0.28],
        zeroMaterial
      );

      const sectorLabel = createTextSprite(layout.sector, {
        fontSize: 34,
        color: "#f3f8ff",
        background: "rgba(8, 12, 19, 0.72)",
        paddingX: 18,
        paddingY: 8
      });
      sectorLabel.position.set(layout.centerX, 0.48, fieldDepth / 2 + 1.12);
      sectorLabel.scale.set(4.3, 1.02, 1);
      terrain.add(sectorLabel);
      labelSprites.push(sectorLabel);

      const summaryHeight = Math.min(
        2.4,
        Math.max(0.18, (Math.abs(summary.netMarketCapChange) / 1_000_000_000) * 0.025)
      );
      const summaryGeometry = new THREE.BoxGeometry(Math.max(0.58, layout.width), 1, 0.18);
      const summaryMaterial = new THREE.MeshStandardMaterial({
        color: summary.netMarketCapChange >= 0 ? 0x74efad : 0xff7384,
        roughness: 0.5,
        metalness: 0.08,
        transparent: true,
        opacity: 0.46
      });
      disposableGeometries.push(summaryGeometry);
      disposableMaterials.push(summaryMaterial);
      const summaryBar = new THREE.Mesh(summaryGeometry, summaryMaterial);
      summaryBar.scale.y = summaryHeight;
      summaryBar.position.set(
        layout.centerX,
        summary.netMarketCapChange >= 0 ? summaryHeight / 2 + 0.12 : -summaryHeight / 2 - 0.12,
        -fieldDepth / 2 - 0.72 - index * 0.002
      );
      terrain.add(summaryBar);
    });

    const barGeometry = new THREE.BoxGeometry(0.72, 1, 0.72);
    disposableGeometries.push(barGeometry);

    sectorLayouts.layouts.forEach((layout) => {
      layout.companies.forEach((company, index) => {
        const column = Math.floor(index / rowsPerSector);
        const row = index % rowsPerSector;
        const metricValue = getMetricValue(company, metric);
        const signed = metric === "volume" ? Math.abs(metricValue) : metricValue;
        const height = Math.max(0.12, metricHeight(signed, metricScale));
        const footprint = 1.16 + Math.min(0.64, company.previousMarketCap / 3_200_000_000_000);
        const material = new THREE.MeshStandardMaterial({
          color: getMetricColor(company, metric),
          roughness: 0.46,
          metalness: 0.12,
          transparent: true,
          opacity: 0.9
        });
        disposableMaterials.push(material);
        const mesh = new THREE.Mesh(barGeometry, material);
        mesh.scale.set(footprint, height, footprint);
        mesh.position.set(
          layout.xStart + column * spacing,
          signed >= 0 ? height / 2 + 0.05 : -height / 2 - 0.05,
          row * spacing - layout.depth / 2
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.company = company;
        mesh.userData.sector = company.sector;
        mesh.userData.baseOpacity = material.opacity;
        mesh.userData.baseScaleX = footprint;
        mesh.userData.baseScaleZ = footprint;
        terrain.add(mesh);
        pickables.push(mesh);
        companyBars.push(mesh);

        const label = createTickerTopLabel(company.ticker);
        const labelY = signed >= 0 ? height + 0.095 : 0.095;
        label.position.set(mesh.position.x, labelY, mesh.position.z);
        label.rotation.x = -Math.PI / 2;
        const labelSize = 0.71 * footprint;
        label.scale.set(labelSize, labelSize, 1);
        label.userData.parentBar = mesh;
        terrain.add(label);
        tickerLabels.push(label);
      });
    });

    let hovered = null;
    let activeHit = null;
    let selectedSector = null;
    let animationFrame = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startRotationX = terrain.rotation.x;
    let startRotationY = terrain.rotation.y;
    let dragMoved = false;
    let overviewStartedAt = 0;
    let overviewActive = false;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function cameraFocusX() {
      return (focusRef.current / 100) * (fieldWidth / 2);
    }

    function updateCameraTarget() {
      const focusX = cameraFocusX();
      camera.position.x = focusX;
      camera.position.y = cameraHeight;
      camera.position.z = cameraDistance;
      camera.lookAt(focusX, 0, 0);
      camera.updateProjectionMatrix();
    }

    resetViewRef.current = () => {
      terrain.rotation.set(defaultRotation.x, defaultRotation.y, 0);
      cameraDistance = defaultCameraDistance;
      cameraHeight = defaultCameraHeight;
      focusRef.current = 0;
      setFocusPosition(0);
      updateCameraTarget();
      selectedSector = null;
      hovered = null;
      activeHit = null;
      setSelectedCompanyTicker("");
      setCompanySearchQuery("");
      applySectorFocus(null);
      showTooltip(null, null, mount, tooltipRef.current);
    };

    overviewRef.current = {
      start() {
        overviewStartedAt = performance.now();
        overviewActive = true;
        selectedSector = null;
        hovered = null;
        activeHit = null;
        setSelectedCompanyTicker("");
        applySectorFocus(null);
        showTooltip(null, null, mount, tooltipRef.current);
      },
      stop() {
        overviewActive = false;
      }
    };

    function resize() {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(480, Math.min(720, width * 0.54));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      updateCameraTarget();
    }

    function applySectorFocus(sector) {
      sectorFloors.forEach((floor, floorSector) => {
        floor.material.opacity = !sector || floorSector === sector ? 0.86 : 0.28;
      });
      pickables.forEach((mesh) => {
        if (mesh.userData.isSectorFloor) return;
        mesh.material.opacity = !sector || mesh.userData.sector === sector ? 0.96 : 0.24;
      });
    }

    function focusAtX(x, options = {}) {
      const nextFocus = getFocusPositionForX(x, fieldWidth);
      focusRef.current = nextFocus;
      setFocusPosition(nextFocus);
      cameraDistance = clamp(options.distance ?? cameraDistance, 14, 102);
      cameraHeight = clamp(options.height ?? cameraHeight, 12, 78);
      updateCameraTarget();
    }

    function focusOnHit(hitObject) {
      if (!hitObject) return;
      overviewActive = false;
      setIsOverviewActive(false);
      const sector = hitObject.userData.sector || null;
      selectedSector = sector;
      applySectorFocus(selectedSector);
      if (hitObject.userData.company) {
        setSelectedCompanyTicker(hitObject.userData.company.ticker);
        focusAtX(hitObject.position.x, { distance: 18, height: 18 });
        return;
      }
      if (hitObject.userData.isSectorFloor) {
        setSelectedCompanyTicker("");
        focusAtX(hitObject.position.x, { distance: 28, height: 22 });
      }
    }

    function getHitFromEvent(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(pickables, false);
      return hit?.object || null;
    }

    function updatePointer(event) {
      if (isDragging) {
        overviewActive = false;
        setIsOverviewActive(false);
        dragMoved = true;
        terrain.rotation.y = startRotationY + (event.clientX - dragStartX) * 0.008;
        terrain.rotation.x = startRotationX + (event.clientY - dragStartY) * 0.008;
        showTooltip(null, null, mount, tooltipRef.current);
        return;
      }

      activeHit = getHitFromEvent(event);
      hovered = activeHit?.userData.company ? activeHit : null;
      showTooltip(hovered?.userData.company, event, mount, tooltipRef.current, metric);
    }

    function startDrag(event) {
      overviewActive = false;
      setIsOverviewActive(false);
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      startRotationX = terrain.rotation.x;
      startRotationY = terrain.rotation.y;
      dragMoved = false;
      selectedSector = null;
      activeHit = null;
      applySectorFocus(null);
      renderer.domElement.setPointerCapture(event.pointerId);
      showTooltip(null, null, mount, tooltipRef.current);
    }

    function stopDrag(event) {
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    }

    function clickTerrain(event) {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      activeHit = getHitFromEvent(event);
      if (shouldClearTerrainSelection(activeHit, dragMoved)) {
        selectedSector = null;
        hovered = null;
        setSelectedCompanyTicker("");
        setCompanySearchQuery("");
        applySectorFocus(null);
        showTooltip(null, null, mount, tooltipRef.current);
        return;
      }
      focusOnHit(activeHit);
    }

    function clearPointer() {
      hovered = null;
      activeHit = null;
      isDragging = false;
      showTooltip(null, null, mount, tooltipRef.current);
    }

    function zoom(event) {
      event.preventDefault();
      overviewActive = false;
      setIsOverviewActive(false);
      hovered = null;
      showTooltip(null, null, mount, tooltipRef.current);
      cameraDistance = clamp(cameraDistance + event.deltaY * 0.045, 8, 102);
      updateCameraTarget();
    }

    function animate() {
      animationFrame = requestAnimationFrame(animate);
      if (overviewActive) {
        const elapsed = (performance.now() - overviewStartedAt) / 1000;
        const loopDuration = 72;
        const loopTime = elapsed % loopDuration;
        const isSkimPass = loopTime >= 24 && loopTime < 40;
        const isClosePass = loopTime >= 40 && loopTime < 58;
        const isReturnPass = loopTime >= 58;
        const widePhase = Math.min(loopTime, 24) / 24;
        const skimPhase = isSkimPass ? (loopTime - 24) / 16 : 0;
        const closePhase = isClosePass ? (loopTime - 40) / 18 : 0;
        const returnPhase = isReturnPass ? (loopTime - 58) / 14 : 0;
        const closeCameraDistance = 0.35;
        const closeCameraHeight = 78;
        const smooth = (value) => value * value * (3 - 2 * value);
        const wideEase = smooth(widePhase);
        const skimEase = smooth(skimPhase);
        const closeEase = smooth(closePhase);
        const returnEase = 0.5 - Math.cos(returnPhase * Math.PI) * 0.5;
        const targetFocus = isClosePass
          ? -96 + closeEase * 192
          : isReturnPass
            ? 96 - returnEase * 184
            : isSkimPass
              ? 88 - skimEase * 166
              : -82 + wideEase * 170;
        focusRef.current += (targetFocus - focusRef.current) * 0.032;
        setFocusPosition(Math.round(focusRef.current));
        cameraDistance = isClosePass
          ? closeCameraDistance
          : isReturnPass
            ? closeCameraDistance + returnEase * (38 - closeCameraDistance)
            : isSkimPass
              ? 30 + Math.sin(skimEase * Math.PI) * 6
              : 38 + Math.sin(wideEase * Math.PI) * 9;
        cameraHeight = isClosePass
          ? closeCameraHeight
          : isReturnPass
            ? closeCameraHeight - returnEase * (closeCameraHeight - defaultCameraHeight)
            : isSkimPass
              ? defaultCameraHeight - 8 + Math.sin(skimEase * Math.PI) * 4
              : defaultCameraHeight + Math.sin(wideEase * Math.PI) * 7;
        terrain.rotation.y = isClosePass
          ? 0
          : isReturnPass
            ? (1 - returnEase) * -0.22
            : isSkimPass
              ? 0.62 - skimEase * 1.08
              : Math.sin(wideEase * Math.PI * 2) * 0.42;
        terrain.rotation.x = isClosePass
          ? 0
          : isReturnPass
            ? returnEase * defaultRotation.x
            : isSkimPass
              ? -0.42 + Math.sin(skimEase * Math.PI) * 0.12
              : -0.2 + Math.sin(wideEase * Math.PI * 2 + 0.7) * 0.18;
      }
      updateCameraTarget();
      companyBars.forEach((mesh) => {
        const currentHighlightedTicker = activeHighlightedTickerRef.current;
        const isHighlighted = currentHighlightedTicker === mesh.userData.company.ticker;
        const active = mesh === hovered || isHighlighted;
        const isDimmed =
          (currentHighlightedTicker && !isHighlighted && mesh !== hovered) ||
          (selectedSector && mesh.userData.sector !== selectedSector);
        const targetX = active ? mesh.userData.baseScaleX * 1.22 : mesh.userData.baseScaleX;
        const targetZ = active ? mesh.userData.baseScaleZ * 1.22 : mesh.userData.baseScaleZ;
        mesh.scale.x += (targetX - mesh.scale.x) * 0.22;
        mesh.scale.z += (targetZ - mesh.scale.z) * 0.22;
        mesh.material.opacity += ((isDimmed ? 0.22 : 0.96) - mesh.material.opacity) * 0.22;
        mesh.material.emissive?.setHex(isHighlighted ? 0xf2f7ff : 0x000000);
        mesh.material.emissiveIntensity = isHighlighted ? 0.35 : 0;
      });
      renderer.render(scene, camera);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    animate();

    renderer.domElement.addEventListener("pointerdown", startDrag);
    renderer.domElement.addEventListener("pointermove", updatePointer);
    renderer.domElement.addEventListener("pointerup", stopDrag);
    renderer.domElement.addEventListener("click", clickTerrain);
    renderer.domElement.addEventListener("pointercancel", clearPointer);
    renderer.domElement.addEventListener("pointerleave", clearPointer);
    renderer.domElement.addEventListener("wheel", zoom, { passive: false });

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", startDrag);
      renderer.domElement.removeEventListener("pointermove", updatePointer);
      renderer.domElement.removeEventListener("pointerup", stopDrag);
      renderer.domElement.removeEventListener("click", clickTerrain);
      renderer.domElement.removeEventListener("pointercancel", clearPointer);
      renderer.domElement.removeEventListener("pointerleave", clearPointer);
      renderer.domElement.removeEventListener("wheel", zoom);
      mount.removeChild(renderer.domElement);
      overviewRef.current = null;
      labelSprites.forEach((sprite) => {
        sprite.material.map.dispose();
        sprite.material.dispose();
      });
      tickerLabels.forEach((label) => {
        label.material.map.dispose();
        label.material.dispose();
        label.geometry.dispose();
      });
      disposableGeometries.forEach((geometry) => geometry.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      resetViewRef.current = null;
    };
  }, [companies, metric, resetVersion, sectorSummaries]);

  return h(
    "section",
    { className: "terrain-panel terrain-panel-improved" },
    h(
      "div",
      { className: "chart-header terrain-improved-header" },
      h(
        "div",
        null,
        h("h2", null, title),
        h("p", null, description)
      ),
      h(
        "div",
        { className: "terrain-actions" },
        showTimeControls &&
          h(
            "div",
            { className: "segmented compact time-span", role: "group", "aria-label": "Improved terrain time span" },
            timeSpans.map((option) =>
              h(
                "button",
                {
                  key: option.value,
                  type: "button",
                  className: timeSpan === option.value ? "active" : "",
                  onClick: () => onTimeSpanChange(option.value)
                },
                option.label
              )
            )
          ),
        h(
          "div",
          { className: "segmented compact", role: "group", "aria-label": "3D terrain metric" },
          metricOptions.map((option) =>
            h(
              "button",
              {
                key: option.value,
                type: "button",
                className: metric === option.value ? "active" : "",
                onClick: () => setMetric(option.value)
              },
              option.label
            )
          )
        ),
        h(
          "button",
          {
            className: "reset-button",
            type: "button",
            "aria-pressed": isOverviewActive,
            onClick: () => {
              const next = !isOverviewActive;
              setIsOverviewActive(next);
              if (next) overviewRef.current?.start();
              else overviewRef.current?.stop();
            }
          },
          isOverviewActive ? "Stop overview" : "Overview"
        ),
        h(
          "button",
          {
            className: "reset-button",
            type: "button",
            onClick: () => {
              setIsOverviewActive(false);
              overviewRef.current?.stop();
              setResetVersion((version) => version + 1);
              resetViewRef.current?.();
            }
          },
          "Reset view"
        )
      )
    ),
    children,
    showCompanyFinder &&
      h(CompanySearch, {
        searchId: `terrain-company-search-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        query: companySearchQuery,
        suggestions: companySuggestions,
        highlightedTicker: activeHighlightedTicker,
        onQueryChange: (value) => {
          setCompanySearchQuery(value);
          setSelectedCompanyTicker("");
        },
        onSelectCompany: (company) => {
          setCompanySearchQuery(company.ticker);
          setSelectedCompanyTicker(company.ticker);
        },
        onClear: () => {
          setCompanySearchQuery("");
          setSelectedCompanyTicker("");
        }
      }),
    h(
      "div",
      { className: "sector-summary-strip" },
      sectorSummaries.map((summary) =>
        h(
          "div",
          {
            className: `sector-summary ${summary.netMarketCapChange >= 0 ? "positive" : "negative"}`,
            key: summary.sector
          },
          h("span", null, summary.sector),
          h("strong", null, formatCurrencyCompact(summary.netMarketCapChange)),
          h("small", null, `${summary.companyCount} companies`)
        )
      )
    ),
    h(
      "div",
      { className: "terrain-wrap terrain-wrap-improved", ref: mountRef },
      selectedCompany && h(PinnedCompanyTooltip, { company: selectedCompany, metric }),
      h("div", { className: "terrain-tooltip", ref: tooltipRef })
    ),
    h(
      "label",
      { className: "terrain-focus-control" },
      h("span", null, "View focus"),
      h("input", {
        type: "range",
        min: "-100",
        max: "100",
        value: focusPosition,
        onChange: (event) => {
          const value = Number(event.target.value);
          focusRef.current = value;
          setFocusPosition(value);
        }
      })
    )
  );
}

function buildSectorSummaries(companies) {
  return getOrderedSectors(companies).map((sector) => {
    const sectorCompanies = companies.filter((company) => company.sector === sector);
    return {
      sector,
      companyCount: sectorCompanies.length,
      netMarketCapChange: sectorCompanies.reduce((sum, company) => sum + company.marketCapChange, 0)
    };
  }).filter((summary) => summary.companyCount > 0);
}

function PinnedCompanyTooltip({ company, metric }) {
  const quality = company.dataQuality;
  return h(
    "div",
    { className: "terrain-tooltip terrain-tooltip-pinned visible" },
    h("strong", null, `${company.ticker} - ${company.companyName}`),
    h("span", null, company.sector),
    h("span", null, `Market cap change: ${formatCurrency(company.marketCapChange)}`),
    h("span", null, `Percent change: ${formatPercent(company.percentChange)}`),
    h("span", null, `Volume: ${formatNumberCompact(company.volume)}`),
    h("span", null, `Active mode: ${metricLabel(metric)}`),
    quality &&
      h(
        React.Fragment,
        null,
        h("span", null, `Data confidence: ${quality.confidence.toUpperCase()} (${quality.score}/100)`),
        h("span", null, `Share estimate: ${quality.shareEstimateMethod}`),
        quality.apiInceptionDate &&
          h("span", null, `API inception/start date: ${quality.apiInceptionDate}`),
        quality.warnings?.length && h("span", null, `Warnings: ${quality.warnings.join("; ")}`)
      )
  );
}

function buildCompanySuggestions(companies, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return companies
    .map((company) => {
      const ticker = company.ticker.toLowerCase();
      const name = company.companyName.toLowerCase();
      let score = 0;
      if (ticker === normalizedQuery) score = 100;
      else if (ticker.startsWith(normalizedQuery)) score = 90;
      else if (name.startsWith(normalizedQuery)) score = 70;
      else if (ticker.includes(normalizedQuery)) score = 55;
      else if (name.includes(normalizedQuery)) score = 45;
      return { company, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.abs(b.company.marketCapChange) - Math.abs(a.company.marketCapChange);
    })
    .slice(0, 10)
    .map((item) => item.company);
}

function buildSectorLayouts(companies, rowsPerSector, spacing, sectorGap) {
  const grouped = getOrderedSectors(companies).map((sector) => ({
    sector,
    companies: companies.filter((company) => company.sector === sector)
  })).filter((group) => group.companies.length > 0);

  const rawLayouts = grouped.map((group) => {
    const columns = Math.ceil(group.companies.length / rowsPerSector);
    return {
      ...group,
      columns,
      width: Math.max(1, (columns - 1) * spacing),
      depth: Math.max(1, (rowsPerSector - 1) * spacing)
    };
  });

  const totalWidth =
    rawLayouts.reduce((sum, layout) => sum + layout.width, 0) +
    Math.max(0, rawLayouts.length - 1) * sectorGap;
  const maxDepth = Math.max(...rawLayouts.map((layout) => layout.depth), 1);
  let cursor = -totalWidth / 2;

  return {
    totalWidth,
    maxDepth,
    layouts: rawLayouts.map((layout) => {
      const xStart = cursor;
      cursor += layout.width + sectorGap;
      return { ...layout, xStart, centerX: xStart + layout.width / 2 };
    })
  };
}

function getOrderedSectors(companies) {
  const sectors = [...new Set(companies.map((company) => company.sector || "Unclassified"))];
  return [
    ...SECTOR_ORDER.filter((sector) => sectors.includes(sector)),
    ...sectors.filter((sector) => !SECTOR_ORDER.includes(sector)).sort()
  ];
}

function addMeasurementGrid(group, options) {
  const { fieldWidth, fieldDepth, metricScale, guideMaterial, axisMaterial, labelSprites, metric } = options;
  const xStart = -fieldWidth / 2 - 2;
  const xEnd = fieldWidth / 2 + 1;
  const zBack = -fieldDepth / 2 - 1.18;
  const zFront = fieldDepth / 2 + 0.62;
  const tickValues = getTickValues(metricScale, metric);

  tickValues.forEach((tick) => {
    const y = metricY(tick, metricScale);
    addLine(group, [xStart, y, zBack], [xEnd, y, zBack], guideMaterial);
    addLine(group, [xStart, y, zFront], [xStart, y, zBack], guideMaterial);
    addLine(group, [xStart, y, zBack], [xStart, y + 0.0001, zFront], guideMaterial);
    const label = createTextSprite(formatMetricTick(tick, metric), {
      fontSize: 38,
      color: "#eef6ff",
      background: "rgba(7, 11, 17, 0.76)",
      paddingX: 18,
      paddingY: 8
    });
    label.position.set(xStart - 1.14, y, zBack);
    label.scale.set(2.55, 0.72, 1);
    group.add(label);
    labelSprites.push(label);
  });

  addLine(group, [xStart, -metricScale.negativeHeight, zBack], [xStart, metricScale.positiveHeight, zBack], axisMaterial);
  const title = createTextSprite(metricLabel(metric), {
    fontSize: 34,
    color: "#9fb5d0",
    background: "rgba(7, 11, 17, 0.66)",
    paddingX: 18,
    paddingY: 8
  });
  title.position.set(xStart - 1.62, metricScale.positiveHeight + 1.05, zBack);
  title.scale.set(4.7, 0.82, 1);
  group.add(title);
  labelSprites.push(title);
}

function addRectGrid(group, layout, rowsPerSector, spacing, material) {
  const zStart = -layout.depth / 2;
  const zEnd = layout.depth / 2;
  const xEnd = layout.xStart + layout.width;
  for (let column = 0; column < layout.columns; column += 1) {
    const x = layout.xStart + column * spacing;
    addLine(group, [x, 0.08, zStart], [x, 0.08, zEnd], material);
  }
  for (let row = 0; row < rowsPerSector; row += 1) {
    const z = zStart + row * spacing;
    addLine(group, [layout.xStart, 0.08, z], [xEnd, 0.08, z], material);
  }
}

function addLine(group, start, end, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...start),
    new THREE.Vector3(...end)
  ]);
  const line = new THREE.Line(geometry, material);
  group.add(line);
  return line;
}

function createTextSprite(text, options) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `700 ${options.fontSize}px Inter, system-ui, sans-serif`;
  const metrics = context.measureText(text);
  canvas.width = Math.ceil(metrics.width + options.paddingX * 2);
  canvas.height = Math.ceil(options.fontSize + options.paddingY * 2);
  context.font = `700 ${options.fontSize}px Inter, system-ui, sans-serif`;
  context.fillStyle = options.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function createTickerTopLabel(ticker) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const letters = String(ticker || "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 4)
    .split("");

  context.fillStyle = "rgba(5, 9, 14, 0.72)";
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = "rgba(232, 241, 255, 0.18)";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, 127, 127);
  context.fillStyle = "#f2f7ff";
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (letters.length <= 1) {
    context.font = "900 108px Inter, system-ui, sans-serif";
    context.fillText(letters[0] || "", 64, 66);
  } else if (letters.length === 2) {
    context.font = "900 72px Inter, system-ui, sans-serif";
    context.fillText(letters[0], 33, 65);
    context.fillText(letters[1], 95, 65);
  } else {
    context.font = "900 55px Inter, system-ui, sans-serif";
    const positions = [
      [33, 36],
      [95, 36],
      [33, 96],
      [95, 96]
    ];
    positions.forEach(([x, y], index) => {
      if (letters[index]) context.fillText(letters[index], x, y);
    });
    context.strokeStyle = "rgba(232, 241, 255, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(64, 2);
    context.lineTo(64, 126);
    context.moveTo(2, 64);
    context.lineTo(126, 64);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
}

function getMetricValue(company, metric) {
  if (metric === "percentChange") return Math.max(-100, company.percentChange);
  if (metric === "volume") return company.volume;
  return company.marketCapChange;
}

function getMetricColor(company, metric) {
  if (metric === "volume") return 0x8fb6ff;
  const value = metric === "percentChange" ? company.percentChange : company.marketCapChange;
  return value >= 0 ? 0x38df93 : 0xff5d72;
}

function buildMetricScale(values, metric, maxTerrainHeight) {
  if (metric === "percentChange") {
    const positiveMax = Math.max(1, Math.ceil(Math.max(1, ...values.filter((value) => value > 0))));
    return {
      positiveMax,
      negativeMax: 100,
      positiveHeight: maxTerrainHeight,
      negativeHeight: maxTerrainHeight,
      positiveScale: maxTerrainHeight / positiveMax,
      negativeScale: maxTerrainHeight / 100
    };
  }

  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);
  return {
    positiveMax: maxAbs,
    negativeMax: maxAbs,
    positiveHeight: maxTerrainHeight,
    negativeHeight: metric === "volume" ? 0 : maxTerrainHeight,
    positiveScale: maxTerrainHeight / maxAbs,
    negativeScale: maxTerrainHeight / maxAbs
  };
}

function metricHeight(value, scale) {
  return Math.abs(value) * (value >= 0 ? scale.positiveScale : scale.negativeScale);
}

function metricY(value, scale) {
  return value >= 0 ? value * scale.positiveScale : value * scale.negativeScale;
}

function getTickValues(scale, metric) {
  if (metric === "volume") {
    const maxMillions = Math.ceil(scale.positiveMax / 1_000_000 / 25) * 25;
    return [0, maxMillions * 0.25, maxMillions * 0.5, maxMillions * 0.75, maxMillions].map((value) => value * 1_000_000);
  }
  if (metric === "percentChange") {
    const maxPercent = Math.max(1, Math.ceil(scale.positiveMax / 25) * 25);
    return [-100, -50, 0, maxPercent / 2, maxPercent];
  }
  const maxBillions = Math.max(5, Math.ceil(scale.positiveMax / 1_000_000_000 / 5) * 5);
  return [-maxBillions, -maxBillions / 2, 0, maxBillions / 2, maxBillions].map((value) => value * 1_000_000_000);
}

function formatMetricTick(value, metric) {
  if (metric === "volume") return formatNumberCompact(value);
  if (metric === "percentChange") return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
  if (value === 0) return "$0";
  const absolute = Math.round(Math.abs(value) / 1_000_000_000);
  return `${value < 0 ? "-" : ""}$${absolute}B`;
}

function metricLabel(metric) {
  if (metric === "volume") return "Volume";
  if (metric === "percentChange") return "Percent change";
  return "Market cap change ($B)";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showTooltip(company, event, mount, tooltip, metric) {
  if (!tooltip) return;
  if (!company || !event) {
    tooltip.classList.remove("visible");
    return;
  }

  const rect = mount.getBoundingClientRect();
  const quality = company.dataQuality;
  const qualityHtml = quality
    ? `
      <span>Data confidence: ${quality.confidence.toUpperCase()} (${quality.score}/100)</span>
      <span>Share estimate: ${quality.shareEstimateMethod}</span>
      ${quality.apiInceptionDate ? `<span>API inception/start date: ${quality.apiInceptionDate}</span>` : ""}
      ${quality.warnings?.length ? `<span>Warnings: ${quality.warnings.join("; ")}</span>` : ""}
    `
    : "";
  tooltip.innerHTML = `
    <strong>${company.ticker} - ${company.companyName}</strong>
    <span>${company.sector}</span>
    <span>Market cap change: ${formatCurrency(company.marketCapChange)}</span>
    <span>Percent change: ${formatPercent(company.percentChange)}</span>
    <span>Volume: ${formatNumberCompact(company.volume)}</span>
    <span>Active mode: ${metricLabel(metric)}</span>
    ${qualityHtml}
  `;
  tooltip.style.left = `${Math.min(event.clientX - rect.left + 16, rect.width - 286)}px`;
  tooltip.style.top = `${Math.max(event.clientY - rect.top - 16, 14)}px`;
  tooltip.classList.add("visible");
}
