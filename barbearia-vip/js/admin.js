// js/admin.js
// Serviços usam Supabase.
// Barbeiros, expedientes, serviços e agendamentos usam Supabase.

const STORAGE = {
  professionals: "barbeariaVipProfessionals",
  bookings: "barbeariaVipBookings",
  plans: "barbeariaVipPlans",
  plansEnabled: "barbeariaVipPlansEnabled"
};

const defaultProfessionals = [
  { id: 1, name: "Carlos Alberto", specialty: "Especialista em degradê", image: "" },
  { id: 2, name: "Rafael Souza", specialty: "Especialista em barba", image: "" },
  { id: 3, name: "Lucas Lima", specialty: "Especialista em cortes clássicos", image: "" }
];

function readStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

let services = [];
let professionals = [];
let gallery = [];
let bookings = [];
let businessAdmins = [];
let businessSettings = { whatsapp: "", instagram: "" };
let plans = readStorage(STORAGE.plans, [
  { id: 1, name: "Básico", price: 79.9, benefits: ["2 cortes por mês", "Agendamento prioritário", "5% de desconto em produtos"], popular: false },
  { id: 2, name: "Profissional", price: 129.9, benefits: ["4 cortes por mês", "2 serviços de barba", "10% de desconto em produtos"], popular: true },
  { id: 3, name: "Premium", price: 199.9, benefits: ["Cortes ilimitados", "Barba e sobrancelha", "15% de desconto em produtos"], popular: false }
]);


let serviceImage = "";
let professionalImage = "";
let galleryImage = "";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function saveLocalData() {
  localStorage.setItem(STORAGE.plans, JSON.stringify(plans));
  updateDashboard();
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showError(error, fallback = "Ocorreu um erro.") {
  console.error(error);
  alert(error?.message || fallback);
}

function openModal(id) {
  document.getElementById(id)?.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("visible");
  document.body.style.overflow = "";
}

function preview(id, image) {
  const element = document.getElementById(id);
  if (!element) return;

  element.innerHTML = image ? `<img src="${image}" alt="Prévia">` : "";
  element.classList.toggle("visible", Boolean(image));
}

function imageToBase64(file, options = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Selecione uma imagem válida."));
    }

    // Aceita a foto original com até 15 MB e otimiza automaticamente
    // antes de salvar, evitando imagens gigantes no site e no celular.
    if (file.size > 15 * 1024 * 1024) {
      return reject(new Error("A imagem original deve ter no máximo 15 MB."));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não foi possível processar a imagem."));
      image.onload = () => {
        const targetWidth = options.width || 1200;
        const targetHeight = options.height || 900;
        const quality = options.quality || 0.82;

        const sourceRatio = image.width / image.height;
        const targetRatio = targetWidth / targetHeight;
        let sx = 0;
        let sy = 0;
        let sw = image.width;
        let sh = image.height;

        // Recorte central padronizado para a imagem encaixar igualmente
        // em desktop e mobile sem esticar ou ocupar a tela inteira.
        if (sourceRatio > targetRatio) {
          sw = image.height * targetRatio;
          sx = (image.width - sw) / 2;
        } else {
          sh = image.width / targetRatio;
          sy = (image.height - sh) / 2;
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function parseDuration(value) {
  const text = String(value || "").trim();

  // Campo no formato HH:MM
  if (text.includes(":")) {
    const [hoursText, minutesText] = text.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      const totalMinutes = (hours * 60) + minutes;
      return totalMinutes > 0 ? totalMinutes : 30;
    }
  }

  // Caso o campo receba minutos diretamente
  const totalMinutes = Number.parseInt(text, 10);

  return Number.isFinite(totalMinutes) && totalMinutes > 0
    ? totalMinutes
    : 30;
}

function durationMinutesToTime(totalMinutes) {
  const total = Number(totalMinutes) || 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(totalMinutes) {
  const minutes = Number(totalMinutes) || 0;
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const hourLabel = `${hours} ${hours === 1 ? "hora" : "horas"}`;

  return remaining ? `${hourLabel} e ${remaining} minutos` : hourLabel;
}

function workDaysLabel(days = [1, 2, 3, 4, 5, 6]) {
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return days.slice().sort((a, b) => a - b).map(day => names[day]).join(", ");
}

function updateDashboard() {
  $("#servicesTotal").textContent = services.length;
  $("#professionalsTotal").textContent = professionals.length;
  $("#galleryTotal").textContent = gallery.length;
  $("#bookingsTotal").textContent = bookings.length;
}

function renderServices() {
  const container = $("#servicesAdminList");
  if (!container) return;

  if (!services.length) {
    container.innerHTML = `<div class="admin-empty">Nenhum serviço cadastrado.</div>`;
    return;
  }

  container.innerHTML = services.map(item => `
    <article class="admin-card">
      <div class="admin-card-image">
        ${item.image_url
          ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}">`
          : `<i class="fa-solid fa-scissors"></i>`}
      </div>

      <div class="admin-card-content">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "")}</p>

        <div class="admin-card-meta">
          <span>${formatDuration(item.duration_minutes)}</span>
          <strong>${money(item.price)}</strong>
        </div>

        <div class="admin-card-actions">
          <button class="admin-action" data-edit-service="${item.id}">
            <i class="fa-solid fa-pen"></i> Editar
          </button>

          <button class="admin-action delete" data-delete-service="${item.id}">
            <i class="fa-solid fa-trash"></i> Excluir
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderProfessionals() {
  const container = $("#professionalsAdminList");
  if (!container) return;

  if (!professionals.length) {
    container.innerHTML = `<div class="admin-empty">Nenhum barbeiro cadastrado.</div>`;
    return;
  }

  container.innerHTML = professionals.map(item => `
    <article class="admin-card">
      <div class="admin-card-image">
        ${item.image
          ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">`
          : `<i class="fa-solid fa-user"></i>`}
      </div>

      <div class="admin-card-content">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.specialty)}</p>
        ${item.phone ? `<p><i class="fa-brands fa-whatsapp"></i> ${escapeHtml(item.phone)}</p>` : ""}
        <p><i class="fa-regular fa-clock"></i> ${String(item.work_start).slice(0,5)}–${String(item.lunch_start).slice(0,5)} / ${String(item.lunch_end).slice(0,5)}–${String(item.work_end).slice(0,5)}</p>
        <p><i class="fa-regular fa-calendar"></i> ${escapeHtml(workDaysLabel(item.work_days))}</p>

        <div class="admin-card-actions admin-card-actions-single">
          <button class="admin-action" data-edit-professional="${item.id}">
            <i class="fa-solid fa-pen"></i> Editar barbeiro e expediente
          </button>
          <button class="admin-action delete" data-delete-professional="${item.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderGallery() {
  const container = $("#galleryAdminList");
  if (!container) return;

  if (!gallery.length) {
    container.innerHTML = `<div class="admin-empty">Nenhuma foto adicionada à galeria.</div>`;
    return;
  }

  container.innerHTML = gallery.map(item => `
    <article class="admin-gallery-card">
      <img src="${item.image_url}" alt="${escapeHtml(item.title)}">

      <div class="admin-gallery-caption">
        <strong>${escapeHtml(item.title)}</strong>
        <button data-delete-gallery="${item.id}" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </article>
  `).join("");
}

function formatDate(value) {
  if (!value) return "—";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function renderBookings() {
  const container = $("#bookingsAdminList");
  if (!container) return;

  if (!bookings.length) {
    container.innerHTML = `<div class="admin-empty">Nenhum agendamento realizado.</div>`;
    updateDashboard();
    return;
  }

  container.innerHTML = bookings.slice().reverse().map(item => `
    <article class="admin-booking">
      <div><span>Cliente</span><strong>${escapeHtml(item.name || "Cliente")}</strong></div>
      <div><span>Serviço</span><strong>${escapeHtml(item.service || "—")}</strong></div>
      <div><span>Barbeiro</span><strong>${escapeHtml(item.professional || "—")}</strong></div>
      <div><span>Data</span><strong>${formatDate(item.date)}</strong></div>
      <div><span>Horário</span><strong>${escapeHtml(item.time || "—")}</strong></div>
      <div class="admin-status">${escapeHtml(bookingStatusLabel(item.status))}</div>
      <div class="admin-booking-actions">
        ${item.status === "pending" ? `<button class="admin-action" data-booking-status="${item.id}:confirmed"><i class="fa-solid fa-check"></i> Confirmar</button>` : ""}
        ${["pending","confirmed"].includes(item.status) ? `<button class="admin-action delete" data-booking-status="${item.id}:cancelled"><i class="fa-solid fa-xmark"></i> Recusar</button>` : ""}
        ${item.status === "confirmed" ? `<button class="admin-action" data-booking-status="${item.id}:completed"><i class="fa-solid fa-check-double"></i> Concluir</button>` : ""}
      </div>
    </article>
  `).join("");

  updateDashboard();
}

function bookingStatusLabel(status) {
  return ({
    pending: "Aguardando confirmação",
    confirmed: "Confirmado pelo barbeiro",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Cliente não compareceu"
  })[status] || status || "Aguardando confirmação";
}

function renderBusinessAdmins() {
  const container = $("#adminsAdminList");
  if (!container) return;
  container.innerHTML = businessAdmins.length ? businessAdmins.map(item => `
    <article class="admin-card"><div class="admin-card-content">
      <h3>${escapeHtml(item.full_name || "Administrador")}</h3>
      <p><i class="fa-solid fa-shield-halved"></i> ${item.role === "owner" ? "Dono" : "Administrador"}</p>
    </div></article>`).join("") : `<div class="admin-empty">Nenhum administrador encontrado.</div>`;
}

function resetServiceForm() {
  $("#serviceForm").reset();
  $("#serviceId").value = "";
  $("#serviceModalTitle").textContent = "Novo serviço";
  serviceImage = "";
  preview("serviceImagePreview", "");
}

function editService(id) {
  const item = services.find(service => service.id === id);
  if (!item) return;

  $("#serviceId").value = item.id;
  $("#serviceName").value = item.name;
  $("#servicePrice").value = item.price;
  $("#serviceDuration").value = durationMinutesToTime(item.duration_minutes);
  $("#serviceDescription").value = item.description || "";
  $("#serviceModalTitle").textContent = "Editar serviço";

  serviceImage = item.image_url || "";
  preview("serviceImagePreview", serviceImage);
  openModal("serviceModal");
}

function resetProfessionalForm() {
  $("#professionalForm").reset();
  $("#professionalId").value = "";
  $("#professionalModalTitle").textContent = "Novo barbeiro";
  professionalImage = "";
  $$("#professionalWorkDays input").forEach(input => { input.checked = input.value !== "0"; });
  $("#professionalEmail").value = "";
  $("#professionalPassword").value = "";
  $("#professionalAccessFields").hidden = false;
  preview("professionalImagePreview", "");
}

function editProfessional(id) {
  const item = professionals.find(professional => professional.id === id);
  if (!item) return;

  $("#professionalId").value = item.id;
  $("#professionalName").value = item.name;
  $("#professionalSpecialty").value = item.specialty;
  $("#professionalWhatsapp").value = item.phone || "";
  $("#professionalInstagram").value = item.instagram || "";
  $("#professionalWorkStart").value = String(item.work_start || "08:00").slice(0,5);
  $("#professionalLunchStart").value = String(item.lunch_start || "12:00").slice(0,5);
  $("#professionalLunchEnd").value = String(item.lunch_end || "13:00").slice(0,5);
  $("#professionalWorkEnd").value = String(item.work_end || "18:00").slice(0,5);
  const workDays = item.work_days || [1,2,3,4,5,6];
  $$("#professionalWorkDays input").forEach(input => { input.checked = workDays.includes(Number(input.value)); });
  $("#professionalEmail").value = item.email || "";
  $("#professionalPassword").value = "";
  $("#professionalAccessFields").hidden = true;
  $("#professionalModalTitle").textContent = "Editar barbeiro";

  professionalImage = item.image_url || "";
  preview("professionalImagePreview", professionalImage);
  openModal("professionalModal");
}

$("#newServiceButton")?.addEventListener("click", () => {
  resetServiceForm();
  openModal("serviceModal");
});

$("#newProfessionalButton")?.addEventListener("click", () => {
  resetProfessionalForm();
  openModal("professionalModal");
});

$("#newGalleryButton")?.addEventListener("click", () => {
  $("#galleryForm").reset();
  galleryImage = "";
  preview("galleryImagePreview", "");
  openModal("galleryModal");
});

$("#serviceImage")?.addEventListener("change", async event => {
  try {
    serviceImage = await imageToBase64(event.target.files[0], { width: 1200, height: 675, quality: 0.82 });
    preview("serviceImagePreview", serviceImage);
  } catch (error) {
    showError(error);
    event.target.value = "";
  }
});

$("#professionalImage")?.addEventListener("change", async event => {
  try {
    professionalImage = await imageToBase64(event.target.files[0], { width: 800, height: 800, quality: 0.84 });
    preview("professionalImagePreview", professionalImage);
  } catch (error) {
    showError(error);
    event.target.value = "";
  }
});

$("#galleryImage")?.addEventListener("change", async event => {
  try {
    galleryImage = await imageToBase64(event.target.files[0], { width: 1200, height: 900, quality: 0.82 });
    preview("galleryImagePreview", galleryImage);
  } catch (error) {
    showError(error);
    event.target.value = "";
  }
});

$("#serviceForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const submitButton = event.submitter;
  const id = $("#serviceId").value.trim();

  const data = {
    name: $("#serviceName").value.trim(),
    price: Number($("#servicePrice").value),
    duration_minutes: parseDuration($("#serviceDuration").value),
    description: $("#serviceDescription").value.trim(),
    image_url: serviceImage || null
  };

  try {
    if (submitButton) submitButton.disabled = true;

    if (id) {
      await updateService(id, data);
    } else {
      await createService(data);
    }

    services = await loadServices();
    renderServices();
    updateDashboard();
    closeModal("serviceModal");
  } catch (error) {
    showError(error, "Não foi possível salvar o serviço.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

$("#professionalForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("#professionalId").value || null;
  const workStart=$("#professionalWorkStart").value, lunchStart=$("#professionalLunchStart").value;
  const lunchEnd=$("#professionalLunchEnd").value, workEnd=$("#professionalWorkEnd").value;
  if (!(workStart < lunchStart && lunchStart < lunchEnd && lunchEnd < workEnd)) {
    alert("Informe um expediente válido: entrada < almoço < retorno < saída."); return;
  }
  const data = {
    // Novos barbeiros recebem o UUID diretamente do Supabase.
    id: id || null,
    name: $("#professionalName").value.trim(),
    specialty: $("#professionalSpecialty").value.trim(),
    whatsapp: $("#professionalWhatsapp").value.trim(),
    instagram: $("#professionalInstagram").value.trim(),
    email: $("#professionalEmail").value.trim(),
    image: professionalImage,
    work_start: workStart, lunch_start: lunchStart, lunch_end: lunchEnd, work_end: workEnd,
    work_days: $$("#professionalWorkDays input:checked").map(input => Number(input.value))
  };
  if (!data.work_days.length) { alert("Selecione pelo menos um dia de trabalho."); return; }
  try {
    const savedBarber = await saveBarber(data);
    const password = $("#professionalPassword").value;
    if (!id && data.email && password) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const response = await fetch("/api/create-barber-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionData.session?.access_token || ""}` },
        body: JSON.stringify({ barberId: savedBarber.id, email: data.email, password, fullName: data.name })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Barbeiro salvo, mas o acesso não foi criado.");
    }
    professionals=await loadBarbers(); renderProfessionals(); updateDashboard(); closeModal("professionalModal");
  }
  catch(error) { showError(error,"Não foi possível salvar o barbeiro."); }
});

$("#galleryForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!galleryImage) {
    alert("Escolha uma foto.");
    return;
  }

  const submitButton = event.submitter;
  try {
    if (submitButton) submitButton.disabled = true;
    await createGalleryItem({ title: $("#galleryTitle").value.trim(), image_url: galleryImage });
    gallery = await loadGallery();
    renderGallery();
    updateDashboard();
    closeModal("galleryModal");
  } catch (error) {
    showError(error, "Não foi possível salvar a foto na galeria.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// Migra uma única vez as fotos que versões antigas salvavam somente no aparelho.
// Assim, ao abrir o painel atualizado no celular, essas fotos passam a aparecer
// também no computador e nos demais dispositivos conectados ao mesmo negócio.
async function migrateLegacyGallery() {
  const legacyKey = "barbeariaVipGallery";
  const legacyItems = readStorage(legacyKey, []);
  if (!Array.isArray(legacyItems) || !legacyItems.length) return;

  const remoteItems = await loadGallery();
  const remoteImages = new Set(remoteItems.map(item => item.image_url));
  for (const item of legacyItems) {
    const imageUrl = item.image_url || item.image;
    if (!imageUrl || remoteImages.has(imageUrl)) continue;
    await createGalleryItem({
      title: item.title || "Galeria",
      image_url: imageUrl
    });
  }
  localStorage.removeItem(legacyKey);
}

document.addEventListener("click", async event => {
  const serviceEdit = event.target.closest("[data-edit-service]");
  const serviceDelete = event.target.closest("[data-delete-service]");
  const professionalEdit = event.target.closest("[data-edit-professional]");
  const professionalDelete = event.target.closest("[data-delete-professional]");
  const galleryDelete = event.target.closest("[data-delete-gallery]");
  const bookingStatus = event.target.closest("[data-booking-status]");

  if (bookingStatus) {
    const [id, status] = bookingStatus.dataset.bookingStatus.split(":");
    const action = status === "cancelled" ? "recusar" : status === "completed" ? "concluir" : "confirmar";
    if (!confirm(`Deseja ${action} este agendamento?`)) return;
    try {
      await updateAppointmentStatus(id, status);
      bookings = await loadAppointments();
      renderBookings();
    } catch (error) {
      showError(error, "Não foi possível atualizar o agendamento.");
    }
    return;
  }

  if (serviceEdit) {
    editService(serviceEdit.dataset.editService);
  }

  if (serviceDelete && confirm("Excluir este serviço?")) {
    try {
      await deleteService(serviceDelete.dataset.deleteService);
      services = await loadServices();
      renderServices();
      updateDashboard();
    } catch (error) {
      showError(error, "Não foi possível excluir o serviço.");
    }
  }

  if (professionalEdit) {
    editProfessional(professionalEdit.dataset.editProfessional);
  }

  if (professionalDelete && confirm("Excluir este barbeiro?")) {
    try { await deleteBarber(professionalDelete.dataset.deleteProfessional); professionals=await loadBarbers(); renderProfessionals(); updateDashboard(); }
    catch(error) { showError(error,"Não foi possível excluir o barbeiro. Ele pode possuir agendamentos."); }
  }

  if (galleryDelete && confirm("Excluir esta foto?")) {
    try {
      await deleteGalleryItem(galleryDelete.dataset.deleteGallery);
      gallery = await loadGallery();
      renderGallery();
      updateDashboard();
    } catch (error) {
      showError(error, "Não foi possível excluir a foto.");
    }
  }
});

$$("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

$$(".admin-modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

$("#inviteAdminForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const message = $("#inviteAdminMessage");
  const button = event.submitter;
  message.className = "admin-form-message";
  try {
    if (button) button.disabled = true;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await fetch("/api/invite-admin", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        fullName: $("#inviteAdminName").value.trim(),
        email: $("#inviteAdminEmail").value.trim(),
        password: $("#inviteAdminPassword").value
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o administrador.");
    message.textContent = "Administrador cadastrado. Ele já pode entrar no painel."; message.className = "admin-form-message visible success";
    event.currentTarget.reset(); businessAdmins = await loadBusinessAdmins(); renderBusinessAdmins();
  } catch (error) {
    message.textContent = error.message; message.className = "admin-form-message visible error";
  } finally { if (button) button.disabled = false; }
});

$("#contactSettingsForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const message = $("#contactSettingsMessage");
  const button = event.submitter;
  try {
    if (button) button.disabled = true;
    businessSettings = await saveBusinessSettings({ whatsapp: $("#businessWhatsapp").value, instagram: $("#businessInstagram").value });
    message.textContent = "Contato atualizado no site.";
    message.className = "admin-form-message visible success";
  } catch (error) {
    message.textContent = error.message || "Não foi possível salvar.";
    message.className = "admin-form-message visible error";
  } finally { if (button) button.disabled = false; }
});

const sidebar = $("#adminSidebar");
const overlay = $("#adminOverlay");

function openSidebar() {
  sidebar?.classList.add("visible");
  overlay?.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar?.classList.remove("visible");
  overlay?.classList.remove("visible");
  document.body.style.overflow = "";
}

$("#adminMenuToggle")?.addEventListener("click", () => {
  sidebar?.classList.contains("visible") ? closeSidebar() : openSidebar();
});

overlay?.addEventListener("click", closeSidebar);

$$(".admin-menu-item").forEach(button => {
  button.addEventListener("click", () => {
    $$(".admin-menu-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    $$(".admin-section").forEach(section => section.classList.remove("active"));
    document.getElementById(`${button.dataset.section}Section`)?.classList.add("active");

    if (button.dataset.section === "bookings") renderBookings();
    closeSidebar();
  });
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeSidebar();
});

function addNotificationButton() {
  const header = document.querySelector(".admin-header");
  if (!header || document.getElementById("enableNotificationsButton")) return;

  const button = document.createElement("button");
  button.id = "enableNotificationsButton";
  button.className = "admin-notification-button";
  button.type = "button";
  button.innerHTML = '<i class="fa-regular fa-bell"></i><span>Ativar notificações</span>';

  const adminUser = header.querySelector(".admin-user");
  header.insertBefore(button, adminUser);

  button.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("Este navegador não oferece notificações.");
      return;
    }

    const permission = await Notification.requestPermission();
    button.classList.toggle("enabled", permission === "granted");
    button.querySelector("span").textContent = permission === "granted"
      ? "Notificações ativadas"
      : "Ativar notificações";
  });

  if ("Notification" in window && Notification.permission === "granted") {
    button.classList.add("enabled");
    button.querySelector("span").textContent = "Notificações ativadas";
  }
}

function showBookingNotification(booking) {
  if (!booking) return;

  const message = `${booking.name || "Novo cliente"} agendou ${booking.service || "um serviço"} para ${formatDate(booking.date)} às ${booking.time || "—"}.`;

  const toast = document.createElement("div");
  toast.className = "admin-booking-toast";
  toast.innerHTML = `
    <i class="fa-solid fa-calendar-check"></i>
    <div><strong>Novo agendamento</strong><span>${escapeHtml(message)}</span></div>
    <button type="button" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  toast.querySelector("button").addEventListener("click", () => toast.remove());
  setTimeout(() => toast.remove(), 9000);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Barbearia VIP — Novo agendamento", { body: message });
    playReminderTone();
  }
}

function playReminderTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .7);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .7);
  } catch (error) {
    console.warn("Não foi possível tocar o lembrete.", error);
  }
}

function checkNewBookings() {
  const currentBookings = readStorage(STORAGE.bookings, []);
  const latest = currentBookings[currentBookings.length - 1];
  if (!latest) return;

  const lastSeen = localStorage.getItem("barbeariaVipLastSeenBooking");
  if (String(latest.id) !== String(lastSeen)) {
    showBookingNotification(latest);
    localStorage.setItem("barbeariaVipLastSeenBooking", latest.id);
  }
}

window.addEventListener("storage", event => {
  if (event.key === STORAGE.bookings) {
    bookings = readStorage(STORAGE.bookings, []);
    renderBookings();
    checkNewBookings();
  }
});

async function initializeAdmin() {
  await window.BARBEARIA_VIP_AUTH_READY;
  const profile = window.BARBEARIA_VIP_PROFILE || {};
  const isBarber = profile.role === "barber";
  if (isBarber) {
    $$(".admin-menu-item").forEach(item => {
      item.hidden = !["dashboard", "bookings"].includes(item.dataset.section);
    });
    $("#dashboardSection .admin-section-heading h2").textContent = "Minha agenda";
    document.querySelector(".admin-user strong").textContent = profile.full_name || "Barbeiro";
    document.querySelector(".admin-user span").textContent = "Profissional";
  }
  addNotificationButton();

  try {
    if (isBarber) {
      bookings = await loadAppointments();
    } else {
      await migrateLegacyGallery();
      [services, professionals, bookings, businessAdmins, businessSettings, gallery] = await Promise.all([
        loadServices(), loadBarbers(), loadAppointments(), loadBusinessAdmins(), loadBusinessSettings(), loadGallery()
      ]);
    }
  } catch (error) {
    showError(error, "Não foi possível carregar os serviços do Supabase.");
    services = []; professionals = []; bookings = []; businessAdmins = []; gallery = []; businessSettings = { whatsapp: "", instagram: "" };
  }

  renderServices();
  renderProfessionals();
  renderGallery();
  renderBookings();
  renderBusinessAdmins();
  $("#businessWhatsapp").value = businessSettings.whatsapp || "";
  $("#businessInstagram").value = businessSettings.instagram || "";
  updateDashboard();
  checkNewBookings();
  subscribeToBookings(profile);
  checkUpcomingReminders();
  window.setInterval(checkUpcomingReminders, 60000);
}

function subscribeToBookings(profile) {
  const ownerId = profile.business_owner_id;
  if (!ownerId) return;
  supabaseClient.channel(`appointments-${ownerId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `owner_id=eq.${ownerId}` }, async payload => {
      if (profile.role === "barber" && payload.new?.barber_id !== profile.barber_id && payload.old?.barber_id !== profile.barber_id) return;
      bookings = await loadAppointments();
      renderBookings();
      if (payload.eventType === "INSERT") showBookingNotification(bookings.find(item => item.id === payload.new.id));
    })
    .subscribe();
}

function checkUpcomingReminders() {
  if (!bookings.length || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  bookings.filter(item => item.date === today && ["pending","confirmed"].includes(item.status)).forEach(item => {
    const [hours, minutes] = item.time.split(":").map(Number);
    const start = new Date(now); start.setHours(hours, minutes, 0, 0);
    const difference = start - now;
    const reminderKey = `barbeariaVipReminder:${item.id}:${item.date}`;
    if (difference > 0 && difference <= 30 * 60000 && !sessionStorage.getItem(reminderKey)) {
      new Notification("Barbearia VIP — Atendimento próximo", {
        body: `${item.name} está agendado para ${item.time}.`
      });
      playReminderTone();
      sessionStorage.setItem(reminderKey, "1");
    }
  });
}

initializeAdmin();


function renderPlans() {
  const container = $("#plansAdminList");
  if (!container) return;
  container.innerHTML = plans.length ? plans.map(plan => `
    <article class="admin-card">
      <div class="admin-card-content">
        <h3>${escapeHtml(plan.name)} ${plan.popular ? '<span class="admin-plan-badge">Mais popular</span>' : ''}</h3>
        <strong>${money(plan.price)} / mês</strong>
        <p>${(plan.benefits || []).map(escapeHtml).join(' • ')}</p>
        <div class="admin-card-actions">
          <button class="admin-action" data-edit-plan="${plan.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="admin-action delete" data-delete-plan="${plan.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>
    </article>`).join('') : '<div class="admin-empty">Nenhum plano cadastrado.</div>';
}

function resetPlanForm() {
  $("#planForm")?.reset();
  $("#planId").value = '';
  $("#planModalTitle").textContent = 'Novo plano';
}

$("#newPlanButton")?.addEventListener('click', () => { resetPlanForm(); openModal('planModal'); });
$("#plansEnabled") && ($("#plansEnabled").checked = localStorage.getItem(STORAGE.plansEnabled) !== 'false');
$("#plansEnabled")?.addEventListener('change', event => localStorage.setItem(STORAGE.plansEnabled, String(event.target.checked)));
$("#planForm")?.addEventListener('submit', event => {
  event.preventDefault();
  const id = Number($("#planId").value);
  const data = {
    id: id || Date.now(), name: $("#planName").value.trim(), price: Number($("#planPrice").value),
    benefits: $("#planBenefits").value.split('\n').map(x => x.trim()).filter(Boolean), popular: $("#planPopular").checked
  };
  plans = id ? plans.map(item => item.id === id ? data : item) : [...plans, data];
  saveLocalData(); renderPlans(); closeModal('planModal');
});

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-plan]');
  const del = event.target.closest('[data-delete-plan]');
  if (edit) {
    const plan = plans.find(x => x.id === Number(edit.dataset.editPlan)); if (!plan) return;
    $("#planId").value = plan.id; $("#planName").value = plan.name; $("#planPrice").value = plan.price;
    $("#planBenefits").value = (plan.benefits || []).join('\n'); $("#planPopular").checked = Boolean(plan.popular);
    $("#planModalTitle").textContent = 'Editar plano'; openModal('planModal');
  }
  if (del && confirm('Excluir este plano?')) { plans = plans.filter(x => x.id !== Number(del.dataset.deletePlan)); saveLocalData(); renderPlans(); }
});

renderPlans();
