import type { AppGameContainer } from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { Thing } from "./stickvania/Thing.js";
import { ThingStack } from "./stickvania/ThingStack.js";
import { Candles } from "./stickvania/Candles.js";
import { Torch } from "./stickvania/Torch.js";
import { BreakWall } from "./stickvania/BreakWall.js";
import { BoneDragon } from "./stickvania/BoneDragon.js";
import { Spark } from "./stickvania/Spark.js";
import { Boomerang } from "./stickvania/Boomerang.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";

type Mounted = { main: Main; container: AppGameContainer };
type Harness = {
    mountMain(restore: ((main: Main, container: AppGameContainer) => boolean) | null): Promise<Mounted>;
    destroyMounted(mounted: Mounted | null): void;
    advanceFrames(mounted: Mounted, count: number): void;
    gameplaySnapshot(serializer: StickvaniaGameStateSerializer, main: Main): string;
};
function check(ok: unknown, label: string): asserts ok {
    if (!ok) throw new Error(label);
}
function difference(a: unknown, b: unknown, path = ""): string {
    if (JSON.stringify(a) === JSON.stringify(b)) return "";
    if (a && b && typeof a === "object" && typeof b === "object")
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const d = difference(Reflect.get(a, k), Reflect.get(b, k), path + "." + k);
            if (d) return d;
        }
    return path + ": " + JSON.stringify(a) + " != " + JSON.stringify(b);
}
function active(stack: ThingStack): Array<Thing | null> {
    return stack.things.slice(0, stack.top + 1);
}

/** Loaded-map tests. Positioning, whip phase and head damage are explicit boundary setup. */
export async function verifyNullThingBoundary(h: Harness): Promise<void> {
    let mounted: Mounted | null = await h.mountMain(null);
    const serializer = new StickvaniaGameStateSerializer(),
        store = new StickvaniaGameStateStore("null-boundary");
    const cases: string[] = [];
    const current = (): Mounted => {
        check(mounted, "Mounted null fixture");
        return mounted;
    };
    const frame = (): void => {
        h.advanceFrames(current(), 1);
        current().main.render(current().container, current().container.getGraphics());
    };
    const setup = (difficulty: number): Main => {
        const m = current().main;
        Reflect.set(m, "demoIndex", 2);
        m.initDemo();
        m.mode = Main.MODE_PLAYING;
        m.setDifficulty(difficulty);
        m.fade = 0;
        m.fadeState = Main.FADE_DONE;
        m.regionThingStack.clear();
        m.regionStackSwap.clear();
        m.weaponsStack.clear();
        m.weaponsStackSwap.clear();
        check(m.simon, "Loaded Simon");
        Object.assign(m.simon, {
            x: 96,
            y: 256,
            lastX: 96,
            lastY: 256,
            direction: Main.RIGHT,
            whipType: 2,
            whipping: true,
            whipIndex: 2,
            whipIncrementor: 21,
            throwing: false,
            dead: 0,
            hurt: false,
            flashing: 0,
            invincible: 200
        });
        m.syncSimonPhysicsProfile();
        return m;
    };
    try {
        for (const difficulty of [Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD])
            for (const item of [Main.CANDLE_ITEM_EMPTY, Main.CANDLE_ITEM_SMALL_HEART]) {
                for (const kind of ["Candles", "Torch", "BreakWall", "BoneDragon"]) {
                    const m = setup(difficulty);
                    let actor: Thing | null = null;
                    // Find a real grid-aligned overlap through the production whip geometry.
                    for (let i = 2; i < 10 && actor === null; i++)
                        for (let j = 2; j < 12 && actor === null; j++) {
                            const candidate =
                                kind === "Candles"
                                    ? new Candles(m, j * 32, i * 32, item)
                                    : kind === "Torch"
                                      ? new Torch(m, j * 32, i * 32, item)
                                      : kind === "BreakWall"
                                        ? new BreakWall(m, j, i, item)
                                        : new BoneDragon(m, j * 32, i * 32, item, false);
                            if (m.intersectsWhip(candidate)) actor = candidate;
                        }
                    check(actor, "Loaded whip overlap " + kind);
                    if (actor instanceof BoneDragon) actor.hits = 1;
                    if (actor instanceof BreakWall) {
                        check(m.map && m.walls, "Loaded map");
                        m.map[actor.y / 32][actor.x / 32] = 1;
                        m.walls[actor.y / 32][actor.x / 32] = Main.WALL_FULL;
                    }
                    const lower = new Spark(m, 32, 32, 1, 1),
                        upper = new Spark(m, 48, 32, 1, 1),
                        order: string[] = [];
                    for (const [thing, label] of [
                        [lower, "lower"],
                        [actor, "actor"],
                        [upper, "upper"]
                    ] as const) {
                        const update = thing.update.bind(thing);
                        thing.update = (gc) => {
                            order.push(label);
                            return update(gc);
                        };
                        m.pushThing(thing);
                    }
                    m.weaponType = Main.WEAPON_TYPE_BOOMERANG;
                    m.weaponsStack.push(new Boomerang(m, actor.x, actor.y, Main.RIGHT));
                    const pushed: Thing[] = [],
                        push = m.pushThing.bind(m);
                    // Observe actual effects while preserving both overloaded production insertion routes.
                    m.pushThing = ((a: ThingStack[] | Thing | null, b?: Thing | null) => {
                        if (Array.isArray(a)) push(a, b ?? null);
                        else {
                            if (a !== null) pushed.push(a);
                            push(a);
                        }
                    }) as Main["pushThing"];
                    try {
                        frame();
                    } finally {
                        m.pushThing = push;
                    }
                    check(JSON.stringify(order) === JSON.stringify(["upper", "actor", "lower"]), kind + " both sides update exactly once");
                    check(active(m.regionThingStack).every((t) => t !== null) && m.regionStackSwap.top === -1, kind + " dense drained stacks");
                    for (const effect of pushed)
                        if (effect instanceof Spark) check(Reflect.get(effect, "counter") === 1, "Inserted spark updated in same frame");
                    if (actor instanceof BreakWall)
                        check(
                            m.map?.[actor.y / 32][actor.x / 32] === Main.BLOCK_EMPTY && m.walls?.[actor.y / 32][actor.x / 32] === Main.BLOCK_EMPTY,
                            "Actual map destruction"
                        );
                    order.length = 0;
                    frame();
                    check(
                        order.filter((x) => x === "lower").length === 1 && order.filter((x) => x === "upper").length === 1,
                        "Second frame preserves both probes"
                    );
                    if (actor instanceof BoneDragon) {
                        check(actor.dead, "Real head death");
                        for (let i = 0; i < 6; i++) {
                            Reflect.set(actor, "deadDelay", 1);
                            frame();
                            check(Reflect.get(actor, "minIndex") === i + 1, "Actual vertebra event " + i);
                            check(
                                active(m.regionThingStack).every((t) => t !== null),
                                "Dense vertebra effects"
                            );
                        }
                    }
                    cases.push(`${difficulty}:${item}:${kind}:two-frames-and-effects`);
                }
            }
        const m = setup(Main.DIFFICULTY_NORMAL);
        m.simon!.whipping = false;
        const alias = new Spark(m, 64, 64, 1, 1);
        for (const stack of [m.regionThingStack, m.regionStackSwap, m.weaponsStackSwap, m.oldThingStack]) stack.push(alias);
        m.weaponType = Main.WEAPON_TYPE_BOOMERANG;
        m.weaponsStack.push(new Boomerang(m, 160, 64, Main.RIGHT));
        check(store.save(m, () => true).saved, "Valid swap roots and nullable Boomerang reference");
        const validBytes = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        check(validBytes, "Valid bytes");
        const valid = JSON.parse(validBytes) as unknown;
        const paths: string[][] = [];
        const walk = (v: unknown, path: string[]): void => {
            if (v === null || typeof v !== "object") return;
            if (Object.hasOwn(v, "$stack")) paths.push(path);
            for (const [key, value] of Object.entries(v)) walk(value, [...path, key]);
        };
        walk(valid, []);
        check(paths.length >= 5, "Named and nested region stacks");
        const get = (v: unknown, path: string[]): unknown => path.reduce<unknown>((a, k) => Reflect.get(a as object, k), v);
        for (const path of paths)
            for (const index of [0, 1, 2]) {
                const bad = structuredClone(valid),
                    stack = Reflect.get(get(bad, path) as object, "$stack") as { capacity: number; things: unknown[] };
                const id = serializer.createSnapshot(m, "null-boundary").stage!.regionThingStack.$stack.things[0];
                stack.things = [id, id, id];
                stack.capacity = Math.max(3, stack.capacity);
                stack.things[index] = null;
                const bytes = JSON.stringify(bad),
                    before = h.gameplaySnapshot(serializer, m);
                localStorage.setItem(GAME_STATE_STORAGE_KEY, bytes);
                const set = Storage.prototype.setItem,
                    remove = Storage.prototype.removeItem;
                let writes = 0;
                Storage.prototype.setItem = function (k, v) {
                    writes++;
                    set.call(this, k, v);
                };
                Storage.prototype.removeItem = function (k) {
                    writes++;
                    remove.call(this, k);
                };
                try {
                    check(!store.hasValidSave() && !store.restore(m, current().container), "Reject active null " + path.join(".") + ":" + index);
                } finally {
                    Storage.prototype.setItem = set;
                    Storage.prototype.removeItem = remove;
                }
                check(writes === 0 && localStorage.getItem(GAME_STATE_STORAGE_KEY) === bytes, "Non-writing rejection");
                check(h.gameplaySnapshot(serializer, m) === before, "Rejected reader leaves live graph untouched");
                check(store.save(m, () => true).saved, "Later authorized valid overwrite");
            }
        for (const version of [...Array.from({ length: 21 }, (_, i) => i), 22]) {
            const bad = JSON.parse(validBytes);
            bad.version = version;
            const bytes = JSON.stringify(bad);
            localStorage.setItem(GAME_STATE_STORAGE_KEY, bytes);
            check(!store.hasValidSave() && !store.restore(m, current().container), "Exact-current schema rejection");
            check(localStorage.getItem(GAME_STATE_STORAGE_KEY) === bytes, "Schema miss preserves bytes");
        }
        for (const top of [-2, 0.5, m.regionThingStack.things.length]) {
            const old = m.regionThingStack.top;
            m.regionThingStack.top = top;
            localStorage.setItem(GAME_STATE_STORAGE_KEY, validBytes);
            check(!store.save(m, () => true).saved, "Bad active bounds fail capture");
            check(localStorage.getItem(GAME_STATE_STORAGE_KEY) === validBytes, "Failed bounds preserve earlier save");
            m.regionThingStack.top = old;
        }
        const old = m.regionThingStack.things[0];
        m.regionThingStack.things[0] = null;
        check(!store.save(m, () => true).saved && localStorage.getItem(GAME_STATE_STORAGE_KEY) === validBytes, "Outgoing active null preserves bytes");
        m.regionThingStack.things[0] = old;
        check(store.save(m, () => true).saved, "Valid recovery save");
        const before = h.gameplaySnapshot(serializer, m);
        h.destroyMounted(mounted);
        mounted = null;
        mounted = await h.mountMain((main, gc) => store.restore(main, gc));
        check(
            h.gameplaySnapshot(serializer, current().main) === before,
            "Fresh graph and stack capacity equality " + difference(JSON.parse(before), JSON.parse(h.gameplaySnapshot(serializer, current().main)))
        );
        const fresh = current().main;
        check(
            fresh.regionThingStack.things[0] === fresh.regionStackSwap.things[0] && fresh.regionThingStack.things[0] === fresh.weaponsStackSwap.things[0],
            "Swap root alias identity"
        );
        fresh.render(current().container, current().container.getGraphics());
        check(h.gameplaySnapshot(serializer, fresh) === before, "First render preserves exact saved graph");
        check(fresh.weaponsStack.things[0] instanceof Boomerang && fresh.weaponsStack.things[0].shieldBlockedBy === null, "Nullable shield target preserved");
        check(
            fresh.regionThingStack.things.slice(fresh.regionThingStack.top + 1).every((t) => t === null),
            "Unused padding remains null"
        );
        Reflect.set(window, "nullThingEvidence", {
            cases,
            stackPaths: paths,
            rejections: paths.length * 3,
            scope: "real loaded map/collision with controlled placement; not a natural playthrough"
        });
    } finally {
        h.destroyMounted(mounted);
    }
}

/** Actual recordings and dispatcher. Trace observes insertion-position boundaries without emulating them. */
export async function traceNullPlayback(h: Harness): Promise<void> {
    const mounted = await h.mountMain(null),
        m = mounted.main,
        frames: unknown[] = [];
    const original = ThingStack.prototype.pop,
        factory = m.createCandleItem.bind(m);
    let pops: string[] = [],
        nullDrops = 0;
    ThingStack.prototype.pop = function () {
        const was = this.top,
            t = original.call(this);
        if (was >= 0) pops.push(t?.constructor.name ?? "NULL");
        return t;
    };
    m.createCandleItem = (x, y, item) => {
        const t = factory(x, y, item);
        if (t === null) nullDrops++;
        return t;
    };
    const read = (name: string): unknown => Reflect.get(m, name);
    const tick = (): void => {
        pops = [];
        nullDrops = 0;
        h.advanceFrames(mounted, 1);
        m.render(mounted.container, mounted.container.getGraphics());
        frames.push({
            mode: m.mode,
            demo: read("demoIndex"),
            credits: read("creditsIndex"),
            cursor: read("recordingIndex"),
            fade: [m.fade, m.fadeState],
            card: [read("creditsTitleIndex"), read("creditsTitleIndex2"), read("creditsPresents")],
            simon: [m.simon?.x, m.simon?.y],
            rng: m.random.getState(),
            pops,
            nullDrops,
            active: active(m.regionThingStack).map((t) => t?.constructor.name ?? "NULL"),
            swap: active(m.regionStackSwap).map((t) => t?.constructor.name ?? "NULL")
        });
    };
    try {
        Reflect.set(m, "demoIndex", 2);
        for (let i = 0; i < 3; i++) {
            m.initDemo();
            m.fade = 0;
            m.fadeState = Main.FADE_DONE;
            for (let n = 0; n < 8000 && m.mode === Main.MODE_DEMO; n++) tick();
            check(m.mode === Main.MODE_TITLE_SCREEN, "Demo reaches title " + i);
        }
        m.initCredits();
        m.fade = 22;
        m.fadeState = Main.FADE_IN;
        const seen = new Set<number>();
        for (let n = 0; n < 30000 && m.mode === Main.MODE_CREDITS; n++) {
            seen.add(Number(read("creditsIndex")));
            tick();
        }
        check(m.mode === Main.MODE_TITLE_SCREEN && seen.size === 13, "All twelve clips and final PRESENTED BY reach title");
        m.initCredits();
        check(read("creditsIndex") === 0 && read("recordingIndex") === 0, "Credits reentry");
        tick();
        Reflect.set(window, "nullPlaybackTrace", { frames, clips: [...seen], recordings: "unmodified shipped bytes", visualAcceptance: "pending" });
    } finally {
        ThingStack.prototype.pop = original;
        m.createCandleItem = factory;
        h.destroyMounted(mounted);
    }
}
