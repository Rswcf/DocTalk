export type ReleaseInfo = {
  version: string;
  stage: string;
  build?: string | null;
};

export const PRODUCT_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0').trim();
export const RELEASE_STAGE = (process.env.NEXT_PUBLIC_RELEASE_STAGE || 'beta').trim().toLowerCase();
export const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA || '').trim();

export function formatReleaseStage(stage: string): string {
  if (!stage) return 'Unknown';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function getShortBuildSha(): string | null {
  return BUILD_SHA ? BUILD_SHA.slice(0, 12) : null;
}

export function getFrontendReleaseInfo(): ReleaseInfo {
  return {
    version: PRODUCT_VERSION,
    stage: RELEASE_STAGE,
    build: getShortBuildSha(),
  };
}

export function getReleaseLabel(): string {
  return `${formatReleaseStage(RELEASE_STAGE)} v${PRODUCT_VERSION}`;
}
