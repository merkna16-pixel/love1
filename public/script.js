const API_URL = window.location.origin + '/api';
let currentUser = null;
let data = null;
let refreshInterval = null;

// ============ АВТОРИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + this.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('modalConfirm').addEventListener('click', confirmPurchase);
    document.getElementById('modalCancel').addEventListener('click', cancelPurchase);
});

async function handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('loginInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const result = await res.json();

        if (result.success) {
            currentUser = result.user;
            document.querySelector('.login-container').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('currentUser').textContent = currentUser;
            await loadData();
            startAutoRefresh();
        } else {
            document.getElementById('loginError').textContent = '❌ Неверный логин или пароль';
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        document.getElementById('loginError').textContent = '❌ Ошибка подключения к серверу';
        document.getElementById('loginError').style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    stopAutoRefresh();
    document.querySelector('.login-container').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadData() {
    try {
        const res = await fetch(`${API_URL}/data`);
        data = await res.json();
        renderAll();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadData, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ============ РЕНДЕРИНГ ============
function renderAll() {
    if (!data || !currentUser) return;

    renderCoins();
    renderStats();
    renderTasks();
    renderShop();
    renderCalendar();
    renderDates();
    renderHistory();
    renderGoals();
    renderAchievements();
    renderStatsPage();
}

function renderCoins() {
    const coinsYakub = data.users['Якуб'].coins;
    const coinsSonya = data.users['Соня'].coins;

    document.getElementById('coinsYakub').textContent = coinsYakub;
    document.getElementById('coinsSonya').textContent = coinsSonya;
    document.getElementById('homeCoinsYakub').textContent = coinsYakub;
    document.getElementById('homeCoinsSonya').textContent = coinsSonya;
    document.getElementById('totalCoins').textContent = coinsYakub + coinsSonya;
}

function renderStats() {
    const start = new Date(data.startDate);
    const days = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
    document.getElementById('daysTogether').textContent = days;
    document.getElementById('streakDays').textContent = data.streak;
}

// ============ ЗАДАНИЯ ============
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    const today = new Date().toISOString().split('T')[0];
    const tasks = data.tasks.filter(t => t.date === today);

    if (tasks.length === 0) {
        container.innerHTML = '<div class="card"><p>🎉 Сегодня нет заданий</p></div>';
        return;
    }

    let html = '<div class="card">';
    const REWARD = 10;

    tasks.forEach(task => {
        let statusText = '❌ Не выполнено';
        let statusClass = '';
        let actions = '';
        let rewardHtml = '';

        if (task.done && task.confirmed) {
            statusText = '✅ Выполнено';
            statusClass = 'done';
            rewardHtml = `<span class="reward">+${REWARD}🪙</span>`;
            actions = `<span style="color:#27ae60;">✓ подтверждено</span>`;
        } else if (task.done && !task.confirmed) {
            statusText = '🟡 Ожидает подтверждения';
            statusClass = 'pending';
            const partner = task.author === 'Якуб' ? 'Сони' : 'Якуба';
            if (task.author !== currentUser) {
                actions = `<button class="btn btn-success" onclick="confirmTask('${task.id}')">✅ Подтвердить (+${REWARD}🪙)</button>`;
            } else {
                actions = `<span style="color:#f39c12;">⏳ ждёт подтверждения от ${partner}</span>`;
            }
        } else {
            actions = `<button class="btn btn-primary" onclick="doTask('${task.id}')">Я сделал ❤️</button>`;
            rewardHtml = `<span class="reward">+${REWARD}🪙</span>`;
        }

        const authorInfo = task.author ? `👤 ${task.author}` : '';

        html += `
            <div class="task-item ${statusClass}">
                <div>
                    <span>${task.text}</span>
                    <span style="font-size:0.7rem;color:#888;margin-left:8px;">${authorInfo}</span>
                    ${rewardHtml}
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:0.8rem;">${statusText}</span>
                    ${actions}
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function doTask(taskId) {
    try {
        await fetch(`${API_URL}/task/do`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, user: currentUser })
        });
        await loadData();
    } catch (error) {
        console.error('Ошибка выполнения задания:', error);
    }
}

async function confirmTask(taskId) {
    try {
        await fetch(`${API_URL}/task/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, user: currentUser })
        });
        await loadData();
    } catch (error) {
        console.error('Ошибка подтверждения:', error);
    }
}

// ============ МАГАЗИН ============
function renderShop() {
    const container = document.getElementById('shopContainer');
    let html = '';
    data.shop.forEach(item => {
        const disabled = data.users[currentUser].coins < item.price ? 'disabled' : '';
        html += `
            <div class="shop-item">
                <span>${item.name}</span>
                <div>
                    <span class="price">${item.price} 🪙</span>
                    <button class="btn btn-primary" ${disabled} onclick="openPurchaseModal('${item.name}', ${item.price})">Купить</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

let pendingPurchase = null;

function openPurchaseModal(name, price) {
    pendingPurchase = { name, price };
    document.getElementById('modalItemName').textContent = name;
    document.getElementById('modalDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseModal').classList.add('active');
}

function confirmPurchase() {
    if (!pendingPurchase) return;
    const date = document.getElementById('modalDate').value;
    if (!date) {
        alert('Пожалуйста, выберите дату');
        return;
    }

    fetch(`${API_URL}/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            itemName: pendingPurchase.name,
            price: pendingPurchase.price,
            buyer: currentUser,
            date: date
        })
    }).then(() => {
        pendingPurchase = null;
        document.getElementById('purchaseModal').classList.remove('active');
        loadData();
    });
}

function cancelPurchase() {
    pendingPurchase = null;
    document.getElementById('purchaseModal').classList.remove('active');
}

// ============ КАЛЕНДАРЬ ============
function renderCalendar() {
    const container = document.getElementById('calendarContainer');
    const events = [];

    data.purchases.forEach(p => {
        events.push({ date: p.date, text: `🎁 ${p.name} (${p.buyer})` });
    });

    const dates = data.importantDates;
    if (dates.meeting) events.push({ date: dates.meeting, text: '❤️ День знакомства' });
    if (dates.anniversary) events.push({ date: dates.anniversary, text: '🎂 Годовщина' });
    if (dates.birthdayYakub) events.push({ date: dates.birthdayYakub, text: '🎂 День рождения Якуба' });
    if (dates.birthdaySonya) events.push({ date: dates.birthdaySonya, text: '🎂 День рождения Сони' });

    data.history.forEach(h => {
        if (h.text.includes('🏆')) events.push({ date: h.date, text: h.text });
    });

    events.sort((a, b) => a.date.localeCompare(b.date));

    let html = '';
    if (events.length === 0) {
        html = '<p style="color:#7f3f4a;">Нет событий</p>';
    } else {
        events.forEach(e => {
            html += `<div class="history-item"><span>${e.text}</span><span class="date">${e.date}</span></div>`;
        });
    }
    container.innerHTML = html;
}

// ============ ДАТЫ ============
function renderDates() {
    const container = document.getElementById('datesContainer');
    const d = data.importantDates;
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="date-input-group">
                <label>День знакомства</label>
                <input type="date" value="${d.meeting}" id="dateMeeting" class="input-field">
            </div>
            <div class="date-input-group">
                <label>Годовщина</label>
                <input type="date" value="${d.anniversary}" id="dateAnniversary" class="input-field">
            </div>
            <div class="date-input-group">
                <label>День рождения Якуба</label>
                <input type="date" value="${d.birthdayYakub}" id="dateBYakub" class="input-field">
            </div>
            <div class="date-input-group">
                <label>День рождения Сони</label>
                <input type="date" value="${d.birthdaySonya}" id="dateBSonya" class="input-field">
            </div>
            <button class="btn btn-primary" onclick="saveDates()">Сохранить даты</button>
        </div>
    `;
}

async function saveDates() {
    const meeting = document.getElementById('dateMeeting').value;
    const anniversary = document.getElementById('dateAnniversary').value;
    const birthdayYakub = document.getElementById('dateBYakub').value;
    const birthdaySonya = document.getElementById('dateBSonya').value;

    await fetch(`${API_URL}/dates/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting, anniversary, birthdayYakub, birthdaySonya })
    });
    await loadData();
}

// ============ ИСТОРИЯ ============
function renderHistory() {
    const container = document.getElementById('historyContainer');
    const sorted = [...data.history].reverse().slice(0, 50);
    let html = '';
    sorted.forEach(h => {
        html += `<div class="history-item"><span>${h.text}</span><span class="date">${h.date}</span></div>`;
    });
    container.innerHTML = html || '<p style="color:#7f3f4a;">История пуста</p>';
}

// ============ ЦЕЛИ ============
function renderGoals() {
    const container = document.getElementById('goalsContainer');
    let html = '';
    data.goals.forEach((goal, idx) => {
        const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
        html += `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
                    <strong>${goal.name}</strong>
                    <span>${goal.current} / ${goal.target} 🪙</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percent}%;">${percent}%</div>
                </div>
                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                    <input type="number" id="goalInput_${idx}" value="${goal.current}" style="width:120px;padding:6px 12px;border:2px solid #f0c0c9;border-radius:30px;">
                    <button class="btn btn-primary" onclick="updateGoal(${idx})">Обновить</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function updateGoal(idx) {
    const input = document.getElementById(`goalInput_${idx}`);
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 0) {
        await fetch(`${API_URL}/goals/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: idx, current: val })
        });
        await loadData();
    }
}

// ============ ДОСТИЖЕНИЯ ============
function renderAchievements() {
    const container = document.getElementById('achievementsContainer');
    let html = '<div class="achievement-grid">';
    data.achievements.forEach(a => {
        const cls = a.unlocked ? '' : 'locked';
        html += `
            <div class="achievement-item ${cls}">
                <div class="emoji">${a.emoji}</div>
                <div>${a.name}</div>
                <div style="font-size:0.7rem;color:#888;">${a.unlocked ? '✅' : '🔒'}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ============ СТАТИСТИКА ============
function renderStatsPage() {
    const container = document.getElementById('statsContainer');
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="stat-item"><strong>✅ Выполнено заданий:</strong> ${data.totalTasksCompleted}</div>
            <div class="stat-item"><strong>🪙 Заработано монет:</strong> ${data.totalCoinsEarned}</div>
            <div class="stat-item"><strong>🎁 Куплено событий:</strong> ${data.totalPurchases}</div>
            <div class="stat-item"><strong>🔥 Серия:</strong> ${data.streak} дней</div>
        </div>
    `;
}