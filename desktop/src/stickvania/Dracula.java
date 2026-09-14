package stickvania;

import org.newdawn.slick.*;

public class Dracula extends Thing {

  public static final float RISE_FADE_FRACTION = 1.0f / 80.0f;
  public static final float FADE_IN_FRACTION = 1.0f / 91.0f;
  public static final float FADE_TO_BATS_FRACTION = 1.0f / 45.0f;
  public static final float ANGLE_SCALE = (float)(Math.PI / 182f);
  public static final float JUMP_VELOCITY 
      = -(float)(Math.sqrt(Main.GRAVITY * 256));
  public static final int JUMP_TIME = 71;
  public static final float DIE_FRACTION = 1f / 910.0f;

  public static final int STATE_RESTING = 0;
  public static final int STATE_HEAD_RISING = 1;
  public static final int STATE_BODY_FADE_IN = 2;
  public static final int STATE_FIRING = 3;
  public static final int STATE_FADE_TO_BATS = 4;
  public static final int STATE_BATS_MOVING = 5;
  public static final int STATE_FADE_TO_DRACULA = 6;
  public static final int STATE_FADE_TO_MONSTER = 7;
  public static final int STATE_FADE_TO_BATS_2 = 8;
  public static final int STATE_CROUCHED = 9;
  public static final int STATE_STANDING_UP = 10;
  public static final int STATE_STANDING = 11;
  public static final int STATE_JUMPING = 12;
  public static final int STATE_DYING = 13;

  private DraculaBat[] draculaBats = new DraculaBat[16];
  private int state = STATE_RESTING;
  private int direction = Main.LEFT;
  private float headY;
  private int fadeIn;
  private boolean capeOpen = false;
  private int firingDelay;
  private int fadeToBats;
  private float targetX;
  private float batVx;
  private int batsMoving;
  private int fadeToDracula;
  private int stunned;
  private int hits = 32;
  private boolean releasedFoodOrb;
  private boolean releasedFoodOrb2;
  private boolean monsterForm;
  private int monsterDelay;
  private int dying;
  private int dieBatDelay;

  public Dracula(Main main, float x, float y) {
    super(main, 48, 96);
    this.x = x;
    this.y = y;

    headY = y + 64;

    for(int i = draculaBats.length - 1; i >= 0; i--) {
      draculaBats[i] = new DraculaBat(main);
    }
  }

  private boolean headHit() {
    if (direction == Main.LEFT) {
      int x1 = (int)x + 11;
      int y1 = (int)y - 16;
      int x2 = (int)x + 26;
      int y2 = (int)y + 15;
      return main.intersectsWhip(x1, y1, x2, y2)
          || main.intersectsWeapon(x1, y1, x2, y2);
    } else {
      int x1 = (int)x + 21;
      int y1 = (int)y - 16;
      int x2 = (int)x + 36;
      int y2 = (int)y + 15;
      return main.intersectsWhip(x1, y1, x2, y2)
          || main.intersectsWeapon(x1, y1, x2, y2);
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (state != STATE_DYING) {
      direction = x > (main.simon.x + 8) ? Main.LEFT : Main.RIGHT;
    }
    if (stunned > 0) {
      stunned--;
    }

    if (state >= STATE_CROUCHED && state <= STATE_JUMPING) {
      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }
      if (stunned == 0 && (main.intersectsWhip(this)
          || main.intersectsWeapon(this))) {
        stunned = 100;
        main.playSound(main.boss_hurt);
        main.pushThing(new Spark(main, this));
        if (hits > 0) {
          hits--;
          main.enemyPower = hits >> 1;
          if (hits == 1) {
            main.enemyPower = 1;
          }
        }
      }
      if (hits == 0 && state == STATE_STANDING) {
        main.killAll();
        state = STATE_FADE_TO_BATS_2;
        main.playSound(main.dracula_to_bats);
        monsterForm = false;
        fadeToBats = 0;
        targetX = 232;
        batVx = (200 - x) / 182f;
        int batDirection = batVx > 0 ? Main.RIGHT : Main.LEFT;
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          DraculaBat draculaBat = draculaBats[i];
          draculaBat.direction = batDirection;
        }
      }
    }

    switch(state) {
      case STATE_RESTING:
        if (main.simon.x - main.simon.xMin < 150) {
          main.killAll();
          main.simon.xMax = 512;
          state = STATE_HEAD_RISING;
        }
        break;
      case STATE_HEAD_RISING:
        if (headY > y - 16) {
          headY -= 0.5f;
        } else {
          state = STATE_BODY_FADE_IN;
        }
        break;
      case STATE_BODY_FADE_IN:
        if (++fadeIn == 91) {
          firingDelay = 0;
          state = STATE_FIRING;
        }
        break;
      case STATE_FIRING:
        if (main.intersectsSimon(this)) {
          main.hurtSimon(2);
        }
        if (firingDelay++ == 0) {
          capeOpen = true;
          if (!releasedFoodOrb2 && hits <= 16) {
            monsterForm = true;
            releasedFoodOrb2 = true;
            main.pushThing(new FoodOrb(main, x + 24, y + 24));
            main.playSound(main.thunder);
            main.requestSong(main.stage_1_2);
          } else if (!releasedFoodOrb && hits <= 24) {
            releasedFoodOrb = true;
            main.pushThing(new FoodOrb(main, x + 24, y + 24));
            main.playSound(main.thunder);
          } else {
            main.pushThing(new Fireball(main, x + 24,
                main.random.nextBoolean() ? y + 70 : y + 48,
                direction == Main.LEFT ? -1.5f : 1.5f, 0));
            if (hits <= 24) {
              main.playSound(main.thunder);
              Ghost ghost = new Ghost(main, x - 96, y + 64);
              ghost.active = true;
              ghost.hits = 1;
              main.pushThing(ghost);
              ghost = new Ghost(main, x + 112, y + 64);
              ghost.active = true;
              ghost.hits = 1;
              main.pushThing(ghost);
            }
          }
          
          if (x < 224) {
            targetX = 224 + main.random.nextInt(208);
          } else {
            targetX = 16 + main.random.nextInt(208);
          }
          batVx = (targetX - x) / 182f;
          int batDirection = batVx > 0 ? Main.RIGHT : Main.LEFT;
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            DraculaBat draculaBat = draculaBats[i];
            draculaBat.direction = batDirection;
          }
        } else if (firingDelay == 91) {
          fadeToBats = 0;
          state = STATE_FADE_TO_BATS;
          main.playSound(main.dracula_to_bats);
        } else {
          if (stunned == 0 && headHit()) {
            stunned = 100;
            main.playSound(main.boss_hurt);
            main.pushThing(new Spark(main, x + 11, y - 16, 16, 32));
            if (hits > 0) {
              hits--;
              main.enemyPower = hits >> 1;
              if (hits == 1) {
                main.enemyPower = 1;
              } 
            }
          } 
        }
        break;
      case STATE_FADE_TO_BATS:
        if (fadeToBats++ == 0) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            DraculaBat draculaBat = draculaBats[i];
            draculaBat.x = x + main.random.nextInt(96) - 48;
            draculaBat.Y = draculaBat.y = y - 16 + main.random.nextInt(80);
            draculaBat.amplitude = main.random.nextInt(352) - 176;
          }
        } else if (fadeToBats < 45) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            draculaBats[i].update(gc);
          }
        } else {
          state = STATE_BATS_MOVING;
          x = targetX;
          if (monsterForm) {
            y -= 64;
          }
          batsMoving = 0;
        }
        break;
      case STATE_FADE_TO_BATS_2:
        if (fadeToBats++ == 0) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            DraculaBat draculaBat = draculaBats[i];
            draculaBat.x = x + main.random.nextInt(96) - 16;
            draculaBat.Y = draculaBat.y = 48 + y + main.random.nextInt(80);
            draculaBat.amplitude = main.random.nextInt(352) - 176;
          }
        } else if (fadeToBats < 45) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            draculaBats[i].update(gc);
          }
        } else {
          state = STATE_BATS_MOVING;
          x = targetX;
          y += 64;
          batsMoving = 0;
        }
        break;
      case STATE_BATS_MOVING:
        if (++batsMoving < 182) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            DraculaBat draculaBat = draculaBats[i];
            draculaBat.x += batVx;
            draculaBat.y = draculaBat.Y + (float)(draculaBat.amplitude
                * Math.sin(ANGLE_SCALE * batsMoving));
            draculaBats[i].update(gc);
          }
        } else {
          if (monsterForm) {
            state = STATE_FADE_TO_MONSTER;
          } else {
            state = STATE_FADE_TO_DRACULA;
          }
          fadeToDracula = 0;
        }
        break;
      case STATE_FADE_TO_DRACULA:
        if (++fadeToDracula < 45) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            draculaBats[i].update(gc);
          }
        } else {
          if (hits == 0) {
            state = STATE_DYING;
            main.requestMusic(main.dracula_dead);
          } else {
            firingDelay = 0;
            state = STATE_FIRING;
          }
        }
        break;
      case STATE_FADE_TO_MONSTER:
        if (++fadeToDracula < 45) {
          for(int i = draculaBats.length - 1; i >= 0; i--) {
            draculaBats[i].update(gc);
          }
        } else {
          firingDelay = 0;
          state = STATE_CROUCHED;
          monsterDelay = 45;
        }
        break;
      case STATE_CROUCHED:
        rx1 = 0;
        rx2 = 95;
        ry1 = 64;
        ry2 = 157;
        if (--monsterDelay == 0) {
          rx1 = 0;
          rx2 = 95;
          ry1 = 32;
          ry2 = 159;
          state = STATE_STANDING_UP;
          monsterDelay = 45;
          vy = -4f;
        }
        break;
      case STATE_STANDING_UP:
        applyGravity();
        if (supported) {
          monsterDelay = 45;
          state = STATE_STANDING;
        }
        break;
      case STATE_STANDING:
        if (--monsterDelay == 0) {
          state = STATE_JUMPING;
          vy = JUMP_VELOCITY;
          targetX = main.simon.x + main.random.nextInt(128) - 80;
          vx = (targetX - x) / JUMP_TIME;
        }
        break;
      case STATE_JUMPING:
        moveX(vx);
        applyGravity();
        if (supported) {
          main.playSound(main.lands);
          state = STATE_CROUCHED;
          monsterDelay = 45;
        }
        break;
      case STATE_DYING:
        if (++dying == 910) {
          main.addPoints(50000);
          main.pushThing(new Orb(main, main.simon.xMin + 240, 96, 91));
          return false;
        }
        if (dieBatDelay == 0) {
          dieBatDelay = 45;
          main.pushThing(new DieBat(main, 
              x + main.random.nextInt(80) - 32,
              y + main.random.nextInt(64)));
        } else {
          dieBatDelay--;
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {

    switch(state) {
      case STATE_RESTING:
        break;
      case STATE_HEAD_RISING:
        main.drawFaded(main.draculaBoss[direction][0], x + 11, headY,
            1f - RISE_FADE_FRACTION * (headY - (y - 16)));
        break;
      case STATE_BODY_FADE_IN:
        main.draw(main.draculaBoss[direction][0], x + 11, y - 16);
        main.drawFaded(main.draculaBoss[direction][1], x, y,
            fadeIn * FADE_IN_FRACTION);
        break;
      case STATE_FADE_TO_BATS: {
        float fade = fadeToBats * FADE_TO_BATS_FRACTION;
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          draculaBats[i].render(gc, g, fade);
        }
        fade = 1f - fade;
        if (direction == Main.LEFT) {
          main.drawFaded(main.draculaBoss[direction][0], x + 11, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        } else {
          main.drawFaded(main.draculaBoss[direction][0], x + 21, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        }
        break;
      }
      case STATE_FADE_TO_BATS_2: {
        float fade = fadeToBats * FADE_TO_BATS_FRACTION;
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          draculaBats[i].render(gc, g, fade);
        }
        main.drawFaded(main.draculaBoss[direction][4], x, y, 1f - fade);
        break;
      }
      case STATE_BATS_MOVING:
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          draculaBats[i].render(gc, g);
        }
        break;
      case STATE_FADE_TO_DRACULA: {
        float fade = fadeToDracula * FADE_TO_BATS_FRACTION;
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          draculaBats[i].render(gc, g, 1f - fade);
        }
        if (direction == Main.LEFT) {
          main.drawFaded(main.draculaBoss[direction][0], x + 11, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        } else {
          main.drawFaded(main.draculaBoss[direction][0], x + 21, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        }
        break;
      }
      case STATE_FADE_TO_MONSTER: {
        float fade = fadeToDracula * FADE_TO_BATS_FRACTION;
        for(int i = draculaBats.length - 1; i >= 0; i--) {
          draculaBats[i].render(gc, g, 1f - fade);
        }
        main.drawFaded(main.draculaBoss[direction][6], x, y + 35, fade);
        break;
      }
      case STATE_CROUCHED:
        main.draw(main.draculaBoss[direction][6], x, y + 35);
        break;
      case STATE_STANDING_UP:
        main.draw(main.draculaBoss[direction][5], x, y);
        break;
      case STATE_STANDING:
        main.draw(main.draculaBoss[direction][4], x, y);
        break;
      case STATE_JUMPING:
        main.draw(main.draculaBoss[direction][3], x, y);
        break;
      case STATE_DYING: {
        float fade = 1f - dying * DIE_FRACTION;
        if (direction == Main.LEFT) {
          main.drawFaded(main.draculaBoss[direction][0], x + 11, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        } else {
          main.drawFaded(main.draculaBoss[direction][0], x + 21, y - 16, fade);
          main.drawFaded(main.draculaBoss[direction][1], x, y, fade);
        }
        break;
      }
      default:
        if (direction == Main.LEFT) {
          if (capeOpen) {
            main.draw(main.draculaBoss[direction][0], x + 12, y - 16);
            main.draw(main.draculaBoss[direction][2], x, y);
          } else {
            main.draw(main.draculaBoss[direction][0], x + 11, y - 16);
            main.draw(main.draculaBoss[direction][1], x, y);
          }
        } else {
          if (capeOpen) {
            main.draw(main.draculaBoss[direction][0], x + 20, y - 16);
            main.draw(main.draculaBoss[direction][2], x - 16, y);
          } else {
            main.draw(main.draculaBoss[direction][0], x + 21, y - 16);
            main.draw(main.draculaBoss[direction][1], x, y);
          }
        }
        break;
    }
  }
}
