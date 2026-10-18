const installButton = document.querySelector('#pwa-install-trigger');
const iosHelp = document.querySelector('#pwa-ios-help');
const updateNotice = document.querySelector('#pwa-update');
const connectionStatus = document.querySelector('#pwa-connection-status');
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt;
let pendingWorker;
let reloading = false;

function showInstallOption() {
  installButton.hidden = standalone() || !(installPrompt || ios);
  installButton.textContent = installPrompt ? 'Instalar BE IMPORTS' : 'Adicionar à Tela de Início';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  showInstallOption();
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  showInstallOption();
});
installButton.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    showInstallOption();
    await prompt.prompt();
    await prompt.userChoice;
    return;
  }
  if (ios && !standalone()) iosHelp.showModal();
});
iosHelp.querySelector('button').addEventListener('click', () => iosHelp.close());

function updateConnectionStatus() {
  connectionStatus.hidden = navigator.onLine;
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();
showInstallOption();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const offerUpdate = () => {
        if (!navigator.serviceWorker.controller || !registration.waiting) return;
        pendingWorker = registration.waiting;
        updateNotice.hidden = false;
      };
      if (registration.waiting) offerUpdate();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', () => {
          if (registration.installing?.state === 'installed') offerUpdate();
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) location.reload();
      });
    } catch {
      // The store remains usable when service workers are unavailable.
    }
  });
}
updateNotice.querySelector('button').addEventListener('click', () => {
  if (!pendingWorker) return;
  reloading = true;
  pendingWorker.postMessage({ type: 'SKIP_WAITING' });
});
