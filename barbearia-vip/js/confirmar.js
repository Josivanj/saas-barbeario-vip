const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const title = document.getElementById("confirmationTitle");
const message = document.getElementById("confirmationMessage");
const details = document.getElementById("confirmationDetails");
const confirmButton = document.getElementById("confirmAppointmentButton");
const icon = document.querySelector(".confirmation-card .success-icon i");

function safe(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function renderDetails(data) {
  details.hidden = false;
  details.innerHTML = `<p><strong>Cliente:</strong> ${safe(data.client_name)}</p>
    <p><strong>Serviço:</strong> ${safe(data.service)}</p>
    <p><strong>Barbeiro:</strong> ${safe(data.barber)}</p>
    <p><strong>Data:</strong> ${safe(data.appointment_date)}</p>
    <p><strong>Horário:</strong> ${safe(data.appointment_time)}</p>`;
}

async function loadConfirmation() {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(String(token || ""))) return showError("Link de confirmação inválido.");
  const { data, error } = await supabaseClient.rpc("get_confirmation_preview", { p_token: token });
  if (error || !data) return showError("Este link é inválido ou o agendamento não existe.");
  renderDetails(data);
  if (data.status === "confirmed") return showConfirmed();
  title.textContent = "Confirmar este agendamento?";
  message.textContent = "Confira os dados e toque no botão abaixo.";
  confirmButton.hidden = false;
}

confirmButton.addEventListener("click", async () => {
  confirmButton.disabled = true;
  const { data, error } = await supabaseClient.rpc("confirm_public_appointment", { p_token: token });
  if (error || !data) {
    confirmButton.disabled = false;
    return showError("Não foi possível confirmar. Tente novamente.");
  }
  showConfirmed();
});

function showConfirmed() {
  icon.className = "fa-solid fa-check";
  title.textContent = "Agendamento confirmado!";
  message.textContent = "A confirmação foi registrada no painel da barbearia.";
  confirmButton.hidden = true;
}

function showError(text) {
  icon.className = "fa-solid fa-triangle-exclamation";
  title.textContent = "Não foi possível confirmar";
  message.textContent = text;
  confirmButton.hidden = true;
}

loadConfirmation();
