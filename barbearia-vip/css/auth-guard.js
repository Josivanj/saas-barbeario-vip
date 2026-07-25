const BARBEARIA_VIP_SESSION_KEY = "barbeariaVipAdminSession";

const barbeariaVipSession =
  localStorage.getItem(BARBEARIA_VIP_SESSION_KEY) ||
  sessionStorage.getItem(BARBEARIA_VIP_SESSION_KEY);

if (barbeariaVipSession !== "authenticated") {
  window.location.replace("login.html");
}

function logoutBarbeariaVip() {
  localStorage.removeItem(BARBEARIA_VIP_SESSION_KEY);
  sessionStorage.removeItem(BARBEARIA_VIP_SESSION_KEY);
  window.location.replace("login.html");
}
