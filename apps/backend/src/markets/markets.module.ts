import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsGateway } from './markets.gateway';
import { BybitService } from './bybit.service';
import { WalletGateway } from './wallet.gateway';

@Module({
  controllers: [MarketsController],
  providers: [BybitService, MarketsGateway, WalletGateway],
  exports: [BybitService]
})
export class MarketsModule {}
