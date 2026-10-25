import { CheckCircle2, Info, Loader2, TriangleAlert, X, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';

const KINDS = {
  success: {
    icon: CheckCircle2,
    color: '#34FB34',
    button: 'bg-[#34FB34] text-[#06140A] hover:bg-[#67FF67] focus-visible:ring-[#34FB34]/50',
  },
  error: {
    icon: XCircle,
    color: '#FF2E1F',
    button: 'bg-[#FF2E1F] text-white hover:bg-[#FF5145] focus-visible:ring-[#FF2E1F]/50',
  },
  warning: {
    icon: TriangleAlert,
    color: '#FFBB02',
    button: 'bg-[#FFBB02] text-[#191400] hover:bg-[#FFD400] focus-visible:ring-[#FFBB02]/50',
  },
  info: {
    icon: Info,
    color: '#22D3EE',
    button: 'bg-[#22D3EE] text-[#03171B] hover:bg-[#67E8F9] focus-visible:ring-[#22D3EE]/50',
  },
};

/**
 * The page's replacement for window.alert / window.confirm, and the low-battery
 * notice. Built on the shared Modal so the focus trap, Escape key, backdrop and
 * scroll lock are not reimplemented.
 */
export default function ReportFeedbackDialog({
  open,
  type = 'info',
  title,
  message,
  confirmLabel = 'Acknowledge',
  cancelLabel = 'Cancel',
  showCancel = false,
  onConfirm,
  onClose,
  loading = false,
  danger = false,
  emoji = '',
}) {
  const style = KINDS[type] || KINDS.info;
  const Icon = style.icon;
  const primary = onConfirm || onClose;

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      bare
      className={`font-montserrat max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[26rem] overflow-y-auto rounded-[24px] border bg-gradient-to-br from-[#1E203C] to-[#141527] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.65)] ${
        danger ? 'border-[#FF2E1F]/60' : 'border-white/10'
      }`}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border"
        style={{
          color: style.color,
          background: `${style.color}14`,
          borderColor: `${style.color}45`,
          boxShadow: `0 0 34px ${style.color}45`,
        }}
        aria-hidden="true"
      >
        {emoji ? <span className="text-3xl">{emoji}</span> : <Icon className="h-7 w-7" />}
      </div>

      <h2 className="mt-5 text-xl font-extrabold text-white">{title}</h2>
      {message ? <p className="mx-auto mt-2 max-w-[21rem] text-sm leading-relaxed text-white/55">{message}</p> : null}

      <div className={showCancel ? 'mt-6 grid grid-cols-2 gap-3' : 'mt-6'}>
        {showCancel ? (
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            data-autofocus={showCancel ? 'true' : undefined}
            className="h-11 rounded-xl border border-white/15 bg-white/[0.04] text-sm font-bold text-white/75 transition duration-200 hover:scale-[1.02] hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={primary}
          disabled={loading}
          data-autofocus={showCancel ? undefined : 'true'}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${style.button}`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
