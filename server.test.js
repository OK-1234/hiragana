const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {once}=require('node:events');

// Run the real request handler on an ephemeral loopback port, without changing
// the preview server's port or exposing the test listener to the local network.
test('preview server safely handles public assets and invalid requests',async t=>{
  let server;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'server.js'),'utf8'),{
    __dirname,URL,console:{log(){}},
    require:name=>name==='node:http'?{
      createServer:handler=>({listen:()=>{server=http.createServer(handler).listen(0,'127.0.0.1')}})
    }:require(name)
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  await once(server,'listening');
  const request=target=>new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port:server.address().port,path:target},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);
      res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
    });
    req.on('error',reject);
  });
  await t.test('malformed request returns 400 and the next request still works',async()=>{
    assert.equal((await request('//[')).status,400);
    assert.equal((await request('/')).status,200);
  });
  await t.test('only the six game files are served unchanged',async()=>{
    for(const file of ['index.html','style.css','core.js','game.js','letters.js','letter-ui.js']){
      const response=await request('/'+file);
      assert.equal(response.status,200);
      assert.equal(response.body,fs.readFileSync(path.join(__dirname,file),'utf8'));
    }
  });
  await t.test('private paths, source tests and traversal do not expose files',async()=>{
    for(const target of ['/.env','/.git/config','/server.js','/server.test.js','/README.md','/package.json','/../server.js','/%2e%2e%2fserver.js']){
      const response=await request(target);assert.equal(response.status,404,target);assert.equal(response.body,'Not found');
    }
  });
});
