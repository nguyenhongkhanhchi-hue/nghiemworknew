import { useTaskStore, useSettingsStore, useAuthStore } from '@/stores';
import { TaskList } from '@/components/features/TaskList';
import { DailySchedule24h } from '@/components/features/DailySchedule24h';
import { Slider } from '@/components/ui/slider';
import { Calendar, Download, FileJson, FileText, File, Plus, LayoutGrid, Clock } from 'lucide-react';
import { getNowInTimezone } from '@/lib/notifications';
import { downloadICS, downloadJSON, downloadCSV, exportToPDF } from '@/lib/calendarExport';
import { useState, useEffect } from 'react';
import { updateUserLastActive } from '@/lib/userTracking';

export default function TasksPage() {
  const timer = useTaskStore(s => s.timer);
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const user = useAuthStore(s => s.user);
  const setCurrentPage = useSettingsStore(s => s.setCurrentPage);
  const taskViewMode = useSettingsStore(s => s.taskViewMode);
  const setTaskViewMode = useSettingsStore(s => s.setTaskViewMode);
  const hourHeight = useSettingsStore(s => s.hourHeight);
  const setHourHeight = useSettingsStore(s => s.setHourHeight);
  
  const [now, setNow] = useState(getNowInTimezone(timezone));
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportCalendar = () => {
    const tasksWithDeadline = tasks.filter(t => t.deadline);
    if (tasksWithDeadline.length === 0) {
      alert('Không có việc nào có hạn chót để xuất');
      return;
    }
    downloadICS(tasksWithDeadline);
  };

  const handleExportJSON = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    downloadJSON(tasks);
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    downloadCSV(tasks);
  };

  const handleExportPDF = () => {
    if (tasks.length === 0) {
      alert('Không có việc nào để xuất');
      return;
    }
    exportToPDF(tasks);
  };

  useEffect(() => {
    const i = setInterval(() => setNow(getNowInTimezone(timezone)), 1000);
    return () => clearInterval(i);
  }, [timezone]);

  // Update last active
  useEffect(() => {
    if (user) updateUserLastActive(user.id);
  }, [user]);

  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dayName = dayNames[now.getDay()];
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const hasTimer = timer.isRunning || timer.isPaused;

  return (
    <div className="flex flex-col h-full px-4" style={{ paddingTop: hasTimer ? 'calc(60px + env(safe-area-inset-top, 16px))' : 'max(16px, env(safe-area-inset-top, 16px))' }}>
      {/* Header - notch-safe */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[var(--text-muted)] font-medium">{dayName}</p>
              <p className="text-[11px] font-mono font-bold text-[var(--accent-primary)] tabular-nums">{timeStr}</p>
            </div>
            <p className="text-base font-bold text-[var(--text-primary)]">{dateStr}</p>
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)]">
          <button
            onClick={() => setTaskViewMode('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              taskViewMode === 'matrix' 
                ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <LayoutGrid size={14} />
            <span>Ma trận</span>
          </button>
          <button
            onClick={() => setTaskViewMode('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              taskViewMode === 'schedule' 
                ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock size={14} />
            <span>Lịch biểu</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage('templates')} 
            className="size-8 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center text-[var(--bg-base)] hover:opacity-90"
            title="Thêm từ Mẫu"
          >
            <Plus size={16} />
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="size-8 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]" title="Xuất dữ liệu">
              <Download size={14} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
                <button onClick={() => { handleExportCalendar(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-surface)]">
                  <Calendar size={14} /> ICS Calendar
                </button>
                <button onClick={() => { handleExportJSON(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-surface)]">
                  <FileJson size={14} /> JSON
                </button>
                <button onClick={() => { handleExportCSV(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-surface)]">
                  <FileText size={14} /> CSV
                </button>
                <button onClick={() => { handleExportPDF(); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-surface)]">
                  <File size={14} /> PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hour Height Adjustment Slider (only in schedule mode) */}
      {taskViewMode === 'schedule' && (
        <div className="flex items-center gap-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-300">
          <span className="text-xs text-[var(--text-muted)]">📏 Tỷ lệ:</span>
          <Slider
            value={[hourHeight]}
            onValueChange={([value]) => setHourHeight(value)}
            min={30}
            max={1200}
            step={5}
            className="flex-1 max-w-[150px]"
          />
          <span className="text-xs text-[var(--text-muted)] w-8">{hourHeight}px</span>
        </div>
      )}

      {/* View Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {taskViewMode === 'matrix' ? <TaskList /> : <DailySchedule24h />}
      </div>
    </div>
  );
}
