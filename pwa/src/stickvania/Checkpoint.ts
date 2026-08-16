import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Song } from "./Song.js";
import { Thing } from "./Thing.js";

export class Checkpoint extends Thing {
    public stageSegmentIndex: number = 0;
    public regionIndex: number = 0;
    public song: Song = null;
    public constructor(main: Main, x: number, y: number, stageSegmentIndex: number, regionIndex: number) {
        super(main);

        this.x = x;
        this.y = y;
        this.stageSegmentIndex = stageSegmentIndex;
        this.regionIndex = regionIndex;

    }
    public update(gc: GameContainer): boolean {

        this.main.checkpointReached(this);

        return false;

    }
    public render(gc: GameContainer, g: Graphics): void {

    }
}
