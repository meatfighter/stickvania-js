import { Input } from "slick2d-ts";

type ButtonMappingSnapshot = {
    version: number;
    keyJump?: number;
    keyAttack?: number;
    keyWhip?: number;
    keySubWeapon?: number;
    keyUp: number;
    keyDown: number;
    keyLeft: number;
    keyRight: number;
    controller: boolean;
    controllerIndex: number;
    controllerJump?: number;
    controllerAttack?: number;
    controllerWhip?: number;
    controllerSubWeapon?: number;
};

export class ButtonMapping {
    private static readonly STORAGE_KEY = "stickvania.input-mapping";
    private static readonly VERSION = 3;

    public keyJump: number = Input.KEY_X;
    public keyAttack: number = Input.KEY_Z;
    public keyUp: number = Input.KEY_UP;
    public keyDown: number = Input.KEY_DOWN;
    public keyLeft: number = Input.KEY_LEFT;
    public keyRight: number = Input.KEY_RIGHT;
    public controller: boolean = false;
    public controllerIndex: number = 0;
    public controllerJump: number = 1;
    public controllerAttack: number = 0;

    public static load(): ButtonMapping {
        const mapping = new ButtonMapping();
        try {
            const text = localStorage.getItem(ButtonMapping.STORAGE_KEY);
            if (text === null) {
                return mapping;
            }
            const snapshot = JSON.parse(text) as ButtonMappingSnapshot;
            if (!ButtonMapping.isSupportedSnapshot(snapshot)) {
                return mapping;
            }
            mapping.keyJump = snapshot.keyJump ?? snapshot.keySubWeapon;
            mapping.keyAttack = snapshot.keyAttack ?? snapshot.keyWhip;
            mapping.keyUp = snapshot.keyUp;
            mapping.keyDown = snapshot.keyDown;
            mapping.keyLeft = snapshot.keyLeft;
            mapping.keyRight = snapshot.keyRight;
            mapping.controller = snapshot.controller;
            mapping.controllerIndex = snapshot.controllerIndex;
            mapping.controllerJump = snapshot.controllerJump ?? snapshot.controllerSubWeapon;
            mapping.controllerAttack = snapshot.controllerAttack ?? snapshot.controllerWhip;
        } catch {
        }
        return mapping;
    }

    public save(): void {
        try {
            localStorage.setItem(ButtonMapping.STORAGE_KEY, JSON.stringify(this.toSnapshot()));
        } catch {
        }
    }

    public static isReservedKey(key: number): boolean {
        return key === Input.KEY_SPACE || key === Input.KEY_ESCAPE;
    }

    public usesKey(key: number): boolean {
        return this.keyJump === key || this.keyAttack === key || this.keyUp === key
            || this.keyDown === key || this.keyLeft === key || this.keyRight === key;
    }

    public usesControllerButton(button: number): boolean {
        return this.controller && (this.controllerJump === button || this.controllerAttack === button);
    }

    private toSnapshot(): ButtonMappingSnapshot {
        return {
            version: ButtonMapping.VERSION,
            keyJump: this.keyJump,
            keyAttack: this.keyAttack,
            keyUp: this.keyUp,
            keyDown: this.keyDown,
            keyLeft: this.keyLeft,
            keyRight: this.keyRight,
            controller: this.controller,
            controllerIndex: this.controllerIndex,
            controllerJump: this.controllerJump,
            controllerAttack: this.controllerAttack
        };
    }

    private static isSupportedSnapshot(snapshot: ButtonMappingSnapshot): boolean {
        if (!snapshot || (snapshot.version !== ButtonMapping.VERSION
                && snapshot.version !== 2 && snapshot.version !== 1)) {
            return false;
        }
        return Number.isFinite(snapshot.keyJump ?? snapshot.keySubWeapon)
            && Number.isFinite(snapshot.keyAttack ?? snapshot.keyWhip)
            && Number.isFinite(snapshot.keyUp)
            && Number.isFinite(snapshot.keyDown)
            && Number.isFinite(snapshot.keyLeft)
            && Number.isFinite(snapshot.keyRight)
            && typeof snapshot.controller === "boolean"
            && Number.isFinite(snapshot.controllerIndex)
            && Number.isFinite(snapshot.controllerJump ?? snapshot.controllerSubWeapon)
            && Number.isFinite(snapshot.controllerAttack ?? snapshot.controllerWhip);
    }
}
