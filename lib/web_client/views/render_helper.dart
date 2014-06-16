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
  
  static applySpaceship(stagexl.Graphics graphics, double radius) {
    
    double height = radius * 1.5;
    double width = radius;
    double platformWidth = width/4;
    double boosterWidth = width/4;
    double pitWidth = (width - 2*platformWidth - boosterWidth) / 2;
    double pitHeight = height/8;   
    
    Vector2 leftCorner = new Vector2(-width/2,-height/3);
    Vector2 tip = new Vector2(0.0,height/3*2);
    Vector2 rightCorner = new Vector2(width/2,-height/3);
    Vector2 leftCornerToTip = (tip - leftCorner).normalize();
    
    Vector2 leftP1 = leftCorner + new Vector2(platformWidth, 0.0);
    Vector2 leftP2 = leftP1 + new Vector2(pitWidth, 0.0);
    Vector2 leftPitP1 = leftP1 + leftCornerToTip * pitHeight;
    Vector2 leftPitP2 = leftP2 + leftCornerToTip * pitHeight;
    
    Vector2 rightP1 = new Vector2(-leftP1.x, leftP1.y);
    Vector2 rightP2 = new Vector2(-leftP2.x, leftP2.y);
    Vector2 rightPitP1 = new Vector2(-leftPitP1.x, leftPitP1.y);
    Vector2 rightPitP2 = new Vector2(-leftPitP2.x, leftPitP2.y);
    
    graphics.beginPath();
    graphics.moveTo(tip.x, tip.y);
    graphics.lineTo(leftCorner.x, leftCorner.y);

    graphics.lineTo(leftP1.x, leftP1.y);
    graphics.lineTo(leftPitP1.x, leftPitP1.y);
    graphics.lineTo(leftPitP2.x, leftPitP2.y);
    graphics.lineTo(leftP2.x, leftP2.y);

    graphics.lineTo(rightP2.x, rightP2.y);
    graphics.lineTo(rightPitP2.x, rightPitP2.y);
    graphics.lineTo(rightPitP1.x, rightPitP1.y);
    graphics.lineTo(rightP1.x, rightP1.y);

    graphics.lineTo(rightCorner.x, rightCorner.y);
    graphics.lineTo(tip.x, tip.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.fillColor(stagexl.Color.DarkGreen);
    graphics.closePath(); 
    
    double innerLength = radius / 3.0;
    Vector2 innerTip = new Vector2(0.0, innerLength);
    Vector2 innerLeftCorner = innerTip + (leftCornerToTip * -1.0) * innerLength;
    Vector2 innerRightCorner = new Vector2(-innerLeftCorner.x, innerLeftCorner.y);

    graphics.beginPath();
    graphics.moveTo(innerTip.x, innerTip.y);
    graphics.lineTo(innerLeftCorner.x, innerLeftCorner.y);
    graphics.lineTo(innerRightCorner.x, innerRightCorner.y);
    graphics.lineTo(innerTip.x, innerTip.y);
    graphics.strokeColor(stagexl.Color.LightGreen);
    graphics.fillColor(stagexl.Color.Black);
    graphics.closePath(); 

    return;
    /*
    // The Triangle
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
    
    return;*/
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
  
  static applyFinishCircle(stagexl.Sprite finish, {double radius: 100.0, double sideLength: 20.0}){
    stagexl.Sprite whitePattern;
    stagexl.Sprite blackPattern;
    whitePattern = new stagexl.Sprite();
    blackPattern = new stagexl.Sprite();
    double radius = 100.0;
    double sideLength = radius/5;
    bool white = false;
    for(double x = -radius; x < radius; x += sideLength){
      white = !white;
      for(double y = -radius; y < radius; y += sideLength){
        white = !white;
        if(!white){
          whitePattern.graphics.rect(x, y, sideLength, sideLength);
        }
        else{
          blackPattern.graphics.rect(x, y, sideLength, sideLength);
        }
      }
    }
    
    whitePattern.graphics.fillColor(stagexl.Color.White);
    blackPattern.graphics.fillColor(stagexl.Color.Black);
    finish.addChild(whitePattern);
    finish.addChild(blackPattern);
    finish.mask = new stagexl.Mask.circle(0, 0, radius);
    finish.alpha = 0.8;
  }
  
  static applyArrows(stagexl.Sprite arrows, {int numArrows: 3, double radius: 100.0})
  {
    double width = radius;
    double height = radius;
    
    double thickness = 10.0;
    double t = thickness / Math.SQRT2 / 2.0;
    double cornerRadius = thickness / 2;
    
    for(int i = 0; i < numArrows; i++) {
      double space = height - width/2; // width/2 == the height of an arrow 
      double y = space / (numArrows - 1) * i - space/2;
      Vector2 offset = new Vector2(0.0, y);
      
      Vector2 upRight = new Vector2(t, t);
      Vector2 downLeft = new Vector2(-t, -t);
      Vector2 downRight = new Vector2(t, -t);
      Vector2 upLeft = new Vector2(-t, t);
      
      Vector2 tip = new Vector2(0.0, width/2/3*2) + offset;
      Vector2 tipInnerControl = tip + downRight + downLeft;
      Vector2 tipOuterControl = tip + upLeft + upRight;
      Vector2 tipOuterRight = tip + upRight;
      Vector2 tipOuterLeft = tip + upLeft;
      Vector2 tipInnerRight = tipInnerControl + downRight;
      Vector2 tipInnerLeft = tipInnerControl + downLeft;
      
      //outside in
      Vector2 rightWing = new Vector2(width/2, -width/2/3) + offset;
      Vector2 rightWingA = rightWing + upRight;
      Vector2 rightWingAB = rightWing + upRight + downRight;
      Vector2 rightWingB = rightWing + downRight;
      Vector2 rightWingBC = rightWing + downRight + downLeft;
      Vector2 rightWingC = rightWing + downLeft;
      
      //inside out
      Vector2 leftWing = new Vector2(-width/2, -width/2/3) + offset;
      Vector2 leftWingA = leftWing + downRight;
      Vector2 leftWingAB = leftWing + downRight + downLeft;
      Vector2 leftWingB = leftWing + downLeft;
      Vector2 leftWingBC = leftWing + downLeft + upLeft;
      Vector2 leftWingC = leftWing + upLeft;
      
      stagexl.Graphics g = arrows.graphics;
      g.beginPath();
      
      //rightWing
      g.moveTo(tipOuterRight.x, tipOuterRight.y);
      g.lineTo(rightWingA.x, rightWingA.y);
      g.arcTo(rightWingAB.x, rightWingAB.y, rightWingB.x, rightWingB.y, cornerRadius);
      g.arcTo(rightWingBC.x, rightWingBC.y, rightWingC.x, rightWingC.y, cornerRadius);
      //inner corner
      g.lineTo(tipInnerRight.x, tipInnerRight.y);
      g.arcTo(tipInnerControl.x, tipInnerControl.y, tipInnerLeft.x, tipInnerLeft.y, cornerRadius);
      //leftWing
      g.lineTo(leftWingA.x, leftWingA.y);
      g.arcTo(leftWingAB.x, leftWingAB.y, leftWingB.x, leftWingB.y, cornerRadius);
      g.arcTo(leftWingBC.x, leftWingBC.y, leftWingC.x, leftWingC.y, cornerRadius);
      //outer corner
      g.lineTo(tipOuterLeft.x, tipOuterLeft.y);
      g.arcTo(tipOuterControl.x, tipOuterControl.y, tipOuterRight.x, tipOuterRight.y, cornerRadius);

      g.closePath();
      g.strokeColor(stagexl.Color.Blue);
      g.fillColor(stagexl.Color.LightBlue);
    }
        


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