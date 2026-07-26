// Cria administradores no servidor sem expor a chave privilegiada no navegador.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const allowedOrigin = String(process.env.SITE_URL || "https://barbeario-vipcom.vercel.app").replace(/\/$/, "");
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && origin !== allowedOrigin) return res.status(403).json({ error: "Origem não autorizada." });
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return res.status(415).json({ error: "Formato inválido." });
  }
  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const fullName = String(req.body?.fullName || "").trim();
  const password = String(req.body?.password || "");

  if (!serviceKey) return res.status(503).json({ error: "Cadastro de administradores ainda não configurado na hospedagem." });
  if (!accessToken) return res.status(401).json({ error: "Sessão ausente." });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 100) {
    return res.status(400).json({ error: "Informe nome e e-mail válidos." });
  }
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: "Use uma senha de 12 caracteres com maiúscula, minúscula, número e símbolo." });
  }

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
  } catch {
    return res.status(500).json({ error: "Erro interno ao cadastrar o administrador." });
  }
};
