// Rule-based narrative explanation engine for Risk Pool Simulation v1

import type { ResultSet } from '../types/simulation';

export function generateNarrative(result: ResultSet, _priorResult?: ResultSet): string {
  const parts: string[] = [];

  const {
    decisions, combinedRatio, netIncome, grossUltimateLoss, grossPremium,
    reinsuranceRecovery, investmentIncome,
    newMembers, withdrawnMembers, shockLossIncurred,
    priorYearDevelopment, endingSurplus,
    premiumFundingRatio, premiumFundingAdequacyStatus,
    indicatedFundingRatePer100, actualRatePer100, rateFundingGapPer100,
    capitalAdequacyStatus, capitalAdequacyRatio,
  } = result;

  // --- Rate Change ---
  if (decisions.rateChange > 0.10) {
    parts.push(`A significant rate increase of ${pct(decisions.rateChange)} was applied, improving premium adequacy at the cost of competitive pressure on member retention.`);
  } else if (decisions.rateChange > 0.03) {
    parts.push(`A moderate rate increase of ${pct(decisions.rateChange)} was applied, helping maintain premium adequacy.`);
  } else if (decisions.rateChange < -0.05) {
    parts.push(`Rates were reduced by ${pct(Math.abs(decisions.rateChange))}, improving competitiveness but reducing the pool's ability to fund at the selected confidence level.`);
  } else if (Math.abs(decisions.rateChange) <= 0.03) {
    parts.push(`Rates were held roughly flat.`);
  }

  // --- Premium Funding Adequacy ---
  if (premiumFundingAdequacyStatus === 'Deficient') {
    parts.push(`The actual premium is ${pct(1 - premiumFundingRatio)} below the required funding premium at the selected confidence level, indicating the pool is underfunding relative to its target.`);
  } else if (premiumFundingAdequacyStatus === 'Thin') {
    parts.push(`Premium funding is thin — the actual premium covers ${pct(premiumFundingRatio)} of the required funding premium, leaving little margin at the selected confidence level.`);
  } else if (premiumFundingAdequacyStatus === 'Strong') {
    parts.push(`Premium funding is strong at ${pct(premiumFundingRatio)} of the required funding premium for the selected confidence level.`);
  }

  // --- Rate vs Indicated Funding Rate ---
  if (rateFundingGapPer100 < -0.50) {
    parts.push(`The actual rate of $${actualRatePer100.toFixed(2)} per $100 payroll is $${Math.abs(rateFundingGapPer100).toFixed(2)} below the indicated funding rate of $${indicatedFundingRatePer100.toFixed(2)}, meaning the rate is inadequate for the selected confidence level.`);
  } else if (rateFundingGapPer100 > 0.50) {
    parts.push(`The actual rate of $${actualRatePer100.toFixed(2)} per $100 payroll exceeds the indicated funding rate of $${indicatedFundingRatePer100.toFixed(2)} by $${rateFundingGapPer100.toFixed(2)}, providing a pricing cushion above the selected confidence level.`);
  }

  // --- Underwriting ---
  if (decisions.underwritingStrictness <= 2) {
    parts.push(`Flexible underwriting standards kept the pool accessible for growth, but increase adverse selection risk.`);
  } else if (decisions.underwritingStrictness >= 8) {
    parts.push(`Strict underwriting improved average risk quality, reducing expected losses and tail risk.`);
  }

  // --- Shock Loss ---
  if (shockLossIncurred) {
    parts.push(`A shock loss event occurred this year, significantly increasing gross losses above expected.`);
  }

  // --- Loss Performance ---
  const lossRatio = grossUltimateLoss / Math.max(grossPremium, 1);
  if (lossRatio > 0.90) {
    parts.push(`Gross loss performance was unfavorable with a loss ratio of ${pct(lossRatio)}.`);
  } else if (lossRatio < 0.55) {
    parts.push(`Gross loss performance was strong with a favorable loss ratio of ${pct(lossRatio)}.`);
  }

  // --- Combined Ratio ---
  if (combinedRatio > 1.10) {
    parts.push(`The combined ratio was ${pct(combinedRatio)}, indicating an underwriting loss.`);
  } else if (combinedRatio < 0.90) {
    parts.push(`An excellent combined ratio of ${pct(combinedRatio)} reflects strong underwriting performance.`);
  }

  // --- Reinsurance ---
  if (decisions.reinsuranceLevel === 0) {
    parts.push(`No reinsurance protection was in place.`);
  } else if (reinsuranceRecovery > 0) {
    parts.push(`Reinsurance generated $${fmt(reinsuranceRecovery)} in recoveries, reducing net retained losses.`);
  } else if (decisions.reinsuranceLevel > 0) {
    parts.push(`Reinsurance was in place but losses did not reach the attachment point.`);
  }

  // --- Investment ---
  if (decisions.investmentRisk >= 7) {
    if (investmentIncome > 0) {
      parts.push(`Aggressive investment positioning generated strong investment income of $${fmt(investmentIncome)}.`);
    } else {
      parts.push(`Aggressive investment positioning resulted in an investment loss.`);
    }
  } else if (decisions.investmentRisk <= 2) {
    parts.push(`Conservative investment strategy produced modest but stable investment income of $${fmt(investmentIncome)}.`);
  }

  // --- Membership ---
  if (newMembers > 3) {
    parts.push(`${newMembers} new members joined the pool this year.`);
  }
  if (withdrawnMembers > 3) {
    parts.push(`${withdrawnMembers} members withdrew from the pool.`);
  }

  // --- Capital / Surplus Cushion ---
  if (capitalAdequacyStatus === 'Deficient') {
    parts.push(`The capital cushion is rated Deficient (ratio: ${capitalAdequacyRatio.toFixed(2)}), meaning available surplus falls short of the CLF-loaded unpaid loss target. Note: the CLF does not directly reduce accounting surplus — this reflects a surplus shortfall relative to the funding confidence target.`);
  } else if (capitalAdequacyStatus === 'Thin') {
    parts.push(`The capital cushion is rated Thin (ratio: ${capitalAdequacyRatio.toFixed(2)}), with modest surplus above the CLF-loaded unpaid loss target.`);
  } else if (capitalAdequacyStatus === 'Strong') {
    parts.push(`The capital cushion is Strong (ratio: ${capitalAdequacyRatio.toFixed(2)}), with ample surplus relative to the CLF-loaded unpaid loss target.`);
  }

  // --- Prior Year Development ---
  if (Math.abs(priorYearDevelopment) > 10000) {
    if (priorYearDevelopment > 0) {
      parts.push(`Prior year reserves developed favorably, releasing $${fmt(priorYearDevelopment)} to income.`);
    } else {
      parts.push(`Prior year reserves developed adversely, requiring $${fmt(Math.abs(priorYearDevelopment))} of reserve strengthening.`);
    }
  }

  // --- Net outcome ---
  if (netIncome > 0) {
    parts.push(`Overall, the pool generated net income of $${fmt(netIncome)}, strengthening surplus to $${fmt(endingSurplus)}.`);
  } else {
    parts.push(`Overall, the pool experienced a net loss of $${fmt(Math.abs(netIncome))}, reducing surplus to $${fmt(endingSurplus)}.`);
  }

  return parts.join(' ');
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
