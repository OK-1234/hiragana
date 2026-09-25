(function(root){
  'use strict';
  const core=typeof module!=='undefined'&&module.exports?require('./core.js'):root.FingerGame;
  // One-stroke shapes authored for this game. Coordinates are on a 100-unit square.
  // Add a letter with a stroke, ordered landmarks and an initial direction.
  const letters=[
    {id:'shi',glyph:'し',stroke:{lead:[[28,10],[28,60]],curve:[[28,60],[22,103],[65,99],[83,68]]},gates:[[28,10],[28,47],[34,83],[62,84],[83,68]],direction:{x:0,y:1}},
    {id:'ku',glyph:'く',stroke:{points:[[78,10],[27,50],[78,90]]},gates:[[78,10],[53,30],[27,50],[53,71],[78,90]],direction:{x:-1,y:1}}
  ];
  const decoy={id:'tsu',glyph:'つ',stroke:{curve:[[15,30],[110,0],[111,84],[44,89]]}};
  const candidates=[...letters,decoy];
  const modes=['look','choose','trace','copy','memory'];
  const board={x:25,y:242,width:310,height:187};
  const toBoard=p=>({x:88+p.x*1.85,y:248+p.y*1.85});
  const fromBoard=p=>({x:(p.x-88)/1.85,y:(p.y-248)/1.85});
  const inside=p=>p.x>=board.x&&p.x<=board.x+board.width&&p.y>=board.y&&p.y<=board.y+board.height;
  function pathFor(letter){const base=core.geometry(letter.stroke);const points=base.points.map(p=>({...toBoard(p),s:p.s*1.85}));return {points,length:base.length*1.85,path:points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')}}
  function resample(points,step=5){const out=points.length?[points[0]]:[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(core.distance(a,b)/step));for(let j=1;j<=n;j++)out.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n})}return out}
  // Free writing: no hidden per-pixel tracing. Check broad ordered regions only
  // after lift, plus initial direction, effort and a generous scribble limit.
  function judgeStroke(letter,raw){
    const points=resample(raw.map(fromBoard)),geo=core.geometry(letter.stroke);
    if(points.length<2)return {ok:false,reason:'short_stroke',coverage:0};
    let length=0;for(let i=1;i<points.length;i++)length+=core.distance(points[i-1],points[i]);
    const start=letter.gates[0],end=letter.gates.at(-1),first=points[0],last=points.at(-1);
    if(core.distance(first,{x:start[0],y:start[1]})>30)return {ok:false,reason:'start_region',coverage:0};
    const motion=points.find(p=>core.distance(first,p)>18);
    if(!motion)return {ok:false,reason:'short_stroke',coverage:0};
    const dx=motion.x-first.x,dy=motion.y-first.y,d=letter.direction;
    if((dx*d.x+dy*d.y)/Math.hypot(dx,dy)/Math.hypot(d.x,d.y)<.3)return {ok:false,reason:'initial_direction',coverage:0};
    let gate=0;
    for(const p of points){if(gate<letter.gates.length&&core.distance(p,{x:letter.gates[gate][0],y:letter.gates[gate][1]})<24)gate++}
    const result={coverage:gate/letter.gates.length,length:Math.round(length)};
    if(length<geo.length*.55||length>geo.length*2.8)return {...result,ok:false,reason:'stroke_extent'};
    if(gate<letter.gates.length||core.distance(last,{x:end[0],y:end[1]})>30)return {...result,ok:false,reason:'regions_incomplete'};
    return {...result,ok:true};
  }
  function hintAt(idle,mode){
    if(mode==='trace')return {level:1,visible:true};
    if(idle<2800)return {level:0,visible:false};
    if(idle<5800)return {level:1,visible:(idle-2800)%1600<1000};
    if(idle<9500)return {level:2,visible:(idle-5800)%2200<1700};
    return {level:mode==='memory'?3:2,visible:(idle-9500)%5600<1600};
  }
  class Battle{
    constructor({now=()=>performance.now(),onEvent=()=>{}}={}){this.now=now;this.onEvent=onEvent;this.active=false;this.run=0}
    get letter(){return letters[this.letterIndex]}
    get mode(){return modes[this.modeIndex]}
    emit(type,extra={}){this.onEvent({route:'letters',run:this.run,character:this.letter.id,glyph:this.letter.glyph,mode:this.mode,attempt:this.attempt,event:type,timeMs:Math.round(this.now()),...extra})}
    start(){this.active=true;this.run++;this.letterIndex=0;this.modeIndex=0;this.enter()}
    stop(){if(this.phase==='drawing')this.cancel('route_left');this.active=false}
    enter(){
      this.geo=pathFor(this.letter);this.phase=this.mode==='look'?'observing':this.mode==='memory'?'preview':'ready';
      this.since=this.now();this.lastMotion=this.since;this.attempt=0;this.progress=0;this.ink=[];this.hints=[];this.pauseStarted=null;this.offSince=null;this.lastHint=0;
      this.emit('stage_shown');
    }
    observed(){if(this.phase!=='observing')return;this.emit('look_completed');this.modeIndex=1;this.enter()}
    choose(id){if(this.mode!=='choose'||this.phase!=='ready')return;this.attempt++;this.attemptStart=this.now();this.emit('choice',{selected:id});if(id===this.letter.id)this.success();else this.retry('barrier_deflected')}
    down(p){
      if(!this.active||this.phase!=='ready'||!['trace','copy','memory'].includes(this.mode)||!inside(p))return false;
      if(this.mode==='trace'&&core.distance(p,this.geo.points[0])>37){this.emit('touch_outside_start');return false}
      this.phase='drawing';this.attempt++;this.attemptStart=this.now();this.lastMotion=this.now();this.progress=0;this.ink=[p];this.offSince=null;this.pauseStarted=null;this.lastHint=0;this.emit('stroke_started');return true;
    }
    resumeMotion(){if(this.pauseStarted!==null){this.emit('pause_ended',{durationMs:Math.round(this.now()-this.pauseStarted)});this.pauseStarted=null}this.lastMotion=this.now();this.lastHint=0}
    move(p){
      if(this.phase!=='drawing')return;
      if(this.mode==='trace'){
        const result=core.advance(this.geo,this.progress,p,33);
        if(!result.onPath){this.offSince??=this.now();return}
        this.offSince=null;if(result.progress>this.progress+1)this.resumeMotion();this.progress=result.progress;if(result.complete)this.success();
      }else if(inside(p)&&core.distance(p,this.ink.at(-1))>1.5){this.resumeMotion();this.ink.push(p)}
    }
    up(){if(this.phase!=='drawing')return;if(this.mode==='trace'){this.retry('released_before_end');return}const result=judgeStroke(this.letter,this.ink);this.emit('stroke_checked',result);if(result.ok)this.success();else this.retry(result.reason)}
    cancel(reason='pointer_cancelled'){if(this.phase==='drawing')this.retry(reason)}
    endPause(){if(this.pauseStarted!==null){this.emit('pause_ended',{durationMs:Math.round(this.now()-this.pauseStarted)});this.pauseStarted=null}}
    retry(reason){this.endPause();this.phase='retrying';this.since=this.now();this.emit('attempt_ended',{reason,retries:this.attempt,progressRatio:this.mode==='trace'?this.progress/this.geo.length:undefined,durationMs:Math.round(this.now()-this.attemptStart)})}
    success(){this.endPause();this.phase='attacking';this.since=this.now();this.emit('attack_success',{attemptsToSuccess:this.attempt,retries:Math.max(0,this.attempt-1),durationMs:Math.round(this.now()-this.attemptStart),hintLevels:[...this.hints],power:this.mode==='memory'?'ultimate':this.mode==='copy'?'strong':'beam'})}
    nextLetter(){if(this.phase!=='defeated')return false;if(this.letterIndex===letters.length-1)return false;this.letterIndex++;this.modeIndex=0;this.enter();return true}
    suspend(){this.cancel('page_hidden');this.hiddenAt=this.now()}
    resume(){if(this.hiddenAt!==undefined){const elapsed=this.now()-this.hiddenAt;this.since+=elapsed;this.lastMotion+=elapsed;this.hiddenAt=undefined}}
    tick(){
      if(!this.active||this.hiddenAt!==undefined)return;
      const elapsed=this.now()-this.since;
      if(this.phase==='observing'&&elapsed>=2400){this.observed();return}
      if(this.phase==='preview'&&elapsed>=1900){this.phase='ready';this.lastMotion=this.now();this.emit('model_hidden');return}
      if(this.phase==='retrying'&&elapsed>=500){this.phase='ready';this.ink=[];this.progress=0;this.lastMotion=this.now();this.offSince=null;this.lastHint=0;this.emit('retry_ready');return}
      if(this.phase==='attacking'&&elapsed>=(this.mode==='memory'?1700:950)){
        if(this.mode==='memory'){this.phase='defeated';this.emit('enemy_defeated',{lastLetter:this.letterIndex===letters.length-1})}
        else {this.modeIndex++;this.enter()}return;
      }
      if(this.phase==='drawing'&&this.offSince!==null&&this.now()-this.offSince>420){this.retry('left_path');return}
      if(!['ready','drawing'].includes(this.phase)||!['trace','copy','memory'].includes(this.mode))return;
      const idle=this.now()-this.lastMotion;
      if(this.phase==='drawing'&&idle>1800&&this.pauseStarted===null){this.pauseStarted=this.lastMotion;this.emit('finger_paused',{idleMs:Math.round(idle),progressRatio:this.mode==='trace'?this.progress/this.geo.length:undefined})}
      const hint=hintAt(idle,this.mode);
      if(hint.visible&&hint.level>this.lastHint){this.lastHint=hint.level;if(!this.hints.includes(hint.level))this.hints.push(hint.level);this.emit('hint_shown',{level:hint.level,duringStroke:this.phase==='drawing'})}
    }
  }
  const api={letters,candidates,modes,board,pathFor,toBoard,fromBoard,judgeStroke,hintAt,Battle};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LetterGame=api;
})(typeof window!=='undefined'?window:globalThis);
