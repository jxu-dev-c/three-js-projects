// Deterministic model review: node scripts/review-stations.cjs [git-ref]
// Builds an isolated viewer in node_modules/.cache; serves localhost:8091.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const webpack = require('webpack');
const http = require('http');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'node_modules/.cache/station-review');
const source = 'src/components/space-ship-app/util/tactical';
fs.mkdirSync(out, { recursive: true });
const ref = process.argv[2];
for (const name of ['stations.ts', 'wireframe.ts', 'markers.ts', 'palette.ts', 'engineering.ts']) {
  if (ref && name === 'engineering.ts') continue;
  const content = ref ? cp.execFileSync('git', ['show', `${ref}:${source}/${name}`]) : fs.readFileSync(path.join(root, source, name));
  fs.writeFileSync(path.join(out, name), content);
}
fs.writeFileSync(path.join(out, 'entry.ts'), `
import * as THREE from 'three';
import { buildStations } from './stations';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
const types = ['generationShip','ringResort','modularLab','shipyard','transferHub','relaySat','surfaceSite'];
const scene=new THREE.Scene(); scene.background=new THREE.Color('#060d17');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1000,750); renderer.setPixelRatio(1); document.body.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1000/750,0.01,500);
const composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1000,750),0.7,0.35,0.95)); composer.addPass(new OutputPass());
let current, rig;
window.review = {
 types,
 show(type,highlight=false,angle=0) {
  if(current) { scene.remove(current); const gs=new Set(), ms=new Set();current.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose()); }
  const planet=new THREE.Group();const surface=new THREE.Group();planet.add(surface);
  rig=buildStations(planet,{planet:{mesh:surface,radius:1}},[{id:'review',name:type,type,kind:'orbital',orbit:{radius:0,speed:0},readout:{alt:'REVIEW',status:'ONLINE'}}]);
  const entry=rig.registry.get('review'); current=entry.objects[0]; current.removeFromParent();
  current.rotation.set(0,angle,0);scene.add(current);entry.highlight(highlight);
  const bounds=new THREE.Box3().setFromObject(current), sphere=bounds.getBoundingSphere(new THREE.Sphere());
  camera.position.copy(sphere.center).add(new THREE.Vector3(1,0.75,1.25).normalize().multiplyScalar(sphere.radius/Math.sin(THREE.MathUtils.degToRad(17.5))*1.12));camera.lookAt(sphere.center);
  this.render();return this.stats();
 },
 render(){renderer.info.reset();renderer.info.autoReset=false;composer.render();},
 stats(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,geometries:renderer.info.memory.geometries}},
 capture(){return renderer.domElement.toDataURL('image/png')},
 spin(dt){rig.update(dt);this.render()},
 benchmark(){const samples=[];for(let i=0;i<15;i++){const start=performance.now();this.render();renderer.getContext().finish();if(i>=5)samples.push(performance.now()-start)}samples.sort((a,b)=>a-b);return {medianMs:samples[5],p95Ms:samples[9]}}
};
window.review.show(types[0]);document.title='Station geometry review';
`);
webpack({mode:'development',devtool:false,entry:path.join(out,'entry.ts'),output:{path:out,filename:'viewer.js'},resolve:{extensions:['.ts','.js']},module:{rules:[{test:/\.ts$/,use:{loader:'babel-loader',options:{presets:['@babel/preset-typescript']}}}]}},(err,stats)=>{
 if(err || stats.hasErrors()){console.error(err || stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/viewer.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/viewer.js'?fs.readFileSync(path.join(out,'viewer.js')):'<!doctype html><body style="margin:0;background:#060d17"><script src="/viewer.js"></script>');});
 server.listen(8091,'127.0.0.1',()=>console.log('Review viewer http://localhost:8091 ('+(ref||'working tree')+')'));
});
