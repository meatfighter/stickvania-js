import { Input } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import { ControllerSupport } from "./ControllerSupport.js";
import {
    canRegisteredSimonActionStart,
    prepareRegisteredCountdownTimer,
    prepareRegisteredPitDeathPresentation,
    reconcileRegisteredSimonActionBeforeAttackRead
} from "./PlayerActionPolicy.js";

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
    menuUpControllerPressed: boolean;
    menuDownControllerPressed: boolean;
    menuSelectJumpControllerPressed: boolean;
    menuSelectAttackControllerPressed: boolean;
    menuSelectAnyControllerPressed: boolean;
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
        menuSelectAnyController: false,
        menuUpControllerPressed: false,
        menuDownControllerPressed: false,
        menuSelectJumpControllerPressed: false,
        menuSelectAttackControllerPressed: false,
        menuSelectAnyControllerPressed: false
    };
}

export class StickvaniaInput {
    private static readonly CONTROLLER_BINDING_SLOT_COUNT = 7;
    private static readonly CONTROLLER_STATE_DOWN = 1;
    private static readonly CONTROLLER_STATE_PRESSED = 2;
    private previous: InputState = createEmptyState();
    private current: InputState = createEmptyState();
    private readonly controllerBindingDown: boolean[][] = Array.from({ length: StickvaniaInput.CONTROLLER_BINDING_SLOT_COUNT }, () => []);
    private readonly controllerBindingBlockedUntilRelease: boolean[][] = Array.from({ length: StickvaniaInput.CONTROLLER_BINDING_SLOT_COUNT }, () => []);
    private readonly controllerConnectionGenerations: number[] = [];
    private readonly controllerGenerationChanged: boolean[] = [];
    private controllerSampleValid = false;
    private controllerSampleBaselineOnly = true;
    private controllerCount = 0;

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
        this.readStateInto(this.current, false);
        // Complete any first below-pit presentation before Main's legacy pit
        // branch can return, including a cold-restored lethal trajectory.
        prepareRegisteredPitDeathPresentation();
        // Main evaluates its stage countdown immediately after input/frame-state
        // early exits. Preflight the imminent countdown before those checks run.
        prepareRegisteredCountdownTimer();
        // Catch terminal/control-loss state that was already true at frame start,
        // including pit/death/hurt paths that return before Main reads Attack.
        reconcileRegisteredSimonActionBeforeAttackRead();
    }

    public clearPressedState(): void {
        this.input.sampleControllersForBaseline();
        this.readStateInto(this.current, true);
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
        // Main reads Attack immediately before advancing the whip/sub-weapon
        // delay. Reconcile again because the stage timer can become terminal
        // after input.update() but before this read. General terminal state can
        // suppress a fresh action, but hearts/capacity/timeFrozen are not part of
        // that policy, so unavailable Up+Attack still falls back to the whip.
        reconcileRegisteredSimonActionBeforeAttackRead();
        return this.current.attack && canRegisteredSimonActionStart();
    }

    public isMenuUpPressed(): boolean {
        return StickvaniaInput.pressed(this.current.menuUpKeyboard, this.previous.menuUpKeyboard) || this.current.menuUpControllerPressed;
    }

    public isMenuDownPressed(): boolean {
        return StickvaniaInput.pressed(this.current.menuDownKeyboard, this.previous.menuDownKeyboard) || this.current.menuDownControllerPressed;
    }

    public isMenuSelectPressed(): boolean {
        return (
            StickvaniaInput.pressed(this.current.menuSelectJumpKeyboard, this.previous.menuSelectJumpKeyboard) ||
            StickvaniaInput.pressed(this.current.menuSelectAttackKeyboard, this.previous.menuSelectAttackKeyboard) ||
            StickvaniaInput.pressed(this.current.menuSelectEnterKeyboard, this.previous.menuSelectEnterKeyboard) ||
            this.current.menuSelectJumpControllerPressed ||
            this.current.menuSelectAttackControllerPressed ||
            this.current.menuSelectAnyControllerPressed
        );
    }

    public isAnyNonDirectionalPressed(): boolean {
        return this.isMenuSelectPressed();
    }

    private readStateInto(target: InputState, suppressControllerEdges: boolean): void {
        const keyUp = this.isKeyDown(this.mapping.keyUp);
        const keyDown = this.isKeyDown(this.mapping.keyDown);
        const keyLeft = this.isKeyDown(this.mapping.keyLeft);
        const keyRight = this.isKeyDown(this.mapping.keyRight);
        const keyJump = this.isKeyDown(this.mapping.keyJump);
        const keyAttack = this.isKeyDown(this.mapping.keyAttack);

        this.prepareControllerReadContext();
        const controllerUpState = this.readControllerBinding(this.mapping.controllerUp, 0, false, suppressControllerEdges);
        const controllerDownState = this.readControllerBinding(this.mapping.controllerDown, 1, false, suppressControllerEdges);
        const controllerLeftState = this.readControllerBinding(this.mapping.controllerLeft, 2, false, suppressControllerEdges);
        const controllerRightState = this.readControllerBinding(this.mapping.controllerRight, 3, false, suppressControllerEdges);
        const controllerJumpState = this.readControllerBinding(this.mapping.controllerJump, 4, true, suppressControllerEdges);
        const controllerAttackState = this.readControllerBinding(this.mapping.controllerAttack, 5, true, suppressControllerEdges);
        const anyControllerSelectState = this.readAnyNonDirectionalControllerState(6, suppressControllerEdges);

        const controllerUp = (controllerUpState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const controllerDown = (controllerDownState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const controllerLeft = (controllerLeftState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const controllerRight = (controllerRightState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const controllerJump = (controllerJumpState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const controllerAttack = (controllerAttackState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;
        const up = keyUp || controllerUp;
        const down = keyDown || controllerDown;
        const left = keyLeft || controllerLeft;
        const right = keyRight || controllerRight;
        const jump = keyJump || controllerJump;
        const attack = keyAttack || controllerAttack;
        const enterSelect = !this.isKeyMappedToDirection(Input.KEY_ENTER) && this.isKeyDown(Input.KEY_ENTER);
        const anyControllerSelect = (anyControllerSelectState & StickvaniaInput.CONTROLLER_STATE_DOWN) !== 0;

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
        target.menuUpControllerPressed = (controllerUpState & StickvaniaInput.CONTROLLER_STATE_PRESSED) !== 0;
        target.menuDownControllerPressed = (controllerDownState & StickvaniaInput.CONTROLLER_STATE_PRESSED) !== 0;
        target.menuSelectJumpControllerPressed = (controllerJumpState & StickvaniaInput.CONTROLLER_STATE_PRESSED) !== 0;
        target.menuSelectAttackControllerPressed = (controllerAttackState & StickvaniaInput.CONTROLLER_STATE_PRESSED) !== 0;
        target.menuSelectAnyControllerPressed = (anyControllerSelectState & StickvaniaInput.CONTROLLER_STATE_PRESSED) !== 0;
    }

    private prepareControllerReadContext(): void {
        const status = this.input.getControllerSampleStatus();
        this.controllerSampleValid = status.valid;
        this.controllerSampleBaselineOnly = status.baselineOnly;
        this.controllerCount = this.input.getControllerCount();
        this.resizeControllerTracking(this.controllerCount);

        for (let controller = 0; controller < this.controllerCount; controller++) {
            const generation = this.input.getControllerConnectionGeneration(controller);
            this.controllerGenerationChanged[controller] = this.controllerConnectionGenerations[controller] !== generation;
            if (this.controllerSampleValid) {
                this.controllerConnectionGenerations[controller] = generation;
            }
        }
    }

    private readControllerBinding(binding: number, slot: number, discreteAction: boolean, suppressEdges: boolean): number {
        if (binding === ButtonMapping.NO_BINDING) {
            return 0;
        }

        let anyDown = false;
        let anyPressed = false;
        const previous = this.controllerBindingDown[slot]!;
        const blocked = this.controllerBindingBlockedUntilRelease[slot]!;
        for (let controller = 0; controller < this.controllerCount; controller++) {
            const rawDown = ControllerSupport.isDirectionDownOnController(this.input, binding, controller);
            const uncertain =
                suppressEdges || !this.controllerSampleValid || this.controllerSampleBaselineOnly || this.controllerGenerationChanged[controller] === true;

            if (this.controllerSampleValid) {
                if (discreteAction && uncertain && rawDown) {
                    blocked[controller] = true;
                }
                if (discreteAction && blocked[controller] && !rawDown) {
                    blocked[controller] = false;
                }
                const effectiveDown = discreteAction && blocked[controller] ? false : rawDown;
                anyPressed ||= !uncertain && effectiveDown && !previous[controller];
                previous[controller] = effectiveDown;
                anyDown ||= effectiveDown;
            } else {
                // Enumeration uncertainty is not a release. Preserve the last
                // eligible discrete-action level and let movement continue to use
                // the engine's retained last-valid controller sample.
                anyDown ||= discreteAction ? previous[controller] === true : rawDown;
            }
        }
        return (anyDown ? StickvaniaInput.CONTROLLER_STATE_DOWN : 0) | (anyPressed ? StickvaniaInput.CONTROLLER_STATE_PRESSED : 0);
    }

    private readAnyNonDirectionalControllerState(slot: number, suppressEdges: boolean): number {
        let anyDown = false;
        let anyPressed = false;
        const previous = this.controllerBindingDown[slot]!;
        const blocked = this.controllerBindingBlockedUntilRelease[slot]!;

        for (let controller = 0; controller < this.controllerCount; controller++) {
            let rawDown = false;
            const limit = ControllerSupport.getButtonScanLimitForController(this.input, controller);
            for (let button = 0; button < limit; button++) {
                if (
                    !ControllerSupport.isDirectionalButton(this.input, button, controller) &&
                    !this.isMappedDirectionButton(button) &&
                    this.input.isButtonPressed(button, controller)
                ) {
                    rawDown = true;
                    break;
                }
            }

            const uncertain =
                suppressEdges || !this.controllerSampleValid || this.controllerSampleBaselineOnly || this.controllerGenerationChanged[controller] === true;
            if (this.controllerSampleValid) {
                if (uncertain && rawDown) {
                    blocked[controller] = true;
                }
                if (blocked[controller] && !rawDown) {
                    blocked[controller] = false;
                }
                const effectiveDown = blocked[controller] ? false : rawDown;
                anyPressed ||= !uncertain && effectiveDown && !previous[controller];
                previous[controller] = effectiveDown;
                anyDown ||= effectiveDown;
            } else {
                anyDown ||= previous[controller] === true;
            }
        }

        return (anyDown ? StickvaniaInput.CONTROLLER_STATE_DOWN : 0) | (anyPressed ? StickvaniaInput.CONTROLLER_STATE_PRESSED : 0);
    }

    private resizeControllerTracking(controllerCount: number): void {
        this.controllerConnectionGenerations.length = controllerCount;
        this.controllerGenerationChanged.length = controllerCount;
        for (let slot = 0; slot < StickvaniaInput.CONTROLLER_BINDING_SLOT_COUNT; slot++) {
            const previous = this.controllerBindingDown[slot]!;
            const blocked = this.controllerBindingBlockedUntilRelease[slot]!;
            const oldLength = previous.length;
            previous.length = controllerCount;
            blocked.length = controllerCount;
            if (controllerCount > oldLength) {
                previous.fill(false, oldLength);
                blocked.fill(false, oldLength);
            }
        }
    }

    private isMappedDirectionButton(button: number): boolean {
        return (
            this.mapping.controllerUp === button ||
            this.mapping.controllerDown === button ||
            this.mapping.controllerLeft === button ||
            this.mapping.controllerRight === button
        );
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
        target.menuUpControllerPressed = source.menuUpControllerPressed;
        target.menuDownControllerPressed = source.menuDownControllerPressed;
        target.menuSelectJumpControllerPressed = source.menuSelectJumpControllerPressed;
        target.menuSelectAttackControllerPressed = source.menuSelectAttackControllerPressed;
        target.menuSelectAnyControllerPressed = source.menuSelectAnyControllerPressed;
    }

    private isKeyMappedToDirection(key: number): boolean {
        return this.mapping.keyUp === key || this.mapping.keyDown === key || this.mapping.keyLeft === key || this.mapping.keyRight === key;
    }

    private static pressed(current: boolean, previous: boolean): boolean {
        return current && !previous;
    }
}
