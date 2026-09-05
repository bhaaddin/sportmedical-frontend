// CGM MEDISTAR Color System
// Medical-grade color palette with WCAG 2.2 AA compliance

export const colors = {
  // Primary brand colors
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#1976D2',
    600: '#1565C0',
    700: '#0D47A1',
    800: '#0A3A8A',
    900: '#062B6B',
  },

  // Secondary accent colors
  secondary: {
    50: '#F3E5F5',
    100: '#E1BEE7',
    200: '#CE93D8',
    300: '#BA68C8',
    400: '#AB47BC',
    500: '#7B1FA2',
    600: '#6A1B9A',
    700: '#4A148C',
    800: '#38006B',
    900: '#2A0054',
  },

  // Medical semantic colors
  medical: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },

  // Clinical status colors
  status: {
    scheduled: '#2196F3',
    confirmed: '#FF9800',
    'in-progress': '#9C27B0',
    completed: '#4CAF50',
    cancelled: '#F44336',
    overdue: '#FF5722',
    paid: '#4CAF50',
    pending: '#FF9800',
    draft: '#9E9E9E',
  },

  // Neutrals
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Background shades
  background: {
    default: '#FAFAFA',
    paper: '#FFFFFF',
    subtle: '#F5F5F5',
    muted: '#EEEEEE',
    dark: '#121212',
    darkPaper: '#1E1E1E',
    darkSubtle: '#2D2D2D',
  },

  // Text colors
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#9E9E9E',
    hint: '#BDBDBD',
    inverse: '#FFFFFF',
    link: '#1976D2',
    linkHover: '#1565C0',
  },

  // Border colors
  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#757575',
    focus: '#1976D2',
    error: '#F44336',
    success: '#4CAF50',
  },
};

// Role-specific colors for staff avatars
export const roleColors: Record<string, string> = {
  Admin: '#F44336',
  HeadPhysician: '#9C27B0',
  Doctor: '#2196F3',
  Nurse: '#4CAF50',
  Receptionist: '#FF9800',
};

// Service type colors for calendar
export const serviceColors: Record<string, string> = {
  consultation: '#2196F3',
  examination: '#4CAF50',
  treatment: '#FF9800',
  emergency: '#F44336',
  followup: '#9C27B0',
  physiotherapy: '#00BCD4',
  vaccination: '#8BC34A',
  labwork: '#FF5722',
};

// Priority colors
export const priorityColors: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44336',
  urgent: '#D32F2F',
};
