// PWA 관련 변수
let deferredPrompt;
let isInstalled = false;

// PDF 공유를 위한 전역 변수
let generatedPdfDoc = null;
let generatedPdfFile = null;
let generatedPdfSiteName = '';

// 파일 시스템 접근을 위한 변수
let dbDirectoryHandle = null;
const DB_FILE_NAME = 'database.json';

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
document.addEventListener('DOMContentLoaded', () => {
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
    
    // 파일 시스템 초기화 및 데이터 로드
    initializeFileSystem();
});

// 파일 시스템 초기화
async function initializeFileSystem() {
    // IndexedDB에서 핸들 가져오기
    dbDirectoryHandle = await getDirectoryHandleFromDB();
    if (dbDirectoryHandle) {
        // 권한 확인 (페이지 로드 시에는 요청하지 않음)
        if (await verifyPermission(dbDirectoryHandle, { request: false })) {
            updateFileSystemStatus(true, '연결됨');
            await loadDataFromFile(); // 파일에서 데이터 로드
        } else {
            // 핸들은 있지만 권한이 없는 상태
            updateFileSystemStatus(false, '권한이 필요합니다. 폴더를 다시 연결해 주세요.');
            loadDataFromLocalStorage(); // 우선 로컬 스토리지에서 로드
        }
    } else {
        updateFileSystemStatus(false, '연결되지 않음');
        loadDataFromLocalStorage(); // 로컬 스토리지에서 로드
    }
}

// 데이터 로드 통합
function loadDataFromLocalStorage() {
    loadCompanyInfo();
    checkDeadlines();
}

async function connectFileSystem() {
    try {
        const handle = await window.showDirectoryPicker();
        if (handle) {
            dbDirectoryHandle = handle;
            await setDirectoryHandleInDB(handle);
            updateFileSystemStatus(true, '성공적으로 연결되었습니다!');

            try {
                // 연결 시 기존 데이터 파일이 있는지 확인
                await dbDirectoryHandle.getFileHandle(DB_FILE_NAME);
                // 파일이 존재하면 데이터를 불러옴
                await loadDataFromFile();
                alert('폴더에 다시 연결하고 기존 데이터를 불러왔습니다.');
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    // 파일이 없으면 현재 데이터를 파일에 백업
                    await saveDataToFile();
                    alert('폴더가 연결되었습니다. 이제 모든 데이터는 선택한 폴더에 안전하게 자동 저장됩니다.');
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('폴더 연결 실패:', error);
            alert('데이터 폴더를 연결하는 데 실패했습니다.');
        }
    }
}

function updateFileSystemStatus(isConnected, message = '') {
    const statusEl = document.getElementById('fileSystemStatus');
    if (!statusEl) return;
    
    const statusSpan = statusEl.querySelector('span');
    if (isConnected) {
        statusSpan.textContent = '연결됨';
        statusSpan.className = 'status-connected';
    } else {
        statusSpan.textContent = '연결되지 않음';
        statusSpan.className = 'status-disconnected';
    }
    // 추가 메시지 (예: 성공, 실패)
    // 이 부분은 필요에 따라 추가 구현
}

async function saveDataToFile() {
    if (!dbDirectoryHandle) return;

    // 데이터를 저장하기 전에 항상 권한을 확인하고 필요한 경우 요청합니다.
    if (!(await verifyPermission(dbDirectoryHandle))) {
        updateFileSystemStatus(false, '권한이 필요합니다. 폴더를 다시 연결해 주세요.');
        alert('데이터를 저장하기 위한 폴더 접근 권한이 없습니다. 설정 페이지에서 폴더를 다시 연결해주세요.');
        return;
    }

    try {
        const fileHandle = await dbDirectoryHandle.getFileHandle(DB_FILE_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        
        const data = {
            companyInfo: JSON.parse(localStorage.getItem('companyInfo') || '{}'),
            customers: JSON.parse(localStorage.getItem('customers') || '[]')
        };
        
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        console.log('데이터가 파일에 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('파일에 데이터 저장 실패:', error);
        alert('연결된 폴더에 데이터를 저장하는 데 실패했습니다. 폴더 접근 권한을 다시 확인해주세요.');
        updateFileSystemStatus(false);
        dbDirectoryHandle = null;
        await clearDirectoryHandleFromDB();
    }
}

async function loadDataFromFile() {
    if (!dbDirectoryHandle) return;
    
    // 데이터를 불러오기 전에 항상 권한을 확인하고 필요한 경우 요청합니다.
    if (!(await verifyPermission(dbDirectoryHandle))) {
        updateFileSystemStatus(false, '권한이 필요합니다. 폴더를 다시 연결해 주세요.');
        // 권한이 없으면 여기서 중단하고, 로컬 스토리지 데이터가 화면에 표시되도록 합니다.
        loadDataFromLocalStorage();
        return;
    }

    try {
        const fileHandle = await dbDirectoryHandle.getFileHandle(DB_FILE_NAME);
        const file = await fileHandle.getFile();
        const content = await file.text();
        const data = JSON.parse(content);

        // 파일 내용을 로컬스토리지에 저장
        if (data.companyInfo) {
            localStorage.setItem('companyInfo', JSON.stringify(data.companyInfo));
        }
        if (data.customers) {
            localStorage.setItem('customers', JSON.stringify(data.customers));
        }
        
        console.log('파일에서 데이터를 성공적으로 불러왔습니다.');

    } catch (error) {
        if (error.name === 'NotFoundError') {
            console.log('데이터베이스 파일이 없어 새로 생성합니다.');
        } else {
            console.error('파일에서 데이터 로드 실패:', error);
            alert('연결된 폴더에서 데이터를 불러오는 데 실패했습니다.');
        }
    } finally {
        // 파일 로드 후, 화면에 데이터 반영
        loadDataFromLocalStorage();
    }
}

// --- IndexedDB Helper Functions ---
function getDirectoryHandleFromDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open('file-system-db', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('handles', { keyPath: 'id' });
        };
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('handles', 'readonly');
            const store = transaction.objectStore('handles');
            const getRequest = store.get('directory');
            getRequest.onsuccess = () => {
                resolve(getRequest.result ? getRequest.result.handle : null);
            };
            getRequest.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
    });
}

function setDirectoryHandleInDB(handle) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('file-system-db', 1);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('handles', 'readwrite');
            const store = transaction.objectStore('handles');
            store.put({ id: 'directory', handle }).onsuccess = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
    });
}

function clearDirectoryHandleFromDB() {
    // 핸들 삭제 로직 (필요 시 구현)
}

async function verifyPermission(handle, options = { request: true }) {
    const permOpts = { mode: 'readwrite' };
    // 현재 권한 상태 확인
    if ((await handle.queryPermission(permOpts)) === 'granted') {
        return true;
    }
    // 권한 요청이 허용된 경우에만 요청
    if (options.request && (await handle.requestPermission(permOpts)) === 'granted') {
        return true;
    }
    // 그 외의 경우 (denied 또는 prompt인데 요청하지 않은 경우)
    return false;
}

function updateTotalAmount() {
    let total = 0;
    document.querySelectorAll('#workItems .work-item').forEach(item => {
        const quantity = parseFloat(item.querySelector('.work-quantity').value.replace(/,/g, '')) || 0;
        const price = parseFloat(item.querySelector('.work-price').value.replace(/,/g, '')) || 0;
        total += quantity * price;
    });

    document.getElementById('totalAmount').textContent = `${total.toLocaleString()}원`;
}

function saveCompanyInfo() {
    const companyInfo = {
        name: document.getElementById('settingsCompanyName').value,
        manager: document.getElementById('settingsManager').value,
        phone: document.getElementById('settingsPhone').value,
        address: document.getElementById('settingsAddress').value
    };
    
    localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
    saveDataToFile(); // 파일에 저장

    const messageDiv = document.getElementById('companySavedMessage');
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 2000);
}

function loadCompanyInfo() {
    const companyInfo = JSON.parse(localStorage.getItem('companyInfo')) || {};
    document.getElementById('companyName').value = companyInfo.name || '';
    document.getElementById('manager').value = companyInfo.manager || '';
    document.getElementById('phone').value = companyInfo.phone || '';
    formatPhoneNumber(document.getElementById('phone'));
}

function loadSettingsCompanyInfo() {
    const companyInfo = JSON.parse(localStorage.getItem('companyInfo')) || {};
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
    const quantity = itemData && itemData.quantity ? Number(itemData.quantity).toLocaleString() : '';
    const unit = itemData ? itemData.unit : '';
    const price = itemData && itemData.price ? Number(itemData.price).toLocaleString() : '';

    newItem.innerHTML = `
        <input type="text" placeholder="공사 항목" class="work-name" value="${name}">
        <input type="text" placeholder="수량" class="work-quantity" value="${quantity}" oninput="formatNumberInput(this); updateTotalAmount();">
        <input type="text" placeholder="단위" class="work-unit" value="${unit}">
        <input type="text" placeholder="단가" class="work-price" value="${price}" oninput="formatNumberInput(this); updateTotalAmount();">
        <button onclick="removeWorkItem(this)">삭제</button>
    `;
    workItemsContainer.appendChild(newItem);
}

async function generatePDF() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    try {
        if (typeof window.font === 'undefined') {
            alert('PDF 생성에 필요한 폰트 파일(font.js)이 로드되지 않았습니다. 페이지를 새로고침하고 다시 시도해 주세요.');
            console.error('font.js가 로드되지 않았습니다.');
            return;
        }

        loadingOverlay.style.display = 'flex';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.addFileToVFS('NanumGothic.ttf', window.font);
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
            const quantity = item.querySelector('.work-quantity').value.replace(/,/g, '');
            const unit = item.querySelector('.work-unit').value;
            const price = item.querySelector('.work-price').value.replace(/,/g, '');
            if (name) {
                workItems.push({ name, quantity, unit, price });
            }
        });

        // --- PDF 디자인 개선 ---
        const primaryColor = [22, 160, 133];
        const lightGrayColor = [245, 245, 245];

        // Header
        doc.setFontSize(26);
        doc.setFont(undefined, 'bold');
        doc.setTextColor.apply(null, primaryColor);
        doc.text("견 적 서", 105, 25, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(10);
        doc.text(`견적일: ${estimateDate}`, 195, 40, { align: 'right' });

        // 공급자/공급받는자 정보
        const infoTableStartY = 50;
        doc.autoTable({
            startY: infoTableStartY,
            head: [['공급자 (회사 정보)']],
            body: [
                [`회사명: ${companyName}`],
                [`담당자: ${manager}`],
                [`연락처: ${phone}`],
                [`주소: ${address}`]
            ],
            theme: 'grid',
            styles: { font: 'NanumGothic', fontSize: 9 },
            headStyles: { fillColor: primaryColor, textColor: 255, font: 'NanumGothic', fontStyle: 'bold' }
        });
        
        doc.autoTable({
            startY: infoTableStartY,
            head: [['공급받는 자 (고객 정보)']],
            body: [
                [`현장명: ${siteName}`],
                [`고객명: ${customerName}`],
                [`연락처: ${customerPhone}`],
                [`공사 주소: ${workAddress}`],
                [`제출 마감일: ${deadlineDate || '없음'}`]
            ],
            theme: 'grid',
            styles: { font: 'NanumGothic', fontSize: 9 },
            headStyles: { fillColor: primaryColor, textColor: 255, font: 'NanumGothic', fontStyle: 'bold' },
            margin: { left: 108 }
        });
        
        // 공사 내용
        const workItemsBody = workItems.map((item, index) => [
            index + 1,
            item.name,
            item.quantity ? Number(item.quantity).toLocaleString() : '0',
            item.unit,
            item.price ? Number(item.price).toLocaleString() : '0',
            (item.quantity && item.price) ? (Number(item.quantity) * Number(item.price)).toLocaleString() : '0'
        ]);
        
        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 10,
            head: [['No.', '공사 항목', '수량', '단위', '단가', '금액']],
            body: workItemsBody,
            theme: 'striped',
            headStyles: { halign: 'center', fillColor: primaryColor, textColor: 255, font: 'NanumGothic', fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { font: 'NanumGothic', fontSize: 9 },
            footStyles: { font: 'NanumGothic', fontStyle: 'bold' },
            alternateRowStyles: { fillColor: lightGrayColor }
        });
        
        // 총 금액 강조
        const finalY = doc.autoTable.previous.finalY;
        doc.setFillColor.apply(null, lightGrayColor);
        doc.rect(14, finalY + 5, 182, 12, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('총 견적 금액', 20, finalY + 12.5);
        doc.setTextColor.apply(null, primaryColor);
        doc.text(totalAmount, 196, finalY + 12.5, { align: 'right' });
        doc.setTextColor(0,0,0);
        doc.setFont(undefined, 'normal');

        // 특이사항
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text("특이사항", 14, finalY + 28);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text(notes || '없음', 14, finalY + 34, {
            maxWidth: 182,
            lineHeightFactor: 1.5
        });

        const pdfBlob = doc.output('blob');
        const fileName = `${siteName.replace(/[\/\\?%*:|"<>]/g, '-') || '견적서'}.pdf`;
        
        generatedPdfDoc = doc;
        generatedPdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        generatedPdfSiteName = siteName || '견적서';
        
        document.getElementById('pdfActionModal').style.display = 'flex';

    } catch(e) {
        console.error("PDF 생성 중 오류 발생:", e);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function saveEstimate(showAlert = false) {
    const customer = {
        id: 'customer-' + Date.now(),
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
        const quantity = item.querySelector('.work-quantity').value.replace(/,/g, '');
        const unit = item.querySelector('.work-unit').value;
        const price = item.querySelector('.work-price').value.replace(/,/g, '');
        if (name) {
            customer.workItems.push({ name, quantity, unit, price });
        }
    });

    if (!customer.siteName && !customer.customerName) {
        if (showAlert) {
            alert('현장명 또는 고객명을 입력해야 저장이 가능합니다.');
        }
        return;
    }
    
    let customers = JSON.parse(localStorage.getItem('customers')) || [];
    
    const editingId = document.getElementById('editingEstimateId').value;
    const existingIndex = editingId ? customers.findIndex(c => c.id === editingId) : -1;

    if (existingIndex > -1) {
        customer.id = customers[existingIndex].id;
        customers[existingIndex] = customer;
    } else {
        customers.unshift(customer);
    }
    
    localStorage.setItem('customers', JSON.stringify(customers));
    document.getElementById('editingEstimateId').value = '';

    if (showAlert) {
        alert('견적이 저장되었습니다!');
    }
    
    const sentNotifications = new Set(JSON.parse(localStorage.getItem('sentNotifications')) || []);
    sentNotifications.delete(customer.id);
    localStorage.setItem('sentNotifications', JSON.stringify([...sentNotifications]));

    saveDataToFile(); // 파일에 저장
}

function loadCustomers() {
    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    renderCustomerList(customers);
}

function searchCustomers() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const allCustomers = JSON.parse(localStorage.getItem('customers')) || [];
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

function deleteCustomer(event, customerId) {
    event.stopPropagation();
    if (confirm('이 고객 정보를 정말로 삭제하시겠습니까?')) {
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        customers = customers.filter(c => c.id !== customerId);
        localStorage.setItem('customers', JSON.stringify(customers));
        saveDataToFile(); // 파일에 저장
        loadCustomers();
    }
}

function viewEstimateDetails(event, customerId) {
    event.stopPropagation();
    const customers = JSON.parse(localStorage.getItem('customers')) || [];
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
            customer.workItems.forEach(item => addWorkItem(item));
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
    const form = document.querySelector('#estimatePage .form-container');
    form.reset();
    document.getElementById('workItems').innerHTML = '';
    addWorkItem();
    document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('editingEstimateId').value = '';
    loadCompanyInfo();
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

function formatNumberInput(input) {
    if (!input) return;
    let value = input.value.replace(/[^0-9]/g, ''); // 숫자 이외의 문자 제거
    if (value) {
        input.value = parseInt(value, 10).toLocaleString('ko-KR');
    } else {
        input.value = '';
    }
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

function clearAllData() {
    if (confirm('정말로 모든 회사 정보와 고객 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        localStorage.clear();
        alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
        location.reload();
    }
}

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
window.closePdfActionModal = closePdfActionModal;
window.downloadPDF = downloadPDF;
window.sharePDF = sharePDF;
window.clearAllData = clearAllData;
window.formatNumberInput = formatNumberInput;
window.connectFileSystem = connectFileSystem;