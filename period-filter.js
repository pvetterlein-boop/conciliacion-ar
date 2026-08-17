(()=>{
const PERIOD_KEY='ar_selected_period';
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let selectedPeriod=localStorage.getItem(PERIOD_KEY)||(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();
let scopeDepth=0,crossPeriodRecon=false;
let fullRefs={tuu,bank,docs,bankMatches,tuuMatches,creditNoteLinks};

function periodOf(date){const s=String(date||'').trim();return /^\d{4}-\d{2}/.test(s)?s.slice(0,7):''}
function inSelectedPeriod(date){return !selectedPeriod||periodOf(date)===selectedPeriod}
function periodLabel(){if(!selectedPeriod)return 'Todos los períodos';const [y,m]=selectedPeriod.split('-').map(Number);return `${MONTHS[m-1]||m} ${y}`.replace(/^./,c=>c.toUpperCase())}
function lastDay(period){const [y,m]=period.split('-').map(Number);return new Date(y,m,0).getDate()}
function selectedIds(rows,dateField){return new Set(rows.filter(x=>inSelectedPeriod(x?.[dateField])).map(x=>Number(x.id)))}

const baseTuuRows=window.tuuRows;
const baseMpRows=window.mpRows;
if(typeof baseTuuRows==='function')window.tuuRows=function(){const rows=baseTuuRows();return crossPeriodRecon?rows:rows.filter(x=>inSelectedPeriod(x.txn_date))};
if(typeof baseMpRows==='function')window.mpRows=function(){const rows=baseMpRows();return crossPeriodRecon?rows:rows.filter(x=>inSelectedPeriod(x.txn_date))};

function withPeriodScope(fn,{keepTuuFull=false,keepDocsFull=false,keepBankFull=false}={}){
  if(!selectedPeriod)return fn();
  const old={tuu,bank,docs,bankMatches,tuuMatches,creditNoteLinks};
  if(scopeDepth===0)fullRefs={tuu:old.tuu,bank:old.bank,docs:old.docs,bankMatches:old.bankMatches,tuuMatches:old.tuuMatches,creditNoteLinks:old.creditNoteLinks};
  scopeDepth++;
  const all=fullRefs;
  const bankIds=selectedIds(all.bank,'payment_date');
  const txnIds=selectedIds(all.tuu,'txn_date');
  const periodDocs=all.docs.filter(d=>inSelectedPeriod(d.issue_date));
  const docIds=new Set(periodDocs.map(d=>Number(d.id)));
  const ncIds=new Set(periodDocs.filter(d=>typeof fiscalDocKind==='function'?fiscalDocKind(d)==='nc':String(d.doc_type||'').toLowerCase().includes('nota')).map(d=>Number(d.id)));
  bank=keepBankFull?all.bank:all.bank.filter(x=>bankIds.has(Number(x.id)));
  docs=keepDocsFull?all.docs:periodDocs;
  tuu=keepTuuFull?all.tuu:all.tuu.filter(x=>txnIds.has(Number(x.id)));
  // Una conciliación puede unir un pago de N con un documento emitido en N+1.
  // Conservamos el vínculo si cualquiera de sus extremos pertenece al período visible.
  bankMatches=all.bankMatches.filter(m=>bankIds.has(Number(m.bank_payment_id))||docIds.has(Number(m.ar_document_id)));
  tuuMatches=all.tuuMatches.filter(m=>txnIds.has(Number(m.tuu_transaction_id))||docIds.has(Number(m.ar_document_id)));
  creditNoteLinks=all.creditNoteLinks.filter(l=>ncIds.has(Number(l.credit_note_id))||docIds.has(Number(l.target_document_id)));
  try{return fn()}finally{tuu=old.tuu;bank=old.bank;docs=old.docs;bankMatches=old.bankMatches;tuuMatches=old.tuuMatches;creditNoteLinks=old.creditNoteLinks;scopeDepth--}
}

function wrapPeriodRenderer(name,opts){const base=window[name];if(typeof base!=='function'||base.__periodWrapped)return;const w=function(...args){return withPeriodScope(()=>base.apply(this,args),opts)};w.__periodWrapped=true;window[name]=w}
// Cada vista filtra sus filas por su propia fecha, pero mantiene disponible el otro extremo
// de la conciliación para poder mostrar asociaciones que cruzan de un mes a otro.
wrapPeriodRenderer('renderTuu',{keepTuuFull:true,keepDocsFull:true});
wrapPeriodRenderer('renderMp',{keepTuuFull:true,keepDocsFull:true});
wrapPeriodRenderer('renderBank',{keepDocsFull:true});
wrapPeriodRenderer('renderDocs',{keepTuuFull:true,keepBankFull:true});
wrapPeriodRenderer('renderConsolidated',{keepDocsFull:true});

const baseRender=window.render;
if(typeof baseRender==='function'){
  window.render=function(...args){const out=withPeriodScope(()=>baseRender.apply(this,args),{keepTuuFull:true});updatePeriodUi();return out};
}

const baseOpenRecon=window.openRecon;
if(typeof baseOpenRecon==='function')window.openRecon=function(kind,id){
  // La conciliación manual no se limita al mes seleccionado. Esto permite, por ejemplo,
  // pago 31/07 -> boleta 01/08 sin alterar las fechas originales.
  const old=crossPeriodRecon;crossPeriodRecon=true;
  try{return baseOpenRecon(kind,id)}finally{crossPeriodRecon=old}
};

const baseOpenManualLine=window.openManualLine;
if(typeof baseOpenManualLine==='function')window.openManualLine=function(kind){const out=baseOpenManualLine(kind);if(selectedPeriod){const el=document.getElementById('mlDate');if(el){const day=Math.min(new Date().getDate(),lastDay(selectedPeriod));el.value=`${selectedPeriod}-${String(day).padStart(2,'0')}`}}return out};

function syncConsolidatedRange(){const from=document.getElementById('cFrom'),to=document.getElementById('cTo');if(!from||!to)return;if(!selectedPeriod){from.value='';to.value=''}else{from.value=selectedPeriod+'-01';to.value=`${selectedPeriod}-${String(lastDay(selectedPeriod)).padStart(2,'0')}`}}
function updatePeriodUi(){const input=document.getElementById('arPeriodMonth'),label=document.getElementById('arPeriodLabel');if(input&&input.value!==selectedPeriod)input.value=selectedPeriod;if(label)label.textContent=periodLabel()}
function setPeriod(value){selectedPeriod=String(value||'').trim();if(selectedPeriod)localStorage.setItem(PERIOD_KEY,selectedPeriod);else localStorage.removeItem(PERIOD_KEY);syncConsolidatedRange();updatePeriodUi();if(typeof render==='function')render()}
window.setArPeriod=setPeriod;
window.getArPeriod=()=>selectedPeriod;
window.inArPeriod=inSelectedPeriod;

function addPeriodUi(){
  if(document.getElementById('arPeriodControl'))return;
  const top=document.querySelector('.top');if(!top)return;
  const style=document.createElement('style');style.id='arPeriodStyle';style.textContent='.period-control{display:flex;align-items:center;gap:7px;margin-left:auto;margin-right:12px}.period-control label{font-size:11px;color:var(--muted);font-weight:750}.period-control input{border:1px solid #d4dce6;border-radius:9px;padding:7px 9px;background:#fff;color:#172033}.period-label{font-size:11px;font-weight:800;color:var(--teal);white-space:nowrap}@media(max-width:700px){.top{height:auto;min-height:68px;flex-wrap:wrap;padding:10px 14px}.period-control{order:3;width:100%;margin:4px 0 0}.period-label{display:none}}';document.head.appendChild(style);
  const box=document.createElement('div');box.id='arPeriodControl';box.className='period-control';box.innerHTML=`<label for="arPeriodMonth">Período</label><input id="arPeriodMonth" type="month" value="${selectedPeriod}"><button id="arPeriodAll" class="btn light" type="button">Todos</button><span id="arPeriodLabel" class="period-label">${periodLabel()}</span>`;
  const role=document.getElementById('role');top.insertBefore(box,role);
  document.getElementById('arPeriodMonth').addEventListener('change',e=>setPeriod(e.target.value));
  document.getElementById('arPeriodAll').addEventListener('click',()=>setPeriod(''));
  syncConsolidatedRange();

  const uploadLead=document.querySelector('#uploads .panel .lead');
  if(uploadLead&&!document.getElementById('historicalUploadNote')){const n=document.createElement('div');n.id='historicalUploadNote';n.className='notice';n.style.marginTop='12px';n.textContent='Puedes cargar archivos de meses anteriores. El pago conserva su fecha real y el documento su fecha tributaria; una conciliación puede cruzar de un mes al siguiente.';uploadLead.insertAdjacentElement('afterend',n)}
}

const download=document.getElementById('downloadXlsx');
if(download&&typeof download.onclick==='function'){
  const baseDownload=download.onclick;
  download.onclick=function(e){return withPeriodScope(()=>baseDownload.call(this,e),{keepDocsFull:false})};
}

addPeriodUi();
setTimeout(()=>{addPeriodUi();syncConsolidatedRange();if(profile&&typeof render==='function')render()},0);
})();
