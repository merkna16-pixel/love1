const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'database.json');

function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultDB = {
            users: {
                'Якуб': { password: '01.09', coins: 500 },
                'Соня': { password: '25.08', coins: 500 }
            },
            tasks: [],
            purchases: [],
            importantDates: {
                meeting: '',
                anniversary: '',
                birthdayYakub: '',
                birthdaySonya: ''
            },
            history: [],
            goals: [{ name: 'Поездка', current: 5000, target: 10000 }],
            achievements: [
                { id: 'first_task', name: 'Первое задание', emoji: '🏆', unlocked: false },
                { id: 'ten_tasks', name: '10 заданий', emoji: '🏆', unlocked: false },
                { id: 'hundred_tasks', name: '100 заданий', emoji: '🏆', unlocked: false },
                { id: 'thirty_days', name: '30 дней вместе', emoji: '🏆', unlocked: false },
                { id: 'first_date', name: 'Первое свидание', emoji: '🏆', unlocked: false },
                { id: 'thousand_coins', name: '1000 монет', emoji: '🏆', unlocked: false }
            ],
            totalTasksCompleted: 0,
            totalCoinsEarned: 0,
            totalPurchases: 0,
            startDate: new Date().toISOString().split('T')[0],
            streak: 0,
            lastActiveDate: new Date().toISOString().split('T')[0],
            shop: [
                { name: 'Свидание в кафе', price: 300 },
                { name: 'Купить вкусняшки', price: 150 },
                { name: 'Совместный фильм', price: 100 },
                { name: 'Подарок', price: 500 }
            ]
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
        console.log('✅ База данных создана с товарами');
    }
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

initDB();

// Создаём задания на сегодня, если их нет
const db = readDB();
const today = new Date().toISOString().split('T')[0];
const hasTodayTasks = db.tasks.some(t => t.date === today);
if (!hasTodayTasks) {
    const morning = { id: Date.now() + '_morning', text: '☀️ Пожелать доброе утро', date: today, done: false, confirmed: false, author: null, pending: false };
    const night = { id: Date.now() + '_night', text: '🌙 Пожелать спокойной ночи', date: today, done: false, confirmed: false, author: null, pending: false };
    const extras = ['❤️ Обнять', '🍳 Приготовить завтрак', '🎬 Посмотреть фильм', '🚶 Прогуляться', '💆 Сделать массаж', '☕ Сделать кофе', '📖 Почитать вместе', '🎵 Послушать музыку'];
    const extraTask = { id: Date.now() + '_extra', text: extras[Math.floor(Math.random() * extras.length)], date: today, done: false, confirmed: false, author: null, pending: false };
    db.tasks = [morning, night, extraTask];
    writeDB(db);
    console.log('✅ Задания на сегодня созданы');
}

// ============ API ============

app.get('/api/data', (req, res) => {
    try {
        const db = readDB();
        res.json(db);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка чтения базы данных' });
    }
});

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const db = readDB();
    const user = db.users[login];
    if (user && user.password === password) {
        res.json({ success: true, user: login });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/task/do', (req, res) => {
    const { taskId, user } = req.body;
    const db = readDB();
    const task = db.tasks.find(t => t.id === taskId);
    if (task && !task.done) {
        task.done = true;
        task.author = user;
        task.pending = true;
        task.completedAt = new Date().toISOString();
        db.history.push({
            date: new Date().toISOString().split('T')[0],
            text: `✅ ${user} выполнил(а): "${task.text}"`,
            type: 'task_done'
        });
        writeDB(db);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/task/confirm', (req, res) => {
    const { taskId, user } = req.body;
    const db = readDB();
    const task = db.tasks.find(t => t.id === taskId);
    const REWARD = 10;
    if (task && task.done && !task.confirmed && task.author !== user) {
        task.confirmed = true;
        task.pending = false;
        task.confirmedAt = new Date().toISOString();
        db.users['Якуб'].coins += REWARD;
        db.users['Соня'].coins += REWARD;
        db.totalCoinsEarned += REWARD * 2;
        db.totalTasksCompleted += 1;
        
        if (db.totalTasksCompleted >= 1) {
            const ach = db.achievements.find(a => a.id === 'first_task');
            if (ach && !ach.unlocked) { ach.unlocked = true;
                db.history.push({ date: new Date().toISOString().split('T')[0], text: '🏆 Получено достижение: Первое задание' }); }
        }
        if (db.totalTasksCompleted >= 10) {
            const ach = db.achievements.find(a => a.id === 'ten_tasks');
            if (ach && !ach.unlocked) { ach.unlocked = true;
                db.history.push({ date: new Date().toISOString().split('T')[0], text: '🏆 Получено достижение: 10 заданий' }); }
        }
        if (db.totalTasksCompleted >= 100) {
            const ach = db.achievements.find(a => a.id === 'hundred_tasks');
            if (ach && !ach.unlocked) { ach.unlocked = true;
                db.history.push({ date: new Date().toISOString().split('T')[0], text: '🏆 Получено достижение: 100 заданий' }); }
        }
        if (db.totalCoinsEarned >= 1000) {
            const ach = db.achievements.find(a => a.id === 'thousand_coins');
            if (ach && !ach.unlocked) { ach.unlocked = true;
                db.history.push({ date: new Date().toISOString().split('T')[0], text: '🏆 Получено достижение: 1000 монет' }); }
        }
        db.history.push({
            date: new Date().toISOString().split('T')[0],
            text: `✅ ${user} подтвердил(а): "${task.text}" (+${REWARD}🪙 каждому)`,
            type: 'task_confirm'
        });
        writeDB(db);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/shop/buy', (req, res) => {
    const { itemName, price, buyer, date } = req.body;
    const db = readDB();
    if (db.users[buyer].coins < price) {
        return res.json({ success: false, error: 'Недостаточно монет' });
    }
    db.users[buyer].coins -= price;
    db.purchases.push({ name: itemName, price: price, buyer: buyer, date: date, createdAt: new Date().toISOString() });
    db.totalPurchases += 1;
    if (itemName === 'Свидание в кафе') {
        const ach = db.achievements.find(a => a.id === 'first_date');
        if (ach && !ach.unlocked) { ach.unlocked = true;
            db.history.push({ date: new Date().toISOString().split('T')[0], text: '🏆 Получено достижение: Первое свидание' }); }
    }
    db.history.push({
        date: new Date().toISOString().split('T')[0],
        text: `🎁 ${buyer} купил(а): "${itemName}" (на ${date})`,
        type: 'purchase'
    });
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/goals/update', (req, res) => {
    const { index, current } = req.body;
    const db = readDB();
    if (db.goals[index]) {
        db.goals[index].current = current;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/dates/save', (req, res) => {
    const { meeting, anniversary, birthdayYakub, birthdaySonya } = req.body;
    const db = readDB();
    db.importantDates = { meeting, anniversary, birthdayYakub, birthdaySonya };
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/tasks/reset', (req, res) => {
    const db = readDB();
    const today = new Date().toISOString().split('T')[0];
    db.tasks = db.tasks.filter(t => t.date === today);
    if (db.tasks.length === 0) {
        const morning = { id: Date.now() + '_morning', text: '☀️ Пожелать доброе утро', date: today, done: false,
            confirmed: false, author: null, pending: false };
        const night = { id: Date.now() + '_night', text: '🌙 Пожелать спокойной ночи', date: today, done: false,
            confirmed: false, author: null, pending: false };
        const extras = ['❤️ Обнять', '🍳 Приготовить завтрак', '🎬 Посмотреть фильм', '🚶 Прогуляться', '💆 Сделать массаж',
            '☕ Сделать кофе', '📖 Почитать вместе', '🎵 Послушать музыку'
        ];
        const randomExtra = extras[Math.floor(Math.random() * extras.length)];
        const extraTask = { id: Date.now() + '_extra', text: randomExtra, date: today, done: false, confirmed: false,
            author: null, pending: false };
        db.tasks.push(morning, night, extraTask);
        writeDB(db);
        res.json({ success: true, message: 'Задания созданы' });
    } else {
        res.json({ success: true, message: 'Задания уже есть' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`❤️ Love Server запущен на порту ${PORT}`);
    console.log(`📁 База данных: ${DB_PATH}`);
});
