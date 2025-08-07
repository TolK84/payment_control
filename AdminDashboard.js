const AdminDashboard = {
  template: `
    <div>
      <div v-if="!showingDocumentList">
        <h2>Загрузка счета</h2>
        
        <p :style="{ color: uploadMessageColor }" v-if="uploadMessage">{{ uploadMessage }}</p>

        <div 
          class="drop-zone"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          :class="{ 'drag-over': isDragOver }"
        >
          <p>Перетащите файл сюда или</p>
          <button @click="triggerFileInput" class="btn-secondary">+ Добавить файл</button>
          <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" accept="image/*,application/pdf">
        </div>
        
        <button v-if="!isDesktop" @click="takePhoto" class="btn-main mt-15">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          Сделать фото
        </button>
      </div>

      <div v-if="showingDocumentList">
        <h2>Загруженные документы (Все)</h2>
        
        <button @click="redirectToGoogleSheet" class="btn-main" style="margin-bottom: 15px;">
            Перейти в Google Таблицу
        </button>
        
        <div v-if="isLoading">
          <p>Загрузка...</p>
        </div>
        <ul v-else class="doc-list">
          <li v-for="doc in documents" :key="doc.id">
            <div>
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-details">Дата: {{ doc.date }}</span>
            </div>
            <span class="doc-amount">{{ doc.amount }} KZT</span>
          </li>
        </ul>
      </div>

      <div class="navigation">
        <button @click="showingDocumentList = false" :class="{ active: !showingDocumentList }">Загрузить</button>
        <button @click="fetchDocuments" :class="{ active: showingDocumentList }">Посмотреть счета</button>
      </div>

    </div>
  `,
  data() {
    return {
      isDragOver: false,
      showingDocumentList: false,
      documents: [],
      isLoading: false,
      getAllInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-all-invoices',
      googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1GkpFQ275xwCdeKTZ1BaWDL7PVD4L_lz-PyjRDmp4z8Q/edit?gid=0#gid=0',
      isDesktop: window.Telegram.WebApp.platform === 'tdesktop',
      uploadMessage: '',
      uploadMessageColor: 'green'
    }
  },
  methods: {
    onDragOver(event) {
      this.isDragOver = true;
    },
    onDragLeave(event) {
      this.isDragOver = false;
    },
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    onFileSelect(event) {
      const files = event.target.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    },
    takePhoto() {
      this.uploadMessage = 'Функция "Сделать фото" в разработке.';
      this.uploadMessageColor = 'red';
    },
    async uploadFile(file) {
      this.uploadMessage = 'Отправка файла...';
      this.uploadMessageColor = 'black';

      const webhookUrl = 'https://h-0084.app.n8n.cloud/webhook/upload-invoice';
      const apiKey = 'super-secret-key-123';
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tg_data', window.Telegram.WebApp.initData);

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'X-N8N-API-Key': apiKey,
          },
          body: formData,
        });

        if (response.ok) {
          this.uploadMessage = 'Файл успешно отправлен. 👌';
          this.uploadMessageColor = 'green';
        } else {
          this.uploadMessage = 'Ошибка отправки файла.';
          this.uploadMessageColor = 'red';
        }
      } catch (error) {
        this.uploadMessage = 'Ошибка сети при отправке файла.';
        this.uploadMessageColor = 'red';
      }
    },
    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      try {
          const response = await fetch(this.getAllInvoicesWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
          });
          const data = await response.json();
          this.documents = data;
      } catch (error) {
          this.uploadMessage = 'Не удалось загрузить документы.';
          this.uploadMessageColor = 'red';
      } finally {
          this.isLoading = false;
      }
    },
    redirectToGoogleSheet() {
        if (this.googleSheetUrl && this.googleSheetUrl !== 'https://docs.google.com/spreadsheets/d/1GkpFQ275xwCdeKTZ1BaWDL7PVD4L_lz-PyjRDmp4z8Q/edit?gid=191092465#gid=191092465') {
            Telegram.WebApp.openLink(this.googleSheetUrl);
        } else {
            alert('URL Google Таблицы не настроен.');
        }
    }
  }
};