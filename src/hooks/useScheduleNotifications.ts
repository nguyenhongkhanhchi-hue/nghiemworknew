import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { sendNotification, getNowInTimezone } from '@/lib/notifications';
import { playChime, playWarningSound } from '@/lib/soundEffects';
import type { Task } from '@/types';

// Notification types
type NotificationType = 'start' | 'expected_end' | 'deadline';

// Track which notifications have been sent
interface NotifiedTasks {
  start: Set<string>;
  expectedEnd: Set<string>;
  deadline: Set<string>;
}

// Calculate reliability score based on timing
function calculateReliabilityScore(
  startStatus: 'early' | 'on_time' | 'late' | 'not_started',
  endStatus: 'early' | 'on_time' | 'late' | 'not_completed',
  deadlineStatus: 'before' | 'on_time' | 'after' | 'not_applicable'
): number {
  let score = 100;
  
  // Start time factor (30% weight)
  if (startStatus === 'early') score -= 0;
  else if (startStatus === 'on_time') score -= 5;
  else if (startStatus === 'late') score -= 15;
  // 'not_started' doesn't penalize yet
  
  // End time vs expected (40% weight)
  if (endStatus === 'early') score -= 0;
  else if (endStatus === 'on_time') score -= 5;
  else if (endStatus === 'late') score -= 20;
  // 'not_completed' doesn't penalize yet
  
  // Deadline factor (30% weight)
  if (deadlineStatus === 'before') score -= 0;
  else if (deadlineStatus === 'on_time') score -= 5;
  else if (deadlineStatus === 'after') score -= 25;
  
  return Math.max(0, Math.round(score));
}

// Get expected end time from task
function getExpectedEndTime(task: Task, now: number): number | null {
  if (!task.startTime || !task.duration || !task.startDate) return null;
  
  const [hours, minutes] = task.startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const expectedMinutes = startMinutes + task.duration;
  
  // Parse startDate
  const [year, month, day] = task.startDate.split('-').map(Number);
  const expectedDate = new Date(year!, month! - 1, day!);
  expectedDate.setHours(Math.floor(expectedMinutes / 60));
  expectedDate.setMinutes(expectedMinutes % 60);
  expectedDate.setSeconds(0);
  
  return expectedDate.getTime();
}

// Check if current time matches target time (within 1 minute window)
function isTimeMatch(currentTime: number, targetTime: number): boolean {
  const diff = Math.abs(currentTime - targetTime);
  return diff <= 60000; // Within 1 minute
}

export function useScheduleNotifications() {
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const updateTask = useTaskStore(s => s.updateTask);
  const startTimerFn = useTaskStore(s => s.startTimer);
  const completeTaskFn = useTaskStore(s => s.completeTask);
  
  const notifiedRef = useRef<NotifiedTasks>({
    start: new Set(),
    expectedEnd: new Set(),
    deadline: new Set(),
  });
  
  const lastCheckRef = useRef<number>(0);
  
  // Send notification with bell sound and voice
  const sendScheduleNotification = useCallback((
    task: Task,
    type: NotificationType,
    onAccept?: () => void,
    onDecline?: () => void
  ) => {
    // Play bell sound first
    playChime();
    
    let title = '';
    let body = '';
    let voiceText = '';
    
    if (type === 'start') {
      title = `⏰ Bắt đầu: ${task.title}`;
      body = 'Đã đến giờ bắt đầu! Bạn có muốn bắt đầu hẹn giờ không?';
      voiceText = `Đã đến giờ bắt đầu công việc ${task.title}. Bạn có muốn bắt đầu hẹn giờ không?`;
    } else if (type === 'expected_end') {
      title = `🏁 Kết thúc dự kiến: ${task.title}`;
      body = 'Đã đến giờ kết thúc dự kiến! Bạn có muốn kết thúc hẹn giờ không?';
      voiceText = `Đã đến giờ kết thúc dự kiến của công việc ${task.title}. Bạn có muốn kết thúc hẹn giờ không?`;
    } else if (type === 'deadline') {
      title = `⚠️ CẢNH BÁO: ${task.title}`;
      body = 'Đã đến deadline!';
      voiceText = `Cảnh báo! Công việc ${task.title} đã đến deadline!`;
    }
    
    // Send push notification
    sendNotification(title, body, `schedule-${type}-${task.id}`);
    
    // Voice announcement using Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voiceText);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.lang = 'vi-VN';
      
      // Try to find Vietnamese voice
      const voices = window.speechSynthesis.getVoices();
      const vietnameseVoice = voices.find(v => v.lang.startsWith('vi'));
      if (vietnameseVoice) {
        utterance.voice = vietnameseVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
    
    // Store callback for button interactions (would need UI integration)
    if (type === 'start' || type === 'expected_end') {
      // For now, we'll auto-start/stop if user has auto mode enabled
      const autoMode = localStorage.getItem('schedule_auto_mode') === 'true';
      if (autoMode && onAccept) {
        setTimeout(() => onAccept(), 2000);
      }
    }
  }, []);
  
  // Calculate and update reliability for completed task
  const calculateReliability = useCallback((task: Task): {
    score: number;
    startStatus: 'early' | 'on_time' | 'late' | 'not_started';
    endStatus: 'early' | 'on_time' | 'late' | 'not_completed';
    deadlineStatus: 'before' | 'on_time' | 'after' | 'not_applicable';
  } => {
    const now = getNowInTimezone(timezone).getTime();
    
    // Calculate expected start time
    let startStatus: 'early' | 'on_time' | 'late' | 'not_started' = 'not_started';
    if (task.startTime && task.startDate && task.actualStartTime) {
      const [hours, minutes] = task.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const [year, month, day] = task.startDate.split('-').map(Number);
      const expectedStart = new Date(year!, month! - 1, day!);
      expectedStart.setHours(Math.floor(startMinutes / 60));
      expectedStart.setMinutes(startMinutes % 60);
      expectedStart.setSeconds(0);
      const expectedStartTime = expectedStart.getTime();
      
      const diff = task.actualStartTime - expectedStartTime;
      if (diff < -60000) startStatus = 'early';
      else if (diff <= 60000) startStatus = 'on_time';
      else startStatus = 'late';
    }
    
    // Calculate end status vs expected
    let endStatus: 'early' | 'on_time' | 'late' | 'not_completed' = 'not_completed';
    const expectedEndTime = getExpectedEndTime(task, now);
    if (task.actualEndTime && expectedEndTime) {
      const diff = task.actualEndTime - expectedEndTime;
      if (diff < -60000) endStatus = 'early';
      else if (diff <= 60000) endStatus = 'on_time';
      else endStatus = 'late';
    }
    
    // Calculate deadline status
    let deadlineStatus: 'before' | 'on_time' | 'after' | 'not_applicable' = 'not_applicable';
    if (task.actualEndTime && task.deadline) {
      const diff = task.actualEndTime - task.deadline;
      if (diff < -60000) deadlineStatus = 'before';
      else if (diff <= 60000) deadlineStatus = 'on_time';
      else deadlineStatus = 'after';
    }
    
    const score = calculateReliabilityScore(startStatus, endStatus, deadlineStatus);
    
    return { score, startStatus, endStatus, deadlineStatus };
  }, [timezone]);
  
  // Main monitoring effect - runs every minute
  useEffect(() => {
    const checkSchedule = () => {
      const now = getNowInTimezone(timezone).getTime();
      
      // Prevent multiple checks per minute
      if (now - lastCheckRef.current < 30000) return;
      lastCheckRef.current = now;
      
      const notified = notifiedRef.current;
      
      tasks.forEach(task => {
        // Only check pending or in-progress tasks
        if (task.status !== 'pending' && task.status !== 'in_progress') return;
        if (!task.startTime || !task.startDate) return;
        
        // Calculate scheduled times
        const [hours, minutes] = task.startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const [year, month, day] = task.startDate.split('-').map(Number);
        
        // Expected start time
        const scheduledStart = new Date(year!, month! - 1, day!);
        scheduledStart.setHours(Math.floor(startMinutes / 60));
        scheduledStart.setMinutes(startMinutes % 60);
        scheduledStart.setSeconds(0);
        const scheduledStartTime = scheduledStart.getTime();
        
        // Expected end time
        const expectedEndTime = getExpectedEndTime(task, now);
        
        // 1. Check for start time notification
        if (!notified.start.has(task.id) && task.status === 'pending') {
          if (isTimeMatch(now, scheduledStartTime)) {
            notified.start.add(task.id);
            sendScheduleNotification(task, 'start', () => {
              // User accepted - start timer
              startTimerFn(task.id);
              // Record actual start time
              updateTask(task.id, { actualStartTime: now });
            });
          }
        }
        
        // 2. Check for expected end time notification
        if (expectedEndTime && !notified.expectedEnd.has(task.id)) {
          if (isTimeMatch(now, expectedEndTime)) {
            notified.expectedEnd.add(task.id);
            sendScheduleNotification(task, 'expected_end', () => {
              // User accepted - complete task
              completeTaskFn(task.id);
            });
          }
        }
        
        // 3. Check for deadline notification
        if (task.deadline && !notified.deadline.has(task.id)) {
          if (isTimeMatch(now, task.deadline)) {
            notified.deadline.add(task.id);
            playWarningSound();
            sendScheduleNotification(task, 'deadline');
          }
        }
      });
    };
    
    // Check immediately on mount
    checkSchedule();
    
    // Then check every minute
    const interval = setInterval(checkSchedule, 60000);
    
    return () => clearInterval(interval);
  }, [tasks, timezone, updateTask, startTimerFn, completeTaskFn, sendScheduleNotification]);
  
  // Update reliability score when task is completed
  const updateTaskReliability = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const reliability = calculateReliability({
      ...task,
      actualEndTime: Date.now(),
    });
    
    updateTask(taskId, {
      actualEndTime: Date.now(),
      reliabilityScore: reliability.score,
      startStatus: reliability.startStatus,
      endStatus: reliability.endStatus,
      deadlineStatus: reliability.deadlineStatus,
    });
  }, [tasks, calculateReliability, updateTask]);
  
  // Record actual start time when timer starts
  const recordActualStart = useCallback((taskId: string) => {
    const now = getNowInTimezone(timezone).getTime();
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.actualStartTime) return;
    
    // Calculate start status
    let startStatus: 'early' | 'on_time' | 'late' = 'on_time';
    if (task.startTime && task.startDate) {
      const [hours, minutes] = task.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const [year, month, day] = task.startDate.split('-').map(Number);
      
      const scheduledStart = new Date(year!, month! - 1, day!);
      scheduledStart.setHours(Math.floor(startMinutes / 60));
      scheduledStart.setMinutes(startMinutes % 60);
      scheduledStart.setSeconds(0);
      
      const diff = now - scheduledStart.getTime();
      if (diff < -60000) startStatus = 'early';
      else if (diff > 60000) startStatus = 'late';
    }
    
    updateTask(taskId, {
      actualStartTime: now,
      startStatus,
    });
  }, [tasks, timezone, updateTask]);
  
  return {
    updateTaskReliability,
    recordActualStart,
    calculateReliability,
  };
}
