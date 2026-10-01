/** `meta` of every paginated list response. */
export class PaginationMetaDto {
  /** 1-based. */
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}
