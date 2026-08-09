package stickvania;

import org.newdawn.slick.*;

public class BoneDragonVertebra extends Thing {

  public float tx;
  public float ty;
  public float angle;

  public BoneDragonVertebra(Main main, float x, float y) {
    super(main, 16, 32);
    this.x = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.boneDragons[2], x, y, angle);
  }
}
