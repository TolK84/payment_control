const UserDashboard = {
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
                <div class="status-person">
                  <span class="person-name">Дамели</span>
                  <div class="status-square" :class="getPersonStatus(doc, 'Дамели')" :title="getPersonTitle(doc, 'Дамели')"></div>
                </div>
                <div class="status-person">
                  <span class="person-name">Даурен Б</span>
                  <div class="status-square" :class="getPersonStatus(doc, 'Даурен Б')" :title="getPersonTitle(doc, 'Даурен Б')"></div>
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
      getInvoicesWebhookUrl: 'https://n8n.eurasiantech.kz/webhook/get-invoices',
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
      showErrorModal: false,
      errorMessage: '',
      uploadComment: '',
      selectedPeriod: 'week', // По умолчанию за неделю
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
    getPersonStatus(doc, person) {
      const statusField = `Статус ${person}`;
      const status = doc[statusField] || "";

      if (status === "Согласовано") {
        return 'status-active-approved';
      } else if (status === "Отказано") {
        return 'status-active-rejected';
      } else if (status === "Отложено") {
        return 'status-active-postponed';
      } else {
        return 'status-active-empty'; // пустой статус - белый
      }
    },
    getPersonTitle(doc, person) {
      const statusField = `Статус ${person}`;
      const status = doc[statusField] || "Не рассмотрено";
      return `${person}: ${status}`;
    },
    formatAmount(amount) {
      if (!amount) return '';
      return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
    },
    getDocumentWord(count) {
      if (count % 10 === 1 && count % 100 !== 11) {
        return 'счет';
      } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
        return 'счета';
      } else {
        return 'счетов';
      }
    },
    closeSuccessScreen() {
      this.showSuccessScreen = false;
      this.sentFilesCount = 0;
      this.$emit('files-changed', 0);
    },
    setMessage(message, color) {
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
      const webhookUrl = 'https://n8n.eurasiantech.kz/webhook/upload-invoice';
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
      // Background refresh
      this.fetchDocuments();
    },

    filterDocumentsByPeriod(documents, period) {
      if (period === 'all') return documents;

      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0);

      if (period === 'week') {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1);
      }

      return documents.filter(doc => {
        if (!doc.date) return false;
        // Date format "YYYY-MM-DD"
        const docDate = new Date(doc.date);
        if (isNaN(docDate.getTime())) return true;

        docDate.setHours(0, 0, 0, 0);
        return docDate >= cutoffDate;
      });
    },

    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      try {
        const response = await fetch(this.getInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tg_data: window.Telegram.WebApp.initData,
            period: 'all' // Always fetch all
          })
        });
        const data = await response.json();
        this.documents = this.filterDocumentsByPeriod(data, this.selectedPeriod);
      } catch {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  }
};