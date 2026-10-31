// Clicks every kind of interactive element on the built page and checks the view stays valid.
// usage: node clicktest.js page.html
const {chromium}=require('playwright');(async()=>{const page=process.argv[2];const b=await chromium.launch();const fails=[];let n=0;
const C=encodeURIComponent('삼성전자(주)'), U=s=>'&u='+encodeURIComponent(s);
const starts=[['root','#g=1&t=org&c='+C],['DX','#g=1&t=org&c='+C+U('DX부문')],['CTO','#g=1&t=org&c='+C+U('DX부문›CTO')],['lab','#g=1&t=org&c='+C+U('DS부문›CTO›반도체연구소')],['target','#g=1&t=target'],['news','#g=1&t=news'],['tree','#g=1&t=tree'],['list','#g=1&t=list'],['brief','#g=1&t=brief']];
const sels=['[data-u]','[data-p]','[data-t]','[data-c]','[data-pp]','[data-tag]','[data-tier]','[data-ncat]','[data-ncomp]','[data-jump]','[data-dots]','.trow','.lk','details.ghostd>summary','details.cat>summary','details.more>summary','.tog','.newslist a','.urow','.mem','.leaders button','.axline button','#csvcopy','[data-bf]','.bcard','.bp'];
for (const [label,hash] of starts){
 for (const sel of sels){
  const p=await b.newPage({viewport:{width:412,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+page+hash);await p.waitForTimeout(250);
  // open collapsed sections so nested controls are clickable
  await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  const els=await p.$$(sel); const pick=els.slice(0,3);
  for (let k=0;k<pick.length;k++){
   const all=await p.$$(sel); const el=all[k]; if(!el) break;
   const vis=await el.isVisible(); if(!vis) continue;
   let popup=null; p.context().once('page',pg=>{popup=pg;});
   await el.click({timeout:2000}).catch(e=>fails.push(`${label} ${sel}[${k}] click: ${e.message.split('\n')[0]}`));
   await p.waitForTimeout(200); n++;
   const st=await p.evaluate(()=>({hash:location.hash, main:document.querySelector('main').innerText.slice(0,60), dlg:document.querySelector('#dlg').open}));
   // a valid state keeps the group selected (never the 1-group overview) and the main area non-empty
   if (!/g=1/.test(st.hash) && !popup) fails.push(`${label} ${sel}[${k}] -> hash '${st.hash}' main '${st.main}'`);
   if (!st.main.trim()) fails.push(`${label} ${sel}[${k}] -> empty main`);
   if (st.dlg) { await p.keyboard.press('Escape'); await p.waitForTimeout(100); }
   if (popup) await popup.close().catch(()=>{});
   await p.goto('file://'+page+hash);await p.waitForTimeout(200);await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  }
  if (errs.length) fails.push(`${label} ${sel} errors: ${errs.join('; ')}`);
  await p.close();
 }
}
console.log(`clicks ${n}, failures ${fails.length}`);fails.slice(0,40).forEach(f=>console.log(' -',f));await b.close();})();
