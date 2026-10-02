package stickvania;

import java.lang.reflect.Field;

/** Production actor physics and dispatch retirement against the packaged classes. */
public final class PitLifecycleTest {
  static void check(boolean value, String label) { if (!value) throw new AssertionError(label); }
  static void set(Object object, String name, int value) throws Exception {
    Field field = object.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.setInt(object, value);
  }
  static Main world() throws Throwable {
    Main main = new Main();
    main.mode = Main.MODE_CREDITS;
    main.playerPower = 16;
    main.simon = new Simon(main);
    main.simon.x = 100;
    main.simon.y = 100;
    main.simon.xMin = -10000;
    main.simon.xMax = 10000;
    main.map = new int[11][32];
    main.walls = new int[11][32];
    main.mapWidth = 32;
    return main;
  }
  static Thing actor(Main m, int kind, int y) throws Exception {
    switch (kind) {
      case 0: return new WhiteSkeleton(m, 100, y);
      case 1: Dog dog = new Dog(m, 100, y); set(dog, "state", 2); return dog;
      case 2: return new RedSkeleton(m, 100, y);
      case 3: return new AxeKnight(m, 100, y);
      case 4: return new SmallHeart(m, 100, y);
      default: return new DropItem(m, 100, y, DropItem.TYPE_LARGE_HEART);
    }
  }
  public static void main(String[] args) throws Throwable {
    for (int kind = 0; kind < 6; kind++) {
      Main m = world();
      Thing thing = actor(m, kind, 353);
      thing.vy = kind == 4 ? 0 : 1;
      thing.kill = true;
      m.timeFrozen = 1;
      check(!thing.update(null), "entry retirement " + kind);
      check(m.regionThingStack.top == -1 && m.score == 0, "no pit combat effects " + kind);
      if (thing instanceof AxeKnight) {
        AxeKnight knight = (AxeKnight) thing;
        check(knight.dead, "pit knight dead");
        Field delay = AxeKnight.class.getDeclaredField("throwDelay"); delay.setAccessible(true);
        int before = delay.getInt(knight);
        knight.axeGone();
        check(delay.getInt(knight) == before, "dead callback inert");
      }
      m = world(); thing = actor(m, kind, 352); thing.vy = kind == 4 ? 0 : 1;
      check(!thing.update(null) && thing.y > 352, "first crossing " + kind);
    }
    for (int kind = 0; kind < 2; kind++) {
      Main m = world(); Thing thing = actor(m, kind, 0);
      ThingStack active = new ThingStack(), swap = new ThingStack(); active.push(thing);
      boolean retired = false; float y = 0, vy = 0;
      for (int tick = 0; tick < 2200; tick++) {
        Thing next;
        while ((next = active.pop()) != null) if (next.update(null)) swap.push(next);
        ThingStack old = active; active = swap; swap = old;
        if (active.top < 0 && !retired) { retired = true; y = thing.y; vy = thing.vy; }
        if (retired) check(thing.y == y && thing.vy == vy, "retired coordinates stable");
      }
      check(retired && y < 400, "bounded ordinary fall " + kind);
    }
    System.out.println("PitLifecycleTest passed production Java actors and 2200-tick dispatch.");
  }
}
