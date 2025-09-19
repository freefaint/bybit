import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

type State = { hasError: boolean; error: Error | null };

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    // Обновляем state, чтобы при следующем рендере показать запаску
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Тут можно отправить ошибку в Sentry/console/куда угодно
    console.error("💥 Глобальный пиздец:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", color: "red" }}>
          <h1>Что-то пошло не так 😬</h1>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<GlobalErrorBoundary><App /></GlobalErrorBoundary>);
