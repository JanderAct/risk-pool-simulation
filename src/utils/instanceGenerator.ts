// Generates a deterministic game instance from a seed
// Exposure = payroll in millions of dollars
// Premium = Exposure($M) × Rate_per_$100_payroll × 10,000

import type { GameInstance, Member, MemberType, SizeCategory, PoolState, StartingFinancials, ReserveCohort } from '../types/simulation';
import { SeededRandom } from './random';
import {
  STARTING_FINANCIALS,
  STARTING_MEMBER_RANGE,
  TOTAL_MARKET_MEMBERS,
  EXPOSURE_RANGES,
  SIZE_WEIGHTS,
  STARTING_RATE_PER_100,
  RESERVE_PAYDOWN_PCT,
} from '../data/defaultAssumptions';

const CITY_PREFIXES = ['Northvale', 'Southgate', 'Eastbrook', 'Westfield', 'Lakewood', 'Riverside', 'Crestview', 'Pinehurst', 'Oakdale', 'Maplewood', 'Elmwood', 'Cedarview', 'Birchwood', 'Willowbrook', 'Stonegate', 'Hillcrest', 'Fairview', 'Clearwater', 'Greenvale', 'Springdale', 'Summerset', 'Winterborn', 'Harborview', 'Cliffside', 'Meadowbrook', 'Ridgeline', 'Timberdale', 'Ironwood', 'Silverbrook', 'Goldenvale'];
const COUNTY_PREFIXES = ['Blackstone', 'Redwood', 'Ironridge', 'Graystone', 'Whitewater', 'Blueridge', 'Greenfield', 'Sunridge', 'Moonvale', 'Starfall', 'Copper', 'Ash', 'Beech', 'Birch', 'Cedar', 'Douglas', 'Fir', 'Hazel', 'Larch', 'Maple', 'Oak', 'Pine', 'Sequoia', 'Spruce', 'Walnut', 'Willow', 'Alder', 'Aspen', 'Cypress', 'Juniper'];
const DISTRICT_NAMES = ['Metro', 'Valley', 'Highland', 'Lowland', 'Central', 'Northern', 'Southern', 'Eastern', 'Western', 'Regional', 'Community', 'Municipal', 'County', 'Rural', 'Urban', 'Tri-County', 'Four-Valley', 'Lakeshore', 'Hillside', 'Creekside', 'Ridgemont', 'Bayside', 'Seaside', 'Inland', 'Upland'];

function generateMemberName(rng: SeededRandom, type: MemberType, usedNames: Set<string>): string {
  let attempts = 0;
  while (attempts < 50) {
    let name = '';
    switch (type) {
      case 'City':             name = `City of ${rng.pick(CITY_PREFIXES)}`; break;
      case 'County':           name = `${rng.pick(COUNTY_PREFIXES)} County`; break;
      case 'Fire District':    name = `${rng.pick(DISTRICT_NAMES)} Fire District`; break;
      case 'Water District':   name = `${rng.pick(DISTRICT_NAMES)} Water District`; break;
      case 'Transit Authority':name = `${rng.pick(DISTRICT_NAMES)} Transit Authority`; break;
      case 'School District':  name = `${rng.pick(CITY_PREFIXES)} Unified School District`; break;
      case 'Park District':    name = `${rng.pick(DISTRICT_NAMES)} Park District`; break;
      case 'Recreation District': name = `${rng.pick(DISTRICT_NAMES)} Recreation District`; break;
      case 'Special District': name = `${rng.pick(DISTRICT_NAMES)} Special District`; break;
    }
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
    attempts++;
  }
  const base = `${rng.pick(DISTRICT_NAMES)} ${type} ${Math.floor(rng.range(100, 999))}`;
  usedNames.add(base);
  return base;
}

const MEMBER_TYPES: MemberType[] = ['City', 'County', 'Fire District', 'Water District', 'Transit Authority', 'School District', 'Park District', 'Recreation District', 'Special District'];
const SIZE_CATEGORIES: SizeCategory[] = ['Small', 'Medium', 'Large', 'Very Large'];

function pickSize(rng: SeededRandom): SizeCategory {
  const r = rng.next();
  let cumulative = 0;
  for (let i = 0; i < SIZE_WEIGHTS.length; i++) {
    cumulative += SIZE_WEIGHTS[i];
    if (r < cumulative) return SIZE_CATEGORIES[i];
  }
  return 'Small';
}

function generateExposure(rng: SeededRandom, size: SizeCategory): number {
  const { min, max } = EXPOSURE_RANGES[size];
  return parseFloat(rng.range(min, max).toFixed(2));
}

export function generateAllMarketMembers(rng: SeededRandom): Member[] {
  const members: Member[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < TOTAL_MARKET_MEMBERS; i++) {
    const type = rng.pick(MEMBER_TYPES);
    const size = pickSize(rng);
    const exposure = generateExposure(rng, size);
    const name = generateMemberName(rng, type, usedNames);
    members.push({
      id: `member-${i + 1}`,
      name,
      type,
      sizeCategory: size,
      exposure,
      yearJoined: 0,
      calendarYearJoined: 0,
      riskQuality: parseFloat(rng.range(2.0, 8.5).toFixed(1)),
      satisfaction: parseFloat(rng.range(5.0, 9.0).toFixed(1)),
      status: 'prospect',
    });
  }
  return members;
}

function assignStartingMembers(allMembers: Member[], rng: SeededRandom, targetCount: number, startingYear: number): Member[] {
  const shuffled = [...allMembers];
  rng.shuffle(shuffled);
  return shuffled.slice(0, targetCount).map(m => ({
    ...m,
    status: 'active' as const,
    yearJoined: 1,
    calendarYearJoined: startingYear,
    satisfaction: parseFloat(rng.range(6.0, 8.5).toFixed(1)),
    riskQuality: parseFloat(rng.range(4.0, 7.0).toFixed(1)),
  }));
}

// Generate starting reserve cohorts from the beginning gross unpaid reserve
// These are prior accident-year cohorts that exist before gameplay starts
function generateStartingReserveCohorts(
  grossUnpaidReserve: number,
  reinsuranceRecoverable: number,
  startingYear: number,
  rng: SeededRandom
): ReserveCohort[] {
  if (grossUnpaidReserve <= 0) return [];

  // Create 3-5 prior accident-year cohorts
  // More recent cohorts have more unpaid; older cohorts have less
  const numCohorts = rng.intRange(3, 5);
  const cohorts: ReserveCohort[] = [];

  // Weight distribution for cohorts (most recent gets most weight)
  // e.g., for 4 cohorts: [0.35, 0.30, 0.20, 0.15]
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < numCohorts; i++) {
    // Decreasing weight for older cohorts
    const w = 1 / (i + 1);
    weights.push(w);
    weightSum += w;
  }
  // Normalize
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= weightSum;
  }

  // Distribute the gross unpaid reserve across cohorts
  let remainingReserve = grossUnpaidReserve;
  let remainingReins = reinsuranceRecoverable;

  for (let i = 0; i < numCohorts; i++) {
    // Last cohort gets the remainder to ensure exact sum
    const isLast = i === numCohorts - 1;
    const cohortGrossUnpaid = isLast ? remainingReserve : grossUnpaidReserve * weights[i];
    const cohortReins = isLast ? remainingReins : reinsuranceRecoverable * weights[i];

    // Calculate how much has been paid on this cohort (older = more paid)
    // Age determines paydown: cohorts aged 1-5 years
    const age = i + 1; // 1 = most recent (1 year ago), 5 = oldest (5 years ago)
    const paidRatio = Math.min(0.80, age * RESERVE_PAYDOWN_PCT);
    const grossUltimate = cohortGrossUnpaid / (1 - paidRatio);
    const grossPaid = grossUltimate * paidRatio;

    // Development factor based on age (older cohorts have settled more)
    const devFactor = 1 + rng.range(-0.03, 0.05) / age;

    // Year number is negative for prior accident years (relative to game start)
    // yearNumber 0 = accident year before game starts
    // Calendar year is game starting year minus age
    const cohortYearNumber = -age;
    const cohortCalendarYear = startingYear - age;

    cohorts.push({
      yearNumber: cohortYearNumber,
      calendarYear: cohortCalendarYear,
      grossUltimate,
      grossPaid,
      grossUnpaid: cohortGrossUnpaid,
      reinsuranceRecoverable: cohortReins,
      reinsuranceReceived: cohortReins * paidRatio, // Proportional to paid
      paydownPct: RESERVE_PAYDOWN_PCT,
      developmentFactor: devFactor,
      closed: false,
    });

    remainingReserve -= cohortGrossUnpaid;
    remainingReins -= cohortReins;
  }

  return cohorts;
}

export function generateGameInstance(instanceId: string, seed: number): GameInstance {
  const rng = new SeededRandom(seed);
  return {
    instanceId,
    seed,
    lossEnvironment: {
      baseLossRatio: rng.range(0.62, 0.78),
      lossTrend: rng.range(0.02, 0.07),
      volatility: rng.range(0.10, 0.25),
      shockProbability: rng.range(0.05, 0.15),
      shockSeverityMultiplier: rng.range(1.8, 3.5),
      heavyTailRisk: rng.range(0.05, 0.25),
    },
    investmentEnvironment: {
      baseReturn: rng.range(0.025, 0.055),
      volatility: rng.range(0.04, 0.10),
      downsideRisk: rng.range(0.05, 0.15),
    },
    marketEnvironment: {
      totalMarketGrowthRate: rng.range(0.01, 0.04),
      competitivePressure: rng.range(0.3, 0.8),
      memberSensitivity: rng.range(0.3, 0.8),
    },
  };
}

export function generateStartingPoolState(instance: GameInstance, startingYear: number): { poolState: PoolState; startingFinancials: StartingFinancials } {
  const rng = new SeededRandom(instance.seed + 777);

  const allMarketMembers = generateAllMarketMembers(rng);
  const startingMemberCount = rng.intRange(STARTING_MEMBER_RANGE.min, STARTING_MEMBER_RANGE.max);
  const startingPoolMembers = assignStartingMembers(allMarketMembers, rng, startingMemberCount, startingYear);
  const startingMemberIds = new Set(startingPoolMembers.map(m => m.id));

  const allMembersWithStatus: Member[] = allMarketMembers.map(m => ({
    ...m,
    status: startingMemberIds.has(m.id) ? ('active' as const) : ('prospect' as const),
    yearJoined: startingMemberIds.has(m.id) ? 1 : 0,
    calendarYearJoined: startingMemberIds.has(m.id) ? startingYear : 0,
  }));

  const activeMembers = allMembersWithStatus.filter(m => m.status === 'active');

  let activeExposure = activeMembers.reduce((sum, m) => sum + m.exposure, 0);
  let totalMarketExposure = allMarketMembers.reduce((sum, m) => sum + m.exposure, 0);

  const targetPremium = rng.range(STARTING_FINANCIALS.annualPremium.min, STARTING_FINANCIALS.annualPremium.max);
  const annualPremium = targetPremium;

  const derivedRate = annualPremium / (activeExposure * 10_000);
  const ratePer100 = Math.max(STARTING_RATE_PER_100.min, Math.min(STARTING_RATE_PER_100.max, derivedRate));

  const expectedLossRatio = rng.range(STARTING_FINANCIALS.expectedLossRatio.min, STARTING_FINANCIALS.expectedLossRatio.max);
  const purePremiumPer100 = ratePer100 * expectedLossRatio;
  const memberSatisfaction = rng.range(STARTING_FINANCIALS.memberSatisfaction.min, STARTING_FINANCIALS.memberSatisfaction.max);
  const riskQuality = rng.range(STARTING_FINANCIALS.riskQuality.min, STARTING_FINANCIALS.riskQuality.max);

  const cash = rng.range(STARTING_FINANCIALS.cash.min, STARTING_FINANCIALS.cash.max);
  const investments = rng.range(STARTING_FINANCIALS.investments.min, STARTING_FINANCIALS.investments.max);
  const premiumsReceivable = annualPremium * rng.range(STARTING_FINANCIALS.premiumsReceivablePct.min, STARTING_FINANCIALS.premiumsReceivablePct.max);
  const reinsuranceRecoverable = rng.range(STARTING_FINANCIALS.reinsuranceRecoverable.min, STARTING_FINANCIALS.reinsuranceRecoverable.max);
  const otherAssets = rng.range(STARTING_FINANCIALS.otherAssets.min, STARTING_FINANCIALS.otherAssets.max);
  const grossUnpaidReserve = rng.range(STARTING_FINANCIALS.grossUnpaidReserve.min, STARTING_FINANCIALS.grossUnpaidReserve.max);
  const unearnedPremium = annualPremium * rng.range(STARTING_FINANCIALS.unearnedPremiumPct.min, STARTING_FINANCIALS.unearnedPremiumPct.max);
  const otherLiabilities = rng.range(STARTING_FINANCIALS.otherLiabilities.min, STARTING_FINANCIALS.otherLiabilities.max);

  const totalAssets = cash + investments + premiumsReceivable + reinsuranceRecoverable + otherAssets;
  const totalLiabilities = grossUnpaidReserve + unearnedPremium + otherLiabilities;
  const surplus = totalAssets - totalLiabilities;

  const marketShare = activeExposure / Math.max(totalMarketExposure, 0.01);

  // Generate starting reserve cohorts from the beginning gross unpaid reserve
  // These represent prior accident-year unpaid losses that will roll forward during gameplay
  const startingReserveCohorts = generateStartingReserveCohorts(
    grossUnpaidReserve,
    reinsuranceRecoverable,
    startingYear,
    rng
  );

  // Validate sum
  const cohortSum = startingReserveCohorts.reduce((s, c) => s + c.grossUnpaid, 0);
  if (Math.abs(cohortSum - grossUnpaidReserve) > 1) {
    console.warn(`Starting reserve cohort sum (${cohortSum}) does not match grossUnpaidReserve (${grossUnpaidReserve})`);
  }

  const poolState: PoolState = {
    rateLevel: 100,
    ratePer100,
    purePremiumPer100,
    purePremium: purePremiumPer100,
    memberSatisfaction: parseFloat(memberSatisfaction.toFixed(1)),
    averageRiskQuality: parseFloat(riskQuality.toFixed(1)),
    riskControlEffectiveness: 0,
    reserveCohorts: startingReserveCohorts,
    members: allMembersWithStatus,
    cash,
    investments,
    otherAssets,
    grossUnpaidReserve,
    reinsuranceRecoverable,
    unearnedPremium,
    otherLiabilities,
    surplus,
    totalMarketExposure,
    allMarketMembers: allMembersWithStatus,
  };

  const startingFinancials: StartingFinancials = {
    cash,
    investments,
    premiumsReceivable,
    reinsuranceRecoverable,
    otherAssets,
    totalAssets,
    grossUnpaidReserve,
    unearnedPremium,
    otherLiabilities,
    totalLiabilities,
    surplus,
    annualPremium,
    expectedLossRatio,
    memberSatisfaction: parseFloat(memberSatisfaction.toFixed(1)),
    riskQuality: parseFloat(riskQuality.toFixed(1)),
    surplusToPremiumRatio: surplus / annualPremium,
    activeMembers: activeMembers.length,
    activeExposure: parseFloat(activeExposure.toFixed(2)),
    totalMarketExposure: parseFloat(totalMarketExposure.toFixed(2)),
    marketShare: parseFloat(marketShare.toFixed(4)),
    rateLevel: 100,
    ratePer100: parseFloat(ratePer100.toFixed(4)),
    purePremiumPer100: parseFloat(purePremiumPer100.toFixed(4)),
    purePremium: parseFloat(purePremiumPer100.toFixed(4)),
  };

  return { poolState, startingFinancials };
}