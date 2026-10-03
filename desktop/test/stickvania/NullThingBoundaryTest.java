package stickvania;
import java.lang.reflect.Field;
/** Real production stack and collision/producer methods. Native credits mode supplies silent audio. */
public final class NullThingBoundaryTest {
    static void check(boolean value,String label) { if(!value)throw new AssertionError(label); }
    static void dense(ThingStack stack,int size) {check(stack.top+1==size,"stack size");for(int i=0;i<=stack.top;i++)check(stack.things[i]!=null,"dense active prefix");}
    public static void main(String[] args) throws Throwable {
        if(args.length>0){replay(args);return;}
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

    /** Independent JVM replay of the actual private fixed-tick dispatcher and shipped resources. */
    static final class SilentImage extends org.newdawn.slick.Image {
        SilentImage(){super();}
        @Override public void setAlpha(float alpha){}
    }
    static void images(Object array)throws Exception {
        for(int i=0;i<java.lang.reflect.Array.getLength(array);i++) {
            if(array.getClass().getComponentType()==org.newdawn.slick.Image.class)java.lang.reflect.Array.set(array,i,new SilentImage());
            else if(java.lang.reflect.Array.get(array,i)!=null&&java.lang.reflect.Array.get(array,i).getClass().isArray())images(java.lang.reflect.Array.get(array,i));
        }
    }
    static final class SilentSound extends org.newdawn.slick.Sound {
        SilentSound()throws org.newdawn.slick.SlickException{super("unused");}
        @Override public void play(){}
        @Override public void stop(){}
    }
    static java.util.Map<String,String> prior=new java.util.TreeMap<String,String>();
    static int frame;
    static java.util.IdentityHashMap<Object,Integer> ids;
    static java.util.Map<String,String> values;
    static final java.util.Map<Class<?>,java.util.List<Field>> fields=new java.util.HashMap<Class<?>,java.util.List<Field>>();
    static java.util.List<Field> fields(Class<?> type) {
        if(fields.containsKey(type))return fields.get(type);
        java.util.List<Field> all=new java.util.ArrayList<Field>();
        for(Class<?> c=type;c!=null&&c.getName().startsWith("stickvania.");c=c.getSuperclass())
            for(Field f:c.getDeclaredFields())if(!java.lang.reflect.Modifier.isStatic(f.getModifiers())){f.setAccessible(true);all.add(f);}
        java.util.Collections.sort(all,new java.util.Comparator<Field>(){public int compare(Field a,Field b){return a.getName().compareTo(b.getName());}});
        fields.put(type,all);return all;
    }
    static void visit(Object o,String path)throws Exception {
        if(o==null){values.put(path,"null");return;}
        if(o instanceof Number||o instanceof Boolean||o instanceof String){values.put(path,String.valueOf(o));return;}
        if(o instanceof java.util.Random){Field seed=java.util.Random.class.getDeclaredField("seed");seed.setAccessible(true);values.put(path,seed.get(o).toString());return;}
        if(o instanceof org.newdawn.slick.Image)return;
        if(o instanceof int[]){values.put(path,java.util.Arrays.toString((int[])o));return;}
        if(o instanceof char[]){values.put(path,new String((char[])o));return;}
        Class<?> c=o.getClass();
        if(!c.isArray()&&!c.getName().startsWith("stickvania."))return;
        if(o instanceof ButtonMapping||o instanceof StickvaniaInput)return;
        Integer id=ids.get(o);if(id!=null){values.put(path,"ref:"+id);return;}
        ids.put(o,ids.size());values.put(path,"id:"+ids.get(o)+":"+c.getSimpleName());
        if(c.isArray()) {
            if(c.getComponentType()==org.newdawn.slick.Image.class||c.getComponentType()==byte.class)return;
            int n=java.lang.reflect.Array.getLength(o);values.put(path+".length",String.valueOf(n));
            for(int i=0;i<n;i++)visit(java.lang.reflect.Array.get(o,i),path+"["+i+"]");return;
        }
        for(Field f:fields(c)) {
            String k=f.getName();
            if(k.equals("main")||k.equals("loadedSegments")||k.equals("nextFrameTime")||k.equals("inputConfigMode")||k.equals("scalableGame")||k.equals("demoKeyRecordings")||k.equals("endingKeyRecordings"))continue;
            String fieldKey=f.getDeclaringClass().getSimpleName()+"."+k;
            visit(f.get(o),path+"."+fieldKey);
        }
    }
    static void record(Main m,java.io.PrintWriter out)throws Exception {
        ids=new java.util.IdentityHashMap<Object,Integer>();values=new java.util.TreeMap<String,String>();visit(m,"main");
        out.println("FRAME "+frame++);
        java.util.TreeSet<String> keys=new java.util.TreeSet<String>(prior.keySet());keys.addAll(values.keySet());
        for(String key:keys)if(!java.util.Objects.equals(prior.get(key),values.get(key)))out.println(key+"="+values.get(key));
        prior=values;
    }
    static void replay(String[] args)throws Throwable {
        Main m=new Main();m.difficulty=Integer.parseInt(args[1]);
        // Actual Song state, silent Music boundary: recordings suppress native gameplay audio.
        for(Field f:Main.class.getDeclaredFields())if(f.getType()==org.newdawn.slick.Music.class){f.setAccessible(true);f.set(m,EnemyArcMotionTest.allocate(EnemyArcMotionTest.SilentMusic.class));}
        for(Field f:Main.class.getDeclaredFields()) {
            f.setAccessible(true);
            if(f.getType()==org.newdawn.slick.Image.class)f.set(m,new SilentImage());
            if(f.getType().isArray()&&f.getType().getName().contains("org.newdawn.slick.Image")&&f.get(m)!=null)images(f.get(m));
            if(f.getType()==org.newdawn.slick.Sound.class)f.set(m,EnemyArcMotionTest.allocate(SilentSound.class));
            if(f.getType()==Song.class&&!f.getName().equals("currentSong")&&!f.getName().equals("requestedSong")) {
                Song song=(Song)EnemyArcMotionTest.allocate(Song.class);
                Field loop=Song.class.getDeclaredField("loop");loop.setAccessible(true);loop.set(song,EnemyArcMotionTest.allocate(EnemyArcMotionTest.SilentMusic.class));
                f.set(m,song);
            }
        }
        org.newdawn.slick.Input input=new org.newdawn.slick.Input(480);
        Field inputField=Main.class.getDeclaredField("input");inputField.setAccessible(true);inputField.set(m,input);
        m.controlInput=new StickvaniaInput(input,m.buttonMapping);
        PlayerActionPolicy.registerPlayerActionMain(m);
        m.simon=new Simon(m);
        StageSegment[][] loaded=new StageSegment[6][];int[] counts={2,4,3,2,4,3};
        Field loadedField=Main.class.getDeclaredField("loadedSegments");loadedField.setAccessible(true);loadedField.set(m,loaded);
        java.lang.reflect.Method load=Main.class.getDeclaredMethod("loadStageSegment",int.class,int.class);load.setAccessible(true);
        for(int i=0;i<counts.length;i++){loaded[i]=new StageSegment[counts[i]];for(int j=0;j<counts[i];j++)load.invoke(m,i,j);}
        java.lang.reflect.Method update=Main.class.getDeclaredMethod("update",org.newdawn.slick.GameContainer.class);update.setAccessible(true);
        Field demo=Main.class.getDeclaredField("demoIndex");demo.setAccessible(true);demo.setInt(m,2);
        org.newdawn.slick.GameContainer gc=(org.newdawn.slick.GameContainer)EnemyArcMotionTest.allocate(org.newdawn.slick.AppGameContainer.class);
        java.io.PrintWriter out=new java.io.PrintWriter(args[0],"UTF-8");
        try {
            for(int i=0;i<3;i++){
                m.initDemo();m.fade=0;m.fadeState=Main.FADE_DONE;int n=0;
                while(m.mode==Main.MODE_DEMO&&n++<8000){update.invoke(m,gc);record(m,out);}
                check(m.mode==Main.MODE_TITLE_SCREEN,"native demo exit "+i);
            }
            m.stopSong();m.currentSong=m.requestedSong=m.ending;m.ending.play();
            m.initCastleFalls();m.fade=0;m.fadeState=Main.FADE_DONE;int n=0;
            while(m.mode==Main.MODE_CASTLE_FALLS&&n++<8000){update.invoke(m,gc);record(m,out);}
            check(m.mode==Main.MODE_CREDITS,"native castle to credits");
            java.util.Set<Integer> clips=new java.util.HashSet<Integer>();Field index=Main.class.getDeclaredField("creditsIndex");index.setAccessible(true);n=0;
            while(m.mode==Main.MODE_CREDITS&&n++<30000){clips.add(index.getInt(m));update.invoke(m,gc);record(m,out);}
            check(m.mode==Main.MODE_TITLE_SCREEN&&clips.size()==13,"native twelve clips plus final caption exit");
        } finally {out.close();}
        System.out.println("Native playback: "+frame+" boundaries, three demos, castle, twelve credits clips, final title; difficulty="+m.difficulty);
    }
}
