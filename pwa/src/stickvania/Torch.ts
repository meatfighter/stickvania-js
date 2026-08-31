import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Torch extends Thing {
    public spriteIndexIncrementor: number = 0;
    public spriteIndex: number = 3;
    public item: number = 0;
    public constructor(main: Main, x: number, y: number, item: number) {
        super(main, 32, 64);

        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.item = item;
    }

    public override update(gc: GameContainer): boolean {
        if (++this.spriteIndexIncrementor == 15) {
            this.spriteIndexIncrementor = 0;
            if (++this.spriteIndex == 5) {
                this.spriteIndex = 3;
            }
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), this.item)!);
            this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 24), 0, 0, -0.08, 0, 10));
            this.main.playSound(this.main.torch_breaks);
            return false;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.fires[this.spriteIndex], this.x, this.y);
        this.main.draw(this.main.torch, this.x, javaFloat(this.y + 32));
    }
}
