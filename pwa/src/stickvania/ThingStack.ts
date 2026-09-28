import { makeArray } from "./JavaMath.js";
import { Thing } from "./Thing.js";

export class ThingStack {
    public things: Array<Thing | null> = makeArray<Thing | null>(32, () => null);
    public top: number = -1;

    public push(thing: Thing): void {
        if (thing === null || thing === undefined) throw new TypeError("ThingStack cannot contain a null Thing.");
        this.top++;
        if (this.top === this.things.length) {
            const things2 = makeArray<Thing | null>(this.things.length + 16, () => null);
            for (let i = 0; i < this.things.length; i++) {
                things2[i] = this.things[i];
            }
            this.things = things2;
        }
        this.things[this.top] = thing;
    }

    public pop(): Thing | null {
        if (this.top === -1) {
            return null;
        }
        const thing = this.things[this.top];
        this.things[this.top] = null;
        this.top--;
        return thing;
    }

    public clear(): void {
        let thing: Thing | null;
        while ((thing = this.pop()) !== null) {
            thing.onDiscarded();
        }
    }

    public moveAll(thingStack: ThingStack): void {
        let thing: Thing | null;
        while ((thing = thingStack.pop()) !== null) {
            this.push(thing);
        }
    }

    public addAll(thingStack: ThingStack): void {
        const stackThings = thingStack.things;
        for (let i = thingStack.top; i >= 0; i--) {
            this.push(stackThings[i]!);
        }
    }
}
