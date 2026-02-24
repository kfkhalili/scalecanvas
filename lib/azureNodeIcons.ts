/**
 * Maps Azure catalog node types to SVG filenames in public/icons/azure/.
 * Icons can be replaced with official Azure Architecture Center SVGs; see public/icons/azure/README.md.
 */
const AZURE_TYPE_TO_FILENAME: Record<string, string> = {
  azureFunctions: "Azure-Functions.svg",
  azureCosmosDb: "Azure-Cosmos-DB.svg",
  azureBlobStorage: "Azure-Blob-Storage.svg",
  azureServiceBus: "Azure-Service-Bus.svg",
  azureEventHubs: "Azure-Event-Hubs.svg",
  azureKeyVault: "Azure-Key-Vault.svg",
};

export function getAzureIconUrl(type: string): string | null {
  const filename = AZURE_TYPE_TO_FILENAME[type];
  if (!filename) return null;
  return `/icons/azure/${filename}`;
}

export function isAzureNodeType(type: string): boolean {
  return type in AZURE_TYPE_TO_FILENAME;
}
