// Endpoint Vercel para convidar administradores sem expor a service role no navegador.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const fullName = String(req.body?.fullName || "").trim();

  if (!supabaseUrl || !serviceKey || !publishableKey) return res.status(503).json({ error: "Convites ainda não configurados na hospedagem." });
  if (!accessToken) return res.status(401).json({ error: "Sessão ausente." });
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !fullName) return res.status(400).json({ error: "Informe nome e e-mail válidos." });

  try {
    // Identifica o solicitante usando a sessão recebida do painel.
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }
    });
    const caller = await userResponse.json();
    if (!userResponse.ok || !caller.id) return res.status(401).json({ error: "Sessão inválida ou expirada." });

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=id,role,business_owner_id`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/vnd.pgrst.object+json" }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.role !== "owner") return res.status(403).json({ error: "Somente o dono pode convidar administradores." });

    const redirectTo = `${String(process.env.SITE_URL || req.headers.origin || "").replace(/\/$/, "")}/login.html`;
    const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, data: { full_name: fullName, role: "admin" } })
    });
    const invited = await inviteResponse.json();
    if (!inviteResponse.ok) {
      const duplicate = /already|registered|exists/i.test(invited.msg || invited.message || "");
      return res.status(duplicate ? 409 : inviteResponse.status).json({ error: duplicate ? "Este e-mail já possui cadastro." : (invited.msg || invited.message || "Não foi possível enviar o convite.") });
    }

    // O trigger cria o perfil; aqui ele é vinculado ao negócio do dono.
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${invited.id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ full_name: fullName, role: "admin", business_owner_id: profile.business_owner_id || profile.id })
    });
    if (!updateResponse.ok) return res.status(500).json({ error: "Convite enviado, mas o vínculo com a barbearia falhou." });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro interno." });
  }
};
