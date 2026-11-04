type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  color: string;
};

export class ParticleField {
  private particles: Particle[] = [];
  private frame = 0;
  private lastTime = 0;
  private context: CanvasRenderingContext2D | null;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  burst(x: number, y: number, color: string, amount = 10) {
    const count = this.reducedMotion ? Math.min(amount, 3) : amount;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 180;
      const life = 0.4 + Math.random() * 0.45;
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70,
        size: 3 + Math.random() * 5, rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12, life, maxLife: life, color,
      });
    }
    if (!this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    const context = this.context;
    if (!context) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.035);
    this.lastTime = now;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 380 * dt;
      particle.vx *= 0.99;
      particle.rotation += particle.spin * dt;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      context.restore();
    }
    if (this.particles.length) this.frame = requestAnimationFrame(this.tick);
    else this.frame = 0;
  };

  destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    this.particles = [];
    this.context?.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}