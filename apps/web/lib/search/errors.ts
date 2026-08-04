import {
  SEARCH_SCHEMA_VERSION_V1,
  SEARCH_SCHEMA_VERSION_V2,
  type SearchSchemaVersion,
} from '@kino/core/search'

export type SearchGatewayErrorBody =
  | {
      readonly error: {
        readonly code: 'unsupported_version'
        readonly supportedMinimum: SearchSchemaVersion
        readonly supportedMaximum: SearchSchemaVersion
        readonly upgradeRequired: true
      }
    }
  | {
      readonly error: {
        readonly code: 'invalid_request'
        readonly field: string
        readonly retryable: false
      }
    }
  | {
      readonly error: {
        readonly code: 'rate_limited'
        readonly retryable: true
        readonly retryAfterSeconds: number
      }
    }
  | {
      readonly error: {
        readonly code: 'temporary_unavailable'
        readonly retryable: true
      }
    }

export class SearchGatewayError extends Error {
  readonly status: number
  readonly body: SearchGatewayErrorBody

  private constructor(status: number, body: SearchGatewayErrorBody) {
    super(body.error.code)
    this.name = 'SearchGatewayError'
    this.status = status
    this.body = body
  }

  static unsupportedVersion(): SearchGatewayError {
    return new SearchGatewayError(426, {
      error: {
        code: 'unsupported_version',
        supportedMinimum: SEARCH_SCHEMA_VERSION_V1,
        supportedMaximum: SEARCH_SCHEMA_VERSION_V2,
        upgradeRequired: true,
      },
    })
  }

  static invalidRequest(field: string): SearchGatewayError {
    return new SearchGatewayError(400, {
      error: {
        code: 'invalid_request',
        field,
        retryable: false,
      },
    })
  }

  static rateLimited(retryAfterSeconds: number): SearchGatewayError {
    return new SearchGatewayError(429, {
      error: {
        code: 'rate_limited',
        retryable: true,
        retryAfterSeconds,
      },
    })
  }

  static temporaryUnavailable(): SearchGatewayError {
    return new SearchGatewayError(503, {
      error: {
        code: 'temporary_unavailable',
        retryable: true,
      },
    })
  }
}
