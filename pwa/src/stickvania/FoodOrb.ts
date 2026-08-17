import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { DropItem } from "./DropItem.js";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class FoodOrb extends Thing {
    public static readonly STATE_FADE_IN: number = 0;
    public static readonly STATE_FLYING: number = 1;
    public static readonly STATE_SHOOTING: number = 2;
    public static readonly FRACTION: number = 1 / 91;
    public static readonly ANGLE1: number = (2 * Math.PI) / 3;
    public static readonly ANGLE2: number = (4 * Math.PI) / 3;
    private angle: number = 0;
    private sx0: number = 0;
    private sy0: number = 0;
    private sx1: number = 0;
    private sy1: number = 0;
    private sx2: number = 0;
    private sy2: number = 0;
    private fade: number = 0;
    private radius: number = 0;
    private X: number = 0;
    private Y: number = 0;
    private a: number = 0;
    private b: number = 0;
    private state: number = FoodOrb.STATE_FADE_IN;
    private flyAngle: number = 0;
    private flySteps: number = 0;
    private shootDelay: number = 0;
    private shootAngleInc: number = 0;
    private shots: number = 16;
    private shootAngle: number = 0;
    private bounces: number = 10;
    public constructor(main: Main, x: number, y: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.a = x + 16;
        this.b = y + 16;
    }

    public update(gc: GameContainer): boolean {
        if (this.kill) {
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            return false;
        }

        switch (this.state) {
            case FoodOrb.STATE_FADE_IN:
                if (++this.fade == 91) {
                    this.state = FoodOrb.STATE_FLYING;
                    this.flySteps = 91;
                    let tx: number = 64;
                    let ty: number = 300;
                    if (this.main.simon.x - 16 > 256) {
                        tx = 448;
                    }
                    this.vx = (tx - this.a) * FoodOrb.FRACTION;
                    this.vy = (ty - this.b) * FoodOrb.FRACTION;
                }
                break;

            case FoodOrb.STATE_FLYING:
                this.a += this.vx;
                this.b += this.vy;
                this.x = this.a + this.radius * Math.cos(this.flyAngle) - 16;
                this.y = this.b + this.radius * Math.sin(this.flyAngle) - 16;
                if (--this.flySteps == 0) {
                    this.flySteps = 91;
                    let tx: number = this.main.random.nextInt(384) + 64;
                    let ty: number = this.main.random.nextInt(224) + 64;
                    if (this.bounces == 0) {
                        return false;
                    } else if (--this.bounces == 0) {
                        ty = -128;
                    }
                    this.vx = (tx - this.a) * FoodOrb.FRACTION;
                    this.vy = (ty - this.b) * FoodOrb.FRACTION;
                }
                if (this.radius < 64) {
                    this.radius += 0.5;
                }
                this.flyAngle -= 0.04;
                if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                    this.main.playSound(this.main.snuffed);
                    this.state = FoodOrb.STATE_SHOOTING;
                    this.shootAngle = 0.5 * Math.PI;
                    if (this.main.simon.x + 16 < this.x) {
                        this.shootAngleInc = -0.39269908169872415480783042290994;
                    } else {
                        this.shootAngleInc = 0.39269908169872415480783042290994;
                    }
                } else if (this.main.intersectsSimon(this)) {
                    this.main.hurtSimon(2);
                }
                break;

            case FoodOrb.STATE_SHOOTING:
                if (this.shootDelay == 0) {
                    this.shootDelay = 5;
                    this.main.pushThing(new Fireball(this.main, this.x - 8, this.y - 8, 4 * FastTrig.cos(this.shootAngle), 4 * FastTrig.sin(this.shootAngle)));
                    this.main.playRumble("fireProjectile");
                    this.shootAngle += this.shootAngleInc;
                    if (--this.shots == 0) {
                        this.main.pushThing(new DropItem(this.main, trunc(this.x), trunc(this.y), DropItem.TYPE_MEAT));
                        return false;
                    }
                } else {
                    this.shootDelay--;
                }
                break;
        }

        this.angle += 0.05;
        this.X = this.x - 16;
        this.Y = this.y - 16;
        this.sx0 = this.X + 16 * FastTrig.cos(this.angle);
        this.sy0 = this.Y + 16 * FastTrig.sin(this.angle);
        this.sx1 = this.X + 16 * FastTrig.cos(this.angle + FoodOrb.ANGLE1);
        this.sy1 = this.Y + 16 * FastTrig.sin(this.angle + FoodOrb.ANGLE1);
        this.sx2 = this.X + 16 * FastTrig.cos(this.angle + FoodOrb.ANGLE2);
        this.sy2 = this.Y + 16 * FastTrig.sin(this.angle + FoodOrb.ANGLE2);

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.state == FoodOrb.STATE_FADE_IN) {
            let fadeValue: number = this.fade * FoodOrb.FRACTION;
            this.main.drawFaded(this.main.orb, this.X, this.Y, fadeValue);
            this.main.drawFaded(this.main.spark, this.sx0, this.sy0, fadeValue);
            this.main.drawFaded(this.main.spark, this.sx1, this.sy1, fadeValue);
            this.main.drawFaded(this.main.spark, this.sx2, this.sy2, fadeValue);
        } else {
            this.main.draw(this.main.orb, this.X, this.Y);
            this.main.draw(this.main.spark, this.sx0, this.sy0);
            this.main.draw(this.main.spark, this.sx1, this.sy1);
            this.main.draw(this.main.spark, this.sx2, this.sy2);
        }
    }
}
