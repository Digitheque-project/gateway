import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { SERVICES } from './config/services.registry';

export interface KeepAliveTarget {
  name: string;
  url: string;
}

/**
 * Services à réveiller quand quelqu'un va réellement s'en servir :
 *  - à chaque tentative de connexion (POST /auth/login, voir main.ts) ;
 *  - à la demande (bouton « Réveiller tous les services » de la page
 *    d'accueil de la passerelle → GET /wake-up).
 * Cibles : les backends du registre de la passerelle et les fronts du
 * registre des services. Le réveil périodique n'existe que pendant une séance de
 * test, lancé et arrêté depuis la page d'accueil : sinon les heures gratuites des
 * comptes Render s'épuisent.
 */
@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  /** Délai minimal entre deux réveils déclenchés par des connexions. */
  private static readonly LOGIN_WAKE_COOLDOWN_MS = 10 * 60 * 1000;
  private lastLoginWake = 0;

  /** Réveil de tous les services chaque minute, tant qu'on ne l'arrête pas. */
  private static readonly REVEIL_CONTINU_MS = 60 * 1000;
  private minuterie: NodeJS.Timeout | null = null;
  private passageEnCours = false;
  private depuis: string | null = null;
  private dernierPassage: string | null = null;
  private resultats: { name: string; ok: boolean }[] = [];

  constructor(private readonly configService: ConfigService) {}

  demarrerReveilContinu() {
    if (!this.minuterie) {
      this.depuis = new Date().toISOString();
      this.minuterie = setInterval(() => void this.passage(), KeepAliveService.REVEIL_CONTINU_MS);
      this.logger.log('Réveil continu démarré');
      void this.passage();
    }
    return this.etatReveilContinu();
  }

  arreterReveilContinu() {
    if (this.minuterie) {
      clearInterval(this.minuterie);
      this.minuterie = null;
      this.depuis = null;
      this.logger.log('Réveil continu arrêté');
    }
    return this.etatReveilContinu();
  }

  etatReveilContinu() {
    return {
      actif: !!this.minuterie,
      depuis: this.depuis,
      dernierPassage: this.dernierPassage,
      resultats: this.resultats,
    };
  }

  private async passage(): Promise<void> {
    // Un service lent ne doit pas faire chevaucher deux passages.
    if (this.passageEnCours) return;
    this.passageEnCours = true;
    try {
      const cibles = await this.targets();
      const moiMeme = process.env.RENDER_EXTERNAL_URL;
      if (moiMeme) cibles.push({ name: 'Passerelle', url: moiMeme });
      const resultats = await Promise.all(
        cibles.map(async ({ name, url }) => {
          try {
            // Toute réponse sous 500 (404, 401…) prouve que le service est réveillé.
            const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(55000) });
            await r.arrayBuffer().catch(() => undefined);
            return { name, ok: r.status < 500 };
          } catch {
            return { name, ok: false };
          }
        }),
      );
      // Arrêté pendant le passage : ne pas réafficher un état périmé.
      if (this.minuterie) {
        this.resultats = resultats;
        this.dernierPassage = new Date().toISOString();
      }
    } catch (err) {
      this.logger.warn(`Réveil continu : ${(err as Error).message}`);
    } finally {
      this.passageEnCours = false;
    }
  }

  /**
   * Réveil en arrière-plan, sans faire attendre la connexion. Une connexion
   * suffit à réveiller toute la plateforme pour la séance : les suivantes, dans
   * les 10 minutes, ne relancent rien.
   */
  wakeAllInBackground(): void {
    const now = Date.now();
    if (now - this.lastLoginWake < KeepAliveService.LOGIN_WAKE_COOLDOWN_MS) return;
    this.lastLoginWake = now;
    void this.targets()
      .then((targets) =>
        Promise.all(
          targets.map(({ url }) => fetch(url, { signal: AbortSignal.timeout(60000) }).catch(() => undefined)),
        ).then(() => this.logger.log(`Réveil à la connexion : ${targets.length} services sollicités`)),
      )
      .catch((err) => this.logger.warn(`Réveil à la connexion échoué : ${(err as Error).message}`));
  }

  private backends(): KeepAliveTarget[] {
    return SERVICES.map((service) => ({
      name: `${service.name} (API)`,
      url: this.configService.get<string>(service.urlEnv) ?? '',
    })).filter((target) => !!target.url);
  }

  /** Fronts déclarés dans le registre des services (champ baseUrl, https seulement : pas de localhost). */
  private async fronts(): Promise<KeepAliveTarget[]> {
    const registry = this.configService.get<string>('SERVICE_SERVICE_URL');
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!registry || !secret) return [];
    try {
      const token = jwt.sign({ userId: 'service-gateway', role: 'SERVICE' }, secret, { expiresIn: '5m' });
      const res = await fetch(`${registry.replace(/\/$/, '')}/services`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) return [];
      const list = (await res.json()) as Array<{ name?: string; baseUrl?: string; isActive?: boolean }>;
      const seen = new Set<string>();
      return (Array.isArray(list) ? list : [])
        .filter((s) => s.isActive !== false && /^https:\/\//.test(s.baseUrl ?? ''))
        .filter((s) => !seen.has(s.baseUrl!) && !!seen.add(s.baseUrl!))
        .map((s) => ({ name: `${s.name ?? 'Service'} (front)`, url: s.baseUrl! }));
    } catch (err) {
      this.logger.warn(`Registre des services injoignable : ${(err as Error).message}`);
      return [];
    }
  }

  /** Toutes les cibles à réveiller : backends puis fronts. */
  async targets(): Promise<KeepAliveTarget[]> {
    return [...this.backends(), ...(await this.fronts())];
  }
}
