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
    menuUpKeyboard: boolean;
    menuUpController: boolean;
    menuDownKeyboard: boolean;
    menuDownController: boolean;
    menuSelectJumpKeyboard: boolean;
    menuSelectAttackKeyboard: boolean;
    menuSelectEnterKeyboard: boolean;
    menuSelectJumpController: boolean;
    menuSelectAttackController: boolean;
    menuSelectAnyController: boolean;
};

type AxisDirections = {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
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
        menuSelect: false,
        menuUpKeyboard: false,
        menuUpController: false,
        menuDownKeyboard: false,
        menuDownController: false,
        menuSelectJumpKeyboard: false,
        menuSelectAttackKeyboard: false,
        menuSelectEnterKeyboard: false,
        menuSelectJumpController: false,
        menuSelectAttackController: false,
        menuSelectAnyController: false
    };
}

function createEmptyAxisDirections(): AxisDirections {
    return {
        up: false,
        down: false,
        left: false,
        right: false
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
    private readonly extraAxisDirections = createEmptyAxisDirections();
    private readonly extraAxisBaselines = new Array<number>(StickvaniaInput.CONTROLLER_INDEX_LIMIT * StickvaniaInput.GAMEPAD_AXIS_LIMIT).fill(Number.NaN);

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
        return (
            StickvaniaInput.pressed(this.current.menuUpKeyboard, this.previous.menuUpKeyboard) ||
            StickvaniaInput.pressed(this.current.menuUpController, this.previous.menuUpController)
        );
    }

    public isMenuDownPressed(): boolean {
        return (
            StickvaniaInput.pressed(this.current.menuDownKeyboard, this.previous.menuDownKeyboard) ||
            StickvaniaInput.pressed(this.current.menuDownController, this.previous.menuDownController)
        );
    }

    public isMenuSelectPressed(): boolean {
        return (
            StickvaniaInput.pressed(this.current.menuSelectJumpKeyboard, this.previous.menuSelectJumpKeyboard) ||
            StickvaniaInput.pressed(this.current.menuSelectAttackKeyboard, this.previous.menuSelectAttackKeyboard) ||
            StickvaniaInput.pressed(this.current.menuSelectEnterKeyboard, this.previous.menuSelectEnterKeyboard) ||
            StickvaniaInput.pressed(this.current.menuSelectJumpController, this.previous.menuSelectJumpController) ||
            StickvaniaInput.pressed(this.current.menuSelectAttackController, this.previous.menuSelectAttackController) ||
            StickvaniaInput.pressed(this.current.menuSelectAnyController, this.previous.menuSelectAnyController)
        );
    }

    public isAnyNonDirectionalPressed(): boolean {
        return this.isMenuSelectPressed();
    }

    private readStateInto(target: InputState): void {
        this.readExtraAxisDirectionsInto(this.extraAxisDirections);
        const keyUp = this.input.isKeyDown(this.mapping.keyUp);
        const keyDown = this.input.isKeyDown(this.mapping.keyDown);
        const keyLeft = this.input.isKeyDown(this.mapping.keyLeft);
        const keyRight = this.input.isKeyDown(this.mapping.keyRight);
        const keyJump = this.input.isKeyDown(this.mapping.keyJump);
        const keyAttack = this.input.isKeyDown(this.mapping.keyAttack);
        const controllerUp = this.isControllerBindingDown(this.mapping.controllerUp, this.extraAxisDirections);
        const controllerDown = this.isControllerBindingDown(this.mapping.controllerDown, this.extraAxisDirections);
        const controllerLeft = this.isControllerBindingDown(this.mapping.controllerLeft, this.extraAxisDirections);
        const controllerRight = this.isControllerBindingDown(this.mapping.controllerRight, this.extraAxisDirections);
        const controllerJump = this.isControllerBindingDown(this.mapping.controllerJump, this.extraAxisDirections);
        const controllerAttack = this.isControllerBindingDown(this.mapping.controllerAttack, this.extraAxisDirections);
        const up = keyUp || controllerUp;
        const down = keyDown || controllerDown;
        const left = keyLeft || controllerLeft;
        const right = keyRight || controllerRight;
        const jump = keyJump || controllerJump;
        const attack = keyAttack || controllerAttack;
        const enterSelect = !this.isKeyMappedToDirection(Input.KEY_ENTER) && this.input.isKeyDown(Input.KEY_ENTER);
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
        target.menuUpKeyboard = keyUp;
        target.menuUpController = controllerUp;
        target.menuDownKeyboard = keyDown;
        target.menuDownController = controllerDown;
        target.menuSelectJumpKeyboard = keyJump;
        target.menuSelectAttackKeyboard = keyAttack;
        target.menuSelectEnterKeyboard = enterSelect;
        target.menuSelectJumpController = controllerJump;
        target.menuSelectAttackController = controllerAttack;
        target.menuSelectAnyController = anyControllerSelect;
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
        target.menuUpKeyboard = source.menuUpKeyboard;
        target.menuUpController = source.menuUpController;
        target.menuDownKeyboard = source.menuDownKeyboard;
        target.menuDownController = source.menuDownController;
        target.menuSelectJumpKeyboard = source.menuSelectJumpKeyboard;
        target.menuSelectAttackKeyboard = source.menuSelectAttackKeyboard;
        target.menuSelectEnterKeyboard = source.menuSelectEnterKeyboard;
        target.menuSelectJumpController = source.menuSelectJumpController;
        target.menuSelectAttackController = source.menuSelectAttackController;
        target.menuSelectAnyController = source.menuSelectAnyController;
    }

    private isKeyMappedToDirection(key: number): boolean {
        return this.mapping.keyUp === key || this.mapping.keyDown === key || this.mapping.keyLeft === key || this.mapping.keyRight === key;
    }

    private static pressed(current: boolean, previous: boolean): boolean {
        return current && !previous;
    }

    private isControllerBindingDown(button: number, extraAxes: AxisDirections): boolean {
        if (button === ButtonMapping.NO_BINDING) {
            return false;
        }
        switch (button) {
            case 12:
                return this.isControllerUpDown(extraAxes) || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 13:
                return this.isControllerDownDown(extraAxes) || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 14:
                return this.isControllerLeftDown(extraAxes) || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            case 15:
                return this.isControllerRightDown(extraAxes) || this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
            default:
                return this.input.isButtonPressed(button, Input.ANY_CONTROLLER);
        }
    }

    private isControllerUpDown(extraAxes: AxisDirections): boolean {
        return this.input.isControllerUp(Input.ANY_CONTROLLER) || extraAxes.up;
    }

    private isControllerDownDown(extraAxes: AxisDirections): boolean {
        return this.input.isControllerDown(Input.ANY_CONTROLLER) || extraAxes.down;
    }

    private isControllerLeftDown(extraAxes: AxisDirections): boolean {
        return this.input.isControllerLeft(Input.ANY_CONTROLLER) || extraAxes.left;
    }

    private isControllerRightDown(extraAxes: AxisDirections): boolean {
        return this.input.isControllerRight(Input.ANY_CONTROLLER) || extraAxes.right;
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
                if (!StickvaniaInput.isDirectionalGamepadButton(i) && !this.isMappedDirectionButton(i) && gamepad.buttons[i]?.pressed === true) {
                    return true;
                }
            }
        }
        return false;
    }

    private isMappedDirectionButton(button: number): boolean {
        return (
            this.mapping.controllerUp === button ||
            this.mapping.controllerDown === button ||
            this.mapping.controllerLeft === button ||
            this.mapping.controllerRight === button
        );
    }

    private static isDirectionalGamepadButton(button: number): boolean {
        return button >= 12 && button <= 15;
    }

    private readExtraAxisDirectionsInto(target: AxisDirections): void {
        target.up = false;
        target.down = false;
        target.left = false;
        target.right = false;
        for (let controller = 0; controller < StickvaniaInput.CONTROLLER_INDEX_LIMIT; controller++) {
            const axisCount = this.input.getAxisCount(controller);
            if (axisCount <= 0) {
                continue;
            }
            this.readExtraAxisPairInto(target, controller, axisCount, StickvaniaInput.EXTRA_VERTICAL_AXES, true);
            this.readExtraAxisPairInto(target, controller, axisCount, StickvaniaInput.EXTRA_HORIZONTAL_AXES, false);
            if (target.up && target.down && target.left && target.right) {
                return;
            }
        }
    }

    private readExtraAxisPairInto(target: AxisDirections, controller: number, axisCount: number, axes: readonly number[], vertical: boolean): void {
        for (let i = 0; i < axes.length; i++) {
            const value = this.readExtraAxisValue(controller, axes[i], axisCount);
            if (vertical) {
                target.up ||= value < -StickvaniaInput.AXIS_THRESHOLD;
                target.down ||= value > StickvaniaInput.AXIS_THRESHOLD;
            } else {
                target.left ||= value < -StickvaniaInput.AXIS_THRESHOLD;
                target.right ||= value > StickvaniaInput.AXIS_THRESHOLD;
            }
        }
    }

    private readExtraAxisValue(controller: number, axis: number, axisCount: number): number {
        if (axisCount <= axis) {
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
