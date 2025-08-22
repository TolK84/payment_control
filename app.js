// filepath: d:\Git\payment_control\app.js
const app = Vue.createApp({
    data() {
        return {
            authState: 'checking', 
            userRole: '',
            userName: '',
            login: '',
            password: '',
            message: '',
            messageColor: 'green', // Устанавливаем зеленый по умолчанию
            isLoading: false,
            checkAuthWebhookUrl: 'https://mfs-650.app.n8n.cloud/webhook/check-auth',
            loginWebhookUrl: 'https://mfs-650.app.n8n.cloud/webhook/login',
            isDesktop: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.platform === 'tdesktop' : false,
            hasFiles: false
        }
    },
    methods: {
        handleFilesChanged(count) {
            this.hasFiles = count > 0;
        },
        adjustBottomPadding() {
            const tg = window.Telegram.WebApp;
            if (!tg) return;

            const platform = tg.platform;
            const bottomNav = document.querySelector('.bottom-navigation');
            
            if (bottomNav) {
                if (platform === 'ios') {
                    bottomNav.style.bottom = '50px';
                } else if (platform === 'tdesktop' || platform === 'weba' || platform === 'webk') {
                    bottomNav.style.bottom = '50px';
                } else {
                    bottomNav.style.bottom = '40px';
                }
            }
        },
        async checkAuthentication() {
            try {
                const response = await fetch(this.checkAuthWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
                });
                const result = await response.json();
                
                if (Array.isArray(result) && result.length > 0 && result[0].status === 'активировано') {
                    const user = result[0];
                    
                    let userRole = 'user';
                    if (user.login === 'admin' || user.login === 'tolk') {
                        userRole = 'admin';
                    } else if (user.login === 'dameli' || user.login === 'dauren') {
                        userRole = 'approver';
                    }
                    
                    this.authState = 'authenticated';
                    this.userRole = userRole;
                    this.userName = user.login;
                } else {
                    this.authState = 'unauthenticated';
                }
            } catch (error) {
                this.authState = 'unauthenticated';
            }
        },
        async processLogin() {
            this.isLoading = true;
            this.message = '';
            try {
                const response = await fetch(this.loginWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login: this.login,
                        password: this.password,
                        tg_data: window.Telegram.WebApp.initData
                    })
                });
                
                const result = await response.json();
                
                if (Array.isArray(result) && result.length > 0 && result[0].status === 'активировано') {
                    const user = result[0];
                    this.message = `Добро пожаловать, ${user.login}!`;
                    this.messageColor = 'green';
                    
                    let userRole = 'user';
                    if (user.login === 'admin' || user.login === 'tolk') {
                        userRole = 'admin';
                    } else if (user.login === 'dameli' || user.login === 'dauren') {
                        userRole = 'approver';
                    }
                    
                    setTimeout(() => {
                        this.authState = 'authenticated';
                        this.userRole = userRole;
                        this.userName = user.login;
                        this.message = '';
                        this.isLoading = false;
                    }, 1500);
                } else {
                    this.message = 'Неверный логин или пароль.';
                    this.messageColor = 'red';
                    this.isLoading = false;
                }
            } catch (error) {
                this.message = 'Ошибка сети.';
                this.messageColor = 'red';
                this.isLoading = false;
            }
        }
    },
    mounted() {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            this.checkAuthentication();
            if (!this.isDesktop) {
                tg.expand();
            }

            // Динамическая корректировка отступов для разных платформ
            setTimeout(() => this.adjustBottomPadding(), 100);
        }
    }
});

app.component('user-dashboard', UserDashboard);
app.component('admin-dashboard', AdminDashboard);
app.component('approver-dashboard', ApproverDashboard);

app.mount('#app');
