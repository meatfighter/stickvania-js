import { Input } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";

type InputState = {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
    menuUp: boolean;
    menuDown: boolean;
    menuSelect: boolean;
};

function createEmptyState(): InputState {
    return {
        up: false,
        down: false,
        left: false,
        right: false,
        jump: false,
        attack: false,
        menuUp: false,
        menuDown: false,
        menuSelect: false
    };
}

export class StickvaniaInput {
    private static readonly CONTROLLER_INDEX_LIMIT = 16;
    private static readonly GAMEPAD_AXIS_LIMIT = 16;
    private static readonly AXIS_THRESHOLD = 0.5;
    private static readonly AXIS_RECENTER_THRESHOLD = 0.05;
    private static readonly EXTRA_HORIZONTAL_AXES = [2, 6];
    private static readonly EXTRA_VERTICAL_AXES = [3, 7];
    private previous: InputState = createEmptyState();
    private current: InputState = createEmptyState();
    private readonly extraAxisBaselines = new Array<number>(
        StickvaniaInput.CONTROLLER_INDEX_LIMIT * StickvaniaInput.GAMEPAD_AXIS_LIMIT
    ).fill(Number.NaN);

    public constructor(
        private readonly input: Input,
        private readonly mapping: ButtonMapping
    ) {
        this.clearPressedState();
    }

    public update(): void {
        const next = this.previous;
        this.previous = this.current;
        this.current = next;
        this.readStateInto(this.current);
    }

    public clearPressedState(): void {
        this.readStateInto(this.current);
        this.copyState(this.previous, this.current);
    }

    public isUp(): boolean {
        return this.current.up;
    }

    public isDown(): boolean {
        return this.current.down;
    }

    public isLeft(): boolean {
        return this.current.left;
    }

    public isRight(): boolean {
        return this.current.right;
    }

    public isJump(): boolean {
        return this.current.jump;
    }

    public isAttack(): boolean {
        return this.current.attack;
    }

    public isMenuUpPressed(): boolean {
        return this.current.menuUp && !this.previous.menuUp;
    }

    public isMenuDownPressed(): boolean {
        return this.current.menuDown && !this.previous.menuDown;
    }

    public isMenuSelectPressed(): boolean {
        return this.current.menuSelect && !this.previous.menuSelect;
    }

    public isAnyNonDirectionalPressed(): boolean {
        return this.isMenuSelectPressed();
    }

    private readStateInto(target: InputState): void {
        const keyUp = this.input.isKeyDown(this.mapping.keyUp);
        const keyDown = this.input.isKeyDown(this.mapping.keyDown);
        const keyLeft = this.input.isKeyDown(this.mapping.keyLeft);
        const keyRight = this.input.isKeyDown(this.mapping.keyRight);
        const keyJump = this.input.isKeyDown(this.mapping.keyJump);
        const keyAttack = this.input.isKeyDown(this.mapping.keyAttack);
        const controllerUp = this.isControllerBindingDown(this.mapping.controllerUp);
        const controllerDown = this.isControllerBindingDown(this.mapping.controllerDown);
        const controllerLeft = this.isControllerBindingDown(this.mapping.controllerLeft);
        const controllerRight = this.isControllerBindingDown(this.mapping.controllerRight);
        const controllerJump = this.isControllerBindingDown(this.mapping.controllerJump);
        const controllerAttack = this.isControllerBindingDown(this.mapping.controllerAttack);
        const up = keyUp || controllerUp;
        const down = keyDown || controllerDown;
        const left = keyLeft || controllerLeft;
        const right = keyRight || controllerRight;
        const jump = keyJump || controllerJump;
        const attack = keyAttack || controllerAttack;
        const enterSelect = !this.isKeyMappedToDirection(Input.KEY_ENTER)
            && this.input.isKeyDown(Input.KEY_ENTER);
        const anyControllerSelect = this.isAnyControllerNonDirectionalButtonDown();

        target.up = up;
        target.down = down;
        target.left = left;
        target.right = right;
        target.jump = jump;
        target.attack = attack;
        target.menuUp = up;
        target.menuDown = down;
        target.menuSelect = jump || attack || enterSelect || anyControllerSelect;
    }

    private copyState(target: InputState, source: InputState): void {
        target.up = source.up;
        target.down = source.down;
        target.left = source.left;
        target.right = source.right;
        target.jump = source.jump;
        target.attack = source.attack;
        target.menuUp = source.menuUp;
        target.menuDown = source.menuDown;
        target.menuSelect = source.menuSelect;
    }

    private isKeyMappedToDirection(key: number): boolean {
        return this.mapping.keyUp === key
            || this.mapping.keyDown === key
            || this.mapping.keyLeft === key
            || this.mapping.keyRight === key;
    }

    private isControllerBindingDown(button: number): boolean {
        switch (button) {
            case 12:
                return this.isControllerUpDown()
                    || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 13:
                return this.isControllerDownDown()
                    || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 14:
                return this.isControllerLeftDown()
                    || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 15:
                return this.isControllerRightDown()
                    || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            default:
                return this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
        }
    }

    private isControllerUpDown(): boolean {
        return this.input.isControllerUp(Input.ANY_CONTROLLER)
            || this.isExtraAxisUpDown();
    }

    private isControllerDownDown(): boolean {
        return this.input.isControllerDown(Input.ANY_CONTROLLER)
            || this.isExtraAxisDownDown();
    }

    private isControllerLeftDown(): boolean {
        return this.input.isControllerLeft(Input.ANY_CONTROLLER)
            || this.isExtraAxisLeftDown();
    }

    private isControllerRightDown(): boolean {
        return this.input.isControllerRight(Input.ANY_CONTROLLER)
            || this.isExtraAxisRightDown();
    }

    private isAnyControllerNonDirectionalButtonDown(): boolean {
        if (typeof navigator === "undefined" || !navigator.getGamepads) {
            return false;
        }

        const gamepads = navigator.getGamepads();
        for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
            const gamepad = gamepads[gamepadIndex];
            if (!gamepad) {
                continue;
            }
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (!StickvaniaInput.isDirectionalGamepadButton(i)
                        && !this.isMappedDirectionButton(i)
                        && gamepad.buttons[i]?.pressed === true) {
                    return true;
                }
            }
        }
        return false;
    }

    private isMappedDirectionButton(button: number): boolean {
        return this.mapping.controllerUp === button
            || this.mapping.controllerDown === button
            || this.mapping.controllerLeft === button
            || this.mapping.controllerRight === button;
    }

    private static isDirectionalGamepadButton(button: number): boolean {
        return button >= 12 && button <= 15;
    }

    private isExtraAxisUpDown(): boolean {
        return this.isAnyAxisLessThan(StickvaniaInput.EXTRA_VERTICAL_AXES, -StickvaniaInput.AXIS_THRESHOLD);
    }

    private isExtraAxisDownDown(): boolean {
        return this.isAnyAxisGreaterThan(StickvaniaInput.EXTRA_VERTICAL_AXES, StickvaniaInput.AXIS_THRESHOLD);
    }

    private isExtraAxisLeftDown(): boolean {
        return this.isAnyAxisLessThan(StickvaniaInput.EXTRA_HORIZONTAL_AXES, -StickvaniaInput.AXIS_THRESHOLD);
    }

    private isExtraAxisRightDown(): boolean {
        return this.isAnyAxisGreaterThan(StickvaniaInput.EXTRA_HORIZONTAL_AXES, StickvaniaInput.AXIS_THRESHOLD);
    }

    private isAnyAxisLessThan(axes: readonly number[], threshold: number): boolean {
        for (let controller = 0; controller < StickvaniaInput.CONTROLLER_INDEX_LIMIT; controller++) {
            for (let i = 0; i < axes.length; i++) {
                if (this.readExtraAxisValue(controller, axes[i]) < threshold) {
                    return true;
                }
            }
        }
        return false;
    }

    private isAnyAxisGreaterThan(axes: readonly number[], threshold: number): boolean {
        for (let controller = 0; controller < StickvaniaInput.CONTROLLER_INDEX_LIMIT; controller++) {
            for (let i = 0; i < axes.length; i++) {
                if (this.readExtraAxisValue(controller, axes[i]) > threshold) {
                    return true;
                }
            }
        }
        return false;
    }

    private readExtraAxisValue(controller: number, axis: number): number {
        if (this.input.getAxisCount(controller) <= axis) {
            return 0;
        }

        const value = this.input.getAxisValue(controller, axis);
        const baselineIndex = controller * StickvaniaInput.GAMEPAD_AXIS_LIMIT + axis;
        let baseline = this.extraAxisBaselines[baselineIndex];
        if (Number.isNaN(baseline)) {
            baseline = value;
            this.extraAxisBaselines[baselineIndex] = baseline;
        }
        if (Math.abs(value) <= StickvaniaInput.AXIS_RECENTER_THRESHOLD) {
            baseline = 0;
            this.extraAxisBaselines[baselineIndex] = baseline;
        }
        return value - baseline;
    }
}
