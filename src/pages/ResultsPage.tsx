import React, { useState } from 'react';
import { ClipboardList, Zap, TrendingUp, Shield, DollarSign, AlertTriangle, Target } from 'lucide-react';
import type { ResultSet } from '../types/simulation';
import { formatCurrency, formatPct, colorForRatio, colorForNetIncome, colorForSurplus } from '../utils/formatters';
import { REINSURANCE_PROGRAMS } from '../data/defaultAssumptions';

interface ResultsPageProps {
  lockedResults: ResultSet[];
}

export default function ResultsPage({ lockedResults }: ResultsPageProps) {
  const [selectedYear, setSelectedYear] = useState<number>(
    lockedResults.length > 0 ? lockedResults[lockedResults.length - 1].yearNumber : 1
  );

  const result = lockedResults.find(r => r.yearNumber === selectedYear);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Annual Results</h2>
          <p className="text-gray-500 text-sm">Detailed breakdown for each completed year</p>
        </div>
        {lockedResults.length > 0 && (
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {lockedResults.map(r => (<option key={r.yearNumber} value={r.yearNumber}>Year {r.yearNumber} / {r.calendarYear}</option>))}
          </select>
        )}
      </div>

      {lockedResults.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium text-lg">No results yet</p>
          <p className="text-sm mt-1">Complete a year to see detailed results here.</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {result.shockLossIncurred && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-red-800">Shock Loss Event</p>
                <p className="text-red-700 text-sm">A significant shock loss occurred this year, materially increasing gross losses above expected levels.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ResultCard title="Decision Summary" icon={<ClipboardList size={16} />}>
              <Row label="Rate Change" value={formatPct(result.decisions.rateChange, 1)} valueColor={result.decisions.rateChange > 0 ? 'text-amber-600' : result.decisions.rateChange < 0 ? 'text-blue-600' : 'text-gray-700'} />
              <Row label="Funding Confidence Level" value={formatPct(result.decisions.fundingConfidenceLevel, 0)} />
              <Row label="Dividend / Return of Contribution" value={formatPct(result.decisions.dividendPct, 1)} />
              <Row label="Assessment" value={formatPct(result.decisions.assessmentPct, 1)} />
              <Row label="Underwriting Strictness" value={`${result.decisions.underwritingStrictness} / 10`} />
              <Row label="Risk Control Investment" value={formatPct(result.decisions.riskControlPct, 1)} />
              <Row label="Reinsurance Level" value={`${result.decisions.reinsuranceLevel} — ${REINSURANCE_PROGRAMS[result.decisions.reinsuranceLevel]?.label ?? ''}`} />
              <Row label="Investment Risk" value={`${result.decisions.investmentRisk} / 10`} />
            </ResultCard>

            <ResultCard title="Membership" icon={<TrendingUp size={16} />}>
              <Row label="Active Members" value={String(result.activeMembers)} />
              <Row label="New Members This Year" value={`+${result.newMembers}`} valueColor="text-emerald-600" />
              <Row label="Members Withdrawn" value={result.withdrawnMembers > 0 ? `-${result.withdrawnMembers}` : '0'} valueColor={result.withdrawnMembers > 0 ? 'text-red-600' : 'text-gray-700'} />
              <Row label="Member Retention Rate" value={formatPct(result.memberRetentionRate)} />
              <Row label="Member Satisfaction" value={`${result.memberSatisfaction.toFixed(1)} / 10`} />
              <Row label="Avg. Risk Quality" value={`${result.averageRiskQuality.toFixed(1)} / 10`} />
              <Row label="Payroll Exposure ($M)" value={`$${result.activeExposure.toFixed(2)}M`} />
              <Row label="Total Market Payroll ($M)" value={`$${result.totalMarketExposure.toFixed(2)}M`} />
              <Row label="Exposure-Based Market Share" value={formatPct(result.marketShare)} valueColor="text-sky-600" />
            </ResultCard>

            <ResultCard title="Premium & Losses" icon={<DollarSign size={16} />}>
              <Row label="Rate Level Index" value={result.rateLevel.toFixed(2)} />
              <Row label="Rate per $100 Payroll" value={`$${result.ratePer100.toFixed(2)}`} />
              <Row label="Pure Premium per $100 Payroll" value={`$${result.purePremiumPer100.toFixed(2)}`} />
              <Row label="Written Payroll ($M)" value={`$${result.writtenExposure.toFixed(2)}M`} />
              <Row label="Gross Premium / Contributions" value={formatCurrency(result.grossPremium)} />
              <Row label="Assessments" value={formatCurrency(result.assessments)} />
              <Row label="Dividends / Returned Contributions" value={formatCurrency(result.dividends)} valueColor="text-red-600" />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Gross Ultimate Loss + LAE" value={formatCurrency(result.grossUltimateLoss)} valueColor="text-red-600" />
              <Row label="Reinsurance Recovery" value={formatCurrency(result.reinsuranceRecovery)} valueColor="text-emerald-600" />
              <Row label="Net Ultimate Loss + LAE" value={formatCurrency(result.netUltimateLoss)} valueColor="text-red-600" />
            </ResultCard>

            <ResultCard title="Reserves & Development" icon={<Shield size={16} />}>
              <Row label="Operating Expense" value={formatCurrency(result.operatingExpense)} valueColor="text-red-600" />
              <Row label="Risk Control Investment" value={formatCurrency(result.riskControlInvestment)} valueColor="text-amber-600" />
              <Row label="Reinsurance Cost" value={formatCurrency(result.reinsuranceCost)} valueColor="text-red-600" />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Prior-Year Development" value={formatCurrency(result.priorYearDevelopment)} valueColor={result.priorYearDevelopment >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Row label="Beginning Gross Reserve" value={formatCurrency(result.beginningGrossReserve)} />
              <Row label="Ending Gross Reserve (Expected Unpaid)" value={formatCurrency(result.endingGrossReserve)} />
              <Row label="Ending Reins. Recoverable" value={formatCurrency(result.endingReinsRecoverable)} />
              <Row label="Net Unpaid Reserve" value={formatCurrency(result.expectedNetUnpaidLoss)} />
            </ResultCard>

            <ResultCard title="Investment & Income" icon={<Zap size={16} />}>
              <Row label="Invested Assets" value={formatCurrency(result.investedAssets)} />
              <Row label="Investment Return Rate" value={formatPct(result.investmentReturnRate)} valueColor={result.investmentReturnRate >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Row label="Investment Income" value={formatCurrency(result.investmentIncome)} valueColor={colorForNetIncome(result.investmentIncome)} />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Combined Ratio" value={formatPct(result.combinedRatio)} valueColor={colorForRatio(result.combinedRatio)} />
              <Row label="Loss Ratio (Net)" value={formatPct(result.lossRatio)} />
              <Row label="Expense Ratio" value={formatPct(result.expenseRatio)} />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Net Income" value={formatCurrency(result.netIncome)} valueColor={colorForNetIncome(result.netIncome)} />
            </ResultCard>

            {/* Net Equity / Surplus Rollforward */}
            <ResultCard title="Net Equity / Surplus Rollforward" icon={<DollarSign size={16} />}>
              <Row label="Beginning Surplus" value={formatCurrency(result.beginingSurplus)} />
              <Row label="Net Income" value={formatCurrency(result.netIncome)} valueColor={colorForNetIncome(result.netIncome)} />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Ending Surplus / Net Equity" value={formatCurrency(result.endingSurplus)} valueColor={colorForSurplus(result.endingSurplus)} bold />
              <p className="text-xs text-gray-400 mt-2">
                Balance check: {formatCurrency(result.totalAssets)} (Assets) - {formatCurrency(result.totalLiabilities)} (Liabilities) = {formatCurrency(result.endingSurplus)}
              </p>
            </ResultCard>

            {/* Funding Target & Adequacy */}
            <ResultCard title="Funding Target & Adequacy" icon={<Target size={16} />}>
              <Row label="Expected Net Unpaid Loss" value={formatCurrency(result.expectedNetUnpaidLoss)} />
              <Row label="Selected Funding Confidence" value={formatPct(result.selectedFundingConfidenceLevel, 0)} valueColor="text-blue-600" />
              <Row label="CLF Applied" value={result.selectedFundingCLF.toFixed(3)} />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Net Funding Target" value={formatCurrency(result.netFundingTarget)} valueColor="text-amber-600" />
              <Row label="Funding Margin Needed" value={formatCurrency(result.fundingMarginNeeded)} valueColor={result.fundingMarginNeeded > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              <div className="border-t border-gray-100 my-1" />
              <Row label="Available Funding (Surplus)" value={formatCurrency(result.availableFunding)} />
              <Row label="Funding Gap / Surplus" value={formatCurrency(result.fundingGap)} valueColor={result.fundingGap >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Row label="Funding Adequacy Ratio" value={result.fundingAdequacyRatio.toFixed(2)} />
              <Row label="Funding Adequacy Status" value={result.fundingAdequacyStatus} valueColor={
                result.fundingAdequacyStatus === 'Strong' ? 'text-emerald-600' :
                result.fundingAdequacyStatus === 'Adequate' ? 'text-emerald-600' :
                result.fundingAdequacyStatus === 'Thin' ? 'text-amber-600' :
                'text-red-600'
              } />
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Funding confidence level is used to evaluate funding adequacy, not to book the accounting reserve. Higher confidence requires more capital cushion.
              </p>
            </ResultCard>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">What Happened This Year</h3>
              </div>
              <div className="p-5">
                <p className="text-gray-700 text-sm leading-relaxed">{result.narrativeExplanation}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-5 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, valueColor = 'text-gray-800', bold = false }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold font-mono ${valueColor} text-right ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}