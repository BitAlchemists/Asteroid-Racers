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
  
  static applyAsteroid(stagexl.Graphics graphics, double outerRadius) {
    double innerRadius = outerRadius * 0.75;
    int numVertices = outerRadius.toInt();
    
    int minColorAmount = 80;
    int maxColorAmount = 512;
    int colorAmount = random.nextInt(maxColorAmount-minColorAmount) + minColorAmount;
    
    int r = random.nextInt(Math.min(colorAmount, 256));
    colorAmount -= r;
    int g = random.nextInt(Math.min(colorAmount, 256));
    colorAmount -= g;
    int b = colorAmount;
    
    int color = 0xFF000000 + (r << 16) + (g << 8) + b;
    
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, color);
    graphics.fillColor(0xFF080808);
  }
  
  static applyExplosion(stagexl.Graphics graphics, double outerRadius){
    double innerRadius = outerRadius * 0.1;
    int numVertices = 30;
    
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, stagexl.Color.Red);
    graphics.fillColor(stagexl.Color.Black);
  }
  
  static applyCobweb(
      stagexl.Graphics graphics, 
      double outerRadius, 
      double innerRadius, 
      int numVertices,[
      int strokeColor]){
    
    Math.Random random = new Math.Random();
    
    graphics.beginPath();
    Vector2 firstVertex = null;
    
    for(int i = 0; i < numVertices; i++) {
      num angle = (i.toDouble() / numVertices.toDouble());
      num vertexRadius = random.nextDouble() * (outerRadius - innerRadius) + innerRadius;
      
      Vector2 vector = new Vector2(Math.cos(angle * Math.PI*2) * vertexRadius, Math.sin(angle * Math.PI*2) * vertexRadius);
      
      if(i == 0){
        firstVertex = vector;
        graphics.moveTo(vector.x, vector.y);
      }
      else {
        graphics.lineTo(vector.x, vector.y);
      }
    }
    
    graphics.lineTo(firstVertex.x, firstVertex.y);
    if(strokeColor != null){
      graphics.strokeColor(strokeColor);      
    }
    
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