import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);
  private readonly services: string[];

  constructor(private configService: ConfigService) {
    this.services = [
      this.configService.get<string>('AUTH_SERVICE_URL'),
      this.configService.get<string>('USER_SERVICE_URL'),
      this.configService.get<string>('SERVICE_SERVICE_URL'),
      this.configService.get<string>('CHU_SERVICE_URL'),
    ].filter((url): url is string => !!url);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pingServices() {
    for (const url of this.services) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        this.logger.log(`Keep-alive: ${url} → ${res.status}`);
      } catch (err) {
        this.logger.warn(`Keep-alive: ${url} → ${(err as Error).message}`);
      }
    }
  }
}
