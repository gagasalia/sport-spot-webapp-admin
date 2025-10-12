import { PrimeNGConfig } from 'primeng/api';

export const initializePrimeNGStyleConfig = (config: PrimeNGConfig): (() => void) => {
  return () => {
    config.ripple = true;
    config.inputStyle = 'outlined';
    config.setTranslation({
      accept: 'Confirm',
      reject: 'Cancel'
    });
  };
};
