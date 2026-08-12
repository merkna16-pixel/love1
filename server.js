const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============ ПОДКЛЮЧЕНИЕ К SUPABASE ============
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Ошибка: SUPABASE_URL и SUPABASE_KEY должны быть установлены');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============ API ============

// Получить все данные
app.get('/api/data', async (req, res) => {
    try {
        const [users, tasks, purchases, history, goals, achievements, shop] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('tasks').select('*'),
            supabase.from('purchases').select('*'),
            supabase.from('history').select('*'),
            supabase.from('goals').select('*'),
            supabase.from('achievements').select('*'),
            supabase.from('shop').select('*')
        ]);

        const usersMap = {};
        users.data.forEach(u => {
            usersMap[u.name] = { password: u.password, coins: u.coins };
        });

        const data = {
            users: usersMap,
            tasks: tasks.data || [],
            purchases: purchases.data || [],
            history: history.data || [],
            goals: goals.data || [],
            achievements: achievements.data || [],
            shop: shop.data || [],
            totalTasksCompleted: 0,
            totalCoinsEarned: 0,
            totalPurchases: 0,
            startDate: '2024-01-01',
            streak: 0,
            lastActiveDate: new Date().toISOString().split('T')[0]
        };

        res.json(data);
    } catch (error) {
        console.error('Ошибка чтения:', error);
        res.status(500).json({ error: 'Ошибка чтения базы данных' });
    }
});

// Логин
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', login)
        .eq('password', password);

    if (users && users.length > 0) {
        res.json({ success: true, user: login });
    } else {
        res.json({ success: false });
    }
});

// Выполнить задание
app.post('/api/task/do', async (req, res) => {
    const { taskId, user } = req.body;
    const { data: task, error } = await supabase
        .from('tasks')
        .update({ 
            done: true, 
            author: user, 
            pending: true, 
            completed_at: new Date().toISOString() 
        })
        .eq('id', taskId)
        .select();

    if (!error && task && task.length > 0) {
        await supabase.from('history').insert({
            date: new Date().toISOString().split('T')[0],
            text: `✅ ${user} выполнил(а): "${task[0].text}"`,
            type: 'task_done'
        });
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Подтвердить задание
app.post('/api/task/confirm', async (req, res) => {
    const { taskId, user } = req.body;
    const REWARD = 10;

    const { data: task, error } = await supabase
        .from('tasks')
        .update({ 
            confirmed: true, 
            pending: false, 
            confirmed_at: new Date().toISOString() 
        })
        .eq('id', taskId)
        .eq('done', true)
        .eq('confirmed', false)
        .neq('author', user)
        .select();

    if (!error && task && task.length > 0) {
        await supabase.rpc('add_coins', { 
            user1: 'Якуб', 
            user2: 'Соня', 
            amount: REWARD 
        });

        await supabase.from('history').insert({
            date: new Date().toISOString().split('T')[0],
            text: `✅ ${user} подтвердил(а): "${task[0].text}" (+${REWARD}🪙 каждому)`,
            type: 'task_confirm'
        });

        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Купить товар
app.post('/api/shop/buy', async (req, res) => {
    const { itemName, price, buyer, date } = req.body;

    const { data: userData } = await supabase
        .from('users')
        .select('coins')
        .eq('name', buyer);

    if (!userData || userData.length === 0 || userData[0].coins < price) {
        return res.json({ success: false, error: 'Недостаточно монет' });
    }

    await supabase
        .from('users')
        .update({ coins: userData[0].coins - price })
        .eq('name', buyer);

    await supabase.from('purchases').insert({
        name: itemName,
        price: price,
        buyer: buyer,
        date: date,
        created_at: new Date().toISOString()
    });

    await supabase.from('history').insert({
        date: new Date().toISOString().split('T')[0],
        text: `🎁 ${buyer} купил(а): "${itemName}" (на ${date})`,
        type: 'purchase'
    });

    res.json({ success: true });
});

// Обновить цель
app.post('/api/goals/update', async (req, res) => {
    const { index, current } = req.body;
    const { data: goals } = await supabase
        .from('goals')
        .select('id');
    
    if (goals && goals[index]) {
        await supabase
            .from('goals')
            .update({ current: current })
            .eq('id', goals[index].id);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Сохранить важные даты
app.post('/api/dates/save', async (req, res) => {
    const { meeting, anniversary, birthdayYakub, birthdaySonya } = req.body;
    const entries = [];
    if (meeting) entries.push({ date: meeting, text: '❤️ День знакомства', type: 'date' });
    if (anniversary) entries.push({ date: anniversary, text: '🎂 Годовщина', type: 'date' });
    if (birthdayYakub) entries.push({ date: birthdayYakub, text: '🎂 День рождения Якуба', type: 'date' });
    if (birthdaySonya) entries.push({ date: birthdaySonya, text: '🎂 День рождения Сони', type: 'date' });
    
    await supabase.from('history').delete().eq('type', 'date');
    
    if (entries.length > 0) {
        await supabase.from('history').insert(entries);
    }
    
    res.json({ success: true });
});

// Сброс заданий
app.post('/api/tasks/reset', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    await supabase.from('tasks').delete().neq('date', today);

    const { data: existing } = await supabase
        .from('tasks')
        .select('*')
        .eq('date', today);

    if (!existing || existing.length === 0) {
        const extras = ['❤️ Обнять', '🍳 Приготовить завтрак', '🎬 Посмотреть фильм', '🚶 Прогуляться', '💆 Сделать массаж', '☕ Сделать кофе', '📖 Почитать вместе', '🎵 Послушать музыку'];
        const tasks = [
            { id: Date.now() + '_morning', text: '☀️ Пожелать доброе утро', date: today, done: false, confirmed: false, author: null, pending: false },
            { id: Date.now() + '_night', text: '🌙 Пожелать спокойной ночи', date: today, done: false, confirmed: false, author: null, pending: false },
            { id: Date.now() + '_extra', text: extras[Math.floor(Math.random() * extras.length)], date: today, done: false, confirmed: false, author: null, pending: false }
        ];
        await supabase.from('tasks').insert(tasks);
        res.json({ success: true, message: 'Задания созданы' });
    } else {
        res.json({ success: true, message: 'Задания уже есть' });
    }
});

// ============ ФОТО ============

// Загрузить фото
app.post('/api/photos/upload', async (req, res) => {
    const { image, description, author } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('photos')
        .insert({
            image_url: image,
            description: description || '',
            author: author,
            date: today,
            created_at: new Date().toISOString()
        })
        .select();

    if (!error && data) {
        res.json({ success: true, photo: data[0] });
    } else {
        res.json({ success: false, error: error ? error.message : 'Ошибка загрузки' });
    }
});

// Получить все фото
app.get('/api/photos', async (req, res) => {
    const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error) {
        res.json(data || []);
    } else {
        res.json([]);
    }
});

// Получить воспоминание (фото за месяц назад)
app.get('/api/photos/memory', async (req, res) => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const dateStr = monthAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('date', dateStr)
        .limit(1);

    if (!error && data && data.length > 0) {
        res.json(data[0]);
    } else {
        res.json(null);
    }
});

// ============ ЗАПУСК ============
app.listen(PORT, '0.0.0.0', () => {
    console.log(`❤️ Love Server запущен на порту ${PORT}`);
    console.log(`📁 Подключен к Supabase: ${supabaseUrl}`);
});
