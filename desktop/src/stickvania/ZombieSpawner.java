package stickvania;

import org.newdawn.slick.*;

public class ZombieSpawner extends Thing {

  private static final int BASE_ACTIVE_CAP = 3;

  private int count = BASE_ACTIVE_CAP;
  private int activeCap = BASE_ACTIVE_CAP;
  private int delay;
  private int x1;
  private int x2;

  public ZombieSpawner(Main main, int x1, int x2, int y) {
    super(main);
    this.y = y;
    this.x1 = x1;
    this.x2 = x2;
  }

  public void zombieDied() {
    syncActiveCap();
    if (count < activeCap) {
      count++;
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    syncActiveCap();

    if (main.timeFrozen > 0) {
      return true;
    }

    if (main.simon.x < x1 || main.simon.x > x2) {
      return true;
    }

    if (delay == 0) {
      delay = main.adjustEnemySpawnDelay(273);

      for(int i = 0; i < 16 && count > 0; i++) {
        if (main.random.nextBoolean()) {
          int target = main.camera + 514 + ((count - 1) << 6);
          if (target >= x1 && target <= x2) {
            count--;
            main.pushThing(new Zombie(main, target, y,
               Main.LEFT, this));
          }
        } else {
          int target = main.camera - 66 - ((count - 1) << 6);
          if (target >= x1 && target <= x2) {
            count--;
            main.pushThing(new Zombie(main, target, y,
               Main.RIGHT, this));
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

  private void syncActiveCap() {
    int newActiveCap = main.adjustEnemyActiveCap(BASE_ACTIVE_CAP);
    if (newActiveCap == activeCap) {
      return;
    }
    count += newActiveCap - activeCap;
    if (count < 0) {
      count = 0;
    } else if (count > newActiveCap) {
      count = newActiveCap;
    }
    activeCap = newActiveCap;
  }
}
