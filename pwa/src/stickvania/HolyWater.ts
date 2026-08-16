import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class HolyWater extends Thing {
    public static readonly STATE_DROPPING: number = 0;
    public static readonly STATE_FIRE: number = 1;
    public direction: number = 0;
    public state: number = 0;
    public cycle: number = 0;
    public spriteIndex: number = 0;
    public delay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        super(main, 32, 27);
        this.x = x;
        this.y = y;
        this.vx = direction == Main.RIGHT ? 3 : -3;
        this.vy = -1.5;
        this.direction = direction;
        this.state = HolyWater.STATE_DROPPING;
        main.playSound(main.threw_dagger);

    }
    public update(gc: GameContainer): boolean {
        if (this.state == HolyWater.STATE_DROPPING) {
            this.applyGravity();
            if (this.supported || !this.moveX(this.vx) || this.intersected) {
                this.y -= 5;
                this.rx1 = 0;
                this.ry1 = 0;
                this.rx2 = 31;
                this.ry2 = 31;
                this.state = HolyWater.STATE_FIRE;
                this.main.playSound(this.main.used_holy_water);
            }
        } else {
            if (++this.delay == 15) {
                this.delay = 0;
                this.spriteIndex++;
                if (this.spriteIndex == 5) {
                    this.spriteIndex = 0;
                    this.cycle++;
                    if (this.cycle == 2) {
                        return false;
                    }
                }
            }
        }

        if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576 || this.y > 352) {
            return false;
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        if (this.state == HolyWater.STATE_DROPPING) {
            this.main.draw(this.main.holyWaters[this.direction], this.x, this.y);
        } else {
            this.main.draw(this.main.fires[this.spriteIndex], this.x, this.y);
        }

    }
}
