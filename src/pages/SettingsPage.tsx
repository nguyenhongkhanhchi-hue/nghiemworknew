import { useRef, useState, useEffect } from 'react';
import { useTaskStore, useAuthStore, useSettingsStore, useGamificationStore, useTemplateStore } from '@/stores';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission, canSendNotification } from '@/lib/notifications';
import { exportData, importData } from '@/lib/dataUtils';
import { DEFAULT_VOICE_SETTINGS } from '@/types';
import type { FinanceCategory, CostItem } from '@/types';
import {
  Type, Volume2, Mic, Trash2, Minus, Plus, ChevronDown,
  LogOut, User, Globe, Bell, Download, Upload, Smartphone, Sun, Moon, Shield,
  Wallet, DollarSign, Save, FolderOpen, Clock, Languages, VolumeX,
  Pencil, Copy,
} from 'lucide-react';
import { manualBackup, restoreFromBackupFile, getLastBackupTime } from '@/lib/autoBackup';
import { playSound, getAudioSettings, setMasterVolume, setAudioEnabled, loadAudioSettings } from '@/lib/audioController';
import AdminPage from '@/pages/AdminPage';

const TIMEZONES = [
  { label: 'Việt Nam (GMT+7)', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Nhật Bản (GMT+9)', value: 'Asia/Tokyo' },
  { label: 'Singapore (GMT+8)', value: 'Asia/Singapore' },
  { label: 'Thái Lan (GMT+7)', value: 'Asia/Bangkok' },
  { label: 'Úc (GMT+10)', value: 'Australia/Sydney' },
  { label: 'Mỹ PST (GMT-8)', value: 'America/Los_Angeles' },
  { label: 'Anh (GMT+0)', value: 'Europe/London' },
];

const PRESET_COLORS = ['#34D399', '#60A5FA', '#F87171', '#FBBF24', '#A78BFA', '#FB923C', '#F472B6', '#22D3EE'];

function getOS(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-surface)]'}`}>
      <div className={`size-4 rounded-full bg-white absolute top-1 transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] mb-2 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        </div>
        <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ✅ #8: Finance Categories Settings
function FinanceCategoriesSection() {
  const financeCategories = useSettingsStore(s => s.financeCategories);
  const setFinanceCategories = useSettingsStore(s => s.setFinanceCategories);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newColor, setNewColor] = useState('#34D399');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const cat: FinanceCategory = {
      id: Date.now().toString(36),
      name: newName.trim(),
      type: newType,
      color: newColor,
    };
    setFinanceCategories([...financeCategories, cat]);
    setNewName('');
  };

  const handleRemove = (id: string) => {
    setFinanceCategories(financeCategories.filter(c => c.id !== id));
  };

  const incomes = financeCategories.filter(c => c.type === 'income');
  const expenses = financeCategories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-[var(--accent-primary)] font-semibold mb-1">Hạng mục Thu</p>
        <div className="space-y-1">
          {incomes.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
              <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-xs text-[var(--text-primary)] flex-1">{c.name}</span>
              <button onClick={() => handleRemove(c.id)} className="text-[var(--text-muted)] p-0.5"><Minus size={10} /></button>
            </div>
          ))}
          {incomes.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có hạng mục</p>}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-[var(--error)] font-semibold mb-1">Hạng mục Chi</p>
        <div className="space-y-1">
          {expenses.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
              <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-xs text-[var(--text-primary)] flex-1">{c.name}</span>
              <button onClick={() => handleRemove(c.id)} className="text-[var(--text-muted)] p-0.5"><Minus size={10} /></button>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có hạng mục</p>}
        </div>
      </div>
      {/* Add new */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Thêm hạng mục mới</p>
        <div className="flex gap-1.5 mb-1.5">
          <button onClick={() => setNewType('income')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[28px] ${newType === 'income' ? 'bg-[rgba(52,211,153,0.2)] text-[var(--success)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
            Thu
          </button>
          <button onClick={() => setNewType('expense')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[28px] ${newType === 'expense' ? 'bg-[rgba(248,113,113,0.15)] text-[var(--error)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
            Chi
          </button>
        </div>
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setNewColor(c)}
              className={`size-5 rounded-full flex-shrink-0 ${newColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-elevated)]' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Tên hạng mục..."
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
          <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] text-xs font-medium">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ #9: Cost Items Settings
function CostItemsSection() {
  const costItems = useSettingsStore(s => s.costItems);
  const setCostItems = useSettingsStore(s => s.setCostItems);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'fixed' | 'variable'>('fixed');

  const totalPerMonth = costItems.reduce((s, i) => s + i.amount, 0);
  const costPerHour = totalPerMonth / (30 * 24);
  const costPerMinute = costPerHour / 60;
  const costPerSecond = costPerMinute / 60;

  const handleAdd = () => {
    const amount = parseInt(newAmount.replace(/[^\d]/g, ''));
    if (!newName.trim() || !amount) return;
    const item: CostItem = { id: Date.now().toString(36), name: newName.trim(), amount, type: newType };
    setCostItems([...costItems, item]);
    setNewName(''); setNewAmount('');
  };

  const handleRemove = (id: string) => setCostItems(costItems.filter(i => i.id !== id));

  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-muted)]">
        Liệt kê tất cả chi phí hàng tháng để tính chi phí thời gian chính xác trong trang Dòng tiền.
      </p>
      {/* Summary */}
      {costItems.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl p-3 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Tổng chi phí/tháng: <span className="font-bold text-[var(--error)]">{fmt(totalPerMonth)}</span></p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerHour))}</p><p className="text-[8px] text-[var(--text-muted)]">/giờ</p></div>
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerMinute))}</p><p className="text-[8px] text-[var(--text-muted)]">/phút</p></div>
            <div><p className="text-xs font-bold text-[var(--warning)] font-mono">{fmt(Math.round(costPerSecond * 100) / 100)}</p><p className="text-[8px] text-[var(--text-muted)]">/giây</p></div>
          </div>
        </div>
      )}
      {/* List */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {costItems.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-[var(--text-muted)] w-10 flex-shrink-0">{item.type === 'fixed' ? 'Cố định' : 'Biến động'}</span>
            <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{item.name}</span>
            <span className="text-xs font-bold text-[var(--error)] font-mono">{item.amount.toLocaleString('vi-VN')}đ</span>
            <button onClick={() => handleRemove(item.id)} className="text-[var(--text-muted)]"><Minus size={10} /></button>
          </div>
        ))}
        {costItems.length === 0 && <p className="text-[10px] text-[var(--text-muted)] pl-1">Chưa có chi phí nào</p>}
      </div>
      {/* Add */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex gap-1.5 mb-1.5">
          {(['fixed', 'variable'] as const).map(t => (
            <button key={t} onClick={() => setNewType(t)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] min-h-[28px] ${newType === t ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
              {t === 'fixed' ? 'Cố định' : 'Biến động'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-1.5">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên chi phí (VD: Thuê nhà)"
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
        </div>
        <div className="flex gap-1.5">
          <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Số tiền/tháng (VND)" inputMode="numeric"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[32px]" />
          <button onClick={handleAdd} className="px-3 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] text-xs">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Backup Section ────────────────────────────────────────────────────────────
function BackupSection() {
  const user = useAuthStore(s => s.user);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const lastBackup = getLastBackupTime();

  const handleManualBackup = () => {
    if (!user) return;
    manualBackup(user.id);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setRestoreMsg('');
    const result = await restoreFromBackupFile(file);
    setRestoreMsg(result.message);
    setIsRestoring(false);
    if (result.success && window.confirm(`${result.message}\n\nTải lại ứng dụng ngay?`)) {
      window.location.reload();
    }
    if (restoreRef.current) restoreRef.current.value = '';
  };

  return (
    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
        <Clock size={10} />
        Backup tự động: {lastBackup ? lastBackup.toLocaleString('vi-VN') : 'Chưa có'}
      </p>
      <div className="flex gap-2">
        <button onClick={handleManualBackup}
          className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-green-500/15 text-green-400 min-h-[40px] flex items-center justify-center gap-1.5">
          <Save size={13} /> Backup thủ công
        </button>
        <button onClick={() => restoreRef.current?.click()}
          disabled={isRestoring}
          className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] min-h-[40px] flex items-center justify-center gap-1.5 disabled:opacity-50">
          <FolderOpen size={13} /> Khôi phục
        </button>
      </div>
      {restoreMsg && (
        <p className="text-[10px] text-center text-[var(--success)] bg-green-500/10 rounded-lg px-3 py-2">{restoreMsg}</p>
      )}
      <input ref={restoreRef} type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
      <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
        Backup thủ công tải file JSON về thiết bị. Backup tự động lưu vào bộ nhớ cục bộ mỗi 3 giờ.
        Dùng nút Khôi phục để upload file JSON backup khi cần.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const clearAllData = useTaskStore(s => s.clearAllData);
  const tasks = useTaskStore(s => s.tasks);
  const templates = useTemplateStore(s => s.templates);
  const gamState = useGamificationStore(s => s.state);
  const fontScale = useSettingsStore(s => s.fontScale);
  const hourHeight = useSettingsStore(s => s.hourHeight);
  const setHourHeight = useSettingsStore(s => s.setHourHeight);
  const tickSoundEnabled = useSettingsStore(s => s.tickSoundEnabled);
  const voiceEnabled = useSettingsStore(s => s.voiceEnabled);
  const timezone = useSettingsStore(s => s.timezone);
  
  // Audio settings state
  const [audioEnabled, setAudioEnabledState] = useState(() => getAudioSettings().enabled);
  const [masterVolume, setMasterVolumeState] = useState(() => getAudioSettings().masterVolume * 100);
  const notificationSettings = useSettingsStore(s => s.notificationSettings);
  const voiceSettings = useSettingsStore(s => s.voiceSettings);
  const theme = useSettingsStore(s => s.theme);
  const language = useSettingsStore(s => s.language);
  const setFontScale = useSettingsStore(s => s.setFontScale);
  const setLanguage = useSettingsStore(s => s.setLanguage);
  const setTickSound = useSettingsStore(s => s.setTickSound);
  const setVoiceEnabled = useSettingsStore(s => s.setVoiceEnabled);
  const setTimezone = useSettingsStore(s => s.setTimezone);
  const setNotificationSettings = useSettingsStore(s => s.setNotificationSettings);
  const setVoiceSettings = useSettingsStore(s => s.setVoiceSettings);
  const setTheme = useSettingsStore(s => s.setTheme);
  const dailyScheduleSlots = useSettingsStore(s => s.dailyScheduleSlots);
  const setDailyScheduleSlots = useSettingsStore(s => s.setDailyScheduleSlots);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const os = getOS();
  const installed = isStandalone();
  const notifGranted = canSendNotification();

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [newEncouragement, setNewEncouragement] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState({ 
    name: '', 
    startTime: '09:00', 
    endTime: '10:00', 
    color: '#3B82F6',
    days: [0, 1, 2, 3, 4, 5, 6] as number[], // Every day by default
    description: '',
    icon: 'clock',
    active: true
  });
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const testVoiceText = 'Xin chào! Đây là giọng nói thử nghiệm của Lucy.';

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices.filter(v => v.lang.startsWith('vi') || v.lang.startsWith('en')));
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const fontSizes = [
    { label: 'Nhỏ', value: 0.85 },
    { label: 'Vừa', value: 1 },
    { label: 'Lớn', value: 1.15 },
    { label: 'Rất lớn', value: 1.3 },
  ];

  const handleClear = () => {
    if (window.confirm('Xóa toàn bộ dữ liệu?')) { clearAllData(); window.location.reload(); }
  };

  // ✅ #12: Logout clears session, forces OTP re-login
  const handleLogout = async () => {
    if (user?.id !== 'admin') {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('nw_admin_session');
    }
    logout();
  };

  const handleExport = () => {
    exportData(tasks, templates, gamState, { fontScale, tickSoundEnabled, voiceEnabled, timezone, notificationSettings });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importData(file);
    if (result.error) { alert(result.error); return; }
    if (window.confirm(`Nhập ${result.tasks?.length || 0} việc, ${result.templates?.length || 0} mẫu?`)) {
      const userId = user?.id && user.id !== 'admin' ? user.id : 'admin';
      
      if (result.tasks) {
        localStorage.setItem(`nw_tasks_${userId}`, JSON.stringify(result.tasks));
      }
      if (result.templates) {
        localStorage.setItem(`nw_templates_${userId}`, JSON.stringify(result.templates));
      }
      if (result.gamification) {
        localStorage.setItem(`nw_gamification_${userId}`, JSON.stringify(result.gamification));
      }
      if (result.settings) {
        // Import all settings
        Object.entries(result.settings).forEach(([key, value]) => {
          localStorage.setItem(`nw_${key}`, JSON.stringify(value));
        });
      }
      window.location.reload();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddEncouragement = () => {
    if (!newEncouragement.trim()) return;
    const updated = [...(voiceSettings.encouragements || []), newEncouragement.trim()];
    setVoiceSettings({ encouragements: updated });
    setNewEncouragement('');
  };

  const handleRemoveEncouragement = (idx: number) => {
    const updated = (voiceSettings.encouragements || []).filter((_, i) => i !== idx);
    setVoiceSettings({ encouragements: updated });
  };

  const handleAddTimeSlot = () => {
    if (!newTimeSlot.name.trim()) return;
    
    // Check for time overlap with existing slots (strict - even 1 minute overlap is not allowed)
    let newStart = newTimeSlot.startTime;
    let newEnd = newTimeSlot.endTime;
    
    const [newStartH, newStartM] = newStart.split(':').map(Number);
    const [newEndH, newEndM] = newEnd.split(':').map(Number);
    let newStartMin = newStartH * 60 + newStartM;
    let newEndMin = newEndH * 60 + newEndM;
    
    // Validate time
    if (newEndMin <= newStartMin) {
      alert('Thời gian kết thúc phải lớn hơn thời gian bắt đầu!');
      return;
    }
    
    // Auto-adjust time if overlap detected - shift to after conflicting slot
    let adjusted = false;
    const conflictingSlots = dailyScheduleSlots.filter(slot => {
      if (!slot.startTime || !slot.endTime) return false;
      const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
      const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
      const slotStartMin = slotStartH * 60 + slotStartM;
      const slotEndMin = slotEndH * 60 + slotEndM;
      
      // Strict overlap check - even 1 minute overlap counts as conflict
      return newStartMin < slotEndMin && newEndMin > slotStartMin;
    });
    
    if (conflictingSlots.length > 0) {
      // Find the slot that ends latest among conflicting slots
      const latestEndMin = Math.max(...conflictingSlots.map(slot => {
        const [h, m] = slot.endTime!.split(':').map(Number);
        return h * 60 + m;
      }));
      
      // Auto-adjust: start right after the latest ending slot
      newStartMin = latestEndMin + 1; // 1 minute gap
      newEndMin = newStartMin + (newEndMin - newStartMin);
      
      // If goes past midnight, cap at 23:59
      if (newEndMin > 24 * 60) {
        newEndMin = 24 * 60;
        newStartMin = Math.max(0, newEndMin - 60);
      }
      
      newStart = `${Math.floor(newStartMin / 60).toString().padStart(2, '0')}:${(newStartMin % 60).toString().padStart(2, '0')}`;
      newEnd = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;
      adjusted = true;
    }
    
    const slot = { 
      ...newTimeSlot, 
      startTime: newStart,
      endTime: newEnd,
      id: `slot_${Date.now()}`, 
      color: newTimeSlot.color + '26',
      active: true
    };
    setDailyScheduleSlots([...dailyScheduleSlots, slot]);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [0, 1, 2, 3, 4, 5, 6], description: '', icon: 'clock', active: true });
    
    if (adjusted) {
      alert(`Đã tự động điều chỉnh thời gian để tránh trùng lặp!
Thời gian mới: ${newStart} - ${newEnd}`);
    }
  };

  const handleRemoveTimeSlot = (id: string) => {
    setDailyScheduleSlots(dailyScheduleSlots.filter(s => s.id !== id));
  };

  const handleToggleTimeSlot = (id: string) => {
    setDailyScheduleSlots(dailyScheduleSlots.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  const handleDuplicateTimeSlot = (slot: typeof dailyScheduleSlots[0]) => {
    // Check for time overlap with existing slots
    if (!slot.startTime || !slot.endTime) return;
    
    let newStart = slot.startTime;
    let newEnd = slot.endTime;
    
    const [newStartH, newStartM] = newStart.split(':').map(Number);
    const [newEndH, newEndM] = newEnd.split(':').map(Number);
    let newStartMin = newStartH * 60 + newStartM;
    let newEndMin = newEndH * 60 + newEndM;
    
    // Auto-adjust time if overlap detected - shift to after conflicting slot
    let adjusted = false;
    const duration = newEndMin - newStartMin;
    
    const conflictingSlots = dailyScheduleSlots.filter(s => {
      if (s.id === slot.id || !s.startTime || !s.endTime) return false;
      const [slotStartH, slotStartM] = s.startTime.split(':').map(Number);
      const [slotEndH, slotEndM] = s.endTime.split(':').map(Number);
      const slotStartMin = slotStartH * 60 + slotStartM;
      const slotEndMin = slotEndH * 60 + slotEndM;
      
      // Strict overlap check - even 1 minute overlap counts as conflict
      return newStartMin < slotEndMin && newEndMin > slotStartMin;
    });
    
    if (conflictingSlots.length > 0) {
      // Find the slot that ends latest among conflicting slots
      const latestEndMin = Math.max(...conflictingSlots.map(s => {
        const [h, m] = s.endTime!.split(':').map(Number);
        return h * 60 + m;
      }));
      
      // Auto-adjust: start right after the latest ending slot
      newStartMin = latestEndMin + 1; // 1 minute gap
      newEndMin = newStartMin + duration;
      
      // If goes past midnight, cap at 23:59
      if (newEndMin > 24 * 60) {
        newEndMin = 24 * 60;
        newStartMin = Math.max(0, newEndMin - duration);
      }
      
      newStart = `${Math.floor(newStartMin / 60).toString().padStart(2, '0')}:${(newStartMin % 60).toString().padStart(2, '0')}`;
      newEnd = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;
      adjusted = true;
    }
    
    const newSlot = { 
      ...slot, 
      id: `slot_${Date.now()}`,
      startTime: newStart,
      endTime: newEnd,
      name: `${slot.name} (copy)`
    };
    setDailyScheduleSlots([...dailyScheduleSlots, newSlot]);
    
    if (adjusted) {
      alert(`Đã tự động điều chỉnh thời gian để tránh trùng lặp!
Thời gian mới: ${newStart} - ${newEnd}`);
    }
  };

  const handleEditTimeSlot = (slot: typeof dailyScheduleSlots[0]) => {
    setEditingSlot(slot.id);
    setNewTimeSlot({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      color: slot.color.replace('26', '').replace('40', ''),
      days: slot.days || [0, 1, 2, 3, 4, 5, 6],
      description: slot.description || '',
      icon: slot.icon || 'clock',
      active: slot.active !== false
    });
  };

  const handleUpdateTimeSlot = () => {
    if (!newTimeSlot.name.trim() || !editingSlot) return;
    setDailyScheduleSlots(dailyScheduleSlots.map(s => 
      s.id === editingSlot ? { 
        ...s, 
        ...newTimeSlot, 
        color: newTimeSlot.color + '26' 
      } : s
    ));
    setEditingSlot(null);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [1, 2, 3, 4, 5], description: '', icon: 'clock', active: true });
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '10:00', color: '#3B82F6', days: [1, 2, 3, 4, 5], description: '', icon: 'clock', active: true });
  };

  const quickPresets = [
    { name: 'Giờ làm việc', startTime: '09:00', endTime: '12:00', icon: 'briefcase', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Nghỉ trưa', startTime: '12:00', endTime: '13:00', icon: 'coffee', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Chiều làm việc', startTime: '13:00', endTime: '18:00', icon: 'briefcase', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Tập thể dục', startTime: '18:00', endTime: '19:00', icon: 'dumbbell', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Ngủ', startTime: '22:00', endTime: '06:00', icon: 'moon', days: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Học tập', startTime: '19:00', endTime: '21:00', icon: 'book', days: [0, 1, 2, 3, 4, 5, 6] },
  ];

  const handleApplyPreset = (preset: typeof quickPresets[0]) => {
    const slot = {
      id: `slot_${Date.now()}`,
      name: preset.name,
      startTime: preset.startTime,
      endTime: preset.endTime,
      color: '#3B82F6' + '26',
      days: preset.days,
      description: '',
      icon: preset.icon,
      active: true
    };
    setDailyScheduleSlots([...dailyScheduleSlots, slot]);
  };

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const iconOptions = [
    { value: 'clock', label: '🕐' },
    { value: 'briefcase', label: '💼' },
    { value: 'coffee', label: '☕' },
    { value: 'moon', label: '🌙' },
    { value: 'dumbbell', label: '🏋️' },
    { value: 'book', label: '📚' },
    { value: 'food', label: '🍽️' },
    { value: 'heart', label: '❤️' },
    { value: 'star', label: '⭐' },
  ];

  return (
    <div className="flex flex-col h-full px-4 pb-24 overflow-y-auto" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 24px))' }}>
      <h1 className="text-lg font-bold text-[var(--text-primary)] mb-4">Cài đặt</h1>

      {/* User Info */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] mb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center">
            <User size={18} className="text-[var(--accent-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.username || 'Admin'}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.id === 'admin' ? 'Quản trị viên' : user?.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] min-h-[36px]">
            <LogOut size={12} /> Đăng xuất
          </button>
        </div>
      </div>

      {/* Install App */}
      {!installed && (
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-accent)] mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone size={16} className="text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Cài đặt ứng dụng</span>
          </div>
          {os === 'ios' && (
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>1. Nhấn nút <strong>Chia sẻ</strong> (hình vuông có mũi tên ↑) ở thanh dưới Safari</p>
              <p>2. Cuộn xuống chọn <strong>"Thêm vào Màn hình chính"</strong></p>
              <p>3. Nhấn <strong>"Thêm"</strong> ở góc phải trên</p>
            </div>
          )}
          {os === 'android' && (
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>1. Nhấn nút <strong>⋮</strong> (menu 3 chấm) ở góc phải trên Chrome</p>
              <p>2. Chọn <strong>"Thêm vào Màn hình chính"</strong> hoặc <strong>"Cài đặt ứng dụng"</strong></p>
              <p>3. Nhấn <strong>"Cài đặt"</strong></p>
            </div>
          )}
          {os === 'other' && (
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p>1. Mở bằng Chrome/Edge trên máy tính</p>
              <p>2. Click biểu tượng <strong>cài đặt</strong> trên thanh địa chỉ</p>
              <p>3. Chọn <strong>"Cài đặt"</strong></p>
            </div>
          )}
        </div>
      )}

      <Section title="Giao diện" icon={theme === 'dark' ? <Moon size={16} className="text-[var(--accent-primary)]" /> : <Sun size={16} className="text-[var(--accent-primary)]" />} defaultOpen={true}>
        <div className="flex gap-2">
          <button onClick={() => setTheme('dark')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium min-h-[40px] flex items-center justify-center gap-1.5 ${theme === 'dark' ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
            <Moon size={14} /> Tối
          </button>
          <button onClick={() => setTheme('light')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium min-h-[40px] flex items-center justify-center gap-1.5 ${theme === 'light' ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
            <Sun size={14} /> Sáng
          </button>
        </div>
      </Section>

      <Section title="Ngôn ngữ" icon={<Languages size={16} className="text-[var(--accent-primary)]" />}>
        <div className="flex gap-2">
          <button onClick={() => setLanguage('vi')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium min-h-[40px] flex items-center justify-center gap-1.5 ${language === 'vi' ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
            🇻🇳 Tiếng Việt
          </button>
          <button onClick={() => setLanguage('en')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium min-h-[40px] flex items-center justify-center gap-1.5 ${language === 'en' ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
            🇺🇸 English
          </button>
        </div>
      </Section>

      <Section title="Cỡ chữ" icon={<Type size={16} className="text-[var(--accent-primary)]" />}>
        <div className="grid grid-cols-4 gap-1.5">
          {fontSizes.map(({ label, value }) => (
            <button key={value} onClick={() => setFontScale(value)}
              className={`py-2 rounded-lg text-[11px] font-medium min-h-[36px] ${fontScale === value ? 'bg-[rgba(0,229,204,0.2)] text-[var(--accent-primary)] border border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-2">
          <button onClick={() => setFontScale(Math.round((fontScale - 0.05) * 100) / 100)} className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)]"><Minus size={14} /></button>
          <p className="text-[var(--text-primary)] font-medium" style={{ fontSize: `${16 * fontScale}px` }}>Xem trước</p>
          <button onClick={() => setFontScale(Math.round((fontScale + 0.05) * 100) / 100)} className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)]"><Plus size={14} /></button>
        </div>
        
        {/* Hour Height Slider - Schedule View */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[var(--text-muted)]">Khoảng cách giờ Lịch biểu</span>
            <span className="text-[10px] text-[var(--text-muted)]">{hourHeight}px</span>
          </div>
          <input
            type="range"
            min="30"
            max="1200"
            value={hourHeight}
            onChange={e => setHourHeight(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${((hourHeight - 30) / 1170) * 100}%, var(--bg-surface) ${((hourHeight - 30) / 1170) * 100}%, var(--bg-surface) 100%)`,
            }}
          />
          <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
            <span>30px</span>
            <span>1200px</span>
          </div>
        </div>
      </Section>

      <Section title="Múi giờ" icon={<Globe size={16} className="text-[var(--accent-primary)]" />}>
        <select value={timezone} onChange={e => setTimezone(e.target.value)}
          className="w-full bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[40px]">
          {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </Section>

      <Section title="Thông báo" icon={<Bell size={16} className="text-[var(--accent-primary)]" />}>
        {!notifGranted ? (
          <button onClick={async () => { const g = await requestNotificationPermission(); if (g) setNotificationSettings({ enabled: true }); }}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-[var(--bg-base)] bg-[var(--accent-primary)] min-h-[40px]">
            Bật thông báo
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Nhắc deadline</span>
              <Toggle value={notificationSettings.enabled} onChange={v => setNotificationSettings({ enabled: v })} />
            </div>
            {notificationSettings.enabled && (
              <div className="flex gap-1.5">
                {[5, 15, 30, 60].map(m => (
                  <button key={m} onClick={() => setNotificationSettings({ beforeDeadline: m })}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[30px] ${notificationSettings.beforeDeadline === m ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                    {m < 60 ? `${m}p` : '1h'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ✅ Daily Schedule Time Slots */}
      <Section title="Thời gian biểu hàng ngày" icon={<Clock size={16} className="text-[var(--accent-primary)]" />} defaultOpen={true}>
        <div className="space-y-3">
          <p className="text-[10px] text-[var(--text-muted)]">Các mốc thời gian cố định hiển thị trên lịch biểu</p>
          
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="text-[10px] text-[var(--text-muted)] mr-1">Mẫu:</span>
            {quickPresets.map((preset, idx) => (
              <button 
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] text-[10px] text-[var(--text-secondary)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent-primary)] transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Existing Slots List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dailyScheduleSlots.map(slot => (
              <div 
                key={slot.id} 
                className={`flex items-center gap-2 bg-[var(--bg-surface)] rounded-lg p-2 ${!slot.active ? 'opacity-50' : ''}`}
              >
                <button 
                  onClick={() => handleToggleTimeSlot(slot.id)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${slot.active ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'}`}
                >
                  <div className={`size-3 rounded-full bg-white absolute top-1 transition-transform ${slot.active ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: slot.color }} />
                <span className="text-xs text-[var(--text-primary)] flex-1 min-w-0 truncate">{slot.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{slot.startTime}-{slot.endTime}</span>
                <div className="flex gap-0.5">
                  <button 
                    onClick={() => handleEditTimeSlot(slot)} 
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] p-1"
                    title="Sửa"
                  >
                    <Pencil size={10} />
                  </button>
                  <button 
                    onClick={() => handleDuplicateTimeSlot(slot)} 
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] p-1"
                    title="Nhân bản"
                  >
                    <Copy size={10} />
                  </button>
                  <button 
                    onClick={() => handleRemoveTimeSlot(slot.id)} 
                    className="text-[var(--text-muted)] hover:text-red-500 p-1"
                    title="Xóa"
                  >
                    <Minus size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Edit Form */}
          <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
            <p className="text-[10px] text-[var(--accent-primary)] font-medium">
              {editingSlot ? '✏️ Chỉnh sửa mốc thời gian' : '➕ Thêm mốc thời gian mới'}
            </p>
            
            {/* Name Input */}
            <input
              type="text"
              value={newTimeSlot.name}
              onChange={e => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
              placeholder="Tên (VD: Nghỉ trưa)"
              className="w-full bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px]"
            />
            
            {/* Time Inputs */}
            <div className="flex gap-1">
              <div className="flex-1">
                <label className="text-[9px] text-[var(--text-muted)] block mb-1">Bắt đầu</label>
                <input
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={e => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-[var(--text-muted)] block mb-1">Kết thúc</label>
                <input
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={e => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px]"
                />
              </div>
            </div>
            
            {/* Days of Week */}
            <div>
              <label className="text-[9px] text-[var(--text-muted)] block mb-1">Ngày trong tuần</label>
              <div className="flex gap-1">
                {dayNames.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const days = newTimeSlot.days || [];
                      if (days.includes(idx)) {
                        setNewTimeSlot({ ...newTimeSlot, days: days.filter(d => d !== idx) });
                      } else {
                        setNewTimeSlot({ ...newTimeSlot, days: [...days, idx] });
                      }
                    }}
                    className={`w-8 h-7 rounded-lg text-[10px] font-medium transition-colors ${
                      (newTimeSlot.days || []).includes(idx) 
                        ? 'bg-[var(--accent-primary)] text-[var(--bg-base)]' 
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Icon & Color */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-[var(--text-muted)] block mb-1">Biểu tượng</label>
                <div className="flex gap-1">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      onClick={() => setNewTimeSlot({ ...newTimeSlot, icon: icon.value })}
                      className={`w-8 h-7 rounded-lg text-xs flex items-center justify-center transition-colors ${
                        newTimeSlot.icon === icon.value 
                          ? 'bg-[var(--accent-primary)] text-[var(--bg-base)]' 
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {icon.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-[var(--text-muted)] block mb-1">Màu</label>
                <select
                  value={newTimeSlot.color}
                  onChange={e => setNewTimeSlot({ ...newTimeSlot, color: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs outline-none border border-[var(--border-subtle)] min-h-[32px]"
                >
                  <option value="#3B82F6">🔵 Xanh dương</option>
                  <option value="#FBBF24">🟡 Vàng</option>
                  <option value="#34D399">🟢 Xanh lá</option>
                  <option value="#F87171">🔴 Đỏ</option>
                  <option value="#A855F7">🟣 Tím</option>
                  <option value="#F472B6">🔴 Hồng</option>
                  <option value="#FB923C">🟠 Cam</option>
                  <option value="#22D3EE">🔵 Cyan</option>
                </select>
              </div>
            </div>
            
            {/* Description */}
            <input
              type="text"
              value={newTimeSlot.description}
              onChange={e => setNewTimeSlot({ ...newTimeSlot, description: e.target.value })}
              placeholder="Mô tả (tùy chọn)"
              className="w-full bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[32px]"
            />
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {editingSlot ? (
                <>
                  <button
                    onClick={handleUpdateTimeSlot}
                    disabled={!newTimeSlot.name.trim()}
                    className="flex-1 bg-[var(--accent-primary)] text-[var(--bg-base)] rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
                  >
                    💾 Lưu
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 bg-[var(--bg-surface)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-xs font-medium"
                  >
                    Hủy
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddTimeSlot}
                  disabled={!newTimeSlot.name.trim()}
                  className="w-full bg-[var(--accent-dim)] text-[var(--accent-primary)] rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
                >
                  ➕ Thêm mốc thời gian
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ✅ #8: Finance Categories */}
      <Section title="Hạng mục Thu/Chi" icon={<Wallet size={16} className="text-[var(--accent-primary)]" />}>
        <FinanceCategoriesSection />
      </Section>

      {/* ✅ #9: Cost Items */}
      <Section title="Cài đặt Chi phí" icon={<DollarSign size={16} className="text-[var(--accent-primary)]" />}>
        <CostItemsSection />
      </Section>

      <Section title="Âm thanh & Giọng nói" icon={<Volume2 size={16} className="text-[var(--accent-primary)]" />}>
        <div className="space-y-3">
          {/* Master Audio Toggle }}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {audioEnabled ? <Volume2 size={14} className="text-[var(--accent-primary)]" /> : <VolumeX size={14} className="text-[var(--text-muted)]" />}
              <span className="text-xs text-[var(--text-secondary)]">Âm thanh hệ thống</span>
            </div>
            <Toggle value={audioEnabled} onChange={v => { setAudioEnabledState(v); setAudioEnabled(v); }} />
          </div>
          
          {/* Master Volume Slider */}
          {audioEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">Âm lượng chính</span>
                <span className="text-[10px] text-[var(--text-muted)]">{Math.round(masterVolume)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={e => {
                  const vol = Number(e.target.value) / 100;
                  setMasterVolumeState(Number(e.target.value));
                  setMasterVolume(vol);
                }}
                onMouseUp={() => playSound('click')}
                onTouchEnd={() => playSound('click')}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${masterVolume}%, var(--bg-surface) ${masterVolume}%, var(--bg-surface) 100%)`,
                }}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Tiếng tik-tak</span>
            <Toggle value={tickSoundEnabled} onChange={v => { setTickSound(v); if(v) playSound('click'); }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]"><Mic size={12} className="inline mr-1" />Lucy (giọng nữ)</span>
            <Toggle value={voiceEnabled} onChange={setVoiceEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">AI trả lời bằng giọng</span>
            <Toggle value={voiceSettings.aiVoiceResponse} onChange={v => setVoiceSettings({ aiVoiceResponse: v })} />
          </div>

          {voiceEnabled && (
            <>
              {availableVoices.length > 0 && (
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block mb-1">Chọn giọng</span>
                  <select value={voiceSettings.voiceName} onChange={e => setVoiceSettings({ voiceName: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[34px]">
                    <option value="">Mặc định</option>
                    {availableVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                  </select>
                </div>
              )}
              <button onClick={() => {
                if ('speechSynthesis' in window) {
                  const utterance = new SpeechSynthesisUtterance(testVoiceText);
                  utterance.rate = voiceSettings.rate;
                  utterance.pitch = voiceSettings.pitch;
                  if (voiceSettings.voiceName) {
                    const voice = availableVoices.find(v => v.name === voiceSettings.voiceName);
                    if (voice) utterance.voice = voice;
                  }
                  window.speechSynthesis.speak(utterance);
                }
              }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[var(--accent-dim)] text-[var(--accent-primary)] min-h-[40px] flex items-center justify-center gap-2">
                <Volume2 size={14} /> Nghe thử giọng nói
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">Tốc độ: {voiceSettings.rate.toFixed(1)}</span>
                  <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate} onChange={e => setVoiceSettings({ rate: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]" />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">Cao độ: {voiceSettings.pitch.toFixed(1)}</span>
                  <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.pitch} onChange={e => setVoiceSettings({ pitch: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]" />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block mb-1">Khoảng báo giờ (giây)</span>
                <div className="flex gap-1.5">
                  {[15, 30, 60, 120].map(s => (
                    <button key={s} onClick={() => setVoiceSettings({ chimeInterval: s })}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium min-h-[30px] ${voiceSettings.chimeInterval === s ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block mb-1">Câu động viên ({voiceSettings.encouragements?.length || 0})</span>
                <div className="max-h-24 overflow-y-auto space-y-1 mb-1.5">
                  {(voiceSettings.encouragements || []).map((msg, i) => (
                    <div key={i} className="flex items-center gap-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1">
                      <span className="text-[10px] text-[var(--text-secondary)] flex-1 truncate">{msg}</span>
                      <button onClick={() => handleRemoveEncouragement(i)} className="text-[var(--text-muted)] flex-shrink-0"><Minus size={10} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input type="text" value={newEncouragement} onChange={e => setNewEncouragement(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddEncouragement()}
                    placeholder="Thêm câu động viên..." className="flex-1 bg-[var(--bg-surface)] rounded-lg px-2 py-1.5 text-[10px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] min-h-[28px]" />
                  <button onClick={handleAddEncouragement} className="px-2 py-1 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-primary)] text-[10px]"><Plus size={12} /></button>
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Sao lưu dữ liệu" icon={<Download size={16} className="text-[var(--accent-primary)]" />}>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex-1 py-2.5 rounded-xl text-xs font-medium text-[var(--accent-primary)] bg-[var(--accent-dim)] min-h-[40px] flex items-center justify-center gap-1.5">
            <Download size={14} /> Xuất
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] min-h-[40px] flex items-center justify-center gap-1.5">
            <Upload size={14} /> Nhập
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <BackupSection />
      </Section>

      <Section title="Nguy hiểm" icon={<Trash2 size={16} className="text-[var(--error)]" />}>
        <button onClick={handleClear} className="w-full py-2.5 rounded-xl text-xs font-medium text-[var(--error)] bg-[rgba(248,113,113,0.1)] min-h-[40px] flex items-center justify-center gap-1.5">
          <Trash2 size={14} /> Xóa toàn bộ dữ liệu
        </button>
      </Section>

      {user?.id === 'admin' && (
        <Section title="Quản trị" icon={<Shield size={16} className="text-[var(--warning)]" />}>
          <button onClick={() => setShowAdmin(!showAdmin)}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] min-h-[40px] flex items-center justify-center gap-1.5">
            <Shield size={14} /> {showAdmin ? 'Đóng Admin' : 'Mở Admin'}
          </button>
          {showAdmin && (
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <AdminPage />
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
