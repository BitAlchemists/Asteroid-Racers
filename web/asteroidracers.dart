library asteroidracers;

//import 'package:god_engine/god_engine.dart';
import 'package:game_loop/game_loop_html.dart';

import 'dart:html';

import '../lib/client/ar_client.dart';


/**
 * The entry point to the application.
 */
void main() {  
  CanvasElement canvas = query('#gamecanvas');
  canvas.width = canvas.clientWidth;
  runClient(canvas);
}


double fpsAverage;

/**
 * Display the animation's FPS in a div.
 */
void showFps(num fps) {
  
  if (fpsAverage == null) {
    fpsAverage = fps;
  }

  fpsAverage = fps * 0.05 + fpsAverage * 0.95;

  query("#notes").text = "${fpsAverage.round().toInt()} fps";
}