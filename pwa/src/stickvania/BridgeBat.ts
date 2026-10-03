import { clampEnemyArcVelocity, configureEnemyArc } from "./EnemyArcMotion.js";
import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class BridgeBat extends Thing {
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_HOVERING: number = 1;
    public static readonly STATE_FLYING: number = 2;
    private state: number = BridgeBat.STATE_INACTIVE;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private targetX: number = javaFloat(0);
    private applyingGravity: boolean = false;
    private delay: number = 0;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 96, 48);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.spriteIndex = 1;
    }

    private findTarget(): void {
        if (this.main.simon!.x < javaFloat(this.x + 16)) {
            this.targetX = javaFloat(javaFloat(this.main.simon!.x - 16) - this.main.random.nextInt(96));
        } else {
            this.targetX = javaFloat(javaFloat(this.main.simon!.x + 48) + this.main.random.nextInt(96));
        }
        if (this.main.random.nextInt(5) < 3) {
            let targetY: number = javaFloat(this.main.random.nextInt(5) < 3 ? javaFloat(this.main.simon!.y + 8) : javaFloat(this.main.simon!.y - 80));
            const t: number = javaFloat(2 * Math.abs(javaFloat(javaFloat(this.main.simon!.x - this.x) - 16)));
            this.applyingGravity = configureEnemyArc(this, t, targetY);
        } else {
            this.applyingGravity = false;
        }
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, -0.9, 0, -0.06, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), this.y, 0, 0, -0.09, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 64), this.y, 1, 0, -0.08, 0, 10));
            this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 32), 0, 0, 0.05, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 32), 0, 0, 0.08, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 64), javaFloat(this.y + 32), 0, 0, 0.065, 0, 10));
            this.main.addPoints(200);
            this.main.playSound(this.main.large_bat_killed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (++this.spriteIndexIncrementor == 40) {
                this.spriteIndexIncrementor = 0;
                if (this.state != BridgeBat.STATE_INACTIVE) {
                    this.main.playSound(this.main.wing_flaps);
                }
                if (++this.spriteIndex == 3) {
                    this.spriteIndex = 1;
                }
            }

            switch (this.state) {
                case BridgeBat.STATE_INACTIVE:
                    if (Math.abs(javaFloat(javaFloat(this.main.simon!.x - this.x) - 16)) < 350) {
                        this.state = BridgeBat.STATE_HOVERING;
                        this.delay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
                        this.spriteIndex = 1;
                    }
                    break;
                case BridgeBat.STATE_HOVERING:
                    if (--this.delay <= 0) {
                        this.state = BridgeBat.STATE_FLYING;
                        this.findTarget();
                    }
                    break;
                case BridgeBat.STATE_FLYING:
                    if (this.applyingGravity) {
                        this.vy = clampEnemyArcVelocity(this.vy);
                        this.y = javaFloat(this.y + this.vy);
                        this.vy = clampEnemyArcVelocity(javaFloat(this.vy + this.G));
                        if (this.y < 0) {
                            this.y = javaFloat(0);
                            this.applyingGravity = false;
                        } else if (this.y > 303) {
                            this.y = javaFloat(303);
                            this.applyingGravity = false;
                        }
                    }
                    if (Math.abs(javaFloat(this.targetX - this.x)) <= 4) {
                        this.state = BridgeBat.STATE_HOVERING;
                        this.delay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
                    } else if (this.targetX < this.x) {
                        this.x = javaFloat(this.x - 2);
                    } else {
                        this.x = javaFloat(this.x + 2);
                    }
                    break;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.batBoss[this.spriteIndex], this.x, this.y);
    }
}
