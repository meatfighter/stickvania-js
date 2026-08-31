import { Region } from "./Region.js";
import { StairsEntry } from "./StairsEntry.js";

export class StageSegment {
    public direction: number = 0;
    public stageSegmentIndex: number = 0;
    public stage: number[][] = null!;
    public candleItems: string = "";
    public map: number[][] = null!;
    public walls: number[][] = null!;
    public mapWidth: number = 0;
    public regions: Region[] = null!;
    public regionIndex: number = 0;
    public stairsEntries: StairsEntry[] = null!;
}
