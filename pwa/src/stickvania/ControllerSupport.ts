import { Input } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";

/** Browser counterpart to the desktop ControllerSupport boundary. */
export class ControllerSupport {
    public static readonly GAMEPAD_BUTTON_INDEX_LIMIT = 64;
    private static readonly ADDITIONAL_DIRECTION_AXES = [
        { horizontalAxis: 2, verticalAxis: 3 },
        { horizontalAxis: 6, verticalAxis: 7 }
    ] as const;

    private constructor() {}

    public static configureInput(input: Input): void {
        input.setAdditionalControllerDirectionAxes(ControllerSupport.ADDITIONAL_DIRECTION_AXES, 0.5, 0.05);
    }

    public static isDirectionDown(input: Input, direction: number): boolean {
        switch (direction) {
            case ButtonMapping.CONTROLLER_DIRECTION_UP:
                return ControllerSupport.isUpDown(input);
            case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
                return ControllerSupport.isDownDown(input);
            case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
                return ControllerSupport.isLeftDown(input);
            case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
                return ControllerSupport.isRightDown(input);
            case 12:
                return ControllerSupport.isUpDown(input) || ControllerSupport.isButtonDown(input, direction);
            case 13:
                return ControllerSupport.isDownDown(input) || ControllerSupport.isButtonDown(input, direction);
            case 14:
                return ControllerSupport.isLeftDown(input) || ControllerSupport.isButtonDown(input, direction);
            case 15:
                return ControllerSupport.isRightDown(input) || ControllerSupport.isButtonDown(input, direction);
            default:
                return ControllerSupport.isButtonDown(input, direction);
        }
    }

    public static isUpDown(input: Input): boolean {
        return input.isControllerUp(Input.ANY_CONTROLLER);
    }

    public static isDownDown(input: Input): boolean {
        return input.isControllerDown(Input.ANY_CONTROLLER);
    }

    public static isLeftDown(input: Input): boolean {
        return input.isControllerLeft(Input.ANY_CONTROLLER);
    }

    public static isRightDown(input: Input): boolean {
        return input.isControllerRight(Input.ANY_CONTROLLER);
    }

    public static isButtonDown(input: Input, button: number): boolean {
        return button >= 0 && button < ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT && input.isButtonPressed(button, Input.ANY_CONTROLLER);
    }

    public static isNonDirectionalButtonDown(input: Input, mapping: ButtonMapping): boolean {
        for (let button = 0; button < ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT; button++) {
            if (
                !ControllerSupport.isDirectionalButton(button) &&
                !ControllerSupport.isMappedDirectionButton(mapping, button) &&
                ControllerSupport.isButtonDown(input, button)
            ) {
                return true;
            }
        }
        return false;
    }

    public static isDirectionalButton(button: number): boolean {
        return button >= 12 && button <= 15;
    }

    public static refreshControllersIfNeeded(_input: Input): boolean {
        return false;
    }

    private static isMappedDirectionButton(mapping: ButtonMapping, button: number): boolean {
        return mapping.controllerUp === button || mapping.controllerDown === button || mapping.controllerLeft === button || mapping.controllerRight === button;
    }
}
