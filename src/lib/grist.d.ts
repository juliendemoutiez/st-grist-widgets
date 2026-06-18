/**
 * Type declarations for the global `grist` object provided by
 * https://docs.getgrist.com/grist-plugin-api.js
 *
 * The npm "grist-plugin-api" package is a shim that re-exports this global.
 */

declare module 'grist-plugin-api' {
  /** A single row record as returned by onRecord / fetchSelectedRecord. */
  export interface RowRecord {
    id: number;
    [col: string]: unknown;
  }

  /** Column-oriented table data as returned by docApi.fetchTable / fetchSelectedTable. */
  export interface FetchedTable {
    id: number[];
    [col: string]: unknown[];
  }

  export interface ReadyPayload {
    /** Access level requested: 'none' | 'read table' | 'full'. */
    requiredAccess?: string;
    /** Columns the widget expects — used for column mapping UI. */
    columns?: Array<{ name: string; type?: string; title?: string; optional?: boolean }>;
    /** Allow "Select by" linking. */
    allowSelectBy?: boolean;
    /** Called by Grist when the user opens the widget configuration panel. */
    onEditOptions?: () => void;
  }

  export interface TableOperations {
    getTableId(): Promise<string>;
    create(records: { fields: Record<string, unknown> }): Promise<number>;
    update(record: { id: number; fields: Record<string, unknown> }): Promise<void>;
    destroy(rowId: number): Promise<void>;
  }

  export interface AccessTokenResult {
    token: string;
    baseUrl: string;
  }

  export interface DocApi {
    getDocName(): Promise<string>;
    listTables(): Promise<string[]>;
    fetchTable(tableId: string): Promise<FetchedTable>;
    applyUserActions(actions: unknown[][]): Promise<unknown>;
    getAccessToken(options: { readOnly?: boolean }): Promise<AccessTokenResult>;
  }

  const grist: {
    ready(options?: ReadyPayload): void;

    onRecord(
      callback: (record: RowRecord, mappings?: Record<string, string>) => void,
      options?: { keepEncoded?: boolean },
    ): void;

    onRecords(
      callback: (records: RowRecord[], mappings?: Record<string, string>) => void,
      options?: { keepEncoded?: boolean; format?: string },
    ): void;

    onNewRecord(callback: () => void): void;

    onOptions(
      callback: (options: unknown, interaction: unknown) => void,
    ): void;

    fetchSelectedRecord(
      rowId: number,
      options?: { keepEncoded?: boolean },
    ): Promise<RowRecord>;

    fetchSelectedTable(
      options?: { keepEncoded?: boolean },
    ): Promise<FetchedTable>;

    getTable(tableId?: string): Promise<TableOperations>;

    docApi: DocApi;

    mapColumnNames(
      data: unknown,
      options?: { columns?: string[] },
    ): unknown | null;

    mapColumnNamesBack(
      data: unknown,
      options?: { columns?: string[] },
    ): unknown | null;

    setOption(key: string, value: unknown): Promise<void>;
    setOptions(options: Record<string, unknown>): Promise<void>;
    getOption(key: string): Promise<unknown>;
    getOptions(): Promise<Record<string, unknown> | null>;
    clearOptions(): Promise<void>;

    setCursorPos(pos: { rowId?: number; fieldIndex?: number }): Promise<void>;
    setSelectedRows(rowIds: number[] | null): Promise<void>;

    on(event: string, listener: (...args: unknown[]) => void): void;
  };

  export default grist;
}
