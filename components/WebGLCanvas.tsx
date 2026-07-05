"use client";

import React, { useRef, useEffect, useState } from "react";
import { TelemetryLog } from "@/lib/db";
import { Play, Pause, RotateCw, ShieldCheck } from "lucide-react";

// Micro-matrix utility for 3D projections without gl-matrix
class Mat4 {
  static identity(): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static perspective(fovRad: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fovRad / 2);
    const rangeInv = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, (2 * near * far) * rangeInv, 0,
    ]);
  }

  static translate(m: Float32Array, x: number, y: number, z: number): Float32Array {
    const out = new Float32Array(m);
    out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
    out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
    return out;
  }

  static rotateY(m: Float32Array, rad: number): Float32Array {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const out = new Float32Array(m);
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  }

  static rotateX(m: Float32Array, rad: number): Float32Array {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const out = new Float32Array(m);
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  }
}

// Shader definitions
const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec4 a_color;
  attribute float a_size;
  
  uniform mat4 u_projectionMatrix;
  uniform mat4 u_modelViewMatrix;
  
  varying vec4 v_color;
  
  void main() {
    v_color = a_color;
    vec4 mvPosition = u_modelViewMatrix * vec4(a_position, 1.0);
    gl_Position = u_projectionMatrix * mvPosition;
    
    // Attenuate point size by depth
    gl_PointSize = a_size * (30.0 / -mvPosition.z);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec4 v_color;
  
  void main() {
    // Render circular points with soft glow
    float r = 0.0;
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    r = dot(cxy, cxy);
    if (r > 1.0) {
      discard;
    }
    
    float alpha = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

interface WebGLCanvasProps {
  latestLog: TelemetryLog | null;
}

export const WebGLCanvas: React.FC<WebGLCanvasProps> = ({ latestLog }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [activeNodesCount, setActiveNodesCount] = useState(25);

  // Orbit state
  const rotationYRef = useRef(0);
  const rotationXRef = useRef(0.2);
  const mouseIsDown = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Node telemetry modulation parameters
  const cpuLoadRef = useRef(30.0);
  const tempLoadRef = useRef(42.0);

  const isRotatingRef = useRef(isRotating);
  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    if (latestLog) {
      cpuLoadRef.current = latestLog.hardware.cpuUsage;
      tempLoadRef.current = latestLog.hardware.temperature;
    }
  }, [latestLog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
      console.error("WebGL not supported by browser context");
      return;
    }

    // High DPI adjustment via ResizeObserver on the canvas container element
    const container = canvas.parentElement;
    const resizeCanvas = () => {
      if (!container || !canvas) return;
      const displayWidth = container.clientWidth;
      const displayHeight = container.clientHeight;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(container);
    }
    resizeCanvas();

    // Create shader utility helper
    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation log:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link log:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Locate attributes and uniforms
    const aPosition = gl.getAttribLocation(program, "a_position");
    const aColor = gl.getAttribLocation(program, "a_color");
    const aSize = gl.getAttribLocation(program, "a_size");
    const uProjectionMatrix = gl.getUniformLocation(program, "u_projectionMatrix");
    const uModelViewMatrix = gl.getUniformLocation(program, "u_modelViewMatrix");

    // Build static 3D network topology data
    // 25 global edge nodes on a rotating sphere
    const nodeCount = 25;
    const nodeCoords = new Float32Array(nodeCount * 3);
    const nodeColors = new Float32Array(nodeCount * 4);
    const nodeSizes = new Float32Array(nodeCount);

    // Distribute nodes evenly on sphere using Fibonacci spiral algorithm
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < nodeCount; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      
      const radius = 3.5;
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      nodeCoords[i * 3] = x;
      nodeCoords[i * 3 + 1] = y;
      nodeCoords[i * 3 + 2] = z;

      // Color nodes: Cyan primary
      nodeColors[i * 4] = 0.0;     // R
      nodeColors[i * 4 + 1] = 0.85; // G
      nodeColors[i * 4 + 2] = 1.0;  // B
      nodeColors[i * 4 + 3] = 0.9;  // A

      nodeSizes[i] = 12.0;
    }

    // Active data packets routing along network links (particles)
    const particleCount = 120;
    const particleCoords = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 4);
    const particleSizes = new Float32Array(particleCount);

    // Structuring paths between random pairs of nodes
    interface RoutingPacket {
      fromIdx: number;
      toIdx: number;
      progress: number;
      speed: number;
      pulseRate: number;
    }

    const packets: RoutingPacket[] = [];
    for (let i = 0; i < particleCount; i++) {
      const fromIdx = Math.floor(Math.random() * nodeCount);
      let toIdx = Math.floor(Math.random() * nodeCount);
      while (toIdx === fromIdx) {
        toIdx = Math.floor(Math.random() * nodeCount);
      }
      packets.push({
        fromIdx,
        toIdx,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.012,
        pulseRate: 0.01 + Math.random() * 0.03,
      });
    }

    // Allocate buffers on GPU (Chief-level explicit memory management)
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let lastTick = Date.now();

    // Render loop closure
    const tick = () => {
      if (!canvasRef.current) return;
      const now = Date.now();
      const elapsed = (now - lastTick) / 1000;
      lastTick = now;

      // Update rotation
      if (isRotatingRef.current) {
        rotationYRef.current += 0.2 * elapsed;
      }

      // Clear color and depth buffers
      gl.clearColor(0.04, 0.06, 0.1, 1.0); // Slate Navy space
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Re-calculate projection & modelview matrices
      const aspect = canvas.width / canvas.height;
      const projMatrix = Mat4.perspective(Math.PI / 4, aspect, 0.1, 100.0);
      
      let mvMatrix = Mat4.identity();
      mvMatrix = Mat4.translate(mvMatrix, 0.0, 0.0, -10.0); // Move camera back
      mvMatrix = Mat4.rotateX(mvMatrix, rotationXRef.current);
      mvMatrix = Mat4.rotateY(mvMatrix, rotationYRef.current);

      gl.uniformMatrix4fv(uProjectionMatrix, false, projMatrix);
      gl.uniformMatrix4fv(uModelViewMatrix, false, mvMatrix);

      // 1. Modulate Node sizes/colors based on live CPU & Temp metrics
      const tempNormalized = Math.min(1.0, Math.max(0.0, (tempLoadRef.current - 40) / 25));
      const cpuNormalized = cpuLoadRef.current / 100.0;

      for (let i = 0; i < nodeCount; i++) {
        // High load causes glowing red nodes
        nodeColors[i * 4] = cpuNormalized;                 // R channel
        nodeColors[i * 4 + 1] = 0.85 * (1.0 - cpuNormalized); // G channel
        nodeColors[i * 4 + 2] = 1.0 * (1.0 - tempNormalized); // B channel
        // Pulsate sizes
        nodeSizes[i] = 12.0 + Math.sin(now / 200 + i) * (3.0 + cpuNormalized * 10);
      }

      // 2. Animate and position routed particles along lines
      for (let i = 0; i < particleCount; i++) {
        const p = packets[i];
        p.progress += p.speed * (1.0 + cpuNormalized * 2); // CPU load speeds up traffic
        if (p.progress >= 1.0) {
          p.progress = 0.0;
          p.fromIdx = p.toIdx;
          let newTo = Math.floor(Math.random() * nodeCount);
          while (newTo === p.fromIdx) {
            newTo = Math.floor(Math.random() * nodeCount);
          }
          p.toIdx = newTo;
        }

        const fx = nodeCoords[p.fromIdx * 3];
        const fy = nodeCoords[p.fromIdx * 3 + 1];
        const fz = nodeCoords[p.fromIdx * 3 + 2];

        const tx = nodeCoords[p.toIdx * 3];
        const ty = nodeCoords[p.toIdx * 3 + 1];
        const tz = nodeCoords[p.toIdx * 3 + 2];

        // Linear interpolation for particle coords
        particleCoords[i * 3] = fx + (tx - fx) * p.progress;
        particleCoords[i * 3 + 1] = fy + (ty - fy) * p.progress;
        particleCoords[i * 3 + 2] = fz + (tz - fz) * p.progress;

        // Custom theme color based on progress (green to cyan gradients)
        particleColors[i * 4] = 0.0;
        particleColors[i * 4 + 1] = 0.6 + 0.4 * Math.sin(p.progress * Math.PI);
        particleColors[i * 4 + 2] = 0.9 + 0.1 * Math.cos(p.progress * Math.PI);
        particleColors[i * 4 + 3] = 0.8 * Math.sin(p.progress * Math.PI); // Fade near nodes

        particleSizes[i] = 6.0 + Math.sin(now / 100 + i) * 2;
      }

      // 3. Render Node sphere
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, nodeCoords, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, nodeColors, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, nodeSizes, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, nodeCount);

      // 4. Render Active Packets (Particles)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleCoords, gl.DYNAMIC_DRAW);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleColors, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleSizes, gl.DYNAMIC_DRAW);

      gl.drawArrays(gl.POINTS, 0, particleCount);

      animationRef.current = requestAnimationFrame(tick);
    };

    tick();

    // Clean up to prevent WebGL GPU memory leaks
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteBuffer(sizeBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  // Orbit navigation handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseIsDown.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseIsDown.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    rotationYRef.current += deltaX * 0.005;
    rotationXRef.current += deltaY * 0.005;
    // Lock X rotation bounds
    rotationXRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotationXRef.current));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    mouseIsDown.current = false;
  };

  return (
    <div className="relative w-full h-[380px] lg:h-[450px] bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden shadow-2xl group flex flex-col justify-between" id="webgl-stage">
      {/* Absolute Canvas Background */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
      />

      {/* Top Overlay Badge Info */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none select-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-teal-500/30 w-fit shadow-lg shadow-black/40">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-teal-300">
            WebGL Telemetry Node Topology
          </span>
        </div>
        <p className="text-[10px] text-slate-400/90 font-mono pl-1 max-w-sm hidden sm:block bg-slate-950/45 p-1 rounded backdrop-blur-sm mt-1">
          Simulating high-frequency multi-node message transport. Drag sphere to orbit.
        </p>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="flex items-center justify-center p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/50 hover:border-teal-500/40 text-slate-300 transition-all duration-200 backdrop-blur-md cursor-pointer shadow-lg"
          title={isRotating ? "Pause auto-rotation" : "Resume auto-rotation"}
        >
          {isRotating ? <Pause className="w-4 h-4 text-teal-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Bottom Node Diagnostics info overlays */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        <div className="flex gap-3 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-800 shadow-xl">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">GPU Nodes</span>
            <span className="text-sm font-mono font-bold text-slate-200">25 Active</span>
          </div>
          <div className="w-px h-8 bg-slate-800 self-center" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Packet Channels</span>
            <span className="text-sm font-mono font-bold text-teal-300">120 Routes</span>
          </div>
          <div className="w-px h-8 bg-slate-800 self-center" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Engine</span>
            <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
              WebGL120<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          </div>
        </div>

        {/* Dynamic Diagnostics */}
        <div className="bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-800/80 shadow-xl hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Edge Render Frequency</span>
            <span className="text-xs font-mono font-medium text-slate-300">
              {isRotating ? "60 FPS (Continuous)" : "Paused (Static Render)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
