(()=>{
const base=window.mapImport;if(typeof base!=='function')return;
const pick=(o,terms)=>{for(const k of Object.keys(o||{})){const nk=norm(k);if(terms.some(t=>nk.includes(norm(t)))&&o[k]!==''&&o[k]!=null)return o[k]}return null};
const clean=v=>{const s=String(v??'').trim();return !s||s==='50'?null:s};
window.mapImport=function(source,objs){
 if(source!=='mp')return base(source,objs);
 const records=[],errors=[];
 for(let i=0;i<objs.length;i++)try{
  const o=objs[i],id=clean(pick(o,['operation_id','numero de operacion de mercado pago','id de operacion'])),date=dateIso(pick(o,['date_approved','fecha de acreditacion','date_created','fecha de compra'])),amount=Math.abs(num(pick(o,['transaction_amount','valor del producto','monto']))),netRaw=Math.abs(num(pick(o,['net_received_amount','monto recibido','monto neto'])));
  if(!id||!date||!amount)throw Error('faltan operation_id, fecha o transaction_amount');
  const status=norm(pick(o,['estado de la operacion','status'])||'');if(status.includes('rejected')||status.includes('cancel')){errors.push(`Fila ${i+1}: operación ${id} omitida por estado no aprobado.`);continue}
  const mpFee=Math.abs(num(pick(o,['mercadopago_fee','tarifa de mercado pago']))),marketFee=Math.abs(num(pick(o,['marketplace_fee','comision por uso de plataforma']))),finFee=Math.abs(num(pick(o,['financing_fee','costos de financiacion'])));let fee=mpFee+marketFee+finFee,net=netRaw||Math.max(0,amount-fee);if(netRaw&&amount>=netRaw)fee=amount-netRaw;
  const name=clean(pick(o,['counterpart_name','nombre de la contraparte'])),email=clean(pick(o,['counterpart_email','e mail de la contraparte'])),desc=clean(pick(o,['reason','descripcion de la operacion'])),ext=clean(pick(o,['external_reference','codigo de referencia'])),ticket=clean(pick(o,['ticket_number','numero de ticket'])),sg=serviceSuggestion(amount);
  records.push({provider_id:'mp:'+String(id).replace(/^mp:/i,''),txn_date:date,source:'Mercado Pago',customer_name:name||email||null,amount,fee,net,description:desc||ext||null,document_label:ticket||null,match_type:null,ar_status:'pendiente',severity:null,emission_status:'sin_alerta',suggested_type:sg?.service_type||null,suggested_periodicity:sg?.periodicity||null,suggested_frequency:sg?.frequency||0,suggested_registration:sg?.registration||false,suggested_stage:sg?.stage||null,confidence:sg?.confidence||null,classification_status:sg?'propuesta_disponible':'sin_clasificar'});
 }catch(e){errors.push(`Fila ${i+1}: ${e.message}`)}
 return {records,errors};
};
})();
