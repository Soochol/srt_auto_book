// popup.js

/**
 * 현재 활성 탭의 ID를 가져오는 함수
 * @param {function} callback
 */
function getActiveTabId(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        callback(tabs[0].id);
    });
}

/**
 * 새로고침 시작 요청
 * @param {number} interval
 * @param {number} tabId
 * @param {function} callback
 */
function startRefresh(interval, tabId, callback) {
    chrome.runtime.sendMessage(
        { command: 'startRefresh', interval, tabId },
        callback
    );
}

/**
 * 새로고침 중지 요청
 * @param {number} tabId
 * @param {function} callback
 */
function stopRefresh(tabId, callback) {
    chrome.runtime.sendMessage(
        { command: 'stopRefresh', tabId },
        callback
    );
}

let timerInterval = null;
let remainingTime = 0;

function updateStatus(text) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) statusDiv.textContent = '상태: ' + text;
}

function updateTimer(ms) {
    const timerDiv = document.getElementById('timer');
    if (timerDiv) timerDiv.textContent = ms > 0 ? `다음 새로고침까지: ${ms / 1000}s` : '';
}

function setMonitoringState(state) {
    localStorage.setItem('srt_monitoring_state', state);
}

function getMonitoringState() {
    return localStorage.getItem('srt_monitoring_state') || 'idle';
}

function handleStopMonitoring() {
    updateStatus('중지됨');
    start_btn.disabled = false;
    stop_btn.disabled = true;
    stopTimer();
    setMonitoringState('idle');
}

function queryMonitoringStatus(callback) {
    getActiveTabId(tabId => {
        chrome.runtime.sendMessage({ command: 'queryRefresh', tabId }, response => {
            callback(response && response.status === 'started');
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.command === 'stopMonitorUI') {
        handleStopMonitoring();
        sendResponse({ status: 'ui_stopped' });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const start_btn = document.getElementById('start');
    const stop_btn = document.getElementById('stop');
    const interval_input = document.getElementById('interval');
    const help_btn = document.getElementById('help');

    // 저장된 값 복원
    const savedInterval = localStorage.getItem('srt_refresh_interval');
    if (savedInterval) {
        interval_input.value = savedInterval;
    }

    // 값이 바뀔 때마다 저장
    interval_input.addEventListener('input', () => {
        localStorage.setItem('srt_refresh_interval', interval_input.value);
    });

    // 실제 모니터링 상태 질의 후 UI 복원
    queryMonitoringStatus(isMonitoring => {
        if (isMonitoring) {
            updateStatus('모니터링 중');
            start_btn.disabled = true;
            stop_btn.disabled = false;
            // 타이머 복원은 생략(새로 시작)
        } else {
            updateStatus('대기 중');
            start_btn.disabled = false;
            stop_btn.disabled = true;
            stopTimer();
        }
    });

    function startTimer(interval) {
        clearInterval(timerInterval);
        remainingTime = interval;
        updateTimer(remainingTime);
        timerInterval = setInterval(() => {
            remainingTime -= 1000;
            if (remainingTime <= 0) {
                remainingTime = interval;
            }
            updateTimer(remainingTime);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        updateTimer(0);
    }

    start_btn.addEventListener('click', () => {
        const interval = parseInt(interval_input.value, 10);
        if (isNaN(interval) || interval < 1000) {
            alert('새로고침 간격은 최소 1000ms 이상이어야 합니다.');
            return;
        }
        // 즉시 UI 반영
        start_btn.disabled = true;
        stop_btn.disabled = false;
        getActiveTabId(tabId => {
            // content script에 모니터링 시작 메시지 전송
            chrome.tabs.sendMessage(tabId, {
                command: 'startMonitor'
            }, response => {
                // 필요시 응답 처리
            });
            startRefresh(interval, tabId, response => {
                if (chrome.runtime.lastError) {
                    updateStatus('에러: ' + chrome.runtime.lastError.message);
                    console.error('메시지 전송 실패:', chrome.runtime.lastError.message);
                } else {
                    updateStatus('모니터링 중 - 체크박스 선택된 열차 대기');
                    startTimer(interval);
                    setMonitoringState('monitoring');
                }
            });
        });
    });

    stop_btn.addEventListener('click', () => {
        // 즉시 UI 반영
        start_btn.disabled = false;
        stop_btn.disabled = true;
        getActiveTabId(tabId => {
            stopRefresh(tabId, response => {
                if (chrome.runtime.lastError) {
                    updateStatus('에러: ' + chrome.runtime.lastError.message);
                    console.error('메시지 전송 실패:', chrome.runtime.lastError.message);
                } else {
                    handleStopMonitoring();
                }
            });
        });
    });

    // ESC 키로 모니터링 중지
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            stop_btn.click();
        }
    });

    help_btn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
    });
});
