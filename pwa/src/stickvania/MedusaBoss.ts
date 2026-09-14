import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Orb } from "./Orb.js";
import { Snakes } from "./Snakes.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class MedusaBoss extends Thing {
    public static readonly STATE_RESTING: number = 0;
    public static readonly STATE_HOVERING: number = 1;
    public static readonly STATE_ATTACKING: number = 2;
    public static readonly STATE_DEAD: number = 3;
    public static readonly STATE_FADE_IN: number = 4;
    private static readonly ATTACK_FRACTION: number = javaFloat(1.0 / (91 * 2.0));
    public static readonly FADE_FRACTION: number = javaFloat(1 / 91);
    public fadeIn: number = 0;
    public state: number = MedusaBoss.STATE_RESTING;
    public spriteIndex: number = 0;
    public spriteIndexIncrementor: number = 40;
    public hoveringMoving: number = 0;
    public hoveringPause: number = 0;
    public spawnDelay: number = 0;
    public stunned: number = 0;
    public angle: number = javaFloat(0);
    public Y: number = javaFloat(0);
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 64, 64);
        this.x = javaFloat(x);
        this.Y = javaFloat((this.y = javaFloat(y)));

        this.G = javaFloat(0);
    }

    public override update(gc: GameContainer): boolean {
        const timeAdvances = this.main.timeFrozen == 0;
        const active = this.state == MedusaBoss.STATE_HOVERING || this.state == MedusaBoss.STATE_ATTACKING;

        if (active) {
            // Castlevania's StopWatch freezes the first two bosses only. Pause
            // Medusa's active motion/AI clocks while keeping combat live.
            if (timeAdvances) {
                if (--this.spriteIndexIncrementor == 0) {
                    this.spriteIndexIncrementor = 40;
                    if (++this.spriteIndex == 2) {
                        this.spriteIndex = 0;
                    }
                }

                if (this.moveY(javaFloat(0.5 * javaFloat(FastTrig.cos(this.angle))))) {
                    this.angle = javaFloat(this.angle + 0.03);
                }
                if (this.y < 0) {
                    this.y = javaFloat(0);
                }

                if (this.spawnDelay == 0) {
                    this.spawnDelay = 91 + this.main.random.nextInt(455);
                    this.main.pushThing(new Snakes(this.main, javaFloat(this.x + 12), javaFloat(this.y + 20), this.main.random.nextBoolean() ? 1 : -1, -4));
                } else {
                    this.spawnDelay--;
                }
            }

            if (this.stunned == 0) {
                if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                    this.main.pushThing(new Spark(this.main, this));
                    this.main.playSound(this.main.boss_hurt);
                    this.stunned = 45;

                    this.main.enemyPower -= 1;
                    if (this.main.enemyPower <= 0) {
                        this.main.enemyPower = 0;
                        this.main.fireSparks(javaFloat(this.x + 32), javaFloat(this.y + 8));
                        this.main.killAll();
                        this.main.playRumble("bossFinalHit");
                        this.main.playSound(this.main.boss_killed_2);
                        this.main.stopSong();
                        this.main.addPoints(3000);
                        this.state = MedusaBoss.STATE_DEAD;

                        this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 32), 0, 0, -0.08, 0, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 64), 0, 0, -0.08, 0, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 32), 0, 0, -0.08, 0, 91));

                        this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.08, 30, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), this.y, 0, 0, -0.08, 30, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), this.y, 0, 0, -0.08, 30, 91));

                        this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 16), -2, 0.5, -0.09, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 8), javaFloat(this.y + 16), -1, 1.5, -0.11, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 16), 0.25, 2.5, -0.13, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 16), 1, 2, -0.12, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 48), javaFloat(this.y + 16), 2, 1, -0.1, 90, 91));

                        this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 16), -2.5, 0, -0.09, 60, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 8), javaFloat(this.y + 16), -1, 0, -0.11, 60, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 16), 0.25, 0, -0.13, 60, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 16), 1, 0, -0.12, 60, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 48), javaFloat(this.y + 16), 2.5, 0, -0.1, 60, 91));

                        this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 32), 0, 0, -0.08, 120, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 64), 0, 0, -0.08, 120, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 32), 0, 0, -0.08, 120, 91));

                        this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.08, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), this.y, 0, 0, -0.08, 90, 91));
                        this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), this.y, 0, 0, -0.08, 90, 91));

                        this.main.pushThing(new Orb(this.main, this.main.simon!.xMin + 240, 96, 273));
                    }
                }
            } else {
                this.stunned--;
            }

            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }
        }

        switch (this.state) {
            case MedusaBoss.STATE_RESTING:
                if (javaFloat(this.main.simon!.x - this.main.simon!.xMin) < 220) {
                    this.main.killAll();
                    this.main.requestSong(this.main.boss_2);
                    this.main.simon!.xMax = 512;
                    this.state = MedusaBoss.STATE_FADE_IN;
                    this.spriteIndex = 1;
                    this.vx = javaFloat(this.main.random.nextBoolean() ? -1 : 1);
                    this.hoveringMoving = this.main.random.nextInt(182) + 91;
                }
                break;
            case MedusaBoss.STATE_FADE_IN:
                // Boss introduction/setup is intentionally not frozen; once the
                // fade completes, active Medusa AI waits for the StopWatch to end.
                if (this.fadeIn < 91) {
                    this.fadeIn++;
                } else {
                    this.state = MedusaBoss.STATE_HOVERING;
                }
                break;
            case MedusaBoss.STATE_HOVERING:
                if (!timeAdvances) {
                    break;
                }
                if (this.hoveringPause > 0) {
                    this.hoveringPause--;
                } else {
                    if (!this.moveX(this.vx)) {
                        this.vx = javaFloat(-this.vx);
                    }

                    if (this.y > 32) {
                        this.y = javaFloat(this.y - 1);
                    } else if (this.y < 0) {
                        this.y = javaFloat(0);
                    }
                    if (--this.hoveringMoving == 0) {
                        this.hoveringPause = this.main.random.nextInt(91) + 91;
                        this.hoveringMoving = this.main.random.nextInt(182) + 91;
                        this.vx = javaFloat(-this.vx);
                        if (this.main.random.nextBoolean()) {
                            let targetX: number = javaFloat(this.main.simon!.x - 16);
                            let targetY: number = javaFloat(this.main.simon!.y + 8);
                            this.vx = javaFloat(javaFloat(targetX - this.x) * MedusaBoss.ATTACK_FRACTION);
                            this.vy = javaFloat(javaFloat(targetY - this.y) * MedusaBoss.ATTACK_FRACTION);
                            this.state = MedusaBoss.STATE_ATTACKING;
                            break;
                        }
                    }
                }
                break;
            case MedusaBoss.STATE_ATTACKING:
                if (!timeAdvances) {
                    break;
                }
                this.applyGravity();

                if (this.y < 0) {
                    this.y = javaFloat(0);
                }
                if (!this.moveX(this.vx) || this.supported) {
                    this.state = MedusaBoss.STATE_HOVERING;
                    this.vx = javaFloat(this.main.random.nextBoolean() ? -1 : 1);
                    this.hoveringPause = 0;
                }
                break;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.state != MedusaBoss.STATE_DEAD) {
            if (this.fadeIn > 90) {
                this.main.draw(this.main.medusaBoss[this.spriteIndex], this.x, this.y);
            } else {
                this.main.drawFaded(this.main.medusaBoss[this.spriteIndex], this.x, this.y, javaFloat(this.fadeIn * MedusaBoss.FADE_FRACTION));
            }
        }
    }
}
