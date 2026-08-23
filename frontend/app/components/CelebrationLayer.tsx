import { useEffect, useRef, useState } from "react";

import type { Celebration, Intensity } from "~/lib/celebrate";
import { onCelebrate } from "~/lib/celebrate";

import { Icon, type IconName } from "./Icon";

const SETTINGS: Record<Intensity, { count: number; life: number; spread: number; hold: number }> = {
  spark: { count: 22, life: 900, spread: 3.2, hold: 2600 },
  bronze: { count: 60, life: 1500, spread: 5, hold: 4200 },
  silver: { count: 110, life: 1900, spread: 6.5, hold: 4600 },
  gold: { count: 190, life: 2400, spread: 8, hold: 5200 },
};

// The chart palette, so a celebration still looks like this app.
const COLOURS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vr: number;
  colour: string; square: boolean; born: number; life: number;
}

export function CelebrationLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef<number>(0);
  const [current, setCurrent] = useState<Celebration | null>(null);
  // Several can be earned at once — on a first run, eight of them. Queue and
  // show one at a time, or they collapse into a single unreadable flash.
  const queue = useRef<Celebration[]>([]);
  const showing = useRef(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const present = (item: Celebration) => {
      showing.current = true;
      setCurrent(item);
      const config = SETTINGS[item.intensity];

      window.setTimeout(() => {
        setCurrent((now) => (now?.id === item.id ? null : now));
        showing.current = false;
        const next = queue.current.shift();
        // A beat of quiet between them, so each one registers.
        if (next) window.setTimeout(() => present(next), 320);
      }, config.hold);

      // Reduced motion still gets the news, just not the fireworks.
      if (reduced) return;
      burst(item, config);
    };

    return onCelebrate((item) => {
      if (showing.current) {
        queue.current.push(item);
        return;
      }
      present(item);
    });
  }, []);

  const burst = (item: Celebration, config: (typeof SETTINGS)[Intensity]) => {
    {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.width = window.innerWidth;
      const height = canvas.height = window.innerHeight;
      const originX = width / 2;
      const originY = item.intensity === "spark" ? height - 120 : height * 0.38;
      const now = performance.now();

      for (let i = 0; i < config.count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * config.spread + 1.2;
        particles.current.push({
          x: originX + (Math.random() - 0.5) * 140,
          y: originY + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.4,
          size: Math.random() * 5 + 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
          square: Math.random() > 0.45,
          born: now,
          life: config.life + Math.random() * 500,
        });
      }
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    }
  };

  const tick = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      frame.current = 0;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.current = particles.current.filter((p) => time - p.born < p.life);
    for (const p of particles.current) {
      const age = (time - p.born) / p.life;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.14;          // gravity
      p.vx *= 0.995;
      p.rot += p.vr;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age * age);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.colour;
      if (p.square) {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        // a four-point sparkle
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (Math.PI / 2) * i;
          ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * p.size * 0.32, Math.sin(a + Math.PI / 4) * p.size * 0.32);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.current.length > 0) {
      frame.current = requestAnimationFrame(tick);
    } else {
      frame.current = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />
      {current ? (
        <div
          className={`celebration-toast tier-${current.intensity}`}
          role="status"
          aria-live="polite"
          key={current.id}
        >
          {current.flavour ? (
            <span className="ct-badge">
              <Icon name={(current.icon as IconName) ?? "star"} size={18} />
            </span>
          ) : (
            <span className="ct-badge small">
              <Icon name="check" size={15} />
            </span>
          )}
          <span className="ct-body">
            {current.flavour ? <span className="ct-eyebrow">Unlocked</span> : null}
            <strong>{current.title}</strong>
            {current.flavour ? <span className="ct-flavour">{current.flavour}</span> : null}
          </span>
        </div>
      ) : null}
    </>
  );
}
