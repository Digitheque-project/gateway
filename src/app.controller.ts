import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { html } from './page/html';

@Controller()
export class AppController {
  constructor(private configService: ConfigService) {}

  @Get()
  getHome() {
    return html;
  }

  @Get('wake-up')
  async wakeUp() {
    const services = [
      { name: 'Auth Service', url: this.configService.get<string>('AUTH_SERVICE_URL') },
      { name: 'User Service', url: this.configService.get<string>('USER_SERVICE_URL') },
      { name: 'Service Service', url: this.configService.get<string>('SERVICE_SERVICE_URL') },
      { name: 'CHU Service', url: this.configService.get<string>('CHU_SERVICE_URL') },
      { name: 'Clinique Service', url: this.configService.get<string>('CLINIQUE_SERVICE_URL') },
      { name: 'Endoscopie Service', url: this.configService.get<string>('ENDOSCOPIE_SERVICE_URL') },  
      { name: 'Prescription Service', url: this.configService.get<string>('PRESCRIPTION_SERVICE_URL') },
      { name: 'EEG Service', url: this.configService.get<string>('EEG_SERVICE_URL') },
      { name: 'Anapath Service', url: this.configService.get<string>('ANAPATH_SERVICE_URL') },
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
        } catch (e: AppController | any) {
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
