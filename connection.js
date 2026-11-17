'use strict';
(() => {
  const config=window.DASHBOARD_CONFIG||{};
  window.DASHBOARD_HOSTED=true;
  function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u:null;}catch(_){return null;}}
  const api=https(config.apiUrl);
  window.DASHBOARD_API_URL=config.mode==='api'&&api?api.href:'';
  window.DASHBOARD_READY=Boolean(window.DASHBOARD_API_URL);
  const panel=document.getElementById('connection');
  const title=document.createElement('h2'),text=document.createElement('p');
  if(config.mode==='api'&&api){
    title.textContent='Conexión institucional';text.textContent='Los datos se consultan en la API autenticada. GitHub Pages solo aloja la interfaz.';
  }else if(config.mode==='apps-script'){
    title.textContent='Acceder al dashboard protegido';text.textContent='El dashboard completo se abre en Google Apps Script, donde se verifica su cuenta y el permiso de lectura de la hoja.';
  }else{
    title.textContent='Conexión pendiente';text.textContent='Configure un modo válido y una URL HTTPS en public/config.js antes de consultar datos.';
  }
  panel.append(title,text);
  const script=https(config.appsScriptUrl);
  if(script&&script.hostname==='script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(script.pathname)){
    const link=document.createElement('a');link.href=script.href;link.className='actionlink';link.textContent='Abrir dashboard en Google';link.rel='noreferrer';panel.append(link);
  }else if(config.mode==='apps-script'){
    const help=document.createElement('p');help.textContent='Falta configurar appsScriptUrl con la URL /exec del despliegue. Consulte la guía del repositorio.';panel.append(help);
  }
  const login=https(config.loginUrl);
  if(config.mode==='api'&&login){const a=document.createElement('a');a.href=login.href;a.textContent='Iniciar sesión institucional';a.className='actionlink';a.rel='noreferrer';panel.append(a);}
  if(!window.DASHBOARD_READY){
    document.querySelectorAll('main > :not(#connection)').forEach(e=>{e.hidden=true;});
    document.getElementById('refresh').hidden=true;
    document.getElementById('updated').textContent='Interfaz publicada · conexión de datos separada';
  }
})();
