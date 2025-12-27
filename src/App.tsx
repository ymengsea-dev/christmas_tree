import {
  useState,
  useMemo,
  useRef,
  useEffect,
  Suspense,
  useCallback,
} from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  shaderMaterial,
  Float,
  Stars,
  Sparkles,
  useTexture,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { MathUtils } from "three";
import * as random from "maath/random";
import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import snowflakeImage from "./assets/snowflake.png";

// --- Dynamically generate photo list (top.jpg + 1.jpg to 8.jpg) ---
const TOTAL_NUMBERED_PHOTOS = 8;
// Note: top.jpg is added to the beginning of the array
const bodyPhotoPaths = [
  "/photos/top.jpg",
  ...Array.from(
    { length: TOTAL_NUMBERED_PHOTOS },
    (_, i) => `/photos/${i + 1}.jpg`
  ),
];

// --- Visual Configuration ---
const CONFIG = {
  colors: {
    emerald: "#004225", // Pure emerald green
    gold: "#FFD700",
    silver: "#ECEFF1",
    red: "#D32F2F",
    green: "#2E7D32",
    white: "#FFFFFF", // Pure white
    warmLight: "#FFD54F",
    lights: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"], // Fairy lights
    // Polaroid border color palette (vintage soft color scheme)
    borders: [
      "#FFFAF0",
      "#F0E68C",
      "#E6E6FA",
      "#FFB6C1",
      "#98FB98",
      "#87CEFA",
      "#FFDAB9",
    ],
    // Christmas element colors
    giftColors: ["#D32F2F", "#FFD700", "#1976D2", "#2E7D32"],
    candyColors: ["#FF0000", "#FFFFFF"],
  },
  counts: {
    foliage: 15000,
    ornaments: 72, // Number of polaroid photos (8 photos * 9 for more coverage)
    elements: 200, // Number of Christmas elements
    lights: 400, // Number of fairy lights
    models: 60, // Number of 3D model ornaments
  },
  tree: { height: 22, radius: 9 }, // Tree dimensions
  photos: {
    // top property no longer needed, as it has been moved into body
    body: bodyPhotoPaths,
  },
};

// --- Shader Material (Foliage) ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.emerald), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`
);
extend({ FoliageMaterial });

// --- Helper: Tree Shape ---
const getTreePosition = () => {
  const h = CONFIG.tree.height;
  const rBase = CONFIG.tree.radius;
  const y = Math.random() * h - h / 2;
  const normalizedY = (y + h / 2) / h;
  const currentRadius = rBase * (1 - normalizedY);
  const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// --- Component: Foliage ---
const Foliage = ({ state }: { state: "CHAOS" | "FORMED" }) => {
  const materialRef = useRef<any>(null);
  const { positions, targetPositions, randoms } = useMemo(() => {
    const count = CONFIG.counts.foliage;
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), {
      radius: 25,
    }) as Float32Array;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = spherePoints[i * 3];
      positions[i * 3 + 1] = spherePoints[i * 3 + 1];
      positions[i * 3 + 2] = spherePoints[i * 3 + 2];
      const [tx, ty, tz] = getTreePosition();
      targetPositions[i * 3] = tx;
      targetPositions[i * 3 + 1] = ty;
      targetPositions[i * 3 + 2] = tz;
      randoms[i] = Math.random();
    }
    return { positions, targetPositions, randoms };
  }, []);
  useFrame((rootState, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = rootState.clock.elapsedTime;
      const targetProgress = state === "FORMED" ? 1 : 0;
      materialRef.current.uProgress = MathUtils.damp(
        materialRef.current.uProgress,
        targetProgress,
        1.5,
        delta
      );
    }
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute
          attach="attributes-aTargetPos"
          args={[targetPositions, 3]}
        />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// --- Component: Photo Ornaments (Double-Sided Polaroid) ---
const PhotoOrnaments = ({
  state,
  selectedPhotoIndex,
}: {
  state: "CHAOS" | "FORMED";
  selectedPhotoIndex: number | null;
}) => {
  const textures = useTexture(CONFIG.photos.body);
  const count = CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.05, 1.05), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 1.0 : 0.5 + Math.random() * 0.5;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor =
        CONFIG.colors.borders[
          Math.floor(Math.random() * CONFIG.colors.borders.length)
        ];

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 1.0,
        y: (Math.random() - 0.5) * 1.0,
        z: (Math.random() - 0.5) * 1.0,
      };
      const chaosRotation = new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      return {
        chaosPos,
        targetPos,
        scale: baseScale,
        weight,
        textureIndex: i % textures.length,
        borderColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        isSelected: false,
        centerTarget: new THREE.Vector3(0, 0, 0), // Center of screen
        selectionProgress: 0, // 0 to 1 for smooth animation
        originalRotation: chaosRotation.clone(),
        originalPosition: chaosPos.clone(), // Store original position for return
      };
    });
  }, [textures, count]);

  // Update selected photo with smooth transition
  useEffect(() => {
    data.forEach((d, i) => {
      if (i === selectedPhotoIndex && selectedPhotoIndex !== null) {
        if (!d.isSelected) {
          // Store original position when first selected
          d.originalPosition.copy(d.currentPos);
        }
        d.isSelected = true;
      } else {
        if (d.isSelected) {
          d.isSelected = false;
        }
      }
    });
  }, [selectedPhotoIndex, data]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === "FORMED";
    const time = stateObj.clock.elapsedTime;

    // Store camera reference for raycasting
    if (!cameraRef.current) {
      cameraRef.current = stateObj.camera;
    }

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];

      // Update selection progress for smooth animation
      if (objData.isSelected && state === "CHAOS") {
        // Smoothly animate to center when selected (popup effect)
        objData.selectionProgress = Math.min(
          1,
          objData.selectionProgress + delta * 6 // Faster popup
        );
      } else if (objData.selectionProgress > 0) {
        // Smoothly return when deselected
        objData.selectionProgress = Math.max(
          0,
          objData.selectionProgress - delta * 4
        );
      }

      // Calculate popup position - top of screen, 300px from top
      const getViewportCenter = () => {
        if (!cameraRef.current) return new THREE.Vector3(0, 15, 25);

        const camera = cameraRef.current as THREE.PerspectiveCamera;

        // Convert 300px from top to normalized device coordinates
        // NDC: Y = -1 (bottom), 0 (center), +1 (top)
        // For 300px from top: use higher Y value (closer to +1)
        // Assuming typical screen height ~1080px: 300px from top ≈ Y = 0.5-0.6 in NDC
        const screenY = 0.55; // Roughly 300px from top in NDC coordinates

        // Create a raycaster from screen position (0, screenY in NDC)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, screenY), camera);

        // Get a point along the ray at fixed distance from camera
        const distance = 25;
        const centerPos = raycaster.ray.origin
          .clone()
          .add(raycaster.ray.direction.clone().multiplyScalar(distance));

        return centerPos;
      };

      // Determine target position with smooth card-like pop animation
      let target: THREE.Vector3;
      let targetScale = objData.scale;
      let targetRotation = objData.chaosRotation;

      if (objData.selectionProgress > 0 && state === "CHAOS") {
        // Smooth popup modal animation
        const progress = objData.selectionProgress;

        // Easing function for smooth pop (ease-out back for bounce effect)
        const easeOutBack = (t: number) => {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        };
        const easedProgress = easeOutBack(progress);

        // Get viewport center position (screen center in world space)
        const centerPos = getViewportCenter();

        // Only add forward pop during animation, not when fully popped
        if (progress < 0.95) {
          const forwardPop = Math.sin(progress * Math.PI) * 2;
          const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
            cameraRef.current!.quaternion
          );
          centerPos.add(forwardDir.multiplyScalar(forwardPop));
        }

        // Lerp from original position to center
        target = objData.originalPosition
          .clone()
          .lerp(centerPos, easedProgress);

        // Fixed scale for all popups (consistent size, not relative to original)
        // Use a fixed world scale that looks good for popup
        const FIXED_POPUP_SCALE = 8; // Fixed size for all popups
        targetScale = THREE.MathUtils.lerp(
          objData.scale,
          FIXED_POPUP_SCALE,
          easedProgress
        );

        // Always flat (2D) - no rotation, will use lookAt to face camera
        targetRotation = new THREE.Euler(0, 0, 0);
      } else {
        // Normal behavior - return to chaos or formed position
        target = isFormed ? objData.targetPos : objData.chaosPos;
        targetScale = objData.scale;
        targetRotation = objData.chaosRotation;
      }

      // Smooth animation to target - faster when transitioning, stable when fully popped
      const lerpSpeed = isFormed
        ? 0.8 * objData.weight
        : objData.selectionProgress > 0 && objData.selectionProgress < 0.99
        ? 12.0 // Fast during transition
        : objData.selectionProgress >= 0.99
        ? 0 // Stay still when fully popped - directly set position
        : 0.5;

      if (lerpSpeed > 0) {
        objData.currentPos.lerp(target, delta * lerpSpeed);
      } else if (objData.selectionProgress >= 0.99) {
        // When fully popped, keep it at exact center position (recalculate each frame to stay centered)
        objData.currentPos.copy(target);
      }
      group.position.copy(objData.currentPos);

      // Smooth scale animation with easing
      group.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 8
      );

      // Handle rotation based on state and selection
      if (objData.selectionProgress > 0 && state === "CHAOS") {
        // For popup: always flat 2D, face camera directly
        if (objData.selectionProgress >= 0.99) {
          // When fully popped, use lookAt to always face camera
          if (cameraRef.current) {
            group.lookAt(cameraRef.current.position);
          }
        } else {
          // During transition, lerp to flat rotation
          group.rotation.x = THREE.MathUtils.lerp(
            group.rotation.x,
            targetRotation.x,
            delta * 8
          );
          group.rotation.y = THREE.MathUtils.lerp(
            group.rotation.y,
            targetRotation.y,
            delta * 8
          );
          group.rotation.z = THREE.MathUtils.lerp(
            group.rotation.z,
            targetRotation.z,
            delta * 8
          );
        }
      } else if (isFormed) {
        const targetLookPos = new THREE.Vector3(
          group.position.x * 2,
          group.position.y + 0.5,
          group.position.z * 2
        );
        group.lookAt(targetLookPos);

        // Wobble effect for formed tree
        const wobbleX =
          Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
        const wobbleZ =
          Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) *
          0.05;
        group.rotation.x += wobbleX;
        group.rotation.z += wobbleZ;
      } else {
        // Continuous rotation in CHAOS state (if not selected)
        group.rotation.x += delta * objData.rotationSpeed.x;
        group.rotation.y += delta * objData.rotationSpeed.y;
        group.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        const isSelected = obj.isSelected && state === "CHAOS";
        return (
          <group
            key={i}
            scale={[obj.scale, obj.scale, obj.scale]}
            rotation={state === "CHAOS" ? obj.chaosRotation : [0, 0, 0]}
          >
            {/* Front side */}
            <group position={[0, 0, 0.015]}>
              <mesh
                geometry={photoGeometry}
                castShadow={isSelected}
                receiveShadow={isSelected}
              >
                <meshStandardMaterial
                  map={textures[obj.textureIndex]}
                  roughness={isSelected ? 0.3 : 0.5}
                  metalness={isSelected ? 0.1 : 0}
                  emissive={CONFIG.colors.white}
                  emissiveMap={textures[obj.textureIndex]}
                  emissiveIntensity={isSelected ? 0.3 : 0.1}
                  side={THREE.FrontSide}
                />
              </mesh>
              <mesh geometry={borderGeometry} position={[0, 0, -0.01]}>
                <meshStandardMaterial
                  color={obj.borderColor}
                  roughness={0.9}
                  metalness={0}
                  side={THREE.FrontSide}
                />
              </mesh>
            </group>
            {/* Back side */}
            <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
              <mesh geometry={photoGeometry}>
                <meshStandardMaterial
                  map={textures[obj.textureIndex]}
                  roughness={0.5}
                  metalness={0}
                  emissive={CONFIG.colors.white}
                  emissiveMap={textures[obj.textureIndex]}
                  emissiveIntensity={0.1}
                  side={THREE.FrontSide}
                />
              </mesh>
              <mesh geometry={borderGeometry} position={[0, 0, -0.01]}>
                <meshStandardMaterial
                  color={obj.borderColor}
                  roughness={0.9}
                  metalness={0}
                  side={THREE.FrontSide}
                />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

// --- Component: Christmas Elements ---
const ChristmasElements = ({ state }: { state: "CHAOS" | "FORMED" }) => {
  const count = CONFIG.counts.elements;
  const groupRef = useRef<THREE.Group>(null);

  // Christmas decoration geometries
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(
    () => new THREE.SphereGeometry(0.5, 16, 16),
    []
  );
  const caneGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8),
    []
  );
  // Star geometry for decorations
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 0.4;
    const innerRadius = 0.2;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) {
        shape.moveTo(radius * Math.cos(angle), radius * Math.sin(angle));
      } else {
        shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
      }
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: false,
    });
  }, []);
  // Bell geometry (cone + sphere)
  const bellConeGeometry = useMemo(
    () => new THREE.ConeGeometry(0.3, 0.6, 8),
    []
  );
  const bellSphereGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    geo.translate(0, -0.35, 0);
    return geo;
  }, []);
  // Wreath geometry (torus with decorations)
  const wreathTorusGeometry = useMemo(
    () => new THREE.TorusGeometry(0.6, 0.15, 8, 16),
    []
  );
  const wreathBerryGeometry = useMemo(
    () => new THREE.SphereGeometry(0.08, 8, 8),
    []
  );
  // Gift box with ribbon
  const giftRibbonVerticalGeometry = useMemo(
    () => new THREE.BoxGeometry(0.08, 0.85, 0.08),
    []
  );
  const giftRibbonHorizontalGeometry = useMemo(
    () => new THREE.BoxGeometry(0.85, 0.08, 0.08),
    []
  );
  // Bow loop geometry (larger loops)
  const giftBowLoopGeometry = useMemo(
    () => new THREE.TorusGeometry(0.2, 0.06, 12, 24),
    []
  );
  // Bow center knot
  const giftBowKnotGeometry = useMemo(
    () => new THREE.SphereGeometry(0.12, 12, 12),
    []
  );
  // Bow tails (streamers)
  const giftBowTailGeometry = useMemo(
    () => new THREE.BoxGeometry(0.06, 0.4, 0.06),
    []
  );

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) * 0.95;
      const theta = Math.random() * Math.PI * 2;

      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      // More decoration types: 0=box, 1=sphere, 2=cane, 3=star, 4=bell, 5=wreath (removed gift type 5)
      const type = Math.floor(Math.random() * 6);
      let color;
      let scale = 1;
      if (type === 0) {
        // Simple box
        color =
          CONFIG.colors.giftColors[
            Math.floor(Math.random() * CONFIG.colors.giftColors.length)
          ];
        scale = 0.8 + Math.random() * 0.4;
      } else if (type === 1) {
        // Ornament ball
        color =
          CONFIG.colors.giftColors[
            Math.floor(Math.random() * CONFIG.colors.giftColors.length)
          ];
        scale = 0.6 + Math.random() * 0.4;
      } else if (type === 2) {
        // Candy cane
        color = Math.random() > 0.5 ? CONFIG.colors.red : CONFIG.colors.white;
        scale = 0.7 + Math.random() * 0.3;
      } else if (type === 3) {
        // Star
        color = CONFIG.colors.gold;
        scale = 0.5 + Math.random() * 0.3;
      } else if (type === 4) {
        // Bell
        color = CONFIG.colors.gold;
        scale = 0.6 + Math.random() * 0.3;
      } else {
        // Wreath (type 5, was type 6)
        color = CONFIG.colors.green;
        scale = 0.7 + Math.random() * 0.4;
      }

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 2.0,
        y: (Math.random() - 0.5) * 2.0,
        z: (Math.random() - 0.5) * 2.0,
      };
      return {
        type,
        chaosPos,
        targetPos,
        color,
        scale,
        currentPos: chaosPos.clone(),
        chaosRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        rotationSpeed,
      };
    });
  }, [
    boxGeometry,
    sphereGeometry,
    caneGeometry,
    starGeometry,
    bellConeGeometry,
    bellSphereGeometry,
    wreathTorusGeometry,
    wreathBerryGeometry,
    giftRibbonVerticalGeometry,
    giftRibbonHorizontalGeometry,
    giftBowLoopGeometry,
    giftBowKnotGeometry,
    giftBowTailGeometry,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === "FORMED";
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.5);
      // Handle both groups and meshes
      if (child instanceof THREE.Group) {
        child.position.copy(objData.currentPos);
        child.rotation.x += delta * objData.rotationSpeed.x;
        child.rotation.y += delta * objData.rotationSpeed.y;
        child.rotation.z += delta * objData.rotationSpeed.z;
      } else {
        const mesh = child as THREE.Mesh;
        mesh.position.copy(objData.currentPos);
        mesh.rotation.x += delta * objData.rotationSpeed.x;
        mesh.rotation.y += delta * objData.rotationSpeed.y;
        mesh.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        if (obj.type === 3) {
          // Star decoration
          return (
            <mesh
              key={i}
              scale={[obj.scale, obj.scale, obj.scale]}
              geometry={starGeometry}
              rotation={obj.chaosRotation}
            >
              <meshStandardMaterial
                color={obj.color}
                roughness={0.2}
                metalness={0.8}
                emissive={obj.color}
                emissiveIntensity={0.5}
              />
            </mesh>
          );
        } else if (obj.type === 4) {
          // Bell decoration
          return (
            <group
              key={i}
              scale={[obj.scale, obj.scale, obj.scale]}
              rotation={obj.chaosRotation}
            >
              <mesh geometry={bellConeGeometry}>
                <meshStandardMaterial
                  color={obj.color}
                  roughness={0.3}
                  metalness={0.7}
                  emissive={obj.color}
                  emissiveIntensity={0.3}
                />
              </mesh>
              <mesh geometry={bellSphereGeometry}>
                <meshStandardMaterial
                  color={CONFIG.colors.red}
                  roughness={0.5}
                  metalness={0.5}
                />
              </mesh>
            </group>
          );
        } else if (obj.type === 5) {
          // Wreath decoration
          const berryCount = 6;
          return (
            <group
              key={i}
              scale={[obj.scale, obj.scale, obj.scale]}
              rotation={obj.chaosRotation}
            >
              {/* Wreath base (torus) */}
              <mesh geometry={wreathTorusGeometry}>
                <meshStandardMaterial
                  color={obj.color}
                  roughness={0.7}
                  metalness={0.1}
                />
              </mesh>
              {/* Berries around the wreath */}
              {Array.from({ length: berryCount }).map((_, berryIdx) => {
                const angle = (berryIdx / berryCount) * Math.PI * 2;
                const radius = 0.6;
                return (
                  <mesh
                    key={berryIdx}
                    geometry={wreathBerryGeometry}
                    position={[
                      Math.cos(angle) * radius,
                      Math.sin(angle) * radius,
                      0,
                    ]}
                  >
                    <meshStandardMaterial
                      color={CONFIG.colors.red}
                      roughness={0.3}
                      metalness={0.2}
                      emissive={CONFIG.colors.red}
                      emissiveIntensity={0.5}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        } else {
          // Box, sphere, or cane
          let geometry;
          if (obj.type === 0) geometry = boxGeometry;
          else if (obj.type === 1) geometry = sphereGeometry;
          else geometry = caneGeometry;
          return (
            <mesh
              key={i}
              scale={[obj.scale, obj.scale, obj.scale]}
              geometry={geometry}
              rotation={obj.chaosRotation}
            >
              <meshStandardMaterial
                color={obj.color}
                roughness={0.3}
                metalness={0.4}
                emissive={obj.color}
                emissiveIntensity={0.2}
              />
            </mesh>
          );
        }
      })}
    </group>
  );
};

// --- Component: 3D Model Ornaments ---
const ModelOrnaments = ({ state }: { state: "CHAOS" | "FORMED" }) => {
  const count = CONFIG.counts.models;
  const groupRef = useRef<THREE.Group>(null);

  // Load all models separately (hooks must be called unconditionally)
  const candyCane = useGLTF("/3dmodel/candycane.glb");
  const christmasBall1 = useGLTF("/3dmodel/christmasball1.glb");
  const christmasBall2 = useGLTF("/3dmodel/christmasball2.glb");
  const christmasSock = useGLTF("/3dmodel/christmassock.glb");
  const giftbox1 = useGLTF("/3dmodel/giftbox1.glb");
  const giftbox2 = useGLTF("/3dmodel/giftbox2.glb");
  const giftbox3 = useGLTF("/3dmodel/giftbox3.glb");
  const giftbox4 = useGLTF("/3dmodel/giftbox4.glb");
  const christmasBall3 = useGLTF("/3dmodel/christmasball3.glb");
  const christmasBall4 = useGLTF("/3dmodel/christmasball4.glb");
  const christmasCard = useGLTF("/3dmodel/christmascard.glb");
  const christmasWreath = useGLTF("/3dmodel/christmaswreath.glb");

  // Array of all loaded models
  const models = useMemo(
    () => [
      candyCane,
      christmasBall1,
      christmasBall2,
      christmasSock,
      giftbox1,
      giftbox2,
      giftbox3,
      giftbox4,
      christmasBall3,
      christmasBall4,
      christmasCard,
      christmasWreath,
    ],
    [
      candyCane,
      christmasBall1,
      christmasBall2,
      christmasSock,
      giftbox1,
      giftbox2,
      giftbox3,
      giftbox4,
      christmasBall3,
      christmasBall4,
      christmasCard,
      christmasWreath,
    ]
  );

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) * 0.9;
      const theta = Math.random() * Math.PI * 2;

      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      // Cycle through all models (like photos do) - each appears 7-8 times
      const modelIndex = i % models.length;
      // Individual scale for each model type to ensure all are visible
      // Index: 0=candyCane, 1=christmasBall1, 2=christmasBall2, 3=christmasSock,
      //        4=giftbox1, 5=giftbox2, 6=giftbox3, 7=giftbox4,
      //        8=christmasBall3, 9=christmasBall4, 10=christmasCard, 11=christmasWreath
      const scaleMap = [
        2.5, // candyCane - larger scale
        0.3, // christmasBall1 - larger scale
        0.7, // christmasBall2 - larger scale
        1.9, // christmasSock - larger scale
        0.008, // giftbox1 - much smaller (50x bigger in file)
        0.05, // giftbox2 - larger scale
        0.7, // giftbox3 - larger scale
        0.8, // giftbox4 - larger scale
        0.8, // christmasBall3
        0.8, // christmasBall4
        0.9, // christmasCard
        1.3, // christmasWreath
      ];
      const baseScale = scaleMap[modelIndex];
      const scale = baseScale + Math.random() * (baseScale * 0.1); // 10% variation
      // Random rotation speed
      const rotationSpeed = {
        x: (Math.random() - 0.5) * 1.5,
        y: (Math.random() - 0.5) * 1.5,
        z: (Math.random() - 0.5) * 1.5,
      };

      return {
        modelIndex,
        chaosPos,
        targetPos,
        scale,
        currentPos: chaosPos.clone(),
        chaosRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        rotationSpeed,
      };
    });
  }, [models.length, count]);

  // Create cloned models for each instance
  const clonedModels = useMemo(() => {
    if (!models || models.length === 0 || !data || data.length === 0) return [];
    return data.map((obj) => {
      if (models[obj.modelIndex] && models[obj.modelIndex].scene) {
        return models[obj.modelIndex].scene.clone();
      }
      return null;
    });
  }, [data, models]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === "FORMED";
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.5);

      if (child instanceof THREE.Group) {
        child.position.copy(objData.currentPos);
        child.rotation.x += delta * objData.rotationSpeed.x;
        child.rotation.y += delta * objData.rotationSpeed.y;
        child.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        if (!clonedModels[i]) return null;
        return (
          <group key={i}>
            <primitive
              object={clonedModels[i]}
              scale={[obj.scale, obj.scale, obj.scale]}
            />
          </group>
        );
      })}
    </group>
  );
};

// --- Component: Fairy Lights ---
const FairyLights = ({ state }: { state: "CHAOS" | "FORMED" }) => {
  const count = CONFIG.counts.lights;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) + 0.3;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );
      const color =
        CONFIG.colors.lights[
          Math.floor(Math.random() * CONFIG.colors.lights.length)
        ];
      const speed = 2 + Math.random() * 3;
      return {
        chaosPos,
        targetPos,
        color,
        speed,
        currentPos: chaosPos.clone(),
        timeOffset: Math.random() * 100,
      };
    });
  }, []);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === "FORMED";
    const time = stateObj.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 2.0);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);
      const intensity =
        (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          isFormed ? 3 + intensity * 4 : 0;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <mesh key={i} scale={[0.15, 0.15, 0.15]} geometry={geometry}>
          <meshStandardMaterial
            color={obj.color}
            emissive={obj.color}
            emissiveIntensity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// --- Component: Snow Effect ---
const Snow = () => {
  const count = 800;
  const groupRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [snowOpacity, setSnowOpacity] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Load snowflake texture
  const snowflakeTexture = useTexture(snowflakeImage);

  // Create plane geometry for sprite
  const planeGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Configure texture
  useEffect(() => {
    if (snowflakeTexture) {
      snowflakeTexture.flipY = false;
      snowflakeTexture.needsUpdate = true;
    }
  }, [snowflakeTexture]);

  // Delay snow appearance
  useEffect(() => {
    const timer = setTimeout(() => {
      startTimeRef.current = Date.now();
    }, 2000); // 2 second delay before snow starts

    return () => clearTimeout(timer);
  }, []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      return {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 200,
          Math.random() * 100 + 50,
          (Math.random() - 0.5) * 200
        ),
        velocity: Math.random() * 0.5 + 0.3,
        rotationSpeed: {
          z: (Math.random() - 0.5) * 3, // Rotate around Z axis
        },
        rotation: Math.random() * Math.PI * 2,
        size: Math.random() * 0.8 + 0.4, // Varied sizes
      };
    });
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!cameraRef.current) {
      cameraRef.current = state.camera;
    }

    // Gradually fade in snow after delay
    if (startTimeRef.current !== null) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds
      const fadeDuration = 2; // 2 seconds to fade in
      const newOpacity = Math.min(0.9, (elapsed / fadeDuration) * 0.9);
      if (newOpacity !== snowOpacity) {
        setSnowOpacity(newOpacity);
      }
    }

    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const mesh = child as THREE.Mesh;

      // Only animate if snow has started
      if (startTimeRef.current !== null) {
        // Move snowflake down
        objData.position.y -= objData.velocity * delta * 10;

        // Add slight horizontal drift (swaying motion)
        objData.position.x += Math.sin(objData.position.y * 0.01) * delta * 2;
        objData.position.z += Math.cos(objData.position.y * 0.01) * delta * 2;

        // Rotate snowflake around Z axis
        objData.rotation += objData.rotationSpeed.z * delta;

        // Update mesh position
        mesh.position.copy(objData.position);

        // Make snowflake always face camera (billboard effect)
        if (cameraRef.current) {
          mesh.lookAt(cameraRef.current.position);
          // Rotate around its own Z axis for spinning effect
          mesh.rotateZ(objData.rotation);
        }

        // Reset if below ground
        if (objData.position.y < -50) {
          objData.position.set(
            (Math.random() - 0.5) * 200,
            100,
            (Math.random() - 0.5) * 200
          );
        }
      }

      // Update material opacity
      if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).opacity = snowOpacity;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <mesh
          key={i}
          geometry={planeGeometry}
          scale={[obj.size, obj.size, obj.size]}
          position={obj.position}
        >
          <meshStandardMaterial
            map={snowflakeTexture}
            transparent
            opacity={snowOpacity}
            side={THREE.DoubleSide}
            emissive="#ffffff"
            emissiveIntensity={0.3}
            alphaTest={0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

// --- Component: Top Star (No Photo, Pure Gold 3D Star) ---
const TopStar = ({ state }: { state: "CHAOS" | "FORMED" }) => {
  const groupRef = useRef<THREE.Group>(null);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.3;
    const innerRadius = 0.7;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      i === 0
        ? shape.moveTo(radius * Math.cos(angle), radius * Math.sin(angle))
        : shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    shape.closePath();
    return shape;
  }, []);

  const starGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(starShape, {
      depth: 0.4, // Add some thickness
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 3,
    });
  }, [starShape]);

  // Pure gold material
  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CONFIG.colors.gold,
        emissive: CONFIG.colors.gold,
        emissiveIntensity: 1.5, // Moderate brightness, both glowing and textured
        roughness: 0.1,
        metalness: 1.0,
      }),
    []
  );

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === "FORMED" ? 1 : 0;
      groupRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 3
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={starGeometry} material={goldMaterial} />
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = ({
  sceneState,
  rotationSpeed,
  selectedPhotoIndex,
}: {
  sceneState: "CHAOS" | "FORMED";
  rotationSpeed: number;
  selectedPhotoIndex: number | null;
}) => {
  const controlsRef = useRef<any>(null);
  const photoGroupRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useFrame((state) => {
    if (controlsRef.current) {
      controlsRef.current.setAzimuthalAngle(
        controlsRef.current.getAzimuthalAngle() + rotationSpeed
      );
      controlsRef.current.update();
    }
    if (!cameraRef.current) {
      cameraRef.current = state.camera;
    }
  });

  // Expose findClosestPhoto function with improved raycasting
  const findClosestPhoto = useCallback(
    (screenX: number, screenY: number) => {
      if (!cameraRef.current || !photoGroupRef.current) return null;

      // Convert screen coordinates (0-1) to normalized device coordinates (-1 to 1)
      const x = screenX * 2 - 1;
      const y = -(screenY * 2) + 1; // Flip Y axis

      // Create ray from camera through screen point
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      // Collect all photo meshes with their parent group indices
      const photoMeshes: Array<{ mesh: THREE.Mesh; groupIndex: number }> = [];

      photoGroupRef.current.children.forEach((group, groupIndex) => {
        if (group instanceof THREE.Group) {
          group.traverse((child) => {
            if (
              child instanceof THREE.Mesh &&
              child.geometry.type === "PlaneGeometry"
            ) {
              photoMeshes.push({ mesh: child, groupIndex });
            }
          });
        }
      });

      // Try to intersect with photo meshes first
      if (photoMeshes.length > 0) {
        const meshes = photoMeshes.map((p) => p.mesh);
        const intersects = raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const found = photoMeshes.find((p) => p.mesh === hitMesh);
          if (found) {
            return found.groupIndex;
          }
        }
      }

      // Fallback: find closest photo by distance to ray
      let closestIndex = -1;
      let closestDistance = Infinity;
      const maxDistance = 15; // Maximum distance to consider

      photoGroupRef.current.children.forEach((group, i) => {
        if (group instanceof THREE.Group) {
          const worldPos = new THREE.Vector3();
          group.getWorldPosition(worldPos);
          const distance = raycaster.ray.distanceToPoint(worldPos);
          if (distance < closestDistance && distance < maxDistance) {
            closestDistance = distance;
            closestIndex = i;
          }
        }
      });

      return closestIndex >= 0 ? closestIndex : null;
    },
    [raycaster]
  );

  // Expose function globally for external access
  useEffect(() => {
    (window as any).findClosestPhoto = findClosestPhoto;
    return () => {
      delete (window as any).findClosestPhoto;
    };
  }, [findClosestPhoto]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 8, 60]} fov={45} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={30}
        maxDistance={120}
        autoRotate={rotationSpeed === 0 && sceneState === "FORMED"}
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI / 1.7}
      />

      {/* Pure black background */}
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 30, 150]} />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Environment preset="night" background={false} />

      {/* Snow effect */}
      <Snow />

      <ambientLight intensity={0.4} color="#003311" />
      <pointLight
        position={[30, 30, 30]}
        intensity={100}
        color={CONFIG.colors.warmLight}
      />
      <pointLight
        position={[-30, 10, -30]}
        intensity={50}
        color={CONFIG.colors.gold}
      />
      <pointLight position={[0, -20, 10]} intensity={30} color="#ffffff" />

      <group position={[0, -6, 0]}>
        <Foliage state={sceneState} />
        <Suspense fallback={null}>
          <group ref={photoGroupRef}>
            <PhotoOrnaments
              state={sceneState}
              selectedPhotoIndex={selectedPhotoIndex}
            />
          </group>
          <ChristmasElements state={sceneState} />
          <ModelOrnaments state={sceneState} />
          <FairyLights state={sceneState} />
          <TopStar state={sceneState} />
        </Suspense>
        <Sparkles
          count={600}
          scale={50}
          size={8}
          speed={0.4}
          opacity={0.4}
          color={CONFIG.colors.silver}
        />
      </group>

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.1}
          intensity={1.5}
          radius={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

// --- Gesture Controller ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GestureController = ({
  onGesture,
  onMove,
  onStatus,
  onPinchStart,
  onPinchEnd,
  debugMode,
}: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPinchingRef = useRef(false);

  useEffect(() => {
    let gestureRecognizer: GestureRecognizer;
    let requestRef: number;

    const setup = async () => {
      onStatus("DOWNLOADING AI...");
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        onStatus("REQUESTING CAMERA...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            onStatus("AI READY: SHOW HAND");
            predictWebcam();
          }
        } else {
          onStatus("ERROR: CAMERA PERMISSION DENIED");
        }
      } catch (err: any) {
        onStatus(`ERROR: ${err.message || "MODEL FAILED"}`);
      }
    };

    const predictWebcam = () => {
      if (gestureRecognizer && videoRef.current && canvasRef.current) {
        if (videoRef.current.videoWidth > 0) {
          const results = gestureRecognizer.recognizeForVideo(
            videoRef.current,
            Date.now()
          );
          const ctx = canvasRef.current.getContext("2d");
          if (ctx && debugMode) {
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            if (results.landmarks)
              for (const landmarks of results.landmarks) {
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(
                  landmarks,
                  GestureRecognizer.HAND_CONNECTIONS,
                  { color: "#FFD700", lineWidth: 2 }
                );
                drawingUtils.drawLandmarks(landmarks, {
                  color: "#FF0000",
                  lineWidth: 1,
                });
              }
          } else if (ctx && !debugMode)
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

          // Handle gesture recognition
          let currentGesture: string | null = null;
          if (results.gestures.length > 0) {
            const name = results.gestures[0][0].categoryName;
            const score = results.gestures[0][0].score;
            if (score > 0.4) {
              currentGesture = name;
              if (name === "Open_Palm") onGesture("CHAOS");
              if (name === "Closed_Fist") onGesture("FORMED");
              if (debugMode) onStatus(`DETECTED: ${name}`);
            }
          }

          // Always check landmarks for hand movement and pinch detection
          if (results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // Handle hand movement for rotation (always works)
            const speed = (0.5 - landmarks[0].x) * 0.15;
            onMove(Math.abs(speed) > 0.01 ? speed : 0);

            // Detect pinch gesture (thumb tip and index finger tip close together)
            // BUT skip pinch detection if current gesture is Open_Palm
            if (landmarks.length >= 9 && currentGesture !== "Open_Palm") {
              const thumbTip = landmarks[4]; // Thumb tip
              const indexTip = landmarks[8]; // Index finger tip

              // Calculate distance between thumb and index finger
              const dx = thumbTip.x - indexTip.x;
              const dy = thumbTip.y - indexTip.y;
              const dz = thumbTip.z - indexTip.z;
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

              // Pinch detected if distance is small
              const PINCH_THRESHOLD = 0.08;

              // Debug: show distance in debug mode
              if (debugMode && distance < 0.15) {
                onStatus(
                  `Distance: ${distance.toFixed(3)} (pinching: ${
                    distance < PINCH_THRESHOLD
                  })`
                );
              }

              const isCurrentlyPinching = distance < PINCH_THRESHOLD;

              // Detect pinch start (transition from not pinching to pinching)
              if (isCurrentlyPinching && !isPinchingRef.current) {
                isPinchingRef.current = true;

                // Calculate pinch center position (normalized 0-1)
                const pinchX = (thumbTip.x + indexTip.x) / 2;
                const pinchY = (thumbTip.y + indexTip.y) / 2;

                // Convert to screen coordinates (0-1 range, where 0,0 is top-left)
                const screenX = pinchX;
                const screenY = 1 - pinchY;

                if (onPinchStart) {
                  onPinchStart(screenX, screenY);
                }

                if (debugMode) {
                  onStatus(
                    `✅ PINCH START at (${screenX.toFixed(
                      2
                    )}, ${screenY.toFixed(2)})`
                  );
                }
              }
              // Detect pinch end (transition from pinching to not pinching)
              else if (!isCurrentlyPinching && isPinchingRef.current) {
                isPinchingRef.current = false;

                if (onPinchEnd) {
                  onPinchEnd();
                }

                if (debugMode) {
                  onStatus("🔄 PINCH END - Photo returning");
                }
              }
            } else {
              // No landmarks, reset pinch state
              if (isPinchingRef.current) {
                isPinchingRef.current = false;
                if (onPinchEnd) {
                  onPinchEnd();
                }
              }
            }
          } else {
            onMove(0);
            if (debugMode) onStatus("AI READY: NO HAND");
          }
        }
        requestRef = requestAnimationFrame(predictWebcam);
      }
    };
    setup();
    return () => cancelAnimationFrame(requestRef);
  }, [onGesture, onMove, onStatus, onPinchStart, onPinchEnd, debugMode]);

  return (
    <>
      <video
        ref={videoRef}
        style={{
          opacity: debugMode ? 0.6 : 0,
          position: "fixed",
          top: 0,
          right: 0,
          width: debugMode ? "320px" : "1px",
          zIndex: debugMode ? 100 : -1,
          pointerEvents: "none",
          transform: "scaleX(-1)",
        }}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: debugMode ? "320px" : "1px",
          height: debugMode ? "auto" : "1px",
          zIndex: debugMode ? 101 : -1,
          pointerEvents: "none",
          transform: "scaleX(-1)",
        }}
      />
    </>
  );
};

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<"CHAOS" | "FORMED">("CHAOS");
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [aiStatus, setAiStatus] = useState("INITIALIZING...");
  const [debugMode, setDebugMode] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null
  );

  // Handle pinch start - select photo and show popup
  const handlePinchStart = useCallback(
    (screenX: number, screenY: number) => {
      if (sceneState !== "CHAOS") return; // Only work in CHAOS state

      // Wait a frame for the findClosestPhoto function to be available
      setTimeout(() => {
        const findClosestPhoto = (window as any).findClosestPhoto;
        let photoIndex: number | null = null;

        if (findClosestPhoto) {
          photoIndex = findClosestPhoto(screenX, screenY);
        }

        // If no photo found, select a random one as fallback
        if (photoIndex === null) {
          photoIndex = Math.floor(Math.random() * CONFIG.counts.ornaments);
        }

        if (photoIndex !== null) {
          setSelectedPhotoIndex(photoIndex);
        }
      }, 100);
    },
    [sceneState]
  );

  // Handle pinch end - return photo to original position
  const handlePinchEnd = useCallback(() => {
    setSelectedPhotoIndex(null);
  }, []);

  // Reset selected photo when tree is formed
  useEffect(() => {
    if (sceneState === "FORMED") {
      setSelectedPhotoIndex(null);
    }
  }, [sceneState]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ toneMapping: THREE.ReinhardToneMapping }}
          shadows
        >
          <Experience
            sceneState={sceneState}
            rotationSpeed={rotationSpeed}
            selectedPhotoIndex={selectedPhotoIndex}
          />
        </Canvas>
      </div>
      <GestureController
        onGesture={setSceneState}
        onMove={setRotationSpeed}
        onStatus={setAiStatus}
        onPinchStart={handlePinchStart}
        onPinchEnd={handlePinchEnd}
        debugMode={debugMode}
      />

      {/* UI - Buttons */}
      <div
        style={{
          position: "absolute",
          bottom: "30px",
          right: "40px",
          zIndex: 10,
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={() => setDebugMode(!debugMode)}
          style={{
            padding: "12px 15px",
            backgroundColor: debugMode ? "#FFD700" : "rgba(0,0,0,0.5)",
            border: "1px solid #FFD700",
            color: debugMode ? "#000" : "#FFD700",
            fontFamily: "sans-serif",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {debugMode ? "HIDE DEBUG" : "🛠 DEBUG"}
        </button>
        <button
          onClick={() =>
            setSceneState((s) => (s === "CHAOS" ? "FORMED" : "CHAOS"))
          }
          style={{
            padding: "12px 30px",
            backgroundColor: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255, 215, 0, 0.5)",
            color: "#FFD700",
            fontFamily: "serif",
            fontSize: "14px",
            fontWeight: "bold",
            letterSpacing: "3px",
            textTransform: "uppercase",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {sceneState === "CHAOS" ? "Assemble Tree" : "Disperse"}
        </button>
      </div>

      {/* UI - AI Status */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          color: aiStatus.includes("ERROR")
            ? "#FF0000"
            : "rgba(255, 215, 0, 0.4)",
          fontSize: "10px",
          letterSpacing: "2px",
          zIndex: 10,
          background: "rgba(0,0,0,0.5)",
          padding: "4px 8px",
          borderRadius: "4px",
        }}
      >
        {aiStatus}
      </div>
    </div>
  );
}
