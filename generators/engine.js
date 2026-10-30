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


// ================= YEAR 11: SHARED HELPERS =================
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const units=(n,w)=>`${n} unit${n===1?'':'s'} ${w}`;
const dp=(x,d=1)=>{const s=x.toFixed(d);return s==='-0'+(d?'.'+'0'.repeat(d):'')?s.slice(1):s};
const DEG=d=>`${d}^{\\circ}`;
// degrees and minutes, e.g. 48°05'
function dms(x){const t=Math.round(x*60),d=Math.floor(t/60),m=t%60;return `${d}^{\\circ}${String(m).padStart(2,'0')}'`}
const r2d=r=>r*180/Math.PI,d2r=d=>d*Math.PI/180;
const sinD=d=>Math.sin(d2r(d)),cosD=d=>Math.cos(d2r(d)),tanD=d=>Math.tan(d2r(d));
// decimal from an integer count of hundredths (or other denominator), without float noise
const dec=(n,den=100)=>String(Number((n/den).toFixed(6)));
// a fraction, plus its decimal when it terminates
function frDec(f){f=Fr.of(f);let d=f.d;while(d%2===0)d/=2;while(d%5===0)d/=5;return d===1&&f.d!==1?`${f.tex()} = ${String(Number(f.val().toFixed(6)))}`:f.tex()}

// ================= YEAR 11: GRAPH TRANSFORMATIONS =================
const GT_BASE={
 sq:{eq:'x^{2}',f:a=>a==='x'?'x^{2}':`(${a})^{2}`},
 cube:{eq:'x^{3}',f:a=>a==='x'?'x^{3}':`(${a})^{3}`},
 sqrt:{eq:'\\sqrt{x}',f:a=>`\\sqrt{${a}}`},
 abs:{eq:'|x|',f:a=>`|${a}|`},
 recip:{eq:'\\frac{1}{x}'}};
// y = K·base(x − H) + C as tex
function gtRule(base,K,H,C){K=Fr.of(K);C=Fr.of(C);const a=lin(1,-H);let body;
 if(base==='recip'){const n=Math.abs(K.n),d=K.d,den=d===1?a:`${d}${H===0?'x':`(${a})`}`;body=(K.n<0?'-':'')+`\\frac{${n}}{${den}}`}
 else{const k=K.n===K.d?'':K.n===-K.d?'-':K.tex();body=k+GT_BASE[base].f(a)}
 return body+(C.isZero()?'':term(C,'',false))}
// K f(arg) + C for a general f
function fTex(K,arg,C){K=Fr.of(K);C=Fr.of(C);const k=K.n===K.d?'':K.n===-K.d?'-':K.tex();
 const br=arg.includes('frac')?`\\left(${arg}\\right)`:`(${arg})`;return `${k}f${br}`+(C.isZero()?'':term(C,'',false))}
const listWords=w=>w.length===1?w[0]:w.slice(0,-1).join(', then ')+' and then '+w[w.length-1];

function gGtRule(R){const base=R.pick(['sq','cube','sqrt','abs','recip']);
 const pool=[{t:'vd',k:R.pick([2,3,4,F(1,2)])},{t:'rx'},{t:'ht',h:R.nz(-4,4)},{t:'vt',c:R.nz(-5,5)}];
 const ops=R.sample(pool,R.int(2,3));
 let K=F(1),H=0,C=F(0);const lines=[],words=[];
 ops.forEach(o=>{let w;
  if(o.t==='vd'){K=K.mul(o.k);C=C.mul(o.k);w=`dilated vertically by a factor of $${Fr.of(o.k).tex()}$`}
  else if(o.t==='rx'){K=K.neg();C=C.neg();w='reflected in the $x$-axis'}
  else if(o.t==='ht'){H+=o.h;w=`translated ${units(Math.abs(o.h),o.h>0?'to the right':'to the left')}`}
  else{C=C.add(o.c);w=`translated ${units(Math.abs(o.c),o.c>0?'up':'down')}`}
  words.push(w);lines.push(`${cap(w)}: $y = ${gtRule(base,K,H,C)}$`)});
 const fin=gtRule(base,K,H,C);
 return{q:`The graph of $y = ${GT_BASE[base].eq}$ is ${listWords(words)}. Write down the equation of the new graph.`,marks:2,
  sol:[...lines,'Each step changes the equation from the step before, so the order of the steps matters.'],ans:`$y = ${fin}$`}}

function gGtDescribe(R){
 if(R.next()<0.6){const K=Fr.of(R.pick([2,3,-1,-2,F(1,2),-3,4])),H=R.nz(-5,5),C=R.pick([0,R.nz(-6,6),R.nz(-6,6)]);
  const steps=[`translate ${units(Math.abs(H),H>0?'to the right':'to the left')}`];
  if(K.abs().val()!==1)steps.push(`dilate vertically by a factor of $${K.abs().tex()}$`);
  if(K.n<0)steps.push('reflect in the $x$-axis');
  if(C)steps.push(`translate ${units(Math.abs(C),C>0?'up':'down')}`);
  const e=fTex(K,lin(1,-H),C),parts=[];
  if(K.abs().val()!==1)parts.push('a vertical dilation');if(K.n<0)parts.push('a reflection in the $x$-axis');
  return{q:`Describe a sequence of transformations that maps the graph of $y = f(x)$ onto the graph of $y = ${e}$.`,marks:2,
   sol:[`$x$ is replaced by $${lin(1,-H)}$: a horizontal translation.`,`The function is multiplied by $${K.tex()}$: ${parts.join(' and ')}.`,
    ...(C?[`$${C}$ is added at the end: a vertical translation, done last.`]:[]),`One sequence: ${steps.join(', then ')}.`],
   ans:cap(steps.join(', then '))+'.'}}
 const kind=R.pick(['bx','xb','negx']),C=R.pick([0,R.nz(-6,6)]),neg=R.next()<0.3;let arg,step,why;
 if(kind==='bx'){const b=R.int(2,4);arg=`${b}x`;step=`dilate horizontally by a factor of $\\frac{1}{${b}}$`;why=`$x$ is replaced by $${b}x$: a horizontal dilation by a factor of $\\frac{1}{${b}}$.`}
 else if(kind==='xb'){const b=R.int(2,4);arg=`\\frac{x}{${b}}`;step=`dilate horizontally by a factor of $${b}$`;why=`$x$ is replaced by $\\frac{x}{${b}}$: a horizontal dilation by a factor of $${b}$.`}
 else{arg='-x';step='reflect in the $y$-axis';why='$x$ is replaced by $-x$: a reflection in the $y$-axis.'}
 const steps=[step];if(neg)steps.push('reflect in the $x$-axis');if(C)steps.push(`translate ${units(Math.abs(C),C>0?'up':'down')}`);
 return{q:`Describe a sequence of transformations that maps the graph of $y = f(x)$ onto the graph of $y = ${fTex(neg?-1:1,arg,C)}$.`,marks:2,
  sol:[why,...(neg?['The function is multiplied by $-1$: a reflection in the $x$-axis.']:[]),...(C?[`$${C}$ is added at the end: a vertical translation.`]:[]),`One sequence: ${steps.join(', then ')}.`],
  ans:cap(steps.join(', then '))+'.'}}

function gGtPoint(R){const p=R.int(-5,5),q=R.int(-5,5);
 if(R.next()<0.6){const K=Fr.of(R.pick([2,3,-1,-2,F(1,2)])),H=R.nz(-4,4),C=R.nz(-5,5),X=F(p+H),Y=K.mul(q).add(C);
  return{q:`The point $${pt(p,q)}$ lies on the graph of $y = f(x)$. Find the coordinates of its image on the graph of $y = ${fTex(K,lin(1,-H),C)}$.`,marks:2,
   sol:[`$x$ is replaced by $${lin(1,-H)}$, so the point moves ${units(Math.abs(H),H>0?'right':'left')}: $x = ${p} ${H>0?'+':'-'} ${Math.abs(H)} = ${X.tex()}$.`,
    `Each $y$-value is multiplied by $${K.tex()}$, then $${C}$ is added: $y = ${K.tex()}\\times ${F(q).btex()} ${C>0?'+':'-'} ${Math.abs(C)} = ${Y.tex()}$.`],ans:`$${pt(X,Y)}$`}}
 const kind=R.pick(['bx','xb','negx']),C=R.pick([0,R.nz(-4,4)]);let arg,X,why;
 if(kind==='bx'){const b=R.int(2,4);arg=`${b}x`;X=F(p,b);why=`Horizontal dilation by a factor of $\\frac{1}{${b}}$: $x = ${p===0||p%b===0||gcd(p,b)===1&&p>0?'':`\\frac{${p}}{${b}} = `}${X.tex()}$.`}
 else if(kind==='xb'){const b=R.int(2,4);arg=`\\frac{x}{${b}}`;X=F(p*b);why=`Horizontal dilation by a factor of $${b}$: $x = ${b}\\times ${F(p).btex()} = ${X.tex()}$.`}
 else{arg='-x';X=F(-p);why=`Reflection in the $y$-axis: $x = ${X.tex()}$.`}
 const Y=F(q+C);
 return{q:`The point $${pt(p,q)}$ lies on the graph of $y = f(x)$. Find the coordinates of its image on the graph of $y = ${fTex(1,arg,C)}$.`,marks:2,
  sol:[why,C?`Vertical translation by $${C}$: $y = ${q} ${C>0?'+':'-'} ${Math.abs(C)} = ${Y.tex()}$.`:`The $y$-value is unchanged: $y = ${q}$.`],ans:`$${pt(X,Y)}$`}}

function gGtFeatures(R){
 if(R.next()<0.6){const a=R.nz(-6,6),h=R.nz(-4,4),k=R.nz(-4,4),y0=F(-a,h).add(k),x0=F(h).sub(F(a,k));
  return{q:`For the graph of $y = ${gtRule('recip',a,h,k)}$, state the equations of the asymptotes, the domain and range, and find the $x$- and $y$-intercepts.`,marks:3,
   sol:[`This is $y = \\frac{1}{x}$ dilated, translated ${units(Math.abs(h),h>0?'right':'left')} and ${units(Math.abs(k),k>0?'up':'down')}.`,
    `Asymptotes: $x = ${h}$ and $y = ${k}$.`,`Domain: all real $x$, $x \\ne ${h}$. Range: all real $y$, $y \\ne ${k}$.`,
    `$y$-intercept ($x = 0$): $y = \\frac{${a}}{0 ${h>0?'-':'+'} ${Math.abs(h)}} ${k>0?'+':'-'} ${Math.abs(k)} = ${F(a,-h).tex()} ${k>0?'+':'-'} ${Math.abs(k)} = ${y0.tex()}$.`,
    `$x$-intercept ($y = 0$): $\\frac{${a}}{${lin(1,-h)}} = ${-k}$, so $${lin(1,-h)} = ${F(a,-k).tex()}$ and $x = ${x0.tex()}$.`],
   ans:`Asymptotes $x = ${h}$, $y = ${k}$; domain $x \\ne ${h}$, range $y \\ne ${k}$; intercepts $${pt(0,y0)}$ and $${pt(x0,0)}$`}}
 const a=R.pick([1,2,3,-1,-2]),h=R.nz(-5,5),k=R.int(-5,5),up=a>0;
 return{q:`State the domain, range and the coordinates of the endpoint of $y = ${gtRule('sqrt',a,h,k)}$.`,marks:2,
  sol:[`The square root needs $${lin(1,-h)} \\ge 0$, so the domain is $x \\ge ${h}$.`,`$\\sqrt{${lin(1,-h)}} \\ge 0$, ${a<0?`so $${coefTex(a)}\\sqrt{${lin(1,-h)}} \\le 0$, `:''}so $y ${up?'\\ge':'\\le'} ${k}$.`,
   `The endpoint is where $x = ${h}$: $${pt(h,k)}$.`],ans:`Domain $x \\ge ${h}$, range $y ${up?'\\ge':'\\le'} ${k}$, endpoint $${pt(h,k)}$`}}

function gGtCircle(R){const p=R.int(-6,6),q=R.int(-6,6);
 const sqx=(c,v)=>c===0?`${v}^{2}`:`(${poly([[1,v],[-c,'']])})^{2}`;
 if(R.next()<0.6||(p===0&&q===0)){const r=R.int(1,8),D=-2*p,E=-2*q,Fc=p*p+q*q-r*r;
  const eq=poly([[1,'x^{2}'],[1,'y^{2}'],[D,'x'],[E,'y'],[Fc,'']])+' = 0';
  return{q:`Find the centre and radius of the circle $${eq}$.`,marks:3,
   sol:[`Group and complete the square in $x$ and in $y$:`,`$$${poly([[1,'x^{2}'],[D,'x']])}${p?` + ${p*p}`:''} + ${poly([[1,'y^{2}'],[E,'y']])}${q?` + ${q*q}`:''} = ${-Fc}${p?` + ${p*p}`:''}${q?` + ${q*q}`:''}$$`,
    `$$${sqx(p,'x')} + ${sqx(q,'y')} = ${r*r}$$`],ans:`Centre $${pt(p,q)}$, radius $${r}$`}}
 let s,t;do{s=R.int(-6,6);t=R.int(-6,6)}while(s===p&&t===q);const r2=(s-p)**2+(t-q)**2;
 return{q:`Find the equation of the circle with centre $${pt(p,q)}$ that passes through the point $${pt(s,t)}$.`,marks:2,
  sol:[`$$r^{2} = (${s} - ${F(p).btex()})^{2} + (${t} - ${F(q).btex()})^{2} = ${r2}$$`,`$$${sqx(p,'x')} + ${sqx(q,'y')} = ${r2}$$`],ans:`$${sqx(p,'x')} + ${sqx(q,'y')} = ${r2}$`}}

// ================= YEAR 11: TRIGONOMETRY AND MEASURE OF ANGLES =================
const EXT={30:{sin:'\\frac{1}{2}',cos:'\\frac{\\sqrt{3}}{2}',tan:'\\frac{1}{\\sqrt{3}}',sec:'\\frac{2}{\\sqrt{3}}',cosec:'2',cot:'\\sqrt{3}'},
 45:{sin:'\\frac{1}{\\sqrt{2}}',cos:'\\frac{1}{\\sqrt{2}}',tan:'1',sec:'\\sqrt{2}',cosec:'\\sqrt{2}',cot:'1'},
 60:{sin:'\\frac{\\sqrt{3}}{2}',cos:'\\frac{1}{2}',tan:'\\sqrt{3}',sec:'2',cosec:'\\frac{2}{\\sqrt{3}}',cot:'\\frac{1}{\\sqrt{3}}'}};
const AXV={sin:[0,1,0,-1],cos:[1,0,-1,0],tan:[0,null,0,null],sec:[1,null,-1,null],cosec:[null,1,null,-1],cot:[null,0,null,0]};
const FAM={sin:'sin',cosec:'sin',cos:'cos',sec:'cos',tan:'tan',cot:'tan'};
const POSQ={sin:[1,2],cos:[1,4],tan:[1,3]};
const fnT=fn=>fn==='cosec'?'\\operatorname{cosec}':'\\'+fn;
const angT=(d,rad)=>d===0?(rad?'0':DEG(0)):rad?piTex(F(d,180)):DEG(d);
// sin 240°, cos(−135°), tan 5π/4
function trigCall(fn,d,rad,pow){const a=angT(d,rad),p=pow?`^{${pow}}`:'';return d<0?`${fnT(fn)}${p}${a.includes('frac')?`\\left(${a}\\right)`:`(${a})`}`:`${fnT(fn)}${p} ${a}`}
// exact value of a trig function at d degrees (any magnitude): {val, lines} or null if undefined
function exactTrig(fn,d,rad){const t=((d%360)+360)%360,A=x=>angT(x,rad),call=trigCall(fn,d,rad),lines=[];
 if(d!==t)lines.push(`$${A(d)}$ and $${A(t)}$ are the same ray, so they have the same trigonometric ratios.`);
 if(t%90===0){const v=AXV[fn][t/90];if(v===null)return null;const P=[[1,0],[0,1],[-1,0],[0,-1]][t/90];
  lines.push(`At $${A(t)}$ the point on the unit circle is $(${P[0]}, ${P[1]})$, so $${call} = ${v}$.`);return{val:String(v),lines}}
 const Q=Math.floor(t/90)+1,rel=[t,180-t,t-180,360-t][Q-1],pos=POSQ[FAM[fn]].includes(Q),val=(pos?'':'-')+EXT[rel][fn];
 lines.push(`$${A(t)}$ is in quadrant ${Q}, with related angle $${A(rel)}$. $${fnT(fn)}$ is ${pos?'positive':'negative'} in quadrant ${Q}.`);
 lines.push(`$$${call} = ${pos?'':'-'}${fnT(fn)} ${A(rel)} = ${val}$$`);return{val,lines}}

const TVAL={30:{sin:[F(1,2),1],cos:[F(1,2),3],tan:[F(1,3),3]},45:{sin:[F(1,2),2],cos:[F(1,2),2],tan:[F(1),1]},60:{sin:[F(1,2),3],cos:[F(1,2),1],tan:[F(1),3]}};
const sqWrap=s=>s.includes('frac')?`\\left(${s}\\right)^{2}`:`(${s})^{2}`;
function gTmExact(R){const A=()=>[R.pick(['sin','cos','tan']),R.pick([30,45,60])];const [f1,a1]=A();let [f2,a2]=A();
 while(f1===f2&&a1===a2)[f2,a2]=A();
 if(R.next()<0.5){const [c1,m1]=TVAL[a1][f1],[c2,m2]=TVAL[a2][f2],[k,r]=sqrtParts(m1*m2),val=surdVal(c1.mul(c2).mul(k),r);
  const show=s=>s.includes('frac')?s:s;
  return{q:`Find the exact value of $${fnT(f1)} ${DEG(a1)}\\,${fnT(f2)} ${DEG(a2)}$.`,marks:1,
   sol:[`$$${fnT(f1)} ${DEG(a1)}\\,${fnT(f2)} ${DEG(a2)} = ${show(EXT[a1][f1])}\\times ${show(EXT[a2][f2])} = ${val}$$`],ans:`$${val}$`}}
 const [c1,m1]=TVAL[a1][f1],[c2,m2]=TVAL[a2][f2],s1=c1.mul(c1).mul(m1),s2=c2.mul(c2).mul(m2),sgn=R.next()<0.5?1:-1,val=sgn>0?s1.add(s2):s1.sub(s2);
 return{q:`Find the exact value of $${fnT(f1)}^{2}${DEG(a1)} ${sgn>0?'+':'-'} ${fnT(f2)}^{2}${DEG(a2)}$.`,marks:1,
  sol:[`$$= ${sqWrap(EXT[a1][f1])} ${sgn>0?'+':'-'} ${sqWrap(EXT[a2][f2])} = ${s1.tex()} ${sgn>0?'+':'-'} ${s2.tex()} = ${val.tex()}$$`],ans:`$${val.tex()}$`}}

function gTmAnyMag(R){const rad=R.next()<0.5;let fn,d,e;
 do{fn=R.pick(['sin','cos','tan']);d=R.pick([30,45,60,90])*R.int(1,7)*R.pick([1,1,1,-1]);const t=((d%360)+360)%360;
  if(d>360||d<-360||(d>0&&d<90)||(t%90===0&&R.next()<0.7))continue;e=exactTrig(fn,d,rad)}while(!e);
 return{q:`Find the exact value of $${trigCall(fn,d,rad)}$.`,marks:1,sol:e.lines,ans:`$${e.val}$`}}

function gTmRight(R){const v=R.int(0,3);
 if(v===0){const D=R.int(15,80),th=R.int(15,70),h=D*tanD(th);
  return{q:`From a point on level ground $${D}$ m from the base of a vertical tower, the angle of elevation of the top of the tower is $${DEG(th)}$. Find the height of the tower, correct to one decimal place.`,marks:2,
   sol:[`$$\\tan ${DEG(th)} = \\frac{h}{${D}}$$`,`$$h = ${D}\\tan ${DEG(th)} \\approx ${dp(h)}\\text{ m}$$`],ans:`$${dp(h)}$ m`}}
 if(v===1){const H=R.int(40,120),th=R.int(10,40),x=H/tanD(th);
  return{q:`From the top of a vertical cliff $${H}$ m high, the angle of depression of a boat is $${DEG(th)}$. How far is the boat from the base of the cliff? Give your answer correct to one decimal place.`,marks:2,
   sol:[`The angle of elevation of the cliff top from the boat is also $${DEG(th)}$ (alternate angles).`,`$$\\tan ${DEG(th)} = \\frac{${H}}{d}$$`,`$$d = \\frac{${H}}{\\tan ${DEG(th)}} \\approx ${dp(x)}\\text{ m}$$`],ans:`$${dp(x)}$ m`}}
 if(v===2){const D=R.int(8,60),th=R.int(15,75),east=R.next()<0.5,val=east?D*sinD(th):D*cosD(th);
  return{q:`A ship sails $${D}$ km on a bearing of $${String(th).padStart(3,'0')}^{\\circ}$T. How far ${east?'east':'north'} of its starting point is it? Give your answer correct to one decimal place.`,marks:2,
   sol:[`The bearing is measured clockwise from north, so the angle between the path and north is $${DEG(th)}$.`,`$$${east?'\\text{east}':'\\text{north}'} = ${D}\\${east?'sin':'cos'} ${DEG(th)} \\approx ${dp(val)}\\text{ km}$$`],ans:`$${dp(val)}$ km`}}
 const L=R.int(4,9),d=dp(R.int(10,L*10-15)/10),ang=r2d(Math.acos(+d/L)),ar=Math.round(ang);
 return{q:`A $${L}$ m ladder leans against a vertical wall with its foot $${d}$ m from the base of the wall. Find the angle the ladder makes with the ground, correct to the nearest degree.`,marks:2,
  sol:[`$$\\cos\\theta = \\frac{${d}}{${L}}$$`,`$$\\theta = \\cos^{-1}\\frac{${d}}{${L}} \\approx ${DEG(ar)}$$`],ans:`$${DEG(ar)}$`}}

function gTmSine(R){
 if(R.next()<0.55){let A,B;do{A=R.int(30,100);B=R.int(30,100)}while(A+B>160||A===B);const a=R.int(5,20),b=a*sinD(B)/sinD(A);
  return{q:`In triangle $ABC$, $A = ${DEG(A)}$, $B = ${DEG(B)}$ and $a = ${a}$ cm. Find the length of $b$, correct to one decimal place.`,marks:2,
   sol:[`Sine rule: $$\\frac{b}{\\sin B} = \\frac{a}{\\sin A}$$`,`$$b = \\frac{${a}\\sin ${DEG(B)}}{\\sin ${DEG(A)}} \\approx ${dp(b)}\\text{ cm}$$`],ans:`$${dp(b)}$ cm`}}
 let A,a,b,s;do{A=R.int(35,110);a=R.int(8,20);b=R.int(4,a-2);s=b*sinD(A)/a}while(s>=0.98);
 const B=r2d(Math.asin(s)),mins=R.next()<0.5,out=mins?dms(B):DEG(Math.round(B));
 return{q:`In triangle $ABC$, $A = ${DEG(A)}$, $a = ${a}$ cm and $b = ${b}$ cm. Find the size of angle $B$, correct to the nearest ${mins?'minute':'degree'}.`,marks:2,
  sol:[`$$\\frac{\\sin B}{${b}} = \\frac{\\sin ${DEG(A)}}{${a}}$$`,`$$\\sin B = \\frac{${b}\\sin ${DEG(A)}}{${a}} \\approx ${dp(s,4)}$$`,
   `Since $b \\lt a$, angle $B$ is smaller than angle $A$, so it is acute: $B \\approx ${out}$.`],ans:`$B \\approx ${out}$`}}

function gTmCosine(R){
 if(R.next()<0.5){const a=R.int(4,20),b=R.int(4,20);let C;do{C=R.int(25,140)}while(C===90);const c=Math.sqrt(a*a+b*b-2*a*b*cosD(C));
  return{q:`In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and $C = ${DEG(C)}$. Find the length of $c$, correct to one decimal place.`,marks:2,
   sol:[`$$c^{2} = a^{2} + b^{2} - 2ab\\cos C = ${a}^{2} + ${b}^{2} - 2(${a})(${b})\\cos ${DEG(C)}$$`,`$$c^{2} \\approx ${dp(c*c,2)}, \\quad c \\approx ${dp(c)}\\text{ cm}$$`],ans:`$${dp(c)}$ cm`}}
 let a,b,c;do{a=R.int(4,15);b=R.int(4,15);c=R.int(3,20)}while(c>=a+b-1||c<=Math.abs(a-b)+1||a*a+b*b===c*c);
 const k=F(a*a+b*b-c*c,2*a*b),C=r2d(Math.acos(k.val())),mins=R.next()<0.5,out=mins?dms(C):DEG(Math.round(C));
 return{q:`A triangle has sides $a = ${a}$ cm, $b = ${b}$ cm and $c = ${c}$ cm. Find the size of angle $C$, correct to the nearest ${mins?'minute':'degree'}.`,marks:2,
  sol:[`$$\\cos C = \\frac{a^{2} + b^{2} - c^{2}}{2ab} = \\frac{${a*a} + ${b*b} - ${c*c}}{${2*a*b}} = ${k.tex()}$$`,`$$C = \\cos^{-1}\\left(${k.tex()}\\right) \\approx ${out}$$`],ans:`$C \\approx ${out}$`}}

function gTmArea(R){const a=R.int(4,20),b=R.int(4,20);
 if(R.next()<0.55){const C=R.int(20,160),A=a*b*sinD(C)/2;
  return{q:`Find the area of triangle $ABC$ with $a = ${a}$ cm, $b = ${b}$ cm and $C = ${DEG(C)}$, correct to one decimal place.`,marks:2,
   sol:[`$$A = \\frac{1}{2}ab\\sin C = \\frac{1}{2}\\times ${a}\\times ${b}\\times\\sin ${DEG(C)} \\approx ${dp(A)}\\text{ cm}^{2}$$`],ans:`$${dp(A)}$ cm$^{2}$`}}
 const C0=R.int(20,80),Ar=dp(a*b*sinD(C0)/2),s=2*(+Ar)/(a*b),C=Math.round(r2d(Math.asin(Math.min(1,s))));
 return{q:`Triangle $ABC$ has area $${Ar}$ cm$^{2}$, with $a = ${a}$ cm and $b = ${b}$ cm. Given that $C$ is acute, find $C$, correct to the nearest degree.`,marks:2,
  sol:[`$$${Ar} = \\frac{1}{2}\\times ${a}\\times ${b}\\times\\sin C$$`,`$$\\sin C = \\frac{${dp(2*(+Ar))}}{${a*b}} \\approx ${dp(s,4)}$$`,`$$C \\approx ${DEG(C)}$$`],ans:`$C \\approx ${DEG(C)}$`}}

function gTmAmbig(R){let A,a,b,s,B1;
 do{A=R.int(22,55);b=R.int(8,16);a=R.int(4,b-1);s=b*sinD(A)/a;B1=s<1?r2d(Math.asin(s)):0}while(s>=0.96||s<=0.3||B1<A+4||Math.abs(B1-Math.round(B1))>0.45);
 const b1=Math.round(B1),b2=180-b1;
 return{q:`In triangle $ABC$, $A = ${DEG(A)}$, $a = ${a}$ cm and $b = ${b}$ cm. Find the two possible sizes of angle $B$, correct to the nearest degree.`,marks:3,
  sol:[`$$\\sin B = \\frac{b\\sin A}{a} = \\frac{${b}\\sin ${DEG(A)}}{${a}} \\approx ${dp(s,4)}$$`,`$\\sin B$ is positive in quadrants 1 and 2, so $B \\approx ${DEG(b1)}$ or $B \\approx 180^{\\circ} - ${DEG(b1)} = ${DEG(b2)}$.`,
   `Both are possible, since $${DEG(A)} + ${DEG(b2)} \\lt 180^{\\circ}$ (this is the ambiguous case: $a \\lt b$).`],ans:`$B \\approx ${DEG(b1)}$ or $B \\approx ${DEG(b2)}$`}}

function gTmRadians(R){const v=R.int(0,3);
 if(v===0){const d=15*R.pick([1,2,3,4,5,6,8,9,10,12,14,15,16,18,20,21,22]);
  return{q:`Convert $${DEG(d)}$ to radians, giving an exact answer.`,marks:1,sol:[`$$${DEG(d)} = ${d}\\times\\frac{\\pi}{180} = ${piTex(F(d,180))}$$`],ans:`$${piTex(F(d,180))}$`}}
 if(v===1){const f=F(R.pick([1,2,3,4,5,7,8,9,10,11,13,15,16,20]),12),d=f.mul(180).val();
  return{q:`Convert $${piTex(f)}$ radians to degrees.`,marks:1,sol:[`$$${piTex(f)}\\times\\frac{180^{\\circ}}{\\pi} = ${DEG(d)}$$`],ans:`$${DEG(d)}$`}}
 if(v===2){const r=R.int(5,45)/10,d=r2d(r);
  return{q:`Convert $${r}$ radians to degrees, correct to one decimal place.`,marks:1,sol:[`$$${r}\\times\\frac{180^{\\circ}}{\\pi} \\approx ${dp(d)}^{\\circ}$$`],ans:`$${dp(d)}^{\\circ}$`}}
 const d=R.int(10,170),r=d2r(d);
 return{q:`Convert $${DEG(d)}$ to radians, correct to two decimal places.`,marks:1,sol:[`$$${d}\\times\\frac{\\pi}{180} \\approx ${dp(r,2)}$$`],ans:`$${dp(r,2)}$`}}

function gTmArc(R){const r=R.int(3,12),v=R.int(0,4);
 const keys=['1/6','1/4','1/3','1/2','2/3','3/4','5/6'],th=R.pick(keys),[tn,td]=th.split('/').map(Number),T=F(tn,td),tt=piTex(T);
 if(v===0){const l=piTex(T.mul(r));return{q:`Find the exact length of the arc of a circle of radius $${r}$ cm that subtends an angle of $${tt}$ at the centre.`,marks:1,
  sol:[`$$\\ell = r\\theta = ${r}\\times ${tt} = ${l}\\text{ cm}$$`],ans:`$${l}$ cm`}}
 if(v===1){const A=piTex(T.mul(r*r).div(2));return{q:`Find the exact area of a sector of a circle of radius $${r}$ cm with an angle of $${tt}$ at the centre.`,marks:1,
  sol:[`$$A = \\frac{1}{2}r^{2}\\theta = \\frac{1}{2}\\times ${r*r}\\times ${tt} = ${A}\\text{ cm}^{2}$$`],ans:`$${A}$ cm$^{2}$`}}
 if(v===2){const l=piTex(T.mul(r));return{q:`Find the exact perimeter of a sector of a circle of radius $${r}$ cm with an angle of $${tt}$ at the centre.`,marks:2,
  sol:[`Arc length: $\\ell = ${r}\\times ${tt} = ${l}$.`,`$$P = 2r + \\ell = ${2*r} + ${l}\\text{ cm}$$`],ans:`$${2*r} + ${l}$ cm`}}
 if(v===3){const A1=piTex(T.mul(r*r).div(2)),[c,m]=TRIG[th].sin,A2=surdVal(c.mul(r*r).div(2),m);
  return{q:`A chord subtends an angle of $${tt}$ at the centre of a circle of radius $${r}$ cm. Find the exact area of the minor segment cut off by the chord.`,marks:3,
   sol:[`Segment = sector $-$ triangle: $$A = \\frac{1}{2}r^{2}\\theta - \\frac{1}{2}r^{2}\\sin\\theta$$`,`$$= \\frac{1}{2}\\times ${r*r}\\times ${tt} - \\frac{1}{2}\\times ${r*r}\\times\\sin ${tt}$$`,`$$= ${A1} - ${A2}\\text{ cm}^{2}$$`],ans:`$${A1} - ${A2}$ cm$^{2}$`}}
 const d=R.int(20,160),l=r*d2r(d);
 return{q:`Find the length of the arc of a circle of radius $${r}$ cm that subtends an angle of $${DEG(d)}$ at the centre, correct to one decimal place.`,marks:2,
  sol:[`Convert to radians: $${DEG(d)} = \\frac{${d}\\pi}{180}$.`,`$$\\ell = r\\theta = ${r}\\times\\frac{${d}\\pi}{180} \\approx ${dp(l)}\\text{ cm}$$`],ans:`$${dp(l)}$ cm`}}

// ================= YEAR 11: TRIGONOMETRIC IDENTITIES AND EQUATIONS =================
function gTiRecip(R){const rad=R.next()<0.5;let fn,d,e;
 do{fn=R.pick(['sec','cosec','cot']);d=R.pick([30,45,60,90])*R.int(1,8)*(R.next()<0.15?-1:1);if(d>360)continue;
  const t=((d%360)+360)%360;if(t%90===0&&R.next()<0.6)continue;e=exactTrig(fn,d,rad)}while(!e);
 const base={sec:'cos',cosec:'sin',cot:'tan'}[fn],call=trigCall(fn,d,rad);
 return{q:`Find the exact value of $${call}$.`,marks:1,sol:[`$${fnT(fn)}$ has the same sign as $${fnT(base)}$ in each quadrant, since $${call} = \\dfrac{1}{${trigCall(base,d,rad)}}$.`,...e.lines],ans:`$${e.val}$`}}

function gTiComp(R){let a;do{a=R.int(10,80)}while(a===45);const b=90-a,v=R.int(0,4);
 if(v===0){const [f,g]=R.pick([['sin','cos'],['cos','sin'],['tan','cot'],['sec','cosec']]);
  return{q:`Simplify $\\dfrac{${fnT(f)} ${DEG(a)}}{${fnT(g)} ${DEG(b)}}$.`,marks:1,sol:[`$${fnT(g)} ${DEG(b)} = ${fnT(g)}(90^{\\circ} - ${DEG(a)}) = ${fnT(f)} ${DEG(a)}$`,`$$\\frac{${fnT(f)} ${DEG(a)}}{${fnT(f)} ${DEG(a)}} = 1$$`],ans:'$1$'}}
 if(v===1){const f=R.pick(['sin','cos']),g=f==='sin'?'cos':'sin';
  return{q:`Find the value of $${fnT(f)}^{2}${DEG(a)} + ${fnT(f)}^{2}${DEG(b)}$.`,marks:1,sol:[`$${fnT(f)} ${DEG(b)} = ${fnT(f)}(90^{\\circ} - ${DEG(a)}) = ${fnT(g)} ${DEG(a)}$`,`$$${fnT(f)}^{2}${DEG(a)} + ${fnT(g)}^{2}${DEG(a)} = 1$$`],ans:'$1$'}}
 if(v===2){return{q:`Find the value of $\\tan ${DEG(a)}\\tan ${DEG(b)}$.`,marks:1,sol:[`$\\tan ${DEG(b)} = \\tan(90^{\\circ} - ${DEG(a)}) = \\cot ${DEG(a)}$`,`$$\\tan ${DEG(a)}\\cot ${DEG(a)} = 1$$`],ans:'$1$'}}
 if(v===3){const [f,g]=R.pick([['sin','cos'],['cos','sin'],['tan','cot'],['sec','cosec'],['cosec','sec'],['cot','tan']]);
  return{q:`Find the acute angle $\\theta$ for which $${fnT(f)}\\theta = ${fnT(g)} ${DEG(a)}$.`,marks:1,sol:[`$${fnT(g)} ${DEG(a)} = ${fnT(f)}(90^{\\circ} - ${DEG(a)}) = ${fnT(f)} ${DEG(b)}$`,`$$\\theta = ${DEG(b)}$$`],ans:`$\\theta = ${DEG(b)}$`}}
 const [f,g]=R.pick([['cos','sin'],['sin','cos'],['cosec','sec'],['cot','tan']]);
 return{q:`Simplify $${fnT(f)} ${DEG(a)} - ${fnT(g)} ${DEG(b)}$.`,marks:1,sol:[`$${fnT(g)} ${DEG(b)} = ${fnT(g)}(90^{\\circ} - ${DEG(a)}) = ${fnT(f)} ${DEG(a)}$`,`$$${fnT(f)} ${DEG(a)} - ${fnT(f)} ${DEG(a)} = 0$$`],ans:'$0$'}}

const tSin=v=>`\\sin ${v}`,tCos=v=>`\\cos ${v}`,tTan=v=>`\\tan ${v}`,tSec=v=>`\\sec ${v}`,tCsc=v=>`\\operatorname{cosec} ${v}`,tCot=v=>`\\cot ${v}`;
const tSq=(f,v)=>f(v).replace(' ',`^{2}`); // \sin^{2}θ
function gTiSimplify(R){const v=R.pick(['\\theta','x','A']),k=R.int(2,6);
 const T=[
  {e:`${tSin(v)}\\,${tCot(v)}`,s:[`$$= ${tSin(v)}\\times\\frac{${tCos(v)}}{${tSin(v)}}$$`],a:tCos(v)},
  {e:`${tCos(v)}\\,${tTan(v)}`,s:[`$$= ${tCos(v)}\\times\\frac{${tSin(v)}}{${tCos(v)}}$$`],a:tSin(v)},
  {e:`\\frac{1 - ${tSq(tCos,v)}}{${tSin(v)}}`,s:[`$$= \\frac{${tSq(tSin,v)}}{${tSin(v)}}$$`],a:tSin(v)},
  {e:`${tSq(tSec,v)} - ${tSq(tTan,v)}`,s:[`Since $1 + ${tSq(tTan,v)} = ${tSq(tSec,v)}$:`],a:'1'},
  {e:`(1 + ${tSq(tTan,v)})${tSq(tCos,v)}`,s:[`$$= ${tSq(tSec,v)}\\,${tSq(tCos,v)} = \\frac{1}{${tSq(tCos,v)}}\\times ${tSq(tCos,v)}$$`],a:'1'},
  {e:`\\frac{${tSec(v)}}{${tTan(v)}}`,s:[`$$= \\frac{1}{${tCos(v)}}\\times\\frac{${tCos(v)}}{${tSin(v)}} = \\frac{1}{${tSin(v)}}$$`],a:tCsc(v)},
  {e:`\\frac{${tTan(v)}}{${tSec(v)}}`,s:[`$$= \\frac{${tSin(v)}}{${tCos(v)}}\\times ${tCos(v)}$$`],a:tSin(v)},
  {e:`${tSq(tCos,v)}(${tSq(tSec,v)} - 1)`,s:[`$$= ${tSq(tCos,v)}\\,${tSq(tTan,v)} = ${tSq(tCos,v)}\\times\\frac{${tSq(tSin,v)}}{${tSq(tCos,v)}}$$`],a:tSq(tSin,v)},
  {e:`\\frac{${tCot(v)}}{${tCsc(v)}}`,s:[`$$= \\frac{${tCos(v)}}{${tSin(v)}}\\times ${tSin(v)}$$`],a:tCos(v)},
  {e:`${tSq(tSin,v)}(1 + ${tSq(tCot,v)})`,s:[`$$= ${tSq(tSin,v)}\\,${tSq(tCsc,v)} = ${tSq(tSin,v)}\\times\\frac{1}{${tSq(tSin,v)}}$$`],a:'1'},
  {e:`\\frac{${tSq(tSin,v)}}{1 - ${tCos(v)}}`,s:[`$$= \\frac{1 - ${tSq(tCos,v)}}{1 - ${tCos(v)}} = \\frac{(1 - ${tCos(v)})(1 + ${tCos(v)})}{1 - ${tCos(v)}}$$`],a:`1 + ${tCos(v)}`},
  {e:`${tSq(tCsc,v)} - ${tSq(tCot,v)}`,s:[`Since $1 + ${tSq(tCot,v)} = ${tSq(tCsc,v)}$:`],a:'1'},
  {e:`\\frac{1}{1 + ${tSq(tTan,v)}}`,s:[`$$= \\frac{1}{${tSq(tSec,v)}}$$`],a:tSq(tCos,v)},
  {e:`${k}${tSq(tSin,v)} + ${k}${tSq(tCos,v)}`,s:[`$$= ${k}(${tSq(tSin,v)} + ${tSq(tCos,v)}) = ${k}\\times 1$$`],a:String(k)},
  {e:`${k} - ${k}${tSq(tSin,v)}`,s:[`$$= ${k}(1 - ${tSq(tSin,v)})$$`],a:`${k}${tSq(tCos,v)}`},
  {e:`(1 - ${tSin(v)})(1 + ${tSin(v)})`,s:[`$$= 1 - ${tSq(tSin,v)}$$`],a:tSq(tCos,v)}];
 const t=R.pick(T);return{q:`Simplify $${t.e}$.`,marks:2,sol:[...t.s,`$$= ${t.a}$$`],ans:`$${t.a}$`}}

function gTiProve(R){const v=R.pick(['\\theta','x','A']);
 const T=[
  {l:`(${tSin(v)} + ${tCos(v)})^{2}`,r:`1 + 2${tSin(v)}\\,${tCos(v)}`,s:[`$= ${tSq(tSin,v)} + 2${tSin(v)}\\,${tCos(v)} + ${tSq(tCos,v)}$`,`$= 1 + 2${tSin(v)}\\,${tCos(v)}$, since $${tSq(tSin,v)} + ${tSq(tCos,v)} = 1$`]},
  {l:`${tSec(v)} - ${tCos(v)}`,r:`${tSin(v)}\\,${tTan(v)}`,s:[`$= \\dfrac{1}{${tCos(v)}} - ${tCos(v)} = \\dfrac{1 - ${tSq(tCos,v)}}{${tCos(v)}}$`,`$= \\dfrac{${tSq(tSin,v)}}{${tCos(v)}} = ${tSin(v)}\\times\\dfrac{${tSin(v)}}{${tCos(v)}} = ${tSin(v)}\\,${tTan(v)}$`]},
  {l:`${tTan(v)} + ${tCot(v)}`,r:`${tSec(v)}\\,${tCsc(v)}`,s:[`$= \\dfrac{${tSin(v)}}{${tCos(v)}} + \\dfrac{${tCos(v)}}{${tSin(v)}} = \\dfrac{${tSq(tSin,v)} + ${tSq(tCos,v)}}{${tSin(v)}\\,${tCos(v)}}$`,`$= \\dfrac{1}{${tSin(v)}\\,${tCos(v)}} = ${tSec(v)}\\,${tCsc(v)}$`]},
  {l:`\\dfrac{1}{1 - ${tSin(v)}} + \\dfrac{1}{1 + ${tSin(v)}}`,r:`2${tSq(tSec,v)}`,s:[`$= \\dfrac{(1 + ${tSin(v)}) + (1 - ${tSin(v)})}{(1 - ${tSin(v)})(1 + ${tSin(v)})} = \\dfrac{2}{1 - ${tSq(tSin,v)}}$`,`$= \\dfrac{2}{${tSq(tCos,v)}} = 2${tSq(tSec,v)}$`]},
  {l:`${tSin(v).replace(' ','^{4}')} - ${tCos(v).replace(' ','^{4}')}`,r:`${tSq(tSin,v)} - ${tSq(tCos,v)}`,s:[`$= (${tSq(tSin,v)} - ${tSq(tCos,v)})(${tSq(tSin,v)} + ${tSq(tCos,v)})$`,`$= (${tSq(tSin,v)} - ${tSq(tCos,v)})\\times 1 = ${tSq(tSin,v)} - ${tSq(tCos,v)}$`]},
  {l:`(1 + ${tSq(tCot,v)})(1 - ${tSq(tCos,v)})`,r:`1`,s:[`$= ${tSq(tCsc,v)}\\,${tSq(tSin,v)}$`,`$= \\dfrac{1}{${tSq(tSin,v)}}\\times ${tSq(tSin,v)} = 1$`]},
  {l:`\\dfrac{${tCos(v)}}{1 + ${tSin(v)}}`,r:`\\dfrac{1 - ${tSin(v)}}{${tCos(v)}}`,s:[`$= \\dfrac{${tCos(v)}(1 - ${tSin(v)})}{(1 + ${tSin(v)})(1 - ${tSin(v)})} = \\dfrac{${tCos(v)}(1 - ${tSin(v)})}{1 - ${tSq(tSin,v)}}$`,`$= \\dfrac{${tCos(v)}(1 - ${tSin(v)})}{${tSq(tCos,v)}} = \\dfrac{1 - ${tSin(v)}}{${tCos(v)}}$`]},
  {l:`${tSq(tSec,v)} + ${tSq(tCsc,v)}`,r:`${tSq(tSec,v)}\\,${tSq(tCsc,v)}`,s:[`$= \\dfrac{1}{${tSq(tCos,v)}} + \\dfrac{1}{${tSq(tSin,v)}} = \\dfrac{${tSq(tSin,v)} + ${tSq(tCos,v)}}{${tSq(tSin,v)}\\,${tSq(tCos,v)}}$`,`$= \\dfrac{1}{${tSq(tSin,v)}\\,${tSq(tCos,v)}} = ${tSq(tSec,v)}\\,${tSq(tCsc,v)}$`]},
  {l:`${tSq(tTan,v)} - ${tSq(tSin,v)}`,r:`${tSq(tTan,v)}\\,${tSq(tSin,v)}`,s:[`$= \\dfrac{${tSq(tSin,v)}}{${tSq(tCos,v)}} - ${tSq(tSin,v)} = ${tSq(tSin,v)}\\left(\\dfrac{1}{${tSq(tCos,v)}} - 1\\right)$`,`$= ${tSq(tSin,v)}(${tSq(tSec,v)} - 1) = ${tSq(tSin,v)}\\,${tSq(tTan,v)}$`]},
  {l:`\\dfrac{1 + ${tSq(tTan,v)}}{1 + ${tSq(tCot,v)}}`,r:`${tSq(tTan,v)}`,s:[`$= \\dfrac{${tSq(tSec,v)}}{${tSq(tCsc,v)}} = \\dfrac{1}{${tSq(tCos,v)}}\\times ${tSq(tSin,v)}$`,`$= \\dfrac{${tSq(tSin,v)}}{${tSq(tCos,v)}} = ${tSq(tTan,v)}$`]}];
 const t=R.pick(T);return{q:`Prove that $${t.l} = ${t.r}$.`,marks:2,sol:[`$\\text{LHS} = ${t.l}$`,...t.s,'$= \\text{RHS}$'],ans:`Shown: LHS $= ${t.r}$`}}

// solve f(m·x) = v for 0 ≤ x ≤ 360°/m, by checking every multiple of 7.5°
const TFN={sin:sinD,cos:cosD,tan:tanD};
function trigRoots(fn,v,m){const out=[];for(let j=0;j*7.5<=360/m+1e-9;j++){const x=j*7.5,a=m*x;if(fn==='tan'&&Math.abs(cosD(a))<1e-9)continue;
 if(Math.abs(TFN[fn](a)-v)<1e-9)out.push(j)}return out}
const jTex=(j,rad)=>j===0?(rad?'0':DEG(0)):rad?piTex(F(j,24)):DEG(j%2===0?String(j*7.5):(j*7.5).toFixed(1));
const domT=(m,rad)=>rad?`0 \\le x \\le ${m===1?'2\\pi':'\\pi'}`:`0^{\\circ} \\le x \\le ${m===1?'360':'180'}^{\\circ}`;
const TEQ={sin:[[0.5,'\\frac{1}{2}',30,'2F = 1'],[-0.5,'-\\frac{1}{2}',30,'2F + 1 = 0'],[Math.sqrt(3)/2,'\\frac{\\sqrt{3}}{2}',60,'2F = \\sqrt{3}'],[-Math.sqrt(3)/2,'-\\frac{\\sqrt{3}}{2}',60,'2F + \\sqrt{3} = 0'],
  [Math.SQRT1_2,'\\frac{1}{\\sqrt{2}}',45,'\\sqrt{2}F = 1'],[-Math.SQRT1_2,'-\\frac{1}{\\sqrt{2}}',45,'\\sqrt{2}F + 1 = 0'],[1,'1',null,'2F - 1 = F'],[-1,'-1',null,'F + 3 = 2'],[0,'0',null,'4F = 0']],
 tan:[[1,'1',45,'F - 1 = 0'],[-1,'-1',45,'F + 1 = 0'],[Math.sqrt(3),'\\sqrt{3}',60,'F = \\sqrt{3}'],[-Math.sqrt(3),'-\\sqrt{3}',60,'F + \\sqrt{3} = 0'],
  [1/Math.sqrt(3),'\\frac{1}{\\sqrt{3}}',30,'\\sqrt{3}F = 1'],[-1/Math.sqrt(3),'-\\frac{1}{\\sqrt{3}}',30,'\\sqrt{3}F + 1 = 0']]};
TEQ.cos=TEQ.sin;
function gTiSolve(R){const fn=R.pick(['sin','cos','tan']),rad=R.next()<0.5,m=R.next()<0.3?2:1,[val,vt,rel,eqT]=R.pick(TEQ[fn]);
 const arg=m===2?'2x':'x',Fx=`\\${fn} ${arg}`,js=trigRoots(fn,val,m),lines=[`$$${Fx} = ${vt}$$`];
 if(m===2)lines.push(`Since $${domT(m,rad)}$, $0 \\le 2x \\le ${rad?'2\\pi':'360^{\\circ}'}$.`);
 if(rel!==null){const pos=val>0,Qs=pos?POSQ[fn]:[1,2,3,4].filter(q=>!POSQ[fn].includes(q));
  lines.push(`The related angle is $${angT(rel,rad)}$, and $\\${fn}$ is ${pos?'positive':'negative'} in quadrants ${Qs[0]} and ${Qs[1]}.`)}
 else lines.push(`From the unit circle (or the graph of $y = \\${fn} x$), $\\${fn}\\theta = ${vt}$ at these angles:`);
 if(m===2)lines.push(`$$2x = ${js.map(j=>jTex(2*j,rad)).join(',\\ ')}$$`);
 const xs=js.map(j=>jTex(j,rad)).join(',\\ ');lines.push(`$$x = ${xs}$$`);
 return{q:`Solve $${eqT.replace(/F/g,Fx)}$ for $${domT(m,rad)}$.`,marks:2,sol:lines,ans:`$x = ${xs}$`}}

function gTiQuad(R){const fn=R.pick(['sin','cos']),rad=R.next()<0.5,pool=[F(1),F(-1),F(1,2),F(-1,2),F(0),F(2),F(-2),F(3,2)];
 let r1,r2;do{[r1,r2]=R.sample(pool,2)}while(Math.abs(r1.val())>1&&Math.abs(r2.val())>1);
 const A=r1.d*r2.d,B=-(r1.d*r2.n+r2.d*r1.n),C=r1.n*r2.n,Fx=`\\${fn} x`,Fx2=`\\${fn}^{2}x`;
 const eqF=poly([[A,Fx2],[B,Fx],[C,'']])+' = 0';
 const pyth=R.next()<0.4,other=fn==='sin'?'cos':'sin';
 const eqQ=pyth?poly([[A,`\\${other}^{2}x`],[-B,Fx],[-(A+C),'']])+' = 0':eqF;
 const fac=r=>r.n===0?Fx:`${r.d===1?'':r.d}${Fx} ${r.n>0?'-':'+'} ${Math.abs(r.n)}`;
 const [u,w]=r1.n===0?[r1,r2]:[r2,r1];const facT=u.n===0?`${Fx}(${fac(w)})`:`(${fac(u)})(${fac(w)})`;
 const lines=[];if(pyth)lines.push(`Use $\\${other}^{2}x = 1 - \\${fn}^{2}x$ and rearrange:`,`$$${eqF}$$`);
 lines.push(`$$${facT} = 0$$`);const all=[];
 [u,w].forEach(r=>{if(Math.abs(r.val())>1){lines.push(`$${Fx} = ${r.tex()}$ has no solutions, since $-1 \\le ${Fx} \\le 1$.`);return}
  const js=trigRoots(fn,r.val(),1);all.push(...js);lines.push(`$${Fx} = ${r.tex()}$: $x = ${js.map(j=>jTex(j,rad)).join(',\\ ')}$`)});
 const xs=[...new Set(all)].sort((a,b)=>a-b).map(j=>jTex(j,rad)).join(',\\ ');
 return{q:`Solve $${eqQ}$ for $${domT(1,rad)}$.`,marks:3,sol:lines,ans:`$x = ${xs}$`}}

// ================= YEAR 11: INTRODUCTION TO DIFFERENTIATION =================
const tVar=s=>s.replace(/x/g,'t');
function gDcAvg(R){let a=R.int(-3,3),b=R.int(-3,4);while(b<=a)b=R.int(a+1,a+4);
 if(R.next()<0.5){const cs=[R.int(-5,5),R.int(-5,5),R.nz(-3,3),R.pick([0,0,R.nz(-2,2)])],fb=pEval(cs,b),fa=pEval(cs,a),m=fb.sub(fa).div(b-a);
  return{q:`Find the average rate of change of $f(x) = ${pTex(cs)}$ over the interval $[${a}, ${b}]$.`,marks:2,
   sol:[`$f(${b}) = ${fb.tex()}$ and $f(${a}) = ${fa.tex()}$`,`$$\\frac{f(${b}) - f(${a})}{${b} - ${F(a).btex()}} = \\frac{${fb.tex()} - ${fa.btex()}}{${b-a}} = ${m.tex()}$$`],ans:`$${m.tex()}$`}}
 const k=R.int(1,4),u=R.int(0,10),t1=R.int(0,5),t2=t1+R.int(1,5),d=t=>k*t*t+u*t,sp=F(d(t2)-d(t1),t2-t1),cs=[0,u,k];
 return{q:`A car travels $d$ metres in $t$ seconds, where $d = ${tVar(pTex(cs))}$. Find its average speed between $t = ${t1}$ and $t = ${t2}$.`,marks:2,
  sol:[`At $t = ${t2}$: $d = ${d(t2)}$. At $t = ${t1}$: $d = ${d(t1)}$.`,`$$\\text{average speed} = \\frac{${d(t2)} - ${d(t1)}}{${t2} - ${t1}} = ${sp.tex()}\\text{ m/s}$$`],ans:`$${sp.tex()}$ m/s`}}

function gDcFirst(R){const a=R.nz(-4,4),b=R.int(-6,6),c=R.int(-6,6),cs=[c,b,a];
 return{q:`Use first principles to find the derivative of $f(x) = ${pTex(cs)}$.`,marks:3,
  sol:[`$$f(x + h) = ${subSym(cs,'x + h')} = ${poly([[a,'x^{2}'],[2*a,'xh'],[a,'h^{2}'],[b,'x'],[b,'h'],[c,'']])}$$`,
   `$$f(x + h) - f(x) = ${poly([[2*a,'xh'],[a,'h^{2}'],[b,'h']])}$$`,
   `$$f'(x) = \\lim_{h \\to 0}\\frac{f(x + h) - f(x)}{h} = \\lim_{h \\to 0}\\left(${poly([[2*a,'x'],[a,'h'],[b,'']])}\\right) = ${lin(2*a,b)}$$`],ans:`$f'(x) = ${lin(2*a,b)}$`}}

function gDcChain(R){const v=R.int(0,3);
 if(v===0){let a,b;do{a=R.nz(-5,5);b=R.nz(-6,6)}while(gcd(a,b)!==1||(a<0&&b<0));const n=R.int(2,6),L=lin(a,b);
  return{q:`Differentiate $y = (${L})^{${n}}$.`,marks:1,sol:[`Chain rule: bring down the power, reduce it by one, then multiply by the derivative of the inside, $${a}$.`,`$$\\frac{dy}{dx} = ${n}(${L})${n-1===1?'':`^{${n-1}}`}\\times ${F(a).btex()} = ${n*a}(${L})${n-1===1?'':`^{${n-1}}`}$$`],ans:`$${n*a}(${L})${n-1===1?'':`^{${n-1}}`}$`}}
 if(v===1){const k=R.nz(-6,6),n=R.int(2,5),in2=poly([[1,'x^{2}'],[k,'']]);
  return{q:`Differentiate $y = (${in2})^{${n}}$.`,marks:2,sol:[`$$\\frac{dy}{dx} = ${n}(${in2})${n-1===1?'':`^{${n-1}}`}\\times 2x = ${2*n}x(${in2})${n-1===1?'':`^{${n-1}}`}$$`],ans:`$${2*n}x(${in2})${n-1===1?'':`^{${n-1}}`}$`}}
 if(v===2){const a=R.int(1,6),b=R.nz(-6,6),L=lin(a,b),num=F(a,2);
  return{q:`Differentiate $y = \\sqrt{${L}}$.`,marks:2,sol:[`$y = (${L})^{\\frac{1}{2}}$`,`$$\\frac{dy}{dx} = \\frac{1}{2}(${L})^{-\\frac{1}{2}}\\times ${a} = \\frac{${a}}{2\\sqrt{${L}}}$$`],
   ans:num.isInt()?`$\\dfrac{${a/2}}{\\sqrt{${L}}}$`:`$\\dfrac{${a}}{2\\sqrt{${L}}}$`}}
 const k=R.int(1,6),a=R.int(1,5),b=R.nz(-6,6),n=R.int(1,3),L=lin(a,b),c=-k*n*a;
 return{q:`Differentiate $y = \\dfrac{${k}}{(${L})^{${n===1?'':n}}}$.`.replace('^{}',''),marks:2,
  sol:[`$y = ${k}(${L})^{-${n}}$`,`$$\\frac{dy}{dx} = ${k}\\times(-${n})(${L})^{-${n+1}}\\times ${a} = \\frac{${c}}{(${L})^{${n+1}}}$$`],ans:`$-\\dfrac{${-c}}{(${L})^{${n+1}}}$`}}

function gDcProduct(R){let a,b;do{a=R.nz(-4,4);b=R.nz(-5,5)}while(gcd(a,b)!==1||(a<0&&b<0));const m=R.int(1,2),n=R.int(2,4),L=lin(a,b);
 const P=a*(m+n),Q=m*b,g=gcd(P,Q)*(P<0?-1:1),inner=lin(P/g,Q/g),xm=xp(m-1),pw=n-1===1?'':`^{${n-1}}`;
 const res=`${coefTex(g)}${xm}(${L})${pw}(${inner})`;
 return{q:`Differentiate $y = ${xp(m)}(${L})^{${n}}$, giving your answer in factorised form.`,marks:2,
  sol:[`Product rule: $u = ${xp(m)}$, $u' = ${m===1?'1':'2x'}$; $v = (${L})^{${n}}$, $v' = ${n*a}(${L})${pw}$.`,
   `$$\\frac{dy}{dx} = ${m===1?'':'2x'}(${L})^{${n}} ${n*a<0?'-':'+'} ${Math.abs(n*a)}${xp(m)}(${L})${pw}$$`,
   `$$= ${xm}(${L})${pw}\\left[${m===1?'':'2'}(${L}) ${n*a<0?'-':'+'} ${Math.abs(n*a)}x\\right] = ${res}$$`],ans:`$${res}$`}}

function gDcQuotient(R){
 if(R.next()<0.6){let a,b,c,d;do{a=R.nz(-5,5);b=R.int(-6,6);c=R.int(1,4);d=R.nz(-6,6)}while(a*d-b*c===0);const N=a*d-b*c,u=lin(a,b),w=lin(c,d);
  return{q:`Differentiate $y = \\dfrac{${u}}{${w}}$.`,marks:2,sol:[`Quotient rule: $u = ${u}$, $u' = ${a}$; $v = ${w}$, $v' = ${c}$.`,
   `$$\\frac{dy}{dx} = \\frac{${a}(${w}) - ${c}(${u})}{(${w})^{2}} = \\frac{${N}}{(${w})^{2}}$$`],ans:`$${N<0?'-':''}\\dfrac{${Math.abs(N)}}{(${w})^{2}}$`}}
 const k=R.nz(-6,6),w=lin(1,k);
 return{q:`Differentiate $y = \\dfrac{x^{2}}{${w}}$, giving your answer in factorised form.`,marks:2,sol:[`Quotient rule: $u = x^{2}$, $u' = 2x$; $v = ${w}$, $v' = 1$.`,
  `$$\\frac{dy}{dx} = \\frac{2x(${w}) - x^{2}}{(${w})^{2}} = \\frac{${poly([[1,'x^{2}'],[2*k,'x']])}}{(${w})^{2}} = \\frac{x(${lin(1,2*k)})}{(${w})^{2}}$$`],ans:`$\\dfrac{x(${lin(1,2*k)})}{(${w})^{2}}$`}}

function gDcNormal(R){let cs,p,m;do{cs=[R.int(-5,5),R.int(-5,5),R.nz(-3,3),R.pick([0,R.nz(-1,1)])];p=R.int(-2,2);m=pEval(pDer(cs),p)}while(m.isZero());
 const y0=pEval(cs,p),mn=F(-1).div(m),c=y0.sub(mn.mul(p)),G=genTex(toGeneral(mn,c)),d=pDer(cs);
 return{q:`Find the equation of the normal to $y = ${pTex(cs)}$ at the point where $x = ${p}$. Give your answer in general form.`,marks:3,
  sol:[`$\\dfrac{dy}{dx} = ${pTex(d)}$, so the tangent has gradient $${m.tex()}$ and the normal has gradient $${mn.tex()}$.`,`At $x = ${p}$: $y = ${y0.tex()}$.`,
   `$$y - ${y0.btex()} = ${mn.btex()}\\left(x - ${F(p).btex()}\\right)$$`,`$$${G}$$`],ans:`$${G}$`}}

function gDcGradPt(R){
 if(R.next()<0.5){const a=R.nz(-3,3),b=R.int(-6,6),c=R.int(-6,6),x0=R.int(-4,4),m=2*a*x0+b,cs=[c,b,a],y0=pEval(cs,x0);
  return{q:`Find the coordinates of the point on $y = ${pTex(cs)}$ where the gradient of the tangent is $${m}$.`,marks:2,
   sol:[`$\\dfrac{dy}{dx} = ${lin(2*a,b)}$`,`$${lin(2*a,b)} = ${m}$, so $x = ${x0}$ and $y = ${y0.tex()}$.`],ans:`$${pt(x0,y0)}$`}}
 let a,r1,r2;do{a=R.pick([1,-1,2,-2]);r1=R.int(-3,4);r2=R.int(-3,4)}while(r1>=r2||(Math.abs(a)%2===1&&(r1+r2)%2!==0));
 const m=R.int(-8,8),B=-3*a*(r1+r2)/2,C=3*a*r1*r2+m,D=R.int(-5,5),cs=[D,C,B,a],dl=pDer(cs),y1=pEval(cs,r1),y2=pEval(cs,r2),par=R.next()<0.5;
 return{q:par?`Find the coordinates of the points on $y = ${pTex(cs)}$ where the tangent is parallel to the line $y = ${lin(m,R.int(1,9))}$.`:`Find the coordinates of the points on $y = ${pTex(cs)}$ where the gradient of the tangent is $${m}$.`,marks:3,
  sol:[`$\\dfrac{dy}{dx} = ${pTex(dl)}$${par?`, and the line has gradient $${m}$.`:'.'}`,`$$${pTex(dl)} = ${m} \\;\\Rightarrow\\; ${pTex([F(C-m),F(2*B),F(3*a)])} = 0$$`,
   `$$${coefTex(3*a)}${factor(r1)}${factor(r2)} = 0, \\quad x = ${r1} \\text{ or } x = ${r2}$$`,`Points: $${pt(r1,y1)}$ and $${pt(r2,y2)}$.`],ans:`$${pt(r1,y1)}$ and $${pt(r2,y2)}$`}}

function gDcIncline(R){
 if(R.next()<0.55){let cs,p,m;do{cs=[R.int(-5,5),R.int(-5,5),R.nz(-3,3)];p=R.int(-3,3);m=pEval(pDer(cs),p)}while(m.isZero());
  const raw=r2d(Math.atan(m.val())),th=Math.round(m.val()>0?raw:180+raw);
  return{q:`Find the angle of inclination of the tangent to $y = ${pTex(cs)}$ at the point where $x = ${p}$, correct to the nearest degree.`,marks:2,
   sol:[`$\\dfrac{dy}{dx} = ${lin(2*cs[2],cs[1])}$, so at $x = ${p}$, $m = ${m.tex()}$.`,`$$\\tan\\theta = ${m.tex()}$$`,
    m.val()>0?`$$\\theta = \\tan^{-1}${m.tex()} \\approx ${DEG(th)}$$`:`The gradient is negative, so $\\theta$ is obtuse: $\\theta = 180^{\\circ} - \\tan^{-1}${-m.val()} \\approx ${DEG(th)}$.`],ans:`$${DEG(th)}$`}}
 const a=R.nz(-3,3),x0=R.int(-4,4),up=R.next()<0.5,m=up?1:-1,b=m-2*a*x0,c=R.int(-6,6),cs=[c,b,a],y0=pEval(cs,x0);
 return{q:`Find the point on the curve $y = ${pTex(cs)}$ where the tangent makes an angle of $${up?'45':'135'}^{\\circ}$ with the positive direction of the $x$-axis.`,marks:2,
  sol:[`$m = \\tan ${up?'45':'135'}^{\\circ} = ${m}$`,`$\\dfrac{dy}{dx} = ${lin(2*a,b)} = ${m}$, so $x = ${x0}$ and $y = ${y0.tex()}$.`],ans:`$${pt(x0,y0)}$`}}

function cubicWithTurns(R){let a,p,q;do{a=R.pick([1,-1,2,-2]);p=R.int(-3,3);q=R.int(-2,4)}while(p>=q||(Math.abs(a)%2===1&&(p+q)%2!==0));
 const D=R.int(-6,6);return{a,p,q,cs:[D,3*a*p*q,-3*a*(p+q)/2,a]}}
function gDcStat(R){const {a,p,q,cs}=cubicWithTurns(R),d=pDer(cs),fd=x=>pEval(d,x),fp=pEval(cs,p),fq=pEval(cs,q),mid=F(p+q,2),dfac=`${coefTex(3*a)}${factor(p)}${factor(q)}`;
 const test=`$f'(${p-1}) = ${fd(p-1).tex()}$, $f'(${mid.tex()}) = ${fd(mid).tex()}$, $f'(${q+1}) = ${fd(q+1).tex()}$`;
 if(R.next()<0.6){const [nP,nQ]=a>0?['maximum','minimum']:['minimum','maximum'];
  return{q:`Find the stationary points on the curve $y = ${pTex(cs)}$ and determine their nature.`,marks:3,
   sol:[`$$\\frac{dy}{dx} = ${pTex(d)} = ${dfac}$$`,`Stationary when $x = ${p}$ or $x = ${q}$: $f(${p}) = ${fp.tex()}$, $f(${q}) = ${fq.tex()}$.`,`Test the gradient: ${test}.`,
    `$${pt(p,fp)}$ is a ${nP} turning point and $${pt(q,fq)}$ is a ${nQ} turning point.`],ans:`${cap(nP)} turning point $${pt(p,fp)}$, ${nQ} turning point $${pt(q,fq)}$`}}
 const inc=a>0?`x \\lt ${p}$ or $x \\gt ${q}`:`${p} \\lt x \\lt ${q}`;
 return{q:`For what values of $x$ is the curve $y = ${pTex(cs)}$ increasing?`,marks:2,
  sol:[`$$\\frac{dy}{dx} = ${dfac}$$`,`The gradient is zero at $x = ${p}$ and $x = ${q}$. Test the gradient: ${test}.`,`Increasing where $\\dfrac{dy}{dx} \\gt 0$: $${inc}$.`],ans:`$${inc}$`}}

function gDcVelocity(R){let p,q;do{p=R.int(1,5);q=R.int(2,7)}while(p>=q||(p+q)%2!==0);
 const B=-3*(p+q)/2,C=3*p*q,D=R.int(0,10),cs=[D,C,B,1],v=pDer(cs);
 return{q:`A particle moves in a straight line. Its displacement, $x$ metres, from the origin after $t$ seconds is $x = ${tVar(pTex(cs))}$. Find the initial velocity, and the times when the particle is at rest.`,marks:3,
  sol:[`$$v = \\frac{dx}{dt} = ${tVar(pTex(v))}$$`,`Initially, $t = 0$: $v = ${C}$ m/s.`,`At rest when $v = 0$: $$3(${lin(1,-p).replace('x','t')})(${lin(1,-q).replace('x','t')}) = 0, \\quad t = ${p} \\text{ or } t = ${q}$$`],
  ans:`Initial velocity $${C}$ m/s; at rest when $t = ${p}$ s and $t = ${q}$ s`}}

// ================= YEAR 11: PROBABILITY AND DATA =================
const VENN=[['play sport','play a musical instrument','students'],['study Biology','study Chemistry','students'],['own a cat','own a dog','people'],['like tennis','like swimming','people'],['use Instagram','use TikTok','students']];
function venn(R){const [A,B,who]=R.pick(VENN),N=R.int(25,40);let a,b,c,n0;do{a=R.int(5,N-5);b=R.int(5,N-5);c=R.int(1,Math.min(a,b)-1);n0=N-(a+b-c)}while(n0<1);return{A,B,who,N,a,b,c,n0}}
function gPrSets(R){const {A,B,who,N,a,b,c,n0}=venn(R),v=R.int(0,3),stem=`In a group of $${N}$ ${who}, $${a}$ ${A} and $${b}$ ${B}`;
 if(v===0)return{q:`${stem}, and $${c}$ do both. How many do neither?`,marks:2,sol:[`$$|A \\cup B| = |A| + |B| - |A \\cap B| = ${a} + ${b} - ${c} = ${a+b-c}$$`,`$$\\text{neither} = ${N} - ${a+b-c} = ${n0}$$`],ans:`$${n0}$`};
 if(v===1)return{q:`${stem}. $${n0}$ do neither. How many do both?`,marks:2,sol:[`$|A \\cup B| = ${N} - ${n0} = ${N-n0}$`,`$$${N-n0} = ${a} + ${b} - |A \\cap B| \\;\\Rightarrow\\; |A \\cap B| = ${c}$$`],ans:`$${c}$`};
 const p=v===2?F(a+b-2*c,N):F(n0,N);
 return{q:`${stem}, and $${c}$ do both. One of them is chosen at random. Find the probability that they ${v===2?'do exactly one of the two':'do neither'}.`,marks:2,
  sol:v===2?[`Exactly one: $(${a} - ${c}) + (${b} - ${c}) = ${a+b-2*c}$.`,`$$P = \\frac{${a+b-2*c}}{${N}}${p.d===N?'':` = ${p.tex()}`}$$`]:[`Neither: $${N} - (${a} + ${b} - ${c}) = ${n0}$`,`$$P = \\frac{${n0}}{${N}}${p.d===N?'':` = ${p.tex()}`}$$`],ans:`$${p.tex()}$`}}

function gPrAdd(R){const v=R.int(0,2);let a,b,i;do{a=R.int(2,8)*10;b=R.int(2,8)*10;i=R.int(1,Math.min(a,b)/5-1)*5}while(a+b-i>100);
 if(v===0)return{q:`For events $A$ and $B$, $P(A) = ${dec(a)}$, $P(B) = ${dec(b)}$ and $P(A \\cup B) = ${dec(a+b-i)}$. Find $P(A \\cap B)$.`,marks:1,
  sol:[`$$P(A \\cap B) = P(A) + P(B) - P(A \\cup B) = ${dec(a)} + ${dec(b)} - ${dec(a+b-i)} = ${dec(i)}$$`],ans:`$${dec(i)}$`};
 if(v===1)return{q:`For events $A$ and $B$, $P(A) = ${dec(a)}$, $P(B) = ${dec(b)}$ and $P(A \\cap B) = ${dec(i)}$. Find $P(\\overline{A \\cup B})$.`,marks:2,
  sol:[`$$P(A \\cup B) = ${dec(a)} + ${dec(b)} - ${dec(i)} = ${dec(a+b-i)}$$`,`$$P(\\overline{A \\cup B}) = 1 - ${dec(a+b-i)} = ${dec(100-a-b+i)}$$`],ans:`$${dec(100-a-b+i)}$`};
 let x,y;do{x=R.int(1,7)*10;y=R.int(1,7)*10}while(x+y>=100);
 return{q:`$A$ and $B$ are mutually exclusive events with $P(A) = ${dec(x)}$ and $P(B) = ${dec(y)}$. Find the probability that neither $A$ nor $B$ occurs.`,marks:2,
  sol:[`Mutually exclusive, so $P(A \\cap B) = 0$ and $P(A \\cup B) = ${dec(x)} + ${dec(y)} = ${dec(x+y)}$.`,`$$P(\\text{neither}) = 1 - ${dec(x+y)} = ${dec(100-x-y)}$$`],ans:`$${dec(100-x-y)}$`}}

function gPrCond(R){
 if(R.next()<0.5){let q,r;do{q=R.int(2,9)*10;r=R.int(1,q/5-1)*5}while(r>=q);const p=F(r,q);
  return{q:`For events $A$ and $B$, $P(B) = ${dec(q)}$ and $P(A \\cap B) = ${dec(r)}$. Find $P(A \\mid B)$.`,marks:1,
   sol:[`$$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{${dec(r)}}{${dec(q)}} = ${frDec(p)}$$`],ans:`$${frDec(p)}$`}}
 const {A,B,who,N,a,b,c}=venn(R),p=F(c,a);
 return{q:`In a group of $${N}$ ${who}, $${a}$ ${A}, $${b}$ ${B} and $${c}$ do both. One of the ${who} who ${A} is chosen at random. Find the probability that they also ${B}.`,marks:2,
  sol:[`The sample space is restricted to the $${a}$ ${who} who ${A}; $${c}$ of them also ${B}.`,`$$P = \\frac{${c}}{${a}} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}

function gPrIndep(R){const v=R.int(0,2),a=R.int(1,9),b=R.int(1,9);
 if(v===0){const ind=R.next()<0.5,ab=a*b,i=ind?ab:ab+R.pick([-5,5,10]);if(i<=0||i>=Math.min(a,b)*10)return gPrIndep(R);
  return{q:`$P(A) = ${dec(a,10)}$, $P(B) = ${dec(b,10)}$ and $P(A \\cap B) = ${dec(i)}$. Are $A$ and $B$ independent? Justify your answer.`,marks:2,
   sol:[`$$P(A)\\times P(B) = ${dec(a,10)}\\times ${dec(b,10)} = ${dec(ab)}$$`,ind?`This equals $P(A \\cap B)$, so $A$ and $B$ are independent.`:`This is not equal to $P(A \\cap B) = ${dec(i)}$, so $A$ and $B$ are not independent.`],
   ans:ind?'Independent, since $P(A \\cap B) = P(A)P(B)$':'Not independent, since $P(A \\cap B) \\ne P(A)P(B)$'}}
 if(v===1){const u=10*a+10*b-a*b;
  return{q:`$A$ and $B$ are independent events with $P(A) = ${dec(a,10)}$ and $P(B) = ${dec(b,10)}$. Find $P(A \\cup B)$.`,marks:2,
   sol:[`Independent: $P(A \\cap B) = ${dec(a,10)}\\times ${dec(b,10)} = ${dec(a*b)}$.`,`$$P(A \\cup B) = ${dec(a,10)} + ${dec(b,10)} - ${dec(a*b)} = ${dec(u)}$$`],ans:`$${dec(u)}$`}}
 return{q:`$A$ and $B$ are independent events with $P(A) = ${dec(a,10)}$ and $P(A \\cap B) = ${dec(a*b)}$. Find $P(B)$.`,marks:2,
  sol:[`$$P(A \\cap B) = P(A)\\times P(B) \\;\\Rightarrow\\; P(B) = \\frac{${dec(a*b)}}{${dec(a,10)}} = ${dec(b,10)}$$`],ans:`$${dec(b,10)}$`}}

function gPrTree(R){const [it,c1,c2]=R.pick([['marbles','red','blue'],['counters','green','yellow'],['lollies','red','orange'],['socks','black','white']]),r=R.int(2,7),b=R.int(2,6),n=r+b,v=R.int(0,4);
 const stem=`A bag contains $${r}$ ${c1} and $${b}$ ${c2} ${it}.`,nn=n*(n-1);
 if(v===0){const p=F(r*(r-1)+b*(b-1),nn);return{q:`${stem} Two are drawn at random without replacement. Find the probability that they are the same colour.`,marks:2,
  sol:[`$$P(\\text{both ${c1}}) = \\frac{${r}}{${n}}\\times\\frac{${r-1}}{${n-1}} = ${F(r*(r-1),nn).tex()}, \\quad P(\\text{both ${c2}}) = \\frac{${b}}{${n}}\\times\\frac{${b-1}}{${n-1}} = ${F(b*(b-1),nn).tex()}$$`,`$$P(\\text{same}) = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===1){const p=F(2*r*b,nn);return{q:`${stem} Two are drawn at random without replacement. Find the probability that one of each colour is drawn.`,marks:2,
  sol:[`$$P = \\frac{${r}}{${n}}\\times\\frac{${b}}{${n-1}} + \\frac{${b}}{${n}}\\times\\frac{${r}}{${n-1}} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===2){const p=F(nn-b*(b-1),nn);return{q:`${stem} Two are drawn at random without replacement. Find the probability that at least one is ${c1}.`,marks:2,
  sol:[`$$P(\\text{no ${c1}}) = \\frac{${b}}{${n}}\\times\\frac{${b-1}}{${n-1}} = ${F(b*(b-1),nn).tex()}$$`,`$$P(\\text{at least one ${c1}}) = 1 - ${F(b*(b-1),nn).tex()} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===3){const p=F(r*r,n*n);return{q:`${stem} One is drawn at random, its colour noted and it is replaced. A second is then drawn. Find the probability that both are ${c1}.`,marks:1,
  sol:[`$$P = \\frac{${r}}{${n}}\\times\\frac{${r}}{${n}} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 const p=F(2*r*b,n*n);return{q:`${stem} One is drawn at random, its colour noted and it is replaced. A second is then drawn. Find the probability that exactly one ${c1} is drawn.`,marks:2,
  sol:[`$$P = \\frac{${r}}{${n}}\\times\\frac{${b}}{${n}} + \\frac{${b}}{${n}}\\times\\frac{${r}}{${n}} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}

const DICE=[];for(let i=1;i<=6;i++)for(let j=1;j<=6;j++)DICE.push([i,j]);
function gPrDice(R){const v=R.int(0,4),cnt=f=>DICE.filter(f).length;
 if(v===0){const s=R.int(2,12),n=cnt(([i,j])=>i+j===s),p=F(n,36);return{q:`Two fair six-sided dice are rolled. Find the probability that the sum is $${s}$.`,marks:1,
  sol:[`There are $36$ equally likely outcomes, and $${n}$ give a sum of $${s}$.`,`$$P = \\frac{${n}}{36} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===1){const s=R.int(4,11),n=cnt(([i,j])=>i+j>=s),p=F(n,36);return{q:`Two fair six-sided dice are rolled. Find the probability that the sum is at least $${s}$.`,marks:1,
  sol:[`Of the $36$ outcomes, $${n}$ have a sum of $${s}$ or more.`,`$$P = \\frac{${n}}{36} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===2){const k=R.pick([2,3,4,5,6]),n=cnt(([i,j])=>(i*j)%k===0),p=F(n,36);return{q:`Two fair six-sided dice are rolled and the numbers are multiplied. Find the probability that the product is a multiple of $${k}$.`,marks:1,
  sol:[`Count the outcomes in the $6\\times 6$ array whose product is a multiple of $${k}$: there are $${n}$.`,`$$P = \\frac{${n}}{36} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 if(v===3){const s=R.int(8,11),nA=6,nB=cnt(([i,j])=>i+j>=s),nAB=cnt(([i,j])=>i===j&&i+j>=s),p=F(nA+nB-nAB,36);
  return{q:`Two fair six-sided dice are rolled. Find the probability of rolling a double or a sum of at least $${s}$.`,marks:2,
   sol:[`Doubles: $6$. Sum at least $${s}$: $${nB}$. Both: $${nAB}$.`,`$$P = \\frac{6 + ${nB} - ${nAB}}{36} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}
 let k,s,nB,nAB;do{k=R.int(1,6);s=R.int(6,10);nB=cnt(([i,j])=>i===k||j===k);nAB=cnt(([i,j])=>(i===k||j===k)&&i+j>=s)}while(nAB===0||nAB===nB);const p=F(nAB,nB);
 return{q:`Two fair six-sided dice are rolled. Given that at least one die shows a $${k}$, find the probability that the sum is at least $${s}$.`,marks:2,
  sol:[`At least one $${k}$: $${nB}$ outcomes. Of these, $${nAB}$ have a sum of at least $${s}$.`,`$$P = \\frac{${nAB}}{${nB}} = ${p.tex()}$$`],ans:`$${p.tex()}$`}}

function gPrData(R){const [what,lo,hi]=R.pick([['goals scored by a team in each game',0,5],['people in each car passing a checkpoint',1,6],['books read by each student last month',0,7],['siblings of each student in a class',0,5]]);
 let xs,mode;do{const n=R.int(9,14);xs=[...Array(n)].map(()=>R.int(lo,hi));const f={};xs.forEach(x=>f[x]=(f[x]||0)+1);const mx=Math.max(...Object.values(f)),ms=Object.keys(f).filter(k=>f[k]===mx);mode=ms.length===1?+ms[0]:null}while(mode===null);
 const s=[...xs].sort((a,b)=>a-b),n=s.length,med=n%2?F(s[(n-1)/2]):F(s[n/2-1]+s[n/2],2);
 if(R.next()<0.6)return{q:`The numbers of ${what} were: $${xs.join(',\\ ')}$. Find the mode and the median.`,marks:2,
  sol:[`In order: $${s.join(',\\ ')}$ ($${n}$ values).`,`Mode: $${mode}$ (most frequent).`,n%2?`Median: the middle ($${(n+1)/2}$th) value, $${med.tex()}$.`:`Median: the mean of the $${n/2}$th and $${n/2+1}$th values, $\\frac{${s[n/2-1]} + ${s[n/2]}}{2} = ${dp(med.val(),1).replace('.0','')}$.`],
  ans:`Mode $${mode}$, median $${n%2?med.tex():dp(med.val(),1).replace('.0','')}$`};
 const k=R.int(s[0],Math.max(s[0],s[n-1]-1)),c=s.filter(x=>x<=k).length,rf=F(c,n);
 return{q:`The numbers of ${what} were: $${xs.join(',\\ ')}$. Find the cumulative frequency and the cumulative relative frequency of the value $${k}$.`,marks:2,
  sol:[`Values of $${k}$ or less: $${c}$ out of $${n}$.`,`Cumulative frequency $${c}$; cumulative relative frequency $\\frac{${c}}{${n}}${rf.d!==n||c===0?` = ${rf.tex()}`:''}$.`],ans:`$${c}$ and $${rf.tex()}$`}}

function gPrRelFreq(R){const T=R.pick([50,100,200,250,400,500]),[thing,out]=R.pick([['a spinner was spun','landed on red'],['a drawing pin was dropped','landed point up'],['a coin was tossed','showed heads'],['a die was rolled','showed a six']]);
 const s=R.int(Math.round(T*0.1),Math.round(T*0.6)),M=R.pick([100,300,600,1000,1500]),rf=s/T,E=Math.round(M*rf);
 return{q:`In an experiment, ${thing} $${T}$ times and ${out} $${s}$ times. Estimate the probability of this outcome, and the number of times it would be expected in $${M}$ more trials.`,marks:2,
  sol:[`Relative frequency: $\\frac{${s}}{${T}} = ${String(Number(rf.toFixed(6)))}$, which estimates the probability.`,`$$\\text{expected} = ${M}\\times ${String(Number(rf.toFixed(6)))} ${Number.isInteger(M*rf)?'=':'\\approx'} ${E}$$`],ans:`$${String(Number(rf.toFixed(6)))}$; about $${E}$ times`}}

function gPrRV(R){const L=[['the number of goals in a soccer match','discrete'],['the time taken to run 100 m','continuous'],['the number of heads in 10 coin tosses','discrete'],['the height of a randomly chosen student','continuous'],
 ['the number of cars in a car park','discrete'],['the mass of a newborn baby','continuous'],['the number of siblings a student has','discrete'],['the temperature at noon','continuous'],['the score on a fair die','discrete'],['the length of a fish caught','continuous']];
 const pick=R.sample(L,3),lab=['a','b','c'];
 return{q:`Classify each random variable as discrete or continuous: ${pick.map((x,i)=>`(${lab[i]}) ${x[0]}`).join('; ')}.`,marks:1,
  sol:['A discrete variable takes separate, countable values; a continuous variable can take any value in an interval (it is measured).',...pick.map((x,i)=>`(${lab[i]}) ${cap(x[1])}`)],ans:pick.map((x,i)=>`(${lab[i]}) ${x[1]}`).join(', ')}}

// ================= YEAR 11: EXPONENTIAL AND LOG GRAPHS =================
function gLGraph(R){
 if(R.next()<0.6){const a=R.pick([2,3,'e']),k=R.pick([1,2,3,-1,-2]),c=R.int(-4,4),neg=R.next()<0.4,ex=neg?'-x':'x';
  const y0=F(k+c),pos=k>0,base=`${a}^{${ex}}`,kb=Math.abs(k)===1?coefTex(k)+base:a==='e'?`${k}${base}`:`${k}\\times ${base}`;
  return{q:`For $y = ${kb}${c?term(c,'',false):''}$, state the equation of the asymptote, the $y$-intercept and the range.`,marks:2,
   sol:[`As $x \\to ${neg?'\\infty':'-\\infty'}$, $${base} \\to 0$, so $y \\to ${c}$: the asymptote is $y = ${c}$.`,`$y$-intercept: $y = ${k}\\times ${a}^{0}${c?` ${c<0?'-':'+'} ${Math.abs(c)}`:''} = ${y0.tex()}$, so $(0, ${y0.tex()})$.`,
    `$${kb}$ is always ${pos?'positive':'negative'}, so the range is $y ${pos?'\\gt':'\\lt'} ${c}$.`],ans:`Asymptote $y = ${c}$, $y$-intercept $(0, ${y0.tex()})$, range $y ${pos?'\\gt':'\\lt'} ${c}$`}}
 const a=R.pick([2,3,10,'e']),h=R.nz(-5,5),L=lin(1,-h),fn=a==='e'?`\\ln(${L})`:`\\log_{${a}}(${L})`;
 return{q:`For $y = ${fn}$, state the domain, the equation of the asymptote and the $x$-intercept.`,marks:2,
  sol:[`The logarithm needs $${L} \\gt 0$, so the domain is $x \\gt ${h}$ and the asymptote is $x = ${h}$.`,`$x$-intercept: $${fn} = 0$ when $${L} = 1$, so $x = ${h+1}$.`],ans:`Domain $x \\gt ${h}$, asymptote $x = ${h}$, $x$-intercept $(${h+1}, 0)$`}}


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
  {id:'el-derivex',group:'Calculus',name:'The derivative of e to the x',gen:gLDerivEx,marks:2},
  {id:'el-graph',group:'Graphs',name:'Exponential and log graphs: asymptotes and intercepts',gen:gLGraph,marks:2}]},
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
 {id:'11adv-transform',name:'Graph transformations',course:'Year 11 Advanced',lessons:[
  {id:'gt-rule',name:'Writing the transformed equation',gen:gGtRule,marks:2},
  {id:'gt-describe',name:'Describing transformations',gen:gGtDescribe,marks:2},
  {id:'gt-point',name:'Image of a point',gen:gGtPoint,marks:2},
  {id:'gt-features',name:'Asymptotes, domain and range of transformed graphs',gen:gGtFeatures,marks:3},
  {id:'gt-circle',name:'Circles: centre and radius',gen:gGtCircle,marks:3}]},
 {id:'11adv-trigmeasure',name:'Trigonometry and measure of angles',course:'Year 11 Advanced',lessons:[
  {id:'tm-exact',group:'Exact values',name:'Exact ratios for 30°, 45° and 60°',gen:gTmExact,marks:1},
  {id:'tm-anymag',group:'Exact values',name:'Angles of any magnitude',gen:gTmAnyMag,marks:1},
  {id:'tm-right',group:'Triangles',name:'Right triangles: elevation, depression and bearings',gen:gTmRight,marks:2},
  {id:'tm-sine',group:'Triangles',name:'Sine rule',gen:gTmSine,marks:2},
  {id:'tm-ambig',group:'Triangles',name:'Sine rule: the ambiguous case',gen:gTmAmbig,marks:3},
  {id:'tm-cosine',group:'Triangles',name:'Cosine rule',gen:gTmCosine,marks:2},
  {id:'tm-area',group:'Triangles',name:'Area of a triangle',gen:gTmArea,marks:2},
  {id:'tm-radians',group:'Radians',name:'Converting degrees and radians',gen:gTmRadians,marks:1},
  {id:'tm-arc',group:'Radians',name:'Arcs, sectors and segments',gen:gTmArc,marks:2}]},
 {id:'11adv-trigid',name:'Trigonometric identities and equations',course:'Year 11 Advanced',lessons:[
  {id:'ti-recip',name:'Exact values of sec, cosec and cot',gen:gTiRecip,marks:1},
  {id:'ti-comp',name:'Complementary angle identities',gen:gTiComp,marks:1},
  {id:'ti-simplify',name:'Simplifying with identities',gen:gTiSimplify,marks:2},
  {id:'ti-prove',name:'Proving identities',gen:gTiProve,marks:2},
  {id:'ti-solve',name:'Solving trig equations',gen:gTiSolve,marks:2},
  {id:'ti-quad',name:'Trig equations that reduce to quadratics',gen:gTiQuad,marks:3}]},
 {id:'11adv-calculus',name:'Introduction to differentiation',course:'Year 11 Advanced',lessons:[
  {id:'dc-avg',group:'Rates of change',name:'Average rate of change',gen:gDcAvg,marks:2},
  {id:'dc-first',group:'Rates of change',name:'First principles',gen:gDcFirst,marks:3},
  {id:'dc-index',group:'Rules',name:'Differentiating with indices',gen:gDiffIdx,marks:2},
  {id:'dc-chain',group:'Rules',name:'Chain rule',gen:gDcChain,marks:2},
  {id:'dc-product',group:'Rules',name:'Product rule',gen:gDcProduct,marks:2},
  {id:'dc-quotient',group:'Rules',name:'Quotient rule',gen:gDcQuotient,marks:2},
  {id:'dc-tangent',group:'Tangents and normals',name:'Equation of a tangent',gen:gTangent,marks:3},
  {id:'dc-normal',group:'Tangents and normals',name:'Equation of a normal',gen:gDcNormal,marks:3},
  {id:'dc-gradpt',group:'Tangents and normals',name:'Points with a given gradient',gen:gDcGradPt,marks:3},
  {id:'dc-incline',group:'Tangents and normals',name:'Angle of inclination',gen:gDcIncline,marks:2},
  {id:'dc-stat',group:'Graphs and motion',name:'Stationary points and increasing intervals',gen:gDcStat,marks:3},
  {id:'dc-velocity',group:'Graphs and motion',name:'Velocity from displacement',gen:gDcVelocity,marks:3}]},
 {id:'11adv-probability',name:'Probability and data',course:'Year 11 Advanced',lessons:[
  {id:'pr-sets',group:'Sets and probability',name:'Venn diagram counting',gen:gPrSets,marks:2},
  {id:'pr-add',group:'Sets and probability',name:'Addition rule and complements',gen:gPrAdd,marks:2},
  {id:'pr-tree',group:'Sets and probability',name:'Multistage events',gen:gPrTree,marks:2},
  {id:'pr-dice',group:'Sets and probability',name:'Two dice',gen:gPrDice,marks:1},
  {id:'pr-cond',group:'Conditional probability',name:'Conditional probability',gen:gPrCond,marks:2},
  {id:'pr-indep',group:'Conditional probability',name:'Independent events',gen:gPrIndep,marks:2},
  {id:'pr-rv',group:'Data',name:'Discrete and continuous variables',gen:gPrRV,marks:1},
  {id:'pr-data',group:'Data',name:'Mode, median and cumulative frequency',gen:gPrData,marks:2},
  {id:'pr-relfreq',group:'Data',name:'Relative frequency',gen:gPrRelFreq,marks:2}]}
];
// Sheet codes (printed on LSQ and homework sheets) record the ticked lessons as bits in this order.
// APPEND new lesson ids to the END only; never reorder or remove, or old printed codes will point at the wrong lessons.
// scripts/build_manifest.py fails the publish if a lesson in TOPICS is missing from this list.
const CODE_ORDER=[
 "dd-exp","dd-ax","dd-prodexp","dd-tanexp","dd-ln","dd-loglaw","dd-loga","dd-trig",
 "dd-trigprod","dd-trigexact","el-eval","el-laws","el-expand","el-pq","el-change","el-domain",
 "el-samebase","el-solveexp","el-hidden","el-lnquad","el-derivex","el-graph","ic-power","ic-index",
 "ic-chain","ic-def","ic-exp","ic-log","ic-trig","ic-area","ic-signed","ic-trap",
 "wf-index","wf-fracidx","wf-expand","wf-factorise","wf-special","wf-algfrac","wf-surds","wf-rationalise",
 "wf-quadformula","wf-compsquare","wf-discriminant","wf-notation","wf-domain","wf-line2pts","wf-parperp","wf-linefeat",
 "wf-linineq","wf-parabola","wf-equate","wf-simul","wf-quadineq","wf-breakeven","wf-variation","wf-circle",
 "wf-oddeven","wf-composite","wf-piecewise","wf-abs","gt-rule","gt-describe","gt-point","gt-features",
 "gt-circle","tm-exact","tm-anymag","tm-right","tm-sine","tm-ambig","tm-cosine","tm-area",
 "tm-radians","tm-arc","ti-recip","ti-comp","ti-simplify","ti-prove","ti-solve","ti-quad",
 "dc-avg","dc-first","dc-index","dc-chain","dc-product","dc-quotient","dc-tangent","dc-normal",
 "dc-gradpt","dc-incline","dc-stat","dc-velocity","pr-sets","pr-add","pr-tree","pr-dice",
 "pr-cond","pr-indep","pr-rv","pr-data","pr-relfreq",
];
function encodeLessons(ids){const on=new Set(ids);let n=0n;CODE_ORDER.forEach((id,i)=>{if(on.has(id))n|=1n<<BigInt(i)});return n.toString(36)}
function decodeLessons(s){let n=0n;for(const ch of String(s).toLowerCase()){const d=parseInt(ch,36);if(isNaN(d))return [];n=n*36n+BigInt(d)}return CODE_ORDER.filter((id,i)=>(n>>BigInt(i))&1n).filter(id=>LESSONS[id])}
// sheet code: seed.marks.lessons (homework) or seed.minutes.marks.lessons (LSQ)
function sheetCode(seed,nums,ids){return [seed,...nums,encodeLessons(ids)].join(".")}
function readSheetCode(code,nNums){const p=String(code).trim().split(".");if(p.length<nNums+2)return null;const ids=decodeLessons(p[p.length-1]),nums=p.slice(-1-nNums,-1).map(Number);
 if(!ids.length||nums.some(isNaN))return null;return{seed:p.slice(0,-1-nNums).join("."),nums,ids}}
const LESSONS={};TOPICS.forEach(t=>t.lessons.forEach(l=>{l.topic=t;LESSONS[l.id]=l}));

function buildSet(ids,n,seed,mix){const R=makeRng(seed+'|'+ids.join(','));
 const base=Math.floor(n/ids.length),extra=new Set(R.sample(ids,n%ids.length));
 const out=[],seen=new Set();
 ids.forEach(id=>{const L=LESSONS[id],cnt=base+(extra.has(id)?1:0);
  for(let i=0;i<cnt;i++){let Q,tries=0;do{Q=L.gen(R);tries++}while(seen.has(Q.q)&&tries<30);seen.add(Q.q);out.push({...Q,lesson:L})}});
 if(mix){for(let i=out.length-1;i>0;i--){const j=Math.floor(R.next()*(i+1));[out[i],out[j]]=[out[j],out[i]]}}
 return out}
