library asteroidracers;

import 'dart:html';
import 'dart:math';

part 'movable.dart';

/**
 * The entry point to the application.
 */
void main() {
  var solarSystem = new SolarSystem(query("#container"));
  solarSystem.start();
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

class Point {
  num x, y;

  Point(this.x, this.y);
}

class Vector {
  num x, y;
  Vector(this.x, this.y);
}

/**
 * A representation of the solar system.
 *
 * This class maintains a list of planetary bodies, knows how to draw its
 * background and the planets, and requests that it be redraw at appropriate
 * intervals using the [Window.requestAnimationFrame] method.
 */
class SolarSystem {
  CanvasElement canvas;

  num _width;
  num _height;

  Movable player;
  List<Movable> movables;

  num renderTime;

  SolarSystem(this.canvas) {
    movables = new List<Movable>();
  }

  num get width => _width;

  num get height => _height;
  num dt; //delta time

  start() {
    // Measure the canvas element.
    window.setImmediate(() {
      _width = (canvas.parent as Element).clientWidth;
      _height = (canvas.parent as Element).clientHeight;

      canvas.width = _width;

      // Initialize the planets and start the simulation.
      _start();
    });
  }

  _start() {
    // Create the Sun.
    addAsteroidBelt(30);
    player = new Movable(this, "Sun", "#ff2", 10, new Point(0,0), new Vector(0,0));
    movables.add(player);

    final f = 0.1;
    final h = 1 / 1500.0;
    final g = 1 / 72.0;

    num playerSpeed = 100;
    
    document.onKeyDown.listen((KeyboardEvent event) {
      switch (event.keyCode) {
        case KeyCode.LEFT:
          player.speed.x -= dt * playerSpeed; 
          break;
        case KeyCode.RIGHT:
          player.speed.x += dt * playerSpeed;
          break;
        case KeyCode.UP:
          player.speed.y -= dt * playerSpeed; 
          break;
        case KeyCode.DOWN:
          player.speed.y += dt * playerSpeed;
          break;
      }
    });
    
    // Start the animation loop.
    requestRedraw();
  }

  void draw(num _) {
    num time = new DateTime.now().millisecondsSinceEpoch;

    if (renderTime != null) {
      showFps((1000 / (time - renderTime)).round());
      dt = (time - renderTime) / 1000;
    }

    renderTime = time;

    var context = canvas.context2d;

    movables.forEach((Movable movable) => movable.updatePosition());
    
    drawBackground(context);
    drawMovables(context);

    requestRedraw();
  }

  void drawBackground(CanvasRenderingContext2D context) {
    context.fillStyle = "black";
    context.rect(0, 0, width, height);
    context.fill();
  }

  void drawMovables(CanvasRenderingContext2D context) {
    movables.forEach( 
        (Movable movable) => movable.draw(context, width / 2, height / 2) 
    );
  }

  void requestRedraw() {
    window.requestAnimationFrame(draw);
  }

  void addAsteroidBelt(int count) {
    Random random = new Random();

    for (int i = 0; i < count; i++) {
      int xDistance = 500;
      int yDistance = 200;
      Point point = new Point(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance);
      movables.add(new Movable(this, "asteroid", "#777", 3, point, new Vector(0,0)));
    }
  }

  
/*
  num normalizePlanetSize(num r) {
    return log(r + 1) * (width / 100.0);
  }
  */
}
