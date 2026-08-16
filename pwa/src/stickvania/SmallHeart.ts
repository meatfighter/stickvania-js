import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class SmallHeart extends Thing {
    public static readonly FRACTION: number = 1 / 91;
    public X: number = 0;
    public angle: number = 0;
    public lifeTime: number = 728;
    public constructor(main: Main, x: number, y: number) {
        super(main, 16, 16);

        this.x = this.X = x;
        this.y = y;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsSimon(trunc(this.x), trunc(this.y), 15 + trunc(this.x), 15 + trunc(this.y))) {
            this.main.addHearts(1);
            this.main.playSound(this.main.bleep);
            return false;
        }

        this.supported = false;

        let targetY: number = this.y + 0.5;

        let y1: number = trunc(this.y + this.ry2);
        let y2: number = trunc(targetY + this.ry2);

        let x1: number = trunc(this.x + this.rx1);
        let x2: number = trunc(this.x + this.rx2);

        for (let i: number = y1; i <= y2; i++) {
            for (let j: number = x1; j <= x2; j += 4) {
                if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
                    this.y = i - this.ry2;
                    this.vy = 0;
                    this.supported = true;

                    if (--this.lifeTime == 0) {
                        return false;
                    }

                    return true;
                }
            }
        }

        this.y = targetY;

        let targetX: number = this.X + 32 * FastTrig.sin(this.angle);
        if (this.moveX(targetX - this.x)) {
            this.angle += 0.03;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.lifeTime > 90) {
            this.main.draw(this.main.smallHeart, this.x, this.y);
        } else {
            this.main.drawFaded(this.main.smallHeart, this.x, this.y, this.lifeTime * SmallHeart.FRACTION);
        }
    }
}
