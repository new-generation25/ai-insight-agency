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

    summaryBtn.disabled = true;
    summaryResult.innerHTML = "✨ AI가 대화를 분석하고 요약 중입니다...<br><span style='font-size:0.8em; color:#94a3b8;'>사용자의 기획 의도와 철학을 파악하고 있습니다.</span>";
    summaryResult.style.display = 'block';

    const prompt = `
    당신은 사용자 대화를 분석하여 관리자에게 보고하는 전문 기획 분석가입니다.
    다음 대화 기록을 바탕으로 사용자의 고유한 생각과 기획 의도를 중심으로 요약하세요.
    
    [핵심 요약 포인트]
    1. 사용자의 기획 의도와 해결하고자 하는 문제 (Why)
    2. 프로젝트의 핵심 아이디어와 차별화된 디테일 (Unique Selling Point)
    3. 수집된 핵심 정보 및 현재 진행 단계
    
    3~5문장으로 요약하고, 불렛 포인트를 섞어 가독성 있게 한국어로 보고하세요.
    
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
        summaryResult.innerHTML = `<div style="font-size: 0.9em; line-height: 1.6;">${text.replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
        summaryResult.innerText = "❌ 요약에 실패했습니다. API 연결을 확인해주세요.";
    } finally {
        summaryBtn.disabled = false;
    }
};

// Start Auth & Load
async function initAdmin() {
    try {
        // Wait for DriveAPI to be ready
        let retry = 0;
        while (!DriveAPI.tokenClient && retry < 20) {
            await new Promise(r => setTimeout(r, 500));
            retry++;
        }

        if (!DriveAPI.tokenClient) throw new Error("Google API 로드 지연 (F5를 눌러주세요)");

        // Try to get token (May show popup if first time)
        await DriveAPI.authenticate();
        await loadLogs();
    } catch (err) {
        console.error("Admin Init Failed", err);
        loadingElement.innerHTML = `❌ 로그를 불러올 수 없습니다.<br><span style="font-size:0.75em; color:#f43f5e;">${err.message}</span><br><button onclick="location.reload()" style="margin-top:10px; padding:5px 10px; cursor:pointer;">재시도</button>`;
    }
}

initAdmin();
