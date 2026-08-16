import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class BoneDragonVertebra extends Thing {
    public tx: number = 0;
    public ty: number = 0;
    public angle: number = 0;
    public constructor(main: Main, x: number, y: number) {
        super(main, 16, 32);
        this.x = x;
        this.y = y;
    }

    public update(gc: GameContainer): boolean {
        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.boneDragons[2], this.x, this.y, this.angle);
    }
}
