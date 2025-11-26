/* script.js - Terra do Sol v1 (completo) */
document.addEventListener("DOMContentLoaded", () => {

  /* helpers */
  const uid = (len = 8) => Math.random().toString(36).slice(2, 2 + len).toUpperCase();
  const nowISO = () => new Date().toISOString();
  const timeDisplay = iso => iso ? new Date(iso).toLocaleTimeString() : "—";
  const duration = (sIso, eIso) => {
    if (!sIso || !eIso) return "—";
    const s = new Date(sIso), e = new Date(eIso);
    const diff = e - s; // milliseconds
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs + "h " + rem + "m";
  };

  /* state */
  let clients = JSON.parse(localStorage.getItem("clients") || "[]");
  let presentes = JSON.parse(localStorage.getItem("presentes") || "[]");
  let historico = JSON.parse(localStorage.getItem("historico") || "[]");

  const saveAll = () => {
    localStorage.setItem("clients", JSON.stringify(clients));
    localStorage.setItem("presentes", JSON.stringify(presentes));
    localStorage.setItem("historico", JSON.stringify(historico));
  };

  /* tabs */
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      t.classList.add("active");
      const id = t.dataset.target;
      const el = document.getElementById(id);
      if (el) el.classList.add("active");
    });
  });

  /* idade automática */
  document.getElementById("dataNascimento").addEventListener("change", () => {
    const v = document.getElementById("dataNascimento").value;
    if (!v) { document.getElementById("idadeCrianca").value = ""; return; }
    const nascimento = new Date(v);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
    if (idade < 0) idade = 0;
    document.getElementById("idadeCrianca").value = idade;
  });

  /* pulseira auto */
  function calcBracelet() {
    const altura = document.getElementById("alturaCrianca").value;
    const pode = document.getElementById("podeSairSozinho").value;
    if (document.getElementById("manualPulseira").checked) return document.getElementById("corPulseira").value;
    let c = "";
    // Regras solicitadas:
    // Crianças que NÃO SAEM → VERMELHA
    // Crianças que SAEM SOZINHAS → VERDE
    // Crianças com +1m que ficam SÓ no parque → AMARELA
    if (altura === "<1m") {
      c = "VERMELHA";
    } else if (altura === ">=1m") {
      if (pode === "sim") c = "VERDE";
      else c = "AMARELA";
    }
    document.getElementById("corPulseira").value = c;
    return c;
  }
  document.getElementById("alturaCrianca").onchange = calcBracelet;
  document.getElementById("podeSairSozinho").onchange = calcBracelet;

  /* setores */
  document.querySelectorAll(".setor-card").forEach(card => {
    card.onclick = () => {
      document.querySelectorAll(".setor-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    };
  });

  /* QR rendering (uses qrcodejs) */
  function renderQrForData(obj) {
    const el = document.getElementById("qrcodeGerado");
    if (!el) return;
    el.innerHTML = "";
    try {
      const text = JSON.stringify(obj);
      new QRCode(el, { text: text, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.H });
      document.getElementById("qrIdLabel").textContent = obj.id;
      return true;
    } catch (e) { console.warn("QR render failed", e); return false; }
  }

  function downloadQrImage(filename = "qr_parquinho.png") {
    const el = document.getElementById("qrcodeGerado").querySelector("img, canvas");
    if (!el) return alert("Gere o QR primeiro.");
    if (el.tagName.toLowerCase() === "img") {
      const a = document.createElement("a"); a.href = el.src; a.download = filename; a.click();
    } else {
      const a = document.createElement("a"); a.href = el.toDataURL("image/png"); a.download = filename; a.click();
    }
  }

  document.getElementById("baixarQR").onclick = () => downloadQrImage();

  document.getElementById("imprimirQR").onclick = () => {
    const el = document.getElementById("qrcodeGerado");
    if (!el || el.innerHTML.trim() === "") return alert("Gere o QR primeiro.");
    // Open a small print window with the QR in a 3x3cm box
    const html = `
      <html><head><title>Imprimir QR</title><style>body{margin:0;padding:10px;font-family:Arial} .box{width:90px;height:90px;display:flex;align-items:center;justify-content:center}</style></head>
      <body><div class="box">${el.innerHTML}</div></body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    setTimeout(()=>{ w.print(); }, 600);
  };

  /* cadastro */
  document.getElementById("registrarCadastro").onclick = () => {
    const nome = document.getElementById("nomeCrianca").value.trim();
    const dataNascimento = document.getElementById("dataNascimento").value.trim();
    const idade = document.getElementById("idadeCrianca").value.trim();
    const altura = document.getElementById("alturaCrianca").value;
    const alergias = document.getElementById("alergias").value.trim();
    const pode = document.getElementById("podeSairSozinho").value;

    const resp = document.getElementById("nomeResp").value.trim();
    const tel = document.getElementById("telefoneResp").value.trim();
    const email = document.getElementById("emailResp").value.trim();

    const setorCard = document.querySelector(".setor-card.selected");
    if (!setorCard) return alert("Selecione um setor!");
    const setor = setorCard.dataset.setor;

    const mesa = document.getElementById("numeroMesa").value.trim();

    if (!nome || !dataNascimento || !idade || !altura || !resp || !tel || !email || !mesa) return alert("Preencha todos os campos.");

    const bracelet = calcBracelet() || "—";
    const id = "TPS-" + uid(8);

    const client = {
      id,
      nome,
      idade,
      dataNascimento,
      altura,
      alergias,
      podeSairSozinho: pode,
      responsavel: resp,
      telefone: tel,
      email,
      setorPreferencia: setor,
      mesaPreferencia: mesa,
      pulseira: bracelet,
      qrCode: id,
      createdAt: nowISO()
    };

    clients.push(client);
    // Save phone to marketing list (if not present)
    savePhoneToMarketing(tel, client);

    saveAll();

    // Render QR with full data (embed JSON)
    const qrData = {
      id: client.qrCode,
      nome: client.nome,
      idade: client.idade,
      dataNascimento: client.dataNascimento,
      alergias: client.alergias,
      altura: client.altura,
      responsavel: client.responsavel,
      telefone: client.telefone,
      email: client.email,
      pulseira: client.pulseira,
      setor: client.setorPreferencia,
      mesa: client.mesaPreferencia
    };
    renderQrForData(qrData);
    atualizarListaClients();

    // reset form
    document.querySelectorAll("#cadastro input:not([readonly]), #cadastro select, #cadastro textarea").forEach(i => i.value = "");
    document.querySelectorAll(".setor-card").forEach(c => c.classList.remove("selected"));
    document.getElementById("corPulseira").value = "";

    alert("Cadastro salvo — QR gerado (contendo os dados). Use a aba Leitor QR para ler.");
  };

  /* marketing helper: save phone (simple local DB) */
  function savePhoneToMarketing(phone, client) {
    const db = JSON.parse(localStorage.getItem("marketingPhones") || "[]");
    if (!db.find(x => x.phone === phone)) {
      db.push({ phone, name: client.nome, id: client.id, createdAt: nowISO() });
      localStorage.setItem("marketingPhones", JSON.stringify(db));
    }
  }

  /* presentes / histórico helpers */
  function addManualEntry(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return alert("Cliente não encontrado.");
    if (presentes.find(p => p.id === clientId)) return alert("Já presente.");
    const start = nowISO();
    const item = {
      id: client.id,
      nome: client.nome,
      idade: client.idade,
      dataNascimento: client.dataNascimento,
      altura: client.altura,
      alergias: client.alergias,
      podeSairSozinho: client.podeSairSozinho,
      responsavel: client.responsavel,
      telefone: client.telefone,
      email: client.email,
      setor: client.setorPreferencia,
      mesa: client.mesaPreferencia,
      pulseira: client.pulseira,
      entradaISO: start,
      entradaDisplay: timeDisplay(start),
      qrCode: client.qrCode
    };
    presentes.push(item);
    saveAll();
    atualizarPresentes();
    // automatic message on entry (opens WhatsApp)
    autoNotifyEntry(item);
  }
  window.registrarEntradaManual = addManualEntry;

  window.registrarSaidaManualmente = function (index) {
    const item = presentes[index];
    if (!item) return;
    const out = nowISO();
    const t = duration(item.entradaISO, out);
    const registro = { ...item, saidaISO: out, tempo: t };
    historico.unshift(registro);
    presentes.splice(index, 1);
    saveAll();
    atualizarPresentes();
    atualizarHistorico();
    // automatic message on exit
    autoNotifyExit(registro);
  };

  function atualizarPresentes() {
    const area = document.getElementById("listaPresentes");
    area.innerHTML = "";
    if (presentes.length === 0) { area.innerHTML = "<div class='card-reg'>Nenhuma criança presente.</div>"; return; }
    presentes.forEach((p, i) => {
      const el = document.createElement("div"); el.className = "card-reg";
      el.innerHTML = `
        <div class="small-row"><strong>${p.nome}</strong> <span style="color:var(--muted);margin-left:8px">${p.responsavel}</span></div>
        <div class="small-row">🎂 ${p.dataNascimento} • ${p.idade} anos • 📏 ${p.altura}</div>
        <div class="small-row">📞 ${p.telefone} • 🎨 ${p.pulseira} • 🌿 ${p.setor} • Mesa ${p.mesa}</div>
        <div class="small-row">⚠️ ${p.alergias || "Sem restrições"}</div>
        <div class="small-row">⏰ Entrada: ${p.entradaDisplay}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px"><button onclick="registrarSaidaManualmente(${i})">Registrar Saída</button></div>
      `;
      area.appendChild(el);
    });
  }

  function atualizarHistorico() {
    const area = document.getElementById("listaHistorico");
    area.innerHTML = "";
    if (historico.length === 0) { area.innerHTML = "<div class='card-reg'>Nenhum histórico.</div>"; return; }
    historico.forEach(h => {
      const el = document.createElement("div"); el.className = "card-reg";
      el.innerHTML = `
        <div class="small-row"><strong>${h.nome}</strong> • ${h.idade} anos</div>
        <div class="small-row">🎂 Nascimento: ${h.dataNascimento || "—"}</div>
        <div class="small-row">📏 Altura: ${h.altura} • 🎨 Pulseira: ${h.pulseira}</div>
        <div class="small-row">⚠️ Alergias: ${h.alergias || "Nenhuma"}</div>
        <div class="small-row">🚸 Pode sair sozinho? ${h.podeSairSozinho === "sim" ? "Sim" : "Não"}</div>
        <div class="small-row">👤 Responsável: ${h.responsavel} • ${h.telefone}</div>
        <div class="small-row">✉️ Email: ${h.email}</div>
        <div class="small-row">📍 Setor: ${h.setor} • Mesa: ${h.mesa}</div>
        <div class="small-row">🆔 QRCode (ID): ${h.qrCode}</div>
        <div class="small-row">➡️ Entrada: ${timeDisplay(h.entradaISO)}</div>
        <div class="small-row">⬅️ Saída: ${timeDisplay(h.saidaISO)}</div>
        <div class="small-row">⏳ Permanência: ${h.tempo || duration(h.entradaISO, h.saidaISO)}</div>
      `;
      area.appendChild(el);
    });
  }

  /* export CSV & limpar */
  document.getElementById("exportCsv").onclick = () => {
    if (historico.length === 0) return alert("Nenhum histórico para exportar.");
    const rows = [["Nome", "Nascimento", "Idade", "Telefone", "Entrada", "Saída", "Permanência", "Pulseira", "Setor", "Mesa", "Alergias"]];
    historico.forEach(h => rows.push([h.nome, h.dataNascimento, h.idade, h.telefone, timeDisplay(h.entradaISO), timeDisplay(h.saidaISO), h.tempo || duration(h.entradaISO, h.saidaISO), h.pulseira, h.setor, h.mesa, h.alergias]));
    const csv = rows.map(r => r.map(v => '\"' + String(v || "").replace(/\"/g, '""') + '\"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "historico_parquinho.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById("limparHistorico").onclick = () => {
    if (!confirm("Confirma limpar TODO o histórico?")) return;
    historico = [];
    saveAll();
    atualizarHistorico();
  };

  /* QR reader (html5-qrcode) */
  let html5QrCode = null;
  let leitorAtivo = false;
  let lastReadAt = 0;

  async function startScanner() {
    try {
      if (leitorAtivo) return;
      const regionId = "qrScanner";
      html5QrCode = new Html5Qrcode(regionId);
      const cams = await Html5Qrcode.getCameras();
      if (!cams || cams.length === 0) return alert("Nenhuma câmera encontrada. Use o botão Teste em outro dispositivo.");
      const camId = cams.find(c => /back|rear|environment/i.test(c.label))?.id || cams[0].id;
      await html5QrCode.start(camId, { fps: 12, qrbox: 300 }, decoded => {
        const now = Date.now();
        if (now - lastReadAt < 700) return;
        lastReadAt = now;
        handleScan(decoded);
      }, err => { /* tiny errors ignored */ });
      leitorAtivo = true;
    } catch (err) {
      console.error("Scanner start error:", err);
      alert("Erro ao abrir a câmera. Verifique permissão e se a página usa HTTPS.");
    }
  }

  async function stopScanner() {
    try {
      if (html5QrCode && leitorAtivo) {
        await html5QrCode.stop();
        html5QrCode.clear();
        leitorAtivo = false;
      }
    } catch (err) { console.warn("stop error", err); }
  }

  document.getElementById("iniciarLeitor").onclick = startScanner;
  document.getElementById("pararLeitor").onclick = stopScanner;

  document.getElementById("testarLeitura").onclick = () => {
    if (clients.length === 0) return alert("Cadastre ao menos um cliente para testar.");
    const last = clients[clients.length - 1];
    // Simula a leitura do QR (usa o QR JSON string)
    handleScan(JSON.stringify({
      id: last.qrCode,
      nome: last.nome,
      idade: last.idade,
      dataNascimento: last.dataNascimento,
      alergias: last.alergias,
      altura: last.altura,
      responsavel: last.responsavel,
      telefone: last.telefone,
      email: last.email,
      pulseira: last.pulseira,
      setor: last.setorPreferencia,
      mesa: last.mesaPreferencia
    }));
  };

  function handleScan(text) {
    const resEl = document.getElementById("resultadoLeitura");
    resEl.style.display = "block";
    const raw = String(text).trim();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) {
      // If text is an ID, try to find client by id
      parsed = null;
    }
    // find by parsed.id or by raw id
    const id = parsed?.id || raw;
    const client = clients.find(c => c.qrCode === id);
    const present = client ? presentes.find(p => p.id === client.id) : null;

    if (!client && !present) { resEl.innerHTML = "<div style='color:#c00'>QR não cadastrado</div>"; return; }

    if (!present && client) {
      const start = nowISO();
      const item = {
        id: client.id,
        nome: client.nome,
        idade: client.idade,
        dataNascimento: client.dataNascimento,
        altura: client.altura,
        alergias: client.alergias,
        podeSairSozin
