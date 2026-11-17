'use strict';
const $=id=>document.getElementById(id);
const LABELS={date:'Fecha de visita',state:'Estado temporal',site:'Observatorio',unit:'Unidad orgánica',personType:'Tipo de persona',reason:'Motivo',visitor:'Visitante',dni:'DNI',room:'Ambiente',hours:'Horas estimadas',owner:'Responsable',sctr:'SCTR',timestamp:'Marca temporal',row:'Fila de origen',alerts:'Observaciones'};
const REPORT_LABELS={today:'Agenda de visitas de hoy',daily:'Agenda diaria',weekly:'Agenda semanal',monthly:'Agenda mensual',upcoming:'Próximas visitas por observatorio',unit:'Visitas por unidad orgánica',personType:'Visitas por tipo de persona',reason:'Visitas por motivo',sctr:'Visitas que requieren SCTR',owner:'Carga por responsable',room:'Uso de ambientes',hours:'Horas estimadas por observatorio y unidad',master:'Registro maestro filtrado',quality:'Calidad de datos',duplicates:'Posibles duplicados'};
const FILTER_LABELS={from:'Desde',to:'Hasta',state:'Estado',q:'Búsqueda',site:'Observatorio',unit:'Unidad orgánica',personType:'Tipo de persona',reason:'Motivo',sctr:'Requiere SCTR',owner:'Responsable',room:'Ambiente'};
// Exclusión intencional de texto libre y dimensiones que podrían identificar personas.
const PERSIST_KEYS=['from','to','site','unit','personType','reason','sctr','state'];
const state={data:null,filters:{},page:1,charts:[],report:null,request:0,visible:new Set(Object.keys(LABELS).filter(k=>k!=='alerts'&&k!=='row')),allUnits:false};
const num=n=>n==null?'—':new Intl.NumberFormat('es-PE',{maximumFractionDigits:1}).format(n);
function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;}
function button(text,fn,cls='secondary'){const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
function rpc(method,...args){return new Promise((resolve,reject)=>{
  if(window.DASHBOARD_API_URL){
    const actions={getDashboardData:'dashboard',getFilterOptions:'options',getReportData:'report',healthCheck:'health'};
    if(method==='invalidateCache'){resolve(true);return;}
    if(!actions[method]){reject(new Error('Operación no disponible en modo externo.'));return;}
    const url=new URL(window.DASHBOARD_API_URL,window.location.href);url.searchParams.set('format','json');url.searchParams.set('action',actions[method]);
    const filters=method==='getReportData'?args[1]:args[0];
    if(filters?.q||filters?.owner){reject(new Error('El modo JSON no permite búsqueda personal ni responsable en URL. Use el modo Apps Script.'));return;}
    if(filters)url.searchParams.set('filters',JSON.stringify(filters));if(method==='getReportData')url.searchParams.set('reportType',args[0]);
    fetch(url,{credentials:'include',redirect:'follow',headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw new Error('No se pudo consultar la API autenticada.');return r.json();}).then(data=>{if(data.error)throw new Error(data.error);resolve(data);}).catch(()=>reject(new Error('API no disponible. Revise autenticación, proxy y CORS; no publique la hoja para evitar este error.')));return;
  }
  if(!window.google?.script?.run){reject(new Error('Abra la URL /exec del despliegue de Apps Script. Este archivo requiere ese entorno.'));return;}
  google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args);
});}
function error(err){$('status').className='error';$('status').textContent=err?.message||'No se pudieron cargar los datos. Revise sus permisos e inténtelo nuevamente.';$('retry').hidden=false;}
function message(text){$('status').className='';$('status').textContent=text;$('retry').hidden=true;}
function busy(value){$('dashboard').classList.toggle('busy',value);$('dashboard').setAttribute('aria-busy',String(value));$('refresh').disabled=value;}
function formFilters(){const f={};new FormData($('filters')).forEach((v,k)=>{if(v)f[k]=v;});return f;}
function safeFilters(f){return Object.fromEntries(PERSIST_KEYS.filter(k=>f[k]).map(k=>[k,f[k]]));}
function restore(f){Object.entries(f).forEach(([k,v])=>{const field=$('filters').elements.namedItem(k);if(field&&typeof v==='string')field.value=v;});}
async function load(reset=false){
  if(reset){state.page=1;state.filters=formFilters();state.report=null;$('report').replaceChildren();$('reportActions').hidden=true;}
  const ticket=++state.request;busy(true);message('Leyendo y procesando registros…');
  try{const data=await rpc('getDashboardData',{...state.filters,page:state.page,pageSize:Number($('pageSize').value),sort:$('sort').value});
    if(ticket!==state.request)return;state.data=data;state.page=data.page;render();message(data.total?`${num(data.total)} registros coinciden con la vista.`:'No hay registros que coincidan con los filtros.');
  }catch(err){if(ticket===state.request)error(err);}finally{if(ticket===state.request){busy(false);$('kpis').classList.remove('skeleton');}}
}
function render(){
  const d=state.data;$('updated').textContent='Última lectura: '+new Date(d.readAt).toLocaleString('es-PE',{timeZone:'America/Lima'})+' · Lima';
  $('chips').replaceChildren();Object.entries(state.filters).filter(([k,v])=>v&&FILTER_LABELS[k]).forEach(([k,v])=>$('chips').append(node('span',FILTER_LABELS[k]+': '+v,'chip')));
  const k=d.kpis,comparison=d.comparison;
  const cards=[['Total de visitas',num(k.total),'Registros del periodo'],['Programadas para hoy',num(k.today),d.today],['Próximos 7 días',num(k.next7),'Desde mañana, en la vista'],['Horas acumuladas',num(k.hours),'Solo valores válidos'],['Horas por visita',num(k.average),'Promedio sobre horas válidas'],['Requieren SCTR',num(k.total?k.sctr/k.total*100:0)+'%',num(k.sctr)+' registros'],['Observatorios activos',num(k.sites),'En la vista'],['Unidades activas',num(k.units),'En la vista'],['Alertas de calidad',num(k.quality),'Registros por revisar'],['Variación del total',comparison?(comparison.change==null?'Sin base':num(comparison.change)+'%'):'—',comparison?`${comparison.from} a ${comparison.to}: ${comparison.count} registros. Mismos filtros; estado evaluado hoy.`:'Defina un rango de fechas']];
  $('kpis').replaceChildren(...cards.map(([label,value,detail])=>{const e=node('article',null,'kpi');e.append(node('span',label),node('strong',value),node('small',detail));e.title=detail;return e;}));
  renderCharts();renderTable();
}
function renderCharts(){
  state.charts.forEach(c=>c.destroy());state.charts=[];$('charts').replaceChildren();
  if(typeof Chart==='undefined'){$('charts').append(node('p','La biblioteca de gráficos no está disponible. Los indicadores, la tabla y los reportes siguen operativos.'));return;}
  const g=state.data.groups;
  const specs=[['timeline','Visitas por '+state.data.granularity,'line'],['site','Visitas por observatorio','bar'],['unit','Visitas por unidad orgánica','bar'],['personType','Tipo de persona','doughnut'],['reason','Motivo de visita','bar'],['sctr','SCTR por observatorio','stack'],['owner','Carga por responsable · códigos anónimos','bar'],['room','Ambientes más visitados','bar'],['hours','Horas estimadas por observatorio','bar'],['quality','Calidad · observaciones por tipo','bar']];
  specs.forEach(([key,title,type])=>{
    const card=node('section',null,'chartcard'),toolbar=node('div',null,'toolbar'),heading=node('h3',title),canvas=node('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title);
    const box=node('div',null,'chartbox');box.append(canvas);toolbar.append(heading);card.append(toolbar,box);$('charts').append(card);
    let rows=g[key];if(key==='unit'&&!state.allUnits)rows=rows.slice(0,10);
    if(key==='unit')toolbar.append(button(state.allUnits?'Top 10':'Ver todos',()=>{state.allUnits=!state.allUnits;renderCharts();}));
    if(type==='bar'&&rows.length>12)box.style.height=Math.min(1800,rows.length*25+60)+'px';
    let datasets=type==='stack'?['Sí','No','Sin dato'].map((s,i)=>({label:s,data:rows.map(r=>r.values[i]),backgroundColor:['#17649b','#90b9d6','#9a7436'][i]})):[{label:key==='hours'?'Horas estimadas':'Registros',data:rows.map(r=>r.value),backgroundColor:type==='doughnut'?['#123b61','#17649b','#3988bb','#81b9d8','#b1cede','#657f97','#a48243']:'#307fad',borderColor:'#17649b',borderWidth:type==='line'?2:0,tension:.2}];
    const chart=new Chart(canvas,{type:type==='stack'?'bar':type,data:{labels:rows.map(r=>r.label),datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,indexAxis:type==='bar'||type==='stack'?'y':'x',plugins:{legend:{display:true,position:'bottom'},tooltip:{enabled:true}},...(type==='doughnut'?{}:{scales:{x:{beginAtZero:true,stacked:type==='stack'},y:{beginAtZero:true,stacked:type==='stack',ticks:{autoSkip:false}}}})}});state.charts.push(chart);
    toolbar.append(button('PNG',()=>{const a=node('a');a.download='visitas_'+key+'.png';a.href=chart.toBase64Image();a.click();}));
    const accessible=node('details');accessible.append(node('summary','Ver datos del gráfico'));const list=node('ul');rows.forEach(r=>list.append(node('li',r.label+': '+(r.values?r.values.join(' / '):num(r.value)))));accessible.append(list);card.append(accessible);
  });
}
function table(rows,keys,interactive){
  const t=node('table'),head=node('thead'),hr=node('tr');keys.forEach(k=>hr.append(node('th',LABELS[k]||k)));if(interactive)hr.append(node('th','Detalle'));head.append(hr);t.append(head);const body=node('tbody');
  rows.forEach(r=>{const tr=node('tr',null,r.alerts?.length?'alert':'');keys.forEach(k=>{let value=r[k];if(Array.isArray(value))value=value.join('; ');const td=node('td',value==null?'—':value);td.dataset.label=LABELS[k]||k;if(k==='date'&&r.alerts?.length){const alert=node('span','⚠ '+r.alerts.length+' observaciones','badge');alert.title=r.alerts.join('; ');td.append(alert);}tr.append(td);});
    if(interactive){const td=node('td');td.dataset.label='Detalle';td.append(button('Abrir',()=>openDetail(r)));tr.append(td);}body.append(tr);});t.append(body);return t;
}
function renderTable(){
  const d=state.data,keys=Object.keys(LABELS).filter(k=>state.visible.has(k));$('table').replaceChildren(d.rows.length?table(d.rows,keys,true):node('p','No hay registros para mostrar.','empty'));
  const pages=Math.max(1,Math.ceil(d.total/d.pageSize));$('pagination').textContent=`Página ${d.page} de ${pages} · ${num(d.total)} registros`;$('prev').disabled=d.page<=1;$('next').disabled=d.page>=pages;
}
function openDetail(r){
  const dl=node('dl');Object.keys(LABELS).forEach(k=>{dl.append(node('dt',LABELS[k]),node('dd',Array.isArray(r[k])?r[k].join('; '):r[k]??'—'));});
  Object.entries(r.original||{}).forEach(([k,v])=>dl.append(node('dt',(LABELS[k]||k)+' · original'),node('dd',v)));
  $('modalbody').replaceChildren(dl);$('modal').showModal();
}
function addDays(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function quickRange(type,today){
  const first=today.slice(0,7)+'-01',next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  if(type==='Hoy')return {from:today,to:today};if(type==='Próximos 7 días')return {from:addDays(today,1),to:addDays(today,7)};
  if(type==='Próximos 30 días')return {from:addDays(today,1),to:addDays(today,30)};
  if(type==='Este mes')return {from:first,to:addDays(next.toISOString().slice(0,10),-1)};
  if(type==='Mes anterior'){const end=addDays(first,-1);return {from:end.slice(0,7)+'-01',to:end};}return {from:'',to:''};
}
function reportSummary(r){const filters=Object.entries(r.filters).filter(([k,v])=>v&&FILTER_LABELS[k]).map(([k,v])=>FILTER_LABELS[k]+': '+v).join(' · ');return `${r.title}\nPeriodo: ${r.filters.from||'Sin inicio'} — ${r.filters.to||'Sin fin'}\nFiltros: ${filters||'Sin filtros'}\nGenerado: ${new Date(r.generatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})} (Lima)\nTotal: ${r.total}\nFecha pasada no confirma asistencia.\nExportaciones: ${r.personalData?'datos personales habilitados; DNI enmascarado':'sin visitante, DNI ni responsable'}.`;}
async function report(type){
  const viewRequest=state.request;
  $('generate').disabled=true;$('reportActions').hidden=true;state.report=null;$('report').replaceChildren();message('Generando reporte…');
  try{const r=await rpc('getReportData',type,{...state.filters,anchor:$('anchor').value});if(viewRequest!==state.request)return;state.report=r;
    const title=node('h2',r.title),meta=node('p',reportSummary(r),'reportmeta'),summary=node('ul');r.summary.forEach(g=>summary.append(node('li',g.label+': '+num(g.value))));
    const keys=Object.keys(LABELS).filter(k=>!['visitor','dni','owner'].includes(k)||r.personalData),wrap=node('div',null,'reporttable');
    wrap.append(table(r.rows,keys,false));$('report').replaceChildren(title,meta,node('h3','Subtotales'),summary,wrap);$('reportActions').hidden=false;message('Reporte listo. Revise el periodo y los filtros antes de exportar.');
  }catch(err){error(err);}finally{$('generate').disabled=false;}
}
// Neutraliza fórmulas al abrir CSV en Excel; no convierte identificadores a números.
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csvText(r){
  const keys=Object.keys(LABELS).filter(k=>!['visitor','dni','owner'].includes(k)||r.personalData);
  const lines=[[r.title],[reportSummary(r)],[],['Subtotales','Valor'],...r.summary.map(g=>[g.label,g.value]),[],keys.map(k=>LABELS[k]),...r.rows.map(row=>keys.map(k=>Array.isArray(row[k])?row[k].join('; '):row[k]))];
  return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
function downloadCSV(){if(!state.report)return;const r=state.report,slug=String(r.filters.site||'todos').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_');const blob=new Blob([csvText(r)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=`reporte_visitas_${slug}_${r.filters.from||'inicio'}_${r.filters.to||'fin'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copyText(text){try{await navigator.clipboard.writeText(text);message('Copiado al portapapeles.');}catch(_){const dialog=$('modal');$('modalbody').replaceChildren(node('p','Seleccione y copie el texto:'));const ta=node('textarea');ta.value=text;ta.style.width='100%';ta.rows=8;$('modalbody').append(ta);dialog.showModal();ta.focus();ta.select();}}
async function init(){
  const dims=['site','unit','personType','reason','sctr','owner','room'];
  dims.forEach(k=>{const label=node('label',FILTER_LABELS[k]),select=node('select');select.name=k;select.append(new Option('Todos',''));label.append(select);$('filterfields').append(label);});
  Object.entries(REPORT_LABELS).forEach(([k,v])=>$('reportType').append(new Option(v,k)));
  Object.entries(LABELS).forEach(([k,v])=>{const label=node('label'),cb=node('input');cb.type='checkbox';cb.checked=state.visible.has(k);cb.addEventListener('change',()=>{cb.checked?state.visible.add(k):state.visible.delete(k);if(state.data)renderTable();});label.append(cb,document.createTextNode(v));$('columns').append(label);});
  ['Hoy','Próximos 7 días','Próximos 30 días','Este mes','Mes anterior','Todo'].forEach(type=>$('quick').append(button(type,()=>{if(!state.data)return;restore(quickRange(type,state.data.today));load(true);})));
  $('filters').addEventListener('submit',e=>{e.preventDefault();load(true);});
  let timer;$('filters').elements.q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),350);});
  $('clear').onclick=()=>{$('filters').reset();load(true);};
  $('save').onclick=()=>{try{localStorage.setItem('visits-view-v1',JSON.stringify(safeFilters(formFilters())));message('Vista guardada sin búsquedas ni filtros personales.');}catch(_){error(new Error('El navegador no permite guardar la vista.'));}};
  $('share').onclick=()=>{const query=new URLSearchParams(safeFilters(formFilters()));if(window.DASHBOARD_API_URL){copyText(window.location.origin+window.location.pathname+'?'+query.toString());return;}rpc('getWebAppUrl').then(base=>copyText(base+'?'+query.toString())).catch(error);};
  $('refresh').onclick=async()=>{try{busy(true);await rpc('invalidateCache');await options();await load(true);}catch(err){busy(false);error(err);}};
  $('retry').onclick=()=>boot();$('pageSize').onchange=()=>{state.page=1;load();};$('sort').onchange=()=>load();
  $('prev').onclick=()=>{state.page--;load();};$('next').onclick=()=>{state.page++;load();};$('closeModal').onclick=()=>$('modal').close();
  $('generate').onclick=()=>report($('reportType').value);$('exportFiltered').onclick=async()=>{await report('master');if(state.report)downloadCSV();};
  $('csv').onclick=downloadCSV;$('print').onclick=()=>{if(state.report)window.print();};$('copy').onclick=()=>state.report&&copyText(reportSummary(state.report));
  if(window.DASHBOARD_HOSTED){for(const name of ['q','owner']){const field=$('filters').elements.namedItem(name);field.disabled=true;field.title='Disponible en el dashboard protegido de Apps Script.';} $('refresh').textContent='↻ Consultar datos';}
  await boot();
}
async function options(){const opts=await rpc('getFilterOptions');Object.entries(opts).forEach(([k,values])=>{const el=$('filters').elements.namedItem(k),current=el.value;el.replaceChildren(new Option('Todos',''));values.forEach(v=>el.append(new Option(v,v)));el.value=current;});}
async function boot(){try{await options();try{restore(safeFilters(JSON.parse(localStorage.getItem('visits-view-v1')||'{}')));}catch(_){}
  if(window.google?.script?.url){await new Promise(resolve=>google.script.url.getLocation(loc=>{restore(safeFilters(loc.parameter||{}));resolve();}));}
  else if(window.DASHBOARD_API_URL)restore(safeFilters(Object.fromEntries(new URLSearchParams(window.location.search))));
  await load(true);if(state.data)$('anchor').value=state.data.today;
}catch(err){error(err);}}
if(window.DASHBOARD_READY) init();