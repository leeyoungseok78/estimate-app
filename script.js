// PWA 관련 변수
let deferredPrompt;
let isInstalled = false;

// PDF 공유를 위한 전역 변수
let generatedPdfDoc = null;
let generatedPdfFile = null;
let generatedPdfSiteName = '';

// 폰트 데이터 캐싱을 위한 변수
let nanumGothicFont = null;

// IndexedDB 관련 변수 및 초기화
let db;
const DB_NAME = 'estimateAppDB';
const DB_VERSION = 1;
const STORES = {
    COMPANY: 'companyInfo',
    CUSTOMERS: 'customers',
    SETTINGS: 'settings'
};

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

// 초기화
document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
loadCompanyInfo();

// 페이지 로드 시 기존 항목에 대한 금액 계산 이벤트 리스너 추가
document.querySelectorAll('#workItems .work-quantity, #workItems .work-price').forEach(input => {
    input.addEventListener('input', updateTotalAmount);
    
    // 기존 input 태그 타입을 number에서 text로 변경하고 포맷팅 이벤트 추가
    if (input.type === 'number') {
        input.type = 'text';
        input.addEventListener('input', function() {
            formatNumber(this);
        });
    }
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        showPage(page);
    });
});

setTimeout(() => {
    if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
        showInstallBanner();
    }
}, 3000);

// 알림 권한 요청 및 마감일 체크
requestNotificationPermission();
setInterval(checkDeadlines, 3600000); // 1시간마다 마감일 체크
checkDeadlines(); // 앱 로드 시 즉시 체크

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

function checkDeadlines() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
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

            if (diffDays <= 1) {
                new Notification(`'${customer.siteName}' 견적 마감 임박`, {
                    body: `마감일: ${customer.deadlineDate}. 서둘러 제출해주세요!`,
                    tag: `deadline-${customer.id}`
                });
                
                const alarm = document.getElementById('alarmSound');
                if (alarm) alarm.play().catch(e => console.log("알람 소리 재생 실패:", e));
                
                sentNotifications.add(customer.id);
            }
        }
    });

    localStorage.setItem('sentNotifications', JSON.stringify([...sentNotifications]));
}

function updateTotalAmount() {
    let total = 0;
    document.querySelectorAll('#workItems .work-item').forEach(item => {
        // 쉼표 제거 후 숫자로 변환
        const quantityValue = item.querySelector('.work-quantity').value.replace(/,/g, '');
        const priceValue = item.querySelector('.work-price').value.replace(/,/g, '');
        
        const quantity = parseFloat(quantityValue) || 0;
        const price = parseFloat(priceValue) || 0;
        total += quantity * price;
    });

    document.getElementById('totalAmount').textContent = `${total.toLocaleString()}원`;
}

// IndexedDB 초기화
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('IndexedDB 오류:', event.target.error);
            // 에러 발생 시 localStorage로 폴백
            alert('데이터베이스 연결에 실패했습니다. 로컬 스토리지를 사용합니다.');
            resolve(false);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB 연결 성공');
            resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 회사 정보 저장소
            if (!db.objectStoreNames.contains(STORES.COMPANY)) {
                db.createObjectStore(STORES.COMPANY, { keyPath: 'id', autoIncrement: true });
            }
            
            // 고객 정보 저장소
            if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
                db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
            }
            
            // 설정 저장소
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
        };
    });
}

// 데이터 저장 함수 (IndexedDB 또는 localStorage)
function saveData(storeName, data, key = null) {
    return new Promise((resolve, reject) => {
        if (db) {
            // IndexedDB 사용
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                let request;
                if (key) {
                    request = store.put({ key, value: data });
                } else {
                    request = store.put(data);
                }
                
                request.onsuccess = () => resolve(true);
                request.onerror = (e) => {
                    console.error('IndexedDB 저장 오류:', e.target.error);
                    // 에러 발생 시 localStorage로 폴백
                    localStorage.setItem(storeName, JSON.stringify(data));
                    resolve(false);
                };
            } catch (e) {
                console.error('IndexedDB 트랜잭션 오류:', e);
                // 에러 발생 시 localStorage로 폴백
                localStorage.setItem(storeName, JSON.stringify(data));
                resolve(false);
            }
        } else {
            // localStorage 폴백
            localStorage.setItem(storeName, JSON.stringify(data));
            resolve(true);
        }
    });
}

// 데이터 불러오기 함수 (IndexedDB 또는 localStorage)
function loadData(storeName, key = null) {
    return new Promise((resolve, reject) => {
        if (db) {
            // IndexedDB 사용
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                
                let request;
                if (key) {
                    request = store.get(key);
                } else {
                    // 모든 데이터 가져오기
                    request = store.getAll();
                }
                
                request.onsuccess = (event) => {
                    if (key) {
                        resolve(event.target.result ? event.target.result.value : null);
                    } else {
                        resolve(event.target.result || []);
                    }
                };
                
                request.onerror = (e) => {
                    console.error('IndexedDB 로드 오류:', e.target.error);
                    // 에러 발생 시 localStorage로 폴백
                    const data = localStorage.getItem(storeName);
                    resolve(data ? JSON.parse(data) : (key ? null : []));
                };
            } catch (e) {
                console.error('IndexedDB 트랜잭션 오류:', e);
                // 에러 발생 시 localStorage로 폴백
                const data = localStorage.getItem(storeName);
                resolve(data ? JSON.parse(data) : (key ? null : []));
            }
        } else {
            // localStorage 폴백
            const data = localStorage.getItem(storeName);
            resolve(data ? JSON.parse(data) : (key ? null : []));
        }
    });
}

// 기존 함수 수정
async function saveCompanyInfo() {
    const companyInfo = {
        name: document.getElementById('settingsCompanyName').value,
        manager: document.getElementById('settingsManager').value,
        phone: document.getElementById('settingsPhone').value,
        address: document.getElementById('settingsAddress').value
    };
    
    await saveData(STORES.COMPANY, companyInfo, 'companyInfo');
    
    const messageDiv = document.getElementById('companySavedMessage');
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 2000);
}

async function loadCompanyInfo() {
    const companyInfo = await loadData(STORES.COMPANY, 'companyInfo') || {};
    document.getElementById('companyName').value = companyInfo.name || '';
    document.getElementById('manager').value = companyInfo.manager || '';
    document.getElementById('phone').value = companyInfo.phone || '';
    formatPhoneNumber(document.getElementById('phone'));
}

async function loadSettingsCompanyInfo() {
    const companyInfo = await loadData(STORES.COMPANY, 'companyInfo') || {};
    document.getElementById('settingsCompanyName').value = companyInfo.name || '';
    document.getElementById('settingsManager').value = companyInfo.manager || '';
    document.getElementById('settingsPhone').value = companyInfo.phone || '';
    formatPhoneNumber(document.getElementById('settingsPhone'));
    document.getElementById('settingsAddress').value = companyInfo.address || '';
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
        <input type="text" placeholder="수량" class="work-quantity" value="${quantity}" oninput="formatNumber(this)">
        <input type="text" placeholder="단위" class="work-unit" value="${unit}" list="unitOptions">
        <input type="text" placeholder="단가" class="work-price" value="${price}" oninput="formatNumber(this)">
        <button onclick="removeWorkItem(this)">삭제</button>
    `;
    workItemsContainer.appendChild(newItem);

    newItem.querySelectorAll('.work-quantity, .work-price').forEach(input => {
        input.addEventListener('input', updateTotalAmount);
    });
}

// 천단위 쉼표 포맷 함수 추가
function formatNumber(input) {
    // 입력값에서 쉼표 제거
    let value = input.value.replace(/,/g, '');
    
    // 숫자만 남기기
    value = value.replace(/[^\d]/g, '');
    
    // 천단위 쉼표 추가
    if (value) {
        input.value = Number(value).toLocaleString();
    }
}

function showFontGuide() {
    document.getElementById('fontGuideModal').style.display = 'flex';
}

function closeFontGuideModal() {
    document.getElementById('fontGuideModal').style.display = 'none';
}

// Base64 인코딩을 위한 헬퍼 함수
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// 폰트 로드 함수
async function loadFont() {
    if (nanumGothicFont) {
        return; // 이미 로드되었으면 함수 종료
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const originalText = loadingOverlay.querySelector('p').textContent;
    loadingOverlay.querySelector('p').textContent = '최초 실행 시 폰트를 로딩합니다. 잠시만 기다려주세요...';
    loadingOverlay.style.display = 'flex';

    try {
        const response = await fetch('./fonts/NanumGothic.ttf');
        if (!response.ok) {
            throw new Error('폰트 파일을 불러오는 데 실패했습니다.');
        }
        const fontBuffer = await response.arrayBuffer();
        nanumGothicFont = arrayBufferToBase64(fontBuffer);
    } catch (error) {
        console.error(error);
        alert(error.message);
        throw error; // 에러를 다시 던져서 PDF 생성 중단
    } finally {
        loadingOverlay.style.display = 'none';
        loadingOverlay.querySelector('p').textContent = originalText;
    }
}

async function generatePDF() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    try {
        await loadFont(); // 폰트 로드 (필요한 경우)

        loadingOverlay.style.display = 'flex';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // 폰트 추가 및 설정
        doc.addFileToVFS('NanumGothic.ttf', nanumGothicFont);
        doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
        doc.setFont('NanumGothic');

        // --- 데이터 수집 ---
        const companyName = document.getElementById('companyName').value;
        const manager = document.getElementById('manager').value;
        const phone = document.getElementById('phone').value;
        const companyInfo = JSON.parse(localStorage.getItem('companyInfo')) || {};
        const address = companyInfo.address || '';
        const siteName = document.getElementById('siteName').value;
        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const workAddress = document.getElementById('workAddress').value;
        const estimateDate = document.getElementById('estimateDate').value;
        const deadlineDate = document.getElementById('deadlineDate').value;
        const totalAmount = document.getElementById('totalAmount').textContent;
        const notes = document.getElementById('notes').value;
        const workItems = [];
        document.querySelectorAll('#workItems .work-item').forEach(item => {
            const name = item.querySelector('.work-name').value;
            const quantityValue = item.querySelector('.work-quantity').value.replace(/,/g, '');
            const unit = item.querySelector('.work-unit').value;
            const priceValue = item.querySelector('.work-price').value.replace(/,/g, '');
            
            if (name) {
                workItems.push({ name, quantity: quantityValue, unit, price: priceValue });
            }
        });

        // --- PDF 내용 생성 (한글로 복원) ---
        doc.setFontSize(22);
        doc.text("견 적 서", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`견적일: ${estimateDate}`, 195, 30, { align: 'right' });

        doc.autoTable({
            startY: 35,
            head: [['공급자 (회사 정보)']],
            body: [
                [`회사명: ${companyName}`],
                [`담당자: ${manager}`],
                [`연락처: ${phone}`],
                [`주소: ${address}`]
            ],
            theme: 'grid',
            styles: { font: 'NanumGothic', fontStyle: 'normal' },
            headStyles: { font: 'NanumGothic', fontStyle: 'bold' }
        });
        
        doc.autoTable({
            head: [['공급받는 자 (고객 정보)']],
            body: [
                [`현장명: ${siteName}`],
                [`고객명: ${customerName}`],
                [`연락처: ${customerPhone}`],
                [`공사 주소: ${workAddress}`],
                [`제출 마감일: ${deadlineDate || '없음'}`]
            ],
            theme: 'grid',
            styles: { font: 'NanumGothic', fontStyle: 'normal' },
            headStyles: { font: 'NanumGothic', fontStyle: 'bold' }
        });
        
        const workItemsBody = workItems.map((item, index) => [
            index + 1, item.name, item.quantity || '0', item.unit,
            item.price ? Number(item.price).toLocaleString() : '0',
            (item.quantity && item.price) ? (Number(item.quantity) * Number(item.price)).toLocaleString() : '0'
        ]);
        
        doc.autoTable({
            head: [['No.', '공사 항목', '수량', '단위', '단가', '금액']],
            body: workItemsBody,
            headStyles: { halign: 'center', font: 'NanumGothic', fontStyle: 'bold' },
            styles: { font: 'NanumGothic', fontStyle: 'normal' }
        });
        
        const finalY = doc.autoTable.previous.finalY;
        doc.setFontSize(12);
        doc.text(`총 견적 금액: ${totalAmount}`, 195, finalY + 10, { align: 'right' });
        
        doc.setFontSize(10);
        doc.text("특이사항", 14, finalY + 20);
        doc.autoTable({
            startY: finalY + 22,
            body: [[notes || '없음']],
            theme: 'plain',
            styles: { font: 'NanumGothic' }
        });

        const pdfBlob = doc.output('blob');
        const fileName = `${siteName.replace(/[\/\\?%*:|"<>]/g, '-') || '견적서'}.pdf`;
        
        generatedPdfDoc = doc;
        generatedPdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        generatedPdfSiteName = siteName || '견적서';
        
        document.getElementById('pdfActionModal').style.display = 'flex';

    } catch(e) {
        console.error("PDF 생성 중 오류 발생:", e);
        // 오류가 발생했더라도 로딩 오버레이는 숨김
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

async function saveEstimate(showAlert = false) {
    const customer = {
        id: document.getElementById('editingEstimateId').value || 'customer-' + Date.now(),
        companyName: document.getElementById('companyName').value,
        manager: document.getElementById('manager').value,
        phone: document.getElementById('phone').value,
        siteName: document.getElementById('siteName').value,
        customerName: document.getElementById('customerName').value,
        customerPhone: document.getElementById('customerPhone').value,
        workAddress: document.getElementById('workAddress').value,
        estimateDate: document.getElementById('estimateDate').value,
        deadlineDate: document.getElementById('deadlineDate').value,
        totalAmount: document.getElementById('totalAmount').textContent,
        notes: document.getElementById('notes').value,
        workItems: []
    };

    document.querySelectorAll('#workItems .work-item').forEach(item => {
        const name = item.querySelector('.work-name').value;
        const quantityValue = item.querySelector('.work-quantity').value.replace(/,/g, '');
        const unit = item.querySelector('.work-unit').value;
        const priceValue = item.querySelector('.work-price').value.replace(/,/g, '');
        
        if (name) {
            customer.workItems.push({ name, quantity: quantityValue, unit, price: priceValue });
        }
    });

    if (!customer.siteName && !customer.customerName) {
        if (showAlert) {
            alert('현장명 또는 고객명을 입력해야 저장이 가능합니다.');
        }
        return;
    }
    
    // 고객 데이터 로드
    let customers = await loadData(STORES.CUSTOMERS) || [];
    
    const editingId = document.getElementById('editingEstimateId').value;
    const existingIndex = editingId ? customers.findIndex(c => c.id === editingId) : -1;

    if (existingIndex > -1) {
        customers[existingIndex] = customer;
    } else {
        customers.unshift(customer);
    }
    
    // 고객 데이터 저장
    await saveData(STORES.CUSTOMERS, customers);
    
    if (showAlert) {
        alert('견적이 저장되었습니다.');
    }
}

async function loadCustomers() {
    const customers = await loadData(STORES.CUSTOMERS) || [];
    renderCustomerList(customers);
}

async function searchCustomers() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const allCustomers = await loadData(STORES.CUSTOMERS) || [];
    
    if (!query) {
        renderCustomerList(allCustomers);
        return;
    }
    
    const filteredCustomers = allCustomers.filter(c => 
        (c.siteName && c.siteName.toLowerCase().includes(query)) ||
        (c.customerName && c.customerName.toLowerCase().includes(query)) ||
        (c.workAddress && c.workAddress.toLowerCase().includes(query))
    );
    
    renderCustomerList(filteredCustomers, true);
}

function renderCustomerList(customers, isSearchResult = false) {
    const listElement = document.getElementById('customerList');
    if (customers.length === 0) {
        const emptyMessage = isSearchResult 
            ? '<h3>검색 결과가 없습니다</h3><p>다른 검색어로 시도해보세요.</p>'
            : '<div style="font-size: 48px; margin-bottom: 15px;">📋</div><h3>저장된 고객이 없습니다</h3><p>견적서를 작성하면 고객 정보가 자동으로 저장됩니다</p>';
        listElement.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }

    listElement.innerHTML = customers.map(customer => {
        const phoneLink = customer.customerPhone 
            ? `<a href="tel:${customer.customerPhone.replace(/\D/g, '')}" class="customer-phone-link" onclick="event.stopPropagation()">${customer.customerPhone}</a>`
            : '-';

        return `
            <div class="customer-card">
                <div class="card-header">
                    <strong>${customer.siteName || '이름 없는 현장'}</strong>
                    <div class="card-actions">
                        <button class="btn-action-text" onclick="viewEstimateDetails(event, '${customer.id}')">수정</button>
                        <button class="btn-action-text" onclick="deleteCustomer(event, '${customer.id}')">삭제</button>
                    </div>
                </div>
                <div class="card-body">
                    <p><strong>고객명:</strong> ${customer.customerName || '-'}</p>
                    <p><strong>연락처:</strong> ${phoneLink}</p>
                    <p><strong>주소:</strong> ${customer.workAddress || '-'}</p>
                    <p><strong>견적일:</strong> ${customer.estimateDate}</p>
                    <p><strong>견적액:</strong> ${customer.totalAmount}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteCustomer(event, customerId) {
    event.stopPropagation();
    if (confirm('이 고객 정보를 정말로 삭제하시겠습니까?')) {
        let customers = await loadData(STORES.CUSTOMERS) || [];
        customers = customers.filter(c => c.id !== customerId);
        await saveData(STORES.CUSTOMERS, customers);
        loadCustomers();
    }
}

async function viewEstimateDetails(event, customerId) {
    event.stopPropagation();
    const customers = await loadData(STORES.CUSTOMERS) || [];
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        document.getElementById('companyName').value = customer.companyName;
        document.getElementById('manager').value = customer.manager;
        document.getElementById('phone').value = customer.phone;
        formatPhoneNumber(document.getElementById('phone'));
        document.getElementById('siteName').value = customer.siteName;
        document.getElementById('customerName').value = customer.customerName;
        document.getElementById('customerPhone').value = customer.customerPhone;
        formatPhoneNumber(document.getElementById('customerPhone'));
        document.getElementById('workAddress').value = customer.workAddress;
        document.getElementById('estimateDate').value = customer.estimateDate;
        document.getElementById('deadlineDate').value = customer.deadlineDate || '';
        document.getElementById('notes').value = customer.notes;
        
        const workItemsContainer = document.getElementById('workItems');
        workItemsContainer.innerHTML = '';
        if (customer.workItems && customer.workItems.length > 0) {
            customer.workItems.forEach(item => {
                // 수량과 단가에 천단위 쉼표 적용
                const formattedItem = {
                    name: item.name,
                    quantity: item.quantity ? Number(item.quantity).toLocaleString() : '',
                    unit: item.unit,
                    price: item.price ? Number(item.price).toLocaleString() : ''
                };
                addWorkItem(formattedItem);
            });
        } else {
            addWorkItem(); // 비어있을 경우 기본 항목 추가
        }
        
        updateTotalAmount();
        document.getElementById('editingEstimateId').value = customer.id;
        showPage('estimate');
        window.scrollTo(0, 0);
    }
}

function clearEstimateForm() {
    // 회사 정보를 제외한 필드만 초기화
    document.getElementById('siteName').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('workAddress').value = '';
    document.getElementById('deadlineDate').value = '';
    document.getElementById('notes').value = '';
    
    // 공사 항목 초기화
    document.getElementById('workItems').innerHTML = '';
    addWorkItem();
    
    // 견적일자는 오늘 날짜로 설정
    document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
    
    // 편집 중인 ID 초기화
    document.getElementById('editingEstimateId').value = '';
    
    // 회사 정보 유지 (loadCompanyInfo 호출 제거)
    
    // 총 금액 업데이트
    updateTotalAmount();
}

function formatPhoneNumber(input) {
    if (!input) return;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    
    if (value.length > 7) {
        input.value = `${value.substring(0, 3)}-${value.substring(3, 7)}-${value.substring(7)}`;
    } else if (value.length > 3) {
        input.value = `${value.substring(0, 3)}-${value.substring(3)}`;
    } else {
        input.value = value;
    }
}

async function exportData() {
    try {
        const companyInfo = await loadData(STORES.COMPANY, 'companyInfo');
        const customers = await loadData(STORES.CUSTOMERS);
        const customFont = localStorage.getItem('customFont'); // 폰트는 여전히 localStorage에서 관리
        
        const data = {
            companyInfo,
            customers,
            font: customFont
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0,10).replace(/-/g,"");
        a.download = `estimate_backup_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('데이터가 성공적으로 내보내졌습니다.');
    } catch (error) {
        console.error('데이터 내보내기 실패:', error);
        alert('데이터 내보내기에 실패했습니다.');
    }
}

function importData() {
    document.getElementById('importFile').click();
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('데이터를 불러오면 현재 모든 데이터가 덮어씌워집니다. 계속하시겠습니까?')) {
                if(data.companyInfo) await saveData(STORES.COMPANY, data.companyInfo, 'companyInfo');
                if(data.customers) await saveData(STORES.CUSTOMERS, data.customers);
                if(data.font) {
                    localStorage.setItem('customFont', data.font);
                    window.font = data.font;
                }
                alert('데이터를 성공적으로 불러왔습니다. 페이지를 새로고침합니다.');
                location.reload();
            }
        } catch (error) {
            alert('데이터 파일이 손상되었거나 잘못된 형식입니다.');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function closePdfActionModal() {
    document.getElementById('pdfActionModal').style.display = 'none';
}

async function downloadPDF() {
    if (!generatedPdfDoc) {
        alert('먼저 PDF를 생성해주세요.');
        return;
    }
    generatedPdfDoc.save(generatedPdfFile.name);
    closePdfActionModal();
}

async function sharePDF() {
    if (!generatedPdfFile) {
        alert('먼저 PDF를 생성해주세요.');
        return;
    }

    const shareData = {
        title: `[견적서] ${generatedPdfSiteName}`,
        text: `${generatedPdfSiteName} 견적서입니다.`,
        files: [generatedPdfFile]
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            if (error.name !== 'AbortError') {
                alert('공유하는 중 오류가 발생했습니다.');
            }
        }
    } else {
        alert('이 브라우저에서는 파일 공유를 지원하지 않습니다. PDF를 먼저 다운로드한 후 직접 공유해주세요.');
    }
    closePdfActionModal();
}

async function clearAllData() {
    if (confirm('정말로 모든 회사 정보와 고객 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        if (db) {
            // IndexedDB 데이터 삭제
            const transaction = db.transaction([STORES.COMPANY, STORES.CUSTOMERS, STORES.SETTINGS], 'readwrite');
            transaction.objectStore(STORES.COMPANY).clear();
            transaction.objectStore(STORES.CUSTOMERS).clear();
            transaction.objectStore(STORES.SETTINGS).clear();
        }
        
        // localStorage 데이터도 삭제
        localStorage.clear();
        
        alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
        location.reload();
    }
}

// 페이지 로드 시 DB 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    
    // 초기화 후 데이터 로드
    loadCompanyInfo();
    
    // 페이지 상태에 따라 데이터 로드
    const activePage = document.querySelector('.container.active').id.replace('Page', '');
    showPage(activePage);
});

// 전역 스코프에 함수 노출
window.showPage = showPage;
window.installApp = installApp;
window.formatPhoneNumber = formatPhoneNumber;
window.removeWorkItem = removeWorkItem;
window.addWorkItem = addWorkItem;
window.clearEstimateForm = clearEstimateForm;
window.saveEstimate = saveEstimate;
window.generatePDF = generatePDF;
window.searchCustomers = searchCustomers;
window.deleteCustomer = deleteCustomer;
window.viewEstimateDetails = viewEstimateDetails;
window.saveCompanyInfo = saveCompanyInfo;
window.showFontGuide = showFontGuide;
window.closeFontGuideModal = closeFontGuideModal;
window.exportData = exportData;
window.importData = importData;
window.handleFileImport = handleFileImport;
window.closePdfActionModal = closePdfActionModal;
window.downloadPDF = downloadPDF;
window.sharePDF = sharePDF;
window.clearAllData = clearAllData;