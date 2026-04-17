import express from 'express';
import path from 'path';
import { createPublicRoute, createAdminUploadRouteHandler, createAdminRoute, createRouteHandler, createUploadRouteHandler } from '../method/route-helpers.js';
import { authenticateToken, requirePermission } from '../method/auth.js';
import { uploadPlanDocument, getPlanDocuments, deletePlanDocument, setCurrentPlanDocument, getCurrentPlanDocument, getPlanDocumentsForAdmin, reviewPlanDocument } from '../services/planDocument.js';

const router = express.Router();

// 公开访问：获取已审核通过的祭礼表
router.get('/plan-documents', ...createPublicRoute(getPlanDocuments));

router.get('/plan-documents/current', ...createPublicRoute(getCurrentPlanDocument));

// 所有认证用户都可以上传祭礼表（上传后为待审核状态 is_review=0）
router.post('/plan-documents', authenticateToken, ...createUploadRouteHandler({
    destination: path.join(process.cwd(), 'data', 'document', 'plans'),
    maxSize: 20 * 1024 * 1024,
    allowedTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['.doc', '.docx', '.DOC', '.DOCX']
}, 'document', async (req) => {
    const { title, is_current } = req.body;
    const file = req.file;

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const documentData = {
        title: title?.trim(),
        isCurrent: is_current === '1' || is_current === 'true',
        // 管理员(0/1/2)上传的内容自动审核通过，普通用户(3)上传的内容为待审核(0)
        isReview: req.user.permission <= 2 ? 1 : 0
    };

    const result = await uploadPlanDocument(file, documentData, req.user.id, req.user.permission, originalName);
    if (result.success) {
        result.code = 201;
    }
    return result;
}));

// 删除祭礼表：仅管理员(0/1/2)
router.delete('/plan-documents/:id', authenticateToken, requirePermission(2), createRouteHandler(async (req) => {
    const documentId = parseInt(req.params.id);
    
    if (!documentId || documentId <= 0) {
        return {
            success: false,
            message: '无效的文档ID',
            code: 400
        };
    }
    
    return await deletePlanDocument(documentId, req.user.id, req.user.permission);
}));

// 设置当前祭礼：仅管理员(0/1/2)
router.put('/plan-documents/:id/current', authenticateToken, requirePermission(2), createRouteHandler(async (req) => {
    const documentId = parseInt(req.params.id);
    
    if (!documentId || documentId <= 0) {
        return {
            success: false,
            message: '无效的文档ID',
            code: 400
        };
    }
    
    return await setCurrentPlanDocument(documentId, req.user.id, req.user.permission);
}));

// 管理员接口：获取所有祭礼表（包括待审核）
router.get('/admin/plan-documents', ...createAdminRoute(getPlanDocumentsForAdmin, 2));

// 管理员接口：审核祭礼表
router.put('/plan-documents/:id/review', authenticateToken, requirePermission(2), createRouteHandler(async (req) => {
    const documentId = parseInt(req.params.id);
    const { is_review } = req.body;
    
    if (!documentId || documentId <= 0) {
        return {
            success: false,
            message: '无效的文档ID',
            code: 400
        };
    }
    
    if (![0, 1, 2].includes(is_review)) {
        return {
            success: false,
            message: '审核状态无效',
            code: 400
        };
    }
    
    return await reviewPlanDocument(documentId, is_review, req.user.id, req.user.permission);
}));

export default router;
