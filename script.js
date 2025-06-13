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

// 초기화
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
        const quantity = parseFloat(item.querySelector('.work-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.work-price').value) || 0;
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

    newItem.querySelectorAll('.work-quantity, .work-price').forEach(input => {
        input.addEventListener('input', updateTotalAmount);
    });
}

function showFontGuide() {
    document.getElementById('fontGuideModal').style.display = 'flex';
}

function closeFontGuideModal() {
    document.getElementById('fontGuideModal').style.display = 'none';
}
    
function loadSavedFontData() {
    if (window.font) {
        updateFontStatus(true, '내장 폰트가 성공적으로 로드되었습니다.');
    } else {
        updateFontStatus(false, '내장 폰트를 로드할 수 없습니다.');
    }
}

async function generatePDF() {
    // PDF 생성 로직을 폰트 관련 코드 없이 실행하도록 수정
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
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
            const quantity = item.querySelector('.work-quantity').value;
            const unit = item.querySelector('.work-unit').value;
            const price = item.querySelector('.work-price').value;
            if (name) {
                workItems.push({ name, quantity, unit, price });
            }
        });

        // --- PDF 내용 생성 (한글 깨짐 이슈는 일단 무시) ---
        // 기본 폰트는 한글을 지원하지 않으므로, 일단 영문과 숫자로 테스트
        doc.setFontSize(22);
        doc.text("Estimate", 105, 20, { align: 'center' }); // Title in English
        
        doc.setFontSize(10);
        doc.text(`Estimate Date: ${estimateDate}`, 195, 30, { align: 'right' });

        doc.autoTable({
            startY: 35,
            head: [['Supplier Information']],
            body: [
                [`Company: ${companyName}`],
                [`Manager: ${manager}`],
                [`Phone: ${phone}`],
                [`Address: ${address}`]
            ],
            theme: 'grid'
        });
        
        doc.autoTable({
            head: [['Customer Information']],
            body: [
                [`Site Name: ${siteName}`],
                [`Customer: ${customerName}`],
                [`Phone: ${customerPhone}`],
                [`Work Address: ${workAddress}`],
                [`Deadline: ${deadlineDate || 'None'}`]
            ],
            theme: 'grid'
        });
        
        const workItemsBody = workItems.map((item, index) => [
            index + 1, item.name, item.quantity || '0', item.unit,
            item.price ? Number(item.price).toLocaleString() : '0',
            (item.quantity && item.price) ? (Number(item.quantity) * Number(item.price)).toLocaleString() : '0'
        ]);
        
        doc.autoTable({
            head: [['No.', 'Work Item', 'Qty', 'Unit', 'Unit Price', 'Amount']],
            body: workItemsBody,
            headStyles: { halign: 'center' }
        });
        
        const finalY = doc.autoTable.previous.finalY;
        doc.setFontSize(12);
        doc.text(`Total Amount: ${totalAmount}`, 195, finalY + 10, { align: 'right' });
        
        doc.setFontSize(10);
        doc.text("Notes", 14, finalY + 20);
        doc.autoTable({
            startY: finalY + 22,
            body: [[notes || 'None']],
            theme: 'plain'
        });

        const pdfBlob = doc.output('blob');
        const fileName = `${siteName.replace(/[\/\\?%*:|"<>]/g, '-') || '견적서'}.pdf`;
        
        generatedPdfDoc = doc;
        generatedPdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        generatedPdfSiteName = siteName || '견적서';
        
        document.getElementById('pdfActionModal').style.display = 'flex';

    } catch(e) {
        console.error("PDF 생성 중 오류 발생:", e);
        alert("PDF를 생성하는 중에 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
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
        const quantity = item.querySelector('.work-quantity').value;
        const unit = item.querySelector('.work-unit').value;
        const price = item.querySelector('.work-price').value;
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
    document.getElementById('estimatePage').querySelector('form').reset();
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

function exportData() {
    try {
        const data = {
            companyInfo: JSON.parse(localStorage.getItem('companyInfo')),
            customers: JSON.parse(localStorage.getItem('customers')),
            font: localStorage.getItem('customFont')
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

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('데이터를 불러오면 현재 모든 데이터가 덮어씌워집니다. 계속하시겠습니까?')) {
                if(data.companyInfo) localStorage.setItem('companyInfo', JSON.stringify(data.companyInfo));
                if(data.customers) localStorage.setItem('customers', JSON.stringify(data.customers));
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
window.showFontGuide = showFontGuide;
window.closeFontGuideModal = closeFontGuideModal;
window.exportData = exportData;
window.importData = importData;
window.handleFileImport = handleFileImport;
window.closePdfActionModal = closePdfActionModal;
window.downloadPDF = downloadPDF;
window.sharePDF = sharePDF;
window.clearAllData = clearAllData;