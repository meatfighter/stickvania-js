import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { DropItem } from "./DropItem.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";
import { prepareStopWatchMusicHoldAfterRestore, reconcileStopWatchMusic } from "./StopWatchMusicHold.js";

export class StopWatch extends Thing {
    public static readonly FRACTION: number = javaFloat(1 / 91);
    public static readonly ANGLE1: number = javaFloat((2 * Math.PI) / 3);
    public static readonly ANGLE2: number = javaFloat((4 * Math.PI) / 3);
    public lifeTime: number = 455;
    private angle: number = javaFloat(0);
    private sx0: number = javaFloat(0);
    private sy0: number = javaFloat(0);
    private sx1: number = javaFloat(0);
    private sy1: number = javaFloat(0);
    private sx2: number = javaFloat(0);
    private sy2: number = javaFloat(0);
    private soundDelay: number = 0;
    public constructor(main: Main) {
        super(main, 0, -10000, 32, 32);
        main.timeFrozen += 455;
        reconcileStopWatchMusic(main);
    }

    private isTerminalGameplayState(): boolean {
        return this.main.playerPower == 0 || this.main.simon?.dead != 0 || this.main.beatStageFlag;
    }

    public override update(gc: GameContainer): boolean {
        // Region Things have already completed for this tick. Ending the watch
        // here keeps the lethal/stage-complete frame internally consistent while
        // allowing unrelated sub-weapons to continue through the weapon pass.
        if (this.isTerminalGameplayState()) {
            this.cancel();
            return false;
        }

        if (this.lifeTime > 0) {
            // Adopt any music-owner change made earlier in this simulation tick
            // before this watch consumes its final contribution.
            reconcileStopWatchMusic(this.main);
            this.lifeTime--;
            this.main.timeFrozen = Math.max(0, this.main.timeFrozen - 1);
            reconcileStopWatchMusic(this.main);
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

        this.x = javaFloat(this.main.simon!.x + 16);
        this.y = javaFloat(this.main.simon!.y - 48);

        this.angle = javaFloat(this.angle + 0.05);
        this.sx0 = javaFloat(this.x + javaFloat(16 * javaFloat(FastTrig.cos(this.angle))));
        this.sy0 = javaFloat(this.y + javaFloat(16 * javaFloat(FastTrig.sin(this.angle))));
        this.sx1 = javaFloat(this.x + javaFloat(16 * javaFloat(FastTrig.cos(javaFloat(this.angle + StopWatch.ANGLE1)))));
        this.sy1 = javaFloat(this.y + javaFloat(16 * javaFloat(FastTrig.sin(javaFloat(this.angle + StopWatch.ANGLE1)))));
        this.sx2 = javaFloat(this.x + javaFloat(16 * javaFloat(FastTrig.cos(javaFloat(this.angle + StopWatch.ANGLE2)))));
        this.sy2 = javaFloat(this.y + javaFloat(16 * javaFloat(FastTrig.sin(javaFloat(this.angle + StopWatch.ANGLE2)))));

        return true;
    }

    public cancel(): void {
        if (this.lifeTime <= 0) {
            return;
        }
        this.main.timeFrozen = Math.max(0, this.main.timeFrozen - this.lifeTime);
        this.lifeTime = 0;
        reconcileStopWatchMusic(this.main);
    }

    public restoreRuntimeStateAfterStateLoad(): void {
        if (this.isTerminalGameplayState()) {
            this.cancel();
        } else {
            prepareStopWatchMusicHoldAfterRestore(this.main);
        }
    }

    public override onDiscarded(): void {
        this.cancel();
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.lifeTime > 90) {
            this.main.draw(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y);
            this.main.draw(this.main.spark, this.sx0, this.sy0);
            this.main.draw(this.main.spark, this.sx1, this.sy1);
            this.main.draw(this.main.spark, this.sx2, this.sy2);
        } else {
            let fade: number = javaFloat(this.lifeTime * StopWatch.FRACTION);
            this.main.drawFaded(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y, fade);
            this.main.drawFaded(this.main.spark, this.sx0, this.sy0, fade);
            this.main.drawFaded(this.main.spark, this.sx1, this.sy1, fade);
            this.main.drawFaded(this.main.spark, this.sx2, this.sy2, fade);
        }
    }
}
