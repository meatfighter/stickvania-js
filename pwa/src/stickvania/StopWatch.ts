import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { DropItem } from "./DropItem.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class StopWatch extends Thing {
    public static readonly FRACTION: number = 1 / 91;
    public static readonly ANGLE1: number = (2 * Math.PI) / 3;
    public static readonly ANGLE2: number = (4 * Math.PI) / 3;
    public lifeTime: number = 455;
    private angle: number = 0;
    private sx0: number = 0;
    private sy0: number = 0;
    private sx1: number = 0;
    private sy1: number = 0;
    private sx2: number = 0;
    private sy2: number = 0;
    private soundDelay: number = 0;
    public constructor(main: Main) {
        super(main, 0, -10000, 32, 32);
        main.timeFrozen += 455;
    }

    public update(gc: GameContainer): boolean {
        if (this.lifeTime > 0) {
            this.lifeTime--;
            this.main.timeFrozen--;
        } else {
            return false;
        }

        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 68;
            this.main.playSound(this.main.watch_tick);
            this.main.playRumble("stopwatch");
        }

        this.x = this.main.simon.x + 16;
        this.y = this.main.simon.y - 48;

        this.angle += 0.05;
        this.sx0 = this.x + 16 * FastTrig.cos(this.angle);
        this.sy0 = this.y + 16 * FastTrig.sin(this.angle);
        this.sx1 = this.x + 16 * FastTrig.cos(this.angle + StopWatch.ANGLE1);
        this.sy1 = this.y + 16 * FastTrig.sin(this.angle + StopWatch.ANGLE1);
        this.sx2 = this.x + 16 * FastTrig.cos(this.angle + StopWatch.ANGLE2);
        this.sy2 = this.y + 16 * FastTrig.sin(this.angle + StopWatch.ANGLE2);

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.lifeTime > 90) {
            this.main.draw(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y);
            this.main.draw(this.main.spark, this.sx0, this.sy0);
            this.main.draw(this.main.spark, this.sx1, this.sy1);
            this.main.draw(this.main.spark, this.sx2, this.sy2);
        } else {
            let fade: number = this.lifeTime * StopWatch.FRACTION;
            this.main.drawFaded(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y, fade);
            this.main.drawFaded(this.main.spark, this.sx0, this.sy0, fade);
            this.main.drawFaded(this.main.spark, this.sx1, this.sy1, fade);
            this.main.drawFaded(this.main.spark, this.sx2, this.sy2, fade);
        }
    }
}
