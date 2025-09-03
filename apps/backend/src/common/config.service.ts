import * as dotenv from 'dotenv';

dotenv.config({ path: process.env.CONFIG_PATH || undefined });

export class ConfigService {
  readonly port = Number(process.env.PORT || 3000);
  readonly corsOrigin = process.env.CORS_ORIGIN || 'https://freefaint.ru';

  readonly bybitApiKey = process.env.BYBIT_API_KEY || '';
  readonly bybitApiSecret = process.env.BYBIT_API_SECRET || '';
  readonly bybitUseTestnet = (process.env.BYBIT_USE_TESTNET || 'true') === 'true';
  readonly bybitCategory = (process.env.BYBIT_CATEGORY || 'spot') as
    | 'spot'
    | 'linear'
    | 'inverse'
    | 'option';

  get httpBase() {
    return this.bybitUseTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  }
  get wsPublicBase() {
    // v5 public WS
    return this.bybitUseTestnet
      ? 'wss://stream-testnet.bybit.com/v5/public'
      : 'wss://stream.bybit.com/v5/public';
  }
  get wsPrivateBase() {
    return this.bybitUseTestnet
      ? 'wss://stream-testnet.bybit.com/v5/private'
      : 'wss://stream.bybit.com/v5/private';
  }
}

export const config = new ConfigService();
