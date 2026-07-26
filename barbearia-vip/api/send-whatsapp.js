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

  const { bookingId, notificationToken } = req.body || {};
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(String(bookingId || "")) || !uuidPattern.test(String(notificationToken || ""))) {
    return res.status(400).json({ error: "Dados de segurança inválidos." });
  }

  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  if (!baseUrl || !apiKey || !instance) {
    return res.status(503).json({ error: "WhatsApp ainda não configurado na hospedagem." });
  }

  try {
    // Token secreto e uso único impedem consultar ou reenviar reservas de terceiros.
    const appointmentResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_appointment_notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ p_appointment_id: bookingId, p_notification_token: notificationToken })
    });
    const booking = await appointmentResponse.json();
    if (!appointmentResponse.ok || !booking?.id) {
      return res.status(404).json({ error: "Notificação inválida ou já utilizada." });
    }

    const number = String(booking.barber_phone || "").replace(/\D/g, "");
    if (!/^\d{12,15}$/.test(number)) {
      return res.status(422).json({ error: "Cadastre um WhatsApp válido para o barbeiro." });
    }

    const confirmationUrl = `${allowedOrigin}/confirmar.html?token=${encodeURIComponent(booking.confirmation_token)}`;
    const text = `💈 *Novo agendamento — responda pelo site*\n\n👤 Cliente: ${booking.client_name}\n✂️ Serviço: ${booking.service}\n💇 Profissional: ${booking.barber}\n📅 Data: ${booking.appointment_date}\n🕒 Horário: ${booking.appointment_time}\n📞 Cliente: ${booking.client_phone}${booking.notes ? `\n📝 Observação: ${booking.notes}` : ""}\n\n✅ *Confirmar ou recusar:*\n${confirmationUrl}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text })
    });
    await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: "Falha ao enviar WhatsApp." });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Erro interno ao enviar a notificação." });
  }
};
