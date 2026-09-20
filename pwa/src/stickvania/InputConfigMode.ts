import { Color, type GameContainer, type Graphics, Input, type KeyListener } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import { ControllerSupport } from "./ControllerSupport.js";
import type { Main } from "./Main.js";

type BindingStep = "UP" | "DOWN" | "LEFT" | "RIGHT" | "JUMP" | "ATTACK";

export const INPUT_CONFIG_STEP_COUNT = 6;
export const INPUT_CONFIG_DONE_DELAY = 30;
export const INPUT_CONFIG_ARM_DELAY = 8;

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
};

export function isInputConfigLogicalStateConsistent(snapshot: InputConfigModeSnapshot): boolean {
    const assignedKeys = snapshot.assignedKeys;
    const assignedControllerButtons = snapshot.assignedControllerButtons;
    if (
        new Set(assignedKeys).size !== assignedKeys.length ||
        new Set(assignedControllerButtons).size !== assignedControllerButtons.length
    ) {
        return false;
    }

    const assignmentCount = assignedKeys.length + assignedControllerButtons.length;
    const completedSteps = snapshot.finished ? INPUT_CONFIG_STEP_COUNT : snapshot.stepIndex;
    if (!assignmentsMatchDraft(snapshot, completedSteps)) {
        return false;
    }
    if (snapshot.finished) {
        return (
            snapshot.stepIndex === INPUT_CONFIG_STEP_COUNT &&
            snapshot.doneDelay >= 1 &&
            snapshot.doneDelay <= INPUT_CONFIG_DONE_DELAY &&
            snapshot.armDelay === 0 &&
            assignmentCount === INPUT_CONFIG_STEP_COUNT &&
            (snapshot.message === "SAVED" || snapshot.message === "NOT SAVED")
        );
    }

    if (snapshot.message !== "" && snapshot.message !== "ALREADY USED") {
        return false;
    }
    if (snapshot.armDelay > 0 && (snapshot.stepIndex !== 0 || assignmentCount !== 0 || snapshot.message !== "")) {
        return false;
    }
    return (
        snapshot.stepIndex >= 0 &&
        snapshot.stepIndex < INPUT_CONFIG_STEP_COUNT &&
        snapshot.doneDelay === 0 &&
        snapshot.armDelay >= 0 &&
        snapshot.armDelay <= INPUT_CONFIG_ARM_DELAY &&
        assignmentCount === snapshot.stepIndex
    );
}

function assignmentsMatchDraft(snapshot: InputConfigModeSnapshot, completedSteps: number): boolean {
    const assignedKeys = new Set(snapshot.assignedKeys);
    const assignedControllers = new Set(snapshot.assignedControllerButtons);
    const fields = [
        ["keyUp", "controllerUp"],
        ["keyDown", "controllerDown"],
        ["keyLeft", "controllerLeft"],
        ["keyRight", "controllerRight"],
        ["keyJump", "controllerJump"],
        ["keyAttack", "controllerAttack"]
    ] as const;

    for (let i = 0; i < fields.length; i++) {
        const [keyField, controllerField] = fields[i];
        const ownsKey = assignedKeys.has(snapshot.draft[keyField]);
        const ownsController = assignedControllers.has(snapshot.draft[controllerField]);
        if (i < completedSteps) {
            if (ownsKey === ownsController) {
                return false;
            }
        } else if (ownsKey || ownsController) {
            return false;
        }
    }
    return true;
}

export class InputConfigMode implements KeyListener {
    private static readonly STEPS: BindingStep[] = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK"];
    private static readonly DONE_DELAY = INPUT_CONFIG_DONE_DELAY;
    private static readonly ARM_DELAY = INPUT_CONFIG_ARM_DELAY;
    private static readonly PROMPT_LINE_1 = "ON EITHER YOUR KEYBOARD";
    private static readonly PROMPT_LINE_2 = "OR GAMEPAD, PRESS:";
    private static readonly PROMPT_LINE_1_Y = 152;
    private static readonly PROMPT_LINE_2_Y = 184;
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
    private controllerButtonDown: boolean[] = [];
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

    public resyncControllerStateAfterBrowserResume(): void {
        this.syncControllerInputState();
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
            assignedControllerButtons: Array.from(this.assignedControllerButtons)
        };
    }

    public restoreSnapshot(gc: GameContainer, snapshot: InputConfigModeSnapshot): void {
        this.dispose();
        this.input = gc.getInput();
        ControllerSupport.configureInput(this.input);
        this.input.addKeyListener(this);
        this.stepIndex = snapshot.stepIndex;
        this.doneDelay = snapshot.doneDelay;
        this.armDelay = snapshot.armDelay;
        this.message = snapshot.message;
        this.finished = snapshot.finished;
        this.draft = this.cloneDraft(snapshot.draft);
        this.assignedKeys.clear();
        this.copyAssignedCodesIntoSet(this.assignedKeys, snapshot.assignedKeys, InputConfigMode.isAssignedKeyCode);
        this.assignedControllerButtons.clear();
        this.copyAssignedCodesIntoSet(this.assignedControllerButtons, snapshot.assignedControllerButtons, InputConfigMode.isAssignedControllerCode);
        this.syncControllerInputState();
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
        const currentStep = this.getCurrentStep();
        this.main.drawString(InputConfigMode.PROMPT_LINE_1, this.centerX(InputConfigMode.PROMPT_LINE_1), InputConfigMode.PROMPT_LINE_1_Y);
        this.main.drawString(InputConfigMode.PROMPT_LINE_2, this.centerX(InputConfigMode.PROMPT_LINE_2), InputConfigMode.PROMPT_LINE_2_Y);
        this.main.drawString(currentStep, this.centerX(currentStep), InputConfigMode.MESSAGE_Y);
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
        this.resizeControllerButtonState(input);
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

    private resizeControllerButtonState(input: Input): void {
        const length = ControllerSupport.getButtonScanLimit(input);
        if (this.controllerButtonDown.length < length) {
            const previousLength = this.controllerButtonDown.length;
            this.controllerButtonDown.length = length;
            this.controllerButtonDown.fill(false, previousLength);
        } else if (this.controllerButtonDown.length > length) {
            this.controllerButtonDown.length = length;
        }
    }

    private syncControllerInputState(): void {
        const input = this.input;
        if (input === null) {
            return;
        }
        ControllerSupport.refreshControllersIfNeeded(input);
        this.resizeControllerButtonState(input);
        this.controllerUpDown = ControllerSupport.isUpDown(input);
        this.controllerDownDown = ControllerSupport.isDownDown(input);
        this.controllerLeftDown = ControllerSupport.isLeftDown(input);
        this.controllerRightDown = ControllerSupport.isRightDown(input);
        for (let button = 0; button < this.controllerButtonDown.length; button++) {
            this.controllerButtonDown[button] = ControllerSupport.isButtonDown(input, button);
        }
    }
}
