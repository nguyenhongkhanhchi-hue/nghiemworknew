import type { Task } from '@/types';

// Export tasks to iCalendar format (.ics)
export function exportToICS(tasks: Task[]): string {
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NghiemWork//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:NghiemWork Tasks',
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  tasks.forEach(task => {
    if (!task.deadline) return;
    
    const deadline = new Date(task.deadline);
    const dtStamp = new Date(task.createdAt);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${task.id}@nghiemwork.app`);
    icsLines.push(`DTSTAMP:${formatDate(dtStamp)}`);
    icsLines.push(`DTSTART:${formatDate(deadline)}`);
    icsLines.push(`SUMMARY:${task.title.replace(/,/g, '\\,')}`);
    
    if (task.notes) {
      icsLines.push(`DESCRIPTION:${task.notes.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`);
    }
    
    if (task.status === 'done') {
      icsLines.push('STATUS:COMPLETED');
      if (task.completedAt) {
        icsLines.push(`COMPLETED:${formatDate(new Date(task.completedAt))}`);
      }
    } else if (task.status === 'in_progress') {
      icsLines.push('STATUS:IN-PROCESS');
    } else {
      icsLines.push('STATUS:NEEDS-ACTION');
    }
    
    // Priority based on quadrant
    const priority = task.quadrant === 'do_first' ? '1' : 
                    task.quadrant === 'schedule' ? '5' : '9';
    icsLines.push(`PRIORITY:${priority}`);
    
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
}

// Download ICS file
export function downloadICS(tasks: Task[], filename = 'nghiemwork-tasks.ics'): void {
  const icsContent = exportToICS(tasks);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Share individual task
export function shareTask(task: Task): string {
  const lines = ['📋 NGHIEMWORK TASK', ''];
  lines.push(`📌 ${task.title}`);
  
  if (task.deadline) {
    lines.push(`⏰ Hạn: ${new Date(task.deadline).toLocaleString('vi-VN')}`);
  }
  
  if (task.notes) {
    lines.push(`📝 ${task.notes}`);
  }
  
  if (task.finance) {
    const sign = task.finance.type === 'income' ? '+' : '-';
    lines.push(`💰 ${sign}${task.finance.amount.toLocaleString('vi-VN')}đ`);
  }
  
  lines.push('', '--- NghiemWork ---');
  return lines.join('\n');
}

// Export to Google Calendar URL
export function getGoogleCalendarUrl(task: Task): string {
  if (!task.deadline) return '';
  
  const deadline = new Date(task.deadline);
  const endDate = new Date(deadline.getTime() + 60 * 60 * 1000); // 1 hour duration
  
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${formatGoogleDate(deadline)}/${formatGoogleDate(endDate)}`,
    details: task.notes || '',
    ctz: 'Asia/Ho_Chi_Minh',
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Export to Outlook Web URL
export function getOutlookCalendarUrl(task: Task): string {
  if (!task.deadline) return '';
  
  const deadline = new Date(task.deadline);
  const endDate = new Date(deadline.getTime() + 60 * 60 * 1000);
  
  const params = new URLSearchParams({
    subject: task.title,
    startdt: deadline.toISOString(),
    enddt: endDate.toISOString(),
    body: task.notes || '',
    location: '',
  });
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Export tasks to JSON
export function exportToJSON(tasks: Task[]): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    app: 'NghiemWork',
    version: '1.0',
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      status: t.status,
      quadrant: t.quadrant,
      category: t.category,
      deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      finance: t.finance,
      recurring: t.recurring,
      duration: t.duration,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}

// Download JSON file
export function downloadJSON(tasks: Task[], filename = 'nghiemwork-tasks.json'): void {
  const jsonContent = exportToJSON(tasks);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export tasks to CSV
export function exportToCSV(tasks: Task[]): string {
  const headers = ['ID', 'Title', 'Notes', 'Status', 'Quadrant', 'Category', 'Deadline', 'Created At', 'Completed At', 'Finance Type', 'Finance Amount', 'Finance Note'];
  
  const rows = tasks.map(t => [
    t.id,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
    t.status || '',
    t.quadrant || '',
    t.category || '',
    t.deadline ? new Date(t.deadline).toISOString() : '',
    t.createdAt ? new Date(t.createdAt).toISOString() : '',
    t.completedAt ? new Date(t.completedAt).toISOString() : '',
    t.finance?.type || '',
    t.finance?.amount?.toString() || '',
    `"${(t.finance?.note || '').replace(/"/g, '""')}"`,
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// Download CSV file
export function downloadCSV(tasks: Task[], filename = 'nghiemwork-tasks.csv'): void {
  const csvContent = exportToCSV(tasks);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to PDF (using browser print)
export function exportToPDF(tasks: Task[]): void {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>NghiemWork Tasks</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .status-pending { color: #666; }
        .status-in_progress { color: #2196F3; }
        .status-done { color: #4CAF50; }
        .status-overdue { color: #f44336; }
      </style>
    </head>
    <body>
      <h1>📋 NghiemWork Tasks</h1>
      <p>Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
      <table>
        <thead>
          <tr>
            <th>Việc</th>
            <th>Trạng thái</th>
            <th>Góc phần tư</th>
            <th>Hạn</th>
            <th>Tài chính</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td>${t.title}</td>
              <td class="status-${t.status}">${t.status}</td>
              <td>${t.quadrant || '-'}</td>
              <td>${t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '-'}</td>
              <td>${t.finance ? `${t.finance.type === 'income' ? '+' : '-'}${t.finance.amount.toLocaleString('vi-VN')}đ` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
