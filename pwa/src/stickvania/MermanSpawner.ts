import { GameContainer, Graphics } from "slick2d-ts";
import { Droplets } from "./Droplets.js";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Merman } from "./Merman.js";
import { Thing } from "./Thing.js";

export class MermanSpawner extends Thing {
    private static readonly BASE_ACTIVE_CAP: number = 2;
    private count: number = MermanSpawner.BASE_ACTIVE_CAP;
    private activeCap: number = MermanSpawner.BASE_ACTIVE_CAP;
    private delay: number = 0;
    private x1: number = 0;
    private x2: number = 0;
    private spawnVy: number = javaFloat(0);
    private simonSplashed: boolean = false;
    public constructor(main: Main, x1: number, x2: number, y: number) {
        super(main);

        this.y = javaFloat(y);
        this.x1 = x1;
        this.x2 = x2;
        const launchEnergy = javaFloat(javaFloat(2 * Main.GRAVITY) * (350 - y));
        this.spawnVy = -javaFloat(Math.sqrt(launchEnergy));
    }

    public mermanDied(): void {
        this.syncActiveCap();
        if (this.count < this.activeCap) {
            this.count++;
        }
    }

    public override update(gc: GameContainer): boolean {
        this.syncActiveCap();

        if (this.main.timeFrozen > 0) {
            return true;
        }

        if (this.main.simon!.x < this.x1 || this.main.simon!.x > this.x2) {
            return true;
        }

        if (this.main.simon!.y > 352 && !this.simonSplashed) {
            this.simonSplashed = true;
            this.main.pushThing(new Droplets(this.main, javaFloat(this.main.simon!.x + 24), 352, -1, -5.5));
            this.main.pushThing(new Droplets(this.main, javaFloat(this.main.simon!.x + 24), 352, 1, -5));
            this.main.pushThing(new Droplets(this.main, javaFloat(this.main.simon!.x + 24), 352, 0.2, -8));
            this.main.playSound(this.main.splash);
        }

        if (this.delay == 0) {
            this.delay = this.main.adjustEnemySpawnDelay(182);

            for (let i: number = 0; i < 16 && this.count > 0; i++) {
                if (this.main.random.nextBoolean()) {
                    let target: number = trunc(javaFloat(javaFloat(this.main.simon!.x + 64) + this.main.random.nextInt(192)));
                    if (target >= this.x1 && target <= this.x2) {
                        this.count--;
                        this.main.pushThing(new Merman(this.main, target, this.spawnVy, this));
                        break;
                    }
                } else {
                    let target: number = trunc(javaFloat(javaFloat(this.main.simon!.x - 64) - this.main.random.nextInt(192)));
                    if (target >= this.x1 && target <= this.x2) {
                        this.count--;
                        this.main.pushThing(new Merman(this.main, target, this.spawnVy, this));
                        break;
                    }
                }
            }
        } else {
            this.delay--;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {}
    private syncActiveCap(): void {
        let activeCap: number = this.main.adjustEnemyActiveCap(MermanSpawner.BASE_ACTIVE_CAP);
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
