export type Point = readonly [number, number];

export class Box {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
  ) {}

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  get l(): Point {
    return [this.x, this.cy];
  }
  get r(): Point {
    return [this.x + this.w, this.cy];
  }
  get t(): Point {
    return [this.cx, this.y];
  }
  get b(): Point {
    return [this.cx, this.y + this.h];
  }
  get bottom(): number {
    return this.y + this.h;
  }
  get right(): number {
    return this.x + this.w;
  }
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function samePoint(a: Point, b: Point, eps = 0.5): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export function fmt(n: number): string {
  return n.toFixed(1);
}
