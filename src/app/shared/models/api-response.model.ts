/**
 * Standard API response envelope used across every Sport Spot endpoint.
 * The backend wraps all payloads as `{ result: { data, page? }, errors }`.
 */
export interface ApiPage {
  page: number;
  size: number;
  total: number;
}

export interface ApiResponse<T> {
  result: {
    data: T;
    page?: ApiPage;
  };
  errors: unknown[];
}
