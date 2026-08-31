import { GameContainer, Graphics } from "slick2d-ts";
import { BirdSpawner } from "./BirdSpawner.js";
import { Flame } from "./Flame.js";
import { Igor } from "./Igor.js";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Bird extends Thing {
    private direction: number = 0;
    private birdSpawner: BirdSpawner = null!;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private dropped: boolean = false;
    public constructor(main: Main, x: number, y: number, direction: number, birdSpawner: BirdSpawner) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 64, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = direction;
        this.birdSpawner = birdSpawner;

        this.vx = javaFloat(direction == Main.LEFT ? -4 : 4);
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, -0.9, 0, -0.06, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), this.y, 1, 0, -0.08, 0, 10));
            this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 32), 0, 0, 0.05, 0, 10));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 32), javaFloat(this.y + 32), 0, 0, 0.08, 0, 10));
            this.main.addPoints(300);
            this.birdSpawner.birdDied();
            this.main.playSound(this.main.killed_2);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            this.x = javaFloat(this.x + this.vx);
            this.vx = javaFloat(this.vx * 0.95);
            if (++this.spriteIndexIncrementor == 46) {
                this.spriteIndexIncrementor = 0;
                if (++this.spriteIndex == 2) {
                    this.spriteIndex = 0;
                }
                this.vx = javaFloat(this.direction == Main.LEFT ? -4 : 4);
                this.main.playSound(this.main.wing_flaps);
            }

            if (this.x < this.main.camera - 96 || this.x > this.main.camera + 608) {
                this.birdSpawner.birdDied();
                return false;
            }

            if (!this.dropped && Math.abs(javaFloat(javaFloat(this.main.simon!.x + 16) - this.x)) < 128) {
                let X: number = trunc(this.x) + 16;
                let Y: number = trunc(this.y) + 56;
                if (
                    this.main.getWall(X, Y) == Main.WALL_EMPTY &&
                    this.main.getWall(X + 32, Y) == Main.WALL_EMPTY &&
                    this.main.getWall(X, Y + 32) == Main.WALL_EMPTY &&
                    this.main.getWall(X + 32, Y + 32) == Main.WALL_EMPTY
                ) {
                    this.dropped = true;
                    this.main.pushThing(new Igor(this.main, X, Y));
                }
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.birds[this.direction][this.spriteIndex], this.x, this.y);
        if (!this.dropped) {
            this.main.draw(this.main.igors[this.direction][0], javaFloat(this.x + 16), javaFloat(this.y + 56));
        }
    }
}
