import { useState, useMemo, useCallback, useEffect, useRef } from "react";

const LETTERS=["C","D","E","F","G","A","B"];
const LETTER_PC=[0,2,4,5,7,9,11];
const ROOT_NAMES=["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];
const NOTE_OPTS=ROOT_NAMES;
const FLAT_ROOTS=new Set([5,10,3,8,1,6]);
const m2f=m=>440*Math.pow(2,(m-69)/12);

function rootLetterIndex(rpc){
  const nat={0:0,2:1,4:2,5:3,7:4,9:5,11:6};
  if(rpc in nat)return nat[rpc];
  return FLAT_ROOTS.has(rpc)?{1:1,3:2,6:4,8:5,10:6}[rpc]:{1:0,3:1,6:3,8:4,10:5}[rpc];
}
function spellScale(rpc,pcs){
  const rli=rootLetterIndex(rpc),m={};
  pcs.forEach((pc,i)=>{
    const li=(rli+i)%7,nat=LETTER_PC[li];
    let a=(pc-nat+12)%12;if(a>6)a-=12;
    m[pc]=LETTERS[li]+(a===1?"♯":a===-1?"♭":a===2?"𝄪":a===-2?"𝄫":"");
  });
  return m;
}

const DEG_COL=["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#d946ef"];
const INT_LBL=["1","♭2","2","♭3","3","4","♯4/♭5","5","♭6","6","♭7","7"];

const triadPCs=(r,t)=>{const x=r%12;return t==="major"?[x,(x+4)%12,(x+7)%12]:[x,(x+3)%12,(x+7)%12];};
const buildScale=(r,iT,ivT,vT)=>{
  const x=r%12,iv=(x+5)%12,v=(x+7)%12;
  return[...new Set([...triadPCs(x,iT),...triadPCs(iv,ivT),...triadPCs(v,vT)])].sort((a,b)=>((a-x+12)%12)-((b-x+12)%12));
};

const SCALE_NAMES={
  "major,major,major":"Major (Ionian)","major,major,minor":"Mixolydian",
  "major,minor,major":"Harmonic Major","major,minor,minor":"Mixolydian ♭6 (Hindu)",
  "minor,major,major":"Melodic Minor","minor,major,minor":"Dorian",
  "minor,minor,major":"Harmonic Minor","minor,minor,minor":"Natural Minor (Aeolian)",
};
const sKey=(a,b,c)=>`${a},${b},${c}`;

const CONFIGS=[
  {iT:"major",ivT:"major",vT:"major"},{iT:"major",ivT:"major",vT:"minor"},
  {iT:"major",ivT:"minor",vT:"major"},{iT:"major",ivT:"minor",vT:"minor"},
  {iT:"minor",ivT:"major",vT:"major"},{iT:"minor",ivT:"major",vT:"minor"},
  {iT:"minor",ivT:"minor",vT:"major"},{iT:"minor",ivT:"minor",vT:"minor"},
];
function findRelated(root,iT,ivT,vT){
  const key=[...new Set(buildScale(root,iT,ivT,vT))].sort((a,b)=>a-b).join(",");
  const res=[];
  for(let r=0;r<12;r++)for(const c of CONFIGS){
    if(r===root&&c.iT===iT&&c.ivT===ivT&&c.vT===vT)continue;
    if([...new Set(buildScale(r,c.iT,c.ivT,c.vT))].sort((a,b)=>a-b).join(",")===key)res.push({root:r,...c});
  }
  return res;
}

const CHORD_TONE_OPTIONS=[
  {label:"R",offset:0},{label:"3",offset:2},{label:"5",offset:4},
  {label:"7",offset:6},{label:"9",offset:8},{label:"11",offset:10},{label:"13",offset:12},
];

const buildChordTones=(scale,degIdx,toneOffsets)=>{
  const n=scale.length;
  return toneOffsets.map(off=>scale[(degIdx+off)%n]);
};
const triadQuality=pcs=>{
  if(pcs.length<3)return"?";
  const i1=(pcs[1]-pcs[0]+12)%12,i2=(pcs[2]-pcs[1]+12)%12;
  if(i1===4&&i2===3)return"maj";if(i1===3&&i2===4)return"min";
  if(i1===3&&i2===3)return"dim";if(i1===4&&i2===4)return"aug";return"?";
};
const diatonicCycle=(scale,step,toneOffsets)=>{
  if(!scale.length)return[];
  const n=scale.length,cy=[],vis=new Set();
  let idx=0;
  for(let s=0;s<n;s++){
    if(vis.has(idx))break;vis.add(idx);
    const pcs=buildChordTones(scale,idx,toneOffsets);
    cy.push({degIdx:idx,root:pcs[0],pcs,quality:triadQuality(pcs.slice(0,3))});
    idx=(idx+step)%n;
  }
  return cy;
};

const CYCLE_INTERVALS=[
  {label:"2nds",steps:1},{label:"3rds",steps:2},{label:"4ths",steps:3},
  {label:"5ths",steps:4},{label:"6ths",steps:5},{label:"7ths",steps:6},
];

const PRESETS={
  "Standard EADGBE":[40,45,50,55,59,64],"Drop D":[38,45,50,55,59,64],
  "Open G DGDGBD":[38,43,50,55,59,62],"Open D DADF#AD":[38,45,50,54,57,62],
  "DADGAD":[38,45,50,55,57,62],"All 4ths EADGCF":[40,45,50,55,60,65],
  "7-str Standard":[35,40,45,50,55,59,64],"Bass EADG":[28,33,38,43],"Custom":null,
};

let actx=null;
const ac=()=>{if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();return actx;};
const beep=(freq,dur=0.5,wave="triangle")=>{
  const c=ac(),o=c.createOscillator(),g=c.createGain();
  o.type=wave;o.frequency.value=freq;
  g.gain.setValueAtTime(0.18,c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
  o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+dur);
};
const playChord12TET=(pcs,dur=0.8)=>{
  if(!pcs.length)return;
  const base=60+pcs[0];const freqs=[m2f(base)];
  for(let i=1;i<pcs.length;i++){let m=60+pcs[i];while(m<base)m+=12;if(m-base>18)m-=12;freqs.push(m2f(m));}
  freqs.sort((a,b)=>a-b);
  freqs.forEach((f,i)=>setTimeout(()=>beep(f,dur),i*35));
};

const jiRat=(f,t)=>{let r=Math.pow(3,f)*Math.pow(5,t);while(r<1)r*=2;while(r>=2)r/=2;return r;};
const jiRaw=(f,t)=>Math.pow(3,f)*Math.pow(5,t);
const etOR=(f,t)=>{let r=Math.pow(2,(f*7+t*4)/12);while(r<1)r*=2;while(r>=2)r/=2;return r;};
const etR=(f,t)=>Math.pow(2,(f*7+t*4)/12);
const r2c=r=>1200*Math.log2(r);
const c2pc=c=>{const s=Math.round(c/100);return((s%12)+12)%12;};

// hex to rgb helper
const hex2rgb=(hex)=>{
  const h=hex.replace('#','');
  return [parseInt(h.substring(0,2),16),parseInt(h.substring(2,4),16),parseInt(h.substring(4,6),16)];
};

const S={
  btn:{background:"#374151",color:"#d1d5db",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:500},
  lbl:{fontSize:11,color:"#9ca3af",display:"block",marginBottom:3},
  inp:{background:"#1f2937",color:"#f3f4f6",border:"1px solid #374151",borderRadius:6,padding:"5px 8px",fontSize:13},
};

function Toggle({checked,onChange,label}){
  return(<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#d1d5db",userSelect:"none"}}>
    <div onClick={e=>{e.preventDefault();onChange(!checked);}} style={{
      width:36,height:20,borderRadius:10,background:checked?"#3b82f6":"#4b5563",
      position:"relative",transition:"background .2s",cursor:"pointer",flexShrink:0,
    }}><div style={{width:16,height:16,borderRadius:8,background:"white",position:"absolute",
      top:2,left:checked?18:2,transition:"left .2s"}}/></div>
    {label}
  </label>);
}

// ─── Beat Progress (dots + lines only, no fill bar) ───
function BeatProgress({bpm,beats,running}){
  const [currentBeat,setCurrentBeat]=useState(0);
  const rafRef=useRef(null);
  const startRef=useRef(null);
  const totalMs=(beats/(bpm/60))*1000;

  useEffect(()=>{
    if(!running){setCurrentBeat(0);if(rafRef.current)cancelAnimationFrame(rafRef.current);return;}
    startRef.current=performance.now();
    const tick=now=>{
      const elapsed=now-startRef.current;
      const beat=Math.floor((elapsed%totalMs)/(totalMs/beats));
      setCurrentBeat(beat);
      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[running,totalMs,beats]);

  return(
    <div style={{marginTop:6}}>
      <div style={{position:"relative",height:16,background:"#1f2937",borderRadius:4,overflow:"hidden"}}>
        {/* Beat divider lines */}
        {Array.from({length:beats},(_,i)=>(
          <div key={i} style={{
            position:"absolute",left:`${(i/beats)*100}%`,top:0,bottom:0,width:1,
            background:i===0?"transparent":"#4b5563",
          }}/>
        ))}
        {/* Beat dots */}
        {Array.from({length:beats},(_,i)=>(
          <div key={`d${i}`} style={{
            position:"absolute",left:`${((i+0.5)/beats)*100}%`,top:"50%",transform:"translate(-50%,-50%)",
            width:8,height:8,borderRadius:4,
            background:running&&i<=currentBeat?"#fbbf24":"#374151",
            border:running&&i===currentBeat?"2px solid #fde68a":"2px solid #4b5563",
            transition:"background 80ms, border 80ms",
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Fretboard ───
function Fretboard({tuning,numFrets,scale,degColorMap,spelling,root,highlightPCs,chordFnMap,mutedStrings}){
  const sp=32,fw=68,tp=40,lp=50;
  const ns=tuning.length,h=tp+ns*sp+20;
  const fx=f=>{if(!f)return lp;let x=lp;for(let i=1;i<=f;i++)x+=fw*Math.pow(0.944,i-1);return x;};
  const w=fx(numFrets)+30;
  const scSet=new Set(scale);
  const hlSet=highlightPCs?new Set(highlightPCs):null;
  const strs=[...tuning].map((_,i)=>i).reverse();
  const mutSet=new Set(mutedStrings||[]);

  return(
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",maxHeight:300}}>
      {[3,5,7,9,12,15,17,19,21,24].filter(f=>f<=numFrets).map(f=>{
        const mx=(fx(f-1)+fx(f))/2,my=tp+(ns-1)*sp/2;
        const is12=f===12||f===24;
        return(<g key={f}>
          <text x={mx} y={tp-12} textAnchor="middle" fontSize="10" fill={is12?"#9ca3af":"#6b7280"} fontWeight={is12?600:400}>{f}</text>
          {is12?<>
            <circle cx={mx-8} cy={my} r="3.5" fill="#475569" opacity=".5"/>
            <circle cx={mx+8} cy={my} r="3.5" fill="#475569" opacity=".5"/>
          </>:<circle cx={mx} cy={my} r="3" fill="#374151" opacity=".3"/>}
        </g>);
      })}
      <rect x={fx(11)} y={tp-2} width={fx(12)-fx(11)} height={(ns-1)*sp+4} rx="2"
        fill="#ffffff" opacity="0.03"/>
      <line x1={lp} y1={tp} x2={lp} y2={tp+(ns-1)*sp} stroke="#d1d5db" strokeWidth="4"/>
      {Array.from({length:numFrets},(_,i)=>i+1).map(f=>
        <line key={f} x1={fx(f)} y1={tp} x2={fx(f)} y2={tp+(ns-1)*sp}
          stroke={f===12?"#6b7280":"#4b5563"} strokeWidth={f===12?2:1.5}/>
      )}
      {strs.map((origIdx,si)=>{
        const om=tuning[origIdx];
        const y=tp+si*sp,thick=0.8+(si/Math.max(ns-1,1))*1.8;
        const isMuted=mutSet.has(origIdx);
        return(<g key={si} opacity={isMuted?0.2:1}>
          <line x1={lp} y1={y} x2={fx(numFrets)} y2={y}
            stroke={isMuted?"#4b5563":"#9ca3af"} strokeWidth={thick}
            strokeDasharray={isMuted?"4,4":""}/>
          <text x={lp-8} y={y+4} textAnchor="end" fontSize="11"
            fill={isMuted?"#4b5563":"#d1d5db"} fontFamily="monospace">
            {spelling[((om%12)+12)%12]||ROOT_NAMES[((om%12)+12)%12]}
          </text>
          {!isMuted&&Array.from({length:numFrets+1},(_,fr)=>{
            const midi=om+fr,pc=((midi%12)+12)%12;
            if(!scSet.has(pc))return null;
            const col=degColorMap[pc]||"#6b7280";
            const cx2=fr===0?lp-18:(fx(fr-1)+fx(fr))/2;
            const isHL=hlSet&&hlSet.has(pc);
            const fn=chordFnMap?chordFnMap[pc]:null;
            const dimmed=hlSet&&!isHL;
            const rad=isHL&&fn?14:pc===root?13:10;
            return(<g key={fr} style={{cursor:"pointer"}} onClick={()=>beep(m2f(midi),0.6)}>
              <circle cx={cx2} cy={y} r={rad} fill={col}
                opacity={dimmed?0.16:0.9}
                stroke={isHL?"#fbbf24":"none"} strokeWidth={isHL?2.5:0}/>
              <text x={cx2} y={fn&&isHL?y+1:y+4} textAnchor="middle"
                fontSize={fn&&isHL?8:9} fill="white" fontWeight={pc===root?"bold":"normal"}
                fontFamily="monospace" opacity={dimmed?0.18:1} style={{pointerEvents:"none"}}>
                {spelling[pc]||"?"}
              </text>
              {fn&&isHL&&<text x={cx2} y={y+11} textAnchor="middle" fontSize="7"
                fill="#fbbf24" fontWeight="bold" fontFamily="monospace"
                style={{pointerEvents:"none"}}>{fn}</text>}
            </g>);
          })}
        </g>);
      })}
    </svg>
  );
}

// ─── Lattice ───
function Lattice({rootPC,freq,range,scale,degColorMap,spelling,useJI,octRed,highlightPCs,onTriadClick}){
  const cell=72,rng=range;
  const w=(2*rng+1)*cell+80,h=(2*rng+1)*cell+80;
  const sx=w/2,sy=h/2;
  const [hov,setHov]=useState(null);
  const [hlTr,setHlTr]=useState(null);
  const toX=f=>sx+f*cell,toY=t=>sy-t*cell;
  const scSet=useMemo(()=>new Set(scale),[scale]);
  const hlSet=useMemo(()=>highlightPCs?new Set(highlightPCs):null,[highlightPCs]);

  const pts=useMemo(()=>{
    const p=[];
    for(let f=-rng;f<=rng;f++)for(let t=-rng;t<=rng;t++){
      const j=jiRat(f,t),cents=r2c(j),pc=c2pc(cents),absPC=(pc+rootPC)%12;
      const dev=Math.round(cents-Math.round(cents/100)*100);
      const hz=octRed?(freq*(useJI?j:etOR(f,t))):(freq*(useJI?jiRaw(f,t):etR(f,t)));
      p.push({f,t,pc:absPC,name:spelling[absPC]||ROOT_NAMES[absPC],dev,hz,inSc:scSet.has(absPC),jiR:j});
    }
    return p;
  },[rng,freq,scSet,rootPC,useJI,octRed,spelling]);

  const triads=useMemo(()=>{
    const m={};pts.forEach(p=>{m[`${p.f},${p.t}`]=p;});
    const res=[];
    pts.forEach(p=>{
      const m3=m[`${p.f},${p.t+1}`],p5=m[`${p.f+1},${p.t}`];
      if(m3&&p5)res.push({type:"major",pts:[p,m3,p5],label:p.name,pcs:[p.pc,m3.pc,p5.pc],rootPC:p.pc});
      const mn=m[`${p.f+1},${p.t-1}`];
      if(mn&&p5)res.push({type:"minor",pts:[p,mn,p5],label:p.name+"m",pcs:[p.pc,mn.pc,p5.pc],rootPC:p.pc});
    });
    return res;
  },[pts]);

  const trInSc=tr=>tr.pts.every(p=>p.inSc);
  const trMatchHL=useCallback(tr=>{
    if(!hlSet)return false;
    return tr.pts.every(p=>hlSet.has(p.pc));
  },[hlSet]);

  return(<div>
    <div style={{height:20,marginBottom:4,overflow:"hidden"}}>
      {hov?<span style={{color:"#9ca3af",fontSize:11,fontFamily:"monospace"}}>
        {hov.name} {hov.dev>=0?"+":""}{hov.dev}¢ · ≈{hov.jiR.toFixed(4)} · {hov.hz.toFixed(2)}Hz · ({hov.f}×P5, {hov.t}×M3)
      </span>:<span style={{color:"#4b5563",fontSize:11}}>Hover a note for details</span>}
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",maxHeight:520,background:"#0f172a",borderRadius:8}}>
      <text x={w-16} y={sy+4} textAnchor="end" fontSize="10" fill="#6b7280">→ fifths (×3)</text>
      <text x={sx} y={14} textAnchor="middle" fontSize="10" fill="#6b7280">↑ major 3rds (×5)</text>
      {Array.from({length:2*rng+1},(_,i)=>i-rng).map(v=><g key={v}>
        <line x1={toX(-rng)} y1={toY(v)} x2={toX(rng)} y2={toY(v)} stroke="#1e293b" strokeWidth=".5"/>
        <line x1={toX(v)} y1={toY(-rng)} x2={toX(v)} y2={toY(rng)} stroke="#1e293b" strokeWidth=".5"/>
      </g>)}
      {triads.map((tr,i)=>{
        const poly=tr.pts.map(p=>`${toX(p.f)},${toY(p.t)}`).join(" ");
        const hl=hlTr===i,inS=trInSc(tr),match=trMatchHL(tr);
        // Color from chord root's scale-degree color
        const rootCol=degColorMap[tr.rootPC];
        const rgb=rootCol?hex2rgb(rootCol):null;
        const hasColor=inS&&rgb;
        const fillNorm=hasColor?`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`:"rgba(100,116,139,0.03)";
        const fillHL=hasColor?`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`:"rgba(100,116,139,0.1)";
        const strokeNorm=hasColor?`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.7)`:"rgba(100,116,139,0.15)";
        const strokeHL=hasColor?`rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`:strokeNorm;
        const labelCol=rootCol||"#94a3b8";
        return(<g key={i}>
          <polygon points={poly}
            fill={match?`rgba(251,191,36,.25)`:hl?fillHL:fillNorm}
            stroke={match?"#fbbf24":hl?strokeHL:strokeNorm}
            strokeWidth={match?3:hl?2.5:inS?1.5:.5}
            strokeDasharray={inS||match?"":"4,3"} style={{cursor:"pointer"}}
            onMouseEnter={()=>setHlTr(i)} onMouseLeave={()=>setHlTr(null)}
            onClick={()=>{
              const fs=tr.pts.map(p=>{
                let f2=freq*(useJI?jiRat(p.f,p.t):etOR(p.f,p.t));
                while(f2<freq)f2*=2;while(f2>=freq*2)f2/=2;return f2;
              });
              fs.sort((a,b)=>a-b);
              fs.forEach((ff,ii)=>setTimeout(()=>beep(ff,.7,"sine"),ii*35));
              if(onTriadClick)onTriadClick(tr.pcs);
            }}/>
          {(hl||match)&&<text
            x={tr.pts.reduce((s,p)=>s+toX(p.f),0)/3}
            y={tr.pts.reduce((s,p)=>s+toY(p.t),0)/3+4}
            textAnchor="middle" fontSize="9"
            fill={match?"#fbbf24":labelCol}
            fontWeight="bold" style={{pointerEvents:"none"}}>{tr.label}</text>}
        </g>);
      })}
      {pts.map(p=>{
        const x=toX(p.f),y=toY(p.t),isC=p.f===0&&p.t===0,isH=hov&&hov.f===p.f&&hov.t===p.t;
        const dc2=p.inSc?(degColorMap[p.pc]||"#3b82f6"):null;
        const isHL=hlSet&&hlSet.has(p.pc),dim=hlSet&&!isHL;
        return(<g key={`${p.f}-${p.t}`} style={{cursor:"pointer"}}
          onMouseEnter={()=>setHov(p)} onMouseLeave={()=>setHov(null)}
          onClick={()=>beep(p.hz,.7,"sine")}>
          <circle cx={x} cy={y} r={isC?22:isH?20:16}
            fill={p.inSc?dc2:"#0f172a"}
            stroke={isHL&&p.inSc?"#fbbf24":p.inSc?dc2:"#334155"}
            strokeWidth={isHL&&p.inSc?3:p.inSc?2:1}
            strokeDasharray={p.inSc?"":"3,3"}
            opacity={dim&&p.inSc?0.22:p.inSc?0.9:0.45}/>
          <text x={x} y={y-3} textAnchor="middle" fontSize="11"
            fill={p.inSc?"white":"#64748b"} fontWeight={isC?"bold":"normal"}
            opacity={dim&&p.inSc?0.22:1} style={{pointerEvents:"none"}}>{p.name}</text>
          <text x={x} y={y+9} textAnchor="middle" fontSize="8"
            fill={p.inSc?"#e2e8f0":"#475569"}
            opacity={dim&&p.inSc?0.22:1} style={{pointerEvents:"none"}}>
            {p.dev>=0?"+":""}{p.dev}¢</text>
        </g>);
      })}
    </svg>
    <div style={{marginTop:5,color:"#6b7280",fontSize:11}}>
      Filled = in scale · Dashed = out · Triangle color = chord root degree · Gold = active chord · Click triangle to activate
    </div>
  </div>);
}

function TuningEd({tuning,setTuning,mutedStrings,setMutedStrings}){
  const mOct=m=>Math.floor(m/12)-1,mPC=m=>m%12;
  const setN=(i,v)=>{const t=[...tuning];t[i]=(mOct(t[i])+1)*12+v;setTuning(t);};
  const setO=(i,v)=>{const t=[...tuning];t[i]=(v+1)*12+mPC(t[i]);setTuning(t);};
  const items=tuning.map((m,i)=>({midi:m,idx:i})).reverse();
  const addTop=()=>setTuning([...tuning,tuning[tuning.length-1]+5]);
  const removeTop=()=>{if(tuning.length<=1)return;setTuning(tuning.slice(0,-1));setMutedStrings(mutedStrings.filter(i=>i<tuning.length-1));};
  const addBottom=()=>{setTuning([tuning[0]-5,...tuning]);setMutedStrings(mutedStrings.map(i=>i+1));};
  const removeBottom=()=>{if(tuning.length<=1)return;setTuning(tuning.slice(1));setMutedStrings(mutedStrings.filter(i=>i>0).map(i=>i-1));};
  const toggleMute=idx=>{const s=new Set(mutedStrings);s.has(idx)?s.delete(idx):s.add(idx);setMutedStrings([...s]);};
  const addRemBtn=(label,onAdd,onRem)=>(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <span style={{fontSize:8,color:"#6b7280"}}>{label}</span>
      <button onClick={onAdd} style={{...S.btn,padding:"2px 6px",fontSize:10}}>+</button>
      <button onClick={onRem} style={{...S.btn,padding:"2px 6px",fontSize:10}}>−</button>
    </div>
  );
  return(<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginTop:6}}>
    {addRemBtn("top",addTop,removeTop)}
    {items.map(({midi,idx})=>{
      const sn=tuning.length-idx,isMuted=mutedStrings.includes(idx);
      return(<div key={idx} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,opacity:isMuted?0.4:1}}>
        <span style={{fontSize:9,color:"#6b7280"}}>{sn}</span>
        <div style={{display:"flex",gap:2}}>
          <select value={mPC(midi)} onChange={e=>setN(idx,+e.target.value)}
            style={{...S.inp,padding:"2px 3px",fontSize:11,width:54}}>
            {NOTE_OPTS.map((n,i)=><option key={i} value={i}>{n}</option>)}
          </select>
          <select value={mOct(midi)} onChange={e=>setO(idx,+e.target.value)}
            style={{...S.inp,padding:"2px 3px",fontSize:11,width:34}}>
            {[1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button onClick={()=>toggleMute(idx)}
          style={{fontSize:8,padding:"1px 4px",borderRadius:3,border:"none",cursor:"pointer",
            background:isMuted?"#ef4444":"#374151",color:isMuted?"white":"#9ca3af",marginTop:1}}>
          {isMuted?"muted":"mute"}
        </button>
      </div>);
    })}
    {addRemBtn("bottom",addBottom,removeBottom)}
  </div>);
}

function ChordToneSelector({selected,onChange}){
  const toggle=off=>{if(off===0)return;const s=new Set(selected);s.has(off)?s.delete(off):s.add(off);onChange([...s].sort((a,b)=>a-b));};
  return(<div style={{display:"flex",gap:2,alignItems:"center"}}>
    <span style={{fontSize:10,color:"#6b7280",marginRight:2}}>Tones:</span>
    {CHORD_TONE_OPTIONS.map(({label,offset})=>{
      const on=selected.includes(offset);
      return(<button key={offset} onClick={()=>toggle(offset)}
        style={{padding:"2px 6px",fontSize:10,borderRadius:4,cursor:offset===0?"default":"pointer",
          border:on?"1px solid #3b82f6":"1px solid #374151",
          background:on?"#1e3a5f":"#1f2937",color:on?"#93c5fd":"#6b7280",
          fontFamily:"monospace",fontWeight:on?600:400}}>{label}</button>);
    })}
  </div>);
}

function StringMuteBar({tuning,spelling,mutedStrings,setMutedStrings}){
  const items=tuning.map((m,i)=>({midi:m,idx:i})).reverse();
  const toggle=idx=>{const s=new Set(mutedStrings);s.has(idx)?s.delete(idx):s.add(idx);setMutedStrings([...s]);};
  return(<div style={{display:"flex",gap:3,alignItems:"center",marginTop:4}}>
    <span style={{fontSize:10,color:"#6b7280",marginRight:2}}>Strings:</span>
    {items.map(({midi,idx})=>{
      const pc=((midi%12)+12)%12,name=spelling[pc]||ROOT_NAMES[pc],isMuted=mutedStrings.includes(idx);
      return(<button key={idx} onClick={()=>toggle(idx)}
        style={{padding:"2px 6px",fontSize:10,borderRadius:4,cursor:"pointer",
          border:isMuted?"1px solid #ef4444":"1px solid #374151",
          background:isMuted?"#7f1d1d":"#1f2937",color:isMuted?"#fca5a5":"#d1d5db",
          fontFamily:"monospace",opacity:isMuted?0.6:1}}>{name}</button>);
    })}
  </div>);
}

export default function App(){
  const [root,setRoot]=useState(0);
  const [iT,setIT]=useState("major");
  const [ivT,setIVT]=useState("major");
  const [vT,setVT]=useState("major");
  const [tuning,setTuning]=useState([40,45,50,55,59,64]);
  const [preset,setPreset]=useState("Standard EADGBE");
  const [nfFret,setNfFret]=useState(19);
  const [nfSide,setNfSide]=useState(15);
  const [cyStep,setCyStep]=useState(0);
  const [cyOn,setCyOn]=useState(false);
  const [cycleInt,setCycleInt]=useState(3);
  const [chordTones,setChordTones]=useState([0,2,4]);
  const [cFreq,setCFreq]=useState(261.63);
  const [lRange,setLRange]=useState(3);
  const [view,setView]=useState("fretboard");
  const [useJI,setUseJI]=useState(true);
  const [octRed,setOctRed]=useState(true);
  const [autoPlay,setAutoPlay]=useState(true);
  const [autoCycle,setAutoCycle]=useState(false);
  const [bpm,setBpm]=useState(120);
  const [beats,setBeats]=useState(4);
  const [mutedStrings,setMutedStrings]=useState([]);

  const nf=view==="side"?nfSide:nfFret;
  const setNF=v=>{if(view==="side")setNfSide(v);else setNfFret(v);};

  const scale=useMemo(()=>buildScale(root,iT,ivT,vT),[root,iT,ivT,vT]);
  const spelling=useMemo(()=>spellScale(root,scale),[root,scale]);
  const degColorMap=useMemo(()=>{const m={};scale.forEach((pc,i)=>{m[pc]=DEG_COL[i%DEG_COL.length];});return m;},[scale]);
  const scaleName=SCALE_NAMES[sKey(iT,ivT,vT)]||"Unknown";
  const related=useMemo(()=>findRelated(root,iT,ivT,vT),[root,iT,ivT,vT]);

  const dc=useMemo(()=>diatonicCycle(scale,cycleInt,chordTones),[scale,cycleInt,chordTones]);
  const curTriad=cyOn&&dc.length>0?dc[cyStep%dc.length]:null;
  const hlPCs=curTriad?curTriad.pcs:null;
  const chordFnMap=useMemo(()=>{
    if(!curTriad)return null;
    const m={};
    curTriad.pcs.forEach((pc,i)=>{
      const off=chordTones[i];
      const lbl=CHORD_TONE_OPTIONS.find(o=>o.offset===off)?.label||"?";
      if(m[pc])m[pc]+=","+lbl;else m[pc]=lbl;
    });
    return m;
  },[curTriad,chordTones]);

  const scKeyD=scale.join(",")+cycleInt+chordTones.join(",");
  useMemo(()=>setCyStep(0),[scKeyD]);

  const totalMs=useMemo(()=>(beats/(bpm/60))*1000,[bpm,beats]);
  const timerRef=useRef(null);
  useEffect(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    if(autoCycle&&cyOn&&dc.length>0){
      timerRef.current=setInterval(()=>{
        setCyStep(s=>{const next=(s+1)%dc.length;if(autoPlay)playChord12TET(dc[next].pcs);return next;});
      },totalMs);
    }
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[autoCycle,cyOn,totalMs,dc,autoPlay]);

  const goNext=useCallback(()=>{
    setCyStep(s=>{const next=(s+1)%dc.length;if(autoPlay&&dc.length)playChord12TET(dc[next].pcs);return next;});
  },[dc,autoPlay]);
  const goPrev=useCallback(()=>{
    setCyStep(s=>{const prev=(s-1+dc.length)%dc.length;if(autoPlay&&dc.length)playChord12TET(dc[prev].pcs);return prev;});
  },[dc,autoPlay]);

  const handleRootChange=useCallback(r=>{setRoot(r);setCFreq(m2f(60+r));},[]);
  const handlePreset=p=>{setPreset(p);const t=PRESETS[p];if(t)setTuning([...t]);setMutedStrings([]);};
  const handleLatticeTriadClick=useCallback((trPCs)=>{
    const trSet=new Set(trPCs);
    const idx=dc.findIndex(ch=>ch.pcs.slice(0,3).every(pc=>trSet.has(pc)));
    if(idx>=0){setCyStep(idx);if(!cyOn)setCyOn(true);}
  },[dc,cyOn]);

  const qualSuf={maj:"",min:"m",dim:"°",aug:"+","?":"?"};
  const iv=(root+5)%12,v=(root+7)%12;
  const tabBtn=key=>({
    padding:"7px 18px",borderRadius:6,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",
    background:view===key?"#3b82f6":"#1f2937",color:view===key?"#fff":"#9ca3af",
    transition:"background .15s",minWidth:90,textAlign:"center",
  });

  const fretPanel=(<div>
    <div style={{background:"#1a1a2e",borderRadius:8,padding:12,overflowX:"auto"}}>
      <Fretboard tuning={tuning} numFrets={nf} scale={scale} degColorMap={degColorMap}
        spelling={spelling} root={root} highlightPCs={hlPCs} chordFnMap={chordFnMap}
        mutedStrings={mutedStrings}/>
    </div>
    <div style={{background:"#1f2937",borderRadius:8,padding:12,marginTop:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:600,color:"#d1d5db"}}>Diatonic Cycle of</span>
        <select value={cycleInt} onChange={e=>{setCycleInt(+e.target.value);setCyStep(0);}}
          style={{...S.inp,width:72,padding:"4px 6px"}}>
          {CYCLE_INTERVALS.map(ci=><option key={ci.steps} value={ci.steps}>{ci.label}</option>)}
        </select>
        <label style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:4}}>
          <input type="checkbox" checked={cyOn} onChange={e=>{setCyOn(e.target.checked);setCyStep(0);}}/> Active
        </label>
        {cyOn&&<>
          <button onClick={goPrev} style={S.btn}>←</button>
          <button onClick={goNext} style={S.btn}>→</button>
          <span style={{color:"#6b7280",fontSize:11}}>Step {cyStep+1}/{dc.length}</span>
        </>}
      </div>
      <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
        <ChordToneSelector selected={chordTones} onChange={setChordTones}/>
        <div style={{height:16,borderLeft:"1px solid #374151"}}/>
        <label style={{fontSize:11,color:"#9ca3af",display:"flex",alignItems:"center",gap:4}}>
          <input type="checkbox" checked={autoPlay} onChange={e=>setAutoPlay(e.target.checked)}/> Audio
        </label>
        <div style={{height:16,borderLeft:"1px solid #374151"}}/>
        <label style={{fontSize:11,color:"#9ca3af",display:"flex",alignItems:"center",gap:4}}>
          <input type="checkbox" checked={autoCycle} onChange={e=>setAutoCycle(e.target.checked)}/> Auto
        </label>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <input type="number" min={30} max={300} step={1} value={bpm}
            onChange={e=>setBpm(Math.max(30,+e.target.value||120))}
            style={{...S.inp,width:44,padding:"2px 4px",fontSize:11}}/>
          <span style={{fontSize:10,color:"#6b7280"}}>bpm</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <input type="number" min={1} max={16} step={1} value={beats}
            onChange={e=>setBeats(Math.max(1,Math.min(16,+e.target.value||4)))}
            style={{...S.inp,width:36,padding:"2px 4px",fontSize:11}}/>
          <span style={{fontSize:10,color:"#6b7280"}}>beats</span>
        </div>
      </div>
      <BeatProgress bpm={bpm} beats={beats} running={autoCycle&&cyOn}/>
      <div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
        {dc.map((item,i)=>{
          const cur=cyOn&&i===cyStep;
          const rootCol=degColorMap[item.root]||"#6b7280";
          const cName=(spelling[item.root]||"?")+qualSuf[item.quality];
          const tLabels=item.pcs.map((pc,ti)=>{
            const off=chordTones[ti];
            const fn=CHORD_TONE_OPTIONS.find(o=>o.offset===off)?.label||"?";
            return{fn,name:spelling[pc]||"?",col:degColorMap[pc]||"#888"};
          });
          return(<div key={i} style={{display:"flex",alignItems:"center",gap:3}}>
            {i>0&&<span style={{color:"#4b5563",fontSize:10}}>→</span>}
            <div onClick={()=>{setCyStep(i);if(!cyOn)setCyOn(true);if(autoPlay)playChord12TET(item.pcs);}}
              style={{
                background:"transparent",color:"white",borderRadius:6,padding:"5px 8px",
                fontSize:12,fontWeight:cur?700:500,cursor:"pointer",
                border:cur?`2px solid ${rootCol}`:"2px solid #374151",
                opacity:cur?1:0.85,display:"flex",alignItems:"center",gap:5,
              }}>
              <span style={{fontFamily:"monospace",color:cur?rootCol:"#d1d5db"}}>{cName}</span>
              <span style={{display:"flex",gap:2}}>
                {tLabels.map(({fn,name,col},ti)=>(
                  <span key={ti} style={{fontSize:9,padding:"1px 3px",borderRadius:3,fontFamily:"monospace",
                    background:cur?`${col}33`:"transparent",color:cur?col:"#6b7280"}}>
                    <span style={{fontWeight:600}}>{fn}</span>
                    <span style={{opacity:.8,marginLeft:1}}>{name}</span>
                  </span>
                ))}
              </span>
            </div>
          </div>);
        })}
      </div>
      <div style={{marginTop:6,color:"#6b7280",fontSize:11}}>
        Color = scale degree · Chord function labels per tone · Click to play &amp; highlight
      </div>
    </div>
    <div style={{background:"#1f2937",borderRadius:8,padding:12,marginTop:10}}>
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <label style={{...S.lbl,margin:0}}>Tuning</label>
        <select value={preset} onChange={e=>handlePreset(e.target.value)} style={{...S.inp,width:150}}>
          {Object.keys(PRESETS).map(k=><option key={k} value={k}>{k}</option>)}
        </select>
        <label style={{...S.lbl,margin:0}}>Frets</label>
        <input type="number" min={5} max={24} value={nf} onChange={e=>setNF(+e.target.value)}
          style={{...S.inp,width:48}}/>
      </div>
      {preset==="Custom"?(
        <TuningEd tuning={tuning} setTuning={t=>{setTuning(t);setPreset("Custom");}}
          mutedStrings={mutedStrings} setMutedStrings={setMutedStrings}/>
      ):(
        <StringMuteBar tuning={tuning} spelling={spelling}
          mutedStrings={mutedStrings} setMutedStrings={setMutedStrings}/>
      )}
    </div>
  </div>);

  const lattPanel=(<div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:10,alignItems:"end"}}>
      <div>
        <label style={S.lbl}>Ref freq (Hz)</label>
        <input type="number" value={cFreq.toFixed(2)} step=".01"
          onChange={e=>setCFreq(+e.target.value||261.63)} style={{...S.inp,width:90}}/>
      </div>
      <div>
        <label style={S.lbl}>Range ±{lRange}</label>
        <input type="range" min={2} max={5} value={lRange}
          onChange={e=>setLRange(+e.target.value)} style={{width:80}}/>
      </div>
      <Toggle checked={useJI} onChange={setUseJI} label={useJI?"Just Intonation":"Equal Temperament"}/>
      <Toggle checked={octRed} onChange={setOctRed} label="Octave reduce"/>
    </div>
    <Lattice rootPC={root} freq={cFreq} range={lRange} scale={scale}
      degColorMap={degColorMap} spelling={spelling} useJI={useJI} octRed={octRed}
      highlightPCs={hlPCs} onTriadClick={handleLatticeTriadClick}/>
  </div>);

  return(
    <div style={{background:"#111827",minHeight:"100vh",color:"#f3f4f6",padding:16,fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:"#f9fafb",margin:0}}>Music Theory Workbench</h1>
          <p style={{color:"#6b7280",fontSize:12,margin:"2px 0 0"}}>Fretboard · Diatonic Cycles · JI Lattice</p>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setView("fretboard")} style={tabBtn("fretboard")}>Fretboard</button>
          <button onClick={()=>setView("lattice")} style={tabBtn("lattice")}>Lattice</button>
          <button onClick={()=>setView("side")} style={tabBtn("side")}>Side by Side</button>
        </div>
      </div>
      <div style={{background:"#1f2937",borderRadius:8,padding:12,marginBottom:12}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 420px"}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
              <div>
                <label style={S.lbl}>Root</label>
                <select value={root} onChange={e=>handleRootChange(+e.target.value)}
                  style={{...S.inp,width:72}}>
                  {ROOT_NAMES.map((n,i)=><option key={i} value={i}>{n}</option>)}
                </select>
              </div>
              {[{l:"I",v:iT,s:setIT},{l:"IV",v:ivT,s:setIVT},{l:"V",v:vT,s:setVT}].map(({l,v,s})=>
                <div key={l}>
                  <label style={S.lbl}>{l}</label>
                  <select value={v} onChange={e=>s(e.target.value)} style={{...S.inp,width:72}}>
                    <option value="major">Major</option><option value="minor">Minor</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{background:"#111827",borderRadius:6,padding:"5px 12px"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#f9fafb"}}>{spelling[root]} {scaleName}</span>
              </div>
              {[{d:"I",r:root,t:iT},{d:"IV",r:iv,t:ivT},{d:"V",r:v,t:vT}].map(({d,r,t})=>{
                const pcs=triadPCs(r,t);
                const notes=pcs.map(pc=>spelling[pc]||"?").join("-");
                return(<button key={d} onClick={()=>playChord12TET(pcs)}
                  style={{background:degColorMap[r]||"#6b7280",color:"#fff",border:"none",borderRadius:6,
                    padding:"5px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {d}: {spelling[r]||"?"}{t==="minor"?"m":""}
                  <span style={{fontSize:10,opacity:.7,fontWeight:400,marginLeft:3}}>{notes}</span>
                </button>);
              })}
            </div>
            <div style={{marginTop:8,display:"flex",gap:3,flexWrap:"wrap"}}>
              {scale.map((pc,i)=>{
                const interval=(pc-root+12)%12;
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:3,background:"#111827",
                  borderRadius:5,padding:"3px 8px",borderLeft:`3px solid ${degColorMap[pc]}`}}>
                  <span style={{fontSize:11,color:degColorMap[pc],fontWeight:600,fontFamily:"monospace"}}>{INT_LBL[interval]}</span>
                  <span style={{fontSize:11,color:"#d1d5db"}}>{spelling[pc]}</span>
                </div>);
              })}
            </div>
          </div>
          {related.length>0&&(
            <div style={{flex:"0 1 320px",borderLeft:"1px solid #374151",paddingLeft:16,minWidth:200}}>
              <span style={{fontSize:11,color:"#6b7280"}}>Same notes as:</span>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                {related.map((rel,i)=>{
                  const rs=spellScale(rel.root,buildScale(rel.root,rel.iT,rel.ivT,rel.vT));
                  const rn=rs[rel.root]||ROOT_NAMES[rel.root];
                  const nm=SCALE_NAMES[sKey(rel.iT,rel.ivT,rel.vT)]||"?";
                  return(<button key={i} onClick={()=>{setRoot(rel.root);setIT(rel.iT);setIVT(rel.ivT);setVT(rel.vT);setCFreq(m2f(60+rel.root));}}
                    style={{...S.btn,fontSize:11,padding:"4px 8px",textAlign:"left"}}>
                    {rn} {nm}
                  </button>);
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {view==="fretboard"&&fretPanel}
      {view==="lattice"&&lattPanel}
      {view==="side"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>{fretPanel}</div>
          <div>{lattPanel}</div>
        </div>
      )}
    </div>
  );
}
