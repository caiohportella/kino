export const clientDocuments = {
  codex: {
    client_id: 'https://chatgpt.com/oauth/codex/client.json',
    application_type: 'native',
    client_name: 'Codex',
    redirect_uris: ['http://127.0.0.1/callback', 'http://localhost/callback'],
    token_endpoint_auth_method: 'none',
    token_endpoint_auth_methods_supported: ['none'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  },
  chatgpt: {
    client_id: 'https://chatgpt.com/oauth/client.json',
    redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
  },
}
