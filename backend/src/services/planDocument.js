import fs from 'fs';
import path from 'path';
import { queryOne, queryAll, insert, update, remove } from '../method/database.js';

const logger = global.logger;

export async function uploadPlanDocument(file, documentData, userId, permission, originalName = null) {
  try {
    if (!file) {
      return {
        success: false,
        message: '请上传文档文件'
      };
    }

    if (!documentData.title || documentData.title.trim().length === 0) {
      return {
        success: false,
        message: '文档标题不能为空'
      };
    }

    const allowedTypes = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        success: false,
        message: '不支持的文件类型，只允许上传Word文档'
      };
    }

    const fileName = path.basename(file.path);
    const filePath = path.join('plans', fileName).replace(/\\/g, '/');
    const displayName = originalName || file.originalname;

    if (documentData.isCurrent) {
      update('UPDATE plan_document SET is_current = 0');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    // is_review: 1=通过, 0=待审核, 2=拒绝
    const isReview = documentData.isReview !== undefined ? documentData.isReview : (permission <= 2 ? 1 : 0);
    const result = insert(
      `INSERT INTO plan_document (title, file_path, file_name, upload_time, uploader_id, is_current, is_review)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        documentData.title.trim(),
        filePath,
        displayName,
        currentTime,
        userId,
        documentData.isCurrent ? 1 : 0,
        isReview
      ]
    );

    logger.info(`文档上传成功: ${documentData.title} (${displayName}) by user ${userId}, is_review=${isReview}`);

    return {
      success: true,
      message: isReview === 1 ? '文档上传成功' : '文档已上传，等待审核',
      data: {
        id: result.lastInsertRowid,
        title: documentData.title.trim(),
        fileName: displayName,
        filePath: filePath,
        uploadTime: currentTime,
        uploaderId: userId,
        isCurrent: documentData.isCurrent ? 1 : 0,
        isReview: isReview
      }
    };

  } catch (error) {
    logger.error('文档上传失败:', error);
    return {
      success: false,
      message: '文档上传失败，请稍后重试',
      code: 500
    };
  }
}

export async function getPlanDocuments() {
  try {
    // 只返回已审核通过的内容（is_review = 1）
    const documents = queryAll(
      `SELECT id, title, file_name, file_path, upload_time, uploader_id, is_current
       FROM plan_document
       WHERE is_review = 1
       ORDER BY upload_time DESC`
    );

    const processedDocuments = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.file_name,
      filePath: doc.file_path,
      uploadTime: doc.upload_time,
      uploaderId: doc.uploader_id,
      isCurrent: doc.is_current === 1
    }));

    return {
      success: true,
      message: '获取企划文档列表成功',
      data: processedDocuments
    };
  } catch (error) {
    logger.error('获取企划文档列表失败:', error);
    return { success: false, message: '获取失败，请稍后重试', code: 500 };
  }
}

export async function deletePlanDocument(documentId, userId, permission) {
  try {
    const document = queryOne(`
        SELECT id, title, file_path, uploader_id
        FROM plan_document
        WHERE id = ?
    `, [documentId]);

    if (!document) {
      return {
        success: false,
        message: '文档不存在',
        code: 404
      };
    }

    // 权限检查：管理员(0/1/2)可以删除任何文档，黛言人(3)只能删除自己的文档
    if (permission > 2 && document.uploader_id !== userId) {
      return {
        success: false,
        message: '无权限删除他人的文档',
        code: 403
      };
    }

    const filePath = path.join(process.cwd(), 'data', 'document', document.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const deleteResult = remove('DELETE FROM plan_document WHERE id = ?', [documentId]);

    if (deleteResult.changes === 0) {
      return {
        success: false,
        message: '文档删除失败'
      };
    }

    logger.info(`文档删除: ID ${documentId} (${document.title}) by user ${userId}, permission ${permission}`);

    return {
      success: true,
      message: '文档删除成功'
    };

  } catch (error) {
    logger.error('文档删除失败:', error);
    return {
      success: false,
      message: '文档删除失败',
      code: 500
    };
  }
}

export async function setCurrentPlanDocument(documentId, userId, permission) {
  try {
    // 权限检查：只有管理员(0/1/2)可以设置当前祭礼
    if (permission > 2) {
      return { success: false, message: '无权限设置当前祭礼', code: 403 };
    }

    const document = queryOne(
      'SELECT id FROM plan_document WHERE id = ?',
      [documentId]
    );

    if (!document) {
      return { success: false, message: '文档不存在', code: 404 };
    }

    update('UPDATE plan_document SET is_current = 0');
    update('UPDATE plan_document SET is_current = 1 WHERE id = ?', [documentId]);

    return { success: true, message: '已设置为当前文档' };
  } catch (error) {
    logger.error('设置当前文档失败:', error);
    return { success: false, message: '设置失败，请稍后重试', code: 500 };
  }
}

export async function getCurrentPlanDocument() {
  try {
    // 只返回已审核通过的当前文档
    const document = queryOne(
      `SELECT id, title, file_name, file_path, upload_time, uploader_id, is_current
       FROM plan_document
       WHERE is_current = 1 AND is_review = 1
       LIMIT 1`
    );

    if (!document) {
      return {
        success: true,
        data: null
      };
    }

    return {
      success: true,
      message: '获取当前文档成功',
      data: {
        id: document.id,
        title: document.title,
        fileName: document.file_name,
        filePath: document.file_path,
        uploadTime: document.upload_time,
        uploaderId: document.uploader_id,
        isCurrent: document.is_current === 1
      }
    };
  } catch (error) {
    logger.error('获取当前文档失败:', error);
    return { success: false, message: '获取失败，请稍后重试', code: 500 };
  }
}

export async function getPlanDocumentsForAdmin() {
  try {
    const documents = queryAll(
      `SELECT pd.id, pd.title, pd.file_name, pd.file_path, pd.upload_time, pd.uploader_id, pd.is_current, pd.is_review,
              u.name as uploader_name
       FROM plan_document pd
       LEFT JOIN user u ON pd.uploader_id = u.id
       ORDER BY pd.upload_time DESC`
    );

    const processedDocuments = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.file_name,
      filePath: doc.file_path,
      uploadTime: doc.upload_time,
      uploaderId: doc.uploader_id,
      uploaderName: doc.uploader_name,
      isCurrent: doc.is_current === 1,
      isReview: doc.is_review ?? 1
    }));

    return {
      success: true,
      message: '获取企划文档管理数据成功',
      data: processedDocuments
    };
  } catch (error) {
    logger.error('获取企划文档管理数据失败:', error);
    return { success: false, message: '获取失败，请稍后重试', code: 500 };
  }
}

export async function reviewPlanDocument(documentId, isReview, reviewerId, reviewerPermission) {
  try {
    if (reviewerPermission > 2) {
      return {
        success: false,
        message: '无权限审核文档',
        code: 403
      };
    }

    const document = queryOne(
      'SELECT id, title, is_review FROM plan_document WHERE id = ?',
      [documentId]
    );

    if (!document) {
      return {
        success: false,
        message: '文档不存在',
        code: 404
      };
    }

    update('UPDATE plan_document SET is_review = ? WHERE id = ?', [isReview, documentId]);

    const statusText = isReview === 1 ? '审核通过' : isReview === 2 ? '审核拒绝' : '设为待审核';
    logger.info(`祭礼表审核: ${document.title} ID ${documentId} ${statusText} by reviewer ${reviewerId}`);

    return {
      success: true,
      message: `${statusText}成功`,
      data: {
        id: documentId,
        isReview: isReview
      }
    };
  } catch (error) {
    logger.error('祭礼表审核失败:', error);
    return { success: false, message: '审核失败，请稍后重试', code: 500 };
  }
}