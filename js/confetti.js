// One short burst of confetti and paw prints when a lesson ends.
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.append(c);
  const ctx = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--eye', '--iris', '--good', '--ear', '--beret'].map((v) => css.getPropertyValue(v).trim() || '#f7c548');
  const parts = Array.from({ length: 110 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 16 * dpr, vy: (-Math.random() * 14 - 6) * dpr,
    r: (4 + Math.random() * 5) * dpr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() < 0.2 ? 'paw' : 'rect',
  }));
  const start = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.45 * dpr; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      if (p.shape === 'paw') {
        ctx.beginPath(); ctx.ellipse(0, p.r * 0.4, p.r, p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        [-0.9, -0.3, 0.3, 0.9].forEach((dx) => { ctx.beginPath(); ctx.arc(dx * p.r, -p.r * 0.7, p.r * 0.35, 0, Math.PI * 2); ctx.fill(); });
      } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (t - start < 2600) requestAnimationFrame(frame); else c.remove();
  })(start);
}
