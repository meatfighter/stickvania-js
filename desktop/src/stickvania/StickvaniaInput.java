package stickvania;

import org.newdawn.slick.Input;

public class StickvaniaInput {

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
    ControllerSupport.initialize();
    clearPressedState();
  }

  public void update() {
    previous = current;
    current = readState();
    // Main evaluates its stage countdown immediately after input/frame-state
    // early exits. Preflight the imminent countdown before those checks run.
    PlayerActionPolicy.prepareRegisteredCountdownTimer();
    // Catch terminal/control-loss state that was already true at frame start,
    // including pit/death/hurt paths that return before Main reads Attack.
    PlayerActionPolicy.reconcileRegisteredSimonActionBeforeAttackRead();
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
    // Main reads Attack immediately before advancing the delayed action. Reconcile
    // again because the stage timer can become terminal after update() but before
    // this read. General terminal state can suppress a fresh action, but hearts,
    // capacity, weapon type, and timeFrozen are intentionally not part of it.
    PlayerActionPolicy.reconcileRegisteredSimonActionBeforeAttackRead();
    return current.attack && PlayerActionPolicy.canRegisteredSimonActionStart();
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
    boolean keyUp = isKeyDown(mapping.keyUp);
    boolean keyDown = isKeyDown(mapping.keyDown);
    boolean keyLeft = isKeyDown(mapping.keyLeft);
    boolean keyRight = isKeyDown(mapping.keyRight);
    boolean keyJump = isKeyDown(mapping.keyJump);
    boolean keyAttack = isKeyDown(mapping.keyAttack);
    boolean controllerUp = isControllerBindingDown(mapping.controllerUp);
    boolean controllerDown = isControllerBindingDown(mapping.controllerDown);
    boolean controllerLeft = isControllerBindingDown(mapping.controllerLeft);
    boolean controllerRight = isControllerBindingDown(mapping.controllerRight);
    boolean controllerJump = isControllerBindingDown(mapping.controllerJump);
    boolean controllerAttack = isControllerBindingDown(mapping.controllerAttack);
    boolean enterSelect = !isKeyMappedToDirection(Input.KEY_ENTER)
        && isKeyDown(Input.KEY_ENTER);
    state.up = keyUp || controllerUp;
    state.down = keyDown || controllerDown;
    state.left = keyLeft || controllerLeft;
    state.right = keyRight || controllerRight;
    state.jump = keyJump || controllerJump;
    state.attack = keyAttack || controllerAttack;
    state.menuUpKeyboard = keyUp;
    state.menuUpController = controllerUp;
    state.menuDownKeyboard = keyDown;
    state.menuDownController = controllerDown;
    state.menuSelectJumpKeyboard = keyJump;
    state.menuSelectAttackKeyboard = keyAttack;
    state.menuSelectEnterKeyboard = enterSelect;
    state.menuSelectJumpController = controllerJump;
    state.menuSelectAttackController = controllerAttack;
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

  private boolean isKeyMappedToDirection(int key) {
    return mapping.keyUp == key
        || mapping.keyDown == key
        || mapping.keyLeft == key
        || mapping.keyRight == key;
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
    return ControllerSupport.isDirectionDown(button);
  }

  private boolean isAnyControllerNonDirectionalButtonDown() {
    return ControllerSupport.isNonDirectionalButtonDown(mapping);
  }
}
