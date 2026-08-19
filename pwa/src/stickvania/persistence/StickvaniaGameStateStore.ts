import type { GameContainer } from "slick2d-ts";
import type { Main } from "../Main.js";
import type { StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } from "./GameStateSchema.js";
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
            localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
            return true;
        } catch (error) {
            console.warn("Unable to save Stickvania game state.", error);
            return false;
        }
    }

    public restore(main: Main, gc: GameContainer): boolean {
        try {
            const snapshot = this.readSnapshot();
            if (snapshot === null) {
                return false;
            }

            this.serializer.restoreSnapshot(main, gc, snapshot);
            return true;
        } catch (error) {
            console.warn("Unable to restore Stickvania game state.", error);
            this.clear();
            return false;
        }
    }

    public hasValidSave(): boolean {
        try {
            return this.readSnapshot() !== null;
        } catch {
            this.clear();
            return false;
        }
    }

    public clear(): void {
        try {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY);
        } catch {}
    }

    private readSnapshot(): StickvaniaGameStateSnapshot | null {
        const text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (text === null) {
            return null;
        }

        const snapshot = JSON.parse(text) as StickvaniaGameStateSnapshot;
        if (snapshot.version !== GAME_STATE_VERSION || !this.serializer.isSupportedSnapshot(snapshot)) {
            this.clear();
            return null;
        }

        return snapshot;
    }
}
