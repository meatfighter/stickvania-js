package stickvania;

import org.newdawn.slick.*;

public class Spark extends Thing {

  private int counter;

  public Spark(Main main, float x, float y, int width, int height) {
    super(main, 32, 32);
    this.x = x + main.random.nextInt(width) - 16;
    this.y = y + main.random.nextInt(height) - 16;
  }

  public Spark(Main main, Thing thingThatSparked) {
    super(main, 32, 32);

    int width = thingThatSparked.rx2 - thingThatSparked.rx1 + 1;
    int height = thingThatSparked.ry2 - thingThatSparked.ry1 + 1;
    x = thingThatSparked.x + thingThatSparked.rx1 + main.random.nextInt(width)
        - 16;
    y = thingThatSparked.y + thingThatSparked.ry1 + main.random.nextInt(height)
        - 16;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (++counter == 10) {
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.spark, x, y);
  }
}
