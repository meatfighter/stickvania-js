package stickvania;

import org.newdawn.slick.*;

public class MermanSpawner extends Thing {

  private int count = 2;
  private int delay;
  private int x1;
  private int x2;
  private float vy;
  private boolean simonSplashed;

  public MermanSpawner(Main main, int x1, int x2, int y) {
    super(main);

    this.y = y;
    this.x1 = x1;
    this.x2 = x2;
    this.vy = -(float)Math.sqrt(2 * Main.GRAVITY * (350 - y));
  }

  public void mermanDied() {
    count++;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.timeFrozen > 0) {
      return true;
    }

    if (main.simon.x < x1 || main.simon.x > x2) {
      return true;
    }

    if (main.simon.y > 352 && !simonSplashed) {
      simonSplashed = true;
      main.pushThing(new Droplets(main, main.simon.x + 24, 352, -1f, -5.5f));
      main.pushThing(new Droplets(main, main.simon.x + 24, 352, 1f, -5f));
      main.pushThing(new Droplets(main, main.simon.x + 24, 352, 0.2f, -8f));
      main.playSound(main.splash);
    }

    if (delay == 0) {
      delay = 182;

      for(int i = 0; i < 16 && count > 0; i++) {
        if (main.random.nextBoolean()) {
          int target = (int)(main.simon.x + 64 + main.random.nextInt(192));
          if (target >= x1 && target <= x2) {
            count--;
            main.pushThing(new Merman(main, target, vy, this));
            break;
          }
        } else {
          int target = (int)(main.simon.x - 64 - main.random.nextInt(192));
          if (target >= x1 && target <= x2) {
            count--;
            main.pushThing(new Merman(main, target, vy, this));
            break;
          }
        }
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
