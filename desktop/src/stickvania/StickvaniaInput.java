package stickvania;

import java.util.Arrays;
import org.newdawn.slick.Input;

public class StickvaniaInput {

  private static final int CONTROLLER_INDEX_LIMIT = 16;
  private static final int MAX_CONTROLLER_BUTTONS_TO_SCAN = 32;
  private static final int GAMEPAD_AXIS_LIMIT = 16;
  private static final float AXIS_THRESHOLD = 0.5f;
  private static final float AXIS_RECENTER_THRESHOLD = 0.05f;
  private static final int[] EXTRA_HORIZONTAL_AXES = { 2, 6 };
  private static final int[] EXTRA_VERTICAL_AXES = { 3, 7 };

  private final Input input;
  private final ButtonMapping mapping;
  private InputState previous = new InputState();
  private InputState current = new InputState();
  private final float[] extraAxisBaselines =
      new float[CONTROLLER_INDEX_LIMIT * GAMEPAD_AXIS_LIMIT];

  private static final class InputState {
    boolean up;
    boolean down;
    boolean left;
    boolean right;
    boolean jump;
    boolean attack;
    boolean menuUp;
    boolean menuDown;
    boolean menuSelect;
    boolean menuUpKeyboard;
    boolean menuUpController;
    boolean menuDownKeyboard;
    boolean menuDownController;
    boolean menuSelectJumpKeyboard;
    boolean menuSelectAttackKeyboard;
    boolean menuSelectEnterKeyboard;
    boolean menuSelectJumpController;
    boolean menuSelectAttackController;
    boolean menuSelectAnyController;
  }

  public StickvaniaInput(Input input, ButtonMapping mapping) {
    this.input = input;
    this.mapping = mapping;
    Arrays.fill(extraAxisBaselines, Float.NaN);
    clearPressedState();
  }

  public void update() {
    previous = current;
    current = readState();
  }

  public void clearPressedState() {
    current = readState();
    previous = copy(current);
  }

  public boolean isUp() {
    return current.up;
  }

  public boolean isDown() {
    return current.down;
  }

  public boolean isLeft() {
    return current.left;
  }

  public boolean isRight() {
    return current.right;
  }

  public boolean isJump() {
    return current.jump;
  }

  public boolean isAttack() {
    return current.attack;
  }

  public boolean isMenuUpPressed() {
    return pressed(current.menuUpKeyboard, previous.menuUpKeyboard)
        || pressed(current.menuUpController, previous.menuUpController);
  }

  public boolean isMenuDownPressed() {
    return pressed(current.menuDownKeyboard, previous.menuDownKeyboard)
        || pressed(current.menuDownController, previous.menuDownController);
  }

  public boolean isMenuSelectPressed() {
    return pressed(current.menuSelectJumpKeyboard,
            previous.menuSelectJumpKeyboard)
        || pressed(current.menuSelectAttackKeyboard,
            previous.menuSelectAttackKeyboard)
        || pressed(current.menuSelectEnterKeyboard,
            previous.menuSelectEnterKeyboard)
        || pressed(current.menuSelectJumpController,
            previous.menuSelectJumpController)
        || pressed(current.menuSelectAttackController,
            previous.menuSelectAttackController)
        || pressed(current.menuSelectAnyController,
            previous.menuSelectAnyController);
  }

  public boolean isAnyNonDirectionalPressed() {
    return isMenuSelectPressed();
  }

  private InputState readState() {
    InputState state = new InputState();
    state.up = isKeyDown(mapping.keyUp)
        || isControllerBindingDown(mapping.controllerUp);
    state.down = isKeyDown(mapping.keyDown)
        || isControllerBindingDown(mapping.controllerDown);
    state.left = isKeyDown(mapping.keyLeft)
        || isControllerBindingDown(mapping.controllerLeft);
    state.right = isKeyDown(mapping.keyRight)
        || isControllerBindingDown(mapping.controllerRight);
    state.jump = isKeyDown(mapping.keyJump)
        || isControllerBindingDown(mapping.controllerJump);
    state.attack = isKeyDown(mapping.keyAttack)
        || isControllerBindingDown(mapping.controllerAttack);
    state.menuUpKeyboard = isKeyDown(mapping.keyUp)
        || isKeyDown(Input.KEY_UP);
    state.menuUpController = isControllerBindingDown(mapping.controllerUp)
        || isControllerUp();
    state.menuDownKeyboard = isKeyDown(mapping.keyDown)
        || isKeyDown(Input.KEY_DOWN);
    state.menuDownController = isControllerBindingDown(mapping.controllerDown)
        || isControllerDown();
    state.menuSelectJumpKeyboard = isKeyDown(mapping.keyJump);
    state.menuSelectAttackKeyboard = isKeyDown(mapping.keyAttack);
    state.menuSelectEnterKeyboard = isKeyDown(Input.KEY_ENTER);
    state.menuSelectJumpController =
        isControllerBindingDown(mapping.controllerJump);
    state.menuSelectAttackController =
        isControllerBindingDown(mapping.controllerAttack);
    state.menuSelectAnyController = isAnyControllerNonDirectionalButtonDown();
    state.menuUp = state.menuUpKeyboard || state.menuUpController;
    state.menuDown = state.menuDownKeyboard || state.menuDownController;
    state.menuSelect = state.menuSelectJumpKeyboard
        || state.menuSelectAttackKeyboard
        || state.menuSelectEnterKeyboard
        || state.menuSelectJumpController
        || state.menuSelectAttackController
        || state.menuSelectAnyController;
    return state;
  }

  private InputState copy(InputState state) {
    InputState copy = new InputState();
    copy.up = state.up;
    copy.down = state.down;
    copy.left = state.left;
    copy.right = state.right;
    copy.jump = state.jump;
    copy.attack = state.attack;
    copy.menuUp = state.menuUp;
    copy.menuDown = state.menuDown;
    copy.menuSelect = state.menuSelect;
    copy.menuUpKeyboard = state.menuUpKeyboard;
    copy.menuUpController = state.menuUpController;
    copy.menuDownKeyboard = state.menuDownKeyboard;
    copy.menuDownController = state.menuDownController;
    copy.menuSelectJumpKeyboard = state.menuSelectJumpKeyboard;
    copy.menuSelectAttackKeyboard = state.menuSelectAttackKeyboard;
    copy.menuSelectEnterKeyboard = state.menuSelectEnterKeyboard;
    copy.menuSelectJumpController = state.menuSelectJumpController;
    copy.menuSelectAttackController = state.menuSelectAttackController;
    copy.menuSelectAnyController = state.menuSelectAnyController;
    return copy;
  }

  private static boolean pressed(boolean current, boolean previous) {
    return current && !previous;
  }

  private boolean isKeyDown(int key) {
    if (key == ButtonMapping.NO_BINDING) {
      return false;
    }
    try {
      return input.isKeyDown(key);
    } catch(Throwable t) {
      return false;
    }
  }

  private boolean isControllerBindingDown(int button) {
    if (button == ButtonMapping.NO_BINDING) {
      return false;
    }
    switch(button) {
      case ButtonMapping.CONTROLLER_DIRECTION_UP:
        return isControllerUp();
      case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
        return isControllerDown();
      case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
        return isControllerLeft();
      case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
        return isControllerRight();
      case 12:
        return isControllerUp() || isControllerButtonPressed(button);
      case 13:
        return isControllerDown() || isControllerButtonPressed(button);
      case 14:
        return isControllerLeft() || isControllerButtonPressed(button);
      case 15:
        return isControllerRight() || isControllerButtonPressed(button);
      default:
        return isControllerButtonPressed(button);
    }
  }

  private boolean isAnyControllerNonDirectionalButtonDown() {
    for(int i = 0; i < MAX_CONTROLLER_BUTTONS_TO_SCAN; i++) {
      if (!isDirectionalGamepadButton(i)
          && !isMappedDirectionButton(i)
          && isControllerButtonPressed(i)) {
        return true;
      }
    }
    return false;
  }

  private boolean isMappedDirectionButton(int button) {
    return mapping.controllerUp == button
        || mapping.controllerDown == button
        || mapping.controllerLeft == button
        || mapping.controllerRight == button;
  }

  private boolean isControllerButtonPressed(int button) {
    try {
      return input.isButtonPressed(button, Input.ANY_CONTROLLER);
    } catch(Throwable t) {
      return false;
    }
  }

  private boolean isControllerUp() {
    try {
      return input.isControllerUp(Input.ANY_CONTROLLER) || isExtraAxisUp();
    } catch(Throwable t) {
      return isExtraAxisUp();
    }
  }

  private boolean isControllerDown() {
    try {
      return input.isControllerDown(Input.ANY_CONTROLLER) || isExtraAxisDown();
    } catch(Throwable t) {
      return isExtraAxisDown();
    }
  }

  private boolean isControllerLeft() {
    try {
      return input.isControllerLeft(Input.ANY_CONTROLLER) || isExtraAxisLeft();
    } catch(Throwable t) {
      return isExtraAxisLeft();
    }
  }

  private boolean isControllerRight() {
    try {
      return input.isControllerRight(Input.ANY_CONTROLLER)
          || isExtraAxisRight();
    } catch(Throwable t) {
      return isExtraAxisRight();
    }
  }

  private static boolean isDirectionalGamepadButton(int button) {
    return ButtonMapping.isStandardGamepadDirectionButton(button);
  }

  private boolean isExtraAxisUp() {
    return isAnyAxisLessThan(EXTRA_VERTICAL_AXES, -AXIS_THRESHOLD);
  }

  private boolean isExtraAxisDown() {
    return isAnyAxisGreaterThan(EXTRA_VERTICAL_AXES, AXIS_THRESHOLD);
  }

  private boolean isExtraAxisLeft() {
    return isAnyAxisLessThan(EXTRA_HORIZONTAL_AXES, -AXIS_THRESHOLD);
  }

  private boolean isExtraAxisRight() {
    return isAnyAxisGreaterThan(EXTRA_HORIZONTAL_AXES, AXIS_THRESHOLD);
  }

  private boolean isAnyAxisLessThan(int[] axes, float threshold) {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      for(int i = 0; i < axes.length; i++) {
        if (readExtraAxisValue(controller, axes[i]) < threshold) {
          return true;
        }
      }
    }
    return false;
  }

  private boolean isAnyAxisGreaterThan(int[] axes, float threshold) {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      for(int i = 0; i < axes.length; i++) {
        if (readExtraAxisValue(controller, axes[i]) > threshold) {
          return true;
        }
      }
    }
    return false;
  }

  private int getControllerCount() {
    try {
      return Math.min(input.getControllerCount(), CONTROLLER_INDEX_LIMIT);
    } catch(Throwable t) {
      return 0;
    }
  }

  private float readExtraAxisValue(int controller, int axis) {
    try {
      if (input.getAxisCount(controller) <= axis) {
        return 0;
      }

      float value = input.getAxisValue(controller, axis);
      int baselineIndex = controller * GAMEPAD_AXIS_LIMIT + axis;
      float baseline = extraAxisBaselines[baselineIndex];
      if (Float.isNaN(baseline)) {
        baseline = value;
        extraAxisBaselines[baselineIndex] = baseline;
      }
      if (Math.abs(value) <= AXIS_RECENTER_THRESHOLD) {
        baseline = 0;
        extraAxisBaselines[baselineIndex] = baseline;
      }
      return value - baseline;
    } catch(Throwable t) {
      return 0;
    }
  }
}
