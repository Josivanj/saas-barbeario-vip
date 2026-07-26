let deferredInstallPrompt = null;

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js")
    .catch(error => console.warn("Aplicativo não pôde ser ativado:", error)));
}

function createInstallButton() {
  if (document.getElementById("installVipApp") || window.matchMedia("(display-mode: standalone)").matches) return;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const button = document.createElement("button");
  button.id = "installVipApp";
  button.className = "pwa-install-button";
  button.type = "button";
  button.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i><span>Instalar aplicativo</span>';
  button.hidden = !deferredInstallPrompt && !isIOS;
  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      alert("No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início”.");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    button.hidden = true;
  });
  document.body.appendChild(button);
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  createInstallButton();
  document.getElementById("installVipApp").hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.getElementById("installVipApp")?.remove();
});

document.addEventListener("DOMContentLoaded", createInstallButton);
