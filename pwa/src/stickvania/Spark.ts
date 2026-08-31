import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Spark extends Thing {
    private counter = 0;

    public constructor(main: Main, x: number, y: number, width: number, height: number);
    public constructor(main: Main, thingThatSparked: Thing);
    public constructor(main: Main, xOrThing: number | Thing, y?: number, width?: number, height?: number) {
        if (y !== undefined) {
            y = javaFloat(y);
        }
        super(main, 32, 32);
        if (xOrThing instanceof Thing) {
            const thingThatSparked = xOrThing;
            const sparkWidth = thingThatSparked.rx2 - thingThatSparked.rx1 + 1;
            const sparkHeight = thingThatSparked.ry2 - thingThatSparked.ry1 + 1;
            this.x = javaFloat(javaFloat(javaFloat(thingThatSparked.x + thingThatSparked.rx1) + main.random.nextInt(sparkWidth)) - 16);
            this.y = javaFloat(javaFloat(javaFloat(thingThatSparked.y + thingThatSparked.ry1) + main.random.nextInt(sparkHeight)) - 16);
        } else {
            const x = javaFloat(xOrThing);
            const normalizedY = y as number;
            this.x = javaFloat(javaFloat(x + main.random.nextInt(width as number)) - 16);
            this.y = javaFloat(javaFloat(normalizedY + main.random.nextInt(height as number)) - 16);
        }
    }

    public override update(_gc: GameContainer): boolean {
        if (++this.counter === 10) {
            return false;
        }
        return true;
    }

    public override render(_gc: GameContainer, _g: Graphics): void {
        this.main.draw(this.main.spark, this.x, this.y);
    }
}
