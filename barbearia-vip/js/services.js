// js/services.js
// CRUD de serviços usando Supabase.

async function getAuthenticatedUser() {
  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Usuário não autenticado.");

  return user;
}

async function getBusinessOwnerId() {
  const user = await getAuthenticatedUser();
  const { data, error } = await supabaseClient.from("profiles").select("business_owner_id").eq("id", user.id).single();
  if (error) throw error;
  return data.business_owner_id || user.id;
}

async function loadServices() {
  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function createService(service) {
  const user = await getAuthenticatedUser();
  const businessOwnerId = await getBusinessOwnerId();

  const { data, error } = await supabaseClient
    .from("services")
    .insert({
      owner_id: businessOwnerId,
      name: service.name,
      description: service.description || null,
      price: Number(service.price),
      duration_minutes: Number(service.duration_minutes),
      image_url: service.image_url || null,
      active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateService(id, service) {
  const { data, error } = await supabaseClient
    .from("services")
    .update({
      name: service.name,
      description: service.description || null,
      price: Number(service.price),
      duration_minutes: Number(service.duration_minutes),
      image_url: service.image_url || null
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteService(id) {
  const { error } = await supabaseClient
    .from("services")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Barbeiros e seus expedientes também são persistidos no Supabase.
async function loadBarbers() {
  const { data, error } = await supabaseClient.from("barbers").select("*").order("name");
  if (error) throw error;
  return data || [];
}

async function saveBarber(barber) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const payload = {
    name: barber.name, specialty: barber.specialty || null, phone: barber.whatsapp || null, instagram: barber.instagram || null,
    image_url: barber.image || null, work_start: barber.work_start, lunch_start: barber.lunch_start,
    lunch_end: barber.lunch_end, work_end: barber.work_end, work_days: barber.work_days, email: barber.email || null, active: true
  };
  if (barber.id && uuidPattern.test(String(barber.id))) {
    const { data, error } = await supabaseClient.from("barbers").update(payload).eq("id", barber.id).select().single();
    if (error) throw error; return data;
  }
  const businessOwnerId = await getBusinessOwnerId();
  const { data, error } = await supabaseClient.from("barbers").insert({ ...payload, owner_id: businessOwnerId }).select().single();
  if (error) throw error; return data;
}

async function loadBusinessAdmins() {
  const ownerId = await getBusinessOwnerId();
  const { data, error } = await supabaseClient.from("profiles").select("id,full_name,role,created_at").eq("business_owner_id", ownerId).order("created_at");
  if (error) throw error;
  return data || [];
}

async function loadBusinessSettings() {
  const ownerId = await getBusinessOwnerId();
  const { data, error } = await supabaseClient.from("business_settings")
    .select("whatsapp,instagram").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return data || { whatsapp: "", instagram: "" };
}

async function saveBusinessSettings(settings) {
  const ownerId = await getBusinessOwnerId();
  const instagram = String(settings.instagram || "").trim();
  const { data, error } = await supabaseClient.from("business_settings").upsert({
    owner_id: ownerId,
    whatsapp: String(settings.whatsapp || "").replace(/\D/g, ""),
    // Aceita tanto o link completo quanto o nome de usuário antigo.
    instagram: /^https?:\/\//i.test(instagram) ? instagram : instagram.replace(/^@/, "")
  }, { onConflict: "owner_id" }).select().single();
  if (error) throw error;
  return data;
}

async function loadGallery() {
  const { data, error } = await supabaseClient
    .from("gallery")
    .select("id,title,image_url,active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createGalleryItem(item) {
  const ownerId = await getBusinessOwnerId();
  const { data, error } = await supabaseClient.from("gallery").insert({
    owner_id: ownerId,
    title: item.title,
    image_url: item.image_url,
    active: true
  }).select().single();
  if (error) throw error;
  return data;
}

async function deleteGalleryItem(id) {
  const { error } = await supabaseClient.from("gallery").delete().eq("id", id);
  if (error) throw error;
}

async function deleteBarber(id) {
  const { error } = await supabaseClient.from("barbers").delete().eq("id", id);
  if (error) throw error;
}

async function loadAppointments() {
  const profile = window.BARBEARIA_VIP_PROFILE || {};
  let query = supabaseClient.from("appointments")
    .select("id,barber_id,client_name,appointment_date,appointment_time,duration_minutes,status,services(name),barbers(name)")
    .order("appointment_date", { ascending: false }).order("appointment_time", { ascending: false });
  if (profile.role === "barber" && profile.barber_id) query = query.eq("barber_id", profile.barber_id);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(a => ({ id:a.id, barberId:a.barber_id, name:a.client_name, service:a.services?.name, professional:a.barbers?.name,
    date:a.appointment_date, time:String(a.appointment_time).slice(0,5), durationMinutes:a.duration_minutes, status:a.status }));
}

async function updateAppointmentStatus(id, status) {
  const { data, error } = await supabaseClient.rpc("update_appointment_status", {
    p_appointment_id: id,
    p_status: status
  });
  if (error) throw error;
  return data;
}
