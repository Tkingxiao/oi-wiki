<template>
  <div class="admin-dashboard">
    <!-- 神社风格顶部栏 -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="logo">
          <span class="logo-icon">🦊</span>
          <span class="logo-text">神域管理</span>
        </h1>
      </div>
      <div class="header-right">
        <span class="welcome-text">お帰りなさい、神主様</span>
      </div>
    </header>

    <div class="dashboard-body">
      <!-- 左侧一级菜单（现代化侧边栏） -->
      <aside class="sidebar">
        <div class="sidebar-menu">
          <div
            v-for="item in menuItems"
            :key="item.name"
            v-show="!item.hidden"
            :class="['menu-item', { active: activeTab === item.name }]"
            @click="switchTab(item.name)"
          >
            <el-icon size="22"><component :is="item.icon" /></el-icon>
            <span class="menu-label">{{ item.label }}</span>
          </div>
        </div>
      </aside>

      <!-- 中间主要内容区域 -->
      <main class="main-content">
        <!-- 统计卡片网格 -->
        <div class="stats-grid">
          <div class="stat-card" v-if="permission === 0 || permission === 1">
            <div class="stat-icon"><el-icon><User /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ userStats.total }}</div>
              <div class="stat-label">氏子总数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><el-icon><VideoPlay /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ contentStats.audioFiles }}</div>
              <div class="stat-label">祝词文件</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><el-icon><Picture /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ contentStats.albums }}</div>
              <div class="stat-label">绘马帐数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><el-icon><Files /></el-icon></div>
            <div class="stat-info">
              <div class="stat-value">{{ contentStats.totalPhotos }}</div>
              <div class="stat-label">绘马总数</div>
            </div>
          </div>
        </div>

        <!-- 移动端快捷导航 -->
        <div class="mobile-nav" v-if="permission === 0 || permission === 1">
          <button class="mobile-nav-btn" :class="{ active: activeTab === 'audio' }" @click="switchTab('audio')">
            <el-icon><VideoPlay /></el-icon>
            <span>祝词管理</span>
          </button>
          <button class="mobile-nav-btn" :class="{ active: activeTab === 'albums' }" @click="switchTab('albums')">
            <el-icon><Picture /></el-icon>
            <span>绘马帐管理</span>
          </button>
          <button class="mobile-nav-btn" :class="{ active: activeTab === 'users' }" @click="switchTab('users')">
            <el-icon><User /></el-icon>
            <span>氏子管理</span>
          </button>
          <button class="mobile-nav-btn" :class="{ active: activeTab === 'plan-documents' }" @click="switchTab('plan-documents')">
            <el-icon><Document /></el-icon>
            <span>祭礼表管理</span>
          </button>
          <button class="mobile-nav-btn" :class="{ active: activeTab === 'bilibiliVideos' }" @click="switchTab('bilibiliVideos')">
            <el-icon><Connection /></el-icon>
            <span>缘结视频</span>
          </button>
        </div>

        <!-- 二级导航与内容面板 -->
        <div class="content-panel">
          <!-- 二级菜单区域（标签页形式） -->
          <div class="sub-nav" v-if="activeTab === 'audio' || activeTab === 'albums' || activeTab === 'users' || activeTab === 'plan-documents' || activeTab === 'bilibiliVideos'">
            <!-- 音频分组 -->
            <template v-if="activeTab === 'audio'">
              <div class="sub-header">
                <h3>祝词分组</h3>
              </div>
              <div class="category-list">
                <div v-for="cat in audioCategories" :key="cat.id" class="category-item" :class="{ active: selectedAudio?.id === cat.id }" @click="selectAudioCategory(cat)">
                  <el-icon><VideoPlay /></el-icon>
                  <span class="name">{{ cat.name }}</span>
                  <span class="count">{{ cat.audios?.length || 0 }}</span>
                  <div class="item-actions">
                    <el-button size="small" @click.stop="editAudioCategory(cat)" class="action-btn" circle><el-icon><Edit /></el-icon></el-button>
                    <el-button size="small" @click.stop="deleteAudioCategory(cat)" class="action-btn danger" circle><el-icon><Delete /></el-icon></el-button>
                  </div>
                </div>
              </div>
            </template>

            <!-- 相册目录 -->
            <template v-if="activeTab === 'albums'">
              <div class="sub-header">
                <h3>绘马帐目录</h3>
              </div>
              <div class="category-list">
                <div v-for="album in albumTags" :key="album.id" class="category-item" :class="{ active: selectedAlbum?.id === album.id }" @click="selectAlbum(album)">
                  <el-icon><Picture /></el-icon>
                  <span class="name">{{ album.name }}</span>
                  <span class="count">{{ album.photos?.length || 0 }}</span>
                  <div class="item-actions">
                    <el-button size="small" @click.stop="editAlbum(album)" class="action-btn" circle><el-icon><Edit /></el-icon></el-button>
                    <el-button size="small" @click.stop="handleDeleteAlbum(album)" class="action-btn danger" circle><el-icon><Delete /></el-icon></el-button>
                  </div>
                </div>
              </div>
            </template>

            <!-- 用户目录（含搜索） -->
            <template v-if="activeTab === 'users'">
              <div class="sub-header">
                <h3>氏子目录</h3>
                <el-button v-if="permission <= 1" type="danger" size="small" @click="refreshAllAvatars" :loading="refreshingAllAvatars">
                  <el-icon><Refresh /></el-icon> 刷新头像
                </el-button>
              </div>
              <el-input v-model="userSearchQuery" placeholder="搜索用户名、账号..." clearable prefix-icon="Search" class="search-box" />
              <div class="user-list">
                <div v-for="user in filteredUsers" :key="user.id" class="user-item" @click="selectUser(user)">
                  <div class="user-avatar" :style="{ backgroundImage: `url(${getAvatarUrl(user)})` }"></div>
                  <div class="user-info">
                    <span class="name" v-html="highlightText(user.name, userSearchQuery)"></span>
                    <span class="account">{{ user.account_number }}</span>
                  </div>
                  <el-tag :type="getPermissionType(user.permission)" size="small">{{ getPermissionLabel(user.permission) }}</el-tag>
                </div>
              </div>
            </template>

            <!-- 祭礼表目录（含筛选） -->
            <template v-if="activeTab === 'plan-documents'">
              <div class="sub-header">
                <h3>祭礼表目录</h3>
              </div>
              <el-input v-model="planDocumentFilters.title" placeholder="搜索文书名..." clearable class="search-box" />
              <el-select v-model="planDocumentFilters.is_review" placeholder="全部状态" clearable size="small" style="width:100%; margin-bottom:12px;">
                <el-option label="待审核" :value="0" />
                <el-option label="已通过" :value="1" />
                <el-option label="未通过" :value="2" />
              </el-select>
              <div class="doc-list">
                <div v-for="doc in paginatedPlanDocuments" :key="doc.id" class="doc-item" :class="{ active: selectedPlanDocument?.id === doc.id }" @click="selectPlanDocument(doc)">
                  <el-icon><Document /></el-icon>
                  <span class="title">{{ doc.title }}</span>
                  <el-tag :type="doc.isReview === 1 ? 'success' : doc.isReview === 0 ? 'warning' : 'danger'" size="small">{{ doc.isReview === 1 ? '已纳' : doc.isReview === 0 ? '待审' : '不纳' }}</el-tag>
                </div>
              </div>
              <el-pagination small layout="prev, pager, next" :total="filteredPlanDocuments.length" :page-size="planDocumentPageSize" @current-change="handlePlanDocumentPageChange" style="margin-top: 16px;" />
            </template>

            <!-- B站视频管理 -->
            <template v-if="activeTab === 'bilibiliVideos'">
              <div class="sub-header">
                <h3>缘结视频</h3>
              </div>
              <div class="video-feed" v-if="allVideosLoading">
                <div class="loading-placeholder">加载中...</div>
              </div>
              <div class="video-feed" v-else>
                <div v-for="video in allVideos" :key="video.id" class="video-feed-item" @click="selectVideoForPreview(video)">
                  <div class="cover" :style="{ backgroundImage: `url(${getBilibiliCover(video.bv)})` }"></div>
                  <div class="info">
                    <div class="title">{{ video.title || video.bv }}</div>
                    <div class="meta">{{ video.user_name }}</div>
                  </div>
                  <el-tag v-if="video.status === 0" type="warning" size="small">待审</el-tag>
                  <el-tag v-else type="success" size="small">已通过</el-tag>
                </div>
              </div>
            </template>
          </div>

          <!-- 右侧详情/操作面板（根据选中项动态显示） -->
          <div class="detail-panel" v-if="selectedAudio || selectedAlbum || selectedUser || selectedPlanDocument || selectedVideo || activeTab === 'bilibiliAuth'">
            <!-- 音频详情表格 -->
            <div v-if="selectedAudio && activeTab === 'audio'" class="detail-section">
              <div class="detail-header">
                <h3>{{ selectedAudio.name }} · 祝词列表</h3>
              </div>
              <el-form :inline="true" :model="audioFilters" class="filters-form">
                <el-form-item label="祝词名"><el-input v-model="audioFilters.name" placeholder="搜索祝词" clearable style="width:150px" @input="onAudioFiltersChange" /></el-form-item>
                <el-form-item label="状态"><el-select v-model="audioFilters.status" placeholder="选择状态" clearable style="width:120px" @change="onAudioFiltersChange"><el-option label="待审核" :value="0" /><el-option label="已审核" :value="1" /><el-option label="不通过" :value="2" /></el-select></el-form-item>
                <el-form-item><el-button @click="resetAudioFilters" class="kamihome-btn small">重置</el-button></el-form-item>
              </el-form>
              <el-table :data="paginatedAudios" stripe class="modern-table">
                <el-table-column prop="name" label="名称" min-width="120" />
                <el-table-column prop="user_name" label="奉纳者" width="80" />
                <el-table-column label="状态" width="70">
                  <template #default="{ row }">
                    <el-tag :type="row.is_review === 1 ? 'success' : row.is_review === 0 ? 'warning' : 'danger'" size="small">
                      {{ row.is_review === 1 ? '已纳' : row.is_review === 0 ? '待审' : '不纳' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="260" v-if="permission === 0 || permission === 1">
                  <template #default="{ row }">
                    <el-button v-if="row.is_review !== 1" size="small" type="success" @click="approveAudio(row)">通过</el-button>
                    <el-button size="small" @click="toggleAudioPlay(row)">试听</el-button>
                    <el-button size="small" @click="editAudio(row)">编辑</el-button>
                    <el-button size="small" type="danger" @click="handleDeleteAudio(row, selectedAudio)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="paging"><span>共 {{ filteredAudios.length }} 条</span><el-pagination background layout="prev, pager, next" :total="filteredAudios.length" :pager-count="5" @current-change="handleAudioPageChange" class="kamihome-pagination" /></div>
            </div>

            <!-- 相册详情表格 -->
            <div v-else-if="selectedAlbum && activeTab === 'albums'" class="detail-section">
              <div class="detail-header">
                <h3>{{ selectedAlbum.name }} · 绘马列表</h3>
              </div>
              <el-form :inline="true" :model="albumFilters" class="filters-form">
                <el-form-item label="绘马名"><el-input v-model="albumFilters.name" placeholder="搜索绘马" clearable style="width:150px" @input="onAlbumFiltersChange" /></el-form-item>
                <el-form-item label="状态"><el-select v-model="albumFilters.status" placeholder="选择状态" clearable style="width:120px" @change="onAlbumFiltersChange"><el-option label="待审核" :value="0" /><el-option label="已审核" :value="1" /><el-option label="不通过" :value="2" /></el-select></el-form-item>
                <el-form-item><el-button @click="resetAlbumFilters" class="kamihome-btn small">重置</el-button></el-form-item>
              </el-form>
              <el-table :data="paginatedPhotos" stripe class="modern-table">
                <el-table-column prop="name" label="名称" min-width="120" />
                <el-table-column prop="user_name" label="奉纳者" width="80" />
                <el-table-column label="状态" width="70">
                  <template #default="{ row }">
                    <el-tag :type="row.is_review === 1 ? 'success' : row.is_review === 0 ? 'warning' : 'danger'" size="small">
                      {{ row.is_review === 1 ? '已纳' : row.is_review === 0 ? '待审' : '不纳' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="260" v-if="permission === 0 || permission === 1">
                  <template #default="{ row }">
                    <el-button v-if="row.is_review !== 1" size="small" type="success" @click="approvePhoto(row)">通过</el-button>
                    <el-button size="small" @click="editPhoto(row)">编辑</el-button>
                    <el-button size="small" type="danger" @click="handleDeletePhoto(row, selectedAlbum)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="paging"><span>共 {{ filteredPhotos.length }} 条</span><el-pagination background layout="prev, pager, next" :total="filteredPhotos.length" :pager-count="5" @current-change="handleAlbumPageChange" class="kamihome-pagination" /></div>
            </div>

            <!-- 用户详情卡片 -->
            <div v-else-if="selectedUser && activeTab === 'users'" class="user-profile-card">
              <div class="profile-header">
                <div class="avatar" :style="{ backgroundImage: `url(${getAvatarUrl(selectedUser)})` }"></div>
                <div class="profile-info">
                  <h3>{{ selectedUser.name }}</h3>
                  <p>{{ selectedUser.account_number }}</p>
                  <el-tag :type="getPermissionType(selectedUser.permission)">{{ getPermissionLabel(selectedUser.permission) }}</el-tag>
                </div>
              </div>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="账号">{{ selectedUser.account_number }}</el-descriptions-item>
                <el-descriptions-item label="状态"><el-tag :type="getStatusType(selectedUser.is_banned)">{{ getStatusLabel(selectedUser.is_banned) }}</el-tag></el-descriptions-item>
                <el-descriptions-item label="入社日">{{ formatTime(selectedUser.create_time) }}</el-descriptions-item>
                <el-descriptions-item label="大航海等级">{{ selectedUser.medal_level ?? selectedUser.guard_level ?? 0 }}</el-descriptions-item>
                <el-descriptions-item label="大航海身份">{{ selectedUser.badge || '未上供' }}</el-descriptions-item>
              </el-descriptions>
              <div class="profile-actions">
                <el-button v-if="canManagePermission(selectedUser)" @click="changeUserPermission(selectedUser)" class="kamihome-btn">{{ getPermissionActionText(selectedUser) }}</el-button>
                <el-button v-if="canResetPassword(selectedUser)" @click="resetUserPassword(selectedUser)" class="kamihome-btn">重置神谕</el-button>
                <el-button v-if="canBanUser(selectedUser)" @click="toggleUserStatus(selectedUser)" class="kamihome-btn warning">{{ selectedUser.is_banned === 0 ? '封印氏子' : '解封氏子' }}</el-button>
                <el-button v-if="canDeleteUser(selectedUser)" @click="deleteUser(selectedUser)" class="kamihome-btn danger">逐出神社</el-button>
                <el-button v-if="canModifyShipSettings(selectedUser)" @click="openShipSettingsDialog(selectedUser)" class="kamihome-btn" plain>大航海设置</el-button>
              </div>
            </div>

            <!-- 祭礼表预览与审核 -->
            <div v-else-if="selectedPlanDocument && activeTab === 'plan-documents'" class="doc-preview">
              <div class="preview-actions">
                <el-button v-if="selectedPlanDocument.isReview === 0" type="success" @click="approvePlanDocument(selectedPlanDocument)">通过</el-button>
                <el-button v-if="selectedPlanDocument.isReview === 0" type="warning" @click="rejectPlanDocument(selectedPlanDocument)">不通过</el-button>
                <el-button v-else type="info" @click="revokePlanDocumentReview(selectedPlanDocument)">撤销审核</el-button>
                <el-button v-if="!selectedPlanDocument.isCurrent" type="primary" @click="handleSetCurrentPlanDocument(selectedPlanDocument)">设为当前</el-button>
                <el-button type="danger" @click="handleDeletePlanDocument(selectedPlanDocument)">删除</el-button>
              </div>
              <docx-preview v-if="selectedPlanPreviewUrl" :src="selectedPlanPreviewUrl" style="height:500px" @error="onPlanPreviewError" />
            </div>

            <!-- B站视频审核详情 -->
            <div v-else-if="selectedVideo && activeTab === 'bilibiliVideos'" class="video-review-card">
              <div class="video-content">
                <div class="video-cover-wrapper" @click="previewVideo(selectedVideo.bv)">
                  <img :src="getBilibiliCover(selectedVideo.bv)" class="video-cover-img" @error="handleCoverError" referrerpolicy="no-referrer" />
                  <div class="video-cover-overlay"><el-icon size="48"><VideoPlay /></el-icon></div>
                </div>
                <div class="video-info-section">
                  <div class="video-title">{{ selectedVideo.title || selectedVideo.bv }}</div>
                  <div class="video-meta-row">
                    <span class="meta-label">奉纳者：</span>
                    <span class="meta-value">{{ selectedVideo.user_name || '未知' }}</span>
                  </div>
                  <div class="video-meta-row">
                    <span class="meta-label">奉纳时间：</span>
                    <span class="meta-value">{{ formatTime(selectedVideo.created_at) }}</span>
                  </div>
                  <div class="video-actions">
                    <template v-if="selectedVideo.status === 0">
                      <el-button type="success" @click="approveVideo(selectedVideo)">通过</el-button>
                      <el-button type="danger" @click="rejectVideo(selectedVideo)">拒绝</el-button>
                    </template>
                    <template v-else>
                      <el-button type="danger" @click="deleteAuditedVideo(selectedVideo)">删除</el-button>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- 大航海表格（神谕授权） -->
            <div v-else-if="activeTab === 'bilibiliAuth'" class="guard-section">
              <div class="section-header">
                <h3>大航海名册</h3>
                <div class="guard-info">
                  <span>神谕更新：{{ guardCacheUpdateTime ? formatTime(guardCacheUpdateTime) : '暂无' }}</span>
                  <span v-if="guardCacheApiTotal > 0">粉丝牌总数：{{ guardCacheApiTotal.toLocaleString() }} 人</span>
                </div>
                <el-input v-model="guardSearchQuery" placeholder="搜索UID" clearable style="width:200px" @input="handleGuardSearch" />
              </div>
              <el-table :data="paginatedGuardData" stripe class="modern-table">
                <el-table-column type="index" label="序号" width="60">
                  <template #default="{ $index }">{{ (guardCurrentPage - 1) * guardPageSize + $index + 1 }}</template>
                </el-table-column>
                <el-table-column prop="uid" label="UID" width="150">
                  <template #default="{ row }">{{ formatUid(row.uid) }}</template>
                </el-table-column>
                <el-table-column prop="username" label="氏子名" min-width="150" />
                <el-table-column prop="medal_level" label="等级" width="80" />
                <el-table-column label="大航海身份" width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.guard_level === 3 ? 'success' : row.guard_level === 2 ? 'warning' : row.guard_level === 1 ? 'danger' : 'info'">
                      {{ row.guard_level === 3 ? '舰长' : row.guard_level === 2 ? '提督' : row.guard_level === 1 ? '总督' : '未上供' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="update_time" label="记录时间" width="180">
                  <template #default="{ row }">{{ formatTime(row.update_time) }}</template>
                </el-table-column>
              </el-table>
              <div class="guard-pagination">
                <span>共 {{ filteredGuardData.length }} 人</span>
                <el-pagination small layout="prev, pager, next" :total="filteredGuardData.length" :page-size="guardPageSize" :current-page="guardCurrentPage" @current-change="handleGuardPageChange" />
              </div>
              <!-- B站授权操作卡片 -->
              <div class="auth-card">
                <el-alert title="神谕说明" type="info" :closable="false">请粘贴B站神使的Cookie，用于确认大航海身份。</el-alert>
                <el-input type="textarea" v-model="manualCookie" rows="3" placeholder="粘贴Cookie神谕..." style="margin:12px 0;" />
                <el-button type="danger" @click="saveCookie">保存神谕</el-button>
                <el-button type="warning" @click="refreshGuardCache" :loading="refreshing">刷新大航海</el-button>
              </div>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-else class="empty-illustration">
            <el-icon size="60"><InfoFilled /></el-icon>
            <p>从左侧选择内容以查看详情</p>
          </div>
        </div>
      </main>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editCategoryDialog" title="编辑祝词分类" width="500px" custom-class="kamihome-dialog"><el-form :model="editCategoryForm" :rules="editCategoryFormRules" ref="editCategoryFormRef" label-width="100px"><el-form-item label="分类名称" prop="name"><el-input v-model="editCategoryForm.name" placeholder="请输入分类名称" maxlength="50" show-word-limit /></el-form-item></el-form><template #footer><span class="dialog-footer"><el-button @click="editCategoryDialog = false" class="kamihome-btn">取消</el-button><el-button type="danger" @click="handleEditCategory" class="kamihome-btn">确定</el-button></span></template></el-dialog>
    <el-dialog v-model="editAudioDialog" title="编辑祝词" width="600px" custom-class="kamihome-dialog"><el-form :model="editAudioForm" :rules="editAudioFormRules" ref="editAudioFormRef" label-width="100px"><el-form-item label="祝词名称" prop="name"><el-input v-model="editAudioForm.name" placeholder="请输入祝词名称" maxlength="100" show-word-limit /></el-form-item><el-form-item label="选择分类"><el-select v-model="editAudioForm.classification_id" placeholder="选择现有分类" clearable style="width:100%" filterable><el-option v-for="category in audioCategories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item><el-form-item label="创建新分类"><el-input v-model="editAudioForm.new_classification_name" placeholder="输入新分类名称" maxlength="50" /></el-form-item></el-form><template #footer><span class="dialog-footer"><el-button @click="editAudioDialog = false" class="kamihome-btn">取消</el-button><el-button type="danger" @click="handleEditAudio" class="kamihome-btn">确定</el-button></span></template></el-dialog>
    <el-dialog v-model="editAlbumDialog" title="编辑绘马帐" width="600px" custom-class="kamihome-dialog"><el-form :model="editAlbumForm" :rules="editAlbumFormRules" ref="editAlbumFormRef" label-width="100px"><el-form-item label="帐名" prop="name"><el-input v-model="editAlbumForm.name" placeholder="请输入绘马帐名称" maxlength="100" show-word-limit /></el-form-item><el-form-item label="帐之介绍"><el-input v-model="editAlbumForm.introduction" type="textarea" rows="3" placeholder="请输入介绍" maxlength="500" show-word-limit /></el-form-item></el-form><template #footer><span class="dialog-footer"><el-button @click="editAlbumDialog = false" class="kamihome-btn">取消</el-button><el-button type="danger" @click="handleEditAlbum" class="kamihome-btn">确定</el-button></span></template></el-dialog>
    <el-dialog v-model="editPhotoDialog" title="编辑绘马" width="600px" custom-class="kamihome-dialog"><el-form :model="editPhotoForm" :rules="editPhotoFormRules" ref="editPhotoFormRef" label-width="100px"><el-form-item label="绘马名称" prop="name"><el-input v-model="editPhotoForm.name" placeholder="请输入绘马名称" maxlength="100" show-word-limit /></el-form-item><el-form-item label="选择绘马帐"><el-select v-model="editPhotoForm.album_id" placeholder="选择现有绘马帐" clearable style="width:100%" filterable><el-option v-for="album in albumTags" :key="album.id" :label="album.name" :value="album.id" /></el-select></el-form-item><el-form-item label="创建新绘马帐"><el-input v-model="editPhotoForm.new_album_name" placeholder="输入新绘马帐名称" maxlength="100" /></el-form-item><el-form-item label="新帐介绍" v-if="editPhotoForm.new_album_name"><el-input v-model="editPhotoForm.new_album_introduction" type="textarea" rows="3" placeholder="输入介绍" maxlength="500" show-word-limit /></el-form-item></el-form><template #footer><span class="dialog-footer"><el-button @click="editPhotoDialog = false" class="kamihome-btn">取消</el-button><el-button type="danger" @click="handleEditPhoto" class="kamihome-btn">确定</el-button></span></template></el-dialog>

    <!-- 大航海设置对话框 -->
    <el-dialog v-model="shipSettingsDialogVisible" title="大航海设置" width="450px" custom-class="kamihome-dialog">
      <el-form :model="shipSettingsForm" label-width="100px">
        <el-form-item label="等级 (0-80)"><el-input-number v-model="shipSettingsForm.medal_level" :min="0" :max="80" controls-position="right" style="width:100%;" /></el-form-item>
        <el-form-item label="身份"><el-select v-model="shipSettingsForm.badge" placeholder="请选择身份" style="width:100%;"><el-option v-for="item in badgeOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipSettingsDialogVisible = false" class="kamihome-btn">取消</el-button>
        <el-button type="danger" @click="saveShipSettings" class="kamihome-btn">保存</el-button>
      </template>
    </el-dialog>

    <!-- 预览视频对话框 -->
    <el-dialog v-model="previewDialogVisible" title="视频预览" width="800px" :close-on-click-modal="true" custom-class="kamihome-dialog video-preview-dialog" align-center>
      <div class="video-preview-container">
        <iframe v-if="previewBv" :src="`https://player.bilibili.com/player.html?bvid=${previewBv}&page=1&high_quality=1&autoplay=0`" scrolling="no" frameborder="0" allowfullscreen="true" class="preview-iframe"></iframe>
        <div v-else class="no-video-placeholder">请选择视频</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { User, Picture, Files, VideoPlay, Edit, Delete, InfoFilled, VideoPause, Document, Refresh, Check, Close, Search, Clock, Connection } from '@element-plus/icons-vue'
import DocxPreview from '@/components/DocxPreview.vue'
import axios from 'axios'
import defaultAvatar from '@/assets/用户.jpg'
import {
    getAudioCategories,
    reviewAudio,
    updateAudio,
    deleteAudio,
    getAlbumCategories,
    updateAlbum,
    deleteAlbum,
    reviewPhoto,
    updatePhoto,
    deletePhoto,
    updateAudioClassification,
    deleteAudioClassification,
    getUsers,
    banUser,
    changeUserPermission as changeUserPermissionAPI,
    resetUserPassword as resetUserPasswordAPI,
    deleteUser as deleteUserAPI
} from '@/api/admin'
import {
    getPlanDocuments,
    deletePlanDocument,
    setCurrentPlanDocument
} from '@/api/planDocument'

const userStore = useUserStore()
const { permission: rawPermission } = storeToRefs(userStore)
const permission = computed(() => {
    const p = rawPermission.value
    return typeof p === 'number' ? p : parseInt(p) || 3
})

const activeTab = ref('audio')

const menuItems = computed(() => [
    { name: 'audio', label: '祝词管理', icon: 'VideoPlay', hidden: false },
    { name: 'albums', label: '绘马帐管理', icon: 'Picture', hidden: false },
    { name: 'users', label: '氏子管理', icon: 'User', hidden: permission.value > 2 },
    { name: 'plan-documents', label: '祭礼表管理', icon: 'Document', hidden: false },
    { name: 'bilibiliVideos', label: '缘结视频', icon: 'VideoPlay', hidden: permission.value > 2 },
    { name: 'bilibiliAuth', label: '神谕授权', icon: 'Picture', hidden: permission.value !== 0 }
])

const switchTab = (tabName) => {
    activeTab.value = tabName
    selectedAudio.value = null
    selectedAlbum.value = null
    selectedUser.value = null
    selectedPlanDocument.value = null
    selectedVideo.value = null
}

const selectedVideo = ref(null)
const selectedAudio = ref(null)
const selectedAlbum = ref(null)
const selectedUser = ref(null)
const planDocuments = ref([])
const selectedPlanDocument = ref(null)
const planPreviewError = ref('')
const planPreviewRenderKey = ref(0)
const planPreviewBaseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : (import.meta.env.VITE_APP_BASE_URL?.replace(/\/api\/?$/, '') || '')
const selectedPlanPreviewUrl = computed(() => {
    if (!selectedPlanDocument.value?.filePath) return ''
    const apiPrefix = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : '/api'
    return `${planPreviewBaseUrl}${apiPrefix}/file/${selectedPlanDocument.value.filePath}`
})

const allVideos = ref([])
const allVideosLoading = ref(false)
const previewDialogVisible = ref(false)
const previewBv = ref('')

const playingAudioId = ref(null)
const audioPlayers = ref(new Map())

const audioFilters = ref({ name: '', status: '', uploader: '', dateRange: [] })
const albumFilters = ref({ name: '', status: '', uploader: '', dateRange: [] })
const planDocumentFilters = ref({ title: '', is_review: null })
const planDocumentCurrentPage = ref(1)
const planDocumentPageSize = ref(10)

const filteredPlanDocuments = computed(() => {
    let result = planDocuments.value
    if (planDocumentFilters.value.title) {
        const title = planDocumentFilters.value.title.toLowerCase()
        result = result.filter(doc => doc.title.toLowerCase().includes(title))
    }
    if (planDocumentFilters.value.is_review !== null && planDocumentFilters.value.is_review !== undefined) {
        result = result.filter(doc => doc.isReview === planDocumentFilters.value.is_review)
    }
    return result
})

const paginatedPlanDocuments = computed(() => {
    const start = (planDocumentCurrentPage.value - 1) * planDocumentPageSize.value
    const end = start + planDocumentPageSize.value
    return filteredPlanDocuments.value.slice(start, end)
})
const audioPagination = ref({ currentPage: 1, pageSize: 10, total: 0 })
const albumPagination = ref({ currentPage: 1, pageSize: 10, total: 0 })

const audioCategories = ref([])
const albumTags = ref([])
const users = ref([])

const userSearchQuery = ref('')

const filteredUsers = computed(() => {
    if (!userSearchQuery.value.trim()) return users.value
    const query = userSearchQuery.value.trim().toLowerCase()
    return users.value.filter(user => {
        return (user.name && user.name.toLowerCase().includes(query)) ||
               (user.account_number && user.account_number.toLowerCase().includes(query)) ||
               (user.email && user.email.toLowerCase().includes(query))
    })
})

const guardCacheData = ref([])
const guardCacheUpdateTime = ref(null)
const guardCacheTotal = ref(0)
const guardCacheApiTotal = ref(0)

const guardSearchQuery = ref('')
const guardCurrentPage = ref(1)
const guardPageSize = 20

const filteredGuardData = computed(() => {
    if (!guardSearchQuery.value.trim()) return guardCacheData.value
    const query = String(guardSearchQuery.value).trim().toLowerCase()
    return guardCacheData.value.filter(item => String(item.uid).toLowerCase().includes(query))
})

const paginatedGuardData = computed(() => {
    const start = (guardCurrentPage.value - 1) * guardPageSize
    const end = start + guardPageSize
    return filteredGuardData.value.slice(start, end)
})

const handleGuardSearch = () => { guardCurrentPage.value = 1 }
const handleGuardPageChange = (page) => { guardCurrentPage.value = page }

const editCategoryDialog = ref(false)
const editingCategory = ref(null)
const editCategoryFormRef = ref(null)
const editCategoryForm = ref({ name: '' })
const editCategoryFormRules = { name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }] }

const editAudioDialog = ref(false)
const editingAudio = ref(null)
const editAudioFormRef = ref(null)
const editAudioForm = ref({ name: '', classification_id: '', new_classification_name: '' })
const editAudioFormRules = { name: [{ required: true, message: '请输入祝词名称', trigger: 'blur' }] }

const editAlbumDialog = ref(false)
const editingAlbum = ref(null)
const editAlbumFormRef = ref(null)
const editAlbumForm = ref({ name: '', introduction: '' })
const editAlbumFormRules = { name: [{ required: true, message: '请输入绘马帐名称', trigger: 'blur' }] }

const editPhotoDialog = ref(false)
const editingPhoto = ref(null)
const editPhotoFormRef = ref(null)
const editPhotoForm = ref({ name: '', album_id: '', new_album_name: '', new_album_introduction: '' })
const editPhotoFormRules = { name: [{ required: true, message: '请输入绘马名称', trigger: 'blur' }] }

const shipSettingsDialogVisible = ref(false)
const shipSettingsUser = ref(null)
const shipSettingsForm = ref({ medal_level: 0, badge: '未上供' })
const badgeOptions = ['未上供', '舰长', '提督', '总督']

const refreshingAllAvatars = ref(false)
const refreshAllAvatars = async () => {
    refreshingAllAvatars.value = true
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.post('/api/avatar/refresh-all', {}, { headers: { Authorization: `Bearer ${token}` } })
        if (res.data.code === 200) {
            ElMessage.success(`头像刷新完成！成功: ${res.data.data?.success || 0}, 失败: ${res.data.data?.failed || 0}`)
            await fetchUsers()
        } else {
            ElMessage.error(res.data.message || '刷新失败')
        }
    } catch (err) {
        ElMessage.error(err.response?.data?.message || '刷新失败')
    } finally {
        refreshingAllAvatars.value = false
    }
}

const userStats = computed(() => ({
    total: users.value.length,
    active: users.value.filter(u => u.is_banned === 0).length,
    inactive: users.value.filter(u => u.is_banned === 1).length
}))
const contentStats = computed(() => {
    const audioCount = audioCategories.value.reduce((sum, c) => sum + c.audios.length, 0)
    const albumCount = albumTags.value.length
    const photoCount = albumTags.value.reduce((sum, a) => sum + a.photos.length, 0)
    return { audioFiles: audioCount, albums: albumCount, totalPhotos: photoCount }
})

const filteredAudios = computed(() => {
    if (!selectedAudio.value) return []
    let list = selectedAudio.value.audios || []
    if (audioFilters.value.name) list = list.filter(a => a.name.toLowerCase().includes(audioFilters.value.name.toLowerCase()))
    if (audioFilters.value.status !== '') list = list.filter(a => a.is_review == audioFilters.value.status)
    return list
})
const paginatedAudios = computed(() => {
    const start = (audioPagination.value.currentPage - 1) * audioPagination.value.pageSize
    return filteredAudios.value.slice(start, start + audioPagination.value.pageSize)
})
const filteredPhotos = computed(() => {
    if (!selectedAlbum.value) return []
    let list = selectedAlbum.value.photos || []
    if (albumFilters.value.name) list = list.filter(p => p.name.toLowerCase().includes(albumFilters.value.name.toLowerCase()))
    if (albumFilters.value.status !== '') list = list.filter(p => p.is_review == albumFilters.value.status)
    return list
})
const paginatedPhotos = computed(() => {
    const start = (albumPagination.value.currentPage - 1) * albumPagination.value.pageSize
    return filteredPhotos.value.slice(start, start + albumPagination.value.pageSize)
})

const canModifyShipSettings = (targetUser) => {
    if (!targetUser) return false
    const currentPerm = permission.value
    const targetPerm = targetUser.permission
    if (currentPerm === 0) return true
    if (currentPerm === 1) return targetUser.id !== userStore.user.id && (targetPerm === 2 || targetPerm === 3)
    return false
}
const openShipSettingsDialog = (user) => {
    if (!canModifyShipSettings(user)) return ElMessage.warning('您无权修改该氏子的大航海数据')
    shipSettingsUser.value = user
    shipSettingsForm.value = { medal_level: user.medal_level || 0, badge: user.badge || '未上供' }
    shipSettingsDialogVisible.value = true
}
const saveShipSettings = async () => {
    if (!shipSettingsUser.value) return
    try {
        const token = localStorage.getItem('oi_token')
        const userId = shipSettingsUser.value.id
        await axios.put(`/api/admin/users/${userId}/medal`, { medal_level: shipSettingsForm.value.medal_level }, { headers: { Authorization: `Bearer ${token}` } })
        await axios.put(`/api/admin/users/${userId}/badge`, { badge: shipSettingsForm.value.badge }, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('大航海设置已更新')
        shipSettingsDialogVisible.value = false
        await fetchUsers()
        if (selectedUser.value?.id === userId) selectedUser.value = users.value.find(u => u.id === userId)
    } catch (err) {
        ElMessage.error(err.response?.data?.error || '修改失败')
    }
}

const manualCookie = ref('')
const refreshing = ref(false)
const saveCookie = async () => {
    if (!manualCookie.value.trim()) return ElMessage.warning('请粘贴神谕Cookie')
    try {
        const token = localStorage.getItem('oi_token')
        await axios.post('/api/bilibili/auth/cookie', { cookie: manualCookie.value }, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('神谕已保存')
        manualCookie.value = ''
        loadGuardCacheData()
    } catch (err) { ElMessage.error('保存失败') }
}
const refreshGuardCache = async () => {
    refreshing.value = true
    try {
        const token = localStorage.getItem('oi_token')
        await axios.post('/api/admin/refresh-guard-cache', {}, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('大航海名册已更新')
        await loadGuardCacheData()
    } catch (err) { ElMessage.error(err.response?.data?.error || '刷新失败') }
    finally { refreshing.value = false }
}
const loadGuardCacheData = async () => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get('/api/admin/guard-cache', { headers: { Authorization: `Bearer ${token}` } })
        guardCacheData.value = res.data.data || []
        guardCacheUpdateTime.value = res.data.update_time || null
        guardCacheTotal.value = res.data.total || 0
        guardCacheApiTotal.value = res.data.api_total || 0
        guardSearchQuery.value = ''
        guardCurrentPage.value = 1
    } catch (err) { guardCacheData.value = [] }
}
const formatUid = (uid) => {
    if (uid === undefined || uid === null) return ''
    const str = String(uid)
    if (!str.includes('e')) return str.replace(/\.0$/, '')
    try { return Number(str).toLocaleString('fullwide', { useGrouping: false }) } catch { return str }
}

const fetchAllVideos = async () => {
    allVideosLoading.value = true
    try {
        const token = localStorage.getItem('oi_token')
        const [pendingRes, auditedRes] = await Promise.all([
            axios.get('/api/admin/bilibili/videos/pending', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('/api/admin/bilibili/videos/audited', { headers: { Authorization: `Bearer ${token}` } })
        ])
        const pending = (pendingRes.data.data || []).map(v => ({ ...v, status: 0 }))
        const audited = (auditedRes.data.data || []).map(v => ({ ...v, status: 1 }))
        allVideos.value = [...pending, ...audited]
    } catch { ElMessage.error('获取缘结视频列表失败') }
    finally { allVideosLoading.value = false }
}
const previewVideo = (bv) => { previewBv.value = bv; previewDialogVisible.value = true }
const selectVideoForPreview = (video) => { selectedVideo.value = video; previewBv.value = video.bv }
const videoCovers = ref({})
const getBilibiliCover = (bv) => {
    if (videoCovers.value[bv]) return videoCovers.value[bv]
    fetchVideoDetail(bv)
    return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'180\' viewBox=\'0 0 320 180\'%3E%3Crect width=\'320\' height=\'180\' fill=\'%23f5e6d3\'/%3E%3Ctext x=\'160\' y=\'95\' font-size=\'14\' text-anchor=\'middle\' fill=\'%23c33a2b\'%3E🦊 加载中%3C/text%3E%3C/svg%3E'
}
const fetchVideoDetail = async (bv) => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get(`/api/bilibili/video/detail/${bv}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.data.code === 200 && res.data.data) {
            if (res.data.data.pic) videoCovers.value[bv] = res.data.data.pic
            if (res.data.data.title && selectedVideo.value?.bv === bv) {
                selectedVideo.value.title = res.data.data.title
            }
        }
    } catch { }
}
const handleCoverError = (e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'180\' viewBox=\'0 0 320 180\'%3E%3Crect width=\'320\' height=\'180\' fill=\'%23f5e6d3\'/%3E%3Ctext x=\'160\' y=\'95\' font-size=\'14\' text-anchor=\'middle\' fill=\'%23c33a2b\'%3E🦊 无封面%3C/text%3E%3C/svg%3E' }
const approveVideo = async (video) => {
    try {
        await ElMessageBox.confirm(`确定通过该视频的缘结申请吗？`, '缘结通过', { type: 'info' })
        const token = localStorage.getItem('oi_token')
        await axios.post(`/api/admin/bilibili/videos/${video.id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('已通过缘结')
        fetchAllVideos()
        selectedVideo.value = null
    } catch (err) { if (err !== 'cancel') ElMessage.error('操作失败') }
}
const rejectVideo = async (video) => {
    try {
        await ElMessageBox.confirm(`确定拒绝该视频的缘结申请吗？`, '拒绝缘结', { type: 'warning' })
        const token = localStorage.getItem('oi_token')
        await axios.post(`/api/admin/bilibili/videos/${video.id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('已拒绝')
        fetchAllVideos()
        selectedVideo.value = null
    } catch (err) { if (err !== 'cancel') ElMessage.error('操作失败') }
}
const deleteAuditedVideo = async (video) => {
    try {
        await ElMessageBox.confirm(`确定删除已缘结的视频吗？`, '警告', { type: 'warning' })
        const token = localStorage.getItem('oi_token')
        await axios.delete(`/api/admin/bilibili/videos/${video.id}`, { headers: { Authorization: `Bearer ${token}` } })
        const savedBvs = localStorage.getItem('cinemaBvs')
        if (savedBvs) {
            try {
                const bvs = JSON.parse(savedBvs)
                if (Array.isArray(bvs) && bvs.length === 4) {
                    const idx = bvs.findIndex(bv => bv === video.bv)
                    if (idx !== -1) { bvs[idx] = ''; localStorage.setItem('cinemaBvs', JSON.stringify(bvs)) }
                }
            } catch { }
        }
        ElMessage.success('删除成功')
        fetchAllVideos()
        selectedVideo.value = null
    } catch (err) { if (err !== 'cancel') ElMessage.error('删除失败') }
}

const fetchAudioCategories = async () => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get('/api/admin/audios', { headers: { Authorization: `Bearer ${token}` } })
        let data = res.data
        if (data?.data && Array.isArray(data.data)) data = data.data
        audioCategories.value = Array.isArray(data) ? data : []
    } catch { ElMessage.error('获取祝词数据失败') }
}
const fetchAlbumCategories = async () => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get('/api/admin/albums', { headers: { Authorization: `Bearer ${token}` } })
        let data = res.data
        if (data?.data && Array.isArray(data.data)) data = data.data
        albumTags.value = Array.isArray(data) ? data : []
    } catch { ElMessage.error('获取绘马帐失败') }
}
const fetchUsers = async () => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
        users.value = res.data
    } catch { ElMessage.error('获取氏子列表失败') }
}
const fetchPlanDocuments = async () => {
    try {
        const token = localStorage.getItem('oi_token')
        const res = await axios.get('/api/admin/plan-documents', { headers: { Authorization: `Bearer ${token}` } })
        let data = res.data
        if (data?.data && Array.isArray(data.data)) data = data.data
        planDocuments.value = Array.isArray(data) ? data : []
    } catch { ElMessage.error('获取祭礼表失败') }
}
const fetchAllData = async () => {
    const p = [fetchAudioCategories(), fetchAlbumCategories(), fetchPlanDocuments()]
    if (permission.value <= 2) { p.push(fetchAllVideos(), fetchUsers()) }
    await Promise.all(p)
    if (permission.value === 0) await loadGuardCacheData()
}

const getFullUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return (import.meta.env.VITE_APP_BASE_URL || '') + (url.startsWith('/') ? '' : '/') + url
}
const getAvatarUrl = (user) => {
    if (user?.bilibili_uid) return `/api/images/avatar/${user.bilibili_uid}.jpg`
    return user?.avatar || defaultAvatar
}
const formatTime = (ts) => {
    if (!ts) return ''
    try {
        const d = new Date(parseInt(ts) * 1000)
        if (isNaN(d.getTime())) return ts
        const diff = Math.floor((Date.now() - d) / 86400000)
        if (diff === 0) return '今日'
        if (diff === 1) return '昨日'
        if (diff < 7) return `${diff}日前`
        return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
    } catch { return ts }
}
const toggleAudioPlay = (audio) => {
    const id = audio.id
    if (playingAudioId.value && playingAudioId.value !== id) {
        audioPlayers.value.get(playingAudioId.value)?.pause()
    }
    let player = audioPlayers.value.get(id)
    if (!player) {
        player = new Audio(getFullUrl(audio.url))
        audioPlayers.value.set(id, player)
        player.addEventListener('ended', () => playingAudioId.value = null)
    }
    if (playingAudioId.value === id) { player.pause(); playingAudioId.value = null }
    else { player.play().catch(() => ElMessage.error('播放失败')); playingAudioId.value = id }
}

const approveAudio = async (a) => { try { await reviewAudio(a.id, 1); a.is_review = 1 } catch { } }
const rejectAudio = async (a) => { try { await reviewAudio(a.id, 2); a.is_review = 2 } catch { } }
const revokeAudioReview = async (a) => { try { await reviewAudio(a.id, 0); a.is_review = 0 } catch { } }
const editAudio = (a) => { editingAudio.value = a; editAudioForm.value = { name: a.name, classification_id: a.classification_id || '', new_classification_name: '' }; editAudioDialog.value = true }
const editAudioCategory = (c) => { editingCategory.value = c; editCategoryForm.value.name = c.name; editCategoryDialog.value = true }
const handleEditCategory = async () => {
    try { await editCategoryFormRef.value.validate(); await updateAudioClassification(editingCategory.value.id, { name: editCategoryForm.value.name.trim() }); ElMessage.success('更新成功'); editCategoryDialog.value = false; fetchAudioCategories() } catch { }
}
const handleEditAudio = async () => {
    try {
        await editAudioFormRef.value.validate()
        const d = {}
        if (editAudioForm.value.name.trim()) d.name = editAudioForm.value.name.trim()
        if (editAudioForm.value.new_classification_name.trim()) d.new_classification_name = editAudioForm.value.new_classification_name.trim()
        else if (editAudioForm.value.classification_id) d.classification_id = editAudioForm.value.classification_id
        if (!Object.keys(d).length) return ElMessage.warning('请至少填写名称或选择分类')
        await updateAudio(editingAudio.value.id, d)
        ElMessage.success('更新成功'); editAudioDialog.value = false; fetchAudioCategories()
    } catch { }
}
const deleteAudioCategory = async (c) => {
    try { await ElMessageBox.confirm(`确定删除"${c.name}"？`, '警告', { type: 'warning' }); await deleteAudioClassification(c.id); ElMessage.success('已删除'); fetchAudioCategories() } catch { }
}
const handleDeleteAudio = async (a, cat) => {
    try { await ElMessageBox.confirm(`确定删除"${a.name}"？`, '警告', { type: 'warning' }); await deleteAudio(a.id); ElMessage.success('已删除'); fetchAudioCategories() } catch { }
}
const editAlbum = (a) => { editingAlbum.value = a; editAlbumForm.value = { name: a.name, introduction: a.introduction || '' }; editAlbumDialog.value = true }
const handleEditAlbum = async () => {
    try { await editAlbumFormRef.value.validate(); await updateAlbum(editingAlbum.value.id, { name: editAlbumForm.value.name.trim(), introduction: editAlbumForm.value.introduction.trim() }); ElMessage.success('更新成功'); editAlbumDialog.value = false; fetchAlbumCategories() } catch { }
}
const handleDeleteAlbum = async (a) => {
    try { await ElMessageBox.confirm(`确定删除"${a.name}"及其绘马？`, '警告', { type: 'warning' }); await deleteAlbum(a.id); ElMessage.success('已删除'); fetchAlbumCategories() } catch { }
}
const approvePhoto = async (p) => { try { await reviewPhoto(p.id, 1); p.is_review = 1 } catch { } }
const rejectPhoto = async (p) => { try { await reviewPhoto(p.id, 2); p.is_review = 2 } catch { } }
const revokePhotoReview = async (p) => { try { await reviewPhoto(p.id, 0); p.is_review = 0 } catch { } }
const editPhoto = (p) => { editingPhoto.value = p; editPhotoForm.value = { name: p.name, album_id: p.album_id || '', new_album_name: '', new_album_introduction: '' }; editPhotoDialog.value = true }
const handleEditPhoto = async () => {
    try {
        await editPhotoFormRef.value.validate()
        const d = {}
        if (editPhotoForm.value.name.trim()) d.name = editPhotoForm.value.name.trim()
        if (editPhotoForm.value.new_album_name.trim()) { d.new_album_name = editPhotoForm.value.new_album_name.trim(); if (editPhotoForm.value.new_album_introduction.trim()) d.new_album_introduction = editPhotoForm.value.new_album_introduction.trim() }
        else if (editPhotoForm.value.album_id) d.album_id = editPhotoForm.value.album_id
        if (!Object.keys(d).length) return ElMessage.warning('请至少填写名称或选择绘马帐')
        await updatePhoto(editingPhoto.value.id, d)
        ElMessage.success('更新成功'); editPhotoDialog.value = false; fetchAlbumCategories()
    } catch { }
}
const handleDeletePhoto = async (p) => {
    try { await ElMessageBox.confirm(`确定删除"${p.name}"？`, '警告', { type: 'warning' }); await deletePhoto(p.id); ElMessage.success('已删除'); fetchAlbumCategories() } catch { }
}

const canManagePermission = (u) => {
    const cp = permission.value
    if (cp === 0) return true
    if (cp === 1) return u.permission >= 1 && u.id !== userStore.user.id
    return false
}
const canResetPassword = (u) => {
    const cp = permission.value, tp = u.permission
    if (cp === 0) return true
    if (cp === 1) return tp >= 1 && u.id !== userStore.user.id
    if (cp === 2) return tp >= 2 && u.id !== userStore.user.id
    return false
}
const canBanUser = (u) => {
    const cp = permission.value, tp = u.permission
    if (cp === 0) return true
    if (cp === 1) return tp >= 1 && u.id !== userStore.user.id
    if (cp === 2) return tp >= 2 && u.id !== userStore.user.id
    return false
}
const canDeleteUser = (u) => {
    const cp = permission.value
    if (cp === 0) return true
    if (cp === 1) return u.permission >= 1 && u.id !== userStore.user.id
    return false
}
const canOperateUser = (u) => canResetPassword(u) || canBanUser(u) || canManagePermission(u) || canDeleteUser(u)

const getPermissionActionText = (u) => {
    if (u.permission === 3) return '授予神官职'
    if (u.permission === 2) return '撤销神官职'
    return '修改神职'
}
const changeUserPermission = async (u) => {
    if (!canManagePermission(u)) return ElMessage.warning('无权修改')
    if (u.id === userStore.user.id) return ElMessage.warning('不能修改自己')
    let newPerm
    if (permission.value === 0) {
        const { value } = await ElMessageBox.prompt('输入新权限 (0:大神主,1:神主,2:神官,3:氏子)', '修改神职', { inputValue: String(u.permission), inputPattern: /^[0-3]$/ })
        if (!value) return
        newPerm = parseInt(value)
        if (newPerm === u.permission) return ElMessage.info('未改变')
    } else if (permission.value === 1) {
        if (u.permission === 3) newPerm = 2; else if (u.permission === 2) newPerm = 3; else return ElMessage.warning('无权修改')
    } else return
    try {
        await ElMessageBox.confirm(`确定修改"${u.name}"的神职？`, '提示', { type: 'warning' })
        await changeUserPermissionAPI(u.id, newPerm)
        u.permission = newPerm
        ElMessage.success('修改成功')
    } catch { }
}
const deleteUser = async (u) => {
    if (!canDeleteUser(u)) return ElMessage.warning('无权逐出')
    if (u.id === userStore.user.id) return ElMessage.warning('不能逐出自己')
    try {
        await ElMessageBox.confirm(`确定逐出"${u.name}"？不可恢复。`, '警告', { type: 'warning' })
        await deleteUserAPI(u.id)
        users.value = users.value.filter(us => us.id !== u.id)
        if (selectedUser.value?.id === u.id) selectedUser.value = null
        ElMessage.success('已逐出')
    } catch { }
}
const toggleUserStatus = async (u) => {
    if (!canBanUser(u)) return ElMessage.warning('无权操作')
    if (u.id === userStore.user.id) return ElMessage.warning('不能操作自己')
    try {
        const ns = u.is_banned === 0 ? 1 : 0
        await banUser(u.id, ns)
        u.is_banned = ns
        ElMessage.success(`已${ns ? '封印' : '解封'}`)
    } catch { }
}
const resetUserPassword = async (u) => {
    if (!canResetPassword(u)) return ElMessage.warning('无权重置')
    if (u.id === userStore.user.id) return ElMessage.warning('不能重置自己')
    try {
        await ElMessageBox.confirm(`确定重置"${u.name}"的神谕？新神谕将发送至邮箱。`, '重置神谕', { type: 'warning' })
        await resetUserPasswordAPI(u.id)
        ElMessage.success('已重置，请通知氏子查收邮件')
    } catch { }
}

const onUserSearch = () => {}
const highlightText = (text, query) => {
    if (!query || !query.trim()) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

const handleDeletePlanDocument = async (d) => {
    try { await ElMessageBox.confirm(`确定删除"${d.title}"？`, '警告', { type: 'warning' }); await deletePlanDocument(d.id); ElMessage.success('已删除'); selectedPlanDocument.value = null; fetchPlanDocuments() } catch (err) { if (err !== 'cancel') ElMessage.error('删除失败') }
}
const handleSetCurrentPlanDocument = async (d) => { try { await setCurrentPlanDocument(d.id); ElMessage.success('已设为当前'); fetchPlanDocuments() } catch { } }
const selectPlanDocument = (d) => { selectedPlanDocument.value = d; planPreviewError.value = ''; planPreviewRenderKey.value++ }
const onPlanPreviewError = (p) => { planPreviewError.value = `暂不支持预览${p?.message ? `（${p.message}）` : ''}` }

const approvePlanDocument = async (d) => {
    try {
        await ElMessageBox.confirm('确定通过此祭礼表？', '审核确认', { type: 'success' })
        const token = localStorage.getItem('oi_token')
        await axios.put(`/api/plan-documents/${d.id}/review`, { is_review: 1 }, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('审核通过')
        await fetchPlanDocuments()
        if (selectedPlanDocument.value && selectedPlanDocument.value.id === d.id) selectedPlanDocument.value.isReview = 1
    } catch (err) { if (err !== 'cancel') ElMessage.error('审核失败') }
}
const rejectPlanDocument = async (d) => {
    try {
        await ElMessageBox.confirm('确定不通过此祭礼表？', '审核确认', { type: 'warning' })
        const token = localStorage.getItem('oi_token')
        await axios.put(`/api/plan-documents/${d.id}/review`, { is_review: 2 }, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('已标记为不通过')
        await fetchPlanDocuments()
        if (selectedPlanDocument.value && selectedPlanDocument.value.id === d.id) selectedPlanDocument.value.isReview = 2
    } catch (err) { if (err !== 'cancel') ElMessage.error('操作失败') }
}
const revokePlanDocumentReview = async (d) => {
    try {
        await ElMessageBox.confirm('确定撤销审核状态？将重新设为待审核', '撤销确认', { type: 'info' })
        const token = localStorage.getItem('oi_token')
        await axios.put(`/api/plan-documents/${d.id}/review`, { is_review: 0 }, { headers: { Authorization: `Bearer ${token}` } })
        ElMessage.success('已撤销审核')
        await fetchPlanDocuments()
        if (selectedPlanDocument.value && selectedPlanDocument.value.id === d.id) selectedPlanDocument.value.isReview = 0
    } catch (err) { if (err !== 'cancel') ElMessage.error('操作失败') }
}

const handlePlanDocumentPageChange = (p) => { planDocumentCurrentPage.value = p }
const onPlanDocumentFiltersChange = () => { planDocumentCurrentPage.value = 1 }

const resetAudioFilters = () => { audioFilters.value = { name: '', status: '', uploader: '', dateRange: [] }; audioPagination.value.currentPage = 1 }
const resetAlbumFilters = () => { albumFilters.value = { name: '', status: '', uploader: '', dateRange: [] }; albumPagination.value.currentPage = 1 }
const handleAudioPageChange = (p) => audioPagination.value.currentPage = p
const handleAlbumPageChange = (p) => albumPagination.value.currentPage = p
const onAudioFiltersChange = () => audioPagination.value.currentPage = 1
const onAlbumFiltersChange = () => albumPagination.value.currentPage = 1

const selectAudioCategory = (c) => { selectedAudio.value = c; resetAudioFilters() }
const selectAlbum = (a) => { selectedAlbum.value = a; resetAlbumFilters() }
const selectUser = (u) => { selectedUser.value = u }

const getPermissionLabel = (p) => p === 0 ? '大神主' : p === 1 ? '神主' : p === 2 ? '神官' : '氏子'
const getPermissionType = (p) => p <= 1 ? 'danger' : p === 2 ? 'warning' : 'primary'
const getStatusLabel = (b) => b === 0 ? '正常' : '封印'
const getStatusType = (b) => b === 0 ? 'success' : 'danger'

onMounted(fetchAllData)
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: #faf5eb;
  font-family: 'Noto Serif JP', serif;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  height: 64px;
  background: rgba(255, 250, 240, 0.8);
  backdrop-filter: blur(8px);
  border-bottom: 2px solid #c33a2b;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.logo { display: flex; align-items: center; gap: 10px; color: #5e2c1a; }
.logo-icon { font-size: 28px; }
.logo-text { font-size: 22px; font-weight: 700; }
.welcome-text { color: #7a3a28; font-style: italic; }

.dashboard-body { display: flex; flex: 1; overflow: hidden; }

.sidebar {
  width: 200px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(4px);
  border-right: 1px solid rgba(200,60,40,0.2);
  padding: 20px 8px;
}
.sidebar-menu { display: flex; flex-direction: column; gap: 4px; }
.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 30px;
  color: #5e2c1a;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
}
.menu-item:hover, .menu-item.active { background: #fce4d6; color: #c33a2b; box-shadow: 0 2px 0 #9b2a1a; }

.main-content { flex: 1; padding: 24px; overflow-y: auto; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 20px;
  margin-bottom: 28px;
}
.stat-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 4px 0 #9b2a1a, 0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid #c33a2b;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 48px; height: 48px;
  background: #c33a2b;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}
.stat-value { font-size: 32px; font-weight: 800; color: #5e2c1a; }
.stat-label { color: #7a3a28; font-weight: 500; }

.content-panel {
  background: white;
  border-radius: 24px;
  border: 1px solid #c33a2b;
  box-shadow: 0 6px 0 #9b2a1a;
  padding: 20px;
  display: flex;
  gap: 20px;
}
.mobile-nav { display: none; }

.sub-nav {
  width: 280px;
  border-right: 1px dashed #c33a2b;
  padding-right: 16px;
}
.sub-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sub-header h3 { color: #5e2c1a; font-size: 16px; margin: 0; }

.category-list, .user-list, .doc-list, .video-feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.category-item, .user-item, .doc-item, .video-feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 16px;
  background: #fef7f0;
  border: 1px solid rgba(200,60,40,0.2);
  cursor: pointer;
  transition: all 0.15s;
}
.category-item.active, .doc-item.active {
  background: #fce4d6;
  border-color: #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
}
.category-item .count, .item-actions { margin-left: auto; display: flex; gap: 4px; }
.action-btn { background: #f5e6d3; border: 1px solid #c33a2b; }
.action-btn.danger { background: #f0d8c0; color: #9b2a1a; }

.user-avatar { width: 36px; height: 36px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid #c33a2b; flex-shrink: 0; }
.user-info { flex: 1; min-width: 0; }
.user-info .name { font-weight: 700; color: #5e2c1a; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-info .account { font-size: 12px; color: #7a3a28; }

.search-box { margin-bottom: 12px; }
.search-highlight { background: #fde68a; color: #5e2c1a; padding: 0 2px; border-radius: 2px; }

.video-feed-item .cover { width: 60px; height: 45px; border-radius: 8px; background-size: cover; background-position: center; border: 1px solid #c33a2b; flex-shrink: 0; }
.video-feed-item .info { flex: 1; min-width: 0; }
.video-feed-item .title { font-weight: 700; color: #5e2c1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.video-feed-item .meta { font-size: 11px; color: #7a3a28; }

.detail-panel { flex: 1; min-width: 0; }
.detail-section { display: flex; flex-direction: column; height: 100%; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.detail-header h3 { color: #5e2c1a; margin: 0; }

.filters-form { background: #fef7f0; padding: 12px; border-radius: 16px; border: 1px dashed #c33a2b; margin-bottom: 16px; }

.modern-table { border-radius: 16px; overflow: hidden; border: 1px solid #c33a2b; }
.modern-table :deep(th) { background: #f5e6d3 !important; color: #5e2c1a !important; font-weight: 700; }
.modern-table :deep(tr:hover td) { background: #fce4d6 !important; }

.paging { margin-top: 16px; display: flex; align-items: center; justify-content: flex-end; gap: 16px; }

.user-profile-card { background: #fef7f0; border-radius: 20px; padding: 20px; border: 1px solid #c33a2b; }
.profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.profile-header .avatar { width: 64px; height: 64px; border-radius: 50%; background-size: cover; border: 3px solid #c33a2b; }
.profile-info h3 { margin: 0 0 4px; color: #5e2c1a; }
.profile-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }

.doc-preview .preview-actions { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }

.video-review-card { background: #fef7f0; border-radius: 20px; padding: 20px; }
.video-review-card .video-cover-wrapper { position: relative; width: 100%; max-width: 320px; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; border: 2px solid #c33a2b; cursor: pointer; }
.video-cover-img { width: 100%; height: 100%; object-fit: cover; }
.video-cover-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; color: white; }
.video-cover-wrapper:hover .video-cover-overlay { opacity: 1; }
.video-review-card .video-content { display: flex; gap: 16px; }
.video-review-card .video-info-section { flex: 1; }
.video-title { font-size: 16px; font-weight: 700; color: #5e2c1a; margin-bottom: 12px; line-height: 1.4; }
.video-meta-row { display: flex; justify-content: space-between; padding: 6px 0; color: #5e2c1a; }
.meta-label { font-weight: 600; color: #7a3a28; }
.meta-value { color: #5e2c1a; }
.info-row { padding: 4px 0; color: #5e2c1a; }
.info-row .label { font-weight: 700; width: 70px; display: inline-block; }
.bv-code { font-family: monospace; background: rgba(200,60,40,0.1); padding: 2px 8px; border-radius: 4px; }
.video-actions { display: flex; gap: 12px; margin-top: 12px; }

.guard-section .section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.guard-section .guard-info { display: flex; gap: 16px; color: #7a3a28; }
.guard-pagination { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; }
.auth-card { margin-top: 24px; padding: 16px; background: #fff; border-radius: 16px; border: 1px dashed #c33a2b; }

.empty-illustration { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9b8a7a; }

.kamihome-btn {
  background: #f5e6d3; border: 1.5px solid #c33a2b; border-radius: 30px;
  padding: 8px 18px; font-size: 14px; font-weight: bold; color: #5e2c1a;
  box-shadow: 0 3px 0 #9b2a1a; cursor: pointer; transition: all 0.1s;
  display: inline-flex; align-items: center; gap: 6px;
}
.kamihome-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #9b2a1a; background: #fce4d6; }
.kamihome-btn.small { padding: 4px 12px; font-size: 13px; }
.kamihome-btn.danger { background: #f0d8c0; color: #9b2a1a; }
.kamihome-btn.warning { background: #fce4d6; }

:deep(.kamihome-dialog) { background: #fef7f0 !important; border: 3px solid #c33a2b !important; border-radius: 20px !important; box-shadow: 0 6px 0 #9b2a1a !important; }
:deep(.kamihome-dialog .el-dialog__header) { border-bottom: 2px dashed #c33a2b; }
:deep(.kamihome-dialog .el-dialog__title) { color: #5e2c1a; font-weight: 600; }

@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2,1fr); }
  .sidebar { width: 80px; }
  .menu-label { display: none; }
  .menu-item { justify-content: center; }
}
@media (max-width: 768px) {
  .dashboard-body { flex-direction: column; }
  .sidebar { width: 100%; border-right: none; border-bottom: 1px solid #c33a2b; padding: 8px; }
  .sidebar-menu { flex-direction: row; overflow-x: auto; }
  .menu-item { flex-direction: column; gap: 4px; padding: 8px; font-size: 12px; }
  .menu-label { display: block; font-size: 10px; }
  .content-panel { flex-direction: column; }
  .sub-nav { width: 100%; border-right: none; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
  .stat-card { padding: 12px; gap: 10px; border-radius: 12px; }
  .stat-icon { width: 36px; height: 36px; border-radius: 10px; }
  .stat-icon .el-icon { font-size: 18px; }
  .stat-value { font-size: 22px; }
  .stat-label { font-size: 12px; }
  .mobile-nav { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 0 12px; margin-bottom: 16px; }
  .mobile-nav-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; background: white; border: 1px solid #c33a2b; border-radius: 10px; color: #5e2c1a; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s; }
  .mobile-nav-btn .el-icon { font-size: 20px; color: #c33a2b; }
  .mobile-nav-btn.active { background: #c33a2b; color: white; }
  .mobile-nav-btn.active .el-icon { color: white; }
  .sidebar { display: none; }
  .video-review-card .video-content { flex-direction: column; }
  .video-review-card .video-cover-wrapper { max-width: 100%; }
  .video-review-card .video-info-section { text-align: center; }
  .video-review-card .video-title { font-size: 14px; }
  .video-review-card .video-meta-row { justify-content: center; gap: 12px; font-size: 12px; }
  .video-review-card .video-actions { justify-content: center; }
  .doc-preview :deep(docx-preview) .docx-wrapper { transform: scale(0.45); transform-origin: top left; }
  .doc-preview :deep(docx-preview) { height: 400px !important; overflow: auto; }
  .doc-preview :deep(docx-preview) .docx-wrapper > section.docx { padding: 8pt 12pt !important; width: 100% !important; max-width: 100% !important; min-height: auto !important; }
}
</style>