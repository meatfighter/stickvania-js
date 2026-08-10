import { Color, type ControllerListener, type GameContainer, type Graphics, Input, type KeyListener } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";
import type { Main } from "./Main.js";

type BindingStep = "JUMP" | "ATTACK" | "UP" | "DOWN" | "LEFT" | "RIGHT";

export class InputConfigMode implements ControllerListener, KeyListener {
    private static readonly KEYBOARD_STEPS: BindingStep[] = [ "JUMP", "ATTACK", "UP", "DOWN", "LEFT", "RIGHT" ];
    private static readonly CONTROLLER_STEPS: BindingStep[] = [ "JUMP", "ATTACK" ];
    private static readonly PROMPT_1 = "On either your keyboard";
    private static readonly PROMPT_2 = "or gamepad, press:";
    private static readonly PROMPT_1_X = Math.trunc((640 - InputConfigMode.PROMPT_1.length * 16) / 2);
    private static readonly PROMPT_2_X = Math.trunc((640 - InputConfigMode.PROMPT_2.length * 16) / 2);
    private static readonly PROMPT_1_Y = 288;
    private static readonly PROMPT_2_Y = 320;
    private static readonly STEP_Y = 368;
    private static readonly ERROR_Y = 416;
    private static readonly DONE_DELAY = 30;

    private input: Input = null;
    private stepIndex = 0;
    private readingController = false;
    private doneDelay = 0;
    private message = "";
    private finished = false;

    public constructor(private readonly main: Main) {
    }

    public init(gc: GameContainer): void {
        this.input = gc.getInput();
        this.input.addKeyListener(this);
        this.input.addControllerListener(this);
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
        if (this.doneDelay > 0 && --this.doneDelay == 0) {
            this.finish();
        }
    }

    public render(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);
        this.main.drawString("INPUT", 272, 208);
        this.main.drawString(InputConfigMode.PROMPT_1, InputConfigMode.PROMPT_1_X, InputConfigMode.PROMPT_1_Y);
        this.main.drawString(InputConfigMode.PROMPT_2, InputConfigMode.PROMPT_2_X, InputConfigMode.PROMPT_2_Y);
        if (!this.finished) {
            this.main.drawString(this.getCurrentStep(), this.getStepX(), InputConfigMode.STEP_Y);
        }
        if (this.message.length > 0) {
            this.main.drawString(this.message, this.getMessageX(), InputConfigMode.ERROR_Y);
        }
    }

    public keyPressed(key: number, c: string): void {
        if (this.finished || ButtonMapping.isReservedKey(key)) {
            return;
        }
        if (this.readingController) {
            return;
        }
        if (!this.bindKey(key)) {
            this.message = "ALREADY USED";
            return;
        }
        this.message = "";
        this.advanceKeyboard();
    }

    public keyReleased(key: number, c: string): void {
    }

    public controllerButtonPressed(controller: number, button: number): void {
        if (this.finished) {
            return;
        }
        if (!this.readingController && this.stepIndex > 0) {
            return;
        }
        const buttonIndex = button - 1;
        if (buttonIndex < 0) {
            return;
        }
        this.readingController = true;
        if (!this.bindControllerButton(buttonIndex)) {
            this.message = "ALREADY USED";
            return;
        }
        this.main.buttonMapping.controller = true;
        this.main.buttonMapping.rememberController(controller);
        this.message = "";
        this.advanceController();
    }

    public controllerButtonReleased(controller: number, button: number): void {
    }

    public controllerLeftPressed(controller: number): void {
    }

    public controllerLeftReleased(controller: number): void {
    }

    public controllerRightPressed(controller: number): void {
    }

    public controllerRightReleased(controller: number): void {
    }

    public controllerUpPressed(controller: number): void {
    }

    public controllerUpReleased(controller: number): void {
    }

    public controllerDownPressed(controller: number): void {
    }

    public controllerDownReleased(controller: number): void {
    }

    public setInput(input: Input): void {
        this.input = input;
    }

    public isAcceptingInput(): boolean {
        return true;
    }

    public inputEnded(): void {
    }

    public inputStarted(): void {
    }

    private bindKey(key: number): boolean {
        const mapping = this.main.buttonMapping;
        switch (this.getCurrentStep()) {
            case "JUMP":
                mapping.keyJump = key;
                return true;
            case "ATTACK":
                if (mapping.keyJump === key) {
                    return false;
                }
                mapping.keyAttack = key;
                return true;
            case "UP":
                if (mapping.keyJump !== key && mapping.keyAttack !== key) {
                    mapping.keyUp = key;
                    return true;
                }
                return false;
            case "DOWN":
                if (mapping.keyJump !== key && mapping.keyAttack !== key && mapping.keyUp !== key) {
                    mapping.keyDown = key;
                    return true;
                }
                return false;
            case "LEFT":
                if (mapping.keyJump !== key && mapping.keyAttack !== key
                        && mapping.keyUp !== key && mapping.keyDown !== key) {
                    mapping.keyLeft = key;
                    return true;
                }
                return false;
            case "RIGHT":
                if (mapping.keyJump !== key && mapping.keyAttack !== key
                        && mapping.keyUp !== key && mapping.keyDown !== key && mapping.keyLeft !== key) {
                    mapping.keyRight = key;
                    return true;
                }
                return false;
        }
    }

    private bindControllerButton(button: number): boolean {
        const mapping = this.main.buttonMapping;
        switch (this.getCurrentStep()) {
            case "JUMP":
                mapping.controllerJump = button;
                return true;
            case "ATTACK":
                if (mapping.controllerJump !== button) {
                    mapping.controllerAttack = button;
                    return true;
                }
                return false;
            default:
                return false;
        }
    }

    private advanceKeyboard(): void {
        this.main.playSound(this.main.pressed_enter);
        this.stepIndex++;
        if (this.stepIndex == InputConfigMode.KEYBOARD_STEPS.length) {
            this.prepareToFinish();
        }
    }

    private advanceController(): void {
        this.main.playSound(this.main.pressed_enter);
        this.stepIndex++;
        if (this.stepIndex == InputConfigMode.CONTROLLER_STEPS.length) {
            this.prepareToFinish();
        }
    }

    private prepareToFinish(): void {
        this.finished = true;
        this.message = "SAVED";
        this.main.buttonMapping.save();
        this.main.controlInput?.clearPressedState();
        this.doneDelay = InputConfigMode.DONE_DELAY;
    }

    private finish(): void {
        this.dispose();
        this.main.finishInputConfig();
    }

    private getCurrentStep(): BindingStep {
        return this.readingController
            ? InputConfigMode.CONTROLLER_STEPS[this.stepIndex]
            : InputConfigMode.KEYBOARD_STEPS[this.stepIndex];
    }

    private getStepX(): number {
        return Math.trunc((640 - this.getCurrentStep().length * 16) / 2);
    }

    private getMessageX(): number {
        return Math.trunc((640 - this.message.length * 16) / 2);
    }
}
