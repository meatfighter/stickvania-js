package stickvania;

import java.util.HashSet;
import java.util.Set;
import org.newdawn.slick.Color;
import org.newdawn.slick.GameContainer;
import org.newdawn.slick.Graphics;
import org.newdawn.slick.Input;
import org.newdawn.slick.KeyListener;
import org.newdawn.slick.SlickException;

public class InputConfigMode implements KeyListener {

  private static final String[] STEPS = new String[NesInputProfile.ACTIVE_COUNT];
  static {
    for (int i = 0; i < STEPS.length; i++) STEPS[i] = NesInputProfile.label(i);
  }
  private static final int DONE_DELAY = 30;
  private static final int ARM_DELAY = 8;
  private static final String PROMPT_LINE_1 = "ON EITHER YOUR KEYBOARD";
  private static final String PROMPT_LINE_2 = "OR GAMEPAD, PRESS:";
  private static final int PROMPT_LINE_1_Y = 152;
  private static final int PROMPT_LINE_2_Y = 184;
  private static final int MESSAGE_Y = 232;
  private static final int ERROR_Y = 280;
  private final Main main;
  private final Set<Integer> assignedKeys = new HashSet<Integer>();
  private final Set<Integer> assignedControllerBindings = new HashSet<Integer>();
  private final Set<Integer> blockedKeysUntilRelease = new HashSet<Integer>();
  private final boolean[] controllerButtonDown =
      new boolean[ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT];
  private Input input;
  private int stepIndex;
  private int doneDelay;
  private int armDelay = ARM_DELAY;
  private String message = "";
  private boolean finished;
  private boolean controllerUpDown;
  private boolean controllerDownDown;
  private boolean controllerLeftDown;
  private boolean controllerRightDown;
  private boolean captureEpochUsed;
  private boolean awaitingControllerNeutral;
  private ButtonMapping draft;

  private static final class ControllerCaptureSample {
    int direction = ButtonMapping.NO_BINDING;
    int button = ButtonMapping.NO_BINDING;
    boolean anyDown;
  }

  public InputConfigMode(Main main) {
    this.main = main;
  }

  public void init(GameContainer gc) {
    input = gc.getInput();
    input.addKeyListener(this);
    draft = createDraft();
    assignedKeys.clear();
    assignedControllerBindings.clear();
    syncControllerInputState();
    main.clearInputPressedRecords();
  }

  public void dispose() {
    if (input == null) {
      return;
    }
    input.removeKeyListener(this);
    input = null;
  }

  public void update(GameContainer gc) {
    if (armDelay > 0) {
      syncControllerInputState();
      armDelay--;
      return;
    }
    if (doneDelay > 0 && --doneDelay == 0) {
      finish();
      return;
    }
    bindControllerInputPressed();
  }

  public void render(GameContainer gc, Graphics g) throws SlickException {
    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);
    if (finished) {
      main.drawString(message, centerX(message), MESSAGE_Y);
      return;
    }

    String currentStep = getCurrentStep();
    main.drawString(PROMPT_LINE_1, centerX(PROMPT_LINE_1), PROMPT_LINE_1_Y);
    main.drawString(PROMPT_LINE_2, centerX(PROMPT_LINE_2), PROMPT_LINE_2_Y);
    main.drawString(currentStep, centerX(currentStep), MESSAGE_Y);
    if (message.length() > 0) {
      main.drawString(message, centerX(message), ERROR_Y);
    }
  }

  public void keyPressed(int key, char c) {
    if (ButtonMapping.isReservedKey(key)) {
      return;
    }
    if (blockedKeysUntilRelease.contains(key) || !canAcceptInput()) {
      blockedKeysUntilRelease.add(key);
      return;
    }

    captureEpochUsed = true;
    blockedKeysUntilRelease.add(key);
    if (!bindKey(key)) {
      message = "ALREADY USED";
      return;
    }
    advance();
  }

  public void keyReleased(int key, char c) {
    blockedKeysUntilRelease.remove(key);
  }

  public void setInput(Input input) {
    this.input = input;
  }

  public boolean isAcceptingInput() {
    return true;
  }

  public void inputEnded() {
  }

  public void inputStarted() {
    captureEpochUsed = false;
  }

  private boolean canAcceptInput() {
    return !finished && armDelay == 0 && !captureEpochUsed;
  }

  private void bindControllerInputPressed() {
    if (!canAcceptInput()) {
      syncControllerInputState();
      return;
    }

    ControllerCaptureSample sample = sampleControllerInputState();
    if (awaitingControllerNeutral) {
      if (!sample.anyDown) {
        awaitingControllerNeutral = false;
      }
      return;
    }

    int binding = sample.direction != ButtonMapping.NO_BINDING ? sample.direction : sample.button;
    if (binding == ButtonMapping.NO_BINDING) return;
    if (!bindControllerBinding(binding)) { message = "ALREADY USED"; return; }
    captureEpochUsed = true;
    awaitingControllerNeutral = sample.anyDown;
    advance();
  }

  private ControllerCaptureSample sampleControllerInputState() {
    ControllerCaptureSample sample = new ControllerCaptureSample();

    boolean up = ControllerSupport.isUpDown();
    boolean down = ControllerSupport.isDownDown();
    boolean left = ControllerSupport.isLeftDown();
    boolean right = ControllerSupport.isRightDown();
    boolean upPressed = up && !controllerUpDown;
    boolean downPressed = down && !controllerDownDown;
    boolean leftPressed = left && !controllerLeftDown;
    boolean rightPressed = right && !controllerRightDown;
    controllerUpDown = up;
    controllerDownDown = down;
    controllerLeftDown = left;
    controllerRightDown = right;

    if (upPressed) {
      sample.direction = ButtonMapping.CONTROLLER_DIRECTION_UP;
    } else if (downPressed) {
      sample.direction = ButtonMapping.CONTROLLER_DIRECTION_DOWN;
    } else if (leftPressed) {
      sample.direction = ButtonMapping.CONTROLLER_DIRECTION_LEFT;
    } else if (rightPressed) {
      sample.direction = ButtonMapping.CONTROLLER_DIRECTION_RIGHT;
    }

    boolean anyButtonDown = false;
    for(int button = 0; button < controllerButtonDown.length; button++) {
      boolean buttonDown = ControllerSupport.isButtonDown(button);
      boolean pressed = buttonDown && !controllerButtonDown[button];
      controllerButtonDown[button] = buttonDown;
      anyButtonDown |= buttonDown;
      if (sample.button == ButtonMapping.NO_BINDING
          && pressed
          && ControllerSupport.isNonDirectionalButtonDown(button)) {
        sample.button = button;
      }
    }
    sample.anyDown = up || down || left || right || anyButtonDown;
    return sample;
  }

  private boolean bindKey(int key) {
    return NesInputProfile.assignKey(draft, stepIndex, key, assignedKeys);
  }

  private boolean bindControllerBinding(int button) {
    return NesInputProfile.assignController(draft, stepIndex, button, assignedControllerBindings);
  }

  private ButtonMapping createDraft() {
    return NesInputProfile.copy(main.buttonMapping);
  }

  private void commitDraft() {
    NesInputProfile.copyInto(draft, main.buttonMapping);
  }

  private void advance() {
    main.playSound(main.pressed_enter);
    message = "";
    stepIndex++;
    if (stepIndex == STEPS.length) {
      finished = true;
      message = "SAVED";
      commitDraft();
      main.buttonMapping.save();
      if (main.controlInput != null) {
        main.controlInput.clearPressedState();
      }
      doneDelay = DONE_DELAY;
    }
  }

  private void finish() {
    dispose();
    main.finishInputConfig();
  }

  private String getCurrentStep() {
    return STEPS[stepIndex];
  }

  private int centerX(String text) {
    return (640 - (text.length() << 4)) >> 1;
  }

  private void syncControllerInputState() {

    controllerUpDown = ControllerSupport.isUpDown();
    controllerDownDown = ControllerSupport.isDownDown();
    controllerLeftDown = ControllerSupport.isLeftDown();
    controllerRightDown = ControllerSupport.isRightDown();
    for(int button = 0; button < controllerButtonDown.length; button++) {
      controllerButtonDown[button] = ControllerSupport.isButtonDown(button);
    }
  }
}
