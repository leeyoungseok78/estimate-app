// 폰트 변수는 font.js에서 전역으로 선언됨

// PWA 관련 변수
let deferredPrompt;
let isInstalled = false;

// PDF 공유를 위한 전역 변수
let generatedPdfDoc = null;
let generatedPdfFile = null;
let generatedPdfSiteName = '';

// 페이지 전환 함수
function showPage(pageName) {
    document.querySelectorAll('.container').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(pageName + 'Page').classList.add('active');
    
    const activeBtn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    if (pageName === 'estimate') {
        loadCompanyInfo();
    } else if (pageName === 'customers') {
        loadCustomers();
    } else if (pageName === 'settings') {
        loadSettingsCompanyInfo();
    }
}

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('data:text/javascript;base64,Y29uc3QgQ0FDSEVfTkFNRSA9ICdkZW1vbGl0aW9uLWVzdGltYXRlLXYxJzsKY29uc3QgdXJsc1RvQ2FjaGUgPSBbJy4vJ107CnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignaW5zdGFsbCcsIGV2ZW50ID0+IHsKICBldmVudC53YWl0VW50aWwoY2FjaGVzLm9wZW4oQ0FDSEVfTkFNRSkudGhlbihjYWNoZSA9PiBjYWNoZS5hZGRBbGwodXJsc1RvQ2FjaGUpKSk7Cn0pOwpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2ZldGNoJywgZXZlbnQgPT4gewogIGV2ZW50LnJlc3BvbmRXaXRoKGNhY2hlcy5tYXRjaChldmVudC5yZXF1ZXN0KS50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlIHx8IGZldGNoKGV2ZW50LnJlcXVlc3QpKSk7Cn0pOw==')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}

// PWA 설치 관련
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

window.addEventListener('appinstalled', () => {
    isInstalled = true;
    hideInstallBanner();
});

function showInstallBanner() {
    if (!isInstalled && !window.matchMedia('(display-mode: standalone)').matches) {
        document.getElementById('installBanner').classList.add('show');
    }
}

function hideInstallBanner() {
    document.getElementById('installBanner').classList.remove('show');
}

function installApp() {
    hideInstallBanner();
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    }
}

function dismissInstall() {
    hideInstallBanner();
}

// 초기화
// type="module" 스크립트는 DOM 파싱이 완료된 후에 실행되므로,
// DOMContentLoaded 이벤트 리스너로 감쌀 필요가 없습니다.
document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
loadCompanyInfo();

// 페이지 로드 시 기존 항목에 대한 금액 계산 이벤트 리스너 추가
document.querySelectorAll('#workItems .work-quantity, #workItems .work-price').forEach(input => {
    input.addEventListener('input', updateTotalAmount);
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        showPage(page);
    });
});

// 앱 초기 로드 시, 저장된 사용자 폰트가 있는지 확인
document.addEventListener('DOMContentLoaded', loadSavedFontData);

setTimeout(() => {
    if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
        showInstallBanner();
    }
}, 3000);

// 알림 권한 요청 및 마감일 체크
requestNotificationPermission();
setInterval(checkDeadlines, 3600000); // 1시간마다 마감일 체크
checkDeadlines(); // 앱 로드 시 즉시 체크

// 알림 권한 요청
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('알림이 활성화되었습니다!', {
                    body: '견적 마감일을 놓치지 않도록 알려드릴게요.',
                    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHptLTIuMDgtMTMuMDRMMTAgOC4wNGwyLjA4IDIuMDggMi4wOC0yLjA4TDE1LjIgOC4wNGwtMi4wOCAyLjA4IDIuMDggMi4wOEwxNC4xMiAxMy4ybC0yLjA4LTIuMDhMMTAgMTMuMmwtMS4wNC0xLjA0IDIuMDgtMi4wOHoiLz48L3N2Zz4='
                });
            }
        });
    }
}

// 마감일 체크 및 알림
function checkDeadlines() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return; // 알림이 지원되지 않거나 권한이 없는 경우 중단
    }

    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    const sentNotifications = new Set(JSON.parse(localStorage.getItem('sentNotifications')) || []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    customers.forEach(customer => {
        if (customer.deadlineDate && !sentNotifications.has(customer.id)) {
            const deadline = new Date(customer.deadlineDate);
            deadline.setHours(0, 0, 0, 0);

            const diffDays = (deadline - today) / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) { // 마감일이 오늘 또는 내일인 경우
                new Notification(`'${customer.siteName}' 견적 마감 임박`, {
                    body: `마감일: ${customer.deadlineDate}. 서둘러 제출해주세요!`,
                    tag: `deadline-${customer.id}` // 같은 알림 중복 방지
                });
                
                const alarm = document.getElementById('alarmSound');
                if (alarm) alarm.play().catch(e => console.log("알람 소리 재생 실패:", e));
                
                sentNotifications.add(customer.id);
            }
        }
    });

    localStorage.setItem('sentNotifications', JSON.stringify([...sentNotifications]));
}

// 총 견적 금액 실시간 업데이트
function updateTotalAmount() {
    let total = 0;
    document.querySelectorAll('#workItems .work-item').forEach(item => {
        const quantity = parseFloat(item.querySelector('.work-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.work-price').value) || 0;
        total += quantity * price;
    });

    document.getElementById('totalAmount').textContent = `${total.toLocaleString()}원`;
}

// 회사 정보 관리
function saveCompanyInfo() {
    const companyInfo = {
        name: document.getElementById('settingsCompanyName').value,
        manager: document.getElementById('settingsManager').value,
        phone: document.getElementById('settingsPhone').value,
        address: document.getElementById('settingsAddress').value
    };
    
    const companyData = JSON.stringify(companyInfo);
    try {
        localStorage.setItem('companyInfo', companyData);
    } catch (e) {
        window.companyInfo = companyData; // fallback
    }

    const messageDiv = document.getElementById('companySavedMessage');
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 2000);
}

function loadCompanyInfo() {
    let companyInfo;
    try {
        companyInfo = JSON.parse(localStorage.getItem('companyInfo'));
    } catch (e) {
        companyInfo = window.companyInfo;
    }
    
    if (companyInfo) {
        document.getElementById('companyName').value = companyInfo.name || '';
        document.getElementById('manager').value = companyInfo.manager || '';
        document.getElementById('phone').value = companyInfo.phone || '';
        formatPhoneNumber(document.getElementById('phone'));
    }
}

function loadSettingsCompanyInfo() {
    let companyInfo;
    try {
        companyInfo = JSON.parse(localStorage.getItem('companyInfo'));
    } catch (e) {
        companyInfo = window.companyInfo;
    }
    
    if (companyInfo) {
        document.getElementById('settingsCompanyName').value = companyInfo.name || '';
        document.getElementById('settingsManager').value = companyInfo.manager || '';
        document.getElementById('settingsPhone').value = companyInfo.phone || '';
        formatPhoneNumber(document.getElementById('settingsPhone'));
        document.getElementById('settingsAddress').value = companyInfo.address || '';
    }
}

function removeWorkItem(element) {
    element.parentElement.remove();
    updateTotalAmount();
}

function addWorkItem(itemData = null) {
    const workItemsContainer = document.getElementById('workItems');
    const newItem = document.createElement('div');
    newItem.className = 'work-item';
    
    const name = itemData ? itemData.name : '';
    const quantity = itemData ? itemData.quantity : '';
    const unit = itemData ? itemData.unit : '';
    const price = itemData ? itemData.price : '';

    newItem.innerHTML = `
        <input type="text" placeholder="공사 항목" class="work-name" value="${name}">
        <input type="number" placeholder="수량" class="work-quantity" value="${quantity}">
        <input type="text" placeholder="단위" class="work-unit" value="${unit}">
        <input type="number" placeholder="단가" class="work-price" value="${price}">
        <button onclick="removeWorkItem(this)">삭제</button>
    `;
    workItemsContainer.appendChild(newItem);

    // 실시간 총 금액 계산을 위해 새 항목의 입력 필드에 이벤트 리스너 추가
    newItem.querySelectorAll('.work-quantity, .work-price').forEach(input => {
        input.addEventListener('input', updateTotalAmount);
    });
}

// 폰트 관련 함수
function handleFontUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.ttf')) {
        alert('TTF 폰트 파일만 지원합니다.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const fontData = e.target.result.split(',')[1]; // base64 부분만 추출
        
        try {
            // localStorage에 폰트 데이터 저장
            localStorage.setItem('customFont', fontData);
            
            // 상태 업데이트
            updateFontStatus(true, `"${file.name}" 폰트가 성공적으로 업로드되었습니다.`);
            
            alert('폰트가 성공적으로 설정되었습니다. 이제 PDF 생성 시 한글이 정상적으로 표시됩니다.');
        } catch (error) {
            console.error('폰트 저장 중 오류:', error);
            
            // localStorage 용량 제한 문제 처리
            if (error.name === 'QuotaExceededError') {
                alert('폰트 파일이 너무 큽니다. 더 작은 폰트 파일을 사용하거나 브라우저 캐시를 정리한 후 다시 시도해주세요.');
            } else {
                alert('폰트 설정 중 오류가 발생했습니다.');
            }
            
            updateFontStatus(false, '폰트 저장 중 오류가 발생했습니다.');
        }
    };
    
    reader.onerror = function() {
        updateFontStatus(false, '폰트 파일을 읽는 중 오류가 발생했습니다.');
    };
    
    reader.readAsDataURL(file);
}

function updateFontStatus(success, message) {
    const statusElement = document.getElementById('fontStatus');
    if (!statusElement) return;
    
    statusElement.innerHTML = success 
        ? `<div class="success-message">✅ ${message}</div>`
        : `<div class="error-message">❌ ${message}</div>`;
}

function showFontGuide() {
    const modal = document.getElementById('fontGuideModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeFontGuideModal() {
    const modal = document.getElementById('fontGuideModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 페이지 로드 시 저장된 폰트 데이터 확인
function loadSavedFontData() {
    const savedFont = localStorage.getItem('customFont');
    if (savedFont) {
        updateFontStatus(true, '저장된 폰트가 로드되었습니다.');
    } else {
        updateFontStatus(false, '폰트가 설정되지 않았습니다. PDF에서 한글이 깨질 수 있습니다.');
    }
}

// PDF 생성 함수
async function generatePDF() {
    // 1. 폰트 설정 확인
    const fontData = localStorage.getItem('customFont');
    if (!fontData) {
        if (confirm("PDF를 생성하려면 한글 폰트 설정이 필요합니다.\n'설정' 페이지로 이동하여 폰트를 업로드하시겠습니까?")) {
            showPage('settings');
        }
        return;
    }

    // 2. 견적서 데이터 가져오기
    const estimateData = saveEstimate(false);
    if (!estimateData) {
        // 필수 정보가 누락되어 저장이 중단된 경우
        return;
    }

    // 3. 로딩 화면 표시
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('show');

    // 비동기 처리를 위해 setTimeout 사용
    setTimeout(async () => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                putOnlyUsedFonts: true,
                compress: true
            });
            
            // 폰트 추가
            doc.addFileToVFS('NanumGothic.ttf', fontData);
            doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
            doc.setFont('NanumGothic');
            const defaultTableStyles = { font: 'NanumGothic', fontStyle: 'normal' };

            // PDF 내용 생성...
            doc.setFontSize(22);
            doc.text("견 적 서", 105, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.text(`견적일: ${estimateData.estimateDate}`, 195, 30, { align: 'right' });

            const company = JSON.parse(localStorage.getItem('companyInfo')) || {};

            doc.autoTable({
                startY: 35,
                head: [['공급자 (회사 정보)']],
                body: [
                    [`회사명: ${company.name || ''}`],
                    [`담당자: ${company.manager || ''}`],
                    [`연락처: ${company.phone || ''}`],
                    [`주소: ${company.address || ''}`]
                ],
                theme: 'grid',
                styles: defaultTableStyles,
                headStyles: { font: 'NanumGothic' }
            });

            doc.autoTable({
                head: [['공급받는 자 (고객 정보)']],
                body: [
                    [`현장명: ${estimateData.siteName}`],
                    [`고객명: ${estimateData.customerName}`],
                    [`연락처: ${estimateData.customerPhone}`],
                    [`공사 주소: ${estimateData.workAddress}`],
                    [`제출 마감일: ${estimateData.deadlineDate || '없음'}`]
                ],
                theme: 'grid',
                styles: defaultTableStyles,
                headStyles: { font: 'NanumGothic' }
            });

            const workItemsBody = estimateData.workItems.map((item, index) => [
                index + 1, item.name, item.quantity, item.unit,
                item.price ? Number(item.price).toLocaleString() : '0',
                (item.quantity && item.price) ? (Number(item.quantity) * Number(item.price)).toLocaleString() : '0'
            ]);
            
            doc.autoTable({
                head: [['No.', '공사 항목', '수량', '단위', '단가', '금액']],
                body: workItemsBody,
                headStyles: { halign: 'center', font: 'NanumGothic' },
                bodyStyles: defaultTableStyles,
                columnStyles: {
                    0: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'center' },
                    4: { halign: 'right' }, 5: { halign: 'right' }
                }
            });
            
            const finalY = doc.autoTable.previous.finalY;
            doc.setFontSize(12);
            doc.text(`총 견적 금액: ${estimateData.totalAmount}`, 195, finalY + 10, { align: 'right' });
            doc.setFontSize(10);
            doc.text("특이사항", 14, finalY + 20);
            doc.autoTable({
                startY: finalY + 22,
                body: [[estimateData.notes || '없음']],
                theme: 'plain',
                styles: defaultTableStyles
            });

            // 생성된 PDF 데이터 전역 변수에 저장
            generatedPdfDoc = doc;
            const pdfBlob = doc.output('blob');
            generatedPdfFile = new File([pdfBlob], `견적서_${estimateData.siteName}.pdf`, { type: 'application/pdf' });
            generatedPdfSiteName = estimateData.siteName;
            
            if (loadingOverlay) loadingOverlay.classList.remove('show');

            // PDF 작업 선택 모달 표시
            const modal = document.getElementById('pdfActionModal');
            if (modal) {
                modal.style.display = 'block';
            }
            
        } catch (e) {
            if (loadingOverlay) loadingOverlay.classList.remove('show');
            console.error('PDF 생성 실패:', e);
            alert('PDF 생성 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.');
        }
    }, 10);
}

function saveEstimateAndClear() {
    const savedData = saveEstimate(true);
    if (savedData) {
        alert('견적이 저장/수정되었습니다.');
        clearEstimateForm();
    }
}

function saveEstimate(showAlert = false) {
    const editingId = document.getElementById('editingEstimateId').value;
    const estimateData = {
        id: editingId ? parseInt(editingId) : Date.now(),
        siteName: document.getElementById('siteName').value,
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        workAddress: document.getElementById('workAddress').value,
        estimateDate: document.getElementById('estimateDate').value,
        deadlineDate: document.getElementById('deadlineDate').value,
        notes: document.getElementById('notes').value,
        workItems: [],
        totalAmount: document.getElementById('totalAmount').textContent
    };

    if (!estimateData.siteName || !estimateData.customerName || !estimateData.estimateDate) {
        alert('현장명, 고객명, 견적일자는 필수 항목입니다.');
        return null;
    }

    document.querySelectorAll('#workItems .work-item').forEach(item => {
        const name = item.querySelector('.work-name').value;
        const quantity = item.querySelector('.work-quantity').value;
        const unit = item.querySelector('.work-unit').value;
        const price = item.querySelector('.work-price').value;
        if (name) {
            estimateData.workItems.push({ name, quantity, unit, price });
        }
    });

    updateTotalAmount(); // 저장 시점에도 총액을 한번 더 업데이트

    try {
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        
        if (editingId) {
            const index = customers.findIndex(c => c.id === parseInt(editingId));
            if (index > -1) {
                customers[index] = estimateData;
                if (showAlert) alert('견적이 수정되었습니다.');
            } else { 
                customers.push(estimateData);
                if (showAlert) alert('견적이 저장되었습니다.');
            }
        } else {
            customers.push(estimateData);
            if (showAlert) alert('견적이 저장되었습니다.');
        }
        
        localStorage.setItem('customers', JSON.stringify(customers));
        return estimateData;
    } catch (error) {
        console.error("견적 저장 중 오류:", error);
        alert("견적 저장 중 오류가 발생했습니다.");
        return null;
    }
}

function loadCustomers() {
    try {
        const customers = JSON.parse(localStorage.getItem('customers')) || [];
        renderCustomerList(customers);
    } catch(e) {
        console.error('고객 목록 로딩 중 오류:', e);
        document.getElementById('customerList').innerHTML = `<div class="empty-state"><h3>고객 목록을 불러오는 중 오류가 발생했습니다.</h3></div>`;
    }
}

function searchCustomers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const allCustomers = JSON.parse(localStorage.getItem('customers')) || [];

    if (searchTerm.trim() === '') {
        renderCustomerList(allCustomers);
        return;
    }

    const filteredCustomers = allCustomers.filter(customer => {
        const siteName = customer.siteName ? customer.siteName.toLowerCase() : '';
        const customerName = customer.customerName ? customer.customerName.toLowerCase() : '';
        const workAddress = customer.workAddress ? customer.workAddress.toLowerCase() : '';
        
        return siteName.includes(searchTerm) ||
               customerName.includes(searchTerm) ||
               workAddress.includes(searchTerm);
    });
    
    renderCustomerList(filteredCustomers, true);
}

function renderCustomerList(customers, isSearchResult = false) {
    const customerList = document.getElementById('customerList');
    
    if (customers.length === 0) {
        if (isSearchResult) {
             customerList.innerHTML = `<div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                <h3>검색 결과가 없습니다</h3>
                <p>다른 검색어로 시도해보세요.</p>
            </div>`;
        } else {
            customerList.innerHTML = `<div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                <h3>저장된 고객이 없습니다</h3>
                <p>견적서를 작성하면 고객 정보가 자동으로 저장됩니다</p>
            </div>`;
        }
        return;
    }

    customers.sort((a, b) => {
        if (!a.deadlineDate) return 1;
        if (!b.deadlineDate) return -1;
        return new Date(a.deadlineDate) - new Date(b.deadlineDate);
    });

    customerList.innerHTML = ''; 

    customers.forEach(customer => {
        const item = document.createElement('div');
        item.className = 'customer-item';

        let deadlineHTML = '';
        if (customer.deadlineDate) {
            const deadline = new Date(customer.deadlineDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffTime = deadline.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let deadlineClass = 'normal';
            let deadlineText = `마감: ${diffDays}일 남음`;

            if (diffDays < 0) {
                deadlineClass = 'overdue';
                deadlineText = `마감일 지남`;
            } else if (diffDays === 0) {
                deadlineClass = 'today';
                deadlineText = 'D-DAY';
            } else if (diffDays <= 3) {
                deadlineClass = 'urgent';
                deadlineText = `마감임박: ${diffDays}일!`;
            }
            
            deadlineHTML = `<div class="customer-deadline ${deadlineClass}">${deadlineText}</div>`;
        }
        
        const phoneLink = customer.customerPhone 
            ? `<a href="tel:${customer.customerPhone.replace(/\D/g, '')}" onclick="event.stopPropagation()">${customer.customerPhone}</a>`
            : '입력 없음';

        item.innerHTML = `
            <div class="customer-name">${customer.siteName}</div>
            <div class="customer-info"><b>고객:</b> ${customer.customerName} (${phoneLink})</div>
            <div class="customer-info"><b>주소:</b> ${customer.workAddress || '입력 없음'}</div>
            <div class="customer-date">견적일: ${customer.estimateDate}</div>
            ${deadlineHTML}
            <div class="customer-item-buttons">
                <button class="btn-edit" onclick="viewEstimateDetails(event, '${customer.id}')">수정</button>
                <button class="btn-delete" onclick="deleteCustomer(event, '${customer.id}')">삭제</button>
            </div>
        `;
        // Add event listeners for the new buttons
        const editButton = item.querySelector('.btn-edit');
        editButton.addEventListener('click', (event) => {
            const customerId = editButton.onclick.toString().match(/'(.*?)'/)[1];
            viewEstimateDetails(event, customerId);
        });

        const deleteButton = item.querySelector('.btn-delete');
        deleteButton.addEventListener('click', (event) => {
            const customerId = deleteButton.onclick.toString().match(/'(.*?)'/)[1];
            deleteCustomer(event, customerId);
        });

        customerList.appendChild(item);
    });
}

function deleteCustomer(event, customerId) {
    if (event) event.stopPropagation();
    if (!confirm('정말 이 고객 정보를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }

    try {
        const customerIdNum = parseInt(customerId, 10);
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        customers = customers.filter(c => c.id !== customerIdNum);
        localStorage.setItem('customers', JSON.stringify(customers));
        
        // 알림 목록에서도 해당 고객사 정보 제거
        let sentNotifications = new Set(JSON.parse(localStorage.getItem('sentNotifications')) || []);
        if (sentNotifications.has(customerIdNum)) {
            sentNotifications.delete(customerIdNum);
            localStorage.setItem('sentNotifications', JSON.stringify([...sentNotifications]));
        }

        loadCustomers(); // 목록 새로고침
    } catch (e) {
        console.error('고객 정보 삭제 중 오류:', e);
        alert('고객 정보를 삭제하는 중 오류가 발생했습니다.');
    }
}

function viewEstimateDetails(event, customerId) {
    if (event) event.stopPropagation();

    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    const estimate = customers.find(c => c.id === parseInt(customerId, 10));

    if (!estimate) {
        alert('견적 정보를 찾을 수 없습니다.');
        return;
    }

    showPage('estimate');

    document.getElementById('editingEstimateId').value = estimate.id;
    document.getElementById('siteName').value = estimate.siteName || '';
    document.getElementById('customerName').value = estimate.customerName || '';
    document.getElementById('customerPhone').value = estimate.customerPhone || '';
    formatPhoneNumber(document.getElementById('customerPhone'));
    document.getElementById('workAddress').value = estimate.workAddress || '';
    document.getElementById('estimateDate').value = estimate.estimateDate || '';
    document.getElementById('deadlineDate').value = estimate.deadlineDate || '';
    document.getElementById('notes').value = estimate.notes || '';
    document.getElementById('totalAmount').textContent = estimate.totalAmount || '0원';

    const workItemsContainer = document.getElementById('workItems');
    workItemsContainer.innerHTML = '';
    if (estimate.workItems && estimate.workItems.length > 0) {
        estimate.workItems.forEach(item => addWorkItem(item));
    } else {
        addWorkItem();
    }
}

function clearEstimateForm() {
    document.getElementById('editingEstimateId').value = '';
    document.getElementById('siteName').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('workAddress').value = '';
    document.getElementById('deadlineDate').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('totalAmount').textContent = '0원';
    
    const workItemsContainer = document.getElementById('workItems');
    workItemsContainer.innerHTML = '';
    addWorkItem();
    updateTotalAmount(); // 폼 클리어 후 총액 업데이트

    document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
    loadCompanyInfo();
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    let formattedValue = value.replace(/(^02.{0}|^01.{1}|[0-9]{3,4})([0-9]{3,4})([0-9]{4})/, "$1-$2-$3");
    input.value = formattedValue;
}

function exportData() {
    try {
        const companyInfo = localStorage.getItem('companyInfo');
        const customers = localStorage.getItem('customers');

        const dataToExport = {
            companyInfo: companyInfo ? JSON.parse(companyInfo) : {},
            customers: customers ? JSON.parse(customers) : []
        };

        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `견적서_데이터_백업_${date}.json`;
        document.body.appendChild(a);
        a.click();
        
        URL.revokeObjectURL(url);
        a.remove();
        
        alert('데이터 내보내기가 완료되었습니다.');

    } catch (error) {
        console.error('데이터 내보내기 중 오류 발생:', error);
        alert('데이터를 내보내는 중 오류가 발생했습니다.');
    }
}

function importData() {
    document.getElementById('importFile').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.companyInfo && typeof importedData.customers !== 'undefined') {
                 if (!confirm("데이터를 불러오면 현재 모든 데이터가 교체됩니다. 계속하시겠습니까?")) {
                    event.target.value = '';
                    return;
                }

                localStorage.setItem('companyInfo', JSON.stringify(importedData.companyInfo || {}));
                localStorage.setItem('customers', JSON.stringify(importedData.customers || []));
                
                alert('데이터를 성공적으로 불러왔습니다. 앱을 새로고침합니다.');
                location.reload();
            } else {
                alert('잘못된 형식의 파일입니다. 백업 파일을 확인해주세요.');
            }
        } catch (error) {
            console.error('파일 불러오기 중 오류 발생:', error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function closePdfActionModal() {
    const modal = document.getElementById('pdfActionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function downloadPDF() {
    if (generatedPdfDoc && generatedPdfSiteName) {
        generatedPdfDoc.save(`견적서_${generatedPdfSiteName}.pdf`);
        closePdfActionModal();
    } else {
        alert('다운로드할 PDF 정보가 없습니다.');
    }
}

async function sharePDF() {
    if (navigator.share && generatedPdfFile) {
        const company = JSON.parse(localStorage.getItem('companyInfo')) || {};
        try {
            await navigator.share({
                files: [generatedPdfFile],
                title: `[견적서] ${generatedPdfSiteName}`,
                text: `${company.name || ''}에서 보내드리는 견적서입니다.`
            });
            closePdfActionModal();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('공유 실패:', err);
                alert('파일 공유에 실패했습니다.');
            }
        }
    } else {
        alert('이 브라우저에서는 파일 공유를 지원하지 않거나 공유할 파일이 없습니다.');
    }
}

function clearAllData() {
    if (confirm("정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
        localStorage.removeItem('companyInfo');
        localStorage.removeItem('customers');
        alert("모든 데이터가 삭제되었습니다.");
        location.reload();
    }
}

// === 전역 스코프에 함수 할당 ===
// type="module"로 인해 함수들이 모듈 스코프에만 존재하게 되므로,
// HTML의 onclick에서 호출할 수 있도록 전역 window 객체에 할당합니다.
window.showPage = showPage;
window.installApp = installApp;
window.dismissInstall = dismissInstall;
window.formatPhoneNumber = formatPhoneNumber;
window.addWorkItem = addWorkItem;
window.removeWorkItem = removeWorkItem;
window.generatePDF = generatePDF;
window.clearEstimateForm = clearEstimateForm;
window.saveEstimateAndClear = saveEstimateAndClear;
window.saveCompanyInfo = saveCompanyInfo;
window.exportData = exportData;
window.importData = importData;
window.handleFileImport = handleFileImport;
window.searchCustomers = searchCustomers;
window.viewEstimateDetails = viewEstimateDetails;
window.deleteCustomer = deleteCustomer;
window.closePdfActionModal = closePdfActionModal;
window.downloadPDF = downloadPDF;
window.sharePDF = sharePDF;

// 페이지 로드 시 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
    // 기존 초기화 코드...
    
    // 저장된 폰트 데이터 로드
    loadSavedFontData();
    
    // 모달 닫기 이벤트
    window.onclick = function(event) {
        const modals = document.getElementsByClassName('modal');
        for (let i = 0; i < modals.length; i++) {
            if (event.target === modals[i]) {
                modals[i].style.display = 'none';
            }
        }
    };
}); 