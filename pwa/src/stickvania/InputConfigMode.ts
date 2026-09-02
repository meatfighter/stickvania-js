import { Color, type GameContainer, type Graphics, Input, type KeyListener } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import { ControllerSupport } from "./ControllerSupport.js";
import type { Main } from "./Main.js";

type BindingStep = "UP" | "DOWN" | "LEFT" | "RIGHT" | "JUMP" | "ATTACK";

export type MappingDraft = {
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

export type InputConfigModeSnapshot = {
    stepIndex: number;
    doneDelay: number;
    armDelay: number;
    message: string;
    finished: boolean;
    draft: MappingDraft;
    assignedKeys: number[];
    assignedControllerButtons: number[];
    controllerButtonDown: boolean[];
    controllerUpDown: boolean;
    controllerDownDown: boolean;
    controllerLeftDown: boolean;
    controllerRightDown: boolean;
};

export class InputConfigMode implements KeyListener {
    private static readonly STEPS: BindingStep[] = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK"];
    private static readonly DONE_DELAY = 30;
    private static readonly ARM_DELAY = 8;
    private static readonly MESSAGE_Y = 232;
    private static readonly ERROR_Y = 280;

    private input: Input | null = null;
    private stepIndex = 0;
    private doneDelay = 0;
    private armDelay = InputConfigMode.ARM_DELAY;
    private message = "";
    private finished = false;
    private draft: MappingDraft | null = null;
    private readonly assignedKeys = new Set<number>();
    private readonly assignedControllerButtons = new Set<number>();
    private readonly controllerButtonDown = new Array<boolean>(ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT).fill(false);
    private controllerUpDown = false;
    private controllerDownDown = false;
    private controllerLeftDown = false;
    private controllerRightDown = false;

    public constructor(private readonly main: Main) {}

    public init(gc: GameContainer): void {
        this.input = gc.getInput();
        ControllerSupport.configureInput(this.input);
        this.input.addKeyListener(this);
        this.draft = this.createDraft();
        this.assignedKeys.clear();
        this.assignedControllerButtons.clear();
        this.syncControllerInputState();
        this.main.clearInputPressedRecords();
    }

    public createSnapshot(): InputConfigModeSnapshot {
        return {
            stepIndex: this.stepIndex,
            doneDelay: this.doneDelay,
            armDelay: this.armDelay,
            message: this.message,
            finished: this.finished,
            draft: this.cloneDraft(this.draft ?? this.createDraft()),
            assignedKeys: Array.from(this.assignedKeys),
            assignedControllerButtons: Array.from(this.assignedControllerButtons),
            controllerButtonDown: this.controllerButtonDown.slice(),
            controllerUpDown: this.controllerUpDown,
            controllerDownDown: this.controllerDownDown,
            controllerLeftDown: this.controllerLeftDown,
            controllerRightDown: this.controllerRightDown
        };
    }

    public restoreSnapshot(gc: GameContainer, snapshot: InputConfigModeSnapshot): void {
        this.dispose();
        this.input = gc.getInput();
        ControllerSupport.configureInput(this.input);
        this.input.addKeyListener(this);
        this.stepIndex = this.clampStepIndex(snapshot.stepIndex, snapshot.finished);
        this.doneDelay = this.sanitizedDelay(snapshot.doneDelay);
        this.armDelay = this.sanitizedDelay(snapshot.armDelay);
        this.message = typeof snapshot.message === "string" ? snapshot.message : "";
        this.finished = Boolean(snapshot.finished);
        this.draft = this.cloneDraft(snapshot.draft ?? this.createDraft());
        this.assignedKeys.clear();
        this.copyAssignedCodesIntoSet(this.assignedKeys, snapshot.assignedKeys, InputConfigMode.isAssignedKeyCode);
        this.assignedControllerButtons.clear();
        this.copyAssignedCodesIntoSet(this.assignedControllerButtons, snapshot.assignedControllerButtons, InputConfigMode.isAssignedControllerCode);
        this.controllerButtonDown.fill(false);
        if (Array.isArray(snapshot.controllerButtonDown)) {
            const limit = Math.min(snapshot.controllerButtonDown.length, this.controllerButtonDown.length);
            for (let i = 0; i < limit; i++) {
                this.controllerButtonDown[i] = snapshot.controllerButtonDown[i] === true;
            }
        }
        this.controllerUpDown = Boolean(snapshot.controllerUpDown);
        this.controllerDownDown = Boolean(snapshot.controllerDownDown);
        this.controllerLeftDown = Boolean(snapshot.controllerLeftDown);
        this.controllerRightDown = Boolean(snapshot.controllerRightDown);
        this.main.clearInputPressedRecords();
    }

    public dispose(): void {
        if (this.input === null) {
            return;
        }
        this.input.removeKeyListener(this);
        this.input = null;
    }

    public update(gc: GameContainer): void {
        void gc;
        if (this.armDelay > 0) {
            this.syncControllerInputState();
            this.armDelay--;
            return;
        }
        if (this.doneDelay > 0 && --this.doneDelay == 0) {
            this.finish();
            return;
        }
        this.bindControllerInputPressed();
    }

    public render(gc: GameContainer, g: Graphics): void {
        void gc;
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
        void c;
        if (!this.canAcceptInput() || ButtonMapping.isReservedKey(key)) {
            return;
        }
        if (!this.bindKey(key)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    public keyReleased(key: number, c: string): void {
        void key;
        void c;
    }

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

    private bindControllerDirection(binding: number): void {
        if (!this.canAcceptInput() || this.isActionStep()) {
            return;
        }
        if (!this.bindControllerButton(binding)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    private bindControllerInputPressed(): void {
        if (!this.canAcceptInput()) {
            this.syncControllerInputState();
            return;
        }
        const input = this.input;
        if (input === null) {
            return;
        }
        if (ControllerSupport.refreshControllersIfNeeded(input)) {
            this.syncControllerInputState();
            return;
        }
        const direction = this.getPressedControllerDirection();
        if (direction !== ButtonMapping.NO_BINDING && !this.isActionStep()) {
            this.bindControllerDirection(direction);
            return;
        }

        const button = this.getPressedNonDirectionalControllerButton();
        if (button !== ButtonMapping.NO_BINDING) {
            if (!this.bindControllerButton(button)) {
                this.message = "ALREADY USED";
                return;
            }
            this.advance();
        }
    }

    private getPressedControllerDirection(): number {
        if (this.isControllerUpPressed()) {
            return ButtonMapping.CONTROLLER_DIRECTION_UP;
        }
        if (this.isControllerDownPressed()) {
            return ButtonMapping.CONTROLLER_DIRECTION_DOWN;
        }
        if (this.isControllerLeftPressed()) {
            return ButtonMapping.CONTROLLER_DIRECTION_LEFT;
        }
        if (this.isControllerRightPressed()) {
            return ButtonMapping.CONTROLLER_DIRECTION_RIGHT;
        }
        return ButtonMapping.NO_BINDING;
    }

    private getPressedNonDirectionalControllerButton(): number {
        const input = this.input;
        if (input === null) {
            return ButtonMapping.NO_BINDING;
        }
        let pressedButton = ButtonMapping.NO_BINDING;
        for (let button = 0; button < this.controllerButtonDown.length; button++) {
            const down = ControllerSupport.isButtonDown(input, button);
            const pressed = down && !this.controllerButtonDown[button];
            this.controllerButtonDown[button] = down;
            if (
                pressedButton === ButtonMapping.NO_BINDING &&
                pressed &&
                !ControllerSupport.isDirectionalButton(button) &&
                !this.isDraftDirectionButton(button)
            ) {
                pressedButton = button;
            }
        }
        return pressedButton;
    }

    private bindKey(key: number): boolean {
        if (this.assignedKeys.has(key)) {
            return false;
        }
        this.clearDraftKey(key);
        switch (this.getCurrentStep()) {
            case "UP":
                this.draft!.keyUp = key;
                break;
            case "DOWN":
                this.draft!.keyDown = key;
                break;
            case "LEFT":
                this.draft!.keyLeft = key;
                break;
            case "RIGHT":
                this.draft!.keyRight = key;
                break;
            case "JUMP":
                this.draft!.keyJump = key;
                break;
            case "ATTACK":
                this.draft!.keyAttack = key;
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
                this.draft!.controllerUp = button;
                break;
            case "DOWN":
                this.draft!.controllerDown = button;
                break;
            case "LEFT":
                this.draft!.controllerLeft = button;
                break;
            case "RIGHT":
                this.draft!.controllerRight = button;
                break;
            case "JUMP":
                this.draft!.controllerJump = button;
                break;
            case "ATTACK":
                this.draft!.controllerAttack = button;
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

    private cloneDraft(draft: MappingDraft): MappingDraft {
        return {
            keyJump: this.sanitizedKeyBinding(draft.keyJump),
            keyAttack: this.sanitizedKeyBinding(draft.keyAttack),
            keyUp: this.sanitizedKeyBinding(draft.keyUp),
            keyDown: this.sanitizedKeyBinding(draft.keyDown),
            keyLeft: this.sanitizedKeyBinding(draft.keyLeft),
            keyRight: this.sanitizedKeyBinding(draft.keyRight),
            controllerJump: this.sanitizedControllerActionBinding(draft.controllerJump),
            controllerAttack: this.sanitizedControllerActionBinding(draft.controllerAttack),
            controllerUp: this.sanitizedControllerBinding(draft.controllerUp),
            controllerDown: this.sanitizedControllerBinding(draft.controllerDown),
            controllerLeft: this.sanitizedControllerBinding(draft.controllerLeft),
            controllerRight: this.sanitizedControllerBinding(draft.controllerRight)
        };
    }

    private sanitizedKeyBinding(value: unknown): number {
        return ButtonMapping.isValidKeyBinding(value) ? value : ButtonMapping.NO_BINDING;
    }

    private sanitizedControllerBinding(value: unknown): number {
        return ButtonMapping.isValidControllerBinding(value) ? value : ButtonMapping.NO_BINDING;
    }

    private sanitizedControllerActionBinding(value: unknown): number {
        return ButtonMapping.isValidControllerActionBinding(value) ? value : ButtonMapping.NO_BINDING;
    }

    private sanitizedDelay(value: unknown): number {
        return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    }

    private clampStepIndex(value: unknown, finished: unknown): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }
        const upper = finished ? InputConfigMode.STEPS.length : InputConfigMode.STEPS.length - 1;
        return Math.max(0, Math.min(upper, Math.trunc(value)));
    }

    private copyAssignedCodesIntoSet(target: Set<number>, values: unknown, isValid: (value: unknown) => value is number): void {
        if (!Array.isArray(values)) {
            return;
        }
        for (const value of values) {
            if (isValid(value)) {
                target.add(value);
            }
        }
    }

    private static isAssignedKeyCode(value: unknown): value is number {
        return typeof value === "number" && Number.isInteger(value) && value >= 0;
    }

    private static isAssignedControllerCode(value: unknown): value is number {
        return (
            typeof value === "number" &&
            Number.isInteger(value) &&
            value !== ButtonMapping.NO_BINDING &&
            (ButtonMapping.isControllerDirection(value) || value >= 0)
        );
    }

    private clearDraftKey(key: number): void {
        if (this.draft!.keyJump == key) {
            this.draft!.keyJump = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.keyAttack == key) {
            this.draft!.keyAttack = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.keyUp == key) {
            this.draft!.keyUp = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.keyDown == key) {
            this.draft!.keyDown = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.keyLeft == key) {
            this.draft!.keyLeft = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.keyRight == key) {
            this.draft!.keyRight = ButtonMapping.NO_BINDING;
        }
    }

    private clearDraftControllerButton(button: number): void {
        if (this.draft!.controllerJump == button) {
            this.draft!.controllerJump = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.controllerAttack == button) {
            this.draft!.controllerAttack = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.controllerUp == button) {
            this.draft!.controllerUp = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.controllerDown == button) {
            this.draft!.controllerDown = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.controllerLeft == button) {
            this.draft!.controllerLeft = ButtonMapping.NO_BINDING;
        }
        if (this.draft!.controllerRight == button) {
            this.draft!.controllerRight = ButtonMapping.NO_BINDING;
        }
    }

    private commitDraft(): void {
        const mapping = this.main.buttonMapping;
        mapping.keyJump = this.draft!.keyJump;
        mapping.keyAttack = this.draft!.keyAttack;
        mapping.keyUp = this.draft!.keyUp;
        mapping.keyDown = this.draft!.keyDown;
        mapping.keyLeft = this.draft!.keyLeft;
        mapping.keyRight = this.draft!.keyRight;
        mapping.controllerJump = this.draft!.controllerJump;
        mapping.controllerAttack = this.draft!.controllerAttack;
        mapping.controllerUp = this.draft!.controllerUp;
        mapping.controllerDown = this.draft!.controllerDown;
        mapping.controllerLeft = this.draft!.controllerLeft;
        mapping.controllerRight = this.draft!.controllerRight;
    }

    private advance(): void {
        this.main.playSound(this.main.pressed_enter);
        this.message = "";
        this.stepIndex++;
        if (this.stepIndex == InputConfigMode.STEPS.length) {
            this.finished = true;
            this.commitDraft();
            this.message = this.main.buttonMapping.save() ? "SAVED" : "NOT SAVED";
            this.main.controlInput?.clearPressedState();
            this.doneDelay = InputConfigMode.DONE_DELAY;
        }
    }

    private finish(): void {
        this.dispose();
        this.main.finishInputConfig();
    }

    private getCurrentStep(): BindingStep {
        return InputConfigMode.STEPS[this.stepIndex] ?? InputConfigMode.STEPS[InputConfigMode.STEPS.length - 1];
    }

    private isActionStep(): boolean {
        const step = this.getCurrentStep();
        return step === "JUMP" || step === "ATTACK";
    }

    private centerX(text: string): number {
        return (640 - (text.length << 4)) >> 1;
    }

    private isDraftDirectionButton(button: number): boolean {
        return (
            this.draft!.controllerUp === button ||
            this.draft!.controllerDown === button ||
            this.draft!.controllerLeft === button ||
            this.draft!.controllerRight === button
        );
    }

    private isControllerUpPressed(): boolean {
        const input = this.input!;
        const down = ControllerSupport.isUpDown(input);
        const pressed = down && !this.controllerUpDown;
        this.controllerUpDown = down;
        return pressed;
    }

    private isControllerDownPressed(): boolean {
        const input = this.input!;
        const down = ControllerSupport.isDownDown(input);
        const pressed = down && !this.controllerDownDown;
        this.controllerDownDown = down;
        return pressed;
    }

    private isControllerLeftPressed(): boolean {
        const input = this.input!;
        const down = ControllerSupport.isLeftDown(input);
        const pressed = down && !this.controllerLeftDown;
        this.controllerLeftDown = down;
        return pressed;
    }

    private isControllerRightPressed(): boolean {
        const input = this.input!;
        const down = ControllerSupport.isRightDown(input);
        const pressed = down && !this.controllerRightDown;
        this.controllerRightDown = down;
        return pressed;
    }

    private syncControllerInputState(): void {
        const input = this.input;
        if (input === null) {
            return;
        }
        ControllerSupport.refreshControllersIfNeeded(input);
        this.controllerUpDown = ControllerSupport.isUpDown(input);
        this.controllerDownDown = ControllerSupport.isDownDown(input);
        this.controllerLeftDown = ControllerSupport.isLeftDown(input);
        this.controllerRightDown = ControllerSupport.isRightDown(input);
        for (let button = 0; button < this.controllerButtonDown.length; button++) {
            this.controllerButtonDown[button] = ControllerSupport.isButtonDown(input, button);
        }
    }
}
