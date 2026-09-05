// Animation keyframes and utilities

export const keyframes = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,
  fadeInUp: `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  fadeInDown: `
    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  slideInLeft: `
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-30px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `,
  slideInRight: `
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `,
  scaleIn: `
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `,
};

export const animations = {
  fadeIn: 'fadeIn 0.3s ease-out',
  fadeInUp: 'fadeInUp 0.4s ease-out',
  fadeInDown: 'fadeInDown 0.4s ease-out',
  slideInLeft: 'slideInLeft 0.3s ease-out',
  slideInRight: 'slideInRight 0.3s ease-out',
  scaleIn: 'scaleIn 0.2s ease-out',
  pulse: 'pulse 2s infinite',
  bounce: 'bounce 1s infinite',
  spin: 'spin 1s linear infinite',
  shake: 'shake 0.5s ease-in-out',
};

export const cssTransitions = {
  fast: 'all 150ms ease-out',
  normal: 'all 300ms ease-out',
  slow: 'all 500ms ease-out',
  spring: 'all 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

export const hoverEffects = {
  lift: {
    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
  },
  glow: {
    transition: 'box-shadow 0.2s ease-out',
    '&:hover': {
      boxShadow: '0 0 20px rgba(25, 118, 210, 0.4)',
    },
  },
  border: {
    transition: 'border-color 0.2s ease-out',
    '&:hover': {
      borderColor: 'primary.main',
    },
  },
  scale: {
    transition: 'transform 0.2s ease-out',
    '&:hover': {
      transform: 'scale(1.02)',
    },
  },
};
