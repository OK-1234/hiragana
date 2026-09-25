const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./core.js');
const {letters,pathFor,toBoard,judgeStroke,hintAt,Battle}=require('./letters.js');
function fixture(){let now=0;const events=[];const battle=new Battle({now:()=>now,onEvent:e=>events.push(e)});battle.start();return {battle,events,tick(ms){now+=ms;battle.tick()}}}
function draw(battle,points=pathFor(battle.letter).points){assert.equal(battle.down(points[0]),true);for(const p of points)battle.move(p);battle.up()}
function reach(f,mode){if(mode==='look')return;f.battle.observed();if(mode==='choose')return;f.battle.choose(f.battle.letter.id);f.tick(960);if(mode==='trace')return;draw(f.battle);f.tick(960);if(mode==='copy')return;draw(f.battle);f.tick(960);f.tick(1901)}
test('both letters follow look, choose, trace, copy, memory and enemy defeat in order',()=>{
  const f=fixture();for(let i=0;i<letters.length;i++){reach(f,'memory');assert.equal(f.battle.mode,'memory');assert.equal(f.battle.phase,'ready');draw(f.battle);assert.equal(f.events.at(-1).power,'ultimate');f.tick(1701);assert.equal(f.battle.phase,'defeated');if(i===0)assert.equal(f.battle.nextLetter(),true)}
  assert.deepEqual(f.events.filter(e=>e.event==='stage_shown').map(e=>e.mode),['look','choose','trace','copy','memory','look','choose','trace','copy','memory']);assert.equal(f.events.filter(e=>e.event==='enemy_defeated').length,2);assert.equal(f.battle.nextLetter(),false);
});
test('look auto advances; wrong selection deflects then succeeds on second try',()=>{
  const f=fixture();f.tick(2401);assert.equal(f.battle.mode,'choose');f.battle.choose('tsu');assert.equal(f.battle.phase,'retrying');f.tick(501);f.battle.choose('shi');assert.equal(f.battle.phase,'attacking');assert.equal(f.events.at(-1).attemptsToSuccess,2);
});
test('trace tolerates small deviation but does not accept start-to-end teleport',()=>{
  const f=fixture();reach(f,'trace');const g=f.battle.geo;f.battle.down(g.points[0]);f.battle.move(g.points.at(-1));assert.equal(f.battle.phase,'drawing');f.tick(430);assert.equal(f.battle.phase,'retrying');f.tick(501);draw(f.battle,g.points.map(p=>({x:p.x+12,y:p.y})));assert.equal(f.battle.phase,'attacking');
});
test('free writing accepts wobbles and translation, rejects taps, reversal and shortcuts',()=>{
  for(const letter of letters){const points=pathFor(letter).points;const wobble=points.map((p,i)=>({x:p.x+10+Math.sin(i*.2)*8,y:p.y-8+Math.cos(i*.2)*6}));assert.equal(judgeStroke(letter,wobble).ok,true,letter.id);assert.equal(judgeStroke(letter,[points[0]]).ok,false);assert.equal(judgeStroke(letter,[...points].reverse()).ok,false);assert.equal(judgeStroke(letter,[points[0],points.at(-1)]).ok,false)}
});
test('free writing shows ink throughout the attempt instead of enforcing a trace',()=>{
  const f=fixture();reach(f,'copy');f.battle.down({x:140,y:270});f.battle.move({x:300,y:300});f.tick(500);assert.equal(f.battle.phase,'drawing');assert.equal(f.battle.ink.length,2);f.battle.up();assert.equal(f.battle.phase,'retrying');f.tick(501);draw(f.battle);assert.equal(f.battle.phase,'attacking');
});
test('memory preview blocks drawing and hints progress then disappear',()=>{
  const f=fixture();reach(f,'copy');draw(f.battle);f.tick(960);assert.equal(f.battle.phase,'preview');assert.equal(f.battle.down(toBoard({x:28,y:10})),false);f.tick(1901);f.tick(2900);f.tick(3000);f.tick(3700);assert.deepEqual(f.events.filter(e=>e.mode==='memory'&&e.event==='hint_shown').map(e=>e.level),[1,2,3]);assert.equal(hintAt(9600,'memory').visible,true);assert.equal(hintAt(11400,'memory').visible,false);assert.equal(hintAt(0,'copy').level,0);assert.equal(hintAt(20000,'copy').level,2);
});
test('pause duration, hints and retry count are recorded locally',()=>{
  const f=fixture();reach(f,'memory');const points=f.battle.geo.points;f.battle.down(points[0]);f.tick(3100);f.battle.move(points[12]);assert.ok(f.events.some(e=>e.event==='pause_ended'&&e.durationMs===3100));f.battle.cancel();f.tick(501);draw(f.battle);assert.equal(f.events.at(-1).retries,1);assert.ok(f.events.at(-1).hintLevels.includes(1));
});
test('hidden page freezes preview time and cancellation allows retry',()=>{
  const f=fixture();reach(f,'copy');draw(f.battle);f.tick(960);f.battle.suspend();f.tick(20000);f.battle.resume();f.battle.tick();assert.equal(f.battle.phase,'preview');f.tick(1901);f.battle.down(f.battle.geo.points[0]);f.battle.cancel();f.tick(501);assert.equal(f.battle.phase,'ready');assert.ok(f.events.some(e=>e.reason==='pointer_cancelled'));
});
