part of ar_client;

class MenuRenderer {
  
  num width;
  num height;
  CanvasRenderingContext2D context;
  
  MenuRenderer (this.context, this.width, this.height);
  
  void render(List menuItems) {
    context.save();
    
    try {
      context.lineWidth = 0.5;
      context.fillStyle = "grey";
      context.strokeStyle = "white";

      context.beginPath();
      
      num cornerRadius = 10.0;
      
      vec2 ul = new vec2(10.0, 10.0);
      vec2 ur = new vec2(100.0, 10.0);
      vec2 lr = new vec2(100.0, 100.0);
      vec2 ll = new vec2(10.0, 100.0);
      
      vec2 ul1 = ul + new vec2(0.0, cornerRadius);
      vec2 ul2 = ul + new vec2(cornerRadius, 0.0);
      vec2 ur1 = ur + new vec2(-cornerRadius, 0.0);
      vec2 ur2 = ur + new vec2(0.0, cornerRadius);
      vec2 lr1 = lr + new vec2(0.0, -cornerRadius);
      vec2 lr2 = lr + new vec2(-cornerRadius, 0.0);
      vec2 ll1 = ll + new vec2(cornerRadius, 0.0);
      vec2 ll2 = ll + new vec2(0.0, -cornerRadius);
      
      context.moveTo(ul2.x, ul2.y);
      context.arcTo(ur.x, ur.y, ur2.x, ur2.y, cornerRadius);
      context.arcTo(lr.x, lr.y, lr2.x, lr2.y, cornerRadius);
      context.arcTo(ll.x, ll.y, ll2.x, ll2.y, cornerRadius);
      context.arcTo(ul.x, ul.y, ul2.x, ul2.y, cornerRadius);
      
      context.fill();
      context.stroke();
      context.closePath();
    } finally {
      context.restore();
    }
  }
}

