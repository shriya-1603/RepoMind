import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  particleCount?: number;
  connectionDistance?: number;
  mouseInfluence?: number;
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleCount = 120,
  connectionDistance = 120,
  mouseInfluence = 80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Three.js Scene Setup ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 300;

    // ── Particles ─────────────────────────────────────────────────────────
    const positions: Float32Array = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    const originalPositions: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 700;
      const y = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 200;
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      originalPositions.push(new THREE.Vector3(x, y, z));
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.1,
      ));
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x6366f1,
      size: 2.5,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ── Connection Lines ───────────────────────────────────────────────────
    const maxLines = particleCount * (particleCount - 1) / 2;
    const linePos = new Float32Array(maxLines * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePos, 3));

    const lineMaterial = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.15, vertexColors: false }),
    );
    scene.add(lineMaterial);

    // ── Mouse Tracking ────────────────────────────────────────────────────
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 600;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 400;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // ── Animation Loop ────────────────────────────────────────────────────
    let lineCount = 0;
    const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    const lineAttr = lineGeometry.getAttribute('position') as THREE.BufferAttribute;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const mouse = mouseRef.current;
      lineCount = 0;

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;
        let px = posAttr.array[ix];
        let py = posAttr.array[iy];
        let pz = posAttr.array[iz];

        // Mouse gravity
        const dx = mouse.x - px;
        const dy = mouse.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseInfluence) {
          const force = (mouseInfluence - dist) / mouseInfluence * 0.08;
          velocities[i].x += dx * force * 0.01;
          velocities[i].y += dy * force * 0.01;
        }

        // Drift back toward original
        velocities[i].x += (originalPositions[i].x - px) * 0.0005;
        velocities[i].y += (originalPositions[i].y - py) * 0.0005;

        // Damping
        velocities[i].multiplyScalar(0.97);

        px += velocities[i].x;
        py += velocities[i].y;
        pz += velocities[i].z;

        // Wrap edges
        if (px > 350) px = -350; if (px < -350) px = 350;
        if (py > 250) py = -250; if (py < -250) py = 250;

        (posAttr.array as Float32Array)[ix] = px;
        (posAttr.array as Float32Array)[iy] = py;
        (posAttr.array as Float32Array)[iz] = pz;

        // Build connection lines
        for (let j = i + 1; j < particleCount; j++) {
          const jx = j * 3;
          const qx = posAttr.array[jx];
          const qy = posAttr.array[jx + 1];
          const qz = posAttr.array[jx + 2];
          const d = Math.sqrt((px-qx)**2 + (py-qy)**2 + (pz-qz)**2);
          if (d < connectionDistance) {
            const base = lineCount * 6;
            (lineAttr.array as Float32Array)[base]     = px;
            (lineAttr.array as Float32Array)[base + 1] = py;
            (lineAttr.array as Float32Array)[base + 2] = pz;
            (lineAttr.array as Float32Array)[base + 3] = qx;
            (lineAttr.array as Float32Array)[base + 4] = qy;
            (lineAttr.array as Float32Array)[base + 5] = qz;
            lineCount++;
          }
        }
      }

      posAttr.needsUpdate = true;
      lineAttr.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineCount * 2);

      // Slowly rotate scene
      scene.rotation.y += 0.0005;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      particleGeometry.dispose();
      lineGeometry.dispose();
    };
  }, [particleCount, connectionDistance, mouseInfluence]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default ParticleBackground;
