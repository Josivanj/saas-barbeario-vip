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
  let phone = String(req.body?.phone || "").replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  phone = phone ? `+${phone}` : "";

  if (!serviceKey) return res.status(503).json({ error: "Cadastro de telefone ainda não configurado." });
  if (!accessToken) return res.status(401).json({ error: "Sessão ausente." });
  if (!/^\+\d{12,13}$/.test(phone)) return res.status(400).json({ error: "Informe um telefone válido com DDD." });

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.id) return res.status(401).json({ error: "Sessão inválida ou expirada." });

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: serviceHeaders,
      body: JSON.stringify({ phone, phone_confirm: true })
    });
    const authResult = await authResponse.json();
    if (!authResponse.ok) {
      const duplicate = /already|registered|exists/i.test(authResult.message || "");
      return res.status(duplicate ? 409 : authResponse.status).json({
        error: duplicate ? "Este telefone já pertence a outro acesso." : (authResult.message || "Não foi possível cadastrar o telefone.")
      });
    }

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ phone })
    });
    if (!profileResponse.ok) return res.status(500).json({ error: "Telefone atualizado no acesso, mas não no perfil." });
    return res.status(200).json({ ok: true, phone });
  } catch {
    return res.status(500).json({ error: "Erro interno ao cadastrar o telefone." });
  }
};
