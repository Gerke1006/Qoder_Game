/**
 * 资源路径统一入口。
 *
 * public/ 下的内容会被 Vite 原样拷贝到站点根目录，因此这里只拼接 assets 前缀，
 * 保持相对路径，本地 dev、npm run build 产物、Qoder Sites 子路径部署都能正确解析。
 */
const ASSET_ROOT = 'assets';

export type AssetCategory = 'images' | 'audio' | 'fonts';

/** 生成相对于站点根目录的资源 URL，例如 assetUrl('images', 'player.png')。 */
export function assetUrl(category: AssetCategory, fileName: string): string {
  return `${ASSET_ROOT}/${category}/${fileName}`;
}
