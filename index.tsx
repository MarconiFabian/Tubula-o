import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('Isometrico Manager: Entry point reached.');

// Global error handler for critical initialization failures
window.onerror = function(message, source, lineno, colno, error) {
  console.error("CRITICAL ERROR:", message, error);
  const root = document.getElementById('root');
  if (root && (root.innerHTML === '' || root.innerHTML.includes('Loading'))) {
    root.innerHTML = `
      <div style="background: #020617; color: #f87171; padding: 20px; font-family: monospace; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 4px solid #ef4444;">
        <h1 style="color: white; font-size: 24px; margin-bottom: 10px;">Erro Crítico de Inicialização</h1>
        <p style="color: #94a3b8; margin-bottom: 20px;">O aplicativo falhou ao carregar ou encontrou um erro fatal.</p>
        <div style="background: #0f172a; padding: 20px; border-radius: 12px; max-width: 90%; overflow: auto; text-align: left; font-size: 11px; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="color: #ef4444; font-weight: bold; margin-bottom: 8px;">DETALHES DO ERRO:</div>
          <div style="color: #cbd5e1; white-space: pre-wrap;">${message}</div>
          <div style="color: #64748b; margin-top: 12px; font-size: 10px;">${error?.stack || 'Sem stack trace disponível'}</div>
        </div>
        <div style="margin-top: 30px; display: flex; gap: 15px;">
          <button onclick="localStorage.clear(); location.reload();" style="background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: bold; font-family: sans-serif; transition: all 0.2s;">Limpar Cache e Recarregar</button>
          <button onclick="location.reload();" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: bold; font-family: sans-serif; transition: all 0.2s;">Tentar Novamente</button>
        </div>
        <p style="margin-top: 20px; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Isometrico Manager v2.5</p>
      </div>
    `;
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);