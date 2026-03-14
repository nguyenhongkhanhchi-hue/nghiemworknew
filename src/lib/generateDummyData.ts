/**
 * Dummy Data Generator for 1 Month
 * User: Calligraphy & Rice Painting Artist (Nghệ nhân viết thư pháp và làm tranh gạo)
 */

import type { Task, TaskTemplate, GamificationState, FinanceCategory, CostItem, EisenhowerQuadrant, RecurringConfig, TaskStatus, TaskCategory } from '@/types';
import type { WaterEntry, WeightEntry, WaistEntry } from '@/types/health';

// Helper to generate IDs
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Helper to get date N days ago from today
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Helper to get timestamp N days ago
function getTimestampDaysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// Helper to get random integer between min and max
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to get random element from array
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────────
// TASK CATEGORIES for Calligraphy & Rice Painting Artist
// ─────────────────────────────────────────────────────────

const CALLIGRAPHY_TASKS = [
  'Viết thư pháp chữ Phúc',
  'Viết thư pháp chữ Lộc',
  'Viết thư pháp chữ Thọ',
  'Viết thư pháp câu đối',
  'Viết thư pháp tranh tứ trụ',
  'Viết thư pháp treo tường',
  'Viết thư pháp bánh chưng',
  'Viết thư pháp wedding card',
  'Viết thư pháp shop sign',
  'Practice writing strokes',
  'Study classic calligraphy works',
  'Prepare ink and brushes',
  'Frame completed works',
  'Photo documentation of works',
  'Upload作品 to social media',
  'Customer consultation',
  'Design new calligraphy style',
];

const RICE_PAINTING_TASKS = [
  'Vẽ tranh gạo Hoa mai',
  'Vẽ tranh gạo Hoa đào',
  'Vẽ tranh gạo Cảnh núi',
  'Vẽ tranh gạo Cá chép',
  'Vẽ tranh gạo Phượng hoàng',
  'Vẽ tranh gạo Hạnh phúc',
  'Vẽ tranh gạo Thịnh vượng',
  'Vẽ tranh gạo Tài lộc',
  'Vẽ tranh gạo Tết',
  'Vẽ tranh gạo cưới',
  'Vẽ tranh gạo tặng boss',
  'Rửa và phơi gạo',
  'Chuẩn bị giấy và gạo',
  'Tráng tranh hoàn thiện',
  ' Làm khung tranh',
  'Đóng gói sản phẩm',
  'Giao hàng cho khách',
];

const ADMIN_TASKS = [
  'Kiểm tra email khách hàng',
  'Update đơn hàng online',
  'Đăng bài Facebook',
  'Đăng bài Instagram',
  'Chụp ảnh sản phẩm mới',
  'Video demo vẽ tranh',
  'Liên hệ đối tác',
  'Mua vật liệu mới',
  'Dọn dẹp studio',
  'Lập kế hoạch tháng',
];

const HEALTH_TASKS = [
  'Tập thể dục buổi sáng',
  'Stretching cổ tay',
  'Ngồi thiền 15 phút',
  'Đi bộ 30 phút',
  'Uống đủ 2L nước',
];

// Quadrants
const QUADRANTS: EisenhowerQuadrant[] = ['do_first', 'schedule', 'delegate', 'eliminate'];

// Categories
const CATEGORIES: TaskCategory[] = ['work', 'personal', 'health', 'learning', 'finance', 'social', 'other'];

// ─────────────────────────────────────────────────────────
// GENERATE TASKS FOR 1 MONTH
// ─────────────────────────────────────────────────────────

export function generateTasksForOneMonth(): Task[] {
  const tasks: Task[] = [];
  const today = new Date();
  
  // Generate tasks for past 30 days + some future tasks
  for (let dayOffset = 30; dayOffset >= -7; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // 3-6 tasks per day
    const tasksPerDay = randomInt(3, 6);
    
    for (let i = 0; i < tasksPerDay; i++) {
      const taskType = Math.random();
      let title: string;
      let category: TaskCategory;
      let quadrant: EisenhowerQuadrant;
      let status: TaskStatus;
      
      if (taskType < 0.4) {
        // 40% calligraphy tasks
        title = randomFrom(CALLIGRAPHY_TASKS);
        category = 'work';
      } else if (taskType < 0.7) {
        // 30% rice painting tasks
        title = randomFrom(RICE_PAINTING_TASKS);
        category = 'work';
      } else if (taskType < 0.85) {
        // 15% admin/marketing tasks
        title = randomFrom(ADMIN_TASKS);
        category = 'learning';
      } else {
        // 15% health tasks
        title = randomFrom(HEALTH_TASKS);
        category = 'health';
      }
      
      // Determine quadrant based on deadline urgency
      if (dayOffset <= 2) {
        quadrant = 'do_first'; // urgent
      } else if (dayOffset <= 7) {
        quadrant = 'schedule';
      } else if (Math.random() < 0.3) {
        quadrant = 'delegate';
      } else {
        quadrant = 'eliminate';
      }
      
      // Determine status based on whether it's past or future
      if (dayOffset > 0) {
        // Past days - mostly completed
        status = Math.random() < 0.85 ? 'done' : (Math.random() < 0.5 ? 'pending' : 'overdue');
      } else if (dayOffset === 0) {
        // Today - mix of statuses
        status = Math.random() < 0.4 ? 'done' : (Math.random() < 0.5 ? 'pending' : 'in_progress');
      } else {
        // Future - pending
        status = 'pending';
      }
      
      const createdAt = getTimestampDaysAgo(dayOffset + randomInt(1, 3));
      const deadline = dayOffset <= 0 ? undefined : getTimestampDaysAgo(dayOffset - randomInt(0, 2));
      
      const task: Task = {
        id: genId(),
        title,
        status,
        quadrant,
        createdAt,
        completedAt: status === 'done' ? getTimestampDaysAgo(dayOffset) + randomInt(0, 8 * 60 * 60 * 1000) : undefined,
        deadline,
        deadlineDate: deadline ? dateStr : undefined,
        deadlineTime: deadline ? `${String(randomInt(8, 18)).padStart(2, '0')}:${String(randomInt(0, 59)).padStart(2, '0')}` : undefined,
        duration: randomInt(30, 180), // 30 min to 3 hours
        order: i,
        recurring: { type: 'none' },
        category,
        // Random show options
        showDeadline: Math.random() > 0.3,
        showRecurring: Math.random() > 0.7,
        showNotes: Math.random() > 0.5,
        // Time tracking (if completed)
        actualStartTime: status !== 'pending' ? getTimestampDaysAgo(dayOffset) + randomInt(1, 4) * 60 * 60 * 1000 : undefined,
        actualEndTime: status === 'done' ? getTimestampDaysAgo(dayOffset) + randomInt(4, 10) * 60 * 60 * 1000 : undefined,
        reliabilityScore: status === 'done' ? randomInt(70, 100) : undefined,
      };
      
      tasks.push(task);
    }
  }
  
  return tasks;
}

// ─────────────────────────────────────────────────────────
// GENERATE TASK TEMPLATES
// ─────────────────────────────────────────────────────────

export function generateTaskTemplates(): TaskTemplate[] {
  const templates: TaskTemplate[] = [
    {
      id: genId(),
      title: 'Viết thư pháp chữ Phúc',
      recurring: { type: 'weekly', label: 'Hàng tuần' },
      notes: 'Chuẩn bị: Giấy đỏ, bút lông, mực tàu',
      xpReward: 50,
      createdAt: getTimestampDaysAgo(60),
    },
    {
      id: genId(),
      title: 'Vẽ tranh gạo Hoa mai',
      recurring: { type: 'weekly', label: 'Hàng tuần' },
      notes: 'Cần: Gạo trắng, giấy xanh, keo',
      xpReward: 80,
      createdAt: getTimestampDaysAgo(60),
    },
    {
      id: genId(),
      title: 'Tập thể dục buổi sáng',
      recurring: { type: 'daily', label: 'Hàng ngày' },
      notes: 'Stretching cổ tay 10 phút',
      xpReward: 20,
      createdAt: getTimestampDaysAgo(60),
    },
    {
      id: genId(),
      title: 'Đăng bài mạng xã hội',
      recurring: { type: 'weekdays', label: 'Ngày làm việc' },
      notes: 'Facebook & Instagram',
      xpReward: 30,
      createdAt: getTimestampDaysAgo(60),
    },
    {
      id: genId(),
      title: 'Kiểm tra kho vật liệu',
      recurring: { type: 'monthly', label: 'Hàng tháng' },
      xpReward: 40,
      createdAt: getTimestampDaysAgo(60),
    },
  ];
  
  return templates;
}

// ─────────────────────────────────────────────────────────
// GENERATE GAMIFICATION STATE
// ─────────────────────────────────────────────────────────

export function generateGamificationState(): GamificationState {
  // Generate 30 days of completion dates
  const dailyCompletionDates: string[] = [];
  for (let i = 0; i < 30; i++) {
    if (Math.random() < 0.85) { // 85% days completed
      dailyCompletionDates.push(getDateDaysAgo(i));
    }
  }
  
  return {
    xp: 15420,
    level: 12,
    streak: 15,
    lastActiveDate: getDateDaysAgo(0),
    totalTasksCompleted: 156,
    totalTimerSeconds: 28400, // ~8 hours
    earlyBirdCount: 42,
    perfectDays: 8,
    activeDays: 26,
    dailyCompletionDates,
    achievements: [],
    rewards: [],
  };
}

// ─────────────────────────────────────────────────────────
// GENERATE HEALTH DATA
// ─────────────────────────────────────────────────────────

export function generateHealthData() {
  const waterEntries: WaterEntry[] = [];
  const weightEntries: WeightEntry[] = [];
  const waistEntries: WaistEntry[] = [];
  
  // Generate data for past 30 days
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const timestamp = getTimestampDaysAgo(dayOffset);
    
    // Water entries: 4-8 glasses per day
    const waterGlasses = randomInt(4, 8);
    for (let i = 0; i < waterGlasses; i++) {
      waterEntries.push({
        id: genId(),
        amount: randomInt(200, 350), // 200-350ml per glass
        timestamp: timestamp + i * randomInt(2, 4) * 60 * 60 * 1000,
        date: dateStr,
      });
    }
    
    // Weight: slight variations around 62-65kg
    weightEntries.push({
      id: genId(),
      value: 63 + (Math.random() * 2 - 1),
      timestamp,
      date: dateStr,
    });
    
    // Waist: slight variations around 76-78cm
    waistEntries.push({
      id: genId(),
      value: 77 + (Math.random() * 2 - 1),
      timestamp,
      date: dateStr,
    });
  }
  
  return {
    waterEntries,
    weightEntries,
    waistEntries,
    dailyWaterGoal: 2000,
    weightUnit: 'kg' as const,
    goals: {
      targetWeight: 62,
      targetWaist: 75,
      height: 168,
    },
  };
}

// ─────────────────────────────────────────────────────────
// GENERATE FINANCE DATA
// ─────────────────────────────────────────────────────────

export function generateFinanceData(): { categories: FinanceCategory[], costItems: CostItem[] } {
  const categories: FinanceCategory[] = [
    { id: 'inc_1', name: 'Doanh thu thư pháp', type: 'income', color: '#34D399' },
    { id: 'inc_2', name: 'Doanh thu tranh gạo', type: 'income', color: '#10B981' },
    { id: 'inc_3', name: 'Doanh thu workshop', type: 'income', color: '#059669' },
    { id: 'exp_1', name: 'Giấy và vật liệu', type: 'expense', color: '#F87171' },
    { id: 'exp_2', name: 'Mực và bút', type: 'expense', color: '#EF4444' },
    { id: 'exp_3', name: 'Khung tranh', type: 'expense', color: '#DC2626' },
    { id: 'exp_4', name: 'Điện nước', type: 'expense', color: '#FBBF24' },
    { id: 'exp_5', name: 'Marketing', type: 'expense', color: '#F59E0B' },
  ];
  
  const costItems: CostItem[] = [
    { id: 'cost_1', name: 'Tiền thuê nhà', amount: 5000000, type: 'fixed' },
    { id: 'cost_2', name: 'Tiền điện', amount: 800000, type: 'variable' },
    { id: 'cost_3', name: 'Tiền nước', amount: 300000, type: 'variable' },
    { id: 'cost_4', name: 'Internet', amount: 250000, type: 'fixed' },
    { id: 'cost_5', name: 'Mua giấy và gạo', amount: 2000000, type: 'variable' },
    { id: 'cost_6', name: 'Mua mực và bút', amount: 1500000, type: 'variable' },
  ];
  
  return { categories, costItems };
}

// ─────────────────────────────────────────────────────────
// SAVE ALL DUMMY DATA TO LOCALSTORAGE
// ─────────────────────────────────────────────────────────

export function saveAllDummyData() {
  const userId = 'dummy_user';
  
  // Generate all data
  const tasks = generateTasksForOneMonth();
  const templates = generateTaskTemplates();
  const gamification = generateGamificationState();
  const healthData = generateHealthData();
  const financeData = generateFinanceData();
  
  // Save to localStorage
  localStorage.setItem(`nw_tasks_${userId}`, JSON.stringify(tasks));
  localStorage.setItem(`nw_templates_${userId}`, JSON.stringify(templates));
  localStorage.setItem(`nw_gamification_${userId}`, JSON.stringify(gamification));
  localStorage.setItem(`nw_health_${userId}`, JSON.stringify(healthData));
  localStorage.setItem('nw_finance_cats', JSON.stringify(financeData.categories));
  localStorage.setItem('nw_cost_items', JSON.stringify(financeData.costItems));
  
  // Settings
  const settings = {
    theme: 'dark',
    currentPage: 'tasks' as const,
    language: 'vi',
    firstDayOfWeek: 1,
  };
  localStorage.setItem('nw_settings', JSON.stringify(settings));
  
  console.log('✅ Dummy data generated successfully!');
  console.log(`   - Tasks: ${tasks.length}`);
  console.log(`   - Templates: ${templates.length}`);
  console.log(`   - XP: ${gamification.xp}, Level: ${gamification.level}, Streak: ${gamification.streak}`);
  console.log(`   - Health entries: ${healthData.waterEntries.length} water, ${healthData.weightEntries.length} weight`);
  console.log(`   - Finance: ${financeData.categories.length} categories, ${financeData.costItems.length} cost items`);
  
  return {
    tasks,
    templates,
    gamification,
    healthData,
    financeData,
  };
}

// Run if executed directly
if (typeof window !== 'undefined') {
  (window as any).generateDummyData = saveAllDummyData;
}
