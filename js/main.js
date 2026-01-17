// Basic UI Logic
import { DriveAPI } from './drive-api.js';
console.log('Main.js loaded');

const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('btn-send');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

// --- Helper Functions ---

function addMessage(role, text, avatarIcon = '👤') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role === 'user' ? 'user' : 'system');

    // For system messages, use the specific agent icon if provided, else default
    let displayIcon = avatarIcon;
    if (role === 'user') displayIcon = '👤';

    // Simple Markdown Parsing (Bold & Newlines)
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\n/g, '<br>'); // Newlines

    msgDiv.innerHTML = `
        <div class="avatar">${displayIcon}</div>
        <div class="content"><p>${formattedText}</p></div>
    `;

    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Save to LocalStorage
    saveChatHistory();
}

// Save chat history to LocalStorage
function saveChatHistory() {
    const messages = [];
    const messageElements = chatHistory.querySelectorAll('.message');

    messageElements.forEach(msgEl => {
        const role = msgEl.classList.contains('user') ? 'user' : 'system';
        const avatar = msgEl.querySelector('.avatar').innerText;
        const content = msgEl.querySelector('.content p').innerHTML;

        messages.push({ role, avatar, content });
    });

    localStorage.setItem('chatHistory', JSON.stringify(messages));
}

// Load chat history from LocalStorage
function loadChatHistory() {
    const saved = localStorage.getItem('chatHistory');
    if (!saved) return;

    try {
        const messages = JSON.parse(saved);
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('message', msg.role === 'user' ? 'user' : 'system');

            msgDiv.innerHTML = `
                <div class="avatar">${msg.avatar}</div>
                <div class="content"><p>${msg.content}</p></div>
            `;

            chatHistory.appendChild(msgDiv);
        });

        chatHistory.scrollTop = chatHistory.scrollHeight;
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
}

async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 1. Add User Message
    addMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto'; // Reset height

    // 2. Call Agent System
    if (window.processUserMessage) {
        window.processUserMessage(text);
    } else {
        console.error("Manager not loaded");
        addMessage('system', "System Warning: Agent Manager not initialized.");
    }
}

// Expose UI functions to window for agent-system.js to use
window.addMessage = addMessage;
// --- UI Update Helper ---

function updateProgressStage(stageName) {
    // 1. Reset all to 'Waiting' (except completed?) - For simplicity, let's just highlight the active one
    const allStages = document.querySelectorAll('.agent-item');
    allStages.forEach(item => {
        item.classList.remove('active');
        const statusText = item.querySelector('.status');
        if (statusText.innerText === '진행 중') statusText.innerText = '완료'; // Mark previous as done
    });

    // 2. Activate currents
    const targetId = `step-${stageName.toLowerCase()}`;
    const targetEl = document.getElementById(targetId);

    if (targetEl) {
        targetEl.classList.add('active');
        targetEl.querySelector('.status').innerText = '진행 중';
    }
}

window.updateProgressStage = updateProgressStage;

function updateAgentStatus(agentId, statusText) {
    const agentEl = document.getElementById(agentId);
    if (!agentEl) return;

    // Clear all active classes first
    document.querySelectorAll('.agent-item').forEach(el => el.classList.remove('active'));

    // Set this one to active
    agentEl.classList.add('active');
    const statusSpan = agentEl.querySelector('.status');
    if (statusSpan) statusSpan.textContent = statusText;
}

const saveButton = document.getElementById('btn-save');
const loginButton = document.getElementById('btn-login');

// --- Event Listeners ---

sendButton.addEventListener('click', handleSendMessage);

if (loginButton) {
    loginButton.addEventListener('click', async () => {
        try {
            await DriveAPI.authenticate();
            addMessage('system', '✅ 구글 드라이브 연결 성공!', '🔐');
            loginButton.style.display = 'none'; // Hide after success
        } catch (err) {
            addMessage('system', `❌ 로그인 실패: ${err.message}`);
        }
    });
}

if (saveButton) {
    saveButton.addEventListener('click', async () => {
        const content = chatHistory.innerText;
        if (!content || content.trim().length < 10) {
            addMessage('system', '⚠️ 저장할 내용이 충분하지 않습니다.');
            return;
        }

        try {
            addMessage('system', '💾 구글 드라이브에 저장을 시도합니다...', '⏳');
            const result = await DriveAPI.uploadFile('Project_Proposal.md', content);
            addMessage('system', `✅ 드라이브 저장 완료! (ID: ${result.id})`, '💾');
        } catch (err) {
            addMessage('system', `❌ 저장 실패: ${err.message}`, '⚠️');
        }
    });
}

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Load saved chat history on page load
loadChatHistory();

// Reset button - clear chat history
const resetButton = document.getElementById('btn-reset');
if (resetButton) {
    resetButton.addEventListener('click', () => {
        if (confirm('대화 내용을 모두 삭제하시겠습니까?')) {
            localStorage.removeItem('chatHistory');
            chatHistory.innerHTML = '';
            // Add welcome message back
            addMessage('system', '안녕하세요! 저는 AI Insight Agency의 총괄 기획 파트너, **MAX**입니다! 만나서 정말 반가워요. 😊\n\n멋진 프로젝트 기획, 저장 같이 시작해 볼까요? 공고문 파일을 주시거나, 어떤 기획을 하고 싶은지 편하게 말씀해 주세요!', '🎩');
        }
    });
}

// File Upload - Drop Zone
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent-color)';
    dropZone.style.background = 'rgba(59, 130, 246, 0.1)';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--glass-border)';
    dropZone.style.background = 'transparent';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--glass-border)';
    dropZone.style.background = 'transparent';

    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
        handleFiles(fileInput.files);
    }
});

// --- Progress UI Elements ---
const uploadOverlay = document.getElementById('upload-overlay');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

async function handleFiles(files) {
    const file = files[0];

    // 1. Show Progress
    if (uploadOverlay) {
        uploadOverlay.style.display = 'flex';
        progressFill.style.width = '0%';
        progressText.innerText = 'Starting...';
    }

    try {
        // 2. Upload to Drive first (Unified Flow)
        // User action representation
        addMessage('user', `📂 파일 업로드: ${file.name}`);

        await DriveAPI.uploadFileProgress(file, 'AI_Agency_Projects', (percent) => {
            if (uploadOverlay) {
                progressFill.style.width = `${percent}%`;
                progressText.innerText = `${Math.round(percent)}%`;
            }
        });

        // addMessage('system', `✅ Upload Complete! Now Analyzing...`, '📂'); // Optional: clutter reduction

    } catch (err) {
        console.error("Drive upload failed", err);
        addMessage('system', `⚠️ Drive Upload Failed: ${err.message}. Analyzing locally only...`, '⚠️');
        // Continue to analysis even if upload fails
    } finally {
        if (uploadOverlay) setTimeout(() => uploadOverlay.style.display = 'none', 500);
    }

    // 3. Proceed to Local Analysis (Gemini)
    updateAgentStatus('agent-analyst', 'Reading File...');
    const reader = new FileReader();

    reader.onload = (e) => {
        const result = e.target.result;

        // Check if binary (PDF/Image) or Text
        let instructions = "";

        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
            // Binary -> Base64
            const base64Data = result.split(',')[1];
            instructions = `[SYSTEM_FILE_UPLOAD_BINARY]\nFILENAME: ${file.name}\nMIMETYPE: ${file.type}\nDATA: ${base64Data}`;
        } else {
            // Text
            instructions = `[SYSTEM_FILE_UPLOAD]\nFILENAME: ${file.name}\nCONTENT:\n${result}`;
        }

        if (window.processUserMessage) {
            window.processUserMessage(instructions);
        }
    };

    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
}
