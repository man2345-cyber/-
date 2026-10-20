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
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.1,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minPolarAngle=.55;controls.maxPolarAngle=1.15;controls.minDistance=10;controls.maxDistance=23;
scene.add(new THREE.HemisphereLight('#ffe0b2','#291b16',2.05));
const keyLight=new THREE.DirectionalLight('#ffe0c0',3.25);keyLight.position.set(-5,10,8);keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.camera.left=-9;keyLight.shadow.camera.right=9;keyLight.shadow.camera.top=12;keyLight.shadow.camera.bottom=-12;keyLight.shadow.bias=-.0003;scene.add(keyLight);
const coolRim=new THREE.DirectionalLight('#a1c3f2',1.3);coolRim.position.set(7,7,-8);scene.add(coolRim);
const emberLight=new THREE.PointLight('#ff7b29',16,15,2);emberLight.position.set(-2,3,2);scene.add(emberLight);
const boardRoot=new THREE.Group();scene.add(boardRoot);const pieceLayer=new THREE.Group();scene.add(pieceLayer);
const raycaster=new THREE.Raycaster();raycaster.params.Line.threshold=.15;const pointer=new THREE.Vector2();
type Animated={object:THREE.Object3D;from:THREE.Vector3;to:THREE.Vector3;start:number;duration:number;kind:'move'|'fall'|'rise';done?:()=>void};const animated:Animated[]=[];
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
  const embers=new THREE.BufferGeometry(),positions=new Float32Array(340*3);for(let i=0;i<340;i++){positions[i*3]=(Math.random()-.5)*14;positions[i*3+1]=Math.random()*7;positions[i*3+2]=(Math.random()-.5)*15;}embers.setAttribute('position',new THREE.BufferAttribute(positions,3));const emberPoints=new THREE.Points(embers,new THREE.PointsMaterial({color:'#ff9c47',size:.035,transparent:true,opacity:.76,depthWrite:false}));scene.add(emberPoints);
}
function makeSmokeTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!,rad=g.createRadialGradient(64,64,2,64,64,63);rad.addColorStop(0,'rgba(205,190,170,.3)');rad.addColorStop(.45,'rgba(143,128,112,.15)');rad.addColorStop(1,'rgba(50,44,40,0)');g.fillStyle=rad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function labelTexture(text:string,isRed:boolean){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;const grad=g.createRadialGradient(88,70,8,128,128,132);grad.addColorStop(0,'#f1dfb7');grad.addColorStop(.72,'#d7c297');grad.addColorStop(1,'#a3875f');g.fillStyle=grad;g.fillRect(0,0,256,256);g.strokeStyle=isRed?'#85271c':'#3b3024';g.lineWidth=8;g.beginPath();g.arc(128,128,116,0,Math.PI*2);g.stroke();g.strokeStyle='#f4e3b9';g.lineWidth=2;g.beginPath();g.arc(128,128,104,0,Math.PI*2);g.stroke();g.fillStyle=isRed?'#9a2118':'#161515';g.font='bold 150px "Noto Serif TC",serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#fff1d0';g.shadowBlur=2;g.fillText(text,128,132);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
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
  pieces.set(`${X},${Y}`,mover);const target=coords(X,Y);animateObject(mover,target,'move',move.captured?.toUpperCase()==='H' ? .72 : .48);
}
function renderFrame(now:number){requestAnimationFrame(renderFrame);controls.update();const seconds=now*.001;emberLight.intensity=14+Math.sin(seconds*3.5)*2.2;const emberAttr=(scene.children.find(o=>o instanceof THREE.Points) as THREE.Points|undefined)?.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;if(emberAttr){for(let i=0;i<emberAttr.count;i++){let y=emberAttr.getY(i)+.008;if(y>7)y=-.1;emberAttr.setY(i,y);}emberAttr.needsUpdate=true;}
  for(let i=animated.length-1;i>=0;i--){const a=animated[i],t=Math.min(1,(now-a.start)/(a.duration*1000)),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    if(a.kind==='move'){a.object.position.lerpVectors(a.from,a.to,ease);a.object.position.y+=Math.sin(t*Math.PI)*.72;a.object.rotation.z=Math.sin(t*Math.PI)*.08;}
    else if(a.kind==='fall'){a.object.position.lerpVectors(a.from,a.to,ease);a.object.position.y-=t*.5;a.object.rotation.z=t*1.45;a.object.scale.setScalar(1-t*.72);}
    if(t>=1){if(a.kind==='move'){a.object.position.copy(a.to);a.object.rotation.z=0;}a.done?.();animated.splice(i,1);}
  }
  renderer.render(scene,camera);
}
function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<570?43:w<850?40:37;camera.updateProjectionMatrix();}
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
  if(captured){busy=true;showCinema(mover,captured);playHit(mover);}
  const check=inCheck(board,turn),available=allLegalMoves(board,turn);if(!findKing(board,turn)||!available.length){addLog(!findKing(board,turn)?'將帥遭擒，戰局已定！':'無路可走，敗局已定！');setStatus(turn===1?'電腦獲勝':'玩家獲勝');if(captured)setTimeout(()=>finishCinema(),2700);return;}
  if(check){addLog(`${turn===1?'紅方':'黑方'}將軍！`);setStatus('將軍！');}
  if(captured)setTimeout(()=>finishCinema(),2700);
  if(turn===-1&&!paused)setTimeout(()=>{if(!busy&&!paused)computerTurn();},captured?2800:680);
}
function computerTurn(){if(turn!==-1||paused||busy)return;const move=chooseComputerMove(board);if(move)commitMove(move);else{setStatus('紅方獲勝');addLog('電腦無路可走！');}}
function imageFor(piece:Piece){const type=piece.toUpperCase();if(type==='C')return asset('cannon-fire.png');if(type==='H')return asset('cavalry-strike.png');if(type==='K')return asset('general.png');if(type==='R')return asset('cavalry-battle.png');if(type==='E'||type==='A')return asset('siege.png');return asset('soldier-clash.png');}
function showCinema(mover:Piece,captured:Piece){const panel=document.querySelector<HTMLDivElement>('#cinema')!,back=document.querySelector<HTMLDivElement>('#cinema-backdrop')!;const type=mover.toUpperCase()==='C'?'cannon':mover.toUpperCase()==='H'?'cavalry':mover.toUpperCase()==='K'?'general':'soldier';panel.className=`cinema show ${type} captured`;back.style.backgroundImage=`url('${imageFor(mover)}')`;document.querySelector('#cinema-title')!.textContent=mover.toUpperCase()==='P'?'兵卒斬敵':mover.toUpperCase()==='C'?'火炮轟陣':mover.toUpperCase()==='H'?'鐵騎奔襲':mover.toUpperCase()==='K'?'主將破陣':`${pieceNames[mover]}破軍`;
  document.querySelector('#cinema-subtitle')!.textContent=`${pieceNames[mover]}擊破敵方${pieceNames[captured]}・第 ${ply} 手`;
  const img=document.querySelector<HTMLDivElement>('#combat-image')!;img.style.backgroundImage=`url('${imageFor(mover)}')`;document.querySelector('#combat-title')!.textContent=`${pieceNames[mover]}斬敵！`;document.querySelector('#combat-copy')!.textContent=`敵方${pieceNames[captured]}陣亡`;
}
function finishCinema(){document.querySelector('#cinema')!.className='cinema';busy=false;}
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
