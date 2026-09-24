(function(root){
  'use strict';
  const stages = [
    {id:'tap',label:'開始点',kind:'tap',cue:'ぴかっ！を タッチ',points:[[180,320]]},
    {id:'short-line',label:'短い直線',kind:'trace',cue:'すーっ！',points:[[120,320],[240,320]]},
    {id:'long-line',label:'長い直線',kind:'trace',cue:'すーーっ！',points:[[65,320],[295,320]]},
    {id:'turn',label:'方向転換',kind:'trace',cue:'すーっ、くいっ！',points:[[90,265],[90,370],[265,370]]},
    {id:'gentle-curve',label:'ゆるいカーブ',kind:'trace',cue:'ふわーっ！',curve:[[70,355],[180,245],[290,355]]},
    {id:'large-curve',label:'大きなカーブ',kind:'trace',cue:'ぐるーん！',curve:[[90,390],[330,405],[300,240],[130,265]]},
    {id:'mixed-shape',label:'直線とカーブ',kind:'trace',cue:'すーっ、くるん！',lead:[[75,270],[205,270]],curve:[[205,270],[305,270],[300,385],[200,385]],tail:[[200,385],[120,385]]}
  ];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function bezier(control,t){let p=control.map(([x,y])=>({x,y}));while(p.length>1)p=p.slice(1).map((v,i)=>({x:p[i].x*(1-t)+v.x*t,y:p[i].y*(1-t)+v.y*t}));return p[0]}
  function geometry(stage){
    let raw=[];
    const lines=arr=>arr.forEach((p,i)=>{if(!i){raw.push({x:p[0],y:p[1]});return}const a=arr[i-1],n=Math.ceil(Math.hypot(p[0]-a[0],p[1]-a[1])/3);for(let j=1;j<=n;j++)raw.push({x:a[0]+(p[0]-a[0])*j/n,y:a[1]+(p[1]-a[1])*j/n})});
    if(stage.points)lines(stage.points);
    if(stage.lead)lines(stage.lead);
    if(stage.curve)for(let i=0;i<=150;i++)raw.push(bezier(stage.curve,i/150));
    if(stage.tail)lines(stage.tail);
    let length=0;const points=raw.map((p,i)=>{if(i)length+=distance(p,raw[i-1]);return {...p,s:length}});
    return {points,length,path:points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')};
  }
  // Sequential, local progress prevents jumping straight to the end or skipping a bend.
  function advance(geo,progress,p,tolerance=30){
    let nearest=null,min=Infinity;
    for(const q of geo.points){if(q.s<progress-35||q.s>progress+45)continue;const d=distance(p,q);if(d<min){min=d;nearest=q}}
    if(!nearest||min>tolerance)return {onPath:false,progress,complete:false};
    const next=Math.max(progress,nearest.s),end=geo.points.at(-1);
    return {onPath:true,progress:next,complete:next>=geo.length-12&&distance(p,end)<26};
  }
  const api={stages,geometry,advance,distance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FingerGame=api;
})(typeof window!=='undefined'?window:globalThis);
