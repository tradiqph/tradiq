"use client";

import { useEffect, useRef } from "react";

interface ConfettiBurstProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
}

const COLORS = ["#fbbf24", "#f59e0b", "#fcd34d", "#34d399", "#ffffff", "#fde68a"];

export function ConfettiBurst({ active }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * 0.35 + (Math.random() - 0.5) * 80,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -12 - 4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.25,
    }));

    let frame = 0;
    const maxFrames = 220;
    let animationId = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame += 1;
      if (frame < maxFrames) {
        animationId = requestAnimationFrame(draw);
      }
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      aria-hidden
    />
  );
}
