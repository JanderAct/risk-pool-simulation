// Core TypeScript types for Risk Pool Simulation v1

export type MemberStatus = 'active' | 'withdrawn' | 'prospect';
export type MemberType =
  | 'City'
  | 'County'
  | 'Fire District'
  | 'Water District'
  | 'Transit Authority'
  | 'School District'
  | 'Park District'
  | 'Recreation District'
  | 'Special District';

export type SizeCategory = 'Small' | 'Medium' | 'Large' | 'Very Large';

export interface Member {
  id: string;
  name: string;
  type: MemberType;
  sizeCategory: SizeCategory;
  exposure: number; // exposure units
  yearJoined: number; // yearNumber when joined
  calendarYearJoined: number;
  riskQuality: number; // 1-10
  satisfaction: number; // 1-10
  status: MemberStatus;
  yearWithdrawn?: number;
}

export interface MemberSegment {
  type: MemberType;
  count: number;
  totalExposure: number;
  averageRiskQuality: number;
  averageSatisfaction: number;
}

// Game instance environment — seeded, immutable after creation
export interface GameInstance {
  instanceId: string;
  seed: number;
  lossEnvironment: {
    baseLossRatio: number;        // e.g. 0.68
    lossTrend: number;            // annual claim inflation e.g. 0.04
    volatility: number;           // std dev factor e.g. 0.15
    shockProbability: number;     // e.g. 0.08
    shockSeverityMultiplier: number; // e.g. 2.5
    heavyTailRisk: number;        // 0-1 extra tail probability
  };
  investmentEnvironment: {
    baseReturn: number;           // e.g. 0.04
    volatility: number;           // e.g. 0.06
    downsideRisk: number;         // probability of negative year e.g. 0.10
  };
  marketEnvironment: {
    totalMarketGrowthRate: number; // e.g. 0.02
    competitivePressure: number;   // 0-1
    memberSensitivity: number;     // 0-1 how reactive members are to price
  };
}

export interface GameSetupSettings {
  poolName: string;
  gameLength: number;     // number of years
  startingYear: number;   // calendar year label only
  instanceId: string;
}

// Player decisions for a given year
export interface DecisionSet {
  yearNumber: number;
  rateChange: number;             // -0.20 to +0.30 as decimal
  fundingConfidenceLevel: number; // 0.50 to 0.95
  dividendPct: number;            // 0.00 to 0.15 of premium
  assessmentPct: number;          // 0.00 to 0.25 of premium
  underwritingStrictness: number; // 0-10
  riskControlPct: number;         // 0.00 to 0.08 of premium
  reinsuranceLevel: number;       // 0-4
  investmentRisk: number;         // 0-10
}

// Reinsurance structure derived from level selection
export interface ReinsuranceStructure {
  level: number;
  label: string;
  attachment: number;           // dollar amount
  limit: number;                // dollar amount
  recoveryPct: number;          // fraction recovered above attachment up to limit
  costPctOfPremium: number;     // approximate annual cost as % of premium
}

// Annual reserve cohort for simplified development
export interface ReserveCohort {
  yearNumber: number;
  calendarYear: number;
  grossUltimate: number;
  grossPaid: number;
  grossUnpaid: number;
  reinsuranceRecoverable: number;
  reinsuranceReceived: number;
  paydownPct: number;           // portion paid each year
  developmentFactor: number;    // seeded favorable/adverse dev
  closed: boolean;
}

// Full result for one completed simulation year
export interface ResultSet {
  yearNumber: number;
  calendarYear: number;

  // Decisions echoed
  decisions: DecisionSet;

  // Membership
  activeMembers: number;
  newMembers: number;
  withdrawnMembers: number;
  activeExposure: number;
  totalMarketExposure: number;
  marketShare: number;          // exposure-based
  memberRetentionRate: number;
  memberSatisfaction: number;
  averageRiskQuality: number;
  memberList: Member[];

  // Pricing
  rateLevel: number;            // cumulative index
  ratePer100: number;           // rate per $100 payroll
  purePremiumPer100: number;    // expected loss per $100 payroll
  purePremium: number;          // kept for compat
  writtenExposure: number;      // payroll exposure in $M

  // Premium
  grossPremium: number;
  assessments: number;
  dividends: number;

  // Losses
  grossUltimateLoss: number;
  shockLossIncurred: boolean;
  reinsuranceCost: number;
  reinsuranceRecovery: number;
  netUltimateLoss: number;

  // Expenses
  operatingExpense: number;
  riskControlInvestment: number;

  // Reserve development
  priorYearDevelopment: number; // positive = favorable, negative = adverse
  beginningGrossReserve: number;
  currentYearGrossReserve: number; // IBNR + case for this accident year
  grossPaidLosses: number;
  endingGrossReserve: number;
  beginningReinsRecoverable: number;
  endingReinsRecoverable: number;

  // Investment
  investmentReturnRate: number;
  investedAssets: number;
  investmentIncome: number;

  // Funding Target & Adequacy
  // The CLF represents a funding target, NOT an accounting reserve.
  // The player chooses "what confidence level do we want to fund at?"
  // The selected CLF is applied to expected unpaid losses to derive a funding target.
  // Funding adequacy compares available capital to that target.
  selectedFundingConfidenceLevel: number;  // Player-facing selection (0.50 to 0.95)
  selectedFundingCLF: number;              // Backend actuarial factor from CLF table
  expectedGrossUnpaidLoss: number;         // Expected unpaid losses from all cohorts (gross)
  expectedReinsuranceRecoverable: number;  // Reinsurance recoverable on unpaid losses
  expectedNetUnpaidLoss: number;           // Expected unpaid losses net of reinsurance
  grossFundingTarget: number;             // expectedGrossUnpaidLoss × selectedFundingCLF
  netFundingTarget: number;               // expectedNetUnpaidLoss × selectedFundingCLF
  fundingMarginNeeded: number;            // netFundingTarget - expectedNetUnpaidLoss (positive = need more funding)
  availableFunding: number;               // endingSurplus = capital available to cover funding target
  fundingGap: number;                    // availableFunding - netFundingTarget (positive = surplus, negative = gap)
  fundingAdequacyRatio: number;          // availableFunding / netFundingTarget
  fundingAdequacyStatus: string;          // "Strong" | "Adequate" | "Thin" | "Deficient"
  // Legacy compatibility
  fundingCLF: number;                    // Alias for selectedFundingCLF
  fundingAdequacyIndicator: string;      // Alias for fundingAdequacyStatus

  // Income statement
  netIncome: number;

  // Balance sheet
  beginningCash: number;
  endingCash: number;
  beginningInvestments: number;
  endingInvestments: number;
  premiumsReceivable: number;
  otherAssets: number;
  totalAssets: number;
  unearnedPremium: number;
  otherLiabilities: number;
  totalLiabilities: number;
  beginingSurplus: number;
  endingSurplus: number;

  // Ratios
  combinedRatio: number;
  lossRatio: number;
  expenseRatio: number;

  // Narrative
  narrativeExplanation: string;
}

// Pool ongoing state (rolled from year to year)
export interface PoolState {
  rateLevel: number;           // cumulative rate index (starts at 100)
  ratePer100: number;          // rate per $100 of payroll (e.g. 7.50)
  purePremiumPer100: number;   // expected loss cost per $100 payroll
  /** @deprecated use purePremiumPer100 */
  purePremium: number;         // kept for backward compat — equals purePremiumPer100
  memberSatisfaction: number;
  averageRiskQuality: number;
  riskControlEffectiveness: number; // rolling score 0-1
  reserveCohorts: ReserveCohort[];
  members: Member[];
  cash: number;
  investments: number;
  otherAssets: number;
  grossUnpaidReserve: number;
  reinsuranceRecoverable: number;
  unearnedPremium: number;
  otherLiabilities: number;
  surplus: number;
  totalMarketExposure: number;
  allMarketMembers: Member[];      // all 100 fictional members
}

// Top-level game state
export interface GameState {
  setup: GameSetupSettings;
  instance: GameInstance;
  currentYearNumber: number;
  isStarted: boolean;
  isComplete: boolean;
  poolState: PoolState;
  lockedResults: ResultSet[];
  currentDecisions: DecisionSet;
}

// Starting financial position
export interface StartingFinancials {
  cash: number;
  investments: number;
  premiumsReceivable: number;
  reinsuranceRecoverable: number;
  otherAssets: number;
  totalAssets: number;
  grossUnpaidReserve: number;
  unearnedPremium: number;
  otherLiabilities: number;
  totalLiabilities: number;
  surplus: number;
  annualPremium: number;
  expectedLossRatio: number;
  memberSatisfaction: number;
  riskQuality: number;
  surplusToPremiumRatio: number;
  activeMembers: number;
  activeExposure: number;      // payroll in $M
  totalMarketExposure: number; // payroll in $M
  marketShare: number;
  rateLevel: number;
  ratePer100: number;          // rate per $100 payroll
  purePremiumPer100: number;   // expected loss per $100 payroll
  purePremium: number;         // kept for compat
}

// V2: ChartDataPoint for future chart support
export interface ChartDataPoint {
  yearNumber: number;
  calendarYear: number;
  value: number;
  label: string;
}

// V2: LossDistributionConfig for more advanced modeling
export interface LossDistributionConfig {
  distributionType: 'lognormal' | 'gamma' | 'normal';
  mean: number;
  cv: number;
}

// V2: ReserveDevelopmentState for full accident-year triangle
export interface ReserveDevelopmentState {
  accidentYear: number;
  developmentPattern: number[];
  selectedFactors: number[];
}