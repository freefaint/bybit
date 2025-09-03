import { Module } from '@nestjs/common';
import { MarketsModule } from './markets/markets.module';

@Module({ imports: [MarketsModule] })
export class AppModule {}
