import { Input } from "slick2d-ts";
import { ButtonMapping } from "./ButtonMapping.js";

/** Browser counterpart to the desktop ControllerSupport boundary. */
export class ControllerSupport {
    public static readonly GAMEPAD_BUTTON_INDEX_LIMIT = Input.BROWSER_CONTROLLER_BUTTON_LIMIT;
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
            default:
                // Nonnegative bindings are always raw physical button indexes.
                // Standard-layout D-pad capture is canonicalized to the negative
                // logical direction constants instead of changing this meaning.
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
        return button >= 0 && button < ControllerSupport.getButtonScanLimit(input) && input.isButtonPressed(button, Input.ANY_CONTROLLER);
    }

    public static isNonDirectionalButtonDown(input: Input, mapping: ButtonMapping): boolean {
        const controllerCount = input.getControllerCount();
        for (let controller = 0; controller < controllerCount; controller++) {
            const limit = ControllerSupport.getButtonScanLimitForController(input, controller);
            for (let button = 0; button < limit; button++) {
                if (
                    !ControllerSupport.isDirectionalButton(input, button, controller) &&
                    !ControllerSupport.isMappedDirectionButton(mapping, button) &&
                    input.isButtonPressed(button, controller)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    public static getButtonScanLimit(input: Input): number {
        let count = 0;
        const controllerCount = input.getControllerCount();
        for (let controller = 0; controller < controllerCount; controller++) {
            count = Math.max(count, ControllerSupport.getButtonScanLimitForController(input, controller));
        }
        return count;
    }

    public static getButtonScanLimitForController(input: Input, controller: number): number {
        return Math.min(input.getButtonCount(controller), ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT);
    }

    public static isButtonDownOnController(input: Input, button: number, controller: number): boolean {
        return button >= 0 && button < ControllerSupport.getButtonScanLimitForController(input, controller) && input.isButtonPressed(button, controller);
    }

    public static isDirectionalButton(input: Input, button: number, controller: number): boolean {
        return input.isControllerButtonDirectional(button, controller);
    }

    public static isDirectionDownOnController(input: Input, direction: number, controller: number): boolean {
        switch (direction) {
            case ButtonMapping.CONTROLLER_DIRECTION_UP:
                return input.isControllerUp(controller);
            case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
                return input.isControllerDown(controller);
            case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
                return input.isControllerLeft(controller);
            case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
                return input.isControllerRight(controller);
            default:
                return ControllerSupport.isButtonDownOnController(input, direction, controller);
        }
    }

    private static isMappedDirectionButton(mapping: ButtonMapping, button: number): boolean {
        return mapping.controllerUp === button || mapping.controllerDown === button || mapping.controllerLeft === button || mapping.controllerRight === button;
    }
}
