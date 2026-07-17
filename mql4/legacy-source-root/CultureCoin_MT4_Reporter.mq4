#property strict
#property version   "1.58"
#property description "Culture Coin MT4 Reporter - WISDO sync-account + close-authority copy/manual/profit dashboard"

input string PairingCode = "";
input string SyncUrl = "";
input int ExportEverySeconds = 10;
input int CommandPollEverySeconds = 1;
input int CommandsPerPollTick = 3;
input bool PollCommandsBeforeSnapshot = true;
// Resilient connection health. One transient Render/ISP failure no longer flips a healthy Reporter to Error.
input int NetworkFailureGraceCount = 3;
input int NetworkBackoffBaseSeconds = 2;
input int NetworkBackoffMaxSeconds = 60;
input int NetworkOfflineAfterSeconds = 120;
input int MagicNumberFilter = 0;
input string SymbolFilter = "";
input bool IncludeAllTrades = true;
input bool IncludeOpenTrades = true;
input bool IncludeClosedTradesToday = true;
input string EAName = "";
input string EAVersion = "";
input string ApiKey = "";

// CEM adaptive bot registry. Leave blank to auto-use EAName/current chart when possible.
input string CemBotKey = "";
input string CemBotNickname = "";
input int CemLaneMagicNumber = 0;
input bool SendCemAdaptiveRegistry = true;

// WISDO copy-trading execution. Keep disabled unless this terminal is approved as a follower account.
input bool EnableCopyTrading = false;
input double CopyFixedLotFallback = 0.01;
input double CopyMaxLot = 1.00;
input int CopySlippage = 30;
input int CopyMagicNumber = 880088;
input bool CopyAllowBuy = true;
input bool CopyAllowSell = true;
input bool CopyUseSLTP = true;
input double CopyMaxSpreadPoints = 250.0;
input bool CopyRequireAutoTrading = true;
input string CommandPollUrl = "";
input string CommandCompleteUrl = "";

// WISDO manual trade execution. This lets approved Discord/website commands place direct trades.
input bool EnableManualTradeExecution = true;
input double ManualFixedLotFallback = 0.01;
input double ManualMaxLot = 1.00;
input int ManualSlippage = 30;
input int ManualMagicNumber = 880099;
input bool ManualAllowBuy = true;
input bool ManualAllowSell = true;
input bool ManualUseSLTP = true;
input double ManualMaxSpreadPoints = 250.0;
input bool ManualRequireAutoTrading = true;
// Optional broker symbol fixes. Example: NASUSD=NAS100;US30=US30.cash;XAUUSD=XAUUSDm
input string SymbolAliasMap = "";
input string SymbolSuffix = "";
input bool EnableSymbolAutoSearch = true;

// WISDO profit manager execution. Allows WISDO to close/trim/lock profits by account, symbol, magic, or basket.
input bool EnableProfitManagerExecution = true;
input int ProfitSlippage = 30;
input int ProfitMagicNumberFilter = 0;
input string ProfitSymbolFilter = "";
input double ProfitDefaultPartialClosePercent = 50.0;
input bool ProfitOnlyManageWisdoTrades = false;
input bool ProfitAllowCloseLosses = true;
input bool ProfitRequireAutoTrading = true;
input string ProfitEquityFloorGV = "WISDO_EQUITY_FLOOR";
input string ProfitWalkAwayGV = "WISDO_WALK_AWAY_MODE";
input string ProfitLockModeGV = "WISDO_PROFIT_LOCK_MODE";

// WISDO live dashboard settings
input bool ShowWisdoDashboard = true;
input int DashboardCorner = 0;
input int DashboardX = 10;
input int DashboardY = 18;
input int DashboardLineHeight = 16;
input int DashboardFontSize = 9;
input color DashboardTitleColor = clrGold;
input color DashboardGoodColor = clrLimeGreen;
input color DashboardWarnColor = clrOrange;
input color DashboardBadColor = clrTomato;
input color DashboardTextColor = clrSilver;

string REPORTER_VERSION = "1.58";
string STATUS_LABEL = "CultureCoinReporterStatus";
string DASH_PREFIX = "CEM_WISDO_DASH_";
string g_lastStatus = "Waiting";
string g_lastError = "";
string g_lastCommand = "";
string g_lastCommandId = "";
string g_lastCopyMessage = "";
int g_lastCopyTicket = -1;
datetime g_lastSendAt = 0;
datetime g_lastCommandPollAt = 0;
datetime g_lastSnapshotAt = 0;
datetime g_lastFastPollAt = 0;
int g_consecutiveNetworkFailures = 0;
int g_lastNetworkErrorCode = 0;
datetime g_lastNetworkSuccessAt = 0;
datetime g_nextNetworkAttemptAt = 0;
string g_lastNetworkSource = "";


int SafeNetworkBackoffSeconds()
{
   int baseSeconds = NetworkBackoffBaseSeconds;
   if(baseSeconds < 1) baseSeconds = 1;
   int maxSeconds = NetworkBackoffMaxSeconds;
   if(maxSeconds < baseSeconds) maxSeconds = baseSeconds;
   int exponent = g_consecutiveNetworkFailures - 1;
   if(exponent < 0) exponent = 0;
   if(exponent > 10) exponent = 10;
   double delay = baseSeconds * MathPow(2.0, exponent);
   if(delay > maxSeconds) delay = maxSeconds;
   return (int)delay;
}

bool NetworkAttemptAllowed()
{
   return g_nextNetworkAttemptAt == 0 || TimeCurrent() >= g_nextNetworkAttemptAt;
}

void MarkNetworkSuccess(string source)
{
   g_consecutiveNetworkFailures = 0;
   g_lastNetworkErrorCode = 0;
   g_lastNetworkSuccessAt = TimeCurrent();
   g_nextNetworkAttemptAt = 0;
   g_lastNetworkSource = source;
   g_lastStatus = "Connected";
   g_lastError = "";
}

void MarkNetworkFailure(string source, string detail, int errorCode)
{
   g_consecutiveNetworkFailures++;
   g_lastNetworkErrorCode = errorCode;
   g_lastNetworkSource = source;
   int delaySeconds = SafeNetworkBackoffSeconds();
   g_nextNetworkAttemptAt = TimeCurrent() + delaySeconds;
   g_lastError = source + ": " + detail;

   int grace = NetworkFailureGraceCount;
   if(grace < 1) grace = 1;
   bool recentlyHealthy = g_lastNetworkSuccessAt > 0 && (TimeCurrent() - g_lastNetworkSuccessAt) < NetworkOfflineAfterSeconds;
   if(recentlyHealthy && g_consecutiveNetworkFailures <= grace)
      g_lastStatus = "Degraded";
   else if(g_consecutiveNetworkFailures <= grace)
      g_lastStatus = "Retrying";
   else
      g_lastStatus = "Offline";

   Print("CultureCoin Reporter network ", g_lastStatus, " [", source, "] ", detail,
         ". Failure ", g_consecutiveNetworkFailures, ", retry in ", delaySeconds, "s.");
}

string EscapeJson(string value)
{
   string escaped = value;
   StringReplace(escaped, "\\", "\\\\");
   StringReplace(escaped, "\"", "\\\"");
   StringReplace(escaped, "\r", "");
   StringReplace(escaped, "\n", "\\n");
   return escaped;
}

string BoolToJson(bool value)
{
   return value ? "true" : "false";
}

string ToIsoString(datetime value)
{
   string formatted = TimeToString(value, TIME_DATE | TIME_SECONDS);
   StringReplace(formatted, ".", "-");
   StringReplace(formatted, " ", "T");
   return formatted + "Z";
}

string OrderTypeToText(int orderType)
{
   if(orderType == OP_BUY)
      return "buy";
   if(orderType == OP_SELL)
      return "sell";
   return "other";
}

bool PassTradeFilters(string symbol, int magicNumber)
{
   if(StringLen(SymbolFilter) > 0 && symbol != SymbolFilter)
      return false;

   if(MagicNumberFilter != 0 && magicNumber != MagicNumberFilter)
      return false;

   return true;
}

int GetPriceDigits(string symbol)
{
   int symbolDigits = (int)MarketInfo(symbol, MODE_DIGITS);
   if(symbolDigits < 0)
      return Digits;

   return symbolDigits;
}

string TruncateText(string value, int maxLength)
{
   if(StringLen(value) <= maxLength)
      return value;

   return StringSubstr(value, 0, maxLength - 3) + "...";
}


string NormalizeCemToken(string value)
{
   string out = value;
   StringTrimLeft(out);
   StringTrimRight(out);
   StringToUpper(out);
   for(int i = 0; i < StringLen(out); i++)
   {
      ushort ch = StringGetCharacter(out, i);
      bool ok = (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_';
      if(!ok) StringSetCharacter(out, i, '_');
   }
   while(StringFind(out, "__") >= 0) StringReplace(out, "__", "_");
   return out;
}

string GetCemBotKey()
{
   if(StringLen(CemBotKey) > 0) return NormalizeCemToken(CemBotKey);
   if(StringLen(EAName) > 0) return NormalizeCemToken(EAName);
   return NormalizeCemToken(WindowExpertName());
}

int GetCemLaneMagic()
{
   if(CemLaneMagicNumber > 0) return CemLaneMagicNumber;
   if(MagicNumberFilter > 0) return MagicNumberFilter;
   return 0;
}

string BuildCemLaneJson(string botKey, string symbol, int magicNumber, int openTrades, int buyTrades, int sellTrades, double lots, double floating)
{
   string lanePrefix = "CEM." + botKey + "." + IntegerToString(AccountNumber()) + "." + NormalizeCemToken(symbol) + "." + IntegerToString(magicNumber);
   string item = "{";
   item += "\"botKey\":\"" + EscapeJson(botKey) + "\",";
   item += "\"botLabel\":\"" + EscapeJson(StringLen(EAName) > 0 ? EAName : botKey) + "\",";
   item += "\"botNickname\":\"" + EscapeJson(CemBotNickname) + "\",";
   item += "\"accountNumber\":" + IntegerToString(AccountNumber()) + ",";
   item += "\"brokerServer\":\"" + EscapeJson(AccountServer()) + "\",";
   item += "\"symbol\":\"" + EscapeJson(NormalizeCemToken(symbol)) + "\",";
   item += "\"magicNumber\":" + IntegerToString(magicNumber) + ",";
   item += "\"lanePrefix\":\"" + EscapeJson(lanePrefix) + "\",";
   item += "\"openTrades\":" + IntegerToString(openTrades) + ",";
   item += "\"buyTrades\":" + IntegerToString(buyTrades) + ",";
   item += "\"sellTrades\":" + IntegerToString(sellTrades) + ",";
   item += "\"totalLots\":" + DoubleToString(lots, 2) + ",";
   item += "\"floatingPL\":" + DoubleToString(floating, 2);
   item += "}";
   return item;
}


void GetCemLaneStats(string symbol, int magic, int &openTrades, int &buyTrades, int &sellTrades, double &lots, double &floating)
{
   openTrades = 0;
   buyTrades = 0;
   sellTrades = 0;
   lots = 0.0;
   floating = 0.0;
   for(int j = OrdersTotal() - 1; j >= 0; j--)
   {
      if(!OrderSelect(j, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderSymbol() != symbol || OrderMagicNumber() != magic) continue;
      int t = OrderType();
      if(t != OP_BUY && t != OP_SELL) continue;
      openTrades++;
      if(t == OP_BUY) buyTrades++;
      if(t == OP_SELL) sellTrades++;
      lots += OrderLots();
      floating += OrderProfit() + OrderSwap() + OrderCommission();
   }
}

string AppendCemLaneJson(string output, string &seen, string botKey, string symbol, int magic)
{
   if(StringLen(symbol) == 0) return output;
   string cleanSymbol = NormalizeCemToken(symbol);
   string key = botKey + "|" + cleanSymbol + "|" + IntegerToString(magic);
   if(StringFind("|" + seen + "|", "|" + key + "|") >= 0) return output;
   if(StringLen(seen) > 0) seen += "|";
   seen += key;

   int openTrades = 0, buyTrades = 0, sellTrades = 0;
   double lots = 0.0, floating = 0.0;
   GetCemLaneStats(cleanSymbol, magic, openTrades, buyTrades, sellTrades, lots, floating);
   if(output != "[") output += ",";
   output += BuildCemLaneJson(botKey, cleanSymbol, magic, openTrades, buyTrades, sellTrades, lots, floating);
   return output;
}

string BuildCemAdaptiveRegistryJson()
{
   if(!SendCemAdaptiveRegistry) return "[]";
   string botKey = GetCemBotKey();
   string output = "[";
   string seen = "";

   // 1) Discover active lanes from open trades.
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      int type = OrderType();
      if(type != OP_BUY && type != OP_SELL) continue;
      if(!PassTradeFilters(OrderSymbol(), OrderMagicNumber())) continue;
      output = AppendCemLaneJson(output, seen, botKey, OrderSymbol(), OrderMagicNumber());
   }

   // 2) Discover idle lanes from existing CEM Global Variables:
   //    CEM.<BOT>.<ACCOUNT>.XAUUSD.<MAGIC>.<SETTING>
   int totalGlobals = GlobalVariablesTotal();
   for(int g = 0; g < totalGlobals; g++)
   {
      string gvName = GlobalVariableName(g);
      if(StringFind(gvName, "CEM.") != 0) continue;
      string parts[];
      int count = StringSplit(gvName, '.', parts);
      if(count < 6) continue;
      string gvBot = NormalizeCemToken(parts[1]);
      string gvAccount = parts[2];
      string gvSymbol = NormalizeCemToken(parts[3]);
      int gvMagic = StrToInteger(parts[4]);
      if(gvAccount != "__ACCOUNT__" && gvAccount != IntegerToString(AccountNumber())) continue;
      output = AppendCemLaneJson(output, seen, gvBot, gvSymbol, gvMagic);
   }

   // 3) Fallback lane for the chart Reporter itself.
   if(output == "[")
   {
      string symbol2 = StringLen(SymbolFilter) > 0 ? SymbolFilter : Symbol();
      int magic2 = GetCemLaneMagic();
      output = AppendCemLaneJson(output, seen, botKey, symbol2, magic2);
   }

   output += "]";
   return output;
}


void AddUniqueString(string &items, string value)
{
   if(StringLen(value) == 0)
      return;

   string token = "|" + value + "|";
   string wrapped = "|" + items + "|";
   if(StringFind(wrapped, token) >= 0)
      return;

   if(StringLen(items) > 0)
      items += "|";
   items += value;
}

void AddUniqueInt(string &items, int value)
{
   string text = IntegerToString(value);
   string token = "|" + text + "|";
   string wrapped = "|" + items + "|";
   if(StringFind(wrapped, token) >= 0)
      return;

   if(StringLen(items) > 0)
      items += "|";
   items += text;
}

string DelimitedStringsToJsonArray(string values)
{
   if(StringLen(values) == 0)
      return "[]";

   string output = "[";
   int start = 0;

   while(true)
   {
      int separator = StringFind(values, "|", start);
      string item;

      if(separator < 0)
      {
         item = StringSubstr(values, start);
      }
      else
      {
         item = StringSubstr(values, start, separator - start);
      }

      if(StringLen(item) > 0)
      {
         if(output != "[")
            output += ",";
         output += "\"" + EscapeJson(item) + "\"";
      }

      if(separator < 0)
         break;

      start = separator + 1;
   }

   output += "]";
   return output;
}

string DelimitedIntsToJsonArray(string values)
{
   if(StringLen(values) == 0)
      return "[]";

   string output = "[";
   int start = 0;

   while(true)
   {
      int separator = StringFind(values, "|", start);
      string item;

      if(separator < 0)
      {
         item = StringSubstr(values, start);
      }
      else
      {
         item = StringSubstr(values, start, separator - start);
      }

      if(StringLen(item) > 0)
      {
         if(output != "[")
            output += ",";
         output += item;
      }

      if(separator < 0)
         break;

      start = separator + 1;
   }

   output += "]";
   return output;
}

string BuildOpenTradesJson(int &openTradeCount, int &buyTradeCount, int &sellTradeCount, double &totalLots, string &symbolsSeen, string &magicSeen)
{
   string output = "[";
   openTradeCount = 0;
   buyTradeCount = 0;
   sellTradeCount = 0;
   totalLots = 0.0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;

      int orderType = OrderType();
      if(orderType != OP_BUY && orderType != OP_SELL)
         continue;

      if(!PassTradeFilters(OrderSymbol(), OrderMagicNumber()))
         continue;

      if(!IncludeAllTrades && !IncludeOpenTrades)
         continue;

      double currentPrice = (orderType == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
      int priceDigits = GetPriceDigits(OrderSymbol());
      string trade = "{";
      trade += "\"ticket\":" + IntegerToString(OrderTicket()) + ",";
      trade += "\"symbol\":\"" + EscapeJson(OrderSymbol()) + "\",";
      trade += "\"type\":\"" + OrderTypeToText(orderType) + "\",";
      trade += "\"lots\":" + DoubleToString(OrderLots(), 2) + ",";
      trade += "\"openPrice\":" + DoubleToString(OrderOpenPrice(), priceDigits) + ",";
      trade += "\"currentPrice\":" + DoubleToString(currentPrice, priceDigits) + ",";
      trade += "\"stopLoss\":" + DoubleToString(OrderStopLoss(), priceDigits) + ",";
      trade += "\"takeProfit\":" + DoubleToString(OrderTakeProfit(), priceDigits) + ",";
      trade += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
      trade += "\"swap\":" + DoubleToString(OrderSwap(), 2) + ",";
      trade += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
      trade += "\"magicNumber\":" + IntegerToString(OrderMagicNumber()) + ",";
      trade += "\"comment\":\"" + EscapeJson(OrderComment()) + "\",";
      trade += "\"openTime\":\"" + ToIsoString(OrderOpenTime()) + "\"";
      trade += "}";

      if(output != "[")
         output += ",";
      output += trade;

      openTradeCount++;
      totalLots += OrderLots();
      if(orderType == OP_BUY)
         buyTradeCount++;
      if(orderType == OP_SELL)
         sellTradeCount++;

      AddUniqueString(symbolsSeen, OrderSymbol());
      AddUniqueInt(magicSeen, OrderMagicNumber());
   }

   output += "]";
   return output;
}

string BuildClosedTradesTodayJson(double &dailyClosedPL, string &symbolsSeen, string &magicSeen)
{
   string output = "[";
   dailyClosedPL = 0.0;
   datetime dayStart = StringToTime(TimeToString(TimeCurrent(), TIME_DATE) + " 00:00");

   for(int i = OrdersHistoryTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY))
         continue;

      int orderType = OrderType();
      if(orderType != OP_BUY && orderType != OP_SELL)
         continue;

      if(OrderCloseTime() < dayStart)
         continue;

      if(!PassTradeFilters(OrderSymbol(), OrderMagicNumber()))
         continue;

      if(!IncludeAllTrades && !IncludeClosedTradesToday)
         continue;

      int priceDigits = GetPriceDigits(OrderSymbol());
      string trade = "{";
      trade += "\"ticket\":" + IntegerToString(OrderTicket()) + ",";
      trade += "\"symbol\":\"" + EscapeJson(OrderSymbol()) + "\",";
      trade += "\"type\":\"" + OrderTypeToText(orderType) + "\",";
      trade += "\"lots\":" + DoubleToString(OrderLots(), 2) + ",";
      trade += "\"openPrice\":" + DoubleToString(OrderOpenPrice(), priceDigits) + ",";
      trade += "\"closePrice\":" + DoubleToString(OrderClosePrice(), priceDigits) + ",";
      trade += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
      trade += "\"swap\":" + DoubleToString(OrderSwap(), 2) + ",";
      trade += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
      trade += "\"magicNumber\":" + IntegerToString(OrderMagicNumber()) + ",";
      trade += "\"comment\":\"" + EscapeJson(OrderComment()) + "\",";
      trade += "\"openTime\":\"" + ToIsoString(OrderOpenTime()) + "\",";
      trade += "\"closeTime\":\"" + ToIsoString(OrderCloseTime()) + "\"";
      trade += "}";

      if(output != "[")
         output += ",";
      output += trade;

      dailyClosedPL += OrderProfit() + OrderSwap() + OrderCommission();
      AddUniqueString(symbolsSeen, OrderSymbol());
      AddUniqueInt(magicSeen, OrderMagicNumber());
   }

   output += "]";
   return output;
}

string BuildPayload()
{
   int openTradeCount = 0;
   int buyTradeCount = 0;
   int sellTradeCount = 0;
   double totalLots = 0.0;
   double dailyClosedPL = 0.0;
   string symbolsSeen = "";
   string magicSeen = "";

   string openTradesJson = BuildOpenTradesJson(openTradeCount, buyTradeCount, sellTradeCount, totalLots, symbolsSeen, magicSeen);
   string closedTradesJson = BuildClosedTradesTodayJson(dailyClosedPL, symbolsSeen, magicSeen);

   double balance = AccountBalance();
   double equity = AccountEquity();
   double margin = AccountMargin();
   double freeMargin = AccountFreeMargin();
   double marginLevel = 0.0;
   if(margin > 0.0)
      marginLevel = (equity / margin) * 100.0;

   bool terminalConnected = IsConnected();
   bool expertEnabled = IsExpertEnabled();
   string serverName = AccountServer();
   bool isDemo = (StringFind(serverName, "Demo") >= 0 || StringFind(serverName, "DEMO") >= 0 || StringFind(serverName, "demo") >= 0);
   double floatingPL = equity - balance;

   string payload = "{";
   payload += "\"pairingCode\":\"" + EscapeJson(PairingCode) + "\",";
   payload += "\"reporterVersion\":\"" + EscapeJson(REPORTER_VERSION) + "\",";
   payload += "\"reporterCapabilities\":[\"sync_account\",\"copy_open\",\"copy_close\",\"manual_trade\",\"profit_manager\",\"cem_globals\"],";
   payload += "\"accountNumber\":" + IntegerToString(AccountNumber()) + ",";
   payload += "\"accountName\":\"" + EscapeJson(AccountName()) + "\",";
   payload += "\"brokerServer\":\"" + EscapeJson(AccountServer()) + "\",";
   payload += "\"isDemo\":" + BoolToJson(isDemo) + ",";
   payload += "\"eaName\":\"" + EscapeJson(EAName) + "\",";
   payload += "\"eaVersion\":\"" + EscapeJson(EAVersion) + "\",";
   payload += "\"magicNumberFilter\":" + IntegerToString(MagicNumberFilter) + ",";
   payload += "\"symbolFilter\":\"" + EscapeJson(SymbolFilter) + "\",";
   payload += "\"balance\":" + DoubleToString(balance, 2) + ",";
   payload += "\"equity\":" + DoubleToString(equity, 2) + ",";
   payload += "\"margin\":" + DoubleToString(margin, 2) + ",";
   payload += "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ",";
   payload += "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ",";
   payload += "\"floatingPL\":" + DoubleToString(floatingPL, 2) + ",";
   payload += "\"dailyClosedPL\":" + DoubleToString(dailyClosedPL, 2) + ",";
   payload += "\"openTradeCount\":" + IntegerToString(openTradeCount) + ",";
   payload += "\"buyTradeCount\":" + IntegerToString(buyTradeCount) + ",";
   payload += "\"sellTradeCount\":" + IntegerToString(sellTradeCount) + ",";
   payload += "\"totalLots\":" + DoubleToString(totalLots, 2) + ",";
   payload += "\"symbols\":" + DelimitedStringsToJsonArray(symbolsSeen) + ",";
   payload += "\"magicNumbersSeen\":" + DelimitedIntsToJsonArray(magicSeen) + ",";
   payload += "\"openTrades\":" + openTradesJson + ",";
   payload += "\"closedTradesToday\":" + closedTradesJson + ",";
   payload += "\"cemBotKey\":\"" + EscapeJson(GetCemBotKey()) + "\",";
   payload += "\"cemBotNickname\":\"" + EscapeJson(CemBotNickname) + "\",";
   payload += "\"adaptiveBots\":" + BuildCemAdaptiveRegistryJson() + ",";
   payload += "\"timestamp\":\"" + ToIsoString(TimeGMT()) + "\",";
   payload += "\"terminalConnected\":" + BoolToJson(terminalConnected) + ",";
   payload += "\"expertEnabled\":" + BoolToJson(expertEnabled) + ",";
   payload += "\"reporterConnectionState\":\"" + EscapeJson(g_lastStatus) + "\",";
   payload += "\"reporterNetworkFailures\":" + IntegerToString(g_consecutiveNetworkFailures) + ",";
   payload += "\"reporterLastNetworkSuccessAt\":\"" + (g_lastNetworkSuccessAt > 0 ? ToIsoString(g_lastNetworkSuccessAt) : "") + "\"";
   payload += "}";

   return payload;
}


string YesNo(bool value)
{
   return value ? "ON" : "OFF";
}

string Shorten(string value, int maxLength)
{
   if(StringLen(value) <= maxLength)
      return value;
   return StringSubstr(value, 0, maxLength - 3) + "...";
}

string MaskPairingCode()
{
   if(StringLen(PairingCode) <= 7)
      return PairingCode;
   return StringSubstr(PairingCode, 0, 4) + "***" + StringSubstr(PairingCode, StringLen(PairingCode) - 2);
}

int CountCopiedTrades()
{
   int count = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(OrderMagicNumber() != CopyMagicNumber)
         continue;
      if(StringFind(OrderComment(), "WISDO_COPY:") >= 0)
         count++;
   }
   return count;
}

double CopiedFloatingPL()
{
   double total = 0.0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(OrderMagicNumber() != CopyMagicNumber)
         continue;
      if(StringFind(OrderComment(), "WISDO_COPY:") < 0)
         continue;
      total += OrderProfit() + OrderSwap() + OrderCommission();
   }
   return total;
}

void SetDashboardLine(int index, string text, color lineColor)
{
   if(!ShowWisdoDashboard)
      return;

   string name = DASH_PREFIX + IntegerToString(index);
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, DashboardCorner);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, DashboardX);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, DashboardY + (index * DashboardLineHeight));
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, DashboardFontSize);
      ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
   }

   ObjectSetInteger(0, name, OBJPROP_COLOR, lineColor);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
}

void DeleteDashboardObjects()
{
   ObjectDelete(0, STATUS_LABEL);
   for(int i = 0; i < 32; i++)
      ObjectDelete(0, DASH_PREFIX + IntegerToString(i));
}

void UpdateWisdoDashboard()
{
   if(!ShowWisdoDashboard)
      return;

   color statusColor = DashboardTextColor;
   if(g_lastStatus == "Connected") statusColor = DashboardGoodColor;
   else if(g_lastStatus == "Offline" || g_lastStatus == "Error") statusColor = DashboardBadColor;
   else if(g_lastStatus == "Degraded" || g_lastStatus == "Retrying" || g_lastStatus == "Connecting" || g_lastStatus == "Sending") statusColor = DashboardWarnColor;

   string syncTime = g_lastSendAt > 0 ? TimeToString(g_lastSendAt, TIME_SECONDS) : "never";
   string pollTime = g_lastCommandPollAt > 0 ? TimeToString(g_lastCommandPollAt, TIME_SECONDS) : "never";
   string copyMode = EnableCopyTrading ? "FOLLOWER COPY ON" : "REPORT ONLY / LEADER";
   string autoTrading = IsExpertEnabled() ? "ON" : "OFF";
   string terminal = IsConnected() ? "ONLINE" : "OFFLINE";
   int copiedCount = CountCopiedTrades();
   double copiedPL = CopiedFloatingPL();
   double floatingPL = AccountEquity() - AccountBalance();
   color copyColor = EnableCopyTrading ? DashboardGoodColor : DashboardWarnColor;
   color autoColor = IsExpertEnabled() ? DashboardGoodColor : DashboardBadColor;
   color pnlColor = floatingPL >= 0.0 ? DashboardGoodColor : DashboardBadColor;
   color copiedPnlColor = copiedPL >= 0.0 ? DashboardGoodColor : DashboardBadColor;

   SetDashboardLine(0,  "CEM CULTURE / WISDO PRO MANAGER DASHBOARD  v" + REPORTER_VERSION, DashboardTitleColor);
   SetDashboardLine(1,  "Status: " + g_lastStatus + " | Terminal: " + terminal + " | Last Sync: " + syncTime, statusColor);
   SetDashboardLine(2,  "Pairing: " + MaskPairingCode() + " | Account: " + IntegerToString(AccountNumber()) + " | Server: " + Shorten(AccountServer(), 28), DashboardTextColor);
   SetDashboardLine(3,  "Mode: " + copyMode + " | AutoTrading: " + autoTrading + " | Poll: " + pollTime, autoColor);
   SetDashboardLine(4,  "Copy Safety: MaxLot " + DoubleToString(CopyMaxLot, 2) + " | FallbackLot " + DoubleToString(CopyFixedLotFallback, 2) + " | MaxSpread " + DoubleToString(CopyMaxSpreadPoints, 0), copyColor);
   SetDashboardLine(5,  "Open Copied Trades: " + IntegerToString(copiedCount) + " | Copied Floating P/L: " + DoubleToString(copiedPL, 2), copiedPnlColor);
   SetDashboardLine(6,  "Manual Trading: " + YesNo(EnableManualTradeExecution) + " | Manual Open Trades: " + IntegerToString(CountManualWisdoTrades()) + " | Manual MaxLot: " + DoubleToString(ManualMaxLot, 2), EnableManualTradeExecution ? DashboardGoodColor : DashboardWarnColor);
   SetDashboardLine(7,  "Balance: " + DoubleToString(AccountBalance(), 2) + " | Equity: " + DoubleToString(AccountEquity(), 2) + " | Floating P/L: " + DoubleToString(floatingPL, 2), pnlColor);
   SetDashboardLine(8,  "Profit Manager: " + YesNo(EnableProfitManagerExecution) + " | Default Trim: " + DoubleToString(ProfitDefaultPartialClosePercent, 0) + "% | Equity Floor: " + DoubleToString(GlobalVariableCheck(ProfitEquityFloorGV) ? GlobalVariableGet(ProfitEquityFloorGV) : 0, 2), EnableProfitManagerExecution ? DashboardGoodColor : DashboardWarnColor);
   SetDashboardLine(9,  "Last Command: " + Shorten(g_lastCommand, 35) + " | Cmd ID: " + Shorten(g_lastCommandId, 18) + " | Ticket: " + IntegerToString(g_lastCopyTicket), DashboardTextColor);
   SetDashboardLine(10, "Last Result: " + Shorten(g_lastCopyMessage, 90), StringLen(g_lastError) > 0 ? DashboardBadColor : DashboardTextColor);
   SetDashboardLine(11, "Sync URL: " + Shorten(SyncUrl, 95), DashboardTextColor);
   SetDashboardLine(12, "Poll URL: " + Shorten(ResolveCommandPollUrl(), 95), DashboardTextColor);

   if(StringLen(g_lastError) > 0)
      SetDashboardLine(13, "NETWORK: " + Shorten(g_lastError, 100), g_lastStatus == "Offline" ? DashboardBadColor : DashboardWarnColor);
   else
      SetDashboardLine(13, "Ready: report, copy, manual trade, and profit manager commands are separated by inputs.", DashboardGoodColor);
   string retryText = g_nextNetworkAttemptAt > TimeCurrent() ? TimeToString(g_nextNetworkAttemptAt, TIME_SECONDS) : "now";
   SetDashboardLine(14, "Connection Health: failures " + IntegerToString(g_consecutiveNetworkFailures) + " | last healthy " + (g_lastNetworkSuccessAt > 0 ? TimeToString(g_lastNetworkSuccessAt, TIME_SECONDS) : "never") + " | next attempt " + retryText, statusColor);
}

void UpdateStatusLabel()
{
   if(!ShowWisdoDashboard)
   {
      if(ObjectFind(0, STATUS_LABEL) < 0)
      {
         ObjectCreate(0, STATUS_LABEL, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(0, STATUS_LABEL, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(0, STATUS_LABEL, OBJPROP_XDISTANCE, 10);
         ObjectSetInteger(0, STATUS_LABEL, OBJPROP_YDISTANCE, 15);
         ObjectSetInteger(0, STATUS_LABEL, OBJPROP_FONTSIZE, 10);
      }

      color labelColor = clrSilver;
      if(g_lastStatus == "Connected") labelColor = clrLimeGreen;
      else if(g_lastStatus == "Offline" || g_lastStatus == "Error") labelColor = clrTomato;
      else if(g_lastStatus == "Degraded" || g_lastStatus == "Retrying" || g_lastStatus == "Connecting" || g_lastStatus == "Sending") labelColor = clrGold;

      string text = "CultureCoin Reporter: " + g_lastStatus;
      if(g_lastSendAt > 0) text += " | Last Send: " + TimeToString(g_lastSendAt, TIME_SECONDS);
      if(StringLen(g_lastCommand) > 0) text += " | Last Cmd: " + Shorten(g_lastCommand, 30);
      if(StringLen(g_lastError) > 0) text += " | Error: " + Shorten(g_lastError, 60);
      ObjectSetInteger(0, STATUS_LABEL, OBJPROP_COLOR, labelColor);
      ObjectSetString(0, STATUS_LABEL, OBJPROP_TEXT, text);
      return;
   }

   ObjectDelete(0, STATUS_LABEL);
   UpdateWisdoDashboard();
}

bool ValidateInputs()
{
   if(StringLen(PairingCode) == 0)
   {
      g_lastStatus = "Error";
      g_lastError = "Missing PairingCode";
      Print("CultureCoin Reporter: PairingCode is required.");
      UpdateStatusLabel();
      return false;
   }

   if(StringLen(SyncUrl) == 0)
   {
      g_lastStatus = "Error";
      g_lastError = "Missing SyncUrl";
      Print("CultureCoin Reporter: SyncUrl is required.");
      UpdateStatusLabel();
      return false;
   }

   if(StringFind(SyncUrl, "http://") != 0 && StringFind(SyncUrl, "https://") != 0)
   {
      g_lastStatus = "Error";
      g_lastError = "SyncUrl must start with http:// or https://";
      Print("CultureCoin Reporter: SyncUrl must start with http:// or https://");
      UpdateStatusLabel();
      return false;
   }

   return true;
}


string GetBaseApiUrl()
{
   if(StringLen(CommandPollUrl) > 0)
   {
      int index = StringFind(CommandPollUrl, "/mt4-command-poll");
      if(index > 0)
         return StringSubstr(CommandPollUrl, 0, index);
   }

   string url = SyncUrl;
   int syncIndex = StringFind(url, "/mt4-sync");
   if(syncIndex > 0)
      return StringSubstr(url, 0, syncIndex);

   int apiIndex = StringFind(url, "/api/mt4/sync");
   if(apiIndex > 0)
      return StringSubstr(url, 0, apiIndex);

   return url;
}

string ResolveCommandPollUrl()
{
   if(StringLen(CommandPollUrl) > 0)
      return CommandPollUrl;
   return GetBaseApiUrl() + "/mt4-command-poll";
}

string ResolveCommandCompleteUrl()
{
   if(StringLen(CommandCompleteUrl) > 0)
      return CommandCompleteUrl;
   return GetBaseApiUrl() + "/mt4-command-complete";
}

string JsonGetString(string json, string key, string fallback = "")
{
   string pattern = "\"" + key + "\":";
   int pos = StringFind(json, pattern);
   if(pos < 0)
      return fallback;

   pos += StringLen(pattern);
   while(pos < StringLen(json) && StringGetCharacter(json, pos) <= 32)
      pos++;

   if(pos >= StringLen(json))
      return fallback;

   if(StringGetCharacter(json, pos) == '"')
   {
      pos++;
      string out = "";
      bool escaped = false;
      for(int i = pos; i < StringLen(json); i++)
      {
         ushort ch = StringGetCharacter(json, i);
         if(escaped)
         {
            out += CharToString((uchar)ch);
            escaped = false;
            continue;
         }
         if(ch == '\\')
         {
            escaped = true;
            continue;
         }
         if(ch == '"')
            return out;
         out += CharToString((uchar)ch);
      }
      return fallback;
   }

   int end = pos;
   while(end < StringLen(json))
   {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}' || c == ']')
         break;
      end++;
   }

   string raw = StringSubstr(json, pos, end - pos);
   StringTrimLeft(raw);
   StringTrimRight(raw);
   return raw;
}

double JsonGetDouble(string json, string key, double fallback = 0.0)
{
   string value = JsonGetString(json, key, "");
   if(StringLen(value) == 0 || value == "null")
      return fallback;
   return StrToDouble(value);
}

int JsonGetInt(string json, string key, int fallback = 0)
{
   string value = JsonGetString(json, key, "");
   if(StringLen(value) == 0 || value == "null")
      return fallback;
   return StrToInteger(value);
}

bool JsonGetBool(string json, string key, bool fallback = false)
{
   string value = JsonGetString(json, key, "");
   StringToLower(value);
   if(value == "true" || value == "1")
      return true;
   if(value == "false" || value == "0")
      return false;
   return fallback;
}

string BuildCopyMarker(string sourceTicket)
{
   string clean = sourceTicket;
   StringTrimLeft(clean);
   StringTrimRight(clean);
   string marker = "WISDO_COPY:" + clean;
   if(StringLen(marker) > 31)
      marker = StringSubstr(marker, 0, 31);
   return marker;
}

bool IsSelectedWisdoCopyTrade()
{
   if(OrderCloseTime() != 0)
      return false;
   if(OrderType() != OP_BUY && OrderType() != OP_SELL)
      return false;
   if(OrderMagicNumber() == CopyMagicNumber)
      return true;
   return StringFind(OrderComment(), "WISDO_COPY:") >= 0;
}

bool IsCopyTradeAlreadyOpen(string sourceTicket)
{
   if(StringLen(sourceTicket) == 0)
      return false;

   string marker = BuildCopyMarker(sourceTicket);
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsSelectedWisdoCopyTrade())
         continue;
      if(StringFind(OrderComment(), marker) >= 0)
         return true;
   }
   return false;
}

int FindCopiedTradeTicket(string sourceTicket)
{
   if(StringLen(sourceTicket) == 0)
      return -1;

   string marker = BuildCopyMarker(sourceTicket);
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsSelectedWisdoCopyTrade())
         continue;
      if(StringFind(OrderComment(), marker) >= 0)
         return OrderTicket();
   }
   return -1;
}

int FindExplicitFollowerTicket(string commandJson)
{
   int followerTicket = JsonGetInt(commandJson, "followerTicket", -1);
   if(followerTicket <= 0)
      followerTicket = JsonGetInt(commandJson, "copyTicket", -1);
   if(followerTicket <= 0)
      followerTicket = JsonGetInt(commandJson, "mirrorTicket", -1);
   if(followerTicket <= 0)
      return -1;

   if(!OrderSelect(followerTicket, SELECT_BY_TICKET, MODE_TRADES))
      return -1;
   if(!IsSelectedWisdoCopyTrade())
      return -1;
   return followerTicket;
}

int FindUniqueCopiedTradeByContext(string commandJson)
{
   string requestedSymbol = JsonGetString(commandJson, "followerSymbol", "");
   if(StringLen(requestedSymbol) == 0)
      requestedSymbol = JsonGetString(commandJson, "symbol", "");
   string resolvedSymbol = StringLen(requestedSymbol) > 0 ? ResolveTradeSymbol(requestedSymbol) : "";

   string side = JsonGetString(commandJson, "side", "");
   if(StringLen(side) == 0)
      side = JsonGetString(commandJson, "direction", "");
   StringToLower(side);

   int expectedType = -1;
   if(StringFind(side, "buy") >= 0 || side == "long") expectedType = OP_BUY;
   if(StringFind(side, "sell") >= 0 || side == "short") expectedType = OP_SELL;

   int foundTicket = -1;
   int foundCount = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsSelectedWisdoCopyTrade())
         continue;
      if(StringLen(resolvedSymbol) > 0 && OrderSymbol() != resolvedSymbol)
         continue;
      if(expectedType >= 0 && OrderType() != expectedType)
         continue;
      foundTicket = OrderTicket();
      foundCount++;
   }

   // Never guess among multiple copied positions. The fallback is only safe
   // when the command context identifies exactly one WISDO copy position.
   return foundCount == 1 ? foundTicket : -1;
}

double NormalizeCopyLots(string symbol, double requestedLots)
{
   double lots = requestedLots;
   if(lots <= 0.0)
      lots = CopyFixedLotFallback;

   double minLot = MarketInfo(symbol, MODE_MINLOT);
   double maxLot = MarketInfo(symbol, MODE_MAXLOT);
   double lotStep = MarketInfo(symbol, MODE_LOTSTEP);
   if(minLot <= 0.0)
      minLot = 0.01;
   if(maxLot <= 0.0)
      maxLot = 100.0;
   if(lotStep <= 0.0)
      lotStep = 0.01;

   if(lots < minLot)
      lots = minLot;
   if(lots > maxLot)
      lots = maxLot;
   if(CopyMaxLot > 0.0 && lots > CopyMaxLot)
      lots = CopyMaxLot;

   lots = MathFloor(lots / lotStep) * lotStep;
   if(lots < minLot)
      lots = minLot;

   return NormalizeDouble(lots, 2);
}

string SendCommandComplete(string commandId, bool success, string message, int ticket = -1)
{
   string url = ResolveCommandCompleteUrl();
   if(StringLen(url) == 0)
      return "missing complete url";

   string payload = "{";
   payload += "\"pairingCode\":\"" + EscapeJson(PairingCode) + "\",";
   payload += "\"commandId\":\"" + EscapeJson(commandId) + "\",";
   payload += "\"result\":{";
   payload += "\"success\":" + BoolToJson(success) + ",";
   payload += "\"message\":\"" + EscapeJson(message) + "\",";
   payload += "\"ticket\":" + IntegerToString(ticket);
   payload += "}}";

   char postData[];
   char result[];
   string resultHeaders = "";
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(ApiKey) > 0)
      headers += "X-CultureCoin-ApiKey: " + ApiKey + "\r\n";

   int payloadSize = StringToCharArray(payload, postData, 0, -1, CP_UTF8);
   if(payloadSize > 0)
      ArrayResize(postData, payloadSize - 1);

   ResetLastError();
   int httpCode = WebRequest("POST", url, headers, 10000, postData, result, resultHeaders);
   if(httpCode == -1)
      return "complete WebRequest failed " + IntegerToString(GetLastError());

   return "complete HTTP " + IntegerToString(httpCode);
}


bool IsSymbolTradable(string symbol)
{
   if(StringLen(symbol) == 0)
      return false;
   double bid = MarketInfo(symbol, MODE_BID);
   double ask = MarketInfo(symbol, MODE_ASK);
   double point = MarketInfo(symbol, MODE_POINT);
   return (bid > 0.0 && ask > 0.0 && point > 0.0);
}

string ResolveTradeSymbol(string requestedSymbol)
{
   string requested = requestedSymbol;
   StringTrimLeft(requested);
   StringTrimRight(requested);
   if(StringLen(requested) == 0)
      requested = Symbol();

   if(IsSymbolTradable(requested))
      return requested;

   // Explicit alias map wins. Example: NASUSD=NAS100;US30=US30.cash
   if(StringLen(SymbolAliasMap) > 0)
   {
      string pairs[];
      int count = StringSplit(SymbolAliasMap, ';', pairs);
      for(int i = 0; i < count; i++)
      {
         string pair = pairs[i];
         int eq = StringFind(pair, "=");
         if(eq <= 0)
            continue;
         string key = StringSubstr(pair, 0, eq);
         string value = StringSubstr(pair, eq + 1);
         StringTrimLeft(key); StringTrimRight(key);
         StringTrimLeft(value); StringTrimRight(value);
         string keyLower = key;
         string reqLower = requested;
         StringToLower(keyLower);
         StringToLower(reqLower);
         if(keyLower == reqLower && IsSymbolTradable(value))
            return value;
      }
   }

   if(StringLen(SymbolSuffix) > 0)
   {
      string suffixed = requested + SymbolSuffix;
      if(IsSymbolTradable(suffixed))
         return suffixed;
   }

   if(EnableSymbolAutoSearch)
   {
      string reqLower2 = requested;
      StringToLower(reqLower2);
      int total = SymbolsTotal(true);
      for(int s = 0; s < total; s++)
      {
         string candidate = SymbolName(s, true);
         string candLower = candidate;
         StringToLower(candLower);
         if(StringFind(candLower, reqLower2) == 0 && IsSymbolTradable(candidate))
            return candidate;
      }
   }

   return requested;
}

double NormalizeManualLots(string symbol, double requestedLots)
{
   double lots = requestedLots;
   if(lots <= 0.0)
      lots = ManualFixedLotFallback;

   double minLot = MarketInfo(symbol, MODE_MINLOT);
   double maxLot = MarketInfo(symbol, MODE_MAXLOT);
   double lotStep = MarketInfo(symbol, MODE_LOTSTEP);
   if(minLot <= 0.0) minLot = 0.01;
   if(maxLot <= 0.0) maxLot = 100.0;
   if(lotStep <= 0.0) lotStep = 0.01;

   if(lots < minLot) lots = minLot;
   if(lots > maxLot) lots = maxLot;
   if(ManualMaxLot > 0.0 && lots > ManualMaxLot) lots = ManualMaxLot;

   lots = MathFloor(lots / lotStep) * lotStep;
   if(lots < minLot) lots = minLot;
   return NormalizeDouble(lots, 2);
}

bool IsManualCommandAlreadyOpen(string commandId)
{
   if(StringLen(commandId) == 0)
      return false;
   string marker = "WISDO_MANUAL:" + commandId;
   if(StringLen(marker) > 31)
      marker = StringSubstr(marker, 0, 31);
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(OrderMagicNumber() != ManualMagicNumber)
         continue;
      if(StringFind(OrderComment(), marker) >= 0)
         return true;
   }
   return false;
}

int CountManualWisdoTrades()
{
   int count = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(OrderMagicNumber() != ManualMagicNumber)
         continue;
      if(StringFind(OrderComment(), "WISDO_MANUAL:") >= 0)
         count++;
   }
   return count;
}

bool ExecuteManualOpenTrade(string commandJson, string &message, int &ticket)
{
   ticket = -1;
   if(!EnableManualTradeExecution)
   {
      message = "Manual trade execution disabled on this terminal";
      return false;
   }

   if(ManualRequireAutoTrading && !IsExpertEnabled())
   {
      message = "MT4 AutoTrading / Expert execution is disabled";
      return false;
   }

   string commandId = JsonGetString(commandJson, "commandId", JsonGetString(commandJson, "id", ""));
   if(IsManualCommandAlreadyOpen(commandId))
   {
      message = "Manual command already opened for commandId " + commandId;
      return true;
   }

   string requestedSymbol = JsonGetString(commandJson, "symbol", Symbol());
   string symbol = ResolveTradeSymbol(requestedSymbol);
   string side = JsonGetString(commandJson, "side", "");
   if(StringLen(side) == 0) side = JsonGetString(commandJson, "direction", "");
   if(StringLen(side) == 0) side = JsonGetString(commandJson, "type", "");
   StringToLower(side);

   int orderType = -1;
   if(StringFind(side, "buy") >= 0 || side == "long") orderType = OP_BUY;
   if(StringFind(side, "sell") >= 0 || side == "short") orderType = OP_SELL;

   if(orderType != OP_BUY && orderType != OP_SELL)
   {
      message = "Invalid manual trade side/direction: " + side;
      return false;
   }

   if(orderType == OP_BUY && !ManualAllowBuy)
   {
      message = "Manual buy blocked by settings";
      return false;
   }
   if(orderType == OP_SELL && !ManualAllowSell)
   {
      message = "Manual sell blocked by settings";
      return false;
   }

   if(!IsSymbolTradable(symbol))
   {
      message = "Symbol not available: requested " + requestedSymbol + ", resolved " + symbol + ". Add SymbolAliasMap if broker uses a different name.";
      return false;
   }

   double spread = (MarketInfo(symbol, MODE_ASK) - MarketInfo(symbol, MODE_BID)) / MarketInfo(symbol, MODE_POINT);
   if(ManualMaxSpreadPoints > 0.0 && spread > ManualMaxSpreadPoints)
   {
      message = "Manual trade spread too high on " + symbol + ": " + DoubleToString(spread, 1) + " points";
      return false;
   }

   double requestedLots = JsonGetDouble(commandJson, "lots", 0.0);
   if(requestedLots <= 0.0) requestedLots = JsonGetDouble(commandJson, "lot", 0.0);
   if(requestedLots <= 0.0) requestedLots = JsonGetDouble(commandJson, "volume", ManualFixedLotFallback);
   double lots = NormalizeManualLots(symbol, requestedLots);

   double price = (orderType == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
   int digits = GetPriceDigits(symbol);
   price = NormalizeDouble(price, digits);

   double sl = 0.0;
   double tp = 0.0;
   if(ManualUseSLTP)
   {
      sl = JsonGetDouble(commandJson, "stopLoss", 0.0);
      if(sl <= 0.0) sl = JsonGetDouble(commandJson, "sl", 0.0);
      tp = JsonGetDouble(commandJson, "takeProfit", 0.0);
      if(tp <= 0.0) tp = JsonGetDouble(commandJson, "tp", 0.0);
      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);
   }

   double marginCheck = AccountFreeMarginCheck(symbol, orderType, lots);
   if(marginCheck <= 0.0)
   {
      message = "Insufficient free margin for manual WISDO trade";
      return false;
   }

   string comment = "WISDO_MANUAL:" + commandId;
   if(StringLen(comment) > 31)
      comment = StringSubstr(comment, 0, 31);

   ResetLastError();
   ticket = OrderSend(symbol, orderType, lots, price, ManualSlippage, sl, tp, comment, ManualMagicNumber, 0, clrGold);
   if(ticket <= 0)
   {
      int err = GetLastError();
      message = "Manual OrderSend failed: " + IntegerToString(err) + " for " + symbol;
      return false;
   }

   message = "Manual WISDO trade opened " + symbol + " ticket " + IntegerToString(ticket) + " lots " + DoubleToString(lots, 2);
   return true;
}

bool ExecuteManualCloseTrade(string commandJson, string &message, int &ticket)
{
   ticket = JsonGetInt(commandJson, "ticket", -1);
   if(ticket <= 0)
   {
      message = "Manual close requires ticket";
      return false;
   }
   if(!OrderSelect(ticket, SELECT_BY_TICKET, MODE_TRADES))
   {
      message = "Could not select manual ticket " + IntegerToString(ticket);
      return false;
   }
   if(OrderMagicNumber() != ManualMagicNumber && StringFind(OrderComment(), "WISDO_MANUAL:") < 0)
   {
      message = "Ticket is not a WISDO manual trade";
      return false;
   }
   int type = OrderType();
   double closePrice = (type == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
   closePrice = NormalizeDouble(closePrice, GetPriceDigits(OrderSymbol()));
   ResetLastError();
   bool ok = OrderClose(ticket, OrderLots(), closePrice, ManualSlippage, clrTomato);
   if(!ok)
   {
      int err = GetLastError();
      message = "Manual OrderClose failed: " + IntegerToString(err);
      return false;
   }
   message = "Manual WISDO trade closed ticket " + IntegerToString(ticket);
   return true;
}


bool IsWisdoManagedOrder()
{
   string c = OrderComment();
   if(StringFind(c, "WISDO_COPY:") >= 0) return true;
   if(StringFind(c, "WISDO_MANUAL:") >= 0) return true;
   return false;
}

bool ProfitOrderMatches(string commandJson)
{
   if(OrderType() != OP_BUY && OrderType() != OP_SELL) return false;
   if(ProfitOnlyManageWisdoTrades && !IsWisdoManagedOrder()) return false;

   string filterSymbol = ProfitSymbolFilter;
   string commandSymbol = JsonGetString(commandJson, "symbol", "");
   if(StringLen(commandSymbol) == 0) commandSymbol = JsonGetString(commandJson, "targetSymbol", "");
   if(StringLen(commandSymbol) > 0) filterSymbol = ResolveTradeSymbol(commandSymbol);
   if(StringLen(filterSymbol) > 0 && OrderSymbol() != filterSymbol) return false;

   int filterMagic = ProfitMagicNumberFilter;
   int commandMagic = JsonGetInt(commandJson, "magicNumber", -999999);
   if(commandMagic == -999999) commandMagic = JsonGetInt(commandJson, "magic", -999999);
   if(commandMagic == -999999) commandMagic = JsonGetInt(commandJson, "targetMagic", -999999);
   if(commandMagic != -999999) filterMagic = commandMagic;
   if(filterMagic != 0 && OrderMagicNumber() != filterMagic) return false;

   string botText = JsonGetString(commandJson, "bot", "");
   if(StringLen(botText) == 0) botText = JsonGetString(commandJson, "botName", "");
   if(StringLen(botText) > 0)
   {
      string commentLower = OrderComment();
      string botLower = botText;
      StringToLower(commentLower);
      StringToLower(botLower);
      if(StringFind(commentLower, botLower) < 0) return false;
   }
   return true;
}

double OrderNetProfit()
{
   return OrderProfit() + OrderSwap() + OrderCommission();
}

double NormalizeCloseLots(string symbol, double lots)
{
   double minLot = MarketInfo(symbol, MODE_MINLOT);
   double lotStep = MarketInfo(symbol, MODE_LOTSTEP);
   if(minLot <= 0.0) minLot = 0.01;
   if(lotStep <= 0.0) lotStep = 0.01;
   lots = MathFloor(lots / lotStep) * lotStep;
   if(lots < minLot) return 0.0;
   return NormalizeDouble(lots, 2);
}

bool CloseSelectedOrderByPercent(double percent, string &detail)
{
   int type = OrderType();
   string symbol = OrderSymbol();
   int closeTicket = OrderTicket();
   double lots = OrderLots();
   if(percent <= 0.0) percent = 100.0;
   if(percent > 100.0) percent = 100.0;
   double closeLots = lots;
   if(percent < 99.99)
   {
      closeLots = NormalizeCloseLots(symbol, lots * (percent / 100.0));
      double remaining = NormalizeCloseLots(symbol, lots - closeLots);
      double minLot = MarketInfo(symbol, MODE_MINLOT);
      if(minLot <= 0.0) minLot = 0.01;
      if(closeLots <= 0.0 || remaining < minLot) closeLots = lots;
   }
   double closePrice = (type == OP_BUY) ? MarketInfo(symbol, MODE_BID) : MarketInfo(symbol, MODE_ASK);
   closePrice = NormalizeDouble(closePrice, GetPriceDigits(symbol));
   ResetLastError();
   bool ok = OrderClose(closeTicket, closeLots, closePrice, ProfitSlippage, clrAqua);
   if(!ok)
   {
      int err = GetLastError();
      detail = "ticket " + IntegerToString(closeTicket) + " failed " + IntegerToString(err);
      return false;
   }
   detail = "ticket " + IntegerToString(closeTicket) + " closed lots " + DoubleToString(closeLots, 2);
   return true;
}

bool ExecuteProfitCloseSweep(string commandJson, string mode, double percent, string &message, int &lastTicket)
{
   if(!EnableProfitManagerExecution)
   {
      message = "Profit manager execution disabled on this terminal";
      return false;
   }
   if(ProfitRequireAutoTrading && !IsExpertEnabled())
   {
      message = "AutoTrading / Expert execution disabled for profit manager";
      return false;
   }

   // Snapshot every matching ticket first. One WISDO command owns the complete basket,
   // so the website never queues or waits for one close command per position.
   int tickets[];
   double profits[];
   int matchCount = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(!ProfitOrderMatches(commandJson)) continue;
      double p = OrderNetProfit();
      bool shouldClose = false;
      if(mode == "winners") shouldClose = (p > 0.0);
      else if(mode == "losers") shouldClose = (p < 0.0 && ProfitAllowCloseLosses);
      else if(mode == "all" || mode == "basket") shouldClose = true;
      if(!shouldClose) continue;
      ArrayResize(tickets, matchCount + 1);
      ArrayResize(profits, matchCount + 1);
      tickets[matchCount] = OrderTicket();
      profits[matchCount] = p;
      matchCount++;
   }

   if(matchCount == 0)
   {
      message = "No matching trades found for profit command";
      return true;
   }

   int closed = 0;
   int failed = 0;
   double secured = 0.0;
   string details = "";
   for(int index = 0; index < matchCount; index++)
   {
      int selectedTicket = tickets[index];
      if(!OrderSelect(selectedTicket, SELECT_BY_TICKET, MODE_TRADES))
      {
         failed++;
         if(StringLen(details) < 220) details += "ticket " + IntegerToString(selectedTicket) + " unavailable; ";
         continue;
      }
      string detail = "";
      RefreshRates();
      if(CloseSelectedOrderByPercent(percent, detail))
      {
         closed++;
         secured += profits[index];
         lastTicket = selectedTicket;
      }
      else failed++;
      if(StringLen(details) < 220) details += detail + "; ";
   }

   message = "Atomic basket sweep targeted " + IntegerToString(matchCount) + ", closed " + IntegerToString(closed) +
             ", failed " + IntegerToString(failed) + ", approx secured " + DoubleToString(secured, 2) + ". " + details;
   return failed == 0;
}

bool ExecuteProfitManagerCommand(string command, string commandJson, string &message, int &ticket)
{
   ticket = -1;
   string c = command;
   StringToUpper(c);
   double percent = JsonGetDouble(commandJson, "percent", 0.0);
   if(percent <= 0.0) percent = JsonGetDouble(commandJson, "closePercent", 0.0);
   if(percent <= 0.0) percent = JsonGetDouble(commandJson, "partialPercent", 0.0);
   if(percent <= 0.0) percent = ProfitDefaultPartialClosePercent;

   if(c == "CLOSE_ALL_PROFITS" || c == "CLOSE_ALL_WINNERS") return ExecuteProfitCloseSweep(commandJson, "winners", 100.0, message, ticket);
   if(c == "TRIM_PROFITS" || c == "PARTIAL_CLOSE_WINNERS") return ExecuteProfitCloseSweep(commandJson, "winners", percent, message, ticket);
   if(c == "PARTIAL_CLOSE_BASKET") return ExecuteProfitCloseSweep(commandJson, "basket", percent, message, ticket);
   if(c == "CLOSE_ALL_LOSERS") return ExecuteProfitCloseSweep(commandJson, "losers", 100.0, message, ticket);
   if(c == "CLOSE_ALL_TRADES" || c == "EMERGENCY_CLOSE_ALL") return ExecuteProfitCloseSweep(commandJson, "all", 100.0, message, ticket);
   if(c == "CLOSE_BY_SYMBOL" || c == "CLOSE_BY_MAGIC" || c == "CLOSE_BASKET" || c == "CLOSE_BY_BOT")
   {
      string closeMode = JsonGetString(commandJson, "closeMode", "");
      if(StringLen(closeMode) == 0) closeMode = JsonGetString(commandJson, "targetMode", "");
      StringToLower(closeMode);
      if(closeMode == "winners" || closeMode == "winner" || closeMode == "profits" || closeMode == "profit")
         return ExecuteProfitCloseSweep(commandJson, "winners", percent, message, ticket);
      if(closeMode == "losers" || closeMode == "loser" || closeMode == "losses" || closeMode == "loss")
         return ExecuteProfitCloseSweep(commandJson, "losers", percent, message, ticket);
      return ExecuteProfitCloseSweep(commandJson, "basket", percent, message, ticket);
   }
   if(c == "SET_EQUITY_FLOOR" || c == "LOCK_PROFIT")
   {
      double floor = JsonGetDouble(commandJson, "equityFloor", 0.0);
      if(floor <= 0.0) floor = JsonGetDouble(commandJson, "floor", 0.0);
      if(floor <= 0.0) floor = AccountEquity();
      GlobalVariableSet(ProfitEquityFloorGV, floor);
      GlobalVariableSet(ProfitLockModeGV, 1);
      message = "Equity floor locked at " + DoubleToString(floor, 2);
      return true;
   }
   if(c == "WALK_AWAY_MODE")
   {
      double floor2 = JsonGetDouble(commandJson, "equityFloor", 0.0);
      if(floor2 <= 0.0) floor2 = JsonGetDouble(commandJson, "floor", 0.0);
      if(floor2 > 0.0) GlobalVariableSet(ProfitEquityFloorGV, floor2);
      GlobalVariableSet(ProfitWalkAwayGV, 1);
      GlobalVariableSet(ProfitLockModeGV, 1);
      message = "Walk Away Mode enabled" + (floor2 > 0.0 ? " with equity floor " + DoubleToString(floor2, 2) : "");
      return true;
   }
   message = "Unsupported profit manager command: " + command;
   return false;
}

bool ExecuteCopyOpenTrade(string commandJson, string &message, int &ticket)
{
   ticket = -1;
   if(!EnableCopyTrading)
   {
      message = "Copy trading disabled on this terminal";
      return false;
   }

   if(CopyRequireAutoTrading && !IsExpertEnabled())
   {
      message = "MT4 AutoTrading / Expert execution is disabled";
      return false;
   }

   string requestedSymbol = JsonGetString(commandJson, "followerSymbol", "");
   if(StringLen(requestedSymbol) == 0)
      requestedSymbol = JsonGetString(commandJson, "symbol", Symbol());
   string symbol = ResolveTradeSymbol(requestedSymbol);
   string side = JsonGetString(commandJson, "side", "");
   if(StringLen(side) == 0)
      side = JsonGetString(commandJson, "type", "");
   StringToLower(side);

   int orderType = -1;
   if(StringFind(side, "buy") >= 0)
      orderType = OP_BUY;
   if(StringFind(side, "sell") >= 0)
      orderType = OP_SELL;

   if(orderType != OP_BUY && orderType != OP_SELL)
   {
      message = "Invalid copy side";
      return false;
   }

   if(orderType == OP_BUY && !CopyAllowBuy)
   {
      message = "Copy buy blocked by settings";
      return false;
   }

   if(orderType == OP_SELL && !CopyAllowSell)
   {
      message = "Copy sell blocked by settings";
      return false;
   }

   if(MarketInfo(symbol, MODE_BID) <= 0.0 || MarketInfo(symbol, MODE_ASK) <= 0.0)
   {
      message = "Symbol not available: requested " + requestedSymbol + ", resolved " + symbol + ". Add SymbolAliasMap or SymbolSuffix if broker uses a different name.";
      return false;
   }

   double spread = (MarketInfo(symbol, MODE_ASK) - MarketInfo(symbol, MODE_BID)) / MarketInfo(symbol, MODE_POINT);
   if(CopyMaxSpreadPoints > 0.0 && spread > CopyMaxSpreadPoints)
   {
      message = "Spread too high: " + DoubleToString(spread, 1) + " points";
      return false;
   }

   string sourceTicket = JsonGetString(commandJson, "sourceTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "leaderTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "masterTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "copyKey", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "signalId", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "commandId", JsonGetString(commandJson, "id", ""));

   if(StringLen(sourceTicket) == 0)
   {
      message = "Copy command missing sourceTicket/leaderTicket/copyKey";
      return false;
   }

   if(IsCopyTradeAlreadyOpen(sourceTicket))
   {
      message = "Copy trade already open for source " + sourceTicket;
      return true;
   }

   double requestedLots = JsonGetDouble(commandJson, "lots", CopyFixedLotFallback);
   double lots = NormalizeCopyLots(symbol, requestedLots);
   double price = (orderType == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
   int digits = GetPriceDigits(symbol);
   price = NormalizeDouble(price, digits);

   double sl = 0.0;
   double tp = 0.0;
   if(CopyUseSLTP)
   {
      sl = JsonGetDouble(commandJson, "stopLoss", 0.0);
      tp = JsonGetDouble(commandJson, "takeProfit", 0.0);
      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);
   }

   double marginCheck = AccountFreeMarginCheck(symbol, orderType, lots);
   if(marginCheck <= 0.0)
   {
      message = "Insufficient free margin for copied trade";
      return false;
   }

   string comment = BuildCopyMarker(sourceTicket);

   ResetLastError();
   ticket = OrderSend(symbol, orderType, lots, price, CopySlippage, sl, tp, comment, CopyMagicNumber, 0, clrDeepSkyBlue);
   if(ticket <= 0)
   {
      int err = GetLastError();
      message = "OrderSend failed: " + IntegerToString(err);
      return false;
   }

   message = "Copied trade opened ticket " + IntegerToString(ticket);
   return true;
}

bool ExecuteCopyCloseTrade(string commandJson, string &message, int &ticket)
{
   ticket = -1;
   if(!EnableCopyTrading)
   {
      message = "Copy trading disabled on this terminal";
      return false;
   }

   if(CopyRequireAutoTrading && !IsExpertEnabled())
   {
      message = "MT4 AutoTrading / Expert execution is disabled";
      return false;
   }

   string sourceTicket = JsonGetString(commandJson, "sourceTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "leaderTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "masterTicket", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "copyKey", "");
   if(StringLen(sourceTicket) == 0)
      sourceTicket = JsonGetString(commandJson, "signalId", "");

   // Strongest match first: the server-recorded follower ticket returned by
   // OrderSend. This also closes legacy positions whose MT4 comment used an
   // older command-id marker.
   ticket = FindExplicitFollowerTicket(commandJson);

   // Stable leader/source ticket marker used by Reporter v1.55+.
   if(ticket <= 0 && StringLen(sourceTicket) > 0)
      ticket = FindCopiedTradeTicket(sourceTicket);

   // Safe legacy recovery: only close when symbol/side resolves to exactly
   // one WISDO copied position. Never choose one position from several.
   if(ticket <= 0)
      ticket = FindUniqueCopiedTradeByContext(commandJson);

   if(ticket <= 0)
   {
      message = "Close not executed: no unique copied trade matched source " + sourceTicket + ". Expected followerTicket or stable leader ticket.";
      return false;
   }

   if(!OrderSelect(ticket, SELECT_BY_TICKET, MODE_TRADES))
   {
      message = "Could not select copied trade " + IntegerToString(ticket);
      return false;
   }

   int type = OrderType();
   if(type != OP_BUY && type != OP_SELL)
   {
      message = "Matched ticket is not a market position";
      return false;
   }
   double closePrice = (type == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
   closePrice = NormalizeDouble(closePrice, GetPriceDigits(OrderSymbol()));

   ResetLastError();
   bool ok = OrderClose(ticket, OrderLots(), closePrice, CopySlippage, clrOrange);
   if(!ok)
   {
      int err = GetLastError();
      message = "OrderClose failed: " + IntegerToString(err);
      return false;
   }

   message = "Copied trade closed ticket " + IntegerToString(ticket);
   return true;
}



// ========================= CEM ADAPTIVE GLOBAL VARIABLE EXECUTION =========================
// Handles WISDO command: CEM_SET_GLOBALS
// Expected formats supported:
// 1) { "command":"CEM_SET_GLOBALS", "globalName":"CEM.DEADSHOT.__ACCOUNT__.XAUUSD.260408.InpMaxOpenTrades", "value":30 }
// 2) { "command":"CEM_SET_GLOBALS", "key":"CEM.DEADSHOT.__ACCOUNT__.XAUUSD.260408.InpMaxOpenTrades", "value":30 }
// 3) { "command":"CEM_SET_GLOBALS", "globals":[{"name":"CEM.DEADSHOT.__ACCOUNT__.XAUUSD.260408.InpMaxOpenTrades","value":30}] }

string CemReplaceAccountToken(string key)
{
   string out = key;
   StringReplace(out, "__ACCOUNT__", IntegerToString(AccountNumber()));
   StringReplace(out, "{ACCOUNT}", IntegerToString(AccountNumber()));
   StringReplace(out, "<ACCOUNT>", IntegerToString(AccountNumber()));
   return out;
}

bool CemIsSafeGlobalKey(string key)
{
   if(StringLen(key) <= 4)
      return false;
   if(StringFind(key, "CEM.") != 0)
      return false;
   if(StringFind(key, " ") >= 0)
      return false;
   if(StringFind(key, "\n") >= 0 || StringFind(key, "\r") >= 0 || StringFind(key, "\t") >= 0)
      return false;
   return true;
}

bool CemApplyOneGlobal(string rawKey, double value, string &detail)
{
   string key = CemReplaceAccountToken(rawKey);
   StringTrimLeft(key);
   StringTrimRight(key);

   if(!CemIsSafeGlobalKey(key))
   {
      detail = "unsafe/invalid CEM key: " + key;
      return false;
   }

   ResetLastError();
   datetime ok = GlobalVariableSet(key, value);
   if(ok <= 0)
   {
      detail = "GlobalVariableSet failed " + IntegerToString(GetLastError()) + " for " + key;
      return false;
   }

   detail = key + "=" + DoubleToString(value, 8);
   return true;
}

string JsonFindArrayBody(string json, string key)
{
   string pattern = "\"" + key + "\":";
   int pos = StringFind(json, pattern);
   if(pos < 0)
      return "";
   pos += StringLen(pattern);
   while(pos < StringLen(json) && StringGetCharacter(json, pos) <= 32)
      pos++;
   if(pos >= StringLen(json) || StringGetCharacter(json, pos) != '[')
      return "";

   int start = pos + 1;
   int depth = 1;
   bool inString = false;
   bool escaped = false;
   for(int i = start; i < StringLen(json); i++)
   {
      ushort ch = StringGetCharacter(json, i);
      if(inString)
      {
         if(escaped)
         {
            escaped = false;
            continue;
         }
         if(ch == '\\')
         {
            escaped = true;
            continue;
         }
         if(ch == '"')
            inString = false;
         continue;
      }

      if(ch == '"')
      {
         inString = true;
         continue;
      }
      if(ch == '[') depth++;
      if(ch == ']')
      {
         depth--;
         if(depth == 0)
            return StringSubstr(json, start, i - start);
      }
   }
   return "";
}

bool JsonNextObject(string body, int &pos, string &objectText)
{
   while(pos < StringLen(body) && StringGetCharacter(body, pos) != '{')
      pos++;
   if(pos >= StringLen(body))
      return false;

   int start = pos;
   int depth = 0;
   bool inString = false;
   bool escaped = false;

   for(int i = pos; i < StringLen(body); i++)
   {
      ushort ch = StringGetCharacter(body, i);
      if(inString)
      {
         if(escaped)
         {
            escaped = false;
            continue;
         }
         if(ch == '\\')
         {
            escaped = true;
            continue;
         }
         if(ch == '"')
            inString = false;
         continue;
      }

      if(ch == '"')
      {
         inString = true;
         continue;
      }
      if(ch == '{') depth++;
      if(ch == '}')
      {
         depth--;
         if(depth == 0)
         {
            objectText = StringSubstr(body, start, i - start + 1);
            pos = i + 1;
            return true;
         }
      }
   }
   return false;
}

bool ExecuteCemSetGlobalsCommand(string commandJson, string &message, int &ticket)
{
   ticket = -1;
   int applied = 0;
   int failed = 0;
   string details = "";

   // Single-key fallback format.
   string singleKey = JsonGetString(commandJson, "globalName", "");
   if(StringLen(singleKey) == 0) singleKey = JsonGetString(commandJson, "name", "");
   if(StringLen(singleKey) == 0) singleKey = JsonGetString(commandJson, "key", "");
   if(StringLen(singleKey) == 0) singleKey = JsonGetString(commandJson, "globalKey", "");

   if(StringLen(singleKey) > 0)
   {
      double singleValue = JsonGetDouble(commandJson, "value", 0.0);
      string detail = "";
      if(CemApplyOneGlobal(singleKey, singleValue, detail))
         applied++;
      else
         failed++;
      details += detail + "; ";
   }

   // Array format: globals:[{name/key/globalName, value}, ...]
   string body = JsonFindArrayBody(commandJson, "globals");
   int pos = 0;
   string obj = "";
   while(JsonNextObject(body, pos, obj))
   {
      string key = JsonGetString(obj, "globalName", "");
      if(StringLen(key) == 0) key = JsonGetString(obj, "name", "");
      if(StringLen(key) == 0) key = JsonGetString(obj, "key", "");
      if(StringLen(key) == 0) key = JsonGetString(obj, "globalKey", "");
      double value = JsonGetDouble(obj, "value", 0.0);
      string detail2 = "";
      if(CemApplyOneGlobal(key, value, detail2))
         applied++;
      else
         failed++;
      if(StringLen(details) < 260)
         details += detail2 + "; ";
   }

   if(applied <= 0 && failed <= 0)
   {
      message = "CEM_SET_GLOBALS received but no globalName/key/globals payload was found";
      return false;
   }

   message = "Applied " + IntegerToString(applied) + " CEM Global Variable override(s), failed " + IntegerToString(failed) + ". " + details;
   return failed == 0;
}
// ======================= END CEM ADAPTIVE GLOBAL VARIABLE EXECUTION =======================

// ========================= WISDO WAKE WORD DECIPHER + CONTROL COMMANDS =========================
bool TextHas(string text, string token)
{
   string a = text;
   string b = token;
   StringToLower(a);
   StringToLower(b);
   return StringFind(a, b) >= 0;
}

string JsonGetCommandText(string commandJson)
{
   string text = JsonGetString(commandJson, "rawText", "");
   if(StringLen(text) == 0) text = JsonGetString(commandJson, "rawCommand", "");
   if(StringLen(text) == 0) text = JsonGetString(commandJson, "text", "");
   if(StringLen(text) == 0) text = JsonGetString(commandJson, "message", "");
   if(StringLen(text) == 0) text = JsonGetString(commandJson, "prompt", "");
   return text;
}

string ResolveWakeCommand(string command, string commandJson)
{
   string c = command;
   StringToUpper(c);
   if(c != "WISDO_TEXT_COMMAND" && c != "WAKE_CALL" && c != "WAKE_WORD" && c != "VOICE_COMMAND" && c != "COACH_COMMAND")
      return c;

   string text = JsonGetCommandText(commandJson);
   StringToLower(text);

   // Wake words are intentionally broad: hey coach, coach, wisdo, deadshot, culture coin, command center.
   // The system does not need 500k hard-coded phrases; it uses intent families that can cover hundreds of thousands of natural sentence variations.
   if((TextHas(text, "close") || TextHas(text, "collect") || TextHas(text, "secure") || TextHas(text, "grab") || TextHas(text, "take")) &&
      (TextHas(text, "profit") || TextHas(text, "profitable") || TextHas(text, "winner") || TextHas(text, "winning")))
      return "CLOSE_ALL_PROFITS";

   if((TextHas(text, "trim") || TextHas(text, "partial") || TextHas(text, "half") || TextHas(text, "50%")) && TextHas(text, "profit"))
      return "TRIM_PROFITS";

   if((TextHas(text, "emergency") || TextHas(text, "panic") || TextHas(text, "hard stop")) && (TextHas(text, "close") || TextHas(text, "flatten") || TextHas(text, "kill")))
      return "EMERGENCY_CLOSE_ALL";

   if(TextHas(text, "close all") || TextHas(text, "close everything") || TextHas(text, "flatten account") || TextHas(text, "kill all trades"))
      return "CLOSE_ALL_TRADES";

   if(TextHas(text, "close") && (TextHas(text, "loss") || TextHas(text, "losses") || TextHas(text, "loser") || TextHas(text, "losers") || TextHas(text, "losing")))
      return "CLOSE_ALL_LOSERS";

   if((TextHas(text, "pause") || TextHas(text, "stop trading") || TextHas(text, "stop entries") || TextHas(text, "freeze")) && !TextHas(text, "resume"))
      return TextHas(text, "copier") ? "PAUSE_COPIER" : "PAUSE_TRADING";

   if(TextHas(text, "resume") || TextHas(text, "start trading") || TextHas(text, "start entries") || TextHas(text, "unpause"))
      return TextHas(text, "copier") ? "RESUME_COPIER" : "RESUME_TRADING";

   if(TextHas(text, "walk away") || TextHas(text, "walkaway"))
      return "WALK_AWAY_MODE";

   if(TextHas(text, "lock profit") || TextHas(text, "equity floor") || TextHas(text, "protect profit"))
      return "LOCK_PROFIT";

   if(TextHas(text, "buy") || TextHas(text, "sell"))
      return "MARKET_ORDER";

   return "CEM_SET_GLOBALS";
}

bool ExecuteWisdoControlCommand(string command, string commandJson, string &message, int &ticket)
{
   ticket = -1;
   string c = command;
   StringToUpper(c);
   if(c == "PAUSE_TRADING" || c == "EMERGENCY_STOP" || c == "STOP_ENTRIES")
   {
      GlobalVariableSet("WISDO_TRADING_PAUSED", 1);
      GlobalVariableSet("WISDO_LAST_CONTROL_AT", TimeCurrent());
      message = "WISDO trading pause flag set in MT4 Global Variables. Bots must read WISDO_TRADING_PAUSED to stop entries.";
      return true;
   }
   if(c == "RESUME_TRADING" || c == "START_ENTRIES")
   {
      GlobalVariableSet("WISDO_TRADING_PAUSED", 0);
      GlobalVariableSet("WISDO_LAST_CONTROL_AT", TimeCurrent());
      message = "WISDO trading pause flag cleared in MT4 Global Variables.";
      return true;
   }
   if(c == "PAUSE_COPIER")
   {
      GlobalVariableSet("WISDO_COPIER_PAUSED", 1);
      GlobalVariableSet("WISDO_LAST_CONTROL_AT", TimeCurrent());
      message = "WISDO copier pause flag set in MT4 Global Variables.";
      return true;
   }
   if(c == "RESUME_COPIER")
   {
      GlobalVariableSet("WISDO_COPIER_PAUSED", 0);
      GlobalVariableSet("WISDO_LAST_CONTROL_AT", TimeCurrent());
      message = "WISDO copier pause flag cleared in MT4 Global Variables.";
      return true;
   }
   if(c == "SET_BOT_MODE" || c == "SET_RISK_MODE")
   {
      string mode = JsonGetString(commandJson, "mode", JsonGetString(commandJson, "botMode", JsonGetString(commandJson, "riskMode", "")));
      double modeCode = 0;
      string m = mode; StringToLower(m);
      if(TextHas(m, "conservative")) modeCode = 1;
      else if(TextHas(m, "aggressive")) modeCode = 2;
      else if(TextHas(m, "protect")) modeCode = 3;
      else if(TextHas(m, "manual")) modeCode = 4;
      else if(TextHas(m, "consolidation")) modeCode = 5;
      GlobalVariableSet("WISDO_MODE_CODE", modeCode);
      GlobalVariableSet("WISDO_LAST_CONTROL_AT", TimeCurrent());
      message = "WISDO mode code updated to " + DoubleToString(modeCode, 0) + " from text mode '" + mode + "'.";
      return true;
   }
   message = "Unsupported WISDO control command: " + command;
   return false;
}
// ======================= END WISDO WAKE WORD DECIPHER + CONTROL COMMANDS =======================

// Forward declaration used by account-refresh commands.
void SendSnapshot();

bool ExecuteSyncAccountCommand(string commandJson, string &message, int &ticket)
{
   ticket = -1;
   SendSnapshot();
   g_lastSnapshotAt = TimeCurrent();

   if(g_lastStatus == "Connected")
   {
      message = "Account synchronized: " + IntegerToString(AccountNumber()) +
                " | Balance " + DoubleToString(AccountBalance(), 2) +
                " | Equity " + DoubleToString(AccountEquity(), 2) +
                " | Open trades " + IntegerToString(OrdersTotal());
      return true;
   }

   message = "Account synchronization failed";
   if(StringLen(g_lastError) > 0)
      message += ": " + g_lastError;
   return false;
}

void PollAndExecuteCommands()
{
   if(!ValidateInputs())
      return;

   string pollUrl = ResolveCommandPollUrl();
   if(StringLen(pollUrl) == 0)
      return;
   if(!NetworkAttemptAllowed())
      return;

   string payload = "{";
   payload += "\"pairingCode\":\"" + EscapeJson(PairingCode) + "\",";
   payload += "\"accountNumber\":" + IntegerToString(AccountNumber());
   payload += "}";

   char postData[];
   char result[];
   string resultHeaders = "";
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(ApiKey) > 0)
      headers += "X-CultureCoin-ApiKey: " + ApiKey + "\r\n";

   int payloadSize = StringToCharArray(payload, postData, 0, -1, CP_UTF8);
   if(payloadSize > 0)
      ArrayResize(postData, payloadSize - 1);

   ResetLastError();
   int httpCode = WebRequest("POST", pollUrl, headers, 10000, postData, result, resultHeaders);
   if(httpCode == -1)
   {
      int errorCode = GetLastError();
      MarkNetworkFailure("Command poll", "WebRequest failed (" + IntegerToString(errorCode) + ")", errorCode);
      UpdateStatusLabel();
      return;
   }

   string response = CharArrayToString(result);
   if(httpCode < 200 || httpCode >= 300)
   {
      MarkNetworkFailure("Command poll", "HTTP " + IntegerToString(httpCode) + " " + TruncateText(response, 60), httpCode);
      UpdateStatusLabel();
      return;
   }

   MarkNetworkSuccess("Command poll");
   g_lastCommandPollAt = TimeCurrent();
   bool hasCommand = JsonGetBool(response, "hasCommand", false);
   if(!hasCommand)
      return;

   string command = JsonGetString(response, "command", "");
   string originalCommand = command;
   command = ResolveWakeCommand(command, response);
   string commandId = JsonGetString(response, "commandId", JsonGetString(response, "id", ""));
   string message = "";
   int ticket = -1;
   bool success = false;

   g_lastCommandPollAt = TimeCurrent();
   g_lastCommand = command;
   g_lastCommandId = commandId;

   if(command == "SYNC_ACCOUNT" || command == "ACCOUNT_SYNC" || command == "REFRESH_ACCOUNT" || command == "REQUEST_SNAPSHOT" || command == "SYNC_NOW")
      success = ExecuteSyncAccountCommand(response, message, ticket);
   else if(command == "COPY_OPEN_TRADE")
      success = ExecuteCopyOpenTrade(response, message, ticket);
   else if(command == "COPY_CLOSE_TRADE")
      success = ExecuteCopyCloseTrade(response, message, ticket);
   else if(command == "OPEN_TRADE" || command == "PLACE_TRADE" || command == "MANUAL_OPEN_TRADE" || command == "TAKE_TRADE" || command == "EXECUTE_TRADE" || command == "MARKET_ORDER")
      success = ExecuteManualOpenTrade(response, message, ticket);
   else if(command == "CLOSE_TRADE" || command == "MANUAL_CLOSE_TRADE" || command == "CLOSE_MANUAL_TRADE")
      success = ExecuteManualCloseTrade(response, message, ticket);
   else if(command == "CLOSE_ALL_PROFITS" || command == "CLOSE_ALL_WINNERS" || command == "TRIM_PROFITS" || command == "PARTIAL_CLOSE_WINNERS" || command == "PARTIAL_CLOSE_BASKET" || command == "CLOSE_ALL_LOSERS" || command == "CLOSE_ALL_TRADES" || command == "EMERGENCY_CLOSE_ALL" || command == "CLOSE_BY_SYMBOL" || command == "CLOSE_BY_MAGIC" || command == "CLOSE_BASKET" || command == "CLOSE_BY_BOT" || command == "SET_EQUITY_FLOOR" || command == "LOCK_PROFIT" || command == "WALK_AWAY_MODE")
      success = ExecuteProfitManagerCommand(command, response, message, ticket);
   else if(command == "PAUSE_TRADING" || command == "RESUME_TRADING" || command == "PAUSE_COPIER" || command == "RESUME_COPIER" || command == "EMERGENCY_STOP" || command == "STOP_ENTRIES" || command == "START_ENTRIES" || command == "SET_BOT_MODE" || command == "SET_RISK_MODE")
      success = ExecuteWisdoControlCommand(command, response, message, ticket);
   else if(command == "CEM_SET_GLOBALS")
      success = ExecuteCemSetGlobalsCommand(response, message, ticket);
   else
   {
      message = "Unsupported command for reporter execution: " + command;
      success = false;
   }

   g_lastCopyMessage = message;
   g_lastCopyTicket = ticket;

   string completeResult = SendCommandComplete(commandId, success, message, ticket);
   Print("CultureCoin command ", originalCommand, " resolved ", command, " -> ", message, " | ", completeResult);
   if(success)
   {
      if(g_lastStatus != "Connected") MarkNetworkSuccess("Command completion");
   }
   else
   {
      // A broker/order rejection is a command result, not a network disconnect.
      g_lastCopyMessage = message;
   }
   UpdateStatusLabel();
}

void SendSnapshot()
{
   if(!ValidateInputs())
      return;

   if(!NetworkAttemptAllowed())
   {
      UpdateStatusLabel();
      return;
   }

   if(g_lastNetworkSuccessAt == 0) g_lastStatus = "Connecting";
   UpdateStatusLabel();

   string payload = BuildPayload();
   char postData[];
   char result[];
   string resultHeaders = "";
   string headers = "Content-Type: application/json\r\n";

   if(StringLen(ApiKey) > 0)
      headers += "X-CultureCoin-ApiKey: " + ApiKey + "\r\n";

   int payloadSize = StringToCharArray(payload, postData, 0, -1, CP_UTF8);
   if(payloadSize > 0)
      ArrayResize(postData, payloadSize - 1);

   ResetLastError();
   int httpCode = WebRequest("POST", SyncUrl, headers, 10000, postData, result, resultHeaders);

   if(httpCode == -1)
   {
      int errorCode = GetLastError();
      MarkNetworkFailure("Snapshot", "WebRequest failed (" + IntegerToString(errorCode) + ")", errorCode);
      UpdateStatusLabel();
      return;
   }

   if(httpCode >= 200 && httpCode < 300)
   {
      MarkNetworkSuccess("Snapshot");
      g_lastSendAt = TimeCurrent();
   }
   else
   {
      string responseText = CharArrayToString(result);
      MarkNetworkFailure("Snapshot", "HTTP " + IntegerToString(httpCode) + " " + TruncateText(responseText, 60), httpCode);
   }

   UpdateStatusLabel();
}

int OnInit()
{
   int exportInterval = CommandPollEverySeconds;
   if(exportInterval < 1) exportInterval = 1;
   if(ExportEverySeconds > 0 && ExportEverySeconds < exportInterval) exportInterval = ExportEverySeconds;

   EventSetTimer(exportInterval);
   g_lastStatus = "Waiting";
   g_lastError = "";
   g_lastCommand = "";
   g_lastCommandId = "";
   g_lastCopyMessage = "";
   g_lastCopyTicket = -1;
   g_consecutiveNetworkFailures = 0;
   g_lastNetworkErrorCode = 0;
   g_lastNetworkSuccessAt = 0;
   g_nextNetworkAttemptAt = 0;
   g_lastNetworkSource = "";
   UpdateStatusLabel();

   Print("CultureCoin Reporter V" + REPORTER_VERSION + " initialized with resilient heartbeat/backoff, immediate account sync, atomic basket sweep, close-authority ticket binding, and WISDO control dashboard.");
   Print("Copy trading execution: ", EnableCopyTrading ? "ENABLED" : "DISABLED");
   Print("Sync URL: ", SyncUrl);
   Print("Command poll URL: ", ResolveCommandPollUrl());

   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   DeleteDashboardObjects();
}

void OnTimer()
{
   datetime now = TimeCurrent();

   if(PollCommandsBeforeSnapshot && (g_lastFastPollAt == 0 || now - g_lastFastPollAt >= CommandPollEverySeconds))
   {
      int loops = CommandsPerPollTick;
      if(loops < 1) loops = 1;
      if(loops > 10) loops = 10;
      for(int i = 0; i < loops; i++)
         PollAndExecuteCommands();
      g_lastFastPollAt = now;
   }

   if(g_lastSnapshotAt == 0 || now - g_lastSnapshotAt >= ExportEverySeconds)
   {
      SendSnapshot();
      g_lastSnapshotAt = now;
   }

   if(!PollCommandsBeforeSnapshot && (g_lastFastPollAt == 0 || now - g_lastFastPollAt >= CommandPollEverySeconds))
   {
      PollAndExecuteCommands();
      g_lastFastPollAt = now;
   }

   UpdateStatusLabel();
}
