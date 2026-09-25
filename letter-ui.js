(() => {
  'use strict';
  const {candidates,modes,hintAt,Battle}=LetterGame;
  const feedback=window.fingerBeamBridge;
  const $=id=>document.getElementById(id),arena=$('arena');
  const ns='http://www.w3.org/2000/svg';
  const cues={look:'じゃくてん はっけん！',choose:'おなじ かたちは？',trace:'エネルギーを ためよう！',copy:'つよい ビーム！',memory:'ひっさつわざ！'};
  const chatter={look:['なんかでてきた！','このかたちか！','きらきらしてる！'],choose:['どれだどれだ？','みつけろー！','あのかたちだ！'],trace:['いけいけ！','そのままー！','ひかってる！'],copy:['じぶんでかいてる！','すごいすごい！','ビームを ためよう！'],memory:['いけーー！！','パワーが きてる！','おうえんしてるよ！']};
  const counts={};let pointer=null,lastChat=0,chargeStep=0,choiceOrder=[],flashUntil=0,modelGeometry;
  const battle=new Battle({onEvent:handle});
  function addComment(mode){const list=chatter[mode];const i=counts[mode]||0;feedback.comment(list[i%list.length]);counts[mode]=i+1;lastChat=performance.now()}
  function position(el,p){el.setAttribute('transform',`translate(${p.x} ${p.y})`)}
  function show(id,visible){$(id).style.display=visible?'':'none'}
  function release(){if(pointer!==null&&arena.hasPointerCapture(pointer))arena.releasePointerCapture(pointer);pointer=null}
  function pointsPath(points){if(points.length===1){const p=points[0];return `M${p.x},${p.y}L${p.x+.1},${p.y}`}return points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')}
  function shape(letter){return FingerGame.geometry(letter.stroke).path}
  function buildChoices(){
    $('letter-choices').replaceChildren();
    choiceOrder=[...candidates];for(let i=choiceOrder.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choiceOrder[i],choiceOrder[j]]=[choiceOrder[j],choiceOrder[i]]}
    for(const letter of choiceOrder){
      const button=document.createElement('button');button.className='letter-choice';button.setAttribute('aria-label',letter.glyph);button.dataset.letter=letter.id;
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 110');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(ns,'path');path.setAttribute('d',shape(letter));path.setAttribute('class','letter-stroke');path.setAttribute('stroke','currentColor');svg.append(path);button.append(svg);
      button.onclick=()=>battle.choose(letter.id);$('letter-choices').append(button);
    }
  }
  function stage(){
    release();chargeStep=0;flashUntil=0;$('effects').replaceChildren();$('enemy-wrap').classList.remove('hit','blocked','defeated');$('arena').classList.remove('ultimate');$('victory').hidden=true;$('letter-result').hidden=true;
    $('trail').style.display='none';$('letter-layer').style.display='';$('cue').textContent=cues[battle.mode];
    modelGeometry=FingerGame.geometry(battle.letter.stroke);
    $('letter-model-path').setAttribute('d',modelGeometry.path);$('letter-model-light').setAttribute('d',modelGeometry.path);
    $('letter-rail').setAttribute('d',battle.geo.path);$('letter-guide').setAttribute('d',battle.geo.path);$('letter-ink').setAttribute('d','');position($('letter-start'),battle.geo.points[0]);
    const end=battle.geo.points.at(-1);$('letter-end').setAttribute('cx',end.x);$('letter-end').setAttribute('cy',end.y);
    $('steps').replaceChildren();for(let i=0;i<modes.length;i++){const el=document.createElement('span');el.className='step '+(i<battle.modeIndex?'done':i===battle.modeIndex?'current':'');$('steps').append(el)}
    $('steps').setAttribute('aria-label',`文字のバトル ${battle.letterIndex+1}、5段階の${battle.modeIndex+1}番目`);
    $('barriers').replaceChildren();for(let i=1;i<5;i++){const el=document.createElement('span');el.className=i<battle.modeIndex?'used':'';$('barriers').append(el)}
    $('footer-cue').textContent={look:'ひかりの かたちを みつけよう',choose:'じゃくてんを ねらおう',trace:'ひかる みちを ゆびで すーっ',copy:'ちいさな みほんを みて かこう',memory:'おぼえた かたちで こうげき！'}[battle.mode];
    $('letter-exit').hidden=false;$('arena').setAttribute('aria-label',`${battle.letter.glyph}のバトル・${cues[battle.mode]}`);
    if(battle.mode==='choose')buildChoices();addComment(battle.mode);render();
  }
  function attack(power){
    release();const strong=power==='strong',ultimate=power==='ultimate';
    const end=battle.ink.at(-1)||battle.geo.points.at(-1);const p=battle.mode==='choose'?{x:180,y:330}:end;
    feedback.sound('attack');feedback.toast(ultimate?'ひっさつ！':strong?'パワービーム！':battle.mode==='choose'?'ばりあ ブレイク！':'びーむ！');
    $('enemy-wrap').classList.remove('hit','blocked');void arena.getBoundingClientRect();$('enemy-wrap').classList.add('hit');
    if(ultimate)$('arena').classList.add('ultimate');
    for(const offset of ultimate?[-24,0,24]:strong?[-8,8]:[0]){
      feedback.svgEl('line',{x1:p.x+offset,y1:p.y,x2:180+offset/3,y2:112,class:'beam'});
      feedback.svgEl('line',{x1:p.x+offset,y1:p.y,x2:180+offset/3,y2:112,class:'beam-core'});
    }
    feedback.svgEl('circle',{cx:180,cy:112,r:ultimate?80:50,fill:'none',stroke:ultimate?'#ffdc70':'#fff8bf','stroke-width':ultimate?14:7,class:'ring'});
    const n=ultimate?36:strong?22:12;
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n,el=feedback.svgEl('circle',{cx:180,cy:112,r:ultimate?5:3,fill:['#ffd56b','#bc94ff','#ffffff','#a6e6b9'][i%4],class:'particle'});el.style.setProperty('--dx',`${Math.cos(a)*(ultimate?140:85)}px`);el.style.setProperty('--dy',`${Math.sin(a)*(ultimate?135:70)}px`)}
    feedback.comment(ultimate?'ひっさつわざ！！':'きたーー！！',true);feedback.comment('👏👏👏👏👏',true);feedback.comment(ultimate?'かけた！！！':'やったーー！',true);feedback.sound('success');
    const used=Math.max(0,battle.modeIndex-1);$('barriers').children[used]?.classList.add('used');
  }
  function handle(event){
    feedback.recordLetter(event);
    if(event.event==='stage_shown')stage();
    if(event.event==='look_completed'){feedback.sound('touch');feedback.toast('みつけた！')}
    if(event.event==='stroke_started')feedback.sound('touch');
    if(event.event==='attack_success')attack(event.power);
    if(event.event==='attempt_ended'){
      release();$('enemy-wrap').classList.add('blocked');feedback.sound('block');feedback.comment(['おしい！','もういっかい！','いけるいける！'][(battle.attempt-1)%3]);
      if(battle.mode==='choose'){flashUntil=performance.now()+1200;feedback.comment('さっきのかたちを みてみよう！')}
    }
    if(event.event==='retry_ready')$('enemy-wrap').classList.remove('blocked');
    if(event.event==='enemy_defeated'){
      $('enemy-wrap').classList.add('defeated');$('letter-result').hidden=false;$('letter-trophy').textContent=battle.letter.glyph+' ✦';$('letter-next').textContent=event.lastLetter?'もういっかい ↻':'つぎの ほしへ ➜';feedback.comment('やったーーー！',true);feedback.sound('reaction');
      for(const dot of $('steps').children)dot.className='step done';
    }
  }
  function render(){
    if(!battle.active)return;
    const now=performance.now(),mode=battle.mode,phase=battle.phase,trace=mode==='trace',writing=['trace','copy','memory'].includes(mode),idle=now-battle.lastMotion;
    const hint=hintAt(idle,mode),interactive=['ready','drawing'].includes(phase);
    $('letter-choices').hidden=mode!=='choose';for(const button of $('letter-choices').children)button.disabled=phase!=='ready';
    $('letter-observe').hidden=phase!=='observing';
    show('letter-paper',writing&&phase!=='defeated');show('letter-rail',trace&&phase!=='defeated');show('letter-guide',trace&&phase!=='defeated');show('letter-end',trace&&phase!=='defeated');
    // A completed model lives above the blank board. Memory never shows it
    // persistently; level 3 briefly recalls it in the same separate location.
    const modelVisible=mode==='look'||mode==='copy'||phase==='preview'||(mode==='choose'&&now<flashUntil)||(mode==='memory'&&interactive&&hint.level===3&&hint.visible);
    show('letter-model',modelVisible&&phase!=='defeated');
    $('letter-model').setAttribute('transform',mode==='look'?'translate(124 58) scale(1.08)':'translate(271 151) scale(.48)');
    const base=modelGeometry,cycle=((now-battle.since)%1900)/1900;
    $('letter-model-light').setAttribute('stroke-dasharray',`8 ${base.length}`);$('letter-model-light').setAttribute('stroke-dashoffset',-cycle*base.length);
    $('enemy-wrap').style.opacity=mode==='look'?'.32':'1';
    const hintStart=interactive&&hint.visible&&hint.level===1;
    show('letter-start',writing&&((trace&&interactive)||hintStart));
    const moving=writing&&interactive&&(trace||hint.level===2&&hint.visible);
    show('letter-light',moving);
    if(moving){
      const ratio=(now%2100)/2100;
      const s=trace?(phase==='drawing'?Math.min(battle.geo.length,battle.progress+ratio*80):ratio*battle.geo.length):ratio*42;
      const p=battle.geo.points.find(q=>q.s>=s)||battle.geo.points.at(-1);$('letter-light').setAttribute('cx',p.x);$('letter-light').setAttribute('cy',p.y);
    }
    show('letter-ink',writing&&phase!=='defeated');
    const ink=trace?battle.geo.points.filter(p=>p.s<=battle.progress):battle.ink;
    $('letter-ink').setAttribute('d',pointsPath(ink));$('letter-ink').style.opacity=phase==='retrying'||battle.offSince!==null?'.3':'1';
    const charge=Math.floor((trace?battle.progress:battle.ink.length)/45);if(phase==='drawing'&&charge>chargeStep){feedback.sound('charge');chargeStep=charge}
  }
  function local(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(arena.getScreenCTM().inverse())}
  arena.addEventListener('pointerdown',e=>{
    if(!battle.active||!e.isPrimary||e.button!==0)return;e.preventDefault();
    if(battle.phase==='observing'){battle.observed();return}
    if(battle.down(local(e))){pointer=e.pointerId;arena.setPointerCapture(pointer);render()}
  });
  function move(e){if(!battle.active||e.pointerId!==pointer||battle.phase!=='drawing')return;e.preventDefault();const samples=e.getCoalescedEvents?.()||[];for(const sample of samples.length?samples:[e])battle.move(local(sample));render()}
  arena.addEventListener('pointermove',move);
  arena.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;move(e);battle.up();release();render()});
  arena.addEventListener('pointercancel',e=>{if(e.pointerId===pointer){battle.cancel();release();render()}});
  arena.addEventListener('lostpointercapture',e=>{if(e.pointerId===pointer){battle.cancel('capture_lost');pointer=null}});
  document.addEventListener('visibilitychange',()=>{if(!battle.active)return;if(document.hidden){battle.suspend();release()}else battle.resume()});
  function start(){feedback.leaveWarmup();$('arena').classList.add('letter-battle');battle.start()}
  function leave(){battle.stop();release();$('letter-layer').style.display='none';$('letter-choices').hidden=true;$('letter-result').hidden=true;$('letter-observe').hidden=true;$('letter-exit').hidden=true;$('enemy-wrap').style.opacity='1';$('enemy-wrap').classList.remove('defeated');$('arena').classList.remove('letter-battle','ultimate');$('arena').setAttribute('aria-label','光る点を触って、光の道を指でたどろう');feedback.restartWarmup()}
  $('letter-launch').onclick=start;$('letter-observe').onclick=()=>battle.observed();$('letter-warmup').onclick=leave;$('letter-exit').onclick=leave;
  $('letter-next').onclick=()=>{if(battle.phase!=='defeated')return;if(!battle.nextLetter())battle.start()};
  window.fingerBeamDebug.getLetterState=()=>({active:battle.active,letter:battle.letter?.id,mode:battle.mode,phase:battle.phase,attempt:battle.attempt,progress:battle.progress});
  function frame(){if(battle.active&&!document.hidden){battle.tick();render();if(performance.now()-lastChat>5800&&['observing','ready','drawing','preview'].includes(battle.phase))addComment(battle.mode)}requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
})();
