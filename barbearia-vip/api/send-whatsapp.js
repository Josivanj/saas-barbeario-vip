module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const { booking } = req.body || {};
  if (!booking) return res.status(400).json({ error: 'Agendamento ausente' });

  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const number = String(process.env.BARBER_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (!baseUrl || !apiKey || !instance || !number) {
    return res.status(503).json({ error: 'Evolution API ainda não configurada na hospedagem.' });
  }

  const text = `💈 *Novo agendamento*\n\n👤 Cliente: ${booking.name}\n✂️ Serviço: ${booking.service}\n💇 Profissional: ${booking.professional}\n📅 Data: ${booking.date}\n🕒 Horário: ${booking.time}\n📞 Telefone: ${booking.phone}${booking.notes ? `\n📝 Observação: ${booking.notes}` : ''}`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: 'Falha ao enviar WhatsApp', details: data });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
};
