import { type ReactNode, useRef, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';

interface ScreenShellProps {
  title: string;
  onTitleChange?: (value: string) => void;
  onTitleBlur?: () => void;
  titleDefault?: string;
  titlePlaceholder?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}

export function ScreenShell({ title, onTitleChange, onTitleBlur, titleDefault, titlePlaceholder, headerRight, onBack, children }: ScreenShellProps) {
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
    'screen-shell__title',
    'screen-shell__title--editable',
    isEmpty ? 'screen-shell__title--empty' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="screen-shell">
      <div className="screen-shell__header">
        {showBack && (
          <button className="screen-shell__back" onClick={() => onBack ? onBack() : pop()}>
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
          <span className="screen-shell__title">{title}</span>
        )}
        {headerRight && (
          <span className="screen-shell__header-right">{headerRight}</span>
        )}
      </div>
      <div className="screen-shell__content">
        {children}
      </div>
    </div>
  );
}
