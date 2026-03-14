import { create } from 'zustand';
import type {
  Task, ChatMessage, TimerState, TabType, PageType,
  EisenhowerQuadrant, RecurringConfig, UserProfile,
  GamificationState, NotificationSettings, Reward,
  TaskTemplate, TaskFinance, Achievement, Topic, VoiceSettings,
  TaskCategory, ThemeMode, FinanceCategory, CostItem, Language,
  TimerEvent, TaskStatus,
} from '@/types';
import { DEFAULT_VOICE_SETTINGS } from '@/types';
import { calculateLevel, checkAchievement, getDefaultGamificationState } from '@/lib/gamification';
import { getNowInTimezone } from '@/lib/notifications';
import { calculateQuadrant, isTaskOverdue } from '@/lib/autoQuadrant';
import { toast } from '@/lib/toast';
import {
  loadTasksFromDB, saveTasksToDB,
  loadTemplatesFromDB, saveTemplatesToDB,
  loadTopicsFromDB, saveTopicsToDB,
  loadGamificationFromDB, saveGamificationToDB,
  loadChatMessagesFromDB, saveChatMessagesToDB,
  migrateLocalStorageToDatabase,
} from '@/lib/dataSync';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getUserKey(base: string, userId?: string): string {
  return userId ? `${base}_${userId}` : base;
}
function loadFromStorage<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function saveToStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Helper to add timer event to a task
function addTimerEvent(task: Task, eventType: TimerEvent['type']): Task {
  const now = Date.now();
  const nowDate = new Date(now);
  const actualTime = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
  
  const event: TimerEvent = {
    id: `te_${now}_${Math.random().toString(36).substr(2, 9)}`,
    taskId: task.id,
    type: eventType,
    timestamp: now,
    actualTime,
  };
  
  const timerEvents = task.timerEvents || [];
  const newEvents = [...timerEvents, event];
  
  // Calculate pause count
  const pauseCount = newEvents.filter(e => e.type === 'pause').length;
  
  return {
    ...task,
    timerEvents: newEvents,
    pauseCount,
  };
}

// Helper to calculate reliability score and late minutes
function calculateReliabilityMetrics(task: Task, actualStartTime?: number, actualEndTime?: number): Partial<Task> {
  const metrics: Partial<Task> = {};
  
  // Get planned start time (from task.startTime)
  if (task.startTime) {
    const [plannedHour, plannedMin] = task.startTime.split(':').map(Number);
    const today = new Date();
    const plannedStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), plannedHour, plannedMin).getTime();
    
    // Calculate late minutes if actualStartTime exists
    if (actualStartTime) {
      const lateMinutes = Math.round((actualStartTime - plannedStart) / 60000); // difference in minutes
      metrics.lateMinutes = lateMinutes;
      
      // Start status with 5% tolerance (of 60 min = 3 minutes)
      const toleranceMinutes = 3;
      if (lateMinutes <= -toleranceMinutes) {
        metrics.startStatus = 'early';
      } else if (lateMinutes >= toleranceMinutes) {
        metrics.startStatus = 'late';
      } else {
        metrics.startStatus = 'on_time';
      }
      
      metrics.actualStartTime = actualStartTime;
    }
    
    // Calculate expected end time (planned start + duration)
    if (task.duration) {
      const plannedDurationMs = task.duration * 60 * 1000;
      const expectedEnd = plannedStart + plannedDurationMs;
      metrics.expectedEndTime = expectedEnd;
      metrics.plannedDuration = task.duration;
    }
  }
  
  // Calculate end status if actualEndTime exists
  if (actualEndTime && metrics.expectedEndTime) {
    const lateMinutes = Math.round((actualEndTime - metrics.expectedEndTime) / 60000);
    const toleranceMinutes = metrics.plannedDuration ? Math.round(metrics.plannedDuration * 0.05) : 3; // 5% tolerance
    
    if (lateMinutes <= -toleranceMinutes) {
      metrics.endStatus = 'early';
    } else if (lateMinutes >= toleranceMinutes) {
      metrics.endStatus = 'late';
    } else {
      metrics.endStatus = 'on_time';
    }
    
    metrics.actualEndTime = actualEndTime;
  }
  
  // Calculate reliability score (0-100%)
  // Based on how close actual times are to planned times
  if (metrics.startStatus && metrics.endStatus) {
    let score = 100;
    
    // Deduct for late start (max 30 points)
    if (metrics.lateMinutes && metrics.lateMinutes > 0) {
      score -= Math.min(30, metrics.lateMinutes); // 1 point per minute late
    }
    
    // Deduct for late end (max 40 points)
    const endLateMinutes = metrics.actualEndTime && metrics.expectedEndTime 
      ? Math.round((metrics.actualEndTime - metrics.expectedEndTime) / 60000) 
      : 0;
    if (endLateMinutes > 0) {
      score -= Math.min(40, endLateMinutes);
    }
    
    // Bonus for early completion (max 10 points)
    if (metrics.endStatus === 'early') {
      score += 10;
    }
    
    metrics.reliabilityScore = Math.max(0, Math.min(100, score));
  }
  
  return metrics;
}

// ──────────── AUTH STORE ────────────
interface AuthStore {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null }),
}));

// ──────────── TASK STORE ────────────
interface TaskStore {
  tasks: Task[];
  activeTab: TabType;
  timer: TimerState;
  _userId: string | undefined;
  _version: number;
  initForUser: (userId?: string) => void;
  setActiveTab: (tab: TabType) => void;
  addTask: (title: string, manualQuadrant?: 'delegate' | 'eliminate', deadline?: number, recurring?: RecurringConfig, deadlineDate?: string, deadlineTime?: string, finance?: TaskFinance, templateId?: string, isGroup?: boolean, opts?: { showDeadline?: boolean; showRecurring?: boolean; showFinance?: boolean; showNotes?: boolean; notes?: string; groupTemplateIds?: string[]; startDate?: string; startTime?: string; duration?: number }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string) => void;
  restoreTask: (id: string) => void;
  reorderTasks: (fromId: string, toId: string) => void;
  startTimer: (taskId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  tickTimer: () => void;
  clearAllData: () => void;
  checkAndMarkOverdue: () => void;
  bumpVersion: () => void;
}

const defaultTimer: TimerState = {
  taskId: null, isRunning: false, isPaused: false, elapsed: 0,
  startTime: null, pausedAt: null, totalPausedDuration: 0,
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTab: 'pending',
  timer: { ...defaultTimer },
  _userId: undefined,
  _version: 0,

  initForUser: async (userId) => {
    // ✅ #7: Restore timer accurately based on wall-clock time
    const restoreTimer = (): TimerState => {
      const saved = loadFromStorage<TimerState | null>(getUserKey('nw_timer', userId), null);
      if (!saved) return { ...defaultTimer };
      if (saved.isRunning && saved.startTime) {
        // Recalculate elapsed based on actual elapsed wall-clock time
        const elapsed = Math.floor((Date.now() - saved.startTime) / 1000) - saved.totalPausedDuration;
        return { ...saved, elapsed: Math.max(0, elapsed) };
      }
      if (saved.isPaused) return { ...saved };
      return { ...defaultTimer };
    };

    if (userId === 'admin') {
      const key = getUserKey('nw_tasks', userId);
      set({ tasks: loadFromStorage<Task[]>(key, []), _userId: userId, timer: restoreTimer() });
      get().checkAndMarkOverdue();
      return;
    }

    await migrateLocalStorageToDatabase(userId);
    // ✅ #11: Always load from DB first for multi-device sync
    const tasksFromDB = await loadTasksFromDB(userId);
    set({ tasks: tasksFromDB, _userId: userId, timer: restoreTimer() });
    get().checkAndMarkOverdue();
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  bumpVersion: () => set(s => ({ _version: s._version + 1 })),

  addTask: (title, manualQuadrant, deadline, recurring = { type: 'none' }, deadlineDate, deadlineTime, finance, templateId, isGroup, opts) => {
    const tasks = get().tasks;
    const userId = get()._userId;
    const id = generateId();
    
    const quadrant = calculateQuadrant(deadline, manualQuadrant);
    
    // Calculate expectedEndTime if startTime and duration are provided
    let expectedEndTime: number | undefined;
    if (opts?.startTime && opts?.duration && opts?.startDate) {
      const [hours, minutes] = opts.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const expectedMinutes = startMinutes + opts.duration;
      const [year, month, day] = opts.startDate.split('-').map(Number);
      const expectedDate = new Date(year!, month! - 1, day!);
      expectedDate.setHours(Math.floor(expectedMinutes / 60));
      expectedDate.setMinutes(expectedMinutes % 60);
      expectedDate.setSeconds(0);
      expectedEndTime = expectedDate.getTime();
    }
    
    const newTask: Task = {
      id, title, status: 'pending', quadrant,
      createdAt: Date.now(), deadline, deadlineDate, deadlineTime,
      order: tasks.filter(t => t.status === 'pending').length,
      recurring: recurring || { type: 'none' },
      recurringLabel: recurring && recurring.type !== 'none' ? title : undefined,
      finance, templateId, isGroup,
      groupTemplateIds: opts?.groupTemplateIds,
      showDeadline: opts?.showDeadline ?? !!deadline,
      showRecurring: opts?.showRecurring ?? (recurring?.type !== 'none'),
      showFinance: opts?.showFinance ?? !!finance,
      showNotes: opts?.showNotes ?? !!opts?.notes,
      notes: opts?.notes,
      startDate: opts?.startDate,
      startTime: opts?.startTime,
      duration: opts?.duration,
      expectedEndTime,
    };
    const updated = [...tasks, newTask];
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    return id;
  },

  updateTask: (id, updates) => {
    const userId = get()._userId;
    const updated = get().tasks.map(t => {
      if (t.id !== id) return t;
      const merged = { ...t, ...updates };
      if (updates.deadline !== undefined || updates.quadrant !== undefined) {
        const manualQuadrant = merged.quadrant === 'delegate' || merged.quadrant === 'eliminate' ? merged.quadrant : undefined;
        merged.quadrant = calculateQuadrant(merged.deadline, manualQuadrant);
      }
      return merged;
    });
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  removeTask: (id) => {
    const userId = get()._userId;
    const updated = get().tasks.filter(t => t.id !== id);
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  completeTask: (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;
    const userId = get()._userId;
    const tz = useSettingsStore.getState().timezone;
    const now = getNowInTimezone(tz).getTime();
    const isOnTime = !task.deadline || now <= task.deadline;
    const xpEarned = isOnTime ? 10 : 5;

    // ✅ #7: If timer is running/paused for this task, stop it first to record duration
    const timer = get().timer;
    let extraDuration = 0;
    let finalElapsed = 0;
    if (timer.taskId === id && (timer.isRunning || timer.isPaused)) {
      if (timer.isRunning && timer.startTime) {
        extraDuration = Math.floor((Date.now() - timer.startTime) / 1000) - timer.totalPausedDuration;
        finalElapsed = extraDuration;
      } else {
        extraDuration = timer.elapsed;
        finalElapsed = timer.elapsed;
      }
      localStorage.removeItem(getUserKey('nw_timer', userId));
    }

    // Add complete event and calculate final reliability metrics
    const nowTimestamp = Date.now();
    const taskWithEvent = addTimerEvent(task, 'complete');
    const effectiveDuration = finalElapsed - (task.totalPausedDuration || 0);
    const metrics = calculateReliabilityMetrics(taskWithEvent, task.actualStartTime, nowTimestamp);
    
    const updated = get().tasks.map(t =>
      t.id === id ? {
        ...t,
        ...taskWithEvent,
        ...metrics,
        effectiveDuration,
        status: 'done' as const,
        completedAt: nowTimestamp,
        duration: (t.duration || 0) + extraDuration,
      } : t
    );
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({
      tasks: updated,
      timer: timer.taskId === id ? { ...defaultTimer } : timer,
    });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    useGamificationStore.getState().onTaskCompleted(task.quadrant, (task.duration || 0) + extraDuration, tz, xpEarned);
  },

  restoreTask: (id) => {
    const userId = get()._userId;
    const updated = get().tasks.map(t => {
      if (t.id !== id) return t;
      const manualQuadrant = (t.quadrant === 'delegate' || t.quadrant === 'eliminate') ? t.quadrant : undefined;
      const newQuadrant = calculateQuadrant(t.deadline, manualQuadrant);
      return { ...t, status: 'pending' as const, completedAt: undefined, quadrant: newQuadrant };
    });
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  reorderTasks: (fromId, toId) => {
    const userId = get()._userId;
    const tasks = [...get().tasks];
    
    // Get all pending tasks sorted by current order
    const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => a.order - b.order);
    
    const fromIndex = pending.findIndex(t => t.id === fromId);
    const toIndex = pending.findIndex(t => t.id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const [moved] = pending.splice(fromIndex, 1);
    pending.splice(toIndex, 0, moved);
    
    // Update order values
    pending.forEach((t, i) => { t.order = i; });
    
    const rest = tasks.filter(t => t.status !== 'pending');
    const updated = [...pending, ...rest];
    
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  startTimer: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    const taskIsOverdue = isTaskOverdue(task);
    if (task.quadrant !== 'do_first' && !taskIsOverdue) {
      toast.warning('⚠️ Chỉ cho phép bấm giờ cho việc LÀM NGAY hoặc QUÁ HẠN');
      return;
    }
    
    const savedTimer = loadFromStorage<TimerState | null>(getUserKey('nw_timer', get()._userId), null);
    if (savedTimer && savedTimer.taskId === taskId && savedTimer.isRunning && savedTimer.startTime) {
      const elapsed = Math.floor((Date.now() - savedTimer.startTime) / 1000) - savedTimer.totalPausedDuration;
      set({ timer: { ...savedTimer, elapsed: Math.max(0, elapsed) } });
      return;
    }
    
    // Add start timer event and calculate metrics
    const taskWithEvent = addTimerEvent(task, 'start');
    const metrics = calculateReliabilityMetrics(taskWithEvent, Date.now());
    
    const updated = get().tasks.map(t => t.id === taskId ? { 
      ...t, 
      ...taskWithEvent,
      ...metrics,
      status: (t.status === 'done' ? t.status : 'in_progress') as any 
    } : t);
    saveToStorage(getUserKey('nw_tasks', get()._userId), updated);
    const newTimer: TimerState = { taskId, isRunning: true, isPaused: false, elapsed: 0, startTime: Date.now(), pausedAt: null, totalPausedDuration: 0 };
    saveToStorage(getUserKey('nw_timer', get()._userId), newTimer);
    set({ tasks: updated, timer: newTimer });
  },
  pauseTimer: () => {
    const t = get().timer;
    if (t.isRunning && !t.isPaused) {
      // Add pause event to the task
      const task = get().tasks.find(tk => tk.id === t.taskId);
      if (task) {
        const taskWithEvent = addTimerEvent(task, 'pause');
        const updated = get().tasks.map(tk => tk.id === t.taskId ? { 
          ...tk, 
          ...taskWithEvent,
          status: 'paused' as TaskStatus 
        } : tk);
        saveToStorage(getUserKey('nw_tasks', get()._userId), updated);
        set({ tasks: updated });
      }
      
      const newTimer = { ...t, isPaused: true, isRunning: false, pausedAt: Date.now() };
      set({ timer: newTimer });
      saveToStorage(getUserKey('nw_timer', get()._userId), newTimer);
    }
  },
  resumeTimer: () => {
    const t = get().timer;
    if (t.isPaused && t.pausedAt) {
      // Add resume event to the task
      const task = get().tasks.find(tk => tk.id === t.taskId);
      if (task) {
        const taskWithEvent = addTimerEvent(task, 'resume');
        // Update total paused duration
        const pd = Math.floor((Date.now() - t.pausedAt) / 1000);
        const updated = get().tasks.map(tk => tk.id === t.taskId ? { 
          ...tk, 
          ...taskWithEvent,
          totalPausedDuration: (tk.totalPausedDuration || 0) + pd,
          status: 'in_progress' as TaskStatus 
        } : tk);
        saveToStorage(getUserKey('nw_tasks', get()._userId), updated);
        set({ tasks: updated });
      }
      
      const pd = Math.floor((Date.now() - t.pausedAt) / 1000);
      const newTimer = { ...t, isPaused: false, isRunning: true, pausedAt: null, totalPausedDuration: t.totalPausedDuration + pd };
      set({ timer: newTimer });
      saveToStorage(getUserKey('nw_timer', get()._userId), newTimer);
    }
  },
  stopTimer: () => {
    const t = get().timer;
    const userId = get()._userId;
    if (t.taskId) {
      // Calculate actual elapsed from wall-clock if running
      let elapsed = t.elapsed;
      if (t.isRunning && t.startTime) {
        elapsed = Math.floor((Date.now() - t.startTime) / 1000) - t.totalPausedDuration;
      }
      const updated = get().tasks.map(tk => {
        if (tk.id === t.taskId) {
          const newDuration = (tk.duration || 0) + elapsed;
          const newStatus = tk.status === 'in_progress' ? 'paused' as const : tk.status;
          return { ...tk, duration: newDuration, status: newStatus };
        }
        return tk;
      });
      saveToStorage(getUserKey('nw_tasks', userId), updated);
      localStorage.removeItem(getUserKey('nw_timer', userId));
      set({ tasks: updated, timer: { ...defaultTimer } });
      if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    } else set({ timer: { ...defaultTimer } });
  },
  tickTimer: () => {
    const t = get().timer;
    if (t.isRunning && t.startTime && !t.isPaused) {
      const elapsed = Math.floor((Date.now() - t.startTime) / 1000) - t.totalPausedDuration;
      const newTimer = { ...t, elapsed: Math.max(0, elapsed) };
      set({ timer: newTimer });
      // Save periodically (every 5s) to avoid excessive writes
      if (elapsed % 5 === 0) saveToStorage(getUserKey('nw_timer', get()._userId), newTimer);
    }
  },
  clearAllData: () => {
    const u = get()._userId;
    ['nw_tasks', 'nw_chat', 'nw_gamification', 'nw_templates', 'nw_topics'].forEach(k => localStorage.removeItem(getUserKey(k, u)));
    localStorage.removeItem('nw_settings');
    set({ tasks: [], timer: { ...defaultTimer } });
  },
  checkAndMarkOverdue: () => {
    const userId = get()._userId;
    const tz = useSettingsStore.getState().timezone;
    const now = getNowInTimezone(tz).getTime();
    let changed = false;
    
    const updated = get().tasks.map(t => {
      if (t.quadrant === 'schedule' && t.deadline) {
        const timeUntil = t.deadline - now;
        if (timeUntil > 0 && timeUntil < 86400000) {
          changed = true;
          return { ...t, quadrant: 'do_first' as const };
        }
      }
      return t;
    });
    
    if (changed) {
      saveToStorage(getUserKey('nw_tasks', userId), updated);
      set({ tasks: updated });
      if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    }
  },
}));

// ──────────── TOPIC STORE ────────────
interface TopicStore {
  topics: Topic[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addTopic: (name: string) => string;
  removeTopic: (id: string) => void;
  addTopicParam: (topicId: string, paramName: string) => void;
  removeTopicParam: (topicId: string, paramId: string) => void;
}

export const useTopicStore = create<TopicStore>((set, get) => ({
  topics: [],
  _userId: undefined,
  initForUser: async (userId) => {
    if (userId === 'admin') {
      set({ topics: loadFromStorage<Topic[]>(getUserKey('nw_topics', userId), []), _userId: userId });
      return;
    }
    const topicsFromDB = await loadTopicsFromDB(userId);
    set({ topics: topicsFromDB, _userId: userId });
  },
  addTopic: (name) => {
    const userId = get()._userId;
    const id = generateId();
    const updated = [...get().topics, { id, name, params: [] }];
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
    if (userId && userId !== 'admin') saveTopicsToDB(userId, updated);
    return id;
  },
  removeTopic: (id) => {
    const userId = get()._userId;
    const updated = get().topics.filter(t => t.id !== id);
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
    if (userId && userId !== 'admin') saveTopicsToDB(userId, updated);
  },
  addTopicParam: (topicId, paramName) => {
    const userId = get()._userId;
    const updated = get().topics.map(t =>
      t.id === topicId ? { ...t, params: [...t.params, { id: generateId(), name: paramName, value: '' }] } : t
    );
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
    if (userId && userId !== 'admin') saveTopicsToDB(userId, updated);
  },
  removeTopicParam: (topicId, paramId) => {
    const userId = get()._userId;
    const updated = get().topics.map(t =>
      t.id === topicId ? { ...t, params: t.params.filter(p => p.id !== paramId) } : t
    );
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
    if (userId && userId !== 'admin') saveTopicsToDB(userId, updated);
  },
}));

// ──────────── TEMPLATE STORE ────────────
interface TemplateStore {
  templates: TaskTemplate[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => string;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  removeTemplate: (id: string) => void;
  addGroupTasksToTodo: (groupTemplateId: string, quadrant: EisenhowerQuadrant, deadlineDate?: string, deadlineTime?: string, recurringOverride?: RecurringConfig, notesOverride?: string) => void;
  addSingleTaskToTodo: (templateId: string, quadrant: EisenhowerQuadrant, deadline?: number, deadlineDate?: string, deadlineTime?: string, finance?: TaskFinance, recurring?: RecurringConfig, notes?: string) => void;
  exportTemplates: () => string;
  importTemplates: (json: string) => number;
  hasTemplateForTitle: (title: string) => boolean;
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  _userId: undefined,
  initForUser: async (userId) => {
    if (userId === 'admin') {
      set({ templates: loadFromStorage<TaskTemplate[]>(getUserKey('nw_templates', userId), []), _userId: userId });
      return;
    }
    const templatesFromDB = await loadTemplatesFromDB(userId);
    set({ templates: templatesFromDB, _userId: userId });
  },
  addTemplate: (template) => {
    const userId = get()._userId;
    const id = generateId();
    const newT: TaskTemplate = { ...template, id, createdAt: Date.now() };
    const updated = [...get().templates, newT];
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
    return id;
  },
  updateTemplate: (id, updates) => {
    const userId = get()._userId;
    const updated = get().templates.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
  },
  removeTemplate: (id) => {
    const userId = get()._userId;
    const updated = get().templates.filter(t => t.id !== id).map(t => {
      if (t.isGroup && t.groupIds?.includes(id)) {
        return { ...t, groupIds: t.groupIds.filter(gid => gid !== id) };
      }
      return t;
    });
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
  },
  addGroupTasksToTodo: (groupTemplateId, quadrant, deadlineDate, deadlineTime, recurringOverride, notesOverride) => {
    const templates = get().templates;
    const group = templates.find(t => t.id === groupTemplateId);
    if (!group || !group.groupIds) return;
    const taskStore = useTaskStore.getState();
    let deadline: number | undefined;
    if (deadlineDate) deadline = new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`).getTime();

    // Convert quadrant to manualQuadrant (only delegate/eliminate are manual)
    const manualQuadrant = quadrant === 'delegate' || quadrant === 'eliminate' ? quadrant : undefined;

    group.groupIds.forEach(singleId => {
      const single = templates.find(t => t.id === singleId);
      if (!single) return;
      const fin = single.finance;
      const rec = recurringOverride || single.recurring;
      taskStore.addTask(
        single.title, manualQuadrant, deadline, rec, deadlineDate, deadlineTime, fin, single.id, false,
        { notes: notesOverride || single.notes, showDeadline: !!deadline, showRecurring: rec?.type !== 'none', showFinance: !!fin, showNotes: !!(notesOverride || single.notes), groupTemplateIds: [groupTemplateId] },
      );
    });
  },
  addSingleTaskToTodo: (templateId, quadrant, deadline, deadlineDate, deadlineTime, finance, recurring, notes) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return;
    const taskStore = useTaskStore.getState();
    const rec = recurring || template.recurring;
    const fin = finance || template.finance;
    // Convert quadrant to manualQuadrant (only delegate/eliminate are manual)
    const manualQuadrant = quadrant === 'delegate' || quadrant === 'eliminate' ? quadrant : undefined;
    taskStore.addTask(
      template.title, manualQuadrant, deadline, rec, deadlineDate, deadlineTime, fin, templateId, false,
      { notes: notes || template.notes, showDeadline: !!deadline, showRecurring: rec?.type !== 'none', showFinance: !!fin, showNotes: !!(notes || template.notes) },
    );
  },
  exportTemplates: () => {
    const templates = get().templates;
    const topics = useTopicStore.getState().topics;
    return JSON.stringify({ version: 3, templates, topics }, null, 2);
  },
  importTemplates: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.templates) return 0;
      const existing = get().templates;
      const newTemplates = data.templates.map((t: any) => ({ ...t, id: generateId(), createdAt: Date.now() }));
      const updated = [...existing, ...newTemplates];
      saveToStorage(getUserKey('nw_templates', get()._userId), updated);
      set({ templates: updated });
      if (data.topics) {
        const topicStore = useTopicStore.getState();
        const existingTopics = topicStore.topics;
        data.topics.forEach((t: any) => {
          if (!existingTopics.find(et => et.name === t.name)) topicStore.addTopic(t.name);
        });
      }
      return newTemplates.length;
    } catch { return 0; }
  },
  hasTemplateForTitle: (title) => {
    return get().templates.some(t => t.title.toLowerCase() === title.toLowerCase());
  },
}));

// ──────────── CHAT STORE ────────────
interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  updateLastAssistant: (content: string) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  _userId: undefined,
  initForUser: async (userId) => {
    if (userId === 'admin') {
      set({ messages: loadFromStorage<ChatMessage[]>(getUserKey('nw_chat', userId), []), _userId: userId });
      return;
    }
    const messagesFromDB = await loadChatMessagesFromDB(userId);
    set({ messages: messagesFromDB, _userId: userId });
  },
  addMessage: (role, content) => {
    const userId = get()._userId;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const msg: ChatMessage = { id, role, content, timestamp: Date.now() };
    const updated = [...get().messages, msg];
    saveToStorage(getUserKey('nw_chat', userId), updated);
    set({ messages: updated });
    if (userId && userId !== 'admin') saveChatMessagesToDB(userId, updated);
  },
  updateLastAssistant: (content) => {
    const userId = get()._userId;
    const msgs = [...get().messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') { msgs[i] = { ...msgs[i], content }; break; }
    }
    saveToStorage(getUserKey('nw_chat', userId), msgs);
    set({ messages: msgs });
    if (userId && userId !== 'admin') saveChatMessagesToDB(userId, msgs);
  },
  setLoading: (loading) => set({ isLoading: loading }),
  clearChat: () => {
    localStorage.removeItem(getUserKey('nw_chat', get()._userId));
    set({ messages: [] });
  },
}));

// ──────────── GAMIFICATION STORE ────────────
interface GamificationStore {
  state: GamificationState;
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  onTaskCompleted: (quadrant: EisenhowerQuadrant, duration: number, timezone: string, xpEarned: number) => void;
  claimReward: (rewardId: string) => void;
  addCustomReward: (reward: Omit<Reward, 'id' | 'claimed'>) => void;
  removeReward: (rewardId: string) => void;
  updateReward: (rewardId: string, updates: Partial<Omit<Reward, 'id'>>) => void;
  addCustomAchievement: (achievement: Omit<Achievement, 'id' | 'unlockedAt'>) => void;
  removeAchievement: (achievementId: string) => void;
  updateAchievement: (achievementId: string, updates: Partial<Omit<Achievement, 'id'>>) => void;
  unlockAchievement: (achievementId: string) => void;
  _save: () => void;
}

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  state: getDefaultGamificationState(),
  _userId: undefined,
  initForUser: async (userId) => {
    if (userId === 'admin') {
      const saved = loadFromStorage<GamificationState | null>(getUserKey('nw_gamification', userId), null);
      if (saved) {
        const def = getDefaultGamificationState();
        const ids = new Set(saved.achievements.map(a => a.id));
        saved.achievements = [...saved.achievements, ...def.achievements.filter(a => !ids.has(a.id))];
        set({ state: saved, _userId: userId });
      } else set({ state: getDefaultGamificationState(), _userId: userId });
      return;
    }
    const stateFromDB = await loadGamificationFromDB(userId);
    if (stateFromDB) {
      const def = getDefaultGamificationState();
      const ids = new Set(stateFromDB.achievements.map(a => a.id));
      stateFromDB.achievements = [...stateFromDB.achievements, ...def.achievements.filter(a => !ids.has(a.id))];
      set({ state: stateFromDB, _userId: userId });
    } else set({ state: getDefaultGamificationState(), _userId: userId });
  },
  _save: () => {
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), get().state);
    if (userId && userId !== 'admin') saveGamificationToDB(userId, get().state);
  },
  onTaskCompleted: (quadrant, duration, timezone, xpEarned = 10) => {
    const s = { ...get().state };
    const now = getNowInTimezone(timezone);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    s.totalTasksCompleted += 1;
    s.totalTimerSeconds += duration;
    s.xp += xpEarned;
    if (now.getHours() < 9) s.earlyBirdCount += 1;
    if (s.lastActiveDate !== todayStr) {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      s.streak = s.lastActiveDate === ys ? s.streak + 1 : 1;
      s.lastActiveDate = todayStr;
      s.activeDays += 1;
    }
    s.level = calculateLevel(s.xp);
    const tasks = useTaskStore.getState().tasks;
    const qc = { do_first: 0, schedule: 0, delegate: 0, eliminate: 0 } as Record<EisenhowerQuadrant, number>;
    tasks.filter(t => t.status === 'done').forEach(t => { qc[t.quadrant] = (qc[t.quadrant] || 0) + 1; });
    let achXp = 0;
    s.achievements = s.achievements.map(a => {
      if (!a.unlockedAt && checkAchievement(a, s, qc, duration)) {
        achXp += a.xpReward;
        return { ...a, unlockedAt: Date.now() };
      }
      return a;
    });
    s.xp += achXp;
    s.level = calculateLevel(s.xp);
    set({ state: s });
    get()._save();
  },
  claimReward: (rewardId) => {
    const s = { ...get().state };
    const r = s.rewards.find(r => r.id === rewardId);
    if (!r || r.claimed || s.xp < r.xpCost) return;
    s.xp -= r.xpCost;
    s.level = calculateLevel(s.xp);
    s.rewards = s.rewards.map(r => r.id === rewardId ? { ...r, claimed: true, claimedAt: Date.now() } : r);
    set({ state: s }); get()._save();
  },
  addCustomReward: (reward) => {
    const s = { ...get().state };
    s.rewards = [...s.rewards, { ...reward, id: `cr_${Date.now().toString(36)}`, claimed: false }];
    set({ state: s }); get()._save();
  },
  removeReward: (id) => {
    const s = { ...get().state }; s.rewards = s.rewards.filter(r => r.id !== id);
    set({ state: s }); get()._save();
  },
  updateReward: (id, updates) => {
    const s = { ...get().state }; s.rewards = s.rewards.map(r => r.id === id ? { ...r, ...updates } : r);
    set({ state: s }); get()._save();
  },
  addCustomAchievement: (ach) => {
    const s = { ...get().state };
    s.achievements = [...s.achievements, { ...ach, id: `ca_${Date.now().toString(36)}`, isCustom: true }];
    set({ state: s }); get()._save();
  },
  removeAchievement: (id) => {
    const s = { ...get().state }; s.achievements = s.achievements.filter(a => a.id !== id);
    set({ state: s }); get()._save();
  },
  updateAchievement: (id, updates) => {
    const s = { ...get().state }; s.achievements = s.achievements.map(a => a.id === id ? { ...a, ...updates } : a);
    set({ state: s }); get()._save();
  },
  unlockAchievement: (id) => {
    const s = { ...get().state };
    const a = s.achievements.find(a => a.id === id);
    if (!a || a.unlockedAt) return;
    s.achievements = s.achievements.map(a => a.id === id ? { ...a, unlockedAt: Date.now() } : a);
    s.xp += a.xpReward;
    s.level = calculateLevel(s.xp);
    set({ state: s }); get()._save();
  },
}));

// ──────────── SETTINGS STORE ────────────
interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  color: string;     // background color
  days?: number[];   // days of week (0=Sun, 1=Mon, ..., 6=Sat) - empty means all days
  description?: string; // optional description
  icon?: string;     // icon name (work, lunch, exercise, sleep, etc.)
  active?: boolean;  // enable/disable without deleting
}

interface SettingsStore {
  fontScale: number;
  language: Language;
  tickSoundEnabled: boolean;
  voiceEnabled: boolean;
  currentPage: PageType;
  timezone: string;
  notificationSettings: NotificationSettings;
  voiceSettings: VoiceSettings;
  theme: ThemeMode;
  financeCategories: FinanceCategory[];
  costItems: CostItem[];
  dailyScheduleSlots: TimeSlot[];
  hourHeight: number; // pixels per hour in schedule
  taskViewMode: TaskViewMode;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
  setTickSound: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setCurrentPage: (page: PageType) => void;
  setTimezone: (tz: string) => void;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
  setFinanceCategories: (cats: FinanceCategory[]) => void;
  setCostItems: (items: CostItem[]) => void;
  setDailyScheduleSlots: (slots: TimeSlot[]) => void;
  setHourHeight: (height: number) => void;
  setTaskViewMode: (mode: TaskViewMode) => void;
}

const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
  { id: 'inc_1', name: 'Doanh thu dịch vụ', type: 'income', color: '#34D399' },
  { id: 'inc_2', name: 'Bán hàng', type: 'income', color: '#60A5FA' },
  { id: 'exp_1', name: 'Chi phí vận hành', type: 'expense', color: '#F87171' },
  { id: 'exp_2', name: 'Chi phí marketing', type: 'expense', color: '#FBBF24' },
];

export const useSettingsStore = create<SettingsStore>((set) => ({
  fontScale: loadFromStorage<number>('nw_fontscale', 1),
  language: loadFromStorage<Language>('nw_language', 'vi'),
  tickSoundEnabled: loadFromStorage<boolean>('nw_tick', true),
  voiceEnabled: loadFromStorage<boolean>('nw_voice', true),
  timezone: loadFromStorage<string>('nw_timezone', 'Asia/Ho_Chi_Minh'),
  notificationSettings: loadFromStorage<NotificationSettings>('nw_notifications', { enabled: true, beforeDeadline: 15, dailyReminder: false, dailyReminderTime: '08:00' }),
  voiceSettings: loadFromStorage<VoiceSettings>('nw_voicesettings', DEFAULT_VOICE_SETTINGS),
  theme: loadFromStorage<ThemeMode>('nw_theme', 'dark'),
  financeCategories: loadFromStorage<FinanceCategory[]>('nw_finance_cats', DEFAULT_FINANCE_CATEGORIES),
  costItems: loadFromStorage<CostItem[]>('nw_cost_items', []),
  dailyScheduleSlots: loadFromStorage<TimeSlot[]>('nw_daily_schedule_slots', [
    { id: 'slot_1', name: 'Giờ làm việc', startTime: '09:00', endTime: '12:00', color: '#3B82F626', days: [0,1,2,3,4,5,6], icon: 'briefcase', active: true },
    { id: 'slot_2', name: 'Nghỉ trưa', startTime: '12:00', endTime: '13:00', color: '#FBBF2426', days: [0,1,2,3,4,5,6], icon: 'coffee', active: true },
    { id: 'slot_3', name: 'Chiều làm việc', startTime: '13:00', endTime: '18:00', color: '#3B82F626', days: [0,1,2,3,4,5,6], icon: 'briefcase', active: true },
  ]),
  hourHeight: loadFromStorage<number>('nw_hour_height', 60), // default 60px per hour
  taskViewMode: loadFromStorage<TaskViewMode>('nw_task_view_mode', 'matrix'),
  currentPage: 'tasks',
  setFontScale: (scale) => {
    const safe = Math.max(0.75, Math.min(1.5, scale));
    saveToStorage('nw_fontscale', safe);
    document.documentElement.style.setProperty('--font-scale', String(safe));
    set({ fontScale: safe });
  },
  setLanguage: (lang) => {
    saveToStorage('nw_language', lang);
    set({ language: lang });
  },
  setTickSound: (e) => { saveToStorage('nw_tick', e); set({ tickSoundEnabled: e }); },
  setVoiceEnabled: (e) => { saveToStorage('nw_voice', e); set({ voiceEnabled: e }); },
  setCurrentPage: (page) => set({ currentPage: page }),
  setTimezone: (tz) => { saveToStorage('nw_timezone', tz); set({ timezone: tz }); },
  setNotificationSettings: (partial) => {
    set((prev) => {
      const updated = { ...prev.notificationSettings, ...partial };
      saveToStorage('nw_notifications', updated);
      return { notificationSettings: updated };
    });
  },
  setVoiceSettings: (partial) => {
    set((prev) => {
      const updated = { ...prev.voiceSettings, ...partial };
      saveToStorage('nw_voicesettings', updated);
      return { voiceSettings: updated };
    });
  },
  setTheme: (theme) => {
    saveToStorage('nw_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setFinanceCategories: (cats) => { saveToStorage('nw_finance_cats', cats); set({ financeCategories: cats }); },
  setCostItems: (items) => { saveToStorage('nw_cost_items', items); set({ costItems: items }); },
  setDailyScheduleSlots: (slots) => { saveToStorage('nw_daily_schedule_slots', slots); set({ dailyScheduleSlots: slots }); },
  setHourHeight: (height) => {
    const safe = Math.max(30, Math.min(1200, height)); // 30-1200px range
    saveToStorage('nw_hour_height', safe);
    set({ hourHeight: safe });
  },
  setTaskViewMode: (mode) => {
    saveToStorage('nw_task_view_mode', mode);
    set({ taskViewMode: mode });
  },
}));
