const API_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
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
            localStorage.setItem('loveUser', result.user);
            window.location.href = '/dashboard.html';
        } else {
            document.getElementById('loginError').textContent = '❌ Неверный логин или пароль';
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('loginError').textContent = '❌ Ошибка подключения к серверу';
        document.getElementById('loginError').style.display = 'block';
    }
}
