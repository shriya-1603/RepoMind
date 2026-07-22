/* eslint-disable react/no-unknown-property */
import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Grid,
  Environment,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";
import Sculpture from "./Sculpture";
import Particles from "./Particles";
import OrbitCards from "./OrbitCards";
import { scroll } from "../lib/scrollStore";

const LOOK = new THREE.Vector3(0, 1.9, 0);

function cameraTarget(p, out) {
  const a = -p * Math.PI * 1.2; // clockwise sweep
  const dolly = Math.sin((Math.min(p, 0.9) / 0.9) * Math.PI); // 0->1->0
  let radius = 7.8 - dolly * 1.4;
  if (p > 0.9) radius = 6.5 + ((p - 0.9) / 0.1) * 2.1; // final zoom out
  const y = 2.0 - Math.sin(p * Math.PI) * 0.6 + p * 0.45;
  out.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
  return out;
}

function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 1.95, 9.6));
  const look = useRef(new THREE.Vector3(0, 1.7, 0));
  const sp = useRef(0); // smoothed progress (keeps camera on the orbit arc)

  useFrame(() => {
    // Smooth the scroll progress, then place the camera directly on the
    // computed orbit arc. This avoids chord-cutting through the subject.
    sp.current += (scroll.progress - sp.current) * 0.06;
    cameraTarget(sp.current, target.current);
    target.current.x += scroll.mouseX * 0.4;
    target.current.y += scroll.mouseY * 0.25;
    camera.position.copy(target.current);
    look.current.lerp(LOOK, 0.1);
    camera.lookAt(look.current);
  });
  return null;
}

export default function Scene() {
  return (
    <Canvas
      className="canvas-fixed"
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.95, 8.6], fov: 42, near: 0.1, far: 60 }}
    >
      <color attach="background" args={["#04050A"]} />
      <fog attach="fog" args={["#04050A", 9, 26]} />

      <ambientLight intensity={0.35} color="#8ea6ff" />
      {/* warm key light from the lamp side */}
      <spotLight
        position={[-4.5, 5.5, 3.5]}
        angle={0.6}
        penumbra={0.9}
        intensity={40}
        color="#E7B45A"
        distance={22}
      />
      {/* cool rim */}
      <spotLight
        position={[5, 4, -3]}
        angle={0.7}
        penumbra={1}
        intensity={30}
        color="#5B8CFF"
        distance={22}
      />
      <pointLight position={[0, 1.2, 2]} intensity={6} color="#7DA3FF" />

      <Suspense fallback={null}>
        <Sculpture />
        <OrbitCards />
        <Environment resolution={256}>
          <Lightformer intensity={2.4} color="#5B8CFF" position={[-3, 4, 3]} scale={6} />
          <Lightformer intensity={1.8} color="#E7B45A" position={[4, 3, 3]} scale={5} />
          <Lightformer intensity={1.2} color="#ffffff" position={[0, -3, -4]} scale={9} />
        </Environment>
      </Suspense>

      <Particles />

      {/* Grid: renderOrder=-1 draws it behind everything; raycast disabled stops hover flicker */}
      <Grid
        position={[0, -0.65, 0]}
        args={[40, 40]}
        cellSize={0.7}
        cellThickness={0.6}
        cellColor="#141a2e"
        sectionSize={3.5}
        sectionThickness={1}
        sectionColor="#28345c"
        fadeDistance={26}
        fadeStrength={2}
        infiniteGrid
        renderOrder={-1}
        raycast={() => null}
      />

      <CameraRig />
    </Canvas>
  );
}
