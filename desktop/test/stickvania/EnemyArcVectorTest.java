package stickvania;
/** Float bit patterns from the production helper, consumed by the TypeScript helper test. */
public final class EnemyArcVectorTest {
  public static void main(String[] args)throws Throwable {
    Main m=new Main();Thing body=new Raven(m,0,0);
    for(float y:new float[]{0,32,200})for(float target:new float[]{-200,0,32,232,1e30f})for(float t:new float[]{0,1e-30f,.25f,1,2,16,100,1e20f}) {
      body.y=y;body.G=99;body.vy=99;
      boolean result=EnemyArcMotion.configure(body,t,target);
      System.out.println(result+","+Float.floatToRawIntBits(body.G)+","+Float.floatToRawIntBits(body.vy));
    }
  }
}
