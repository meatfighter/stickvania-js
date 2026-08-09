package stickvania;

import org.newdawn.slick.*;

public class Bird extends Thing {
  
  private int direction;
  private BirdSpawner birdSpawner;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private boolean dropped;

  public Bird(Main main, float x, float y, int direction,
      BirdSpawner birdSpawner) {
    super(main, 64, 64);
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.birdSpawner = birdSpawner;

    vx = direction == Main.LEFT ? -4f : 4f;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, -0.9f, 0, -0.06f, 0, 10));
      main.pushThing(new Flame(main, x + 32, y, 1, 0, -0.08f, 0, 10));
      main.pushThing(new Flame(main, x, y + 32, 0, 0, 0.05f, 0, 10));
      main.pushThing(new Flame(main, x + 32, y + 32, 0, 0, 0.08f, 0, 10));
      main.addPoints(300);
      birdSpawner.birdDied();
      main.playSound(main.killed_2);
      return false;
    }

    if (main.timeFrozen == 0) {

      x += vx;
      vx *= 0.95;
      if (++spriteIndexIncrementor == 46) {
        spriteIndexIncrementor = 0;
        if (++spriteIndex == 2) {
          spriteIndex = 0;
        }
        vx = direction == Main.LEFT ? -4f : 4f;
        main.playSound(main.wing_flaps);
      }

      if (x < main.camera - 96 || x > main.camera + 608) {
        birdSpawner.birdDied();
        return false;
      }

      if (!dropped && Math.abs(main.simon.x + 16 - x) < 128) {
        int X = (int)x + 16;
        int Y = (int)y + 56;
        if (main.getWall(X, Y) == Main.WALL_EMPTY
            && main.getWall(X + 32, Y) == Main.WALL_EMPTY
            && main.getWall(X, Y + 32) == Main.WALL_EMPTY
            && main.getWall(X + 32, Y + 32) == Main.WALL_EMPTY) {
          dropped = true;
          main.pushThing(new Igor(main, X, Y));
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
    main.draw(main.birds[direction][spriteIndex], x, y);
    if (!dropped) {
      main.draw(main.igors[direction][0], x + 16, y + 56);
    }
  }
}
