export const NO_BINDING = -1;
export const DIRECTION_UP = -2;
export const DIRECTION_DOWN = -3;
export const DIRECTION_LEFT = -4;
export const DIRECTION_RIGHT = -5;
// Persisted domain: tests keep this equal to the input adapter scan limit.
export const RAW_BUTTON_LIMIT = 64;
export type NesControl = "UP" | "DOWN" | "LEFT" | "RIGHT" | "A" | "B" | "START";

export const INPUTS = [
    { control: "UP", label: "UP", key: "keyUp", controller: "controllerUp" },
    { control: "DOWN", label: "DOWN", key: "keyDown", controller: "controllerDown" },
    { control: "LEFT", label: "LEFT", key: "keyLeft", controller: "controllerLeft" },
    { control: "RIGHT", label: "RIGHT", key: "keyRight", controller: "controllerRight" },
    { control: "A", label: "JUMP", key: "keyJump", controller: "controllerJump" },
    { control: "B", label: "ATTACK", key: "keyAttack", controller: "controllerAttack" }
] as const satisfies readonly {
    control: NesControl;
    label: string;
    key: string;
    controller: string;
}[];
export type KeyField = (typeof INPUTS)[number]["key"];
export type ControllerField = (typeof INPUTS)[number]["controller"];
export type MappingFields = Record<KeyField | ControllerField, number>;
export const KEY_FIELDS: readonly KeyField[] = INPUTS.map((row) => row.key);
export const CONTROLLER_FIELDS: readonly ControllerField[] = INPUTS.map((row) => row.controller);

export function isLogicalDirection(value: unknown): value is number {
    return value === DIRECTION_UP || value === DIRECTION_DOWN || value === DIRECTION_LEFT || value === DIRECTION_RIGHT;
}
export function isRawButton(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < RAW_BUTTON_LIMIT;
}
export function isControllerBinding(value: unknown): value is number {
    return value === NO_BINDING || isLogicalDirection(value) || isRawButton(value);
}
function inputAt(step: number): (typeof INPUTS)[number] {
    const row = INPUTS[step];
    if (!Number.isInteger(step) || row === undefined) {
        throw new RangeError("Invalid NES mapping step: " + step);
    }
    return row;
}
export function assignKey(draft: MappingFields, step: number, key: number, used: Set<number>): boolean {
    const target = inputAt(step);
    // The editor applies its platform's supported/reserved-key policy.
    if (!Number.isInteger(key) || key < 0 || used.has(key)) return false;
    for (const field of KEY_FIELDS) {
        if (draft[field] === key) draft[field] = NO_BINDING;
    }
    draft[target.key] = key;
    used.add(key);
    return true;
}
export function assignController(draft: MappingFields, step: number, binding: number, used: Set<number>): boolean {
    const target = inputAt(step);
    if (!isControllerBinding(binding) || binding === NO_BINDING || used.has(binding)) {
        return false;
    }
    for (const field of CONTROLLER_FIELDS) {
        if (draft[field] === binding) draft[field] = NO_BINDING;
    }
    draft[target.controller] = binding;
    used.add(binding);
    return true;
}
export function copyInto(source: MappingFields, target: MappingFields): void {
    for (const row of INPUTS) {
        target[row.key] = source[row.key];
        target[row.controller] = source[row.controller];
    }
}
