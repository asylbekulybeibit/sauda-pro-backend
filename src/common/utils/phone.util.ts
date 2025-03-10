export const normalizePhoneNumber = (phone: string): string => {
  // Удаляем все нецифровые символы
  const normalized = phone.replace(/\D/g, '');

  // Если номер начинается с 8, заменяем на 7
  if (normalized.startsWith('8')) {
    return '+7' + normalized.slice(1);
  }

  // Если номер начинается с 7, добавляем +
  if (normalized.startsWith('7')) {
    return '+' + normalized;
  }

  // В остальных случаях добавляем +7
  return '+7' + normalized;
};
