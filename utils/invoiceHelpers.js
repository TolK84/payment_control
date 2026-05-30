const INVOICE_HELPERS = {
  getSuccessMessage(count) {
    let word;
    if (count === 1) {
      word = 'счет';
    } else if (count >= 2 && count <= 4) {
      word = 'счета';
    } else {
      word = 'счетов';
    }
    const verb = count === 1 ? 'успешно отправлен' : 'успешно отправлены';
    return `${count} ${word} ${verb} на согласование`;
  },

  getPersonStatus(doc, person) {
    const status = doc[`Статус ${person}`] || '';
    if (status === 'Согласовано') return 'status-active-approved';
    if (status === 'Отказано') return 'status-active-rejected';
    if (status === 'Отложено') return 'status-active-postponed';
    return 'status-active-empty';
  },

  getPersonTitle(doc, person) {
    const status = doc[`Статус ${person}`] || 'Не рассмотрено';
    return `${person}: ${status}`;
  },

  formatAmount(amount) {
    if (!amount) return '';
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
  },

  getDocumentWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'счет';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'счета';
    return 'счетов';
  },

  filterDocumentsByPeriod(documents, period) {
    if (period === 'all') return documents;
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    if (period === 'week') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (period === 'month') {
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    }
    return documents.filter(doc => {
      if (!doc.date) return false;
      const docDate = new Date(doc.date);
      if (isNaN(docDate.getTime())) return true;
      docDate.setHours(0, 0, 0, 0);
      return docDate >= cutoffDate;
    });
  }
};
