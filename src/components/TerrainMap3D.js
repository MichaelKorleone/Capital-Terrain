import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  formatCurrency,
  formatNumberCompact,
  formatPercent
} from "../utils/formatters.js";
import { SECTOR_ORDER } from "../data/mockCompanies.js";

const h = React.createElement;

export function TerrainMap3D({ companies, highlightedTicker = "" }) {
  const mountRef = useRef(null);
  const tooltipRef = useRef(null);
  const focusRef = useRef(0);
  const [focusPosition, setFocusPosition] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c13);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1000);
    camera.position.set(0, 29, 52);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0x9db5d6, 0.72);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(26, 44, 18);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const terrain = new THREE.Group();
    terrain.rotation.x = -0.08;
    scene.add(terrain);

    const rowsPerSector = 8;
    const spacing = 0.88;
    const sectorGap = 1.35;
    const maxAbs = Math.max(...companies.map((company) => Math.abs(company.marketCapChange)), 1);
    const maxTerrainHeight = 11;
    const heightScale = maxTerrainHeight / maxAbs;
    const sectorLayouts = buildSectorLayouts(companies, rowsPerSector, spacing, sectorGap);
    const fieldWidth = sectorLayouts.totalWidth;
    const fieldDepth = sectorLayouts.maxDepth;
    const labelSprites = [];
    const floorMeshes = [];

    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x2d3d52,
      transparent: true,
      opacity: 0.42
    });
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xe8f1ff });
    const zeroMaterial = new THREE.LineBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.85 });

    sectorLayouts.layouts.forEach((layout, index) => {
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(layout.width + 0.52, 0.06, layout.depth + 0.52),
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? 0x111926 : 0x151e2b,
          roughness: 0.88,
          metalness: 0.08,
          transparent: true,
          opacity: 0.84,
          depthWrite: false
        })
      );
      floor.position.set(layout.centerX, 0, 0);
      floor.receiveShadow = true;
      terrain.add(floor);
      floorMeshes.push(floor);

      addRectGrid(terrain, layout, rowsPerSector, spacing, gridMaterial);
      addLine(
        terrain,
        [layout.xStart - 0.34, 0.1, -fieldDepth / 2 - 0.24],
        [layout.xStart - 0.34, 0.1, fieldDepth / 2 + 0.24],
        zeroMaterial
      );

      const sectorLabel = createTextSprite(layout.sector, {
        fontSize: 34,
        color: "#d9e7f8",
        background: "rgba(8, 12, 19, 0.64)",
        paddingX: 18,
        paddingY: 8
      });
      sectorLabel.position.set(layout.centerX, 0.42, fieldDepth / 2 + 1.05);
      sectorLabel.scale.set(4.3, 1.05, 1);
      terrain.add(sectorLabel);
      labelSprites.push(sectorLabel);
    });

    const positiveMaterial = new THREE.MeshStandardMaterial({
      color: 0x34d58b,
      roughness: 0.48,
      metalness: 0.12
    });
    const negativeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5a70,
      roughness: 0.52,
      metalness: 0.1
    });

    const barGeometry = new THREE.BoxGeometry(0.56, 1, 0.56);
    const pickables = [];
    const bars = new THREE.Group();

    sectorLayouts.layouts.forEach((layout) => {
      layout.companies.forEach((company, index) => {
      const column = Math.floor(index / rowsPerSector);
      const row = index % rowsPerSector;
      const height = Math.max(0.14, Math.abs(company.marketCapChange) * heightScale);
      const mesh = new THREE.Mesh(
        barGeometry,
        (company.marketCapChange >= 0 ? positiveMaterial : negativeMaterial).clone()
      );

      mesh.scale.y = height;
      const isPositive = company.marketCapChange >= 0;
      mesh.position.set(
        layout.xStart + column * spacing,
        isPositive ? height / 2 + 0.05 : -height / 2 - 0.05,
        row * spacing - layout.depth / 2
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.company = company;
      mesh.userData.baseScaleX = 1;
      mesh.userData.baseScaleZ = 1;
      bars.add(mesh);
      pickables.push(mesh);
      });
    });

    terrain.add(bars);
    addYAxis(terrain, {
      x: -fieldWidth / 2 - 1.72,
      z: -fieldDepth / 2 - 1.02,
      maxAbs,
      heightScale,
      maxTerrainHeight,
      axisMaterial,
      labelSprites
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let animationFrame = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startRotationX = terrain.rotation.x;
    let startRotationY = terrain.rotation.y;
    let cameraDistance = 52;

    function cameraFocusX() {
      return (focusRef.current / 100) * (fieldWidth / 2);
    }

    function updateCameraTarget() {
      const focusX = cameraFocusX();
      camera.position.x = focusX;
      camera.position.z = cameraDistance;
      camera.lookAt(focusX, 0, 0);
      camera.updateProjectionMatrix();
    }

    function resize() {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(420, Math.min(640, width * 0.48));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (width < 700 && cameraDistance < 62) cameraDistance = 66;
      updateCameraTarget();
    }

    function updatePointer(event) {
      if (isDragging) {
        const deltaX = event.clientX - dragStartX;
        const deltaY = event.clientY - dragStartY;
        terrain.rotation.y = startRotationY + deltaX * 0.008;
        terrain.rotation.x = startRotationX + deltaY * 0.008;
        showTooltip(null, null, mount, tooltipRef.current);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(pickables, false);
      hovered = hit?.object || null;
      showTooltip(hovered?.userData.company, event, mount, tooltipRef.current);
    }

    function startDrag(event) {
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      startRotationX = terrain.rotation.x;
      startRotationY = terrain.rotation.y;
      renderer.domElement.setPointerCapture(event.pointerId);
      showTooltip(null, null, mount, tooltipRef.current);
    }

    function stopDrag(event) {
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    }

    function clearPointer() {
      hovered = null;
      isDragging = false;
      showTooltip(null, null, mount, tooltipRef.current);
    }

    function zoom(event) {
      event.preventDefault();
      hovered = null;
      showTooltip(null, null, mount, tooltipRef.current);
      const delta = event.deltaY * 0.045;
      cameraDistance = clamp(cameraDistance + delta, 22, 96);
      updateCameraTarget();
    }

    function animate() {
      animationFrame = requestAnimationFrame(animate);
      updateCameraTarget();
      pickables.forEach((mesh) => {
        const isHighlighted = highlightedTicker === mesh.userData.company.ticker;
        const isDimmed = highlightedTicker && !isHighlighted;
        const targetScale = mesh === hovered || isHighlighted ? 1.34 : 1;
        mesh.scale.x += (targetScale - mesh.scale.x) * 0.24;
        mesh.scale.z += (targetScale - mesh.scale.z) * 0.24;
        mesh.material.opacity = isDimmed ? 0.28 : 1;
        mesh.material.transparent = Boolean(isDimmed);
        mesh.material.emissive?.setHex(isHighlighted ? 0xf2f7ff : 0x000000);
        mesh.material.emissiveIntensity = isHighlighted ? 0.34 : 0;
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
    renderer.domElement.addEventListener("pointercancel", clearPointer);
    renderer.domElement.addEventListener("pointerleave", clearPointer);
    renderer.domElement.addEventListener("wheel", zoom, { passive: false });

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", startDrag);
      renderer.domElement.removeEventListener("pointermove", updatePointer);
      renderer.domElement.removeEventListener("pointerup", stopDrag);
      renderer.domElement.removeEventListener("pointercancel", clearPointer);
      renderer.domElement.removeEventListener("pointerleave", clearPointer);
      renderer.domElement.removeEventListener("wheel", zoom);
      mount.removeChild(renderer.domElement);
      barGeometry.dispose();
      positiveMaterial.dispose();
      negativeMaterial.dispose();
      pickables.forEach((mesh) => mesh.material.dispose());
      gridMaterial.dispose();
      axisMaterial.dispose();
      zeroMaterial.dispose();
      floorMeshes.forEach((floor) => {
        floor.geometry.dispose();
        floor.material.dispose();
      });
      labelSprites.forEach((sprite) => {
        sprite.material.map.dispose();
        sprite.material.dispose();
      });
      renderer.dispose();
    };
  }, [companies, highlightedTicker]);

  return h(
    "section",
    { className: "terrain-panel" },
    h(
      "div",
      { className: "chart-header" },
      h(
        "div",
        null,
        h("h2", null, "3D market cap terrain field"),
        h(
          "p",
          null,
          "Companies are grouped into sector strips across a rectangular field. Green mountains rise above the plane; red valleys descend below it."
        )
      ),
      h(
        "div",
        { className: "legend" },
        h("span", { className: "legend-item positive" }, "Positive repricing"),
        h("span", { className: "legend-item negative" }, "Negative repricing")
      )
    ),
    h(
      "div",
      { className: "terrain-wrap", ref: mountRef },
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

  const layouts = rawLayouts.map((layout) => {
    const xStart = cursor;
    const positioned = {
      ...layout,
      xStart,
      centerX: xStart + layout.width / 2
    };
    cursor += layout.width + sectorGap;
    return positioned;
  });

  return { layouts, totalWidth, maxDepth };
}

function getOrderedSectors(companies) {
  const sectors = [...new Set(companies.map((company) => company.sector || "Unclassified"))];
  return [
    ...SECTOR_ORDER.filter((sector) => sectors.includes(sector)),
    ...sectors.filter((sector) => !SECTOR_ORDER.includes(sector)).sort()
  ];
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

function addYAxis(
  group,
  { x, z, maxAbs, heightScale, maxTerrainHeight, axisMaterial, labelSprites }
) {
  addLine(group, [x, -maxTerrainHeight, z], [x, maxTerrainHeight, z], axisMaterial);

  const maxBillions = Math.max(5, Math.ceil(maxAbs / 1_000_000_000 / 5) * 5);
  const ticks = [-maxBillions, -maxBillions / 2, 0, maxBillions / 2, maxBillions];

  ticks.forEach((tick) => {
    const y = tick * 1_000_000_000 * heightScale;
    addLine(group, [x - 0.32, y, z], [x + 0.32, y, z], axisMaterial);
    const label = createTextSprite(formatBillionsTick(tick), {
      fontSize: 38,
      color: "#edf5ff",
      background: "rgba(8, 12, 19, 0.72)",
      paddingX: 16,
      paddingY: 8
    });
    label.position.set(x - 1.28, y, z);
    label.scale.set(2.35, 0.72, 1);
    group.add(label);
    labelSprites.push(label);
  });

  const title = createTextSprite("Market cap change ($B)", {
    fontSize: 34,
    color: "#9fb5d0",
    background: "rgba(8, 12, 19, 0.6)",
    paddingX: 18,
    paddingY: 8
  });
  title.position.set(x - 1.56, maxTerrainHeight + 1.12, z);
  title.scale.set(4.4, 0.86, 1);
  group.add(title);
  labelSprites.push(title);
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
  const fontSize = options.fontSize;
  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const metrics = context.measureText(text);
  canvas.width = Math.ceil(metrics.width + options.paddingX * 2);
  canvas.height = Math.ceil(fontSize + options.paddingY * 2);
  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  context.fillStyle = options.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  return new THREE.Sprite(material);
}

function formatBillionsTick(value) {
  if (value === 0) return "$0";
  const absolute = Math.round(Math.abs(value));
  return `${value < 0 ? "-" : ""}$${absolute}B`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showTooltip(company, event, mount, tooltip) {
  if (!tooltip) return;
  if (!company || !event) {
    tooltip.classList.remove("visible");
    return;
  }

  const rect = mount.getBoundingClientRect();
  tooltip.innerHTML = `
    <strong>${company.ticker} - ${company.companyName}</strong>
    <span>${company.sector}</span>
    <span>Market cap change: ${formatCurrency(company.marketCapChange)}</span>
    <span>Percent change: ${formatPercent(company.percentChange)}</span>
    <span>Volume: ${formatNumberCompact(company.volume)}</span>
  `;
  tooltip.style.left = `${Math.min(event.clientX - rect.left + 16, rect.width - 286)}px`;
  tooltip.style.top = `${Math.max(event.clientY - rect.top - 16, 14)}px`;
  tooltip.classList.add("visible");
}
