import { GameContainer, Graphics } from "slick2d-ts";
import { DropItem } from "./DropItem.js";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Secret extends Thing {
    private delay: number = 0;
    public constructor(main: Main, x: number, y: number) {
        super(main, 576, 128);
        this.x = x;
        this.y = y;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsSimon(this)) {
            if (this.delay > 0) {
                this.delay--;
            } else {
                this.delay = 91;

                let X: number = trunc(this.main.simon.x + this.main.random.nextInt(32));

                if (this.main.simon.whipType + this.main.visibleWhipCount < 2) {
                    this.main.whipCreated();
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_WHIP));
                } else if (this.main.hearts < 99) {
                    if (this.main.hearts + 5 >= 99) {
                        this.delay = 91;
                    } else {
                        this.delay = 10;
                    }
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_LARGE_HEART));
                } else if (this.main.weaponType != Main.WEAPON_TYPE_BOOMERANG) {
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_BOOMERANG));
                } else if (this.main.weaponRepeats == 0) {
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_DOUBLE));
                } else if (this.main.weaponRepeats == 1) {
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_TRIPLE));
                } else if (this.main.playerPower != 16) {
                    this.main.pushThing(new DropItem(this.main, X, -32, DropItem.TYPE_MEAT));
                }
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {}
}
