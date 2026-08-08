import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SERVICES } from './config/services.registry';

interface KeepAliveTarget {
  name: string;
  url: string;
}

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private readonly targets: KeepAliveTarget[];

  constructor(private configService: ConfigService) {
    // Les services à pinger sont dérivés du registre : une nouvelle entrée
    // dans services.registry.ts est automatiquement prise en compte.
    this.targets = SERVICES.map((service) => ({
      name: service.name,
      url: this.configService.get<string>(service.urlEnv),
    })).filter((target): target is KeepAliveTarget => !!target.url);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pingServices() {
    for (const { name, url } of this.targets) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        this.logger.log(`Keep-alive: ${name} (${url}) → ${res.status}`);
      } catch (err) {
        this.logger.warn(
          `Keep-alive: ${name} (${url}) → ${(err as Error).message}`,
        );
      }
    }
  }
}
