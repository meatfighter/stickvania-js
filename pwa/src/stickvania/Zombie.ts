import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { ZombieSpawner } from "./ZombieSpawner.js";

export class Zombie extends Thing {
    private spriteIndexIncrementor: number = 0;
    private spriteIndex: number = 0;
    private direction: number = 0;
    private zombieSpawner: ZombieSpawner = null;
    public constructor(main: Main, x: number, y: number, direction: number, zombieSpawner: ZombieSpawner) {
        super(main, 1, 0, 30, 64);
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.zombieSpawner = zombieSpawner;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            if (this.main.random.nextBoolean()) {
                this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h")));
            }
            this.main.pushThing(new Flame(this.main, this.x, this.y + 24, 0, 0, -0.08, 0, 10));
            this.zombieSpawner.zombieDied();
            this.main.addPoints(100);
            this.main.playSound(this.main.zombie_killed);
            return false;
        }

        if (this.y > 352 || this.x < this.main.camera - 320 || this.x > this.main.camera + 768) {
            this.zombieSpawner.zombieDied();
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (++this.spriteIndexIncrementor == 45) {
                this.spriteIndexIncrementor = 0;
                if (++this.spriteIndex == 2) {
                    this.spriteIndex = 0;
                }
            }

            this.applyGravity();

            if (this.direction == Main.LEFT) {
                if (this.supported && !this.moveX(-1)) {
                    this.direction = Main.RIGHT;
                }
            } else {
                if (this.supported && !this.moveX(1)) {
                    this.direction = Main.LEFT;
                }
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.zombies[this.direction][this.spriteIndex], this.x, this.y);
    }
}
