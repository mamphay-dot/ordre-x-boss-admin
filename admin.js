/* ============================================================
   BOSS Admin — Console super-admin cross-tenant
   ============================================================ */
(function(){
"use strict";
const NET = window.BOSSNET;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const on = (el,ev,fn) => el && el.addEventListener(ev,fn);
const escapeHtml=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const fmtF=n=>Math.round(Number(n)||0).toLocaleString("fr-FR")+" F";
const fmtInt=n=>Math.round(Number(n)||0).toLocaleString("fr-FR");
const fmtDate=ts=>{ if(!ts) return "—"; const d=new Date(typeof ts==="number"?ts:Date.parse(ts)); return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtDateTime=ts=>{ if(!ts) return "—"; const d=new Date(typeof ts==="number"?ts:Date.parse(ts)); return d.toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const daysBetween=(a,b)=>Math.round((b-a)/86400000);

let _tab = "vue";
let _rows = [];
let _sortKey = "last_activity_at";
let _sortDir = -1;
let _filterText = "";

/* ============ Boot ============ */
async function boot(){
  if(!NET || !NET.isConfigured()){
    document.body.innerHTML = "<div class='login-wrap'><h1>Configuration manquante</h1><div class='sub'>Cette console n'a pas été branchée sur Supabase.</div></div>";
    return;
  }
  try { await NET.auth.captureFromURL(); } catch(_){}
  if(NET.auth.session()){
    try { await NET.auth.me(); } catch(_){}
    if(NET.auth.session()) return afterLogin();
  }
  showLogin();
}

function showLogin(){
  $("#app-shell").style.display="none";
  $("#app-denied").style.display="none";
  $("#app-login").style.display="block";
  on($("#lg-signin"),"click", signInPassword);
  on($("#lg-signup"),"click", signUpPassword);
  on($("#lg-magic"),"click", magicLink);
  on($("#lg-forgot"),"click", forgotPassword);
  on($("#lg-pw"),"keydown", e=>{ if(e.key==="Enter") signInPassword(); });
}

async function forgotPassword(){
  const email = $("#lg-email").value.trim();
  if(!validEmail(email)){ setLoginStatus("Entre d'abord ton email dans le champ ci-dessus.", false); return; }
  setLoginStatus("Envoi du lien de réinitialisation…");
  try{
    // Supabase Auth : POST /auth/v1/recover
    const cfg = window.__BOSS_SUPABASE__;
    const resp = await fetch(cfg.url + "/auth/v1/recover", {
      method:"POST",
      headers:{"apikey":cfg.anonKey, "Content-Type":"application/json"},
      body: JSON.stringify({ email, options:{ redirectTo: location.origin + "/" } })
    });
    if(!resp.ok){
      const j = await resp.json().catch(()=>({}));
      throw new Error(j.message || j.error_description || ("HTTP "+resp.status));
    }
    setLoginStatus("Lien de réinitialisation envoyé à <b>"+escapeHtml(email)+"</b>. Ouvre ton email, clique le lien, choisis ton nouveau mot de passe.", true);
  }catch(e){
    setLoginStatus("Échec : "+escapeHtml(e.message||"réessaie plus tard"), false);
  }
}
function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function setLoginStatus(html, ok){
  const st=$("#lg-status");
  st.innerHTML = ok===true ? "<span class='ok'>"+html+"</span>"
              : ok===false ? "<span class='err'>"+html+"</span>"
              : html;
}
async function signInPassword(){
  const email=$("#lg-email").value.trim(); const pw=$("#lg-pw").value;
  if(!validEmail(email)){ setLoginStatus("Email invalide.", false); return; }
  if(!pw){ setLoginStatus("Entre ton mot de passe.", false); return; }
  setLoginStatus("Connexion…");
  try{
    await NET.auth.signIn(email, pw);
    setLoginStatus("✅ Connecté", true);
    setTimeout(afterLogin, 400);
  }catch(e){
    const m=(e.message||"").toLowerCase();
    if(m.includes("invalid") || m.includes("credentials")) setLoginStatus("Email ou mot de passe incorrect. Utilise le lien par email si tu as oublié.", false);
    else setLoginStatus("Échec : "+escapeHtml(e.message||"réessaie"), false);
  }
}
async function signUpPassword(){
  const email=$("#lg-email").value.trim(); const pw=$("#lg-pw").value;
  if(!validEmail(email)){ setLoginStatus("Email invalide.", false); return; }
  if(!pw || pw.length<6){ setLoginStatus("Mot de passe : 6 caractères minimum.", false); return; }
  setLoginStatus("Création du compte…");
  try{
    await NET.auth.signUp(email, pw);
    if(NET.auth.session()){ setLoginStatus("✅ Compte créé et connecté", true); setTimeout(afterLogin, 400); }
    else setLoginStatus("✅ Compte créé. Vérifie ton email pour confirmer, puis reviens te connecter.", true);
  }catch(e){
    const m=(e.message||"").toLowerCase();
    if(m.includes("already") || m.includes("registered")) setLoginStatus("Cet email a déjà un compte. Utilise « Se connecter » avec ton mot de passe.", false);
    else setLoginStatus("Échec : "+escapeHtml(e.message||"réessaie"), false);
  }
}
async function magicLink(){
  const email = $("#lg-email").value.trim();
  if(!validEmail(email)){ setLoginStatus("Email invalide.", false); return; }
  setLoginStatus("Envoi du lien…");
  try{
    await NET.auth.magicLink(email, location.origin+"/");
    setLoginStatus("Lien envoyé à <b>"+escapeHtml(email)+"</b>. Regarde ton email (et les spams).", true);
  }catch(e){ setLoginStatus("Échec : "+escapeHtml(e.message||"réessaie"), false); }
}

async function afterLogin(){
  // Vérifier super-admin via RPC
  let isSuper=false;
  try { const r = await NET.rpc("is_super_admin", {}); isSuper = r===true || r==="t"; } catch(e){ isSuper=false; }
  if(!isSuper){
    $("#app-login").style.display="none";
    $("#app-shell").style.display="none";
    $("#app-denied").style.display="block";
    on($("#deny-signout"),"click", async()=>{ await NET.auth.signOut(); location.reload(); });
    return;
  }
  $("#app-login").style.display="none";
  $("#app-denied").style.display="none";
  $("#app-shell").style.display="block";
  renderUserChip();
  wireTabs();
  await loadTab(_tab);
}

function renderUserChip(){
  const u = NET.auth.user();
  const email = u?.email || "—";
  $("#user-chip").innerHTML = "<b>"+escapeHtml(email)+"</b><button class='logout' title='Se déconnecter'>×</button>";
  on($("#user-chip .logout"),"click", async()=>{ await NET.auth.signOut(); location.reload(); });
}

function wireTabs(){
  $$(".tab").forEach(b=>{
    b.onclick = async()=>{
      _tab = b.dataset.t;
      $$(".tab").forEach(x=>x.classList.toggle("on", x===b));
      await loadTab(_tab);
    };
  });
}

async function loadTab(t){
  const body = $("#app-body");
  body.innerHTML = "<div class='muted'>Chargement…</div>";
  try {
    if(t==="vue") return renderVue(body);
    if(t==="clients") return renderClients(body);
    if(t==="rapports") return renderRapports(body);
    if(t==="admins") return renderAdmins(body);
  } catch(e){
    body.innerHTML = "<div class='err'>Erreur : "+escapeHtml(e.message||"—")+"</div>";
  }
}

/* ============ Vue d'ensemble ============ */
async function renderVue(body){
  const stats = await fetchStats();
  const rows = await fetchOrgs();
  const activeCount = rows.filter(r=>isActive(r)).length;
  const paidCount = rows.filter(r=>isPaid(r)).length;
  const trialCount = rows.filter(r=>isTrial(r)).length;
  const lockedCount = rows.filter(r=>r.locked_manually).length;
  const totalCA = rows.reduce((s,r)=>s+Number(r.ca_total_fcfa||0),0);
  const totalBiz = rows.reduce((s,r)=>s+Number(r.business_count||0),0);
  const growth = stats.ca_prev_30j > 0
    ? ((stats.ca_30j - stats.ca_prev_30j) / stats.ca_prev_30j * 100).toFixed(0)
    : (stats.ca_30j>0?"+∞":"—");

  body.innerHTML = `
    <h1>Vue d'ensemble</h1>
    <div class="muted">État de la flotte BOSS · mise à jour ${fmtDateTime(Date.now())}</div>

    <div class="cards">
      <div class="card gold"><div class="lbl">Total organisations</div><div class="val">${fmtInt(rows.length)}</div><div class="sub">${fmtInt(activeCount)} actives 30j</div></div>
      <div class="card ok"><div class="lbl">Clients payants</div><div class="val">${fmtInt(paidCount)}</div><div class="sub">${fmtInt(trialCount)} en essai</div></div>
      <div class="card ${lockedCount>0?'danger':'info'}"><div class="lbl">Comptes verrouillés</div><div class="val">${fmtInt(lockedCount)}</div><div class="sub">manuellement</div></div>
      <div class="card"><div class="lbl">Businesses gérés</div><div class="val">${fmtInt(totalBiz)}</div><div class="sub">cumulé</div></div>
      <div class="card gold"><div class="lbl">CA cumulé</div><div class="val">${fmtF(totalCA)}</div><div class="sub">tous clients confondus</div></div>
      <div class="card ${Number(growth)>=0?'ok':'danger'}"><div class="lbl">CA 30 derniers jours</div><div class="val">${fmtF(stats.ca_30j)}</div><div class="sub">${growth>=0?'+':''}${growth}% vs 30j précédents</div></div>
      <div class="card info"><div class="lbl">Nouvelles inscriptions 30j</div><div class="val">${fmtInt(stats.signups_30j)}</div><div class="sub">${fmtInt(stats.total_users)} utilisateurs au total</div></div>
    </div>

    <h2>Derniers clients actifs</h2>
    <div id="vue-table"></div>`;

  const recent = rows.slice().sort((a,b)=>Date.parse(b.last_activity_at||0)-Date.parse(a.last_activity_at||0)).slice(0,10);
  $("#vue-table").innerHTML = renderOrgTable(recent, true);
  wireOrgTable();
}

/* ============ Clients (liste complète) ============ */
async function renderClients(body){
  _rows = await fetchOrgs();
  body.innerHTML = `
    <h1>Clients</h1>
    <div class="muted">${fmtInt(_rows.length)} organisations enregistrées</div>
    <div class="toolbar">
      <input class="search" id="cli-search" placeholder="Rechercher un client, email, statut…">
      <button class="btn" id="cli-export-csv">📥 Exporter CSV</button>
      <button class="btn" id="cli-refresh">🔄 Rafraîchir</button>
    </div>
    <div id="cli-table"></div>`;
  on($("#cli-search"),"input", e=>{ _filterText = e.target.value.toLowerCase(); renderClientsTable(); });
  on($("#cli-refresh"),"click", async()=>{ _rows = await fetchOrgs(); renderClientsTable(); });
  on($("#cli-export-csv"),"click", exportCSV);
  renderClientsTable();
}

function renderClientsTable(){
  const filtered = _rows.filter(r=>{
    if(!_filterText) return true;
    const hay = (r.nom+" "+(r.owner_email||"")+" "+statusLabel(r)).toLowerCase();
    return hay.includes(_filterText);
  });
  filtered.sort((a,b)=>{
    let va=a[_sortKey], vb=b[_sortKey];
    if(typeof va==="string"){ va=va.toLowerCase(); vb=(vb||"").toLowerCase(); }
    if(va<vb) return -1*_sortDir;
    if(va>vb) return 1*_sortDir;
    return 0;
  });
  $("#cli-table").innerHTML = renderOrgTable(filtered, true);
  wireOrgTable();
}

function renderOrgTable(rows, clickable){
  if(!rows.length) return "<div class='muted'>Aucune organisation.</div>";
  const th = (k, label, num) => `<th data-sort="${k}" class="${num?'num':''}">${escapeHtml(label)}${_sortKey===k?(_sortDir>0?" ▲":" ▼"):""}</th>`;
  const body = rows.map(r=>{
    const st = statusLabel(r);
    return `<tr class="${clickable?'row-click':''}" data-id="${r.organization_id}">
      <td><b>${escapeHtml(r.nom)}</b></td>
      <td>${escapeHtml(r.owner_email||"—")}</td>
      <td><span class="badge b-${statusKey(r)}">${escapeHtml(st)}</span></td>
      <td class="num">${fmtF(r.ca_total_fcfa)}</td>
      <td class="num">${fmtInt(r.business_count)}</td>
      <td class="num">${fmtInt(r.membres_count)}</td>
      <td>${fmtDateTime(r.last_activity_at)}</td>
    </tr>`;
  }).join("");
  return `<div style="overflow:auto"><table>
    <thead><tr>
      ${th("nom","Client",false)}
      ${th("owner_email","Email propriétaire",false)}
      ${th("_status","Statut",false)}
      ${th("ca_total_fcfa","CA total",true)}
      ${th("business_count","Business",true)}
      ${th("membres_count","Membres",true)}
      ${th("last_activity_at","Dernière activité",false)}
    </tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}
function wireOrgTable(){
  $$("th[data-sort]").forEach(t=>{
    t.onclick = ()=>{
      const k = t.dataset.sort;
      if(_sortKey===k) _sortDir *= -1; else { _sortKey=k; _sortDir = k==="ca_total_fcfa"||k==="business_count"||k==="membres_count"||k==="last_activity_at"?-1:1; }
      renderClientsTable();
    };
  });
  $$(".row-click").forEach(r=>r.onclick = ()=>openDetail(r.dataset.id));
}

/* ============ Détail client ============ */
async function openDetail(orgId){
  const org = _rows.find(r=>r.organization_id===orgId) || (await fetchOrgs()).find(r=>r.organization_id===orgId);
  if(!org){ alert("Introuvable"); return; }
  const members = await NET.db("memberships").select({organization_id:"eq."+orgId}).catch(()=>[]);
  const profiles = await NET.db("profiles").select({organization_id:"eq."+orgId, deleted_at:"is.null"}).catch(()=>[]);
  const audit = await NET.db("audit_log").select({organization_id:"eq."+orgId, order:"created_at.desc", limit:"30"}).catch(()=>[]);
  const now = Date.now();

  const daysLeftPaid = org.paid_until_ms > now ? Math.ceil((org.paid_until_ms-now)/86400000) : 0;
  const trialEndMs = (Number(org.installed_at_ms)||now) + (org.trial_days||90)*86400000;
  const daysLeftTrial = trialEndMs > now ? Math.ceil((trialEndMs-now)/86400000) : 0;

  __currentDetail = { org, orgId, profiles, members, audit, activeBiz: 0 };

  const bizTabs = profiles.map((p,i)=>{
    const d = p.data||{};
    return `<button class="biz-tab ${i===0?'on':''}" data-biz="${i}">${escapeHtml(d.name||("Business "+(i+1)))}</button>`;
  }).join("");
  const membersRows = members.map(m=>`<tr><td>${escapeHtml(m.nom||m.user_id.slice(0,8))}</td><td>${escapeHtml(m.role)}</td><td>${fmtDate(m.created_at)}</td></tr>`).join("");
  const auditRows = audit.map(a=>`<tr><td>${fmtDateTime(a.created_at)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.actor_email||"—")}</td><td>${escapeHtml(JSON.stringify(a.meta||{}).slice(0,80))}</td></tr>`).join("");

  openModal(`
    <h2>${escapeHtml(org.nom)}</h2>
    <div class="muted">${escapeHtml(org.owner_email||"—")} · créée ${fmtDate(org.created_at)}</div>
    <div class="detail-grid">
      <div class="detail-card"><div class="k">Statut licence</div><div class="v"><span class="badge b-${statusKey(org)}">${escapeHtml(statusLabel(org))}</span></div></div>
      <div class="detail-card"><div class="k">CA total</div><div class="v">${fmtF(org.ca_total_fcfa)}</div></div>
      <div class="detail-card"><div class="k">Businesses</div><div class="v">${fmtInt(org.business_count)}</div></div>
      <div class="detail-card"><div class="k">Membres</div><div class="v">${fmtInt(org.membres_count)}</div></div>
      <div class="detail-card"><div class="k">Payé jusqu'au</div><div class="v">${org.paid_until_ms>0?fmtDate(org.paid_until_ms):"—"}${daysLeftPaid>0?` <span class="muted">(${daysLeftPaid}j)</span>`:""}</div></div>
      <div class="detail-card"><div class="k">Essai restant</div><div class="v">${daysLeftTrial>0?daysLeftTrial+" j":"expiré"}</div></div>
      <div class="detail-card"><div class="k">Dernière activité</div><div class="v">${fmtDateTime(org.last_activity_at)}</div></div>
      <div class="detail-card"><div class="k">Écritures totales</div><div class="v">${fmtInt(org.ecritures_count)}</div></div>
    </div>

    <div class="actions-row">
      ${org.locked_manually
        ? `<button class="btn primary" data-act="unlock" data-id="${org.organization_id}">🔓 Déverrouiller</button>`
        : `<button class="btn danger" data-act="lock" data-id="${org.organization_id}">🔒 Verrouiller</button>`}
      <button class="btn primary" data-act="paid30" data-id="${org.organization_id}">Marquer payé +30j</button>
      <button class="btn" data-act="paid90" data-id="${org.organization_id}">+90 jours</button>
      <button class="btn" data-act="paid365" data-id="${org.organization_id}">+1 an</button>
      <button class="btn" data-act="reset_trial" data-id="${org.organization_id}">Rétablir essai 90j</button>
      <button class="btn" id="export-full">📥 Export JSON complet</button>
    </div>

    ${profiles.length ? `
    <h2>Businesses de ce client (${profiles.length})</h2>
    <div class="biz-tabs">${bizTabs}</div>
    <div id="biz-detail">${renderBusinessDetail(profiles[0])}</div>
    ` : "<h2>Businesses</h2><div class='muted'>Aucun business enregistré.</div>"}

    <h2>Membres (${members.length})</h2>
    <div style="overflow:auto">
      <table><thead><tr><th>Nom</th><th>Rôle</th><th>Rejoint</th></tr></thead>
      <tbody>${membersRows||"<tr><td colspan=3 class='muted'>Aucun membre</td></tr>"}</tbody></table>
    </div>

    <h2>Derniers événements (${audit.length})</h2>
    <div style="overflow:auto">
      <table><thead><tr><th>Quand</th><th>Action</th><th>Auteur</th><th>Détails</th></tr></thead>
      <tbody>${auditRows||"<tr><td colspan=4 class='muted'>Aucun événement</td></tr>"}</tbody></table>
    </div>
  `);
  $$("[data-act]").forEach(b=>b.onclick = ()=>orgAction(b.dataset.act, b.dataset.id));
  $$(".biz-tab").forEach(b=>b.onclick = ()=>{ __currentDetail.activeBiz = +b.dataset.biz; document.getElementById("biz-detail").innerHTML = renderBusinessDetail(__currentDetail.profiles[__currentDetail.activeBiz]); $$(".biz-tab").forEach(x=>x.classList.toggle("on", x===b)); });
  const eb = document.getElementById("export-full"); if(eb) eb.onclick = () => exportClientJSON();
}

let __currentDetail = { orgId: null, profiles: [], activeBiz: 0 };

function renderBusinessDetail(p){
  if(!p) return "<div class='muted'>—</div>";
  const d = p.data || {};
  const revenus = d.revenus || [];
  const charges = d.charges || [];
  const caisse = d.caisse || [];
  const carnet = d.carnet || [];
  const clients = d.clients || [];
  const commandes = d.commandes || [];
  const pieces = d.pieces || [];
  const collaborateurs = d.collaborateurs || [];
  const identite = d.identite || {};
  const treso = d.tresorerie || {};

  const ventes = caisse.filter(e=>e.type==="vente");
  const depenses = caisse.filter(e=>e.type==="depense");
  const totalCA = ventes.reduce((s,e)=>s+(e.montant||0),0);
  const totalDep = depenses.reduce((s,e)=>s+(e.montant||0),0);
  const totalCharges = charges.reduce((s,c)=>s+(c.montant||0),0);
  const dettesImpayees = carnet.filter(c=>!c.paye).reduce((s,c)=>s+(c.montant||0),0);

  return `
    <div class="biz-info-grid">
      <div class="detail-card"><div class="k">Nom du business</div><div class="v">${escapeHtml(d.name||"—")}</div></div>
      <div class="detail-card"><div class="k">Métier</div><div class="v">${escapeHtml(d.metier||"—")}</div></div>
      <div class="detail-card"><div class="k">CA cumulé</div><div class="v">${fmtF(totalCA)}</div></div>
      <div class="detail-card"><div class="k">Dépenses cumulées</div><div class="v">${fmtF(totalDep)}</div></div>
      <div class="detail-card"><div class="k">Charges fixes / mois</div><div class="v">${fmtF(totalCharges)}</div></div>
      <div class="detail-card"><div class="k">Dettes impayées</div><div class="v">${fmtF(dettesImpayees)}</div></div>
    </div>

    ${identite.rccm || identite.tel || identite.adresse ? `
    <h3>Identité</h3>
    <div class="biz-info-grid">
      ${identite.rccm?`<div class="detail-card"><div class="k">RCCM</div><div class="v">${escapeHtml(identite.rccm)}</div></div>`:""}
      ${identite.ncc?`<div class="detail-card"><div class="k">NCC</div><div class="v">${escapeHtml(identite.ncc)}</div></div>`:""}
      ${identite.tel?`<div class="detail-card"><div class="k">Téléphone</div><div class="v">${escapeHtml(identite.tel)}</div></div>`:""}
      ${identite.email?`<div class="detail-card"><div class="k">Email</div><div class="v">${escapeHtml(identite.email)}</div></div>`:""}
      ${identite.adresse?`<div class="detail-card" style="grid-column:1/-1"><div class="k">Adresse</div><div class="v">${escapeHtml(identite.adresse)}</div></div>`:""}
    </div>` : ""}

    ${treso.soldes ? `
    <h3>Trésorerie (soldes)</h3>
    <div class="biz-info-grid">
      <div class="detail-card"><div class="k">Espèces</div><div class="v">${fmtF(treso.soldes.especes||0)}</div></div>
      <div class="detail-card"><div class="k">Banque</div><div class="v">${fmtF(treso.soldes.banque||0)}</div></div>
      <div class="detail-card"><div class="k">Mobile Money</div><div class="v">${fmtF(treso.soldes.mobile||0)}</div></div>
    </div>` : ""}

    <h3>Produits / Services (${revenus.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Nom</th><th class="num">Prix</th><th class="num">Coût</th><th class="num">Marge</th><th class="num">Qté/mois</th><th class="num">Stock</th></tr></thead>
      <tbody>${revenus.length ? revenus.map(r=>{
        const marge = r.prix ? Math.round(((r.prix-(r.cout||0))/r.prix)*100) : 0;
        return `<tr>
          <td><b>${escapeHtml(r.nom||"—")}</b>${r.desc?`<br><span class="muted" style="font-size:11px">${escapeHtml(String(r.desc).slice(0,80))}</span>`:""}</td>
          <td class="num">${fmtF(r.prix)}</td>
          <td class="num">${fmtF(r.cout||0)}</td>
          <td class="num" style="color:${marge>=20?'#7dd095':marge>=0?'#f3c162':'#f19595'}">${marge}%</td>
          <td class="num">${fmtInt(r.qte||0)}</td>
          <td class="num">${typeof r.stock==="number"?fmtInt(r.stock):"—"}</td>
        </tr>`;
      }).join("") : "<tr><td colspan=6 class='muted'>Aucun produit</td></tr>"}</tbody></table>
    </div>

    <h3>Charges fixes (${charges.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Poste</th><th class="num">Montant / mois</th></tr></thead>
      <tbody>${charges.length ? charges.map(c=>`<tr><td>${escapeHtml(c.nom||"—")}</td><td class="num">${fmtF(c.montant||0)}</td></tr>`).join("") : "<tr><td colspan=2 class='muted'>Aucune charge</td></tr>"}</tbody></table>
    </div>

    <h3>Ventes récentes (${Math.min(ventes.length, 50)} sur ${ventes.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Date</th><th>Motif</th><th>Canal</th><th class="num">Montant</th></tr></thead>
      <tbody>${ventes.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,50).map(e=>`
        <tr><td>${fmtDateTime(e.ts)}</td><td>${escapeHtml(e.motif||"—")}</td><td>${escapeHtml(e.canal||"especes")}</td><td class="num">${fmtF(e.montant)}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>Aucune vente</td></tr>"}</tbody></table>
    </div>

    <h3>Dépenses récentes (${Math.min(depenses.length, 30)} sur ${depenses.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Date</th><th>Motif</th><th>Canal</th><th class="num">Montant</th></tr></thead>
      <tbody>${depenses.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,30).map(e=>`
        <tr><td>${fmtDateTime(e.ts)}</td><td>${escapeHtml(e.motif||"—")}</td><td>${escapeHtml(e.canal||"especes")}</td><td class="num">${fmtF(e.montant)}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>Aucune dépense</td></tr>"}</tbody></table>
    </div>

    <h3>Dettes / Carnet (${carnet.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Client</th><th>Motif</th><th class="num">Montant</th><th>Date</th><th>Statut</th></tr></thead>
      <tbody>${carnet.length ? carnet.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).map(c=>`
        <tr><td><b>${escapeHtml(c.client||"—")}</b></td><td>${escapeHtml(c.motif||"—")}</td><td class="num">${fmtF(c.montant)}</td><td>${fmtDate(c.ts)}</td><td>${c.paye?"<span style='color:#7dd095'>✓ Payée</span>":"<span style='color:#f19595'>⏰ Impayée</span>"}</td></tr>`).join("") : "<tr><td colspan=5 class='muted'>Aucune dette</td></tr>"}</tbody></table>
    </div>

    <h3>Clients (${clients.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Nom</th><th>Téléphone</th><th>Adresse</th></tr></thead>
      <tbody>${clients.length ? clients.map(c=>`
        <tr><td><b>${escapeHtml(c.nom||"—")}</b></td><td>${escapeHtml(c.phone||"—")}</td><td>${escapeHtml(c.adresse||"—")}</td></tr>`).join("") : "<tr><td colspan=3 class='muted'>Aucun client enregistré</td></tr>"}</tbody></table>
    </div>

    <h3>Commandes récentes (${Math.min(commandes.length, 20)} sur ${commandes.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Créée</th><th>Client</th><th>Statut</th><th class="num">Total</th><th>Livraison</th></tr></thead>
      <tbody>${commandes.length ? commandes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,20).map(o=>{
        const total = (o.items||[]).reduce((s,it)=>s+(it.prix||0)*(it.qty||1), o.total||0) || o.total || 0;
        return `<tr><td>${fmtDate(o.createdAt)}</td><td>${escapeHtml(o.clientNom||"—")}</td><td>${escapeHtml(o.statut||"—")}</td><td class="num">${fmtF(total)}</td><td>${escapeHtml(o.dateLivraison||"—")}${o.creneau?" · "+escapeHtml(o.creneau):""}</td></tr>`;
      }).join("") : "<tr><td colspan=5 class='muted'>Aucune commande</td></tr>"}</tbody></table>
    </div>

    <h3>Pièces comptables (${Math.min(pieces.length, 30)} sur ${pieces.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Date</th><th>Type</th><th>Tiers</th><th>Canal</th><th class="num">Montant</th></tr></thead>
      <tbody>${pieces.length ? pieces.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,30).map(pc=>`
        <tr><td>${escapeHtml(pc.date||"—")}</td><td>${escapeHtml(pc.type||"—")}</td><td>${escapeHtml(pc.tiers||"—")}</td><td>${escapeHtml(pc.canal||"—")}</td><td class="num">${fmtF(pc.montant||0)}</td></tr>`).join("") : "<tr><td colspan=5 class='muted'>Aucune pièce</td></tr>"}</tbody></table>
    </div>

    <h3>Collaborateurs du business (${collaborateurs.length})</h3>
    <div style="overflow:auto">
      <table><thead><tr><th>Nom</th><th>Rôle</th><th>Actif</th><th>Permissions</th></tr></thead>
      <tbody>${collaborateurs.length ? collaborateurs.map(c=>`
        <tr><td>${escapeHtml(c.nom||"—")}</td><td>${escapeHtml(c.role||"—")}</td><td>${c.actif?"Oui":"Non"}</td><td>${(c.permissions||[]).map(escapeHtml).join(", ")}</td></tr>`).join("") : "<tr><td colspan=4 class='muted'>Aucun collaborateur</td></tr>"}</tbody></table>
    </div>`;
}

function exportClientJSON(){
  const { org, orgId, profiles, members, audit } = __currentDetail;
  if(!org) return;
  const payload = {
    exported_at: new Date().toISOString(),
    org: { id: orgId, nom: org.nom, owner_email: org.owner_email, created_at: org.created_at, paid_until_ms: org.paid_until_ms, locked_manually: org.locked_manually },
    members,
    audit,
    profiles: profiles.map(p=>({ id: p.id, updated_at: p.updated_at, data: p.data }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const safeName = (org.nom||"client").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const a = document.createElement("a"); a.href = url; a.download = `boss-client-${safeName}-${today()}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

async function orgAction(act, orgId){
  if(!confirm("Confirmer l'action « "+act+" » sur cette organisation ?")) return;
  let action, days=null;
  if(act==="lock") action="lock";
  else if(act==="unlock") action="unlock";
  else if(act==="paid30"){ action="mark_paid"; days=30; }
  else if(act==="paid90"){ action="mark_paid"; days=90; }
  else if(act==="paid365"){ action="mark_paid"; days=365; }
  else if(act==="reset_trial"){ action="reset_trial"; days=90; }
  try{
    await NET.rpc("admin_org_action", {p_org: orgId, p_action: action, p_days: days});
    closeModal();
    _rows = await fetchOrgs();
    if(_tab==="clients") renderClientsTable();
    else await loadTab(_tab);
  }catch(e){ alert("Échec : "+(e.message||"—")); }
}

/* ============ Rapports (dashboard banque) ============ */
async function renderRapports(body){
  const stats = await fetchStats();
  const monthly = await fetchMonthlyRevenue();
  const rows = _rows.length ? _rows : await fetchOrgs();

  const growth = stats.ca_prev_30j > 0
    ? ((stats.ca_30j - stats.ca_prev_30j) / stats.ca_prev_30j * 100).toFixed(1)
    : "—";
  const avgCA = rows.length ? Math.round(Number(stats.total_ca_fcfa)/rows.length) : 0;

  body.innerHTML = `
    <h1>Rapports pour la banque</h1>
    <div class="muted">Vue synthétique de la performance globale, exportable pour dossier de financement.</div>

    <div class="cards">
      <div class="card gold"><div class="lbl">Chiffre d'affaires cumulé</div><div class="val">${fmtF(stats.total_ca_fcfa)}</div><div class="sub">tous clients, depuis toujours</div></div>
      <div class="card ok"><div class="lbl">CA généré 30 derniers jours</div><div class="val">${fmtF(stats.ca_30j)}</div><div class="sub">${growth>=0?"+":""}${growth}% vs mois précédent</div></div>
      <div class="card"><div class="lbl">CA moyen par client</div><div class="val">${fmtF(avgCA)}</div><div class="sub">sur ${fmtInt(rows.length)} clients</div></div>
      <div class="card info"><div class="lbl">Clients payants actifs</div><div class="val">${fmtInt(stats.paying_orgs)}</div><div class="sub">${fmtInt(stats.active_orgs)} actifs 30j au total</div></div>
      <div class="card"><div class="lbl">Nouveaux clients / mois</div><div class="val">${fmtInt(stats.signups_30j)}</div><div class="sub">taux d'acquisition</div></div>
      <div class="card"><div class="lbl">Écosystème BOSS</div><div class="val">${fmtInt(stats.total_businesses)}</div><div class="sub">businesses gérés</div></div>
    </div>

    <h2>Évolution 12 mois</h2>
    ${renderMonthlyBars(monthly)}

    <div class="toolbar" style="margin-top:20px">
      <button class="btn primary" id="rpt-csv-orgs">📥 Export tous les clients (CSV)</button>
      <button class="btn" id="rpt-csv-monthly">📥 Export CA mensuel (CSV)</button>
      <button class="btn" id="rpt-print">🖨️ Version imprimable (PDF)</button>
    </div>
  `;
  on($("#rpt-csv-orgs"),"click", exportCSV);
  on($("#rpt-csv-monthly"),"click", ()=>exportCSVCustom("ca-mensuel.csv",
    "mois;organization_id;ca_fcfa;depenses_fcfa;ecritures",
    monthly.map(m=>[m.mois,m.organization_id,m.ca_fcfa,m.depenses_fcfa,m.ecritures].join(";"))
  ));
  on($("#rpt-print"),"click", ()=>window.print());
}

function renderMonthlyBars(monthly){
  if(!monthly.length) return "<div class='muted'>Pas encore de données.</div>";
  // Agrège tous clients confondus par mois
  const byMonth = {};
  monthly.forEach(r=>{
    const key = String(r.mois).slice(0,7);
    if(!byMonth[key]) byMonth[key] = { mois:key, ca:0, dep:0 };
    byMonth[key].ca += Number(r.ca_fcfa||0);
    byMonth[key].dep += Number(r.depenses_fcfa||0);
  });
  const arr = Object.values(byMonth).sort((a,b)=>a.mois.localeCompare(b.mois));
  const max = Math.max(1, ...arr.map(x=>x.ca));
  const bars = arr.map(x=>{
    const h = Math.round((x.ca/max)*140);
    const lbl = x.mois.split("-")[1]+"/"+x.mois.slice(2,4);
    return `<div style="display:flex;flex-direction:column;align-items:center;min-width:56px">
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:4px">${fmtF(x.ca)}</div>
      <div style="width:32px;height:${h}px;background:var(--gold);border-radius:6px 6px 0 0" title="${lbl} : ${fmtF(x.ca)}"></div>
      <div style="font-size:11px;color:var(--cream-dim);margin-top:6px">${lbl}</div>
    </div>`;
  }).join("");
  return `<div style="background:var(--char);border:1px solid var(--line);border-radius:12px;padding:20px;overflow:auto"><div style="display:flex;gap:10px;align-items:flex-end">${bars}</div></div>`;
}

/* ============ Super-admins ============ */
async function renderAdmins(body){
  const admins = await NET.db("super_admins").select({order:"granted_at.asc"}).catch(()=>[]);
  body.innerHTML = `
    <h1>Super-admins</h1>
    <div class="muted">Personnes ayant accès à cette console. Seul un super-admin peut en ajouter/supprimer.</div>
    <div style="margin-top:14px;overflow:auto">
      <table><thead><tr><th>User ID</th><th>Ajouté le</th><th>Note</th><th></th></tr></thead>
      <tbody>${admins.map(a=>`<tr><td><code style="font-size:11.5px">${escapeHtml(a.user_id)}</code></td><td>${fmtDate(a.granted_at)}</td><td>${escapeHtml(a.note||"—")}</td>
        <td><button class="btn danger" data-del="${a.user_id}">Retirer</button></td></tr>`).join("") || "<tr><td colspan=4 class='muted'>Aucun</td></tr>"}</tbody></table>
    </div>

    <h2>Ajouter un super-admin</h2>
    <div class="muted">L'utilisateur doit d'abord avoir un compte sur BOSS (via <b>boss.ordre-x.com</b>).</div>
    <div class="toolbar" style="margin-top:10px">
      <input class="search" id="sa-uid" placeholder="user_id UUID (visible dans Supabase → Auth → Users)">
      <input class="search" id="sa-note" placeholder="Note (optionnel)" style="min-width:180px;flex:0">
      <button class="btn primary" id="sa-add">Ajouter</button>
    </div>
    <div id="sa-status" class="muted"></div>
  `;
  $$("[data-del]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Retirer les droits super-admin de cet utilisateur ?")) return;
    try{
      await NET.db("super_admins").remove({user_id:"eq."+b.dataset.del});
      renderAdmins(body);
    }catch(e){ alert("Échec : "+(e.message||"—")); }
  });
  on($("#sa-add"),"click", async()=>{
    const uid = $("#sa-uid").value.trim();
    const note = $("#sa-note").value.trim();
    const st = $("#sa-status");
    if(!/^[0-9a-f-]{36}$/i.test(uid)){ st.textContent="UUID invalide."; return; }
    try{
      await NET.db("super_admins").insert({user_id: uid, note: note||null});
      st.textContent="Ajouté ✅";
      setTimeout(()=>renderAdmins(body), 500);
    }catch(e){ st.textContent="Échec : "+(e.message||"—"); }
  });
}

/* ============ Fetchers ============ */
async function fetchOrgs(){
  try{ return await NET.db("org_overview").select({order:"last_activity_at.desc"}); }
  catch(e){ console.error(e); return []; }
}
async function fetchStats(){
  try{
    const r = await NET.rpc("admin_stats", {});
    const arr = Array.isArray(r) ? r : [r];
    return arr[0] || {};
  }catch(e){ console.error(e); return {}; }
}
async function fetchMonthlyRevenue(){
  try{ return await NET.db("monthly_revenue").select({order:"mois.asc"}); }
  catch(e){ console.error(e); return []; }
}

/* ============ Helpers licence ============ */
function isPaid(org){ return Number(org.paid_until_ms||0) > Date.now(); }
function isTrial(org){
  const inst = Number(org.installed_at_ms)||Date.now();
  const trialEnd = inst + (org.trial_days||90)*86400000;
  return !isPaid(org) && !org.locked_manually && Date.now() < trialEnd;
}
function isActive(org){
  const t = org.last_activity_at ? Date.parse(org.last_activity_at) : 0;
  return t > Date.now() - 30*86400000;
}
function statusKey(org){
  if(org.locked_manually) return "locked";
  if(isPaid(org)) return "active";
  if(isTrial(org)) return "trial";
  const inst = Number(org.installed_at_ms)||Date.now();
  const trialEnd = inst + (org.trial_days||90)*86400000;
  const grace = trialEnd + 48*3600000;
  if(Date.now() < grace) return "grace";
  return "locked";
}
function statusLabel(org){
  return { active:"Payé", trial:"Essai", grace:"Grâce 48h", locked:"Verrouillé" }[statusKey(org)];
}

/* ============ Export CSV ============ */
function exportCSV(){
  const header = "nom;email_proprietaire;statut;ca_total_fcfa;business;membres;creation;derniere_activite;paid_until";
  const lines = _rows.map(r=>[
    (r.nom||"").replace(/;/g,","),
    (r.owner_email||"").replace(/;/g,","),
    statusLabel(r),
    r.ca_total_fcfa||0,
    r.business_count||0,
    r.membres_count||0,
    r.created_at||"",
    r.last_activity_at||"",
    r.paid_until_ms>0 ? new Date(r.paid_until_ms).toISOString() : ""
  ].join(";"));
  exportCSVCustom("boss-clients-"+today()+".csv", header, lines);
}
function exportCSVCustom(name, header, lines){
  const blob = new Blob([header+"\n"+lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function today(){ const d=new Date(); const pad=n=>String(n).padStart(2,"0"); return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()); }

/* ============ Modal ============ */
function openModal(html){ $("#modal-body").innerHTML=html; $("#modal").classList.add("on"); }
function closeModal(){ $("#modal").classList.remove("on"); }
window.closeModal = closeModal;

document.addEventListener("DOMContentLoaded", boot);
})();
