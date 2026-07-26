window.BARBEARIA_VIP_AUTH_READY = (async function protectAdmin() {
  document.documentElement.classList.add('auth-checking');
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data?.session) {
      window.location.replace('login.html');
      return;
    }
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles').select('role,business_owner_id,barber_id,full_name').eq('id', data.session.user.id).single();
    if (profileError || !profile || !['owner', 'admin', 'barber'].includes(profile.role)) {
      await supabaseClient.auth.signOut();
      window.location.replace('login.html');
      return;
    }
    window.BARBEARIA_VIP_USER = data.session.user;
    window.BARBEARIA_VIP_PROFILE = profile;
    document.documentElement.classList.remove('auth-checking');
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    window.location.replace('login.html');
  }
})();

async function logoutBarbeariaVip() {
  try { await supabaseClient.auth.signOut(); } finally { window.location.replace('login.html'); }
}
