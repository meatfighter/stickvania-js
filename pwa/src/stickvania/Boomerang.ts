import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Boomerang extends Thing {
    public static readonly STATE_FOWARD: number = 0;
    public static readonly STATE_REVERSING: number = 1;
    public static readonly STATE_REVERSE: number = 2;
    public static readonly G: number = -0.13988657844990548204158790170132;
    public direction: number = 0;
    public state: number = 0;
    public angle: number = 0;
    public g: number = 0;
    public soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.state = Boomerang.STATE_FOWARD;
        this.vx = direction == Main.RIGHT ? 3 : -3;
        this.g = direction == Main.RIGHT ? Boomerang.G : -Boomerang.G;
    }

    public update(gc: GameContainer): boolean {
        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 20;
            this.main.playSound(this.main.spinning);
        }

        switch (this.state) {
            case Boomerang.STATE_FOWARD:
                if (this.direction == Main.RIGHT) {
                    this.x += 3;
                    this.angle += 3;
                    if (this.x >= this.main.camera + 448) {
                        this.state = Boomerang.STATE_REVERSING;
                    }
                } else {
                    this.x -= 3;
                    this.angle -= 3;
                    if (this.x <= this.main.camera + 32) {
                        this.state = Boomerang.STATE_REVERSING;
                    }
                }
                break;
            case Boomerang.STATE_REVERSING:
                this.vx += this.g;
                this.x += this.vx;
                this.angle += this.vx;
                if (Math.abs(this.vx) >= 3) {
                    this.state = Boomerang.STATE_REVERSE;
                }
                break;
            case Boomerang.STATE_REVERSE:
                if (this.direction == Main.RIGHT) {
                    this.x -= 3;
                    this.angle -= 3;
                } else {
                    this.x += 3;
                    this.angle += 3;
                }
                if (this.main.intersectsSimon(this)) {
                    return false;
                }
                break;
        }
        if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576) {
            return false;
        }
        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.boomerang, this.x, this.y, this.angle);
    }
}
