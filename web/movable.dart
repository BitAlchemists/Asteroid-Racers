part of asteroidracers;


/**
 * A representation of a plantetary body.
 *
 * This class can calculate its position for a given time index, and draw itself
 * and any child planets.
 */
class Movable {
  final String name;
  Point position;

  Vector speed;
  num bodySize;

  Movable(String this.name, num this.bodySize, Point this.position, Vector this.speed) {

    //bodySize = solarSystem.normalizePlanetSize(bodySize);
  }

  void draw(CanvasRenderingContext2D context, Position position) {
    context.save();
    
    try {
      context.lineWidth = 0.5;
      context.fillStyle = color;
      context.strokeStyle = color;

      context.beginPath();
      context.arc(position.x, position.y, bodySize, 0, PI * 2, false);
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
