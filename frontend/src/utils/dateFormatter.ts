export const formatDate = (dateInput: any): string => {
  if (!dateInput) return '';
  
  if (typeof dateInput === 'string') {
    // Matches YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-');
      return `${day}/${month}/${year}`;
    }
    // Matches ISO Datetime YYYY-MM-DDTHH:mm:ss...
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateInput)) {
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    return dateInput;
  }
  
  if (dateInput instanceof Date) {
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(dateInput);
};
