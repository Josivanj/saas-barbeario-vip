// Agenda pública: disponibilidade e gravação são calculadas no Supabase.
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const bookingForm = $("#bookingForm");
const bookingDate = $("#bookingDate");
const timeGrid = $("#timeGrid");
const bookingData = { serviceId: "", service: "", durationMinutes: 0, professionalId: "", professional: "", date: "", time: "", price: 0 };
let availabilityRequest = 0;

function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function money(value) { return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function durationLabel(minutes) { const h=Math.floor(minutes/60), m=minutes%60; return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`; }
function formatDate(value) { if (!value) return "Não selecionada"; const [y,m,d]=value.split("-"); return `${d}/${m}/${y}`; }

function showStep(number) {
  $$(".booking-step").forEach(el => el.classList.toggle("active", Number(el.dataset.step) === number));
  $$(".progress-item").forEach(el => { const n=Number(el.dataset.progress); el.classList.toggle("active", n===number); el.classList.toggle("completed", n<number); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSummary() {
  const any = bookingData.service || bookingData.professional || bookingData.date || bookingData.time;
  $("#summaryEmpty").style.display = any ? "none" : "block";
  $("#summaryContent").classList.toggle("visible", Boolean(any));
  $("#summaryService").textContent = bookingData.service || "Não selecionado";
  $("#summaryProfessional").textContent = bookingData.professional || "Não selecionado";
  $("#summaryDate").textContent = bookingData.date ? formatDate(bookingData.date) : "Não selecionada";
  $("#summaryTime").textContent = bookingData.time || "Não selecionado";
  $("#summaryDuration").textContent = bookingData.durationMinutes ? durationLabel(bookingData.durationMinutes) : "—";
  $("#summaryPrice").textContent = money(bookingData.price);
}

function clearTime(message = "Selecione serviço, barbeiro e data.") {
  bookingData.time = "";
  timeGrid.innerHTML = `<p class="time-grid-message">${escapeHtml(message)}</p>`;
  updateSummary();
}

// A RPC considera duração, expediente, almoço e todos os intervalos já reservados.
async function refreshAvailability() {
  const request = ++availabilityRequest;
  if (!bookingData.serviceId || !bookingData.professionalId || !bookingData.date) return clearTime();
  clearTime("Calculando horários disponíveis...");
  timeGrid.classList.add("loading");
  const { data, error } = await supabaseClient.rpc("get_available_slots", {
    p_barber_id: bookingData.professionalId, p_service_id: bookingData.serviceId, p_date: bookingData.date
  });
  if (request !== availabilityRequest) return;
  timeGrid.classList.remove("loading");
  if (error) { console.error(error); return clearTime("Não foi possível consultar a agenda. Tente novamente."); }
  if (!data?.length) return clearTime("Não há horários disponíveis nesta data.");
  timeGrid.innerHTML = data.map(row => { const value=String(row.slot_time).slice(0,5); return `<label class="time-option"><input type="radio" name="horario" value="${value}"><span>${value}</span></label>`; }).join("");
  timeGrid.querySelectorAll('input[name="horario"]').forEach(input => input.addEventListener("change", () => { bookingData.time=input.value; updateSummary(); }));
}

async function loadServices() {
  const container = $(".services-options");
  const { data, error } = await supabaseClient.from("services").select("id,name,price,duration_minutes").eq("active",true).order("created_at");
  if (error || !data?.length) { container.innerHTML='<p>Não foi possível carregar os serviços.</p>'; return; }
  container.innerHTML=data.map(s=>`<label class="booking-option"><input type="radio" name="servico" value="${escapeHtml(s.name)}" data-id="${s.id}" data-price="${s.price}" data-minutes="${s.duration_minutes}"><div class="option-icon"><i class="fa-solid fa-scissors"></i></div><div class="option-info"><strong>${escapeHtml(s.name)}</strong><span>${durationLabel(s.duration_minutes)}</span></div><div class="option-price">${money(s.price)}</div></label>`).join("");
  container.querySelectorAll('input[name="servico"]').forEach(input=>input.addEventListener("change",()=>{ bookingData.serviceId=input.dataset.id; bookingData.service=input.value; bookingData.price=Number(input.dataset.price); bookingData.durationMinutes=Number(input.dataset.minutes); $$('.services-options .booking-option').forEach(x=>x.classList.toggle('selected',x.contains(input))); refreshAvailability(); updateSummary(); }));
  const requested=new URLSearchParams(location.search).get("service"); const input=requested&&container.querySelector(`input[data-id="${CSS.escape(requested)}"]`); if(input){input.checked=true;input.dispatchEvent(new Event("change"));}
}

async function loadProfessionals() {
  const container=$(".professional-options");
  const { data, error }=await supabaseClient.from("barbers").select("id,name,specialty,image_url").eq("active",true).order("name");
  if(error || !data?.length){ container.innerHTML='<p>Nenhum barbeiro disponível.</p>'; return; }
  container.innerHTML=data.map(p=>`<label class="booking-option professional-option"><input type="radio" name="profissional" value="${escapeHtml(p.name)}" data-id="${p.id}"><div class="professional-option-avatar">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">`:'<i class="fa-solid fa-user"></i>'}</div><div class="option-info"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.specialty||'Profissional')}</span></div></label>`).join("");
  container.querySelectorAll('input[name="profissional"]').forEach(input=>input.addEventListener("change",()=>{ bookingData.professionalId=input.dataset.id; bookingData.professional=input.value; $$('.professional-options .booking-option').forEach(x=>x.classList.toggle('selected',x.contains(input))); refreshAvailability(); updateSummary(); }));
}

function validateStep(step) {
  if(step===1&&!bookingData.service){alert("Escolha um serviço para continuar.");return false;}
  if(step===2&&!bookingData.professional){alert("Escolha um profissional para continuar.");return false;}
  if(step===3&&(!bookingData.date||!bookingData.time)){alert(!bookingData.date?"Escolha a data do agendamento.":"Escolha um horário.");return false;}
  return true;
}

$$('.next-button').forEach(button=>button.addEventListener('click',()=>{const current=Number(button.closest('.booking-step').dataset.step);if(!validateStep(current))return;const next=Number(button.dataset.next);if(next===4)$('#finalSummary').innerHTML=`<h3>Resumo do agendamento</h3><p><strong>Serviço:</strong> ${escapeHtml(bookingData.service)}</p><p><strong>Profissional:</strong> ${escapeHtml(bookingData.professional)}</p><p><strong>Data:</strong> ${formatDate(bookingData.date)}</p><p><strong>Horário:</strong> ${bookingData.time}</p><p><strong>Duração:</strong> ${durationLabel(bookingData.durationMinutes)}</p><p><strong>Valor:</strong> ${money(bookingData.price)}</p>`;showStep(next);}));
$$('.previous-button').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.previous))));
bookingDate.addEventListener('change',()=>{bookingData.date=bookingDate.value;refreshAvailability();updateSummary();});
$('#clientPhone').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,11);if(v.length>10)v=v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');else if(v.length>6)v=v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');else if(v.length>2)v=v.replace(/(\d{2})(\d+)/,'($1) $2');e.target.value=v;});

bookingForm.addEventListener('submit',async event=>{
  event.preventDefault(); const name=$('#clientName').value.trim(), phone=$('#clientPhone').value.trim(), notes=$('#clientNotes').value.trim();
  if(!name){alert('Digite seu nome completo.');return;} if(phone.length<14){alert('Digite um número de WhatsApp válido.');return;}
  const button=event.submitter; if(button)button.disabled=true;
  // A mesma validação é refeita dentro da transação, eliminando corrida entre clientes.
  const { data, error }=await supabaseClient.rpc('create_public_appointment',{p_barber_id:bookingData.professionalId,p_service_id:bookingData.serviceId,p_date:bookingData.date,p_time:bookingData.time,p_client_name:name,p_client_phone:phone,p_notes:notes||null});
  if(error){console.error(error);alert(error.message?.includes('HORARIO_INDISPONIVEL')?'Este horário não está disponível.':'Não foi possível concluir o agendamento.');await refreshAvailability();if(button)button.disabled=false;return;}
  const newBooking={id:data,service:bookingData.service,professional:bookingData.professional,date:bookingData.date,time:bookingData.time,name,phone,notes,status:'Confirmado',durationMinutes:bookingData.durationMinutes,price:bookingData.price};
  localStorage.setItem('barbeariaVipLatestBookingNotification',JSON.stringify(newBooking));
  $('#successDetails').innerHTML=`<p><strong>Cliente:</strong> ${escapeHtml(name)}</p><p><strong>Serviço:</strong> ${escapeHtml(bookingData.service)}</p><p><strong>Profissional:</strong> ${escapeHtml(bookingData.professional)}</p><p><strong>Data:</strong> ${formatDate(bookingData.date)}</p><p><strong>Horário:</strong> ${bookingData.time}</p><p><strong>Valor:</strong> ${money(bookingData.price)}</p>`;
  bookingForm.style.display='none';$('#bookingSuccess').classList.add('visible');$('#whatsappConfirmation').onclick=()=>window.open(`https://wa.me/5593992396115?text=${encodeURIComponent(`Olá, gostaria de confirmar meu agendamento na Barbearia VIP.\n\nCliente: ${name}\nServiço: ${bookingData.service}\nProfissional: ${bookingData.professional}\nData: ${formatDate(bookingData.date)}\nHorário: ${bookingData.time}\nValor: ${money(bookingData.price)}`)}`,'_blank');window.scrollTo({top:0,behavior:'smooth'});
});

const today=new Date(), offset=today.getTimezoneOffset();bookingDate.min=new Date(today.getTime()-offset*60000).toISOString().slice(0,10);
clearTime();loadServices();loadProfessionals();updateSummary();
