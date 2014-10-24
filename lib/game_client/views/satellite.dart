part of game_client;

class Satellite extends stagexl.Sprite {
  
  stagexl.Juggler _juggler = new stagexl.Juggler();
  stagexl.Juggler get juggler => _juggler;
  
  Satellite(){
    stagexl.Sprite center = new stagexl.Sprite();

    //center
    double centerWidth = 30.0;
    double centerHeight = 40.0;
    double centerWidthHalf = centerWidth / 2;
    double centerHeightHalf = centerHeight / 2;
        
    //Center
    _rect(center.graphics,
        -centerWidthHalf, -centerHeightHalf,
        centerWidthHalf, centerHeightHalf,
        null, stagexl.Color.Gray);

    stagexl.Sprite leftSail = _makeSail(centerWidthHalf);
    leftSail.scaleX = -1.0;
    this.addChild(leftSail);
    _sine(leftSail, false);
    
    this.addChild(center);

    stagexl.Sprite rightSail = _makeSail(centerWidthHalf);
    this.addChild(rightSail);
    _sine(rightSail, true);
  }
  
  stagexl.Sprite _makeSail(double xOffset)
  {
    double connectorWidth = 5.0;
    double connectorHeight = 5.0;
    double connectorHeightHalf = connectorHeight / 2;
    
    double sailWidth = 80.0;
    double sailHeight = 20.0;
    double sailHeightHalf = sailHeight / 2;

    stagexl.Sprite satelliteSails = new stagexl.Sprite();
    
    //Right connector
    double x = xOffset;
    _rect(satelliteSails.graphics,
        x, -connectorHeightHalf,
        x + connectorWidth, connectorHeightHalf,
        stagexl.Color.Gray, null);

    //Sail right
    x = x + connectorWidth;
    int segments = 3;
    int subsegments = 4;
    double subsegmentWidth = sailWidth / (segments * subsegments);
    _rect(
        satelliteSails.graphics, 
        x,              -sailHeightHalf, 
        x + sailWidth,  sailHeightHalf, 
        stagexl.Color.White, stagexl.Color.DarkBlue);
    for(int i = 1; i < segments * subsegments; i++){
      double segmentX = x + subsegmentWidth * i;
      double strokeWidth = i % subsegments == 0 ? 1.0 : 0.5;
      satelliteSails.graphics.beginPath();
      satelliteSails.graphics.moveTo(segmentX, -sailHeightHalf);
      satelliteSails.graphics.lineTo(segmentX, sailHeightHalf);
      satelliteSails.graphics.strokeColor(stagexl.Color.White, strokeWidth);
      satelliteSails.graphics.closePath();
    }
    
    for(int i = 1; i < subsegments; i++){
      double segmentY = -sailHeightHalf + sailHeight/subsegments*i;
      satelliteSails.graphics.beginPath();
      satelliteSails.graphics.moveTo(x, segmentY);
      satelliteSails.graphics.lineTo(x + sailWidth, segmentY);
      satelliteSails.graphics.strokeColor(stagexl.Color.White, 0.5);
      satelliteSails.graphics.closePath();
    }
    
    return satelliteSails;
  }
  
  _sine(stagexl.Sprite sprite, bool front){
    var tween = new stagexl.Tween(sprite, 10.0, (num ratio) {
      return 0.5 - 0.5 * Math.cos(ratio * Math.PI);
    });
    tween.animate.scaleX.to(-sprite.scaleX);
    tween.onComplete = (){
      if(front){
        this.setChildIndex(sprite, 0);
      }
      else {
        this.setChildIndex(sprite, 2);
      }
      
      _sine(sprite, !front);
    };
    juggler.add(tween);    
  }

  _rect(graphics, x1, y1, x2, y2, strokeColor, fillColor){
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y1);
    graphics.lineTo(x2, y2);
    graphics.lineTo(x1, y2);
    graphics.lineTo(x1, y1);
    if(strokeColor != null){
      graphics.strokeColor(strokeColor);
    }
    if(fillColor != null){
      graphics.fillColor(fillColor);  
    }
    
    graphics.closePath();    
  }
}