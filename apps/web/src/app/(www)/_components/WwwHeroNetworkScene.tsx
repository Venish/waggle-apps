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
  "/images/breeds/labrador-retriever.webp",
  "/images/breeds/papillon.webp",
  "/images/breeds/pug.webp",
  "/images/breeds/jack-russell-terrier.webp",
  "/images/breeds/coton-de-tulear.webp",
  "/images/breeds/jindo.webp",
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

// Clean Neo-Pop non-purple accent tones (index 0 dynamically tracks live --color-brand)
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
  ctx.shadowColor = palette.isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(15, 23, 42, 0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(cx, cx, r + 9, 0, Math.PI * 2);
  ctx.fillStyle = palette.isDark ? "#1E2128" : "#FFFFFF";
  ctx.fill();
  ctx.restore();

  if (img && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.clip();
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - minSide) / 2;
    const sy = (img.naturalHeight - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, cx - r, cx - r, r * 2, r * 2);
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
  ctx.arc(cx, cx, r + 4.5, 0, Math.PI * 2);
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = palette.brandHex;
  ctx.stroke();
}

function createCoreGlowTexture(brandHex: string): THREE.CanvasTexture {
  const size = 256;
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates crisp white geometric shape texture (tinted via SpriteMaterial.color).
 * Uses classic 5-point geometric star (never 4-point AI sparkles), triangle, and rounded square.
 */
function createShapeTexture(kind: ShapeKind): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const isSolid = kind.endsWith("solid");

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  if (kind.startsWith("star")) {
    const spikes = 5;
    const outerR = 44;
    const innerR = 20;
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
    const r = 44;
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r + 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    // Rounded square
    const side = 72;
    ctx.roundRect(cx - side / 2, cy - side / 2, side, side, 16);
  }

  if (isSolid) {
    ctx.fill();
  } else {
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSignalTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.45, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "default",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

    // 1. Subtle Soft Luminous Ambient Origin (Zero central line pinch)
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

    // 2. 3D Radial Outward Dog Breed Nodes (Continuous Infinite Loop)
    const nodeCount = isMobileViewport ? 14 : BREED_IMAGES.length;
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

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
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
        baseScale: isMobileViewport ? 0.96 + (i % 3) * 0.12 : 1.08 + (i % 4) * 0.14,
        wobblePhase: i * 1.17,
        depthArc: (i % 2 === 0 ? 1 : -1) * (0.25 + (i % 3) * 0.15),
      });
    }

    // 3. Organic Dog-to-Dog Dynamic Proximity Links (Zero central pinch!)
    const maxDogLinks = isMobileViewport ? 18 : 34;
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

    // 4. Traveling Signals Gliding Along Persistent Dog-to-Dog Links (Strictly behind dog photos)
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

    // 5. 6 Geometric Neo-Pop Shapes (Solid & Outline: 5-Point Star · Triangle · Rounded Square)
    const shapeTextureMap = new Map<ShapeKind, THREE.CanvasTexture>();
    SHAPE_KINDS.forEach((kind) => {
      const tex = createShapeTexture(kind);
      shapeTextureMap.set(kind, tex);
      textures.push(tex);
    });

    interface GeometricParticle {
      sprite: THREE.Sprite;
      material: THREE.SpriteMaterial;
      useBrandColor: boolean;
      angle: number;
      progress: number;
      speed: number;
      radiusMult: number;
      baseScale: number;
      spinSpeed: number;
      maxOpacity: number;
    }

    const shapeCount = isMobileViewport ? 22 : 40;
    const shapeParticles: GeometricParticle[] = [];

    for (let i = 0; i < shapeCount; i++) {
      const kind = SHAPE_KINDS[i % SHAPE_KINDS.length]!;
      const tex = shapeTextureMap.get(kind)!;
      // ~45% track live brand theme, remaining split cleanly across Amber / Emerald / Sky
      const useBrandColor = i % 9 < 4;
      const color = useBrandColor
        ? palette.brandThree.clone()
        : new THREE.Color(ACCENT_HEXES[i % ACCENT_HEXES.length]);

      const material = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      material.rotation = (i * 0.73) % (Math.PI * 2);
      materials.push(material);

      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 3;
      rootGroup.add(sprite);

      const isOutline = kind.endsWith("outline");
      shapeParticles.push({
        sprite,
        material,
        useBrandColor,
        // Even 360° distribution with slight organic jitter
        angle: (i / shapeCount) * Math.PI * 2 + (i % 5) * 0.13,
        progress: (i * 0.381966 + 0.17) % 1,
        speed: 0.068 + (i % 5) * 0.015,
        radiusMult: 0.88 + (i % 4) * 0.11,
        baseScale: isMobileViewport
          ? 0.22 + (i % 3) * 0.07
          : 0.25 + (i % 4) * 0.075,
        spinSpeed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 4) * 0.14),
        maxOpacity: isOutline ? 0.85 : 0.76,
      });
    }

    const activeEdges: Array<[number, number]> = [];
    const degreeCount = new Uint8Array(nodeCount);

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
        const rx = Math.cos(dog.angle) * spreadX * dog.radialBias * radialEase;
        const ry = Math.sin(dog.angle) * spreadY * dog.radialBias * radialEase;
        const wobbleX = Math.cos(elapsed * 0.55 + dog.wobblePhase) * 0.14 * p;
        const wobbleY = Math.sin(elapsed * 0.65 + dog.wobblePhase) * 0.14 * p;
        const z = originZ + p * 9.4 + Math.sin(p * Math.PI) * dog.depthArc;

        dog.sprite.position.set(originX + rx + wobbleX, originY + ry + wobbleY, z);

        const scale = dog.baseScale * (0.34 + radialEase * 0.9);
        dog.sprite.scale.set(scale, scale, 1);

        let alpha = 1;
        if (p < 0.12) alpha = p / 0.12;
        else if (p > 0.88) alpha = (1 - p) / 0.12;
        dog.material.opacity = Math.max(0, Math.min(1, alpha));
      }

      // 2. Build dynamic dog-to-dog proximity constellation (connect nearby dogs, max 2 links each)
      activeEdges.length = 0;
      degreeCount.fill(0);
      const maxDistSq = isMobileViewport ? 24 : 30;
      const minDistSq = 1.6;

      for (let i = 0; i < dogs.length && activeEdges.length < maxDogLinks; i++) {
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

        if (bestJ !== -1 && activeEdges.length < maxDogLinks) {
          activeEdges.push([i, bestJ]);
          degreeCount[i]! += 1;
          degreeCount[bestJ]! += 1;
        }
        if (
          secondJ !== -1 &&
          degreeCount[i]! < 2 &&
          degreeCount[secondJ]! < 2 &&
          activeEdges.length < maxDogLinks
        ) {
          activeEdges.push([i, secondJ]);
          degreeCount[i]! += 1;
          degreeCount[secondJ]! += 1;
        }
      }

      const linkAttr = linkGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < activeEdges.length; k++) {
        const [ia, ib] = activeEdges[k]!;
        const pa = dogs[ia]!.sprite.position;
        const pb = dogs[ib]!.sprite.position;
        const offset = k * 6;
        linkPositions[offset] = pa.x;
        linkPositions[offset + 1] = pa.y;
        linkPositions[offset + 2] = pa.z;
        linkPositions[offset + 3] = pb.x;
        linkPositions[offset + 4] = pb.y;
        linkPositions[offset + 5] = pb.z;
      }
      linkGeo.setDrawRange(0, activeEdges.length * 2);
      linkAttr.needsUpdate = true;

      // 3. Update traveling light signals bound persistently to specific dog pairs (no teleporting/mid-air vanish)
      const activeEdgeKeySet = new Set<number>();
      for (let k = 0; k < activeEdges.length; k++) {
        const [ia, ib] = activeEdges[k]!;
        activeEdgeKeySet.add(ia * 100 + ib);
      }

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
          if (activeEdges.length > 0) {
            const picked = activeEdges[(nextEdgeCursor + i) % activeEdges.length]!;
            nextEdgeCursor += 1;
            sig.fromIdx = picked[0];
            sig.toIdx = picked[1];
            sig.t = dt > 0 ? 0.04 : (i / signalTracks.length) % 1;
          } else {
            sig.fromIdx = -1;
            sig.toIdx = -1;
            continue;
          }
        } else if (dt > 0) {
          sig.t += dt * sig.speed;
          if (sig.t >= 0.96) {
            // Reached destination dog cleanly behind its avatar — pick next active link
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

      // 4. Update 360° radiating & spinning geometric shapes (star/triangle/square solid+outline)
      for (let i = 0; i < shapeParticles.length; i++) {
        const sp = shapeParticles[i]!;
        if (dt > 0) {
          sp.progress += dt * sp.speed * speedFactor;
          if (sp.progress >= 1) {
            sp.progress -= 1;
            sp.angle += 0.23;
          }
          sp.material.rotation += dt * sp.spinSpeed;
        }

        const p = sp.progress;
        const radialEase = Math.pow(p, 0.9);
        const x = originX + Math.cos(sp.angle) * spreadX * 1.08 * sp.radiusMult * radialEase;
        const y = originY + Math.sin(sp.angle) * spreadY * 1.08 * sp.radiusMult * radialEase;
        const z = originZ + p * 10.2;

        sp.sprite.position.set(x, y, z);

        const sc = sp.baseScale * (0.4 + radialEase * 0.95);
        sp.sprite.scale.set(sc, sc, 1);

        let alpha = sp.maxOpacity;
        if (p < 0.14) alpha *= p / 0.14;
        else if (p > 0.86) alpha *= (1 - p) / 0.14;
        sp.material.opacity = Math.max(0, Math.min(1, alpha));
      }
    };

    const syncTheme = () => {
      if (disposed) return;
      palette = readLivePalette();

      linkMat.color.copy(palette.brandThree);
      linkMat.opacity = palette.isDark ? 0.38 : 0.3;
      signalMat.color.copy(palette.brandThree);

      shapeParticles.forEach((sp) => {
        if (sp.useBrandColor) {
          sp.material.color.copy(palette.brandThree);
        }
      });

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

      camera.position.z = baseCameraZ - smoothedScroll * 2.4;
      camera.position.y = -smoothedScroll * 0.55;

      const targetRotY = pointerX * 0.16;
      const targetRotX = -pointerY * 0.11;
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.045;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.045;

      updateFrame(elapsed, dt, smoothedScroll);
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
