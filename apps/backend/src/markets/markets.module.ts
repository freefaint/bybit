import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { BybitService } from './bybit.service';

@Module({
  controllers: [MarketsController],
  providers: [BybitService, MarketsGateway],
  exports: [BybitService]
})
export class MarketsModule {}
