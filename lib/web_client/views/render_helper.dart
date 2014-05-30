part of web_client;

class RenderHelper {
  
  /*
   *          /\
   *         |  |
   *         |  |
   *    ||___/  \__||
   *   <  ____  ___  >
   *    ||   /  \  ||
   * 
   * 
   * */
  
  static applySpaceship(stagexl.Graphics graphics) {
    
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
    
    return;
    /*
    double coneHeight = 5.0;
    double centerWidth = 15.0;
    double centerHeight = 30.0;
    
    double thrusterHeight = 5.0;
    double thrusterWidthStart = 5.0;
    double thrusterWidthEnd = 10.0;
    
    double wingWidth = 15.0;
    double wingHeight = 15.0;
    
    Vector2 front = new Vector2(0.0, 0.0);
    Vector2 ulCenter = new Vector2(-centerWidth/2, -coneHeight);
    Vector2 urCenter = new Vector2(centerWidth/2, -coneHeight);
    Vector2 llCenter = new Vector2(ulCenter.x, ulCenter.y - centerHeight);
    Vector2 lrCenter = new Vector2(urCenter.x, urCenter.y - centerHeight);
    
    Vector2 ulThruster = new Vector2(-thrusterWidthStart/2, llCenter.y);
    Vector2 urThruster = new Vector2(thrusterWidthStart/2, lrCenter.y);
    Vector2 llThruster = new Vector2(-thrusterWidthEnd/2, ulThruster.y - thrusterHeight);
    Vector2 lrThruster = new Vector2(thrusterWidthEnd/2, urThruster.y - thrusterHeight);
    
    Vector2 leftWingTip = new Vector2(llCenter.x - wingWidth, llCenter.y);
    Vector2 leftWingTop = new Vector2(llCenter.x, llCenter.y + wingHeight);
    
    Vector2 rightWingTip = new Vector2(lrCenter.x + wingWidth, lrCenter.y);
    Vector2 rightWingTop = new Vector2(lrCenter.x, lrCenter.y + wingHeight);

    graphics.beginPath();
    graphics.moveTo(front.x, front.y);
    graphics.lineTo(ulCenter.x, ulCenter.y);
    graphics.lineTo(llCenter.x, llCenter.y);
    graphics.lineTo(lrCenter.x, lrCenter.y);
    graphics.lineTo(urCenter.x, urCenter.y);
    graphics.lineTo(front.x, front.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.closePath();            

    graphics.beginPath();
    graphics.moveTo(ulThruster.x, ulThruster.y);
    graphics.lineTo(urThruster.x, urThruster.y);
    graphics.lineTo(lrThruster.x, lrThruster.y);
    graphics.lineTo(llThruster.x, llThruster.y);
    graphics.lineTo(ulThruster.x, ulThruster.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.closePath();            

    //left wing
    graphics.beginPath();
    graphics.moveTo(llCenter.x, llCenter.y);
    graphics.lineTo(leftWingTip.x, leftWingTip.y);
    graphics.lineTo(leftWingTop.x, leftWingTop.y);
    graphics.lineTo(llCenter.x, llCenter.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.closePath();            

    //right wing
    graphics.beginPath();
    graphics.moveTo(lrCenter.x, lrCenter.y);
    graphics.lineTo(rightWingTip.x, rightWingTip.y);
    graphics.lineTo(rightWingTop.x, rightWingTop.y);
    graphics.lineTo(lrCenter.x, lrCenter.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.closePath();
    */            
}
  
  static applyAsteroid(stagexl.Graphics graphics, double outerRadius) {
    double innerRadius = outerRadius * 0.75;
    int numVertices = outerRadius.toInt();
    
    int color = randColor(80,512);
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, strokeColor: color);
    graphics.fillColor(0xFF333333);
  }
  
  static applyExplosion(stagexl.Graphics graphics, double outerRadius){
    double innerRadius = outerRadius * 0.1;
    int numVertices = 30;
    
    applyCobweb(graphics, outerRadius, innerRadius, numVertices, strokeColor: stagexl.Color.Red);
    
    stagexl.GraphicsGradient gradient = new stagexl.GraphicsGradient.radial(0,0,0,
                                                                            0,0,outerRadius);
    gradient.addColorStop(0.0, stagexl.Color.White);
    gradient.addColorStop(0.3, stagexl.Color.Red);
    gradient.addColorStop(0.5, stagexl.Color.Brown);
    gradient.addColorStop(0.7, stagexl.Color.Black);
    graphics.fillGradient(gradient);
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
    sprite.graphics.circle(0, 0, radius);
    sprite.graphics.strokeColor(stagexl.Color.White);
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