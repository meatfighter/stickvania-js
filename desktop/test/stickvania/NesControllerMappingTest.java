package stickvania;

import java.util.HashSet;
import java.util.Set;

public final class NesControllerMappingTest {
  private static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
  private static void apply(ButtonMapping mapping, int[] values) {
    ButtonMapping draft = NesInputProfile.copy(mapping);
    Set<Integer> used = new HashSet<Integer>();
    for (int i = 0; i < NesInputProfile.ACTIVE_COUNT; i++) {
      require(NesInputProfile.assignController(draft, i, values[i], used), "assignment " + i);
    }
    NesInputProfile.copyInto(draft, mapping);
  }
  public static void main(String[] args) {
    require(NesInputProfile.RAW_BUTTON_LIMIT == ControllerSupport.GAMEPAD_BUTTON_INDEX_LIMIT, "raw domain drift");
    for (int slot = 0; slot < NesInputProfile.ACTIVE_COUNT; slot++) {
      for (int value = -5; value < 64; value++) {
        if (value == -1) continue;
        ButtonMapping draft = new ButtonMapping();
        Set<Integer> used = new HashSet<Integer>();
        require(NesInputProfile.assignController(draft, slot, value, used), "domain destination");
        require(NesInputProfile.controller(draft, slot) == value, "assigned value");
        int copies = 0;
        for (int i = 0; i < NesInputProfile.ACTIVE_COUNT; i++) {
          if (NesInputProfile.controller(draft, i) == value) copies++;
        }
        require(copies == 1, "duplicate old ownership");
        require(!NesInputProfile.assignController(draft, (slot + 1) % NesInputProfile.ACTIVE_COUNT, value, used), "duplicate accepted");
      }
    }
    require(!NesInputProfile.isControllerBinding(-6), "invalid negative");
    require(!NesInputProfile.isControllerBinding(64), "invalid upper bound");
    ButtonMapping mapping = new ButtonMapping();
    int[] first = {7, 6, 3, 0, -2, -3, -4};
    int[] swapped = {6, 7, 0, 3, -3, -2, -5};
    apply(mapping, first);
    apply(mapping, first);
    apply(mapping, swapped);
    for (int i = 0; i < NesInputProfile.ACTIVE_COUNT; i++) {
      require(NesInputProfile.controller(mapping, i) == swapped[i], "repeated/swap result");
    }
    ButtonMapping partial = new ButtonMapping();
    partial.controllerUp = 7;
    partial.controllerDown = 6;
    require(NesInputProfile.assignController(partial, 0, 6, new HashSet<Integer>()), "partial move");
    require(partial.controllerUp == 6 && partial.controllerDown == -1, "stale owner not cleared");
    System.out.println("PASS NES controller mapping profile");
  }
}