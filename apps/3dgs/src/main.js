import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const palettes = [
  { name: "Solid", stops: [] },
  { name: "Blue Yellow", stops: ["#1d4ed8", "#00e5ff", "#f9ff00", "#ff8a00"] },
  { name: "Neon", stops: ["#7c3aed", "#00f5d4", "#b8ff00", "#ff007a"] },
  { name: "Plasma", stops: ["#2400ff", "#8b5cf6", "#ff2bd6", "#ffe600"] },
  { name: "Candy", stops: ["#00bbf9", "#00f5d4", "#fee440", "#f15bb5"] },
  { name: "SH Bands", stops: ["#00f5ff", "#35ff69", "#fff000", "#ff3d81"] },
];

const defaults = [
  {
    name: "Gaussian 1",
    color: "#2f80ff",
    alpha: 0.46,
    scale: { x: 1.0, y: 1.2, z: 0.9 },
    palette: 1,
    rotation: { x: 0.15, y: -0.2, z: 0.1 },
  },
  {
    name: "Gaussian 2",
    color: "#ffe45c",
    alpha: 0.52,
    scale: { x: 0.9, y: 1.0, z: 1.45 },
    palette: 3,
    rotation: { x: -0.1, y: 0.28, z: -0.18 },
  },
  {
    name: "Gaussian 3",
    color: "#36d399",
    alpha: 0.3,
    scale: { x: 1.25, y: 0.85, z: 1.1 },
    palette: 5,
    rotation: { x: 0.22, y: -0.12, z: 0.24 },
  },
];

const state = {
  target: generatePuzzleColor(),
  rayOffset: { y: 0, z: 0 },
  gaussians: cloneDefaults(),
  solved: false,
};

const sceneEl = document.querySelector("#scene");
const targetInput = document.querySelector("#targetColor");
const targetSwatch = document.querySelector("#targetSwatch");
const outputSwatch = document.querySelector("#outputSwatch");
const matchReadout = document.querySelector("#matchReadout");
const channelHint = document.querySelector("#channelHint");
const successToast = document.querySelector("#successToast");
const controlsEl = document.querySelector("#gaussianControls");
const resetBtn = document.querySelector("#resetBtn");
const puzzleBtn = document.querySelector("#puzzleBtn");
const outputPixel = new THREE.Mesh(
  new THREE.PlaneGeometry(0.95, 0.95),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  }),
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sceneEl.clientWidth, sceneEl.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b14);
scene.fog = new THREE.Fog(0x080b14, 13, 26);

const camera = new THREE.PerspectiveCamera(
  44,
  sceneEl.clientWidth / sceneEl.clientHeight,
  0.1,
  100,
);
camera.position.set(0, 4.2, 10.8);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.minDistance = 6;
orbit.maxDistance = 16;
orbit.maxPolarAngle = Math.PI * 0.52;
orbit.target.set(0, 0.15, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x26384f, 3.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(-4, 6, 8);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x00f5ff, 12, 16);
cyanLight.position.set(-5, 2.5, 3);
scene.add(cyanLight);
const pinkLight = new THREE.PointLight(0xff2bd6, 9, 15);
pinkLight.position.set(4.5, 3, -3);
scene.add(pinkLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 7),
  new THREE.MeshStandardMaterial({
    color: 0x11182c,
    roughness: 0.64,
    metalness: 0.08,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.7;
scene.add(floor);

const grid = new THREE.GridHelper(14, 14, 0x00e5ff, 0x2b3a59);
grid.position.y = -1.67;
scene.add(grid);

const gaussianRoot = new THREE.Group();
const beamGroup = new THREE.Group();
scene.add(beamGroup, gaussianRoot);

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragStart = new THREE.Vector2();
const rotationStart = new THREE.Euler();
let dragMode = null;
let activeGaussian = null;

const splatPositions = [-3.2, 0, 3.2];
const splatLabels = ["left blob", "center blob", "right blob"];
const splats = [];
const labels = [];
const beamMeshes = [];
let arrowMesh = null;
let exitHalo = null;
const beamStartX = -5.8;
const beamEndX = 5.95;

buildControls();
buildSceneObjects();
bindPointerEvents();
updateDemo();
animate();

targetInput.addEventListener("input", (event) => {
  state.target = event.target.value;
  updateDemo();
});

puzzleBtn.addEventListener("click", () => {
  state.target = generatePuzzleColor();
  state.solved = false;
  updateDemo();
});

resetBtn.addEventListener("click", () => {
  state.rayOffset = { y: 0, z: 0 };
  state.gaussians = cloneDefaults();
  state.solved = false;
  targetInput.value = state.target;
  buildControls();
  updateDemo();
});

window.addEventListener("resize", resizeRenderer);

function buildControls() {
  controlsEl.innerHTML = "";

  state.gaussians.forEach((gaussian, index) => {
    const card = document.createElement("section");
    card.className = "gaussian-card";
    card.style.setProperty("--dot-color", gaussian.color);
    card.innerHTML = `
      <div class="gaussian-header">
        <div class="gaussian-title">
          <span class="dot"></span>
          <span>${gaussian.name}</span>
          <span class="blob-position">${splatLabels[index]}</span>
        </div>
        <input type="color" value="${gaussian.color}" aria-label="${gaussian.name} base color" data-field="color" data-index="${index}" />
      </div>
      ${rangeControl(index, "Opacity", "alpha", 0, 0.95, 0.01, gaussian.alpha)}
      ${rangeControl(index, "Stretch X", "scale.x", 0.45, 2.2, 0.01, gaussian.scale.x)}
      ${rangeControl(index, "Stretch Y", "scale.y", 0.45, 2.2, 0.01, gaussian.scale.y)}
      ${rangeControl(index, "Stretch Z", "scale.z", 0.45, 2.2, 0.01, gaussian.scale.z)}
      <div class="range-row">
        <label for="palette-${index}">Surface</label>
        <input id="palette-${index}" type="range" min="0" max="${palettes.length - 1}" step="1" value="${gaussian.palette}" data-field="palette" data-index="${index}" />
        <span class="value palette-value" data-value="palette-${index}">${palettes[gaussian.palette].name}</span>
      </div>
    `;

    card.addEventListener("input", (event) => {
      const input = event.target;
      const field = input.dataset.field;
      const itemIndex = Number(input.dataset.index);
      if (!field || Number.isNaN(itemIndex)) return;

      setGaussianField(itemIndex, field, input.value);
      card.style.setProperty("--dot-color", state.gaussians[itemIndex].color);

      const valueEl = card.querySelector(`[data-value="${input.id}"]`);
      if (valueEl) {
        valueEl.textContent =
          field === "palette"
            ? palettes[state.gaussians[itemIndex].palette].name
            : Number(input.value).toFixed(2);
      }

      updateDemo();
    });

    controlsEl.appendChild(card);
  });
}

function rangeControl(index, label, field, min, max, step, value) {
  const id = `${field.replace(".", "-")}-${index}`;
  return `
    <div class="range-row">
      <label for="${id}">${label}</label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-field="${field}" data-index="${index}" />
      <span class="value" data-value="${id}">${Number(value).toFixed(2)}</span>
    </div>
  `;
}

function setGaussianField(index, field, value) {
  const gaussian = state.gaussians[index];
  if (field === "color") {
    gaussian.color = value;
    return;
  }
  if (field === "palette") {
    gaussian.palette = Number(value);
    return;
  }
  if (field.startsWith("scale.")) {
    gaussian.scale[field.split(".")[1]] = Number(value);
    return;
  }
  gaussian[field] = Number(value);
}

function buildSceneObjects() {
  splatPositions.forEach((x, index) => {
    const group = new THREE.Group();
    group.position.set(x, 0, 0);
    group.userData.index = index;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 72, 36),
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.userData.dragType = "gaussian";
    mesh.userData.index = index;

    const label = createNumberLabel(index + 1, state.gaussians[index].color);
    label.position.set(0, 1.45, 0);

    group.add(mesh, label);
    gaussianRoot.add(group);
    splats.push({ group, mesh });
    labels.push(label);
  });

  for (let index = 0; index < state.gaussians.length + 1; index += 1) {
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.rotation.z = Math.PI / 2;

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    core.rotation.z = Math.PI / 2;

    beamGroup.add(glow, core);
    beamMeshes.push({ core, glow });
  }

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.62, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
    }),
  );
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(beamEndX + 0.28, 0, 0);
  arrow.userData.dragType = "ray";
  beamGroup.add(arrow);
  arrowMesh = arrow;

  outputPixel.position.set(beamEndX + 1, 0, 0);
  outputPixel.rotation.y = -Math.PI / 2;
  outputPixel.userData.dragType = "ray";
  beamGroup.add(outputPixel);

  exitHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.66, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  exitHalo.position.set(beamEndX + 0.99, 0, 0);
  exitHalo.rotation.y = -Math.PI / 2;
  exitHalo.userData.dragType = "ray";
  beamGroup.add(exitHalo);
}

function bindPointerEvents() {
  renderer.domElement.addEventListener("pointerdown", (event) => {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(splatMeshes(), false);
    const hit = hits[0];
    if (!hit) return;

    renderer.domElement.setPointerCapture(event.pointerId);
    orbit.enabled = false;
    dragStart.set(event.clientX, event.clientY);

    dragMode = "gaussian";
    activeGaussian = hit.object.userData.index;
    rotationStart.copy(splats[activeGaussian].group.rotation);
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!dragMode) return;

    if (activeGaussian === null) return;
    const dx = (event.clientX - dragStart.x) * 0.012;
    const dy = (event.clientY - dragStart.y) * 0.012;
    const gaussian = state.gaussians[activeGaussian];
    gaussian.rotation.y = rotationStart.y + dx;
    gaussian.rotation.x = rotationStart.x + dy;
    updateDemo();
  });

  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointercancel", endDrag);
}

function endDrag(event) {
  if (event.pointerId !== undefined && renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  dragMode = null;
  activeGaussian = null;
  orbit.enabled = true;
}

function updateDemo() {
  targetSwatch.style.background = state.target;
  targetInput.value = state.target;

  state.gaussians.forEach((gaussian, index) => {
    const splat = splats[index];
    splat.group.rotation.set(
      gaussian.rotation.x,
      gaussian.rotation.y,
      gaussian.rotation.z,
    );
    splat.group.scale.set(gaussian.scale.x, gaussian.scale.y, gaussian.scale.z);
    splat.mesh.material.opacity = 0.12 + gaussian.alpha * 0.78;
    updateSurfaceColors(splat.mesh.geometry, gaussian, index);
    updateNumberLabel(labels[index], index + 1, gaussian.color);
  });

  const blend = blendGaussians(state.gaussians);
  const outputHex = colorToHex(blend.output);
  const targetColor = hexToRgb(state.target);
  const match = colorMatch(blend.output, targetColor);
  outputSwatch.style.background = outputHex;
  outputPixel.material.color.set(outputHex);
  exitHalo.material.color.set(outputHex);
  matchReadout.textContent = `${Math.round(match)}%`;
  matchReadout.style.color = match >= 95 ? "#9dff7a" : "#f7fbff";
  channelHint.innerHTML = formatChannelHint(blend.output, targetColor);
  updateSuccessState(match);

  beamGroup.position.set(0, 0, 0);
  const visibleSegments = rayVisibleSegments();
  beamMeshes.forEach((beam, index) => {
    const beamColor = blend.beamColors[Math.min(index, blend.beamColors.length - 1)];
    const beamHex = colorToHex(rayDisplayColor(beamColor, index));
    updateBeamSegment(beam, visibleSegments[index]);
    beam.core.material.color.set(beamHex);
    beam.core.material.opacity = index === 0 ? 0.84 : 0.98;
    if (beam.glow) {
      beam.glow.material.color.set(beamHex);
      beam.glow.material.opacity = index === 0 ? 0.2 : 0.42;
    }
  });
  const finalHex = colorToHex(rayDisplayColor(blend.beamColors.at(-1), beamMeshes.length));
  arrowMesh.material.color.set(finalHex);
}

function blendGaussians(gaussians) {
  const incoming = { r: 1, g: 1, b: 1 };
  let accumulated = { r: 0, g: 0, b: 0 };
  let transmittance = 1;
  const steps = [];
  const beamColors = [{ ...incoming }];

  gaussians.forEach((gaussian, index) => {
    const splatColor = sampleExitSurfaceColor(gaussian, index);
    const rayStrength = rayCoverage(gaussian, index);
    const alpha = clamp(gaussian.alpha * rayStrength, 0, 0.98);
    const contribution = multiplyColor(splatColor, transmittance * alpha);
    accumulated = addColors(accumulated, contribution);
    steps.push({ alpha, color: splatColor, rayStrength });
    transmittance *= 1 - alpha;
    beamColors.push(addColors(accumulated, multiplyColor(incoming, transmittance)));
  });

  const color = addColors(accumulated, multiplyColor(incoming, transmittance));
  return { output: clampColor(color), steps, beamColors };
}

function sampleExitSurfaceColor(gaussian, index) {
  const exit = rayExitNormal(gaussian, index);
  return surfaceColorForNormal(gaussian, index, exit.x, exit.y, exit.z);
}

function updateSurfaceColors(geometry, gaussian, index) {
  const normal = geometry.getAttribute("normal");
  let colors = geometry.getAttribute("color");
  if (!colors) {
    colors = new THREE.BufferAttribute(new Float32Array(normal.count * 3), 3);
    geometry.setAttribute("color", colors);
  }

  const base = hexToRgb(gaussian.color);

  if (gaussian.palette === 0) {
    for (let i = 0; i < normal.count; i += 1) {
      colors.setXYZ(i, base.r, base.g, base.b);
    }
    colors.needsUpdate = true;
    return;
  }

  for (let i = 0; i < normal.count; i += 1) {
    const color = surfaceColorForNormal(
      gaussian,
      index,
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i),
    );
    colors.setXYZ(i, color.r, color.g, color.b);
  }

  colors.needsUpdate = true;
}

function surfaceColorForNormal(gaussian, index, nx, ny, nz) {
  const base = hexToRgb(gaussian.color);
  if (gaussian.palette === 0) return base;

  const palette = palettes[gaussian.palette];
  const phase = index * 1.2 + gaussian.rotation.x * 1.7 + gaussian.rotation.y;
  const frequency = [4.2, 6.8, 3.1][index] ?? 5.2;
  const mixAmount = [0.2, 0.36, 0.5][index] ?? 0.32;
  const bandA = clamp(0.5 + 0.44 * ny + 0.34 * Math.sin(nx * frequency + phase), 0, 1);
  const bandB = clamp(
    0.5 + 0.42 * nz + 0.32 * Math.cos((nx + ny) * (frequency * 0.82) - phase),
    0,
    1,
  );
  const mappedA = mixStops(palette.stops, bandA);
  const mappedB = mixStops([...palette.stops].reverse(), bandB);
  return boostColor(mixColors(mixColors(mappedA, mappedB, mixAmount), base, 0.1), 1.55);
}

function rayVisibleSegments() {
  let cursor = beamStartX;
  const segments = [];
  state.gaussians.forEach((gaussian, index) => {
    const span = rayIntersectionSpan(gaussian, index);
    segments.push({ from: cursor, to: span.enter });
    cursor = span.exit;
  });
  segments.push({ from: cursor, to: beamEndX });
  return segments;
}

function rayIntersectionSpan(gaussian, index) {
  const hit = raySphereIntersection(gaussian, index);
  if (!hit) {
    const fallbackRadius = Math.max(0.55, gaussian.scale.x);
    return {
      enter: splatPositions[index] - fallbackRadius,
      exit: splatPositions[index] + fallbackRadius,
    };
  }
  return {
    enter: hit.enterX,
    exit: hit.exitX,
  };
}

function updateBeamSegment(beam, segment) {
  const length = Math.max(0.001, segment.to - segment.from);
  const center = (segment.from + segment.to) / 2;
  [beam.core, beam.glow].forEach((mesh) => {
    if (!mesh) return;
    mesh.visible = length > 0.04;
    mesh.position.set(center, 0, 0);
    mesh.scale.set(1, length, 1);
  });
}

function rayExitNormal(gaussian, index) {
  const hit = raySphereIntersection(gaussian, index);
  if (!hit) return new THREE.Vector3(1, 0, 0);
  return hit.exitNormal;
}

function raySphereIntersection(gaussian, index) {
  const inverseRotation = new THREE.Euler(
    -gaussian.rotation.x,
    -gaussian.rotation.y,
    -gaussian.rotation.z,
  );
  const rayOrigin = new THREE.Vector3(
    -splatPositions[index],
    state.rayOffset.y,
    state.rayOffset.z,
  );
  const rayDirection = new THREE.Vector3(1, 0, 0);
  rayOrigin.applyEuler(inverseRotation);
  rayDirection.applyEuler(inverseRotation);

  const p = new THREE.Vector3(
    rayOrigin.x / gaussian.scale.x,
    rayOrigin.y / gaussian.scale.y,
    rayOrigin.z / gaussian.scale.z,
  );
  const d = new THREE.Vector3(
    rayDirection.x / gaussian.scale.x,
    rayDirection.y / gaussian.scale.y,
    rayDirection.z / gaussian.scale.z,
  );

  const a = d.dot(d);
  const b = 2 * p.dot(d);
  const c = p.dot(p) - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const t0 = (-b - root) / (2 * a);
  const t1 = (-b + root) / (2 * a);
  const exitNormal = p.clone().add(d.clone().multiplyScalar(Math.max(t0, t1))).normalize();
  return {
    enterX: t0,
    exitX: t1,
    exitNormal,
  };
}

function rayCoverage(gaussian, index) {
  const localPoint = new THREE.Vector3(0, state.rayOffset.y, state.rayOffset.z);
  localPoint.applyEuler(
    new THREE.Euler(-gaussian.rotation.x, -gaussian.rotation.y, -gaussian.rotation.z),
  );

  const xPath = clamp(gaussian.scale.x / 1.4, 0.35, 1.25);
  const y = localPoint.y / gaussian.scale.y;
  const z = localPoint.z / gaussian.scale.z;
  return clamp(Math.exp(-0.5 * (y * y + z * z)) * xPath, 0, 1);
}

function generatePuzzleColor() {
  const hue = Math.random() * 360;
  const saturation = 45 + Math.random() * 45;
  const lightness = 35 + Math.random() * 35;
  return hslToHex(hue, saturation, lightness);
}

function formatChannelHint(output, target) {
  return [
    ["R", target.r - output.r, "#ff5b6b"],
    ["G", target.g - output.g, "#36d399"],
    ["B", target.b - output.b, "#4ba3ff"],
  ]
    .map(([label, delta, color]) => {
      const percent = Math.round(delta * 100);
      const text =
        Math.abs(percent) <= 5
          ? `${label}: good`
          : percent > 0
            ? `Need ${percent}% more ${label}`
            : `Too much ${label} by ${Math.abs(percent)}%`;
      return `<span style="--hint-color:${color}">${text}</span>`;
    })
    .join("");
}

function createNumberLabel(number, color) {
  const texture = makeNumberTexture(number, color);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(0.54, 0.54, 1);
  sprite.renderOrder = 10;
  sprite.userData.number = number;
  sprite.userData.color = color;
  sprite.userData.texture = texture;
  return sprite;
}

function updateNumberLabel(sprite, number, color) {
  if (!sprite || (sprite.userData.number === number && sprite.userData.color === color)) return;

  const oldTexture = sprite.material.map;
  const texture = makeNumberTexture(number, color);
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  if (oldTexture) oldTexture.dispose();
  sprite.userData.number = number;
  sprite.userData.color = color;
  sprite.userData.texture = texture;
}

function makeNumberTexture(number, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(8, 11, 20, 0.82)";
  context.strokeStyle = color;
  context.lineWidth = 6;
  context.beginPath();
  context.arc(48, 48, 34, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#f7fbff";
  context.font = "700 44px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function updateSuccessState(match) {
  if (match >= 95) {
    if (!state.solved) {
      successToast.classList.add("is-visible");
      window.setTimeout(() => successToast.classList.remove("is-visible"), 2200);
    }
    state.solved = true;
    return;
  }

  state.solved = false;
  successToast.classList.remove("is-visible");
}

function hslToHex(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hPrime = h / 60;
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hPrime < 1) [r, g, b] = [chroma, x, 0];
  else if (hPrime < 2) [r, g, b] = [x, chroma, 0];
  else if (hPrime < 3) [r, g, b] = [0, chroma, x];
  else if (hPrime < 4) [r, g, b] = [0, x, chroma];
  else if (hPrime < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  const match = lightness - chroma / 2;
  return colorToHex({ r: r + match, g: g + match, b: b + match });
}

function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function splatMeshes() {
  return splats.map((splat) => splat.mesh);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults));
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function colorToHex(color) {
  const toByte = (value) =>
    Math.round(clamp(value, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(color.r)}${toByte(color.g)}${toByte(color.b)}`;
}

function mixStops(stops, t) {
  const scaled = clamp(t, 0, 1) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  return mixColors(hexToRgb(stops[index]), hexToRgb(stops[index + 1]), scaled - index);
}

function mixColors(a, b, t) {
  return {
    r: a.r * (1 - t) + b.r * t,
    g: a.g * (1 - t) + b.g * t,
    b: a.b * (1 - t) + b.b * t,
  };
}

function boostColor(color, amount) {
  const maxChannel = Math.max(color.r, color.g, color.b, 0.001);
  const lifted = {
    r: color.r / maxChannel,
    g: color.g / maxChannel,
    b: color.b / maxChannel,
  };
  return {
    r: clamp(color.r * (1 - amount * 0.28) + lifted.r * amount * 0.28, 0, 1),
    g: clamp(color.g * (1 - amount * 0.28) + lifted.g * amount * 0.28, 0, 1),
    b: clamp(color.b * (1 - amount * 0.28) + lifted.b * amount * 0.28, 0, 1),
  };
}

function rayDisplayColor(color, index) {
  if (index === 0) return { r: 1, g: 0.96, b: 0.62 };
  return boostColor(color, 2.25);
}

function multiplyColor(color, scalar) {
  return { r: color.r * scalar, g: color.g * scalar, b: color.b * scalar };
}

function addColors(a, b) {
  return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
}

function clampColor(color) {
  return {
    r: clamp(color.r, 0, 1),
    g: clamp(color.g, 0, 1),
    b: clamp(color.b, 0, 1),
  };
}

function colorMatch(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const normalizedError = Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
  return clamp((1 - normalizedError) * 100, 0, 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeRenderer() {
  const width = sceneEl.clientWidth;
  const height = sceneEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
