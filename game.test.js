// Exercise the real event handlers with a small DOM/clock fixture. Browser layout
// and real input are checked separately in the local preview.
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const core=require('./core.js');
function fixture(){
  let time=0,raf,timerId=0;const timers=new Map(),elements=new Map();
  class Element{
    constructor(){this.children=[];this.attrs={};this.listeners={};this.style={setProperty(){}};this.hidden=true;this.classList={add(){},remove(){}}}
    setAttribute(k,v){this.attrs[k]=v}
    append(...els){els.forEach(el=>{el.parent=this;this.children.push(el)})}
    remove(){this.parent.children=this.parent.children.filter(e=>e!==this)}
    get firstChild(){return this.children[0]}
    replaceChildren(){this.children=[]}
    set innerHTML(value){this.children=Array.from(value.matchAll(/<span /g),()=>new Element())}
    addEventListener(name,handler){this.listeners[name]=handler}
    getBoundingClientRect(){return {}}
    getScreenCTM(){return {inverse(){return {}}}}
    setPointerCapture(id){this.captured=id}
    hasPointerCapture(id){return this.captured===id}
    releasePointerCapture(){this.captured=null}
    querySelectorAll(){return this.children}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const window={};const context={window,FingerGame:core,document:{hidden:false,getElementById:get,createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){}},console:{info(){}},performance:{now:()=>time},structuredClone,DOMPoint:class{constructor(x,y){this.x=x;this.y=y}matrixTransform(){return this}},requestAnimationFrame:fn=>{raf=fn},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:time+ms});return id},clearTimeout:id=>timers.delete(id),setInterval(){}};
  vm.runInNewContext(fs.readFileSync('game.js','utf8'),context);
  const tick=ms=>{const end=time+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn()}time=end;raf(time)};
  const event=(name,p,id=1,primary=true)=>get('arena').listeners[name]({clientX:p.x,clientY:p.y,pointerId:id,isPrimary:primary,button:0,preventDefault(){}});
  const state=()=>window.fingerBeamDebug.getState(),logs=()=>window.fingerBeamDebug.getRecords();
  function complete(){const stage=core.stages.find(s=>s.id===state().stage),g=core.geometry(stage);event('pointerdown',g.points[0]);if(stage.kind==='trace')for(const p of g.points)event('pointermove',p);event('pointerup',g.points.at(-1));tick(1300)}
  return {tick,event,state,logs,complete,get};
}
test('all seven stages attack, finish and replay through actual handlers',()=>{
  const f=fixture();for(let i=0;i<7;i++)f.complete();assert.equal(f.state().phase,'complete');assert.equal(f.get('victory').hidden,false);assert.equal(f.logs().filter(e=>e.event==='attack_success').length,7);assert.equal(f.logs().filter(e=>e.event==='session_complete').length,1);f.get('replay').onclick();assert.equal(f.state().stage,'tap');assert.equal(f.state().phase,'ready');assert.equal(f.logs().at(-1).run,2);
});
test('early release resets energy and successful retry is recorded as attempt two',()=>{
  const f=fixture();f.complete();f.event('pointerdown',{x:120,y:320});f.event('pointermove',{x:150,y:320});f.event('pointerup',{x:150,y:320});assert.equal(f.state().phase,'recharging');f.tick(400);assert.equal(f.state().progress,0);f.complete();const success=f.logs().filter(e=>e.event==='attack_success').at(-1);assert.equal(success.attemptsToSuccess,2);assert.ok(f.logs().some(e=>e.reason==='released_before_end'));
});
test('a held still finger receives hints and a pause record without ending attempt',()=>{
  const f=fixture();f.complete();f.event('pointerdown',{x:120,y:320});f.tick(2300);assert.equal(f.state().phase,'drawing');assert.ok(f.logs().some(e=>e.event==='finger_paused'));assert.ok(f.logs().some(e=>e.event==='hint_shown'&&e.duringTrace));assert.ok(Number(f.get('hint').style.opacity)>0);
});
test('off-path timeout, cancellation and secondary pointers recover safely',()=>{
  const f=fixture();f.complete();f.event('pointerdown',{x:120,y:320},2,false);assert.equal(f.state().attempt,0);f.event('pointerdown',{x:120,y:320});f.event('pointermove',{x:330,y:200});f.tick(240);assert.equal(f.state().phase,'recharging');assert.ok(f.logs().some(e=>e.reason==='left_path'));f.tick(400);f.event('pointerdown',{x:120,y:320});f.event('pointercancel',{x:130,y:320});f.tick(400);assert.equal(f.state().phase,'ready');assert.ok(f.logs().some(e=>e.reason==='pointer_cancelled'));
});
