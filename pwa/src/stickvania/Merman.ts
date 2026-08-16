import { GameContainer, Graphics } from "slick2d-ts";
import { Droplets } from "./Droplets.js";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { MermanSpawner } from "./MermanSpawner.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Merman extends Thing {
    private spriteIndexIncrementor: number = 0;
    private spriteIndex: number = 0;
    private direction: number = 0;
    private shootDelay: number = 0;
    private shooting: number = 0;
    private mermanSpawner: MermanSpawner = null;
    public constructor(main: Main, x: number, vy: number, mermanSpawner: MermanSpawner) {
        super(main, 1, 0, 30, 64);

        this.x = x;
        this.y = 352;
        this.vy = vy;
        this.mermanSpawner = mermanSpawner;
        this.direction = main.simon.x < x ? Main.LEFT : Main.RIGHT;

        this.shootDelay = main.adjustEnemyCooldown(main.random.nextInt(45) + 45);

        main.pushThing(new Droplets(main, x + 8, 352, -1, -5.5));
        main.pushThing(new Droplets(main, x + 8, 352, 1, -5));
        main.pushThing(new Droplets(main, x + 8, 352, 0.2, -8));

        main.playSound(main.splash);
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            if (this.main.random.nextBoolean()) {
                this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h")));
            }
            this.main.pushThing(new Flame(this.main, this.x, this.y + 24, 0, 0, -0.08, 0, 10));
            this.mermanSpawner.mermanDied();
            this.main.addPoints(300);
            this.main.playSound(this.main.killed_1);
            return false;
        }

        if ((this.vy > 0 && this.y > 352) || this.x < this.main.camera - 64 || this.x > this.main.camera + 576) {
            this.mermanSpawner.mermanDied();
            if (this.vy > 0 && this.y > 352) {
                this.main.pushThing(new Droplets(this.main, this.x + 8, 352, -1, -5.5));
                this.main.pushThing(new Droplets(this.main, this.x + 8, 352, 1, -5));
                this.main.pushThing(new Droplets(this.main, this.x + 8, 352, 0.2, -8));
                this.main.playSound(this.main.splash);
            }
            return false;
        }

        if (this.main.timeFrozen == 0) {
            this.applyGravity();

            if (this.supported) {
                if (this.shooting > 0) {
                    this.spriteIndex = 2;
                    if (--this.shooting == 0) {
                        this.direction = this.direction == Main.LEFT ? Main.RIGHT : Main.LEFT;
                        this.spriteIndex = 0;
                        this.spriteIndexIncrementor = 0;
                    }
                } else {
                    if (++this.spriteIndexIncrementor == 30) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 2) {
                            this.spriteIndex = 0;
                        }
                    }

                    if (this.direction == Main.LEFT) {
                        if (!this.moveX(-1)) {
                            this.direction = Main.RIGHT;
                        }
                    } else {
                        if (!this.moveX(1)) {
                            this.direction = Main.LEFT;
                        }
                    }

                    if (--this.shootDelay == 0) {
                        this.shootDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273) + 91);
                        this.shooting = 70;
                        this.main.pushThing(new Fireball(this.main, this.x + 8, this.y + 18, this.direction == Main.LEFT ? -1.5 : 1.5, 0));
                        this.main.playSound(this.main.merman_spit);
                    }
                }
            } else {
                this.spriteIndex = 0;
                this.direction = this.main.simon.x < this.x ? Main.LEFT : Main.RIGHT;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.mermen[this.direction][this.spriteIndex], this.x, this.y);
    }
}
