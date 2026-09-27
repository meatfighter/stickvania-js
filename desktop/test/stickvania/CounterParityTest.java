package stickvania;
import java.lang.reflect.*;
import java.util.*;
import org.newdawn.slick.*;
/** Production numerical methods and glyph dispatch; the backend image is a recorder. */
public final class CounterParityTest {
    static final TreeMap<Float, Character> glyphs = new TreeMap<Float, Character>();
    static final class Glyph extends Image {
        final char value; Glyph(char value) { super(); this.value=value; }
        @Override public void draw(float x,float y) { glyphs.put(x,value); }
    }
    static void check(boolean ok,String message) { if(!ok)throw new AssertionError(message); }
    public static void main(String[] args) throws Throwable {
        Main main=new Main(); main.mode=Main.MODE_CREDITS; // Native audio remains silent at this existing backend boundary.
        Image[] symbols=new Image[256]; for(int i=0;i<256;i++)symbols[i]=new Glyph((char)i);
        main.symbols=symbols;
        int[] values={0,1,999999,1000000,1234567};
        String[] expected={"000000","000001","999999","000000","234567"};
        Method draw=Main.class.getDeclaredMethod("drawNumber",int.class,int.class,int.class,int.class);draw.setAccessible(true);
        for(int i=0;i<values.length;i++) {
            glyphs.clear();main.score=values[i];
            draw.invoke(main,values[i],6,160,32);
            StringBuilder text=new StringBuilder();for(char c:glyphs.values())text.append(c);
            check(text.toString().equals(expected[i]),"native glyph sequence");
            check(glyphs.lastKey()==240 && main.score==values[i],"alignment and score authority");
        }
        for(int n:new int[]{98,99}) {main.players=n;main.addPlayers(1);check(main.players==99,"lives cap");main.hearts=n;main.addHearts(1);check(main.hearts==99,"heart cap");}
        main.score=29990;main.players=98;main.addPoints(10);check(main.players==99 && main.score==30000,"threshold");
        main.addPoints(50000);check(main.players==99,"later capped threshold cue");
        System.out.println("CounterParityTest passed actual production formatter, glyph dispatch and awards.");
    }
}
