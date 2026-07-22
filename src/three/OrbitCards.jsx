/* eslint-disable react/no-unknown-property */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";
import { scroll, activeCardFromProgress } from "../lib/scrollStore";
import { FEATURES } from "../data/features";

const TAU = Math.PI * 2;
const RX = 7.8;
const RZ = 4.7;
const BASE_Y = 3.75;

// reusable temp for screen-space projection
const _sp = new THREE.Vector3();

function Card({ index, feature }) {
  const group = useRef();
  const mesh = useRef();
  const matRef = useRef();
  const labelRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = scroll.progress;
    const active = activeCardFromProgress(p);
    const isActive = active.index === index;
    // evenly-spaced, calm orbit
    const angle = (index / FEATURES.length) * TAU + t * 0.03 + p * 0.22;

    // orbit slot position (tilted ellipse that rings the upper area)
    const ox = Math.cos(angle) * RX;
    const oz = Math.sin(angle) * RZ - 1.0;
    const oy = BASE_Y + Math.sin(angle) * 0.55 + Math.sin(t * 0.5 + index) * 0.04;

    // active card zooms into a stable SCREEN-SPACE spot (upper-right, near the
    // detail panel) so it can never cover the hero regardless of camera orbit.
    const g = group.current;
    if (!g) return;

    // Staggered entrance: cards emerge from the center one-by-one and fly to slots.
    const startAt = 0.7 + index * 0.24;
    const ent = THREE.MathUtils.clamp((t - startAt) / 0.9, 0, 1);
    const eased = 1 - Math.pow(1 - ent, 3);
    if (ent < 1) {
      g.position.x = ox * eased;
      g.position.y = 2.0 + (oy - 2.0) * eased;
      g.position.z = oz * eased;
      g.scale.setScalar(Math.max(0.001, eased));
      if (mesh.current) mesh.current.rotation.set(0, 0, 0);
      if (matRef.current) matRef.current.opacity = 0.4 * eased;
      if (labelRef.current) labelRef.current.style.opacity = (eased * 0.5).toFixed(2);
      return;
    }

    // The active feature is shown by the DOM detail panel ONLY — its 3D twin
    // stays in its orbit slot and fades out, so there's no floating title
    // card hovering between the panel and the hero.
    const lerp = 0.06;
    g.position.x += (ox - g.position.x) * lerp;
    g.position.y += (oy - g.position.y) * lerp;
    g.position.z += (oz - g.position.z) * lerp;

    const s = isActive ? 1.12 : 1.0;
    const cur = g.scale.x + (s - g.scale.x) * lerp;
    g.scale.setScalar(cur);

    if (mesh.current) {
      const ry = Math.sin(t * 0.35 + index) * 0.2;
      mesh.current.rotation.y += (ry - mesh.current.rotation.y) * 0.05;
      mesh.current.rotation.x = Math.sin(t * 0.28 + index) * 0.04;
    }

    // Declutter: dim non-active cards; fade back-of-orbit cards + labels,
    // and strongly fade any card that drifts over the hero on screen.
    _sp.copy(g.position).project(state.camera);
    const nearHero =
      1 - THREE.MathUtils.clamp(Math.abs(_sp.x - scroll.heroX) / 0.5, 0, 1);
    const someoneActive = active.index >= 0;
    const front01 = (Math.sin(angle) + 1) / 2; // 1 = toward camera
    // active card's 3D twin is hidden (the detail panel represents it)
    let glassOpacity = isActive ? 0 : 0.44 + front01 * 0.18;
    if (!isActive) glassOpacity *= 1 - nearHero * 0.85;
    if (matRef.current) {
      matRef.current.opacity += (glassOpacity - matRef.current.opacity) * 0.1;
    }
    let labelOpacity;
    if (isActive) labelOpacity = 0;
    else if (someoneActive) labelOpacity = 0.12 * (1 - nearHero);
    else labelOpacity = (0.2 + front01 * 0.7) * (1 - nearHero * 0.9);
    // fade card labels during the outro so the "Meet RepoMind" CTA stays clean
    labelOpacity *= 1 - THREE.MathUtils.smoothstep(p, 0.92, 0.98);
    if (labelRef.current) {
      labelRef.current.style.opacity = labelOpacity.toFixed(2);
    }
  });

  return (
    <group ref={group} position={[0, BASE_Y, 0]} scale={0.001}>
      <mesh ref={mesh}>
        <RoundedBox args={[1.75, 1.05, 0.08]} radius={0.09} smoothness={4}>
          <meshPhysicalMaterial
            ref={matRef}
            transmission={0.9}
            thickness={0.6}
            roughness={0.18}
            ior={1.25}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.2}
            color="#9fb4e6"
            transparent
            opacity={0.62}
            attach="material"
          />
        </RoundedBox>
        {/* accent edge glow */}
        <mesh position={[0, -0.46, 0.05]}>
          <planeGeometry args={[1.4, 0.02]} />
          <meshBasicMaterial color="#5B8CFF" transparent opacity={0.8} />
        </mesh>
      </mesh>
      <Html
        center
        position={[0, 0, 0.12]}
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div
          ref={labelRef}
          style={{
            width: 150,
            textAlign: "center",
            fontFamily: "Bricolage Grotesque, sans-serif",
            color: "#EAEEF8",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.01em",
            textShadow: "0 2px 12px rgba(0,0,0,0.85)",
            transition: "opacity 0.3s ease",
          }}
        >
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 9,
              color: "#5B8CFF",
              display: "block",
              marginBottom: 2,
            }}
          >
            {feature.index}
          </span>
          {feature.title}
        </div>
      </Html>
    </group>
  );
}

export default function OrbitCards() {
  return (
    <group>
      {FEATURES.map((f, i) => (
        <Card key={f.id} index={i} feature={f} />
      ))}
    </group>
  );
}
