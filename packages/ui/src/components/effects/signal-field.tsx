"use client";

import * as React from "react";

type SignalParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

/**
 * 信号场：鼠标响应的 canvas 粒子网络。
 * 粒子缓慢漂移、近距离互连成网；指针靠近时链路点亮为 acid 色并轻微排斥粒子。
 * 性能策略：不可见（切后台 / 滚出视口）即暂停 rAF；DPR 上限 1.5；移动端粒子减半。
 * 遵守 prefers-reduced-motion（直接不渲染动画）。
 */
export function SignalField({ className, density = 16000, maxParticles = 90 }: { className?: string; density?: number; maxParticles?: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let running = false;
    let intersecting = true;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pointer = { x: -1e4, y: -1e4 };
    let particles: SignalParticle[] = [];

    const LINK_DIST = 120;
    const POINTER_DIST = 170;
    const acid = "205, 255, 77";
    const bone = "237, 238, 230";

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = width < 768;
      const count = Math.max(
        20,
        Math.min(maxParticles, Math.round((width * height) / (density * (mobile ? 2 : 1))))
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 1.3 + 0.6,
      }));
    };

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < POINTER_DIST && dist > 0.01) {
          const force = (1 - dist / POINTER_DIST) * 0.06;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // 阻尼防止指针扰动累积
        p.vx *= 0.995;
        p.vy *= 0.995;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 0.8) {
          p.vx = (p.vx / speed) * 0.8;
          p.vy = (p.vy / speed) * 0.8;
        }
      }

      // 链路
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DIST) continue;

          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const pointerDist = Math.hypot(midX - pointer.x, midY - pointer.y);
          const nearPointer = pointerDist < POINTER_DIST;
          const alpha = (1 - dist / LINK_DIST) * (nearPointer ? 0.35 : 0.1);
          ctx.strokeStyle = `rgba(${nearPointer ? acid : bone}, ${alpha})`;
          ctx.lineWidth = nearPointer ? 1 : 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 粒子
      for (const p of particles) {
        const pointerDist = Math.hypot(p.x - pointer.x, p.y - pointer.y);
        const nearPointer = pointerDist < POINTER_DIST;
        ctx.fillStyle = `rgba(${nearPointer ? acid : bone}, ${nearPointer ? 0.9 : 0.28})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };

    const onPointerLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (intersecting) start();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0]?.isIntersecting ?? true;
        if (intersecting && !document.hidden) start();
        else stop();
      },
      { rootMargin: "80px" }
    );
    observer.observe(canvas);

    resize();
    start();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, maxParticles]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
