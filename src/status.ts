import type { ErrorKind, Phase, StatusError } from './model';

/**
 * 工作台状态与提示的唯一事实来源。
 * 各入口只描述"开始 / 成功 / 失败 / 忽略"，不直接拼装 phase、notice、error。
 */
export interface StatusState {
  /** 有异步操作（恢复、导入）正在进行 */
  busy: boolean;
  /** 最近一次普通提示 */
  notice: string;
  /** 尚未处理的错误，一直保留到同类操作成功或用户明确忽略 */
  error: StatusError | null;
}

export const initialStatus: StatusState = { busy: false, notice: '', error: null };

export function beginOperation(status: StatusState, notice: string): StatusState {
  return { ...status, busy: true, notice };
}

export function endOperation(status: StatusState): StatusState {
  return { ...status, busy: false };
}

/** 操作成功：更新提示，只消除 clears 列出的同类错误，无关错误继续保留。 */
export function reportSuccess(status: StatusState, notice: string, clears: ErrorKind[] = []): StatusState {
  const error = status.error && clears.includes(status.error.kind) ? null : status.error;
  return { ...status, notice, error };
}

/** 操作失败：记录错误并保留，直到同类操作成功或用户明确忽略。 */
export function reportFailure(status: StatusState, kind: ErrorKind, message: string): StatusState {
  return { ...status, error: { kind, message } };
}

/** 用户明确处理了当前错误。 */
export function clearError(status: StatusState): StatusState {
  return { ...status, error: null };
}

/** phase 由真实状态推导，任何入口不得另行指定。 */
export function derivePhase(status: StatusState, hasImage: boolean): Phase {
  if (status.busy) return 'loading';
  if (status.error) return 'error';
  return hasImage ? 'editing' : 'ready';
}
