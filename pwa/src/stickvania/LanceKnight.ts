import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { javaFloat, cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class LanceKnight extends Thing {
    private static readonly walkSpriteIndexes: number[] = [0, 1, 2, 1];
    public hits: number = 2;
    public stunned: number = 0;
    public direction: number = 0;
    public spriteIndex: number = 0;
    public spriteIndexIncrementor: number = 0;
    public changeDirection: boolean = true;
    public changeDirectionDelay: number = 0;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 1, 0, 30, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.hits = main.adjustEnemyHits(this.hits);
        this.direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
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
                this.main.addPoints(400);
                this.main.playSound(this.main.killed_3);
                return false;
            } else {
                this.stunned = 45;
                this.main.playSound(this.main.stunned);
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        if (this.main.timeFrozen == 0) {
            if (++this.spriteIndexIncrementor == 32) {
                this.spriteIndexIncrementor = 0;
                if (++this.spriteIndex == 4) {
                    this.spriteIndex = 0;
                }
            }

            if (this.changeDirectionDelay > 0) {
                if (--this.changeDirectionDelay == 0) {
                    this.direction = this.direction == Main.LEFT ? Main.RIGHT : Main.LEFT;
                }
            }

            if (this.direction == Main.LEFT) {
                if (!this.moveX(-0.5) || !this.main.isSupportive(trunc(this.x), trunc(javaFloat(this.y + 64)))) {
                    this.direction = Main.RIGHT;
                    if (this.changeDirection) {
                        this.changeDirection = false;
                        this.changeDirectionDelay = 91;
                    } else {
                        this.changeDirection = true;
                    }
                }
            } else {
                if (!this.moveX(0.5) || !this.main.isSupportive(trunc(javaFloat(this.x + 31)), trunc(javaFloat(this.y + 64)))) {
                    this.direction = Main.LEFT;
                    if (this.changeDirection) {
                        this.changeDirection = false;
                        this.changeDirectionDelay = 91;
                    } else {
                        this.changeDirection = true;
                    }
                }
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.lanceKnight[this.direction][LanceKnight.walkSpriteIndexes[this.spriteIndex]], this.x, this.y);
    }
}
