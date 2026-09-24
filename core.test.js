const test=require('node:test');
const assert=require('node:assert/strict');
const {stages,geometry,advance}=require('./core.js');
test('all six paths can be followed continuously to completion',()=>{
  for(const stage of stages.filter(s=>s.kind==='trace')){const g=geometry(stage);let progress=0,result;for(const p of g.points){result=advance(g,progress,p);assert.equal(result.onPath,true,stage.id);progress=result.progress}assert.equal(result.complete,true,stage.id)}
});
test('jumping from start to end never completes any trace',()=>{
  for(const s of stages.filter(s=>s.kind==='trace')){const g=geometry(s),result=advance(g,0,g.points.at(-1));assert.equal(result.complete,false,s.id);assert.equal(result.onPath,false,s.id)}
});
test('forgiving corridor accepts small motor deviations',()=>{
  const g=geometry(stages[2]);let progress=0;for(const p of g.points){const result=advance(g,progress,{x:p.x,y:p.y+18});assert.equal(result.onPath,true);progress=result.progress}assert.ok(progress>g.length-12);
});
test('leaving the path preserves progress and cannot cause completion',()=>{
  const g=geometry(stages[3]),result=advance(g,50,{x:330,y:100});assert.equal(result.onPath,false);assert.equal(result.progress,50);assert.equal(result.complete,false);
});
test('cutting across the direction change is rejected',()=>{
  const g=geometry(stages[3]);const result=advance(g,55,{x:155,y:335});assert.equal(result.onPath,false);
});
test('short backward movement is allowed without losing energy',()=>{
  const g=geometry(stages[2]);const result=advance(g,100,{x:145,y:320});assert.equal(result.onPath,true);assert.equal(result.progress,100);
});
