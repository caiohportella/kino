import { SEARCH_SCHEMA_VERSION_V1, type SearchResponseV1 } from './types.ts'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false

type Assert<Condition extends true> = Condition

export type SearchResponseV1SchemaVersionContract = Assert<
  Equal<SearchResponseV1['schemaVersion'], typeof SEARCH_SCHEMA_VERSION_V1>
>
