param name string
param location string
param tags object = {}

@secure()
param githubClientId string = ''

@secure()
param githubClientSecret string = ''

@secure()
param sessionSecret string = ''

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource githubClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (!empty(githubClientId)) {
  parent: keyVault
  name: 'github-client-id'
  properties: {
    value: githubClientId
  }
}

resource githubClientSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (!empty(githubClientSecret)) {
  parent: keyVault
  name: 'github-client-secret'
  properties: {
    value: githubClientSecret
  }
}

resource sessionSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = if (!empty(sessionSecret)) {
  parent: keyVault
  name: 'session-secret'
  properties: {
    value: sessionSecret
  }
}

output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
