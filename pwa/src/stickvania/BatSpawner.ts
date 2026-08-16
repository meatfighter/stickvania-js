import { GameContainer, Graphics } from "slick2d-ts";
import { Bat } from "./Bat.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class BatSpawner extends Thing {
    public x1: number = 0;
    public x2: number = 0;
    public delay: number = 0;
    public constructor(main: Main, x1: number, x2: number) {
        super(main);
        this.x1 = x1;
        this.x2 = x2;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.timeFrozen > 0) {
            return true;
        }

        if (this.main.simon.x < this.x1 || this.main.simon.x > this.x2) {
            return true;
        }

        if (this.delay == 0) {
            this.delay = this.main.adjustEnemySpawnDelay(546);
            if (this.main.simon.direction == Main.RIGHT) {
                this.main.pushThing(new Bat(this.main, this.main.camera + 520, this.main.simon.y + 8, Main.LEFT));
            } else {
                this.main.pushThing(new Bat(this.main, this.main.camera - 40, this.main.simon.y + 8, Main.RIGHT));
            }
        } else {
            this.delay--;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {}
}
