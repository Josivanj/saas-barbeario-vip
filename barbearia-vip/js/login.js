const loginForm = document.getElementById("loginForm");
const loginAlert = document.getElementById("loginAlert");
const loginButton = document.getElementById("loginButton");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
const forgotPassword = document.getElementById("forgotPassword");
const identifierInput = document.getElementById("identifier");
const ATTEMPT_KEY = "barbeariaVipLoginAttempts";

function showAlert(message, type) {
  loginAlert.textContent = message;
  loginAlert.className = `login-alert visible ${type}`;
}

function normalizeBrazilianPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? `+${digits}` : "";
}

// Convites e links de recuperação chegam com uma sessão temporária.
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) return;
  const isPasswordSetup = location.hash.includes("type=invite")
    || location.hash.includes("type=recovery")
    || new URLSearchParams(location.search).has("invite")
    || new URLSearchParams(location.search).has("recovery");
  if (!isPasswordSetup) return window.location.replace("admin.html");

  document.querySelector(".login-label").textContent = "Nova senha";
  document.querySelector(".login-card h2").textContent = "Crie sua senha";
  document.querySelector(".login-subtitle").textContent = "Defina uma nova senha para acessar a administração.";
  loginForm.innerHTML = `
    <div class="login-field"><label for="newPassword">Nova senha</label><div class="login-input"><i class="fa-solid fa-lock"></i><input type="password" id="newPassword" minlength="6" required placeholder="Mínimo de 6 caracteres"></div></div>
    <div class="login-field"><label for="confirmPassword">Confirmar senha</label><div class="login-input"><i class="fa-solid fa-lock"></i><input type="password" id="confirmPassword" minlength="6" required placeholder="Repita a senha"></div></div>
    <button type="submit" class="login-button" id="saveInvitePassword"><i class="fa-solid fa-check"></i> Salvar senha e entrar</button>`;
  loginForm.dataset.passwordSetup = "true";
})();

togglePassword?.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.innerHTML = showing
    ? '<i class="fa-regular fa-eye"></i>'
    : '<i class="fa-regular fa-eye-slash"></i>';
});

forgotPassword?.addEventListener("click", async () => {
  const identifier = identifierInput.value.trim();
  if (!identifier) return showAlert("Informe seu e-mail para recuperar a senha.", "error");
  if (!identifier.includes("@")) {
    return showAlert("Para acesso por telefone, peça ao administrador para criar uma nova senha.", "error");
  }

  forgotPassword.disabled = true;
  const redirectTo = `${window.location.origin}/login.html?recovery=1`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(identifier.toLowerCase(), { redirectTo });
  forgotPassword.disabled = false;
  if (error) return showAlert(error.message || "Não foi possível enviar a recuperação.", "error");
  showAlert("Enviamos um link de recuperação para seu e-mail.", "success");
});

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (loginForm.dataset.passwordSetup === "true") {
    const password = document.getElementById("newPassword").value;
    const confirmation = document.getElementById("confirmPassword").value;
    if (password.length < 6) return showAlert("A senha deve ter pelo menos 6 caracteres.", "error");
    if (password !== confirmation) return showAlert("As senhas não coincidem.", "error");
    const button = document.getElementById("saveInvitePassword");
    button.disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      button.disabled = false;
      return showAlert(error.message || "Não foi possível salvar a senha.", "error");
    }
    window.location.replace("admin.html");
    return;
  }

  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;
  const attempts = JSON.parse(localStorage.getItem(ATTEMPT_KEY) || '{"count":0,"blockedUntil":0}');
  if (Number(attempts.blockedUntil) > Date.now()) {
    const minutes = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
    return showAlert(`Muitas tentativas. Aguarde ${minutes} minuto(s).`, "error");
  }

  const credentials = identifier.includes("@")
    ? { email: identifier.toLowerCase(), password }
    : { phone: normalizeBrazilianPhone(identifier), password };
  if (!credentials.email && !credentials.phone) {
    return showAlert("Informe um telefone ou e-mail válido.", "error");
  }

  loginButton.disabled = true;
  loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  try {
    const { error } = await supabaseClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    localStorage.removeItem(ATTEMPT_KEY);
    window.location.replace("admin.html");
  } catch (error) {
    const nextCount = Number(attempts.count || 0) + 1;
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify({
      count: nextCount >= 5 ? 0 : nextCount,
      blockedUntil: nextCount >= 5 ? Date.now() + 5 * 60000 : 0
    }));
    showAlert(
      error.message === "Invalid login credentials"
        ? "Telefone, e-mail ou senha incorretos."
        : (error.message || "Não foi possível entrar."),
      "error"
    );
    loginButton.disabled = false;
    loginButton.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
  }
});
