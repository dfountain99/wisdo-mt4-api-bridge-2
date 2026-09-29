Warning: truncated output (original token count: 430435)
... 673161 bytes omitted ...

//+------------------------------------------------------------------+
//| HIGHTOWER UNITY CAMPAIGN TASK ENGINE v6.20                      |
//| STRUCTURE FLOW • CONTINUATION POINTS • PRIMARY HOLD • ONE COMMANDER |
//+------------------------------------------------------------------+
#property strict
#property version "6.21"
#property description "v6.20: rail-held campaigns, section collectors, evidence-extended runners, realized milestones, bounded risk. Source release: requires MetaEditor compilation and demo validation."

enum Direction { DIR_SELL=-1, DIR_FLAT=0, DIR_BUY=1 };
enum HT_OraclePhase { ORACLE_ACCUMULATION=0, ORACLE_EXPANSION=1, ORACLE_DISTRIBUTION=2 };
enum HT_EvolutionError { EVO_ERROR_NONE=0, EVO_ERROR_DIRECTION=1, EVO_ERROR_LOCATION=2, EVO_ERROR_TIMING=3, EVO_ERROR_EXPOSURE=4 };
enum PyrSignalSource
{
   PYR_SOURCE_NONE=0,
   PYR_SOURCE_FAILED_EXTREME=1,
   PYR_SOURCE_TRAIN_STATION=2,
   PYR_SOURCE_RECLAIM_AREA=3,
   PYR_SOURCE_DIRECTIONAL_RETEST=4,
   PYR_SOURCE_BOS_CONTINUATION=5,
   PYR_SOURCE_CONFIRMED_TREND_FLIP=6,
   PYR_SOURCE_ROUTE_ACCELERATOR=7,
   PYR_SOURCE_INFLECTION_TRANSFER=8,
   PYR_SOURCE_RHYTHM_ACCELERATOR=9,
   PYR_SOURCE_CHANNEL_BOUNCE=10,
   PYR_SOURCE_CHANNEL_BREAK=11,
   PYR_SOURCE_TRIGGER_RAIL_BOUNCE=12,
   PYR_SOURCE_TRIGGER_RAIL_BREAK=13,
   PYR_SOURCE_BOS_PULLBACK=14,
   PYR_SOURCE_CHANNEL_BREAK_PULLBACK=15,
   PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY=16,
   PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL=17,
   PYR_SOURCE_U_SETUP=18,
   PYR_SOURCE_N_SETUP=19,
   PYR_SOURCE_MOTIV_V3=20,
   PYR_SOURCE_CC_GROW=21,
   PYR_SOURCE_KINGDOM_MANNER=22,
   PYR_SOURCE_KINGDOM_SCALE=23,
   PYR_SOURCE_COUNT=24
};
enum HT_PyramidEntryPermissions
{
   ENTRY_BOS_AND_CONFIRMED_REVERSALS=0,
   ENTRY_BOS_CONTINUATION_ONLY=1,
   ENTRY_CONFIRMED_REVERSALS_ONLY=2
};
enum HT_ProfitGrabMode
{
   PROFIT_STATION_PARTIAL_PLUS_PERCENT=0,
   PROFIT_STATION_PARTIAL_ONLY=1,
   PROFIT_STATION_FULL_CLOSE=2,
   PROFIT_PERCENT_FULL_CLOSE=3
};
enum HT_PartialGrabSize
{
   PARTIAL_GRAB_10_PERCENT=10,
   PARTIAL_GRAB_20_PERCENT=20,
   PARTIAL_GRAB_25_PERCENT=25,
   PARTIAL_GRAB_33_PERCENT=33,
   PARTIAL_GRAB_50_PERCENT=50,
   PARTIAL_GRAB_67_PERCENT=67,
   PARTIAL_GRAB_75_PERCENT=75,
   PARTIAL_GRAB_90_PERCENT=90
};
enum HT_PercentageGainTarget
{
   GAIN_TARGET_0_25_PERCENT=25,
   GAIN_TARGET_0_50_PERCENT=50,
   GAIN_TARGET_0_75_PERCENT=75,
   GAIN_TARGET_1_00_PERCENT=100,
   GAIN_TARGET_1_50_PERCENT=150,
   GAIN_TARGET_2_00_PERCENT=200,
   GAIN_TARGET_3_00_PERCENT=300,
   GAIN_TARGET_5_00_PERCENT=500,
   GAIN_TARGET_10_00_PERCENT=1000
};
enum HT_StationDecisionMode
{
   STATION_ADAPTIVE_MULTI_FACTOR=0,
   STATION_ALWAYS_BANK_SELECTED_PARTIAL=1,
   STATION_ALWAYS_HOLD_AND_EXTEND=2
};
enum HT_StationStrengthRequirement
{
   STATION_STRENGTH_0_10_ATR_RUNNER=10,
   STATION_STRENGTH_0_20_ATR_BALANCED=20,
   STATION_STRENGTH_0_35_ATR_STRICT=35,
   STATION_STRENGTH_0_50_ATR_FORTRESS=50
};
enum HT_RiskValueMode
{
   RISK_VALUE_CONSERVATIVE_HYBRID=0,
   RISK_VALUE_CONTRACT_SIZE=1,
   RISK_VALUE_BROKER_METADATA=2
};
enum HT_DashboardFocus
{
   DASH_FOCUS_AUTO=0,
   DASH_FOCUS_FULL_COMMAND_CENTER=1,
   DASH_FOCUS_IL_TRAIN_STATION=2,
   DASH_FOCUS_MARKET_STRUCTURE=3,
   DASH_FOCUS_ACTIVE_CAMPAIGN=4,
   DASH_FOCUS_VAULT_AND_RISK=5,
   DASH_FOCUS_MINIMAL=6,
   DASH_FOCUS_COMPOUND_STAIRCASE=7
};
enum HT_CompoundPhase
{
   CMP_BUILDING=0, CMP_GUARDING=1, CMP_UNLOCKED=2,
   CMP_COLLECTING=3, CMP_REBASING=4, CMP_PAUSED=5
};
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
// v1.31 preserves the v1.30 Sovereign Yoke engine and adds the Black Gold Guardian visual command center.
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
   MAX_ARROW_ENTRIES_5=5,
   MAX_ARROW_ENTRIES_6=6,
   MAX_ARROW_ENTRIES_8=8,
   MAX_ARROW_ENTRIES_10=10,
   MAX_ARROW_ENTRIES_12=12,
   MAX_ARROW_ENTRIES_15=15,
   MAX_ARROW_ENTRIES_20=20
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

//====================================================================
// DEADSHOT SOVEREIGN SCALE / YOKE / GRAVITY
//====================================================================
enum HT_SovereignCloseMode
{
   SOV_CLOSE_NORMAL=0,
   SOV_CLOSE_NET_PROFIT_ONLY=1,
   SOV_CLOSE_LOCK_AFTER_GREEN=2,
   SOV_CLOSE_DIRECT_LOSS_EXCEPTION=3
};

enum HT_GravityTrailControl
{
   GRAVITY_TRAIL_OFF=0,
   GRAVITY_TRAIL_BALANCED=1,
   GRAVITY_TRAIL_STRONG=2,
   GRAVITY_TRAIL_TIGHT=3
};

enum HT_YokeRiskDistribution
{
   YOKE_RISK_EXACT_PER_OX=0,
   YOKE_RISK_SHARE_CAMPAIGN_CAP=1
};

enum HT_BrokerLossPolicy
{
   BROKER_KEEP_ORIGINAL_SL=0,
   BROKER_REMOVE_SL_SOFTWARE_PROFIT_ONLY=1
};

enum HT_ReversalExposureControl
{
   REVERSAL_WAIT_FOR_FLAT=0,
   REVERSAL_ALLOW_HEDGE=1
};

// Character dropdowns replace raw behavior integers. The enum value is the
// exact runtime value, so every visible selection materially changes the EA.
enum HT_GravityReleaseCharacter
{
   GRAVITY_RELEASE_ONE_DISCIPLINED=1,
   GRAVITY_RELEASE_TWO_CONTROLLED=2,
   GRAVITY_RELEASE_THREE_BALANCED=3,
   GRAVITY_RELEASE_FIVE_AGGRESSIVE=5,
   GRAVITY_RELEASE_EIGHT_MAXIMUM=8
};
enum HT_YokeActivationCharacter
{
   YOKE_ACTIVATE_3_EARLY=3,
   YOKE_ACTIVATE_5_FAST=5,
   YOKE_ACTIVATE_8_BALANCED=8,
   YOKE_ACTIVATE_10_PATIENT=10,
   YOKE_ACTIVATE_15_HEAVY=15,
   YOKE_ACTIVATE_20_FORTRESS=20
};
enum HT_PyramidSwingCharacter
{
   PYR_SWING_2_HYPER_REACTIVE=2,
   PYR_SWING_3_FAST_WICK_HUNTER=3,
   PYR_SWING_4_BALANCED=4,
   PYR_SWING_5_PATIENT=5,
   PYR_SWING_6_DEEP_STRUCTURE=6,
   PYR_SWING_8_MAJOR_TURNS_ONLY=8
};
enum HT_PyramidMapMemory
{
   PYR_MAP_60_LOCAL=60,
   PYR_MAP_100_ACTIVE_SESSION=100,
   PYR_MAP_160_FULL_SESSION=160,
   PYR_MAP_240_DEEP_DAY=240,
   PYR_MAP_400_MAJOR_STRUCTURE=400
};
enum HT_PyramidRSICharacter
{
   PYR_RSI_5_HYPER_FAST=5,
   PYR_RSI_7_FAST=7,
   PYR_RSI_9_BALANCED=9,
   PYR_RSI_14_CLASSIC=14,
   PYR_RSI_21_SMOOTH=21
};
enum HT_PyramidConfirmationCharacter
{
   PYR_CONFIRM_1_INSTANT=1,
   PYR_CONFIRM_2_FAST=2,
   PYR_CONFIRM_3_BALANCED=3,
   PYR_CONFIRM_5_STRONG=5,
   PYR_CONFIRM_8_FORTRESS=8
};
enum HT_PyramidOutcomeMemory
{
   PYR_MEMORY_10_RECENT=10,
   PYR_MEMORY_20_RESPONSIVE=20,
   PYR_MEMORY_40_BALANCED=40,
   PYR_MEMORY_60_STABLE=60,
   PYR_MEMORY_100_LONG_TERM=100
};
enum HT_PyramidEntryCharacter
{
   PYR_ENTRIES_1_SINGLE_SHOT=1,
   PYR_ENTRIES_2_DOUBLE_TAP=2,
   PYR_ENTRIES_3_CONTROLLED_BURST=3,
   PYR_ENTRIES_4_ACTIVE_BURST=4,
   PYR_ENTRIES_6_RAPID_FIRE=6,
   PYR_ENTRIES_8_HEAVY_RAPID_FIRE=8,
   PYR_ENTRIES_10_MAXIMUM_PRESSURE=10,
   PYR_ENTRIES_12_SOVEREIGN_PRESSURE=12,
   PYR_ENTRIES_20_UNRESTRICTED_CAMPAIGN=20
};
enum HT_PyramidEntryRhythm
{
   PYR_RHYTHM_0_EVERY_TICK=0,
   PYR_RHYTHM_1_HYPER=1,
   PYR_RHYTHM_3_FAST=3,
   PYR_RHYTHM_5_ACTIVE=5,
   PYR_RHYTHM_8_BALANCED=8,
   PYR_RHYTHM_15_PATIENT=15,
   PYR_RHYTHM_30_SELECTIVE=30,
   PYR_RHYTHM_60_ONE_PER_MINUTE=60
};

enum HT_IchimokuFilter
{
   ICHIMOKU_FILTER_OFF=0,
   ICHIMOKU_PRICE_OUTSIDE_CLOUD=1,
   ICHIMOKU_STRICT_TREND=2
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

//====================================================================
// WISDO UNITY USER PRESETS
// One small control surface drives the deeper internal engine.
//====================================================================
enum HT_UnityPace
{
   UNITY_PACE_FAST=0,
   UNITY_PACE_BALANCED=1,
   UNITY_PACE_PATIENT=2
};
enum HT_UnityPressure
{
   UNITY_PRESSURE_SINGLE=1,
   UNITY_PRESSURE_DOUBLE=2,
   UNITY_PRESSURE_BURST_3=3,
   UNITY_PRESSURE_RAPID_6=6,
   UNITY_PRESSURE_HEAVY_10=10,
   UNITY_PRESSURE_MAX_20=20
};
enum HT_UnityEntryLogic
{
   UNITY_ENTRY_BOS_AND_CONFIRMED_FLIPS=0,
   UNITY_ENTRY_BOS_ONLY=1,
   UNITY_ENTRY_CONFIRMED_FLIPS_ONLY=2
};
enum HT_UnityStationMind
{
   UNITY_STATION_ADAPTIVE=0,
   UNITY_STATION_BANK_PARTIAL=1,
   UNITY_STATION_HOLD_EXTEND=2
};
enum HT_UnityProfitPlan
{
   UNITY_PROFIT_STATION_PARTIAL_PLUS_GAIN=0,
   UNITY_PROFIT_STATION_PARTIAL_ONLY=1,
   UNITY_PROFIT_FULL_AT_STATION=2,
   UNITY_PROFIT_FULL_AT_GAIN_TARGET=3
};


//===============================================================================
// HIGHTOWER UNITY LIVING ORGANISM v5.00
// USER CONTROL SURFACE -- DROPDOWNS ONLY
// The creature owns numeric physiology internally. The user chooses behavior.
//===============================================================================
enum HT5_LifeMission
{
   LIFE_COMPOUND_HUNTER_BACK_TO_BACK=0,
   LIFE_RAPID_GROWTH_WITH_SINGLE_RISK_BUDGET=1,
   LIFE_BALANCED_GROWTH_AND_PROTECTION=2,
   LIFE_CAPITAL_GUARDIAN_SLOWER_GROWTH=3,
   LIFE_OBSERVE_AND_LEARN_NO_NEW_TRADES=4
};
enum HT5_TradePermission
{
   TRADE_BOTH_DIRECTIONS=0,
   TRADE_BUYS_ONLY=1,
   TRADE_SELLS_ONLY=2,
   MANAGE_OPEN_TRADES_ONLY=3,
   CREATURE_SLEEP_NO_TRADING=4
};
enum HT5_SignalClock
{
   SIGNAL_CLOCK_M1_FAST=1,
   SIGNAL_CLOCK_M5_PRIMARY=5,
   SIGNAL_CLOCK_M15_SWING=15,
   SIGNAL_CLOCK_M30_SLOW=30,
   SIGNAL_CLOCK_H1_POSITION=60
};
enum HT5_CompoundGoal
{
   COMPOUND_1_PERCENT_EACH_CYCLE=1,
   COMPOUND_2_PERCENT_EACH_CYCLE=2,
   COMPOUND_3_PERCENT_EACH_CYCLE=3,
   COMPOUND_5_PERCENT_EACH_CYCLE=5,
   COMPOUND_7_PERCENT_EACH_CYCLE=7,
   COMPOUND_10_PERCENT_EACH_CYCLE=10,
   COMPOUND_15_PERCENT_EACH_CYCLE=15,
   COMPOUND_20_PERCENT_EACH_CYCLE=20,
   COMPOUND_25_PERCENT_EACH_CYCLE=25,
   COMPOUND_50_PERCENT_EACH_CYCLE=50,
   COMPOUND_100_PERCENT_EACH_CYCLE=100
};
enum HT5_SeedRisk
{
   SEED_RISK_1_PERCENT=1,
   SEED_RISK_2_PERCENT=2,
   SEED_RISK_3_PERCENT=3,
   SEED_RISK_5_PERCENT=5,
   SEED_RISK_7_PERCENT=7,
   SEED_RISK_10_PERCENT=10
};
enum HT5_CampaignRiskCeiling
{
   CAMPAIGN_RISK_CAP_2_PERCENT=2,
   CAMPAIGN_RISK_CAP_3_PERCENT=3,
   CAMPAIGN_RISK_CAP_5_PERCENT=5,
   CAMPAIGN_RISK_CAP_6_PERCENT=6,
   CAMPAIGN_RISK_CAP_8_PERCENT=8,
   CAMPAIGN_RISK_CAP_10_PERCENT=10,
   CAMPAIGN_RISK_CAP_15_PERCENT=15,
   CAMPAIGN_RISK_CAP_20_PERCENT=20
};
enum HT5_GrowthReflex
{
   GROWTH_SCOUT_ONE_CAR_AT_A_TIME=0,
   GROWTH_BALANCED_EARNED_ADDS=1,
   GROWTH_RAPID_SONIC_EARNED_ADDS=2,
   GROWTH_COMPOUND_OVERDRIVE_EARNED_ADDS=3
};
enum HT5_EntryLocationLaw
{
   ENTRY_ONLY_AT_SIGNAL_FVG=0,
   ENTRY_SIGNAL_FVG_PLUS_OB_PREFERRED=1,
   ENTRY_SIGNAL_FVG_OR_RECLAIM_STATION=2,
   ENTRY_ADAPTIVE_INSTITUTIONAL_LOCATION=3,
   ENTRY_ANY_NAMED_SETUP_WITH_AGREEMENT=4
};
enum HT5_SetupLibraryLaw
{
   SETUP_LIBRARY_CORE_ONLY=0,
   SETUP_LIBRARY_STRUCTURE_AND_LIQUIDITY=1,
   SETUP_LIBRARY_ALL_NAMED_CREATURE_SETUPS=2
};
enum HT5_SetupAgreementLaw
{
   AGREEMENT_ONE_INDEPENDENT_WITNESS=1,
   AGREEMENT_TWO_INDEPENDENT_WITNESSES=2,
   AGREEMENT_THREE_STRONG_WITNESSES=3,
   AGREEMENT_ADAPTIVE_BY_SETUP_RELIABILITY=4
};
enum HT5_BreakExecutionLaw
{
   BREAK_ENTER_ON_PROVEN_BREAK_ONLY=0,
   BREAK_WAIT_FOR_PULLBACK_ONLY=1,
   BREAK_ALLOW_BREAK_AND_PULLBACK_ENTRIES=2,
   BREAK_ADAPTIVE_BREAK_OR_PULLBACK_BY_FLOW=3
};
enum HT5_FVGPrecision
{
   FVG_STRICT_SMALL_TOUCH_WINDOW=0,
   FVG_BALANCED_RETEST_WINDOW=1,
   FVG_WIDE_FAST_MARKET_WINDOW=2,
   FVG_ADAPTIVE_TO_LIVE_ATR_AND_FLOW=3
};
enum HT5_HistoricalMemory
{
   MEMORY_5000_BARS_FAST=0,
   MEMORY_10000_BARS_MEDIUM=1,
   MEMORY_20000_BARS_DEEP=2,
   MEMORY_40000_BARS_MAXIMUM=3
};
enum HT5_ChannelAuthority
{
   CHANNEL_CONTEXT_ONLY=0,
   CHANNEL_DIRECTION_FIREWALL=1,
   CHANNEL_HARD_BOUNCE_AND_BREAK_AUTHORITY=2,
   CHANNEL_ADAPTIVE_BY_TOUCHES_AND_ACCEPTANCE=3
};
enum HT5_DayExtremeLaw
{
   DAY_EXTREMES_VISUAL_ONLY=0,
   DAY_EXTREMES_SOFT_WARNING=1,
   DAY_EXTREMES_HARD_COUNTER_ENTRY_FIREWALL=2,
   DAY_EXTREMES_ADAPTIVE_BY_TOUCH_AND_FLOW=3
};
enum HT5_ThreeWayRailLaw
{
   THREE_WAY_CHANNEL_VISUAL_CONTEXT=0,
   BLACK_RAIL_REJECT_BREAK_SIGNALS=1,
   BLACK_RAIL_HARD_TRANSFER_AUTHORITY=2,
   BLACK_RAIL_ADAPTIVE_WITH_FVG_AND_RHYTHM=3
};
enum HT5_RhythmLaw
{
   RHYTHM_PERMISSIVE_RETESTS=0,
   RHYTHM_BALANCED_PHYSICAL_FLOW=1,
   RHYTHM_STRICT_LAUNCH_CONFIRMATION=2,
   RHYTHM_DEEP_TICK_PHYSICS=3
};
enum HT5_PulseLaw
{
   PULSE_LIMITS_OFF=0,
   PULSE_ONE_SCOUT_PER_ZONE=1,
   PULSE_MAGNETIC_GROW_TOWARD_PRICE=2,
   PULSE_ADAPTIVE_MAGNETIC_WITH_CRASH_BRAKE=3
};
enum HT5_SonicLaw
{
   SONIC_OFF_SEED_ONLY=0,
   SONIC_R_LADDER_SINGLE_RISK_BUDGET=1,
   SONIC_R_LADDER_PLUS_CAGE_PLUGS=2,
   SONIC_FULL_ADAPTIVE_COMPOUND_ACCELERATOR=3
};
enum HT5_OrganMeshLaw
{
   MESH_LOOSE_ORGANS_SHARE_CONTEXT=0,
   MESH_ONE_SHARED_THESIS_BEFORE_ENTRY=1,
   MESH_LOCK_SETUP_TO_CAMPAIGN_THESIS=2,
   MESH_ADAPTIVE_SINGLE_NERVOUS_SYSTEM=3
};
enum HT5_StopLossLaw
{
   STOP_LOSS_SETUP_INVALIDATION_ONLY=0,
   STOP_LOSS_BEYOND_LAST_STRUCTURE_SWING=1,
   STOP_LOSS_HYBRID_SETUP_PLUS_STRUCTURE=2,
   STOP_LOSS_ADAPTIVE_THESIS_INVALIDATION=3
};

// v5.04 -- unified trend / formula-arrow / stop-reserve behavior families.
enum HT5_TrendFortificationLaw
{
   TREND_FORTIFY_CONTEXT_ONLY=0,
   TREND_FORTIFY_TRAIN_DIRECTION_REQUIRED=1,
   TREND_FORTIFY_TRAIN_PLUS_FORMULA_ARROW=2,
   TREND_FORTIFY_ADAPTIVE_REVERSALS_MUST_PROVE_TRANSFER=3
};
enum HT5_ArrowFormulaLaw
{
   ARROW_FORMULA_WEIGHT_ONLY=0,
   ARROW_FORMULA_STRUCTURE_PLUS_FLOW=1,
   ARROW_FORMULA_FULL_CREATURE=2,
   ARROW_FORMULA_ADAPTIVE_TRAIN_FUSION=3
};
enum HT5_StopBreathingLaw
{
   STOP_BREATHING_OFF=0,
   STOP_BREATH_PREBUDGETED_HARD_RESERVE=1,
   STOP_BREATH_STRUCTURE_REANCHOR_WITHIN_RESERVE=2,
   STOP_BREATH_ADAPTIVE_ONLY_WHEN_TREND_RIGHT=3
};

// v5.05 -- audit-driven entry survival / source probation / thesis merging / telemetry.
enum HT5_EntrySurvivalLaw
{
   SURVIVAL_FILTER_OFF=0,
   SURVIVAL_NOISE_ENVELOPE_BALANCED=1,
   SURVIVAL_NOISE_ENVELOPE_STRICT=2,
   SURVIVAL_ADAPTIVE_BY_TRAIN_AND_EXPECTANCY=3
};
enum HT5_SetupProbationLaw
{
   PROBATION_OBSERVE_ONLY=0,
   PROBATION_REQUIRE_EXTRA_WITNESS=1,
   PROBATION_EXTRA_WITNESS_AND_RISK_REDUCTION=2,
   PROBATION_FULL_ADAPTIVE_SOURCE_SIDE_CONTROL=3
};
enum HT5_ThesisMergeLaw
{
   MERGE_ONLY_IDENTICAL_EVENT=0,
   MERGE_SAME_DIRECTION_INTO_CAMPAIGN=1,
   MERGE_SETUP_SIGNALS_AS_WITNESSES=2,
   MERGE_ADAPTIVE_ONE_CAMPAIGN_ONE_THESIS=3
};
enum HT5_TelemetryLaw
{
   TELEMETRY_CAMPAIGN_ONLY=0,
   TELEMETRY_MFE_MAE_PER_TICKET=1,
   TELEMETRY_GHOST_HOLD_STAGES=2,
   TELEMETRY_DEEP_SURVIVAL_AUTOPSY=3
};
enum HT5_ProtectionLaw
{
   PROTECT_STANDARD_FORWARD_ONLY=0,
   PROTECT_BASKET_BREAK_EVEN_RATCHET=1,
   PROTECT_CAMPAIGN_WIDE_MONEY_SOLVER=2,
   PROTECT_ADAPTIVE_NEVER_GIVE_BACK_PROVEN_PROFIT=3
};
enum HT5_ReversalLaw
{
   REVERSAL_CONSERVATIVE_INFLECTION_ONLY=0,
   REVERSAL_BALANCED_STRUCTURE_PLUS_ACCEPTANCE=1,
   REVERSAL_BLACK_CHANNEL_TRANSFER=2,
   REVERSAL_FULL_CREATURE_CONSENSUS=3
};
enum HT5_OracleLaw
{
   ORACLE_CONTEXT_ONLY=0,
   ORACLE_WYCKOFF_OB_FVG=1,
   ORACLE_DEEP_PHASE_AND_RED_CONTINUATION=2,
   ORACLE_FULL_INSTITUTIONAL_CONTEXT=3
};
enum HT5_WillLaw
{
   WILL_MEMORY_OFF=0,
   WILL_OBSERVE_EXPECTANCY=1,
   WILL_ADAPT_AUTHORITY=2,
   WILL_DEEP_CAMPAIGN_MEMORY=3
};
enum HT5_SurfLaw
{
   SURF_LEARNER_OFF=0,
   SURF_MAGNITUDE_ONLY=1,
   SURF_ADAPTIVE_MAGNITUDE_WITH_UNCERTAINTY=2,
   SURF_DEEP_RESIDUAL_MEMORY=3
};
enum HT5_EvolutionLaw
{
   EVOLUTION_OFF=0,
   EVOLUTION_AUTOPSY_ONLY=1,
   EVOLUTION_MUTATE_AFTER_REPEAT_EVIDENCE=2,
   EVOLUTION_SHADOW_GENOMES_AND_ROLLBACK=3,
   EVOLUTION_DEEP_SELF_EVOLVING_CREATURE=4
};
enum HT5_LearningSpeed
{
   LEARNING_SLOW_STABLE=0,
   LEARNING_BALANCED=1,
   LEARNING_FAST_RESPONSIVE=2
};
enum HT5_SmallAccountLaw
{
   SMALL_ACCOUNT_STRICT_SELECTED_RISK=0,
   SMALL_ACCOUNT_ALLOW_BROKER_MINIMUM_WITH_CAP=1,
   SMALL_ACCOUNT_UNIVERSAL_AUTO_ADAPT=2
};
enum HT5_MarginReserveLaw
{
   KEEP_80_PERCENT_MARGIN_RESERVE=0,
   KEEP_70_PERCENT_MARGIN_RESERVE=1,
   KEEP_60_PERCENT_MARGIN_RESERVE=2,
   KEEP_50_PERCENT_MARGIN_RESERVE=3,
   KEEP_40_PERCENT_MARGIN_RESERVE=4
};
enum HT5_SessionLaw
{
   SESSION_TRADE_ALL_MARKET_HOURS=0,
   SESSION_PREFER_LONDON_AND_NEWYORK=1,
   SESSION_ADAPT_TO_LIQUIDITY_AND_SPREAD=2,
   SESSION_LEARN_BEST_HOURS_PER_SYMBOL=3
};
enum HT6_TradingWindowMode
{
   TIME_WINDOW_ALL_HOURS=0,
   TIME_WINDOW_LONDON_AND_NEWYORK=1,
   TIME_WINDOW_CUSTOM_TWO_WINDOWS=2
};
enum HT5_CollectionLaw
{
   COLLECT_EXACT_COMPOUND_TARGET=0,
   COLLECT_COMPOUND_WITH_STRUCTURE_AWARE_EXTENSION=1,
   COLLECT_COMPOUND_WITH_PEAK_PROTECTION=2,
   COLLECT_ADAPTIVE_TARGET_AND_RED_BREAKOUT=3
};
enum HT5_DataDepth
{
   DATA_STANDARD_64_FEATURES=0,
   DATA_DEEP_128_FEATURES=1,
   DATA_MAXIMUM_256_FEATURES=2
};
enum HT5_HospitalLaw
{
   HOSPITAL_DIAGNOSTICS_ONLY=0,
   HOSPITAL_SOFT_DEADLOCK_RECOVERY=1,
   HOSPITAL_DEEP_ORGAN_HEALTH_AND_REPAIR=2
};
enum HT5_VisualLife
{
   VISUAL_LIVING_CREATURE=0,
   VISUAL_FULL_DIAGNOSTIC_ORGANS=1,
   VISUAL_MINIMAL_KEEP_CHART_CLEAR=2
};
enum HT5_PostCollectionRestart
{
   RESTART_NEXT_HUNT_IMMEDIATELY=0,
   RESTART_AFTER_1_SECOND=1,
   RESTART_AFTER_3_SECONDS=3,
   RESTART_AFTER_5_SECONDS=5
};

//===============================================================================
// v6.00 SEQUENCE DOCTRINE — USER SEMANTICS
// These choices change campaign interpretation, not isolated indicator thresholds.
//===============================================================================
enum HT6_SequenceStrictness
{
   SEQUENCE_RESPONSIVE=0,
   SEQUENCE_BALANCED=1,
   SEQUENCE_STRICT=2,
   SEQUENCE_FORTRESS=3
};

enum HT6_PhaseThreeLaw
{
   PHASE3_ADAPTIVE_ONE_PROVEN_ADD=0,
   PHASE3_PROTECT_ONLY=1,
   PHASE3_CONTINUE_WHILE_EXCEPTIONAL=2
};

enum HT6_TransferLaw
{
   TRANSFER_ACCEPTED_OPPOSITE_BOS=0,
   TRANSFER_BOS_PLUS_RHYTHM=1,
   TRANSFER_FULL_CREATURE_CONSENSUS=2
};

enum HT6_SequenceMemoryLaw
{
   SEQUENCE_MEMORY_OBSERVE_ONLY=0,
   SEQUENCE_MEMORY_BOUNDED_ADAPTATION=1
};

enum HT6_SequencePhase
{
   SEQ_PHASE_OBSERVE=0,
   SEQ_PHASE_ATTACK=1,
   SEQ_PHASE_ACCELERATE=2,
   SEQ_PHASE_ZONE_3_5=3,
   SEQ_PHASE_DEFEND=4,
   SEQ_PHASE_HARVEST=5
};

enum HT6_MoveType
{
   MOVE_TYPE_UNKNOWN=0,
   MOVE_TYPE_DIRECT=1,
   MOVE_TYPE_TWO_STAGE=2,
   MOVE_TYPE_STAIRCASE=3
};

enum HT6_PauseType
{
   PAUSE_TYPE_NONE=0,
   PAUSE_TYPE_PULLBACK=1,
   PAUSE_TYPE_SHELF=2,
   PAUSE_TYPE_HESITATION=3
};

enum HT6_RequestKind
{
   DOCTRINE_REQUEST_SEED=0,
   DOCTRINE_REQUEST_ADD=1,
   DOCTRINE_REQUEST_PENDING=2,
   DOCTRINE_REQUEST_TRANSFER=3,
   DOCTRINE_REQUEST_PROTECT=4,
   DOCTRINE_REQUEST_HARVEST=5
};

// v6.08 DIRECT EXECUTION INPUTS -------------------------------------------------
// These modes are applied LAST and refreshed every tick so legacy semantic
// presets cannot silently overwrite the settings the user actually selected.
enum HT6_DirectStopMode
{
   DIRECT_STOP_ATR=0,
   DIRECT_STOP_FIXED_POINTS=1,
   DIRECT_STOP_WIDER_ATR_OR_STRUCTURE=2
};
enum HT6_DirectTakeProfitMode
{
   DIRECT_TP_R_MULTIPLE=0,
   DIRECT_TP_ATR_MULTIPLE=1,
   DIRECT_TP_FIXED_POINTS=2,
   DIRECT_TP_COMPOUND_PERCENT=3,
   DIRECT_TP_INTENT_ADAPTIVE=4
};

HT5_LifeMission WhatIsTheCreaturesMission=LIFE_COMPOUND_HUNTER_BACK_TO_BACK;
HT5_TradePermission WhatMayTheCreatureTrade=TRADE_BOTH_DIRECTIONS;
HT5_SignalClock HowFastShouldTheCreatureReadSignals=SIGNAL_CLOCK_M5_PRIMARY;
HT5_CompoundGoal CompoundAccountByThisRateEveryCycle=COMPOUND_10_PERCENT_EACH_CYCLE;
HT5_SeedRisk RiskThisMuchOnTheInitialSeed=SEED_RISK_1_PERCENT;
HT5_CampaignRiskCeiling NeverLetOneCampaignRiskMoreThan=CAMPAIGN_RISK_CAP_6_PERCENT;
HT5_GrowthReflex HowAggressivelyShouldWinningMovementGrow=GROWTH_RAPID_SONIC_EARNED_ADDS;
HT5_EntryLocationLaw WhereMayFreshEntriesBegin=ENTRY_ADAPTIVE_INSTITUTIONAL_LOCATION;
HT5_SetupLibraryLaw WhichNamedSetupFamiliesMayCreateEntries=SETUP_LIBRARY_ALL_NAMED_CREATURE_SETUPS;
HT5_SetupAgreementLaw HowMuchIndependentAgreementMustASetupHave=AGREEMENT_ONE_INDEPENDENT_WITNESS;
HT5_OrganMeshLaw HowTightlyShouldAllOrgansMesh=MESH_ONE_SHARED_THESIS_BEFORE_ENTRY;
HT5_BreakExecutionLaw HowShouldBreakoutsAndBOSExecute=BREAK_ALLOW_BREAK_AND_PULLBACK_ENTRIES;
HT5_FVGPrecision HowPreciselyShouldPriceRetestTheFVG=FVG_ADAPTIVE_TO_LIVE_ATR_AND_FLOW;
HT5_HistoricalMemory HowFarBackShouldTheCreatureRemember=MEMORY_20000_BARS_DEEP;
HT5_ChannelAuthority HowMuchAuthorityShouldHistoricalChannelsHave=CHANNEL_CONTEXT_ONLY;
HT5_DayExtremeLaw HowShouldDayHighLowProtectEntries=DAY_EXTREMES_VISUAL_ONLY;
HT5_ThreeWayRailLaw HowShouldTheBlackGoldRedChannelBehave=BLACK_RAIL_ADAPTIVE_WITH_FVG_AND_RHYTHM;
HT5_RhythmLaw HowStrongMustLiveTickFlowBe=RHYTHM_PERMISSIVE_RETESTS;
HT5_PulseLaw HowShouldMagneticLimitZonesGrow=PULSE_ADAPTIVE_MAGNETIC_WITH_CRASH_BRAKE;
HT5_SonicLaw HowShouldSonicAccelerateWinningTrades=SONIC_FULL_ADAPTIVE_COMPOUND_ACCELERATOR;
HT5_ProtectionLaw HowShouldTheCreatureProtectEarnedProfit=PROTECT_CAMPAIGN_WIDE_MONEY_SOLVER;
HT5_StopLossLaw HowShouldTheCreaturePlaceItsStopLoss=STOP_LOSS_ADAPTIVE_THESIS_INVALIDATION;
HT5_TrendFortificationLaw HowStrictlyMustEveryEntryFollowTrainDirection=TREND_FORTIFY_CONTEXT_ONLY;
HT5_ArrowFormulaLaw HowShouldArrowDirectionBeCalculated=ARROW_FORMULA_ADAPTIVE_TRAIN_FUSION;
HT5_StopBreathingLaw HowShouldStopsBreatheWhenTrendIsStillRight=STOP_BREATH_ADAPTIVE_ONLY_WHEN_TREND_RIGHT;
HT5_EntrySurvivalLaw HowShouldEntriesProveTheyCanSurviveNormalNoise=SURVIVAL_FILTER_OFF;
HT5_SetupProbationLaw HowShouldLosingSetupFamiliesBeHandled=PROBATION_OBSERVE_ONLY;
HT5_ThesisMergeLaw HowShouldMultipleSignalsJoinOneCampaign=MERGE_ADAPTIVE_ONE_CAMPAIGN_ONE_THESIS;
HT5_TelemetryLaw HowDeepShouldEachTradeBeMeasuredAfterExit=TELEMETRY_DEEP_SURVIVAL_AUTOPSY;
HT5_ReversalLaw HowShouldTheCreatureReverseDirection=REVERSAL_BALANCED_STRUCTURE_PLUS_ACCEPTANCE;
HT5_OracleLaw HowDeepShouldOracleReadMarketPhase=ORACLE_FULL_INSTITUTIONAL_CONTEXT;
HT5_WillLaw HowMuchCampaignMemoryShouldWILLUse=WILL_DEEP_CAMPAIGN_MEMORY;
HT5_SurfLaw HowShouldSURFLearnPredictionError=SURF_DEEP_RESIDUAL_MEMORY;
HT5_EvolutionLaw HowShouldTheGenomeEvolve=EVOLUTION_AUTOPSY_ONLY;
HT5_LearningSpeed HowFastMayTheGenomeChange=LEARNING_BALANCED;
HT5_SmallAccountLaw HowShouldVerySmallAccountsBeHandled=SMALL_ACCOUNT_UNIVERSAL_AUTO_ADAPT;
HT5_MarginReserveLaw HowMuchMarginShouldRemainUnused=KEEP_60_PERCENT_MARGIN_RESERVE;
HT5_SessionLaw WhenShouldTheCreaturePreferToHunt=SESSION_TRADE_ALL_MARKET_HOURS;
HT5_CollectionLaw HowShouldCompoundTargetsBeCollected=COLLECT_ADAPTIVE_TARGET_AND_RED_BREAKOUT;
HT5_DataDepth HowDeepShouldMarketMemoryBecome=DATA_DEEP_128_FEATURES;
HT5_HospitalLaw HowShouldTheHospitalHandleDeadlocks=HOSPITAL_DEEP_ORGAN_HEALTH_AND_REPAIR;
HT5_VisualLife HowMuchOfTheLivingDashboardShouldShow=VISUAL_LIVING_CREATURE;
HT5_PostCollectionRestart HowSoonAfterCollectionShouldTheNextHuntStart=RESTART_AFTER_3_SECONDS;

// --- v6.00 campaign-sequence doctrine.  These are semantic controls only.
HT6_SequenceStrictness HowStrictlyShouldMovesAndPausesBeConfirmed=SEQUENCE_RESPONSIVE;
HT6_PhaseThreeLaw WhatMayTheCreatureDoWhenMoveThreeBegins=PHASE3_ADAPTIVE_ONE_PROVEN_ADD;
HT6_TransferLaw WhatMustProveARealCampaignTransfer=TRANSFER_BOS_PLUS_RHYTHM;
HT6_SequenceMemoryLaw HowMaySequenceMemoryInfluenceTheCreature=SEQUENCE_MEMORY_OBSERVE_ONLY;

// ===================================================================
// v6.10 SINGLE-AUTHORITY LIVE INPUTS
// ONLY THESE VISIBLE SETTINGS CONTROL EXECUTION. Legacy semantic menus below
// are internal observation defaults and are intentionally hidden from Inputs.
// ===================================================================
bool DirectInputsOwnExecution=true;                 // permanently ON in v6.10
bool DirectUseLegacyBasketCompoundCollector=false; // permanently OFF in v6.10

// MASTER + PRIMARY STRUCTURE
input bool   DirectAllowNewEntries=true;
// CHRONOS ENTRY WINDOW — broker-clock hard gate for NEW entries only.
// Open positions remain managed outside the window. ALL_HOURS preserves legacy behavior.
input HT6_TradingWindowMode DirectTradingWindowMode=TIME_WINDOW_ALL_HOURS;
input int    DirectWindow1StartHour=7;
input int    DirectWindow1EndHour=16;
input int    DirectWindow2StartHour=16;
input int    DirectWindow2EndHour=21;
input bool   DirectAllowBuyPrimaries=true;
input bool   DirectAllowSellPrimaries=true;
input ENUM_TIMEFRAMES DirectSignalTimeframe=PERIOD_M5;
input int    DirectLLPivotDepth=2;
input int    DirectLLBoxScanBars=320;
input int    DirectUpperRailCandlesLeft=2;
input double DirectStructureBreakBufferATR=0.00;
input int    DirectBuySwitchClosedCandles=1;
input int    DirectSellSwitchClosedCandles=2;
input bool   DirectOpenCoreOnSameDirectionBreak=true;
input int    DirectMaximumCoreHolds=5;
input int    DirectMaximumTotalOpenTrades=12;
input int    DirectSlippagePoints=30;

// RISK + COMPOUND — every new trade resizes from the CURRENT account value.
input double DirectRiskPercentEveryTrade=0.50;
input double DirectCoreRiskMultiplier=1.00;
input double DirectMaximumSingleTradeRiskPercent=1.00;
input double DirectMaximumOpenRiskPercent=5.00;
input bool   DirectCompoundEveryTradeFromCurrentAccount=true;
input HT_AccountBasis DirectCompoundRiskBasis=RISK_FROM_BALANCE;
input double DirectCompoundTargetPercentPerTrade=2.00;

// STOP LOSS — direct ATR/fixed choice applies to CORE + SONIC + evidence adds.
input HT6_DirectStopMode DirectStopLossMode=DIRECT_STOP_ATR;
input int    DirectATRStopPeriod=14;
input double DirectATRStopMultiplier=1.50;
input double DirectMinimumStopDistancePoints=30.0;
input double DirectFixedStopDistancePoints=300.0;
input double DirectStructureStopBufferATR=0.08;

// TAKE PROFIT — broker TP is attached to EVERY trade when enabled.
bool DirectEveryTradeHasTakeProfit=true; // collectors/runners only; hold TP is always zero
HT6_DirectTakeProfitMode DirectTakeProfitMode=DIRECT_TP_INTENT_ADAPTIVE; // H620Target combines adaptive intent and growth
input double DirectTakeProfitRMultiple=1.50;
input double DirectTakeProfitATRMultiplier=2.00;
input double DirectTakeProfitFixedPoints=500.0;
input double DirectAdaptiveTPMinimumR=1.05;
input double DirectAdaptiveTPMaximumR=2.25;
input double DirectAdaptiveTPCoreScale=1.00;
input double DirectAdaptiveTPSonicScale=0.80;

// BREAK-EVEN + ATR TRAIL — per ticket.
input bool   DirectUseBreakEven=true;
input double DirectBreakEvenTriggerR=0.75;
input double DirectBreakEvenLockR=0.05;
input bool   DirectUseATRTrailingStop=true;
input double DirectTrailStartATR=1.00;
input double DirectTrailDistanceATR=0.75;
input double DirectTrailStepATR=0.15;
bool DirectTrailCoreTrades=false; // v6.20 confirmed structural rail owns hold stops
input bool   DirectTrailSonicTrades=true;
bool DirectCoreSLRatchetToNextCore=false; // new entry price is not a structural rail

// SONIC FLOW LADDER — all risk fractions multiply DirectRiskPercentEveryTrade.
input int    DirectSonicNodesBetweenCores=24;
input double DirectSonicNodeSpacingR=0.08;
input int    DirectSonicMinimumSecondsBetweenAdds=0;
input double DirectSonicMinimumVelocity=0.68;
input double DirectSonicMaximumOppositionCharge=1.10;
input int    DirectMaximumSonicAddsPerTick=3;
input double DirectSonicRiskFractionLeg1=0.38;
input double DirectSonicRiskFractionLeg2=0.34;
input double DirectSonicRiskFractionLeg3=0.28;
input double DirectSonicRiskFractionLeg4=0.22;
input double DirectSonicRiskFractionLeg5=0.16;

// LOGIC-BACKED EVIDENCE STAIRS
input int    DirectMaximumEvidenceAddsPerLeg=8;
input double DirectEvidenceRiskFractionLeg2=0.85;
input double DirectEvidenceRiskFractionLeg3=0.65;
input double DirectEvidenceRiskFractionLeg4=0.50;
input double DirectEvidenceRiskFractionLeg5=0.35;
input double DirectMinimumIntentToAdd=0.60;
input bool   DirectOnlyAddAfterFavorableTravel=true;
input double DirectMinimumFavorableAddProgressR=0.08;
input double DirectIntentRiskMultiplierLow=0.60;
input double DirectIntentRiskMultiplierMedium=1.00;
input double DirectIntentRiskMultiplierHigh=1.75;
input double DirectIntentRiskMultiplierExtreme=3.00;

// CAMPAIGN OBJECTIVE + EXIT INTENT
bool DirectDoubleAccountEveryCampaign=false; // superseded by H620GrowthMilestonePercent
double DirectCampaignGrowthTargetPercent=100.00; // legacy display only
input bool   DirectWaitForFreshPrimaryAfterCampaign=true;
bool DirectCloseCampaignWhenIntentDies=false; // weakness blocks adds, never closes a hold
input double DirectWeakIntentExitThreshold=0.40;
input int    DirectWeakIntentClosedBars=3;

// MARGIN SAFETY FOR DENSE LADDERS
input double DirectMinimumProjectedMarginLevel=150.0;
input double DirectMinimumFreeMarginReservePercent=15.0;

// -------------------------------------------------------------------
// INTERNAL PHYSIOLOGY DEFAULTS
// These values are NOT user inputs in v5.00. Semantic dropdowns above configure them.
string MENU_U0="=== 1. UNITY MASTER ===";
HT_MasterControl MasterControl=MASTER_BUY_AND_SELL;
HT_UnityPace UnityPace=UNITY_PACE_FAST;
HT_UnityEntryLogic UnityEntryLogic=UNITY_ENTRY_BOS_AND_CONFIRMED_FLIPS;
ENUM_TIMEFRAMES SignalTimeframe=PERIOD_M5;

string MENU_U1="=== 2. RISK + BREATHING ROOM ===";
HT_RiskPercent RiskPerTrade=RISK_01_PERCENT;
HT_RiskPercent MaximumCampaignRisk=RISK_06_PERCENT; // Six 1% rapid-fire cars may coexist.
HT_ATRStopMultiplier ATRStopDistance=ATR_SL_3_00_X;
HT_MarginSafetyControl MarginSafetyControl=MARGIN_SAFETY_BALANCED;

string MENU_U2="=== 3. HOT WHEELS PRESSURE + STATIONS ===";
HT_UnityPressure UnityPressure=UNITY_PRESSURE_RAPID_6;
HT_UnityStationMind UnityStationMind=UNITY_STATION_ADAPTIVE;
HT_UnityProfitPlan UnityProfitPlan=UNITY_PROFIT_STATION_PARTIAL_PLUS_GAIN;
double StationPartialPercent=50.0;       // 1..99, bank only this portion at a station.
double CampaignGainTargetPercent=1.00;  // Basket gain target, % of campaign starting balance.
double NextStationExtensionRange=1.00;  // 1.0 = one current swing range to the next station.
double PeakTransitionBufferATR=0.10;    // Hard distance beyond the collected station.
int PeakTransitionConfirmTicks=2;       // Matching opposite/same arrow ticks required.
int MarketDNAPeakObservationMaxBars=2; // Flat Market-DNA peak lock auto-releases after this many signal bars.

string MENU_U2B="=== 3B. COMPOUND STAIRCASE ===";
bool EnableCompoundStaircase=true;
double CompoundTargetPercent=10.0;
double CompoundGuardAtPercent=80.0;
int CompoundUnlockConfirmationTicks=1;
double CompoundSettlementSafetyMoney=0.00;
int CompoundPostCollectionPauseSeconds=3;
bool CompoundAllowNetPositiveRedSettlement=true;
bool CompoundResetAnchorNow=false;
double MicroAccountThreshold=100.0;
int MicroMaximumSimultaneousCars=1;
bool MicroAllowBrokerMinimumLot=true;
double MicroMaximumActualRiskPercent=3.0; // User-selectable up to a hard 5% ceiling.

string MENU_U3="=== 4. PROTECTION ===";
double ProvenAtRoutePercent=50.0;        // Protection cannot tighten before this route progress.
double TrailGivebackPercent=50.0;        // After proven, how much favorable travel may be given back.
bool NeverLetProvenCampaignGoNegative=true;
bool NeverSoftwareCloseNegativeCampaign=true; // Automated agents must leave negative exits to broker SL.
bool DisableArrowReversalExit=true;            // Opposite arrows inform the brain but never liquidate.
bool EmergencyCloseOverridesNegativeHold=true; // Voice CLOSE ALL / EMERGENCY remains authoritative.

string MENU_U4="=== 5. WISDO VOICE CONTROL ===";
input bool EnableWisdoVoiceControl=false; // AUDIT SAFE DEFAULT: external/stale voice globals cannot silently block execution.
bool WisdoUseSymbolSpecificGV=true;
bool WisdoEmergencyClosesCampaign=true;

string MENU_U5="=== 6. VISUALS ===";
HT_VisualControl VisualControl=VISUAL_DIAGNOSTIC;
HT_DashboardFocus DashboardFocus=DASH_FOCUS_AUTO;
bool ShowUnityGauges=true;
bool PyramidShowStructure=true;
bool PyramidPaintSwingLabels=true;
bool PyramidShowILTrainStation=true;
bool PyramidShowReclaimAreas=true;
bool ShowGlobalClock=true;
bool ShowCandleTimer=true;
bool UseDynamicMoodBackground=true;
int ClockRightOffset=18;
int ClockTopOffset=18;
int DashboardX=12;
int DashboardY=18;

string MENU_U6="=== 7. BOT IDENTITY ===";
int MagicNumber=26080204;
string TradeComment="HT_UNITY_SEQ_AUDIT_602";

string MENU_U7="=== 8. WILL DNA + LIVING DASHBOARD ===";
bool EnableWillDNA=true;
double WillLearningRate=0.05;          // EWMA learning speed; 0.01 slow, 0.20 fast.
int WillConfidenceSamples=30;          // Campaigns required before local DNA dominates.
double WillMinimumPositiveEdge=0.05;   // CTU expectancy required for aggressive authority.
bool EnableWillEnergyDrain=true;       // Profitable new energy may retire stale 0.01 loss portions.
double WillDrainCostBufferMoney=0.50;  // Extra net energy required beyond loss + target share.
int WillDrainMinimumAgeSeconds=30;     // Prevent immediate churn of the initial anchor.
bool ShowWillDNADashboard=true;
bool DashboardDockRight=false; // v6.04: primary WILL / MARKET DNA dashboard docks to the LEFT.
int DashboardRightMargin=12;
bool AnimateEVACore=true;
bool AnimateSURFWave=true;
int DNAAnimationSpeed=1;


string MENU_U8="=== 9. MARKET DNA MASTER EQUATION ===";
bool EnableMarketDNA=true;
int MarketDNAMaxCars=20;                    // Absolute simultaneous-market-car ceiling; risk cap remains authoritative.
int MarketDNARapidBurstCars=4;              // Maximum same-event market burst.
bool MarketDNASplitCampaignRiskAcrossCars=true; // Lets 20 cars share one campaign-risk budget instead of each demanding full risk.
double MarketDNAEdgeFloorATR=0.03;           // Minimum net expected ATR displacement before deployment.
double MarketDNAEdgeScaleATR=0.35;           // EGO saturation scale; larger = more selective aggression.
double MarketDNAUncertaintyPenalty=0.70;
double MarketDNAAdversePenalty=0.85;
double MarketDNAExecutionBufferATR=0.01;
double MarketDNAThesisMinimum=0.45;
double MarketDNARecoveryMinimum=0.55;
double MarketDNARecoveryBufferATR=0.08;
double MarketDNACompoundDrive=0.65;           // Scales exposure demand only; never changes market direction prediction.

string MENU_U8A="=== 9A. DIRECTIONAL SPINE DNA ===";
bool EnableMarketDNADirectionalSpine=true;
double MarketDNADirectionFloorATR=0.10;        // Minimum signed core displacement before BUY/SELL authority exists.
double MarketDNADirectionComponentMinATR=0.03; // Minimum core-strand contribution counted as agreement.
int MarketDNADirectionMinAgreement=2;          // At least two core strands must agree.
double MarketDNADirectionMaxOpposingPressureATR=0.08; // Blocks direction if short-burst pressure is materially opposite.
double MarketDNADirectionLaunchPressureATR=0.06;       // Fresh pressure needed for a non-structural seed/burst trigger.
double MarketDNASurfDirectionCap=0.35;         // SURF may change magnitude by this fraction; never primary direction.


string MENU_U8C="=== 9C. HISTORICAL CHANNEL DNA • 20K BAR TREND MAP ===";
bool EnableMarketDNAHistoricalChannels=true;
int MarketDNAChannelLookbackBars=20000;          // Long-memory scan. Uses completed historical bars only.
int MarketDNAChannelLevelBuckets=72;             // Major high/low level buckets sampled across the full lookback.
int MarketDNAChannelMinAnchorSpanBars=80;         // Prevent tiny local lines from masquerading as historical channels.
int MarketDNAChannelMinTouches=3;                 // Preferred rail needs repeated historical respect; 2-touch fallback allowed.
double MarketDNAChannelTouchATR=0.25;             // Distance from a rail counted as a historical touch.
double MarketDNAChannelBreakBufferATR=0.08;       // Wick beyond rail is not a break; acceptance must clear this buffer.
int MarketDNAChannelBreakAcceptanceBars=2;        // Completed closes required beyond rail for true channel BOS.
double MarketDNAChannelBounceProximityATR=0.35;   // LL/HL or HH/LH near projected rail can become a bounce station.
double MarketDNAChannelMinSlopeATRPer100Bars=0.03;// Arrow direction threshold after ATR normalization.
bool MarketDNAChannelVetoCounterBOS=true;         // Rising support blocks SELL BOS until accepted below; falling resistance mirrors it.
bool MarketDNAChannelBounceHardAuthority=true;     // Active rail bounce/approach is a hard side firewall, not a weighted vote.
double MarketDNAChannelCounterEntryBlockATR=0.65; // Begin blocking countertrend entries before price reaches the bounce rail.
double MarketDNAChannelActiveMaxDistanceATR=3.00; // Prefer a repeatedly respected rail projected close enough to be the active channel.
bool MarketDNAChannelCancelOppositePending=true;  // Remove stale opposite pending inventory when an active rail zone takes control.
bool MarketDNAChannelBounceTransfer=true;          // Confirmed bounce + matching RHYTHM may close a profitable opposite campaign and hand off.
bool MarketDNAChannelBounceTransferAllowNegative=false; // OFF by default: do not force-close a red campaign just to reverse.
bool MarketDNAChannelDraw=true;
int MarketDNAChannelProjectBars=12;               // Right-edge visual projection and attached arrow distance.

string MENU_U8D="=== 9D. THREE-WAY CHANNEL • BLACK TRIGGER RAIL ===";
bool EnableMarketDNAThreeWayChannel=true;
bool MarketDNARequireChannelReadyBeforeTrading=false; // Channel initializes immediately but cannot deadlock all entries.
bool MarketDNARequireTriggerRailReadyBeforeTrading=false; // BLACK rail failure must not freeze every other entry engine.
bool MarketDNAAllowDegradedChannelTrading=true;          // If long-memory rails cannot fit after startup, FVG/structure may still operate.
int MarketDNAChannelDegradedAfterAttempts=3;
int MarketDNATriggerRailLookbackBars=360;
int MarketDNATriggerRailMinSpanBars=4;
double MarketDNATriggerRailMinImpulseATR=1.00;
double MarketDNATriggerRailApproachATR=0.22;
double MarketDNATriggerRailTouchATR=0.10;
double MarketDNATriggerRailRejectATR=0.015;
double MarketDNATriggerRailBreakATR=0.045;
int MarketDNATriggerRailBreakTicks=2;
int MarketDNATriggerRailTouchMemoryTicks=32;
int MarketDNATriggerRailBounceHoldTicks=24;
bool MarketDNATriggerRailCloseOpposite=true;
bool MarketDNATriggerRailTransferAllowNegative=true;
bool MarketDNATriggerRailSonicEveryTick=true;
int MarketDNATriggerRailSonicBurstCars=4;
int MarketDNATriggerRailBounceCars=4;

string MENU_U8O="=== 9O. ORACLE FUSION DNA • WYCKOFF + OB/FVG + PROFIT RATCHET ===";
bool EnableMarketDNAOracleFusion=true;
ENUM_TIMEFRAMES MarketDNAOracleMicroTF=PERIOD_M5;
int MarketDNAOracleMicroLookback=55;
int MarketDNAOracleOBLookback=50;
int MarketDNAOracleFVGLookback=80;
double MarketDNAOracleOBFVGNearATR=0.35;
double MarketDNAOracleOriginWeight=0.75;       // OB/FVG/impulse quality improves BLACK-rail origin selection.
double MarketDNAOraclePatternToleranceATR=0.18;// Equal-extreme/harmonic-style exhaustion evidence; reversal bonus only.
double MarketDNAOracleExpansionAddMultiplier=1.20;
double MarketDNAOracleAccumulationAddMultiplier=0.90;
double MarketDNAOracleDistributionAddMultiplier=0.82;
bool MarketDNAOracleUseEquityRatchet=true;
double MarketDNAOracleRatchetStage1Pct=30.0;
double MarketDNAOracleRatchetStage2Pct=50.0;
double MarketDNAOracleRatchetStage3Pct=65.0;
double MarketDNAOracleSecureStage2Pct=30.0;
double MarketDNAOracleSecureStage3Pct=50.0;
bool MarketDNAOracleRedBreakContinuation=true;
double MarketDNAOracleRedBreakBufferATR=0.08;
int MarketDNAOracleRedAcceptanceBars=2;

string MENU_U8R="=== 9R. RHYTHM DNA • LIVE TICK MICROSTRUCTURE ===";
bool EnableMarketDNARhythmDNA=true;
int MarketDNARhythmTickWindow=72;                // Rolling live-tick window; hard capped at 256.
int MarketDNARhythmMinimumTicks=14;               // Minimum observations before RHYTHM may launch capital.
int MarketDNARhythmVelocityTicks=6;               // Short micro-velocity/acceleration window.
double MarketDNARhythmLaunchThreshold=0.20;       // Minimum rhythm required for any new market entry.
double MarketDNARhythmRapidThreshold=0.34;        // Train-leaving threshold for full rapid-fire behavior.
double MarketDNARhythmHistoryWeight=0.25;         // Similar-burst historical expectation contribution.
int MarketDNARhythmHistoryHorizonTicks=18;        // Future ticks used to score a stored rhythm fingerprint.
int MarketDNARhythmHistoryMinSamples=6;           // Similar-history predictor stays neutral until this many samples exist.
double MarketDNARhythmSimilaritySigma=0.80;       // Nearest-rhythm similarity bandwidth.
double MarketDNARhythmPaceEWMAAlpha=0.05;         // Baseline tick-pace adaptation speed.
double MarketDNARhythmDefaultBurstSeconds=25.0;   // Maturity baseline until live burst durations are learned.
double MarketDNARhythmMagnitudeCap=0.65;          // Rhythm may alter expected travel magnitude, never direction.
bool MarketDNARhythmRapidEveryValidTick=true;     // While the train is leaving, each tick may request another burst.
int MarketDNARhythmMinimumBurstCars=4;            // Every valid market-entry attempt tries at least this many cars.
int MarketDNARhythmMaxBurstCarsPerTick=8;         // Execution ceiling per tick; campaign risk/margin still wins.
int MarketDNAILBurstMultiplier=2;                 // IL station doubles requested cars while the train departs.
int MarketDNAILBoostMaxTicks=24;                  // Maximum tick-life of the IL double-fire latch.
bool MarketDNARhythmFullCompoundTargetDrive=true; // Attempt the ENTIRE remaining compound target from each proven launch.
double MarketDNARhythmTargetDriveThreshold=0.24;  // Rhythm needed before full-target exposure demand is activated.

int MarketDNABurstLearningBars=3;             // Prediction horizon is updated every completed SignalTF bar.
double MarketDNALearningRate=0.10;
double MarketDNAMemoryDecay=0.96;
double MarketDNAErrorDecay=0.90;
bool MarketDNAResetLearningNow=false;

string MENU_U8B="=== 9B. INFLECTION + ACCEPTANCE DNA ===";
bool EnableInflectionAcceptanceDNA=true;
int MarketDNAInflectionLookbackBars=10;        // Prior territory used to detect sweeps/failed breaks.
int MarketDNAAcceptanceBars=2;                 // Recent closes required to measure acceptance persistence.
double MarketDNAInflectionSweepMinATR=0.06;    // Minimum excursion beyond prior territory to count as a sweep.
double MarketDNAInflectionRejectionMin=0.30;   // Wick/range rejection needed for a high-quality liquidity sweep.
double MarketDNAAcceptanceBufferATR=0.02;      // Territory buffer before a close is considered accepted outside.
double MarketDNAInflectionSuspendATR=0.10;     // Legacy compatibility only in v3.07; does NOT trim exposure.
double MarketDNAInflectionTransferATR=0.18;    // Inflection displacement required before reversal transfer.
double MarketDNAInflectionAcceptanceATR=0.07;  // Matching acceptance required before reversal transfer.
double MarketDNATrueReversalPressureATR=0.04;  // Opposite short-burst pressure required before transfer.
double MarketDNAInflectionBrakeStrength=2.25;  // Legacy compatibility only; v3.07 reversal DNA never contracts Q*.

string MENU_U9="=== 10. EGO OVERDRIVE + STACK/LIMIT DNA ===";
bool EnableEGOOverdrive=true;
bool MarketDNAAllowNegativeAdds=true;
bool MarketDNAAllowRapidFire=true;
bool MarketDNAAllowLimitStacks=true;
int MarketDNALimitLevels=4;
int MarketDNALimitCarsPerLevel=4;
double MarketDNALimitAEFactor1=0.50;
double MarketDNALimitAEFactor2=1.00;
double MarketDNALimitAEFactor3=1.50;
double MarketDNALimitAEFactor4=2.00;
int MarketDNALimitExpiryMinutes=0;              // 0 = persistent until true campaign invalidation/reset.

string MENU_U8M="=== 9M. PULSE GROW • MAGNETIC LIMIT ZONES ===";
bool MarketDNAPulseGrowLimits=true;
double MarketDNAPulseActivationATR=0.95;          // Magnet begins growing as price enters this distance from the structural anchor.
double MarketDNAPulseMaxAttraction=0.52;          // Maximum fraction the live limit zone may travel from anchor toward market.
double MarketDNAPulseZoneSpreadATR=0.07;          // Cars at one level occupy a small zone instead of one identical quote.
double MarketDNAPulseMinModifyATR=0.025;           // Broker order is modified only after meaningful improvement; visual pulse still updates every tick.
int MarketDNAPulseModifyCooldownTicks=4;           // Prevent broker-side modify spam.
double MarketDNAPulseBrokerGapATR=0.035;           // Keep magnetized order safely on the legal pending side of market.
double MarketDNAPulseCrashBrake=1.25;              // Pullback ratio above this sharply reduces attraction so limits do not chase a collapse.
bool MarketDNAPulseUseOracleConfluence=true;
bool MarketDNAPulseVisualFlicker=true;

string MENU_U8S="=== 9S. SONIC CAGE PLUG BURST ===";
bool MarketDNASonicCagePlug=false;
int MarketDNASonicSeedCars=1;                      // SONIC begins as a normal market entry, not a same-price multi-car dump.
int MarketDNASonicMaxPlugCars=6;                   // Extra cars available to the staggered cage after the seed.
double MarketDNASonicPlugSpacingATR=0.08;          // Stagger spacing around the seed price.
double MarketDNASonicPullbackSpacingFactor=0.75;   // Pullback-side plugs sit slightly tighter than continuation-side plugs.
double MarketDNASonicPlugTouchATR=0.018;           // Node is considered touched/crossed inside this tolerance.
int MarketDNASonicPlugLifeTicks=96;                // Cage expires if the move no longer visits its nodes.
int MarketDNASonicPlugCooldownTicks=2;             // At most one staggered plug inside this many ticks.

string MENU_U8H="=== 9H. DAY HIGH/LOW DNA • EXTREME LOCATION FIREWALL ===";
bool MarketDNADayHLGuard=true;
bool MarketDNADayHLDraw=true;
double MarketDNADayExtremeZoneFraction=0.15;       // Outer 15% of the broker-day range is an extreme zone.
double MarketDNADayExtremeATR=0.35;                // ATR proximity can also activate the high/low zone.
double MarketDNADayTouchATR=0.08;                  // Repeated completed-bar touches counted around the final day extreme.
bool MarketDNADayRequireProvenBreakForCounter=true;// Near LOW blocks ordinary SELL adds; near HIGH blocks ordinary BUY adds.

string MENU_U8F="=== 9F. SIGNAL FVG • FINAL ENTRY GATE ===";
bool MarketDNASignalFVGOnly=true;
int MarketDNASignalFVGExpiryBars=30;               // Queued signal stays alive long enough for a real retrace.
int MarketDNASignalFVGScanBars=80;
int MarketDNASignalFVGAssociationBars=12;           // FVG may form during/after the signal displacement.
double MarketDNASignalFVGMinATR=0.01;              // Ignore only truly microscopic gaps.
double MarketDNASignalFVGToleranceATR=0.08;        // Live touch envelope around the signal FVG.
bool MarketDNASignalFVGRequireRhythm=true;         // Legacy mode; queued mode uses only a hard opposing-rhythm veto.
double MarketDNASignalFVGMinRhythm=0.05;
bool MarketDNASignalFVGQueueAuthority=true;        // Lock an earned signal FVG until fill/invalidation instead of requiring live signal heat.
double MarketDNASignalFVGHardOpposingRhythm=-0.18;// Do not enter queued FVG while tick rhythm is strongly opposite.
double MarketDNASignalFVGInvalidationATR=0.20;     // Far-edge violation invalidates the queued FVG.
int MarketDNASignalFVGSeedCars=1;                  // One seed at the signal FVG; expansion is earned afterward.
bool MarketDNASignalFVGClampPulseLimits=true;      // PULSE limits must sit inside the armed signal FVG.
bool MarketDNASignalFVGUseCrossThroughLatch=true; // A fast tick that crosses the FVG cannot silently miss the entry window.
int MarketDNASignalFVGTouchLatchTicks=8;                  // Preserve a valid touch for a few ticks while execution runs.
bool MarketDNAFVGDirectSeedAuthority=true;      // A touched queued FVG may seed directly without re-passing soft launch/Q* gates.
bool MarketDNAFVGSeedDedicatedPlan=true;         // Queued FVG seed always uses its own FVG-derived stop/1R target.
bool MarketDNAFVGCrossBeforeInvalidation=true;    // A tick segment crossing the FVG earns the touch before far-edge invalidation is evaluated.
bool MarketDNACompoundGuardOnlyWithOpenTrades=true;// A flat account can never remain frozen merely because stored progress is in guard zone.
double MarketDNAFVGSeedMinStopATR=0.20;           // Dedicated FVG seed stop must have at least this ATR breathing room.
double MarketDNAFVGSeedMaxStopATR=3.50;           // Reject pathological FVG stops wider than this ATR multiple.

string MENU_U8L="=== 9L. SONIC R-LADDER • 1R GRID + FORWARD PROTECTION ===";
bool MarketDNASonicRLadder=true;
double MarketDNARLadderTargetR=1.00;               // Seed TP = original SL distance x this R target.
int MarketDNARLadderStages=8;                      // Formula-generated earned grid; hard capped at 12.
double MarketDNARLadderFirstStageR=0.12;
double MarketDNARLadderLastStageR=0.88;
double MarketDNARLadderStageCurve=1.05;             // >1 crowds early levels slightly closer to seed.
double MarketDNARLadderFirstProtectR=-0.35;
double MarketDNARLadderLastProtectR=0.68;
double MarketDNARLadderProtectCurve=0.70;           // Protection accelerates toward locked profit as TP approaches.
int MarketDNARLadderCooldownTicks=2;
bool MarketDNARLadderRequireRhythm=true;
double MarketDNARLadderMinRhythm=0.05;
bool MarketDNARLadderUseSingleRiskBudget=true;      // Whole ladder uses one selected-risk budget, not one full budget per add.

string MENU_U8V="=== 9V. LIVE ATR ENGINE • PROVISIONAL WILDER + TICK PULSE ===";
bool EnableLiveATRExecution=true;                    // Execution logic uses a live current-bar Wilder ATR instead of frozen shift=1 ATR.
bool LiveATRUseCurrentBidInTR=true;                  // Include the newest Bid in current true-range even before series refresh catches up.
double LiveATRTickPulseAlpha=0.18;                   // EWMA only for dashboard/tick-volatility diagnostics; does not fake or inflate ATR.
bool LiveATRStableHistoricalMaps=true;               // 20K rail fitting/day-history counts use completed ATR while live evaluation uses moving ATR.
bool LiveATRStopFloorToStable=true;                    // New protective SL may widen with live ATR but never shrink below completed ATR baseline.

string MENU_U8E="=== 9E. SELF-EVOLVING GENOME • LOSS AUTOPSY + ROLLBACK ===";
bool EnableSelfEvolvingGenome=true;
bool EvolutionPersistGenome=true;
bool EvolutionResetGenomeNow=false;
int EvolutionMinimumCampaignsBeforeMutation=5;
int EvolutionSimilarLossesForMutation=3;
int EvolutionRollbackWindowCampaigns=6;
double EvolutionMutationRate=0.05;
double EvolutionRollbackFitnessDropR=0.35;
double EvolutionFitnessAlpha=0.15;
double EvolutionMinFVGTouchMultiplier=0.65;
double EvolutionMaxFVGTouchMultiplier=1.25;
double EvolutionMaxQueuedRhythmFloor=0.05;
double EvolutionMaxRLadderFirstStageOffsetR=0.14;
double EvolutionMinRLadderRiskScale=0.60;
double EvolutionMaxChannelWeightMultiplier=1.40;
double EvolutionMinPressureWeightMultiplier=0.70;

bool MarketDNAPersistentLimitPlan=true;         // Limits do not churn with tick-by-tick Q* changes.
bool MarketDNARearmFilledLimitLevels=false;     // False = a filled level stays consumed until next campaign plan.
bool MarketDNAHarvestProfitableExcess=false;    // v3.07 default: winning baskets are not trimmed; compound/full exits own collection.
int MarketDNAHarvestCarsPerTick=4;
double MarketDNAFullHarvestLotTolerance=0.005;
bool ShowMarketDNAFormulaValues=true;

// Hidden compatibility values. These are deliberately NOT user inputs.
HT_TradeFrequencyControl TradeFrequencyControl=TRADE_MORE_OFTEN;
HT_SetupControl SetupControl=SETUP_AUTO_ALL;
HT_ArrowEntryControl ArrowEntryControl=ARROW_ENTRY_FIRST_ONLY;
HT_ArrowMinimumSlope ArrowMinimumSlope=ARROW_SLOPE_0_00010;
HT_ArrowConfirmationTicks ArrowConfirmationTicks=ARROW_CONFIRM_2_TICKS;
HT_MaximumArrowEntries MaximumArrowEntries=MAX_ARROW_ENTRIES_6;
HT_ArithmeticSpacingStep ArithmeticEntrySpacing=ARITH_STEP_0_00_R;
HT_GridStopControl GridStopControl=GRID_CONTINUE_AFTER_ADDON_SL;
HT_ArrowReversalExitControl ArrowReversalExit=ARROW_REVERSAL_EXIT_OFF;
HT_ReversalExposureControl ReversalExposureControl=REVERSAL_WAIT_FOR_FLAT;
HT_IchimokuFilter IchimokuTrendFilter=ICHIMOKU_FILTER_OFF;
HT_StartTradingTime StartTradingTime=START_ANY_TIME;
HT_StartTradingMinute StartTradingMinute=START_MINUTE_00;
HT_AccountBasis RiskAccountBasis=RISK_FROM_BALANCE;
HT_RiskValueMode RiskValueMode=RISK_VALUE_CONSERVATIVE_HYBRID;
double RiskCashSafetyFactor=1.00;
HT_TakeProfitRatio TakeProfitRatio=TP_RATIO_OFF;
HT_ExitControl ExitControl=EXIT_MAXIMUM_TREND;
HT_HoldControl TradeHoldControl=HOLD_NO_MINIMUM;
HT_SovereignCloseMode SovereignCloseMode=SOV_CLOSE_NORMAL;
double MinimumNetCloseProfit=0.25;
double GreenLockMinimumProfit=0.25;
double DirectLossExceptionR=0.35;
HT_GravityTrailControl GravityTrailControl=GRAVITY_TRAIL_OFF;
double GravityArmBalancePercent=0.50;
double GravityMinimumArmMoney=10.0;
double GravityMinimumGivebackMoney=5.0;
HT_GravityReleaseCharacter GravityReleaseCharacter=GRAVITY_RELEASE_THREE_BALANCED;
HT_YokeActivationCharacter YokeActivationCharacter=YOKE_ACTIVATE_10_PATIENT;
double YokeLiveReserveRatio=1.25;
bool YokeGateNewRapidFireEntries=false;
HT_YokeRiskDistribution YokeRiskDistribution=YOKE_RISK_EXACT_PER_OX;
HT_BrokerLossPolicy BrokerLossPolicy=BROKER_KEEP_ORIGINAL_SL;
bool ShowSovereignScale=true;
HT_PyramidEntryPermissions PyramidEntryPermissions=ENTRY_BOS_AND_CONFIRMED_REVERSALS;
HT_PyramidConfirmationCharacter PyramidBreakConfirmation=PYR_CONFIRM_2_FAST;
double PyramidBreakBufferATR=0.05;
HT_PyramidConfirmationCharacter BOSCloseConfirmation=PYR_CONFIRM_2_FAST;
double BOSBreakBufferATR=0.03;
HT_PyramidConfirmationCharacter PyramidStationBounceConfirmation=PYR_CONFIRM_2_FAST;
double PyramidStationTouchATR=0.10;
double PyramidStationResetATR=0.35;
double PyramidStationBreakCatchupATR=2.00; // Keep a confirmed break eligible while arrow permission catches up.
double PyramidStationTargetRangeMultiple=1.00;
bool PyramidDirectionalProfitRetest=true;
bool PyramidReclaimAllTargetAreas=true;
HT_PyramidConfirmationCharacter PyramidReclaimConfirmation=PYR_CONFIRM_2_FAST;
HT_PyramidSwingCharacter PyramidSwingCharacter=PYR_SWING_3_FAST_WICK_HUNTER;
HT_PyramidMapMemory PyramidMapMemory=PYR_MAP_160_FULL_SESSION;
HT_PyramidRSICharacter PyramidRSICharacter=PYR_RSI_7_FAST;
double PyramidRSIHigh=68.0;
double PyramidRSILow=32.0;
double PyramidOuterZonePercent=22.0;
double PyramidMinimumWickBodyRatio=0.65;
HT_PyramidConfirmationCharacter PyramidGripCharacter=PYR_CONFIRM_2_FAST;
HT_PyramidConfirmationCharacter PyramidInvalidationCharacter=PYR_CONFIRM_3_BALANCED;
double PyramidInvalidationATRBuffer=0.18;
double PyramidMinimumAdvantageRatio=0.0;
bool PyramidAdaptiveAdvantage=false;
HT_PyramidOutcomeMemory PyramidOutcomeMemory=PYR_MEMORY_40_BALANCED;
bool PyramidRapidFire=true;
HT_PyramidEntryCharacter PyramidEntryCharacter=PYR_ENTRIES_6_RAPID_FIRE;
HT_PyramidEntryRhythm PyramidEntryRhythm=PYR_RHYTHM_3_FAST;
double PyramidAddSpacingATR=0.10;
int PyramidAcceleratorWindowSeconds=45;     // Hot Wheels burst stays armed briefly after a real station/BOS trigger.
double PyramidAcceleratorBurstATR=0.80;     // Cars may join while price is still accelerating away from the station.
double PyramidTrailStepATR=0.08;            // Prevent one-cent-per-tick broker SL modification spam.
double PyramidBreakEvenProgress=0.50;
double PyramidTrailGivebackPercent=50.0;
bool PyramidNeverLetProvenCampaignGoNegative=true;
HT_ProfitGrabMode ProfitGrabMode=PROFIT_STATION_PARTIAL_PLUS_PERCENT;
HT_PartialGrabSize StationPartialGrabSize=PARTIAL_GRAB_50_PERCENT;
HT_PercentageGainTarget CampaignPercentageGainTarget=GAIN_TARGET_1_00_PERCENT;
HT_StationDecisionMode StationDecisionMode=STATION_ADAPTIVE_MULTI_FACTOR;
HT_StationStrengthRequirement StationStrengthRequirement=STATION_STRENGTH_0_20_ATR_BALANCED;
bool UseBlackGoldTheme=true;
bool AnimateGuardian=true;
bool UsePyramidDLSauce=true; // Unity engine is always the single authority.

// Resolved runtime configuration. Presets write these values in OnInit().
bool AllowNewEntries=true,AllowBuy=true,AllowSell=true;
int SlippagePoints=30;
double RiskPerEntryPercent=1.0,MaximumCampaignRiskPercent=5.0,TakeProfitSLRatioValue=2.0;
double gRiskBrokerLossPerLot=0.0,gRiskContractLossPerLot=0.0,gRiskChosenLossPerLot=0.0;
string gRiskValueSource="NONE";
double ArithmeticSpacingStepValue=0.0;
double ArrowMinimumSlopeValue=0.00050;
int ArrowConfirmationTicksValue=3;
int ArrowReversalExitTicksValue=3;
bool StopGridAfterFirstAddonSL=true;
bool UseMarginSafeGrid=true,WaitForFlatOnArrowReversal=true;
int SafeMaximumEntries=3;
double MinimumProjectedMarginLevel=500.0;
double MinimumFreeMarginReservePercent=35.0;
HT_EarlyEntryControl EarlyEntryControl=EARLY_ENTRY_ZERO_DEGREE_BREAK; // Legacy setup mode only.
HT_ScaleInControl ScaleInControl=SCALE_IN_OFF;                       // Arrow mode bypasses legacy adds.
ENUM_TIMEFRAMES SignalTF=PERIOD_M5;
int StopATRPeriodValue=14;
double StopATRMultiplierValue=3.0,FixedStopDistancePointsValue=500.0;
double StructureStopBufferPointsValue=30.0,MinimumStopDistancePointsValue=100.0;

double AddRiskFraction=0.50;
int MaximumOpenTrades=6,MaximumAddsPerCampaign=5,MinimumSecondsBetweenAdds=45;
double MinimumAddSpacingPoints=120.0;
bool RequireNewestTradeWinning=true;

// Sovereign runtime memory.
double gSovPeakPull=0.0;
double gSovGravityFloor=0.0;
bool   gSovGravityArmed=false;
string gSovScaleState="BALANCED";
string gSovYokeState="UNYOKED";
string gSovGravityState="GROUND";
string gSovLastAction="READY";
int    gSovLastReleased=0;

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
// Black Gold visual palette. The sell cloud is smoky black so it remains visible on the black chart.
color HTGold=C'212,175,55';
color HTGoldBright=C'255,215,90';
color HTGoldDark=C'92,72,15';
color HTBlack=C'0,0,0';
color HTPanel=C'10,10,10';
color HTPanelSoft=C'18,18,18';
color HTCharcoal=C'34,34,34';
color HTCharcoalLight=C'78,78,78';
color HTText=C'238,238,238';
color HTMuted=C'150,150,150';
color HTAlert=C'210,55,45';
color HTSafe=C'210,180,70';

color TriangleColor=C'212,175,55',WeightLineColor=C'255,215,90';
color IchimokuBullCloudColor=C'92,72,15',IchimokuBearCloudColor=C'30,30,30';
color IchimokuSpanAColor=C'255,215,90',IchimokuSpanBColor=C'82,82,82';
int TriangleWidth=2,WeightLineWidth=4,EntryDiagnosticSeconds=10;

// Guardian UI state. Evolution persists per account/symbol/magic number.
int gUIFrame=0;
int gGuardianEvolution=1;
double gGuardianStartBalance=0.0;

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
datetime gLastArrowFlipTime=0;
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

// Pyramid DL Sauce state. Pivots use completed candles only and never move after confirmation.
double gPyrHigh1=0.0,gPyrHigh2=0.0,gPyrLow1=0.0,gPyrLow2=0.0;
datetime gPyrHighTime1=0,gPyrHighTime2=0,gPyrLowTime1=0,gPyrLowTime2=0;
string gPyrHighClass="--",gPyrLowClass="--",gPyrLeg="SEARCH";
string gPyrStructureSignalName="NONE";
double gPyrStretch=0.50,gPyrRSI=50.0,gPyrWickRatio=0.0,gPyrStrength=0.0;
int gPyrRawSignal=DIR_FLAT,gPyrGripDirection=DIR_FLAT,gPyrGripTicks=0;
int gPyrInvalidTicks=0,gPyrCampaignDirection=DIR_FLAT;
double gPyrTarget=0.0,gPyrInvalidation=0.0,gPyrEntryAnchor=0.0,gPyrBestPrice=0.0;
double gPyrProjectedAdvantage=0.0,gPyrRequiredAdvantage=2.0;
datetime gPyrLastEntryTime=0,gPyrLastMapBar=0;
bool gPyrCampaignProven=false,gPyrDestinationReached=false;
string gPyrState="SEARCHING SWING MAP",gPyrLastAction="READY";
bool gPyrPendingPlan=false;
double gPyrPendingStop=0.0,gPyrPendingTarget=0.0;
int gPyrBreakCandidate=DIR_FLAT,gPyrBreakTicks=0,gPyrBreakDirection=DIR_FLAT;
double gPyrBreakLevel=0.0;
datetime gPyrBreakIdentity=0,gPyrLastUsedBreakIdentity=0;
PyrSignalSource gPyrSignalSource=PYR_SOURCE_NONE;
bool gPyrBuyStationArmed=false,gPyrSellStationArmed=false;
bool gPyrBuyStationReady=true,gPyrSellStationReady=true;
double gPyrBuyStation=0.0,gPyrSellStation=0.0;
datetime gPyrBuyStationIdentity=0,gPyrSellStationIdentity=0;
int gPyrStationCandidate=DIR_FLAT,gPyrStationTicks=0;
int gPyrRetestDirection=DIR_FLAT,gPyrRetestCandidate=DIR_FLAT,gPyrRetestTicks=0;
double gPyrRetestStation=0.0;
bool gPyrRetestReady=false;
int gPyrTrendDirection=DIR_FLAT;
int gPyrBOSCandidate=DIR_FLAT,gPyrBOSTicks=0;
datetime gPyrBOSIdentity=0,gPyrLastUsedBOSIdentity=0;
datetime gPyrActiveSignalIdentity=0;
bool gPyrBullFlipArmed=false,gPyrBearFlipArmed=false;
double gPyrBullFlipTrigger=0.0,gPyrBearFlipTrigger=0.0;
datetime gPyrBullFlipIdentity=0,gPyrBearFlipIdentity=0;
bool gPyrPercentGrabDone=false;
double gPyrCampaignStartBalance=0.0;
HT_CompoundPhase gCompoundPhase=CMP_BUILDING;
double gCompoundAnchor=0.0,gCompoundTarget=0.0,gCompoundProgress=0.0;
double gCompoundLastCollected=0.0,gCompoundPreCloseValue=0.0;
double gCompoundBaseGoalMoney=0.0;
double gCompoundRequiredMoney=0.0,gCompoundLiveRemaining=0.0,gCompoundRequiredPercent=0.0;
int gCompoundCycle=1,gCompoundUnlockTicks=0,gCompoundCloseAttempts=0;
datetime gCompoundLastCollectionTime=0;
bool gCompoundTargetLatched=false,gCompoundEntryFreeze=false;
string gCompoundState="INITIALIZING",gCompoundReceipt="NONE",gMicroRiskReceipt="NORMAL SIZING";
// WILL DNA is persistent, normalized in Compound Target Units (CTU), and account-size independent.
double gWillCampaigns=0.0,gWillWins=0.0,gWillTargets=0.0,gWillLifetimeCTU=0.0;
double gWillAvgWinCTU=1.0,gWillAvgLossCTU=1.0,gWillEdge=0.0,gWillConfidence=0.0;
double gWillScoreEWMA=0.0,gWillTimeEWMA=0.0,gWillDDEWMA=0.0,gWillCostEWMA=0.0;
double gWillPulseATREWMA=0.35,gWillCampaignPeakEquity=0.0,gWillCampaignMinEquity=0.0;
double gWillCampaignMaxDD=0.0,gWillCampaignStartBalance=0.0;
int gWillCampaignMaxEntries=0,gWillConsecutiveTargets=0,gWillBestStreak=0;
datetime gWillCampaignStartTime=0,gWillFastestTarget=0,gWillLastLearnTime=0;
datetime gWillLastDrainTime=0;
string gWillState="AWAKENING",gWillLastLesson="NO CAMPAIGNS YET";


// MARKET DNA v3.16 PULSE GROW --------------------------------------
#define MD_BASE_FEATURES 14
// Core market strands plus Historical Channel DNA describe direction. Inflection
// and Acceptance remain reversal-transfer only. RHYTHM controls live timing.
double gMDFeature[MD_BASE_FEATURES];
double gMDPrevFeature[MD_BASE_FEATURES];
double gMDWeight[MD_BASE_FEATURES];
double gMDStructureATR=0.0,gMDBOSATR=0.0,gMDPressureATR=0.0,gMDWickATR=0.0;
double gMDArrowATR=0.0,gMDStationATR=0.0,gMDReclaimATR=0.0,gMDRouteATR=0.0,gMDWillATR=0.0;
double gMDInflectionATR=0.0,gMDAcceptanceATR=0.0;
double gMDSweepDepthATR=0.0,gMDReclaimDepthATR=0.0,gMDAcceptancePersistence=0.0;
double gMDInflectionBrake=1.0,gMDReversalTransferEdgeATR=0.0,gMDTransferSeedATR=0.0;
double gMDDirectionalSpineATR=0.0,gMDDirectionalLaunchATR=0.0;
int gMDDirectionalDirection=DIR_FLAT,gMDDirectionalAgreement=0;
string gMDDirectionalState="NO SPINE";


// HISTORICAL CHANNEL DNA v3.10 -------------------------------------------------
#define MD_CHANNEL_MAX_LEVELS 96
double gMDChannelLowPrice[MD_CHANNEL_MAX_LEVELS],gMDChannelHighPrice[MD_CHANNEL_MAX_LEVELS];
int gMDChannelLowShift[MD_CHANNEL_MAX_LEVELS],gMDChannelHighShift[MD_CHANNEL_MAX_LEVELS];
int gMDChannelLowCount=0,gMDChannelHighCount=0;
double gMDChannelSupportSlope=0.0,gMDChannelSupportIntercept=0.0,gMDChannelSupportNow=0.0;
double gMDChannelResistanceSlope=0.0,gMDChannelResistanceIntercept=0.0,gMDChannelResistanceNow=0.0;
double gMDChannelSupportSlopeATR100=0.0,gMDChannelResistanceSlopeATR100=0.0;
double gMDChannelSupportScore=0.0,gMDChannelResistanceScore=0.0,gMDChannelATR=0.0;
int gMDChannelLastEvalSerial=-1; // v3.16: one coherent channel/live-volatility evaluation per market tick.
int gMDChannelSupportTouches=0,gMDChannelResistanceTouches=0;
int gMDChannelHistoricalLowMatches=0,gMDChannelHistoricalHighMatches=0;
int gMDChannelSupportOldShift=0,gMDChannelSupportNewShift=0,gMDChannelResistanceOldShift=0,gMDChannelResistanceNewShift=0;
bool gMDChannelSupportValid=false,gMDChannelResistanceValid=false;
bool gMDChannelSupportBreakAccepted=false,gMDChannelResistanceBreakAccepted=false;
int gMDChannelSupportArrow=DIR_FLAT,gMDChannelResistanceArrow=DIR_FLAT;
int gMDChannelDirection=DIR_FLAT,gMDChannelBounceDirection=DIR_FLAT,gMDChannelBreakDirection=DIR_FLAT;
int gMDChannelZoneDirection=DIR_FLAT;
bool gMDChannelCompressionZone=false;
double gMDChannelSupportDistanceATR=999.0,gMDChannelResistanceDistanceATR=999.0;
datetime gMDChannelLastMapBar=0,gMDChannelBreakIdentity=0,gMDChannelLastUsedBreakIdentity=0;
string gMDChannelState="CHANNEL MAP INITIALIZING";

bool gMDChannelReady=false;
int gMDChannelBootstrapAttempts=0;
bool gMDTriggerRailValid=false,gMDTriggerRailTouched=false;
double gMDTriggerRailSlope=0.0,gMDTriggerRailIntercept=0.0,gMDTriggerRailNow=0.0;
double gMDTriggerRailOriginPrice=0.0,gMDTriggerRailPeakPrice=0.0,gMDTriggerRailDistanceATR=999.0;
int gMDTriggerRailOriginShift=0,gMDTriggerRailPeakShift=0,gMDTriggerRailTrendDirection=DIR_FLAT;
int gMDTriggerRailBounceDirection=DIR_FLAT,gMDTriggerRailBreakDirection=DIR_FLAT,gMDTriggerRailApproachDirection=DIR_FLAT;
int gMDTriggerRailBreakTicksSeen=0,gMDTriggerRailTouchSerial=0,gMDTriggerRailBounceExpiresSerial=0;
datetime gMDTriggerRailIdentity=0;
string gMDTriggerRailState="TRIGGER RAIL INITIALIZING";

// ORACLE FUSION DNA v3.10 ------------------------------------------------------
HT_OraclePhase gMDOraclePhase=ORACLE_ACCUMULATION;
double gMDOracleMicroTrendATR=0.0,gMDOracleOBFVGATR=0.0,gMDOraclePhaseATR=0.0,gMDOraclePatternATR=0.0;
double gMDOracleBuyOBFVG=0.0,gMDOracleSellOBFVG=0.0,gMDOracleOriginConfluence=0.0;
double gMDOracleBuyOBTop=0.0,gMDOracleBuyOBBot=0.0,gMDOracleBuyFVGTop=0.0,gMDOracleBuyFVGBot=0.0;
double gMDOracleSellOBTop=0.0,gMDOracleSellOBBot=0.0,gMDOracleSellFVGTop=0.0,gMDOracleSellFVGBot=0.0;
double gMDOracleDeploymentMultiplier=1.0,gMDOraclePeakBasketProfit=0.0,gMDOracleLockedMoney=0.0;
int gMDOracleRatchetStage=0,gMDOracleRedContinuationDirection=DIR_FLAT;
datetime gMDOracleLastBar=0;
string gMDOracleState="ORACLE AWAKENING",gMDOracleRedState="RED PEAK WATCH";

// RHYTHM DNA v3.10: live tick microstructure memory. The Directional Spine owns
// BUY/SELL. RHYTHM owns pace, launch timing, rapid-fire intensity and target demand.
#define MD_RHYTHM_MAX_TICKS 256
#define MD_RHYTHM_MAX_HISTORY 64
double gMDRTickPrice[MD_RHYTHM_MAX_TICKS];
double gMDRTickMs[MD_RHYTHM_MAX_TICKS];
int gMDRTickHead=0,gMDRTickCount=0,gMDRTickSerial=0;
double gMDRhythmFlow=0.0,gMDRhythmTickBias=0.0,gMDRhythmVelocity=0.0,gMDRhythmAcceleration=0.0;
double gMDRhythmPullback=1.0,gMDRhythmEfficiency=0.0,gMDRhythmPace=0.0,gMDRhythmCadence=0.0;
double gMDRhythmMaturity=0.0,gMDRhythmForce=0.0,gMDRhythmHistoricalATR=0.0,gMDRhythmScore=0.0;
double gMDRhythmPaceEWMA=0.0,gMDRhythmExpectedBurstSeconds=25.0,gMDRhythmBurstAgeSeconds=0.0;
double gMDRhythmTargetDemandLots=0.0;
int gMDRhythmTicksUsed=0,gMDRhythmBurstDirection=DIR_FLAT,gMDRhythmHistoryCount=0,gMDRhythmHistoryHead=0;
datetime gMDRhythmBurstStartTime=0;
string gMDRhythmState="LISTENING FOR TICKS";
int gMDRhythmILBoostDirection=DIR_FLAT,gMDRhythmILBoostStartSerial=0,gMDRhythmLastCompoundCycle=0;

// Completed rhythm fingerprints. All directional features are stored from the
// perspective of the spine that existed when the sample was created.
double gMDRHistFlow[MD_RHYTHM_MAX_HISTORY],gMDRHistBias[MD_RHYTHM_MAX_HISTORY];
double gMDRHistVelocity[MD_RHYTHM_MAX_HISTORY],gMDRHistAccel[MD_RHYTHM_MAX_HISTORY];
double gMDRHistPullbackQ[MD_RHYTHM_MAX_HISTORY],gMDRHistEfficiency[MD_RHYTHM_MAX_HISTORY];
double gMDRHistPace[MD_RHYTHM_MAX_HISTORY],gMDRHistCadence[MD_RHYTHM_MAX_HISTORY];
double gMDRHistMaturity[MD_RHYTHM_MAX_HISTORY],gMDRHistOutcomeATR[MD_RHYTHM_MAX_HISTORY];
bool gMDRPendingHistory=false;
int gMDRPendingSerial=0,gMDRPendingDirection=DIR_FLAT;
double gMDRPendingPrice=0.0,gMDRPendingATR=0.0;
double gMDRPendingFlow=0.0,gMDRPendingBias=0.0,gMDRPendingVelocity=0.0,gMDRPendingAccel=0.0;
double gMDRPendingPullbackQ=0.0,gMDRPendingEfficiency=0.0,gMDRPendingPace=0.0,gMDRPendingCadence=0.0,gMDRPendingMaturity=0.0;
double gMDAnalyticATR=0.0,gMDSurfATR=0.0,gMDExpectedATR=0.0;
double gMDErrorVariance=0.0625,gMDExpectedAdverseATR=0.35,gMDExecutionCostATR=0.0;
// Shared prediction uncertainty in ATR units. Legacy Market DNA, deep memory,
// organism brain, growth spacing and diagnostics all read the same state.
double gMDUncertaintyATR=0.25;
double gMDThesisValidity=0.0,gMDExploitableEdgeATR=0.0,gMDFavorablePush=0.0;
double gMDRecoveryGapMoney=0.0,gMDRecoveryRequiredATR=0.0,gMDRecoveryFeasibility=0.0;
double gMDEGO=0.0,gMDDesiredLots=0.0,gMDCurrentSignedLots=0.0,gMDExposureDeltaLots=0.0;
double gMDRapidFireDemandLots=0.0,gMDStackDemandLots=0.0,gMDExpectedFutureMoney=0.0,gMDExpectedGivebackMoney=0.0;
double gMDBaseCarLot=0.0,gMDSafeLotCeiling=0.0,gMDLastBasketProfit=0.0;
int gMDDesiredDirection=DIR_FLAT,gMDDesiredCars=0,gMDRapidBurstCars=0,gMDInflectionDirection=DIR_FLAT;
int gMDTransferHandoffDirection=DIR_FLAT;
datetime gMDTransferHandoffTime=0;
bool gMDNegativeAddAllowed=false,gMDBurstOverride=false,gMDReversalReady=false;
// Runtime phenotype derived from the Day High/Low dropdown. This is not a
// user-facing raw input: HARD/ADAPTIVE day-extreme modes stop fresh growth
// into an unproven extreme until channel/BLACK continuation is accepted.
bool StopAddingNearUnprovenDayExtreme=true;
bool gMDInflectionSuspendAdds=false,gMDInflectionTransferReady=false;
int gMDLimitPlanDirection=DIR_FLAT,gMDLimitPlanCycle=0;
int gMDLimitPlannedCars[4];
// v3.16 PULSE GROW: the structural limit anchor stays stable while the magnetic
// execution zone breathes toward live price. Broker modifications are throttled.
double gMDPulseAnchorPrice[4],gMDPulseCenterPrice[4],gMDPulseStrength[4];
int gMDPulseLastModifySerial[4];
string gMDPulseState="PULSE GROW LISTENING";

#define MD_SONIC_MAX_PLUGS 8
bool gMDSonicPlugActive=false;
int gMDSonicPlugDirection=DIR_FLAT,gMDSonicPlugUsedMask=0,gMDSonicPlugStartSerial=0,gMDSonicPlugLastFireSerial=0,gMDSonicPlugCycle=0;
double gMDSonicPlugAnchorPrice=0.0,gMDSonicPlugLastPrice=0.0;
string gMDSonicPlugState="SONIC CAGE IDLE";

// v3.16 DAY HIGH/LOW DNA -------------------------------------------------------
datetime gMDDayStart=0,gMDDayHighTouchBar=0,gMDDayLowTouchBar=0;
double gMDDayHigh=0.0,gMDDayLow=0.0,gMDDayRangePosition=0.50;
int gMDDayHighTouches=0,gMDDayLowTouches=0;
bool gMDDayNearHigh=false,gMDDayNearLow=false;
string gMDDayHLState="DAY RANGE INITIALIZING";

// v3.16 SIGNAL-FVG state. Signal owns direction; this FVG owns execution location.
bool gMDFVGArmed=false,gMDFVGReady=false,gMDFVGInZone=false,gMDFVGSeedUsed=false;
int gMDFVGDirection=DIR_FLAT;
PyrSignalSource gMDFVGSource=PYR_SOURCE_NONE;
datetime gMDFVGSignalTime=0,gMDFVGZoneTime=0;
double gMDFVGTop=0.0,gMDFVGBot=0.0;
string gMDFVGState="SIGNAL FVG IDLE";
bool gMDPendingPlacementContext=false;
double gMDFVGLastMid=0.0;
int gMDFVGTouchLatchUntilSerial=0;
int gMDEntryTickSerial=0; // increments every OnTick even if RHYTHM DNA is disabled.
int gMDFVGLastDirectSeedAttemptSerial=-1;
string gMDFVGDirectSeedState="DIRECT FVG SEED IDLE";
bool gMDFVGSeedOrderContext=false;

// v3.17 SONIC R-LADDER ---------------------------------------------------------
bool gMDRLadderActive=false,gMDRLadderEntryOverrideActive=false;
int gMDRLadderDirection=DIR_FLAT,gMDRLadderStageReached=0,gMDRLadderStageFilledMask=0;
int gMDRLadderLastFireSerial=0,gMDRLadderCycle=0;
double gMDRLadderSeedEntry=0.0,gMDRLadderOriginalStop=0.0,gMDRLadderR=0.0,gMDRLadderTarget=0.0;
double gMDRLadderRiskBudgetMoney=0.0,gMDRLadderEntryStop=0.0,gMDRLadderEntryTarget=0.0,gMDRLadderEntryRiskFraction=0.0;
string gMDRLadderState="R-LADDER IDLE";

// v3.16 LIVE ATR ENGINE ---------------------------------------------------------
double gATRStable14=0.0,gATRLive14=0.0,gATRPrevLive14=0.0,gATRDelta14=0.0,gATRCurrentTR14=0.0;
double gATRStableStop=0.0,gATRLiveStop=0.0,gATRTickPulseEWMA=0.0,gATRLastMid=0.0;
int gATRLastTickMs=0;
string gATRLiveState="LIVE ATR INITIALIZING";

// v3.16 SELF-EVOLVING GENOME ----------------------------------------------------
int gEvoGenome=1,gEvoCampaigns=0,gEvoWins=0,gEvoLosses=0;
int gEvoDirectionLosses=0,gEvoLocationLosses=0,gEvoTimingLosses=0,gEvoExposureLosses=0;
int gEvoCampaignsSincePromotion=0,gEvoLastError=EVO_ERROR_NONE;
double gEvoFitnessR=0.0,gEvoPromotionFitnessR=0.0;
double gEvoFVGTouchMult=1.0,gEvoQueuedRhythmFloor=-0.18;
double gEvoRLadderFirstOffsetR=0.0,gEvoRLadderRiskScale=1.0;
double gEvoStructWeightMult=1.0,gEvoBOSWeightMult=1.0,gEvoPressureWeightMult=1.0,gEvoRouteWeightMult=1.0,gEvoChannelWeightMult=1.0;
double gEvoPrevFVGTouchMult=1.0,gEvoPrevQueuedRhythmFloor=-0.18;
double gEvoPrevRLadderFirstOffsetR=0.0,gEvoPrevRLadderRiskScale=1.0;
double gEvoPrevStructWeightMult=1.0,gEvoPrevBOSWeightMult=1.0,gEvoPrevPressureWeightMult=1.0,gEvoPrevRouteWeightMult=1.0,gEvoPrevChannelWeightMult=1.0;
bool gEvoCampaignActive=false,gEvoRollbackAvailable=false;
datetime gEvoCampaignStartTime=0;
int gEvoCampaignDirection=DIR_FLAT,gEvoPeakCars=0;
double gEvoCampaignEntry=0.0,gEvoCampaignStop=0.0,gEvoCampaignTarget=0.0,gEvoCampaignRiskMoney=0.0;
double gEvoEntryRhythm=0.0,gEvoEntryChannel=0.0,gEvoEntrySpine=0.0,gEvoEntryPressure=0.0,gEvoEntryDayPos=0.5,gEvoEntryFVGDepth=0.5;
double gEvoMaxFavorableR=0.0,gEvoMaxAdverseR=0.0;
string gEvoState="GENOME 1 • OBSERVING",gEvoLastAutopsy="NONE";
string gMDInflectionState="NORMAL",gMDAcceptanceState="NEUTRAL";
string gMDAction="HUNT",gMDReason="AWAITING MARKET DNA",gMDDeployBlockReason="NONE";
datetime gMDLastLearnBar=0,gMDLastProfitVelocityTime=0,gMDPrevPredictionTime=0;
double gMDPrevPredictionATR=0.0,gMDPrevPredictionBasePrice=0.0,gMDPrevPredictionATRSize=0.0;
int gMDPrevPredictionDirection=DIR_FLAT;
color gLastMoodBackground=clrNONE;
int gPyrStationGrabCount=0;
string gPyrStationDecision="WAITING FOR STATION";
int gResolvedDashboardFocus=DASH_FOCUS_AUTO,gLastDashboardFocus=-1;
double gPyrReclaimLevel[4];
double gPyrReclaimPreviousLevel[4];
bool gPyrReclaimBuyArmed[4],gPyrReclaimSellArmed[4];
bool gPyrReclaimBuyReady[4],gPyrReclaimSellReady[4];
int gPyrReclaimCandidateDirection=DIR_FLAT,gPyrReclaimCandidateIndex=-1,gPyrReclaimTicks=0;
int gPyrActiveReclaimIndex=-1;
double gPyrActiveReclaimLevel=0.0;
string gPyrActiveReclaimName="NONE";

// Persistent MARKET ROUTE memory. Open tickets may go flat while this route remains alive.
// A BUY route survives profitable stop-outs/partials until its supporting HL is actually lost;
// a SELL route survives until its supporting LH is actually broken.
bool gPyrRouteActive=false;
int gPyrRouteDirection=DIR_FLAT;
double gPyrRouteInvalidation=0.0;
double gPyrRouteLastStation=0.0;
datetime gPyrRouteStationIdentity=0;
int gPyrRouteStationIndex=0;
datetime gPyrRouteStartTime=0;
int gPyrRouteInvalidTicks=0;
int gPyrLastInvalidatedRouteDirection=DIR_FLAT;
datetime gPyrRouteInvalidatedTime=0;

// Post-collection transition memory. A collected peak is neutral territory:
// the old direction cannot reload until continuation proves itself.
bool gPyrPeakObservationActive=false;
int gPyrPeakDirection=DIR_FLAT;
double gPyrCollectedStation=0.0;
double gPyrCollectedPeak=0.0;
datetime gPyrPeakObservationStarted=0;
int gPyrTransitionCandidate=DIR_FLAT;
int gPyrTransitionTicks=0;
string gPyrTransitionState="ROUTE FREE";

// Live station accelerator memory.
bool gPyrRouteStationDeparted=false;
bool gPyrRouteStationReady=true;
int gPyrRouteStationCandidate=DIR_FLAT;
int gPyrRouteStationTicks=0;
double gPyrRouteStationProbePrice=0.0;

// A banked station must first move away before the same station may refill.
int gPyrLastBankDirection=DIR_FLAT;
double gPyrLastBankStation=0.0;
bool gPyrBankedStationDeparted=true;

// Hot Wheels burst: a real BOS/station/reclaim launches a short rapid-fire window.
int gPyrBurstDirection=DIR_FLAT;
PyrSignalSource gPyrBurstSource=PYR_SOURCE_NONE;
double gPyrBurstOrigin=0.0;
double gPyrBurstATR=0.0;
datetime gPyrBurstExpires=0;


// Unity/WISDO runtime state. Voice changes these runtime values, never raw OrderSend.
bool gWisdoPaused=false;
bool gWisdoEmergencyLatched=false;
int  gWisdoDirectionMode=0; // 0=AUTO, 1=BUY ONLY, 2=SELL ONLY, 3=MANAGE ONLY
double gUnityStationPartialPercent=50.0;
double gUnityGainTargetPercent=1.0;
int gUnityStationMode=0;
int gUnityMaxEntries=6;
int gUnityConfirmTicks=2; // shared arrow + live BOS train-head confirmation
string gWisdoLastAction="VOICE READY";
double gWisdoLastCommandId=-1.0;
datetime gWisdoLastPoll=0;

//---------------------------------------------------------


//===============================================================================
// LIVING ORGANISM v5.00 -- ORGAN ENUMS / STRUCTURES / GLOBAL PHYSIOLOGY
//===============================================================================
enum HT5_OrganId
{
   ORGAN_CHRONOS=0,
   ORGAN_LUNGS=1,
   ORGAN_HEART=2,
   ORGAN_SKELETON=3,
   ORGAN_EYES=4,
   ORGAN_ORACLE=5,
   ORGAN_BRAIN=6,
   ORGAN_HANDS=7,
   ORGAN_MUSCLES=8,
   ORGAN_IMMUNE=9,
   ORGAN_METABOLISM=10,
   ORGAN_MEMORY=11,
   ORGAN_GENOME=12,
   ORGAN_HOSPITAL=13,
   ORGAN_COMMANDER=14,
   ORGAN_SEQUENCE=15,
   ORGAN_COUNT=16
};

enum HT5_PhysiologyPhase
{
   BODY_COMPRESSION=0,
   BODY_ACCUMULATION=1,
   BODY_EXPANSION=2,
   BODY_DISTRIBUTION=3,
   BODY_EXHAUSTION=4,
   BODY_REVERSAL=5
};

enum HT5_LiquiditySession
{
   LIQUIDITY_ASIA=0,
   LIQUIDITY_LONDON=1,
   LIQUIDITY_NEWYORK=2,
   LIQUIDITY_LONDON_NEWYORK_OVERLAP=3,
   LIQUIDITY_ROLLOVER=4,
   LIQUIDITY_OTHER=5
};

enum HT5_GateKind
{
   GATE_NONE=0,
   GATE_MASTER=1,
   GATE_TIME=2,
   GATE_CHANNEL=3,
   GATE_DAY_EXTREME=4,
   GATE_FVG=5,
   GATE_DIRECTION=6,
   GATE_RHYTHM=7,
   GATE_EDGE=8,
   GATE_THESIS=9,
   GATE_RISK=10,
   GATE_MARGIN=11,
   GATE_BROKER=12,
   GATE_COMPOUND=13,
   GATE_RLADDER=14,
   GATE_SEQUENCE=15,
   GATE_PHASE=16,
   GATE_COUNT=17
};

struct HT5_TimeframeSensor
{
   int tf;
   double atrLive;
   double atrStable;
   double rangeATR;
   double velocityATR;
   double accelerationATR;
   double efficiency;
   double compression;
   double expansion;
   double emaSlopeATR;
   double locationInRange;
   double volumeRatio;
   int direction;
   datetime barTime;
};

struct HT5_LocationField
{
   double dayLowField;
   double dayHighField;
   double channelSupportField;
   double channelResistanceField;
   double blackRailField;
   double redRailField;
   double goldRailField;
   double fvgField;
   double obField;
   double stationField;
   double reclaimField;
   double liquidityPoolField;
   double netDirectionalField;
   string state;
};

struct HT5_CompoundForecast
{
   double base;
   double target;
   double remainingMoney;
   double remainingPercent;
   double projectedBasketAt1R;
   double projectedBasketAtRed;
   double requiredRMultiple;
   double capitalEfficiency;
   double riskUtilization;
   int desiredCars;
   string state;
};

struct HT5_ImmuneState
{
   double selectedRisk;
   double campaignRiskCap;
   double openRisk;
   double pendingRisk;
   double lockedProfit;
   double marginUsedPct;
   double freeRiskMoney;
   double adverseExcursionR;
   double favorableExcursionR;
   bool newRiskAllowed;
   bool emergency;
   string state;
};

struct HT5_BrainState
{
   double structuralPotential;
   double channelPotential;
   double flowPotential;
   double locationPotential;
   double oraclePotential;
   double memoryPotential;
   double uncertainty;
   double expectedATR;
   double adverseATR;
   double continuationProbability;
   double reversalProbability;
   int direction;
   int agreement;
   string state;
};

struct HT5_PatternRecord
{
   bool used;
   datetime when;
   int direction;
   int source;
   double outcomeR;
   double mfeR;
   double maeR;
   int maxCars;
};

struct HT5_ShadowGenome
{
   double rhythmFloor;
   double fvgToleranceMult;
   double sonicStageOffset;
   double riskReuse;
   double channelAuthority;
   double directionFloor;
   double fitnessR;
   int samples;
   string name;
};

HT5_TimeframeSensor gHT5TF[5];
HT5_LocationField gHT5Location;
HT5_CompoundForecast gHT5Metabolism;
HT5_ImmuneState gHT5Immune;
HT5_BrainState gHT5Brain;
HT5_PatternRecord gHT5Patterns[256];
double gHT5PatternFeature[256][32];
HT5_ShadowGenome gHT5Shadow[7];

double gHT5OrganHealth[ORGAN_COUNT];
string gHT5OrganState[ORGAN_COUNT];
int gHT5OrganPulse[ORGAN_COUNT];
int gHT5GateBlocks[GATE_COUNT];
int gHT5GateConsecutive[GATE_COUNT];
datetime gHT5GateLastTime[GATE_COUNT];
string gHT5LastHardBlock="NONE";
string gHT5LastSoftBlock="NONE";
string gHT5HospitalState="HOSPITAL AWAKENING";
string gHT5LifeState="CREATURE AWAKENING";
string gHT5NervousState="NERVES INITIALIZING";
string gHT5MuscleState="MUSCLES READY";
string gHT5MetabolicState="METABOLISM INITIALIZING";
string gHT5MemoryState="MEMORY EMPTY";
string gHT5SessionState="SESSION UNKNOWN";
string gHT5PhaseState="PHASE UNKNOWN";
string gHT5ProtectionState="PROTECTION READY";
string gHT5CompoundForecastState="FORECAST INITIALIZING";
int gHT5Session=LIQUIDITY_OTHER;
int gHT5BodyPhase=BODY_COMPRESSION;
int gHT5PatternHead=0;
int gHT5PatternCount=0;
int gHT5CreatureAgeTicks=0;
int gHT5CreatureAgeBars=0;
int gHT5LastTickSerial=-1;
datetime gHT5LastSignalBar=0;
double gHT5Heartbeat=0.0;
double gHT5FlowEntropy=0.0;
double gHT5TickJerkATR=0.0;
double gHT5VolOfVol=0.0;
double gHT5VolatilityPressure=0.0;
double gHT5SpreadATR=0.0;
double gHT5LiquidityQuality=0.0;
double gHT5SessionQuality=1.0;
double gHT5OrganConsensus=0.0;
double gHT5LifeEnergy=0.0;
double gHT5LastCampaignR=0.0;
double gHT5CampaignReliability[32];
double gHT5SourceSamples[32];
double gHT5SourceWins[32];
double gHT5SourceLosses[32];
double gHT5SourceExpectancyR[32];
double gHT5SessionSamples[6];
double gHT5SessionExpectancyR[6];
double gHT5HourSamples[24];
double gHT5HourExpectancyR[24];
double gHT5PhaseSamples[6];
double gHT5PhaseExpectancyR[6];
double gHT5FeatureNow[32];
double gHT5FeatureEWMA[32];
double gHT5FeatureVar[32];
double gHT5PatternPredictionR=0.0;
double gHT5PatternConfidence=0.0;
double gHT5GenomeMutationPressure=0.0;
double gHT5RiskReuseScale=1.0;
double gHT5FVGPrecisionScale=1.0;
double gHT5RhythmFloorOffset=0.0;
double gHT5ChannelAuthorityScale=1.0;
double gHT5ProtectionAggression=1.0;


//===============================================================================
// v6.00 CENTRAL CAMPAIGN SEQUENCE SPINE
// This is not another signal.  It is the state machine that gives every organ a job.
//===============================================================================
struct HT6_CampaignSequence
{
   bool active;
   int campaignId;
   int direction;
   int moveCount;
   int phase;
   int moveType;
   int pauseType;
   bool pauseActive;
   bool bosAccepted;
   bool transferReady;
   bool phase3Exceptional;
   bool phase3AddConsumed;
   datetime campaignStart;
   datetime lastMoveTime;
   datetime pauseStart;
   datetime lastSignalBar;
   double campaignAnchor;
   double lastMoveStartPrice;
   double lastMoveExtreme;
   double pauseHigh;
   double pauseLow;
   double impulseATR;
   double pauseDepthATR;
   double pauseBars;
   double structureScore;
   double rhythmScore;
   double locationScore;
   double continuationScore;
   double exhaustionScore;
   double maturityScore;
   string state;
};

HT6_CampaignSequence gHT6Seq;
bool gHT6DoctrineOwnsEntry=true;
string gHT6DoctrineState="SEQUENCE DOCTRINE AWAKENING";
string gHT6LastBlockReason="NONE";
// v6.02 AUDIT: the sequence state machine is the primary execution spine.
// Market DNA remains a sensor/exposure adviser; it may not deadlock a valid
// Phase-1/2 seed through stale Q* direction or zero pre-plan lot estimates.
bool gHT6DirectSequenceExecution=true;
bool gHT6SequencePlanContext=false;
int gHT6LastDirectAttemptSerial=-1;
datetime gHT6LastAuditBar=0;
string gHT6AuditState="BOOT";
int gHT6CampaignSerial=0;
int gHT6EntryPhaseSnapshot=0;
int gHT6EntryMoveSnapshot=0;
int gHT6EntryMoveTypeSnapshot=0;
int gHT6EntryPauseTypeSnapshot=0;
double gHT6EntryContinuationSnapshot=0.0;
double gHT6EntryExhaustionSnapshot=0.0;
double gHT6PhaseSamples[6];
double gHT6PhaseExpectancyR[6];
double gHT6PauseSamples[4];
double gHT6PauseExpectancyR[4];
double gHT6MoveTypeSamples[4];
double gHT6MoveTypeExpectancyR[4];

//===============================================================================
// v6.09 EINSTEIN DOUBLE-CAMPAIGN FLOW DOCTRINE
// Primary entries are STRUCTURE FLOW only. The 23 named setup sources are
// CONTINUATION EVIDENCE only and may never seed or flip a campaign.
// The active LL defines the lower rail. The HIGH exactly two candles to the
// left of that LL candle defines the upper rail. A CLOSED candle outside the
// box creates the primary structural direction.
//===============================================================================
struct HT6_EinsteinFlowState
{
   bool boxReady;
   datetime llTime;
   datetime upperTime;
   double lowerRail;
   double upperRail;
   datetime consumedBoxTime;
   int consumedBreakMask;
   int primaryDirection;
   int leg;
   int lastBreakDirection;
   datetime lastBreakBar;
   double lastBreakPenetrationATR;
   double pointBank;              // aligned continuation pressure for PRIMARY direction
   double oppositionBank;         // opposite evidence; NEVER flips primary structure
   double pressureBias;           // -1 opposite dominated .. +1 aligned dominated
   double alignedCharge;          // aligned points / leg requirement
   double oppositionCharge;       // opposite points / leg requirement
   double structureMass;          // M in Einstein flow equation
   double flowVelocity;           // V in Einstein flow equation
   double locationRelativity;     // L in Einstein flow equation
   double phaseGravity;           // G in Einstein flow equation
   bool continuationDefense;      // opposition pressure says STOP ADDING / DEFEND
   double energy;
   int evidenceSerial;
   int lastAddonEvidenceSerial;
   int addonCountThisLeg;
   int sellSwitchConfirmCount;   // BUY->SELL transfer confirmations
   int buySwitchConfirmCount;    // SELL->BUY transfer confirmations
   double sonicAnchorPrice;      // latest core or recycled compound pocket anchor
   double sonicRiskR;            // distance unit for between-core SONIC nodes
   int sonicNextNode;            // next 0.18R flow node to fire
   int sonicNodesFired;          // nodes fired in current sonic wave
   datetime sonicLastAddTime;
   double sonicPeakProfit;       // peak continuation-add basket profit for adaptive compound TP
   double sonicPocketTargetMoney;
   bool sonicPocketArmed;
   int sonicPocketCycle;
   double coreRatchetPrice;      // latest core entry; prior Einstein orders ratchet here when broker-safe
   int coreRatchetDirection;
   int coreRatchetCoreTicket;
   datetime coreRatchetCoreTime;
   bool structureEntryPending;
   int pendingStructureDirection;
   int pendingStructureLeg;
   double pendingStructureStop;
   string lastPointLabel;
   string lastOppositionLabel;
   string primaryMemory;
   string legMemory;
   string pressureMemory;
   string state;
};

HT6_EinsteinFlowState gHT6Flow;
bool gHT6EinsteinFlowOwnsAllEntries=true;
bool gHT6StructureHoldOrderContext=false;
bool gHT6ContinuationAddOrderContext=false;
bool gHT6EinsteinCoreCloseAuthority=false; // opposite structure close / explicit emergency may liquidate core holds
bool gHT6EinsteinAddonCloseAuthority=false; // compound collection owns normal add-on liquidation
bool gHT6EinsteinStopRatchetAuthority=false; // next-core doctrine may advance Einstein broker stops
bool gHT6DirectProtectionModifyAuthority=false; // v6.08 BE/ATR trail may advance stops

// v6.09 DOUBLE-CAMPAIGN state.
bool gHT6DoubleCampaignActive=false;
bool gHT6DoubleWaitFreshPrimary=false;
double gHT6DoubleCampaignStartBalance=0.0;
double gHT6DoubleCampaignTargetEquity=0.0;
double gHT6DoubleCampaignPeakEquity=0.0;
double gHT6DoubleCampaignProgressPercent=0.0;
datetime gHT6DoubleCampaignStartTime=0;
datetime gHT6DoubleCompletionTime=0;
datetime gHT6DoubleWaitBoxTime=0;
datetime gHT6IntentLastClosedBar=0;
int gHT6IntentWeakBars=0;
double gHT6CampaignIntent=0.0;
string gHT6DoubleState="WAIT PRIMARY";
bool gHT6SonicFlowOrderContext=false;        // flow-node add; no hard signal may own direction
datetime gHT6LastEinsteinSenseBar=0;
datetime gHT6LastNamedPointIdentity[32];
double gHT6EinsteinFamilyPoints[8];
double gHT6EinsteinOppFamilyPoints[8];
int gHT6EinsteinCoreSerial=0;
int gHT6EinsteinAddonSerial=0;
string gHT6EinsteinAudit="BOOT";

// Internal doctrine constants. They are intentionally not optimizer knobs.
// The learner may observe them, but the primary structural law stays fixed.
double gHT6EinsteinStopBufferATR=0.06;
double gHT6EinsteinFamilyPointCap=2.50;
double gHT6EinsteinEnergyThreshold=1.00;
double gHT6EinsteinMinimumPressureBias=0.10;
double gHT6EinsteinDefenseOppositionRatio=0.75;
int    gHT6SellSwitchCloseConfirmations=2;
int    gHT6SonicNodesPerCore=10;
double gHT6SonicNodeStepR=0.18;
int    gHT6SonicMinSecondsBetweenAdds=4;
double gHT6SonicMinimumVelocity=0.92;
double gHT6SonicMaximumOppositionCharge=0.95;
double gHT6SonicPocketMinimumGoalShare=0.04;
double gHT6SonicPocketStrongExpansionMultiple=1.45;

bool gHT5CreatureInitialized=false;
bool gHT5SoftRepairAuthority=false;
bool gHT5CampaignSeenOpen=false;

//===============================================================================
// v5.02 MULTI-SOURCE ENTRY TRIBUNAL
// Every named setup is a detector, never an executor. A setup must receive an
// independent witness before Commander may act. Break-type setups can create
// BOTH a break entry and a persistent pullback/retest entry.
//===============================================================================
struct HT5_SetupEvent
{
   bool armed;
   bool pullbackRequired;
   bool consumed;
   bool ready;
   bool campaignWitnessed;
   int direction;
   int source;
   datetime identity;
   datetime expires;
   double trigger;
   double invalidation;
   double targetR;
   double quality;
   double agreementScore;
   int agreementCount;
   string label;
   string witnesses;
   string state;
};
HT5_SetupEvent gHT5SetupEvent[32];
bool gHT5SetupEntryContext=false;
int gHT5ActiveSetupSource=PYR_SOURCE_NONE;
double gHT5SetupEntryStop=0.0,gHT5SetupEntryTarget=0.0,gHT5SetupEntryAgreement=0.0;
string gHT5SetupEntryLabel="NONE",gHT5SetupEntryWitnesses="NONE",gHT5SetupState="SETUP LIBRARY SEARCHING";
int gHT5LastSetupAttemptSerial=-1;

// v5.03 MESHED THESIS CAPSULE ---------------------------------------------------
// A setup owns direction. The organs do not average direction into mush; they
// become witnesses around that setup. The same capsule supplies execution, stop
// geometry, campaign identity, SONIC context and learning attribution.
struct HT5_ThesisCapsule
{
   bool active;
   bool frozen;
   int direction;
   int source;
   datetime identity;
   double trigger;
   double rawInvalidation;
   double stopPrice;
   double targetR;
   double agreement;
   double quality;
   double reliability;
   double structureSupport;
   double channelSupport;
   double flowSupport;
   double locationSupport;
   double oracleSupport;
   double mtfSupport;
   double memorySupport;
   double conflict;
   double coherence;
   string label;
   string witnesses;
   string stopReason;
   string state;
};
HT5_ThesisCapsule gHT5LiveThesis;
HT5_ThesisCapsule gHT5CampaignThesis;
double gHT5MeshCoherenceFloor=0.34;
double gHT5MeshConflictPenalty=0.50;
double gHT5MeshSetupDominance=0.72;
double gHT5StopBaseBufferATR=0.06;
double gHT5StopMaxDistanceATR=2.80;
string gHT5StopLossState="STOP LOSS WAITING FOR SETUP THESIS";

// v5.04 unified train + formula-arrow nervous system.
double gHT5FormulaArrowScore=0.0,gHT5FormulaArrowConfidence=0.0;
int gHT5FormulaArrowDirection=DIR_FLAT;
string gHT5FormulaArrowState="FORMULA ARROW INITIALIZING";
double gHT5TrainScore=0.0,gHT5TrainStrength=0.0,gHT5TrainAgreement=0.0;
int gHT5TrainDirection=DIR_FLAT;
string gHT5TrainState="TRAIN DIRECTION INITIALIZING";
string gHT5TrendFortificationState="TREND FORTIFICATION WAIT";
string gHT5StopBreathingState="STOP BREATHING IDLE";
double gHT5ArrowEnterThreshold=0.18,gHT5ArrowReleaseThreshold=0.08,gHT5TrainEnterThreshold=0.16;
double gHT5StopRescueZoneATR=0.22,gHT5HardReserveExtraATR=0.28,gHT5HardReserveMultiplier=1.45;

// v5.05 audit-driven survival physiology.
double gHT5NoiseEnvelopePrice=0.0,gHT5SurvivalRoom=0.0,gHT5SurvivalRequired=0.0;
string gHT5EntrySurvivalState="ENTRY SURVIVAL INITIALIZING";
bool gHT5DefenseMode=false,gHT5DefenseLatched=false;
int gHT5DefenseDirection=DIR_FLAT;
string gHT5DefenseState="ATTACK MODE / NO DEFENSE PRESSURE";
double gHT5SourceBuySamples[32],gHT5SourceSellSamples[32];
double gHT5SourceBuyExpectancyR[32],gHT5SourceSellExpectancyR[32];
double gHT5SourceBuyEarlyDeath[32],gHT5SourceSellEarlyDeath[32];
double gHT5SourceBuyStopRate[32],gHT5SourceSellStopRate[32];
datetime gHT5TelemetryLastCloseScan=0;
string gHT5TelemetryState="TRADE TELEMETRY INITIALIZING";
#define HT5_GHOST_SLOTS 48
#define HT5_GHOST_STAGES 9
int gHT5GhostTicket[HT5_GHOST_SLOTS],gHT5GhostDir[HT5_GHOST_SLOTS],gHT5GhostSource[HT5_GHOST_SLOTS],gHT5GhostMask[HT5_GHOST_SLOTS];
datetime gHT5GhostCloseTime[HT5_GHOST_SLOTS];
double gHT5GhostEntry[HT5_GHOST_SLOTS],gHT5GhostLots[HT5_GHOST_SLOTS],gHT5GhostActualNet[HT5_GHOST_SLOTS];
double gHT5GhostCommission[HT5_GHOST_SLOTS],gHT5GhostR0[HT5_GHOST_SLOTS];

// Campaign identity is frozen at the first actual fill. It does not depend on
// whatever signal happens to be visible when the campaign later closes.
int gHT5CampaignEntrySource=PYR_SOURCE_NONE;
string gHT5CampaignEntryLabel="NONE",gHT5CampaignEntryWitnesses="NONE";
double gHT5CampaignEntryAgreement=0.0;
datetime gHT5CampaignEntryTime=0;
double gHT5CampaignSourceWeight[32];
double gHT5CampaignSourceTotalWeight=0.0;


//===============================================================================
// DROPDOWN PRESET TRANSLATION -- semantic choices -> numeric physiology
//===============================================================================
double HT5SeedRiskPercent()
{
   return (double)((int)RiskThisMuchOnTheInitialSeed);
}

double HT5CampaignRiskCapPercent()
{
   return (double)((int)NeverLetOneCampaignRiskMoreThan);
}

double HT5CompoundGoalPercent()
{
   return (double)((int)CompoundAccountByThisRateEveryCycle);
}

int HT5SignalTimeframeValue()
{
   int v=(int)HowFastShouldTheCreatureReadSignals;
   if(v==1) return PERIOD_M1;
   if(v==15) return PERIOD_M15;
   if(v==30) return PERIOD_M30;
   if(v==60) return PERIOD_H1;
   return PERIOD_M5;
}

double HT6DirectRiskPercent()
{
   return MathMax(0.01,MathMin(100.0,DirectRiskPercentEveryTrade));
}

double HT6DirectOpenRiskCapPercent()
{
   return MathMax(HT6DirectRiskPercent(),MathMin(100.0,DirectMaximumOpenRiskPercent));
}

int HT6NormalizeHour(int hour)
{
   if(hour<0) return 0;
   if(hour>23) return 23;
   return hour;
}

bool HT6HourInWindow(int hour,int startHour,int endHour)
{
   hour=HT6NormalizeHour(hour);
   startHour=HT6NormalizeHour(startHour);
   endHour=HT6NormalizeHour(endHour);
   if(startHour==endHour) return true; // explicit full-day window
   if(startHour<endHour) return (hour>=startHour && hour<endHour);
   return (hour>=startHour || hour<endHour); // overnight window
}

bool HT6DirectTradingWindowAllows(datetime now)
{
   int hour=TimeHour(now);
   if(DirectTradingWindowMode==TIME_WINDOW_ALL_HOURS) return true;
   if(DirectTradingWindowMode==TIME_WINDOW_LONDON_AND_NEWYORK)
      return (hour>=7 && hour<21); // broker-clock London through New York
   if(DirectTradingWindowMode==TIME_WINDOW_CUSTOM_TWO_WINDOWS)
      return HT6HourInWindow(hour,DirectWindow1StartHour,DirectWindow1EndHour)
          || HT6HourInWindow(hour,DirectWindow2StartHour,DirectWindow2EndHour);
   return false;
}

void HT6ApplyDirectExecutionInputs()
{
   // v6.10 ONE-WAY WIRING: no legacy preset or persisted phenotype may overwrite
   // these values after this function runs. It is called at init and every tick.
   DirectInputsOwnExecution=true;
   DirectUseLegacyBasketCompoundCollector=false;

   SignalTF=DirectSignalTimeframe;
   SignalTimeframe=DirectSignalTimeframe;
   SlippagePoints=MathMax(0,DirectSlippagePoints);

   bool directTimeWindowAllowed=HT6DirectTradingWindowAllows(TimeCurrent());
   AllowNewEntries=(DirectAllowNewEntries && directTimeWindowAllowed);
   AllowBuy=(AllowNewEntries && DirectAllowBuyPrimaries);
   AllowSell=(AllowNewEntries && DirectAllowSellPrimaries);
   if(!AllowNewEntries) MasterControl=MASTER_MANAGE_OPEN_TRADES_ONLY;
   else if(DirectAllowBuyPrimaries && DirectAllowSellPrimaries) MasterControl=MASTER_BUY_AND_SELL;
   else if(DirectAllowBuyPrimaries) MasterControl=MASTER_BUY_ONLY;
   else if(DirectAllowSellPrimaries) MasterControl=MASTER_SELL_ONLY;
   else { MasterControl=MASTER_MANAGE_OPEN_TRADES_ONLY; AllowNewEntries=false; }

   RiskAccountBasis=DirectCompoundRiskBasis;
   RiskPerEntryPercent=HT6DirectRiskPercent();
   MaximumCampaignRiskPercent=HT6DirectOpenRiskCapPercent();
   RiskPerTrade=(HT_RiskPercent)MathMax(1,MathMin(100,(int)MathRound(RiskPerEntryPercent)));
   MaximumCampaignRisk=(HT_RiskPercent)MathMax(1,MathMin(100,(int)MathRound(MaximumCampaignRiskPercent)));

   StopATRPeriodValue=MathMax(1,DirectATRStopPeriod);
   StopATRMultiplierValue=MathMax(0.05,DirectATRStopMultiplier);
   MinimumStopDistancePointsValue=MathMax(1.0,DirectMinimumStopDistancePoints);
   FixedStopDistancePointsValue=MathMax(MinimumStopDistancePointsValue,DirectFixedStopDistancePoints);
   TakeProfitSLRatioValue=MathMax(0.05,DirectTakeProfitRMultiple);

   // Basket collector is intentionally dead in the rewired engine. Every ticket
   // has its own broker TP and every next ticket compounds from the live account.
   EnableCompoundStaircase=false;
   gCompoundEntryFreeze=false;
   gCompoundPhase=CMP_BUILDING;

   gHT6SellSwitchCloseConfirmations=MathMax(1,DirectSellSwitchClosedCandles);
   gHT6SonicNodesPerCore=MathMax(1,MathMin(100,DirectSonicNodesBetweenCores));
   gHT6SonicNodeStepR=MathMax(0.01,MathMin(2.00,DirectSonicNodeSpacingR));
   gHT6SonicMinSecondsBetweenAdds=MathMax(0,DirectSonicMinimumSecondsBetweenAdds);
   gHT6SonicMinimumVelocity=MathMax(0.0,MathMin(2.0,DirectSonicMinimumVelocity));
   gHT6SonicMaximumOppositionCharge=MathMax(0.0,DirectSonicMaximumOppositionCharge);
   MinimumProjectedMarginLevel=MathMax(0.0,DirectMinimumProjectedMarginLevel);
   MinimumFreeMarginReservePercent=MathMax(0.0,MathMin(100.0,DirectMinimumFreeMarginReservePercent));
}

double HT6DirectInitialStopPrice(int dir,double openPrice)
{
   if(dir==DIR_FLAT || openPrice<=0.0) return 0.0;
   double brokerMin=MathMax(MarketInfo(Symbol(),MODE_STOPLEVEL),MarketInfo(Symbol(),MODE_FREEZELEVEL))*Point+Point;
   double minDist=MathMax(DirectMinimumStopDistancePoints*Point,brokerMin);
   double atr=MathMax(Point,HTExecutionATR(SignalTF,MathMax(1,DirectATRStopPeriod)));
   if(LiveATRStopFloorToStable) atr=MathMax(atr,HTStableATR(SignalTF,MathMax(1,DirectATRStopPeriod)));
   double atrDist=MathMax(minDist,atr*MathMax(0.05,DirectATRStopMultiplier));
   double dist=atrDist;

   if(DirectStopLossMode==DIRECT_STOP_FIXED_POINTS)
      dist=MathMax(minDist,DirectFixedStopDistancePoints*Point);
   else if(DirectStopLossMode==DIRECT_STOP_WIDER_ATR_OR_STRUCTURE)
   {
      double structure=0.0;
      if(ProtectiveStructureAnchor(dir,structure) && structure>0.0)
      {
         double structureStop=structure-dir*atr*MathMax(0.0,DirectStructureStopBufferATR);
         double structureDist=MathAbs(openPrice-structureStop);
         dist=MathMax(atrDist,structureDist);
      }
   }

   double stop=(dir==DIR_BUY?openPrice-dist:openPrice+dist);
   return HT5RoundBrokerSafeStop(dir,openPrice,stop);
}

double HT6DirectTakeProfitPrice(int dir,double openPrice,double stopPrice)
{
   if(!DirectEveryTradeHasTakeProfit || dir==DIR_FLAT || openPrice<=0.0 || stopPrice<=0.0) return 0.0;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,MathMax(1,DirectATRStopPeriod)));
   double stopDist=MathMax(Point,MathAbs(openPrice-stopPrice));
   double dist=0.0;

   if(DirectTakeProfitMode==DIRECT_TP_ATR_MULTIPLE)
      dist=atr*MathMax(0.05,DirectTakeProfitATRMultiplier);
   else if(DirectTakeProfitMode==DIRECT_TP_FIXED_POINTS)
      dist=MathMax(Point,DirectTakeProfitFixedPoints*Point);
   else if(DirectTakeProfitMode==DIRECT_TP_COMPOUND_PERCENT)
   {
      double r=MathMax(0.05,DirectCompoundTargetPercentPerTrade/MathMax(0.01,HT6DirectRiskPercent()));
      dist=stopDist*r;
   }
   else if(DirectTakeProfitMode==DIRECT_TP_INTENT_ADAPTIVE)
   {
      double intent=HT6CampaignIntentScore(dir);
      double lo=MathMax(0.25,DirectAdaptiveTPMinimumR);
      double hi=MathMax(lo,DirectAdaptiveTPMaximumR);
      double t=HT5Clamp((intent-0.45)/0.50,0.0,1.0);
      double r=lo+(hi-lo)*t;
      if(gHT6ContinuationAddOrderContext) r=MathMax(0.25,r*MathMax(0.10,DirectAdaptiveTPSonicScale));
      else if(gHT6StructureHoldOrderContext) r=MathMax(0.25,r*MathMax(0.10,DirectAdaptiveTPCoreScale));
      dist=stopDist*r;
   }
   else
      dist=stopDist*MathMax(0.05,DirectTakeProfitRMultiple);

   double brokerMin=MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point;
   dist=MathMax(dist,brokerMin);
   double target=(dir==DIR_BUY?openPrice+dist:openPrice-dist);
   double tick=TickSizePrice();
   if(tick>0.0)
   {
      if(dir==DIR_BUY) target=MathCeil(target/tick)*tick;
      else target=MathFloor(target/tick)*tick;
   }
   return NormalizeDouble(target,Digits);
}

double HT6DirectCompoundTakeProfitAfterLot(int dir,double openPrice,double stopPrice,double lot,double fallback)
{
   if(!DirectInputsOwnExecution || !DirectEveryTradeHasTakeProfit || DirectTakeProfitMode!=DIRECT_TP_COMPOUND_PERCENT) return fallback;
   if(lot<=0.0 || stopPrice<=0.0) return fallback;
   double riskMoney=OrderRiskMoneyFromPrices(openPrice,stopPrice,lot);
   if(riskMoney<=0.0) return fallback;
   double targetMoney=AccountRiskBase()*MathMax(0.01,DirectCompoundTargetPercentPerTrade)/100.0;
   double r=MathMax(0.05,targetMoney/riskMoney);
   double dist=MathAbs(openPrice-stopPrice)*r;
   double brokerMin=MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point;
   dist=MathMax(dist,brokerMin);
   double target=(dir==DIR_BUY?openPrice+dist:openPrice-dist);
   double tick=TickSizePrice();
   if(tick>0.0)
   {
      if(dir==DIR_BUY) target=MathCeil(target/tick)*tick;
      else target=MathFloor(target/tick)*tick;
   }
   return NormalizeDouble(target,Digits);
}

void HT5ApplyDropdownPhysiologyPre()
{
   // MASTER / PERMISSION
   if(WhatMayTheCreatureTrade==CREATURE_SLEEP_NO_TRADING) MasterControl=MASTER_OFF;
   else if(WhatMayTheCreatureTrade==MANAGE_OPEN_TRADES_ONLY) MasterControl=MASTER_MANAGE_OPEN_TRADES_ONLY;
   else if(WhatMayTheCreatureTrade==TRADE_BUYS_ONLY) MasterControl=MASTER_BUY_ONLY;
   else if(WhatMayTheCreatureTrade==TRADE_SELLS_ONLY) MasterControl=MASTER_SELL_ONLY;
   else MasterControl=MASTER_BUY_AND_SELL;

   SignalTimeframe=(ENUM_TIMEFRAMES)HT5SignalTimeframeValue();

   // Mission establishes baseline pace; specialized dropdowns refine it later.
   if(WhatIsTheCreaturesMission==LIFE_CAPITAL_GUARDIAN_SLOWER_GROWTH) UnityPace=UNITY_PACE_PATIENT;
   else if(WhatIsTheCreaturesMission==LIFE_BALANCED_GROWTH_AND_PROTECTION) UnityPace=UNITY_PACE_BALANCED;
   else UnityPace=UNITY_PACE_FAST;

   if(WhatIsTheCreaturesMission==LIFE_OBSERVE_AND_LEARN_NO_NEW_TRADES)
      MasterControl=MASTER_MANAGE_OPEN_TRADES_ONLY;

   RiskPerTrade=(HT_RiskPercent)MathMax(1,MathMin(100,(int)RiskThisMuchOnTheInitialSeed));
   MaximumCampaignRisk=(HT_RiskPercent)MathMax(1,MathMin(100,(int)NeverLetOneCampaignRiskMoreThan));
   CompoundTargetPercent=HT5CompoundGoalPercent();
   CompoundPostCollectionPauseSeconds=(int)HowSoonAfterCollectionShouldTheNextHuntStart;

   if(HowAggressivelyShouldWinningMovementGrow==GROWTH_SCOUT_ONE_CAR_AT_A_TIME) UnityPressure=UNITY_PRESSURE_SINGLE;
   else if(HowAggressivelyShouldWinningMovementGrow==GROWTH_BALANCED_EARNED_ADDS) UnityPressure=UNITY_PRESSURE_BURST_3;
   else if(HowAggressivelyShouldWinningMovementGrow==GROWTH_RAPID_SONIC_EARNED_ADDS) UnityPressure=UNITY_PRESSURE_RAPID_6;
   else UnityPressure=UNITY_PRESSURE_MAX_20;

   if(HowMuchOfTheLivingDashboardShouldShow==VISUAL_MINIMAL_KEEP_CHART_CLEAR) VisualControl=VISUAL_DASHBOARD;
   else VisualControl=VISUAL_DIAGNOSTIC;
}

void HT5ApplyDropdownPhysiologyFinal()
{
   TradeComment="HT_UNITY_SEQ_AUDIT_602";
   // The legacy Apply* functions calculate runtime values from the preselected
   // presets. This final pass sets deeper v5 organ behavior that has no direct
   // legacy preset equivalent.
   CompoundTargetPercent=HT5CompoundGoalPercent();
   RiskPerEntryPercent=HT5SeedRiskPercent();
   MaximumCampaignRiskPercent=HT5CampaignRiskCapPercent();
   EnableCompoundStaircase=true;
   CompoundGuardAtPercent=(HowShouldCompoundTargetsBeCollected==COLLECT_EXACT_COMPOUND_TARGET?92.0:80.0);
   CompoundPostCollectionPauseSeconds=(int)HowSoonAfterCollectionShouldTheNextHuntStart;

   // Small-account physiology.
   if(HowShouldVerySmallAccountsBeHandled==SMALL_ACCOUNT_STRICT_SELECTED_RISK)
   { MicroAllowBrokerMinimumLot=false; MicroMaximumActualRiskPercent=HT5SeedRiskPercent(); }
   else if(HowShouldVerySmallAccountsBeHandled==SMALL_ACCOUNT_ALLOW_BROKER_MINIMUM_WITH_CAP)
   { MicroAllowBrokerMinimumLot=true; MicroMaximumActualRiskPercent=MathMin(5.0,MathMax(2.0,HT5SeedRiskPercent())); }
   else
   { MicroAllowBrokerMinimumLot=true; MicroMaximumActualRiskPercent=MathMin(5.0,MathMax(3.0,HT5SeedRiskPercent())); MicroAccountThreshold=150.0; }

   // Historical memory / channel organ.
   if(HowFarBackShouldTheCreatureRemember==MEMORY_5000_BARS_FAST) MarketDNAChannelLookbackBars=5000;
   else if(HowFarBackShouldTheCreatureRemember==MEMORY_10000_BARS_MEDIUM) MarketDNAChannelLookbackBars=10000;
   else if(HowFarBackShouldTheCreatureRemember==MEMORY_40000_BARS_MAXIMUM) MarketDNAChannelLookbackBars=40000;
   else MarketDNAChannelLookbackBars=20000;

   EnableMarketDNAHistoricalChannels=true;
   MarketDNAChannelVetoCounterBOS=(HowMuchAuthorityShouldHistoricalChannelsHave!=CHANNEL_CONTEXT_ONLY);
   MarketDNAChannelBounceHardAuthority=(HowMuchAuthorityShouldHistoricalChannelsHave>=CHANNEL_HARD_BOUNCE_AND_BREAK_AUTHORITY);
   gHT5ChannelAuthorityScale=(HowMuchAuthorityShouldHistoricalChannelsHave==CHANNEL_CONTEXT_ONLY?0.75:
                             (HowMuchAuthorityShouldHistoricalChannelsHave==CHANNEL_DIRECTION_FIREWALL?1.00:
                             (HowMuchAuthorityShouldHistoricalChannelsHave==CHANNEL_HARD_BOUNCE_AND_BREAK_AUTHORITY?1.15:1.05)));

   // Day extreme organ.
   MarketDNADayHLGuard=(HowShouldDayHighLowProtectEntries!=DAY_EXTREMES_VISUAL_ONLY);
   MarketDNADayRequireProvenBreakForCounter=(HowShouldDayHighLowProtectEntries>=DAY_EXTREMES_HARD_COUNTER_ENTRY_FIREWALL);
   StopAddingNearUnprovenDayExtreme=(HowShouldDayHighLowProtectEntries==DAY_EXTREMES_HARD_COUNTER_ENTRY_FIREWALL ||
                                      HowShouldDayHighLowProtectEntries==DAY_EXTREMES_ADAPTIVE_BY_TOUCH_AND_FLOW);
   MarketDNADayHLDraw=(HowMuchOfTheLivingDashboardShouldShow!=VISUAL_MINIMAL_KEEP_CHART_CLEAR);

   // Organ mesh / one nervous system. The setup owns direction; all other
   // organs either reinforce, oppose or protect the same thesis capsule.
   if(HowTightlyShouldAllOrgansMesh==MESH_LOOSE_ORGANS_SHARE_CONTEXT)
   { gHT5MeshCoherenceFloor=0.20; gHT5MeshConflictPenalty=0.30; gHT5MeshSetupDominance=0.55; }
   else if(HowTightlyShouldAllOrgansMesh==MESH_ONE_SHARED_THESIS_BEFORE_ENTRY)
   { gHT5MeshCoherenceFloor=0.30; gHT5MeshConflictPenalty=0.42; gHT5MeshSetupDominance=0.68; }
   else if(HowTightlyShouldAllOrgansMesh==MESH_LOCK_SETUP_TO_CAMPAIGN_THESIS)
   { gHT5MeshCoherenceFloor=0.38; gHT5MeshConflictPenalty=0.58; gHT5MeshSetupDominance=0.78; }
   else
   { gHT5MeshCoherenceFloor=0.34; gHT5MeshConflictPenalty=0.52; gHT5MeshSetupDominance=0.74; }

   // Setup-aware stop immune system. The broker SL is always retained. ATR is a
   // buffer and distance sanity check; it is never the thesis by itself.
   BrokerLossPolicy=BROKER_KEEP_ORIGINAL_SL;
   if(HowShouldTheCreaturePlaceItsStopLoss==STOP_LOSS_SETUP_INVALIDATION_ONLY)
   { gHT5StopBaseBufferATR=0.02; gHT5StopMaxDistanceATR=2.40; }
   else if(HowShouldTheCreaturePlaceItsStopLoss==STOP_LOSS_BEYOND_LAST_STRUCTURE_SWING)
   { gHT5StopBaseBufferATR=0.08; gHT5StopMaxDistanceATR=3.20; }
   else if(HowShouldTheCreaturePlaceItsStopLoss==STOP_LOSS_HYBRID_SETUP_PLUS_STRUCTURE)
   { gHT5StopBaseBufferATR=0.06; gHT5StopMaxDistanceATR=2.90; }
   else
   { gHT5StopBaseBufferATR=0.05; gHT5StopMaxDistanceATR=2.75; }

   // Signal FVG organ.
   MarketDNASignalFVGOnly=(WhereMayFreshEntriesBegin==ENTRY_ONLY_AT_SIGNAL_FVG); // only explicit FVG-ONLY is a hard gate.
   // Universal named-setup mode lets each setup use its own earned execution
   // location (break, pullback, sweep/reclaim, FVG/OB, station). FVG remains a
   // first-class setup but is no longer a mandatory choke point for every family.
   if(WhereMayFreshEntriesBegin==ENTRY_ANY_NAMED_SETUP_WITH_AGREEMENT) MarketDNASignalFVGOnly=false;
   MarketDNASignalFVGQueueAuthority=true;
   MarketDNAFVGDirectSeedAuthority=true;
   MarketDNAFVGSeedDedicatedPlan=true;
   if(HowPreciselyShouldPriceRetestTheFVG==FVG_STRICT_SMALL_TOUCH_WINDOW)
   { MarketDNASignalFVGToleranceATR=0.035; MarketDNASignalFVGMinATR=0.02; }
   else if(HowPreciselyShouldPriceRetestTheFVG==FVG_WIDE_FAST_MARKET_WINDOW)
   { MarketDNASignalFVGToleranceATR=0.14; MarketDNASignalFVGMinATR=0.005; }
   else if(HowPreciselyShouldPriceRetestTheFVG==FVG_ADAPTIVE_TO_LIVE_ATR_AND_FLOW)
   { MarketDNASignalFVGToleranceATR=0.08; MarketDNASignalFVGMinATR=0.008; }
   else
   { MarketDNASignalFVGToleranceATR=0.07; MarketDNASignalFVGMinATR=0.01; }

   // Three-way rail is never allowed to deadlock the whole creature.
   EnableMarketDNAThreeWayChannel=true;
   MarketDNARequireTriggerRailReadyBeforeTrading=false;
   MarketDNARequireChannelReadyBeforeTrading=false;
   MarketDNAAllowDegradedChannelTrading=true;
   MarketDNATriggerRailCloseOpposite=(HowShouldTheBlackGoldRedChannelBehave>=BLACK_RAIL_HARD_TRANSFER_AUTHORITY);
   MarketDNATriggerRailTransferAllowNegative=(HowShouldTheBlackGoldRedChannelBehave==BLACK_RAIL_HARD_TRANSFER_AUTHORITY);

   // RHYTHM heart.
   EnableMarketDNARhythmDNA=true;
   if(HowStrongMustLiveTickFlowBe==RHYTHM_PERMISSIVE_RETESTS)
   { MarketDNARhythmLaunchThreshold=0.08; MarketDNARhythmRapidThreshold=0.22; MarketDNASignalFVGHardOpposingRhythm=-0.28; }
   else if(HowStrongMustLiveTickFlowBe==RHYTHM_STRICT_LAUNCH_CONFIRMATION)
   { MarketDNARhythmLaunchThreshold=0.28; MarketDNARhythmRapidThreshold=0.48; MarketDNASignalFVGHardOpposingRhythm=-0.10; }
   else if(HowStrongMustLiveTickFlowBe==RHYTHM_DEEP_TICK_PHYSICS)
   { MarketDNARhythmLaunchThreshold=0.16; MarketDNARhythmRapidThreshold=0.32; MarketDNASignalFVGHardOpposingRhythm=-0.20; }
   else
   { MarketDNARhythmLaunchThreshold=0.20; MarketDNARhythmRapidThreshold=0.34; MarketDNASignalFVGHardOpposingRhythm=-0.18; }

   // PULSE hands.
   MarketDNAAllowLimitStacks=(HowShouldMagneticLimitZonesGrow!=PULSE_LIMITS_OFF);
   MarketDNAPulseGrowLimits=(HowShouldMagneticLimitZonesGrow>=PULSE_MAGNETIC_GROW_TOWARD_PRICE);
   if(HowShouldMagneticLimitZonesGrow==PULSE_ONE_SCOUT_PER_ZONE) MarketDNALimitCarsPerLevel=1;
   else if(HowShouldMagneticLimitZonesGrow==PULSE_MAGNETIC_GROW_TOWARD_PRICE) MarketDNALimitCarsPerLevel=3;
   else if(HowShouldMagneticLimitZonesGrow==PULSE_ADAPTIVE_MAGNETIC_WITH_CRASH_BRAKE) MarketDNALimitCarsPerLevel=4;
   MarketDNAPulseCrashBrake=(HowShouldMagneticLimitZonesGrow==PULSE_ADAPTIVE_MAGNETIC_WITH_CRASH_BRAKE?1.10:1.35);

   // SONIC muscles.
   MarketDNASonicRLadder=(HowShouldSonicAccelerateWinningTrades!=SONIC_OFF_SEED_ONLY);
   MarketDNASonicCagePlug=(HowShouldSonicAccelerateWinningTrades>=SONIC_R_LADDER_PLUS_CAGE_PLUGS);
   MarketDNAAllowRapidFire=(HowShouldSonicAccelerateWinningTrades!=SONIC_OFF_SEED_ONLY);
   if(HowShouldSonicAccelerateWinningTrades==SONIC_R_LADDER_SINGLE_RISK_BUDGET)
   { MarketDNARLadderStages=6; MarketDNARLadderFirstStageR=0.16; MarketDNARLadderLastStageR=0.82; }
   else if(HowShouldSonicAccelerateWinningTrades==SONIC_R_LADDER_PLUS_CAGE_PLUGS)
   { MarketDNARLadderStages=8; MarketDNARLadderFirstStageR=0.12; MarketDNARLadderLastStageR=0.88; }
   else if(HowShouldSonicAccelerateWinningTrades==SONIC_FULL_ADAPTIVE_COMPOUND_ACCELERATOR)
   { MarketDNARLadderStages=10; MarketDNARLadderFirstStageR=0.10; MarketDNARLadderLastStageR=0.92; }
   MarketDNARLadderUseSingleRiskBudget=true;

   // Protection immune system.
   NeverLetProvenCampaignGoNegative=(HowShouldTheCreatureProtectEarnedProfit!=PROTECT_STANDARD_FORWARD_ONLY);
   MarketDNAOracleUseEquityRatchet=(HowShouldTheCreatureProtectEarnedProfit>=PROTECT_BASKET_BREAK_EVEN_RATCHET);
   gHT5ProtectionAggression=(HowShouldTheCreatureProtectEarnedProfit==PROTECT_STANDARD_FORWARD_ONLY?0.75:
                            (HowShouldTheCreatureProtectEarnedProfit==PROTECT_BASKET_BREAK_EVEN_RATCHET?0.90:
                            (HowShouldTheCreatureProtectEarnedProfit==PROTECT_CAMPAIGN_WIDE_MONEY_SOLVER?1.00:1.12)));

   // Oracle / reversal organs.
   EnableMarketDNAOracleFusion=(HowDeepShouldOracleReadMarketPhase!=ORACLE_CONTEXT_ONLY || true);
   MarketDNAOracleRedBreakContinuation=(HowDeepShouldOracleReadMarketPhase>=ORACLE_DEEP_PHASE_AND_RED_CONTINUATION);
   EnableInflectionAcceptanceDNA=true;
   if(HowShouldTheCreatureReverseDirection==REVERSAL_CONSERVATIVE_INFLECTION_ONLY)
   { MarketDNAInflectionTransferATR=0.28; MarketDNAInflectionAcceptanceATR=0.12; }
   else if(HowShouldTheCreatureReverseDirection==REVERSAL_FULL_CREATURE_CONSENSUS)
   { MarketDNAInflectionTransferATR=0.16; MarketDNAInflectionAcceptanceATR=0.06; }

   // WILL / SURF memory.
   EnableWillDNA=(HowMuchCampaignMemoryShouldWILLUse!=WILL_MEMORY_OFF);
   EnableWillEnergyDrain=(HowMuchCampaignMemoryShouldWILLUse>=WILL_ADAPT_AUTHORITY);
   if(HowMuchCampaignMemoryShouldWILLUse==WILL_DEEP_CAMPAIGN_MEMORY){ WillLearningRate=0.035; WillConfidenceSamples=50; }
   MarketDNASurfDirectionCap=(HowShouldSURFLearnPredictionError==SURF_LEARNER_OFF?0.0:
                             (HowShouldSURFLearnPredictionError==SURF_MAGNITUDE_ONLY?0.20:
                             (HowShouldSURFLearnPredictionError==SURF_ADAPTIVE_MAGNITUDE_WITH_UNCERTAINTY?0.35:0.45)));

   // Evolution genome.
   EnableSelfEvolvingGenome=(HowShouldTheGenomeEvolve!=EVOLUTION_OFF);
   EvolutionPersistGenome=(HowShouldTheGenomeEvolve>=EVOLUTION_MUTATE_AFTER_REPEAT_EVIDENCE);
   if(HowFastMayTheGenomeChange==LEARNING_SLOW_STABLE)
   { EvolutionMutationRate=0.025; EvolutionMinimumCampaignsBeforeMutation=8; EvolutionSimilarLossesForMutation=4; }
   else if(HowFastMayTheGenomeChange==LEARNING_FAST_RESPONSIVE)
   { EvolutionMutationRate=0.075; EvolutionMinimumCampaignsBeforeMutation=4; EvolutionSimilarLossesForMutation=2; }
   else
   { EvolutionMutationRate=0.05; EvolutionMinimumCampaignsBeforeMutation=5; EvolutionSimilarLossesForMutation=3; }

   // Margin reserve is expressed through existing projected margin floor.
   if(HowMuchMarginShouldRemainUnused==KEEP_80_PERCENT_MARGIN_RESERVE) MinimumProjectedMarginLevel=500.0;
   else if(HowMuchMarginShouldRemainUnused==KEEP_70_PERCENT_MARGIN_RESERVE) MinimumProjectedMarginLevel=333.0;
   else if(HowMuchMarginShouldRemainUnused==KEEP_60_PERCENT_MARGIN_RESERVE) MinimumProjectedMarginLevel=250.0;
   else if(HowMuchMarginShouldRemainUnused==KEEP_50_PERCENT_MARGIN_RESERVE) MinimumProjectedMarginLevel=200.0;
   else MinimumProjectedMarginLevel=166.0;

   // Collection behavior.
   MarketDNAHarvestProfitableExcess=false;
   if(HowShouldCompoundTargetsBeCollected==COLLECT_EXACT_COMPOUND_TARGET)
   { UsePeakGiveback=false; MarketDNAOracleRedBreakContinuation=false; }
   else if(HowShouldCompoundTargetsBeCollected==COLLECT_COMPOUND_WITH_PEAK_PROTECTION)
   { UsePeakGiveback=true; MarketDNAOracleRedBreakContinuation=false; }
   else if(HowShouldCompoundTargetsBeCollected==COLLECT_ADAPTIVE_TARGET_AND_RED_BREAKOUT)
   { UsePeakGiveback=true; MarketDNAOracleRedBreakContinuation=true; }

   // Visual organism.
   if(HowMuchOfTheLivingDashboardShouldShow==VISUAL_MINIMAL_KEEP_CHART_CLEAR)
   { ShowDashboard=true; ShowUnityGauges=false; PyramidShowStructure=false; PyramidPaintSwingLabels=false; }
   else if(HowMuchOfTheLivingDashboardShouldShow==VISUAL_FULL_DIAGNOSTIC_ORGANS)
   { ShowDashboard=true; ShowUnityGauges=true; PyramidShowStructure=true; PyramidPaintSwingLabels=true; }
   else
   { ShowDashboard=true; ShowUnityGauges=true; PyramidShowStructure=true; PyramidPaintSwingLabels=false; }
}

//===============================================================================
// ORGAN UTILITIES
//===============================================================================
double HT5Clamp(double v,double lo,double hi){ return MathMax(lo,MathMin(hi,v)); }
int HT5Sign(double v){ return (v>0.0000001?DIR_BUY:(v<-0.0000001?DIR_SELL:DIR_FLAT)); }
double HT5SafeDiv(double a,double b){ return (MathAbs(b)>0.0000000001?a/b:0.0); }
double HT5Mid(){ RefreshRates(); return (Bid+Ask)*0.5; }

string HT5OrganName(int id)
{
   if(id==ORGAN_CHRONOS) return "CHRONOS";
   if(id==ORGAN_LUNGS) return "LUNGS";
   if(id==ORGAN_HEART) return "HEART";
   if(id==ORGAN_SKELETON) return "SKELETON";
   if(id==ORGAN_EYES) return "EYES";
   if(id==ORGAN_ORACLE) return "ORACLE";
   if(id==ORGAN_BRAIN) return "BRAIN";
   if(id==ORGAN_HANDS) return "HANDS";
   if(id==ORGAN_MUSCLES) return "MUSCLES";
   if(id==ORGAN_IMMUNE) return "IMMUNE";
   if(id==ORGAN_METABOLISM) return "METABOLISM";
   if(id==ORGAN_MEMORY) return "MEMORY";
   if(id==ORGAN_GENOME) return "GENOME";
   if(id==ORGAN_HOSPITAL) return "HOSPITAL";
   if(id==ORGAN_COMMANDER) return "COMMANDER";
   if(id==ORGAN_SEQUENCE) return "SEQUENCE";
   return "UNKNOWN";
}

void HT5SetOrgan(int id,double health,string state)
{
   if(id<0 || id>=ORGAN_COUNT) return;
   gHT5OrganHealth[id]=HT5Clamp(health,0.0,1.0);
   gHT5OrganState[id]=state;
   gHT5OrganPulse[id]++;
}

int HT5TimeframeByIndex(int idx)
{
   if(idx==0) return PERIOD_M1;
   if(idx==1) return PERIOD_M5;
   if(idx==2) return PERIOD_M15;
   if(idx==3) return PERIOD_H1;
   return PERIOD_H4;
}

string HT5TFName(int tf)
{
   if(tf==PERIOD_M1) return "M1";
   if(tf==PERIOD_M5) return "M5";
   if(tf==PERIOD_M15) return "M15";
   if(tf==PERIOD_M30) return "M30";
   if(tf==PERIOD_H1) return "H1";
   if(tf==PERIOD_H4) return "H4";
   if(tf==PERIOD_D1) return "D1";
   return IntegerToString(tf);
}

//===============================================================================
// CHRONOS ORGAN -- time, session, liquidity season, learned hour expectancy
//===============================================================================
int HT5DetectLiquiditySession(datetime now)
{
   int h=TimeHour(now);
   // Broker clock context, deliberately broad. Learned hourly expectancy later
   // refines broker-specific timing rather than assuming one universal timezone.
   if(h>=7 && h<12) return LIQUIDITY_LONDON;
   if(h>=12 && h<16) return LIQUIDITY_LONDON_NEWYORK_OVERLAP;
   if(h>=16 && h<21) return LIQUIDITY_NEWYORK;
   if(h>=23 || h<7) return LIQUIDITY_ASIA;
   if(h>=21 && h<23) return LIQUIDITY_ROLLOVER;
   return LIQUIDITY_OTHER;
}

string HT5SessionName(int s)
{
   if(s==LIQUIDITY_ASIA) return "ASIA";
   if(s==LIQUIDITY_LONDON) return "LONDON";
   if(s==LIQUIDITY_NEWYORK) return "NEW YORK";
   if(s==LIQUIDITY_LONDON_NEWYORK_OVERLAP) return "LONDON/NY OVERLAP";
   if(s==LIQUIDITY_ROLLOVER) return "ROLLOVER";
   return "OTHER";
}

double HT5LearnedHourQuality(int hour)
{
   hour=MathMax(0,MathMin(23,hour));
   double n=gHT5HourSamples[hour];
   if(n<3.0) return 1.0;
   double e=gHT5HourExpectancyR[hour];
   return HT5Clamp(1.0+0.20*e,0.70,1.25);
}

double HT5SessionBaseQuality(int session)
{
   if(session==LIQUIDITY_LONDON_NEWYORK_OVERLAP) return 1.15;
   if(session==LIQUIDITY_LONDON || session==LIQUIDITY_NEWYORK) return 1.08;
   if(session==LIQUIDITY_ASIA) return 0.92;
   if(session==LIQUIDITY_ROLLOVER) return 0.65;
   return 0.85;
}

void HT5ChronosSense()
{
   datetime now=TimeCurrent();
   gHT5Session=HT5DetectLiquiditySession(now);
   double learned=HT5LearnedHourQuality(TimeHour(now));
   double base=HT5SessionBaseQuality(gHT5Session);
   gHT5SessionQuality=HT5Clamp(base*learned,0.55,1.30);
   if(WhenShouldTheCreaturePreferToHunt==SESSION_TRADE_ALL_MARKET_HOURS) gHT5SessionQuality=MathMax(0.90,gHT5SessionQuality);
   if(WhenShouldTheCreaturePreferToHunt==SESSION_PREFER_LONDON_AND_NEWYORK &&
      !(gHT5Session==LIQUIDITY_LONDON || gHT5Session==LIQUIDITY_NEWYORK || gHT5Session==LIQUIDITY_LONDON_NEWYORK_OVERLAP))
      gHT5SessionQuality*=0.72;
   gHT5SessionState=HT5SessionName(gHT5Session)+" • Q "+DoubleToString(gHT5SessionQuality,2);
   HT5SetOrgan(ORGAN_CHRONOS,HT5Clamp(gHT5SessionQuality/1.15,0.35,1.0),gHT5SessionState);
}

//===============================================================================
// LUNGS -- multi-timeframe live/stable ATR, compression, expansion, vol-of-vol
//===============================================================================
void HT5SenseTimeframe(int idx)
{
   if(idx<0 || idx>=5) return;
   int tf=HT5TimeframeByIndex(idx);
   double live=MathMax(Point,HTExecutionATR(tf,14));
   double stable=MathMax(Point,HTStableATR(tf,14));
   double h=iHigh(Symbol(),tf,0),l=iLow(Symbol(),tf,0),c0=iClose(Symbol(),tf,0),c1=iClose(Symbol(),tf,1);
   double range=MathMax(Point,h-l);
   double v=(c0-iClose(Symbol(),tf,3))/live;
   double pv=(c1-iClose(Symbol(),tf,4))/stable;
   double path=0.0;
   for(int k=0;k<6;k++) path+=MathAbs(iClose(Symbol(),tf,k)-iClose(Symbol(),tf,k+1));
   double efficiency=(path>Point?MathAbs(c0-iClose(Symbol(),tf,6))/path:0.0);
   double emaFast=iMA(Symbol(),tf,9,0,MODE_EMA,PRICE_CLOSE,0);
   double emaSlow=iMA(Symbol(),tf,34,0,MODE_EMA,PRICE_CLOSE,0);
   double slope=(emaFast-emaSlow)/live;
   double hi20=iHigh(Symbol(),tf,iHighest(Symbol(),tf,MODE_HIGH,20,0));
   double lo20=iLow(Symbol(),tf,iLowest(Symbol(),tf,MODE_LOW,20,0));
   double pos=HT5SafeDiv(c0-lo20,MathMax(Point,hi20-lo20));
   double vol0=(double)iVolume(Symbol(),tf,0), volAvg=0.0;
   for(int q=1;q<=20;q++) volAvg+=(double)iVolume(Symbol(),tf,q);
   volAvg/=20.0;

   gHT5TF[idx].tf=tf;
   gHT5TF[idx].atrLive=live;
   gHT5TF[idx].atrStable=stable;
   gHT5TF[idx].rangeATR=range/live;
   gHT5TF[idx].velocityATR=v;
   gHT5TF[idx].accelerationATR=v-pv;
   gHT5TF[idx].efficiency=HT5Clamp(efficiency,0.0,1.0);
   gHT5TF[idx].compression=HT5Clamp(stable/MathMax(live,Point),0.25,2.0);
   gHT5TF[idx].expansion=HT5Clamp(live/MathMax(stable,Point),0.25,3.0);
   gHT5TF[idx].emaSlopeATR=HT5Clamp(slope,-3.0,3.0);
   gHT5TF[idx].locationInRange=HT5Clamp(pos,0.0,1.0);
   gHT5TF[idx].volumeRatio=HT5Clamp(HT5SafeDiv(vol0,MathMax(1.0,volAvg)),0.0,3.0);
   gHT5TF[idx].direction=HT5Sign(0.60*slope+0.40*v);
   gHT5TF[idx].barTime=iTime(Symbol(),tf,0);
}

void HT5LungsSense()
{
   for(int i=0;i<5;i++) HT5SenseTimeframe(i);
   double live=MathMax(Point,gATRLive14), stable=MathMax(Point,gATRStable14);
   double ratio=live/stable;
   double surprise=MathAbs(ratio-1.0);
   gHT5VolOfVol=0.94*gHT5VolOfVol+0.06*surprise;
   gHT5VolatilityPressure=HT5Clamp((ratio-0.75)/0.75,0.0,1.5);
   RefreshRates();
   gHT5SpreadATR=HT5SafeDiv(MathMax(0.0,Ask-Bid),live);
   double spreadHealth=1.0-HT5Clamp(gHT5SpreadATR/0.12,0.0,1.0);
   double consistency=1.0-HT5Clamp(gHT5VolOfVol/0.35,0.0,1.0);
   double health=0.45*spreadHealth+0.35*consistency+0.20*HT5Clamp(ratio/1.5,0.0,1.0);
   string state=(ratio>1.15?"LUNGS EXPANDING":(ratio<0.85?"LUNGS COMPRESSED":"LUNGS BALANCED"));
   state+=" • "+DoubleToString(live/Point,1)+"pt";
   HT5SetOrgan(ORGAN_LUNGS,health,state);
}

//===============================================================================
// HEART -- tick flow, velocity, acceleration, jerk, entropy and cadence
//===============================================================================
double HT5TickEntropy()
{
   if(gMDRTickCount<8) return 1.0;
   int n=MathMin(gMDRTickCount,MathMin(96,MarketDNARhythmTickWindow));
   int up=0,down=0,flat=0;
   for(int i=1;i<n;i++)
   {
      int a=(gMDRTickHead-1-i+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      int b=(a-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      double d=gMDRTickPrice[a]-gMDRTickPrice[b];
      if(d>Point*0.1) up++; else if(d<-Point*0.1) down++; else flat++;
   }
   double total=MathMax(1.0,(double)(up+down+flat));
   double p1=up/total,p2=down/total,p3=flat/total;
   double h=0.0;
   if(p1>0.0) h-=p1*MathLog(p1);
   if(p2>0.0) h-=p2*MathLog(p2);
   if(p3>0.0) h-=p3*MathLog(p3);
   return HT5Clamp(h/MathLog(3.0),0.0,1.0);
}

double HT5TickJerk()
{
   if(gMDRTickCount<12) return 0.0;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   int h=gMDRTickHead;
   int a=(h-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   int b=(h-4+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   int c=(h-7+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   int d=(h-10+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   double v1=(gMDRTickPrice[a]-gMDRTickPrice[b])/atr;
   double v2=(gMDRTickPrice[b]-gMDRTickPrice[c])/atr;
   double v3=(gMDRTickPrice[c]-gMDRTickPrice[d])/atr;
   return HT5Clamp((v1-v2)-(v2-v3),-2.0,2.0);
}

void HT5HeartSense()
{
   gHT5FlowEntropy=HT5TickEntropy();
   gHT5TickJerkATR=HT5TickJerk();
   double organization=1.0-gHT5FlowEntropy;
   double movement=HT5Clamp(MathAbs(gMDRhythmForce),0.0,1.0);
   double cadence=HT5Clamp(gMDRhythmCadence,0.0,1.5)/1.5;
   double health=0.35*organization+0.35*movement+0.30*cadence;
   gHT5Heartbeat=0.90*gHT5Heartbeat+0.10*(MathAbs(gMDRhythmScore)+0.25*MathAbs(gHT5TickJerkATR));
   string state="HEART "+DoubleToString(gMDRhythmScore,2)+" • ENT "+DoubleToString(gHT5FlowEntropy,2)+" • J "+DoubleToString(gHT5TickJerkATR,2);
   HT5SetOrgan(ORGAN_HEART,health,state);
}

//===============================================================================
// SKELETON -- structure, BOS, route and multi-scale channel agreement
//===============================================================================
void HT5SkeletonSense()
{
   int agree=0;
   double signedCore=0.0;
   if(MathAbs(gMDStructureATR)>0.02){ signedCore+=gMDStructureATR; agree++; }
   if(MathAbs(gMDBOSATR)>0.02){ signedCore+=gMDBOSATR; agree++; }
   if(MathAbs(gMDRouteATR)>0.02){ signedCore+=gMDRouteATR; agree++; }
   if(MathAbs(gMDChannelATR)>0.02){ signedCore+=gMDChannelATR*gHT5ChannelAuthorityScale; agree++; }
   for(int i=1;i<5;i++)
   {
      if(gHT5TF[i].direction!=DIR_FLAT)
      { signedCore+=0.06*gHT5TF[i].direction*MathMin(1.0,MathAbs(gHT5TF[i].emaSlopeATR)); agree++; }
   }
   double integrity=HT5Clamp((double)agree/7.0,0.0,1.0);
   if(gPyrRouteActive && gPyrRouteInvalidTicks>0) integrity*=0.70;
   string state="SKELETON "+(HT5Sign(signedCore)==DIR_BUY?"BULL":(HT5Sign(signedCore)==DIR_SELL?"BEAR":"NEUTRAL"))+" • "+IntegerToString(agree)+" BONES";
   HT5SetOrgan(ORGAN_SKELETON,integrity,state);
}

//===============================================================================
// EYES -- location-field physics across FVG/OB/day/channel/rails/stations
//===============================================================================
double HT5Attraction(double price,double level,double atr,double radiusATR)
{
   if(price<=0.0 || level<=0.0 || atr<=0.0) return 0.0;
   double d=MathAbs(price-level)/atr;
   double r=MathMax(0.01,radiusATR);
   return HT5Clamp(1.0-d/r,0.0,1.0);
}

void HT5EyesSense()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid();
   gHT5Location.dayLowField=HT5Attraction(p,gMDDayLow,atr,1.25);
   gHT5Location.dayHighField=HT5Attraction(p,gMDDayHigh,atr,1.25);
   gHT5Location.channelSupportField=HT5Attraction(p,gMDChannelSupportNow,atr,1.50);
   gHT5Location.channelResistanceField=HT5Attraction(p,gMDChannelResistanceNow,atr,1.50);
   gHT5Location.blackRailField=(gMDTriggerRailValid?HT5Attraction(p,gMDTriggerRailNow,atr,0.90):0.0);
   gHT5Location.redRailField=HT5Attraction(p,gMDChannelResistanceNow,atr,1.00);
   gHT5Location.goldRailField=HT5Attraction(p,gMDChannelSupportNow,atr,1.00);
   if(gMDFVGReady && gMDFVGTop>gMDFVGBot)
   {
      double fmid=(gMDFVGTop+gMDFVGBot)*0.5;
      double width=MathMax(atr*0.05,gMDFVGTop-gMDFVGBot);
      gHT5Location.fvgField=HT5Clamp(1.0-MathAbs(p-fmid)/(width+atr*0.20),0.0,1.0);
   }
   else gHT5Location.fvgField=0.0;
   double obMid=0.0;
   if(gMDDesiredDirection==DIR_BUY && gMDOracleBuyOBTop>gMDOracleBuyOBBot) obMid=(gMDOracleBuyOBTop+gMDOracleBuyOBBot)*0.5;
   if(gMDDesiredDirection==DIR_SELL && gMDOracleSellOBTop>gMDOracleSellOBBot) obMid=(gMDOracleSellOBTop+gMDOracleSellOBBot)*0.5;
   gHT5Location.obField=HT5Attraction(p,obMid,atr,0.80);
   double station=(gMDDesiredDirection==DIR_BUY?gPyrBuyStation:gPyrSellStation);
   gHT5Location.stationField=HT5Attraction(p,station,atr,0.90);
   gHT5Location.reclaimField=HT5Attraction(p,gPyrActiveReclaimLevel,atr,0.80);
   double swingPool=(gMDDesiredDirection==DIR_BUY?gPyrLow1:gPyrHigh1);
   gHT5Location.liquidityPoolField=HT5Attraction(p,swingPool,atr,1.10);

   double support=gHT5Location.dayLowField+gHT5Location.channelSupportField+gHT5Location.goldRailField;
   double resistance=gHT5Location.dayHighField+gHT5Location.channelResistanceField+gHT5Location.redRailField;
   double inst=(gHT5Location.fvgField+gHT5Location.obField+gHT5Location.stationField+gHT5Location.reclaimField)*0.25;
   gHT5Location.netDirectionalField=HT5Clamp((support-resistance)/3.0 + gMDDesiredDirection*0.30*inst,-1.5,1.5);
   gHT5Location.state="FIELD "+DoubleToString(gHT5Location.netDirectionalField,2)+" • FVG "+DoubleToString(gHT5Location.fvgField,2)+" • OB "+DoubleToString(gHT5Location.obField,2);
   double health=HT5Clamp(0.35+0.25*MathMax(gHT5Location.fvgField,gHT5Location.obField)+0.20*MathMax(gHT5Location.channelSupportField,gHT5Location.channelResistanceField)+0.20*MathMax(gHT5Location.dayLowField,gHT5Location.dayHighField),0.0,1.0);
   HT5SetOrgan(ORGAN_EYES,health,gHT5Location.state);
}

//===============================================================================
// ORACLE / REGIME -- accumulation/expansion/distribution context; SEQUENCE owns campaign phase 0-5
//===============================================================================
void HT5OracleSense()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double range15=MathMax(Point,iHigh(Symbol(),PERIOD_M15,iHighest(Symbol(),PERIOD_M15,MODE_HIGH,24,0))-
                               iLow(Symbol(),PERIOD_M15,iLowest(Symbol(),PERIOD_M15,MODE_LOW,24,0)));
   double realized=range15/atr;
   double expansion=0.45*gHT5TF[2].expansion+0.30*MathAbs(gMDRhythmForce)+0.25*MathAbs(gMDRhythmScore);
   double compression=HT5Clamp(2.0-realized/4.0,0.0,1.5)+HT5Clamp(1.0-gHT5TF[2].expansion,0.0,1.0);
   double extreme=MathMax(gHT5Location.dayLowField,gHT5Location.dayHighField);
   double rejection=MathAbs(gMDInflectionATR)+MathAbs(gMDAcceptanceATR);

   if(rejection>0.45 && extreme>0.45) gHT5BodyPhase=BODY_REVERSAL;
   else if(expansion>0.75) gHT5BodyPhase=BODY_EXPANSION;
   else if(compression>1.05 && extreme<0.45) gHT5BodyPhase=BODY_ACCUMULATION;
   else if(extreme>0.55 && expansion<0.55) gHT5BodyPhase=BODY_DISTRIBUTION;
   else if(gMDRhythmMaturity>0.85 && expansion<0.45) gHT5BodyPhase=BODY_EXHAUSTION;
   else gHT5BodyPhase=BODY_COMPRESSION;

   if(gHT5BodyPhase==BODY_EXPANSION) gHT5PhaseState="EXPANSION";
   else if(gHT5BodyPhase==BODY_ACCUMULATION) gHT5PhaseState="ACCUMULATION";
   else if(gHT5BodyPhase==BODY_DISTRIBUTION) gHT5PhaseState="DISTRIBUTION";
   else if(gHT5BodyPhase==BODY_EXHAUSTION) gHT5PhaseState="EXHAUSTION";
   else if(gHT5BodyPhase==BODY_REVERSAL) gHT5PhaseState="REVERSAL";
   else gHT5PhaseState="COMPRESSION";

   double phaseHealth=(gHT5BodyPhase==BODY_EXPANSION?1.0:(gHT5BodyPhase==BODY_REVERSAL?0.85:0.70));
   HT5SetOrgan(ORGAN_ORACLE,phaseHealth,"ORACLE "+gHT5PhaseState+" • "+MarketDNAOraclePhaseName());
}

//===============================================================================
// MEMORY FEATURES -- 32-dimensional living fingerprint
//===============================================================================
void HT5BuildFeatureVector()
{
   gHT5FeatureNow[0]=HT5Clamp(gMDStructureATR,-2.0,2.0);
   gHT5FeatureNow[1]=HT5Clamp(gMDBOSATR,-2.0,2.0);
   gHT5FeatureNow[2]=HT5Clamp(gMDPressureATR,-2.0,2.0);
   gHT5FeatureNow[3]=HT5Clamp(gMDRouteATR,-2.0,2.0);
   gHT5FeatureNow[4]=HT5Clamp(gMDChannelATR,-2.0,2.0);
   gHT5FeatureNow[5]=HT5Clamp(gMDRhythmScore,-1.5,1.5);
   gHT5FeatureNow[6]=HT5Clamp(gMDRhythmForce,-1.5,1.5);
   gHT5FeatureNow[7]=HT5Clamp(gMDRhythmPullback,0.0,2.0);
   gHT5FeatureNow[8]=HT5Clamp(gMDRhythmCadence,0.0,2.0);
   gHT5FeatureNow[9]=HT5Clamp(gHT5TickJerkATR,-2.0,2.0);
   gHT5FeatureNow[10]=HT5Clamp(gHT5FlowEntropy,0.0,1.0);
   gHT5FeatureNow[11]=HT5Clamp(gMDDayRangePosition,0.0,1.0);
   gHT5FeatureNow[12]=HT5Clamp(gHT5Location.fvgField,0.0,1.0);
   gHT5FeatureNow[13]=HT5Clamp(gHT5Location.obField,0.0,1.0);
   gHT5FeatureNow[14]=HT5Clamp(gHT5Location.stationField,0.0,1.0);
   gHT5FeatureNow[15]=HT5Clamp(gHT5Location.reclaimField,0.0,1.0);
   gHT5FeatureNow[16]=HT5Clamp(gHT5Location.netDirectionalField,-1.5,1.5);
   gHT5FeatureNow[17]=HT5Clamp(gATRLive14/MathMax(Point,gATRStable14),0.25,3.0);
   gHT5FeatureNow[18]=HT5Clamp(gHT5VolOfVol,0.0,1.0);
   gHT5FeatureNow[19]=HT5Clamp(gHT5SpreadATR,0.0,0.5);
   gHT5FeatureNow[20]=HT5Clamp(gHT5SessionQuality,0.0,1.5);
   gHT5FeatureNow[21]=HT5Clamp(gMDOracleMicroTrendATR,-2.0,2.0);
   gHT5FeatureNow[22]=HT5Clamp(gMDOracleOBFVGATR,-2.0,2.0);
   gHT5FeatureNow[23]=HT5Clamp(gMDOraclePhaseATR,-2.0,2.0);
   gHT5FeatureNow[24]=HT5Clamp(gMDInflectionATR,-2.0,2.0);
   gHT5FeatureNow[25]=HT5Clamp(gMDAcceptanceATR,-2.0,2.0);
   gHT5FeatureNow[26]=HT5Clamp(gMDUncertaintyATR,0.0,3.0);
   gHT5FeatureNow[27]=HT5Clamp(gMDExpectedAdverseATR,0.0,3.0);
   gHT5FeatureNow[28]=HT5Clamp(gCompoundProgress/100.0,-1.0,2.0);
   gHT5FeatureNow[29]=HT5Clamp(HT5SafeDiv(OpenCampaignRiskMoney(),MathMax(0.01,SelectedRiskMoney())),0.0,5.0);
   gHT5FeatureNow[30]=HT5Clamp((double)TradeCount()/MathMax(1,MarketDNAMaxCars),0.0,1.0);
   gHT5FeatureNow[31]=HT5Clamp(gHT5PatternPredictionR,-3.0,3.0);

   for(int i=0;i<32;i++)
   {
      double d=gHT5FeatureNow[i]-gHT5FeatureEWMA[i];
      gHT5FeatureEWMA[i]+=0.03*d;
      gHT5FeatureVar[i]=0.97*gHT5FeatureVar[i]+0.03*d*d;
   }
}

double HT5PatternDistance(int idx)
{
   if(idx<0 || idx>=256 || !gHT5Patterns[idx].used) return 1e9;
   double sum=0.0,weight=0.0;
   for(int f=0;f<32;f++)
   {
      double scale=MathSqrt(MathMax(0.01,gHT5FeatureVar[f]+0.04));
      double d=(gHT5FeatureNow[f]-gHT5PatternFeature[idx][f])/scale;
      double w=(f<=9?1.25:(f<=19?1.00:0.85));
      sum+=w*d*d; weight+=w;
   }
   return MathSqrt(sum/MathMax(1.0,weight));
}

void HT5PredictFromPatternMemory()
{
   double num=0.0,den=0.0; int used=0;
   int maxN=(HowDeepShouldMarketMemoryBecome==DATA_STANDARD_64_FEATURES?64:(HowDeepShouldMarketMemoryBecome==DATA_MAXIMUM_256_FEATURES?256:128));
   for(int i=0;i<256;i++)
   {
      if(!gHT5Patterns[i].used) continue;
      double d=HT5PatternDistance(i);
      if(d>3.0) continue;
      double w=MathExp(-0.5*d*d/0.90);
      num+=w*gHT5Patterns[i].outcomeR;
      den+=w; used++;
      if(used>=maxN) break;
   }
   gHT5PatternPredictionR=(den>0.0001?num/den:0.0);
   gHT5PatternConfidence=HT5Clamp(den/MathMax(3.0,(double)MathMin(20,used)),0.0,1.0);
   gHT5MemoryState="PATTERN "+IntegerToString(gHT5PatternCount)+" • PRED "+DoubleToString(gHT5PatternPredictionR,2)+"R • C "+DoubleToString(gHT5PatternConfidence,2);
   HT5SetOrgan(ORGAN_MEMORY,HT5Clamp(0.25+0.75*gHT5PatternConfidence,0.20,1.0),gHT5MemoryState);
}

void HT5StoreResolvedPattern(double outcomeR,double mfeR,double maeR,int maxCars)
{
   int idx=gHT5PatternHead%256;
   gHT5Patterns[idx].used=true;
   gHT5Patterns[idx].when=TimeCurrent();
   gHT5Patterns[idx].direction=gEvoCampaignDirection;
   gHT5Patterns[idx].source=(gHT5CampaignEntrySource>0?gHT5CampaignEntrySource:(int)gPyrSignalSource);
   for(int f=0;f<32;f++) gHT5PatternFeature[idx][f]=gHT5FeatureNow[f];
   gHT5Patterns[idx].outcomeR=outcomeR;
   gHT5Patterns[idx].mfeR=mfeR;
   gHT5Patterns[idx].maeR=maeR;
   gHT5Patterns[idx].maxCars=maxCars;
   gHT5PatternHead=(idx+1)%256;
   gHT5PatternCount=MathMin(256,gHT5PatternCount+1);
}

//===============================================================================
// BRAIN -- integrates organs while preserving Directional Spine as side owner
//===============================================================================
void HT5BrainSense()
{
   double structure=(0.45*gMDStructureATR+0.35*gMDBOSATR+0.20*gMDRouteATR)*HT5OrganReliabilityValue(ORGAN_SKELETON);
   double channel=gMDChannelATR*gHT5ChannelAuthorityScale*HT5OrganReliabilityValue(ORGAN_SKELETON);
   double flow=(0.45*gMDPressureATR+0.35*gMDRhythmScore+0.20*gMDRhythmForce)*HT5OrganReliabilityValue(ORGAN_HEART);
   double location=gHT5Location.netDirectionalField*HT5OrganReliabilityValue(ORGAN_EYES);
   double oracle=(0.35*gMDOracleMicroTrendATR+0.35*gMDOracleOBFVGATR+0.30*gMDOraclePhaseATR)*HT5OrganReliabilityValue(ORGAN_ORACLE);
   double memory=(0.55*gHT5PatternPredictionR*gHT5PatternConfidence+0.45*gHT5DeepPredictionR*gHT5DeepPredictionConfidence)*0.25*HT5OrganReliabilityValue(ORGAN_MEMORY);
   double uncertainty=MathSqrt(MathMax(0.0001,gMDErrorVariance))+0.35*gHT5VolOfVol+0.20*gHT5FlowEntropy;

   gHT5Brain.structuralPotential=structure;
   gHT5Brain.channelPotential=channel;
   gHT5Brain.flowPotential=flow;
   gHT5Brain.locationPotential=location;
   gHT5Brain.oraclePotential=oracle;
   gHT5Brain.memoryPotential=memory;
   gHT5Brain.uncertainty=uncertainty;

   // Physical normalized displacement estimate. No organ may independently
   // own direction; the primary spine/channel structure remains authoritative.
   double expected=0.30*structure+0.22*channel+0.20*flow+0.12*location+0.10*oracle+0.06*memory;
   double adverse=MathMax(0.05,gMDExpectedAdverseATR)*(1.0+0.35*uncertainty);
   int dir=(gMDDirectionalDirection!=DIR_FLAT?gMDDirectionalDirection:HT5Sign(expected));
   if(gMDChannelBounceDirection!=DIR_FLAT) dir=gMDChannelBounceDirection;
   if(gMDTriggerRailBreakDirection!=DIR_FLAT) dir=gMDTriggerRailBreakDirection;
   if(gMDTriggerRailBounceDirection!=DIR_FLAT) dir=gMDTriggerRailBounceDirection;

   int agreement=0;
   if(dir*structure>0.02) agreement++;
   if(dir*channel>0.02) agreement++;
   if(dir*flow>0.02) agreement++;
   if(dir*location>0.02) agreement++;
   if(dir*oracle>0.02) agreement++;
   if(dir*memory>0.02) agreement++;

   gHT5Brain.expectedATR=expected;
   gHT5Brain.adverseATR=adverse;
   gHT5Brain.direction=dir;
   gHT5Brain.agreement=agreement;
   double continuation=HT5Clamp(0.50+0.12*dir*expected+0.08*agreement-0.10*uncertainty,0.0,1.0);
   double reversal=HT5Clamp(0.15+0.25*MathAbs(gMDInflectionATR)+0.20*MathAbs(gMDAcceptanceATR)+0.15*MathMax(gHT5Location.dayLowField,gHT5Location.dayHighField),0.0,1.0);
   gHT5Brain.continuationProbability=continuation;
   gHT5Brain.reversalProbability=reversal;
   gHT5Brain.state="BRAIN "+(dir==DIR_BUY?"BUY":(dir==DIR_SELL?"SELL":"FLAT"))+" • "+IntegerToString(agreement)+"/6 • E "+DoubleToString(expected,2)+"A";
   double health=HT5Clamp(0.20+0.10*agreement+0.25*(1.0-HT5Clamp(uncertainty/1.5,0.0,1.0)),0.0,1.0);
   HT5SetOrgan(ORGAN_BRAIN,health,gHT5Brain.state);
}

//===============================================================================
// IMMUNE SYSTEM -- one campaign risk budget, margin, locked-profit accounting
//===============================================================================
double HT5ProjectedProfitAtPrice(int dir,double stopPrice)
{
   double total=0.0;
   double tickSize=TickSizePrice();
   double tickValue=MarketInfo(Symbol(),MODE_TICKVALUE);
   if(tickSize<=0.0 || tickValue<=0.0) return 0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if((dir==DIR_BUY && t!=OP_BUY)||(dir==DIR_SELL && t!=OP_SELL)) continue;
      double move=(dir==DIR_BUY?stopPrice-OrderOpenPrice():OrderOpenPrice()-stopPrice);
      total+=(move/tickSize)*tickValue*OrderLots()+OrderSwap()+OrderCommission();
   }
   return total;
}

double HT5LockedProfitFromStops(int dir)
{
   double lock=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if((dir==DIR_BUY && t!=OP_BUY)||(dir==DIR_SELL && t!=OP_SELL)) continue;
      double sl=OrderStopLoss(); if(sl<=0.0) sl=SovStoredStop(OrderTicket());
      if(sl<=0.0) continue;
      double p=HT5ProjectedProfitAtPrice(dir,sl);
      if(p>lock) lock=p;
   }
   return MathMax(0.0,lock);
}

void HT5ImmuneSense()
{
   double cap=AccountRiskBase()*MaximumCampaignRiskPercent/100.0;
   double open=OpenCampaignRiskMoney();
   double pending=MarketDNAPendingRiskMoney();
   int dir=(TradeCount()>0?(int)DetectDirection():gHT5Brain.direction);
   double locked=(dir!=DIR_FLAT?HT5LockedProfitFromStops(dir):0.0);
   double margin=AccountMargin();
   double equity=MathMax(0.01,AccountEquity());
   double marginPct=100.0*margin/equity;
   double freeRisk=MathMax(0.0,cap-open-pending);

   gHT5Immune.selectedRisk=SelectedRiskMoney();
   gHT5Immune.campaignRiskCap=cap;
   gHT5Immune.openRisk=open;
   gHT5Immune.pendingRisk=pending;
   gHT5Immune.lockedProfit=locked;
   gHT5Immune.marginUsedPct=marginPct;
   gHT5Immune.freeRiskMoney=freeRisk;
   gHT5Immune.adverseExcursionR=(gEvoCampaignActive?gEvoMaxAdverseR:0.0);
   gHT5Immune.favorableExcursionR=(gEvoCampaignActive?gEvoMaxFavorableR:0.0);
   gHT5Immune.newRiskAllowed=(freeRisk>0.01 && !gCompoundEntryFreeze);
   gHT5Immune.emergency=(AccountEquity()<=0.0 || marginPct>85.0);
   double riskHealth=1.0-HT5Clamp((open+pending)/MathMax(0.01,cap),0.0,1.0);
   double marginHealth=1.0-HT5Clamp(marginPct/80.0,0.0,1.0);
   double health=0.60*riskHealth+0.40*marginHealth;
   gHT5Immune.state="IMMUNE RISK $"+DoubleToString(open+pending,2)+"/$"+DoubleToString(cap,2)+" • LOCK $"+DoubleToString(locked,2);
   HT5SetOrgan(ORGAN_IMMUNE,health,gHT5Immune.state);
}

//===============================================================================
// METABOLISM -- compound target forecasting and capital-efficiency demand
//===============================================================================
double HT5MoneyPerPriceUnitPerLot()
{
   double tv=MarketInfo(Symbol(),MODE_TICKVALUE);
   double ts=TickSizePrice();
   if(tv<=0.0 || ts<=0.0) return 0.0;
   return tv/ts;
}

double HT5ProjectedBasketAtPrice(int dir,double price)
{
   double k=HT5MoneyPerPriceUnitPerLot();
   if(k<=0.0) return 0.0;
   double sum=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if((dir==DIR_BUY && t!=OP_BUY)||(dir==DIR_SELL && t!=OP_SELL)) continue;
      sum+=(dir==DIR_BUY?price-OrderOpenPrice():OrderOpenPrice()-price)*k*OrderLots()+OrderSwap()+OrderCommission();
   }
   return sum;
}

void HT5MetabolismSense()
{
   gHT5Metabolism.base=gCompoundAnchor;
   gHT5Metabolism.target=gCompoundTarget;
   gHT5Metabolism.remainingMoney=MathMax(0.0,gCompoundLiveRemaining);
   gHT5Metabolism.remainingPercent=MathMax(0.0,gCompoundRequiredPercent);
   int dir=(gMDRLadderActive?gMDRLadderDirection:gHT5Brain.direction);
   double targetPrice=0.0;
   if(gMDRLadderActive) targetPrice=gMDRLadderTarget;
   else if(gPyrTarget>0.0) targetPrice=gPyrTarget;
   else if(dir!=DIR_FLAT) targetPrice=HT5Mid()+dir*MathMax(Point,HTExecutionATR(SignalTF,14));
   gHT5Metabolism.projectedBasketAt1R=(dir!=DIR_FLAT && targetPrice>0.0?HT5ProjectedBasketAtPrice(dir,targetPrice):0.0);
   double red=(dir==DIR_BUY?gMDChannelResistanceNow:gMDChannelSupportNow);
   gHT5Metabolism.projectedBasketAtRed=(dir!=DIR_FLAT && red>0.0?HT5ProjectedBasketAtPrice(dir,red):0.0);
   gHT5Metabolism.requiredRMultiple=HT5SafeDiv(gHT5Metabolism.remainingMoney,MathMax(0.01,SelectedRiskMoney()));
   gHT5Metabolism.riskUtilization=HT5SafeDiv(gHT5Immune.openRisk+gHT5Immune.pendingRisk,MathMax(0.01,gHT5Immune.campaignRiskCap));
   gHT5Metabolism.capitalEfficiency=HT5SafeDiv(MathMax(0.0,BasketProfit()),MathMax(0.01,gHT5Immune.openRisk+SelectedRiskMoney()));
   int baseCars=MathMax(1,gMDDesiredCars);
   if(gHT5Metabolism.projectedBasketAt1R>=gHT5Metabolism.remainingMoney && gHT5Metabolism.remainingMoney>0.0) baseCars=TradeCount();
   gHT5Metabolism.desiredCars=MathMin(MarketDNAMaxCars,MathMax(1,baseCars));
   gHT5MetabolicState="METABOLISM $"+DoubleToString(gHT5Metabolism.remainingMoney,2)+" LEFT • NEED "+DoubleToString(gHT5Metabolism.requiredRMultiple,2)+"R";
   HT5SetOrgan(ORGAN_METABOLISM,HT5Clamp(1.0-gHT5Metabolism.riskUtilization*0.50,0.20,1.0),gHT5MetabolicState);
}

//===============================================================================
// SHADOW GENOMES -- observe alternative physiology, never execute orders
//===============================================================================
void HT5InitializeShadowGenomes()
{
   string names[7]={"FORTRESS","BALANCED","RHYTHM","FVG-PRECISION","SONIC","CHANNEL","CURRENT"};
   for(int i=0;i<7;i++)
   {
      gHT5Shadow[i].name=names[i];
      gHT5Shadow[i].rhythmFloor=MarketDNARhythmLaunchThreshold;
      gHT5Shadow[i].fvgToleranceMult=1.0;
      gHT5Shadow[i].sonicStageOffset=0.0;
      gHT5Shadow[i].riskReuse=0.85;
      gHT5Shadow[i].channelAuthority=1.0;
      gHT5Shadow[i].directionFloor=MarketDNADirectionFloorATR;
      gHT5Shadow[i].fitnessR=0.0;
      gHT5Shadow[i].samples=0;
   }
   gHT5Shadow[0].rhythmFloor+=0.10; gHT5Shadow[0].riskReuse=0.60; gHT5Shadow[0].directionFloor+=0.05;
   gHT5Shadow[1].riskReuse=0.78;
   gHT5Shadow[2].rhythmFloor-=0.04; gHT5Shadow[2].riskReuse=0.72;
   gHT5Shadow[3].fvgToleranceMult=0.70; gHT5Shadow[3].riskReuse=0.75;
   gHT5Shadow[4].sonicStageOffset=-0.03; gHT5Shadow[4].riskReuse=0.92;
   gHT5Shadow[5].channelAuthority=1.25; gHT5Shadow[5].riskReuse=0.75;
   gHT5Shadow[6].riskReuse=0.85;
}

double HT5ShadowHypotheticalQuality(int idx)
{
   if(idx<0 || idx>=7) return 0.0;
   int dir=(gHT5Brain.direction==DIR_FLAT?gMDDesiredDirection:gHT5Brain.direction);
   if(dir==DIR_FLAT) return 0.0;
   double rhythm=dir*gMDRhythmScore-gHT5Shadow[idx].rhythmFloor;
   double fvg=gHT5Location.fvgField/gHT5Shadow[idx].fvgToleranceMult;
   double channel=dir*gMDChannelATR*gHT5Shadow[idx].channelAuthority;
   double direction=dir*gHT5Brain.expectedATR-gHT5Shadow[idx].directionFloor;
   double growth=(1.0-MathMax(0.0,gHT5Shadow[idx].sonicStageOffset))*gHT5Shadow[idx].riskReuse;
   return 0.28*rhythm+0.24*fvg+0.22*channel+0.18*direction+0.08*growth;
}

void HT5UpdateShadowGenomes(double realizedR)
{
   if(HowShouldTheGenomeEvolve<EVOLUTION_SHADOW_GENOMES_AND_ROLLBACK) return;
   for(int i=0;i<7;i++)
   {
      double q=HT5ShadowHypotheticalQuality(i);
      double hypothetical=realizedR*(0.75+0.25*HT5Clamp(q+0.50,0.0,1.5));
      gHT5Shadow[i].samples++;
      double a=2.0/(MathMin(40,gHT5Shadow[i].samples)+1.0);
      gHT5Shadow[i].fitnessR=(1.0-a)*gHT5Shadow[i].fitnessR+a*hypothetical;
   }
}

int HT5BestShadow()
{
   int best=0;
   for(int i=1;i<7;i++) if(gHT5Shadow[i].fitnessR>gHT5Shadow[best].fitnessR) best=i;
   return best;
}

//===============================================================================
// AUTOPSY / DEEP COLLECTION -- learns by source, session, hour, phase and pattern
//===============================================================================
void HT5UpdateEWMAStat(double &samples,double &expectancy,double r)
{
   samples+=1.0;
   double a=2.0/(MathMin(50.0,samples)+1.0);
   expectancy=(1.0-a)*expectancy+a*r;
}

void HT5AutopsyResolvedCampaign(double net,double r,int errorClass)
{
   gHT5LastCampaignR=r;
   int src=gHT5CampaignEntrySource;
   double totalW=MathMax(0.0,gHT5CampaignSourceTotalWeight);
   bool credited=false;
   for(int ss=1;ss<32;ss++)
   {
      double sw=gHT5CampaignSourceWeight[ss];
      if(sw<=0.0) continue;
      double frac=(totalW>0.0?sw/totalW:1.0);
      double effectiveR=r; // each source learns campaign quality; contribution controls learning speed.
      gHT5SourceSamples[ss]+=MathMax(0.10,frac);
      double a=(2.0/(MathMin(50.0,gHT5SourceSamples[ss])+1.0))*MathMax(0.20,MathMin(1.0,frac*2.0));
      gHT5SourceExpectancyR[ss]=(1.0-a)*gHT5SourceExpectancyR[ss]+a*effectiveR;
      if(r>0.0) gHT5SourceWins[ss]+=frac; else if(r<0.0) gHT5SourceLosses[ss]+=frac;
      gHT5CampaignReliability[ss]=HT5Clamp(0.50+0.15*gHT5SourceExpectancyR[ss],0.15,0.95);
      credited=true;
   }
   if(!credited && src>PYR_SOURCE_NONE && src<32)
   {
      HT5UpdateEWMAStat(gHT5SourceSamples[src],gHT5SourceExpectancyR[src],r);
      if(r>0.0) gHT5SourceWins[src]++; else if(r<0.0) gHT5SourceLosses[src]++;
      gHT5CampaignReliability[src]=HT5Clamp(0.50+0.15*gHT5SourceExpectancyR[src],0.15,0.95);
   }
   int ses=MathMax(0,MathMin(5,gHT5Session));
   HT5UpdateEWMAStat(gHT5SessionSamples[ses],gHT5SessionExpectancyR[ses],r);
   int hr=MathMax(0,MathMin(23,TimeHour(gEvoCampaignStartTime>0?gEvoCampaignStartTime:TimeCurrent())));
   HT5UpdateEWMAStat(gHT5HourSamples[hr],gHT5HourExpectancyR[hr],r);
   int ph=MathMax(0,MathMin(5,gHT5BodyPhase));
   HT5UpdateEWMAStat(gHT5PhaseSamples[ph],gHT5PhaseExpectancyR[ph],r);
   HT5StoreResolvedPattern(r,gEvoMaxFavorableR,gEvoMaxAdverseR,gEvoPeakCars);
   HT5UpdateShadowGenomes(r);

   // Genome mutation pressure is evidence, not immediate mutation authority.
   double lossPressure=(r<0.0?MathMin(2.0,MathAbs(r)):0.0);
   double repeat=(errorClass==EVO_ERROR_DIRECTION?gEvoDirectionLosses:
                 (errorClass==EVO_ERROR_LOCATION?gEvoLocationLosses:
                 (errorClass==EVO_ERROR_TIMING?gEvoTimingLosses:gEvoExposureLosses)));
   gHT5GenomeMutationPressure=0.85*gHT5GenomeMutationPressure+0.15*lossPressure*MathMin(1.5,repeat/3.0);
   HT5SetOrgan(ORGAN_GENOME,HT5Clamp(0.60+0.20*gEvoFitnessR-0.10*gHT5GenomeMutationPressure,0.15,1.0),
               "GENOME G"+IntegerToString(gEvoGenome)+" • FIT "+DoubleToString(gEvoFitnessR,2)+"R");
}

//===============================================================================
// HOSPITAL -- gate telemetry and bounded soft-deadlock recovery
//===============================================================================
int HT5GateFromReason(string reason)
{
   if(StringFind(reason,"MASTER")>=0) return GATE_MASTER;
   if(StringFind(reason,"TIME")>=0 || StringFind(reason,"START")>=0) return GATE_TIME;
   if(StringFind(reason,"CHANNEL")>=0) return GATE_CHANNEL;
   if(StringFind(reason,"DAY")>=0) return GATE_DAY_EXTREME;
   if(StringFind(reason,"FVG")>=0) return GATE_FVG;
   if(StringFind(reason,"SPINE")>=0 || StringFind(reason,"DIRECTION")>=0) return GATE_DIRECTION;
   if(StringFind(reason,"RHYTHM")>=0) return GATE_RHYTHM;
   if(StringFind(reason,"EDGE")>=0) return GATE_EDGE;
   if(StringFind(reason,"THESIS")>=0) return GATE_THESIS;
   if(StringFind(reason,"RISK")>=0 || StringFind(reason,"LOT")>=0) return GATE_RISK;
   if(StringFind(reason,"MARGIN")>=0) return GATE_MARGIN;
   if(StringFind(reason,"BROKER")>=0 || StringFind(reason,"ORDER")>=0) return GATE_BROKER;
   if(StringFind(reason,"COMPOUND")>=0 || StringFind(reason,"PEAK")>=0) return GATE_COMPOUND;
   if(StringFind(reason,"LADDER")>=0) return GATE_RLADDER;
   if(StringFind(reason,"PHASE")>=0) return GATE_PHASE;
   if(StringFind(reason,"SEQUENCE")>=0 || StringFind(reason,"MOVE")>=0 || StringFind(reason,"PAUSE")>=0) return GATE_SEQUENCE;
   return GATE_NONE;
}

bool HT5GateIsHard(int gate)
{
   return (gate==GATE_MASTER || gate==GATE_TIME || gate==GATE_DAY_EXTREME || gate==GATE_RISK || gate==GATE_MARGIN || gate==GATE_BROKER || gate==GATE_COMPOUND || gate==GATE_PHASE);
}

void HT5HospitalObserveBlock(string reason)
{
   int gate=HT5GateFromReason(reason);
   if(gate<=GATE_NONE || gate>=GATE_COUNT) return;
   gHT5GateBlocks[gate]++;
   gHT5GateConsecutive[gate]++;
   gHT5GateLastTime[gate]=TimeCurrent();
   if(HT5GateIsHard(gate)) gHT5LastHardBlock=reason; else gHT5LastSoftBlock=reason;
}

void HT5HospitalResetPassedGates()
{
   for(int i=1;i<GATE_COUNT;i++)
   {
      if(TimeCurrent()-gHT5GateLastTime[i]>2) gHT5GateConsecutive[i]=0;
   }
}

void HT5HospitalSense()
{
   HT5HospitalResetPassedGates();
   int worst=GATE_NONE,worstN=0;
   for(int i=1;i<GATE_COUNT;i++) if(gHT5GateConsecutive[i]>worstN){ worst=i; worstN=gHT5GateConsecutive[i]; }
   gHT5SoftRepairAuthority=false;
   bool queuedFVG=(gMDFVGArmed && gMDFVGReady && !gMDFVGSeedUsed);
   if(HowShouldTheHospitalHandleDeadlocks>=HOSPITAL_SOFT_DEADLOCK_RECOVERY && queuedFVG && worstN>30 && !HT5GateIsHard(worst))
      gHT5SoftRepairAuthority=true;
   if(worst==GATE_NONE) gHT5HospitalState="HOSPITAL HEALTHY";
   else gHT5HospitalState="HOSPITAL WATCH "+IntegerToString(worst)+" • "+IntegerToString(worstN)+"T • "+(HT5GateIsHard(worst)?"HARD":"SOFT");
   double health=(worstN<=5?1.0:HT5Clamp(1.0-worstN/200.0,0.20,1.0));
   HT5SetOrgan(ORGAN_HOSPITAL,health,gHT5HospitalState);
}

//===============================================================================
// CAMPAIGN-WIDE PROTECTION SOLVER -- solves one stop from locked-money target
//===============================================================================
double HT5SolveCommonStopForLockedMoney(int dir,double desiredLockedMoney)
{
   if(dir==DIR_FLAT || TradeCountByDirection(dir)<=0) return 0.0;
   double k=HT5MoneyPerPriceUnitPerLot();
   if(k<=0.0) return 0.0;
   double totalLots=0.0,weightedOpen=0.0,costs=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if((dir==DIR_BUY && t!=OP_BUY)||(dir==DIR_SELL && t!=OP_SELL)) continue;
      totalLots+=OrderLots();
      weightedOpen+=OrderOpenPrice()*OrderLots();
      costs+=OrderSwap()+OrderCommission();
   }
   if(totalLots<=0.0) return 0.0;
   double avg=weightedOpen/totalLots;
   double netNeed=desiredLockedMoney-costs;
   double delta=netNeed/(k*totalLots);
   double stop=(dir==DIR_BUY?avg+delta:avg-delta);
   RefreshRates();
   double legal=MarketInfo(Symbol(),MODE_STOPLEVEL)*Point+Point;
   if(dir==DIR_BUY) stop=MathMin(stop,Bid-legal); else stop=MathMax(stop,Ask+legal);
   double tick=TickSizePrice();
   if(tick>0.0){ if(dir==DIR_BUY) stop=MathFloor(stop/tick)*tick; else stop=MathCeil(stop/tick)*tick; }
   return NormalizeDouble(stop,Digits);
}

bool HT5ApplyCommonCampaignStop(int dir,double stop,string reason)
{
   if(dir==DIR_FLAT || stop<=0.0) return false;
   bool changed=false;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if((dir==DIR_BUY && t!=OP_BUY)||(dir==DIR_SELL && t!=OP_SELL)) continue;
      double old=OrderStopLoss(); if(old<=0.0) old=SovStoredStop(OrderTicket());
      bool forward=(dir==DIR_BUY?stop>old+Point:stop<old-Point);
      if(!forward) continue;
      if(BrokerLossPolicy==BROKER_REMOVE_SL_SOFTWARE_PROFIT_ONLY)
      { GlobalVariableSet(SovStopKey(OrderTicket()),stop); changed=true; }
      else
      {
         ResetLastError();
         if(HT5CommanderOrderModify(OrderTicket(),OrderOpenPrice(),stop,OrderTakeProfit(),0,clrNONE))
         { GlobalVariableSet(SovStopKey(OrderTicket()),stop); changed=true; }
         else Print("LIVING IMMUNE stop solver modify failed ticket=",OrderTicket()," err=",GetLastError()," reason=",reason);
      }
   }
   if(changed) gHT5ProtectionState="BASKET STOP "+DoubleToString(stop,Digits)+" • "+reason;
   return changed;
}

bool HT5CampaignProtectionSolver(int stage)
{
   if(!gMDRLadderActive || stage<=0 || gMDRLadderR<=0.0) return false;
   int dir=gMDRLadderDirection;
   double protectR=MarketDNARLadderProtectR(stage);
   double baselineMoney=0.0;
   if(protectR>0.0)
   {
      // Protect a fraction of original selected campaign risk in cash, then solve
      // the common stop across heterogeneous entries/lots.
      baselineMoney=gMDRLadderRiskBudgetMoney*protectR*gHT5ProtectionAggression;
   }
   else
   {
      // Negative protect-R means the basket may still risk a bounded fraction of
      // the original campaign budget; never widen any already-forward stop.
      baselineMoney=-gMDRLadderRiskBudgetMoney*MathMin(0.95,MathAbs(protectR));
   }
   double stop=HT5SolveCommonStopForLockedMoney(dir,baselineMoney);
   if(stop<=0.0) return false;
   return HT5ApplyCommonCampaignStop(dir,stop,"R-LADDER STAGE "+IntegerToString(stage)+" / "+DoubleToString(protectR,2)+"R");
}

//===============================================================================
// LIFE ENERGY / ORGAN CONSENSUS / GROWTH BRIDGE
//===============================================================================
void HT5ComputeOrganConsensus()
{
   double sum=0.0,w=0.0;
   int ids[9]={ORGAN_LUNGS,ORGAN_HEART,ORGAN_SKELETON,ORGAN_EYES,ORGAN_ORACLE,ORGAN_BRAIN,ORGAN_IMMUNE,ORGAN_METABOLISM,ORGAN_SEQUENCE};
   double ws[9]={0.06,0.14,0.15,0.11,0.07,0.14,0.11,0.07,0.15};
   for(int i=0;i<9;i++){ sum+=ws[i]*gHT5OrganHealth[ids[i]]; w+=ws[i]; }
   gHT5OrganConsensus=HT5SafeDiv(sum,w);
   gHT5LifeEnergy=HT5Clamp(gHT5OrganConsensus*gHT5SessionQuality*(1.0-0.35*gHT5FlowEntropy),0.0,1.35);
}

void HT5BridgeIntoMarketDNA()
{
   // v5 does not replace the old strands; it supplies deeper physiology to them.
   // Direction remains owned by structural authorities. These bridges influence
   // magnitude, uncertainty, compound demand and add timing only.
   HT5ComputeOrganConsensus();
   double dir=(double)(gMDDesiredDirection==DIR_FLAT?gHT5Brain.direction:gMDDesiredDirection);
   if(dir!=0.0)
   {
      double supportive=dir*gHT5Brain.expectedATR;
      double memory=dir*gHT5Brain.memoryPotential;
      double location=dir*gHT5Brain.locationPotential;
      double session=(gHT5SessionQuality-1.0)*0.10;
      double boost=HT5Clamp(1.0+0.18*supportive+0.08*memory+0.08*location+session,0.72,1.35);
      gMDDesiredLots*=boost;
      gMDDesiredLots=MathMin(gMDDesiredLots,gMDSafeLotCeiling);
      gMDDesiredCars=MathMax(1,MathMin(MarketDNAMaxCars,(int)MathCeil(gMDDesiredLots/MathMax(MarketInfo(Symbol(),MODE_MINLOT),gMDBaseCarLot))));
   }
   // Pattern uncertainty is additive; a strong positive memory never erases
   // observed prediction error or adverse excursion.
   gMDUncertaintyATR=MathMax(gMDUncertaintyATR,gHT5Brain.uncertainty*0.20);
}

//===============================================================================
// LIVING DASHBOARD -- one compact organ-health panel separate from legacy detail
//===============================================================================
void HT5Label(string name,string text,int x,int y,int size,color c)
{
   string n=Pfx()+"HT5_"+name;
   if(ObjectFind(0,n)<0) ObjectCreate(0,n,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,n,OBJPROP_COLOR,c);
   ObjectSetString(0,n,OBJPROP_FONT,"Arial");
   ObjectSetString(0,n,OBJPROP_TEXT,text);
}

color HT5HealthColor(double h)
{
   if(h>=0.80) return C'60,230,140';
   if(h>=0.55) return C'255,210,70';
   if(h>=0.30) return C'255,140,50';
   return C'255,70,80';
}

void HT5DrawLivingPanel()
{
   if(HowMuchOfTheLivingDashboardShouldShow==VISUAL_MINIMAL_KEEP_CHART_CLEAR) return;
   int x=16,y=170;
   HT5Label("TITLE","HIGHTOWER SEQUENCE DOCTRINE v6.04 LEFT DASH",x,y,10,C'255,215,90');
   HT5Label("LIFE",gHT5LifeState,x,y+18,8,C'230,230,230');
   HT5Label("MET",gHT5MetabolicState,x,y+34,8,C'255,215,90');
   HT5Label("HOS",gHT5HospitalState,x,y+50,8,HT5HealthColor(gHT5OrganHealth[ORGAN_HOSPITAL]));
   HT5Label("SETUP",gHT5SetupState,x,y+66,7,C'160,220,255');
   HT5Label("SEQ",gHT6DoctrineState,x,y+82,7,C'255,210,70');
   HT5Label("AUDIT",gHT6AuditState,x,y+98,7,C'255,170,80');
   int row=0;
   for(int i=0;i<ORGAN_COUNT;i++)
   {
      if(HowMuchOfTheLivingDashboardShouldShow==VISUAL_LIVING_CREATURE && i>ORGAN_GENOME) continue;
      string t=HT5OrganName(i)+" "+DoubleToString(gHT5OrganHealth[i]*100.0,0)+"% • "+gHT5OrganState[i];
      HT5Label("ORG"+IntegerToString(i),t,x,y+120+row*16,7,HT5HealthColor(gHT5OrganHealth[i]));
      row++;
   }
}

//===============================================================================
// PERSISTENCE FOR LIVING MEMORY STATISTICS
//===============================================================================
string HT5Key(string suffix)
{
   return "HT5_"+IntegerToString(AccountNumber())+"_"+Symbol()+"_"+IntegerToString(MagicNumber)+"_"+suffix;
}

void HT5SaveLivingMemory()
{
   GlobalVariableSet(HT5Key("PATCOUNT"),gHT5PatternCount);
   GlobalVariableSet(HT5Key("PATHEAD"),gHT5PatternHead);
   GlobalVariableSet(HT5Key("MUTP"),gHT5GenomeMutationPressure);
   for(int i=0;i<32;i++)
   {
      GlobalVariableSet(HT5Key("SRCN"+IntegerToString(i)),gHT5SourceSamples[i]);
      GlobalVariableSet(HT5Key("SRCE"+IntegerToString(i)),gHT5SourceExpectancyR[i]);
      GlobalVariableSet(HT5Key("SBN"+IntegerToString(i)),gHT5SourceBuySamples[i]);
      GlobalVariableSet(HT5Key("SBE"+IntegerToString(i)),gHT5SourceBuyExpectancyR[i]);
      GlobalVariableSet(HT5Key("SBD"+IntegerToString(i)),gHT5SourceBuyEarlyDeath[i]);
      GlobalVariableSet(HT5Key("SBS"+IntegerToString(i)),gHT5SourceBuyStopRate[i]);
      GlobalVariableSet(HT5Key("SSN"+IntegerToString(i)),gHT5SourceSellSamples[i]);
      GlobalVariableSet(HT5Key("SSE"+IntegerToString(i)),gHT5SourceSellExpectancyR[i]);
      GlobalVariableSet(HT5Key("SSD"+IntegerToString(i)),gHT5SourceSellEarlyDeath[i]);
      GlobalVariableSet(HT5Key("SSS"+IntegerToString(i)),gHT5SourceSellStopRate[i]);
   }
   for(int h=0;h<24;h++)
   {
      GlobalVariableSet(HT5Key("HRN"+IntegerToString(h)),gHT5HourSamples[h]);
      GlobalVariableSet(HT5Key("HRE"+IntegerToString(h)),gHT5HourExpectancyR[h]);
   }
   for(int s=0;s<6;s++)
   {
      GlobalVariableSet(HT5Key("SESN"+IntegerToString(s)),gHT5SessionSamples[s]);
      GlobalVariableSet(HT5Key("SESE"+IntegerToString(s)),gHT5SessionExpectancyR[s]);
      GlobalVariableSet(HT5Key("PHN"+IntegerToString(s)),gHT5PhaseSamples[s]);
      GlobalVariableSet(HT5Key("PHE"+IntegerToString(s)),gHT5PhaseExpectancyR[s]);
   }
   for(int g=0;g<7;g++)
   {
      GlobalVariableSet(HT5Key("SHF"+IntegerToString(g)),gHT5Shadow[g].fitnessR);
      GlobalVariableSet(HT5Key("SHN"+IntegerToString(g)),gHT5Shadow[g].samples);
   }
}

void HT5LoadLivingMemory()
{
   for(int i=0;i<32;i++) gHT5CampaignReliability[i]=0.50;
   if(GlobalVariableCheck(HT5Key("MUTP"))) gHT5GenomeMutationPressure=GlobalVariableGet(HT5Key("MUTP"));
   for(int j=0;j<32;j++)
   {
      string kn=HT5Key("SRCN"+IntegerToString(j)),ke=HT5Key("SRCE"+IntegerToString(j));
      if(GlobalVariableCheck(kn)) gHT5SourceSamples[j]=GlobalVariableGet(kn);
      if(GlobalVariableCheck(ke)) gHT5SourceExpectancyR[j]=GlobalVariableGet(ke);
      string bN=HT5Key("SBN"+IntegerToString(j)),bE=HT5Key("SBE"+IntegerToString(j));
      string bD=HT5Key("SBD"+IntegerToString(j)),bS=HT5Key("SBS"+IntegerToString(j));
      string sN=HT5Key("SSN"+IntegerToString(j)),sE=HT5Key("SSE"+IntegerToString(j));
      string sD=HT5Key("SSD"+IntegerToString(j)),sS=HT5Key("SSS"+IntegerToString(j));
      if(GlobalVariableCheck(bN)) gHT5SourceBuySamples[j]=GlobalVariableGet(bN);
      if(GlobalVariableCheck(bE)) gHT5SourceBuyExpectancyR[j]=GlobalVariableGet(bE);
      if(GlobalVariableCheck(bD)) gHT5SourceBuyEarlyDeath[j]=GlobalVariableGet(bD);
      if(GlobalVariableCheck(bS)) gHT5SourceBuyStopRate[j]=GlobalVariableGet(bS);
      if(GlobalVariableCheck(sN)) gHT5SourceSellSamples[j]=GlobalVariableGet(sN);
      if(GlobalVariableCheck(sE)) gHT5SourceSellExpectancyR[j]=GlobalVariableGet(sE);
      if(GlobalVariableCheck(sD)) gHT5SourceSellEarlyDeath[j]=GlobalVariableGet(sD);
      if(GlobalVariableCheck(sS)) gHT5SourceSellStopRate[j]=GlobalVariableGet(sS);
      gHT5CampaignReliability[j]=HT5Clamp(0.50+0.15*gHT5SourceExpectancyR[j],0.15,0.95);
   }
   for(int h=0;h<24;h++)
   {
      string hn=HT5Key("HRN"+IntegerToString(h)),he=HT5Key("HRE"+IntegerToString(h));
      if(GlobalVariableCheck(hn)) gHT5HourSamples[h]=GlobalVariableGet(hn);
      if(GlobalVariableCheck(he)) gHT5HourExpectancyR[h]=GlobalVariableGet(he);
   }
   for(int s=0;s<6;s++)
   {
      string sn=HT5Key("SESN"+IntegerToString(s)),se=HT5Key("SESE"+IntegerToString(s));
      string pn=HT5Key("PHN"+IntegerToString(s)),pe=HT5Key("PHE"+IntegerToString(s));
      if(GlobalVariableCheck(sn)) gHT5SessionSamples[s]=GlobalVariableGet(sn);
      if(GlobalVariableCheck(se)) gHT5SessionExpectancyR[s]=GlobalVariableGet(se);
      if(GlobalVariableCheck(pn)) gHT5PhaseSamples[s]=GlobalVariableGet(pn);
      if(GlobalVariableCheck(pe)) gHT5PhaseExpectancyR[s]=GlobalVariableGet(pe);
   }
   for(int g=0;g<7;g++)
   {
      string fk=HT5Key("SHF"+IntegerToString(g)),nk=HT5Key("SHN"+IntegerToString(g));
      if(GlobalVariableCheck(fk)) gHT5Shadow[g].fitnessR=GlobalVariableGet(fk);
      if(GlobalVariableCheck(nk)) gHT5Shadow[g].samples=(int)GlobalVariableGet(nk);
   }
}

//===============================================================================
// CREATURE LIFE-CYCLE ORCHESTRATION
//===============================================================================
void HT5CreatureAwaken()
{
   for(int i=0;i<ORGAN_COUNT;i++){ gHT5OrganHealth[i]=0.50; gHT5OrganState[i]="AWAKENING"; gHT5OrganPulse[i]=0; }
   for(int j=0;j<GATE_COUNT;j++){ gHT5GateBlocks[j]=0; gHT5GateConsecutive[j]=0; gHT5GateLastTime[j]=0; }
   for(int f=0;f<32;f++){ gHT5FeatureEWMA[f]=0.0; gHT5FeatureVar[f]=0.25; }
   HT5InitializeShadowGenomes();
   HT5InitializeDeepFeatureRegistry();
   HT5InitializeSubunitNames();
   HT5InitializeGenes();
   HT5LoadLivingMemory();
   HT6SequenceLoad();
   HT5BootstrapRecentTradeStats();
   HT5LoadGenes();
   gHT5CreatureInitialized=true;
   gHT5LifeState="ALIVE • HUNTING COMPOUND CYCLE "+IntegerToString(gCompoundCycle);
   HT5SetOrgan(ORGAN_COMMANDER,1.0,"ONE COMMANDER / BROKER HANDS" );
   HT5SetOrgan(ORGAN_SEQUENCE,0.65,"PHASE 0 OBSERVE / WAIT CAMPAIGN");
}

void HT5CreatureSenseBeforeLegacyDecision()
{
   if(!gHT5CreatureInitialized) return;
   gHT5CreatureAgeTicks++;
   HT5ChronosSense();
   HT5LungsSense();
   HT5HeartSense();
   HT5SkeletonSense();
   HT5EyesSense();
   HT5OracleSense();
   // v6.02 AUDIT: do not advance sequence from stale prior-tick Market DNA.
   // The authoritative sequence pass runs after MarketDNAUpdate() later in OnTick.
   HT5DeepSenseTick();
   HT5DeepPhysiologySense();
   HT5BuildFeatureVector();
   HT5PredictFromPatternMemory();
   HT5BrainSense();
   HT5ImmuneSense();
   HT5MetabolismSense();
   HT5AdvancedOrganSense();
   HT5LivingFormulaRegistryPulse();
   HT5ChroniclePulse();
   // Advanced regulators may change bounded growth/protection physiology, so the
   // brain/immune/metabolism snapshot is refreshed once before legacy execution.
   HT5BrainSense();
   HT5ImmuneSense();
   HT5MetabolismSense();
   if(gMDDeployBlockReason!="NONE") HT5HospitalObserveBlock(gMDDeployBlockReason);
   else if(StringFind(gPyrState,"BLOCKED")>=0 || StringFind(gEntryStatus,"BLOCK")>=0) HT5HospitalObserveBlock(gPyrState+" "+gEntryStatus);
   HT5HospitalSense();
   HT5ComputeOrganConsensus();
   gHT5LifeState=(TradeCount()>0?"ALIVE • CAMPAIGN ":"ALIVE • HUNT ")+IntegerToString(gCompoundCycle)+" • ENERGY "+DoubleToString(gHT5LifeEnergy,2);
   HT5SetOrgan(ORGAN_HANDS,(MarketDNAAllowLimitStacks?0.85:0.55),gMDPulseState);
   HT5SetOrgan(ORGAN_MUSCLES,(gMDRLadderActive?0.95:0.70),gMDRLadderState);
   HT5SetOrgan(ORGAN_COMMANDER,1.0,gEntryStatus);
}

void HT5CreatureAfterMarketDNAUpdate()
{
   if(!gHT5CreatureInitialized) return;
   HT5BrainSense();
   HT5ImmuneSense();
   HT5MetabolismSense();
   HT5BridgeIntoMarketDNA();
   HT5SetOrgan(ORGAN_GENOME,HT5Clamp(0.50+0.20*gEvoFitnessR,0.15,1.0),gEvoState);
}

void HT5CreatureTimerPulse()
{
   if(!gHT5CreatureInitialized) return;
   HT5ChronosSense();
   HT5HospitalSense();
   HT5DrawLivingPanel();
   HT5DrawDeepDiagnostics();
   HT5DrawAdvancedLifeDiagnostics();
   HT5DrawChronicle();
}

void HT5CreatureSleep()
{
   HT5SaveLivingMemory();
   HT6SequenceSave();
   HT5SaveGenes();
   gHT5LifeState="CREATURE SLEEPING";
}



//===============================================================================
// DEEP COLLECTION NERVOUS SYSTEM v5.00
// 128 named features, atlas memory, source reliability, organ correlation.
// This layer observes. It never owns OrderSend/OrderClose authority.
//===============================================================================
#define HT5_DEEP_FEATURE_COUNT 128
#define HT5_DEEP_PATTERN_CAP 96
#define HT5_LIQUIDITY_POOL_CAP 64
#define HT5_FVG_ATLAS_CAP 64
#define HT5_OB_ATLAS_CAP 48
#define HT5_STATION_ATLAS_CAP 48

string gHT5DeepFeatureName[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepFeature[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepMean[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepVar[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepMin[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepMax[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepOutcomeCorr[HT5_DEEP_FEATURE_COUNT];
double gHT5DeepSamples[HT5_DEEP_FEATURE_COUNT];

double gHT5DeepPatternFeature[HT5_DEEP_PATTERN_CAP][HT5_DEEP_FEATURE_COUNT];
double gHT5DeepPatternOutcomeR[HT5_DEEP_PATTERN_CAP];
double gHT5DeepPatternMFER[HT5_DEEP_PATTERN_CAP];
double gHT5DeepPatternMAER[HT5_DEEP_PATTERN_CAP];
int gHT5DeepPatternDirection[HT5_DEEP_PATTERN_CAP];
int gHT5DeepPatternSource[HT5_DEEP_PATTERN_CAP];
datetime gHT5DeepPatternTime[HT5_DEEP_PATTERN_CAP];
bool gHT5DeepPatternUsed[HT5_DEEP_PATTERN_CAP];
int gHT5DeepPatternHead=0,gHT5DeepPatternCount=0;
double gHT5DeepPredictionR=0.0,gHT5DeepPredictionConfidence=0.0,gHT5DeepPredictionDistance=0.0;

double gHT5LiquidityLevel[HT5_LIQUIDITY_POOL_CAP];
double gHT5LiquidityStrength[HT5_LIQUIDITY_POOL_CAP];
double gHT5LiquidityTouches[HT5_LIQUIDITY_POOL_CAP];
int gHT5LiquidityType[HT5_LIQUIDITY_POOL_CAP];
int gHT5LiquidityAgeBars[HT5_LIQUIDITY_POOL_CAP];
int gHT5LiquidityCount=0;
datetime gHT5LiquidityLastBuildBar=0;
string gHT5LiquidityState="LIQUIDITY ATLAS EMPTY";

double gHT5FVGAtlasTop[HT5_FVG_ATLAS_CAP];
double gHT5FVGAtlasBot[HT5_FVG_ATLAS_CAP];
double gHT5FVGAtlasQuality[HT5_FVG_ATLAS_CAP];
double gHT5FVGAtlasFill[HT5_FVG_ATLAS_CAP];
int gHT5FVGAtlasDir[HT5_FVG_ATLAS_CAP];
int gHT5FVGAtlasTF[HT5_FVG_ATLAS_CAP];
datetime gHT5FVGAtlasTime[HT5_FVG_ATLAS_CAP];
int gHT5FVGAtlasCount=0;
datetime gHT5FVGAtlasLastBuildBar=0;
string gHT5FVGAtlasState="FVG ATLAS EMPTY";

double gHT5OBAtlasTop[HT5_OB_ATLAS_CAP];
double gHT5OBAtlasBot[HT5_OB_ATLAS_CAP];
double gHT5OBAtlasQuality[HT5_OB_ATLAS_CAP];
double gHT5OBAtlasMitigation[HT5_OB_ATLAS_CAP];
int gHT5OBAtlasDir[HT5_OB_ATLAS_CAP];
int gHT5OBAtlasTF[HT5_OB_ATLAS_CAP];
datetime gHT5OBAtlasTime[HT5_OB_ATLAS_CAP];
int gHT5OBAtlasCount=0;
datetime gHT5OBAtlasLastBuildBar=0;
string gHT5OBAtlasState="OB ATLAS EMPTY";

double gHT5StationAtlasPrice[HT5_STATION_ATLAS_CAP];
double gHT5StationAtlasStrength[HT5_STATION_ATLAS_CAP];
int gHT5StationAtlasDir[HT5_STATION_ATLAS_CAP];
int gHT5StationAtlasType[HT5_STATION_ATLAS_CAP];
string gHT5StationAtlasName[HT5_STATION_ATLAS_CAP];
int gHT5StationAtlasCount=0;
string gHT5StationAtlasState="STATION ECOSYSTEM EMPTY";

double gHT5TickTransition[3][3];
int gHT5LastTickDirection=0;
int gHT5TickRunDirection=0,gHT5TickRunLength=0;
double gHT5TickRunATR=0.0,gHT5TickSkew=0.0,gHT5TickKurtosis=0.0;
double gHT5DirectionalPersistence=0.0,gHT5ReversalHazard=0.0,gHT5BurstHazard=0.0;
string gHT5NerveState="NERVES LISTENING";

double gHT5EntryOrganHealth[ORGAN_COUNT];
double gHT5OrganOutcomeCorr[ORGAN_COUNT];
double gHT5OrganReliability[ORGAN_COUNT];
double gHT5OrganSamples[ORGAN_COUNT];

double gHT5ScenarioR[12];
double gHT5ScenarioMoney[12];
double gHT5ScenarioRisk[12];
double gHT5ScenarioEfficiency[12];
string gHT5ScenarioState="SCENARIO ENGINE IDLE";

double gHT5CommanderIntentDirection=0.0;
double gHT5CommanderIntentLocation=0.0;
double gHT5CommanderIntentTiming=0.0;
double gHT5CommanderIntentRisk=0.0;
double gHT5CommanderIntentGrowth=0.0;
double gHT5CommanderIntentConfidence=0.0;
string gHT5CommanderIntentState="COMMANDER INTENT IDLE";

//===============================================================================
// DEEP FEATURE REGISTRY
//===============================================================================
void HT5InitializeDeepFeatureRegistry()
{
   for(int i=0;i<HT5_DEEP_FEATURE_COUNT;i++)
   {
      gHT5DeepFeatureName[i]="FEATURE_"+IntegerToString(i);
      gHT5DeepFeature[i]=0.0;
      gHT5DeepMean[i]=0.0;
      gHT5DeepVar[i]=0.25;
      gHT5DeepMin[i]=1e9;
      gHT5DeepMax[i]=-1e9;
      gHT5DeepOutcomeCorr[i]=0.0;
      gHT5DeepSamples[i]=0.0;
   }
   gHT5DeepFeatureName[0]="M1_ATR_LIVE_STABLE_RATIO";
   gHT5DeepFeatureName[1]="M1_RANGE_ATR";
   gHT5DeepFeatureName[2]="M1_VELOCITY_ATR";
   gHT5DeepFeatureName[3]="M1_ACCELERATION_ATR";
   gHT5DeepFeatureName[4]="M1_EFFICIENCY";
   gHT5DeepFeatureName[5]="M1_COMPRESSION";
   gHT5DeepFeatureName[6]="M1_EXPANSION";
   gHT5DeepFeatureName[7]="M1_EMA_SLOPE_ATR";
   gHT5DeepFeatureName[8]="M1_LOCATION_20BAR";
   gHT5DeepFeatureName[9]="M1_VOLUME_RATIO";
   gHT5DeepFeatureName[10]="M1_CANDLE_BODY_ATR";
   gHT5DeepFeatureName[11]="M1_UPPER_WICK_ATR";
   gHT5DeepFeatureName[12]="M1_LOWER_WICK_ATR";
   gHT5DeepFeatureName[13]="M1_CLOSE_LOCATION";
   gHT5DeepFeatureName[14]="M1_MOMENTUM_3BAR_ATR";
   gHT5DeepFeatureName[15]="M1_MOMENTUM_6BAR_ATR";
   gHT5DeepFeatureName[16]="M1_SWING_RANGE_ATR";
   gHT5DeepFeatureName[17]="M1_DIRECTION_ALIGNMENT";
   gHT5DeepFeatureName[18]="M1_REJECTION_BALANCE";
   gHT5DeepFeatureName[19]="M1_VOLUME_DIRECTION_IMPULSE";
   gHT5DeepFeatureName[20]="M5_ATR_LIVE_STABLE_RATIO";
   gHT5DeepFeatureName[21]="M5_RANGE_ATR";
   gHT5DeepFeatureName[22]="M5_VELOCITY_ATR";
   gHT5DeepFeatureName[23]="M5_ACCELERATION_ATR";
   gHT5DeepFeatureName[24]="M5_EFFICIENCY";
   gHT5DeepFeatureName[25]="M5_COMPRESSION";
   gHT5DeepFeatureName[26]="M5_EXPANSION";
   gHT5DeepFeatureName[27]="M5_EMA_SLOPE_ATR";
   gHT5DeepFeatureName[28]="M5_LOCATION_20BAR";
   gHT5DeepFeatureName[29]="M5_VOLUME_RATIO";
   gHT5DeepFeatureName[30]="M5_CANDLE_BODY_ATR";
   gHT5DeepFeatureName[31]="M5_UPPER_WICK_ATR";
   gHT5DeepFeatureName[32]="M5_LOWER_WICK_ATR";
   gHT5DeepFeatureName[33]="M5_CLOSE_LOCATION";
   gHT5DeepFeatureName[34]="M5_MOMENTUM_3BAR_ATR";
   gHT5DeepFeatureName[35]="M5_MOMENTUM_6BAR_ATR";
   gHT5DeepFeatureName[36]="M5_SWING_RANGE_ATR";
   gHT5DeepFeatureName[37]="M5_DIRECTION_ALIGNMENT";
   gHT5DeepFeatureName[38]="M5_REJECTION_BALANCE";
   gHT5DeepFeatureName[39]="M5_VOLUME_DIRECTION_IMPULSE";
   gHT5DeepFeatureName[40]="M15_ATR_LIVE_STABLE_RATIO";
   gHT5DeepFeatureName[41]="M15_RANGE_ATR";
   gHT5DeepFeatureName[42]="M15_VELOCITY_ATR";
   gHT5DeepFeatureName[43]="M15_ACCELERATION_ATR";
   gHT5DeepFeatureName[44]="M15_EFFICIENCY";
   gHT5DeepFeatureName[45]="M15_COMPRESSION";
   gHT5DeepFeatureName[46]="M15_EXPANSION";
   gHT5DeepFeatureName[47]="M15_EMA_SLOPE_ATR";
   gHT5DeepFeatureName[48]="M15_LOCATION_20BAR";
   gHT5DeepFeatureName[49]="M15_VOLUME_RATIO";
   gHT5DeepFeatureName[50]="M15_CANDLE_BODY_ATR";
   gHT5DeepFeatureName[51]="M15_UPPER_WICK_ATR";
   gHT5DeepFeatureName[52]="M15_LOWER_WICK_ATR";
   gHT5DeepFeatureName[53]="M15_CLOSE_LOCATION";
   gHT5DeepFeatureName[54]="M15_MOMENTUM_3BAR_ATR";
   gHT5DeepFeatureName[55]="M15_MOMENTUM_6BAR_ATR";
   gHT5DeepFeatureName[56]="M15_SWING_RANGE_ATR";
   gHT5DeepFeatureName[57]="M15_DIRECTION_ALIGNMENT";
   gHT5DeepFeatureName[58]="M15_REJECTION_BALANCE";
   gHT5DeepFeatureName[59]="M15_VOLUME_DIRECTION_IMPULSE";
   gHT5DeepFeatureName[60]="H1_ATR_LIVE_STABLE_RATIO";
   gHT5DeepFeatureName[61]="H1_RANGE_ATR";
   gHT5DeepFeatureName[62]="H1_VELOCITY_ATR";
   gHT5DeepFeatureName[63]="H1_ACCELERATION_ATR";
   gHT5DeepFeatureName[64]="H1_EFFICIENCY";
   gHT5DeepFeatureName[65]="H1_COMPRESSION";
   gHT5DeepFeatureName[66]="H1_EXPANSION";
   gHT5DeepFeatureName[67]="H1_EMA_SLOPE_ATR";
   gHT5DeepFeatureName[68]="H1_LOCATION_20BAR";
   gHT5DeepFeatureName[69]="H1_VOLUME_RATIO";
   gHT5DeepFeatureName[70]="H1_CANDLE_BODY_ATR";
   gHT5DeepFeatureName[71]="H1_UPPER_WICK_ATR";
   gHT5DeepFeatureName[72]="H1_LOWER_WICK_ATR";
   gHT5DeepFeatureName[73]="H1_CLOSE_LOCATION";
   gHT5DeepFeatureName[74]="H1_MOMENTUM_3BAR_ATR";
   gHT5DeepFeatureName[75]="H1_MOMENTUM_6BAR_ATR";
   gHT5DeepFeatureName[76]="H1_SWING_RANGE_ATR";
   gHT5DeepFeatureName[77]="H1_DIRECTION_ALIGNMENT";
   gHT5DeepFeatureName[78]="H1_REJECTION_BALANCE";
   gHT5DeepFeatureName[79]="H1_VOLUME_DIRECTION_IMPULSE";
   gHT5DeepFeatureName[80]="H4_ATR_LIVE_STABLE_RATIO";
   gHT5DeepFeatureName[81]="H4_RANGE_ATR";
   gHT5DeepFeatureName[82]="H4_VELOCITY_ATR";
   gHT5DeepFeatureName[83]="H4_ACCELERATION_ATR";
   gHT5DeepFeatureName[84]="H4_EFFICIENCY";
   gHT5DeepFeatureName[85]="H4_COMPRESSION";
   gHT5DeepFeatureName[86]="H4_EXPANSION";
   gHT5DeepFeatureName[87]="H4_EMA_SLOPE_ATR";
   gHT5DeepFeatureName[88]="H4_LOCATION_20BAR";
   gHT5DeepFeatureName[89]="H4_VOLUME_RATIO";
   gHT5DeepFeatureName[90]="H4_CANDLE_BODY_ATR";
   gHT5DeepFeatureName[91]="H4_UPPER_WICK_ATR";
   gHT5DeepFeatureName[92]="H4_LOWER_WICK_ATR";
   gHT5DeepFeatureName[93]="H4_CLOSE_LOCATION";
   gHT5DeepFeatureName[94]="H4_MOMENTUM_3BAR_ATR";
   gHT5DeepFeatureName[95]="H4_MOMENTUM_6BAR_ATR";
   gHT5DeepFeatureName[96]="H4_SWING_RANGE_ATR";
   gHT5DeepFeatureName[97]="H4_DIRECTION_ALIGNMENT";
   gHT5DeepFeatureName[98]="H4_REJECTION_BALANCE";
   gHT5DeepFeatureName[99]="H4_VOLUME_DIRECTION_IMPULSE";
   gHT5DeepFeatureName[100]="STRUCTURE_ATR";
   gHT5DeepFeatureName[101]="BOS_ATR";
   gHT5DeepFeatureName[102]="PRESSURE_ATR";
   gHT5DeepFeatureName[103]="ROUTE_ATR";
   gHT5DeepFeatureName[104]="HISTORICAL_CHANNEL_ATR";
   gHT5DeepFeatureName[105]="RHYTHM_SCORE";
   gHT5DeepFeatureName[106]="RHYTHM_FORCE";
   gHT5DeepFeatureName[107]="RHYTHM_PULLBACK";
   gHT5DeepFeatureName[108]="RHYTHM_CADENCE";
   gHT5DeepFeatureName[109]="TICK_ENTROPY";
   gHT5DeepFeatureName[110]="TICK_JERK_ATR";
   gHT5DeepFeatureName[111]="DAY_RANGE_POSITION";
   gHT5DeepFeatureName[112]="SIGNAL_FVG_FIELD";
   gHT5DeepFeatureName[113]="ORDER_BLOCK_FIELD";
   gHT5DeepFeatureName[114]="STATION_FIELD";
   gHT5DeepFeatureName[115]="RECLAIM_FIELD";
   gHT5DeepFeatureName[116]="NET_LOCATION_FIELD";
   gHT5DeepFeatureName[117]="ORACLE_MICRO_TREND";
   gHT5DeepFeatureName[118]="ORACLE_OB_FVG";
   gHT5DeepFeatureName[119]="ORACLE_PHASE";
   gHT5DeepFeatureName[120]="INFLECTION_ATR";
   gHT5DeepFeatureName[121]="ACCEPTANCE_ATR";
   gHT5DeepFeatureName[122]="PREDICTION_UNCERTAINTY";
   gHT5DeepFeatureName[123]="EXPECTED_ADVERSE_ATR";
   gHT5DeepFeatureName[124]="COMPOUND_PROGRESS";
   gHT5DeepFeatureName[125]="CAMPAIGN_RISK_UTILIZATION";
   gHT5DeepFeatureName[126]="SESSION_LIQUIDITY_QUALITY";
   gHT5DeepFeatureName[127]="DEEP_PATTERN_PREDICTION_R";

   for(int o=0;o<ORGAN_COUNT;o++)
   {
      gHT5OrganReliability[o]=1.0;
      gHT5OrganOutcomeCorr[o]=0.0;
      gHT5OrganSamples[o]=0.0;
      gHT5EntryOrganHealth[o]=0.50;
   }
}

double HT5CandleBodyATR(int tf)
{
   double atr=MathMax(Point,HTExecutionATR(tf,14));
   return HT5Clamp(MathAbs(iClose(Symbol(),tf,0)-iOpen(Symbol(),tf,0))/atr,0.0,4.0);
}

double HT5UpperWickATR(int tf)
{
   double atr=MathMax(Point,HTExecutionATR(tf,14));
   double o=iOpen(Symbol(),tf,0),c=iClose(Symbol(),tf,0),h=iHigh(Symbol(),tf,0);
   return HT5Clamp(MathMax(0.0,h-MathMax(o,c))/atr,0.0,4.0);
}

double HT5LowerWickATR(int tf)
{
   double atr=MathMax(Point,HTExecutionATR(tf,14));
   double o=iOpen(Symbol(),tf,0),c=iClose(Symbol(),tf,0),l=iLow(Symbol(),tf,0);
   return HT5Clamp(MathMax(0.0,MathMin(o,c)-l)/atr,0.0,4.0);
}

double HT5CloseLocation(int tf)
{
   double h=iHigh(Symbol(),tf,0),l=iLow(Symbol(),tf,0),c=iClose(Symbol(),tf,0);
   return HT5Clamp(HT5SafeDiv(c-l,MathMax(Point,h-l)),0.0,1.0);
}

double HT5MomentumATR(int tf,int bars)
{
   bars=MathMax(1,MathMin(20,bars));
   double atr=MathMax(Point,HTExecutionATR(tf,14));
   return HT5Clamp((iClose(Symbol(),tf,0)-iClose(Symbol(),tf,bars))/atr,-6.0,6.0);
}

double HT5SwingRangeATR(int tf)
{
   double atr=MathMax(Point,HTExecutionATR(tf,14));
   int hi=iHighest(Symbol(),tf,MODE_HIGH,20,0),lo=iLowest(Symbol(),tf,MODE_LOW,20,0);
   if(hi<0 || lo<0) return 0.0;
   return HT5Clamp((iHigh(Symbol(),tf,hi)-iLow(Symbol(),tf,lo))/atr,0.0,12.0);
}

double HT5DirectionAlignment(int idx)
{
   if(idx<0 || idx>=5) return 0.0;
   int dir=gHT5Brain.direction;
   if(dir==DIR_FLAT) dir=gMDDesiredDirection;
   return dir*gHT5TF[idx].direction;
}

double HT5RejectionBalance(int tf)
{
   return HT5Clamp(HT5LowerWickATR(tf)-HT5UpperWickATR(tf),-3.0,3.0);
}

double HT5VolumeDirectionalImpulse(int idx)
{
   if(idx<0 || idx>=5) return 0.0;
   return HT5Clamp(gHT5TF[idx].volumeRatio*gHT5TF[idx].velocityATR,-4.0,4.0);
}

void HT5SetDeepFeature(int idx,double value)
{
   if(idx<0 || idx>=HT5_DEEP_FEATURE_COUNT) return;
   if(value!=value || value>1.0e100 || value<-1.0e100) value=0.0;
   value=HT5Clamp(value,-20.0,20.0);
   gHT5DeepFeature[idx]=value;
   gHT5DeepSamples[idx]+=1.0;
   double alpha=2.0/(MathMin(100.0,gHT5DeepSamples[idx])+1.0);
   double d=value-gHT5DeepMean[idx];
   gHT5DeepMean[idx]+=alpha*d;
   gHT5DeepVar[idx]=(1.0-alpha)*gHT5DeepVar[idx]+alpha*d*d;
   gHT5DeepMin[idx]=MathMin(gHT5DeepMin[idx],value);
   gHT5DeepMax[idx]=MathMax(gHT5DeepMax[idx],value);
}

void HT5CollectDeepFeatures()
{
   int z=0;
   for(int t=0;t<5;t++)
   {
      int tf=gHT5TF[t].tf;
      HT5SetDeepFeature(z++,HT5SafeDiv(gHT5TF[t].atrLive,MathMax(Point,gHT5TF[t].atrStable)));
      HT5SetDeepFeature(z++,gHT5TF[t].rangeATR);
      HT5SetDeepFeature(z++,gHT5TF[t].velocityATR);
      HT5SetDeepFeature(z++,gHT5TF[t].accelerationATR);
      HT5SetDeepFeature(z++,gHT5TF[t].efficiency);
      HT5SetDeepFeature(z++,gHT5TF[t].compression);
      HT5SetDeepFeature(z++,gHT5TF[t].expansion);
      HT5SetDeepFeature(z++,gHT5TF[t].emaSlopeATR);
      HT5SetDeepFeature(z++,gHT5TF[t].locationInRange);
      HT5SetDeepFeature(z++,gHT5TF[t].volumeRatio);
      HT5SetDeepFeature(z++,HT5CandleBodyATR(tf));
      HT5SetDeepFeature(z++,HT5UpperWickATR(tf));
      HT5SetDeepFeature(z++,HT5LowerWickATR(tf));
      HT5SetDeepFeature(z++,HT5CloseLocation(tf));
      HT5SetDeepFeature(z++,HT5MomentumATR(tf,3));
      HT5SetDeepFeature(z++,HT5MomentumATR(tf,6));
      HT5SetDeepFeature(z++,HT5SwingRangeATR(tf));
      HT5SetDeepFeature(z++,HT5DirectionAlignment(t));
      HT5SetDeepFeature(z++,HT5RejectionBalance(tf));
      HT5SetDeepFeature(z++,HT5VolumeDirectionalImpulse(t));
   }
   HT5SetDeepFeature(z++,gMDStructureATR);
   HT5SetDeepFeature(z++,gMDBOSATR);
   HT5SetDeepFeature(z++,gMDPressureATR);
   HT5SetDeepFeature(z++,gMDRouteATR);
   HT5SetDeepFeature(z++,gMDChannelATR);
   HT5SetDeepFeature(z++,gMDRhythmScore);
   HT5SetDeepFeature(z++,gMDRhythmForce);
   HT5SetDeepFeature(z++,gMDRhythmPullback);
   HT5SetDeepFeature(z++,gMDRhythmCadence);
   HT5SetDeepFeature(z++,gHT5FlowEntropy);
   HT5SetDeepFeature(z++,gHT5TickJerkATR);
   HT5SetDeepFeature(z++,gMDDayRangePosition);
   HT5SetDeepFeature(z++,gHT5Location.fvgField);
   HT5SetDeepFeature(z++,gHT5Location.obField);
   HT5SetDeepFeature(z++,gHT5Location.stationField);
   HT5SetDeepFeature(z++,gHT5Location.reclaimField);
   HT5SetDeepFeature(z++,gHT5Location.netDirectionalField);
   HT5SetDeepFeature(z++,gMDOracleMicroTrendATR);
   HT5SetDeepFeature(z++,gMDOracleOBFVGATR);
   HT5SetDeepFeature(z++,gMDOraclePhaseATR);
   HT5SetDeepFeature(z++,gMDInflectionATR);
   HT5SetDeepFeature(z++,gMDAcceptanceATR);
   HT5SetDeepFeature(z++,gMDUncertaintyATR);
   HT5SetDeepFeature(z++,gMDExpectedAdverseATR);
   HT5SetDeepFeature(z++,gCompoundProgress/100.0);
   HT5SetDeepFeature(z++,HT5SafeDiv(OpenCampaignRiskMoney()+MarketDNAPendingRiskMoney(),MathMax(0.01,AccountRiskBase()*MaximumCampaignRiskPercent/100.0)));
   HT5SetDeepFeature(z++,gHT5SessionQuality);
   HT5SetDeepFeature(z++,gHT5DeepPredictionR);
}

void HT5UpdateDeepFeatureOutcomeCorrelation(double outcomeR)
{
   for(int i=0;i<HT5_DEEP_FEATURE_COUNT;i++)
   {
      double scale=MathSqrt(MathMax(0.01,gHT5DeepVar[i]));
      double normalized=(gHT5DeepFeature[i]-gHT5DeepMean[i])/scale;
      normalized=HT5Clamp(normalized,-3.0,3.0);
      double contribution=HT5Clamp(normalized*outcomeR,-6.0,6.0);
      gHT5DeepOutcomeCorr[i]=0.97*gHT5DeepOutcomeCorr[i]+0.03*contribution;
   }
}

void HT5CaptureEntryOrganSnapshot()
{
   for(int i=0;i<ORGAN_COUNT;i++) gHT5EntryOrganHealth[i]=gHT5OrganHealth[i];
}

void HT5UpdateOrganOutcomeCorrelation(double outcomeR)
{
   for(int i=0;i<ORGAN_COUNT;i++)
   {
      gHT5OrganSamples[i]+=1.0;
      double x=(gHT5EntryOrganHealth[i]-0.50)*2.0;
      double contribution=HT5Clamp(x*outcomeR,-4.0,4.0);
      gHT5OrganOutcomeCorr[i]=0.96*gHT5OrganOutcomeCorr[i]+0.04*contribution;
      gHT5OrganReliability[i]=HT5Clamp(1.0+0.16*gHT5OrganOutcomeCorr[i],0.72,1.28);
   }
}

//===============================================================================
// DEEP PATTERN MEMORY -- nearest historical campaign fingerprints
//===============================================================================
void HT5StoreDeepPattern(double outcomeR,double mfeR,double maeR,int direction,int source)
{
   int idx=gHT5DeepPatternHead%HT5_DEEP_PATTERN_CAP;
   for(int f=0;f<HT5_DEEP_FEATURE_COUNT;f++) gHT5DeepPatternFeature[idx][f]=gHT5DeepFeature[f];
   gHT5DeepPatternOutcomeR[idx]=outcomeR;
   gHT5DeepPatternMFER[idx]=mfeR;
   gHT5DeepPatternMAER[idx]=maeR;
   gHT5DeepPatternDirection[idx]=direction;
   gHT5DeepPatternSource[idx]=source;
   gHT5DeepPatternTime[idx]=TimeCurrent();
   gHT5DeepPatternUsed[idx]=true;
   gHT5DeepPatternHead=(idx+1)%HT5_DEEP_PATTERN_CAP;
   gHT5DeepPatternCount=MathMin(HT5_DEEP_PATTERN_CAP,gHT5DeepPatternCount+1);
}

double HT5DeepPatternDistance(int idx,int desiredDir)
{
   if(idx<0 || idx>=HT5_DEEP_PATTERN_CAP || !gHT5DeepPatternUsed[idx]) return 1e9;
   if(desiredDir!=DIR_FLAT && gHT5DeepPatternDirection[idx]!=DIR_FLAT && gHT5DeepPatternDirection[idx]!=desiredDir) return 6.0;
   double sum=0.0,wSum=0.0;
   for(int f=0;f<HT5_DEEP_FEATURE_COUNT;f++)
   {
      double scale=MathSqrt(MathMax(0.02,gHT5DeepVar[f]));
      double d=(gHT5DeepFeature[f]-gHT5DeepPatternFeature[idx][f])/scale;
      d=HT5Clamp(d,-5.0,5.0);
      double w=1.0;
      if(f<40) w=1.15;
      else if(f>=100 && f<124) w=1.25;
      else if(f>=124) w=1.10;
      sum+=w*d*d; wSum+=w;
   }
   return MathSqrt(sum/MathMax(1.0,wSum));
}

void HT5PredictDeepPatterns()
{
   if(gHT5DeepPatternCount<3)
   { gHT5DeepPredictionR=0.0; gHT5DeepPredictionConfidence=0.0; gHT5DeepPredictionDistance=0.0; return; }
   int dir=(gMDDesiredDirection!=DIR_FLAT?gMDDesiredDirection:gHT5Brain.direction);
   double num=0.0,den=0.0,minD=1e9;
   int matches=0;
   for(int i=0;i<HT5_DEEP_PATTERN_CAP;i++)
   {
      if(!gHT5DeepPatternUsed[i]) continue;
      double d=HT5DeepPatternDistance(i,dir);
      if(d<minD) minD=d;
      if(d>3.2) continue;
      double w=MathExp(-0.5*d*d/1.20);
      double recencyDays=(TimeCurrent()-gHT5DeepPatternTime[i])/86400.0;
      double recency=1.0/(1.0+0.03*MathMax(0.0,recencyDays));
      w*=recency;
      num+=w*gHT5DeepPatternOutcomeR[i]; den+=w; matches++;
   }
   gHT5DeepPredictionR=(den>0.0001?num/den:0.0);
   gHT5DeepPredictionConfidence=HT5Clamp(den/MathMax(2.0,(double)MathMin(12,matches)),0.0,1.0);
   gHT5DeepPredictionDistance=(minD<1e8?minD:0.0);
}

//===============================================================================
// LIQUIDITY ATLAS -- equal highs/lows and repeatedly respected pools
//===============================================================================
void HT5ClearLiquidityAtlas()
{
   gHT5LiquidityCount=0;
   for(int i=0;i<HT5_LIQUIDITY_POOL_CAP;i++)
   { gHT5LiquidityLevel[i]=0.0; gHT5LiquidityStrength[i]=0.0; gHT5LiquidityTouches[i]=0.0; gHT5LiquidityType[i]=0; gHT5LiquidityAgeBars[i]=0; }
}

int HT5FindLiquidityCluster(double price,int type,double tol)
{
   for(int i=0;i<gHT5LiquidityCount;i++)
      if(gHT5LiquidityType[i]==type && MathAbs(gHT5LiquidityLevel[i]-price)<=tol) return i;
   return -1;
}

void HT5AddLiquidityObservation(double price,int type,int age,double atr)
{
   if(price<=0.0 || atr<=0.0) return;
   double tol=atr*0.16;
   int idx=HT5FindLiquidityCluster(price,type,tol);
   double recency=1.0/(1.0+age/250.0);
   if(idx>=0)
   {
      double n=gHT5LiquidityTouches[idx];
      gHT5LiquidityLevel[idx]=(gHT5LiquidityLevel[idx]*n+price)/(n+1.0);
      gHT5LiquidityTouches[idx]=n+1.0;
      gHT5LiquidityAgeBars[idx]=MathMin(gHT5LiquidityAgeBars[idx],age);
      gHT5LiquidityStrength[idx]+=recency;
      return;
   }
   if(gHT5LiquidityCount>=HT5_LIQUIDITY_POOL_CAP) return;
   idx=gHT5LiquidityCount++;
   gHT5LiquidityLevel[idx]=price;
   gHT5LiquidityType[idx]=type;
   gHT5LiquidityTouches[idx]=1.0;
   gHT5LiquidityAgeBars[idx]=age;
   gHT5LiquidityStrength[idx]=recency;
}

void HT5SortLiquidityAtlas()
{
   for(int i=0;i<gHT5LiquidityCount;i++)
      for(int j=i+1;j<gHT5LiquidityCount;j++)
         if(gHT5LiquidityStrength[j]>gHT5LiquidityStrength[i])
         {
            double d;
            int n;
            d=gHT5LiquidityLevel[i]; gHT5LiquidityLevel[i]=gHT5LiquidityLevel[j]; gHT5LiquidityLevel[j]=d;
            d=gHT5LiquidityStrength[i]; gHT5LiquidityStrength[i]=gHT5LiquidityStrength[j]; gHT5LiquidityStrength[j]=d;
            d=gHT5LiquidityTouches[i]; gHT5LiquidityTouches[i]=gHT5LiquidityTouches[j]; gHT5LiquidityTouches[j]=d;
            n=gHT5LiquidityType[i]; gHT5LiquidityType[i]=gHT5LiquidityType[j]; gHT5LiquidityType[j]=n;
            n=gHT5LiquidityAgeBars[i]; gHT5LiquidityAgeBars[i]=gHT5LiquidityAgeBars[j]; gHT5LiquidityAgeBars[j]=n;
         }
}

void HT5BuildLiquidityAtlas()
{
   datetime bar=iTime(Symbol(),SignalTF,0);
   if(bar==0 || bar==gHT5LiquidityLastBuildBar) return;
   gHT5LiquidityLastBuildBar=bar;
   HT5ClearLiquidityAtlas();
   double atr=MathMax(Point,HTStableATR(SignalTF,14));
   int bars=iBars(Symbol(),SignalTF);
   int depth=MathMin(MathMax(300,MarketDNAChannelLookbackBars/10),MathMin(2400,bars-5));
   int wing=2;
   for(int i=wing+1;i<depth-wing;i++)
   {
      double h=iHigh(Symbol(),SignalTF,i),l=iLow(Symbol(),SignalTF,i);
      bool ph=true,pl=true;
      for(int w=1;w<=wing;w++)
      {
         if(h<=iHigh(Symbol(),SignalTF,i-w) || h<iHigh(Symbol(),SignalTF,i+w)) ph=false;
         if(l>=iLow(Symbol(),SignalTF,i-w) || l>iLow(Symbol(),SignalTF,i+w)) pl=false;
      }
      if(ph) HT5AddLiquidityObservation(h,DIR_SELL,i,atr);
      if(pl) HT5AddLiquidityObservation(l,DIR_BUY,i,atr);
   }
   HT5SortLiquidityAtlas();
   int strong=0;
   for(int k=0;k<gHT5LiquidityCount;k++) if(gHT5LiquidityTouches[k]>=2.0) strong++;
   gHT5LiquidityState="LIQUIDITY "+IntegerToString(gHT5LiquidityCount)+" POOLS • "+IntegerToString(strong)+" REPEATED";
}

double HT5NearestLiquidityDistanceATR(int type)
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid(),best=99.0;
   for(int i=0;i<gHT5LiquidityCount;i++)
   {
      if(type!=DIR_FLAT && gHT5LiquidityType[i]!=type) continue;
      double d=MathAbs(p-gHT5LiquidityLevel[i])/atr;
      if(d<best) best=d;
   }
   return (best<99.0?best:0.0);
}

double HT5LiquidityDirectionalField()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid(),field=0.0,ws=0.0;
   int limit=MathMin(gHT5LiquidityCount,24);
   for(int i=0;i<limit;i++)
   {
      double d=MathAbs(p-gHT5LiquidityLevel[i])/atr;
      double proximity=MathExp(-d/1.25);
      double touch=HT5Clamp(gHT5LiquidityTouches[i]/4.0,0.25,1.0);
      double w=proximity*touch;
      // Low pools are potential BUY magnets/support until accepted below; high pools mirror.
      field+=gHT5LiquidityType[i]*w;
      ws+=w;
   }
   return HT5Clamp(HT5SafeDiv(field,MathMax(0.25,ws)),-1.0,1.0);
}

//===============================================================================
// FVG ATLAS -- multi-timeframe imbalance ecology, fill and displacement quality
//===============================================================================
void HT5ClearFVGAtlas()
{
   gHT5FVGAtlasCount=0;
   for(int i=0;i<HT5_FVG_ATLAS_CAP;i++)
   { gHT5FVGAtlasTop[i]=0.0; gHT5FVGAtlasBot[i]=0.0; gHT5FVGAtlasQuality[i]=0.0; gHT5FVGAtlasFill[i]=0.0; gHT5FVGAtlasDir[i]=0; gHT5FVGAtlasTF[i]=0; gHT5FVGAtlasTime[i]=0; }
}

bool HT5FVGAtlasDuplicate(double top,double bot,int dir,int tf,double tol)
{
   double mid=(top+bot)*0.5;
   for(int i=0;i<gHT5FVGAtlasCount;i++)
      if(gHT5FVGAtlasDir[i]==dir && gHT5FVGAtlasTF[i]==tf && MathAbs((gHT5FVGAtlasTop[i]+gHT5FVGAtlasBot[i])*0.5-mid)<=tol) return true;
   return false;
}

void HT5AddFVGAtlas(double top,double bot,int dir,int tf,int shift,double atr)
{
   if(top<=bot || dir==DIR_FLAT || atr<=0.0 || gHT5FVGAtlasCount>=HT5_FVG_ATLAS_CAP) return;
   if(HT5FVGAtlasDuplicate(top,bot,dir,tf,atr*0.08)) return;
   double width=(top-bot)/atr;
   double body=MathAbs(iClose(Symbol(),tf,shift)-iOpen(Symbol(),tf,shift))/atr;
   double displacement=MathAbs(iClose(Symbol(),tf,shift)-iClose(Symbol(),tf,shift+2))/atr;
   double age=shift;
   double quality=HT5Clamp(0.35*width+0.35*displacement+0.20*body+0.10/(1.0+age/20.0),0.0,3.0);
   double p=HT5Mid();
   double fill=0.0;
   if(dir==DIR_BUY)
   {
      if(p<=bot) fill=1.0; else if(p<top) fill=(top-p)/MathMax(Point,top-bot);
   }
   else
   {
      if(p>=top) fill=1.0; else if(p>bot) fill=(p-bot)/MathMax(Point,top-bot);
   }
   int idx=gHT5FVGAtlasCount++;
   gHT5FVGAtlasTop[idx]=top; gHT5FVGAtlasBot[idx]=bot; gHT5FVGAtlasDir[idx]=dir; gHT5FVGAtlasTF[idx]=tf;
   gHT5FVGAtlasQuality[idx]=quality; gHT5FVGAtlasFill[idx]=HT5Clamp(fill,0.0,1.0); gHT5FVGAtlasTime[idx]=iTime(Symbol(),tf,shift);
}

void HT5ScanFVGTimeframe(int tf,int maxBars)
{
   double atr=MathMax(Point,HTStableATR(tf,14));
   int bars=iBars(Symbol(),tf); maxBars=MathMin(maxBars,bars-4);
   for(int i=2;i<maxBars;i++)
   {
      double olderH=iHigh(Symbol(),tf,i+1),olderL=iLow(Symbol(),tf,i+1);
      double newerH=iHigh(Symbol(),tf,i-1),newerL=iLow(Symbol(),tf,i-1);
      if(newerL>olderH+atr*0.004) HT5AddFVGAtlas(newerL,olderH,DIR_BUY,tf,i,atr);
      if(newerH<olderL-atr*0.004) HT5AddFVGAtlas(olderL,newerH,DIR_SELL,tf,i,atr);
      if(gHT5FVGAtlasCount>=HT5_FVG_ATLAS_CAP) break;
   }
}

void HT5BuildFVGAtlas()
{
   datetime bar=iTime(Symbol(),PERIOD_M5,0);
   if(bar==0 || bar==gHT5FVGAtlasLastBuildBar) return;
   gHT5FVGAtlasLastBuildBar=bar;
   HT5ClearFVGAtlas();
   HT5ScanFVGTimeframe(PERIOD_M1,80);
   HT5ScanFVGTimeframe(PERIOD_M5,100);
   HT5ScanFVGTimeframe(PERIOD_M15,80);
   HT5ScanFVGTimeframe(PERIOD_H1,60);
   int buy=0,sell=0;
   for(int i=0;i<gHT5FVGAtlasCount;i++){ if(gHT5FVGAtlasDir[i]==DIR_BUY) buy++; else if(gHT5FVGAtlasDir[i]==DIR_SELL) sell++; }
   gHT5FVGAtlasState="FVG ATLAS "+IntegerToString(gHT5FVGAtlasCount)+" • B"+IntegerToString(buy)+"/S"+IntegerToString(sell);
}

double HT5FVGAtlasDirectionalField()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid(),sum=0.0,ws=0.0;
   for(int i=0;i<gHT5FVGAtlasCount;i++)
   {
      double mid=(gHT5FVGAtlasTop[i]+gHT5FVGAtlasBot[i])*0.5;
      double d=MathAbs(p-mid)/atr;
      if(d>4.0) continue;
      double w=MathExp(-d/1.20)*HT5Clamp(gHT5FVGAtlasQuality[i]/1.5,0.15,1.2)*(1.0-0.55*gHT5FVGAtlasFill[i]);
      sum+=gHT5FVGAtlasDir[i]*w; ws+=w;
   }
   return HT5Clamp(HT5SafeDiv(sum,MathMax(0.20,ws)),-1.0,1.0);
}

//===============================================================================
// ORDER BLOCK ATLAS -- last opposing candle before accepted displacement
//===============================================================================
void HT5ClearOBAtlas()
{
   gHT5OBAtlasCount=0;
   for(int i=0;i<HT5_OB_ATLAS_CAP;i++)
   { gHT5OBAtlasTop[i]=0.0; gHT5OBAtlasBot[i]=0.0; gHT5OBAtlasQuality[i]=0.0; gHT5OBAtlasMitigation[i]=0.0; gHT5OBAtlasDir[i]=0; gHT5OBAtlasTF[i]=0; gHT5OBAtlasTime[i]=0; }
}

bool HT5OBDuplicate(double top,double bot,int dir,int tf,double tol)
{
   double mid=(top+bot)*0.5;
   for(int i=0;i<gHT5OBAtlasCount;i++)
      if(gHT5OBAtlasDir[i]==dir && gHT5OBAtlasTF[i]==tf && MathAbs((gHT5OBAtlasTop[i]+gHT5OBAtlasBot[i])*0.5-mid)<=tol) return true;
   return false;
}

void HT5AddOB(double top,double bot,int dir,int tf,int shift,double displacementATR,double atr)
{
   if(top<=bot || dir==DIR_FLAT || gHT5OBAtlasCount>=HT5_OB_ATLAS_CAP) return;
   if(HT5OBDuplicate(top,bot,dir,tf,atr*0.10)) return;
   double width=(top-bot)/atr;
   double quality=HT5Clamp(0.55*displacementATR+0.25/(1.0+shift/20.0)+0.20*MathMin(1.0,width/0.50),0.0,3.0);
   double p=HT5Mid();
   double mitigation=(p>=bot && p<=top?1.0:0.0);
   int idx=gHT5OBAtlasCount++;
   gHT5OBAtlasTop[idx]=top; gHT5OBAtlasBot[idx]=bot; gHT5OBAtlasDir[idx]=dir; gHT5OBAtlasTF[idx]=tf;
   gHT5OBAtlasQuality[idx]=quality; gHT5OBAtlasMitigation[idx]=mitigation; gHT5OBAtlasTime[idx]=iTime(Symbol(),tf,shift);
}

void HT5ScanOBTimeframe(int tf,int maxBars)
{
   double atr=MathMax(Point,HTStableATR(tf,14));
   int bars=iBars(Symbol(),tf); maxBars=MathMin(maxBars,bars-15);
   for(int i=3;i<maxBars;i++)
   {
      double priorHi=iHigh(Symbol(),tf,iHighest(Symbol(),tf,MODE_HIGH,10,i+1));
      double priorLo=iLow(Symbol(),tf,iLowest(Symbol(),tf,MODE_LOW,10,i+1));
      double close=iClose(Symbol(),tf,i),open=iOpen(Symbol(),tf,i);
      double bullDisp=(close-priorHi)/atr;
      double bearDisp=(priorLo-close)/atr;
      if(bullDisp>0.18)
      {
         for(int k=i+1;k<=MathMin(i+6,bars-2);k++)
         {
            double o=iOpen(Symbol(),tf,k),c=iClose(Symbol(),tf,k);
            if(c<o){ HT5AddOB(iHigh(Symbol(),tf,k),iLow(Symbol(),tf,k),DIR_BUY,tf,k,bullDisp,atr); break; }
         }
      }
      if(bearDisp>0.18)
      {
         for(int m=i+1;m<=MathMin(i+6,bars-2);m++)
         {
            double o2=iOpen(Symbol(),tf,m),c2=iClose(Symbol(),tf,m);
            if(c2>o2){ HT5AddOB(iHigh(Symbol(),tf,m),iLow(Symbol(),tf,m),DIR_SELL,tf,m,bearDisp,atr); break; }
         }
      }
      if(gHT5OBAtlasCount>=HT5_OB_ATLAS_CAP) break;
   }
}

void HT5BuildOBAtlas()
{
   datetime bar=iTime(Symbol(),PERIOD_M5,0);
   if(bar==0 || bar==gHT5OBAtlasLastBuildBar) return;
   gHT5OBAtlasLastBuildBar=bar;
   HT5ClearOBAtlas();
   HT5ScanOBTimeframe(PERIOD_M1,70);
   HT5ScanOBTimeframe(PERIOD_M5,90);
   HT5ScanOBTimeframe(PERIOD_M15,70);
   HT5ScanOBTimeframe(PERIOD_H1,50);
   int buy=0,sell=0;
   for(int i=0;i<gHT5OBAtlasCount;i++){ if(gHT5OBAtlasDir[i]==DIR_BUY) buy++; else if(gHT5OBAtlasDir[i]==DIR_SELL) sell++; }
   gHT5OBAtlasState="OB ATLAS "+IntegerToString(gHT5OBAtlasCount)+" • B"+IntegerToString(buy)+"/S"+IntegerToString(sell);
}

double HT5OBAtlasDirectionalField()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid(),sum=0.0,ws=0.0;
   for(int i=0;i<gHT5OBAtlasCount;i++)
   {
      double mid=(gHT5OBAtlasTop[i]+gHT5OBAtlasBot[i])*0.5;
      double d=MathAbs(p-mid)/atr;
      if(d>4.0) continue;
      double w=MathExp(-d/1.30)*HT5Clamp(gHT5OBAtlasQuality[i]/1.5,0.15,1.2);
      sum+=gHT5OBAtlasDir[i]*w; ws+=w;
   }
   return HT5Clamp(HT5SafeDiv(sum,MathMax(0.20,ws)),-1.0,1.0);
}

//===============================================================================
// STATION ECOSYSTEM -- confluence points built from rails, atlases and pivots
//===============================================================================
void HT5ClearStationAtlas()
{
   gHT5StationAtlasCount=0;
   for(int i=0;i<HT5_STATION_ATLAS_CAP;i++)
   { gHT5StationAtlasPrice[i]=0.0; gHT5StationAtlasStrength[i]=0.0; gHT5StationAtlasDir[i]=0; gHT5StationAtlasType[i]=0; gHT5StationAtlasName[i]=""; }
}

int HT5FindStationNear(double price,double atr)
{
   for(int i=0;i<gHT5StationAtlasCount;i++) if(MathAbs(gHT5StationAtlasPrice[i]-price)<=atr*0.16) return i;
   return -1;
}

void HT5AddStation(double price,int dir,int type,double strength,string name,double atr)
{
   if(price<=0.0 || atr<=0.0) return;
   int idx=HT5FindStationNear(price,atr);
   if(idx>=0)
   {
      double old=gHT5StationAtlasStrength[idx];
      gHT5StationAtlasPrice[idx]=(gHT5StationAtlasPrice[idx]*old+price*strength)/MathMax(0.01,old+strength);
      gHT5StationAtlasStrength[idx]+=strength;
      if(gHT5StationAtlasDir[idx]==DIR_FLAT) gHT5StationAtlasDir[idx]=dir;
      gHT5StationAtlasName[idx]+="+"+name;
      return;
   }
   if(gHT5StationAtlasCount>=HT5_STATION_ATLAS_CAP) return;
   idx=gHT5StationAtlasCount++;
   gHT5StationAtlasPrice[idx]=price; gHT5StationAtlasDir[idx]=dir; gHT5StationAtlasType[idx]=type;
   gHT5StationAtlasStrength[idx]=strength; gHT5StationAtlasName[idx]=name;
}

void HT5BuildStationEcosystem()
{
   HT5ClearStationAtlas();
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   HT5AddStation(gMDDayLow,DIR_BUY,1,1.0,"DAY_LOW",atr);
   HT5AddStation(gMDDayHigh,DIR_SELL,1,1.0,"DAY_HIGH",atr);
   HT5AddStation(gMDChannelSupportNow,DIR_BUY,2,1.2,"GOLD_SUPPORT",atr);
   HT5AddStation(gMDChannelResistanceNow,DIR_SELL,2,1.2,"RED_PEAK",atr);
   if(gMDTriggerRailValid) HT5AddStation(gMDTriggerRailNow,gMDTriggerRailTrendDirection,3,1.1,"BLACK_TRIGGER",atr);
   HT5AddStation(gPyrBuyStation,DIR_BUY,4,0.9,"IL_BUY",atr);
   HT5AddStation(gPyrSellStation,DIR_SELL,4,0.9,"IL_SELL",atr);
   HT5AddStation(gPyrActiveReclaimLevel,gPyrRawSignal,5,0.8,"RECLAIM",atr);
   for(int i=0;i<MathMin(16,gHT5LiquidityCount);i++)
      HT5AddStation(gHT5LiquidityLevel[i],gHT5LiquidityType[i],6,0.35+0.15*MathMin(4.0,gHT5LiquidityTouches[i]),"LIQ",atr);
   for(int f=0;f<MathMin(14,gHT5FVGAtlasCount);f++)
      HT5AddStation((gHT5FVGAtlasTop[f]+gHT5FVGAtlasBot[f])*0.5,gHT5FVGAtlasDir[f],7,0.45+0.25*MathMin(2.0,gHT5FVGAtlasQuality[f]),"FVG",atr);
   for(int o=0;o<MathMin(12,gHT5OBAtlasCount);o++)
      HT5AddStation((gHT5OBAtlasTop[o]+gHT5OBAtlasBot[o])*0.5,gHT5OBAtlasDir[o],8,0.45+0.25*MathMin(2.0,gHT5OBAtlasQuality[o]),"OB",atr);
   double strongest=0.0; string best="NONE";
   for(int j=0;j<gHT5StationAtlasCount;j++)
      if(gHT5StationAtlasStrength[j]>strongest){ strongest=gHT5StationAtlasStrength[j]; best=gHT5StationAtlasName[j]; }
   gHT5StationAtlasState="STATIONS "+IntegerToString(gHT5StationAtlasCount)+" • BEST "+best+" "+DoubleToString(strongest,1);
}

double HT5StationDirectionalField()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double p=HT5Mid(),sum=0.0,ws=0.0;
   for(int i=0;i<gHT5StationAtlasCount;i++)
   {
      double d=MathAbs(p-gHT5StationAtlasPrice[i])/atr;
      if(d>3.0) continue;
      double w=MathExp(-d/0.90)*HT5Clamp(gHT5StationAtlasStrength[i]/2.0,0.10,1.5);
      sum+=gHT5StationAtlasDir[i]*w; ws+=w;
   }
   return HT5Clamp(HT5SafeDiv(sum,MathMax(0.20,ws)),-1.0,1.0);
}

//===============================================================================
// NERVOUS SYSTEM -- transition probabilities, run structure, skew and kurtosis
//===============================================================================
int HT5TickState(double delta)
{
   if(delta>Point*0.05) return 2;  // UP
   if(delta<-Point*0.05) return 0; // DOWN
   return 1;                       // FLAT
}

void HT5NervousSense()
{
   if(gMDRTickCount<4) return;
   int a=(gMDRTickHead-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   int b=(a-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
   double delta=gMDRTickPrice[a]-gMDRTickPrice[b];
   int state=HT5TickState(delta);
   int prev=(gHT5LastTickDirection==0?1:gHT5LastTickDirection);
   gHT5TickTransition[prev][state]=0.98*gHT5TickTransition[prev][state]+0.02;
   for(int i=0;i<3;i++) for(int j=0;j<3;j++) if(!(i==prev && j==state)) gHT5TickTransition[i][j]*=0.9995;
   gHT5LastTickDirection=state;
   int signedState=(state==2?DIR_BUY:(state==0?DIR_SELL:DIR_FLAT));
   if(signedState!=DIR_FLAT && signedState==gHT5TickRunDirection) gHT5TickRunLength++;
   else if(signedState!=DIR_FLAT){ gHT5TickRunDirection=signedState; gHT5TickRunLength=1; }
   else gHT5TickRunLength=MathMax(0,gHT5TickRunLength-1);

   int n=MathMin(gMDRTickCount,64);
   double mean=0.0,m2=0.0,m3=0.0,m4=0.0;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   for(int k=1;k<n;k++)
   {
      int x=(gMDRTickHead-k+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      int y=(x-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      double r=(gMDRTickPrice[x]-gMDRTickPrice[y])/atr;
      mean+=r;
   }
   mean/=MathMax(1,n-1);
   for(int q=1;q<n;q++)
   {
      int x2=(gMDRTickHead-q+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      int y2=(x2-1+MD_RHYTHM_MAX_TICKS)%MD_RHYTHM_MAX_TICKS;
      double r2=(gMDRTickPrice[x2]-gMDRTickPrice[y2])/atr-mean;
      m2+=r2*r2; m3+=r2*r2*r2; m4+=r2*r2*r2*r2;
   }
   double denom=MathMax(1,n-1); m2/=denom; m3/=denom; m4/=denom;
   double sd=MathSqrt(MathMax(1e-10,m2));
   gHT5TickSkew=HT5Clamp(m3/MathMax(1e-10,sd*sd*sd),-5.0,5.0);
   gHT5TickKurtosis=HT5Clamp(m4/MathMax(1e-10,m2*m2),0.0,12.0);
   gHT5TickRunATR=HT5Clamp(gHT5TickRunLength*MathAbs(mean),0.0,3.0);
   double same=(state==2?gHT5TickTransition[2][2]:(state==0?gHT5TickTransition[0][0]:gHT5TickTransition[1][1]));
   double flip=(state==2?gHT5TickTransition[2][0]:(state==0?gHT5TickTransition[0][2]:0.0));
   gHT5DirectionalPersistence=HT5Clamp(HT5SafeDiv(same,same+flip+0.01),0.0,1.0);
   gHT5ReversalHazard=HT5Clamp(HT5SafeDiv(flip,same+flip+0.01),0.0,1.0);
   gHT5BurstHazard=HT5Clamp((gHT5TickKurtosis-3.0)/6.0+0.25*MathAbs(gHT5TickSkew),0.0,1.0);
   gHT5NerveState="NERVES RUN "+IntegerToString(gHT5TickRunLength)+" • PERSIST "+DoubleToString(gHT5DirectionalPersistence,2)+" • REV "+DoubleToString(gHT5ReversalHazard,2);
   gHT5NervousState=gHT5NerveState;
}

//===============================================================================
// COMPOUND SCENARIO ENGINE -- projects campaign payoff across R path
//===============================================================================
void HT5BuildCompoundScenarios()
{
   int dir=(gMDRLadderActive?gMDRLadderDirection:(TradeCount()>0?(int)DetectDirection():gHT5Brain.direction));
   double entry=(gMDRLadderActive?gMDRLadderSeedEntry:HT5Mid());
   double R=(gMDRLadderActive?gMDRLadderR:MathMax(Point,HTExecutionATR(SignalTF,14)));
   double riskCap=MathMax(0.01,AccountRiskBase()*MaximumCampaignRiskPercent/100.0);
   for(int i=0;i<12;i++)
   {
      double r=-0.50+i*0.20;
      double price=entry+dir*R*r;
      double money=(dir!=DIR_FLAT?HT5ProjectedBasketAtPrice(dir,price):0.0);
      gHT5ScenarioR[i]=r;
      gHT5ScenarioMoney[i]=money;
      gHT5ScenarioRisk[i]=MathMax(0.0,-money);
      gHT5ScenarioEfficiency[i]=HT5SafeDiv(MathMax(0.0,money),riskCap);
   }
   double atOne=(dir!=DIR_FLAT?HT5ProjectedBasketAtPrice(dir,entry+dir*R):0.0);
   gHT5ScenarioState="SCENARIO 1R $"+DoubleToString(atOne,2)+" • TARGET LEFT $"+DoubleToString(gCompoundLiveRemaining,2);
}

//===============================================================================
// COMMANDER INTENT -- summarizes organs; does not execute
//===============================================================================
void HT5BuildCommanderIntent()
{
   bool liveEntryThesis=(gHT5LiveThesis.active && TradeCount()==0);
   bool campaignThesis=(gHT5CampaignThesis.active && TradeCount()>0);
   int dir=(liveEntryThesis?gHT5LiveThesis.direction:
            (campaignThesis?gHT5CampaignThesis.direction:
             (gMDDesiredDirection!=DIR_FLAT?gMDDesiredDirection:gHT5Brain.direction)));
   double location=0.45*gHT5Location.fvgField+0.25*gHT5Location.obField+0.15*gHT5Location.stationField+0.15*gHT5Location.reclaimField;
   double timing=0.45*MathMax(0.0,dir*gMDRhythmScore)+0.25*MathMax(0.0,dir*gMDRhythmForce)+0.15*gHT5DirectionalPersistence+0.15*(1.0-gHT5FlowEntropy);
   double risk=1.0-HT5Clamp(HT5SafeDiv(gHT5Immune.openRisk+gHT5Immune.pendingRisk,MathMax(0.01,gHT5Immune.campaignRiskCap)),0.0,1.0);
   double growth=HT5Clamp(HT5SafeDiv(gCompoundLiveRemaining,MathMax(0.01,gCompoundBaseGoalMoney)),0.0,1.5);
   double brain=HT5Clamp(0.5+0.25*dir*gHT5Brain.expectedATR,0.0,1.0);
   gHT5CommanderIntentDirection=dir;

   if(liveEntryThesis)
   {
      // One setup thesis owns direction. Location/timing/organ context now refine
      // the SAME thesis instead of each organ publishing a competing direction.
      location=0.55*gHT5LiveThesis.locationSupport+0.20*gHT5LiveThesis.channelSupport+0.15*gHT5LiveThesis.structureSupport+0.10*gHT5LiveThesis.oracleSupport;
      timing=0.62*gHT5LiveThesis.flowSupport+0.20*gHT5LiveThesis.mtfSupport+0.18*gHT5LiveThesis.memorySupport;
      gHT5CommanderIntentLocation=HT5Clamp(location,0.0,1.0);
      gHT5CommanderIntentTiming=HT5Clamp(timing,0.0,1.0);
      gHT5CommanderIntentRisk=HT5Clamp(risk,0.0,1.0);
      gHT5CommanderIntentGrowth=HT5Clamp(growth,0.0,1.0);
      gHT5CommanderIntentConfidence=HT5Clamp(0.58*gHT5LiveThesis.coherence+0.16*risk+0.10*timing+0.08*location+0.08*gHT5OrganConsensus,0.0,1.0);
      gHT5CommanderIntentState="ENTRY THESIS "+(dir==DIR_BUY?"BUY":"SELL")+" • "+gHT5LiveThesis.label+" • C "+DoubleToString(gHT5CommanderIntentConfidence,2)+" • M "+DoubleToString(gHT5LiveThesis.coherence,2);
      return;
   }

   if(campaignThesis)
   {
      // Once filled, direction/invalidation identity is frozen. Live organs can
      // accelerate or protect the campaign, but cannot dilute the campaign into
      // a new unrelated thesis while the original trade is still alive.
      location=0.40*gHT5CampaignThesis.locationSupport+0.22*gHT5CampaignThesis.channelSupport+0.18*gHT5CampaignThesis.structureSupport+0.10*gHT5CampaignThesis.oracleSupport+0.10*MathMax(0.0,dir*gHT5Location.netDirectionalField);
      double liveFlow=HT5Clamp(MathMax(0.0,dir*(0.50*gMDRhythmScore+0.30*gMDRhythmForce+0.20*gMDPressureATR))/0.22,0.0,1.0);
      timing=0.52*liveFlow+0.18*gHT5CampaignThesis.mtfSupport+0.15*gHT5CampaignThesis.memorySupport+0.15*gHT5DirectionalPersistence;
      gHT5CommanderIntentLocation=HT5Clamp(location,0.0,1.0);
      gHT5CommanderIntentTiming=HT5Clamp(timing,0.0,1.0);
      gHT5CommanderIntentRisk=HT5Clamp(risk,0.0,1.0);
      gHT5CommanderIntentGrowth=HT5Clamp(growth,0.0,1.0);
      gHT5CommanderIntentConfidence=HT5Clamp(0.48*gHT5CampaignThesis.coherence+0.18*liveFlow+0.14*risk+0.10*location+0.10*gHT5OrganConsensus,0.0,1.0);
      gHT5CommanderIntentState="CAMPAIGN THESIS "+(dir==DIR_BUY?"BUY":"SELL")+" • "+gHT5CampaignThesis.label+" • C "+DoubleToString(gHT5CommanderIntentConfidence,2)+" • M "+DoubleToString(gHT5CampaignThesis.coherence,2);
      return;
   }

   gHT5CommanderIntentLocation=HT5Clamp(location,0.0,1.0);
   gHT5CommanderIntentTiming=HT5Clamp(timing,0.0,1.0);
   gHT5CommanderIntentRisk=HT5Clamp(risk,0.0,1.0);
   gHT5CommanderIntentGrowth=HT5Clamp(growth,0.0,1.0);
   gHT5CommanderIntentConfidence=HT5Clamp(0.20*brain+0.20*location+0.20*timing+0.20*risk+0.20*gHT5OrganConsensus,0.0,1.0);
   gHT5CommanderIntentState="INTENT "+(dir==DIR_BUY?"BUY":(dir==DIR_SELL?"SELL":"FLAT"))+" • "+HT6PhaseName(gHT6Seq.phase)+" M"+IntegerToString(gHT6Seq.moveCount)+" • C "+DoubleToString(gHT5CommanderIntentConfidence,2)+" • L "+DoubleToString(location,2)+" • T "+DoubleToString(timing,2);
}

//===============================================================================
// DEEP SOURCE RELIABILITY AND ORGAN ADAPTATION
//===============================================================================
double HT5SourceReliability(int source)
{
   if(source<0 || source>=32) return 0.50;
   double n=gHT5SourceSamples[source];
   if(n<3.0) return 0.50;
   return HT5Clamp(gHT5CampaignReliability[source],0.15,0.95);
}

double HT5OrganReliabilityValue(int organ)
{
   if(organ<0 || organ>=ORGAN_COUNT) return 1.0;
   return HT5Clamp(gHT5OrganReliability[organ],0.72,1.28);
}

void HT5AdaptivePhysiologyFromEvidence()
{
   if(HowShouldTheGenomeEvolve<EVOLUTION_MUTATE_AFTER_REPEAT_EVIDENCE) return;
   // This layer changes only bounded runtime multipliers. The existing genome
   // promotion/rollback engine remains the authority for persistent mutations.
   int best=HT5BestShadow();
   double shadowEdge=gHT5Shadow[best].fitnessR-gEvoFitnessR;
   double pattern=gHT5DeepPredictionR*gHT5DeepPredictionConfidence;
   gHT5RiskReuseScale=HT5Clamp(0.72+0.12*gHT5LifeEnergy+0.08*MathMax(0.0,pattern)+0.05*MathMax(0.0,shadowEdge),0.55,1.0);
   gHT5FVGPrecisionScale=HT5Clamp(1.0-0.08*gHT5DeepOutcomeCorr[112]+0.05*gHT5VolOfVol,0.70,1.30);
   gHT5RhythmFloorOffset=HT5Clamp(-0.05*gHT5DeepOutcomeCorr[105],-0.08,0.08);
   gHT5ChannelAuthorityScale=HT5Clamp(gHT5ChannelAuthorityScale*(1.0+0.02*gHT5DeepOutcomeCorr[104]),0.70,1.35);
}

//===============================================================================
// DEEP DATA LOGGING -- one line per resolved campaign, not per tick
//===============================================================================
string HT5DatasetFileName()
{
   return "HIGHTOWER_LIVING_"+IntegerToString(AccountNumber())+"_"+Symbol()+"_CAMPAIGNS.csv";
}

void HT5WriteCampaignDataset(double net,double r,int errorClass)
{
   if(HowShouldTheGenomeEvolve==EVOLUTION_OFF) return;
   int h=FileOpen(HT5DatasetFileName(),FILE_CSV|FILE_READ|FILE_WRITE|FILE_COMMON,',');
   if(h==INVALID_HANDLE) return;
   if(FileSize(h)==0)
   {
      FileWrite(h,"time","symbol","genome","net","R","error","direction","source","sourceLabel","agreement","witnesses","session","oraclePhase","sequencePhase","moveCount","moveType","pauseType","sequenceContinuation","sequenceExhaustion","MFE_R","MAE_R","maxCars","compoundCycle","compoundProgress","patternPredR","patternConfidence","organConsensus","lifeEnergy","entryRhythm","entryChannel","entrySpine","entryPressure","entryDayPos","entryFVGDepth");
   }
   FileSeek(h,0,SEEK_END);
   FileWrite(h,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),Symbol(),gEvoGenome,net,r,errorClass,gEvoCampaignDirection,gHT5CampaignEntrySource,gHT5CampaignEntryLabel,gHT5CampaignEntryAgreement,gHT5CampaignEntryWitnesses,gHT5Session,gHT5BodyPhase,gHT6EntryPhaseSnapshot,gHT6EntryMoveSnapshot,gHT6EntryMoveTypeSnapshot,gHT6EntryPauseTypeSnapshot,gHT6EntryContinuationSnapshot,gHT6EntryExhaustionSnapshot,gEvoMaxFavorableR,gEvoMaxAdverseR,gEvoPeakCars,gCompoundCycle,gCompoundProgress,gHT5DeepPredictionR,gHT5DeepPredictionConfidence,gHT5OrganConsensus,gHT5LifeEnergy,gEvoEntryRhythm,gEvoEntryChannel,gEvoEntrySpine,gEvoEntryPressure,gEvoEntryDayPos,gEvoEntryFVGDepth);
   FileClose(h);
}

//===============================================================================
// DEEP ATLAS / MEMORY ORCHESTRATION
//===============================================================================
void HT5DeepBuildAtlases()
{
   HT5BuildLiquidityAtlas();
   HT5BuildFVGAtlas();
   HT5BuildOBAtlas();
   HT5BuildStationEcosystem();
   double liq=HT5LiquidityDirectionalField();
   double fvg=HT5FVGAtlasDirectionalField();
   double ob=HT5OBAtlasDirectionalField();
   double st=HT5StationDirectionalField();
   // Feed location eye with deeper atlases while keeping current signal FVG dominant.
   gHT5Location.liquidityPoolField=MathAbs(liq);
   gHT5Location.netDirectionalField=HT5Clamp(0.55*gHT5Location.netDirectionalField+0.16*liq+0.12*fvg+0.10*ob+0.07*st,-1.5,1.5);
}

void HT5DeepSenseTick()
{
   HT5NervousSense();
   HT5DeepBuildAtlases();
   HT5CollectDeepFeatures();
   if(gMDRTickSerial%8==0) HT5PredictDeepPatterns();
   HT5BuildCompoundScenarios();
   HT5BuildCommanderIntent();
   HT5AdaptivePhysiologyFromEvidence();
   HT5ApplyGeneExpressionToPhysiology();
}

void HT5DeepOnCampaignResolved(double net,double r,int errorClass)
{
   HT6SequenceLearnOutcome(r);
   HT5UpdateDeepFeatureOutcomeCorrelation(r);
   HT5UpdateOrganOutcomeCorrelation(r);
   HT5UpdateSubunitOutcome(r);
   HT5StoreDeepPattern(r,gEvoMaxFavorableR,gEvoMaxAdverseR,gEvoCampaignDirection,gHT5CampaignEntrySource);
   HT5WriteCampaignDataset(net,r,errorClass);
   HT5DeepGenomeResolve(r,errorClass);
   HT5SaveGenes();
}

// FEATURE 000: M1_ATR_LIVE_STABLE_RATIO
double HT5Feature_M1_ATR_LIVE_STABLE_RATIO()
{
   // Returns the normalized living-memory cell for M1_ATR_LIVE_STABLE_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[0];
}

// FEATURE 001: M1_RANGE_ATR
double HT5Feature_M1_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M1_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[1];
}

// FEATURE 002: M1_VELOCITY_ATR
double HT5Feature_M1_VELOCITY_ATR()
{
   // Returns the normalized living-memory cell for M1_VELOCITY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[2];
}

// FEATURE 003: M1_ACCELERATION_ATR
double HT5Feature_M1_ACCELERATION_ATR()
{
   // Returns the normalized living-memory cell for M1_ACCELERATION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[3];
}

// FEATURE 004: M1_EFFICIENCY
double HT5Feature_M1_EFFICIENCY()
{
   // Returns the normalized living-memory cell for M1_EFFICIENCY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[4];
}

// FEATURE 005: M1_COMPRESSION
double HT5Feature_M1_COMPRESSION()
{
   // Returns the normalized living-memory cell for M1_COMPRESSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[5];
}

// FEATURE 006: M1_EXPANSION
double HT5Feature_M1_EXPANSION()
{
   // Returns the normalized living-memory cell for M1_EXPANSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[6];
}

// FEATURE 007: M1_EMA_SLOPE_ATR
double HT5Feature_M1_EMA_SLOPE_ATR()
{
   // Returns the normalized living-memory cell for M1_EMA_SLOPE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[7];
}

// FEATURE 008: M1_LOCATION_20BAR
double HT5Feature_M1_LOCATION_20BAR()
{
   // Returns the normalized living-memory cell for M1_LOCATION_20BAR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[8];
}

// FEATURE 009: M1_VOLUME_RATIO
double HT5Feature_M1_VOLUME_RATIO()
{
   // Returns the normalized living-memory cell for M1_VOLUME_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[9];
}

// FEATURE 010: M1_CANDLE_BODY_ATR
double HT5Feature_M1_CANDLE_BODY_ATR()
{
   // Returns the normalized living-memory cell for M1_CANDLE_BODY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[10];
}

// FEATURE 011: M1_UPPER_WICK_ATR
double HT5Feature_M1_UPPER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M1_UPPER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[11];
}

// FEATURE 012: M1_LOWER_WICK_ATR
double HT5Feature_M1_LOWER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M1_LOWER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[12];
}

// FEATURE 013: M1_CLOSE_LOCATION
double HT5Feature_M1_CLOSE_LOCATION()
{
   // Returns the normalized living-memory cell for M1_CLOSE_LOCATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[13];
}

// FEATURE 014: M1_MOMENTUM_3BAR_ATR
double HT5Feature_M1_MOMENTUM_3BAR_ATR()
{
   // Returns the normalized living-memory cell for M1_MOMENTUM_3BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[14];
}

// FEATURE 015: M1_MOMENTUM_6BAR_ATR
double HT5Feature_M1_MOMENTUM_6BAR_ATR()
{
   // Returns the normalized living-memory cell for M1_MOMENTUM_6BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[15];
}

// FEATURE 016: M1_SWING_RANGE_ATR
double HT5Feature_M1_SWING_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M1_SWING_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[16];
}

// FEATURE 017: M1_DIRECTION_ALIGNMENT
double HT5Feature_M1_DIRECTION_ALIGNMENT()
{
   // Returns the normalized living-memory cell for M1_DIRECTION_ALIGNMENT.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[17];
}

// FEATURE 018: M1_REJECTION_BALANCE
double HT5Feature_M1_REJECTION_BALANCE()
{
   // Returns the normalized living-memory cell for M1_REJECTION_BALANCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[18];
}

// FEATURE 019: M1_VOLUME_DIRECTION_IMPULSE
double HT5Feature_M1_VOLUME_DIRECTION_IMPULSE()
{
   // Returns the normalized living-memory cell for M1_VOLUME_DIRECTION_IMPULSE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[19];
}

// FEATURE 020: M5_ATR_LIVE_STABLE_RATIO
double HT5Feature_M5_ATR_LIVE_STABLE_RATIO()
{
   // Returns the normalized living-memory cell for M5_ATR_LIVE_STABLE_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[20];
}

// FEATURE 021: M5_RANGE_ATR
double HT5Feature_M5_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M5_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[21];
}

// FEATURE 022: M5_VELOCITY_ATR
double HT5Feature_M5_VELOCITY_ATR()
{
   // Returns the normalized living-memory cell for M5_VELOCITY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[22];
}

// FEATURE 023: M5_ACCELERATION_ATR
double HT5Feature_M5_ACCELERATION_ATR()
{
   // Returns the normalized living-memory cell for M5_ACCELERATION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[23];
}

// FEATURE 024: M5_EFFICIENCY
double HT5Feature_M5_EFFICIENCY()
{
   // Returns the normalized living-memory cell for M5_EFFICIENCY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[24];
}

// FEATURE 025: M5_COMPRESSION
double HT5Feature_M5_COMPRESSION()
{
   // Returns the normalized living-memory cell for M5_COMPRESSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[25];
}

// FEATURE 026: M5_EXPANSION
double HT5Feature_M5_EXPANSION()
{
   // Returns the normalized living-memory cell for M5_EXPANSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[26];
}

// FEATURE 027: M5_EMA_SLOPE_ATR
double HT5Feature_M5_EMA_SLOPE_ATR()
{
   // Returns the normalized living-memory cell for M5_EMA_SLOPE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[27];
}

// FEATURE 028: M5_LOCATION_20BAR
double HT5Feature_M5_LOCATION_20BAR()
{
   // Returns the normalized living-memory cell for M5_LOCATION_20BAR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[28];
}

// FEATURE 029: M5_VOLUME_RATIO
double HT5Feature_M5_VOLUME_RATIO()
{
   // Returns the normalized living-memory cell for M5_VOLUME_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[29];
}

// FEATURE 030: M5_CANDLE_BODY_ATR
double HT5Feature_M5_CANDLE_BODY_ATR()
{
   // Returns the normalized living-memory cell for M5_CANDLE_BODY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[30];
}

// FEATURE 031: M5_UPPER_WICK_ATR
double HT5Feature_M5_UPPER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M5_UPPER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[31];
}

// FEATURE 032: M5_LOWER_WICK_ATR
double HT5Feature_M5_LOWER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M5_LOWER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[32];
}

// FEATURE 033: M5_CLOSE_LOCATION
double HT5Feature_M5_CLOSE_LOCATION()
{
   // Returns the normalized living-memory cell for M5_CLOSE_LOCATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[33];
}

// FEATURE 034: M5_MOMENTUM_3BAR_ATR
double HT5Feature_M5_MOMENTUM_3BAR_ATR()
{
   // Returns the normalized living-memory cell for M5_MOMENTUM_3BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[34];
}

// FEATURE 035: M5_MOMENTUM_6BAR_ATR
double HT5Feature_M5_MOMENTUM_6BAR_ATR()
{
   // Returns the normalized living-memory cell for M5_MOMENTUM_6BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[35];
}

// FEATURE 036: M5_SWING_RANGE_ATR
double HT5Feature_M5_SWING_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M5_SWING_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[36];
}

// FEATURE 037: M5_DIRECTION_ALIGNMENT
double HT5Feature_M5_DIRECTION_ALIGNMENT()
{
   // Returns the normalized living-memory cell for M5_DIRECTION_ALIGNMENT.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[37];
}

// FEATURE 038: M5_REJECTION_BALANCE
double HT5Feature_M5_REJECTION_BALANCE()
{
   // Returns the normalized living-memory cell for M5_REJECTION_BALANCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[38];
}

// FEATURE 039: M5_VOLUME_DIRECTION_IMPULSE
double HT5Feature_M5_VOLUME_DIRECTION_IMPULSE()
{
   // Returns the normalized living-memory cell for M5_VOLUME_DIRECTION_IMPULSE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[39];
}

// FEATURE 040: M15_ATR_LIVE_STABLE_RATIO
double HT5Feature_M15_ATR_LIVE_STABLE_RATIO()
{
   // Returns the normalized living-memory cell for M15_ATR_LIVE_STABLE_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[40];
}

// FEATURE 041: M15_RANGE_ATR
double HT5Feature_M15_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M15_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[41];
}

// FEATURE 042: M15_VELOCITY_ATR
double HT5Feature_M15_VELOCITY_ATR()
{
   // Returns the normalized living-memory cell for M15_VELOCITY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[42];
}

// FEATURE 043: M15_ACCELERATION_ATR
double HT5Feature_M15_ACCELERATION_ATR()
{
   // Returns the normalized living-memory cell for M15_ACCELERATION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[43];
}

// FEATURE 044: M15_EFFICIENCY
double HT5Feature_M15_EFFICIENCY()
{
   // Returns the normalized living-memory cell for M15_EFFICIENCY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[44];
}

// FEATURE 045: M15_COMPRESSION
double HT5Feature_M15_COMPRESSION()
{
   // Returns the normalized living-memory cell for M15_COMPRESSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[45];
}

// FEATURE 046: M15_EXPANSION
double HT5Feature_M15_EXPANSION()
{
   // Returns the normalized living-memory cell for M15_EXPANSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[46];
}

// FEATURE 047: M15_EMA_SLOPE_ATR
double HT5Feature_M15_EMA_SLOPE_ATR()
{
   // Returns the normalized living-memory cell for M15_EMA_SLOPE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[47];
}

// FEATURE 048: M15_LOCATION_20BAR
double HT5Feature_M15_LOCATION_20BAR()
{
   // Returns the normalized living-memory cell for M15_LOCATION_20BAR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[48];
}

// FEATURE 049: M15_VOLUME_RATIO
double HT5Feature_M15_VOLUME_RATIO()
{
   // Returns the normalized living-memory cell for M15_VOLUME_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[49];
}

// FEATURE 050: M15_CANDLE_BODY_ATR
double HT5Feature_M15_CANDLE_BODY_ATR()
{
   // Returns the normalized living-memory cell for M15_CANDLE_BODY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[50];
}

// FEATURE 051: M15_UPPER_WICK_ATR
double HT5Feature_M15_UPPER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M15_UPPER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[51];
}

// FEATURE 052: M15_LOWER_WICK_ATR
double HT5Feature_M15_LOWER_WICK_ATR()
{
   // Returns the normalized living-memory cell for M15_LOWER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[52];
}

// FEATURE 053: M15_CLOSE_LOCATION
double HT5Feature_M15_CLOSE_LOCATION()
{
   // Returns the normalized living-memory cell for M15_CLOSE_LOCATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[53];
}

// FEATURE 054: M15_MOMENTUM_3BAR_ATR
double HT5Feature_M15_MOMENTUM_3BAR_ATR()
{
   // Returns the normalized living-memory cell for M15_MOMENTUM_3BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[54];
}

// FEATURE 055: M15_MOMENTUM_6BAR_ATR
double HT5Feature_M15_MOMENTUM_6BAR_ATR()
{
   // Returns the normalized living-memory cell for M15_MOMENTUM_6BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[55];
}

// FEATURE 056: M15_SWING_RANGE_ATR
double HT5Feature_M15_SWING_RANGE_ATR()
{
   // Returns the normalized living-memory cell for M15_SWING_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[56];
}

// FEATURE 057: M15_DIRECTION_ALIGNMENT
double HT5Feature_M15_DIRECTION_ALIGNMENT()
{
   // Returns the normalized living-memory cell for M15_DIRECTION_ALIGNMENT.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[57];
}

// FEATURE 058: M15_REJECTION_BALANCE
double HT5Feature_M15_REJECTION_BALANCE()
{
   // Returns the normalized living-memory cell for M15_REJECTION_BALANCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[58];
}

// FEATURE 059: M15_VOLUME_DIRECTION_IMPULSE
double HT5Feature_M15_VOLUME_DIRECTION_IMPULSE()
{
   // Returns the normalized living-memory cell for M15_VOLUME_DIRECTION_IMPULSE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[59];
}

// FEATURE 060: H1_ATR_LIVE_STABLE_RATIO
double HT5Feature_H1_ATR_LIVE_STABLE_RATIO()
{
   // Returns the normalized living-memory cell for H1_ATR_LIVE_STABLE_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[60];
}

// FEATURE 061: H1_RANGE_ATR
double HT5Feature_H1_RANGE_ATR()
{
   // Returns the normalized living-memory cell for H1_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[61];
}

// FEATURE 062: H1_VELOCITY_ATR
double HT5Feature_H1_VELOCITY_ATR()
{
   // Returns the normalized living-memory cell for H1_VELOCITY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[62];
}

// FEATURE 063: H1_ACCELERATION_ATR
double HT5Feature_H1_ACCELERATION_ATR()
{
   // Returns the normalized living-memory cell for H1_ACCELERATION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[63];
}

// FEATURE 064: H1_EFFICIENCY
double HT5Feature_H1_EFFICIENCY()
{
   // Returns the normalized living-memory cell for H1_EFFICIENCY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[64];
}

// FEATURE 065: H1_COMPRESSION
double HT5Feature_H1_COMPRESSION()
{
   // Returns the normalized living-memory cell for H1_COMPRESSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[65];
}

// FEATURE 066: H1_EXPANSION
double HT5Feature_H1_EXPANSION()
{
   // Returns the normalized living-memory cell for H1_EXPANSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[66];
}

// FEATURE 067: H1_EMA_SLOPE_ATR
double HT5Feature_H1_EMA_SLOPE_ATR()
{
   // Returns the normalized living-memory cell for H1_EMA_SLOPE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[67];
}

// FEATURE 068: H1_LOCATION_20BAR
double HT5Feature_H1_LOCATION_20BAR()
{
   // Returns the normalized living-memory cell for H1_LOCATION_20BAR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[68];
}

// FEATURE 069: H1_VOLUME_RATIO
double HT5Feature_H1_VOLUME_RATIO()
{
   // Returns the normalized living-memory cell for H1_VOLUME_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[69];
}

// FEATURE 070: H1_CANDLE_BODY_ATR
double HT5Feature_H1_CANDLE_BODY_ATR()
{
   // Returns the normalized living-memory cell for H1_CANDLE_BODY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[70];
}

// FEATURE 071: H1_UPPER_WICK_ATR
double HT5Feature_H1_UPPER_WICK_ATR()
{
   // Returns the normalized living-memory cell for H1_UPPER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[71];
}

// FEATURE 072: H1_LOWER_WICK_ATR
double HT5Feature_H1_LOWER_WICK_ATR()
{
   // Returns the normalized living-memory cell for H1_LOWER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[72];
}

// FEATURE 073: H1_CLOSE_LOCATION
double HT5Feature_H1_CLOSE_LOCATION()
{
   // Returns the normalized living-memory cell for H1_CLOSE_LOCATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[73];
}

// FEATURE 074: H1_MOMENTUM_3BAR_ATR
double HT5Feature_H1_MOMENTUM_3BAR_ATR()
{
   // Returns the normalized living-memory cell for H1_MOMENTUM_3BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[74];
}

// FEATURE 075: H1_MOMENTUM_6BAR_ATR
double HT5Feature_H1_MOMENTUM_6BAR_ATR()
{
   // Returns the normalized living-memory cell for H1_MOMENTUM_6BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[75];
}

// FEATURE 076: H1_SWING_RANGE_ATR
double HT5Feature_H1_SWING_RANGE_ATR()
{
   // Returns the normalized living-memory cell for H1_SWING_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[76];
}

// FEATURE 077: H1_DIRECTION_ALIGNMENT
double HT5Feature_H1_DIRECTION_ALIGNMENT()
{
   // Returns the normalized living-memory cell for H1_DIRECTION_ALIGNMENT.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[77];
}

// FEATURE 078: H1_REJECTION_BALANCE
double HT5Feature_H1_REJECTION_BALANCE()
{
   // Returns the normalized living-memory cell for H1_REJECTION_BALANCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[78];
}

// FEATURE 079: H1_VOLUME_DIRECTION_IMPULSE
double HT5Feature_H1_VOLUME_DIRECTION_IMPULSE()
{
   // Returns the normalized living-memory cell for H1_VOLUME_DIRECTION_IMPULSE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[79];
}

// FEATURE 080: H4_ATR_LIVE_STABLE_RATIO
double HT5Feature_H4_ATR_LIVE_STABLE_RATIO()
{
   // Returns the normalized living-memory cell for H4_ATR_LIVE_STABLE_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[80];
}

// FEATURE 081: H4_RANGE_ATR
double HT5Feature_H4_RANGE_ATR()
{
   // Returns the normalized living-memory cell for H4_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[81];
}

// FEATURE 082: H4_VELOCITY_ATR
double HT5Feature_H4_VELOCITY_ATR()
{
   // Returns the normalized living-memory cell for H4_VELOCITY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[82];
}

// FEATURE 083: H4_ACCELERATION_ATR
double HT5Feature_H4_ACCELERATION_ATR()
{
   // Returns the normalized living-memory cell for H4_ACCELERATION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[83];
}

// FEATURE 084: H4_EFFICIENCY
double HT5Feature_H4_EFFICIENCY()
{
   // Returns the normalized living-memory cell for H4_EFFICIENCY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[84];
}

// FEATURE 085: H4_COMPRESSION
double HT5Feature_H4_COMPRESSION()
{
   // Returns the normalized living-memory cell for H4_COMPRESSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[85];
}

// FEATURE 086: H4_EXPANSION
double HT5Feature_H4_EXPANSION()
{
   // Returns the normalized living-memory cell for H4_EXPANSION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[86];
}

// FEATURE 087: H4_EMA_SLOPE_ATR
double HT5Feature_H4_EMA_SLOPE_ATR()
{
   // Returns the normalized living-memory cell for H4_EMA_SLOPE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[87];
}

// FEATURE 088: H4_LOCATION_20BAR
double HT5Feature_H4_LOCATION_20BAR()
{
   // Returns the normalized living-memory cell for H4_LOCATION_20BAR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[88];
}

// FEATURE 089: H4_VOLUME_RATIO
double HT5Feature_H4_VOLUME_RATIO()
{
   // Returns the normalized living-memory cell for H4_VOLUME_RATIO.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[89];
}

// FEATURE 090: H4_CANDLE_BODY_ATR
double HT5Feature_H4_CANDLE_BODY_ATR()
{
   // Returns the normalized living-memory cell for H4_CANDLE_BODY_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[90];
}

// FEATURE 091: H4_UPPER_WICK_ATR
double HT5Feature_H4_UPPER_WICK_ATR()
{
   // Returns the normalized living-memory cell for H4_UPPER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[91];
}

// FEATURE 092: H4_LOWER_WICK_ATR
double HT5Feature_H4_LOWER_WICK_ATR()
{
   // Returns the normalized living-memory cell for H4_LOWER_WICK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[92];
}

// FEATURE 093: H4_CLOSE_LOCATION
double HT5Feature_H4_CLOSE_LOCATION()
{
   // Returns the normalized living-memory cell for H4_CLOSE_LOCATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[93];
}

// FEATURE 094: H4_MOMENTUM_3BAR_ATR
double HT5Feature_H4_MOMENTUM_3BAR_ATR()
{
   // Returns the normalized living-memory cell for H4_MOMENTUM_3BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[94];
}

// FEATURE 095: H4_MOMENTUM_6BAR_ATR
double HT5Feature_H4_MOMENTUM_6BAR_ATR()
{
   // Returns the normalized living-memory cell for H4_MOMENTUM_6BAR_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[95];
}

// FEATURE 096: H4_SWING_RANGE_ATR
double HT5Feature_H4_SWING_RANGE_ATR()
{
   // Returns the normalized living-memory cell for H4_SWING_RANGE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[96];
}

// FEATURE 097: H4_DIRECTION_ALIGNMENT
double HT5Feature_H4_DIRECTION_ALIGNMENT()
{
   // Returns the normalized living-memory cell for H4_DIRECTION_ALIGNMENT.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[97];
}

// FEATURE 098: H4_REJECTION_BALANCE
double HT5Feature_H4_REJECTION_BALANCE()
{
   // Returns the normalized living-memory cell for H4_REJECTION_BALANCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[98];
}

// FEATURE 099: H4_VOLUME_DIRECTION_IMPULSE
double HT5Feature_H4_VOLUME_DIRECTION_IMPULSE()
{
   // Returns the normalized living-memory cell for H4_VOLUME_DIRECTION_IMPULSE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[99];
}

// FEATURE 100: STRUCTURE_ATR
double HT5Feature_STRUCTURE_ATR()
{
   // Returns the normalized living-memory cell for STRUCTURE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[100];
}

// FEATURE 101: BOS_ATR
double HT5Feature_BOS_ATR()
{
   // Returns the normalized living-memory cell for BOS_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[101];
}

// FEATURE 102: PRESSURE_ATR
double HT5Feature_PRESSURE_ATR()
{
   // Returns the normalized living-memory cell for PRESSURE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[102];
}

// FEATURE 103: ROUTE_ATR
double HT5Feature_ROUTE_ATR()
{
   // Returns the normalized living-memory cell for ROUTE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[103];
}

// FEATURE 104: HISTORICAL_CHANNEL_ATR
double HT5Feature_HISTORICAL_CHANNEL_ATR()
{
   // Returns the normalized living-memory cell for HISTORICAL_CHANNEL_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[104];
}

// FEATURE 105: RHYTHM_SCORE
double HT5Feature_RHYTHM_SCORE()
{
   // Returns the normalized living-memory cell for RHYTHM_SCORE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[105];
}

// FEATURE 106: RHYTHM_FORCE
double HT5Feature_RHYTHM_FORCE()
{
   // Returns the normalized living-memory cell for RHYTHM_FORCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[106];
}

// FEATURE 107: RHYTHM_PULLBACK
double HT5Feature_RHYTHM_PULLBACK()
{
   // Returns the normalized living-memory cell for RHYTHM_PULLBACK.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[107];
}

// FEATURE 108: RHYTHM_CADENCE
double HT5Feature_RHYTHM_CADENCE()
{
   // Returns the normalized living-memory cell for RHYTHM_CADENCE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[108];
}

// FEATURE 109: TICK_ENTROPY
double HT5Feature_TICK_ENTROPY()
{
   // Returns the normalized living-memory cell for TICK_ENTROPY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[109];
}

// FEATURE 110: TICK_JERK_ATR
double HT5Feature_TICK_JERK_ATR()
{
   // Returns the normalized living-memory cell for TICK_JERK_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[110];
}

// FEATURE 111: DAY_RANGE_POSITION
double HT5Feature_DAY_RANGE_POSITION()
{
   // Returns the normalized living-memory cell for DAY_RANGE_POSITION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[111];
}

// FEATURE 112: SIGNAL_FVG_FIELD
double HT5Feature_SIGNAL_FVG_FIELD()
{
   // Returns the normalized living-memory cell for SIGNAL_FVG_FIELD.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[112];
}

// FEATURE 113: ORDER_BLOCK_FIELD
double HT5Feature_ORDER_BLOCK_FIELD()
{
   // Returns the normalized living-memory cell for ORDER_BLOCK_FIELD.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[113];
}

// FEATURE 114: STATION_FIELD
double HT5Feature_STATION_FIELD()
{
   // Returns the normalized living-memory cell for STATION_FIELD.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[114];
}

// FEATURE 115: RECLAIM_FIELD
double HT5Feature_RECLAIM_FIELD()
{
   // Returns the normalized living-memory cell for RECLAIM_FIELD.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[115];
}

// FEATURE 116: NET_LOCATION_FIELD
double HT5Feature_NET_LOCATION_FIELD()
{
   // Returns the normalized living-memory cell for NET_LOCATION_FIELD.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[116];
}

// FEATURE 117: ORACLE_MICRO_TREND
double HT5Feature_ORACLE_MICRO_TREND()
{
   // Returns the normalized living-memory cell for ORACLE_MICRO_TREND.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[117];
}

// FEATURE 118: ORACLE_OB_FVG
double HT5Feature_ORACLE_OB_FVG()
{
   // Returns the normalized living-memory cell for ORACLE_OB_FVG.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[118];
}

// FEATURE 119: ORACLE_PHASE
double HT5Feature_ORACLE_PHASE()
{
   // Returns the normalized living-memory cell for ORACLE_PHASE.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[119];
}

// FEATURE 120: INFLECTION_ATR
double HT5Feature_INFLECTION_ATR()
{
   // Returns the normalized living-memory cell for INFLECTION_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[120];
}

// FEATURE 121: ACCEPTANCE_ATR
double HT5Feature_ACCEPTANCE_ATR()
{
   // Returns the normalized living-memory cell for ACCEPTANCE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[121];
}

// FEATURE 122: PREDICTION_UNCERTAINTY
double HT5Feature_PREDICTION_UNCERTAINTY()
{
   // Returns the normalized living-memory cell for PREDICTION_UNCERTAINTY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[122];
}

// FEATURE 123: EXPECTED_ADVERSE_ATR
double HT5Feature_EXPECTED_ADVERSE_ATR()
{
   // Returns the normalized living-memory cell for EXPECTED_ADVERSE_ATR.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[123];
}

// FEATURE 124: COMPOUND_PROGRESS
double HT5Feature_COMPOUND_PROGRESS()
{
   // Returns the normalized living-memory cell for COMPOUND_PROGRESS.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[124];
}

// FEATURE 125: CAMPAIGN_RISK_UTILIZATION
double HT5Feature_CAMPAIGN_RISK_UTILIZATION()
{
   // Returns the normalized living-memory cell for CAMPAIGN_RISK_UTILIZATION.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[125];
}

// FEATURE 126: SESSION_LIQUIDITY_QUALITY
double HT5Feature_SESSION_LIQUIDITY_QUALITY()
{
   // Returns the normalized living-memory cell for SESSION_LIQUIDITY_QUALITY.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[126];
}

// FEATURE 127: DEEP_PATTERN_PREDICTION_R
double HT5Feature_DEEP_PATTERN_PREDICTION_R()
{
   // Returns the normalized living-memory cell for DEEP_PATTERN_PREDICTION_R.
   // The cell is updated by HT5CollectDeepFeatures and standardized by its
   // own EWMA/variance before it influences nearest-pattern memory.
   return gHT5DeepFeature[127];
}

string HT5Diagnose_CHRONOS()
{
   double h=gHT5OrganHealth[0];
   double rel=gHT5OrganReliability[0];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "CHRONOS • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[0];
}

string HT5Diagnose_LUNGS()
{
   double h=gHT5OrganHealth[1];
   double rel=gHT5OrganReliability[1];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "LUNGS • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[1];
}

string HT5Diagnose_HEART()
{
   double h=gHT5OrganHealth[2];
   double rel=gHT5OrganReliability[2];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "HEART • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[2];
}

string HT5Diagnose_SKELETON()
{
   double h=gHT5OrganHealth[3];
   double rel=gHT5OrganReliability[3];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "SKELETON • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[3];
}

string HT5Diagnose_EYES()
{
   double h=gHT5OrganHealth[4];
   double rel=gHT5OrganReliability[4];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "EYES • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[4];
}

string HT5Diagnose_ORACLE()
{
   double h=gHT5OrganHealth[5];
   double rel=gHT5OrganReliability[5];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "ORACLE • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[5];
}

string HT5Diagnose_BRAIN()
{
   double h=gHT5OrganHealth[6];
   double rel=gHT5OrganReliability[6];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "BRAIN • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[6];
}

string HT5Diagnose_HANDS()
{
   double h=gHT5OrganHealth[7];
   double rel=gHT5OrganReliability[7];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "HANDS • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[7];
}

string HT5Diagnose_MUSCLES()
{
   double h=gHT5OrganHealth[8];
   double rel=gHT5OrganReliability[8];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "MUSCLES • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[8];
}

string HT5Diagnose_IMMUNE()
{
   double h=gHT5OrganHealth[9];
   double rel=gHT5OrganReliability[9];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "IMMUNE • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[9];
}

string HT5Diagnose_METABOLISM()
{
   double h=gHT5OrganHealth[10];
   double rel=gHT5OrganReliability[10];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "METABOLISM • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[10];
}

string HT5Diagnose_MEMORY()
{
   double h=gHT5OrganHealth[11];
   double rel=gHT5OrganReliability[11];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "MEMORY • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[11];
}

string HT5Diagnose_GENOME()
{
   double h=gHT5OrganHealth[12];
   double rel=gHT5OrganReliability[12];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "GENOME • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[12];
}

string HT5Diagnose_HOSPITAL()
{
   double h=gHT5OrganHealth[13];
   double rel=gHT5OrganReliability[13];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "HOSPITAL • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[13];
}

string HT5Diagnose_COMMANDER()
{
   double h=gHT5OrganHealth[14];
   double rel=gHT5OrganReliability[14];
   string band=(h>=0.80?"STRONG":(h>=0.55?"HEALTHY":(h>=0.30?"STRESSED":"CRITICAL")));
   string learned=(rel>1.05?"LEARNED POSITIVE":(rel<0.95?"LEARNED CAUTION":"NEUTRAL"));
   return "COMMANDER • "+band+" • H "+DoubleToString(h,2)+" • REL "+DoubleToString(rel,2)+" • "+learned+" • "+gHT5OrganState[14];
}




//===============================================================================
// MULTI-TIMEFRAME SKELETON ATLAS
// Each timeframe owns confirmed pivots, structural travel, BOS and acceptance.
//===============================================================================
struct HT5_StructureFrame
{
   int tf;
   double high1,high2,low1,low2;
   datetime highTime1,highTime2,lowTime1,lowTime2;
   double highTravelATR;
   double lowTravelATR;
   double structureATR;
   double bosATR;
   double acceptance;
   double retraceFraction;
   double swingRangeATR;
   int direction;
   int bosDirection;
   int pivotCount;
   string state;
};
HT5_StructureFrame gHT5StructureFrame[5];
datetime gHT5StructureAtlasLastBar=0;
double gHT5StructureAtlasPotential=0.0;
double gHT5StructureAtlasAgreement=0.0;
string gHT5StructureAtlasState="STRUCTURE ATLAS INITIALIZING";

bool HT5IsPivotHighTF(int tf,int shift,int wing)
{
   if(shift<=wing) return false;
   double h=iHigh(Symbol(),tf,shift);
   for(int w=1;w<=wing;w++)
      if(h<=iHigh(Symbol(),tf,shift-w) || h<iHigh(Symbol(),tf,shift+w)) return false;
   return true;
}

bool HT5IsPivotLowTF(int tf,int shift,int wing)
{
   if(shift<=wing) return false;
   double l=iLow(Symbol(),tf,shift);
   for(int w=1;w<=wing;w++)
      if(l>=iLow(Symbol(),tf,shift-w) || l>iLow(Symbol(),tf,shift+w)) return false;
   return true;
}

void HT5BuildStructureFrame(int idx)
{
   if(idx<0 || idx>=5) return;
   int tf=HT5TimeframeByIndex(idx);
   int bars=iBars(Symbol(),tf);
   if(bars<80) return;
   int wing=2;
   double h1=0,h2=0,l1=0,l2=0;
   datetime ht1=0,ht2=0,lt1=0,lt2=0;
   int piv=0;
   for(int s=wing+1;s<MathMin(220,bars-wing-1);s++)
   {
      if(h1<=0.0 && HT5IsPivotHighTF(tf,s,wing)){ h1=iHigh(Symbol(),tf,s); ht1=iTime(Symbol(),tf,s); piv++; continue; }
      if(h2<=0.0 && HT5IsPivotHighTF(tf,s,wing)){ h2=iHigh(Symbol(),tf,s); ht2=iTime(Symbol(),tf,s); piv++; }
      if(l1<=0.0 && HT5IsPivotLowTF(tf,s,wing)){ l1=iLow(Symbol(),tf,s); lt1=iTime(Symbol(),tf,s); piv++; continue; }
      if(l2<=0.0 && HT5IsPivotLowTF(tf,s,wing)){ l2=iLow(Symbol(),tf,s); lt2=iTime(Symbol(),tf,s); piv++; }
      if(h1>0 && h2>0 && l1>0 && l2>0) break;
   }
   double atr=MathMax(Point,HTStableATR(tf,14));
   double dh=(h1>0&&h2>0?(h1-h2)/atr:0.0);
   double dl=(l1>0&&l2>0?(l1-l2)/atr:0.0);
   double structural=0.50*(dh+dl);
   bool hh=(h1>h2 && h2>0),hl=(l1>l2 && l2>0),lh=(h1<h2 && h2>0),ll=(l1<l2 && l2>0);
   if(hh&&hl) structural+=0.15;
   if(lh&&ll) structural-=0.15;
   int dir=(hh&&hl?DIR_BUY:(lh&&ll?DIR_SELL:HT5Sign(structural)));
   double close=iClose(Symbol(),tf,0);
   double bos=0.0; int bosDir=DIR_FLAT;
   if(h1>0 && close>h1){ bos=(close-h1)/atr; bosDir=DIR_BUY; }
   if(l1>0 && close<l1){ bos=-(l1-close)/atr; bosDir=DIR_SELL; }
   double range=MathMax(Point,(h1>0&&l1>0?h1-l1:atr));
   double retrace=0.5;
   if(dir==DIR_BUY && l1>0 && h1>l1) retrace=HT5Clamp((h1-close)/(h1-l1),0.0,1.5);
   if(dir==DIR_SELL && h1>l1 && l1>0) retrace=HT5Clamp((close-l1)/(h1-l1),0.0,1.5);
   double accept=0.0;
   if(bosDir==DIR_BUY && h1>0) accept=HT5Clamp((close-h1)/atr,0.0,1.5);
   if(bosDir==DIR_SELL && l1>0) accept=HT5Clamp((l1-close)/atr,0.0,1.5);

   gHT5StructureFrame[idx].tf=tf;
   gHT5StructureFrame[idx].high1=h1; gHT5StructureFrame[idx].high2=h2;
   gHT5StructureFrame[idx].low1=l1; gHT5StructureFrame[idx].low2=l2;
   gHT5StructureFrame[idx].highTime1=ht1; gHT5StructureFrame[idx].highTime2=ht2;
   gHT5StructureFrame[idx].lowTime1=lt1; gHT5StructureFrame[idx].lowTime2=lt2;
   gHT5StructureFrame[idx].highTravelATR=dh; gHT5StructureFrame[idx].lowTravelATR=dl;
   gHT5StructureFrame[idx].structureATR=HT5Clamp(structural,-3.0,3.0);
   gHT5StructureFrame[idx].bosATR=HT5Clamp(bos,-3.0,3.0);
   gHT5StructureFrame[idx].acceptance=accept;
   gHT5StructureFrame[idx].retraceFraction=retrace;
   gHT5StructureFrame[idx].swingRangeATR=range/atr;
   gHT5StructureFrame[idx].direction=dir; gHT5StructureFrame[idx].bosDirection=bosDir; gHT5StructureFrame[idx].pivotCount=piv;
   gHT5StructureFrame[idx].state=(dir==DIR_BUY?"HH/HL":(dir==DIR_SELL?"LH/LL":"MIXED"));
   if(bosDir==DIR_BUY) gHT5StructureFrame[idx].state+=" + BULL BOS";
   if(bosDir==DIR_SELL) gHT5StructureFrame[idx].state+=" + BEAR BOS";
}

void HT5BuildStructureAtlas()
{
   datetime bar=iTime(Symbol(),SignalTF,0);
   if(bar==0 || bar==gHT5StructureAtlasLastBar) return;
   gHT5StructureAtlasLastBar=bar;
   for(int i=0;i<5;i++) HT5BuildStructureFrame(i);
   double w[5]={0.08,0.20,0.28,0.28,0.16};
   double sum=0.0,agreement=0.0;
   int reference=(gMDDesiredDirection!=DIR_FLAT?gMDDesiredDirection:gHT5Brain.direction);
   for(int j=0;j<5;j++)
   {
      sum+=w[j]*(0.72*gHT5StructureFrame[j].structureATR+0.28*gHT5StructureFrame[j].bosATR);
      if(reference!=DIR_FLAT && gHT5StructureFrame[j].direction==reference) agreement+=w[j];
   }
   gHT5StructureAtlasPotential=HT5Clamp(sum,-3.0,3.0);
   gHT5StructureAtlasAgreement=HT5Clamp(agreement,0.0,1.0);
   gHT5StructureAtlasState="MTF STRUCT "+DoubleToString(gHT5StructureAtlasPotential,2)+"A • AGREE "+DoubleToString(gHT5StructureAtlasAgreement,2);
}

//===============================================================================
// BROKER WEATHER / LIQUIDITY WEATHER
// Measures whether a mathematically valid signal can be executed efficiently.
//===============================================================================
struct HT5_BrokerWeather
{
   double spreadPoints;
   double spreadATR;
   double tickValue;
   double tickSize;
   double contractSize;
   double minLot;
   double lotStep;
   double maxLot;
   double stopLevelPoints;
   double freezeLevelPoints;
   double marginPerMinLot;
   double projectedMarginLevel;
   double metadataConsistency;
   double executionQuality;
   bool tradeAllowed;
   string state;
};
HT5_BrokerWeather gHT5Broker;

void HT5BrokerWeatherSense()
{
   RefreshRates();
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   gHT5Broker.spreadPoints=(Ask-Bid)/Point;
   gHT5Broker.spreadATR=(Ask-Bid)/atr;
   gHT5Broker.tickValue=MarketInfo(Symbol(),MODE_TICKVALUE);
   gHT5Broker.tickSize=TickSizePrice();
   gHT5Broker.contractSize=MarketInfo(Symbol(),MODE_LOTSIZE);
   gHT5Broker.minLot=MarketInfo(Symbol(),MODE_MINLOT);
   gHT5Broker.lotStep=MarketInfo(Symbol(),MODE_LOTSTEP);
   gHT5Broker.maxLot=MarketInfo(Symbol(),MODE_MAXLOT);
   gHT5Broker.stopLevelPoints=MarketInfo(Symbol(),MODE_STOPLEVEL);
   gHT5Broker.freezeLevelPoints=MarketInfo(Symbol(),MODE_FREEZELEVEL);
   double fm=AccountFreeMarginCheck(Symbol(),OP_BUY,MathMax(gHT5Broker.minLot,0.01));
   gHT5Broker.marginPerMinLot=MathMax(0.0,AccountFreeMargin()-fm);
   gHT5Broker.projectedMarginLevel=(AccountMargin()>0.0?100.0*AccountEquity()/AccountMargin():9999.0);
   double brokerCash=(gHT5Broker.tickValue>0&&gHT5Broker.tickSize>0?gHT5Broker.tickValue/gHT5Broker.tickSize:0.0);
   double contractCash=MathMax(0.0,gHT5Broker.contractSize);
   if(brokerCash>0 && contractCash>0) gHT5Broker.metadataConsistency=MathMin(brokerCash,contractCash)/MathMax(brokerCash,contractCash);
   else gHT5Broker.metadataConsistency=0.0;
   double spreadQ=1.0-HT5Clamp(gHT5Broker.spreadATR/0.12,0.0,1.0);
   double metaQ=HT5Clamp(gHT5Broker.metadataConsistency/0.80,0.0,1.0);
   double marginQ=HT5Clamp((gHT5Broker.projectedMarginLevel-100.0)/400.0,0.0,1.0);
   gHT5Broker.executionQuality=0.45*spreadQ+0.25*metaQ+0.30*marginQ;
   gHT5Broker.tradeAllowed=(IsTradeAllowed() && !IsTradeContextBusy());
   gHT5Broker.state="BROKER Q "+DoubleToString(gHT5Broker.executionQuality,2)+" • SPR "+DoubleToString(gHT5Broker.spreadPoints,1)+"pt • ML "+DoubleToString(gHT5Broker.projectedMarginLevel,0)+"%";
   gHT5LiquidityQuality=HT5Clamp(0.55*gHT5Broker.executionQuality+0.45*gHT5SessionQuality,0.0,1.20);
}


//===============================================================================
// v6.00 MARKET-SEQUENCE DOCTRINE ENGINE
// PURPOSE MAP
// CHRONOS    = when / session quality only.
// LUNGS      = volatility / breathing room only.
// HEART      = live tick rhythm, launch force, pace and decay only.
// SKELETON   = structural direction, BOS and campaign continuity only.
// EYES       = FVG/OB/station/reclaim/day/channel location only.
// ORACLE     = regime interpretation only; never independent direction authority.
// TRIBUNAL   = names evidence and setup witnesses; never owns broker execution.
// HANDS      = PULSE pending inventory only after a campaign is already legitimate.
// MUSCLES    = SONIC earned growth only in permitted sequence phases.
// IMMUNE     = exposure, stop, margin, survival and phase defense.
// METABOLISM = compound target and current-balance rebase only.
// WILL       = remembers expectancy by phase/move/pause/source.
// SURF       = magnitude/error learner only; never primary direction.
// GENOME     = shadow/autopsy by default; bounded mutation only when explicitly enabled.
// HOSPITAL   = detects deadlock/pathology; cannot manufacture a trade.
// SEQUENCE   = tells the creature WHAT CHAPTER of the campaign it is in.
// COMMANDER  = the only broker membrane.  It enforces this doctrine last.
//===============================================================================

string HT6PhaseName(int phase)
{
   if(phase==SEQ_PHASE_ATTACK) return "PHASE 1 ATTACK";
   if(phase==SEQ_PHASE_ACCELERATE) return "PHASE 2 ACCELERATE";
   if(phase==SEQ_PHASE_ZONE_3_5) return "PHASE 3 ZONE 3-5";
   if(phase==SEQ_PHASE_DEFEND) return "PHASE 4 DEFEND";
   if(phase==SEQ_PHASE_HARVEST) return "PHASE 5 HARVEST";
   return "PHASE 0 OBSERVE";
}

string HT6MoveTypeName(int type)
{
   if(type==MOVE_TYPE_DIRECT) return "DIRECT";
   if(type==MOVE_TYPE_TWO_STAGE) return "TWO-STAGE";
   if(type==MOVE_TYPE_STAIRCASE) return "STAIRCASE";
   return "UNCLASSIFIED";
}

string HT6PauseTypeName(int type)
{
   if(type==PAUSE_TYPE_PULLBACK) return "PULLBACK";
   if(type==PAUSE_TYPE_SHELF) return "SHELF";
   if(type==PAUSE_TYPE_HESITATION) return "HESITATION";
   return "NONE";
}

double HT6StrictnessFactor()
{
   if(HowStrictlyShouldMovesAndPausesBeConfirmed==SEQUENCE_RESPONSIVE) return 0.82;
   if(HowStrictlyShouldMovesAndPausesBeConfirmed==SEQUENCE_STRICT) return 1.18;
   if(HowStrictlyShouldMovesAndPausesBeConfirmed==SEQUENCE_FORTRESS) return 1.35;
   return 1.0;
}


//===============================================================================
// v6.08 EINSTEIN FLOW EQUATION
//
// PRIMARY STRUCTURE:
//   SELL if completed candle CLOSES below LL rail.
//   BUY  if completed candle CLOSES above HIGH from two candles left of LL.
//   Wick/cross through a rail without a close is NOT an entry.
//   A failed LL close contributes exactly +1 bullish continuation point.
//   The mirrored failed upper close contributes +1 bearish continuation point.
//
// CONTINUATION ENERGY:
//   E = M * V^2 * Q * G * L
//   M = structure mass from close penetration beyond the structural rail.
//   V = live flow velocity from RHYTHM (directional, normalized).
//   Q = point charge = banked continuation points / points required by leg.
//   G = phase gravity; mature legs demand more proof.
//   L = soft location relativity; location can strengthen/weakness the add,
//       but can never create the primary direction.
//
// Leg thresholds: L2=2 points, L3=3, L4=4, L5=5.
// Legs 3-5 can exist ONLY after a fresh same-direction structure close,
// because the leg counter itself advances only on fresh structure closes.
//===============================================================================

bool HT6EinsteinEnabled(){ return gHT6EinsteinFlowOwnsAllEntries; }

int HT6EinsteinPhaseForLeg(int leg)
{
   if(leg<=0) return SEQ_PHASE_OBSERVE;
   if(leg==1) return SEQ_PHASE_ATTACK;
   if(leg==2) return SEQ_PHASE_ACCELERATE;
   if(leg==3) return SEQ_PHASE_ZONE_3_5;
   if(leg==4) return SEQ_PHASE_DEFEND;
   return SEQ_PHASE_HARVEST;
}

double HT6EinsteinRequiredPoints(int leg)
{
   if(leg<=1) return 999.0;
   if(leg==2) return 2.0;
   if(leg==3) return 3.0;
   if(leg==4) return 4.0;
   return 5.0;
}

double HT6EinsteinPhaseGravity(int leg)
{
   if(leg<=2) return 1.00;
   if(leg==3) return 0.92;
   if(leg==4) return 0.82;
   return 0.72;
}

int HT6EinsteinPointFamily(int source)
{
   if(source==PYR_SOURCE_FAILED_EXTREME ||
      source==PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY ||
      source==PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL ||
      source==PYR_SOURCE_U_SETUP || source==PYR_SOURCE_N_SETUP) return 1; // liquidity/pattern

   if(source==PYR_SOURCE_BOS_CONTINUATION || source==PYR_SOURCE_BOS_PULLBACK ||
      source==PYR_SOURCE_CONFIRMED_TREND_FLIP || source==PYR_SOURCE_INFLECTION_TRANSFER ||
      source==PYR_SOURCE_CHANNEL_BREAK || source==PYR_SOURCE_CHANNEL_BREAK_PULLBACK ||
      source==PYR_SOURCE_TRIGGER_RAIL_BREAK) return 2; // structural continuation

   if(source==PYR_SOURCE_TRAIN_STATION || source==PYR_SOURCE_RECLAIM_AREA ||
      source==PYR_SOURCE_DIRECTIONAL_RETEST || source==PYR_SOURCE_CHANNEL_BOUNCE ||
      source==PYR_SOURCE_TRIGGER_RAIL_BOUNCE || source==PYR_SOURCE_KINGDOM_MANNER) return 3; // location/retest

   if(source==PYR_SOURCE_ROUTE_ACCELERATOR || source==PYR_SOURCE_RHYTHM_ACCELERATOR ||
      source==PYR_SOURCE_MOTIV_V3 || source==PYR_SOURCE_CC_GROW ||
      source==PYR_SOURCE_KINGDOM_SCALE) return 4; // motion/continuation

   return 5;
}

double HT6EinsteinSourcePointWeight(int source)
{
   if(source<=PYR_SOURCE_NONE || source>=PYR_SOURCE_COUNT) return 0.0;
   double quality=HT5Clamp(gHT5SetupEvent[source].quality/1.30,0.65,1.35);
   double reliability=HT5Clamp(0.75+0.50*HT5SourceReliability(source),0.75,1.25);
   double ageBars=0.0;
   if(gHT5SetupEvent[source].identity>0)
      ageBars=(double)MathMax(0,TimeCurrent()-gHT5SetupEvent[source].identity)/
              MathMax(60,PeriodSeconds(SignalTF));
   double freshness=MathExp(-0.18*MathMin(12.0,ageBars));
   return HT5Clamp(quality*reliability*freshness,0.25,1.60);
}

void HT6EinsteinPrimePointLedger(datetime legStart)
{
   gHT6Flow.pointBank=0.0;
   gHT6Flow.oppositionBank=0.0;
   gHT6Flow.pressureBias=0.0;
   gHT6Flow.alignedCharge=0.0;
   gHT6Flow.oppositionCharge=0.0;
   gHT6Flow.continuationDefense=false;
   gHT6Flow.energy=0.0;
   gHT6Flow.addonCountThisLeg=0;
   gHT6Flow.lastAddonEvidenceSerial=gHT6Flow.evidenceSerial;
   gHT6Flow.lastPointLabel="NONE";
   gHT6Flow.lastOppositionLabel="NONE";
   for(int f=0;f<8;f++){ gHT6EinsteinFamilyPoints[f]=0.0; gHT6EinsteinOppFamilyPoints[f]=0.0; }
   for(int s=1;s<PYR_SOURCE_COUNT;s++)
   {
      datetime id=gHT5SetupEvent[s].identity;
      if(id>0 && id<legStart) gHT6LastNamedPointIdentity[s]=id;
   }
}

void HT6EinsteinReset(string reason)
{
   gHT6Flow.boxReady=false;
   gHT6Flow.llTime=0; gHT6Flow.upperTime=0;
   gHT6Flow.lowerRail=0.0; gHT6Flow.upperRail=0.0;
   gHT6Flow.consumedBoxTime=0;
   gHT6Flow.consumedBreakMask=0;
   gHT6Flow.primaryDirection=DIR_FLAT;
   gHT6Flow.leg=0;
   gHT6Flow.lastBreakDirection=DIR_FLAT;
   gHT6Flow.lastBreakBar=0;
   gHT6Flow.lastBreakPenetrationATR=0.0;
   gHT6Flow.pointBank=0.0;
   gHT6Flow.oppositionBank=0.0;
   gHT6Flow.pressureBias=0.0;
   gHT6Flow.alignedCharge=0.0;
   gHT6Flow.oppositionCharge=0.0;
   gHT6Flow.structureMass=0.0;
   gHT6Flow.flowVelocity=0.0;
   gHT6Flow.locationRelativity=0.0;
   gHT6Flow.phaseGravity=0.0;
   gHT6Flow.continuationDefense=false;
   gHT6Flow.energy=0.0;
   gHT6Flow.evidenceSerial=0;
   gHT6Flow.lastAddonEvidenceSerial=0;
   gHT6Flow.addonCountThisLeg=0;
   gHT6Flow.sellSwitchConfirmCount=0;
   gHT6Flow.buySwitchConfirmCount=0;
   gHT6Flow.sonicAnchorPrice=0.0;
   gHT6Flow.sonicRiskR=0.0;
   gHT6Flow.sonicNextNode=1;
   gHT6Flow.sonicNodesFired=0;
   gHT6Flow.sonicLastAddTime=0;
   gHT6Flow.sonicPeakProfit=0.0;
   gHT6Flow.sonicPocketTargetMoney=0.0;
   gHT6Flow.sonicPocketArmed=false;
   gHT6Flow.sonicPocketCycle=0;
   gHT6Flow.coreRatchetPrice=0.0;
   gHT6Flow.coreRatchetDirection=DIR_FLAT;
   gHT6Flow.coreRatchetCoreTicket=0;
   gHT6Flow.coreRatchetCoreTime=0;
   gHT6Flow.structureEntryPending=false;
   gHT6Flow.pendingStructureDirection=DIR_FLAT;
   gHT6Flow.pendingStructureLeg=0;
   gHT6Flow.pendingStructureStop=0.0;
   gHT6Flow.lastPointLabel="NONE";
   gHT6Flow.lastOppositionLabel="NONE";
   gHT6Flow.primaryMemory="PRIMARY NONE";
   gHT6Flow.legMemory="LEG 0 OBSERVE";
   gHT6Flow.pressureMemory="ALIGN 0.00 / OPP 0.00";
   gHT6Flow.state="FLOW OBSERVE • "+reason;
   gHT6EinsteinAudit=gHT6Flow.state;
   gHT6LastEinsteinSenseBar=0;
   for(int i=0;i<32;i++) gHT6LastNamedPointIdentity[i]=0;
   for(int f=0;f<8;f++){ gHT6EinsteinFamilyPoints[f]=0.0; gHT6EinsteinOppFamilyPoints[f]=0.0; }
}

bool HT6OrderIsStructureHoldSelected()
{
   if(!OurOrder()) return false;
   string c=OrderComment();
   return (StringFind(c,"HT6_CORE_")==0);
}

bool HT6OrderIsContinuationAddSelected()
{
   if(!OurOrder()) return false;
   string c=OrderComment();
   return (StringFind(c,"HT6_ADD_")==0);
}

int HT6StructureHoldCount(int dir)
{
   int n=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && HT6OrderIsStructureHoldSelected())
      {
         int t=OrderType();
         int d=(t==OP_BUY?DIR_BUY:(t==OP_SELL?DIR_SELL:DIR_FLAT));
         if(d!=DIR_FLAT && (dir==DIR_FLAT || d==dir)) n++;
      }
   return n;
}

int HT6ContinuationAddCount(int dir)
{
   int n=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && HT6OrderIsContinuationAddSelected())
      {
         int t=OrderType();
         int d=(t==OP_BUY?DIR_BUY:(t==OP_SELL?DIR_SELL:DIR_FLAT));
         if(d!=DIR_FLAT && (dir==DIR_FLAT || d==dir)) n++;
      }
   return n;
}

double HT6ContinuationProfit(int dir)
{
   double p=0.0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && HT6OrderIsContinuationAddSelected())
      {
         int t=OrderType();
         int d=(t==OP_BUY?DIR_BUY:(t==OP_SELL?DIR_SELL:DIR_FLAT));
         if(d!=DIR_FLAT && (dir==DIR_FLAT || d==dir))
            p+=OrderProfit()+OrderSwap()+OrderCommission();
      }
   return p;
}


int HT6NewestStructureCoreTicket(int dir,double &entry,datetime &openTime)
{
   int best=0; entry=0.0; openTime=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && HT6OrderIsStructureHoldSelected())
      {
         int t=OrderType();
         int d=(t==OP_BUY?DIR_BUY:(t==OP_SELL?DIR_SELL:DIR_FLAT));
         if(d!=dir) continue;
         datetime ot=OrderOpenTime(); int tk=OrderTicket();
         if(ot>openTime || (ot==openTime && tk>best))
         { openTime=ot; best=tk; entry=OrderOpenPrice(); }
      }
   return best;
}

double HT6EinsteinEffectiveAddonStop(int dir,double price)
{
   double stop=HT6EinsteinDoctrineStop(dir,price);
   if(stop<=0.0) return 0.0;
   if(gHT6Flow.coreRatchetDirection==dir && gHT6Flow.coreRatchetPrice>0.0)
   {
      if(dir==DIR_BUY) stop=MathMax(stop,gHT6Flow.coreRatchetPrice);
      else stop=MathMin(stop,gHT6Flow.coreRatchetPrice);
   }
   return HT5RoundBrokerSafeStop(dir,price,stop);
}

void HT6EinsteinArmCoreRatchet(int dir)
{
   if(dir==DIR_FLAT) return;
   double entry=0.0; datetime ot=0;
   int tk=HT6NewestStructureCoreTicket(dir,entry,ot);
   if(tk<=0 || entry<=0.0) return;
   gHT6Flow.coreRatchetDirection=dir;
   gHT6Flow.coreRatchetPrice=entry;
   gHT6Flow.coreRatchetCoreTicket=tk;
   gHT6Flow.coreRatchetCoreTime=ot;
   gHT6EinsteinAudit="NEXT CORE SL FLOOR ARMED @ "+DoubleToString(entry,Digits);
}

void HT6EinsteinManageCoreRatchet()
{
   // v6.20 H620TrailAndExtend owns all campaign rail updates.
}

double HT6CampaignIntentScore(int dir)
{
   if(dir==DIR_FLAT || dir!=gHT6Flow.primaryDirection) return 0.0;
   HT6EinsteinRefreshFlowMemories();
   double mass=HT5Clamp((gHT6Flow.structureMass-0.85)/0.35,0.0,1.0);
   double velocity=HT5Clamp((HT6EinsteinFlowVelocity(dir)-0.70)/0.60,0.0,1.0);
   double location=HT5Clamp((gHT6Flow.locationRelativity-0.90)/0.20,0.0,1.0);
   double bias=(gHT6Flow.leg<=1 ? 0.55 : HT5Clamp(0.50+0.50*gHT6Flow.pressureBias,0.0,1.0));
   double penetration=HT5Clamp(gHT6Flow.lastBreakPenetrationATR/0.50,0.0,1.0);
   double intent=0.28*mass+0.24*velocity+0.18*location+0.16*bias+0.14*penetration;
   if(gHT6Flow.continuationDefense) intent*=0.72;
   return HT5Clamp(intent,0.0,1.0);
}

double HT6IntentRiskMultiplier(double intent)
{
   if(intent>=0.90) return MathMax(0.10,DirectIntentRiskMultiplierExtreme);
   if(intent>=0.78) return MathMax(0.10,DirectIntentRiskMultiplierHigh);
   if(intent>=0.66) return MathMax(0.10,DirectIntentRiskMultiplierMedium);
   return MathMax(0.10,DirectIntentRiskMultiplierLow);
}

bool HT6CampaignHasFavorableAddProgress(int dir)
{
   if(!DirectOnlyAddAfterFavorableTravel) return true;
   if(dir==DIR_FLAT || gHT6Flow.sonicAnchorPrice<=0.0 || gHT6Flow.sonicRiskR<=Point) return false;
   RefreshRates();
   double price=(dir==DIR_BUY?Ask:Bid);
   double r=dir*(price-gHT6Flow.sonicAnchorPrice)/MathMax(Point,gHT6Flow.sonicRiskR);
   return r>=MathMax(0.0,DirectMinimumFavorableAddProgressR);
}

string HT6DoubleActiveKey(){ return HT5Key("DBL_ACTIVE"); }
string HT6DoubleStartKey(){ return HT5Key("DBL_START"); }
string HT6DoubleTargetKey(){ return HT5Key("DBL_TARGET"); }

void HT6DoubleCampaignPersist()
{
   GlobalVariableSet(HT6DoubleActiveKey(),gHT6DoubleCampaignActive?1.0:0.0);
   GlobalVariableSet(HT6DoubleStartKey(),gHT6DoubleCampaignStartBalance);
   GlobalVariableSet(HT6DoubleTargetKey(),gHT6DoubleCampaignTargetEquity);
}

void HT6BeginDoubleCampaignIfNeeded()
{
   if(H620Enabled()) H620Ledger();
}

void HT6EndDoubleCampaignState(string reason,bool waitFresh)
{
   gHT6DoubleCampaignActive=false;
   gHT6DoubleCampaignProgressPercent=0.0;
   gHT6IntentWeakBars=0;
   gHT6IntentLastClosedBar=0;
   gHT6DoubleState=reason;
   if(waitFresh && DirectWaitForFreshPrimaryAfterCampaign)
   {
      gHT6DoubleWaitFreshPrimary=true;
      gHT6DoubleCompletionTime=TimeCurrent();
      gHT6DoubleWaitBoxTime=gHT6Flow.llTime;
   }
   HT6DoubleCampaignPersist();
}

bool HT6CloseDoubleCampaign(string reason,bool waitFresh)
{
   if(H620Enabled() && !h620Mutation && !gWisdoEmergencyLatched) return false;
   int dir=gHT6Flow.primaryDirection;
   bool ok=true;
   if(TradeCountByDirection(DIR_BUY)>0) ok=(HT6EinsteinCloseDirection(DIR_BUY,reason)&&ok);
   if(TradeCountByDirection(DIR_SELL)>0) ok=(HT6EinsteinCloseDirection(DIR_SELL,reason)&&ok);
   if(!ok || TradeCount()>0) return false;
   HT6EndDoubleCampaignState(reason,waitFresh);
   HT6SequenceClear(reason);
   HT6EinsteinReset(reason);
   gHT6Flow.primaryDirection=DIR_FLAT;
   return true;
}

bool HT6ManageDoubleCampaignObjective()
{
   if(H620Enabled()) H620Ledger();
   return false; // milestones are accounting events, never liquidation commands
}

void HT6RestoreDoubleCampaignState()
{
   // H620Initialize restores campaign identity, rail and transfer phase.
}

void HT6EinsteinRunSonicIntentBurst()
{
   if(gHT6Flow.primaryDirection==DIR_FLAT || gHT6DoubleWaitFreshPrimary) return;
   gHT6CampaignIntent=HT6CampaignIntentScore(gHT6Flow.primaryDirection);
   if(gHT6CampaignIntent<MathMax(0.0,DirectMinimumIntentToAdd)) return;
   int burst=1;
   if(gHT6CampaignIntent>=0.90) burst=MathMax(1,DirectMaximumSonicAddsPerTick);
   else if(gHT6CampaignIntent>=0.78) burst=MathMin(2,MathMax(1,DirectMaximumSonicAddsPerTick));
   for(int i=0;i<burst;i++) if(!HT6EinsteinOpenSonicFlowAdd()) break;
}

double HT6EinsteinSonicRiskFraction(int leg)
{
   if(leg<=1) return MathMax(0.01,DirectSonicRiskFractionLeg1);
   if(leg==2) return MathMax(0.01,DirectSonicRiskFractionLeg2);
   if(leg==3) return MathMax(0.01,DirectSonicRiskFractionLeg3);
   if(leg==4) return MathMax(0.01,DirectSonicRiskFractionLeg4);
   return MathMax(0.01,DirectSonicRiskFractionLeg5);
}

double HT6EinsteinSonicPocketFraction(int leg)
{
   if(leg<=1) return 0.10;
   if(leg==2) return 0.12;
   if(leg==3) return 0.10;
   if(leg==4) return 0.08;
   return 0.06;
}

double HT6EinsteinSonicPocketGiveback(int leg)
{
   if(leg<=2) return 0.22;
   if(leg==3) return 0.18;
   if(leg==4) return 0.14;
   return 0.10;
}

void HT6EinsteinResetSonicWave(double anchor,double riskR,string why)
{
   gHT6Flow.sonicAnchorPrice=anchor;
   gHT6Flow.sonicRiskR=MathMax(Point*10.0,riskR);
   gHT6Flow.sonicNextNode=1;
   gHT6Flow.sonicNodesFired=0;
   gHT6Flow.sonicLastAddTime=0;
   gHT6Flow.sonicPeakProfit=0.0;
   gHT6Flow.sonicPocketTargetMoney=0.0;
   gHT6Flow.sonicPocketArmed=false;
   gHT6EinsteinAudit="SONIC WAVE RESET • "+why;
}

bool HT6EinsteinOpenSonicFlowAdd()
{
   // A user-armed SONIC window uses every normal strategy gate and never guarantees fills.
   if(h620FutureGoal==8 || (h620FutureGoal==12 && (WcoRead(WcoEA(),"burstRemaining")<=0 || TimeGMT()>=h620FutureUntil)))return false;
   int dir=gHT6Flow.primaryDirection;
   if(dir==DIR_FLAT || gHT6Flow.leg<1 || gHT6Flow.leg>5) return false;
   if((HT6StructureHoldCount(dir)<=0 && !gHT6DoubleCampaignActive) || gCompoundEntryFreeze || gHT6DoubleWaitFreshPrimary) return false;
   if(gHT6Flow.sonicAnchorPrice<=0.0 || gHT6Flow.sonicRiskR<=Point) return false;
   if(gHT6Flow.sonicNextNode>gHT6SonicNodesPerCore) return false;
   if(TimeCurrent()-gHT6Flow.sonicLastAddTime<gHT6SonicMinSecondsBetweenAdds) return false;

   HT6EinsteinRefreshFlowMemories();
   gHT6CampaignIntent=HT6CampaignIntentScore(dir);
   if(gHT6CampaignIntent<MathMax(0.0,DirectMinimumIntentToAdd)) return false;
   if(!HT6CampaignHasFavorableAddProgress(dir)) return false;
   double V=HT6EinsteinFlowVelocity(dir);
   if(V<gHT6SonicMinimumVelocity) return false;
   if(gHT6Flow.continuationDefense || gHT6Flow.oppositionCharge>gHT6SonicMaximumOppositionCharge) return false;
   if(gHT6Flow.pressureBias<-0.20) return false;

   RefreshRates(); double price=(dir==DIR_BUY?Ask:Bid);
   double progressR=dir*(price-gHT6Flow.sonicAnchorPrice)/gHT6Flow.sonicRiskR;
   double nodeR=gHT6SonicNodeStepR*gHT6Flow.sonicNextNode;
   if(progressR+0.0001<nodeR) return false;

   double stop=HT6EinsteinEffectiveAddonStop(dir,price);
   if(stop<=0.0) return false;
   double pointBoost=HT5Clamp(0.85+0.10*gHT6Flow.alignedCharge-0.05*gHT6Flow.oppositionCharge,0.70,1.05);
   double riskFraction=HT6EinsteinSonicRiskFraction(gHT6Flow.leg)*pointBoost*HT6IntentRiskMultiplier(gHT6CampaignIntent);

   bool oldStruct=gHT6StructureHoldOrderContext;
   bool oldAdd=gHT6ContinuationAddOrderContext;
   bool oldSonic=gHT6SonicFlowOrderContext;
   bool oldPending=gPyrPendingPlan;
   double oldStop=gPyrPendingStop,oldTarget=gPyrPendingTarget;
   gHT6StructureHoldOrderContext=false;
   gHT6ContinuationAddOrderContext=true;
   gHT6SonicFlowOrderContext=true;
   gPyrPendingPlan=true; gPyrPendingStop=stop; gPyrPendingTarget=0.0;
   gPyrSignalSource=PYR_SOURCE_NONE; gPyrActiveSignalIdentity=TimeCurrent();

   string action="SONIC_L"+IntegerToString(gHT6Flow.leg)+"_N"+IntegerToString(gHT6Flow.sonicNextNode)+"_"+IntegerToString(++gHT6EinsteinAddonSerial);
   bool opened=SendOrder(dir,riskFraction,action,true);

   gHT6StructureHoldOrderContext=oldStruct;
   gHT6ContinuationAddOrderContext=oldAdd;
   gHT6SonicFlowOrderContext=oldSonic;
   gPyrPendingPlan=oldPending; gPyrPendingStop=oldStop; gPyrPendingTarget=oldTarget;
   if(opened)
   {
      gHT6Flow.sonicNodesFired++;
      gHT6Flow.sonicNextNode++;
      gHT6Flow.sonicLastAddTime=TimeCurrent();
      gHT6EinsteinAudit="SONIC FLOW ADD • LEG "+IntegerToString(gHT6Flow.leg)+
                        " • NODE "+DoubleToString(nodeR,2)+"R • V "+DoubleToString(V,2);
      HT6CaptureEntrySequenceSnapshot();
      HT6EinsteinManageCoreRatchet();
   }
   return opened;
}

bool HT6EinsteinManageSonicCompoundTakeProfit()
{
   return false; // replaced by role-specific broker TP / runner extension
}

int HT6ExistingStructureDirection()
{
   int buy=0,sell=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderSelect(i,SELECT_BY_POS,MODE_TRADES) && HT6OrderIsStructureHoldSelected())
      {
         if(OrderType()==OP_BUY) buy++;
         else if(OrderType()==OP_SELL) sell++;
      }
   if(buy>0 && sell==0) return DIR_BUY;
   if(sell>0 && buy==0) return DIR_SELL;
   return DIR_FLAT;
}

bool HT6FindLatestLLBox(double &ll,double &upper,datetime &llTime,datetime &upperTime)
{
   ll=0.0; upper=0.0; llTime=0; upperTime=0;
   int bars=iBars(Symbol(),SignalTF);
   int depth=MathMax(1,MathMin(8,DirectLLPivotDepth));
   int scan=MathMin(MathMax(depth+8,DirectLLBoxScanBars),bars-depth-4);
   if(scan<=depth+5) return false;

   bool haveRecent=false;
   double recentLow=0.0;
   int recentShift=-1;

   for(int s=depth+1;s<=scan;s++)
   {
      if(!PyrPivotLow(s,depth)) continue;
      double thisLow=iLow(Symbol(),SignalTF,s);
      if(!haveRecent)
      {
         haveRecent=true; recentLow=thisLow; recentShift=s;
         continue;
      }

      // The more-recent pivot is a true LL relative to the older pivot.
      if(recentLow<thisLow-Point*0.5)
      {
         int upperShift=recentShift+MathMax(1,DirectUpperRailCandlesLeft); // user-controlled candles left/older than LL candle
         if(upperShift>=bars) return false;
         ll=recentLow;
         upper=iHigh(Symbol(),SignalTF,upperShift);
         llTime=iTime(Symbol(),SignalTF,recentShift);
         upperTime=iTime(Symbol(),SignalTF,upperShift);
         return (ll>0.0 && upper>ll);
      }

      recentLow=thisLow;
      recentShift=s;
   }
   return false;
}

double HT6EinsteinDoctrineStop(int dir,double price)
{
   if(!gHT6Flow.boxReady || dir==DIR_FLAT || price<=0.0) return 0.0;
   double atr=MathMax(Point,HTProtectiveStopATR());
   double b=MathMax(Point*2.0,atr*gHT6EinsteinStopBufferATR);
   double stop=(dir==DIR_BUY ? gHT6Flow.lowerRail-b : gHT6Flow.upperRail+b);
   if(dir==DIR_BUY && stop>=price) return 0.0;
   if(dir==DIR_SELL && stop<=price) return 0.0;
   return HT5RoundBrokerSafeStop(dir,price,stop);
}

double HT6EinsteinStructureMass()
{
   return HT5Clamp(0.85+0.35*HT5Clamp(gHT6Flow.lastBreakPenetrationATR/0.50,0.0,1.0),0.85,1.20);
}

double HT6EinsteinFlowVelocity(int dir)
{
   double r=HT6DirectionRhythmScore(dir);
   return HT5Clamp(0.70+0.60*r,0.70,1.30);
}

double HT6EinsteinPressureBias()
{
   double a=MathMax(0.0,gHT6Flow.pointBank);
   double o=MathMax(0.0,gHT6Flow.oppositionBank);
   double total=a+o;
   if(total<=0.000001) return 0.0;
   return HT5Clamp((a-o)/total,-1.0,1.0);
}

double HT6EinsteinDirectionalLock(int dir)
{
   if(dir==DIR_FLAT || gHT6Flow.primaryDirection==DIR_FLAT) return 0.0;
   return (dir==gHT6Flow.primaryDirection?1.0:0.0);
}

void HT6EinsteinRefreshFlowMemories()
{
   int dir=gHT6Flow.primaryDirection;
   double req=HT6EinsteinRequiredPoints(gHT6Flow.leg);
   if(req<=0.0 || req>=900.0) req=1.0;
   gHT6Flow.pressureBias=HT6EinsteinPressureBias();
   gHT6Flow.alignedCharge=HT5Clamp(gHT6Flow.pointBank/req,0.0,2.0);
   gHT6Flow.oppositionCharge=HT5Clamp(gHT6Flow.oppositionBank/req,0.0,2.0);
   gHT6Flow.structureMass=HT6EinsteinStructureMass();
   gHT6Flow.flowVelocity=(dir==DIR_FLAT?0.0:HT6EinsteinFlowVelocity(dir));
   gHT6Flow.locationRelativity=(dir==DIR_FLAT?0.0:(0.90+0.20*HT5Clamp(HT6DirectionLocationScore(dir),0.0,1.0)));
   gHT6Flow.phaseGravity=HT6EinsteinPhaseGravity(gHT6Flow.leg);
   gHT6Flow.continuationDefense=(gHT6Flow.leg>=2 &&
      (gHT6Flow.oppositionCharge>=gHT6EinsteinDefenseOppositionRatio && gHT6Flow.pressureBias<0.20));
   string side=(dir==DIR_BUY?"BUY":(dir==DIR_SELL?"SELL":"NONE"));
   gHT6Flow.primaryMemory="PRIMARY "+side+" • CORE "+IntegerToString(HT6StructureHoldCount(DIR_FLAT));
   gHT6Flow.legMemory="LEG "+IntegerToString(gHT6Flow.leg)+" • "+HT6PhaseName(HT6EinsteinPhaseForLeg(gHT6Flow.leg));
   gHT6Flow.pressureMemory="ALIGN "+DoubleToString(gHT6Flow.pointBank,2)+
      " / OPP "+DoubleToString(gHT6Flow.oppositionBank,2)+
      " • BIAS "+DoubleToString(gHT6Flow.pressureBias,2)+
      (gHT6Flow.continuationDefense?" • DEFEND":" • ADD-READY");
}

double HT6EinsteinEnergy(int dir)
{
   if(dir==DIR_FLAT || dir!=gHT6Flow.primaryDirection || gHT6Flow.leg<2) return 0.0;
   double req=HT6EinsteinRequiredPoints(gHT6Flow.leg);
   if(req<=0.0 || req>=900.0) return 0.0;

   // Einstein continuation equation:
   // E = Ds * M * V^2 * Qa * L * G
   // Qa is aligned evidence charge multiplied by pressure coherence. Opposing
   // evidence can stop ADDING, but it can NEVER reverse PRIMARY structure.
   double Ds=HT6EinsteinDirectionalLock(dir);
   double M=HT6EinsteinStructureMass();
   double V=HT6EinsteinFlowVelocity(dir);
   double rawQ=HT5Clamp(gHT6Flow.pointBank/req,0.0,1.50);
   double bias=HT6EinsteinPressureBias();
   double coherence=HT5Clamp(0.50+0.50*bias,0.10,1.00);
   double Qa=rawQ*coherence;
   double L=0.90+0.20*HT5Clamp(HT6DirectionLocationScore(dir),0.0,1.0);
   double G=HT6EinsteinPhaseGravity(gHT6Flow.leg);

   gHT6Flow.pressureBias=bias;
   gHT6Flow.alignedCharge=rawQ;
   gHT6Flow.oppositionCharge=HT5Clamp(gHT6Flow.oppositionBank/req,0.0,2.0);
   gHT6Flow.structureMass=M;
   gHT6Flow.flowVelocity=V;
   gHT6Flow.locationRelativity=L;
   gHT6Flow.phaseGravity=G;
   return Ds*M*V*V*Qa*L*G;
}

void HT6EinsteinAddPoint(int dir,double amount,string label)
{
   if(dir==DIR_FLAT || amount<=0.0) return;
   if(gHT6Flow.primaryDirection==DIR_FLAT || gHT6Flow.leg<2)
   {
      gHT6EinsteinAudit="SHADOW POINT "+(dir==DIR_BUY?"BUY ":"SELL ")+label+" • WAIT PRIMARY STRUCTURE";
      return;
   }

   gHT6Flow.evidenceSerial++;
   if(dir==gHT6Flow.primaryDirection)
   {
      gHT6Flow.pointBank+=amount;
      gHT6Flow.lastPointLabel=label+" +"+DoubleToString(amount,2);
      gHT6EinsteinAudit="ALIGNED PRESSURE "+DoubleToString(gHT6Flow.pointBank,2)+" • "+gHT6Flow.lastPointLabel;
   }
   else
   {
      gHT6Flow.oppositionBank+=amount;
      gHT6Flow.lastOppositionLabel=label+" +"+DoubleToString(amount,2);
      gHT6EinsteinAudit="OPPOSITION "+DoubleToString(gHT6Flow.oppositionBank,2)+" • "+gHT6Flow.lastOppositionLabel+" • STRUCTURE LOCK HOLDS";
   }
   HT6EinsteinRefreshFlowMemories();
}

void HT6EinsteinAddCappedPoint(int dir,int family,double amount,string label)
{
   if(dir==DIR_FLAT || amount<=0.0) return;
   family=MathMax(0,MathMin(7,family));
   bool aligned=(gHT6Flow.primaryDirection!=DIR_FLAT && dir==gHT6Flow.primaryDirection);
   double used=(aligned?gHT6EinsteinFamilyPoints[family]:gHT6EinsteinOppFamilyPoints[family]);
   double room=MathMax(0.0,gHT6EinsteinFamilyPointCap-used);
   double add=MathMin(amount,room);
   if(add<=0.0) return;
   if(aligned) gHT6EinsteinFamilyPoints[family]+=add;
   else gHT6EinsteinOppFamilyPoints[family]+=add;
   HT6EinsteinAddPoint(dir,add,label);
}

void HT6EinsteinCaptureNamedPoints()
{
   if(!HT6EinsteinEnabled() || gHT6Flow.primaryDirection==DIR_FLAT || gHT6Flow.leg<2) return;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   for(int s=1;s<PYR_SOURCE_COUNT;s++)
   {
      if(!gHT5SetupEvent[s].armed || gHT5SetupEvent[s].identity<=0) continue;
      if(gHT6LastNamedPointIdentity[s]==gHT5SetupEvent[s].identity) continue;
      if(gHT5SetupEvent[s].pullbackRequired && !HT5SetupRetestTouched(s,atr)) continue;

      int fam=HT6EinsteinPointFamily(s);
      double w=HT6EinsteinSourcePointWeight(s);
      gHT6LastNamedPointIdentity[s]=gHT5SetupEvent[s].identity;
      HT6EinsteinAddCappedPoint(gHT5SetupEvent[s].direction,fam,w,HT5SourceName(s));
   }
   gHT6Flow.energy=HT6EinsteinEnergy(gHT6Flow.primaryDirection);
   HT6EinsteinRefreshFlowMemories();
}

bool HT6EinsteinCloseDirection(int dir,string reason)
{
   if(dir==DIR_FLAT) return true;
   bool priorCoreCloseAuthority=gHT6EinsteinCoreCloseAuthority;
   bool priorAddonCloseAuthority=gHT6EinsteinAddonCloseAuthority;
   gHT6EinsteinCoreCloseAuthority=true;  // opposite STRUCTURE CLOSE is normal core exit
   gHT6EinsteinAddonCloseAuthority=true; // hard structural invalidation may also clear old-direction adds
   bool allClosed=true;
   for(int pass=0;pass<4;pass++)
   {
      bool found=false;
      RefreshRates();
      for(int i=OrdersTotal()-1;i>=0;i--)
      {
         if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
         int t=OrderType();
         int d=(t==OP_BUY?DIR_BUY:(t==OP_SELL?DIR_SELL:DIR_FLAT));
         if(d!=dir) continue;
         found=true;
         if(t==OP_BUY || t==OP_SELL)
         {
            double cp=(t==OP_BUY?Bid:Ask);
            if(!HT5CommanderOrderClose(OrderTicket(),OrderLots(),cp,SlippagePoints,clrNONE))
               allClosed=false;
         }
         else if(t==OP_BUYLIMIT || t==OP_BUYSTOP || t==OP_SELLLIMIT || t==OP_SELLSTOP)
         {
            if(!HT5CommanderOrderDelete(OrderTicket(),clrNONE)) allClosed=false;
         }
      }
      if(!found) break;
   }
   Print("HT6 EINSTEIN STRUCTURE FLIP CLOSE dir=",dir," reason=",reason,
         " remaining=",TradeCountByDirection(dir));
   gHT6EinsteinCoreCloseAuthority=priorCoreCloseAuthority;
   gHT6EinsteinAddonCloseAuthority=priorAddonCloseAuthority;
   return (TradeCountByDirection(dir)==0 && allClosed);
}

bool HT6EinsteinOpenStructureHold(int dir)
{
   if(dir==DIR_FLAT || !gHT6Flow.boxReady) return false;
   if(dir==DIR_BUY && !AllowBuy) return false;
   if(dir==DIR_SELL && !AllowSell) return false;
   if(!AllowNewEntries || !EntryStartTimeGatePasses(true)) return false;
   if(h620Phase==2 || (h620Phase==3 && !h620FlipContext)) return false;

   RefreshRates();
   double price=(dir==DIR_BUY?Ask:Bid);
   double stop=(gHT6Flow.structureEntryPending && gHT6Flow.pendingStructureDirection==dir &&
                gHT6Flow.pendingStructureStop>0.0 ?
                HT5RoundBrokerSafeStop(dir,price,gHT6Flow.pendingStructureStop) :
                HT6EinsteinDoctrineStop(dir,price));
   if(stop<=0.0)
   {
      gHT6EinsteinAudit="STRUCTURE HOLD WAIT • INVALID BOX STOP";
      return false;
   }

   bool oldStruct=gHT6StructureHoldOrderContext;
   bool oldAdd=gHT6ContinuationAddOrderContext;
   bool oldPending=gPyrPendingPlan;
   double oldStop=gPyrPendingStop,oldTarget=gPyrPendingTarget;

   gHT6StructureHoldOrderContext=true;
   gHT6ContinuationAddOrderContext=false;
   gPyrPendingPlan=true;
   gPyrPendingStop=stop;
   gPyrPendingTarget=0.0;
   gPyrSignalSource=PYR_SOURCE_NONE;
   gPyrActiveSignalIdentity=gHT6Flow.lastBreakBar;

   int entryLeg=(gHT6Flow.structureEntryPending && gHT6Flow.pendingStructureLeg>0 ?
                 gHT6Flow.pendingStructureLeg:gHT6Flow.leg);
   string action="CORE_L"+IntegerToString(entryLeg)+"_"+IntegerToString(++gHT6EinsteinCoreSerial);
   bool opened=SendOrder(dir,MathMax(0.01,DirectCoreRiskMultiplier),action,true);

   gHT6StructureHoldOrderContext=oldStruct;
   gHT6ContinuationAddOrderContext=oldAdd;
   gPyrPendingPlan=oldPending; gPyrPendingStop=oldStop; gPyrPendingTarget=oldTarget;

   if(opened)
   {
      gHT6Flow.structureEntryPending=false;
      gHT6Flow.pendingStructureDirection=DIR_FLAT;
      gHT6Flow.pendingStructureLeg=0;
      gHT6Flow.pendingStructureStop=0.0;
      gPyrCampaignDirection=dir;
      gPyrTrendDirection=dir;
      gPyrInvalidation=stop;
      gPyrEntryAnchor=PyrAverageOpenPrice(dir);
      if(gPyrBestPrice<=0.0) gPyrBestPrice=gLastOpenedPrice;
      // Every new CORE becomes the next structural floor for all older Einstein
      // exposure. The newest core itself keeps the doctrine-box SL until another
      // same-direction core is earned.
      HT6EinsteinArmCoreRatchet(dir);
      double coreR=MathMax(Point*10.0,MathAbs(gLastOpenedPrice-stop));
      HT6EinsteinResetSonicWave(gLastOpenedPrice,coreR,"NEW CORE LEG "+IntegerToString(gHT6Flow.leg));
      HT6BeginDoubleCampaignIfNeeded();
      HT6EinsteinManageCoreRatchet();
      gPyrState="EINSTEIN STRUCTURE HOLD OPEN • LEG "+IntegerToString(gHT6Flow.leg);
      gHT6EinsteinAudit=gPyrState;
      HT6CaptureEntrySequenceSnapshot();
   }
   return opened;
}

bool HT6EinsteinOpenContinuationAdd()
{
   int dir=gHT6Flow.primaryDirection;
   if(dir==DIR_FLAT || gHT6Flow.leg<1 || gHT6Flow.leg>5) return false;
   if(gCompoundEntryFreeze) return false;
   if(gHT6Flow.evidenceSerial<=gHT6Flow.lastAddonEvidenceSerial) return false;

   double req=HT6EinsteinRequiredPoints(gHT6Flow.leg);
   HT6EinsteinRefreshFlowMemories();
   gHT6Flow.energy=HT6EinsteinEnergy(dir);
   int legCap=MathMax(1,DirectMaximumEvidenceAddsPerLeg);
   if(gHT6Flow.addonCountThisLeg>=legCap) return false;
   gHT6CampaignIntent=HT6CampaignIntentScore(dir);
   if(gHT6CampaignIntent<MathMax(0.0,DirectMinimumIntentToAdd)) return false;
   if(!HT6CampaignHasFavorableAddProgress(dir)) return false;
   if(gHT6Flow.continuationDefense || gHT6Flow.pressureBias<gHT6EinsteinMinimumPressureBias)
   { gHT6EinsteinAudit="DEFEND • OPPOSITION PRESSURE BLOCKS NEW ADD • PRIMARY STRUCTURE HOLDS"; return false; }
   if(gHT6Flow.pointBank+0.0001<req || gHT6Flow.energy<gHT6EinsteinEnergyThreshold) return false;

   RefreshRates();
   double price=(dir==DIR_BUY?Ask:Bid);
   double stop=HT6EinsteinEffectiveAddonStop(dir,price);
   if(stop<=0.0) return false;

   // Late-leg risk becomes smaller even though evidence requirements grow.
   double phaseRisk=(gHT6Flow.leg==2?MathMax(0.01,DirectEvidenceRiskFractionLeg2):(gHT6Flow.leg==3?MathMax(0.01,DirectEvidenceRiskFractionLeg3):(gHT6Flow.leg==4?MathMax(0.01,DirectEvidenceRiskFractionLeg4):MathMax(0.01,DirectEvidenceRiskFractionLeg5))));
   double energyScale=HT5Clamp(0.80+0.20*(gHT6Flow.energy-1.0),0.70,1.00);
   double riskFraction=phaseRisk*energyScale*HT6IntentRiskMultiplier(gHT6CampaignIntent);

   bool oldStruct=gHT6StructureHoldOrderContext;
   bool oldAdd=gHT6ContinuationAddOrderContext;
   bool oldPending=gPyrPendingPlan;
   double oldStop=gPyrPendingStop,oldTarget=gPyrPendingTarget;

   gHT6StructureHoldOrderContext=false;
   gHT6ContinuationAddOrderContext=true;
   gPyrPendingPlan=true;
   gPyrPendingStop=stop;
   gPyrPendingTarget=0.0;
   gPyrSignalSource=PYR_SOURCE_NONE;
   gPyrActiveSignalIdentity=TimeCurrent();

   string action="ADD_L"+IntegerToString(gHT6Flow.leg)+"_"+IntegerToString(++gHT6EinsteinAddonSerial);
   bool opened=SendOrder(dir,riskFraction,action,true);

   gHT6StructureHoldOrderContext=oldStruct;
   gHT6ContinuationAddOrderContext=oldAdd;
   gPyrPendingPlan=oldPending; gPyrPendingStop=oldStop; gPyrPendingTarget=oldTarget;

   if(opened)
   {
      gHT6Flow.pointBank=MathMax(0.0,gHT6Flow.pointBank-req);
      gHT6Flow.lastAddonEvidenceSerial=gHT6Flow.evidenceSerial;
      gHT6Flow.addonCountThisLeg++;
      gHT6Flow.energy=HT6EinsteinEnergy(dir);
      HT6EinsteinRefreshFlowMemories();
      gPyrState="EINSTEIN ADD • LEG "+IntegerToString(gHT6Flow.leg)+
                " • E "+DoubleToString(gHT6Flow.energy,2)+
                " • BANK "+DoubleToString(gHT6Flow.pointBank,2);
      gHT6EinsteinAudit=gPyrState;
      HT6CaptureEntrySequenceSnapshot();
   }
   return opened;
}

bool HT6EinsteinCloseContinuationAdds(string reason)
{
   bool priorAddonCloseAuthority=gHT6EinsteinAddonCloseAuthority;
   gHT6EinsteinAddonCloseAuthority=true; // normal add-on exit belongs to compound collector
   bool any=false;
   for(int pass=0;pass<4;pass++)
   {
      bool found=false;
      RefreshRates();
      for(int i=OrdersTotal()-1;i>=0;i--)
      {
         if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !HT6OrderIsContinuationAddSelected()) continue;
         int t=OrderType();
         if(t!=OP_BUY && t!=OP_SELL) continue;
         found=true; any=true;
         double cp=(t==OP_BUY?Bid:Ask);
         if(!HT5CommanderOrderClose(OrderTicket(),OrderLots(),cp,SlippagePoints,clrNONE))
            Print("HT6 ADD COMPOUND CLOSE RETRY ticket=",OrderTicket()," err=",gHT5CommanderLastError);
      }
      if(!found) break;
   }
   if(any) Print("HT6 CONTINUATION ADDS COLLECTED • ",reason,
                 " remaining=",HT6ContinuationAddCount(DIR_FLAT));
   bool cleared=(HT6ContinuationAddCount(DIR_FLAT)==0);
   gHT6EinsteinAddonCloseAuthority=priorAddonCloseAuthority;
   return cleared;
}

void HT6EinsteinSyncSequence()
{
   int dir=gHT6Flow.primaryDirection;
   if(dir==DIR_FLAT)
   {
      gHT6Seq.active=false;
      gHT6Seq.direction=DIR_FLAT;
      gHT6Seq.moveCount=0;
      gHT6Seq.phase=SEQ_PHASE_OBSERVE;
      gHT6Seq.state="PHASE 0 OBSERVE • WAIT LL STRUCTURE BOX CLOSE";
      gHT6DoctrineState=gHT6Seq.state;
      return;
   }

   if(!gHT6Seq.active || gHT6Seq.direction!=dir)
      HT6StartCampaign(dir,"EINSTEIN STRUCTURE FLOW LOCK");

   gHT6Seq.direction=dir;
   gHT6Seq.moveCount=MathMax(1,MathMin(5,gHT6Flow.leg));
   gHT6Seq.phase=HT6EinsteinPhaseForLeg(gHT6Seq.moveCount);
   gHT6Seq.lastMoveTime=gHT6Flow.lastBreakBar;
   gHT6Seq.bosAccepted=true;
   gHT6Seq.transferReady=false;

   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double depth=0.0,pbars=0.0;
   int ptype=HT6ClassifyPause(dir,atr,depth,pbars);
   if(ptype!=PAUSE_TYPE_NONE)
   {
      gHT6Seq.pauseType=ptype;
      gHT6Seq.pauseActive=true;
      gHT6Seq.pauseDepthATR=depth;
      gHT6Seq.pauseBars=pbars;
   }
   else gHT6Seq.pauseActive=false;

   gHT6Seq.moveType=HT6ClassifyMoveType(gHT6Seq.pauseType,
                                        MathMax(0.10,gHT6Flow.lastBreakPenetrationATR),
                                        MathMax(1.0,gHT6Seq.pauseBars));
   HT6UpdateSequenceScores();
   gHT6Seq.continuationScore=HT5Clamp(0.55*gHT6Seq.continuationScore+
                                     0.45*HT5Clamp(gHT6Flow.energy/1.50,0.0,1.0),0.0,1.0);

   string side=(dir==DIR_BUY?"BULL":"BEAR");
   HT6EinsteinRefreshFlowMemories();
   gHT6Seq.state="EINSTEIN "+side+" • "+HT6PhaseName(gHT6Seq.phase)+
                  " • LEG "+IntegerToString(gHT6Seq.moveCount)+
                  " • BOX "+DoubleToString(gHT6Flow.lowerRail,Digits)+" / "+DoubleToString(gHT6Flow.upperRail,Digits)+
                  " • A/O "+DoubleToString(gHT6Flow.pointBank,2)+"/"+DoubleToString(gHT6Flow.oppositionBank,2)+
                  " • BIAS "+DoubleToString(gHT6Flow.pressureBias,2)+
                  " • E "+DoubleToString(gHT6Flow.energy,2)+
                  (gHT6Flow.continuationDefense?" • DEFEND":"");
   gHT6DoctrineState=gHT6Seq.state;
   HT5SetOrgan(ORGAN_SEQUENCE,0.96,gHT6DoctrineState);
}

void HT6EinsteinFlowSense()
{
   if(!HT6EinsteinEnabled()) return;
   if(h620Phase==2 || H620TryFlip()) return;

   if(HT6ManageDoubleCampaignObjective()) return;

   if(gHT6Flow.primaryDirection==DIR_FLAT)
   {
      int restored=HT6ExistingStructureDirection();
      if(restored!=DIR_FLAT)
      {
         gHT6Flow.primaryDirection=restored;
         gHT6Flow.leg=MathMax(1,MathMin(5,HT6StructureHoldCount(restored)));
         gHT6Flow.state="RESTORED STRUCTURE LOCK "+(restored==DIR_BUY?"BUY":"SELL");
      }
   }

   if(gHT6Flow.structureEntryPending && gHT6Flow.pendingStructureDirection!=DIR_FLAT)
      HT6EinsteinOpenStructureHold(gHT6Flow.pendingStructureDirection);

   double ll=0.0,up=0.0;
   datetime llt=0,upt=0;
   if(HT6FindLatestLLBox(ll,up,llt,upt))
   {
      if(!gHT6Flow.boxReady || llt!=gHT6Flow.llTime)
      {
         gHT6Flow.boxReady=true;
         gHT6Flow.llTime=llt; gHT6Flow.upperTime=upt;
         gHT6Flow.lowerRail=ll; gHT6Flow.upperRail=up;
         gHT6Flow.consumedBoxTime=llt;
         gHT6Flow.consumedBreakMask=0;
         gHT6Flow.state="NEW LL BOX • SELL<"+DoubleToString(ll,Digits)+
                        " • BUY>"+DoubleToString(up,Digits);
      }
   }

   if(gHT6DoubleWaitFreshPrimary)
   {
      if(gHT6Flow.boxReady && gHT6Flow.llTime>gHT6DoubleWaitBoxTime)
      {
         gHT6DoubleWaitFreshPrimary=false;
         gHT6DoubleState="FRESH PRIMARY BOX ARMED";
      }
      else
      {
         gHT6Flow.primaryDirection=DIR_FLAT;
         gHT6Flow.state="WAIT FRESH PRIMARY AFTER DOUBLE";
         gHT6EinsteinAudit=gHT6Flow.state;
         HT6EinsteinSyncSequence();
         return;
      }
   }

   datetime closedBar=iTime(Symbol(),SignalTF,1);
   if(closedBar<=0 || closedBar==gHT6LastEinsteinSenseBar || !gHT6Flow.boxReady)
   {
      HT6EinsteinSyncSequence();
      return;
   }
   gHT6LastEinsteinSenseBar=closedBar;

   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double c=iClose(Symbol(),SignalTF,1);
   double h=iHigh(Symbol(),SignalTF,1);
   double l=iLow(Symbol(),SignalTF,1);

   double breakBuffer=MathMax(Point*0.5,atr*MathMax(0.0,DirectStructureBreakBufferATR));
   int structuralBreak=DIR_FLAT;
   double penetration=0.0;
   if(c<gHT6Flow.lowerRail-breakBuffer)
   {
      structuralBreak=DIR_SELL;
      penetration=(gHT6Flow.lowerRail-c)/atr;
   }
   else if(c>gHT6Flow.upperRail+breakBuffer)
   {
      structuralBreak=DIR_BUY;
      penetration=(c-gHT6Flow.upperRail)/atr;
   }

   // v6.10 visible close-confirmation settings directly own transfers.
   int preDir=gHT6Flow.primaryDirection;
   if(preDir==DIR_BUY)
   {
      gHT6Flow.buySwitchConfirmCount=0;
      if(structuralBreak==DIR_SELL)
      {
         gHT6Flow.sellSwitchConfirmCount++;
         int need=MathMax(1,DirectSellSwitchClosedCandles);
         if(gHT6Flow.sellSwitchConfirmCount<need)
         {
            if(gHT6Flow.leg>=2) HT6EinsteinAddCappedPoint(DIR_SELL,2,1.50,"SELL STRUCTURE CONFIRM");
            gHT6Flow.state="SELL SWITCH CONFIRM "+IntegerToString(gHT6Flow.sellSwitchConfirmCount)+"/"+
                           IntegerToString(need)+" • PRIMARY BUY STILL LOCKED";
            gHT6EinsteinAudit=gHT6Flow.state;
            gHT6Flow.energy=HT6EinsteinEnergy(gHT6Flow.primaryDirection);
            HT6EinsteinRefreshFlowMemories();
            HT6EinsteinSyncSequence();
            return;
         }
      }
      else gHT6Flow.sellSwitchConfirmCount=0;
   }
   else if(preDir==DIR_SELL)
   {
      gHT6Flow.sellSwitchConfirmCount=0;
      if(structuralBreak==DIR_BUY)
      {
         gHT6Flow.buySwitchConfirmCount++;
         int needBuy=MathMax(1,DirectBuySwitchClosedCandles);
         if(gHT6Flow.buySwitchConfirmCount<needBuy)
         {
            if(gHT6Flow.leg>=2) HT6EinsteinAddCappedPoint(DIR_BUY,2,1.50,"BUY STRUCTURE CONFIRM");
            gHT6Flow.state="BUY SWITCH CONFIRM "+IntegerToString(gHT6Flow.buySwitchConfirmCount)+"/"+
                           IntegerToString(needBuy)+" • PRIMARY SELL STILL LOCKED";
            gHT6EinsteinAudit=gHT6Flow.state;
            gHT6Flow.energy=HT6EinsteinEnergy(gHT6Flow.primaryDirection);
            HT6EinsteinRefreshFlowMemories();
            HT6EinsteinSyncSequence();
            return;
         }
      }
      else gHT6Flow.buySwitchConfirmCount=0;
   }
   else
   {
      gHT6Flow.sellSwitchConfirmCount=0;
      gHT6Flow.buySwitchConfirmCount=0;
   }

   // A failed close is evidence, never primary entry.
   if(structuralBreak==DIR_FLAT)
   {
      if(l<gHT6Flow.lowerRail-breakBuffer && c>=gHT6Flow.lowerRail)
         HT6EinsteinAddCappedPoint(DIR_BUY,0,1.0,"FAILED LL CLOSE");
      if(h>gHT6Flow.upperRail+breakBuffer && c<=gHT6Flow.upperRail)
         HT6EinsteinAddCappedPoint(DIR_SELL,0,1.0,"FAILED UPPER CLOSE");
      gHT6Flow.energy=HT6EinsteinEnergy(gHT6Flow.primaryDirection);
      HT6EinsteinRefreshFlowMemories();
      HT6EinsteinSyncSequence();
      return;
   }

   // One primary structural order per DIRECTION per LL box. The same box may
   // later break the opposite rail and legitimately FLIP the structure lock.
   int breakBit=(structuralBreak==DIR_BUY?1:2);
   if(gHT6Flow.consumedBoxTime!=gHT6Flow.llTime)
   {
      gHT6Flow.consumedBoxTime=gHT6Flow.llTime;
      gHT6Flow.consumedBreakMask=0;
   }
   if((gHT6Flow.consumedBreakMask & breakBit)!=0)
   {
      HT6EinsteinSyncSequence();
      return;
   }

   int oldDir=gHT6Flow.primaryDirection;
   if(oldDir!=DIR_FLAT && structuralBreak!=oldDir)
   {
      // Opposite box evidence may not liquidate a surviving campaign rail.
      if(h620Phase==1) { gHT6EinsteinAudit="OPPOSITION OBSERVED / HOLD RAIL INTACT"; return; }
      // The ONLY normal software exit for core structure holds is a CLOSED
      // opposite structural break. Add-ons are invalidated too so mixed exposure
      // can never make the bot sell where structure has already flipped to BUY.
      if(!HT6EinsteinCloseDirection(oldDir,"EINSTEIN OPPOSITE STRUCTURE CLOSE"))
      {
         gHT6EinsteinAudit="STRUCTURE FLIP PROVED • WAIT OLD DIRECTION FLAT";
         gHT6LastEinsteinSenseBar=0; // retry the same closed structural event next tick
         HT6EinsteinSyncSequence();
         return;
      }
      HT6EndDoubleCampaignState("STRUCTURE FLIP BEFORE DOUBLE",false);
      HT6SequenceClear("STRUCTURE LOCK FLIP");
      gHT6Flow.primaryDirection=structuralBreak;
      gHT6Flow.leg=1;
   }
   else if(oldDir==DIR_FLAT)
   {
      gHT6Flow.primaryDirection=structuralBreak;
      gHT6Flow.leg=1;
   }
   else
   {
      gHT6Flow.leg=MathMin(5,gHT6Flow.leg+1);
   }

   gHT6Flow.consumedBoxTime=gHT6Flow.llTime;
   gHT6Flow.consumedBreakMask|=breakBit;
   gHT6Flow.lastBreakDirection=structuralBreak;
   gHT6Flow.sellSwitchConfirmCount=0;
   gHT6Flow.buySwitchConfirmCount=0;
   gHT6Flow.lastBreakBar=closedBar;
   gHT6Flow.lastBreakPenetrationATR=MathMax(0.0,penetration);
   gHT6Flow.state=(structuralBreak==DIR_BUY?"STRUCTURE CLOSE BUY":"STRUCTURE CLOSE SELL")+
                  " • LEG "+IntegerToString(gHT6Flow.leg)+
                  " • PEN "+DoubleToString(penetration,2)+" ATR";
   gHT6EinsteinAudit=gHT6Flow.state;

   // New leg = new evidence bank. Old hard signals cannot be carried forward
   // into the 3-5 zone.
   HT6EinsteinPrimePointLedger(closedBar);
   HT6EinsteinRefreshFlowMemories();
   HT6EinsteinSyncSequence();

   RefreshRates();
   double entryPrice=(structuralBreak==DIR_BUY?Ask:Bid);
   bool firstCore=(oldDir==DIR_FLAT || oldDir!=structuralBreak || HT6StructureHoldCount(structuralBreak)<=0);
   bool sameDirectionCore=(oldDir==structuralBreak && DirectOpenCoreOnSameDirectionBreak);
   bool coreRoom=(HT6StructureHoldCount(structuralBreak)<MathMax(1,DirectMaximumCoreHolds));
   if((firstCore || sameDirectionCore) && coreRoom)
   {
      gHT6Flow.structureEntryPending=true;
      gHT6Flow.pendingStructureDirection=structuralBreak;
      gHT6Flow.pendingStructureLeg=gHT6Flow.leg;
      gHT6Flow.pendingStructureStop=HT6EinsteinDoctrineStop(structuralBreak,entryPrice);
      HT6EinsteinOpenStructureHold(structuralBreak);
   }
   else
   {
      gHT6Flow.structureEntryPending=false;
      gHT6EinsteinAudit="STRUCTURE LEG ACCEPTED • CORE ADD DISABLED/CAPPED • SONIC CONTINUES";
   }
}

bool HT6DirectIsCoreComment(string c) { return StringFind(c,"HT6_CORE_")==0; }
bool HT6DirectIsSonicComment(string c) { return StringFind(c,"HT6_ADD_")==0; }

void HT6ManageDirectPerTradeProtection()
{
   // v6.20 ticket roles own their own protection inside H620TrailAndExtend.
}

void HT6EinsteinManageOrders()
{
   if(H620Enabled()) H620Ledger();
}

void HT6EinsteinDrawBox()
{
   // Minimal visual doctrine: only the two LL-derived structure rails remain.
   // All other analytical visuals are internal and surface through the dashboard.
   string lowName=Pfx()+"EIN_LL_LOW";
   string highName=Pfx()+"EIN_LL_HIGH";
   ObjectDelete(0,Pfx()+"EIN_LL_LOW_TXT");
   ObjectDelete(0,Pfx()+"EIN_LL_HIGH_TXT");
   if(!HT6EinsteinEnabled() || !gHT6Flow.boxReady)
   {
      ObjectDelete(0,lowName); ObjectDelete(0,highName);
      return;
   }

   if(ObjectFind(0,lowName)<0) ObjectCreate(0,lowName,OBJ_HLINE,0,0,gHT6Flow.lowerRail);
   if(ObjectFind(0,highName)<0) ObjectCreate(0,highName,OBJ_HLINE,0,0,gHT6Flow.upperRail);
   ObjectSetDouble(0,lowName,OBJPROP_PRICE1,gHT6Flow.lowerRail);
   ObjectSetDouble(0,highName,OBJPROP_PRICE1,gHT6Flow.upperRail);
   ObjectSetInteger(0,lowName,OBJPROP_COLOR,clrTomato);
   ObjectSetInteger(0,highName,OBJPROP_COLOR,clrLimeGreen);
   ObjectSetInteger(0,lowName,OBJPROP_WIDTH,2);
   ObjectSetInteger(0,highName,OBJPROP_WIDTH,2);
   ObjectSetInteger(0,lowName,OBJPROP_STYLE,STYLE_DASH);
   ObjectSetInteger(0,highName,OBJPROP_STYLE,STYLE_DASH);
   ObjectSetInteger(0,lowName,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,highName,OBJPROP_SELECTABLE,false);
}

void HT6EinsteinMinimalVisualCleanup()
{
   if(!HT6EinsteinEnabled()) return;
   string root=Pfx();
   string rails=root+"EIN_LL_";
   string einUI=root+"UI_EIN_";
   string einRows=root+"UI_ROW_EIN_";
   for(int i=ObjectsTotal()-1;i>=0;i--)
   {
      string n=ObjectName(i);
      if(StringFind(n,root,0)!=0) continue;
      if(StringFind(n,rails,0)==0) continue;
      if(StringFind(n,einUI,0)==0) continue;
      if(StringFind(n,einRows,0)==0) continue;
      ObjectDelete(0,n);
   }
   Comment("");
}


void HT6SequenceClear(string reason)
{
   gHT6Seq.active=false;
   gHT6Seq.direction=DIR_FLAT;
   gHT6Seq.moveCount=0;
   gHT6Seq.phase=SEQ_PHASE_OBSERVE;
   gHT6Seq.moveType=MOVE_TYPE_UNKNOWN;
   gHT6Seq.pauseType=PAUSE_TYPE_NONE;
   gHT6Seq.pauseActive=false;
   gHT6Seq.bosAccepted=false;
   gHT6Seq.transferReady=false;
   gHT6Seq.phase3Exceptional=false;
   gHT6Seq.phase3AddConsumed=false;
   gHT6Seq.campaignStart=0;
   gHT6Seq.lastMoveTime=0;
   gHT6Seq.pauseStart=0;
   gHT6Seq.lastSignalBar=0;
   gHT6Seq.campaignAnchor=0.0;
   gHT6Seq.lastMoveStartPrice=0.0;
   gHT6Seq.lastMoveExtreme=0.0;
   gHT6Seq.pauseHigh=0.0;
   gHT6Seq.pauseLow=0.0;
   gHT6Seq.impulseATR=0.0;
   gHT6Seq.pauseDepthATR=0.0;
   gHT6Seq.pauseBars=0.0;
   gHT6Seq.structureScore=0.0;
   gHT6Seq.rhythmScore=0.0;
   gHT6Seq.locationScore=0.0;
   gHT6Seq.continuationScore=0.0;
   gHT6Seq.exhaustionScore=0.0;
   gHT6Seq.maturityScore=0.0;
   gHT6Seq.state="OBSERVE • "+reason;
   gHT6DoctrineState=gHT6Seq.state;
}

int HT6SequenceStructuralDirection()
{
   int dir=DIR_FLAT;
   if(EnableMarketDNADirectionalSpine && gMDDirectionalDirection!=DIR_FLAT) dir=gMDDirectionalDirection;
   if(dir==DIR_FLAT && MathAbs(gHT5StructureAtlasPotential)>=0.08*HT6StrictnessFactor()) dir=HT5Sign(gHT5StructureAtlasPotential);
   if(dir==DIR_FLAT && MathAbs(gMDStructureATR)>=0.08*HT6StrictnessFactor()) dir=HT5Sign(gMDStructureATR);
   return dir;
}

int HT6AcceptedBOSDirection()
{
   double k=HT6StrictnessFactor();
   if(gMDChannelBreakDirection!=DIR_FLAT && MathAbs(gMDBOSATR)>=0.04*k) return gMDChannelBreakDirection;
   if(gMDTriggerRailBreakDirection!=DIR_FLAT && MathAbs(gMDBOSATR)>=0.03*k) return gMDTriggerRailBreakDirection;
   if(MathAbs(gMDBOSATR)>=0.08*k)
   {
      int d=HT5Sign(gMDBOSATR);
      if(d!=DIR_FLAT && (HT6SequenceStructuralDirection()==DIR_FLAT || HT6SequenceStructuralDirection()==d)) return d;
   }
   return DIR_FLAT;
}

bool HT6SignalFVGLocationReady(int dir)
{
   if(dir==DIR_FLAT) return false;
   if(gMDRLadderEntryOverrideActive) return true;
   if(MarketDNASignalFVGEntryReady(dir)) return true;

   // v6.01 SIMPLE: FVG is a preferred precision organ, not a universal choke point.
   // Only the explicit FVG-only user law makes it mandatory. Other location laws
   // may execute from the shared institutional location field / named setup plan.
   if(WhereMayFreshEntriesBegin!=ENTRY_ONLY_AT_SIGNAL_FVG) return true;
   return false;
}

double HT6DirectionRhythmScore(int dir)
{
   if(dir==DIR_FLAT) return 0.0;
   double raw=dir*(0.48*gMDRhythmScore+0.27*gMDRhythmForce+0.15*gMDPressureATR+0.10*gHT5Brain.expectedATR);
   return HT5Clamp(0.50+raw/0.45,0.0,1.0);
}

double HT6DirectionStructureScore(int dir)
{
   if(dir==DIR_FLAT) return 0.0;
   double signedStructure=dir*(0.34*gMDStructureATR+0.28*gMDBOSATR+0.18*gMDChannelATR+0.20*gHT5StructureAtlasPotential);
   double agree=HT5Clamp(gHT5StructureAtlasAgreement,0.0,1.0);
   return HT5Clamp(0.45+0.30*signedStructure+0.25*agree,0.0,1.0);
}

double HT6DirectionLocationScore(int dir)
{
   if(dir==DIR_FLAT) return 0.0;
   double directional=MathMax(0.0,dir*gHT5Location.netDirectionalField);
   double score=0.42*gHT5Location.fvgField+0.14*gHT5Location.obField+0.12*gHT5Location.stationField+
                0.10*gHT5Location.reclaimField+0.10*(dir==DIR_BUY?gHT5Location.dayLowField:gHT5Location.dayHighField)+0.12*directional;
   if(HT6SignalFVGLocationReady(dir)) score=MathMax(score,0.72);
   return HT5Clamp(score,0.0,1.0);
}

int HT6ClassifyPause(int dir,double atr,double &depthATR,double &bars)
{
   depthATR=0.0; bars=0.0;
   if(dir==DIR_FLAT || atr<=0.0 || iBars(Symbol(),SignalTF)<8) return PAUSE_TYPE_NONE;
   double c1=iClose(Symbol(),SignalTF,1),c2=iClose(Symbol(),SignalTF,2),c3=iClose(Symbol(),SignalTF,3);
   double o1=iOpen(Symbol(),SignalTF,1),h1=iHigh(Symbol(),SignalTF,1),l1=iLow(Symbol(),SignalTF,1);
   double h2=iHigh(Symbol(),SignalTF,2),l2=iLow(Symbol(),SignalTF,2);
   double body=MathAbs(c1-o1)/atr;
   double range=MathMax(Point,h1-l1)/atr;
   double signedStep=dir*(c1-c2)/atr;
   double last3High=MathMax(h1,MathMax(h2,iHigh(Symbol(),SignalTF,3)));
   double last3Low=MathMin(l1,MathMin(l2,iLow(Symbol(),SignalTF,3)));
   double cluster=(last3High-last3Low)/atr;

   // Type 1: meaningful counter-direction retracement.
   if(signedStep<=-0.12*HT6StrictnessFactor() || (gPyrEntryAnchor>0.0 && dir*(c1-gHT6Seq.lastMoveExtreme)<-0.18*atr))
   {
      depthATR=MathAbs(MathMin(0.0,signedStep)); bars=1.0;
      return PAUSE_TYPE_PULLBACK;
   }
   // Type 2: time passes in a tight overlapping shelf.
   if(cluster<=0.65/HT6StrictnessFactor() && MathAbs(c1-c3)/atr<=0.28 && body<=0.34)
   {
      depthATR=cluster; bars=3.0;
      return PAUSE_TYPE_SHELF;
   }
   // Type 3: brief hesitation without a real retracement.
   if(range<=0.52/HT6StrictnessFactor() && body<=0.24 && signedStep>-0.10)
   {
      depthATR=range; bars=1.0;
      return PAUSE_TYPE_HESITATION;
   }
   return PAUSE_TYPE_NONE;
}

int HT6ClassifyMoveType(int pauseType,double impulseATR,double pauseBars)
{
   if(impulseATR>=1.25*HT6StrictnessFactor() && pauseBars<=1.0) return MOVE_TYPE_DIRECT;
   if(pauseType==PAUSE_TYPE_PULLBACK || (pauseBars>=1.0 && pauseBars<=3.0)) return MOVE_TYPE_TWO_STAGE;
   if(pauseType==PAUSE_TYPE_HESITATION || pauseBars>3.0) return MOVE_TYPE_STAIRCASE;
   return MOVE_TYPE_DIRECT;
}

void HT6StartCampaign(int dir,string reason)
{
   if(dir==DIR_FLAT) return;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   RefreshRates(); double px=(Bid+Ask)*0.5;
   gHT6CampaignSerial++;
   gHT6Seq.active=true;
   gHT6Seq.campaignId=gHT6CampaignSerial;
   gHT6Seq.direction=dir;
   gHT6Seq.moveCount=1;
   gHT6Seq.phase=SEQ_PHASE_ATTACK;
   gHT6Seq.moveType=MOVE_TYPE_DIRECT;
   gHT6Seq.pauseType=PAUSE_TYPE_NONE;
   gHT6Seq.pauseActive=false;
   gHT6Seq.bosAccepted=true;
   gHT6Seq.transferReady=false;
   gHT6Seq.phase3Exceptional=false;
   gHT6Seq.phase3AddConsumed=false;
   gHT6Seq.campaignStart=TimeCurrent();
   gHT6Seq.lastMoveTime=TimeCurrent();
   gHT6Seq.pauseStart=0;
   gHT6Seq.campaignAnchor=px;
   gHT6Seq.lastMoveStartPrice=px;
   gHT6Seq.lastMoveExtreme=px;
   gHT6Seq.pauseHigh=0.0; gHT6Seq.pauseLow=0.0;
   gHT6Seq.impulseATR=0.0; gHT6Seq.pauseDepthATR=0.0; gHT6Seq.pauseBars=0.0;
   gHT6Seq.state="C"+IntegerToString(gHT6Seq.campaignId)+" "+(dir==DIR_BUY?"BULL":"BEAR")+" • PHASE 1 ATTACK • "+reason;
   gHT6DoctrineState=gHT6Seq.state;
   gHT6EntryPhaseSnapshot=gHT6Seq.phase;
   gHT6EntryMoveSnapshot=gHT6Seq.moveCount;
   gHT6EntryMoveTypeSnapshot=gHT6Seq.moveType;
   gHT6EntryPauseTypeSnapshot=gHT6Seq.pauseType;
   gHT6EntryContinuationSnapshot=0.0;
   gHT6EntryExhaustionSnapshot=0.0;
   HT5SetOrgan(ORGAN_SEQUENCE,0.85,gHT6DoctrineState);
}

bool HT6TransferProof(int oppositeDir)
{
   if(oppositeDir==DIR_FLAT) return false;
   bool bos=(HT6AcceptedBOSDirection()==oppositeDir);
   if(!bos) return false;
   if(WhatMustProveARealCampaignTransfer==TRANSFER_ACCEPTED_OPPOSITE_BOS) return true;
   bool rhythm=(HT6DirectionRhythmScore(oppositeDir)>=0.60);
   if(WhatMustProveARealCampaignTransfer==TRANSFER_BOS_PLUS_RHYTHM) return rhythm;
   bool structure=(HT6DirectionStructureScore(oppositeDir)>=0.62);
   bool acceptance=(oppositeDir*gMDAcceptanceATR>=0.04*HT6StrictnessFactor() || oppositeDir*gMDBOSATR>=0.10*HT6StrictnessFactor());
   bool location=(HT6DirectionLocationScore(oppositeDir)>=0.48 || gMDInflectionTransferReady || gMDTransferHandoffDirection==oppositeDir);
   return (rhythm && structure && acceptance && location);
}

void HT6UpdateSequenceScores()
{
   int dir=gHT6Seq.direction;
   if(dir==DIR_FLAT)
   {
      gHT6Seq.structureScore=0.0; gHT6Seq.rhythmScore=0.0; gHT6Seq.locationScore=0.0;
      gHT6Seq.continuationScore=0.0; gHT6Seq.exhaustionScore=0.0; gHT6Seq.maturityScore=0.0;
      return;
   }
   gHT6Seq.structureScore=HT6DirectionStructureScore(dir);
   gHT6Seq.rhythmScore=HT6DirectionRhythmScore(dir);
   gHT6Seq.locationScore=HT6DirectionLocationScore(dir);
   double channel=(MarketDNAHistoricalChannelAllowsDirection(dir)?1.0:0.0);
   gHT6Seq.continuationScore=HT5Clamp(0.34*gHT6Seq.structureScore+0.32*gHT6Seq.rhythmScore+
                                         0.22*gHT6Seq.locationScore+0.12*channel,0.0,1.0);
   double phaseMaturity=HT5Clamp((double)MathMax(0,gHT6Seq.moveCount-1)/4.0,0.0,1.0);
   double regimeExhaust=(gHT5BodyPhase==BODY_EXHAUSTION?1.0:(gHT5BodyPhase==BODY_DISTRIBUTION?0.70:0.0));
   double rhythmMature=HT5Clamp(gMDRhythmMaturity,0.0,1.0);
   double adverseRhythm=1.0-gHT6Seq.rhythmScore;
   gHT6Seq.maturityScore=HT5Clamp(0.72*phaseMaturity+0.18*rhythmMature+0.10*regimeExhaust,0.0,1.0);
   gHT6Seq.exhaustionScore=HT5Clamp(0.42*phaseMaturity+0.22*rhythmMature+0.18*regimeExhaust+0.18*adverseRhythm,0.0,1.0);

   double contFloor=0.73;
   if(HowMaySequenceMemoryInfluenceTheCreature==SEQUENCE_MEMORY_BOUNDED_ADAPTATION && gHT6PhaseSamples[SEQ_PHASE_ZONE_3_5]>=30.0)
   {
      // Bounded only: memory may move the threshold by at most +/-0.05.
      double edge=HT5Clamp(gHT6PhaseExpectancyR[SEQ_PHASE_ZONE_3_5],-0.50,0.50);
      contFloor=HT5Clamp(0.73-0.10*edge,0.68,0.78);
   }
   gHT6Seq.phase3Exceptional=(gHT6Seq.moveCount==3 && gHT6Seq.continuationScore>=MathMin(contFloor,0.70) &&
                              gHT6Seq.exhaustionScore<=0.78 && HT6SignalFVGLocationReady(dir));
}

void HT6SequenceSense()
{
   if(HT6EinsteinEnabled())
   {
      HT6EinsteinSyncSequence();
      return;
   }
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   if(iBars(Symbol(),SignalTF)<20 || atr<=0.0) return;
   datetime bar=iTime(Symbol(),SignalTF,0);
   int structuralDir=HT6SequenceStructuralDirection();
   int bosDir=HT6AcceptedBOSDirection();

   if(!gHT6Seq.active)
   {
      if(TradeCount()>0)
      {
         int live=(int)DetectDirection();
         if(live!=DIR_FLAT) HT6StartCampaign(live,"RESTORED OPEN CAMPAIGN");
      }
      else if(bosDir!=DIR_FLAT && (structuralDir==DIR_FLAT || structuralDir==bosDir))
         HT6StartCampaign(bosDir,"ACCEPTED BOS");
      else if(structuralDir!=DIR_FLAT &&
              HT6DirectionStructureScore(structuralDir)>=0.45 &&
              HT6DirectionRhythmScore(structuralDir)>=0.35)
         HT6StartCampaign(structuralDir,"STRUCTURE + RHYTHM BOOTSTRAP");
      else
      {
         gHT6Seq.phase=SEQ_PHASE_OBSERVE;
         gHT6Seq.state="PHASE 0 OBSERVE • WAIT DIRECTION + RHYTHM";
         gHT6DoctrineState=gHT6Seq.state;
         HT5SetOrgan(ORGAN_SEQUENCE,0.65,gHT6DoctrineState);
         return;
      }
   }

   int dir=gHT6Seq.direction;
   int opp=-dir;
   gHT6Seq.transferReady=HT6TransferProof(opp);
   if(gHT6Seq.transferReady)
   {
      // A transfer can be recognized while an old basket still exists, but the new
      // campaign cannot seed until the old campaign is flat.  Commander enforces it.
      gHT6Seq.state="TRANSFER PROVED "+(opp==DIR_BUY?"TO BULL":"TO BEAR")+" • WAIT FLAT / HANDOFF";
      gHT6DoctrineState=gHT6Seq.state;
      if(TradeCount()==0){ HT6StartCampaign(opp,"PROVED TRANSFER"); dir=gHT6Seq.direction; }
   }

   RefreshRates(); double px=(Bid+Ask)*0.5;
   if(dir==DIR_BUY) gHT6Seq.lastMoveExtreme=MathMax(gHT6Seq.lastMoveExtreme,px);
   else gHT6Seq.lastMoveExtreme=(gHT6Seq.lastMoveExtreme<=0.0?px:MathMin(gHT6Seq.lastMoveExtreme,px));
   gHT6Seq.impulseATR=MathAbs(gHT6Seq.lastMoveExtreme-gHT6Seq.lastMoveStartPrice)/atr;

   if(bar>0 && bar!=gHT6Seq.lastSignalBar)
   {
      gHT6Seq.lastSignalBar=bar;
      double depth=0.0,pbars=0.0;
      int ptype=HT6ClassifyPause(dir,atr,depth,pbars);
      if(!gHT6Seq.pauseActive && ptype!=PAUSE_TYPE_NONE)
      {
         gHT6Seq.pauseActive=true;
         gHT6Seq.pauseType=ptype;
         gHT6Seq.pauseStart=iTime(Symbol(),SignalTF,1);
         gHT6Seq.pauseHigh=iHigh(Symbol(),SignalTF,1);
         gHT6Seq.pauseLow=iLow(Symbol(),SignalTF,1);
         gHT6Seq.pauseDepthATR=depth;
         gHT6Seq.pauseBars=pbars;
      }
      else if(gHT6Seq.pauseActive)
      {
         double priorPauseHigh=gHT6Seq.pauseHigh;
         double priorPauseLow=gHT6Seq.pauseLow;
         gHT6Seq.pauseBars=MathMax(gHT6Seq.pauseBars,1.0+(double)(TimeCurrent()-gHT6Seq.pauseStart)/MathMax(60,PeriodSeconds(SignalTF)));
         double close1=iClose(Symbol(),SignalTF,1);
         double buffer=atr*0.05*HT6StrictnessFactor();
         bool continuation=(dir==DIR_BUY?close1>priorPauseHigh+buffer:close1<priorPauseLow-buffer);
         bool structureStill=(HT6SequenceStructuralDirection()==dir || dir*gMDStructureATR>=0.03);
         bool rhythmNotOpposite=(HT6DirectionRhythmScore(dir)>=0.42);
         if(continuation && structureStill && rhythmNotOpposite)
         {
            int priorPause=gHT6Seq.pauseType;
            double priorBars=gHT6Seq.pauseBars;
            gHT6Seq.moveType=HT6ClassifyMoveType(priorPause,MathMax(gHT6Seq.impulseATR,0.10),priorBars);
            gHT6Seq.moveCount=MathMin(5,gHT6Seq.moveCount+1);
            gHT6Seq.phase=gHT6Seq.moveCount;
            gHT6Seq.lastMoveTime=TimeCurrent();
            gHT6Seq.lastMoveStartPrice=close1;
            gHT6Seq.lastMoveExtreme=close1;
            gHT6Seq.impulseATR=0.0;
            gHT6Seq.pauseActive=false;
            gHT6Seq.pauseType=priorPause; // retain the pause that CREATED this move for learning/display.
            if(gHT6Seq.moveCount!=3) gHT6Seq.phase3AddConsumed=false;
         }
         else
         {
            // Only expand the pause box if this bar did not prove continuation.
            gHT6Seq.pauseHigh=MathMax(priorPauseHigh,iHigh(Symbol(),SignalTF,1));
            gHT6Seq.pauseLow=MathMin(priorPauseLow,iLow(Symbol(),SignalTF,1));
         }
      }
   }

   if(gHT6Seq.moveCount<=0) gHT6Seq.phase=SEQ_PHASE_OBSERVE;
   else if(gHT6Seq.moveCount==1) gHT6Seq.phase=SEQ_PHASE_ATTACK;
   else if(gHT6Seq.moveCount==2) gHT6Seq.phase=SEQ_PHASE_ACCELERATE;
   else if(gHT6Seq.moveCount==3) gHT6Seq.phase=SEQ_PHASE_ZONE_3_5;
   else if(gHT6Seq.moveCount==4) gHT6Seq.phase=SEQ_PHASE_DEFEND;
   else gHT6Seq.phase=SEQ_PHASE_HARVEST;

   HT6UpdateSequenceScores();
   string side=(gHT6Seq.direction==DIR_BUY?"BULL":"BEAR");
   string pause=(gHT6Seq.pauseActive?" • PAUSE "+HT6PauseTypeName(gHT6Seq.pauseType):" • LAST PAUSE "+HT6PauseTypeName(gHT6Seq.pauseType));
   gHT6Seq.state="C"+IntegerToString(gHT6Seq.campaignId)+" "+side+" • "+HT6PhaseName(gHT6Seq.phase)+
                 " • MOVE "+IntegerToString(gHT6Seq.moveCount)+" "+HT6MoveTypeName(gHT6Seq.moveType)+pause+
                 " • CONT "+DoubleToString(gHT6Seq.continuationScore,2)+" • EXH "+DoubleToString(gHT6Seq.exhaustionScore,2);
   gHT6DoctrineState=gHT6Seq.state;
   double health=(gHT6Seq.phase==SEQ_PHASE_OBSERVE?0.62:(gHT6Seq.phase<=SEQ_PHASE_ACCELERATE?0.95:(gHT6Seq.phase==SEQ_PHASE_ZONE_3_5?0.82:0.76)));
   HT5SetOrgan(ORGAN_SEQUENCE,health,gHT6DoctrineState);
}

int HT6PhaseBurstCap()
{
   if(!gHT6Seq.active) return 0;
   if(gHT6Seq.phase==SEQ_PHASE_ATTACK) return 2;
   if(gHT6Seq.phase==SEQ_PHASE_ACCELERATE) return 20;
   if(gHT6Seq.phase==SEQ_PHASE_ZONE_3_5)
   {
      if(WhatMayTheCreatureDoWhenMoveThreeBegins==PHASE3_PROTECT_ONLY) return 0;
      if(WhatMayTheCreatureDoWhenMoveThreeBegins==PHASE3_ADAPTIVE_ONE_PROVEN_ADD) return (gHT6Seq.phase3Exceptional && !gHT6Seq.phase3AddConsumed?1:0);
      return (gHT6Seq.phase3Exceptional?2:0);
   }
   return 0;
}

bool HT6DoctrineAllowsRequest(int dir,int kind,string &reason)
{
   reason="NONE";
   if(kind==DOCTRINE_REQUEST_PROTECT || kind==DOCTRINE_REQUEST_HARVEST) return true;
   if(dir==DIR_FLAT){ reason="SEQUENCE BLOCK: FLAT REQUEST"; return false; }
   if(!gHT6Seq.active){ reason="PHASE 0 OBSERVE: WAIT DIRECTION"; return false; }

   if(kind==DOCTRINE_REQUEST_TRANSFER)
   {
      if(gHT6Seq.transferReady && dir==-gHT6Seq.direction) return true;
      reason="TRANSFER WAIT: OPPOSITE BOS + RHYTHM"; return false;
   }

   if(dir!=gHT6Seq.direction)
   { reason="SEQUENCE BLOCK: WRONG CAMPAIGN SIDE"; return false; }

   if(gHT6Seq.phase==SEQ_PHASE_OBSERVE)
   { reason="PHASE 0 OBSERVE"; return false; }
   if(gHT6Seq.phase>=SEQ_PHASE_DEFEND)
   { reason=HT6PhaseName(gHT6Seq.phase)+": DEFEND / HARVEST — NO FRESH RISK"; return false; }

   // v6.01 SIMPLE DOCTRINE:
   // HARD GATES = side + phase + basic structure/rhythm + usable location.
   // Other organs score, label, learn and protect; they do not all have to vote YES.
   if(kind==DOCTRINE_REQUEST_SEED)
   {
      // v6.02 AUDIT: if Move 1 happened before the broker/risk/location path was
      // ready, a FLAT account may still seed during proven Move 2. Otherwise the
      // EA can miss Phase 1 and then be locked out for the entire campaign.
      if(gHT6Seq.phase!=SEQ_PHASE_ATTACK && gHT6Seq.phase!=SEQ_PHASE_ACCELERATE)
      { reason="SEED WAIT: NEED PHASE 1 OR 2"; return false; }
      if(gHT6Seq.structureScore<0.42)
      { reason="SEED WAIT: STRUCTURE"; return false; }
      if(gHT6Seq.rhythmScore<0.30)
      { reason="SEED WAIT: RHYTHM"; return false; }
      if(gHT6Seq.phase==SEQ_PHASE_ACCELERATE && gHT6Seq.continuationScore<0.45)
      { reason="SEED WAIT: PHASE 2 CONTINUATION"; return false; }
      if(WhereMayFreshEntriesBegin==ENTRY_ONLY_AT_SIGNAL_FVG && !MarketDNASignalFVGEntryReady(dir))
      { reason="SEED WAIT: STRICT SIGNAL FVG"; return false; }
      if(WhereMayFreshEntriesBegin!=ENTRY_ONLY_AT_SIGNAL_FVG &&
         gHT6Seq.locationScore<0.30 && !gHT5SetupEntryContext)
      { reason="SEED WAIT: LOCATION"; return false; }
      return true;
   }

   if(kind==DOCTRINE_REQUEST_ADD || kind==DOCTRINE_REQUEST_PENDING)
   {
      if(gHT6Seq.phase==SEQ_PHASE_ATTACK)
      {
         if(kind==DOCTRINE_REQUEST_PENDING) return true;
         if(TradeCountByDirection(dir)<2 && gHT6Seq.continuationScore>=0.50) return true;
         reason="PHASE 1 COMPLETE — WAIT MOVE 2"; return false;
      }
      if(gHT6Seq.phase==SEQ_PHASE_ACCELERATE)
      {
         if(gHT6Seq.continuationScore<0.48)
         { reason="PHASE 2 WAIT: CONTINUATION"; return false; }
         if(WhereMayFreshEntriesBegin==ENTRY_ONLY_AT_SIGNAL_FVG && !MarketDNASignalFVGEntryReady(dir))
         { reason="PHASE 2 WAIT: STRICT SIGNAL FVG"; return false; }
         return true;
      }
      if(gHT6Seq.phase==SEQ_PHASE_ZONE_3_5)
      {
         if(!gHT6Seq.phase3Exceptional)
         { reason="PHASE 3: PROTECT / WAIT EXCEPTIONAL CONTINUATION"; return false; }
         if(WhatMayTheCreatureDoWhenMoveThreeBegins==PHASE3_PROTECT_ONLY)
         { reason="PHASE 3: PROTECT ONLY"; return false; }
         if(WhatMayTheCreatureDoWhenMoveThreeBegins==PHASE3_ADAPTIVE_ONE_PROVEN_ADD && gHT6Seq.phase3AddConsumed)
         { reason="PHASE 3: PROVEN ADD USED"; return false; }
         return true;
      }
   }
   reason="SEQUENCE HOLD";
   return false;
}

bool HT6DoctrineCommanderSendAllows(int cmd,int dir,string &reason)
{
   if(HT6EinsteinEnabled())
   {
      reason="EINSTEIN FLOW";
      if(dir==DIR_FLAT){ reason="EINSTEIN BLOCK: FLAT"; return false; }

      // Primary structure holds are authorized only during the explicit
      // structure-close context created by HT6EinsteinFlowSense().
      if(gHT6StructureHoldOrderContext)
      {
         if(dir!=gHT6Flow.primaryDirection)
         { reason="EINSTEIN CORE BLOCK: WRONG STRUCTURE SIDE"; return false; }
         return true;
      }

      // Continuation adds require the same primary structure lock and must be
      // created by the point/energy engine. No other organ may impersonate it.
      if(gHT6ContinuationAddOrderContext)
      {
         if(dir!=gHT6Flow.primaryDirection)
         { reason="EINSTEIN ADD BLOCK: WRONG STRUCTURE SIDE"; return false; }
         if(gHT6Flow.leg<2 || gHT6Flow.leg>5)
         { reason="EINSTEIN ADD BLOCK: NOT LEG 2-5"; return false; }
         return true;
      }

      reason="EINSTEIN FLOW BLOCK: NON-STRUCTURE/NON-POINT ENTRY";
      return false;
   }

   bool pending=(cmd==OP_BUYLIMIT || cmd==OP_BUYSTOP || cmd==OP_SELLLIMIT || cmd==OP_SELLSTOP);
   int kind=(pending?DOCTRINE_REQUEST_PENDING:(TradeCount()==0?DOCTRINE_REQUEST_SEED:DOCTRINE_REQUEST_ADD));
   return HT6DoctrineAllowsRequest(dir,kind,reason);
}

// v6.02 AUDIT: PRIMARY SEQUENCE EXECUTION PATH.
// All safety remains downstream in PyrTryEntry -> SendOrder -> Commander.
// This function only prevents old Market-DNA/Q*/setup routing from becoming a
// second permission system after the sequence has already earned a trade.
bool HT6DirectSequenceExecutionAttempt()
{
   if(HT6EinsteinEnabled()) return false;
   if(!gHT6DoctrineOwnsEntry || !gHT6DirectSequenceExecution || !gHT6Seq.active) return false;
   if(gMDEntryTickSerial==gHT6LastDirectAttemptSerial) return false;
   int dir=gHT6Seq.direction;
   if(dir==DIR_FLAT) return false;
   int kind=(TradeCount()==0?DOCTRINE_REQUEST_SEED:DOCTRINE_REQUEST_ADD);
   string reason="";
   if(!HT6DoctrineAllowsRequest(dir,kind,reason))
   { gHT6AuditState=reason; return false; }

   // Existing campaigns are normally grown by the R-ladder. Only allow the
   // direct fallback add during Phase 2 if the ladder is not already active.
   if(TradeCount()>0)
   {
      if(gHT6Seq.phase!=SEQ_PHASE_ACCELERATE) return false;
      if(MarketDNASonicRLadder && gMDRLadderActive) return false;
   }

   gHT6LastDirectAttemptSerial=gMDEntryTickSerial;
   int bos=HT6AcceptedBOSDirection();
   gPyrSignalSource=(bos==dir?PYR_SOURCE_BOS_CONTINUATION:PYR_SOURCE_RHYTHM_ACCELERATOR);
   gPyrActiveSignalIdentity=TimeCurrent();
   gEntryStatus="SEQUENCE DIRECT ATTEMPT • "+HT6PhaseName(gHT6Seq.phase)+" • "+(dir==DIR_BUY?"BUY":"SELL");
   // The active Sequence owns the concrete seed geometry for this request.
   bool priorSequencePlanContext=gHT6SequencePlanContext;
   gHT6SequencePlanContext=true;
   bool opened=PyrTryEntry(dir);
   gHT6SequencePlanContext=priorSequencePlanContext;
   gHT6AuditState=(opened?"SEQUENCE DIRECT OPENED":gEntryStatus);
   return opened;
}

void HT6AuditPulse()
{
   datetime bar=iTime(Symbol(),SignalTF,0);
   if(bar<=0 || bar==gHT6LastAuditBar) return;
   gHT6LastAuditBar=bar;
   string side=(gHT6Seq.direction==DIR_BUY?"BUY":(gHT6Seq.direction==DIR_SELL?"SELL":"FLAT"));
   if(HT6EinsteinEnabled())
   {
      gHT6AuditState="EIN "+side+" "+HT6PhaseName(gHT6Seq.phase)+
                      " | LEG "+IntegerToString(gHT6Flow.leg)+
                      " | BOX "+DoubleToString(gHT6Flow.lowerRail,Digits)+"/"+DoubleToString(gHT6Flow.upperRail,Digits)+
                      " | A/O "+DoubleToString(gHT6Flow.pointBank,2)+"/"+DoubleToString(gHT6Flow.oppositionBank,2)+
                      " | REQ "+DoubleToString(HT6EinsteinRequiredPoints(gHT6Flow.leg),1)+
                      " | BIAS "+DoubleToString(gHT6Flow.pressureBias,2)+
                      " | E "+DoubleToString(gHT6Flow.energy,2)+
                      " | RHY "+DoubleToString(gHT6Seq.rhythmScore,2)+
                      " | CORE "+IntegerToString(HT6StructureHoldCount(DIR_FLAT))+
                      " | ADD "+IntegerToString(HT6ContinuationAddCount(DIR_FLAT))+
                      " | SONIC "+IntegerToString(gHT6Flow.sonicNodesFired)+"/"+IntegerToString(gHT6SonicNodesPerCore)+
                      " | SELL2 "+IntegerToString(gHT6Flow.sellSwitchConfirmCount)+"/"+IntegerToString(MathMax(2,gHT6SellSwitchCloseConfirmations))+
                      " | TP $"+DoubleToString(gHT6Flow.sonicPocketTargetMoney,2)+
                      " | LAST "+gHT6EinsteinAudit;
   }
   else
   {
      gHT6AuditState="SEQ "+side+" "+HT6PhaseName(gHT6Seq.phase)+
                      " | STR "+DoubleToString(gHT6Seq.structureScore,2)+
                      " | RHY "+DoubleToString(gHT6Seq.rhythmScore,2)+
                      " | LOC "+DoubleToString(gHT6Seq.locationScore,2)+
                      " | CONT "+DoubleToString(gHT6Seq.continuationScore,2)+
                      " | MDDIR "+IntegerToString(gMDDesiredDirection)+
                      " | BASE "+DoubleToString(gMDBaseCarLot,2)+
                      " | MDBLOCK "+gMDDeployBlockReason+
                      " | ENTRY "+gEntryStatus;
   }
   Print("HT6 AUDIT | ",gHT6AuditState);
}

void HT6CaptureEntrySequenceSnapshot()
{
   gHT6EntryPhaseSnapshot=gHT6Seq.phase;
   gHT6EntryMoveSnapshot=gHT6Seq.moveCount;
   gHT6EntryMoveTypeSnapshot=gHT6Seq.moveType;
   gHT6EntryPauseTypeSnapshot=gHT6Seq.pauseType;
   gHT6EntryContinuationSnapshot=gHT6Seq.continuationScore;
   gHT6EntryExhaustionSnapshot=gHT6Seq.exhaustionScore;
}

void HT6SequenceLearnOutcome(double r)
{
   int p=MathMax(0,MathMin(5,gHT6EntryPhaseSnapshot));
   int pa=MathMax(0,MathMin(3,gHT6EntryPauseTypeSnapshot));
   int mt=MathMax(0,MathMin(3,gHT6EntryMoveTypeSnapshot));
   gHT6PhaseSamples[p]+=1.0;
   gHT6PhaseExpectancyR[p]+=0.08*(r-gHT6PhaseExpectancyR[p]);
   gHT6PauseSamples[pa]+=1.0;
   gHT6PauseExpectancyR[pa]+=0.08*(r-gHT6PauseExpectancyR[pa]);
   gHT6MoveTypeSamples[mt]+=1.0;
   gHT6MoveTypeExpectancyR[mt]+=0.08*(r-gHT6MoveTypeExpectancyR[mt]);
}

void HT6SequenceSave()
{
   for(int i=0;i<6;i++)
   {
      GlobalVariableSet(HT5Key("SQPN"+IntegerToString(i)),gHT6PhaseSamples[i]);
      GlobalVariableSet(HT5Key("SQPE"+IntegerToString(i)),gHT6PhaseExpectancyR[i]);
   }
   for(int p=0;p<4;p++)
   {
      GlobalVariableSet(HT5Key("SQXN"+IntegerToString(p)),gHT6PauseSamples[p]);
      GlobalVariableSet(HT5Key("SQXE"+IntegerToString(p)),gHT6PauseExpectancyR[p]);
      GlobalVariableSet(HT5Key("SQMN"+IntegerToString(p)),gHT6MoveTypeSamples[p]);
      GlobalVariableSet(HT5Key("SQME"+IntegerToString(p)),gHT6MoveTypeExpectancyR[p]);
   }
}

void HT6SequenceLoad()
{
   HT6SequenceClear("MEMORY LOAD");
   for(int i=0;i<6;i++)
   {
      string n=HT5Key("SQPN"+IntegerToString(i)),e=HT5Key("SQPE"+IntegerToString(i));
      if(GlobalVariableCheck(n)) gHT6PhaseSamples[i]=GlobalVariableGet(n);
      if(GlobalVariableCheck(e)) gHT6PhaseExpectancyR[i]=GlobalVariableGet(e);
   }
   for(int p=0;p<4;p++)
   {
      string pn=HT5Key("SQXN"+IntegerToString(p)),pe=HT5Key("SQXE"+IntegerToString(p));
      string mn=HT5Key("SQMN"+IntegerToString(p)),me=HT5Key("SQME"+IntegerToString(p));
      if(GlobalVariableCheck(pn)) gHT6PauseSamples[p]=GlobalVariableGet(pn);
      if(GlobalVariableCheck(pe)) gHT6PauseExpectancyR[p]=GlobalVariableGet(pe);
      if(GlobalVariableCheck(mn)) gHT6MoveTypeSamples[p]=GlobalVariableGet(mn);
      if(GlobalVariableCheck(me)) gHT6MoveTypeExpectancyR[p]=GlobalVariableGet(me);
   }
}

void HT6DoctrineManageOpenCampaign()
{
   if(HT6EinsteinEnabled()) return;
   if(TradeCount()<=0 || !gHT6Seq.active) return;
   int dir=gHT6Seq.direction;
   // Phase 3 begins skepticism.  Protection is allowed to advance before another add.
   if(gHT6Seq.phase==SEQ_PHASE_ZONE_3_5 && gMDRLadderActive && gMDRLadderStageReached>0)
      HT5CampaignProtectionSolver(gMDRLadderStageReached);

   if(gHT6Seq.phase==SEQ_PHASE_DEFEND)
   {
      MarketDNADeletePendingLimits("PHASE 4 DEFEND");
      if(gMDRLadderActive) HT5CampaignProtectionSolver(MathMax(1,gMDRLadderStageReached));
      gHT5ProtectionState="PHASE 4 DEFEND • FRESH RISK OFF • BASKET PROTECTION FORWARD";
   }
   else if(gHT6Seq.phase==SEQ_PHASE_HARVEST)
   {
      MarketDNADeletePendingLimits("PHASE 5 HARVEST");
      if(gMDRLadderActive) HT5CampaignProtectionSolver(MathMax(1,gMDRLadderStageReached));
      bool hardDecay=(gHT6Seq.rhythmScore<0.34 && gHT6Seq.exhaustionScore>=0.72);
      bool provedOpposite=gHT6Seq.transferReady;
      if(BasketProfit()>0.0 && (hardDecay || provedOpposite))
         PyrCloseFullCampaign(provedOpposite?"PHASE 5 HARVEST / PROVED TRANSFER":"PHASE 5 HARVEST / RHYTHM DECAY");
   }
}

//===============================================================================
// v5.02 NAMED SETUP LIBRARY + UNIVERSAL AGREEMENT ENGINE
// Reconstructed HIGHTOWER-native versions of legacy named setup families are
// used where original .mq4 source was not available. They share one execution
// state machine and one learning ledger.
//===============================================================================
string HT5SourceName(int source)
{
   if(source==PYR_SOURCE_FAILED_EXTREME) return "FAILED EXTREME";
   if(source==PYR_SOURCE_TRAIN_STATION) return "TRAIN STATION";
   if(source==PYR_SOURCE_RECLAIM_AREA) return "RECLAIM AREA";
   if(source==PYR_SOURCE_DIRECTIONAL_RETEST) return "DIRECTIONAL RETEST";
   if(source==PYR_SOURCE_BOS_CONTINUATION) return "BOS BREAK";
   if(source==PYR_SOURCE_CONFIRMED_TREND_FLIP) return "CONFIRMED TREND FLIP";
   if(source==PYR_SOURCE_ROUTE_ACCELERATOR) return "ROUTE ACCELERATOR";
   if(source==PYR_SOURCE_INFLECTION_TRANSFER) return "INFLECTION TRANSFER";
   if(source==PYR_SOURCE_RHYTHM_ACCELERATOR) return "RHYTHM ACCELERATOR";
   if(source==PYR_SOURCE_CHANNEL_BOUNCE) return "CHANNEL BOUNCE";
   if(source==PYR_SOURCE_CHANNEL_BREAK) return "CHANNEL BREAK";
   if(source==PYR_SOURCE_TRIGGER_RAIL_BOUNCE) return "BLACK RAIL BOUNCE";
   if(source==PYR_SOURCE_TRIGGER_RAIL_BREAK) return "BLACK RAIL BREAK";
   if(source==PYR_SOURCE_BOS_PULLBACK) return "BOS PULLBACK";
   if(source==PYR_SOURCE_CHANNEL_BREAK_PULLBACK) return "CHANNEL BREAK PULLBACK";
   if(source==PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY) return "FAILED LOW LIQUIDITY BUY";
   if(source==PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL) return "FAILED HIGH LIQUIDITY SELL";
   if(source==PYR_SOURCE_U_SETUP) return "U SETUP";
   if(source==PYR_SOURCE_N_SETUP) return "N SETUP";
   if(source==PYR_SOURCE_MOTIV_V3) return "MOTIV V3";
   if(source==PYR_SOURCE_CC_GROW) return "CC GROW";
   if(source==PYR_SOURCE_KINGDOM_MANNER) return "KINGDOM MANNER";
   if(source==PYR_SOURCE_KINGDOM_SCALE) return "KINGDOM +SCALE";
   return "NONE";
}

string HT5SourceShortTag(int source)
{
   if(source==PYR_SOURCE_BOS_CONTINUATION) return "BOS";
   if(source==PYR_SOURCE_BOS_PULLBACK) return "BOSPB";
   if(source==PYR_SOURCE_CHANNEL_BREAK) return "CHBRK";
   if(source==PYR_SOURCE_CHANNEL_BREAK_PULLBACK) return "CHPB";
   if(source==PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY) return "FLBUY";
   if(source==PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL) return "FHSELL";
   if(source==PYR_SOURCE_U_SETUP) return "USET";
   if(source==PYR_SOURCE_N_SETUP) return "NSET";
   if(source==PYR_SOURCE_MOTIV_V3) return "MOTV3";
   if(source==PYR_SOURCE_CC_GROW) return "CCGRW";
   if(source==PYR_SOURCE_KINGDOM_MANNER) return "KMANN";
   if(source==PYR_SOURCE_KINGDOM_SCALE) return "KSCALE";
   if(source==PYR_SOURCE_FAILED_EXTREME) return "FAILX";
   if(source==PYR_SOURCE_TRAIN_STATION) return "TRAIN";
   if(source==PYR_SOURCE_RECLAIM_AREA) return "RECLM";
   if(source==PYR_SOURCE_DIRECTIONAL_RETEST) return "RETEST";
   if(source==PYR_SOURCE_CONFIRMED_TREND_FLIP) return "FLIP";
   if(source==PYR_SOURCE_ROUTE_ACCELERATOR) return "ROUTE";
   if(source==PYR_SOURCE_INFLECTION_TRANSFER) return "INFL";
   if(source==PYR_SOURCE_RHYTHM_ACCELERATOR) return "RHYTH";
   if(source==PYR_SOURCE_CHANNEL_BOUNCE) return "CHBNC";
   if(source==PYR_SOURCE_TRIGGER_RAIL_BOUNCE) return "BLBNC";
   if(source==PYR_SOURCE_TRIGGER_RAIL_BREAK) return "BLBRK";
   return "SETUP";
}

bool HT5SourceIsStructureFamily(int source)
{
   return (source==PYR_SOURCE_BOS_CONTINUATION || source==PYR_SOURCE_BOS_PULLBACK ||
           source==PYR_SOURCE_CONFIRMED_TREND_FLIP || source==PYR_SOURCE_U_SETUP || source==PYR_SOURCE_N_SETUP);
}
bool HT5SourceIsChannelFamily(int source)
{
   return (source==PYR_SOURCE_CHANNEL_BREAK || source==PYR_SOURCE_CHANNEL_BREAK_PULLBACK ||
           source==PYR_SOURCE_CHANNEL_BOUNCE || source==PYR_SOURCE_TRIGGER_RAIL_BREAK || source==PYR_SOURCE_TRIGGER_RAIL_BOUNCE);
}
bool HT5SourceIsLocationFamily(int source)
{
   return (source==PYR_SOURCE_FAILED_EXTREME || source==PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY ||
           source==PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL || source==PYR_SOURCE_RECLAIM_AREA ||
           source==PYR_SOURCE_TRAIN_STATION || source==PYR_SOURCE_KINGDOM_MANNER);
}
bool HT5SourceIsMotionFamily(int source)
{
   return (source==PYR_SOURCE_RHYTHM_ACCELERATOR || source==PYR_SOURCE_ROUTE_ACCELERATOR ||
           source==PYR_SOURCE_MOTIV_V3 || source==PYR_SOURCE_CC_GROW || source==PYR_SOURCE_KINGDOM_SCALE);
}

//==============================================================================
// v5.05 AUDIT-DRIVEN SURVIVAL / PROBATION / DEFENSE / TRADE TELEMETRY
//==============================================================================
// The Sept-2..4 statement audit showed that the worst damage came from trades
// dying inside the first two minutes, while simply holding all losing trades
// longer usually made the average outcome worse. Therefore this layer does not
// widen risk blindly. It blocks entries whose thesis stop is buried inside
// ordinary market noise, learns setup+direction expectancy, merges duplicate
// signals into one campaign, freezes adds while a campaign is defending, and
// records exact future MFE/MAE + post-exit ghost stages for later autopsy.

string HT5TicketTelemetryKey(string suffix,int ticket)
{
   return HT5Key("T_"+suffix+"_"+IntegerToString(ticket));
}

double HT5SourceSideSamplesValue(int source,int dir)
{
   if(source<=PYR_SOURCE_NONE || source>=32) return 0.0;
   return (dir==DIR_BUY?gHT5SourceBuySamples[source]:gHT5SourceSellSamples[source]);
}

double HT5SourceSideExpectancyValue(int source,int dir)
{
   if(source<=PYR_SOURCE_NONE || source>=32) return 0.0;
   return (dir==DIR_BUY?gHT5SourceBuyExpectancyR[source]:gHT5SourceSellExpectancyR[source]);
}

double HT5SourceSideEarlyDeathValue(int source,int dir)
{
   if(source<=PYR_SOURCE_NONE || source>=32) return 0.0;
   return (dir==DIR_BUY?gHT5SourceBuyEarlyDeath[source]:gHT5SourceSellEarlyDeath[source]);
}

double HT5SourceSideStopRateValue(int source,int dir)
{
   if(source<=PYR_SOURCE_NONE || source>=32) return 0.0;
   return (dir==DIR_BUY?gHT5SourceBuyStopRate[source]:gHT5SourceSellStopRate[source]);
}

double HT5SourceSideReliability(int source,int dir)
{
   double n=HT5SourceSideSamplesValue(source,dir);
   if(n<3.0) return 0.50;
   double e=HT5SourceSideExpectancyValue(source,dir);
   double early=HT5SourceSideEarlyDeathValue(source,dir);
   double stopRate=HT5SourceSideStopRateValue(source,dir);
   return HT5Clamp(0.58+0.18*e-0.28*early-0.12*stopRate,0.10,0.95);
}

// Audit priors are temporary guard rails only. After enough local live samples,
// symbol+direction expectancy becomes the authority and these priors disappear.
int HT5AuditPriorPenalty(int source)
{
   if(source==PYR_SOURCE_KINGDOM_MANNER) return 2;
   if(source==PYR_SOURCE_BOS_CONTINUATION ||
      source==PYR_SOURCE_BOS_PULLBACK ||
      source==PYR_SOURCE_CHANNEL_BOUNCE ||
      source==PYR_SOURCE_CHANNEL_BREAK_PULLBACK ||
      source==PYR_SOURCE_RECLAIM_AREA) return 1;
   return 0;
}

int HT5SetupProbationLevel(int source,int dir)
{
   if(HowShouldLosingSetupFamiliesBeHandled==PROBATION_OBSERVE_ONLY) return 0;
   if(source<=PYR_SOURCE_NONE || source>=32 || dir==DIR_FLAT) return 0;
   double n=HT5SourceSideSamplesValue(source,dir);
   if(n<5.0) return HT5AuditPriorPenalty(source);

   double e=HT5SourceSideExpectancyValue(source,dir);
   double early=HT5SourceSideEarlyDeathValue(source,dir);
   double stopRate=HT5SourceSideStopRateValue(source,dir);
   if(e<=-0.45 || early>=0.68 || (stopRate>=0.78 && e<0.0)) return 3;
   if(e<=-0.20 || early>=0.52 || (stopRate>=0.68 && e<0.05)) return 2;
   if(e<0.00 || early>=0.38 || stopRate>=0.62) return 1;
   return 0;
}

double HT5SourceSideRiskScale(int source,int dir)
{
   if(HowShouldLosingSetupFamiliesBeHandled<PROBATION_EXTRA_WITNESS_AND_RISK_REDUCTION) return 1.0;
   int p=HT5SetupProbationLevel(source,dir);
   if(p<=0) return 1.0;
   if(p==1) return 0.82;
   if(p==2) return 0.62;
   return 0.42;
}

int HT5ProbationExtraWitnesses(int source,int dir)
{
   if(HowShouldLosingSetupFamiliesBeHandled<PROBATION_REQUIRE_EXTRA_WITNESS) return 0;
   int p=HT5SetupProbationLevel(source,dir);
   if(p<=0) return 0;
   if(p==1) return 1;
   return 2;
}

double HT5M1AverageRange()
{
   int bars=iBars(Symbol(),PERIOD_M1);
   if(bars<5) return 0.0;
   double sum=0.0; int n=0;
   for(int i=1;i<=4;i++)
   {
      double h=iHigh(Symbol(),PERIOD_M1,i),l=iLow(Symbol(),PERIOD_M1,i);
      if(h>l && h>0.0 && l>0.0){ sum+=h-l; n++; }
   }
   return (n>0?sum/n:0.0);
}

double HT5EntryNoiseEnvelope()
{
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   double spread=MathMax(Point,SpreadPoints()*Point);
   double m1=HT5M1AverageRange();
   double tickNoise=MathMax(Point,MathAbs(gATRTickPulseEWMA));
   double wickNoise=MathAbs(gMDWickATR)*atr*0.40;
   double base=MathMax(spread*2.50,MathMax(atr*0.16,m1*0.55));
   base=MathMax(base,tickNoise*2.50);
   base=MathMax(base,wickNoise);
   double entropy=HT5Clamp(gHT5FlowEntropy,0.0,1.0);
   double vv=HT5Clamp(gHT5VolOfVol,0.0,1.5);
   gHT5NoiseEnvelopePrice=MathMax(Point,base*(1.0+0.25*entropy+0.12*vv));
   return gHT5NoiseEnvelopePrice;
}

bool HT5EntrySurvivalAllows(int source,int dir,double price,double stop,string &reason)
{
   reason="SURVIVAL OK";
   if(HowShouldEntriesProveTheyCanSurviveNormalNoise==SURVIVAL_FILTER_OFF) return true;
   if(dir==DIR_FLAT || price<=0.0 || stop<=0.0){ reason="INVALID SURVIVAL GEOMETRY"; return false; }

   // An earned SONIC stage has already proven survival through favorable R travel.
   if(gMDRLadderEntryOverrideActive)
   {
      if(gHT5DefenseMode){ reason="DEFENSE MODE OWNS CAMPAIGN"; return false; }
      return true;
   }

   double noise=MathMax(Point,HT5EntryNoiseEnvelope());
   double distance=MathAbs(price-stop);
   gHT5SurvivalRoom=distance/noise;
   int probation=HT5SetupProbationLevel(source,dir);
   double required=1.06;
   if(HowShouldEntriesProveTheyCanSurviveNormalNoise==SURVIVAL_NOISE_ENVELOPE_STRICT)
      required=1.42;
   else if(HowShouldEntriesProveTheyCanSurviveNormalNoise==SURVIVAL_ADAPTIVE_BY_TRAIN_AND_EXPECTANCY)
   {
      double support=HT5Clamp(0.55*gHT5TrainStrength+
                             0.25*MathMax(0.0,dir*gHT5FormulaArrowScore)+
                             0.20*(gHT5LiveThesis.active?gHT5LiveThesis.coherence:gHT5OrganConsensus),0.0,1.0);
      required=HT5Clamp(1.18+0.14*probation-0.22*support,0.90,1.65);
   }
   gHT5SurvivalRequired=required;

   if(gHT5SurvivalRoom<required)
   {
      reason="STOP INSIDE NORMAL NOISE "+DoubleToString(gHT5SurvivalRoom,2)+"<"+DoubleToString(required,2);
      gHT5EntrySurvivalState=reason+" • NOISE "+DoubleToString(noise/Point,1)+"pt";
      return false;
   }

   // A setup+side already in probation needs stronger train proof instead of more
   // stop room. This is what prevents repeated wrong-side campaigns.
   if(probation>=2)
   {
      double minTrain=0.42+0.05*probation;
      double arrowAligned=dir*gHT5FormulaArrowScore;
      if(gHT5TrainDirection!=dir || gHT5TrainStrength<minTrain || arrowAligned<0.10)
      {
         reason="PROBATION NEEDS STRONGER TRAIN / ARROW";
         gHT5EntrySurvivalState=reason+" • P"+IntegerToString(probation);
         return false;
      }
   }

   gHT5EntrySurvivalState="SURVIVAL PASS • ROOM "+DoubleToString(gHT5SurvivalRoom,2)+"x / "+
                           DoubleToString(required,2)+"x • P"+IntegerToString(probation);
   return true;
}

bool HT5StopSymbolSanityAllows(int dir,double referencePrice,double marketPrice,double stop,bool pendingReference,string &reason)
{
   reason="STOP SANITY OK";
   if(stop<=0.0) return true;
   if(dir==DIR_FLAT || referencePrice<=0.0 || marketPrice<=0.0)
   { reason="STOP SANITY NO REFERENCE"; return false; }

   double atr=MathMax(Point,HTProtectiveStopATR());
   double fromMarket=MathAbs(marketPrice-stop);
   double ratio=fromMarket/MathMax(Point,MathAbs(marketPrice));
   double dayRange=MathAbs(iHigh(Symbol(),PERIOD_D1,0)-iLow(Symbol(),PERIOD_D1,0));
   double maxPhysical=MathMax(atr*6.0,MathMax(dayRange*1.50,MathAbs(marketPrice-referencePrice)*1.50+atr*2.0));

   if(ratio>0.18)
   {
      reason="STOP PRICE REGIME MISMATCH "+DoubleToString(ratio*100.0,1)+"% FROM MARKET";
      return false;
   }
   if(fromMarket>maxPhysical)
   {
      reason="STOP TOO FAR FOR SYMBOL "+DoubleToString(fromMarket/atr,1)+" ATR";
      return false;
   }

   // For pending entries, validate against the pending entry price. For live
   // market orders/modifications, validate against Bid/Ask so earned profit-side
   // stops remain legal.
   double brokerGap=MathMax(Point,MarketInfo(Symbol(),MODE_STOPLEVEL)*Point);
   if(pendingReference)
   {
      if(dir==DIR_BUY && stop>=referencePrice-brokerGap){ reason="BUY PENDING STOP NOT BELOW ENTRY"; return false; }
      if(dir==DIR_SELL && stop<=referencePrice+brokerGap){ reason="SELL PENDING STOP NOT ABOVE ENTRY"; return false; }
   }
   else
   {
      if(dir==DIR_BUY && stop>=Bid-brokerGap){ reason="BUY STOP NOT BELOW LIVE BID"; return false; }
      if(dir==DIR_SELL && stop<=Ask+brokerGap){ reason="SELL STOP NOT ABOVE LIVE ASK"; return false; }
   }
   return true;
}

void HT5TelemetryInitTicket(int ticket,int dir,double entry,double softStop,double hardStop,int source)
{
   if(ticket<=0) return;
   double r0=MathMax(Point,MathAbs(entry-softStop));
   GlobalVariableSet(HT5TicketTelemetryKey("ENTRY",ticket),entry);
   GlobalVariableSet(HT5TicketTelemetryKey("R0",ticket),r0);
   GlobalVariableSet(HT5TicketTelemetryKey("MFE",ticket),0.0);
   GlobalVariableSet(HT5TicketTelemetryKey("MAE",ticket),0.0);
   GlobalVariableSet(HT5TicketTelemetryKey("BIRTH",ticket),(double)TimeCurrent());
   GlobalVariableSet(HT5TicketTelemetryKey("SRC",ticket),(double)source);
   GlobalVariableSet(HT5TicketTelemetryKey("DIR",ticket),(double)dir);
   GlobalVariableSet(HT5TicketTelemetryKey("PROOF",ticket),0.0);
   GlobalVariableSet(HT5TicketTelemetryKey("SOFT",ticket),softStop);
   GlobalVariableSet(HT5TicketTelemetryKey("HARD",ticket),hardStop);
}

double HT5TicketMFER(int ticket)
{
   string k=HT5TicketTelemetryKey("MFE",ticket);
   return (GlobalVariableCheck(k)?GlobalVariableGet(k):0.0);
}

double HT5TicketMAER(int ticket)
{
   string k=HT5TicketTelemetryKey("MAE",ticket);
   return (GlobalVariableCheck(k)?GlobalVariableGet(k):0.0);
}

bool HT5TicketProofOfLife(int ticket,int dir)
{
   string pk=HT5TicketTelemetryKey("PROOF",ticket);
   if(GlobalVariableCheck(pk) && GlobalVariableGet(pk)>0.5) return true;
   double mfe=HT5TicketMFER(ticket);
   bool reaccepted=(gHT5TrainDirection==dir &&
                    dir*gMDReclaimATR>=0.05 &&
                    dir*gMDRhythmScore>=0.04 &&
                    dir*gHT5FormulaArrowScore>=0.06);
   bool proof=(mfe>=0.12 || reaccepted);
   if(proof) GlobalVariableSet(pk,1.0);
   return proof;
}

void HT5PrunePendingForDefense()
{
   if(!gHT5DefenseMode) return;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int t=OrderType();
      if(t!=OP_BUYLIMIT && t!=OP_BUYSTOP && t!=OP_SELLLIMIT && t!=OP_SELLSTOP) continue;
      int ticket=OrderTicket();
      if(HT5CommanderOrderDelete(ticket,clrNONE))
         gHT5DefenseState="DEFENSE • CANCELED PENDING #"+IntegerToString(ticket);
   }
}

void HT5UpdateOpenTicketTelemetry()
{
   bool nearNow=false;
   double atr=MathMax(Point,HTExecutionATR(SignalTF,14));
   RefreshRates();
   int nearCount=0;
   int openDir=DIR_FLAT;

   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int type=OrderType(); if(type!=OP_BUY && type!=OP_SELL) continue;
      int dir=(type==OP_BUY?DIR_BUY:DIR_SELL),ticket=OrderTicket();
      if(openDir==DIR_FLAT) openDir=dir;
      double entry=OrderOpenPrice();
      double soft=0.0,hard=0.0;
      string sk=HT5SoftStopKey(ticket),hk=HT5HardStopKey(ticket);
      if(GlobalVariableCheck(sk)) soft=GlobalVariableGet(sk); else soft=OrderStopLoss();
      if(GlobalVariableCheck(hk)) hard=GlobalVariableGet(hk); else hard=soft;
      if(!GlobalVariableCheck(HT5TicketTelemetryKey("R0",ticket)))
      {
         int src=(int)gHT5CampaignEntrySource;
         HT5TelemetryInitTicket(ticket,dir,entry,soft,hard,src);
      }

      double r0=MathMax(Point,GlobalVariableGet(HT5TicketTelemetryKey("R0",ticket)));
      double market=(dir==DIR_BUY?Bid:Ask);
      double moveR=dir*(market-entry)/r0;
      double mfe=MathMax(HT5TicketMFER(ticket),MathMax(0.0,moveR));
      double mae=MathMax(HT5TicketMAER(ticket),MathMax(0.0,-moveR));
      GlobalVariableSet(HT5TicketTelemetryKey("MFE",ticket),mfe);
      GlobalVariableSet(HT5TicketTelemetryKey("MAE",ticket),mae);
      if(mfe>=0.12) GlobalVariableSet(HT5TicketTelemetryKey("PROOF",ticket),1.0);

      double currentSL=OrderStopLoss(); if(currentSL<=0.0) currentSL=SovStoredStop(ticket);
      if(currentSL<=0.0 || soft<=0.0) continue;
      bool forwardEarned=(dir==DIR_BUY?currentSL>soft+Point:currentSL<soft-Point);
      if(forwardEarned) continue;
      double rescue=MathMax(atr*gHT5StopRescueZoneATR,MathAbs(entry-soft)*0.30);
      double distance=MathAbs(market-currentSL);
      if(distance<=rescue)
      {
         nearNow=true;
         nearCount++;
         gHT5DefenseLatched=true;
         gHT5DefenseDirection=dir;
      }
   }

   if(TradeCount()<=0)
   {
      gHT5DefenseLatched=false;
      gHT5DefenseDirection=DIR_FLAT;
      gHT5DefenseMode=false;
      gHT5DefenseState="ATTACK MODE • FLAT";
      return;
   }

   // Once a campaign enters defense, breathing the stop farther away is not enough
   // to instantly re-enable growth. Re-attack requires a real directional reclaim.
   if(gHT5DefenseLatched && !nearNow)
   {
      int d=(gHT5DefenseDirection!=DIR_FLAT?gHT5DefenseDirection:openDir);
      HT5UpdateTrainDirection();
      bool reclaimed=(d!=DIR_FLAT &&
                      gHT5TrainDirection==d &&
                      d*gHT5FormulaArrowScore>=0.10 &&
                      d*gMDReclaimATR>=0.04 &&
                      d*gMDRhythmScore>=0.04);
      if(reclaimed)
      {
         gHT5DefenseLatched=false;
         gHT5DefenseDirection=DIR_FLAT;
         gHT5DefenseState="RECLAIM PROVEN • DEFENSE RELEASED • GROWTH MAY RESUME";
      }
   }

   gHT5DefenseMode=(nearNow || gHT5DefenseLatched);
   if(gHT5DefenseMode)
   {
      if(nearNow)
         gHT5DefenseState="DEFENSE MODE • "+IntegerToString(nearCount)+" TICKET(S) NEAR THESIS STOP • NO ADDS";
      else
         gHT5DefenseState="DEFENSE LATCHED • WAIT TRAIN + ARROW + RECLAIM • NO ADDS";
      HT5PrunePendingForDefense();
   }
   else if(StringFind(gHT5DefenseState,"RECLAIM PROVEN",0)<0)
      gHT5DefenseState="ATTACK MODE • NO TICKET IN STOP RESCUE ZONE";
}

int HT5GhostStageSeconds(int stage)
{
   if(stage==0) return 30;
   if(stage==1) return 60;
   if(stage==2) return 120;
   if(stage==3) return 180;
   if(stage==4) return 300;
   if(stage==5) return 600;
   if(stage==6) return 900;
   if(stage==7) return 1800;
   return 3600;
}

int HT5GhostAllocateSlot()
{
   int oldest=0;
   for(int i=0;i<HT5_GHOST_SLOTS;i++)
   {
      if(gHT5GhostTicket[i]<=0) return i;
      if(gHT5GhostCloseTime[i]<gHT5GhostCloseTime[oldest]) oldest=i;
   }
   return oldest;
}

double HT5ProjectedTicketNet(int dir,double entry,double lots,double market,double commission)
{
   double k=HT5MoneyPerPriceUnitPerLot();
   if(k<=0.0) return 0.0;
   return dir*(market-entry)*k*lots+commission;
}

string HT5TradeTelemetryFileName()
{
   return "HIGHTOWER_V505_"+IntegerToString(AccountNumber())+"_"+Symbol()+"_TRADE_LIFECYCLE.csv";
}

string HT5GhostTelemetryFileName()
{
   return "HIGHTOWER_V505_"+IntegerToString(AccountNumber())+"_"+Symbol()+"_GHOST_STAGES.csv";
}

void HT5UpdateSourceSideTradeStat(int source,int dir,double r,double holdSeconds,bool stopped)
{
   if(source<=PYR_SOURCE_NONE || source>=32 || dir==DIR_FLAT) return;
   bool early=(holdSeconds<120.0 && r<0.0);
   if(dir==DIR_BUY)
   {
      gHT5SourceBuySamples[source]+=1.0;
      double a=2.0/(MathMin(50.0,gHT5SourceBuySamples[source])+1.0);
      gHT5SourceBuyExpectancyR[source]=(1.0-a)*gHT5SourceBuyExpectancyR[source]+a*r;
      gHT5SourceBuyEarlyDeath[source]=(1.0-a)*gHT5SourceBuyEarlyDeath[source]+a*(early?1.0:0.0);
      gHT5SourceBuyStopRate[source]=(1.0-a)*gHT5SourceBuyStopRate[source]+a*(stopped?1.0:0.0);
   }
   else
   {
      gHT5SourceSellSamples[source]+=1.0;
      double a=2.0/(MathMin(50.0,gHT5SourceSellSamples[source])+1.0);
      gHT5SourceSellExpectancyR[source]=(1.0-a)*gHT5SourceSellExpectancyR[source]+a*r;
      gHT5SourceSellEarlyDeath[source]=(1.0-a)*gHT5SourceSellEarlyDeath[source]+a*(early?1.0:0.0);
      gHT5SourceSellStopRate[source]=(1.0-a)*gHT5SourceSellStopRate[source]+a*(stopped?1.0:0.0);
   }
}

void HT5RegisterGhostFromSelectedHistory(int source,int dir,double actualNet,double r0,double commission)
{
   if(HowDeepShouldEachTradeBeMeasuredAfterExit<TELEMETRY_GHOST_HOLD_STAGES) return;
   int slot=HT5GhostAllocateSlot();
   gHT5GhostTicket[slot]=OrderTicket();
   gHT5GhostDir[slot]=dir;
   gHT5GhostSource[slot]=source;
   gHT5GhostMask[slot]=0;
   gHT5GhostCloseTime[slot]=OrderCloseTime();
   gHT5GhostEntry[slot]=OrderOpenPrice();
   gHT5GhostLots[slot]=OrderLots();
   gHT5GhostActualNet[slot]=actualNet;
   gHT5GhostCommission[slot]=commission;
   gHT5GhostR0[slot]=MathMax(Point,r0);
}

void HT5WriteClosedTradeTelemetrySelected()
{
   int type=OrderType(); if(type!=OP_BUY && type!=OP_SELL) return;
   int ticket=OrderTicket(),dir=(type==OP_BUY?DIR_BUY:DIR_SELL);
   int source=PYR_SOURCE_NONE;
   string srcKey=HT5TicketTelemetryKey("SRC",ticket);
   if(GlobalVariableCheck(srcKey)) source=(int)GlobalVariableGet(srcKey);
   if(source<=PYR_SOURCE_NONE || source>=32)
   {
      string c=OrderComment();
      for(int s=1;s<32;s++)
         if(StringFind(c,"HT5_"+HT5SourceShortTag(s),0)>=0){ source=s; break; }
   }

   double net=OrderProfit()+OrderSwap()+OrderCommission();
   double reserve=0.0;
   string rk=HT5RiskReserveKey(ticket);
   if(GlobalVariableCheck(rk)) reserve=GlobalVariableGet(rk);
   if(reserve<=0.0)
   {
      double sl=OrderStopLoss();
      if(sl>0.0) reserve=OrderRiskMoneyFromPrices(OrderOpenPrice(),sl,OrderLots());
   }
   double r=(reserve>0.01?net/reserve:0.0);
   double hold=MathMax(0.0,(double)(OrderCloseTime()-OrderOpenTime()));
   double mfe=HT5TicketMFER(ticket),mae=HT5TicketMAER(ticket);
   bool stopped=(StringFind(OrderComment(),"[sl]",0)>=0);
   if(!stopped && OrderStopLoss()>0.0)
      stopped=(MathAbs(OrderClosePrice()-OrderStopLoss())<=MathMax(TickSizePrice()*4.0,SpreadPoints()*Point*2.0));

   HT5UpdateSourceSideTradeStat(source,dir,r,hold,stopped);

   int h=FileOpen(HT5TradeTelemetryFileName(),FILE_CSV|FILE_READ|FILE_WRITE|FILE_COMMON,',');
   if(h!=INVALID_HANDLE)
   {
      if(FileSize(h)==0)
         FileWrite(h,"closeTime","ticket","symbol","direction","source","sourceLabel","openTime","holdSec","entry","softSL","hardSL","close","lots","net","R","MFE_R","MAE_R","stopped","trainScore","arrowScore","campaignMesh");
      FileSeek(h,0,SEEK_END);
      double soft=GlobalVariableCheck(HT5SoftStopKey(ticket))?GlobalVariableGet(HT5SoftStopKey(ticket)):OrderStopLoss();
      double hard=GlobalVariableCheck(HT5HardStopKey(ticket))?GlobalVariableGet(HT5HardStopKey(ticket)):soft;
      FileWrite(h,TimeToString(OrderCloseTime(),TIME_DATE|TIME_SECONDS),ticket,Symbol(),dir,source,HT5SourceName(source),
                TimeToString(OrderOpenTime(),TIME_DATE|TIME_SECONDS),hold,OrderOpenPrice(),soft,hard,OrderClosePrice(),
                OrderLots(),net,r,mfe,mae,(stopped?1:0),gHT5TrainScore,gHT5FormulaArrowScore,
                (gHT5CampaignThesis.active?gHT5CampaignThesis.coherence:0.0));
      FileClose(h);
   }
   HT5RegisterGhostFromSelectedHistory(source,dir,net,MathMax(Point,MathAbs(OrderOpenPrice()-
      (GlobalVariableCheck(HT5SoftStopKey(ticket))?GlobalVariableGet(HT5SoftStopKey(ticket)):OrderStopLoss()))),OrderCommission());
   GlobalVariableSet(HT5TicketTelemetryKey("CLOSED",ticket),1.0);
}

void HT5TelemetryScanClosed()
{
   if(HowDeepShouldEachTradeBeMeasuredAfterExit==TELEMETRY_CAMPAIGN_ONLY) return;
   string lk=HT5Key("TEL_LAST_CLOSE");
   if(gHT5TelemetryLastCloseScan<=0)
   {
      if(GlobalVariableCheck(lk)) gHT5TelemetryLastCloseScan=(datetime)GlobalVariableGet(lk);
      else
      {
         gHT5TelemetryLastCloseScan=TimeCurrent();
         GlobalVariableSet(lk,(double)gHT5TelemetryLastCloseScan);
         return;
      }
   }

   datetime newest=gHT5TelemetryLastCloseScan;
   int total=OrdersHistoryTotal();
   int start=(int)MathMax(0,total-300);
   for(int i=start;i<total;i++)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) continue;
      if(!OurOrder()) continue;
      if(OrderCloseTime()<gHT5TelemetryLastCloseScan-2) continue;
      if(OrderType()!=OP_BUY && OrderType()!=OP_SELL) continue;
      if(GlobalVariableCheck(HT5TicketTelemetryKey("CLOSED",OrderTicket()))) continue;
      HT5WriteClosedTradeTelemetrySelected();
      if(OrderCloseTime()>newest) newest=OrderCloseTime();
   }
   if(newest>gHT5TelemetryLastCloseScan)
   {
      gHT5TelemetryLastCloseScan=newest;
      GlobalVariableSet(lk,(double)newest);
      HT5SaveLivingMemory();
   }
}

void HT5UpdateGhostWatches()
{
   if(HowDeepShouldEachTradeBeMeasuredAfterExit<TELEMETRY_GHOST_HOLD_STAGES) return;
   RefreshRates();
   double marketBuy=Bid,marketSell=Ask;
   for(int i=0;i<HT5_GHOST_SLOTS;i++)
   {
      if(gHT5GhostTicket[i]<=0 || gHT5GhostCloseTime[i]<=0) continue;
      int elapsed=(int)(TimeCurrent()-gHT5GhostCloseTime[i]);
      for(int stage=0;stage<HT5_GHOST_STAGES;stage++)
      {
         int bit=(1<<stage);
         if((gHT5GhostMask[i]&bit)!=0) continue;
         int sec=HT5GhostStageSeconds(stage);
         if(elapsed<sec) continue;
         double market=(gHT5GhostDir[i]==DIR_BUY?marketBuy:marketSell);
         double ghost=HT5ProjectedTicketNet(gHT5GhostDir[i],gHT5GhostEntry[i],gHT5GhostLots[i],market,gHT5GhostCommission[i]);
         int h=FileOpen(HT5GhostTelemetryFileName(),FILE_CSV|FILE_READ|FILE_WRITE|FILE_COMMON,',');
         if(h!=INVALID_HANDLE)
         {
            if(FileSize(h)==0)
               FileWrite(h,"time","ticket","symbol","direction","source","sourceLabel","stageSec","actualNet","ghostNet","deltaVsActual","ghostR");
            FileSeek(h,0,SEEK_END);
            FileWrite(h,TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS),gHT5GhostTicket[i],Symbol(),gHT5GhostDir[i],
                      gHT5GhostSource[i],HT5SourceName(gHT5GhostSource[i]),sec,gHT5GhostActualNet[i],ghost,
                      ghost-gHT5GhostActualNet[i],ghost/MathMax(0.01,gHT5GhostR0[i]*HT5MoneyPerPriceUnitPerLot()*gHT5GhostLots[i]));
            FileClose(h);
         }
         gHT5GhostMask[i]|=bit;
      }
      if(elapsed>HT5GhostStageSeconds(HT5_GHOST_STAGES-1)+120 && gHT5GhostMask[i]==((1<<HT5_GHOST_STAGES)-1))
         gHT5GhostTicket[i]=0;
   }
}

void HT5BootstrapRecentTradeStats()
{
   if(HowShouldLosingSetupFamiliesBeHandled==PROBATION_OBSERVE_ONLY) return;
   string bk=HT5Key("V505_RECENT_BOOT");
   if(GlobalVariableCheck(bk)) return;

   int total=OrdersHistoryTotal(),looked=0;
   double baseline=MathMax(0.01,AccountRiskBase()*MathMax(0.10,SovereignOxRiskPercent())/100.0);
   for(int i=total-1;i>=0 && looked<120;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) continue;
      if(!OurOrder()) continue;
      int type=OrderType(); if(type!=OP_BUY && type!=OP_SELL) continue;
      string c=OrderComment();
      if(StringFind(c,"HT5_",0)<0) continue;
      int source=PYR_SOURCE_NONE;
      for(int s=1;s<32;s++)
         if(StringFind(c,"HT5_"+HT5SourceShortTag(s),0)>=0){ source=s; break; }
      if(source<=PYR_SOURCE_NONE || source>=32) continue;
      int dir=(type==OP_BUY?DIR_BUY:DIR_SELL);
      double net=OrderProfit()+OrderSwap()+OrderCommission();
      double r=HT5Clamp(net/baseline,-2.0,2.0);
      double hold=MathMax(0.0,(double)(OrderCloseTime()-OrderOpenTime()));
      bool stopped=(StringFind(c,"[sl]",0)>=0);
      HT5UpdateSourceSideTradeStat(source,dir,r,hold,stopped);
      looked++;
   }
   GlobalVariableSet(bk,(double)TimeCurrent());
   HT5SaveLivingMemory();
   gHT5TelemetryState="BOOTSTRAPPED "+IntegerToString(looked)+" RECENT HT5 TRADES FOR "+Symbol();
}

void HT5TelemetryTick()
{
   if(HowDeepShouldEachTradeBeMeasuredAfterExit>=TELEMETRY_MFE_MAE_PER_TICKET)
      HT5UpdateOpenTicketTelemetry();
   else
   {
      gHT5DefenseMode=false;
      gHT5DefenseState="TELEMETRY LIGHT / DEFENSE SENSOR OFF";
   }
   HT5TelemetryScanClosed();
   HT5UpdateGhostWatches();
   gHT5TelemetryState="TELEMETRY • "+gHT5DefenseState+" • "+gHT5EntrySurvivalState;
}

//==============================================================================
// v5.04 TRAIN DIRECTION + FORMULA ARROW + PRE-BUDGETED STOP BREATHING
//==============================================================================
double HT5SignedClamp(double v,double scale)
{
   return HT5Clamp(v/MathMax(0.000001,scale),-1.0,1.0);
}

void HT5UpdateFormulaArrow()
{
   double weightTerm=HT5Clamp(gWeight,-1.0,1.0);
   double slopeScale=MathMax(0.00005,MathMax(ArrowMinimumSlopeValue,0.00010));
   double slopeTerm=HT5SignedClamp(gArrowSlope,slopeScale*6.0);
   double angleTerm=HT5Clamp(gAngle/45.0,-1.0,1.0);
   double angleVelocityTerm=HT5Clamp(gAngleVelocity/18.0,-1.0,1.0);
   double structureTerm=HT5SignedClamp(0.58*gMDStructureATR+0.42*gMDBOSATR,0.32);
   double channelTerm=HT5SignedClamp(0.66*gMDChannelATR+0.20*gMDRouteATR+0.14*gMDReclaimATR,0.30);
   double flowTerm=HT5SignedClamp(0.42*gMDPressureATR+0.34*gMDRhythmScore+0.24*gMDRhythmForce,0.30);
   double wickTerm=HT5SignedClamp(gMDWickATR,0.24);
   double mtfTerm=HT5Clamp(gHT5StructureAtlasPotential/0.45,-1.0,1.0);
   double locationTerm=HT5Clamp(gHT5Location.netDirectionalField/0.50,-1.0,1.0);
   double score=0.0;
   if(HowShouldArrowDirectionBeCalculated==ARROW_FORMULA_WEIGHT_ONLY)
      score=0.50*weightTerm+0.30*slopeTerm+0.20*angleTerm;
   else if(HowShouldArrowDirectionBeCalculated==ARROW_FORMULA_STRUCTURE_PLUS_FLOW)
      score=0.28*structureTerm+0.22*channelTerm+0.24*flowTerm+0.12*weightTerm+0.08*slopeTerm+0.06*wickTerm;
   else if(HowShouldArrowDirectionBeCalculated==ARROW_FORMULA_FULL_CREATURE)
      score=0.20*structureTerm+0.16*channelTerm+0.18*flowTerm+0.10*locationTerm+0.09*mtfTerm+
            0.10*weightTerm+0.07*slopeTerm+0.04*angleTerm+0.03*angleVelocityTerm+0.03*wickTerm;
   else
      score=0.22*structureTerm+0.18*channelTerm+0.19*flowTerm+0.10*mtfTerm+0.08*locationTerm+
            0.09*weightTerm+0.06*slopeTerm+0.03*angleTerm+0.02*angleVelocityTerm+0.03*wickTerm;
   gHT5FormulaArrowScore=HT5Clamp(score,-1.0,1.0);
   int positiveFamilies=0,negativeFamilies=0;
   double family[7];
   family[0]=structureTerm; family[1]=channelTerm; family[2]=flowTerm; family[3]=mtfTerm;
   family[4]=weightTerm; family[5]=locationTerm; family[6]=wickTerm;
   for(int i=0;i<7;i++){ if(family[i]>0.08) positiveFamilies++; if(family[i]<-0.08) negativeFamilies++; }
   int dom=(int)MathMax(positiveFamilies,negativeFamilies);
   gHT5FormulaArrowConfidence=HT5Clamp(0.55*MathAbs(gHT5FormulaArrowScore)+0.45*((double)dom/7.0),0.0,1.0);
   int candidate=DIR_FLAT;
   if(gHT5FormulaArrowScore>=gHT5ArrowEnterThreshold && positiveFamilies>=3) candidate=DIR_BUY;
   if(gHT5FormulaArrowScore<=-gHT5ArrowEnterThreshold && negativeFamilies>=3) candidate=DIR_SELL;
   if(candidate==DIR_FLAT && gHT5FormulaArrowDirection!=DIR_FLAT)
   {
      double held=gHT5FormulaArrowDirection*gHT5FormulaArrowScore;
      if(held>=gHT5ArrowReleaseThreshold) candidate=gHT5FormulaArrowDirection;
   }
   gHT5FormulaArrowDirection=candidate;
   gHT5FormulaArrowState="ARROW "+(candidate==DIR_BUY?"BUY":(candidate==DIR_SELL?"SELL":"FLAT"))+
                         " • F="+DoubleToString(gHT5FormulaArrowScore,2)+" • C="+DoubleToString(gHT5FormulaArrowConfidence,2)+
                         " • FAMILIES "+IntegerToString(dom)+"/7";
}

void HT5UpdateTrainDirection()
{
   HT5UpdateFormulaArrow();
   double structure=HT5SignedClamp(0.58*gMDStructureATR+0.42*gMDBOSATR,0.34);
   double channel=HT5SignedClamp(0.58*gMDChannelATR+0.24*gMDRouteATR+0.18*gMDReclaimATR,0.32);
   double flow=HT5SignedClamp(0.40*gMDPressureATR+0.36*gMDRhythmScore+0.24*gMDRhythmForce,0.32);
   double mtf=HT5Clamp(gHT5StructureAtlasPotential/0.50,-1.0,1.0);
   double oracle=HT5SignedClamp(0.40*gMDOracleMicroTrendATR+0.34*gMDOracleOBFVGATR+0.26*gMDOraclePhaseATR,0.30);
   double location=HT5Clamp(gHT5Location.netDirectionalField/0.55,-1.0,1.0);
   double arrow=gHT5FormulaArrowScore;
   gHT5TrainScore=HT5Clamp(0.25*structure+0.20*channel+0.17*flow+0.12*mtf+0.08*oracle+0.06*location+0.12*arrow,-1.0,1.0);
   int pos=0,neg=0; double v[7];
   v[0]=structure;v[1]=channel;v[2]=flow;v[3]=mtf;v[4]=oracle;v[5]=location;v[6]=arrow;
   for(int i=0;i<7;i++){ if(v[i]>0.08) pos++; if(v[i]<-0.08) neg++; }
   int dir=DIR_FLAT;
   if(gHT5TrainScore>=gHT5TrainEnterThreshold && pos>=4) dir=DIR_BUY;
   if(gHT5TrainScore<=-gHT5TrainEnterThreshold && neg>=4) dir=DIR_SELL;
   gHT5TrainDirection=dir;
   gHT5TrainAgreement=(double)MathMax(pos,neg)/7.0;
   gHT5TrainStrength=HT5Clamp(0.62*MathAbs(gHT5TrainScore)+0.38*gHT5TrainAgreement,0.0,1.0);
   gHT5TrainState="TRAIN "+(dir==DIR_BUY?"BUY":(dir==DIR_SELL?"SELL":"FLAT"))+" • S="+
                  DoubleToString(gHT5TrainScore,2)+" • A="+DoubleToString(gHT5TrainAgreement,2)+" • "+gHT5FormulaArrowState;
}

bool HT5ReversalSource(int source)
{
   return (source==PYR_SOURCE_FAILED_EXTREME || source==PYR_SOURCE_FAILED_LOW_LIQUIDITY_BUY ||
           source==PYR_SOURCE_FAILED_HIGH_LIQUIDITY_SELL || source==PYR_SOURCE_U_SETUP || source==PYR_SOURCE_N_SETUP ||
           source==PYR_SOURCE_CONFIRMED_TREND_FLIP || source==PYR_SOURCE_INFLECTION_TRANSFER ||
           source==PYR_SOURCE_CHANNEL_BOUNCE || source==PYR_SOURCE_TRIGGER_RAIL_BOUNCE);
}

bool HT5ReversalTransferProven(int source,int dir)
{
   if(!HT5ReversalSource(source) || dir==DIR_FLAT) return false;
   double shift=dir*(0.46*gMDBOSATR+0.30*gMDReclaimATR+0.24*gMDPressureATR);
   double arrow=dir*gHT5FormulaArrowScore;
   bool accepted=(shift>=0.09 && arrow>=0.16);
   bool transfer=(gMDInflectionTransferReady && gMDInflectionDirection==dir) || gMDTransferHandoffDirection==dir;
   bool rail=(gMDTriggerRailBreakDirection==dir || gMDChannelBreakDirection==dir);
   return (accepted && (transfer || rail || dir*gMDRhythmScore>0.08));
}

bool HT5TrendFortificationAllows(int source,int dir,bool existingCampaign,string &reason)
{
   reason="TREND OK";
   if(dir==DIR_FLAT){ reason="NO DIRECTION"; return false; }
   HT5UpdateTrainDirection();
   if(HowStrictlyMustEveryEntryFollowTrainDirection==TREND_FORTIFY_CONTEXT_ONLY) return true;
   bool hardOpposite=(dir==DIR_BUY ?
      (gMDTriggerRailBreakDirection==DIR_SELL || gMDChannelBreakDirection==DIR_SELL || gMDTransferHandoffDirection==DIR_SELL) :
      (gMDTriggerRailBreakDirection==DIR_BUY || gMDChannelBreakDirection==DIR_BUY || gMDTransferHandoffDirection==DIR_BUY));
   if(hardOpposite){ reason="HARD OPPOSITE STRUCTURE"; return false; }
   if(existingCampaign)
   {
      if(gHT5TrainDirection==dir) return true;
      if(gHT5TrainDirection==DIR_FLAT && gHT5CampaignThesis.active && gHT5CampaignThesis.direction==dir &&
         dir*gHT5TrainScore>-0.05 && gHT5CampaignThesis.conflict<0.48) return true;
      reason="OPEN CAMPAIGN NOT SUPPORTED BY TRAIN"; return false;
   }
   if(HowStrictlyMustEveryEntryFollowTrainDirection==TREND_FORTIFY_TRAIN_DIRECTION_REQUIRED)
   { if(gHT5TrainDirection==dir) return true; reason="SETUP OPPOSES TRAIN DIRECTION"; return false; }
   if(HowStrictlyMustEveryEntryFollowTrainDirection==TREND_FORTIFY_TRAIN_PLUS_FORMULA_ARROW)
   { if(gHT5TrainDirection==dir && gHT5FormulaArrowDirection==dir) return true; reason="TRAIN + FORMULA ARROW NOT ALIGNED"; return false; }
   if(gHT5TrainDirection==dir && (gHT5FormulaArrowDirection==dir || dir*gHT5FormulaArrowScore>=0.10)) return true;
   if(gHT5TrainDirection!=dir && HT5ReversalTransferProven(source,dir))
   { reason="PROVEN REVERSAL TRANSFER OVERRIDES OLD TRAIN"; return true; }
   reason="ENTRY DOES NOT CORRESPOND TO TRAIN / ARROW"; return false;
}

void HT5PrunePendingAgainstTrain()
{
   if(HowStrictlyMustEveryEntryFollowTrainDirection==TREND_FORTIFY_CONTEXT_ONLY) return;
   HT5UpdateTrainDirection();
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      int type=OrderType();
      if(type!=OP_BUYLIMIT && type!=OP_BUYSTOP && type!=OP_SELLLIMIT && type!=OP_SELLSTOP) continue;
      int dir=((type==OP_BUYLIMIT || type==OP_BUYSTOP)?DIR_BUY:DIR_SELL);
      bool opposite=(gHT5TrainDirection!=DIR_FLAT && gHT5TrainDirection!=dir);
      bool formulaOpposite=(dir*gHT5FormulaArrowScore<=-0.18 && gHT5FormulaArrowConfidence>=0.40);
      if(!(opposite || formulaOpposite)) continue;
      int ticket=OrderTicket();
      if(HT5CommanderOrderDelete(ticket,clrNONE))
         gHT5TrendFortificationState="CANCEL PENDING #"+IntegerToString(ticket)+" • NO LONGER MATCHES TRAIN";
   }
}

string HT5HardStopKey(int ticket){ return HT5Key("HARD_"+IntegerToString(ticket)); }
string HT5SoftStopKey(int ticket){ return HT5Key("SOFT_"+IntegerToString(ticket)); }
string HT5RiskReserveKey(int ticket){ return HT5Key("RSV_"+IntegerToString(ticket)); }

double HT5ResolveHardReserveStop(int dir,double openPrice,double softStop)
{
   // v6.08 direct stop means exactly that: risk sizing and broker SL use the
   // same user-selected stop distance on every trade.
   if(DirectInputsOwnExecution) return softStop;
   if(gHT6StructureHoldOrderContext || gHT6ContinuationAddOrderContext) return softStop;
   if(gHT6SequencePlanContext) return softStop; // exact sequence seed risk geometry
   if(HowShouldStopsBreatheWhenTrendIsStillRight==STOP_BREATHING_OFF || softStop<=0.0 || dir==DIR_FLAT) return softStop;
   double atr=MathMax(Point,HTProtectiveStopATR());
   double softDistance=MathAbs(openPrice-softStop); if(softDistance<=Point) return softStop;
   double extra=MathMax(atr*gHT5HardReserveExtraATR,softDistance*(gHT5HardReserveMultiplier-1.0));
   double hardDistance=MathMin(atr*gHT5StopMaxDistanceATR,softDistance+extra);
   double hard=openPrice-dir*hardDistance;
   if(HowShouldStopsBreatheWhenTrendIsStillRight>=STOP_BREATH_STRUCTURE_REANCHOR_WITHIN_RESERVE)
   {
      double structure=0.0;
      if(ProtectiveStructureAnchor(dir,structure) && structure>0.0)
      {
         double structured=structure-dir*atr*0.06; double d=MathAbs(openPrice-structured);
         if(d>softDistance && d<=atr*gHT5StopMaxDistanceATR)
            hard=(dir==DIR_BUY?MathMin(hard,structured):MathMax(hard,structured));
      }
   }
   return HT5RoundBrokerSafeStop(dir,openPrice,hard);
}

bool HT5TrendStillRightForStop(int ticket,int dir)
{
   if(dir==DIR_FLAT) return false;
   HT5UpdateTrainDirection();
   bool hardOpposite=(dir==DIR_BUY ?
      (gMDTriggerRailBreakDirection==DIR_SELL || gMDChannelBreakDirection==DIR_SELL || gMDTransferHandoffDirection==DIR_SELL) :
      (gMDTriggerRailBreakDirection==DIR_BUY || gMDChannelBreakDirection==DIR_BUY || gMDTransferHandoffDirection==DIR_BUY));
   if(hardOpposite) return false;

   bool train=(gHT5TrainDirection==dir && gHT5TrainStrength>=0.38);
   b…62152 tokens truncated…e retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 088] H4_LOCATION_20BAR
// Domain: H4. Physical question: what does h4 location 20bar say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 089] H4_VOLUME_RATIO
// Domain: H4. Physical question: what does h4 volume ratio say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 090] H4_CANDLE_BODY_ATR
// Domain: H4. Physical question: what does h4 candle body atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 091] H4_UPPER_WICK_ATR
// Domain: H4. Physical question: what does h4 upper wick atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 092] H4_LOWER_WICK_ATR
// Domain: H4. Physical question: what does h4 lower wick atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 093] H4_CLOSE_LOCATION
// Domain: H4. Physical question: what does h4 close location say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 094] H4_MOMENTUM_3BAR_ATR
// Domain: H4. Physical question: what does h4 momentum 3bar atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 095] H4_MOMENTUM_6BAR_ATR
// Domain: H4. Physical question: what does h4 momentum 6bar atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 096] H4_SWING_RANGE_ATR
// Domain: H4. Physical question: what does h4 swing range atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 097] H4_DIRECTION_ALIGNMENT
// Domain: H4. Physical question: what does h4 direction alignment say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 098] H4_REJECTION_BALANCE
// Domain: H4. Physical question: what does h4 rejection balance say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 099] H4_VOLUME_DIRECTION_IMPULSE
// Domain: H4. Physical question: what does h4 volume direction impulse say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 100] STRUCTURE_ATR
// Domain: CROSS-ORGAN. Physical question: what does structure atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 101] BOS_ATR
// Domain: CROSS-ORGAN. Physical question: what does bos atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 102] PRESSURE_ATR
// Domain: CROSS-ORGAN. Physical question: what does pressure atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 103] ROUTE_ATR
// Domain: CROSS-ORGAN. Physical question: what does route atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 104] HISTORICAL_CHANNEL_ATR
// Domain: CROSS-ORGAN. Physical question: what does historical channel atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 105] RHYTHM_SCORE
// Domain: CROSS-ORGAN. Physical question: what does rhythm score say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 106] RHYTHM_FORCE
// Domain: CROSS-ORGAN. Physical question: what does rhythm force say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 107] RHYTHM_PULLBACK
// Domain: CROSS-ORGAN. Physical question: what does rhythm pullback say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 108] RHYTHM_CADENCE
// Domain: CROSS-ORGAN. Physical question: what does rhythm cadence say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 109] TICK_ENTROPY
// Domain: CROSS-ORGAN. Physical question: what does tick entropy say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 110] TICK_JERK_ATR
// Domain: CROSS-ORGAN. Physical question: what does tick jerk atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 111] DAY_RANGE_POSITION
// Domain: CROSS-ORGAN. Physical question: what does day range position say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 112] SIGNAL_FVG_FIELD
// Domain: CROSS-ORGAN. Physical question: what does signal fvg field say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 113] ORDER_BLOCK_FIELD
// Domain: CROSS-ORGAN. Physical question: what does order block field say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 114] STATION_FIELD
// Domain: CROSS-ORGAN. Physical question: what does station field say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 115] RECLAIM_FIELD
// Domain: CROSS-ORGAN. Physical question: what does reclaim field say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 116] NET_LOCATION_FIELD
// Domain: CROSS-ORGAN. Physical question: what does net location field say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 117] ORACLE_MICRO_TREND
// Domain: CROSS-ORGAN. Physical question: what does oracle micro trend say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 118] ORACLE_OB_FVG
// Domain: CROSS-ORGAN. Physical question: what does oracle ob fvg say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 119] ORACLE_PHASE
// Domain: CROSS-ORGAN. Physical question: what does oracle phase say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 120] INFLECTION_ATR
// Domain: CROSS-ORGAN. Physical question: what does inflection atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 121] ACCEPTANCE_ATR
// Domain: CROSS-ORGAN. Physical question: what does acceptance atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 122] PREDICTION_UNCERTAINTY
// Domain: CROSS-ORGAN. Physical question: what does prediction uncertainty say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 123] EXPECTED_ADVERSE_ATR
// Domain: CROSS-ORGAN. Physical question: what does expected adverse atr say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 124] COMPOUND_PROGRESS
// Domain: CROSS-ORGAN. Physical question: what does compound progress say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 125] CAMPAIGN_RISK_UTILIZATION
// Domain: CROSS-ORGAN. Physical question: what does campaign risk utilization say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 126] SESSION_LIQUIDITY_QUALITY
// Domain: CROSS-ORGAN. Physical question: what does session liquidity quality say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [DEEP CELL 127] DEEP_PATTERN_PREDICTION_R
// Domain: CROSS-ORGAN. Physical question: what does deep pattern prediction r say about the market right now?
// Normalization law: convert raw price/time/volume state into ATR-, range-, cadence-, or ratio-normalized coordinates before memory comparison.
// Collection law: current value + EWMA mean + EWMA variance + observed min/max + sample count are retained; campaign outcomes update correlation after closure.
// Memory law: nearest-pattern matching compares normalized state, direction, recency and regime rather than exact price numbers, so Gold at 2300 and 4300 can share geometry.
// Brain law: the cell can influence expected movement, uncertainty, timing or location only through its organ; it cannot call Commander or choose raw lot size.
// Risk law: a positive historical correlation never authorizes more than the selected seed/campaign risk ceiling; it can only improve use of already-permitted risk.
// Failure law: low sample count, high variance, contradictory timeframes or poor outcome correlation reduce reliability instead of freezing the entire creature.
// Autopsy law: when a campaign closes, this cell is compared with MFE, MAE, realized R, error class, source, session and physiology phase.
// Evolution law: persistent evidence may alter a bounded genome expression connected to this behavior; direct user risk and compound rate remain immutable choices.
// Diagnostic law: Formula Registry exposes live value, Z-state, reliability and outcome contribution for this exact cell.
// Authority law: measurement only. Hard Day/Channel/Broker/Risk laws and Commander remain above it.
// -------------------------------------------------------------------------------
// [GENOME CELL 00] STRUCTURE_AUTHORITY
// Phenotype: structure authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 01] BOS_AUTHORITY
// Phenotype: bos authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 02] CHANNEL_AUTHORITY
// Phenotype: channel authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 03] PRESSURE_AUTHORITY
// Phenotype: pressure authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 04] RHYTHM_AUTHORITY
// Phenotype: rhythm authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 05] LOCATION_AUTHORITY
// Phenotype: location authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 06] ORACLE_AUTHORITY
// Phenotype: oracle authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 07] MEMORY_AUTHORITY
// Phenotype: memory authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 08] FVG_TOUCH_ENVELOPE
// Phenotype: fvg touch envelope changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 09] FVG_INVALIDATION_DEPTH
// Phenotype: fvg invalidation depth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 10] OB_CONFLUENCE
// Phenotype: ob confluence changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 11] DAY_EXTREME_AUTHORITY
// Phenotype: day extreme authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 12] BLACK_RAIL_AUTHORITY
// Phenotype: black rail authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 13] STATION_AUTHORITY
// Phenotype: station authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 14] RECLAIM_AUTHORITY
// Phenotype: reclaim authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 15] LIQUIDITY_POOL_AUTHORITY
// Phenotype: liquidity pool authority changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 16] SONIC_FIRST_STAGE
// Phenotype: sonic first stage changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 17] SONIC_STAGE_CURVE
// Phenotype: sonic stage curve changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 18] SONIC_RISK_REUSE
// Phenotype: sonic risk reuse changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 19] SONIC_RHYTHM_REQUIREMENT
// Phenotype: sonic rhythm requirement changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 20] PROTECTION_CURVE
// Phenotype: protection curve changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 21] PROTECTION_LOCK
// Phenotype: protection lock changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 22] PULSE_ATTRACTION
// Phenotype: pulse attraction changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 23] PULSE_CRASH_BRAKE
// Phenotype: pulse crash brake changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 24] COMPOUND_DRIVE
// Phenotype: compound drive changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 25] RED_CONTINUATION
// Phenotype: red continuation changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 26] TARGET_EXTENSION
// Phenotype: target extension changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 27] MARGIN_RESERVE
// Phenotype: margin reserve changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 28] UNCERTAINTY_PENALTY
// Phenotype: uncertainty penalty changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 29] ADVERSE_PENALTY
// Phenotype: adverse penalty changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 30] EXECUTION_COST_PENALTY
// Phenotype: execution cost penalty changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 31] SESSION_QUALITY
// Phenotype: session quality changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 32] ACCUM_STRUCTURE
// Phenotype: accum structure changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 33] ACCUM_FLOW
// Phenotype: accum flow changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 34] ACCUM_LOCATION
// Phenotype: accum location changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 35] ACCUM_GROWTH
// Phenotype: accum growth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 36] EXPANSION_STRUCTURE
// Phenotype: expansion structure changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 37] EXPANSION_FLOW
// Phenotype: expansion flow changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 38] EXPANSION_LOCATION
// Phenotype: expansion location changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 39] EXPANSION_GROWTH
// Phenotype: expansion growth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 40] DISTRIBUTION_STRUCTURE
// Phenotype: distribution structure changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 41] DISTRIBUTION_FLOW
// Phenotype: distribution flow changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 42] DISTRIBUTION_LOCATION
// Phenotype: distribution location changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 43] DISTRIBUTION_GROWTH
// Phenotype: distribution growth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 44] EXHAUSTION_STRUCTURE
// Phenotype: exhaustion structure changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 45] EXHAUSTION_FLOW
// Phenotype: exhaustion flow changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 46] EXHAUSTION_LOCATION
// Phenotype: exhaustion location changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 47] EXHAUSTION_GROWTH
// Phenotype: exhaustion growth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 48] REVERSAL_STRUCTURE
// Phenotype: reversal structure changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 49] REVERSAL_FLOW
// Phenotype: reversal flow changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 50] REVERSAL_LOCATION
// Phenotype: reversal location changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 51] REVERSAL_TRANSFER
// Phenotype: reversal transfer changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 52] SMALL_ACCOUNT_RISK
// Phenotype: small account risk changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 53] SMALL_ACCOUNT_GROWTH
// Phenotype: small account growth changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 54] BROKER_COST
// Phenotype: broker cost changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 55] SPREAD_SENSITIVITY
// Phenotype: spread sensitivity changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 56] HOUR_LEARNING
// Phenotype: hour learning changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 57] SESSION_LEARNING
// Phenotype: session learning changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 58] SOURCE_RELIABILITY
// Phenotype: source reliability changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 59] PATTERN_RELIABILITY
// Phenotype: pattern reliability changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 60] ORGAN_RELIABILITY
// Phenotype: organ reliability changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 61] SHADOW_INFLUENCE
// Phenotype: shadow influence changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 62] ROLLBACK_SENSITIVITY
// Phenotype: rollback sensitivity changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [GENOME CELL 63] MUTATION_TEMPO
// Phenotype: mutation tempo changes a bounded runtime multiplier, never source code and never the user-selected campaign cap.
// Mutation trigger: repeated similar resolved-campaign evidence; a single loss is observation, not proof.
// Mutation step: selected Learning Speed controls a small bounded delta; min/max genome bounds prevent runaway self-modification.
// Epigenetic context: session, phase, small-account state and broker weather may temporarily alter expression without changing inherited base value.
// Correlation memory: the gene records whether deviations from neutral historically aligned with positive or negative realized R.
// Promotion law: previous phenotype is snapshotted before mutation; probation performance is compared with promotion fitness.
// Rollback law: deterioration beyond the configured evidence window restores the exact previous bounded phenotype.
// Safety law: seed risk, campaign risk, broker limits and margin reserve are not mutable genes.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 01] WhatIsTheCreaturesMission
// UI meaning: What Is The Creatures Mission. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 02] WhatMayTheCreatureTrade
// UI meaning: What May The Creature Trade. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 03] HowFastShouldTheCreatureReadSignals
// UI meaning: How Fast Should The Creature Read Signals. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 04] CompoundAccountByThisRateEveryCycle
// UI meaning: Compound Account By This Rate Every Cycle. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 05] RiskThisMuchOnTheInitialSeed
// UI meaning: Risk This Much On The Initial Seed. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 06] NeverLetOneCampaignRiskMoreThan
// UI meaning: Never Let One Campaign Risk More Than. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 07] HowAggressivelyShouldWinningMovementGrow
// UI meaning: How Aggressively Should Winning Movement Grow. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 08] WhereMayFreshEntriesBegin
// UI meaning: Where May Fresh Entries Begin. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 09] HowPreciselyShouldPriceRetestTheFVG
// UI meaning: How Precisely Should Price Retest The FVG. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 10] HowFarBackShouldTheCreatureRemember
// UI meaning: How Far Back Should The Creature Remember. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 11] HowMuchAuthorityShouldHistoricalChannelsHave
// UI meaning: How Much Authority Should Historical Channels Have. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 12] HowShouldDayHighLowProtectEntries
// UI meaning: How Should Day High Low Protect Entries. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 13] HowShouldTheBlackGoldRedChannelBehave
// UI meaning: How Should The Black Gold Red Channel Behave. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 14] HowStrongMustLiveTickFlowBe
// UI meaning: How Strong Must Live Tick Flow Be. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 15] HowShouldMagneticLimitZonesGrow
// UI meaning: How Should Magnetic Limit Zones Grow. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 16] HowShouldSonicAccelerateWinningTrades
// UI meaning: How Should Sonic Accelerate Winning Trades. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 17] HowShouldTheCreatureProtectEarnedProfit
// UI meaning: How Should The Creature Protect Earned Profit. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 18] HowShouldTheCreatureReverseDirection
// UI meaning: How Should The Creature Reverse Direction. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 19] HowDeepShouldOracleReadMarketPhase
// UI meaning: How Deep Should Oracle Read Market Phase. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 20] HowMuchCampaignMemoryShouldWILLUse
// UI meaning: How Much Campaign Memory Should WILLUse. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 21] HowShouldSURFLearnPredictionError
// UI meaning: How Should SURFLearn Prediction Error. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 22] HowShouldTheGenomeEvolve
// UI meaning: How Should The Genome Evolve. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 23] HowFastMayTheGenomeChange
// UI meaning: How Fast May The Genome Change. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 24] HowShouldVerySmallAccountsBeHandled
// UI meaning: How Should Very Small Accounts Be Handled. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 25] HowMuchMarginShouldRemainUnused
// UI meaning: How Much Margin Should Remain Unused. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 26] WhenShouldTheCreaturePreferToHunt
// UI meaning: When Should The Creature Prefer To Hunt. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 27] HowShouldCompoundTargetsBeCollected
// UI meaning: How Should Compound Targets Be Collected. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 28] HowDeepShouldMarketMemoryBecome
// UI meaning: How Deep Should Market Memory Become. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 29] HowShouldTheHospitalHandleDeadlocks
// UI meaning: How Should The Hospital Handle Deadlocks. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 30] HowMuchOfTheLivingDashboardShouldShow
// UI meaning: How Much Of The Living Dashboard Should Show. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [USER BEHAVIOR 31] HowSoonAfterCollectionShouldTheNextHuntStart
// UI meaning: How Soon After Collection Should The Next Hunt Start. This is a semantic dropdown, not a raw numeric tuning knob.
// Translation law: the dropdown maps to a coherent bundle of internal physiological parameters so incompatible raw settings cannot be selected accidentally.
// Persistence law: changing this behavior changes the creature phenotype at initialization; genome learning stays subordinate to the selected behavior family.
// Explainability law: dashboard and build notes use the same behavior name so the user can understand why the creature acts differently.
// Safety law: behavior presets may reduce deployment or alter timing/location, but cannot silently exceed broker, margin or selected campaign risk ceilings.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.0] CHRONOS / READINESS
// This cell isolates the readiness condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.1] CHRONOS / STABILITY
// This cell isolates the stability condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.2] CHRONOS / DIRECTION
// This cell isolates the direction condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.3] CHRONOS / TIMING
// This cell isolates the timing condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.4] CHRONOS / LOCATION
// This cell isolates the location condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.5] CHRONOS / RISK
// This cell isolates the risk condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.6] CHRONOS / MEMORY
// This cell isolates the memory condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 00.7] CHRONOS / ADAPTATION
// This cell isolates the adaptation condition of CHRONOS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.0] LUNGS / READINESS
// This cell isolates the readiness condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.1] LUNGS / STABILITY
// This cell isolates the stability condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.2] LUNGS / DIRECTION
// This cell isolates the direction condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.3] LUNGS / TIMING
// This cell isolates the timing condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.4] LUNGS / LOCATION
// This cell isolates the location condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.5] LUNGS / RISK
// This cell isolates the risk condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.6] LUNGS / MEMORY
// This cell isolates the memory condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 01.7] LUNGS / ADAPTATION
// This cell isolates the adaptation condition of LUNGS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.0] HEART / READINESS
// This cell isolates the readiness condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.1] HEART / STABILITY
// This cell isolates the stability condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.2] HEART / DIRECTION
// This cell isolates the direction condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.3] HEART / TIMING
// This cell isolates the timing condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.4] HEART / LOCATION
// This cell isolates the location condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.5] HEART / RISK
// This cell isolates the risk condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.6] HEART / MEMORY
// This cell isolates the memory condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 02.7] HEART / ADAPTATION
// This cell isolates the adaptation condition of HEART so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.0] SKELETON / READINESS
// This cell isolates the readiness condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.1] SKELETON / STABILITY
// This cell isolates the stability condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.2] SKELETON / DIRECTION
// This cell isolates the direction condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.3] SKELETON / TIMING
// This cell isolates the timing condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.4] SKELETON / LOCATION
// This cell isolates the location condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.5] SKELETON / RISK
// This cell isolates the risk condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.6] SKELETON / MEMORY
// This cell isolates the memory condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 03.7] SKELETON / ADAPTATION
// This cell isolates the adaptation condition of SKELETON so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.0] EYES / READINESS
// This cell isolates the readiness condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.1] EYES / STABILITY
// This cell isolates the stability condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.2] EYES / DIRECTION
// This cell isolates the direction condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.3] EYES / TIMING
// This cell isolates the timing condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.4] EYES / LOCATION
// This cell isolates the location condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.5] EYES / RISK
// This cell isolates the risk condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.6] EYES / MEMORY
// This cell isolates the memory condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 04.7] EYES / ADAPTATION
// This cell isolates the adaptation condition of EYES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.0] ORACLE / READINESS
// This cell isolates the readiness condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.1] ORACLE / STABILITY
// This cell isolates the stability condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.2] ORACLE / DIRECTION
// This cell isolates the direction condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.3] ORACLE / TIMING
// This cell isolates the timing condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.4] ORACLE / LOCATION
// This cell isolates the location condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.5] ORACLE / RISK
// This cell isolates the risk condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.6] ORACLE / MEMORY
// This cell isolates the memory condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 05.7] ORACLE / ADAPTATION
// This cell isolates the adaptation condition of ORACLE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.0] BRAIN / READINESS
// This cell isolates the readiness condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.1] BRAIN / STABILITY
// This cell isolates the stability condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.2] BRAIN / DIRECTION
// This cell isolates the direction condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.3] BRAIN / TIMING
// This cell isolates the timing condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.4] BRAIN / LOCATION
// This cell isolates the location condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.5] BRAIN / RISK
// This cell isolates the risk condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.6] BRAIN / MEMORY
// This cell isolates the memory condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 06.7] BRAIN / ADAPTATION
// This cell isolates the adaptation condition of BRAIN so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.0] HANDS / READINESS
// This cell isolates the readiness condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.1] HANDS / STABILITY
// This cell isolates the stability condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.2] HANDS / DIRECTION
// This cell isolates the direction condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.3] HANDS / TIMING
// This cell isolates the timing condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.4] HANDS / LOCATION
// This cell isolates the location condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.5] HANDS / RISK
// This cell isolates the risk condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.6] HANDS / MEMORY
// This cell isolates the memory condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 07.7] HANDS / ADAPTATION
// This cell isolates the adaptation condition of HANDS so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.0] MUSCLES / READINESS
// This cell isolates the readiness condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.1] MUSCLES / STABILITY
// This cell isolates the stability condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.2] MUSCLES / DIRECTION
// This cell isolates the direction condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.3] MUSCLES / TIMING
// This cell isolates the timing condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.4] MUSCLES / LOCATION
// This cell isolates the location condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.5] MUSCLES / RISK
// This cell isolates the risk condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.6] MUSCLES / MEMORY
// This cell isolates the memory condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 08.7] MUSCLES / ADAPTATION
// This cell isolates the adaptation condition of MUSCLES so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.0] IMMUNE / READINESS
// This cell isolates the readiness condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.1] IMMUNE / STABILITY
// This cell isolates the stability condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.2] IMMUNE / DIRECTION
// This cell isolates the direction condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.3] IMMUNE / TIMING
// This cell isolates the timing condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.4] IMMUNE / LOCATION
// This cell isolates the location condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.5] IMMUNE / RISK
// This cell isolates the risk condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.6] IMMUNE / MEMORY
// This cell isolates the memory condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 09.7] IMMUNE / ADAPTATION
// This cell isolates the adaptation condition of IMMUNE so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.0] METABOLISM / READINESS
// This cell isolates the readiness condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.1] METABOLISM / STABILITY
// This cell isolates the stability condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.2] METABOLISM / DIRECTION
// This cell isolates the direction condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.3] METABOLISM / TIMING
// This cell isolates the timing condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.4] METABOLISM / LOCATION
// This cell isolates the location condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.5] METABOLISM / RISK
// This cell isolates the risk condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.6] METABOLISM / MEMORY
// This cell isolates the memory condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 10.7] METABOLISM / ADAPTATION
// This cell isolates the adaptation condition of METABOLISM so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.0] MEMORY / READINESS
// This cell isolates the readiness condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.1] MEMORY / STABILITY
// This cell isolates the stability condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.2] MEMORY / DIRECTION
// This cell isolates the direction condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.3] MEMORY / TIMING
// This cell isolates the timing condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.4] MEMORY / LOCATION
// This cell isolates the location condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.5] MEMORY / RISK
// This cell isolates the risk condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.6] MEMORY / MEMORY
// This cell isolates the memory condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 11.7] MEMORY / ADAPTATION
// This cell isolates the adaptation condition of MEMORY so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.0] GENOME / READINESS
// This cell isolates the readiness condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.1] GENOME / STABILITY
// This cell isolates the stability condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.2] GENOME / DIRECTION
// This cell isolates the direction condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.3] GENOME / TIMING
// This cell isolates the timing condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.4] GENOME / LOCATION
// This cell isolates the location condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.5] GENOME / RISK
// This cell isolates the risk condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.6] GENOME / MEMORY
// This cell isolates the memory condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 12.7] GENOME / ADAPTATION
// This cell isolates the adaptation condition of GENOME so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.0] HOSPITAL / READINESS
// This cell isolates the readiness condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.1] HOSPITAL / STABILITY
// This cell isolates the stability condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.2] HOSPITAL / DIRECTION
// This cell isolates the direction condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.3] HOSPITAL / TIMING
// This cell isolates the timing condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.4] HOSPITAL / LOCATION
// This cell isolates the location condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.5] HOSPITAL / RISK
// This cell isolates the risk condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.6] HOSPITAL / MEMORY
// This cell isolates the memory condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 13.7] HOSPITAL / ADAPTATION
// This cell isolates the adaptation condition of HOSPITAL so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.0] COMMANDER / READINESS
// This cell isolates the readiness condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.1] COMMANDER / STABILITY
// This cell isolates the stability condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.2] COMMANDER / DIRECTION
// This cell isolates the direction condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.3] COMMANDER / TIMING
// This cell isolates the timing condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.4] COMMANDER / LOCATION
// This cell isolates the location condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.5] COMMANDER / RISK
// This cell isolates the risk condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.6] COMMANDER / MEMORY
// This cell isolates the memory condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
// [ORGAN CELL 14.7] COMMANDER / ADAPTATION
// This cell isolates the adaptation condition of COMMANDER so one strong top-level health number cannot hide a weak internal function.
// Health range: 0..1 after physical normalization; outcome-correlation memory is stored separately from instantaneous health.
// Autopsy: entry-time health is frozen with the campaign fingerprint and compared with realized R when the campaign resolves.
// Reliability: repeated useful behavior raises bounded confidence; repeated contradictory behavior reduces influence but does not delete the organ.
// Authority: subunit health can modify organ confidence only; Commander, hard risk, broker limits and compound collection stay sovereign.
// -------------------------------------------------------------------------------
//===============================================================================
// END DEEP CELL SPECIFICATION / REBUILD CONTRACT
//===============================================================================


//===============================================================================
// CREATURE CHRONICLE — EVENT MEMORY / STATE TRANSITION NERVOUS LOG
// The Chronicle is not a trade log.  It records changes in physiology so a loss
// can be replayed as a sequence: phase -> gate -> FVG -> seed -> growth -> protect.
//===============================================================================
#define HT5_CHRONICLE_CAP 64
datetime gHT5ChronicleTime[HT5_CHRONICLE_CAP];
int gHT5ChronicleOrgan[HT5_CHRONICLE_CAP];
int gHT5ChronicleSeverity[HT5_CHRONICLE_CAP];
string gHT5ChronicleText[HT5_CHRONICLE_CAP];
int gHT5ChronicleHead=0,gHT5ChronicleCount=0;
string gHT5ChronicleLast="CHRONICLE AWAKENING";
int gHT5ChroniclePrevPhase=-1,gHT5ChroniclePrevGate=-1,gHT5ChroniclePrevGenome=-1,gHT5ChroniclePrevCompound=-1;
bool gHT5ChroniclePrevFVG=false,gHT5ChroniclePrevRLadder=false;

void HT5ChronicleRecord(int organ,int severity,string text)
{
   int i=gHT5ChronicleHead;
   gHT5ChronicleTime[i]=TimeCurrent();
   gHT5ChronicleOrgan[i]=organ;
   gHT5ChronicleSeverity[i]=severity;
   gHT5ChronicleText[i]=text;
   gHT5ChronicleHead=(gHT5ChronicleHead+1)%HT5_CHRONICLE_CAP;
   if(gHT5ChronicleCount<HT5_CHRONICLE_CAP) gHT5ChronicleCount++;
   gHT5ChronicleLast=TimeToString(TimeCurrent(),TIME_SECONDS)+" • "+text;
}

string HT5ChronicleOrganName(int organ)
{
   if(organ==ORGAN_CHRONOS) return "CHRONOS";
   if(organ==ORGAN_LUNGS) return "LUNGS";
   if(organ==ORGAN_HEART) return "HEART";
   if(organ==ORGAN_SKELETON) return "SKELETON";
   if(organ==ORGAN_EYES) return "EYES";
   if(organ==ORGAN_ORACLE) return "ORACLE";
   if(organ==ORGAN_BRAIN) return "BRAIN";
   if(organ==ORGAN_HANDS) return "HANDS";
   if(organ==ORGAN_MUSCLES) return "MUSCLES";
   if(organ==ORGAN_IMMUNE) return "IMMUNE";
   if(organ==ORGAN_METABOLISM) return "METABOLISM";
   if(organ==ORGAN_MEMORY) return "MEMORY";
   if(organ==ORGAN_GENOME) return "GENOME";
   if(organ==ORGAN_HOSPITAL) return "HOSPITAL";
   if(organ==ORGAN_COMMANDER) return "COMMANDER";
   return "CREATURE";
}

void HT5ChroniclePulse()
{
   if(gHT5ChroniclePrevPhase!=gHT5BodyPhase)
   {
      HT5ChronicleRecord(ORGAN_ORACLE,0,"PHASE -> "+gHT5PhaseState);
      gHT5ChroniclePrevPhase=gHT5BodyPhase;
   }
   if(gHT5ChroniclePrevGate!=gHT5EntryPath.firstFailedGate)
   {
      HT5ChronicleRecord(ORGAN_HOSPITAL,(gHT5EntryPath.firstFailedGate==GATE_NONE?0:1),gHT5EntryPath.state);
      gHT5ChroniclePrevGate=gHT5EntryPath.firstFailedGate;
   }
   bool fvgLive=(gMDFVGArmed && gMDFVGReady && (gMDFVGInZone || gMDFVGTouchLatchUntilSerial>=gMDEntryTickSerial));
   if(fvgLive!=gHT5ChroniclePrevFVG)
   {
      HT5ChronicleRecord(ORGAN_EYES,0,(fvgLive?"SIGNAL FVG ENTERED EXECUTION WINDOW":"SIGNAL FVG LEFT EXECUTION WINDOW"));
      gHT5ChroniclePrevFVG=fvgLive;
   }
   if(gMDRLadderActive!=gHT5ChroniclePrevRLadder)
   {
      HT5ChronicleRecord(ORGAN_MUSCLES,0,(gMDRLadderActive?"SONIC R-LADDER ARMED":"SONIC R-LADDER FLAT"));
      gHT5ChroniclePrevRLadder=gMDRLadderActive;
   }
   if(gHT5ChroniclePrevGenome!=gEvoGenome)
   {
      HT5ChronicleRecord(ORGAN_GENOME,0,"GENOME -> "+IntegerToString(gEvoGenome)+" • "+gEvoState);
      gHT5ChroniclePrevGenome=gEvoGenome;
   }
   if(gHT5ChroniclePrevCompound!=gCompoundCycle)
   {
      HT5ChronicleRecord(ORGAN_METABOLISM,0,"COMPOUND CYCLE -> "+IntegerToString(gCompoundCycle)+" • BASE $"+DoubleToString(gCompoundAnchor,2)+" TARGET $"+DoubleToString(gCompoundTarget,2));
      gHT5ChroniclePrevCompound=gCompoundCycle;
   }
}

void HT5DrawChronicle()
{
   if(HowMuchOfTheLivingDashboardShouldShow!=VISUAL_FULL_DIAGNOSTIC_ORGANS) return;
   HT5Label("CHRONICLE_LAST","CHRONICLE • "+gHT5ChronicleLast,390,660,7,C'185,185,185');
}

// Chronicle interpretation laws:
// 01. A phase change is context, not entry permission.
// 02. A gate transition explains why execution became possible or impossible.
// 03. FVG-window transitions show the exact location event that can seed a campaign.
// 04. SONIC arm/flat transitions identify when the muscle system became expansion authority.
// 05. Genome transitions expose self-modification boundaries for later rollback review.
// 06. Compound transitions prove rebasing happened from realized balance, not historical debt.
// 07. Chronicle never calls OrderSend/Close/Modify/Delete.
// 08. Chronicle records only state transitions, avoiding per-tick disk or memory spam.
// 09. The fixed ring buffer bounds memory use on long-running MT4 terminals.
// 10. Event time uses broker terminal time so Journal/chart/campaign data can be aligned.
// 11. Severity is diagnostic only; it does not increase or decrease risk.
// 12. Hospital can use Chronicle history to distinguish a true deadlock from patient waiting.
// 13. Memory can compare Chronicle sequence with campaign outcome in future genome revisions.
// 14. Commander remains sovereign even when Chronicle reports a high-confidence transition.
// 15. The user can read the organism as a story instead of deciphering raw internal variables.
//===============================================================================


//===============================================================================
// ORGAN EXTENSION CONTRACTS — MAINTENANCE DNA
//===============================================================================
// CHRONOS deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// CHRONOS deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// LUNGS deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HEART deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// SKELETON deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// EYES deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// ORACLE deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// BRAIN deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HANDS deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MUSCLES deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// IMMUNE deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// METABOLISM deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// MEMORY deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// GENOME deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// HOSPITAL deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 01: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 02: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 03: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 04: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 05: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 06: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 07: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 08: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 09: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 10: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 11: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 12: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 13: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 14: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 15: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 16: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
// COMMANDER deep contract 17: preserve physical normalization, bounded authority, outcome traceability, and one-Commander execution whenever this organ is extended.
//===============================================================================


//===============================================================================
// v6.00 INTEGRATED BEHAVIOR DOCTRINE
// LAW 1  — Structure chooses campaign direction; no indicator independently trades.
// LAW 2  — A new accepted BOS creates Move 1 / ATTACK only after context agrees.
// LAW 3  — Another move is counted only after a classified pause and renewed continuation.
// LAW 4  — Pause 1=pullback, Pause 2=shelf, Pause 3=hesitation.
// LAW 5  — Move 1=ATTACK, Move 2=ACCELERATE, Move 3=ZONE 3-5, Move 4=DEFEND, Move 5=HARVEST.
// LAW 6  — Signals tell WHAT; signal-FVG tells WHERE; Sequence tells WHEN; RHYTHM tells HOW HARD.
// LAW 7  — SONIC is a muscle, never a brain: growth is strongest in Move 2 and restricted after Move 3.
// LAW 8  — PULSE is a hand: it prepares campaign inventory; it cannot create an unproved campaign.
// LAW 9  — Oracle describes regime; Inflection/Acceptance describe transfer; neither owns normal continuation.
// LAW 10 — Phase 4/5 create no fresh risk.  Existing risk is defended/harvested as one basket.
// LAW 11 — Opposite arrows are evidence, not liquidation authority.  Transfer must be structurally proved.
// LAW 12 — WILL/SURF/Genome learn outcomes by phase/move/pause but cannot bypass current doctrine.
// LAW 13 — Learning is observe/autopsy by default to reduce backtest-overfit feedback loops.
// LAW 14 — Every OrderSend still passes Commander, which performs the final phase/risk/location veto.
//===============================================================================
// SIGNAL doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SIGNAL doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// FVG doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// DAY_HIGH_LOW doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// HISTORICAL_CHANNEL doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BLACK_RAIL doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RED_RAIL doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// GOLD_RAIL doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ORDER_BLOCK doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// STATION doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RECLAIM doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// RHYTHM doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// PULSE_GROW doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// SONIC doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// R_LADDER doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// COMPOUND doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// AUTOPSY doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// ROLLBACK doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 01: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 02: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 03: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 04: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 05: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 06: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 07: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 08: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 09: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
// BROKER_WEATHER doctrine 10: the living rebuild keeps this behavior connected to context, location, timing, risk, memory and Commander rather than letting it operate as an isolated patch.
//===============================================================================

// ============================================================================
// HIGHTOWER v6.20 CAMPAIGN TASK ENGINE
// New normal authority: hold rail -> close acknowledgement -> opposite entry.
// Broker stops and explicit emergency/manual exits remain authoritative.
// Terminal globals persist per account/symbol/magic; one EA per such identity.
// ============================================================================
input double H620GrowthMilestonePercent = 10.0;
input double H620MaximumCampaignLossPercent = 5.0;
input double H620MaximumEntryStretchATR = 1.25;
input double H620MinimumRoomR = 1.10;
input double H620MaximumSpreadATR = 0.12;
input double H620CostReserveATR = 0.04;
input int    H620EntrySpacingSeconds = 3;
input double H620EntrySpacingATR = 0.15;
input int    H620RailPivotDepth = 2;
input double H620RailBufferATR = 0.15;
input int    H620ObstacleLookbackBars = 80;
input int    H620RunnerEveryNthAdd = 3;
input int    H620MaximumExtensions = 4;
input int    H620BreakoutLookbackBars = 5;
input double H620ExtensionStepATR = 1.00;
input double H620ExtensionNearATR = 0.35;
input double H620RunnerMinimumIntent = 0.65;
input double H620RunnerTrailATR = 1.20;
input int    H620FlipConfirmBars = 1;
input int    H620FlipExpiryBars = 8;
input bool   H620AllowRailFlip = true;
input bool   H620EnableFutureGoals = true;
input int    H620DefaultPauseMinutes = 15;

// 0 idle, 1 active, 2 closing old exposure, 3 awaiting executable opposite entry.
int h620Phase=0,h620Dir=0,h620Flip=0,h620AddSerial=0;
double h620Id=0,h620Base=0,h620Rail=0,h620BrokenRail=0;
double h620Realized=0,h620Floating=0,h620StopEstimate=0,h620Peak=0;
double h620BankedLevel=0,h620LastEntry=0;
datetime h620Started=0,h620FailureBar=0,h620LastEntryTime=0;
bool h620Mutation=false,h620FlipContext=false;
int h620FutureGoal=0; datetime h620FutureUntil=0; double h620FutureBaseline=0;
string h620Status="v6.20 READY";


#include "include/WISDO_CampaignProtocol.mqh"
#include "include/WISDO_H620Receiver.mqh"

string H620Key(string suffix)
{
   string identity=(IsTesting() || IsOptimization()?"TEST|":"")+AccountServer()+"|"+Symbol()+"|"+IntegerToString(MagicNumber);
   uint hash=2166136261;
   for(int i=0;i<StringLen(identity);i++){hash^=(uint)StringGetCharacter(identity,i);hash*=16777619;}
   return "H620_"+IntegerToString(AccountNumber())+"_"+IntegerToString((int)hash)+"_"+suffix;
}
string H620TicketKey(int ticket,string suffix){return H620Key(IntegerToString(ticket)+"_"+suffix);}
double H620Get(string suffix){string key=H620Key(suffix);return GlobalVariableCheck(key)?GlobalVariableGet(key):0.0;}
void H620Set(string suffix,double value){GlobalVariableSet(H620Key(suffix),value);}
bool H620Enabled(){return HT6EinsteinEnabled();}
double H620ATR(){return MathMax(Point,HTExecutionATR(SignalTF,MathMax(1,DirectATRStopPeriod)));}
double H620Tick(){return MarketInfo(Symbol(),MODE_TICKSIZE);}
double H620Value(){return MarketInfo(Symbol(),MODE_TICKVALUE);}
double H620Cash(double distance,double lots)
{
   double tick=H620Tick(),value=H620Value();
   if(tick<=0 || value<=0 || lots<=0) return 0;
   return distance/tick*value*lots;
}
double H620RoundStop(int dir,double price)
{
   double tick=H620Tick(); if(tick<=0) return 0;
   return NormalizeDouble((dir==DIR_BUY?MathFloor(price/tick):MathCeil(price/tick))*tick,Digits);
}
double H620RoundTarget(int dir,double price)
{
   double tick=H620Tick(); if(tick<=0) return 0;
   return NormalizeDouble((dir==DIR_BUY?MathCeil(price/tick):MathFloor(price/tick))*tick,Digits);
}
void H620Persist()
{
   H620Set("phase",h620Phase); H620Set("dir",h620Dir); H620Set("flip",h620Flip);
   H620Set("id",h620Id); H620Set("base",h620Base); H620Set("rail",h620Rail);
   H620Set("broken",h620BrokenRail); H620Set("started",(double)h620Started);
   H620Set("failure",(double)h620FailureBar); H620Set("serial",h620AddSerial);
   H620Set("peak",h620Peak); H620Set("banked",h620BankedLevel);
   H620Set("lastentry",h620LastEntry); H620Set("lasttime",(double)h620LastEntryTime);
   GlobalVariablesFlush();
}
int H620RoleSelected()
{
   // HOLD=0, COLLECTOR=1, RUNNER=2. Legacy unassigned adds adopt collector role.
   if(StringFind(OrderComment(),"HT6_CORE_")==0) return 0;
   string key=H620TicketKey(OrderTicket(),"role");
   if(GlobalVariableCheck(key)) return (int)GlobalVariableGet(key);
   return 1;
}
bool H620OwnedSelected()
{
   if(!OurOrder() || OrderCloseTime()!=0) return false;
   return StringFind(OrderComment(),"HT6_CORE_")==0 || StringFind(OrderComment(),"HT6_ADD_")==0;
}
bool H620CampaignTicketSelected()
{
   string key=H620TicketKey(OrderTicket(),"campaign");
   return GlobalVariableCheck(key) && GlobalVariableGet(key)==h620Id;
}
void H620Ledger()
{
   static datetime lastTime=0; static int lastOpen=-1,lastHistory=-1,lastPhase=-1; static double lastId=-1;
   if(lastTime==TimeCurrent() && lastOpen==OrdersTotal() && lastHistory==OrdersHistoryTotal() && lastId==h620Id && lastPhase==h620Phase) return;
   lastTime=TimeCurrent();lastOpen=OrdersTotal();lastHistory=OrdersHistoryTotal();lastId=h620Id;lastPhase=h620Phase;
   h620Realized=0;h620Floating=0;h620StopEstimate=0;
   if(h620Id<=0) return;
   for(int i=OrdersHistoryTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY) || !OurOrder() || !H620CampaignTicketSelected()) continue;
      h620Realized+=OrderProfit()+OrderSwap()+OrderCommission();
   }
   for(int j=OrdersTotal()-1;j>=0;j--)
   {
      if(!OrderSelect(j,SELECT_BY_POS,MODE_TRADES) || !H620OwnedSelected() || !H620CampaignTicketSelected()) continue;
      int d=OrderType()==OP_BUY?DIR_BUY:DIR_SELL;
      h620Floating+=OrderProfit()+OrderSwap()+OrderCommission();
      if(OrderStopLoss()>0)
         h620StopEstimate+=H620Cash(d*(OrderStopLoss()-OrderOpenPrice()),OrderLots())+OrderSwap()+OrderCommission()-H620Cash(H620ATR()*H620CostReserveATR,OrderLots());
   }
   h620StopEstimate+=h620Realized;
   h620Peak=MathMax(h620Peak,h620Realized+h620Floating);
   double step=MathMax(.01,H620GrowthMilestonePercent)/100.0;
   double achieved=0;
   if(h620Base>0 && h620Realized>0)
      achieved=MathFloor(MathLog((h620Base+h620Realized)/h620Base)/MathLog(1.0+step)+0.00000001);
   if(achieved>h620BankedLevel){h620BankedLevel=achieved;H620Persist();Print("H620 BANKED MILESTONE ",achieved,"; campaign continues, rail=",h620Rail);}
   gHT6DoubleCampaignActive=(h620Phase==1);
   gHT6DoubleCampaignStartBalance=h620Base;
   gHT6DoubleCampaignTargetEquity=h620Base*MathPow(1.0+step,h620BankedLevel+1);
   gHT6DoubleState="RAIL HOLDS | BANKED "+DoubleToString(h620Realized,2)+" | FLOAT "+DoubleToString(h620Floating,2)+" | STOP EST "+DoubleToString(h620StopEstimate,2);
}
double H620Obstacle(int dir,double price)
{
   int depth=MathMax(1,H620RailPivotDepth);
   int count=MathMin(H620ObstacleLookbackBars,iBars(Symbol(),SignalTF)-depth-2);
   double best=0;
   for(int s=depth+1;s<count;s++)
   {
      double level=(dir==DIR_BUY?iHigh(Symbol(),SignalTF,s):iLow(Symbol(),SignalTF,s));
      if(dir*(level-price)<=Point) continue;
      bool pivot=true;
      for(int k=1;k<=depth;k++)
      {
         if(dir==DIR_BUY && (level<=iHigh(Symbol(),SignalTF,s-k) || level<=iHigh(Symbol(),SignalTF,s+k))) pivot=false;
         if(dir==DIR_SELL && (level>=iLow(Symbol(),SignalTF,s-k) || level>=iLow(Symbol(),SignalTF,s+k))) pivot=false;
      }
      if(pivot && (best==0 || dir*(level-best)<0)) best=level;
   }
   return best;
}
bool H620EntryAllows(int dir,double price,double stop,string &why)
{
   why="OK"; if(!H620Enabled()) return true;
   if(h620FuturePaused || h620Quarantine){why="WISDO INTENTION / QUARANTINE PAUSE";return false;}
   if(h620Phase==2 || (h620Phase==3 && !h620FlipContext)){why="CLOSING / FLIP WAIT";return false;}
   if(H620Tick()<=0 || H620Value()<=0){why="INVALID BROKER TICK VALUE";return false;}
   double atr=H620ATR(),risk=dir*(price-stop),cost=(Ask-Bid)+atr*H620CostReserveATR;
   if(risk<=0){why="STOP WRONG SIDE";return false;}
   if(Ask-Bid>atr*H620MaximumSpreadATR){why="SPREAD / ATR TOO LARGE";return false;}
   if(h620Phase==1 && dir!=h620Dir){why="CAMPAIGN DIRECTION LOCK";return false;}
   if(h620Phase==1 && HT6StructureHoldCount(dir)<=0){why="NO SURVIVING HOLD";return false;}
   if(h620LastEntryTime>0 && TimeCurrent()-h620LastEntryTime<H620EntrySpacingSeconds){why="ENTRY COOLDOWN";return false;}
   if(h620Phase==1 && h620LastEntry>0 && MathAbs(price-h620LastEntry)<atr*H620EntrySpacingATR){why="ENTRY TOO CLOSE";return false;}
   double anchor=(h620FlipContext?h620BrokenRail:(dir==DIR_BUY?gHT6Flow.upperRail:gHT6Flow.lowerRail));
   // Continuations use a fresh closed-bar launch, not a distant campaign seed.
   if(gHT6ContinuationAddOrderContext) anchor=iClose(Symbol(),SignalTF,1);
   if(anchor<=0 || MathAbs(price-anchor)>atr*H620MaximumEntryStretchATR){why="ENTRY STRETCHED FROM LAUNCH";return false;}
   double obstacle=H620Obstacle(dir,price);
   double room=(obstacle>0?dir*(obstacle-price):risk*MathMax(H620MinimumRoomR,DirectAdaptiveTPMaximumR)+cost);
   if((room-cost)/(risk+cost)<H620MinimumRoomR){why="INSUFFICIENT ROOM TO STRUCTURE";return false;}
   return true;
}
double H620RiskLot(double price,double stop,double fraction)
{
   double base=MathMax(0.0,MathMin(AccountBalance(),AccountEquity()));
   double perLot=H620Cash(MathAbs(price-stop),1.0)+H620Cash(H620ATR()*H620CostReserveATR,1.0);
   if(base<=0 || perLot<=0) return 0;
   double openRisk=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(OrderStopLoss()<=0) return 0; // no new exposure while any owned position is unprotected
      int d=OrderType()==OP_BUY?DIR_BUY:DIR_SELL;
      openRisk+=H620Cash(MathMax(0.0,d*(OrderOpenPrice()-OrderStopLoss())),OrderLots());
      openRisk+=H620Cash(H620ATR()*H620CostReserveATR,OrderLots());
   }
   double available=MathMax(0.0,base*MathMax(0.0,DirectMaximumOpenRiskPercent)/100.0-openRisk);
   double requested=base*MathMin(MathMax(0.0,DirectMaximumSingleTradeRiskPercent),MathMax(0.0,DirectRiskPercentEveryTrade)*MathMax(0.0,fraction))/100.0;
   double raw=MathMin(available,requested)/perLot;
   double step=MarketInfo(Symbol(),MODE_LOTSTEP),minimum=MarketInfo(Symbol(),MODE_MINLOT),maximum=MarketInfo(Symbol(),MODE_MAXLOT);
   if(step<=0 || minimum<=0 || maximum<=0) return 0;
   double lot=NormalizeDouble(MathFloor(MathMin(raw,maximum)/step+0.000000001)*step,8);
   if(lot<minimum || lot*perLot>MathMin(available,requested)+0.000001) return 0;
   return lot;
}
int H620NextRole()
{
   if(gHT6StructureHoldOrderContext) return 0;
   if(H620RunnerEveryNthAdd>0 && (h620AddSerial+1)%H620RunnerEveryNthAdd==0) return 2;
   return 1;
}
double H620Target(int dir,double price,double stop,double lot)
{
   if(H620NextRole()==0) return 0; // hold has a broker SL and no normal TP
   double r=MathAbs(price-stop),moneyRisk=H620Cash(r,lot);
   if(r<=0 || moneyRisk<=0) return 0;
   double intent=HT5Clamp(HT6CampaignIntentScore(dir),0.0,1.0);
   double lo=MathMax(H620MinimumRoomR,DirectAdaptiveTPMinimumR),hi=MathMax(lo,DirectAdaptiveTPMaximumR);
   double adaptive=lo+(hi-lo)*intent;
   double base=(h620Base>0?h620Base:MathMin(AccountBalance(),AccountEquity()));
   double next=base*MathPow(1.0+H620GrowthMilestonePercent/100.0,h620BankedLevel+1)-base;
   double remaining=MathMax(0.0,next-h620Realized); // floating profit is never banked twice
   double tasks=MathMax(1,DirectMaximumTotalOpenTrades-1);
   double growthR=HT5Clamp(remaining/(tasks*moneyRisk),lo,hi);
   double targetR=HT5Clamp((adaptive+growthR)*0.5,lo,hi);
   double distance=r*targetR;
   double obstacle=H620Obstacle(dir,price);
   if(obstacle>0) distance=MathMin(distance,dir*(obstacle-price)-H620ATR()*H620CostReserveATR);
   return H620RoundTarget(dir,price+dir*distance);
}
void H620Register(int ticket,int dir,double stop,int role)
{
   if(h620Phase!=1)
   {
      h620Id=MathMax((double)TimeCurrent(),H620Get("counter")+1.0);H620Set("counter",h620Id);
      h620Started=TimeCurrent();h620Base=MathMax(.01,MathMin(AccountBalance(),AccountEquity()));
      h620Dir=dir;h620Rail=stop;h620Phase=1;h620Flip=0;
      h620Peak=0;h620Realized=0;h620Floating=0;h620BankedLevel=0;h620AddSerial=0;
   }
   if(role!=0) h620AddSerial++;
   GlobalVariableSet(H620TicketKey(ticket,"campaign"),h620Id);
   GlobalVariableSet(H620TicketKey(ticket,"role"),role);
   GlobalVariableSet(H620TicketKey(ticket,"extensions"),0);
   GlobalVariableSet(H620TicketKey(ticket,"bar"),0);
   if(OrderSelect(ticket,SELECT_BY_TICKET) && OrderCloseTime()==0)
   {
      GlobalVariableSet(H620TicketKey(ticket,"initialR"),MathAbs(OrderOpenPrice()-stop));
      h620LastEntry=OrderOpenPrice();
   }
   h620LastEntryTime=TimeCurrent();H620Persist();
   if(gHT6SonicFlowOrderContext && h620FutureGoal==12){WcoWrite(WcoEA(),"burstRemaining",MathMax(0,WcoRead(WcoEA(),"burstRemaining")-1));GlobalVariablesFlush();}
   if(wcoEvaluation>0){WcoAck(wcoEvaluation,6);wcoEvaluation=0;}
   Print("H620 ASSIGN ticket=",ticket," campaign=",DoubleToString(h620Id,0)," role=",role," rail=",h620Rail);
}
bool H620Modify(int ticket,double sl,double tp)
{
   if(!OrderSelect(ticket,SELECT_BY_TICKET) || OrderCloseTime()!=0 || !OurOrder()) return false;
   double price=OrderOpenPrice();bool old=h620Mutation;h620Mutation=true;
   bool ok=HT5CommanderOrderModify(ticket,price,sl,tp,0,clrNONE);
   h620Mutation=old;return ok;
}
void H620TrailAndExtend()
{
   double atr=H620ATR();RefreshRates();
   double gap=MathMax(MarketInfo(Symbol(),MODE_STOPLEVEL),MarketInfo(Symbol(),MODE_FREEZELEVEL))*Point+2*Point;
   int depth=MathMax(1,H620RailPivotDepth),s=depth+1;
   if(iBars(Symbol(),SignalTF)>depth*2+3 && iTime(Symbol(),SignalTF,s)>=h620Started)
   {
      double pivot=h620Dir==DIR_BUY?iLow(Symbol(),SignalTF,s):iHigh(Symbol(),SignalTF,s);
      bool valid=true;
      for(int k=1;k<=depth;k++)
      {
         if(h620Dir==DIR_BUY && (pivot>=iLow(Symbol(),SignalTF,s-k) || pivot>=iLow(Symbol(),SignalTF,s+k))) valid=false;
         if(h620Dir==DIR_SELL && (pivot<=iHigh(Symbol(),SignalTF,s-k) || pivot<=iHigh(Symbol(),SignalTF,s+k))) valid=false;
      }
      double candidate=H620RoundStop(h620Dir,pivot-h620Dir*atr*H620RailBufferATR);
      double quote=h620Dir==DIR_BUY?Bid:Ask;
      if(valid && candidate>0 && h620Dir*(candidate-h620Rail)>Point && h620Dir*(quote-candidate)>gap)
      {h620Rail=candidate;H620Persist();}
   }
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !H620OwnedSelected()) continue;
      int ticket=OrderTicket(),role=H620RoleSelected(),dir=OrderType()==OP_BUY?DIR_BUY:DIR_SELL;
      if(dir!=h620Dir) continue;
      double quote=dir==DIR_BUY?Bid:Ask,sl=OrderStopLoss(),tp=OrderTakeProfit(),op=OrderOpenPrice();
      double candidate=sl,target=tp;
      if(role==0){candidate=h620Rail;target=0;}
      else
      {
         int trailMode=(int)GlobalVariableGet(H620TicketKey(ticket,"trailMode"));
         if(trailMode==1 && h620Rail>0 && (candidate<=0 || dir*(h620Rail-candidate)>0))candidate=h620Rail;
         double initial=GlobalVariableGet(H620TicketKey(ticket,"initialR"));
         if(initial<=Point) initial=MathAbs(op-sl);
         double favorable=dir*(quote-op);
         if(trailMode!=1 && ((DirectUseBreakEven && favorable>=initial*DirectBreakEvenTriggerR) || (trailMode==2 && favorable>atr*H620CostReserveATR+gap)))
         {
            double be=op+dir*MathMax(initial*DirectBreakEvenLockR,atr*H620CostReserveATR);
            if(sl<=0 || dir*(be-candidate)>0) candidate=be;
         }
         if(trailMode!=1 && DirectUseATRTrailingStop && favorable>=atr*DirectTrailStartATR)
         {
            double trail=quote-dir*atr*(role==2?H620RunnerTrailATR:DirectTrailDistanceATR);
            if(candidate<=0 || dir*(trail-candidate)>0) candidate=trail;
         }
         int ext=(int)GlobalVariableGet(H620TicketKey(ticket,"extensions"));
         datetime bar=iTime(Symbol(),SignalTF,1);
         int look=MathMax(2,H620BreakoutLookbackBars);
         int ix=(dir==DIR_BUY?iHighest(Symbol(),SignalTF,MODE_HIGH,look,2):iLowest(Symbol(),SignalTF,MODE_LOW,look,2));
         bool breakout=false;
         if(ix>=0 && iBars(Symbol(),SignalTF)>look+2)
         {
            double edge=dir==DIR_BUY?iHigh(Symbol(),SignalTF,ix):iLow(Symbol(),SignalTF,ix);
            breakout=dir*(iClose(Symbol(),SignalTF,1)-edge)>atr*DirectStructureBreakBufferATR;
         }
         if(role==2 && tp>0 && dir*(tp-quote)>0 && dir*(tp-quote)<=atr*H620ExtensionNearATR &&
            breakout && ext<H620MaximumExtensions && bar>(datetime)GlobalVariableGet(H620TicketKey(ticket,"bar")) &&
            HT6CampaignIntentScore(dir)>=H620RunnerMinimumIntent && !gHT6Flow.continuationDefense)
         {
            double next=tp+dir*atr*H620ExtensionStepATR;
            double obstacle=H620Obstacle(dir,tp);
            if(obstacle>0) next=(dir==DIR_BUY?MathMin(next,obstacle-atr*H620CostReserveATR):MathMax(next,obstacle+atr*H620CostReserveATR));
            if(dir*(next-tp)>atr*.1) target=H620RoundTarget(dir,next);
         }
         if(tp<=0) target=H620RoundTarget(dir,op+dir*initial*MathMax(H620MinimumRoomR,DirectAdaptiveTPMinimumR));
      }
      candidate=H620RoundStop(dir,candidate);
      // Never loosen a broker stop, including after restart/adoption.
      if(sl>0 && dir*(candidate-sl)<0) candidate=sl;
      if(candidate<=0 || dir*(quote-candidate)<=gap) candidate=sl;
      if(target>0 && dir*(target-quote)<=gap) target=tp;
      bool stopChanged=candidate>0 && (sl<=0 || dir*(candidate-sl)>=MathMax(Point,atr*DirectTrailStepATR));
      bool targetChanged=MathAbs(target-tp)>Point*.5;
      if(!stopChanged) candidate=sl;
      if((stopChanged || targetChanged) && H620Modify(ticket,candidate,target))
      {
         if(targetChanged && tp>0 && dir*(target-tp)>0)
         {
            GlobalVariableSet(H620TicketKey(ticket,"extensions"),GlobalVariableGet(H620TicketKey(ticket,"extensions"))+1);
            GlobalVariableSet(H620TicketKey(ticket,"bar"),(double)iTime(Symbol(),SignalTF,1));
         }
      }
   }
}
void H620ResetFlat(string reason)
{
   h620Phase=0;h620Dir=0;h620Flip=0;h620Rail=0;h620Status=reason;
   HT6EndDoubleCampaignState(reason,true);HT6SequenceClear(reason);HT6EinsteinReset(reason);
   gHT6Flow.primaryDirection=DIR_FLAT;H620Persist();
}
bool H620CloseOld()
{
   bool old=h620Mutation;h620Mutation=true;
   bool ok=HT6EinsteinCloseDirection(h620Dir,"H620 RAIL / RISK EXIT");h620Mutation=old;
   if(!ok || TradeCount()>0){h620Status="CLOSE RETRY - NEW ENTRIES LOCKED";return false;}
   H620Ledger();
   HT6EndDoubleCampaignState("H620 OLD EXPOSURE CLOSED",false);
   HT6SequenceClear("H620 RAIL FAILED");HT6EinsteinReset("H620 RAIL FAILED");
   gHT6Flow.primaryDirection=DIR_FLAT;
   if(h620Flip!=0){h620Phase=3;h620Status="RAIL FAILED - WAIT OPPOSITE CLOSE AND DISTANCE";H620Persist();}
   else H620ResetFlat("RISK / FLAT EXIT - WAIT FRESH STRUCTURE");
   return true;
}
bool H620Manage()
{
   if(H620Enabled()) H620Ledger();
   H620FutureTick();
   if(!H620Enabled()) return false;
   if(h620Phase==2){H620CloseOld();return true;}
   if(h620Phase!=1) return false;
   H620Ledger();RefreshRates();
   double quote=h620Dir==DIR_BUY?Bid:Ask;
   bool railFailed=h620Rail>0 && h620Dir*(quote-h620Rail)<=0;
   bool lossFailed=h620Base>0 && h620Realized+h620Floating<=-h620Base*H620MaximumCampaignLossPercent/100.0;
   if(railFailed || lossFailed)
   {
      h620BrokenRail=h620Rail;h620FailureBar=iTime(Symbol(),SignalTF,0);
      h620Flip=(!lossFailed && H620AllowRailFlip?-h620Dir:0);h620Phase=2;H620Persist();H620CloseOld();return true;
   }
   if(TradeCount()==0){H620ResetFlat("FLAT / MANUAL EXIT - NO AUTOMATIC FLIP");return true;}
   if(HT6StructureHoldCount(h620Dir)<=0)
   {
      // A broker or manual close may remove the last core between ticks.
      // Do not leave orphan add-ons carrying an imaginary campaign hold.
      h620Flip=0;h620Phase=2;H620Persist();H620CloseOld();return true;
   }
   H620TrailAndExtend();return false;
}
bool H620TryFlip()
{
   if(h620Phase!=3) return false;
   int shift=iBarShift(Symbol(),SignalTF,h620FailureBar,false);
   if(shift>H620FlipExpiryBars){H620ResetFlat("FLIP EXPIRED - WAIT FRESH STRUCTURE");return true;}
   if(h620FuturePaused || h620Quarantine || gWisdoPaused || gWisdoEmergencyLatched || !AllowNewEntries || TradeCount()>0) return true;
   int need=MathMax(1,H620FlipConfirmBars),dir=h620Flip;
   if(shift<need || dir==0) return true;
   double atr=H620ATR();
   for(int s=1;s<=need;s++)
      if(iTime(Symbol(),SignalTF,s)<h620FailureBar || dir*(iClose(Symbol(),SignalTF,s)-h620BrokenRail)<=atr*DirectStructureBreakBufferATR) return true;
   RefreshRates();double price=dir==DIR_BUY?Ask:Bid;
   if(MathAbs(price-h620BrokenRail)>atr*H620MaximumEntryStretchATR) return true;
   gHT6Flow.boxReady=true;gHT6Flow.primaryDirection=dir;gHT6Flow.leg=1;
   gHT6Flow.lowerRail=iLow(Symbol(),SignalTF,1);gHT6Flow.upperRail=iHigh(Symbol(),SignalTF,1);
   gHT6Flow.lastBreakDirection=dir;gHT6Flow.lastBreakBar=iTime(Symbol(),SignalTF,1);
   gHT6Flow.structureEntryPending=true;gHT6Flow.pendingStructureDirection=dir;gHT6Flow.pendingStructureLeg=1;
   gHT6Flow.pendingStructureStop=HT6DirectInitialStopPrice(dir,price);
   h620FlipContext=true;bool opened=HT6EinsteinOpenStructureHold(dir);h620FlipContext=false;
   if(!opened){gHT6Flow.structureEntryPending=false;gHT6Flow.primaryDirection=DIR_FLAT;}
   return true;
}
int H620Initialize()
{
   if(!H620Enabled()) return INIT_SUCCEEDED;
   if(H620GrowthMilestonePercent<=0 || H620MaximumCampaignLossPercent<=0 || H620MaximumCampaignLossPercent>100 ||
      H620MinimumRoomR<=0 || H620MaximumEntryStretchATR<=0 || H620MaximumSpreadATR<=0 || H620CostReserveATR<0 ||
      H620EntrySpacingSeconds<0 || H620EntrySpacingATR<0 || H620RailPivotDepth<1 || H620RailPivotDepth>10 ||
      H620RailBufferATR<0 || H620ObstacleLookbackBars<10 || H620ObstacleLookbackBars>500 ||
      H620RunnerEveryNthAdd<0 || H620MaximumExtensions<0 || H620ExtensionStepATR<=0 || H620ExtensionNearATR<=0 ||
      H620RunnerTrailATR<=0 || H620RunnerMinimumIntent<0 || H620RunnerMinimumIntent>1 ||
      H620FlipConfirmBars<1 || H620FlipExpiryBars<H620FlipConfirmBars || H620BreakoutLookbackBars<2 ||
      DirectRiskPercentEveryTrade<=0 || DirectMaximumOpenRiskPercent<=0 || DirectMaximumOpenRiskPercent>100 ||
      DirectMaximumSingleTradeRiskPercent<=0 || DirectTrailStepATR<0 || DirectTrailDistanceATR<=0)
   {Print("H620 INVALID INPUT PARAMETERS");return INIT_PARAMETERS_INCORRECT;}
   h620Phase=(int)H620Get("phase");h620Dir=(int)H620Get("dir");h620Flip=(int)H620Get("flip");
   h620Id=H620Get("id");h620Base=H620Get("base");h620Rail=H620Get("rail");h620BrokenRail=H620Get("broken");
   h620Started=(datetime)H620Get("started");h620FailureBar=(datetime)H620Get("failure");
   h620AddSerial=(int)H620Get("serial");h620Peak=H620Get("peak");h620BankedLevel=H620Get("banked");
   h620LastEntry=H620Get("lastentry");h620LastEntryTime=(datetime)H620Get("lasttime");
   if(TradeCount()==0 && h620Phase==1) H620ResetFlat("RESTORED FLAT - WAIT FRESH STRUCTURE");
   // Avoid guessing roles or campaign ownership of an already-running older EA.
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !OurOrder()) continue;
      if(!H620OwnedSelected() || !H620CampaignTicketSelected() || h620Id<=0 || (h620Phase!=1 && h620Phase!=2) ||
         OrderStopLoss()<=0 || h620Rail<=0 || (OrderType()==OP_BUY?DIR_BUY:DIR_SELL)!=h620Dir)
      {h620Quarantine=true;h620Phase=0;h620Dir=0;h620Flip=0;h620Status="LEGACY LIVE TICKETS DETECTED • H620 WAITING FOR A FLAT ACCOUNT";H620Persist();Print("H620 quarantine: legacy/untracked live tickets detected; EA remains loaded and will not adopt them.");}
   }
   if(h620Phase==1) gHT6Flow.primaryDirection=h620Dir;
   WcoRestoreGoal();
   H620Ledger();return INIT_SUCCEEDED;
}


int OnInit()
{
   // v6.20 validates persistent ticket identity after legacy sensor initialization.
   HT5ApplyDropdownPhysiologyPre();
   ApplyUnityUserControls();
   ApplyAllControls();
   HT5ApplyDropdownPhysiologyFinal();
   CompoundLoad();
   WillLoad();
   MarketDNALoad();
   EvolutionLoad();
   // v6.10 FINAL INPUT AUTHORITY — hidden legacy defaults cannot replace visible live inputs.
   HT6ApplyDirectExecutionInputs();
   MarketDNARevertV311LegacyPending();
   MarketDNARebuildLimitPlanFromLive();
   gMDRhythmExpectedBurstSeconds=MathMax(2.0,(gMDRhythmExpectedBurstSeconds>0.0?gMDRhythmExpectedBurstSeconds:MarketDNARhythmDefaultBurstSeconds));
   gMDRhythmLastCompoundCycle=gCompoundCycle;
   gUnityStationPartialPercent=MathMax(1.0,MathMin(99.0,StationPartialPercent));
   gUnityGainTargetPercent=MathMax(0.01,CampaignGainTargetPercent);
   ApplyBlackGoldChartTheme();
   HTUpdateLiveATR();
   InitializeGuardianEvolution();
   HT5CreatureAwaken();
   HT6SequenceClear("EA INIT / FRESH HUNT");
   HT6EinsteinReset("EA INIT");
   HT6RestoreDoubleCampaignState();
   int h620Init=H620Initialize();
   if(h620Init!=INIT_SUCCEEDED) return h620Init;
   Print("HT6 DIRECT INPUTS | risk=",DoubleToString(DirectRiskPercentEveryTrade,2),"%",
         " | compoundEveryTrade=",DirectCompoundEveryTradeFromCurrentAccount,
         " | stopMode=",IntegerToString((int)DirectStopLossMode),
         " | ATR=",IntegerToString(DirectATRStopPeriod)," x ",DoubleToString(DirectATRStopMultiplier,2),
         " | minStopPts=",DoubleToString(DirectMinimumStopDistancePoints,1),
         " | TP every trade=",DirectEveryTradeHasTakeProfit,
         " | TP mode=",IntegerToString((int)DirectTakeProfitMode),
         " | compoundTP%=",DoubleToString(DirectCompoundTargetPercentPerTrade,2),
         " | trail=",DirectUseATRTrailingStop,
         " | trail=",DoubleToString(DirectTrailStartATR,2),"/",DoubleToString(DirectTrailDistanceATR,2),"/",DoubleToString(DirectTrailStepATR,2)," ATR",
         " | sonic=",IntegerToString(DirectSonicNodesBetweenCores)," @ ",DoubleToString(DirectSonicNodeSpacingR,2),"R");
   if(HT6EinsteinEnabled()) MarketDNADeletePendingLimits("EINSTEIN FLOW BOOT • LEGACY SIGNAL PENDING ORDERS REMOVED");
   HT5ClearThesisCapsule(gHT5LiveThesis,"EA INIT");
   HT5ClearThesisCapsule(gHT5CampaignThesis,"EA INIT");
   EventSetTimer(1);
   gDirection=DetectDirection();
   ResetMovementTP();
   ResetEntryMovement();
   ResetArrowDirectionConfirmation();
   ResetReversalExitConfirmation();
   SovResetGravity();
   PyrUpdateSwingMap();
   gMDChannelLastMapBar=0; gMDChannelLastEvalSerial=-1;
   MarketDNAChannelBootstrap(true);
   if(!EnableMarketDNAHistoricalChannels) MarketDNAOracleUpdateContext(MathMax(Point,HTExecutionATR(SignalTF,14)));
   MarketDNADayHLRebuild(); MarketDNADayHLUpdate(); if(!HT6EinsteinEnabled()) MarketDNADrawDayHL();
   MarketDNASignalFVGReset("EA INIT"); if(!HT6EinsteinEnabled()) MarketDNADrawSignalFVG(); MarketDNARLadderReset("EA INIT");
   if(!HT6EinsteinEnabled()) MarketDNADrawHistoricalChannels();
   PyrSeedTrendFromStructure();
   if(TradeCount()>0)
   {
      int initDir=(int)DetectDirection();
      if(initDir!=DIR_FLAT)
      {
         double initAtr=MathMax(Point,HTExecutionATR(SignalTF,14));
         double initBuffer=initAtr*MathMax(0.01,PyramidInvalidationATRBuffer);
         double initInvalid=(initDir==DIR_BUY ? gPyrLow1-initBuffer : gPyrHigh1+initBuffer);
         PyrStartOrContinueRoute(initDir,initInvalid,"EA ATTACH / LIVE ORDER RESTORE");
      }
   }
   gEntryStatus=(!IsMasterEnabled()?"MASTER DISABLED":
                 ((!HT6EinsteinEnabled() && MarketDNARequireChannelReadyBeforeTrading && EnableMarketDNAHistoricalChannels && !gMDChannelReady)?
                  "CHANNEL INITIALIZING - TRADING LOCKED":"SEARCHING STRUCTURE FLOW"));
   // v6.03 compile fix: MQL4 Print() accepts at most 64 parameters.
   // The original startup audit message had 66, so it is intentionally split in two.
   Print("HIGHTOWER UNITY EINSTEIN SONIC FLOW v6.10 REWIRED loaded | ONE CAMPAIGN + MOVE/PAUSE SEQUENCE + PHASE 0-5 + SIGNAL-FVG LOCATION + RHYTHM TIMING + SONIC EARNED GROWTH + PHASE DEFENSE/HARVEST + ONE COMMANDER | pyramid=",UsePyramidDLSauce,
         " | selectedRiskPercent=",DoubleToString(RiskPerEntryPercent,2),
         " riskMoney=",DoubleToString(SelectedRiskMoney(),2),
         " startTrading=",StartTradingTimeText(),
         " brokerNow=",BrokerClockText(),
         " TP=",DoubleToString(TakeProfitSLRatioValue,1),"R",
         " ichimoku=",IntegerToString((int)IchimokuTrendFilter),
         " arrowMode=",ArrowEntryModeText(),
         " arrowSlopeFilter=",ArrowSlopeText(),
         " arrowConfirmation=",ArrowConfirmationText(),
         " reversalExit=",ArrowReversalExitText(),
         " arithmeticSpacing=",ArithmeticSpacingText(),
         " marginSafety=",MarginSafetyText(),
         " maxGridEntries=",IntegerToString(SafeMaximumEntries),
         " oxRisk=",DoubleToString(SovereignOxRiskPercent(),2),"%",
         " sovereignCloseMode=",IntegerToString((int)SovereignCloseMode));
   Print("HT6 STARTUP CONTINUED | gravity=",IntegerToString((int)GravityTrailControl),
         " campaignRiskCap=",DoubleToString(MaximumCampaignRiskPercent,0),"%",
         " stopAfterAddonSL=",StopGridAfterFirstAddonSL,
         " projectedMarginFloor=",DoubleToString(MinimumProjectedMarginLevel,0),"%",
         " SLmethod=",StopMethodText(),
         " ATR=",ATRStopText(),
         " liveATRpts=",DoubleToString(gATRLive14/Point,1),
         " stableATRpts=",DoubleToString(gATRStable14/Point,1),
         " SLlookback=",IntegerToString(StopLossLookbackBars),
         " hold=",HoldPolicyText(),
         " cloudBars=",IntegerToString(IchimokuCloudHistoryBars),
         " TF=",IntegerToString((int)SignalTF),
         " maxTrades=",IntegerToString(MaximumOpenTrades),
         " sequenceDirect=",gHT6DirectSequenceExecution,
         " wisdoVoice=",EnableWisdoVoiceControl,
         " doubleTarget=",DoubleToString(DirectCampaignGrowthTargetPercent,0),"%",
         " maxSingleRisk=",DoubleToString(DirectMaximumSingleTradeRiskPercent,2),"%",
         " addIntent=",DoubleToString(DirectMinimumIntentToAdd,2));
   if(EnableWisdoVoiceControl)
   { gWisdoLastAction="VOICE BRIDGE ONLINE"; WisdoPublishState(); }
   if(HT6EinsteinEnabled()){ HT6EinsteinMinimalVisualCleanup(); HT6EinsteinDrawBox(); }
   DrawProfessionalDashboard();
   if(!HT6EinsteinEnabled()) DrawGlobalClockAndCandleTimer();
   ChartRedraw(0);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   HT5CreatureSleep();
   CompoundSave();
   WillSave();
   MarketDNASave();
   EvolutionSave();
   if(EnableWisdoVoiceControl) WisdoWrite("WISDO_EA_ONLINE",0.0);
   EventKillTimer();
   DeleteObjects();
}

void OnTimer()
{
   HT5CreatureTimerPulse();
   if(EnableMarketDNAHistoricalChannels && (!gMDChannelReady || gMDChannelLastMapBar!=iTime(Symbol(),SignalTF,0)))
   {
      gMDChannelLastEvalSerial=-1;
      MarketDNAChannelBootstrap(!gMDChannelReady);
   }
   MarketDNADayHLUpdate();
   ApplyDynamicMoodBackground();
   if(HT6EinsteinEnabled())
   {
      HT6EinsteinMinimalVisualCleanup();
      HT6EinsteinDrawBox();
      if(ShowDashboard){ gUIFrame++; DrawProfessionalDashboard(); }
      ChartRedraw(0);
      return;
   }
   MarketDNADrawHistoricalChannels(); MarketDNADrawDayHL(); MarketDNADrawSignalFVG();
   if(ShowDashboard && (AnimateGuardian || AnimateEVACore || AnimateSURFWave))
   {
      gUIFrame++;
      DrawProfessionalDashboard();
   }
   DrawGlobalClockAndCandleTimer();
   ChartRedraw(0);
}

void OnTick()
{
   // v6.10 refresh visible live inputs as final execution authority.
   HT6ApplyDirectExecutionInputs();
   WisdoPollAndApply();
   gMDEntryTickSerial++;
   HTUpdateLiveATR();
   if(H620Manage()) { gPreviousOpenTradeCount=TradeCount(); return; }
   MarketDNARhythmCaptureTick();
   HT5CreatureSenseBeforeLegacyDecision();
   MarketDNADayHLUpdate(); if(!HT6EinsteinEnabled()) MarketDNADrawDayHL();
   MarketDNASignalFVGUpdate(); if(!HT6EinsteinEnabled()) MarketDNADrawSignalFVG();
   HT5TelemetryTick();
   if(EnableMarketDNAHistoricalChannels)
   {
      MarketDNAUpdateHistoricalChannels();
      if(!HT6EinsteinEnabled() && MarketDNARequireChannelReadyBeforeTrading && !gMDChannelReady)
      {
         gEntryStatus="CHANNEL INITIALIZING - TRADING LOCKED";
         MarketDNADrawHistoricalChannels();
         DrawProfessionalDashboard();
         return;
      }
   }
   WillTrackLiveCampaign();
   if(EnableSelfEvolvingGenome && gEvoCampaignActive && TradeCount()==0) EvolutionResolveCampaign();
   if(WillManageEnergyDrain())
   { DrawProfessionalDashboard(); gPreviousOpenTradeCount=TradeCount(); return; }
   if(!HT6EinsteinEnabled() && ManageCompoundStaircase())
   {
      ApplyDynamicMoodBackground();
      MarketDNAUpdateHistoricalChannels();
      DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
      gPreviousOpenTradeCount=TradeCount();
      return;
   }
   ApplyDynamicMoodBackground();
   MarketDNAUpdateHistoricalChannels();
   int openAtTickStart=TradeCount();
   if(openAtTickStart>0) EvolutionTrackCampaign();
   if(!HT6EinsteinEnabled() && openAtTickStart==0 && gPreviousOpenTradeCount>0)
   {
      // A profitable flat transition is a decision point, not automatic
      // permission to refill the direction that just collected.
      int completedDir=(gPyrCampaignDirection!=DIR_FLAT ? gPyrCampaignDirection : gPyrRouteDirection);
      double closePrice=0.0,closeNet=0.0;
      double completedPeak=gPyrBestPrice;
      bool hasClose=PyrLatestCloseInfo(completedDir,closePrice,closeNet);
      bool campaignWon=(gPyrCampaignStartBalance>0.0 &&
                        AccountBalance()>gPyrCampaignStartBalance+0.01);
      EvolutionResolveCampaign();
      if(hasClose && (closeNet>0.0 || campaignWon) && completedDir!=DIR_FLAT)
      {
         PyrStartOrContinueRoute(completedDir,gPyrRouteInvalidation,"PROFITABLE PEAK TRANSITION");
         PyrRecordRouteStation(completedDir,closePrice,TimeCurrent(),"PROFITABLE COLLECTION STATION");
         PyrBeginPeakObservation(completedDir,closePrice,completedPeak,"BROKER SL/TRAIL PEAK COLLECTION");
      }
      PyrResetTicketCampaignPreserveRoute();
      HT5ClearThesisCapsule(gHT5CampaignThesis,"CAMPAIGN FLAT");
      HT5ClearThesisCapsule(gHT5LiveThesis,"CAMPAIGN FLAT");
      MarketDNARLadderReset("CAMPAIGN FLAT");
      MarketDNASignalFVGReset("CAMPAIGN FLAT");
      HT6SequenceClear("CAMPAIGN CLOSED / RE-HUNT");
      ResetArrowCampaignGrid();
      gLastArrowDirection=DIR_FLAT;
   }

   gDirection=DetectDirection();

   bool structureReady=UpdateStructure();
   if(structureReady)
   {
      CalculateGeometry();
      UpdateArrowDirectionConfirmation();
      RefreshArrowCampaignHistoryState();
      UpdateMode();
      UpdateCampaignState();
   }
   else
   {
      gMode=GEO_INVALID;
      ResetArrowDirectionConfirmation();
   }

   // DL Sauce is a single-authority state machine. Legacy Arrow, Gravity,
   // movement TP, peak giveback and partial Sovereign releases do not compete
   // with Pyramid entries or exits while this engine is enabled.
   if(UsePyramidDLSauce)
   {
      bool pyramidReady=PyrUpdateSwingMap();
      int failedTurn=DIR_FLAT,gripTurn=DIR_FLAT,flipTurn=DIR_FLAT,bosTurn=DIR_FLAT;
      int retestTurn=DIR_FLAT,stationTurn=DIR_FLAT,reclaimTurn=DIR_FLAT;
      int routeStationTurn=DIR_FLAT,transitionTurn=DIR_FLAT,channelBounceTurn=DIR_FLAT,channelBreakTurn=DIR_FLAT;
      int triggerBounceTurn=DIR_FLAT,triggerBreakTurn=DIR_FLAT,confirmedTurn=DIR_FLAT;
      if(pyramidReady)
      {
         MarketDNAUpdateHistoricalChannels();
         PyrSeedTrendFromStructure();

         bool routeWasActive=gPyrRouteActive;
         int routeBefore=gPyrRouteDirection;
         bool routeValid=PyrUpdateRouteValidity();

         flipTurn=PyrUpdateConfirmedTrendFlip();

         // A pullback cannot reverse a surviving route. If a temporary opposite
         // flip appears before the supporting HL/LH is actually lost, restore route authority.
         if(routeWasActive && routeValid && flipTurn!=DIR_FLAT && flipTurn!=routeBefore)
         {
            gPyrTrendDirection=routeBefore;
            flipTurn=DIR_FLAT;
            gPyrState=(routeBefore==DIR_BUY ?
                       "BUY ROUTE ALIVE - SELL PULLBACK BLOCKED; WAIT HL LOSS" :
                       "SELL ROUTE ALIVE - BUY PULLBACK BLOCKED; WAIT LH BREAK");
         }

         triggerBreakTurn=MarketDNATriggerRailBreakGate();
         triggerBounceTurn=MarketDNATriggerRailBounceGate();
         channelBreakTurn=MarketDNAHistoricalChannelBreakGate();
         channelBounceTurn=MarketDNAHistoricalChannelBounceGate();
         if(flipTurn==DIR_FLAT) bosTurn=PyrUpdateBOSContinuationGate();
         failedTurn=PyrUpdateFailedExtremeGate();
         gripTurn=PyrUpdateGrip();

         // Opposite wick is information only. In-route wick continuation may assist,
         // but it no longer owns station/reclaim authority.
         int wickPermission=(failedTurn!=DIR_FLAT && gripTurn==failedTurn &&
                             failedTurn==gPyrTrendDirection ? failedTurn : DIR_FLAT);

         routeStationTurn=PyrUpdateRouteStationAcceleratorGate();
         if(gPyrRetestReady) retestTurn=PyrUpdateDirectionalRetestGate();
         stationTurn=PyrUpdateILTrainStationGate();
         reclaimTurn=PyrUpdateAllTargetReclaimGate();
         transitionTurn=(HT6EinsteinEnabled()?DIR_FLAT:PyrUpdatePeakTransitionGate());

         // v5.02: capture EVERY structural source into the universal setup ledger.
         // Direct break and pullback variants are separate learnable identities.
         HT5SenseNamedSetupLibrary(bosTurn,channelBreakTurn,failedTurn);
         HT5CaptureExistingNamedEvents(flipTurn,retestTurn,stationTurn,reclaimTurn,
                                       routeStationTurn,transitionTurn,channelBounceTurn,
                                       triggerBounceTurn,triggerBreakTurn);

         // TRUE authority hierarchy:
         // post-peak transition > confirmed structural flip > live BOS > persistent-route accelerator
         // > profit-station retest > IL station > reclaim > aligned wick.
         if(transitionTurn!=DIR_FLAT)
         {
            confirmedTurn=transitionTurn;
            gPyrSignalSource=PYR_SOURCE_CONFIRMED_TREND_FLIP;
            gPyrRetestReady=false;
         }
         else if(gPyrPeakObservationActive)
         {
            // Neutral means neutral: no BOS, station, reclaim or burst may reload
            // the collected direction while the transition is unresolved.
            confirmedTurn=DIR_FLAT;
            gPyrSignalSource=PYR_SOURCE_NONE;
            gPyrBurstDirection=DIR_FLAT;
            gPyrBurstSource=PYR_SOURCE_NONE;
            gPyrBurstExpires=0;
            gPyrState=gPyrTransitionState;
         }
         else if(triggerBreakTurn!=DIR_FLAT)
         {
            confirmedTurn=triggerBreakTurn;
            gPyrSignalSource=PYR_SOURCE_TRIGGER_RAIL_BREAK;
            gPyrTrendDirection=triggerBreakTurn;
            gPyrActiveSignalIdentity=TimeCurrent();
            gPyrRetestReady=false;
         }
         else if(triggerBounceTurn!=DIR_FLAT)
         {
            confirmedTurn=triggerBounceTurn;
            gPyrSignalSource=PYR_SOURCE_TRIGGER_RAIL_BOUNCE;
            gPyrTrendDirection=triggerBounceTurn;
            gPyrActiveSignalIdentity=TimeCurrent();
            gPyrRetestReady=false;
         }
         else if(channelBreakTurn!=DIR_FLAT)
         {
            confirmedTurn=channelBreakTurn;
            gPyrSignalSource=PYR_SOURCE_CHANNEL_BREAK;
            gPyrTrendDirection=channelBreakTurn;
            gPyrActiveSignalIdentity=gMDChannelBreakIdentity;
            gPyrRetestReady=false;
         }
         else if(channelBounceTurn!=DIR_FLAT)
         {
            confirmedTurn=channelBounceTurn;
            gPyrSignalSource=PYR_SOURCE_CHANNEL_BOUNCE;
            gPyrActiveSignalIdentity=iTime(Symbol(),SignalTF,0);
         }
         else if(flipTurn!=DIR_FLAT)
         {
            confirmedTurn=flipTurn;
            gPyrSignalSource=PYR_SOURCE_CONFIRMED_TREND_FLIP;
            gPyrRetestReady=false;
         }
         else if(bosTurn!=DIR_FLAT)
         {
            confirmedTurn=bosTurn;
            gPyrSignalSource=PYR_SOURCE_BOS_CONTINUATION;
         }
         else if(routeStationTurn!=DIR_FLAT)
         {
            confirmedTurn=routeStationTurn;
            gPyrSignalSource=PYR_SOURCE_ROUTE_ACCELERATOR;
         }
         else if(retestTurn!=DIR_FLAT)
         {
            confirmedTurn=retestTurn;
            gPyrSignalSource=PYR_SOURCE_DIRECTIONAL_RETEST;
         }
         else if(stationTurn!=DIR_FLAT)
         {
            confirmedTurn=stationTurn;
            gPyrSignalSource=PYR_SOURCE_TRAIN_STATION;
         }
         else if(reclaimTurn!=DIR_FLAT)
         {
            confirmedTurn=reclaimTurn;
            gPyrSignalSource=PYR_SOURCE_RECLAIM_AREA;
         }
         else if(wickPermission!=DIR_FLAT)
         {
            confirmedTurn=wickPermission;
            gPyrSignalSource=PYR_SOURCE_FAILED_EXTREME;
         }
         else
         {
            confirmedTurn=DIR_FLAT;
            gPyrSignalSource=PYR_SOURCE_NONE;
         }

         // Persistent route blocks counter-route entries until actual derailment.
         if(!gPyrPeakObservationActive && gPyrRouteActive && confirmedTurn!=DIR_FLAT &&
            confirmedTurn!=gPyrRouteDirection &&
            !(gPyrSignalSource==PYR_SOURCE_CHANNEL_BREAK && gMDChannelBreakDirection==confirmedTurn) &&
            gPyrSignalSource!=PYR_SOURCE_TRIGGER_RAIL_BREAK &&
            gPyrSignalSource!=PYR_SOURCE_TRIGGER_RAIL_BOUNCE)
         {
            gPyrState=(gPyrRouteDirection==DIR_BUY ?
                       "PULLBACK INSIDE BUY ROUTE - SELL ENTRY BLOCKED" :
                       "PULLBACK INSIDE SELL ROUTE - BUY ENTRY BLOCKED");
            confirmedTurn=DIR_FLAT;
            gPyrSignalSource=PYR_SOURCE_NONE;
         }
      }

       // MARKET DNA covenant: every feature is a strand; no single strand owns permission.
       // The unified equation converts all strands into desired exposure Q*.
       int arrowPermission=gConfirmedArrowDirection;
       int unityTrigger=DIR_FLAT;
       if(EnableMarketDNA)
       {
          if(confirmedTurn!=DIR_FLAT && gPyrSignalSource!=PYR_SOURCE_NONE) MarketDNASignalFVGArm(confirmedTurn,gPyrSignalSource);
          MarketDNASignalFVGUpdate();
          MarketDNAUpdate(confirmedTurn);

          // v6.08 EINSTEIN FLOW AUTHORITY:
          // all legacy sources have already been sensed above. They are evidence
          // only. Structure-box FLOW owns the primary trade and structure direction.
          if(HT6EinsteinEnabled())
          {
             HT6EinsteinFlowSense();

             // Re-run context-sensitive detectors after Market DNA is current,
             // then translate NEW detector events into continuation points.
             HT5DetectUNSetups();
             HT5DetectMotivV3();
             HT5DetectCCGrow();
             HT5DetectKingdomSetups();
             HT6EinsteinCaptureNamedPoints();

             // Flow itself lays dense SONIC nodes between one CORE and the next.
             // Named sources remain point sponsors and can still fund a separate
             // evidence add; neither path may seed or flip structure.
             HT6EinsteinRunSonicIntentBurst();
             HT6EinsteinOpenContinuationAdd();
             HT6EinsteinSyncSequence();
             HT6EinsteinManageOrders();
             HT6AuditPulse();

             DrawObjects();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }

          HT6SequenceSense();
          HT6DoctrineManageOpenCampaign();

          // Sequence is the primary execution spine. Try a valid phase directly
          // before the legacy Q*/setup routing maze gets another opportunity to veto it.
          if(HT6DirectSequenceExecutionAttempt())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             DrawProfessionalDashboard();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }
          HT5UpdateTrainDirection();
          HT5PrunePendingAgainstTrain();

          // Re-run named pattern detectors after Market DNA/Oracle/Channel values are
          // current for this tick, then allow the best setup + independent witness
          // to seed directly. NO SPINE is not a deadlock when another independent
          // organ confirms a named setup.
          HT5DetectUNSetups(); HT5DetectMotivV3(); HT5DetectCCGrow(); HT5DetectKingdomSetups();
          if(HT5ExecuteBestSetupEntry())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             DrawProfessionalDashboard();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }

          // v3.16 MASTER-SIGNAL FALLBACK: a proven Directional Spine is itself a
          // directional signal. If no discrete BOS/station/rail event armed an FVG,
          // create a queue from the master direction instead of deadlocking forever.
          if(!gHT6DoctrineOwnsEntry && MarketDNASignalFVGOnly && MarketDNASignalFVGQueueAuthority && !gMDFVGArmed &&
             gMDDesiredDirection!=DIR_FLAT &&
             (!EnableMarketDNADirectionalSpine || gMDDirectionalDirection==gMDDesiredDirection))
          {
             MarketDNASignalFVGArm(gMDDesiredDirection,PYR_SOURCE_RHYTHM_ACCELERATOR);
             MarketDNASignalFVGUpdate();
          }
          // v3.17 HARD ENTRY RECOVERY: a queued FVG retest has already earned
          // location authority. Seed it directly before the soft master exposure
          // gates can cool to zero during the retracement. Central order/risk/margin
          // protections remain inside PyrTryEntry/SendOrder.
          int hardQueuedDir=MarketDNASignalFVGQueuedDirection();
          if(hardQueuedDir!=DIR_FLAT && MarketDNAExecuteQueuedFVGSeedDirect(hardQueuedDir))
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             DrawProfessionalDashboard();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }

          if(TradeCount()>0 && MarketDNATriggerRailTransferIfRequired())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }
          if(TradeCount()>0 && MarketDNAChannelBounceTransferIfRequired())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }
          if(TradeCount()>0 && MarketDNATransferExposureIfRequired())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }
          int queuedFVGDir=MarketDNASignalFVGQueuedDirection();
          int sequenceDir=(gHT6Seq.active && gHT6Seq.phase>=SEQ_PHASE_ATTACK && gHT6Seq.phase<=SEQ_PHASE_ACCELERATE ? gHT6Seq.direction : DIR_FLAT);
          if(gHT6DoctrineOwnsEntry && sequenceDir!=DIR_FLAT && queuedFVGDir!=DIR_FLAT && queuedFVGDir!=sequenceDir)
          {
             MarketDNASignalFVGReset("STALE FVG OPPOSES ACTIVE SEQUENCE");
             queuedFVGDir=DIR_FLAT;
          }
          int executionDir=(gHT6DoctrineOwnsEntry && sequenceDir!=DIR_FLAT ? sequenceDir :
                            (queuedFVGDir!=DIR_FLAT?queuedFVGDir:gMDDesiredDirection));
          bool queuedFVGAuthority=(queuedFVGDir!=DIR_FLAT && executionDir==queuedFVGDir);

          if(executionDir!=DIR_FLAT)
          {
             if(gMDInflectionTransferReady && !queuedFVGAuthority)
             {
                gPyrSignalSource=PYR_SOURCE_INFLECTION_TRANSFER;
                gPyrTrendDirection=executionDir;
                gPyrActiveSignalIdentity=TimeCurrent();
             }

             if(queuedFVGAuthority)
             {
                gPyrSignalSource=gMDFVGSource;
                gPyrActiveSignalIdentity=gMDFVGSignalTime;
                gPyrState=(executionDir==DIR_BUY?"QUEUED BUY FVG TOUCHED -> SEED":"QUEUED SELL FVG TOUCHED -> SEED");
             }

             bool directionOwned=(queuedFVGAuthority ||
                                  !EnableMarketDNADirectionalSpine ||
                                  gMDDirectionalDirection==executionDir ||
                                  gMDInflectionTransferReady ||
                                  gMDTransferHandoffDirection==executionDir);
             bool sequenceLaunch=(gHT6Seq.active && gHT6Seq.direction==executionDir &&
                                  gHT6Seq.phase>=SEQ_PHASE_ATTACK && gHT6Seq.phase<=SEQ_PHASE_ACCELERATE &&
                                  gHT6Seq.rhythmScore>=0.36);
             if(!directionOwned && !sequenceLaunch)
                gPyrState="MARKET DNA WAIT: DIRECTIONAL SPINE NOT OWNED | "+gMDDirectionalState;
             else if(!queuedFVGAuthority && !sequenceLaunch && !MarketDNADirectionalLaunchReady(executionDir,confirmedTurn))
                gPyrState="MARKET DNA WAIT: SPINE "+gMDDirectionalState+" | RHYTHM "+gMDRhythmState;
             else if(MarketDNACanDeploy(executionDir))
             {
                if(gPyrSignalSource==PYR_SOURCE_NONE && MarketDNASignalFVGOnly && gMDFVGArmed && gMDFVGReady && gMDFVGInZone && gMDFVGDirection==executionDir)
                { gPyrSignalSource=gMDFVGSource; gPyrActiveSignalIdentity=gMDFVGSignalTime; }
                if(gPyrSignalSource==PYR_SOURCE_NONE && MarketDNARhythmLaunchReady(executionDir))
                {
                   gPyrSignalSource=PYR_SOURCE_RHYTHM_ACCELERATOR;
                   gPyrActiveSignalIdentity=TimeCurrent();
                }
                unityTrigger=executionDir;
             }
             else
                gPyrState="MARKET DNA WAIT: "+gMDDeployBlockReason+" | "+gMDReason;
          }
          MarketDNAPrunePendingToDesired();
          if(TradeCount()>0 && MarketDNAHarvestTowardDesired())
          {
             DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }
       }
       else
       {
          if(HT6EinsteinEnabled())
          {
             HT6EinsteinFlowSense();
             HT6EinsteinCaptureNamedPoints();
             HT6EinsteinOpenSonicFlowAdd();
             HT6EinsteinOpenContinuationAdd();
             HT6EinsteinSyncSequence();
             HT6EinsteinManageOrders();
             HT6AuditPulse();
             DrawObjects();
             PyrDrawStructure();
             PyrPaintSwingHistory();
             DrawProfessionalDashboard();
             gPreviousOpenTradeCount=TradeCount();
             return;
          }

          if(confirmedTurn!=DIR_FLAT)
          {
             if(arrowPermission==confirmedTurn) unityTrigger=confirmedTurn;
             else gPyrState="STATION/STRUCTURE READY - WAIT MATCHING ARROW PERMISSION";
          }
          else
          {
             int routeDir=(gPyrRouteActive ? gPyrRouteDirection : (int)DetectDirection());
             if(!gPyrPeakObservationActive && routeDir!=DIR_FLAT && arrowPermission==routeDir &&
                gPyrInvalidTicks==0 && PyrHotWheelBurstAllows(routeDir))
             { gPyrSignalSource=gPyrBurstSource; unityTrigger=routeDir; }
          }
       }

       if(TradeCount()>0) HT5ManageTrendStopBreathing();
       if(TradeCount()>0) PyrManageCampaign(confirmedTurn);
       if(unityTrigger!=DIR_FLAT)
       {
          PyrSignalSource attemptedSource=gPyrSignalSource;
          bool stationOrderOpened=(EnableMarketDNA?MarketDNAExecuteBurst(unityTrigger):PyrTryEntry(unityTrigger));
          if(stationOrderOpened && attemptedSource==PYR_SOURCE_TRAIN_STATION)
          {
             if(unityTrigger==DIR_BUY) gPyrBuyStationReady=false;
             else gPyrSellStationReady=false;
             gPyrState=(unityTrigger==DIR_BUY ?
                        "IL BUY STATION FILLED - MASTER BURST ARMED" :
                        "IL SELL STATION FILLED - MASTER BURST ARMED");
          }
          if(stationOrderOpened && attemptedSource==PYR_SOURCE_RECLAIM_AREA &&
             gPyrActiveReclaimIndex>=0 && gPyrActiveReclaimIndex<4)
          {
             if(unityTrigger==DIR_BUY) gPyrReclaimBuyReady[gPyrActiveReclaimIndex]=false;
             else gPyrReclaimSellReady[gPyrActiveReclaimIndex]=false;
             gPyrState=(unityTrigger==DIR_BUY ? "BUY RECLAIM FILLED: " : "SELL RECLAIM FILLED: ")+
                       gPyrActiveReclaimName+" - MARKET DNA STACK ACTIVE";
          }
       }
       if(EnableMarketDNA && MarketDNARLadderManage())
       {
          DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
          gPreviousOpenTradeCount=TradeCount();
          return;
       }
       if(EnableMarketDNA && MarketDNAManageSonicPlugBurst())
       {
          DrawObjects(); PyrDrawStructure(); PyrPaintSwingHistory();
          gPreviousOpenTradeCount=TradeCount();
          return;
       }
       if(EnableMarketDNA) MarketDNAManagePendingLimits();
      HT6AuditPulse();
      DrawObjects();
      PyrDrawStructure();
      PyrPaintSwingHistory();
      gPreviousOpenTradeCount=TradeCount();
      return;
   }

   if(TradeCount()>0)
   {
      SovUpdateTicketMemory();
      SovManageGravity();

      HT5ManageTrendStopBreathing();
      ManageConfirmedArrowReversalExit();
      if(TradeCount()>0) ManageBasket();
      gDirection=DetectDirection();
      UpdateCampaignState();
   }
   else
   {
      gDirection=DIR_FLAT;
      gPeakProfit=0;
      gSovScaleState=SovScaleState();
      gSovYokeState="UNYOKED";
      SovResetGravity();
      UpdateCampaignState();
   }

   if(ArrowEntryControl!=ARROW_ENTRY_OFF_USE_SETUPS)
   {
      if(structureReady) TryArrowTickEntry();
      else gEntryStatus="ARROW WAITING FOR STRUCTURE";
   }
   else if(TradeCount()>0)
      TryAdd();
   else
      TryInitialEntry();

   DrawObjects();
   gPreviousOpenTradeCount=TradeCount();
}
//+------------------------------------------------------------------+
