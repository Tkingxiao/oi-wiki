import path from 'path';
import fs from 'fs';
import { queryOne, queryAll, insert, update, remove, softDelete } from '../method/database.js';

/**
 * 音声服务 - 处理音声相关的业务逻辑
 */

/**
 * 创建音声分类 - 所有用户直接审核通过
 * @param {string} classificationName - 分类名称
 * @param {number} userId - 创建者用户ID
 * @param {number} userPermission - 创建者权限等级（已不再使用）
 * @returns {object} 创建结果
 */
export async function createAudioClassification(classificationName, userId, userPermission) {
    try {
        if (!classificationName || classificationName.trim().length === 0) {
            return { success: false, message: '分类名称不能为空' };
        }
        if (classificationName.length > 50) {
            return { success: false, message: '分类名称不能超过50个字符' };
        }

        // 检查同名分类（只要未删除即冲突）
        const existingClassification = queryOne(`
            SELECT id FROM audio_classification
            WHERE name = ? AND is_deleted = 0
        `, [classificationName.trim()]);
        if (existingClassification) {
            return { success: false, message: '该分类名称已存在' };
        }

        // 所有用户创建的分类直接审核通过
        const isReview = 1;
        const currentTime = Math.floor(Date.now() / 1000);
        const result = insert(`
            INSERT INTO audio_classification (user_id, name, is_review, create_time, update_time)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, classificationName.trim(), isReview, currentTime, currentTime]);

        logger.info(`音声分类创建成功: ${classificationName} by user ${userId} (直接审核通过)`);

        return {
            success: true,
            message: '音声分类创建成功',
            data: {
                classificationId: result.lastInsertRowid,
                name: classificationName.trim(),
                isReview: isReview
            }
        };
    } catch (error) {
        logger.error('音声分类创建失败:', error);
        return { success: false, message: '音声分类创建失败，请稍后重试', code: 500 };
    }
}

/**
 * 获取按分类分组的音声列表（前端reactive格式，只显示审核通过的）
 */
export async function getAudiosGrouped() {
    try {
        const classifications = queryAll(`
            SELECT id, name
            FROM audio_classification
            WHERE is_deleted = 0 AND is_review = 1
            ORDER BY create_time ASC
        `);

        const audioSections = [];
        for (const classification of classifications) {
            const audios = queryAll(`
                SELECT a.id, a.name, a.url
                FROM audio a
                WHERE a.classification_id = ? AND a.is_deleted = 0 AND a.is_review = 1
                ORDER BY a.create_time DESC
            `, [classification.id]);

            const processedAudios = audios.map(audio => ({
                id: audio.id,
                name: audio.name,
                url: `/api/file/${audio.url}`
            }));

            if (processedAudios.length > 0) {
                audioSections.push({
                    id: classification.id,
                    title: classification.name,
                    items: processedAudios
                });
            }
        }

        logger.info(`获取分组音声列表: ${audioSections.length}个分类`);
        return { success: true, message: '获取分组音声列表成功', data: audioSections };
    } catch (error) {
        logger.error('获取分组音声列表失败:', error);
        return { success: false, message: '获取分组音声列表失败', code: 500 };
    }
}

/**
 * 上传音声文件
 */
export async function uploadAudio(file, audioData, userId, userPermission) {
    const { name, classificationId } = audioData;
    try {
        if (!name || !classificationId) {
            return { success: false, message: '音声名称和分类不能为空' };
        }

        const classification = queryOne(`
            SELECT id, name FROM audio_classification
            WHERE id = ? AND is_deleted = 0 AND is_review = 1
        `, [classificationId]);
        if (!classification) {
            return { success: false, message: '音声分类不存在或未审核通过' };
        }

        if (!file) {
            return { success: false, message: '请上传音声文件' };
        }

        const allowedTypes = ['audio/mpeg', 'audio/mp3'];
        if (!allowedTypes.includes(file.mimetype)) {
            return { success: false, message: '不支持的文件类型，只允许上传MP3格式的音频文件' };
        }

        const fileName = path.basename(file.path);
        const filePath = path.join('audios', fileName).replace(/\\/g, '/');
        const isReview = userPermission <= 2 ? 1 : 0;
        const currentTime = Math.floor(Date.now() / 1000);
        const result = insert(`
            INSERT INTO audio (classification_id, user_id, name, url, is_review, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [classificationId, userId, name, filePath, isReview, currentTime, currentTime]);

        const message = isReview === 1 ? '音声上传成功' : '音声上传成功，等待审核';
        logger.info(`音声上传成功: ${name} by user ${userId} (审核状态: ${isReview})`);

        return {
            success: true,
            message: message,
            data: {
                audioId: result.lastInsertRowid,
                name: name,
                url: filePath,
                classification: classification.name,
                isReview: isReview
            }
        };
    } catch (error) {
        logger.error('音声上传失败:', error);
        return { success: false, message: '音声上传失败，请稍后重试', code: 500 };
    }
}

/**
 * 获取音声管理数据（包含分类和音频列表）- 管理员专用
 */
export async function getAudiosForAdmin() {
    try {
        const classifications = queryAll(`
            SELECT ac.id, ac.user_id, ac.name, ac.is_review, ac.create_time, ac.update_time, u.name as user_name
            FROM audio_classification ac
            LEFT JOIN user u ON ac.user_id = u.id
            WHERE ac.is_deleted = 0
            ORDER BY ac.create_time DESC
        `);

        const audioCategories = [];
        for (const classification of classifications) {
            const audios = queryAll(`
                SELECT a.id, a.classification_id, a.user_id, a.name, a.url, a.is_review, a.create_time, a.update_time, u.name as user_name
                FROM audio a
                LEFT JOIN user u ON a.user_id = u.id
                WHERE a.classification_id = ? AND a.is_deleted = 0
                ORDER BY a.create_time DESC
            `, [classification.id]);

            const processedAudios = audios.map(audio => ({
                id: audio.id,
                classification_id: audio.classification_id,
                user_id: audio.user_id,
                user_name: audio.user_name,
                name: audio.name,
                url: `/api/file/${audio.url}`,
                is_review: audio.is_review,
                create_time: audio.create_time,
                update_time: audio.update_time
            }));

            audioCategories.push({
                id: classification.id,
                name: classification.name,
                user_id: classification.user_id,
                user_name: classification.user_name,
                is_review: classification.is_review,
                create_time: classification.create_time,
                update_time: classification.update_time,
                audios: processedAudios
            });
        }

        logger.info(`获取音声管理数据: ${audioCategories.length}个分类`);
        return { success: true, message: '获取音声管理数据成功', data: audioCategories };
    } catch (error) {
        logger.error('获取音声管理数据失败:', error);
        return { success: false, message: '获取音声管理数据失败', code: 500 };
    }
}

/**
 * 审核音声
 */
export async function reviewAudio(audioId, isReview, adminId) {
    try {
        if (![0, 1, 2].includes(isReview)) {
            return { success: false, message: '无效的审核状态' };
        }
        const audio = queryOne(`SELECT id, name, is_review FROM audio WHERE id = ? AND is_deleted = 0`, [audioId]);
        if (!audio) return { success: false, message: '音声不存在', code: 404 };

        const updateResult = update(`UPDATE audio SET is_review = ?, update_time = ? WHERE id = ?`, [isReview, Math.floor(Date.now() / 1000), audioId]);
        if (updateResult.changes === 0) return { success: false, message: '审核失败' };

        logger.info(`音声审核: ID ${audioId} 状态 ${audio.is_review} -> ${isReview} by admin ${adminId}`);
        return { success: true, message: '音声审核成功', data: { audioId, oldReview: audio.is_review, newReview: isReview } };
    } catch (error) {
        logger.error('音声审核失败:', error);
        return { success: false, message: '音声审核失败', code: 500 };
    }
}

/**
 * 修改音声信息
 */
export async function updateAudio(audioId, updateData, adminId) {
    try {
        const { name, classification_id } = updateData;
        if (!name || name.trim().length === 0) return { success: false, message: '音声名称不能为空' };

        const audio = queryOne(`SELECT id, name, classification_id FROM audio WHERE id = ? AND is_deleted = 0`, [audioId]);
        if (!audio) return { success: false, message: '音声不存在', code: 404 };

        if (classification_id !== undefined) {
            const classification = queryOne(`SELECT id FROM audio_classification WHERE id = ? AND is_deleted = 0`, [classification_id]);
            if (!classification) return { success: false, message: '音声分类不存在' };
        }

        const updateFields = [];
        const updateValues = [];
        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
        if (classification_id !== undefined) { updateFields.push('classification_id = ?'); updateValues.push(classification_id); }
        if (updateFields.length === 0) return { success: false, message: '没有需要更新的字段' };

        updateFields.push('update_time = ?');
        updateValues.push(Math.floor(Date.now() / 1000));
        updateValues.push(audioId);

        const updateResult = update(`UPDATE audio SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        if (updateResult.changes === 0) return { success: false, message: '音声更新失败' };

        logger.info(`音声更新: ID ${audioId} by admin ${adminId}`);
        return { success: true, message: '音声更新成功', data: { audioId, updatedFields: updateFields.filter(f => !f.includes('update_time')) } };
    } catch (error) {
        logger.error('音声更新失败:', error);
        return { success: false, message: '音声更新失败', code: 500 };
    }
}

/**
 * 删除音声（硬删除，同时删除物理文件）
 */
export async function deleteAudio(audioId, adminId) {
    try {
        // 先查询音声信息，获取文件路径
        const audio = queryOne(`SELECT id, name, url, is_deleted FROM audio WHERE id = ?`, [audioId]);
        if (!audio) return { success: false, message: '音声不存在', code: 404 };
        if (audio.is_deleted) return { success: false, message: '音声已被删除', code: 400 };

        // 删除物理文件
        if (audio.url) {
            const filePath = path.join(process.cwd(), audio.url);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    logger.info(`已删除音频文件: ${filePath}`);
                }
            } catch (fileErr) {
                logger.error(`删除音频文件失败: ${filePath}`, fileErr);
                // 文件删除失败不影响数据库删除，但记录错误
            }
        }

        // 硬删除数据库记录
        const deleteResult = global.db.prepare('DELETE FROM audio WHERE id = ?').run(audioId);
        if (deleteResult.changes === 0) return { success: false, message: '音声删除失败', code: 500 };

        logger.info(`音声硬删除: ID ${audioId} (${audio.name}) by admin ${adminId}`);
        return { success: true, message: '音声删除成功' };
    } catch (error) {
        logger.error('音声删除失败:', error);
        return { success: false, message: '音声删除失败', code: 500 };
    }
}

/**
 * 修改音声分类信息
 */
export async function updateAudioClassification(classificationId, updateData, adminId) {
    try {
        const { name } = updateData;
        if (!name || name.trim().length === 0) return { success: false, message: '分类名称不能为空' };
        if (name.length > 50) return { success: false, message: '分类名称不能超过50个字符' };

        const classification = queryOne(`SELECT id, name FROM audio_classification WHERE id = ? AND is_deleted = 0`, [classificationId]);
        if (!classification) return { success: false, message: '音声分类不存在', code: 404 };

        const existingClassification = queryOne(`SELECT id FROM audio_classification WHERE name = ? AND is_deleted = 0 AND is_review = 1 AND id != ?`, [name.trim(), classificationId]);
        if (existingClassification) return { success: false, message: '该分类名称已存在' };

        const updateResult = update(`UPDATE audio_classification SET name = ?, update_time = ? WHERE id = ?`, [name.trim(), Math.floor(Date.now() / 1000), classificationId]);
        if (updateResult.changes === 0) return { success: false, message: '音声分类更新失败' };

        logger.info(`音声分类更新: ID ${classificationId} (${classification.name} -> ${name.trim()}) by admin ${adminId}`);
        return { success: true, message: '音声分类更新成功', data: { classificationId, oldName: classification.name, newName: name.trim() } };
    } catch (error) {
        logger.error('音声分类更新失败:', error);
        return { success: false, message: '音声分类更新失败', code: 500 };
    }
}

/**
 * 删除音声分类（硬删除，前提是分类下没有音频）
 */
export async function deleteAudioClassification(classificationId, adminId) {
    try {
        if (!classificationId || isNaN(parseInt(classificationId))) {
            return { success: false, message: '无效的分类ID', code: 400 };
        }
        const id = parseInt(classificationId);
        const classification = queryOne(`SELECT id, name, is_deleted FROM audio_classification WHERE id = ?`, [id]);
        if (!classification) return { success: false, message: '音声分类不存在', code: 404 };
        if (classification.is_deleted) return { success: false, message: '音声分类已被删除', code: 400 };

        // 检查分类下是否有音频
        const audioCountResult = queryOne(`SELECT COUNT(*) as count FROM audio WHERE classification_id = ? AND is_deleted = 0`, [id]);
        const audioCount = audioCountResult ? audioCountResult.count : 0;
        if (audioCount > 0) {
            return { success: false, message: `该分类下还有 ${audioCount} 个音频，无法删除`, code: 400 };
        }

        // 硬删除分类
        const deleteResult = global.db.prepare('DELETE FROM audio_classification WHERE id = ?').run(id);
        if (deleteResult.changes === 0) return { success: false, message: '音声分类删除失败', code: 500 };

        logger.info(`音声分类硬删除: ID ${id} (${classification.name}) by admin ${adminId}`);
        return { success: true, message: '音声分类删除成功' };
    } catch (error) {
        logger.error('音声分类删除失败:', error);
        return { success: false, message: error.message || '音声分类删除失败', code: 500 };
    }
}

/**
 * 获取音声数据（按标签或全部）
 */
export async function getAudiosForDownload(classificationId) {
    try {
        let query = `
            SELECT a.id, a.name, a.url, a.user_id, u.name as user_name, ac.name as classification_name
            FROM audio a
            LEFT JOIN user u ON a.user_id = u.id
            LEFT JOIN audio_classification ac ON a.classification_id = ac.id
            WHERE a.is_deleted = 0 AND a.is_review = 1
        `;
        const params = [];
        if (classificationId) {
            query += ' AND a.classification_id = ?';
            params.push(classificationId);
        }
        query += ' ORDER BY a.classification_id, a.create_time DESC';
        return queryAll(query, params);
    } catch (error) {
        logger.error('获取音声数据失败:', error);
        throw error;
    }
}