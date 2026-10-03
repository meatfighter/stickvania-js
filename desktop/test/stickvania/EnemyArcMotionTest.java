package stickvania;
import java.lang.reflect.*;
import java.util.*;
import org.newdawn.slick.*;
/** Actual production methods; only native audio/device endpoints are silent. */
public final class EnemyArcMotionTest {
  static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);}
  static void set(Object o,String key,Object value)throws Exception {Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);f.set(o,value);}
  static Object get(Object o,String key)throws Exception {Field f=o.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(o);}
  static final class SilentMusic extends Music {
    SilentMusic() throws SlickException {super("unused");}
    private boolean active;
    @Override public boolean playing(){return active;}
    @Override public void play(){active=true;}
    @Override public void loop(){active=true;}
    @Override public void stop(){active=false;}
  }
  static Object allocate(Class<?> type)throws Exception {
    Class<?> u=Class.forName("sun.misc.Unsafe");Field f=u.getDeclaredField("theUnsafe");f.setAccessible(true);
    return u.getMethod("allocateInstance",Class.class).invoke(f.get(null),type);
  }
  public static void main(String[] args)throws Throwable {
    Main m=new Main();m.mode=Main.MODE_CREDITS;m.playerPower=16;m.time=300;
    m.simon=new Simon(m);m.simon.x=84;m.simon.y=224;
    m.map=new int[11][64];m.walls=new int[11][64];m.mapWidth=64;
    m.random=new Random(){@Override public int nextInt(int n){return 0;}@Override public boolean nextBoolean(){return true;}};
    for(int type=0;type<2;type++) {
      Thing actor=type==0?new Raven(m,100,32):new BridgeBat(m,68,32);
      set(actor,"state",1);set(actor,"delay",1);actor.update(null);
      check(!(Boolean)get(actor,"applyingGravity")&&actor.G==0&&actor.vy==0,"singular fallback");
      for(int sign:new int[]{-1,1}) {
        set(actor,"state",2);set(actor,"targetX",1000f);set(actor,"applyingGravity",true);
        actor.x=100;actor.y=160;actor.vy=sign*500;actor.G=sign*500;actor.update(null);
        check(actor.y==160+sign*32&&actor.vy==sign*32,"real bounded update");
        m.timeFrozen=1;float x=actor.x,y=actor.y;actor.update(null);check(actor.x==x&&actor.y==y,"watch freeze");m.timeFrozen=0;
      }
      check(!EnemyArcMotion.configure(actor,1e-30f,232)&&actor.G==0&&actor.vy==0,"underflow");
      actor.y=32;check(EnemyArcMotion.configure(actor,1,232)&&actor.G==-64&&actor.vy==4,"launch before cap");
    }
    for(int delay=0;delay<=42;delay++) {
      BridgeBat b=new BridgeBat(m,100,100);set(b,"state",1);set(b,"delay",delay);
      for(int tick=1;tick<=Math.max(1,delay);tick++){b.update(null);check((Integer)get(b,"state")== (tick==Math.max(1,delay)?2:1),"hover delay "+delay);}
    }
    GrimReaper g=new GrimReaper(m,64,100);set(g,"state",3);set(g,"throwDelay",1);set(g,"throwCount",2);set(g,"shouldMove",true);set(g,"sickles",0);set(g,"Y",100f);
    g.update(null);check((Integer)get(g,"flyTime")==0&&(Float)get(g,"angleInc")==0,"zero flight");float x=g.x,y=g.y;g.update(null);check(g.x==x&&g.y==y&&(Integer)get(g,"flyTime")==-1,"unused increment");
    m.game_over=(Music)allocate(SilentMusic.class);
    for(boolean swap:new boolean[]{false,true}) {
      m.mode=Main.MODE_CREDITS;m.simon.dead=0;m.simon.hurt=false;m.simon.flashing=0;m.simon.onStairs=false;m.simon.y=128;m.playerPower=16;m.time=300;m.timeFrozen=0;
      StopWatch watch=new StopWatch(m);check(watch.lifeTime==455&&m.timeFrozen==455,"valid watch");
      (swap?m.weaponsStackSwap:m.weaponsStack).push(watch);m.initTitleScreen();
      check(watch.lifeTime==0&&m.timeFrozen==0&&m.weaponsStack.top==-1&&m.weaponsStackSwap.top==-1,"native title discard");
    }
    System.out.println("EnemyArcMotionTest passed actual native enemy, Grim and title methods.");
  }
}
