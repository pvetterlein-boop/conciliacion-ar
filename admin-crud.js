(()=>{
const DAYS=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
let crudState={kind:null,id:null};
const canCatalogWrite=()=>profile&&['admin','conciliador'].includes(profile.role);
const canUserWrite=()=>profile?.role==='admin';

function addCrudStyle(){
  if(document.getElementById('adminCrudStyle'))return;
  const s=document.createElement('style');s.id='adminCrudStyle';s.textContent='.inactive-row{opacity:.58}.crud-days{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.crud-days label{display:flex;align-items:center;gap:7px;font-size:13px}.crud-days input{width:auto}.crud-note{font-size:11px;color:var(--muted);margin-top:8px}';document.head.appendChild(s);
}
function ensureActionHeader(tbodyId,extraHeaders){
  const body=document.getElementById(tbodyId),table=body?.closest('table'),row=table?.querySelector('thead tr');if(!row)return;
  const original=tbodyId==='tClasses'?2:tbodyId==='tRules'?6:4;
  if(row.children.length===original)extraHeaders.forEach(x=>{const th=document.createElement('th');th.textContent=x;row.appendChild(th)});
}
function ensurePanelButton(sectionId,id,label,onclick){
  const panel=document.querySelector(`#${sectionId} .panel`),head=panel?.querySelector('.panelhead');if(!panel)return;
  let target=head;
  if(!target){target=document.createElement('div');target.className='panelhead';const h=panel.querySelector('h3');if(h){h.parentNode.insertBefore(target,h);target.appendChild(h)}}
  if(target&&!document.getElementById(id)){const b=document.createElement('button');b.id=id;b.type='button';b.className='btn primary';b.textContent=label;b.onclick=onclick;target.appendChild(b)}
}
function ensureAdminCrudUi(){
  addCrudStyle();
  if(canCatalogWrite()){
    ensurePanelButton('classes','addClassBtn','Agregar clase',()=>openClassEditor());
    ensurePanelButton('rules','addRuleBtn','Agregar regla',()=>openRuleEditor());
  }
  if(canUserWrite()){
    const invite=document.querySelector('#users .panel');if(invite){const h=invite.querySelector('h3');if(h)h.textContent='Agregar usuario';const p=invite.querySelector('.lead');if(p)p.textContent='Crea una invitación de un solo uso para que el nuevo usuario defina su propia contraseña.'}
  }
  ensureActionHeader('tClasses',['Estado','Acciones']);
  ensureActionHeader('tRules',['Estado','Acciones']);
  ensureActionHeader('tUsers',['Acciones']);
  ensureCrudModal();
}
function ensureCrudModal(){
  if(document.getElementById('adminCrudModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="adminCrudModal" class="modalback hidden"><div class="modal"><div class="modalhead"><b id="adminCrudTitle">Editar</b><button class="btn light" type="button" onclick="closeAdminCrud()">Cerrar</button></div><div class="modalbody"><div id="adminCrudBody"></div><div id="adminCrudMsg" class="msg"></div></div><div class="modalfoot"><button class="btn primary" type="button" onclick="saveAdminCrud()">Guardar</button></div></div></div>`);
}
function renderCatalogCrud(){
  ensureAdminCrudUi();
  const classBody=document.getElementById('tClasses');
  if(classBody)classBody.innerHTML=classes.map(c=>{const days=classSessions.filter(s=>s.class_id===c.id&&s.active).map(s=>s.day_name).join(', ')||'—';const actions=canCatalogWrite()?`<div class="actions"><button class="btn light" onclick="openClassEditor(${c.id})">Editar</button>${c.active?`<button class="btn light danger" onclick="toggleClassActive(${c.id},false)">Eliminar</button>`:`<button class="btn light" onclick="toggleClassActive(${c.id},true)">Reactivar</button>`}</div>`:'';return `<tr class="${c.active?'':'inactive-row'}"><td>${esc(c.exact_label)}</td><td>${days.split(', ').map(esc).join(', ')}</td><td><span class="status ${c.active?'oktxt':'warn'}">${c.active?'Activo':'Inactivo'}</span></td><td>${actions}</td></tr>`}).join('');
  const ruleBody=document.getElementById('tRules');
  if(ruleBody)ruleBody.innerHTML=rules.map(r=>{const actions=canCatalogWrite()?`<div class="actions"><button class="btn light" onclick="openRuleEditor(${r.id})">Editar</button>${r.active?`<button class="btn light danger" onclick="toggleRuleActive(${r.id},false)">Eliminar</button>`:`<button class="btn light" onclick="toggleRuleActive(${r.id},true)">Reactivar</button>`}</div>`:'';return `<tr class="${r.active?'':'inactive-row'}"><td class="amount">${money(r.amount)}</td><td>${esc(r.service_type)}</td><td>${esc(r.periodicity)}</td><td>${Number(r.frequency||0)}</td><td>${r.registration?'Sí':'No'}</td><td>${esc(r.confidence||'—')}</td><td><span class="status ${r.active?'oktxt':'warn'}">${r.active?'Activo':'Inactivo'}</span></td><td>${actions}</td></tr>`}).join('');
  const userBody=document.getElementById('tUsers');
  if(userBody&&profile?.role==='admin')userBody.innerHTML=users.map(u=>{const own=u.id===profile.id;const actions=`<div class="actions"><button class="btn light" onclick="openUserEditor('${u.id}')">Editar</button>${own?'':u.active?`<button class="btn light danger" onclick="toggleUserActive('${u.id}',false)">Eliminar</button>`:`<button class="btn light" onclick="toggleUserActive('${u.id}',true)">Reactivar</button>`}</div>`;return `<tr class="${u.active?'':'inactive-row'}"><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td><span class="status ${u.active?'oktxt':'warn'}">${u.active?'Sí':'No'}</span></td><td>${actions}</td></tr>`}).join('');
  scheduleTableSorting?.();
}

const baseRenderStatic=window.renderStatic;
if(typeof baseRenderStatic==='function')window.renderStatic=function(){baseRenderStatic();renderCatalogCrud()};

const actionError=e=>{console.error(e);alert(e?.message||'No fue posible completar la operación.')};
function field(id,label,html){return `<div class="field"><label for="${id}">${label}</label>${html}</div>`}
function openModal(title,body){ensureCrudModal();document.getElementById('adminCrudTitle').textContent=title;document.getElementById('adminCrudBody').innerHTML=body;clearMsg('adminCrudMsg');document.getElementById('adminCrudModal').classList.remove('hidden')}
window.closeAdminCrud=()=>{document.getElementById('adminCrudModal')?.classList.add('hidden');crudState={kind:null,id:null}};

window.openClassEditor=(id=null)=>{
  if(!canCatalogWrite())return;const c=id?classes.find(x=>x.id===id):null;crudState={kind:'class',id:id||null};const selected=new Set(c?classSessions.filter(s=>s.class_id===c.id&&s.active).map(s=>String(s.day_name).toLowerCase()):[]);
  openModal(c?'Editar clase':'Agregar clase',field('crudClassLabel','Nombre exacto de la clase',`<input id="crudClassLabel" value="${esc(c?.exact_label||'')}" placeholder="Ej. 17:00 Mini Ninja" required>`)+`<div class="field"><label>Días disponibles</label><div class="crud-days">${DAYS.map(d=>`<label><input type="checkbox" name="crudClassDay" value="${d}" ${selected.has(d)?'checked':''}> ${d}</label>`).join('')}</div></div>`+field('crudClassActive','Estado',`<select id="crudClassActive"><option value="true" ${c?.active!==false?'selected':''}>Activo</option><option value="false" ${c?.active===false?'selected':''}>Inactivo</option></select>`));
};
window.openRuleEditor=(id=null)=>{
  if(!canCatalogWrite())return;const r=id?rules.find(x=>x.id===id):null;crudState={kind:'rule',id:id||null};
  openModal(r?'Editar regla de servicio':'Agregar regla de servicio',`<div class="formgrid">${field('crudRuleAmount','Monto',`<input id="crudRuleAmount" type="number" min="0" value="${Number(r?.amount||0)}" required>`)}${field('crudRuleService','Servicio',`<input id="crudRuleService" value="${esc(r?.service_type||'')}" placeholder="Ej. Plan Mensual" required>`)}${field('crudRulePeriod','Periodicidad',`<select id="crudRulePeriod">${['No aplica','Mensual','Bimensual','Trimestral','Semestral'].map(v=>`<option ${String(r?.periodicity||'No aplica')===v?'selected':''}>${v}</option>`).join('')}</select>`)}${field('crudRuleFreq','Frecuencia semanal',`<input id="crudRuleFreq" type="number" min="0" max="7" value="${Number(r?.frequency||0)}">`)}${field('crudRuleConfidence','Confianza',`<input id="crudRuleConfidence" value="${esc(r?.confidence||'alta')}" placeholder="alta, media o baja">`)}${field('crudRuleActive','Estado',`<select id="crudRuleActive"><option value="true" ${r?.active!==false?'selected':''}>Activo</option><option value="false" ${r?.active===false?'selected':''}>Inactivo</option></select>`)}</div><div class="field"><label><input id="crudRuleRegistration" type="checkbox" style="width:auto" ${r?.registration?'checked':''}> Incluye matrícula</label></div>${field('crudRuleNotes','Notas',`<textarea id="crudRuleNotes" placeholder="Opcional">${esc(r?.notes||'')}</textarea>`)}`);
};
window.openUserEditor=(id)=>{
  if(!canUserWrite())return;const u=users.find(x=>x.id===id);if(!u)return;const own=id===profile.id;crudState={kind:'user',id};
  openModal('Editar usuario',`${field('crudUserName','Nombre',`<input id="crudUserName" value="${esc(u.full_name||'')}" required>`)}${field('crudUserEmail','Correo',`<input id="crudUserEmail" value="${esc(u.email||'')}" disabled>`)}${field('crudUserRole','Rol',`<select id="crudUserRole" ${own?'disabled':''}><option value="admin" ${u.role==='admin'?'selected':''}>Administrador</option><option value="conciliador" ${u.role==='conciliador'?'selected':''}>Conciliador</option><option value="lectura" ${u.role==='lectura'?'selected':''}>Solo lectura</option></select>`)}${field('crudUserActive','Estado',`<select id="crudUserActive" ${own?'disabled':''}><option value="true" ${u.active?'selected':''}>Activo</option><option value="false" ${!u.active?'selected':''}>Inactivo</option></select>`)}${own?'<div class="crud-note">Para evitar bloquear tu propia cuenta, tu rol y estado no se pueden cambiar desde esta pantalla.</div>':''}`);
};

async function syncClassDays(classId,selected){
  const existing=classSessions.filter(s=>s.class_id===classId);
  for(const s of existing){const want=selected.has(String(s.day_name).toLowerCase());if(Boolean(s.active)!==want)await rest(`class_sessions?id=eq.${encodeURIComponent(s.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:want})})}
  for(const day of selected){if(!existing.some(s=>String(s.day_name).toLowerCase()===day))await rest('class_sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({class_id:classId,day_name:day,active:true})})}
}
async function saveClass(){
  const label=document.getElementById('crudClassLabel').value.trim(),active=document.getElementById('crudClassActive').value==='true',selected=new Set([...document.querySelectorAll('input[name="crudClassDay"]:checked')].map(x=>x.value));if(!label)throw new Error('Ingresa el nombre de la clase.');let id=crudState.id;
  if(id)await rest(`classes?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({exact_label:label,active})});else{const rows=await rest('classes',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({exact_label:label,active})});id=rows?.[0]?.id;if(!id)throw new Error('No fue posible obtener la nueva clase.')}
  await syncClassDays(id,active?selected:new Set());await rpc('log_ar_action',{p_action:crudState.id?'CLASS_UPDATED':'CLASS_CREATED',p_entity_type:'class',p_entity_id:String(id),p_metadata:{exact_label:label,active,days:[...selected]}});
}
async function saveRule(){
  const payload={amount:Number(document.getElementById('crudRuleAmount').value||0),service_type:document.getElementById('crudRuleService').value.trim(),periodicity:document.getElementById('crudRulePeriod').value,frequency:Number(document.getElementById('crudRuleFreq').value||0),registration:document.getElementById('crudRuleRegistration').checked,confidence:document.getElementById('crudRuleConfidence').value.trim()||'alta',active:document.getElementById('crudRuleActive').value==='true',notes:document.getElementById('crudRuleNotes').value.trim()||null};if(!payload.service_type)throw new Error('Ingresa el nombre del servicio.');if(payload.amount<0)throw new Error('El monto no puede ser negativo.');
  let id=crudState.id;if(id)await rest(`service_rules?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});else{const rows=await rest('service_rules',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});id=rows?.[0]?.id}
  await rpc('log_ar_action',{p_action:crudState.id?'SERVICE_RULE_UPDATED':'SERVICE_RULE_CREATED',p_entity_type:'service_rule',p_entity_id:String(id||''),p_metadata:payload});
}
async function saveUser(){
  if(!canUserWrite())throw new Error('Solo un administrador puede editar usuarios.');const u=users.find(x=>x.id===crudState.id);if(!u)throw new Error('Usuario no encontrado.');const own=u.id===profile.id,payload={full_name:document.getElementById('crudUserName').value.trim()};if(!payload.full_name)throw new Error('Ingresa el nombre del usuario.');if(!own){payload.role=document.getElementById('crudUserRole').value;payload.active=document.getElementById('crudUserActive').value==='true'}
  await rest(`profiles?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});await rpc('log_ar_action',{p_action:'USER_PROFILE_UPDATED',p_entity_type:'profile',p_entity_id:String(u.id),p_metadata:{full_name:payload.full_name,role:payload.role??u.role,active:payload.active??u.active}});if(own){profile.full_name=payload.full_name;document.getElementById('uName').textContent=payload.full_name}
}
window.saveAdminCrud=async()=>{
  clearMsg('adminCrudMsg');try{if(crudState.kind==='class')await saveClass();else if(crudState.kind==='rule')await saveRule();else if(crudState.kind==='user')await saveUser();else return;await loadAll();msg('adminCrudMsg','Cambios guardados.',true);setTimeout(()=>closeAdminCrud(),450)}catch(e){msg('adminCrudMsg',e.message)}
};
window.toggleClassActive=async(id,active)=>{if(!canCatalogWrite())return;if(!active&&!confirm('¿Eliminar esta clase? Se desactivará para nuevas selecciones, pero se conservará el historial.'))return;try{await rest(`classes?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active})});if(!active)await rest(`class_sessions?class_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:false})});await rpc('log_ar_action',{p_action:active?'CLASS_REACTIVATED':'CLASS_DEACTIVATED',p_entity_type:'class',p_entity_id:String(id),p_metadata:{}});await loadAll()}catch(e){actionError(e)}};
window.toggleRuleActive=async(id,active)=>{if(!canCatalogWrite())return;if(!active&&!confirm('¿Eliminar esta regla? Se desactivará, pero se conservará para auditoría.'))return;try{await rest(`service_rules?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active})});await rpc('log_ar_action',{p_action:active?'SERVICE_RULE_REACTIVATED':'SERVICE_RULE_DEACTIVATED',p_entity_type:'service_rule',p_entity_id:String(id),p_metadata:{}});await loadAll()}catch(e){actionError(e)}};
window.toggleUserActive=async(id,active)=>{if(!canUserWrite())return;if(id===profile.id)return alert('No puedes desactivar tu propia cuenta.');const u=users.find(x=>x.id===id);if(!u)return;if(!active&&!confirm(`¿Eliminar el acceso de ${u.full_name}? La cuenta quedará desactivada y podrá reactivarse después.`))return;try{await rest(`profiles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active})});await rpc('log_ar_action',{p_action:active?'USER_REACTIVATED':'USER_DEACTIVATED',p_entity_type:'profile',p_entity_id:String(id),p_metadata:{email:u.email}});await loadAll()}catch(e){actionError(e)}};

document.addEventListener('DOMContentLoaded',()=>ensureAdminCrudUi());
})();
