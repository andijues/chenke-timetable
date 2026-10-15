// Table rules are independent of text order, merged cells and outlined glyphs.
export function extractRulings(operatorList,viewport,OPS){
  const horizontal=[],vertical=[],stack=[];let matrix=[1,0,0,1,0,0];
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const point=(x,y)=>viewport.convertToViewportPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]);
  function segment(a,b){
    a=point(...a);b=point(...b);
    if(Math.abs(a[1]-b[1])<1.5&&Math.abs(a[0]-b[0])>Math.max(12,viewport.width*.025))horizontal.push({x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y:(a[1]+b[1])/2});
    if(Math.abs(a[0]-b[0])<1.5&&Math.abs(a[1]-b[1])>Math.max(12,viewport.height*.025))vertical.push({y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1]),x:(a[0]+b[0])/2});
  }
  for(let i=0;i<operatorList.fnArray.length;i++){
    const op=operatorList.fnArray[i],args=operatorList.argsArray[i];
    if(op===OPS.paintFormXObjectBegin){stack.push([...matrix]);if(args?.[0])matrix=multiply(matrix,args[0]);continue;}
    if(op===OPS.paintFormXObjectEnd){matrix=stack.pop()??[1,0,0,1,0,0];continue;}
    if(op===OPS.save){stack.push([...matrix]);continue;}
    if(op===OPS.restore){matrix=stack.pop()??[1,0,0,1,0,0];continue;}
    if(op===OPS.transform){matrix=multiply(matrix,args);continue;}
    if(op!==OPS.constructPath)continue;
    const [paint,paths,bounds]=args,path=paths?.[0];
    if(!path||!ArrayBuffer.isView(path)&&!Array.isArray(path))continue;
    const stroked=[OPS.stroke,OPS.closeStroke,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke].includes(paint);
    if(!stroked){
      if(bounds){const [x1,y1,x2,y2]=bounds;if(x2-x1<2||y2-y1<2)segment([x1,y1],[x2,y2]);}
      continue;
    }
    let current=null,start=null;
    for(let j=0;j<path.length;){
      const command=path[j++];
      if(command===0){current=[path[j++],path[j++]];start=current;}
      else if(command===1){const next=[path[j++],path[j++]];if(current)segment(current,next);current=next;}
      else if(command===2){j+=4;current=[path[j++],path[j++]];}
      else if(command===3){j+=2;current=[path[j++],path[j++]];}
      else if(command===4){if(current&&start)segment(current,start);current=start;}
      else break;
    }
  }
  return {horizontal,vertical};
}

export function rotateRulings(grid,width,height,degrees){
  if(!degrees)return grid;
  const point=([x,y])=>degrees===90?[height-y,x]:degrees===180?[width-x,height-y]:[y,width-x];
  const horizontal=[],vertical=[];
  for(const line of [...grid.horizontal.map(l=>[[l.x1,l.y],[l.x2,l.y]]),...grid.vertical.map(l=>[[l.x,l.y1],[l.x,l.y2]])]){
    const [a,b]=line.map(point);
    if(Math.abs(a[1]-b[1])<1.5)horizontal.push({x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y:a[1]});
    else vertical.push({y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1]),x:a[0]});
  }
  return {horizontal,vertical};
}
