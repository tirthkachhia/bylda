import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
};

type Spark = {
  from: number;
  to: number;
  progress: number;
  speed: number;
  alpha: number;
};

const COLORS = ["#38bdf8", "#7dd3fc", "#0ea5e9", "#22d3ee", "#60a5fa"];

export function NeuralCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let nodes: Node[] = [];
    let sparks: Spark[] = [];
    const MAX_DIST = 160;
    const NODE_COUNT = 42;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      init();
    };

    const init = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 2 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.4 + Math.random() * 0.6,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      }));
      sparks = [];
    };

    let frame = 0;

    const tick = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      frame++;

      // Spawn sparks occasionally
      if (frame % 18 === 0 && nodes.length > 1) {
        const from = Math.floor(Math.random() * nodes.length);
        let to = Math.floor(Math.random() * nodes.length);
        if (to === from) to = (to + 1) % nodes.length;
        const n1 = nodes[from],
          n2 = nodes[to];
        const dx = n2.x - n1.x,
          dy = n2.y - n1.y;
        if (Math.sqrt(dx * dx + dy * dy) < MAX_DIST * 1.5) {
          sparks.push({ from, to, progress: 0, speed: 0.012 + Math.random() * 0.016, alpha: 0.9 });
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i],
            n2 = nodes[j];
          const dx = n2.x - n1.x,
            dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DIST) continue;

          const alpha = (1 - dist / MAX_DIST) * 0.25;
          const grad = ctx.createLinearGradient(n1.x, n1.y, n2.x, n2.y);
          grad.addColorStop(
            0,
            `${n1.color}${Math.round(alpha * 255)
              .toString(16)
              .padStart(2, "0")}`,
          );
          grad.addColorStop(
            1,
            `${n2.color}${Math.round(alpha * 255)
              .toString(16)
              .padStart(2, "0")}`,
          );

          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Draw sparks
      sparks = sparks.filter((s) => {
        const n1 = nodes[s.from],
          n2 = nodes[s.to];
        const x = n1.x + (n2.x - n1.x) * s.progress;
        const y = n1.y + (n2.y - n1.y) * s.progress;

        ctx.save();
        ctx.globalAlpha = s.alpha * (1 - s.progress);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = n1.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = n1.color;
        ctx.fill();
        ctx.restore();

        s.progress += s.speed;
        return s.progress < 1;
      });

      // Draw nodes
      nodes.forEach((n) => {
        n.pulsePhase += n.pulseSpeed;
        const pulse = 0.7 + 0.3 * Math.sin(n.pulsePhase);
        const alpha = n.alpha * pulse;

        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 16;
        ctx.shadowColor = n.color;
        ctx.fill();
        ctx.restore();

        // Move
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = W + 10;
        if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10;
        if (n.y > H + 10) n.y = -10;
      });

      animId = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
