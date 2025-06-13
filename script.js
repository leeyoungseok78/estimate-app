// PWA 관련 변수
let deferredPrompt;
let isInstalled = false;

// PDF 공유를 위한 전역 변수
let generatedPdfDoc = null;
let generatedPdfFile = null;
let generatedPdfSiteName = '';

// 폰트 데이터 캐싱을 위한 변수
let nanumGothicFont = null;

// 파일 시스템 관련 변수
let fileHandle;
let syncEnabled = false;

// IndexedDB 관련 변수 및 초기화
let db;
const DB_NAME = 'estimateAppDB';
const DB_VERSION = 1;
const STORES = {
    COMPANY: 'companyInfo',
    CUSTOMERS: 'customers'
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
        const quantityValue = item.querySelector('.work-quantity').value.replace(/,/g, '') || '0';
        const priceValue = item.querySelector('.work-price').value.replace(/,/g, '') || '0';
        const quantity = parseFloat(quantityValue);
        const price = parseFloat(priceValue);
        total += quantity * price;
    });
    document.getElementById('totalAmount').textContent = `${total.toLocaleString('ko-KR')}원`;
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject('IndexedDB error');
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB connection successful');
            resolve();
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORES.COMPANY)) {
                db.createObjectStore(STORES.COMPANY, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
                db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
            }
        };
    });
}

function saveData(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function loadData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = key ? store.get(key) : store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveCompanyInfo() {
    const companyData = {
        id: 'main',
        name: document.getElementById('settingsCompanyName').value,
        manager: document.getElementById('settingsManager').value,
        phone: document.getElementById('settingsPhone').value,
        address: document.getElementById('settingsAddress').value
    };
    try {
        await saveData(STORES.COMPANY, companyData);
        await loadCompanyInfo();
        const messageDiv = document.getElementById('companySavedMessage');
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error('Failed to save company info:', error);
    }
}

async function loadCompanyInfo() {
    try {
        const companyInfo = await loadData(STORES.COMPANY, 'main');
        if (companyInfo) {
            document.getElementById('companyName').value = companyInfo.name || '';
            document.getElementById('manager').value = companyInfo.manager || '';
            document.getElementById('phone').value = companyInfo.phone || '';
            formatPhoneNumber(document.getElementById('phone'));
        }
    } catch (error) {
        console.error('Failed to load company info:', error);
    }
}

async function loadSettingsCompanyInfo() {
    try {
        const companyInfo = await loadData(STORES.COMPANY, 'main');
        if (companyInfo) {
            document.getElementById('settingsCompanyName').value = companyInfo.name || '';
            document.getElementById('settingsManager').value = companyInfo.manager || '';
            document.getElementById('settingsPhone').value = companyInfo.phone || '';
            formatPhoneNumber(document.getElementById('settingsPhone'));
            document.getElementById('settingsAddress').value = companyInfo.address || '';
        }
    } catch (error) {
        console.error('Failed to load settings company info:', error);
    }
}

function removeWorkItem(element) {
    element.closest('.work-item').remove();
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
        <input type="text" inputmode="numeric" pattern="[0-9,]*" placeholder="수량" class="work-quantity" value="${quantity}" oninput="formatNumber(this)">
        <input type="text" placeholder="단위" class="work-unit" value="${unit}" list="unitOptions">
        <input type="text" inputmode="numeric" pattern="[0-9,]*" placeholder="단가" class="work-price" value="${price}" oninput="formatNumber(this)">
        <button onclick="removeWorkItem(this)">삭제</button>
    `;
    workItemsContainer.appendChild(newItem);

    newItem.querySelectorAll('.work-quantity, .work-price').forEach(input => {
        input.addEventListener('input', updateTotalAmount);
        // 초기 로드 시 값이 있다면 포맷팅 적용
        if (input.value) {
            formatNumber(input);
        }
    });
}

function formatNumber(input) {
    let value = input.value.replace(/,/g, '');
    if (isNaN(value)) {
        value = '';
    }
    const num = Number(value);
    if (num === 0) {
        input.value = '0';
    } else if (!isNaN(num)) {
        input.value = num.toLocaleString('ko-KR');
    } else {
        input.value = '';
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
        if (showAlert) alert('현장명 또는 고객명을 입력해야 저장이 가능합니다.');
        return;
    }

    try {
        await saveData(STORES.CUSTOMERS, customer);
        if (showAlert) alert('견적이 저장되었습니다.');
        await loadCustomers(); // Save and then reload the list.
    } catch (error) {
        console.error('Failed to save estimate:', error);
        if (showAlert) alert('견적 저장에 실패했습니다.');
    }
}

async function loadCustomers() {
    try {
        const customers = await loadData(STORES.CUSTOMERS) || [];
        renderCustomerList(customers);
    } catch (error) {
        console.error('Failed to load customers:', error);
        renderCustomerList([]);
    }
}

async function searchCustomers() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    try {
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
    } catch (error) {
        console.error('Failed to search customers:', error);
    }
}

function renderCustomerList(customers, isSearchResult = false) {
    const listContainer = document.getElementById('customerList');
    listContainer.innerHTML = '';

    if (customers.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
            <h3>${isSearchResult ? '검색 결과가 없습니다' : '저장된 고객이 없습니다'}</h3>
            <p>${isSearchResult ? '다른 검색어로 시도해보세요' : '견적서를 작성하면 고객 정보가 자동으로 저장됩니다'}</p>
        `;
        listContainer.appendChild(emptyState);
        return;
    }

    customers.forEach(customer => {
        const card = document.createElement('div');
        card.className = 'customer-item';
        card.onclick = (event) => viewEstimateDetails(event, customer.id);

        const deadlineDate = customer.deadlineDate ? new Date(customer.deadlineDate) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let deadlineHTML = '';
        if (deadlineDate) {
            const diffTime = deadlineDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            let className = 'normal';
            if (diffDays < 0) className = 'overdue';
            else if (diffDays === 0) className = 'today';
            else if (diffDays <= 3) className = 'urgent';
            deadlineHTML = `<div class="customer-deadline ${className}">마감 ${diffDays < 0 ? '지남' : 'D-' + diffDays}</div>`;
        }

        card.innerHTML = `
            <div class="customer-name">${customer.siteName || customer.customerName}</div>
            <div class="customer-info">${customer.customerName} / <a href="tel:${customer.customerPhone}">${customer.customerPhone}</a></div>
            <div class="customer-info">${customer.workAddress}</div>
            <div class="customer-date">견적일: ${customer.estimateDate}</div>
            ${deadlineHTML}
            <div class="customer-item-buttons">
                <button class="btn-edit" onclick="event.stopPropagation(); viewEstimateDetails(event, '${customer.id}');">수정</button>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteCustomer(event, '${customer.id}');">삭제</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

async function deleteCustomer(event, customerId) {
    event.stopPropagation();
    if (confirm('이 고객 정보를 정말로 삭제하시겠습니까?')) {
        try {
            if (!db) return alert("DB not initialized");
            const transaction = db.transaction(STORES.CUSTOMERS, 'readwrite');
            const store = transaction.objectStore(STORES.CUSTOMERS);
            const request = store.delete(customerId);
            request.onsuccess = async () => {
                await loadCustomers();
            };
            request.onerror = () => {
                alert('삭제에 실패했습니다.');
            };
        } catch (error) {
            console.error('Failed to delete customer:', error);
        }
    }
}

async function viewEstimateDetails(event, customerId) {
    event.stopPropagation();
    try {
        const customer = await loadData(STORES.CUSTOMERS, customerId);
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
                customer.workItems.forEach(item => addWorkItem(item));
            } else {
                addWorkItem();
            }
            
            updateTotalAmount();
            document.getElementById('editingEstimateId').value = customer.id;
            showPage('estimate');
            window.scrollTo(0, 0);
        }
    } catch(error) {
        console.error('Failed to view estimate:', error);
    }
}

function clearEstimateForm() {
    document.getElementById('siteName').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('workAddress').value = '';
    document.getElementById('deadlineDate').value = '';
    document.getElementById('notes').value = '';
    
    document.getElementById('workItems').innerHTML = '';
    addWorkItem();
    
    document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('editingEstimateId').value = '';
    
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
        const companyInfo = await loadData(STORES.COMPANY, 'main');
        const customers = await loadData(STORES.CUSTOMERS);
        
        const data = { companyInfo, customers };
        
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
                if(data.companyInfo) await saveData(STORES.COMPANY, data.companyInfo);
                if(data.customers && Array.isArray(data.customers)) {
                    const transaction = db.transaction(STORES.CUSTOMERS, 'readwrite');
                    const store = transaction.objectStore(STORES.CUSTOMERS);
                    await store.clear();
                    for (const customer of data.customers) {
                        await store.put(customer);
                    }
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
        try {
            const companyStore = db.transaction(STORES.COMPANY, 'readwrite').objectStore(STORES.COMPANY);
            await companyStore.clear();
            const customerStore = db.transaction(STORES.CUSTOMERS, 'readwrite').objectStore(STORES.CUSTOMERS);
            await customerStore.clear();
            alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
            location.reload();
        } catch (error) {
            alert('데이터 삭제에 실패했습니다.');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadCompanyInfo();
        const activePage = document.querySelector('.container.active').id.replace('Page', '');
        showPage(activePage);
    } catch (error) {
        console.error("Initialization failed:", error);
    }
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