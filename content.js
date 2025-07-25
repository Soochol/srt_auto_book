// content.js

console.log('🛠 Content script loaded');

const kReserveButtonSelector = 'a.btn_small.btn_burgundy_dark.val_m.wx90';
let isUserTyping = false;
let checkboxesAdded = false;

// 체크박스 상태 저장/복원
function saveCheckboxState(trainId, seatType, checked) {
    const key = `srt_checkbox_${trainId}_${seatType}`;
    localStorage.setItem(key, checked ? '1' : '0');
}

function getCheckboxState(trainId, seatType) {
    const key = `srt_checkbox_${trainId}_${seatType}`;
    return localStorage.getItem(key) === '1';
}

// 체크박스 생성 및 추가
function addCheckboxesToTrainRows() {
    const trainRows = document.querySelectorAll('table tbody tr');
    
    trainRows.forEach((row, index) => {
        // 시간 정보 추출
        const dptTmInput = row.querySelector('input[name^="dptTm"]');
        if (!dptTmInput) return;
        
        const dptTime = dptTmToHHMM(dptTmInput.value);
        if (!dptTime) return;
        
        const trainId = `train_${index}_${dptTime.replace(':', '')}`;
        
        // 좌석 예약 버튼이 있는 칸에만 체크박스 추가
        const seatCells = row.querySelectorAll('td');
        seatCells.forEach((cell, cellIndex) => {
            // 좌석 예약 관련 버튼이 있는 칸만 선택
            const reserveButton = cell.querySelector('a.btn_small');
            if (!reserveButton) return;
            
            // 운행시간, 운행요금, 예약대기 등의 칸은 제외 (예약 버튼 텍스트로 판별)
            const buttonText = reserveButton.querySelector('span')?.innerText.trim();
            if (!buttonText || (!buttonText.includes('매진') && !buttonText.includes('예약') && !buttonText.includes('입석') && !buttonText.includes('좌석'))) {
                return;
            }
            
            // 예약대기 버튼은 제외
            if (buttonText.includes('대기')) {
                return;
            }
            
            // 좌석 타입 확인용 로그
            const hasSpecialComment = cell.innerHTML.includes('<!-- 특실 -->');
            const hasGeneralComment = cell.innerHTML.includes('<!-- 일반실 -->');
            console.log(`🔍 좌석 버튼 발견: ${buttonText} - 특실주석: ${hasSpecialComment}, 일반실주석: ${hasGeneralComment}`);
            
            // 특실/일반실 HTML 주석이 있는 칸만 허용 (예약대기 열 제외)
            if (!hasSpecialComment && !hasGeneralComment) {
                console.log(`❌ 특실/일반실 주석이 없는 셀 제외: ${buttonText}`);
                return;
            }
            
            // 일반실/특실 구분 (더 정확한 판별)
            let seatType = 'general';
            
            // 셀 내용으로 먼저 판별 (HTML 주석 포함)
            const cellHTML = cell.innerHTML;
            if (cellHTML.includes('특실') || cellHTML.includes('<!-- 특실 -->') || cell.innerText.includes('특실')) {
                seatType = 'special';
            } else if (cellHTML.includes('일반실') || cellHTML.includes('<!-- 일반실 -->') || cell.innerText.includes('일반실')) {
                seatType = 'general';
            } else {
                // 해당 행의 모든 예약 버튼이 있는 셀들을 찾기
                const allSeatCells = Array.from(row.querySelectorAll('td')).filter(td => td.querySelector('a.btn_small'));
                const currentIndex = allSeatCells.indexOf(cell);
                
                // 예약 버튼이 1개만 있으면 일반실만 있는 열차
                if (allSeatCells.length === 1) {
                    seatType = 'general';
                } else {
                    // 2개 이상이면 첫 번째는 일반실, 두 번째는 특실
                    seatType = currentIndex === 0 ? 'general' : 'special';
                }
            }
            
            const checkboxId = `${trainId}_${seatType}_${cellIndex}`;
            
            // 이미 이 위치에 체크박스가 있는지 확인
            if (cell.querySelector(`#${checkboxId}`)) {
                console.log(`체크박스 이미 존재: ${checkboxId}`);
                return;
            }
            
            // 체크박스 생성
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'srt-auto-checkbox';
            checkboxContainer.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid #8B4513;
                border-radius: 4px;
                padding: 3px;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.checked = getCheckboxState(trainId, seatType);
            checkbox.style.cssText = 'margin: 0; transform: scale(0.8);';
            
            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.textContent = seatType === 'special' ? '특실' : '일반';
            label.style.cssText = 'font-size: 9px; margin-left: 2px; color: #8B4513; font-weight: bold; cursor: pointer;';
            
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);
            
            // 셀에 상대 위치 설정
            if (cell.style.position !== 'absolute') {
                cell.style.position = 'relative';
            }
            cell.appendChild(checkboxContainer);
            
            // 체크박스 상태 변경 이벤트
            checkbox.addEventListener('change', () => {
                saveCheckboxState(trainId, seatType, checkbox.checked);
                console.log(`✅ 체크박스 상태 변경: ${trainId} ${seatType} ${checkbox.checked ? '선택' : '해제'}`);
            });
            
            const seatCellsCount = Array.from(row.querySelectorAll('td')).filter(td => td.querySelector('a.btn_small')).length;
            console.log(`✅ 체크박스 추가됨: ${checkboxId} - ${seatType} (${dptTime}) - 상태: ${checkbox.checked} - 좌석종류수: ${seatCellsCount}`);
        });
    });
    
    const totalCheckboxes = document.querySelectorAll('.srt-auto-checkbox').length;
    console.log(`🎯 체크박스 추가 완료 - 총 ${totalCheckboxes}개`);
    
    // 현재 체크된 체크박스들 표시
    document.querySelectorAll('.srt-auto-checkbox input[type="checkbox"]:checked').forEach(cb => {
        console.log(`🔘 선택된 체크박스: ${cb.id}`);
    });
}

function dptTmToHHMM(dptTm) {
    // "054700" → "05:47"
    if (!dptTm || dptTm.length < 4) return null;
    return dptTm.slice(0, 2) + ':' + dptTm.slice(2, 4);
}

// 축하 소리 + 알림
function playCelebrationSound() {
    // 부드러운 성공 소리 2번 재생
    try {
        const playSuccessSound = () => {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // 부드러운 사인파, 낮은 주파수
            oscillator.frequency.value = 523.25; // C5 (도)
            oscillator.type = 'sine';
            
            // 부드러운 볼륨 조절
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
        };
        
        // 첫 번째 소리
        playSuccessSound();
        // 1초 후 두 번째 소리
        setTimeout(playSuccessSound, 1000);
        // 2초 후 세 번째 소리
        setTimeout(playSuccessSound, 2000);
        
        console.log('🎵 부드러운 성공 소리 재생!');
    } catch (e) {}
    
    // 조용한 음성 알림 (옵션)
    try {
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance('예약 성공');
            utterance.rate = 0.8;
            utterance.pitch = 1.2;
            utterance.volume = 0.6;
            speechSynthesis.speak(utterance);
        }, 2500);
        console.log('🗣️ 조용한 음성 알림!');
    } catch (e) {}
    
    // 시각적 알림
    const celebration = document.createElement('div');
    celebration.innerHTML = `
        <div style="
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white; padding: 30px 50px; border-radius: 15px;
            font-size: 24px; font-weight: bold; text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 99999; animation: celebration 2s ease-in-out;
        ">
            🔊🎉 예약 성공! 🎉🔊<br>
            <div style="font-size: 16px; margin-top: 10px;">
                소리가 들리시나요?
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes celebration {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(celebration);
    
    setTimeout(() => {
        celebration.remove();
        style.remove();
    }, 3000);
}

/**
 * 체크박스가 선택된 예약 버튼만 클릭
 */
function checkAndClickReserveButton() {
    console.log('🔄 checkAndClickReserveButton() 실행됨');
    
    if (isUserTyping) {
        console.log('사용자 입력 중: 새로고침 일시 중지');
        chrome.runtime.sendMessage({ command: 'stopRefresh' });
        return;
    }
    if (localStorage.getItem('srt_reserve_success') === '1') {
        console.log('이미 예약 성공, 더 이상 시도하지 않음');
        return;
    }
    
    let found = false;
    // 모든 예약 버튼 찾기 (burgundy_dark 클래스가 있는 버튼들)
    const allReserveButtons = document.querySelectorAll('a.btn_small.btn_burgundy_dark');
    console.log(`🔍 전체 예약 가능한 버튼 개수: ${allReserveButtons.length}`);
    
    allReserveButtons.forEach(element => {
        const tr = element.closest('tr');
        if (!tr) return;
        
        const dptTmInput = tr.querySelector('input[name^="dptTm"]');
        if (!dptTmInput) return;
        
        const dptTime = dptTmToHHMM(dptTmInput.value);
        if (!dptTime) return;
        
        const text = element.querySelector('span')?.innerText.trim();
        console.log(`🔍 예약 버튼 텍스트: "${text}"`);
        
        // 예약 가능한 버튼만 처리 (burgundy_dark 클래스와 onclick 속성 확인)
        if (!(text.includes('예약') || text === '입석+좌석')) return;
        if (!element.classList.contains('btn_burgundy_dark')) {
            console.log(`❌ 예약 불가능한 버튼 (매진 상태): ${text}`);
            return;
        }
        if (!element.hasAttribute('onclick')) {
            console.log(`❌ onclick 속성 없음: ${text}`);
            return;
        }
        
        // 해당 셀의 체크박스가 선택되어 있는지 직접 확인
        const cell = element.closest('td');
        const checkbox = cell?.querySelector('.srt-auto-checkbox input[type="checkbox"]');
        
        console.log(`🔍 열차 ${dptTime} 예약버튼 체크:`);
        console.log(`  - 셀 발견: ${!!cell}`);
        console.log(`  - 체크박스 발견: ${!!checkbox}`);
        console.log(`  - 체크박스 ID: ${checkbox?.id}`);
        console.log(`  - 체크박스 선택됨: ${checkbox?.checked}`);
        console.log(`  - 버튼 텍스트: ${text}`);
        console.log(`  - 버튼 클래스: ${element.className}`);
        console.log(`  - onclick 존재: ${element.hasAttribute('onclick')}`);
        
        // 강제로 클릭 테스트 (디버깅용)
        if (checkbox && !checkbox.checked) {
            console.log(`⚠️ 체크박스가 선택되지 않았습니다. 수동으로 체크해주세요!`);
        }
        
        if (checkbox && checkbox.checked) {
            found = true;
            console.log(`🎯 체크박스 선택된 열차 예약 시도: ${dptTime} (ID: ${checkbox.id})`);
            
            // 축하 알림을 버튼 클릭 전에 먼저 표시
            playCelebrationSound();
            
            // Background에서도 소리 재생 (페이지 이동 후에도 지속)
            chrome.runtime.sendMessage({ command: 'playSound' });
            
            console.log(`🖱️ 버튼 클릭 실행!`);
            localStorage.setItem('srt_reserve_success', '1');
            
            chrome.runtime.sendMessage({ command: 'stopRefresh' });
            chrome.runtime.sendMessage({ 
                command: 'notify', 
                title: '🎉 예매 성공!', 
                message: `예매 버튼을 클릭했습니다! (${dptTime})` 
            });
            chrome.runtime.sendMessage({ command: 'stopMonitorUI' });
            
            // 소중한 딜레이 후 클릭 (알림이 보이도록)
            setTimeout(() => {
                element.click();
            }, 1000);
        } else if (checkbox) {
            console.log(`❌ 열차 ${dptTime} - 체크박스가 선택되지 않음`);
            
            // 디버깅: 체크박스 수동 체크 테스트
            console.log(`🧪 테스트: 체크박스를 수동으로 체크해보세요`);
            console.log(`🧪 또는 콘솔에서 다음 명령어를 실행하세요:`);
            console.log(`document.querySelector('#${checkbox.id}').checked = true`);
        } else {
            console.log(`❌ 열차 ${dptTime} - 체크박스를 찾을 수 없음`);
        }
    });
    
    if (!found) {
        console.log('체크박스 선택된 열차 중 예약 가능한 것이 없음');
    }
}

// 폼 입력 감지: 입력 시작 시 새로고침 중지
function setupInputListeners() {
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', () => {
            if (!isUserTyping) {
                isUserTyping = true;
                chrome.runtime.sendMessage({ command: 'stopRefresh' });
                chrome.runtime.sendMessage({ command: 'notify', title: '입력 감지', message: '입력 중에는 새로고침이 중지됩니다.' });
            }
        });
    });
}

function startMonitoring() {
    console.log('🚀 startMonitoring() 실행됨');
    isUserTyping = false; // 입력 감지 상태 초기화
    setupInputListeners();
    
    // 체크박스 추가 (매번 새로 생성해서 상태 변화 대응)
    addCheckboxesToTrainRows();
    
    try {
        console.log('🎯 checkAndClickReserveButton() 호출');
        checkAndClickReserveButton();
    } catch (e) {
        chrome.runtime.sendMessage({ command: 'notify', title: '에러', message: '예매 버튼 감시 중 오류 발생: ' + e.message });
        console.error('❌ startMonitoring 에러:', e);
    }
}

// 메시지로 모니터링 시작 명령을 받으면 실행
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.command === 'startMonitor') {
        resetReserveFlag(); // 플래그 초기화
        startMonitoring();
        sendResponse({ status: 'monitoring_started' });
    }
    if (message && message.command === 'triggerQuery') {
        triggerQueryButton();
        // 조회 후 모니터링 실행 (triggerQueryButton에서 이미 체크박스 추가하므로 여기서는 검사만)
        setTimeout(() => {
            checkAndClickReserveButton();
        }, 2500);
        sendResponse({ status: 'query_triggered' });
        return;
    }
});

// 페이지 로드 시 체크박스 자동 추가
window.addEventListener('load', () => {
    setTimeout(() => {
        addCheckboxesToTrainRows();
    }, 1000); // 페이지 완전 로드 후 1초 뒤 실행
});

// 예약 성공 플래그 초기화 함수 (필요시 수동 호출)
function resetReserveFlag() {
    localStorage.removeItem('srt_reserve_success');
}

// 키보드 단축키 감지 (F4: 시작, ESC: 중지)
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        console.log('⌨️ ESC 키 감지 - 모니터링 중지');
        chrome.runtime.sendMessage({ command: 'stopRefresh' });
        chrome.runtime.sendMessage({ command: 'stopMonitorUI' });
        chrome.runtime.sendMessage({ command: 'notify', title: '⌨️ ESC 키', message: '모니터링이 중지되었습니다.' });
    }
    
    if (event.key === 'F4') {
        event.preventDefault(); // 브라우저 기본 F4 동작 방지
        console.log('⌨️ F4 키 감지 - 모니터링 시작');
        
        // 체크박스가 선택된 항목이 있는지 확인
        const checkedBoxes = document.querySelectorAll('.srt-auto-checkbox input[type="checkbox"]:checked');
        if (checkedBoxes.length === 0) {
            chrome.runtime.sendMessage({ 
                command: 'notify', 
                title: '⚠️ F4 키', 
                message: '먼저 원하는 열차의 체크박스를 선택해주세요!' 
            });
            return;
        }
        
        // 모니터링 시작
        resetReserveFlag();
        startMonitoring();
        
        // 새로고침 시작 (기본 3초 간격)
        chrome.runtime.sendMessage({ 
            command: 'startRefresh', 
            interval: 3000, 
            tabId: null 
        });
        
        chrome.runtime.sendMessage({ 
            command: 'notify', 
            title: '⌨️ F4 키', 
            message: `모니터링이 시작되었습니다! (선택된 체크박스: ${checkedBoxes.length}개)` 
        });
    }
}, true);

// 폼 요소에도 ESC 리스너 추가
window.addEventListener('load', () => {
    document.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                chrome.runtime.sendMessage({ command: 'stopRefresh' });
                chrome.runtime.sendMessage({ command: 'stopMonitorUI' });
            }
        });
    });
});

function triggerQueryButton() {
    const queryBtn = document.querySelector('input.inquery_btn');
    if (queryBtn) {
        queryBtn.click();
        console.log('🔄 조회하기 버튼 클릭!');
        
        // 조회 후 체크박스 다시 추가 (페이지 로드 대기)
        setTimeout(() => {
            console.log('🔄 새로고침 후 체크박스 추가 시도');
            addCheckboxesToTrainRows();
        }, 1500);
    } else {
        console.log('❌ 조회하기 버튼을 찾을 수 없습니다.');
    }
}
