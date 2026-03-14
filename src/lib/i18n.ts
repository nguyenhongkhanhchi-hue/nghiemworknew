import type { Language } from '@/types';

// Translation types
export type TranslationKey = 
  | 'app_name'
  | 'tasks'
  | 'schedule'
  | 'templates'
  | 'cashflow'
  | 'health'
  | 'settings'
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'done'
  | 'overdue'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'edit'
  | 'add'
  | 'search'
  | 'no_tasks'
  | 'add_task'
  | 'task_title'
  | 'task_notes'
  | 'deadline'
  | 'category'
  | 'finance'
  | 'income'
  | 'expense'
  | 'amount'
  | 'export'
  | 'import'
  | 'backup'
  | 'restore'
  | 'theme'
  | 'dark'
  | 'light'
  | 'language'
  | 'notifications'
  | 'about'
  | 'version'
  | 'logout'
  | 'login'
  | 'welcome'
  | 'loading'
  | 'error'
  | 'success'
  | 'confirm'
  | 'yes'
  | 'no'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'this_month'
  | 'all'
  | 'filter'
  | 'sort'
  | 'water'
  | 'weight'
  | 'waist'
  | 'streak'
  | 'level'
  | 'xp'
  | 'achievements'
  | 'calendar'
  | 'google_calendar'
  | 'outlook_calendar'
  | 'json'
  | 'csv'
  | 'pdf'
  | 'offline'
  | 'online'
  | 'keyboard_shortcuts';

type Translations = Record<TranslationKey, string>;

const vi: Translations = {
  app_name: 'Nghiệp việc',
  tasks: 'Việc',
  schedule: 'Lịch',
  templates: 'Mẫu',
  cashflow: 'Dòng tiền',
  health: 'Sức khoẻ',
  settings: 'Cài đặt',
  pending: 'Chờ xử lý',
  in_progress: 'Đang làm',
  paused: 'Tạm dừng',
  done: 'Hoàn thành',
  overdue: 'Quá hạn',
  save: 'Lưu',
  cancel: 'Huỷ',
  delete: 'Xoá',
  edit: 'Sửa',
  add: 'Thêm',
  search: 'Tìm kiếm',
  no_tasks: 'Không có việc nào',
  add_task: 'Thêm việc',
  task_title: 'Tên việc',
  task_notes: 'Ghi chú',
  deadline: 'Hạn chót',
  category: 'Danh mục',
  finance: 'Tài chính',
  income: 'Thu',
  expense: 'Chi',
  amount: 'Số tiền',
  export: 'Xuất',
  import: 'Nhập',
  backup: 'Sao lưu',
  restore: 'Khôi phục',
  theme: 'Giao diện',
  dark: 'Tối',
  light: 'Sáng',
  language: 'Ngôn ngữ',
  notifications: 'Thông báo',
  about: 'Giới thiệu',
  version: 'Phiên bản',
  logout: 'Đăng xuất',
  login: 'Đăng nhập',
  welcome: 'Chào mừng',
  loading: 'Đang tải...',
  error: 'Lỗi',
  success: 'Thành công',
  confirm: 'Xác nhận',
  yes: 'Có',
  no: 'Không',
  today: 'Hôm nay',
  tomorrow: 'Ngày mai',
  this_week: 'Tuần này',
  this_month: 'Tháng này',
  all: 'Tất cả',
  filter: 'Lọc',
  sort: 'Sắp xếp',
  water: 'Nước',
  weight: 'Cân nặng',
  waist: 'Vòng eo',
  streak: 'Ngày liên tiếp',
  level: 'Cấp độ',
  xp: 'Kinh nghiệm',
  achievements: 'Thành tựu',
  calendar: 'Lịch',
  google_calendar: 'Google Calendar',
  outlook_calendar: 'Outlook Calendar',
  json: 'JSON',
  csv: 'CSV',
  pdf: 'PDF',
  offline: 'Offline',
  online: 'Online',
  keyboard_shortcuts: 'Phím tắt',
};

const en: Translations = {
  app_name: 'NghiemWork',
  tasks: 'Tasks',
  schedule: 'Schedule',
  templates: 'Templates',
  cashflow: 'Cashflow',
  health: 'Health',
  settings: 'Settings',
  pending: 'Pending',
  in_progress: 'In Progress',
  paused: 'Paused',
  done: 'Done',
  overdue: 'Overdue',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add',
  search: 'Search',
  no_tasks: 'No tasks',
  add_task: 'Add Task',
  task_title: 'Task Title',
  task_notes: 'Notes',
  deadline: 'Deadline',
  category: 'Category',
  finance: 'Finance',
  income: 'Income',
  expense: 'Expense',
  amount: 'Amount',
  export: 'Export',
  import: 'Import',
  backup: 'Backup',
  restore: 'Restore',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  language: 'Language',
  notifications: 'Notifications',
  about: 'About',
  version: 'Version',
  logout: 'Logout',
  login: 'Login',
  welcome: 'Welcome',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  confirm: 'Confirm',
  yes: 'Yes',
  no: 'No',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This Week',
  this_month: 'This Month',
  all: 'All',
  filter: 'Filter',
  sort: 'Sort',
  water: 'Water',
  weight: 'Weight',
  waist: 'Waist',
  streak: 'Streak',
  level: 'Level',
  xp: 'XP',
  achievements: 'Achievements',
  calendar: 'Calendar',
  google_calendar: 'Google Calendar',
  outlook_calendar: 'Outlook Calendar',
  json: 'JSON',
  csv: 'CSV',
  pdf: 'PDF',
  offline: 'Offline',
  online: 'Online',
  keyboard_shortcuts: 'Keyboard Shortcuts',
};

const translations: Record<Language, Translations> = { vi, en };

// Get translation function
export function t(key: TranslationKey, language: Language = 'vi'): string {
  return translations[language][key] || key;
}

// Get all translations for a language
export function getTranslations(language: Language): Translations {
  return translations[language];
}
