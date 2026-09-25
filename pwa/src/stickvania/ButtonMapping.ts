import * as NesInputProfile from "./NesInputProfile.js";
import { captureAndWriteSnapshot, readCurrentJson } from "../app/BrowserPersistence.js";
import { Input } from "slick2d-ts";
import { getBrowserStorageKey } from "./BrowserStorageKeys.js";

export type MappingWriteFailureReason = "unavailable" | "invalid" | "stale-session";
export type MappingWriteResult = { readonly saved: true } | { readonly saved: false; readonly reason: MappingWriteFailureReason };

type ButtonMappingSnapshot = {
    version: number;
    keyJump: number;
    keyAttack: number;
    keyUp: number;
    keyDown: number;
    keyLeft: number;
    keyRight: number;
    controllerJump: number;
    controllerAttack: number;
    controllerUp: number;
    controllerDown: number;
    controllerLeft: number;
    controllerRight: number;
};

export class ButtonMapping {
    private static readonly STORAGE_KEY = getBrowserStorageKey("input-mapping");
    private static readonly VERSION = 8;

    public static readonly NO_BINDING = NesInputProfile.NO_BINDING;
    public static readonly CONTROLLER_DIRECTION_UP = NesInputProfile.DIRECTION_UP;
    public static readonly CONTROLLER_DIRECTION_DOWN = NesInputProfile.DIRECTION_DOWN;
    public static readonly CONTROLLER_DIRECTION_LEFT = NesInputProfile.DIRECTION_LEFT;
    public static readonly CONTROLLER_DIRECTION_RIGHT = NesInputProfile.DIRECTION_RIGHT;
    private static readonly DEFAULT_KEY_JUMP = Input.KEY_X;
    private static readonly DEFAULT_KEY_ATTACK = Input.KEY_Z;
    private static readonly DEFAULT_KEY_UP = Input.KEY_UP;
    private static readonly DEFAULT_KEY_DOWN = Input.KEY_DOWN;
    private static readonly DEFAULT_KEY_LEFT = Input.KEY_LEFT;
    private static readonly DEFAULT_KEY_RIGHT = Input.KEY_RIGHT;
    private static readonly DEFAULT_CONTROLLER_JUMP = 0;
    private static readonly DEFAULT_CONTROLLER_ATTACK = 2;
    private static readonly DEFAULT_CONTROLLER_UP = ButtonMapping.CONTROLLER_DIRECTION_UP;
    private static readonly DEFAULT_CONTROLLER_DOWN = ButtonMapping.CONTROLLER_DIRECTION_DOWN;
    private static readonly DEFAULT_CONTROLLER_LEFT = ButtonMapping.CONTROLLER_DIRECTION_LEFT;
    private static readonly DEFAULT_CONTROLLER_RIGHT = ButtonMapping.CONTROLLER_DIRECTION_RIGHT;
    private static readonly KEY_TEXT = new Map<number, string>([
        [Input.KEY_A, "A"],
        [Input.KEY_B, "B"],
        [Input.KEY_C, "C"],
        [Input.KEY_D, "D"],
        [Input.KEY_E, "E"],
        [Input.KEY_F, "F"],
        [Input.KEY_G, "G"],
        [Input.KEY_H, "H"],
        [Input.KEY_I, "I"],
        [Input.KEY_J, "J"],
        [Input.KEY_K, "K"],
        [Input.KEY_L, "L"],
        [Input.KEY_M, "M"],
        [Input.KEY_N, "N"],
        [Input.KEY_O, "O"],
        [Input.KEY_P, "P"],
        [Input.KEY_Q, "Q"],
        [Input.KEY_R, "R"],
        [Input.KEY_S, "S"],
        [Input.KEY_T, "T"],
        [Input.KEY_U, "U"],
        [Input.KEY_V, "V"],
        [Input.KEY_W, "W"],
        [Input.KEY_X, "X"],
        [Input.KEY_Y, "Y"],
        [Input.KEY_Z, "Z"],
        [Input.KEY_0, "0"],
        [Input.KEY_1, "1"],
        [Input.KEY_2, "2"],
        [Input.KEY_3, "3"],
        [Input.KEY_4, "4"],
        [Input.KEY_5, "5"],
        [Input.KEY_6, "6"],
        [Input.KEY_7, "7"],
        [Input.KEY_8, "8"],
        [Input.KEY_9, "9"]
    ]);

    public keyJump: number = ButtonMapping.DEFAULT_KEY_JUMP;
    public keyAttack: number = ButtonMapping.DEFAULT_KEY_ATTACK;
    public keyUp: number = ButtonMapping.DEFAULT_KEY_UP;
    public keyDown: number = ButtonMapping.DEFAULT_KEY_DOWN;
    public keyLeft: number = ButtonMapping.DEFAULT_KEY_LEFT;
    public keyRight: number = ButtonMapping.DEFAULT_KEY_RIGHT;
    public controllerJump: number = ButtonMapping.DEFAULT_CONTROLLER_JUMP;
    public controllerAttack: number = ButtonMapping.DEFAULT_CONTROLLER_ATTACK;
    public controllerUp: number = ButtonMapping.DEFAULT_CONTROLLER_UP;
    public controllerDown: number = ButtonMapping.DEFAULT_CONTROLLER_DOWN;
    public controllerLeft: number = ButtonMapping.DEFAULT_CONTROLLER_LEFT;
    public controllerRight: number = ButtonMapping.DEFAULT_CONTROLLER_RIGHT;

    public static load(): ButtonMapping {
        const mapping = new ButtonMapping();
        const snapshot = readCurrentJson(ButtonMapping.STORAGE_KEY, ButtonMapping.MAX_TEXT_LENGTH, (value): value is ButtonMappingSnapshot =>
            ButtonMapping.isSupportedSnapshot(value)
        );
        if (snapshot !== null) {
            mapping.keyJump = snapshot.keyJump;
            mapping.keyAttack = snapshot.keyAttack;
            mapping.keyUp = snapshot.keyUp;
            mapping.keyDown = snapshot.keyDown;
            mapping.keyLeft = snapshot.keyLeft;
            mapping.keyRight = snapshot.keyRight;
            mapping.controllerJump = snapshot.controllerJump;
            mapping.controllerAttack = snapshot.controllerAttack;
            mapping.controllerUp = snapshot.controllerUp;
            mapping.controllerDown = snapshot.controllerDown;
            mapping.controllerLeft = snapshot.controllerLeft;
            mapping.controllerRight = snapshot.controllerRight;
        }
        return mapping;
    }

    public save(isAuthorized: () => boolean): MappingWriteResult {
        const result = captureAndWriteSnapshot(
            "Stickvania input mapping",
            ButtonMapping.STORAGE_KEY,
            () => this.toSnapshot(),
            (snapshot) => ButtonMapping.isSupportedSnapshot(snapshot),
            ButtonMapping.MAX_TEXT_LENGTH,
            isAuthorized
        );
        if (result.saved) return result;
        return { saved: false, reason: result.reason === "not-authorized" ? "stale-session" : result.reason === "write-failed" ? "unavailable" : "invalid" };
    }

    public resetToDefaults(): void {
        this.keyJump = ButtonMapping.DEFAULT_KEY_JUMP;
        this.keyAttack = ButtonMapping.DEFAULT_KEY_ATTACK;
        this.keyUp = ButtonMapping.DEFAULT_KEY_UP;
        this.keyDown = ButtonMapping.DEFAULT_KEY_DOWN;
        this.keyLeft = ButtonMapping.DEFAULT_KEY_LEFT;
        this.keyRight = ButtonMapping.DEFAULT_KEY_RIGHT;
        this.controllerJump = ButtonMapping.DEFAULT_CONTROLLER_JUMP;
        this.controllerAttack = ButtonMapping.DEFAULT_CONTROLLER_ATTACK;
        this.controllerUp = ButtonMapping.DEFAULT_CONTROLLER_UP;
        this.controllerDown = ButtonMapping.DEFAULT_CONTROLLER_DOWN;
        this.controllerLeft = ButtonMapping.DEFAULT_CONTROLLER_LEFT;
        this.controllerRight = ButtonMapping.DEFAULT_CONTROLLER_RIGHT;
    }

    public static isReservedKey(key: number): boolean {
        return key === Input.KEY_ESCAPE;
    }

    public usesKey(key: number): boolean {
        return this.keyJump === key || this.keyAttack === key || this.keyUp === key || this.keyDown === key || this.keyLeft === key || this.keyRight === key;
    }

    public usesControllerButton(button: number): boolean {
        return (
            this.controllerJump === button ||
            this.controllerAttack === button ||
            this.controllerUp === button ||
            this.controllerDown === button ||
            this.controllerLeft === button ||
            this.controllerRight === button
        );
    }

    public keyboardLabelFor(action: string): string {
        switch (action) {
            case "UP":
                return ButtonMapping.getKeyText(this.keyUp).toUpperCase();
            case "DOWN":
                return ButtonMapping.getKeyText(this.keyDown).toUpperCase();
            case "LEFT":
                return ButtonMapping.getKeyText(this.keyLeft).toUpperCase();
            case "RIGHT":
                return ButtonMapping.getKeyText(this.keyRight).toUpperCase();
            case "JUMP":
                return ButtonMapping.getKeyText(this.keyJump).toUpperCase();
            case "ATTACK":
                return ButtonMapping.getKeyText(this.keyAttack).toUpperCase();
            default:
                return "";
        }
    }

    public controllerLabelFor(action: string): string {
        switch (action) {
            case "UP":
                return ButtonMapping.getGamepadButtonText(this.controllerUp);
            case "DOWN":
                return ButtonMapping.getGamepadButtonText(this.controllerDown);
            case "LEFT":
                return ButtonMapping.getGamepadButtonText(this.controllerLeft);
            case "RIGHT":
                return ButtonMapping.getGamepadButtonText(this.controllerRight);
            case "JUMP":
                return ButtonMapping.getGamepadButtonText(this.controllerJump);
            case "ATTACK":
                return ButtonMapping.getGamepadButtonText(this.controllerAttack);
            default:
                return "";
        }
    }

    public static getKeyText(key: number): string {
        if (key == ButtonMapping.NO_BINDING) {
            return "None";
        }
        switch (key) {
            case Input.KEY_RETURN:
                return "Enter";
            case Input.KEY_SPACE:
                return "Space";
            case Input.KEY_ESCAPE:
                return "Escape";
            case Input.KEY_LSHIFT:
            case Input.KEY_RSHIFT:
                return "Shift";
            case Input.KEY_LCONTROL:
            case Input.KEY_RCONTROL:
                return "Ctrl";
            case Input.KEY_LALT:
            case Input.KEY_RALT:
                return "Alt";
            case Input.KEY_UP:
                return "Up";
            case Input.KEY_DOWN:
                return "Down";
            case Input.KEY_LEFT:
                return "Left";
            case Input.KEY_RIGHT:
                return "Right";
            case Input.KEY_TAB:
                return "Tab";
            case Input.KEY_BACK:
                return "Back";
            case Input.KEY_DELETE:
                return "Delete";
            case Input.KEY_HOME:
                return "Home";
            case Input.KEY_END:
                return "End";
            case Input.KEY_PRIOR:
                return "Page Up";
            case Input.KEY_NEXT:
                return "Page Down";
            default:
                return ButtonMapping.KEY_TEXT.get(key) ?? String(key);
        }
    }

    public static getGamepadButtonText(button: number): string {
        switch (button) {
            case ButtonMapping.NO_BINDING:
                return "GP-NONE";
            case ButtonMapping.CONTROLLER_DIRECTION_UP:
                return "GP-UP";
            case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
                return "GP-DOWN";
            case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
                return "GP-LEFT";
            case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
                return "GP-RIGHT";
        }
        return button >= 0 ? "GP-BUTTON-" + (button + 1) : "GP-" + button;
    }

    public static isControllerDirection(value: number): boolean {
        return NesInputProfile.isLogicalDirection(value);
    }

    public static isValidKeyBinding(value: unknown): value is number {
        return (
            typeof value === "number" &&
            Number.isInteger(value) &&
            (value === ButtonMapping.NO_BINDING || (Input.isBrowserKeyCodeSupported(value) && !ButtonMapping.isReservedKey(value)))
        );
    }

    public static isValidControllerBinding(value: unknown): value is number {
        return NesInputProfile.isControllerBinding(value);
    }

    public static isValidBinding(value: unknown): value is number {
        return ButtonMapping.isValidControllerBinding(value);
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
            controllerJump: this.controllerJump,
            controllerAttack: this.controllerAttack,
            controllerUp: this.controllerUp,
            controllerDown: this.controllerDown,
            controllerLeft: this.controllerLeft,
            controllerRight: this.controllerRight
        };
    }

    public static hasUniqueNonBindingValues(values: readonly unknown[]): boolean {
        const assigned = values.filter((value): value is number => typeof value === "number" && value !== ButtonMapping.NO_BINDING);
        return new Set(assigned).size === assigned.length;
    }

    private static isSupportedSnapshot(snapshot: unknown): snapshot is ButtonMappingSnapshot {
        if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
            return false;
        }
        const expectedFields = [
            "version",
            "keyJump",
            "keyAttack",
            "keyUp",
            "keyDown",
            "keyLeft",
            "keyRight",
            "controllerJump",
            "controllerAttack",
            "controllerUp",
            "controllerDown",
            "controllerLeft",
            "controllerRight"
        ] as const;
        const keys = Object.keys(snapshot);
        if (keys.length !== expectedFields.length || !expectedFields.every((key) => Object.hasOwn(snapshot, key))) {
            return false;
        }
        const value = snapshot as Partial<ButtonMappingSnapshot>;
        if (value.version !== ButtonMapping.VERSION) {
            return false;
        }
        return (
            ButtonMapping.isValidKeyBinding(value.keyJump) &&
            ButtonMapping.isValidKeyBinding(value.keyAttack) &&
            ButtonMapping.isValidKeyBinding(value.keyUp) &&
            ButtonMapping.isValidKeyBinding(value.keyDown) &&
            ButtonMapping.isValidKeyBinding(value.keyLeft) &&
            ButtonMapping.isValidKeyBinding(value.keyRight) &&
            ButtonMapping.isValidControllerBinding(value.controllerJump) &&
            ButtonMapping.isValidControllerBinding(value.controllerAttack) &&
            ButtonMapping.isValidControllerBinding(value.controllerUp) &&
            ButtonMapping.isValidControllerBinding(value.controllerDown) &&
            ButtonMapping.isValidControllerBinding(value.controllerLeft) &&
            ButtonMapping.isValidControllerBinding(value.controllerRight) &&
            ButtonMapping.hasUniqueNonBindingValues([value.keyJump, value.keyAttack, value.keyUp, value.keyDown, value.keyLeft, value.keyRight]) &&
            ButtonMapping.hasUniqueNonBindingValues([
                value.controllerJump,
                value.controllerAttack,
                value.controllerUp,
                value.controllerDown,
                value.controllerLeft,
                value.controllerRight
            ])
        );
    }

    public copyFrom(source: ButtonMapping): void {
        NesInputProfile.copyInto(source, this);
    }

    public clone(): ButtonMapping {
        const mapping = new ButtonMapping();
        mapping.copyFrom(this);
        return mapping;
    }

    public static readonly MAX_TEXT_LENGTH = 4096;
}
