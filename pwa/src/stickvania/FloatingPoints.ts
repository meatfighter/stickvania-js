import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class FloatingPoints extends Thing {
    public static readonly TYPE_100: number = 0;
    public static readonly TYPE_400: number = 1;
    public static readonly TYPE_700: number = 2;
    public static readonly TYPE_1000: number = 3;
    public static readonly TYPE_2000: number = 4;
    public type: number = 0;
    public count: number = 0;
    public constructor(main: Main, x: number, y: number, type: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.type = type;

    }
    public update(gc: GameContainer): boolean {

        this.y -= 0.25;
        if (++this.count >= 91) {
            return false;
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.itemPoints[this.type], this.x, this.y);

    }
}
