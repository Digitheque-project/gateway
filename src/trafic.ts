import type { NextFunction, Request, Response } from 'express';

// Compteur de trafic de la passerelle (GET /stats/trafic). Le pare-feu de
// l'hébergeur (Cloudflare) bloque la passerelle au-delà d'un certain débit :
// ces totaux montrent QUI l'interroge autant (service appelé, navigateur ou
// serveur, front d'origine), pour réduire la bonne source. Aucun jeton ni
// adresse IP n'est gardé : seulement des totaux par minute, 30 minutes au plus.

const DUREE_MINUTES = 30;

interface Minute {
  debut: number;
  total: number;
  parCle: Map<string, number>;
}

const minutes: Minute[] = [];

function minuteCourante(): Minute {
  const debut = Math.floor(Date.now() / 60_000) * 60_000;
  const derniere = minutes[minutes.length - 1];
  if (derniere?.debut === debut) return derniere;
  const m: Minute = { debut, total: 0, parCle: new Map() };
  minutes.push(m);
  while (minutes.length > DUREE_MINUTES) minutes.shift();
  return m;
}

function provenance(req: Request): string {
  const origine = req.headers.origin || req.headers.referer;
  if (origine) {
    try {
      return `navigateur ${new URL(String(origine)).host}`;
    } catch {
      return 'navigateur';
    }
  }
  const ua = String(req.headers['user-agent'] ?? '');
  if (/mozilla/i.test(ua)) return 'navigateur (sans origine)';
  // Appel d'un service : le nom du client HTTP suffit à le distinguer d'un navigateur.
  return `serveur ${ua.split(/[\s/]/)[0] || 'inconnu'}`;
}

export function compterTrafic(req: Request, _res: Response, next: NextFunction) {
  const segment = req.path.split('/').filter(Boolean)[0] ?? '(racine)';
  const m = minuteCourante();
  m.total += 1;
  const cle = `${req.method} /${segment} — ${provenance(req)}`;
  m.parCle.set(cle, (m.parCle.get(cle) ?? 0) + 1);
  next();
}

export function rapportTrafic(_req: Request, res: Response) {
  const maintenant = Date.now();
  const recentes = minutes.filter((m) => maintenant - m.debut < 5 * 60_000);
  const cumul = new Map<string, number>();
  for (const m of recentes) for (const [cle, n] of m.parCle) cumul.set(cle, (cumul.get(cle) ?? 0) + n);
  res.json({
    note: 'Requêtes reçues par la passerelle (celles bloquées par le pare-feu ne sont pas comptées).',
    parMinute: minutes.map((m) => ({ minute: new Date(m.debut).toISOString().slice(11, 16), total: m.total })),
    cinqDernieresMinutes: [...cumul]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([source, requetes]) => ({ source, requetes })),
  });
}
