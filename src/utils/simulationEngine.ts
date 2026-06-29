// Core simulation engine for Risk Pool Simulation v1
// Premium formula: Premium = Exposure($M) × Rate_per_$100_payroll × 10,000

import type { GameState, PoolState, DecisionSet, ResultSet, ReserveCohort, Member } from '../types/simulation';
import { SeededRandom, deriveSubRng } from './random';
import { FUNDING_CLF_TABLE, OPERATING_EXPENSE_RATIO, RISK_CONTROL_PARAMS, RESERVE_PAYDOWN_PCT } from '../data/defaultAssumptions';
import { getReinsuranceStructure, calculateReinsuranceCost, calculateReinsuranceRecovery } from './reinsuranceEngine';
import { simulateInvestmentReturn } from './investmentEngine';
import { simulateMemberMovement } from './membershipEngine';
import { generateNarrative } from './narrativeEngine';

export function lookupCLF(level: number): number {
  const rounded = Math.round(level * 20) / 20;
  const keys = Object.keys(FUNDING_CLF_TABLE).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  let bestDiff = Math.abs(rounded - keys[0]);
  for (const k of keys) {
    const diff = Math.abs(rounded - k);
    if (diff < bestDiff) { best = k; bestDiff = diff; }
  }
  return FUNDING_CLF_TABLE[best];
}

export function processYear(gameState: GameState, decisions: DecisionSet): { updatedPoolState: PoolState; result: ResultSet } {
  const { instance, poolState, currentYearNumber, setup } = gameState;
  const yearNumber = currentYearNumber;
  const calendarYear = setup.startingYear + yearNumber - 1;

  const priorResult = gameState.lockedResults[gameState.lockedResults.length - 1];
  const priorYearLossRatio = priorResult ? priorResult.grossUltimateLoss / Math.max(priorResult.grossPremium, 1) : undefined;

  const newRateLevel = poolState.rateLevel * (1 + decisions.rateChange);
  const newRatePer100 = poolState.ratePer100 * (1 + decisions.rateChange);

  const currentActiveMembers = poolState.members.filter(m => m.status === 'active');
  const estimatedExposure = currentActiveMembers.reduce((s, m) => s + m.exposure, 0);
  const estimatedPremium = estimatedExposure * newRatePer100 * 10_000;
  const estimatedExpectedLoss = estimatedExposure * poolState.purePremiumPer100 * 10_000;

  const reinsStructure = getReinsuranceStructure(decisions.reinsuranceLevel, estimatedPremium, estimatedExpectedLoss);
  const reinsuranceCost = calculateReinsuranceCost(decisions.reinsuranceLevel, estimatedPremium, instance.marketEnvironment.competitivePressure);

  const memberRng = deriveSubRng(instance.seed, yearNumber, 'members');
  const memberResult = simulateMemberMovement({
    currentMembers: currentActiveMembers,
    allMarketMembers: poolState.allMarketMembers,
    decisions,
    currentMemberSatisfaction: poolState.memberSatisfaction,
    currentRiskQuality: poolState.averageRiskQuality,
    surplus: poolState.surplus,
    annualPremium: estimatedPremium,
    priorYearLossRatio,
    competitivePressure: instance.marketEnvironment.competitivePressure,
    memberSensitivity: instance.marketEnvironment.memberSensitivity,
    yearNumber,
    calendarYear,
    rng: memberRng,
  });

  const activeExposure = memberResult.activeExposure;
  const totalMarketExposure = memberResult.totalMarketExposure;
  const marketShare = activeExposure / Math.max(totalMarketExposure, 0.01);

  const updatedAllMembers: Member[] = poolState.allMarketMembers.map(m => {
    const active = memberResult.activeMembers.find(a => a.id === m.id);
    if (active) return active;
    const withdrawn = memberResult.withdrawnMembers.find(w => w.id === m.id);
    if (withdrawn) return withdrawn;
    return m;
  });

  const lossTrend = instance.lossEnvironment.lossTrend;
  const priorRCEffectiveness = poolState.riskControlEffectiveness;
  const maxRC = RISK_CONTROL_PARAMS.maxEffectiveness;
  const rcGain = decisions.riskControlPct / 0.08 * maxRC / RISK_CONTROL_PARAMS.lagYears;
  const rcDecay = priorRCEffectiveness * RISK_CONTROL_PARAMS.decayRate * (decisions.riskControlPct < 0.01 ? 2 : 1);
  const newRCEffectiveness = Math.max(0, Math.min(maxRC, priorRCEffectiveness + rcGain - rcDecay));

  const adverseSelectionPressure = Math.max(0, (5 - decisions.underwritingStrictness) / 5 * 0.04 + Math.max(0, -decisions.rateChange) * 0.05);
  const qualityImpact = (decisions.underwritingStrictness - 5) / 5 * 0.015;

  const newPurePremiumPer100 = poolState.purePremiumPer100 * (1 + lossTrend) * (1 + adverseSelectionPressure) * (1 - qualityImpact) * (1 - newRCEffectiveness);

  const grossPremium = activeExposure * newRatePer100 * 10_000;
  const writtenExposure = activeExposure;

  const lossRng = deriveSubRng(instance.seed, yearNumber, 'losses');
  const expectedLoss = activeExposure * newPurePremiumPer100 * 10_000;

  const lossVolatility = instance.lossEnvironment.volatility * (1 - (decisions.underwritingStrictness / 10) * 0.3);
  const logMean = Math.log(Math.max(expectedLoss, 1)) - 0.5 * lossVolatility * lossVolatility;
  const simulatedLoss = lossRng.lognormal(logMean, lossVolatility);

  let grossUltimateLoss = simulatedLoss;

  const shockRng = deriveSubRng(instance.seed, yearNumber, 'shock');
  const shockOccurred = shockRng.chance(instance.lossEnvironment.shockProbability);
  if (shockOccurred) {
    const shockAmount = expectedLoss * (instance.lossEnvironment.shockSeverityMultiplier - 1) * shockRng.range(0.5, 1.5);
    grossUltimateLoss += shockAmount;
  }

  grossUltimateLoss = Math.max(0, grossUltimateLoss);

  const reinsuranceRecovery = calculateReinsuranceRecovery(grossUltimateLoss, reinsStructure);
  const netUltimateLoss = grossUltimateLoss - reinsuranceRecovery;

  const operatingExpense = grossPremium * OPERATING_EXPENSE_RATIO;
  const riskControlInvestment = grossPremium * decisions.riskControlPct;

  const investRng = deriveSubRng(instance.seed, yearNumber, 'invest');
  const investedAssets = poolState.investments;
  const invResult = simulateInvestmentReturn(investedAssets, decisions.investmentRisk, instance.investmentEnvironment.baseReturn, instance.investmentEnvironment.volatility, instance.investmentEnvironment.downsideRisk, investRng);
  const investmentIncome = invResult.income;
  const investmentReturnRate = invResult.returnRate;

  // --- Reserve Development (before funding calculations) ---
  // Process ALL existing reserve cohorts: starting cohorts + prior year cohorts
  // Each cohort develops and pays down over time
  const devRng = deriveSubRng(instance.seed, yearNumber, 'dev');
  // Use prior funding adequacy to affect development (underfunded pools see more adverse development)
  const priorFundingAdequacyRatio = priorResult?.fundingAdequacyRatio ?? 1.0;
  const { developmentImpact, updatedCohorts, grossPaidThisYear, reinsReceivedThisYear } = processReserveDevelopment(
    poolState.reserveCohorts,
    devRng,
    priorFundingAdequacyRatio
  );

  // Current year reserve: 60% of ultimate is unpaid (IBNR + case), 40% is paid
  const currentYearGrossReserve = grossUltimateLoss * 0.60;
  const grossPaidCurrentYear = grossUltimateLoss * 0.40;

  const currentYearCohort: ReserveCohort = {
    yearNumber,
    calendarYear,
    grossUltimate: grossUltimateLoss,
    grossPaid: grossPaidCurrentYear,
    grossUnpaid: currentYearGrossReserve,
    reinsuranceRecoverable: reinsuranceRecovery * 0.60,
    reinsuranceReceived: reinsuranceRecovery * 0.40,
    paydownPct: RESERVE_PAYDOWN_PCT,
    developmentFactor: 1 + devRng.range(-0.05, 0.08),
    closed: false,
  };

  const allCohorts = [...updatedCohorts, currentYearCohort];

  // --- Expected Unpaid Losses (for balance sheet and funding target) ---
  // This is the BOOKED reserve - expected unpaid losses from all accident years
  // Starting reserve cohorts + current year cohort all roll forward together
  const endingGrossReserve = allCohorts.reduce((s, c) => s + c.grossUnpaid, 0);  // Sum of all remaining unpaid
  const endingReinsRecoverable = allCohorts.reduce((s, c) => s + c.reinsuranceRecoverable, 0);  // Reinsurance on unpaid
  const expectedGrossUnpaidLoss = endingGrossReserve;  // Same as endingGrossReserve
  const expectedReinsuranceRecoverable = endingReinsRecoverable;  // Same as endingReinsRecoverable
  const expectedNetUnpaidLoss = Math.max(0, expectedGrossUnpaidLoss - expectedReinsuranceRecoverable);

  // --- Beginning Gross Reserve from prior cohorts (validates starting position) ---
  // For first year, this comes from starting reserve cohorts in poolState
  // For subsequent years, this is the prior year's ending reserve
  const beginningGrossReserve = poolState.reserveCohorts.reduce((s, c) => s + c.grossUnpaid, 0);
  const beginningReinsRecoverable = poolState.reserveCohorts.reduce((s, c) => s + c.reinsuranceRecoverable, 0);

  // --- Income Statement ---
  const assessments = grossPremium * decisions.assessmentPct;
  const dividends = grossPremium * decisions.dividendPct;
  const priorYearDevelopment = developmentImpact;

  const netIncome = grossPremium + assessments + investmentIncome - netUltimateLoss - operatingExpense - riskControlInvestment - reinsuranceCost - dividends + priorYearDevelopment;

  // --- Balance Sheet ---
  // The balance sheet uses EXPECTED unpaid losses as the booked reserve, NOT CLF-loaded
  const beginingSurplus = poolState.surplus;

  const unearnedPremium = grossPremium * 0.25;
  const otherLiabilities = poolState.otherLiabilities;
  const premiumsReceivable = grossPremium * 0.08;

  const beginningCash = poolState.cash;
  // Cash flow includes:
  // - Premium and assessments received
  // - Loss payments (current year + prior year cohorts)
  // - Reinsurance received (current year recovery + prior cohort recoveries)
  // - Operating expenses, risk control, reinsurance cost, dividends
  const newCash = beginningCash + grossPremium + assessments - grossPaidCurrentYear - grossPaidThisYear + reinsuranceRecovery * 0.40 + reinsReceivedThisYear - operatingExpense - riskControlInvestment - reinsuranceCost - dividends;
  const endingCash = Math.max(0, newCash);

  const beginningInvestments = poolState.investments;
  const endingInvestments = Math.max(0, beginningInvestments + investmentIncome - Math.max(0, -netIncome) * 0.5);

  const totalAssets = endingCash + endingInvestments + premiumsReceivable + endingReinsRecoverable + poolState.otherAssets;
  // Liabilities use expected unpaid losses, NOT CLF-loaded funding target
  const totalLiabilities = expectedGrossUnpaidLoss + unearnedPremium + otherLiabilities;

  // Ending surplus: clean balance sheet identity
  // Surplus = Assets - Liabilities (no CLF adjustment to liabilities)
  const endingSurplus = totalAssets - totalLiabilities;

  // --- Surplus Rollforward Validation ---
  // In a clean model, Ending Surplus = Beginning Surplus + Net Income
  // The difference should be zero (or very close due to rounding)
  const surplusFromIncome = beginingSurplus + netIncome;
  const surplusTieOutDifference = endingSurplus - surplusFromIncome;

  // --- Funding Target & Adequacy (CLF logic) ---
  // The CLF is used to calculate a FUNDING TARGET, not an accounting reserve.
  // The player chooses "what confidence level do we want to fund at?"
  const selectedFundingConfidenceLevel = decisions.fundingConfidenceLevel;
  const selectedFundingCLF = lookupCLF(selectedFundingConfidenceLevel);

  // Funding target = expected unpaid losses × CLF
  const grossFundingTarget = expectedGrossUnpaidLoss * selectedFundingCLF;
  const netFundingTarget = expectedNetUnpaidLoss * selectedFundingCLF;

  // Funding margin needed = how much MORE funding is needed beyond expected unpaid
  const fundingMarginNeeded = netFundingTarget - expectedNetUnpaidLoss;

  // Available funding = ending surplus (capital available to cover funding target)
  const availableFunding = endingSurplus;

  // Funding gap = available funding - funding target
  // Positive = surplus above target, Negative = gap below target
  const fundingGap = availableFunding - netFundingTarget;

  // Funding adequacy ratio = available funding / funding target
  const fundingAdequacyRatio = availableFunding / Math.max(netFundingTarget, 1);

  // Funding adequacy status based on ratio
  const fundingAdequacyStatus =
    fundingAdequacyRatio >= 1.25 ? 'Strong' :
    fundingAdequacyRatio >= 1.00 ? 'Adequate' :
    fundingAdequacyRatio >= 0.90 ? 'Thin' :
    'Deficient';

  // Legacy compatibility fields
  const fundingCLF = selectedFundingCLF;
  const fundingAdequacyIndicator = fundingAdequacyStatus;

  // --- Ratios ---
  const combinedRatio = (netUltimateLoss + operatingExpense + riskControlInvestment + reinsuranceCost) / Math.max(grossPremium, 1);
  const lossRatio = netUltimateLoss / Math.max(grossPremium, 1);
  const expenseRatio = (operatingExpense + riskControlInvestment + reinsuranceCost) / Math.max(grossPremium, 1);

  const result: ResultSet = {
    yearNumber,
    calendarYear,
    decisions,
    activeMembers: memberResult.activeMembers.length,
    newMembers: memberResult.newMembers.length,
    withdrawnMembers: memberResult.withdrawnMembers.length,
    activeExposure: parseFloat(activeExposure.toFixed(2)),
    totalMarketExposure: parseFloat(totalMarketExposure.toFixed(2)),
    marketShare: parseFloat(marketShare.toFixed(4)),
    memberRetentionRate: parseFloat(memberResult.retentionRate.toFixed(3)),
    memberSatisfaction: memberResult.memberSatisfaction,
    averageRiskQuality: memberResult.averageRiskQuality,
    memberList: memberResult.activeMembers,
    rateLevel: parseFloat(newRateLevel.toFixed(2)),
    ratePer100: parseFloat(newRatePer100.toFixed(4)),
    purePremiumPer100: parseFloat(newPurePremiumPer100.toFixed(4)),
    purePremium: parseFloat(newPurePremiumPer100.toFixed(4)),
    writtenExposure: parseFloat(writtenExposure.toFixed(2)),
    grossPremium,
    assessments,
    dividends,
    grossUltimateLoss,
    shockLossIncurred: shockOccurred,
    reinsuranceCost,
    reinsuranceRecovery,
    netUltimateLoss,
    operatingExpense,
    riskControlInvestment,
    priorYearDevelopment,
    beginningGrossReserve,
    currentYearGrossReserve,
    grossPaidLosses: grossPaidCurrentYear + grossPaidThisYear,
    endingGrossReserve,
    beginningReinsRecoverable,
    endingReinsRecoverable,
    investmentReturnRate,
    investedAssets,
    investmentIncome,
    // Funding Target & Adequacy fields
    selectedFundingConfidenceLevel,
    selectedFundingCLF,
    expectedGrossUnpaidLoss,
    expectedReinsuranceRecoverable,
    expectedNetUnpaidLoss,
    grossFundingTarget,
    netFundingTarget,
    fundingMarginNeeded,
    availableFunding,
    fundingGap,
    fundingAdequacyRatio,
    fundingAdequacyStatus,
    // Legacy fields
    fundingCLF,
    fundingAdequacyIndicator,
    // Income & Balance Sheet
    netIncome,
    beginningCash,
    endingCash,
    beginningInvestments,
    endingInvestments,
    premiumsReceivable,
    otherAssets: poolState.otherAssets,
    totalAssets,
    unearnedPremium,
    otherLiabilities,
    totalLiabilities,
    beginingSurplus,
    endingSurplus,
    // Surplus rollforward validation
    surplusFromIncome,
    surplusTieOutDifference,
    // Ratios
    combinedRatio,
    lossRatio,
    expenseRatio,
    narrativeExplanation: '',
  };

  result.narrativeExplanation = generateNarrative(result, priorResult);

  const updatedPoolState: PoolState = {
    rateLevel: newRateLevel,
    ratePer100: newRatePer100,
    purePremiumPer100: newPurePremiumPer100,
    purePremium: newPurePremiumPer100,
    memberSatisfaction: memberResult.memberSatisfaction,
    averageRiskQuality: memberResult.averageRiskQuality,
    riskControlEffectiveness: newRCEffectiveness,
    reserveCohorts: allCohorts,
    members: memberResult.activeMembers,
    cash: endingCash,
    investments: endingInvestments,
    otherAssets: poolState.otherAssets,
    grossUnpaidReserve: endingGrossReserve,
    reinsuranceRecoverable: endingReinsRecoverable,
    unearnedPremium,
    otherLiabilities,
    surplus: endingSurplus,
    totalMarketExposure,
    allMarketMembers: updatedAllMembers,
  };

  return { updatedPoolState, result };
}

function processReserveDevelopment(
  cohorts: ReserveCohort[],
  rng: SeededRandom,
  priorFundingAdequacyRatio: number
): { developmentImpact: number; updatedCohorts: ReserveCohort[]; grossPaidThisYear: number; reinsReceivedThisYear: number } {
  let developmentImpact = 0;
  let grossPaidThisYear = 0;
  let reinsReceivedThisYear = 0;

  // Reserve development is affected by prior year funding adequacy.
  // When prior funding adequacy was low (underfunded pool), there's pressure
  // toward adverse development as claims may develop worse than expected.
  // When prior funding adequacy was high (well-funded pool), development
  // is more likely to be favorable or neutral.
  //
  // Effect: Each 0.10 below 1.0 funding adequacy shifts development 1% toward adverse.
  // Each 0.10 above 1.0 shifts development 0.5% toward favorable (more conservative).
  const fundingImpactOnDevelopment = (priorFundingAdequacyRatio - 1.0) * 0.05;

  const updatedCohorts = cohorts.filter(c => !c.closed).map(c => {
    // Base development factor range: 0.92 to 1.10
    // Factor < 1.0 = favorable (reserve released)
    // Factor > 1.0 = adverse (reserve strengthened)
    let devMin = 0.92 - fundingImpactOnDevelopment;
    let devMax = 1.10 - fundingImpactOnDevelopment;

    // Clamp to reasonable range
    devMin = Math.max(0.85, Math.min(1.05, devMin));
    devMax = Math.max(0.95, Math.min(1.20, devMax));

    const devFactor = rng.range(devMin, devMax);
    const devAdjustedUnpaid = c.grossUnpaid * devFactor;
    const devImpact = c.grossUnpaid - devAdjustedUnpaid;

    const paydown = devAdjustedUnpaid * c.paydownPct;
    grossPaidThisYear += paydown;

    const newUnpaid = devAdjustedUnpaid - paydown;

    // Calculate reinsurance received on this paydown
    // Use the ratio of reinsurance recoverable to gross unpaid for this cohort
    const reinsRatio = c.reinsuranceRecoverable / Math.max(c.grossUnpaid, 1);
    const reinsReceived = paydown * reinsRatio;
    reinsReceivedThisYear += reinsReceived;

    const newReinsRecoverable = newUnpaid * reinsRatio;

    developmentImpact += devImpact;

    return {
      ...c,
      grossUnpaid: Math.max(0, newUnpaid),
      grossPaid: c.grossPaid + paydown,
      reinsuranceRecoverable: Math.max(0, newReinsRecoverable),
      reinsuranceReceived: c.reinsuranceReceived + reinsReceived,
      closed: newUnpaid < 1000,
    };
  });

  return { developmentImpact, updatedCohorts, grossPaidThisYear, reinsReceivedThisYear };
}