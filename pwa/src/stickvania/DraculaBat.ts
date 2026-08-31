import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class DraculaBat extends Thing {
    private static readonly spriteSequence: number[] = [1, 2, 3, 2];
    public direction: number = 0;
    private spriteIndex: number = 0;
    private spriteDelay: number = 0;
    public amplitude: number = javaFloat(0);
    public Y: number = javaFloat(0);

    public constructor(main: Main) {
        super(main, 32, 32);
        this.spriteDelay = main.random.nextInt(11);
        this.spriteIndex = main.random.nextInt(4);
    }

    public override update(_gc: GameContainer): boolean {
        if (this.spriteDelay === 0) {
            this.spriteDelay = 10;
            if (this.spriteIndex === 0) {
                this.spriteIndex = 3;
            } else {
                this.spriteIndex--;
            }
        } else {
            this.spriteDelay--;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void;
    public render(gc: GameContainer, g: Graphics, fade: number): void;
    public override render(_gc: GameContainer, _g: Graphics, fade?: number): void {
        const image = this.main.bats[this.direction][DraculaBat.spriteSequence[this.spriteIndex]];
        if (fade === undefined) {
            this.main.draw(image, this.x, this.y);
        } else {
            this.main.drawFaded(image, this.x, this.y, javaFloat(fade));
        }
    }
}
