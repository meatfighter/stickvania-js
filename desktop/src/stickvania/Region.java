package stickvania;

public class Region {
  public int min;
  public int max;
  public Checkpoint checkpoint;
  public final ThingStack thingStack = new ThingStack();
  public Thing[] platforms;
  public int stageNumber;
}
