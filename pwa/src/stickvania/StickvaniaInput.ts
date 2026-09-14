import { Input } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import { ControllerSupport } from "./ControllerSupport.js";
import { isStopWatchActivationInputBlocked } from "./StopWatchMusicHold.js";

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

export class StickvaniaInput {
    private previous: InputState = createEmptyState();
    private current: InputState = createEmptyState();
    private stopWatchAttackReleaseRequired = false;

    public constructor(
        private readonly input: Input,
        private readonly mapping: ButtonMapping
    ) {
        ControllerSupport.configureInput(input);
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
        this.stopWatchAttackReleaseRequired = false;
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
        if (!this.current.attack) {
            this.stopWatchAttackReleaseRequired = false;
            return false;
        }
        if (this.current.up && isStopWatchActivationInputBlocked()) {
            this.stopWatchAttackReleaseRequired = true;
        }
        return !this.stopWatchAttackReleaseRequired;
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
        const keyUp = this.isKeyDown(this.mapping.keyUp);
        const keyDown = this.isKeyDown(this.mapping.keyDown);
        const keyLeft = this.isKeyDown(this.mapping.keyLeft);
        const keyRight = this.isKeyDown(this.mapping.keyRight);
        const keyJump = this.isKeyDown(this.mapping.keyJump);
        const keyAttack = this.isKeyDown(this.mapping.keyAttack);
        const controllerUp = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerUp);
        const controllerDown = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerDown);
        const controllerLeft = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerLeft);
        const controllerRight = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerRight);
        const controllerJump = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerJump);
        const controllerAttack = ControllerSupport.isDirectionDown(this.input, this.mapping.controllerAttack);
        const up = keyUp || controllerUp;
        const down = keyDown || controllerDown;
        const left = keyLeft || controllerLeft;
        const right = keyRight || controllerRight;
        const jump = keyJump || controllerJump;
        const attack = keyAttack || controllerAttack;
        const enterSelect = !this.isKeyMappedToDirection(Input.KEY_ENTER) && this.isKeyDown(Input.KEY_ENTER);
        const anyControllerSelect = ControllerSupport.isNonDirectionalButtonDown(this.input, this.mapping);

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

    private isKeyDown(key: number): boolean {
        return key !== ButtonMapping.NO_BINDING && this.input.isKeyDown(key);
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
}
