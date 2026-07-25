const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');
const loginButton = document.getElementById('loginButton');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

function showAlert(message, type) {
  loginAlert.textContent = message;
  loginAlert.className = `login-alert visible ${type}`;
}

// Convites do Supabase chegam com uma sessão temporária. Antes de abrir o
// painel, o novo administrador define uma senha própria.
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) return;
  const isInvite = location.hash.includes('type=invite') || location.hash.includes('type=recovery') || new URLSearchParams(location.search).has('invite');
  if (!isInvite) return window.location.replace('admin.html');

  document.querySelector('.login-label').textContent = 'Primeiro acesso';
  document.querySelector('.login-card h2').textContent = 'Crie sua senha';
  document.querySelector('.login-subtitle').textContent = 'Defina uma senha segura para acessar a administração.';
  loginForm.innerHTML = `
    <div class="login-field"><label for="newPassword">Nova senha</label><div class="login-input"><i class="fa-solid fa-lock"></i><input type="password" id="newPassword" minlength="8" required placeholder="Mínimo de 8 caracteres"></div></div>
    <div class="login-field"><label for="confirmPassword">Confirmar senha</label><div class="login-input"><i class="fa-solid fa-lock"></i><input type="password" id="confirmPassword" minlength="8" required placeholder="Repita a senha"></div></div>
    <button type="submit" class="login-button" id="saveInvitePassword"><i class="fa-solid fa-check"></i> Salvar senha e entrar</button>`;
  loginForm.dataset.invite = 'true';
})();

togglePassword?.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  togglePassword.innerHTML = showing ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
});

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (loginForm.dataset.invite === 'true') {
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;
    if (password.length < 8) return showAlert('A senha deve ter pelo menos 8 caracteres.', 'error');
    if (password !== confirmation) return showAlert('As senhas não coincidem.', 'error');
    const button = document.getElementById('saveInvitePassword');
    button.disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) { button.disabled = false; return showAlert(error.message || 'Não foi possível salvar a senha.', 'error'); }
    window.location.replace('admin.html');
    return;
  }
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  loginButton.disabled = true;
  loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.replace('admin.html');
  } catch (error) {
    showAlert(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : (error.message || 'Não foi possível entrar.'), 'error');
    loginButton.disabled = false;
    loginButton.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
  }
});
