package stickvania;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import org.lwjgl.input.Controller;
import org.lwjgl.input.Controllers;
import org.newdawn.slick.Input;

public final class ControllerSupport {

  public static final int GAMEPAD_BUTTON_INDEX_LIMIT = 64;
  private static final int CONTROLLER_INDEX_LIMIT = 16;
  private static final int GAMEPAD_AXIS_LIMIT = 16;
  private static final int NAMED_X_AXIS_SLOT = GAMEPAD_AXIS_LIMIT;
  private static final int NAMED_Y_AXIS_SLOT = GAMEPAD_AXIS_LIMIT + 1;
  private static final int NAMED_RX_AXIS_SLOT = GAMEPAD_AXIS_LIMIT + 3;
  private static final int NAMED_RY_AXIS_SLOT = GAMEPAD_AXIS_LIMIT + 4;
  private static final float AXIS_THRESHOLD = 0.5f;
  private static final float AXIS_RECENTER_THRESHOLD = 0.05f;
  private static final int STANDARD_DPAD_UP = 12;
  private static final int STANDARD_DPAD_DOWN = 13;
  private static final int STANDARD_DPAD_LEFT = 14;
  private static final int STANDARD_DPAD_RIGHT = 15;
  private static final Object POLL_LOG_FILTER_LOCK = new Object();

  private static boolean jinputReflectionInitialized;
  private static Field jinputAxesField;
  private static Field jinputButtonsField;
  private static Field jinputPovField;
  private static Field jinputXAxisField;
  private static Field jinputYAxisField;
  private static Field jinputRXAxisField;
  private static Field jinputRYAxisField;
  private static boolean globalPollFailureFilterInstalled;
  private static volatile boolean globalPollFailureDetected;
  private static boolean controllersCreateAttempted;
  private static boolean controllersUnavailable;
  private static final boolean[] controllerCandidateKnown =
      new boolean[CONTROLLER_INDEX_LIMIT];
  private static final boolean[] controllerCandidate =
      new boolean[CONTROLLER_INDEX_LIMIT];

  private static boolean initialized;
  private static boolean sampledUp;
  private static boolean sampledDown;
  private static boolean sampledLeft;
  private static boolean sampledRight;
  private static final boolean[] sampledButtons =
      new boolean[GAMEPAD_BUTTON_INDEX_LIMIT];
  private static final boolean[] sampledNonDirectionalButtons =
      new boolean[GAMEPAD_BUTTON_INDEX_LIMIT];

  public static void initialize() {
    if (initialized) {
      return;
    }
    initialized = true;
    prepareDesktopInput();
    // Legacy JInput owns native resources for the lifetime of the process.
    // Discover once; a newly enabled gamepad requires restarting the game.
    ensureControllersCreated();
    beginFrame();
  }

  public static void beginFrame() {
    clearSnapshot();
    pollControllers();
    sampledUp = readControllerUp();
    sampledDown = readControllerDown();
    sampledLeft = readControllerLeft();
    sampledRight = readControllerRight();
    int controllerCount = getControllerCount();
    for(int index = 0; index < controllerCount; index++) {
      Controller controller = getGameController(index);
      if (controller == null) {
        continue;
      }
      int buttonCount = Math.min(safeButtonCount(controller),
          GAMEPAD_BUTTON_INDEX_LIMIT);
      for(int button = 0; button < buttonCount; button++) {
        if (isControllerButtonDown(button, controller)) {
          sampledButtons[button] = true;
          if (!isDirectionalButton(button, controller)) {
            sampledNonDirectionalButtons[button] = true;
          }
        }
      }
    }
    if (isControllerInputUnavailable()) {
      clearSnapshot();
    }
  }

  private static void clearSnapshot() {
    sampledUp = sampledDown = sampledLeft = sampledRight = false;
    Arrays.fill(sampledButtons, false);
    Arrays.fill(sampledNonDirectionalButtons, false);
  }

  private ControllerSupport() {
  }

  public static void prepareDesktopInput() {
    installJInputPollFailureFilter();
    try {
      Input.disableControllers();
    } catch(Throwable t) {
    }
  }

  public static void installJInputPollFailureFilter() {
    synchronized(POLL_LOG_FILTER_LOCK) {
      if (globalPollFailureFilterInstalled) {
        return;
      }
      try {
        System.setOut(new PrintStream(
            new JInputPollFilterStream(System.out), true));
        System.setErr(new PrintStream(
            new JInputPollFilterStream(System.err), true));
        globalPollFailureFilterInstalled = true;
      } catch(SecurityException e) {
      }
    }
  }

  public static boolean isDirectionDown(int direction) {
    switch(direction) {
      case ButtonMapping.CONTROLLER_DIRECTION_UP:
        return isAnyControllerUp();
      case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
        return isAnyControllerDown();
      case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
        return isAnyControllerLeft();
      case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
        return isAnyControllerRight();
      default:
        // Nonnegative mappings are raw physical button indexes. Directional
        // controls are stored with the negative logical direction constants.
        return isButtonDown(direction);
    }
  }

  public static boolean isUpDown() {
    return isAnyControllerUp();
  }

  public static boolean isDownDown() {
    return isAnyControllerDown();
  }

  public static boolean isLeftDown() {
    return isAnyControllerLeft();
  }

  public static boolean isRightDown() {
    return isAnyControllerRight();
  }

  public static boolean isButtonDown(int button) {
    return !isControllerInputUnavailable() && button >= 0
        && button < GAMEPAD_BUTTON_INDEX_LIMIT && sampledButtons[button];
  }

  public static boolean isNonDirectionalButtonDown(int button) {
    return !isControllerInputUnavailable() && button >= 0
        && button < GAMEPAD_BUTTON_INDEX_LIMIT
        && sampledNonDirectionalButtons[button];
  }

  public static boolean isNonDirectionalButtonDown(ButtonMapping mapping) {
    if (isControllerInputUnavailable()) {
      return false;
    }
    for(int button = 0; button < GAMEPAD_BUTTON_INDEX_LIMIT; button++) {
      if (sampledNonDirectionalButtons[button]
          && !isMappedDirectionButton(mapping, button)) {
        return true;
      }
    }
    return false;
  }

  public static boolean isDirectionalButton(int button) {
    if (button < 0 || button >= GAMEPAD_BUTTON_INDEX_LIMIT) {
      return false;
    }
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      Controller lwjglController = getGameController(controller);
      if (lwjglController != null
          && isDirectionalButton(button, lwjglController)) {
        return true;
      }
    }
    return button >= STANDARD_DPAD_UP && button <= STANDARD_DPAD_RIGHT;
  }

  private static boolean isAnyControllerUp() {
    return !isControllerInputUnavailable() && sampledUp;
  }

  private static boolean readControllerUp() {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      Controller lwjglController = getGameController(controller);
      if (lwjglController != null
          && (isPovUp(lwjglController)
          || isDirectionalButtonDown(ButtonMapping.CONTROLLER_DIRECTION_UP,
              lwjglController)
          || isAnyStickUp(controller, lwjglController))) {
        return true;
      }
    }
    return false;
  }

  private static boolean isAnyControllerDown() {
    return !isControllerInputUnavailable() && sampledDown;
  }

  private static boolean readControllerDown() {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      Controller lwjglController = getGameController(controller);
      if (lwjglController != null
          && (isPovDown(lwjglController)
          || isDirectionalButtonDown(ButtonMapping.CONTROLLER_DIRECTION_DOWN,
              lwjglController)
          || isAnyStickDown(controller, lwjglController))) {
        return true;
      }
    }
    return false;
  }

  private static boolean isAnyControllerLeft() {
    return !isControllerInputUnavailable() && sampledLeft;
  }

  private static boolean readControllerLeft() {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      Controller lwjglController = getGameController(controller);
      if (lwjglController != null
          && (isPovLeft(lwjglController)
          || isDirectionalButtonDown(ButtonMapping.CONTROLLER_DIRECTION_LEFT,
              lwjglController)
          || isAnyStickLeft(controller, lwjglController))) {
        return true;
      }
    }
    return false;
  }

  private static boolean isAnyControllerRight() {
    return !isControllerInputUnavailable() && sampledRight;
  }

  private static boolean readControllerRight() {
    int controllerCount = getControllerCount();
    for(int controller = 0; controller < controllerCount; controller++) {
      Controller lwjglController = getGameController(controller);
      if (lwjglController != null
          && (isPovRight(lwjglController)
          || isDirectionalButtonDown(ButtonMapping.CONTROLLER_DIRECTION_RIGHT,
              lwjglController)
          || isAnyStickRight(controller, lwjglController))) {
        return true;
      }
    }
    return false;
  }

  private static boolean isPovUp(Controller controller) {
    return readPovY(controller) < -AXIS_THRESHOLD;
  }

  private static boolean isPovDown(Controller controller) {
    return readPovY(controller) > AXIS_THRESHOLD;
  }

  private static boolean isPovLeft(Controller controller) {
    return readPovX(controller) < -AXIS_THRESHOLD;
  }

  private static boolean isPovRight(Controller controller) {
    return readPovX(controller) > AXIS_THRESHOLD;
  }

  private static boolean isAnyStickUp(int controllerIndex,
      Controller controller) {
    return isAnyStickAxisLessThan(controllerIndex, controller, 1,
        -AXIS_THRESHOLD);
  }

  private static boolean isAnyStickDown(int controllerIndex,
      Controller controller) {
    return isAnyStickAxisGreaterThan(controllerIndex, controller, 1,
        AXIS_THRESHOLD);
  }

  private static boolean isAnyStickLeft(int controllerIndex,
      Controller controller) {
    return isAnyStickAxisLessThan(controllerIndex, controller, 0,
        -AXIS_THRESHOLD);
  }

  private static boolean isAnyStickRight(int controllerIndex,
      Controller controller) {
    return isAnyStickAxisGreaterThan(controllerIndex, controller, 0,
        AXIS_THRESHOLD);
  }

  private static boolean isAnyStickAxisLessThan(int controllerIndex,
      Controller controller, int pairOffset, float threshold) {
    if (isAnyNamedStickAxisLessThan(controllerIndex, controller, pairOffset,
        threshold)) {
      return true;
    }
    int axisCount = Math.min(safeAxisCount(controller), GAMEPAD_AXIS_LIMIT);
    for(int axis = 0; axis < axisCount; axis++) {
      if (isDirectionalAxis(controller, axis, pairOffset)
          && readAxisValue(controllerIndex, controller, axis) <= threshold) {
        return true;
      }
    }
    return false;
  }

  private static boolean isAnyStickAxisGreaterThan(int controllerIndex,
      Controller controller, int pairOffset, float threshold) {
    if (isAnyNamedStickAxisGreaterThan(controllerIndex, controller,
        pairOffset, threshold)) {
      return true;
    }
    int axisCount = Math.min(safeAxisCount(controller), GAMEPAD_AXIS_LIMIT);
    for(int axis = 0; axis < axisCount; axis++) {
      if (isDirectionalAxis(controller, axis, pairOffset)
          && readAxisValue(controllerIndex, controller, axis) >= threshold) {
        return true;
      }
    }
    return false;
  }

  private static boolean isAnyNamedStickAxisLessThan(int controllerIndex,
      Controller controller, int pairOffset, float threshold) {
    return readNamedStickAxisValue(controllerIndex, controller,
        NAMED_X_AXIS_SLOT, NAMED_Y_AXIS_SLOT, pairOffset) <= threshold
        || readNamedStickAxisValue(controllerIndex, controller,
        NAMED_RX_AXIS_SLOT, NAMED_RY_AXIS_SLOT, pairOffset) <= threshold;
  }

  private static boolean isAnyNamedStickAxisGreaterThan(int controllerIndex,
      Controller controller, int pairOffset, float threshold) {
    return readNamedStickAxisValue(controllerIndex, controller,
        NAMED_X_AXIS_SLOT, NAMED_Y_AXIS_SLOT, pairOffset) >= threshold
        || readNamedStickAxisValue(controllerIndex, controller,
        NAMED_RX_AXIS_SLOT, NAMED_RY_AXIS_SLOT, pairOffset) >= threshold;
  }

  private static float readNamedStickAxisValue(int controllerIndex,
      Controller controller, int horizontalSlot, int verticalSlot,
      int pairOffset) {
    int axisSlot = pairOffset == 0 ? horizontalSlot : verticalSlot;
    return readNamedAxisValue(controllerIndex, controller, axisSlot);
  }

  private static float readNamedAxisValue(int controllerIndex,
      Controller controller, int axisSlot) {
    try {
      int axis = getJInputNamedAxisIndex(controller, axisSlot);
      if (axis >= 0) {
        int pairOffset = getNamedAxisPairOffset(axisSlot);
        if (pairOffset >= 0
            && !isDirectionalAxis(controller, axis, pairOffset)) {
          return 0f;
        }
        return readAxisValue(controllerIndex, controller, axis);
      }

      float value;
      switch(axisSlot) {
        case NAMED_X_AXIS_SLOT:
          value = controller.getXAxisValue();
          break;
        case NAMED_Y_AXIS_SLOT:
          value = controller.getYAxisValue();
          break;
        case NAMED_RX_AXIS_SLOT:
          value = controller.getRXAxisValue();
          break;
        case NAMED_RY_AXIS_SLOT:
          value = controller.getRYAxisValue();
          break;
        default:
          return 0f;
      }
      return applyAxisDeadZone(value);
    } catch(RuntimeException e) {
      return 0f;
    }
  }

  private static int getNamedAxisPairOffset(int axisSlot) {
    switch(axisSlot) {
      case NAMED_X_AXIS_SLOT:
      case NAMED_RX_AXIS_SLOT:
        return 0;
      case NAMED_Y_AXIS_SLOT:
      case NAMED_RY_AXIS_SLOT:
        return 1;
      default:
        return -1;
    }
  }

  private static float readPovX(Controller controller) {
    try {
      float value = readJInputPovValue(controller);
      if (!Float.isNaN(value)) {
        return convertPovX(value);
      }
      return controller.getPovX();
    } catch(RuntimeException e) {
      return 0f;
    }
  }

  private static float readPovY(Controller controller) {
    try {
      float value = readJInputPovValue(controller);
      if (!Float.isNaN(value)) {
        return convertPovY(value);
      }
      return controller.getPovY();
    } catch(RuntimeException e) {
      return 0f;
    }
  }

  private static float readAxisValue(
      int controllerIndex, Controller controller, int axis) {
    try {
      if (axis < 0 || axis >= controller.getAxisCount()
          || axis >= GAMEPAD_AXIS_LIMIT) {
        return 0f;
      }

      float directValue = readJInputAxisValue(controller, axis);
      if (!Float.isNaN(directValue)) {
        return directValue;
      }
      return applyAxisDeadZone(controller.getAxisValue(axis));
    } catch(RuntimeException e) {
      return 0f;
    }
  }

  private static int getJInputNamedAxisIndex(Controller controller,
      int axisSlot) {
    initJInputReflection(controller);
    Field field = null;
    switch(axisSlot) {
      case NAMED_X_AXIS_SLOT:
        field = jinputXAxisField;
        break;
      case NAMED_Y_AXIS_SLOT:
        field = jinputYAxisField;
        break;
      case NAMED_RX_AXIS_SLOT:
        field = jinputRXAxisField;
        break;
      case NAMED_RY_AXIS_SLOT:
        field = jinputRYAxisField;
        break;
      default:
        return -1;
    }
    if (field == null) {
      return -1;
    }
    try {
      return field.getInt(controller);
    } catch(IllegalAccessException e) {
      return -1;
    }
  }

  private static float readJInputAxisValue(Controller controller, int axis) {
    initJInputReflection(controller);
    net.java.games.input.Component component =
        getJInputComponent(controller, jinputAxesField, axis);
    if (component == null) {
      return Float.NaN;
    }

    float value = readJInputComponentPollData(component);
    if (Float.isNaN(value)) {
      return Float.NaN;
    }

    float deadZone = Math.max(component.getDeadZone(),
        AXIS_RECENTER_THRESHOLD);
    if (Math.abs(value) <= deadZone) {
      return 0f;
    }
    return value;
  }

  private static float readJInputPovValue(Controller controller) {
    initJInputReflection(controller);
    net.java.games.input.Component component =
        getJInputComponent(controller, jinputPovField, 0);
    if (component == null) {
      return Float.NaN;
    }
    return readJInputComponentPollData(component);
  }

  private static float readJInputButtonValue(Controller controller, int button) {
    initJInputReflection(controller);
    net.java.games.input.Component component =
        getJInputComponent(controller, jinputButtonsField, button);
    if (component == null) {
      return Float.NaN;
    }
    return readJInputComponentPollData(component);
  }

  private static float readJInputComponentPollData(
      net.java.games.input.Component component) {
    try {
      float value = component.getPollData();
      return isControllerInputUnavailable() ? Float.NaN : value;
    } catch(RuntimeException e) {
      controllersUnavailable = true;
      return Float.NaN;
    }
  }

  private static net.java.games.input.Component getJInputComponent(
      Controller controller, Field field, int index) {
    List<?> components = getJInputComponentList(controller, field);
    if (components == null || index < 0 || index >= components.size()) {
      return null;
    }

    Object component = components.get(index);
    if (component instanceof net.java.games.input.Component) {
      return (net.java.games.input.Component)component;
    }
    return null;
  }

  private static List<?> getJInputComponentList(Controller controller,
      Field field) {
    if (field == null) {
      return null;
    }

    try {
      Object value = field.get(controller);
      if (!(value instanceof List)) {
        return null;
      }
      return (List<?>)value;
    } catch(IllegalAccessException e) {
      return null;
    }
  }

  private static float convertPovX(float value) {
    if (isPovValue(value, 0.875f)
        || isPovValue(value, 0.125f)
        || isPovValue(value, 1f)) {
      return -1f;
    }
    if (isPovValue(value, 0.625f)
        || isPovValue(value, 0.375f)
        || isPovValue(value, 0.5f)) {
      return 1f;
    }
    return 0f;
  }

  private static float convertPovY(float value) {
    if (isPovValue(value, 0.875f)
        || isPovValue(value, 0.625f)
        || isPovValue(value, 0.75f)) {
      return 1f;
    }
    if (isPovValue(value, 0.125f)
        || isPovValue(value, 0.375f)
        || isPovValue(value, 0.25f)) {
      return -1f;
    }
    return 0f;
  }

  private static boolean isPovValue(float value, float target) {
    return Math.abs(value - target) < 0.001f;
  }

  private static void initJInputReflection(Controller controller) {
    if (jinputReflectionInitialized) {
      return;
    }

    synchronized(ControllerSupport.class) {
      if (jinputReflectionInitialized) {
        return;
      }
      try {
        Class<?> controllerClass = controller.getClass();
        jinputAxesField = getAccessibleField(controllerClass, "axes");
        jinputButtonsField = getAccessibleField(controllerClass, "buttons");
        jinputPovField = getAccessibleField(controllerClass, "pov");
        jinputXAxisField = getAccessibleField(controllerClass, "xaxis");
        jinputYAxisField = getAccessibleField(controllerClass, "yaxis");
        jinputRXAxisField = getAccessibleField(controllerClass, "rxaxis");
        jinputRYAxisField = getAccessibleField(controllerClass, "ryaxis");
      } catch(NoSuchFieldException e) {
        jinputAxesField = null;
        jinputButtonsField = null;
        jinputPovField = null;
        jinputXAxisField = null;
        jinputYAxisField = null;
        jinputRXAxisField = null;
        jinputRYAxisField = null;
      }
      jinputReflectionInitialized = true;
    }
  }

  private static Field getAccessibleField(Class<?> clazz, String name)
      throws NoSuchFieldException {
    Field field = clazz.getDeclaredField(name);
    field.setAccessible(true);
    return field;
  }

  private static float applyAxisDeadZone(float value) {
    if (Math.abs(value) <= AXIS_RECENTER_THRESHOLD) {
      return 0f;
    }
    return value;
  }

  private static boolean isDirectionalAxis(Controller controller, int axis,
      int pairOffset) {
    if (axis < 0 || axis >= safeAxisCount(controller)
        || axis >= GAMEPAD_AXIS_LIMIT) {
      return false;
    }

    String name = safeAxisName(controller, axis).toLowerCase();
    String identifier = getJInputAxisIdentifierName(controller, axis);
    if (isRejectedDirectionalAxisName(name)
        || isRejectedDirectionalAxisName(identifier)) {
      return false;
    }
    if (pairOffset == 0) {
      return isHorizontalAxisName(name)
          || isHorizontalAxisName(identifier);
    }
    return isVerticalAxisName(name)
        || isVerticalAxisName(identifier);
  }

  private static String getJInputAxisIdentifierName(Controller controller,
      int axis) {
    initJInputReflection(controller);
    net.java.games.input.Component component =
        getJInputComponent(controller, jinputAxesField, axis);
    if (component == null || component.getIdentifier() == null) {
      return "";
    }
    return component.getIdentifier().toString().toLowerCase();
  }

  private static boolean isRejectedDirectionalAxisName(String text) {
    return text.indexOf("accelerator") != -1
        || text.indexOf("accel") != -1
        || text.indexOf("brake") != -1
        || text.indexOf("trigger") != -1
        || text.indexOf("throttle") != -1
        || text.indexOf("slider") != -1
        || text.indexOf("volume") != -1;
  }

  private static boolean isHorizontalAxisName(String text) {
    return containsDirectionWord(text, "x")
        || containsDirectionWord(text, "rx");
  }

  private static boolean isVerticalAxisName(String text) {
    return containsDirectionWord(text, "y")
        || containsDirectionWord(text, "ry");
  }

  private static boolean isControllerButtonDown(int button,
      Controller controller) {
    if (button < 0 || button >= safeButtonCount(controller)
        || button >= GAMEPAD_BUTTON_INDEX_LIMIT) {
      return false;
    }
    try {
      float directValue = readJInputButtonValue(controller, button);
      if (!Float.isNaN(directValue)) {
        return directValue != 0f;
      }
      return controller.isButtonPressed(button);
    } catch(RuntimeException e) {
      return false;
    }
  }

  private static boolean isDirectionalButtonDown(int direction,
      Controller controller) {
    int buttonCount = Math.min(safeButtonCount(controller),
        GAMEPAD_BUTTON_INDEX_LIMIT);
    for(int button = 0; button < buttonCount; button++) {
      if (isDirectionalButton(button, controller, direction)
          && isControllerButtonDown(button, controller)) {
        return true;
      }
    }
    return false;
  }

  private static boolean isDirectionalButton(int button,
      Controller controller) {
    if (getButtonDirection(button, controller) != ButtonMapping.NO_BINDING) {
      return true;
    }
    return button >= STANDARD_DPAD_UP && button <= STANDARD_DPAD_RIGHT;
  }

  private static boolean isDirectionalButton(int button,
      Controller controller, int direction) {
    int namedDirection = getButtonDirection(button, controller);
    if (namedDirection != ButtonMapping.NO_BINDING) {
      return namedDirection == direction;
    }

    switch(direction) {
      case ButtonMapping.CONTROLLER_DIRECTION_UP:
        return button == STANDARD_DPAD_UP;
      case ButtonMapping.CONTROLLER_DIRECTION_DOWN:
        return button == STANDARD_DPAD_DOWN;
      case ButtonMapping.CONTROLLER_DIRECTION_LEFT:
        return button == STANDARD_DPAD_LEFT;
      case ButtonMapping.CONTROLLER_DIRECTION_RIGHT:
        return button == STANDARD_DPAD_RIGHT;
      default:
        return false;
    }
  }

  private static int getButtonDirection(int button, Controller controller) {
    try {
      String name = controller.getButtonName(button);
      if (name == null) {
        return ButtonMapping.NO_BINDING;
      }
      return getDirectionFromButtonName(name);
    } catch(RuntimeException e) {
      return ButtonMapping.NO_BINDING;
    }
  }

  private static int getDirectionFromButtonName(String name) {
    String lower = name.toLowerCase();
    boolean directionalGroup = lower.indexOf("pov") != -1
        || lower.indexOf("hat") != -1
        || lower.indexOf("d-pad") != -1
        || lower.indexOf("dpad") != -1
        || lower.indexOf("direction") != -1
        || lower.indexOf("dir") != -1;

    if (containsDirectionWord(lower, "up")
        || containsDirectionWord(lower, "north")) {
      return ButtonMapping.CONTROLLER_DIRECTION_UP;
    }
    if (containsDirectionWord(lower, "down")
        || containsDirectionWord(lower, "south")) {
      return ButtonMapping.CONTROLLER_DIRECTION_DOWN;
    }
    if (containsDirectionWord(lower, "left")
        || containsDirectionWord(lower, "west")) {
      return ButtonMapping.CONTROLLER_DIRECTION_LEFT;
    }
    if (containsDirectionWord(lower, "right")
        || containsDirectionWord(lower, "east")) {
      return ButtonMapping.CONTROLLER_DIRECTION_RIGHT;
    }

    if (directionalGroup && (lower.indexOf("y-") != -1
        || lower.indexOf("-y") != -1)) {
      return ButtonMapping.CONTROLLER_DIRECTION_UP;
    }
    if (directionalGroup && (lower.indexOf("y+") != -1
        || lower.indexOf("+y") != -1)) {
      return ButtonMapping.CONTROLLER_DIRECTION_DOWN;
    }
    if (directionalGroup && (lower.indexOf("x-") != -1
        || lower.indexOf("-x") != -1)) {
      return ButtonMapping.CONTROLLER_DIRECTION_LEFT;
    }
    if (directionalGroup && (lower.indexOf("x+") != -1
        || lower.indexOf("+x") != -1)) {
      return ButtonMapping.CONTROLLER_DIRECTION_RIGHT;
    }
    return ButtonMapping.NO_BINDING;
  }

  private static boolean containsDirectionWord(String text, String word) {
    int index = text.indexOf(word);
    while(index != -1) {
      boolean before = index == 0 || !isAsciiLetterOrDigit(
          text.charAt(index - 1));
      int end = index + word.length();
      boolean after = end == text.length()
          || !isAsciiLetterOrDigit(text.charAt(end));
      if (before && after) {
        return true;
      }
      index = text.indexOf(word, index + 1);
    }
    return false;
  }

  private static boolean isAsciiLetterOrDigit(char c) {
    return (c >= 'a' && c <= 'z')
        || (c >= '0' && c <= '9');
  }

  private static boolean isMappedDirectionButton(ButtonMapping mapping,
      int button) {
    return mapping.controllerUp == button
        || mapping.controllerDown == button
        || mapping.controllerLeft == button
        || mapping.controllerRight == button;
  }

  private static Controller getGameController(int controllerIndex) {
    if (!isGameController(controllerIndex)) {
      return null;
    }
    return getLwjglController(controllerIndex);
  }

  private static boolean isGameController(int controllerIndex) {
    if (controllerIndex < 0 || controllerIndex >= CONTROLLER_INDEX_LIMIT) {
      return false;
    }
    if (!controllerCandidateKnown[controllerIndex]) {
      controllerCandidateKnown[controllerIndex] = true;
      controllerCandidate[controllerIndex] =
          computeGameController(controllerIndex);
    }
    return controllerCandidate[controllerIndex];
  }

  private static boolean computeGameController(int controllerIndex) {
    Controller controller = getLwjglController(controllerIndex);
    if (controller == null || isIgnoredController(controller)) {
      return false;
    }
    try {
      return controller.getAxisCount() >= 2 || controller.getButtonCount() > 0;
    } catch(RuntimeException e) {
      return false;
    }
  }

  private static int safeButtonCount(Controller controller) {
    try {
      return controller.getButtonCount();
    } catch(RuntimeException e) {
      return 0;
    }
  }

  private static int safeAxisCount(Controller controller) {
    try {
      return controller.getAxisCount();
    } catch(RuntimeException e) {
      return 0;
    }
  }

  private static String safeButtonName(Controller controller, int button) {
    try {
      return safeString(controller.getButtonName(button));
    } catch(RuntimeException e) {
      return "<error " + e.getClass().getName() + ">";
    }
  }

  private static String safeAxisName(Controller controller, int axis) {
    try {
      return safeString(controller.getAxisName(axis));
    } catch(RuntimeException e) {
      return "<error " + e.getClass().getName() + ">";
    }
  }

  private static String safeString(String text) {
    return text == null ? "<null>" : text.replace('\n', ' ');
  }

  private static Controller getLwjglController(int controllerIndex) {
    try {
      if (isControllerInputUnavailable()) {
        return null;
      }
      if (!Controllers.isCreated()
          || controllerIndex >= Controllers.getControllerCount()) {
        return null;
      }
      return Controllers.getController(controllerIndex);
    } catch(RuntimeException e) {
      return null;
    }
  }

  private static boolean isNonGameControllerName(String name) {
    if (name == null) {
      return false;
    }
    String lower = name.toLowerCase();
    return lower.indexOf("keyboard") != -1
        || lower.indexOf("mouse") != -1
        || lower.indexOf("consumer control") != -1
        || lower.indexOf("system controller") != -1;
  }

  private static boolean isIgnoredController(Controller controller) {
    return controller == null
        || isNonGameControllerName(controller.getName())
        || isVolumeOnlyController(controller);
  }

  private static boolean isVolumeOnlyController(Controller controller) {
    int buttonCount = Math.min(safeButtonCount(controller),
        GAMEPAD_BUTTON_INDEX_LIMIT);
    if (buttonCount == 0) {
      return false;
    }

    for(int button = 0; button < buttonCount; button++) {
      if (!isVolumeControlButtonName(safeButtonName(controller, button))) {
        return false;
      }
    }
    return true;
  }

  private static boolean isVolumeControlButtonName(String name) {
    String lower = name.toLowerCase();
    return lower.indexOf("volume") != -1
        || lower.indexOf("mute") != -1
        || lower.indexOf("media") != -1;
  }

  private static int getControllerCount() {
    try {
      if (isControllerInputUnavailable()) {
        return 0;
      }
      if (isControllerInputUnavailable() || !Controllers.isCreated()) {
        return 0;
      }
      return Math.min(Controllers.getControllerCount(),
          CONTROLLER_INDEX_LIMIT);
    } catch(RuntimeException e) {
      return 0;
    }
  }

  private static boolean isControllerInputUnavailable() {
    return controllersUnavailable || globalPollFailureDetected;
  }

  private static void ensureControllersCreated() {
    if (isControllerInputUnavailable()
        || Controllers.isCreated() || controllersCreateAttempted) {
      return;
    }
    controllersCreateAttempted = true;
    try {
      Controllers.create();
    } catch(Exception e) {
      controllersUnavailable = true;
    } catch(LinkageError e) {
      controllersUnavailable = true;
    }
  }

  private static void pollControllers() {
    if (isControllerInputUnavailable() || !Controllers.isCreated()) {
      return;
    }
    try {
      Controllers.poll();
      // This input layer reads state, not LWJGL's queued controller events.
      Controllers.clearEvents();
    } catch(Exception e) {
      controllersUnavailable = true;
    } catch(LinkageError e) {
      controllersUnavailable = true;
    }
  }

  private static class JInputPollFilterStream extends OutputStream {

    private final PrintStream target;
    private final ByteArrayOutputStream lineBuffer =
        new ByteArrayOutputStream();

    JInputPollFilterStream(PrintStream target) {
      this.target = target;
    }

    public synchronized void write(int value) throws IOException {
      lineBuffer.write(value);
      if (value == '\n') {
        flushBufferedLine();
      }
    }

    public synchronized void write(byte[] buffer, int offset, int length)
        throws IOException {
      for(int i = 0; i < length; i++) {
        write(buffer[offset + i]);
      }
    }

    public synchronized void flush() throws IOException {
      flushBufferedLine();
      target.flush();
    }

    private void flushBufferedLine() {
      if (lineBuffer.size() == 0) {
        return;
      }

      String line = lineBuffer.toString();
      lineBuffer.reset();
      if (!isSuppressedJInputPollLine(line)) {
        target.print(line);
      }
    }

    private boolean isSuppressedJInputPollLine(String line) {
      String text = line.trim();
      if ("Loading: net.java.games.input.DirectAndRawInputEnvironmentPlugin"
          .equals(text)) {
        return true;
      }
      boolean pollFailure = text.startsWith("Failed to poll device:")
          || (text.startsWith("Failed to poll component:")
          && (text.indexOf("Failed to poll device") != -1
          || text.indexOf("Failed to get device state") != -1));
      if (pollFailure) {
        globalPollFailureDetected = true;
      }
      return pollFailure;
    }

  }
}
