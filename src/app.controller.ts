import { Controller, Get } from '@nestjs/common';
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
