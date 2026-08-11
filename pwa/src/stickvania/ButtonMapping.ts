import { Input } from "slick2d-ts";

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
    private static readonly STORAGE_KEY = "stickvania.input-mapping";
    private static readonly VERSION = 5;
    public static readonly NO_BINDING = -1;
    private static readonly DEFAULT_KEY_JUMP = Input.KEY_X;
    private static readonly DEFAULT_KEY_ATTACK = Input.KEY_Z;
    private static readonly DEFAULT_KEY_UP = Input.KEY_UP;
    private static readonly DEFAULT_KEY_DOWN = Input.KEY_DOWN;
    private static readonly DEFAULT_KEY_LEFT = Input.KEY_LEFT;
    private static readonly DEFAULT_KEY_RIGHT = Input.KEY_RIGHT;
    private static readonly DEFAULT_CONTROLLER_JUMP = 0;
    private static readonly DEFAULT_CONTROLLER_ATTACK = 2;
    private static readonly DEFAULT_CONTROLLER_UP = 12;
    private static readonly DEFAULT_CONTROLLER_DOWN = 13;
    private static readonly DEFAULT_CONTROLLER_LEFT = 14;
    private static readonly DEFAULT_CONTROLLER_RIGHT = 15;
    private static readonly GAMEPAD_BUTTON_TEXT = [
        "GP-A",
        "GP-B",
        "GP-X",
        "GP-Y",
        "GP-LB",
        "GP-RB",
        "GP-LT",
        "GP-RT",
        "GP-VIEW",
        "GP-MENU",
        "GP-LS",
        "GP-RS",
        "GP-UP",
        "GP-DOWN",
        "GP-LEFT",
        "GP-RIGHT",
        "GP-HOME"
    ];
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
        try {
            const text = localStorage.getItem(ButtonMapping.STORAGE_KEY);
            if (text === null) {
                return mapping;
            }
            const snapshot = JSON.parse(text) as ButtonMappingSnapshot;
            if (!ButtonMapping.isSupportedSnapshot(snapshot)) {
                return mapping;
            }
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
        return key === Input.KEY_SPACE || key === Input.KEY_ESCAPE;
    }

    public usesKey(key: number): boolean {
        return this.keyJump === key || this.keyAttack === key || this.keyUp === key
            || this.keyDown === key || this.keyLeft === key || this.keyRight === key;
    }

    public usesControllerButton(button: number): boolean {
        return this.controllerJump === button || this.controllerAttack === button
            || this.controllerUp === button || this.controllerDown === button
            || this.controllerLeft === button || this.controllerRight === button;
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
        if (button == ButtonMapping.NO_BINDING) {
            return "GP-NONE";
        }
        if (button >= 0 && button < ButtonMapping.GAMEPAD_BUTTON_TEXT.length) {
            return ButtonMapping.GAMEPAD_BUTTON_TEXT[button];
        }
        return "GP-" + button;
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

    private static isSupportedSnapshot(snapshot: ButtonMappingSnapshot): boolean {
        if (!snapshot || snapshot.version !== ButtonMapping.VERSION) {
            return false;
        }
        return Number.isFinite(snapshot.keyJump)
            && Number.isFinite(snapshot.keyAttack)
            && Number.isFinite(snapshot.keyUp)
            && Number.isFinite(snapshot.keyDown)
            && Number.isFinite(snapshot.keyLeft)
            && Number.isFinite(snapshot.keyRight)
            && Number.isFinite(snapshot.controllerJump)
            && Number.isFinite(snapshot.controllerAttack)
            && Number.isFinite(snapshot.controllerUp)
            && Number.isFinite(snapshot.controllerDown)
            && Number.isFinite(snapshot.controllerLeft)
            && Number.isFinite(snapshot.controllerRight);
    }
}
