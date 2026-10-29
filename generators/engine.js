// Shared question engine for the Dorey Desk generators (question generator and LSQ).
// Each lesson's gen(R) returns {q, sol:[...], ans}. `marks` is the HSC-style mark value used by the LSQ.
// ================= RANDOM (seeded) =================
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return h>>>0}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeRng(seed){const r=mulberry32(hashStr(String(seed)));return{
 next:r,
 int:(a,b)=>a+Math.floor(r()*(b-a+1)),
 nz:(a,b)=>{let v;do{v=a+Math.floor(r()*(b-a+1))}while(v===0);return v},
 pick:arr=>arr[Math.floor(r()*arr.length)],
 sample:(arr,k)=>{const c=arr.slice();for(let i=c.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[c[i],c[j]]=[c[j],c[i]]}return c.slice(0,k)}
}}

// ================= FRACTIONS =================
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a||1}
class Fr{
 constructor(n,d=1){if(d===0)throw Error('zero denominator');if(d<0){n=-n;d=-d}const g=gcd(n,d);this.n=n/g||0;this.d=d/g}
 static of(x){return x instanceof Fr?x:new Fr(x,1)}
 add(o){o=Fr.of(o);return new Fr(this.n*o.d+o.n*this.d,this.d*o.d)}
 sub(o){return this.add(Fr.of(o).neg())}
 mul(o){o=Fr.of(o);return new Fr(this.n*o.n,this.d*o.d)}
 div(o){o=Fr.of(o);return new Fr(this.n*o.d,this.d*o.n)}
 neg(){return new Fr(-this.n,this.d)}
 abs(){return new Fr(Math.abs(this.n),this.d)}
 isZero(){return this.n===0}
 isInt(){return this.d===1}
 val(){return this.n/this.d}
 tex(){return this.d===1?String(this.n):(this.n<0?'-':'')+'\\frac{'+Math.abs(this.n)+'}{'+this.d+'}'}
 btex(){return this.n<0?'\\left('+this.tex()+'\\right)':this.tex()}
}
const F=(n,d)=>new Fr(n,d);

// ================= LATEX HELPERS =================
// one signed term: coefficient c with variable part v (v may be '')
function term(c,v,first){c=Fr.of(c);const neg=c.n<0,a=c.abs();let body;
 if(v){body=(a.n===1&&a.d===1)?v:(a.d===1?a.n+v:'\\frac{'+a.n+'}{'+a.d+'}'+v)}else body=a.tex();
 return first?(neg?'-':'')+body:(neg?' - ':' + ')+body}
// list of [coef, varPart]
function poly(ts){const t=ts.filter(x=>!Fr.of(x[0]).isZero());if(!t.length)return'0';return t.map((x,i)=>term(x[0],x[1],i===0)).join('')}
const xp=n=>n===0?'':n===1?'x':'x^{'+n+'}';
function xpF(e){return e.isInt()?xp(e.n):'x^{'+e.tex()+'}'}
// polynomials as coefficient arrays, index = power
function pTex(cs){const ts=[];for(let i=cs.length-1;i>=0;i--)ts.push([cs[i],xp(i)]);return poly(ts)}
function pEval(cs,x){x=Fr.of(x);let s=F(0),p=F(1);for(let i=0;i<cs.length;i++){s=s.add(Fr.of(cs[i]).mul(p));p=p.mul(x)}return s}
function pInt(cs){return [F(0),...cs.map((c,i)=>Fr.of(c).div(i+1))]}
function pDer(cs){return cs.slice(1).map((c,i)=>Fr.of(c).mul(i+1))}
// substitute a value into a polynomial, showing the working
function subTex(cs,x){const parts=[];const xv=Fr.of(x).tex();
 for(let i=cs.length-1;i>=0;i--){const c=Fr.of(cs[i]);if(c.isZero())continue;const neg=c.n<0,a=c.abs();let body;
  if(i===0)body=a.tex();else{const pw=i===1?'('+xv+')':'('+xv+')^{'+i+'}';body=(a.n===1&&a.d===1?'':a.tex())+pw}
  parts.push(parts.length?(neg?' - ':' + ')+body:(neg?'-':'')+body)}
 return parts.join('')||'0'}
function defIntSteps(cs,p,q){const P=pInt(cs);const vq=pEval(P,q),vp=pEval(P,p),v=vq.sub(vp);const pt=Fr.of(p).tex(),qt=Fr.of(q).tex();
 return{v,lines:[
  `$$\\int_{${pt}}^{${qt}}\\left(${pTex(cs)}\\right)dx = \\left[${pTex(P)}\\right]_{${pt}}^{${qt}}$$`,
  `$$= \\left(${subTex(P,q)}\\right) - \\left(${subTex(P,p)}\\right)$$`,
  `$$= ${vq.tex()} - ${vp.btex()} = ${v.tex()}$$`]}}
const lin=(a,b)=>poly([[a,'x'],[b,'']]);
const factor=r=>r===0?'x':`(${lin(1,-r)})`;
function factored(k,p,q){const pre=k===1?'':k===-1?'-':String(k);const [r1,r2]=q===0?[q,p]:[p,q];return pre+factor(r1)+factor(r2)}
function tableHTML(xs,ys){return `<table class="tv"><tr><th>$x$</th>${xs.map(x=>`<td>$${x}$</td>`).join('')}</tr><tr><th>$f(x)$</th>${ys.map(y=>`<td>$${y}$</td>`).join('')}</tr></table>`}

// index-form terms (√x, 1/x^k, ...)
function indexTerm(R,type){const a=R.nz(-8,8),A=Math.abs(a),s=A===1?'':A;
 switch(type){
  case'pow':{const n=R.int(2,5);return{a,e:F(n),disp:`${s}x^{${n}}`}}
  case'sqrt':return{a,e:F(1,2),disp:`${s}\\sqrt{x}`}
  case'recip':{const k=R.int(2,4);return{a,e:F(-k),disp:`\\frac{${A}}{x^{${k}}}`}}
  case'rsqrt':return{a,e:F(-1,2),disp:`\\frac{${A}}{\\sqrt{x}}`}
  case'cbrt':return{a,e:F(1,3),disp:`${s}\\sqrt[3]{x}`}}}
function indexTerms(R){return R.sample(['pow','sqrt','recip','rsqrt','cbrt'],R.int(2,3)).map(t=>indexTerm(R,t)).sort((u,v)=>v.e.val()-u.e.val())}
function joinDisp(ts){return ts.map((t,i)=>{const neg=t.a<0;return i===0?(neg?'-':'')+t.disp:(neg?' - ':' + ')+t.disp}).join('')}

// ================= GENERATORS =================
// Each returns {q: prompt HTML, sol: [lines], ans: HTML}. Math in $...$ or $$...$$.

function gPower(R){const pw=R.sample([0,1,2,3,4,5,6],3).sort((a,b)=>b-a);const cs=pw.map(()=>R.nz(-9,9));
 const f=poly(pw.map((n,i)=>[cs[i],xp(n)]));
 const raw=pw.map((n,i)=>{const a=cs[i],neg=a<0,A=Math.abs(a);const body=n===0?(A===1?'x':A+'x'):`\\frac{${A===1?'':A}x^{${n+1}}}{${n+1}}`;return i===0?(neg?'-':'')+body:(neg?' - ':' + ')+body}).join('');
 const res=poly(pw.map((n,i)=>[F(cs[i],n+1),xp(n+1)]))+' + C';
 return{q:`Find $\\displaystyle\\int\\left(${f}\\right)dx$.`,
  sol:[`$$\\int\\left(${f}\\right)dx = ${raw} + C$$`,`$$= ${res}$$`],ans:`$${res}$`}}

function gIndices(R){const ts=indexTerms(R);
 const idx=poly(ts.map(t=>[t.a,xpF(t.e)]));
 const res=poly(ts.map(t=>{const e1=t.e.add(1);return[F(t.a).div(e1),xpF(e1)]}))+' + C';
 return{q:`Find $\\displaystyle\\int\\left(${joinDisp(ts)}\\right)dx$.`,
  sol:[`Write each term in index form:`,`$$\\int\\left(${idx}\\right)dx$$`,`Increase each index by 1 and divide by the new index:`,`$$= ${res}$$`],ans:`$${res}$`}}

function gLinPow(R){const a=R.int(2,5),b=R.nz(-7,7),n=R.int(2,6),k=R.pick([1,1,2,3,4,6]);
 const L=lin(a,b),kp=k===1?'':k;const res=term(F(k,a*(n+1)),`(${L})^{${n+1}}`,true)+' + C';
 return{q:`Find $\\displaystyle\\int ${kp}(${L})^{${n}}\\,dx$.`,
  sol:[`Using $\\displaystyle\\int (ax+b)^n\\,dx = \\frac{(ax+b)^{n+1}}{a(n+1)} + C$:`,
   `$$\\int ${kp}(${L})^{${n}}\\,dx = \\frac{${kp}(${L})^{${n+1}}}{${a}\\times ${n+1}} + C$$`,`$$= ${res}$$`],ans:`$${res}$`}}

function gDef(R){const deg=R.pick([2,2,3]);const cs=[...Array(deg+1)].map((_,i)=>i===deg?R.nz(-4,4):R.int(-6,6));
 const p=R.int(-2,2),q=p+R.int(1,3);const D=defIntSteps(cs,p,q);
 return{q:`Evaluate $\\displaystyle\\int_{${p}}^{${q}}\\left(${pTex(cs)}\\right)dx$.`,sol:D.lines,ans:`$${D.v.tex()}$`}}

function gExp(R){const a=R.nz(-8,8),k=R.nz(-5,5);
 if(R.next()<0.65){const b=R.pick([0,0,R.nz(-4,4)]);const ex=lin(k,b);const f=term(a,`e^{${ex}}`,true);
  const res=term(F(a,k),`e^{${ex}}`,true)+' + C';
  return{q:`Find $\\displaystyle\\int ${f}\\,dx$.`,
   sol:[`Using $\\displaystyle\\int e^{ax+b}\\,dx = \\frac{1}{a}e^{ax+b} + C$:`,`$$\\int ${f}\\,dx = ${res}$$`],ans:`$${res}$`}}
 const kx=lin(k,0),ek=k===1?'e':`e^{${k}}`,c=F(a,k),f=term(a,`e^{${kx}}`,true);const res=term(c,`\\left(${ek} - 1\\right)`,true);
 return{q:`Evaluate $\\displaystyle\\int_{0}^{1} ${f}\\,dx$, leaving your answer in exact form.`,
  sol:[`$$\\int_0^1 ${f}\\,dx = \\left[${term(c,`e^{${kx}}`,true)}\\right]_0^1$$`,`$$= ${term(c,`\\left(${ek} - e^{0}\\right)`,true)}$$`,`$$= ${res}$$`],ans:`$${res}$`}}

function gLog(R){
 if(R.next()<0.5){const k=R.int(1,9),a=R.nz(-6,6),b=R.nz(-9,9);const L=lin(a,b);const res=term(F(k,a),`\\ln\\left|${L}\\right|`,true)+' + C';
  return{q:`Find $\\displaystyle\\int\\frac{${k}}{${L}}\\,dx$.`,
   sol:[`Using $\\displaystyle\\int\\frac{1}{ax+b}\\,dx = \\frac{1}{a}\\ln|ax+b| + C$:`,`$$\\int\\frac{${k}}{${L}}\\,dx = ${res}$$`],ans:`$${res}$`}}
 const m=R.int(1,5),b=R.int(-6,6),c=R.nz(-9,9);const f=poly([[1,'x^{2}'],[b,'x'],[c,'']]),df=lin(2,b),num=lin(2*m,m*b);
 const res=term(m,`\\ln\\left|${f}\\right|`,true)+' + C';
 return{q:`Find $\\displaystyle\\int\\frac{${num}}{${f}}\\,dx$.`,
  sol:[`The derivative of the denominator is $${df}$, so the numerator is ${m===1?'exactly the derivative':`$${m}$ times the derivative`}.`,
   `Using $\\displaystyle\\int\\frac{f'(x)}{f(x)}\\,dx = \\ln|f(x)| + C$:`,`$$\\int\\frac{${num}}{${f}}\\,dx = ${res}$$`],ans:`$${res}$`}}

function gTrig(R){const fn=R.pick(['sin','cos','sec']),a=R.nz(-6,6),k=R.int(1,6),arg=k===1?'x':`${k}x`;
 const f=term(a,fn==='sec'?`\\sec^2 ${arg}`:`\\${fn} ${arg}`,true);
 const rule={sin:`\\int\\sin ax\\,dx = -\\frac{1}{a}\\cos ax + C`,cos:`\\int\\cos ax\\,dx = \\frac{1}{a}\\sin ax + C`,sec:`\\int\\sec^2 ax\\,dx = \\frac{1}{a}\\tan ax + C`}[fn];
 const res=(fn==='sin'?term(F(-a,k),`\\cos ${arg}`,true):fn==='cos'?term(F(a,k),`\\sin ${arg}`,true):term(F(a,k),`\\tan ${arg}`,true))+' + C';
 return{q:`Find $\\displaystyle\\int ${f}\\,dx$.`,sol:[`Using $\\displaystyle ${rule}$:`,`$$\\int ${f}\\,dx = ${res}$$`],ans:`$${res}$`}}

function gArea(R){const k=R.pick([1,-1,2,-2,3]),p=R.int(-4,3),q=p+R.int(1,5);const cs=[k*p*q,-k*(p+q),k];
 const D=defIntSteps(cs,p,q),A=D.v.abs();
 return{q:`Find the area enclosed between the curve $y = ${pTex(cs)}$ and the $x$-axis.`,
  sol:[`Find the $x$-intercepts: $${pTex(cs)} = ${factored(k,p,q)} = 0$, so $x = ${p}$ or $x = ${q}$.`,...D.lines,
   `${D.v.n<0?'The integral is negative because the region lies below the $x$-axis. ':''}Area $= \\left|${D.v.tex()}\\right| = ${A.tex()}$ square units.`],
  ans:`$${A.tex()}$ units$^2$`}}

function gSigned(R){const k=R.pick([1,-1]),p=R.int(-3,1),q=p+R.int(1,3),t=q+R.int(1,2);const cs=[k*p*q,-k*(p+q),k];
 const I1=defIntSteps(cs,p,q),I2=defIntSteps(cs,q,t),A=I1.v.abs().add(I2.v.abs());
 return{q:`Find the total area enclosed between $y = ${pTex(cs)}$, the $x$-axis and the lines $x = ${p}$ and $x = ${t}$.`,
  sol:[`$${pTex(cs)} = ${factored(k,p,q)}$, so the curve crosses the $x$-axis at $x = ${q}$ inside the interval. Split the integral there.`,
   ...I1.lines,...I2.lines,
   `Area $= \\left|${I1.v.tex()}\\right| + \\left|${I2.v.tex()}\\right| = ${A.tex()}$ square units.`,
   `(Integrating straight from $${p}$ to $${t}$ gives $${I1.v.add(I2.v).tex()}$, which is wrong because the regions cancel.)`],
  ans:`$${A.tex()}$ units$^2$`}}

function gTrap(R){const n=R.pick([4,4,3,5,6]);
 if(R.next()<0.5){const cs=[R.int(-3,5),R.int(-4,4),R.nz(-2,2)],h=R.pick([F(1),F(1,2),F(2)]),a=F(R.int(0,2)),b=a.add(h.mul(n));
  const xs=[...Array(n+1)].map((_,i)=>a.add(h.mul(i))),ys=xs.map(x=>pEval(cs,x));
  const inner=ys.slice(1,-1).reduce((s,y)=>s.add(y),F(0)),A=h.div(2).mul(ys[0].add(inner.mul(2)).add(ys[n]));
  return{q:`Use the trapezoidal rule with ${n+1} function values to approximate $\\displaystyle\\int_{${a.tex()}}^{${b.tex()}}\\left(${pTex(cs)}\\right)dx$.`,
   sol:[`$h = \\dfrac{${b.tex()} - ${a.btex()}}{${n}} = ${h.tex()}$`,tableHTML(xs.map(x=>x.tex()),ys.map(y=>y.tex())),
    `$$\\approx \\frac{${h.tex()}}{2}\\left[${ys[0].tex()} + 2\\left(${ys.slice(1,-1).map((y,i)=>i?y.btex():y.tex()).join(' + ')}\\right) + ${ys[n].btex()}\\right]$$`,
    `$$= ${A.tex()}${A.isInt()?'':' \\approx '+A.val().toFixed(3)}$$`],ans:`$${A.tex()}$`}}
 const fns=[{t:'\\sqrt{x}',f:Math.sqrt,a:[0,1]},{t:'\\frac{1}{x}',f:x=>1/x,a:[1,2]},{t:'e^{x}',f:Math.exp,a:[0,1]},{t:'\\ln x',f:Math.log,a:[1,2]},{t:'\\frac{1}{1+x^{2}}',f:x=>1/(1+x*x),a:[0,1]}];
 const fn=R.pick(fns),h=R.pick([0.5,1]),a=R.pick(fn.a),b=a+h*n;
 const xs=[...Array(n+1)].map((_,i)=>a+h*i),ys=xs.map(x=>+fn.f(x).toFixed(4));
 const A=h/2*(ys[0]+2*ys.slice(1,-1).reduce((s,y)=>s+y,0)+ys[n]);
 return{q:`Use the trapezoidal rule with ${n+1} function values to approximate $\\displaystyle\\int_{${a}}^{${b}} ${fn.t}\\,dx$. Give your answer correct to 3 decimal places.`,
  sol:[`$h = \\dfrac{${b} - ${a}}{${n}} = ${h}$`,tableHTML(xs,ys.map(y=>y.toFixed(4))),
   `$$\\approx \\frac{${h}}{2}\\left[${ys[0].toFixed(4)} + 2\\left(${ys.slice(1,-1).map(y=>y.toFixed(4)).join(' + ')}\\right) + ${ys[n].toFixed(4)}\\right]$$`,
   `$$\\approx ${A.toFixed(3)}$$`],ans:`$\\approx ${A.toFixed(3)}$`}}

// ---- Year 11 review ----
function gDiffIdx(R){const ts=indexTerms(R);
 const idx=poly(ts.map(t=>[t.a,xpF(t.e)])),res=poly(ts.map(t=>[F(t.a).mul(t.e),xpF(t.e.sub(1))]));
 return{q:`Differentiate $y = ${joinDisp(ts)}$.`,
  sol:[`Write in index form: $y = ${idx}$`,`Multiply by the index, then decrease the index by 1:`,`$$\\frac{dy}{dx} = ${res}$$`],ans:`$\\dfrac{dy}{dx} = ${res}$`}}

function gTangent(R){const cs=[R.int(-5,5),R.int(-5,5),R.int(-3,3),R.nz(-2,2)],p=R.int(-2,2);
 const d=pDer(cs),y0=pEval(cs,p),m=pEval(d,p),c=y0.sub(m.mul(p)),L=poly([[m,'x'],[c,'']]);
 return{q:`Find the equation of the tangent to $y = ${pTex(cs)}$ at the point where $x = ${p}$.`,
  sol:[`$\\dfrac{dy}{dx} = ${pTex(d)}$`,`At $x = ${p}$: $m = ${subTex(d,p)} = ${m.tex()}$`,`and $y = ${subTex(cs,p)} = ${y0.tex()}$`,
   `$$y - ${y0.btex()} = ${m.btex()}\\left(x - ${F(p).btex()}\\right)$$`,`$$y = ${L}$$`],ans:`$y = ${L}$`}}

// ================= YEAR 11: WORKING WITH FUNCTIONS =================
const sq=m=>`\\sqrt{${m}}`;
const rootTex=(q,x)=>q===2?`\\sqrt{${x}}`:`\\sqrt[${q}]{${x}}`;
const wrap=s=>s.includes('frac')?`\\left(${s}\\right)`:`(${s})`;
const sqN=n=>n<0?`(${n})^{2}`:`${n}^{2}`;
function lcm(a,b){return Math.abs(a*b)/gcd(a,b)}
function sqrtParts(n){let k=1,m=n;for(let f=2;f*f<=m;f++){while(m%(f*f)===0){m/=f*f;k*=f}}return[k,m]}
const nonSquares=[2,3,5,6,7,10,11,13,14,15];
function pMul(a,b){const r=Array(a.length+b.length-1).fill(null).map(()=>F(0));a.forEach((x,i)=>b.forEach((y,j)=>{r[i+j]=r[i+j].add(Fr.of(x).mul(y))}));return r}
function pAdd(a,b,k=1){const n=Math.max(a.length,b.length),r=[];for(let i=0;i<n;i++)r.push(Fr.of(a[i]||0).add(Fr.of(b[i]||0).mul(k)));return r}
function pComp(P,Q){let r=[F(0)],pw=[F(1)];P.forEach(c=>{r=pAdd(r,pw,c);pw=pMul(pw,Q)});return r}
const Lp=(a,b)=>[Fr.of(b),Fr.of(a)]; // ax+b as a coefficient array
const ineq={lt:'\\lt',gt:'\\gt',le:'\\le',ge:'\\ge'};
const flipOp={lt:'gt',gt:'lt',le:'ge',ge:'le'};
// substitute an expression (as LaTeX) into a polynomial, showing the working
function subSym(cs,arg){const parts=[];for(let i=cs.length-1;i>=0;i--){const c=Fr.of(cs[i]);if(c.isZero())continue;const neg=c.n<0,a=c.abs();
 let body;if(i===0)body=a.tex();else{const pw=i===1?`(${arg})`:`(${arg})^{${i}}`;body=(a.n===1&&a.d===1?'':a.tex())+pw}
 parts.push(parts.length?(neg?' - ':' + ')+body:(neg?'-':'')+body)}return parts.join('')||'0'}
// a + b√m, and the same over a common denominator
function surdTex(a,b,m){a=Fr.of(a);b=Fr.of(b);const s=sq(m);if(b.isZero())return a.tex();if(a.isZero())return term(b,s,true);return a.tex()+term(b,s,false)}
function surdFrac(p,q,m){p=Fr.of(p);q=Fr.of(q);const d=lcm(p.d,q.d),P=p.n*d/p.d,Q=q.n*d/q.d;
 if(d===1)return surdTex(P,Q,m);
 if(P===0){const A=Math.abs(Q);return (Q<0?'-':'')+`\\frac{${A===1?'':A}${sq(m)}}{${d}}`}
 return `\\frac{${surdTex(P,Q,m)}}{${d}}`}
function surdRoot(n){const[k,m]=sqrtParts(n);return m===1?String(k):(k===1?'':k)+sq(m)}
// line helpers
function toGeneral(m,c){m=Fr.of(m);c=Fr.of(c);const Lc=lcm(m.d,c.d);let A=m.n*Lc/m.d,B=-Lc,C=c.n*Lc/c.d;
 if(A<0||(A===0&&B<0)){A=-A;B=-B;C=-C}const g=gcd(gcd(A,B),C);return[A/g,B/g,C/g]}
const genTex=([A,B,C])=>poly([[A,'x'],[B,'y'],[C,'']])+' = 0';
const pt=(x,y)=>`(${Fr.of(x).tex()}, ${Fr.of(y).tex()})`;

// ---------- Algebraic techniques ----------
function mono(coef,ex,ey){const v=(s,e)=>e===0?'':e===1?s:`${s}^{${e}}`;return `${coef}${v('x',ex)}${v('y',ey)}`}
function gIndexLaws(R){const m=R.int(2,3),A=R.int(2,3),p=R.int(1,3),q=R.int(1,3),B=R.int(1,6),s=R.int(0,3),C=R.int(2,12),u=R.int(1,6),v=R.int(1,6);
 let r=R.int(0,4);if(B===1&&r===0&&s===0)r=1;
 const Bt=mono(B===1?'':B,r,s),top=`(${mono(A,p,q)})^{${m}}\\times ${Bt}`,bot=mono(C,u,v);
 const Am=A**m,ex=p*m+r-u,ey=q*m+s-v,k=F(Am*B,C);
 const pw1=(v,e)=>e===0?'':e===1?v:`${v}^{${e}}`,idx=term(k,pw1('x',ex)+pw1('y',ey),true);
 const numV=(ex>0?(ex===1?'x':`x^{${ex}}`):'')+(ey>0?(ey===1?'y':`y^{${ey}}`):'');
 const denV=(ex<0?(ex===-1?'x':`x^{${-ex}}`):'')+(ey<0?(ey===-1?'y':`y^{${-ey}}`):'');
 const nT=(k.n===1&&numV)?numV:k.n+numV,dT=(k.d===1?'':k.d)+denV,res=dT?`\\frac{${nT}}{${dT}}`:nT;
 const sol=[`Apply the power to every factor in the bracket:`,`$$\\frac{${top}}{${bot}} = \\frac{${mono(Am,p*m,q*m)}\\times ${Bt}}{${bot}}$$`,
  `Multiply the numbers, add the indices on top and subtract the indices below:`,`$$= ${idx}$$`];
 if(res!==idx)sol.push(`Write with positive indices:`,`$$= ${res}$$`);
 return{q:`Simplify, writing your answer with positive indices: $\\displaystyle\\frac{${top}}{${bot}}$`,sol,ans:`$${res}$`}}

function gFracIdx(R){const frac=R.next()<0.35,r=R.int(2,5),s=frac?R.pick([2,3,4,5].filter(x=>x!==r&&gcd(x,r)===1)):1;
 const big=Math.max(r,s),q=R.int(2,big<=3?4:big===4?3:2),p=R.pick([1,2,3,-1,-2,-3].filter(x=>gcd(Math.abs(x),q)===1));
 const bT=frac?`\\left(\\frac{${r**q}}{${s**q}}\\right)`:`${r**q}`,e=F(p,q),qT=`${bT}^{${e.tex()}}`,P=Math.abs(p);
 const val=p>0?F(r**p,s**p):F(s**-p,r**-p);const sol=[];
 let base=frac?`\\frac{${r**q}}{${s**q}}`:`${r**q}`,root=frac?`\\frac{${r}}{${s}}`:`${r}`;
 if(p<0){const rb=frac?`\\frac{${s**q}}{${r**q}}`:`\\frac{1}{${r**q}}`;
  sol.push(`A negative index means take the reciprocal:`,`$$${qT} = \\left(${rb}\\right)^{${F(P,q).tex()}}$$`);base=rb;root=frac?`\\frac{${s}}{${r}}`:`\\frac{1}{${r}}`}
 sol.push(`The denominator $${q}$ of the index is the root${P===1?'':` and the numerator $${P}$ is the power`}:`,
  `$$= ${P===1?rootTex(q,base):`${wrap(rootTex(q,base))}^{${P}}`} = ${P===1?root:`${wrap(root)}^{${P}}`}${P===1?'':` = ${val.tex()}`}$$`);
 return{q:`Evaluate $${qT}$ without a calculator.`,sol,ans:`$${val.tex()}$`}}

function gExpand(R){const a=R.nz(-4,4),b=R.nz(-7,7),c=R.nz(-4,4),d=R.nz(-7,7),e=R.nz(-3,3),f=R.nz(-6,6),k=R.pick([1,-1,2,-2,3,-3]),sq2=R.next()<0.5,g=R.nz(-3,3),h=R.nz(-6,6);
 const P1=pMul(Lp(a,b),Lp(c,d)),P2=sq2?pMul(Lp(e,f),Lp(e,f)):pMul(Lp(e,f),Lp(g,h)),S=pAdd(P1,P2,k);
 const second=sq2?`(${lin(e,f)})^{2}`:`(${lin(e,f)})(${lin(g,h)})`,kk=Math.abs(k),sg=k<0?' - ':' + ',kp=kk===1?'':kk;
 return{q:`Expand and simplify $(${lin(a,b)})(${lin(c,d)})${sg}${kp}${second}$.`,
  sol:[`Expand each product first:`,`$$= ${pTex(P1)}${sg}${kp}(${pTex(P2)})$$`,`Remove the brackets and collect like terms:`,`$$= ${pTex(S)}$$`],ans:`$${pTex(S)}$`}}

function gFactorise(R){const k=R.pick([1,1,1,2,3,-1,-2]);let p,q,r,s;
 do{p=R.pick([1,1,2,3]);r=R.pick([1,1,2]);q=R.nz(-6,6);s=R.nz(-6,6)}while(gcd(p,q)!==1||gcd(r,s)!==1);
 const A=p*r,B=p*s+q*r,C=q*s,inner=[C,B,A],full=inner.map(x=>x*k),f1=`(${lin(p,q)})`,f2=`(${lin(r,s)})`;
 const prod=f1===f2?`${f1}^{2}`:f1+f2,pre=k===1?'':k===-1?'-':String(k),res=pre+prod,sol=[];
 if(k!==1)sol.push(`Take out the common factor: $${pTex(full)} = ${pre}(${pTex(inner)})$`);
 if(A===1)sol.push(`Find two numbers that multiply to $${C}$ and add to $${B}$: they are $${q}$ and $${s}$.`);
 else{const n1=p*s,n2=q*r;
  sol.push(`Find two numbers that multiply to $${A}\\times ${C<0?`(${C})`:C} = ${A*C}$ and add to $${B}$: they are $${n1}$ and $${n2}$.`,
   `Split the middle term and group in pairs:`,
   `$$${term(A,'x^{2}',true)}${term(n1,'x',false)}${term(n2,'x',false)}${term(C,'',false)} = ${term(p,'x',true)}${f2}${term(q,'',false)}${f2}$$`)}
 sol.push(`$$${pTex(full)} = ${res}$$`);
 return{q:`Factorise fully: $${pTex(full)}$`,sol,ans:`$${res}$`}}

function gSpecial(R){
 if(R.next()<0.5){let k,a,b;do{k=R.pick([1,1,2,3,5]);a=R.int(1,5);b=R.int(1,9)}while(gcd(a,b)!==1);
  const expr=pTex([-k*b*b,0,k*a*a]),A=lin(a,0),pre=k===1?'':k,res=`${pre}(${lin(a,-b)})(${lin(a,b)})`,sol=[];
  if(k>1)sol.push(`Take out the common factor: $${expr} = ${k}(${pTex([-b*b,0,a*a])})$`);
  sol.push(`Use the difference of two squares, $A^{2} - B^{2} = (A - B)(A + B)$, with $A = ${A}$ and $B = ${b}$:`,`$$${expr} = ${res}$$`);
  return{q:`Factorise fully: $${expr}$`,sol,ans:`$${res}$`}}
 let p,a;do{p=R.int(1,3);a=R.int(1,5)}while(gcd(p,a)!==1||(p===1&&a===1));const sg=R.pick([1,-1]);
 const expr=pTex([sg*a**3,0,0,p**3]),res=`(${lin(p,sg*a)})(${poly([[p*p,'x^{2}'],[-sg*p*a,'x'],[a*a,'']])})`;
 const id=sg>0?'A^{3} + B^{3} = (A + B)(A^{2} - AB + B^{2})':'A^{3} - B^{3} = (A - B)(A^{2} + AB + B^{2})';
 return{q:`Factorise: $${expr}$`,sol:[`Use $${id}$ with $A = ${lin(p,0)}$ and $B = ${a}$:`,`$$${expr} = ${res}$$`],ans:`$${res}$`}}

function gAlgFrac(R){
 if(R.next()<0.5){let a,b;do{a=R.nz(-6,6);b=R.nz(-6,6)}while(a===b);const A=R.int(1,6),B=R.int(1,6),sg=R.pick([1,-1]),op=sg>0?'+':'-';
  const num=pAdd(pMul([A],Lp(1,b)),pMul([B],Lp(1,a)),sg),da=`(${lin(1,a)})`,db=`(${lin(1,b)})`,res=`\\frac{${pTex(num)}}{${da}${db}}`;
  return{q:`Write as a single fraction: $\\dfrac{${A}}{${lin(1,a)}} ${op} \\dfrac{${B}}{${lin(1,b)}}$`,
   sol:[`Use the common denominator $${da}${db}$:`,`$$= \\frac{${A===1?'':A}${db} ${op} ${B===1?'':B}${da}}{${da}${db}}$$`,`$$= ${res}$$`],ans:`$${res}$`}}
 let a,b,c;do{a=R.nz(-6,6);b=R.nz(-6,6);c=R.nz(-6,6)}while(a===b||a===c||b===c);
 const N=pMul(Lp(1,a),Lp(1,b)),D=pMul(Lp(1,a),Lp(1,c)),res=`\\frac{${lin(1,b)}}{${lin(1,c)}}`;
 return{q:`Simplify $\\dfrac{${pTex(N)}}{${pTex(D)}}$`,
  sol:[`Factorise the numerator and the denominator:`,`$$= \\frac{(${lin(1,a)})(${lin(1,b)})}{(${lin(1,a)})(${lin(1,c)})}$$`,`Cancel the common factor $(${lin(1,a)})$:`,`$$= ${res}$$`],ans:`$${res}$`}}

function gSurds(R){const m=R.pick([2,3,5,6,7]),v=R.int(0,2);
 if(v===0){const ks=R.sample([1,2,3,4,5],3),cs=[R.nz(-4,5),R.nz(-4,5),R.nz(-4,5)],T=ks.reduce((s,k,i)=>s+k*cs[i],0);
  const disp=ks.map((k,i)=>term(cs[i],sq(k*k*m),i===0)).join(''),simp=ks.filter(k=>k>1).map(k=>`$${sq(k*k*m)} = ${k}${sq(m)}$`).join(', ');
  const res=T===0?'0':term(T,sq(m),true);
  return{q:`Simplify $${disp}$`,sol:[`Simplify each surd: ${simp}.`,`$$= ${ks.map((k,i)=>term(cs[i]*k,sq(m),i===0)).join('')}$$`,`$$= ${res}$$`],ans:`$${res}$`}}
 if(v===1){const a=R.int(1,4),c=R.int(1,4),b=R.nz(-6,6),d=R.nz(-6,6),A=a*c*m+b*d,B=a*d+b*c;
  const disp=`(${term(a,sq(m),true)}${term(b,'',false)})(${term(c,sq(m),true)}${term(d,'',false)})`;
  return{q:`Expand and simplify $${disp}$`,sol:[`Expand, using $${sq(m)}\\times ${sq(m)} = ${m}$:`,`$$= ${a*c*m}${term(a*d,sq(m),false)}${term(b*c,sq(m),false)}${term(b*d,'',false)}$$`,`$$= ${surdTex(A,B,m)}$$`],ans:`$${surdTex(A,B,m)}$`}}
 const a=R.nz(-5,6),b=R.nz(-3,3);
 return{q:`Expand and simplify $(${a}${term(b,sq(m),false)})^{2}$`,
  sol:[`Use $(A + B)^{2} = A^{2} + 2AB + B^{2}$:`,`$$= ${a*a}${term(2*a*b,sq(m),false)}${term(b*b*m,'',false)}$$`,`$$= ${surdTex(a*a+b*b*m,2*a*b,m)}$$`],ans:`$${surdTex(a*a+b*b*m,2*a*b,m)}$`}}

function gRationalise(R){const c=R.pick(nonSquares),v=R.next();
 if(v<0.25){const a=R.int(1,12),res=surdFrac(0,F(a,c),c),first=`\\frac{${a===1?'':a}${sq(c)}}{${c}}`;
  const sol=[`Multiply the numerator and denominator by $${sq(c)}$:`,`$$\\frac{${a}}{${sq(c)}}\\times\\frac{${sq(c)}}{${sq(c)}} = ${first}$$`];if(res!==first)sol.push(`$$= ${res}$$`);
  return{q:`Express $\\dfrac{${a}}{${sq(c)}}$ with a rational denominator.`,sol,ans:`$${res}$`}}
 const b=R.int(1,6),s2=R.pick([1,-1]),D=b*b-c,den=`${b}${s2>0?' + ':' - '}${sq(c)}`,conj=`${b}${s2>0?' - ':' + '}${sq(c)}`;
 if(v<0.65){const a=R.int(1,9),P=a*b,Q=-s2*a,res=surdFrac(F(P,D),F(Q,D),c);
  return{q:`Express $\\dfrac{${a}}{${den}}$ with a rational denominator.`,
   sol:[`Multiply the numerator and denominator by the conjugate $${conj}$:`,`$$\\frac{${a}}{${den}}\\times\\frac{${conj}}{${conj}} = \\frac{${a===1?conj:`${a}(${conj})`}}{${b}^{2} - (${sq(c)})^{2}}$$`,
    ...overD(P,Q,D,c,res)],ans:`$${res}$`}}
 const a=R.int(1,6),s1=R.pick([1,-1]),num=`${a}${s1>0?' + ':' - '}${sq(c)}`,P=a*b-s1*s2*c,Q=s1*b-s2*a,res=surdFrac(F(P,D),F(Q,D),c);
 return{q:`Express $\\dfrac{${num}}{${den}}$ with a rational denominator.`,
  sol:[`Multiply the numerator and denominator by the conjugate $${conj}$:`,`$$\\frac{${num}}{${den}}\\times\\frac{${conj}}{${conj}} = \\frac{(${num})(${conj})}{${b}^{2} - (${sq(c)})^{2}}$$`,
   ...overD(P,Q,D,c,res)],ans:`$${res}$`}}
// the working line (P + Q√c)/D, then the simplified result if it differs
function overD(P,Q,D,c,res){const mid=D===1?surdTex(P,Q,c):`\\frac{${surdTex(P,Q,c)}}{${D}}`;return mid===res?[`$$= ${res}$$`]:[`$$= ${mid}$$`,`$$= ${res}$$`]}

function gQuadFormula(R){let a,b,c,D;do{a=R.pick([1,1,2,3,-1,2,-2]);b=R.nz(-9,9);c=R.nz(-9,9);D=b*b-4*a*c}while(D<=0||Number.isInteger(Math.sqrt(D)));
 const[k,m]=sqrtParts(D);let B=-b,K=k,Dn=2*a;const g=gcd(gcd(B,K),Dn);B/=g;K/=g;Dn/=g;if(Dn<0){B=-B;Dn=-Dn}
 const pm=(B===0?'':B+' ')+'\\pm '+(K===1?'':K)+sq(m),res=Dn===1?pm:`\\frac{${pm}}{${Dn}}`;
 const sol=[`$a = ${a}$, $b = ${b}$, $c = ${c}$`,`$$\\Delta = b^{2} - 4ac = ${sqN(b)} - 4(${a})(${c}) = ${D}$$`,`$$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${-b} \\pm ${sq(D)}}{${2*a}}$$`];
 if(k>1)sol.push(`Simplify the surd, $${sq(D)} = ${k}${sq(m)}$, and divide through:`);
 sol.push(`$$x = ${res}$$`);
 return{q:`Solve $${pTex([c,b,a])} = 0$, giving your answers in simplest surd form.`,sol,ans:`$x = ${res}$`}}

function gCompSquare(R){const v=R.next();
 if(v<0.4){const odd=R.next()<0.3,b=odd?R.pick([-7,-5,-3,-1,1,3,5,7]):2*R.nz(-6,6),c=R.int(-9,9),h=F(b,2),h2=h.mul(h),k=F(c).sub(h2);
  const res=`${wrap(poly([[1,'x'],[h,'']]))}^{2}${k.isZero()?'':term(k,'',false)}`;
  return{q:`Express $${pTex([c,b,1])}$ in the form $(x + h)^{2} + k$.`,
   sol:[`Half the coefficient of $x$ is $${h.tex()}$, so add and subtract $${h.n<0?wrap(h.tex()):h.d>1?wrap(h.tex()):h.tex()}^{2} = ${h2.tex()}$:`,
    `$$${pTex([c,b,1])} = ${pTex([0,b,1])}${term(h2,'',false)}${term(h2.neg(),'',false)}${c===0?'':term(c,'',false)}$$`,`$$= ${res}$$`],ans:`$${res}$`}}
 if(v<0.75){const h=R.nz(-5,5);let D;do{D=R.pick([2,3,5,6,7,8,10,11,12,13,1,4,9,16])}while(D===h*h);const c=h*h-D,[k,m]=sqrtParts(D);
  const x=m===1?`x = ${-h+k} \\text{ or } x = ${-h-k}`:`x = ${-h===0?'':-h+' '}\\pm ${surdRoot(D)}`;
  return{q:`Solve $${pTex([c,2*h,1])} = 0$ by completing the square.`,
   sol:[`$$${pTex([0,2*h,1])} = ${-c}$$`,`Add $${sqN(h)} = ${h*h}$ to both sides:`,`$$${pTex([h*h,2*h,1])} = ${D}$$`,`$$(${lin(1,h)})^{2} = ${D}$$`,
    `$$${lin(1,h)} = \\pm ${m===1?k:sq(D)}$$`,`$$${x}$$`],ans:`$${x}$`}}
 const a=R.pick([2,3,-1,-2]),h=R.nz(-4,4),b=2*a*h,c=R.int(-9,9),k=c-a*h*h,pre=a===-1?'-':String(a);
 const res=`${pre}(${lin(1,h)})^{2}${k===0?'':term(k,'',false)}`;
 return{q:`Write $y = ${pTex([c,b,a])}$ in the form $y = a(x - h)^{2} + k$ and state the vertex.`,
  sol:[`Take out $${a}$ from the $x$ terms:`,`$$y = ${pre}(${pTex([0,2*h,1])})${c===0?'':term(c,'',false)}$$`,`Complete the square inside the bracket:`,
   `$$y = ${pre}\\left((${lin(1,h)})^{2} - ${h*h}\\right)${c===0?'':term(c,'',false)}$$`,`$$y = ${res}$$`,`The vertex is $${pt(-h,k)}$.`],
  ans:`$y = ${res}$, vertex $${pt(-h,k)}$`}}

function gDiscriminant(R){const v=R.int(0,3),conds=[['two distinct real roots','gt'],['equal roots','eq'],['no real roots','lt'],['real roots','ge']];
 const sym={gt:'\\gt',eq:'=',lt:'\\lt',ge:'\\ge'};
 if(v===0){let a,b,c;if(R.next()<0.2){const r=R.nz(-5,5),s=R.pick([1,1,2,-1]);a=s;b=-2*s*r;c=s*r*r}else{a=R.pick([1,2,3,-1,-2]);b=R.int(-8,8);c=R.nz(-9,9)}
  const D=b*b-4*a*c,nat=D>0?(Number.isInteger(Math.sqrt(D))?'two distinct real rational roots':'two distinct real irrational roots'):D===0?'one real root (two equal roots)':'no real roots';
  const why=D>0?(Number.isInteger(Math.sqrt(D))?`$\\Delta \\gt 0$ and is a perfect square`:`$\\Delta \\gt 0$ but is not a perfect square`):D===0?`$\\Delta = 0$`:`$\\Delta \\lt 0$`;
  return{q:`Use the discriminant to determine the nature of the roots of $${pTex([c,b,a])} = 0$.`,
   sol:[`$$\\Delta = b^{2} - 4ac = ${sqN(b)} - 4(${a})(${c}) = ${D}$$`,`Since ${why}, there ${D<0?'are':D===0?'is':'are'} ${nat}.`],ans:nat.charAt(0).toUpperCase()+nat.slice(1)}}
 const [word,op]=R.pick(conds);
 if(v===1){const b=R.nz(-8,8),thr=F(b*b,4),kop={gt:'\\lt',eq:'=',lt:'\\gt',ge:'\\le'}[op];
  return{q:`For what values of $k$ does $${pTex([0,b,1])} + k = 0$ have ${word}?`,
   sol:[`For ${word} we need $\\Delta ${sym[op]} 0$.`,`$$\\Delta = ${sqN(b)} - 4(1)(k) = ${b*b} - 4k$$`,`$$${b*b} - 4k ${sym[op]} 0$$`,
    op==='eq'?`$$k = ${thr.tex()}$$`:`Subtract $${b*b}$, then divide by $-4$ and reverse the inequality sign:`,...(op==='eq'?[]:[`$$k ${kop} ${thr.tex()}$$`])],ans:`$k ${kop} ${thr.tex()}$`}}
 if(v===2){const b=R.nz(-8,8),c=R.nz(-6,6),k=F(b*b,4*c);
  return{q:`Find the value of $k$ for which $kx^{2}${term(b,'x',false)}${term(c,'',false)} = 0$ has equal roots.`,
   sol:[`Equal roots when $\\Delta = 0$:`,`$$${sqN(b)} - 4(k)(${c}) = 0$$`,`$$${b*b} ${term(-4*c,'k',false)} = 0$$`,`$$k = ${k.tex()}$$`],ans:`$k = ${k.tex()}$`}}
 const n=R.int(1,6),t=2*n,ans={gt:`k \\lt ${-t} \\text{ or } k \\gt ${t}`,eq:`k = \\pm ${t}`,lt:`${-t} \\lt k \\lt ${t}`,ge:`k \\le ${-t} \\text{ or } k \\ge ${t}`}[op];
 return{q:`For what values of $k$ does $x^{2} + kx + ${n*n} = 0$ have ${word}?`,
  sol:[`For ${word} we need $\\Delta ${sym[op]} 0$.`,`$$\\Delta = k^{2} - 4(1)(${n*n}) = k^{2} - ${4*n*n}$$`,`$$(k - ${t})(k + ${t}) ${sym[op]} 0$$`,
   op==='eq'?`$$${ans}$$`:`The parabola $y = k^{2} - ${4*n*n}$ is concave up with roots $k = \\pm ${t}$, so $$${ans}$$`],ans:`$${ans}$`}}

// ---------- Introduction to functions ----------
function gFnNotation(R){const v=R.int(0,2);
 if(v===0){const cs=[R.int(-6,6),R.int(-5,5),R.nz(-3,3)],p=R.nz(-4,4),f=pTex(cs),v1=pEval(cs,p),v2=pEval(cs,-p);
  return{q:`Given $f(x) = ${f}$, find $f(${p})$ and $f(${-p})$.`,sol:[`$$f(${p}) = ${subTex(cs,p)} = ${v1.tex()}$$`,`$$f(${-p}) = ${subTex(cs,-p)} = ${v2.tex()}$$`],
   ans:`$f(${p}) = ${v1.tex()}$, $f(${-p}) = ${v2.tex()}$`}}
 if(v===1){const cs=[R.int(-6,6),R.int(-5,5),R.nz(-3,3)],u=R.pick([1,1,2,-1,3]),w=R.nz(-3,3),X=Lp(u,w),arg=lin(u,w),res=pComp(cs,X);
  return{q:`Given $f(x) = ${pTex(cs)}$, find and simplify $f(${arg})$.`,
   sol:[`$$f(${arg}) = ${subSym(cs,arg)}$$`,`$$= ${poly([[cs[2],`(${pTex(pMul(X,X))})`],[cs[1],`(${arg})`],[cs[0],'']])}$$`,`$$= ${pTex(res)}$$`],ans:`$${pTex(res)}$`}}
 let r1,r2;do{r1=R.nz(-6,6);r2=R.nz(-6,6)}while(r1===r2);const k=R.nz(-9,9),b=-(r1+r2),c0=r1*r2+k,[s1,s2]=[Math.min(r1,r2),Math.max(r1,r2)];
 return{q:`Given $f(x) = ${pTex([c0,b,1])}$, find the values of $x$ for which $f(x) = ${k}$.`,
  sol:[`$$${pTex([c0,b,1])} = ${k}$$`,`$$${pTex([r1*r2,b,1])} = 0$$`,`$$${factored(1,s1,s2)} = 0$$`,`$$x = ${s1} \\text{ or } x = ${s2}$$`],ans:`$x = ${s1}$ or $x = ${s2}$`}}

function gDomainRange(R){const v=R.int(0,5);let f,dom,domI,ran,ranI,why;
 if(v===0){const a=R.nz(-3,4),b=R.int(-8,8),t=F(-b,a);f=`f(x) = ${sq(lin(a,b))}`;
  dom=a>0?`x \\ge ${t.tex()}`:`x \\le ${t.tex()}`;domI=a>0?`[${t.tex()}, \\infty)`:`(-\\infty, ${t.tex()}]`;ran='y \\ge 0';ranI='[0, \\infty)';
  why=[`The expression under the square root cannot be negative:`,`$$${lin(a,b)} \\ge 0 \\;\\Rightarrow\\; ${dom}$$`,a<0?`(Dividing by $${a}$ reverses the inequality sign.)`:'',`A square root is never negative and takes every value from $0$ upwards.`]}
 else if(v===1){const k=R.nz(-9,9),a=R.nz(-6,6);f=`f(x) = \\dfrac{${k}}{${lin(1,-a)}}`;
  dom=`x \\ne ${a}`;domI=`(-\\infty, ${a}) \\cup (${a}, \\infty)`;ran='y \\ne 0';ranI='(-\\infty, 0) \\cup (0, \\infty)';
  why=[`The denominator cannot be zero, so $x \\ne ${a}$.`,`The numerator is never zero, so the fraction never equals $0$, but it takes every other value.`]}
 else if(v===2){const a=R.pick([1,-1,2,-2]),h=R.int(-5,5),k=R.int(-8,8),pre=a===1?'':a===-1?'-':a,sqp=h===0?'x^{2}':`(${lin(1,-h)})^{2}`;
  f=`f(x) = ${pre}${sqp}${k===0?'':term(k,'',false)}`;dom='x \\in \\mathbb{R}';domI='(-\\infty, \\infty)';ran=a>0?`y \\ge ${k}`:`y \\le ${k}`;ranI=a>0?`[${k}, \\infty)`:`(-\\infty, ${k}]`;
  why=[`Any real $x$ can be substituted.`,`Since $${sqp} \\ge 0$, the ${a>0?'minimum':'maximum'} value of $f(x)$ is $${k}$ (the vertex is $${pt(h,k)}$).`]}
 else if(v===3){const r=R.int(1,9),s=R.pick([1,-1]);f=`f(x) = ${s<0?'-':''}${sq(`${r*r} - x^{2}`)}`;
  dom=`-${r} \\le x \\le ${r}`;domI=`[-${r}, ${r}]`;ran=s>0?`0 \\le y \\le ${r}`:`-${r} \\le y \\le 0`;ranI=s>0?`[0, ${r}]`:`[-${r}, 0]`;
  why=[`This is the ${s>0?'upper':'lower'} semicircle of $x^{2} + y^{2} = ${r*r}$, radius $${r}$.`,`We need $${r*r} - x^{2} \\ge 0$, so $${dom}$.`]}
 else if(v===4){const a=R.nz(-6,6);f=`f(x) = \\dfrac{1}{${sq(lin(1,-a))}}`;dom=`x \\gt ${a}`;domI=`(${a}, \\infty)`;ran='y \\gt 0';ranI='(0, \\infty)';
  why=[`We need $${lin(1,-a)} \\ge 0$ for the root and $${lin(1,-a)} \\ne 0$ for the fraction, so $${lin(1,-a)} \\gt 0$.`,`The root is positive, so its reciprocal is positive and can take any positive value.`]}
 else{const r=R.int(1,9),s=R.pick([1,-1]);f=`x = ${s<0?'-':''}${sq(`${r*r} - y^{2}`)}`;
  dom=s>0?`0 \\le x \\le ${r}`:`-${r} \\le x \\le 0`;domI=s>0?`[0, ${r}]`:`[-${r}, 0]`;ran=`-${r} \\le y \\le ${r}`;ranI=`[-${r}, ${r}]`;
  why=[`This is the ${s>0?'right':'left'} half of the circle $x^{2} + y^{2} = ${r*r}$, radius $${r}$.`]}
 return{q:`State the domain and range of $${f}$${v===5?' (a relation)':''}, using interval notation.`,
  sol:[...why.filter(Boolean),`Domain: $${dom}$, i.e. $${domI}$`,`Range: $${ran}$, i.e. $${ranI}$`],ans:`Domain $${domI}$, range $${ranI}$`}}

// ---------- Linear functions ----------
function gLine2pts(R){let x1,y1,x2,y2;do{x1=R.int(-6,6);x2=R.int(-6,6);y1=R.int(-6,6);y2=R.int(-6,6)}while(x1===x2||y1===y2);
 const m=F(y2-y1,x2-x1),c=F(y1).sub(m.mul(x1)),G=toGeneral(m,c),gi=`y = ${poly([[m,'x'],[c,'']])}`;
 return{q:`Find the equation of the line through $${pt(x1,y1)}$ and $${pt(x2,y2)}$. Give it in gradient–intercept form and in general form.`,
  sol:[`$$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${F(y1).btex()}}{${x2} - ${F(x1).btex()}} = ${m.tex()}$$`,`Using $y - y_1 = m(x - x_1)$:`,
   `$$y - ${F(y1).btex()} = ${m.btex()}(x - ${F(x1).btex()})$$`,`$$${gi}$$`,`In general form:`,`$$${genTex(G)}$$`],ans:`$${gi}$, or $${genTex(G)}$`}}

function gParPerp(R){let A,B,C;do{A=R.int(1,5);B=R.nz(-5,5);C=R.int(-9,9)}while(gcd(gcd(A,B),C)!==1);
 const m0=F(-A,B),perp=R.next()<0.5,m=perp?F(-1).div(m0):m0,p=R.int(-6,6),q=R.int(-6,6),c=F(q).sub(m.mul(p)),G=toGeneral(m,c);
 return{q:`Find the equation, in general form, of the line through $${pt(p,q)}$ that is ${perp?'perpendicular':'parallel'} to $${genTex([A,B,C])}$.`,
  sol:[`Rearrange: $${term(B,'y',true)} = ${poly([[-A,'x'],[-C,'']])}$, so $y = ${poly([[m0,'x'],[F(-C,B),'']])}$ with gradient $${m0.tex()}$.`,
   perp?`A perpendicular line has gradient $-\\dfrac{1}{m} = ${m.tex()}$.`:`A parallel line has the same gradient, $${m.tex()}$.`,
   `$$y - ${F(q).btex()} = ${m.btex()}(x - ${F(p).btex()})$$`,`$$y = ${poly([[m,'x'],[c,'']])}$$`,`$$${genTex(G)}$$`],ans:`$${genTex(G)}$`}}

function gLineFeatures(R){let A,B,C;do{A=R.int(1,6);B=R.nz(-6,6);C=R.nz(-12,12)}while(gcd(gcd(A,B),C)!==1);
 const xi=F(-C,A),yi=F(-C,B),m=F(-A,B);
 return{q:`For the line $${genTex([A,B,C])}$, find the gradient and the $x$- and $y$-intercepts.`,
  sol:[`$x$-intercept: put $y = 0$, so $${poly([[A,'x'],[C,'']])} = 0$ and $x = ${xi.tex()}$.`,`$y$-intercept: put $x = 0$, so $${poly([[B,'y'],[C,'']])} = 0$ and $y = ${yi.tex()}$.`,
   `Gradient: rearranging gives $y = ${poly([[m,'x'],[yi,'']])}$, so $m = ${m.tex()}$.`],ans:`$m = ${m.tex()}$, $x$-intercept $${xi.tex()}$, $y$-intercept $${yi.tex()}$`}}

function gLinIneq(R){let a,c;do{a=R.nz(-6,6);c=R.int(-6,6)}while(a===c);const b=R.int(-9,9),d=R.int(-9,9),op=R.pick(['lt','gt','le','ge']);
 const k=a-c,rv=d-b,val=F(rv,k),fop=k<0?flipOp[op]:op,sol=[];
 if(c!==0||b!==0)sol.push(`Collect the $x$ terms on the left and the numbers on the right:`,`$$${lin(k,0)} ${ineq[op]} ${rv}$$`);
 if(k<0)sol.push(`Divide by $${k}$ and reverse the inequality sign:`);else if(k!==1)sol.push(`Divide by $${k}$:`);
 sol.push(`$$x ${ineq[fop]} ${val.tex()}$$`);
 return{q:`Solve $${lin(a,b)} ${ineq[op]} ${lin(c,d)}$.`,sol,ans:`$x ${ineq[fop]} ${val.tex()}$`}}

// ---------- Quadratic functions ----------
function gParabola(R){
 if(R.next()<0.7){const a=R.pick([1,-1,2,-1,1]);let r1=R.int(-5,5),r2=R.int(-5,5);if(r1===r2)r2=r1+R.int(1,4);if(r1>r2)[r1,r2]=[r2,r1];
  const cs=[a*r1*r2,-a*(r1+r2),a],ax=F(r1+r2,2),vy=pEval(cs,ax);
  return{q:`For the parabola $y = ${pTex(cs)}$, find the axis of symmetry, the vertex and the intercepts with the axes.`,
   sol:[`Axis of symmetry: $x = -\\dfrac{b}{2a} = -\\dfrac{${cs[1]}}{2(${a})} = ${ax.tex()}$`,`Vertex: $y = ${subTex(cs,ax)} = ${vy.tex()}$, so the vertex is $${pt(ax,vy)}$.`,
    `$x$-intercepts: $${pTex(cs)} = ${factored(a,r1,r2)} = 0$, so $x = ${r1}$ and $x = ${r2}$.`,`$y$-intercept: $y = ${cs[0]}$.`,`The parabola is concave ${a>0?'up':'down'} since $a ${a>0?'\\gt':'\\lt'} 0$.`],
   ans:`Axis $x = ${ax.tex()}$; vertex $${pt(ax,vy)}$; $x$-intercepts $${r1}$, $${r2}$; $y$-intercept $${cs[0]}$`}}
 const a=R.pick([1,2,-1,-2]),h=R.int(-4,4),k=a>0?R.int(1,6):-R.int(1,6),cs=[a*h*h+k,-2*a*h,a],D=cs[1]*cs[1]-4*a*cs[0];
 return{q:`For the parabola $y = ${pTex(cs)}$, find the axis of symmetry, the vertex and any intercepts with the axes.`,
  sol:[`Axis of symmetry: $x = -\\dfrac{b}{2a} = -\\dfrac{${cs[1]}}{2(${a})} = ${h}$`,`Vertex: $y = ${subTex(cs,h)} = ${k}$, so the vertex is $${pt(h,k)}$.`,
   `$\\Delta = ${sqN(cs[1])} - 4(${a})(${cs[0]}) = ${D} \\lt 0$, so there are no $x$-intercepts.`,`$y$-intercept: $y = ${cs[0]}$.`,
   `The parabola is concave ${a>0?'up':'down'} and its vertex is ${a>0?'above':'below'} the $x$-axis, which agrees.`],
  ans:`Axis $x = ${h}$; vertex $${pt(h,k)}$; no $x$-intercepts; $y$-intercept $${cs[0]}$`}}

function gEquateCoeff(R){const a=R.nz(-3,4),b=R.int(-6,6),c=R.int(-6,6),h=R.nz(-3,3),X=Lp(1,h);
 const P=pAdd(pAdd(pMul([a],pMul(X,X)),pMul([b],X)),[c]),fx=`(${lin(1,h)})`;
 return{q:`Find $a$, $b$ and $c$ such that $${pTex(P)} \\equiv a${fx}^{2} + b${fx} + c$.`,
  sol:[`Expand the right-hand side:`,`$$a${fx}^{2} + b${fx} + c = ax^{2} + (${term(2*h,'a',true)} + b)x + (${term(h*h,'a',true)}${term(h,'b',false)} + c)$$`,
   `Coefficients of $x^{2}$: $a = ${a}$`,
   `Coefficients of $x$: $${term(2*h,'a',true)} + b = ${P[1].tex()}$, so $${2*h*a} + b = ${P[1].tex()}$ and $b = ${b}$`,
   `Constants: $${term(h*h,'a',true)}${term(h,'b',false)} + c = ${P[0].tex()}$, so $${h*h*a}${h*b===0?'':term(h*b,'',false)} + c = ${P[0].tex()}$ and $c = ${c}$`],
  ans:`$a = ${a}$, $b = ${b}$, $c = ${c}$`}}

function gSimulQuad(R){const b=R.int(-4,4),c=R.int(-5,5),p=R.int(-3,3),tan=R.next()<0.15,q=tan?p:p+R.int(1,4),m=b+p+q,d=c-p*q,par=[c,b,1],line=lin(m,d);
 const fac=tan?(p===0?'x^{2}':`(${lin(1,-p)})^{2}`):factored(1,p,q),yp=m*p+d,yq=m*q+d;
 return{q:`Solve simultaneously: $y = ${pTex(par)}$ and $y = ${line}$.`,
  sol:[`Equate the two expressions for $y$:`,`$$${pTex(par)} = ${line}$$`,`$$${pTex([p*q,-(p+q),1])} = 0$$`,`$$${fac} = 0$$`,
   tan?`So $x = ${p}$ only, and $y = ${yp}$. There is one point of intersection, so the line is a tangent to the parabola.`:`So $x = ${p}$ or $x = ${q}$. Substitute into the line: when $x = ${p}$, $y = ${yp}$; when $x = ${q}$, $y = ${yq}$.`],
  ans:tan?`$${pt(p,yp)}$ (the line is a tangent)`:`$${pt(p,yp)}$ and $${pt(q,yq)}$`}}

function gQuadIneq(R){const a=R.pick([1,1,-1]),r1=R.int(-6,5),r2=r1+R.int(1,6),op=R.pick(['lt','gt','le','ge']),shift=R.next()<0.4?R.nz(-8,8):0;
 const cs=[a*r1*r2,-a*(r1+r2),a],sol=[];
 if(shift)sol.push(`Rearrange so one side is zero:`,`$$${pTex(cs)} ${ineq[op]} 0$$`);
 let op2=op;if(a<0){op2=flipOp[op];sol.push(`Multiply by $-1$ and reverse the inequality sign:`,`$$${pTex(cs.map(x=>-x))} ${ineq[op2]} 0$$`)}
 sol.push(`$$${factored(1,r1,r2)} ${ineq[op2]} 0$$`);
 const below=op2==='lt'||op2==='le',lo=op2==='le'||op2==='ge'?'\\le':'\\lt',hi=op2==='le'||op2==='ge'?'\\ge':'\\gt';
 const ans=below?`${r1} ${lo} x ${lo} ${r2}`:`x ${lo} ${r1} \\text{ or } x ${hi} ${r2}`;
 sol.push(`$y = ${factored(1,r1,r2)}$ is concave up with roots $${r1}$ and $${r2}$, so it is ${below?'below':'above'} the $x$-axis ${below?'between':'outside'} the roots${lo==='\\le'?' (and zero at them)':''}:`,`$$${ans}$$`);
 return{q:`Solve $${pTex(pAdd(cs,[shift]))} ${ineq[op]} ${shift}$.`,sol,ans:`$${ans}$`}}

// ---------- Modelling and variation ----------
function gBreakEven(R){const v=R.int(3,30),d=R.int(2,20),pr=v+d,N=R.int(2,40)*10,F0=d*N,M=Math.max(10,N+R.pick([-1,1])*R.int(1,4)*10),P=d*M-F0;
 const item=R.pick(['candles','T-shirts','phone cases','cupcakes','posters','tote bags']);
 return{q:`A business makes ${item}. The cost of making $x$ ${item} is $C = ${F0} + ${v}x$ dollars, and the revenue from selling them is $R = ${pr}x$ dollars.<br>(a) Find the break-even point.<br>(b) Find the profit or loss when ${M} ${item} are made and sold.`,
  sol:[`(a) Break-even is where $R = C$:`,`$$${pr}x = ${F0} + ${v}x$$`,`$$${d}x = ${F0}$$`,`$$x = ${N}$$`,`Cost and revenue are both $${pr}\\times ${N} = ${pr*N}$ dollars, so the break-even point is $${pt(N,pr*N)}$.`,
   `(b) Profit is revenue minus cost:`,`$$P = ${pr}x - (${F0} + ${v}x) = ${d}x - ${F0}$$`,`$$P = ${d}(${M}) - ${F0} = ${P}$$`,
   P>=0?`A profit of ${P} dollars.`:`A loss of ${-P} dollars.`],ans:`(a) ${N} ${item} ($${pt(N,pr*N)}$); (b) ${P>=0?`profit of ${P}`:`loss of ${-P}`} dollars`}}

function gVariation(R){const inv=R.next()<0.45,n=inv?R.pick([1,2]):R.pick([1,2,3]),words={1:'$x$',2:'the square of $x$',3:'the cube of $x$'}[n],x1=R.int(2,5);
 let x2;do{x2=R.int(2,10)}while(x2===x1);const xP=n===1?'x':`x^{${n}}`,pw=v=>n===1?`${v}`:`${v}^{${n}}`;
 let k,y1;if(inv){y1=F(R.int(1,12));k=y1.mul(x1**n)}else{k=R.pick([F(1,2),F(2),F(3),F(4),F(5),F(6),F(10),F(3,2)]);y1=k.mul(x1**n)}
 const y2=inv?k.div(x2**n):k.mul(x2**n),model=inv?`\\frac{k}{${xP}}`:`k${xP}`,withK=inv?`\\frac{${k.tex()}}{${xP}}`:term(k,xP,true);
 return{q:`$y$ varies ${inv?'inversely':'directly'} as ${words}. When $x = ${x1}$, $y = ${y1.tex()}$. Find $y$ when $x = ${x2}$.`,
  sol:[`$$y = ${model}$$`,`Substitute $x = ${x1}$ and $y = ${y1.tex()}$:`,`$$${y1.tex()} = ${inv?`\\frac{k}{${pw(x1)}}`:`k\\times ${pw(x1)}`} \\;\\Rightarrow\\; k = ${k.tex()}$$`,
   `$$y = ${withK}$$`,`When $x = ${x2}$:`,`$$y = ${inv?`\\frac{${k.tex()}}{${pw(x2)}}`:`${k.tex()}\\times ${pw(x2)}`} = ${y2.tex()}$$`],ans:`$y = ${y2.tex()}$`}}

// ---------- Circles ----------
function gCircle(R){const v=R.int(0,2);
 if(v===0){const a=R.nz(-6,6),b=R.nz(-6,6),r2=a*a+b*b,rs=surdRoot(r2);
  return{q:`Find the equation of the circle with centre the origin that passes through $${pt(a,b)}$, and state its radius.`,
   sol:[`$$r^{2} = x^{2} + y^{2} = ${sqN(a)} + ${sqN(b)} = ${r2}$$`,`So the circle is $x^{2} + y^{2} = ${r2}$ and the radius is $r = ${sq(r2)}${rs===sq(r2)?'':` = ${rs}`}$.`],
   ans:`$x^{2} + y^{2} = ${r2}$, radius $${rs}$`}}
 if(v===1){let r,a,b;if(R.next()<0.25){[a,b,r]=R.pick([[3,4,5],[4,3,5],[0,5,5],[6,8,10],[5,0,5],[0,3,3],[2,0,2]]);a*=R.pick([1,-1]);b*=R.pick([1,-1]);if(r>9)[a,b,r]=[a/2,b/2,5]}
  else{r=R.int(2,9);a=R.int(-r-2,r+2);b=R.int(-r-2,r+2)}
  const d2=a*a+b*b,rel=d2<r*r?'inside':d2===r*r?'on':'outside',cmp=d2<r*r?'\\lt':d2===r*r?'=':'\\gt';
  return{q:`Does the point $${pt(a,b)}$ lie inside, on or outside the circle $x^{2} + y^{2} = ${r*r}$?`,
   sol:[`$$x^{2} + y^{2} = ${sqN(a)} + ${sqN(b)} = ${d2}$$`,`Since $${d2} ${cmp} ${r*r}$, the point lies ${rel} the circle.`],ans:rel.charAt(0).toUpperCase()+rel.slice(1)}}
 const r=R.int(2,9),w=R.int(0,3),half=['upper','lower','right','left'][w];
 const eq=[`y = ${sq(`${r*r} - x^{2}`)}`,`y = -${sq(`${r*r} - x^{2}`)}`,`x = ${sq(`${r*r} - y^{2}`)}`,`x = -${sq(`${r*r} - y^{2}`)}`][w];
 const dom=[`[-${r}, ${r}]`,`[-${r}, ${r}]`,`[0, ${r}]`,`[-${r}, 0]`][w],ran=[`[0, ${r}]`,`[-${r}, 0]`,`[-${r}, ${r}]`,`[-${r}, ${r}]`][w];
 return{q:`Write the equation of the ${half} half of the circle $x^{2} + y^{2} = ${r*r}$, and state its domain and range.`,
  sol:[`Make $${w<2?'y':'x'}$ the subject: $${w<2?'y':'x'}^{2} = ${r*r} - ${w<2?'x':'y'}^{2}$. The ${half} half takes the ${w%2===0?'positive':'negative'} square root:`,`$$${eq}$$`,
   `Domain $${dom}$, range $${ran}$.`],ans:`$${eq}$; domain $${dom}$, range $${ran}$`}}

// ---------- Properties of functions ----------
function gOddEven(R){
 if(R.next()<0.8){const kind=R.pick(['even','odd','neither']);let pows;
  if(kind==='even')pows=R.sample([0,2,4,6],R.int(2,3));else if(kind==='odd')pows=R.sample([1,3,5],R.int(2,3));
  else{pows=[R.pick([0,2,4]),R.pick([1,3,5])];if(R.next()<0.5)pows.push(R.pick([2,3,4,5].filter(x=>!pows.includes(x))))}
  const cs=Array(7).fill(null).map(()=>F(0));pows.forEach(p=>cs[p]=F(R.nz(-6,6)));
  const neg=cs.map((c,i)=>i%2?c.neg():c),minus=cs.map(c=>c.neg());
  const end=kind==='even'?`This is the same as $f(x)$, so $f$ is even.`:kind==='odd'?`This is $-f(x) = ${pTex(minus)}$, so $f$ is odd.`:`This is neither $f(x)$ nor $-f(x) = ${pTex(minus)}$, so $f$ is neither even nor odd.`;
  return{q:`Determine whether $f(x) = ${pTex(cs)}$ is even, odd or neither.`,sol:[`$$f(-x) = ${subSym(cs,'-x')}$$`,`$$= ${pTex(neg)}$$`,end],ans:kind==='neither'?'Neither':kind.charAt(0).toUpperCase()+kind.slice(1)}}
 const a=R.nz(-6,6),p=R.pick([1,2,3]),k=R.int(1,9),top=term(a,xp(p),true),odd=p%2===1,ap=a===1?'':a===-1?'-':a,mx=p===1?'(-x)':`(-x)^{${p}}`;
 return{q:`Determine whether $f(x) = \\dfrac{${top}}{x^{2} + ${k}}$ is even, odd or neither.`,
  sol:[`$$f(-x) = \\frac{${ap}${mx}}{(-x)^{2} + ${k}} = \\frac{${term(odd?-a:a,xp(p),true)}}{x^{2} + ${k}}$$`,
   odd?`This is $-f(x)$, so $f$ is odd.`:`This is the same as $f(x)$, so $f$ is even.`],ans:odd?'Odd':'Even'}}

function gComposite(R){const a=R.nz(-4,4),b=R.nz(-6,6),cc=R.pick([1,1,2,-1]),d=R.int(-6,6),f=Lp(a,b),g=[F(d),F(0),F(cc)],fg=pComp(f,g),gf=pComp(g,f);
 if(R.next()<0.7)return{q:`Given $f(x) = ${pTex(f)}$ and $g(x) = ${pTex(g)}$, find $f(g(x))$ and $g(f(x))$.`,
  sol:[`$$f(g(x)) = ${subSym(f,pTex(g))} = ${pTex(fg)}$$`,`$$g(f(x)) = ${subSym(g,pTex(f))}$$`,`$$= ${pTex(gf)}$$`],ans:`$f(g(x)) = ${pTex(fg)}$, $g(f(x)) = ${pTex(gf)}$`};
 const p=R.int(-3,3),gp=pEval(g,p),fgp=pEval(f,gp),fp=pEval(f,p),gfp=pEval(g,fp);
 return{q:`Given $f(x) = ${pTex(f)}$ and $g(x) = ${pTex(g)}$, find $f(g(${p}))$ and $g(f(${p}))$.`,
  sol:[`$g(${p}) = ${subTex(g,p)} = ${gp.tex()}$, so $f(g(${p})) = f(${gp.tex()}) = ${subTex(f,gp)} = ${fgp.tex()}$`,
   `$f(${p}) = ${subTex(f,p)} = ${fp.tex()}$, so $g(f(${p})) = g(${fp.tex()}) = ${subTex(g,fp)} = ${gfp.tex()}$`],ans:`$f(g(${p})) = ${fgp.tex()}$, $g(f(${p})) = ${gfp.tex()}$`}}

function gPiecewise(R){const t=R.int(-2,3),c=R.int(-4,5),m=R.nz(-3,3),cont=R.next()<0.5,q1=[F(c),F(0),F(1)],vt=pEval(q1,t);
 const d=cont?vt.sub(m*t):vt.sub(m*t).add(R.nz(-4,4)),l=[d,F(m)],left=R.pick(['lt','le']),right=left==='lt'?'ge':'gt',lt=pEval(l,t);
 const pc=`f(x) = \\begin{cases} ${pTex(q1)}, & x ${ineq[left]} ${t} \\\\ ${pTex(l)}, & x ${ineq[right]} ${t} \\end{cases}`;
 const p1=t-R.int(1,3),p2=t+R.int(1,3),useL=left==='le',ft=useL?vt:lt,same=vt.sub(lt).isZero();
 return{q:`For the function $$${pc}$$ (a) find $f(${p1})$, $f(${t})$ and $f(${p2})$; (b) determine whether $f$ is continuous at $x = ${t}$.`,
  sol:[`(a) $${p1} \\lt ${t}$, so use the first rule: $f(${p1}) = ${subTex(q1,p1)} = ${pEval(q1,p1).tex()}$`,
   `$x = ${t}$ belongs to the ${useL?'first':'second'} rule: $f(${t}) = ${subTex(useL?q1:l,t)} = ${ft.tex()}$`,
   `$${p2} \\gt ${t}$, so use the second rule: $f(${p2}) = ${subTex(l,p2)} = ${pEval(l,p2).tex()}$`,
   `(b) At $x = ${t}$ the first rule gives $${vt.tex()}$ and the second gives $${lt.tex()}$.`,
   same?`These are equal, so the two pieces join and $f$ is continuous at $x = ${t}$.`:`These are different, so the graph jumps and $f$ is not continuous at $x = ${t}$ (a discontinuity).`],
  ans:`$f(${p1}) = ${pEval(q1,p1).tex()}$, $f(${t}) = ${ft.tex()}$, $f(${p2}) = ${pEval(l,p2).tex()}$; ${same?'continuous':'not continuous'} at $x = ${t}$`}}

function gAbsEq(R){const a=R.nz(-5,5),b=R.int(-9,9),r=R.next(),k=r<0.1?-R.int(1,6):r<0.18?0:R.int(1,12),ins=lin(a,b),q=`Solve $|${ins}| = ${k}$.`;
 if(k<0)return{q,sol:[`An absolute value is a distance, so it is never negative. There are no solutions.`],ans:'No solution'};
 if(k===0){const x=F(-b,a);return{q,sol:[`$|${ins}| = 0$ only when $${ins} = 0$, so $x = ${x.tex()}$.`],ans:`$x = ${x.tex()}$`}}
 const x1=F(k-b,a),x2=F(-k-b,a),ax=lin(a,0);
 return{q,sol:[`$$${ins} = ${k} \\quad\\text{or}\\quad ${ins} = -${k}$$`,...(b===0?[]:[`$$${ax} = ${k-b} \\quad\\text{or}\\quad ${ax} = ${-k-b}$$`]),
  `$$x = ${x1.tex()} \\quad\\text{or}\\quad x = ${x2.tex()}$$`],ans:`$x = ${x1.tex()}$ or $x = ${x2.tex()}$`}}

// ---------- Year 12 Differentiation (exponential, log and trig functions) ----------
const eP=n=>n===0?'1':n===1?'e':`e^{${n}}`;                 // e to an integer power
const ex=s=>`e^{${s}}`;
const coefTex=c=>c===1?'':c===-1?'-':String(c);               // leading coefficient
// fn applied to an argument: sin x, sin 3x, sin(2x + 1)
const trigArg=a=>/^-?\d*x$/.test(a)?` ${a}`:`(${a})`;
const fnTex=(fn,arg,pow)=>`\\${fn}${pow?`^{${pow}}`:''}${trigArg(arg)}`;
// k·sqrt(m) as exact tex (m = 1 means no surd)
function surdVal(c,m){c=Fr.of(c);if(c.isZero())return'0';if(m===1)return c.tex();const neg=c.n<0,p=Math.abs(c.n),q=c.d,top=(p===1?'':p)+`\\sqrt{${m}}`;
 return(neg?'-':'')+(q===1?top:`\\frac{${top}}{${q}}`)}
// a fraction of pi as tex
function piTex(f){f=Fr.of(f);const p=Math.abs(f.n),s=f.n<0?'-':'',top=(p===1?'':p)+'\\pi';return s+(f.d===1?top:`\\frac{${top}}{${f.d}}`)}
// exact values: angle as a fraction of pi -> [coef, surd]
const TRIG={
 '1/6':{sin:[F(1,2),1],cos:[F(1,2),3],tan:[F(1,3),3],sec2:[F(4,3),1]},
 '1/4':{sin:[F(1,2),2],cos:[F(1,2),2],tan:[F(1),1],sec2:[F(2),1]},
 '1/3':{sin:[F(1,2),3],cos:[F(1,2),1],tan:[F(1),3],sec2:[F(4),1]},
 '1/2':{sin:[F(1),1],cos:[F(0),1]},
 '2/3':{sin:[F(1,2),3],cos:[F(-1,2),1],tan:[F(-1),3],sec2:[F(4),1]},
 '3/4':{sin:[F(1,2),2],cos:[F(-1,2),2],tan:[F(-1),1],sec2:[F(2),1]},
 '5/6':{sin:[F(1,2),1],cos:[F(-1,2),3],tan:[F(-1,3),3],sec2:[F(4,3),1]},
 '1/1':{sin:[F(0),1],cos:[F(-1),1],tan:[F(0),1],sec2:[F(1),1]}};

function gDExp(R){const v=R.int(0,2);
 if(v===0){const A=R.pick([1,1,2,3,-1,-2,4,5]),b=R.nz(-6,6),c=R.int(-6,6),e=lin(b,c);
  return{q:`Differentiate $y = ${coefTex(A)}${ex(e)}$.`,marks:1,
   sol:[`Chain rule: $\\dfrac{d}{dx}e^{f(x)} = f'(x)e^{f(x)}$ with $f(x) = ${e}$, $f'(x) = ${b}$.`,`$$\\frac{dy}{dx} = ${coefTex(A*b)}${ex(e)}$$`],ans:`$${coefTex(A*b)}${ex(e)}$`}}
 if(v===1){const a=R.pick([1,1,2,-1,3]),b=R.nz(-6,6),e=poly([[a,'x^{2}'],[b,'x']]),d=lin(2*a,b);
  return{q:`Differentiate $y = ${ex(e)}$.`,marks:2,
   sol:[`$f(x) = ${e}$, so $f'(x) = ${d}$.`,`$$\\frac{dy}{dx} = (${d})${ex(e)}$$`],ans:`$(${d})${ex(e)}$`}}
 const A=R.nz(-4,4),b=R.int(1,5),C=R.nz(-4,4),d=R.int(1,5);
 const y=`${coefTex(A)}${ex(lin(b,0))}`+(C>0?' + ':' - ')+`${coefTex(Math.abs(C))}${ex(lin(-d,0))}`;
 const dy=`${coefTex(A*b)}${ex(lin(b,0))}`+(-C*d>0?' + ':' - ')+`${coefTex(Math.abs(C*d))}${ex(lin(-d,0))}`;
 return{q:`Differentiate $y = ${y}$.`,marks:1,sol:[`Differentiate each term: $\\dfrac{d}{dx}e^{kx} = ke^{kx}$.`,`$$\\frac{dy}{dx} = ${dy}$$`],ans:`$${dy}$`}}

function gDAx(R){const a=R.pick([2,3,5,7,10]),b=R.pick([1,1,2,3,-1]),k=R.pick([1,1,1,2,3,4]),e=lin(b,0),kb=k*b;
 const lead=kb===1?'':kb===-1?'-':String(kb);
 return{q:`Differentiate $y = ${k===1?'':`${k}\\times `}${a}^{${e}}$.`,marks:1,
  sol:[`$\\dfrac{d}{dx}a^{x} = (\\ln a)a^{x}$; with the chain rule, $\\dfrac{d}{dx}a^{bx} = b(\\ln a)a^{bx}$.`,`$$\\frac{dy}{dx} = ${lead}(\\ln ${a})\\,${a}^{${e}}$$`],ans:`$${lead}(\\ln ${a})\\,${a}^{${e}}$`}}

function gDProdExp(R){const k=R.nz(-4,4),n=R.int(1,3),E=ex(lin(k,0)),v=R.next();
 if(v<0.6){const xn=xp(n),xm=xp(n-1);
  // fully factorised: take out the common number too, and lead with the positive term, e.g. 2xe^{-4x}(1 - 2x)
  const g=gcd(k,n),a=Math.abs(k)/g,c=n/g,ax=a===1?'x':a+'x',br=k>0?lin(a,c):`${c} - ${ax}`,pre=g===1?'':String(g);
  return{q:`Differentiate $y = ${xn}${E}$, giving your answer in factorised form.`,marks:2,
   sol:[`Product rule: $u = ${xn}$, $u' = ${n===1?'1':term(n,xm,true)}$; $\\;v = ${E}$, $v' = ${coefTex(k)}${E}$.`,
    `$$\\frac{dy}{dx} = ${n===1?'':term(n,xm,true)}${E} ${k<0?'-':'+'} ${coefTex(Math.abs(k))}${xn}${E}$$`,`$$= ${pre}${xm}${E}(${br})$$`],ans:`$${pre}${xm}${E}(${br})$`}}
 const m=R.int(1,2),xm=xp(m),num=lin(k,-m),den=xp(m+1);
 return{q:`Differentiate $y = \\dfrac{${E}}{${xm}}$, giving your answer in simplest form.`,marks:2,
  sol:[`Quotient rule: $u = ${E}$, $u' = ${coefTex(k)}${E}$; $\\;v = ${xm}$, $v' = ${m===1?'1':`${m}x`}$.`,
   `$$\\frac{dy}{dx} = \\frac{${coefTex(k)}${xm}${E} - ${m===1?'':`${m}x`}${E}}{${xp(2*m)}}$$`,
   m===1?`$$= \\frac{${E}(${num})}{${den}}$$`:`$$= \\frac{x${E}(${num})}{${xp(2*m)}} = \\frac{${E}(${num})}{${den}}$$`],ans:`$\\dfrac{${E}(${num})}{${den}}$`}}

function gDTanExp(R){const k=R.pick([1,2,3,-1,-2]),p=R.pick([0,1,1,2,-1]),kp=k*p,E=eP(kp);
 const ptT=`(${p}, ${E})`,m=kp===0?String(k):term(k,E,true);
 const tan=kp===0?`y = ${lin(k,1)}`:`y = ${term(k,E+'x',true)}${1-kp===0?'':term(1-kp,E,false)}`;
 return{q:`Find the equation of the tangent to $y = ${ex(lin(k,0))}$ at the point where $x = ${p}$.`,marks:3,
  sol:[`Point: $y = ${ex(String(kp))}${kp===0||kp===1?` = ${E}`:''}$, so $${ptT}$.`,`$\\dfrac{dy}{dx} = ${coefTex(k)}${ex(lin(k,0))}$, so $m = ${m}$.`,
   `$$y - ${E} = ${kp===0?coefTex(k):m}${p===0?'x':`(${lin(1,-p)})`}$$`,`$$${tan}$$`],ans:`$${tan}$`}}

function gDLn(R){const v=R.int(0,2);
 if(v===0){let a,b;do{a=R.nz(-6,6);b=R.nz(-9,9)}while(gcd(a,b)!==1);const f=lin(a,b),k=R.pick([1,1,1,2,3]);
  const num=k*a;return{q:`Differentiate $y = ${k===1?'':k}\\ln(${f})$.`,marks:1,
   sol:[`$\\dfrac{d}{dx}\\ln f(x) = \\dfrac{f'(x)}{f(x)}$ with $f(x) = ${f}$, $f'(x) = ${a}$.`,`$$\\frac{dy}{dx} = ${k===1?'':`${k}\\times `}\\frac{${a}}{${f}} = ${num<0?'-':''}\\frac{${Math.abs(num)}}{${f}}$$`],
   ans:`$${num<0?'-':''}\\dfrac{${Math.abs(num)}}{${f}}$`}}
 if(v===1){const a=R.pick([1,1,2,3]),b=R.int(-6,6),c=R.nz(-9,9),f=poly([[a,'x^{2}'],[b,'x'],[c,'']]),d=lin(2*a,b);
  return{q:`Differentiate $y = \\ln(${f})$.`,marks:1,sol:[`$f(x) = ${f}$, $f'(x) = ${d}$.`,`$$\\frac{dy}{dx} = \\frac{${d}}{${f}}$$`],ans:`$\\dfrac{${d}}{${f}}$`}}
 const b=R.int(2,9);
 return{q:`Differentiate $y = \\ln ${b}x$. What do you notice?`,marks:2,
  sol:[`$$\\frac{dy}{dx} = \\frac{${b}}{${b}x} = \\frac{1}{x}$$`,`Same as $\\dfrac{d}{dx}\\ln x$: by the log laws $\\ln ${b}x = \\ln ${b} + \\ln x$, and $\\ln ${b}$ is a constant.`],ans:`$\\dfrac{1}{x}$, the same as the derivative of $\\ln x$`}}

function gDLogLaw(R){
 if(R.next()<0.5){let a,b;do{a=R.int(1,4);b=R.nz(-7,7)}while(gcd(a,b)!==1);const n=R.int(2,5),f=lin(a,b),num=n*a;
  return{q:`Differentiate $y = \\ln((${f})^{${n}})$.`,marks:2,
   sol:[`Log law first: $y = ${n}\\ln(${f})$.`,`$$\\frac{dy}{dx} = ${n}\\times\\frac{${a}}{${f}} = ${num<0?'-':''}\\frac{${Math.abs(num)}}{${f}}$$`],ans:`$${num<0?'-':''}\\dfrac{${Math.abs(num)}}{${f}}$`}}
 let a,b,c,d;do{a=R.int(1,4);b=R.nz(-7,7);c=R.int(1,4);d=R.nz(-7,7)}while(a*d-b*c===0||(a===c&&b===d));
 const f=lin(a,b),g=lin(c,d),top=a*d-b*c;
 return{q:`Differentiate $y = \\ln\\left(\\dfrac{${f}}{${g}}\\right)$, giving your answer as a single fraction.`,marks:3,
  sol:[`Log law first: $y = \\ln(${f}) - \\ln(${g})$.`,`$$\\frac{dy}{dx} = \\frac{${a}}{${f}} - \\frac{${c}}{${g}}$$`,
   `$$= \\frac{${a}(${g}) - ${c}(${f})}{(${f})(${g})} = ${top<0?'-':''}\\frac{${Math.abs(top)}}{(${f})(${g})}$$`],ans:`$${top<0?'-':''}\\dfrac{${Math.abs(top)}}{(${f})(${g})}$`}}

function gDLoga(R){const a=R.pick([2,3,5,10]),v=R.int(0,2);
 if(v===0)return{q:`Differentiate $y = \\log_{${a}}x$.`,marks:1,sol:[`$\\log_{${a}}x = \\dfrac{\\ln x}{\\ln ${a}}$`,`$$\\frac{dy}{dx} = \\frac{1}{x\\ln ${a}}$$`],ans:`$\\dfrac{1}{x\\ln ${a}}$`};
 let A1,B1;do{A1=R.int(2,6);B1=R.nz(-7,7)}while(gcd(A1,B1)!==1);
 const f=v===1?lin(A1,B1):poly([[1,'x^{2}'],[R.nz(-9,9),'']]),d=v===1?f.match(/^\d+/)[0]:'2x';
 return{q:`Differentiate $y = \\log_{${a}}(${f})$.`,marks:2,
  sol:[`Change to natural logs: $y = \\dfrac{\\ln(${f})}{\\ln ${a}}$.`,`$$\\frac{dy}{dx} = \\frac{1}{\\ln ${a}}\\times\\frac{${d}}{${f}} = \\frac{${d}}{(${f})\\ln ${a}}$$`],ans:`$\\dfrac{${d}}{(${f})\\ln ${a}}$`}}

function gDTrig(R){const fn=R.pick(['sin','cos','tan']);
 if(R.next()<0.7){const A=R.pick([1,1,2,3,4,5,-1,-2,-3]),b=R.int(1,6),c=R.next()<0.4?R.nz(-5,5):0,arg=lin(b,c),k=A*b;
  const out=fn==='sin'?`${coefTex(k)}${fnTex('cos',arg)}`:fn==='cos'?`${coefTex(-k)}${fnTex('sin',arg)}`:`${coefTex(k)}${fnTex('sec',arg,2)}`;
  return{q:`Differentiate $y = ${coefTex(A)}${fnTex(fn,arg)}$.`,marks:1,
   sol:[`$\\dfrac{d}{dx}\\${fn}(ax + b) = ${fn==='sin'?'a\\cos(ax + b)':fn==='cos'?'-a\\sin(ax + b)':'a\\sec^{2}(ax + b)'}$ with $a = ${b}$.`,`$$\\frac{dy}{dx} = ${out}$$`],ans:`$${out}$`}}
 const p=R.pick([2,2,3]),b=R.nz(-6,6),arg=poly([[1,xp(p)],[b,'x']]),d=poly([[p,xp(p-1)],[b,'']]);
 const out=fn==='sin'?`(${d})${fnTex('cos',arg)}`:fn==='cos'?`-(${d})${fnTex('sin',arg)}`:`(${d})${fnTex('sec',arg,2)}`;
 return{q:`Differentiate $y = ${fnTex(fn,arg)}$.`,marks:2,sol:[`Chain rule with $f(x) = ${arg}$, $f'(x) = ${d}$.`,`$$\\frac{dy}{dx} = ${out}$$`],ans:`$${out}$`}}

function gDTrigProd(R){const v=R.int(0,2),k=R.int(1,4),kx=lin(k,0);
 if(v===0){const fn=R.pick(['sin','cos']),n=R.int(1,2),xn=xp(n),xm=xp(n-1),S=fnTex('sin',kx),C=fnTex('cos',kx);
  const br=fn==='sin'?`${n}${S} + ${kx}${C}`:`${n}${C} - ${kx}${S}`;
  return{q:`Differentiate $y = ${xn}${fnTex(fn,kx)}$, giving your answer in factorised form.`,marks:2,
   sol:[`Product rule: $u = ${xn}$, $u' = ${n===1?'1':'2x'}$; $\\;v = ${fnTex(fn,kx)}$, $v' = ${fn==='sin'?coefTex(k)+C:coefTex(-k)+S}$.`,
    `$$\\frac{dy}{dx} = ${n===1?'':'2x'}${fnTex(fn,kx)} ${fn==='sin'?'+':'-'} ${coefTex(k)}${xn}${fn==='sin'?C:S}$$`,`$$= ${n===1?br.replace(/^1\\/,'\\'):`x(${br})`}$$`],
   ans:`$${n===1?br.replace(/^1\\/,'\\'):`x(${br})`}$`}}
 if(v===1){const S=fnTex('sin',kx),C=fnTex('cos',kx),num=`${kx}${C} - ${S}`;
  return{q:`Differentiate $y = \\dfrac{${S}}{x}$.`,marks:2,sol:[`Quotient rule: $u = ${S}$, $u' = ${coefTex(k)}${C}$; $\\;v = x$, $v' = 1$.`,`$$\\frac{dy}{dx} = \\frac{${num}}{x^{2}}$$`],ans:`$\\dfrac{${num}}{x^{2}}$`}}
 const a=R.nz(-3,3),E=ex(lin(a,0)),fn=R.pick(['sin','cos']),S=fnTex('sin',kx),C=fnTex('cos',kx);
 const br=fn==='sin'?`${coefTex(a)}${S} + ${coefTex(k)}${C}`:`${coefTex(a)}${C} - ${coefTex(k)}${S}`;
 return{q:`Differentiate $y = ${E}${fnTex(fn,kx)}$, giving your answer in factorised form.`,marks:2,
  sol:[`Product rule: $u = ${E}$, $u' = ${coefTex(a)}${E}$; $\\;v = ${fnTex(fn,kx)}$, $v' = ${fn==='sin'?coefTex(k)+C:coefTex(-k)+S}$.`,`$$\\frac{dy}{dx} = ${E}(${br})$$`],ans:`$${E}(${br})$`}}

function gDTrigExact(R){const fn=R.pick(['sin','cos','tan']),keys=Object.keys(TRIG).filter(t=>fn!=='tan'||TRIG[t].sec2),th=R.pick(keys),[tn,td]=th.split('/').map(Number);
 const A=R.pick([1,2,3,4,-1,-2]),k=R.int(1,4),x0=F(tn,td*k),theta=F(tn,td),kx=lin(k,0);
 const dfn=fn==='sin'?'cos':fn==='cos'?'sin':'sec2',coef=fn==='cos'?-A*k:A*k,[c,m]=TRIG[th][dfn],g=surdVal(c.mul(coef),m);
 const dTex=fn==='sin'?`${coefTex(A*k)}${fnTex('cos',kx)}`:fn==='cos'?`${coefTex(-A*k)}${fnTex('sin',kx)}`:`${coefTex(A*k)}${fnTex('sec',kx,2)}`;
 const valName=fn==='tan'?`\\sec^{2}${piTex(theta)}`:`\\${dfn}${piTex(theta)}`;
 return{q:`Find the exact gradient of the tangent to $y = ${coefTex(A)}${fnTex(fn,kx)}$ at the point where $x = ${piTex(x0)}$.`,marks:2,
  sol:[`$$\\frac{dy}{dx} = ${dTex}$$`,`At $x = ${piTex(x0)}$, $${kx} = ${piTex(theta)}$ and $${valName} = ${surdVal(c,m)}$.`,`$$m = ${coef}\\times ${surdVal(c,m).startsWith('-')?wrap(surdVal(c,m)):surdVal(c,m)} = ${g}$$`],ans:`$${g}$`}}

// ---------- Year 11 Exponential and logarithmic functions ----------
const logT=(b,x)=>`\\log_{${b}}${/^[\d.]+$|^[a-z]$/.test(String(x))?' '+x:x}`;
function gLEval(R){const b=R.pick([2,3,5]),s=R.pick([1,1,2,3]),base=b**s;let t;do{t=R.int(-3,4)}while(b**Math.abs(t)>243||t===s);
 const arg=t>=0?String(b**t):`\\frac{1}{${b**-t}}`,val=F(t,s);
 return{q:`Evaluate $${logT(base,arg)}$.`,marks:1,
  sol:s===1?[`$$${arg} = ${b}^{${t}}$$`,`$$${logT(base,arg)} = ${val.tex()}$$`]:[`Write both as powers of $${b}$: $${base} = ${b}^{${s}}$ and $${arg} = ${b}^{${t}}$.`,`$(${b}^{${s}})^{x} = ${b}^{${t}}$ gives $${s}x = ${t}$.`,`$$${logT(base,arg)} = ${val.tex()}$$`],ans:`$${val.tex()}$`}}

function gLLaws(R){const b=R.pick([2,3,5,6,10]),v=R.int(0,2);let q,steps,val;
 if(v===0){const t=R.int(2,3),N=b**t;let ds=[];for(let d=2;d<N;d++)if(N%d===0&&d!==b)ds.push(d);if(!ds.length)ds=[b];const p=R.pick(ds),r=N/p;
  q=`${logT(b,p)} + ${logT(b,r)}`;steps=[`Product law: $${logT(b,`(${p}\\times ${r})`)} = ${logT(b,N)}$`];val=t;steps.push(`$${N} = ${b}^{${t}}$, so the value is $${t}$.`)}
 else if(v===1){const t=R.int(1,2),r=R.int(2,9),p=r*b**t;q=`${logT(b,p)} - ${logT(b,r)}`;steps=[`Quotient law: $${logT(b,`\\frac{${p}}{${r}}`)} = ${logT(b,b**t)}$`,`$${b**t} = ${b}^{${t}}$, so the value is $${t}$.`];val=t}
 else{const r=R.int(2,4),p=b*r,qv=r*r;q=`2${logT(b,p)} - ${logT(b,qv)}`;steps=[`Power law: $2${logT(b,p)} = ${logT(b,p*p)}$`,`Quotient law: $${logT(b,`\\frac{${p*p}}{${qv}}`)} = ${logT(b,b*b)} = 2$`];val=2}
 return{q:`Evaluate $${q}$.`,marks:2,sol:steps,ans:`$${val}$`}}

function gLExpand(R){const m=R.int(2,5),n=R.int(1,4),k=R.int(1,4),sqrtY=R.next()<0.35,b=R.pick(['a','a','3','10']);
 const top=`x^{${m}}${sqrtY?'\\sqrt{y}':n===1?'y':`y^{${n}}`}`,yc=sqrtY?F(1,2):F(n);
 const res=`${m}${logT(b,'x')}${term(yc,logT(b,'y'),false)} - ${k===1?'':k}${logT(b,'z')}`;
 return{q:`Expand $${logT(b,`\\dfrac{${top}}{${k===1?'z':`z^{${k}}`}}`)}$.`,marks:2,
  sol:[`Product and quotient laws: $${logT(b,`x^{${m}}`)} + ${logT(b,sqrtY?'\\sqrt{y}':n===1?'y':`y^{${n}}`)} - ${logT(b,k===1?'z':`z^{${k}}`)}$`,`Power law${sqrtY?' ($\\sqrt{y} = y^{\\frac{1}{2}}$)':''}:`,`$$= ${res}$$`],ans:`$${res}$`}}

function gLPQ(R){let i,j;do{i=R.int(-2,3);j=R.int(-2,2)}while((i===0&&j===0)||(i>=0&&j>=0&&2**i*3**j<6)||Math.abs(i)+Math.abs(j)<2);
 const val=F(2**Math.max(i,0)*3**Math.max(j,0),2**Math.max(-i,0)*3**Math.max(-j,0)),N=val.tex(),res=poly([[i,'p'],[j,'q']]);
 const fac=[i?(i===1?'2':`2^{${i}}`):'',j?(j===1?'3':`3^{${j}}`):''].filter(Boolean).join('\\times ');
 return{q:`Given $\\log_{a}2 = p$ and $\\log_{a}3 = q$, find $\\log_{a}${val.d===1?' '+N:N}$ in terms of $p$ and $q$.`,marks:2,
  sol:[`$$${N} = ${fac}$$`,`$$\\log_{a}${val.d===1?' '+N:N} = ${i?`${i===1?'':i===-1?'-':i}\\log_{a}2`:''}${j?`${j>0&&i?' + ':j<0?' - ':''}${Math.abs(j)===1?'':Math.abs(j)}\\log_{a}3`:''} = ${res}$$`],ans:`$${res}$`}}

function gLSolveExp(R){const a=R.pick([2,3,5,7]),b=R.pick([1,1,2,3]),c=R.int(-3,3);let N;do{N=R.int(5,200)}while(Math.abs(Math.log(N)/Math.log(a)-Math.round(Math.log(N)/Math.log(a)))<1e-9);
 const e=lin(b,c),L=Math.log(N)/Math.log(a),x=(L-c)/b;
 return{q:`Solve $${a}^{${e}} = ${N}$, correct to 2 decimal places.`,marks:2,
  sol:[`$$${e} = ${logT(a,N)} = \\frac{\\ln ${N}}{\\ln ${a}} = ${L.toFixed(4)}\\ldots$$`,...(b===1&&c===0?[]:[`$$x = ${b===1?'':'\\frac{'}${L.toFixed(4)}\\ldots${c?(c>0?' - ':' + ')+Math.abs(c):''}${b===1?'':`}{${b}}`}$$`]),`$$x \\approx ${x.toFixed(2)}$$`],ans:`$x \\approx ${x.toFixed(2)}$`}}

function gLSameBase(R){const b=R.pick([2,3,5]),s=R.pick([1,2,2,3]),base=b**s;let t;do{t=R.int(-3,6)}while(b**Math.abs(t)>729||t===0);
 const a=R.pick([1,1,2,3]),c=R.int(-3,3),e=lin(a,c),rhs=t>0?String(b**t):`\\frac{1}{${b**-t}}`,x=F(t-s*c,s*a);
 return{q:`Solve $${base}^{${e}} = ${rhs}$.`,marks:2,
  sol:[`Write both sides as powers of $${b}$: $${s===1?`${b}^{${e}}`:`${b}^{${s}(${e})}`} = ${b}^{${t}}$`,`$$${s===1?e:`${s}(${e})`} = ${t}$$`,`$$x = ${x.tex()}$$`],ans:`$x = ${x.tex()}$`}}

function gLHidden(R){const b=R.pick([2,3]),p=R.int(0,3);let q,neg=R.next()<0.3;do{q=R.int(0,3)}while(q===p);
 const u1=b**p,u2=neg?-R.int(1,5):b**q,S=u1+u2,P=u1*u2,bx=`${b}^{x}`;
 const eq=`${b}^{2x}${S?term(-S,`(${bx})`,false):''}${term(P,'',false)} = 0`,fu=v=>v<0?`(u + ${-v})`:`(u - ${v})`;
 const steps=[`Let $u = ${bx}$, so $${b}^{2x} = u^{2}$:`,`$$u^{2}${S?term(-S,'u',false):''}${term(P,'',false)} = 0$$`,`$$${fu(u1)}${fu(u2)} = 0$$`,
  `$${bx} = ${u1}$ gives $x = ${p}$.`,neg?`$${bx} = ${u2}$ has no solution, since $${bx} \\gt 0$ for all $x$.`:`$${bx} = ${u2}$ gives $x = ${q}$.`];
 return{q:`Solve $${eq}$.`,marks:3,sol:steps,ans:neg?`$x = ${p}$`:`$x = ${Math.min(p,q)}$ or $x = ${Math.max(p,q)}$`}}

function gLLnQuad(R){let r1,r2;do{r1=R.nz(-3,4);r2=R.nz(-3,4)}while(r1===r2||r1+r2===0);
 const S=r1+r2,P=r1*r2,fu=v=>v<0?`(u + ${-v})`:`(u - ${v})`;
 return{q:`Solve $\\ln x ${P<0?'-':'+'} \\dfrac{${Math.abs(P)}}{\\ln x} = ${S}$, giving exact answers.`,marks:3,
  sol:[`Let $u = \\ln x$ and multiply by $u$:`,`$$u^{2}${term(-S,'u',false)}${term(P,'',false)} = 0$$`,`$$${fu(r1)}${fu(r2)} = 0$$`,`$\\ln x = ${r1}$ or $\\ln x = ${r2}$, so $x = ${eP(r1)}$ or $x = ${eP(r2)}$.`],
  ans:`$x = ${eP(Math.min(r1,r2))}$ or $x = ${eP(Math.max(r1,r2))}$`}}

function gLChange(R){const a=R.pick([2,3,4,5,6,7,8,9]);let N;do{N=R.pick([R.int(3,99),R.int(100,500)])}while(Math.abs(Math.log(N)/Math.log(a)-Math.round(Math.log(N)/Math.log(a)))<1e-9);
 const v=Math.log(N)/Math.log(a);
 return{q:`Use the change of base rule to evaluate $${logT(a,N)}$, correct to 2 decimal places.`,marks:1,
  sol:[`$$${logT(a,N)} = \\frac{\\ln ${N}}{\\ln ${a}} = ${v.toFixed(4)}\\ldots \\approx ${v.toFixed(2)}$$`],ans:`$${v.toFixed(2)}$`}}

function gLDomain(R){const a=R.nz(-5,5),b=R.nz(-9,9),f=lin(a,b),L=R.pick(['\\ln','\\log_{2}','\\log_{10}']),bd=F(-b,a);
 const op=a>0?'\\gt':'\\lt';
 return{q:`State the domain of $y = ${L}(${f})$.`,marks:1,
  sol:[`A log is only defined for positive values: $${f} \\gt 0$.`,...(a===1?[]:[`$$${lin(a,0)} \\gt ${-b}$$`]),...(a<0?[`Divide by $${a}$ and reverse the inequality:`]:[]),`$$x ${op} ${bd.tex()}$$`],ans:`$x ${op} ${bd.tex()}$`}}

function gLDerivEx(R){const v=R.int(0,2);
 if(v===0){const k=R.nz(-6,6),cs=[R.int(-6,6),R.nz(-5,5),R.int(-3,3)],d=pDer(cs);
  const y=`${coefTex(k)}e^{x}${pTex(cs)==='0'?'':(pTex(cs).startsWith('-')?' - '+pTex(cs).slice(1):' + '+pTex(cs))}`,dy=`${coefTex(k)}e^{x}${pTex(d)==='0'?'':(pTex(d).startsWith('-')?' - '+pTex(d).slice(1):' + '+pTex(d))}`;
  return{q:`Differentiate $y = ${y}$.`,marks:1,sol:[`$\\dfrac{d}{dx}e^{x} = e^{x}$; differentiate each term.`,`$$\\frac{dy}{dx} = ${dy}$$`],ans:`$${dy}$`}}
 const n=R.int(1,3);
 if(v===1)return{q:`Differentiate $y = ${xp(n)}e^{x}$, giving your answer in factorised form.`,marks:2,
  sol:[`Product rule: $u = ${xp(n)}$, $u' = ${n===1?'1':term(n,xp(n-1),true)}$; $\\;v = e^{x}$, $v' = e^{x}$.`,`$$\\frac{dy}{dx} = ${n===1?'':term(n,xp(n-1),true)}e^{x} + ${xp(n)}e^{x} = ${xp(n-1)}e^{x}(${lin(1,n)})$$`],ans:`$${xp(n-1)}e^{x}(${lin(1,n)})$`};
 return{q:`Differentiate $y = \\dfrac{e^{x}}{${xp(n)}}$, giving your answer in simplest form.`,marks:2,
  sol:[`Quotient rule: $u = e^{x}$, $u' = e^{x}$; $\\;v = ${xp(n)}$, $v' = ${n===1?'1':term(n,xp(n-1),true)}$.`,`$$\\frac{dy}{dx} = \\frac{${xp(n)}e^{x} - ${n===1?'':term(n,xp(n-1),true)}e^{x}}{${xp(2*n)}} = \\frac{e^{x}(${lin(1,-n)})}{${xp(n+1)}}$$`],ans:`$\\dfrac{e^{x}(${lin(1,-n)})}{${xp(n+1)}}$`}}


// ================= TOPICS & LESSONS =================
// Rename / reorder / regroup freely. Lesson ids are used in share links, so keep them stable once in use.
const TOPICS=[
 {id:'12adv-differentiation',name:'Differential calculus',course:'Year 12 Advanced',lessons:[
  {id:'dd-exp',group:'Exponentials',name:'Derivative of e to a power',gen:gDExp,marks:1},
  {id:'dd-ax',group:'Exponentials',name:'Derivative of a to the x',gen:gDAx,marks:1},
  {id:'dd-prodexp',group:'Exponentials',name:'Products and quotients with e',gen:gDProdExp,marks:2},
  {id:'dd-tanexp',group:'Exponentials',name:'Tangents to exponential curves',gen:gDTanExp,marks:3},
  {id:'dd-ln',group:'Logarithms',name:'Derivative of ln f(x)',gen:gDLn,marks:1},
  {id:'dd-loglaw',group:'Logarithms',name:'Log laws before differentiating',gen:gDLogLaw,marks:2},
  {id:'dd-loga',group:'Logarithms',name:'Derivative of log base a',gen:gDLoga,marks:1},
  {id:'dd-trig',group:'Trigonometric functions',name:'Derivatives of sin, cos and tan',gen:gDTrig,marks:1},
  {id:'dd-trigprod',group:'Trigonometric functions',name:'Trig with product and quotient rules',gen:gDTrigProd,marks:2},
  {id:'dd-trigexact',group:'Trigonometric functions',name:'Exact gradients on trig curves',gen:gDTrigExact,marks:2}]},
 {id:'11adv-explog',name:'Exponential and logarithmic functions',course:'Year 11 Advanced',lessons:[
  {id:'el-eval',group:'Logarithms',name:'Evaluating logarithms',gen:gLEval,marks:1},
  {id:'el-laws',group:'Logarithms',name:'Evaluating with the log laws',gen:gLLaws,marks:2},
  {id:'el-expand',group:'Logarithms',name:'Expanding with the log laws',gen:gLExpand,marks:2},
  {id:'el-pq',group:'Logarithms',name:'Logs in terms of p and q',gen:gLPQ,marks:2},
  {id:'el-change',group:'Logarithms',name:'Change of base',gen:gLChange,marks:1},
  {id:'el-domain',group:'Logarithms',name:'Domain of a log function',gen:gLDomain,marks:1},
  {id:'el-samebase',group:'Equations',name:'Exponential equations: same base',gen:gLSameBase,marks:2},
  {id:'el-solveexp',group:'Equations',name:'Exponential equations using logs',gen:gLSolveExp,marks:2},
  {id:'el-hidden',group:'Equations',name:'Hidden quadratics in a to the x',gen:gLHidden,marks:3},
  {id:'el-lnquad',group:'Equations',name:'Hidden quadratics in ln x',gen:gLLnQuad,marks:3},
  {id:'el-derivex',group:'Calculus',name:'The derivative of e to the x',gen:gLDerivEx,marks:2}]},
 {id:'12adv-integration',name:'Integral calculus',course:'Year 12 Advanced',lessons:[
  {id:'ic-power',name:'Power rule (polynomials)',gen:gPower,marks:2},
  {id:'ic-index',name:'Negative and fractional indices',gen:gIndices,marks:2},
  {id:'ic-chain',name:'Reverse chain rule: (ax + b)ⁿ',gen:gLinPow,marks:2},
  {id:'ic-def',name:'Definite integrals',gen:gDef,marks:2},
  {id:'ic-exp',name:'Integrating exponentials',gen:gExp,marks:1},
  {id:'ic-log',name:'Integrals giving logarithms',gen:gLog,marks:1},
  {id:'ic-trig',name:'Integrating trig functions',gen:gTrig,marks:1},
  {id:'ic-area',name:'Area between curve and x-axis',gen:gArea,marks:3},
  {id:'ic-signed',name:'Area: curve crosses the x-axis',gen:gSigned,marks:3},
  {id:'ic-trap',name:'Trapezoidal rule',gen:gTrap,marks:2}]},
 {id:'11adv-functions',name:'Working with functions',course:'Year 11 Advanced',lessons:[
  {id:'wf-index',group:'Algebraic techniques',name:'Index laws',gen:gIndexLaws,marks:2},
  {id:'wf-fracidx',group:'Algebraic techniques',name:'Negative and fractional indices',gen:gFracIdx,marks:1},
  {id:'wf-expand',group:'Algebraic techniques',name:'Expanding and simplifying',gen:gExpand,marks:2},
  {id:'wf-factorise',group:'Algebraic techniques',name:'Factorising quadratics',gen:gFactorise,marks:1},
  {id:'wf-special',group:'Algebraic techniques',name:'Difference of squares, sum and difference of cubes',gen:gSpecial,marks:2},
  {id:'wf-algfrac',group:'Algebraic techniques',name:'Algebraic fractions',gen:gAlgFrac,marks:2},
  {id:'wf-surds',group:'Algebraic techniques',name:'Simplifying and expanding surds',gen:gSurds,marks:2},
  {id:'wf-rationalise',group:'Algebraic techniques',name:'Rationalising denominators',gen:gRationalise,marks:2},
  {id:'wf-quadformula',group:'Algebraic techniques',name:'Quadratic formula',gen:gQuadFormula,marks:2},
  {id:'wf-compsquare',group:'Algebraic techniques',name:'Completing the square',gen:gCompSquare,marks:2},
  {id:'wf-discriminant',group:'Algebraic techniques',name:'The discriminant',gen:gDiscriminant,marks:2},
  {id:'wf-notation',group:'Functions and relations',name:'Function notation',gen:gFnNotation,marks:1},
  {id:'wf-domain',group:'Functions and relations',name:'Domain and range',gen:gDomainRange,marks:2},
  {id:'wf-line2pts',group:'Linear functions',name:'Line through two points',gen:gLine2pts,marks:2},
  {id:'wf-parperp',group:'Linear functions',name:'Parallel and perpendicular lines',gen:gParPerp,marks:2},
  {id:'wf-linefeat',group:'Linear functions',name:'Gradient and intercepts',gen:gLineFeatures,marks:2},
  {id:'wf-linineq',group:'Linear functions',name:'Linear inequalities',gen:gLinIneq,marks:2},
  {id:'wf-parabola',group:'Quadratic functions',name:'Features of a parabola',gen:gParabola,marks:3},
  {id:'wf-equate',group:'Quadratic functions',name:'Equating coefficients',gen:gEquateCoeff,marks:3},
  {id:'wf-simul',group:'Quadratic functions',name:'Line and parabola simultaneously',gen:gSimulQuad,marks:3},
  {id:'wf-quadineq',group:'Quadratic functions',name:'Quadratic inequalities',gen:gQuadIneq,marks:2},
  {id:'wf-breakeven',group:'Modelling and variation',name:'Cost, revenue and break-even',gen:gBreakEven,marks:3},
  {id:'wf-variation',group:'Modelling and variation',name:'Direct and inverse variation',gen:gVariation,marks:2},
  {id:'wf-circle',group:'Circles and semicircles',name:'Circles and semicircles',gen:gCircle,marks:2},
  {id:'wf-oddeven',group:'Properties of functions',name:'Odd and even functions',gen:gOddEven,marks:2},
  {id:'wf-composite',group:'Properties of functions',name:'Composite functions',gen:gComposite,marks:2},
  {id:'wf-piecewise',group:'Properties of functions',name:'Piecewise functions and continuity',gen:gPiecewise,marks:3},
  {id:'wf-abs',group:'Properties of functions',name:'Absolute value equations',gen:gAbsEq,marks:2},
  ]},
 {id:'11adv-calculus',name:'Differential calculus (review)',course:'Year 11 Advanced',lessons:[
  {id:'dc-index',name:'Differentiating with indices',gen:gDiffIdx,marks:2},
  {id:'dc-tangent',name:'Equation of a tangent',gen:gTangent,marks:3}]}
];
const LESSONS={};TOPICS.forEach(t=>t.lessons.forEach(l=>{l.topic=t;LESSONS[l.id]=l}));

function buildSet(ids,n,seed,mix){const R=makeRng(seed+'|'+ids.join(','));
 const base=Math.floor(n/ids.length),extra=new Set(R.sample(ids,n%ids.length));
 const out=[],seen=new Set();
 ids.forEach(id=>{const L=LESSONS[id],cnt=base+(extra.has(id)?1:0);
  for(let i=0;i<cnt;i++){let Q,tries=0;do{Q=L.gen(R);tries++}while(seen.has(Q.q)&&tries<30);seen.add(Q.q);out.push({...Q,lesson:L})}});
 if(mix){for(let i=out.length-1;i>0;i--){const j=Math.floor(R.next()*(i+1));[out[i],out[j]]=[out[j],out[i]]}}
 return out}
