import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ui';
import { WalletProvider } from './lib/wallet';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WalletProvider>
  </React.StrictMode>,
);
