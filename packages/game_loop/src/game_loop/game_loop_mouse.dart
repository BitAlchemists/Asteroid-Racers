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

class GameLoopMouseEvent {
  final int x;
  final int y;
  final int dx;
  final int dy;
  final double time;
  final int frame;
  GameLoopMouseEvent(this.x, this.y, this.dx, this.dy, this.time, this.frame);
}

/** A mouse input. Has digital buttons corresponding to mouse buttons:
 * [LEFT], [MIDDLE], [RIGHT]. Also implements the [GameLoopPositionInput]
 * interface.
 */
class GameLoopMouse extends GameLoopDigitalInput
    implements GameLoopPositionInput {
  /** Left mouse button */
  static const LEFT = 0;
  /** Middle mouse button */
  static const MIDDLE = 1;
  /** Right mouse button */
  static const RIGHT = 2;
  static final List<int> _buttonIds = [LEFT, MIDDLE, RIGHT];


  int _dx = 0;
  /** Mouse movement in x direction since previous frame. */
  int get dx => _dx;

  int _dy = 0;
  /** Mouse movement in y direction since previous frame. */
  int get dy => _dy;


  int _x = 0;
  /** Mouse position in x direction within element. */
  int get x => _x;

  int _y = 0;
  /** Mouse position in y direction within element. */
  int get y => _y;


  double _time = 0.0;
  /** Time at which mouse position was last updated. */
  double get time => _time;


  int _frame  = 0;
  /** Frame at which mouse position was last updated. */
  int get frame => _frame;

  GameLoopMouse(gameLoop) : super(gameLoop, _buttonIds);

  /** Process one [GameLoopMouseEvent]. */
  void gameLoopMouseEvent(GameLoopMouseEvent event) {
    _x = event.x;
    _y = event.y;
    _time = event.time;
    _frame = event.frame;
    _dx += event.dx;
    _dy += event.dy;
  }

  void _resetAccumulators() {
    _dx = 0;
    _dy = 0;
  }
}
