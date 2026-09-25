const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const core=require('./core.js'),letters=require('./letters.js');
function fixture(){
  let time=0,timerId=0;let frames=[];const timers=new Map(),elements=new Map();
  class Element{
    constructor(){this.children=[];this.attrs={};this.listeners={};this.style={setProperty(){}};this.dataset={};this.hidden=true;const classes=new Set();this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)}}
    setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}
    append(...els){els.forEach(el=>{el.parent=this;this.children.push(el)})}
    remove(){this.parent.children=this.parent.children.filter(e=>e!==this)}get firstChild(){return this.children[0]}
    replaceChildren(){this.children=[]}set innerHTML(v){this.children=Array.from(v.matchAll(/<span /g),()=>new Element())}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}getBoundingClientRect(){return {}}
    getScreenCTM(){return {inverse(){return {}}}}setPointerCapture(id){this.captured=id}hasPointerCapture(id){return this.captured===id}releasePointerCapture(){this.captured=null}querySelectorAll(){return this.children}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const window={FingerGame:core};const doc={hidden:false,getElementById:get,createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){}};
  const context=vm.createContext({window,FingerGame:core,LetterGame:letters,document:doc,console:{info(){}},performance:{now:()=>time},structuredClone,DOMPoint:class{constructor(x,y){this.x=x;this.y=y}matrixTransform(){return this}},requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,at:time+ms});return timerId},clearTimeout:id=>timers.delete(id),setInterval(){}});
  // Use the same clock in the real letter engine and the UI fixture.
  vm.runInContext(fs.readFileSync('letters.js','utf8'),context);context.LetterGame=window.LetterGame;
  for(const file of ['game.js','letter-ui.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  const tick=ms=>{const end=time+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn()}time=end;const current=frames;frames=[];current.forEach(fn=>fn(time))};
  const event=(name,p,id=1,primary=true)=>{for(const fn of get('arena').listeners[name]||[])fn({clientX:p.x,clientY:p.y,pointerId:id,isPrimary:primary,button:0,pointerType:'touch',preventDefault(){}})};
  const drag=points=>{event('pointerdown',points[0]);points.forEach(p=>event('pointermove',p));event('pointerup',points.at(-1));tick(1)};
  return {get,tick,event,drag,debug:window.fingerBeamDebug};
}
test('warm-up connects to both letter battles; touch handlers reach defeat and warm-up replay',()=>{
  const f=fixture();for(const stage of core.stages){const points=core.geometry(stage).points;f.drag(points);f.tick(1300)}assert.equal(f.get('victory').hidden,false);f.get('letter-launch').onclick();assert.equal(f.debug.getLetterState().mode,'look');f.tick(2401);
  for(const letter of letters.letters){
    if(letter.id==='ku')f.tick(2401);
    f.get('letter-choices').children.find(b=>b.dataset.letter===letter.id).onclick();f.tick(960);
    f.drag(letters.pathFor(letter).points);f.tick(960);assert.equal(f.debug.getLetterState().mode,'copy');
    assert.equal(f.get('letter-rail').style.display,'none');assert.equal(f.get('letter-start').style.display,'none');assert.equal(f.get('letter-model').style.display,'');
    f.drag(letters.pathFor(letter).points);f.tick(960);assert.equal(f.debug.getLetterState().phase,'preview');f.tick(1901);assert.equal(f.get('letter-model').style.display,'none');
    f.drag(letters.pathFor(letter).points);f.tick(1701);assert.equal(f.get('letter-result').hidden,false);assert.equal(f.debug.getLetterState().phase,'defeated');
    if(letter.id==='shi')f.get('letter-next').onclick();
  }
  assert.equal(f.debug.getRecords().filter(e=>e.event==='enemy_defeated').length,2);f.get('letter-warmup').onclick();assert.equal(f.debug.getState().stage,'tap');assert.equal(f.debug.getState().phase,'ready');assert.equal(f.get('letter-layer').style.display,'none');
});
test('secondary touch is ignored, pointer cancellation releases capture and retries',()=>{
  const f=fixture();f.get('letter-launch').onclick();f.tick(2401);f.get('letter-choices').children.find(b=>b.dataset.letter==='shi').onclick();f.tick(960);const p=letters.pathFor(letters.letters[0]).points[0];f.event('pointerdown',p,2,false);assert.equal(f.debug.getLetterState().attempt,0);f.event('pointerdown',p);assert.equal(f.get('arena').captured,1);f.event('pointercancel',p);f.tick(501);assert.equal(f.debug.getLetterState().phase,'ready');assert.equal(f.get('arena').captured,null);
});
