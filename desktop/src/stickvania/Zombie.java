package stickvania;

import org.newdawn.slick.*;

public class Zombie extends Thing {

  private int spriteIndexIncrementor;
  private int spriteIndex;
  private int direction;
  private ZombieSpawner zombieSpawner;

  public Zombie(Main main, float x, float y, int direction,
      ZombieSpawner zombieSpawner) {
    super(main, 1, 0, 30, 64);
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.zombieSpawner = zombieSpawner;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      if (main.random.nextBoolean()) {
        main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
      }
      main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
      zombieSpawner.zombieDied();
      main.addPoints(100);
      main.playSound(main.zombie_killed);
      return false;
    }

    if (y > 352 || x < main.camera - 320 || x > main.camera + 768) {
      zombieSpawner.zombieDied();
      return false;
    }

    if (main.timeFrozen == 0) {
      if (++spriteIndexIncrementor == 45) {
        spriteIndexIncrementor = 0;
        if (++spriteIndex == 2) {
          spriteIndex = 0;
        }
      }

      applyGravity();

      if (direction == Main.LEFT) {
        if (supported && !moveX(-1f)) {
          direction = Main.RIGHT;
        }
      } else {
        if (supported && !moveX(1f)) {
          direction = Main.LEFT;
        }
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.zombies[direction][spriteIndex], x, y);
  }
}
