/**
 * LUCY AI Assistant - Type Definitions
 * Enhanced with System Integration, Intent Recognition, and Safety Guardrails
 */

// ==================== ENHANCED ACTION TYPES ====================

export type LucyActionType =
  // Task actions (existing)
  | 'ADD_TASK'
  | 'COMPLETE_TASK'
  | 'DELETE_TASK'
  | 'RESTORE_TASK'
  | 'START_TIMER'
  // Template actions (existing)
  | 'ADD_TEMPLATE'
  | 'DELETE_TEMPLATE'
  | 'UPDATE_TEMPLATE'
  | 'USE_TEMPLATE'
  // Gamification actions (existing)
  | 'ADD_REWARD'
  | 'REMOVE_REWARD'
  | 'UPDATE_REWARD'
  | 'ADD_ACHIEVEMENT'
  | 'REMOVE_ACHIEVEMENT'
  | 'UPDATE_ACHIEVEMENT'
  | 'UNLOCK_ACHIEVEMENT'
  // Navigation (existing)
  | 'NAVIGATE'
  // NEW: Health actions
  | 'ADD_WATER'
  | 'ADD_WEIGHT'
  | 'ADD_WAIST'
  | 'SET_WATER_GOAL'
  | 'SET_HEALTH_GOAL'
  // NEW: CashFlow/Finance actions
  | 'ADD_EXPENSE'
  | 'ADD_INCOME'
  | 'ANALYZE_BUDGET'
  // NEW: Schedule actions
  | 'ADD_SCHEDULE_EVENT'
  | 'UPDATE_SCHEDULE_EVENT'
  | 'DELETE_SCHEDULE_EVENT'
  // NEW: Settings actions
  | 'UPDATE_SETTINGS'
  // NEW: Complex chain actions
  | 'COMPOUND_ACTION';

export interface LucyAction {
  type: LucyActionType;
  title?: string;
  search?: string;
  quadrant?: string;
  notes?: string;
  recurring?: boolean;
  subtasks?: string[];
  page?: string;
  icon?: string;
  description?: string;
  xpCost?: number;
  xpReward?: number;
  // Health specific
  amount?: number;
  value?: number;
  unit?: string;
  note?: string;
  // Finance specific
  category?: string;
  currency?: string;
  // Schedule specific
  startTime?: string;
  endTime?: string;
  date?: string;
  // Settings specific
  key?: string;
  settingValue?: unknown;
  // Compound action
  actions?: LucyAction[];
  // Confirmation
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// ==================== INTENT TYPES ====================

export type IntentType =
  | 'task'           // Việc
  | 'schedule'       // Lịch  
  | 'template'       // Mẫu
  | 'cashflow'       // Dòng tiền
  | 'health'         // Sức khỏe
  | 'settings'       // Cài đặt
  | 'gamification'   // Thành tích/Phần thưởng
  | 'navigation'     // Điều hướng
  | 'analysis'       // Phân tích/Tổng hợp
  | 'celebration'    // Chúc mừng/Khen
  | 'encouraging'    // Khích lệ
  | 'unknown';      // Không xác định

export interface IntentResult {
  type: IntentType;
  confidence: number;  // 0-1
  entities: Record<string, unknown>;
  suggestedActions: LucyAction[];
  requiresClarification?: boolean;
  clarificationMessage?: string;
}

// ==================== PERSONALITY TYPES ====================

export type LucyPersonality = 
  | 'professional'   // Chuyên nghiệp, nghiêm túc
  | 'friendly'      // Thân thiện, gần gũi
  | 'humorous'       // Hóm hỉnh, vui vẻ
  | 'encouraging';   // Khích lệ, động viên

export interface PersonalityResponse {
  message: string;
  personality: LucyPersonality;
  soundEffect?: 'success' | 'warning' | 'error' | 'celebration' | 'sympathy' | 'encourage';
  actions?: LucyAction[];
}

// ==================== COMMAND CHAIN TYPES ====================

export interface CommandChainResult {
  success: boolean;
  executedActions: {
    action: LucyAction;
    result: string;
    success: boolean;
  }[];
  summary: string;
  totalDuration?: number;
}

// ==================== SAFETY TYPES ====================

export type SafetyLevel = 'safe' | 'warning' | 'dangerous';

export interface SafetyCheck {
  passed: boolean;
  level: SafetyLevel;
  message: string;
  requiresConfirmation: boolean;
  originalAction: LucyAction;
}

export interface ConfirmationState {
  isPending: boolean;
  action: LucyAction | null;
  timestamp: number;
}

// ==================== CONTEXT TYPES ====================

export interface LucyContext {
  // Task context
  tasks: {
    pending: { id: string; title: string; quadrant: string; deadline?: number; finance?: unknown }[];
    inProgress: { id: string; title: string }[];
    done: { id: string; title: string; duration?: number }[];
    overdue: { id: string; title: string }[];
  };
  // Timer
  timer: {
    isRunning: boolean;
    isPaused: boolean;
    taskTitle?: string;
    elapsed: number;
  };
  // Templates
  templates: { id: string; title: string; isGroup: boolean }[];
  // Gamification
  gamification: {
    xp: number;
    level: number;
    streak: number;
  };
  // Health (NEW)
  health: {
    todayWater: number;
    waterGoal: number;
    recentWeight: { value: number; date: string }[];
    goals: Record<string, unknown>;
  };
  // CashFlow (NEW)
  cashflow: {
    todayExpenses: number;
    todayIncome: number;
    monthBudget: number;
    categories: { name: string; total: number }[];
  };
  // Schedule (NEW)
  schedule: {
    todayEvents: { id: string; title: string; time: string }[];
    upcomingEvents: { id: string; title: string; date: string }[];
  };
}

// ==================== AMBIGUOUS COMMAND PATTERNS ====================

export interface AmbiguousPattern {
  keywords: string[];
  intents: IntentType[];
  defaultIntent: IntentType;
  clarification?: string;
}

// Common ambiguous Vietnamese commands that need intent resolution
export const AMBIGUOUS_PATTERNS: AmbiguousPattern[] = [
  {
    keywords: ['hết tiền', 'hết chi phí', 'ngân sách', 'tiền', 'chi tiêu'],
    intents: ['cashflow', 'analysis'],
    defaultIntent: 'cashflow',
    clarification: 'Bạn muốn xem chi tiêu hay thêm khoản chi mới?'
  },
  {
    keywords: ['tập thể dục', 'tập gym', 'chạy', 'sức khỏe', 'cân nặng', 'nước'],
    intents: ['health', 'task'],
    defaultIntent: 'health',
    clarification: 'Bạn muốn thêm hoạt động sức khỏe hay tạo việc mới?'
  },
  {
    keywords: ['lịch', 'hôm nay có gì', 'sự kiện', 'cuộc hẹn'],
    intents: ['schedule', 'task'],
    defaultIntent: 'schedule',
    clarification: 'Bạn muốn xem lịch hay thêm việc vào lịch?'
  },
  {
    keywords: ['mệt', 'chán', 'không muốn làm', 'lazy'],
    intents: ['task', 'encouraging'],
    defaultIntent: 'task',
    clarification: 'Bạn cần LUCY giúp gì đây?'
  },
  {
    keywords: ['giỏi', 'xuất sắc', 'tuyệt vời', 'congratulations'],
    intents: ['celebration', 'gamification'],
    defaultIntent: 'celebration'
  }
];

// ==================== SAFETY RULES ====================

export interface SafetyRule {
  actionTypes: LucyActionType[];
  conditions: (action: LucyAction, context: LucyContext) => boolean;
  level: SafetyLevel;
  message: string;
  requiresConfirmation: boolean;
}

export const SAFETY_RULES: SafetyRule[] = [
  {
    actionTypes: ['DELETE_TASK', 'DELETE_TEMPLATE', 'REMOVE_REWARD', 'REMOVE_ACHIEVEMENT'],
    conditions: (action) => action.search !== undefined && action.search.length > 0,
    level: 'warning',
    message: 'Thao tác xóa sẽ không thể khôi phục. Bạn có chắc chắn muốn xóa "{item}"?',
    requiresConfirmation: true
  },
  {
    actionTypes: ['DELETE_TASK', 'DELETE_TEMPLATE'],
    conditions: (action, context) => {
      // Check if deleting multiple items
      const searchLower = (action.search || '').toLowerCase();
      const matchingTasks = context.tasks.pending.filter(t => 
        t.title.toLowerCase().includes(searchLower)
      );
      return matchingTasks.length > 1;
    },
    level: 'dangerous',
    message: 'Có nhiều việc khớp với từ khóa "{search}". LUCY sẽ xóa tất cả. Tiếp tục?',
    requiresConfirmation: true
  },
  {
    actionTypes: ['UPDATE_SETTINGS'],
    conditions: (action) => {
      // Dangerous settings keys
      const dangerousKeys = ['clearAllData', 'resetApp', 'deleteAccount'];
      return dangerousKeys.includes(action.key || '');
    },
    level: 'dangerous',
    message: 'Đây là thao tác nguy hiểm. Bạn có chắc chắn muốn tiếp tục?',
    requiresConfirmation: true
  },
  {
    actionTypes: ['COMPOUND_ACTION'],
    conditions: (action) => (action.actions?.length || 0) > 2,
    level: 'warning',
    message: 'LUCY sẽ thực hiện {count} thao tác cùng lúc. Tiếp tục?',
    requiresConfirmation: true
  }
];
