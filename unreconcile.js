let currentUnreconcile=null;

function ensureUnreconcileModal(){
  if(document.getElementById('unreconcileModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="unreconcileModal" class="modalback hidden"><div class="modal"><div class="modalhead"><b id="unreconcileTitle">Desconciliar</b><button class="btn light" onclick="closeUnreconcile()">Cerrar</button></div><div class="modalbody"><div id="unreconcileInfo" class="lead"></div><div id="unreconcileRows" style="margin-top:14px"></div><div id="unreconcileMsg" class="msg"></div></div></div></div>`);
}

function closeUnreconcile(){document.getElementById('unreconcileModal')?.classList.add('hidden');currentUnreconcile=null}

function unreconcileEntityLabel(kind,o){
  if(kind==='bank')return `Transferencia ${esc(o?.operation||'')}`;
  if(kind==='doc')return `${esc(o?.doc_type||'Documento')} ${esc(o?.folio||'')}`;
  return `${kind==='mp'?'Mercado Pago':'Tuu'} ${esc(String(o?.provider_id||'').replace(/^mp:/,''))}`;
}

function unreconcileLinks(kind,id){
  if(kind==='bank'){
    return activeBankMatches().filter(m=>m.bank_payment_id===id).map(m=>({source:'bank',match:m,doc:docs.find(d=>d.id===m.ar_document_id)}));
  }
  if(kind==='doc'){
    const a=activeBankMatches().filter(m=>m.ar_document_id===id).map(m=>({source:'bank',match:m,bank:bank.find(b=>b.id===m.bank_payment_id),doc:docs.find(d=>d.id===id)}));
    const b=activeTuuMatches().filter(m=>m.ar_document_id===id).map(m=>({source:'tuu',match:m,txn:tuu.find(t=>t.id===m.tuu_transaction_id),doc:docs.find(d=>d.id===id)}));
    return [...a,...b];
  }
  return activeTuuMatches().filter(m=>m.tuu_transaction_id===id).map(m=>({source:'tuu',match:m,txn:tuu.find(t=>t.id===id),doc:docs.find(d=>d.id===m.ar_document_id)}));
}

function renderUnreconcileRows(){
  const box=document.getElementById('unreconcileRows');
  if(!box||!currentUnreconcile)return;
  const links=unreconcileLinks(currentUnreconcile.kind,currentUnreconcile.id);
  if(!links.length){box.innerHTML='<div class="notice">No hay conciliaciones activas para este registro.</div>';return}
  box.innerHTML=`<div class="tablewrap"><table><thead><tr><th>Origen</th><th>Documento AR</th><th>Monto</th><th>Observación</th><th></th></tr></thead><tbody>${links.map(l=>{
    const doc=l.doc,src=l.source==='bank'?(l.bank||bank.find(b=>b.id===l.match.bank_payment_id)):l.txn;
    const origin=l.source==='bank'?`Transferencia ${esc(src?.operation||'')}`:`${src&&isMp(src)?'Mercado Pago':'Tuu'} ${esc(String(src?.provider_id||'').replace(/^mp:/,''))}`;
    const amount=l.source==='bank'?Number(l.match.allocated_amount||0):Number(src?.amount||0);
    return `<tr><td>${origin}</td><td>${doc?`${esc(doc.doc_type)} ${esc(doc.folio)}`:'—'}</td><td class="amount">${money(amount)}</td><td>${esc(l.match.observation||'—')}</td><td>${profile.role==='lectura'?'':`<button class="btn light danger" onclick="voidReconciliation('${l.source}',${l.match.id})">Desconciliar</button>`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function openUnreconcile(kind,id){
  ensureUnreconcileModal();
  const o=kind==='bank'?bank.find(x=>x.id===id):kind==='doc'?docs.find(x=>x.id===id):tuu.find(x=>x.id===id);
  if(!o)return;
  currentUnreconcile={kind,id};
  clearMsg('unreconcileMsg');
  document.getElementById('unreconcileTitle').textContent='Desconciliar asociación';
  document.getElementById('unreconcileInfo').innerHTML=`${unreconcileEntityLabel(kind,o)} · selecciona únicamente la asociación que quieres corregir. El registro original no se elimina.`;
  renderUnreconcileRows();
  document.getElementById('unreconcileModal').classList.remove('hidden');
}

async function persistDocDerivedStatus(docId){
  const d=docs.find(x=>x.id===docId);if(!d||Number(d.amount||0)<=0)return;
  const rem=docRemaining(d),amount=Number(d.amount||0),st=rem<=0?'conciliado':rem<amount?'parcial':'pendiente';
  await rest('ar_documents?id=eq.'+encodeURIComponent(docId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ar_status:st})});
}

async function persistBankDerivedStatus(bankId){
  const b=bank.find(x=>x.id===bankId);if(!b)return;
  const rem=bankRemaining(b),amount=Number(b.amount||0),st=rem<=0?'conciliado':rem<amount?'parcial':'pendiente';
  await rest('bank_payments?id=eq.'+encodeURIComponent(bankId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ar_status:st})});
}

async function persistTxnDerivedStatus(txnId){
  const t=tuu.find(x=>x.id===txnId);if(!t)return;
  const linked=activeTuuMatches().some(m=>m.tuu_transaction_id===txnId),st=linked?'conciliado':'pendiente';
  await rest('tuu_transactions?id=eq.'+encodeURIComponent(txnId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ar_status:st})});
}

async function voidReconciliation(source,matchId){
  if(profile.role==='lectura')return;
  const bankMatch=source==='bank'?bankMatches.find(m=>m.id===matchId):null;
  const txnMatch=source==='tuu'?tuuMatches.find(m=>m.id===matchId):null;
  const docId=bankMatch?.ar_document_id??txnMatch?.ar_document_id;
  const bankId=bankMatch?.bank_payment_id??null;
  const txnId=txnMatch?.tuu_transaction_id??null;
  if(!docId)return;
  const d=docs.find(x=>x.id===docId),b=bankId?bank.find(x=>x.id===bankId):null,t=txnId?tuu.find(x=>x.id===txnId):null;
  const label=source==='bank'?`transferencia ${b?.operation||''} ↔ ${d?.doc_type||'documento'} ${d?.folio||''}`:`${t&&isMp(t)?'Mercado Pago':'Tuu'} ${String(t?.provider_id||'').replace(/^mp:/,'')} ↔ ${d?.doc_type||'documento'} ${d?.folio||''}`;
  if(!confirm(`¿Desconciliar ${label}?\n\nLa operación no se elimina. Solo se anula esta asociación y los saldos vuelven a quedar disponibles para corregirla.`))return;
  clearMsg('unreconcileMsg');
  try{
    const table=source==='bank'?'bank_document_matches':'tuu_document_matches';
    await rest(`${table}?id=eq.${encodeURIComponent(matchId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'anulado'})});
    await loadAll();
    if(bankId)await persistBankDerivedStatus(bankId);
    if(txnId)await persistTxnDerivedStatus(txnId);
    await persistDocDerivedStatus(docId);
    await rpc('log_ar_action',{p_action:'RECONCILIATION_VOIDED',p_entity_type:source==='bank'?'bank_document_match':'tuu_document_match',p_entity_id:String(matchId),p_metadata:{bank_payment_id:bankId,tuu_transaction_id:txnId,ar_document_id:docId,folio:d?.folio}});
    await loadAll();
    const ctx=currentUnreconcile;
    if(ctx){msg('unreconcileMsg','Conciliación anulada. Los saldos y estados fueron recalculados.',true);renderUnreconcileRows()}
  }catch(e){msg('unreconcileMsg',e.message)}
}
