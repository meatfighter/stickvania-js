import { GameContainer, Graphics } from "slick2d-ts";
import { BrickFragment } from "./BrickFragment.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class FloorBreaker extends Thing {
    private breakDelay: number = 91;
    private X: number = 159;
    private delay: number = 1;
    public constructor(main: Main) {
        super(main);

    }
    private removeBlock(a: number, b: number): void {
        this.main.removeBlock(a, b);
        let x: number = a << 5;
        let y: number = b << 5;
        this.main.pushThing(new BrickFragment(this.main, x, y, -1, -2));
        this.main.pushThing(new BrickFragment(this.main, x + 8, y, 1, -3));
        this.main.pushThing(new BrickFragment(this.main, x, y + 8, -1, -4));
        this.main.pushThing(new BrickFragment(this.main, x + 8 + 8, y, 1, -5));
        this.main.playSound(this.main.breaks_wall);

    }
    public update(gc: GameContainer): boolean {

        if (this.breakDelay <= 0) {
            this.breakDelay = 23;
            if (this.main.walls[6][144] != Main.WALL_EMPTY) {
                this.removeBlock(144, 6);
            } else if (this.main.walls[6][145] != Main.WALL_EMPTY) {
                this.removeBlock(145, 6);
            } else if (this.main.walls[7][146] != Main.WALL_EMPTY) {
                this.removeBlock(146, 7);
            } else if (this.main.walls[8][147] != Main.WALL_EMPTY) {
                this.removeBlock(147, 8);
            } else if (this.X != 143) {
                this.removeBlock(this.X, 10);
                this.X--;
            } else if (this.delay > 0) {
                this.delay--;
            } else {
                this.main.floorBreaking = false;
                this.main.fadeState = Main.FADE_OUT;
                this.main.fadeReason = Main.FADE_REASON_SHOW_MAP;
                return false;
            }
        } else {
            this.breakDelay--;
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {

    }
}
