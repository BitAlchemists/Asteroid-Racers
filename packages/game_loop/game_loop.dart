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

library game_loop;
import 'dart:html';
import 'dart:json';

part 'src/game_loop/game_loop.dart';
part 'src/game_loop/game_loop_digital_input.dart';
part 'src/game_loop/game_loop_position_input.dart';
part 'src/game_loop/game_loop_analog_input.dart';
part 'src/game_loop/game_loop_keyboard.dart';
part 'src/game_loop/game_loop_mouse.dart';
part 'src/game_loop/game_loop_gamepad.dart';
part 'src/game_loop/game_loop_timer.dart';
part 'src/game_loop/game_loop_pointer_lock.dart';