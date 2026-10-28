import { useClientService, useConfigStore } from '@opencloud-eu/web-pkg'
import { urlJoin, type Resource } from '@opencloud-eu/web-client'
import { KanbanFormatError } from '../model/schema'
import { GatewayError, type BoardGateway } from './boardSync'

/** What this file needs of an axios response or error, without depending on axios itself */
interface HttpResponse {
  status: number
  headers: Record<string, unknown>
}

function etagOf(response: HttpResponse) {
  const etag = response.headers['oc-etag'] ?? response.headers['etag']
  if (typeof etag !== 'string' || !etag) {
    throw new GatewayError('network')
  }
  return etag
}

function toGatewayError(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('isAxiosError' in error)) {
    return error
  }
  const { response } = error as { response?: HttpResponse }
  const status = response?.status ?? 0
  switch (status) {
    case 409:
    case 412:
      return new GatewayError('conflict', status)
    case 403:
      return new GatewayError('forbidden', status)
    case 404:
    case 410:
      return new GatewayError('notFound', status)
    case 423:
      return new GatewayError('locked', status)
    case 507:
      return new GatewayError('quota', status)
    default:
      // 401 (expired token, renewed by the next request), 5xx, offline, …: retried
      return new GatewayError('network', status)
  }
}

async function request<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (e) {
    throw toGatewayError(e)
  }
}

/**
 * Reads and writes the board file by its id, so it keeps working while the file is renamed
 * or moved. Etags come from the responses themselves: a write reports the etag it created,
 * never one read later that may belong to somebody else's write.
 */
export function useBoardGateway(resource: () => Resource): BoardGateway {
  const clientService = useClientService()
  const configStore = useConfigStore()

  function url() {
    const { fileId, id } = resource()
    return urlJoin(configStore.serverUrl, 'dav', 'spaces', encodeURIComponent(fileId || id))
  }

  return {
    async read() {
      const response = await request(() =>
        clientService.httpAuthenticated.get<ArrayBuffer>(url(), {
          responseType: 'arraybuffer',
          headers: { 'Cache-Control': 'no-cache' }
        })
      )
      let content: string
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(response.data)
      } catch {
        throw new KanbanFormatError('invalidJson')
      }
      return { content, etag: etagOf(response) }
    },

    async write(content, etag) {
      const response = await request(() =>
        clientService.httpAuthenticated.put(url(), content, {
          headers: { 'If-Match': etag, 'Content-Type': 'application/json' }
        })
      )
      return etagOf(response)
    },

    async etag() {
      const response = await request(() =>
        clientService.httpAuthenticated.head(url(), { headers: { 'Cache-Control': 'no-cache' } })
      )
      return etagOf(response)
    }
  }
}
