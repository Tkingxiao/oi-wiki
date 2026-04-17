import http from '@/utils/http'

// 获取音声管理数据
export function getAudioCategories() {
    return http.get('/admin/audios')
}

// 审核音声
export function reviewAudio(audioId, isReview) {
    return http.post(`/admin/audios/${audioId}/review`, {
        is_review: isReview
    })
}

// 修改音声信息
export function updateAudio(audioId, data) {
    return http.put(`/admin/audios/${audioId}`, data)
}

// 删除音声
export function deleteAudio(audioId) {
    return http.delete(`/admin/audios/${audioId}`)
}

// 获取相册管理数据
export function getAlbumCategories() {
    return http.get('/admin/albums')
}

// 审核相册
export function reviewAlbum(albumId, isReview) {
    return http.post(`/admin/albums/${albumId}/review`, {
        is_review: isReview
    })
}

// 修改相册信息
export function updateAlbum(albumId, data) {
    return http.put(`/admin/albums/${albumId}`, data)
}

// 删除相册
export function deleteAlbum(albumId) {
    return http.delete(`/admin/albums/${albumId}`)
}

// 审核照片
export function reviewPhoto(photoId, isReview) {
    return http.post(`/admin/photos/${photoId}/review`, {
        is_review: isReview
    })
}

// 修改照片信息
export function updatePhoto(photoId, data) {
    return http.put(`/admin/photos/${photoId}`, data)
}

// 删除照片
export function deletePhoto(photoId) {
    return http.delete(`/admin/photos/${photoId}`)
}

// 修改音声分类
export function updateAudioClassification(classificationId, data) {
    return http.put(`/admin/audio-classifications/${classificationId}`, data)
}

// 删除音声分类
export function deleteAudioClassification(classificationId) {
    return http.delete(`/admin/audio-classifications/${classificationId}`)
}

// 获取用户列表
export function getUsers() {
    return http.get('/admin/users')
}

// 封禁/解封用户（使用 PUT 方法，与后端路由匹配）
export function banUser(userId, isBanned) {
    return http.put(`/admin/users/${userId}/ban`, {
        is_banned: isBanned
    })
}

// 修改用户权限
export function changeUserPermission(userId, permission) {
    return http.put(`/admin/users/${userId}/permission`, {
        permission: permission
    })
}

// 重置用户密码
export function resetUserPassword(userId) {
    return http.post(`/admin/users/${userId}/reset-password`)
}

// 删除用户
export function deleteUser(userId) {
    return http.delete(`/admin/users/${userId}`)
}