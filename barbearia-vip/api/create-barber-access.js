const JSON_HEADERS = { "Content-Type": "application/json" };

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const allowedOrigin = String(process.env.SITE_URL || "https://barbeario-vipcom.vercel.app").replace(/\/$/, "");
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && origin !== allowedOrigin) return res.status(403).json({ error: "Origem não autorizada." });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(503).json({ error: "Cadastro de acessos ainda não configurado na hospedagem." });
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { barberId, password, fullName } = req.body || {};
  const email = String(req.body?.email || "").trim().toLowerCase();
  let phone = String(req.body?.phone || "").replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  phone = phone ? `+${phone}` : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(String(barberId || "")) || (!email && !phone)
      || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      || (phone && !/^\+\d{12,13}$/.test(phone))
      || String(password || "").length < 6 || String(password || "").length > 128) {
    return res.status(400).json({ error: "Informe telefone ou e-mail e uma senha com pelo menos 6 caracteres." });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
    });
    const caller = await userResponse.json();
    if (!userResponse.ok || !caller?.id) return res.status(401).json({ error: "Sessão inválida." });

    const serviceHeaders = { ...JSON_HEADERS, apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=role,business_owner_id`, { headers: serviceHeaders });
    const callerProfile = (await profileResponse.json())?.[0];
    if (!profileResponse.ok || !["owner","admin"].includes(callerProfile?.role)) {
      return res.status(403).json({ error: "Somente a administração pode criar acesso de barbeiro." });
    }

    const barberResponse = await fetch(`${supabaseUrl}/rest/v1/barbers?id=eq.${barberId}&owner_id=eq.${callerProfile.business_owner_id}&select=id`, { headers: serviceHeaders });
    if (!(await barberResponse.json())?.[0]) return res.status(404).json({ error: "Barbeiro não encontrado." });

    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        ...(email ? { email, email_confirm: true } : {}),
        ...(phone ? { phone, phone_confirm: true } : {}),
        password,
        user_metadata: { full_name: fullName, role: "barber" }
      })
    });
    const created = await createResponse.json();
    if (!createResponse.ok) return res.status(400).json({ error: created.message || "Não foi possível criar o acesso." });

    const profileUpdate = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${created.id}`, {
      method: "PATCH",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        role: "barber",
        business_owner_id: callerProfile.business_owner_id,
        barber_id: barberId,
        full_name: String(fullName || "").trim(),
        email: email || null,
        phone: phone || null
      })
    });
    if (!profileUpdate.ok) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: serviceHeaders });
      return res.status(500).json({ error: "Não foi possível vincular o acesso ao barbeiro." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("create-barber-access", error);
    return res.status(500).json({ error: "Erro interno ao criar acesso do barbeiro." });
  }
};
