package stickvania;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Map;
import java.util.TreeMap;
import java.util.prefs.AbstractPreferences;
import java.util.prefs.Preferences;
import java.util.prefs.PreferencesFactory;

public final class MappingPreferenceVersionTest {
  private static void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
  private static Map<String, Integer> fields(Object mapping) throws Exception {
    Map<String, Integer> values = new TreeMap<String, Integer>();
    for (Field f : mapping.getClass().getFields()) {
      if (f.getType() == int.class && !Modifier.isStatic(f.getModifiers())) {
        values.put(f.getName(), f.getInt(mapping));
      }
    }
    return values;
  }
  private static Map<String, String> stored(Preferences prefs) throws Exception {
    Map<String, String> values = new TreeMap<String, String>();
    for (String key : prefs.keys()) values.put(key, prefs.get(key, null));
    return values;
  }
  public static void main(String[] args) throws Exception {
    check(args.length == 2, "Expected current and previous versions");
    check(MemoryFactory.class.getName().equals(
        System.getProperty("java.util.prefs.PreferencesFactory")),
        "Refusing to run against real preferences");
    check(Preferences.userRoot() instanceof MemoryNode, "Memory factory was not installed");
    int current = Integer.parseInt(args[0]);
    int previous = Integer.parseInt(args[1]);
    String pkg = MappingPreferenceVersionTest.class.getPackage().getName();
    Class<?> type = Class.forName(pkg + ".ButtonMapping");
    Field version = type.getDeclaredField("VERSION");
    version.setAccessible(true);
    check(version.getInt(null) == current, "Wrong native development cutover");
    Object defaults = type.getConstructor().newInstance();
    Map<String, Integer> defaultFields = fields(defaults);
    Preferences prefs = Preferences.userNodeForPackage(type);
    for (int rejected : new int[] { previous, 0, -1, current + 1 }) {
      prefs.clear();
      type.getMethod("save").invoke(defaults);
      prefs.putInt("controllerUp", -2);
      prefs.putInt(pkg.equals("jackal") ? "controllerGrenade" : "controllerJump", 12);
      prefs.putInt("keyUp", 30);
      prefs.putInt("inputMappingVersion", rejected);
      Map<String, String> before = stored(prefs);
      int writes = MemoryNode.writes;
      Object loaded = type.getMethod("load").invoke(null);
      check(fields(loaded).equals(defaultFields),
          "Obsolete/unsupported preferences accepted: " + rejected);
      check(stored(prefs).equals(before) && MemoryNode.writes == writes,
          "Load modified rejected preferences");
      type.getMethod("save").invoke(loaded);
      check(prefs.getInt("inputMappingVersion", -1) == current,
          "Current save failed to replace old version");
      check(fields(type.getMethod("load").invoke(null)).equals(defaultFields),
          "Current defaults failed to round trip");
    }
    prefs.clear();
    Map<String, String> empty = stored(prefs);
    int writes = MemoryNode.writes;
    check(fields(type.getMethod("load").invoke(null)).equals(defaultFields),
        "Absent preferences");
    check(stored(prefs).equals(empty) && MemoryNode.writes == writes,
        "Absent load wrote defaults");
    Object custom = type.getConstructor().newInstance();
    type.getField("keyUp").setInt(custom, 30);
    type.getField("controllerUp").setInt(custom, 7);
    type.getField("controllerDown").setInt(custom, 6);
    type.getField(pkg.equals("jackal") ? "controllerGrenade" : "controllerJump")
        .setInt(custom, -2);
    type.getMethod("save").invoke(custom);
    check(prefs.getInt("inputMappingVersion", -1) == current,
        "Save did not stamp current native version");
    Map<String, String> before = stored(prefs);
    writes = MemoryNode.writes;
    check(fields(type.getMethod("load").invoke(null)).equals(fields(custom)),
        "Current custom mapping failed round trip");
    check(stored(prefs).equals(before) && MemoryNode.writes == writes,
        "Current load wrote preferences");
    prefs.put("inputMappingVersion", "not-an-integer");
    before = stored(prefs);
    writes = MemoryNode.writes;
    check(fields(type.getMethod("load").invoke(null)).equals(defaultFields),
        "Malformed version");
    check(stored(prefs).equals(before) && MemoryNode.writes == writes,
        "Malformed load wrote preferences");
    System.out.println("ok - " + pkg
        + " native preference cutover and non-destructive current-version loads");
  }

  public static final class MemoryFactory implements PreferencesFactory {
    private final Preferences user = new MemoryNode(null, "");
    private final Preferences system = new MemoryNode(null, "");
    public Preferences userRoot() { return user; }
    public Preferences systemRoot() { return system; }
  }
  private static final class MemoryNode extends AbstractPreferences {
    static int writes;
    private final Map<String, String> values = new TreeMap<String, String>();
    private final Map<String, MemoryNode> children = new TreeMap<String, MemoryNode>();
    MemoryNode(AbstractPreferences parent, String name) { super(parent, name); }
    protected void putSpi(String key, String value) { writes++; values.put(key, value); }
    protected String getSpi(String key) { return values.get(key); }
    protected void removeSpi(String key) { writes++; values.remove(key); }
    protected void removeNodeSpi() {
      writes++;
      if (parent() instanceof MemoryNode) ((MemoryNode) parent()).children.remove(name());
    }
    protected String[] keysSpi() { return values.keySet().toArray(new String[values.size()]); }
    protected String[] childrenNamesSpi() {
      return children.keySet().toArray(new String[children.size()]);
    }
    protected AbstractPreferences childSpi(String name) {
      MemoryNode child = children.get(name);
      if (child == null) {
        child = new MemoryNode(this, name);
        children.put(name, child);
      }
      return child;
    }
    protected void syncSpi() {}
    protected void flushSpi() {}
  }
}
