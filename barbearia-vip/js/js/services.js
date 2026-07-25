async function loadServices() {
  const {
    data,
    error
  } = await supabaseClient
    .from("services")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

async function createService(service) {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from("services")
    .insert({
      owner_id: user.id,
      name: service.name,
      description: service.description,
      price: service.price,
      duration_minutes: service.duration_minutes,
      image_url: service.image_url || null
    });

  if (error) {
    console.error(error);
    throw error;
  }
}