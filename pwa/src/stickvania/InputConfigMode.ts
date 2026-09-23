import { Color, type GameContainer, type Graphics, Input, type KeyListener } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import { ControllerSupport } from "./ControllerSupport.js";
import type { Main } from "./Main.js";

type BindingStep = "UP" | "DOWN" | "LEFT" | "RIGHT" | "JUMP" | "ATTACK";

type ControllerCaptureSample = {
    readonly direction: number;
    readonly button: number;
    readonly anyDown: boolean;
    readonly valid: boolean;
};

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

export function isInputConfigModeSnapshot(value: unknown): value is InputConfigModeSnapshot {
    if (
        !isPlainRecord(value) ||
        !hasExactFields(value, ["stepIndex", "doneDelay", "armDelay", "message", "finished", "draft", "assignedKeys", "assignedControllerButtons"])
    ) {
        return false;
    }
    const draft = value.draft;
    if (
        !isPlainRecord(draft) ||
        !hasExactFields(draft, [
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
        ])
    ) {
        return false;
    }

    const keyFields = ["keyJump", "keyAttack", "keyUp", "keyDown", "keyLeft", "keyRight"] as const;
    const controllerActionFields = ["controllerJump", "controllerAttack"] as const;
    const controllerDirectionFields = ["controllerUp", "controllerDown", "controllerLeft", "controllerRight"] as const;
    if (
        !isFiniteInteger(value.stepIndex) ||
        !isFiniteInteger(value.doneDelay) ||
        !isFiniteInteger(value.armDelay) ||
        typeof value.message !== "string" ||
        typeof value.finished !== "boolean" ||
        !keyFields.every((field) => ButtonMapping.isValidKeyBinding(draft[field])) ||
        !controllerActionFields.every((field) => ButtonMapping.isValidControllerActionBinding(draft[field])) ||
        !controllerDirectionFields.every((field) => ButtonMapping.isValidControllerBinding(draft[field])) ||
        !ButtonMapping.hasUniqueNonBindingValues(keyFields.map((field) => draft[field])) ||
        !ButtonMapping.hasUniqueNonBindingValues([
            ...controllerActionFields.map((field) => draft[field]),
            ...controllerDirectionFields.map((field) => draft[field])
        ]) ||
        !isAssignedKeyArray(value.assignedKeys) ||
        !isAssignedControllerArray(value.assignedControllerButtons)
    ) {
        return false;
    }

    return isInputConfigLogicalStateConsistent(value as unknown as InputConfigModeSnapshot);
}

export function isInputConfigLogicalStateConsistent(snapshot: InputConfigModeSnapshot): boolean {
    const assignedKeys = snapshot.assignedKeys;
    const assignedControllerButtons = snapshot.assignedControllerButtons;
    if (new Set(assignedKeys).size !== assignedKeys.length || new Set(assignedControllerButtons).size !== assignedControllerButtons.length) {
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

function isAssignedKeyArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) &&
        value.length <= INPUT_CONFIG_STEP_COUNT &&
        new Set(value).size === value.length &&
        value.every((key) => isFiniteInteger(key) && key >= 0 && !ButtonMapping.isReservedKey(key))
    );
}

function isAssignedControllerArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) &&
        value.length <= INPUT_CONFIG_STEP_COUNT &&
        new Set(value).size === value.length &&
        value.every(
            (button) =>
                isFiniteInteger(button) &&
                button !== ButtonMapping.NO_BINDING &&
                (ButtonMapping.isControllerDirection(button) || ButtonMapping.isValidControllerActionBinding(button))
        )
    );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(record: Record<string, unknown>, expected: readonly string[]): boolean {
    const keys = Object.keys(record);
    return keys.length === expected.length && expected.every((key) => Object.hasOwn(record, key));
}

function isFiniteInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
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
    private controllerDirectionDown: boolean[] = [];
    private controllerConnectionGenerations: number[] = [];
    private captureEpochUsed = false;
    private awaitingControllerNeutral = false;
    private readonly blockedKeysUntilRelease = new Set<number>();

    public constructor(private readonly main: Main) {}

    public init(gc: GameContainer): void {
        InputConfigMode.restoredCompletion.delete(this);
        this.input = gc.getInput();
        ControllerSupport.configureInput(this.input);
        this.input.addKeyListener(this);
        this.draft = this.createDraft();
        this.assignedKeys.clear();
        this.assignedControllerButtons.clear();
        this.syncControllerInputState(true);
        this.main.clearInputPressedRecords();
    }

    public resyncInputAfterBrowserResume(): void {
        this.blockedKeysUntilRelease.clear();
        this.captureEpochUsed = false;
        const baseline = this.syncControllerInputState(true);
        this.awaitingControllerNeutral = !baseline.valid || baseline.anyDown;
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
        for (const key of snapshot.assignedKeys) {
            this.assignedKeys.add(key);
        }
        this.assignedControllerButtons.clear();
        for (const button of snapshot.assignedControllerButtons) {
            this.assignedControllerButtons.add(button);
        }
        // Restoring the editor is never a preference commit. The shell's current
        // session mapping remains authoritative, even if this draft differs.
        this.syncControllerInputState(true);
        this.main.clearInputPressedRecords();

        InputConfigMode.restoredCompletion.add(this);
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
            this.main.drawString(this.completionMessage(), this.centerX(this.completionMessage()), InputConfigMode.MESSAGE_Y);
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
        if (ButtonMapping.isReservedKey(key)) {
            return;
        }
        if (this.blockedKeysUntilRelease.has(key) || !this.canAcceptInput()) {
            this.blockedKeysUntilRelease.add(key);
            return;
        }

        this.captureEpochUsed = true;
        this.blockedKeysUntilRelease.add(key);
        if (!this.bindKey(key)) {
            this.message = "ALREADY USED";
            return;
        }
        this.advance();
    }

    public keyReleased(key: number, c: string): void {
        void c;
        this.blockedKeysUntilRelease.delete(key);
    }

    public setInput(input: Input): void {
        this.input = input;
    }

    public isAcceptingInput(): boolean {
        return true;
    }

    public inputEnded(): void {}

    public inputStarted(): void {
        this.captureEpochUsed = false;
    }

    private canAcceptInput(): boolean {
        return !this.finished && this.armDelay == 0 && !this.captureEpochUsed;
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
        const sample = this.sampleControllerInputState();
        if (!sample.valid) {
            return;
        }
        if (this.awaitingControllerNeutral) {
            if (!sample.anyDown) {
                this.awaitingControllerNeutral = false;
            }
            return;
        }

        if (sample.direction !== ButtonMapping.NO_BINDING && !this.isActionStep()) {
            if (!this.bindControllerButton(sample.direction)) {
                this.message = "ALREADY USED";
                return;
            }
            this.captureEpochUsed = true;
            this.awaitingControllerNeutral = sample.anyDown;
            this.advance();
            return;
        }

        if (sample.button !== ButtonMapping.NO_BINDING) {
            if (!this.bindControllerButton(sample.button)) {
                this.message = "ALREADY USED";
                return;
            }
            this.captureEpochUsed = true;
            this.awaitingControllerNeutral = sample.anyDown;
            this.advance();
        }
    }

    private sampleControllerInputState(suppressEdges: boolean = false): ControllerCaptureSample {
        const input = this.input;
        if (input === null) {
            return { direction: ButtonMapping.NO_BINDING, button: ButtonMapping.NO_BINDING, anyDown: false, valid: false };
        }

        const status = input.getControllerSampleStatus();
        const controllerCount = input.getControllerCount();
        this.resizeControllerRuntimeState(controllerCount);

        const directionPressed = [false, false, false, false];
        let pressedButton = ButtonMapping.NO_BINDING;
        let anyDown = false;

        for (let controller = 0; controller < controllerCount; controller++) {
            const connectionGeneration = input.getControllerConnectionGeneration(controller);
            const generationChanged = this.controllerConnectionGenerations[controller] !== connectionGeneration;
            const controllerSuppressEdges = suppressEdges || !status.valid || status.baselineOnly || generationChanged;
            if (status.valid) {
                this.controllerConnectionGenerations[controller] = connectionGeneration;
            }

            const directions = [
                input.isControllerUp(controller),
                input.isControllerDown(controller),
                input.isControllerLeft(controller),
                input.isControllerRight(controller)
            ] as const;
            for (let directionIndex = 0; directionIndex < directions.length; directionIndex++) {
                const stateIndex = controller * 4 + directionIndex;
                const down = directions[directionIndex]!;
                const pressed = status.valid && !controllerSuppressEdges && down && !this.controllerDirectionDown[stateIndex];
                if (status.valid) {
                    this.controllerDirectionDown[stateIndex] = down;
                }
                directionPressed[directionIndex] ||= pressed;
                anyDown ||= down;
            }

            const buttonLimit = ControllerSupport.getButtonScanLimitForController(input, controller);
            for (let button = 0; button < ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT; button++) {
                const stateIndex = controller * ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT + button;
                const down = button < buttonLimit && input.isButtonPressed(button, controller);
                const pressed = status.valid && !controllerSuppressEdges && down && !this.controllerButtonDown[stateIndex];
                if (status.valid) {
                    this.controllerButtonDown[stateIndex] = down;
                }
                anyDown ||= down;
                if (
                    pressedButton === ButtonMapping.NO_BINDING &&
                    pressed &&
                    !ControllerSupport.isDirectionalButton(input, button, controller) &&
                    !this.isDraftDirectionButton(button)
                ) {
                    pressedButton = button;
                }
            }
        }

        let direction = ButtonMapping.NO_BINDING;
        if (directionPressed[0]) direction = ButtonMapping.CONTROLLER_DIRECTION_UP;
        else if (directionPressed[1]) direction = ButtonMapping.CONTROLLER_DIRECTION_DOWN;
        else if (directionPressed[2]) direction = ButtonMapping.CONTROLLER_DIRECTION_LEFT;
        else if (directionPressed[3]) direction = ButtonMapping.CONTROLLER_DIRECTION_RIGHT;

        return {
            direction,
            button: pressedButton,
            anyDown,
            valid: status.valid
        };
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
        return { ...draft };
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
            InputConfigMode.restoredCompletion.delete(this);
            this.message = this.main.notifyInputMappingChanged().saved ? "SAVED" : "NOT SAVED";
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

    private resizeControllerRuntimeState(controllerCount: number): void {
        const buttonLength = controllerCount * ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT;
        if (this.controllerButtonDown.length !== buttonLength) {
            this.controllerButtonDown.length = buttonLength;
            this.controllerButtonDown.fill(false);
        }
        const directionLength = controllerCount * 4;
        if (this.controllerDirectionDown.length !== directionLength) {
            this.controllerDirectionDown.length = directionLength;
            this.controllerDirectionDown.fill(false);
        }
        if (this.controllerConnectionGenerations.length !== controllerCount) {
            this.controllerConnectionGenerations.length = controllerCount;
            this.controllerConnectionGenerations.fill(0);
        }
    }

    private syncControllerInputState(requestAuthoritativeBaseline: boolean = false): ControllerCaptureSample {
        const input = this.input;
        if (input === null) {
            return { direction: ButtonMapping.NO_BINDING, button: ButtonMapping.NO_BINDING, anyDown: false, valid: false };
        }
        if (requestAuthoritativeBaseline) {
            input.sampleControllersForBaseline();
        }
        return this.sampleControllerInputState(true);
    }

    private static readonly restoredCompletion = new WeakSet<InputConfigMode>();
    public completionMessage(): string {
        return this.finished && InputConfigMode.restoredCompletion.has(this) ? "DONE" : this.message;
    }
}
