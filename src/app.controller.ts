import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
</body>
</html>`;
    return html;
  }
}
