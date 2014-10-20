part of web_client;

class Window extends stagexl.Sprite {
  
  //Theme
  static num yOffset = 10;
  static num xOffset = 10;
  static num buttonHeight = 40;
  
  num get contentWidth => _contentWidth;

  //instance variables  
  num _yStack = yOffset;
  num _contentWidth;
    
  Window(num width){
    this.width = width;
    _contentWidth = width - 2*xOffset;

  }
  
  void pushView(stagexl.DisplayObject view){
    view.x = xOffset; 
    view.y = _yStack;
    view.width = _contentWidth;
    view.addTo(this);
    
    _yStack = view.y + view.height;
    _updateWindowBackground();
  }
  
  void pushSpace(num pixels){
    _yStack += pixels;
    _updateWindowBackground();
  }
  
  void _updateWindowBackground(){
    this.graphics.clear();
    this.graphics.rectRound(0, 0, this.width, _yStack, 10, 10);
    this.graphics.fillColor(0x88888888);
  }
  
}