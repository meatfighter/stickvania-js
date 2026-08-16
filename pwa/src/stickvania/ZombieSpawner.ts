import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { Zombie } from "./Zombie.js";

export class ZombieSpawner extends Thing {
    private static readonly BASE_ACTIVE_CAP: number = 3;
    private count: number = ZombieSpawner.BASE_ACTIVE_CAP;
    private activeCap: number = ZombieSpawner.BASE_ACTIVE_CAP;
    private delay: number = 0;
    private x1: number = 0;
    private x2: number = 0;
    public constructor(main: Main, x1: number, x2: number, y: number) {
        super(main);
        this.y = y;
        this.x1 = x1;
        this.x2 = x2;
    }

    public zombieDied(): void {
        this.syncActiveCap();
        if (this.count < this.activeCap) {
            this.count++;
        }
    }

    public update(gc: GameContainer): boolean {
        this.syncActiveCap();

        if (this.main.timeFrozen > 0) {
            return true;
        }

        if (this.main.simon.x < this.x1 || this.main.simon.x > this.x2) {
            return true;
        }

        if (this.delay == 0) {
            this.delay = this.main.adjustEnemySpawnDelay(273);

            for (let i: number = 0; i < 16 && this.count > 0; i++) {
                if (this.main.random.nextBoolean()) {
                    let target: number = this.main.camera + 514 + ((this.count - 1) << 6);
                    if (target >= this.x1 && target <= this.x2) {
                        this.count--;
                        this.main.pushThing(new Zombie(this.main, target, this.y, Main.LEFT, this));
                    }
                } else {
                    let target: number = this.main.camera - 66 - ((this.count - 1) << 6);
                    if (target >= this.x1 && target <= this.x2) {
                        this.count--;
                        this.main.pushThing(new Zombie(this.main, target, this.y, Main.RIGHT, this));
                    }
                }
            }
        } else {
            this.delay--;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {}
    private syncActiveCap(): void {
        if (!Number.isFinite(this.activeCap)) {
            this.activeCap = ZombieSpawner.BASE_ACTIVE_CAP;
        }
        if (!Number.isFinite(this.count)) {
            this.count = this.activeCap;
        }
        let activeCap: number = this.main.adjustEnemyActiveCap(ZombieSpawner.BASE_ACTIVE_CAP);
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
