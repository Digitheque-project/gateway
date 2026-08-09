import { SERVICES, docsPathOf } from '../config/services.registry';

/**
 * Cartes de la page d'accueil, générées depuis le registre des services.
 * Ajouter une entrée dans services.registry.ts ajoute automatiquement sa carte.
 * data-search alimente la recherche côté navigateur (nom + chemin + description).
 */
function renderCards(): string {
  return SERVICES.map((service) => {
    const docsPath = docsPathOf(service);
    const searchText =
      `${service.name} ${docsPath} ${service.description ?? ''}`.toLowerCase();
    return `
    <a class="card" data-search="${searchText}" href="${docsPath}">
      <div class="card-top">
        <span class="beat"></span>
        <span class="arrow">↗</span>
      </div>
      <div>
        <div class="card-name">${service.name}</div>
        <div class="card-path">${docsPath}</div>
      </div>
      <p class="card-desc">${service.description ?? ''}</p>
    </a>`;
  }).join('');
}

/** Page d'accueil de la gateway, générée dynamiquement depuis le registre. */
export function renderHomePage(): string {
  const total = SERVICES.length;
  const serviceCount = String(total).padStart(2, '0');

  return `

<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CHU API Gateway</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#0E141F;
    --panel:#161F2E;
    --panel-hover:#1C2637;
    --line:#28324690;
    --line-strong:#3A465C;
    --teal:#2FD9C4;
    --teal-dim:#1B8A7C;
    --amber:#F5A93C;
    --amber-dim:#8A5B18;
    --text:#E8EDF4;
    --text-dim:#8A93A6;
    --text-faint:#5B6478;
    --danger:#E5646B;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background:
      radial-gradient(ellipse 900px 500px at 15% -10%, #14304a30, transparent),
      var(--ink);
    color:var(--text);
    font-family:'Inter',sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:880px;margin:0 auto;padding:56px 24px 80px;}

  header{margin-bottom:8px;}
  .eyebrow{
    font-family:'IBM Plex Mono',monospace;
    font-size:12px;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:var(--teal);
    display:flex;align-items:center;gap:8px;
    margin-bottom:14px;
  }
  .eyebrow .dot{
    width:7px;height:7px;border-radius:50%;
    background:var(--teal);
    box-shadow:0 0 0 0 rgba(47,217,196,.6);
    animation:ping 2.2s ease-out infinite;
  }
  @keyframes ping{
    0%{box-shadow:0 0 0 0 rgba(47,217,196,.55);}
    70%{box-shadow:0 0 0 9px rgba(47,217,196,0);}
    100%{box-shadow:0 0 0 0 rgba(47,217,196,0);}
  }
  h1{
    font-family:'Space Grotesk',sans-serif;
    font-weight:600;
    font-size:34px;
    letter-spacing:-.01em;
    margin:0 0 6px;
  }
  .sub{color:var(--text-dim);font-size:15px;margin:0 0 28px;max-width:520px;line-height:1.5;}

  .pulse-line{width:100%;height:34px;display:block;margin-bottom:36px;}
  .pulse-line path{
    fill:none;stroke:var(--teal);stroke-width:1.6;
    stroke-dasharray:340;stroke-dashoffset:340;
    animation:draw 3.6s ease-in-out infinite;
    opacity:.75;
  }
  @keyframes draw{
    0%{stroke-dashoffset:340;}
    45%{stroke-dashoffset:0;}
    100%{stroke-dashoffset:-340;}
  }

  .section-label{
    font-family:'IBM Plex Mono',monospace;
    font-size:11px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--text-faint);
    margin:0 0 14px;
  }

  .search-wrap{position:relative;margin-bottom:22px;}
  .search-icon{
    position:absolute;left:14px;top:50%;transform:translateY(-50%);
    width:15px;height:15px;color:var(--text-faint);pointer-events:none;
  }
  .search-input{
    width:100%;
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:10px;
    padding:12px 16px 12px 40px;
    color:var(--text);
    font-family:'IBM Plex Mono',monospace;
    font-size:13px;
    outline:none;
    transition:border-color .15s ease, box-shadow .15s ease;
  }
  .search-input::placeholder{color:var(--text-faint);}
  .search-input:focus{
    border-color:var(--teal-dim);
    box-shadow:0 0 0 3px rgba(47,217,196,.12);
  }
  .no-result{
    display:none;
    font-family:'IBM Plex Mono',monospace;
    font-size:12.5px;
    color:var(--text-faint);
    padding:6px 2px 0;
  }

  .grid{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:12px;
    margin-bottom:44px;
  }
  @media(max-width:640px){.grid{grid-template-columns:1fr;}}

  .card{
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:10px;
    padding:18px 20px;
    text-decoration:none;
    color:var(--text);
    display:flex;
    flex-direction:column;
    gap:10px;
    transition:border-color .15s ease, background .15s ease, transform .15s ease;
    position:relative;
  }
  .card:hover{
    background:var(--panel-hover);
    border-color:var(--teal-dim);
    transform:translateY(-1px);
  }
  .card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
  .card-name{
    font-family:'Space Grotesk',sans-serif;
    font-weight:600;
    font-size:16px;
  }
  .card-path{
    font-family:'IBM Plex Mono',monospace;
    font-size:12.5px;
    color:var(--teal);
    word-break:break-all;
  }
  .card-desc{font-size:13px;color:var(--text-dim);line-height:1.5;margin:0;}

  .beat{
    width:8px;height:8px;border-radius:50%;
    background:var(--teal);
    flex-shrink:0;margin-top:4px;
    box-shadow:0 0 0 0 rgba(47,217,196,.5);
    animation:ping 2.4s ease-out infinite;
  }
  .card:nth-child(2) .beat{animation-delay:.3s;}
  .card:nth-child(3) .beat{animation-delay:.6s;}
  .card:nth-child(4) .beat{animation-delay:.9s;}
  .card:nth-child(5) .beat{animation-delay:1.2s;}

  .arrow{color:var(--text-faint);font-size:13px;transition:transform .15s ease, color .15s ease;}
  .card:hover .arrow{transform:translateX(2px);color:var(--teal);}

  table{width:100%;border-collapse:collapse;font-size:13.5px;}
  th{
    text-align:left;padding:9px 12px;
    font-family:'IBM Plex Mono',monospace;
    font-weight:400;font-size:11px;letter-spacing:.06em;text-transform:uppercase;
    color:var(--text-faint);
    border-bottom:1px solid var(--line-strong);
  }
  td{padding:11px 12px;border-bottom:1px solid var(--line);color:var(--text-dim);}
  tr:last-child td{border-bottom:none;}
  tr:hover td{color:var(--text);}
  .table-wrap{
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:10px;
    overflow:hidden;
    margin-bottom:44px;
  }
  .table-wrap .empty,.table-wrap .err{padding:22px;font-size:13.5px;color:var(--text-faint);}
  .table-wrap .err{color:var(--danger);}

  .wake-panel{
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:10px;
    padding:24px 26px;
    display:flex;align-items:center;justify-content:space-between;gap:20px;
    flex-wrap:wrap;
  }
  .wake-copy p{margin:0;}
  .wake-title{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;margin-bottom:4px !important;}
  .wake-desc{font-size:13px;color:var(--text-dim);}

  .wake-btn{
    display:inline-flex;align-items:center;gap:9px;
    background:var(--amber);
    color:#2C1B04;
    border:none;border-radius:8px;
    padding:12px 22px;
    font-family:'Inter',sans-serif;font-weight:600;font-size:14px;
    cursor:pointer;
    transition:background .15s ease, transform .1s ease;
    white-space:nowrap;
  }
  .wake-btn:hover{background:#FFB84F;}
  .wake-btn:active{transform:scale(.97);}
  .wake-btn:disabled{background:var(--amber-dim);color:#D8C4A0;cursor:not-allowed;}
  .wake-btn .zap{width:15px;height:15px;flex-shrink:0;}
  .wake-btn.loading .zap{animation:zap .7s linear infinite;}
  @keyframes zap{0%,100%{opacity:1;}50%{opacity:.25;}}

  #wake-result{margin-top:16px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;display:flex;flex-direction:column;gap:5px;}
  .ok{color:var(--teal);}
  .err{color:var(--danger);}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="eyebrow"><span class="dot"></span>Gateway actif</div>
    <h1>CHU API Gateway</h1>
    <p class="sub">Point d'entrée unique des microservices de la plateforme hospitalière.</p>
  </header>

  <svg class="pulse-line" viewBox="0 0 800 34" preserveAspectRatio="none">
    <path d="M0,17 L260,17 L280,17 L292,3 L306,30 L320,10 L332,17 L800,17"/>
  </svg>

  <div class="search-wrap">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="M21 21l-4.3-4.3"/>
    </svg>
    <input id="service-search" class="search-input" type="text"
      placeholder="Rechercher un service… (nom, chemin, description)"
      autocomplete="off" spellcheck="false">
  </div>

  <p class="section-label" id="services-label">Services · ${serviceCount}</p>
  <div class="grid" id="services-grid">${renderCards()}
  </div>
  <p class="no-result" id="no-result">Aucun service ne correspond à cette recherche.</p>

  <p class="section-label">Établissements CHU</p>
  <!--div class="table-wrap" id="chu-list">
    <div class="empty">Chargement…</div>
  </div-->

  <div class="wake-panel">
    <div class="wake-copy">
      <p class="wake-title">Services en veille ?</p>
      <p class="wake-desc">Réveille tous les microservices avant de les interroger.</p>
      <div id="wake-result"></div>
    </div>
    <button class="wake-btn" id="wake-btn" onclick="wakeUp()" disabled>
      <svg class="zap" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg>
      Réveiller les services
    </button>
  </div>

</div>

<script>
  var TOTAL_SERVICES = ${total};

  function initServiceSearch() {
    var input = document.getElementById('service-search');
    var cards = Array.prototype.slice.call(document.querySelectorAll('#services-grid .card'));
    var label = document.getElementById('services-label');
    var noResult = document.getElementById('no-result');
    if (!input || !label) return;

    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (card) {
        var haystack = card.getAttribute('data-search') || '';
        var match = !q || haystack.indexOf(q) !== -1;
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      label.textContent = q
        ? 'Services · ' + visible + '/' + TOTAL_SERVICES
        : 'Services · ' + TOTAL_SERVICES;
      if (noResult) noResult.style.display = visible === 0 ? 'block' : 'none';
    });
  }

  async function loadChus() {
    const el = document.getElementById('chu-list');
    if (!el) return;
    try {
      const res = await fetch('/chu');
      if (!res.ok) { el.innerHTML = '<div class="err">Erreur ' + res.status + '</div>'; return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) { el.innerHTML = '<div class="empty">Aucun CHU</div>'; return; }
      let table = '<table><thead><tr><th>Nom</th><th>Adresse</th><th>Téléphone</th><th>Email</th><th>Responsable</th></tr></thead><tbody>';
      list.forEach(c => {
        table += '<tr><td>' + c.name + '</td><td>' + (c.address || '') + '</td><td>' + (c.phone || '') + '</td><td>' + (c.email || '') + '</td><td>' + (c.responsable || '') + '</td></tr>';
      });
      table += '</tbody></table>';
      el.innerHTML = table;
    } catch (e) {
      el.innerHTML = '<div class="err">Service CHU indisponible</div>';
    }
  }

  async function wakeUp() {
    const btn = document.getElementById('wake-btn');
    const result = document.getElementById('wake-result');
    btn.disabled = true; btn.classList.add('loading');
    result.innerHTML = '';

    try {
      const res = await fetch('/wake-up');
      const data = await res.json();
      data.results.forEach(r => {
        const cls = r.ok ? 'ok' : 'err';
        const info = r.ok
          ? 'OK' + (r.attempts > 1 ? ' — réveillé (' + r.attempts + ' tentatives)' : '')
          : r.error + ' (' + r.attempts + ' tentatives)';
        result.innerHTML += '<div class="' + cls + '">' + (r.ok ? '●' : '✕') + ' ' + r.name + ' — ' + info + '</div>';
      });
    } catch (err) {
      result.innerHTML = '<div class="err">Erreur de connexion au gateway</div>';
    } finally {
      btn.disabled = false; btn.classList.remove('loading');
    }
  }

  initServiceSearch();
  loadChus();
</script>
</body>
</html>

`;
}