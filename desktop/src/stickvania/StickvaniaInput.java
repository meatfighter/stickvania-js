package stickvania;

import org.newdawn.slick.Input;

public class StickvaniaInput {

  private static final int MAX_CONTROLLER_BUTTONS_TO_SCAN = 32;

  private final Input input;
  private final ButtonMapping mapping;
  private InputState previous = new InputState();
  private InputState current = new InputState();

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
  }

  public StickvaniaInput(Input input, ButtonMapping mapping) {
    this.input = input;
    this.mapping = mapping;
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
    return current.menuUp && !previous.menuUp;
  }

  public boolean isMenuDownPressed() {
    return current.menuDown && !previous.menuDown;
  }

  public boolean isMenuSelectPressed() {
    return current.menuSelect && !previous.menuSelect;
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
    state.menuUp = state.up || isControllerUp();
    state.menuDown = state.down || isControllerDown();
    state.menuSelect = state.jump || state.attack
        || isKeyDown(Input.KEY_ENTER) || isAnyControllerNonDirectionalButtonDown();
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
    return copy;
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
      if (!isDirectionalGamepadButton(i) && isControllerButtonPressed(i)) {
        return true;
      }
    }
    return false;
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
      return input.isControllerUp(Input.ANY_CONTROLLER);
    } catch(Throwable t) {
      return false;
    }
  }

  private boolean isControllerDown() {
    try {
      return input.isControllerDown(Input.ANY_CONTROLLER);
    } catch(Throwable t) {
      return false;
    }
  }

  private boolean isControllerLeft() {
    try {
      return input.isControllerLeft(Input.ANY_CONTROLLER);
    } catch(Throwable t) {
      return false;
    }
  }

  private boolean isControllerRight() {
    try {
      return input.isControllerRight(Input.ANY_CONTROLLER);
    } catch(Throwable t) {
      return false;
    }
  }

  private static boolean isDirectionalGamepadButton(int button) {
    return button >= 12 && button <= 15;
  }
}
