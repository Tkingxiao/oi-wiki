import COS from 'cos-nodejs-sdk-v5';
import { read_json } from '../method/read.js';

let cosClient = null;
let cosConfig = null;
let initialized = false;

/**
 * 初始化 COS 客户端
 */
function initCOS() {
    if (initialized) return cosClient;
    
    const config = read_json('configs', 'config');
    cosConfig = config.cos || config.storage?.cos;

    if (!cosConfig || !cosConfig.secretId || !cosConfig.secretKey) {
        logger.warn('COS 配置未找到，将使用本地存储');
        return null;
    }

    try {
        cosClient = new COS({
            SecretId: cosConfig.secretId,
            SecretKey: cosConfig.secretKey,
        });

        logger.info(`COS 客户端初始化成功: Bucket=${cosConfig.bucket}, Region=${cosConfig.region}`);
        initialized = true;
        return cosClient;
    } catch (err) {
        logger.error('COS 客户端初始化失败:', err);
        return null;
    }
}

/**
 * 检查 COS 是否已配置并可用
 */
export function isCOSAvailable() {
    if (!cosClient) {
        initCOS();
    }
    return !!cosClient && !!cosConfig;
}

/**
 * 上传文件到 COS
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @param {string} key - COS 中的对象键（路径）
 * @param {string} contentType - 文件 MIME 类型
 * @returns {Promise<string>} - 返回文件的完整 URL
 */
export async function uploadToCOS(fileBuffer, key, contentType) {
    if (!isCOSAvailable()) {
        throw new Error('COS 未配置或不可用');
    }

    return new Promise((resolve, reject) => {
        cosClient.putObject(
            {
                Bucket: cosConfig.bucket,
                Region: cosConfig.region,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
                CacheControl: 'max-age=2592000',
            },
            (err, data) => {
                if (err) {
                    logger.error('COS 上传失败:', err);
                    reject(err);
                } else {
                    const protocol = cosConfig.useHTTPS !== false ? 'https' : 'http';
                    const customDomain = cosConfig.customDomain;
                    
                    let fileUrl;
                    if (customDomain) {
                        fileUrl = `${protocol}://${customDomain}/${key}`;
                    } else {
                        fileUrl = `${protocol}://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/${key}`;
                    }
                    
                    logger.info(`COS 上传成功: ${key}`);
                    resolve(fileUrl);
                }
            }
        );
    });
}

/**
 * 从 COS 删除文件
 * @param {string} key - COS 中的对象键
 */
export async function deleteFromCOS(key) {
    if (!isCOSAvailable()) {
        return;
    }

    return new Promise((resolve, reject) => {
        cosClient.deleteObject(
            {
                Bucket: cosConfig.bucket,
                Region: cosConfig.region,
                Key: key,
            },
            (err, data) => {
                if (err) {
                    logger.error('COS 删除失败:', err);
                    reject(err);
                } else {
                    logger.info(`COS 删除成功: ${key}`);
                    resolve(data);
                }
            }
        );
    });
}

/**
 * 生成 COS 对象键（路径）
 * @param {string} category - 分类（album/audio/chat/avatar）
 * @param {string} subFolder - 子文件夹
 * @param {string} fileName - 文件名
 * @returns {string} - 完整的对象键
 */
export function generateCOSKey(category, subFolder, fileName) {
    return `${category}/${subFolder}/${fileName}`;
}

/**
 * 判断 URL 是否是 COS URL
 * @param {string} url - 文件 URL
 * @returns {boolean}
 */
export function isCOSUrl(url) {
    if (!url) return false;
    
    const defaultPattern = /\.cos\.[^/]+\.myqcloud\.com/;
    if (defaultPattern.test(url)) return true;
    
    if (cosConfig && cosConfig.customDomain) {
        return url.includes(cosConfig.customDomain);
    }
    
    return false;
}

/**
 * 从 COS URL 中提取对象键
 * @param {string} url - 完整的 COS URL
 * @returns {string|null} - 对象键
 */
export function extractKeyFromCOSUrl(url) {
    if (!url) return null;

    const cosDomainPattern = /https?:\/\/[^/]+\.cos\.[^/]+\.myqcloud\.com\/(.+)/;
    const match = url.match(cosDomainPattern);
    if (match) {
        return match[1];
    }

    if (cosConfig && cosConfig.customDomain) {
        const customDomain = cosConfig.customDomain;
        const protocol = cosConfig.useHTTPS !== false ? 'https' : 'http';
        const baseUrl = `${protocol}://${customDomain}/`;
        
        if (url.startsWith(baseUrl)) {
            return url.substring(baseUrl.length);
        }
    }

    return null;
}
