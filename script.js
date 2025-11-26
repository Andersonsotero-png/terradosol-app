/* Parquinho App - script.js
   Funcionalidades:
   - Cadastro (validação)
   - Geração de QR (qrcode.min.js)
   - Leitura de QR via câmera (jsQR)
   - Registrar entrada/saída com timestamps
   - Busca, histórico, export, imprimir
   - PWA: registra service worker (se disponível)
*/

// ------- helpers ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const nowISO = () => new Date().toISOString();
function uid(){ return Date.now().toString(); }
function clampStr(s){ return (s||'').toString().trim(); }

// ------- state ----------
let cadastros = JSON.parse(localStorage.getItem('cadastros') || '[]');
let marketing = localStorage.getItem('marketingContent') || '';
let cameraStream = null;
let scanInterval = null;

// ------- UI refs ----------
const tabs = $$('nav button');
const sections = $$('main .tab');
const form = $('#formCadastro');
const dataNascimentoInput = form.elements['dataNascimento'];
const idadeInput = form.elements['idade'];
const qrDiv = $('#qrCodeCadastro');
const inputBusca = $('#inputBusca');
const listaBusca = $('#listaBusca');
const listaHistoricoContainer = $('#listaHistoricoContainer');
const btnStartCamera = $('#btnStartCamera');
const btnStopCamera = $('#btnStopCamera');
const video = $('#video');
const canvas = $('#scanCanvas');
const scanMessage = $('#scanMessage');
const btnRegistrarManual = $('#btnRegistrarManual');
const btnGerarTodosQR = $('#btnGerarTodosQR');
const btnImprimir = $('#btnImprimir');
const marketingInput = $('#marketingInput');
const btnSalvarMarketing = $('#btnSalvarMarketing');
const btnExportJSON = $('#btnExportJSON');
const btnLimparTudo = $('#btnLimparTudo');

// ------- tabs ----------
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  sections.forEach(s => s.classList.remove('active'));
  document.getElementById(t.dataset.tab).classList.add('active');
}));

// ------- age calculation ----------
dataNascimentoInput.addEventListener('change', ()=> {
  const v = dataNascimentoInput.value;
  if (!v) { idadeInput.value = ''; return; }
  const d = new Date(v);
  if (isNaN(d.getTime())) { idadeInput.value=''; return; }
  idadeInput.value = calcularIdade(d);
});
function calcularIdade(dob){
  const hoje = new Date();
  let idade = hoje.getFullYear() - dob.getFullYear();
  const m = hoje.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dob.getDate())) idade--;
  return idade;
}

// ------- persistence ----------
function saveCadastros(){ localStorage.setItem('cadastros', JSON.stringify(cadastros)); }
function refreshAll(){ renderHistorico(); }

// ------- cadastro submit ----------
form.addEventListener('submit', e=>{
  e.preventDefault();
  const nome = clampStr(form.elements['nome'].value);
  const dataNascimento = form.elements['dataNascimento'].value;
  const idade = form.elements['idade'].value || calcularIdade(new Date(dataNascimento));
  if (!nome || !dataNascimento) { alert('Preencha nome e data de nascimento'); return; }

  const novo = {
    id: uid(),
    nome,
    dataNascimento,
    idade,
    telefone: clampStr(form.elements['telefone'].value),
    email: clampStr(form.elements['email'].value),
    entradas: [], // array de timestamps
    saidas: []
  };
  cadastros.unshift(novo);
  saveCadastros();
  generateQRCodeCanvas(novo.id);
  alert('Cadastro salvo!');
  form.reset();
  idadeInput.value='';
  renderHistorico();
});

// ------- gerar QR (apenas id codificado) ----------
function generateQRCodeCanvas(id){
  qrDiv.innerHTML='';
  QRCode.toCanvas(id.toString(), {width:180}, (err, canvasEl) => {
    if (err){ qrDiv.textContent='Erro ao gerar QR'; console.error(err); return; }
    qrDiv.appendChild(canvasEl);
  });
}

// gerar todos QRs (botão)
btnGerarTodosQR.addEventListener('click', ()=>{
  if (!cadastros.length){ alert('Não há cadastros'); return; }
  // mostra QRs sequenciais (no mesmo div)
  qrDiv.innerHTML='';
  cadastros.forEach(c=>{
    const wrap = document.createElement('div');
    wrap.className='card';
    const name = document.createElement('div'); name.textContent = c.nome;
    wrap.appendChild(name);
    const canvasBox = document.createElement('div');
    QRCode.toCanvas(c.id.toString(), {width:120}, (err, cv)=>{
      if(!err) canvasBox.appendChild(cv);
    });
    wrap.appendChild(canvasBox);
    qrDiv.appendChild(wrap);
  });
});

// ------- busca ----------
inputBusca.addEventListener('input', ()=>{
  const termo = inputBusca.value.toLowerCase().trim();
  listaBusca.innerHTML='';
  if (!termo || termo.length < 1) return;
  const resultados = cadastros.filter(c => 
    (c.nome||'').toLowerCase().includes(termo) || (c.telefone||'').toLowerCase().includes(termo)
  );
  resultados.forEach(c=>{
    const li = document.createElement('li'); li.className='card';
    li.innerHTML = `<strong>${c.nome}</strong> <small>(${c.idade} anos)</small><br>
                    Tel: ${c.telefone || '-'}<br>
                    <button data-id="${c.id}" class="btnRegistrar">Registrar Entrada/Saída</button>
                    <button data-id="${c.id}" class="btnImprimirFicha">Imprimir ficha</button>`;
    listaBusca.appendChild(li);
  });
  // attach events:
  $$('.btnRegistrar').forEach(btn=> btn.addEventListener('click', (ev)=> registrarEntradaSaida(ev.target.dataset.id)));
  $$('.btnImprimirFicha').forEach(btn=> btn.addEventListener('click', (ev)=> imprimirFicha(ev.target.dataset.id)));
});

// ------- histórico render ----------
function renderHistorico(){
  listaHistoricoContainer.innerHTML='';
  if (!cadastros.length){ listaHistoricoContainer.textContent='Nenhum cadastro ainda.'; return; }
  cadastros.forEach(c=>{
    const div = document.createElement('div'); div.className='card';
    const entradas = (c.entradas || []).map(t=> new Date(t).toLocaleString()).join(', ') || '-';
    const saidas = (c.saidas || []).map(t=> new Date(t).toLocaleString()).join(', ') || '-';
    div.innerHTML = `<strong>${c.nome}</strong> <small>${c.idade} anos</small>
      <div>Nasceu em: ${c.dataNascimento}</div>
      <div>Tel: ${c.telefone || '-' } | Email: ${c.email || '-'}</div>
      <div><strong>Entradas:</strong> ${entradas}</div>
      <div><strong>Saídas:</strong> ${saidas}</div>
      <div style="margin-top:8px">
        <button data-id="${c.id}" class="btnRegistrar">Registrar Entrada/Saída</button>
        <button data-id="${c.id}" class="btnExcluir">Excluir</button>
        <button data-id="${c.id}" class="btnImprimirFicha">Imprimir ficha</button>
      </div>`;
    listaHistoricoContainer.appendChild(div);
  });
  // attach events
  $$('.btnRegistrar').forEach(b => b.addEventListener('click', ev => registrarEntradaSaida(ev.target.dataset.id)));
  $$('.btnExcluir').forEach(b => b.addEventListener('click', ev => excluirCadastro(ev.target.dataset.id)));
  $$('.btnImprimirFicha').forEach(b => b.addEventListener('click', ev => imprimirFicha(ev.target.dataset.id)));
}
renderHistorico();

// ------- excluir cadastro ----------
function excluirCadastro(id){
  if(!confirm('Excluir cadastro permanentemente?')) return;
  cadastros = cadastros.filter(c => c.id !== id);
  saveCadastros();
  renderHistorico();
}

// ------- imprimir ficha ----------
function imprimirFicha(id){
  const c = cadastros.find(x => x.id === id);
  if(!c) { alert('Cadastro não encontrado'); return; }
  const w = window.open('', '_blank');
  const html = `<html><head><title>Ficha - ${c.nome}</title>
    <meta charset="utf-8"><style>body{font-family:Arial;padding:16px}</style></head><body>
    <h2>${c.nome}</h2>
    <div>Idade: ${c.idade}</div>
    <div>Nascido em: ${c.dataNascimento}</div>
    <div>Tel: ${c.telefone || '-'}</div>
    <div>Email: ${c.email || '-'}</div>
    <hr>
    <div><strong>Entradas:</strong> ${(c.entradas||[]).map(t=>new Date(t).toLocaleString()).join('<br>')|| '-'}</div>
    <div><strong>Saídas:</strong> ${(c.saidas||[]).map(t=>new Date(t).toLocaleString()).join('<br>')|| '-'}</div>
    </body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=> w.print(), 500);
}

// ------- registrar entrada/saída (toggle) ----------
function registrarEntradaSaida(id){
  const c = cadastros.find(x => x.id === id);
  if(!c) { alert('Cadastro não encontrado'); return; }
  // regra: se houver entrada sem saída correspondente -> registra saída; caso contrário registra entrada
  const entradas = c.entradas||[];
  const saidas = c.saidas||[];
  // if last entrada has no corresponding saida (i.e., entradas.length > saidas.length) => registrar saida
  if (entradas.length > saidas.length){
    saidas.push(nowISO());
    alert(`Saída registrada para ${c.nome}`);
  } else {
    entradas.push(nowISO());
    alert(`Entrada registrada para ${c.nome}`);
  }
  c.entradas = entradas;
  c.saidas = saidas;
  saveCadastros();
  renderHistorico();
}

// ------- camera & QR scan (jsQR) ----------
const ctx = canvas.getContext('2d');

btnStartCamera.addEventListener('click', startCamera);
btnStopCamera.addEventListener('click', stopCamera);

async function startCamera(){
  if (cameraStream) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
    video.srcObject = cameraStream;
    video.play();
    btnStartCamera.disabled = true;
    btnStopCamera.disabled = false;
    scanMessage.textContent = 'Aguardando QR...';
    // scan loop
    scanInterval = setInterval(scanFrame, 300);
  } catch(err){
    console.error(err);
    alert('Erro ao abrir câmera: ' + (err.message || err));
  }
}

function stopCamera(){
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  video.pause();
  video.srcObject = null;
  btnStartCamera.disabled = false;
  btnStopCamera.disabled = true;
  scanMessage.textContent = 'Câmera fechada';
}

function scanFrame(){
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
  // set canvas size same ratio
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
  if (code){
    // code.data is the payload (we encoded id)
    scanMessage.textContent = `QR detectado: ${code.data}`;
    // vibrate if supported
    if (navigator.vibrate) navigator.vibrate(100);
    onQRCodeScanned(code.data);
  } else {
    // no code
  }
}

let lastScanned = null;
function onQRCodeScanned(payload){
  // avoid duplicates in short time
  if (lastScanned === payload) return;
  lastScanned = payload;
  setTimeout(()=> lastScanned = null, 1000);
  // try find cadastro
  const c = cadastros.find(x => x.id === payload.toString());
  if (!c) {
    alert('QR não corresponde a nenhum cadastro: ' + payload);
    return;
  }
  registrarEntradaSaida(c.id);
}

// manual register button (select first matching in busca if any)
btnRegistrarManual.addEventListener('click', ()=>{
  const termo = inputBusca.value.trim();
  if (!termo){ alert('Digite nome ou telefone no campo de busca para registrar manualmente.'); return; }
  const found = cadastros.find(c => (c.nome||'').toLowerCase().includes(termo.toLowerCase()) || (c.telefone||'').includes(termo));
  if (!found){ alert('Nenhum cadastro encontrado com o termo: ' + termo); return; }
  registrarEntradaSaida(found.id);
});

// ------- imprimir lista (botão) ----------
btnImprimir.addEventListener('click', ()=>{
  if (!cadastros.length){ alert('Nenhum cadastro para imprimir'); return; }
  const w = window.open('', '_blank');
  let html = `<html><head><meta charset="utf-8"><title>Lista de Cadastros</title>
    <style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style></head><body>
    <h2>Cadastros</h2><table><thead><tr><th>Nome</th><th>Idade</th><th>Tel</th><th>Email</th><th>Entradas/saídas</th></tr></thead><tbody>`;
  cadastros.forEach(c=>{
    html += `<tr><td>${c.nome}</td><td>${c.idade}</td><td>${c.telefone||'-'}</td><td>${c.email||'-'}</td>
      <td>${(c.entradas||[]).map(t=>new Date(t).toLocaleString()).join('<br>') || '-'}<br> / ${(c.saidas||[]).map(t=>new Date(t).toLocaleString()).join('<br>') || '-'}</td></tr>`;
  });
  html += '</tbody></table></body></html>';
  w.document.write(html); w.document.close();
  setTimeout(()=> w.print(), 500);
});

// ------- marketing ----------
marketingInput.value = marketing;
btnSalvarMarketing.addEventListener('click', ()=>{
  marketing = marketingInput.value;
  localStorage.setItem('marketingContent', marketing);
  alert('Conteúdo de marketing salvo.');
});

// ------- export / clear ----------
btnExportJSON.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(cadastros, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cadastros-parquinho.json'; a.click();
  URL.revokeObjectURL(url);
});
btnLimparTudo.addEventListener('click', ()=>{
  if (!confirm('Apagar todos os dados locais?')) return;
  localStorage.clear();
  cadastros = [];
  renderHistorico();
  alert('Dados apagados.');
});

// ------- register service worker (PWA) ----------
if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js').then(()=> {
    console.log('ServiceWorker registrado.');
  }).catch(err => console.warn('Erro SW:', err));
}

// ------- initialization ----------
(function init(){
  // optional: ensure older array shape compatibility
  cadastros = cadastros.map(c => ({ entradas: [], saidas: [], ...c }));
  renderHistorico();
})();
