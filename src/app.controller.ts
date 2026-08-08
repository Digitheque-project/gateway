import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SERVICES } from './config/services.registry';
import { renderHomePage } from './page/html';

interface WakeUpResult {
  name: string;
  ok: boolean;
  attempts: number;
  error: string | null;
}

@Controller()
export class AppController {
  constructor(private configService: ConfigService) {}

  @Get()
  getHome() {
    // Page d'accueil générée dynamiquement depuis le registre des services.
    return renderHomePage();
  }

  @Get('wake-up')
  async wakeUp() {
    // La liste des services à réveiller est dérivée du registre :
    // une nouvelle entrée dans services.registry.ts est prise en compte
    // automatiquement (il suffit que sa variable d'URL soit définie).
    const services = SERVICES.map((service) => ({
      name: `${service.name} Service`,
      url: this.configService.get<string>(service.urlEnv),
    })).filter((entry): entry is { name: string; url: string } => !!entry.url);

    const results = await Promise.all(
      services.map((entry) => this.wakeService(entry.name, entry.url)),
    );

    return { results };
  }

  private async wakeService(
    name: string,
    url: string,
    retries = 3,
  ): Promise<WakeUpResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (resp.status === 502 && attempt < retries) {
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
