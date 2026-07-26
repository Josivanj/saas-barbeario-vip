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
  const targetUserId = String(req.body?.userId || "");
  const password = String(req.body?.password || "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!serviceKey) return res.status(503).json({ error: "Redefinição de senha ainda não configurada." });
  if (!accessToken) return res.status(401).json({ error: "Sessão ausente." });
  if (!uuid.test(targetUserId) || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: "Informe uma senha entre 6 e 128 caracteres." });
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

    const ids = `(${caller.id},${targetUserId})`;
    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=in.${encodeURIComponent(ids)}&select=id,role,business_owner_id`,
      { headers: serviceHeaders }
    );
    const profiles = await profilesResponse.json();
    const callerProfile = profiles.find(item => item.id === caller.id);
    const targetProfile = profiles.find(item => item.id === targetUserId);
    if (!profilesResponse.ok || !callerProfile || !targetProfile || !["owner", "admin"].includes(callerProfile.role)) {
      return res.status(403).json({ error: "Você não possui permissão para redefinir esta senha." });
    }

    const callerOwner = callerProfile.business_owner_id || callerProfile.id;
    const targetOwner = targetProfile.business_owner_id || targetProfile.id;
    if (callerOwner !== targetOwner) return res.status(403).json({ error: "Usuário não pertence à sua barbearia." });
    if (callerProfile.role === "admin" && targetProfile.role !== "barber" && targetProfile.id !== caller.id) {
      return res.status(403).json({ error: "Administradores podem redefinir apenas a própria senha e a dos barbeiros." });
    }
    if (targetProfile.role === "owner" && targetProfile.id !== caller.id) {
      return res.status(403).json({ error: "A senha do dono não pode ser alterada por outra pessoa." });
    }

    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
      method: "PUT",
      headers: serviceHeaders,
      body: JSON.stringify({ password })
    });
    const result = await updateResponse.json();
    if (!updateResponse.ok) {
      return res.status(updateResponse.status).json({ error: result.message || "Não foi possível redefinir a senha." });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Erro interno ao redefinir a senha." });
  }
};
