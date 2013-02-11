part of asteroidracers;


/**
 * A representation of a plantetary body.
 *
 * This class can calculate its position for a given time index, and draw itself
 * and any child planets.
 */
class Movable {
  final String name;
  final String color;

  Point position;
  Vector speed;
  num bodySize;

  Movable(String this.name, String this.color,
      num this.bodySize, Point this.position, Vector this.speed) {

    //bodySize = solarSystem.normalizePlanetSize(bodySize);
  }

  void draw(CanvasRenderingContext2D context, num x, num y) {
    context.save();

    Point absolutePosition = new Point(position.x + x, position.y + y);
    
    try {
      context.lineWidth = 0.5;
      context.fillStyle = color;
      context.strokeStyle = color;

      context.beginPath();
      context.arc(absolutePosition.x, absolutePosition.y, bodySize, 0, PI * 2, false);
      context.fill();
      context.closePath();
      context.stroke();
    } finally {
      context.restore();
    }
  }
  
  void updatePosition() {
    position.x += speed.x;
    position.y += speed.y;
  }
}
