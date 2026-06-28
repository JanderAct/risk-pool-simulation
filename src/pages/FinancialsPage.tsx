import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { ResultSet, StartingFinancials } from '../types/simulation';
import { deriveAnnualStatement, deriveStartingStatement } from '../utils/financialStatementEngine';
import { formatCurrency, formatPct, colorForRatio, colorForNetIncome } from '../utils/formatters';

interface FinancialsPageProps {
  lockedResults: ResultSet[];
  startingFinancials: StartingFinancials;
  startingYear: number;
}

export default function FinancialsPage({ lockedResults, startingFinancials, startingYear }: FinancialsPageProps) {
  const [selectedIdx, setSelectedIdx] = useState<'start' | number>('start');

  const yearOptions: { label: string; value: 'start' | number }[] = [
    { label: `Starting Statement — ${startingYear}`, value: 'start' },
    ...lockedResults.map(r => ({ label: `Year ${r.yearNumber} / ${r.calendarYear}`, value: r.yearNumber })),
  ];

  const isStart = selectedIdx === 'start';
  const selectedResult = isStart ? null : lockedResults.find(r => r.yearNumber === selectedIdx);
  const statement = selectedResult ? deriveAnnualStatement(selectedResult) : null;
  const startStatement = isStart ? deriveStartingStatement(startingFinancials) : null;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Financial Statements</h2>
          <p className="text-gray-500 text-sm">Select a year to view the full statement</p>
        </div>
        <select value={String(selectedIdx)} onChange={e => setSelectedIdx(e.target.value === 'start' ? 'start' : parseInt(e.target.value))} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {yearOptions.map(opt => (<option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>))}
        </select>
      </div>

      {isStart && startStatement && (
        <div className="space-y-5">
          <SectionHeader title={`Starting Financial Statement — ${startingYear}`} subtitle="Opening position before any player decisions" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StatementCard title="Opening Balance Sheet">
              <BSLine label="Cash & Cash Equivalents" value={formatCurrency(startStatement.cash)} />
              <BSLine label="Investments" value={formatCurrency(startStatement.investments)} />
              <BSLine label="Contributions Receivable" value={formatCurrency(startStatement.premiumsReceivable)} />
              <BSLine label="Reinsurance Recoverable on Unpaid Losses" value={formatCurrency(startStatement.reinsuranceRecoverable)} />
              <BSLine label="Other Assets" value={formatCurrency(startStatement.otherAssets)} />
              <BSLine label="Total Assets" value={formatCurrency(startStatement.totalAssets)} bold />
              <div className="border-t border-gray-200 my-2" />
              <BSLine label="Gross Unpaid Loss and LAE Reserve" value={formatCurrency(startStatement.grossUnpaidReserve)} />
              <BSLine label="Unearned Contributions" value={formatCurrency(startStatement.unearnedPremium)} />
              <BSLine label="Other Liabilities" value={formatCurrency(startStatement.otherLiabilities)} />
              <BSLine label="Total Liabilities" value={formatCurrency(startStatement.totalLiabilities)} bold />
              <div className="border-t border-gray-200 my-2" />
              <BSLine label="Net Equity / Surplus" value={formatCurrency(startStatement.surplus)} bold highlight />
            </StatementCard>
            <StatementCard title="Starting Operating Metrics">
              <MetricRow label="Active Members" value={String(startStatement.operatingMetrics.activeMembers)} />
              <MetricRow label="Payroll Exposure ($M)" value={`$${startStatement.operatingMetrics.activeExposure.toFixed(2)}M`} />
              <MetricRow label="Total Market Payroll Exposure ($M)" value={`$${startStatement.operatingMetrics.totalMarketExposure.toFixed(2)}M`} />
              <MetricRow label="Exposure-Based Market Share" value={formatPct(startStatement.operatingMetrics.marketShare)} />
              <MetricRow label="Rate Level Index" value={`${startStatement.operatingMetrics.rateLevel.toFixed(1)}`} />
              <MetricRow label="Rate per $100 Payroll" value={`$${startStatement.operatingMetrics.ratePer100.toFixed(2)}`} />
              <MetricRow label="Pure Premium per $100 Payroll" value={`$${startStatement.operatingMetrics.purePremiumPer100.toFixed(2)}`} />
              <MetricRow label="Annual Premium / Contributions" value={formatCurrency(startStatement.operatingMetrics.annualPremium)} />
              <MetricRow label="Expected Loss Ratio" value={formatPct(startStatement.operatingMetrics.expectedLossRatio)} />
              <MetricRow label="Member Satisfaction" value={`${startStatement.operatingMetrics.memberSatisfaction.toFixed(1)} / 10`} />
              <MetricRow label="Risk Quality" value={`${startStatement.operatingMetrics.riskQuality.toFixed(1)} / 10`} />
              <MetricRow label="Surplus to Premium Ratio" value={formatPct(startStatement.operatingMetrics.surplusToPremiumRatio)} />
            </StatementCard>
          </div>
        </div>
      )}

      {!isStart && statement && selectedResult && (
        <div className="space-y-5">
          <SectionHeader title={`Financial Statements — Year ${statement.yearNumber} / ${statement.calendarYear}`} subtitle={`Locked results for Year ${statement.yearNumber}`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StatementCard title="Income Statement">
              <ISLine label="Gross Premium / Contributions" value={formatCurrency(statement.incomeStatement.grossPremium)} />
              <ISLine label="Assessments" value={formatCurrency(statement.incomeStatement.assessments)} />
              <ISLine label="Investment Income" value={formatCurrency(statement.incomeStatement.investmentIncome)} valueColor={statement.incomeStatement.investmentIncome >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <ISLine label="Total Revenue" value={formatCurrency(statement.incomeStatement.totalRevenue)} bold />
              <div className="border-t border-gray-200 my-2" />
              <ISLine label="Net Ultimate Loss + LAE" value={`(${formatCurrency(statement.incomeStatement.netUltimateLoss)})`} valueColor="text-red-600" />
              <ISLine label="Operating Expense" value={`(${formatCurrency(statement.incomeStatement.operatingExpense)})`} valueColor="text-red-600" />
              <ISLine label="Risk Control Investment" value={`(${formatCurrency(statement.incomeStatement.riskControlInvestment)})`} valueColor="text-red-600" />
              <ISLine label="Reinsurance Cost" value={`(${formatCurrency(statement.incomeStatement.reinsuranceCost)})`} valueColor="text-red-600" />
              <ISLine label="Dividends / Returned Contributions" value={`(${formatCurrency(selectedResult.dividends)})`} valueColor="text-red-600" />
              <ISLine label="Prior-Year Development (Favorable)" value={formatCurrency(statement.incomeStatement.priorYearDevelopment)} valueColor={statement.incomeStatement.priorYearDevelopment >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <div className="border-t border-gray-200 my-2" />
              <ISLine label="Net Income" value={formatCurrency(statement.incomeStatement.netIncome)} bold valueColor={colorForNetIncome(statement.incomeStatement.netIncome)} />
            </StatementCard>
            <StatementCard title="Ending Balance Sheet">
              <BSLine label="Cash & Cash Equivalents" value={formatCurrency(statement.balanceSheet.cash)} />
              <BSLine label="Investments" value={formatCurrency(statement.balanceSheet.investments)} />
              <BSLine label="Contributions Receivable" value={formatCurrency(statement.balanceSheet.premiumsReceivable)} />
              <BSLine label="Reinsurance Recoverable on Unpaid Losses" value={formatCurrency(statement.balanceSheet.reinsuranceRecoverable)} />
              <BSLine label="Other Assets" value={formatCurrency(statement.balanceSheet.otherAssets)} />
              <BSLine label="Total Assets" value={formatCurrency(statement.balanceSheet.totalAssets)} bold />
              <div className="border-t border-gray-200 my-2" />
              <BSLine label="Gross Unpaid Loss and LAE Reserve" value={formatCurrency(statement.balanceSheet.grossUnpaidReserve)} />
              <BSLine label="Unearned Contributions" value={formatCurrency(statement.balanceSheet.unearnedPremium)} />
              <BSLine label="Other Liabilities" value={formatCurrency(statement.balanceSheet.otherLiabilities)} />
              <BSLine label="Total Liabilities" value={formatCurrency(statement.balanceSheet.totalLiabilities)} bold />
              <div className="border-t border-gray-200 my-2" />
              <BSLine label="Net Equity / Surplus" value={formatCurrency(statement.balanceSheet.surplus)} bold highlight valueColor={statement.balanceSheet.surplus >= 0 ? 'text-emerald-700' : 'text-red-700'} />
              <p className="text-xs text-gray-400 mt-2">Balance check: Assets ({formatCurrency(statement.balanceSheet.totalAssets)}) − Liabilities ({formatCurrency(statement.balanceSheet.totalLiabilities)}) = {formatCurrency(statement.balanceSheet.surplus)}</p>
            </StatementCard>
            <StatementCard title="Net Equity / Surplus Rollforward">
              <BSLine label="Beginning Net Equity / Surplus" value={formatCurrency(statement.surplusRollforward.beginingSurplus)} />
              <BSLine label="Net Income" value={formatCurrency(statement.surplusRollforward.netIncome)} valueColor={colorForNetIncome(statement.surplusRollforward.netIncome)} />
              <div className="border-t border-gray-200 my-2" />
              <BSLine label="Ending Net Equity / Surplus" value={formatCurrency(statement.surplusRollforward.endingSurplus)} bold highlight valueColor={statement.surplusRollforward.endingSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'} />
              <div className="text-xs text-gray-500 mt-2">Change: {formatCurrency(statement.surplusRollforward.change)} ({formatPct(statement.surplusRollforward.changePct)})</div>
            </StatementCard>
            <StatementCard title="Reinsurance Detail">
              <MetricRow label="Protection Level" value={`${statement.reinsuranceDetail.level} — ${statement.reinsuranceDetail.levelLabel}`} />
              <MetricRow label="Reinsurance Cost" value={formatCurrency(statement.reinsuranceDetail.reinsuranceCost)} />
              <MetricRow label="Gross Ultimate Loss + LAE" value={formatCurrency(statement.reinsuranceDetail.grossLoss)} />
              <MetricRow label="Reinsurance Recovery" value={formatCurrency(statement.reinsuranceDetail.reinsuranceRecovery)} />
              <MetricRow label="Net Ultimate Loss + LAE" value={formatCurrency(statement.reinsuranceDetail.netLoss)} />
              <MetricRow label="Cession Ratio" value={formatPct(statement.reinsuranceDetail.cessionRatio)} />
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2">Reinsurance recovery reduces net retained losses but does not reduce gross losses.</p>
            </StatementCard>
            <StatementCard title="Key Ratios">
              <MetricRow label="Payroll Exposure ($M)" value={`$${statement.keyRatios.activeExposure.toFixed(2)}M`} />
              <MetricRow label="Rate per $100 Payroll" value={`$${statement.keyRatios.ratePer100.toFixed(2)}`} />
              <MetricRow label="Pure Premium per $100 Payroll" value={`$${statement.keyRatios.purePremiumPer100.toFixed(2)}`} />
              <div className="border-t border-gray-100 my-2" />
              <MetricRow label="Gross Loss Ratio" value={formatPct(statement.keyRatios.lossRatio)} />
              <MetricRow label="Net Loss Ratio" value={formatPct(statement.keyRatios.netLossRatio)} />
              <MetricRow label="Expense Ratio" value={formatPct(statement.keyRatios.expenseRatio)} />
              <MetricRow label="Combined Ratio" value={formatPct(statement.keyRatios.combinedRatio)} valueColor={colorForRatio(statement.keyRatios.combinedRatio)} />
              <MetricRow label="Investment Return" value={formatPct(statement.keyRatios.investmentReturnRate)} valueColor={statement.keyRatios.investmentReturnRate >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <MetricRow label="Operating Ratio" value={formatPct(statement.keyRatios.operatingRatio)} />
              <div className="border-t border-gray-100 my-2" />
              <MetricRow label="Surplus to Premium Ratio" value={formatPct(statement.keyRatios.surplusToPremiumRatio)} />
              <MetricRow label="Market Share" value={formatPct(statement.keyRatios.marketShare)} />
              <MetricRow label="Member Retention Rate" value={formatPct(statement.keyRatios.memberRetentionRate)} />
              <MetricRow label="Funding Adequacy" value={statement.keyRatios.fundingAdequacyIndicator} valueColor={statement.keyRatios.fundingAdequacyIndicator === 'Adequate' ? 'text-emerald-600' : statement.keyRatios.fundingAdequacyIndicator === 'Marginal' ? 'text-amber-600' : 'text-red-600'} />
            </StatementCard>
          </div>
        </div>
      )}

      {!isStart && !selectedResult && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No statement available. Lock a year to generate statements.</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
        <FileText size={18} className="text-blue-600" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="text-gray-500 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function StatementCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-gray-50/60 border-b border-gray-200">
        <h4 className="font-bold text-gray-800 text-sm">{title}</h4>
      </div>
      <div className="p-5 space-y-1.5">{children}</div>
    </div>
  );
}

function BSLine({ label, value, bold, highlight, valueColor = 'text-gray-800' }: { label: string; value: string; bold?: boolean; highlight?: boolean; valueColor?: string }) {
  return (
    <div className={`flex justify-between items-baseline gap-2 ${highlight ? 'bg-blue-50 -mx-2 px-2 py-1 rounded' : ''}`}>
      <span className={`text-sm text-gray-600 ${bold ? 'font-semibold text-gray-800' : ''}`}>{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold' : 'font-medium'} ${valueColor} text-right`}>{value}</span>
    </div>
  );
}

function ISLine({ label, value, bold, valueColor = 'text-gray-800' }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return BSLine({ label, value, bold, valueColor });
}

function MetricRow({ label, value, valueColor = 'text-gray-800' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center gap-2 py-0.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}