part of asteroidracers;

class RenderComponent extends Component {
  
  void draw(CanvasRenderingContext2D context, Point center) {
    context.save();
    
    try {
      context.lineWidth = 0.5;
      context.fillStyle = "black ";
      context.strokeStyle = "green";

      context.beginPath();
      //context.arc(position.x, position.y, 20, 0, PI * 2, false);
      Point p1 = center + entity.position + new Point(-5, -5);
      Point p2 = center + entity.position + new Point(0, 10);
      Point p3 = center + entity.position + new Point (5,-5);
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.lineTo(p3.x, p3.y);
      context.lineTo(p1.x, p1.y);
      context.stroke();
      context.closePath();
    } finally {
      context.restore();
    }
  }
  
}

