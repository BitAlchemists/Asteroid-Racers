part of asteroidracers;

class RenderComponent extends Component {
  
  void draw(CanvasRenderingContext2D context, vec3 center) {
    context.save();
    
    try {
      context.lineWidth = 0.5;
      context.fillStyle = "black ";
      context.strokeStyle = "green";

      context.beginPath();
      mat4 transform = new mat4.identity().translate(center).translate(entity.position).rotateZ(entity.orientation * PI);
      
      //context.arc(position.x, position.y, 20, 0, PI * 2, false);
      vec3 p1 = transform.transform3(new vec3(-5, -5, 0));
      vec3 p2 = transform.transform3(new vec3(0, 10, 0));
      vec3 p3 = transform.transform3(new vec3(5, -5, 0));
      
      //transform.transform3(p3);

      
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

/*
 
// Rotation of pi/2 degrees around the Y axis followed by a 
// translation of (5.0, 2.0, 3.0).
mat4 T = new mat4.rotationY(pi*0.5).translate(5.0, 2.0, 3.0);
// A point.
vec3 position = new vec3.raw(1.0, 1.0, 1.0);
// Transform position by T.
T.transform3(position);
*/