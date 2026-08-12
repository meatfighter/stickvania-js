package stickvania;

import java.util.HashSet;
import java.util.Set;
import org.newdawn.slick.Color;
import org.newdawn.slick.ControllerListener;
import org.newdawn.slick.GameContainer;
import org.newdawn.slick.Graphics;
import org.newdawn.slick.Input;
import org.newdawn.slick.KeyListener;
import org.newdawn.slick.SlickException;

public class InputConfigMode implements ControllerListener, KeyListener {

  private static final String[] STEPS = {
      "UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK" };
  private static final int DONE_DELAY = 30;
  private static final int ARM_DELAY = 8;
  private static final int MESSAGE_Y = 232;
  private static final int ERROR_Y = 280;

  private final Main main;
  private final Set<Integer> assignedKeys = new HashSet<Integer>();
  private final Set<Integer> assignedControllerButtons = new HashSet<Integer>();
  private Input input;
  private int stepIndex;
  private int doneDelay;
  private int armDelay = ARM_DELAY;
  private String message = "";
  private boolean finished;
  private MappingDraft draft;

  private static final class MappingDraft {
    int keyJump;
    int keyAttack;
    int keyUp;
    int keyDown;
    int keyLeft;
    int keyRight;
    int controllerJump;
    int controllerAttack;
    int controllerUp;
    int controllerDown;
    int controllerLeft;
    int controllerRight;
  }

  public InputConfigMode(Main main) {
    this.main = main;
  }

  public void init(GameContainer gc) {
    input = gc.getInput();
    input.addKeyListener(this);
    input.addControllerListener(this);
    draft = createDraft();
    assignedKeys.clear();
    assignedControllerButtons.clear();
    main.clearInputPressedRecords();
  }

  public void dispose() {
    if (input == null) {
      return;
    }
    input.removeKeyListener(this);
    input.removeControllerListener(this);
    input = null;
  }

  public void update(GameContainer gc) {
    if (armDelay > 0) {
      armDelay--;
      return;
    }
    if (doneDelay > 0 && --doneDelay == 0) {
      finish();
    }
  }

  public void render(GameContainer gc, Graphics g) throws SlickException {
    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);
    if (finished) {
      main.drawString(message, centerX(message), MESSAGE_Y);
      return;
    }

    String prompt = "PRESS " + getCurrentStep();
    main.drawString(prompt, centerX(prompt), MESSAGE_Y);
    if (message.length() > 0) {
      main.drawString(message, centerX(message), ERROR_Y);
    }
  }

  public void keyPressed(int key, char c) {
    if (!canAcceptInput() || ButtonMapping.isReservedKey(key)) {
      return;
    }
    if (!bindKey(key)) {
      message = "ALREADY USED";
      return;
    }
    advance();
  }

  public void keyReleased(int key, char c) {
  }

  public void controllerButtonPressed(int controller, int button) {
    if (!canAcceptInput()) {
      return;
    }
    int buttonIndex = button - 1;
    if (buttonIndex < 0
        || (isActionStep() && isDirectionalGamepadButton(buttonIndex))) {
      return;
    }
    if (!bindControllerButton(buttonIndex)) {
      message = "ALREADY USED";
      return;
    }
    advance();
  }

  public void controllerButtonReleased(int controller, int button) {
  }

  public void controllerLeftPressed(int controller) {
    bindControllerDirection(14);
  }

  public void controllerLeftReleased(int controller) {
  }

  public void controllerRightPressed(int controller) {
    bindControllerDirection(15);
  }

  public void controllerRightReleased(int controller) {
  }

  public void controllerUpPressed(int controller) {
    bindControllerDirection(12);
  }

  public void controllerUpReleased(int controller) {
  }

  public void controllerDownPressed(int controller) {
    bindControllerDirection(13);
  }

  public void controllerDownReleased(int controller) {
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
  }

  private boolean canAcceptInput() {
    return !finished && armDelay == 0;
  }

  private void bindControllerDirection(int button) {
    if (!canAcceptInput() || isActionStep()) {
      return;
    }
    if (!bindControllerButton(button)) {
      message = "ALREADY USED";
      return;
    }
    advance();
  }

  private boolean bindKey(int key) {
    if (assignedKeys.contains(key)) {
      return false;
    }
    clearDraftKey(key);
    String step = getCurrentStep();
    if ("UP".equals(step)) {
      draft.keyUp = key;
    } else if ("DOWN".equals(step)) {
      draft.keyDown = key;
    } else if ("LEFT".equals(step)) {
      draft.keyLeft = key;
    } else if ("RIGHT".equals(step)) {
      draft.keyRight = key;
    } else if ("JUMP".equals(step)) {
      draft.keyJump = key;
    } else if ("ATTACK".equals(step)) {
      draft.keyAttack = key;
    }
    assignedKeys.add(key);
    return true;
  }

  private boolean bindControllerButton(int button) {
    if (assignedControllerButtons.contains(button)) {
      return false;
    }
    clearDraftControllerButton(button);
    String step = getCurrentStep();
    if ("UP".equals(step)) {
      draft.controllerUp = button;
    } else if ("DOWN".equals(step)) {
      draft.controllerDown = button;
    } else if ("LEFT".equals(step)) {
      draft.controllerLeft = button;
    } else if ("RIGHT".equals(step)) {
      draft.controllerRight = button;
    } else if ("JUMP".equals(step)) {
      draft.controllerJump = button;
    } else if ("ATTACK".equals(step)) {
      draft.controllerAttack = button;
    }
    assignedControllerButtons.add(button);
    return true;
  }

  private MappingDraft createDraft() {
    ButtonMapping mapping = main.buttonMapping;
    MappingDraft draft = new MappingDraft();
    draft.keyJump = mapping.keyJump;
    draft.keyAttack = mapping.keyAttack;
    draft.keyUp = mapping.keyUp;
    draft.keyDown = mapping.keyDown;
    draft.keyLeft = mapping.keyLeft;
    draft.keyRight = mapping.keyRight;
    draft.controllerJump = mapping.controllerJump;
    draft.controllerAttack = mapping.controllerAttack;
    draft.controllerUp = mapping.controllerUp;
    draft.controllerDown = mapping.controllerDown;
    draft.controllerLeft = mapping.controllerLeft;
    draft.controllerRight = mapping.controllerRight;
    return draft;
  }

  private void clearDraftKey(int key) {
    if (draft.keyJump == key) {
      draft.keyJump = ButtonMapping.NO_BINDING;
    }
    if (draft.keyAttack == key) {
      draft.keyAttack = ButtonMapping.NO_BINDING;
    }
    if (draft.keyUp == key) {
      draft.keyUp = ButtonMapping.NO_BINDING;
    }
    if (draft.keyDown == key) {
      draft.keyDown = ButtonMapping.NO_BINDING;
    }
    if (draft.keyLeft == key) {
      draft.keyLeft = ButtonMapping.NO_BINDING;
    }
    if (draft.keyRight == key) {
      draft.keyRight = ButtonMapping.NO_BINDING;
    }
  }

  private void clearDraftControllerButton(int button) {
    if (draft.controllerJump == button) {
      draft.controllerJump = ButtonMapping.NO_BINDING;
    }
    if (draft.controllerAttack == button) {
      draft.controllerAttack = ButtonMapping.NO_BINDING;
    }
    if (draft.controllerUp == button) {
      draft.controllerUp = ButtonMapping.NO_BINDING;
    }
    if (draft.controllerDown == button) {
      draft.controllerDown = ButtonMapping.NO_BINDING;
    }
    if (draft.controllerLeft == button) {
      draft.controllerLeft = ButtonMapping.NO_BINDING;
    }
    if (draft.controllerRight == button) {
      draft.controllerRight = ButtonMapping.NO_BINDING;
    }
  }

  private void commitDraft() {
    ButtonMapping mapping = main.buttonMapping;
    mapping.keyJump = draft.keyJump;
    mapping.keyAttack = draft.keyAttack;
    mapping.keyUp = draft.keyUp;
    mapping.keyDown = draft.keyDown;
    mapping.keyLeft = draft.keyLeft;
    mapping.keyRight = draft.keyRight;
    mapping.controllerJump = draft.controllerJump;
    mapping.controllerAttack = draft.controllerAttack;
    mapping.controllerUp = draft.controllerUp;
    mapping.controllerDown = draft.controllerDown;
    mapping.controllerLeft = draft.controllerLeft;
    mapping.controllerRight = draft.controllerRight;
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

  private boolean isActionStep() {
    String step = getCurrentStep();
    return "JUMP".equals(step) || "ATTACK".equals(step);
  }

  private int centerX(String text) {
    return (640 - (text.length() << 4)) >> 1;
  }

  private static boolean isDirectionalGamepadButton(int button) {
    return button >= 12 && button <= 15;
  }
}
