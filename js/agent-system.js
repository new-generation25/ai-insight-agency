import { AGENT_PROMPTS } from './agent-prompts.js';
import { CONFIG } from '../config.js';

class Manager {
    constructor() {
        this.state = {
            session_id: crypto.randomUUID(),
            current_phase: "시작",
            collected_info: {},
            conversation_history: [],
            draft: null
        };
    }

    async callGemini(systemPrompt, userMessage) {
        // 대화 기록을 API 형식으로 변환
        const historyForAPI = this.state.conversation_history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
        }));

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                ...historyForAPI,
                {
                    role: "user",
                    parts: Array.isArray(userMessage) ? userMessage : [{ text: userMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 4096
            }
        };

        try {
            // 1. 먼저 서버리스 API 시도 (Vercel 배포 시)
            let response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                return `⚠️ API 호출 실패: ${errorData.error || response.statusText}`;
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                console.error("Gemini API Error Response:", data);
                if (data.error) {
                    return `오류가 발생했어요: ${data.error.message}`;
                }
                return "응답을 받지 못했어요. 다시 시도해주세요.";
            }

            const text = data.candidates[0].content.parts[0].text;
            this.saveState(); // Save state after successful API call
            return text;
        } catch (error) {
            console.error("Gemini API Error:", error);
            return `연결 오류가 발생했어요: ${error.message}`;
        }
    }

    async processUserMessage(message) {
        // 파일 업로드 처리
        const isFileUpload = typeof message === 'string' && message.startsWith("[SYSTEM_FILE_UPLOAD]");
        const isBinaryUpload = typeof message === 'string' && message.startsWith("[SYSTEM_FILE_UPLOAD_BINARY]");

        if (isFileUpload || isBinaryUpload) {
            addMessage('system', "📂 파일을 확인했어요! 분석 중...", '🎩');
            this.state.current_phase = "분석";
            window.updateProgressStage('analysis');
        }

        // 사용자 메시지를 히스토리에 추가
        this.addToHistory('user', message);

        // 컨텍스트 요약 생성
        const contextSummary = this.getContextSummary();

        // 통합 프롬프트 생성
        const prompt = AGENT_PROMPTS.MAX
            .replace('{current_phase}', this.state.current_phase)
            .replace('{collected_info}', JSON.stringify(this.state.collected_info, null, 2))
            .replace('{context_summary}', contextSummary);

        // MAX 호출
        const response = await this.callGemini(prompt, message);

        // 응답 표시
        addMessage('system', response, '🎩');
        this.addToHistory('model', response);

        // 단계 업데이트 (응답 내용 기반)
        this.updatePhaseFromResponse(response);
    }

    getContextSummary() {
        if (this.state.conversation_history.length === 0) {
            return "새로운 대화입니다.";
        }

        const recentHistory = this.state.conversation_history.slice(-6);
        return recentHistory.map(msg =>
            `${msg.role === 'user' ? '사용자' : 'MAX'}: ${typeof msg.content === 'string'
                ? msg.content.substring(0, 100)
                : JSON.stringify(msg.content).substring(0, 100)
            }...`
        ).join('\n');
    }

    updatePhaseFromResponse(response) {
        const lower = response.toLowerCase();

        if (lower.includes('질문') || lower.includes('알려주') || lower.includes('어떤')) {
            this.state.current_phase = "인터뷰";
            window.updateProgressStage('interview');
        } else if (lower.includes('# ') && lower.includes('##')) {
            this.state.current_phase = "작성";
            window.updateProgressStage('drafting');
            this.state.draft = response;
        } else if (lower.includes('개선') || lower.includes('수정')) {
            this.state.current_phase = "다듬기";
            window.updateProgressStage('refinement');
        }
    }

    addToHistory(role, content) {
        this.state.conversation_history.push({
            role,
            content,
            timestamp: new Date().toISOString(),
            phase: this.state.current_phase
        });
        // 히스토리 길이 제한 (최근 50개로 확장)
        if (this.state.conversation_history.length > 50) {
            this.state.conversation_history = this.state.conversation_history.slice(-50);
        }
        this.saveState();
    }

    reset() {
        this.state = {
            session_id: crypto.randomUUID(),
            current_phase: "시작",
            collected_info: {},
            conversation_history: [],
            draft: null
        };
    }
}

// Global exposure for main.js interaction
const manager = new Manager();
window.manager = manager;
window.processUserMessage = (msg) => manager.processUserMessage(msg);
window.resetManager = () => manager.reset();
