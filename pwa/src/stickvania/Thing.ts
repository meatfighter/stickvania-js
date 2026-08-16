import { GameContainer, Graphics } from "slick2d-ts";
import { trunc } from "./JavaMath.js";
import type { Main } from "./Main.js";

const DEFAULT_GRAVITY = 0.21;
const WALL_EMPTY = 0;
const WALL_PLATFORM = 1;

export abstract class Thing {
    public main: Main = null;
    public x: number = 0;
    public y: number = 0;
    public vx: number = 0;
    public vy: number = 0;
    public rx1: number = 0;
    public ry1: number = 0;
    public rx2: number = 0;
    public ry2: number = 0;
    public supported: boolean = false;
    public intersected: boolean = false;
    public kill: boolean = false;
    public G: number = DEFAULT_GRAVITY;
    public constructor(main: Main, a?: number, b?: number, c?: number, d?: number) {
        this.main = main;
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
            this.rx1 = a;
            this.ry1 = b;
            this.rx2 = a + c - 1;
            this.ry2 = b + d - 1;
        } else if (a !== undefined && b !== undefined) {
            this.rx2 = a - 1;
            this.ry2 = b - 1;
        }
    }

    public abstract render(gc: GameContainer, g: Graphics): void;
    public abstract update(gc: GameContainer): boolean;
    public moveY(dy: number): boolean {
        this.supported = false;

        let targetY: number = this.y + dy;

        let y1: number = trunc(this.y + this.ry2);
        let y2: number = trunc(targetY + this.ry2);

        let x1: number = trunc(this.x + this.rx1);
        let x2: number = trunc(this.x + this.rx2);

        if (this.vy >= 0) {
            for (let i: number = y1; i <= y2; i++) {
                for (let j: number = x1; j <= x2; j += 32) {
                    if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
                        this.y = i - this.ry2;
                        this.supported = true;
                        return false;
                    }
                }
                if (this.main.isEmpty(x2, i) && this.main.isSupportive(x2, i + 1)) {
                    this.y = i - this.ry2;
                    this.supported = true;
                    return false;
                }
            }
        } else {
            for (let i: number = y1; i >= y2; i--) {
                for (let j: number = x1; j <= x2; j += 32) {
                    let Y: number = i - this.ry2;
                    if (this.main.isEmpty(j, Y) && this.main.isSolid(j, Y - 1)) {
                        this.y = Y;
                        return false;
                    }
                }
                let Y: number = i - this.ry2;
                if (this.main.isEmpty(x2, Y) && this.main.isSolid(x2, Y - 1)) {
                    this.y = Y;
                    return false;
                }
            }
        }

        this.y = targetY;
        return true;
    }

    public moveX(dx: number): boolean {
        let y1: number = trunc(this.y + this.ry1);
        let y2: number = trunc(this.y + this.ry2);

        if (dx < 0) {
            let x1: number = trunc(this.x + this.rx1);
            let x2: number = trunc(this.x + this.rx1 + dx);

            for (let j: number = x1; j >= x2; j--) {
                for (let i: number = y1; i <= y2; i += 32) {
                    let a: number = this.main.getWall(j, i);
                    let b: number = this.main.getWall(j - 1, i);
                    if (!((a == WALL_EMPTY && b == WALL_EMPTY) || (a == WALL_PLATFORM && (b == WALL_EMPTY || b == WALL_PLATFORM)))) {
                        this.x = j - this.rx1;
                        return false;
                    }
                }
                let a: number = this.main.getWall(j, y2);
                let b: number = this.main.getWall(j - 1, y2);
                if (!((a == WALL_EMPTY && b == WALL_EMPTY) || (a == WALL_PLATFORM && (b == WALL_EMPTY || b == WALL_PLATFORM)))) {
                    this.x = j - this.rx1;
                    return false;
                }
            }

            this.x += dx;

            if (this.x + this.rx1 <= this.main.simon.xMin) {
                this.x = this.main.simon.xMin - this.rx1;
                return false;
            }
        } else {
            let x1: number = trunc(this.x + this.rx2);
            let x2: number = trunc(this.x + this.rx2 + dx);

            for (let j: number = x1; j <= x2; j++) {
                for (let i: number = y1; i <= y2; i += 32) {
                    let a: number = this.main.getWall(j, i);
                    let b: number = this.main.getWall(j + 1, i);
                    if (!((a == WALL_EMPTY && b == WALL_EMPTY) || (a == WALL_PLATFORM && (b == WALL_EMPTY || b == WALL_PLATFORM)))) {
                        this.x = j - this.rx2;
                        return false;
                    }
                }
                let a: number = this.main.getWall(j, y2);
                let b: number = this.main.getWall(j + 1, y2);
                if (!((a == WALL_EMPTY && b == WALL_EMPTY) || (a == WALL_PLATFORM && (b == WALL_EMPTY || b == WALL_PLATFORM)))) {
                    this.x = j - this.rx2;
                    return false;
                }
            }

            this.x += dx;

            if (this.x + this.rx2 >= this.main.simon.xMax) {
                this.x = this.main.simon.xMax - this.rx2;
                return false;
            }
        }

        return true;
    }

    public applyGravityWithPlatforms(): void {
        this.supported = false;

        let targetY: number = this.y + this.vy;

        let y1: number = trunc(this.y + this.ry2);
        let y2: number = trunc(targetY + this.ry2);

        let x1: number = trunc(this.x + this.rx1);
        let x2: number = trunc(this.x + this.rx2);

        this.vy += this.G;
        if (this.vy >= 0) {
            for (let i: number = y1; i <= y2; i++) {
                for (let j: number = x1; j <= x2; j += 32) {
                    if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
                        this.y = i - this.ry2;
                        this.vy = 0;
                        this.supported = true;
                        return;
                    }
                }
                if (this.main.isEmpty(x2, i) && this.main.isSupportive(x2, i + 1)) {
                    this.y = i - this.ry2;
                    this.vy = 0;
                    this.supported = true;
                    return;
                }

                for (let j: number = x1; j <= x2; j += 32) {
                    let platform: Thing = this.main.findPlatform(j, i + 1);
                    if (platform != null && this.main.isEmpty(j, i)) {
                        this.moveX(platform.vx);
                        this.y = i - this.ry2;
                        this.vy = 0;
                        this.supported = true;
                        return;
                    }
                }

                let platform: Thing = this.main.findPlatform(x2, i + 1);
                if (platform != null && this.main.isEmpty(x2, i)) {
                    this.moveX(platform.vx);
                    this.y = i - this.ry2;
                    this.vy = 0;
                    this.supported = true;
                    return;
                }
            }
        } else {
            for (let i: number = y1; i >= y2; i--) {
                for (let j: number = x1; j <= x2; j += 32) {
                    let Y: number = i - this.ry2;
                    if (this.main.isEmpty(j, Y) && this.main.isSolid(j, Y - 1)) {
                        this.y = Y;
                        this.vy = 0;
                        return;
                    }
                }
                let Y: number = i - this.ry2;
                if (this.main.isEmpty(x2, Y) && this.main.isSolid(x2, Y - 1)) {
                    this.y = Y;
                    this.vy = 0;
                    return;
                }
            }
        }

        this.y = targetY;
    }

    public applyGravity(): void {
        this.supported = false;

        let targetY: number = this.y + this.vy;

        let y1: number = trunc(this.y + this.ry2);
        let y2: number = trunc(targetY + this.ry2);

        let x1: number = trunc(this.x + this.rx1);
        let x2: number = trunc(this.x + this.rx2);

        this.vy += this.G;
        if (this.vy >= 0) {
            for (let i: number = y1; i <= y2; i++) {
                for (let j: number = x1; j <= x2; j += 32) {
                    if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
                        this.y = i - this.ry2;
                        this.vy = 0;
                        this.supported = true;
                        return;
                    }
                }
                if (this.main.isEmpty(x2, i) && this.main.isSupportive(x2, i + 1)) {
                    this.y = i - this.ry2;
                    this.vy = 0;
                    this.supported = true;
                    return;
                }
            }
        } else {
            for (let i: number = y1; i >= y2; i--) {
                for (let j: number = x1; j <= x2; j += 32) {
                    let Y: number = i - this.ry2;
                    if (this.main.isEmpty(j, Y) && this.main.isSolid(j, Y - 1)) {
                        this.y = Y;
                        this.vy = 0;
                        return;
                    }
                }
                let Y: number = i - this.ry2;
                if (this.main.isEmpty(x2, Y) && this.main.isSolid(x2, Y - 1)) {
                    this.y = Y;
                    this.vy = 0;
                    return;
                }
            }
        }

        this.y = targetY;
    }
}
