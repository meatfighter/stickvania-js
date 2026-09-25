package stickvania;

import java.util.Set;

/** Pure mapping policy; no polling, persistence, native resources, or effects. */
public final class NesInputProfile {
  public static final int UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3,
      A = 4, B = 5, START = 6;
  public static final int NO_BINDING = -1;
  public static final int DIRECTION_UP = -2, DIRECTION_DOWN = -3,
      DIRECTION_LEFT = -4, DIRECTION_RIGHT = -5;
  public static final int RAW_BUTTON_LIMIT = 64;
  public static final int ACTIVE_COUNT = 6;
  private static final String[] LABELS = { "UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK" };
  private NesInputProfile() {}
  private static void checkStep(int step) {
    if (step < 0 || step >= ACTIVE_COUNT) {
      throw new IllegalArgumentException("Invalid NES mapping step: " + step);
    }
  }
  public static String label(int step) { checkStep(step); return LABELS[step]; }
  public static boolean isLogicalDirection(int value) {
    return value == DIRECTION_UP || value == DIRECTION_DOWN ||
        value == DIRECTION_LEFT || value == DIRECTION_RIGHT;
  }
  public static boolean isRawButton(int value) {
    return value >= 0 && value < RAW_BUTTON_LIMIT;
  }
  public static boolean isControllerBinding(int value) {
    return value == NO_BINDING || isLogicalDirection(value) || isRawButton(value);
  }
  public static int key(ButtonMapping mapping, int step) {
    switch (step) {
      case UP: return mapping.keyUp;
      case DOWN: return mapping.keyDown;
      case LEFT: return mapping.keyLeft;
      case RIGHT: return mapping.keyRight;
      case A: return mapping.keyJump;
      case B: return mapping.keyAttack;
      default: throw new IllegalArgumentException("Invalid NES mapping step: " + step);
    }
  }
  public static void key(ButtonMapping mapping, int step, int value) {
    switch (step) {
      case UP: mapping.keyUp = value; return;
      case DOWN: mapping.keyDown = value; return;
      case LEFT: mapping.keyLeft = value; return;
      case RIGHT: mapping.keyRight = value; return;
      case A: mapping.keyJump = value; return;
      case B: mapping.keyAttack = value; return;
      default: throw new IllegalArgumentException("Invalid NES mapping step: " + step);
    }
  }
  public static int controller(ButtonMapping mapping, int step) {
    switch (step) {
      case UP: return mapping.controllerUp;
      case DOWN: return mapping.controllerDown;
      case LEFT: return mapping.controllerLeft;
      case RIGHT: return mapping.controllerRight;
      case A: return mapping.controllerJump;
      case B: return mapping.controllerAttack;
      default: throw new IllegalArgumentException("Invalid NES mapping step: " + step);
    }
  }
  public static void controller(ButtonMapping mapping, int step, int value) {
    switch (step) {
      case UP: mapping.controllerUp = value; return;
      case DOWN: mapping.controllerDown = value; return;
      case LEFT: mapping.controllerLeft = value; return;
      case RIGHT: mapping.controllerRight = value; return;
      case A: mapping.controllerJump = value; return;
      case B: mapping.controllerAttack = value; return;
      default: throw new IllegalArgumentException("Invalid NES mapping step: " + step);
    }
  }
  public static boolean assignKey(ButtonMapping draft, int step, int key,
      Set<Integer> used) {
    checkStep(step);
    if (key < 0 || used.contains(key)) return false;
    for (int i = 0; i < ACTIVE_COUNT; i++) {
      if (key(draft, i) == key) key(draft, i, NO_BINDING);
    }
    key(draft, step, key);
    used.add(key);
    return true;
  }
  public static boolean assignController(ButtonMapping draft, int step,
      int binding, Set<Integer> used) {
    checkStep(step);
    if (!isControllerBinding(binding) || binding == NO_BINDING ||
        used.contains(binding)) return false;
    for (int i = 0; i < ACTIVE_COUNT; i++) {
      if (controller(draft, i) == binding) controller(draft, i, NO_BINDING);
    }
    controller(draft, step, binding);
    used.add(binding);
    return true;
  }
  public static void copyInto(ButtonMapping source, ButtonMapping target) {
    for (int i = 0; i < ACTIVE_COUNT; i++) {
      key(target, i, key(source, i));
      controller(target, i, controller(source, i));
    }
  }
  public static ButtonMapping copy(ButtonMapping source) {
    ButtonMapping target = new ButtonMapping();
    copyInto(source, target);
    return target;
  }
}
