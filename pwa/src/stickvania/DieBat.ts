import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class DieBat extends Thing {
    private static readonly spriteSequence: number[] = [1, 2, 3, 2];
    private direction: number = 0;
    private spriteIndex: number = 0;
    private spriteDelay: number = 0;
    private timeToLive: number = 91;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
    }

    public override update(gc: GameContainer): boolean {
        if (this.spriteDelay == 0) {
            this.spriteDelay = 10;
            if (this.spriteIndex == 0) {
                this.spriteIndex = 3;
            } else {
                this.spriteIndex--;
            }
        } else {
            this.spriteDelay--;
        }

        this.y = javaFloat(this.y - 1);
        if (this.timeToLive-- == 0) {
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.playSound(this.main.bat_killed);
            return false;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.bats[this.direction][DieBat.spriteSequence[this.spriteIndex]], this.x, this.y);
    }
}
