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
    private previous: InputState = createEmptyState();
    private current: InputState = createEmptyState();

    public constructor(
        private readonly input: Input,
        private readonly mapping: ButtonMapping
    ) {
        this.clearPressedState();
    }

    public update(): void {
        this.previous = this.current;
        this.current = this.readState();
    }

    public clearPressedState(): void {
        this.current = this.readState();
        this.previous = { ...this.current };
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

    private readState(): InputState {
        const controllerMapped = this.mapping.controller;
        const controller = controllerMapped
            ? this.mapping.resolveControllerIndex()
            : this.mapping.controllerIndex;
        const up = this.input.isKeyDown(this.mapping.keyUp)
            || (controllerMapped && this.input.isControllerUp(controller));
        const down = this.input.isKeyDown(this.mapping.keyDown)
            || (controllerMapped && this.input.isControllerDown(controller));
        const left = this.input.isKeyDown(this.mapping.keyLeft)
            || (controllerMapped && this.input.isControllerLeft(controller));
        const right = this.input.isKeyDown(this.mapping.keyRight)
            || (controllerMapped && this.input.isControllerRight(controller));
        const jump = this.input.isKeyDown(this.mapping.keyJump)
            || (controllerMapped && this.input.isButtonPressed(this.mapping.controllerJump, controller));
        const attack = this.input.isKeyDown(this.mapping.keyAttack)
            || (controllerMapped && this.input.isButtonPressed(this.mapping.controllerAttack, controller));
        const anyControllerSelect = this.isAnyControllerNonDirectionalButtonDown();

        return {
            up,
            down,
            left,
            right,
            jump,
            attack,
            menuUp: up || this.input.isControllerUp(Input.ANY_CONTROLLER),
            menuDown: down || this.input.isControllerDown(Input.ANY_CONTROLLER),
            menuSelect: jump || attack || this.input.isKeyDown(Input.KEY_ENTER) || anyControllerSelect
        };
    }

    private isAnyControllerNonDirectionalButtonDown(): boolean {
        if (typeof navigator === "undefined" || !navigator.getGamepads) {
            return false;
        }

        for (const gamepad of navigator.getGamepads()) {
            if (!gamepad) {
                continue;
            }
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (!StickvaniaInput.isDirectionalGamepadButton(i)
                        && gamepad.buttons[i]?.pressed === true) {
                    return true;
                }
            }
        }
        return false;
    }

    private static isDirectionalGamepadButton(button: number): boolean {
        return button >= 12 && button <= 15;
    }
}
