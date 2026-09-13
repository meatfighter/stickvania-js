import type { GameContainer } from "slick2d-ts";
import type { Main } from "../Main.js";
import { reconcileStopWatchMusic, resetStopWatchMusicHold } from "../StopWatchMusicHold.js";
import type { StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { isReasonableStickvaniaGameStateSnapshot } from "./GameStateSanity.js";
import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { StickvaniaGameStateSerializer } from "./StickvaniaGameStateSerializer.js";

export class StickvaniaGameStateStore {
    private readonly serializer = new StickvaniaGameStateSerializer();

    public constructor(private readonly appVersion: string) {}

    public save(main: Main): boolean {
        if (!main.isStateSaveReady()) {
            return false;
        }
        try {
            const snapshot = this.serializer.createSnapshot(main, this.appVersion);
            if (!this.serializer.isSupportedSnapshot(snapshot) || !isReasonableStickvaniaGameStateSnapshot(snapshot)) {
                return false;
            }
            const text = JSON.stringify(snapshot);
            if (text.length > MAX_GAME_STATE_TEXT_LENGTH) {
                return false;
            }
            localStorage.setItem(GAME_STATE_STORAGE_KEY, text);
            return true;
        } catch (error) {
            console.warn("Unable to save Stickvania game state.", error);
            return false;
        }
    }

    /** Success means every logical game/audio field is already restored. */
    public restore(main: Main, gc: GameContainer): boolean {
        try {
            const snapshot = this.readSnapshot();
            if (snapshot === null) {
                return false;
            }
            resetStopWatchMusicHold();
            this.serializer.restoreSnapshot(main, gc, snapshot);
            // Audio restoration is intentionally transport-only. Reconcile once
            // after both gameplay Things and Music have been restored so an
            // active stopwatch is silent before the first resumed simulation tick.
            reconcileStopWatchMusic(main);
            return true;
        } catch (error) {
            console.warn("Unable to restore Stickvania game state.", error);
            return false;
        }
    }

    public hasValidSave(): boolean {
        try {
            return this.readSnapshot() !== null;
        } catch (error) {
            console.warn("Unable to read Stickvania game state.", error);
            return false;
        }
    }

    public clear(): void {
        try {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY);
        } catch (error) {
            console.warn("Unable to clear Stickvania game state.", error);
        }
    }

    /** Reads never mutate storage; only an owned Save, New Game, or Reset writes. */
    private readSnapshot(): StickvaniaGameStateSnapshot | null {
        const text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (text === null || text.length > MAX_GAME_STATE_TEXT_LENGTH) {
            return null;
        }
        let snapshot: unknown;
        try {
            snapshot = JSON.parse(text) as unknown;
        } catch {
            return null;
        }
        if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
            return null;
        }
        const typedSnapshot = snapshot as StickvaniaGameStateSnapshot;
        if (
            typedSnapshot.version !== GAME_STATE_VERSION ||
            !this.serializer.isSupportedSnapshot(typedSnapshot) ||
            !isReasonableStickvaniaGameStateSnapshot(typedSnapshot)
        ) {
            return null;
        }
        return typedSnapshot;
    }
}
