import type { WorkStatus } from '../model';
import { statusMessage } from '../status';

interface StatusNoticeProps {
  status: WorkStatus;
  onRetryInitialization: () => void;
  onRetrySave: () => void;
  onDismiss: () => void;
}

export function StatusNotice({ status, onRetryInitialization, onRetrySave, onDismiss }: StatusNoticeProps) {
  const { error } = status;

  return (
    <div className={`notice notice-${status.phase}`} role={status.phase === 'error' ? 'alert' : 'status'} aria-live="polite">
      {error ? (
        <>
          <strong>{status.message}</strong>
          <span>{error.message}</span>
          <span className="notice-actions">
            {error.source === 'initialization' && <button type="button" onClick={onRetryInitialization}>重试</button>}
            {error.source === 'save' && <button type="button" onClick={onRetrySave}>重试保存</button>}
            {error.source !== 'save' && <button type="button" onClick={onDismiss}>关闭提示</button>}
          </span>
        </>
      ) : (
        <span>{statusMessage(status)}</span>
      )}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <section className="empty-state loading-state" aria-busy="true">
      <div className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </section>
  );
}
