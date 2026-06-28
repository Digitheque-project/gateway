import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private configService: ConfigService) {}

  @Get()
  getHome() {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>CHU API Gateway</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #2563eb; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; }
    .card h2 { margin: 0 0 8px; }
    .card a { color: #2563eb; text-decoration: none; font-size: 18px; }
    .card a:hover { text-decoration: underline; }
    .card p { color: #6b7280; margin: 4px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    td { color: #4b5563; }
    .wake-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: #059669; color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 16px; cursor: pointer;
      transition: background .2s; margin-top: 24px;
    }
    .wake-btn:hover { background: #047857; }
    .wake-btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .wake-btn.loading::after {
      content: ''; width: 16px; height: 16px;
      border: 2px solid white; border-top-color: transparent;
      border-radius: 50%; animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #wake-result { margin-top: 12px; font-size: 14px; }
    .ok { color: #059669; }
    .err { color: #dc2626; }
  </style>
</head>
<body>
  <h1>CHU API Gateway</h1>
  <p>Point d'entrée unique des microservices</p>

  <div class="card">
    <h2>🔐 Auth</h2>
    <a href="/auth-docs">/auth-docs</a>
    <p>Authentification, rôles, permissions</p>
  </div>

  <div class="card">
    <h2>👤 Users</h2>
    <a href="/users-docs">/users-docs</a>
    <p>Gestion des utilisateurs</p>
  </div>

  <div class="card">
    <h2>🏥 Services</h2>
    <a href="/services-docs">/services-docs</a>
    <p>Gestion des services hospitaliers</p>
  </div>

  <div class="card">
    <h2>🏛️ CHU</h2>
    <a href="/chu-docs">/chu-docs</a>
    <p>Gestion des établissements CHU</p>
  </div>

  <button class="wake-btn" onclick="wakeUp()" id="wake-btn">🔌 Réveiller les services</button>
  <div id="wake-result"></div>

  <script>
    async function loadChus() {
      const el = document.getElementById('chu-list');
      try {
        const res = await fetch('/chu');
        if (!res.ok) { el.innerHTML = '<p class="err">Erreur ' + res.status + '</p>'; return; }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) { el.innerHTML = '<p style="color:#94a3b8">Aucun CHU</p>'; return; }
        let table = '<table><thead><tr><th>Nom</th><th>Adresse</th><th>Téléphone</th><th>Email</th><th>Responsable</th></tr></thead><tbody>';
        list.forEach(c => {
          table += '<tr><td>' + c.name + '</td><td>' + (c.address || '') + '</td><td>' + (c.phone || '') + '</td><td>' + (c.email || '') + '</td><td>' + (c.responsable || '') + '</td></tr>';
        });
        table += '</tbody></table>';
        el.innerHTML = table;
      } catch (e) {
        el.innerHTML = '<p class="err">Service CHU indisponible</p>';
      }
    }

    async function wakeUp() {
      const btn = document.getElementById('wake-btn');
      const result = document.getElementById('wake-result');
      btn.disabled = true; btn.classList.add('loading');
      btn.textContent = 'Réveil en cours…';
      result.innerHTML = '';

      try {
        const res = await fetch('/wake-up');
        const data = await res.json();
        result.innerHTML = '<h3 style="margin: 12px 0 8px">Résultat :</h3>';
        data.results.forEach(r => {
          const cls = r.ok ? 'ok' : 'err';
          const info = r.ok
            ? '✅ OK' + (r.attempts > 1 ? ' (réveillé, ' + r.attempts + ' tentative' + (r.attempts > 1 ? 's)' : ')') : '')
            : '❌ ' + r.error + ' (' + r.attempts + ' tentative' + (r.attempts > 1 ? 's)' : ')');
          result.innerHTML += '<div class="' + cls + '">' + r.name + ' — ' + info + '</div>';
        });
      } catch (err) {
        result.innerHTML = '<div class="err">Erreur de connexion au gateway</div>';
      } finally {
        btn.disabled = false; btn.classList.remove('loading');
        btn.textContent = '🔌 Réveiller les services';
      }
    }

    loadChus();
  </script>
</body>
</html>`;
    return html;
  }

  @Get('wake-up')
  async wakeUp() {
    const services = [
      { name: 'Auth Service', url: this.configService.get<string>('AUTH_SERVICE_URL') },
      { name: 'User Service', url: this.configService.get<string>('USER_SERVICE_URL') },
      { name: 'Service Service', url: this.configService.get<string>('SERVICE_SERVICE_URL') },
    ];

    async function wakeService(name: string, url: string, retries = 3): Promise<{ name: string; ok: boolean; attempts: number; error: string | null }> {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (resp.status === 502 && attempt < retries) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          return { name, ok: true, attempts: attempt, error: null };
        } catch (e) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          return { name, ok: false, attempts: attempt, error: e?.message || String(e) || 'Unreachable' };
        }
      }
      return { name, ok: false, attempts: retries, error: 'Max retries' };
    }

    const results = await Promise.all(services.map(s => wakeService(s.name, s.url!)));

    return { results };
  }
}
