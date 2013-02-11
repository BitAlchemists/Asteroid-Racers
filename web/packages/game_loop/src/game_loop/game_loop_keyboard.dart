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

/** A keyboard input. Has digital buttons corresponding to keyboard keys.
 */
class GameLoopKeyboard extends GameLoopDigitalInput {
  /** The A key. */
  static const A = KeyCode.A;
  /** The B key. */
  static const B = KeyCode.B;
  /** The C key. */
  static const C = KeyCode.C;
  /** The D key. */
  static const D = KeyCode.D;
  /** The E key. */
  static const E = KeyCode.E;
  /** The F key. */
  static const F = KeyCode.F;
  /** The G key. */
  static const G = KeyCode.G;
  /** The H key. */
  static const H = KeyCode.H;
  /** The I key. */
  static const I = KeyCode.I;
  /** The J key. */
  static const J = KeyCode.J;
  /** The K key. */
  static const K = KeyCode.K;
  /** The L key. */
  static const L = KeyCode.L;
  /** The M key. */
  static const M = KeyCode.M;
  /** The N key. */
  static const N = KeyCode.N;
  /** The O key. */
  static const O = KeyCode.O;
  /** The P key. */
  static const P = KeyCode.P;
  /** The Q key. */
  static const Q = KeyCode.Q;
  /** The R key. */
  static const R = KeyCode.R;
  /** The S key. */
  static const S = KeyCode.S;
  /** The T key. */
  static const T = KeyCode.T;
  /** The U key. */
  static const U = KeyCode.U;
  /** The V key. */
  static const V = KeyCode.V;
  /** The W key. */
  static const W = KeyCode.W;
  /** The X key. */
  static const X = KeyCode.X;
  /** The Y key. */
  static const Y = KeyCode.Y;
  /** The Z key. */
  static const Z = KeyCode.Z;
  /** The Shift key. */
  static const SHIFT = KeyCode.SHIFT;
  /** The Control key. */
  static const CTRL = KeyCode.CTRL;
  /** The Alt key. */
  static const ALT = KeyCode.ALT;
  /** The Space key. */
  static const SPACE = KeyCode.SPACE;
  /** The Zero key. */
  static const ZERO = KeyCode.ZERO;
  /** The One key. */
  static const ONE = KeyCode.ONE;
  /** The Two key. */
  static const TWO = KeyCode.TWO;
  /** The Three key. */
  static const THREE = KeyCode.THREE;
  /** The Four key. */
  static const FOUR = KeyCode.FOUR;
  /** The Five key. */
  static const FIVE = KeyCode.FIVE;
  /** The Six key. */
  static const SIX = KeyCode.SIX;
  /** The Seven key. */
  static const SEVEN = KeyCode.SEVEN;
  /** The Eight key. */
  static const EIGHT = KeyCode.EIGHT;
  /** The Nine key. */
  static const NINE = KeyCode.NINE;
  /** The Tilde key. */
  static const TILDE = KeyCode.TILDE;
  /** The Enter key. */
  static const ENTER = KeyCode.ENTER;
  /** The Up key. */
  static const UP = KeyCode.UP;
  /** The Down key. */
  static const DOWN = KeyCode.DOWN;
  /** The Left key. */
  static const LEFT = KeyCode.LEFT;
  /** The Right key. */
  static const RIGHT = KeyCode.RIGHT;
  static final List<int> _buttonIds = [A, B, C,
                               D, E, F,
                               G, H, I,
                               J, K, L,
                               M, N, O,
                               P, Q, R,
                               S, T, U,
                               V, W, X,
                               Y, Z,
                               SHIFT,
                               CTRL,
                               ALT,
                               SPACE,
                               ZERO,
                               ONE,
                               TWO,
                               THREE,
                               FOUR,
                               FIVE,
                               SIX,
                               SEVEN,
                               EIGHT,
                               NINE,
                               TILDE,
                               ENTER,
                               UP,
                               DOWN,
                               LEFT,
                               RIGHT
                               ];

  GameLoopKeyboard(gameLoop) : super(gameLoop, _buttonIds);
}