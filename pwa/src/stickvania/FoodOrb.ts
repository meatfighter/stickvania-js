import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { DropItem } from "./DropItem.js";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class FoodOrb extends Thing {
    public static readonly STATE_FADE_IN: number = 0;
    public static readonly STATE_FLYING: number = 1;
    public static readonly STATE_SHOOTING: number = 2;
    public static readonly FRACTION: number = javaFloat(1 / 91);
    public static readonly ANGLE1: number = javaFloat((2 * Math.PI) / 3);
    public static readonly ANGLE2: number = javaFloat((4 * Math.PI) / 3);
    private angle: number = javaFloat(0);
    private sx0: number = javaFloat(0);
    private sy0: number = javaFloat(0);
    private sx1: number = javaFloat(0);
    private sy1: number = javaFloat(0);
    private sx2: number = javaFloat(0);
    private sy2: number = javaFloat(0);
    private fade: number = 0;
    private radius: number = javaFloat(0);
    private X: number = javaFloat(0);
    private Y: number = javaFloat(0);
    private a: number = javaFloat(0);
    private b: number = javaFloat(0);
    private state: number = FoodOrb.STATE_FADE_IN;
    private flyAngle: number = javaFloat(0);
    private flySteps: number = 0;
    private shootDelay: number = 0;
    private shootAngleInc: number = javaFloat(0);
    private shots: number = 16;
    private shootAngle: number = javaFloat(0);
    private bounces: number = 10;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.a = javaFloat(x + 16);
        this.b = javaFloat(y + 16);
    }

    public override update(gc: GameContainer): boolean {
        if (this.kill) {
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            return false;
        }

        switch (this.state) {
            case FoodOrb.STATE_FADE_IN:
                if (++this.fade == 91) {
                    this.state = FoodOrb.STATE_FLYING;
                    this.flySteps = 91;
                    let tx: number = javaFloat(64);
                    let ty: number = javaFloat(300);
                    if (javaFloat(this.main.simon!.x - 16) > 256) {
                        tx = javaFloat(448);
                    }
                    this.vx = javaFloat(javaFloat(tx - this.a) * FoodOrb.FRACTION);
                    this.vy = javaFloat(javaFloat(ty - this.b) * FoodOrb.FRACTION);
                }
                break;

            case FoodOrb.STATE_FLYING:
                this.a = javaFloat(this.a + this.vx);
                this.b = javaFloat(this.b + this.vy);
                this.x = javaFloat(javaFloat(this.a + javaFloat(this.radius * Math.cos(this.flyAngle))) - 16);
                this.y = javaFloat(javaFloat(this.b + javaFloat(this.radius * Math.sin(this.flyAngle))) - 16);
                if (--this.flySteps == 0) {
                    this.flySteps = 91;
                    let tx: number = javaFloat(this.main.random.nextInt(384) + 64);
                    let ty: number = javaFloat(this.main.random.nextInt(224) + 64);
                    if (this.bounces == 0) {
                        return false;
                    } else if (--this.bounces == 0) {
                        ty = javaFloat(-128);
                    }
                    this.vx = javaFloat(javaFloat(tx - this.a) * FoodOrb.FRACTION);
                    this.vy = javaFloat(javaFloat(ty - this.b) * FoodOrb.FRACTION);
                }
                if (this.radius < 64) {
                    this.radius = javaFloat(this.radius + 0.5);
                }
                this.flyAngle = javaFloat(this.flyAngle - 0.04);
                if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                    this.main.playSound(this.main.snuffed);
                    this.state = FoodOrb.STATE_SHOOTING;
                    this.shootAngle = javaFloat(0.5 * Math.PI);
                    if (javaFloat(this.main.simon!.x + 16) < this.x) {
                        this.shootAngleInc = javaFloat(-0.39269908169872415480783042290994);
                    } else {
                        this.shootAngleInc = javaFloat(0.39269908169872415480783042290994);
                    }
                } else if (this.main.intersectsSimon(this)) {
                    this.main.hurtSimon(2);
                }
                break;

            case FoodOrb.STATE_SHOOTING:
                if (this.shootDelay == 0) {
                    this.shootDelay = 5;
                    this.main.pushThing(
                        new Fireball(
                            this.main,
                            javaFloat(this.x - 8),
                            javaFloat(this.y - 8),
                            javaFloat(4 * javaFloat(FastTrig.cos(this.shootAngle))),
                            javaFloat(4 * javaFloat(FastTrig.sin(this.shootAngle)))
                        )
                    );
                    this.main.playRumble("fireProjectile");
                    this.shootAngle = javaFloat(this.shootAngle + this.shootAngleInc);
                    if (--this.shots == 0) {
                        this.main.pushThing(new DropItem(this.main, trunc(this.x), trunc(this.y), DropItem.TYPE_MEAT));
                        return false;
                    }
                } else {
                    this.shootDelay--;
                }
                break;
        }

        this.angle = javaFloat(this.angle + 0.05);
        this.X = javaFloat(this.x - 16);
        this.Y = javaFloat(this.y - 16);
        this.sx0 = javaFloat(this.X + javaFloat(16 * javaFloat(FastTrig.cos(this.angle))));
        this.sy0 = javaFloat(this.Y + javaFloat(16 * javaFloat(FastTrig.sin(this.angle))));
        this.sx1 = javaFloat(this.X + javaFloat(16 * javaFloat(FastTrig.cos(javaFloat(this.angle + FoodOrb.ANGLE1)))));
        this.sy1 = javaFloat(this.Y + javaFloat(16 * javaFloat(FastTrig.sin(javaFloat(this.angle + FoodOrb.ANGLE1)))));
        this.sx2 = javaFloat(this.X + javaFloat(16 * javaFloat(FastTrig.cos(javaFloat(this.angle + FoodOrb.ANGLE2)))));
        this.sy2 = javaFloat(this.Y + javaFloat(16 * javaFloat(FastTrig.sin(javaFloat(this.angle + FoodOrb.ANGLE2)))));

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.state == FoodOrb.STATE_FADE_IN) {
            let fadeValue: number = javaFloat(this.fade * FoodOrb.FRACTION);
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
