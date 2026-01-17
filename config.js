// Config.js - API 키 관리
// ⚠️ 모든 API 키는 Vercel 환경변수에서 관리합니다
// 코드에 키를 직접 입력하지 마세요!

export const CONFIG = {
    // Gemini API - Vercel 환경변수(GEMINI_API_KEY)를 통해 서버측에서 처리되므로 비워둡니다.
    GEMINI_API_KEY: '',

    // Google Drive OAuth Client ID
    // ⚠️ 중요: 구글 로그인은 브라우저에서 직접 실행되므로 여기에 클라이언트 ID를 직접 입력해야 합니다.
    // (입력 후 구글 콘솔에서 도메인 제한 설정을 하시면 노출되어도 안전합니다.)
    DRIVE_CLIENT_ID: '',

    // Drive API Key - 새로 발급 후 반드시 [구글 클라우드 콘솔]에서 
    // HTTP 리퍼러(도메인) 제한 설정을 해야 안전합니다! (예: ai-insight-agency.vercel.app)
    DRIVE_API_KEY: ''
};
