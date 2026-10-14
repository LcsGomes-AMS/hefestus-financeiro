'use strict';
// Não armazena dados financeiros offline nem interfere nas sessões.
const appMode = window.matchMedia('(display-mode: standalone)');
function updateAppMode() {
  const installed = appMode.matches || window.navigator.standalone === true;
  document.documentElement.classList.toggle('installed-app', installed);
  document.getElementById('install-help').hidden = installed;
}
appMode.addEventListener('change', updateAppMode);
updateAppMode();
