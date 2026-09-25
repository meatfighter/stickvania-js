package stickvania;

import java.lang.reflect.Field;
import java.util.List;
import net.java.games.input.Component;
import net.java.games.input.Controller;
import net.java.games.input.ControllerEnvironment;
import net.java.games.input.EventQueue;
import net.java.games.input.Rumbler;
import org.lwjgl.input.Controllers;
import org.newdawn.slick.Input;

/** Headless regressions using the shipped LWJGL/JInput adapters and fake devices. */
public final class ControllerSupportTest {
  public static void main(String[] args) throws Throwable {
    String scenario = args[0];
    Pad pad = new Pad();
    if (scenario.equals("named-ordinary-buttons")) {
      String[] names = {"Left Trigger", "Right Thumb", "Extra Fire", "Right Bumper"};
      for (int i=0;i<4;i++) pad.buttons[12+i].name=names[i];
    }
    if (scenario.equals("named-direction-buttons")) {
      pad.buttons[12].name="Hat Down"; pad.buttons[3].name="POV West";
    }
    Environment environment = new Environment(
        scenario.equals("empty") ? new Controller[0] : new Controller[] {pad});
    environment.fail = scenario.equals("initialization-failure");
    Field defaultEnvironment = ControllerEnvironment.class
        .getDeclaredField("defaultEnvironment");
    defaultEnvironment.setAccessible(true);
    defaultEnvironment.set(null, environment);
    ButtonMapping mapping = new ButtonMapping();
    ControllerSupport.initialize();
    if (scenario.endsWith("-buttons") || scenario.equals("pov-only")) {
      verifyLayout(pad, scenario);
      check(environment.enumerations == 1, "Layout discovery stays startup-only");
      System.out.println("ok - native layout " + scenario); return;
    }
    if (scenario.equals("empty")) {
      environment.controllers = new Controller[] {pad};
    }
    if (scenario.equals("empty") || environment.fail) {
      for (int i = 0; i < 2000; i++) {
        ControllerSupport.beginFrame();
        ControllerSupport.initialize();
    if (scenario.endsWith("-buttons") || scenario.equals("pov-only")) {
      verifyLayout(pad, scenario);
      check(environment.enumerations == 1, "Layout discovery stays startup-only");
      System.out.println("ok - native layout " + scenario); return;
    }
        check(!ControllerSupport.isUpDown(), "No stale direction without a pad");
        check(!ControllerSupport.isButtonDown(0), "No stale button without a pad");
      }
    } else {
      pad.x.value = -1;
      pad.button.value = 1;
      ControllerSupport.beginFrame();
      check(ControllerSupport.isLeftDown(), "Stick direction");
      check(ControllerSupport.isButtonDown(0), "Action button");
      check(ControllerSupport.isDirectionalButton(12),
          "An anonymous native button 12 uses legacy D-pad compatibility");
      pad.button.value = 0;
      pad.buttons[12].value = 1;
      ControllerSupport.beginFrame();
      check(ControllerSupport.isButtonDown(12), "Raw button 12 remains usable as an action button");
      check(!ControllerSupport.isNonDirectionalButtonDown(mapping),
          "Legacy direction does not also confirm");
      pad.buttons[12].value = 0;
      pad.button.value = 1;
      ControllerSupport.beginFrame();
      check(ControllerSupport.isNonDirectionalButtonDown(mapping), "Menu button");
      int polls = pad.polls;
      for (int i = 0; i < 1000; i++) {
        ControllerSupport.isLeftDown();
        ControllerSupport.isRightDown();
        ControllerSupport.isNonDirectionalButtonDown(mapping);
        for (int button = 0; button < 64; button++) {
          ControllerSupport.isButtonDown(button);
          ControllerSupport.isDirectionalButton(button);
        }
      }
      check(pad.polls == polls, "Gameplay and remapping reads must not poll");
      pad.x.value = 1;
      pad.button.value = 0;
      check(ControllerSupport.isLeftDown() && ControllerSupport.isButtonDown(0),
          "The snapshot remains stable until the next update");
      ControllerSupport.beginFrame();
      check(pad.polls == polls + 1, "One device poll per update");
      check(ControllerSupport.isRightDown() && !ControllerSupport.isButtonDown(0),
          "Direction and release refresh together");
      pad.button.value = 1;
      ControllerSupport.beginFrame();
      mapping.controllerUp = 0;
      check(ControllerSupport.isDirectionDown(mapping.controllerUp), "Remapped direction");
      check(!ControllerSupport.isNonDirectionalButtonDown(mapping),
          "A mapped direction must not also confirm a menu");
      mapping.resetToDefaults();
      if (scenario.equals("connected")) {
        pad.x.value = 0;
        pad.y.value = 0;
        pad.button.value = 0;
        for (int raw = 12; raw <= 15; raw++) {
          pad.buttons[raw].value = 1;
          ControllerSupport.beginFrame();
          check(ControllerSupport.isButtonDown(raw), "Raw button level " + raw);
          check(ControllerSupport.isDirectionalButton(raw), "Legacy button classification " + raw);
          check(ControllerSupport.isDirectionDown(-2-(raw-12)), "Legacy normalized direction");
          check(!ControllerSupport.isNonDirectionalButtonDown(mapping), "Legacy direction is not generic confirm");
          pad.buttons[raw].value = 0;
          ControllerSupport.beginFrame();
        }
        pad.pov.value = Component.POV.UP;
        ControllerSupport.beginFrame();
        check(ControllerSupport.isUpDown() && !ControllerSupport.isDownDown(), "D-pad orientation");
        pad.pov.value = Component.POV.OFF;
        pad.y.value = -0.01f;
        ControllerSupport.beginFrame();
        check(!ControllerSupport.isUpDown(), "Stick dead zone");
        Field eventsField = Controllers.class.getDeclaredField("events");
        eventsField.setAccessible(true);
        List<?> events = (List<?>) eventsField.get(null);
        events.add(null);
        ControllerSupport.beginFrame();
        check(events.isEmpty(), "Unused events must not accumulate");
      } else {
        pad.fail = true;
        pad.reportFailure = scenario.equals("reported-failure");
        ControllerSupport.beginFrame();
        check(!ControllerSupport.isRightDown() && !ControllerSupport.isButtonDown(0),
            "Detected failure clears held controller input");
        polls = pad.polls;
        for (int i = 0; i < 1000; i++) {
          ControllerSupport.beginFrame();
          ControllerSupport.initialize();
    if (scenario.endsWith("-buttons") || scenario.equals("pov-only")) {
      verifyLayout(pad, scenario);
      check(environment.enumerations == 1, "Layout discovery stays startup-only");
      System.out.println("ok - native layout " + scenario); return;
    }
        }
        check(pad.polls == polls, "A failed device must not become a retry loop");
      }
    }
    KeyboardInput keyboard = new KeyboardInput();
    StickvaniaInput input = new StickvaniaInput(keyboard, mapping);
    keyboard.up = true;
    input.update();
    check(input.isUp(), "Keyboard input remains usable");
    if (scenario.equals("connected")) {
      pad.button.value = 0;
      ControllerSupport.beginFrame();
      input.update();
      pad.button.value = 1;
      ControllerSupport.beginFrame();
      input.update();
      check(input.isMenuSelectPressed(), "A new action button press confirms a menu");
      input.update();
      check(!input.isMenuSelectPressed(), "A held action button does not repeat its press");
    }
    if (scenario.equals("connected")) verifyNesMapping(pad, keyboard);
    check(environment.enumerations == 1, "Discovery must run only once");
    check(defaultEnvironment.get(null) == environment, "Do not replace the native environment");
    System.out.println("ok - stickvania desktop input " + scenario);
  }

  private static void set(Object target, String name, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }
  private static Object get(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }
  private static void invoke(Object target, String name) throws Exception {
    java.lang.reflect.Method method = target.getClass().getDeclaredMethod(name);
    method.setAccessible(true);
    method.invoke(target);
  }
  private static final class HeadlessContainer extends org.newdawn.slick.GameContainer {
    HeadlessContainer(Input input) { super(null); this.input = input; }
    public long getTime() { return 0; }
    public int getScreenWidth() { return 640; }
    public int getScreenHeight() { return 480; }
    public boolean hasFocus() { return true; }
    public void setIcon(String name) {}
    public void setIcons(String[] names) {}
    public void setMouseCursor(String ref, int x, int y) {}
    public void setMouseCursor(org.newdawn.slick.opengl.ImageData data, int x, int y) {}
    public void setMouseCursor(org.newdawn.slick.Image image, int x, int y) {}
    public void setMouseCursor(org.lwjgl.input.Cursor cursor, int x, int y) {}
    public void setDefaultMouseCursor() {}
    public void setMouseGrabbed(boolean grabbed) {}
    public boolean isMouseGrabbed() { return false; }
  }

  private static final class QuietMapping extends ButtonMapping {
    int writes;
    public void save() { writes++; }
  }
  private static void verifyNesMapping(Pad pad, KeyboardInput keyboard) throws Throwable {
    keyboard.up = false;
    pad.x.value = 0; pad.y.value = 0; pad.button.value = 0;
    pad.pov.value = Component.POV.OFF; ControllerSupport.beginFrame();
    QuietMapping mapping = new QuietMapping();
    mapping.controllerUp = 7; mapping.controllerDown = 6; mapping.controllerLeft = 3; mapping.controllerRight = 0;
    mapping.controllerJump = -2; mapping.controllerAttack = -3;
    StickvaniaInput input = new StickvaniaInput(keyboard, mapping);
    pad.pov.value = Component.POV.UP; ControllerSupport.beginFrame(); input.update();
    check(input.isJump() && !input.isUp() && input.isMenuSelectPressed(), "Logical A virtual meaning");
    input.update(); check(!input.isMenuSelectPressed(), "Held A cannot confirm repeatedly");
    input.clearPressedState(); input.update(); check(!input.isMenuSelectPressed(), "A clear baseline");
    pad.pov.value = Component.POV.OFF; ControllerSupport.beginFrame(); input.update();
    pad.pov.value = Component.POV.DOWN; ControllerSupport.beginFrame(); input.update();
    check(input.isAttack() && !input.isDown() && input.isMenuSelectPressed(), "Logical B virtual meaning");
    input.clearPressedState(); input.update(); check(!input.isMenuSelectPressed(), "B clear baseline");
    pad.pov.value = Component.POV.OFF; ControllerSupport.beginFrame();
    Main main = new Main(); main.mode = Main.MODE_INPUT_CONFIG; main.buttonMapping = mapping;
    HeadlessContainer gc = new HeadlessContainer(keyboard);
    InputConfigMode editor = new InputConfigMode(main); editor.init(gc);
    for(int i=0;i<8;i++){editor.inputStarted();editor.update(gc);}
    pad.buttons[7].value=1;ControllerSupport.beginFrame();editor.inputStarted();editor.update(gc);
    check(((Integer)get(editor,"stepIndex"))==1, "Native first prompt raw reuse");
    pad.buttons[7].value=0;ControllerSupport.beginFrame();editor.inputStarted();editor.update(gc);
    set(editor,"stepIndex",5);pad.pov.value=Component.POV.DOWN;ControllerSupport.beginFrame();editor.inputStarted();editor.update(gc);
    check(((Integer)get(editor,"stepIndex"))==6 && mapping.controllerAttack==-3, "Native final prompt logical capture");
    check(mapping.writes==1,"One completed preference notification");
    editor.dispose();pad.pov.value=Component.POV.OFF;ControllerSupport.beginFrame();
  }

  private static void verifyLayout(Pad pad, String scenario) throws Throwable {
    ButtonMapping mapping = new ButtonMapping();
    ControllerSupport.beginFrame();
    for (int i=0;i<4;i++) {
      pad.buttons[12+i].value=1; ControllerSupport.beginFrame();
      boolean[] directions = { ControllerSupport.isUpDown(), ControllerSupport.isDownDown(), ControllerSupport.isLeftDown(), ControllerSupport.isRightDown() };
      for(int d=0;d<4;d++) check(directions[d] == (!scenario.equals("named-ordinary-buttons") && d==(scenario.equals("named-direction-buttons") && i==0 ? 1 : i)), "Layout direction " + scenario + "/" + i + "/" + d);
      check(ControllerSupport.isNonDirectionalButtonDown(mapping) == scenario.equals("named-ordinary-buttons"), "Generic confirm classification");
      pad.buttons[12+i].value=0; ControllerSupport.beginFrame();
    }
    if (scenario.equals("named-direction-buttons")) { pad.buttons[3].value=1; ControllerSupport.beginFrame(); check(ControllerSupport.isLeftDown() && !ControllerSupport.isNonDirectionalButtonDown(mapping), "Named direction outside legacy range"); pad.buttons[3].value=0; }
    if (scenario.equals("legacy-buttons")) { pad.buttons[12].value=1;pad.buttons[14].value=1;ControllerSupport.beginFrame();check(ControllerSupport.isUpDown() && ControllerSupport.isLeftDown(),"Legacy diagonal");pad.buttons[12].value=0;pad.buttons[14].value=0; }

    if(scenario.equals("legacy-buttons")||scenario.equals("named-ordinary-buttons")){
      ControllerSupport.beginFrame();
      int binding=scenario.equals("legacy-buttons")?-2:12;
      KeyboardInput keyboard=new KeyboardInput();HeadlessContainer gc=new HeadlessContainer(keyboard);
      mapping.controllerUp=7;mapping.controllerDown=6;mapping.controllerLeft=3;mapping.controllerRight=0;
      mapping.controllerJump=binding;mapping.controllerAttack=-3;StickvaniaInput human=new StickvaniaInput(keyboard,mapping);
      pad.buttons[12].value=1;ControllerSupport.beginFrame();human.update();check(human.isJump()&&!human.isUp()&&human.isMenuSelectPressed(),"Classified Jump virtual meaning");human.update();check(!human.isMenuSelectPressed(),"Held classified Jump");
      pad.buttons[12].value=0;ControllerSupport.beginFrame();
      Main main=new Main();main.mode=Main.MODE_INPUT_CONFIG;main.buttonMapping=mapping;InputConfigMode editor=new InputConfigMode(main);editor.init(gc);
      for(int i=0;i<8;i++){editor.inputStarted();editor.update(gc);}set(editor,"stepIndex",4);
      pad.buttons[12].value=1;ControllerSupport.beginFrame();editor.inputStarted();editor.update(gc);
      check(((Integer)get(editor,"stepIndex"))==5&&((ButtonMapping)get(editor,"draft")).controllerJump==binding,"Actual editor canonical action capture");editor.dispose();
      pad.buttons[12].value=0;ControllerSupport.beginFrame();
    }

    float[] povs={Component.POV.UP,Component.POV.DOWN,Component.POV.LEFT,Component.POV.RIGHT,Component.POV.UP_LEFT,Component.POV.DOWN_RIGHT};
    boolean[][] expected={{true,false,false,false},{false,true,false,false},{false,false,true,false},{false,false,false,true},{true,false,true,false},{false,true,false,true}};
    for(int i=0;i<povs.length;i++){pad.pov.value=povs[i];ControllerSupport.beginFrame();boolean[] dirs={ControllerSupport.isUpDown(),ControllerSupport.isDownDown(),ControllerSupport.isLeftDown(),ControllerSupport.isRightDown()};for(int d=0;d<4;d++)check(dirs[d]==expected[i][d],"Actual POV cardinal/diagonal");check(!ControllerSupport.isNonDirectionalButtonDown(mapping),"POV cannot confirm");pad.pov.value=Component.POV.OFF;ControllerSupport.beginFrame();check(!ControllerSupport.isUpDown()&&!ControllerSupport.isDownDown()&&!ControllerSupport.isLeftDown()&&!ControllerSupport.isRightDown(),"POV release");}
  }

  private static void check(boolean condition, String message) {
    if (!condition) {
      throw new AssertionError(message);
    }
  }

  private static final class KeyboardInput extends Input {
    boolean up;
    KeyboardInput() { super(600); }
    public boolean isKeyDown(int key) { return up && key == Input.KEY_UP; }
    public boolean isKeyPressed(int key) { return false; }
    public void clearKeyPressedRecord() {}
  }

  private static final class Environment extends ControllerEnvironment {
    Controller[] controllers;
    int enumerations;
    boolean fail;
    Environment(Controller[] controllers) { this.controllers = controllers; }
    public Controller[] getControllers() {
      enumerations++;
      if (fail) {
        throw new IllegalStateException("Simulated discovery failure");
      }
      return controllers;
    }
    public boolean isSupported() { return true; }
  }

  private static final class Control implements Component {
    final Identifier identifier;
    float value;
    String name;
    Control(Identifier identifier) { this.identifier = identifier; }
    public Identifier getIdentifier() { return identifier; }
    public boolean isRelative() { return false; }
    public boolean isAnalog() { return identifier instanceof Identifier.Axis; }
    public float getDeadZone() { return 0.05f; }
    public float getPollData() { return value; }
    public String getName() { return name == null ? identifier.getName() : name; }
  }

  private static final class Pad implements Controller {
    final Control x = new Control(Component.Identifier.Axis.X);
    final Control y = new Control(Component.Identifier.Axis.Y);
    final Control pov = new Control(Component.Identifier.Axis.POV);
    final Control[] buttons = {
        new Control(Component.Identifier.Button._0),
        new Control(Component.Identifier.Button._1),
        new Control(Component.Identifier.Button._2),
        new Control(Component.Identifier.Button._3),
        new Control(Component.Identifier.Button._4),
        new Control(Component.Identifier.Button._5),
        new Control(Component.Identifier.Button._6),
        new Control(Component.Identifier.Button._7),
        new Control(Component.Identifier.Button._8),
        new Control(Component.Identifier.Button._9),
        new Control(Component.Identifier.Button._10),
        new Control(Component.Identifier.Button._11),
        new Control(Component.Identifier.Button._12),
        new Control(Component.Identifier.Button._13),
        new Control(Component.Identifier.Button._14),
        new Control(Component.Identifier.Button._15)
    };
    final Control button = buttons[0];
    final Component[] components = {x, y, pov, buttons[0], buttons[1], buttons[2], buttons[3], buttons[4], buttons[5], buttons[6], buttons[7], buttons[8], buttons[9], buttons[10], buttons[11], buttons[12], buttons[13], buttons[14], buttons[15]};
    final EventQueue events = new EventQueue(32);
    int polls;
    boolean fail;
    boolean reportFailure;
    public Controller[] getControllers() { return new Controller[0]; }
    public Type getType() { return Type.GAMEPAD; }
    public Component[] getComponents() { return components; }
    public Component getComponent(Component.Identifier id) {
      for (Component component : components) {
        if (component.getIdentifier().equals(id)) {
          return component;
        }
      }
      return null;
    }
    public Rumbler[] getRumblers() { return new Rumbler[0]; }
    public boolean poll() {
      polls++;
      if (fail) {
        if (reportFailure) {
          System.err.println("Failed to poll device: test disconnected");
          return false;
        }
        throw new IllegalStateException("Simulated polling failure");
      }
      return true;
    }
    public void setEventQueueSize(int size) {}
    public EventQueue getEventQueue() { return events; }
    public PortType getPortType() { return PortType.USB; }
    public int getPortNumber() { return 0; }
    public String getName() { return "Test gamepad"; }
  }
}
