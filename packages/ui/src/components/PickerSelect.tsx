import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import './picker-select.scss';

export interface PickerOption {
  value: string;
  label: string;
  /** @deprecated Use fillColor/textColor instead */
  color?: string;
  fillColor?: string;
  textColor?: string;
}

interface CommonProps {
  options: PickerOption[];
  placeholder?: string;
  addLabel?: string;
  onAdd?: () => void;
  /** When provided, shows a "Créer 'xxx'" option for unrecognized search text. */
  onCreate?: (label: string) => void;
  relation?: boolean;
  onClickSelected?: (value: string) => void;
  avatar?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface SingleProps extends CommonProps {
  mode?: 'single';
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

interface MultiProps extends CommonProps {
  mode: 'multi';
  value: string[];
  onChange: (value: string[]) => void;
}

type PickerSelectProps = SingleProps | MultiProps;

/** Build inline style for a color chip from a PickerOption. */
function chipStyle(opt: PickerOption): CSSProperties {
  if (opt.fillColor || opt.textColor) {
    return {
      backgroundColor: opt.fillColor || '#f0f0f0',
      color: opt.textColor || '#333',
    };
  }
  // Legacy single-color fallback
  if (opt.color) {
    return { backgroundColor: `${opt.color}1a`, color: opt.color };
  }
  return { backgroundColor: '#f0f0f0', color: '#333' };
}

function hasColor(opt: PickerOption): boolean {
  return !!(opt.fillColor || opt.textColor || opt.color);
}

export function PickerSelect(props: PickerSelectProps) {
  const { options, placeholder = 'Choisir...', defaultOpen, onClose } = props;
  const isMulti = props.mode === 'multi';

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const canCreate =
    props.onCreate != null &&
    search.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase());

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: 220,
      });
    }
    setOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Open on mount if defaultOpen
  useEffect(() => {
    if (defaultOpen) openDropdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, closeDropdown]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, closeDropdown]);

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const handleSelect = useCallback(
    (value: string) => {
      if (isMulti) {
        const multiProps = props as MultiProps;
        const current = multiProps.value;
        if (current.includes(value)) {
          multiProps.onChange(current.filter((v) => v !== value));
        } else {
          multiProps.onChange([...current, value]);
        }
      } else {
        const singleProps = props as SingleProps;
        singleProps.onChange(value);
        closeDropdown();
      }
    },
    [isMulti, props],
  );

  // Determine what to show in the trigger
  const renderTriggerContent = () => {
    if (isMulti) {
      const multiProps = props as MultiProps;
      if (multiProps.value.length === 0) {
        return <span className="picker-select__placeholder">{placeholder}</span>;
      }
      return (
        <span className="picker-select__chips">
          {multiProps.value.map((v) => {
            const opt = options.find((o) => o.value === v);
            const colored = opt && hasColor(opt);
            if (props.relation) {
              return (
                <span key={v} className="picker-select__relation-chip">
                  {props.onClickSelected && (
                    <span
                      className="material-icons picker-select__relation-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onClickSelected!(v);
                      }}
                    >link</span>
                  )}
                  {opt?.label ?? v}
                </span>
              );
            }
            return (
              <span
                key={v}
                className={colored ? 'picker-select__color-chip' : 'picker-select__chip'}
                style={colored ? chipStyle(opt) : undefined}
              >
                {opt?.label ?? v}
              </span>
            );
          })}
        </span>
      );
    }

    const singleProps = props as SingleProps;
    const selected = options.find((o) => o.value === singleProps.value);
    if (!selected) {
      return <span className="picker-select__placeholder">{placeholder}</span>;
    }
    if (props.relation) {
      return (
        <span className="picker-select__relation-chip">
          {props.onClickSelected && (
            <span
              className="material-icons picker-select__relation-link"
              onClick={(e) => {
                e.stopPropagation();
                props.onClickSelected!(selected.value);
              }}
            >link</span>
          )}
          {selected.label}
        </span>
      );
    }
    if (hasColor(selected)) {
      return (
        <span className="picker-select__color-chip" style={chipStyle(selected)}>
          {selected.label}
        </span>
      );
    }
    return (
      <span className="picker-select__chip">
        {props.avatar && <UserAvatar fullName={selected.label} size="xsmall" />}
        {selected.label}
      </span>
    );
  };

  const isSelected = (value: string) => {
    if (isMulti) {
      return (props as MultiProps).value.includes(value);
    }
    return (props as SingleProps).value === value;
  };

  return (
    <div className={`picker-select ${open ? 'picker-select--open' : ''}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="picker-select__trigger"
        onClick={() => open ? closeDropdown() : openDropdown()}
      >
        {renderTriggerContent()}
      </button>

      {open && createPortal(
        <div className="picker-select__dropdown" ref={dropdownRef} style={dropdownStyle}>
          <div className="picker-select__search">
            <span className="material-icons picker-select__search-icon">search</span>
            <input
              ref={searchRef}
              type="text"
              className="picker-select__search-input"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="picker-select__list">
            {!isMulti && (props as SingleProps).value != null && (
              <li
                className="picker-select__option picker-select__option--clear"
                onClick={() => { (props as SingleProps).onChange(undefined); closeDropdown(); }}
              >
                <span className="material-icons">close</span>
                Effacer
              </li>
            )}
            {filtered.length === 0 && !canCreate ? (
              <li className="picker-select__empty">Aucun résultat</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={`picker-select__option ${isSelected(opt.value) ? 'picker-select__option--selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {isMulti && (
                    <span className={`picker-select__checkbox ${isSelected(opt.value) ? 'picker-select__checkbox--checked' : ''}`}>
                      {isSelected(opt.value) && <span className="material-icons">check</span>}
                    </span>
                  )}
                  {props.relation ? (
                    <span className="picker-select__relation-chip">
                      <span className="material-icons">link</span>
                      {opt.label}
                    </span>
                  ) : hasColor(opt) ? (
                    <span className="picker-select__color-chip" style={chipStyle(opt)}>
                      {opt.label}
                    </span>
                  ) : (
                    <span className="picker-select__chip">
                      {props.avatar && <UserAvatar fullName={opt.label} size="xsmall" />}
                      {opt.label}
                    </span>
                  )}
                </li>
              ))
            )}
            {canCreate && (
              <li
                className={`picker-select__option picker-select__option--create${filtered.length > 0 ? ' picker-select__option--create--bordered' : ''}`}
                onClick={() => { props.onCreate!(search.trim()); setSearch(''); if (!isMulti) closeDropdown(); }}
              >
                <span className="material-icons">add</span>
                Créer &ldquo;{search.trim()}&rdquo;
              </li>
            )}
          </ul>
          {props.onAdd && (
            <button
              type="button"
              className="picker-select__add"
              onClick={() => { props.onAdd!(); closeDropdown(); }}
            >
              <span className="material-icons">add</span>
              {props.addLabel ?? 'Ajouter'}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
