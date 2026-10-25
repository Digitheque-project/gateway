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
 * registre des services. Aucun réveil périodique : un service ne doit tourner
 * que quand on l'utilise, sinon les heures gratuites des comptes Render s'épuisent.
 */
@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  /** Délai minimal entre deux réveils déclenchés par des connexions. */
  private static readonly LOGIN_WAKE_COOLDOWN_MS = 10 * 60 * 1000;
  private lastLoginWake = 0;

  constructor(private readonly configService: ConfigService) {}

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
