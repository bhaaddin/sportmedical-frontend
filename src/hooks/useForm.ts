import { useState, useCallback, useRef } from 'react';

interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void> | void;
  enableReinitialize?: boolean;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
  enableReinitialize = false,
}: UseFormOptions<T>) {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialValuesRef = useRef(initialValues);

  if (enableReinitialize) {
    if (JSON.stringify(initialValuesRef.current) !== JSON.stringify(initialValues)) {
      initialValuesRef.current = initialValues;
      setValuesState(initialValues);
      setErrors({});
      setTouched({});
    }
  }

  const validateForm = useCallback((vals: T) => {
    if (!validate) return {};
    return validate(vals);
  }, [validate]);

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const handleChange = useCallback((field: keyof T) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(field, e.target.value);
  }, [setFieldValue]);

  const handleBlur = useCallback((field: keyof T) => {
    return () => {
      setFieldTouched(field, true);
      const validationErrors = validateForm(values);
      if (validationErrors[field]) setFieldError(field, validationErrors[field]);
    };
  }, [values, validateForm, setFieldTouched, setFieldError]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const allTouched = Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {} as Partial<Record<keyof T, boolean>>);
    setTouched(allTouched);
    const validationErrors = validateForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setIsSubmitting(true);
    try { await onSubmit(values); } finally { setIsSubmitting(false); }
  }, [values, validateForm, onSubmit]);

  const reset = useCallback((newValues?: T) => {
    setValuesState(newValues || initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const getFieldProps = useCallback((field: keyof T) => ({
    name: field as string,
    value: values[field],
    onChange: handleChange(field),
    onBlur: handleBlur(field),
    error: !!touched[field] && !!errors[field],
    helperText: touched[field] ? errors[field] : undefined,
  }), [values, touched, errors, handleChange, handleBlur]);

  const validationErrors = validateForm(values);
  const isValid = Object.keys(validationErrors).length === 0;
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  return {
    values, errors, touched, isSubmitting, isValid, isDirty,
    setFieldValue, setValues, setFieldError, setFieldTouched,
    handleChange, handleBlur, handleSubmit, reset, getFieldProps,
  };
}
