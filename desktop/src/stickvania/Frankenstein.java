package stickvania;

import org.newdawn.slick.*;

public class Frankenstein extends Thing {

  public static final float IGOR_JUMP_VELOCITY
      = -(float)Math.sqrt(384 * Main.GRAVITY);
  public static final float FLY_TIME
      = 2f * Math.abs(IGOR_JUMP_VELOCITY) / Main.GRAVITY;
  public static final float DYING_FADE
      = 1f / 455f;

  public static final int STATE_INACTIVE = 0;
  public static final int STATE_WALKING = 1;
  public static final int STATE_PAUSED = 2;
  public static final int STATE_DEAD = 3;

  private int state = STATE_INACTIVE;
  private int direction = Main.LEFT;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int walkSteps;
  private int maxWalkSteps;
  private int paused;
  private int stunned;
  private int throwDelay;
  private int deadCount;

  public Frankenstein(Main main, float x, float y) {
    super(main, 32, 96);
    this.x = x;
    this.y = y;
    maxWalkSteps = main.random.nextInt(91) + 91;    
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (state == STATE_WALKING || state == STATE_PAUSED) {
      direction = main.simon.x + 16 < x ? Main.LEFT : Main.RIGHT;
      
      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }

      if (stunned == 0) {
        if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
          main.pushThing(new Spark(main, this));
          stunned = 45;
          main.playSound(main.boss_hurt);

          if (--main.enemyPower <= 0) {
            main.enemyPower = 0;
            state = STATE_DEAD;
            main.fireSparks(x, y + 32);
            main.killAll();
            main.playSound(main.boss_killed_1);
            main.stopSong();
            main.addPoints(5000);
          }
        }
      } else {
        stunned--;
      }
    }

    switch(state) {
      case STATE_INACTIVE:
        if (main.simon.xMax - main.simon.x < 250) {
          main.killAll();
          main.requestSong(main.boss_2);
          main.simon.xMin = main.simon.xMax - 512;
          state = STATE_WALKING;
        }
        break;
      case STATE_WALKING:
        if (throwDelay > 0) {
          throwDelay--;
        } else {
          throwDelay = main.random.nextInt(273) + 91;
          Igor igor = new Igor(main, x, y - 32);
          igor.vx = (main.simon.x + 16 - x) / FLY_TIME;
          if (igor.vx < 0) {
            igor.direction = Main.LEFT;
          } else {
            igor.direction = Main.RIGHT;
          }
          igor.vy = IGOR_JUMP_VELOCITY;
          main.pushThing(igor);
        }
        if (walkSteps++ == 0) {
          if (direction == Main.LEFT) {
            float targetX = main.simon.x + 48 + main.random.nextInt(128);
            if (targetX > main.simon.xMax - 32) {
              targetX = main.simon.xMax - 32;
            }
            vx = (targetX - x) / maxWalkSteps;
          } else {
            float targetX = main.simon.x - 16 - main.random.nextInt(128);
            if (targetX < main.simon.xMin) {
              targetX = main.simon.xMin;
            }
            vx = (targetX - x) / maxWalkSteps;
          }
        } else if (walkSteps == maxWalkSteps) {
          paused = 1 + main.random.nextInt(91);
          state = STATE_PAUSED;
        } else {
          x += vx;
          if (++spriteIndexIncrementor == 20) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 3) {
              spriteIndex = 0;
            }
          }
        }
        break;
      case STATE_PAUSED:
        if (--paused == 0) {
          state = STATE_WALKING;
          walkSteps = 0;
          maxWalkSteps = main.random.nextInt(91) + 91;
        }
        break;
      case STATE_DEAD:
        if (deadCount < 455) {
          if ((deadCount & 7) == 0) {
            main.pushThing(new Flame(main, x, y + main.random.nextInt(80),
                main.random.nextFloat() * 2f - 1f,
                main.random.nextFloat() * 2f - 1f,
                main.random.nextFloat() * 0.1f - 0.05f, 90, 91));
          }
          deadCount++;
        } else {
          main.pushThing(new Orb(main, main.simon.xMin + 240, 96, 273));
          return false;
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state == STATE_DEAD) {
      main.drawFaded(main.frankensteinBoss[direction][spriteIndex], x, y,
          1f - deadCount * DYING_FADE);
    } else {
      main.draw(main.frankensteinBoss[direction][spriteIndex], x, y);
    }
  }
}
