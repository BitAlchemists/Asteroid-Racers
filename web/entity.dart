part of asteroidracers;

class Entity {
  final String name;
  Point position;

  Entity(String this.name, Point this.position) {

    //bodySize = solarSystem.normalizePlanetSize(bodySize);
  }

  void draw(CanvasRenderingContext2D context, Point position) {
    context.save();
    
    try {
      context.lineWidth = 0.5;
      //context.fillStyle = color;
      //context.strokeStyle = color;

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