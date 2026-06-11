<template>
  <div class="statistics-view">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-label">总入库数量</div>
            <div class="stat-value">{{ totalStats.total }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-label">已分配数量</div>
            <div class="stat-value" style="color: #e6a23c">{{ totalStats.allocated }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-label">已发放数量</div>
            <div class="stat-value" style="color: #67c23a">{{ totalStats.distributed }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-label">可用库存</div>
            <div class="stat-value" style="color: #409eff">{{ totalStats.available }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>分类库存统计</span>
          </template>
          <div class="category-stats">
            <div class="category-row" v-for="(stat, category) in store.categoryStats" :key="category">
              <div class="category-info">
                <el-tag :type="getCategoryTagType(category as MaterialCategory)" size="large">
                  {{ getCategoryName(category as MaterialCategory) }}
                </el-tag>
              </div>
              <div class="category-bars">
                <div class="bar-item">
                  <span class="bar-label">可用</span>
                  <div class="bar-wrapper">
                    <div
                      class="bar bar-available"
                      :style="{ width: getBarWidth(stat.available, stat.total) }"
                    ></div>
                  </div>
                  <span class="bar-value">{{ stat.available }}</span>
                </div>
                <div class="bar-item">
                  <span class="bar-label">已分配</span>
                  <div class="bar-wrapper">
                    <div
                      class="bar bar-allocated"
                      :style="{ width: getBarWidth(stat.allocated, stat.total) }"
                    ></div>
                  </div>
                  <span class="bar-value">{{ stat.allocated }}</span>
                </div>
                <div class="bar-item">
                  <span class="bar-label">已发放</span>
                  <div class="bar-wrapper">
                    <div
                      class="bar bar-distributed"
                      :style="{ width: getBarWidth(stat.distributed, stat.total) }"
                    ></div>
                  </div>
                  <span class="bar-value">{{ stat.distributed }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>项目发放统计</span>
          </template>
          <el-table :data="projectStats" stripe style="width: 100%">
            <el-table-column prop="projectName" label="项目" width="140" />
            <el-table-column prop="allocatedCount" label="分配批次" width="80" />
            <el-table-column prop="totalAllocated" label="分配总量" width="100" />
            <el-table-column prop="totalDistributed" label="发放总量" width="100" />
            <el-table-column label="完成率" width="150">
              <template #default="{ row }">
                <el-progress
                  :percentage="row.totalAllocated > 0 ? Math.round((row.totalDistributed / row.totalAllocated) * 100) : 0"
                  :stroke-width="12"
                />
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                  {{ row.status === 'active' ? '进行中' : '已结束' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>批次库存明细</span>
          <div>
            <el-tag v-if="nearExpiryCount > 0" type="warning" style="margin-right: 10px">
              临期批次: {{ nearExpiryCount }}
            </el-tag>
            <el-tag v-if="expiredCount > 0" type="danger">
              过期批次: {{ expiredCount }}
            </el-tag>
          </div>
        </div>
      </template>
      <el-table :data="batchStats" stripe style="width: 100%">
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="materialName" label="物资" width="100" />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }">
            {{ getCategoryName(row.category as MaterialCategory) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="总库存" width="80" />
        <el-table-column prop="availableQuantity" label="可用" width="80">
          <template #default="{ row }">
            <b :style="{ color: row.availableQuantity > 0 ? '#409eff' : '#909399' }">
              {{ row.availableQuantity }}
            </b>
          </template>
        </el-table-column>
        <el-table-column prop="allocatedQuantity" label="已分配" width="80" />
        <el-table-column prop="distributedQuantity" label="已发放" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isExpired" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="row.isNearExpiry" type="warning" size="small">临期优先</el-tag>
            <el-tag v-else-if="row.availableQuantity === 0" type="info" size="small">已清空</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expireDate" label="保质期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expireDate) }}
            <span v-if="row.expireDate && !row.isExpired" class="days-remaining">
              ({{ getDaysUntilExpiry(row.expireDate) }}天)
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="donor" label="捐赠方" width="120" />
        <el-table-column prop="inboundDate" label="入库日期" width="120" />
      </el-table>
    </el-card>

    <el-card class="table-card" style="margin-top: 20px">
      <template #header>
        <span>冲正记录统计</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="correction-stat">
            <div class="stat-label">冲正记录数</div>
            <div class="stat-value small">{{ store.corrections.length }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="correction-stat">
            <div class="stat-label">冲正减少总量</div>
            <div class="stat-value small" style="color: #f56c6c">
              {{ totalCorrectionDiff > 0 ? '+' : '' }}{{ totalCorrectionDiff }}
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="correction-stat">
            <div class="stat-label">涉及发放记录</div>
            <div class="stat-value small">{{ store.corrections.length }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMaterialStore } from '@/stores/material'
import { formatDate, getDaysUntilExpiry } from '@/utils/date'
import type { MaterialCategory } from '@/types'

const store = useMaterialStore()

const totalStats = computed(() => {
  let total = 0, allocated = 0, distributed = 0, available = 0
  store.batches.forEach(b => {
    total += b.quantity
    allocated += b.allocatedQuantity
    distributed += b.distributedQuantity
    available += b.availableQuantity
  })
  return { total, allocated, distributed, available }
})

const nearExpiryCount = computed(() => {
  return store.batches.filter(b => b.isNearExpiry && !b.isExpired).length
})

const expiredCount = computed(() => {
  return store.batches.filter(b => b.isExpired).length
})

const batchStats = computed(() => {
  return [...store.batches].sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? -1 : 1
    if (a.isNearExpiry !== b.isNearExpiry) return a.isNearExpiry ? -1 : 1
    if (a.expireDate && b.expireDate) return a.expireDate.localeCompare(b.expireDate)
    return b.inboundDate.localeCompare(a.inboundDate)
  })
})

const projectStats = computed(() => {
  const stats: Array<{
    projectId: string
    projectName: string
    allocatedCount: number
    totalAllocated: number
    totalDistributed: number
    status: string
  }> = []

  store.projects.forEach(project => {
    const projectAllocations = store.allocations.filter(
      a => a.projectId === project.id && a.status !== 'cancelled'
    )
    const totalAllocated = projectAllocations.reduce((sum, a) => sum + a.quantity, 0)
    const totalDistributed = projectAllocations.reduce((sum, a) => sum + a.distributedQuantity, 0)

    stats.push({
      projectId: project.id,
      projectName: project.name,
      allocatedCount: projectAllocations.length,
      totalAllocated,
      totalDistributed,
      status: project.status
    })
  })

  return stats.sort((a, b) => b.totalAllocated - a.totalAllocated)
})

const totalCorrectionDiff = computed(() => {
  return store.corrections.reduce((sum, c) => sum + (c.correctedQuantity - c.originalQuantity), 0)
})

function getCategoryName(category: MaterialCategory): string {
  const map: Record<MaterialCategory, string> = {
    food: '食品',
    clothing: '衣物',
    daily: '日用品'
  }
  return map[category]
}

function getCategoryTagType(category: MaterialCategory): 'success' | 'info' | 'warning' {
  const map: Record<MaterialCategory, 'success' | 'info' | 'warning'> = {
    food: 'success',
    clothing: 'info',
    daily: 'warning'
  }
  return map[category]
}

function getBarWidth(value: number, total: number): string {
  if (total === 0) return '0%'
  const percentage = Math.min(100, (value / total) * 100)
  return `${percentage}%`
}

onMounted(() => {
  store.refreshBatchStatus()
  store.batches.forEach(b => store.updateBatchAvailable(b.id))
  store.allocations.forEach(a => store.updateAllocationAvailable(a.id))
})
</script>

<style scoped>
.statistics-view {
  display: flex;
  flex-direction: column;
}

.stat-card {
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
}

.stat-value.small {
  font-size: 24px;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.category-row {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.category-info {
  width: 80px;
  flex-shrink: 0;
}

.category-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  width: 50px;
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.bar-wrapper {
  flex: 1;
  height: 20px;
  background-color: #f5f7fa;
  border-radius: 10px;
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 10px;
  transition: width 0.3s;
}

.bar-available {
  background: linear-gradient(90deg, #409eff, #66b1ff);
}

.bar-allocated {
  background: linear-gradient(90deg, #e6a23c, #ebb563);
}

.bar-distributed {
  background: linear-gradient(90deg, #67c23a, #85ce61);
}

.bar-value {
  width: 40px;
  font-size: 12px;
  text-align: right;
  flex-shrink: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.days-remaining {
  font-size: 12px;
  color: #909399;
  margin-left: 5px;
}

.correction-stat {
  text-align: center;
  padding: 15px;
}
</style>
