import { isDescendingBelowStage } from "./PitLifecycle.js";
import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { javaFloat, cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class RedSkeleton extends Thing {
    private static readonly STATE_INACTIVE: number = 0;
    private static readonly STATE_WALKING: number = 1;
    private static readonly STATE_STANDING: number = 2;
    private static readonly STATE_CRUMBLING: number = 3;
    private state: number = RedSkeleton.STATE_INACTIVE;
    private direction: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private walkedDistance: number = 0;
    private standingDelay: number = 0;
    private crumbling: number = 0;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 1, 0, 30, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
    }

    public override update(gc: GameContainer): boolean {
        if (isDescendingBelowStage(this)) {
            return false;
        }
        if (this.kill) {
            if (this.main.random.nextBoolean()) {
                this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h"))!);
            }
            this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 24), 0, 0, -0.08, 0, 10));
            this.main.addPoints(400);
            return false;
        }

        if (this.state == RedSkeleton.STATE_WALKING || this.state == RedSkeleton.STATE_STANDING) {
            if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                this.state = RedSkeleton.STATE_CRUMBLING;
                this.main.playSound(this.main.crumble_sfx);
                this.main.addPoints(400);
            } else if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }
        }

        if (this.main.timeFrozen == 0) {
            this.applyGravity();
            if (isDescendingBelowStage(this)) {
                return false;
            }

            switch (this.state) {
                case RedSkeleton.STATE_INACTIVE:
                    if (this.x >= this.main.camera - 96 && this.x <= this.main.camera + 576) {
                        this.state = RedSkeleton.STATE_WALKING;
                    }
                    break;
                case RedSkeleton.STATE_WALKING:
                    if (this.direction == Main.LEFT) {
                        if (!this.moveX(-0.5) || !this.main.isSupportive(trunc(this.x), trunc(javaFloat(this.y + 64)))) {
                            this.direction = Main.RIGHT;
                        }
                    } else {
                        if (!this.moveX(0.5) || !this.main.isSupportive(trunc(javaFloat(this.x + 31)), trunc(javaFloat(this.y + 64)))) {
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
                        this.walkedDistance = 0;
                        this.state = RedSkeleton.STATE_STANDING;
                    }
                    break;
                case RedSkeleton.STATE_STANDING:
                    if (++this.standingDelay == 91) {
                        this.standingDelay = 0;
                        this.state = RedSkeleton.STATE_WALKING;
                        if (this.direction == Main.LEFT) {
                            if (javaFloat(javaFloat(this.main.simon!.x + 16) - this.x) >= 64) {
                                this.direction = Main.RIGHT;
                            }
                        } else {
                            if (javaFloat(this.x - javaFloat(this.main.simon!.x + 16)) >= 64) {
                                this.direction = Main.LEFT;
                            }
                        }
                    }
                    break;
                case RedSkeleton.STATE_CRUMBLING:
                    if (++this.crumbling >= 273) {
                        this.crumbling = 0;
                        this.state = RedSkeleton.STATE_WALKING;
                        this.walkedDistance = 0;
                        this.spriteIndexIncrementor = 0;
                        this.spriteIndex = 0;
                        this.standingDelay = 0;
                        if (this.direction == Main.LEFT) {
                            if (javaFloat(javaFloat(this.main.simon!.x + 16) - this.x) >= 64) {
                                this.direction = Main.RIGHT;
                            }
                        } else {
                            if (javaFloat(this.x - javaFloat(this.main.simon!.x + 16)) >= 64) {
                                this.direction = Main.LEFT;
                            }
                        }
                    }
                    break;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.state == RedSkeleton.STATE_CRUMBLING) {
            if (this.crumbling < 20 || this.crumbling > 253) {
                this.main.draw(this.main.crumble[0], this.x, javaFloat(this.y + 32));
            } else {
                this.main.draw(this.main.crumble[1], this.x, javaFloat(this.y + 48));
            }
        } else {
            this.main.draw(this.main.skeletons[this.direction][this.spriteIndex], this.x, this.y);
        }
    }
}
