package stickvania;

import org.newdawn.slick.*;

public class BirdSpawner extends Thing {

  private int count = 3;
  private int delay;
  private int x1;
  private int x2;

  public BirdSpawner(Main main, int x1, int x2) {
    super(main);
    this.x1 = x1;
    this.x2 = x2;
  }

  public void birdDied() {
    count++;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.timeFrozen > 0 || main.simon.x < x1 || main.simon.x > x2
        || count == 0) {
      return true;
    }

    if (delay == 0) {
      delay = 182;

      count--;
      int Y = ((((int)(main.simon.y)) >> 5) << 5)
          - (main.random.nextInt(4) << 5) - 64;
      if (Y < 0) {
        Y = 0;
      }
      int direction = main.random.nextBoolean()
          ? main.simon.direction == Main.LEFT ? Main.RIGHT : Main.LEFT
          : main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
      if (direction == Main.LEFT) {
        main.pushThing(new Bird(main, main.camera + 512, Y, direction, this));
      } else {
        main.pushThing(new Bird(main, main.camera - 64, Y, direction, this));
      }
    } else {
      delay--;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
  }
}
