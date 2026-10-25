import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as jwt from 'jsonwebtoken';
import { SERVICES } from './config/services.registry';

export interface KeepAliveTarget {
  name: string;
  url: string;
}

/** Heure courante (0-23) dans le fuseau donné. */
export function hourIn(timeZone: string, now = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now);
  return Number(hour);
}

/** Vrai si `hour` est dans [start, end[ (fenêtre pouvant passer minuit, ex. 22 → 6). */
export function inWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true; // fenêtre vide = toute la journée
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Garde la plateforme éveillée (Render gratuit endort un service après
 * 15 min sans requête ; le réveil prend 30 à 50 s) :
 *  - les backends du registre de la passerelle ;
 *  - les fronts, d'après les adresses du registre des services ;
 *  - la passerelle elle-même, via son adresse publique (RENDER_EXTERNAL_URL,
 *    fournie par Render) : sans ça, elle s'endormait et ce réveil s'arrêtait.
 *
 * Seulement aux heures de travail (KEEP_ALIVE_START_HOUR / KEEP_ALIVE_END_HOUR,
 * fuseau KEEP_ALIVE_TIMEZONE ; 6 h → 20 h à Madagascar par défaut) : 24 h/24,
 * un compte gratuit hébergeant deux services dépasserait ses 750 h mensuelles.
 */
@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly configService: ConfigService) {}

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

  /** Toutes les cibles à réveiller : passerelle, backends, fronts. */
  async targets(): Promise<KeepAliveTarget[]> {
    const self = this.configService.get<string>('RENDER_EXTERNAL_URL');
    return [
      ...(self ? [{ name: 'Passerelle', url: self }] : []),
      ...this.backends(),
      ...(await this.fronts()),
    ];
  }

  isActiveHour(now = new Date()): boolean {
    const timeZone = this.configService.get<string>('KEEP_ALIVE_TIMEZONE') ?? 'Indian/Antananarivo';
    const start = Number(this.configService.get<string>('KEEP_ALIVE_START_HOUR') ?? 6);
    const end = Number(this.configService.get<string>('KEEP_ALIVE_END_HOUR') ?? 20);
    return inWindow(hourIn(timeZone, now), start, end);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async pingServices() {
    if (!this.isActiveHour()) return;
    const targets = await this.targets();
    // En parallèle : une requête suffit à déclencher le réveil côté Render,
    // inutile d'attendre la réponse complète d'un service en train de démarrer.
    const results = await Promise.all(
      targets.map(async ({ name, url }) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          return `${name} ${res.status}`;
        } catch {
          return `${name} réveil en cours`;
        }
      }),
    );
    this.logger.log(`Keep-alive (${targets.length}) : ${results.join(' | ')}`);
  }
}
