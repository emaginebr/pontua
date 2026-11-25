/* Pontua — montador dos mockups (T004). Só para documentação: funciona via file://, sem servidor.
   Cada <section class="variant" data-tpl="id" data-sizes="360x780,1280x820"> renderiza o
   <template id="id"> em molduras do tamanho pedido, com a casca do app (AppShell).
   Atributos do <template>:
     data-shell   app (padrão) | public | bare
     data-nav     ponto | historico | aprovacoes | empresa
     data-role    owner | manager | member
     data-pending número no contador de Aprovações
     data-queue   número de marcações aguardando envio (ponto índigo na aba Ponto)
     data-offline "1" mostra o OfflineBanner
     data-overlay id de outro <template> renderizado como modal/folha por cima
     data-toast   "tipo|Título|Descrição" (tipo: success, offline, danger, warning)
     data-update  "1" mostra o UpdatePrompt
     data-scroll  px de rolagem inicial do conteúdo (para mostrar a parte de baixo)
   Ícones: <i data-i="clock" class="s16"></i> vira <svg class="ic s16"> do sprite (lucide, ISC). */
(function () {
  const I = {
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    "clipboard-check": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    "building-2": '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    "user-round": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    "chevrons-up-down": '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-up": '<path d="m18 15-6-6-6 6"/>',
    "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "circle-x": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    "circle-alert": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    "undo-2": '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    "pen-line": '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "cloud-off": '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    "cloud-upload": '<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>',
    "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "calendar-x": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    "sliders-horizontal": '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    "share-2": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    "settings-2": '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    "refresh-cw": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    "shield-check": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "arrow-left-right": '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    "loader-circle": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    "square-plus": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    "user-x": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
  };
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
    Object.entries(I).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("") + "</svg>";
  document.body.insertAdjacentHTML("afterbegin", sprite);
  const ic = (n, c = "") => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const icons = (root) => root.querySelectorAll("i[data-i]").forEach((el) => { el.outerHTML = ic(el.dataset.i, el.className); });

  const ROLE = { owner: "Responsável", manager: "Gestor", member: "Membro" };
  function shell(d, content) {
    const role = d.role || "owner", nav = d.nav || "ponto", pend = +(d.pending || 0), queue = +(d.queue || 0);
    const canApprove = role !== "member";
    const items = [
      ["ponto", "Ponto", "clock", "/"],
      ["historico", "Histórico", "history", "/historico"],
      canApprove && ["aprovacoes", "Aprovações", "clipboard-check", "/aprovacoes"],
      ["empresa", "Empresa", "building-2", "/empresa"]
    ].filter(Boolean);
    const extra = (k, inSide) => {
      if (k === "aprovacoes" && pend) return `<span class="count" aria-hidden="true">${pend}</span>`;
      if (k === "ponto" && queue) return `<span class="qdot" aria-hidden="true"></span>`;
      return "";
    };
    const aria = (k, t) => k === "aprovacoes" && pend ? `${t}, ${pend} ${pend === 1 ? "pendência" : "pendências"}` :
      k === "ponto" && queue ? `${t}, ${queue} aguardando envio` : t;
    const tab = items.map(([k, t, i, h]) => `<a href="#${h}" ${k === nav ? 'aria-current="page"' : ""} aria-label="${aria(k, t)}"><span class="pill">${ic(i, "s24")}${extra(k)}</span><span aria-hidden="true">${t}</span></a>`).join("");
    const side = items.map(([k, t, i, h]) => `<a href="#${h}" ${k === nav ? 'aria-current="page"' : ""} aria-label="${aria(k, t)}">${ic(i)}<span aria-hidden="true">${t}</span>${extra(k, true)}</a>`).join("");
    const company = d.company || "Padaria Sol";
    const sw = `<button class="switcher" aria-label="Empresa: ${company}, ${ROLE[role]}. Trocar de empresa"><span class="grow"><span class="nm">${company}</span><span class="rl">${ROLE[role]}</span></span>${ic("chevrons-up-down")}</button>`;
    const banner = d.offline === "1" ? `<div class="banner offline" role="status">${ic("cloud-off")}<span><strong>Sem conexão.</strong> Você ainda pode registrar o ponto.</span></div>` : "";
    if (d.shell === "public") return `<div class="pub">${content}</div>`;
    if (d.shell === "bare") return `<div class="app"><div class="col"><header class="topbar" style="display:flex"><img class="logo" src="../assets/logo.png" alt="Pontua"><span class="grow"></span><button class="iconbtn" aria-label="Minha conta">${ic("user-round", "s24")}</button></header><main class="main" id="conteudo">${content}</main></div></div>`;
    return `<div class="app"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
      <aside class="sidenav"><img class="logo" src="../assets/logo.png" alt="Pontua">${sw}<nav aria-label="Principal">${side}</nav><span class="grow"></span>
        <a class="navinstall" href="#">${ic("download")}Instalar app</a>
        <a class="me" href="#/conta"><span class="avatar">MC</span><span>Mariana Costa<small>mariana@padariasol.com.br</small></span></a></aside>
      <div class="col"><header class="topbar"><img class="sym" src="../assets/logo-symbol.png" alt="">${sw}<button class="iconbtn" aria-label="Minha conta">${ic("user-round", "s24")}</button></header>
        ${banner}<main class="main" id="conteudo"><div class="page">${content}</div></main>
        <nav class="tabbar" aria-label="Principal">${tab}</nav></div></div>`;
  }

  document.querySelectorAll(".variant[data-tpl]").forEach((sec) => {
    const tpl = document.getElementById(sec.dataset.tpl);
    const d = tpl.dataset;
    const sizes = (sec.dataset.sizes || "360x780,1280x820").split(",");
    const mob = document.createElement("div"); mob.className = "frames";
    const desk = document.createElement("div"); desk.className = "frames desk";
    sizes.forEach((s) => {
      const [w, h] = s.split("x").map(Number);
      const fig = document.createElement("figure");
      fig.className = "frame " + (w >= 1024 ? "d" : "m");
      const label = (w >= 1024 ? "Computador" : "Celular") + ` · ${w} px` + (sec.dataset.caption ? ` — ${sec.dataset.caption}` : "");
      let over = "";
      if (d.overlay) {
        const o = document.getElementById(d.overlay);
        over = `<div class="ov"><div class="sheet ${o.dataset.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="${d.overlay}-t-${w}"><div class="grab" aria-hidden="true"></div>${o.innerHTML.replaceAll("{T}", `${d.overlay}-t-${w}`)}</div></div>`;
      }
      let toast = "";
      if (d.toast) { const [k, t, s2] = d.toast.split("|"); const icn = { success: "circle-check", offline: "cloud-off", danger: "circle-alert", warning: "triangle-alert" }[k]; toast = `<div class="toast t-${k}" role="status">${ic(icn)}<div class="grow"><strong>${t}</strong>${s2 ? `<span>${s2}</span>` : ""}</div><button class="iconbtn" style="width:44px;height:44px;margin:-10px -6px -10px 0" aria-label="Fechar aviso">${ic("x", "s16")}</button></div>`; }
      const upd = d.update === "1" ? `<div class="update" role="status">${ic("refresh-cw")}<strong class="grow sm">Nova versão disponível</strong><button class="btn btn-tertiary btn-sm">Depois</button><button class="btn btn-primary btn-sm">Atualizar</button></div>` : "";
      fig.innerHTML = `<figcaption>${label}</figcaption><div class="fi" style="width:${w}px;height:${h}px;--frame-h:${h}px"><div class="vp">${shell(d, tpl.innerHTML)}</div>${upd}${toast}${over}</div>`;
      icons(fig);
      (w >= 1024 ? desk : mob).appendChild(fig);
      if (d.scroll) requestAnimationFrame(() => { fig.querySelector(".vp").scrollTop = +d.scroll; });
    });
    if (mob.children.length) sec.appendChild(mob);
    if (desk.children.length) sec.appendChild(desk);
  });
  icons(document);
})();
