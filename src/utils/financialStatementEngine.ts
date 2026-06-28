// Financial Statement engine for Risk Pool Simulation v1

import type { ResultSet, StartingFinancials } from '../types/simulation';

export interface IncomeStatement {
  grossPremium: number;
  assessments: number;
  totalRevenue: number;
  netUltimateLoss: number;
  operatingExpense: number;
  riskControlInvestment: number;
  reinsuranceCost: number;
  priorYearDevelopment: number;
  totalUnderwritingExpense: number;
  underwritingResult: number;
  investmentIncome: number;
  netIncome: number;
}

export interface BalanceSheet {
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
}

export interface SurplusRollforward {
  beginingSurplus: number;
  netIncome: number;
  endingSurplus: number;
  change: number;
  changePct: number;
}

export interface ReinsuranceDetail {
  level: number;
  levelLabel: string;
  attachment: number;
  limit: number;
  recoveryPct: number;
  reinsuranceCost: number;
  grossLoss: number;
  reinsuranceRecovery: number;
  netLoss: number;
  cessionRatio: number;
}

export interface ReserveDetail {
  beginningGrossReserve: number;
  currentYearUltimate: number;
  grossPaidLosses: number;
  priorYearDevelopment: number;
  endingGrossReserve: number;
  beginningReinsRecoverable: number;
  currentYearReinsRecovery: number;
  reinsReceived: number;
  endingReinsRecoverable: number;
  netUnpaidReserve: number;
}

export interface KeyRatios {
  lossRatio: number;
  netLossRatio: number;
  expenseRatio: number;
  combinedRatio: number;
  investmentReturnRate: number;
  operatingRatio: number;
  surplusToPremiumRatio: number;
  marketShare: number;
  memberRetentionRate: number;
  fundingAdequacyIndicator: string;
  ratePer100: number;
  purePremiumPer100: number;
  activeExposure: number;
}

export interface AnnualFinancialStatement {
  yearNumber: number;
  calendarYear: number;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  surplusRollforward: SurplusRollforward;
  reinsuranceDetail: ReinsuranceDetail;
  reserveDetail: ReserveDetail;
  keyRatios: KeyRatios;
}

export function deriveAnnualStatement(result: ResultSet): AnnualFinancialStatement {
  const incomeStatement: IncomeStatement = {
    grossPremium: result.grossPremium,
    assessments: result.assessments,
    totalRevenue: result.grossPremium + result.assessments + result.investmentIncome,
    netUltimateLoss: result.netUltimateLoss,
    operatingExpense: result.operatingExpense,
    riskControlInvestment: result.riskControlInvestment,
    reinsuranceCost: result.reinsuranceCost,
    priorYearDevelopment: result.priorYearDevelopment,
    totalUnderwritingExpense: result.netUltimateLoss + result.operatingExpense + result.riskControlInvestment + result.reinsuranceCost,
    underwritingResult: result.grossPremium - result.netUltimateLoss - result.operatingExpense - result.riskControlInvestment - result.reinsuranceCost,
    investmentIncome: result.investmentIncome,
    netIncome: result.netIncome,
  };

  const balanceSheet: BalanceSheet = {
    cash: result.endingCash,
    investments: result.endingInvestments,
    premiumsReceivable: result.premiumsReceivable,
    reinsuranceRecoverable: result.endingReinsRecoverable,
    otherAssets: result.otherAssets,
    totalAssets: result.totalAssets,
    grossUnpaidReserve: result.endingGrossReserve,
    unearnedPremium: result.unearnedPremium,
    otherLiabilities: result.otherLiabilities,
    totalLiabilities: result.totalLiabilities,
    surplus: result.endingSurplus,
  };

  const surplusRollforward: SurplusRollforward = {
    beginingSurplus: result.beginingSurplus,
    netIncome: result.netIncome,
    endingSurplus: result.endingSurplus,
    change: result.endingSurplus - result.beginingSurplus,
    changePct: (result.endingSurplus - result.beginingSurplus) / Math.max(Math.abs(result.beginingSurplus), 1),
  };

  const reinsLabels = ['None', 'Low', 'Moderate', 'High', 'Full Transfer'];
  const reinsLevel = result.decisions.reinsuranceLevel;

  const reinsuranceDetail: ReinsuranceDetail = {
    level: reinsLevel,
    levelLabel: reinsLabels[reinsLevel] ?? 'Unknown',
    attachment: 0,
    limit: 0,
    recoveryPct: 0,
    reinsuranceCost: result.reinsuranceCost,
    grossLoss: result.grossUltimateLoss,
    reinsuranceRecovery: result.reinsuranceRecovery,
    netLoss: result.netUltimateLoss,
    cessionRatio: result.reinsuranceRecovery / Math.max(result.grossUltimateLoss, 1),
  };

  const reserveDetail: ReserveDetail = {
    beginningGrossReserve: result.beginningGrossReserve,
    currentYearUltimate: result.grossUltimateLoss,
    grossPaidLosses: result.grossPaidLosses,
    priorYearDevelopment: result.priorYearDevelopment,
    endingGrossReserve: result.endingGrossReserve,
    beginningReinsRecoverable: result.beginningReinsRecoverable,
    currentYearReinsRecovery: result.reinsuranceRecovery,
    reinsReceived: result.reinsuranceRecovery * 0.40,
    endingReinsRecoverable: result.endingReinsRecoverable,
    netUnpaidReserve: result.endingGrossReserve - result.endingReinsRecoverable,
  };

  const keyRatios: KeyRatios = {
    lossRatio: result.grossUltimateLoss / Math.max(result.grossPremium, 1),
    netLossRatio: result.lossRatio,
    expenseRatio: result.expenseRatio,
    combinedRatio: result.combinedRatio,
    investmentReturnRate: result.investmentReturnRate,
    operatingRatio: result.combinedRatio - result.investmentReturnRate,
    surplusToPremiumRatio: result.endingSurplus / Math.max(result.grossPremium, 1),
    marketShare: result.marketShare,
    memberRetentionRate: result.memberRetentionRate,
    fundingAdequacyIndicator: result.fundingAdequacyIndicator,
    ratePer100: result.ratePer100,
    purePremiumPer100: result.purePremiumPer100,
    activeExposure: result.activeExposure,
  };

  return { yearNumber: result.yearNumber, calendarYear: result.calendarYear, incomeStatement, balanceSheet, surplusRollforward, reinsuranceDetail, reserveDetail, keyRatios };
}

export function deriveStartingStatement(sf: StartingFinancials): BalanceSheet & { operatingMetrics: { activeMembers: number; activeExposure: number; totalMarketExposure: number; marketShare: number; rateLevel: number; ratePer100: number; purePremiumPer100: number; purePremium: number; memberSatisfaction: number; riskQuality: number; surplusToPremiumRatio: number; annualPremium: number; expectedLossRatio: number } } {
  return {
    cash: sf.cash,
    investments: sf.investments,
    premiumsReceivable: sf.premiumsReceivable,
    reinsuranceRecoverable: sf.reinsuranceRecoverable,
    otherAssets: sf.otherAssets,
    totalAssets: sf.totalAssets,
    grossUnpaidReserve: sf.grossUnpaidReserve,
    unearnedPremium: sf.unearnedPremium,
    otherLiabilities: sf.otherLiabilities,
    totalLiabilities: sf.totalLiabilities,
    surplus: sf.surplus,
    operatingMetrics: {
      activeMembers: sf.activeMembers,
      activeExposure: sf.activeExposure,
      totalMarketExposure: sf.totalMarketExposure,
      marketShare: sf.marketShare,
      rateLevel: sf.rateLevel,
      ratePer100: sf.ratePer100,
      purePremiumPer100: sf.purePremiumPer100,
      purePremium: sf.purePremium,
      memberSatisfaction: sf.memberSatisfaction,
      riskQuality: sf.riskQuality,
      surplusToPremiumRatio: sf.surplusToPremiumRatio,
      annualPremium: sf.annualPremium,
      expectedLossRatio: sf.expectedLossRatio,
    },
  };
}