module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const { bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: "Agendamento ausente." });

  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const supabaseUrl = process.env.SUPABASE_URL || "https://cggvacqcbdfeshgzzuqf.supabase.co";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HuMY2_GAWEQCujs9UN-YmA_VVoAt_Nb";
  if (!baseUrl || !apiKey || !instance) {
    return res.status(503).json({ error: "Evolution API ainda não configurada na hospedagem." });
  }

  try {
    const appointmentResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_appointment_notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ p_appointment_id: bookingId })
    });
    const booking = await appointmentResponse.json();
    if (!appointmentResponse.ok || !booking?.id) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    const number = String(booking.barber_phone || "").replace(/\D/g, "");
    if (!number) return res.status(422).json({ error: "Cadastre o WhatsApp do barbeiro no painel." });

    const siteUrl = (process.env.SITE_URL || "https://barbeario-vipcom.vercel.app").replace(/\/$/, "");
    const confirmationUrl = `${siteUrl}/confirmar.html?token=${encodeURIComponent(booking.confirmation_token)}`;
    const text = `💈 *Novo agendamento — confirme o atendimento*\n\n👤 Cliente: ${booking.client_name}\n✂️ Serviço: ${booking.service}\n💇 Profissional: ${booking.barber}\n📅 Data: ${booking.appointment_date}\n🕒 Horário: ${booking.appointment_time}\n📞 Cliente: ${booking.client_phone}${booking.notes ? `\n📝 Observação: ${booking.notes}` : ""}\n\n✅ *Confirmar agendamento:*\n${confirmationUrl}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: "Falha ao enviar WhatsApp.", details: data });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro interno." });
  }
};
