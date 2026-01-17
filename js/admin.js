import { DriveAPI } from './drive-api.js';

const logListElement = document.getElementById('logList');
const chatViewElement = document.getElementById('chatView');
const summaryBtn = document.getElementById('summaryBtn');
const summaryResult = document.getElementById('summaryResult');
const loadingElement = document.getElementById('loading');

let selectedLog = null;

// Initialize Drive list
async function loadLogs() {
    try {
        const files = await DriveAPI.listFiles('AI_Agency_Projects/Logs');
        loadingElement.style.display = 'none';

        if (files.length === 0) {
            logListElement.innerHTML = '<p style="text-align:center; color:#64748b;">로그가 없습니다.</p>';
            return;
        }

        logListElement.innerHTML = '';
        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = `
                <div class="log-name">${file.name}</div>
                <div class="log-date">${new Date(file.createdTime).toLocaleString()}</div>
            `;
            div.onclick = () => selectLog(file);
            logListElement.appendChild(div);
        });
    } catch (err) {
        console.error("Log Load Error", err);
        loadingElement.innerHTML = '❌ 로그 로드 실패';
    }
}

async function selectLog(file) {
    // UI Update
    document.querySelectorAll('.log-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    chatViewElement.innerHTML = '<div style="text-align:center; padding:50px;">로그 읽는 중...</div>';
    summaryBtn.style.display = 'none';
    summaryResult.style.display = 'none';

    try {
        const content = await DriveAPI.getFileContent(file.id);
        selectedLog = content;
        renderChat(content.conversation_history);
        summaryBtn.style.display = 'block';
    } catch (err) {
        chatViewElement.innerHTML = '<div style="color:#f43f5e; text-align:center;">내용을 불러오지 못했습니다.</div>';
    }
}

function renderChat(history) {
    chatViewElement.innerHTML = '';
    history.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        div.innerText = msg.content;
        chatViewElement.appendChild(div);
    });
}

// AI Summary Logic
summaryBtn.onclick = async () => {
    if (!selectedLog) return;

    summaryResult.innerText = "✨ AI가 대화를 분석하고 요약 중입니다...";
    summaryResult.style.display = 'block';

    const prompt = `
    당신은 사용자 대화를 분석하여 관리자에게 보고하는 분석가입니다.
    다음 대화 기록을 바탕으로:
    1. 사용자의 주요 기획 의도와 목표
    2. 수집된 핵심 정보
    3. 작성된 기획서의 핵심 요약
    을 한눈에 알기 쉽게 3~5문장으로 요약하세요. 친절하지만 전문적인 어조를 사용하세요.
    
    [대화 기록]
    ${JSON.stringify(selectedLog.conversation_history)}
    `;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        summaryResult.innerText = text;
    } catch (err) {
        summaryResult.innerText = "❌ 요약에 실패했습니다.";
    }
};

// Wait for Drive API Init
const checkInit = setInterval(() => {
    if (DriveAPI.accessToken || (typeof google !== 'undefined' && DriveAPI.tokenClient)) {
        loadLogs();
        clearInterval(checkInit);
    }
}, 1000);
