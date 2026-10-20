import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { allLegalMoves, chooseComputerMove, findKing, inCheck, initialBoard, legalMovesFrom, pieceNames, sideOf, type Board, type Move, type Piece, type Side } from './rules';
import './style.css';

const host=document.querySelector<HTMLDivElement>('#board3d')!;
const asset=(file:string)=>`${import.meta.env.BASE_URL}assets/${file}`;
document.querySelector<HTMLElement>('.app-shell')!.style.setProperty('--background-art',`url("${asset('siege.png')}")`);
const scene=new THREE.Scene(); scene.background=new THREE.Color('#211b17'); scene.fog=new THREE.FogExp2('#241a14',.018);
const camera=new THREE.PerspectiveCamera(37,1,.1,90);camera.position.set(0,12.2,15.4);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
const combatCanvas=document.querySelector<HTMLCanvasElement>('#combat3d')!;const combatRenderer=new THREE.WebGLRenderer({canvas:combatCanvas,antialias:true,alpha:true,powerPreference:'high-performance'});combatRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));combatRenderer.setClearColor(0x000000,0);combatRenderer.outputColorSpace=THREE.SRGBColorSpace;combatRenderer.toneMapping=THREE.ACESFilmicToneMapping;combatRenderer.toneMappingExposure=1.15;
const combatScene=new THREE.Scene();const combatCamera=new THREE.PerspectiveCamera(34,1,.1,50);combatCamera.position.set(0,3.25,10.2);combatCamera.lookAt(0,1.05,0);combatScene.add(new THREE.HemisphereLight('#e4e8f0','#21130e',2.1));const combatKey=new THREE.DirectionalLight('#ffddb2',3.1);combatKey.position.set(-3,7,6);combatScene.add(combatKey);const combatRim=new THREE.DirectionalLight('#a7caff',2.4);combatRim.position.set(3,4,-4);combatScene.add(combatRim);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.1,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minPolarAngle=.55;controls.maxPolarAngle=1.15;controls.minDistance=10;controls.maxDistance=23;
scene.add(new THREE.HemisphereLight('#ffe0b2','#291b16',2.05));
const keyLight=new THREE.DirectionalLight('#ffe0c0',3.25);keyLight.position.set(-5,10,8);keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.camera.left=-9;keyLight.shadow.camera.right=9;keyLight.shadow.camera.top=12;keyLight.shadow.camera.bottom=-12;keyLight.shadow.bias=-.0003;scene.add(keyLight);
const coolRim=new THREE.DirectionalLight('#a1c3f2',1.3);coolRim.position.set(7,7,-8);scene.add(coolRim);
const emberLight=new THREE.PointLight('#ff7b29',16,15,2);emberLight.position.set(-2,3,2);scene.add(emberLight);
const boardRoot=new THREE.Group();scene.add(boardRoot);const pieceLayer=new THREE.Group();scene.add(pieceLayer);
const raycaster=new THREE.Raycaster();raycaster.params.Line.threshold=.15;const pointer=new THREE.Vector2();
type Animated={object:THREE.Object3D;from:THREE.Vector3;to:THREE.Vector3;start:number;duration:number;kind:'move'|'fall'|'rise';done?:()=>void};const animated:Animated[]=[];
type HandMotion={root:THREE.Group;arm:THREE.Mesh;forearm:THREE.Mesh;palm:THREE.Group;start:THREE.Vector3;from:THREE.Vector3;to:THREE.Vector3;piece:THREE.Group;started:number;duration:number;side:Side};let handMotion:HandMotion|null=null;
type CombatMotion={started:number;duration:number;attacker:THREE.Group;defender:THREE.Group;weapon:THREE.Group;attackerKind:string;victimKind:string;particles:THREE.Points;particleVelocity:Float32Array;ring:THREE.Mesh;projectile:THREE.Mesh|null;hit:boolean};let combatMotion:CombatMotion|null=null;const combatRoot=new THREE.Group();combatScene.add(combatRoot);
let board:Board=initialBoard(),turn:Side=1,ply=0,selected:[number,number]|null=null,legal:[number,number][]=[],busy=false,paused=false,soundOn=true;
let history:{board:Board;turn:Side;ply:number;log:string[]}[]=[],logEntries=['戰鼓擂響，紅方先行。'];
const pieces=new Map<string,THREE.Group>();const markers=new THREE.Group();scene.add(markers);let lastMove:{from:[number,number];to:[number,number]}|null=null;
const pieceMaterial=(color:string,metalness=.5,roughness=.35)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const redDark=pieceMaterial('#671c12',.66,.3),blackDark=pieceMaterial('#101820',.72,.3),gold=pieceMaterial('#d3ae70',.72,.24),redEnamel=pieceMaterial('#aa3523',.44,.22),blueEnamel=pieceMaterial('#273c59',.55,.24);
function coords(x:number,y:number){return new THREE.Vector3(x-4,.08,y-4.5)}
function makeWoodTexture(){const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d')!;g.fillStyle='#a77b4b';g.fillRect(0,0,512,512);for(let i=0;i<260;i++){g.strokeStyle=`rgba(${i%3===0?'50,28,12':'245,197,125'},${Math.random()*.075})`;g.lineWidth=Math.random()*2+.25;const y=Math.random()*512;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(140,y-10,340,y+10,512,y+(Math.random()-.5)*22);g.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,2);return t;}
function buildBoard(){
  const wood=new THREE.MeshStandardMaterial({map:makeWoodTexture(),color:'#d4b183',roughness:.74,metalness:.06});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(9.5,.48,10.45),[pieceMaterial('#35251a',.5,.4),pieceMaterial('#35251a',.5,.4),wood,pieceMaterial('#35251a',.5,.4),pieceMaterial('#35251a',.5,.4),pieceMaterial('#35251a',.5,.4)]);slab.position.y=-.16;slab.receiveShadow=true;slab.castShadow=true;boardRoot.add(slab);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(9.6,.09,10.55),gold);edge.position.y=-.4;boardRoot.add(edge);
  const gridMat=new THREE.LineBasicMaterial({color:'#351f12',transparent:true,opacity:.83});const pts:THREE.Vector3[]=[];const gy=.092;
  for(let x=0;x<9;x++){pts.push(new THREE.Vector3(x-4,gy,-4.5),new THREE.Vector3(x-4,gy,4.5));}
  for(let y=0;y<10;y++){const z=y-4.5;if(y===4||y===5){pts.push(new THREE.Vector3(-4,gy,z),new THREE.Vector3(-3,gy,z),new THREE.Vector3(3,gy,z),new THREE.Vector3(4,gy,z));}else pts.push(new THREE.Vector3(-4,gy,z),new THREE.Vector3(4,gy,z));}
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),gridMat);boardRoot.add(grid);
  // Palace diagonals, river inlay, and small star points.
  const diagPts=[[-1,0,-4.5,1,0,-2.5],[1,0,-4.5,-1,0,-2.5],[-1,0,4.5,1,0,2.5],[1,0,4.5,-1,0,2.5]];const diagGeo=new THREE.BufferGeometry();diagGeo.setFromPoints(diagPts.map(v=>new THREE.Vector3(v[0],.096,v[2])));const diagLine=new THREE.LineSegments(diagGeo,new THREE.LineBasicMaterial({color:'#3c2415',opacity:.85,transparent:true}));boardRoot.add(diagLine);
  const riverMat=new THREE.MeshStandardMaterial({color:'#bb986a',roughness:.55,metalness:.13,transparent:true,opacity:.25});const river=new THREE.Mesh(new THREE.PlaneGeometry(8,.82),riverMat);river.rotation.x=-Math.PI/2;river.position.set(0,.088,0);boardRoot.add(river);
  for(const [x,y] of [[1,2],[7,2],[0,3],[2,3],[4,3],[6,3],[8,3],[1,7],[7,7],[0,6],[2,6],[4,6],[6,6],[8,6]]){const star=new THREE.Mesh(new THREE.CircleGeometry(.035,12),gold);star.rotation.x=-Math.PI/2;star.position.set(x-4,.101,y-4.5);boardRoot.add(star);}
  const base=new THREE.Mesh(new THREE.BoxGeometry(10,.25,10.9),pieceMaterial('#1a120c',.45,.45));base.position.y=-.53;base.castShadow=true;boardRoot.add(base);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#171412',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.68;ground.receiveShadow=true;scene.add(ground);
  const hazeTex=makeSmokeTexture();for(let i=0;i<9;i++){const haze=new THREE.Sprite(new THREE.SpriteMaterial({map:hazeTex,color:i%2?'#6b6258':'#be6835',transparent:true,opacity:.11,depthWrite:false}));haze.position.set((Math.random()-.5)*16,.1+Math.random()*1.2,(Math.random()-.5)*13);haze.scale.set(4+Math.random()*4,1.8+Math.random()*1.8,1);scene.add(haze);}
  const embers=new THREE.BufferGeometry(),positions=new Float32Array(340*3);for(let i=0;i<340;i++){positions[i*3]=(Math.random()-.5)*14;positions[i*3+1]=Math.random()*7;positions[i*3+2]=(Math.random()-.5)*15;}embers.setAttribute('position',new THREE.BufferAttribute(positions,3));const emberPoints=new THREE.Points(embers,new THREE.PointsMaterial({color:'#ff9c47',size:.035,transparent:true,opacity:.76,depthWrite:false}));scene.add(emberPoints);addOldGeneral();
}
function makeSmokeTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!,rad=g.createRadialGradient(64,64,2,64,64,63);rad.addColorStop(0,'rgba(205,190,170,.3)');rad.addColorStop(.45,'rgba(143,128,112,.15)');rad.addColorStop(1,'rgba(50,44,40,0)');g.fillStyle=rad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function labelTexture(text:string,isRed:boolean){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;const grad=g.createRadialGradient(88,70,8,128,128,132);grad.addColorStop(0,'#f1dfb7');grad.addColorStop(.72,'#d7c297');grad.addColorStop(1,'#a3875f');g.fillStyle=grad;g.fillRect(0,0,256,256);g.strokeStyle=isRed?'#85271c':'#3b3024';g.lineWidth=8;g.beginPath();g.arc(128,128,116,0,Math.PI*2);g.stroke();g.strokeStyle='#f4e3b9';g.lineWidth=2;g.beginPath();g.arc(128,128,104,0,Math.PI*2);g.stroke();g.fillStyle=isRed?'#9a2118':'#161515';g.font='bold 150px "Noto Serif TC",serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#fff1d0';g.shadowBlur=2;g.fillText(text,128,132);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function addOldGeneral(){
  const figure=new THREE.Group(),robe=pieceMaterial('#17333a',.32,.48),trim=pieceMaterial('#bd965b',.68,.3),skin=pieceMaterial('#9b7052',.05,.78),hair=pieceMaterial('#d4d0c4',.04,.88),darkHair=pieceMaterial('#3b3531',.02,.9);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.48,.68,1.18,12),robe);torso.position.y=.62;figure.add(torso);
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.56,16,10),robe);shoulder.scale.set(1,.56,.65);shoulder.position.y=1.05;figure.add(shoulder);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.27,.065,8,24),trim);collar.position.set(0,1.17,.02);figure.add(collar);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.34,18,14),skin);head.position.set(0,1.77,.05);figure.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.37,16,10,0,Math.PI*2,0,Math.PI*.55),darkHair);cap.position.set(0,1.99,.02);figure.add(cap);
  const crest=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,.26,8),trim);crest.position.set(0,2.23,.02);figure.add(crest);
  for(const side of [-1,1]){const brow=new THREE.Mesh(new THREE.BoxGeometry(.17,.04,.045),darkHair);brow.position.set(side*.13,1.84,.35);brow.rotation.z=side*.12;figure.add(brow);const mustache=new THREE.Mesh(new THREE.ConeGeometry(.105,.34,8),hair);mustache.position.set(side*.12,1.57,.34);mustache.rotation.z=side*-.85;figure.add(mustache);const beard=new THREE.Mesh(new THREE.ConeGeometry(.17,.86,10),hair);beard.position.set(side*.08,1.13,.22);beard.rotation.z=side*.1;figure.add(beard);}
  const beardCenter=new THREE.Mesh(new THREE.ConeGeometry(.18,.94,10),hair);beardCenter.position.set(0,1.18,.29);figure.add(beardCenter);
  figure.position.set(0,-.25,-5.95);figure.scale.setScalar(.94);figure.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(figure);
}
function setSegment(mesh:THREE.Mesh,from:THREE.Vector3,to:THREE.Vector3){const direction=to.clone().sub(from);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());mesh.scale.y=direction.length();}
function createHandMotion(piece:THREE.Group,from:[number,number],to:[number,number],side:Side){
  if(handMotion){scene.remove(handMotion.root);handMotion.root.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh,m=mesh.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();mesh.geometry.dispose();}});handMotion=null;}
  const red=side===1,sleeve=pieceMaterial(red?'#77261d':'#172c3b',.18,.56),skin=pieceMaterial(red?'#c99b75':'#a98469',.02,.75),goldCuff=pieceMaterial('#c09b61',.62,.34),root=new THREE.Group();
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.19,.3,1,16),sleeve),forearm=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1,14),skin);root.add(arm,forearm);
  const cuff=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,8,20),goldCuff);root.add(cuff);
  const palm=new THREE.Group(),palmPlate=new THREE.Mesh(new THREE.BoxGeometry(.27,.11,.31),skin);palm.add(palmPlate);
  for(let i=0;i<4;i++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.035,.13,3,6),skin);finger.position.set((i-1.5)*.065,-.015,-.2);finger.rotation.x=-.24;palm.add(finger);}
  const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.12,3,6),skin);thumb.position.set(.17,-.015,-.055);thumb.rotation.z=-.72;thumb.rotation.x=-.25;palm.add(thumb);root.add(palm);
  const start=new THREE.Vector3(0,1.5,side===1?5.95:-5.95);const hand={root,arm,forearm,palm,start,from:coords(...from),to:coords(...to),piece,started:performance.now(),duration:.88,side};scene.add(root);handMotion=hand;
}
function createPiece(p:Piece,x:number,y:number){const root=new THREE.Group();root.position.copy(coords(x,y));root.userData.boardX=x;root.userData.boardY=y;const side=sideOf(p),isRed=side===1,baseMat=isRed?redDark:blackDark,enamel=isRed?redEnamel:blueEnamel;
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.31,.36,.1,48),baseMat);foot.position.y=.04;foot.castShadow=true;root.add(foot);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.12,48),enamel);coin.position.y=.14;coin.castShadow=true;root.add(coin);
  const lowerTrim=new THREE.Mesh(new THREE.TorusGeometry(.315,.018,10,48),gold);lowerTrim.rotation.x=Math.PI/2;lowerTrim.position.y=.075;root.add(lowerTrim);
  const topRing=new THREE.Mesh(new THREE.TorusGeometry(.292,.016,10,48),gold);topRing.rotation.x=Math.PI/2;topRing.position.y=.208;root.add(topRing);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.27,48),new THREE.MeshStandardMaterial({map:labelTexture(pieceNames[p],isRed),roughness:.46,metalness:.02}));face.rotation.x=-Math.PI/2;face.position.y=.205;root.add(face);
  const bevel=new THREE.Mesh(new THREE.TorusGeometry(.265,.008,6,48),isRed?redDark:blackDark);bevel.rotation.x=Math.PI/2;bevel.position.y=.215;root.add(bevel);
  root.traverse(obj=>{if((obj as THREE.Mesh).isMesh){obj.castShadow=true;obj.receiveShadow=true;}});pieceLayer.add(root);pieces.set(`${x},${y}`,root);return root;
}
function rebuildPieces(){for(const group of pieces.values())pieceLayer.remove(group);pieces.clear();for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p)createPiece(p,x,y);}drawMarkers();}
function clearMarkers(){while(markers.children.length){const child=markers.children[0];markers.remove(child);if((child as THREE.Mesh).isMesh){(child as THREE.Mesh).geometry.dispose();const m=(child as THREE.Mesh).material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();}}}
function drawMarkers(){clearMarkers();if(selected){const ring=new THREE.Mesh(new THREE.TorusGeometry(.39,.022,8,48),new THREE.MeshBasicMaterial({color:'#fff0b2'}));ring.rotation.x=Math.PI/2;const pos=coords(...selected);ring.position.set(pos.x,.12,pos.z);markers.add(ring);}
  for(const [x,y] of legal){const captured=board[y][x];const marker=new THREE.Mesh(captured?new THREE.TorusGeometry(.37,.026,8,40):new THREE.CircleGeometry(.105,24),new THREE.MeshBasicMaterial({color:captured?'#df3c22':'#f4d993',transparent:true,opacity:.85}));marker.rotation.x=-Math.PI/2;marker.position.set(x-4,.12,y-4.5);markers.add(marker);}
  if(lastMove){for(const [x,y] of [lastMove.from,lastMove.to]){const glow=new THREE.Mesh(new THREE.CircleGeometry(.19,24),new THREE.MeshBasicMaterial({color:'#ffb853',transparent:true,opacity:.2,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(x-4,.105,y-4.5);markers.add(glow);}}
}
function animateObject(object:THREE.Object3D,to:THREE.Vector3,kind:Animated['kind'],duration=.55,done?:()=>void){animated.push({object,from:object.position.clone(),to,start:performance.now(),duration,kind,done});}
function animatePieceMove(move:Move){const [x,y]=move.from,[X,Y]=move.to;const mover=pieces.get(`${x},${y}`);if(!mover)return;pieces.delete(`${x},${y}`);mover.userData.boardX=X;mover.userData.boardY=Y;
  if(move.captured){const victim=pieces.get(`${X},${Y}`);pieces.delete(`${X},${Y}`);if(victim)animateObject(victim,victim.position.clone().add(new THREE.Vector3((X-x)*.48,.25,(Y-y)*.48)),'fall',.72,()=>{pieceLayer.remove(victim);victim.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).geometry.dispose();}});});}
  pieces.set(`${X},${Y}`,mover);createHandMotion(mover,[x,y],[X,Y],sideOf(board[Y][X]!) as Side);
}
function smooth01(t:number){t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);}
function updateHandMotion(now:number){const h=handMotion;if(!h)return;const t=Math.min(1,(now-h.started)/(h.duration*1000)),from=h.from.clone(),to=h.to.clone(),start=h.start.clone(),raisedFrom=from.clone().add(new THREE.Vector3(0,1.04,0)),raisedTo=to.clone().add(new THREE.Vector3(0,1.04,0));let handPos:THREE.Vector3;
  if(t<.2)handPos=start.lerp(raisedFrom,smooth01(t/.2));else if(t<.34)handPos=raisedFrom.lerp(from.clone().add(new THREE.Vector3(0,.36,0)),smooth01((t-.2)/.14));else if(t<.41)handPos=from.clone().add(new THREE.Vector3(0,.36,0));else if(t<.51)handPos=from.clone().add(new THREE.Vector3(0,.36+smooth01((t-.41)/.1)*.68,0));else if(t<.76)handPos=raisedFrom.clone().lerp(raisedTo,smooth01((t-.51)/.25));else if(t<.86)handPos=to.clone().add(new THREE.Vector3(0,1.04-smooth01((t-.76)/.1)*.68,0));else handPos=to.clone().add(new THREE.Vector3(0,.36,0)).lerp(start,smooth01((t-.86)/.14));
  const shoulder=start.clone(),elbow=shoulder.clone().lerp(handPos,.58);setSegment(h.arm,shoulder,elbow);setSegment(h.forearm,elbow,handPos);h.palm.position.copy(handPos);h.palm.rotation.y=h.side===1?0:Math.PI;h.palm.rotation.x=t>.3&&t<.9?-.12:0;
  const cuff=h.root.children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.TorusGeometry) as THREE.Mesh|undefined;if(cuff){cuff.position.copy(shoulder.clone().lerp(elbow,.8));cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),elbow.clone().sub(shoulder).normalize());}
  if(t>=.41&&t<.86){let carry:THREE.Vector3;if(t<.51)carry=from.clone().lerp(raisedFrom,smooth01((t-.41)/.1));else if(t<.76)carry=raisedFrom.clone().lerp(raisedTo,smooth01((t-.51)/.25));else carry=raisedTo.clone().lerp(to,smooth01((t-.76)/.1));h.piece.position.set(carry.x,carry.y-.42,carry.z);h.piece.rotation.z=Math.sin(Math.min(1,(t-.41)/.45)*Math.PI)*.05;}else if(t>=.86){h.piece.position.copy(to);h.piece.rotation.z=0;}else{h.piece.position.copy(from);}
  if(t>=1){h.piece.position.copy(to);h.piece.rotation.z=0;scene.remove(h.root);h.root.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh,m=mesh.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();mesh.geometry.dispose();}});handMotion=null;}
}
function makeCombatActor(piece:Piece){
  const root=new THREE.Group(),red=sideOf(piece)===1,cloth=pieceMaterial(red?'#7d2419':'#1d2d3b',.32,.49),armor=pieceMaterial(red?'#803823':'#263c4b',.72,.31),iron=pieceMaterial('#8c775c',.78,.26),skin=pieceMaterial(red?'#bb8a68':'#92745d',.02,.78),goldTrim=pieceMaterial('#d1a45e',.67,.28),wood=pieceMaterial('#4b2c19',.24,.62),kind=piece.toUpperCase();let weapon=new THREE.Group();root.add(weapon);
  if(kind==='C'){
    const carriage=new THREE.Mesh(new THREE.BoxGeometry(.92,.22,.56),wood);carriage.position.set(-.1,.35,0);root.add(carriage);
    for(const z of [-.34,.34]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.31,.055,8,18),iron);wheel.position.set(-.2,.38,z);root.add(wheel);const hub=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),goldTrim);hub.position.copy(wheel.position);root.add(hub);}
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.16,.23,1.25,14),armor);tube.rotation.z=-Math.PI/2;tube.position.set(.45,.72,0);weapon.add(tube);const muzzle=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,8,16),iron);muzzle.position.set(1.08,.72,0);muzzle.rotation.y=Math.PI/2;weapon.add(muzzle);weapon.position.set(0,0,0);
  }else{
    if(kind==='H'){
      const horse=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.82,5,9),pieceMaterial('#38271f',.16,.72));body.rotation.z=Math.PI/2;body.position.set(-.12,.66,0);horse.add(body);
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.23,.67,10),pieceMaterial('#433027',.12,.73));neck.position.set(.48,1.02,0);neck.rotation.z=-.58;horse.add(neck);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.19,12,9),pieceMaterial('#30241f',.08,.78));head.position.set(.72,1.31,0);head.scale.set(1.25,.78,.82);horse.add(head);
      for(const x of [-.53,.38])for(const z of [-.19,.19]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.57,8),pieceMaterial('#332620',.08,.74));leg.position.set(x,.34,z);horse.add(leg);}
      const saddle=new THREE.Mesh(new THREE.BoxGeometry(.53,.12,.42),goldTrim);saddle.position.set(-.08,.98,0);horse.add(saddle);root.add(horse);
    }
    if(kind==='R'){
      const deck=new THREE.Mesh(new THREE.BoxGeometry(1.05,.2,.72),wood);deck.position.set(-.26,.35,0);root.add(deck);
      for(const z of [-.43,.43]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.35,.055,8,20),iron);wheel.position.set(-.28,.39,z);root.add(wheel);const spoke=new THREE.Mesh(new THREE.BoxGeometry(.58,.035,.03),goldTrim);spoke.position.set(-.28,.39,z);root.add(spoke);spoke.rotation.z=Math.PI/3;}
    }
    const robe=new THREE.Mesh(new THREE.CylinderGeometry(.24,.36,.68,10),cloth);robe.position.set(-.05,1.03,0);root.add(robe);
    const breast=new THREE.Mesh(new THREE.BoxGeometry(.49,.43,.24),armor);breast.position.set(.02,1.1,.16);breast.rotation.z=-.08;root.add(breast);
    for(const z of [-.2,.2]){const pauldron=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),armor);pauldron.position.set(.04,1.35,z);pauldron.scale.set(1,.72,1);root.add(pauldron);}
    const head=new THREE.Mesh(new THREE.SphereGeometry(.23,14,11),skin);head.position.set(.03,1.62,.02);root.add(head);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.255,12,8,0,Math.PI*2,0,Math.PI*.58),iron);helmet.position.set(.03,1.74,.01);root.add(helmet);
    const crest=new THREE.Mesh(new THREE.ConeGeometry(.08,.37,8),goldTrim);crest.position.set(.03,1.99,.01);crest.rotation.z=-.1;root.add(crest);
    if(kind==='K'){const beard=new THREE.Mesh(new THREE.ConeGeometry(.13,.54,9),pieceMaterial('#c7b99a',.02,.88));beard.position.set(.05,1.29,.23);root.add(beard);}
    const spear=kind==='P'||kind==='H'||kind==='E';
    if(spear){const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,1.25,8),wood);shaft.rotation.z=-Math.PI/2;shaft.position.set(.62,1.27,.15);weapon.add(shaft);const tip=new THREE.Mesh(new THREE.ConeGeometry(.085,.25,6),iron);tip.rotation.z=-Math.PI/2;tip.position.set(1.34,1.27,.15);weapon.add(tip);if(kind==='E'){const crescent=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,6,10,Math.PI),iron);crescent.position.set(1.2,1.27,.16);crescent.rotation.y=Math.PI/2;weapon.add(crescent);}}
    else{const blade=new THREE.Mesh(new THREE.BoxGeometry(.86,.075,.055),iron);blade.position.set(.76,1.3,.17);weapon.add(blade);const guard=new THREE.Mesh(new THREE.BoxGeometry(.08,.28,.12),goldTrim);guard.position.set(.34,1.3,.17);weapon.add(guard);const grip=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.34,8),wood);grip.position.set(.22,1.3,.17);grip.rotation.z=Math.PI/2;weapon.add(grip);}
    weapon.position.set(0,0,0);
  }
  root.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});return{root,weapon};
}
function clearCombatScene(){while(combatRoot.children.length){const child=combatRoot.children[0];combatRoot.remove(child);child.traverse(o=>{if((o as THREE.Mesh).isMesh||(o as THREE.Points).isPoints){const obj=o as THREE.Mesh|THREE.Points;obj.geometry.dispose();const m=obj.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();}});}}
function startCombat3D(mover:Piece,captured:Piece){clearCombatScene();const a=makeCombatActor(mover),d=makeCombatActor(captured);a.root.position.set(-2.05,0,.15);d.root.position.set(1.25,0,-.12);d.root.scale.x=-1;combatRoot.add(a.root,d.root);
  const count=72,positions=new Float32Array(count*3),velocities=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=.05;positions[i*3+1]=1.08;positions[i*3+2]=.28;velocities[i*3]=(Math.random()-.45)*5;velocities[i*3+1]=Math.random()*4.5;velocities[i*3+2]=(Math.random()-.5)*1.2;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffbd57',size:.075,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));combatRoot.add(particles);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.16,.24,36),new THREE.MeshBasicMaterial({color:'#ffd07a',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ring.position.set(.05,1.08,.3);combatRoot.add(ring);
  let projectile:THREE.Mesh|null=null;if(mover.toUpperCase()==='C'){projectile=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),new THREE.MeshBasicMaterial({color:'#ffc36a'}));projectile.visible=false;combatRoot.add(projectile);}
  combatMotion={started:performance.now(),duration:2.6,attacker:a.root,defender:d.root,weapon:a.weapon,attackerKind:mover.toUpperCase(),victimKind:captured.toUpperCase(),particles,particleVelocity:velocities,ring,projectile,hit:false};
}
function updateCombat3D(now:number){const m=combatMotion;if(!m)return;const t=Math.min(1,(now-m.started)/(m.duration*1000)),impactAt=m.attackerKind==='C'?.44:.48;
  if(m.attackerKind==='H'||m.attackerKind==='R'){const charge=smooth01((t-.18)/.34);m.attacker.position.x=-2.05+charge*1.1;m.attacker.position.y=Math.sin(charge*Math.PI)*.12;}
  else{const lunge=smooth01((t-.2)/.32);m.attacker.position.x=-2.05+lunge*.78;if(m.attackerKind!=='C')m.weapon.position.x=Math.sin(smooth01((t-.29)/.18)*Math.PI)*.58;else{m.weapon.rotation.z=t>.4&&t<.56?-.18:0;}}
  if(t>=impactAt&&!m.hit){m.hit=true;const panel=document.querySelector<HTMLDivElement>('#cinema')!;panel.classList.add('hit-shake');setTimeout(()=>panel.classList.remove('hit-shake'),750);}
  if(t>impactAt){const fallen=smooth01((t-impactAt)/.26);m.defender.position.x=1.25+fallen*.42;m.defender.position.y=-fallen*.14;m.defender.rotation.z=-fallen*.92;m.defender.scale.set(-(1-fallen*.14),1-fallen*.3,1-fallen*.18);}
  const hitWindow=THREE.MathUtils.clamp((t-impactAt)/.34,0,1);const particlePositions=m.particles.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<particlePositions.count;i++){const q=hitWindow;particlePositions.setXYZ(i,.05+m.particleVelocity[i*3]*q*.34,1.08+m.particleVelocity[i*3+1]*q*.34-.9*q*q,.28+m.particleVelocity[i*3+2]*q*.34);}particlePositions.needsUpdate=true;(m.particles.material as THREE.PointsMaterial).opacity=t<impactAt?0:Math.max(0,1-hitWindow);
  m.ring.visible=t>=impactAt;m.ring.scale.setScalar(.3+hitWindow*4.4);(m.ring.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-hitWindow);
  if(m.projectile){const flight=THREE.MathUtils.clamp((t-.28)/.18,0,1);m.projectile.visible=t>=.28&&t<.49;m.projectile.position.set(-1.35+flight*2.25,1.1+Math.sin(flight*Math.PI)*.23,.3);}
  const shake=t>impactAt&&t<impactAt+.22?(1-(t-impactAt)/.22)*.12:0;combatCamera.position.set(Math.sin(now*.13)*shake,3.25+Math.cos(now*.17)*shake,10.2);combatCamera.lookAt(0,1.05,0);if(t>=1){combatMotion=null;return;}
}
function renderFrame(now:number){requestAnimationFrame(renderFrame);controls.update();updateHandMotion(now);updateCombat3D(now);const seconds=now*.001;emberLight.intensity=14+Math.sin(seconds*3.5)*2.2;const emberAttr=(scene.children.find(o=>o instanceof THREE.Points) as THREE.Points|undefined)?.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;if(emberAttr){for(let i=0;i<emberAttr.count;i++){let y=emberAttr.getY(i)+.008;if(y>7)y=-.1;emberAttr.setY(i,y);}emberAttr.needsUpdate=true;}
  for(let i=animated.length-1;i>=0;i--){const a=animated[i],t=Math.min(1,(now-a.start)/(a.duration*1000)),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    if(a.kind==='move'){a.object.position.lerpVectors(a.from,a.to,ease);a.object.position.y+=Math.sin(t*Math.PI)*.72;a.object.rotation.z=Math.sin(t*Math.PI)*.08;}
    else if(a.kind==='fall'){a.object.position.lerpVectors(a.from,a.to,ease);a.object.position.y-=t*.5;a.object.rotation.z=t*1.45;a.object.scale.setScalar(1-t*.72);}
    if(t>=1){if(a.kind==='move'){a.object.position.copy(a.to);a.object.rotation.z=0;}a.done?.();animated.splice(i,1);}
  }
  renderer.render(scene,camera);if(document.querySelector('#cinema')!.classList.contains('show'))combatRenderer.render(combatScene,combatCamera);
}
function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<570?43:w<850?40:37;camera.updateProjectionMatrix();const cw=window.innerWidth,ch=window.innerHeight;combatRenderer.setSize(cw,ch,false);combatCamera.aspect=cw/ch;combatCamera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(host);buildBoard();rebuildPieces();resize();requestAnimationFrame(renderFrame);

function objectPiece(hit:THREE.Object3D|null):[number,number]|null{let o=hit;while(o){if(Number.isInteger(o.userData.boardX))return[o.userData.boardX,o.userData.boardY];o=o.parent;}return null;}
renderer.domElement.addEventListener('pointerdown',ev=>{if(busy||paused||turn!==1)return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(pieceLayer.children,true);let square:[number,number]|null=null;for(const hit of hits){square=objectPiece(hit.object);if(square)break;}if(!square){const groundHit=raycaster.intersectObject(boardRoot,true)[0];if(groundHit){square=[Math.round(groundHit.point.x+4),Math.round(groundHit.point.z+4.5)];}}
  if(!square||square[0]<0||square[0]>8||square[1]<0||square[1]>9)return;const [x,y]=square;
  if(selected&&legal.some(([a,b])=>a===x&&b===y)){commitMove({from:selected,to:[x,y],captured:board[y][x]});return;}
  if(board[y][x]&&sideOf(board[y][x])===1){selected=[x,y];legal=legalMovesFrom(board,x,y);setStatus(legal.length?'選擇亮起的交叉點':'此棋目前無合法走位');drawMarkers();}else{selected=null;legal=[];drawMarkers();setStatus('請選擇紅方棋子');}
});

function pushHistory(){history.push({board:board.map(r=>r.slice()),turn,ply,log:logEntries.slice()});}
function commitMove(move:Move){if(busy)return;pushHistory();const mover=board[move.from[1]][move.from[0]] as Piece;const captured=move.captured;const beforeSide=turn;board=board.map(r=>r.slice());board[move.to[1]][move.to[0]]=mover;board[move.from[1]][move.from[0]]=null;turn=turn===1?-1:1;ply++;selected=null;legal=[];lastMove={from:move.from,to:move.to};animatePieceMove(move);drawMarkers();
  const actor=beforeSide===1?'玩家':'電腦';const captureLine=captured?`${actor} ${pieceNames[mover]} 擊破 ${pieceNames[captured]}！`:`${actor} 移動 ${pieceNames[mover]}`;addLog(captureLine);setTurnCopy(turn===1?'紅方行棋':'黑方思考中');setStatus(captured?`${pieceNames[mover]} 吃 ${pieceNames[captured]}`:'棋子已落');
  if(captured){busy=true;playHit(mover);setTimeout(()=>{showCinema(mover,captured);setTimeout(()=>finishCinema(),2700);},900);}
  const check=inCheck(board,turn),available=allLegalMoves(board,turn);if(!findKing(board,turn)||!available.length){addLog(!findKing(board,turn)?'將帥遭擒，戰局已定！':'無路可走，敗局已定！');setStatus(turn===1?'電腦獲勝':'玩家獲勝');return;}
  if(check){addLog(`${turn===1?'紅方':'黑方'}將軍！`);setStatus('將軍！');}
  if(turn===-1&&!paused)setTimeout(()=>{if(!busy&&!paused)computerTurn();},captured?3700:1050);
}
function computerTurn(){if(turn!==-1||paused||busy)return;const move=chooseComputerMove(board);if(move)commitMove(move);else{setStatus('紅方獲勝');addLog('電腦無路可走！');}}
function imageFor(piece:Piece){const type=piece.toUpperCase();if(type==='C')return asset('cannon-fire.png');if(type==='H')return asset('cavalry-strike.png');if(type==='K')return asset('general.png');if(type==='R')return asset('cavalry-battle.png');if(type==='E'||type==='A')return asset('siege.png');return asset('soldier-clash.png');}
function showCinema(mover:Piece,captured:Piece){const panel=document.querySelector<HTMLDivElement>('#cinema')!,back=document.querySelector<HTMLDivElement>('#cinema-backdrop')!;const type=mover.toUpperCase()==='C'?'cannon':mover.toUpperCase()==='H'?'cavalry':mover.toUpperCase()==='K'?'general':'soldier';panel.className=`cinema show ${type} captured`;back.style.backgroundImage=`url('${imageFor(mover)}')`;document.querySelector('#cinema-title')!.textContent=mover.toUpperCase()==='P'?'兵卒斬敵':mover.toUpperCase()==='C'?'火炮轟陣':mover.toUpperCase()==='H'?'鐵騎奔襲':mover.toUpperCase()==='K'?'主將破陣':`${pieceNames[mover]}破軍`;
  document.querySelector('#cinema-subtitle')!.textContent=`${pieceNames[mover]}擊破敵方${pieceNames[captured]}・第 ${ply} 手`;
  const img=document.querySelector<HTMLDivElement>('#combat-image')!;img.style.backgroundImage=`url('${imageFor(mover)}')`;document.querySelector('#combat-title')!.textContent=`${pieceNames[mover]}斬敵！`;document.querySelector('#combat-copy')!.textContent=`敵方${pieceNames[captured]}陣亡`;
  startCombat3D(mover,captured);
}
function finishCinema(){document.querySelector('#cinema')!.className='cinema';combatMotion=null;clearCombatScene();busy=false;}
function renderLog(){const box=document.querySelector<HTMLDivElement>('#move-log')!;box.innerHTML=logEntries.slice(-26).map((line,i)=>`<div class="${i===Math.min(logEntries.length,26)-1?'latest':''}">${line}</div>`).join('');box.scrollTop=box.scrollHeight;}
function addLog(text:string){logEntries.push(text);if(logEntries.length>60)logEntries.shift();renderLog();}
function setStatus(text:string){document.querySelector('#status')!.textContent=text;document.querySelector('#round-label')!.textContent=`第 ${Math.floor(ply/2)+1} 回合`;}
function setTurnCopy(text:string){document.querySelector('#turn-copy')!.textContent=text;}
function toast(text:string){const el=document.querySelector<HTMLDivElement>('#toast')!;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1500);}
function playHit(p:Piece){if(!soundOn)return;try{const AC=window.AudioContext;const audio=new AC(),osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(p.toUpperCase()==='C'?72:150,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(38,audio.currentTime+.38);gain.gain.setValueAtTime(.19,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.41);}catch{}}
function newGame(){board=initialBoard();turn=1;ply=0;history=[];animated.splice(0);logEntries=['戰鼓擂響，紅方先行。'];selected=null;legal=[];lastMove=null;busy=false;paused=false;document.querySelector('#cinema')!.className='cinema';document.querySelector('.app-shell')!.classList.remove('paused');document.querySelector('#pause')!.textContent='Ⅱ 暫停';document.querySelector('#combat-image')!.setAttribute('style','');document.querySelector('#combat-title')!.textContent='戰鼓已鳴';document.querySelector('#combat-copy')!.textContent='點選紅方棋子，開始交鋒';setTurnCopy('紅方先行');setStatus('請選擇棋子');rebuildPieces();renderLog();}
document.querySelector('#new-game')!.addEventListener('click',newGame);
document.querySelector('#undo')!.addEventListener('click',()=>{if(busy||!history.length)return;const count=turn===1?Math.min(2,history.length):1;let state:typeof history[number]|undefined;for(let i=0;i<count;i++)state=history.pop();if(!state)return;board=state.board;turn=state.turn;ply=state.ply;logEntries=state.log;selected=null;legal=[];lastMove=null;animated.splice(0);rebuildPieces();renderLog();setTurnCopy(turn===1?'紅方行棋':'黑方行棋');setStatus('悔棋完成');});
document.querySelector('#pause')!.addEventListener('click',ev=>{paused=!paused;document.querySelector('.app-shell')!.classList.toggle('paused',paused);(ev.currentTarget as HTMLButtonElement).textContent=paused?'▶ 繼續':'Ⅱ 暫停';toast(paused?'戰場暫停':'繼續交鋒');if(!paused&&turn===-1&&!busy)setTimeout(computerTurn,250);});
document.querySelector('#sound')!.addEventListener('click',ev=>{soundOn=!soundOn;(ev.currentTarget as HTMLButtonElement).textContent=soundOn?'♫ 音效':'♫ 靜音';});
// Match the turn counter and in-board side names to the current ply.
setStatus('請選擇棋子');renderLog();
