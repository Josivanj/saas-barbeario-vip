const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const title = document.getElementById("confirmationTitle");
const message = document.getElementById("confirmationMessage");
const details = document.getElementById("confirmationDetails");
const icon = document.querySelector(".confirmation-card .success-icon i");

function safe(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function confirmAppointment() {
  if (!token) return showError("Link de confirmação inválido.");
  const { data, error } = await supabaseClient.rpc("confirm_public_appointment", { p_token: token });
  if (error || !data) return showError("Este link é inválido ou o agendamento não existe.");
  icon.className = "fa-solid fa-check";
  title.textContent = "Agendamento confirmado!";
  message.textContent = "A confirmação foi registrada no painel da barbearia.";
  details.hidden = false;
  details.innerHTML = `<p><strong>Cliente:</strong> ${safe(data.client_name)}</p>
    <p><strong>Serviço:</strong> ${safe(data.service)}</p>
    <p><strong>Barbeiro:</strong> ${safe(data.barber)}</p>
    <p><strong>Data:</strong> ${safe(data.appointment_date)}</p>
    <p><strong>Horário:</strong> ${safe(data.appointment_time)}</p>`;
}

function showError(text) {
  icon.className = "fa-solid fa-triangle-exclamation";
  title.textContent = "Não foi possível confirmar";
  message.textContent = text;
}

confirmAppointment();
