from pathlib import Path
import re

p = Path('core.js')
s = p.read_text(encoding='utf-8')

s = s.replace(
    'let session=null,profile=null,tuu=[],bank=[],docs=[],bankMatches=[],tuuMatches=[],classes=[]',
    'let session=null,profile=null,tuu=[],bank=[],docs=[],bankMatches=[],tuuMatches=[],creditNoteLinks=[],classes=[]',
    1,
)
s = s.replace(
    '[tuu,bank,docs,bankMatches,tuuMatches,classes,classSessions,rules,users,audit,imports]=await Promise.all(',
    '[tuu,bank,docs,bankMatches,tuuMatches,creditNoteLinks,classes,classSessions,rules,users,audit,imports]=await Promise.all(',
    1,
)
s = s.replace(
    "safe('tuu_document_matches?select=*'),safe('classes?select=*&order=id.asc')",
    "safe('tuu_document_matches?select=*'),safe('credit_note_document_links?select=*'),safe('classes?select=*&order=id.asc')",
    1,
)

marker = 'function bankApplied(id)'
helpers = r'''function activeCreditNoteLinks(){return creditNoteLinks.filter(l=>String(l.status||'activo').toLowerCase()!=='anulado')}
function docCreditApplied(id){return activeCreditNoteLinks().filter(l=>l.target_document_id===id).reduce((a,l)=>a+Number(l.allocated_amount||0),0)}
function docCreditCapacity(d){return Math.max(0,Math.abs(Number(d?.amount||0))-docCreditApplied(d?.id))}
function creditNoteUsed(id){return activeCreditNoteLinks().filter(l=>l.credit_note_id===id).reduce((a,l)=>a+Number(l.allocated_amount||0),0)}
function creditNoteRemaining(d){return Math.max(0,Math.abs(Number(d?.amount||0))-creditNoteUsed(d?.id))}
function creditNoteStatusLabel(d){const used=creditNoteUsed(d.id),rem=creditNoteRemaining(d);return used<=0?'pendiente asociación':rem<=0?'asociada':'asociación parcial'}
function creditNoteTargetsLabel(d){const out=[];for(const l of activeCreditNoteLinks().filter(x=>x.credit_note_id===d.id)){const t=docs.find(x=>x.id===l.target_document_id);if(t)out.push(`${esc(t.doc_type)} ${esc(t.folio)} (${money(l.allocated_amount)})`)}return out.join('<br>')||'Sin documento asociado'}
'''
if 'function activeCreditNoteLinks()' not in s:
    if marker not in s:
        raise SystemExit('No se encontró marcador de helpers')
    s = s.replace(marker, helpers + marker, 1)

s = s.replace(
    "function docRemaining(d){return Math.max(0,Number(d.amount||0)-docApplied(d.id))}",
    "function docRemaining(d){return Math.max(0,Number(d.amount||0)-docApplied(d.id)-docCreditApplied(d.id))}",
    1,
)
s = s.replace(
    "function docStatus(d){const r=docRemaining(d),a=Number(d.amount||0);return r<=0?'conciliado':r<a?'parcial':(d.ar_status||'pendiente')}",
    "function docStatus(d){const r=docRemaining(d),a=Number(d.amount||0),ca=docCreditApplied(d.id),pa=docApplied(d.id);return r<=0?(ca>0?(pa>0?'conciliado / ajustado NC':'ajustado NC'):'conciliado'):r<a?(ca>0?'parcial / ajustado NC':'parcial'):(d.ar_status||'pendiente')}",
    1,
)

new_doclinks = r'''function docLinks(d){const out=[];for(const m of activeBankMatches().filter(m=>m.ar_document_id===d.id)){const b=bank.find(x=>x.id===m.bank_payment_id);if(b)out.push(`Transferencia ${esc(b.operation)} (${money(m.allocated_amount)})`)}for(const m of activeTuuMatches().filter(m=>m.ar_document_id===d.id)){const t=tuu.find(x=>x.id===m.tuu_transaction_id);if(t)out.push(`${isMp(t)?'Mercado Pago':'Tuu'} ${esc(String(t.provider_id||''))} (${money(t.amount)})`)}for(const l of activeCreditNoteLinks().filter(l=>l.target_document_id===d.id)){const cn=docs.find(x=>x.id===l.credit_note_id);if(cn)out.push(`NC ${esc(cn.folio)} (${money(-Number(l.allocated_amount||0))})`)}return out.join('<br>')||'—'}
function txnDocs'''
s, n = re.subn(r'function docLinks\(d\)\{.*?\}\nfunction txnDocs', new_doclinks, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('No se pudo actualizar docLinks')

new_render = r'''function renderDocs(){const q=($('qDocs').value||'').toLowerCase(),f=$('fDocs').value;$('tDocs').innerHTML=docs.filter(d=>Number(d.amount||0)!==0).filter(d=>{const nc=fiscalDocKind(d)==='nc';return nc?f==='all':rowFilter(f,docRemaining(d))}).filter(d=>!q||[d.folio,d.origin,d.customer_name,d.doc_type,d.amount,serviceLabel('doc',d),creditNoteTargetsLabel(d)].join(' ').toLowerCase().includes(q)).map(d=>{const nc=fiscalDocKind(d)==='nc',amount=fiscalDocAmount(d),pending=nc?'—':money(docRemaining(d)),status=nc?creditNoteStatusLabel(d):docStatus(d),links=nc?creditNoteTargetsLabel(d):docLinks(d),service=nc?'—':esc(serviceLabel('doc',d));let actions='';if(profile.role!=='lectura'){if(nc){actions=`<button class="btn primary" onclick="openCreditNoteLink(${d.id})">${creditNoteRemaining(d)>0?'Asociar documento':'Ver asociación'}</button>`}else{actions=`${docRemaining(d)>0?`<button class="btn primary" onclick="openRecon('doc',${d.id})">Conciliar</button>`:''}<button class="btn light" onclick="openService('doc',${d.id})">Servicio</button>`}}return `<tr><td>${esc(d.issue_date)}</td><td>${esc(d.doc_type)}</td><td>${d.folio}</td><td class="amount ${nc?'danger':''}">${money(amount)}</td><td class="amount">${pending}</td><td>${esc(d.origin||'—')}</td><td><span class="status ${nc?(creditNoteRemaining(d)>0?'warn':'oktxt'):docRemaining(d)===0?'oktxt':''}">${esc(status)}</span></td><td>${links}</td><td>${service}</td><td><div class="actions">${actions}</div></td></tr>`}).join('')}

function renderStatic'''
s, n = re.subn(r'function renderDocs\(\)\{.*?\}\n\nfunction renderStatic', new_render, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('No se pudo actualizar renderDocs')

p.write_text(s, encoding='utf-8')

idx = Path('index.html')
h = idx.read_text(encoding='utf-8')
h = h.replace('Pago(s) asociados', 'Pago(s) / ajustes')
h = re.sub(r'\./core\.js\?v=[^"\']+', './core.js?v=20260813-2', h)
if 'credit-notes.js' not in h:
    h = h.replace(
        '</script><script src="./report-service.js',
        '</script><script src="./credit-notes.js?v=20260813-1"></script><script src="./report-service.js',
        1,
    )
idx.write_text(h, encoding='utf-8')
