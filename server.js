// Optional local preview. No dependencies, external services or saved play data.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const files=new Set(['index.html','style.css','core.js','game.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{
  let name;
  try{name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html'}
  catch{res.writeHead(400);res.end('Bad request');return}
  if(!files.has(name)){res.writeHead(404);res.end('Not found');return}
  fs.readFile(path.join(__dirname,name),(error,data)=>{if(error){res.writeHead(500);res.end();return}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store'});res.end(data)});
}).listen(4173,'0.0.0.0',()=>console.log('ゆびで！ビーム: http://localhost:4173'));
