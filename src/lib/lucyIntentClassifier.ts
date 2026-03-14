/**
 * LUCY Intent Classifier
 * Handles ambiguous command recognition and intent resolution
 */

import { 
  IntentType, 
  IntentResult, 
  LucyAction, 
  LucyContext,
  AMBIGUOUS_PATTERNS,
  type LucyActionType 
} from './lucyTypes';

// Intent keywords for classification
const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  task: [
    'việc', 'công việc', 'task', 'todo', 'làm', 'hoàn thành', 'thêm việc', 
    'tạo việc', 'xóa việc', 'sửa việc', 'hoàn thành việc',
    'nhắc', 'remind', 'deadline', 'hạn'
  ],
  schedule: [
    'lịch', 'schedule', 'event', 'sự kiện', 'cuộc hẹn', 'hẹn', 'meeting',
    'calendar', 'ngày', 'giờ', 'thời gian', 'today', 'tomorrow'
  ],
  template: [
    'mẫu', 'template', 'pattern', 'nhóm việc', 'group', 'routine',
    'template đơn', 'single template', 'group template'
  ],
  cashflow: [
    'tiền', 'money', 'chi tiêu', 'expense', 'thu nhập', 'income',
    'ngân sách', 'budget', 'finance', 'tài chính', 'vnd', 'đồng',
    'hết tiền', 'chi phí', 'thanh toán', 'pay'
  ],
  health: [
    'sức khỏe', 'health', 'nước', 'water', 'uống nước', 'cân nặng',
    'weight', 'tập thể dục', 'exercise', 'gym', 'chạy', 'running',
    'calories', ' calories', 'sleep', 'ngủ', 'heart', 'tim'
  ],
  settings: [
    'cài đặt', 'settings', 'config', 'thiết lập', 'preferences',
    'theme', 'giao diện', 'notification', 'thông báo', 'âm thanh', 'sound'
  ],
  gamification: [
    'thành tích', 'achievement', 'phần thưởng', 'reward', 'xp', 'level',
    'streak', 'điểm', 'points', 'rank', 'hạng', 'unlock'
  ],
  navigation: [
    'đi đến', 'mở', 'open', 'go to', 'chuyển', 'navigate', 'trang',
    'page', 'view', 'xem', 'show'
  ],
  analysis: [
    'thống kê', 'statistics', 'stats', 'phân tích', 'analyze',
    'báo cáo', 'report', 'tổng kết', 'summary', 'overview'
  ],
  celebration: [
    'giỏi', 'xuất sắc', 'tuyệt vời', 'awesome', 'amazing', 'congratulations',
    'chúc mừng', 'khen', 'clap', 'bravo', 'pro'
  ],
  encouraging: [
    'cố lên', 'keep going', 'good job', 'nice', 'tốt lắm', 'great',
    'đừng bỏ cuộc', 'hi vọng', 'hope'
  ],
  unknown: []
};

// Score weights
const KEYWORD_MATCH_WEIGHT = 1.0;
const AMBIGUOUS_MATCH_WEIGHT = 0.8;
const CONTEXT_WEIGHT = 0.5;

/**
 * Classify user input intent
 */
export function classifyIntent(
  input: string, 
  context: LucyContext
): IntentResult {
  const inputLower = input.toLowerCase();
  
  // First check for ambiguous patterns
  const ambiguousResult = checkAmbiguousPatterns(inputLower);
  if (ambiguousResult) {
    return ambiguousResult;
  }
  
  // Calculate scores for each intent
  const scores: Record<IntentType, number> = {} as Record<IntentType, number>;
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'unknown') continue;
    
    let score = 0;
    for (const keyword of keywords) {
      if (inputLower.includes(keyword.toLowerCase())) {
        score += KEYWORD_MATCH_WEIGHT;
      }
    }
    scores[intent as IntentType] = score;
  }
  
  // Boost scores based on context
  if (context.tasks.pending.length > 0) {
    // If user has pending tasks, task-related intents get a boost
    if (inputLower.includes('việc') || inputLower.includes('công việc')) {
      scores.task = (scores.task || 0) + CONTEXT_WEIGHT;
    }
  }
  
  // Health context boost
  if (context.health.todayWater > 0 || context.health.waterGoal > 0) {
    if (inputLower.includes('nước') || inputLower.includes('uống')) {
      scores.health = (scores.health || 0) + CONTEXT_WEIGHT;
    }
  }
  
  // Cashflow context boost
  if (context.cashflow.todayExpenses > 0 || context.cashflow.monthBudget > 0) {
    if (inputLower.includes('tiền') || inputLower.includes('chi')) {
      scores.cashflow = (scores.cashflow || 0) + CONTEXT_WEIGHT;
    }
  }
  
  // Find the highest scoring intent
  let maxScore = 0;
  let bestIntent: IntentType = 'unknown';
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent as IntentType;
    }
  }
  
  // Calculate confidence
  const confidence = maxScore > 0 ? Math.min(maxScore / 3, 1.0) : 0;
  
  // Extract entities from input
  const entities = extractEntities(input, bestIntent);
  
  // Generate suggested actions based on intent
  const suggestedActions = generateSuggestedActions(bestIntent, entities);
  
  return {
    type: bestIntent,
    confidence,
    entities,
    suggestedActions,
    requiresClarification: confidence < 0.3 && maxScore > 0
  };
}

/**
 * Check for ambiguous patterns that need clarification
 */
function checkAmbiguousPatterns(input: string): IntentResult | null {
  for (const pattern of AMBIGUOUS_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (input.includes(keyword)) {
        // Return with clarification needed
        return {
          type: pattern.defaultIntent,
          confidence: AMBIGUOUS_MATCH_WEIGHT,
          entities: { originalKeyword: keyword },
          suggestedActions: [],
          requiresClarification: true,
          clarificationMessage: pattern.clarification
        };
      }
    }
  }
  return null;
}

/**
 * Extract entities from input based on intent type
 */
function extractEntities(input: string, intent: IntentType): Record<string, unknown> {
  const entities: Record<string, unknown> = {};
  
  // Extract numbers (for amounts, quantities)
  const numberMatch = input.match(/(\d+(\.\d+)?)/);
  if (numberMatch) {
    entities.amount = parseFloat(numberMatch[1]);
  }
  
  // Extract time patterns
  const timeMatch = input.match(/(\d{1,2})h(\d{2})?/);
  if (timeMatch) {
    entities.time = timeMatch[0];
    entities.hour = parseInt(timeMatch[1]);
    entities.minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  }
  
  // Extract date patterns
  const todayMatch = input.includes('hôm nay');
  const tomorrowMatch = input.includes('ngày mai');
  const yesterdayMatch = input.includes('hôm qua');
  
  if (todayMatch) entities.date = 'today';
  if (tomorrowMatch) entities.date = 'tomorrow';
  if (yesterdayMatch) entities.date = 'yesterday';
  
  // Extract specific terms based on intent
  if (intent === 'health') {
    if (input.includes('nước') || input.includes('ml')) {
      entities.type = 'water';
    }
    if (input.includes('cân') || input.includes('kg')) {
      entities.type = 'weight';
    }
    if (input.includes('tập') || input.includes('gym') || input.includes('thể dục')) {
      entities.type = 'exercise';
    }
  }
  
  if (intent === 'cashflow') {
    if (input.includes('thu') || input.includes('nhập')) {
      entities.type = 'income';
    } else if (input.includes('chi') || input.includes('tiêu')) {
      entities.type = 'expense';
    }
  }
  
  // Extract search terms (for find/update/delete operations)
  const searchPatterns = [
    /tìm (.+?)(?:\s|$)/,
    /xóa (.+?)(?:\s|$)/,
    /sửa (.+?)(?:\s|$)/,
    /cập nhật (.+?)(?:\s|$)/,
    /search (.+?)(?:\s|$)/,
    /delete (.+?)(?:\s|$)/
  ];
  
  for (const pattern of searchPatterns) {
    const match = input.match(pattern);
    if (match) {
      entities.search = match[1].trim();
      break;
    }
  }
  
  // Extract title/name
  const titlePatterns = [
    /tạo ["'](.+)["']/,
    /thêm ["'](.+)["']/,
    /tên ["'](.+)["']/,
    /create ["'](.+)["']/,
    /add ["'](.+)["']/
  ];
  
  for (const pattern of titlePatterns) {
    const match = input.match(pattern);
    if (match) {
      entities.title = match[1].trim();
      break;
    }
  }
  
  return entities;
}

/**
 * Generate suggested actions based on intent
 */
function generateSuggestedActions(
  intent: IntentType, 
  entities: Record<string, unknown>
): LucyAction[] {
  const actions: LucyAction[] = [];
  
  switch (intent) {
    case 'task':
      if (entities.title) {
        actions.push({
          type: 'ADD_TASK',
          title: entities.title as string,
          quadrant: (entities.quadrant as string) || 'do_first'
        });
      }
      if (entities.search) {
        actions.push({
          type: 'COMPLETE_TASK',
          search: entities.search as string
        });
      }
      break;
      
    case 'health':
      if (entities.type === 'water' && entities.amount) {
        actions.push({
          type: 'ADD_WATER',
          amount: entities.amount as number
        });
      } else if (entities.type === 'weight' && entities.amount) {
        actions.push({
          type: 'ADD_WEIGHT',
          value: entities.amount as number
        });
      } else {
        // Default to showing health page
        actions.push({
          type: 'NAVIGATE',
          page: 'health'
        });
      }
      break;
      
    case 'cashflow':
      if (entities.type === 'expense' && entities.amount) {
        actions.push({
          type: 'ADD_EXPENSE',
          amount: entities.amount as number,
          category: (entities.category as string) || 'other'
        });
      } else if (entities.type === 'income' && entities.amount) {
        actions.push({
          type: 'ADD_INCOME',
          amount: entities.amount as number
        });
      } else {
        // Default to analysis
        actions.push({
          type: 'ANALYZE_BUDGET'
        });
      }
      break;
      
    case 'schedule':
      if (entities.title && entities.time) {
        actions.push({
          type: 'ADD_SCHEDULE_EVENT',
          title: entities.title as string,
          startTime: entities.time as string,
          date: (entities.date as string) || 'today'
        });
      } else {
        actions.push({
          type: 'NAVIGATE',
          page: 'schedule'
        });
      }
      break;
      
    case 'navigation':
      const pageMap: Record<string, string> = {
        'việc': 'tasks',
        'công việc': 'tasks',
        'task': 'tasks',
        'lịch': 'schedule',
        'schedule': 'schedule',
        'mẫu': 'templates',
        'template': 'templates',
        'tiền': 'cashflow',
        'tài chính': 'cashflow',
        'sức khỏe': 'health',
        'health': 'health',
        'cài đặt': 'settings',
        'settings': 'settings',
        'thành tích': 'achievements',
        'achievement': 'achievements'
      };
      
      for (const [key, page] of Object.entries(pageMap)) {
        if (entities.title?.toString().toLowerCase().includes(key)) {
          actions.push({ type: 'NAVIGATE', page });
          break;
        }
      }
      break;
      
    case 'analysis':
      actions.push({
        type: 'NAVIGATE',
        page: 'stats'
      });
      break;
  }
  
  return actions;
}

/**
 * Resolve ambiguous intent based on user clarification
 */
export function resolveIntent(
  originalIntent: IntentResult,
  clarification: string,
  context: LucyContext
): IntentResult {
  const clarificationLower = clarification.toLowerCase();
  
  // Map clarification responses to intents
  const resolutionMap: Record<string, IntentType> = {
    'xem': 'analysis',
    'thêm': originalIntent.type, // Add new item
    'chi tiêu': 'cashflow',
    'thu nhập': 'cashflow',
    'tạo': 'task',
    'lịch': 'schedule',
    'sức khỏe': 'health',
    'cân nặng': 'health',
    'nước': 'health'
  };
  
  for (const [keyword, intent] of Object.entries(resolutionMap)) {
    if (clarificationLower.includes(keyword)) {
      return {
        ...originalIntent,
        type: intent,
        confidence: 0.9,
        requiresClarification: false
      };
    }
  }
  
  // Default to original intent with higher confidence
  return {
    ...originalIntent,
    confidence: Math.min(originalIntent.confidence + 0.2, 1.0),
    requiresClarification: false
  };
}

/**
 * Create context from stores for intent classification
 */
export function createLucyContext(
  tasks: { id: string; status: string; title: string; quadrant: string; deadline?: number; finance?: unknown; createdAt: number }[],
  timer: { isRunning: boolean; isPaused: boolean; taskId: string | null; elapsed: number },
  templates: { id: string; title: string; isGroup: boolean }[],
  gamificationState: { xp: number; level: number; streak: number },
  healthState: { waterEntries: { amount: number; date: string }[]; weightEntries: { value: number; date: string }[]; dailyWaterGoal: number; goals: Record<string, unknown> },
  financeState: { todayExpenses: number; todayIncome: number; monthBudget: number; categories: { name: string; total: number }[] },
  scheduleState: { todayEvents: { id: string; title: string; time: string }[]; upcomingEvents: { id: string; title: string; date: string }[] }
): LucyContext {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    tasks: {
      pending: tasks.filter(t => t.status === 'pending').map(t => ({
        id: '', title: t.title, quadrant: t.quadrant, deadline: t.deadline, finance: t.finance
      })),
      inProgress: tasks.filter(t => t.status === 'in_progress').map(t => ({
        id: '', title: t.title
      })),
      done: tasks.filter(t => t.status === 'done').slice(0, 10).map(t => ({
        id: '', title: t.title
      })),
      overdue: tasks.filter(t => t.status === 'overdue').map(t => ({
        id: '', title: t.title
      }))
    },
    timer: {
      isRunning: timer.isRunning,
      isPaused: timer.isPaused,
      taskTitle: tasks.find(t => t.id === timer.taskId)?.title,
      elapsed: timer.elapsed
    },
    templates: templates.map(t => ({ id: t.id, title: t.title, isGroup: t.isGroup })),
    gamification: {
      xp: gamificationState.xp,
      level: gamificationState.level,
      streak: gamificationState.streak
    },
    health: {
      todayWater: healthState.waterEntries
        .filter(e => e.date === today)
        .reduce((sum, e) => sum + e.amount, 0),
      waterGoal: healthState.dailyWaterGoal,
      recentWeight: healthState.weightEntries.slice(-7).map(w => ({
        value: w.value,
        date: w.date
      })),
      goals: healthState.goals
    },
    cashflow: {
      todayExpenses: financeState.todayExpenses,
      todayIncome: financeState.todayIncome,
      monthBudget: financeState.monthBudget,
      categories: financeState.categories
    },
    schedule: scheduleState
  };
}
