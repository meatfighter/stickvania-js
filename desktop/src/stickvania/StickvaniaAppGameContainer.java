/*
 * Stickvania
 * Copyright (C) 2010 meatfighter.com
 *
 * This file is part of Stickvania
 *
 * Stickvania is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * Stickvania is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

package stickvania;

import org.lwjgl.LWJGLException;
import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.DisplayMode;
import org.newdawn.slick.AppGameContainer;
import org.newdawn.slick.Color;
import org.newdawn.slick.Game;
import org.newdawn.slick.Graphics;
import org.newdawn.slick.SlickException;
import org.newdawn.slick.opengl.InternalTextureLoader;

public class StickvaniaAppGameContainer extends AppGameContainer {

  public StickvaniaAppGameContainer(Game game) throws SlickException {
    super(game);
  }

  public StickvaniaAppGameContainer(
      Game game, int width, int height, boolean fullscreen)
      throws SlickException {
    super(game, width, height, fullscreen);
  }

  public void setNativeFullscreenDisplayMode(DisplayMode displayMode)
      throws SlickException {
    if (displayMode == null) {
      throw new SlickException("Native fullscreen display mode not set.");
    }
    if (Display.isFullscreen() && isCurrentDisplayMode(displayMode)) {
      return;
    }

    Color oldBackground = null;
    Graphics graphics = getGraphics();
    if (graphics != null) {
      Graphics.setCurrent(graphics);
      oldBackground = graphics.getBackground();
    }

    try {
      targetDisplayMode = displayMode;
      width = displayMode.getWidth();
      height = displayMode.getHeight();

      Display.setDisplayModeAndFullscreen(displayMode);

      if (Display.isCreated()) {
        initGL();
        onResize();
      }
      if (oldBackground != null && graphics != null) {
        graphics.setBackground(oldBackground);
      }
      if (targetDisplayMode.getBitsPerPixel() == 16) {
        InternalTextureLoader.get().set16BitMode();
      }
    } catch(LWJGLException e) {
      throw new SlickException("Unable to setup native fullscreen mode "
          + displayMode.getWidth() + "x" + displayMode.getHeight(), e);
    }

    getDelta();
  }

  private boolean isCurrentDisplayMode(DisplayMode displayMode) {
    DisplayMode current = Display.getDisplayMode();
    return current.getWidth() == displayMode.getWidth()
        && current.getHeight() == displayMode.getHeight()
        && current.getBitsPerPixel() == displayMode.getBitsPerPixel()
        && current.getFrequency() == displayMode.getFrequency();
  }
}
