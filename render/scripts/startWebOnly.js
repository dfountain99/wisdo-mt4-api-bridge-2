import 'dotenv/config';

import { config } from '../config.js';
import { logger } from '../logger.js';
import { startApiServer } from '../server/apiServer.js';
import { OperatorDeskService } from '../services/operatorDeskService.js';
import { Mt4SyncService } from '../services/mt4SyncService.js';
import { Mt4CommandService } from '../services/mt4CommandService.js';
import { CopyTradingService } from '../services/copyTradingService.js';

// Web-only mode uses the same repositories and relay queues as the Discord bot,
// but does not create or log in a Discord client. It is suitable for local
// testing, Render recovery, and deployments that split the web and bot workers.
const operatorDeskService = new OperatorDeskService(config);
await operatorDeskService.initialize();

const mt4CommandService = new Mt4CommandService(config);
const copyTradingService = new CopyTradingService(config);
const mt4SyncService = new Mt4SyncService(config, operatorDeskService.repository, copyTradingService);
operatorDeskService.attachMt4SyncService?.(mt4SyncService);

const noop = {};
const paymentService = {
  isConfigured() {
    return Boolean(config.store.squareAccessToken && config.store.squareLocationId && config.api.publicBaseUrl);
  },
};

await startApiServer({
  config,
  mt4SyncService,
  mt4CommandService,
  copyTradingService,
  tradeSignalService: noop,
  deskDashboardService: noop,
  rankService: noop,
  announcementService: noop,
  paymentService,
  botRegistryService: noop,
  logger,
  client: null,
});
