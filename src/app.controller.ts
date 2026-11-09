import { Controller, Get, Post, Redirect } from '@nestjs/common';
import { KeepAliveService } from './keep-alive.service';
import { renderHomePage } from './page/html';

interface WakeUpResult {
  name: string;
  ok: boolean;
  attempts: number;
  error: string | null;
}

@Controller()
export class AppController {
  constructor(private keepAlive: KeepAliveService) {}

  @Get()
  getHome() {
    // Page d'accueil générée dynamiquement depuis le registre des services.
    return renderHomePage();
  }

  // Après le test « Just a moment… » du pare-feu de l'hébergeur (Cloudflare),
  // le navigateur renvoie le formulaire du test en POST sur l'adresse ouverte :
  // la passerelle répondait « Cannot POST / » au lieu de sa page d'accueil.
  @Post()
  @Redirect('/', 303)
  apresTestPareFeu() {}

  // Séance de test : réveil de tous les fronts et backs chaque minute, jusqu'à l'arrêt.
  @Get('wake-up/etat')
  etatReveil() {
    return this.keepAlive.etatReveilContinu();
  }

  @Post('wake-up/demarrer')
  demarrerReveil() {
    return this.keepAlive.demarrerReveilContinu();
  }

  @Post('wake-up/arreter')
  arreterReveil() {
    return this.keepAlive.arreterReveilContinu();
  }

  @Get('wake-up')
  async wakeUp() {
    // Réveil manuel (bouton de la page d'accueil) : backends du registre de la
    // passerelle et fronts du registre des services.
    const services = await this.keepAlive.targets();

    const results = await Promise.all(
      services.map((entry) => this.wakeService(entry.name, entry.url)),
    );

    return { results };
  }

  private async wakeService(
    name: string,
    url: string,
    retries = 2,
  ): Promise<WakeUpResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Un service endormi met 30 à 50 s à démarrer, Render garde la requête pendant
        // ce temps : abandonner au bout de 10 s affichait « Injoignable » pour un
        // service justement en train de se réveiller. 45 s × 2 essais reste sous la
        // limite de ~100 s d'une requête Render vers la passerelle elle-même.
        const resp = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if ((resp.status === 502 || resp.status === 503) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return { name, ok: true, attempts: attempt, error: null };
      } catch (e) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const error =
          e instanceof Error ? e.message : String(e) || 'Unreachable';
        return { name, ok: false, attempts: attempt, error };
      }
    }
    return { name, ok: false, attempts: retries, error: 'Max retries' };
  }
}
