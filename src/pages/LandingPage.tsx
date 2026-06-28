import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Terminal, GitBranch, Menu, X } from 'lucide-react';
import { useRepo } from '../contexts/RepoContext';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Center, Html, ContactShadows } from '@react-three/drei';


const PRESET_REPOS = [
  {
    name: 'shriya-1603/bird-classification',
    url: 'https://github.com/shriya-1603/bird-classification',
    id: 'analysis-885e85e7',
    language: 'Python',
    files: 265,
    size: '14.3 MB'
  },
  {
    name: 'facebook/react',
    url: 'https://github.com/facebook/react',
    id: 'analysis-react-mock',
    language: 'JavaScript',
    files: 4120,
    size: '182.4 MB'
  },
  {
    name: 'tiangolo/fastapi',
    url: 'https://github.com/tiangolo/fastapi',
    id: 'analysis-fastapi-mock',
    language: 'Python',
    files: 840,
    size: '42.1 MB'
  }
];

const CAPABILITIES = [
  {
    step: '01',
    name: 'AST_GRAPH_PARSER',
    signature: 'compileGraphStructure(repo: ASTNode[]): Map<string, Node>',
    desc: 'Recursively parse source tree to map absolute import statements, export interfaces, and modular dependencies.'
  },
  {
    step: '02',
    name: 'VECTOR_SEMANTIC_STORE',
    signature: 'vectorSearch(embeddings: Float32Array): ChunkScore[]',
    desc: 'Generate dense embeddings of file blocks for semantic similarity matching across multiple languages.'
  },
  {
    step: '03',
    name: 'TRANSITIVE_FALLOUT',
    signature: 'evaluateBlastRadius(target: FilePath): ImpactMatrix',
    desc: 'Compute static analysis reference paths to evaluate transitive impact changes up to N degrees.'
  },
  {
    step: '04',
    name: 'GIT_HIST_CORRELATION',
    signature: 'mergeGitTelemetry(activityLog: JSON): GitMetadata',
    desc: 'Bind contributor commit frequency, historical ownership, and author timelines straight into AST file nodes.'
  }
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  label?: string;
  glow?: boolean;
  color?: string;
}

interface ClickRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}


const Model: React.FC = () => {
  const { scene } = useGLTF('/model.glb');
  // Facing diagonally forward-left: tilted down slightly (X: 0.1), rotated left (Y: -0.6), rolled slightly (Z: -0.05)
  return <primitive object={scene} scale={1.28} position={[0.3, -0.1, 0]} rotation={[0.1, -0.6, -0.05]} />;
};

const CameraController: React.FC<{ trigger: boolean }> = ({ trigger }) => {
  const { camera } = useThree();
  useFrame(() => {
    if (trigger) {
      // Physically fly the camera straight through the center of the screen plane
      camera.position.x += (0.3 - camera.position.x) * 0.15;
      camera.position.y += (0.3 - camera.position.y) * 0.15;
      camera.position.z += (-1.5 - camera.position.z) * 0.15;
      camera.lookAt(0.3, 0.3, -2.0);
    } else {
      // Keep static diagonal position
      camera.position.x += (0 - camera.position.x) * 0.1;
      camera.position.y += (0.8 - camera.position.y) * 0.1;
      camera.position.z += (4.6 - camera.position.z) * 0.1;
      camera.lookAt(0, 0.3, -2.0);
    }
  });
  return null;
};

interface LaptopCanvasProps {
  isZooming: boolean;
  onTriggerZoom: () => void;
}

const LaptopCanvas: React.FC<LaptopCanvasProps> = ({ isZooming, onTriggerZoom }) => {
  return (
    <div 
      onClick={onTriggerZoom}
      className="w-full h-full relative flex items-center justify-center cursor-pointer"
    >
      <Canvas 
        camera={{ position: [0, 0.8, 4.6], fov: 40 }} 
        shadows 
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        className="z-10 w-full h-full"
      >
        <ambientLight intensity={0.5} />
        
        {/* Soft fill light from bottom/back */}
        <directionalLight position={[-5, -2, -5]} intensity={0.4} />
        
        {/* Coral-tinted key light for atmospheric color */}
        <directionalLight position={[6, 8, 4]} intensity={3.5} color="#FF6F61" castShadow />
        
        {/* Goldenrod highlight to give a neon edge line */}
        <directionalLight position={[-6, 5, -2]} intensity={2.5} color="#DAA520" />
        
        {/* Spot light directly hitting the screen/keyboard area */}
        <spotLight position={[0, 8, 2]} angle={0.4} penumbra={1} intensity={6} color="#FF4500" castShadow />
        
        <React.Suspense fallback={
          <Html center>
            <div className="text-[#FF4500] font-mono text-[10px] animate-pulse uppercase tracking-widest bg-[#1C1C1C]/80 px-4 py-2 border border-[#FF4500]/30 rounded">
              LOADING 3D MODEL...
            </div>
          </Html>
        }>
          <Center>
            <Model />
          </Center>
          
          {/* Realistic soft ground contact shadow aligned with the offset model */}
          <ContactShadows position={[0.3, -0.35, 0]} opacity={0.4} scale={8} blur={3.5} far={45} />
        </React.Suspense>
        
        {/* Orbit controls with restricted polar angles - autoRotate disabled */}
        <OrbitControls 
          enableZoom={false} 
          minPolarAngle={Math.PI / 3.5} 
          maxPolarAngle={Math.PI / 1.8} 
        />

        {/* Interpolate camera to screen when transition triggers */}
        <CameraController trigger={isZooming} />
      </Canvas>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { startAnalysis, setActiveRepository, errorMessage } = useRepo();
  const [inputUrl, setInputUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  
  const triggerZoom = () => {
    if (isZooming) return;
    setIsZooming(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 850);
  };
  
  const [systemLogs, setSystemLogs] = useState<string[]>([
    'Initializing RepoMind Engine v0.1.0...',
    'AST Parser: LOADED',
    'Vector Indexer: ONLINE',
    'Graph Database: CONNECTED'
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const clicksRef = useRef<ClickRipple[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll();
  
  const scaleSpring = useSpring(useTransform(scrollY, [0, 500], [1, 0.95]), { stiffness: 90, damping: 20 });
  const opacitySpring = useSpring(useTransform(scrollY, [0, 300], [1, 0]), { stiffness: 90, damping: 20 });
  const translateHeroY = useSpring(useTransform(scrollY, [0, 600], [0, -80]), { stiffness: 90, damping: 20 });

  useEffect(() => {
    if (isAnalyzingLocal) return;
    const logs = [
      'Indexed node: App.tsx',
      'Created edge: App.tsx -> AuthContext.tsx',
      'Computed centrality: api.ts (0.89)',
      'Extracted activity: analysis-885e85e7',
      'Garbage collector: cleared temporary clone path',
      'Idle: awaiting repository link...'
    ];
    const interval = setInterval(() => {
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      const timestamp = new Date().toISOString().slice(11, 19);
      setSystemLogs(prev => [...prev.slice(-8), `[${timestamp}] ${randomLog}`]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAnalyzingLocal]);

  // Technical canvas drawing background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let time = 0;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const filenames = [
      'App.tsx', 'index.css', 'api.ts', 'main.go', 'route.rs', 
      'utils.py', 'Cargo.toml', 'package.json', 'db.sql', 'Layout.tsx',
      'Graph.tsx', 'AuthContext.tsx', 'index.js', 'server.py'
    ];

    // Strictly using the new palette colors for particles: #FF6F61 (coral), #DAA520 (goldenrod), #FF4500 (orange-red)
    const particles: Particle[] = Array.from({ length: 55 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1.2,
      label: i % 4 === 0 ? filenames[Math.floor(Math.random() * filenames.length)] : undefined,
      glow: Math.random() > 0.8,
      color: i % 3 === 0 ? '#FF6F61' : i % 3 === 1 ? '#DAA520' : '#FF4500'
    }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleMouseDown = (e: MouseEvent) => {
      clicksRef.current.push({
        x: e.clientX,
        y: e.clientY,
        r: 0,
        maxR: 200,
        alpha: 1
      });
    };
    window.addEventListener('mousedown', handleMouseDown);

    const draw = () => {
      time += 0.005;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#000000');
      bgGrad.addColorStop(0.5, '#0F0F0F');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;

      const parallaxX = mouse.x > 0 ? (mouse.x - width/2) * -0.04 : 0;
      const parallaxY = mouse.y > 0 ? (mouse.y - height/2) * -0.04 : 0;

      ctx.save();
      ctx.translate(parallaxX, parallaxY);

      // Radial glows using #FF4500 (orangered) and #FF6F61 (coral)
      const radGrad1 = ctx.createRadialGradient(width/2, height/3, 50, width/2, height/3, width * 0.8);
      radGrad1.addColorStop(0, 'rgba(255, 69, 0, 0.35)');
      radGrad1.addColorStop(0.5, 'rgba(255, 111, 97, 0.12)');
      radGrad1.addColorStop(1, 'rgba(28, 28, 28, 0)');
      ctx.fillStyle = radGrad1;
      ctx.fillRect(0, 0, width, height);

      // Draw technical grid lines using #F5E8D8 (cream)
      ctx.strokeStyle = 'rgba(245, 232, 216, 0.05)';
      ctx.lineWidth = 0.5;
      const gridSize = 100;
      for (let x = -gridSize; x < width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -gridSize);
        ctx.lineTo(x, height + gridSize);
        ctx.stroke();
      }
      for (let y = -gridSize; y < height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-gridSize, y);
        ctx.lineTo(width + gridSize, y);
        ctx.stroke();
      }

      // Draw click shockwave ripples using #FF4500
      clicksRef.current = clicksRef.current.filter((ring) => {
        ring.r += 3.5;
        ring.alpha = 1 - ring.r / ring.maxR;
        
        ctx.strokeStyle = `rgba(255, 69, 0, ${ring.alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ring.x - parallaxX, ring.y - parallaxY, ring.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 111, 97, ${ring.alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(ring.x - parallaxX, ring.y - parallaxY, ring.r * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        return ring.r < ring.maxR;
      });

      // Draw 3D topographic waves using #DAA520 (goldenrod)
      ctx.strokeStyle = 'rgba(218, 165, 32, 0.28)';
      ctx.lineWidth = 0.75;
      const waveCount = 14;
      const wavePoints = 40;
      const startY = height * 0.65;
      
      for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        const currentWaveY = startY + i * 22;
        const scale = (i / waveCount);
        
        for (let j = 0; j <= wavePoints; j++) {
          const pct = j / wavePoints;
          const currentX = pct * width;
          
          const mouseDist = Math.max(0, 1 - Math.abs((mouse.x - parallaxX) - currentX) / 400);
          const cursorOffset = mouse.y > 0 ? mouseDist * Math.sin(time * 5) * 28 * scale : 0;
          const sineOffset = Math.sin(pct * Math.PI * 4 + time + i * 0.4) * 22 * scale;
          
          const currentY = currentWaveY + sineOffset + cursorOffset;
          
          if (j === 0) {
            ctx.moveTo(currentX, currentY);
          } else {
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.stroke();
      }

      // Draw particles & links
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const dx = (mouse.x - parallaxX) - p.x;
        const dy = (mouse.y - parallaxY) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 180) {
          p.x += dx * 0.005;
          p.y += dy * 0.005;

          const connectionAlpha = (1 - dist / 180) * 0.25;
          ctx.strokeStyle = `rgba(255, 111, 97, ${connectionAlpha})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x - parallaxX, mouse.y - parallaxY);
          ctx.stroke();

          const pulseProgress = (time * 2.5) % 1;
          const px = p.x + dx * pulseProgress;
          const py = p.y + dy * pulseProgress;
          ctx.fillStyle = '#F5E8D8';
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        clicksRef.current.forEach((ring) => {
          const rx = (ring.x - parallaxX) - p.x;
          const ry = (ring.y - parallaxY) - p.y;
          const rdist = Math.sqrt(rx * rx + ry * ry);
          if (Math.abs(rdist - ring.r) < 15) {
            p.x -= (rx / rdist) * 4;
            p.y -= (ry / rdist) * 4;
          }
        });

        // Glowing nodes using particle colors & shadow blur
        if (p.glow) {
          ctx.shadowColor = p.color || '#FF6F61';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = p.color || 'rgba(255, 111, 97, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = p.glow ? '#F5E8D8' : p.color || 'rgba(245, 232, 216, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.label) {
          ctx.fillStyle = p.glow ? '#F5E8D8' : '#DAA520';
          ctx.font = '10px monospace';
          ctx.fillText(p.label, p.x + 12, p.y + 3);
        }

        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const ldx = p2.x - p.x;
          const ldy = p2.y - p.y;
          const ldist = Math.sqrt(ldx * ldx + ldy * ldy);

          if (ldist < 130) {
            const alpha = (1 - ldist / 130) * 0.12;
            ctx.strokeStyle = p.glow || p2.glow ? `rgba(255, 69, 0, ${alpha * 3.2})` : `rgba(218, 165, 32, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      // HUD crosshairs using #FF4500
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.strokeStyle = 'rgba(255, 69, 0, 0.28)';
        ctx.lineWidth = 0.75;
        
        ctx.beginPath();
        ctx.moveTo(mouse.x - parallaxX, 0);
        ctx.lineTo(mouse.x - parallaxX, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, mouse.y - parallaxY);
        ctx.lineTo(width, mouse.y - parallaxY);
        ctx.stroke();

        ctx.strokeStyle = '#FF4500';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(mouse.x - parallaxX, mouse.y - parallaxY, 20, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FF6F61';
        ctx.beginPath();
        ctx.arc(mouse.x - parallaxX, mouse.y - parallaxY, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F5E8D8';
        ctx.beginPath();
        ctx.arc(mouse.x - parallaxX, mouse.y - parallaxY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF4500';
        ctx.font = '10px monospace';
        ctx.fillText(`LOC: [${Math.round(mouse.x)}, ${Math.round(mouse.y)}]`, mouse.x - parallaxX + 28, mouse.y - parallaxY - 12);
        ctx.fillText(`ADDR: 0x${(Math.round(mouse.x) + Math.round(mouse.y)).toString(16).toUpperCase()}`, mouse.x - parallaxX + 28, mouse.y - parallaxY - 2);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed || isAnalyzingLocal) return;
    setLocalError(null);
    setIsAnalyzingLocal(true);
    setSystemLogs([]);

    const addLog = (msg: string) => {
      const timestamp = new Date().toISOString().slice(11, 19);
      setSystemLogs(prev => [...prev, `[${timestamp}] [INFO] ${msg}`]);
    };

    const addSuccessLog = (msg: string) => {
      const timestamp = new Date().toISOString().slice(11, 19);
      setSystemLogs(prev => [...prev, `[${timestamp}] [SUCCESS] ${msg}`]);
    };

    const addErrorLog = (msg: string) => {
      const timestamp = new Date().toISOString().slice(11, 19);
      setSystemLogs(prev => [...prev, `[${timestamp}] [ERROR] ${msg}`]);
    };

    addLog('Validating repository URL...');
    addLog('Import started.');
    setCurrentStage('validating URL');

    const timeouts: any[] = [];

    timeouts.push(setTimeout(() => {
      setCurrentStage('cloning repository');
      addLog('Cloning repository into temporary workspace...');
    }, 1200));

    timeouts.push(setTimeout(() => {
      setCurrentStage('parsing source files');
      addLog('Parsing source files & compiling Abstract Syntax Trees...');
    }, 4500));

    timeouts.push(setTimeout(() => {
      setCurrentStage('building graph');
      addLog('Building repository dependency graph in database...');
    }, 9000));

    timeouts.push(setTimeout(() => {
      setCurrentStage('extracting git activity');
      addLog('Extracting git activity metrics & contributor ownership...');
    }, 14000));

    try {
      const response = await startAnalysis(trimmed);
      
      timeouts.forEach(t => clearTimeout(t));

      setCurrentStage('analysis complete');
      addSuccessLog('Analysis complete! Repository graph registered.');

      if (response && response.metrics) {
        const m = response.metrics;
        addLog(`Metrics: cloneTime=${m.cloneTimeMs}ms, parseTime=${m.parseTimeMs}ms, graphStoreTime=${m.graphStoreTimeMs}ms, gitActivityTime=${m.gitActivityTimeMs}ms, totalTime=${m.totalAnalysisTimeMs}ms`);
        addLog(`Files: scanned=${m.filesScanned}, parsed=${m.filesParsed}, skipped=${m.filesSkipped}`);
      }

      setTimeout(() => {
        setIsAnalyzingLocal(false);
        navigate('/dashboard');
      }, 3500);
    } catch (err: any) {
      timeouts.forEach(t => clearTimeout(t));
      setIsAnalyzingLocal(false);
      setCurrentStage('');
      const errMsg = err.message || 'Failed to analyze repository. Please check the URL.';
      addErrorLog(`Critical error during import: ${errMsg}`);
      setLocalError(errMsg);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_REPOS[0]) => {
    setActiveRepository(preset.name, preset.url, preset.id, 'neo4j');
    navigate('/dashboard');
  };

  const titleWords = "Turn repositories into memory.".split(" ");

  return (
    <div ref={containerRef} className="relative min-h-screen bg-gradient-to-b from-black via-[#0F0F0F] to-black text-[#F5E8D8] font-mono flex flex-col justify-between selection:bg-[#FF4500]/45 selection:text-white overflow-x-hidden">
      
      {/* Immersive technical canvas background */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Immersive portal entry transition sheet when zooming into the screen */}
      <AnimatePresence>
        {isZooming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeIn" }}
            className="fixed inset-0 bg-[#1C1C1C] z-[9999] pointer-events-none flex items-center justify-center"
          >
            {/* Ambient screen glow center point */}
            <div className="w-64 h-64 rounded-full bg-[#FF4500]/20 blur-3xl animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed 3D Laptop Backdrop (Root Level) ── */}
      <div 
        className="w-full h-[400px] lg:h-screen lg:w-[80vw] z-10 absolute top-[85vh] left-0 lg:fixed lg:right-[-17vw] lg:left-auto lg:top-0 pointer-events-none"
      >
        <motion.div 
          className={`w-full h-full ${isZooming ? 'pointer-events-none' : 'pointer-events-auto'}`}
          animate={isZooming ? {
            opacity: 0,
          } : {
            opacity: 1,
          }}
          transition={{
            duration: 0.85,
            ease: "easeInOut"
          }}
        >
          <LaptopCanvas isZooming={isZooming} onTriggerZoom={triggerZoom} />
        </motion.div>
      </div>

      {/* ── IDE Header ── */}
      <header className="relative z-50 w-full px-6 lg:px-20 py-6 flex items-center justify-between border-b border-white/5 bg-black/75 backdrop-blur-md">
        <div className="flex items-center gap-6">
          {/* High-end Logo Mark & Title */}
          <div className="flex items-center gap-3.5 group/logo cursor-pointer" onClick={() => navigate('/')}>
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-[#FF4500] to-[#FF6F61] p-[1.5px]">
              <div className="w-full h-full rounded-[6px] bg-[#1C1C1C] flex items-center justify-center transition-colors group-hover/logo:bg-transparent">
                <GitBranch size={16} className="text-[#FF6F61] group-hover/logo:text-white transition-colors" />
              </div>
              <div className="absolute inset-0 rounded-lg bg-[#FF4500]/20 blur-sm -z-10 group-hover/logo:bg-[#FF4500]/55 transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm tracking-[0.25em] font-bold text-white uppercase font-mono leading-none">
                REPO<span className="text-[#FF4500]">MIND</span>
              </span>
              <span className="text-[8.5px] tracking-[0.12em] text-[#DAA520] font-mono font-semibold leading-none">
                AST_TOPOLOGY_ENGINE
              </span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-[#F5E8D8]/15" />

          <div className="flex gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500] shadow-sm shadow-[#FF4500]/50 cursor-pointer hover:scale-110 transition-transform" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#DAA520] shadow-sm shadow-[#DAA520]/50 cursor-pointer hover:scale-110 transition-transform" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6F61] shadow-sm shadow-[#FF6F61]/50 cursor-pointer hover:scale-110 transition-transform" />
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-12 text-[13px] tracking-widest font-mono text-[#F5E8D8]/70">
          <a href="#capabilities" className="hover:text-[#FF4500] hover:translate-y-[-1px] transition-all duration-300 relative group">
            CAPABILITIES
            <span className="absolute bottom-[-4px] left-0 w-0 h-[1px] bg-[#FF4500] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="#specs" className="hover:text-[#FF4500] hover:translate-y-[-1px] transition-all duration-300 relative group">
            SPECIFICATIONS
            <span className="absolute bottom-[-4px] left-0 w-0 h-[1px] bg-[#FF4500] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="#examples" className="hover:text-[#FF4500] hover:translate-y-[-1px] transition-all duration-300 relative group">
            EXPLORER
            <span className="absolute bottom-[-4px] left-0 w-0 h-[1px] bg-[#FF4500] group-hover:w-full transition-all duration-300" />
          </a>
          <div className="h-6 w-[1px] bg-[#F5E8D8]/15" />
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-[#F5E8D8] hover:text-white transition-all flex items-center gap-2 border border-[#FF4500]/45 px-6 py-2.5 rounded bg-[#FF4500]/10 hover:bg-[#FF4500] shadow-lg hover:shadow-[#FF4500]/25 font-bold tracking-widest text-[11px]"
          >
            LAUNCH CONSOLE <ArrowRight size={13} />
          </button>
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="flex md:hidden items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-[#F5E8D8] hover:text-white transition-all flex items-center gap-1.5 border border-[#FF4500]/45 px-3 py-1.5 rounded bg-[#FF4500]/10 hover:bg-[#FF4500] font-bold tracking-widest text-[10px]"
          >
            LAUNCH <ArrowRight size={11} />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 text-[#F5E8D8]/80 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-lg overflow-hidden"
            >
              <div className="px-6 py-6 flex flex-col gap-5 text-xs tracking-widest font-mono text-[#F5E8D8]/80">
                <a 
                  href="#capabilities" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#FF4500] py-2 border-b border-white/5 transition-colors"
                >
                  CAPABILITIES
                </a>
                <a 
                  href="#specs" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#FF4500] py-2 border-b border-white/5 transition-colors"
                >
                  SPECIFICATIONS
                </a>
                <a 
                  href="#examples" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#FF4500] py-2 border-b border-white/5 transition-colors"
                >
                  EXPLORER
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* ── Hero & Editor Console Block ── */}
      <main className="relative z-10 flex-grow flex flex-col">
        
        <motion.section 
          style={{ scale: scaleSpring, opacity: opacitySpring, y: translateHeroY }}
          className="min-h-[90vh] flex flex-col justify-center max-w-7xl mx-auto lg:mx-0 lg:mr-auto lg:ml-12 px-6 md:px-12 py-16 w-full lg:max-w-[58vw]"
        >
          <div className="space-y-8">
            <div className="space-y-8 flex flex-col justify-center">
              
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 border border-[#FF6F61]/50 px-4 py-2 rounded-md bg-[#FF6F61]/15 text-xs text-[#F5E8D8] tracking-wider shadow-sm shadow-[#FF6F61]/25 font-semibold w-fit">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500] animate-pulse shadow-md shadow-[#FF4500]/60" />
                  AST_COMPILER: ONLINE // PARSING_QUEUE: IDLE
                </div>

                <h1 
                  className="text-6xl sm:text-7xl md:text-8xl lg:text-[90px] font-normal tracking-tight leading-[1.03] text-[#F5E8D8]"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", textShadow: '0 0 35px rgba(255, 69, 0, 0.4)' }}
                >
                  {titleWords.map((word, i) => (
                    <motion.span
                      key={i}
                      className="inline-block mr-[0.25em]"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </h1>

                <p className="text-[#F5E8D8]/80 text-sm sm:text-base max-w-xl leading-relaxed font-light font-sans">
                  A local codebase topology visualizer. Parse Python, Go, and TypeScript abstract syntax trees to compile static vector indices and trace dependency impact structures in real-time.
                </p>
              </div>

              {/* Main IDE Window Mock (Console Input & Log Terminal Combined) */}
              <div className="border border-[#F5E8D8]/20 bg-black overflow-hidden shadow-2xl shadow-[#FF4500]/10 rounded-lg max-w-2xl lg:max-w-3xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#F5E8D8]/20 px-4 py-3 bg-black/60 text-[10px] text-[#F5E8D8]/80">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-[#FF4500]" />
                    <span>repomind_workspace_v0.1.0 // ACTIVE</span>
                  </div>
                  <div className="flex gap-4">
                    <span>PORT: 5173</span>
                    <span className="text-[#FF4500] font-bold animate-pulse">STATUS: NOMINAL</span>
                  </div>
                </div>

                {/* Body: Form & Console logs inside same card container */}
                <div className="p-5 space-y-5">
                  <form onSubmit={handleAnalyze} className="bg-black border border-[#F5E8D8]/30 p-3.5 focus-within:border-[#FF4500] transition-all duration-300 shadow-md focus-within:shadow-[#FF4500]/10 rounded-md">
                    <div className="text-[10px] text-[#F5E8D8]/50 pb-2 flex justify-between border-b border-[#F5E8D8]/10 mb-3 font-mono">
                      <span>$ repomind-cli --index</span>
                      <span className="text-[#FF4500] font-bold">
                        {isAnalyzingLocal ? `IMPORTING: ${currentStage.toUpperCase()}` : 'SESSION_IDLE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF4500] font-bold text-sm">$</span>
                      <input
                        type="url"
                        placeholder="git@github.com:username/repository.git"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        disabled={isAnalyzingLocal}
                        className="w-full bg-transparent text-xs text-[#F5E8D8] placeholder-[#F5E8D8]/30 focus:outline-none font-mono py-1"
                      />
                      <button
                        type="submit"
                        disabled={isAnalyzingLocal || !inputUrl.trim()}
                        className="px-4 py-2 border border-[#F5E8D8]/30 text-white text-[10px] font-semibold bg-[#FF4500] hover:bg-[#FF4500]/80 transition-all flex items-center gap-1.5 disabled:opacity-20 shadow-md shadow-[#FF4500]/30"
                      >
                        {isAnalyzingLocal ? (
                          <Loader2 size={10} className="animate-spin text-white" />
                        ) : (
                          <>EXECUTE <ArrowRight size={10} /></>
                        )}
                      </button>
                    </div>
                    
                    {isAnalyzingLocal && (
                      <div className="text-[10px] text-[#FF6F61] pt-2 animate-pulse flex items-center gap-1.5 font-mono">
                        <Loader2 size={10} className="animate-spin text-white" />
                        <span>Analyzing repository. This may take a few minutes for larger repos.</span>
                      </div>
                    )}
                    
                    {(localError || errorMessage) && (
                      <div className="text-[10px] text-[#FF6F61] pt-2 font-mono">
                        CRITICAL_ERROR: {localError || errorMessage}
                      </div>
                    )}
                  </form>
 
                  {/* Built-in live logger */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#F5E8D8]/10 pb-1.5 text-[10px] text-[#F5E8D8]/70">
                      <span>LOGGER // STREAM: LIVE</span>
                      <span className="text-[#FF4500] font-bold">MEM: 142.8MB</span>
                    </div>
                    
                    <div className="space-y-2.5 font-mono text-[10px] text-[#F5E8D8]/80 max-h-[120px] overflow-y-auto pr-1 pb-4">
                      {systemLogs.map((log, idx) => (
                        <div key={idx} className="border-l border-[#FF6F61] pl-3 leading-relaxed hover:text-[#FF4500] transition-colors cursor-pointer font-mono">
                          {log}
                        </div>
                      ))}
                      {isAnalyzingLocal && currentStage && (
                        <div className="text-[#F5E8D8] animate-pulse border-l border-[#F5E8D8]/30 pl-3 font-mono">
                          [EXEC] Active stage: {currentStage}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[#F5E8D8]/50">
                        <span>$</span>
                        <span className="w-1.5 h-3.5 bg-[#FF4500] animate-pulse shadow-md shadow-[#FF4500]/60" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer specs */}
                <div className="border-t border-[#F5E8D8]/10 px-4 py-2 flex justify-between text-[9px] text-[#F5E8D8]/50 bg-black/60">
                  <span>DB: NEO4J_STABLE</span>
                  <span>CPU_LOAD: 2.1%</span>
                </div>
              </div>

            </div>
          </div>
        </motion.section>

        <motion.section 
          id="capabilities"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 22 }}
          className="max-w-7xl mx-auto lg:mx-0 lg:mr-auto lg:ml-12 px-6 md:px-12 py-28 w-full relative lg:max-w-[58vw]"
        >
          {/* Specs-style cohesive Container for Capabilities */}
          <div className="border border-[#F5E8D8]/15 bg-black p-8 sm:p-12 space-y-12 rounded-lg shadow-2xl hover:border-[#FF4500]/50 transition-colors duration-500">
            <div className="space-y-3">
              <span className="text-xs tracking-widest text-[#FF4500] uppercase font-mono">// CORE_ARCH_FUNCTIONS</span>
              <h2 className="text-3xl text-[#F5E8D8] font-normal" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Abstract Structural Functions
              </h2>
              <p className="text-sm sm:text-base text-[#F5E8D8]/70 max-w-2xl font-light font-sans">
                Explore the modular compilers and intelligence stores powering our topological indexing pipelines.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              {CAPABILITIES.map((cap, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.04, y: -5, borderColor: '#FF4500' }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="bg-black border border-[#F5E8D8]/15 p-8 space-y-4 hover:shadow-2xl hover:shadow-[#FF4500]/15 cursor-pointer transition-all duration-300 group rounded-md"
                >
                  <div className="flex justify-between items-center text-xs text-[#F5E8D8]/60">
                    <span className="text-[#FF6F61] font-bold">FN_{cap.step}</span>
                    <span className="group-hover:text-[#FF4500] transition-colors font-bold">{cap.name}()</span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#DAA520] font-mono select-all border-b border-[#F5E8D8]/10 pb-2">
                    <code>{cap.signature}</code>
                  </div>
                  <p className="text-sm text-[#F5E8D8]/70 leading-relaxed font-sans font-light">
                    {cap.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Section 3: In-depth System Specifications & Architecture */}
        <motion.section 
          id="specs" 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 22 }}
          className="max-w-7xl mx-auto lg:mx-0 lg:mr-auto lg:ml-12 px-6 md:px-12 py-28 w-full relative lg:max-w-[58vw]"
        >
          {/* Specs Container (#FF4500 Highlighted border) */}
          <div className="border border-[#F5E8D8]/15 bg-black p-8 sm:p-12 space-y-12 rounded-lg shadow-2xl hover:border-[#FF4500]/50 transition-colors duration-500">
            <div className="space-y-3">
              <span className="text-xs tracking-widest text-[#FF4500] uppercase font-mono">// ARCHITECTURE_MANIFEST</span>
              <h2 className="text-3xl text-[#F5E8D8] font-normal" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                How RepoMind Organizes Codebase Memory
              </h2>
              <p className="text-sm sm:text-base text-[#F5E8D8]/70 max-w-2xl font-light font-sans">
                A technical breakdown of our multi-layered ingestion pipeline, mapping code structure, semantics, and revision history into a fast, navigable graph.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3 gap-8 pt-4">
              <motion.div 
                whileHover={{ scale: 1.02, x: 2 }}
                className="space-y-4 border-l border-[#F5E8D8]/10 pl-6 cursor-pointer hover:border-[#FF4500] transition-colors duration-300"
              >
                <div className="text-xs font-bold text-[#DAA520] font-mono">LAYER_01 // SYNTAX_COMPILER</div>
                <h4 className="text-lg text-[#F5E8D8] font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Abstract Syntax Tree (AST) Parsing
                </h4>
                <p className="text-xs sm:text-sm text-[#F5E8D8]/70 leading-relaxed font-sans font-light">
                  RepoMind traverses files and parses JavaScript, TypeScript, Go, and Python modules into static nodes. This extracts imports, exports, functions, and class declarations without running the code.
                </p>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02, x: 2 }}
                className="space-y-4 border-l border-[#F5E8D8]/10 pl-6 cursor-pointer hover:border-[#FF4500] transition-colors duration-300"
              >
                <div className="text-xs font-bold text-[#DAA520] font-mono">LAYER_02 // GRAPH_CORRELATION</div>
                <h4 className="text-lg text-[#F5E8D8] font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Neo4j Code Graph Storage
                </h4>
                <p className="text-xs sm:text-sm text-[#F5E8D8]/70 leading-relaxed font-sans font-light">
                  Relationships between dependencies, function calls, and modules are correlated as edges within a Neo4j database. This makes tracing blast radius and transitively depended files lightning-fast.
                </p>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02, x: 2 }}
                className="space-y-4 border-l border-[#F5E8D8]/10 pl-6 cursor-pointer hover:border-[#FF4500] transition-colors duration-300"
              >
                <div className="text-xs font-bold text-[#DAA520] font-mono">LAYER_03 // SEMANTIC_SEARCH</div>
                <h4 className="text-lg text-[#F5E8D8] font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Dense Vector Embedding Index
                </h4>
                <p className="text-xs sm:text-sm text-[#F5E8D8]/70 leading-relaxed font-sans font-light">
                  All parsed files are chunked logically and embedded into high-dimensional vector space using dense models. This allows natural language semantic search to retrieve correct matches with direct citations.
                </p>
              </motion.div>
            </div>

            <div className="border-t border-[#F5E8D8]/10 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#F5E8D8]/70 font-mono gap-4">
              <span>PIPELINE ENGINE: <span className="text-[#FF4500]">NOMINAL</span> // READINESS = 100%</span>
              <span>INDEX LATENCY: &lt; 200MS PER NODE</span>
            </div>
          </div>
        </motion.section>

        {/* Section 4: Preset Explorer */}
        <motion.section 
          id="examples" 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 22 }}
          className="max-w-7xl mx-auto lg:mx-0 lg:mr-auto lg:ml-12 px-6 md:px-12 py-28 w-full lg:max-w-[58vw]"
        >
          {/* Specs-style cohesive Container for Preset Explorer */}
          <div className="border border-[#F5E8D8]/15 bg-black p-8 sm:p-12 rounded-lg shadow-2xl hover:border-[#FF4500]/50 transition-colors duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
              
              <div className="xl:col-span-5 space-y-6">
                <span className="text-xs tracking-widest text-[#FF4500] uppercase font-mono">// WORKSPACE_INDEX</span>
                <h2 className="text-4xl text-[#F5E8D8] font-normal" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Pre-Compiled Index Files
                </h2>
                <p className="text-sm sm:text-base text-[#F5E8D8]/90 leading-relaxed font-sans font-light">
                  Load preset repositories containing pre-built AST dependency arrays. These indexing assets are static and bypass immediate server cloning queues.
                </p>
              </div>

              <div className="xl:col-span-7 bg-black border border-[#F5E8D8]/15 rounded-md overflow-hidden w-full shadow-xl shadow-[#FF4500]/20 hover:border-[#FF4500]/50 transition-colors duration-500">
                <div className="flex items-center justify-between border-b border-[#F5E8D8]/10 px-6 py-4 text-xs text-[#F5E8D8]/70 bg-black/60">
                  <span>DIRECTORY: /repomind/presets/</span>
                  <span>COUNT: {PRESET_REPOS.length} ASSETS</span>
                </div>
                <div className="divide-y divide-[#F5E8D8]/10">
                  {PRESET_REPOS.map((preset) => (
                    <motion.div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 111, 97, 0.08)' }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-6 cursor-pointer transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <GitBranch size={14} className="text-[#DAA520] group-hover:text-[#F5E8D8] transition-colors" />
                          <span className="text-sm text-white group-hover:text-[#FF4500] transition-colors">{preset.name}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-[#F5E8D8]/60 font-mono">
                          <span>LANG: {preset.language}</span>
                          <span>FILES: {preset.files}</span>
                          <span>SIZE: {preset.size}</span>
                        </div>
                      </div>
                      
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-white border border-[#F5E8D8]/30 px-5 py-2.5 bg-[#FF4500] hover:bg-[#FF4500]/80 mt-4 sm:mt-0 flex items-center gap-2 w-fit transition-all shadow-md hover:shadow-[#FF4500]/50 shadow-[#FF4500]/30 font-semibold rounded-md"
                      >
                        MOUNT INDEX <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </motion.section>

      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 border-t border-[#F5E8D8]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#F5E8D8]/60 font-mono">
        <div>
          © 2026 REPOMIND_ENGINE // INTEGRITY: NOMINAL
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">PRIVACY_POLICY</a>
          <a href="#" className="hover:text-white transition-colors">TERMS_OF_SERVICE</a>
          <a href="#" className="hover:text-white transition-colors">DOCS_IO</a>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
