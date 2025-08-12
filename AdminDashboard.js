const AdminDashboard = {
  template: `
  <div>
    <div v-if="!showSuccessScreen">
      <div v-if="filesToUpload.length === 0">
        <div v-if="!showingDocumentList" class="send-section-initial">
          <h2 class="section-title">Отправка на согласование</h2>
          <div class="drop-zone" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
            <p>Перетащите файл сюда или</p>
            <button @click="triggerFileInput" class="btn-secondary">+ Добавить файл</button>
          </div>
        </div>
        <div v-if="showingDocumentList">
          <h2>Статус счетов</h2>
          <div v-if="isLoading"><p>Загрузка...</p></div>
          <ul v-else class="doc-list">
            <li v-for="doc in documents" :key="doc.id">
              <div>
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-details">Дата: {{ doc.date }}</span>
              </div>
              <div class="status-container">
                <span class="doc-status" :class="doc.status">{{ statusLabels[doc.status] || doc.status }}</span>
                <div class="status-indicators">
                  <div class="status-square" :class="getWorkflowStatus(doc, 'empty')" title="Пустой статус"></div>
                  <div class="status-square" :class="getWorkflowStatus(doc, 'approved')" title="Есть согласования"></div>
                  <div class="status-square" :class="getWorkflowStatus(doc, 'rejected')" title="Есть отказы"></div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-else class="files-selected-view">
        <div class="drop-zone compact" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
          <button @click="triggerFileInput" class="btn-secondary">+ Добавить еще файлы</button>
        </div>
        <div class="content-area">
          <p v-if="uploadMessage" :style="{ color: uploadMessageColor, textAlign: 'center' }">{{ uploadMessage }}</p>
          <div class="comment-area">
            <textarea 
              v-model="uploadComment" 
              placeholder="Добавьте комментарий к отправляемым файлам..."
            ></textarea>
          </div>
          <ul class="doc-list">
            <li v-for="(file, index) in filesToUpload" :key="file.name + index">
              <span>{{ file.name }}</span>
              <span class="file-status">готов к отправке</span>
            </li>
          </ul>
        </div>
      </div>

      <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" accept="image/*,application/pdf" multiple>

      <div class="bottom-navigation">
        <div v-if="filesToUpload.length === 0" class="navigation">
          <button @click="showingDocumentList = false" :class="{ active: !showingDocumentList }">Отправить</button>
          <button @click="fetchDocuments" :class="{ active: showingDocumentList }">Статус счетов</button>
        </div>
        <div v-else class="bottom-actions">
          <button @click="sendFiles" :disabled="isUploading" class="btn-main">
            {{ isUploading ? 'Отправка...' : 'Отправить на согласование' }}
          </button>
          <button @click="cancelUpload" class="btn-cancel-wide">
            Отмена
          </button>
        </div>
      </div>
    </div>

    <div v-else class="success-screen-container">
      <div class="success-content">
        <svg class="success-icon" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="25" fill="#4CAF50"/>
          <path fill="none" stroke="#FFFFFF" stroke-width="3" d="M14 27l5.917 5.917L38 18"/>
        </svg>
        <p class="success-message">
          {{ getSuccessMessage() }}
        </p>
      </div>
      <div class="bottom-navigation">
        <div class="bottom-actions">
          <button @click="closeSuccessScreen" class="btn-main">OK</button>
        </div>
      </div>
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
      uploadMessage: '',
      uploadMessageColor: 'green',
      filesToUpload: [],
      isUploading: false,
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      },
      messageTimer: null,
      showSuccessScreen: false,
      sentFilesCount: 0,
      uploadComment: '',
    };
  },

  methods: {
    getSuccessMessage() {
      const count = this.sentFilesCount;
      let word = '';
      
      if (count === 1) {
        word = 'счет';
      } else if (count >= 2 && count <= 4) {
        word = 'счета';
      } else {
        word = 'счетов';
      }
      
      let verb = '';
      if (count === 1) {
        verb = 'успешно отправлен';
      } else {
        verb = 'успешно отправлены';
      }
      
      return `${count} ${word} ${verb} на согласование`;
    },
    getWorkflowStatus(doc, statusType) {
      const status1 = doc["Статус Дамели"] || "";
      const status2 = doc["Статус Даурен Б"] || "";
      
      switch(statusType) {
        case 'empty':
          // Белый квадратик активен, если хотя бы один статус пустой
          return (status1 === "" || status2 === "") ? 'status-active-empty' : 'status-inactive';
        case 'approved':
          // Зеленый квадратик активен, если хотя бы один статус "Согласовано"
          return (status1 === "Согласовано" || status2 === "Согласовано") ? 'status-active-approved' : 'status-inactive';
        case 'rejected':
          // Красный квадратик активен, если хотя бы один статус "Отказано"
          return (status1 === "Отказано" || status2 === "Отказано") ? 'status-active-rejected' : 'status-inactive';
        default:
          return 'status-inactive';
      }
    },
    closeSuccessScreen() {
      this.showSuccessScreen = false;
      this.sentFilesCount = 0;
      this.$emit('files-changed', 0);
    },
    setMessage(message, color = 'black') {
      this.uploadMessage = message;
      this.uploadMessageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => { this.uploadMessage = ''; }, 3000);
    },
    onDragOver() { this.isDragOver = true; },
    onDragLeave() { this.isDragOver = false; },
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      for (let i = 0; i < files.length; i++) { this.addFileToCache(files[i]); }
    },
    triggerFileInput() { this.$refs.fileInput.click(); },
    onFileSelect(event) {
      const files = event.target.files;
      for (let i = 0; i < files.length; i++) { this.addFileToCache(files[i]); }
      event.target.value = '';
    },
    addFileToCache(file) {
      this.filesToUpload.push(file);
      this.$emit('files-changed', this.filesToUpload.length);
    },
    cancelUpload() {
      this.filesToUpload = [];
      this.uploadComment = ''; // Очищаем комментарий при отмене
      this.setMessage('Загрузка отменена', 'red');
      this.$emit('files-changed', this.filesToUpload.length);
    },
    async sendFiles() {
      if (this.filesToUpload.length === 0) return;
      this.isUploading = true;
      const webhookUrl = 'https://h-0084.app.n8n.cloud/webhook/upload-invoice';
      const apiKey = 'super-secret-key-123';
      for (const file of this.filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('comment', this.uploadComment);
        formData.append('tg_data', window.Telegram.WebApp.initData);
        try {
          const response = await fetch(webhookUrl, { method: 'POST', headers: { 'X-N8N-API-Key': apiKey }, body: formData });
          if (!response.ok) { throw new Error('Network response was not ok'); }
        } catch {
          this.setMessage(`Ошибка отправки файла: ${file.name}`, 'red');
          this.isUploading = false;
          return;
        }
      }
      this.sentFilesCount = this.filesToUpload.length;
      this.filesToUpload = [];
      this.uploadComment = ''; // Очищаем комментарий после отправки
      this.isUploading = false;
      this.showSuccessScreen = true;
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
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  }
};