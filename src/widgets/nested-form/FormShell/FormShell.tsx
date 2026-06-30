import './FormShell.scss';
import { type ReactNode, useRef, useEffect } from 'react';
import { useNavigation } from '@grist-widgets/ui';

interface FormShellProps {
  title: string;
  onTitleChange?: (value: string) => void;
  onTitleBlur?: () => void;
  titleDefault?: string;
  titlePlaceholder?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}

export function FormShell({ title, onTitleChange, onTitleBlur, titleDefault, titlePlaceholder, headerRight, onBack, children }: FormShellProps) {
  const { stack, pop } = useNavigation();
  const showBack = stack.length > 1;
  const editableRef = useRef<HTMLSpanElement>(null);
  const isEmpty = !title.trim();

  // Sync the contentEditable span when title changes externally
  useEffect(() => {
    if (editableRef.current && editableRef.current.textContent !== title) {
      editableRef.current.textContent = title;
    }
  }, [title]);

  const editableClassName = [
    'form-shell__title',
    'form-shell__title--editable',
    isEmpty ? 'form-shell__title--empty' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="form-shell">
      <div className="form-shell__header">
        {showBack && (
          <button className="form-shell__back" onClick={() => onBack ? onBack() : pop()}>
            <span className="material-icons">arrow_back</span>
          </button>
        )}
        {onTitleChange ? (
          <span
            ref={editableRef}
            className={editableClassName}
            contentEditable
            suppressContentEditableWarning
            data-default={titleDefault}
            data-placeholder={titlePlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.currentTarget as HTMLElement).blur();
              }
            }}
            onInput={(e) => onTitleChange(e.currentTarget.textContent ?? '')}
            onBlur={() => onTitleBlur?.()}
            onFocus={(e) => {
              const sel = window.getSelection();
              if (sel && !e.currentTarget.textContent) {
                const range = document.createRange();
                range.setStart(e.currentTarget, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }}
          />
        ) : (
          <span className="form-shell__title">{title}</span>
        )}
        {headerRight && (
          <span className="form-shell__header-right">{headerRight}</span>
        )}
      </div>
      <div className="form-shell__content">
        {children}
      </div>
    </div>
  );
}
