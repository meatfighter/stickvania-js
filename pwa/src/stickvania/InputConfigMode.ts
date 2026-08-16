import { Color, type ControllerListener, type GameContainer, type Graphics, Input, type KeyListener } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import type { Main } from "./Main.js";

type BindingStep = "UP" | "DOWN" | "LEFT" | "RIGHT" | "JUMP" | "ATTACK";

type MappingDraft = {
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

export class InputConfigMode implements ControllerListener, KeyListener {
    private static readonly STEPS: BindingStep[] = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK"];
    private static readonly DONE_DELAY = 30;
    private static readonly ARM_DELAY = 8;
    private static readonly MESSAGE_Y = 232;
    private static readonly ERROR_Y = 280;
    private static readonly CONTROLLER_INDEX_LIMIT = 16;
    private static readonly GAMEPAD_AXIS_LIMIT = 16;
    private static readonly AXIS_THRESHOLD = 0.5;
    private static readonly AXIS_RECENTER_THRESHOLD = 0.05;
    private static readonly EXTRA_HORIZONTAL_AXES = [2, 6];
    private static readonly EXTRA_VERTICAL_AXES = [3, 7];

    private input: Input = null;
    private stepIndex = 0;
    private doneDelay = 0;
    private armDelay = InputConfigMode.ARM_DELAY;
    private message = "";
    private finished = false;
    private draft: MappingDraft = null;
    private readonly assignedKeys = new Set<number>();
    private readonly assignedControllerButtons = new Set<number>();
    private readonly extraAxisBaselines = new Array<number>(InputConfigMode.CONTROLLER_INDEX_LIMIT * InputConfigMode.GAMEPAD_AXIS_LIMIT).fill(Number.NaN);
    private extraAxisUpDown = false;
    private extraAxisDownDown = false;
    private extraAxisLeftDown = false;
    private extraAxisRightDown = false;

    public constructor(private readonly main: Main) {}

    public init(gc: GameContainer): void {
        this.input = gc.getInput();
        this.input.addKeyListener(this);
        this.input.addControllerListener(this);
        this.draft = this.createDraft();
        this.assignedKeys.clear();
        this.assignedControllerButtons.clear();
        this.extraAxisBaselines.fill(Number.NaN);
        this.syncExtraAxisDirectionState();
        this.main.clearInputPressedRecords();
    }

    public dispose(): void {
        if (this.input === null) {
            return;
        }
        this.input.removeKeyListener(this);
        this.input.removeControllerListener(this);
        this.input = null;
    }

    public update(gc: GameContainer): void {
        if (this.armDelay > 0) {
            this.syncExtraAxisDirectionState();
            this.armDelay--;
            return;
        }
        if (this.doneDelay > 0 && --this.doneDelay == 0) {
            this.finish();
            return;
        }
        this.bindExtraAxisDirectionPressed();
    }

    public render(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);
        if (this.finished) {
            this.main.drawString(this.message, this.centerX(this.message), InputConfigMode.MESSAGE_Y);
            return;
        }
        const prompt = "PRESS " + this.getCurrentStep();
        this.main.drawString(prompt, this.centerX(prompt), InputConfigMode.MESSAGE_Y);
        if (this.message.length > 0) {
            this.main.drawString(this.message, this.centerX(this.message), InputConfigMode.ERROR_Y);
        }
    }

    public keyPressed(key: number, c: string): void {
        if (!this.canAcceptInput() || ButtonMapping.isReservedKey(key)) {
            return;
        }
        if (!this.bindKey(key)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    public keyReleased(key: number, c: string): void {}

    public controllerButtonPressed(controller: number, button: number): void {
        if (!this.canAcceptInput()) {
            return;
        }
        const buttonIndex = button - 1;
        if (buttonIndex < 0 || (this.isActionStep() && InputConfigMode.isDirectionalGamepadButton(buttonIndex))) {
            return;
        }
        if (!this.bindControllerButton(buttonIndex)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    public controllerButtonReleased(controller: number, button: number): void {}

    public controllerLeftPressed(controller: number): void {
        this.bindControllerDirection(14);
    }

    public controllerLeftReleased(controller: number): void {}

    public controllerRightPressed(controller: number): void {
        this.bindControllerDirection(15);
    }

    public controllerRightReleased(controller: number): void {}

    public controllerUpPressed(controller: number): void {
        this.bindControllerDirection(12);
    }

    public controllerUpReleased(controller: number): void {}

    public controllerDownPressed(controller: number): void {
        this.bindControllerDirection(13);
    }

    public controllerDownReleased(controller: number): void {}

    public setInput(input: Input): void {
        this.input = input;
    }

    public isAcceptingInput(): boolean {
        return true;
    }

    public inputEnded(): void {}

    public inputStarted(): void {}

    private canAcceptInput(): boolean {
        return !this.finished && this.armDelay == 0;
    }

    private bindControllerDirection(button: number): void {
        if (!this.canAcceptInput() || this.isActionStep()) {
            return;
        }
        if (!this.bindControllerButton(button)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    private bindExtraAxisDirectionPressed(): void {
        if (!this.canAcceptInput() || this.isActionStep()) {
            this.syncExtraAxisDirectionState();
            return;
        }
        const button = this.getPressedExtraAxisDirection();
        if (button !== null) {
            this.bindControllerDirection(button);
        }
    }

    private getPressedExtraAxisDirection(): number | null {
        if (this.isExtraAxisUpPressed()) {
            return 12;
        }
        if (this.isExtraAxisDownPressed()) {
            return 13;
        }
        if (this.isExtraAxisLeftPressed()) {
            return 14;
        }
        if (this.isExtraAxisRightPressed()) {
            return 15;
        }
        return null;
    }

    private bindKey(key: number): boolean {
        if (this.assignedKeys.has(key)) {
            return false;
        }
        this.clearDraftKey(key);
        switch (this.getCurrentStep()) {
            case "UP":
                this.draft.keyUp = key;
                break;
            case "DOWN":
                this.draft.keyDown = key;
                break;
            case "LEFT":
                this.draft.keyLeft = key;
                break;
            case "RIGHT":
                this.draft.keyRight = key;
                break;
            case "JUMP":
                this.draft.keyJump = key;
                break;
            case "ATTACK":
                this.draft.keyAttack = key;
                break;
        }
        this.assignedKeys.add(key);
        return true;
    }

    private bindControllerButton(button: number): boolean {
        if (this.assignedControllerButtons.has(button)) {
            return false;
        }
        this.clearDraftControllerButton(button);
        switch (this.getCurrentStep()) {
            case "UP":
                this.draft.controllerUp = button;
                break;
            case "DOWN":
                this.draft.controllerDown = button;
                break;
            case "LEFT":
                this.draft.controllerLeft = button;
                break;
            case "RIGHT":
                this.draft.controllerRight = button;
                break;
            case "JUMP":
                this.draft.controllerJump = button;
                break;
            case "ATTACK":
                this.draft.controllerAttack = button;
                break;
        }
        this.assignedControllerButtons.add(button);
        return true;
    }

    private createDraft(): MappingDraft {
        const mapping = this.main.buttonMapping;
        return {
            keyJump: mapping.keyJump,
            keyAttack: mapping.keyAttack,
            keyUp: mapping.keyUp,
            keyDown: mapping.keyDown,
            keyLeft: mapping.keyLeft,
            keyRight: mapping.keyRight,
            controllerJump: mapping.controllerJump,
            controllerAttack: mapping.controllerAttack,
            controllerUp: mapping.controllerUp,
            controllerDown: mapping.controllerDown,
            controllerLeft: mapping.controllerLeft,
            controllerRight: mapping.controllerRight
        };
    }

    private clearDraftKey(key: number): void {
        if (this.draft.keyJump == key) {
            this.draft.keyJump = ButtonMapping.NO_BINDING;
        }
        if (this.draft.keyAttack == key) {
            this.draft.keyAttack = ButtonMapping.NO_BINDING;
        }
        if (this.draft.keyUp == key) {
            this.draft.keyUp = ButtonMapping.NO_BINDING;
        }
        if (this.draft.keyDown == key) {
            this.draft.keyDown = ButtonMapping.NO_BINDING;
        }
        if (this.draft.keyLeft == key) {
            this.draft.keyLeft = ButtonMapping.NO_BINDING;
        }
        if (this.draft.keyRight == key) {
            this.draft.keyRight = ButtonMapping.NO_BINDING;
        }
    }

    private clearDraftControllerButton(button: number): void {
        if (this.draft.controllerJump == button) {
            this.draft.controllerJump = ButtonMapping.NO_BINDING;
        }
        if (this.draft.controllerAttack == button) {
            this.draft.controllerAttack = ButtonMapping.NO_BINDING;
        }
        if (this.draft.controllerUp == button) {
            this.draft.controllerUp = ButtonMapping.NO_BINDING;
        }
        if (this.draft.controllerDown == button) {
            this.draft.controllerDown = ButtonMapping.NO_BINDING;
        }
        if (this.draft.controllerLeft == button) {
            this.draft.controllerLeft = ButtonMapping.NO_BINDING;
        }
        if (this.draft.controllerRight == button) {
            this.draft.controllerRight = ButtonMapping.NO_BINDING;
        }
    }

    private commitDraft(): void {
        const mapping = this.main.buttonMapping;
        mapping.keyJump = this.draft.keyJump;
        mapping.keyAttack = this.draft.keyAttack;
        mapping.keyUp = this.draft.keyUp;
        mapping.keyDown = this.draft.keyDown;
        mapping.keyLeft = this.draft.keyLeft;
        mapping.keyRight = this.draft.keyRight;
        mapping.controllerJump = this.draft.controllerJump;
        mapping.controllerAttack = this.draft.controllerAttack;
        mapping.controllerUp = this.draft.controllerUp;
        mapping.controllerDown = this.draft.controllerDown;
        mapping.controllerLeft = this.draft.controllerLeft;
        mapping.controllerRight = this.draft.controllerRight;
    }

    private advance(): void {
        this.main.playSound(this.main.pressed_enter);
        this.message = "";
        this.stepIndex++;
        if (this.stepIndex == InputConfigMode.STEPS.length) {
            this.finished = true;
            this.message = "SAVED";
            this.commitDraft();
            this.main.buttonMapping.save();
            this.main.controlInput?.clearPressedState();
            this.doneDelay = InputConfigMode.DONE_DELAY;
        }
    }

    private finish(): void {
        this.dispose();
        this.main.finishInputConfig();
    }

    private getCurrentStep(): BindingStep {
        return InputConfigMode.STEPS[this.stepIndex];
    }

    private isActionStep(): boolean {
        const step = this.getCurrentStep();
        return step === "JUMP" || step === "ATTACK";
    }

    private centerX(text: string): number {
        return Math.trunc((640 - text.length * 16) / 2);
    }

    private static isDirectionalGamepadButton(button: number): boolean {
        return button >= 12 && button <= 15;
    }

    private isExtraAxisUpDown(): boolean {
        return this.isAnyAxisLessThan(InputConfigMode.EXTRA_VERTICAL_AXES, -InputConfigMode.AXIS_THRESHOLD);
    }

    private isExtraAxisDownDown(): boolean {
        return this.isAnyAxisGreaterThan(InputConfigMode.EXTRA_VERTICAL_AXES, InputConfigMode.AXIS_THRESHOLD);
    }

    private isExtraAxisLeftDown(): boolean {
        return this.isAnyAxisLessThan(InputConfigMode.EXTRA_HORIZONTAL_AXES, -InputConfigMode.AXIS_THRESHOLD);
    }

    private isExtraAxisRightDown(): boolean {
        return this.isAnyAxisGreaterThan(InputConfigMode.EXTRA_HORIZONTAL_AXES, InputConfigMode.AXIS_THRESHOLD);
    }

    private isExtraAxisUpPressed(): boolean {
        const down = this.isExtraAxisUpDown();
        const pressed = down && !this.extraAxisUpDown;
        this.extraAxisUpDown = down;
        return pressed;
    }

    private isExtraAxisDownPressed(): boolean {
        const down = this.isExtraAxisDownDown();
        const pressed = down && !this.extraAxisDownDown;
        this.extraAxisDownDown = down;
        return pressed;
    }

    private isExtraAxisLeftPressed(): boolean {
        const down = this.isExtraAxisLeftDown();
        const pressed = down && !this.extraAxisLeftDown;
        this.extraAxisLeftDown = down;
        return pressed;
    }

    private isExtraAxisRightPressed(): boolean {
        const down = this.isExtraAxisRightDown();
        const pressed = down && !this.extraAxisRightDown;
        this.extraAxisRightDown = down;
        return pressed;
    }

    private isAnyAxisLessThan(axes: readonly number[], threshold: number): boolean {
        if (!this.input) {
            return false;
        }
        for (let controller = 0; controller < InputConfigMode.CONTROLLER_INDEX_LIMIT; controller++) {
            for (let i = 0; i < axes.length; i++) {
                if (this.readExtraAxisValue(controller, axes[i]) < threshold) {
                    return true;
                }
            }
        }
        return false;
    }

    private isAnyAxisGreaterThan(axes: readonly number[], threshold: number): boolean {
        if (!this.input) {
            return false;
        }
        for (let controller = 0; controller < InputConfigMode.CONTROLLER_INDEX_LIMIT; controller++) {
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
        const baselineIndex = controller * InputConfigMode.GAMEPAD_AXIS_LIMIT + axis;
        let baseline = this.extraAxisBaselines[baselineIndex];
        if (Number.isNaN(baseline)) {
            baseline = value;
            this.extraAxisBaselines[baselineIndex] = baseline;
        }
        if (Math.abs(value) <= InputConfigMode.AXIS_RECENTER_THRESHOLD) {
            baseline = 0;
            this.extraAxisBaselines[baselineIndex] = baseline;
        }
        return value - baseline;
    }

    private syncExtraAxisDirectionState(): void {
        this.extraAxisUpDown = this.isExtraAxisUpDown();
        this.extraAxisDownDown = this.isExtraAxisDownDown();
        this.extraAxisLeftDown = this.isExtraAxisLeftDown();
        this.extraAxisRightDown = this.isExtraAxisRightDown();
    }
}
