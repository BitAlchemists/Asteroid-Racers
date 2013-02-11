/*
  Copyright (C) 2012 John McCutchan <john@johnmccutchan.com>

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.
*/

part of game_loop;

/** The state of a digital button: frame and time when button was
 * last pressed and released.
 */
class GameLoopDigitalButton {
  /** buttonId */
  final int buttonId;
  /** Frame when button was last pressed. */
  int framePressed = 0;
  /** Frame when button was last released. */
  int frameReleased = 0;
  /** Time when button was last pressed. */
  double timePressed = 0.0;
  /** Time when button was last released. */
  double timeReleased = 0.0;
  GameLoopDigitalButton(this.buttonId);

  /** Is button down in this frame? */
  bool get down => framePressed > frameReleased;
  /** Is button up in this frame? */
  bool get up => frameReleased >= framePressed;
}

class GameLoopDigitalButtonEvent {
  final bool down;
  final int frame;
  final int buttonId;
  final double time;

  GameLoopDigitalButtonEvent(this.buttonId, this.down, this.frame, this.time);

  String toString() => 'Button: $buttonId DOWN: $down [$frame@$time]';
}

/** A collection of digital input buttons */
class GameLoopDigitalInput {
  /** Game loop this digital input belongs to. */
  final GameLoop gameLoop;
  /** Buttons this digital input knows about */
  final Map<int, GameLoopDigitalButton> buttons =
      new Map<int, GameLoopDigitalButton>();

  /** Create a digital input that supports all buttons in buttonIds. */
  GameLoopDigitalInput(this.gameLoop, List<int> buttonIds) {
    for (int buttonId in buttonIds) {
      buttons[buttonId] = new GameLoopDigitalButton(buttonId);
    }
  }

  /** Deliver an input event */
  void digitalButtonEvent(GameLoopDigitalButtonEvent event) {
    GameLoopDigitalButton button = buttons[event.buttonId];
    if (button == null) {
      return;
    }
    if (event.down) {
      if (button.down == false) {
        // Ignore repeated downs.
        button.framePressed = event.frame;
        button.timePressed = event.time;
      }
    } else {
      button.frameReleased = event.frame;
      button.timeReleased = event.time;
    }
  }

  /** Is [buttonId] down this frame? */
  bool isDown(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return false;
    }
    return button.down;
  }

  /** Was [buttonId] just pressed down? */
  bool pressed(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return false;
    }
    return button.framePressed == gameLoop.frame;
  }

  /** Was [buttonId] just released? */
  bool released(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return false;
    }
    return button.frameReleased == gameLoop.frame;
  }

  /** Is [buttonId] up this frame? */
  bool isUp(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return true;
    }
    return button.up;
  }

  /** Time [buttonId] was pressed. */
  double timePressed(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return 0.0;
    }
    return button.timePressed;
  }

  /** Time [buttonId] was released. */
  double timeReleased(int buttonId) {
    GameLoopDigitalButton button = buttons[buttonId];
    if (button == null) {
      return 0.0;
    }
    return button.timeReleased;
  }
}