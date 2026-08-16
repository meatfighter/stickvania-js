import { GameContainer, Graphics } from "slick2d-ts";
import { BrickFragment } from "./BrickFragment.js";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class BreakWall extends Thing {
    public item: number = 0;
    private i: number = 0;
    private j: number = 0;
    public constructor(main: Main, j: number, i: number, item: number) {
        super(main, 32, 32);
        this.i = i;
        this.j = j;
        this.x = j << 5;
        this.y = i << 5;
        this.item = item;

    }
    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this)) {
            this.main.removeBlock(this.j, this.i);
            this.main.pushThing(new BrickFragment(this.main, this.x, this.y, -1, -2));
            this.main.pushThing(new BrickFragment(this.main, this.x + 8, this.y, 1, -3));
            this.main.pushThing(new BrickFragment(this.main, this.x, this.y + 8, -1, -4));
            this.main.pushThing(new BrickFragment(this.main, this.x + 8 + 8, this.y, 1, -5));
            this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), this.item));
            this.main.playSound(this.main.breaks_wall);
            return false;
        }
        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {


    }
}
