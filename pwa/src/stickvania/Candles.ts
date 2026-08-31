import { GameContainer, Graphics } from "slick2d-ts";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Candles extends Thing {
    public spriteIndexIncrementor: number = 0;
    public spriteIndex: number = 0;
    public item: number = 0;
    public constructor(main: Main, x: number, y: number, item: number) {
        super(main, 16, 32);

        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.item = item;
    }

    public override update(gc: GameContainer): boolean {
        if (++this.spriteIndexIncrementor == 15) {
            this.spriteIndexIncrementor = 0;
            if (++this.spriteIndex == 2) {
                this.spriteIndex = 0;
            }
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(this.main.createCandleItem(trunc(javaFloat(this.x - 8)), trunc(this.y), this.item)!);
            this.main.playSound(this.main.hit_candle);
            return false;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.candles[this.spriteIndex], this.x, this.y);
    }
}
