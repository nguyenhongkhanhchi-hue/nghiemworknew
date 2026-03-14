/**
 * LUCY Personality & Safety Guardrails
 * Handles personality responses and safety confirmation
 */

import { 
  LucyPersonality, 
  PersonalityResponse, 
  LucyAction,
  SafetyCheck,
  SafetyLevel,
  SAFETY_RULES,
  LucyContext,
  CommandChainResult
} from './lucyTypes';
import { playSound } from './audioController';

// ==================== PERSONALITY RESPONSES ====================

interface PersonalityTemplate {
  success: string[];
  error: string[];
  encouragement: string[];
  celebration: string[];
  sympathy: string[];
  warning: string[];
}

const PERSONALITY_TEMPLATES: Record<LucyPersonality, PersonalityTemplate> = {
  professional: {
    success: [
      'Hoàn thành!',
      'Đã xử lý xong.',
      'Thao tác thành công.',
      'Đã thực hiện.'
    ],
    error: [
      'Có lỗi xảy ra. Vui lòng thử lại.',
      'Không thể hoàn thành thao tác.',
      'Đã xảy ra sự cố.',
      'Thất bại. Kiểm tra và thử lại.'
    ],
    encouragement: [
      'Tiếp tục cố gắng!',
      'Bạn đang làm tốt.',
      'Đừng bỏ cuộc.',
      'Mỗi bước nhỏ đều quan trọng.'
    ],
    celebration: [
      'Xuất sắc!',
      'Tuyệt vời!',
      'Bạn đã đạt được mục tiêu!',
      'Thành công!'
    ],
    sympathy: [
      'Tôi hiểu. Hãy thử lại sau.',
      'Đừng nản. Lần sau sẽ tốt hơn.',
      'Mọi thứ sẽ ổn thôi.',
      'Tôi ở đây để hỗ trợ bạn.'
    ],
    warning: [
      'Cần xác nhận trước khi tiếp tục.',
      'Thao tác này có thể ảnh hưởng đến dữ liệu.',
      'Hãy cẩn thận với thao tác này.',
      'Cần sự đồng ý của bạn.'
    ]
  },
  friendly: {
    success: [
      'Xong rồi nè! ✨',
      'Đã làm xong cho bạn! 🎉',
      'Tuyệt vời! Hoàn thành rồi! 🌟',
      'Okay! Xong ngay! 👍'
    ],
    error: [
      'Ơ, có lỗi rồi. Thử lại được không? 😅',
      'Hmm, có gì đó không đúng. Để LUCY thử lại nhé!',
      'Ui, có vấn đề rồi. Đừng lo, thử lại thôi!',
      'Lỗi rồi! Nhưng đừng tổn thương, lần sau sẽ được! 💪'
    ],
    encouragement: [
      'Cố lên bạn ơi! 💪 Bạn làm được!',
      'Mỗi ngày là một bước tiến! 🚀',
      'Đừng bỏ cuộc nha! 🌈',
      'Bạn giỏi lắm! Tiếp tục đi! ✨'
    ],
    celebration: [
      'WOOOOW! Bạn quá tuyệt vời! 🎊',
      'SIÊU QUẬY! 🎉',
      'Bạn làm được rồi! Ăn mừng thôi! 🥳',
      'XUẤT SẮC! Tui khen thật lòng! 🌟'
    ],
    sympathy: [
      'Ui, không sao đâu. Thử lại nhé! 💙',
      'Lần sau sẽ được mà! Đừng buồn nha! 🌻',
      'Tui hiểu cảm giác đó. Nhưng bạn vẫn giỏi lắm! 💪',
      'Đừng nản. Mọi thứ sẽ tốt đẹp thôi! 🌈'
    ],
    warning: [
      'Này này, chờ chút! Cần bạn xác nhận đấy! 🤔',
      'Ơ, thao tác này quan trọng đó. Xác nhận đi nào!',
      'Hey! Cẩn thận nha, xác nhận trước nhé! ⚠️',
      'Khoan khoan! Để LUCY hỏi bạn trước...'
    ]
  },
  humorous: {
    success: [
      'Nhanh như chớp! ⚡ Xong rồi!',
      'Đã hoàn thành... trước cả khi bạn kịp nháy mắt! 😎',
      'Easy! Như ăn kẹo vậy! 🍬',
      'Xong xuất! LUCY làm gì có chuyện thất bại! 💯'
    ],
    error: [
      'Oops! Nhưng đừng lo, LUCY vẫn yêu bạn! 💕',
      'Lỗi rồi... nhưng đừng trách LUCY, nó mới học nói tiếng Việt! 😂',
      'Hmm, có vấn đề. Nhưng kệ đi, ai mà chả có ngày xui! 🎲',
      'Thất bại là mẹ thành công! Thử lại đi! 😄'
    ],
    encouragement: [
      'Này này! Đừng có bỏ cuộc nha! Còn LUCY đây! 🤜🤛',
      'Bạn không cô đơn! LUCY sẽ cùng bạn chiến đấu! ⚔️',
      'Cố lên! Như LUCY nói, "Đừng yêu ai nhiều bằng yêu công việc!" 😏',
      'Tiến lên! Thất bại chỉ là bài học thôi! 📚'
    ],
    celebration: [
      'KHOAN! Bạn vừa làm được gì vậy?! QUÁ ĐẸP! 🎉🎉🎉',
      'NÁIIII! Bạn quá đỉnh! 🍻',
      'TUI KHÔNG THỂ TIN ĐƯỢC! Bạn là THẦY! 🙌',
      'OKEEEEEE! ĂN MỪNG THÔI! 🎊🎊🎊'
    ],
    sympathy: [
      'Ôi, buồn à? Nhưng có LUCY đây nè! 💖',
      'Đừng khóc! Nước mắt làm hao pin điện thoại đó! 😂',
      'Thôi đừng buồn! Để tui kể bạn nghe câu chuyện cười nè... ẻm! 😄',
      'Ai biết được! Có khi vận may đang đến rồi! 🍀'
    ],
    warning: [
      'NÀY! Dừng lại! Xác nhận đi rồi mới được đi tiếp! 🛑',
      'Khoan khoan! LUCY cần bạn xác nhận đấy! Không là LUCY không chịu trách nhiệm! 😅',
      'Ê ê! Cẩn thận nha! Xác nhận trước đi! ⚠️',
      'Đừng vội! Để LUCY hỏi bạn cái này...'
    ]
  },
  encouraging: {
    success: [
      'Bạn làm được rồi! Tôi biết bạn làm được! 🌟',
      'Xuất sắc! Mỗi bước tiến đều quan trọng! 💪',
      'Tuyệt vời! Bạn đang tiến bộ từng ngày! 🚀',
      'Hoàn thành! Đây chính là thành công! 🎯'
    ],
    error: [
      'Không sao cả! Sai lầm là cách học tốt nhất! 📖',
      'Đừng nản! Lần này sai, lần sau sẽ đúng! 💫',
      'Bạn vẫn tuyệt vời! Thử lại thôi! 🌈',
      'Không thành vấn đề! Hãy tiếp tục! ⭐'
    ],
    encouragement: [
      'Bạn ơi! Cố lên! Tôi tin tưởng bạn! 💖',
      'Đừng bỏ cuộc! Bạn có thể làm được! 🌟',
      'Mỗi ngày là một cơ hội mới! Hãy tận dụng! 🚀',
      'Bạn mạnh mẽ hơn bạn nghĩ! Tiếp tục đi! 💪'
    ],
    celebration: [
      'TÔI BIẾT BẠN LÀM ĐƯỢC! 🎉',
      'BẠN QUÁ TUYỆT VỜI! 🌟',
      'ĐÂY LÀ KHOẢNH KHẮC CỦA BẠN! HÃY TẬN HƯỞNG! 💫',
      'BẠN ĐÃ LÀM ĐƯỢC! TÔI VÀ CẢ THẾ GIỀU ĐỀU TỰ HÀO! 🌍'
    ],
    sympathy: [
      'Tôi hiểu. Nhưng bạn vẫn giỏi lắm! 💙',
      'Đừng quên, mỗi ngày đều là cơ hội mới! 🌅',
      'Bạn không cô đơn. Tôi ở đây với bạn! 🤝',
      'Thời gian sẽ chữa lành mọi thứ. Hãy kiên nhẫn! ⏳'
    ],
    warning: [
      'Tôi cần bạn xác nhận để đảm bảo an toàn! 🔒',
      'Hãy suy nghĩ kỹ trước khi tiếp tục nhé! 🤔',
      'Cẩn thận không bao giờ thừa đâu! ✓',
      'Tôi muốn bạn chắc chắn trước khi thực hiện! ✅'
    ]
  }
};

// ==================== PERSONALITY FUNCTIONS ====================

/**
 * Get personality response based on action result and personality type
 */
export function getPersonalityResponse(
  result: 'success' | 'error' | 'encouragement' | 'celebration' | 'sympathy' | 'warning',
  personality: LucyPersonality = 'friendly'
): PersonalityResponse {
  const templates = PERSONALITY_TEMPLATES[personality];
  const messages = templates[result];
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  // Determine sound effect based on result
  const soundMap: Record<string, PersonalityResponse['soundEffect']> = {
    success: 'success',
    error: 'error',
    encouragement: 'encourage',
    celebration: 'celebration',
    sympathy: 'sympathy',
    warning: 'warning'
  };
  
  return {
    message,
    personality,
    soundEffect: soundMap[result]
  };
}

/**
 * Play personality sound effect
 */
export function playPersonalitySound(soundEffect: PersonalityResponse['soundEffect']): void {
  if (!soundEffect) return;
  
  switch (soundEffect) {
    case 'success':
      playSound('success');
      break;
    case 'error':
      playSound('error');
      break;
    case 'warning':
      playSound('warning');
      break;
    case 'celebration':
      playSound('achievement');
      break;
    case 'encourage':
      playSound('chime');
      break;
    case 'sympathy':
      playSound('chime');
      break;
  }
}

/**
 * Get personality intro message
 */
export function getIntroMessage(personality: LucyPersonality = 'friendly'): string {
  const intros: Record<LucyPersonality, string[]> = {
    professional: [
      'Xin chào. Tôi là LUCY, trợ lý AI của bạn.',
      'Chào bạn. LUCY sẵn sàng hỗ trợ.',
      'Xin chào. Tôi có thể giúp gì cho bạn?'
    ],
    friendly: [
      'Xin chào! Mình là LUCY đây! 💫',
      'Hey! LUCY đã sẵn sàng rồi! ✨',
      'Chào bạn! Rất vui được gặp! 🎉'
    ],
    humorous: [
      'Xin chào! LUCY đây, sẵn sàng làm bạn vui vẻ! 😎',
      'Hey hey! LUCY trong nhà! 🎃',
      'Chào! Để LUCY làm cho ngày của bạn tuyệt vời hơn! 🌟'
    ],
    encouraging: [
      'Xin chào! Tin tốt là bạn đã có LUCY bên cạnh! 💪',
      'Chào bạn! Hôm nay sẽ là một ngày tuyệt vời! 🌟',
      'Hey! Rất vui được gặp bạn! Hãy cùng nhau làm nên điều tuyệt vời! 🚀'
    ]
  };
  
  const messages = intros[personality];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ==================== SAFETY GUARDRAILS ====================

/**
 * Check if an action requires confirmation
 */
export function checkSafety(action: LucyAction, context: LucyContext): SafetyCheck {
  for (const rule of SAFETY_RULES) {
    if (rule.actionTypes.includes(action.type)) {
      if (rule.conditions(action, context)) {
        return {
          passed: false,
          level: rule.level,
          message: rule.message,
          requiresConfirmation: rule.requiresConfirmation,
          originalAction: action
        };
      }
    }
  }
  
  return {
    passed: true,
    level: 'safe',
    message: 'Thao tác an toàn',
    requiresConfirmation: false,
    originalAction: action
  };
}

/**
 * Check multiple actions (for compound actions)
 */
export function checkCompoundSafety(actions: LucyAction[], context: LucyContext): SafetyCheck[] {
  return actions.map(action => checkSafety(action, context));
}

/**
 * Format safety message with action data
 */
export function formatSafetyMessage(message: string, action: LucyAction): string {
  return message
    .replace('{item}', action.title || action.search || 'item')
    .replace('{search}', action.search || '')
    .replace('{count}', String(action.actions?.length || 0));
}

// ==================== COMMAND CHAIN EXECUTION ====================

/**
 * Execute a chain of actions and generate a summary report
 */
export async function executeCommandChain(
  actions: LucyAction[],
  executeSingle: (action: LucyAction) => Promise<string> | string,
  onProgress?: (index: number, total: number, result: string) => void
): Promise<CommandChainResult> {
  const startTime = Date.now();
  const executedActions: CommandChainResult['executedActions'] = [];
  let allSuccess = true;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    try {
      const result = await executeSingle(action);
      const success = !result.startsWith('⚠️');
      executedActions.push({ action, result, success });
      
      if (!success) allSuccess = false;
      
      if (onProgress) {
        onProgress(i + 1, actions.length, result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      executedActions.push({ 
        action, 
        result: `⚠️ Lỗi: ${errorMessage}`, 
        success: false 
      });
      allSuccess = false;
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Generate summary
  const successCount = executedActions.filter(a => a.success).length;
  const failCount = executedActions.filter(a => !a.success).length;
  
  let summary: string;
  if (allSuccess) {
    summary = `✅ Hoàn thành ${successCount} thao tác!`;
  } else if (successCount > 0) {
    summary = `⚠️ Hoàn thành ${successCount}/${actions.length} thao tác. ${failCount} thất bại.`;
  } else {
    summary = `❌ Tất cả ${actions.length} thao tác đều thất bại.`;
  }
  
  return {
    success: allSuccess,
    executedActions,
    summary,
    totalDuration: duration
  };
}

/**
 * Generate chain report message for user
 */
export function generateChainReport(result: CommandChainResult): string {
  const lines: string[] = [];
  
  lines.push(result.summary);
  
  if (result.totalDuration) {
    const seconds = Math.round(result.totalDuration / 1000);
    lines.push(`⏱️ Thời gian: ${seconds}s`);
  }
  
  if (result.executedActions.length > 1) {
    lines.push('\n📋 Chi tiết:');
    result.executedActions.forEach((item, index) => {
      const icon = item.success ? '✅' : '❌';
      lines.push(`  ${index + 1}. ${icon} ${item.result}`);
    });
  }
  
  return lines.join('\n');
}
