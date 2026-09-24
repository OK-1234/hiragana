(() => {
  'use strict';
  const {stages,geometry,advance,distance}=FingerGame;
  const $=id=>document.getElementById(id),arena=$('arena'),ns='http://www.w3.org/2000/svg';
  const actors=[['🐱','みけ','#fff0d7'],['🐰','もも','#ffe8ef'],['🐻','くまくん','#f5e7db'],['🦊','こん','#ffead7'],['🐼','ぱんちゃん','#e9e9fc']];
  const records=[];
  let run=1,index=0,geo,phase='ready',pointer=null,progress=0,attempt=0,attemptStart=0,lastActivity=performance.now(),lastProgress=lastActivity,offSince=null,stallLogged=false,hintLogged=false,attemptHints=0,attemptStops=0,soundOn=false,audioContext=null,actorIndex=0;
  const timers=new Set();
  function later(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn()},delay);timers.add(id)}
  function record(type,details={}){const row={run,stage:stages[index].id,label:stages[index].label,attempt,event:type,timeMs:Math.round(performance.now()),...details};records.push(row);console.info('[ゆびビーム]',row);if(!$('debug').hidden)renderDebug()}
  function renderDebug(){$('debug-output').textContent=JSON.stringify(records,null,2)}
  // This session-only event stream can later feed an adaptive stage selector.
  window.fingerBeamDebug={getRecords:()=>structuredClone(records),getState:()=>({stage:stages[index].id,phase,progress,attempt}),stages};
  function sound(kind){
    if(!soundOn)return;
    try{
      audioContext??=new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const patterns={touch:[[660,.06]],charge:[[500,.035]],attack:[[330,.12],[800,.14]],success:[[660,.08],[880,.08],[1100,.16]],reaction:[[240,.08],[170,.13]],block:[[330,.06],[260,.1]]};
      let when=audioContext.currentTime;
      for(const [freq,duration] of patterns[kind]||[]){const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=kind==='reaction'?'triangle':'sine';o.frequency.setValueAtTime(freq,when);g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(.055,when+.008);g.gain.exponentialRampToValueAtTime(.001,when+duration);o.connect(g);g.connect(audioContext.destination);o.start(when);o.stop(when+duration+.015);when+=duration}
    }catch{/* Audio is an optional enhancement. */}
  }
  $('sound').onclick=()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',soundOn);$('sound').setAttribute('aria-label',soundOn?'音をオフにする':'音をオンにする');$('sound-label').textContent=soundOn?'おと ON':'おと OFF';if(soundOn)sound('touch')};
  function comment(text,cheer=false){const [icon,name,color]=actors[actorIndex++%actors.length],el=document.createElement('div');el.className='comment'+(cheer?' cheer':'');const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--avatar',color);avatar.textContent=icon;const body=document.createElement('span');body.className='comment-text';const nick=document.createElement('small');nick.textContent=name;const message=document.createElement('span');message.textContent=text;body.append(nick,message);el.append(avatar,body);$('chat').append(el);while($('chat').children.length>6)$('chat').firstChild.remove()}
  function svgEl(tag,attrs){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);$('effects').append(el);return el}
  function toast(text){$('toast').classList.remove('show');$('toast').textContent=text;void $('toast').offsetWidth;$('toast').classList.add('show')}
  function position(el,p){el.setAttribute('transform',`translate(${p.x} ${p.y})`)}
  function paintProgress(){for(const id of ['charged','charged-glow'])$(id).setAttribute('d',progress>0?'M'+geo.points.filter(p=>p.s<=progress).map(p=>`${p.x},${p.y}`).join(' L'):'');const point=geo.points.find(p=>p.s>=progress)||geo.points.at(-1);$('finger').setAttribute('cx',point.x);$('finger').setAttribute('cy',point.y)}
  function setup(){
    geo=geometry(stages[index]);phase='ready';progress=0;attempt=0;pointer=null;lastActivity=performance.now();lastProgress=lastActivity;hintLogged=false;offSince=null;
    $('trail').style.display='';$('trail').classList.remove('recharging');$('finger').setAttribute('visibility','hidden');$('victory').hidden=true;$('hint').style.opacity=0;$('effects').replaceChildren();$('enemy-wrap').classList.remove('hit','blocked');$('cue').textContent=stages[index].cue;
    const tap=stages[index].kind==='tap';for(const id of ['rail-shadow','rail','guide'])$(id).setAttribute('d',tap?'':geo.path);paintProgress();position($('start'),geo.points[0]);position($('finish'),geo.points.at(-1));$('finish').style.display=tap?'none':'';$('start').style.opacity=1;
    $('footer-cue').textContent=tap?'ひかる ほしに さわってみよう':'ひかる みちを ゆびで すーっ';
    $('steps').innerHTML=stages.map((s,i)=>`<span class="step ${i<index?'done':i===index?'current':''}"></span>`).join('');$('steps').setAttribute('aria-label',`7つのあそびの${index+1}番目`);
    $('barriers').innerHTML=stages.map((_,i)=>`<span class="${i<index?'used':''}"></span>`).join('');record('stage_shown');
  }
  function release(){if(pointer!==null&&arena.hasPointerCapture(pointer))arena.releasePointerCapture(pointer);pointer=null}
  function recharge(reason){
    if(phase!=='drawing')return;record('attempt_ended',{reason,progressRatio:Math.round(progress/geo.length*100)/100,durationMs:Math.round(performance.now()-attemptStart)});phase='recharging';release();$('finger').setAttribute('visibility','hidden');$('hint').style.opacity=0;$('trail').classList.add('recharging');$('enemy-wrap').classList.add('blocked');sound('block');comment(['もういっかい！','いけるいける！','ここまできた！'][attempt%3]);
    later(()=>{phase='ready';progress=0;offSince=null;paintProgress();$('trail').classList.remove('recharging');$('enemy-wrap').classList.remove('blocked');$('start').style.opacity=1;lastActivity=performance.now();hintLogged=false},380);
  }
  function succeed(){
    if(!['ready','drawing'].includes(phase))return;
    record('attack_success',{attemptsToSuccess:attempt,durationMs:Math.round(performance.now()-attemptStart),hints:attemptHints,stops:attemptStops});phase='attacking';release();$('hint').style.opacity=0;$('finger').setAttribute('visibility','hidden');progress=geo.length;paintProgress();sound('attack');
    const p=geo.points.at(-1);svgEl('line',{x1:p.x,y1:p.y,x2:180,y2:112,class:'beam'});svgEl('line',{x1:p.x,y1:p.y,x2:180,y2:112,class:'beam-core'});
    $('enemy-wrap').classList.remove('hit');void arena.getBoundingClientRect();$('enemy-wrap').classList.add('hit');
    svgEl('circle',{cx:180,cy:112,r:50,fill:'none',stroke:'#fff8bf','stroke-width':8,class:'ring'});
    for(let i=0;i<16;i++){const angle=i*Math.PI/8,el=svgEl(i%2?'circle':'rect',i%2?{cx:180,cy:112,r:4,fill:['#b89aff','#ffd579','#fff'][i%3],class:'particle'}:{x:177,y:109,width:7,height:7,rx:2,fill:['#a9dea3','#ffd579','#cbb1fb'][i%3],class:'particle'});el.style.setProperty('--dx',`${Math.cos(angle)*(60+i%4*12)}px`);el.style.setProperty('--dy',`${Math.sin(angle)*(60+i%4*12)}px`)}
    $('barriers').children[index].classList.add('used');toast(['びーむ！','きらーん！','やったー！'][index%3]);comment('きたーー！！',true);later(()=>{sound('reaction');comment('👏👏👏👏',true)},170);later(()=>{sound('success');comment('すごい！',true)},360);later(()=>comment('やったーー！',true),570);
    later(()=>{if(index<stages.length-1){index++;setup()}else{phase='complete';$('trail').style.display='none';$('cue').textContent='';$('victory').hidden=false;$('steps').querySelectorAll('.step').forEach(el=>el.className='step done');$('footer-cue').textContent='いっぱい あそんだね！';record('session_complete')}},1250);
  }
  function localPoint(e){const matrix=arena.getScreenCTM();return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse())}
  arena.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0||phase!=='ready')return;e.preventDefault();lastActivity=performance.now();const p=localPoint(e);
    if(distance(p,geo.points[0])>37){record('touch_outside_start',{x:Math.round(p.x),y:Math.round(p.y)});lastActivity-=1800;return}
    attempt++;attemptHints=0;attemptStops=0;attemptStart=lastActivity;lastProgress=lastActivity;stallLogged=false;hintLogged=false;offSince=null;pointer=e.pointerId;arena.setPointerCapture(pointer);record('start_touched');sound('touch');
    if(stages[index].kind==='tap'){succeed();return}phase='drawing';progress=0;$('start').style.opacity=.45;$('finger').setAttribute('visibility','visible');paintProgress();
  });
  function move(e){
    if(phase!=='drawing'||e.pointerId!==pointer)return;e.preventDefault();
    const samples=e.getCoalescedEvents?.()||[];
    for(const sample of samples.length?samples:[e]){
      if(phase!=='drawing')break;const p=localPoint(sample),now=performance.now(),result=advance(geo,progress,p);
      if(!result.onPath){offSince??=now;continue}
      offSince=null;
      if(result.progress>progress+1){lastProgress=now;lastActivity=now;stallLogged=false;hintLogged=false;if(Math.floor(result.progress/55)>Math.floor(progress/55))sound('charge')}
      progress=result.progress;paintProgress();if(result.complete)succeed();
    }
  }
  arena.addEventListener('pointermove',move);
  arena.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;if(phase==='drawing')move(e);if(phase==='drawing')recharge('released_before_end')});
  arena.addEventListener('pointercancel',e=>{if(e.pointerId===pointer)recharge('pointer_cancelled')});
  arena.addEventListener('lostpointercapture',e=>{if(e.pointerId===pointer&&phase==='drawing')recharge('capture_lost')});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='drawing')recharge('page_hidden');lastActivity=performance.now()});
  function animate(now){
    if(!document.hidden){
      if(phase==='drawing'&&offSince!==null&&now-offSince>220)recharge('left_path');
      if(phase==='drawing'&&!stallLogged&&now-lastProgress>1800){stallLogged=true;attemptStops++;record('finger_paused',{progressRatio:Math.round(progress/geo.length*100)/100})}
      const idle=now-lastActivity;
      if(['ready','drawing'].includes(phase)&&idle>2100){
        if(!hintLogged){record('hint_shown',{duringTrace:phase==='drawing',progressRatio:geo.length?Math.round(progress/geo.length*100)/100:0});hintLogged=true;attemptHints++}
        const cycle=((idle-2100)%2400)/2400;
        const s=phase==='drawing'?Math.min(geo.length,progress+cycle*95):cycle*geo.length;
        const p=geo.points.find(q=>q.s>=s)||geo.points.at(-1);position($('hint'),p);$('hint').style.opacity=cycle>.9?(1-cycle)*10:.85;
      }else $('hint').style.opacity=0;
    }
    requestAnimationFrame(animate);
  }
  $('replay').onclick=()=>{for(const t of timers)clearTimeout(t);timers.clear();run++;index=0;setup();comment('もういっかい いこー！',true)};
  $('debug-toggle').onclick=()=>{$('debug').hidden=!$('debug').hidden;if(!$('debug').hidden)renderDebug()};
  $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,records},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='finger-beam-session.json';a.click();later(()=>URL.revokeObjectURL(url),1000)};
  comment('いっしょに あそぼ！');comment('いけーー！');comment('ここだよ！ ✨');
  setInterval(()=>{if(document.hidden||!['ready','drawing'].includes(phase))return;comment(['いけるいける！','わくわく！','おうえんしてるよ！','ゆっくりで いいよ！'][Math.floor(Math.random()*4)])},6500);
  setup();requestAnimationFrame(animate);
})();
