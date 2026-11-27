"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

const BREED_IMAGES = [
  "/images/breeds/poodle-toy.webp",
  "/images/breeds/bichon.webp",
  "/images/breeds/pomeranian.webp",
  "/images/breeds/welsh-corgi.webp",
  "/images/breeds/golden-retriever.webp",
  "/images/breeds/shiba.webp",
  "/images/breeds/maltese.webp",
  "/images/breeds/samoyed.webp",
  "/images/breeds/maltipoo.webp",
  "/images/breeds/cocker-spaniel.webp",
  "/images/breeds/border-collie.webp",
  "/images/breeds/french-bulldog.webp",
  "/images/breeds/beagle.webp",
  "/images/breeds/chihuahua.webp",
  "/images/breeds/dachshund.webp",
  "/images/breeds/shih-tzu.webp",
  "/images/breeds/yorkshire-terrier.webp",
  "/images/breeds/siberian-husky.webp",
] as const;

type ShapeKind =
  | "star-solid"
  | "star-outline"
  | "triangle-solid"
  | "triangle-outline"
  | "square-solid"
  | "square-outline";

const SHAPE_KINDS: readonly ShapeKind[] = [
  "star-solid",
  "star-outline",
  "triangle-solid",
  "triangle-outline",
  "square-solid",
  "square-outline",
];

// Clean Neo-Pop non-purple accent tones (brand particles dynamically track live --color-brand)
const ACCENT_HEXES = ["#F59E0B", "#10B981", "#0EA5E9"] as const;

interface ResolvedPalette {
  brandHex: string;
  brandThree: THREE.Color;
  surfaceHex: string;
  isDark: boolean;
}

function probeCssColor(varName: string, fallback: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [241, 129, 24];

  ctx.fillStyle = fallback;
  if (raw) {
    ctx.fillStyle = raw;
  }
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] ?? 241, data[1] ?? 129, data[2] ?? 24];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function readLivePalette(): ResolvedPalette {
  const isDark = document.documentElement.getAttribute("data-web-mode") === "dark";
  const brandRgb = probeCssColor("--color-brand", "#F18118");
  const surfaceRgb = probeCssColor("--color-surface", isDark ? "#23252A" : "#FFFFFF");

  return {
    brandHex: rgbToHex(brandRgb),
    brandThree: new THREE.Color().setRGB(
      brandRgb[0] / 255,
      brandRgb[1] / 255,
      brandRgb[2] / 255,
      THREE.SRGBColorSpace,
    ),
    surfaceHex: rgbToHex(surfaceRgb),
    isDark,
  };
}

function configureFastTexture(tex: THREE.CanvasTexture): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function drawAvatarCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement | null,
  palette: ResolvedPalette,
) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const r = size * 0.38;

  ctx.save();
  ctx.shadowColor = palette.isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(15, 23, 42, 0.15)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.arc(cx, cx, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = palette.isDark ? "#1E2128" : "#FFFFFF";
  ctx.fill();
  ctx.restore();

  if (img && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.clip();
    // 1.42x center-crop zoom so each dog portrait fills the circular frame boldly
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const cropSide = minSide / 1.42;
    const sx = (img.naturalWidth - cropSide) / 2;
    const sy = (img.naturalHeight - cropSide) / 2;
    ctx.drawImage(img, sx, sy, cropSide, cropSide, cx - r, cx - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = palette.surfaceHex;
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cx, r + 4, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = palette.brandHex;
  ctx.stroke();
}

function createCoreGlowTexture(brandHex: string): THREE.CanvasTexture {
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `${brandHex}88`);
  grad.addColorStop(0.35, `${brandHex}33`);
  grad.addColorStop(0.7, `${brandHex}0D`);
  grad.addColorStop(1, `${brandHex}00`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return configureFastTexture(new THREE.CanvasTexture(canvas));
}

function createShapeTexture(kind: ShapeKind): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const isSolid = kind.endsWith("solid");

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  if (kind.startsWith("star")) {
    const spikes = 5;
    const outerR = 33;
    const innerR = 15;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (kind.startsWith("triangle")) {
    const r = 33;
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r + 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    const side = 54;
    ctx.roundRect(cx - side / 2, cy - side / 2, side, side, 12);
  }

  if (isSolid) {
    ctx.fill();
  } else {
    ctx.stroke();
  }

  return configureFastTexture(new THREE.CanvasTexture(canvas));
}

function createSignalTexture(): THREE.CanvasTexture {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.45, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return configureFastTexture(new THREE.CanvasTexture(canvas));
}

export interface WwwHeroNetworkSceneProps {
  scrollProgressRef: MutableRefObject<number>;
}

export function WwwHeroNetworkScene({ scrollProgressRef }: WwwHeroNetworkSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;
    let isVisible = true;
    let isPageActive = !document.hidden;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobileViewport = window.innerWidth < 768;

    let renderer: THREE.WebGLRenderer;
    try {
      // Textures are already 2D-canvas anti-aliased; disable MSAA & cap DPR<=1.5 for silky 60fps
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
    const baseCameraZ = isMobileViewport ? 10.6 : 9.4;
    camera.position.set(0, 0, baseCameraZ);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    let palette = readLivePalette();

    let spreadX = 8.4;
    let spreadY = 5.4;
    const originX = isMobileViewport ? 0 : 0.35;
    const originY = isMobileViewport ? 0.15 : -0.05;
    const originZ = -6.2;

    // 1. Subtle Soft Luminous Ambient Origin (renderOrder = 0)
    let coreGlowTex = createCoreGlowTexture(palette.brandHex);
    textures.push(coreGlowTex);
    const coreGlowMat = new THREE.SpriteMaterial({
      map: coreGlowTex,
      transparent: true,
      opacity: palette.isDark ? 0.48 : 0.28,
      depthWrite: false,
    });
    materials.push(coreGlowMat);
    const coreGlowSprite = new THREE.Sprite(coreGlowMat);
    coreGlowSprite.position.set(originX, originY, originZ);
    coreGlowSprite.scale.set(5.4, 5.4, 1);
    coreGlowSprite.renderOrder = 0;
    rootGroup.add(coreGlowSprite);

    // 2. 3D Radial Outward Dog Breed Nodes (renderOrder = 10, strictly on top of lines/signals/shapes)
    const nodeCount = isMobileViewport ? 12 : BREED_IMAGES.length;
    const GOLDEN_ANGLE = 2.399963229728653;

    interface RadialDogNode {
      sprite: THREE.Sprite;
      material: THREE.SpriteMaterial;
      angle: number;
      radialBias: number;
      progress: number;
      speed: number;
      baseScale: number;
      wobblePhase: number;
      depthArc: number;
    }

    const dogs: RadialDogNode[] = [];
    const avatarCanvasEntries: Array<{
      canvas: HTMLCanvasElement;
      texture: THREE.CanvasTexture;
      img: HTMLImageElement | null;
    }> = [];

    for (let i = 0; i < nodeCount; i++) {
      const imgPath = BREED_IMAGES[i % BREED_IMAGES.length]!;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      drawAvatarCanvas(canvas, null, palette);

      const texture = configureFastTexture(new THREE.CanvasTexture(canvas));
      textures.push(texture);

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      materials.push(material);

      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 10;
      rootGroup.add(sprite);

      const entry = { canvas, texture, img: null as HTMLImageElement | null };
      avatarCanvasEntries.push(entry);

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        entry.img = img;
        drawAvatarCanvas(canvas, img, palette);
        texture.needsUpdate = true;
        if (reducedMotion) {
          renderer.render(scene, camera);
        }
      };
      img.src = imgPath;

      dogs.push({
        sprite,
        material,
        angle: i * GOLDEN_ANGLE + (i % 3) * 0.14,
        radialBias: 0.88 + (i % 5) * 0.085,
        progress: (i + 0.35) / nodeCount,
        speed: 0.04 + (i % 4) * 0.008,
        baseScale: isMobileViewport ? 1.15 + (i % 3) * 0.14 : 1.32 + (i % 4) * 0.18,
        wobblePhase: i * 1.17,
        depthArc: (i % 2 === 0 ? 1 : -1) * (0.25 + (i % 3) * 0.15),
      });
    }

    // 3. Organic Dog-to-Dog Dynamic Proximity Links (renderOrder = 1)
    const maxDogLinks = isMobileViewport ? 14 : 26;
    const linkPositions = new Float32Array(maxDogLinks * 2 * 3);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPositions, 3));
    linkGeo.setDrawRange(0, 0);
    geometries.push(linkGeo);

    const linkMat = new THREE.LineBasicMaterial({
      color: palette.brandThree,
      transparent: true,
      opacity: palette.isDark ? 0.38 : 0.3,
      depthWrite: false,
    });
    materials.push(linkMat);

    const dogLinkLines = new THREE.LineSegments(linkGeo, linkMat);
    dogLinkLines.renderOrder = 1;
    rootGroup.add(dogLinkLines);

    // 4. Traveling Signals Gliding Along Persistent Dog-to-Dog Links (renderOrder = 2)
    const signalCount = isMobileViewport ? 8 : 14;
    const signalPositions = new Float32Array(signalCount * 3);
    const signalTracks = Array.from({ length: signalCount }, (_, i) => ({
      fromIdx: -1,
      toIdx: -1,
      t: (i / signalCount) % 1,
      speed: 0.28 + (i % 4) * 0.055,
    }));

    const signalGeo = new THREE.BufferGeometry();
    signalGeo.setAttribute("position", new THREE.BufferAttribute(signalPositions, 3));
    signalGeo.setDrawRange(0, 0);
    geometries.push(signalGeo);

    const signalTex = createSignalTexture();
    textures.push(signalTex);

    const signalMat = new THREE.PointsMaterial({
      color: palette.brandThree,
      map: signalTex,
      size: isMobileViewport ? 0.22 : 0.26,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    materials.push(signalMat);

    const signalPoints = new THREE.Points(signalGeo, signalMat);
    signalPoints.renderOrder = 2;
    rootGroup.add(signalPoints);

    // 5. Batched InstancedMesh for 6 Geometric Neo-Pop Shapes (Only 6 draw calls total instead of 40!)
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    geometries.push(planeGeo);

    interface ShapeInstance {
      meshIndex: number;
      instanceId: number;
      useBrandColor: boolean;
      angle: number;
      progress: number;
      speed: number;
      radiusMult: number;
      baseScale: number;
      rotationZ: number;
      spinSpeed: number;
    }

    const totalShapes = isMobileViewport ? 18 : 36;
    const perKindCount = Math.ceil(totalShapes / SHAPE_KINDS.length);
    const shapeMeshes: THREE.InstancedMesh[] = [];
    const shapeInstances: ShapeInstance[] = [];

    const tmpMatrix = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpEuler = new THREE.Euler();
    const tmpScale = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    SHAPE_KINDS.forEach((kind, kindIdx) => {
      const tex = createShapeTexture(kind);
      textures.push(tex);

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: kind.endsWith("outline") ? 0.85 : 0.78,
        depthWrite: false,
      });
      materials.push(mat);

      const instMesh = new THREE.InstancedMesh(planeGeo, mat, perKindCount);
      instMesh.renderOrder = 3;
      instMesh.frustumCulled = false;
      rootGroup.add(instMesh);
      shapeMeshes.push(instMesh);

      for (let slot = 0; slot < perKindCount; slot++) {
        const globalIdx = kindIdx + slot * SHAPE_KINDS.length;
        const useBrandColor = globalIdx % 9 < 4;
        if (useBrandColor) {
          tmpColor.copy(palette.brandThree);
        } else {
          tmpColor.set(ACCENT_HEXES[globalIdx % ACCENT_HEXES.length]!);
        }
        instMesh.setColorAt(slot, tmpColor);

        shapeInstances.push({
          meshIndex: kindIdx,
          instanceId: slot,
          useBrandColor,
          angle: (globalIdx / (perKindCount * SHAPE_KINDS.length)) * Math.PI * 2 + (globalIdx % 5) * 0.13,
          progress: (globalIdx * 0.381966 + 0.17) % 1,
          speed: 0.068 + (globalIdx % 5) * 0.015,
          radiusMult: 0.88 + (globalIdx % 4) * 0.11,
          baseScale: isMobileViewport
            ? 0.22 + (globalIdx % 3) * 0.07
            : 0.26 + (globalIdx % 4) * 0.075,
          rotationZ: (globalIdx * 0.73) % (Math.PI * 2),
          spinSpeed: (globalIdx % 2 === 0 ? 1 : -1) * (0.28 + (globalIdx % 4) * 0.14),
        });
      }
      if (instMesh.instanceColor) {
        instMesh.instanceColor.needsUpdate = true;
      }
    });

    // Zero-GC pre-allocated buffers for neighbor links & active edge keys
    const edgeA = new Int16Array(maxDogLinks);
    const edgeB = new Int16Array(maxDogLinks);
    let activeEdgeCount = 0;
    const degreeCount = new Uint8Array(nodeCount);
    const activeEdgeKeySet = new Set<number>();

    const updateFrame = (elapsed: number, dt: number, scrollBoost: number) => {
      const speedFactor = 1 + scrollBoost * 2.1;

      // 1. Update outward-flying dog nodes
      for (let i = 0; i < dogs.length; i++) {
        const dog = dogs[i]!;
        if (dt > 0) {
          dog.progress += dt * dog.speed * speedFactor;
          if (dog.progress >= 1) {
            dog.progress -= 1;
            dog.angle += 0.37;
          }
        }

        const p = dog.progress;
        const radialEase = Math.pow(p, 0.88);
        const zoomCurve = Math.pow(p, 1.25);
        const rx = Math.cos(dog.angle) * spreadX * dog.radialBias * radialEase;
        const ry = Math.sin(dog.angle) * spreadY * dog.radialBias * radialEase;
        const wobbleX = Math.cos(elapsed * 0.55 + dog.wobblePhase) * 0.14 * p;
        const wobbleY = Math.sin(elapsed * 0.65 + dog.wobblePhase) * 0.14 * p;
        const z = originZ + Math.pow(p, 1.12) * 12.2 + Math.sin(p * Math.PI) * dog.depthArc;

        dog.sprite.position.set(originX + rx + wobbleX, originY + ry + wobbleY, z);

        const scale = dog.baseScale * (0.3 + zoomCurve * 1.95);
        dog.sprite.scale.set(scale, scale, 1);

        let alpha = 1;
        if (p < 0.12) alpha = p / 0.12;
        else if (p > 0.88) alpha = (1 - p) / 0.12;
        dog.material.opacity = Math.max(0, Math.min(1, alpha));
      }

      // 2. Build dynamic dog-to-dog proximity constellation (Zero heap allocation)
      activeEdgeCount = 0;
      degreeCount.fill(0);
      activeEdgeKeySet.clear();
      const maxDistSq = isMobileViewport ? 34 : 44;
      const minDistSq = 1.6;

      for (let i = 0; i < dogs.length && activeEdgeCount < maxDogLinks; i++) {
        const a = dogs[i]!;
        if (a.progress < 0.14 || a.progress > 0.88 || degreeCount[i]! >= 2) continue;

        let bestJ = -1;
        let bestDistSq = maxDistSq;
        let secondJ = -1;
        let secondDistSq = maxDistSq;

        for (let j = i + 1; j < dogs.length; j++) {
          const b = dogs[j]!;
          if (b.progress < 0.14 || b.progress > 0.88 || degreeCount[j]! >= 2) continue;
          const dSq = a.sprite.position.distanceToSquared(b.sprite.position);
          if (dSq < minDistSq || dSq >= maxDistSq) continue;

          if (dSq < bestDistSq) {
            secondDistSq = bestDistSq;
            secondJ = bestJ;
            bestDistSq = dSq;
            bestJ = j;
          } else if (dSq < secondDistSq) {
            secondDistSq = dSq;
            secondJ = j;
          }
        }

        if (bestJ !== -1 && activeEdgeCount < maxDogLinks) {
          edgeA[activeEdgeCount] = i;
          edgeB[activeEdgeCount] = bestJ;
          activeEdgeKeySet.add(i * 100 + bestJ);
          activeEdgeCount += 1;
          degreeCount[i]! += 1;
          degreeCount[bestJ]! += 1;
        }
        if (
          secondJ !== -1 &&
          degreeCount[i]! < 2 &&
          degreeCount[secondJ]! < 2 &&
          activeEdgeCount < maxDogLinks
        ) {
          edgeA[activeEdgeCount] = i;
          edgeB[activeEdgeCount] = secondJ;
          activeEdgeKeySet.add(i * 100 + secondJ);
          activeEdgeCount += 1;
          degreeCount[i]! += 1;
          degreeCount[secondJ]! += 1;
        }
      }

      const linkAttr = linkGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < activeEdgeCount; k++) {
        const pa = dogs[edgeA[k]!]!.sprite.position;
        const pb = dogs[edgeB[k]!]!.sprite.position;
        const offset = k * 6;
        linkPositions[offset] = pa.x;
        linkPositions[offset + 1] = pa.y;
        linkPositions[offset + 2] = pa.z;
        linkPositions[offset + 3] = pb.x;
        linkPositions[offset + 4] = pb.y;
        linkPositions[offset + 5] = pb.z;
      }
      linkGeo.setDrawRange(0, activeEdgeCount * 2);
      linkAttr.needsUpdate = true;

      // 3. Update persistent dog-to-dog traveling signals (Strictly behind dog avatars)
      const signalAttr = signalGeo.getAttribute("position") as THREE.BufferAttribute;
      let drawnSignals = 0;
      let nextEdgeCursor = 0;

      for (let i = 0; i < signalTracks.length; i++) {
        const sig = signalTracks[i]!;
        const hasValidDogs =
          sig.fromIdx >= 0 &&
          sig.toIdx >= 0 &&
          dogs[sig.fromIdx]!.progress >= 0.1 &&
          dogs[sig.fromIdx]!.progress <= 0.9 &&
          dogs[sig.toIdx]!.progress >= 0.1 &&
          dogs[sig.toIdx]!.progress <= 0.9;

        const pairConnected =
          hasValidDogs && activeEdgeKeySet.has(sig.fromIdx * 100 + sig.toIdx);

        if (!pairConnected || sig.t >= 1) {
          if (activeEdgeCount > 0) {
            const pickedIdx = (nextEdgeCursor + i) % activeEdgeCount;
            nextEdgeCursor += 1;
            sig.fromIdx = edgeA[pickedIdx]!;
            sig.toIdx = edgeB[pickedIdx]!;
            sig.t = dt > 0 ? 0.04 : (i / signalTracks.length) % 1;
          } else {
            sig.fromIdx = -1;
            sig.toIdx = -1;
            continue;
          }
        } else if (dt > 0) {
          sig.t += dt * sig.speed;
          if (sig.t >= 0.96) {
            sig.fromIdx = -1;
            sig.toIdx = -1;
            continue;
          }
        }

        const pa = dogs[sig.fromIdx]!.sprite.position;
        const pb = dogs[sig.toIdx]!.sprite.position;
        const idx = drawnSignals * 3;
        signalPositions[idx] = pa.x + (pb.x - pa.x) * sig.t;
        signalPositions[idx + 1] = pa.y + (pb.y - pa.y) * sig.t;
        signalPositions[idx + 2] = pa.z + (pb.z - pa.z) * sig.t - 0.12;
        drawnSignals += 1;
      }
      signalGeo.setDrawRange(0, drawnSignals);
      signalAttr.needsUpdate = true;

      // 4. Update 6 batched InstancedMeshes for geometric shapes (6 draw calls total)
      for (let i = 0; i < shapeInstances.length; i++) {
        const sp = shapeInstances[i]!;
        if (dt > 0) {
          sp.progress += dt * sp.speed * speedFactor;
          if (sp.progress >= 1) {
            sp.progress -= 1;
            sp.angle += 0.23;
          }
          sp.rotationZ += dt * sp.spinSpeed;
        }

        const p = sp.progress;
        const radialEase = Math.pow(p, 0.9);
        const x = originX + Math.cos(sp.angle) * spreadX * 1.08 * sp.radiusMult * radialEase;
        const y = originY + Math.sin(sp.angle) * spreadY * 1.08 * sp.radiusMult * radialEase;
        const z = originZ + p * 10.2;

        // Smooth scale-in at center and scale-out at outer edge (avoids per-instance alpha shader cost)
        let edgeFactor = 1;
        if (p < 0.12) edgeFactor = p / 0.12;
        else if (p > 0.88) edgeFactor = (1 - p) / 0.12;
        const sc = Math.max(0.001, sp.baseScale * (0.42 + radialEase * 0.98) * edgeFactor);

        tmpPos.set(x, y, z);
        tmpEuler.set(0, 0, sp.rotationZ);
        tmpQuat.setFromEuler(tmpEuler);
        tmpScale.set(sc, sc, 1);
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);

        shapeMeshes[sp.meshIndex]!.setMatrixAt(sp.instanceId, tmpMatrix);
      }

      for (let m = 0; m < shapeMeshes.length; m++) {
        shapeMeshes[m]!.instanceMatrix.needsUpdate = true;
      }
    };

    const syncTheme = () => {
      if (disposed) return;
      palette = readLivePalette();

      linkMat.color.copy(palette.brandThree);
      linkMat.opacity = palette.isDark ? 0.38 : 0.3;
      signalMat.color.copy(palette.brandThree);

      for (let i = 0; i < shapeInstances.length; i++) {
        const sp = shapeInstances[i]!;
        if (sp.useBrandColor) {
          shapeMeshes[sp.meshIndex]!.setColorAt(sp.instanceId, palette.brandThree);
        }
      }
      for (let m = 0; m < shapeMeshes.length; m++) {
        const col = shapeMeshes[m]!.instanceColor;
        if (col) col.needsUpdate = true;
      }

      const nextGlowTex = createCoreGlowTexture(palette.brandHex);
      coreGlowMat.map = nextGlowTex;
      coreGlowMat.opacity = palette.isDark ? 0.48 : 0.28;
      coreGlowMat.needsUpdate = true;
      coreGlowTex.dispose();
      coreGlowTex = nextGlowTex;
      textures.push(nextGlowTex);

      avatarCanvasEntries.forEach(({ canvas, texture, img }) => {
        drawAvatarCanvas(canvas, img, palette);
        texture.needsUpdate = true;
      });

      if (reducedMotion) {
        renderer.render(scene, camera);
      }
    };

    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-web-theme", "data-web-mode"],
    });

    let pointerX = 0;
    let pointerY = 0;
    let smoothedScroll = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      if (disposed) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);

      const vFovRad = (camera.fov * Math.PI) / 180;
      const visibleHeight = 2 * Math.tan(vFovRad / 2) * baseCameraZ;
      const visibleWidth = visibleHeight * camera.aspect;
      spreadX = visibleWidth * 0.64;
      spreadY = visibleHeight * 0.66;

      if (reducedMotion) {
        updateFrame(0, 0, 0);
        renderer.render(scene, camera);
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
      rafId = 0;
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    let lastTime = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      if (disposed || !isVisible || !isPageActive) {
        rafId = 0;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      const targetScroll = scrollProgressRef.current || 0;
      smoothedScroll += (targetScroll - smoothedScroll) * 0.08;

      // 1.35s cinematic opening bloom + camera swoop on initial page load
      const introRaw = Math.min(1, elapsed / 1.35);
      const introEase = 1 - Math.pow(1 - introRaw, 3);
      const introSurge = (1 - introEase) * 2.2;

      camera.position.z = baseCameraZ + (1 - introEase) * 4.4 - smoothedScroll * 2.4;
      camera.position.y = -smoothedScroll * 0.55;

      const bloomScale = 0.56 + introEase * 0.44;
      rootGroup.scale.setScalar(bloomScale);
      rootGroup.rotation.z = (1 - introEase) * -0.16;

      const targetRotY = pointerX * 0.16;
      const targetRotX = -pointerY * 0.11;
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.045;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.045;

      updateFrame(elapsed, dt, smoothedScroll + introSurge * 0.45);
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    const resumeLoop = () => {
      if (!disposed && isVisible && isPageActive && !reducedMotion && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = Boolean(entry?.isIntersecting);
        if (isVisible) resumeLoop();
      },
      { threshold: 0.02 },
    );
    io.observe(container);

    const onVisibility = () => {
      isPageActive = !document.hidden;
      if (isPageActive) resumeLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    updateFrame(0, 0, 0);
    renderer.render(scene, camera);
    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      const uniqueTextures = new Set(textures);
      uniqueTextures.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scrollProgressRef]);

  return <div ref={containerRef} className="size-full" aria-hidden="true" />;
}
