<template>
  <div class="app-container">
    <el-container>
      <el-aside width="220px" class="sidebar">
        <div class="logo">
          <el-icon :size="28" color="#409eff"><Present /></el-icon>
          <span class="title">公益捐赠物资分拣系统</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.path"
            :index="item.path"
          >
            <el-icon><component :is="iconMap[item.icon]" /></el-icon>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </el-menu>
        <div class="sidebar-footer">
          <el-button
            type="primary"
            plain
            size="small"
            @click="handleInitMockData"
            style="width: 100%; margin-bottom: 8px"
          >
            初始化模拟数据
          </el-button>
          <el-button
            type="danger"
            plain
            size="small"
            @click="handleClearData"
            style="width: 100%"
          >
            清空所有数据
          </el-button>
        </div>
      </el-aside>
      <el-container>
        <el-header class="header">
          <div class="header-left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="header-right">
            <el-tag type="success">本地数据源</el-tag>
          </div>
        </el-header>
        <el-main class="main-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Sort, Check, Warning, DataAnalysis, Present, RefreshRight } from '@element-plus/icons-vue'
import { useMaterialStore } from '@/stores/material'

const iconMap: Record<string, any> = {
  Plus,
  Sort,
  Check,
  Warning,
  DataAnalysis,
  Present,
  RefreshRight
}

const route = useRoute()
const router = useRouter()
const store = useMaterialStore()

const activeMenu = ref(route.path)

const menuItems = computed(() => {
  return router.getRoutes()
    .filter(r => r.meta && r.meta.title)
    .map(r => ({
      path: r.path,
      title: r.meta?.title as string,
      icon: r.meta?.icon as string
    }))
    .filter(r => r.path !== '/')
})

const currentPageTitle = computed(() => {
  const route = router.currentRoute.value
  return route.meta?.title as string || '公益捐赠物资分拣系统'
})

function handleMenuSelect(index: string) {
  activeMenu.value = index
  router.push(index)
}

function handleInitMockData() {
  store.initMockData()
  ElMessage.success('模拟数据初始化成功')
}

async function handleClearData() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有数据吗？此操作不可恢复！',
      '清空数据确认',
      { type: 'warning', confirmButtonText: '确认清空', cancelButtonText: '取消' }
    )
    store.clearAllData()
    ElMessage.success('数据已清空')
  } catch {
  }
}

onMounted(() => {
  if (store.batches.length === 0) {
    store.initMockData()
  }
  store.refreshBatchStatus()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.sidebar {
  background-color: #001529;
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  border-bottom: 1px solid #1f3a5f;
}

.logo .title {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background-color: #001529;
}

.sidebar-menu :deep(.el-menu-item) {
  color: #a6adb4;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: #1f3a5f;
  color: #fff;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: #409eff;
  color: #fff;
}

.sidebar-footer {
  padding: 15px;
  border-top: 1px solid #1f3a5f;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
}

.main-content {
  background-color: #f5f7fa;
  overflow-y: auto;
  padding: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
