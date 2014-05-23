part of web_client;

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
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.closePath();        
  }
  
  static applyAsteroid(stagexl.Graphics graphics, double radius) {
    
    Math.Random random = new Math.Random();
    
    num innerRadius = radius * 0.75;
    int numVertices = radius.toInt();
    
    graphics.beginPath();
    Vector2 firstVertex = null;
    
    List colors = [stagexl.Color.Yellow, 
                         stagexl.Color.Brown, 
                         stagexl.Color.Orange,
                         stagexl.Color.Wheat,
                         stagexl.Color.Red];
    
    for(int i = 0; i < numVertices; i++) {
      num angle = (i.toDouble() / numVertices.toDouble());
      num vertexRadius = random.nextDouble() * (radius - innerRadius) + innerRadius;
      
      Vector2 vector = new Vector2(Math.cos(angle * Math.PI*2) * vertexRadius, Math.sin(angle * Math.PI*2) * vertexRadius);
      
      if(i == 0){
        firstVertex = vector;
        graphics.moveTo(vector.x, vector.y);
      }
      else {
        graphics.lineTo(vector.x, vector.y);
        var i = random.nextInt(colors.length);
        var color = colors[i];
        graphics.strokeColor(color);
      }
    }
    
    graphics.lineTo(firstVertex.x, firstVertex.y);
    var i = random.nextInt(colors.length);
    var color = colors[i];
    graphics.strokeColor(color);
    graphics.closePath();        

  }
  
  static applyCircle(stagexl.Sprite sprite, double radius){
    stagexl.Sprite circle = new stagexl.Sprite();
    circle.graphics.circle(0, 0, radius);
    circle.graphics.strokeColor(stagexl.Color.White);
    sprite.addChildAt(circle, 0);
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