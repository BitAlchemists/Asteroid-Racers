part of ui;

class Window extends stagexl.Sprite {
  
  //Theme
  static num yOffset = 10;
  static num xOffset = 10;
  static num buttonHeight = 40;

  num get contentWidth => this.width - 2*xOffset;

  //instance variables  
  num _height = yOffset;
  num get height => _height;

  num _width;
  num get width => _width;
  set width(num width){
    _width = width;
    _updateWindowBackground();
  }
  
  Window(){

  }
  
  void pushView(stagexl.DisplayObject view){
    view.x = xOffset; 
    view.y = _height;
    updateViewWidth(view);
    view.addTo(this);
    
    _height = view.y + view.height;
    _updateWindowBackground();
  }

  updateViewWidth(stagexl.DisplayObject view){
    var _contentWidth = width - 2*xOffset;
    view.width = _contentWidth;
  }

  void pushSpace(num pixels){
    _height += pixels;
    _updateWindowBackground();
  }
  
  void _updateWindowBackground(){
    this.graphics.clear();
    this.graphics.rectRound(0, 0, this.width, _height, 10, 10);
    this.graphics.fillColor(0xaa444444);
  }
  
}