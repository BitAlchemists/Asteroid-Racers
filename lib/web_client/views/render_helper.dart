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
    
    int color = randColor(80,512);
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, strokeColor: color);
    graphics.fillColor(0xFF080808);
  }
  
  static applyExplosion(stagexl.Graphics graphics, double outerRadius){
    double innerRadius = outerRadius * 0.1;
    int numVertices = 30;
    
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, strokeColor: stagexl.Color.Red);
    graphics.fillColor(stagexl.Color.Black);
  }
  
  static applyCobweb(
      stagexl.Graphics graphics, 
      num outerRadius, 
      num innerRadius, 
      int numVertices,{
      int strokeColor, num x: 0, num y: 0}){
    
    Math.Random random = new Math.Random();
    
    graphics.beginPath();
    Vector2 firstVertex = null;
    
    for(int i = 0; i < numVertices; i++) {
      num angle = (i.toDouble() / numVertices.toDouble());
      num vertexRadius = random.nextDouble() * (outerRadius - innerRadius) + innerRadius;
      
      Vector2 vector = new Vector2(Math.cos(angle * Math.PI*2) * vertexRadius, Math.sin(angle * Math.PI*2) * vertexRadius);
      
      if(i == 0){
        firstVertex = vector;
        graphics.moveTo(x + vector.x, y + vector.y);
      }
      else {
        graphics.lineTo(x + vector.x, y + vector.y);
      }
    }
    
    graphics.lineTo(x + firstVertex.x, y + firstVertex.y);
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
  
  static int randColor(int minVolume, int maxVolume){
    int colorAmount = random.nextInt(maxVolume-minVolume) + minVolume;
    
    int r = random.nextInt(Math.min(colorAmount, 256));
    colorAmount -= r;
    int g = random.nextInt(Math.min(colorAmount, 256));
    colorAmount -= g;
    int b = colorAmount;
    
    int color = 0xFF000000 + (r << 16) + (g << 8) + b;
    
    return color;
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