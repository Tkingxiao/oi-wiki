// backend/src/services/sseService.js

// 存储所有连接的客户端，按放映厅ID分组
const clients = new Map();

/**
 * 添加一个客户端连接
 * @param {number} hallId 放映厅ID (1-4)
 * @param {object} client 客户端对象 { id, res }
 */
export function addClient(hallId, client) {
    if (!clients.has(hallId)) {
        clients.set(hallId, new Map());
    }
    clients.get(hallId).set(client.id, client);
    // 修改为 debug 级别，不再污染 info 日志
    logger.debug(`[SSE] 客户端 ${client.id} 订阅了 ${hallId} 号厅，当前订阅数: ${clients.get(hallId).size}`);
}

/**
 * 移除一个客户端连接
 * @param {number} hallId 放映厅ID
 * @param {string} clientId 客户端ID
 */
export function removeClient(hallId, clientId) {
    const hallClients = clients.get(hallId);
    if (hallClients) {
        hallClients.delete(clientId);
        // 修改为 debug 级别，不再污染 info 日志
        logger.debug(`[SSE] 客户端 ${clientId} 从 ${hallId} 号厅断开，当前订阅数: ${hallClients.size}`);
        if (hallClients.size === 0) {
            clients.delete(hallId);
        }
    }
}

/**
 * 向指定放映厅的所有客户端推送占用状态更新
 * @param {number} hallId 放映厅ID
 * @param {object|null} occupant 占用者信息，如果为null表示该厅已空闲
 */
export function notifyHallOccupantUpdate(hallId, occupant) {
    const hallClients = clients.get(hallId);
    if (!hallClients) return;

    const message = JSON.stringify({
        hall: hallId,
        occupant: occupant,
        timestamp: Date.now()
    });

    hallClients.forEach(client => {
        try {
            client.res.write(`data: ${message}\n\n`);
        } catch (error) {
            logger.error(`[SSE] 向客户端 ${client.id} 推送失败:`, error.message);
            removeClient(hallId, client.id);
        }
    });
}