(function(){
'use strict';
/*PURE-START*/
const FILTERS=[
  {k:'pageNums',label:'Page numbers',d:'“12”, “Page 12 of 300”, roman numerals in margins'},
  {k:'headers',label:'Running headers and footers',d:'Titles repeated at the top or bottom of pages (PDF)'},
  {k:'notes',label:'Footnotes and citation numbers',d:'[12] markers, raised footnote digits, small print at the foot of a page'},
  {k:'links',label:'Web addresses and emails',d:'Long links that sound like noise when read aloud'},
  {k:'toc',label:'Table of contents',d:'Entries with dotted leaders and the contents page'},
  {k:'captions',label:'Figure and table captions',d:'Lines such as “Figure 2.1: …”'},
  {k:'back',label:'Index, references and end notes',d:'Everything after such a heading in the second half'}
];
const DEFAULT_ON={pageNums:true,headers:true,notes:true,links:true,toc:true,captions:false,back:true};
const REASON={pageNums:'page number',headers:'header/footer',notes:'footnote',links:'link',toc:'contents',captions:'caption',back:'back matter',empty:'empty'};

const RE_NUM_ONLY=/^[\s\-–—•·.()\[\]]*\d{1,5}[\s\-–—•·.()\[\]]*$/;
const RE_PAGE_WORD=/^(?:page|pg\.?|p\.)\s*\d{1,5}(?:\s*(?:of|\/)\s*\d{1,5})?$/i;
const RE_N_OF_M=/^\d{1,5}\s*(?:of|\/)\s*\d{1,5}$/i;
const RE_ROMAN=/^(?=[ivxlcdm]+$)m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/i;
const ROMAN_WORDS=/^(did|mix|mid|dim|lid|mild|civil|dill|mill|dull|lil|mimic|vivid)$/;
function isPageNumberText(t,furn){
  t=(t||'').trim();
  if(!t||t.length>24)return false;
  if(RE_NUM_ONLY.test(t)||RE_PAGE_WORD.test(t)||RE_N_OF_M.test(t))return true;
  if(RE_ROMAN.test(t)){
    if(furn)return true;
    if(t===t.toLowerCase()&&t.length>=2&&t.length<=6&&!ROMAN_WORDS.test(t))return true;
  }
  return false;
}
const normKey=s=>(s||'').toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').trim();
const looksLikeTocEntry=t=>/(?:\.\s?){4,}\s*\d{1,4}/.test(t);
const RE_CAPTION=/^(?:figure|fig\.|table|chart|exhibit|plate|map|photo|image|illustration)\s+[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?\s*[.:)\-–—]/i;
const isCaption=t=>t.length<260&&RE_CAPTION.test(t.trim());
const RE_CITE=/\s?\[(?:\d{1,3}(?:\s*[,–\-]\s*\d{1,3})*)\]/g;
const RE_SUP=/[²³¹⁰-⁹]+/g;
const RE_GLUED=/([A-Za-z”"’)])([.!?])(\d{1,3})(?=\s|$)/g;
const ABBR=/^(fig|figs|no|nos|vol|ch|sec|eq|ref|art|ed|pp|p|pt|ca|cf|esp|al)$/i;
const RE_URL=/\b(?:https?:\/\/|www\.)[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi;
const RE_EMAIL=/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const RE_BACK=/^(?:index|bibliography|references|works cited|endnotes|notes|glossary)\.?$/i;
const RE_CONTENTS=/^(?:table of )?contents\.?$/i;
const RE_HEADWORD=/^(?:chapter|part|book|section)\s+(?:[0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[^\n]{0,70}$/i;
const RE_HEADSOLO=/^(?:prologue|epilogue|preface|foreword|introduction|afterword|contents|table of contents|acknowledg(?:e)?ments|index|bibliography|references|endnotes|glossary|appendix(?:\s+[a-z0-9]+)?)\.?$/i;
function headingLevelOfText(t){
  t=(t||'').trim();
  if(!t||t.length>90)return 0;
  if(RE_HEADWORD.test(t))return 1;
  if(RE_HEADSOLO.test(t))return 2;
  return 0;
}

function normText(s){
  return (s||'').replace(/­/g,'').replace(/ﬀ/g,'ff').replace(/ﬁ/g,'fi').replace(/ﬂ/g,'fl')
    .replace(/ﬃ/g,'ffi').replace(/ﬄ/g,'ffl').replace(/[   ]/g,' ').replace(/\s+/g,' ').trim();
}
function joinLines(prev,next){
  if(!prev)return next;
  if(/[A-Za-z]-$/.test(prev)&&/^[a-z]/.test(next))return prev.slice(0,-1)+next;
  return prev+' '+next;
}
function stripNoteMarks(t){
  return t.replace(RE_CITE,'').replace(RE_SUP,'').replace(RE_GLUED,(m,pre,p,d,off,str)=>{
    const w=(str.slice(0,off+1).match(/([A-Za-z]+)$/)||[])[1]||'';
    if(p==='.'&&ABBR.test(w))return m;
    return pre+p;
  });
}
function stripLinks(t){return t.replace(RE_URL,'').replace(RE_EMAIL,'');}
function tidy(t){
  return t.replace(/\(\s*\)/g,'').replace(/\s+([.,;:!?])/g,'$1').replace(/\(\s+/g,'(').replace(/\s+\)/g,')').replace(/\s{2,}/g,' ').trim();
}

function buildUnits(raw,opts){
  const out=[],stats={};
  const bump=k=>{stats[k]=(stats[k]||0)+1;};
  const n=raw.length;
  let backFrom=-1,tocMode=false;
  if(opts.back){
    for(let i=Math.floor(n*0.5);i<n;i++){
      const b=raw[i];
      if(b.t==='h'&&RE_BACK.test(b.text.trim())){backFrom=i;break;}
    }
  }
  for(let i=0;i<n;i++){
    const b=raw[i];let skip=null,text=b.text;
    if(backFrom>=0&&i>=backFrom)skip='back';
    else if(b.t==='h'&&opts.toc&&RE_CONTENTS.test(text.trim())){tocMode=true;skip='toc';}
    else if(b.t==='h')tocMode=false;
    if(!skip&&tocMode&&b.t!=='h'&&opts.toc)skip='toc';
    if(!skip&&opts.pageNums&&isPageNumberText(text,!!b.furn))skip='pageNums';
    if(!skip&&opts.headers&&b.furn&&b.rep)skip='headers';
    if(!skip&&opts.notes&&b.fn)skip='notes';
    if(!skip&&opts.toc&&looksLikeTocEntry(text))skip='toc';
    if(!skip&&opts.captions&&(b.cap||isCaption(text)))skip='captions';
    if(!skip){
      let c=text;
      if(opts.notes)c=stripNoteMarks(c);
      if(opts.links)c=stripLinks(c);
      c=tidy(c);
      if(!/[\p{L}\p{N}]/u.test(c))skip='empty';else text=c;
    }
    if(skip)bump(skip);
    out.push({t:b.t,lvl:b.lvl||0,page:b.page||0,raw:b.text,text:skip?b.text:text,skip});
  }
  return {units:out,stats};
}

let SEG=null;
try{SEG=new Intl.Segmenter('en-u-ss-standard',{granularity:'sentence'});}catch(e){try{SEG=new Intl.Segmenter('en',{granularity:'sentence'});}catch(e2){SEG=null;}}
function splitSentences(text,useSeg){
  let parts;
  if(SEG&&useSeg!==false)parts=Array.from(SEG.segment(text),s=>s.segment);
  else parts=text.match(/[^.!?]+(?:[.!?]+["'”’)\]]*\s*|$)/g)||[text];
  const AB=/(?:^|\s)(?:mr|mrs|ms|dr|prof|sr|jr|st|mt|vs|etc|no|fig|vol|inc|ltd|co|gen|col|lt|capt|sgt|rev|hon|e\.g|i\.e|u\.s|a\.m|p\.m)\.$/i;
  const merged=[];
  for(const p of parts){
    const last=merged[merged.length-1];
    if(last!==undefined&&AB.test(last.trim()))merged[merged.length-1]=last+p;else merged.push(p);
  }
  parts=merged;
  const res=[];
  for(let p of parts){
    p=p.trim();
    if(!p)continue;
    while(p.length>170){
      let cut=-1;
      const re=/[,;:—–]\s/g;let m;
      while((m=re.exec(p))&&m.index<150)cut=m.index+1;
      if(cut<50){cut=p.lastIndexOf(' ',150);if(cut<50)cut=150;}
      res.push(p.slice(0,cut).trim());
      p=p.slice(cut).trim();
    }
    if(p)res.push(p);
  }
  return res;
}
function countWords(s){const m=s.match(/\S+/g);return m?m.length:0;}

function makeSentences(units){
  const sents=[];
  units.forEach((u,bi)=>{
    u.s0=sents.length;
    if(!u.skip){
      const list=u.t==='h'?[u.text]:splitSentences(u.text);
      for(const t of list){
        sents.push({text:t,say:u.t==='h'?t.replace(/[.:;,!?]*$/,'.'):t,b:bi,w:countWords(t)});
      }
    }
    u.s1=sents.length;
  });
  return sents;
}
function makeSections(units,sents){
  const secs=[];let cur=null;
  const open=(title,bi)=>{cur={title,b0:bi,b1:bi,s0:-1,s1:-1,n:0};secs.push(cur);};
  units.forEach((u,bi)=>{
    const spoken=!u.skip;
    const isHead=u.t==='h'&&u.lvl<=2&&spoken;
    if(!cur||(isHead&&cur.n>0)||(cur.b1-cur.b0>=60&&spoken))open(isHead?u.text:null,bi);
    if(isHead&&!cur.title)cur.title=u.text;
    cur.b1=bi+1;
    if(spoken){cur.n++;if(cur.s0<0)cur.s0=u.s0;cur.s1=u.s1;}
  });
  let part=0;
  secs.forEach(s=>{s.silent=s.n===0;if(!s.title)s.title=s.silent?'Skipped material':'Part '+(++part);});
  return secs;
}
function fmtLeft(mins){
  if(mins<1)return 'under a minute left';
  const t=Math.round(mins),h=Math.floor(t/60),m=t%60;
  return 'about '+(h?h+' h':'')+((m||!h)?(h?' ':'')+m+' min':'')+' left';
}
/*PURE-END*/
/* ---------- Loaders: every reader returns {raw:[blocks], meta:{...}} ---------- */
const tick=()=>new Promise(r=>setTimeout(r,0));

function blocksFromDom(root){
  const out=[];
  const BLOCKY='p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,section,li,pre,figure,aside,dl';
  const push=o=>{o.text=normText(o.text);if(o.text)out.push(o);};
  const clean=el=>{
    const c=el.cloneNode(true);
    c.querySelectorAll('script,style,rt,[epub\\:type~="pagebreak"],[role="doc-pagebreak"]').forEach(n=>n.remove());
    c.querySelectorAll('sup').forEach(s=>{
      const txt=s.textContent.trim().replace(/[\[\]()]/g,'');
      if((s.querySelector('a')||/^[\d*†‡]{1,3}$/.test(txt))&&/^[\d*†‡a-z]{1,3}$/i.test(txt))s.replaceWith('['+txt+']');
    });
    c.querySelectorAll('br').forEach(b=>b.replaceWith(' '));
    return c;
  };
  const textOf=(el,drop)=>{const k=clean(el);if(drop)k.querySelectorAll(drop).forEach(n=>n.remove());return k.textContent;};
  const walk=node=>{
    for(const c of node.children){
      const tag=c.tagName.toLowerCase();
      const ty=(c.getAttribute('epub:type')||'')+' '+(c.getAttribute('role')||'');
      if(/^(script|style|svg|noscript|nav|head|template|img|hr)$/.test(tag))continue;
      if(/pagebreak/.test(ty))continue;
      if(/footnote|endnote/.test(ty)||/^(footnote|endnote)-\d/.test(c.id||'')){push({t:'p',text:textOf(c),fn:true});continue;}
      if(/^h[1-6]$/.test(tag)){push({t:'h',lvl:Math.min(+tag[1],3),text:textOf(c)});continue;}
      if(tag==='table'){
        c.querySelectorAll('tr').forEach(tr=>{
          const cells=[...tr.children].map(td=>normText(td.textContent)).filter(Boolean);
          if(cells.length)push({t:'p',text:cells.join(', ')});
        });
        continue;
      }
      if(tag==='li'){
        if(c.querySelector(':scope > p, :scope > div, :scope > blockquote'))walk(c);
        else{
          push({t:'p',text:textOf(c,'ul,ol')});
          c.querySelectorAll(':scope > ul, :scope > ol').forEach(l=>walk({children:[l]}));
        }
        continue;
      }
      if(tag==='figcaption'||tag==='caption'){push({t:'p',text:textOf(c),cap:true});continue;}
      if(c.querySelector(BLOCKY)){walk(c);continue;}
      push({t:'p',text:textOf(c)});
    }
  };
  walk(root);
  return out;
}

function stampHeadings(raw){
  for(const b of raw){
    if(b.t==='p'){const l=headingLevelOfText(b.text);if(l&&b.text.length<90){b.t='h';b.lvl=l;}}
  }
  return raw;
}

async function readHtml(file){
  const doc=new DOMParser().parseFromString(await file.text(),'text/html');
  const raw=stampHeadings(blocksFromDom(doc.body));
  return {raw,meta:{format:'HTML',title:(doc.title||'').trim()}};
}

async function readDocx(file){
  if(!window.mammoth)throw new Error('The Word reader did not load. Check your connection and reload the page.');
  const res=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
  const doc=new DOMParser().parseFromString(res.value,'text/html');
  return {raw:stampHeadings(blocksFromDom(doc.body)),meta:{format:'Word'}};
}

function resolvePath(base,href){
  const u=new URL(href.split('#')[0],'http://epub.local/'+base);
  return decodeURIComponent(u.pathname.slice(1));
}
async function readEpub(file){
  if(!window.JSZip)throw new Error('The EPUB reader did not load. Check your connection and reload the page.');
  const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
  const read=async p=>{const f=zip.file(p)||zip.file(decodeURIComponent(p));return f?f.async('string'):null;};
  const cont=await read('META-INF/container.xml');
  if(!cont)throw new Error('This EPUB is missing its container file, so it cannot be opened.');
  const opfPath=new DOMParser().parseFromString(cont,'application/xml').querySelector('rootfile')?.getAttribute('full-path');
  const opfText=opfPath&&await read(opfPath);
  if(!opfText)throw new Error('This EPUB is missing its package file, so it cannot be opened.');
  const odoc=new DOMParser().parseFromString(opfText,'application/xml');
  const base=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'';
  const man={};
  odoc.querySelectorAll('manifest > item').forEach(i=>{man[i.getAttribute('id')]={href:i.getAttribute('href'),type:i.getAttribute('media-type')||'',props:i.getAttribute('properties')||''};});
  const tEl=odoc.getElementsByTagName('dc:title')[0]||odoc.querySelector('metadata > title');
  const items=[...odoc.querySelectorAll('spine > itemref')].filter(r=>r.getAttribute('linear')!=='no').map(r=>man[r.getAttribute('idref')]).filter(m=>m&&/html|xml/.test(m.type)&&!/\bnav\b/.test(m.props));
  const raw=[];
  for(let i=0;i<items.length;i++){
    const txt=await read(resolvePath(base,items[i].href));
    if(txt){
      const doc=new DOMParser().parseFromString(txt,'text/html');
      raw.push(...blocksFromDom(doc.body));
    }
    if(i%4===0){setStatus('Reading section '+(i+1)+' of '+items.length+'…',true);await tick();}
  }
  return {raw:stampHeadings(raw),meta:{format:'EPUB',title:tEl?tEl.textContent.trim():''}};
}

async function readText(file,md){
  let txt=(await file.text()).replace(/\r\n?/g,'\n');
  const m1=txt.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i);
  if(m1)txt=txt.slice(m1.index+m1[0].length);
  const m2=txt.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if(m2>0)txt=txt.slice(0,m2);
  if(md){
    txt=txt.replace(/```[\s\S]*?```/g,'\n\n').replace(/\n(?=\s*(?:[-*+]|\d+\.)\s)/g,'\n\n');
  }
  const lines=txt.split('\n');
  const blanks=lines.filter(l=>!l.trim()).length;
  let paras=[];
  if(blanks>=lines.length*0.03){
    paras=txt.split(/\n\s*\n/).map(p=>p.split('\n').map(l=>l.trim()).filter(Boolean));
  }else{
    const body=lines.map(l=>l.trim()).filter(Boolean);
    const maxLen=Math.max(...body.map(l=>l.length),1);
    const avg=body.reduce((a,l)=>a+l.length,0)/(body.length||1);
    if(avg>=100)paras=body.map(l=>[l]);
    else{
      let cur=[];
      for(const l of body){
        cur.push(l);
        if(/[.!?"”’)]$/.test(l)&&l.length<maxLen*0.75){paras.push(cur);cur=[];}
      }
      if(cur.length)paras.push(cur);
    }
  }
  const raw=[];
  for(const ls of paras){
    let buf='';
    const flush=()=>{if(buf){raw.push({t:'p',text:buf});buf='';}};
    for(let l of ls){
      if(md){
        const h=l.match(/^(#{1,6})\s+(.*)$/);
        if(h){flush();raw.push({t:'h',lvl:Math.min(h[1].length,3),text:h[2]});continue;}
        l=l.replace(/^(?:[-*+]|\d+\.)\s+/,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
          .replace(/(\*\*|__)(.*?)\1/g,'$2').replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g,'$1$2').replace(/`([^`]+)`/g,'$1');
      }
      if(isPageNumberText(l,false)&&/\d/.test(l)){flush();raw.push({t:'p',text:l});continue;}
      buf=joinLines(buf,l);
    }
    flush();
  }
  for(const b of raw){
    if(b.t!=='p')continue;
    b.text=normText(b.text);
    let l=headingLevelOfText(b.text);
    if(!l&&b.text.length<=70&&!/[.!?]$/.test(b.text)&&(b.text.match(/\p{L}/gu)||[]).length>=3&&b.text===b.text.toUpperCase()&&/\p{Lu}/u.test(b.text))l=2;
    if(l){b.t='h';b.lvl=l;}
  }
  return {raw:raw.filter(b=>b.text),meta:{format:md?'Markdown':'Text'}};
}

/* PDF: rebuild lines and paragraphs from positioned text, tag margins and small print */
function pageLines(tc,view){
  const [,y0,,y1]=view;const H=(y1-y0)||1;
  const lines=[];let cur=null,prev=null;
  for(const it of tc.items){
    if(typeof it.str!=='string')continue;
    const fs=Math.abs(it.height)||Math.hypot(it.transform[2],it.transform[3])||10;
    const x=it.transform[4],y=it.transform[5];
    if(!it.str.trim()&&!cur)continue;
    if(cur&&Math.abs(y-cur.y)<=Math.max(2,fs*0.45)){
      const gap=x-(prev.x+prev.w);
      if(gap>fs*0.15&&!/\s$/.test(cur.text)&&!/^\s/.test(it.str))cur.text+=' ';
      cur.text+=it.str;cur.fs=Math.max(cur.fs,fs);
    }else{
      cur={text:it.str,x,y,fs,tf:(y1-y)/H};lines.push(cur);
    }
    prev={x,w:it.width||0};
  }
  for(const l of lines)l.text=normText(l.text);
  return lines.filter(l=>l.text);
}

function paragraphsOfPage(lines,leftX,medFs,pageNo){
  const paras=[];let cur=null,prev=null;
  const close=()=>{cur=null;prev=null;};
  for(const l of lines){
    const furn=l.tf<0.075?'top':l.tf>0.925?'bottom':null;
    if(furn){paras.push({t:'p',text:l.text,furn,fs:l.fs,tf:l.tf,page:pageNo,lines:1});close();continue;}
    let brk=!cur;
    if(cur){
      const gap=prev.y-l.y;
      if(gap<0||gap>prev.fs*1.7)brk=true;
      else if(Math.abs(l.fs-prev.fs)>prev.fs*0.15)brk=true;
      else if(l.x-leftX>prev.fs*0.9&&/[.!?”"’)]$/.test(prev.text))brk=true;
    }
    if(brk){cur={t:'p',text:l.text,fs:l.fs,tf:l.tf,page:pageNo,lines:1,small:l.fs<medFs*0.86};paras.push(cur);}
    else{cur.text=joinLines(cur.text,l.text);cur.lines++;cur.fs=Math.max(cur.fs,l.fs);if(l.fs>=medFs*0.86)cur.small=false;}
    prev=l;
  }
  return paras;
}

async function readPdf(file){
  if(!window.pdfjsLib)throw new Error('The PDF reader did not load. Check your connection and reload the page.');
  const lib=window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc=new URL('vendor/pdf.worker.min.js',location.href).href;
  const buf=await file.arrayBuffer();
  const open=()=>lib.getDocument({data:buf.slice(0)}).promise;
  let pdf;
  try{pdf=await open();}
  catch(e){
    if(e&&e.name==='PasswordException')throw new Error('This PDF is password-protected. Remove the password and try again.');
    await new Promise((res,rej)=>{const s=document.createElement('script');s.src=lib.GlobalWorkerOptions.workerSrc;s.onload=res;s.onerror=()=>rej(new Error('The PDF engine could not start.'));document.head.append(s);});
    pdf=await open();
  }
  const pages=[];let chars=0;
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    const lines=pageLines(tc,page.view);
    for(const l of lines)chars+=l.text.length;
    pages.push(lines);
    if(page.cleanup)page.cleanup();
    if(p%4===0){setStatus('Reading page '+p+' of '+pdf.numPages+'…',true);await tick();}
  }
  if(chars<20*pdf.numPages)throw new Error('This PDF has no selectable text. It looks like a scan, so it needs OCR before it can be read aloud.');
  const sizes=[];const xs={};
  for(const ls of pages)for(const l of ls){
    if(l.tf>=0.075&&l.tf<=0.925){
      for(let k=0;k<Math.min(l.text.length,40);k+=10)sizes.push(l.fs);
      const rx=Math.round(l.x/3)*3;xs[rx]=(xs[rx]||0)+1;
    }
  }
  sizes.sort((a,b)=>a-b);
  const medFs=sizes[Math.floor(sizes.length/2)]||10;
  const leftX=+Object.keys(xs).sort((a,b)=>xs[b]-xs[a])[0]||0;
  const pp=pages.map((ls,i)=>paragraphsOfPage(ls,leftX,medFs,i+1));
  const seen={};
  pp.forEach((paras,i)=>paras.forEach(p=>{
    if(p.furn){const k=normKey(p.text);(seen[k]=seen[k]||new Set()).add(i);}
  }));
  const need=pdf.numPages<6?2:3;
  for(const paras of pp)for(const p of paras){
    if(p.furn)p.rep=seen[normKey(p.text)].size>=need;
    else if(p.small&&p.tf>0.55)p.fn=true;
    if(!p.furn&&!p.fn){
      if(p.fs>=medFs*1.18&&p.text.length<=140&&p.lines<=3){p.t='h';p.lvl=p.fs>=medFs*1.55?1:2;}
      else{const l=p.lines<=2?headingLevelOfText(p.text):0;if(l){p.t='h';p.lvl=l;}}
    }
  }
  for(let i=0;i+1<pp.length;i++){
    const body=a=>a.filter(p=>!p.furn&&!p.fn);
    const a=body(pp[i]),b=body(pp[i+1]);
    const last=a[a.length-1],first=b[0];
    if(last&&first&&last.t==='p'&&first.t==='p'&&!/[.!?:;”"’)\]]$/.test(last.text.trim())&&/^[a-z]/.test(first.text)){
      last.text=joinLines(last.text,first.text);
      pp[i+1]=pp[i+1].filter(p=>p!==first);
    }
  }
  const raw=[];
  for(const paras of pp)for(const p of paras)raw.push({t:p.t,lvl:p.lvl||0,text:p.text,furn:p.furn||null,rep:!!p.rep,fn:!!p.fn,page:p.page});
  let title='';
  try{const md=await pdf.getMetadata();title=(md.info&&md.info.Title||'').trim();}catch(e){}
  return {raw,meta:{format:'PDF',pages:pdf.numPages,title}};
}
/* ---------- App state, settings, sample ---------- */
const $=id=>document.getElementById(id);
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
const synth=window.speechSynthesis;
const WPM=155;
const SAMPLE=[
  {t:'h',lvl:1,text:'Chapter 1: The Keeper’s Log'},
  {t:'p',text:'The lamp room was quiet at dusk, and Marta climbed the last of the iron stairs with the oil can in one hand. Fog was already moving in from the point[1], flattening the horizon into a single grey line.'},
  {t:'p',text:'Her father had kept this light for thirty years. He wrote in the same green ledger every evening, noting the weather, the passing ships, and the hour the lamp was lit (scans at www.example.org/keepers-log).'},
  {t:'p',text:'Table 1. Lamp hours by month'},
  {t:'p',text:'The Keeper’s Log',furn:'top',rep:true},
  {t:'p',text:'14',furn:'bottom'},
  {t:'p',text:'She trimmed the wick, wound the clockwork, and watched the great lens begin its slow turn. Out on the water a single bell answered, then another.'},
  {t:'p',text:'1 Point Marden, a headland on the northern coast.',fn:true},
  {t:'h',lvl:1,text:'Chapter 2: Weather'},
  {t:'p',text:'By midnight the wind had settled into the west, and the fog thinned enough to show the lights of the ferry. Marta wrote the hour in the ledger, then the word “clear,” and sat down to wait for morning.'},
  {t:'h',lvl:2,text:'Notes'},
  {t:'p',text:'Lamp hours are approximate and were recorded by hand.'}
];
const S={
  raw:[],units:[],sents:[],secs:[],cum:[],stats:{},idx:0,secIdx:0,playing:false,gen:0,
  name:'',key:'',isSample:true,showSkipped:true,opts:Object.assign({},DEFAULT_ON),
  voiceName:'',rate:0.95,pitch:1,vol:1,allLangs:false,sleepAt:0,
  engine:'natural',natVoice:'af_heart',natGpu:false
};
let utter=null,wake=null,saveCount=0;

function loadSettings(){
  try{
    const o=JSON.parse(localStorage.getItem('qr.settings')||'{}');
    if(o.opts)Object.assign(S.opts,o.opts);
    for(const k of ['voiceName','rate','pitch','vol','allLangs','engine','natVoice','natGpu'])if(o[k]!==undefined)S[k]=o[k];
  }catch(e){}
}
function saveSettings(){
  try{localStorage.setItem('qr.settings',JSON.stringify({opts:S.opts,voiceName:S.voiceName,rate:S.rate,pitch:S.pitch,vol:S.vol,allLangs:S.allLangs,engine:S.engine,natVoice:S.natVoice,natGpu:S.natGpu}));}catch(e){}
}
const hashStr=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36);};
function savePos(){
  if(S.isSample||!S.key||!S.sents.length)return;
  try{localStorage.setItem('qr.pos.'+S.key,JSON.stringify({b:S.sents[S.idx].b,pct:S.idx/S.sents.length,t:Date.now()}));}catch(e){}
}
function readPos(key){try{return JSON.parse(localStorage.getItem('qr.pos.'+key)||'null');}catch(e){return null;}}

function setStatus(msg,busy,err){
  const s=$('status');s.textContent=msg||'';s.className=err?'err':'';
}

/* ---------- Voices ---------- */
const SOFT=[/aria/i,/jenny/i,/\bava\b/i,/samantha/i,/allison/i,/zoe/i,/serena/i,/susan/i,/karen/i,/moira/i,/tessa/i,/fiona/i,/libby/i,/sonia/i,/michelle/i,/emma/i,/hazel/i,/zira/i,/catherine/i,/female/i];
const MALE=/\b(david|mark|alex|daniel|fred|george|guy|james|ryan|thomas|oliver|rishi|aaron|arthur|gordon|ralph|junior|eddy|reed|rocko|sandy|shelley|flo|male)\b/i;
function voiceScore(v){
  const n=v.name+' '+(v.voiceURI||'');
  let s=0;
  if(/natural|online|neural|premium|enhanced/i.test(n))s+=40;
  const i=SOFT.findIndex(r=>r.test(n));
  if(i>=0)s+=30+(SOFT.length-i);
  if(/^en[-_](US|GB|AU|IE)/i.test(v.lang))s+=8;
  if(MALE.test(v.name)&&!/female/i.test(v.name))s-=60;
  return s;
}
function buildVoiceList(){
  const all=synth?synth.getVoices():[];
  const base=(navigator.language||'en').slice(0,2).toLowerCase();
  let list=S.allLangs?all.slice():all.filter(v=>(v.lang||'').toLowerCase().startsWith(base));
  if(!list.length)list=all.slice();
  list=list.map(v=>({v,s:voiceScore(v)})).sort((a,b)=>b.s-a.s||a.v.name.localeCompare(b.v.name));
  const sel=$('voice');sel.replaceChildren();
  if(!list.length){sel.append(new Option('No voices found on this device',''));return;}
  list.forEach(({v,s})=>{sel.append(new Option(v.name+(s>=60?' (soft pick)':'')+' · '+v.lang,v.name));});
  const names=list.map(x=>x.v.name);
  if(!names.includes(S.voiceName))S.voiceName=names[0];
  sel.value=S.voiceName;
}
function currentVoice(){
  const all=synth?synth.getVoices():[];
  return all.find(v=>v.name===S.voiceName)||null;
}

/* ---------- Building and rendering ---------- */
function rebuild(keepBlock){
  const wasBlock=keepBlock!=null?keepBlock:(S.sents[S.idx]?S.sents[S.idx].b:0);
  const r=buildUnits(S.raw,S.opts);
  S.units=r.units;S.stats=r.stats;
  S.sents=makeSentences(S.units);
  S.secs=makeSections(S.units,S.sents);
  let tot=0;S.cum=new Float64Array(S.sents.length+1);
  S.sents.forEach((s,i)=>{S.cum[i]=tot;tot+=s.w;});S.cum[S.sents.length]=tot;
  let k=S.sents.findIndex(s=>s.b>=wasBlock);
  if(k<0)k=Math.max(0,S.sents.length-1);
  S.idx=k;
  renderCounts();renderToc();renderMeta();
  showSection(secOf(S.idx),true);
  updateProgress();
}
function secOf(i){
  const s=S.sents[i];if(!s)return 0;
  for(let k=0;k<S.secs.length;k++)if(s.b>=S.secs[k].b0&&s.b<S.secs[k].b1)return k;
  return 0;
}
function renderCounts(){
  document.querySelectorAll('[data-count]').forEach(n=>{n.textContent=S.stats[n.dataset.count]||0;});
}
function renderMeta(){
  const words=S.cum.length?S.cum[S.cum.length-1]:0;
  const skipped=S.units.filter(u=>u.skip).length;
  const mins=words/WPM;
  const parts=[];
  if(S.meta&&S.meta.format)parts.push(S.meta.format);
  if(S.meta&&S.meta.pages)parts.push(S.meta.pages+' pages');
  parts.push(Math.round(words).toLocaleString()+' words');
  parts.push(fmtLeft(mins/S.rate).replace('about ','about ').replace(' left',' to listen'));
  if(skipped)parts.push(skipped.toLocaleString()+' skipped');
  $('docMeta').textContent=parts.join(' · ');
}
function renderToc(){
  const ol=$('toc');ol.replaceChildren();
  const heads=[];
  S.units.forEach((u,bi)=>{if(u.t==='h'&&u.lvl<=2&&!u.skip&&heads.length<300)heads.push({text:u.text,s:u.s0});});
  if(!heads.length){const li=el('li','empty','No chapter headings were found.');ol.append(li);return;}
  heads.forEach(h=>{
    const li=el('li');const b=el('button',null,h.text);b.type='button';b.dataset.s=h.s;
    b.addEventListener('click',()=>jumpTo(+b.dataset.s,true));
    li.append(b);ol.append(li);
  });
}
function markToc(){
  const secStart=S.secs[S.secIdx];let best=null;
  document.querySelectorAll('#toc button').forEach(b=>{b.removeAttribute('aria-current');if(+b.dataset.s<=S.idx)best=b;});
  if(best)best.setAttribute('aria-current','true');
}
function showSection(si,force){
  si=Math.max(0,Math.min(S.secs.length-1,si));
  if(!force&&si===S.secIdx&&$('reader').childElementCount)return;
  S.secIdx=si;
  const sec=S.secs[si];const frag=document.createDocumentFragment();
  if(!sec){$('reader').replaceChildren(el('p','endnote','Nothing to read in this file.'));return;}
  for(let bi=sec.b0;bi<sec.b1;bi++){
    const u=S.units[bi];
    if(u.skip){
      if(!S.showSkipped)continue;
      const d=el('div','skipped');d.append(el('span','why',REASON[u.skip]||u.skip),document.createTextNode(u.raw));frag.append(d);continue;
    }
    const node=u.t==='h'?el('h3','hd h'+Math.min(u.lvl||2,3)):el('p');
    for(let k=u.s0;k<u.s1;k++){
      const sp=el('span','s',S.sents[k].text);sp.dataset.i=k;node.append(sp,' ');
    }
    frag.append(node);
  }
  if(!frag.childNodes.length)frag.append(el('p','endnote','This section is entirely skipped. Turn on “Show skipped text” to see it.'));
  $('reader').replaceChildren(frag);
  const n=S.secs.length;
  $('secLabel').textContent=sec.title+' · '+(si+1)+' of '+n;
  $('secPrev').disabled=si<=0;$('secNext').disabled=si>=n-1;$('secNext2').disabled=si>=n-1;
  markCurrent(false);
}
function markCurrent(scroll){
  const old=$('reader').querySelector('.s.cur');if(old)old.classList.remove('cur');
  const sp=$('reader').querySelector('.s[data-i="'+S.idx+'"]');
  if(sp){
    sp.classList.add('cur');
    if(scroll){
      const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sp.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'});
    }
  }
  markToc();
}
function updateProgress(){
  const n=S.sents.length;
  if(!n){$('plLabel').textContent='';return;}
  $('seek').value=Math.round(S.idx/Math.max(1,n-1)*1000);
  const left=(S.cum[n]-S.cum[S.idx])/(WPM*S.rate);
  $('plLabel').textContent='Section '+(S.secIdx+1)+' of '+S.secs.length+' · '+Math.round(S.idx/Math.max(1,n-1)*100)+'% · '+fmtLeft(left);
}
/* ---------- Natural voices (Kokoro in a worker) ---------- */
const NAT_VOICES=[
  {id:'af_heart',name:'Heart',d:'Warm and clear, American'},
  {id:'af_nicole',name:'Nicole',d:'Softest, close and calm'},
  {id:'af_bella',name:'Bella',d:'Bright and lively, American'},
  {id:'bf_emma',name:'Emma',d:'Gentle, British'}
];
const HF_MODEL='https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/';
const LOOKAHEAD_SECS=900, CACHE_CAP=160*1024*1024;
const N={worker:null,state:'none',mode:'wasm',cache:new Map(),bytes:0,inflight:null,waiting:false,rtf:0,hearKey:null};
const audio=new Audio();audio.preload='auto';
const hearAudio=new Audio();
let silentUrl='';

function silentWav(){
  const n=2400,b=new ArrayBuffer(44+n*2),v=new DataView(b);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,24000,true);v.setUint32(28,48000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
}
const eng=()=>S.engine==='natural'&&N.state==='ready'?'natural':'device';
const natKey=i=>S.sents[i]?S.natVoice+'|'+S.sents[i].say:'';

async function natIsCached(){
  try{
    const c=await caches.open('transformers-cache');
    return !!(await c.match(HF_MODEL+'model_quantized.onnx')||await c.match(HF_MODEL+'model.onnx'));
  }catch(e){return false;}
}
function natStart(device){
  if(N.state==='loading'||N.state==='ready')return;
  N.mode=device||'wasm';N.state='loading';
  if(!N.worker){
    try{N.worker=new Worker('tts-worker.js',{type:'module'});}
    catch(e){natFail('This browser cannot run natural voices. Use a device voice instead.');return;}
    N.worker.onmessage=natMsg;
    N.worker.onerror=()=>natFail('Natural voices stopped unexpectedly. Reload the page to try again.');
  }
  N.worker.postMessage({type:'init',device:N.mode});
  renderNat();
}
function natFail(msg){
  N.state='error';$('natMsg').textContent=msg;
  renderNat();
}
function natMsg(e){
  const m=e.data;
  if(m.type==='progress'){
    $('natBar').hidden=false;
    const pct=m.total?Math.min(100,m.loaded/m.total*100):0;
    $('natBarFill').style.width=pct.toFixed(1)+'%';
    $('natMsg').textContent='Downloading '+(m.loaded/1048576).toFixed(0)+' of '+(m.total/1048576).toFixed(0)+' MB. Keep this page open.';
  }else if(m.type==='ready'){
    N.state='ready';N.mode=m.mode;$('natBar').hidden=true;$('natMsg').textContent='';
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(err){}
    if(S.engine!=='natural'){S.engine='natural';saveSettings();}
    renderNat();checkOffline();natPump();
    if(S.playing){pause();speakFrom(S.idx);setStatus('Switched to the natural voice.');}
  }else if(m.type==='error'){
    if(m.mode==='webgpu'){N.state='none';S.natGpu=false;saveSettings();natStart('wasm');$('natMsg').textContent='The GPU version did not start here, so the standard version is loading instead.';return;}
    natFail(navigator.onLine?'The natural voices could not be downloaded. Check your connection and try again.':'You are offline. Connect once to download the natural voices.');
  }else if(m.type==='audio'||m.type==='genError'){
    const key=m.id;N.inflight=null;
    if(m.type==='audio'){
      const ent={url:URL.createObjectURL(m.blob),secs:m.secs,bytes:m.blob.size};
      if(N.cache.has(key))natDrop(key);
      N.cache.set(key,ent);N.bytes+=ent.bytes;
      const r=(m.ms/1000)/Math.max(.3,m.secs);
      N.rtf=N.rtf?N.rtf*0.7+r*0.3:r;
      renderSpeed();
    }else N.cache.set(key,{err:true,bytes:0});
    if(key===N.hearKey){N.hearKey=null;const h=N.cache.get(key);if(h&&h.url){hearAudio.src=h.url;hearAudio.playbackRate=S.rate;hearAudio.volume=S.vol;hearAudio.play().catch(()=>{});}}
    if(S.playing&&eng()==='natural'&&N.waiting&&key===natKey(S.idx))natPlayCurrent();
    natEvict();updateBuffer();natPump();
  }
}
function natDrop(key){const e=N.cache.get(key);if(!e)return;if(e.url)URL.revokeObjectURL(e.url);N.bytes-=e.bytes||0;N.cache.delete(key);}
function natEvict(){
  if(N.bytes<=CACHE_CAP)return;
  const keep=new Set();for(let i=Math.max(0,S.idx-3);i<Math.min(S.sents.length,S.idx+400);i++)keep.add(natKey(i));
  for(const k of [...N.cache.keys()]){if(N.bytes<=CACHE_CAP*0.8)break;if(!keep.has(k))natDrop(k);}
}
function natPump(){
  if(N.state!=='ready'||N.inflight||!N.worker||!S.sents.length)return;
  if(eng()!=='natural'&&!N.hearKey)return;
  if(N.bytes>CACHE_CAP)return;
  let ahead=0;
  for(let j=S.idx;j<S.sents.length;j++){
    const k=natKey(j),e=N.cache.get(k);
    if(!e){N.inflight=k;N.worker.postMessage({type:'gen',id:k,text:S.sents[j].say,voice:S.natVoice});return;}
    ahead+=e.secs||0;
    if(ahead/S.rate>LOOKAHEAD_SECS)return;
  }
}
function natPlayCurrent(){
  const e=N.cache.get(natKey(S.idx));
  if(!e){N.waiting=true;setWaiting(true);natPump();return;}
  N.waiting=false;setWaiting(false);
  if(e.err){natAdvance();return;}
  audio.src=e.url;audio.playbackRate=S.rate;audio.volume=S.vol;
  try{audio.preservesPitch=true;}catch(err){}
  audio.play().catch(err=>{if(S.playing&&err&&err.name==='NotAllowedError'){pause();setStatus('Tap play to continue.');}});
  natPump();
}
function natAdvance(){
  if(!S.playing)return;
  if(S.idx+1>=S.sents.length){finish();return;}
  S.idx++;afterMove(true);natPlayCurrent();
}
audio.addEventListener('ended',()=>{if(eng()==='natural'&&audio.src!==silentUrl)natAdvance();});
function setWaiting(on){
  $('play').classList.toggle('wait',on);
  if(on)$('plLabel').textContent='Preparing the voice…';else updateProgress();
}
function updateBuffer(){
  const n=S.sents.length;let j=S.idx;
  if(eng()==='natural')while(j<n&&N.cache.has(natKey(j)))j++;
  $('bufFill').style.width=(eng()==='natural'&&n?Math.min(100,j/Math.max(1,n-1)*100):0)+'%';
}
function renderSpeed(){
  if(!N.rtf){$('natSpeed').textContent='';return;}
  const x=1/N.rtf;
  const smooth=x>=S.rate*1.1;
  $('natSpeed').textContent=smooth
    ?'This device makes speech '+x.toFixed(1)+'× faster than it plays, so listening is smooth.'
    :'This device makes speech at '+x.toFixed(1)+'× playing speed, so expect short pauses.'+(gpuOffer()?' GPU mode below is usually several times faster.':' Pause for a minute to let it get ahead, or use a device voice.');
  $('gpuSwitch').hidden=!gpuOffer();
}
const gpuOffer=()=>('gpu' in navigator)&&N.state==='ready'&&N.mode!=='webgpu';
function switchToGpu(){
  if(!navigator.onLine){$('natMsg').textContent='Connect to the internet once to download GPU mode.';return;}
  const was=S.playing;if(was)pause();
  if(N.worker)N.worker.terminate();
  N.worker=null;N.state='none';N.inflight=null;N.waiting=false;N.rtf=0;
  for(const k of [...N.cache.keys()])natDrop(k);
  S.natGpu=true;saveSettings();
  $('gpuSwitch').hidden=true;$('natSpeed').textContent='';
  natStart('webgpu');
  $('natGet').hidden=false;$('natMsg').textContent='Setting up GPU mode. This is a one-time download of about 330 MB.';
}
function renderNat(){
  const ready=N.state==='ready',loading=N.state==='loading';
  $('natDownload').hidden=ready;
  $('natGet').hidden=ready;
  $('gpuSwitch').hidden=!gpuOffer()||!N.rtf||1/N.rtf>=S.rate*1.1;
  $('natDownload').disabled=loading;
  $('natDownload').textContent=loading?'Downloading…':(N.state==='error'?'Try again':'Download natural voices');
  $('gpuRow').hidden=!('gpu' in navigator)||loading||ready;
  $('natVoices').classList.toggle('locked',!ready);
  const nat=S.engine==='natural';
  $('engNatural').checked=nat;$('engDevice').checked=!nat;
  $('natBox').hidden=!nat;$('devBox').hidden=nat;
  updateBuffer();
}
function buildNatVoices(){
  const g=$('natVoices');g.replaceChildren();
  NAT_VOICES.forEach(v=>{
    const lab=el('label','vcard');const r=el('input');r.type='radio';r.name='natVoice';r.value=v.id;r.checked=S.natVoice===v.id;
    lab.append(r,el('b',null,v.name),el('small',null,v.d));
    r.addEventListener('change',()=>{S.natVoice=v.id;saveSettings();if(S.playing&&eng()==='natural'){audio.pause();natPlayCurrent();}else natPump();updateBuffer();});
    g.append(lab);
  });
}
function setEngine(eng){
  const was=S.playing;if(was)pause();
  S.engine=eng;saveSettings();renderNat();
  if(eng==='natural'&&N.state==='none'){natIsCached().then(c=>{if(c)natStart(S.natGpu?'webgpu':'wasm');});}
  natPump();updateBuffer();
  if(was)speakFrom(S.idx);
}

/* ---------- Shared playback ---------- */
function syncPlayUI(){
  $('icPlay').toggleAttribute('hidden',S.playing);$('icPause').toggleAttribute('hidden',!S.playing);
  $('play').setAttribute('aria-label',S.playing?'Pause':'Play');
  if(!S.playing)$('play').classList.remove('wait');
  if('mediaSession' in navigator)try{navigator.mediaSession.playbackState=S.playing?'playing':'paused';}catch(e){}
}
async function setWake(on){
  try{
    if(on&&navigator.wakeLock&&!wake){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});}
    else if(!on&&wake){await wake.release();wake=null;}
  }catch(e){wake=null;}
}
function afterMove(scroll){
  const sc=secOf(S.idx);
  if(sc!==S.secIdx){showSection(sc,true);updateMedia();}
  markCurrent(scroll);updateProgress();updateBuffer();
  if(++saveCount%5===0)savePos();
}
function speakFrom(i){
  if(!S.sents.length)return;
  S.idx=Math.max(0,Math.min(S.sents.length-1,i));
  S.playing=true;syncPlayUI();setWake(true);afterMove(true);
  if(eng()==='natural'){
    if(synth)synth.cancel();
    audio.pause();natPlayCurrent();
  }else{
    if(S.engine==='natural')setStatus(N.state==='loading'?'Using a device voice until the natural voices finish loading.':'Using a device voice. Download the natural voices to hear them.');
    devSpeak(false);
  }
}
function devSpeak(soft){
  if(!synth){setStatus('This browser has no speech engine. Try Chrome, Edge or Safari.',false,true);S.playing=false;syncPlayUI();return;}
  S.gen++;const g=S.gen;
  const go=()=>{
    if(g!==S.gen)return;
    const u=new SpeechSynthesisUtterance(S.sents[S.idx].say);
    const v=currentVoice();if(v){u.voice=v;u.lang=v.lang;}
    u.rate=S.rate;u.pitch=S.pitch;u.volume=S.vol;
    const next=()=>{if(g!==S.gen||!S.playing)return;if(S.idx+1>=S.sents.length){finish();return;}S.idx++;afterMove(true);devSpeak(true);};
    u.onend=next;
    u.onerror=e=>{if(g!==S.gen)return;if(e.error==='canceled'||e.error==='interrupted')return;next();};
    utter=u;synth.speak(u);
  };
  if(soft)go();else{synth.cancel();setTimeout(go,60);}
}
function pause(){
  S.gen++;S.playing=false;N.waiting=false;
  if(synth)synth.cancel();audio.pause();
  syncPlayUI();setWake(false);savePos();updateProgress();
}
function finish(){
  pause();S.idx=Math.max(0,S.sents.length-1);updateProgress();
  try{if(!S.isSample)localStorage.removeItem('qr.pos.'+S.key);}catch(e){}
  setStatus('Finished.');
}
function unlockAudio(){
  // iOS only lets audio start inside a tap, so play a moment of silence now.
  if(eng()!=='natural'||!silentUrl)return;
  try{audio.src=silentUrl;const p=audio.play();if(p)p.catch(()=>{});}catch(e){}
}
const toggle=()=>{if(!S.sents.length)return;if(S.playing)pause();else{unlockAudio();speakFrom(S.idx);}};
function jumpTo(i,play){
  if(!S.sents.length)return;
  i=Math.max(0,Math.min(S.sents.length-1,i));
  S.idx=i;showSection(secOf(i),true);afterMove(true);
  if(play||S.playing){if(play&&!S.playing)unlockAudio();speakFrom(i);}else{savePos();natPump();}
}
const step=d=>jumpTo(S.idx+d,S.playing);
function goSection(d){
  let k=S.secIdx+d;
  while(S.secs[k]&&S.secs[k].silent&&!S.showSkipped)k+=d;
  const sec=S.secs[k];if(!sec)return;
  if(sec.silent){showSection(k,true);return;}
  jumpTo(sec.s0,S.playing);
  $('reader').scrollIntoView({block:'start'});
}
let restartTimer=0;
function voiceChanged(){
  saveSettings();
  audio.playbackRate=S.rate;audio.volume=S.vol;hearAudio.playbackRate=S.rate;
  if(eng()==='natural'){renderSpeed();return;}
  clearTimeout(restartTimer);
  restartTimer=setTimeout(()=>{if(S.playing)speakFrom(S.idx);},250);
}
function updateMedia(){
  if(!('mediaSession' in navigator)||!window.MediaMetadata)return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:S.name||'Quiet Reader',artist:(S.secs[S.secIdx]&&S.secs[S.secIdx].title)||'',album:'Quiet Reader',
      artwork:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'}]
    });
  }catch(e){}
}
function setupMedia(){
  if(!('mediaSession' in navigator))return;
  const h={play:()=>{if(!S.playing)speakFrom(S.idx);},pause:()=>{if(S.playing)pause();},
    previoustrack:()=>step(-1),nexttrack:()=>step(1),seekbackward:()=>step(-1),seekforward:()=>step(1),stop:()=>pause()};
  for(const k in h)try{navigator.mediaSession.setActionHandler(k,h[k]);}catch(e){}
}
/* ---------- Opening documents ---------- */
function openDoc(raw,meta,name,key,isSample){
  pause();
  S.raw=raw;S.meta=meta;S.name=name;S.key=key;S.isSample=isSample;
  $('docTitle').textContent=name;$('sampleTag').hidden=!isSample;
  $('resume').hidden=true;
  rebuild(0);
  S.idx=0;showSection(0,true);updateProgress();updateMedia();natPump();
  if(!isSample){
    const p=readPos(key);
    if(p&&p.pct>0.02&&p.pct<0.98){
      $('resumeText').textContent='You stopped about '+Math.round(p.pct*100)+'% of the way through.';
      $('resume').hidden=false;
      $('resumeYes').onclick=()=>{const k=S.sents.findIndex(s=>s.b>=p.b);jumpTo(k<0?0:k,false);$('resume').hidden=true;};
      $('resumeNo').onclick=()=>{$('resume').hidden=true;};
    }
  }
}
function loadSample(){
  S.showSkipped=true;$('showSkipped').checked=true;
  openDoc(SAMPLE.map(b=>Object.assign({},b)),{format:'Sample'},'Sample chapter','',true);
  setStatus('This sample shows what gets skipped: the page number, the running header, the footnote and the web link. Open your own file above.');
}
async function loadFile(file){
  pause();
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  setStatus('Opening '+file.name+'…',true);
  $('pick').disabled=true;
  try{
    let r;
    if(ext==='pdf'||file.type==='application/pdf')r=await readPdf(file);
    else if(ext==='docx')r=await readDocx(file);
    else if(ext==='epub')r=await readEpub(file);
    else if(ext==='html'||ext==='htm')r=await readHtml(file);
    else if(ext==='md'||ext==='markdown')r=await readText(file,true);
    else if(ext==='txt'||(file.type||'').startsWith('text/'))r=await readText(file,false);
    else throw new Error('That file type is not supported. Try PDF, DOCX, EPUB, TXT, Markdown or HTML.');
    if(!r.raw.length)throw new Error('No readable text was found in this file.');
    const base=file.name.replace(/\.[^.]+$/,'');
    S.showSkipped=false;$('showSkipped').checked=false;
    const mt=(r.meta.title||'').replace(/^Microsoft (?:Word|PowerPoint) - /i,'').replace(/\.(?:docx?|pdf)$/i,'').trim();
    openDoc(r.raw,r.meta,(mt.length>2&&!/^(untitled|document\d*|title)$/i.test(mt)?mt:base),hashStr(file.name+'|'+file.size),false);
    setStatus('Ready. Press play, or tap any sentence to start there.');
  }catch(err){
    setStatus(err&&err.message?err.message:'That file could not be opened.',false,true);
  }finally{$('pick').disabled=false;}
}

/* ---------- Offline and install ---------- */
function setPill(kind,text){const p=$('offlinePill');p.className='pill '+kind;$('offlineText').textContent=text;}
function checkOffline(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:'){setPill('warn','Online only');return;}
  if(!navigator.serviceWorker.controller){setPill('warn','Saving for offline…');return;}
  if(!navigator.onLine){setPill('ok','Offline');return;}
  setPill('ok',N.state==='ready'||S.engine==='device'?'Works offline':'App works offline');
}
function setupOffline(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:'){checkOffline();return;}
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(()=>checkOffline()).catch(()=>setPill('warn','Online only'));
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    checkOffline();
    // First visit: reload once so the app runs with offline support and faster voice threads.
    let done=false;try{done=sessionStorage.getItem('qr.reloaded')==='1';}catch(e){}
    if(!hadController&&!done&&!self.crossOriginIsolated&&S.isSample&&!S.playing){
      try{sessionStorage.setItem('qr.reloaded','1');}catch(e){}
      location.reload();
    }
  });
  window.addEventListener('online',checkOffline);window.addEventListener('offline',checkOffline);
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('installBtn').hidden=false;});
  $('installBtn').addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();try{await deferred.userChoice;}catch(e){}deferred=null;$('installBtn').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;});
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  $('iosHelp').hidden=!(ios&&!standalone);
}

/* ---------- Wiring ---------- */
function applyRateUI(){
  $('rate').value=S.rate;$('rateOut').textContent=(Math.round(S.rate*100)/100)+'×';
  $('pitch').value=S.pitch;$('pitchOut').textContent=(Math.round(S.pitch*100)/100).toString();
  $('vol').value=S.vol;$('volOut').textContent=Math.round(S.vol*100)+'%';
  $('rateChip').textContent=(Math.round(S.rate*100)/100)+'×';
}
const PRESETS={soft:{rate:0.9,pitch:1,vol:0.9},natural:{rate:1,pitch:1,vol:1},brisk:{rate:1.2,pitch:1,vol:1}};
function init(){
  loadSettings();
  silentUrl=silentWav();
  const box=$('filters');
  FILTERS.forEach(f=>{
    const lab=el('label','chk');
    const cb=el('input');cb.type='checkbox';cb.id='f_'+f.k;cb.checked=!!S.opts[f.k];
    const txt=el('span');txt.append(el('b',null,f.label),el('small',null,f.d));
    const n=el('span','n','0');n.dataset.count=f.k;
    lab.append(cb,txt,n);box.append(lab);
    cb.addEventListener('change',()=>{
      S.opts[f.k]=cb.checked;saveSettings();
      const was=S.playing;const blk=S.sents[S.idx]?S.sents[S.idx].b:0;
      if(was)pause();
      rebuild(blk);
      if(was)speakFrom(S.idx);else natPump();
    });
  });
  $('showSkipped').addEventListener('change',e=>{S.showSkipped=e.target.checked;showSection(S.secIdx,true);});
  $('allLangs').checked=S.allLangs;
  $('allLangs').addEventListener('change',e=>{S.allLangs=e.target.checked;buildVoiceList();saveSettings();});
  $('voice').addEventListener('change',e=>{S.voiceName=e.target.value;voiceChanged();});
  document.querySelectorAll('input[name=engine]').forEach(r=>r.addEventListener('change',()=>{if(r.checked)setEngine(r.value);}));
  $('useGpu').checked=!!S.natGpu;
  $('useGpu').addEventListener('change',e=>{S.natGpu=e.target.checked;saveSettings();});
  $('natDownload').addEventListener('click',()=>{
    if(!navigator.onLine){$('natMsg').textContent='You are offline. Connect to the internet for the one-time download.';return;}
    N.state='none';natStart(S.natGpu?'webgpu':'wasm');
  });
  buildNatVoices();
  $('gpuSwitch').addEventListener('click',switchToGpu);
  const bind=(id,key)=>$(id).addEventListener('input',e=>{S[key]=+e.target.value;applyRateUI();renderMeta();updateProgress();voiceChanged();});
  bind('rate','rate');bind('pitch','pitch');bind('vol','vol');
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    Object.assign(S,PRESETS[b.dataset.preset]);applyRateUI();renderMeta();updateProgress();voiceChanged();
  }));
  $('hear').addEventListener('click',()=>{
    const line='This is how I will sound when I read to you.';
    if(S.engine==='natural'){
      if(N.state!=='ready'){setStatus(N.state==='loading'?'The natural voices are still loading.':'Download the natural voices first.');return;}
      if(S.playing)pause();
      hearAudio.src=silentUrl;hearAudio.play().catch(()=>{});
      const k=S.natVoice+'|'+line,h=N.cache.get(k);
      if(h&&h.url){hearAudio.src=h.url;hearAudio.playbackRate=S.rate;hearAudio.volume=S.vol;hearAudio.play().catch(()=>{});return;}
      N.hearKey=k;
      if(!N.inflight){N.inflight=k;N.worker.postMessage({type:'gen',id:k,text:line,voice:S.natVoice});}
      else{const want=k;const t=setInterval(()=>{if(N.hearKey!==want){clearInterval(t);return;}if(!N.inflight){clearInterval(t);N.inflight=want;N.worker.postMessage({type:'gen',id:want,text:line,voice:S.natVoice});}},200);}
      setStatus('Preparing a sample of '+(NAT_VOICES.find(v=>v.id===S.natVoice)||{}).name+'…');
      return;
    }
    if(!synth)return;
    if(S.playing)pause();
    synth.cancel();
    const u=new SpeechSynthesisUtterance(line);
    const v=currentVoice();if(v){u.voice=v;u.lang=v.lang;}
    u.rate=S.rate;u.pitch=S.pitch;u.volume=S.vol;utter=u;
    setTimeout(()=>synth.speak(u),60);
  });
  $('rateChip').addEventListener('click',()=>{
    const steps=[0.8,0.9,1,1.1,1.25,1.5,1.75];
    S.rate=steps.find(x=>x>S.rate+0.001)||steps[0];
    applyRateUI();renderMeta();updateProgress();voiceChanged();
  });
  $('play').addEventListener('click',toggle);
  $('prev').addEventListener('click',()=>step(-1));
  $('next').addEventListener('click',()=>step(1));
  $('secPrev').addEventListener('click',()=>goSection(-1));
  $('secNext').addEventListener('click',()=>goSection(1));
  $('secNext2').addEventListener('click',()=>goSection(1));
  $('seek').addEventListener('input',e=>{
    const n=S.sents.length;if(!n)return;
    const i=Math.round(+e.target.value/1000*(n-1));
    const left=(S.cum[n]-S.cum[i])/(WPM*S.rate);
    $('plLabel').textContent=Math.round(i/Math.max(1,n-1)*100)+'% · '+fmtLeft(left);
  });
  $('seek').addEventListener('change',e=>{
    const n=S.sents.length;if(!n)return;
    jumpTo(Math.round(+e.target.value/1000*(n-1)),S.playing);
  });
  $('reader').addEventListener('click',e=>{
    const sp=e.target.closest('.s');
    if(!sp||String(window.getSelection())!=='')return;
    jumpTo(+sp.dataset.i,true);
  });
  $('sleep').addEventListener('change',e=>{
    const m=+e.target.value;S.sleepAt=m?Date.now()+m*60000:0;
    $('sleepOut').textContent=m?'stops at '+new Date(S.sleepAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';
  });
  setInterval(()=>{
    if(S.sleepAt&&Date.now()>=S.sleepAt){S.sleepAt=0;$('sleep').value='0';$('sleepOut').textContent='';if(S.playing){pause();setStatus('Sleep timer ended. Paused.');}}
  },15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.playing)setWake(true);});
  document.addEventListener('keydown',e=>{
    const t=e.target.tagName;
    if(/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t)||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key===' '){e.preventDefault();toggle();}
    else if(e.key==='ArrowRight'){e.preventDefault();step(1);}
    else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
  });
  $('pick').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadFile(f);e.target.value='';});
  const drop=$('drop');
  ['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();if(ev==='drop'||e.target===document.documentElement||!e.relatedTarget)drop.classList.remove('over');}));
  document.addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)loadFile(f);});
  window.addEventListener('pagehide',savePos);
  if(window.matchMedia('(max-width:959px)').matches)$('panel').removeAttribute('open');
  applyRateUI();syncPlayUI();setupMedia();
  buildVoiceList();
  if(synth){synth.onvoiceschanged=buildVoiceList;setTimeout(buildVoiceList,600);setTimeout(buildVoiceList,2000);}
  renderNat();
  natIsCached().then(c=>{
    if(c){if(S.engine==='natural')natStart(S.natGpu?'webgpu':'wasm');else $('natMsg').textContent='Natural voices are downloaded. Choose Natural to use them.';}
  });
  setupOffline();
  loadSample();
  if('launchQueue' in window)try{window.launchQueue.setConsumer(async p=>{if(p.files&&p.files.length)loadFile(await p.files[0].getFile());});}catch(e){}
}
init();
})();
