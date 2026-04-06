targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g. dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Name of the resource group')
param resourceGroupName string = 'rg-${environmentName}'

// Sensitive settings — set these via azd env set or Azure Portal after provisioning
@description('GitHub OAuth App Client ID')
@secure()
param githubClientId string = ''

@description('GitHub OAuth App Client Secret')
@secure()
param githubClientSecret string = ''

@description('Express session secret — use a long random string')
@secure()
param sessionSecret string = ''

var resourceToken = toLower(uniqueString(subscription().id, environmentName))
var appServicePlanName = 'asp-${environmentName}-${resourceToken}'
var appServiceName = 'app-${environmentName}-${resourceToken}'
var logAnalyticsName = 'log-${environmentName}-${resourceToken}'
var appInsightsName = 'appi-${environmentName}-${resourceToken}'
var keyVaultName = 'kv-${replace(take(environmentName, 8), '-', '')}-${take(resourceToken, 8)}'

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'logAnalytics'
  scope: rg
  params: {
    name: logAnalyticsName
    location: location
    tags: { 'azd-env-name': environmentName }
  }
}

module appInsights 'modules/appinsights.bicep' = {
  name: 'appInsights'
  scope: rg
  params: {
    name: appInsightsName
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.id
    tags: { 'azd-env-name': environmentName }
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    name: keyVaultName
    location: location
    tags: { 'azd-env-name': environmentName }
    githubClientId: githubClientId
    githubClientSecret: githubClientSecret
    sessionSecret: sessionSecret
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appService'
  scope: rg
  params: {
    planName: appServicePlanName
    appName: appServiceName
    location: location
    tags: { 'azd-env-name': environmentName, 'azd-service-name': 'oauth-server' }
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.name
    frontendOrigin: 'https://codess-aus.github.io'
    frontendReturnUrl: 'https://codess-aus.github.io/write-a-book/wizard/'
  }
}

// Grant the App Service managed identity access to Key Vault secrets
module keyVaultAccess 'modules/keyvault-access.bicep' = {
  name: 'keyVaultAccess'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.name
    principalId: appService.outputs.principalId
  }
}

output RESOURCE_GROUP_ID string = rg.id
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_APP_SERVICE_NAME string = appService.outputs.name
output OAUTH_SERVER_URL string = 'https://${appService.outputs.defaultHostname}'
