import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class BoneDragonVertebra extends Thing {
    public tx: number = javaFloat(0);
    public ty: number = javaFloat(0);
    public angle: number = javaFloat(0);
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 16, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
    }

    public override update(gc: GameContainer): boolean {
        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.boneDragons[2], this.x, this.y, this.angle);
    }
}
