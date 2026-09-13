import { Fireball } from "../Fireball.js";
import type { Main } from "../Main.js";
import { StopWatch } from "../StopWatch.js";
import type { Thing } from "../Thing.js";
import type { ThingTypeId } from "./ThingTypeRegistry.js";

export const THING_REHYDRATOR_TYPE_IDS = ["Fireball", "StopWatch"] as const satisfies readonly ThingTypeId[];

export function rehydrateThingAfterStateRestore(type: ThingTypeId, thing: Thing, main: Main): void {
    switch (type) {
        case "Fireball":
            if (!(thing instanceof Fireball)) {
                throw new Error("Saved Fireball did not restore with the Fireball prototype.");
            }
            thing.main = main;
            thing.restoreRuntimeStateAfterStateLoad();
            return;
        case "StopWatch":
            if (!(thing instanceof StopWatch)) {
                throw new Error("Saved StopWatch did not restore with the StopWatch prototype.");
            }
            thing.main = main;
            thing.restoreRuntimeStateAfterStateLoad();
            return;
        default:
            return;
    }
}
