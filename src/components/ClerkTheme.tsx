import { dark } from '@clerk/themes';
import { type Theme } from '@clerk/types';

export const clerkTheme: Theme = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#3B82F6', // blue-500
    colorTextOnPrimaryBackground: 'white',
    colorBackground: '#111827', // gray-900
    colorInputBackground: '#1F2937', // gray-800
    colorInputText: 'white',
    colorTextSecondary: '#93C5FD', // blue-200
    borderRadius: '0.5rem',
  },
  elements: {
    formButtonPrimary: {
      backgroundColor: '{variables.colorPrimary}',
      backgroundImage: 'linear-gradient(to right, {variables.colorPrimary}, #14B8A6)', // blue-500 to teal-500
      '&:hover': {
        backgroundImage: 'linear-gradient(to right, #2563EB, #0D9488)', // blue-600 to teal-600
        transform: 'scale(1.05)',
        transition: 'all 0.3s ease',
      },
    },
    card: {
      backgroundColor: '{variables.colorInputBackground}',
      border: '1px solid rgba(59, 130, 246, 0.2)', // blue-400/20
      backdropFilter: 'blur(8px)',
    },
    socialButtonsIconButton: {
      backgroundColor: '{variables.colorInputBackground}',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      '&:hover': {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        transform: 'scale(1.05)',
        transition: 'all 0.3s ease',
      },
    },
    formField: {
      borderColor: 'rgba(59, 130, 246, 0.2)',
      backgroundColor: '{variables.colorInputBackground}',
      borderRadius: '{variables.borderRadius}',
    },
    footer: {
      '& + button': {
        color: '{variables.colorTextSecondary}',
        '&:hover': {
          color: '#BFDBFE',
        },
      },
    },
  },
};
