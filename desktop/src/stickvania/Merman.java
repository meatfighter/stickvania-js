package stickvania;

import org.newdawn.slick.*;

public class Merman extends Thing {

  private int spriteIndexIncrementor;
  private int spriteIndex;
  private int direction;
  private int shootDelay;
  private int shooting;
  private MermanSpawner mermanSpawner;

  public Merman(Main main, float x, float vy, MermanSpawner mermanSpawner) {
    super(main, 1, 0, 30, 64);

    this.x = x;
    this.y = 352;
    this.vy = vy;
    this.mermanSpawner = mermanSpawner;
    this.direction = (main.simon.x < x) ? Main.LEFT : Main.RIGHT;

    shootDelay = main.random.nextInt(45) + 45;

    main.pushThing(new Droplets(main, x + 8, 352, -1f, -5.5f));
    main.pushThing(new Droplets(main, x + 8, 352, 1f, -5f));
    main.pushThing(new Droplets(main, x + 8, 352, 0.2f, -8f));

    main.playSound(main.splash);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      if (main.random.nextBoolean()) {
        main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
      }
      main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
      mermanSpawner.mermanDied();
      main.addPoints(300);
      main.playSound(main.killed_1);
      return false;
    }

    if ((vy > 0 && y > 352)
        || x < main.camera - 64 || x > main.camera + 576) {
      mermanSpawner.mermanDied();
      if (vy > 0 && y > 352) {
        main.pushThing(new Droplets(main, x + 8, 352, -1f, -5.5f));
        main.pushThing(new Droplets(main, x + 8, 352, 1f, -5f));
        main.pushThing(new Droplets(main, x + 8, 352, 0.2f, -8f));
        main.playSound(main.splash);
      }
      return false;
    }

    if (main.timeFrozen == 0) {

      applyGravity();

      if (supported) {
        if (shooting > 0) {
          spriteIndex = 2;
          if (--shooting == 0) {
            direction = (direction == Main.LEFT) ? Main.RIGHT : Main.LEFT;
            spriteIndex = 0;
            spriteIndexIncrementor = 0;
          }
        } else {
          if (++spriteIndexIncrementor == 30) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 2) {
              spriteIndex = 0;
            }
          }

          if (direction == Main.LEFT) {
            if (!moveX(-1f)) {
              direction = Main.RIGHT;
            }
          } else {
            if (!moveX(1f)) {
              direction = Main.LEFT;
            }
          }

          if (--shootDelay == 0) {
            shootDelay = main.random.nextInt(273) + 91;
            shooting = 70;
            main.pushThing(new Fireball(main, x + 8, y + 18,
                (direction == Main.LEFT) ? -1.5f : 1.5f, 0));
            main.playSound(main.merman_spit);
          }
        }

      } else {
        spriteIndex = 0;
        direction = (main.simon.x < x) ? Main.LEFT : Main.RIGHT;
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.mermen[direction][spriteIndex], x, y);
  }
}
