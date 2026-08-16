import { GameContainer, Graphics } from "slick2d-ts";
import { Bird } from "./Bird.js";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class BirdSpawner extends Thing {
    private static readonly BASE_ACTIVE_CAP: number = 3;
    private count: number = BirdSpawner.BASE_ACTIVE_CAP;
    private activeCap: number = BirdSpawner.BASE_ACTIVE_CAP;
    private delay: number = 0;
    private x1: number = 0;
    private x2: number = 0;
    public constructor(main: Main, x1: number, x2: number) {
        super(main);
        this.x1 = x1;
        this.x2 = x2;
    }

    public birdDied(): void {
        this.syncActiveCap();
        if (this.count < this.activeCap) {
            this.count++;
        }
    }

    public update(gc: GameContainer): boolean {
        this.syncActiveCap();

        if (this.main.timeFrozen > 0 || this.main.simon.x < this.x1 || this.main.simon.x > this.x2 || this.count == 0) {
            return true;
        }

        if (this.delay == 0) {
            this.delay = this.main.adjustEnemySpawnDelay(182);

            this.count--;
            let Y: number = ((trunc(this.main.simon.y) >> 5) << 5) - (this.main.random.nextInt(4) << 5) - 64;
            if (Y < 0) {
                Y = 0;
            }
            let direction: number = this.main.random.nextBoolean()
                ? this.main.simon.direction == Main.LEFT
                    ? Main.RIGHT
                    : Main.LEFT
                : this.main.random.nextBoolean()
                  ? Main.LEFT
                  : Main.RIGHT;
            if (direction == Main.LEFT) {
                this.main.pushThing(new Bird(this.main, this.main.camera + 512, Y, direction, this));
            } else {
                this.main.pushThing(new Bird(this.main, this.main.camera - 64, Y, direction, this));
            }
        } else {
            this.delay--;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {}
    private syncActiveCap(): void {
        if (!Number.isFinite(this.activeCap)) {
            this.activeCap = BirdSpawner.BASE_ACTIVE_CAP;
        }
        if (!Number.isFinite(this.count)) {
            this.count = this.activeCap;
        }
        let activeCap: number = this.main.adjustEnemyActiveCap(BirdSpawner.BASE_ACTIVE_CAP);
        if (activeCap == this.activeCap) {
            return;
        }
        this.count += activeCap - this.activeCap;
        if (this.count < 0) {
            this.count = 0;
        } else if (this.count > activeCap) {
            this.count = activeCap;
        }
        this.activeCap = activeCap;
    }
}
