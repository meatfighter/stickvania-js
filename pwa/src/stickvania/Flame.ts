import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Flame extends Thing {
    private static readonly STATE_HIDDEN: number = 0;
    private static readonly STATE_FLAME_UP: number = 1;
    private static readonly STATE_FLAMING: number = 2;
    private static readonly STATE_FLAME_DOWN: number = 3;
    private g: number = 0;
    private appearanceDelay: number = 0;
    private lifetime: number = 0;
    private state: number = Flame.STATE_HIDDEN;
    private spriteIndex: number = 0;
    private delay: number = 5;
    public constructor(main: Main, x: number, y: number, vx: number, vy: number, g: number, appearanceDelay: number, lifetime: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.g = g;
        this.appearanceDelay = appearanceDelay;
        this.lifetime = lifetime;

        if (appearanceDelay == 0) {
            this.state = Flame.STATE_FLAME_UP;
        }
    }

    public update(gc: GameContainer): boolean {
        if (this.state != Flame.STATE_HIDDEN) {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.g;
        }

        switch (this.state) {
            case Flame.STATE_HIDDEN:
                if (--this.appearanceDelay <= 0) {
                    this.state = Flame.STATE_FLAME_UP;
                    this.spriteIndex = 0;
                    this.delay = 5;
                }
                break;
            case Flame.STATE_FLAME_UP:
                if (--this.delay == 0) {
                    this.delay = 5;
                    this.spriteIndex++;
                    if (this.spriteIndex == 3) {
                        this.state = Flame.STATE_FLAMING;
                        this.delay = 5;
                    }
                }
                break;
            case Flame.STATE_FLAMING:
                if (--this.lifetime == 0) {
                    this.spriteIndex = 3;
                    this.state = Flame.STATE_FLAME_DOWN;
                    this.delay = 5;
                } else {
                    if (--this.delay == 0) {
                        this.spriteIndex = this.spriteIndex == 3 ? 4 : 3;
                        this.delay = 5;
                    }
                }
                break;
            case Flame.STATE_FLAME_DOWN:
                if (--this.delay == 0) {
                    this.delay = 5;
                    this.spriteIndex--;
                    if (this.spriteIndex == -1) {
                        this.spriteIndex = 0;
                        return false;
                    }
                }
                break;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.state != Flame.STATE_HIDDEN) {
            this.main.draw(this.main.fires[this.spriteIndex], this.x, this.y);
        }
    }
}
