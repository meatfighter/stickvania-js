package stickvania;
import java.lang.reflect.*;
/** Executes the production selector and recount against the classes supplied on the classpath. */
public final class RegionAuthorityTest {
  static void check(boolean ok,String label) { if(!ok)throw new AssertionError(label); }
  public static void main(String[] args) throws Throwable {
    Main m=new Main();m.mode=Main.MODE_CREDITS;m.simon=new Simon(m);
    Method select=Main.class.getDeclaredMethod("getPresentationPlatforms");select.setAccessible(true);
    Method recount=Main.class.getDeclaredMethod("recountActiveWhips");recount.setAccessible(true);
    StageSegment segment=new StageSegment();segment.regions=new Region[]{new Region(),new Region()};
    for(Region r:segment.regions)r.platforms=new Thing[]{new MovingPlatform(m,64,192,160)};
    Field field=Main.class.getDeclaredField("stageSegment");field.setAccessible(true);field.set(m,segment);
    for(int direction:new int[]{Main.LEFT,Main.RIGHT}) {
      segment.regionIndex=direction==Main.RIGHT?1:0;m.platforms=segment.regions[segment.regionIndex].platforms;
      m.door=new Door(m,512,96,direction,true);
      for(int phase:new int[]{1,2,3,5,6}) {
        m.door.state=phase;
        check(select.invoke(m)==segment.regions[1-segment.regionIndex].platforms,"source presentation phase "+phase);
        check(m.platforms==segment.regions[segment.regionIndex].platforms,"logical destination unchanged");
      }
      m.door=null;check(select.invoke(m)==m.platforms,"completed door destination presentation");
    }
    m.visibleWhipCount=2;recount.invoke(m);check(m.visibleWhipCount==0,"empty activation clears stale count");
    m.regionThingStack.push(new DropItem(m,64,160,DropItem.TYPE_WHIP));
    m.regionStackSwap.push(new DropItem(m,96,160,DropItem.TYPE_WHIP));
    m.regionThingStack.push(new DropItem(m,128,160,DropItem.TYPE_LARGE_HEART));
    recount.invoke(m);check(m.visibleWhipCount==2,"both active stacks counted");
    m.regionStackSwap.clear();recount.invoke(m);check(m.visibleWhipCount==1,"retained pickup count");
    System.out.println("RegionAuthorityTest passed production Door selector and active Whip recount.");
  }
}
