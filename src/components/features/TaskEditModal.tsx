import { useState } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { X, Save, Check, ChevronDown, Plus, Trash2, Bell } from 'lucide-react';
import type { Task, RecurringType, TaskFinance, TaskCategory } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { toast } from '@/lib/toast';

// Collapsible Option Component (giống TemplatesPage)
function CollapsibleOption({
  label,
  active,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  active: boolean;
  expanded?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded !== undefined ? expanded : active;
  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] overflow-hidden mb-2 flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <div
            className={`size-4 rounded border flex items-center justify-center flex-shrink-0 ${
              active
                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'border-[var(--text-muted)]'
            }`}
          >
            {active && <Check size={10} className="text-[var(--bg-base)]" />}
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {label}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-muted)] transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-0 border-t border-[var(--border-subtle)] flex-shrink-0 order-last">
          {children}
        </div>
      )}
    </div>
  );
}

interface TaskEditModalProps { task: Task; onClose: () => void; }

export function TaskEditModal({ task, onClose }: TaskEditModalProps) {
  const updateTask = useTaskStore(s => s.updateTask);
  const financeCategories = useSettingsStore(s => s.financeCategories);

  const [title, setTitle] = useState(task.title);
  const now = new Date();
  const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Collapsible states
  const [showDeadline, setShowDeadline] = useState(task.showDeadline ?? !!task.deadline);
  const [expandedDeadline, setExpandedDeadline] = useState(task.showDeadline ?? !!task.deadline);
  const [deadlineDate, setDeadlineDate] = useState(task.deadlineDate || nowDate);
  const [deadlineTime, setDeadlineTime] = useState(task.deadlineTime || nowTime);
  
  const [showRecurring, setShowRecurring] = useState(task.showRecurring ?? task.recurring?.type !== 'none');
  const [expandedRecurring, setExpandedRecurring] = useState(task.showRecurring ?? task.recurring?.type !== 'none');
  const [recurringType, setRecurringType] = useState<RecurringType>(task.recurring?.type || 'none');
  
  const [showFinance, setShowFinance] = useState(task.showFinance ?? !!task.finance);
  const [expandedFinance, setExpandedFinance] = useState(task.showFinance ?? !!task.finance);
  
  // Finance entries - convert single finance to array
  const [financeEntries, setFinanceEntries] = useState<Array<{id: string} & TaskFinance>>(() => {
    if (task.finance) {
      return [{ id: crypto.randomUUID(), ...task.finance }];
    }
    return [];
  });

  // Filter categories by type
  const filteredCategories = (type: 'income' | 'expense') => 
    financeCategories.filter(c => c.type === type);

  const addFinanceEntry = () => {
    setFinanceEntries([...financeEntries, { 
      id: crypto.randomUUID(), 
      type: 'expense', 
      amount: 0 
    }]);
  };

  const updateFinanceEntry = (index: number, entry: {id: string} & TaskFinance) => {
    const updated = [...financeEntries];
    updated[index] = entry;
    setFinanceEntries(updated);
  };

  const removeFinanceEntry = (index: number) => {
    setFinanceEntries(financeEntries.filter((_, i) => i !== index));
  };
  
  const [showNotes, setShowNotes] = useState(task.showNotes ?? !!task.notes);
  const [expandedNotes, setExpandedNotes] = useState(task.showNotes ?? !!task.notes);
  const [notes, setNotes] = useState(task.notes || '');
  
  const [showCategory, setShowCategory] = useState(!!task.category);
  const [expandedCategory, setExpandedCategory] = useState(!!task.category);
  const [category, setCategory] = useState<TaskCategory | undefined>(task.category);

  // Reminder
  const [showReminder, setShowReminder] = useState(task.reminderEnabled ?? false);
  const [expandedReminder, setExpandedReminder] = useState(task.reminderEnabled ?? false);
  const [reminderMinutes, setReminderMinutes] = useState(task.reminderMinutes ?? 15);
  const [reminderRepeat, setReminderRepeat] = useState(task.reminderRepeat ?? 1);

  const handleSave = () => {
    if (!title.trim()) {
      toast.warning('Vui lòng nhập tên việc');
      return;
    }
    
    let deadline: number | undefined;
    if (showDeadline && deadlineDate) {
      deadline = new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`).getTime();
    }
    
    // Auto quadrant: always auto-calculate based on deadline
    const manualQuadrant = undefined;
    
    updateTask(task.id, {
      title: title.trim(),
      quadrant: manualQuadrant, // Will trigger auto-calculation in store
      deadline,
      deadlineDate: showDeadline ? deadlineDate : undefined,
      deadlineTime: showDeadline ? deadlineTime : undefined,
      recurring: { type: showRecurring ? recurringType : 'none' },
      notes: showNotes ? notes : undefined,
      finance: financeEntries.length > 0 ? {
        type: financeEntries.reduce((s, e) => e.type === 'income' ? s + e.amount : s, 0) >= 
              financeEntries.reduce((s, e) => e.type === 'expense' ? s + e.amount : s, 0) ? 'income' : 'expense',
        amount: financeEntries.reduce((s, e) => s + e.amount, 0),
      } : undefined,
      showDeadline, showRecurring, showFinance, showNotes,
      category: showCategory ? category : undefined,
      reminderEnabled: showReminder ? true : undefined,
      reminderMinutes: showReminder ? reminderMinutes : undefined,
      reminderRepeat: showReminder ? reminderRepeat : undefined,
    });
    
    toast.success('Đã cập nhật việc');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] bg-[var(--bg-elevated)] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Chỉnh sửa</h2>
          <div className="flex gap-1.5">
            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] text-[var(--bg-base)] min-h-[32px]"><Save size={12} /> Lưu</button>
            <button onClick={onClose} className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)]"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {/* Title */}
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-[var(--bg-surface)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] min-h-[44px]" />

          {/* Deadline */}
          <CollapsibleOption
            label="⏰ Hạn chót"
            active={showDeadline}
            expanded={expandedDeadline}
            onToggle={() => { setShowDeadline(!showDeadline); setExpandedDeadline(!showDeadline); }}
          >
            <div className="flex gap-2 pt-3">
              <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-2 py-2 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[34px]" />
              <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-2 py-2 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[34px]" />
            </div>
          </CollapsibleOption>

          {/* Reminder - Nhắc nhở với thông báo đẩy + giọng nói */}
          <CollapsibleOption
            label="🔔 Nhắc nhở"
            active={showReminder}
            expanded={expandedReminder}
            onToggle={() => { setShowReminder(!showReminder); setExpandedReminder(!showReminder); }}
          >
            <div className="space-y-2 pt-3">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-[var(--text-muted)]">Nhắc trước</span>
                <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}
                  className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[34px]">
                  <option value={5}>5 phút</option>
                  <option value={10}>10 phút</option>
                  <option value={15}>15 phút</option>
                  <option value={30}>30 phút</option>
                  <option value={60}>1 giờ</option>
                  <option value={120}>2 giờ</option>
                  <option value={1440}>1 ngày</option>
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-[var(--text-muted)]">Lặp lại</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map(n => (
                    <button key={n} onClick={() => setReminderRepeat(n)}
                      className={`size-8 rounded-lg text-xs font-bold ${reminderRepeat === n ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[var(--text-muted)]">lần</span>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] flex items-center gap-1">
                <Bell size={10} /> Sẽ gửi thông báo đẩy + giọng nói khi đến giờ
              </p>
            </div>
          </CollapsibleOption>

          {/* Recurring */}
          <CollapsibleOption
            label="🔁 Lặp lại"
            active={showRecurring}
            expanded={expandedRecurring}
            onToggle={() => { setShowRecurring(!showRecurring); setExpandedRecurring(!showRecurring); }}
          >
            <div className="grid grid-cols-3 gap-1.5 pt-3">
              {(['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly'] as RecurringType[]).map(r => (
                <button key={r} onClick={() => setRecurringType(r)}
                  className={`py-1.5 rounded-lg text-[9px] font-medium min-h-[30px] ${recurringType === r ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {r === 'none' ? 'Không' : r === 'daily' ? 'Hàng ngày' : r === 'weekdays' ? 'T2-T6' : r === 'weekly' ? 'Hàng tuần' : r === 'biweekly' ? '2 tuần' : 'Hàng tháng'}
                </button>
              ))}
            </div>
          </CollapsibleOption>

          {/* Category */}
          <CollapsibleOption
            label="🏷️ Danh mục"
            active={showCategory}
            expanded={expandedCategory}
            onToggle={() => { setShowCategory(!showCategory); setExpandedCategory(!showCategory); }}
          >
            <div className="grid grid-cols-4 gap-1.5 pt-3">
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map(cat => {
                const cfg = CATEGORY_LABELS[cat];
                return (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`py-2 rounded-lg text-[9px] font-medium min-h-[36px] flex flex-col items-center justify-center gap-0.5 ${category === cat ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                    <span className="text-sm">{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </CollapsibleOption>

          {/* Finance - Multiple entries */}
          <CollapsibleOption
            label="💰 Thu/Chi"
            active={showFinance}
            expanded={expandedFinance}
            onToggle={() => { setShowFinance(!showFinance); setExpandedFinance(!showFinance); }}
          >
            {financeEntries.length === 0 ? (
              <button
                onClick={() => addFinanceEntry()}
                className="w-full mt-3 py-2 rounded-lg border border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-muted)] flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Thêm khoản thu/chi
              </button>
            ) : (
              <div className="space-y-2 mt-3">
                {financeEntries.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-2 items-start">
                    <select
                      value={entry.type}
                      onChange={(e) => updateFinanceEntry(idx, { ...entry, type: e.target.value as 'income' | 'expense' })}
                      className="bg-[var(--bg-elevated)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px]"
                    >
                      <option value="income">Thu</option>
                      <option value="expense">Chi</option>
                    </select>
                    <select
                      value={entry.categoryId || ''}
                      onChange={(e) => updateFinanceEntry(idx, { ...entry, categoryId: e.target.value })}
                      className="bg-[var(--bg-elevated)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px] flex-1"
                    >
                      <option value="">Chọn hạng mục</option>
                      {filteredCategories(entry.type).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={entry.amount || ''}
                      onChange={(e) => updateFinanceEntry(idx, { ...entry, amount: Math.max(0, parseInt(e.target.value) || 0) })}
                      placeholder="Số tiền"
                      className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px] font-mono"
                      inputMode="numeric"
                    />
                    <button
                      onClick={() => removeFinanceEntry(idx)}
                      className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addFinanceEntry}
                  className="w-full py-2 rounded-lg border border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-muted)] flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Thêm khoản khác
                </button>
              </div>
            )}
          </CollapsibleOption>

          {/* Notes */}
          <CollapsibleOption
            label="📝 Ghi chú"
            active={showNotes}
            expanded={expandedNotes}
            onToggle={() => { setShowNotes(!showNotes); setExpandedNotes(!showNotes); }}
          >
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú..." rows={3}
              className="w-full mt-3 bg-[var(--bg-elevated)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] resize-none" />
          </CollapsibleOption>
        </div>
      </div>
    </div>
  );
}
