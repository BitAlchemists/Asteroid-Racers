part of ar_client;

class RenderHelper {
  
  static applyTriangle(stagexl.Graphics graphics) {
    Vector2 pos1 = new Vector2(-5.0,-5.0);
    Vector2 pos2 = new Vector2(0.0,10.0);
    Vector2 pos3 = new Vector2(5.0,-5.0);
    
    graphics.beginPath();
    graphics.moveTo(pos1.x, pos1.y);
    graphics.lineTo(pos2.x, pos2.y);
    graphics.lineTo(pos3.x, pos3.y);
    graphics.lineTo(pos1.x, pos1.y);
    graphics.strokeColor(stagexl.Color.Green);
    graphics.closePath();        
  }
  
  static applyAsteroid(stagexl.Graphics graphics) {
    
    Math.Random random = new Math.Random();
    
    num minRadius = 3;
    num maxRadius = 30;
    num outerRadius = random.nextDouble() * (maxRadius - minRadius) + minRadius;
    num innerRadius = outerRadius * 0.75;
    int numVertices = outerRadius.toInt();
    
    graphics.beginPath();
    Vector2 firstVertex = null;
    
    for(int i = 0; i < numVertices; i++) {
      num angle = (i.toDouble() / numVertices.toDouble());
      num radius = random.nextDouble() * (outerRadius - innerRadius) + innerRadius;
      
      Vector2 vector = new Vector2(Math.cos(angle * Math.PI*2) * radius, Math.sin(angle * Math.PI*2) * radius);
      
      if(i == 0){
        firstVertex = vector;
        graphics.moveTo(vector.x, vector.y);
      }
      else {
        graphics.lineTo(vector.x, vector.y);
      }
    }
    
    graphics.lineTo(firstVertex.x, firstVertex.y);
    graphics.strokeColor(stagexl.Color.Yellow);
    graphics.closePath();        

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