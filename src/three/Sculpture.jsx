/* eslint-disable react/no-unknown-property */
import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { scroll, activeCardFromProgress, setHeroX } from "../lib/scrollStore";

const vertex = `
varying vec2 vUv;
varying float vWorldY;
void main(){
  vUv = uv;
  // Compute world-space Y so the fragment shader can anchor the bottom fade
  // to a fixed world height regardless of the group's dynamic scale/position
  vWorldY = (modelMatrix * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = `
uniform sampler2D uTex;
uniform float uGlow;
uniform vec2 uScale;
uniform vec2 uOffset;
varying vec2 vUv;
varying float vWorldY;
void main(){
  vec2 uv = (vUv - 0.5) * uScale + 0.5 + uOffset;
  vec4 tex = texture2D(uTex, uv);
  
  // Scoped vignette in plane space to blend rectangular frame into the dark scene
  vec2 c = vUv - 0.5;
  // Scale horizontally to draw the vignette mask boundaries inward, ensuring the edges are fully transparent
  float d = length(c * vec2(1.35, 1.0));
  // Restore original vignette limit to maintain smooth transition
  float vig = smoothstep(0.58, 0.22, d);
  
  // World-space bottom fade: anchored to world Y so it is scale/position/camera independent.
  // alpha=0 at Y<=-0.55 (safely above Grid at -0.65 and ContactShadows at -0.58),
  // alpha=1 at Y>=0.20. This permanently prevents the depth-intersection glitch
  // regardless of the group's dynamic scale (0.9..1.16) or position.
  float edgeBottom = smoothstep(-0.55, 0.20, vWorldY);
  // UV-space top fade (no geometry collisions at the top, UV-space is fine here)
  float edgeTop = smoothstep(1.0, 0.92, vUv.y);
  float edgeY = edgeBottom * edgeTop;
  
  float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float mx = max(max(tex.r, tex.g), tex.b);
  float mn = min(min(tex.r, tex.g), tex.b);
  float sat = (mx - mn) / max(mx, 0.001);
  
  // Background keying: original formula — protects eyes/outline/face via saturation term
  float bg = smoothstep(0.55, 0.80, lum) * (1.0 - smoothstep(0.0, 0.22, sat)) * smoothstep(0.14, 0.42, d);

  // Combine radial vignette and vertical edge-fade
  float alpha = vig * edgeY * (1.0 - bg);
  
  vec3 col = tex.rgb;
  col = mix(col, col * vec3(0.90, 0.95, 1.10), 0.28);
  col += uGlow * vec3(0.18, 0.28, 0.55) * smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(col, alpha);
}`;

const TARGET_ASPECT = 1.4; // wider crop so the lamp, laptop & pencil cup show too
const _proj = new THREE.Vector3();

export default function Sculpture() {
  const mat = useRef();
  const group = useRef();
  const { camera } = useThree();
  const [aspect, setAspect] = useState(TARGET_ASPECT);

  const video = useMemo(() => {
    const v = document.createElement("video");
    const webm = document.createElement("source");
    webm.src = "/character.webm";
    webm.type = "video/webm";
    const mp4 = document.createElement("source");
    mp4.src = "/character.mp4";
    mp4.type = "video/mp4";
    v.appendChild(webm);
    v.appendChild(mp4);
    v.loop = true;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    v.preload = "auto";
    v.style.cssText =
      "position:fixed;width:2px;height:2px;top:-10px;left:-10px;opacity:0.01;pointer-events:none;z-index:-1;";
    document.body.appendChild(v);
    v.load();
    const tryPlay = () => {
      v.playbackRate = 0.55; // slowed for a calm, cinematic feel
      v.play().catch(() => {});
    };
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    window.addEventListener("pointerdown", tryPlay, { once: true });
    window.addEventListener("scroll", tryPlay, { once: true });
    return v;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [video]);

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture },
      uGlow: { value: 0 },
      uScale: { value: new THREE.Vector2(0.53, 0.99) },
      uOffset: { value: new THREE.Vector2(0, 0.02) },
    }),
    [texture]
  );

  useEffect(() => {
    const onMeta = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        const va = vw / vh;
        const cropW = Math.min(1, TARGET_ASPECT / va);
        uniforms.uScale.value.set(cropW, 0.99);
        setAspect(TARGET_ASPECT);
      }
      video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", onMeta);
    if (video.readyState >= 1) onMeta();
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.pause();
      if (video.parentNode) video.parentNode.removeChild(video);
    };
  }, [video, uniforms]);

  const height = 5.0;
  const width = height * aspect;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = scroll.progress;
    if (texture) texture.needsUpdate = true;
    if (group.current) {
      // ── Choreography ─────────────────────────────────────────────
      // Intro: big, center-right (headline is on the left).
      // Features: slide left + shrink slightly so the right detail panel
      //           never hinders the hero (and vice-versa).
      // Outro: return to center, scale back up (full scene reveal).
      const introToFeat = THREE.MathUtils.smoothstep(p, 0.02, 0.14);
      const featToOutro = THREE.MathUtils.smoothstep(p, 0.9, 0.995);
      const active = activeCardFromProgress(p);

      let hx = THREE.MathUtils.lerp(0.8, -2.1, introToFeat);
      hx = THREE.MathUtils.lerp(hx, 0.0, featToOutro);
      // subtle reaction synced to each card's zoom-in
      if (active.index >= 0) hx -= active.local * 0.35;

      const hy = 1.35 + Math.sin(p * Math.PI) * 0.12 + Math.sin(t * 0.5) * 0.015;

      let hs = THREE.MathUtils.lerp(1.16, 0.9, introToFeat);
      hs = THREE.MathUtils.lerp(hs, 1.12, featToOutro);
      if (active.index >= 0) hs -= active.local * 0.03;

      group.current.position.x += (hx - group.current.position.x) * 0.05;
      group.current.position.y += (hy - group.current.position.y) * 0.05;
      const cs = group.current.scale.x + (hs - group.current.scale.x) * 0.05;
      group.current.scale.setScalar(cs);

      // Billboard: always face the camera on the Y axis so the character
      // stays visible and keeps playing through the full camera orbit (past 180°).
      const dx = camera.position.x - group.current.position.x;
      const dz = camera.position.z - group.current.position.z;
      const faceY = Math.atan2(dx, dz);
      group.current.rotation.y = faceY + Math.sin(t * 0.3) * 0.012;
      group.current.rotation.z = Math.sin(t * 0.4) * 0.008;
      group.current.rotation.x = scroll.mouseY * 0.02;

      // report hero's screen-space X so cards/panel can move to the opposite side
      _proj.copy(group.current.position);
      _proj.y += 0.6; // aim at the head/upper body
      _proj.project(camera);
      setHeroX(THREE.MathUtils.clamp(_proj.x, -1, 1));
    }
    if (mat.current) {
      const target = p > 0.82 ? 0.6 : p > 0.28 ? 0.18 : 0.05;
      mat.current.uniforms.uGlow.value +=
        (target - mat.current.uniforms.uGlow.value) * 0.05;
    }
  });

  return (
    <group ref={group} position={[0, 1.5, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          ref={mat}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
