let currentCreditNoteId=null,currentCreditTargetId=null;

function ensureCreditNoteModal(){
  if(document.getElementById('creditNoteModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="creditNoteModal" class="modalback hidden"><div class="modal"><div class="modalhead"><b id="creditNoteTitle">Asociar Nota de Crédito</b><button class="btn light" onclick="closeCreditNoteModal()">Cerrar</button></div><div class="modalbody"><div id="creditNoteInfo" class="lead"></div><div id="creditNoteExisting" style="margin-top:14px"></div><div class="field"><label>Buscar Boleta o Factura</label><input id="qCreditTarget" placeholder="Folio, cliente, fecha o monto"></div><div class="tablewrap" style="margin-top:12px;max-height:300px"><table><thead><tr><th></th><th>Fecha</th><th>Tipo</th><th>Folio</th><th>Cliente</th><th>Monto</th><th>Disponible NC</th></tr></thead><tbody id="creditTargetRows"></tbody></table></div><div class="field"><label>Monto de Nota de Crédito a aplicar</label><input id="creditAllocatedAmount" type="number" min="1"></div><div class="field"><label>Observación</label><textarea id="creditObservation" placeholder="Ej. Anulación total de boleta"></textarea></div><div id="creditNoteMsg" class="msg"></div></div><div class="modalfoot"><button class="btn primary" onclick="saveCreditNoteAssociation()">Confirmar asociación</button></div></div></div>`);
  document.getElementById('qCreditTarget').addEventListener('input',renderCreditNoteCandidates);
}

function closeCreditNoteModal(){document.getElementById('creditNoteModal')?.classList.add('hidden');currentCreditNoteId=null;currentCreditTargetId=null}

function creditNoteCandidates(cn){
  const q=(document.getElementById('qCreditTarget')?.value||'').toLowerCase();
  return docs.filter(d=>d.id!==cn.id&&['boleta','factura'].includes(fiscalDocKind(d))&&docCreditCapacity(d)>0)
    .filter(d=>!q||[d.issue_date,d.doc_type,d.folio,d.customer_name,d.amount].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>{
      const ap=a.issue_date<=cn.issue_date?0:1,bp=b.issue_date<=cn.issue_date?0:1;
      if(ap!==bp)return ap-bp;
      const ad=Math.abs(Math.abs(Number(a.amount||0))-creditNoteRemaining(cn));
      const bd=Math.abs(Math.abs(Number(b.amount||0))-creditNoteRemaining(cn));
      if(ad!==bd)return ad-bd;
      return String(b.issue_date||'').localeCompare(String(a.issue_date||''));
    });
}

function renderCreditNoteExisting(cn){
  const box=document.getElementById('creditNoteExisting');
  const links=activeCreditNoteLinks().filter(l=>l.credit_note_id===cn.id);
  if(!links.length){box.innerHTML='<div class="notice">Esta Nota de Crédito todavía no tiene documentos asociados.</div>';return}
  box.innerHTML=`<div class="tablewrap"><table><thead><tr><th>Documento asociado</th><th>Monto aplicado</th><th>Observación</th><th></th></tr></thead><tbody>${links.map(l=>{const d=docs.find(x=>x.id===l.target_document_id);return `<tr><td>${d?esc(d.doc_type)+' '+esc(d.folio):'Documento '+l.target_document_id}</td><td class="amount">${money(l.allocated_amount)}</td><td>${esc(l.observation||'—')}</td><td>${profile.role==='lectura'?'':`<button class="btn light" onclick="voidCreditNoteAssociation(${l.id})">Anular asociación</button>`}</td></tr>`}).join('')}</tbody></table></div>`;
}

function renderCreditNoteCandidates(){
  const cn=docs.find(d=>d.id===currentCreditNoteId),body=document.getElementById('creditTargetRows');
  if(!cn||!body)return;
  const remain=creditNoteRemaining(cn);
  body.innerHTML=creditNoteCandidates(cn).map(d=>`<tr class="candidate" onclick="selectCreditTarget(${d.id})"><td><input type="radio" name="creditTarget" ${currentCreditTargetId===d.id?'checked':''}></td><td>${esc(d.issue_date)}</td><td>${esc(d.doc_type)}</td><td>${esc(d.folio)}</td><td>${esc(d.customer_name||'—')}</td><td class="amount">${money(Math.abs(Number(d.amount||0)))}</td><td class="amount">${money(Math.min(remain,docCreditCapacity(d)))}</td></tr>`).join('')||'<tr><td colspan="7">No hay Boletas o Facturas disponibles para asociar.</td></tr>';
}

function selectCreditTarget(id){
  currentCreditTargetId=id;
  const cn=docs.find(d=>d.id===currentCreditNoteId),target=docs.find(d=>d.id===id);
  if(cn&&target)document.getElementById('creditAllocatedAmount').value=Math.min(creditNoteRemaining(cn),docCreditCapacity(target));
  renderCreditNoteCandidates();
}

function openCreditNoteLink(id){
  ensureCreditNoteModal();
  const cn=docs.find(d=>d.id===id);
  if(!cn||fiscalDocKind(cn)!=='nc')return;
  currentCreditNoteId=id;currentCreditTargetId=null;
  clearMsg('creditNoteMsg');
  document.getElementById('qCreditTarget').value='';
  document.getElementById('creditAllocatedAmount').value='';
  document.getElementById('creditObservation').value='';
  document.getElementById('creditNoteTitle').textContent=`Nota de Crédito ${cn.folio}`;
  document.getElementById('creditNoteInfo').innerHTML=`Monto NC: <b>${money(Math.abs(Number(cn.amount||0)))}</b> · Disponible para asociar: <b>${money(creditNoteRemaining(cn))}</b> · Fecha: ${esc(cn.issue_date)}`;
  renderCreditNoteExisting(cn);renderCreditNoteCandidates();
  document.getElementById('creditNoteModal').classList.remove('hidden');
}

async function saveCreditNoteAssociation(){
  clearMsg('creditNoteMsg');
  if(profile.role==='lectura'){msg('creditNoteMsg','Tu rol es de solo lectura.');return}
  const cn=docs.find(d=>d.id===currentCreditNoteId),target=docs.find(d=>d.id===currentCreditTargetId);
  const amount=Number(document.getElementById('creditAllocatedAmount').value||0),observation=document.getElementById('creditObservation').value.trim();
  if(!cn||!target){msg('creditNoteMsg','Selecciona una Boleta o Factura.');return}
  if(amount<=0){msg('creditNoteMsg','Ingresa un monto mayor a cero.');return}
  if(amount>creditNoteRemaining(cn)){msg('creditNoteMsg','El monto excede el saldo disponible de la Nota de Crédito.');return}
  if(amount>docCreditCapacity(target)){msg('creditNoteMsg','El monto excede el valor disponible del documento asociado.');return}
  try{
    await rest('credit_note_document_links',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({credit_note_id:cn.id,target_document_id:target.id,allocated_amount:amount,status:'activo',observation,created_by:profile.id})});
    await rpc('log_ar_action',{p_action:'ASOCIAR_NOTA_CREDITO',p_entity_type:'ar_document',p_entity_id:String(cn.id),p_metadata:{target_document_id:target.id,allocated_amount:amount,folio_nota_credito:cn.folio,folio_documento:target.folio}});
    msg('creditNoteMsg','Asociación guardada.',true);
    await loadAll();
    openCreditNoteLink(cn.id);
  }catch(e){msg('creditNoteMsg',e.message)}
}

async function voidCreditNoteAssociation(linkId){
  if(profile.role==='lectura')return;
  if(!confirm('¿Anular esta asociación de Nota de Crédito?'))return;
  try{
    const link=creditNoteLinks.find(x=>x.id===linkId);
    await rest('credit_note_document_links?id=eq.'+encodeURIComponent(linkId),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'anulado'})});
    await rpc('log_ar_action',{p_action:'ANULAR_ASOCIACION_NOTA_CREDITO',p_entity_type:'credit_note_document_link',p_entity_id:String(linkId),p_metadata:{credit_note_id:link?.credit_note_id,target_document_id:link?.target_document_id}});
    const cnId=currentCreditNoteId;
    await loadAll();
    if(cnId)openCreditNoteLink(cnId);
  }catch(e){msg('creditNoteMsg',e.message)}
}
