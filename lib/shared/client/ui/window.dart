part of shared_client;

class Window extends stagexl.Sprite {
  
  //Theme
  static num yOffset = 10;
  static num xOffset = 10;
  static num buttonHeight = 40;
  
  num get contentWidth => _contentWidth;

  //instance variables  
  num _height = yOffset;
  num _contentWidth;
    
  num get height => _height;
  
  Window(num width){
    this.width = width;
    _contentWidth = width - 2*xOffset;

  }
  
  void pushView(stagexl.DisplayObject view){
    view.x = xOffset; 
    view.y = _height;
    view.width = _contentWidth;
    view.addTo(this);
    
    _height = view.y + view.height;
    _updateWindowBackground();
  }
  
  void pushSpace(num pixels){
    _height += pixels;
    _updateWindowBackground();
  }
  
  void _updateWindowBackground(){
    this.graphics.clear();
    this.graphics.rectRound(0, 0, this.width, _height, 10, 10);
    this.graphics.fillColor(0xee444444);
  }
  
}