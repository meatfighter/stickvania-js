import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { cancelSimonAction, canSimonActionContinue } from "./PlayerActionPolicy.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Boomerang extends Thing {
    public static readonly STATE_FOWARD: number = 0;
    public static readonly STATE_REVERSING: number = 1;
    public static readonly STATE_REVERSE: number = 2;
    public static readonly G: number = javaFloat(-0.13988657844990548204158790170132);
    public direction: number = 0;
    public state: number = 0;
    public angle: number = javaFloat(0);
    public g: number = javaFloat(0);
    public soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = direction;
        this.state = Boomerang.STATE_FOWARD;
        if (!canSimonActionContinue(main)) {
            // Main.throwWeapon() performs the one-heart debit immediately after
            // construction. Keep this rejected object inert and pre-refund it.
            this.kill = true;
            this.x = javaFloat(main.camera - 10000);
            this.y = javaFloat(10000);
            main.hearts += 1;
            cancelSimonAction(main);
            return;
        }
        this.vx = javaFloat(direction == Main.RIGHT ? 3 : -3);
        this.g = javaFloat(direction == Main.RIGHT ? Boomerang.G : -Boomerang.G);
    }

    public override update(gc: GameContainer): boolean {
        if (this.kill) {
            return false;
        }
        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 20;
            this.main.playSound(this.main.spinning);
        }

        switch (this.state) {
            case Boomerang.STATE_FOWARD:
                if (this.direction == Main.RIGHT) {
                    this.x = javaFloat(this.x + 3);
                    this.angle = javaFloat(this.angle + 3);
                    if (this.x >= this.main.camera + 448) {
                        this.state = Boomerang.STATE_REVERSING;
                    }
                } else {
                    this.x = javaFloat(this.x - 3);
                    this.angle = javaFloat(this.angle - 3);
                    if (this.x <= this.main.camera + 32) {
                        this.state = Boomerang.STATE_REVERSING;
                    }
                }
                break;
            case Boomerang.STATE_REVERSING:
                this.vx = javaFloat(this.vx + this.g);
                this.x = javaFloat(this.x + this.vx);
                this.angle = javaFloat(this.angle + this.vx);
                if (Math.abs(this.vx) >= 3) {
                    this.state = Boomerang.STATE_REVERSE;
                }
                break;
            case Boomerang.STATE_REVERSE:
                if (this.direction == Main.RIGHT) {
                    this.x = javaFloat(this.x - 3);
                    this.angle = javaFloat(this.angle - 3);
                } else {
                    this.x = javaFloat(this.x + 3);
                    this.angle = javaFloat(this.angle + 3);
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

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.boomerang, this.x, this.y, this.angle);
    }
}
