import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Spark extends Thing {
    private counter = 0;

    public constructor(main: Main, xOrThing: number | Thing, y?: number, width?: number, height?: number) {
        super(main, 32, 32);
        if (xOrThing instanceof Thing) {
            const thingThatSparked = xOrThing;
            const sparkWidth = thingThatSparked.rx2 - thingThatSparked.rx1 + 1;
            const sparkHeight = thingThatSparked.ry2 - thingThatSparked.ry1 + 1;
            this.x = thingThatSparked.x + thingThatSparked.rx1 + main.random.nextInt(sparkWidth) - 16;
            this.y = thingThatSparked.y + thingThatSparked.ry1 + main.random.nextInt(sparkHeight) - 16;
        } else {
            this.x = xOrThing + main.random.nextInt(width as number) - 16;
            this.y = (y as number) + main.random.nextInt(height as number) - 16;
        }
    }

    public update(_gc: GameContainer): boolean {
        if (++this.counter === 10) {
            return false;
        }
        return true;
    }

    public render(_gc: GameContainer, _g: Graphics): void {
        this.main.draw(this.main.spark, this.x, this.y);
    }
}
