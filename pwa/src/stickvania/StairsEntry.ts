import { StageSegment } from "./StageSegment.js";

export class StairsEntry {
    public segment: StageSegment = null;
    public x: number = 0;
    public y: number = 0;
    public direction: number = 0;
    public up: boolean = false;
    public connection: StairsEntry = null;
}
