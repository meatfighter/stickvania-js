import { GameContainer, Graphics } from "slick2d-ts";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { javaFloat, cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class BonePillar extends Thing {
    private direction: number = 0;
    private stunned: number = 0;
    private hits: number = 3;
    private delay: number = 0;
    private bullets: number = 2;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.hits = main.adjustEnemyHits(this.hits);
    }

    public override update(gc: GameContainer): boolean {
        if (this.kill) {
            this.hits = 0;
            this.stunned = 0;
        }

        if (this.stunned > 0) {
            this.stunned--;
        } else if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            if (--this.hits <= 0) {
                if (this.main.random.nextBoolean()) {
                    this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h"))!);
                }
                this.main.pushThing(new Flame(this.main, this.x, this.y, -1, 0, -0.08, 0, 10));
                this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 32), 1, 0, -0.08, 0, 10));
                this.main.addPoints(400);
                this.main.playSound(this.main.torch_breaks);
                return false;
            } else {
                this.stunned = 45;
                this.main.playSound(this.main.stunned);
            }
        }

        if (this.main.timeFrozen == 0 && Math.abs(javaFloat(this.main.simon!.x - this.x)) < 512) {
            this.direction = this.main.simon!.x < this.x ? Main.LEFT : Main.RIGHT;

            if (this.delay == 0) {
                if (--this.bullets == 0) {
                    this.bullets = 2;
                    this.delay = this.main.adjustEnemyCooldown(60);
                } else {
                    this.delay = this.main.adjustEnemyCooldown(364);
                }
                this.main.pushThing(new Fireball(this.main, javaFloat(this.x + 8), javaFloat(this.y + 18), this.direction == Main.LEFT ? -1.5 : 1.5, 0));
                this.main.playRumble("fireProjectile");
                this.main.playSound(this.main.fire_ball_shot);
            } else {
                this.delay--;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.bonePillars[this.direction], this.x, this.y);
    }
}
