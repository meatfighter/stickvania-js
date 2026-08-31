import { Checkpoint } from "./Checkpoint.js";
import { Thing } from "./Thing.js";
import { ThingStack } from "./ThingStack.js";

export class Region {
    public min: number = 0;
    public max: number = 0;
    public checkpoint: Checkpoint = null!;
    public readonly thingStack: ThingStack = new ThingStack();
    public platforms: Thing[] = null!;
    public stageNumber: number = 0;
}
