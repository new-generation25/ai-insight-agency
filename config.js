// Config.js - API 키 관리
// ⚠️ 모든 API 키는 Vercel 환경변수에서 관리합니다
// 코드에 키를 직접 입력하지 마세요!

export const CONFIG = {
    // Gemini API - Vercel 환경변수: GEMINI_API_KEY
    GEMINI_API_KEY: '',

    // Google Drive OAuth Client ID (노출되어도 안전 - 도메인 제한으로 보호)
    // 새로 발급받은 Client ID를 여기에 입력
    DRIVE_CLIENT_ID: '',

    // Drive API Key - 새로 발급 후 도메인 제한 설정 필요
    DRIVE_API_KEY: ''
};

// 로컬스토리지에서 API 키 불러오기 (로컬 개발용)
export function getApiKey() {
    return localStorage.getItem('gemini_api_key') || CONFIG.GEMINI_API_KEY;
}

// API 키 저장
export function setApiKey(key) {
    localStorage.setItem('gemini_api_key', key);
}
