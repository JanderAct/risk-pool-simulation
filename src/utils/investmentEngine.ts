// Investment engine for Risk Pool Simulation v1

import { SeededRandom } from './random';
import { INVESTMENT_RISK_PARAMS } from '../data/defaultAssumptions';

export interface InvestmentResult {
  returnRate: number;
  income: number;
  isShockYear: boolean;
}

// Simulate investment return for a given year
export function simulateInvestmentReturn(
  investedAssets: number,
  investmentRisk: number,
  instanceBaseReturn: number,
  instanceVolatility: number,
  instanceDownsideRisk: number,
  rng: SeededRandom,
): InvestmentResult {
  const level = Math.max(0, Math.min(10, investmentRisk));

  const playerBaseReturn = INVESTMENT_RISK_PARAMS.baseReturnByLevel[level];
  const playerVolatility = INVESTMENT_RISK_PARAMS.volatilityByLevel[level];
  const playerDownsideProb = INVESTMENT_RISK_PARAMS.downsideShockProbByLevel[level];

  const effectiveBaseReturn = playerBaseReturn * 0.60 + instanceBaseReturn * 0.40;
  const effectiveVolatility = playerVolatility * 0.60 + instanceVolatility * 0.40;
  const effectiveDownsideProb = playerDownsideProb * 0.60 + instanceDownsideRisk * 0.40;

  const isShockYear = rng.chance(effectiveDownsideProb);

  let returnRate: number;
  if (isShockYear) {
    returnRate = rng.normal(-effectiveBaseReturn * 0.5, effectiveVolatility * 1.5);
  } else {
    returnRate = rng.normal(effectiveBaseReturn, effectiveVolatility);
  }

  returnRate = Math.max(-0.30, Math.min(0.25, returnRate));
  const income = investedAssets * returnRate;

  return { returnRate, income, isShockYear };
}