import { GameContainer, Graphics } from "slick2d-ts";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { StageSegment } from "./StageSegment.js";
import { Thing } from "./Thing.js";

export class FadingStairs extends Thing {
    private static readonly FRACTION: number = 1 / 91;
    private fading: boolean = false;
    private fade: number = 91;
    private segment: StageSegment = null;
    public constructor(main: Main, x: number, y: number, segment: StageSegment) {
        super(main, 96, 64);
        this.x = x;
        this.y = y;
        this.segment = segment;

    }
    public update(gc: GameContainer): boolean {

        if (this.fading) {
            if (--this.fade == 0) {
                return false;
            }
        } else if ((trunc(this.main.simon.y)) <= 224) {
            this.fading = true;
            this.segment.map[10][1] = Main.BLOCK_EMPTY;
            this.segment.map[9][2] = Main.BLOCK_E;
            this.segment.walls[10][1] = Main.WALL_EMPTY;
            this.segment.walls[9][2] = Main.WALL_PLATFORM;
            this.main.requestSong(this.main.stage_4_2);
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        if (this.fading) {
            let alpha: number = this.fade * FadingStairs.FRACTION;
            this.main.drawFaded(this.main.blocks[Main.BLOCK_STAIRS_RIGHT_CAPPED], 64, 288, alpha);
            this.main.drawFaded(this.main.blocks[Main.BLOCK_STAIRS_RIGHT], 32, 320, alpha);
        }

    }
}
