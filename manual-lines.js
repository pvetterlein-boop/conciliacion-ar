(()=>{
let manualKind=null;
const canManualWrite=()=>profile&&['admin','conciliador'].includes(profile.role);
const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const val=id=>document.getElementById(id)?.value?.trim()||'';
const numVal=id=>Number(document.getElementById(id)?.value||0);

function ensureManualModal(){
  if(document.getElementById('manualLineModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="manualLineModal" class="modalback hidden"><div class="modal"><div class="modalhead"><b id="manualLineTitle">Agregar línea</b><button class="btn light" type="button" onclick="closeManualLine()">Cerrar</button></div><div class="modalbody"><div id="manualLineBody"></div><div id="manualLineMsg" class="msg"></div></div><div class="modalfoot"><button id="saveManualLineBtn" class="btn primary" type="button" onclick="saveManualLine()">Guardar línea</button></div></div></div>`);
}
function field(id,label,html){return `<div class="field"><label for="${id}">${label}</label>${html}</div>`}
function ensureAddButton(section,kind,label){
  if(!canManualWrite())return;
  const head=document.querySelector(`#${section} .panelhead`);if(!head)return;
  let toolbar=head.querySelector('.toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='toolbar';head.appendChild(toolbar)}
  const id=`addManual_${kind}`;if(document.getElementById(id))return;
  const b=document.createElement('button');b.id=id;b.type='button';b.className='btn primary';b.textContent='Agregar línea';b.onclick=()=>openManualLine(kind);toolbar.appendChild(b);
}
function ensureManualControls(){
  ensureManualModal();
  ensureAddButton('tuu','tuu');ensureAddButton('mp','mp');ensureAddButton('bank','bank');ensureAddButton('docs','doc');
}
function extractRowId(kind,row){
  const onclick=[...row.querySelectorAll('button[onclick]')].map(b=>b.getAttribute('onclick')||'').join('|');let m;
  if(kind==='tuu')m=onclick.match(/open(?:Service|Unreconcile)\('tuu',(\d+)\)/);
  if(kind==='mp')m=onclick.match(/open(?:Service|Unreconcile)\('mp',(\d+)\)/);
  if(kind==='bank')m=onclick.match(/open(?:Service|Unreconcile)\('bank',(\d+)\)/);
  if(kind==='doc')m=onclick.match(/openService\('doc',(\d+)\)|openCreditNoteLink\((\d+)\)|openUnreconcile\('doc',(\d+)\)/);
  if(!m)return null;return Number(m[1]||m[2]||m[3]);
}
function decorateDeleteButtons(kind,tbodyId){
  if(!canManualWrite())return;
  const body=document.getElementById(tbodyId);if(!body)return;
  [...body.querySelectorAll(':scope > tr')].forEach(row=>{
    const actions=row.querySelector('td:last-child .actions');if(!actions||actions.querySelector('.manual-delete-line'))return;
    const id=extractRowId(kind,row);if(!id)return;
    const b=document.createElement('button');b.type='button';b.className='btn light danger manual-delete-line';b.textContent='Eliminar';b.title='Eliminar esta línea';b.onclick=()=>deleteManualLine(kind,id);actions.appendChild(b);
  });
}
function wrapRenderer(name,kind,tbodyId){
  const base=window[name];if(typeof base!=='function'||base.__manualWrapped)return;
  const wrapped=function(...args){const out=base.apply(this,args);ensureManualControls();decorateDeleteButtons(kind,tbodyId);return out};wrapped.__manualWrapped=true;window[name]=wrapped;
}
wrapRenderer('renderTuu','tuu','tTuu');wrapRenderer('renderMp','mp','tMp');wrapRenderer('renderBank','bank','tBank');wrapRenderer('renderDocs','doc','tDocs');

window.openManualLine=(kind)=>{
  if(!canManualWrite())return;
  manualKind=kind;ensureManualModal();clearMsg('manualLineMsg');
  const date=todayLocal();let title='',body='';
  if(kind==='tuu'||kind==='mp'){
    title=kind==='mp'?'Agregar línea · Mercado Pago':'Agregar línea · Tuu';
    body=`<div class="formgrid">${field('mlDate','Fecha',`<input id="mlDate" type="date" value="${date}" required>`)}${field('mlRef',kind==='mp'?'ID / operación':'Número único / referencia',`<input id="mlRef" placeholder="Referencia única" required>`)}${field('mlCustomer','Cliente',`<input id="mlCustomer" placeholder="Nombre del cliente">`)}${field('mlAmount','Monto',`<input id="mlAmount" type="number" min="1" step="1" required>`)}${field('mlFee','Comisión',`<input id="mlFee" type="number" min="0" step="1" value="0">`)}</div>${field('mlDescription','Descripción',`<input id="mlDescription" placeholder="Opcional">`)}<div class="subtle" style="margin-top:10px">La línea quedará pendiente de conciliación AR.</div>`;
  }else if(kind==='bank'){
    title='Agregar línea · Transferencias';
    body=`<div class="formgrid">${field('mlDate','Fecha',`<input id="mlDate" type="date" value="${date}" required>`)}${field('mlRef','N° operación',`<input id="mlRef" placeholder="Número de operación" required>`)}${field('mlCustomer','Pagador',`<input id="mlCustomer" placeholder="Nombre del pagador">`)}${field('mlRut','RUT pagador',`<input id="mlRut" placeholder="Opcional">`)}${field('mlBank','Banco origen',`<input id="mlBank" placeholder="Opcional">`)}${field('mlAmount','Monto',`<input id="mlAmount" type="number" min="1" step="1" required>`)}</div><div class="subtle" style="margin-top:10px">La transferencia quedará pendiente de conciliación AR.</div>`;
  }else{
    title='Agregar línea · Documentos AR';
    body=`<div class="formgrid">${field('mlDate','Fecha documento',`<input id="mlDate" type="date" value="${date}" required>`)}${field('mlDocType','Tipo de documento',`<select id="mlDocType"><option value="41">Boleta Exenta</option><option value="34">Factura Exenta</option><option value="61">Nota de Crédito</option></select>`)}${field('mlRef','Folio',`<input id="mlRef" type="number" min="1" step="1" required>`)}${field('mlAmount','Monto',`<input id="mlAmount" type="number" min="1" step="1" required>`)}${field('mlCustomer','Cliente / razón social',`<input id="mlCustomer" placeholder="Opcional">`)}${field('mlRut','RUT cliente',`<input id="mlRut" placeholder="Opcional">`)}${field('mlOrigin','Origen',`<input id="mlOrigin" value="Manual" placeholder="Ej. Manual / SII / Tuu">`)}</div><div class="subtle" style="margin-top:10px">Las Notas de Crédito se guardan como ajuste negativo y pueden asociarse posteriormente a una Boleta o Factura.</div>`;
  }
  document.getElementById('manualLineTitle').textContent=title;document.getElementById('manualLineBody').innerHTML=body;document.getElementById('manualLineModal').classList.remove('hidden');
};
window.closeManualLine=()=>{document.getElementById('manualLineModal')?.classList.add('hidden');manualKind=null};

function docCode(d){
  if(typeof canonicalDocCode==='function')return canonicalDocCode(d?.doc_type,d?.source_key);
  const s=String(d?.doc_type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(s==='41'||s.includes('boleta'))return '41';if(s==='34'||s.includes('factura'))return '34';if(s==='61'||(s.includes('nota')&&s.includes('credito')))return '61';return s;
}
async function saveTxn(kind){
  const date=val('mlDate'),rawRef=val('mlRef'),customer=val('mlCustomer')||null,amount=numVal('mlAmount'),fee=numVal('mlFee'),description=val('mlDescription')||null;
  if(!date||!rawRef||amount<=0)throw new Error('Completa fecha, referencia y un monto mayor a cero.');if(fee<0||fee>amount)throw new Error('La comisión debe estar entre 0 y el monto de la operación.');
  const providerId=kind==='mp'?'mp:'+rawRef.replace(/^mp:/i,''):rawRef;if(tuu.some(x=>String(x.provider_id).trim()===providerId))throw new Error('Ya existe una operación con esa referencia.');
  const sg=typeof serviceSuggestion==='function'?serviceSuggestion(amount):null,desc=String(description||'').toLowerCase(),manualMonto=kind==='tuu'&&desc==='monto';
  const payload={provider_id:providerId,txn_date:date,source:kind==='mp'?'Mercado Pago':'Tuu',customer_name:customer,amount,fee,net:amount-fee,description,document_label:null,match_type:null,ar_status:'pendiente',severity:manualMonto?'alta':null,emission_status:manualMonto?'pendiente_emision_manual':'sin_alerta',suggested_type:sg?.service_type||null,suggested_periodicity:sg?.periodicity||null,suggested_frequency:sg?.frequency||0,suggested_registration:sg?.registration||false,suggested_stage:sg?.stage||null,confidence:sg?.confidence||null,classification_status:sg?'propuesta_disponible':'sin_clasificar'};
  await rest('tuu_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});return {entity:kind==='mp'?'mercadopago_transaction':'tuu_transaction',ref:providerId,amount};
}
async function saveBank(){
  const date=val('mlDate'),operation=val('mlRef'),amount=numVal('mlAmount');if(!date||!operation||amount<=0)throw new Error('Completa fecha, número de operación y un monto mayor a cero.');if(bank.some(x=>String(x.operation).trim()===operation))throw new Error('Ya existe una transferencia con ese número de operación.');
  const payload={source_key:'bank:'+operation,payment_date:date,operation,payer:val('mlCustomer')||null,payer_rut:val('mlRut')||null,bank_origin:val('mlBank')||null,amount,ar_status:'pendiente'};
  await rest('bank_payments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});return {entity:'bank_payment',ref:operation,amount};
}
async function saveDoc(){
  const date=val('mlDate'),code=val('mlDocType'),folio=Number(val('mlRef')),rawAmount=numVal('mlAmount');if(!date||!['41','34','61'].includes(code)||!folio||rawAmount<=0)throw new Error('Completa fecha, tipo, folio y un monto mayor a cero.');if(docs.some(d=>Number(d.folio)===folio&&docCode(d)===code))throw new Error('Ya existe un documento del mismo tipo y folio.');
  const label=code==='41'?'Boleta Exenta':code==='34'?'Factura Exenta':'Nota de Crédito',amount=code==='61'?-Math.abs(rawAmount):Math.abs(rawAmount),payload={source_key:`doc:${code}:${folio}`,doc_type:label,folio,issue_date:date,amount,origin:val('mlOrigin')||'Manual',rut:val('mlRut')||null,customer_name:val('mlCustomer')||null,ar_status:code==='61'?'ajuste':'pendiente',emission_status:'documento_encontrado'};
  await rest('ar_documents',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});return {entity:'ar_document',ref:String(folio),amount};
}
window.saveManualLine=async()=>{
  if(!canManualWrite()||!manualKind)return;const btn=document.getElementById('saveManualLineBtn');btn.disabled=true;clearMsg('manualLineMsg');try{let r;if(manualKind==='tuu'||manualKind==='mp')r=await saveTxn(manualKind);else if(manualKind==='bank')r=await saveBank();else r=await saveDoc();await rpc('log_ar_action',{p_action:'MANUAL_LINE_CREATED',p_entity_type:r.entity,p_entity_id:r.ref,p_metadata:{source:manualKind,amount:r.amount}});await loadAll();msg('manualLineMsg','Línea agregada correctamente.',true);setTimeout(()=>closeManualLine(),500)}catch(e){msg('manualLineMsg',e.message)}finally{btn.disabled=false}
};

function deletionBlock(kind,id){
  if(kind==='bank'&&bankMatches.some(m=>m.bank_payment_id===id))return 'Esta transferencia tiene historial de conciliación. Desconcíliala si corresponde; por trazabilidad no puede eliminarse después de haber sido asociada.';
  if((kind==='tuu'||kind==='mp')&&tuuMatches.some(m=>m.tuu_transaction_id===id))return 'Esta operación tiene historial de conciliación. Desconcíliala si corresponde; por trazabilidad no puede eliminarse después de haber sido asociada.';
  if(kind==='doc'&&(bankMatches.some(m=>m.ar_document_id===id)||tuuMatches.some(m=>m.ar_document_id===id)||creditNoteLinks.some(l=>l.credit_note_id===id||l.target_document_id===id)))return 'Este documento tiene historial de conciliación o asociación con Nota de Crédito. Por trazabilidad no puede eliminarse.';
  return '';
}
function entityForDelete(kind,id){if(kind==='bank')return bank.find(x=>x.id===id);if(kind==='doc')return docs.find(x=>x.id===id);return tuu.find(x=>x.id===id)}
function deleteLabel(kind,o){if(kind==='bank')return `transferencia ${o?.operation||''}`;if(kind==='doc')return `${o?.doc_type||'documento'} ${o?.folio||''}`;return `${kind==='mp'?'Mercado Pago':'Tuu'} ${String(o?.provider_id||'').replace(/^mp:/,'')}`}
window.deleteManualLine=async(kind,id)=>{
  if(!canManualWrite())return;const o=entityForDelete(kind,id);if(!o)return;const block=deletionBlock(kind,id);if(block){alert(block);return}const label=deleteLabel(kind,o);if(!confirm(`¿Eliminar ${label}?\n\nEsta acción elimina la línea de la base. No se puede deshacer desde la página.`))return;
  try{const table=kind==='bank'?'bank_payments':kind==='doc'?'ar_documents':'tuu_transactions';await rest(`${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});await rpc('log_ar_action',{p_action:'MANUAL_LINE_DELETED',p_entity_type:kind==='bank'?'bank_payment':kind==='doc'?'ar_document':kind==='mp'?'mercadopago_transaction':'tuu_transaction',p_entity_id:String(id),p_metadata:{label}});await loadAll()}catch(e){alert(e.message||'No fue posible eliminar la línea.')}
};

setTimeout(()=>{ensureManualControls();if(profile){window.renderTuu?.();window.renderMp?.();window.renderBank?.();window.renderDocs?.()}},0);
})();
