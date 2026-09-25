//+------------------------------------------------------------------+
//| HIGHTOWER_TRIANGLE_FLOW_OS_v1_4_Trend_Cloud_Transition.mq4      |
//| Trend Attack + Rapid Cloud Harvest + Transition Defense engine |
//+------------------------------------------------------------------+
#property strict
#property version "1.52"

enum Direction { DIR_SELL=-1, DIR_FLAT=0, DIR_BUY=1 };
enum GeoMode
{
   GEO_OFF=0, GEO_HOLD, GEO_LADDER, GEO_STRONG_LADDER,
   GEO_DRAWDOWN, GEO_STRONG_DRAWDOWN, GEO_EXHAUSTION, GEO_INVALID
};

enum HT_TargetMode { HT_QUICK_CAPTURE=0, HT_BALANCED_CAMPAIGN=1, HT_MAXIMUM_TREND=2 };
enum CampaignState
{
   CS_FLAT=0, CS_ARMED, CS_ANCHOR, CS_PROVING, CS_LADDER,
   CS_STRONG_LADDER, CS_HOLD, CS_EXHAUSTION, CS_DRAWDOWN,
   CS_STRONG_DRAWDOWN, CS_INVALID, CS_FLIP_ARMED
};

// Simplified user controls. Advanced behavior is resolved internally from these presets.
// v1.19 evaluation build keeps confirmed WEIGHT-arrow risk controls and adds testable anti-overtrade gates.
// The current weight minus the previous live weight determines BUY, SELL, or FLAT.
// Risk remains controlled only by the selected percentage. A selection of 1 means
// exactly 1% of the selected account basis is placed at risk at the actual SL.
enum HT_MasterControl
{
   MASTER_OFF=0,
   MASTER_MANAGE_OPEN_TRADES_ONLY=1,
   MASTER_BUY_AND_SELL=2,
   MASTER_BUY_ONLY=3,
   MASTER_SELL_ONLY=4
};
enum HT_TradeFrequencyControl
{
   TRADE_MORE_OFTEN=0,
   TRADE_BALANCED=1,
   TRADE_SELECTIVE=2
};
enum HT_SetupControl
{
   SETUP_AUTO_ALL=0,
   SETUP_FVG_ONLY=1,
   SETUP_BREAKOUT_ONLY=2,
   SETUP_MOMENTUM_ONLY=3
};
enum HT_RiskPercent
{
   RISK_01_PERCENT=1,
   RISK_02_PERCENT=2,
   RISK_03_PERCENT=3,
   RISK_04_PERCENT=4,
   RISK_05_PERCENT=5,
   RISK_06_PERCENT=6,
   RISK_07_PERCENT=7,
   RISK_08_PERCENT=8,
   RISK_09_PERCENT=9,
   RISK_10_PERCENT=10,
   RISK_11_PERCENT=11,
   RISK_12_PERCENT=12,
   RISK_13_PERCENT=13,
   RISK_14_PERCENT=14,
   RISK_15_PERCENT=15,
   RISK_16_PERCENT=16,
   RISK_17_PERCENT=17,
   RISK_18_PERCENT=18,
   RISK_19_PERCENT=19,
   RISK_20_PERCENT=20,
   RISK_21_PERCENT=21,
   RISK_22_PERCENT=22,
   RISK_23_PERCENT=23,
   RISK_24_PERCENT=24,
   RISK_25_PERCENT=25,
   RISK_26_PERCENT=26,
   RISK_27_PERCENT=27,
   RISK_28_PERCENT=28,
   RISK_29_PERCENT=29,
   RISK_30_PERCENT=30,
   RISK_31_PERCENT=31,
   RISK_32_PERCENT=32,
   RISK_33_PERCENT=33,
   RISK_34_PERCENT=34,
   RISK_35_PERCENT=35,
   RISK_36_PERCENT=36,
   RISK_37_PERCENT=37,
   RISK_38_PERCENT=38,
   RISK_39_PERCENT=39,
   RISK_40_PERCENT=40,
   RISK_41_PERCENT=41,
   RISK_42_PERCENT=42,
   RISK_43_PERCENT=43,
   RISK_44_PERCENT=44,
   RISK_45_PERCENT=45,
   RISK_46_PERCENT=46,
   RISK_47_PERCENT=47,
   RISK_48_PERCENT=48,
   RISK_49_PERCENT=49,
   RISK_50_PERCENT=50,
   RISK_51_PERCENT=51,
   RISK_52_PERCENT=52,
   RISK_53_PERCENT=53,
   RISK_54_PERCENT=54,
   RISK_55_PERCENT=55,
   RISK_56_PERCENT=56,
   RISK_57_PERCENT=57,
   RISK_58_PERCENT=58,
   RISK_59_PERCENT=59,
   RISK_60_PERCENT=60,
   RISK_61_PERCENT=61,
   RISK_62_PERCENT=62,
   RISK_63_PERCENT=63,
   RISK_64_PERCENT=64,
   RISK_65_PERCENT=65,
   RISK_66_PERCENT=66,
   RISK_67_PERCENT=67,
   RISK_68_PERCENT=68,
   RISK_69_PERCENT=69,
   RISK_70_PERCENT=70,
   RISK_71_PERCENT=71,
   RISK_72_PERCENT=72,
   RISK_73_PERCENT=73,
   RISK_74_PERCENT=74,
   RISK_75_PERCENT=75,
   RISK_76_PERCENT=76,
   RISK_77_PERCENT=77,
   RISK_78_PERCENT=78,
   RISK_79_PERCENT=79,
   RISK_80_PERCENT=80,
   RISK_81_PERCENT=81,
   RISK_82_PERCENT=82,
   RISK_83_PERCENT=83,
   RISK_84_PERCENT=84,
   RISK_85_PERCENT=85,
   RISK_86_PERCENT=86,
   RISK_87_PERCENT=87,
   RISK_88_PERCENT=88,
   RISK_89_PERCENT=89,
   RISK_90_PERCENT=90,
   RISK_91_PERCENT=91,
   RISK_92_PERCENT=92,
   RISK_93_PERCENT=93,
   RISK_94_PERCENT=94,
   RISK_95_PERCENT=95,
   RISK_96_PERCENT=96,
   RISK_97_PERCENT=97,
   RISK_98_PERCENT=98,
   RISK_99_PERCENT=99,
   RISK_100_PERCENT=100
};
enum HT_AccountBasis
{
   RISK_FROM_BALANCE=0,
   RISK_FROM_EQUITY=1,
   RISK_FROM_FREE_MARGIN=2
};
enum HT_StopControl
{
   STOP_WIDER_OF_STRUCTURE_OR_ATR=0,
   STOP_ATR=1,
   STOP_STRUCTURE=2,
   STOP_FIXED_POINTS=3
};

// ATR multiplier used to convert the current 14-period ATR into stop distance.
// Values are stored as hundredths so MT4 can display them as a dropdown.
enum HT_ATRStopMultiplier
{
   ATR_SL_0_50_X=50,
   ATR_SL_0_75_X=75,
   ATR_SL_1_00_X=100,
   ATR_SL_1_25_X=125,
   ATR_SL_1_50_X=150,
   ATR_SL_1_75_X=175,
   ATR_SL_2_00_X=200,
   ATR_SL_2_50_X=250,
   ATR_SL_3_00_X=300,
   ATR_SL_3_50_X=350,
   ATR_SL_4_00_X=400,
   ATR_SL_5_00_X=500,
   ATR_SL_6_00_X=600,
   ATR_SL_8_00_X=800,
   ATR_SL_10_00_X=1000
};
enum HT_ScaleInControl
{
   SCALE_IN_OFF=0,
   SCALE_IN_ONE_ADD=1,
   SCALE_IN_BALANCED=2,
   SCALE_IN_ACTIVE=3
};
enum HT_ExitControl
{
   EXIT_QUICK=0,
   EXIT_BALANCED=1,
   EXIT_MAXIMUM_TREND=2
};

// Minimum time before the EA may use discretionary software exits.
// HOLD_UNTIL_SL_OR_TP is strict: no EA-driven OrderClose is permitted.
// Only the broker-side stop-loss or take-profit may close an open position.
enum HT_HoldControl
{
   HOLD_NO_MINIMUM=0,
   HOLD_3_SIGNAL_BARS=3,
   HOLD_6_SIGNAL_BARS=6,
   HOLD_12_SIGNAL_BARS=12,
   HOLD_24_SIGNAL_BARS=24,
   HOLD_48_SIGNAL_BARS=48,
   HOLD_UNTIL_SL_OR_TP=999
};
enum HT_VisualControl
{
   VISUAL_OFF=0,
   VISUAL_DASHBOARD=1,
   VISUAL_DIAGNOSTIC=2
};

// Fixed take-profit distance expressed as a multiple of the protective stop distance.
enum HT_TakeProfitRatio
{
   TP_RATIO_OFF=0,
   TP_RATIO_0_5_TO_1=5,
   TP_RATIO_1_TO_1=10,
   TP_RATIO_1_5_TO_1=15,
   TP_RATIO_2_TO_1=20,
   TP_RATIO_2_5_TO_1=25,
   TP_RATIO_3_TO_1=30,
   TP_RATIO_4_TO_1=40,
   TP_RATIO_5_TO_1=50,
   TP_RATIO_10_TO_1=100
};

enum HT_EarlyEntryControl
{
   EARLY_ENTRY_OFF=0,
   EARLY_ENTRY_ZERO_DEGREE_BREAK=1
};

// The red WEIGHT arrow can replace the legacy setup engine.
// EVERY_TICK attempts one new order on every market tick in the arrow direction.
enum HT_ArrowEntryControl
{
   ARROW_ENTRY_OFF_USE_SETUPS=0,
   ARROW_ENTRY_FIRST_ONLY=1,
   ARROW_ENTRY_EVERY_TICK=2
};

// Minimum normalized WEIGHT movement required before the live arrow has a direction.
// Values are stored as slope x 100000 so they remain enum dropdown selections.
enum HT_ArrowMinimumSlope
{
   ARROW_SLOPE_ANY_NONZERO=0,
   ARROW_SLOPE_0_00005=5,
   ARROW_SLOPE_0_00010=10,
   ARROW_SLOPE_0_00025=25,
   ARROW_SLOPE_0_00050=50,
   ARROW_SLOPE_0_00100=100,
   ARROW_SLOPE_0_00250=250,
   ARROW_SLOPE_0_00500=500
};

// Consecutive live ticks required before an arrow direction is considered tradable.
enum HT_ArrowConfirmationTicks
{
   ARROW_CONFIRM_1_TICK=1,
   ARROW_CONFIRM_2_TICKS=2,
   ARROW_CONFIRM_3_TICKS=3,
   ARROW_CONFIRM_5_TICKS=5,
   ARROW_CONFIRM_8_TICKS=8,
   ARROW_CONFIRM_10_TICKS=10
};

// Hard user limit for the number of entries in one arrow campaign.
enum HT_MaximumArrowEntries
{
   MAX_ARROW_ENTRIES_1=1,
   MAX_ARROW_ENTRIES_2=2,
   MAX_ARROW_ENTRIES_3=3,
   MAX_ARROW_ENTRIES_4=4,
   MAX_ARROW_ENTRIES_5=5
};

// Controls whether a stopped grid add-on permanently freezes further additions.
enum HT_GridStopControl
{
   GRID_CONTINUE_AFTER_ADDON_SL=0,
   GRID_STOP_AFTER_FIRST_ADDON_SL=1
};

// Optional software exit when the live arrow reverses for the selected number of ticks.
// This explicit user selection is allowed to override HOLD_UNTIL_SL_OR_TP.
enum HT_ArrowReversalExitControl
{
   ARROW_REVERSAL_EXIT_OFF=0,
   ARROW_REVERSAL_EXIT_2_TICKS=2,
   ARROW_REVERSAL_EXIT_3_TICKS=3,
   ARROW_REVERSAL_EXIT_5_TICKS=5,
   ARROW_REVERSAL_EXIT_8_TICKS=8,
   ARROW_REVERSAL_EXIT_10_TICKS=10
};

// Arithmetic progression controls the spacing of entries along the route to TP.
// It never changes the selected risk percentage or the calculated lot size.
enum HT_ArithmeticSpacingStep
{
   ARITH_STEP_0_00_R=0,
   ARITH_STEP_0_05_R=5,
   ARITH_STEP_0_10_R=10,
   ARITH_STEP_0_25_R=25,
   ARITH_STEP_0_50_R=50,
   ARITH_STEP_1_00_R=100
};

// Margin safety controls whether an exact percentage-sized order may be opened.
// It may block an order, but it may never reduce or replace the selected percentage.
enum HT_MarginSafetyControl
{
   MARGIN_SAFETY_CONSERVATIVE=0,
   MARGIN_SAFETY_BALANCED=1,
   MARGIN_SAFETY_ACTIVE=2,
   MARGIN_SAFETY_OFF_LEGACY=3
};

enum HT_ReversalExposureControl
{
   REVERSAL_WAIT_FOR_FLAT=0,
   REVERSAL_ALLOW_HEDGE=1
};

enum HT_IchimokuFilter
{
   ICHIMOKU_FILTER_OFF=0,
   ICHIMOKU_PRICE_OUTSIDE_CLOUD=1,
   ICHIMOKU_STRICT_TREND=2
};

// Trend Attack already runs only in MARKET_TREND. This dropdown controls
// whether being on the correct side of the live Kumo is enough, or whether
// the older strict Tenkan/Kijun + cloud-orientation confirmation is also required.
enum HT_TrendEntryFilterControl
{
   TREND_FILTER_CLOUD_SIDE_ONLY=0,
   TREND_FILTER_STRICT_ICHIMOKU=1
};

// Outside-cloud Trend Attack signal source.
// RAW restores the original rapid-fire behavior: every tick whose live WEIGHT
// slope exceeds the selected threshold can trigger in the cloud-side direction.
// CONFIRMED requires the selected consecutive ArrowConfirmationTicks.
enum HT_TrendArrowSignalControl
{
   TREND_ARROW_RAW_QUALIFYING_TICK=0,
   TREND_ARROW_CONFIRMED_TICKS=1
};

// Daily entry start time, evaluated using the broker/server clock.
// Existing trades continue to be managed before this time; only new orders are blocked.
enum HT_StartTradingTime
{
   START_ANY_TIME=24,
   START_AT_00_00=0,
   START_AT_01_00=1,
   START_AT_02_00=2,
   START_AT_03_00=3,
   START_AT_04_00=4,
   START_AT_05_00=5,
   START_AT_06_00=6,
   START_AT_07_00=7,
   START_AT_08_00=8,
   START_AT_09_00=9,
   START_AT_10_00=10,
   START_AT_11_00=11,
   START_AT_12_00=12,
   START_AT_13_00=13,
   START_AT_14_00=14,
   START_AT_15_00=15,
   START_AT_16_00=16,
   START_AT_17_00=17,
   START_AT_18_00=18,
   START_AT_19_00=19,
   START_AT_20_00=20,
   START_AT_21_00=21,
   START_AT_22_00=22,
   START_AT_23_00=23
};

// Minute component for the daily broker/server start time.
// Every minute from 00 through 59 is available for exact control.
enum HT_StartTradingMinute
{
   START_MINUTE_00=0,
   START_MINUTE_01=1,
   START_MINUTE_02=2,
   START_MINUTE_03=3,
   START_MINUTE_04=4,
   START_MINUTE_05=5,
   START_MINUTE_06=6,
   START_MINUTE_07=7,
   START_MINUTE_08=8,
   START_MINUTE_09=9,
   START_MINUTE_10=10,
   START_MINUTE_11=11,
   START_MINUTE_12=12,
   START_MINUTE_13=13,
   START_MINUTE_14=14,
   START_MINUTE_15=15,
   START_MINUTE_16=16,
   START_MINUTE_17=17,
   START_MINUTE_18=18,
   START_MINUTE_19=19,
   START_MINUTE_20=20,
   START_MINUTE_21=21,
   START_MINUTE_22=22,
   START_MINUTE_23=23,
   START_MINUTE_24=24,
   START_MINUTE_25=25,
   START_MINUTE_26=26,
   START_MINUTE_27=27,
   START_MINUTE_28=28,
   START_MINUTE_29=29,
   START_MINUTE_30=30,
   START_MINUTE_31=31,
   START_MINUTE_32=32,
   START_MINUTE_33=33,
   START_MINUTE_34=34,
   START_MINUTE_35=35,
   START_MINUTE_36=36,
   START_MINUTE_37=37,
   START_MINUTE_38=38,
   START_MINUTE_39=39,
   START_MINUTE_40=40,
   START_MINUTE_41=41,
   START_MINUTE_42=42,
   START_MINUTE_43=43,
   START_MINUTE_44=44,
   START_MINUTE_45=45,
   START_MINUTE_46=46,
   START_MINUTE_47=47,
   START_MINUTE_48=48,
   START_MINUTE_49=49,
   START_MINUTE_50=50,
   START_MINUTE_51=51,
   START_MINUTE_52=52,
   START_MINUTE_53=53,
   START_MINUTE_54=54,
   START_MINUTE_55=55,
   START_MINUTE_56=56,
   START_MINUTE_57=57,
   START_MINUTE_58=58,
   START_MINUTE_59=59
};

// v1.19 evaluation entry-window and anti-overtrade controls.
// They are independent dropdowns so each theory can be isolated in Strategy Tester.
enum HT_EntryHoursControl
{
   ENTRY_HOURS_ANY=0,
   ENTRY_HOURS_START_ONLY=1,
   ENTRY_HOURS_STRONG_17_TO_18=2,
   ENTRY_HOURS_CUSTOM_WINDOW=3
};

enum HT_ReentryDelayControl
{
   REENTRY_DELAY_OFF=0,
   REENTRY_DELAY_15_SECONDS=15,
   REENTRY_DELAY_30_SECONDS=30,
   REENTRY_DELAY_60_SECONDS=60,
   REENTRY_DELAY_120_SECONDS=120,
   REENTRY_DELAY_300_SECONDS=300
};

enum HT_MaxTradesPerHourControl
{
   MAX_TRADES_PER_HOUR_OFF=0,
   MAX_TRADES_PER_HOUR_5=5,
   MAX_TRADES_PER_HOUR_10=10,
   MAX_TRADES_PER_HOUR_20=20,
   MAX_TRADES_PER_HOUR_30=30,
   MAX_TRADES_PER_HOUR_50=50,
   MAX_TRADES_PER_HOUR_100=100
};

enum HT_MaxTradesPerDirectionControl
{
   MAX_DIRECTION_TRADES_OFF=0,
   MAX_DIRECTION_TRADES_1=1,
   MAX_DIRECTION_TRADES_2=2,
   MAX_DIRECTION_TRADES_3=3,
   MAX_DIRECTION_TRADES_5=5,
   MAX_DIRECTION_TRADES_10=10,
   MAX_DIRECTION_TRADES_20=20
};

enum HT_LossStreakControl
{
   LOSS_STREAK_FILTER_OFF=0,
   LOSS_STREAK_AFTER_2=2,
   LOSS_STREAK_AFTER_3=3,
   LOSS_STREAK_AFTER_4=4,
   LOSS_STREAK_AFTER_5=5
};

enum HT_LossStreakSlopeMultiplier
{
   LOSS_SLOPE_1_25_X=125,
   LOSS_SLOPE_1_50_X=150,
   LOSS_SLOPE_2_00_X=200,
   LOSS_SLOPE_3_00_X=300
};

enum HT_LossStreakExtraConfirm
{
   LOSS_CONFIRM_EXTRA_0=0,
   LOSS_CONFIRM_EXTRA_2=2,
   LOSS_CONFIRM_EXTRA_5=5,
   LOSS_CONFIRM_EXTRA_8=8,
   LOSS_CONFIRM_EXTRA_10=10
};

enum HT_MaximumLotCeilingControl
{
   LOT_CEILING_OFF=0,
   LOT_CEILING_0_10=10,
   LOT_CEILING_0_25=25,
   LOT_CEILING_0_50=50,
   LOT_CEILING_1_00=100,
   LOT_CEILING_2_00=200,
   LOT_CEILING_5_00=500,
   LOT_CEILING_10_00=1000,
   LOT_CEILING_25_00=2500,
   LOT_CEILING_50_00=5000,
   LOT_CEILING_100_00=10000
};

// Optional realism ceiling. It BLOCKS an oversized exact-risk order; it never
// shrinks the lot because that would change the user-selected risk percentage.
enum HT_ChopDetectionControl
{
   CHOP_FILTER_OFF=0,
   CHOP_3_FLIPS_IN_5_MIN=1,
   CHOP_4_FLIPS_IN_10_MIN=2,
   CHOP_5_FLIPS_IN_15_MIN=3
};

enum HT_ChopPauseControl
{
   CHOP_PAUSE_60_SECONDS=60,
   CHOP_PAUSE_120_SECONDS=120,
   CHOP_PAUSE_300_SECONDS=300,
   CHOP_PAUSE_600_SECONDS=600,
   CHOP_PAUSE_900_SECONDS=900
};

// Regime controller. AUTO is the recommended operating mode.
enum HT_RegimeControl
{
   REGIME_AUTO_TREND_CLOUD_TRANSITION=0,
   REGIME_TREND_ATTACK_ONLY=1,
   REGIME_CLOUD_HARVEST_ONLY=2,
   REGIME_TREND_PLUS_FORCE_CLOUD_HARVEST=3
};

enum HT_ConsolidationSensitivity
{
   CONSOLIDATION_EARLY_SCORE_4=4,
   CONSOLIDATION_BALANCED_SCORE_5=5,
   CONSOLIDATION_STRICT_SCORE_6=6
};

enum HT_CloudMinimumBars
{
   CLOUD_INSIDE_1_BAR=1,
   CLOUD_INSIDE_3_BARS=3,
   CLOUD_INSIDE_5_BARS=5,
   CLOUD_INSIDE_8_BARS=8
};

enum HT_CloudEntryZone
{
   CLOUD_ZONE_20_PERCENT=20,
   CLOUD_ZONE_25_PERCENT=25,
   CLOUD_ZONE_30_PERCENT=30,
   CLOUD_ZONE_35_PERCENT=35
};

enum HT_CloudQuickProfitTarget
{
   CLOUD_QUICK_TP_MIDPOINT=0,
   CLOUD_QUICK_TP_0_25_R=25,
   CLOUD_QUICK_TP_0_50_R=50
};

enum HT_CloudMaxHoldTime
{
   CLOUD_MAX_HOLD_OFF=0,
   CLOUD_MAX_HOLD_30_SECONDS=30,
   CLOUD_MAX_HOLD_60_SECONDS=60,
   CLOUD_MAX_HOLD_120_SECONDS=120,
   CLOUD_MAX_HOLD_300_SECONDS=300
};

enum HT_CloudExitOnRegimeChange
{
   CLOUD_REGIME_CHANGE_HOLD=0,
   CLOUD_REGIME_CHANGE_CLOSE=1
};

enum HT_CloudReversalExitControl
{
   CLOUD_REVERSAL_EXIT_OFF=0,
   CLOUD_REVERSAL_EXIT_1_TICK=1,
   CLOUD_REVERSAL_EXIT_2_TICKS=2,
   CLOUD_REVERSAL_EXIT_3_TICKS=3
};

enum HT_CloudATRBuffer
{
   CLOUD_BUFFER_0_10_ATR=10,
   CLOUD_BUFFER_0_25_ATR=25,
   CLOUD_BUFFER_0_50_ATR=50,
   CLOUD_BUFFER_0_75_ATR=75,
   CLOUD_BUFFER_1_00_ATR=100
};

enum HT_CloudReentryDelay
{
   CLOUD_REENTRY_OFF=0,
   CLOUD_REENTRY_5_SECONDS=5,
   CLOUD_REENTRY_10_SECONDS=10,
   CLOUD_REENTRY_15_SECONDS=15,
   CLOUD_REENTRY_30_SECONDS=30
};

enum HT_CloudTradesPerMinute
{
   CLOUD_TRADES_PER_MINUTE_1=1,
   CLOUD_TRADES_PER_MINUTE_3=3,
   CLOUD_TRADES_PER_MINUTE_5=5,
   CLOUD_TRADES_PER_MINUTE_10=10
};

enum HT_CloudLossProtection
{
   CLOUD_LOSS_FILTER_OFF=0,
   CLOUD_PAUSE_AFTER_1_LOSS=1,
   CLOUD_PAUSE_AFTER_2_LOSSES=2,
   CLOUD_PAUSE_AFTER_3_LOSSES=3
};

enum HT_CloudLossPause
{
   CLOUD_LOSS_PAUSE_60_SECONDS=60,
   CLOUD_LOSS_PAUSE_300_SECONDS=300,
   CLOUD_LOSS_PAUSE_600_SECONDS=600,
   CLOUD_LOSS_PAUSE_900_SECONDS=900
};

enum HT_CloudEquityFloor
{
   CLOUD_EQUITY_FLOOR_OFF=0,
   CLOUD_EQUITY_FLOOR_2_PERCENT=2,
   CLOUD_EQUITY_FLOOR_5_PERCENT=5,
   CLOUD_EQUITY_FLOOR_10_PERCENT=10,
   CLOUD_EQUITY_FLOOR_15_PERCENT=15
};

enum HT_TransitionDefenseControl
{
   TRANSITION_MANAGE_OPEN_TRADES_ONLY=0,
   TRANSITION_CLOSE_OPEN_TREND_TRADE=1
};

enum HT_BreakoutConfirmationBars
{
   BREAKOUT_CONFIRM_IMMEDIATE=0,
   BREAKOUT_CONFIRM_1_BAR=1,
   BREAKOUT_CONFIRM_2_BARS=2,
   BREAKOUT_CONFIRM_3_BARS=3,
   BREAKOUT_CONFIRM_5_BARS=5
};

enum HT_TrendLossProtectionPreset
{
   TREND_LOSS_PROTECTION_OFF=0,
   TREND_LOSS_PROTECTION_BALANCED=1,
   TREND_LOSS_PROTECTION_STRONG=2,
   TREND_LOSS_PROTECTION_EXTREME=3
};

enum HT_TrendChopProtectionPreset
{
   TREND_CHOP_PROTECTION_OFF=0,
   TREND_CHOP_PROTECTION_BALANCED=1,
   TREND_CHOP_PROTECTION_STRICT=2
};

// -------------------------------------------------------------------
// === CORE REGIME CONTROLS ===
input HT_MasterControl MasterControl=MASTER_BUY_AND_SELL;
input HT_RegimeControl RegimeControl=REGIME_AUTO_TREND_CLOUD_TRANSITION;
input ENUM_TIMEFRAMES SignalTimeframe=PERIOD_M1;
input HT_StartTradingTime StartTradingTime=START_ANY_TIME;
input HT_StartTradingMinute StartTradingMinute=START_MINUTE_00;

// === TREND ATTACK ===
input HT_RiskPercent RiskPerTrade=RISK_10_PERCENT;
input HT_TrendEntryFilterControl TrendEntryFilter=TREND_FILTER_CLOUD_SIDE_ONLY;
input HT_TrendArrowSignalControl TrendArrowSignal=TREND_ARROW_RAW_QUALIFYING_TICK;
input HT_ArrowEntryControl ArrowEntryControl=ARROW_ENTRY_EVERY_TICK;
input HT_ArrowMinimumSlope ArrowMinimumSlope=ARROW_SLOPE_0_00025;
input HT_ArrowConfirmationTicks ArrowConfirmationTicks=ARROW_CONFIRM_3_TICKS;
input HT_MaximumArrowEntries MaximumArrowEntries=MAX_ARROW_ENTRIES_1;
input HT_ArrowReversalExitControl ArrowReversalExit=ARROW_REVERSAL_EXIT_5_TICKS;
input HT_ATRStopMultiplier ATRStopDistance=ATR_SL_1_50_X;
input HT_TakeProfitRatio TakeProfitRatio=TP_RATIO_1_5_TO_1;
input HT_MarginSafetyControl MarginSafetyControl=MARGIN_SAFETY_CONSERVATIVE;
input HT_ReentryDelayControl ReentryDelay=REENTRY_DELAY_OFF;
input HT_MaxTradesPerHourControl MaxTradesPerHour=MAX_TRADES_PER_HOUR_100;
input HT_TrendLossProtectionPreset TrendLossProtection=TREND_LOSS_PROTECTION_OFF;
input HT_TrendChopProtectionPreset TrendChopProtection=TREND_CHOP_PROTECTION_OFF;

// === CONSOLIDATION / CLOUD HARVEST ===
input HT_ConsolidationSensitivity ConsolidationSensitivity=CONSOLIDATION_EARLY_SCORE_4;
input HT_CloudMinimumBars CloudMinimumBarsInside=CLOUD_INSIDE_1_BAR;
input HT_RiskPercent CloudScalpRisk=RISK_01_PERCENT;
input HT_CloudEntryZone CloudEntryZone=CLOUD_ZONE_35_PERCENT;
input HT_ArrowMinimumSlope CloudArrowMinimumSlope=ARROW_SLOPE_0_00010;
input HT_ArrowConfirmationTicks CloudArrowConfirmationTicks=ARROW_CONFIRM_2_TICKS;
input HT_CloudQuickProfitTarget CloudQuickProfitTarget=CLOUD_QUICK_TP_0_25_R;
input HT_CloudMaxHoldTime CloudMaxHoldTime=CLOUD_MAX_HOLD_60_SECONDS;
input HT_CloudReversalExitControl CloudReversalExit=CLOUD_REVERSAL_EXIT_2_TICKS;
input HT_CloudExitOnRegimeChange CloudExitOnRegimeChange=CLOUD_REGIME_CHANGE_CLOSE;
input HT_CloudATRBuffer CloudStopBuffer=CLOUD_BUFFER_0_10_ATR;
input HT_CloudReentryDelay CloudReentryDelay=CLOUD_REENTRY_5_SECONDS;
input HT_CloudTradesPerMinute CloudMaxTradesPerMinute=CLOUD_TRADES_PER_MINUTE_10;
input HT_CloudLossProtection CloudLossProtection=CLOUD_PAUSE_AFTER_2_LOSSES;
input HT_CloudLossPause CloudLossPause=CLOUD_LOSS_PAUSE_60_SECONDS;
input HT_CloudEquityFloor CloudEquityFloor=CLOUD_EQUITY_FLOOR_2_PERCENT;

// === TRANSITION DEFENSE / BREAKOUT ===
input HT_TransitionDefenseControl TransitionDefense=TRANSITION_CLOSE_OPEN_TREND_TRADE;
input HT_BreakoutConfirmationBars BreakoutConfirmation=BREAKOUT_CONFIRM_IMMEDIATE;

// === WISDO SMART CONTROL (v1.50) ===
// Live/demo: Terminal/Common/Files/WISDO_COMMAND.txt contains COMMAND|ARG1|ARG2.
// Tester: WISDO_TESTER_VOICE.csv contains YYYY.MM.DD HH:MI|COMMAND|ARG1|ARG2.
input bool WisdoSmartControlEnabled=true;
input string WisdoCommandFile="WISDO_COMMAND.txt";
input string WisdoTesterVoiceScript="WISDO_TESTER_VOICE.csv";
input int WisdoLevelTolerancePoints=100;
input bool WisdoRequireFVGAtArmedLevel=false;
enum WISDO_BOOK_SOURCE { WISDO_BOOK_AUTO=0, WISDO_BOOK_BROKER_DOM=1, WISDO_BOOK_EXTERNAL=2, WISDO_BOOK_BOTH=3 };
input WISDO_BOOK_SOURCE WisdoBookSource=WISDO_BOOK_BOTH;
input string WisdoBrokerBookFile="WISDO_BROKER_ORDER_BOOK.csv";
input string WisdoExternalBookFile="WISDO_ORDER_BOOK.csv";
input int WisdoBookStaleSeconds=3;
input int WisdoBookScanPoints=3000;
input double WisdoLargeLiquidityMultiplier=3.0;
input int WisdoMinimumBookScore=70;
input int WisdoMinimumPersistenceSeconds=3;
input int WisdoMinimumReplenishments=2;
input bool WisdoRequireHeatmapAtArmedLevel=true;
input bool WisdoDrawHeatmap=true;

// Internal fixed strategy settings. These are intentionally not user inputs because
// they are implementation details, display settings, or legacy paths not used by this architecture.
HT_TradeFrequencyControl TradeFrequencyControl=TRADE_MORE_OFTEN;
HT_SetupControl SetupControl=SETUP_AUTO_ALL;
HT_ArithmeticSpacingStep ArithmeticEntrySpacing=ARITH_STEP_0_00_R;
HT_GridStopControl GridStopControl=GRID_STOP_AFTER_FIRST_ADDON_SL;
HT_ReversalExposureControl ReversalExposureControl=REVERSAL_WAIT_FOR_FLAT;
HT_IchimokuFilter IchimokuTrendFilter=ICHIMOKU_STRICT_TREND;
HT_EntryHoursControl EntryHoursControl=ENTRY_HOURS_START_ONLY;
HT_StartTradingTime EndTradingTime=START_AT_23_00;
HT_StartTradingMinute EndTradingMinute=START_MINUTE_59;
HT_MaxTradesPerDirectionControl MaxTradesPerConfirmedDirection=MAX_DIRECTION_TRADES_OFF;
HT_MaximumLotCeilingControl MaximumLotCeiling=LOT_CEILING_OFF;
HT_AccountBasis RiskAccountBasis=RISK_FROM_BALANCE;
HT_RiskPercent MaximumCampaignRisk=RISK_10_PERCENT;
HT_StopControl StopControl=STOP_ATR;
HT_ExitControl ExitControl=EXIT_MAXIMUM_TREND;
HT_HoldControl TradeHoldControl=HOLD_UNTIL_SL_OR_TP;
HT_VisualControl VisualControl=VISUAL_DIAGNOSTIC;
int MagicNumber=26081101;
string TradeComment="HT_V11_TREND_CLOUD_FAST";
HT_LossStreakControl LossStreakProtection=LOSS_STREAK_AFTER_2;
HT_LossStreakSlopeMultiplier LossStreakSlopeStrength=LOSS_SLOPE_2_00_X;
HT_LossStreakExtraConfirm LossStreakExtraConfirmation=LOSS_CONFIRM_EXTRA_5;
HT_ChopDetectionControl ChopDetection=CHOP_4_FLIPS_IN_10_MIN;
HT_ChopPauseControl ChopPause=CHOP_PAUSE_600_SECONDS;

// Resolved runtime configuration. Presets write these values in OnInit().
bool AllowNewEntries=true,AllowBuy=true,AllowSell=true;
int SlippagePoints=30;
double RiskPerEntryPercent=1.0,MaximumCampaignRiskPercent=5.0,TakeProfitSLRatioValue=2.0;
double ArithmeticSpacingStepValue=0.0;
double ArrowMinimumSlopeValue=0.00050;
int ArrowConfirmationTicksValue=3;
int ArrowReversalExitTicksValue=3;
bool StopGridAfterFirstAddonSL=true;
bool UseMarginSafeGrid=true,WaitForFlatOnArrowReversal=true;
int SafeMaximumEntries=3;
int ReentryDelaySecondsValue=60;
int MaxTradesPerHourValue=20;
int MaxTradesPerDirectionValue=0;
int LossStreakTriggerValue=2;
double LossStreakSlopeMultiplierValue=2.00;
int LossStreakExtraConfirmTicksValue=5;
double MaximumOrderLotCeilingValue=0.0;
int ChopFlipThresholdValue=4;
int ChopWindowSecondsValue=600;
int ChopPauseSecondsValue=600;

// Trend / Cloud / Transition regime runtime configuration.
enum HT_InternalMarketRegime { MARKET_TREND=0, MARKET_TRANSITION=1, MARKET_CLOUD=2 };
HT_InternalMarketRegime gMarketRegime=MARKET_TREND;
HT_InternalMarketRegime gPreviousMarketRegime=MARKET_TREND;
int ConsolidationScoreThresholdValue=5;
int CloudMinimumBarsInsideValue=3;
double CloudRiskPercentValue=2.0;
double CloudEntryZoneFractionValue=0.25;
double CloudArrowMinimumSlopeValue=0.00025;
int CloudArrowConfirmationTicksValue=3;
double CloudStopATRBufferValue=0.10;
double CloudQuickProfitRValue=0.25;
bool CloudQuickProfitUseMidpoint=false;
int CloudMaxHoldSecondsValue=60;
int CloudReversalExitTicksValue=2;
bool CloseCloudOnRegimeChange=true;
int CloudReentryDelaySecondsValue=5;
int CloudMaxTradesPerMinuteValue=10;
int CloudLossTriggerValue=2;
int CloudLossPauseSecondsValue=60;
double CloudEquityFloorPercentValue=2.0;
int BreakoutConfirmationBarsValue=1;
int gConsolidationScore=0;
double gCloudTop=0.0,gCloudBottom=0.0,gCloudMid=0.0,gCloudPosition=0.5;
datetime gCloudRegimeStartTime=0;
double gCloudRegimeStartEquity=0.0;
bool gCloudEquityFloorBreached=false;
int gCloudConsecutiveLosses=0;
datetime gLastCloudCloseTime=0;
datetime gCloudLossPauseUntil=0;
datetime gCloudTrackedMinuteStart=0;
int gCloudTradesThisMinute=0;
int gCloudArrowCandidateDirection=DIR_FLAT;
int gCloudArrowCandidateTicks=0;
int gCloudReversalCandidateDirection=DIR_FLAT;
int gCloudReversalCandidateTicks=0;
double MinimumProjectedMarginLevel=500.0;
double MinimumFreeMarginReservePercent=35.0;
HT_EarlyEntryControl EarlyEntryControl=EARLY_ENTRY_ZERO_DEGREE_BREAK; // Legacy setup mode only.
HT_ScaleInControl ScaleInControl=SCALE_IN_OFF;                       // Arrow mode bypasses legacy adds.
ENUM_TIMEFRAMES SignalTF=PERIOD_M5;
int StopATRPeriodValue=14;
double StopATRMultiplierValue=2.0,FixedStopDistancePointsValue=500.0;
double StructureStopBufferPointsValue=30.0,MinimumStopDistancePointsValue=100.0;

double AddRiskFraction=0.50;
int MaximumOpenTrades=6,MaximumAddsPerCampaign=5,MinimumSecondsBetweenAdds=45;
double MinimumAddSpacingPoints=120.0;
bool RequireNewestTradeWinning=true;

bool RequireTriangleMovementEntry=true,AllowEntryWithoutValidGeometry=false;
double EntryAngleDegrees=5.0,StrongEntryAngleDegrees=12.0;
double EntryMinimumDirectionalWeight=0.04,EntryMaximumDirectionalWeight=0.72;
double EntryMinimumAngleVelocity=0.0;
bool RequirePositiveEntryAcceleration=false;
int EntryConfirmTicks=1,EntrySignalExpiryBars=4;
bool RequireFVGRejectionCandle=false;
double RejectionCloseLocation=0.55;
bool UsePermissiveEntryFallback=true;
int EntryFallbackBars=3;

bool UseFVGEntry=true,AllowHightowerLaunchEntry=true,AllowMomentumEntry=true;
int IchimokuTenkanPeriod=9,IchimokuKijunPeriod=26,IchimokuSpanBPeriod=52;
int FVGScanBars=60;
double MinimumFVGPoints=30.0,FVGTouchTolerancePoints=20.0;
bool EnterAtFVGHalf=true,RequireEMAAlignment=true;
int FastEMA=9,SlowEMA=34,LaunchBreakoutLookback=12;
double LaunchBreakBufferPoints=20.0;
bool RequireLaunchCandleBody=true;
double MinimumLaunchBodyPoints=40.0;

int StructureLookbackBars=100;
// Protective structure stops always use 200 completed SignalTF candles,
// independent of the shorter/longer triangle-entry geometry preset.
int StopLossLookbackBars=200;
double MinimumStructureRangePoints=150.0;
int AngleSampleBars=3;
double LadderAngleDegrees=7.5,StrongLadderAngleDegrees=16.0;
double DrawdownAngleDegrees=7.5,StrongDrawdownAngleDegrees=16.0;
double ExtensionWeight=0.68,ExtremeExtensionWeight=0.88;
int ModeConfirmTicks=3;

HT_TargetMode TargetMode=HT_BALANCED_CAMPAIGN;
int MinimumHoldBarsValue=12;
bool HoldUntilBrokerStopOrTarget=false;
bool UseTriangleMovementTakeProfit=true;
double MovementTPArmPercent=0.40,MovementTPMinimumMoney=0.75;
double MovementTPMinimumFavorableWeight=0.16,MovementTPAngleReversalDegrees=4.0;
double MovementTPWeightGiveback=0.12,MovementTPAngleGivebackDegrees=8.0;
int MovementTPConfirmTicks=3;
bool ExitOnProfitableDrawdownMode=true,ExitOnMidpointLossAfterProfit=true,ExitOnExtremeExtensionStall=true;
double ExtensionStallVelocity=0.35;
bool UseCampaignProfitRail=true;
double RailArmPercent=0.60,RailGivebackPercentQuick=18.0,RailGivebackPercentBalanced=30.0,RailGivebackPercentMaximum=45.0;
int RailConfirmTicks=3;
double BasketTargetPercent=2.0,MinimumBasketTargetMoney=2.0;
bool UsePeakGiveback=true;
double PeakArmPercent=1.0,PeakGivebackPercent=28.0,MinimumPeakGivebackMoney=1.0;
bool CloseOnInvalidGeometry=false,CloseOnOppositeFVG=true,CloseOnStructureBreak=true;
int OppositeFVGRecentBars=5;
double StructureBreakBufferPoints=30.0;

double MaximumCampaignDrawdownPercent=8.0;
bool DrawTriangle=true,ShowDashboard=true,EnableEntryDiagnostics=true;
bool DrawIchimokuCloud=true;
int IchimokuCloudHistoryBars=80;
color TriangleColor=clrDarkOrange,WeightLineColor=clrRed;
color IchimokuBullCloudColor=clrPaleGreen,IchimokuBearCloudColor=clrMistyRose;
color IchimokuSpanAColor=clrLimeGreen,IchimokuSpanBColor=clrTomato;
int TriangleWidth=2,WeightLineWidth=4,EntryDiagnosticSeconds=10;

// State
double gHigh=0,gLow=0,gMid=0,gPrice=0,gWeight=0,gArrowSlope=0;
double gAngle=0,gPrevAngle=0,gAngleVelocity=0,gAngleAcceleration=0;
double gPreviousLiveWeight=0.0;
bool gLiveWeightReady=false;
int gLastZeroCrossDirection=DIR_FLAT;
datetime gLastZeroCrossTime=0;
datetime gHighTime=0,gLowTime=0;
Direction gDirection=DIR_FLAT;
GeoMode gMode=GEO_OFF,gCandidate=GEO_OFF;
int gCandidateTicks=0;
datetime gLastAdd=0,gCampaignStart=0;
double gPeakProfit=0;
datetime gLastUsedFVGTime=0;
CampaignState gCampaignState=CS_FLAT;
bool gRailArmed=false;
int gRailExitTicks=0;
string gDecision="WAIT";
string gEntryStatus="INITIALIZING";
datetime gLastEntryDiagnostic=0;
datetime gLastCloudDrawBar=0;
int gLastArrowDirection=DIR_FLAT;
int gRawArrowDirection=DIR_FLAT;
int gArrowCandidateDirection=DIR_FLAT;
int gArrowCandidateTicks=0;
int gConfirmedArrowDirection=DIR_FLAT;
int gArrowSequenceIndex=0;
int gPreviousOpenTradeCount=0;
enum WISDO_CONTROL_MODE { WISDO_AUTO=0, WISDO_PAUSED=1, WISDO_LEVEL_ARMED=2 };
WISDO_CONTROL_MODE gWisdoMode=WISDO_AUTO;
int gWisdoSkipSignals=0;
double gWisdoArmedLevel=0.0,gWisdoArmedTolerance=0.0;
string gWisdoVisualMode="INSIGHT";
datetime gWisdoLastCommandCheck=0;
datetime gWisdoLastSkippedSignalTime=0;
int gWisdoTesterRow=0;
struct WISDO_BOOK_LEVEL
{
   double price;
   double size;
   int side;
   int orders;
   int score;
   int replenishments;
   datetime firstSeen;
   datetime updatedAt;
   long sequence;
   string source;
};
WISDO_BOOK_LEVEL gWisdoBid,gWisdoAsk;
bool gWisdoBookReady=false;
string gWisdoBookQuality="UNAVAILABLE";
double gWisdoAverageBookSize=0.0;
datetime gLastArrowFlipTime=0;

// v1.19 prove-and-survive anti-overtrade state.
int gLastHistoryTotal=0;
int gConsecutiveLosses=0;
datetime gLastOurCloseTime=0;
datetime gTrackedHourStart=0;
int gTradesOpenedThisHour=0;
int gSignalRunDirection=DIR_FLAT;
int gTradesThisSignalDirection=0;
int gLastTrackedNonFlatRawDirection=DIR_FLAT;
datetime gChopFlipTimes[16];
int gChopFlipStored=0;
datetime gChopPauseUntil=0;
string gOvertradeBlockReason="";

datetime gArrowCampaignStartTime=0;
bool gGridStoppedAfterSL=false;
int gReversalExitCandidateDirection=DIR_FLAT;
int gReversalExitCandidateTicks=0;
long gArrowEntryAttempts=0;
long gArrowEntriesOpened=0;
double gArrowCampaignAnchorPrice=0.0;
double gArrowCampaignTargetPrice=0.0;
int gArrowCampaignDirection=DIR_FLAT;
double gLastProjectedMarginLevel=0.0;
double gLastProjectedFreeMarginPercent=0.0;
string gSafetyBlockReason="";
double gLastOpenedPrice=0.0;
double gLastOpenedTakeProfit=0.0;

// Pre-entry movement state
int gEntryCandidateDirection=DIR_FLAT;
int gEntryCandidateTicks=0;
datetime gEntryCandidateFVGTime=0;

// Movement take-profit state
bool gMovementTPArmed=false;
int gMovementExitTicks=0;
double gPeakFavorableWeight=0.0;
double gPeakFavorableAngle=0.0;
double gPeakDirectionalPrice=0.0;
string gMovementExitReason="";

//---------------------------------------------------------
string Pfx(){ return "HTTF11TCT_"+Symbol()+"_"+IntegerToString(Period())+"_"; }

bool IsMasterEnabled()
{
   return MasterControl!=MASTER_OFF && MasterControl!=MASTER_MANAGE_OPEN_TRADES_ONLY;
}

string TwoDigitHour(int hourValue)
{
   if(hourValue<0) hourValue=0;
   if(hourValue>23) hourValue=23;
   return (hourValue<10 ? "0" : "")+IntegerToString(hourValue);
}

string TwoDigitMinute(int minuteValue)
{
   if(minuteValue<0) minuteValue=0;
   if(minuteValue>59) minuteValue=59;
   return (minuteValue<10 ? "0" : "")+IntegerToString(minuteValue);
}

string StartTradingTimeText()
{
   if(StartTradingTime==START_ANY_TIME) return "ANY TIME";
   return TwoDigitHour((int)StartTradingTime)+":"+
          TwoDigitMinute((int)StartTradingMinute)+" BROKER";
}

string BrokerClockText()
{
   datetime now=TimeCurrent();
   return TwoDigitHour(TimeHour(now))+":"+
          (TimeMinute(now)<10 ? "0" : "")+IntegerToString(TimeMinute(now));
}

bool StartTradingTimeReached()
{
   if(StartTradingTime==START_ANY_TIME) return true;
   datetime now=TimeCurrent();
   int currentMinutes=TimeHour(now)*60+TimeMinute(now);
   int startMinutes=((int)StartTradingTime)*60+(int)StartTradingMinute;
   return currentMinutes>=startMinutes;
}

bool MinutesInsideWindow(int currentMinutes,int startMinutes,int endMinutes)
{
   if(startMinutes==endMinutes) return true;
   if(startMinutes<endMinutes)
      return currentMinutes>=startMinutes && currentMinutes<=endMinutes;
   // Overnight window, for example 22:00 through 03:00.
   return currentMinutes>=startMinutes || currentMinutes<=endMinutes;
}

bool EntryHoursOpen()
{
   datetime now=TimeCurrent();
   int currentMinutes=TimeHour(now)*60+TimeMinute(now);

   if(EntryHoursControl==ENTRY_HOURS_ANY) return true;
   if(EntryHoursControl==ENTRY_HOURS_START_ONLY) return StartTradingTimeReached();
   if(EntryHoursControl==ENTRY_HOURS_STRONG_17_TO_18)
      return TimeHour(now)==17 || TimeHour(now)==18;

   if(StartTradingTime==START_ANY_TIME || EndTradingTime==START_ANY_TIME)
      return true;
   int startMinutes=((int)StartTradingTime)*60+(int)StartTradingMinute;
   int endMinutes=((int)EndTradingTime)*60+(int)EndTradingMinute;
   return MinutesInsideWindow(currentMinutes,startMinutes,endMinutes);
}

string EntryHoursText()
{
   if(EntryHoursControl==ENTRY_HOURS_ANY) return "ANY BROKER HOUR";
   if(EntryHoursControl==ENTRY_HOURS_START_ONLY) return "START ONLY "+StartTradingTimeText();
   if(EntryHoursControl==ENTRY_HOURS_STRONG_17_TO_18) return "17:00-18:59 BROKER TEST";
   if(StartTradingTime==START_ANY_TIME || EndTradingTime==START_ANY_TIME) return "CUSTOM=ANY";
   return TwoDigitHour((int)StartTradingTime)+":"+
          TwoDigitMinute((int)StartTradingMinute)+"-"+
          TwoDigitHour((int)EndTradingTime)+":"+
          TwoDigitMinute((int)EndTradingMinute)+" BROKER";
}

bool EntryStartTimeGatePasses(bool updateStatus)
{
   if(EntryHoursOpen()) return true;
   if(updateStatus)
      gEntryStatus="ENTRY HOURS CLOSED | "+EntryHoursText()+
                   " | BROKER "+BrokerClockText();
   return false;
}

void ApplyMasterControl()
{
   AllowNewEntries=false; AllowBuy=false; AllowSell=false;
   if(MasterControl==MASTER_BUY_AND_SELL)
   { AllowNewEntries=true; AllowBuy=true; AllowSell=true; }
   else if(MasterControl==MASTER_BUY_ONLY)
   { AllowNewEntries=true; AllowBuy=true; }
   else if(MasterControl==MASTER_SELL_ONLY)
   { AllowNewEntries=true; AllowSell=true; }
}

void ApplyTradeFrequencyControl()
{
   SignalTF=SignalTimeframe;

   if(TradeFrequencyControl==TRADE_MORE_OFTEN)
   {
      SlippagePoints=80;

      RequireTriangleMovementEntry=false;
      AllowEntryWithoutValidGeometry=true;
      EntryAngleDegrees=0.0; StrongEntryAngleDegrees=7.0;
      EntryMinimumDirectionalWeight=-0.95; EntryMaximumDirectionalWeight=0.98;
      EntryMinimumAngleVelocity=-999.0; RequirePositiveEntryAcceleration=false;
      EntryConfirmTicks=1; EntrySignalExpiryBars=30;
      RequireFVGRejectionCandle=false; RejectionCloseLocation=0.50;
      UsePermissiveEntryFallback=true; EntryFallbackBars=2;

      FVGScanBars=150; MinimumFVGPoints=5.0; FVGTouchTolerancePoints=80.0;
      EnterAtFVGHalf=false; RequireEMAAlignment=false;
      FastEMA=5; SlowEMA=13;
      LaunchBreakoutLookback=5; LaunchBreakBufferPoints=0.0;
      RequireLaunchCandleBody=false; MinimumLaunchBodyPoints=0.0;

      StructureLookbackBars=40; MinimumStructureRangePoints=20.0; AngleSampleBars=1;
      LadderAngleDegrees=3.0; StrongLadderAngleDegrees=8.0;
      DrawdownAngleDegrees=3.0; StrongDrawdownAngleDegrees=8.0;
      ExtensionWeight=0.80; ExtremeExtensionWeight=0.95; ModeConfirmTicks=1;

      MaximumCampaignDrawdownPercent=15.0;
      return;
   }

   if(TradeFrequencyControl==TRADE_SELECTIVE)
   {
      SlippagePoints=30;

      RequireTriangleMovementEntry=true;
      AllowEntryWithoutValidGeometry=false;
      EntryAngleDegrees=5.0; StrongEntryAngleDegrees=12.0;
      EntryMinimumDirectionalWeight=0.04; EntryMaximumDirectionalWeight=0.78;
      EntryMinimumAngleVelocity=0.0; RequirePositiveEntryAcceleration=false;
      EntryConfirmTicks=2; EntrySignalExpiryBars=8;
      RequireFVGRejectionCandle=false; RejectionCloseLocation=0.55;
      UsePermissiveEntryFallback=true; EntryFallbackBars=3;

      FVGScanBars=80; MinimumFVGPoints=20.0; FVGTouchTolerancePoints=25.0;
      EnterAtFVGHalf=true; RequireEMAAlignment=true;
      FastEMA=9; SlowEMA=34;
      LaunchBreakoutLookback=12; LaunchBreakBufferPoints=15.0;
      RequireLaunchCandleBody=true; MinimumLaunchBodyPoints=25.0;

      StructureLookbackBars=100; MinimumStructureRangePoints=100.0; AngleSampleBars=3;
      LadderAngleDegrees=7.5; StrongLadderAngleDegrees=16.0;
      DrawdownAngleDegrees=7.5; StrongDrawdownAngleDegrees=16.0;
      ExtensionWeight=0.68; ExtremeExtensionWeight=0.88; ModeConfirmTicks=3;

      MaximumCampaignDrawdownPercent=6.0;
      return;
   }

   SlippagePoints=50;

   RequireTriangleMovementEntry=true;
   AllowEntryWithoutValidGeometry=true;
   EntryAngleDegrees=1.5; StrongEntryAngleDegrees=9.0;
   EntryMinimumDirectionalWeight=-0.10; EntryMaximumDirectionalWeight=0.92;
   EntryMinimumAngleVelocity=-0.25; RequirePositiveEntryAcceleration=false;
   EntryConfirmTicks=1; EntrySignalExpiryBars=20;
   RequireFVGRejectionCandle=false; RejectionCloseLocation=0.50;
   UsePermissiveEntryFallback=true; EntryFallbackBars=3;

   FVGScanBars=120; MinimumFVGPoints=10.0; FVGTouchTolerancePoints=50.0;
   EnterAtFVGHalf=false; RequireEMAAlignment=true;
   FastEMA=8; SlowEMA=21;
   LaunchBreakoutLookback=8; LaunchBreakBufferPoints=5.0;
   RequireLaunchCandleBody=false; MinimumLaunchBodyPoints=10.0;

   StructureLookbackBars=60; MinimumStructureRangePoints=50.0; AngleSampleBars=2;
   LadderAngleDegrees=5.0; StrongLadderAngleDegrees=12.0;
   DrawdownAngleDegrees=5.0; StrongDrawdownAngleDegrees=12.0;
   ExtensionWeight=0.72; ExtremeExtensionWeight=0.92; ModeConfirmTicks=1;

   MaximumCampaignDrawdownPercent=10.0;
}

void ApplySetupControl()
{
   UseFVGEntry=(SetupControl==SETUP_AUTO_ALL || SetupControl==SETUP_FVG_ONLY);
   AllowHightowerLaunchEntry=(SetupControl==SETUP_AUTO_ALL || SetupControl==SETUP_BREAKOUT_ONLY);
   AllowMomentumEntry=(SetupControl==SETUP_AUTO_ALL || SetupControl==SETUP_MOMENTUM_ONLY);
}

void ApplyRiskControl()
{
   RiskPerEntryPercent=(double)((int)RiskPerTrade);
   // Each trend order keeps the exact selected risk. Total campaign capacity follows
   // the selected maximum number of trend entries; orders are blocked, never resized.
   MaximumCampaignRiskPercent=MathMin(100.0,RiskPerEntryPercent*MathMax(1,(int)MaximumArrowEntries));
   TakeProfitSLRatioValue=(double)((int)TakeProfitRatio)/10.0;
}

void ApplyArrowEntryControl()
{
   ArithmeticSpacingStepValue=(double)((int)ArithmeticEntrySpacing)/100.0;
   ArithmeticSpacingStepValue=MathMax(0.0,ArithmeticSpacingStepValue);
   ArrowMinimumSlopeValue=(double)((int)ArrowMinimumSlope)/100000.0;
   ArrowMinimumSlopeValue=MathMax(0.0,ArrowMinimumSlopeValue);
   ArrowConfirmationTicksValue=MathMax(1,(int)ArrowConfirmationTicks);
   ArrowReversalExitTicksValue=MathMax(0,(int)ArrowReversalExit);
   SafeMaximumEntries=MathMax(1,MathMin(5,(int)MaximumArrowEntries));
   StopGridAfterFirstAddonSL=(GridStopControl==GRID_STOP_AFTER_FIRST_ADDON_SL);
}

void ApplyAntiOvertradeControls()
{
   ReentryDelaySecondsValue=MathMax(0,(int)ReentryDelay);
   MaxTradesPerHourValue=MathMax(0,(int)MaxTradesPerHour);
   MaxTradesPerDirectionValue=0;
   MaximumOrderLotCeilingValue=0.0;

   LossStreakTriggerValue=0;
   LossStreakSlopeMultiplierValue=1.0;
   LossStreakExtraConfirmTicksValue=0;
   if(TrendLossProtection==TREND_LOSS_PROTECTION_BALANCED)
   {
      LossStreakTriggerValue=2; LossStreakSlopeMultiplierValue=2.0; LossStreakExtraConfirmTicksValue=5;
   }
   else if(TrendLossProtection==TREND_LOSS_PROTECTION_STRONG)
   {
      LossStreakTriggerValue=2; LossStreakSlopeMultiplierValue=3.0; LossStreakExtraConfirmTicksValue=8;
   }
   else if(TrendLossProtection==TREND_LOSS_PROTECTION_EXTREME)
   {
      LossStreakTriggerValue=1; LossStreakSlopeMultiplierValue=3.0; LossStreakExtraConfirmTicksValue=10;
   }

   ChopFlipThresholdValue=0;
   ChopWindowSecondsValue=0;
   ChopPauseSecondsValue=0;
   if(TrendChopProtection==TREND_CHOP_PROTECTION_BALANCED)
   {
      ChopFlipThresholdValue=4; ChopWindowSecondsValue=10*60; ChopPauseSecondsValue=10*60;
   }
   else if(TrendChopProtection==TREND_CHOP_PROTECTION_STRICT)
   {
      ChopFlipThresholdValue=3; ChopWindowSecondsValue=5*60; ChopPauseSecondsValue=10*60;
   }
}

void ApplyRegimeControls()
{
   ConsolidationScoreThresholdValue=MathMax(4,MathMin(6,(int)ConsolidationSensitivity));
   CloudMinimumBarsInsideValue=MathMax(1,(int)CloudMinimumBarsInside);
   CloudRiskPercentValue=MathMax(1.0,MathMin(100.0,(double)((int)CloudScalpRisk)));
   CloudEntryZoneFractionValue=MathMax(0.10,MathMin(0.45,(double)((int)CloudEntryZone)/100.0));
   CloudArrowMinimumSlopeValue=MathMax(0.0,(double)((int)CloudArrowMinimumSlope)/100000.0);
   CloudArrowConfirmationTicksValue=MathMax(1,(int)CloudArrowConfirmationTicks);
   CloudStopATRBufferValue=MathMax(0.0,(double)((int)CloudStopBuffer)/100.0);
   CloudQuickProfitUseMidpoint=(CloudQuickProfitTarget==CLOUD_QUICK_TP_MIDPOINT);
   CloudQuickProfitRValue=(CloudQuickProfitUseMidpoint ? 0.0 : MathMax(0.25,(double)((int)CloudQuickProfitTarget)/100.0));
   CloudMaxHoldSecondsValue=MathMax(0,(int)CloudMaxHoldTime);
   CloudReversalExitTicksValue=MathMax(0,(int)CloudReversalExit);
   CloseCloudOnRegimeChange=(CloudExitOnRegimeChange==CLOUD_REGIME_CHANGE_CLOSE);
   CloudReentryDelaySecondsValue=MathMax(0,(int)CloudReentryDelay);
   CloudMaxTradesPerMinuteValue=MathMax(1,(int)CloudMaxTradesPerMinute);
   CloudLossTriggerValue=MathMax(0,(int)CloudLossProtection);
   CloudLossPauseSecondsValue=MathMax(0,(int)CloudLossPause);
   CloudEquityFloorPercentValue=MathMax(0.0,MathMin(50.0,(double)((int)CloudEquityFloor)));
   BreakoutConfirmationBarsValue=MathMax(0,(int)BreakoutConfirmation);
}

string ReentryDelayText()
{
   if(ReentryDelaySecondsValue<=0) return "DELAY OFF";
   return "DELAY "+IntegerToString(ReentryDelaySecondsValue)+"s";
}

string HourlyTradeLimitText()
{
   if(MaxTradesPerHourValue<=0) return "HOUR CAP OFF";
   return "HOUR CAP "+IntegerToString(MaxTradesPerHourValue);
}

string DirectionTradeLimitText()
{
   if(MaxTradesPerDirectionValue<=0) return "DIR CAP OFF";
   return "DIR CAP "+IntegerToString(MaxTradesPerDirectionValue);
}

string LossStreakText()
{
   if(LossStreakTriggerValue<=0) return "LOSS FILTER OFF";
   return "LOSS>="+IntegerToString(LossStreakTriggerValue)+
          " SLOPE x"+DoubleToString(LossStreakSlopeMultiplierValue,2)+
          " +"+IntegerToString(LossStreakExtraConfirmTicksValue)+"T";
}

string LotCeilingText()
{
   if(MaximumOrderLotCeilingValue<=0.0) return "LOT CEILING OFF";
   return "LOT CEILING "+DoubleToString(MaximumOrderLotCeilingValue,2)+" BLOCK";
}

string ChopFilterText()
{
   if(ChopFlipThresholdValue<=0 || ChopWindowSecondsValue<=0) return "CHOP OFF";
   return "CHOP "+IntegerToString(ChopFlipThresholdValue)+
          " flips/"+IntegerToString(ChopWindowSecondsValue/60)+
          "m pause "+IntegerToString(ChopPauseSecondsValue/60)+"m";
}

void ApplyMarginSafetyControl()
{
   UseMarginSafeGrid=(MarginSafetyControl!=MARGIN_SAFETY_OFF_LEGACY);
   WaitForFlatOnArrowReversal=(ReversalExposureControl==REVERSAL_WAIT_FOR_FLAT);

   if(MarginSafetyControl==MARGIN_SAFETY_CONSERVATIVE)
   {
      MinimumProjectedMarginLevel=250.0;
      MinimumFreeMarginReservePercent=35.0;
      return;
   }
   if(MarginSafetyControl==MARGIN_SAFETY_ACTIVE)
   {
      MinimumProjectedMarginLevel=120.0;
      MinimumFreeMarginReservePercent=10.0;
      return;
   }
   if(MarginSafetyControl==MARGIN_SAFETY_OFF_LEGACY)
   {
      MinimumProjectedMarginLevel=0.0;
      MinimumFreeMarginReservePercent=0.0;
      return;
   }

   MinimumProjectedMarginLevel=150.0;
   MinimumFreeMarginReservePercent=20.0;
}

string MarginSafetyText()
{
   if(MarginSafetyControl==MARGIN_SAFETY_CONSERVATIVE) return "CONSERVATIVE";
   if(MarginSafetyControl==MARGIN_SAFETY_ACTIVE) return "ACTIVE";
   if(MarginSafetyControl==MARGIN_SAFETY_OFF_LEGACY) return "OFF - LEGACY";
   return "BALANCED";
}

string ArrowEntryModeText()
{
   if(ArrowEntryControl==ARROW_ENTRY_EVERY_TICK) return "EVERY TICK";
   if(ArrowEntryControl==ARROW_ENTRY_FIRST_ONLY) return "FIRST ENTRY";
   return "LEGACY SETUPS";
}

string ArrowSlopeText()
{
   if(ArrowMinimumSlopeValue<=0.0) return "ANY NONZERO MOVE";
   return "MIN SLOPE "+DoubleToString(ArrowMinimumSlopeValue,5);
}

string ArrowConfirmationText()
{
   return IntegerToString(ArrowConfirmationTicksValue)+" TICK CONFIRM";
}

string ArrowReversalExitText()
{
   if(ArrowReversalExitTicksValue<=0) return "REVERSAL EXIT OFF";
   return "REVERSAL EXIT "+IntegerToString(ArrowReversalExitTicksValue)+" TICKS";
}

string ArithmeticSpacingText()
{
   return "GRID SPACING +"+DoubleToString(ArithmeticSpacingStepValue,2)+" STEP";
}

string StopMethodText()
{
   if(StopControl==STOP_ATR) return "ATR";
   if(StopControl==STOP_STRUCTURE) return "STRUCTURE 200";
   if(StopControl==STOP_FIXED_POINTS) return "FIXED";
   return "WIDER STRUCTURE/ATR";
}

string ATRStopText()
{
   return "ATR("+IntegerToString(StopATRPeriodValue)+") x"+
          DoubleToString(StopATRMultiplierValue,2);
}

void ApplyStopControl()
{
   StopATRPeriodValue=14;
   StopATRMultiplierValue=(double)((int)ATRStopDistance)/100.0;
   StructureStopBufferPointsValue=20.0;
   MinimumStopDistancePointsValue=50.0;
   FixedStopDistancePointsValue=500.0;

   // Frequency presets may change broker-safety minimums and structure buffers,
   // but the ATR distance itself is always controlled by the user dropdown.
   if(TradeFrequencyControl==TRADE_MORE_OFTEN)
   {
      MinimumStopDistancePointsValue=30.0;
      StructureStopBufferPointsValue=10.0;
   }
   else if(TradeFrequencyControl==TRADE_SELECTIVE)
   {
      MinimumStopDistancePointsValue=100.0;
      StructureStopBufferPointsValue=30.0;
   }
}

void ApplyScaleInControl()
{
   if(ScaleInControl==SCALE_IN_OFF)
   {
      MaximumOpenTrades=1; MaximumAddsPerCampaign=0;
      MinimumSecondsBetweenAdds=300; MinimumAddSpacingPoints=999999.0;
      RequireNewestTradeWinning=true; AddRiskFraction=0.50;
      return;
   }
   if(ScaleInControl==SCALE_IN_BALANCED)
   {
      MaximumOpenTrades=4; MaximumAddsPerCampaign=3;
      MinimumSecondsBetweenAdds=45; MinimumAddSpacingPoints=120.0;
      RequireNewestTradeWinning=true; AddRiskFraction=0.50;
      return;
   }
   if(ScaleInControl==SCALE_IN_ACTIVE)
   {
      MaximumOpenTrades=6; MaximumAddsPerCampaign=5;
      MinimumSecondsBetweenAdds=20; MinimumAddSpacingPoints=60.0;
      RequireNewestTradeWinning=false; AddRiskFraction=0.50;
      return;
   }
   MaximumOpenTrades=2; MaximumAddsPerCampaign=1;
   MinimumSecondsBetweenAdds=60; MinimumAddSpacingPoints=150.0;
   RequireNewestTradeWinning=true; AddRiskFraction=0.50;
}

void ApplyExitControl()
{
   if(ExitControl==EXIT_QUICK)
   {
      TargetMode=HT_QUICK_CAPTURE;
      UseTriangleMovementTakeProfit=true;
      MovementTPArmPercent=0.25; MovementTPMinimumMoney=0.50;
      MovementTPMinimumFavorableWeight=0.10; MovementTPAngleReversalDegrees=3.0;
      MovementTPWeightGiveback=0.08; MovementTPAngleGivebackDegrees=5.0;
      MovementTPConfirmTicks=2;
      ExitOnProfitableDrawdownMode=true; ExitOnMidpointLossAfterProfit=true; ExitOnExtremeExtensionStall=true;
      ExtensionStallVelocity=0.50;
      UseCampaignProfitRail=true; RailArmPercent=0.40;
      RailGivebackPercentQuick=15.0; RailGivebackPercentBalanced=22.0; RailGivebackPercentMaximum=30.0;
      RailConfirmTicks=2;
      BasketTargetPercent=1.0; MinimumBasketTargetMoney=1.0;
      UsePeakGiveback=true; PeakArmPercent=0.60; PeakGivebackPercent=20.0; MinimumPeakGivebackMoney=0.75;
      CloseOnInvalidGeometry=false; CloseOnOppositeFVG=true; OppositeFVGRecentBars=3;
      CloseOnStructureBreak=true; StructureBreakBufferPoints=20.0;
      return;
   }
   if(ExitControl==EXIT_MAXIMUM_TREND)
   {
      TargetMode=HT_MAXIMUM_TREND;
      UseTriangleMovementTakeProfit=true;
      MovementTPArmPercent=0.75; MovementTPMinimumMoney=1.50;
      MovementTPMinimumFavorableWeight=0.22; MovementTPAngleReversalDegrees=6.0;
      MovementTPWeightGiveback=0.18; MovementTPAngleGivebackDegrees=12.0;
      MovementTPConfirmTicks=5;
      ExitOnProfitableDrawdownMode=true; ExitOnMidpointLossAfterProfit=false; ExitOnExtremeExtensionStall=true;
      ExtensionStallVelocity=0.15;
      UseCampaignProfitRail=true; RailArmPercent=1.00;
      RailGivebackPercentQuick=25.0; RailGivebackPercentBalanced=38.0; RailGivebackPercentMaximum=50.0;
      RailConfirmTicks=5;
      BasketTargetPercent=4.0; MinimumBasketTargetMoney=4.0;
      UsePeakGiveback=false; PeakArmPercent=2.0; PeakGivebackPercent=45.0; MinimumPeakGivebackMoney=2.0;
      CloseOnInvalidGeometry=false; CloseOnOppositeFVG=false; OppositeFVGRecentBars=8;
      CloseOnStructureBreak=true; StructureBreakBufferPoints=50.0;
      return;
   }
   TargetMode=HT_BALANCED_CAMPAIGN;
   UseTriangleMovementTakeProfit=true;
   MovementTPArmPercent=0.40; MovementTPMinimumMoney=0.75;
   MovementTPMinimumFavorableWeight=0.16; MovementTPAngleReversalDegrees=4.0;
   MovementTPWeightGiveback=0.12; MovementTPAngleGivebackDegrees=8.0;
   MovementTPConfirmTicks=3;
   ExitOnProfitableDrawdownMode=true; ExitOnMidpointLossAfterProfit=true; ExitOnExtremeExtensionStall=true;
   ExtensionStallVelocity=0.35;
   UseCampaignProfitRail=true; RailArmPercent=0.60;
   RailGivebackPercentQuick=18.0; RailGivebackPercentBalanced=30.0; RailGivebackPercentMaximum=45.0;
   RailConfirmTicks=3;
   BasketTargetPercent=2.0; MinimumBasketTargetMoney=2.0;
   UsePeakGiveback=true; PeakArmPercent=1.0; PeakGivebackPercent=28.0; MinimumPeakGivebackMoney=1.0;
   CloseOnInvalidGeometry=false; CloseOnOppositeFVG=true; OppositeFVGRecentBars=5;
   CloseOnStructureBreak=true; StructureBreakBufferPoints=30.0;
}

void ApplyHoldControl()
{
   HoldUntilBrokerStopOrTarget=(TradeHoldControl==HOLD_UNTIL_SL_OR_TP);
   MinimumHoldBarsValue=(HoldUntilBrokerStopOrTarget ? 0 : (int)TradeHoldControl);
   MinimumHoldBarsValue=MathMax(0,MinimumHoldBarsValue);
}

void ApplyVisualControl()
{
   TriangleColor=clrDarkOrange; WeightLineColor=clrRed;
   if(VisualControl==VISUAL_OFF)
   {
      DrawTriangle=false; ShowDashboard=false; EnableEntryDiagnostics=false; DrawIchimokuCloud=false;
      TriangleWidth=1; WeightLineWidth=1; EntryDiagnosticSeconds=60;
      return;
   }
   if(VisualControl==VISUAL_DIAGNOSTIC)
   {
      DrawTriangle=true; ShowDashboard=true; EnableEntryDiagnostics=true; DrawIchimokuCloud=true;
      TriangleWidth=3; WeightLineWidth=5; EntryDiagnosticSeconds=5;
      return;
   }
   DrawTriangle=true; ShowDashboard=true; EnableEntryDiagnostics=false; DrawIchimokuCloud=true;
   TriangleWidth=2; WeightLineWidth=4; EntryDiagnosticSeconds=15;
}

void ApplyAllControls()
{
   ApplyMasterControl();
   ApplyTradeFrequencyControl();
   ApplySetupControl();
   ApplyRiskControl();
   ApplyArrowEntryControl();
   ApplyAntiOvertradeControls();
   ApplyRegimeControls();
   ApplyMarginSafetyControl();
   ApplyStopControl();
   ApplyScaleInControl();
   ApplyExitControl();
   ApplyHoldControl();
   ApplyVisualControl();

   RiskPerEntryPercent=MathMax(1.0,MathMin(100.0,RiskPerEntryPercent));
   TakeProfitSLRatioValue=MathMax(0.0,MathMin(10.0,TakeProfitSLRatioValue));
   MaximumCampaignRiskPercent=MathMax(RiskPerEntryPercent,
                                       MathMin(100.0,MaximumCampaignRiskPercent));
   SafeMaximumEntries=MathMax(1,MathMin(5,SafeMaximumEntries));
   MinimumProjectedMarginLevel=MathMax(0.0,MinimumProjectedMarginLevel);
   MinimumFreeMarginReservePercent=MathMax(0.0,MathMin(100.0,MinimumFreeMarginReservePercent));
   StopATRPeriodValue=MathMax(1,StopATRPeriodValue);
   StopATRMultiplierValue=MathMax(0.10,StopATRMultiplierValue);
   MinimumStopDistancePointsValue=MathMax(1.0,MinimumStopDistancePointsValue);
   StructureStopBufferPointsValue=MathMax(0.0,StructureStopBufferPointsValue);
   FixedStopDistancePointsValue=MathMax(MinimumStopDistancePointsValue,FixedStopDistancePointsValue);
   MinimumStructureRangePoints=MathMax(1.0,MinimumStructureRangePoints);
   EntryMaximumDirectionalWeight=MathMax(EntryMinimumDirectionalWeight,EntryMaximumDirectionalWeight);
   RejectionCloseLocation=MathMax(0.0,MathMin(1.0,RejectionCloseLocation));
   AddRiskFraction=MathMax(0.0,MathMin(1.0,AddRiskFraction));
   MaximumOpenTrades=MathMax(1,MaximumOpenTrades);
   MaximumAddsPerCampaign=MathMax(0,MathMin(MaximumAddsPerCampaign,MaximumOpenTrades-1));
   EntryConfirmTicks=MathMax(1,EntryConfirmTicks);
   EntrySignalExpiryBars=MathMax(1,EntrySignalExpiryBars);
   EntryFallbackBars=MathMax(1,EntryFallbackBars);
   FVGScanBars=MathMax(1,FVGScanBars);
   LaunchBreakoutLookback=MathMax(3,LaunchBreakoutLookback);
   StructureLookbackBars=MathMax(10,StructureLookbackBars);
   StopLossLookbackBars=200;
   IchimokuCloudHistoryBars=MathMax(20,IchimokuCloudHistoryBars);
   AngleSampleBars=MathMax(1,AngleSampleBars);
   ModeConfirmTicks=MathMax(1,ModeConfirmTicks);
   MovementTPConfirmTicks=MathMax(1,MovementTPConfirmTicks);
   RailConfirmTicks=MathMax(1,RailConfirmTicks);
}

double MidPrice(){ RefreshRates(); return (Bid+Ask)*0.5; }
double SpreadPoints(){ RefreshRates(); return (Ask-Bid)/Point; }

bool OurOrder()
{
   return OrderSymbol()==Symbol() &&
          OrderMagicNumber()==MagicNumber &&
          (OrderType()==OP_BUY || OrderType()==OP_SELL);
}

int TradeCount()
{
   int n=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && OurOrder()) n++;
   return n;
}

int TradeCountByDirection(int dir)
{
   int n=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(dir==DIR_BUY && OrderType()==OP_BUY) n++;
      if(dir==DIR_SELL && OrderType()==OP_SELL) n++;
   }
   return n;
}


datetime BrokerHourStart(datetime whenValue)
{
   return whenValue-TimeMinute(whenValue)*60-TimeSeconds(whenValue);
}

double SelectedOrderNetProfit()
{
   return OrderProfit()+OrderSwap()+OrderCommission();
}

void InitializeClosedTradeStats()
{
   gLastHistoryTotal=OrdersHistoryTotal();
   gConsecutiveLosses=0;
   gLastOurCloseTime=0;
   gLastCloudCloseTime=0;
   gCloudConsecutiveLosses=0;

   int inspected=0;
   for(int i=gLastHistoryTotal-1;i>=0 && inspected<200;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY) || !OurOrder()) continue;
      inspected++;
      bool cloud=(StringFind(OrderComment(),"CLOUD_")>=0);
      if(cloud)
      {
         if(OrderCloseTime()>gLastCloudCloseTime) gLastCloudCloseTime=OrderCloseTime();
         continue;
      }
      if(OrderCloseTime()>gLastOurCloseTime) gLastOurCloseTime=OrderCloseTime();
      double net=SelectedOrderNetProfit();
      if(net< -0.0000001) gConsecutiveLosses++;
      else if(net>0.0000001) break;
   }
}

void RefreshClosedTradeStats()
{
   int total=OrdersHistoryTotal();
   if(total<gLastHistoryTotal)
   {
      InitializeClosedTradeStats();
      return;
   }
   if(total==gLastHistoryTotal) return;

   for(int i=gLastHistoryTotal;i<total;i++)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY) || !OurOrder()) continue;
      double net=SelectedOrderNetProfit();
      bool cloud=(StringFind(OrderComment(),"CLOUD_")>=0);
      if(cloud)
      {
         if(OrderCloseTime()>gLastCloudCloseTime) gLastCloudCloseTime=OrderCloseTime();
         if(net< -0.0000001)
         {
            gCloudConsecutiveLosses++;
            if(CloudLossTriggerValue>0 && gCloudConsecutiveLosses>=CloudLossTriggerValue)
               gCloudLossPauseUntil=OrderCloseTime()+CloudLossPauseSecondsValue;
         }
         else if(net>0.0000001) gCloudConsecutiveLosses=0;
         continue;
      }

      if(OrderCloseTime()>gLastOurCloseTime) gLastOurCloseTime=OrderCloseTime();
      if(net< -0.0000001)
      {
         gConsecutiveLosses++;
         if(LossStreakTriggerValue>0 && gConsecutiveLosses>=LossStreakTriggerValue)
            ResetArrowDirectionConfirmation();
      }
      else if(net>0.0000001) gConsecutiveLosses=0;
   }
   gLastHistoryTotal=total;
}

int CountOurTradesOpenedSince(datetime sinceTime)
{
   int count=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(StringFind(OrderComment(),"CLOUD_")>=0) continue;
      if(OrderOpenTime()>=sinceTime) count++;
   }
   for(int h=OrdersHistoryTotal()-1;h>=0;h--)
   {
      if(!OrderSelect(h,SELECT_BY_POS,MODE_HISTORY) || !OurOrder()) continue;
      if(StringFind(OrderComment(),"CLOUD_")>=0) continue;
      if(OrderOpenTime()>=sinceTime) count++;
   }
   return count;
}

void InitializeHourlyTradeCounter()
{
   gTrackedHourStart=BrokerHourStart(TimeCurrent());
   gTradesOpenedThisHour=CountOurTradesOpenedSince(gTrackedHourStart);
}

void RefreshHourlyTradeCounter()
{
   datetime currentHour=BrokerHourStart(TimeCurrent());
   if(currentHour!=gTrackedHourStart)
   {
      gTrackedHourStart=currentHour;
      gTradesOpenedThisHour=0;
   }
}

void RecordChopFlip(datetime flipTime)
{
   for(int i=15;i>0;i--) gChopFlipTimes[i]=gChopFlipTimes[i-1];
   gChopFlipTimes[0]=flipTime;
   gChopFlipStored=MathMin(16,gChopFlipStored+1);

   if(gMarketRegime!=MARKET_TREND) return;
   if(ChopFlipThresholdValue<=0 || ChopWindowSecondsValue<=0) return;
   int recent=0;
   for(int j=0;j<gChopFlipStored;j++)
      if(gChopFlipTimes[j]>=flipTime-ChopWindowSecondsValue) recent++;

   if(recent>=ChopFlipThresholdValue)
   {
      gChopPauseUntil=flipTime+ChopPauseSecondsValue;
      Print("HT Trend/Cloud CHOP PAUSE: ",recent," flips in ",
            ChopWindowSecondsValue/60,"m; pause until ",
            TimeToString(gChopPauseUntil,TIME_MINUTES));
   }
}

void TrackOvertradeDirectionState()
{
   int raw=gRawArrowDirection;
   if(raw!=DIR_FLAT)
   {
      if(gLastTrackedNonFlatRawDirection==DIR_FLAT)
         gLastTrackedNonFlatRawDirection=raw;
      else if(raw!=gLastTrackedNonFlatRawDirection)
      {
         RecordChopFlip(TimeCurrent());
         gLastTrackedNonFlatRawDirection=raw;
      }
   }

   int confirmed=WeightArrowDirection();
   if(confirmed==DIR_FLAT) return;
   if(gSignalRunDirection==DIR_FLAT)
   {
      gSignalRunDirection=confirmed;
      gTradesThisSignalDirection=0;
   }
   else if(confirmed!=gSignalRunDirection)
   {
      Print("HT Trend/Cloud FRESH CONFIRMED REVERSAL resets direction trade count: ",
            gSignalRunDirection==DIR_BUY?"BUY->SELL":"SELL->BUY");
      gSignalRunDirection=confirmed;
      gTradesThisSignalDirection=0;
   }
}

bool OvertradeEntryGatePasses(int dir,bool updateStatus)
{
   RefreshClosedTradeStats();
   RefreshHourlyTradeCounter();
   gOvertradeBlockReason="";

   if(ReentryDelaySecondsValue>0 && gLastOurCloseTime>0)
   {
      int elapsed=(int)(TimeCurrent()-gLastOurCloseTime);
      if(elapsed<ReentryDelaySecondsValue)
      {
         gOvertradeBlockReason="REENTRY DELAY "+
                               IntegerToString(ReentryDelaySecondsValue-elapsed)+"s";
      }
   }

   if(gOvertradeBlockReason=="" && MaxTradesPerHourValue>0 &&
      gTradesOpenedThisHour>=MaxTradesPerHourValue)
      gOvertradeBlockReason="MAX TRADES/HOUR "+
                            IntegerToString(gTradesOpenedThisHour)+"/"+
                            IntegerToString(MaxTradesPerHourValue);

   if(gOvertradeBlockReason=="" && MaxTradesPerDirectionValue>0 &&
      gSignalRunDirection==dir &&
      gTradesThisSignalDirection>=MaxTradesPerDirectionValue)
      gOvertradeBlockReason="WAIT FOR FRESH CONFIRMED REVERSAL "+
                            IntegerToString(gTradesThisSignalDirection)+"/"+
                            IntegerToString(MaxTradesPerDirectionValue);

   if(gOvertradeBlockReason=="" && gChopPauseUntil>TimeCurrent())
      gOvertradeBlockReason="CHOP PAUSE "+
                            IntegerToString((int)(gChopPauseUntil-TimeCurrent()))+"s";

   if(gOvertradeBlockReason=="" && LossStreakTriggerValue>0 &&
      gConsecutiveLosses>=LossStreakTriggerValue)
   {
      double baseSlope=MathMax(ArrowMinimumSlopeValue,0.00005);
      double requiredSlope=baseSlope*LossStreakSlopeMultiplierValue;
      int requiredTicks=ArrowConfirmationTicksValue+LossStreakExtraConfirmTicksValue;
      if(MathAbs(gArrowSlope)<requiredSlope)
         gOvertradeBlockReason="LOSS FILTER SLOPE "+
                               DoubleToString(MathAbs(gArrowSlope),5)+"/"+
                               DoubleToString(requiredSlope,5);
      else if(ArrowEntryControl!=ARROW_ENTRY_OFF_USE_SETUPS &&
              (gArrowCandidateDirection!=dir || gArrowCandidateTicks<requiredTicks))
         gOvertradeBlockReason="LOSS FILTER CONFIRM "+
                               IntegerToString(gArrowCandidateTicks)+"/"+
                               IntegerToString(requiredTicks);
   }

   if(gOvertradeBlockReason!="")
   {
      if(updateStatus) gEntryStatus="Trend/Cloud BLOCK: "+gOvertradeBlockReason;
      return false;
   }
   return true;
}

double LotsByDirection(int dir)
{
   double lots=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(dir==DIR_BUY && OrderType()!=OP_BUY) continue;
      if(dir==DIR_SELL && OrderType()!=OP_SELL) continue;
      lots+=OrderLots();
   }
   return lots;
}

Direction DetectDirection()
{
   double b=LotsByDirection(DIR_BUY),s=LotsByDirection(DIR_SELL);
   if(b>s && b>0) return DIR_BUY;
   if(s>b && s>0) return DIR_SELL;
   return DIR_FLAT;
}

double BasketProfit()
{
   double p=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && OurOrder())
         p+=OrderProfit()+OrderSwap()+OrderCommission();
   return p;
}

double NewestProfit()
{
   datetime newest=0; double p=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderOpenTime()>=newest)
      {
         newest=OrderOpenTime();
         p=OrderProfit()+OrderSwap()+OrderCommission();
      }
   }
   return p;
}

double LastEntryPrice()
{
   datetime newest=0; double price=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderOpenTime()>=newest){ newest=OrderOpenTime(); price=OrderOpenPrice(); }
   }
   return price;
}

double TotalLots()
{
   double lots=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && OurOrder()) lots+=OrderLots();
   return lots;
}

double AccountRiskBase()
{
   if(RiskAccountBasis==RISK_FROM_BALANCE) return MathMax(0.0,AccountBalance());
   if(RiskAccountBasis==RISK_FROM_FREE_MARGIN) return MathMax(0.0,AccountFreeMargin());
   return MathMax(0.0,AccountEquity());
}

double SelectedRiskMoney()
{
   return AccountRiskBase()*RiskPerEntryPercent/100.0;
}

double TickSizePrice()
{
   // MT4 servers normally return MODE_TICKSIZE as the actual quoted-price increment.
   // Multiplying that value by Point again can make risk per lot millions of times too large.
   double tickSizePrice=MarketInfo(Symbol(),MODE_TICKSIZE);
   if(tickSizePrice<=0.0) tickSizePrice=Point;

   // Compatibility for a server that reports a whole-number count of points instead.
   if(Point<1.0 && tickSizePrice>=1.0 &&
      MathAbs(tickSizePrice-MathRound(tickSizePrice))<0.0000001)
      tickSizePrice*=Point;

   return MathMax(Point,tickSizePrice);
}

double CashLossPerLot(double openPrice,double stopPrice)
{
   double distance=MathAbs(openPrice-stopPrice);
   double tickValue=MarketInfo(Symbol(),MODE_TICKVALUE);
   double tickSizePrice=TickSizePrice();
   if(distance<=0.0 || tickValue<=0.0 || tickSizePrice<=0.0) return 0.0;
   return (distance/tickSizePrice)*tickValue;
}

int LotDigitsFromStep(double step)
{
   if(step>=1.0) return 0;
   if(step>=0.1) return 1;
   if(step>=0.01) return 2;
   if(step>=0.001) return 3;
   return 4;
}

double NormalizeLotDown(double rawLot)
{
   double minLot=MarketInfo(Symbol(),MODE_MINLOT);
   double brokerMaxLot=MarketInfo(Symbol(),MODE_MAXLOT);
   double step=MarketInfo(Symbol(),MODE_LOTSTEP);
   if(step<=0.0) step=0.01;
   if(rawLot<minLot-0.0000001) return 0.0;
   rawLot=MathMin(rawLot,brokerMaxLot);
   double lot=MathFloor(rawLot/step+0.0000001)*step;
   if(lot<minLot-0.0000001) return 0.0;
   return NormalizeDouble(lot,LotDigitsFromStep(step));
}

bool ProtectiveStructureAnchor(int dir,double &anchor)
{
   anchor=0.0;
   int available=iBars(Symbol(),SignalTF)-2;
   int count=MathMin(StopLossLookbackBars,available);
   if(count<10) return false;

   int shift=(dir==DIR_BUY ?
              iLowest(Symbol(),SignalTF,MODE_LOW,count,1) :
              iHighest(Symbol(),SignalTF,MODE_HIGH,count,1));
   if(shift<0) return false;

   anchor=(dir==DIR_BUY ?
           iLow(Symbol(),SignalTF,shift) :
           iHigh(Symbol(),SignalTF,shift));
   return anchor>0.0;
}

double SelectedStopPrice(int dir,double openPrice)
{
   double minimumDistance=MathMax(MinimumStopDistancePointsValue*Point,
                                  MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point);
   double fixedDistance=MathMax(minimumDistance,FixedStopDistancePointsValue*Point);
   double atr=iATR(Symbol(),SignalTF,StopATRPeriodValue,1);
   double atrDistance=(atr>0.0 ? atr*StopATRMultiplierValue : fixedDistance);
   atrDistance=MathMax(minimumDistance,atrDistance);

   double structureDistance=0.0;
   double structureAnchor=0.0;
   if(ProtectiveStructureAnchor(dir,structureAnchor))
   {
      double structureStop=(dir==DIR_BUY ?
                            structureAnchor-StructureStopBufferPointsValue*Point :
                            structureAnchor+StructureStopBufferPointsValue*Point);
      if((dir==DIR_BUY && structureStop<openPrice) ||
         (dir==DIR_SELL && structureStop>openPrice))
         structureDistance=MathAbs(openPrice-structureStop);
   }

   double distance=fixedDistance;
   if(StopControl==STOP_ATR) distance=atrDistance;
   else if(StopControl==STOP_STRUCTURE)
      distance=(structureDistance>0.0 ? structureDistance : atrDistance);
   else if(StopControl==STOP_WIDER_OF_STRUCTURE_OR_ATR)
      distance=MathMax(atrDistance,structureDistance);

   distance=MathMax(minimumDistance,distance);
   double stop=(dir==DIR_BUY ? openPrice-distance : openPrice+distance);
   double tick=TickSizePrice();
   if(tick>0.0)
   {
      if(dir==DIR_BUY) stop=MathFloor(stop/tick)*tick;
      else stop=MathCeil(stop/tick)*tick;
   }
   return NormalizeDouble(stop,Digits);
}

double SelectedTakeProfitPrice(int dir,double openPrice,double stopPrice)
{
   if(TakeProfitSLRatioValue<=0.0 || stopPrice<=0.0) return 0.0;

   double stopDistance=MathAbs(openPrice-stopPrice);
   if(stopDistance<=0.0) return 0.0;

   // Preserve the selected R multiple. If the broker's minimum target distance
   // is larger, use the minimum valid distance rather than sending an invalid TP.
   double brokerMinimum=MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point;
   double targetDistance=MathMax(stopDistance*TakeProfitSLRatioValue,brokerMinimum);
   double target=(dir==DIR_BUY ? openPrice+targetDistance : openPrice-targetDistance);
   double tick=TickSizePrice();
   if(tick>0.0)
   {
      if(dir==DIR_BUY) target=MathCeil(target/tick)*tick;
      else target=MathFloor(target/tick)*tick;
   }
   return NormalizeDouble(target,Digits);
}

double OrderRiskMoneyFromPrices(double openPrice,double stopPrice,double lots)
{
   return CashLossPerLot(openPrice,stopPrice)*lots;
}

double OpenCampaignRiskMoney()
{
   double risk=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderStopLoss()<=0.0)
         return AccountRiskBase()*100.0; // Existing unprotected order blocks more risk.
      risk+=OrderRiskMoneyFromPrices(OrderOpenPrice(),OrderStopLoss(),OrderLots());
   }
   return risk;
}

double CalculateRiskLotForPercent(double openPrice,double stopPrice,double riskPercent,
                                  double campaignCapPercent,bool enforceCampaignCap,bool logReason)
{
   double accountBase=AccountRiskBase();
   double requestedRiskMoney=accountBase*MathMax(0.0,riskPercent)/100.0;
   double lossPerLot=CashLossPerLot(openPrice,stopPrice);
   if(accountBase<=0.0 || requestedRiskMoney<=0.0 || lossPerLot<=0.0)
   {
      if(logReason) Print("HT percentage sizing blocked: invalid account base, SL, or tick data");
      return 0.0;
   }
   if(enforceCampaignCap)
   {
      double campaignRiskCap=accountBase*MathMax(riskPercent,campaignCapPercent)/100.0;
      double openRisk=OpenCampaignRiskMoney();
      if(openRisk+requestedRiskMoney>campaignRiskCap+0.01)
      {
         if(logReason) Print("HT percentage order blocked by campaign cap. requestedRisk=",
                            DoubleToString(requestedRiskMoney,2)," openRisk=",DoubleToString(openRisk,2),
                            " cap=",DoubleToString(campaignRiskCap,2));
         return 0.0;
      }
   }
   double rawLot=requestedRiskMoney/lossPerLot;
   double lot=NormalizeLotDown(rawLot);
   if(lot<=0.0)
   {
      if(logReason) Print("HT exact percentage lot below broker minimum. risk=",
                         DoubleToString(riskPercent,1),"% money=",DoubleToString(requestedRiskMoney,2),
                         " rawLot=",DoubleToString(rawLot,4));
      return 0.0;
   }
   double actualRisk=lossPerLot*lot;
   if(actualRisk>requestedRiskMoney+0.01) return 0.0;
   return lot;
}

double CalculateRiskLot(double openPrice,double stopPrice,double riskFraction,bool enforceCampaignCap,bool logReason)
{
   return CalculateRiskLotForPercent(openPrice,stopPrice,RiskPerEntryPercent,
                                     MaximumCampaignRiskPercent,enforceCampaignCap,logReason);
}

double PreviewRiskLot(int dir,double riskFraction)
{
   RefreshRates();
   double price=(dir==DIR_BUY ? Ask : Bid);
   double stop=SelectedStopPrice(dir,price);
   return CalculateRiskLot(price,stop,riskFraction,true,false);
}

double PreviewStopDistancePoints(int dir)
{
   RefreshRates();
   double price=(dir==DIR_BUY ? Ask : Bid);
   double stop=SelectedStopPrice(dir,price);
   return MathAbs(price-stop)/Point;
}

bool SignalTimeIsFresh(datetime signalTime)
{
   if(signalTime<=0) return false;
   int maxAgeSeconds=MathMax(1,EntrySignalExpiryBars)*PeriodSeconds(SignalTF);
   return signalTime>=TimeCurrent()-maxAgeSeconds;
}


//---------------------------------------------------------
// Trend / Cloud / Transition regime helpers.
bool CurrentCloudBounds(double &top,double &bottom,double &middle)
{
   double a=0.0,b=0.0;
   if(!IchimokuCloudValue(0,a,b)) return false;
   top=MathMax(a,b); bottom=MathMin(a,b); middle=(top+bottom)*0.5;
   return top>bottom;
}

bool CloudBoundsAtShift(int chartShift,double &top,double &bottom,double &middle)
{
   double a=0.0,b=0.0;
   if(!IchimokuCloudValue(chartShift,a,b)) return false;
   top=MathMax(a,b); bottom=MathMin(a,b); middle=(top+bottom)*0.5;
   return top>bottom;
}

bool PriceInsideCloudAtShift(int shift)
{
   double top=0,bottom=0,mid=0;
   if(!CloudBoundsAtShift(shift,top,bottom,mid)) return false;
   double p=(shift==0 ? MidPrice() : iClose(Symbol(),SignalTF,shift));
   return p>=bottom && p<=top;
}

int ConsecutiveCompletedBarsInsideCloud()
{
   int count=0;
   for(int s=1;s<=20;s++)
   {
      if(!PriceInsideCloudAtShift(s)) break;
      count++;
   }
   return count;
}

int RecentArrowFlips(int secondsBack)
{
   int n=0;
   datetime cutoff=TimeCurrent()-secondsBack;
   for(int i=0;i<gChopFlipStored;i++) if(gChopFlipTimes[i]>=cutoff) n++;
   return n;
}

int CalculateConsolidationScore()
{
   double top=0,bottom=0,mid=0;
   if(!CurrentCloudBounds(top,bottom,mid)) return 0;
   double p=MidPrice();
   double atr=iATR(Symbol(),SignalTF,14,1);
   if(atr<=0.0) return 0;
   int score=0;
   if(p>=bottom && p<=top) score++;

   double tenkan=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                          IchimokuSpanBPeriod,MODE_TENKANSEN,1);
   double kijun=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                         IchimokuSpanBPeriod,MODE_KIJUNSEN,1);
   if(MathAbs(tenkan-kijun)<=0.35*atr) score++;

   double kijunOld=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                            IchimokuSpanBPeriod,MODE_KIJUNSEN,4);
   if(MathAbs(kijun-kijunOld)<=0.20*atr) score++;

   double topOld=0,bottomOld=0,midOld=0;
   if(CloudBoundsAtShift(3,topOld,bottomOld,midOld) &&
      MathAbs(top-topOld)<=0.25*atr && MathAbs(bottom-bottomOld)<=0.25*atr) score++;

   if(ConsecutiveCompletedBarsInsideCloud()>=CloudMinimumBarsInsideValue) score++;

   int recentHi=iHighest(Symbol(),SignalTF,MODE_HIGH,4,1);
   int recentLo=iLowest(Symbol(),SignalTF,MODE_LOW,4,1);
   int priorHi=iHighest(Symbol(),SignalTF,MODE_HIGH,4,5);
   int priorLo=iLowest(Symbol(),SignalTF,MODE_LOW,4,5);
   double priorAtr=iATR(Symbol(),SignalTF,14,5);
   if(recentHi>=0 && recentLo>=0 && priorHi>=0 && priorLo>=0 && priorAtr>0.0)
   {
      double recentRatio=(iHigh(Symbol(),SignalTF,recentHi)-iLow(Symbol(),SignalTF,recentLo))/atr;
      double priorRatio=(iHigh(Symbol(),SignalTF,priorHi)-iLow(Symbol(),SignalTF,priorLo))/priorAtr;
      if(recentRatio<=priorRatio*0.90) score++;
   }

   if(RecentArrowFlips(10*60)>=3) score++;
   return score;
}

int ConfirmedCloudBreakoutDirection()
{
   int bars=BreakoutConfirmationBarsValue;
   if(bars<=0)
   {
      double top=0.0,bottom=0.0,mid=0.0;
      if(!CurrentCloudBounds(top,bottom,mid)) return DIR_FLAT;
      double p=MidPrice();
      if(p>top) return DIR_BUY;
      if(p<bottom) return DIR_SELL;
      return DIR_FLAT;
   }
   bool allAbove=true,allBelow=true;
   for(int s=1;s<=bars;s++)
   {
      double top=0,bottom=0,mid=0;
      if(!CloudBoundsAtShift(s,top,bottom,mid)) return DIR_FLAT;
      double c=iClose(Symbol(),SignalTF,s);
      if(c<=top) allAbove=false;
      if(c>=bottom) allBelow=false;
   }
   if(allAbove) return DIR_BUY;
   if(allBelow) return DIR_SELL;
   return DIR_FLAT;
}

bool RecentCompletedCloudContact(int lookbackBars)
{
   for(int s=1;s<=MathMax(1,lookbackBars);s++)
      if(PriceInsideCloudAtShift(s)) return true;
   return false;
}

HT_InternalMarketRegime DetermineMarketRegime()
{
   double top=0,bottom=0,mid=0;
   if(!CurrentCloudBounds(top,bottom,mid)) return MARKET_TRANSITION;
   gCloudTop=top; gCloudBottom=bottom; gCloudMid=mid;
   double width=MathMax(top-bottom,Point);
   gCloudPosition=MathMax(0.0,MathMin(1.0,(MidPrice()-bottom)/width));
   gConsolidationScore=CalculateConsolidationScore();
   bool inside=(MidPrice()>=bottom && MidPrice()<=top);

   bool barsConfirmed=(ConsecutiveCompletedBarsInsideCloud()>=CloudMinimumBarsInsideValue);
   bool consolidationConfirmed=(barsConfirmed && gConsolidationScore>=ConsolidationScoreThresholdValue);

   if(RegimeControl==REGIME_CLOUD_HARVEST_ONLY)
      return (inside && consolidationConfirmed) ? MARKET_CLOUD : MARKET_TRANSITION;
   if(RegimeControl==REGIME_TREND_ATTACK_ONLY)
      return inside ? MARKET_TRANSITION : MARKET_TREND;
   if(RegimeControl==REGIME_TREND_PLUS_FORCE_CLOUD_HARVEST)
      return inside ? MARKET_CLOUD : MARKET_TREND;

   if(inside)
      return consolidationConfirmed ? MARKET_CLOUD : MARKET_TRANSITION;

   // Outside-cloud behavior is immediate when BREAKOUT_CONFIRM_IMMEDIATE is selected.
   // If the user selects a completed-bar breakout confirmation, Transition Defense
   // remains active only for that requested confirmation window.
   if(BreakoutConfirmationBarsValue>0 &&
      RecentCompletedCloudContact(BreakoutConfirmationBarsValue+2) &&
      ConfirmedCloudBreakoutDirection()==DIR_FLAT)
      return MARKET_TRANSITION;
   return MARKET_TREND;
}

string MarketRegimeText()
{
   if(gMarketRegime==MARKET_CLOUD) return "CLOUD HARVEST";
   if(gMarketRegime==MARKET_TRANSITION) return "TRANSITION DEFENSE";
   return "TREND ATTACK";
}

void UpdateCloudRegimeAnchor()
{
   if(gMarketRegime==MARKET_CLOUD &&
      (gPreviousMarketRegime!=MARKET_CLOUD || gCloudRegimeStartEquity<=0.0))
   {
      gCloudRegimeStartTime=TimeCurrent();
      gCloudRegimeStartEquity=AccountEquity();
      gCloudEquityFloorBreached=false;
      gCloudLossPauseUntil=0;
      gCloudConsecutiveLosses=0;
      gCloudArrowCandidateDirection=DIR_FLAT;
      gCloudArrowCandidateTicks=0;
      gCloudReversalCandidateDirection=DIR_FLAT;
      gCloudReversalCandidateTicks=0;
   }
   if(gMarketRegime!=MARKET_CLOUD && gPreviousMarketRegime==MARKET_CLOUD)
   {
      gCloudRegimeStartTime=0;
      gCloudRegimeStartEquity=0.0;
      gCloudEquityFloorBreached=false;
      gCloudLossPauseUntil=0;
      gCloudConsecutiveLosses=0;
      gCloudReversalCandidateDirection=DIR_FLAT;
      gCloudReversalCandidateTicks=0;
      gChopPauseUntil=0; // Cloud oscillations do not handicap a confirmed breakout.
   }
}

bool IsCloudOrderSelected()
{
   return OurOrder() && StringFind(OrderComment(),"CLOUD_")>=0;
}

bool HasOpenCloudTrade()
{
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && IsCloudOrderSelected()) return true;
   return false;
}

bool CloseCloudHarvestTrades(string reason)
{
   bool ok=true;
   for(int pass=0;pass<3;pass++)
   {
      for(int i=OrdersTotal()-1;i>=0;i--)
      {
         if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !IsCloudOrderSelected()) continue;
         RefreshRates();
         double px=(OrderType()==OP_BUY?Bid:Ask);
         if(!OrderClose(OrderTicket(),OrderLots(),px,SlippagePoints,clrNONE)) ok=false;
      }
   }
   Print("HT Trend/Cloud closed CLOUD HARVEST: ",reason);
   return ok;
}

void ResetCloudReversalExitConfirmation()
{
   gCloudReversalCandidateDirection=DIR_FLAT;
   gCloudReversalCandidateTicks=0;
}

int OpenCloudPositionDirection()
{
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !IsCloudOrderSelected()) continue;
      if(OrderType()==OP_BUY) return DIR_BUY;
      if(OrderType()==OP_SELL) return DIR_SELL;
   }
   return DIR_FLAT;
}

datetime OldestOpenCloudTradeTime()
{
   datetime oldest=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !IsCloudOrderSelected()) continue;
      if(oldest==0 || OrderOpenTime()<oldest) oldest=OrderOpenTime();
   }
   return oldest;
}

void ManageCloudHarvestExit()
{
   if(!HasOpenCloudTrade())
   {
      ResetCloudReversalExitConfirmation();
      return;
   }

   // Cloud scalps are regime-specific. If the cloud regime disappears, bank/stop the scalp
   // instead of allowing it to become a trend-sized hold.
   if(gMarketRegime!=MARKET_CLOUD && CloseCloudOnRegimeChange)
   {
      CloseCloudHarvestTrades("cloud regime changed");
      ResetCloudReversalExitConfirmation();
      return;
   }

   // A rapid scalp must not silently turn into a 25-50 minute position.
   datetime opened=OldestOpenCloudTradeTime();
   if(CloudMaxHoldSecondsValue>0 && opened>0 && TimeCurrent()-opened>=CloudMaxHoldSecondsValue)
   {
      CloseCloudHarvestTrades("cloud maximum hold time");
      ResetCloudReversalExitConfirmation();
      return;
   }

   if(CloudReversalExitTicksValue<=0)
   {
      ResetCloudReversalExitConfirmation();
      return;
   }

   int posDir=OpenCloudPositionDirection();
   int rawDir=RawCloudArrowDirection();
   if(posDir==DIR_FLAT || rawDir==DIR_FLAT || rawDir==posDir)
   {
      ResetCloudReversalExitConfirmation();
      return;
   }

   if(rawDir!=gCloudReversalCandidateDirection)
   {
      gCloudReversalCandidateDirection=rawDir;
      gCloudReversalCandidateTicks=1;
   }
   else gCloudReversalCandidateTicks++;

   gEntryStatus="CLOUD REVERSAL EXIT "+IntegerToString(gCloudReversalCandidateTicks)+"/"+
                IntegerToString(CloudReversalExitTicksValue);

   if(gCloudReversalCandidateTicks>=CloudReversalExitTicksValue)
   {
      CloseCloudHarvestTrades("confirmed cloud-arrow reversal");
      ResetCloudReversalExitConfirmation();
   }
}

bool CloudEquityFloorPasses(bool updateStatus)
{
   if(CloudEquityFloorPercentValue<=0.0 || gCloudRegimeStartEquity<=0.0) return true;
   double floorEquity=gCloudRegimeStartEquity*(1.0-CloudEquityFloorPercentValue/100.0);
   if(AccountEquity()>floorEquity) return true;
   gCloudEquityFloorBreached=true;
   if(updateStatus) gEntryStatus="CLOUD EQUITY FLOOR BREACHED";
   if(HasOpenCloudTrade()) CloseCloudHarvestTrades("cloud equity floor");
   return false;
}

void RefreshCloudMinuteCounter()
{
   datetime now=TimeCurrent();
   datetime minuteStart=now-TimeSeconds(now);
   if(minuteStart!=gCloudTrackedMinuteStart)
   {
      gCloudTrackedMinuteStart=minuteStart;
      gCloudTradesThisMinute=0;
   }
}

bool CloudEntryGatePasses(bool updateStatus)
{
   RefreshClosedTradeStats();
   RefreshCloudMinuteCounter();
   if(gCloudEquityFloorBreached || !CloudEquityFloorPasses(updateStatus)) return false;
   if(gCloudLossPauseUntil>TimeCurrent())
   {
      if(updateStatus) gEntryStatus="CLOUD LOSS PAUSE "+IntegerToString((int)(gCloudLossPauseUntil-TimeCurrent()))+"s";
      return false;
   }
   if(CloudReentryDelaySecondsValue>0 && gLastCloudCloseTime>0 &&
      TimeCurrent()-gLastCloudCloseTime<CloudReentryDelaySecondsValue)
   {
      if(updateStatus) gEntryStatus="CLOUD REENTRY DELAY";
      return false;
   }
   if(gCloudTradesThisMinute>=CloudMaxTradesPerMinuteValue)
   {
      if(updateStatus) gEntryStatus="CLOUD MAX TRADES/MINUTE";
      return false;
   }
   return true;
}

int RawCloudArrowDirection()
{
   if(!gLiveWeightReady) return DIR_FLAT;
   if(gArrowSlope>CloudArrowMinimumSlopeValue) return DIR_BUY;
   if(gArrowSlope<-CloudArrowMinimumSlopeValue) return DIR_SELL;
   return DIR_FLAT;
}

void UpdateCloudArrowConfirmation()
{
   int raw=RawCloudArrowDirection();
   if(raw==DIR_FLAT)
   {
      gCloudArrowCandidateDirection=DIR_FLAT;
      gCloudArrowCandidateTicks=0;
      return;
   }
   if(raw!=gCloudArrowCandidateDirection)
   {
      gCloudArrowCandidateDirection=raw;
      gCloudArrowCandidateTicks=1;
   }
   else gCloudArrowCandidateTicks++;
}

int ConfirmedCloudArrowDirection()
{
   if(gCloudArrowCandidateTicks<CloudArrowConfirmationTicksValue) return DIR_FLAT;
   return gCloudArrowCandidateDirection;
}

//---------------------------------------------------------
// FVG: completed candle 1 leaves a gap from completed candle 3.
bool EMAAllows(int dir)
{
   if(!RequireEMAAlignment) return true;
   double f=iMA(Symbol(),SignalTF,FastEMA,0,MODE_EMA,PRICE_CLOSE,1);
   double s=iMA(Symbol(),SignalTF,SlowEMA,0,MODE_EMA,PRICE_CLOSE,1);
   return dir==DIR_BUY ? f>s : f<s;
}

bool IchimokuAllows(int dir)
{
   // In the default Trend/Cloud architecture the regime controller already
   // decides whether we are in MARKET_TREND. Do not then require a second
   // strict Ichimoku structure unless the user explicitly selects it.
   if(TrendEntryFilter==TREND_FILTER_CLOUD_SIDE_ONLY)
   {
      double top=0.0,bottom=0.0,mid=0.0;
      if(!CurrentCloudBounds(top,bottom,mid)) return false;
      double p=MidPrice();
      return (dir==DIR_BUY ? p>top : p<bottom);
   }

   if(IchimokuTrendFilter==ICHIMOKU_FILTER_OFF) return true;
   if(iBars(Symbol(),SignalTF)<IchimokuSpanBPeriod+IchimokuKijunPeriod+10) return false;

   int shift=1; // Strict mode uses the last completed candle.
   int cloudShift=shift+IchimokuKijunPeriod; // Align the forward-shifted cloud with this candle.
   double closePrice=iClose(Symbol(),SignalTF,shift);
   double spanA=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                         IchimokuSpanBPeriod,MODE_SENKOUSPANA,cloudShift);
   double spanB=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                         IchimokuSpanBPeriod,MODE_SENKOUSPANB,cloudShift);
   if(spanA==EMPTY_VALUE || spanB==EMPTY_VALUE || spanA<=0.0 || spanB<=0.0) return false;

   double cloudTop=MathMax(spanA,spanB);
   double cloudBottom=MathMin(spanA,spanB);
   bool pricePass=(dir==DIR_BUY ? closePrice>cloudTop : closePrice<cloudBottom);
   if(!pricePass) return false;
   if(IchimokuTrendFilter==ICHIMOKU_PRICE_OUTSIDE_CLOUD) return true;

   double tenkan=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                          IchimokuSpanBPeriod,MODE_TENKANSEN,shift);
   double kijun=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                         IchimokuSpanBPeriod,MODE_KIJUNSEN,shift);
   bool linePass=(dir==DIR_BUY ? tenkan>kijun : tenkan<kijun);
   bool cloudPass=(dir==DIR_BUY ? spanA>spanB : spanA<spanB);
   return linePass && cloudPass;
}

bool ZeroDegreeBreakSignal(int dir)
{
   if(EarlyEntryControl!=EARLY_ENTRY_ZERO_DEGREE_BREAK || !gLiveWeightReady) return false;

   // The red WEIGHT arrow starts at the triangle midpoint. Its slope is
   // positive above gMid and negative below gMid, so a zero-degree break is
   // represented by the normalized weight crossing zero.
   if(dir==DIR_BUY) return gPreviousLiveWeight<=0.0 && gWeight>0.0;
   return gPreviousLiveWeight>=0.0 && gWeight<0.0;
}

bool FindFVG(int dir,double &top,double &bottom,datetime &when)
{
   int bars=MathMin(FVGScanBars,iBars(Symbol(),SignalTF)-4);
   for(int n=1;n<=bars;n++)
   {
      int old=n+2;
      if(dir==DIR_BUY)
      {
         double newerLow=iLow(Symbol(),SignalTF,n);
         double olderHigh=iHigh(Symbol(),SignalTF,old);
         if(newerLow>olderHigh && (newerLow-olderHigh)/Point>=MinimumFVGPoints)
         {
            top=newerLow; bottom=olderHigh; when=iTime(Symbol(),SignalTF,n);
            return true;
         }
      }
      else
      {
         double newerHigh=iHigh(Symbol(),SignalTF,n);
         double olderLow=iLow(Symbol(),SignalTF,old);
         if(newerHigh<olderLow && (olderLow-newerHigh)/Point>=MinimumFVGPoints)
         {
            top=olderLow; bottom=newerHigh; when=iTime(Symbol(),SignalTF,n);
            return true;
         }
      }
   }
   return false;
}

bool TouchesFVG(int dir,double top,double bottom)
{
   double p=MidPrice(),tol=FVGTouchTolerancePoints*Point;
   double trigger=EnterAtFVGHalf?(top+bottom)*0.5:(dir==DIR_BUY?top:bottom);
   if(dir==DIR_BUY) return p<=trigger+tol && p>=bottom-tol;
   return p>=trigger-tol && p<=top+tol;
}


bool FVGRejectionPasses(int dir,double top,double bottom)
{
   if(!RequireFVGRejectionCandle) return true;

   double o=iOpen(Symbol(),SignalTF,1);
   double c=iClose(Symbol(),SignalTF,1);
   double h=iHigh(Symbol(),SignalTF,1);
   double l=iLow(Symbol(),SignalTF,1);
   double range=MathMax(h-l,Point);
   double closeLocation=(c-l)/range;
   double midpoint=(top+bottom)*0.5;

   if(dir==DIR_BUY)
      return c>o && c>=midpoint && closeLocation>=RejectionCloseLocation;

   return c<o && c<=midpoint &&
          closeLocation<=(1.0-RejectionCloseLocation);
}

double DirectionalAngle(int dir)
{
   return dir==DIR_BUY ? gAngle : -gAngle;
}

double DirectionalWeight(int dir)
{
   return dir==DIR_BUY ? gWeight : -gWeight;
}

double DirectionalAngleVelocity(int dir)
{
   return dir==DIR_BUY ? gAngleVelocity : -gAngleVelocity;
}

double DirectionalAngleAcceleration(int dir)
{
   return dir==DIR_BUY ? gAngleAcceleration : -gAngleAcceleration;
}

bool TriangleMovementEntryPasses(int dir)
{
   if(!RequireTriangleMovementEntry) return true;
   if(gHigh<=gLow) return false;

   double a=DirectionalAngle(dir);
   double w=DirectionalWeight(dir);
   double v=DirectionalAngleVelocity(dir);
   double accel=DirectionalAngleAcceleration(dir);

   if(a<EntryAngleDegrees) return false;
   if(w<EntryMinimumDirectionalWeight ||
      w>EntryMaximumDirectionalWeight) return false;
   if(v<EntryMinimumAngleVelocity) return false;
   if(RequirePositiveEntryAcceleration && accel<=0.0) return false;

   return true;
}

bool ConfirmEntryMovement(int dir,datetime fvgTime)
{
   int needed=MathMax(1,EntryConfirmTicks);
   if(gEntryCandidateDirection!=dir || gEntryCandidateFVGTime!=fvgTime)
   {
      gEntryCandidateDirection=dir;
      gEntryCandidateFVGTime=fvgTime;
      gEntryCandidateTicks=1;
      return (needed<=1);
   }

   gEntryCandidateTicks++;
   return gEntryCandidateTicks>=needed;
}

void ResetEntryMovement()
{
   gEntryCandidateDirection=DIR_FLAT;
   gEntryCandidateTicks=0;
   gEntryCandidateFVGTime=0;
}


bool FindTradableFVG(int dir,double &top,double &bottom,datetime &when)
{
   int bars=MathMin(FVGScanBars,iBars(Symbol(),SignalTF)-4);
   for(int n=1;n<=bars;n++)
   {
      int old=n+2;
      double t=0,b=0;
      bool gap=false;
      if(dir==DIR_BUY)
      {
         double newerLow=iLow(Symbol(),SignalTF,n);
         double olderHigh=iHigh(Symbol(),SignalTF,old);
         if(newerLow>olderHigh && (newerLow-olderHigh)/Point>=MinimumFVGPoints)
         { t=newerLow; b=olderHigh; gap=true; }
      }
      else
      {
         double newerHigh=iHigh(Symbol(),SignalTF,n);
         double olderLow=iLow(Symbol(),SignalTF,old);
         if(newerHigh<olderLow && (olderLow-newerHigh)/Point>=MinimumFVGPoints)
         { t=olderLow; b=newerHigh; gap=true; }
      }
      if(!gap) continue;
      if(!TouchesFVG(dir,t,b)) continue;
      if(!FVGRejectionPasses(dir,t,b)) continue;
      top=t; bottom=b; when=iTime(Symbol(),SignalTF,n);
      return true;
   }
   return false;
}

bool OppositeRecentFVG()
{
   if(gDirection==DIR_FLAT) return false;
   double t,b; datetime when;
   if(!FindFVG(-gDirection,t,b,when)) return false;
   return when>=TimeCurrent()-PeriodSeconds(SignalTF)*MathMax(1,OppositeFVGRecentBars);
}

bool HightowerLaunchSignal(int dir)
{
   if(!AllowHightowerLaunchEntry) return false;
   int bars=MathMax(3,LaunchBreakoutLookback);
   double priorHigh=iHigh(Symbol(),SignalTF,2);
   double priorLow=iLow(Symbol(),SignalTF,2);
   for(int i=3;i<3+bars;i++)
   {
      priorHigh=MathMax(priorHigh,iHigh(Symbol(),SignalTF,i));
      priorLow=MathMin(priorLow,iLow(Symbol(),SignalTF,i));
   }
   double o=iOpen(Symbol(),SignalTF,1), c=iClose(Symbol(),SignalTF,1);
   double body=MathAbs(c-o)/Point;
   if(RequireLaunchCandleBody && body<MinimumLaunchBodyPoints) return false;
   double buffer=LaunchBreakBufferPoints*Point;
   if(dir==DIR_BUY) return c>priorHigh+buffer && c>o && EMAAllows(dir);
   return c<priorLow-buffer && c<o && EMAAllows(dir);
}

bool MomentumSignal(int dir)
{
   if(!AllowMomentumEntry) return false;
   // Legacy momentum mode now follows live WEIGHT-arrow slope, not midpoint position.
   double arrowSlope=gWeight-gPreviousLiveWeight;
   double minimumSlope=ArrowMinimumSlopeValue;
   if(dir==DIR_BUY) return arrowSlope>minimumSlope;
   if(dir==DIR_SELL) return arrowSlope<-minimumSlope;
   return false;
}

int RawWeightArrowDirection()
{
   if(!gLiveWeightReady || gHigh<=gLow) return DIR_FLAT;
   if(gArrowSlope>ArrowMinimumSlopeValue) return DIR_BUY;
   if(gArrowSlope<-ArrowMinimumSlopeValue) return DIR_SELL;
   return DIR_FLAT;
}

void ResetArrowDirectionConfirmation()
{
   gRawArrowDirection=DIR_FLAT;
   gArrowCandidateDirection=DIR_FLAT;
   gArrowCandidateTicks=0;
   gConfirmedArrowDirection=DIR_FLAT;
}

void UpdateArrowDirectionConfirmation()
{
   int raw=RawWeightArrowDirection();
   gRawArrowDirection=raw;
   if(raw==DIR_FLAT)
   {
      gArrowCandidateDirection=DIR_FLAT;
      gArrowCandidateTicks=0;
      gConfirmedArrowDirection=DIR_FLAT;
      return;
   }

   if(raw!=gArrowCandidateDirection)
   {
      gArrowCandidateDirection=raw;
      gArrowCandidateTicks=1;
   }
   else
      gArrowCandidateTicks++;

   if(gArrowCandidateTicks>=ArrowConfirmationTicksValue)
      gConfirmedArrowDirection=raw;
   else
      gConfirmedArrowDirection=DIR_FLAT;
}

int WeightArrowDirection()
{
   return gConfirmedArrowDirection;
}

int TrendArrowDirection()
{
   if(TrendArrowSignal==TREND_ARROW_RAW_QUALIFYING_TICK)
      return RawWeightArrowDirection();
   return WeightArrowDirection();
}

double ArithmeticGridWeight(int index)
{
   return MathMax(0.0,1.0+MathMax(0,index)*ArithmeticSpacingStepValue);
}

double ArithmeticGridWeightSum(int entries)
{
   entries=MathMax(1,entries);
   double sum=0.0;
   for(int i=0;i<entries;i++) sum+=ArithmeticGridWeight(i);
   return MathMax(sum,1.0);
}

double ArrowArithmeticRiskFraction(int dir)
{
   // Every arrow order uses exactly the percentage selected in RiskPerTrade.
   return 1.0;
}

double ArithmeticGridThreshold(int openedEntries)
{
   // First entry is at 0% progress. Every later slot is placed strictly before
   // the first TP, so the final permitted add-on is not stranded at 100%.
   int spacingSlots=MathMax(1,SafeMaximumEntries);
   int completed=MathMax(0,MathMin(openedEntries,SafeMaximumEntries-1));
   if(completed<=0) return 0.0;

   double total=0.0,cumulative=0.0;
   for(int i=0;i<spacingSlots;i++)
   {
      double weight=ArithmeticGridWeight(i);
      total+=weight;
      if(i<completed) cumulative+=weight;
   }
   if(total<=0.0) return (double)completed/(double)spacingSlots;
   return MathMin(0.999999,cumulative/total);
}

bool ProjectedMarginMetrics(int type,double lot,double &freeAfter,double &marginLevelAfter,double &freeReservePercent)
{
   freeAfter=0.0; marginLevelAfter=0.0; freeReservePercent=0.0;
   if(lot<=0.0) return false;

   ResetLastError();
   freeAfter=AccountFreeMarginCheck(Symbol(),type,lot);
   int err=GetLastError();
   if(freeAfter<=0.0 || err==134) return false;

   double equity=MathMax(0.0,AccountEquity());
   double additionalMargin=MathMax(0.0,AccountFreeMargin()-freeAfter);
   double projectedMargin=MathMax(0.0,AccountMargin()+additionalMargin);
   marginLevelAfter=(projectedMargin>0.0 ? equity/projectedMargin*100.0 : 999999.0);
   freeReservePercent=(equity>0.0 ? freeAfter/equity*100.0 : 0.0);
   return true;
}

bool MarginSafetyPasses(int type,double lot,bool recordMetrics)
{
   if(!UseMarginSafeGrid) return true;
   double freeAfter=0.0,levelAfter=0.0,reservePercent=0.0;
   bool valid=ProjectedMarginMetrics(type,lot,freeAfter,levelAfter,reservePercent);
   if(recordMetrics)
   {
      gLastProjectedMarginLevel=levelAfter;
      gLastProjectedFreeMarginPercent=reservePercent;
   }
   if(!valid) return false;
   return levelAfter>=MinimumProjectedMarginLevel &&
          reservePercent>=MinimumFreeMarginReservePercent;
}

double FitLotToMarginSafety(int type,double requestedLot)
{
   requestedLot=NormalizeLotDown(requestedLot);
   if(requestedLot<=0.0) return 0.0;
   if(!UseMarginSafeGrid) return requestedLot;

   // Percentage authority rule: margin safety may block the exact order, but it
   // may never reduce the lot and thereby substitute a different percentage.
   if(MarginSafetyPasses(type,requestedLot,true)) return requestedLot;
   return 0.0;
}

int ArrowSequenceFromComment(string comment,int dir)
{
   string marker=TradeComment+"_"+(dir==DIR_BUY?"ARROW_BUY_":"ARROW_SELL_");
   int pos=StringFind(comment,marker,0);
   if(pos<0) return 0;
   return (int)StringToInteger(StringSubstr(comment,pos+StringLen(marker)));
}

int HighestArrowSequenceSince(int dir,datetime sinceTime)
{
   int highest=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(dir==DIR_BUY && OrderType()!=OP_BUY) continue;
      if(dir==DIR_SELL && OrderType()!=OP_SELL) continue;
      if(sinceTime>0 && OrderOpenTime()<sinceTime) continue;
      highest=(int)MathMax(highest,ArrowSequenceFromComment(OrderComment(),dir));
   }
   for(int h=OrdersHistoryTotal()-1;h>=0;h--)
   {
      if(!OrderSelect(h,SELECT_BY_POS,MODE_HISTORY) || !OurOrder()) continue;
      if(dir==DIR_BUY && OrderType()!=OP_BUY) continue;
      if(dir==DIR_SELL && OrderType()!=OP_SELL) continue;
      if(sinceTime>0 && OrderOpenTime()<sinceTime) continue;
      highest=(int)MathMax(highest,ArrowSequenceFromComment(OrderComment(),dir));
   }
   return highest;
}

int HighestOpenArrowSequence(int dir)
{
   return HighestArrowSequenceSince(dir,gArrowCampaignStartTime);
}

bool ClosedAtProtectiveStop()
{
   if(OrderStopLoss()<=0.0 || OrderCloseTime()<=0) return false;
   double tolerance=MathMax(TickSizePrice()*2.0,Point*3.0);
   return MathAbs(OrderClosePrice()-OrderStopLoss())<=tolerance;
}

void RefreshArrowCampaignHistoryState()
{
   if(gArrowCampaignDirection==DIR_FLAT || gArrowCampaignStartTime<=0) return;
   int highest=HighestArrowSequenceSince(gArrowCampaignDirection,gArrowCampaignStartTime);
   if(highest>gArrowSequenceIndex) gArrowSequenceIndex=highest;

   if(!StopGridAfterFirstAddonSL || gGridStoppedAfterSL) return;
   for(int h=OrdersHistoryTotal()-1;h>=0;h--)
   {
      if(!OrderSelect(h,SELECT_BY_POS,MODE_HISTORY) || !OurOrder()) continue;
      if(OrderOpenTime()<gArrowCampaignStartTime) continue;
      if(gArrowCampaignDirection==DIR_BUY && OrderType()!=OP_BUY) continue;
      if(gArrowCampaignDirection==DIR_SELL && OrderType()!=OP_SELL) continue;
      int sequence=ArrowSequenceFromComment(OrderComment(),gArrowCampaignDirection);
      if(sequence<2) continue;
      if(ClosedAtProtectiveStop())
      {
         gGridStoppedAfterSL=true;
         gSafetyBlockReason="GRID FROZEN AFTER ADD-ON SL #"+IntegerToString(sequence);
         Print("HT grid additions frozen: arrow add-on #",sequence," closed at SL");
         return;
      }
   }
}

bool RebuildArrowCampaignGrid(int dir)
{
   // Preserve the original campaign entry-to-TP route while the EA remains
   // attached. Rebuilding from open orders is only a restart/recovery fallback.
   if(gArrowCampaignDirection==dir && gArrowCampaignAnchorPrice>0.0 &&
      gArrowCampaignTargetPrice>0.0)
   {
      RefreshArrowCampaignHistoryState();
      int highest=HighestArrowSequenceSince(dir,gArrowCampaignStartTime);
      gArrowSequenceIndex=MathMax(gArrowSequenceIndex,highest);
      return true;
   }

   datetime firstTime=0;
   double anchor=0.0,target=0.0;
   int count=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(dir==DIR_BUY && OrderType()!=OP_BUY) continue;
      if(dir==DIR_SELL && OrderType()!=OP_SELL) continue;
      count++;
      if(firstTime==0 || OrderOpenTime()<firstTime)
      {
         firstTime=OrderOpenTime();
         anchor=OrderOpenPrice();
         target=OrderTakeProfit();
      }
   }
   if(count<=0 || anchor<=0.0) return false;

   if(target<=0.0)
   {
      double stop=SelectedStopPrice(dir,anchor);
      target=SelectedTakeProfitPrice(dir,anchor,stop);
   }
   if(target<=0.0) return false;

   gArrowCampaignDirection=dir;
   gArrowCampaignAnchorPrice=anchor;
   gArrowCampaignTargetPrice=target;
   gArrowCampaignStartTime=firstTime;
   int highest=HighestArrowSequenceSince(dir,gArrowCampaignStartTime);
   gArrowSequenceIndex=MathMax(gArrowSequenceIndex,MathMax(count,highest));
   RefreshArrowCampaignHistoryState();
   return true;
}

void ResetArrowCampaignGrid()
{
   gArrowSequenceIndex=0;
   gArrowCampaignDirection=DIR_FLAT;
   gArrowCampaignAnchorPrice=0.0;
   gArrowCampaignTargetPrice=0.0;
   gArrowCampaignStartTime=0;
   gGridStoppedAfterSL=false;
   gSafetyBlockReason="";
}

double ArrowGridProgress(int dir)
{
   if(gArrowCampaignDirection!=dir || gArrowCampaignAnchorPrice<=0.0 ||
      gArrowCampaignTargetPrice<=0.0) return 0.0;
   double path=MathAbs(gArrowCampaignTargetPrice-gArrowCampaignAnchorPrice);
   if(path<=Point) return 0.0;
   RefreshRates();
   double exitPrice=(dir==DIR_BUY ? Bid : Ask);
   double favorable=(dir==DIR_BUY ? exitPrice-gArrowCampaignAnchorPrice :
                                   gArrowCampaignAnchorPrice-exitPrice);
   return favorable/path;
}

bool ArrowGridAllowsNextEntry(int dir)
{
   RefreshArrowCampaignHistoryState();
   if(gGridStoppedAfterSL)
   {
      if(gSafetyBlockReason=="") gSafetyBlockReason="GRID FROZEN AFTER ADD-ON SL";
      return false;
   }
   int sameDirection=TradeCountByDirection(dir);
   if(sameDirection<=0) return true;
   if(sameDirection>=SafeMaximumEntries || gArrowSequenceIndex>=SafeMaximumEntries)
   {
      gSafetyBlockReason="MAX GRID ENTRIES";
      return false;
   }
   if(!RebuildArrowCampaignGrid(dir))
   {
      gSafetyBlockReason="GRID ANCHOR UNAVAILABLE";
      return false;
   }
   double progress=ArrowGridProgress(dir);
   double nextThreshold=ArithmeticGridThreshold(gArrowSequenceIndex);
   if(progress>=1.0)
   {
      gSafetyBlockReason="FIRST TARGET REACHED";
      return false;
   }
   if(progress+0.0000001<nextThreshold)
   {
      gSafetyBlockReason="WAIT GRID "+DoubleToString(nextThreshold*100.0,1)+"%";
      return false;
   }
   return true;
}

double PreviewArrowRiskLot(int dir)
{
   RefreshRates();
   double price=(dir==DIR_BUY ? Ask : Bid);
   double stop=SelectedStopPrice(dir,price);
   return CalculateRiskLot(price,stop,1.0,true,false);
}

//---------------------------------------------------------
// Geometry
bool UpdateStructure()
{
   int count=MathMin(StructureLookbackBars,iBars(Symbol(),SignalTF)-2);
   if(count<10) return false;
   int hs=iHighest(Symbol(),SignalTF,MODE_HIGH,count,1);
   int ls=iLowest(Symbol(),SignalTF,MODE_LOW,count,1);
   if(hs<0 || ls<0) return false;
   double h=iHigh(Symbol(),SignalTF,hs),l=iLow(Symbol(),SignalTF,ls);
   if(h<=l) return false;
   // Every-tick arrow mode needs the midpoint even during quiet ranges.
   // The legacy setup engine may still require its preset minimum range.
   if(ArrowEntryControl==ARROW_ENTRY_OFF_USE_SETUPS &&
      (h-l)/Point<MinimumStructureRangePoints) return false;
   gHigh=h; gLow=l; gMid=(h+l)*0.5;
   gHighTime=iTime(Symbol(),SignalTF,hs);
   gLowTime=iTime(Symbol(),SignalTF,ls);
   return true;
}

void CalculateGeometry()
{
   double previousLiveWeight=gWeight;
   bool hadLiveWeight=gLiveWeightReady;

   gPrice=MidPrice();
   double half=MathMax((gHigh-gLow)*0.5,Point);
   gWeight=(gPrice-gMid)/half;

   int sample=MathMax(1,AngleSampleBars);
   double oldNow=iClose(Symbol(),SignalTF,sample);
   double oldPrev=iClose(Symbol(),SignalTF,sample+1);
   double closePrev=iClose(Symbol(),SignalTF,1);
   double closePrev2=iClose(Symbol(),SignalTF,2);

   double newAngle=MathArctan((gPrice-oldNow)/half)*180.0/3.141592653589793;
   double priorAngle=MathArctan((closePrev-oldPrev)/half)*180.0/3.141592653589793;
   double priorPriorAngle=MathArctan((closePrev2-iClose(Symbol(),SignalTF,sample+2))/half)*180.0/3.141592653589793;

   double priorWeight=(closePrev-gMid)/half;
   gPreviousLiveWeight=(hadLiveWeight ? previousLiveWeight : priorWeight);
   gArrowSlope=gWeight-gPreviousLiveWeight;
   gLiveWeightReady=true;

   gPrevAngle=priorAngle;
   gAngle=newAngle;
   gAngleVelocity=newAngle-priorAngle;
   gAngleAcceleration=gAngleVelocity-(priorAngle-priorPriorAngle);
}

GeoMode ClassifyGeometry()
{
   if(gDirection==DIR_FLAT) return GEO_HOLD;
   double favorableAngle=(gDirection==DIR_BUY?gAngle:-gAngle);
   double favorableWeight=(gDirection==DIR_BUY?gWeight:-gWeight);
   if(favorableWeight>=ExtremeExtensionWeight) return GEO_EXHAUSTION;
   if(favorableWeight>=ExtensionWeight && favorableAngle>0) return GEO_EXHAUSTION;
   if(favorableAngle>=StrongLadderAngleDegrees) return GEO_STRONG_LADDER;
   if(favorableAngle>=LadderAngleDegrees) return GEO_LADDER;
   if(favorableAngle<=-StrongDrawdownAngleDegrees) return GEO_STRONG_DRAWDOWN;
   if(favorableAngle<=-DrawdownAngleDegrees) return GEO_DRAWDOWN;
   return GEO_HOLD;
}

void UpdateMode()
{
   GeoMode request=ClassifyGeometry();
   if(request!=gCandidate){ gCandidate=request; gCandidateTicks=1; return; }
   gCandidateTicks++;
   if(gCandidateTicks>=MathMax(1,ModeConfirmTicks)) gMode=request;
}

string ModeText()
{
   if(gMode==GEO_HOLD) return "HOLD";
   if(gMode==GEO_LADDER) return "LADDER";
   if(gMode==GEO_STRONG_LADDER) return "STRONG LADDER";
   if(gMode==GEO_DRAWDOWN) return "DRAWDOWN";
   if(gMode==GEO_STRONG_DRAWDOWN) return "STRONG DRAWDOWN";
   if(gMode==GEO_EXHAUSTION) return "EXHAUSTION";
   if(gMode==GEO_INVALID) return "INVALID";
   return "OFF";
}

void UpdateCampaignState()
{
   int n=TradeCount();
   if(n<=0){ gCampaignState=CS_FLAT; gDecision="SEARCH ENTRY"; return; }
   if(gMode==GEO_INVALID){ gCampaignState=CS_INVALID; gDecision="CLOSE INVALID"; return; }
   if(gMode==GEO_STRONG_LADDER){ gCampaignState=CS_STRONG_LADDER; gDecision="PRESS ADVANTAGE"; return; }
   if(gMode==GEO_LADDER){ gCampaignState=(n==1?CS_PROVING:CS_LADDER); gDecision="LADDER"; return; }
   if(gMode==GEO_EXHAUSTION){ gCampaignState=CS_EXHAUSTION; gDecision="FREEZE + WATCH HARVEST"; return; }
   if(gMode==GEO_STRONG_DRAWDOWN){ gCampaignState=CS_STRONG_DRAWDOWN; gDecision="DEFEND / INVALIDATE"; return; }
   if(gMode==GEO_DRAWDOWN){ gCampaignState=CS_DRAWDOWN; gDecision="CONTROLLED DEFENSE"; return; }
   gCampaignState=(n==1?CS_ANCHOR:CS_HOLD);
   gDecision="HOLD";
}

string CampaignStateText()
{
   if(gCampaignState==CS_FLAT) return "FLAT";
   if(gCampaignState==CS_ARMED) return "ARMED";
   if(gCampaignState==CS_ANCHOR) return "ANCHOR";
   if(gCampaignState==CS_PROVING) return "PROVING";
   if(gCampaignState==CS_LADDER) return "LADDER";
   if(gCampaignState==CS_STRONG_LADDER) return "STRONG LADDER";
   if(gCampaignState==CS_HOLD) return "HOLD";
   if(gCampaignState==CS_EXHAUSTION) return "EXHAUSTION";
   if(gCampaignState==CS_DRAWDOWN) return "DRAWDOWN";
   if(gCampaignState==CS_STRONG_DRAWDOWN) return "STRONG DRAWDOWN";
   if(gCampaignState==CS_INVALID) return "INVALID";
   return "FLIP ARMED";
}

//---------------------------------------------------------
bool SendPlannedOrder(int dir,double riskPercent,double stop,double takeProfit,
                     string action,bool enforceCampaignCap,bool cloudOrder)
{
   if(!EntryStartTimeGatePasses(true)) return false;
   if(cloudOrder)
   {
      if(!CloudEntryGatePasses(true)) return false;
   }
   else if(!OvertradeEntryGatePasses(dir,true)) return false;

   if(!IsTradeAllowed()){ gEntryStatus="AUTOTRADING NOT ALLOWED"; return false; }
   if(IsTradeContextBusy()){ gEntryStatus="TRADE CONTEXT BUSY"; return false; }

   int type=(dir==DIR_BUY ? OP_BUY : OP_SELL);
   RefreshRates();
   double price=(type==OP_BUY ? Ask : Bid);
   double stopLevel=MarketInfo(Symbol(),MODE_STOPLEVEL)*Point;
   bool invalidStop=(dir==DIR_BUY && (stop<=0.0 || price-stop<stopLevel)) ||
                    (dir==DIR_SELL && (stop<=price || stop-price<stopLevel));
   if(invalidStop){ gEntryStatus="INVALID PROTECTIVE STOP"; return false; }
   bool invalidTarget=(takeProfit>0.0) &&
                      ((dir==DIR_BUY && (takeProfit<=price || takeProfit-price<stopLevel)) ||
                       (dir==DIR_SELL && (takeProfit>=price || price-takeProfit<stopLevel)));
   if(invalidTarget){ gEntryStatus="INVALID TAKE PROFIT"; return false; }

   double capPercent=(cloudOrder ? riskPercent : MaximumCampaignRiskPercent);
   double lot=CalculateRiskLotForPercent(price,stop,riskPercent,capPercent,enforceCampaignCap,true);
   if(lot<=0.0){ gEntryStatus="SELECTED PERCENTAGE CANNOT PRODUCE A VALID LOT"; return false; }

   double requestedLot=lot;
   lot=FitLotToMarginSafety(type,lot);
   if(lot<=0.0)
   {
      gEntryStatus="SELECTED PERCENTAGE FAILS MARGIN SAFETY";
      gSafetyBlockReason="EXACT PERCENTAGE LOT FAILS PROJECTED MARGIN RESERVE";
      return false;
   }
   if(AccountFreeMarginCheck(Symbol(),type,lot)<=0.0){ gEntryStatus="INSUFFICIENT FREE MARGIN"; return false; }

   ResetLastError();
   int ticket=OrderSend(Symbol(),type,lot,price,SlippagePoints,stop,takeProfit,
                        TradeComment+"_"+action,MagicNumber,0,type==OP_BUY?clrDodgerBlue:clrTomato);
   int err=GetLastError();
   if(ticket<0)
   {
      gEntryStatus="ORDER ERROR "+IntegerToString(err);
      Print("HIGHTOWER Trend/Cloud OrderSend failed err=",err,
            " risk%=",DoubleToString(riskPercent,1)," lot=",DoubleToString(lot,2),
            " stop=",DoubleToString(stop,Digits)," tp=",DoubleToString(takeProfit,Digits));
      return false;
   }

   gLastOpenedPrice=price;
   gLastOpenedTakeProfit=takeProfit;
   if(cloudOrder)
   {
      RefreshCloudMinuteCounter();
      gCloudTradesThisMinute++;
   }
   else
   {
      RefreshHourlyTradeCounter();
      gTradesOpenedThisHour++;
      if(gSignalRunDirection==DIR_FLAT){ gSignalRunDirection=dir; gTradesThisSignalDirection=0; }
      if(gSignalRunDirection==dir) gTradesThisSignalDirection++;
   }

   bool first=(TradeCount()==1);
   gLastAdd=TimeCurrent();
   if(first){ gCampaignStart=TimeCurrent(); gPeakProfit=0; }
   return true;
}

bool SendOrder(int dir,double riskFraction,string action,bool enforceCampaignCap)
{
   RefreshRates();
   double price=(dir==DIR_BUY ? Ask : Bid);
   double stop=SelectedStopPrice(dir,price);
   double takeProfit=SelectedTakeProfitPrice(dir,price,stop);
   return SendPlannedOrder(dir,RiskPerEntryPercent,stop,takeProfit,action,enforceCampaignCap,false);
}

bool CloseAllInternal(string reason,bool overrideStrictHold)
{
   // A user-selected strict SL/TP hold must override every software-managed
   // exit, including maximum-campaign-drawdown closes.
   // This centralized guard also protects against future exit paths that may
   // be added elsewhere in the EA.
   if(HoldUntilBrokerStopOrTarget && !overrideStrictHold && TradeCount()>0)
   {
      static datetime lastBlockedLog=0;
      static string lastBlockedReason="";
      if(reason!=lastBlockedReason || TimeCurrent()-lastBlockedLog>=60)
      {
         Print("HIGHTOWER TRIANGLE software close blocked by STRICT SL/TP ONLY: ",reason);
         lastBlockedReason=reason;
         lastBlockedLog=TimeCurrent();
      }
      return false;
   }

   double closingProfit=BasketProfit();
   bool ok=true;
   for(int pass=0;pass<3;pass++)
   {
      for(int i=OrdersTotal()-1;i>=0;i--)
      {
         if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
         RefreshRates();
         double px=(OrderType()==OP_BUY?Bid:Ask);
         if(!OrderClose(OrderTicket(),OrderLots(),px,SlippagePoints,clrNONE)) ok=false;
      }
   }
   if(TradeCount()==0)
   {
      Print("HIGHTOWER Trend/Cloud closed: ",reason," result=",DoubleToString(closingProfit,2));
      gDirection=DIR_FLAT; gPeakProfit=0; gCampaignStart=0; gLastUsedFVGTime=0;
      gRailArmed=false; gRailExitTicks=0;
      ResetMovementTP();
      ResetEntryMovement();
   }
   return ok;
}

bool CloseAll(string reason)
{
   return CloseAllInternal(reason,false);
}

bool CloseAllForConfirmedArrowReversal(string reason)
{
   return CloseAllInternal(reason,true);
}

void ResetReversalExitConfirmation()
{
   gReversalExitCandidateDirection=DIR_FLAT;
   gReversalExitCandidateTicks=0;
}

void ManageConfirmedArrowReversalExit()
{
   if(HasOpenCloudTrade())
   {
      ResetReversalExitConfirmation();
      return;
   }
   if(ArrowReversalExitTicksValue<=0 || TradeCount()<=0)
   {
      ResetReversalExitConfirmation();
      return;
   }

   int positionDir=(int)DetectDirection();
   int rawDir=RawWeightArrowDirection();
   if(positionDir==DIR_FLAT || rawDir==DIR_FLAT || rawDir==positionDir)
   {
      ResetReversalExitConfirmation();
      return;
   }

   if(rawDir!=gReversalExitCandidateDirection)
   {
      gReversalExitCandidateDirection=rawDir;
      gReversalExitCandidateTicks=1;
   }
   else
      gReversalExitCandidateTicks++;

   gEntryStatus="CONFIRMING ARROW REVERSAL EXIT "+
                IntegerToString(gReversalExitCandidateTicks)+"/"+
                IntegerToString(ArrowReversalExitTicksValue);

   if(gReversalExitCandidateTicks>=ArrowReversalExitTicksValue)
   {
      string reason=(positionDir==DIR_BUY ? "confirmed arrow reversal BUY->SELL" :
                                             "confirmed arrow reversal SELL->BUY");
      if(CloseAllForConfirmedArrowReversal(reason))
      {
         ResetArrowCampaignGrid();
         ResetArrowDirectionConfirmation();
         gLastArrowDirection=DIR_FLAT;
      }
      ResetReversalExitConfirmation();
   }
}

//---------------------------------------------------------
bool PermissiveMovementFallback(int dir)
{
   if(!UsePermissiveEntryFallback) return false;
   int bars=MathMax(1,EntryFallbackBars);
   double now=iClose(Symbol(),SignalTF,1);
   double old=iClose(Symbol(),SignalTF,1+bars);
   if(dir==DIR_BUY) return now>old && EMAAllows(DIR_BUY);
   return now<old && EMAAllows(DIR_SELL);
}

void ManageTransitionDefense()
{
   if(gMarketRegime!=MARKET_TRANSITION) return;
   gEntryStatus="TRANSITION DEFENSE - NO NEW ENTRY";
   if(TransitionDefense==TRANSITION_CLOSE_OPEN_TREND_TRADE && TradeCount()>0 && !HasOpenCloudTrade())
      CloseAllInternal("transition entered Ichimoku cloud",true);
}

bool CloudMicroTurnAllows(int dir)
{
   double atr=iATR(Symbol(),SignalTF,14,1);
   if(atr<=0.0) return false;
   double tolerance=0.10*atr;
   if(dir==DIR_BUY)
      return iLow(Symbol(),SignalTF,0)>=iLow(Symbol(),SignalTF,1)-tolerance;
   return iHigh(Symbol(),SignalTF,0)<=iHigh(Symbol(),SignalTF,1)+tolerance;
}

void TryCloudHarvestEntry()
{
   if(gMarketRegime!=MARKET_CLOUD) return;
   if(!AllowNewEntries){ gEntryStatus="CLOUD HARVEST MANAGE ONLY"; return; }
   if(TradeCount()>0){ gEntryStatus="CLOUD HARVEST ONE POSITION MAX"; return; }
   if(!CloudEntryGatePasses(true)) return;

   int dir=ConfirmedCloudArrowDirection();
   if(dir==DIR_FLAT)
   {
      gEntryStatus="CLOUD WAITING FOR ARROW CONFIRMATION";
      return;
   }
   if(dir==DIR_BUY && !AllowBuy){ gEntryStatus="CLOUD BUY BLOCKED BY MASTER"; return; }
   if(dir==DIR_SELL && !AllowSell){ gEntryStatus="CLOUD SELL BLOCKED BY MASTER"; return; }
   if(!CloudMicroTurnAllows(dir))
   {
      gEntryStatus="CLOUD WAITING FOR EDGE MICRO-TURN";
      return;
   }

   double top=0,bottom=0,mid=0;
   if(!CurrentCloudBounds(top,bottom,mid)){ gEntryStatus="CLOUD BOUNDS UNAVAILABLE"; return; }
   double width=top-bottom;
   if(width<=Point){ gEntryStatus="CLOUD TOO NARROW"; return; }
   RefreshRates();
   double price=(dir==DIR_BUY ? Ask : Bid);
   double pos=(price-bottom)/width;
   if(dir==DIR_BUY && pos>CloudEntryZoneFractionValue)
   {
      gEntryStatus="CLOUD BUY WAITING FOR LOWER ZONE";
      return;
   }
   if(dir==DIR_SELL && pos<1.0-CloudEntryZoneFractionValue)
   {
      gEntryStatus="CLOUD SELL WAITING FOR UPPER ZONE";
      return;
   }

   double atr=iATR(Symbol(),SignalTF,14,1);
   if(atr<=0.0){ gEntryStatus="CLOUD ATR UNAVAILABLE"; return; }
   double buffer=MathMax(MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point,atr*CloudStopATRBufferValue);
   double stop=(dir==DIR_BUY ? bottom-buffer : top+buffer);
   double target=mid;
   if(!CloudQuickProfitUseMidpoint)
   {
      double riskDistance=MathAbs(price-stop);
      target=(dir==DIR_BUY ? price+riskDistance*CloudQuickProfitRValue
                           : price-riskDistance*CloudQuickProfitRValue);
      // Cloud Harvest is a mean-reversion scalp. Never demand a quick-R target
      // farther than the cloud midpoint; take the nearer favorable objective.
      if(dir==DIR_BUY && mid>price) target=MathMin(target,mid);
      if(dir==DIR_SELL && mid<price) target=MathMax(target,mid);
   }

   double tick=TickSizePrice();
   if(tick>0.0)
   {
      if(dir==DIR_BUY){ stop=MathFloor(stop/tick)*tick; target=MathCeil(target/tick)*tick; }
      else { stop=MathCeil(stop/tick)*tick; target=MathFloor(target/tick)*tick; }
   }
   stop=NormalizeDouble(stop,Digits); target=NormalizeDouble(target,Digits);
   string action=(dir==DIR_BUY ? "CLOUD_BUY" : "CLOUD_SELL");
   if(SendPlannedOrder(dir,CloudRiskPercentValue,stop,target,action,true,true))
   {
      gEntryStatus=(dir==DIR_BUY?"CLOUD HARVEST BUY OPENED":"CLOUD HARVEST SELL OPENED");
      gCloudArrowCandidateDirection=DIR_FLAT;
      gCloudArrowCandidateTicks=0;
   }
}

void TryArrowTickEntry()
{
   if(ArrowEntryControl==ARROW_ENTRY_OFF_USE_SETUPS) return;
   if(!AllowNewEntries)
   {
      gEntryStatus=(MasterControl==MASTER_OFF?"MASTER OFF":"MANAGE ONLY");
      return;
   }
   if(!EntryStartTimeGatePasses(true)) return;

   int dir=TrendArrowDirection();
   if(dir==DIR_FLAT)
   {
      gEntryStatus=(TrendArrowSignal==TREND_ARROW_RAW_QUALIFYING_TICK ?
                    "TREND RAW ARROW FLAT - WAITING" :
                    "TREND CONFIRMED ARROW FLAT - WAITING");
      return;
   }
   if(dir==DIR_BUY && !AllowBuy)
   {
      gEntryStatus="BUY ARROW BLOCKED BY MASTER";
      return;
   }
   if(dir==DIR_SELL && !AllowSell)
   {
      gEntryStatus="SELL ARROW BLOCKED BY MASTER";
      return;
   }
   if(!IchimokuAllows(dir))
   {
      gEntryStatus=(dir==DIR_BUY?"BUY ARROW BLOCKED BY ICHIMOKU":"SELL ARROW BLOCKED BY ICHIMOKU");
      gSafetyBlockReason="ICHIMOKU TREND FILTER";
      return;
   }
   if(ArrowEntryControl==ARROW_ENTRY_FIRST_ONLY && TradeCount()>0)
   {
      gEntryStatus="ARROW MANAGING FIRST ENTRY";
      return;
   }

   if(gLastArrowDirection==DIR_FLAT)
   {
      if(TradeCountByDirection(dir)>0) RebuildArrowCampaignGrid(dir);
      else ResetArrowCampaignGrid();
   }
   else if(dir!=gLastArrowDirection)
   {
      gLastArrowFlipTime=TimeCurrent();
      // Do not reset the active campaign while old positions remain. This keeps
      // completed/stopped grid slots permanent and prevents their reuse.
      if(TradeCount()==0 || !WaitForFlatOnArrowReversal)
         ResetArrowCampaignGrid();
      Print("HT Trend/Cloud WEIGHT ARROW REVERSAL: ",
            gLastArrowDirection==DIR_BUY?"BUY->SELL":"SELL->BUY",
            " weight=",DoubleToString(gWeight,4),
            " slope=",DoubleToString(gArrowSlope,5),
            " angle=",DoubleToString(gAngle,2));
   }
   gLastArrowDirection=dir;

   int oppositeDir=(dir==DIR_BUY?DIR_SELL:DIR_BUY);
   if(WaitForFlatOnArrowReversal && TradeCountByDirection(oppositeDir)>0)
   {
      gEntryStatus="REVERSAL WAITING FOR OLD TRADES TO CLOSE";
      gSafetyBlockReason="NO HEDGE WHILE OLD DIRECTION IS OPEN";
      return;
   }

   if(!ArrowGridAllowsNextEntry(dir))
   {
      gEntryStatus="MARGIN-SAFE GRID: "+gSafetyBlockReason;
      return;
   }

   gArrowEntryAttempts++;
   string action=(dir==DIR_BUY?"ARROW_BUY_":"ARROW_SELL_")+
                 IntegerToString(gArrowSequenceIndex+1);
   if(SendOrder(dir,1.0,action,true))
   {
      gArrowEntriesOpened++;
      if(UseMarginSafeGrid && gArrowSequenceIndex==0)
      {
         gArrowCampaignDirection=dir;
         gArrowCampaignAnchorPrice=gLastOpenedPrice;
         gArrowCampaignTargetPrice=gLastOpenedTakeProfit;
         gArrowCampaignStartTime=TimeCurrent();
         gGridStoppedAfterSL=false;
      }
      gEntryStatus=(dir==DIR_BUY?"SAFE GRID BUY OPENED ":"SAFE GRID SELL OPENED ")+
                   IntegerToString(gArrowSequenceIndex+1)+"/"+
                   IntegerToString(SafeMaximumEntries);
      gArrowSequenceIndex++;
      gSafetyBlockReason="";
   }
}

void TryInitialEntry()
{
   if(!AllowNewEntries)
   { gEntryStatus=(MasterControl==MASTER_OFF?"MASTER OFF":"MANAGE ONLY"); return; }
   if(!EntryStartTimeGatePasses(true)) return;
   if(TradeCount()>0)
   { gEntryStatus="MANAGING OPEN TRADE"; return; }

   // Informational only. Spread no longer blocks initial entries or additions.
   double spread=SpreadPoints();
   if(gMode==GEO_INVALID && !AllowEntryWithoutValidGeometry)
   { gEntryStatus="WAITING FOR VALID TRIANGLE"; return; }

   double bt=0,bb=0,st=0,sb=0;
   datetime btime=0,stime=0;

   bool buyCloud=IchimokuAllows(DIR_BUY);
   bool sellCloud=IchimokuAllows(DIR_SELL);
   bool buyEarly=AllowBuy && buyCloud && ZeroDegreeBreakSignal(DIR_BUY);
   bool sellEarly=AllowSell && sellCloud && ZeroDegreeBreakSignal(DIR_SELL);

   bool buyFVG=UseFVGEntry && AllowBuy && buyCloud && EMAAllows(DIR_BUY) &&
               FindTradableFVG(DIR_BUY,bt,bb,btime) && SignalTimeIsFresh(btime);
   bool sellFVG=UseFVGEntry && AllowSell && sellCloud && EMAAllows(DIR_SELL) &&
                FindTradableFVG(DIR_SELL,st,sb,stime) && SignalTimeIsFresh(stime);

   bool buyLaunch=AllowBuy && buyCloud && HightowerLaunchSignal(DIR_BUY);
   bool sellLaunch=AllowSell && sellCloud && HightowerLaunchSignal(DIR_SELL);
   bool buyMomentum=AllowBuy && buyCloud && MomentumSignal(DIR_BUY);
   bool sellMomentum=AllowSell && sellCloud && MomentumSignal(DIR_SELL);

   if((buyEarly || buyLaunch || buyMomentum) && btime==0) btime=iTime(Symbol(),SignalTF,0);
   if((sellEarly || sellLaunch || sellMomentum) && stime==0) stime=iTime(Symbol(),SignalTF,0);

   bool buySetup=buyEarly || buyFVG || buyLaunch || buyMomentum;
   bool sellSetup=sellEarly || sellFVG || sellLaunch || sellMomentum;
   bool buyStrict=TriangleMovementEntryPasses(DIR_BUY);
   bool sellStrict=TriangleMovementEntryPasses(DIR_SELL);
   bool buyFallback=buySetup && PermissiveMovementFallback(DIR_BUY);
   bool sellFallback=sellSetup && PermissiveMovementFallback(DIR_SELL);
   bool invalidGeometryBypass=(gMode==GEO_INVALID && AllowEntryWithoutValidGeometry);
   // Red-line zero-degree breaks are deliberately early and therefore bypass
   // the later angle threshold while respecting direction, risk and Ichimoku.
   bool buyMovement=buySetup && (buyEarly || buyStrict || buyFallback || invalidGeometryBypass);
   bool sellMovement=sellSetup && (sellEarly || sellStrict || sellFallback || invalidGeometryBypass);

   if(EnableEntryDiagnostics && TimeCurrent()-gLastEntryDiagnostic>=MathMax(1,EntryDiagnosticSeconds))
   {
      gLastEntryDiagnostic=TimeCurrent();
      Print("HT TRI ENTRY | status=",gEntryStatus,
            " mode=",ModeText()," structure=",DoubleToString((gHigh-gLow)/Point,0),
            " spread=",DoubleToString(spread,0)," (informational only)",
            " tickSize=",DoubleToString(TickSizePrice(),Digits),
            " tickValue=",DoubleToString(MarketInfo(Symbol(),MODE_TICKVALUE),4),
            " buyEarly=",buyEarly," buyCloud=",buyCloud,
            " buyFVG=",buyFVG," buyLaunch=",buyLaunch," buyMomentum=",buyMomentum,
            " buyMove=",buyMovement," buyLot=",DoubleToString(PreviewRiskLot(DIR_BUY,1.0),2),
            " sellEarly=",sellEarly," sellCloud=",sellCloud,
            " sellFVG=",sellFVG," sellLaunch=",sellLaunch," sellMomentum=",sellMomentum,
            " sellMove=",sellMovement," sellLot=",DoubleToString(PreviewRiskLot(DIR_SELL,1.0),2),
            " tradeAllowed=",IsTradeAllowed());
   }

   if(!buySetup && !sellSetup)
   { gEntryStatus="WAITING FOR SETUP"; ResetEntryMovement(); return; }
   if(!buyMovement && !sellMovement)
   { gEntryStatus="SETUP FOUND - WAITING FOR DIRECTION"; ResetEntryMovement(); return; }

   // A fresh zero-degree break has priority over later setup signals.
   if(buyEarly && !sellEarly) sellMovement=false;
   else if(sellEarly && !buyEarly) buyMovement=false;
   else if(buyMovement && sellMovement)
   {
      double buyStrength=DirectionalAngle(DIR_BUY)+DirectionalAngleVelocity(DIR_BUY)*2.0;
      double sellStrength=DirectionalAngle(DIR_SELL)+DirectionalAngleVelocity(DIR_SELL)*2.0;
      if(buyStrength>=sellStrength) sellMovement=false;
      else buyMovement=false;
   }

   if(buyMovement)
   {
      gEntryStatus=(buyEarly ? "ZERO DEGREE BUY BREAK" : "BUY SETUP READY");
      bool confirmed=(buyEarly || ConfirmEntryMovement(DIR_BUY,btime));
      if(confirmed)
      {
         gLastUsedFVGTime=btime;
         string action=(buyEarly ? "ZERO_DEG_BUY" :
                        (DirectionalAngle(DIR_BUY)>=StrongEntryAngleDegrees ? "STRONG_BUY" : "BUY"));
         if(SendOrder(DIR_BUY,1.0,action,true))
         {
            if(buyEarly){ gLastZeroCrossDirection=DIR_BUY; gLastZeroCrossTime=TimeCurrent(); }
            gEntryStatus=(buyEarly ? "ZERO DEGREE BUY OPENED" : "BUY OPENED");
            ResetEntryMovement();
         }
      }
      else gEntryStatus="CONFIRMING BUY";
      return;
   }

   if(sellMovement)
   {
      gEntryStatus=(sellEarly ? "ZERO DEGREE SELL BREAK" : "SELL SETUP READY");
      bool confirmed=(sellEarly || ConfirmEntryMovement(DIR_SELL,stime));
      if(confirmed)
      {
         gLastUsedFVGTime=stime;
         string action=(sellEarly ? "ZERO_DEG_SELL" :
                        (DirectionalAngle(DIR_SELL)>=StrongEntryAngleDegrees ? "STRONG_SELL" : "SELL"));
         if(SendOrder(DIR_SELL,1.0,action,true))
         {
            if(sellEarly){ gLastZeroCrossDirection=DIR_SELL; gLastZeroCrossTime=TimeCurrent(); }
            gEntryStatus=(sellEarly ? "ZERO DEGREE SELL OPENED" : "SELL OPENED");
            ResetEntryMovement();
         }
      }
      else gEntryStatus="CONFIRMING SELL";
      return;
   }

   gEntryStatus="WAITING";
   ResetEntryMovement();
}

bool FreshContinuationFVG()
{
   if(!UseFVGEntry || !EMAAllows(gDirection) || !IchimokuAllows(gDirection)) return false;
   double top,bottom; datetime when;
   if(!FindTradableFVG(gDirection,top,bottom,when)) return false;
   if(!SignalTimeIsFresh(when) || when<=gLastUsedFVGTime) return false;
   gLastUsedFVGTime=when;
   return true;
}

void TryAdd()
{
   if(!AllowNewEntries) return;
   if(!EntryStartTimeGatePasses(true)) return;
   int n=TradeCount();
   if(n<=0 || n>=MaximumOpenTrades || n-1>=MaximumAddsPerCampaign) return;
   if(gMode!=GEO_LADDER && gMode!=GEO_STRONG_LADDER) return;
   if(TimeCurrent()-gLastAdd<MinimumSecondsBetweenAdds) return;
   if(RequireNewestTradeWinning && NewestProfit()<=0) return;
   if(MathAbs(MidPrice()-LastEntryPrice())/Point<MinimumAddSpacingPoints) return;
   if(!FreshContinuationFVG()) return;
   SendOrder(gDirection,AddRiskFraction,gMode==GEO_STRONG_LADDER?"STRONG_ADD":"ADD",true);
}

void ResetMovementTP()
{
   gMovementTPArmed=false;
   gMovementExitTicks=0;
   gPeakFavorableWeight=0.0;
   gPeakFavorableAngle=0.0;
   gPeakDirectionalPrice=0.0;
   gMovementExitReason="";
}

datetime CampaignFirstOpenTime()
{
   datetime first=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(first==0 || OrderOpenTime()<first) first=OrderOpenTime();
   }
   return first;
}

int CampaignAgeSignalBars()
{
   datetime first=CampaignFirstOpenTime();
   if(first<=0) return 0;
   int seconds=PeriodSeconds(SignalTF);
   if(seconds<=0) seconds=60;
   return (int)MathMax(0,(TimeCurrent()-first)/seconds);
}

bool DiscretionaryExitAllowed()
{
   if(HoldUntilBrokerStopOrTarget) return false;
   if(MinimumHoldBarsValue<=0) return true;
   return CampaignAgeSignalBars()>=MinimumHoldBarsValue;
}

string HoldPolicyText()
{
   if(HoldUntilBrokerStopOrTarget) return "STRICT SL/TP ONLY";
   if(MinimumHoldBarsValue<=0) return "NO MINIMUM";
   return IntegerToString(MinimumHoldBarsValue)+" BARS";
}

void UpdateMovementTakeProfitState()
{
   if(TradeCount()<=0 || gDirection==DIR_FLAT)
   {
      ResetMovementTP();
      return;
   }

   double profit=BasketProfit();
   double favorableWeight=DirectionalWeight(gDirection);
   double favorableAngle=DirectionalAngle(gDirection);
   double directionalPrice=(gDirection==DIR_BUY ? gPrice : -gPrice);

   if(favorableWeight>gPeakFavorableWeight)
      gPeakFavorableWeight=favorableWeight;
   if(favorableAngle>gPeakFavorableAngle)
      gPeakFavorableAngle=favorableAngle;
   if(gPeakDirectionalPrice==0.0 || directionalPrice>gPeakDirectionalPrice)
      gPeakDirectionalPrice=directionalPrice;

   double armMoney=MathMax(MovementTPMinimumMoney,
                           AccountBalance()*MovementTPArmPercent/100.0);

   if(!gMovementTPArmed &&
      profit>=armMoney &&
      favorableWeight>=MovementTPMinimumFavorableWeight)
   {
      gMovementTPArmed=true;
      gMovementExitTicks=0;
      Print("Triangle movement TP armed profit=",
            DoubleToString(profit,2),
            " weight=",DoubleToString(favorableWeight,3),
            " angle=",DoubleToString(favorableAngle,2));
   }
}

bool MovementExitCondition(string &reason)
{
   reason="";
   if(!UseTriangleMovementTakeProfit || !gMovementTPArmed) return false;
   if(BasketProfit()<=0.0) return false;

   double favorableWeight=DirectionalWeight(gDirection);
   double favorableAngle=DirectionalAngle(gDirection);
   double favorableVelocity=DirectionalAngleVelocity(gDirection);

   bool weightGiveback=
      favorableWeight<=gPeakFavorableWeight-MovementTPWeightGiveback;

   bool angleGiveback=
      favorableAngle<=gPeakFavorableAngle-MovementTPAngleGivebackDegrees;

   bool angleReversal=
      favorableAngle<=-MovementTPAngleReversalDegrees;

   bool profitableDrawdown=
      ExitOnProfitableDrawdownMode &&
      (gMode==GEO_DRAWDOWN || gMode==GEO_STRONG_DRAWDOWN);

   bool midpointLost=
      ExitOnMidpointLossAfterProfit && favorableWeight<=0.0;

   bool extensionStall=
      ExitOnExtremeExtensionStall &&
      gPeakFavorableWeight>=ExtensionWeight &&
      favorableVelocity<=ExtensionStallVelocity &&
      favorableAngle<gPeakFavorableAngle;

   if(angleReversal)
      reason="angle reversed";
   else if(profitableDrawdown && weightGiveback)
      reason="profitable drawdown with weight loss";
   else if(midpointLost)
      reason="midpoint lost after profit";
   else if(extensionStall && angleGiveback)
      reason="extended triangle stalled";
   else if(weightGiveback && angleGiveback)
      reason="triangle weight and angle gave back";
   else
      return false;

   return true;
}

bool ConfirmMovementExit(string reason)
{
   if(reason!=gMovementExitReason)
   {
      gMovementExitReason=reason;
      gMovementExitTicks=1;
      return false;
   }

   gMovementExitTicks++;
   return gMovementExitTicks>=MathMax(1,MovementTPConfirmTicks);
}

void ManageBasket()
{
   if(TradeCount()==0) return;

   double p=BasketProfit();
   if(p>gPeakProfit) gPeakProfit=p;
   UpdateMovementTakeProfitState();

   bool discretionaryExit=DiscretionaryExitAllowed();
   if(discretionaryExit)
   {
      if(CloseOnInvalidGeometry && gMode==GEO_INVALID)
      { CloseAll("invalid triangle geometry"); return; }

      string movementReason="";
      if(MovementExitCondition(movementReason))
      {
         if(ConfirmMovementExit(movementReason))
         {
            CloseAll("movement TP: "+movementReason);
            return;
         }
      }
      else
      {
         gMovementExitTicks=0;
         gMovementExitReason="";
      }

      double railArm=MathMax(MinimumBasketTargetMoney,AccountBalance()*RailArmPercent/100.0);
      if(UseCampaignProfitRail && p>=railArm) gRailArmed=true;
      if(gRailArmed && gPeakProfit>0)
      {
         double givePct=(TargetMode==HT_QUICK_CAPTURE?RailGivebackPercentQuick:
                        (TargetMode==HT_MAXIMUM_TREND?RailGivebackPercentMaximum:RailGivebackPercentBalanced));
         double railMoney=gPeakProfit*(1.0-givePct/100.0);
         bool railBroken=(p<=railMoney && p>0 &&
                          (gMode==GEO_EXHAUSTION || gMode==GEO_DRAWDOWN || gMode==GEO_STRONG_DRAWDOWN));
         if(railBroken) gRailExitTicks++; else gRailExitTicks=0;
         if(gRailExitTicks>=MathMax(1,RailConfirmTicks)){ CloseAll("campaign profit rail"); return; }
      }

      double target=MathMax(MinimumBasketTargetMoney,
                            AccountBalance()*BasketTargetPercent/100.0);
      if(TargetMode==HT_QUICK_CAPTURE && p>=target){ CloseAll("quick basket target"); return; }

      double peakArm=AccountBalance()*PeakArmPercent/100.0;
      double giveback=MathMax(MinimumPeakGivebackMoney,
                              gPeakProfit*PeakGivebackPercent/100.0);
      if(UsePeakGiveback && TargetMode!=HT_MAXIMUM_TREND &&
         gPeakProfit>=peakArm && p<=gPeakProfit-giveback &&
         (gMode==GEO_EXHAUSTION || gMode==GEO_DRAWDOWN || gMode==GEO_STRONG_DRAWDOWN))
      { CloseAll("confirmed peak giveback"); return; }

      if(CloseOnOppositeFVG && p>0 && OppositeRecentFVG())
      { CloseAll("opposite FVG"); return; }

      double buffer=StructureBreakBufferPoints*Point;
      if(CloseOnStructureBreak &&
         ((gDirection==DIR_BUY && Bid<gLow-buffer) ||
          (gDirection==DIR_SELL && Ask>gHigh+buffer)))
      { CloseAll("structure break"); return; }
   }
   else
   {
      // Do not let tick confirmations accumulate while the hold lock is active.
      gMovementExitTicks=0;
      gMovementExitReason="";
      gRailExitTicks=0;
   }

   // Account-level emergency protection remains active for timed-hold modes.
   // Strict SL/TP-only mode deliberately leaves closure to the broker SL or TP.
   double dd=(p<0?MathAbs(p)/MathMax(1.0,AccountBalance())*100.0:0);
   if(!HoldUntilBrokerStopOrTarget &&
      MaximumCampaignDrawdownPercent>0.0 && dd>=MaximumCampaignDrawdownPercent)
   { CloseAll("maximum campaign drawdown"); return; }
}

//---------------------------------------------------------
void DeleteObjectsWithPrefix(string prefix)
{
   for(int i=ObjectsTotal()-1;i>=0;i--)
   {
      string name=ObjectName(i);
      if(StringFind(name,prefix,0)==0) ObjectDelete(0,name);
   }
}

bool IsOurOpenTicket(int ticket)
{
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderTicket()==ticket) return true;
   }
   return false;
}

void DrawStopLossLines()
{
   string prefix=Pfx()+"SL_";

   // Remove lines for positions that are no longer open.
   for(int n=ObjectsTotal()-1;n>=0;n--)
   {
      string objectName=ObjectName(n);
      if(StringFind(objectName,prefix,0)!=0) continue;
      int ticket=(int)StringToInteger(StringSubstr(objectName,StringLen(prefix)));
      if(ticket<=0 || !IsOurOpenTicket(ticket)) ObjectDelete(0,objectName);
   }

   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderStopLoss()<=0.0) continue;

      string name=prefix+IntegerToString(OrderTicket());
      if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_HLINE,0,0,OrderStopLoss());
      ObjectSetDouble(0,name,OBJPROP_PRICE1,OrderStopLoss());
      ObjectSetInteger(0,name,OBJPROP_COLOR,clrRed);
      ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_SOLID);
      ObjectSetInteger(0,name,OBJPROP_WIDTH,3);
      ObjectSetInteger(0,name,OBJPROP_BACK,false);
      ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
      ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
      ObjectSetString(0,name,OBJPROP_TOOLTIP,
                      "STOP LOSS #"+IntegerToString(OrderTicket())+
                      "  "+DoubleToString(OrderStopLoss(),Digits));
   }
}

datetime IchimokuCloudTime(int chartShift)
{
   if(chartShift>=0) return iTime(Symbol(),SignalTF,chartShift);
   datetime currentBar=iTime(Symbol(),SignalTF,0);
   return currentBar+(datetime)(-chartShift*PeriodSeconds(SignalTF));
}

bool IchimokuCloudValue(int chartShift,double &spanA,double &spanB)
{
   spanA=0.0; spanB=0.0;
   int sourceShift=chartShift+IchimokuKijunPeriod;
   if(sourceShift<0) return false;
   if(iBars(Symbol(),SignalTF)<=sourceShift+IchimokuSpanBPeriod+2) return false;

   spanA=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                   IchimokuSpanBPeriod,MODE_SENKOUSPANA,sourceShift);
   spanB=iIchimoku(Symbol(),SignalTF,IchimokuTenkanPeriod,IchimokuKijunPeriod,
                   IchimokuSpanBPeriod,MODE_SENKOUSPANB,sourceShift);
   if(spanA==EMPTY_VALUE || spanB==EMPTY_VALUE || spanA<=0.0 || spanB<=0.0) return false;
   return true;
}

void CloudRectangle(string name,datetime t1,datetime t2,double top,double bottom,color c)
{
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_RECTANGLE,0,t1,top,t2,bottom);
   ObjectSetInteger(0,name,OBJPROP_TIME1,t1);
   ObjectSetDouble(0,name,OBJPROP_PRICE1,top);
   ObjectSetInteger(0,name,OBJPROP_TIME2,t2);
   ObjectSetDouble(0,name,OBJPROP_PRICE2,bottom);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_SOLID);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,name,OBJPROP_FILL,true);
   ObjectSetInteger(0,name,OBJPROP_BACK,true);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
}

void CloudLine(string name,datetime t1,double p1,datetime t2,double p2,color c)
{
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_TREND,0,t1,p1,t2,p2);
   ObjectSetInteger(0,name,OBJPROP_TIME1,t1);
   ObjectSetDouble(0,name,OBJPROP_PRICE1,p1);
   ObjectSetInteger(0,name,OBJPROP_TIME2,t2);
   ObjectSetDouble(0,name,OBJPROP_PRICE2,p2);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_SOLID);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,name,OBJPROP_RAY_RIGHT,false);
   ObjectSetInteger(0,name,OBJPROP_BACK,true);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
}

void DrawIchimokuCloudObjects()
{
   string prefix=Pfx()+"ICHI_";
   if(!DrawIchimokuCloud)
   {
      DeleteObjectsWithPrefix(prefix);
      gLastCloudDrawBar=0;
      return;
   }

   datetime signalBar=iTime(Symbol(),SignalTF,0);
   if(signalBar<=0) return;
   if(signalBar==gLastCloudDrawBar && ObjectFind(0,prefix+"F_0")>=0) return;

   DeleteObjectsWithPrefix(prefix);
   int segment=0;
   int oldest=MathMin(IchimokuCloudHistoryBars,iBars(Symbol(),SignalTF)-IchimokuSpanBPeriod-IchimokuKijunPeriod-3);
   int newest=-IchimokuKijunPeriod;
   for(int shift=oldest;shift>newest;shift--)
   {
      int nextShift=shift-1;
      double a1=0.0,b1=0.0,a2=0.0,b2=0.0;
      if(!IchimokuCloudValue(shift,a1,b1) || !IchimokuCloudValue(nextShift,a2,b2)) continue;

      datetime t1=IchimokuCloudTime(shift);
      datetime t2=IchimokuCloudTime(nextShift);
      if(t1<=0 || t2<=0) continue;

      double top=MathMax(MathMax(a1,b1),MathMax(a2,b2));
      double bottom=MathMin(MathMin(a1,b1),MathMin(a2,b2));
      bool bullish=((a1+a2)*0.5>=(b1+b2)*0.5);
      string id=IntegerToString(segment);
      CloudRectangle(prefix+"F_"+id,t1,t2,top,bottom,
                     bullish?IchimokuBullCloudColor:IchimokuBearCloudColor);
      CloudLine(prefix+"A_"+id,t1,a1,t2,a2,IchimokuSpanAColor);
      CloudLine(prefix+"B_"+id,t1,b1,t2,b2,IchimokuSpanBColor);
      segment++;
   }
   gLastCloudDrawBar=signalBar;
   ChartRedraw(0);
}

void TrendLine(string name,datetime t1,double p1,datetime t2,double p2,
               color c,int style,int width)
{
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_TREND,0,t1,p1,t2,p2);
   ObjectSetInteger(0,name,OBJPROP_TIME1,t1);
   ObjectSetDouble(0,name,OBJPROP_PRICE1,p1);
   ObjectSetInteger(0,name,OBJPROP_TIME2,t2);
   ObjectSetDouble(0,name,OBJPROP_PRICE2,p2);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
   ObjectSetInteger(0,name,OBJPROP_STYLE,style);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,width);
   ObjectSetInteger(0,name,OBJPROP_RAY_RIGHT,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void DrawWeightArrowHead(datetime when,double price,int dir)
{
   string name=Pfx()+"WEIGHT_HEAD";
   if(dir==DIR_FLAT)
   {
      ObjectDelete(0,name);
      return;
   }
   if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_ARROW,0,when,price);
   ObjectSetInteger(0,name,OBJPROP_TIME1,when);
   ObjectSetDouble(0,name,OBJPROP_PRICE1,price);
   ObjectSetInteger(0,name,OBJPROP_COLOR,WeightLineColor);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,MathMax(2,WeightLineWidth));
   ObjectSetInteger(0,name,OBJPROP_ARROWCODE,dir==DIR_BUY?233:234);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetString(0,name,OBJPROP_TOOLTIP,
                   dir==DIR_BUY?"WEIGHT ARROW: BUY":"WEIGHT ARROW: SELL");
}

void DrawObjects()
{
   DrawIchimokuCloudObjects();
   DrawStopLossLines();

   if(DrawTriangle && gHigh>gLow)
   {
      datetime now=TimeCurrent();
      TrendLine(Pfx()+"HP",gHighTime,gHigh,now,gPrice,TriangleColor,STYLE_SOLID,TriangleWidth);
      TrendLine(Pfx()+"PL",now,gPrice,gLowTime,gLow,TriangleColor,STYLE_SOLID,TriangleWidth);
      TrendLine(Pfx()+"HL",gHighTime,gHigh,gLowTime,gLow,TriangleColor,STYLE_SOLID,TriangleWidth);
      datetime mt=(datetime)(((long)gHighTime+(long)gLowTime)/2);
      int arrowDir=WeightArrowDirection();
      TrendLine(Pfx()+"WEIGHT",mt,gMid,now,gPrice,WeightLineColor,STYLE_SOLID,WeightLineWidth);
      DrawWeightArrowHead(now,gPrice,arrowDir);
   }
   else ObjectDelete(0,Pfx()+"WEIGHT_HEAD");

   if(ShowDashboard)
   {
      string name=Pfx()+"DASH";
      if(ObjectFind(0,name)<0) ObjectCreate(0,name,OBJ_LABEL,0,0,0);
      string dir=(gDirection==DIR_BUY?"BUY":(gDirection==DIR_SELL?"SELL":"FLAT"));
      bool arrowMode=(ArrowEntryControl!=ARROW_ENTRY_OFF_USE_SETUPS);
      double buyPreview=(AllowBuy ? (arrowMode?PreviewArrowRiskLot(DIR_BUY):PreviewRiskLot(DIR_BUY,1.0)) : 0.0);
      double sellPreview=(AllowSell ? (arrowMode?PreviewArrowRiskLot(DIR_SELL):PreviewRiskLot(DIR_SELL,1.0)) : 0.0);
      if(UseMarginSafeGrid)
      {
         int previewDir=WeightArrowDirection();
         double previewLot=(previewDir==DIR_BUY?buyPreview:(previewDir==DIR_SELL?sellPreview:0.0));
         if(previewLot>0.0) MarginSafetyPasses(previewDir==DIR_BUY?OP_BUY:OP_SELL,previewLot,true);
      }
      string text="HIGHTOWER TRIANGLE FLOW OS v1.1 TREND / CLOUD / TRANSITION\n"+
                  "Campaign: "+dir+" | Trades: "+IntegerToString(TradeCount())+
                  "\nState: "+CampaignStateText()+" | Geo: "+ModeText()+
                  "\nDecision: "+gDecision+
                  "\nAngle: "+DoubleToString(gAngle,1)+
                  " | Weight: "+DoubleToString(gWeight,2)+
                  " | Slope: "+DoubleToString(gArrowSlope,5)+
                  "\nBasket: $"+DoubleToString(BasketProfit(),2)+
                  " | Peak: $"+DoubleToString(gPeakProfit,2)+
                  " | Rail: "+(gRailArmed?"ARMED":"WAIT")+
                  "\nArrow: "+(WeightArrowDirection()==DIR_BUY?"BUY":(WeightArrowDirection()==DIR_SELL?"SELL":"FLAT"))+
                  " | Raw: "+(gRawArrowDirection==DIR_BUY?"BUY":(gRawArrowDirection==DIR_SELL?"SELL":"FLAT"))+
                  " | Confirm: "+IntegerToString(gArrowCandidateTicks)+"/"+IntegerToString(ArrowConfirmationTicksValue)+
                  "\nEntry mode: "+ArrowEntryModeText()+
                  " | "+ArrowSlopeText()+" | "+ArrowConfirmationText()+
                  " | "+ArithmeticSpacingText()+
                  "\nEntry hours: "+EntryHoursText()+
                  " | Broker now: "+BrokerClockText()+
                  " | Gate: "+(EntryHoursOpen()?"OPEN":"WAIT")+
                  "\nREGIME: "+MarketRegimeText()+" | Consolidation score: "+IntegerToString(gConsolidationScore)+"/7"+
                  " | Cloud pos: "+DoubleToString(gCloudPosition*100.0,0)+"%"+
                  "\nTrend gates: "+ReentryDelayText()+" | "+HourlyTradeLimitText()+
                  " ("+IntegerToString(gTradesOpenedThisHour)+") | "+DirectionTradeLimitText()+
                  " ("+IntegerToString(gTradesThisSignalDirection)+")"+
                  "\nLoss streak: "+IntegerToString(gConsecutiveLosses)+" | "+LossStreakText()+
                  " | "+LotCeilingText()+" | "+ChopFilterText()+
                  " | Chop pause: "+(gChopPauseUntil>TimeCurrent()?IntegerToString((int)(gChopPauseUntil-TimeCurrent()))+"s":"READY")+
                  "\nTrend block: "+(gOvertradeBlockReason==""?"NONE":gOvertradeBlockReason)+
                  " | Cloud losses: "+IntegerToString(gCloudConsecutiveLosses)+
                  " | Cloud pause: "+(gCloudLossPauseUntil>TimeCurrent()?IntegerToString((int)(gCloudLossPauseUntil-TimeCurrent()))+"s":"READY")+
                  "\nCloud risk: "+DoubleToString(CloudRiskPercentValue,0)+"% | Zone: "+DoubleToString(CloudEntryZoneFractionValue*100.0,0)+"%"+
                  " | Floor: "+(CloudEquityFloorPercentValue>0.0?DoubleToString(CloudEquityFloorPercentValue,0)+"%":"OFF")+
                  " | QuickTP: "+(CloudQuickProfitUseMidpoint?"MID":DoubleToString(CloudQuickProfitRValue,2)+"R")+
                  " | Hold: "+(CloudMaxHoldSecondsValue>0?IntegerToString(CloudMaxHoldSecondsValue)+"s":"OFF")+
                  " | RevExit: "+(CloudReversalExitTicksValue>0?IntegerToString(CloudReversalExitTicksValue)+"t":"OFF")+
                  "\nSafety: "+MarginSafetyText()+
                  " | Grid: "+IntegerToString(gArrowSequenceIndex)+"/"+IntegerToString(SafeMaximumEntries)+
                  " | Progress: "+DoubleToString(ArrowGridProgress(WeightArrowDirection())*100.0,1)+"%"+
                  " | Add-on SL freeze: "+(gGridStoppedAfterSL?"ON":"READY")+
                  "\nRisk authority: "+DoubleToString(RiskPerEntryPercent,0)+"% PER ORDER AT SL"+
                  " | Campaign cap: "+DoubleToString(MaximumCampaignRiskPercent,0)+"%"+
                  " | Risk money: $"+DoubleToString(SelectedRiskMoney(),2)+
                  " | Basis: "+(RiskAccountBasis==RISK_FROM_BALANCE?"BALANCE":(RiskAccountBasis==RISK_FROM_EQUITY?"EQUITY":"FREE MARGIN"))+
                  " | TP: "+(TakeProfitSLRatioValue>0.0 ? DoubleToString(TakeProfitSLRatioValue,1)+"R" : "OFF")+
                  " | Hold: "+HoldPolicyText()+
                  (TradeCount()>0 ? " (age "+IntegerToString(CampaignAgeSignalBars())+")" : "")+
                  "\nSoftware exits: "+(HoldUntilBrokerStopOrTarget ? "STRICT EXCEPT USER REVERSAL EXIT" : "ENABLED")+
                  " | "+ArrowReversalExitText()+
                  " | Open SL exposure: $"+DoubleToString(OpenCampaignRiskMoney(),2)+
                  "\nProjected margin level: "+DoubleToString(gLastProjectedMarginLevel,0)+"%"+
                  " | Free reserve: "+DoubleToString(gLastProjectedFreeMarginPercent,1)+"%"+
                  " | Floors: "+DoubleToString(MinimumProjectedMarginLevel,0)+"% / "+
                  DoubleToString(MinimumFreeMarginReservePercent,0)+"%"+
                  "\nPreview lot B/S: "+DoubleToString(buyPreview,2)+
                  "/"+DoubleToString(sellPreview,2)+
                  " | SL pts B/S: "+DoubleToString(PreviewStopDistancePoints(DIR_BUY),0)+
                  "/"+DoubleToString(PreviewStopDistancePoints(DIR_SELL),0)+
                  " | SL lookback: "+IntegerToString(StopLossLookbackBars)+
                  "\nSL mode: "+StopMethodText()+" | "+ATRStopText()+
                  "\nIchimoku B/S: "+(IchimokuAllows(DIR_BUY)?"PASS":"BLOCK")+
                  "/"+(IchimokuAllows(DIR_SELL)?"PASS":"BLOCK")+
                  " | Zero break: "+(gLastZeroCrossDirection==DIR_BUY?"BUY":(gLastZeroCrossDirection==DIR_SELL?"SELL":"WAIT"))+
                  "\nTotal lots: "+DoubleToString(TotalLots(),2)+
                  " | Arrow attempts/opened: "+IntegerToString((int)gArrowEntryAttempts)+
                  "/"+IntegerToString((int)gArrowEntriesOpened)+
                  "\nGrid status: "+(gSafetyBlockReason==""?"READY":gSafetyBlockReason)+
                  "\nArrow entries require confirmed slope plus selected Ichimoku trend approval"+
                  "\nAUTO: Trend Attack outside | Transition Defense on uncertainty | Cloud Harvest on confirmed consolidation"+
                  "\nSelected percentage is never rescaled; campaign cap blocks excess exposure";
      ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
      ObjectSetInteger(0,name,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,name,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,name,OBJPROP_COLOR,clrWhite);
      ObjectSetInteger(0,name,OBJPROP_FONTSIZE,10);
      ObjectSetString(0,name,OBJPROP_TEXT,text);
   }
}

void DeleteObjects()
{
   ObjectDelete(0,Pfx()+"HP"); ObjectDelete(0,Pfx()+"PL");
   ObjectDelete(0,Pfx()+"HL"); ObjectDelete(0,Pfx()+"WEIGHT"); ObjectDelete(0,Pfx()+"WEIGHT_HEAD");
   ObjectDelete(0,Pfx()+"DASH");
   DeleteObjectsWithPrefix(Pfx()+"SL_");
   DeleteObjectsWithPrefix(Pfx()+"ICHI_");
}

//---------------------------------------------------------
string WisdoUpper(string value){ StringToUpper(value); return value; }
datetime WisdoClock(){ return IsTesting()?TimeCurrent():TimeLocal(); }

void WisdoUpdateBookLevel(WISDO_BOOK_LEVEL &level,int side,double price,double size,int orders,long sequence,string source)
{
   if(price<=0.0 || size<=0.0) return;
   datetime now=WisdoClock();
   if(level.price==price)
   {
      if(level.size>0.0 && size>=level.size*0.90 && size>level.size) level.replenishments++;
   }
   else
   {
      level.firstSeen=now;
      level.replenishments=0;
   }
   level.price=price; level.size=size; level.side=side; level.orders=orders;
   level.updatedAt=now; level.sequence=sequence; level.source=source;
}

void WisdoScoreBook()
{
   double average=gWisdoAverageBookSize>0.0?gWisdoAverageBookSize:(gWisdoBid.size+gWisdoAsk.size)/2.0;
   if(average<=0.0) { gWisdoBookReady=false; return; }
   datetime now=WisdoClock();
   WISDO_BOOK_LEVEL levels[2]; levels[0]=gWisdoBid; levels[1]=gWisdoAsk;
   for(int i=0;i<2;i++)
   {
      double multiple=levels[i].size/average;
      int persistence=(int)MathMax(0,now-levels[i].firstSeen);
      int score=(int)MathMin(100.0,25.0*multiple+5.0*persistence+10.0*levels[i].replenishments);
      if(i==0) gWisdoBid.score=score; else gWisdoAsk.score=score;
   }
   bool fresh=(now-gWisdoBid.updatedAt<=WisdoBookStaleSeconds || now-gWisdoAsk.updatedAt<=WisdoBookStaleSeconds);
   gWisdoBookReady=fresh;
}

void WisdoReadBrokerBook()
{
   if(WisdoBookSource!=WISDO_BOOK_AUTO && WisdoBookSource!=WISDO_BOOK_BROKER_DOM && WisdoBookSource!=WISDO_BOOK_BOTH) return;
   int handle=FileOpen(WisdoBrokerBookFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ,'|');
   if(handle==INVALID_HANDLE) return;
   double bestBidSize=0,bestAskSize=0,bestBidPrice=0,bestAskPrice=0,totalSize=0; int levelCount=0;
   int bestBidOrders=0,bestAskOrders=0; long bestBidSequence=0,bestAskSequence=0;
   while(!FileIsEnding(handle))
   {
      datetime stamp=(datetime)FileReadNumber(handle);
      string symbol=FileReadString(handle); string side=WisdoUpper(FileReadString(handle));
      double price=FileReadNumber(handle),size=FileReadNumber(handle);
      int orders=(int)FileReadNumber(handle); long sequence=(long)FileReadNumber(handle);
      if(symbol!=Symbol() || MathAbs(WisdoClock()-stamp)>WisdoBookStaleSeconds) continue;
      if(MathAbs(price-MidPrice())>WisdoBookScanPoints*Point || size<=0) continue;
      totalSize+=size; levelCount++;
      if(side=="BID" && size>bestBidSize)
      { bestBidSize=size; bestBidPrice=price; bestBidOrders=orders; bestBidSequence=sequence; }
      if(side=="ASK" && size>bestAskSize)
      { bestAskSize=size; bestAskPrice=price; bestAskOrders=orders; bestAskSequence=sequence; }
   }
   FileClose(handle);
   if(bestBidSize>0) WisdoUpdateBookLevel(gWisdoBid,DIR_BUY,bestBidPrice,bestBidSize,bestBidOrders,bestBidSequence,"BROKER_DOM_BRIDGE");
   if(bestAskSize>0) WisdoUpdateBookLevel(gWisdoAsk,DIR_SELL,bestAskPrice,bestAskSize,bestAskOrders,bestAskSequence,"BROKER_DOM_BRIDGE");
   if(levelCount>0) gWisdoAverageBookSize=totalSize/levelCount;
   if(bestBidSize>0 || bestAskSize>0) gWisdoBookQuality="REAL_BROKER_DOM_BRIDGE";
   WisdoScoreBook();
}

void WisdoReadExternalBook()
{
   if(WisdoBookSource!=WISDO_BOOK_AUTO && WisdoBookSource!=WISDO_BOOK_EXTERNAL && WisdoBookSource!=WISDO_BOOK_BOTH) return;
   int handle=FileOpen(WisdoExternalBookFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ,'|');
   if(handle==INVALID_HANDLE) return;
   double bidPrice=0,bidSize=0,askPrice=0,askSize=0; int bidOrders=0,askOrders=0;
   long bidSequence=0,askSequence=0; double totalSize=0; int levelCount=0;
   while(!FileIsEnding(handle))
   {
      datetime stamp=(datetime)FileReadNumber(handle);
      string symbol=FileReadString(handle);
      string side=WisdoUpper(FileReadString(handle));
      double price=FileReadNumber(handle),size=FileReadNumber(handle);
      int orders=(int)FileReadNumber(handle); long sequence=(long)FileReadNumber(handle);
      if(symbol!=Symbol() || MathAbs(WisdoClock()-stamp)>WisdoBookStaleSeconds) continue;
      totalSize+=size; levelCount++;
      if(side=="BID" && size>bidSize) { bidPrice=price; bidSize=size; bidOrders=orders; bidSequence=sequence; }
      if(side=="ASK" && size>askSize) { askPrice=price; askSize=size; askOrders=orders; askSequence=sequence; }
   }
   FileClose(handle);
   if(bidSize>0) WisdoUpdateBookLevel(gWisdoBid,DIR_BUY,bidPrice,bidSize,bidOrders,bidSequence,"EXTERNAL_L2");
   if(askSize>0) WisdoUpdateBookLevel(gWisdoAsk,DIR_SELL,askPrice,askSize,askOrders,askSequence,"EXTERNAL_L2");
   if(levelCount>0) gWisdoAverageBookSize=totalSize/levelCount;
   if(bidSize>0 || askSize>0) gWisdoBookQuality="REAL_EXTERNAL_L2";
   WisdoScoreBook();
}

bool WisdoHeatmapConfirmsLevel(double armedLevel)
{
   if(!WisdoRequireHeatmapAtArmedLevel) return true;
   if(!gWisdoBookReady) return false;
   WISDO_BOOK_LEVEL levels[2]; levels[0]=gWisdoBid; levels[1]=gWisdoAsk;
   for(int i=0;i<2;i++)
      if(MathAbs(levels[i].price-armedLevel)<=gWisdoArmedTolerance &&
         levels[i].score>=WisdoMinimumBookScore &&
         levels[i].size>=gWisdoAverageBookSize*WisdoLargeLiquidityMultiplier &&
         WisdoClock()-levels[i].firstSeen>=WisdoMinimumPersistenceSeconds &&
         levels[i].replenishments>=WisdoMinimumReplenishments) return true;
   return false;
}

void WisdoDrawBookHeatmap()
{
   string bidName=Pfx()+"WISDO_BOOK_BID",askName=Pfx()+"WISDO_BOOK_ASK";
   if(!WisdoDrawHeatmap || gWisdoVisualMode=="GAMEPLAY" || !gWisdoBookReady)
   { ObjectDelete(0,bidName); ObjectDelete(0,askName); return; }
   if(gWisdoBid.price>0)
   {
      if(ObjectFind(0,bidName)<0) ObjectCreate(0,bidName,OBJ_HLINE,0,0,gWisdoBid.price);
      ObjectSetDouble(0,bidName,OBJPROP_PRICE1,gWisdoBid.price);
      ObjectSetInteger(0,bidName,OBJPROP_COLOR,C'212,175,55');
      ObjectSetInteger(0,bidName,OBJPROP_WIDTH,gWisdoBid.score>=WisdoMinimumBookScore?4:2);
   }
   if(gWisdoAsk.price>0)
   {
      if(ObjectFind(0,askName)<0) ObjectCreate(0,askName,OBJ_HLINE,0,0,gWisdoAsk.price);
      ObjectSetDouble(0,askName,OBJPROP_PRICE1,gWisdoAsk.price);
      ObjectSetInteger(0,askName,OBJPROP_COLOR,C'53,21,93');
      ObjectSetInteger(0,askName,OBJPROP_WIDTH,gWisdoAsk.score>=WisdoMinimumBookScore?4:2);
   }
}

void WisdoApplyCommand(string command,string arg1="",string arg2="")
{
   command=WisdoUpper(command);
   if(command=="AUTO" || command=="AUTO_MODE")
   { gWisdoMode=WISDO_AUTO; gWisdoSkipSignals=0; gWisdoArmedLevel=0.0; gEntryStatus="WISDO AUTO MODE"; }
   else if(command=="PAUSE") { gWisdoMode=WISDO_PAUSED; gEntryStatus="WISDO PAUSED"; }
   else if(command=="RESUME") { gWisdoMode=WISDO_AUTO; gEntryStatus="WISDO RESUMED"; }
   else if(command=="SKIP")
   { gWisdoSkipSignals=MathMax(0,(int)StringToInteger(arg1)); gEntryStatus="WISDO SKIP "+IntegerToString(gWisdoSkipSignals)+" SIGNALS"; }
   else if(command=="ARM_LEVEL")
   {
      gWisdoArmedLevel=StringToDouble(arg1);
      gWisdoArmedTolerance=(StringToDouble(arg2)>0.0?StringToDouble(arg2)*Point:WisdoLevelTolerancePoints*Point);
      gWisdoMode=WISDO_LEVEL_ARMED;
      gEntryStatus="WISDO ARMED AT "+DoubleToString(gWisdoArmedLevel,Digits);
   }
   else if(command=="VISUAL")
   {
      gWisdoVisualMode=WisdoUpper(arg1);
      bool clean=(gWisdoVisualMode=="CLEAN" || gWisdoVisualMode=="GAMEPLAY");
      DrawTriangle=!clean; DrawIchimokuCloud=!clean; EnableEntryDiagnostics=!clean; ShowDashboard=true;
      if(clean) DeleteObjects();
   }
   Print("WISDO command: ",command," ",arg1," ",arg2);
}

void WisdoSplitAndApply(string line)
{
   string parts[]; int count=StringSplit(line,'|',parts);
   if(count>0) WisdoApplyCommand(parts[0],count>1?parts[1]:"",count>2?parts[2]:"");
}

void WisdoPollLiveCommand()
{
   if(IsTesting() || TimeLocal()==gWisdoLastCommandCheck) return;
   gWisdoLastCommandCheck=TimeLocal();
   int handle=FileOpen(WisdoCommandFile,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(handle==INVALID_HANDLE) return;
   string line=FileReadString(handle); FileClose(handle);
   if(StringLen(line)>0) WisdoSplitAndApply(line);
   FileDelete(WisdoCommandFile,FILE_COMMON);
}

void WisdoPollTesterScript()
{
   if(!IsTesting()) return;
   int handle=FileOpen(WisdoTesterVoiceScript,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ);
   if(handle==INVALID_HANDLE) return;
   int row=0;
   while(!FileIsEnding(handle))
   {
      string line=FileReadString(handle);
      if(row++<gWisdoTesterRow) continue;
      string parts[]; int count=StringSplit(line,'|',parts);
      if(count<2) { gWisdoTesterRow=row; continue; }
      datetime at=StringToTime(parts[0]);
      if(at>TimeCurrent()) break;
      WisdoApplyCommand(parts[1],count>2?parts[2]:"",count>3?parts[3]:"");
      gWisdoTesterRow=row;
   }
   FileClose(handle);
}

bool WisdoEntryPermission()
{
   if(!WisdoSmartControlEnabled) return true;
   if(gWisdoMode==WISDO_PAUSED) { gEntryStatus="WISDO PAUSED - MANAGEMENT ACTIVE"; return false; }
   if(gWisdoMode==WISDO_LEVEL_ARMED)
   {
      if(gWisdoArmedLevel<=0.0 || MathAbs(MidPrice()-gWisdoArmedLevel)>gWisdoArmedTolerance)
      { gEntryStatus="WISDO WAITING FOR ARMED LEVEL"; return false; }
      if(WisdoRequireFVGAtArmedLevel)
      {
         double top=0,bottom=0; datetime when=0;
         bool buyGap=FindFVG(DIR_BUY,top,bottom,when) && gWisdoArmedLevel>=bottom && gWisdoArmedLevel<=top;
         bool sellGap=FindFVG(DIR_SELL,top,bottom,when) && gWisdoArmedLevel>=bottom && gWisdoArmedLevel<=top;
         if(!buyGap && !sellGap) { gEntryStatus="WISDO WAITING FOR FVG AT ARMED LEVEL"; return false; }
      }
      if(!WisdoHeatmapConfirmsLevel(gWisdoArmedLevel))
      { gEntryStatus="WISDO WAITING FOR VERIFIED ORDER-BOOK LIQUIDITY"; return false; }
   }
   if(gWisdoSkipSignals>0)
   {
      bool signalPresent=(gConfirmedArrowDirection!=DIR_FLAT || gCloudArrowCandidateDirection!=DIR_FLAT);
      if(signalPresent && TimeCurrent()!=gWisdoLastSkippedSignalTime)
      { gWisdoLastSkippedSignalTime=TimeCurrent(); gWisdoSkipSignals--; }
      gEntryStatus="WISDO SKIP ACTIVE - "+IntegerToString(gWisdoSkipSignals)+" LEFT";
      return false;
   }
   return true;
}

int OnInit()
{
   ApplyAllControls();
   gDirection=DetectDirection();
   ResetMovementTP();
   ResetEntryMovement();
   ResetArrowDirectionConfirmation();
   ResetReversalExitConfirmation();
   InitializeClosedTradeStats();
   InitializeHourlyTradeCounter();
   RefreshCloudMinuteCounter();
   gMarketRegime=DetermineMarketRegime();
   gPreviousMarketRegime=gMarketRegime;
   UpdateCloudRegimeAnchor();
   gEntryStatus=(IsMasterEnabled()?"SEARCHING":"MASTER DISABLED");
   string initLog="HT Trend/Cloud/Transition controls loaded";
   initLog += " | regimeControl=" + IntegerToString((int)RegimeControl);
   initLog += " | consolidationThreshold=" + IntegerToString(ConsolidationScoreThresholdValue);
   initLog += " | cloudRisk=" + DoubleToString(CloudRiskPercentValue,0) + "%";
   initLog += " | cloudZone=" + DoubleToString(CloudEntryZoneFractionValue*100.0,0) + "%";
   initLog += " | cloudTP=" + (CloudQuickProfitUseMidpoint?"MID":DoubleToString(CloudQuickProfitRValue,2)+"R");
   initLog += " | cloudMaxHold=" + IntegerToString(CloudMaxHoldSecondsValue) + "s";
   initLog += " | cloudRevExit=" + IntegerToString(CloudReversalExitTicksValue) + "t";
   initLog += " | cloudRegimeExit=" + (CloseCloudOnRegimeChange?"CLOSE":"HOLD");
   initLog += " | breakoutBars=" + IntegerToString(BreakoutConfirmationBarsValue);
   initLog += " | exactRiskPercent=" + DoubleToString(RiskPerEntryPercent,2);
   initLog += " | riskMoney=" + DoubleToString(SelectedRiskMoney(),2);
   initLog += " | startTrading=" + StartTradingTimeText();
   initLog += " | brokerNow=" + BrokerClockText();
   initLog += " | entryHours=" + EntryHoursText();
   initLog += " | reentry=" + ReentryDelayText();
   initLog += " | hourly=" + HourlyTradeLimitText();
   initLog += " | directionLimit=" + DirectionTradeLimitText();
   initLog += " | lossFilter=" + LossStreakText();
   initLog += " | lotCeiling=" + LotCeilingText();
   initLog += " | chopFilter=" + ChopFilterText();
   initLog += " | TP=" + DoubleToString(TakeProfitSLRatioValue,1) + "R";
   initLog += " | ichimoku=" + IntegerToString((int)IchimokuTrendFilter);
   initLog += " | arrowMode=" + ArrowEntryModeText();
   initLog += " | arrowSlopeFilter=" + ArrowSlopeText();
   initLog += " | arrowConfirmation=" + ArrowConfirmationText();
   initLog += " | reversalExit=" + ArrowReversalExitText();
   initLog += " | arithmeticSpacing=" + ArithmeticSpacingText();
   initLog += " | marginSafety=" + MarginSafetyText();
   initLog += " | maxGridEntries=" + IntegerToString(SafeMaximumEntries);
   initLog += " | campaignRiskCap=" + DoubleToString(MaximumCampaignRiskPercent,0) + "%";
   initLog += " | stopAfterAddonSL=" + (StopGridAfterFirstAddonSL ? "true" : "false");
   initLog += " | projectedMarginFloor=" + DoubleToString(MinimumProjectedMarginLevel,0) + "%";
   initLog += " | SLmethod=" + StopMethodText();
   initLog += " | ATR=" + ATRStopText();
   initLog += " | SLlookback=" + IntegerToString(StopLossLookbackBars);
   initLog += " | hold=" + HoldPolicyText();
   initLog += " | cloudBars=" + IntegerToString(IchimokuCloudHistoryBars);
   initLog += " | TF=" + IntegerToString((int)SignalTF);
   initLog += " | maxTrades=" + IntegerToString(MaximumOpenTrades);
   Print(initLog);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   DeleteObjects();
   ObjectDelete(0,Pfx()+"WISDO_BOOK_BID");
   ObjectDelete(0,Pfx()+"WISDO_BOOK_ASK");
}

void OnTick()
{
   if(WisdoSmartControlEnabled) { WisdoPollLiveCommand(); WisdoPollTesterScript(); }
   if(WisdoSmartControlEnabled) { WisdoReadBrokerBook(); WisdoReadExternalBook(); WisdoScoreBook(); }
   RefreshClosedTradeStats();
   RefreshHourlyTradeCounter();
   RefreshCloudMinuteCounter();

   int openAtTickStart=TradeCount();
   if(openAtTickStart==0 && gPreviousOpenTradeCount>0)
   {
      ResetArrowCampaignGrid();
      gLastArrowDirection=DIR_FLAT;
   }

   gDirection=DetectDirection();
   bool structureReady=UpdateStructure();
   if(structureReady)
   {
      CalculateGeometry();
      UpdateArrowDirectionConfirmation();
      TrackOvertradeDirectionState();
      RefreshArrowCampaignHistoryState();
      UpdateMode();
      UpdateCampaignState();
   }
   else
   {
      gMode=GEO_INVALID;
      ResetArrowDirectionConfirmation();
   }

   gPreviousMarketRegime=gMarketRegime;
   gMarketRegime=DetermineMarketRegime();
   if(gMarketRegime!=gPreviousMarketRegime)
   {
      Print("HT v1.4 REGIME CHANGE: ",MarketRegimeText(),
            " price=",DoubleToString(MidPrice(),Digits),
            " cloudBottom=",DoubleToString(gCloudBottom,Digits),
            " cloudTop=",DoubleToString(gCloudTop,Digits));
   }
   UpdateCloudRegimeAnchor();
   if(gMarketRegime==MARKET_CLOUD) UpdateCloudArrowConfirmation();
   else { gCloudArrowCandidateDirection=DIR_FLAT; gCloudArrowCandidateTicks=0; }

   if(TradeCount()>0)
   {
      if(HasOpenCloudTrade())
      {
         if(gMarketRegime==MARKET_CLOUD) CloudEquityFloorPasses(true);
         if(TradeCount()>0) ManageCloudHarvestExit();
      }
      ManageConfirmedArrowReversalExit();
      if(TradeCount()>0) ManageBasket();
      gDirection=DetectDirection();
      UpdateCampaignState();
   }
   else
   {
      gDirection=DIR_FLAT;
      gPeakProfit=0;
      UpdateCampaignState();
   }

   bool wisdoMayEnter=WisdoEntryPermission();
   if(!wisdoMayEnter)
   {
      DrawObjects();
      WisdoDrawBookHeatmap();
      gPreviousOpenTradeCount=TradeCount();
      return;
   }

   if(gMarketRegime==MARKET_TRANSITION)
   {
      ManageTransitionDefense();
   }
   else if(gMarketRegime==MARKET_CLOUD)
   {
      if(RegimeControl!=REGIME_TREND_ATTACK_ONLY) TryCloudHarvestEntry();
      else gEntryStatus="CLOUD BLOCKED - TREND ATTACK ONLY";
   }
   else // MARKET_TREND
   {
      if(RegimeControl==REGIME_CLOUD_HARVEST_ONLY)
         gEntryStatus="WAITING FOR CLOUD HARVEST REGIME";
      else if(ArrowEntryControl!=ARROW_ENTRY_OFF_USE_SETUPS)
      {
         if(structureReady) TryArrowTickEntry();
         else gEntryStatus="ARROW WAITING FOR STRUCTURE";
      }
      else if(TradeCount()>0) TryAdd();
      else TryInitialEntry();
   }

   DrawObjects();
   WisdoDrawBookHeatmap();
   gPreviousOpenTradeCount=TradeCount();
}
//+------------------------------------------------------------------+
