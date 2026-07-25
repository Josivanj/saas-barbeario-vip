function vipMoney(value) { return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function vipFormatDuration(totalMinutes) { const m=Number(totalMinutes)||0; if(m<60)return `${m} ${m===1?'minuto':'minutos'}`; const h=Math.floor(m/60),r=m%60; return r?`${h} ${h===1?'hora':'horas'} e ${r} minutos`:`${h} ${h===1?'hora':'horas'}`; }
function vipEscape(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

async function renderPublicServices(){
 const container=document.querySelector('.services-grid'); if(!container)return;
 container.innerHTML='<div class="admin-empty">Carregando serviços...</div>';
 const {data,error}=await supabaseClient.from('services').select('id,name,description,price,duration_minutes,image_url').eq('active',true).order('created_at',{ascending:true});
 if(error){console.error(error);container.innerHTML='<div class="admin-empty">Não foi possível carregar os serviços.</div>';return;}
 container.innerHTML=(data||[]).map(item=>`<article class="service-card service-card-public"><div class="service-content"><div class="service-title"><h3>${vipEscape(item.name)}</h3><strong>${vipMoney(item.price)}</strong></div><p>${vipEscape(item.description||'')}</p><div class="service-actions"><span><i class="fa-regular fa-clock"></i> ${vipFormatDuration(item.duration_minutes)}</span><a href="agendar.html?service=${encodeURIComponent(item.id)}">Agendar serviço</a></div></div><div class="service-image service-image-bottom">${item.image_url?`<img src="${item.image_url}" alt="${vipEscape(item.name)}">`:'<i class="fa-solid fa-scissors"></i>'}</div></article>`).join('')||'<div class="admin-empty">Nenhum serviço disponível.</div>';
}

async function renderPublicProfessionals(){
 const container=document.querySelector('.professionals-grid'); if(!container)return;
 const {data,error}=await supabaseClient.from('barbers').select('name,specialty,phone,instagram,image_url').eq('active',true).order('name');
 if(error){console.error(error);return;}
 if(data?.length)container.innerHTML=data.map(item=>`<article class="professional-card"><div class="professional-photo">${item.image_url?`<img src="${item.image_url}" alt="${vipEscape(item.name)}">`:'<i class="fa-solid fa-user"></i>'}</div><h3>${vipEscape(item.name)}</h3><span>${vipEscape(item.specialty||'Profissional')}</span><div class="professional-social">${item.phone?`<a href="https://wa.me/${String(item.phone).replace(/\D/g,'')}" target="_blank" rel="noopener" aria-label="WhatsApp de ${vipEscape(item.name)}"><i class="fa-brands fa-whatsapp"></i></a>`:''}${item.instagram?`<a href="https://instagram.com/${String(item.instagram).replace(/^@/,'')}" target="_blank" rel="noopener" aria-label="Instagram de ${vipEscape(item.name)}"><i class="fa-brands fa-instagram"></i></a>`:''}</div><a href="agendar.html" class="button button-outline button-full">Agendar com ${vipEscape(item.name.split(' ')[0])}</a></article>`).join('');
}

async function renderPublicContact(){
 const {data,error}=await supabaseClient.from('business_settings').select('whatsapp,instagram').limit(1).maybeSingle();
 if(error){console.error(error);return;}
 if(!data)return;
 const phone=String(data.whatsapp||'').replace(/\D/g,'');
 const instagram=String(data.instagram||'').replace(/^@/,'');
 const phoneText=document.getElementById('publicWhatsappText');
 const phoneButton=document.getElementById('publicWhatsappButton');
 const instagramLink=document.getElementById('publicInstagramLink');
 if(phoneText&&phone)phoneText.innerHTML=`<i class="fa-brands fa-whatsapp"></i> ${vipEscape(formatPublicPhone(phone))}`;
 if(phoneButton&&phone)phoneButton.href=`https://wa.me/${phone}?text=${encodeURIComponent('Olá, gostaria de falar com a Barbearia VIP.')}`;
 if(instagramLink&&instagram)instagramLink.href=`https://instagram.com/${encodeURIComponent(instagram)}`;
}

function formatPublicPhone(phone){
 const digits=String(phone).replace(/\D/g,''); const local=digits.startsWith('55')?digits.slice(2):digits;
 return local.length===11?`(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`:phone;
}

function renderLocalContent(){
 const professionals=JSON.parse(localStorage.getItem('barbeariaVipProfessionals')||'[]');
 const gallery=JSON.parse(localStorage.getItem('barbeariaVipGallery')||'[]');
 const pc=document.querySelector('.professionals-grid');
 if(pc&&professionals.length)pc.innerHTML=professionals.map(item=>`<article class="professional-card"><div class="professional-photo">${item.image?`<img src="${item.image}" alt="${vipEscape(item.name)}">`:'<i class="fa-solid fa-user"></i>'}</div><h3>${vipEscape(item.name)}</h3><span>${vipEscape(item.specialty||'Profissional')}</span><div class="professional-social">${item.whatsapp?`<a href="https://wa.me/${String(item.whatsapp).replace(/\D/g,'')}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i></a>`:''}${item.instagram?`<a href="https://instagram.com/${String(item.instagram).replace(/^@/,'')}" target="_blank" rel="noopener"><i class="fa-brands fa-instagram"></i></a>`:''}</div><a href="agendar.html" class="button button-outline button-full">Agendar com ${vipEscape(item.name.split(' ')[0])}</a></article>`).join('');
 const gc=document.querySelector('.gallery-grid');
 if(gc&&gallery.length)gc.innerHTML=gallery.map(item=>`<article class="public-gallery-card"><img src="${item.image}" alt="${vipEscape(item.title)}"><div class="public-gallery-overlay"><span>${vipEscape(item.title)}</span></div></article>`).join('');
 const section=document.getElementById('planos'); const plans=JSON.parse(localStorage.getItem('barbeariaVipPlans')||'[]'); const enabled=localStorage.getItem('barbeariaVipPlansEnabled')!=='false';
 if(section){section.hidden=!enabled;if(enabled&&plans.length){const grid=section.querySelector('.plans-grid');grid.innerHTML=plans.map(p=>`<article class="plan-card ${p.popular?'featured-plan':''}">${p.popular?'<div class="plan-badge">Mais popular</div>':''}<span>${vipEscape(p.name)}</span><h3>${vipMoney(p.price)}</h3><small>por mês</small><ul>${(p.benefits||[]).map(b=>`<li><i class="fa-solid fa-check"></i>${vipEscape(b)}</li>`).join('')}</ul><a href="https://wa.me/" class="button button-outline button-full">Escolher plano</a></article>`).join('');}}
}
renderPublicServices();renderPublicProfessionals();renderPublicContact();renderLocalContent();
