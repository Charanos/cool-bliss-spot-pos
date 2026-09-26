'use client';

import { useState } from 'react';
import { ZERO, formatDecimal, formatKes, type Cents } from '@bliss/shared/money';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBuildingStore,
  IconClock,
  IconFlame,
  IconInfoCircle,
  IconReceipt2,
  IconScale,
  IconShieldCheck,
  IconTrendingUp,
  IconTruck,
  IconUsers,
  IconDeviceTablet,
  IconCash,
  IconLayoutDashboard,
} from '@tabler/icons-react';
import type { DynamicsPnlReport } from '@/modules/reporting/dynamics';
import Link from 'next/link';
import { Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney } from '@bliss/ui/components/money';

export function DynamicsDashboard({ report }: { report: DynamicsPnlReport }) {
  const [activeTab, setActiveTab] = useState<'pnl' | 'questions' | 'sku'>('pnl');

  const filterOptions: { key: 'today' | 'last_night' | 'week' | 'month'; label: string }[] = [
    { key: 'today', label: 'Today (Live)' },
    { key: 'last_night', label: 'Last Night' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  const totalChannelSales =
    Number(report.channels.barCents) +
    Number(report.channels.tableCents) +
    Number(report.channels.vipCents) || 1;

  const totalTenders =
    Number(report.tenders.cashCents) +
    Number(report.tenders.mpesaCents) +
    Number(report.tenders.cardCents) || 1;

  return (
    <div className="flex flex-col gap-24 pb-56 font-sans max-w-[1400px] mx-auto w-full">
      {/* ── Control Deck: Period Filter + View Switcher (Polished Pill Toolbar) ── */}
      <div className="flex flex-col gap-16 tablet:flex-row tablet:items-center tablet:justify-between bg-page p-12 tablet:p-12 rounded-2xl border border-hairline/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-sm">
        {/* Period Chips (Tactile Segmented Bar) */}
        <div className="flex items-center gap-8 overflow-x-auto py-2 tablet:py-0">
          <span className="text-micro font-medium uppercase tracking-[0.12em] text-ink-subtle ml-6 mr-2 shrink-0">
            Period
          </span>
          <div className="inline-flex items-center gap-2 rounded-full bg-sunken/80 p-[3px] rounded-dot shrink-0">
            {filterOptions.map((opt) => {
              const isSelected = report.filterMode === opt.key;
              return (
                <Link
                  key={opt.key}
                  href={`/console/reports/dynamics?filter=${opt.key}`}
                  className={`inline-flex items-center px-12 py-6 rounded-full text-body-sm transition-all duration-150 press-feedback ${
                    isSelected
                      ? 'bg-raised text-ink font-medium shadow-raised ring-1 ring-hairline/60'
                      : 'text-ink-muted hover:text-ink hover:bg-control/40 font-medium'
                  }`}
                >
                  {opt.label}
                  {opt.key === 'today' && report.isLiveTrading ? (
                    <span className="size-6 rounded-full bg-poured ml-6 animate-pulse" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {/* View Switcher: P&L Statement | 4 Owner Questions | SKU Quadrants */}
        <div className="inline-flex items-center gap-2 rounded-full bg-sunken/80 p-[3px] rounded-dot self-start tablet:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pnl')}
            className={`inline-flex items-center gap-6 px-16 py-6 rounded-full text-body-sm transition-all duration-150 press-feedback ${
              activeTab === 'pnl'
                ? 'bg-raised text-ink font-medium shadow-raised ring-1 ring-hairline/60'
                : 'text-ink-muted hover:text-ink hover:bg-control/40 font-medium'
            }`}
          >
            <IconScale size={15} stroke={1.75} className={activeTab === 'pnl' ? 'text-accent' : 'text-ink-muted'} />
            <span>P&L Statement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`inline-flex items-center gap-6 px-16 py-6 rounded-full text-body-sm transition-all duration-150 press-feedback ${
              activeTab === 'questions'
                ? 'bg-raised text-ink font-medium shadow-raised ring-1 ring-hairline/60'
                : 'text-ink-muted hover:text-ink hover:bg-control/40 font-medium'
            }`}
          >
            <IconFlame size={15} stroke={1.75} className={activeTab === 'questions' ? 'text-attention' : 'text-ink-muted'} />
            <span>4 Owner Questions</span>
            {report.ownerQuestions.unclosedTabsCount > 0 ? (
              <span className="size-6 rounded-full bg-attention animate-pulse" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sku')}
            className={`inline-flex items-center gap-6 px-16 py-6 rounded-full text-body-sm transition-all duration-150 press-feedback ${
              activeTab === 'sku'
                ? 'bg-raised text-ink font-medium shadow-raised ring-1 ring-hairline/60'
                : 'text-ink-muted hover:text-ink hover:bg-control/40 font-medium'
            }`}
          >
            <IconLayoutDashboard size={15} stroke={1.75} className={activeTab === 'sku' ? 'text-accent' : 'text-ink-muted'} />
            <span>SKU Quadrants</span>
          </button>
        </div>
      </div>

            {/* ── Executive Headline Bento Strip (4 Core Financial Columns) ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 desktop:grid-cols-4 gap-16">
        <Metric
          label="Net Sales"
          icon={IconReceipt2}
          tone="default"
          value={<AnimatedMoney value={report.netSalesCents} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
          badge={<span className="text-[10px] font-medium uppercase tracking-wider px-6 py-2 rounded bg-control text-ink-subtle">Revenue</span>}
          detail={
            <span className="flex justify-between w-full">
              <span>Gross: {formatKes(report.grossSalesCents, { decimals: 'whole' })}</span>
              <span className="text-[11px] text-ink-muted ml-auto">Comps: -{formatKes(report.compsCents, { decimals: 'whole' })}</span>
            </span>
          }
        />

        <Metric
          label="Real COGS"
          icon={IconBuildingStore}
          tone="attention"
          value={<AnimatedMoney value={report.cogs.realCogsCents} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" tone="attention" />}
          badge={<span className="text-[10px] font-medium uppercase tracking-wider px-6 py-2 rounded bg-control/20 text-attention">Theoretical + Var</span>}
          detail={
            <span className="flex justify-between w-full">
              <span>{((Number(report.cogs.realCogsCents) / Number(report.netSalesCents || 1n)) * 100).toFixed(1)}% of sales</span>
              <span className="text-[11px] text-attention font-medium ml-auto">+{formatKes(report.cogs.varianceShrinkageCents, { decimals: 'whole' })} shrink</span>
            </span>
          }
        />

        <Metric
          label="Gross Profit"
          icon={IconTrendingUp}
          tone="poured"
          value={<AnimatedMoney value={report.grossProfitCents} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" tone="poured" />}
          badge={<span className="text-[10px] font-medium uppercase tracking-wider px-6 py-2 rounded bg-poured-wash text-poured">{report.grossMarginPct.toFixed(1)}% Margin</span>}
          detail={
            <span className="flex justify-between w-full">
              <span>Sales minus Real COGS</span>
              <span className="text-[11px] text-poured font-medium ml-auto">After drink recipes</span>
            </span>
          }
        />

        <Metric
          label="Operating EBITDA"
          icon={IconFlame}
          tone="poured"
          value={<AnimatedMoney value={report.ebitdaCents} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
          badge={<span className="text-[10px] font-medium uppercase tracking-wider px-6 py-2 rounded bg-poured-wash text-poured">{report.ebitdaMarginPct.toFixed(1)}% Margin</span>}
          detail={
            <span className="flex justify-between w-full">
              <span>Net Operating Bottom Line</span>
              <span className="text-[11px] text-ink font-medium ml-auto">Post-Opex & Casuals</span>
            </span>
          }
        />
      </div>

      {/* ── View 1: P&L Statement (The Live Operational Ledger) ──────── */}
      {activeTab === 'pnl' ? (
        <div className="flex flex-col gap-24">
          {/* Main Financial Statement Container */}
          <div className="relative overflow-hidden rounded-[20px] bg-page border border-hairline/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            {/* Ambient Card Rule */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-accent/50 via-poured/20 to-transparent" />

            {/* Header Block */}
            <div className="p-20 tablet:p-24 border-b border-hairline/60 bg-control/20 flex flex-col tablet:flex-row tablet:items-center justify-between gap-12">
              <div>
                <div className="flex items-center gap-8">
                  <h3 className="text-title font-medium text-ink">Executive Profit & Loss Statement</h3>
                  <span className="inline-flex items-center gap-4 px-8 py-2 rounded-full text-[11px] font-medium uppercase tracking-wider bg-poured-wash text-poured border border-hairline/40">
                    <span className="size-6 rounded-full bg-poured animate-pulse" />
                    Live Ledger
                  </span>
                </div>
                <p className="text-body-sm text-ink-subtle mt-4">
                  Physical tavern physics: Sales − Recipe COGS − Counted Variance − Nairobi Opex − Casuals − Payment Fees
                </p>
              </div>
              <div className="text-left tablet:text-right shrink-0">
                <span className="text-micro font-medium uppercase tracking-wider text-ink-subtle">
                  Reporting Scope
                </span>
                <div className="font-mono text-body font-medium text-ink">
                  {report.dateLabel}
                </div>
              </div>
            </div>

            {/* Structured Financial Ledger Rows */}
            <div className="divide-y divide-hairline/60 text-body">
              {/* Row 1: Gross Sales */}
              <div className="flex justify-between items-center p-16 tablet:px-24 hover:bg-control/15 transition-colors">
                <div className="flex items-center gap-12">
                  <span className="size-8 rounded-full bg-accent/60" />
                  <span className="font-medium text-ink">Gross Sales (Total Fired & Billed)</span>
                </div>
                <span className="font-mono font-medium text-ink text-title-sm">
                  {formatKes(report.grossSalesCents, { decimals: 'whole' })}
                </span>
              </div>

              {/* Deductions Nested Strip */}
              <div className="p-16 tablet:px-24 bg-control/10 flex flex-col gap-8 text-body-sm">
                <div className="flex justify-between items-center text-ink-subtle pl-20">
                  <span className="flex items-center gap-6">
                    <span className="size-4 rounded-full bg-stop" />
                    Less: Approved Comps & Manager Privileges
                  </span>
                  <span className="font-mono font-medium text-stop">
                    -{formatKes(report.compsCents, { decimals: 'whole' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-ink-subtle pl-20">
                  <span className="flex items-center gap-6">
                    <span className="size-4 rounded-full bg-stop" />
                    Less: Line Voids (Poured & Draft Voids with Reason)
                  </span>
                  <span className="font-mono font-medium text-stop">
                    -{formatKes(report.voidsCents, { decimals: 'whole' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-ink-subtle pl-20">
                  <span className="flex items-center gap-6">
                    <span className="size-4 rounded-full bg-stop" />
                    Less: Discretionary Bill Discounts
                  </span>
                  <span className="font-mono font-medium text-stop">
                    -{formatKes(report.discountsCents, { decimals: 'whole' })}
                  </span>
                </div>
              </div>

              {/* Row 2: Net Revenue Highlight */}
              <div className="flex justify-between items-center p-16 tablet:px-24 bg-control/25 font-medium text-ink border-y border-hairline/80">
                <span className="text-body font-medium uppercase tracking-wider text-ink">
                  NET OPERATING REVENUE
                </span>
                <span className="font-mono text-title-sm font-medium text-ink">
                  {formatKes(report.netSalesCents, { decimals: 'whole' })}
                </span>
              </div>

              {/* Row 3: COGS Breakdown (Theoretical + Shrinkage) */}
              <div className="p-20 tablet:px-24 bg-page flex flex-col gap-16">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-8">
                    <span className="size-8 rounded-full bg-attention" />
                    <span className="font-medium text-ink">Cost of Goods Sold (Recipe Theoretical + Shrinkage)</span>
                  </div>
                  <span className="font-mono font-medium text-stop text-title-sm">
                    -{formatKes(report.cogs.realCogsCents, { decimals: 'whole' })}
                  </span>
                </div>

                {/* Micro Category Bento Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 desktop:grid-cols-5 gap-12 pt-4">
                  <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Liquor / Spirits</span>
                    <span className="font-mono font-medium text-ink text-body mt-4">
                      {formatKes(report.cogs.liquorTheoreticalCents, { decimals: 'whole' })}
                    </span>
                    <span className="text-[10px] text-ink-muted mt-2">Recipe tot depletion</span>
                  </div>

                  <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Beer & Ciders</span>
                    <span className="font-mono font-medium text-ink text-body mt-4">
                      {formatKes(report.cogs.beerTheoreticalCents, { decimals: 'whole' })}
                    </span>
                    <span className="text-[10px] text-ink-muted mt-2">Bottles & draught</span>
                  </div>

                  <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Wine & Bubbles</span>
                    <span className="font-mono font-medium text-ink text-body mt-4">
                      {formatKes(report.cogs.wineTheoreticalCents, { decimals: 'whole' })}
                    </span>
                    <span className="text-[10px] text-ink-muted mt-2">Glasses & bottles</span>
                  </div>

                  <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider">Kitchen & Food</span>
                    <span className="font-mono font-medium text-ink text-body mt-4">
                      {formatKes(report.cogs.foodTheoreticalCents, { decimals: 'whole' })}
                    </span>
                    <span className="text-[10px] text-ink-muted mt-2">Nyama & platters</span>
                  </div>

                  <div className="p-12 rounded-xl bg-control/20 text-attention border border-hairline/40 flex flex-col">
                    <span className="text-[11px] font-medium text-attention uppercase tracking-wider">Shrinkage Variance</span>
                    <span className="font-mono font-medium text-attention text-body mt-4">
                      {formatKes(report.cogs.varianceShrinkageCents, { decimals: 'whole' })}
                    </span>
                    <span className="text-[10px] text-attention/80 mt-2">Physical audit loss</span>
                  </div>
                </div>
              </div>

              {/* Row 4: Gross Profit Ribbon */}
              <div className="flex justify-between items-center p-16 tablet:px-24 bg-poured-wash border-y border-hairline/40">
                <div className="flex items-center gap-8">
                  <span className="size-8 rounded-full bg-poured" />
                  <span className="font-medium text-poured uppercase tracking-wider text-body">
                    GROSS MARGIN
                  </span>
                </div>
                <div className="flex items-center gap-12">
                  <span className="px-8 py-2 rounded-full text-micro font-medium uppercase tracking-wider bg-poured-wash text-poured border border-hairline/40">
                    {report.grossMarginPct.toFixed(1)}% Gross Margin
                  </span>
                  <span className="font-mono text-title-sm font-medium text-poured">
                    {formatKes(report.grossProfitCents, { decimals: 'whole' })}
                  </span>
                </div>
              </div>

              {/* Row 5: Auxiliary Expenses (Nairobi Pub Reality) */}
              <div className="p-20 tablet:px-24 bg-page flex flex-col gap-16">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-8">
                    <span className="size-8 rounded-full bg-served" />
                    <div>
                      <span className="font-medium text-ink">Auxiliary Operating Expenses (Nairobi Pub Reality)</span>
                      <p className="text-[12px] text-ink-subtle mt-2">
                        Allocated daily run-rate + recorded drawer cash-out payouts
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-stop text-title-sm">
                    -{formatKes(report.auxiliary.totalOpexCents, { decimals: 'whole' })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 desktop:grid-cols-7 gap-8 pt-2 text-[12px]">
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Facility Rent</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.rentCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Power (KPLC+Gen)</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.powerCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Water Bowser</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.waterBowserCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">DSTV / Sports</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.dstvCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Night Security</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.securityCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Kitchen LPG Gas</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.gasCents, { decimals: 'whole' })}</span>
                  </div>
                  <div className="p-8 rounded-lg bg-control/20 border border-hairline/40 flex flex-col">
                    <span className="text-ink-subtle font-medium text-[11px]">Supplier COD</span>
                    <span className="font-mono font-medium text-ink mt-2">{formatKes(report.auxiliary.supplierCodCents, { decimals: 'whole' })}</span>
                  </div>
                </div>
              </div>

              {/* Row 6: Casuals Labor & Shifts */}
              <div className="p-20 tablet:px-24 bg-page flex flex-col gap-12">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-8">
                    <span className="size-8 rounded-full bg-accent" />
                    <div className="flex items-center gap-8">
                      <span className="font-medium text-ink">Casuals Floor & Bar Labor</span>
                      {report.casuals.isWeekendSpike ? (
                        <span className="text-[10px] px-8 py-2 rounded-full bg-accent-wash text-accent font-medium uppercase tracking-wider border border-hairline/40">
                          Weekend Surge
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="font-mono font-medium text-stop text-title-sm">
                    -{formatKes(report.casuals.totalCasualsCostCents, { decimals: 'whole' })}
                  </span>
                </div>

                <div className="p-12 rounded-xl bg-control/25 border border-hairline/40 flex flex-wrap items-center justify-between gap-12 text-body-sm">
                  <div className="flex items-center gap-6">
                    <IconClock size={16} className="text-ink-muted" />
                    <span>Clocked Hours: <b className="font-mono font-medium text-ink">{report.casuals.clockedHours} hrs</b></span>
                  </div>
                  <div className="flex items-center gap-6">
                    <IconCash size={16} className="text-ink-muted" />
                    <span>Base Rate: <b className="font-mono font-medium text-ink">{formatKes(report.casuals.baseHourlyRateCents, { decimals: 'whole' })}/hr</b></span>
                  </div>
                  <div className="flex items-center gap-6">
                    <IconShieldCheck size={16} className="text-ink-muted" />
                    <span>Statutory Load (NSSF, SHIF, Housing Levy): <b className="font-mono font-medium text-ink">{formatKes(report.casuals.statutoryCostCents, { decimals: 'whole' })} (12%)</b></span>
                  </div>
                  <div className="flex items-center gap-6">
                    <IconUsers size={16} className="text-ink-muted" />
                    <span>Roster: <b className="font-mono font-medium text-ink">{report.casuals.headcount} casuals</b></span>
                  </div>
                </div>
              </div>

              {/* Row 7: Payment Processing Fees */}
              <div className="flex justify-between items-center p-16 tablet:px-24 bg-page hover:bg-control/15 transition-colors">
                <div className="flex items-center gap-8">
                  <span className="size-8 rounded-full bg-focus" />
                  <span className="font-medium text-ink">
                    Payment Gateway & Acquiring Fees (M-Pesa 1.2%, Card 2.5%, Cash 0%)
                  </span>
                </div>
                <span className="font-mono font-medium text-stop text-title-sm">
                  -{formatKes(report.paymentFeesCents, { decimals: 'whole' })}
                </span>
              </div>

              {/* ── MASTER EBITDA ROW (High-Contrast Executive Bottom-Line Card) ── */}
              <div className="p-20 tablet:p-24 bg-page text-ink flex flex-col tablet:flex-row tablet:items-center justify-between gap-16 border-t border-hairline/40 shadow-inner">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-8">
                    <span className="size-8 rounded-full bg-poured shadow-raised" />
                    <span className="text-title-sm font-medium uppercase tracking-wider text-ink">
                      NET OPERATING EBITDA
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-subtle max-w-[500px]">
                    Sales − COGS − Auxiliary Opex − Casuals − Payment Fees. Not &ldquo;profit before I remember KPLC&rdquo;.
                  </p>
                </div>

                <div className="flex items-center gap-16 self-start tablet:self-auto">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-medium text-poured uppercase tracking-widest">
                      Real Margin
                    </span>
                    <span className="px-8 py-4 rounded-full text-[12px] font-medium bg-poured-wash text-poured border border-hairline/40 mt-2">
                      {report.ebitdaMarginPct.toFixed(1)}% EBITDA
                    </span>
                  </div>
                  <div className="font-mono text-[28px] tablet:text-[34px] font-medium tracking-tight text-ink">
                    {formatKes(report.ebitdaCents, { decimals: 'whole' })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sub-Bento Grid: Channel Mix & Tender Distribution ───────── */}
          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-20">
            {/* Sales by Channel Card */}
            <div className="flex flex-col justify-between overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div>
                <div className="flex items-center justify-between pb-12 border-b border-hairline/60">
                  <div className="flex items-center gap-8">
                    <div className="flex size-32 items-center justify-center rounded-[8px] bg-accent/10 text-accent">
                      <IconBuildingStore size={18} />
                    </div>
                    <div>
                      <h4 className="text-subtitle font-medium text-ink">Sales by Channel</h4>
                      <p className="text-[12px] text-ink-subtle">Revenue stream distribution across floor zones</p>
                    </div>
                  </div>
                  <span className="font-mono text-body font-medium text-ink">
                    {formatKes(report.netSalesCents, { decimals: 'whole' })}
                  </span>
                </div>

                <div className="flex flex-col gap-12 mt-16 text-body-sm">
                  {/* Main Bar */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">Main Bar & Counter</span>
                      <span className="font-mono font-medium text-ink">{formatKes(report.channels.barCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.channels.barCents) / totalChannelSales) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Floor Tables */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">Dining Floor / Tables</span>
                      <span className="font-mono font-medium text-ink">{formatKes(report.channels.tableCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-poured rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.channels.tableCents) / totalChannelSales) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* VIP Lounge */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">VIP Lounge & Terrace</span>
                      <span className="font-mono font-medium text-ink">{formatKes(report.channels.vipCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.channels.vipCents) / totalChannelSales) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Happy Hour Rule Overlay */}
                  <div className="p-12 rounded-xl bg-control/20 text-attention border border-hairline/40 flex justify-between items-center mt-6">
                    <div className="flex items-center gap-6">
                      <IconFlame size={16} className="text-attention" />
                      <span className="text-[12px] font-medium text-attention">Happy Hour Promotional Volume</span>
                    </div>
                    <span className="font-mono font-medium text-attention text-body-sm">
                      {formatKes(report.channels.happyHourCents, { decimals: 'whole' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tender Settlement Mix Card */}
            <div className="flex flex-col justify-between overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div>
                <div className="flex items-center justify-between pb-12 border-b border-hairline/60">
                  <div className="flex items-center gap-8">
                    <div className="flex size-32 items-center justify-center rounded-[8px] bg-poured-wash text-poured">
                      <IconCash size={18} />
                    </div>
                    <div>
                      <h4 className="text-subtitle font-medium text-ink">Tender Settlement Mix</h4>
                      <p className="text-[12px] text-ink-subtle">Reconciliation by payment instrument</p>
                    </div>
                  </div>
                  <span className="font-mono text-body font-medium text-ink">
                    {formatKes(report.netSalesCents, { decimals: 'whole' })}
                  </span>
                </div>

                <div className="flex flex-col gap-12 mt-16 text-body-sm">
                  {/* M-Pesa */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">M-Pesa (Daraja API Confirmed)</span>
                      <span className="font-mono font-medium text-poured">{formatKes(report.tenders.mpesaCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-poured rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.tenders.mpesaCents) / totalTenders) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Cash */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">Cash (Till Declared)</span>
                      <span className="font-mono font-medium text-ink">{formatKes(report.tenders.cashCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-ink/70 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.tenders.cashCents) / totalTenders) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Acquirer */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-ink">Card Acquirer Batch</span>
                      <span className="font-mono font-medium text-served">{formatKes(report.tenders.cardCents, { decimals: 'whole' })}</span>
                    </div>
                    <div className="w-full h-6 rounded-full bg-control overflow-hidden">
                      <div
                        className="h-full bg-served rounded-full"
                        style={{ width: `${Math.min(100, Math.round((Number(report.tenders.cardCents) / totalTenders) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Split Bills */}
                  <div className="p-12 rounded-xl bg-control/30 border border-hairline/60 flex justify-between items-center mt-6">
                    <div className="flex items-center gap-6">
                      <IconUsers size={16} className="text-ink-subtle" />
                      <span className="text-[12px] font-medium text-ink">Split & Multi-Tender Settled Bills</span>
                    </div>
                    <span className="font-mono font-medium text-ink text-body-sm">
                      {formatKes(report.tenders.splitCents, { decimals: 'whole' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Total Tax Liability (KRA Compliance Card) ───────────────── */}
          <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-16">
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-8 pb-16 border-b border-hairline/60">
              <div>
                <div className="flex items-center gap-8">
                  <IconShieldCheck size={20} className="text-accent" />
                  <h4 className="text-subtitle font-medium text-ink">Total Tax Liability & KRA Accruals</h4>
                </div>
                <p className="text-[12px] text-ink-subtle mt-2">
                  Running month position across 16% VAT, Service Charge, Excise Duty, Payroll, and Withholding Tax
                </p>
              </div>
              <div className="text-left tablet:text-right">
                <div className="font-mono text-[22px] font-medium text-ink">
                  {formatKes(report.taxes.totalLiabilityCents, { decimals: 'whole' })}
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-poured bg-poured-wash px-8 py-2 rounded-full border border-hairline/40 inline-block mt-2">
                  Accruing Running Month
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 desktop:grid-cols-5 gap-12 text-[12px]">
              <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                <span className="text-ink-subtle text-[11px] font-medium uppercase tracking-wider">16% VAT on Sales</span>
                <span className="font-mono font-medium text-ink text-body mt-4">{formatKes(report.taxes.vatOnSalesCents, { decimals: 'whole' })}</span>
                <span className="text-[10px] text-ink-muted mt-2">Inclusive in gross</span>
              </div>

              <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                <span className="text-ink-subtle text-[11px] font-medium uppercase tracking-wider">VAT on Service Chg</span>
                <span className="font-mono font-medium text-ink text-body mt-4">{formatKes(report.taxes.vatOnServiceChargeCents, { decimals: 'whole' })}</span>
                <span className="text-[10px] text-ink-muted mt-2">16% on service chg</span>
              </div>

              <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                <span className="text-ink-subtle text-[11px] font-medium uppercase tracking-wider">Excise Duty in Cost</span>
                <span className="font-mono font-medium text-ink text-body mt-4">{formatKes(report.taxes.exciseInCostCents, { decimals: 'whole' })}</span>
                <span className="text-[10px] text-ink-muted mt-2">Spirits / beer stamps</span>
              </div>

              <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                <span className="text-ink-subtle text-[11px] font-medium uppercase tracking-wider">PAYE / NSSF / SHIF</span>
                <span className="font-mono font-medium text-ink text-body mt-4">{formatKes(report.taxes.payrollStatutoryCents, { decimals: 'whole' })}</span>
                <span className="text-[10px] text-ink-muted mt-2">Casuals statutory load</span>
              </div>

              <div className="p-12 rounded-xl bg-control/20 border border-hairline/40 flex flex-col">
                <span className="text-ink-subtle text-[11px] font-medium uppercase tracking-wider">5% Withholding Tax</span>
                <span className="font-mono font-medium text-ink text-body mt-4">{formatKes(report.taxes.withholdingTaxCents, { decimals: 'whole' })}</span>
                <span className="text-[10px] text-ink-muted mt-2">Rent & contractors</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── View 2: The Four Owner Questions ────────────────────────── */}
      {activeTab === 'questions' ? (
        <div className="flex flex-col gap-24">
          <div className="bg-control/25 p-16 rounded-2xl border border-hairline/60">
            <h3 className="text-title font-medium text-ink">The Four Owner Questions</h3>
            <p className="text-body-sm text-ink-subtle mt-4">
              Answers to the fundamental operational questions every pub proprietor in Nairobi evaluates before closing.
            </p>
          </div>

          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-20">
            {/* Question 1: Pour Cost % vs Target */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-12 pb-12 border-b border-hairline/60">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-attention bg-control/20 text-attention px-8 py-2 rounded-full border border-hairline/40">
                      Owner Question 1
                    </span>
                    <h4 className="text-title-sm font-medium text-ink mt-8">
                      Pour cost % by spirit category vs target
                    </h4>
                    <p className="text-[12px] text-ink-subtle mt-2">
                      Industry standard is ~18–24% liquor. Kenya pubs often run 30%+ because of uncalibrated pours.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-title-lg font-medium text-ink">
                      {report.ownerQuestions.overallSpiritsPourCostPct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-ink-subtle">Target: {report.ownerQuestions.industryTargetSpiritsPct}%</div>
                  </div>
                </div>

                <div className="divide-y divide-hairline/60 text-body-sm pt-6">
                  {report.ownerQuestions.pourCosts.map((cat) => (
                    <div key={cat.categoryName} className="py-8 flex justify-between items-center">
                      <span className="font-medium text-ink">{cat.categoryName}</span>
                      <div className="flex items-center gap-12">
                        <span className="font-mono text-ink-subtle text-[12px]">
                          Target {cat.targetPourCostPct.toFixed(1)}%
                        </span>
                        <span
                          className={`font-mono font-medium px-8 py-2 rounded-full text-[11px] ${
                            cat.actualPourCostPct > cat.targetPourCostPct + 3
                              ? 'bg-stop/10 text-stop border border-red-500/20'
                              : 'bg-poured-wash text-poured border border-hairline/40'
                          }`}
                        >
                          {cat.actualPourCostPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question 2: Shrinkage KES this week, named */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-12 pb-12 border-b border-hairline/60">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-stop bg-stop/10 px-8 py-2 rounded-full border border-red-500/20">
                      Owner Question 2
                    </span>
                    <h4 className="text-title-sm font-medium text-ink mt-8">
                      Shrinkage KES this week, named
                    </h4>
                    <p className="text-[12px] text-ink-subtle mt-2">
                      Explicit bottle and tot deficits at cost identified during committed inventory counts.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-title-lg font-medium text-stop">
                      {formatKes(report.ownerQuestions.shrinkageThisWeekCents, { decimals: 'whole' })}
                    </div>
                    <div className="text-[11px] text-ink-subtle">Missing Stock Loss</div>
                  </div>
                </div>

                <div className="divide-y divide-hairline/60 text-body-sm pt-6">
                  {report.ownerQuestions.namedShrinkageItems.map((item) => (
                    <div key={item.variantId} className="py-8 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-ink">{item.name}</div>
                        <div className="text-[11px] text-ink-subtle">
                          Deficit: {item.missingUnits.toFixed(1)} units @ {formatKes(item.unitCostCents, { decimals: 'whole' })}
                        </div>
                      </div>
                      <span className="font-mono font-medium text-stop">
                        -{formatKes(item.lossCents, { decimals: 'whole' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question 3: Labor % of sales tonight vs last four Fridays */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-12 pb-12 border-b border-hairline/60">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-served bg-served/10 px-8 py-2 rounded-full border border-blue-500/20">
                      Owner Question 3
                    </span>
                    <h4 className="text-title-sm font-medium text-ink mt-8">
                      Labor % of sales tonight vs last four Fridays
                    </h4>
                    <p className="text-[12px] text-ink-subtle mt-2">
                      Nairobi is weekend-shaped. Comparing Friday to Tuesday is meaningless.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-title-lg font-medium text-ink">
                      {report.ownerQuestions.laborPctTonight.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-ink-subtle">
                      4-Friday Avg: {report.ownerQuestions.laborPctLastFourFridaysAvg.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="p-16 rounded-xl bg-control/25 border border-hairline/60 flex items-center justify-between mt-16 text-body-sm">
                  <div>
                    <span className="text-ink font-medium">Variance vs 4-Friday Benchmark</span>
                    <p className="text-[11px] text-ink-subtle">Rolling Friday labor efficiency</p>
                  </div>
                  <span
                    className={`font-mono font-medium px-8 py-2 rounded-full text-body-sm ${
                      report.ownerQuestions.laborDeltaBps > 100
                        ? 'bg-control/20 text-attention text-attention border border-hairline/40'
                        : 'bg-poured-wash text-poured border border-hairline/40'
                    }`}
                  >
                    {report.ownerQuestions.laborDeltaBps > 0 ? '+' : ''}
                    {(report.ownerQuestions.laborDeltaBps / 100).toFixed(1)}% pts
                  </span>
                </div>
              </div>
            </div>

            {/* Question 4: Unclosed tabs + eTIMS queue right now */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-12 pb-12 border-b border-hairline/60">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-accent bg-accent-wash px-8 py-2 rounded-full border border-hairline/40">
                      Owner Question 4
                    </span>
                    <h4 className="text-title-sm font-medium text-ink mt-8">
                      Unclosed tabs + eTIMS queue right now
                    </h4>
                    <p className="text-[12px] text-ink-subtle mt-2">
                      Open tabs past cutover are unclosed sales leakage. eTIMS queue is tax signature exposure.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-title-lg font-medium text-attention">
                      {report.ownerQuestions.unclosedTabsCount} Tabs
                    </div>
                    <div className="text-[11px] text-ink-subtle">
                      {formatKes(report.ownerQuestions.unclosedTabsExposureCents, { decimals: 'whole' })} Exposure
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-8 mt-16 text-body-sm">
                  <div className="p-12 rounded-xl bg-control/25 border border-hairline/60 flex justify-between items-center">
                    <div>
                      <span className="font-medium text-ink">Sleeping / Unclosed Floor Tabs</span>
                      <p className="text-[11px] text-ink-subtle">Tabs requiring supervisor resolution</p>
                    </div>
                    <Link
                      href="/console/trade/open"
                      className="inline-flex items-center gap-4 font-mono font-medium text-accent hover:underline"
                    >
                      <span>{report.ownerQuestions.unclosedTabsCount} tabs open</span>
                      <IconArrowUpRight size={14} />
                    </Link>
                  </div>

                  <div className="p-12 rounded-xl bg-control/25 border border-hairline/60 flex justify-between items-center">
                    <div>
                      <span className="font-medium text-ink">eTIMS Fiscalization Queue</span>
                      <p className="text-[11px] text-ink-subtle">Invoices awaiting KRA signing transmission</p>
                    </div>
                    <span className="font-mono font-medium text-ink">
                      {report.ownerQuestions.etimsQueueCount} queued ({formatKes(report.ownerQuestions.etimsPendingExposureCents, { decimals: 'whole' })})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── View 3: SKU Quadrants (Contribution & Velocity Leaders) ──── */}
      {activeTab === 'sku' ? (
        <div className="flex flex-col gap-24">
          <div className="bg-control/25 p-16 rounded-2xl border border-hairline/60">
            <h3 className="text-title font-medium text-ink">Product Quadrant Movers (SKUs)</h3>
            <p className="text-body-sm text-ink-subtle mt-4">
              Contribution after recipe COGS, not after rent. Separates true tavern winners from margin traps.
            </p>
          </div>

          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-20">
            {/* Highest Unit Sales */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-poured bg-poured-wash px-8 py-2 rounded-full border border-hairline/40">
                  Highest Unit Sales SKU (Volume King)
                </span>
                <h4 className="text-title-sm font-medium text-ink mt-12">
                  {report.quadrants.highestUnitSales?.name ?? 'Tusker Lager 500ml'}
                </h4>
                <p className="text-body-sm text-ink-subtle mt-2">
                  Category: {report.quadrants.highestUnitSales?.category ?? 'Beer'}
                </p>
              </div>
              <div className="mt-20 p-12 rounded-xl bg-control/25 border border-hairline/60 flex justify-between items-center text-body-sm">
                <span className="text-ink-subtle font-medium">Volume Dispensed:</span>
                <span className="font-mono font-medium text-ink text-body">
                  {report.quadrants.highestUnitSales?.units ?? 48} units
                </span>
              </div>
            </div>

            {/* Highest Profitability SKU */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-served bg-served/10 px-8 py-2 rounded-full border border-blue-500/20">
                  Highest Profitability SKU (Contribution King)
                </span>
                <h4 className="text-title-sm font-medium text-ink mt-12">
                  {report.quadrants.highestProfitability?.name ?? 'Jameson Double Tot'}
                </h4>
                <p className="text-body-sm text-ink-subtle mt-2">
                  Contribution after recipe COGS: {formatKes(report.quadrants.highestProfitability?.totalContributionCents ?? ZERO, { decimals: 'whole' })}
                </p>
              </div>
              <div className="mt-20 p-12 rounded-xl bg-control/25 border border-hairline/60 flex justify-between items-center text-body-sm">
                <span className="text-ink-subtle font-medium">Gross Margin:</span>
                <span className="font-mono font-medium text-poured text-body">
                  {report.quadrants.highestProfitability?.grossMarginPct.toFixed(1) ?? '72.5'}%
                </span>
              </div>
            </div>

            {/* Lowest Unit Sales SKU */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle bg-control px-8 py-2 rounded-full border border-hairline/60">
                  Lowest Unit Sales SKU (Dead Weight)
                </span>
                <h4 className="text-title-sm font-medium text-ink mt-12">
                  {report.quadrants.lowestUnitSales?.name ?? 'Baileys 750ml Bottle'}
                </h4>
                <p className="text-body-sm text-ink-subtle mt-2">
                  Category: {report.quadrants.lowestUnitSales?.category ?? 'Liqueur'}
                </p>
              </div>
              <div className="mt-20 p-12 rounded-xl bg-control/25 border border-hairline/60 flex justify-between items-center text-body-sm">
                <span className="text-ink-subtle font-medium">Volume Dispensed:</span>
                <span className="font-mono font-medium text-ink text-body">
                  {report.quadrants.lowestUnitSales?.units ?? 1} unit
                </span>
              </div>
            </div>

            {/* Lowest Profitability SKU (The Cocktail that Loses Money at Happy Hour) */}
            <div className="overflow-hidden rounded-[16px] bg-page p-20 tablet:p-24 border border-red-500/20 shadow-[0_2px_12px_rgba(239,68,68,0.04)] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-stop bg-stop/10 px-8 py-2 rounded-full border border-red-500/20">
                  Lowest Profitability SKU (Margin Trap)
                </span>
                <h4 className="text-title-sm font-medium text-ink mt-12">
                  {report.quadrants.lowestProfitability?.name ?? 'Long Island Iced Tea (Happy Hour)'}
                </h4>
                <p className="text-body-sm text-stop font-medium mt-2">
                  The cocktail that loses money at happy hour when multi-spirit recipe cost exceeds promotional price!
                </p>
              </div>
              <div className="mt-20 p-12 rounded-xl bg-stop/10 border border-red-500/20 flex justify-between items-center text-body-sm">
                <span className="text-stop font-medium">Unit Margin:</span>
                <span className="font-mono font-medium text-stop text-body">
                  {report.quadrants.lowestProfitability?.grossMarginPct.toFixed(1) ?? '8.4'}%
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
