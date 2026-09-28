package stickvania;
import java.lang.reflect.Field;
/** Real production stack and collision/producer methods. Native credits mode supplies silent audio. */
public final class NullThingBoundaryTest {
    static void check(boolean value,String label) { if(!value)throw new AssertionError(label); }
    static void dense(ThingStack stack,int size) {check(stack.top+1==size,"stack size");for(int i=0;i<=stack.top;i++)check(stack.things[i]!=null,"dense active prefix");}
    public static void main(String[] args) throws Throwable {
        for(int mode:new int[]{Main.MODE_PLAYING,Main.MODE_DEMO,Main.MODE_CREDITS}) {
            Main m=new Main();m.mode=mode;ThingStack stack=new ThingStack();
            try {stack.push(null);throw new AssertionError("null accepted");}catch(IllegalArgumentException expected){}
            check(stack.top==-1,"guard precedes mutation");
            m.regionThingStack=stack;m.pushThing((Thing)null);m.pushThing(new ThingStack[]{stack},null);dense(stack,0);
            Thing original=new Spark(m,0,0,1,1);m.pushThing(original);m.pushThing((Thing)null);dense(stack,1);check(stack.pop()==original&&stack.pop()==null,"normal stack order");
        }
        Main m=new Main();m.mode=Main.MODE_CREDITS;m.playerPower=16;
        m.simon=new Simon(m);m.simon.x=m.simon.lastX=96;m.simon.y=m.simon.lastY=256;
        m.simon.direction=Main.RIGHT;m.simon.whipType=2;m.simon.whipping=true;m.simon.whipIndex=2;
        m.map=new int[11][32];m.walls=new int[11][32];m.mapWidth=32;
        Thing original=new Spark(m,0,0,1,1);
        for(int kind=0;kind<4;kind++) {
            Thing actor=null;
            for(int i=2;i<10&&actor==null;i++)for(int j=2;j<12&&actor==null;j++) {
                Thing candidate=kind==0?new Candles(m,j*32,i*32,Main.CANDLE_ITEM_EMPTY):kind==1?new Torch(m,j*32,i*32,Main.CANDLE_ITEM_EMPTY):kind==2?new BreakWall(m,j,i,Main.CANDLE_ITEM_EMPTY):new BoneDragon(m,j*32,i*32,Main.CANDLE_ITEM_EMPTY,false);
                if(m.intersectsWhip(candidate))actor=candidate;
            }
            check(actor!=null,"actual whip overlap");m.regionThingStack=new ThingStack();m.pushThing(original);
            if(actor instanceof BoneDragon) {
                BoneDragon dragon=(BoneDragon)actor;dragon.hits=1;check(dragon.update(null)&&dragon.dead,"head death");dense(m.regionThingStack,3);
                Field delay=BoneDragon.class.getDeclaredField("deadDelay");delay.setAccessible(true);
                for(int i=0;i<6;i++){delay.setInt(dragon,1);check(dragon.update(null)==(i<5),"vertebra lifetime");dense(m.regionThingStack,4+i);}
            } else {check(!actor.update(null),"producer completes");dense(m.regionThingStack,new int[]{2,3,5}[kind]);}
        }
        System.out.println("NullThingBoundaryTest passed actual Main/ThingStack and all nullable producers.");
    }
}
