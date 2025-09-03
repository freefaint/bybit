import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './common/config.service';
import { Logger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: config.corsOrigin } });
  await app.listen(config.port);
  Logger.log(`HTTP on http://localhost:${config.port}`);
}
bootstrap();
