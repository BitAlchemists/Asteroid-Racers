part of web_client;

class Window extends stagexl.Sprite {
  
  //Theme
  static num yOffset = 10;
  static num xOffset = 10;
  static num buttonHeight = 40;
  
  num get contentWidth => _contentWidth;

  //instance variables  
  num yStack = yOffset;
  num _contentWidth;
    
  Window(num width){
    this.width = width;
    num _contentWidth = width - 2*xOffset;
  }
  
  void stackView(stagexl.DisplayObject view){
    
    
    view.x = xOffset; 
    view.y = yStack;
    view.width = _contentWidth;

    view.addTo(this);
    yStack = view.y + view.height;
}
  
}