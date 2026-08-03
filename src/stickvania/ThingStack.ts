import { makeArray } from "./JavaMath.js";
import { Thing } from "./Thing.js";

export class ThingStack {
    public things: Thing[] = makeArray<Thing>(32, () => null);
    public top: number = -1;

    public push(thing: Thing): void {
        this.top++;
        if (this.top === this.things.length) {
            const things2: Thing[] = makeArray<Thing>(this.things.length + 16, () => null);
            for (let i = 0; i < this.things.length; i++) {
                things2[i] = this.things[i];
            }
            this.things = things2;
        }
        this.things[this.top] = thing;
    }

    public pop(): Thing {
        if (this.top === -1) {
            return null;
        }
        const thing: Thing = this.things[this.top];
        this.things[this.top] = null;
        this.top--;
        return thing;
    }

    public clear(): void {
        while (this.pop() !== null) {
        }
    }

    public moveAll(thingStack: ThingStack): void {
        let thing: Thing = null;
        while ((thing = thingStack.pop()) !== null) {
            this.push(thing);
        }
    }

    public addAll(thingStack: ThingStack): void {
        const stackThings: Thing[] = thingStack.things;
        for (let i: number = thingStack.top; i >= 0; i--) {
            this.push(stackThings[i]);
        }
    }
}
