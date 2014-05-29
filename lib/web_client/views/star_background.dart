part of web_client;

class StarBackground extends stagexl.Sprite implements stagexl.Animatable {
  
  static const int _CHILLAXING = 0;
  static const int _BLINK_IN = 1;
  static const int _BLINK_OUT = 2;
  
  static const double _numOfStarsPerArea = 50.0 / 1000000;
  static const double _blinkPauseLength = 10.0;
  static const double _parallaxFactor = 0.3;
  
  stagexl.Stage _stage;
  PlayerController player;
  
  double _width;
  double _height;
  List<Vector2> _points = new List<Vector2>();
  double _time = 0.0;
  stagexl.Sprite _blink;
  int _blinkState = _CHILLAXING;
  double _blinkScale; 
  
  StarBackground(this._width, this._height, this._stage) : super() {
        
    int numOfStars = (_numOfStarsPerArea * _width * _height).toInt();
    
    for (int i = 0; i < numOfStars; i++) {
      //rectangle 
      Vector2 point = new Vector2(random.nextDouble() * _width - _width / 2.0, random.nextDouble() * _height - _height / 2.0);
      _points.add(point);
    }
    
    for(Vector2 pos1 in _points){
      final Vector2 size = new Vector2(1.0, 1.0);
      Vector2 pos2 = pos1 + size;
       
      graphics.beginPath();
      graphics.moveTo(pos1.x, pos1.y);
      graphics.lineTo(pos1.x, pos2.y);
      graphics.lineTo(pos2.x, pos2.y);
      graphics.lineTo(pos2.x, pos1.y);
      graphics.lineTo(pos1.x, pos1.y);
      graphics.strokeColor(stagexl.Color.White);
      graphics.closePath();        

    }
    
    _blink = new stagexl.Sprite();
    _blink.graphics.beginPath();
    _blink.graphics.moveTo(-10.0, 0.0);
    _blink.graphics.lineTo(10.0, 0.0);
    _blink.graphics.moveTo(0.0, -10.0);
    _blink.graphics.lineTo(0.0, 10.0);
    _blink.graphics.strokeColor(stagexl.Color.White);
    _blink.graphics.closePath();
    
    Sun sun = new Sun();
    sun.x = 200;
    sun.y = 230;
    this.addChild(sun);
  }
  
  bool advanceTime(num dt){
    
    if(player != null){
      this.x = _stage.stageWidth/2.0 - player.sprite.x * _parallaxFactor;
      this.y = _stage.stageHeight/2.0 - player.sprite.y * _parallaxFactor;      
    }
    
    final double blinkInTime = 0.3;
    final double blinkOutTime = 0.3;
    
    switch(_blinkState){
      case _CHILLAXING:
        _time += dt;
        
        if(_time >= _blinkPauseLength){
          int i = random.nextInt(_points.length);
          Vector2 point = _points[i];
          this.addChild(_blink);
          _blink.x = point.x;
          _blink.y = point.y;
          _blinkScale = 0.1;
          _blink.scaleX = _blinkScale;
          _blink.scaleY = _blinkScale;
          _blinkState = _BLINK_IN;
        }
        
        break;
      case _BLINK_IN:
        _blinkScale += dt / blinkInTime;
        
        if(_blinkScale >= 1.0){
          _blinkScale = 1.0;
          _blinkState = _BLINK_OUT;
        }
        
        _blink.scaleX = _blinkScale;
        _blink.scaleY = _blinkScale;
        break;
      case _BLINK_OUT:
        
        _blinkScale -= dt / blinkOutTime;
        
        if(_blinkScale <= 0.1){
          _blink.removeFromParent();
          _time = 0.0;
          _blinkState = _CHILLAXING;
        }
        
        _blink.scaleX = _blinkScale;
        _blink.scaleY = _blinkScale;

        break;
    }
    
    return true;
  }
}