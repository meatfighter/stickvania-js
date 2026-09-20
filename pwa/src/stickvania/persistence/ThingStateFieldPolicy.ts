import type { ThingTypeId } from "./ThingTypeRegistry.js";

/** Physical/browser input edge state is rebuilt, never serialized as durable Thing state. */
export const THING_TRANSIENT_STATE_FIELDS = {
    Simon: ["releasedJump", "releasedKneel", "releasedWhip"]
} as const satisfies Partial<Record<ThingTypeId, readonly string[]>>;
