(()=>{
const originalTxnRemaining=window.txnRemaining;
const originalDocApplied=window.docApplied;
const originalDocRemaining=window.docRemaining;

function activeTxnMatchFor(id){return activeTuuMatches().some(m=>Number(m.tuu_transaction_id)===Number(id))}
function txnRemainingLive(x){return activeTxnMatchFor(x?.id)?0:Math.max(0,Number(x?.amount||0))}
function docAppliedLive(id){
  let total=activeBankMatches().filter(m=>Number(m.ar_document_id)===Number(id)).reduce((a,m)=>a+Number(m.allocated_amount||0),0);
  const seen=new Set();
  for(const m of activeTuuMatches().filter(m=>Number(m.ar_document_id)===Number(id))){
    const txnId=Number(m.tuu_transaction_id);if(seen.has(txnId))continue;
    const t=tuu.find(x=>Number(x.id)===txnId);if(t){total+=Number(t.amount||0);seen.add(txnId)}
  }
  return total;
}
function docRemainingLive(d){
  if(!d||Number(d.amount||0)<=0)return 0;
  return Math.max(0,Number(d.amount||0)-docAppliedLive(d.id)-docCreditApplied(d.id));
}

// La fuente de verdad son las asociaciones activas, no un ar_status que puede quedar desfasado.
window.txnRemaining=txnRemainingLive;
window.docApplied=docAppliedLive;
window.docRemaining=docRemainingLive;

function sourceStats(label,rows,kind){
  const total=rows.reduce((a,x)=>a+Number(x.amount||0),0);
  const pending=rows.reduce((a,x)=>a+(kind==='bank'?bankRemaining(x):txnRemainingLive(x)),0);
  return {label,count:rows.length,total,applied:Math.max(0,total-pending),pending,pendingCount:rows.filter(x=>(kind==='bank'?bankRemaining(x):txnRemainingLive(x))>0).length};
}
function dashboardDocKind(d){
  if(typeof fiscalDocKind==='function')return fiscalDocKind(d);
  const s=String(d?.doc_type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(s==='61'||(s.includes('nota')&&s.includes('credito')))return 'nc';
  if(s==='34'||s.includes('factura'))return 'factura';
  if(s==='41'||s.includes('boleta'))return 'boleta';
  return 'otro';
}
function docTypeStats(kind,label){
  const rows=docs.filter(d=>dashboardDocKind(d)===kind&&Number(d.amount||0)!==0);
  const amount=rows.reduce((a,d)=>a+(kind==='nc'?-Math.abs(Number(d.amount||0)):Math.abs(Number(d.amount||0))),0);
  return {kind,label,count:rows.length,amount};
}
function renderDashboardLive(){
  const tuuStat=sourceStats('Tuu',tuuRows(),'tuu'),mpStat=sourceStats('Mercado Pago',mpRows(),'mp'),bankStat=sourceStats('Transferencias',bank,'bank'),sources=[tuuStat,bankStat,mpStat];
  const paymentTotal=sources.reduce((a,x)=>a+x.total,0),paymentApplied=sources.reduce((a,x)=>a+x.applied,0),paymentPending=sources.reduce((a,x)=>a+x.pending,0),pendingOps=sources.reduce((a,x)=>a+x.pendingCount,0);
  const boletas=docTypeStats('boleta','Boletas'),facturas=docTypeStats('factura','Facturas'),creditos=docTypeStats('nc','Notas de crédito'),otros=docTypeStats('otro','Otros'),docStats=[boletas,facturas,creditos];
  const docsNet=boletas.amount+facturas.amount+creditos.amount;
  const receivable=docs.filter(d=>dashboardDocKind(d)!=='nc'&&Number(d.amount||0)>0),pendingDocs=receivable.filter(d=>docRemainingLive(d)>0),pendingAR=pendingDocs.reduce((a,d)=>a+docRemainingLive(d),0),paidDocs=receivable.filter(d=>docRemainingLive(d)===0),ncApplied=activeCreditNoteLinks().reduce((a,l)=>a+Number(l.allocated_amount||0),0);

  const setKpi=(id,label,value)=>{const el=document.getElementById(id);if(!el)return;if(el.previousElementSibling)el.previousElementSibling.textContent=label;el.textContent=value};
  setKpi('kTuu','Total pagos recibidos',money(paymentTotal));
  setKpi('kMp','Total documentos emitidos',money(docsNet));
  setKpi('kBank','Pendiente de pago AR',money(pendingAR));
  setKpi('kDocs','Pendiente de conciliar AR',money(paymentPending));
  setKpi('kPending','Operaciones pendientes',String(pendingOps));

  const summary=document.getElementById('summary');if(!summary)return;
  const sourceRows=sources.map(s=>`<tr><td>${esc(s.label)}</td><td>${s.count}</td><td class="amount">${money(s.total)}</td><td class="amount">${money(s.applied)}</td><td class="amount">${money(s.pending)}</td></tr>`).join('');
  const docRows=docStats.map(s=>`<tr><td>${esc(s.label)}</td><td>${s.count}</td><td class="amount ${s.kind==='nc'?'danger':''}">${money(s.amount)}</td></tr>`).join('')+(otros.count?`<tr><td>Otros (fuera del total)</td><td>${otros.count}</td><td class="amount">${money(otros.amount)}</td></tr>`:'');
  const pendingRows=sources.map(s=>`<tr><td>${esc(s.label)}</td><td>${s.pendingCount}</td><td class="amount">${money(s.pending)}</td></tr>`).join('');
  summary.innerHTML=`
    <div class="summarygrid">
      <div class="summarybox"><span>Pagos recibidos</span><b>${money(paymentTotal)}</b><div class="subtle">Conciliado ${money(paymentApplied)} · Pendiente ${money(paymentPending)}</div></div>
      <div class="summarybox"><span>Total documentos emitidos</span><b>${money(docsNet)}</b><div class="subtle">Boletas + Facturas − Notas de crédito</div></div>
      <div class="summarybox"><span>Saldo documentos AR</span><b>${money(pendingAR)}</b><div class="subtle">${pendingDocs.length} con saldo · ${paidDocs.length} sin saldo</div></div>
      <div class="summarybox"><span>Ajustes por notas de crédito</span><b>${money(-ncApplied)}</b><div class="subtle">Monto efectivamente asociado a documentos AR</div></div>
    </div>
    <div class="grid2">
      <div><div class="panelhead"><h3>Detalle de pagos recibidos</h3></div><div class="tablewrap"><table><thead><tr><th>Fuente</th><th>Operaciones</th><th>Recibido</th><th>Conciliado</th><th>Pendiente</th></tr></thead><tbody>${sourceRows}<tr><th>Total</th><th>${sources.reduce((a,s)=>a+s.count,0)}</th><th class="amount">${money(paymentTotal)}</th><th class="amount">${money(paymentApplied)}</th><th class="amount">${money(paymentPending)}</th></tr></tbody></table></div></div>
      <div><div class="panelhead"><h3>Validación de documentos AR</h3></div><div class="tablewrap"><table><thead><tr><th>Tipo</th><th>Cantidad</th><th>Monto</th></tr></thead><tbody>${docRows}<tr><th>Total documentos emitidos</th><th>${boletas.count+facturas.count+creditos.count}</th><th class="amount">${money(docsNet)}</th></tr></tbody></table></div><div class="subtle" style="margin-top:8px">Las notas de crédito se presentan y calculan restando.</div></div>
      <div><div class="panelhead"><h3>Estado de documentos por cobrar</h3></div><div class="tablewrap"><table><thead><tr><th>Estado</th><th>Documentos</th><th>Monto</th></tr></thead><tbody><tr><td>Con saldo pendiente</td><td>${pendingDocs.length}</td><td class="amount">${money(pendingAR)}</td></tr><tr><td>Sin saldo pendiente</td><td>${paidDocs.length}</td><td class="amount">${money(receivable.filter(d=>docRemainingLive(d)===0).reduce((a,d)=>a+Number(d.amount||0),0))}</td></tr><tr><td>NC aplicadas a documentos</td><td>${activeCreditNoteLinks().length}</td><td class="amount danger">${money(-ncApplied)}</td></tr></tbody></table></div></div>
      <div><div class="panelhead"><h3>Pendientes de conciliación AR</h3></div><div class="tablewrap"><table><thead><tr><th>Fuente</th><th>Operaciones</th><th>Monto pendiente</th></tr></thead><tbody>${pendingRows}<tr><th>Total</th><th>${pendingOps}</th><th class="amount">${money(paymentPending)}</th></tr></tbody></table></div></div>
    </div>`;
  if(typeof scheduleTableSorting==='function')scheduleTableSorting();
}

const baseRender=window.render;
if(typeof baseRender==='function'){
  window.render=function(...args){const out=baseRender.apply(this,args);renderDashboardLive();return out};
}

function addDashboardRefresh(){
  const head=document.querySelector('#dashboard .panelhead');if(!head||document.getElementById('dashboardRefreshBtn'))return;
  const b=document.createElement('button');b.id='dashboardRefreshBtn';b.type='button';b.className='btn light';b.textContent='Actualizar datos';b.onclick=async()=>{b.disabled=true;try{await loadAll()}finally{b.disabled=false}};head.appendChild(b);
  const nav=document.querySelector('#nav button[data-p="dashboard"]');if(nav&&!nav.dataset.dashboardSync){nav.dataset.dashboardSync='1';nav.addEventListener('click',()=>setTimeout(()=>loadAll(),0))}
}
setTimeout(()=>{addDashboardRefresh();if(profile)renderDashboardLive()},0);
})();
