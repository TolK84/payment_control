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
          <div class="filter-section">
            <span class="document-counter">{{ documents.length }} {{ getDocumentWord(documents.length) }}</span>
            <select v-model="selectedPeriod" @change="fetchDocuments" class="period-filter">
              <option value="week">За неделю</option>
              <option value="month">За месяц</option>
              <option value="all">За все время</option>
            </select>
          </div>
          <div v-if="isLoading"><p>Загрузка...</p></div>
          <ul v-else class="doc-list">
            <li v-for="doc in documents" :key="doc.id">
              <div>
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-details">{{ doc.date }}</span>
                <span class="doc-amount">{{ formatAmount(doc.amount) }}</span>
                <span class="doc-organization" v-if="doc.organization">{{ doc.organization }}</span>
              </div>
              <div class="status-container">
                <div class="status-header">Статус</div>
                <div class="status-person" v-for="name in approverNames" :key="name">
                  <span class="person-name">{{ name }}</span>
                  <div class="status-square" :class="getPersonStatus(doc, name)" :title="getPersonTitle(doc, name)"></div>
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
              <div class="file-actions">
                <span class="file-status">готов к отправке</span>
                <button @click="removeFile(index)" class="remove-file-btn" title="Удалить файл">×</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" accept="image/*,application/pdf" multiple>

      <div class="bottom-navigation">
        <div v-if="filesToUpload.length === 0" class="navigation">
          <button @click="showingDocumentList = false" :class="{ active: !showingDocumentList }">
            ⬆️ <span>Отправить</span>
          </button>
          <button @click="fetchDocuments" :class="{ active: showingDocumentList }">
            📋 <span>Статус счетов</span>
          </button>
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

    <!-- Модальное окно ошибки -->
    <div v-if="showErrorModal" class="modal-overlay" @click="closeErrorModal">
      <div class="modal-content" @click.stop>
        <div class="error-icon">⚠️</div>
        <p class="error-text">{{ errorMessage }}</p>
        <button @click="closeErrorModal" class="btn-main">OK</button>
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
      getAllInvoicesWebhookUrl: CONFIG.url('getInvoices'),
      uploadMessage: '',
      uploadMessageColor: 'green',
      filesToUpload: [],
      isUploading: false,
      approverNames: CONFIG.APPROVER_NAMES,
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      },
      messageTimer: null,
      showSuccessScreen: false,
      sentFilesCount: 0,
      showErrorModal: false,
      errorMessage: '',
      uploadComment: '',
      selectedPeriod: 'week', // По умолчанию за неделю
    };
  },

  methods: {
    getSuccessMessage() {
      return INVOICE_HELPERS.getSuccessMessage(this.sentFilesCount);
    },
    getPersonStatus(doc, person) {
      return INVOICE_HELPERS.getPersonStatus(doc, person);
    },
    getPersonTitle(doc, person) {
      return INVOICE_HELPERS.getPersonTitle(doc, person);
    },
    formatAmount(amount) {
      return INVOICE_HELPERS.formatAmount(amount);
    },
    getDocumentWord(count) {
      return INVOICE_HELPERS.getDocumentWord(count);
    },
    closeSuccessScreen() {
      this.showSuccessScreen = false;
      this.sentFilesCount = 0;
      this.$emit('files-changed', 0);
    },
    setMessage(message, color = 'black') {
      if (color === 'red') {
        // Для ошибок показываем модальное окно
        this.errorMessage = message;
        this.showErrorModal = true;
      } else {
        // Для обычных сообщений оставляем старую логику
        this.uploadMessage = message;
        this.uploadMessageColor = color;
        clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => { this.uploadMessage = ''; }, 3000);
      }
    },
    closeErrorModal() {
      this.showErrorModal = false;
      this.errorMessage = '';
      // Возвращаем в дефолтное состояние - очищаем файлы
      this.filesToUpload = [];
      this.uploadComment = '';
      this.isUploading = false;
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
    removeFile(index) {
      this.filesToUpload.splice(index, 1);
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
      const webhookUrl = CONFIG.url('uploadInvoice');
      for (const file of this.filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('comment', this.uploadComment);
        formData.append('tg_data', window.Telegram.WebApp.initData);
        try {
          const response = await fetch(webhookUrl, { method: 'POST', body: formData });
          if (!response.ok) {
            if (response.status === 400) {
              throw new Error('Ошибка. Данный счет уже загружался на согласование.');
            }
            throw new Error('Network response was not ok');
          }
        } catch (error) {
          this.setMessage(error.message, 'red');
          this.isUploading = false;
          return;
        }
      }
      this.sentFilesCount = this.filesToUpload.length;
      this.filesToUpload = [];
      this.uploadComment = ''; // Очищаем комментарий после отправки
      this.isUploading = false;
      this.showSuccessScreen = true;
      // Refresh documents in background if possible
      this.fetchDocuments();
    },

    filterDocumentsByPeriod(documents, period) {
      return INVOICE_HELPERS.filterDocumentsByPeriod(documents, period);
    },

    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      try {
        const response = await fetch(this.getAllInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tg_data: window.Telegram.WebApp.initData,
            period: 'all' // Always fetch all to filter on frontend
          })
        });
        const data = await response.json();
        // Filter on frontend
        this.documents = this.filterDocumentsByPeriod(data, this.selectedPeriod);
      } catch (error) {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  }
};