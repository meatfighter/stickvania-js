import { PIT_DESPAWN_Y } from "./PitLifecycle.js";
import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class SmallHeart extends Thing {
    public static readonly FRACTION: number = javaFloat(1 / 91);
    public X: number = 0;
    public angle: number = 0;
    public lifeTime: number = 728;
    public constructor(main: Main, x: number, y: number) {
        super(main, 16, 16);

        this.x = javaFloat((this.X = x));
        this.y = javaFloat(y);
    }

    public override update(gc: GameContainer): boolean {
        if (this.y > PIT_DESPAWN_Y) {
            return false;
        }
        if (this.main.intersectsSimon(trunc(this.x), trunc(this.y), 15 + trunc(this.x), 15 + trunc(this.y))) {
            this.main.addHearts(1);
            this.main.playSound(this.main.bleep);
            return false;
        }

        let wasSupported: boolean = this.supported;
        this.supported = false;

        let targetY: number = javaFloat(this.y + 0.5);

        let y1: number = trunc(javaFloat(this.y + this.ry2));
        let y2: number = trunc(javaFloat(targetY + this.ry2));

        let x1: number = trunc(javaFloat(this.x + this.rx1));
        let x2: number = trunc(javaFloat(this.x + this.rx2));

        for (let i: number = y1; i <= y2; i++) {
            for (let j: number = x1; j <= x2; j += 4) {
                if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
                    this.y = javaFloat(i - this.ry2);
                    this.vy = javaFloat(0);
                    this.supported = true;
                    if (!wasSupported) {
                        this.main.playRumble("itemLand");
                    }

                    if (--this.lifeTime == 0) {
                        return false;
                    }

                    return true;
                }
            }
        }

        this.y = javaFloat(targetY);
        if (this.y > PIT_DESPAWN_Y) {
            return false;
        }

        let targetX: number = javaFloat(this.X + javaFloat(32 * javaFloat(FastTrig.sin(this.angle))));
        if (this.moveX(javaFloat(targetX - this.x))) {
            this.angle += 0.03;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.lifeTime > 90) {
            this.main.draw(this.main.smallHeart, this.x, this.y);
        } else {
            this.main.drawFaded(this.main.smallHeart, this.x, this.y, javaFloat(this.lifeTime * SmallHeart.FRACTION));
        }
    }
}
