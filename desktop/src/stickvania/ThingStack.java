package stickvania;

public class ThingStack {

  public Thing[] things = new Thing[32];
  public int top = -1;

  public void push(Thing thing) {
    if (thing == null) {
      throw new IllegalArgumentException("ThingStack cannot contain a null Thing.");
    }
    top++;
    if (top == things.length) {
      Thing[] things2 = new Thing[things.length + 16];
      System.arraycopy(things, 0, things2, 0, things.length);
      things = things2;
    }
    things[top] = thing;
  }

  public Thing pop() {
    if (top == -1) {
      return null;
    }
    Thing thing = things[top];
    things[top] = null;
    top--;
    return thing;
  }

  public void clear() {
    Thing thing;
    while((thing = pop()) != null) {
      thing.onDiscarded();
    }
  }

  public void moveAll(ThingStack thingStack) {
    Thing thing = null;
    while((thing = thingStack.pop()) != null) {
      push(thing);
    }
  }

  public void addAll(ThingStack thingStack) {
    Thing[] stackThings = thingStack.things;
    for(int i = thingStack.top; i >= 0; i--) {
      push(stackThings[i]);
    }
  }
}
