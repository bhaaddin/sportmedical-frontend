// CGM MEDISTAR Form Validation Utils

export const czechPhoneRegex = /^(\+420)? ?[0-9]{3} ?[0-9]{3} ?[0-9]{3}$/;
export const validatePhone = (phone: string): boolean => czechPhoneRegex.test(phone.replace(/\s/g, ''));

export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const validateEmail = (email: string): boolean => emailRegex.test(email);

export const validateRodneCislo = (rc: string): boolean => {
  const cleaned = rc.replace(/\//g, '');
  if (!/^\d{9,10}$/.test(cleaned)) return false;
  return parseInt(cleaned) % 11 === 0;
};

export const validateICO = (ico: string): boolean => {
  if (!/^\d{8}$/.test(ico)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += parseInt(ico[i]) * weights[i];
  return sum % 11 === 0;
};

export const validateDIC = (dic: string): boolean => {
  if (!/^CZ\d{8,10}$/.test(dic)) return false;
  return validateICO(dic.substring(2));
};

export const validateInsuranceNumber = (number: string): boolean => /^\d{9,10}$/.test(number.replace(/\s/g, ''));

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Heslo musí mít alespoň 8 znaků');
  if (!/[A-Z]/.test(password)) errors.push('Heslo musí obsahovat alespoň jedno velké písmeno');
  if (!/[a-z]/.test(password)) errors.push('Heslo musí obsahovat alespoň jedno malé písmeno');
  if (!/[0-9]/.test(password)) errors.push('Heslo musí obsahovat alespoň jednu číslici');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Heslo musí obsahovat alespoň jeden speciální znak');
  return { isValid: errors.length === 0, errors };
};

export const validateDate = (date: string, options?: { minDate?: Date; maxDate?: Date; required?: boolean }): string | undefined => {
  if (!date && options?.required) return 'Datum je povinné';
  if (!date) return undefined;
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Neplatné datum';
  if (options?.minDate && dateObj < options.minDate) return `Datum musí být po ${options.minDate.toLocaleDateString('cs-CZ')}`;
  if (options?.maxDate && dateObj > options.maxDate) return `Datum musí být před ${options.maxDate.toLocaleDateString('cs-CZ')}`;
  return undefined;
};

export const required = (value: any, fieldName = 'Pole'): string | undefined => {
  if (value === undefined || value === null || value === '') return `${fieldName} je povinné`;
  if (Array.isArray(value) && value.length === 0) return `${fieldName} je povinné`;
  return undefined;
};

export const minLength = (min: number, fieldName: string) =>
  (value: string): string | undefined =>
    value && value.length < min ? `${fieldName} musí mít alespoň ${min} znaků` : undefined;

export const maxLength = (max: number, fieldName: string) =>
  (value: string): string | undefined =>
    value && value.length > max ? `${fieldName} může mít maximálně ${max} znaků` : undefined;

export function createValidator<T>(rules: Partial<Record<keyof T, (value: any) => string | undefined>>) {
  return (values: T): Partial<Record<keyof T, string>> => {
    const errors: Partial<Record<keyof T, string>> = {};
    for (const [field, validator] of Object.entries(rules)) {
      const error = validator(values[field as keyof T]);
      if (error) errors[field as keyof T] = error;
    }
    return errors;
  };
}
