// Cria administradores no servidor sem expor a chave privilegiada no navegador.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const fullName = String(req.body?.fullName || "").trim();
  const password = String(req.body?.password || "");

  if (!serviceKey) return res.status(503).json({ error: "Cadastro de administradores ainda não configurado na hospedagem." });
  if (!accessToken) return res.status(401).json({ error: "Sessão ausente." });
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !fullName) {
    return res.status(400).json({ error: "Informe nome e e-mail válidos." });
  }
  if (password.length < 8) return res.status(400).json({ error: "A senha precisa ter pelo menos 8 caracteres." });

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }
    });
    const caller = await userResponse.json();
    if (!userResponse.ok || !caller.id) return res.status(401).json({ error: "Sessão inválida ou expirada." });

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=id,role,business_owner_id`, {
      headers: { ...serviceHeaders, Accept: "application/vnd.pgrst.object+json" }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.role !== "owner") {
      return res.status(403).json({ error: "Somente o dono pode cadastrar administradores." });
    }

    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "admin" }
      })
    });
    const created = await createResponse.json();
    if (!createResponse.ok) {
      const duplicate = /already|registered|exists/i.test(created.msg || created.message || "");
      return res.status(duplicate ? 409 : createResponse.status).json({
        error: duplicate ? "Este e-mail já possui cadastro." : (created.msg || created.message || "Não foi possível cadastrar o administrador.")
      });
    }

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${created.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: fullName,
        role: "admin",
        business_owner_id: profile.business_owner_id || profile.id
      })
    });

    if (!updateResponse.ok) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: serviceHeaders });
      return res.status(500).json({ error: "Não foi possível vincular o administrador à barbearia." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro interno." });
  }
};
