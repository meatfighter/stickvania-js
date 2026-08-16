import { GameContainer, Graphics } from "slick2d-ts";
import { Bone } from "./Bone.js";
import { Flame } from "./Flame.js";
import { cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class WhiteSkeleton extends Thing {
    private static readonly STATE_INACTIVE: number = 0;
    private static readonly STATE_STANDING: number = 1;
    private static readonly STATE_WALKING: number = 2;
    private static readonly STATE_JUMPING: number = 3;
    private direction: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private delay: number = 0;
    private state: number = WhiteSkeleton.STATE_INACTIVE;
    private targetX: number = 0;
    private throwDelay: number = 0;
    private dying: number = 0;
    private dead: boolean = false;
    public constructor(main: Main, x: number, y: number) {
        super(main, 1, 0, 30, 64);
        this.x = x;
        this.y = y;
        this.throwDelay = main.adjustEnemyCooldown(91 + main.random.nextInt(273));
    }

    public update(gc: GameContainer): boolean {
        if (this.dead) {
            if (++this.dying == 137) {
                if (this.main.random.nextBoolean()) {
                    this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y + 32), this.main.random.nextBoolean() ? cc("$") : cc("h")));
                }
                this.main.pushThing(new Flame(this.main, this.x, this.y + 32, 0, 0, -0.05, 0, 10));
                this.main.addPoints(300);
                this.main.playSound(this.main.wing_flaps);
                return false;
            }
        } else {
            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }

            if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
                this.main.pushThing(new Spark(this.main, this));
                this.main.playSound(this.main.crumble_sfx);
                if (this.supported) {
                    this.dead = true;
                } else {
                    if (this.main.random.nextBoolean()) {
                        this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y + 32), this.main.random.nextBoolean() ? cc("$") : cc("h")));
                    }
                    this.main.pushThing(new Flame(this.main, this.x, this.y + 24, 0, 0, -0.08, 0, 10));
                    this.main.addPoints(300);
                    return false;
                }
            } else if (this.main.timeFrozen == 0) {
                if (this.main.simon.x + 16 < this.x) {
                    this.direction = Main.LEFT;
                } else {
                    this.direction = Main.RIGHT;
                }

                this.applyGravity();

                if (this.state == WhiteSkeleton.STATE_STANDING || this.state == WhiteSkeleton.STATE_WALKING) {
                    if (--this.throwDelay == 0) {
                        this.throwDelay = this.main.adjustEnemyCooldown(91 + this.main.random.nextInt(273));
                        let uy: number = -6.5 - 3 * this.main.random.nextFloat();
                        let ux: number = 1 + this.main.random.nextFloat();
                        if (this.direction == Main.RIGHT) {
                            this.main.pushThing(new Bone(this.main, this.x, this.y + 8, ux, uy));
                        } else {
                            this.main.pushThing(new Bone(this.main, this.x, this.y + 8, -ux, uy));
                        }
                    }
                }

                switch (this.state) {
                    case WhiteSkeleton.STATE_INACTIVE:
                        if (this.x >= this.main.camera - 96 && this.x <= this.main.camera + 576) {
                            this.state = WhiteSkeleton.STATE_STANDING;
                            this.delay = this.main.adjustEnemyBehaviorDelay(23 + this.main.random.nextInt(46));
                        }
                        break;
                    case WhiteSkeleton.STATE_STANDING:
                        if (--this.delay == 0) {
                            this.delay = this.main.adjustEnemyBehaviorDelay(91 + this.main.random.nextInt(273));
                            this.state = WhiteSkeleton.STATE_WALKING;
                            if (this.main.simon.x + 16 > this.x) {
                                this.targetX = this.main.simon.x - 48 - this.main.random.nextInt(160);
                            } else {
                                this.targetX = this.main.simon.x + 80 + this.main.random.nextInt(160);
                            }
                        }
                        break;
                    case WhiteSkeleton.STATE_WALKING:
                        if (--this.delay == 0) {
                            this.state = WhiteSkeleton.STATE_STANDING;
                            this.delay = this.main.adjustEnemyBehaviorDelay(23 + this.main.random.nextInt(46));
                        }
                        if (++this.spriteIndexIncrementor == 20) {
                            this.spriteIndexIncrementor = 0;
                            if (++this.spriteIndex == 2) {
                                this.spriteIndex = 0;
                            }
                        }
                        if (Math.abs(this.x - this.targetX) < 2) {
                            if (this.main.simon.x + 16 > this.x) {
                                this.targetX = this.main.simon.x - 48 - this.main.random.nextInt(160);
                            } else {
                                this.targetX = this.main.simon.x + 80 + this.main.random.nextInt(160);
                            }
                        } else if (this.x < this.targetX) {
                            if (!this.moveX(1)) {
                                this.targetX = this.x - this.main.random.nextInt(160);
                            } else if (!this.main.isSupportive(trunc(this.x + 31), trunc(this.y + 64))) {
                                if (this.main.random.nextInt(5) == 4) {
                                    this.state = WhiteSkeleton.STATE_JUMPING;
                                    this.vy = Main.SIMON_JUMP_VELOCITY;
                                    this.vx = 2;
                                } else {
                                    this.targetX = this.x - this.main.random.nextInt(160);
                                }
                            }
                        } else {
                            if (!this.moveX(-1)) {
                                this.targetX = this.x + this.main.random.nextInt(160);
                            } else if (!this.main.isSupportive(trunc(this.x), trunc(this.y + 64))) {
                                if (this.main.random.nextBoolean()) {
                                    this.state = WhiteSkeleton.STATE_JUMPING;
                                    this.vy = Main.SIMON_JUMP_VELOCITY;
                                    this.vx = -2;
                                } else {
                                    this.targetX = this.x + this.main.random.nextInt(160);
                                }
                            }
                        }
                        break;
                    case WhiteSkeleton.STATE_JUMPING:
                        if (this.supported) {
                            this.state = WhiteSkeleton.STATE_WALKING;
                        } else {
                            this.moveX(this.vx);
                        }
                        break;
                }
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.dead) {
            if (this.dying < 30) {
                this.main.draw(this.main.crumble[0], this.x, this.y + 32);
            } else {
                this.main.draw(this.main.crumble[1], this.x, this.y + 48);
            }
        } else {
            this.main.draw(this.main.skeletons[this.direction][this.spriteIndex], this.x, this.y);
        }
    }
}
