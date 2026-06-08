type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter
}

export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null
  return tokenGetter()
}
