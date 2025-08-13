const ApproverDashboard = {
  props: ['approverName'],
  
  template: `
  <div>
    <div v-if="!showSuccessScreen && !selectedDocument">
      <div v-if="filesToUpload.length === 0">
        <div v-if="currentView === 'upload'" class="send-section-initial">
          <h2 class="section-title">Отправка на согласование</h2>
          <div class="drop-zone" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
            <p>Перетащите файл сюда или</p>
            <button @click="triggerFileInput" class="btn-secondary">+ Добавить файл</button>
          </div>
        </div>
        <div v-if="currentView === 'status'">
          <h2>Статус счетов</h2>
          <div v-if="isLoadingStatus"><p>Загрузка...</p></div>
          <ul v-else class="doc-list">
            <li v-for="doc in allDocuments" :key="doc.id">
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
        <div v-if="currentView === 'approve'">
          <h2>Согласование счетов</h2>
          <div v-if="approverName" class="approver-info">
            Согласующий: <strong>{{ approverName }}</strong>
          </div>
          
          <div v-if="isLoading"><p>Загрузка...</p></div>
          <ul v-else class="doc-list">
            <li v-for="doc in pendingDocuments" :key="doc.id" @click="selectDocument(doc)" class="clickable-doc">
              <div class="doc-info">
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-details">{{ doc.date }}</span>
                <span class="doc-amount">{{ formatAmount(doc.amount) }}</span>
                <span class="doc-organization" v-if="doc.organization">{{ doc.organization }}</span>
              </div>
              <div class="status-container">
                <div class="current-status">
                  <span class="my-status" :class="getMyStatusClass(doc)">
                    {{ getMyStatusText(doc) }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
          
          <div v-if="!isLoading && pendingDocuments.length === 0" class="no-documents">
            <p>Нет документов для согласования</p>
          </div>
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
          <button @click="currentView = 'upload'" :class="{ active: currentView === 'upload' }">
            📤 <span>Загрузка</span>
          </button>
          <button @click="switchToStatus" :class="{ active: currentView === 'status' }">
            📊 <span>Статус</span>
          </button>
          <button @click="switchToApprove" :class="{ active: currentView === 'approve' }">
            ✅ <span>Согласование</span>
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

    <div v-else-if="showSuccessScreen" class="success-screen-container">
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

    <div v-else class="document-review">
      <div class="review-header">
        <button @click="backToList" class="btn-back">← Назад</button>
        <h3>Согласование документа</h3>
      </div>
      
      <div class="document-details">
        <div class="doc-name">{{ selectedDocument.name }}</div>
        <div class="doc-details">{{ selectedDocument.date }}</div>
        <div class="doc-amount">{{ formatAmount(selectedDocument.amount) }}</div>
        <div class="doc-organization" v-if="selectedDocument.organization">{{ selectedDocument.organization }}</div>
      </div>

      <div class="review-section">
        <h4>Ваше решение:</h4>
        <div class="decision-buttons">
          <button 
            @click="setDecision('Согласовано')" 
            :class="['btn-decision', 'btn-approve', { active: decision === 'Согласовано' }]"
          >
            Согласовать
          </button>
          <button 
            @click="setDecision('Отказано')" 
            :class="['btn-decision', 'btn-reject', { active: decision === 'Отказано' }]"
          >
            Отказать
          </button>
        </div>
        
        <div v-if="decision" class="comment-section">
          <label for="comment">Комментарий:</label>
          <textarea 
            id="comment"
            v-model="comment" 
            :placeholder="getCommentPlaceholder()"
            rows="4"
          ></textarea>
        </div>
        
        <div v-if="decision" class="submit-section">
          <button @click="submitDecision" :disabled="isSubmitting" class="btn-main">
            {{ isSubmitting ? 'Отправка...' : 'Отправить решение' }}
          </button>
        </div>
      </div>
      
      <div v-if="message" class="message" :style="{ color: messageColor }">
        {{ message }}
      </div>
    </div>
  </div>
  `,

  data() {
    return {
      currentView: 'upload', // 'upload', 'status', 'approve'
      documents: [],
      allDocuments: [],
      selectedDocument: null,
      decision: '',
      comment: '',
      isLoading: false,
      isLoadingStatus: false,
      isSubmitting: false,
      isUploading: false,
      message: '',
      messageColor: 'green',
      // Upload functionality
      filesToUpload: [],
      uploadComment: '',
      uploadMessage: '',
      uploadMessageColor: 'green',
      showSuccessScreen: false,
      sentFilesCount: 0,
      // API URLs
      getPendingInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-pending-invoices',
      getAllInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-invoices',
      submitDecisionWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/submit-decision',
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      },
      messageTimer: null
    };
  },

  computed: {
    pendingDocuments() {
      // Показываем все документы, бэкенд сам отфильтрует нужные для текущего аппрувера
      return this.documents || [];
    }
  },

  methods: {
    // Upload functionality methods
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
    
    closeSuccessScreen() {
      this.showSuccessScreen = false;
      this.sentFilesCount = 0;
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
    },
    cancelUpload() {
      this.filesToUpload = [];
      this.uploadComment = '';
      this.setUploadMessage('Загрузка отменена', 'red');
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
          this.setUploadMessage(`Ошибка отправки файла: ${file.name}`, 'red');
          this.isUploading = false;
          return;
        }
      }
      this.sentFilesCount = this.filesToUpload.length;
      this.filesToUpload = [];
      this.uploadComment = '';
      this.isUploading = false;
      this.showSuccessScreen = true;
    },
    
    setUploadMessage(message, color = 'black') {
      this.uploadMessage = message;
      this.uploadMessageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => { this.uploadMessage = ''; }, 3000);
    },
    
    // Status view methods
    getPersonStatus(doc, person) {
      const statusField = `Статус ${person}`;
      const status = doc[statusField] || "";
      
      if (status === "Согласовано") {
        return 'status-active-approved';
      } else if (status === "Отказано") {
        return 'status-active-rejected';
      } else {
        return 'status-active-empty';
      }
    },
    
    getPersonTitle(doc, person) {
      const statusField = `Статус ${person}`;
      const status = doc[statusField] || "Не рассмотрено";
      return `${person}: ${status}`;
    },
    
    async fetchAllDocuments() {
      this.isLoadingStatus = true;
      try {
        const response = await fetch(this.getAllInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.allDocuments = data;
      } catch (error) {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoadingStatus = false;
      }
    },
    
    switchToStatus() {
      this.currentView = 'status';
      this.fetchAllDocuments();
    },
    
    switchToApprove() {
      this.currentView = 'approve';
      this.fetchDocuments();
    },
    
    // Approval functionality methods
    formatAmount(amount) {
      if (!amount) return '';
      return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
    },
    
    getMyStatusText(doc) {
      // Показываем общий статус документа или "Не рассмотрено"
      return 'Не рассмотрено';
    },
    
    getMyStatusClass(doc) {
      // Всегда показываем как pending, так как статус определяется бэкендом
      return 'status-pending';
    },
    
    selectDocument(doc) {
      this.selectedDocument = doc;
      this.decision = '';
      this.comment = '';
      this.message = '';
    },
    
    backToList() {
      this.selectedDocument = null;
      this.decision = '';
      this.comment = '';
      this.message = '';
      this.fetchDocuments();
    },
    
    setDecision(newDecision) {
      this.decision = newDecision;
    },
    
    getCommentPlaceholder() {
      if (this.decision === 'Согласовано') {
        return 'Комментарий к согласованию (необязательно)';
      } else if (this.decision === 'Отказано') {
        return 'Укажите причину отказа';
      }
      return '';
    },
    
    async submitDecision() {
      if (!this.decision) {
        this.setMessage('Выберите решение', 'red');
        return;
      }
      
      if (this.decision === 'Отказано' && !this.comment.trim()) {
        this.setMessage('При отказе необходимо указать причину', 'red');
        return;
      }
      
      this.isSubmitting = true;
      try {
        const requestData = {
          document_id: this.selectedDocument.id,
          approver: "approver", // Бэкенд сам определит конкретного аппрувера
          decision: this.decision,
          comment: this.comment,
          tg_data: window.Telegram.WebApp.initData
        };
        
        const response = await fetch(this.submitDecisionWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        if (result.success) {
          this.setMessage('Решение успешно отправлено', 'green');
          setTimeout(() => {
            this.backToList();
          }, 1500);
        } else {
          this.setMessage(result.message || 'Ошибка при отправке решения', 'red');
        }
      } catch (error) {
        this.setMessage('Ошибка сети при отправке решения', 'red');
      } finally {
        this.isSubmitting = false;
      }
    },
    
    setMessage(message, color = 'black') {
      this.message = message;
      this.messageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => { this.message = ''; }, 3000);
    },
    
    async fetchDocuments() {
      this.isLoading = true;
      try {
        const response = await fetch(this.getPendingInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.documents = data || [];
      } catch (error) {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  },

  mounted() {
    this.fetchDocuments();
  }
};
