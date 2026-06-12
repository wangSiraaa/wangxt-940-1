import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/inbound'
  },
  {
    path: '/inbound',
    name: 'Inbound',
    component: () => import('@/views/InboundView.vue'),
    meta: { title: '物资入库', icon: 'Plus' }
  },
  {
    path: '/sorting',
    name: 'Sorting',
    component: () => import('@/views/SortingView.vue'),
    meta: { title: '物资分拣', icon: 'Sort' }
  },
  {
    path: '/distribution',
    name: 'Distribution',
    component: () => import('@/views/DistributionView.vue'),
    meta: { title: '物资发放', icon: 'Check' }
  },
  {
    path: '/correction',
    name: 'Correction',
    component: () => import('@/views/CorrectionView.vue'),
    meta: { title: '冲正登记', icon: 'Warning' }
  },
  {
    path: '/recall',
    name: 'Recall',
    component: () => import('@/views/RecallView.vue'),
    meta: { title: '批次召回与调剂', icon: 'RefreshRight' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/StatisticsView.vue'),
    meta: { title: '库存统计', icon: 'DataAnalysis' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
