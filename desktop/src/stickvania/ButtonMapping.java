package stickvania;

import java.util.prefs.Preferences;
import org.newdawn.slick.Input;

public class ButtonMapping {

  private static final int VERSION = 7;
  public static final int NO_BINDING = -1;
  public static final int CONTROLLER_DIRECTION_UP = -2;
  public static final int CONTROLLER_DIRECTION_DOWN = -3;
  public static final int CONTROLLER_DIRECTION_LEFT = -4;
  public static final int CONTROLLER_DIRECTION_RIGHT = -5;

  private static final int DEFAULT_KEY_JUMP = Input.KEY_X;
  private static final int DEFAULT_KEY_ATTACK = Input.KEY_Z;
  private static final int DEFAULT_KEY_UP = Input.KEY_UP;
  private static final int DEFAULT_KEY_DOWN = Input.KEY_DOWN;
  private static final int DEFAULT_KEY_LEFT = Input.KEY_LEFT;
  private static final int DEFAULT_KEY_RIGHT = Input.KEY_RIGHT;
  private static final int DEFAULT_CONTROLLER_JUMP = 0;
  private static final int DEFAULT_CONTROLLER_ATTACK = 2;
  private static final int DEFAULT_CONTROLLER_UP = CONTROLLER_DIRECTION_UP;
  private static final int DEFAULT_CONTROLLER_DOWN = CONTROLLER_DIRECTION_DOWN;
  private static final int DEFAULT_CONTROLLER_LEFT = CONTROLLER_DIRECTION_LEFT;
  private static final int DEFAULT_CONTROLLER_RIGHT = CONTROLLER_DIRECTION_RIGHT;

  public int keyJump = DEFAULT_KEY_JUMP;
  public int keyAttack = DEFAULT_KEY_ATTACK;
  public int keyUp = DEFAULT_KEY_UP;
  public int keyDown = DEFAULT_KEY_DOWN;
  public int keyLeft = DEFAULT_KEY_LEFT;
  public int keyRight = DEFAULT_KEY_RIGHT;
  public int controllerJump = DEFAULT_CONTROLLER_JUMP;
  public int controllerAttack = DEFAULT_CONTROLLER_ATTACK;
  public int controllerUp = DEFAULT_CONTROLLER_UP;
  public int controllerDown = DEFAULT_CONTROLLER_DOWN;
  public int controllerLeft = DEFAULT_CONTROLLER_LEFT;
  public int controllerRight = DEFAULT_CONTROLLER_RIGHT;

  public static ButtonMapping load() {
    ButtonMapping mapping = new ButtonMapping();
    try {
      Preferences prefs = Preferences.userNodeForPackage(ButtonMapping.class);
      if (prefs.getInt("inputMappingVersion", 0) != VERSION) {
        return mapping;
      }
      mapping.keyJump = prefs.getInt("keyJump", DEFAULT_KEY_JUMP);
      mapping.keyAttack = prefs.getInt("keyAttack", DEFAULT_KEY_ATTACK);
      mapping.keyUp = prefs.getInt("keyUp", DEFAULT_KEY_UP);
      mapping.keyDown = prefs.getInt("keyDown", DEFAULT_KEY_DOWN);
      mapping.keyLeft = prefs.getInt("keyLeft", DEFAULT_KEY_LEFT);
      mapping.keyRight = prefs.getInt("keyRight", DEFAULT_KEY_RIGHT);
      mapping.controllerJump = prefs.getInt(
          "controllerJump", DEFAULT_CONTROLLER_JUMP);
      mapping.controllerAttack = prefs.getInt(
          "controllerAttack", DEFAULT_CONTROLLER_ATTACK);
      mapping.controllerUp = prefs.getInt(
          "controllerUp", DEFAULT_CONTROLLER_UP);
      mapping.controllerDown = prefs.getInt(
          "controllerDown", DEFAULT_CONTROLLER_DOWN);
      mapping.controllerLeft = prefs.getInt(
          "controllerLeft", DEFAULT_CONTROLLER_LEFT);
      mapping.controllerRight = prefs.getInt(
          "controllerRight", DEFAULT_CONTROLLER_RIGHT);
    } catch(Throwable t) {
    }
    return mapping;
  }

  public void save() {
    try {
      Preferences prefs = Preferences.userNodeForPackage(ButtonMapping.class);
      prefs.putInt("inputMappingVersion", VERSION);
      prefs.putInt("keyJump", keyJump);
      prefs.putInt("keyAttack", keyAttack);
      prefs.putInt("keyUp", keyUp);
      prefs.putInt("keyDown", keyDown);
      prefs.putInt("keyLeft", keyLeft);
      prefs.putInt("keyRight", keyRight);
      prefs.putInt("controllerJump", controllerJump);
      prefs.putInt("controllerAttack", controllerAttack);
      prefs.putInt("controllerUp", controllerUp);
      prefs.putInt("controllerDown", controllerDown);
      prefs.putInt("controllerLeft", controllerLeft);
      prefs.putInt("controllerRight", controllerRight);
      prefs.flush();
    } catch(Throwable t) {
    }
  }

  public void resetToDefaults() {
    keyJump = DEFAULT_KEY_JUMP;
    keyAttack = DEFAULT_KEY_ATTACK;
    keyUp = DEFAULT_KEY_UP;
    keyDown = DEFAULT_KEY_DOWN;
    keyLeft = DEFAULT_KEY_LEFT;
    keyRight = DEFAULT_KEY_RIGHT;
    controllerJump = DEFAULT_CONTROLLER_JUMP;
    controllerAttack = DEFAULT_CONTROLLER_ATTACK;
    controllerUp = DEFAULT_CONTROLLER_UP;
    controllerDown = DEFAULT_CONTROLLER_DOWN;
    controllerLeft = DEFAULT_CONTROLLER_LEFT;
    controllerRight = DEFAULT_CONTROLLER_RIGHT;
  }

  public static boolean isReservedKey(int key) {
    return key == Input.KEY_SPACE || key == Input.KEY_ESCAPE;
  }

  public boolean usesKey(int key) {
    return keyJump == key || keyAttack == key || keyUp == key
        || keyDown == key || keyLeft == key || keyRight == key;
  }

  public boolean usesControllerButton(int button) {
    return controllerJump == button || controllerAttack == button
        || controllerUp == button || controllerDown == button
        || controllerLeft == button || controllerRight == button;
  }

  public String keyboardLabelFor(String action) {
    if ("UP".equals(action)) {
      return getKeyText(keyUp);
    } else if ("DOWN".equals(action)) {
      return getKeyText(keyDown);
    } else if ("LEFT".equals(action)) {
      return getKeyText(keyLeft);
    } else if ("RIGHT".equals(action)) {
      return getKeyText(keyRight);
    } else if ("JUMP".equals(action)) {
      return getKeyText(keyJump);
    } else if ("ATTACK".equals(action)) {
      return getKeyText(keyAttack);
    }
    return "";
  }

  public String controllerLabelFor(String action) {
    if ("UP".equals(action)) {
      return getGamepadButtonText(controllerUp);
    } else if ("DOWN".equals(action)) {
      return getGamepadButtonText(controllerDown);
    } else if ("LEFT".equals(action)) {
      return getGamepadButtonText(controllerLeft);
    } else if ("RIGHT".equals(action)) {
      return getGamepadButtonText(controllerRight);
    } else if ("JUMP".equals(action)) {
      return getGamepadButtonText(controllerJump);
    } else if ("ATTACK".equals(action)) {
      return getGamepadButtonText(controllerAttack);
    }
    return "";
  }

  public static String getKeyText(int key) {
    if (key == NO_BINDING) {
      return "NONE";
    }
    if (key == Input.KEY_RETURN || key == Input.KEY_ENTER) {
      return "ENTER";
    }
    if (key == Input.KEY_LSHIFT || key == Input.KEY_RSHIFT) {
      return "SHIFT";
    }
    if (key == Input.KEY_LCONTROL || key == Input.KEY_RCONTROL) {
      return "CTRL";
    }
    if (key == Input.KEY_LALT || key == Input.KEY_RALT
        || key == Input.KEY_LMENU || key == Input.KEY_RMENU) {
      return "ALT";
    }
    switch(key) {
      case Input.KEY_SPACE:
        return "SPACE";
      case Input.KEY_ESCAPE:
        return "ESCAPE";
      case Input.KEY_UP:
        return "UP";
      case Input.KEY_DOWN:
        return "DOWN";
      case Input.KEY_LEFT:
        return "LEFT";
      case Input.KEY_RIGHT:
        return "RIGHT";
      case Input.KEY_TAB:
        return "TAB";
      case Input.KEY_BACK:
        return "BACK";
      case Input.KEY_DELETE:
        return "DELETE";
      case Input.KEY_HOME:
        return "HOME";
      case Input.KEY_END:
        return "END";
      case Input.KEY_PRIOR:
        return "PAGE UP";
      case Input.KEY_NEXT:
        return "PAGE DOWN";
      default:
        try {
          String keyName = Input.getKeyName(key);
          if (keyName != null && keyName.length() > 0) {
            return sanitizeLabel(keyName);
          }
        } catch(Throwable t) {
        }
        return "KEY " + key;
    }
  }

  public static String getGamepadButtonText(int button) {
    if (button == NO_BINDING) {
      return "GP-NONE";
    }
    if (button == CONTROLLER_DIRECTION_UP) {
      return "GP-UP";
    }
    if (button == CONTROLLER_DIRECTION_DOWN) {
      return "GP-DOWN";
    }
    if (button == CONTROLLER_DIRECTION_LEFT) {
      return "GP-LEFT";
    }
    if (button == CONTROLLER_DIRECTION_RIGHT) {
      return "GP-RIGHT";
    }
    if (button >= 0) {
      return "GP-BUTTON-" + (button + 1);
    }
    return "GP-" + button;
  }

  private static String sanitizeLabel(String label) {
    String upper = label.toUpperCase();
    StringBuilder builder = new StringBuilder();
    for(int i = 0; i < upper.length(); i++) {
      char c = upper.charAt(i);
      if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
          || c == ' ' || c == '-') {
        builder.append(c);
      } else {
        builder.append(' ');
      }
    }
    return builder.toString().trim();
  }
}
