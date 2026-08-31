import { GameContainer, Graphics } from "slick2d-ts";
import { BoomerangAxe } from "./BoomerangAxe.js";
import { Flame } from "./Flame.js";
import { javaFloat, cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class AxeKnight extends Thing {
    private static readonly STATE_INACTIVE: number = 0;
    private static readonly STATE_WALKING: number = 1;
    private static readonly STATE_STANDING: number = 2;
    public hits: number = 3;
    public stunned: number = 0;
    private direction: number = 0;
    private displayDirection: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private standingDelay: number = 0;
    private state: number = AxeKnight.STATE_INACTIVE;
    private walkedDistance: number = 0;
    private throwDelay: number = 0;
    private hasAxe: boolean = true;
    public dead: boolean = false;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 48, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.hits = main.adjustEnemyHits(this.hits);
        this.throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
    }

    public axeGone(): void {
        this.hasAxe = true;
        this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
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
                this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 24), 0, 0, -0.08, 0, 10));
                this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 32), 0, 0, -0.08, 0, 10));
                this.main.addPoints(500);
                this.main.playSound(this.main.killed_4);
                this.dead = true;
                return false;
            } else {
                this.main.playSound(this.main.stunned);
                this.stunned = 45;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        if (this.main.timeFrozen == 0) {
            if (javaFloat(this.main.simon!.x + 8) < this.x) {
                this.displayDirection = Main.LEFT;
            } else {
                this.displayDirection = Main.RIGHT;
            }

            this.applyGravity();

            if (this.state != AxeKnight.STATE_INACTIVE && this.hasAxe) {
                if (this.throwDelay <= 0) {
                    this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
                    this.main.pushThing(
                        new BoomerangAxe(
                            this.main,
                            javaFloat(this.x + 8),
                            javaFloat(this.main.random.nextBoolean() ? this.y : javaFloat(this.y + 32)),
                            this.displayDirection,
                            this
                        )
                    );
                    this.hasAxe = false;
                } else {
                    this.throwDelay--;
                }
            }

            switch (this.state) {
                case AxeKnight.STATE_INACTIVE:
                    if (this.x >= this.main.camera - 96 && this.x <= this.main.camera + 576) {
                        this.state = AxeKnight.STATE_WALKING;
                    }
                    break;
                case AxeKnight.STATE_WALKING:
                    if (this.direction == Main.LEFT) {
                        if (!this.moveX(-0.5) || !this.main.isSupportive(trunc(this.x), trunc(javaFloat(this.y + 64)))) {
                            this.direction = Main.RIGHT;
                        }
                    } else {
                        if (!this.moveX(0.5) || !this.main.isSupportive(trunc(javaFloat(this.x + 47)), trunc(javaFloat(this.y + 64)))) {
                            this.direction = Main.LEFT;
                        }
                    }

                    if (++this.spriteIndexIncrementor == 20) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 2) {
                            this.spriteIndex = 0;
                        }
                    }

                    if (++this.walkedDistance >= 96) {
                        this.walkedDistance = this.main.random.nextInt(43);
                        this.state = AxeKnight.STATE_STANDING;
                    }
                    break;
                case AxeKnight.STATE_STANDING:
                    if (++this.standingDelay >= this.main.adjustEnemyBehaviorDelay(43)) {
                        this.standingDelay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
                        this.state = AxeKnight.STATE_WALKING;
                        let distance: number = javaFloat(javaFloat(this.main.simon!.x + 8) - this.x);
                        let aDist: number = javaFloat(Math.abs(distance));
                        if (aDist < 128) {
                            if (distance < 0) {
                                this.direction = Main.RIGHT;
                            } else {
                                this.direction = Main.LEFT;
                            }
                        } else if (aDist > 256) {
                            if (distance < 0) {
                                this.direction = Main.LEFT;
                            } else {
                                this.direction = Main.RIGHT;
                            }
                        }
                    }
                    break;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.axeKnights[this.displayDirection][this.spriteIndex], this.x, this.y);
    }
}
