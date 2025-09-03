import { Controller, Get, Query } from '@nestjs/common';
import { BybitService } from './bybit.service';

@Controller('api')
export class MarketsController {
  constructor(private readonly bybit: BybitService) {}

  // REST: исторические свечи
  @Get('klines')
  async klines(
    @Query('symbol') symbol: string,
    @Query('interval') interval: '1'|'3'|'5'|'15'|'30'|'60'|'240'|'D' = '1',
    @Query('limit') limit = '500'
  ) {
    const data = await this.bybit.fetchKlines({ symbol, interval, limit: Number(limit) });
    return { symbol, interval, list: data };
  }

  @Get('symbols')
  async symbols() {
    const symbols = await this.bybit.fetchSymbols();
    return { symbols };
  }

  // Простой REST: стакан по символу
  @Get('orderbook')
  async orderbook(@Query('symbol') symbol: string, @Query('depth') depth = '50') {
    const d = Number(depth) as 50 | 200;
    return this.bybit.fetchOrderBook(symbol, d);
  }

  // Пинг (жив ли бэк)
  @Get('ping')
  ping() {
    return { ok: true, ts: Date.now() };
  }
}
