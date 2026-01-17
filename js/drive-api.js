import { CONFIG } from '../config.js';

// Google Drive API Wrapper
// Uses Google Identity Services (GIS) and GAPI

export const DriveAPI = {
    tokenClient: null,
    accessToken: null,
    authResolve: null, // Promise resolver

    // Initialize the API
    init: async () => {
        return new Promise((resolve, reject) => {
            // CLIENT_ID가 없으면 Drive 기능 비활성화
            if (!CONFIG.DRIVE_CLIENT_ID) {
                console.log("Drive API disabled: No client ID configured");
                resolve(false);
                return;
            }

            if (typeof gapi === 'undefined' || typeof google === 'undefined') {
                console.warn("Google API scripts not loaded yet.");
                resolve(false);
                return;
            }

            // 1. Initialize GIS Token Client (Auth) - Critical
            try {
                DriveAPI.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.DRIVE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/drive',
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            DriveAPI.accessToken = tokenResponse.access_token;
                            console.log("Drive Access Token received");
                            if (DriveAPI.authResolve) {
                                DriveAPI.authResolve(tokenResponse.access_token);
                                DriveAPI.authResolve = null;
                            }
                        }
                    },
                });
                console.log("Token Client Initialized");
            } catch (err) {
                console.error("GIS Init Error", err);
                // 오류 메시지를 UI에 표시하지 않음 (Drive 기능은 선택적)
            }

            // 2. Load GAPI client (Optional for Raw REST, but good for context)
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.DRIVE_API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    console.log("GAPI Client Initialized");
                    resolve(true); // GAPI ready
                } catch (err) {
                    console.error("GAPI Init Error (Non-fatal for Auth)", err);
                    // We don't verify strict GAPI success for simple REST uploads
                    // But we log it.
                    // if (window.addMessage) window.addMessage('system', `⚠️ API 연결 경고: ${err.result?.error?.message || err.message} (업로드는 가능할 수 있습니다)`);
                    resolve(true);
                }
            });
        });
    },

    // Trigger Auth Flow (Async)
    authenticate: () => {
        return new Promise((resolve, reject) => {
            if (!DriveAPI.tokenClient) {
                console.error("Token Client not initialized.");
                const msg = "구글 인증 모듈이 로드되지 않았습니다.\n새로고침(F5) 후 3-5초 뒤에 다시 시도해주세요.";
                if (window.addMessage) window.addMessage('system', `⚠️ ${msg}`);
                alert(msg);
                reject(new Error("TokenClient not ready"));
                return;
            }

            if (window.addMessage) window.addMessage('system', '🔑 구글 로그인 창을 여는 중입니다... 팝업을 확인해주세요!', '🔐');

            DriveAPI.authResolve = resolve; // Register callback
            DriveAPI.tokenClient.requestAccessToken();
        });
    },

    // Find or Create specific folder
    getOrCreateFolder: async (folderName, parentId = 'root') => {
        const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + DriveAPI.accessToken }
            });
            const data = await response.json();

            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            } else {
                const metadata = {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                };
                const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + DriveAPI.accessToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(metadata)
                });
                const createData = await createRes.json();
                return createData.id;
            }
        } catch (error) {
            console.error("Error getting folder", error);
            return null;
        }
    },

    // Upload File with Progress (Binary or Text)
    uploadFileProgress: async (fileObj, folderName = 'AI_Agency_Projects', onProgress) => {
        if (!DriveAPI.accessToken) {
            console.log("No token, requesting auth...");
            try {
                await DriveAPI.authenticate(); // Wait for user login
            } catch (e) {
                throw new Error("Login Cancelled or Failed");
            }
        }

        // 1. Get Folder ID
        const folderId = await DriveAPI.getOrCreateFolder(folderName);

        const metadata = {
            name: fileObj.name,
            mimeType: fileObj.type || 'application/octet-stream', // Default to binary if unknown
        };

        if (folderId) {
            metadata.parents = [folderId];
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileObj);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
            xhr.setRequestHeader('Authorization', 'Bearer ' + DriveAPI.accessToken);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    console.log("File Uploaded:", data);
                    resolve(data);
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network Error during upload"));

            xhr.send(form);
        });
    },

    // List files in a specific folder
    listFiles: async (folderName = 'AI_Agency_Projects/Logs') => {
        if (!DriveAPI.accessToken) await DriveAPI.authenticate();

        // Find folder ID first (sequential parent traversal)
        const parts = folderName.split('/');
        let parentId = 'root';
        for (const part of parts) {
            parentId = await DriveAPI.getOrCreateFolder(part, parentId);
            if (!parentId) throw new Error(`Folder not found: ${part}`);
        }
        const folderId = parentId;

        const q = `'${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + DriveAPI.accessToken }
        });
        const data = await response.json();
        return data.files || [];
    },

    // Get file content by ID
    getFileContent: async (fileId) => {
        if (!DriveAPI.accessToken) await DriveAPI.authenticate();
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + DriveAPI.accessToken }
        });

        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`Failed to get file content: ${response.status}`);
        }
    }
};

// Auto-inject Google Scripts and Init
function loadGoogleScripts() {
    let gapiLoaded = false;
    let gisLoaded = false;

    const tryInit = () => {
        if (gapiLoaded && gisLoaded) {
            console.log("Both Google Scripts loaded. Initializing Drive API...");
            DriveAPI.init();
        }
    };

    const script1 = document.createElement('script');
    script1.src = "https://apis.google.com/js/api.js";
    script1.onload = () => {
        console.log("gapi loaded");
        gapiLoaded = true;
        tryInit();
    };
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = "https://accounts.google.com/gsi/client";
    script2.onload = () => {
        console.log("gis loaded");
        gisLoaded = true;
        tryInit();
    };
    document.body.appendChild(script2);
}

loadGoogleScripts();
