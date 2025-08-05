const UserDashboard = {
  template: `
    <div>
      <div v-if="!showingDocumentList">
        <h2>Загрузка счета</h2>
        
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
        
        <button @click="takePhoto" class="btn-main mt-15">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          Сделать фото
        </button>

      </div>

      <div v-if="showingDocumentList">
        <h2>Загруженные документы</h2>
        <pre v-if="debugData" style="background-color: #eee; border: 1px solid #ccc; padding: 10px; text-align: left; white-space: pre-wrap; word-break: break-all;">{{ JSON.stringify(debugData, null, 2) }}</pre>
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
        <button @click="fetchDocuments" :class="{ active: showingDocumentList }">Посмотреть</button>
      </div>

    </div>
  `,
  data() {
    return {
      isDragOver: false,
      showingDocumentList: false,
      documents: [],
      isLoading: false,
      getInvoicesWebhookUrl: 'https://tty34.app.n8n.cloud/webhook/get-invoices',
      debugData: null
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
      alert('Функция "Сделать фото" в разработке.');
    },
    uploadFile(file) {
      alert('Отправка файла: ' + file.name);
    },
    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      this.debugData = null;
      try {
        const response = await fetch(this.getInvoicesWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.debugData = data;
        this.documents = data;
      } catch (error) {
        this.debugData = { error: error.message };
        alert('Не удалось загрузить документы.');
      } finally {
        this.isLoading = false;
      }
    },
    getStatusText(status) {
        const statuses = {
            'approved': 'Согласован',
            'pending': 'В обработке',
            'rejected': 'Отклонен'
        };
        return statuses[status] || 'Неизвестно';
    }
  }
};

