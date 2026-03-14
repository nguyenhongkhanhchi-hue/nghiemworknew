import { useMemo, useState } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { getNowInTimezone } from '@/lib/notifications';
import { Wallet, TrendingUp, TrendingDown, Clock, ChevronLeft, ChevronRight, AlertCircle, BarChart3, Calendar, PieChart, LineChart } from 'lucide-react';
import type { FinanceCategory, CostItem } from '@/types';

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

// Type for date range
type DateRangeType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export default function CashFlowPage() {
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const financeCategories = useSettingsStore(s => s.financeCategories);
  const costItems = useSettingsStore(s => s.costItems);
  const now = getNowInTimezone(timezone);
  
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('day');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');

  // ✅ Get first data date (first task creation date)
  const firstDataDate = useMemo(() => {
    if (tasks.length > 0) {
      const earliest = Math.min(...tasks.map(t => t.createdAt));
      return earliest;
    }
    return Date.now() - 30 * 24 * 60 * 60 * 1000; // Default to 30 days ago
  }, [tasks]);

  const firstDataDateStr = useMemo(() => {
    const d = new Date(firstDataDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [firstDataDate]);

  // Calculate time range based on type
  const { rangeStart, rangeEnd, rangeLabel, displayDate } = useMemo(() => {
    const n = getNowInTimezone(timezone);
    
    // Handle custom date range
    if (dateRangeType === 'custom' && customDateStart && customDateEnd) {
      const start = new Date(customDateStart).getTime();
      const end = new Date(customDateEnd).getTime() + 86400000; // Include the end date
      return { 
        rangeStart: start, 
        rangeEnd: end, 
        rangeLabel: `${customDateStart} - ${customDateEnd}`,
        displayDate: new Date(customDateStart)
      };
    }
    
    // Handle specific day selection
    if (selectedDate) {
      const d = new Date(selectedDate);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000;
      return { 
        rangeStart: start, 
        rangeEnd: end, 
        rangeLabel: d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }),
        displayDate: d
      };
    }
    
    if (dateRangeType === 'day') {
      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
      return { rangeStart: start, rangeEnd: start + 86400000, rangeLabel: 'Hôm nay', displayDate: n };
    }
    
    if (dateRangeType === 'week') {
      const weekStart = new Date(n);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      return { rangeStart: weekStart.getTime(), rangeEnd: weekStart.getTime() + 7 * 86400000, rangeLabel: 'Tuần này', displayDate: weekStart };
    }
    
    if (dateRangeType === 'month') {
      const d = new Date(n.getFullYear(), n.getMonth() + monthOffset, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const label = d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
      return { rangeStart: start, rangeEnd: end, rangeLabel: label, displayDate: d };
    }
    
    if (dateRangeType === 'quarter') {
      const quarter = Math.floor(n.getMonth() / 3);
      const d = new Date(n.getFullYear(), quarter * 3, 1);
      const start = d.getTime();
      const end = new Date(n.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59).getTime();
      const label = `Q${quarter + 1} ${n.getFullYear()}`;
      return { rangeStart: start, rangeEnd: end, rangeLabel: label, displayDate: d };
    }
    
    // year
    const d = new Date(n.getFullYear(), 0, 1);
    const start = d.getTime();
    const end = new Date(n.getFullYear(), 11, 31, 23, 59, 59).getTime();
    return { rangeStart: start, rangeEnd: end, rangeLabel: `Năm ${n.getFullYear()}`, displayDate: d };
  }, [dateRangeType, monthOffset, selectedDate, customDateStart, customDateEnd, timezone]);

  // ✅ #9: Calculate cost per second from costItems
  const costPerSecond = useMemo(() => {
    const totalPerMonth = costItems.reduce((s, i) => s + i.amount, 0);
    return totalPerMonth / (30 * 24 * 3600);
  }, [costItems]);

  const costPerHour = costPerSecond * 3600;
  const costPerMinute = costPerSecond * 60;

  // ✅ #10: Aggregate completed tasks in range
  const completedInRange = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= rangeStart && t.completedAt <= rangeEnd),
    [tasks, rangeStart, rangeEnd]
  );

  // Income by categories
  const incomeCategories = financeCategories.filter(c => c.type === 'income');
  const expenseCategories = financeCategories.filter(c => c.type === 'expense');

  const totalIncome = useMemo(() =>
    completedInRange.reduce((s, t) => {
      if (t.finance?.type === 'income') return s + (t.finance.amount || 0);
      return s;
    }, 0), [completedInRange]);

  const totalExpense = useMemo(() =>
    completedInRange.reduce((s, t) => {
      if (t.finance?.type === 'expense') return s + (t.finance.amount || 0);
      return s;
    }, 0), [completedInRange]);

  // ✅ #10: Time cost = tracked seconds × cost/second
  const totalTrackedSeconds = useMemo(() =>
    completedInRange.reduce((s, t) => s + (t.duration || 0), 0),
    [completedInRange]
  );

  // ✅ Tính tổng thời gian không theo dõi của các việc đã hoàn thành
  const totalUntrackedSeconds = useMemo(() => {
    return completedInRange.reduce((s, t) => {
      const totalTaskTime = t.completedAt ? Math.floor((t.completedAt - t.createdAt) / 1000) : 0;
      const untracked = Math.max(0, totalTaskTime - (t.duration || 0));
      return s + untracked;
    }, 0);
  }, [completedInRange]);

  const trackedTimeCost = Math.round(totalTrackedSeconds * costPerSecond);
  const untrackedTimeCost = Math.round(totalUntrackedSeconds * costPerSecond);
  const timeCost = trackedTimeCost + untrackedTimeCost;

  // ✅ Chi phí cơ bản mỗi ngày = 24h × costPerSecond
  const DAY_SECONDS = 24 * 3600;
  
  // Calculate number of days in range
  const daysInRange = Math.ceil((rangeEnd - rangeStart) / 86400000);
  const dailyBaseCost = Math.round(DAY_SECONDS * costPerSecond);
  const rangeBaseCost = dailyBaseCost * daysInRange;
  
  // ✅ Tổng chi phí = chi phí cơ bản + chi phí từ các việc
  const totalDailyCost = rangeBaseCost + totalExpense;
  
  // ✅ Lời/Lỗ = thu nhập - chi phí - chi phí cơ bản
  const dailyNet = totalIncome - totalExpense - rangeBaseCost;
  
  // ✅ #10: Daily time efficiency (for the selected range)
  const totalRangeSeconds = daysInRange * DAY_SECONDS;
  const trackingEfficiency = totalRangeSeconds > 0 ? Math.round((totalTrackedSeconds / totalRangeSeconds) * 100) : 0;
  const unTrackedSeconds = Math.max(0, totalRangeSeconds - totalTrackedSeconds);

  // Net = thu - chi - chi phí cơ bản
  const netProfit = totalIncome - totalExpense - rangeBaseCost;

  // Task breakdown
  const taskRows = completedInRange.filter(t => t.finance || t.duration);

  // 📊 Generate chart data for the range (daily breakdown)
  const chartData = useMemo(() => {
    const days: { date: string; income: number; expense: number; net: number; label: string }[] = [];
    
    // Determine granularity based on range
    let current = new Date(rangeStart);
    const end = new Date(rangeEnd);
    
    while (current.getTime() < end.getTime()) {
      const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      
      const dayTasks = tasks.filter(t => 
        t.status === 'done' && t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
      );
      
      const dayIncome = dayTasks.reduce((s, t) => s + (t.finance?.type === 'income' ? t.finance.amount : 0), 0);
      const dayExpense = dayTasks.reduce((s, t) => s + (t.finance?.type === 'expense' ? t.finance.amount : 0), 0);
      const dayBaseCost = dailyBaseCost;
      const dayNet = dayIncome - dayExpense - dayBaseCost;
      
      const label = current.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
      
      days.push({
        date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        income: dayIncome,
        expense: dayExpense + dayBaseCost,
        net: dayNet,
        label
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [rangeStart, rangeEnd, tasks, dailyBaseCost]);

  // Find max value for chart scaling
  const maxChartValue = useMemo(() => {
    const max = Math.max(...chartData.map(d => Math.max(d.income, Math.abs(d.net))));
    return max > 0 ? max : 1000000;
  }, [chartData]);

  // 📈 Statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
    const avgDaily = (totalIncome + totalExpense) / chartData.length;
    const positiveDays = chartData.filter(d => d.net > 0).length;
    const negativeDays = chartData.filter(d => d.net < 0).length;
    const bestDay = chartData.reduce((best, d) => d.net > best.net ? d : best, chartData[0]);
    const worstDay = chartData.reduce((worst, d) => d.net < worst.net ? d : worst, chartData[0]);
    
    return { totalIncome, totalExpense, avgDaily, positiveDays, negativeDays, bestDay, worstDay };
  }, [chartData]);

  return (
    <div className="flex flex-col h-full px-4 pb-24 overflow-y-auto" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
      <h1 className="text-lg font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
        <Wallet size={18} className="text-[var(--accent-primary)]" /> Dòng tiền
      </h1>

      {/* First data date info */}
      <p className="text-sm text-[var(--text-muted)] mb-3">
        📅 Dữ liệu từ: {new Date(firstDataDate).toLocaleDateString('vi-VN')}
      </p>

      {/* Date range selector */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {(['day', 'week', 'month', 'quarter', 'year'] as const).map(r => (
          <button key={r} onClick={() => { setDateRangeType(r); setSelectedDate(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px] whitespace-nowrap ${dateRangeType === r && !selectedDate ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
            {r === 'day' ? '📅 Ngày' : r === 'week' ? '📆 Tuần' : r === 'month' ? '🗓️ Tháng' : r === 'quarter' ? '📊 Quý' : '📅 Năm'}
          </button>
        ))}
      </div>
      
      {/* Custom date button */}
      <button 
        onClick={() => setDateRangeType('custom')}
        className={`mb-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 min-h-[44px] ${dateRangeType === 'custom' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}
      >
        <Calendar size={16} /> Chọn ngày
      </button>

      {/* Month/Quarter navigation */}
      {(dateRangeType === 'month' || dateRangeType === 'quarter') && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setMonthOffset(p => p - 1)} className="size-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] min-h-[44px]">
            <ChevronLeft size={18} />
          </button>
          <span className="flex-1 text-center text-base font-medium text-[var(--text-primary)]">📅 {rangeLabel}</span>
          <button onClick={() => setMonthOffset(p => Math.min(p + 1, 0))} disabled={monthOffset >= 0} className="size-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] disabled:opacity-30 min-h-[44px]">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Custom date inputs */}
      {dateRangeType === 'custom' && (
        <div className="flex gap-2 mb-3">
          <input 
            type="date" 
            value={customDateStart} 
            onChange={(e) => setCustomDateStart(e.target.value)}
            min={firstDataDateStr}
            max={customDateEnd || new Date().toISOString().split('T')[0]}
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)]"
          />
          <input 
            type="date" 
            value={customDateEnd} 
            onChange={(e) => setCustomDateEnd(e.target.value)}
            min={customDateStart || firstDataDateStr}
            max={new Date().toISOString().split('T')[0]}
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)]"
          />
        </div>
      )}

      {/* Calendar date picker for specific day */}
      {dateRangeType === 'day' && (
        <div className="mb-3">
          <input 
            type="date" 
            value={selectedDate || ''} 
            onChange={(e) => setSelectedDate(e.target.value || null)}
            min={firstDataDateStr}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)]"
          />
          {selectedDate && (
            <button onClick={() => setSelectedDate(null)} className="text-sm text-[var(--accent-primary)] mt-2">
              ← Quay lại hôm nay
            </button>
          )}
        </div>
      )}

      {dateRangeType !== 'month' && dateRangeType !== 'quarter' && (
        <p className="text-sm text-[var(--text-muted)] text-center mb-3">{rangeLabel}</p>
      )}

      {/* 📊 Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] mb-3">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={20} className="text-[var(--accent-primary)]" />
            <span className="text-base font-semibold text-[var(--text-primary)]">📊 Biểu đồ thu chi</span>
          </div>
          
          {/* Simple bar chart */}
          <div className="h-32 flex items-end gap-0.5">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5">
                  {/* Net bar */}
                  <div 
                    className={`w-4 rounded-sm ${d.net >= 0 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--error)]'}`}
                    style={{ height: `${Math.max(2, (Math.abs(d.net) / maxChartValue) * 100)}px` }}
                  />
                </div>
                {/* Only show label for some days */}
                {chartData.length <= 7 || i === 0 || i === chartData.length - 1 || i === Math.floor(chartData.length / 2) ? (
                  <span className="text-[6px] text-[var(--text-muted)] -rotate-45 origin-top-left whitespace-nowrap">{d.label}</span>
                ) : null}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[var(--accent-primary)]"></span>
              📈 Thu
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[var(--error)]"></span>
              📉 Chi
            </span>
          </div>
        </div>
      )}

      {/* 📈 Statistics */}
      {stats && chartData.length > 1 && (
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] mb-3">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={20} className="text-[var(--success)]" />
            <span className="text-base font-semibold text-[var(--text-primary)]">📊 Thống kê</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-sm text-[var(--text-muted)]">🏆 Ngày tốt nhất</p>
              <p className="text-lg font-bold text-[var(--success)]">{stats.bestDay.label}</p>
              <p className="text-base font-mono">+{formatVND(stats.bestDay.net)}</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-sm text-[var(--text-muted)]">⚠️ Ngày xấu nhất</p>
              <p className="text-lg font-bold text-[var(--error)]">{stats.worstDay.label}</p>
              <p className="text-base font-mono">{formatVND(stats.worstDay.net)}</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-sm text-[var(--text-muted)]">✅ Ngày có lời</p>
              <p className="text-xl font-bold text-[var(--success)]">{stats.positiveDays}/{chartData.length}</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-sm text-[var(--text-muted)]">❌ Ngày lỗ</p>
              <p className="text-xl font-bold text-[var(--error)]">{stats.negativeDays}/{chartData.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cost per time display */}
      {costItems.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={20} className="text-[var(--error)]" />
            <span className="text-base font-semibold text-[var(--text-primary)]">⏱️ Chi phí thời gian</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-lg font-bold text-[var(--error)] font-mono">{formatVND(Math.round(costPerHour))}</p>
              <p className="text-sm text-[var(--text-muted)]">/giờ</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-lg font-bold text-[var(--error)] font-mono">{formatVND(Math.round(costPerMinute))}</p>
              <p className="text-sm text-[var(--text-muted)]">/phút</p>
            </div>
            <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
              <p className="text-lg font-bold text-[var(--error)] font-mono">{formatVND(Math.round(costPerSecond * 100) / 100)}</p>
              <p className="text-[8px] text-[var(--text-muted)]">/giây</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-[var(--success)]" />
            <span className="text-sm text-[var(--text-muted)]">💰 Thu nhập</span>
          </div>
          <p className="text-xl font-bold text-[var(--success)] font-mono">+{formatVND(totalIncome)}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-[var(--error)]" />
            <span className="text-sm text-[var(--text-muted)]">💸 Chi phí</span>
          </div>
          <p className="text-xl font-bold text-[var(--error)] font-mono">-{formatVND(totalExpense)}</p>
        </div>
        {costItems.length > 0 && (
          <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-[var(--warning)]" />
              <span className="text-sm text-[var(--text-muted)]">⏰ Chi phí 24h/ngày</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-[var(--warning)] font-mono">-{formatVND(rangeBaseCost)}</p>
              {totalExpense > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--error)]">+{formatVND(totalExpense)} chi phí việc</span>
                </div>
              )}
              <p className="text-sm text-[var(--text-muted)] border-t pt-1 mt-1">
                📊 Tổng: -{formatVND(totalDailyCost)}
              </p>
            </div>
          </div>
        )}
        <div className={`bg-[var(--bg-elevated)] rounded-xl p-4 border ${dailyNet >= 0 ? 'border-[var(--border-accent)]' : 'border-[rgba(248,113,113,0.4)]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className={dailyNet >= 0 ? 'text-[var(--accent-primary)]' : 'text-[var(--error)]'} />
            <span className="text-sm text-[var(--text-muted)]">📈 Thu/Chi</span>
          </div>
          <p className={`text-xl font-bold font-mono ${dailyNet >= 0 ? 'text-[var(--accent-primary)]' : 'text-[var(--error)]'}`}>
            {dailyNet >= 0 ? '+' : ''}{formatVND(dailyNet)}
          </p>
        </div>
      </div>

      {/* Time efficiency report */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] mb-3">
        <div className="flex items-center gap-2 mb-3">
          <LineChart size={20} className="text-[var(--accent-primary)]" />
          <span className="text-base font-semibold text-[var(--text-primary)]">⏱️ Hiệu suất thời gian</span>
        </div>
        <div className="w-full bg-[var(--bg-surface)] rounded-full h-4 mb-3 overflow-hidden">
          <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all" style={{ width: `${trackingEfficiency}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
            <p className="text-lg font-bold text-[var(--accent-primary)] font-mono">{formatTime(totalTrackedSeconds)}</p>
            <p className="text-sm text-[var(--text-muted)]">⏱️ Theo dõi</p>
          </div>
          <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
            <p className="text-lg font-bold text-[var(--text-muted)] font-mono">{formatTime(unTrackedSeconds)}</p>
            <p className="text-sm text-[var(--text-muted)]">⚠️ Không theo dõi</p>
          </div>
          <div className="p-3 bg-[var(--bg-surface)] rounded-xl">
            <p className="text-xl font-bold text-[var(--success)] font-mono">{trackingEfficiency}%</p>
            <p className="text-sm text-[var(--text-muted)]">📈 Hiệu suất</p>
          </div>
        </div>
        {unTrackedSeconds > 0 && (
          <div className="mt-3 flex items-start gap-2 bg-[rgba(251,191,36,0.08)] rounded-xl p-3">
            <AlertCircle size={18} className="text-[var(--warning)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[var(--text-muted)]">
              ⚠️ {formatTime(unTrackedSeconds)} không được ghi nhận — thời gian lãng phí không theo dõi được
              {costItems.length > 0 && ` (tương đương ${formatVND(Math.round(unTrackedSeconds * costPerSecond))} chi phí)`}
            </p>
          </div>
        )}
      </div>

      {/* Task breakdown */}
      {taskRows.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] mb-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <p className="text-base font-semibold text-[var(--text-primary)]">📋 Chi tiết từng việc</p>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {taskRows.map(task => {
              const tCost = task.duration ? Math.round(task.duration * costPerSecond) : 0;
              const taskTotalTime = task.completedAt ? Math.floor((task.completedAt - task.createdAt) / 1000) : Math.floor((Date.now() - task.createdAt) / 1000);
              const taskUntracked = Math.max(0, taskTotalTime - (task.duration || 0));
              const untrackedCost = Math.round(taskUntracked * costPerSecond);
              const totalTaskCost = tCost + untrackedCost;
              const income = task.finance?.type === 'income' ? task.finance.amount : 0;
              const expense = task.finance?.type === 'expense' ? task.finance.amount : 0;
              const net = income - expense - totalTaskCost;
              return (
                <div key={task.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-2 truncate">{task.title}</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {task.duration ? (
                      <span className="text-[var(--text-muted)]">⏱ {formatTime(task.duration)}</span>
                    ) : null}
                    {income > 0 && <span className="text-[var(--success)]">+{formatVND(income)}</span>}
                    {expense > 0 && <span className="text-[var(--error)]">-{formatVND(expense)}</span>}
                    {totalTaskCost > 0 && <span className="text-[var(--warning)]">⏰ -{formatVND(totalTaskCost)} (thời gian)</span>}
                    <span className={`font-bold ${net >= 0 ? 'text-[var(--accent-primary)]' : 'text-[var(--error)]'}`}>
                      = {net >= 0 ? '+' : ''}{formatVND(net)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completedInRange.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet size={48} className="text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-base text-[var(--text-muted)]">Chưa có việc hoàn thành trong khoảng thời gian này</p>
        </div>
      )}
    </div>
  );
}
