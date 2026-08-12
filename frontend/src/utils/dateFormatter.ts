export const formatDate = (dateInput: any): string => {
  if (!dateInput) return '';
  
  if (typeof dateInput === 'string') {
    // Strip __raw__ prefix if present
    const cleanInput = dateInput.replace(/^__raw__/, '').trim();

    // Matches YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanInput)) {
      const [year, month, day] = cleanInput.split('-');
      return `${day}/${month}/${year}`;
    }
    // Matches ISO Datetime YYYY-MM-DDTHH:mm:ss...
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanInput)) {
      const d = new Date(cleanInput);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    // If it's already in DD/MM/YYYY or DD/MM/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanInput)) {
      return cleanInput;
    }
    return cleanInput;
  }
  
  if (dateInput instanceof Date) {
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(dateInput);
};
