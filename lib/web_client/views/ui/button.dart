part of web_client;

class Button extends stagexl.Sprite {
  String _text;
  String get text => _text;
  void set text(String text){
    _text = text;
    _textField.text = text;
  }
  
  stagexl.TextField _textField;
  
  Button([num width = 100, num height = 100]){
    
    this.width = width;
    
    stagexl.Sprite redRect = _rect(width, height, stagexl.Color.Red);
    stagexl.Sprite darkBlueRect = _rect(width, height, stagexl.Color.DarkBlue);
    stagexl.Sprite darkRedRect = _rect(width, height, stagexl.Color.DarkRed);
    
    _textField = new stagexl.TextField()
      ..mouseEnabled = false
      ..width = width
      ..defaultTextFormat.align = stagexl.TextFormatAlign.CENTER;
    _textField.y = height/2 -_textField.textHeight/2;
    _textField.height = _textField.textHeight;
    
    stagexl.SimpleButton button = new stagexl.SimpleButton(darkRedRect);   
    button.downState = darkBlueRect;
    button.overState = redRect;
    button.hitTestState = redRect;
        
    print(this.height);

    this.addChild(button);
    print(this.height);

    this.addChild(_textField);
    
    print(this.height);
  }
  
  _rect(num width, num height, int color){
    stagexl.Sprite rect = new stagexl.Sprite();
    rect.graphics.rectRound(0, 0, width, height, 10, 10);
    rect.graphics.fillColor(color);
    return rect;
  }
}