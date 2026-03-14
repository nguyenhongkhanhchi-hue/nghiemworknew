import { DailySchedule24h } from '@/components/features/DailySchedule24h';
import { useSettingsStore, useAuthStore } from '@/stores';
import { useState, useEffect } from 'react';
import { getNowInTimezone } from '@/lib/notifications';
import { updateUserLastActive } from '@/lib/userTracking';
import { Slider } from '@/components/ui/slider';

export default function SchedulePage() {
  const timezone = useSettingsStore(s => s.timezone);
  const user = useAuthStore(s => s.user);
  const hourHeight = useSettingsStore(s => s.hourHeight);
  const setHourHeight = useSettingsStore(s => s.setHourHeight);
  
  // Safe timezone fallback
  const safeTimezone = timezone || 'Asia/Ho_Chi_Minh';
  const [now, setNow] = useState(() => getNowInTimezone(safeTimezone));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => {
      try {
        setNow(getNowInTimezone(safeTimezone));
      } catch (e) {
        console.error('Error updating time:', e);
      }
    }, 1000);
    return () => clearInterval(i);
  }, [safeTimezone]);

  // Update last active
  useEffect(() => {
    if (user?.id) {
      try {
        updateUserLastActive(user.id);
      } catch (e) {
        console.error('Error updating last active:', e);
      }
    }
  }, [user]);

  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dayName = dayNames[now.getDay()];
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full px-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">{dayName}</p>
            <p className="text-base font-bold text-[var(--text-primary)]">{dateStr}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-mono font-bold text-[var(--accent-primary)] tabular-nums">{timeStr}</p>
        </div>
      </div>

      {/* Hour Height Adjustment Slider */}
      <div className="flex items-center gap-3 pb-2">
        <span className="text-xs text-[var(--text-muted)]">📏</span>
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

      {/* Schedule Content */}
      <DailySchedule24h />
    </div>
  );
}
