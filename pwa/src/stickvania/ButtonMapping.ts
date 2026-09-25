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
        if (key === ButtonMapping.NO_BINDING) return "NONE";
        switch (key) {
            case Input.KEY_ESCAPE:
                return "ESCAPE";
            case Input.KEY_1:
                return "1";
            case Input.KEY_2:
                return "2";
            case Input.KEY_3:
                return "3";
            case Input.KEY_4:
                return "4";
            case Input.KEY_5:
                return "5";
            case Input.KEY_6:
                return "6";
            case Input.KEY_7:
                return "7";
            case Input.KEY_8:
                return "8";
            case Input.KEY_9:
                return "9";
            case Input.KEY_0:
                return "0";
            case Input.KEY_MINUS:
                return "MINUS";
            case Input.KEY_EQUALS:
                return "EQUALS";
            case Input.KEY_BACK:
                return "BKSP";
            case Input.KEY_TAB:
                return "TAB";
            case Input.KEY_Q:
                return "Q";
            case Input.KEY_W:
                return "W";
            case Input.KEY_E:
                return "E";
            case Input.KEY_R:
                return "R";
            case Input.KEY_T:
                return "T";
            case Input.KEY_Y:
                return "Y";
            case Input.KEY_U:
                return "U";
            case Input.KEY_I:
                return "I";
            case Input.KEY_O:
                return "O";
            case Input.KEY_P:
                return "P";
            case Input.KEY_LBRACKET:
                return "L BRKT";
            case Input.KEY_RBRACKET:
                return "R BRKT";
            case Input.KEY_RETURN:
                return "ENTER";
            case Input.KEY_LCONTROL:
                return "L CTRL";
            case Input.KEY_A:
                return "A";
            case Input.KEY_S:
                return "S";
            case Input.KEY_D:
                return "D";
            case Input.KEY_F:
                return "F";
            case Input.KEY_G:
                return "G";
            case Input.KEY_H:
                return "H";
            case Input.KEY_J:
                return "J";
            case Input.KEY_K:
                return "K";
            case Input.KEY_L:
                return "L";
            case Input.KEY_SEMICOLON:
                return "SEMICOLON";
            case Input.KEY_APOSTROPHE:
                return "QUOTE";
            case Input.KEY_GRAVE:
                return "GRAVE";
            case Input.KEY_LSHIFT:
                return "L SHIFT";
            case Input.KEY_BACKSLASH:
                return "BSLASH";
            case Input.KEY_Z:
                return "Z";
            case Input.KEY_X:
                return "X";
            case Input.KEY_C:
                return "C";
            case Input.KEY_V:
                return "V";
            case Input.KEY_B:
                return "B";
            case Input.KEY_N:
                return "N";
            case Input.KEY_M:
                return "M";
            case Input.KEY_COMMA:
                return "COMMA";
            case Input.KEY_PERIOD:
                return "PERIOD";
            case Input.KEY_SLASH:
                return "SLASH";
            case Input.KEY_RSHIFT:
                return "R SHIFT";
            case Input.KEY_MULTIPLY:
                return "NUM MUL";
            case Input.KEY_LMENU:
                return "L ALT";
            case Input.KEY_SPACE:
                return "SPACE";
            case Input.KEY_CAPITAL:
                return "CAPS LOCK";
            case Input.KEY_F1:
                return "F1";
            case Input.KEY_F2:
                return "F2";
            case Input.KEY_F3:
                return "F3";
            case Input.KEY_F4:
                return "F4";
            case Input.KEY_F5:
                return "F5";
            case Input.KEY_F6:
                return "F6";
            case Input.KEY_F7:
                return "F7";
            case Input.KEY_F8:
                return "F8";
            case Input.KEY_F9:
                return "F9";
            case Input.KEY_F10:
                return "F10";
            case Input.KEY_NUMLOCK:
                return "NUM LOCK";
            case Input.KEY_SCROLL:
                return "SCR LOCK";
            case Input.KEY_NUMPAD7:
                return "NUM 7";
            case Input.KEY_NUMPAD8:
                return "NUM 8";
            case Input.KEY_NUMPAD9:
                return "NUM 9";
            case Input.KEY_SUBTRACT:
                return "NUM SUB";
            case Input.KEY_NUMPAD4:
                return "NUM 4";
            case Input.KEY_NUMPAD5:
                return "NUM 5";
            case Input.KEY_NUMPAD6:
                return "NUM 6";
            case Input.KEY_ADD:
                return "NUM ADD";
            case Input.KEY_NUMPAD1:
                return "NUM 1";
            case Input.KEY_NUMPAD2:
                return "NUM 2";
            case Input.KEY_NUMPAD3:
                return "NUM 3";
            case Input.KEY_NUMPAD0:
                return "NUM 0";
            case Input.KEY_DECIMAL:
                return "NUM DEC";
            case Input.KEY_F11:
                return "F11";
            case Input.KEY_F12:
                return "F12";
            case Input.KEY_F13:
                return "F13";
            case Input.KEY_F14:
                return "F14";
            case Input.KEY_F15:
                return "F15";
            case Input.KEY_KANA:
                return "KANA";
            case Input.KEY_CONVERT:
                return "CONVERT";
            case Input.KEY_NOCONVERT:
                return "NO CONV";
            case Input.KEY_YEN:
                return "YEN";
            case Input.KEY_NUMPADEQUALS:
                return "NUM EQ";
            case Input.KEY_CIRCUMFLEX:
                return "CARET";
            case Input.KEY_AT:
                return "AT";
            case Input.KEY_COLON:
                return "COLON";
            case Input.KEY_UNDERLINE:
                return "UNDERLINE";
            case Input.KEY_KANJI:
                return "KANJI";
            case Input.KEY_STOP:
                return "STOP";
            case Input.KEY_AX:
                return "AX";
            case Input.KEY_UNLABELED:
                return "NO LABEL";
            case Input.KEY_NUMPADENTER:
                return "NUM ENT";
            case Input.KEY_RCONTROL:
                return "R CTRL";
            case Input.KEY_NUMPADCOMMA:
                return "NUM COM";
            case Input.KEY_DIVIDE:
                return "NUM DIV";
            case Input.KEY_SYSRQ:
                return "PRT SCR";
            case Input.KEY_RMENU:
                return "R ALT";
            case Input.KEY_PAUSE:
                return "PAUSE";
            case Input.KEY_HOME:
                return "HOME";
            case Input.KEY_UP:
                return "UP";
            case Input.KEY_PRIOR:
                return "PG UP";
            case Input.KEY_LEFT:
                return "LEFT";
            case Input.KEY_RIGHT:
                return "RIGHT";
            case Input.KEY_END:
                return "END";
            case Input.KEY_DOWN:
                return "DOWN";
            case Input.KEY_NEXT:
                return "PG DOWN";
            case Input.KEY_INSERT:
                return "INSERT";
            case Input.KEY_DELETE:
                return "DELETE";
            case Input.KEY_LWIN:
                return "L WIN";
            case Input.KEY_RWIN:
                return "R WIN";
            case Input.KEY_APPS:
                return "APP MENU";
            case Input.KEY_POWER:
                return "POWER";
            case Input.KEY_SLEEP:
                return "SLEEP";
            default:
                return Number.isInteger(key) && key >= 0 && key < 256 ? "KEY " + key : "UNKNOWN";
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
        return button >= 0 ? "GP-B" + (button + 1) : "GP-" + button;
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
