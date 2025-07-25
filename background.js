// background.js

// tabId → intervalId 매핑
const refreshers_map = {};

/**
 * 브라우저 알림 생성
 */
function showNotification(title, message) {
    chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message
    }, () => {});
}

/**
 * 축하 소리 재생 (background에서 실행)
 */
function playCelebrationSoundInBackground() {
    try {
        // Service Worker에서는 오디오 컨텍스트 제한이 있어서 
        // 새 탭을 열어서 소리 재생
        chrome.tabs.create({
            url: 'data:text/html,<html><body><script>const playSuccessSound = () => { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audioCtx.createOscillator(); const gainNode = audioCtx.createGain(); oscillator.connect(gainNode); gainNode.connect(audioCtx.destination); oscillator.frequency.value = 523.25; oscillator.type = "sine"; gainNode.gain.setValueAtTime(0, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.5); }; playSuccessSound(); setTimeout(playSuccessSound, 1000); setTimeout(playSuccessSound, 2000); setTimeout(() => { const utterance = new SpeechSynthesisUtterance("예약 성공"); utterance.rate = 0.8; utterance.pitch = 1.2; utterance.volume = 0.6; speechSynthesis.speak(utterance); }, 2500); setTimeout(() => window.close(), 4000;</script></body></html>',
            active: false
        });
        console.log('🎵 Background에서 축하 소리 재생!');
    } catch (e) {
        console.log('축하 소리 재생 실패:', e);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        const tab_id = message.tabId ?? sender.tab?.id;
        if (message.command === 'startRefresh') {
            if (refreshers_map[tab_id]) {
                clearInterval(refreshers_map[tab_id]);
            }
            refreshers_map[tab_id] = setInterval(() => {
                chrome.tabs.sendMessage(tab_id, { command: 'triggerQuery' });
            }, message.interval);
            sendResponse({ status: 'started' });
            return true;
        } else if (message.command === 'stopRefresh') {
            if (refreshers_map[tab_id]) {
                clearInterval(refreshers_map[tab_id]);
                delete refreshers_map[tab_id];
            }
            sendResponse({ status: 'stopped' });
            return true;
        } else if (message.command === 'notify') {
            showNotification(message.title || '알림', message.message || '');
            sendResponse({ status: 'notified' });
            return true;
        } else if (message.command === 'playSound') {
            playCelebrationSoundInBackground();
            sendResponse({ status: 'sound_played' });
            return true;
        } else if (message.command === 'queryRefresh') {
            if (refreshers_map[tab_id]) {
                sendResponse({ status: 'started' });
            } else {
                sendResponse({ status: 'stopped' });
            }
            return true;
        }
    } catch (e) {
        showNotification('에러', 'background.js 오류: ' + e.message);
        console.error(e);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && refreshers_map[tabId]) {
        chrome.tabs.sendMessage(tabId, { command: 'startMonitor' });
    }
});
