"use client";

import { useEffect, useRef } from "react";
import { buildScalpBaseline, hashBotSeed } from "@/lib/bot-chart-seed";

interface BotScalpChartProps {
  botId: string;
  className?: string;
}

export function BotScalpChart({ botId, className }: BotScalpChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baselineRef = useRef<number[]>([]);
  const seedRef = useRef(hashBotSeed(botId));

  useEffect(() => {
    baselineRef.current = buildScalpBaseline(botId);
    seedRef.current = hashBotSeed(botId);
  }, [botId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const draw = () => {
      frame += 1;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const baseline = baselineRef.current;
      const count = baseline.length;
      if (count < 2) return;

      const offset = (frame * 0.35 + seedRef.current % 100) % 1;
      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const wiggle =
          Math.sin(frame * 0.08 + i * 0.55 + seedRef.current) * 0.012 +
          Math.cos(frame * 0.05 + i * 0.3) * 0.008;
        const base = baseline[i];
        const y = Math.max(0.06, Math.min(0.94, base + wiggle));
        points.push({ x: t * w, y: (1 - y) * h });
      }

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const gy = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Scalp candles
      const barW = Math.max(2, w / count - 1);
      for (let i = 1; i < count; i++) {
        const up = points[i].y <= points[i - 1].y;
        const x = points[i].x - barW / 2;
        const top = Math.min(points[i].y, points[i - 1].y);
        const bottom = Math.max(points[i].y, points[i - 1].y);
        const bodyH = Math.max(2, bottom - top);
        ctx.fillStyle = up
          ? "rgba(52, 211, 153, 0.55)"
          : "rgba(248, 113, 113, 0.45)";
        ctx.fillRect(x, top, barW, bodyH);
      }

      // Trend line
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(251, 191, 36, 0.15)");
      grad.addColorStop(1, "rgba(251, 191, 36, 0.85)");

      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Area fill
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
      areaGrad.addColorStop(0, "rgba(251, 191, 36, 0.12)");
      areaGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Live pulse dot
      const pulse = points[points.length - 1];
      const pulseR = 3 + Math.sin(frame * 0.12) * 0.8;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, pulseR + 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.25)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = "#34d399";
      ctx.fill();

      // Scrolling scan line
      const scanX = ((frame * 1.2 + offset * w) % (w + 40)) - 20;
      ctx.strokeStyle = "rgba(251, 191, 36, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, h);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [botId]);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live scalping
        </span>
        <span>3% daily target</span>
      </div>
      <canvas
        ref={canvasRef}
        className="h-20 w-full rounded-lg bg-black/50"
        aria-hidden
      />
    </div>
  );
}
