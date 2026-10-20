export type Side = 1 | -1;
export type Piece = 'K'|'A'|'E'|'H'|'R'|'C'|'P'|'k'|'a'|'e'|'h'|'r'|'c'|'p';
export type Cell = Piece | null;
export type Board = Cell[][];
export type Move = { from: [number, number]; to: [number, number]; captured: Cell };
export const pieceNames: Record<Piece, string> = { K:'帥',A:'仕',E:'相',H:'馬',R:'車',C:'炮',P:'兵',k:'將',a:'士',e:'象',h:'馬',r:'車',c:'炮',p:'卒' };
export const pieceValues: Record<Piece, number> = { K:100000,A:22,E:22,H:45,R:95,C:48,P:12,k:100000,a:22,e:22,h:45,r:95,c:48,p:12 };
export const sideOf = (p: Cell): Side | 0 => p ? (p === p.toUpperCase() ? 1 : -1) : 0;
export const initialBoard = (): Board => {
  const board: Board = Array.from({length:10},()=>Array<Cell>(9).fill(null));
  const black: Piece[]=['r','h','e','a','k','a','e','h','r'], red: Piece[]=['R','H','E','A','K','A','E','H','R'];
  for(let x=0;x<9;x++){board[0][x]=black[x];board[9][x]=red[x];}
  board[2][1]='c';board[2][7]='c';board[7][1]='C';board[7][7]='C';
  for(const x of [0,2,4,6,8]){board[3][x]='p';board[6][x]='P';}
  return board;
};
const inside=(x:number,y:number)=>x>=0&&x<9&&y>=0&&y<10;
const add=(board:Board,out:[number,number][],x:number,y:number,side:Side)=>{if(inside(x,y)&&(!board[y][x]||sideOf(board[y][x])!==side))out.push([x,y]);};
export function pseudoMoves(board:Board,x:number,y:number):[number,number][] {
  const piece=board[y]?.[x]; if(!piece)return [];
  const side=sideOf(piece) as Side, kind=piece.toUpperCase(), out:[number,number][]=[];
  const ortho:[[number,number],[number,number],[number,number],[number,number]]=[[1,0],[-1,0],[0,1],[0,-1]];
  if(kind==='K'||kind==='A'){
    const dirs=kind==='K'?ortho:[[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const [dx,dy] of dirs){const X=x+dx,Y=y+dy;if(X>=3&&X<=5&&Y>=(side===1?7:0)&&Y<=(side===1?9:2))add(board,out,X,Y,side);}
    if(kind==='K')for(let Y=y+(side===1?-1:1);inside(x,Y);Y+=side===1?-1:1){const target=board[Y][x];if(target){if(target.toUpperCase()==='K'&&sideOf(target)!==side)out.push([x,Y]);break;}}
  }else if(kind==='E'||kind==='H'){
    const steps=kind==='E'?[[2,2],[2,-2],[-2,2],[-2,-2]]:[[1,2],[-1,2],[1,-2],[-1,-2]];
    for(const [dx,dy] of steps){const X=x+dx,Y=y+dy;if(!inside(X,Y))continue;
      if(kind==='E'&&((side===1&&Y<5)||(side===-1&&Y>4)||board[y+dy/2][x+dx/2]))continue;
      if(kind==='H'&&board[y+(Math.abs(dx)===1?Math.sign(dy):0)][x+(Math.abs(dy)===1?Math.sign(dx):0)])continue;
      add(board,out,X,Y,side);
    }
  }else if(kind==='R'||kind==='C'){
    for(const [dx,dy] of ortho){let screened=false;for(let X=x+dx,Y=y+dy;inside(X,Y);X+=dx,Y+=dy){const target=board[Y][X];
      if(kind==='R'){if(!target)out.push([X,Y]);else{if(sideOf(target)!==side)out.push([X,Y]);break;}}
      else if(!screened){if(!target)out.push([X,Y]);else screened=true;}
      else if(target){if(sideOf(target)!==side)out.push([X,Y]);break;}
    }}
  }else if(kind==='P'){
    const forward=side===1?-1:1;add(board,out,x,y+forward,side);
    if((side===1&&y<=4)||(side===-1&&y>=5)){add(board,out,x-1,y,side);add(board,out,x+1,y,side);}
  }
  return out;
}
export function findKing(board:Board,side:Side):[number,number]|null{for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p?.toUpperCase()==='K'&&sideOf(p)===side)return[x,y];}return null;}
export function isAttacked(board:Board,x:number,y:number,by:Side):boolean{for(let Y=0;Y<10;Y++)for(let X=0;X<9;X++){const p=board[Y][X];if(p&&sideOf(p)===by&&pseudoMoves(board,X,Y).some(([a,b])=>a===x&&b===y))return true;}return false;}
export function inCheck(board:Board,side:Side):boolean{const king=findKing(board,side);return !king||isAttacked(board,king[0],king[1],side===1?-1:1);}
export function legalMovesFrom(board:Board,x:number,y:number):[number,number][]{const piece=board[y][x];if(!piece)return[];const side=sideOf(piece) as Side;return pseudoMoves(board,x,y).filter(([X,Y])=>{const target=board[Y][X];board[Y][X]=piece;board[y][x]=null;const valid=!inCheck(board,side);board[y][x]=piece;board[Y][X]=target;return valid;});}
export function allLegalMoves(board:Board,side:Side):Move[]{const out:Move[]=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(board[y][x]&&sideOf(board[y][x])===side)for(const [X,Y] of legalMovesFrom(board,x,y))out.push({from:[x,y],to:[X,Y],captured:board[Y][X]});return out;}
export function playMove(board:Board,move:Move):Board{const next=board.map(row=>row.slice());const [x,y]=move.from,[X,Y]=move.to;next[Y][X]=next[y][x];next[y][x]=null;return next;}
const value=(p:Cell)=>p?pieceValues[p]:0;
function evaluate(board:Board):number{let score=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(!p)continue;const sign=sideOf(p) as Side,kind=p.toUpperCase();let pos=0;if(kind==='P')pos=(sign===1?6-y:y-3)*1.6+(x>=2&&x<=6?1:0);if(kind==='H'||kind==='C')pos=4-Math.abs(4-x);score+=sign*(value(p)+pos);}return score;}
export function chooseComputerMove(board:Board):Move|null{
  const moves=allLegalMoves(board,-1);if(!moves.length)return null;
  // Order promising moves, then use a two-ply minimax search with alpha-beta cutoffs.
  // The small beam keeps the browser responsive while still anticipating the reply.
  const ordered=moves.map(move=>{const next=playMove(board,move);let order=-evaluate(next)+(move.captured?value(move.captured)*.35:0);const redKing=findKing(next,1);if(redKing&&isAttacked(next,redKing[0],redKing[1],-1))order+=15;return{move,next,order};}).sort((a,b)=>b.order-a.order).slice(0,12);
  let best=-Infinity,alpha=-Infinity;const bestMoves:Move[]=[];
  for(const candidate of ordered){
    if(!findKing(candidate.next,1)){const score=200000;if(score>best){best=score;bestMoves.splice(0,bestMoves.length,candidate.move);}continue;}
    const replies=allLegalMoves(candidate.next,1);let worstForRed=-Infinity;
    if(!replies.length){worstForRed=inCheck(candidate.next,1)?-200000:evaluate(candidate.next);}
    else for(const reply of replies){const afterReply=playMove(candidate.next,reply);let score=evaluate(afterReply);if(!findKing(afterReply,-1))score=200000;else if(inCheck(afterReply,-1)&&!allLegalMoves(afterReply,-1).length)score=200000;worstForRed=Math.max(worstForRed,score);if(worstForRed>=-alpha)break;}
    const score=-worstForRed+(candidate.order*.08)+(Math.random()-.5)*.8;
    if(score>best){best=score;bestMoves.splice(0,bestMoves.length,candidate.move);}else if(Math.abs(score-best)<.5)bestMoves.push(candidate.move);
    alpha=Math.max(alpha,best);
  }
  return bestMoves[Math.floor(Math.random()*bestMoves.length)]??ordered[0].move;
}
