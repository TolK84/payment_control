const app = Vue.createApp({
    data() {
        return {
            authState: 'checking',
            userRole: '',
            login: '',
            password: '',
            message: '',
            messageColor: 'red',
            isLoading: false,
            checkAuthWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/check-auth',
            loginWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/login',
            isDesktop: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.platform === 'tdesktop' : false,
            isFullscreen: false
        };
    },
    methods: {
        toggleFullscreen() {
            const tg = window.Telegram?.WebApp;
            if (!tg) return;

            if (this.isFullscreen) {
                tg.exitFullscreen();
            } else {
                tg.requestFullscreen();
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

                if (result.status === 'authenticated') {
                    this.authState = 'authenticated';
                    this.userRole = result.role;
                } else {
                    this.authState = 'unauthenticated';
                }
            } catch (error) {
                this.authState = 'unauthenticated';
                this.message = 'Ошибка сети при проверке.';
            }
        },
        async processLogin() {
            this.isLoading = true;
            this.message = 'Проверка...';
            this.messageColor = 'black';

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

                if (result.status === 'success') {
                    this.authState = 'authenticated';
                    this.userRole = result.role;
                } else {
                    this.message = result.message || 'Неверный логин или пароль.';
                    this.messageColor = 'red';
                    this.isLoading = false;
                }
            } catch (error) {
                this.message = 'Ошибка сети. Попробуйте снова.';
                this.messageColor = 'red';
                this.isLoading = false;
            }
        }
    },
    mounted() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        tg.ready();
        this.checkAuthentication();

        this.isFullscreen = tg.isFullscreen;

        tg.onEvent('viewportChanged', () => {
            this.isFullscreen = tg.isFullscreen;
        });
    }
});

app.component('user-dashboard', UserDashboard);
app.component('admin-dashboard', AdminDashboard);

app.mount('#app');
