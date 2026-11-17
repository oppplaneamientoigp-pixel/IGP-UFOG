// Configuración pública: no coloque contraseñas, tokens ni datos personales.
window.DASHBOARD_CONFIG = Object.freeze({
  // 'apps-script': acceso al dashboard protegido en Google (sin proxy).
  // 'api': dashboard en GitHub Pages con API autenticada compatible.
  mode: 'apps-script',
  appsScriptUrl: '', // https://script.google.com/macros/s/DEPLOYMENT_ID/exec
  apiUrl: '', // https://api.su-entidad.gob.pe/visitas
  loginUrl: '' // Inicio de sesión del proveedor de la API, si corresponde.
});
